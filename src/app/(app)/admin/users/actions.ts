"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  derivePassword,
  normalizeCode,
  syntheticEmail,
} from "@/lib/auth-code";
import type { UserRole } from "@/lib/types";

async function requireAdmin() {
  const { user } = await requireAppUser();
  if (user.role !== "admin") throw new Error("Not authorized");
  return user;
}

export async function addUserAction(input: {
  name: string;
  code: string;
  store_id: string;
  role: UserRole;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const name = input.name.trim();
    const code = normalizeCode(input.code);
    if (!name) return { ok: false, error: "Name required" };
    if (!code) return { ok: false, error: "4-digit code required" };

    const admin = createSupabaseAdminClient();

    // Code uniqueness
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("employee_code", code)
      .maybeSingle();
    if (existing) return { ok: false, error: "That code is already in use" };

    const email = syntheticEmail(code);
    const password = derivePassword(code);

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createErr || !created.user) {
      return { ok: false, error: createErr?.message ?? "create failed" };
    }

    const { error: upErr } = await admin.from("users").insert({
      id: created.user.id,
      email,
      name,
      store_id: input.store_id,
      role: input.role,
      employee_code: code,
    });
    if (upErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: upErr.message };
    }

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
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// Reset a user's code (admin override — e.g. forgotten code).
// Generates a new auth password derived from the new code.
export async function resetCodeAction(input: {
  id: string;
  newCode: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const newCode = normalizeCode(input.newCode);
    if (!newCode) return { ok: false, error: "4-digit code required" };

    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("employee_code", newCode)
      .neq("id", input.id)
      .maybeSingle();
    if (existing) return { ok: false, error: "That code is already in use" };

    const email = syntheticEmail(newCode);
    const password = derivePassword(newCode);

    const { error: authErr } = await admin.auth.admin.updateUserById(input.id, {
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return { ok: false, error: authErr.message };

    const { error: profileErr } = await admin
      .from("users")
      .update({ employee_code: newCode, email })
      .eq("id", input.id);
    if (profileErr) return { ok: false, error: profileErr.message };

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
