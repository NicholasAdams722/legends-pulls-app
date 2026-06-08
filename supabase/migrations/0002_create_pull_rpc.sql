-- Atomic create_pull: insert the pull header + all line items in one call.
-- p_lines is a JSON array of {sku, color, size, quantity}.

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
  if v_user.role <> 'manager' then raise exception 'only managers can post'; end if;

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
    p_photo_urls,
    trim(p_style_name),
    p_good_type,
    nullif(trim(coalesce(p_description, '')), ''),
    v_user.store_id,
    v_user.id
  )
  returning * into v_pull;

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
