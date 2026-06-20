"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import { storeColor } from "@/lib/store-colors";
import type { MyPull } from "./my-pulls-tabs";

type Mode = "pack" | "send";

type Group = {
  key: string;
  label: string;
  code: number | null; // null = warehouse
  pulls: MyPull[];
};

function groupKey(p: MyPull): { key: string; label: string; code: number | null } {
  if (p.status === "to_warehouse" || !p.claimed_by_store) {
    return { key: "warehouse", label: "Warehouse", code: null };
  }
  const s = p.claimed_by_store;
  return { key: s.id, label: `Store ${s.code} · ${s.name}`, code: s.code };
}

const COPY: Record<
  Mode,
  {
    emptyTitle: string;
    actionRpc: "pack_pull" | "send_pull";
    actionLabel: string;
    actionBusy: string;
    actionBtnCls: string;
  }
> = {
  pack: {
    emptyTitle:
      "Nothing to pack. Claimed pulls will appear here grouped by destination.",
    actionRpc: "pack_pull",
    actionLabel: "Packed",
    actionBusy: "Packing…",
    actionBtnCls: "bg-orange-500 text-white",
  },
  send: {
    emptyTitle:
      "Nothing to send. Packed pulls will appear here grouped by destination.",
    actionRpc: "send_pull",
    actionLabel: "Sent",
    actionBusy: "Sending…",
    actionBtnCls: "bg-emerald-500 text-white",
  },
};

export function WorkflowList({
  mode,
  pulls,
  onPatch,
}: {
  mode: Mode;
  pulls: MyPull[];
  onPatch: (id: string, patch: Partial<MyPull>) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const copy = COPY[mode];

  const groups = useMemo<Group[]>(() => {
    // "To pack" shows claimed pulls + to_warehouse handoff items.
    // "To send" shows only packed pulls (warehouse path skips this step).
    const filtered = pulls.filter((p) =>
      mode === "pack"
        ? p.status === "claimed" || p.status === "to_warehouse"
        : p.status === "packed",
    );
    const map = new Map<string, Group>();
    for (const p of filtered) {
      const g = groupKey(p);
      if (!map.has(g.key)) {
        map.set(g.key, { ...g, pulls: [] });
      }
      map.get(g.key)!.pulls.push(p);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.code === null) return 1;
      if (b.code === null) return -1;
      return a.code - b.code;
    });
    return arr;
  }, [pulls, mode]);

  async function callRpc(id: string) {
    setBusy(id);
    const now = new Date().toISOString();
    if (copy.actionRpc === "pack_pull") {
      onPatch(id, { status: "packed", packed_at: now });
    } else {
      onPatch(id, { status: "sent", sent_at: now });
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc(copy.actionRpc, { p_pull_id: id });
      if (error) alert(error.message);
    } finally {
      setBusy(null);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="p-10 text-center text-base text-zinc-500">
        {copy.emptyTitle}
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200">
      {groups.map((g) => {
        const totalPieces = g.pulls.reduce(
          (s, p) => s + totalQuantity(p.pull_lines),
          0,
        );
        const color = storeColor(g.code ?? 0);
        return (
          <section key={g.key} className={`border-l-4 ${color.border}`}>
            <header className="px-4 py-3 bg-white/80 sticky top-0 backdrop-blur border-b border-zinc-200 z-[1]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${color.badge}`}
                  >
                    {g.code === null ? "WH" : `Store ${g.code}`}
                  </span>
                  <span className="text-base font-semibold truncate text-zinc-900">
                    {g.code === null
                      ? "Warehouse"
                      : g.label.replace(/^Store \d+ · /, "")}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 shrink-0 font-medium">
                  {g.pulls.length} {g.pulls.length === 1 ? "tote" : "totes"} ·{" "}
                  {totalPieces} pcs
                </div>
              </div>
            </header>
            <ul className="divide-y divide-zinc-200">
              {g.pulls.map((p) => {
                const total = totalQuantity(p.pull_lines);
                const breakdown = variantBreakdown(p.pull_lines);
                const isWarehouseHandoff =
                  mode === "pack" && p.status === "to_warehouse";
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex gap-3">
                      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                        {p.photo_urls[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo_urls[0]}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold truncate text-zinc-900">
                          {p.style_name}
                        </div>
                        <div className="text-sm text-zinc-700 mt-1">
                          {total} {total === 1 ? "pc" : "pcs"}
                          {breakdown && ` · ${breakdown}`}
                        </div>
                        <div className="text-sm text-zinc-600 mt-1 font-mono truncate">
                          {p.pull_lines
                            .map(
                              (l) =>
                                `${l.sku}${
                                  l.color || l.size
                                    ? ` (${[l.color, l.size]
                                        .filter(Boolean)
                                        .join("/")})`
                                    : ""
                                }×${l.quantity}`,
                            )
                            .join(", ")}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      {isWarehouseHandoff ? (
                        <div className="text-sm text-zinc-700 px-4 py-3 rounded-lg bg-zinc-100 border border-zinc-200">
                          Hand off to warehouse driver
                        </div>
                      ) : (
                        <button
                          onClick={() => callRpc(p.id)}
                          disabled={busy !== null}
                          className={`w-full h-14 rounded-xl text-base font-bold disabled:opacity-50 active:scale-[0.99] ${copy.actionBtnCls}`}
                        >
                          {busy === p.id ? copy.actionBusy : copy.actionLabel}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
