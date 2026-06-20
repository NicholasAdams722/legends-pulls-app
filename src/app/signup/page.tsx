import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Store } from "@/lib/types";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Use admin client so an unauthenticated visitor can still see the
  // store list (RLS on `stores` requires authenticated).
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("stores")
    .select("*")
    .order("code");
  const stores = (data ?? []) as Store[];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900">
          Create your account
        </h1>
        <p className="text-zinc-600 mb-8 text-base">
          Pick a 4-digit code you&apos;ll remember. You&apos;ll use it to sign
          in every time.
        </p>

        <SignupForm stores={stores} />

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-base text-zinc-700 underline-offset-2 underline font-semibold"
          >
            Already have a code? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
