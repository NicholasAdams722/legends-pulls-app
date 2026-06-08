import Link from "next/link";
import type { PullLine, Store, GoodType } from "@/lib/types";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";
import { storeColor } from "@/lib/store-colors";

export type FeedPull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  good_type: GoodType;
  description: string | null;
  from_store: Store;
  pull_lines: PullLine[];
};

export function PullCard({ pull }: { pull: FeedPull }) {
  const total = totalQuantity(pull.pull_lines);
  const breakdown = variantBreakdown(pull.pull_lines);
  const c = storeColor(pull.from_store.code);

  return (
    <Link
      href={`/feed/${pull.id}`}
      className={`block rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 border-l-4 ${c.border}`}
    >
      <div className="aspect-square bg-zinc-950 relative">
        {pull.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pull.photo_urls[0]}
            alt={pull.style_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        {pull.good_type === "hard" && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] uppercase tracking-wide text-zinc-100">
            Item
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div
          className={`inline-flex items-center px-2 h-6 rounded-md text-[11px] font-bold tracking-wide ${c.badge}`}
        >
          STORE {pull.from_store.code}
        </div>
        <div className="text-sm font-semibold mt-1.5 leading-tight line-clamp-2">
          {pull.style_name}
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          {total} {total === 1 ? "pc" : "pcs"}
        </div>
        {breakdown && (
          <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">
            {breakdown}
          </div>
        )}
      </div>
    </Link>
  );
}
