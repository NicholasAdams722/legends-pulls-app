"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  derivePassword,
  normalizeCode,
  syntheticEmail,
} from "@/lib/auth-code";

export type SignupState = { error?: string } | undefined;

export async function signUpWithCodeAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!name) return { error: "Enter your name." };
  if (!code) return { error: "Enter a 4-digit code." };
  if (!storeId) return { error: "Pick your store." };

  const admin = createSupabaseAdminClient();

  // Check for an existing user with this code
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();
  if (existing) {
    return { error: "That code is already in use. Pick another." };
  }

  const email = syntheticEmail(code);
  const password = derivePassword(code);

  // Create the auth user
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Sign-up failed." };
  }

  // Insert public.users profile (managers self-signup; admin can promote later)
  const { error: profileErr } = await admin.from("users").insert({
    id: created.user.id,
    name,
    email,
    store_id: storeId,
    role: "manager",
    employee_code: code,
  });
  if (profileErr) {
    // Roll back the auth user so they can try again
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileErr.message };
  }

  // Sign them in by setting cookies via the SSR client
  const supabase = await createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return { error: "Account created. Please sign in." };
  }

  redirect("/feed");
}
