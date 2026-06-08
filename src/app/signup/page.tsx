import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Stores are public-readable, so no auth needed here
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("type", "retail")
    .order("code");
  const stores = (data ?? []) as Store[];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold mb-2">Create your account</h1>
        <p className="text-zinc-400 mb-8 text-sm">
          Pick a 4-digit code you&apos;ll remember. You&apos;ll use it to sign
          in every time.
        </p>

        <SignupForm stores={stores} />

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-sm text-zinc-400 underline-offset-2 underline"
          >
            Already have a code? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
