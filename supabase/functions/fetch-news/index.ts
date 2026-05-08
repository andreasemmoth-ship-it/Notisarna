import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SV_MONTHS = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']
const MAX_ITEMS   = 5
const MAX_SUMMARY = 220

type Source   = [name: string, url: string, enabled: boolean]
type Category = { label: string; hue: number; sources: Source[] }

const DEFAULT_FEEDS: Record<string, Category> = {
  skatt: {
    label: 'Skatt & juridik', hue: 24,
    sources: [
      ['SKV Rättslig vägledning 1', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.71e0e530146a50ea9ac139', true],
      ['SKV Rättslig vägledning 2', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.669f7efe1468ee8b548162e', true],
      ['SKV Rättslig vägledning 3', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.703cf5a5146ada421629626', true],
      ['SKV Rättslig vägledning 4', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.703cf5a5146ada421629657', true],
      ['SKV Rättslig vägledning 5', 'https://www4.skatteverket.se/4.5606ef3015064c8c07415c5/12.5606ef3015064c8c07415cd.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8&feed=4.669f7efe1468ee8b548161f', true],
      ['Skatterättsnämnden', 'https://skatterattsnamnden.se/4.14dfc9b0163796ee3e77aa3a/12.14dfc9b0163796ee3e77aa45.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8', true],
      ['PwC Tax Matters', 'https://blogg.pwc.se/taxmatters/rss.xml', true],
      ['HFD nyheter', 'https://www.domstol.se/feed/56/?searchPageId=1092&scope=news', true],
    ],
  },
  teknik: {
    label: 'Teknik', hue: 220,
    sources: [
      ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', true],
      ['The Verge',    'https://www.theverge.com/rss/index.xml',           true],
      ['Hacker News',  'https://hnrss.org/frontpage',                      false],
    ],
  },
  varlden: {
    label: 'Världen', hue: 280,
    sources: [
      ['Reuters',  'https://feeds.reuters.com/reuters/worldNews',      true],
      ['BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml',      true],
    ],
  },
  naringsliv: {
    label: 'Näringsliv', hue: 150,
    sources: [
      ['Dagens industri', 'https://www.di.se/rss',                                         true],
      ['SVD Näringsliv',  'https://www.svd.se/?service=rss&type=section&id=24561',         true],
    ],
  },
  lokalt: {
    label: 'Lokalt', hue: 60,
    sources: [
      ['SVT Stockholm',    'https://www.svt.se/nyheter/lokalt/stockholm/rss.xml', true],
      ['Göteborgs-Posten', 'https://www.gp.se/rss',                               false],
    ],
  },
  kultur: {
    label: 'Kultur', hue: 320,
    sources: [
      ['Kulturnytt', 'https://api.sr.se/api/rss/program/2795', true],
      ['Pitchfork',  'https://pitchfork.com/rss/news/',        false],
    ],
  },
}

function svDate(d: Date) {
  return `${d.getDate()} ${SV_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function clean(text: string) {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function makeId(catKey: string, str: string): Promise<string> {
  const buf  = new TextEncoder().encode(`${catKey}:${str}`)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  const hex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${catKey}_${hex.slice(0, 8)}`
}

async function fetchOgImage(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      signal:  AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Notiserna-bot/1.0' },
    })
    const html = await resp.text()
    const m = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
    return m ? (m[1] || m[2] || '') : ''
  } catch {
    return ''
  }
}

function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function xmlAttr(block: string, tag: string, attr: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, 'i'))
  return m ? m[1] : ''
}

function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi')
  return Array.from(xml.matchAll(re), m => m[0]).slice(0, MAX_ITEMS)
}

async function parseFeed(
  xml: string, source: string, catKey: string, catLabel: string, hue: number,
) {
  const isAtom = /<feed[\s>]/i.test(xml)
  const blocks = isAtom ? xmlBlocks(xml, 'entry') : xmlBlocks(xml, 'item')

  const articles = []
  for (const block of blocks) {
    let title: string, summary: string, pub: string, link: string
    if (isAtom) {
      title   = clean(xmlTag(block, 'title'))
      summary = clean(xmlTag(block, 'summary') || xmlTag(block, 'content'))
      pub     = xmlTag(block, 'published') || xmlTag(block, 'updated')
      link    = xmlAttr(block, 'link', 'href') || xmlTag(block, 'link')
    } else {
      title   = clean(xmlTag(block, 'title'))
      summary = clean(xmlTag(block, 'description'))
      pub     = xmlTag(block, 'pubDate')
      link    = xmlTag(block, 'link')
    }
    if (!title) continue

    const dt  = pub ? new Date(pub) : null
    const ok  = dt && !isNaN(dt.getTime())
    const id  = await makeId(catKey, link || title)
    const sum = summary.length > MAX_SUMMARY ? summary.slice(0, MAX_SUMMARY) + '…' : summary

    articles.push({
      id,
      category:     catLabel,
      category_key: catKey,
      source,
      date_sv:      ok ? svDate(dt!) : '',
      headline:     title,
      summary:      sum,
      hue,
      link,
      image:        '',
      featured:     false,
      published_at: ok ? dt!.toISOString() : null,
      fetched_at:   new Date().toISOString(),
    })
  }
  return articles
}

Deno.serve(async () => {
  const { data: row } = await db.from('feed_config').select('feeds, categories').eq('id', 1).single()
  const feedConfig: Record<string, Array<{name: string; url: string; enabled: boolean}>> = row?.feeds ?? {}
  const customCats: Array<{key: string; label: string; hue: number}> = row?.categories ?? []

  const allFeeds: Record<string, Category> = { ...DEFAULT_FEEDS }
  for (const cat of customCats) {
    if (!allFeeds[cat.key]) {
      allFeeds[cat.key] = { label: cat.label, hue: cat.hue, sources: [] }
    }
  }

  const articles: Record<string, unknown>[] = []

  for (const [catKey, cat] of Object.entries(allFeeds)) {
    const sources: Source[] = feedConfig[catKey]
      ? feedConfig[catKey].map(f => [f.name, f.url, f.enabled] as Source)
      : cat.sources

    for (const [name, url, enabled] of sources) {
      if (!enabled) continue
      console.log(`Fetching ${name}…`)
      try {
        const resp = await fetch(url, {
          signal:  AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Notiserna-bot/1.0' },
        })
        const items = await parseFeed(await resp.text(), name, catKey, cat.label, cat.hue)
        articles.push(...items)
        console.log(`  → ${items.length} artiklar`)
      } catch (err) {
        console.error(`  SKIP ${url}: ${err}`)
      }
    }
  }

  articles.sort((a, b) => ((b.published_at as string) > (a.published_at as string) ? 1 : -1))
  if (articles[0]) articles[0].featured = true

  // OG-bilder för de 20 nyaste
  for (const a of articles.slice(0, 20)) {
    if (a.link) a.image = await fetchOgImage(a.link as string)
  }

  const { error } = await db.from('news_articles').upsert(articles, { onConflict: 'id' })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { count: dbCount } = await db.from('news_articles').select('*', { count: 'exact', head: true })

  const oldestDate = articles.reduce((min, a) => {
    if (!a.published_at) return min
    return !min || (a.published_at as string) < min ? (a.published_at as string) : min
  }, '' as string)

  // Rensa artiklar äldre än 30 dagar
  await db.from('news_articles')
    .delete()
    .lt('published_at', new Date(Date.now() - 30 * 86400_000).toISOString())

  return new Response(JSON.stringify({ parsed: articles.length, dbCount, oldestDate, ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
