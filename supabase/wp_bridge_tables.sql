-- Mind Bridge : tables pour l'exécution de scripts JS dans le navigateur utilisateur
-- À exécuter une fois dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS wp_bridge_tokens (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wp_bridge_tokens_user_id_idx ON wp_bridge_tokens (user_id);

CREATE TABLE IF NOT EXISTS wp_bridge_queue (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  script        TEXT NOT NULL,
  description   TEXT,
  target_url    TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'executed', 'failed')),
  result        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  executed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wp_bridge_queue_user_status_idx ON wp_bridge_queue (user_id, status);

-- RLS : chaque utilisateur n'accède qu'à ses propres données
ALTER TABLE wp_bridge_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wp_bridge_queue  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bridge_tokens"
  ON wp_bridge_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_bridge_queue"
  ON wp_bridge_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
