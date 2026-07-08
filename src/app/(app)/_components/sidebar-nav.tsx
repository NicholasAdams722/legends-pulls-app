"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PullStatus, UserRole } from "@/lib/types";
import { useToast } from "./toast";
import { SignOutButton } from "./sign-out-button";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
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

const FEED: Item = {
  href: "/feed",
  label: "Feed",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};
const PULLS: Item = {
  href: "/pulls",
  label: "My Pulls",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  ),
};
const CLAIMS: Item = {
  href: "/claims",
  label: "Claims",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l4-4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M8 11l3 3 5-5" />
    </svg>
  ),
};
const POS_LOG: Item = {
  href: "/pos-log",
  label: "POS Log",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" fill="currentColor" stroke="none" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  ),
};

export function SidebarNav({
  role,
  storeId,
  storeCode,
  storeName,
  userName,
  initialPullsBadge,
  initialRoutedBadge,
}: {
  role: UserRole;
  storeId: string;
  storeCode: number;
  storeName: string;
  userName: string;
  initialPullsBadge: number;
  initialRoutedBadge: number;
}) {
  const pathname = usePathname();
  const toast = useToast();
  const [pullsBadge, setPullsBadge] = useState(initialPullsBadge);
  const [routedBadge, setRoutedBadge] = useState(initialRoutedBadge);

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

  // Realtime pulls badge (managers/admins only).
  useEffect(() => {
    if (role === "warehouse") return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("sidebar-pulls")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pulls",
          filter: `from_store_id=eq.${storeId}`,
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
          filter: `from_store_id=eq.${storeId}`,
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
  }, [role, storeId]);

  // Realtime routed badge (warehouse only).
  useEffect(() => {
    if (role !== "warehouse") return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("sidebar-routed")
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

  const isWarehouse = role === "warehouse";
  const claims: Item = isWarehouse ? { ...CLAIMS, label: "Routed" } : CLAIMS;
  const items: Item[] = isWarehouse
    ? [FEED, claims, POS_LOG]
    : [FEED, PULLS, claims, POS_LOG];

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-white lg:border-r lg:border-zinc-200 lg:flex lg:flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-zinc-200">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
          Legends Pulls
        </div>
        <div className="mt-2 text-base font-bold text-zinc-900 leading-tight">
          Store {storeCode}
        </div>
        <div className="text-sm text-zinc-600">{storeName}</div>
        <div className="text-xs text-zinc-500 mt-2 truncate">{userName}</div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          const badge =
            it.href === "/pulls"
              ? pullsBadge
              : isWarehouse && it.href === "/claims"
                ? routedBadge
                : 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-semibold transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span className="shrink-0">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {badge > 0 && (
                <span className="shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-[20px] text-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!isWarehouse && (
        <div className="px-3 pb-3">
          <Link
            href="/post"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-500 text-white text-base font-bold shadow-sm hover:bg-emerald-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Post a pull
          </Link>
        </div>
      )}

      <div className="px-3 pb-2">
        <Link
          href="/help"
          className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-semibold ${
            pathname === "/help" || pathname.startsWith("/help/")
              ? "bg-zinc-900 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
            <path d="M12 17h.01" />
          </svg>
          How to use
        </Link>
      </div>

      {role === "admin" && (
        <div className="px-3 pb-2">
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
            Admin
          </Link>
        </div>
      )}

      <div className="px-3 pb-4 pt-2 border-t border-zinc-200 flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-500 truncate">Signed in</div>
        <SignOutButton />
      </div>
    </aside>
  );
}
