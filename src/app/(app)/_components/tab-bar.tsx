"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { useNavBadges } from "./use-nav-badges";

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
const POS_LOG: TabDef = {
  href: "/pos-log",
  label: "POS Log",
  icon: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" fill="currentColor" stroke="none" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  ),
};

export function TabBar({
  role,
  storeId,
  initialPullsIds,
  initialRoutedIds,
}: {
  role: UserRole;
  storeId: string;
  initialPullsIds: string[];
  initialRoutedIds: string[];
}) {
  const pathname = usePathname();
  const postActive = pathname === "/post" || pathname.startsWith("/post/");
  const { pullsBadge, routedBadge } = useNavBadges({
    role,
    storeId,
    initialPullsIds,
    initialRoutedIds,
  });

  // Manager layout: Feed | Pulls | [POST FAB] | Claims | History
  // Warehouse layout: Feed | Routed | History (no post FAB, no pulls)
  const isWarehouse = role === "warehouse";
  const claimsTab: TabDef = isWarehouse
    ? { ...CLAIMS, label: "Routed" }
    : CLAIMS;
  const leftTabs = isWarehouse ? [FEED] : [FEED, PULLS];
  const rightTabs = [claimsTab, POS_LOG];

  return (
    <nav className="lg:hidden pb-safe fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur border-t border-zinc-200">
      <ul className="flex relative items-stretch">
        {leftTabs.map((tab) => (
          <TabItem
            key={tab.href}
            tab={tab}
            pathname={pathname}
            badge={tab === PULLS ? pullsBadge : 0}
          />
        ))}

        {!isWarehouse && (
          <li className="flex-1 relative flex justify-center">
            <Link
              href="/post"
              aria-label="Post a pull"
              className={`absolute -top-5 w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95 ring-4 ring-white ${
                postActive
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40"
                  : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
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
          <TabItem
            key={tab.href}
            tab={tab}
            pathname={pathname}
            badge={
              isWarehouse && tab.href === "/claims" ? routedBadge : 0
            }
          />
        ))}
      </ul>
    </nav>
  );
}

function TabItem({
  tab,
  pathname,
  badge,
}: {
  tab: TabDef;
  pathname: string;
  badge: number;
}) {
  const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        className={`relative flex flex-col items-center justify-center h-14 gap-0.5 ${
          active ? "text-zinc-900" : "text-zinc-500"
        }`}
      >
        <div className="relative">
          <tab.icon />
          {badge > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[16px] text-center">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold leading-none">
          {tab.label}
        </span>
      </Link>
    </li>
  );
}
