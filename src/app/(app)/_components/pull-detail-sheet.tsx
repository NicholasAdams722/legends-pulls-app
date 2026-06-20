"use client";

import { useEffect } from "react";
import type { PullLine, PullStatus, Store } from "@/lib/types";
import { totalQuantity } from "@/lib/pull-summary";
import { JourneyStrip } from "./journey-strip";

export type SheetPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  status?: PullStatus;
  from_store?: Store;
  claimed_by_store?: Store | null;
  pull_lines: PullLine[];
  created_at?: string;
};

export type SheetAction = {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  onClick: () => void;
  className: string;
};

export function PullDetailSheet({
  pull,
  onClose,
  action,
}: {
  pull: SheetPull;
  onClose: () => void;
  action?: SheetAction;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent the body from scrolling while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const total = totalQuantity(pull.pull_lines);
  const sorted = [...pull.pull_lines].sort((a, b) => {
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    if ((a.color ?? "") !== (b.color ?? ""))
      return (a.color ?? "").localeCompare(b.color ?? "");
    return (a.size ?? "").localeCompare(b.size ?? "");
  });

  const destLabel = pull.claimed_by_store
    ? `Store ${pull.claimed_by_store.code} · ${pull.claimed_by_store.name}`
    : null;
  const fromLabel = pull.from_store
    ? `Store ${pull.from_store.code} · ${pull.from_store.name}`
    : null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="absolute inset-0 lg:flex lg:items-center lg:justify-center lg:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pull.style_name}
          className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl max-h-[90dvh] flex flex-col
                     lg:static lg:w-full lg:max-w-xl lg:rounded-2xl lg:max-h-[85dvh] lg:shadow-2xl"
        >
          <div className="flex justify-center pt-2 pb-1 shrink-0 lg:hidden">
            <div className="w-12 h-1.5 rounded-full bg-zinc-300" />
          </div>

        <div className="px-4 pt-2 pb-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-zinc-900 truncate">
                {pull.style_name}
              </h2>
              {(fromLabel || destLabel) && (
                <div className="text-sm text-zinc-600 mt-1 leading-tight">
                  {fromLabel && <span>From {fromLabel}</span>}
                  {fromLabel && destLabel && (
                    <span className="text-zinc-400"> → </span>
                  )}
                  {destLabel && <span>{destLabel}</span>}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-full active:bg-zinc-100 text-zinc-500"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pull.photo_urls.length > 0 && (
            <div className="flex overflow-x-auto snap-x snap-mandatory bg-zinc-100">
              {pull.photo_urls.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={u}
                  alt=""
                  className="snap-center w-full shrink-0 aspect-square object-cover"
                />
              ))}
            </div>
          )}

          {pull.status && (
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <JourneyStrip status={pull.status} />
            </div>
          )}

          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
                Contents
              </h3>
              <div className="text-sm font-semibold text-zinc-900">
                {total} {total === 1 ? "pc" : "pcs"} total
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <table className="w-full text-base">
                <thead className="bg-zinc-100 text-zinc-700 text-sm">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">SKU</th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      Color
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      Size
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l) => (
                    <tr key={l.id} className="border-t border-zinc-200">
                      <td className="px-3 py-2.5 font-mono font-semibold text-zinc-900">
                        {l.sku}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-800">
                        {l.color ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-800">
                        {l.size ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-zinc-900">
                        {l.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {action && (
          <div
            className="px-4 pt-3 pb-3 border-t border-zinc-200 shrink-0 bg-white"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.busy}
              className={`w-full h-14 rounded-xl text-base font-bold disabled:opacity-50 active:scale-[0.99] ${action.className}`}
            >
              {action.busy
                ? (action.busyLabel ?? `${action.label}…`)
                : action.label}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
