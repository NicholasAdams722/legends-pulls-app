"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { storeColor } from "@/lib/store-colors";
import type { PullStatus, Store } from "@/lib/types";
import { PullCard, type FeedPull } from "./pull-card";
import { EmptyState, InboxIcon } from "../../_components/empty-state";

// One place for the embed shape so the server page, the initial list, and the
// single-row realtime refetches all agree.
const FULL_SELECT = `id, photo_urls, style_name, good_type, description, status,
  from_store:stores!pulls_from_store_id_fkey(*),
  pull_lines(*)`;

export type AvailableSeed = { id: string; from_store_id: string };

type TypeFilter = "all" | "soft" | "hard";

export function FeedList({
  stores,
  ownStoreId,
  initialSelectedStoreId,
  initialListPulls,
  initialAvailable,
  initialPassedIds,
}: {
  /** Pills: retail stores in the viewer's own category, ordered by code. */
  stores: Store[];
  ownStoreId: string;
  initialSelectedStoreId: string;
  initialListPulls: FeedPull[];
  /** Lightweight {id, from_store_id} for every available pull in-category. */
  initialAvailable: AvailableSeed[];
  initialPassedIds: string[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Set of store ids that own a pill — the category gate for counts. A pull
  // whose store isn't here (e.g. the warehouse) never affects a pill.
  const pillIds = useMemo(() => new Set(stores.map((s) => s.id)), [stores]);

  const [selectedStoreId, setSelectedStoreId] = useState(initialSelectedStoreId);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // The visible list = the selected store's available pulls (loaded on demand).
  const [listPulls, setListPulls] = useState<FeedPull[]>(initialListPulls);
  const [loadingList, setLoadingList] = useState(false);

  // Counts source of truth: pull_id -> from_store_id for every in-category
  // available pull. Counts per store are derived from this and kept live.
  const [availableIds, setAvailableIds] = useState<Map<string, string>>(
    () => new Map(initialAvailable.map((a) => [a.id, a.from_store_id])),
  );

  const [passedIds, setPassedIds] = useState<Set<string>>(
    () => new Set(initialPassedIds),
  );

  // Refs so the realtime handlers (subscribed once) read current values without
  // re-subscribing on every state change.
  const selectedRef = useRef(selectedStoreId);
  useEffect(() => {
    selectedRef.current = selectedStoreId;
  }, [selectedStoreId]);
  const listIdsRef = useRef<Set<string>>(new Set(initialListPulls.map((p) => p.id)));
  useEffect(() => {
    listIdsRef.current = new Set(listPulls.map((p) => p.id));
  }, [listPulls]);
  const passedIdsRef = useRef(passedIds);
  useEffect(() => {
    passedIdsRef.current = passedIds;
  }, [passedIds]);
  // Monotonic token so an out-of-order list fetch can't overwrite a newer one.
  const reqRef = useRef(0);

  // Re-seed everything when the server hands us new initial data (hard nav).
  const initialRef = useRef(initialListPulls);
  useEffect(() => {
    if (initialListPulls === initialRef.current) return;
    initialRef.current = initialListPulls;
    setSelectedStoreId(initialSelectedStoreId);
    setListPulls(initialListPulls);
    setAvailableIds(new Map(initialAvailable.map((a) => [a.id, a.from_store_id])));
    setPassedIds(new Set(initialPassedIds));
  }, [initialListPulls, initialSelectedStoreId, initialAvailable, initialPassedIds]);

  const fetchPull = useCallback(
    async (id: string): Promise<FeedPull | null> => {
      const { data } = await supabase
        .from("pulls")
        .select(FULL_SELECT)
        .eq("id", id)
        .maybeSingle();
      return (data as unknown as FeedPull) ?? null;
    },
    [supabase],
  );

  // Load a store's available pulls when its pill is tapped.
  const selectStore = useCallback(
    async (storeId: string) => {
      setSelectedStoreId(storeId);
      selectedRef.current = storeId;
      const my = ++reqRef.current;
      setLoadingList(true);
      const { data } = await supabase
        .from("pulls")
        .select(FULL_SELECT)
        .eq("status", "available")
        .eq("from_store_id", storeId)
        .order("created_at", { ascending: false });
      if (my !== reqRef.current) return; // a newer selection won
      setListPulls((data ?? []) as unknown as FeedPull[]);
      setLoadingList(false);
    },
    [supabase],
  );

  // Realtime: one subscription maintains BOTH the per-store counts (always) and
  // the visible list (only for the selected store).
  useEffect(() => {
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
          if (!pillIds.has(row.from_store_id)) return;
          setAvailableIds((prev) =>
            prev.has(row.id) ? prev : new Map(prev).set(row.id, row.from_store_id),
          );
          if (
            row.from_store_id === selectedRef.current &&
            !listIdsRef.current.has(row.id)
          ) {
            const full = await fetchPull(row.id);
            if (full && full.status === "available") {
              setListPulls((prev) =>
                prev.some((p) => p.id === full.id) ? prev : [full, ...prev],
              );
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pulls" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            from_store_id: string;
            status: PullStatus;
          };
          if (!row.status) return;
          const nowAvailable =
            row.status === "available" && pillIds.has(row.from_store_id);

          setAvailableIds((prev) => {
            if (nowAvailable) {
              return prev.has(row.id)
                ? prev
                : new Map(prev).set(row.id, row.from_store_id);
            }
            if (!prev.has(row.id)) return prev;
            const next = new Map(prev);
            next.delete(row.id);
            return next;
          });

          if (nowAvailable && row.from_store_id === selectedRef.current) {
            if (listIdsRef.current.has(row.id)) {
              setListPulls((prev) =>
                prev.map((p) =>
                  p.id === row.id ? { ...p, status: "available" } : p,
                ),
              );
            } else {
              // Came back on the market (e.g. a peer undid a claim).
              const full = await fetchPull(row.id);
              if (full && full.status === "available") {
                setListPulls((prev) =>
                  prev.some((p) => p.id === full.id) ? prev : [full, ...prev],
                );
              }
            }
          } else {
            // Claimed / packed / shipped / routed → leaves the available list.
            setListPulls((prev) => prev.filter((p) => p.id !== row.id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pulls" },
        (payload) => {
          const row = payload.old as { id: string };
          setAvailableIds((prev) => {
            if (!prev.has(row.id)) return prev;
            const next = new Map(prev);
            next.delete(row.id);
            return next;
          });
          setListPulls((prev) => prev.filter((p) => p.id !== row.id));
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
          setPassedIds((prev) => {
            if (prev.has(row.pull_id)) return prev;
            const next = new Set(prev);
            next.add(row.pull_id);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pull_passes",
          filter: `store_id=eq.${ownStoreId}`,
        },
        (payload) => {
          // Relies on pull_passes REPLICA IDENTITY FULL (migration 0014) so the
          // DELETE payload carries store_id for the filter and pull_id here.
          const row = payload.old as { pull_id: string };
          setPassedIds((prev) => {
            if (!prev.has(row.pull_id)) return prev;
            const next = new Set(prev);
            next.delete(row.pull_id);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, pillIds, ownStoreId, fetchPull]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const storeId of availableIds.values()) {
      m.set(storeId, (m.get(storeId) ?? 0) + 1);
    }
    return m;
  }, [availableIds]);

  // Own store first, then by code. Stable, and puts "your inventory" up front.
  const orderedStores = useMemo(() => {
    return [...stores].sort((a, b) => {
      if (a.id === ownStoreId) return -1;
      if (b.id === ownStoreId) return 1;
      return a.code - b.code;
    });
  }, [stores, ownStoreId]);

  const visible = useMemo(
    () =>
      typeFilter === "all"
        ? listPulls
        : listPulls.filter((p) => p.good_type === typeFilter),
    [listPulls, typeFilter],
  );

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="px-4 pt-2.5 pb-2 flex gap-2 overflow-x-auto">
          {orderedStores.length === 0 ? (
            <div className="text-sm text-zinc-500 py-2">No stores.</div>
          ) : (
            orderedStores.map((s) => (
              <StorePill
                key={s.id}
                store={s}
                count={counts.get(s.id) ?? 0}
                isOwn={s.id === ownStoreId}
                active={s.id === selectedStoreId}
                onClick={() => {
                  if (s.id !== selectedStoreId) selectStore(s.id);
                }}
              />
            ))
          )}
        </div>
        <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto">
          {(["all", "soft", "hard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-semibold border ${
                typeFilter === t
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300"
              }`}
            >
              {t === "all" ? "All types" : t === "soft" ? "Clothing" : "Items"}
            </button>
          ))}
        </div>
      </div>

      {loadingList ? (
        <div className="p-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 lg:p-4 xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 overflow-hidden"
            >
              <div className="aspect-square bg-zinc-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-5 w-2/3 bg-zinc-100 rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-zinc-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<InboxIcon />}
          title={
            selectedStore
              ? `Nothing available at Store ${selectedStore.code}`
              : "Nothing available right now"
          }
          body={
            selectedStore && selectedStore.id === ownStoreId
              ? "Your store has no unclaimed pulls right now. Tap the green + below to post inventory you need to move."
              : "This store has no unclaimed pulls right now. Check another store's pill above, or back later."
          }
        />
      ) : (
        <div className="p-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 lg:p-4 xl:grid-cols-5">
          {visible.map((p) => (
            <PullCard key={p.id} pull={p} passed={passedIds.has(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StorePill({
  store,
  count,
  isOwn,
  active,
  onClick,
}: {
  store: Store;
  count: number;
  isOwn: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const c = storeColor(store.code);
  const zero = count === 0;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 h-11 pl-4 pr-2.5 rounded-full text-sm font-semibold border inline-flex items-center gap-2 ${
        active
          ? c.filterActive
          : `bg-white text-zinc-700 border-zinc-300 ${zero ? "opacity-60" : ""}`
      }`}
    >
      <span>
        Store {store.code}
        {isOwn && (
          <span className={active ? "opacity-80" : "text-zinc-500"}> · You</span>
        )}
      </span>
      <span
        aria-label={`${count} available`}
        className={`min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold leading-none ${
          active
            ? "bg-white/25 text-current"
            : zero
              ? "bg-zinc-100 text-zinc-400"
              : "bg-zinc-900 text-white"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
