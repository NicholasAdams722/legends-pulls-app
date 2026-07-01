"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MyPull } from "./my-pulls-tabs";
import { ClipboardIcon, EmptyState } from "../../_components/empty-state";

type Range = "today" | "week" | "all";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];

const STORAGE_KEY = "legends.pos-logged-line-ids";
const DISMISSED_KEY = "legends.pos-dismissed-line-ids";
const HIDE_KEY = "legends.pos-hide-entered";
const DISMISS_AFTER_MS = 24 * 60 * 60 * 1000;

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

// Stored format: { [lineId]: checkedAtMs }. Older array-shaped values from
// prior releases are treated as "checked now" so nothing gets lost.
function loadLogged(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      return new Map(parsed.map((id: string) => [id, now]));
    }
    if (parsed && typeof parsed === "object") {
      return new Map(
        Object.entries(parsed).filter(
          ([, v]) => typeof v === "number",
        ) as [string, number][],
      );
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function saveLogged(map: Map<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(map)),
    );
  } catch {
    // quota or privacy mode — fail silently
  }
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // quota or privacy mode — fail silently
  }
}

export function TransfersLog({ pulls }: { pulls: MyPull[] }) {
  const [range, setRange] = useState<Range>("all");
  // Map of lineId -> checkedAt ms. After DISMISS_AFTER_MS they get moved into
  // the dismissed set and disappear from the list for good.
  const [logged, setLogged] = useState<Map<string, number>>(() => new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  // Default to hiding entered rows so checking = the item leaves the list.
  const [hideLogged, setHideLogged] = useState(true);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogged(loadLogged());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissed());
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(HIDE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== null) setHideLogged(stored === "1");
    }
    setHydrated(true);
  }, []);

  // Persist whenever the logged / dismissed sets change, but only after
  // hydration so we don't overwrite storage with empty defaults on mount.
  useEffect(() => {
    if (hydrated) saveLogged(logged);
  }, [logged, hydrated]);

  useEffect(() => {
    if (hydrated) saveDismissed(dismissed);
  }, [dismissed, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(HIDE_KEY, hideLogged ? "1" : "0");
  }, [hideLogged, hydrated]);

  // Sweep expired logged entries into the dismissed set. Runs on mount and
  // once a minute so a long-lived tab keeps up as time passes.
  useEffect(() => {
    if (!hydrated) return;
    function sweep() {
      const cutoff = Date.now() - DISMISS_AFTER_MS;
      const expired: string[] = [];
      for (const [id, t] of logged) {
        if (t <= cutoff) expired.push(id);
      }
      if (expired.length === 0) return;
      setLogged((prev) => {
        const next = new Map(prev);
        for (const id of expired) next.delete(id);
        return next;
      });
      setDismissed((prev) => {
        const next = new Set(prev);
        for (const id of expired) next.add(id);
        return next;
      });
    }
    sweep();
    const iv = window.setInterval(sweep, 60_000);
    return () => window.clearInterval(iv);
  }, [hydrated, logged]);

  const toggleLogged = useCallback((lineId: string) => {
    setLogged((prev) => {
      const wasChecked = prev.has(lineId);
      if (wasChecked) {
        if (
          !window.confirm(
            "Uncheck this item? Only do this if it was checked by mistake.",
          )
        ) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      }
      const next = new Map(prev);
      next.set(lineId, Date.now());
      return next;
    });
  }, []);

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

    const isDismissed = (lineId: string) => dismissed.has(lineId);

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
        if (isDismissed(l.id)) continue;
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
  }, [pulls, range, dismissed]);

  const visibleRows = useMemo(
    () => (hideLogged ? rows.filter((r) => !logged.has(r.lineId)) : rows),
    [rows, hideLogged, logged],
  );

  const loggedCount = useMemo(
    () => rows.reduce((n, r) => n + (logged.has(r.lineId) ? 1 : 0), 0),
    [rows, logged],
  );

  const uncheckedVisibleCount = useMemo(
    () => visibleRows.reduce((n, r) => n + (logged.has(r.lineId) ? 0 : 1), 0),
    [visibleRows, logged],
  );

  function checkAllVisible() {
    if (uncheckedVisibleCount === 0) return;
    setLogged((prev) => {
      const next = new Map(prev);
      const now = Date.now();
      for (const r of visibleRows) {
        if (!next.has(r.lineId)) next.set(r.lineId, now);
      }
      return next;
    });
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
          logged.has(r.lineId) ? "yes" : "no",
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

  function clearLogged() {
    const dismissedCount = dismissed.size;
    if (loggedCount === 0 && dismissedCount === 0) return;
    if (
      !confirm(
        `Reset entered items? This restores ${loggedCount} checked and ${dismissedCount} auto-cleared item(s) so they appear again.`,
      )
    ) {
      return;
    }
    setLogged(new Map());
    setDismissed(new Set());
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
              then tap the row to check it off — the row disappears from the
              list. Checked items auto-clear after 24 hours. Unchecking
              requires confirmation to prevent double entry.
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
            <button
              onClick={clearLogged}
              disabled={loggedCount === 0}
              className="h-9 px-3 rounded-full text-xs font-semibold bg-white text-red-600 border border-zinc-300 disabled:opacity-40"
            >
              Reset
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
            const isLogged = logged.has(r.lineId);
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
