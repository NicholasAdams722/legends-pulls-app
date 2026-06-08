"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

type TabDef = {
  href: string;
  label: string;
  icon: () => React.ReactNode;
};

const FEED: TabDef = {
  href: "/feed",
  label: "Feed",
  icon: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};
const PULLS: TabDef = {
  href: "/pulls",
  label: "Pulls",
  icon: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  ),
};
const CLAIMS: TabDef = {
  href: "/claims",
  label: "Claims",
  icon: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l4-4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M8 11l3 3 5-5" />
    </svg>
  ),
};
const HISTORY: TabDef = {
  href: "/history",
  label: "History",
  icon: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};

export function TabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const postActive = pathname === "/post" || pathname.startsWith("/post/");

  // Manager layout: Feed | Pulls | [POST FAB] | Claims | History
  // Warehouse layout: Feed | Claims | History (no post FAB, no pulls)
  const isWarehouse = role === "warehouse";
  const leftTabs = isWarehouse ? [FEED] : [FEED, PULLS];
  const rightTabs = isWarehouse ? [CLAIMS, HISTORY] : [CLAIMS, HISTORY];

  return (
    <nav className="pb-safe sticky bottom-0 z-10 bg-zinc-950/95 backdrop-blur border-t border-zinc-900">
      <ul className="flex relative items-stretch">
        {leftTabs.map((tab) => (
          <TabItem key={tab.href} tab={tab} pathname={pathname} />
        ))}

        {!isWarehouse && (
          <li className="flex-1 relative flex justify-center">
            <Link
              href="/post"
              aria-label="Post a pull"
              className={`absolute -top-5 w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95 ring-4 ring-zinc-950 ${
                postActive
                  ? "bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/40"
                  : "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30"
              }`}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Link>
            {/* Keep slot height in sync with siblings */}
            <span className="h-14" />
          </li>
        )}

        {rightTabs.map((tab) => (
          <TabItem key={tab.href} tab={tab} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function TabItem({ tab, pathname }: { tab: TabDef; pathname: string }) {
  const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        className={`flex flex-col items-center justify-center h-14 gap-0.5 ${
          active ? "text-zinc-50" : "text-zinc-500"
        }`}
      >
        <tab.icon />
        <span className="text-[10px] font-medium leading-none">
          {tab.label}
        </span>
      </Link>
    </li>
  );
}
