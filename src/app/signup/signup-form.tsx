"use client";

import { useActionState } from "react";
import type { Store } from "@/lib/types";
import { signUpWithCodeAction, type SignupState } from "./actions";

export function SignupForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signUpWithCodeAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Your name</label>
        <input
          name="name"
          required
          autoComplete="name"
          placeholder="Full name"
          className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base focus:outline-none focus:border-zinc-600"
        />
      </div>

      <div>
        <label className="text-xs text-zinc-500 mb-1 block">
          Your store
        </label>
        <select
          name="store_id"
          required
          defaultValue=""
          className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
        >
          <option value="" disabled>
            Pick your store
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              Store {s.code} · {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-zinc-500 mb-1 block">
          Pick a 4-digit code
        </label>
        <input
          name="code"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          required
          placeholder="0000"
          className="w-full h-14 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:border-zinc-600"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-lg bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>

      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
    </form>
  );
}
