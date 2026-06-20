"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PullStatus, UserRole } from "@/lib/types";
import { useToast } from "./toast";

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

const ROUTED_INFLIGHT: ReadonlySet<PullStatus> = new Set<PullStatus>([
  "to_warehouse",
  "packed",
  "sent",
]);

export function TabBar({
  role,
  userId,
  storeId,
  initialPullsBadge,
  initialRoutedBadge,
}: {
  role: UserRole;
  userId: string;
  storeId: string;
  initialPullsBadge: number;
  initialRoutedBadge: number;
}) {
  const pathname = usePathname();
  const toast = useToast();
  const postActive = pathname === "/post" || pathname.startsWith("/post/");
  const [pullsBadge, setPullsBadge] = useState(initialPullsBadge);
  const [routedBadge, setRoutedBadge] = useState(initialRoutedBadge);

  // Re-seed when server gives us a fresh count (e.g., on hard nav).
  const seededPullsRef = useRef(initialPullsBadge);
  useEffect(() => {
    if (initialPullsBadge !== seededPullsRef.current) {
      seededPullsRef.current = initialPullsBadge;
      setPullsBadge(initialPullsBadge);
    }
  }, [initialPullsBadge]);
  const seededRoutedRef = useRef(initialRoutedBadge);
  useEffect(() => {
    if (initialRoutedBadge !== seededRoutedRef.current) {
      seededRoutedRef.current = initialRoutedBadge;
      setRoutedBadge(initialRoutedBadge);
    }
  }, [initialRoutedBadge]);

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

  // Realtime: warehouse-only — listen for pulls heading to or leaving the
  // warehouse's incoming queue (to_warehouse / packed / sent with
  // claimed_by_store_id = warehouse). Pop a toast on first arrival.
  useEffect(() => {
    if (role !== "warehouse") return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("tabbar-routed")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pulls" },
        (payload) => {
          const oldRow = payload.old as {
            status?: PullStatus;
            claimed_by_store_id?: string | null;
          };
          const newRow = payload.new as {
            status?: PullStatus;
            claimed_by_store_id?: string | null;
          };
          const wasOurs =
            oldRow.claimed_by_store_id === storeId &&
            !!oldRow.status &&
            ROUTED_INFLIGHT.has(oldRow.status);
          const isOurs =
            newRow.claimed_by_store_id === storeId &&
            !!newRow.status &&
            ROUTED_INFLIGHT.has(newRow.status);
          if (!wasOurs && isOurs) {
            setRoutedBadge((n) => n + 1);
            // Only buzz on the first transition into the queue.
            if (newRow.status === "to_warehouse") {
              toast.show("New pull routed to warehouse");
            }
          } else if (wasOurs && !isOurs) {
            setRoutedBadge((n) => Math.max(0, n - 1));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pulls" },
        (payload) => {
          const oldRow = payload.old as {
            status?: PullStatus;
            claimed_by_store_id?: string | null;
          };
          if (
            oldRow.claimed_by_store_id === storeId &&
            !!oldRow.status &&
            ROUTED_INFLIGHT.has(oldRow.status)
          ) {
            setRoutedBadge((n) => Math.max(0, n - 1));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, storeId, toast]);

  // Manager layout: Feed | Pulls | [POST FAB] | Claims | History
  // Warehouse layout: Feed | Routed | History (no post FAB, no pulls)
  const isWarehouse = role === "warehouse";
  const claimsTab: TabDef = isWarehouse
    ? { ...CLAIMS, label: "Routed" }
    : CLAIMS;
  const leftTabs = isWarehouse ? [FEED] : [FEED, PULLS];
  const rightTabs = isWarehouse ? [claimsTab, HISTORY] : [claimsTab, HISTORY];

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur border-t border-zinc-200">
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
