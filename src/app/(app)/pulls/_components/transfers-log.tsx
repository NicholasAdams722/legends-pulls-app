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

function loadLogged(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveLogged(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // quota or privacy mode — fail silently
  }
}

export function TransfersLog({ pulls }: { pulls: MyPull[] }) {
  const [range, setRange] = useState<Range>("all");
  const [logged, setLogged] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [hideLogged, setHideLogged] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogged(loadLogged());
    setHydrated(true);
  }, []);

  // Persist whenever the logged set changes, but only after hydration
  // so we don't overwrite the stored set with an empty one on mount.
  useEffect(() => {
    if (hydrated) saveLogged(logged);
  }, [logged, hydrated]);

  const toggleLogged = useCallback((lineId: string) => {
    setLogged((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
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
    () => (hideLogged ? rows.filter((r) => !logged.has(r.lineId)) : rows),
    [rows, hideLogged, logged],
  );

  const loggedCount = useMemo(
    () => rows.reduce((n, r) => n + (logged.has(r.lineId) ? 1 : 0), 0),
    [rows, logged],
  );

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
    if (loggedCount === 0) return;
    if (
      !confirm(
        `Uncheck all ${loggedCount} entered ${
          loggedCount === 1 ? "item" : "items"
        }?`,
      )
    ) {
      return;
    }
    setLogged((prev) => {
      const next = new Set(prev);
      for (const r of rows) next.delete(r.lineId);
      return next;
    });
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
              This is the most important step. Manually enter every transfer
              below into your POS system, then tap each row to check it off.
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
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50">
          <div className="text-sm font-semibold text-zinc-800">
            {loggedCount} of {rows.length} entered
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHideLogged((v) => !v)}
              className={`h-9 px-3 rounded-full text-xs font-semibold border ${
                hideLogged
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300"
              }`}
            >
              {hideLogged ? "Show all" : "Hide entered"}
            </button>
            <button
              onClick={clearLogged}
              disabled={loggedCount === 0}
              className="h-9 px-3 rounded-full text-xs font-semibold bg-white text-red-600 border border-zinc-300 disabled:opacity-40"
            >
              Clear
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
