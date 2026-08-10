-- Migration sécurité : activer RLS sur les tables Mind Bridge
-- À exécuter dans le SQL Editor du projet seo-news-supabase
-- Les opérations serveur utilisent le service role (bypasse RLS) → aucune régression

ALTER TABLE wp_bridge_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wp_bridge_queue  ENABLE ROW LEVEL SECURITY;

-- wp_bridge_tokens : chaque utilisateur n'accède qu'à ses propres tokens
CREATE POLICY "users_own_bridge_tokens"
  ON wp_bridge_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- wp_bridge_queue : chaque utilisateur n'accède qu'à ses propres entrées
CREATE POLICY "users_own_bridge_queue"
  ON wp_bridge_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
