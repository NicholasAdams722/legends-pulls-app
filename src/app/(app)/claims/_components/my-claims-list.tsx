"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { PullLine, PullStatus, Store } from "@/lib/types";
import { useToast } from "../../_components/toast";
import { EmptyState, InboxIcon } from "../../_components/empty-state";
import { JourneyStrip } from "../../_components/journey-strip";

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
  const toast = useToast();
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
      if (error) {
        alert(error.message);
      } else {
        toast.show("Received — don't forget to log it in your POS");
        router.refresh();
      }
    } finally {
      setReceiving(null);
    }
  }

  if (initial.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon />}
        title="No active claims"
        body="When you claim a pull from the Feed, it'll show up here. The badge will update as the other store packs and ships it — tap Mark Received when the tote arrives."
      />
    );
  }

  return (
    <ul className="px-3 py-3 space-y-3">
      {initial.map((p) => {
        const total = totalQuantity(p.pull_lines);
        const breakdown = variantBreakdown(p.pull_lines);
        return (
          <li
            key={p.id}
            className="flex rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="w-32 sm:w-36 shrink-0 bg-zinc-100 relative self-stretch">
              {p.photo_urls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_urls[0]}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
              <JourneyStrip status={p.status} />
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="text-base font-semibold truncate text-zinc-900">
                  {p.style_name}
                </div>
                <ClaimStatusBadge status={p.status} />
              </div>
              <div className="text-sm text-zinc-700">
                From Store {p.from_store.code} · {p.from_store.name}
              </div>
              <div className="text-sm text-zinc-500">
                {total} {total === 1 ? "pc" : "pcs"}
                {breakdown && ` · ${breakdown}`}
              </div>
              <div className="flex-1 min-h-2" />
              <button
                onClick={() => markReceived(p.id)}
                disabled={receiving === p.id}
                className="w-full h-12 rounded-lg bg-emerald-500 text-white text-base font-bold disabled:opacity-50 active:scale-[0.99]"
              >
                {receiving === p.id ? "Receiving…" : "Mark Received"}
              </button>
            </div>
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
