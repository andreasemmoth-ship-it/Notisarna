-- Kör i Supabase SQL Editor
-- Sätter upp automatisk schemaläggning för hjälteartikel-valet (Hero) var 30:e minut.

create or replace function public.trigger_select_hero()
returns void language plpgsql as $$
declare
  anon_key text;
begin
  -- Hämta anon_key från Supabase Vault för säker autentisering
  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'anon_key'
  limit 1;

  perform net.http_post(
    url     := 'https://juzqqvhupgvojdeuihok.supabase.co/functions/v1/select-hero',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Schemalägg funktionen att köras var 30:e minut (t.ex. :00 och :30)
-- Obs: pg_cron och pg_net måste vara aktiverade i Supabase (vilket de redan är för fetch-news)
select cron.unschedule(jobid) from cron.job where jobname = 'select-hero-every-30m'; -- Ta bort gammalt schema om det finns (säkert sätt)
select cron.schedule('select-hero-every-30m', '*/30 * * * *', 'select public.trigger_select_hero()');
