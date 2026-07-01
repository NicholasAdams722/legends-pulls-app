import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TransfersLog } from "../pulls/_components/transfers-log";
import type { MyPull } from "../pulls/_components/my-pulls-tabs";

export const dynamic = "force-dynamic";

export default async function PosLogPage() {
  const { store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  // Pulls this store originated that have been shipped or received.
  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, status, claimed_at, packed_at, sent_at, received_at, created_at,
       claimed_by_store:stores!pulls_claimed_by_store_id_fkey(*),
       from_store:stores!pulls_from_store_id_fkey(*),
       pull_lines(*)`,
    )
    .eq("from_store_id", store.id)
    .in("status", ["sent", "received"])
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(500);

  const pulls = (data ?? []) as unknown as MyPull[];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-zinc-900">POS Log</h1>
      </div>
      <TransfersLog pulls={pulls} />
    </div>
  );
}
