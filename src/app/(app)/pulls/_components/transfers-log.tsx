"use client";

import { useMemo, useState } from "react";
import type { MyPull } from "./my-pulls-tabs";

type Range = "today" | "week" | "all";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];

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

export function TransfersLog({ pulls }: { pulls: MyPull[] }) {
  const [range, setRange] = useState<Range>("today");

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
      <div className="px-4 py-3 flex gap-2 border-b border-zinc-900">
        {RANGES.map((r) => {
          const active = r.id === range;
          return (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`h-11 px-4 rounded-full text-sm font-semibold border ${
                active
                  ? "bg-zinc-50 text-zinc-950 border-zinc-50"
                  : "bg-zinc-900 text-zinc-200 border-zinc-700"
              }`}
            >
              {r.label}
            </button>
          );
        })}
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto h-11 px-4 rounded-full text-sm font-semibold bg-zinc-50 text-zinc-950 disabled:opacity-40"
        >
          Export CSV ({rows.length})
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-base text-zinc-400">
          No transfers sent in this range.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {rows.map((r) => (
            <li key={r.lineId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-mono font-semibold text-zinc-100">
                  {r.sku}
                  {(r.color || r.size) && (
                    <span className="text-zinc-400 font-normal">
                      {" "}
                      ({[r.color, r.size].filter(Boolean).join("/")})
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold">×{r.qty}</div>
              </div>
              <div className="text-sm text-zinc-300 mt-1 flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Store {r.fromCode} → {r.toLabel}
                </span>
                <span className="text-zinc-400">
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
              <div className="text-sm text-zinc-400 mt-1 truncate">
                {r.style}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
