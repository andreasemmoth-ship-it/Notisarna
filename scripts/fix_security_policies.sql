-- =================================================================
-- Säkerhetsuppdatering för RLS-policyer och Edge-funktioner
-- Kör detta skript i Supabase SQL Editor för att täppa till säkerhetsluckor.
-- =================================================================

-- 1. Säkra feed_config-tabellen
-- Tidigare tillät "auth_feed_config" alla inloggade (inklusive anonyma gäster) att ändra flöden.
DROP POLICY IF EXISTS "auth_feed_config" ON public.feed_config;

-- Tillåt alla (både anonyma och inloggade) att läsa flödeskonfigurationen
CREATE POLICY "allow_read_feed_config" ON public.feed_config
  FOR SELECT USING (true);

-- Tillåt ENDAST admin (andreas.emmoth@gmail.com) att ändra flödeskonfigurationen
CREATE POLICY "admin_write_feed_config" ON public.feed_config
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'andreas.emmoth@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'andreas.emmoth@gmail.com');

-- 2. Säkra briefings-tabellen
-- Ta bort osäkra skrivpolicyer för obehöriga (Edge Functions använder service_role som kringgår RLS)
DROP POLICY IF EXISTS "service_insert_briefings" ON public.briefings;
DROP POLICY IF EXISTS "service_update_briefings" ON public.briefings;
DROP POLICY IF EXISTS "service insert briefings" ON public.briefings;
DROP POLICY IF EXISTS "service update briefings" ON public.briefings;

-- Tillåt alla att läsa briefings (krävs för att oinloggade gäster ska se AI-sammanfattningen)
DROP POLICY IF EXISTS "auth read briefings" ON public.briefings;
CREATE POLICY "allow_read_briefings" ON public.briefings
  FOR SELECT USING (true);

-- 3. Uppdatera trigger-funktionen för morning-briefing
-- Skicka med anon-nyckeln från valvet (vault) så Edge-funktionen kan verifiera anropet
CREATE OR REPLACE FUNCTION public.trigger_morning_briefing()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  anon_key TEXT;
BEGIN
  -- Hämta anon-nyckeln säkert från Supabases interna hemlighetsvalv
  SELECT decrypted_secret INTO anon_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'anon_key' 
  LIMIT 1;

  PERFORM net.http_post(
    url     := 'https://juzqqvhupgvojdeuihok.supabase.co/functions/v1/morning-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(anon_key, '')
    ),
    body    := '{}'::jsonb
  );
END;
$$;
