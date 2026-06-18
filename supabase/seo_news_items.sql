create table if not exists seo_news_items (
  id bigint generated always as identity primary key,
  source text not null,
  title text not null,
  link text not null unique,
  published_at timestamptz not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists seo_news_items_published_at_idx
  on seo_news_items (published_at desc);
