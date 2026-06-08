"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Store, UserRole } from "@/lib/types";
import { addUserAction } from "../actions";

export function AddUserForm({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [role, setRole] = useState<UserRole>("manager");

  function reset() {
    setName("");
    setEmail("");
    setStoreId(stores[0]?.id ?? "");
    setRole("manager");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addUserAction({ name, email, store_id: storeId, role });
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-12 rounded-lg bg-emerald-500 text-zinc-950 font-semibold"
      >
        + Add team member
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <input
        required
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base"
      />
      <input
        required
        type="email"
        placeholder="email@example.com"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base"
      />
      <select
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
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
        className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base"
      >
        <option value="manager">Manager</option>
        <option value="warehouse">Warehouse</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={pending}
          className="flex-1 h-12 rounded-lg bg-zinc-900 border border-zinc-800 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-12 rounded-lg bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
    </form>
  );
}
