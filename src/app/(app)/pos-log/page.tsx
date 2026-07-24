import { requireAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type PosLogRow, type PosLogSettings } from "@/lib/pos-log";
import { TransfersLog } from "../pulls/_components/transfers-log";

export const dynamic = "force-dynamic";

// Generous, but bounded. The working list is everything this store shipped and
// hasn't logged (plus the last 24h of logged rows); the archive is capped at
// the most recent slice rather than the whole history.
const ACTIVE_LIMIT = 1000;
const ARCHIVE_LIMIT = 500;

export default async function PosLogPage() {
  const { store } = await requireAppUser();
  const supabase = await createSupabaseServerClient();

  // pos_log_lines (migration 0015) is one row per shipped line, with the
  // destination store and the logged/archived state resolved server-side.
  // is_archived is derived from entered_at age at query time — no cron, and an
  // archived row is still a plain pos_log_entries row.
  const base = () =>
    supabase.from("pos_log_lines").select("*").eq("from_store_id", store.id);

  const [settingsRes, activeRes, archiveRes] = await Promise.all([
    supabase.rpc("pos_log_settings"),
    base()
      .eq("is_archived", false)
      // Group order and within-group order both come from the database, so the
      // client only has to slice the list, never re-sort it.
      .order("to_store_code", { ascending: true, nullsFirst: false })
      .order("sent_at", { ascending: true })
      .order("sku", { ascending: true })
      .limit(ACTIVE_LIMIT),
    base()
      .eq("is_archived", true)
      .order("entered_at", { ascending: false })
      .limit(ARCHIVE_LIMIT),
  ]);

  const settingsRow = (
    settingsRes.data as
      | {
          server_now: string;
          undo_window_seconds: number;
          archive_after_seconds: number;
        }[]
      | null
  )?.[0];

  const settings: PosLogSettings = settingsRow
    ? {
        serverNow: settingsRow.server_now,
        undoWindowSeconds: settingsRow.undo_window_seconds,
        archiveAfterSeconds: settingsRow.archive_after_seconds,
      }
    : // Migration not applied yet: fall back to the same values 0015 defines so
      // the page still renders instead of blowing up.
      { ...DEFAULT_SETTINGS, serverNow: new Date().toISOString() };

  const loadError =
    activeRes.error?.message ?? archiveRes.error?.message ?? null;

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-zinc-900">POS Log</h1>
      </div>
      <TransfersLog
        storeId={store.id}
        activeRows={(activeRes.data ?? []) as PosLogRow[]}
        archiveRows={(archiveRes.data ?? []) as PosLogRow[]}
        settings={settings}
        loadError={loadError}
      />
    </div>
  );
}
