"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MyPull } from "./my-pulls-tabs";
import { ClipboardIcon, EmptyState } from "../../_components/empty-state";

type Range = "today" | "week" | "all";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];

// UI-only preference (kept in localStorage — it's per-device by design).
const HIDE_KEY = "legends.pos-hide-entered";
// Legacy per-device store of checked line ids. Read once to migrate into the
// server table, then left untouched (non-destructive).
const LEGACY_LOGGED_KEY = "legends.pos-logged-line-ids";
const MIGRATED_KEY = "legends.pos-log-migrated";

export type EnteredEntry = { pull_line_id: string; entered_at: string };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  // Treat Monday as the start of the week.
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Read the legacy localStorage line ids (both the old array shape and the
// newer { [id]: checkedAtMs } object shape). Used only for the one-time import.
function readLegacyLoggedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_LOGGED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    if (parsed && typeof parsed === "object") return Object.keys(parsed);
    return [];
  } catch {
    return [];
  }
}

export function TransfersLog({
  pulls,
  storeId,
  initialEntered,
}: {
  pulls: MyPull[];
  storeId: string;
  initialEntered: EnteredEntry[];
}) {
  const [range, setRange] = useState<Range>("all");
  // Map of lineId -> entered_at ISO string, sourced from the server and kept
  // live via realtime. This is the single source of truth for "entered".
  const [entered, setEntered] = useState<Map<string, string>>(
    () => new Map(initialEntered.map((e) => [e.pull_line_id, e.entered_at])),
  );
  // Default to hiding entered rows so checking = the item leaves the list.
  const [hideLogged, setHideLogged] = useState(true);

  // Resync from server truth when the page passes new initial data
  // (e.g., navigating back to POS Log).
  const initialRef = useRef(initialEntered);
  useEffect(() => {
    if (initialEntered !== initialRef.current) {
      initialRef.current = initialEntered;
      setEntered(
        new Map(initialEntered.map((e) => [e.pull_line_id, e.entered_at])),
      );
    }
  }, [initialEntered]);

  // Hydrate the hide-entered preference from localStorage after mount to avoid
  // an SSR mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(HIDE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setHideLogged(stored === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HIDE_KEY, hideLogged ? "1" : "0");
  }, [hideLogged]);

  // Realtime: keep every device at this store in sync as lines are checked or
  // unchecked. FULL replica identity on the table means DELETE payloads still
  // carry pull_line_id.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("pos-log-entries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pos_log_entries",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as EnteredEntry;
          setEntered((prev) => {
            const next = new Map(prev);
            next.set(row.pull_line_id, row.entered_at);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pos_log_entries",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const old = payload.old as { pull_line_id?: string };
          if (!old.pull_line_id) return;
          setEntered((prev) => {
            if (!prev.has(old.pull_line_id!)) return prev;
            const next = new Map(prev);
            next.delete(old.pull_line_id!);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // One-time, non-destructive import of any pre-existing localStorage marks
  // into the server table. Runs once per device; leaves the old key in place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(MIGRATED_KEY) === "1") return;
    const legacyIds = readLegacyLoggedIds();
    // Mark migrated up front so this never runs twice, even if the import
    // below fails — the worst case is a user re-checks a few rows by hand.
    window.localStorage.setItem(MIGRATED_KEY, "1");
    if (legacyIds.length === 0) return;

    const supabase = createSupabaseBrowserClient();
    // The RPC ignores ids that don't belong to this store / aren't shipped, so
    // it's safe to send everything the browser had stored.
    supabase
      .rpc("set_pos_log_entries", {
        p_pull_line_ids: legacyIds,
        p_entered: true,
      })
      .then(({ error }) => {
        if (error) return;
        // Optimistically reflect any imported ids that are in the current view;
        // realtime will fill in the rest.
        const now = new Date().toISOString();
        setEntered((prev) => {
          const next = new Map(prev);
          for (const id of legacyIds) if (!next.has(id)) next.set(id, now);
          return next;
        });
      });
  }, []);

  const writeEntered = useCallback(
    async (lineIds: string[], value: boolean) => {
      if (lineIds.length === 0) return;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("set_pos_log_entries", {
        p_pull_line_ids: lineIds,
        p_entered: value,
      });
      if (error) alert(error.message);
      return error;
    },
    [],
  );

  const toggleLogged = useCallback(
    async (lineId: string) => {
      const wasChecked = entered.has(lineId);
      if (wasChecked) {
        if (
          !window.confirm(
            "Uncheck this item? Only do this if it was checked by mistake.",
          )
        ) {
          return;
        }
      }
      // Optimistic update, with rollback on failure.
      const prevValue = entered.get(lineId);
      setEntered((prev) => {
        const next = new Map(prev);
        if (wasChecked) next.delete(lineId);
        else next.set(lineId, new Date().toISOString());
        return next;
      });
      const error = await writeEntered([lineId], !wasChecked);
      if (error) {
        setEntered((prev) => {
          const next = new Map(prev);
          if (wasChecked && prevValue !== undefined) next.set(lineId, prevValue);
          else next.delete(lineId);
          return next;
        });
      }
    },
    [entered, writeEntered],
  );

  const rows = useMemo(() => {
    const now = new Date();
    const since =
      range === "today"
        ? startOfDay(now)
        : range === "week"
          ? startOfWeek(now)
          : null;

    const filtered = pulls.filter((p) => {
      if (p.status !== "sent" && p.status !== "received") return false;
      const ref = p.sent_at ?? p.received_at;
      if (!since) return true;
      if (!ref) return false;
      return new Date(ref) >= since;
    });

    // Flatten to one row per line for POS-entry friendliness.
    type Row = {
      pullId: string;
      lineId: string;
      sentAt: string | null;
      status: "sent" | "received";
      style: string;
      sku: string;
      color: string | null;
      size: string | null;
      qty: number;
      fromCode: number;
      toCode: number | null;
      toLabel: string;
    };
    const out: Row[] = [];
    for (const p of filtered) {
      const toCode = p.claimed_by_store?.code ?? null;
      const toLabel = p.claimed_by_store
        ? `Store ${p.claimed_by_store.code}`
        : "Warehouse";
      for (const l of p.pull_lines) {
        out.push({
          pullId: p.id,
          lineId: l.id,
          sentAt: p.sent_at,
          status: p.status as "sent" | "received",
          style: p.style_name,
          sku: l.sku,
          color: l.color,
          size: l.size,
          qty: l.quantity,
          fromCode: p.from_store.code,
          toCode,
          toLabel,
        });
      }
    }
    // Sort by sent_at desc, then by pull id for stability.
    out.sort((a, b) => {
      const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.pullId.localeCompare(b.pullId);
    });
    return out;
  }, [pulls, range]);

  const visibleRows = useMemo(
    () => (hideLogged ? rows.filter((r) => !entered.has(r.lineId)) : rows),
    [rows, hideLogged, entered],
  );

  const loggedCount = useMemo(
    () => rows.reduce((n, r) => n + (entered.has(r.lineId) ? 1 : 0), 0),
    [rows, entered],
  );

  const uncheckedVisibleCount = useMemo(
    () => visibleRows.reduce((n, r) => n + (entered.has(r.lineId) ? 0 : 1), 0),
    [visibleRows, entered],
  );

  async function checkAllVisible() {
    const toCheck = visibleRows
      .filter((r) => !entered.has(r.lineId))
      .map((r) => r.lineId);
    if (toCheck.length === 0) return;
    const now = new Date().toISOString();
    setEntered((prev) => {
      const next = new Map(prev);
      for (const id of toCheck) if (!next.has(id)) next.set(id, now);
      return next;
    });
    const error = await writeEntered(toCheck, true);
    if (error) {
      setEntered((prev) => {
        const next = new Map(prev);
        for (const id of toCheck) next.delete(id);
        return next;
      });
    }
  }

  function exportCsv() {
    const header = [
      "sent_at",
      "from_store",
      "to_store",
      "style",
      "sku",
      "color",
      "size",
      "qty",
      "status",
      "pos_logged",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.sentAt ?? "",
          r.fromCode,
          r.toLabel,
          r.style,
          r.sku,
          r.color ?? "",
          r.size ?? "",
          r.qty,
          r.status,
          entered.has(r.lineId) ? "yes" : "no",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legends-transfers-${range}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-start gap-2.5">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-amber-700"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-wide text-amber-900">
              Log into POS
            </div>
            <p className="text-sm text-amber-900 mt-0.5 leading-snug">
              This is the most important step. Enter each transfer into POS,
              then tap the row to check it off. Checks sync across every device
              at your store. Use Hide entered to tidy the list — nothing is ever
              deleted. Unchecking requires confirmation to prevent double entry.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2 border-b border-zinc-200 overflow-x-auto">
        {RANGES.map((r) => {
          const active = r.id === range;
          return (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`shrink-0 h-11 px-4 rounded-full text-sm font-semibold border ${
                active
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300"
              }`}
            >
              {r.label}
            </button>
          );
        })}
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto shrink-0 h-11 px-4 rounded-full text-sm font-semibold bg-zinc-900 text-white disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {rows.length > 0 && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 flex-wrap">
          <div className="text-sm font-semibold text-zinc-800">
            {loggedCount} of {rows.length} entered
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={checkAllVisible}
              disabled={uncheckedVisibleCount === 0}
              className="h-9 px-3 rounded-full text-xs font-semibold bg-emerald-500 text-white border border-emerald-500 disabled:opacity-40"
            >
              Check all
              {uncheckedVisibleCount > 0 && ` (${uncheckedVisibleCount})`}
            </button>
            <button
              onClick={() => setHideLogged((v) => !v)}
              className={`h-9 px-3 rounded-full text-xs font-semibold border ${
                hideLogged
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300"
              }`}
            >
              {hideLogged ? "Show entered" : "Hide entered"}
            </button>
          </div>
        </div>
      )}

      {visibleRows.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon />}
            title="No transfers shipped in this range"
            body="After you mark a tote Shipped in the To ship tab, every line shows up here ready for POS entry. Tap each row to check it off as you enter it."
          />
        ) : (
          <div className="px-6 py-12 text-center text-base text-zinc-700 font-semibold">
            All transfers entered. Nice work.
          </div>
        )
      ) : (
        <ul className="divide-y divide-zinc-200">
          {visibleRows.map((r) => {
            const isLogged = entered.has(r.lineId);
            return (
              <li key={r.lineId}>
                <button
                  type="button"
                  onClick={() => toggleLogged(r.lineId)}
                  className={`w-full px-4 py-3 flex gap-3 items-start text-left active:bg-zinc-100 ${
                    isLogged ? "bg-zinc-50" : "bg-white"
                  }`}
                >
                  <Checkbox checked={isLogged} />
                  <div className={`flex-1 min-w-0 ${isLogged ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`text-base font-mono font-semibold text-zinc-900 ${
                          isLogged ? "line-through" : ""
                        }`}
                      >
                        {r.sku}
                        {(r.color || r.size) && (
                          <span className="text-zinc-500 font-normal">
                            {" "}
                            ({[r.color, r.size].filter(Boolean).join("/")})
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-lg font-bold text-zinc-900 ${
                          isLogged ? "line-through" : ""
                        }`}
                      >
                        ×{r.qty}
                      </div>
                    </div>
                    <div className="text-sm text-zinc-700 mt-1 flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        Store {r.fromCode} → {r.toLabel}
                      </span>
                      <span className="text-zinc-500">
                        {r.sentAt
                          ? new Date(r.sentAt).toLocaleString([], {
                              month: "numeric",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-500 mt-1 truncate">
                      {r.style}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center mt-0.5 ${
        checked
          ? "bg-emerald-500 border-emerald-500"
          : "bg-white border-zinc-400"
      }`}
      aria-hidden
    >
      {checked && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </div>
  );
}
