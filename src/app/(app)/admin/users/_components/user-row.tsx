"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, Store, UserRole } from "@/lib/types";
import {
  generateSignInLinkAction,
  removeUserAction,
  updateUserAction,
} from "../actions";

export function UserRow({
  user,
  stores,
  isSelf,
}: {
  user: AppUser & { store?: Store | null };
  stores: Store[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [storeId, setStoreId] = useState(user.store_id);
  const [role, setRole] = useState<UserRole>(user.role);
  const [otp, setOtp] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateUserAction({
        id: user.id,
        name,
        store_id: storeId,
        role,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (isSelf) return;
    if (!confirm(`Remove ${user.name}? This deletes their account.`)) return;
    startTransition(async () => {
      const res = await removeUserAction(user.id);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      router.refresh();
    });
  }

  function sendCode() {
    setError(null);
    setOtp(null);
    startTransition(async () => {
      const res = await generateSignInLinkAction(user.email);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      setOtp(res.otp ?? null);
    });
  }

  if (!editing) {
    const store = stores.find((s) => s.id === user.store_id);
    return (
      <li className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">
              {user.name}
              {isSelf && (
                <span className="ml-2 text-[10px] uppercase text-zinc-500">
                  You
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400 truncate">{user.email}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {store ? `Store ${store.code} · ${store.name}` : "(no store)"} ·{" "}
              <span className="uppercase">{user.role}</span>
            </div>
          </div>
        </div>
        {otp && (
          <div className="rounded-md bg-emerald-950/40 border border-emerald-900 p-2 text-xs text-emerald-100">
            One-time code: <span className="font-mono text-base">{otp}</span>
            <div className="text-[11px] text-emerald-300/80 mt-1">
              Share it with {user.name}. They enter it under &quot;I already
              have a code&quot;.
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={sendCode}
            disabled={pending}
            className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800 disabled:opacity-50"
          >
            {pending && !editing ? "…" : "Send code"}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800"
          >
            Edit
          </button>
          {!isSelf && (
            <button
              onClick={remove}
              disabled={pending}
              className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-red-400 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="p-3 space-y-2 bg-zinc-950">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
      />
      <select
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            Store {s.code} · {s.name}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
      >
        <option value="manager">Manager</option>
        <option value="warehouse">Warehouse</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setEditing(false);
            setName(user.name);
            setStoreId(user.store_id);
            setRole(user.role);
            setError(null);
          }}
          className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 h-11 rounded-lg bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}
