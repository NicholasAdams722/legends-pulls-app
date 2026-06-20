"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { PullLine, PullStatus, Store } from "@/lib/types";

export type ClaimedPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  status: PullStatus;
  claimed_at: string | null;
  packed_at: string | null;
  sent_at: string | null;
  from_store: Store;
  pull_lines: PullLine[];
};

export function MyClaimsList({ initial }: { initial: ClaimedPull[] }) {
  const router = useRouter();
  const [receiving, setReceiving] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("my-claims")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pulls" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function markReceived(id: string) {
    setReceiving(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("receive_pull", { p_pull_id: id });
      if (error) alert(error.message);
      else router.refresh();
    } finally {
      setReceiving(null);
    }
  }

  if (initial.length === 0) {
    return (
      <div className="p-10 text-center text-base text-zinc-500">
        No active claims awaiting handoff.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200">
      {initial.map((p) => {
        const total = totalQuantity(p.pull_lines);
        const breakdown = variantBreakdown(p.pull_lines);
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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold truncate text-zinc-900">
                    {p.style_name}
                  </div>
                  <ClaimStatusBadge status={p.status} />
                </div>
                <div className="text-sm text-zinc-700 mt-1">
                  From Store {p.from_store.code} · {p.from_store.name}
                </div>
                <div className="text-sm text-zinc-500 mt-1">
                  {total} {total === 1 ? "pc" : "pcs"}
                  {breakdown && ` · ${breakdown}`}
                </div>
              </div>
            </div>
            <button
              onClick={() => markReceived(p.id)}
              disabled={receiving === p.id}
              className="mt-3 w-full h-14 rounded-xl bg-emerald-500 text-white text-base font-bold disabled:opacity-50 active:scale-[0.99]"
            >
              {receiving === p.id ? "Receiving…" : "Mark Received"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ClaimStatusBadge({ status }: { status: PullStatus }) {
  const baseCls =
    "shrink-0 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full";
  if (status === "claimed") {
    return (
      <span className={`${baseCls} bg-amber-100 text-amber-900`}>
        Awaiting pack
      </span>
    );
  }
  if (status === "packed") {
    return (
      <span className={`${baseCls} bg-sky-100 text-sky-900`}>Packed</span>
    );
  }
  if (status === "sent") {
    return (
      <span className={`${baseCls} bg-blue-100 text-blue-900`}>Incoming</span>
    );
  }
  if (status === "to_warehouse") {
    return (
      <span className={`${baseCls} bg-indigo-100 text-indigo-900`}>
        Routed
      </span>
    );
  }
  return null;
}
