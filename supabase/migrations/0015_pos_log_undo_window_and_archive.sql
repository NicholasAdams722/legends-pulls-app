-- POS Log redesign: one-at-a-time logging with a short server-enforced undo
-- window, then a permanent lock, then a 24h move into a read-only archive.
--
-- Builds on 0013 (pos_log_entries + RLS + realtime + set_pos_log_entries).
-- Nothing here deletes history: "archived" is derived from entered_at age at
-- query time, so no cron/backfill is needed and an archived row is still a
-- plain pos_log_entries row.
--
-- Why derive instead of flagging: a boolean column would need a scheduled job
-- to flip it, would drift if that job failed, and would be a second source of
-- truth alongside entered_at. entered_at already carries everything needed, and
-- the archive cutoff is a *display* rule, not a state change. Deriving it also
-- means changing the window later is a one-line function edit, not a backfill.

-- ============================================================
-- Tunables. Defined once, in SQL, so the RPC guard, the archive
-- cutoff, and the UI countdown can never disagree: the client
-- reads both values from pos_log_settings() instead of
-- hardcoding them.
-- ============================================================
create or replace function pos_log_undo_window() returns interval
  language sql immutable
  as $$ select interval '60 seconds' $$;

create or replace function pos_log_archive_after() returns interval
  language sql immutable
  as $$ select interval '24 hours' $$;

-- server_now is returned alongside the windows so the client can correct for
-- device clock skew — a phone whose clock is 5 minutes fast must not decide on
-- its own that an item is still undoable (or already locked).
create or replace function pos_log_settings()
returns table (
  server_now timestamptz,
  undo_window_seconds int,
  archive_after_seconds int
)
language sql
stable
as $$
  select
    now(),
    extract(epoch from pos_log_undo_window())::int,
    extract(epoch from pos_log_archive_after())::int;
$$;

