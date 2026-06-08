"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { PullLine, PullStatus, Store } from "@/lib/types";

export type MyPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  status: PullStatus;
  claimed_at: string | null;
  received_at: string | null;
  created_at: string;
  claimed_by_store: Store | null;
  pull_lines: PullLine[];
};

export function MyPullsList({ initial }: { initial: MyPull[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  // Realtime: my-pulls also benefit from live status updates
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("my-pulls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pulls" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function deletePull(id: string) {
    if (!confirm("Delete this pull? This can't be undone.")) return;
    setDeleting(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("pulls").delete().eq("id", id);
      if (error) {
        alert(error.message);
      } else {
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  if (initial.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        You haven&apos;t posted any pulls yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-900">
      {initial.map((p) => {
        const total = totalQuantity(p.pull_lines);
        const breakdown = variantBreakdown(p.pull_lines);
        return (
          <li key={p.id} className="p-4 flex gap-3">
            <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-900">
              {p.photo_urls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_urls[0]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{p.style_name}</div>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {total} {total === 1 ? "pc" : "pcs"}
                {breakdown && ` · ${breakdown}`}
              </div>
              <StatusLine pull={p} />
              {p.status === "available" && (
                <div className="flex gap-2 mt-2">
                  <Link
                    href={`/pulls/${p.id}/edit`}
                    className="text-xs px-3 h-8 inline-flex items-center rounded-full bg-zinc-900 border border-zinc-800"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deletePull(p.id)}
                    disabled={deleting === p.id}
                    className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-red-400 disabled:opacity-50"
                  >
                    {deleting === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: PullStatus }) {
  const map: Record<PullStatus, { label: string; cls: string }> = {
    available: { label: "Available", cls: "bg-emerald-950 text-emerald-300" },
    claimed: { label: "Claimed", cls: "bg-amber-950 text-amber-300" },
    to_warehouse: {
      label: "To Warehouse",
      cls: "bg-indigo-950 text-indigo-300",
    },
    received: { label: "Received", cls: "bg-zinc-800 text-zinc-300" },
    cancelled: { label: "Cancelled", cls: "bg-zinc-800 text-zinc-400" },
  };
  const v = map[status];
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function StatusLine({ pull }: { pull: MyPull }) {
  if (pull.status === "claimed" && pull.claimed_by_store) {
    return (
      <div className="text-xs text-zinc-400 mt-1">
        Claimed by Store {pull.claimed_by_store.code} ·{" "}
        {pull.claimed_by_store.name}
      </div>
    );
  }
  if (pull.status === "to_warehouse") {
    return (
      <div className="text-xs text-zinc-400 mt-1">
        Routed to Warehouse — all peers passed
      </div>
    );
  }
  if (pull.status === "received" && pull.received_at) {
    return (
      <div className="text-xs text-zinc-400 mt-1">
        Received {new Date(pull.received_at).toLocaleString()}
      </div>
    );
  }
  return null;
}
