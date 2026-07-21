-- Citation tracking : suivi des mentions IA multi-plateformes

-- Jeux de prompts définis par l'utilisateur pour tracker son site
create table if not exists prompt_sets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tracked_url text not null,         -- domaine suivi, ex: "fr.protilab.com"
  prompt_text text not null,         -- question à poser à l'IA
  intent text not null default 'Informational',  -- Informational|Navigational|Commercial|Learn and Solve|Local|Others
  topic text,                        -- cluster thématique libre
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists prompt_sets_user_url_idx on prompt_sets (user_id, tracked_url, active);

alter table prompt_sets enable row level security;

create policy "Users manage own prompt_sets" on prompt_sets
  for all using (auth.uid() = user_id);


-- Résultats d'exécution : un row par (prompt × plateforme × run)
create table if not exists citation_runs (
  id uuid default gen_random_uuid() primary key,
  prompt_id uuid references prompt_sets(id) on delete cascade not null,
  platform text not null,            -- 'perplexity' | 'claude' | 'openai' | 'gemini' | 'bing_copilot'
  run_at timestamptz not null default now(),
  cited boolean not null default false,
  citation_position integer,         -- rang dans les sources retournées (null si non cité)
  cited_url text,                    -- URL précise du site citée
  competitor_domains jsonb,          -- tableau des autres domaines cités
  raw_response jsonb,                -- réponse brute pour audit/debug
  source text not null default 'auto',  -- 'auto' (cron) | 'manual' | 'import' (Bing CSV)
  created_at timestamptz not null default now()
);

create index if not exists citation_runs_prompt_run_idx on citation_runs (prompt_id, run_at desc);
create index if not exists citation_runs_cited_idx on citation_runs (cited, platform, run_at desc);

alter table citation_runs enable row level security;

-- Les runs sont accessibles via leur prompt qui appartient à l'user
create policy "Users read own citation_runs" on citation_runs
  for select using (
    exists (
      select 1 from prompt_sets p
      where p.id = citation_runs.prompt_id
        and p.user_id = auth.uid()
    )
  );
