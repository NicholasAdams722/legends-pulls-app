"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { storeColor } from "@/lib/store-colors";
import type { Store } from "@/lib/types";
import { PullCard, type FeedPull } from "./pull-card";

export function FeedList({
  initialPulls,
  stores,
  ownStoreId,
}: {
  initialPulls: FeedPull[];
  stores: Store[];
  ownStoreId: string;
}) {
  const router = useRouter();
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "soft" | "hard">("all");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("feed-pulls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pulls" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pull_passes" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filtered = useMemo(() => {
    return initialPulls.filter((p) => {
      if (storeFilter !== "all" && p.from_store.id !== storeFilter) return false;
      if (typeFilter !== "all" && p.good_type !== typeFilter) return false;
      return true;
    });
  }, [initialPulls, storeFilter, typeFilter]);

  const peerStores = stores.filter(
    (s) => s.type === "retail" && s.id !== ownStoreId,
  );

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-900">
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto">
          <FilterChip
            active={storeFilter === "all"}
            onClick={() => setStoreFilter("all")}
          >
            All stores
          </FilterChip>
          {peerStores.map((s) => {
            const c = storeColor(s.code);
            return (
              <FilterChip
                key={s.id}
                active={storeFilter === s.id}
                activeClass={c.filterActive}
                onClick={() => setStoreFilter(s.id)}
              >
                Store {s.code}
              </FilterChip>
            );
          })}
          <div className="w-px bg-zinc-800 mx-1" />
          {(["all", "soft", "hard"] as const).map((t) => (
            <FilterChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "All types" : t === "soft" ? "Clothing" : "Items"}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          Nothing available right now.
        </div>
      ) : (
        <div className="p-3 grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PullCard key={p.id} pull={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClass?: string;
  children: React.ReactNode;
}) {
  const inactive = "bg-zinc-900 text-zinc-300 border-zinc-800";
  const defaultActive = "bg-zinc-50 text-zinc-950 border-zinc-50";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border ${
        active ? (activeClass ?? defaultActive) : inactive
      }`}
    >
      {children}
    </button>
  );
}
