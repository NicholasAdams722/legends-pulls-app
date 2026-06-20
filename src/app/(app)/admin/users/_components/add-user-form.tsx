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
  const [code, setCode] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [role, setRole] = useState<UserRole>("manager");

  function reset() {
    setName("");
    setCode("");
    setStoreId(stores[0]?.id ?? "");
    setRole("manager");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addUserAction({ name, code, store_id: storeId, role });
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
        className="w-full h-12 rounded-lg bg-emerald-500 text-white font-semibold"
      >
        + Add team member
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
    >
      <input
        required
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-4 text-base"
      />
      <input
        required
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="4-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-4 text-base tracking-widest text-center"
      />
      <select
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-3 text-base"
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
        className="w-full h-12 rounded-lg bg-white border border-zinc-300 px-3 text-base"
      >
        <option value="manager">Manager</option>
        <option value="warehouse">Warehouse</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={pending}
          className="flex-1 h-12 rounded-lg bg-white border border-zinc-300 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-12 rounded-lg bg-emerald-500 text-white font-semibold disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
    </form>
  );
}
