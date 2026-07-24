-- Keep a passed pull on the passing store's feed (marked "Passed") instead of
-- hiding it, and let that store change its mind. Two RPC changes plus a small
-- replica-identity tweak so undo-pass propagates over realtime.
--
-- 1. claim_pull: a store can now claim a pull it previously passed on. Claiming
--    clears (supersedes) that store's own pass so the consensus count no longer
--    treats them as having passed. The existing `status = 'available'` guard is
--    kept, so a pull that has already routed to the warehouse (to_warehouse) or
--    been claimed by someone else still cannot be claimed.
-- 2. unpass_pull: new "Undo pass" action, mirroring unclaim_pull. Only the
--    passing store can undo, and only while the pull is still 'available'. Once
--    peer consensus has routed the pull to the warehouse it is out of the
--    store's hands, so undo (like claim) is intentionally blocked.
-- 3. pull_passes replica identity full: DELETE realtime payloads otherwise carry
--    only the primary key, so the feed's per-store filter (store_id=eq.…) would
--    never match an undo-pass delete on other devices. FULL includes store_id
--    and pull_id in the old record.
--
-- Rollback: `claim_pull` and `unpass_pull` are `create or replace`; to revert,
-- restore claim_pull from 0005 (drop the delete-from-pull_passes line) and
-- `drop function unpass_pull(uuid);`. `replica identity full` can be reverted
-- with `alter table pull_passes replica identity default;` (no data change).

-- claim_pull: allow claiming a previously-passed pull; clear this store's pass.
create or replace function claim_pull(p_pull_id uuid)
returns pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_pull pulls;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user.role not in ('manager', 'admin') then
    raise exception 'only managers or admins can claim';
  end if;

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.status <> 'available' then raise exception 'pull is no longer available'; end if;
  if v_pull.from_store_id = v_user.store_id then
    raise exception 'cannot claim your own store''s pull';
  end if;

  -- If this store had passed on the pull, claiming supersedes that pass so the
  -- consensus count in pass_pull no longer counts them as having passed.
  delete from pull_passes
    where pull_id = p_pull_id and store_id = v_user.store_id;

  update pulls
     set status = 'claimed',
         claimed_by_store_id = v_user.store_id,
         claimed_by_user_id = v_user.id,
         claimed_at = now()
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;

-- unpass_pull: undo a pass while the pull is still available. Mirrors
-- unclaim_pull. Deleting the pass row drops the consensus count back down, so
-- the pull simply stays available for this store (and its peers).
create or replace function unpass_pull(p_pull_id uuid)
returns pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_pull pulls;
  v_deleted int;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user.role not in ('manager', 'admin') then
    raise exception 'only managers or admins can undo a pass';
  end if;

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.status <> 'available' then
    raise exception 'can only undo a pass while the pull is still available';
  end if;

  delete from pull_passes
    where pull_id = p_pull_id and store_id = v_user.store_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'your store has not passed on this pull';
  end if;

  return v_pull;
end;
$$;

-- Surface store_id/pull_id in DELETE realtime payloads so the feed's
-- per-store pass filter matches undo-pass deletes on other devices.
alter table pull_passes replica identity full;
