export default function ClaimsLoading() {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="h-6 w-28 rounded bg-zinc-100 animate-pulse" />
      </div>
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-3">
              <div className="w-24 h-24 shrink-0 rounded-lg bg-zinc-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 rounded bg-zinc-100 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-zinc-100 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-zinc-100 animate-pulse" />
              </div>
            </div>
            <div className="mt-3 h-14 rounded-xl bg-zinc-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
