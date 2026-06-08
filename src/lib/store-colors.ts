// Per-store visual identity. Codes are intentionally hardcoded:
// Store 1, 2, 4 are the retail set; 0 is the warehouse. The codes are
// stable — if a new store is added later, add it here.

type StoreColor = {
  badge: string;     // pill background + text (worn next to "Store N")
  border: string;    // left border on cards
  filterActive: string; // filter chip when active
};

const FALLBACK: StoreColor = {
  badge: "bg-zinc-700 text-zinc-100",
  border: "border-l-zinc-600",
  filterActive: "bg-zinc-200 text-zinc-950 border-zinc-200",
};

const MAP: Record<number, StoreColor> = {
  1: {
    badge: "bg-emerald-500 text-emerald-950",
    border: "border-l-emerald-500",
    filterActive: "bg-emerald-500 text-emerald-950 border-emerald-500",
  },
  2: {
    badge: "bg-sky-400 text-sky-950",
    border: "border-l-sky-400",
    filterActive: "bg-sky-400 text-sky-950 border-sky-400",
  },
  4: {
    badge: "bg-amber-400 text-amber-950",
    border: "border-l-amber-400",
    filterActive: "bg-amber-400 text-amber-950 border-amber-400",
  },
  0: {
    badge: "bg-fuchsia-500 text-fuchsia-50",
    border: "border-l-fuchsia-500",
    filterActive: "bg-fuchsia-500 text-fuchsia-50 border-fuchsia-500",
  },
};

export function storeColor(code: number): StoreColor {
  return MAP[code] ?? FALLBACK;
}
