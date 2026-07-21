create table if not exists gsc_connections (
  id bigint generated always as identity primary key,
  session_id text not null unique,
  access_token text not null,
  refresh_token text,
  expiry timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table gsc_connections enable row level security;
