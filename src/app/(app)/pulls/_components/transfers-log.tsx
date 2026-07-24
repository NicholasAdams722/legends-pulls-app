"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { storeColor } from "@/lib/store-colors";
import {
  groupByDestination,
  rowState,
  splitActiveAndArchive,
  undoSecondsLeft,
  type PosLogRow,
  type PosLogSettings,
} from "@/lib/pos-log";
import { ClipboardIcon, EmptyState } from "../../_components/empty-state";

// Legacy per-device store of checked line ids, from before POS log state lived
// on the server. Read once to import into the server table, then left in place
// (non-destructive).
const LEGACY_LOGGED_KEY = "legends.pos-logged-line-ids";
const MIGRATED_KEY = "legends.pos-log-migrated";

type Tab = "todo" | "archive";
type Notice = { tone: "error" | "info"; text: string } | null;

export type EnteredEntry = { pull_line_id: string; entered_at: string };

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Read the legacy localStorage line ids (both the old array shape and the
// newer { [id]: checkedAtMs } object shape). Used only for the one-time import.
function readLegacyLoggedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_LOGGED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    if (parsed && typeof parsed === "object") return Object.keys(parsed);
    return [];
  } catch {
    return [];
  }
}

export function TransfersLog({
  storeId,
  activeRows,
  archiveRows,
  settings,
  loadError,
}: {
  storeId: string;
  activeRows: PosLogRow[];
  archiveRows: PosLogRow[];
  settings: PosLogSettings;
  loadError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("todo");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  // lineId -> entered_at (ISO), sourced from the server and kept live via
  // realtime. Single source of truth for "this has been logged".
  const [entered, setEntered] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const r of [...activeRows, ...archiveRows]) {
      if (r.entered_at) map.set(r.pull_line_id, r.entered_at);
    }
    return map;
  });

  // Device clocks lie. Everything time-based is computed against the database
  // clock: offset = device - server, refreshed on every successful log.
  const offsetRef = useRef(0);
  // null until mounted — rowState() treats that as "locked", so a stale Undo
  // button can never render before the clock is trusted.
  const [nowMs, setNowMs] = useState<number | null>(null);

  const syncNow = useCallback(() => {
    setNowMs(Date.now() - offsetRef.current);
  }, []);

  // Resync from server truth when the page passes new data (e.g. navigating
  // back to POS Log).
  const rowsRef = useRef(activeRows);
  useEffect(() => {
    if (activeRows === rowsRef.current) return;
    rowsRef.current = activeRows;
    setEntered(() => {
      const map = new Map<string, string>();
      for (const r of [...activeRows, ...archiveRows]) {
        if (r.entered_at) map.set(r.pull_line_id, r.entered_at);
      }
      return map;
    });
  }, [activeRows, archiveRows]);

  useEffect(() => {
    const parsed = settings.serverNow ? Date.parse(settings.serverNow) : NaN;
    offsetRef.current = Number.isFinite(parsed) ? Date.now() - parsed : 0;
    setNowMs(Date.now() - offsetRef.current);
  }, [settings.serverNow]);

  // Anything still inside its undo window needs a per-second countdown; the
  // rest of the time a slow tick is enough to move rows into the archive.
  const hasCountdown = useMemo(() => {
    if (nowMs === null) return false;
    for (const at of entered.values()) {
      if (nowMs - Date.parse(at) <= settings.undoWindowSeconds * 1000) return true;
    }
    return false;
  }, [entered, nowMs, settings.undoWindowSeconds]);

  useEffect(() => {
    const id = setInterval(
      () => setNowMs(Date.now() - offsetRef.current),
      hasCountdown ? 500 : 20_000,
    );
    return () => clearInterval(id);
  }, [hasCountdown]);

  // Realtime: keep every device at this store in sync as lines are logged or
  // undone. FULL replica identity means DELETE payloads still carry
  // pull_line_id.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("pos-log-entries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pos_log_entries",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as EnteredEntry;
          setEntered((prev) => {
            const next = new Map(prev);
            next.set(row.pull_line_id, row.entered_at);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pos_log_entries",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const old = payload.old as { pull_line_id?: string };
          if (!old.pull_line_id) return;
          setEntered((prev) => {
            if (!prev.has(old.pull_line_id!)) return prev;
            const next = new Map(prev);
            next.delete(old.pull_line_id!);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // One-time, non-destructive import of any pre-existing localStorage marks
  // into the server table. Runs once per device; leaves the old key in place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(MIGRATED_KEY) === "1") return;
    const legacyIds = readLegacyLoggedIds();
    // Mark migrated up front so this never runs twice, even if the import
    // below fails — the worst case is a user re-checks a few rows by hand.
    window.localStorage.setItem(MIGRATED_KEY, "1");
    if (legacyIds.length === 0) return;

    const supabase = createSupabaseBrowserClient();
    // The RPC ignores ids that don't belong to this store / weren't shipped,
    // so it's safe to send everything the browser had stored.
    supabase
      .rpc("set_pos_log_entries", {
        p_pull_line_ids: legacyIds,
        p_entered: true,
      })
      .then(({ error }) => {
        if (error) return;
        // Optimistically reflect any imported ids that are in the current view;
        // realtime will fill in the rest.
        const now = new Date(Date.now() - offsetRef.current).toISOString();
        setEntered((prev) => {
          const next = new Map(prev);
          for (const id of legacyIds) if (!next.has(id)) next.set(id, now);
          return next;
        });
      });
  }, []);

  const markBusy = useCallback((lineId: string, on: boolean) => {
    setBusy((prev) => {
      if (prev.has(lineId) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }, []);

  // LOG: optimistic, because the tap needs to feel instant while the manager is
  // keying into POS. Rolled back if the server rejects it.
  const logRow = useCallback(
    async (lineId: string) => {
      if (busy.has(lineId) || entered.has(lineId)) return;
      markBusy(lineId, true);
      setNotice(null);
      const optimisticAt = new Date(Date.now() - offsetRef.current).toISOString();
      setEntered((prev) => new Map(prev).set(lineId, optimisticAt));
      syncNow();

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("log_pos_entry", {
        p_pull_line_id: lineId,
      });
      markBusy(lineId, false);

      if (error) {
        setEntered((prev) => {
          const next = new Map(prev);
          next.delete(lineId);
          return next;
        });
        setNotice({ tone: "error", text: error.message });
        return;
      }

      const row = (data as { entered_at: string; server_now: string }[] | null)?.[0];
      if (!row) return;
      // Re-anchor to the database clock and use its entered_at, so the undo
      // countdown matches what unlog_pos_entry() will actually enforce.
      const serverNow = Date.parse(row.server_now);
      if (Number.isFinite(serverNow)) offsetRef.current = Date.now() - serverNow;
      setEntered((prev) => new Map(prev).set(lineId, row.entered_at));
      syncNow();
    },
    [busy, entered, markBusy, syncNow],
  );

  // UNDO: not optimistic. The server decides whether the window is still open,
  // and the checkbox must not flicker off for something that stays logged.
  const undoRow = useCallback(
    async (lineId: string) => {
      if (busy.has(lineId)) return;
      markBusy(lineId, true);
      setNotice(null);

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("unlog_pos_entry", {
        p_pull_line_id: lineId,
      });
      markBusy(lineId, false);

      if (error) {
        setNotice({ tone: "error", text: error.message });
        syncNow();
        return;
      }
      setEntered((prev) => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
      syncNow();
    },
    [busy, markBusy, syncNow],
  );

  const { toLog, archived } = useMemo(
    () => splitActiveAndArchive(activeRows, archiveRows, entered, nowMs, settings),
    [activeRows, archiveRows, entered, nowMs, settings],
  );

  const groups = useMemo(
    () => groupByDestination(toLog, entered),
    [toLog, entered],
  );

  const remaining = useMemo(
    () => toLog.reduce((n, r) => n + (entered.has(r.pull_line_id) ? 0 : 1), 0),
    [toLog, entered],
  );

  function exportCsv() {
    const rows = tab === "todo" ? toLog : archived;
    const header = [
      "shipped_at",
      "from_store",
      "to_store",
      "style",
      "sku",
      "color",
      "size",
      "qty",
      "pos_logged_at",
      "pos_logged_by",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.sent_at,
          r.from_store_code,
          r.to_store_code ?? "",
          r.style_name,
          r.sku,
          r.color ?? "",
          r.size ?? "",
          r.quantity,
          entered.get(r.pull_line_id) ?? "",
          r.entered_by_name ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legends-pos-log-${tab}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-start gap-2.5">
          <WarningIcon />
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-wide text-amber-900">
              Log into POS
            </div>
            <p className="text-sm text-amber-900 mt-0.5 leading-snug">
              Work one destination store at a time. Enter a transfer into POS,
              then check off that one row. You have{" "}
              {settings.undoWindowSeconds} seconds to undo a mistake — after
              that the row locks so the log stays trustworthy. Logged rows stay
              visible here for 24 hours, then move to the Archive.
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-sm text-red-900">
          <b>POS Log could not load.</b> {loadError}
        </div>
      )}

      <div className="px-4 py-3 flex gap-2 border-b border-zinc-200 overflow-x-auto">
        <TabButton
          active={tab === "todo"}
          onClick={() => setTab("todo")}
          label={remaining > 0 ? `To log (${remaining})` : "To log"}
        />
        <TabButton
          active={tab === "archive"}
          onClick={() => setTab("archive")}
          label={`Archive${archived.length ? ` (${archived.length})` : ""}`}
        />
        <button
          onClick={exportCsv}
          disabled={(tab === "todo" ? toLog : archived).length === 0}
          className="ml-auto shrink-0 h-11 px-4 rounded-full text-sm font-semibold bg-zinc-900 text-white disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {notice && (
        <div
          role="alert"
          className={`px-4 py-3 border-b flex items-start gap-3 ${
            notice.tone === "error"
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-zinc-50 border-zinc-200 text-zinc-800"
          }`}
        >
          <div className="text-sm font-semibold flex-1">{notice.text}</div>
          <button
            onClick={() => setNotice(null)}
            className="text-sm font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === "todo" ? (
        groups.length === 0 ? (
          archived.length > 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-lg font-bold text-zinc-900">
                Everything is logged.
              </div>
              <p className="text-base text-zinc-600 mt-2">
                Shipped transfers show up here automatically. Past entries live
                in the Archive.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardIcon />}
              title="Nothing to log yet"
              body="Once you mark a tote Shipped in the Ship tab, every line on it lands here, grouped by the store it's going to. Enter one into POS, then check off that one row."
            />
          )
        ) : (
          <div>
            {groups.map((group) => {
              const color = storeColor(group.code ?? -1);
              const left = group.rows.length - group.loggedCount;
              return (
                <section key={group.key}>
                  <div className="sticky top-0 z-10 px-4 py-2.5 bg-zinc-100/95 backdrop-blur border-y border-zinc-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${color.badge}`}
                      >
                        {group.label}
                      </span>
                      {group.rows[0]?.to_store_name && (
                        <span className="text-sm text-zinc-600 truncate">
                          {group.rows[0].to_store_name}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-zinc-700">
                      {left > 0 ? `${left} left` : "done"}
                    </span>
                  </div>
                  <ul className="divide-y divide-zinc-200">
                    {group.rows.map((row) => (
                      <LogRow
                        key={row.pull_line_id}
                        row={row}
                        enteredAt={entered.get(row.pull_line_id) ?? null}
                        nowMs={nowMs}
                        settings={settings}
                        busy={busy.has(row.pull_line_id)}
                        onLog={logRow}
                        onUndo={undoRow}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : archived.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon />}
          title="Archive is empty"
          body="Transfers move here 24 hours after you log them. Nothing is ever deleted — this is the permanent record of what was entered into POS."
        />
      ) : (
        <div>
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-sm text-zinc-700">
            Read-only. Logged more than 24 hours ago.
          </div>
          <ul className="divide-y divide-zinc-200">
            {archived.map((row) => (
              <ArchiveRow
                key={row.pull_line_id}
                row={row}
                enteredAt={entered.get(row.pull_line_id) ?? row.entered_at}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 h-11 px-4 rounded-full text-sm font-semibold border ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function LogRow({
  row,
  enteredAt,
  nowMs,
  settings,
  busy,
  onLog,
  onUndo,
}: {
  row: PosLogRow;
  enteredAt: string | null;
  nowMs: number | null;
  settings: PosLogSettings;
  busy: boolean;
  onLog: (lineId: string) => void;
  onUndo: (lineId: string) => void;
}) {
  const state = rowState(enteredAt, nowMs, settings);
  const dimmed = state !== "todo";

  const body = (
    <div className={`flex-1 min-w-0 ${dimmed ? "opacity-55" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div
          className={`text-base font-mono font-semibold text-zinc-900 ${
            dimmed ? "line-through" : ""
          }`}
        >
          {row.sku}
          {(row.color || row.size) && (
            <span className="text-zinc-500 font-normal">
              {" "}
              ({[row.color, row.size].filter(Boolean).join("/")})
            </span>
          )}
        </div>
        <div
          className={`text-lg font-bold text-zinc-900 ${
            dimmed ? "line-through" : ""
          }`}
        >
          ×{row.quantity}
        </div>
      </div>
      <div className="text-sm text-zinc-500 mt-1 truncate">{row.style_name}</div>
      <div className="text-xs text-zinc-500 mt-1">
        Shipped {shortTime(row.sent_at)}
      </div>
    </div>
  );

  if (state === "todo") {
    return (
      <li>
        <button
          type="button"
          onClick={() => onLog(row.pull_line_id)}
          disabled={busy}
          className="w-full px-4 py-3 flex gap-3 items-start text-left bg-white active:bg-zinc-100 disabled:opacity-60"
        >
          <Checkbox checked={false} />
          {body}
        </button>
      </li>
    );
  }

  return (
    <li className="px-4 py-3 bg-zinc-50">
      <div className="flex gap-3 items-start">
        <Checkbox checked />
        {body}
      </div>
      <div className="mt-2 pl-10 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5 min-w-0">
          {state === "locked" && <LockIcon />}
          <span className="truncate">
            Logged{enteredAt ? ` ${shortTime(enteredAt)}` : ""}
            {row.entered_by_name ? ` · ${row.entered_by_name}` : ""}
          </span>
        </div>
        {state === "undoable" && enteredAt && nowMs !== null && (
          <button
            type="button"
            onClick={() => onUndo(row.pull_line_id)}
            disabled={busy}
            className="shrink-0 h-9 px-3 rounded-full text-xs font-bold bg-white text-zinc-900 border border-zinc-400 active:bg-zinc-100 disabled:opacity-50"
          >
            Undo ({undoSecondsLeft(enteredAt, nowMs, settings)}s)
          </button>
        )}
      </div>
    </li>
  );
}

function ArchiveRow({
  row,
  enteredAt,
}: {
  row: PosLogRow;
  enteredAt: string | null;
}) {
  const color = storeColor(row.to_store_code ?? -1);
  return (
    <li className="px-4 py-3 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-mono font-semibold text-zinc-700">
          {row.sku}
          {(row.color || row.size) && (
            <span className="text-zinc-500 font-normal">
              {" "}
              ({[row.color, row.size].filter(Boolean).join("/")})
            </span>
          )}
        </div>
        <div className="text-base font-bold text-zinc-700">×{row.quantity}</div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${color.badge}`}
        >
          {row.to_store_code === null
            ? "Unassigned"
            : row.to_store_type === "warehouse"
              ? `Warehouse (${row.to_store_code})`
              : `Store ${row.to_store_code}`}
        </span>
        <span className="text-xs text-zinc-500">
          Logged{enteredAt ? ` ${shortTime(enteredAt)}` : ""}
          {row.entered_by_name ? ` · ${row.entered_by_name}` : ""}
        </span>
      </div>
      <div className="text-sm text-zinc-500 mt-1 truncate">{row.style_name}</div>
    </li>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center mt-0.5 ${
        checked
          ? "bg-emerald-500 border-emerald-500"
          : "bg-white border-zinc-400"
      }`}
      aria-hidden
    >
      {checked && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 mt-0.5 text-amber-700"
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
