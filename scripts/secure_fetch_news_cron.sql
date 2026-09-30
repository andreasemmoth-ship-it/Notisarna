-- Apply after storing the SAME random value as:
--   Edge Function secret FETCH_NEWS_CRON_SECRET
--   Vault secret fetch_news_cron_secret
-- The existing anon_key Vault secret is used only for Supabase gateway compatibility.
-- Do not put secret values in this file or commit them to Git.

create or replace function public.trigger_fetch_news()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cron_secret text;
  anon_key text;
begin
  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'fetch_news_cron_secret'
  limit 1;

  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'anon_key'
  limit 1;

  if cron_secret is null or cron_secret = '' or anon_key is null or anon_key = '' then
    raise exception 'fetch-news cron secrets are not configured';
  end if;

  perform net.http_post(
    url := 'https://juzqqvhupgvojdeuihok.supabase.co/functions/v1/fetch-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key,
      'X-Cron-Secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

-- Functions in public get EXECUTE for PUBLIC by default. Only the cron owner
-- should be able to read the Vault secret and dispatch a privileged fetch.
revoke all on function public.trigger_fetch_news() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-news';

select cron.schedule(
  'fetch-news',
  '*/15 * * * *',
  'select public.trigger_fetch_news()'
);
