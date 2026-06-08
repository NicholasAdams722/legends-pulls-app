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
  const { user } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("pulls")
    .select(
      `id, photo_urls, style_name, good_type, description, status, posted_by,
       pull_lines(*)`,
    )
    .eq("id", pullId)
    .maybeSingle();

  if (!data) notFound();
  if (data.posted_by !== user.id) redirect("/pulls");
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
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <Link href="/pulls" className="text-sm text-zinc-400">
          ← My pulls
        </Link>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-xl font-semibold">Edit pull</h1>
      </div>
      <PullForm mode="edit" userId={user.id} pull={pull} />
    </div>
  );
}
