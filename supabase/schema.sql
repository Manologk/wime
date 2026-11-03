-- Wime Innovation store — database schema.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run: objects are created with IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 1 and 120),
  category    text not null default 'Wellness'
              check (category in ('Skin care', 'Herbal bitters', 'Wellness')),
  tagline     text not null default '' check (char_length(tagline) <= 80),
  description text not null default '',
  price       numeric(12,2) not null check (price >= 0),
  image_url   text,
  in_stock    boolean not null default true,
  is_active   boolean not null default true,   -- false = hidden from the storefront
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Columns added after the first release (no-ops on a fresh install).
alter table public.products add column if not exists category text not null default 'Wellness';
alter table public.products add column if not exists tagline  text not null default '';
-- Homepage hero slideshow: products with in_hero = true are featured, in sort_order.
-- hero_image_url is an optional separate photo for the hero; empty = use image_url.
alter table public.products add column if not exists in_hero        boolean not null default false;
alter table public.products add column if not exists hero_image_url text;

-- Users listed here can use /admin. Add rows manually (see README).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  bigint generated always as identity (start with 1001) unique,
  customer_name text not null,
  phone         text not null,
  email         text,
  address       text not null,
  note          text,
  total         numeric(12,2) not null,
  status        text not null default 'new'
                check (status in ('new', 'confirmed', 'delivered', 'cancelled')),
  created_at    timestamptz not null default now()
);

create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,           -- snapshot, survives product edits/deletes
  unit_price   numeric(12,2) not null,  -- snapshot of price at order time
  quantity     integer not null check (quantity between 1 and 99)
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- keep products.updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Admin check
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
--   products     : public reads visible ones; admins do everything
--   orders/items : admins only — customers create orders via place_order()
--   admins       : a signed-in user can see only their own row
-- ─────────────────────────────────────────────────────────────

alter table public.products    enable row level security;
alter table public.admins      enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products
  for select using (is_active or public.is_admin());

drop policy if exists "products: admin write" on public.products;
create policy "products: admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins: read own" on public.admins;
create policy "admins: read own" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "orders: admin all" on public.orders;
create policy "orders: admin all" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items: admin all" on public.order_items;
create policy "order_items: admin all" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- place_order — the only way the storefront writes data.
-- Prices come from the products table, never from the browser.
-- p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]
-- Returns: {order_number, total, items: [{name, unit_price, quantity}]}
-- ─────────────────────────────────────────────────────────────

create or replace function public.place_order(
  p_name    text,
  p_phone   text,
  p_address text,
  p_items   jsonb,
  p_email   text default null,
  p_note    text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_order   public.orders;
  v_total   numeric(12,2) := 0;
  v_item    jsonb;
  v_qty     integer;
  v_product public.products;
  v_lines   jsonb := '[]'::jsonb;
begin
  p_name    := nullif(btrim(p_name), '');
  p_phone   := nullif(btrim(p_phone), '');
  p_address := nullif(btrim(p_address), '');
  p_email   := nullif(btrim(p_email), '');
  p_note    := nullif(btrim(p_note), '');

  if p_name is null or char_length(p_name) > 100 then
    raise exception 'Please enter your name.' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Please enter a valid phone number.' using errcode = 'P0001';
  end if;
  if p_address is null or char_length(p_address) > 500 then
    raise exception 'Please enter your delivery address.' using errcode = 'P0001';
  end if;
  if p_email is not null and (char_length(p_email) > 200 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address, or leave it empty.' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Your note is too long.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many different items in one order.' using errcode = 'P0001';
  end if;

  insert into public.orders (customer_name, phone, email, address, note, total)
  values (p_name, p_phone, p_email, p_address, p_note, 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid quantity.' using errcode = 'P0001';
    end if;

    select * into v_product from public.products
     where id = (v_item->>'product_id')::uuid and is_active;
    if not found then
      raise exception 'A product in your cart is no longer available. Please refresh the page.' using errcode = 'P0001';
    end if;
    if not v_product.in_stock then
      raise exception '% is out of stock. Please remove it from your cart.', v_product.name using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_qty);

    v_total := v_total + v_product.price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'name', v_product.name, 'unit_price', v_product.price, 'quantity', v_qty);
  end loop;

  update public.orders set total = v_total where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'total', v_total,
    'items', v_lines);
end $$;

revoke all on function public.place_order(text, text, text, jsonb, text, text) from public;
grant execute on function public.place_order(text, text, text, jsonb, text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: public bucket for product photos, admin-only writes
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "product-images: admin insert" on storage.objects;
create policy "product-images: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images: admin update" on storage.objects;
create policy "product-images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
