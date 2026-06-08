import Link from "next/link";
import type { PullLine, Store, GoodType } from "@/lib/types";
import { totalQuantity, variantBreakdown } from "@/lib/pull-summary";

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

  return (
    <Link
      href={`/feed/${pull.id}`}
      className="block rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800"
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
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] uppercase tracking-wide">
          Store {pull.from_store.code}
        </div>
        {pull.good_type === "hard" && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] uppercase tracking-wide">
            Hard
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-sm font-medium truncate">{pull.style_name}</div>
        <div className="text-xs text-zinc-400 mt-0.5">
          {total} {total === 1 ? "pc" : "pcs"}
        </div>
        {breakdown && (
          <div className="text-[11px] text-zinc-500 mt-1 leading-snug line-clamp-2">
            {breakdown}
          </div>
        )}
      </div>
    </Link>
  );
}
