-- Profil site utilisateur — collecté lors de l'onboarding
-- À exécuter dans le SQL Editor du projet seo-news-supabase

CREATE TABLE IF NOT EXISTS user_site_profile (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  site_url    TEXT NOT NULL,
  competitors TEXT[]  DEFAULT '{}',
  tech_stack  JSONB   DEFAULT '[]',   -- [{ name, category, color }]
  positioning TEXT,                    -- résumé 1 phrase du positionnement
  writing_style TEXT,                 -- description du ton rédactionnel
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_site_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_site_profile"
  ON user_site_profile FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_site_profile_user_id_idx ON user_site_profile (user_id);
