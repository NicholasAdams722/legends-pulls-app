-- Manual "Ship to warehouse": let a store send its OWN unclaimed pulls straight
-- to the warehouse, with no claim/pack/receive step from the warehouse side.
--
-- Why: until the warehouse manager is onboarded onto the app, a store manager
-- needs to be able to clear stock into the warehouse on their own — e.g. sending
-- shirts back to free up the back room. This is a stopgap path that a single
-- actor (the shipping store) both initiates and completes.
--
-- How it flows into the rest of the app, with no new states or columns:
--   * destination = the warehouse store in the SAME category as the shipping
--     store (production stores -> the production warehouse, demo -> demo). This
--     is exactly the store pass_pull() routes consensus handoffs to, so the POS
--     log's destination grouping (which keys off claimed_by_store_id) already
--     renders it as the "Warehouse (0)" group with zero UI changes.
--   * status -> 'sent' with sent_at/packed_at stamped, identical to a normal
--     shipment, so pos_log_lines (status in ('sent','received') and sent_at not
--     null) picks it up automatically.
--
-- This does NOT touch the consensus to_warehouse routing in pass_pull(). That
-- path still moves available pulls to status='to_warehouse' when every peer
-- store has passed. The two never collide: this RPC only acts on 'available'
-- pulls and moves them to 'sent', so a pull is only ever on one path at a time.

create or replace function ship_pulls_to_warehouse(p_pull_ids uuid[])
returns setof pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_warehouse_id uuid;
  v_category text;
  v_eligible int;
  v_requested int;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user.role not in ('manager', 'admin') then
    raise exception 'only managers or admins can ship to the warehouse';
  end if;

  if p_pull_ids is null or array_length(p_pull_ids, 1) is null then
    raise exception 'no pulls selected';
  end if;

  -- The warehouse must be in the shipping store's own category so demo activity
  -- never lands in the real warehouse and vice versa.
  select category into v_category from stores where id = v_user.store_id;
  select id into v_warehouse_id
    from stores
   where type = 'warehouse'
     and category = v_category
   order by code
   limit 1;
  if v_warehouse_id is null then
    raise exception 'no warehouse configured for this store''s category';
  end if;

  -- Strict, all-or-nothing validation: every selected id must be owned by this
  -- store AND still available. If even one isn't (wrong store, already claimed,
  -- already shipped, unknown id), reject the whole batch so the manager gets a
  -- clear signal rather than a silent partial ship. distinct guards against a
  -- duplicated id inflating the count.
  v_requested := (select count(distinct x) from unnest(p_pull_ids) as x);
  select count(*) into v_eligible
    from pulls
   where id = any(p_pull_ids)
     and from_store_id = v_user.store_id
     and status = 'available';

  if v_eligible <> v_requested then
    raise exception
      'can only ship your own store''s available pulls (% of % selected are eligible)',
      v_eligible, v_requested;
  end if;

  return query
    update pulls
       set status              = 'sent',
           claimed_by_store_id = v_warehouse_id,
           claimed_by_user_id  = null,
           claimed_at          = now(),
           packed_at           = now(),
           sent_at             = now()
     where id = any(p_pull_ids)
       and from_store_id = v_user.store_id
       and status = 'available'
    returning *;
end;
$$;

-- ============================================================
-- Rollback (run manually to undo this migration):
--
--   drop function if exists ship_pulls_to_warehouse(uuid[]);
--
-- No data is dropped by this rollback. Pulls already shipped to the warehouse
-- via this RPC stay in status='sent' with the warehouse as destination — they
-- are indistinguishable from any other shipment and remain valid. Reverting
-- only removes the ability to initiate new manual warehouse shipments.
-- ============================================================
