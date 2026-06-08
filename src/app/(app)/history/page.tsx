import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";
import { HistoryView, type HistoryPull } from "./_components/history-view";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const [pullsRes, storesRes] = await Promise.all([
    supabase
      .from("pulls")
      .select(
        `id, style_name, status, claimed_at, received_at, created_at,
         from_store:stores!pulls_from_store_id_fkey(*),
         claimed_by_store:stores!pulls_claimed_by_store_id_fkey(*),
         posted_by_user:users!pulls_posted_by_fkey(name),
         claimed_by_user:users!pulls_claimed_by_user_id_fkey(name),
         pull_lines(*)`,
      )
      .in("status", ["received", "to_warehouse"])
      .order("received_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("stores").select("*").order("code"),
  ]);

  const pulls = (pullsRes.data ?? []) as unknown as HistoryPull[];
  const stores = (storesRes.data ?? []) as Store[];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">History</h1>
      </div>
      <HistoryView initial={pulls} stores={stores} />
    </div>
  );
}