-- ============================================================
-- Log one line into the POS log.
--
-- Single-line only by design: "Check all" is gone, because bulk-checking a
-- batch you have not actually keyed into POS is exactly the mistake this log
-- exists to prevent.
--
-- Returns the authoritative entered_at plus the server clock so the client can
-- anchor its undo countdown to the server, not to the device.
-- ============================================================
create or replace function log_pos_entry(p_pull_line_id uuid)
returns table (
  entered_at timestamptz,
  server_now timestamptz,
  undo_window_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_store_id uuid;
  v_entered_at timestamptz;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;

  -- Only lines from a pull this store actually shipped belong on this store's
  -- POS log. sent_at (not status alone) is the shipped test: a pull can reach
  -- 'received' via the legacy claimed -> received path without ever shipping.
  select p.from_store_id into v_store_id
    from pull_lines l
    join pulls p on p.id = l.pull_id
   where l.id = p_pull_line_id
     and p.from_store_id = v_user.store_id
     and p.sent_at is not null
     and p.status in ('sent', 'received');
  if v_store_id is null then
    raise exception 'that line is not on your store''s POS log';
  end if;

  -- Idempotent: a double-tap (or a retry after a flaky response) must not
  -- restart the undo window by rewriting entered_at.
  insert into pos_log_entries (pull_line_id, store_id, entered_by)
  values (p_pull_line_id, v_store_id, v_user.id)
  on conflict (pull_line_id, store_id) do nothing;

  select e.entered_at into v_entered_at
    from pos_log_entries e
   where e.pull_line_id = p_pull_line_id
     and e.store_id = v_store_id;

  return query
    select v_entered_at, now(), extract(epoch from pos_log_undo_window())::int;
end;
$$;

-- ============================================================
-- Undo a log entry — allowed only inside the undo window.
--
-- The lock is enforced HERE, against entered_at and the database clock. The
-- client hides the Undo button once the window elapses, but that is only a
-- convenience: a stale tab, a replayed request, or a device with a wrong clock
-- still gets refused.
-- ============================================================
create or replace function unlog_pos_entry(p_pull_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_entry pos_log_entries;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into v_entry
    from pos_log_entries
   where pull_line_id = p_pull_line_id
     and store_id = v_user.store_id
   for update;

  -- Nothing logged, or another device already undid it. Idempotent success:
  -- the caller's desired end state (not logged) already holds.
  if not found then return; end if;

  if now() - v_entry.entered_at > pos_log_undo_window() then
    raise exception
      'Locked: this item was logged more than % seconds ago and can no longer be unchecked.',
      extract(epoch from pos_log_undo_window())::int;
  end if;

  delete from pos_log_entries where id = v_entry.id;
end;
$$;

-- ============================================================
-- 0013's set_pos_log_entries stays for the one-time localStorage import only.
--
-- Its delete branch is removed: it deleted entries with no age check, which
-- would be a hole straight through the undo-window lock. Unchecking now has
-- exactly one door, unlog_pos_entry().
-- ============================================================
create or replace function set_pos_log_entries(
  p_pull_line_ids uuid[],
  p_entered boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;

  if not p_entered then
    raise exception
      'Unchecking goes through unlog_pos_entry(), which enforces the undo window.';
  end if;

  insert into pos_log_entries (pull_line_id, store_id, entered_by)
  select l.id, p.from_store_id, v_user.id
    from pull_lines l
    join pulls p on p.id = l.pull_id
   where l.id = any(p_pull_line_ids)
     and p.from_store_id = v_user.store_id
     and p.sent_at is not null
     and p.status in ('sent', 'received')
  on conflict (pull_line_id, store_id) do nothing;
end;
$$;

-- ============================================================
-- One row per shippable POS-log line, with its destination store and its
-- current logged/archived state resolved server-side.
--
-- security_invoker keeps RLS honest: the pos_log_entries join is filtered by
-- that table's store-scoped policy, so a user can never read another store's
-- completion state through the view.
-- ============================================================
create or replace view pos_log_lines
with (security_invoker = on) as
select
  l.id                  as pull_line_id,
  p.id                  as pull_id,
  p.from_store_id,
  fs.code               as from_store_code,
  p.claimed_by_store_id as to_store_id,
  ts.code               as to_store_code,
  ts.name               as to_store_name,
  ts.type               as to_store_type,
  p.style_name,
  p.status,
  p.sent_at,
  l.sku,
  l.color,
  l.size,
  l.quantity,
  e.entered_at,
  eu.name               as entered_by_name,
  (
    e.entered_at is not null
    and now() - e.entered_at >= pos_log_archive_after()
  )                     as is_archived
from pull_lines l
join pulls  p  on p.id = l.pull_id
join stores fs on fs.id = p.from_store_id
left join stores ts on ts.id = p.claimed_by_store_id
left join pos_log_entries e
       on e.pull_line_id = l.id
      and e.store_id = p.from_store_id
left join users eu on eu.id = e.entered_by
-- sent_at is the "this store shipped it" test. Status 'received' is kept so a
-- line does not vanish from the to-log list the moment the destination store
-- taps Receive — the shipping store may not have keyed it into POS yet.
where p.sent_at is not null
  and p.status in ('sent', 'received');

grant select on pos_log_lines to anon, authenticated, service_role;

-- Supports both the is_archived split and the per-store entry lookup.
create index if not exists pos_log_entries_store_entered_idx
  on pos_log_entries (store_id, entered_at desc);

-- ============================================================
-- Rollback (run manually to undo this migration):
--
--   drop view if exists pos_log_lines;
--   drop index if exists pos_log_entries_store_entered_idx;
--   drop function if exists unlog_pos_entry(uuid);
--   drop function if exists log_pos_entry(uuid);
--   drop function if exists pos_log_settings();
--   drop function if exists pos_log_archive_after();
--   drop function if exists pos_log_undo_window();
--   -- then re-run the set_pos_log_entries() body from
--   -- 0013_pos_log_entries.sql to restore its delete branch.
--
-- No data is dropped by this rollback: pos_log_entries and every entered_at it
-- holds are untouched. Reverting only removes the derived view and the guards,
-- so the UI would fall back to 0013 behaviour.
--
-- To change the windows later, edit pos_log_undo_window() /
-- pos_log_archive_after() and nothing else — the RPC guard, the view's
-- is_archived, and the UI countdown all read through them.
-- ============================================================
