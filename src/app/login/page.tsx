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
        <h1 className="text-3xl font-bold mb-2 text-zinc-900">Legends Pulls</h1>
        <p className="text-zinc-600 mb-8 text-base">
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
            className="w-full h-14 rounded-lg bg-white border border-zinc-300 px-4 text-center text-3xl tracking-[0.5em] font-mono text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full h-14 rounded-lg bg-emerald-500 text-white text-base font-semibold disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/signup"
            className="text-base text-zinc-700 underline-offset-2 underline font-semibold"
          >
            First time? Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
