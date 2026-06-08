-- Allow `admin` role to do everything a manager can: post, claim, pass,
-- and receive. Admins are operational power users — they shouldn't be
-- locked out of normal store actions.

create or replace function create_pull(
  p_photo_urls text[],
  p_style_name text,
  p_good_type good_type,
  p_description text,
  p_lines jsonb
) returns pulls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
  v_pull pulls;
  v_line jsonb;
begin
  select * into v_user from users where id = auth.uid();
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user.role not in ('manager', 'admin') then
    raise exception 'only managers or admins can post';
  end if;

  if array_length(p_photo_urls, 1) is null or array_length(p_photo_urls, 1) < 1 then
    raise exception 'at least one photo is required';
  end if;
  if p_style_name is null or length(trim(p_style_name)) = 0 then
    raise exception 'style name is required';
  end if;
  if jsonb_array_length(p_lines) < 1 then
    raise exception 'at least one line item is required';
  end if;

  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    p_photo_urls, trim(p_style_name), p_good_type,
    nullif(trim(coalesce(p_description, '')), ''),
    v_user.store_id, v_user.id
  ) returning * into v_pull;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into pull_lines (pull_id, sku, color, size, quantity)
    values (
      v_pull.id, v_line->>'sku',
      nullif(trim(coalesce(v_line->>'color', '')), ''),
      nullif(trim(coalesce(v_line->>'size', '')), ''),
      (v_line->>'quantity')::int
    );
  end loop;
  return v_pull;
end;
$$;

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
    update pulls set status = 'to_warehouse' where id = p_pull_id
    returning * into v_pull;
  end if;
  return v_pull;
end;
$$;
