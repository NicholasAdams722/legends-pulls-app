"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithCodeAction, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInWithCodeAction,
    undefined,
  );

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold mb-2">Legends Pulls</h1>
        <p className="text-zinc-400 mb-8 text-sm">
          Enter your 4-digit employee code.
        </p>

        <form action={formAction} className="space-y-4">
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
          <button
            type="submit"
            disabled={pending}
            className="w-full h-12 rounded-lg bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/signup"
            className="text-sm text-zinc-400 underline-offset-2 underline"
          >
            First time? Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
