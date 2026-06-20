"use client";

import { useMemo, useState } from "react";
import type { PullLine, PullStatus, Store } from "@/lib/types";

export type HistoryPull = {
  id: string;
  style_name: string;
  status: PullStatus;
  claimed_at: string | null;
  received_at: string | null;
  created_at: string;
  from_store: Store;
  claimed_by_store: Store | null;
  posted_by_user: { name: string } | null;
  claimed_by_user: { name: string } | null;
  pull_lines: PullLine[];
};

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: HistoryPull[]): string {
  const header = [
    "received_at",
    "from_store_code",
    "from_store_name",
    "to_store_code",
    "to_store_name",
    "style_name",
    "sku",
    "color",
    "size",
    "quantity",
    "posted_by",
    "claimed_by",
    "status",
    "pull_id",
  ];
  const lines: string[] = [header.join(",")];
  for (const p of rows) {
    const toCode = p.claimed_by_store?.code ?? 0; // 0 = warehouse
    const toName = p.claimed_by_store?.name ?? "Warehouse";
    for (const l of p.pull_lines) {
      lines.push(
        [
          p.received_at ?? "",
          p.from_store.code,
          p.from_store.name,
          toCode,
          toName,
          p.style_name,
          l.sku,
          l.color ?? "",
          l.size ?? "",
          l.quantity,
          p.posted_by_user?.name ?? "",
          p.claimed_by_user?.name ?? "",
          p.status,
          p.id,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return lines.join("\n");
}

export function HistoryView({
  initial,
  stores,
}: {
  initial: HistoryPull[];
  stores: Store[];
}) {
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial.filter((p) => {
      if (storeFilter !== "all") {
        if (
          p.from_store.id !== storeFilter &&
          p.claimed_by_store?.id !== storeFilter
        ) {
          return false;
        }
      }
      if (!q) return true;
      if (p.style_name.toLowerCase().includes(q)) return true;
      if (p.pull_lines.some((l) => l.sku.includes(q))) return true;
      return false;
    });
  }, [initial, search, storeFilter]);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legends-pulls-history-${
      new Date().toISOString().slice(0, 10)
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="px-4 py-3 space-y-2 border-b border-zinc-200">
        <input
          placeholder="Search style or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
        />
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="h-11 px-3 rounded-full text-sm font-semibold bg-white border border-zinc-300 text-zinc-800"
          >
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                Store {s.code} · {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="shrink-0 h-11 px-4 rounded-full text-sm font-semibold bg-zinc-900 text-white"
          >
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-base text-zinc-500">
          No matching transfers.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {filtered.map((p) => {
            const toLabel = p.claimed_by_store
              ? `Store ${p.claimed_by_store.code}`
              : "Warehouse";
            return (
              <li key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold truncate text-zinc-900">
                    {p.style_name}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-600 shrink-0">
                    Store {p.from_store.code} → {toLabel}
                  </div>
                </div>
                <div className="text-sm text-zinc-700 mt-1">
                  {p.received_at
                    ? `Received ${new Date(p.received_at).toLocaleDateString()}`
                    : "Routed to warehouse"}
                  {p.posted_by_user && ` · posted by ${p.posted_by_user.name}`}
                  {p.claimed_by_user && ` · received by ${p.claimed_by_user.name}`}
                </div>
                <div className="text-sm text-zinc-700 mt-1 font-mono">
                  {p.pull_lines
                    .map(
                      (l) =>
                        `${l.sku}${l.color || l.size ? ` (${[l.color, l.size].filter(Boolean).join("/")})` : ""}×${l.quantity}`,
                    )
                    .join(", ")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
