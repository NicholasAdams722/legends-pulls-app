-- 10 dummy available pulls (5 from Store 1, 5 from Store 2) for feed UX testing.
-- All posted_by the existing "Demo Manager" auth user.
-- Run in Supabase SQL Editor. Re-run safe: it just adds more rows.

do $$
declare
  v_user uuid := '7dd9740e-4cf8-47b6-8c19-b039035131b9';
  v_store1 uuid;
  v_store2 uuid;
  v_pull uuid;
begin
  select id into v_store1 from stores where code = 1;
  select id into v_store2 from stores where code = 2;

  -- 1. Store 1 — soft, multi-size, two colors
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/skyline-tee/800/800'],
    'Music City Skyline tee', 'soft',
    'Found a stack in the back room',
    v_store1, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '47821', 'Black', 'S', 1),
    (v_pull, '47822', 'Black', 'M', 2),
    (v_pull, '47823', 'Black', 'L', 3),
    (v_pull, '47824', 'White', 'M', 2),
    (v_pull, '47825', 'White', 'L', 1);

  -- 2. Store 1 — soft, hoodie
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/nashville-hoodie/800/800'],
    'Nashville Vibes hoodie', 'soft', null, v_store1, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '51210', 'Charcoal', 'M', 1),
    (v_pull, '51211', 'Charcoal', 'L', 2),
    (v_pull, '51212', 'Charcoal', 'XL', 1);

  -- 3. Store 1 — hard, single line
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/honky-tonk-pint/800/800'],
    'Honky Tonk pint glass', 'hard', null, v_store1, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '60112', null, null, 6);

  -- 4. Store 1 — soft, tank
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/country-tank/800/800'],
    'Country Roads tank', 'soft', null, v_store1, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '48003', 'Pink', 'S', 2),
    (v_pull, '48004', 'Pink', 'M', 3),
    (v_pull, '48005', 'Pink', 'L', 1);

  -- 5. Store 1 — hard, multiple lines (different finishes)
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/broadway-shot/800/800'],
    'Broadway shot glass', 'hard',
    'Mixed clear and frosted', v_store1, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '60230', 'Clear', null, 4),
    (v_pull, '60231', 'Frosted', null, 3);

  -- 6. Store 2 — soft, big assortment
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/opry-tee/800/800'],
    'Grand Ole Opry tee', 'soft',
    'Full size run', v_store2, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '49001', 'Navy', 'S', 1),
    (v_pull, '49002', 'Navy', 'M', 2),
    (v_pull, '49003', 'Navy', 'L', 2),
    (v_pull, '49004', 'Navy', 'XL', 1),
    (v_pull, '49005', 'Navy', '2X', 1);

  -- 7. Store 2 — hard, hat
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/belle-meade-hat/800/800'],
    'Belle Meade dad hat', 'hard', null, v_store2, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '70450', 'Khaki', null, 3),
    (v_pull, '70451', 'Navy', null, 2);

  -- 8. Store 2 — soft, crew neck
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/whiskey-crew/800/800'],
    'Tennessee Whiskey crew neck', 'soft', null, v_store2, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '52340', 'Heather', 'M', 1),
    (v_pull, '52341', 'Heather', 'L', 1),
    (v_pull, '52342', 'Heather', 'XL', 2);

  -- 9. Store 2 — hard, mug
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/goo-goo-mug/800/800'],
    'Goo Goo Cluster mug', 'hard', null, v_store2, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '61077', null, null, 4);

  -- 10. Store 2 — hard, keychain
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (
    array['https://picsum.photos/seed/country-keychain/800/800'],
    'Country Music keychain', 'hard',
    'Two designs mixed in', v_store2, v_user
  ) returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '80012', null, null, 8),
    (v_pull, '80013', null, null, 5);
end $$;
