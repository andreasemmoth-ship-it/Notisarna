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

-- Index för filtrering och sortering
create index if not exists news_articles_category_key on news_articles(category_key);
create index if not exists news_articles_published_at  on news_articles(published_at desc);

-- Aktivera pg_cron och pg_net (görs under Database → Extensions i dashboarden)
-- Kör sedan detta för att schemalägga Edge Function var 15:e minut:
--
-- select cron.schedule(
--   'fetch-news',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://DIN_PROJECT_REF.supabase.co/functions/v1/fetch-news',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer DIN_ANON_KEY',
--       'Content-Type',  'application/json'
--     ),
--     body    := '{}'::jsonb
--   )
--   $$
-- );
