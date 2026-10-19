-- ================================================================
-- Publik läsåtkomst till nyheter (ingen inloggning för besökare)
-- Kör i Supabase SQL Editor INNAN den nya frontend-versionen publiceras.
--
-- Bakgrund: setup_two_tier.sql gav rollen anon bara läsrätt till källor
-- i tabellen public_feeds, medan anonymt inloggade (rollen authenticated)
-- såg allt. Sajten loggar inte längre in besökare, så alla anrop görs som
-- anon. Utan denna ändring visas bara källorna i public_feeds.
-- ================================================================

-- 1. news_articles: alla får läsa, ingen får skriva via API:t
--    (fetch-news skriver med service role, som går förbi RLS).
DROP POLICY IF EXISTS "anon_read_public_news" ON public.news_articles;
DROP POLICY IF EXISTS "auth_read_all_news"    ON public.news_articles;
DROP POLICY IF EXISTS "public_read_news"      ON public.news_articles;

CREATE POLICY "public_read_news" ON public.news_articles
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. Realtime: frontend prenumererar på ändringar i news_articles.
--    Om tabellen inte redan ingår i publikationen, avkommentera raden nedan.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;

-- ================================================================
-- VALFRITT: städa bort data från inloggningsfunktionerna
-- Arkiv (bokmärken) och läst-historik finns inte längre på sajten.
-- Raderna är kopplade till anonyma användar-ID:n och behövs inte längre.
-- Läs igenom och avkommentera när du är redo. Detta går inte att ångra.
-- ================================================================

-- DROP TABLE IF EXISTS public.archived_articles;
-- DROP TABLE IF EXISTS public.read_articles;
-- DROP TABLE IF EXISTS public.public_feeds;

-- Ta bort anonyma användarkonton (ditt eget admin-konto påverkas inte):
-- DELETE FROM auth.users WHERE is_anonymous IS TRUE;

-- Stäng sedan av "Anonymous sign-ins" under Authentication → Sign In / Providers.
