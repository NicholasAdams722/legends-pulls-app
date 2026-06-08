"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

async function requireAdmin() {
  const { user } = await requireAppUser();
  if (user.role !== "admin") {
    throw new Error("Not authorized");
  }
  return user;
}

export async function addUserAction(input: {
  email: string;
  name: string;
  store_id: string;
  role: UserRole;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) return { ok: false, error: "Name and email required" };

    const admin = createSupabaseAdminClient();

    // Find or create the auth user
    let userId: string | null = null;
    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = listed?.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({ email, email_confirm: true });
      if (createErr || !created.user) {
        return { ok: false, error: createErr?.message ?? "create failed" };
      }
      userId = created.user.id;
    }

    // Upsert the public profile row
    const { error: upErr } = await admin.from("users").upsert({
      id: userId,
      email,
      name,
      store_id: input.store_id,
      role: input.role,
    });
    if (upErr) return { ok: false, error: upErr.message };

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function updateUserAction(input: {
  id: string;
  name: string;
  store_id: string;
  role: UserRole;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("users")
      .update({
        name: input.name.trim(),
        store_id: input.store_id,
        role: input.role,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function removeUserAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await requireAdmin();
    if (id === me.id) return { ok: false, error: "You can't remove yourself" };
    const admin = createSupabaseAdminClient();
    // Deleting from auth cascades to public.users via FK on delete cascade.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function generateSignInLinkAction(
  email: string,
): Promise<{ ok: boolean; otp?: string; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim().toLowerCase(),
    });
    if (error) return { ok: false, error: error.message };
    // GoTrue returns the OTP in properties.email_otp
    const otp =
      (data?.properties as { email_otp?: string } | undefined)?.email_otp ??
      undefined;
    return { ok: true, otp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
