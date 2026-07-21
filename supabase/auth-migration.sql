-- Ajouter user_id à la table audits
alter table audits
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists audits_user_id_idx on audits (user_id, created_at desc);

-- Policies RLS (les audits sans user_id restent accessibles via UUID = mode invité)
drop policy if exists "Users can read own audits" on audits;
create policy "Users can read own audits" on audits
  for select using (auth.uid() = user_id);

drop policy if exists "Service role bypass" on audits;
-- Le service role key bypass automatiquement le RLS, pas besoin de policy supplémentaire.

-- Permettre l'insertion avec ou sans user_id (les invités peuvent aussi créer des audits)
drop policy if exists "Allow inserts" on audits;
create policy "Allow inserts" on audits
  for insert with check (true);
