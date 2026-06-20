export default function PullsLoading() {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="h-6 w-32 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="px-4 pb-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 h-11 w-24 rounded-full bg-zinc-100 animate-pulse"
          />
        ))}
      </div>
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 flex gap-3">
            <div className="w-24 h-24 shrink-0 rounded-lg bg-zinc-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
