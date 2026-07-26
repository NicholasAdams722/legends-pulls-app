import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";
import { FeedList, type AvailableSeed } from "./_components/feed-list";
import type { FeedPull } from "./_components/pull-card";

export const dynamic = "force-dynamic";

const FULL_SELECT = `id, photo_urls, style_name, good_type, description, status,
  from_store:stores!pulls_from_store_id_fkey(*),
  pull_lines(*)`;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const { store } = await requireAppUser();
  const { store: storeParam } = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Pills = retail stores in the viewer's own category (demo already hidden).
  // The warehouse doesn't post claimable pulls, so it gets no pill.
  const { data: storesData } = await supabase
    .from("stores")
    .select("*")
    .eq("category", store.category)
    .order("code");
  const stores = ((storesData ?? []) as Store[]).filter(
    (s) => s.type === "retail",
  );
  const pillIds = stores.map((s) => s.id);

  // Selection precedence:
  //  1. ?store=<id> when it's a VALID in-category pill — this preserves the
  //     store the user was browsing when they clicked into a pull, so claim/
  //     pass returns them here. Validating against pillIds keeps demo/other-
  //     category ids from ever being selectable.
  //  2. otherwise the viewer's own store (their inventory up front),
  //  3. otherwise the first pill (e.g. a warehouse user, whose own store
  //     isn't a pill).
  const requestedStoreId =
    storeParam && pillIds.includes(storeParam) ? storeParam : null;
  const selectedStoreId =
    requestedStoreId ??
    (pillIds.includes(store.id) ? store.id : (pillIds[0] ?? ""));

  const [listRes, availRes, passesRes] = await Promise.all([
    // Only the selected store's available pulls are loaded up front (full
    // objects). Other stores load on demand when their pill is tapped.
    selectedStoreId
      ? supabase
          .from("pulls")
          .select(FULL_SELECT)
          .eq("status", "available")
          .eq("from_store_id", selectedStoreId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Lightweight per-store availability seed for the pill counters: just
    // id + from_store_id for every in-category available pull. No photos/lines.
    pillIds.length
      ? supabase
          .from("pulls")
          .select("id, from_store_id")
          .eq("status", "available")
          .in("from_store_id", pillIds)
      : Promise.resolve({ data: [] }),
    supabase.from("pull_passes").select("pull_id").eq("store_id", store.id),
  ]);

  const initialListPulls = (listRes.data ?? []) as unknown as FeedPull[];
  const initialAvailable = (availRes.data ?? []) as AvailableSeed[];
  const initialPassedIds = (passesRes.data ?? []).map((p) => p.pull_id);

  return (
    <div>
      <FeedList
        stores={stores}
        ownStoreId={store.id}
        initialSelectedStoreId={selectedStoreId}
        initialListPulls={initialListPulls}
        initialAvailable={initialAvailable}
        initialPassedIds={initialPassedIds}
      />
    </div>
  );
}
