import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { PullForm } from "../_components/pull-form";

export default async function PostPage() {
  const { user } = await requireAppUser();
  if (user.role !== "manager") {
    redirect("/feed");
  }
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">Post a pull</h1>
      </div>
      <PullForm mode="create" userId={user.id} />
    </div>
  );
}
