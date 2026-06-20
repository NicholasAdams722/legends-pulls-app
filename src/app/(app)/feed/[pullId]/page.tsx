import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { totalQuantity } from "@/lib/pull-summary";
import type { PullLine, Store } from "@/lib/types";
import { PullActions } from "./_components/actions";

export const dynamic = "force-dynamic";

type DetailPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  good_type: "soft" | "hard";
  description: string | null;
  status: string;
  from_store_id: string;
  from_store: Store;
  posted_by_user: { name: string } | null;
  pull_lines: PullLine[];
};

export default async function PullDetailPage({
  params,
}: {
  params: Promise<{ pullId: string }>;
}) {
  const { pullId } = await params;
  const { store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, good_type, description, status, from_store_id,
       from_store:stores!pulls_from_store_id_fkey(*),
       posted_by_user:users!pulls_posted_by_fkey(name),
       pull_lines(*)`,
    )
    .eq("id", pullId)
    .maybeSingle();

  if (!data) notFound();
  const pull = data as unknown as DetailPull;
  const isOwn = pull.from_store_id === store.id;
  const total = totalQuantity(pull.pull_lines);

  return (
    <div className="flex flex-col">
      <div className="px-2 pt-2 pb-1">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 h-12 px-3 text-base font-semibold text-zinc-200 -ml-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to feed
        </Link>
      </div>

      {/* Photo carousel (simple horizontal scroll for now) */}
      <div className="flex overflow-x-auto snap-x snap-mandatory">
        {pull.photo_urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={u}
            alt=""
            className="snap-center w-full flex-shrink-0 aspect-square object-cover bg-zinc-900"
          />
        ))}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Store {pull.from_store.code} · {pull.from_store.name}
            {pull.posted_by_user ? ` · ${pull.posted_by_user.name}` : ""}
          </div>
          <h1 className="text-2xl font-bold mt-1">{pull.style_name}</h1>
          <div className="text-base text-zinc-300 mt-1">
            {total} {total === 1 ? "piece" : "pieces"} ·{" "}
            {pull.good_type === "soft" ? "Clothing" : "Items"}
          </div>
          {pull.description && (
            <p className="text-base text-zinc-200 mt-2">{pull.description}</p>
          )}
        </div>

        {/* Line items table */}
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <table className="w-full text-base">
            <thead className="bg-zinc-900 text-zinc-300 text-sm">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">SKU</th>
                <th className="px-3 py-3 text-left font-semibold">Color</th>
                <th className="px-3 py-3 text-left font-semibold">Size</th>
                <th className="px-3 py-3 text-right font-semibold">Qty</th>
              </tr>
            </thead>
            <tbody>
              {pull.pull_lines.map((l) => (
                <tr key={l.id} className="border-t border-zinc-800">
                  <td className="px-3 py-3 font-mono font-semibold">{l.sku}</td>
                  <td className="px-3 py-3">{l.color ?? "—"}</td>
                  <td className="px-3 py-3">{l.size ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {l.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pull.status !== "available" ? (
          <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-4 text-base text-zinc-300">
            This pull is no longer available (status:{" "}
            <span className="text-zinc-100 font-semibold">{pull.status}</span>).
          </div>
        ) : isOwn ? (
          <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-4 text-base text-zinc-300">
            You posted this pull. Manage it from My Pulls.
          </div>
        ) : (
          <PullActions pullId={pull.id} />
        )}
      </div>
    </div>
  );
}
