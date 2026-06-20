-- Warehouse-bound pulls now flow through the same pack/ship steps as
-- retail-claimed ones, so the poster can pack them, mark them shipped,
-- and pick them up in the POS Log.
--
-- Key change: when pass_pull auto-routes to the warehouse, we ALSO set
-- claimed_by_store_id to the warehouse's store id. After that, the pull
-- behaves identically to one a peer store claimed -- pack_pull and
-- send_pull accept it, receive_pull works via the assigned-claimer check,
-- and the warehouse user sees it in their Routed tab through every stage.

-- pass_pull: set claimed_by_store_id to the warehouse on auto-route.
create or replace function pass_pull(p_pull_id uuid)
returns pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_pull pulls;
  v_passes int;
  v_peers int;
  v_warehouse_store_id uuid;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user.role not in ('manager', 'admin') then
    raise exception 'only managers or admins can pass';
  end if;

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.status <> 'available' then raise exception 'pull is no longer available'; end if;
  if v_pull.from_store_id = v_user.store_id then
    raise exception 'cannot pass your own store''s pull';
  end if;

  insert into pull_passes (pull_id, store_id, user_id)
  values (p_pull_id, v_user.store_id, v_user.id)
  on conflict (pull_id, store_id) do nothing;

  select count(*) into v_peers
    from stores where type = 'retail' and id <> v_pull.from_store_id;
  select count(distinct store_id) into v_passes
    from pull_passes where pull_id = p_pull_id;

  if v_passes >= v_peers then
    select id into v_warehouse_store_id
      from stores
      where type = 'warehouse'
      order by code
      limit 1;

    update pulls
       set status = 'to_warehouse',
           claimed_by_store_id = v_warehouse_store_id,
           claimed_at = now()
     where id = p_pull_id
     returning * into v_pull;
  end if;
  return v_pull;
end;
$$;

-- pack_pull: also accept routed pulls so the poster can pack them.
create or replace function pack_pull(p_pull_id uuid)
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

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.posted_by <> v_user.id then
    raise exception 'only the poster can pack';
  end if;
  if v_pull.status not in ('claimed', 'to_warehouse') then
    raise exception 'can only pack a claimed or routed pull';
  end if;

  update pulls
     set status = 'packed', packed_at = now()
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;

-- send_pull: also accept routed pulls.
create or replace function send_pull(p_pull_id uuid)
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

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.posted_by <> v_user.id then
    raise exception 'only the poster can mark sent';
  end if;
  if v_pull.status not in ('claimed', 'packed', 'to_warehouse') then
    raise exception 'can only send a claimed, packed, or routed pull';
  end if;

  update pulls
     set status    = 'sent',
         packed_at = coalesce(packed_at, now()),
         sent_at   = now()
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;

-- Backfill: any existing 'to_warehouse' pulls that pre-date this migration
-- get claimed_by_store_id set to the warehouse store so they flow correctly.
update pulls
   set claimed_by_store_id = (
         select id from stores where type = 'warehouse' order by code limit 1
       )
 where status = 'to_warehouse' and claimed_by_store_id is null;
