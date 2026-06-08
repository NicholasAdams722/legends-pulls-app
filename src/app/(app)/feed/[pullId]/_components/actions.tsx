"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PullActions({ pullId }: { pullId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"claim" | "pass" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function call(action: "claim" | "pass") {
    setBusy(action);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc(
        action === "claim" ? "claim_pull" : "pass_pull",
        { p_pull_id: pullId },
      );
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      router.push(action === "claim" ? "/claims" : "/feed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">
          Claim this pull? Your store will mark it received once the transfer
          arrives.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 h-12 rounded-lg bg-zinc-900 border border-zinc-800 font-medium"
          >
            Back
          </button>
          <button
            onClick={() => call("claim")}
            disabled={busy !== null}
            className="flex-1 h-12 rounded-lg bg-emerald-500 text-zinc-950 font-medium disabled:opacity-50"
          >
            {busy === "claim" ? "Claiming…" : "Confirm claim"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => call("pass")}
          disabled={busy !== null}
          className="flex-1 h-12 rounded-lg bg-zinc-900 border border-zinc-800 font-medium disabled:opacity-50"
        >
          {busy === "pass" ? "Passing…" : "Pass"}
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={busy !== null}
          className="flex-1 h-12 rounded-lg bg-emerald-500 text-zinc-950 font-medium disabled:opacity-50"
        >
          Claim
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
