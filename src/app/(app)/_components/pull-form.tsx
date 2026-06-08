"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_COLORS,
  DEFAULT_SIZES,
  nextSize,
  nextSku,
} from "@/lib/sizes";
import type { GoodType, PullLine } from "@/lib/types";
import { BarcodeScanner } from "./barcode-scanner";

type Line = {
  key: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
};

export type EditablePull = {
  id: string;
  photo_urls: string[];
  style_name: string;
  good_type: GoodType;
  description: string | null;
  pull_lines: PullLine[];
};

function newKey() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyLine(): Line {
  return { key: newKey(), sku: "", color: "", size: "", quantity: 1 };
}

function linesFrom(pull: EditablePull): Line[] {
  if (pull.pull_lines.length === 0) return [emptyLine()];
  return pull.pull_lines.map((l) => ({
    key: newKey(),
    sku: l.sku,
    color: l.color ?? "",
    size: l.size ?? "",
    quantity: l.quantity,
  }));
}

export function PullForm({
  mode,
  userId,
  pull,
}: {
  mode: "create" | "edit";
  userId: string;
  pull?: EditablePull;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const draftId = useRef(pull?.id ?? crypto.randomUUID()).current;

  const [photos, setPhotos] = useState<{ url: string; path: string | null }[]>(
    pull?.photo_urls.map((url) => ({ url, path: null })) ?? [],
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [styleName, setStyleName] = useState(pull?.style_name ?? "");
  const [goodType, setGoodType] = useState<GoodType>(pull?.good_type ?? "soft");
  const [description, setDescription] = useState(pull?.description ?? "");
  const [colors, setColors] = useState<string[]>(() => {
    const seeded = new Set<string>(DEFAULT_COLORS);
    pull?.pull_lines.forEach((l) => l.color && seeded.add(l.color));
    return Array.from(seeded);
  });
  const [sizes, setSizes] = useState<string[]>(() => {
    const seeded = new Set<string>(DEFAULT_SIZES);
    pull?.pull_lines.forEach((l) => l.size && seeded.add(l.size));
    return Array.from(seeded);
  });
  const [lines, setLines] = useState<Line[]>(
    pull ? linesFrom(pull) : [emptyLine()],
  );
  const [scanningKey, setScanningKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((ls) => (ls.length <= 1 ? ls : ls.filter((l) => l.key !== key)));
  }
  function addLine() {
    const last = lines[lines.length - 1];
    setLines((ls) => [
      ...ls,
      {
        ...emptyLine(),
        sku: nextSku(last?.sku ?? ""),
        color: last?.color ?? "",
      },
    ]);
  }
  function duplicateLastLine() {
    const last = lines[lines.length - 1];
    if (!last) return addLine();
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        sku: nextSku(last.sku),
        color: last.color,
        size: goodType === "soft" ? nextSize(last.size, sizes) : "",
        quantity: 1,
      },
    ]);
  }
  function addColor(v: string) {
    const t = v.trim();
    if (t && !colors.includes(t)) setColors((c) => [...c, t]);
  }
  function addSize(v: string) {
    const t = v.trim();
    if (t && !sizes.includes(t)) setSizes((s) => [...s, t]);
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const uploaded: { url: string; path: string }[] = [];
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${userId}/${draftId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("pull-photos")
          .upload(path, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (upErr) {
          setError(`Upload failed: ${upErr.message}`);
          break;
        }
        const { data: pub } = supabase.storage
          .from("pull-photos")
          .getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, path });
      }
      setPhotos((p) => [...p, ...uploaded]);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function removePhoto(idx: number) {
    const photo = photos[idx];
    if (!photo) return;
    if (photo.path) {
      await supabase.storage.from("pull-photos").remove([photo.path]);
    }
    setPhotos((p) => p.filter((_, i) => i !== idx));
  }

  function validate(): string | null {
    if (photos.length === 0) return "Add at least one photo.";
    if (!styleName.trim()) return "Style name is required.";
    if (lines.length === 0) return "Add at least one line item.";
    for (const l of lines) {
      if (!/^\d{5}$/.test(l.sku))
        return `SKU "${l.sku || "(blank)"}" must be 5 digits.`;
      if (l.quantity < 1) return "Quantity must be at least 1.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        p_photo_urls: photos.map((p) => p.url),
        p_style_name: styleName,
        p_good_type: goodType,
        p_description: description,
        p_lines: lines.map((l) => ({
          sku: l.sku,
          color: l.color || null,
          size: goodType === "hard" ? null : l.size || null,
          quantity: l.quantity,
        })),
      };
      const { error: rpcErr } =
        mode === "create"
          ? await supabase.rpc("create_pull", payload)
          : await supabase.rpc("update_pull", {
              p_pull_id: pull!.id,
              ...payload,
            });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      router.push(mode === "create" ? "/feed" : "/pulls");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 pb-24 space-y-6">
      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Photos</h2>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={`${p.url}-${i}`} className="relative w-20 h-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="w-full h-full object-cover rounded-lg border border-zinc-800"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 text-xs"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 text-xs">
              {uploadingPhoto ? "…" : "+ Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={onPhotoPicked}
                className="hidden"
              />
            </label>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 block">
          Style name
        </label>
        <input
          required
          value={styleName}
          onChange={(e) => setStyleName(e.target.value)}
          placeholder='e.g. "Bar Hopping tee"'
          className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-2 pt-2">
          {(["soft", "hard"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setGoodType(t)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border ${
                goodType === t
                  ? "bg-zinc-50 text-zinc-950 border-zinc-50"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800"
              }`}
            >
              {t === "soft" ? "Clothing (sized)" : "Items"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400">
          Line items (SKU + qty)
        </h2>
        {lines.map((line, idx) => (
          <div
            key={line.key}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Line {idx + 1}</span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="text-red-400"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                placeholder="5-digit SKU"
                value={line.sku}
                onChange={(e) =>
                  updateLine(line.key, {
                    sku: e.target.value.replace(/\D/g, "").slice(0, 5),
                  })
                }
                className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-base tracking-wider focus:outline-none focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={() => setScanningKey(line.key)}
                className="h-11 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm"
              >
                Scan
              </button>
            </div>

            <ChipRow
              label="Color"
              options={colors}
              value={line.color}
              onPick={(v) => updateLine(line.key, { color: v })}
              onAdd={addColor}
            />

            {goodType === "soft" && (
              <ChipRow
                label="Size"
                options={sizes}
                value={line.size}
                onPick={(v) => updateLine(line.key, { size: v })}
                onAdd={addSize}
              />
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">Qty</span>
              <button
                type="button"
                onClick={() =>
                  updateLine(line.key, {
                    quantity: Math.max(1, line.quantity - 1),
                  })
                }
                className="w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-800 text-xl"
              >
                −
              </button>
              <input
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  updateLine(line.key, {
                    quantity: Number.isNaN(n) ? 1 : Math.max(1, n),
                  });
                }}
                className="w-16 h-11 text-center rounded-lg bg-zinc-900 border border-zinc-800 text-base"
              />
              <button
                type="button"
                onClick={() =>
                  updateLine(line.key, { quantity: line.quantity + 1 })
                }
                className="w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-800 text-xl"
              >
                +
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addLine}
            className="flex-1 h-11 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-medium"
          >
            + Add line
          </button>
          <button
            type="button"
            onClick={duplicateLastLine}
            className="flex-1 h-11 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-medium"
          >
            Duplicate last
          </button>
        </div>
      </section>

      <section>
        <label className="text-sm font-medium text-zinc-400 block mb-2">
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line note"
          maxLength={140}
          className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 px-4 text-base focus:outline-none focus:border-zinc-600"
        />
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 bg-zinc-950/95 backdrop-blur border-t border-zinc-900">
        <button
          type="submit"
          disabled={busy}
          className="w-full h-14 rounded-xl bg-emerald-500 text-zinc-950 text-base font-semibold disabled:opacity-50 active:scale-[0.99]"
        >
          {busy
            ? mode === "create"
              ? "Posting…"
              : "Saving…"
            : mode === "create"
              ? "Post pull"
              : "Save changes"}
        </button>
      </div>

      {scanningKey && (
        <BarcodeScanner
          onResult={(sku) => {
            updateLine(scanningKey, { sku });
            setScanningKey(null);
          }}
          onClose={() => setScanningKey(null)}
        />
      )}
    </form>
  );
}

function ChipRow({
  label,
  options,
  value,
  onPick,
  onAdd,
}: {
  label: string;
  options: string[];
  value: string;
  onPick: (v: string) => void;
  onAdd: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className={`h-9 px-3 rounded-full text-sm border ${
              value === opt
                ? "bg-zinc-50 text-zinc-950 border-zinc-50"
                : "bg-zinc-900 text-zinc-200 border-zinc-800"
            }`}
          >
            {opt}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft) {
                onAdd(draft);
                onPick(draft);
              }
              setDraft("");
              setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft) {
                  onAdd(draft);
                  onPick(draft);
                }
                setDraft("");
                setAdding(false);
              }
            }}
            className="h-9 w-20 rounded-full bg-zinc-900 border border-zinc-700 px-3 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-9 px-3 rounded-full text-sm border border-dashed border-zinc-700 text-zinc-400"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
