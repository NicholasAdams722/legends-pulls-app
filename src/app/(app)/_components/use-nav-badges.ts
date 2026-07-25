"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PullStatus } from "@/lib/types";
import { useToast } from "./toast";

// Pulls awaiting THIS store's pack/ship action (drives the Pulls tab badge).
const INFLIGHT: ReadonlySet<PullStatus> = new Set<PullStatus>([
  "claimed",
  "packed",
  "to_warehouse",
]);
// Pulls sitting in a warehouse's incoming queue (drives the Routed badge).
const ROUTED_INFLIGHT: ReadonlySet<PullStatus> = new Set<PullStatus>([
  "to_warehouse",
  "packed",
  "sent",
]);

/**
 * Live nav badge counts, shared by the mobile tab bar and the desktop sidebar.
 *
 * Why a Set of ids and not a running delta: `pulls` has default replica
 * identity, so realtime UPDATE/DELETE payloads carry only the primary key in
 * `payload.old` — `old.status` is absent. A delta computed from old-vs-new
 * status is therefore wrong (it never learns a pull LEFT the in-flight set, so
 * shipping never decrements the badge). Instead we seed a Set from the server
 * and reconcile membership from `payload.new` alone, which is always complete.
 *
 * INSERT and DELETE are intentionally ignored: a pull is always inserted
 * 'available' (RLS), so it can't enter either set on insert; and an in-flight
 * or routed pull can never be deleted (RLS delete requires status='available'),
 * so nothing we count is ever removed by a delete. Every membership change we
 * care about arrives as an UPDATE.
 *
 * Degrades gracefully: if realtime is unavailable the Set simply stays at the
 * server-seeded value, and any navigation re-seeds it from a fresh query.
 */
export function useNavBadges({
  role,
  storeId,
  initialPullsIds,
  initialRoutedIds,
}: {
  role: "manager" | "warehouse" | "admin";
  storeId: string;
  initialPullsIds: string[];
  initialRoutedIds: string[];
}): { pullsBadge: number; routedBadge: number } {
  const toast = useToast();
  const isWarehouse = role === "warehouse";
  // Unique per component instance so the tab bar and sidebar (both mounted, one
  // hidden via CSS) don't share a realtime channel name.
  const instanceId = useId();

  const [pullsIds, setPullsIds] = useState<Set<string>>(
    () => new Set(initialPullsIds),
  );
  const [routedIds, setRoutedIds] = useState<Set<string>>(
    () => new Set(initialRoutedIds),
  );

  // Refs mirror the sets so realtime handlers read current membership without
  // re-subscribing, and stay authoritative across rapid events in one tick.
  const pullsRef = useRef(pullsIds);
  const routedRef = useRef(routedIds);

  // Re-seed from the server on new initial data (e.g. hard nav re-renders the
  // layout). Reference identity of the array changes when the server refetches.
  const seededPullsRef = useRef(initialPullsIds);
  useEffect(() => {
    if (initialPullsIds === seededPullsRef.current) return;
    seededPullsRef.current = initialPullsIds;
    const next = new Set(initialPullsIds);
    pullsRef.current = next;
    setPullsIds(next);
  }, [initialPullsIds]);

  const seededRoutedRef = useRef(initialRoutedIds);
  useEffect(() => {
    if (initialRoutedIds === seededRoutedRef.current) return;
    seededRoutedRef.current = initialRoutedIds;
    const next = new Set(initialRoutedIds);
    routedRef.current = next;
    setRoutedIds(next);
  }, [initialRoutedIds]);

  // Pulls badge (managers/admins): pulls from this store awaiting pack/ship.
  useEffect(() => {
    if (isWarehouse) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`nav-pulls-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pulls",
          filter: `from_store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status?: PullStatus };
          if (!row.id) return;
          const inflight = !!row.status && INFLIGHT.has(row.status);
          const has = pullsRef.current.has(row.id);
          if (inflight === has) return; // no membership change
          const next = new Set(pullsRef.current);
          if (inflight) next.add(row.id);
          else next.delete(row.id);
          pullsRef.current = next;
          setPullsIds(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isWarehouse, storeId, instanceId]);

  // Routed badge (warehouse): pulls in this warehouse's incoming queue. No
  // server-side filter — the queue keys on claimed_by_store_id, not from_store.
  useEffect(() => {
    if (!isWarehouse) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`nav-routed-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pulls" },
        (payload) => {
          const row = payload.new as {
            id: string;
            status?: PullStatus;
            claimed_by_store_id?: string | null;
          };
          if (!row.id) return;
          const ours =
            row.claimed_by_store_id === storeId &&
            !!row.status &&
            ROUTED_INFLIGHT.has(row.status);
          const has = routedRef.current.has(row.id);
          if (ours === has) return;
          const next = new Set(routedRef.current);
          if (ours) {
            next.add(row.id);
            // Buzz only on the first hop into the queue (consensus route).
            if (row.status === "to_warehouse") {
              toast.show("New pull routed to warehouse");
            }
          } else {
            next.delete(row.id);
          }
          routedRef.current = next;
          setRoutedIds(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isWarehouse, storeId, instanceId, toast]);

  return useMemo(
    () => ({ pullsBadge: pullsIds.size, routedBadge: routedIds.size }),
    [pullsIds, routedIds],
  );
}
