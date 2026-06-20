-- Pack/Send flow, part 2: state-machine RPCs.
--
-- New states:
--   claimed -> packed -> sent -> received
-- The pre-existing claimed -> received and to_warehouse -> received paths
-- still work (receive_pull now accepts claimed/packed/sent from the claimer).

-- PACK: poster transitions claimed -> packed.
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
  if v_pull.status <> 'claimed' then
    raise exception 'can only pack a claimed pull';
  end if;

  update pulls
     set status = 'packed', packed_at = now()
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;

-- SEND: poster transitions packed (or claimed, as a shortcut) -> sent.
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
  if v_pull.status not in ('claimed', 'packed') then
    raise exception 'can only send a claimed or packed pull';
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

-- RECEIVE: claiming store (claimed/packed/sent) or warehouse (to_warehouse).
create or replace function receive_pull(p_pull_id uuid)
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

  if v_pull.status in ('claimed', 'packed', 'sent') then
    if v_user.store_id <> v_pull.claimed_by_store_id then
      raise exception 'not the assigned claimer';
    end if;
  elsif v_pull.status = 'to_warehouse' then
    if v_user.role <> 'warehouse' then
      raise exception 'only warehouse can receive routed pulls';
    end if;
  else
    raise exception 'pull is not awaiting receive';
  end if;

  update pulls set status = 'received', received_at = now() where id = p_pull_id
  returning * into v_pull;
  return v_pull;
end;
$$;
