"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import type { MyPull } from "./my-pulls-tabs";
import { useToast } from "../../_components/toast";
import { EmptyState, PlusIcon } from "../../_components/empty-state";
import { PullDetailSheet } from "../../_components/pull-detail-sheet";

export function PostedList({
  pulls,
  onDeleted,
  onShipped,
}: {
  pulls: MyPull[];
  onDeleted: (id: string) => void;
  onShipped: (ids: string[]) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<MyPull | null>(null);
  // Ids selected for a batch "Ship to warehouse". Only available pulls can be
  // selected, so this set never contains anything the RPC would reject.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [shipping, setShipping] = useState(false);
  const toast = useToast();

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

  // Keep the selection pruned to what's actually still visible/available (a
  // realtime claim or delete elsewhere can drop a pull out from under us).
  const selectedVisible = useMemo(
    () => visible.filter((p) => selected.has(p.id)),
    [visible, selected],
  );
  const selectedCount = selectedVisible.length;
  const allSelected = visible.length > 0 && selectedCount === visible.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (visible.length > 0 && visible.every((p) => prev.has(p.id))) {
        return new Set();
      }
      return new Set(visible.map((p) => p.id));
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function deletePull(id: string) {
    if (!confirm("Delete this pull? This can't be undone.")) return;
    setDeleting(id);
    onDeleted(id);
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("pulls").delete().eq("id", id);
      if (error) alert(error.message);
    } finally {
      setDeleting(null);
    }
  }

  async function shipToWarehouse() {
    const ids = selectedVisible.map((p) => p.id);
    if (ids.length === 0 || shipping) return;
    const n = ids.length;
    if (
      !confirm(
        `Ship ${n} ${n === 1 ? "pull" : "pulls"} to the warehouse? ` +
          `They'll leave this list and appear in your POS Log under the ` +
          `Warehouse group, ready to enter into POS. This doesn't need any ` +
          `action from the warehouse.`,
      )
    ) {
      return;
    }
    setShipping(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("ship_pulls_to_warehouse", {
        p_pull_ids: ids,
      });
      if (error) {
        alert(error.message);
        return;
      }
      // The RPC is all-or-nothing, so on success every selected id shipped.
      // Trust the returned rows if present, else fall back to what we sent.
      const shippedIds =
        (data as { id: string }[] | null)?.map((r) => r.id) ?? ids;
      onShipped(shippedIds);
      clearSelection();
      toast.show(
        `Shipped ${shippedIds.length} to warehouse — log ${
          shippedIds.length === 1 ? "it" : "them"
        } in your POS`,
      );
    } finally {
      setShipping(false);
    }
  }

  return (
    <div>
      <div className="px-4 py-3 border-b border-zinc-200 flex gap-2 items-center">
        <input
          placeholder="Search style or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-12 rounded-lg bg-white border border-zinc-300 px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
        />
        {visible.length > 0 && (
          <button
            onClick={toggleAll}
            className="shrink-0 h-12 px-3 rounded-lg text-sm font-semibold text-zinc-800 border border-zinc-300 bg-white active:bg-zinc-100"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600 leading-snug">
          Need to clear stock into the warehouse? Tap the checkboxes to select
          pulls, then <b>Ship to warehouse</b> — no warehouse action needed.
        </div>
      )}

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
        <ul className="px-3 py-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:px-4 lg:py-4 xl:grid-cols-3">
          {visible.map((p) => {
            const total = totalQuantity(p.pull_lines);
            const breakdown = variantBreakdown(p.pull_lines);
            const isSelected = selected.has(p.id);
            return (
              <li
                key={p.id}
                className={`flex rounded-xl border bg-white overflow-hidden shadow-sm ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-500"
                    : "border-zinc-200"
                }`}
              >
                <div className="w-32 sm:w-36 shrink-0 relative self-stretch bg-zinc-100">
                  <button
                    type="button"
                    onClick={() => setDetailFor(p)}
                    aria-label={`View details for ${p.style_name}`}
                    className="absolute inset-0 active:opacity-80"
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
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={
                      isSelected
                        ? `Deselect ${p.style_name}`
                        : `Select ${p.style_name} to ship to warehouse`
                    }
                    onClick={() => toggle(p.id)}
                    className="absolute top-2 left-2 w-9 h-9 rounded-lg flex items-center justify-center bg-white/90 border border-zinc-300 shadow-sm active:scale-95"
                  >
                    <span
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-zinc-400"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
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

      {selectedCount > 0 && (
        <>
          {/* Spacer so the fixed action bar never hides the last card. */}
          <div className="h-24" aria-hidden />
          <div
            className="fixed left-0 right-0 z-20 px-4 lg:left-64"
            style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="lg:max-w-6xl lg:mx-auto flex items-center gap-3 rounded-xl bg-zinc-900 text-white px-4 py-3 shadow-lg">
              <div className="text-sm font-semibold flex-1">
                {selectedCount} selected
                <button
                  onClick={clearSelection}
                  className="ml-3 text-zinc-300 underline font-medium"
                >
                  Clear
                </button>
              </div>
              <button
                onClick={shipToWarehouse}
                disabled={shipping}
                className="shrink-0 h-11 px-4 rounded-lg text-sm font-bold bg-fuchsia-500 text-white active:scale-[0.99] disabled:opacity-60"
              >
                {shipping
                  ? "Shipping…"
                  : `Ship ${selectedCount} to warehouse`}
              </button>
            </div>
          </div>
        </>
      )}

      {detailFor && (
        <PullDetailSheet pull={detailFor} onClose={() => setDetailFor(null)} />
      )}
    </div>
  );
}
