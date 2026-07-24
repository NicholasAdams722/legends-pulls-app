import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";
import { FeedList } from "./_components/feed-list";
import type { FeedPull } from "./_components/pull-card";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const [pullsRes, passesRes, storesRes] = await Promise.all([
    supabase
      .from("pulls")
      .select(
        `id, photo_urls, style_name, good_type, description, status,
         from_store:stores!pulls_from_store_id_fkey(*),
         pull_lines(*)`,
      )
      .in("status", ["available", "to_warehouse"])
      .order("created_at", { ascending: false }),
    supabase.from("pull_passes").select("pull_id").eq("store_id", store.id),
    supabase.from("stores").select("*").order("code"),
  ]);

  // A pull this store has passed on now STAYS in the feed marked "Passed"
  // (still claimable while available). Pulls that peer consensus routed to
  // the warehouse only stay if this store passed on them (shown as "Routed",
  // non-actionable); an unpassed to_warehouse pull is the originating store's
  // own and belongs in My Pulls, so it is filtered out here.
  const passedIds = new Set((passesRes.data ?? []).map((p) => p.pull_id));
  const pulls = ((pullsRes.data ?? []) as unknown as FeedPull[]).filter((p) => {
    if (p.status === "available") return true;
    return p.status === "to_warehouse" && passedIds.has(p.id);
  });
  const stores = (storesRes.data ?? []) as Store[];

  return (
    <div>
      <FeedList
        initialPulls={pulls}
        initialPassedIds={[...passedIds]}
        stores={stores}
        ownStoreId={store.id}
      />
    </div>
  );
}
