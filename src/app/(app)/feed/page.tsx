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
        `id, photo_urls, style_name, good_type, description,
         from_store:stores!pulls_from_store_id_fkey(*),
         pull_lines(*)`,
      )
      .eq("status", "available")
      .order("created_at", { ascending: false }),
    supabase.from("pull_passes").select("pull_id").eq("store_id", store.id),
    supabase.from("stores").select("*").order("code"),
  ]);

  // Hide pulls this store has passed on, but keep the user's own store's
  // pulls visible (they just can't act on them).
  const passedIds = new Set((passesRes.data ?? []).map((p) => p.pull_id));
  const pulls = ((pullsRes.data ?? []) as unknown as FeedPull[]).filter(
    (p) => !passedIds.has(p.id),
  );
  const stores = (storesRes.data ?? []) as Store[];

  return (
    <div>
      <FeedList
        initialPulls={pulls}
        stores={stores}
        ownStoreId={store.id}
      />
    </div>
  );
}
