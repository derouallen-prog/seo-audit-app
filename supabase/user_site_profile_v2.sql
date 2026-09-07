-- Migration v2 : nouveaux champs profil site + préférences utilisateur
-- À exécuter dans le SQL Editor Supabase

ALTER TABLE user_site_profile
  ADD COLUMN IF NOT EXISTS categories      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS market          TEXT,
  ADD COLUMN IF NOT EXISTS target_zones    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo_level       TEXT    DEFAULT 'intermédiaire',
  ADD COLUMN IF NOT EXISTS sitemap_url     TEXT,
  ADD COLUMN IF NOT EXISTS sitemap_count   INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_lang  TEXT    DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS weekly_report   BOOLEAN DEFAULT TRUE;
