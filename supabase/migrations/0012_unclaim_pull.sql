-- Undo for the Claim action. Reverts a 'claimed' pull back to 'available' so it
-- reappears in the Feed for other stores, and clears the claim ownership fields.
-- Only the store that claimed it may undo, and only while it's still 'claimed'
-- (i.e. the originating store hasn't packed it yet).

create or replace function unclaim_pull(p_pull_id uuid)
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
    raise exception 'only managers or admins can unclaim';
  end if;

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.status <> 'claimed' then
    raise exception 'can only undo a claim that has not been packed yet';
  end if;
  if v_pull.claimed_by_store_id <> v_user.store_id then
    raise exception 'only the claiming store can undo the claim';
  end if;

  update pulls
     set status = 'available',
         claimed_by_store_id = null,
         claimed_by_user_id = null,
         claimed_at = null
   where id = p_pull_id
   returning * into v_pull;
  return v_pull;
end;
$$;
