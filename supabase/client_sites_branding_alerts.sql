-- Espaces clients, marque blanche et alertes de surveillance
-- À exécuter dans le SQL Editor Supabase. Migration additive : aucune table existante n'est modifiée.

-- Sites clients supplémentaires (le site principal reste dans user_site_profile)
CREATE TABLE IF NOT EXISTS client_sites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  site_url    TEXT NOT NULL,
  market      TEXT,
  positioning TEXT,
  competitors TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_client_sites" ON client_sites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS client_sites_user_id_idx ON client_sites (user_id);

-- Identité visuelle des rapports en marque blanche
CREATE TABLE IF NOT EXISTS user_branding (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name  TEXT,
  logo_url     TEXT,
  accent_color TEXT DEFAULT '#2563eb',
  footer_text  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_branding" ON user_branding FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Instantanés hebdomadaires (positions, backlinks, citations IA) comparés d'une semaine sur l'autre
CREATE TABLE IF NOT EXISTS monitoring_snapshots (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_url   TEXT NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE monitoring_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON monitoring_snapshots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS monitoring_snapshots_lookup_idx ON monitoring_snapshots (user_id, site_url, created_at DESC);

CREATE TABLE IF NOT EXISTS user_alerts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_url   TEXT NOT NULL,
  kind       TEXT NOT NULL,          -- positions | backlinks | citations
  severity   TEXT DEFAULT 'warning', -- info | warning | critical
  title      TEXT NOT NULL,
  detail     TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_alerts" ON user_alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS user_alerts_user_idx ON user_alerts (user_id, created_at DESC);
