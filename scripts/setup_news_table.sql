-- Kör i Supabase SQL Editor

create table if not exists news_articles (
  id           text primary key,
  category     text,
  category_key text,
  source       text,
  date_sv      text,
  headline     text,
  summary      text,
  hue          integer,
  link         text,
  image        text,
  featured     boolean default false,
  published_at timestamptz,
  fetched_at   timestamptz default now()
);

create index if not exists news_articles_category_key on news_articles(category_key);
create index if not exists news_articles_published_at  on news_articles(published_at desc);

alter table news_articles enable row level security;
create policy "public read" on news_articles for select using (true);

-- feed_config behöver categories-kolumnen
alter table feed_config add column if not exists categories jsonb default '[]'::jsonb;
alter table feed_config enable row level security;
create policy "public read" on feed_config for select using (true);
create policy "public write" on feed_config for all using (true);

alter table archived_articles enable row level security;
create policy "public all" on archived_articles for all using (true);

-- Schemaläggning och säker anropsnyckel konfigureras separat i
-- scripts/secure_fetch_news_cron.sql efter att hemligheterna lagts in.
