export default function PosLogLoading() {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="h-6 w-24 rounded bg-zinc-100 animate-pulse" />
        <div className="h-4 w-72 rounded bg-zinc-100 animate-pulse mt-2" />
      </div>
      <div className="px-4 py-3 border-b border-zinc-200 flex gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 h-11 w-24 rounded-full bg-zinc-100 animate-pulse"
          />
        ))}
        <div className="ml-auto h-11 w-28 rounded-full bg-zinc-100 animate-pulse" />
      </div>
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 space-y-2">
            <div className="h-5 w-3/4 rounded bg-zinc-100 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-zinc-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
