-- Migration : historique des sessions de chat assistant
-- À appliquer via Supabase SQL Editor

create table if not exists chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Nouvelle conversation',
  messages   jsonb not null default '[]',
  audit_id   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_sessions enable row level security;

create policy "users own their chat sessions"
  on chat_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists chat_sessions_user_updated
  on chat_sessions (user_id, updated_at desc);
