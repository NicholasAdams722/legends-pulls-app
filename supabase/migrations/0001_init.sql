-- legends-inventory-transfers initial schema
-- Run in Supabase SQL editor (or via `supabase db push` if using the CLI).

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type store_type as enum ('retail', 'warehouse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('manager', 'warehouse', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type good_type as enum ('soft', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pull_status as enum ('available', 'claimed', 'to_warehouse', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  code smallint not null unique,
  name text not null,
  type store_type not null
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  store_id uuid not null references stores(id),
  role user_role not null default 'manager',
  created_at timestamptz not null default now()
);

create table if not exists pulls (
  id uuid primary key default gen_random_uuid(),
  photo_urls text[] not null default '{}',
  style_name text not null,
  good_type good_type not null,
  description text,
  from_store_id uuid not null references stores(id),
  posted_by uuid not null references users(id),
  status pull_status not null default 'available',
  claimed_by_store_id uuid references stores(id),
  claimed_by_user_id uuid references users(id),
  claimed_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  constraint photos_not_empty check (array_length(photo_urls, 1) >= 1)
);
create index if not exists pulls_status_idx on pulls(status);
create index if not exists pulls_from_store_idx on pulls(from_store_id);
create index if not exists pulls_created_at_idx on pulls(created_at desc);

create table if not exists pull_lines (
  id uuid primary key default gen_random_uuid(),
  pull_id uuid not null references pulls(id) on delete cascade,
  sku text not null check (sku ~ '^[0-9]{5}$'),
  color text,
  size text,
  quantity int not null check (quantity > 0)
);
create index if not exists pull_lines_pull_id_idx on pull_lines(pull_id);
create index if not exists pull_lines_sku_idx on pull_lines(sku);

create table if not exists pull_passes (
  id uuid primary key default gen_random_uuid(),
  pull_id uuid not null references pulls(id) on delete cascade,
  store_id uuid not null references stores(id),
  user_id uuid not null references users(id),
  passed_at timestamptz not null default now(),
  unique (pull_id, store_id)
);
create index if not exists pull_passes_pull_id_idx on pull_passes(pull_id);

-- products: catalog. Empty in v1 by design (manual SKU entry). Schema in place
-- so a POS export can be imported later without a rebuild.
create table if not exists products (
  sku text primary key check (sku ~ '^[0-9]{5}$'),
  style_name text not null,
  color text,
  size text,
  good_type good_type not null
);

-- ============================================================
-- Seed stores (idempotent)
-- ============================================================
insert into stores (code, name, type) values
  (1, 'Legends Gifts', 'retail'),
  (2, 'Nashville Gifts', 'retail'),
  (4, 'Music City Showcase', 'retail'),
  (0, 'Warehouse', 'warehouse')
on conflict (code) do nothing;

-- ============================================================
-- State-machine RPCs
-- All run as SECURITY DEFINER so they can perform atomic
-- locked updates regardless of RLS, but each verifies auth.uid()
-- and role/store before mutating.
-- ============================================================

-- CLAIM: atomic, first claim wins (row-locked).
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
  if v_user.role <> 'manager' then raise exception 'only managers can claim'; end if;

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

-- PASS: records a pass, auto-routes to warehouse when all eligible peers have passed.
-- Eligible peers = every retail store except the posting store.
-- The peer count is COMPUTED, never hardcoded.
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
  if v_user.role <> 'manager' then raise exception 'only managers can pass'; end if;

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
    from stores
   where type = 'retail' and id <> v_pull.from_store_id;

  select count(distinct store_id) into v_passes
    from pull_passes
   where pull_id = p_pull_id;

  if v_passes >= v_peers then
    update pulls set status = 'to_warehouse' where id = p_pull_id
    returning * into v_pull;
  end if;

  return v_pull;
end;
$$;

-- RECEIVE: claiming store (status=claimed) or warehouse (status=to_warehouse).
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

  if v_pull.status = 'claimed' then
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

-- CANCEL: poster only, while available.
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
  if v_pull.posted_by <> v_user.id then raise exception 'only the poster can cancel'; end if;
  if v_pull.status <> 'available' then raise exception 'can only cancel while available'; end if;

  update pulls set status = 'cancelled' where id = p_pull_id
  returning * into v_pull;
  return v_pull;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table stores      enable row level security;
alter table users       enable row level security;
alter table pulls       enable row level security;
alter table pull_lines  enable row level security;
alter table pull_passes enable row level security;
alter table products    enable row level security;

-- stores: any authenticated user can read
drop policy if exists stores_read on stores;
create policy stores_read on stores for select
  using (auth.role() = 'authenticated');

-- users: anyone authed can read (needed to show poster/claimer names)
drop policy if exists users_read on users;
create policy users_read on users for select
  using (auth.role() = 'authenticated');

-- pulls
drop policy if exists pulls_read on pulls;
create policy pulls_read on pulls for select
  using (auth.role() = 'authenticated');

drop policy if exists pulls_insert on pulls;
create policy pulls_insert on pulls for insert
  with check (
    posted_by = auth.uid()
    and from_store_id = (select store_id from users where id = auth.uid())
    and status = 'available'
  );

-- Poster can edit a pull while it is still available
drop policy if exists pulls_update_poster on pulls;
create policy pulls_update_poster on pulls for update
  using (posted_by = auth.uid() and status = 'available')
  with check (posted_by = auth.uid() and status = 'available');

drop policy if exists pulls_delete_poster on pulls;
create policy pulls_delete_poster on pulls for delete
  using (posted_by = auth.uid() and status = 'available');

-- pull_lines
drop policy if exists pull_lines_read on pull_lines;
create policy pull_lines_read on pull_lines for select
  using (auth.role() = 'authenticated');

drop policy if exists pull_lines_insert on pull_lines;
create policy pull_lines_insert on pull_lines for insert
  with check (exists (
    select 1 from pulls p
     where p.id = pull_id and p.posted_by = auth.uid() and p.status = 'available'
  ));

drop policy if exists pull_lines_update on pull_lines;
create policy pull_lines_update on pull_lines for update
  using (exists (
    select 1 from pulls p
     where p.id = pull_id and p.posted_by = auth.uid() and p.status = 'available'
  ));

drop policy if exists pull_lines_delete on pull_lines;
create policy pull_lines_delete on pull_lines for delete
  using (exists (
    select 1 from pulls p
     where p.id = pull_id and p.posted_by = auth.uid() and p.status = 'available'
  ));

-- pull_passes: read-only via RLS. Inserts go through pass_pull() RPC.
drop policy if exists pull_passes_read on pull_passes;
create policy pull_passes_read on pull_passes for select
  using (auth.role() = 'authenticated');

-- products: read-only (catalog import comes later)
drop policy if exists products_read on products;
create policy products_read on products for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket for pull photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('pull-photos', 'pull-photos', true)
on conflict (id) do nothing;

drop policy if exists "pull photos read" on storage.objects;
create policy "pull photos read" on storage.objects for select
  using (bucket_id = 'pull-photos');

drop policy if exists "pull photos upload" on storage.objects;
create policy "pull photos upload" on storage.objects for insert
  with check (
    bucket_id = 'pull-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pull photos delete own" on storage.objects;
create policy "pull photos delete own" on storage.objects for delete
  using (
    bucket_id = 'pull-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Realtime publication
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table pulls;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table pull_lines;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table pull_passes;
exception when duplicate_object then null; end $$;
