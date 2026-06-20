export default function HistoryLoading() {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="h-6 w-24 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="px-4 py-3 space-y-2 border-b border-zinc-200">
        <div className="h-12 rounded-lg bg-zinc-100 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-11 w-32 rounded-full bg-zinc-100 animate-pulse" />
          <div className="h-11 w-28 rounded-full bg-zinc-100 animate-pulse ml-auto" />
        </div>
      </div>
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 space-y-2">
            <div className="h-5 w-3/4 rounded bg-zinc-100 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-zinc-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
