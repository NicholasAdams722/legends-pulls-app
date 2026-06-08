import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, Store } from "@/lib/types";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getAppUser(): Promise<{
  user: AppUser;
  store: Store;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*, store:stores(*)")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error || !data) return null;

  const { store, ...rest } = data as AppUser & { store: Store };
  return { user: rest as AppUser, store };
}

export async function requireAppUser() {
  const result = await getAppUser();
  if (!result) {
    redirect("/login?error=no_profile");
  }
  return result;
}
