"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { storeColor } from "@/lib/store-colors";
import type { PullStatus, Store } from "@/lib/types";
import { PullCard, type FeedPull } from "./pull-card";
import { EmptyState, InboxIcon } from "../../_components/empty-state";

export function FeedList({
  initialPulls,
  stores,
  ownStoreId,
}: {
  initialPulls: FeedPull[];
  stores: Store[];
  ownStoreId: string;
}) {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "soft" | "hard">("all");
  const [pulls, setPulls] = useState<FeedPull[]>(initialPulls);

  // Re-seed when server gives us new initial data (e.g., hard nav).
  const initialRef = useRef(initialPulls);
  useEffect(() => {
    if (initialPulls !== initialRef.current) {
      initialRef.current = initialPulls;
      setPulls(initialPulls);
    }
  }, [initialPulls]);

  // Realtime: instead of refetching the whole feed on every change,
  // merge row changes into local state. Much cheaper than router.refresh()
  // and avoids the proxy auth round-trip per event.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("feed-pulls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pulls" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            from_store_id: string;
            status: PullStatus;
          };
          if (row.status !== "available") return;
          // Fetch the full row with embeds; the INSERT payload doesn't
          // include joined data.
          const { data } = await supabase
            .from("pulls")
            .select(
              `id, photo_urls, style_name, good_type, description,
               from_store:stores!pulls_from_store_id_fkey(*),
               pull_lines(*)`,
            )
            .eq("id", row.id)
            .maybeSingle();
          if (!data) return;
          const fresh = data as unknown as FeedPull;
          setPulls((prev) =>
            prev.some((p) => p.id === fresh.id) ? prev : [fresh, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pulls" },
        (payload) => {
          const row = payload.new as { id: string; status?: PullStatus };
          if (row.status && row.status !== "available") {
            setPulls((prev) => prev.filter((p) => p.id !== row.id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pulls" },
        (payload) => {
          const row = payload.old as { id: string };
          setPulls((prev) => prev.filter((p) => p.id !== row.id));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pull_passes",
          filter: `store_id=eq.${ownStoreId}`,
        },
        (payload) => {
          const row = payload.new as { pull_id: string };
          setPulls((prev) => prev.filter((p) => p.id !== row.pull_id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownStoreId]);

  const filtered = useMemo(() => {
    return pulls.filter((p) => {
      if (storeFilter !== "all" && p.from_store.id !== storeFilter) return false;
      if (typeFilter !== "all" && p.good_type !== typeFilter) return false;
      return true;
    });
  }, [pulls, storeFilter, typeFilter]);

  const retailStores = stores.filter((s) => s.type === "retail");

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto">
          <FilterChip
            active={storeFilter === "all"}
            onClick={() => setStoreFilter("all")}
          >
            All stores
          </FilterChip>
          {retailStores.map((s) => {
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
          <div className="w-px bg-zinc-300 mx-1" />
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
        <EmptyState
          icon={<InboxIcon />}
          title="Nothing available right now"
          body="Other stores will post pulls here for you to claim. Tap the green + below to share inventory your store needs to move."
        />
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
  const inactive = "bg-white text-zinc-700 border-zinc-300";
  const defaultActive = "bg-zinc-900 text-white border-zinc-900";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-11 px-4 rounded-full text-sm font-semibold border ${
        active ? (activeClass ?? defaultActive) : inactive
      }`}
    >
      {children}
    </button>
  );
}
