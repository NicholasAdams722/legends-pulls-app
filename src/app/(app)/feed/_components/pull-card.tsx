import Link from "next/link";
import type { PullLine, PullStatus, Store, GoodType } from "@/lib/types";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import { storeColor } from "@/lib/store-colors";

export type FeedPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  good_type: GoodType;
  description: string | null;
  status: PullStatus;
  from_store: Store;
  pull_lines: PullLine[];
};

export function PullCard({ pull, passed }: { pull: FeedPull; passed?: boolean }) {
  const total = totalQuantity(pull.pull_lines);
  const breakdown = variantBreakdown(pull.pull_lines);
  const c = storeColor(pull.from_store.code);
  // A passed pull that peer consensus has routed to the warehouse is no longer
  // claimable — show it as "Routed" rather than the actionable "Passed" state.
  const routed = pull.status === "to_warehouse";

  return (
    <Link
      href={`/feed/${pull.id}`}
      className={`block rounded-xl overflow-hidden bg-white border border-zinc-200 border-l-4 shadow-sm ${c.border} ${
        passed ? "opacity-75" : ""
      }`}
    >
      <div className="aspect-square bg-zinc-100 relative">
        {pull.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pull.photo_urls[0]}
            alt={pull.style_name}
            className={`absolute inset-0 w-full h-full object-cover ${
              passed ? "grayscale" : ""
            }`}
          />
        ) : null}
        {passed && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-zinc-900/80 text-xs font-bold uppercase tracking-wide text-white">
            {routed ? "Routed" : "Passed"}
          </div>
        )}
        {pull.good_type === "hard" && (
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 text-xs font-bold uppercase tracking-wide text-zinc-100">
            Item
          </div>
        )}
      </div>
      <div className="p-3">
        <div
          className={`inline-flex items-center px-2.5 h-7 rounded-md text-xs font-bold tracking-wide ${c.badge}`}
        >
          STORE {pull.from_store.code}
        </div>
        <div className="text-base font-semibold mt-2 leading-tight line-clamp-2 text-zinc-900">
          {pull.style_name}
        </div>
        <div className="text-sm text-zinc-700 mt-1.5">
          {total} {total === 1 ? "pc" : "pcs"}
        </div>
        {breakdown && (
          <div className="text-xs text-zinc-500 mt-1 leading-snug line-clamp-2">
            {breakdown}
          </div>
        )}
      </div>
    </Link>
  );
}
