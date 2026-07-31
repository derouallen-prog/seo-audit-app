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
