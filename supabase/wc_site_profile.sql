-- Migration : colonne site_profile sur woocommerce_connections
-- À appliquer via Supabase SQL Editor

alter table woocommerce_connections
  add column if not exists site_profile jsonb,
  add column if not exists site_profile_updated_at timestamptz;
