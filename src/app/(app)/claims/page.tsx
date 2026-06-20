import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MyClaimsList, type ClaimedPull } from "./_components/my-claims-list";

export const dynamic = "force-dynamic";

export default async function MyClaimsPage() {
  const { user, store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  // Warehouse sees pulls routed to it (status=to_warehouse).
  // Stores see pulls they have claimed (status=claimed).
  const isWarehouse = user.role === "warehouse";
  const query = supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, status, claimed_at, packed_at, sent_at,
       from_store:stores!pulls_from_store_id_fkey(*),
       pull_lines(*)`,
    )
    .order("claimed_at", { ascending: false, nullsFirst: false });

  const { data } = await (isWarehouse
    ? query.eq("status", "to_warehouse")
    : query
        .in("status", ["claimed", "packed", "sent"])
        .eq("claimed_by_store_id", store.id));

  const pulls = (data ?? []) as unknown as ClaimedPull[];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">
          {isWarehouse ? "Routed to warehouse" : "My claims"}
        </h1>
      </div>
      <MyClaimsList initial={pulls} />
    </div>
  );
}
