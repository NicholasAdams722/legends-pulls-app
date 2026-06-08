"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { PullLine, Store } from "@/lib/types";

export type ClaimedPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  claimed_at: string | null;
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
      <div className="p-10 text-center text-sm text-zinc-500">
        No active claims awaiting handoff.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-900">
      {initial.map((p) => {
        const total = totalQuantity(p.pull_lines);
        const breakdown = variantBreakdown(p.pull_lines);
        return (
          <li key={p.id} className="p-4 flex gap-3">
            <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-900">
              {p.photo_urls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_urls[0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.style_name}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                From Store {p.from_store.code} · {p.from_store.name}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {total} {total === 1 ? "pc" : "pcs"}
                {breakdown && ` · ${breakdown}`}
              </div>
              <button
                onClick={() => markReceived(p.id)}
                disabled={receiving === p.id}
                className="mt-2 text-xs px-3 h-8 rounded-full bg-emerald-500 text-zinc-950 font-medium disabled:opacity-50"
              >
                {receiving === p.id ? "Receiving…" : "Mark received"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
