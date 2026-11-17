-- Focus thématique accepté à l'onboarding (suggestion de projet basée sur un vrai quick-win DataForSEO).
-- Stocke uniquement le choix ; la fonctionnalité "projet" (renommage du menu Assistant, etc.)
-- reste un chantier séparé, volontairement pas construit ici.
ALTER TABLE user_site_profile
  ADD COLUMN IF NOT EXISTS active_topic_focus TEXT;
