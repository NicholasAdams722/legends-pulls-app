import type { PullStatus } from "@/lib/types";

const STEPS = [
  { id: "posted", label: "Unclaimed" },
  { id: "claimed", label: "Claimed" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped" },
  { id: "received", label: "Received" },
] as const;

/**
 * Index of the most recently completed step for this status.
 * The next step (completedIdx + 1) is rendered as the "active" call-to-action.
 */
function statusToCompletedIndex(status: PullStatus): number {
  switch (status) {
    case "available":
      return 0; // Posted — waiting on a claim
    case "claimed":
      return 1; // Claimed — needs packing
    case "packed":
      return 2; // Packed — needs shipping
    case "sent":
      return 3; // Shipped — in transit
    case "received":
      return 4; // All done
    default:
      return 0;
  }
}

export function JourneyStrip({ status }: { status: PullStatus }) {
  const completedIdx = statusToCompletedIndex(status);

  return (
    <div className="flex items-start gap-0">
      {STEPS.map((step, i) => {
        const done = i <= completedIdx;
        const active = i === completedIdx + 1;
        const isLast = i === STEPS.length - 1;
        const dotCls = done
          ? "bg-emerald-500"
          : active
            ? "bg-zinc-900 ring-4 ring-zinc-900/15"
            : "bg-zinc-300";
        const lineCls = done ? "bg-emerald-500" : "bg-zinc-200";
        return (
          <div key={step.id} className="flex-1 flex flex-col items-stretch">
            <div className="flex items-center">
              <div
                className={`shrink-0 w-2.5 h-2.5 rounded-full mx-auto ${dotCls}`}
              />
              {!isLast && <div className={`flex-1 h-0.5 ${lineCls}`} />}
            </div>
            <div
              className={`text-[10px] leading-tight mt-1 text-center pr-1 truncate ${
                active
                  ? "text-zinc-900 font-bold"
                  : done
                    ? "text-emerald-700 font-semibold"
                    : "text-zinc-400"
              }`}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
