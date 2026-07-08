-- Undo for the Pack action. Reverts a 'packed' pull back to whatever state
-- it was in before (either 'claimed' by a peer store or 'to_warehouse' when
-- routed to the warehouse), and clears packed_at.

create or replace function unpack_pull(p_pull_id uuid)
returns pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_pull pulls;
  v_claimer_type text;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.from_store_id <> v_user.store_id then
    raise exception 'only the originating store can unpack';
  end if;
  if v_pull.status <> 'packed' then
    raise exception 'can only unpack a packed pull';
  end if;

  select type into v_claimer_type
    from stores where id = v_pull.claimed_by_store_id;

  update pulls
     set status = case
                    when v_claimer_type = 'warehouse' then 'to_warehouse'::pull_status
                    else 'claimed'::pull_status
                  end,
         packed_at = null
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;
