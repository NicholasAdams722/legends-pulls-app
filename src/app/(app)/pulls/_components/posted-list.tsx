"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { MyPull } from "./my-pulls-tabs";
import { EmptyState, PlusIcon } from "../../_components/empty-state";
import { PullDetailSheet } from "../../_components/pull-detail-sheet";

export function PostedList({
  pulls,
  onDeleted,
}: {
  pulls: MyPull[];
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<MyPull | null>(null);

  // Posted = the one active stage of the lifecycle: "Available" (waiting
  // for a claim). Anything that moved on lives in To pack / To ship / Log.
  // Cancelled pulls are dropped entirely.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pulls.filter((p) => {
      if (p.status !== "available") return false;
      if (!q) return true;
      if (p.style_name.toLowerCase().includes(q)) return true;
      if (p.pull_lines.some((l) => l.sku.includes(q))) return true;
      return false;
    });
  }, [pulls, search]);

  async function deletePull(id: string) {
    if (!confirm("Delete this pull? This can't be undone.")) return;
    setDeleting(id);
    onDeleted(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("pulls").delete().eq("id", id);
      if (error) alert(error.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="px-4 py-3 border-b border-zinc-200">
        <input
          placeholder="Search style or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {visible.length === 0 ? (
        search ? (
          <div className="px-6 py-12 text-center text-base text-zinc-500">
            No available pulls match that search.
          </div>
        ) : (
          <EmptyState
            icon={<PlusIcon />}
            title="No pulls waiting for a claim"
            body="When you post a pull, it appears here until another store claims it. Tap the green + at the bottom to post your first pull."
          />
        )
      ) : (
        <ul className="px-3 py-3 space-y-3">
          {visible.map((p) => {
            const total = totalQuantity(p.pull_lines);
            const breakdown = variantBreakdown(p.pull_lines);
            return (
              <li
                key={p.id}
                className="flex rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setDetailFor(p)}
                  aria-label={`View details for ${p.style_name}`}
                  className="w-32 sm:w-36 shrink-0 bg-zinc-100 relative self-stretch active:opacity-80"
                >
                  {p.photo_urls[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_urls[0]}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </button>
                <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailFor(p)}
                    className="text-left active:opacity-70"
                  >
                    <div className="text-base font-semibold truncate text-zinc-900">
                      {p.style_name}
                    </div>
                    <div className="text-sm text-zinc-700 mt-1">
                      {total} {total === 1 ? "pc" : "pcs"}
                      {breakdown && ` · ${breakdown}`}
                    </div>
                    <div className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                      <span>
                        {p.pull_lines.length}{" "}
                        {p.pull_lines.length === 1 ? "SKU" : "SKUs"} · tap for
                        details
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Posted {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </button>
                  <div className="flex-1 min-h-2" />
                  <div className="flex gap-2">
                    <Link
                      href={`/pulls/${p.id}/edit`}
                      className="flex-1 h-11 inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 text-sm font-semibold text-zinc-800"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deletePull(p.id)}
                      disabled={deleting === p.id}
                      className="flex-1 h-11 rounded-lg bg-white border border-zinc-300 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      {deleting === p.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {detailFor && (
        <PullDetailSheet
          pull={detailFor}
          onClose={() => setDetailFor(null)}
        />
      )}
    </div>
  );
}
