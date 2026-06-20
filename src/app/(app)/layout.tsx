import Link from "next/link";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TabBar } from "./_components/tab-bar";
import { SignOutButton } from "./_components/sign-out-button";
import { ToastProvider } from "./_components/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store } = await requireAppUser();

  // In-flight count drives the badge on the Pulls tab.
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("pulls")
    .select("id", { count: "exact", head: true })
    .eq("posted_by", user.id)
    .in("status", ["claimed", "packed", "to_warehouse"]);
  const initialPullsBadge = count ?? 0;

  return (
    <ToastProvider>
    <div className="flex-1 flex flex-col min-h-0">
      <header className="pt-safe sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900 truncate">
            Store {store.code}
            <span className="text-zinc-500 font-normal"> · {store.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-xs text-zinc-500 truncate max-w-[6rem]">
              {user.name}
            </div>
            {user.role === "admin" && (
              <Link
                href="/admin/users"
                aria-label="Admin"
                className="w-10 h-10 flex items-center justify-center text-zinc-600 active:text-zinc-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                </svg>
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-tab">{children}</main>
      <TabBar
        role={user.role}
        userId={user.id}
        initialPullsBadge={initialPullsBadge}
      />
    </div>
    </ToastProvider>
  );
}
