-- =====================================================
-- 1. read_articles — spårar lästa artiklar per user
-- =====================================================
create table if not exists public.read_articles (
  article_id text primary key,
  read_at    timestamptz default now()
);

alter table public.read_articles enable row level security;

create policy "auth read_articles all"
  on public.read_articles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- =====================================================
-- 2. briefings — AI-morgonbriefingar
-- =====================================================
create table if not exists public.briefings (
  id         uuid primary key default gen_random_uuid(),
  date       date unique not null,
  content    text not null,
  created_at timestamptz default now()
);

alter table public.briefings enable row level security;

-- Alla inloggade kan läsa
create policy "auth read briefings"
  on public.briefings for select
  using (auth.role() = 'authenticated');

-- Service role (Edge Function) kan skriva
create policy "service insert briefings"
  on public.briefings for insert
  with check (true);

create policy "service update briefings"
  on public.briefings for update
  using (true);

-- =====================================================
-- 3. Trigger-funktion för morning-briefing
-- =====================================================
create or replace function public.trigger_morning_briefing()
returns void language plpgsql as $$
begin
  perform net.http_post(
    url     := 'https://juzqqvhupgvojdeuihok.supabase.co/functions/v1/morning-briefing',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
end;
$$;

-- =====================================================
-- 4. Schemalägg kl 06:00 varje dag (UTC, dvs 08:00 svensk sommartid)
-- =====================================================
select cron.schedule(
  'morning-briefing',
  '0 6 * * *',
  'select public.trigger_morning_briefing()'
);
