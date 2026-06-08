-- update_pull: replace a pull's content (photos, style, good_type,
-- description, and the full set of line items). Only allowed while
-- status = 'available' and only for the original poster.

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
  if v_pull.posted_by <> v_user.id then raise exception 'only the poster can edit'; end if;
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
