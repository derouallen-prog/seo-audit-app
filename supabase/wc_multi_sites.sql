-- Migration : support multi-sites WooCommerce/WordPress
-- À appliquer via Supabase SQL Editor

-- 1. Nouvelles colonnes
alter table woocommerce_connections
  add column if not exists label text,
  add column if not exists is_default boolean not null default false;

-- 2. Supprimer l'ancien index unique (1 site par user)
drop index if exists woocommerce_connections_user_id_idx;

-- 3. Nouvel index unique : 1 connexion par (user, site)
create unique index if not exists woocommerce_connections_user_store_idx
  on woocommerce_connections (user_id, store_url);

-- 4. Marquer la connexion existante de chaque utilisateur comme défaut
update woocommerce_connections
set is_default = true
where id in (
  select distinct on (user_id) id
  from woocommerce_connections
  order by user_id, created_at asc
);
