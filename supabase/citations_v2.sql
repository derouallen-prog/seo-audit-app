-- Citations v2 — ajout suivi des mentions (texte) + langue + index optimisés
-- À appliquer dans Supabase SQL Editor

-- 1. Colonne `mentioned` : le domaine apparaît dans le texte de la réponse (même sans URL citée)
alter table citation_runs
  add column if not exists mentioned boolean not null default false;

-- 2. Colonne `response_text` : extrait texte brut de la réponse (max 1000 chars) pour audit
alter table citation_runs
  add column if not exists response_text text;

-- 3. Colonne `language` sur prompt_sets pour filtrer par langue de monitoring
alter table prompt_sets
  add column if not exists language text not null default 'fr';

-- Index supplémentaires pour les nouvelles colonnes
create index if not exists citation_runs_mentioned_idx on citation_runs (mentioned, platform, run_at desc);
create index if not exists prompt_sets_language_idx on prompt_sets (user_id, language);
