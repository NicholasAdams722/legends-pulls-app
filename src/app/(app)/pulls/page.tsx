import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MyPullsTabs, type MyPull } from "./_components/my-pulls-tabs";

export const dynamic = "force-dynamic";

export default async function MyPullsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();
  const { view } = await searchParams;

  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, status, claimed_at, packed_at, sent_at, received_at, created_at,
       claimed_by_store:stores!pulls_claimed_by_store_id_fkey(*),
       from_store:stores!pulls_from_store_id_fkey(*),
       pull_lines(*)`,
    )
    .eq("from_store_id", store.id)
    .order("created_at", { ascending: false });

  const pulls = (data ?? []) as unknown as MyPull[];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">My pulls</h1>
      </div>
      <MyPullsTabs initial={pulls} initialView={view} storeId={store.id} />
    </div>
  );
}
