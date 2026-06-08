import { requireAppUser } from "@/lib/auth";
import { TabBar } from "./_components/tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, store } = await requireAppUser();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="pt-safe sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-900">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Store {store.code} · {store.name}
          </div>
          <div className="text-xs text-zinc-500 truncate max-w-[10rem]">
            {user.name}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <TabBar role={user.role} />
    </div>
  );
}
