export const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "2X", "3X", "4X"] as const;
export const DEFAULT_COLORS = ["White", "Black"] as const;

export function nextSize(current: string | null, options: string[]): string {
  if (!current) return options[0] ?? "";
  const i = options.indexOf(current);
  if (i === -1 || i === options.length - 1) return current;
  return options[i + 1];
}

export function nextSku(current: string | null): string {
  if (!current) return "";
  const n = parseInt(current, 10);
  if (Number.isNaN(n)) return current;
  return String(n + 1).padStart(5, "0");
}
