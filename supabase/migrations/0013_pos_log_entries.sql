-- Persist the POS "entered" checkmark server-side so every device at a store
-- sees the same completion status. Previously this lived only in each browser's
-- localStorage, so a line checked off on one phone still looked un-entered on
-- another. This mirrors the pulls workflow: a small log table with RLS scoped
-- to the user's store, plus a SECURITY DEFINER RPC that gates writes by store.

-- ============================================================
-- Table: one row per (pull_line, store) that has been entered into POS.
-- Scoped per store even though a pull_line already maps 1:1 to a store, so the
-- RLS predicates and realtime filters can key off store_id directly.
-- ============================================================
create table if not exists pos_log_entries (
  id uuid primary key default gen_random_uuid(),
  pull_line_id uuid not null references pull_lines(id) on delete cascade,
  store_id uuid not null references stores(id),
  entered_by uuid not null references users(id),
  entered_at timestamptz not null default now(),
  unique (pull_line_id, store_id)
);
create index if not exists pos_log_entries_store_idx on pos_log_entries(store_id);
create index if not exists pos_log_entries_line_idx on pos_log_entries(pull_line_id);

-- DELETE events over realtime only carry the primary key by default, but the
-- client needs pull_line_id + store_id (to update its map and to match the
-- store filter). FULL replica identity ships the whole old row on delete.
alter table pos_log_entries replica identity full;

-- ============================================================
-- RLS: a store can only see its own POS-log completion state.
-- Writes go through set_pos_log_entries() (SECURITY DEFINER), matching how
-- pull_passes is read-only via RLS and mutated only through pass_pull().
-- ============================================================
alter table pos_log_entries enable row level security;

drop policy if exists pos_log_entries_read on pos_log_entries;
create policy pos_log_entries_read on pos_log_entries for select
  using (store_id = (select store_id from users where id = auth.uid()));

-- ============================================================
-- RPC: toggle POS-entered state for one or many lines at once.
-- Array-shaped so it backs both the single-row tap and the "Check all" button,
-- and the one-time localStorage->server import, in a single round trip.
-- Only lines whose pull originated at the caller's store and are already
-- shipped/received are affected; anything else is silently ignored (safe for
-- the bulk import, which may include stale ids).
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

  if p_entered then
    insert into pos_log_entries (pull_line_id, store_id, entered_by)
    select l.id, p.from_store_id, v_user.id
      from pull_lines l
      join pulls p on p.id = l.pull_id
     where l.id = any(p_pull_line_ids)
       and p.from_store_id = v_user.store_id
       and p.status in ('sent', 'received')
    on conflict (pull_line_id, store_id) do nothing;
  else
    delete from pos_log_entries e
     using pull_lines l, pulls p
     where e.pull_line_id = any(p_pull_line_ids)
       and e.store_id = v_user.store_id
       and l.id = e.pull_line_id
       and p.id = l.pull_id
       and p.from_store_id = v_user.store_id;
  end if;
end;
$$;

-- ============================================================
-- Realtime: broadcast inserts/deletes so all of a store's devices stay in sync.
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table pos_log_entries;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Rollback (run manually to undo this migration):
--
--   do $$ begin
--     alter publication supabase_realtime drop table pos_log_entries;
--   exception when others then null; end $$;
--   drop function if exists set_pos_log_entries(uuid[], boolean);
--   drop table if exists pos_log_entries;
--
-- Dropping the table permanently discards completion history, so only do this
-- if you are intentionally reverting the feature.
-- ============================================================
