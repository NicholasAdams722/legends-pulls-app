import { createHash } from "crypto";

// Synthetic email format used as the Supabase Auth identity for code-based users.
// The user never sees this; they only enter their 4-digit code.
export function syntheticEmail(code: string): string {
  return `emp-${code}@legends-pulls.app`;
}

// Deterministic password derived from the 4-digit code + a server secret.
// The user never types this. The secret stays server-side, so an attacker
// hitting Supabase's auth API directly can't sign in by guessing codes —
// they have to come through our server actions (which are rate-limit-able).
export function derivePassword(code: string): string {
  const secret = process.env.AUTH_DERIVE_SECRET;
  if (!secret) {
    throw new Error("AUTH_DERIVE_SECRET is not set");
  }
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}

export function normalizeCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return /^\d{4}$/.test(digits) ? digits : null;
}
