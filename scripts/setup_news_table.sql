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

-- Cron: Steg 1 — aktivera pg_cron och pg_net under Database → Extensions.
-- Steg 2 — skapa hjälpfunktionen (undviker URL-radbrytning i cron-kommandot):

create or replace function public.trigger_fetch_news()
returns void language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://juzqqvhupgvojdeuihok.supabase.co/functions/v1/fetch-news',
    headers := '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1enFxdmh1cGd2b2pkZXVpaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDM1OTksImV4cCI6MjA5MzcxOTU5OX0.xwJik8yUoCbntl9X0_Ces0y4A_FDJyi9Ah3sOZy7FNQ","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
end;
$$;

-- Steg 3 — schemalägg:
select cron.schedule('fetch-news', '*/15 * * * *', 'select public.trigger_fetch_news()');
