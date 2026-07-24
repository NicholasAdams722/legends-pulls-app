// Pure derivation rules for the POS Log. Kept out of the component so the
// lifecycle (to log -> undoable -> locked -> archived) and the
// group-by-destination-store batching can be reasoned about — and tested —
// without React or Supabase in the way.
//
// The server is the authority for all of this: entered_at comes from the
// database, the windows come from pos_log_settings(), and unlog_pos_entry()
// re-checks the undo window before it deletes anything. What is below only
// decides what the screen shows.

export type PosLogRow = {
  pull_line_id: string;
  pull_id: string;
  from_store_id: string;
  from_store_code: number;
  to_store_id: string | null;
  to_store_code: number | null;
  to_store_name: string | null;
  to_store_type: "retail" | "warehouse" | null;
  style_name: string;
  status: "sent" | "received";
  sent_at: string;
  sku: string;
  color: string | null;
  size: string | null;
  quantity: number;
  entered_at: string | null;
  entered_by_name: string | null;
  is_archived: boolean;
};

export type PosLogSettings = {
  /** Database clock at page render, used to correct device clock skew. */
  serverNow: string;
  undoWindowSeconds: number;
  archiveAfterSeconds: number;
};

export const DEFAULT_SETTINGS: PosLogSettings = {
  serverNow: "",
  undoWindowSeconds: 60,
  archiveAfterSeconds: 24 * 60 * 60,
};

/**
 * "todo"     — not yet entered into POS. The only tappable state.
 * "undoable" — just logged; still inside the undo window.
 * "locked"   — logged and past the undo window. Stays visible, greyed, and
 *              cannot be unchecked (the server refuses too).
 * "archived" — logged more than 24h ago. Leaves the working list for the
 *              read-only archive. Never deleted.
 */
export type RowState = "todo" | "undoable" | "locked" | "archived";

export function rowState(
  enteredAt: string | null | undefined,
  nowMs: number | null,
  settings: PosLogSettings,
): RowState {
  if (!enteredAt) return "todo";
  // Before the clock is trusted (pre-hydration) assume locked rather than
  // undoable: showing a dead Undo button is worse than showing none.
  if (nowMs === null) return "locked";
  const age = nowMs - Date.parse(enteredAt);
  if (age >= settings.archiveAfterSeconds * 1000) return "archived";
  if (age <= settings.undoWindowSeconds * 1000) return "undoable";
  return "locked";
}

/** Whole seconds of undo left, floored at 0. */
export function undoSecondsLeft(
  enteredAt: string,
  nowMs: number,
  settings: PosLogSettings,
): number {
  const left = settings.undoWindowSeconds * 1000 - (nowMs - Date.parse(enteredAt));
  return Math.max(0, Math.ceil(left / 1000));
}

export type DestinationGroup = {
  key: string;
  code: number | null;
  label: string;
  rows: PosLogRow[];
  loggedCount: number;
};

export function destinationLabel(row: {
  to_store_code: number | null;
  to_store_name: string | null;
  to_store_type: "retail" | "warehouse" | null;
}): string {
  if (row.to_store_code === null) return "Unassigned";
  if (row.to_store_type === "warehouse") return `Warehouse (${row.to_store_code})`;
  return `Store ${row.to_store_code}`;
}

/**
 * Batching view: one section per destination store, ascending by store code,
 * oldest shipment first inside each section. That is the order the manager
 * actually works — every transfer going to store 1, then every one to store 2.
 */
export function groupByDestination(
  rows: PosLogRow[],
  entered: ReadonlyMap<string, string>,
): DestinationGroup[] {
  const groups = new Map<string, DestinationGroup>();
  for (const row of rows) {
    const key = row.to_store_id ?? "unassigned";
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        code: row.to_store_code,
        label: destinationLabel(row),
        rows: [],
        loggedCount: 0,
      };
      groups.set(key, group);
    }
    group.rows.push(row);
    if (entered.has(row.pull_line_id)) group.loggedCount += 1;
  }

  const out = [...groups.values()];
  out.sort((a, b) => {
    if (a.code === null) return 1;
    if (b.code === null) return -1;
    return a.code - b.code;
  });
  for (const group of out) {
    group.rows.sort((a, b) => {
      const ta = Date.parse(a.sent_at);
      const tb = Date.parse(b.sent_at);
      if (ta !== tb) return ta - tb; // oldest first
      if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
      return a.pull_line_id.localeCompare(b.pull_line_id);
    });
  }
  return out;
}

/**
 * Splits the freshly-fetched rows into the working list and the archive.
 *
 * The server already split them with the view's is_archived, but a row can
 * cross the 24h line while the page sits open, so the split is recomputed from
 * the live entered_at map on every tick. `archiveRows` is merged in and
 * deduped by line id.
 */
export function splitActiveAndArchive(
  activeRows: PosLogRow[],
  archiveRows: PosLogRow[],
  entered: ReadonlyMap<string, string>,
  nowMs: number | null,
  settings: PosLogSettings,
): { toLog: PosLogRow[]; archived: PosLogRow[] } {
  const toLog: PosLogRow[] = [];
  const archived: PosLogRow[] = [];
  const seen = new Set<string>();

  for (const row of activeRows) {
    seen.add(row.pull_line_id);
    const state = rowState(entered.get(row.pull_line_id), nowMs, settings);
    if (state === "archived") archived.push(row);
    else toLog.push(row);
  }

  for (const row of archiveRows) {
    if (seen.has(row.pull_line_id)) continue;
    seen.add(row.pull_line_id);
    // An archived row can come back if someone unlogged it on another device
    // inside its undo window (rare, but the realtime DELETE is authoritative).
    const state = rowState(entered.get(row.pull_line_id), nowMs, settings);
    if (state === "archived") archived.push(row);
    else toLog.push(row);
  }

  archived.sort((a, b) => {
    const ta = Date.parse(entered.get(a.pull_line_id) ?? a.entered_at ?? "");
    const tb = Date.parse(entered.get(b.pull_line_id) ?? b.entered_at ?? "");
    return (tb || 0) - (ta || 0); // most recently logged first
  });

  return { toLog, archived };
}
