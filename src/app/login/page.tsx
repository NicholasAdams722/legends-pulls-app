"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/feed";
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(
    errorParam === "no_profile"
      ? "Your account isn't tied to a store yet. Ask an admin to add you."
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          shouldCreateUser: true,
        },
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        setStage("code");
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) {
        setError(verifyError.message);
      } else {
        router.push(next);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold mb-2">Legends Pulls</h1>
        <p className="text-zinc-400 mb-8 text-sm">
          {stage === "email"
            ? "Sign in with your work email."
            : "Check your email for a 6-digit code, or click the link."}
        </p>

        {stage === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <input
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base focus:outline-none focus:border-zinc-600"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-12 rounded-lg bg-zinc-50 text-zinc-950 font-medium disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send sign-in code"}
            </button>
            <button
              type="button"
              onClick={() => setStage("code")}
              className="w-full h-10 text-sm text-zinc-400"
            >
              I already have a code
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <input
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base focus:outline-none focus:border-zinc-600"
            />
            <input
              type="text"
              required
              placeholder="6-digit code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base tracking-widest focus:outline-none focus:border-zinc-600"
            />
            <button
              type="submit"
              disabled={loading || !email || !code}
              className="w-full h-12 rounded-lg bg-zinc-50 text-zinc-950 font-medium disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
              }}
              className="w-full h-10 text-sm text-zinc-400"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
      </div>
    </main>
  );
}
