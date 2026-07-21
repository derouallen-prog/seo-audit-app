create table if not exists audits (
  id uuid default gen_random_uuid() primary key,
  url text not null,
  score integer,
  grade text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists audits_url_created_idx on audits (url, created_at desc);

alter table audits enable row level security;
