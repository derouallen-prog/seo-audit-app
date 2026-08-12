-- Migration : détection plugin SEO + statut de compatibilité REST
-- À exécuter dans le SQL Editor du projet seo-news-supabase

ALTER TABLE woocommerce_connections
  ADD COLUMN IF NOT EXISTS seo_plugin TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS seo_compat_status TEXT DEFAULT 'unchecked'
    CHECK (seo_compat_status IN ('compatible_direct', 'needs_connector_plugin', 'seo_not_detected', 'unchecked', 'checking'));
