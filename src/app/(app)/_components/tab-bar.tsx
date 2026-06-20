"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PullStatus, UserRole } from "@/lib/types";

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

const INFLIGHT: ReadonlySet<PullStatus> = new Set<PullStatus>([
  "claimed",
  "packed",
  "to_warehouse",
]);

export function TabBar({
  role,
  userId,
  initialPullsBadge,
}: {
  role: UserRole;
  userId: string;
  initialPullsBadge: number;
}) {
  const pathname = usePathname();
  const postActive = pathname === "/post" || pathname.startsWith("/post/");
  const [pullsBadge, setPullsBadge] = useState(initialPullsBadge);

  // Re-seed when server gives us a fresh count (e.g., on hard nav).
  const seededRef = useRef(initialPullsBadge);
  useEffect(() => {
    if (initialPullsBadge !== seededRef.current) {
      seededRef.current = initialPullsBadge;
      setPullsBadge(initialPullsBadge);
    }
  }, [initialPullsBadge]);

  // Realtime: adjust badge by delta on UPDATE/DELETE of this user's pulls.
  // INSERT can't change in-flight count (new pulls are always 'available').
  useEffect(() => {
    if (role === "warehouse") return; // no Pulls tab for warehouse
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("tabbar-pulls")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pulls",
          filter: `posted_by=eq.${userId}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { status?: PullStatus }).status;
          const newStatus = (payload.new as { status?: PullStatus }).status;
          const wasIn = oldStatus ? INFLIGHT.has(oldStatus) : false;
          const isIn = newStatus ? INFLIGHT.has(newStatus) : false;
          const delta = (isIn ? 1 : 0) - (wasIn ? 1 : 0);
          if (delta !== 0) {
            setPullsBadge((n) => Math.max(0, n + delta));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pulls",
          filter: `posted_by=eq.${userId}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { status?: PullStatus }).status;
          if (oldStatus && INFLIGHT.has(oldStatus)) {
            setPullsBadge((n) => Math.max(0, n - 1));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, userId]);

  // Manager layout: Feed | Pulls | [POST FAB] | Claims | History
  // Warehouse layout: Feed | Claims | History (no post FAB, no pulls)
  const isWarehouse = role === "warehouse";
  const leftTabs = isWarehouse ? [FEED] : [FEED, PULLS];
  const rightTabs = isWarehouse ? [CLAIMS, HISTORY] : [CLAIMS, HISTORY];

  return (
    <nav className="pb-safe sticky bottom-0 z-10 bg-zinc-950/95 backdrop-blur border-t border-zinc-900">
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
          <TabItem
            key={tab.href}
            tab={tab}
            pathname={pathname}
            badge={0}
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
          active ? "text-zinc-50" : "text-zinc-500"
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
