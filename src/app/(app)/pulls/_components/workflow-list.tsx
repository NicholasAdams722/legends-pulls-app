"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import { storeColor } from "@/lib/store-colors";
import type { MyPull } from "./my-pulls-tabs";
import { useToast } from "../../_components/toast";
import {
  BoxIcon,
  EmptyState,
  TruckIcon,
} from "../../_components/empty-state";
import { PullDetailSheet } from "../../_components/pull-detail-sheet";

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
    emptyBody: string;
    emptyIcon: React.ReactNode;
    actionRpc: "pack_pull" | "send_pull";
    actionLabel: string;
    actionBusy: string;
    actionBtnCls: string;
    /** Verb-first headline for each destination group. */
    groupHeadline: (destLabel: string) => string;
    /** Plain-English instruction shown under each group header. */
    groupInstruction: (destLabel: string) => string;
    /** Toast shown after the RPC succeeds. */
    successToast: string;
  }
> = {
  pack: {
    emptyTitle: "Nothing to pack",
    emptyBody:
      "When another store claims one of your pulls, it'll show up here grouped by destination — ready for you to pack and label for shipping.",
    emptyIcon: <BoxIcon />,
    actionRpc: "pack_pull",
    actionLabel: "Packed for Shipping",
    actionBusy: "Packing…",
    actionBtnCls: "bg-orange-500 text-white",
    groupHeadline: (destLabel) => `Pack for ${destLabel}`,
    groupInstruction: (destLabel) =>
      `Pack these items into totes and label each tote for ${destLabel}.`,
    successToast: "Packed — see it in To ship",
  },
  send: {
    emptyTitle: "Nothing to ship",
    emptyBody:
      "After you mark a tote Packed in the To pack tab, it'll move here — ready to load on the truck.",
    emptyIcon: <TruckIcon />,
    actionRpc: "send_pull",
    actionLabel: "Shipped",
    actionBusy: "Shipping…",
    actionBtnCls: "bg-emerald-500 text-white",
    groupHeadline: (destLabel) => `Ship to ${destLabel}`,
    groupInstruction: (destLabel) =>
      `Load the packed totes onto the truck heading to ${destLabel}. Mark each tote Shipped as it goes on the truck.`,
    successToast: "Shipped — now log this into your POS",
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
  const [detailFor, setDetailFor] = useState<MyPull | null>(null);
  const toast = useToast();
  const copy = COPY[mode];

  const groups = useMemo<Group[]>(() => {
    // "To pack" shows claimed pulls + to_warehouse handoff items.
    // "To ship" shows only packed pulls (warehouse path skips this step).
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
      else toast.show(copy.successToast);
    } finally {
      setBusy(null);
    }
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={copy.emptyIcon}
        title={copy.emptyTitle}
        body={copy.emptyBody}
      />
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
        const destLabel =
          g.code === null
            ? "Warehouse"
            : g.label.replace(/^Store \d+ · /, `Store ${g.code} · `);
        return (
          <section key={g.key} className={`border-l-4 ${color.border}`}>
            <header className="px-4 py-3 bg-white/90 sticky top-0 backdrop-blur border-b border-zinc-200 z-[1]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${color.badge}`}
                    >
                      {g.code === null ? "WH" : `Store ${g.code}`}
                    </span>
                    <span className="text-base font-bold text-zinc-900 truncate">
                      {copy.groupHeadline(destLabel)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 shrink-0 font-medium pt-1">
                  {g.pulls.length} {g.pulls.length === 1 ? "pull" : "pulls"} ·{" "}
                  {totalPieces} pcs
                </div>
              </div>
            </header>
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-sm text-zinc-700 leading-snug">
              {copy.groupInstruction(destLabel)}
            </div>
            <ul className="px-3 py-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:px-4 lg:py-4 xl:grid-cols-3">
              {g.pulls.map((p) => {
                const total = totalQuantity(p.pull_lines);
                const breakdown = variantBreakdown(p.pull_lines);
                return (
                  <li
                    key={p.id}
                    className="flex rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setDetailFor(p)}
                      aria-label={`View details for ${p.style_name}`}
                      className="w-32 sm:w-36 shrink-0 bg-zinc-100 relative self-stretch active:opacity-80"
                    >
                      {p.photo_urls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_urls[0]}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailFor(p)}
                        className="text-left active:opacity-70"
                      >
                        <div className="text-base font-semibold truncate text-zinc-900">
                          {p.style_name}
                        </div>
                        <div className="text-sm text-zinc-700 mt-1">
                          {total} {total === 1 ? "pc" : "pcs"}
                          {breakdown && ` · ${breakdown}`}
                        </div>
                        <div className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                          <span>
                            {p.pull_lines.length}{" "}
                            {p.pull_lines.length === 1 ? "SKU" : "SKUs"} · tap
                            for details
                          </span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      </button>
                      <div className="flex-1 min-h-2" />
                      <button
                        onClick={() => callRpc(p.id)}
                        disabled={busy !== null}
                        className={`w-full h-12 rounded-lg text-base font-bold disabled:opacity-50 active:scale-[0.99] ${copy.actionBtnCls}`}
                      >
                        {busy === p.id ? copy.actionBusy : copy.actionLabel}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {detailFor && (
        <PullDetailSheet
          pull={detailFor}
          onClose={() => setDetailFor(null)}
          action={{
            label: copy.actionLabel,
            busyLabel: copy.actionBusy,
            busy: busy === detailFor.id,
            onClick: () => {
              const id = detailFor.id;
              setDetailFor(null);
              callRpc(id);
            },
            className: copy.actionBtnCls,
          }}
        />
      )}
    </div>
  );
}
