"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "../../../_components/toast";

export function PullActions({ pullId }: { pullId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"claim" | "pass" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (action === "claim") {
        toast.show("Claimed — find it in your Claims tab");
      } else {
        toast.show("Passed");
      }
      router.push("/feed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 leading-relaxed">
        <span className="font-semibold text-zinc-800">Pass</span> to skip this
        pull. <span className="font-semibold text-zinc-800">Claim</span> to take
        it for your store — it will be shipped to you on the next truck.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => call("pass")}
          disabled={busy !== null}
          className="flex-1 h-16 rounded-xl bg-white border border-zinc-300 text-lg font-semibold text-zinc-800 disabled:opacity-50 active:scale-[0.98]"
        >
          {busy === "pass" ? "Passing…" : "Pass"}
        </button>
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
