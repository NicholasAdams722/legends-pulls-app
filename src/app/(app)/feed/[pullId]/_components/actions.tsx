"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "../../../_components/toast";

type Action = "claim" | "pass" | "unpass";

const RPC: Record<Action, string> = {
  claim: "claim_pull",
  pass: "pass_pull",
  unpass: "unpass_pull",
};

export function PullActions({
  pullId,
  passed = false,
  backToFeed = "/feed",
}: {
  pullId: string;
  passed?: boolean;
  /** Where to return after an action — carries the browsed store so the user
   *  lands back on the same pill (e.g. "/feed?store=<id>"). */
  backToFeed?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc(RPC[action], {
        p_pull_id: pullId,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      if (action === "claim") {
        toast.show("Claimed — find it in your Claims tab");
      } else if (action === "pass") {
        toast.show("Passed");
      } else {
        toast.show("Pass undone");
      }
      // Return to the store the user was browsing so they can keep working
      // through its inventory, instead of resetting to their own store.
      router.push(backToFeed);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 leading-relaxed">
        {passed ? (
          <>
            You <span className="font-semibold text-zinc-800">passed</span> on
            this pull. Changed your mind?{" "}
            <span className="font-semibold text-zinc-800">Claim</span> it for
            your store, or <span className="font-semibold text-zinc-800">
              undo the pass
            </span>{" "}
            to leave it on the feed.
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-800">Pass</span> to skip
            this pull.{" "}
            <span className="font-semibold text-zinc-800">Claim</span> to take
            it for your store — it will be shipped to you on the next truck.
          </>
        )}
      </p>
      <div className="flex gap-3">
        {passed ? (
          <button
            onClick={() => call("unpass")}
            disabled={busy !== null}
            className="flex-1 h-16 rounded-xl bg-white border border-zinc-300 text-lg font-semibold text-zinc-800 disabled:opacity-50 active:scale-[0.98]"
          >
            {busy === "unpass" ? "Undoing…" : "Undo pass"}
          </button>
        ) : (
          <button
            onClick={() => call("pass")}
            disabled={busy !== null}
            className="flex-1 h-16 rounded-xl bg-white border border-zinc-300 text-lg font-semibold text-zinc-800 disabled:opacity-50 active:scale-[0.98]"
          >
            {busy === "pass" ? "Passing…" : "Pass"}
          </button>
        )}
        <button
          onClick={() => call("claim")}
          disabled={busy !== null}
          className="flex-1 h-16 rounded-xl bg-emerald-500 text-white text-lg font-bold disabled:opacity-50 active:scale-[0.98]"
        >
          {busy === "claim" ? "Claiming…" : "Claim"}
        </button>
      </div>
      {error && <p className="text-base text-red-600">{error}</p>}
    </div>
  );
}
