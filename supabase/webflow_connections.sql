-- Webflow OAuth connections (one token per user, sites cached as JSONB)
CREATE TABLE IF NOT EXISTS webflow_connections (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT        NOT NULL,
  sites        JSONB       DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webflow_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_webflow_connections"
  ON webflow_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
