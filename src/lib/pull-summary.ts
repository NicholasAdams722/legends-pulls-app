import type { PullLine } from "./types";

export function totalQuantity(lines: PullLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

// Compact human-readable breakdown:
//   soft goods, mixed: "W: S1 M3 2X1 / B: S1 L2 3X1"
//   soft goods, single color: "S1 M3 2X1"
//   hard goods: "9 pcs" (just rely on totalQuantity)
export function variantBreakdown(lines: PullLine[]): string {
  // Group by color
  const byColor = new Map<string, PullLine[]>();
  for (const l of lines) {
    const k = l.color ?? "";
    if (!byColor.has(k)) byColor.set(k, []);
    byColor.get(k)!.push(l);
  }

  const groups: string[] = [];
  for (const [color, group] of byColor.entries()) {
    const sized = group.filter((l) => l.size);
    const sizeStr = sized
      .map((l) => `${l.size}${l.quantity}`)
      .join(" ");
    if (color) {
      const abbr = color.charAt(0).toUpperCase();
      groups.push(sizeStr ? `${abbr}: ${sizeStr}` : abbr);
    } else if (sizeStr) {
      groups.push(sizeStr);
    }
  }

  return groups.join(" / ");
}
