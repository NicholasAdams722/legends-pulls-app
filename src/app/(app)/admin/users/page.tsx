import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, Store } from "@/lib/types";
import { AddUserForm } from "./_components/add-user-form";
import { UserRow } from "./_components/user-row";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user: me } = await requireAppUser();
  if (me.role !== "admin") redirect("/feed");

  const supabase = await createSupabaseServerClient();
  const [usersRes, storesRes] = await Promise.all([
    supabase.from("users").select("*").order("name"),
    supabase.from("stores").select("*").order("code"),
  ]);

  const users = (usersRes.data ?? []) as AppUser[];
  const stores = (storesRes.data ?? []) as Store[];

  return (
    <div>
      <div className="px-2 pt-2 pb-1">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 h-10 px-3 text-sm text-zinc-300 -ml-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-xl font-semibold">Team members</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Add a new manager, edit their store, or send them a sign-in code if
          email is rate-limited.
        </p>
      </div>

      <div className="px-4 py-3">
        <AddUserForm stores={stores} />
      </div>

      <ul className="divide-y divide-zinc-900 border-t border-zinc-900">
        {users.map((u) => (
          <UserRow key={u.id} user={u} stores={stores} isSelf={u.id === me.id} />
        ))}
      </ul>
    </div>
  );
}
