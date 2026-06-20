"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { MyPull } from "./my-pulls-tabs";

export function PostedList({
  pulls,
  onDeleted,
}: {
  pulls: MyPull[];
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Posted = the one active stage of the lifecycle: "Available" (waiting
  // for a claim). Anything that moved on lives in To pack / To send / Log.
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
        <div className="p-10 text-center text-base text-zinc-500">
          {search
            ? "No available pulls match that search."
            : "No pulls waiting for a claim. Tap + to post one."}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {visible.map((p) => {
            const total = totalQuantity(p.pull_lines);
            const breakdown = variantBreakdown(p.pull_lines);
            return (
              <li key={p.id} className="p-4">
                <div className="flex gap-3">
                  <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                    {p.photo_urls[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photo_urls[0]}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold truncate text-zinc-900">
                      {p.style_name}
                    </div>
                    <div className="text-sm text-zinc-700 mt-1">
                      {total} {total === 1 ? "pc" : "pcs"}
                      {breakdown && ` · ${breakdown}`}
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">
                      Posted {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/pulls/${p.id}/edit`}
                    className="flex-1 h-12 inline-flex items-center justify-center rounded-lg bg-white border border-zinc-300 text-base font-semibold text-zinc-800"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deletePull(p.id)}
                    disabled={deleting === p.id}
                    className="flex-1 h-12 rounded-lg bg-white border border-zinc-300 text-base font-semibold text-red-600 disabled:opacity-50"
                  >
                    {deleting === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
