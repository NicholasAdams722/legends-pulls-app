export default function FeedLoading() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 h-11 w-24 rounded-full bg-zinc-100 animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden bg-white border border-zinc-200 border-l-4 border-l-zinc-200 shadow-sm"
          >
            <div className="aspect-square bg-zinc-100 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-7 w-16 rounded-md bg-zinc-100 animate-pulse" />
              <div className="h-5 w-3/4 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
