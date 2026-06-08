"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  derivePassword,
  normalizeCode,
  syntheticEmail,
} from "@/lib/auth-code";

export type LoginState = { error?: string } | undefined;

export async function signInWithCodeAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Enter a 4-digit code." };

  // Look up the user by code (bypass RLS).
  const admin = createSupabaseAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();
  if (!user) return { error: "Code not registered. Tap 'First time? Sign up'." };

  // Sign them in via the SSR-cookies-aware server client.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail(code),
    password: derivePassword(code),
  });
  if (error) return { error: "Sign-in failed. Contact an admin." };

  redirect("/feed");
}
