-- 24 dummy available pulls (12 from Store 1, 12 from Store 2) for feed UX testing at scale.
-- All posted_by the existing "Demo Manager" auth user.
-- Run in Supabase SQL Editor. Re-running adds 24 more.

do $$
declare
  v_user uuid := '7dd9740e-4cf8-47b6-8c19-b039035131b9';
  v_store1 uuid;
  v_store2 uuid;
  v_pull uuid;
begin
  select id into v_store1 from stores where code = 1;
  select id into v_store2 from stores where code = 2;

  -- ============================================================
  -- STORE 1 (12)
  -- ============================================================

  -- 1
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/skyline-tee-2/800/800'],
          'Music City Skyline tee', 'soft', 'Found a stack in the back room', v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '47821', 'Black', 'S', 1),
    (v_pull, '47822', 'Black', 'M', 2),
    (v_pull, '47823', 'Black', 'L', 3),
    (v_pull, '47824', 'White', 'M', 2),
    (v_pull, '47825', 'White', 'L', 1);

  -- 2
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/hot-chicken-tee/800/800'],
          'Nashville Hot Chicken tee', 'soft', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '47901', 'Red', 'M', 2),
    (v_pull, '47902', 'Red', 'L', 1),
    (v_pull, '47903', 'Red', 'XL', 1);

  -- 3
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/honky-tonk-pint-2/800/800'],
          'Honky Tonk pint glass', 'hard', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '60112', null, null, 6);

  -- 4
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/country-tank-2/800/800'],
          'Country Roads tank', 'soft', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '48003', 'Pink', 'XS', 1),
    (v_pull, '48004', 'Pink', 'S', 2),
    (v_pull, '48005', 'Pink', 'M', 3),
    (v_pull, '48006', 'Pink', 'L', 1);

  -- 5
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/tn-flag-tote/800/800'],
          'Tennessee state flag tote', 'hard', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '70010', null, null, 4);

  -- 6
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/bluebird-hoodie/800/800'],
          'Bluebird Cafe hoodie', 'soft', 'Heather grey only', v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '51310', 'Heather', 'S', 1),
    (v_pull, '51311', 'Heather', 'M', 2),
    (v_pull, '51312', 'Heather', 'L', 2),
    (v_pull, '51313', 'Heather', 'XL', 1),
    (v_pull, '51314', 'Heather', '2X', 1);

  -- 7
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/goo-goo-mug-2/800/800'],
          'Goo Goo Cluster mug', 'hard', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '61077', null, null, 3);

  -- 8
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/vibes-crop/800/800'],
          'Nashville Vibes crop top', 'soft', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '48201', 'White', 'XS', 2),
    (v_pull, '48202', 'White', 'S', 2),
    (v_pull, '48203', 'White', 'M', 1);

  -- 9
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/boot-opener/800/800'],
          'Cowboy Boot bottle opener', 'hard', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '80540', null, null, 12);

  -- 10
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/music-scarf/800/800'],
          'Music Notes scarf', 'hard', 'Limited stock', v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '74201', 'Black', null, 1),
    (v_pull, '74202', 'Ivory', null, 1);

  -- 11
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/stay-wild-tank/800/800'],
          'Stay Wild tank', 'soft', null, v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '48310', 'Sage', 'S', 1),
    (v_pull, '48311', 'Sage', 'M', 2),
    (v_pull, '48312', 'Sage', 'L', 2),
    (v_pull, '48313', 'Sage', 'XL', 1);

  -- 12
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/pedal-keychain/800/800'],
          'Pedal Tavern keychain', 'hard', 'Whole pegboard', v_store1, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '80120', null, null, 24);

  -- ============================================================
  -- STORE 2 (12)
  -- ============================================================

  -- 13
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/opry-tee-2/800/800'],
          'Grand Ole Opry tee', 'soft', 'Full size run', v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '49001', 'Navy', 'S', 1),
    (v_pull, '49002', 'Navy', 'M', 2),
    (v_pull, '49003', 'Navy', 'L', 2),
    (v_pull, '49004', 'Navy', 'XL', 1),
    (v_pull, '49005', 'Navy', '2X', 1);

  -- 14
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/belle-meade-hat-2/800/800'],
          'Belle Meade dad hat', 'hard', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '70450', 'Khaki', null, 3),
    (v_pull, '70451', 'Navy', null, 2);

  -- 15
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/whiskey-crew-2/800/800'],
          'Tennessee Whiskey crew neck', 'soft', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '52340', 'Heather', 'M', 1),
    (v_pull, '52341', 'Heather', 'L', 1),
    (v_pull, '52342', 'Heather', 'XL', 2),
    (v_pull, '52343', 'Heather', '3X', 1);

  -- 16
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/country-keychain-2/800/800'],
          'Country Music keychain', 'hard', 'Two designs mixed in', v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '80012', null, null, 8),
    (v_pull, '80013', null, null, 5);

  -- 17
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/bluegrass-tee/800/800'],
          'Bluegrass Festival tee', 'soft', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '49210', 'Forest', 'S', 1),
    (v_pull, '49211', 'Forest', 'M', 2),
    (v_pull, '49212', 'Forest', 'L', 2);

  -- 18
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/hatch-poster/800/800'],
          'Hatch Show Print poster', 'hard', 'Three different prints', v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '90120', null, null, 2),
    (v_pull, '90121', null, null, 2),
    (v_pull, '90122', null, null, 1);

  -- 19
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/honky-highway-tee/800/800'],
          'Honky Tonk Highway tee', 'soft', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '49320', 'Black', 'M', 1),
    (v_pull, '49321', 'Black', 'L', 1),
    (v_pull, '49322', 'Black', 'XL', 1),
    (v_pull, '49323', 'Black', '2X', 1),
    (v_pull, '49324', 'Black', '4X', 1);

  -- 20
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/loretta-mug/800/800'],
          'Loretta Lynn coffee mug', 'hard', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '61240', null, null, 4);

  -- 21
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/music-row-cap/800/800'],
          'Music Row dad cap', 'hard', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '70520', 'Black', null, 2),
    (v_pull, '70521', 'Olive', null, 1);

  -- 22
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/whiskey-flask/800/800'],
          'Whiskey Trail flask', 'hard', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '60840', null, null, 6);

  -- 23
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/sunshine-tee/800/800'],
          'Tennessee Sunshine tee', 'soft', null, v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '49510', 'Yellow', 'XS', 1),
    (v_pull, '49511', 'Yellow', 'S', 2),
    (v_pull, '49512', 'Yellow', 'M', 2),
    (v_pull, '49513', 'Yellow', 'L', 1);

  -- 24
  insert into pulls (photo_urls, style_name, good_type, description, from_store_id, posted_by)
  values (array['https://picsum.photos/seed/skyline-magnet/800/800'],
          'Nashville Skyline magnet', 'hard', 'Backstock', v_store2, v_user)
  returning id into v_pull;
  insert into pull_lines (pull_id, sku, color, size, quantity) values
    (v_pull, '85010', null, null, 15);
end $$;
