-- ================================================================
-- Tvånivå-åtkomst: anonym (publik) + inloggad (authenticated)
-- Kör hela filen i Supabase SQL Editor
-- FÖRUTSÄTTNING: Aktivera "Anonymous sign-ins" i Auth → Settings
-- ================================================================

-- 1. Skapa public_feeds (förgodkända källor för anon-användare)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_feeds (
  id          SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  enabled     BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public_feeds (source_name) VALUES
  -- Skatt & juridik
  ('SKV Rättslig vägledning 1'),
  ('SKV Rättslig vägledning 2'),
  ('SKV Rättslig vägledning 3'),
  ('SKV Rättslig vägledning 4'),
  ('SKV Rättslig vägledning 5'),
  ('Skatterättsnämnden'),
  ('PwC Tax Matters'),
  ('HFD nyheter'),
  -- Teknik
  ('Ars Technica'),
  ('The Verge'),
  -- Världen
  ('Reuters'),
  ('BBC News'),
  ('Associated Press'),
  -- Näringsliv
  ('Dagens industri'),
  ('SVD Näringsliv'),
  -- Lokalt
  ('SVT Stockholm'),
  -- Kultur
  ('Kulturnytt')
ON CONFLICT (source_name) DO NOTHING;

-- 2. Lägg till user_id i archived_articles
-- ----------------------------------------------------------------
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Migrera befintliga rader till den autentiserade användaren (Andreas)
UPDATE archived_articles
SET user_id = (
  SELECT id FROM auth.users
  WHERE is_anonymous IS NOT TRUE
  ORDER BY created_at LIMIT 1
)
WHERE user_id IS NULL;

-- Byt primärnyckel till kompositnyckel (id, user_id) så olika
-- användare kan arkivera samma artikel utan konflikt
ALTER TABLE archived_articles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE archived_articles DROP CONSTRAINT IF EXISTS archived_articles_pkey;
ALTER TABLE archived_articles ADD PRIMARY KEY (id, user_id);

-- 3. Lägg till user_id i read_articles
-- ----------------------------------------------------------------
ALTER TABLE read_articles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

UPDATE read_articles
SET user_id = (
  SELECT id FROM auth.users
  WHERE is_anonymous IS NOT TRUE
  ORDER BY created_at LIMIT 1
)
WHERE user_id IS NULL;

ALTER TABLE read_articles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE read_articles DROP CONSTRAINT IF EXISTS read_articles_pkey;
ALTER TABLE read_articles ADD PRIMARY KEY (article_id, user_id);

-- 4. Aktivera RLS
-- ----------------------------------------------------------------
ALTER TABLE news_articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_articles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_feeds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings          ENABLE ROW LEVEL SECURITY;

-- 5. Rensa gamla alltför öppna policyer
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "public read"             ON news_articles;
DROP POLICY IF EXISTS "public all"              ON archived_articles;
DROP POLICY IF EXISTS "public read"             ON feed_config;
DROP POLICY IF EXISTS "public write"            ON feed_config;
DROP POLICY IF EXISTS "auth read_articles all"  ON read_articles;
DROP POLICY IF EXISTS "anon_read_public_news"   ON news_articles;
DROP POLICY IF EXISTS "auth_read_all_news"      ON news_articles;
DROP POLICY IF EXISTS "user_archives"           ON archived_articles;
DROP POLICY IF EXISTS "user_reads"              ON read_articles;
DROP POLICY IF EXISTS "auth_feed_config"        ON feed_config;
DROP POLICY IF EXISTS "public_feeds_read"       ON public_feeds;

-- 6. news_articles: anon ser bara public_feeds-källor; auth ser allt
-- ----------------------------------------------------------------
CREATE POLICY "anon_read_public_news" ON news_articles
  FOR SELECT TO anon
  USING (source IN (SELECT source_name FROM public_feeds WHERE enabled = true));

CREATE POLICY "auth_read_all_news" ON news_articles
  FOR SELECT TO authenticated
  USING (true);

-- 7. archived_articles: varje användare ser bara sina egna
-- ----------------------------------------------------------------
CREATE POLICY "user_archives" ON archived_articles
  FOR ALL USING (auth.uid() = user_id);

-- 8. read_articles: varje användare ser bara sina egna
-- ----------------------------------------------------------------
CREATE POLICY "user_reads" ON read_articles
  FOR ALL USING (auth.uid() = user_id);

-- 9. feed_config: bara authenticated
-- ----------------------------------------------------------------
CREATE POLICY "auth_feed_config" ON feed_config
  FOR ALL TO authenticated
  USING (true);

-- 10. public_feeds: alla kan läsa (krävs för RLS-policyutvärdering)
-- ----------------------------------------------------------------
CREATE POLICY "public_feeds_read" ON public_feeds
  FOR SELECT USING (true);

-- briefings-policyer finns redan från add_read_and_briefings.sql
-- (auth-only read, service-role insert/update) — behöver ej ändras.
