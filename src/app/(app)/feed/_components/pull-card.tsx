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
        <div className="text-base font-semibold mt-2 leading-tight line-clamp-2">
          {pull.style_name}
        </div>
        <div className="text-sm text-zinc-300 mt-1.5">
          {total} {total === 1 ? "pc" : "pcs"}
        </div>
        {breakdown && (
          <div className="text-xs text-zinc-400 mt-1 leading-snug line-clamp-2">
            {breakdown}
          </div>
        )}
      </div>
    </Link>
  );
}
