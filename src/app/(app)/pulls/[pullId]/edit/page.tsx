import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PullForm, type EditablePull } from "../../../_components/pull-form";

export const dynamic = "force-dynamic";

export default async function EditPullPage({
  params,
}: {
  params: Promise<{ pullId: string }>;
}) {
  const { pullId } = await params;
  const { user, store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, good_type, description, status, from_store_id,
       pull_lines(*)`,
    )
    .eq("id", pullId)
    .maybeSingle();

  if (!data) notFound();
  if (data.from_store_id !== store.id) redirect("/pulls");
  if (data.status !== "available") redirect("/pulls");

  const pull: EditablePull = {
    id: data.id,
    photo_urls: data.photo_urls,
    style_name: data.style_name,
    good_type: data.good_type,
    description: data.description,
    pull_lines: data.pull_lines,
  };

  return (
    <div>
      <div className="px-2 pt-2 pb-1">
        <Link
          href="/pulls"
          className="inline-flex items-center gap-1 h-12 px-3 text-base font-semibold text-zinc-800 -ml-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to pulls
        </Link>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-xl font-bold text-zinc-900">Edit pull</h1>
      </div>
      <PullForm mode="edit" userId={user.id} pull={pull} />
    </div>
  );
}
