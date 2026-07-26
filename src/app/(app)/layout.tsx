import Link from "next/link";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TabBar } from "./_components/tab-bar";
import { SidebarNav } from "./_components/sidebar-nav";
import { SignOutButton } from "./_components/sign-out-button";
import { ToastProvider } from "./_components/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store } = await requireAppUser();

  // In-flight count drives the badge on the Pulls tab (managers/admins).
  // Routed count drives the badge on the Routed tab (warehouse).
  const supabase = await createSupabaseServerClient();
  const isWarehouse = user.role === "warehouse";
  // Seed the live nav badges with the actual pull ids (not just a count) so the
  // client can reconcile realtime membership per id. See useNavBadges().
  const [pullsBadgeRes, routedBadgeRes, claimsBadgeRes] = await Promise.all([
    isWarehouse
      ? Promise.resolve({ data: [] as { id: string }[] })
      : supabase
          .from("pulls")
          .select("id")
          .eq("from_store_id", store.id)
          .in("status", ["claimed", "packed", "to_warehouse"]),
    isWarehouse
      ? supabase
          .from("pulls")
          .select("id")
          .in("status", ["to_warehouse", "packed", "sent"])
          .eq("claimed_by_store_id", store.id)
      : Promise.resolve({ data: [] as { id: string }[] }),
    // My Claims: pulls this store has claimed that are still in progress
    // (claimed/packed/sent). Warehouse uses the Routed badge instead.
    isWarehouse
      ? Promise.resolve({ data: [] as { id: string }[] })
      : supabase
          .from("pulls")
          .select("id")
          .eq("claimed_by_store_id", store.id)
          .in("status", ["claimed", "packed", "sent"]),
  ]);
  const initialPullsIds = (pullsBadgeRes.data ?? []).map((r) => r.id);
  const initialRoutedIds = (routedBadgeRes.data ?? []).map((r) => r.id);
  const initialClaimsIds = (claimsBadgeRes.data ?? []).map((r) => r.id);

  return (
    <ToastProvider>
      <SidebarNav
        role={user.role}
        storeId={store.id}
        storeCode={store.code}
        storeName={store.name}
        userName={user.name}
        initialPullsIds={initialPullsIds}
        initialRoutedIds={initialRoutedIds}
        initialClaimsIds={initialClaimsIds}
      />
      <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
        <header className="lg:hidden pt-safe sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-zinc-200">
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900 truncate">
              Store {store.code}
              <span className="text-zinc-500 font-normal"> · {store.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="text-xs text-zinc-500 truncate max-w-[6rem]">
                {user.name}
              </div>
              <Link
                href="/help"
                aria-label="How to use this app"
                className="w-10 h-10 flex items-center justify-center text-zinc-600 active:text-zinc-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
                  <path d="M12 17h.01" />
                </svg>
              </Link>
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
        <main className="flex-1 overflow-y-auto pb-tab lg:pb-0">
          <div className="lg:max-w-6xl lg:mx-auto">{children}</div>
        </main>
        <TabBar
          role={user.role}
          storeId={store.id}
          initialPullsIds={initialPullsIds}
          initialRoutedIds={initialRoutedIds}
          initialClaimsIds={initialClaimsIds}
        />
      </div>
    </ToastProvider>
  );
}
