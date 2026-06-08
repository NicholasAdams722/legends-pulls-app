import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MyPullsList, type MyPull } from "./_components/my-pulls-list";

export const dynamic = "force-dynamic";

export default async function MyPullsPage() {
  const { user } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, status, claimed_at, received_at, created_at,
       claimed_by_store:stores!pulls_claimed_by_store_id_fkey(*),
       pull_lines(*)`,
    )
    .eq("posted_by", user.id)
    .order("created_at", { ascending: false });

  const pulls = (data ?? []) as unknown as MyPull[];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">My pulls</h1>
      </div>
      <MyPullsList initial={pulls} />
    </div>
  );
}
