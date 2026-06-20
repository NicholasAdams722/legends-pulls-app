import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TransfersLog } from "../pulls/_components/transfers-log";
import type { MyPull } from "../pulls/_components/my-pulls-tabs";

export const dynamic = "force-dynamic";

export default async function PosLogPage() {
  const { user } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  // Same data shape and filter as the manager's POS Log inside /pulls:
  // pulls this user posted that have been shipped or received.
  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, status, claimed_at, packed_at, sent_at, received_at, created_at,
       claimed_by_store:stores!pulls_claimed_by_store_id_fkey(*),
       from_store:stores!pulls_from_store_id_fkey(*),
       pull_lines(*)`,
    )
    .eq("posted_by", user.id)
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
