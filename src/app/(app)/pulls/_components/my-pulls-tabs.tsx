"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PullLine, PullStatus, Store } from "@/lib/types";
import { PostedList } from "./posted-list";
import { WorkflowList } from "./workflow-list";
import { JourneyStrip } from "../../_components/journey-strip";

export type MyPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  status: PullStatus;
  claimed_at: string | null;
  packed_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  claimed_by_store: Store | null;
  from_store: Store;
  pull_lines: PullLine[];
};

type View = "posted" | "pack" | "send";

function JourneyHeader({ status }: { status: PullStatus }) {
  return (
    <div className="px-4 py-3 bg-zinc-50 border-y border-zinc-200">
      <JourneyStrip status={status} />
    </div>
  );
}

const VIEWS: { id: View; label: string }[] = [
  { id: "posted", label: "Unclaimed" },
  { id: "pack", label: "Pack" },
  { id: "send", label: "Ship" },
];

function parseView(v: string | null | undefined): View {
  return v === "pack" || v === "send" ? v : "posted";
}

export function MyPullsTabs({
  initial,
  initialView,
  userId,
}: {
  initial: MyPull[];
  initialView: string | undefined;
  userId: string;
}) {
  const [view, setViewState] = useState<View>(parseView(initialView));
  const [pulls, setPulls] = useState<MyPull[]>(initial);

  // Keep local state in sync if the server passes new initial data
  // (e.g., navigating back to /pulls).
  const initialRef = useRef(initial);
  useEffect(() => {
    if (initial !== initialRef.current) {
      initialRef.current = initial;
      setPulls(initial);
    }
  }, [initial]);

  // Optimistic patch used by child components.
  const patchPull = useCallback(
    (id: string, patch: Partial<MyPull>) => {
      setPulls((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  const removePull = useCallback((id: string) => {
    setPulls((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Realtime: scope to this user's pulls only and merge incoming rows
  // into local state instead of triggering a full server refetch.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("my-pulls")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pulls",
          filter: `posted_by=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Partial<MyPull> & { id: string };
          setPulls((prev) =>
            prev.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
          );
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
          const oldRow = payload.old as { id: string };
          setPulls((prev) => prev.filter((p) => p.id !== oldRow.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function setView(next: View) {
    setViewState(next);
    // Sync URL without triggering a server re-render.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "posted") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState(null, "", url.toString());
    }
  }

  const counts = useMemo(() => {
    let posted = 0;
    let pack = 0;
    let send = 0;
    for (const p of pulls) {
      if (p.status === "available") posted += 1;
      else if (p.status === "claimed" || p.status === "to_warehouse") pack += 1;
      else if (p.status === "packed") send += 1;
    }
    return { posted, pack, send };
  }, [pulls]);

  return (
    <div>
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        {VIEWS.map((v) => {
          const active = v.id === view;
          const badge =
            v.id === "posted"
              ? counts.posted
              : v.id === "pack"
                ? counts.pack
                : counts.send;
          const activeCls =
            v.id === "pack"
              ? "bg-orange-500 text-white border-orange-500"
              : v.id === "send"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-zinc-900 text-white border-zinc-900";
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`shrink-0 h-10 px-3.5 rounded-full text-sm font-semibold border ${
                active ? activeCls : "bg-white text-zinc-700 border-zinc-300"
              }`}
            >
              {v.label}
              {badge > 0 && (
                <span
                  className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold leading-none ${
                    v.id === "pack" || v.id === "send"
                      ? active
                        ? "bg-white/30 text-white"
                        : "bg-red-500 text-white"
                      : active
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view === "posted" && (
        <>
          <JourneyHeader status="available" />
          <PostedList pulls={pulls} onDeleted={removePull} />
        </>
      )}
      {view === "pack" && (
        <>
          <JourneyHeader status="claimed" />
          <WorkflowList mode="pack" pulls={pulls} onPatch={patchPull} />
        </>
      )}
      {view === "send" && (
        <>
          <JourneyHeader status="packed" />
          <WorkflowList mode="send" pulls={pulls} onPatch={patchPull} />
        </>
      )}
    </div>
  );
}
