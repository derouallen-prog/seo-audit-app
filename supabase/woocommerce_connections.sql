-- Migration : connexions WooCommerce multi-tenant
-- À appliquer via Supabase SQL Editor

create table if not exists woocommerce_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  store_url    text not null,
  wc_consumer_key    text not null,
  wc_consumer_secret text not null,
  wp_username  text not null,
  wp_app_password    text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un seul enregistrement par utilisateur
create unique index if not exists woocommerce_connections_user_id_idx
  on woocommerce_connections (user_id);

alter table woocommerce_connections enable row level security;

create policy "users own their wc connections"
  on woocommerce_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
