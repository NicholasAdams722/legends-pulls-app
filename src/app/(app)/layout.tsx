import Link from "next/link";
import { requireAppUser } from "@/lib/auth";
import { TabBar } from "./_components/tab-bar";
import { SignOutButton } from "./_components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store } = await requireAppUser();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="pt-safe sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-900">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-zinc-300 truncate">
            Store {store.code}
            <span className="text-zinc-500"> · {store.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-[11px] text-zinc-500 truncate max-w-[6rem]">
              {user.name}
            </div>
            {user.role === "admin" && (
              <Link
                href="/admin/users"
                aria-label="Admin"
                className="w-10 h-10 flex items-center justify-center text-zinc-400 active:text-zinc-100"
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
      <main className="flex-1 overflow-y-auto">{children}</main>
      <TabBar role={user.role} />
    </div>
  );
}
