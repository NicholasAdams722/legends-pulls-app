-- Scope the pull workflow to the originating store rather than the
-- individual poster. Any user at from_store_id can edit an available
-- pull, delete it, or run pack/send once it's been claimed.

-- ============================================================
-- RLS: replace poster-scoped policies with store-scoped ones.
-- ============================================================

drop policy if exists pulls_update_poster on pulls;
drop policy if exists pulls_delete_poster on pulls;

create policy pulls_update_from_store on pulls for update
  using (
    from_store_id = (select store_id from users where id = auth.uid())
    and status = 'available'
  )
  with check (
    from_store_id = (select store_id from users where id = auth.uid())
    and status = 'available'
  );

create policy pulls_delete_from_store on pulls for delete
  using (
    from_store_id = (select store_id from users where id = auth.uid())
    and status = 'available'
  );

drop policy if exists pull_lines_insert on pull_lines;
create policy pull_lines_insert on pull_lines for insert
  with check (exists (
    select 1 from pulls p
     where p.id = pull_id
       and p.from_store_id = (select store_id from users where id = auth.uid())
       and p.status = 'available'
  ));

drop policy if exists pull_lines_update on pull_lines;
create policy pull_lines_update on pull_lines for update
  using (exists (
    select 1 from pulls p
     where p.id = pull_id
       and p.from_store_id = (select store_id from users where id = auth.uid())
       and p.status = 'available'
  ));

drop policy if exists pull_lines_delete on pull_lines;
create policy pull_lines_delete on pull_lines for delete
  using (exists (
    select 1 from pulls p
     where p.id = pull_id
       and p.from_store_id = (select store_id from users where id = auth.uid())
       and p.status = 'available'
  ));

-- ============================================================
-- RPCs: swap poster checks for from_store checks.
-- ============================================================

create or replace function update_pull(
  p_pull_id uuid,
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

  select * into v_pull from pulls where id = p_pull_id for update;
  if v_pull is null then raise exception 'pull not found'; end if;
  if v_pull.from_store_id <> v_user.store_id then
    raise exception 'only the originating store can edit';
  end if;
  if v_pull.status <> 'available' then raise exception 'can only edit while available'; end if;

  if array_length(p_photo_urls, 1) is null or array_length(p_photo_urls, 1) < 1 then
    raise exception 'at least one photo is required';
  end if;
  if jsonb_array_length(p_lines) < 1 then
    raise exception 'at least one line item is required';
  end if;

  update pulls set
    photo_urls = p_photo_urls,
    style_name = trim(p_style_name),
    good_type = p_good_type,
    description = nullif(trim(coalesce(p_description, '')), '')
  where id = p_pull_id
  returning * into v_pull;

  delete from pull_lines where pull_id = p_pull_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into pull_lines (pull_id, sku, color, size, quantity)
    values (
      v_pull.id,
      v_line->>'sku',
      nullif(trim(coalesce(v_line->>'color', '')), ''),
      nullif(trim(coalesce(v_line->>'size', '')), ''),
      (v_line->>'quantity')::int
    );
  end loop;

  return v_pull;
end;
$$;

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
  if v_pull.from_store_id <> v_user.store_id then
    raise exception 'only the originating store can pack';
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
  if v_pull.from_store_id <> v_user.store_id then
    raise exception 'only the originating store can mark sent';
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

create or replace function cancel_pull(p_pull_id uuid)
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
  if v_pull.from_store_id <> v_user.store_id then
    raise exception 'only the originating store can cancel';
  end if;
  if v_pull.status <> 'available' then raise exception 'can only cancel while available'; end if;

  update pulls set status = 'cancelled' where id = p_pull_id
  returning * into v_pull;
  return v_pull;
end;
$$;
