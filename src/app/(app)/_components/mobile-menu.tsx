"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Mobile-only overflow menu. Collapses the secondary actions that used to sit
 * as loose icons in the mobile header — Help, Team members (admin only), and
 * Logout — behind a single hamburger button, keeping the header clean. The
 * desktop sidebar keeps its own equivalents and is unaffected.
 */
export function MobileMenu({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape, and move focus to the first item when the menu opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    firstItemRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Return focus to the trigger when the menu closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  async function signOut() {
    if (busy) return;
    if (!confirm("Sign out?")) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Base without a text color so each item can set its own (link = zinc,
  // logout = red) without two conflicting text-color utilities on one element.
  const itemBase =
    "flex items-center gap-3 w-full px-4 h-12 text-left text-base font-semibold active:bg-zinc-100";
  const itemClass = `${itemBase} text-zinc-800`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="-mr-2 w-10 h-10 flex items-center justify-center text-zinc-600 active:text-zinc-900"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Portaled to <body> so it escapes the sticky, backdrop-blurred app
          header's stacking context — otherwise the panel's z-index is capped
          and the feed's sticky pill/filter bar (also a stacking context) paints
          over it. `open` starts false, so this branch never runs during SSR and
          document.body is only touched on the client after interaction. */}
      {open &&
        createPortal(
          <div
            className="lg:hidden fixed inset-0 z-[60]"
            onClick={close}
            aria-hidden
          >
          <div className="absolute inset-0 bg-zinc-900/20" />
          <div
            role="menu"
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
            style={{ top: "calc(env(safe-area-inset-top) + 3.25rem)" }}
            className="absolute right-2 z-50 min-w-[14rem] rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-zinc-200">
              <div className="text-xs uppercase tracking-wide text-zinc-500 font-semibold">
                Signed in
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {userName}
              </div>
            </div>

            <Link
              ref={firstItemRef}
              href="/help"
              role="menuitem"
              onClick={close}
              className={itemClass}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
                <path d="M12 17h.01" />
              </svg>
              Help
            </Link>

            {isAdmin && (
              <Link
                href="/admin/users"
                role="menuitem"
                onClick={close}
                className={itemClass}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                </svg>
                Team members
              </Link>
            )}

            <div className="border-t border-zinc-200" />

            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={busy}
              className={`${itemBase} text-red-600 disabled:opacity-50`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M15 17l5-5-5-5" />
                <path d="M20 12H9" />
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              </svg>
              {busy ? "Signing out…" : "Logout"}
            </button>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
