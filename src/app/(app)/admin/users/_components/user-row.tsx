"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, Store, UserRole } from "@/lib/types";
import {
  removeUserAction,
  resetCodeAction,
  updateUserAction,
} from "../actions";

export function UserRow({
  user,
  stores,
  isSelf,
}: {
  user: AppUser;
  stores: Store[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "reset">("view");
  const [name, setName] = useState(user.name);
  const [storeId, setStoreId] = useState(user.store_id);
  const [role, setRole] = useState<UserRole>(user.role);
  const [newCode, setNewCode] = useState("");
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
      setMode("view");
      router.refresh();
    });
  }

  function resetCode() {
    setError(null);
    startTransition(async () => {
      const res = await resetCodeAction({ id: user.id, newCode });
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      setNewCode("");
      setMode("view");
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

  const store = stores.find((s) => s.id === user.store_id);

  if (mode === "view") {
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
            <div className="text-xs text-zinc-500 mt-0.5">
              {store ? `Store ${store.code} · ${store.name}` : "(no store)"} ·{" "}
              <span className="uppercase">{user.role}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              Code
            </div>
            <div className="font-mono text-base tracking-widest">
              {user.employee_code ?? "—"}
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("edit")}
            className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800"
          >
            Edit
          </button>
          <button
            onClick={() => setMode("reset")}
            className="text-xs px-3 h-8 rounded-full bg-zinc-900 border border-zinc-800"
          >
            Reset code
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

  if (mode === "reset") {
    return (
      <li className="p-3 space-y-2 bg-zinc-950">
        <div className="text-xs text-zinc-400">
          New code for {user.name}
        </div>
        <input
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="0000"
          value={newCode}
          onChange={(e) =>
            setNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base tracking-widest text-center"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("view");
              setNewCode("");
              setError(null);
            }}
            className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={resetCode}
            disabled={pending || newCode.length !== 4}
            className="flex-1 h-11 rounded-lg bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save code"}
          </button>
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
            setMode("view");
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
