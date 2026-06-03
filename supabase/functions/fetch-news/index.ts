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
      ['Skatteverket',   'https://www.skatteverket.se/rss/nyheter.rss',  true],
      ['HFD nyheter',    'https://www.domstol.se/hfd/feed',              true],
      ['PwC Tax Matters','https://taxmatters.pwc.se/feed',               true],
    ],
  },
  sverige: {
    label: 'Sverige', hue: 0,
    sources: [
      ['SVT Nyheter', 'https://www.svt.se/nyheter/rss.xml', true],
    ],
  },
  teknik: {
    label: 'Teknik', hue: 220,
    sources: [
      ['The Verge',   'https://www.theverge.com/rss/index.xml',            true],
      ['Feber',       'https://feber.se/rss/',                             true],
      ['Ars Technica','https://feeds.arstechnica.com/arstechnica/index',   false],
      ['Hacker News', 'https://hnrss.org/frontpage',                       false],
    ],
  },
  varlden: {
    label: 'Världen', hue: 280,
    sources: [
      ['Reuters',  'https://feeds.reuters.com/reuters/worldNews',     true],
      ['BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml',     true],
    ],
  },
  naringsliv: {
    label: 'Näringsliv', hue: 150,
    sources: [
      ['Dagens industri', 'https://www.di.se/rss',                                       true],
      ['SVD Näringsliv',  'https://www.svd.se/?service=rss&type=section&id=24561',       true],
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
      signal:  AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv,en;q=0.9',
      },
    })
    const html = await resp.text()
    const m = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
    if (m) {
      const rawUrl = m[1] || m[2] || ''
      return rawUrl.replace(/&amp;/g, '&').trim()
    }
    return ''
  } catch {
    return ''
  }
}

function findFeedImage(block: string): string {
  // Try media:content url="..."
  let m = block.match(/<media:content[^>]+url=["']([^"']+)["']/i)
  if (m) return m[1]
  
  // Try media:thumbnail url="..."
  m = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
  if (m) return m[1]
  
  // Try enclosure url="..."
  m = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)
  if (m) return m[1]
  
  // Try atom enclosure link rel="enclosure" href="..." or vice versa
  m = block.match(/<link[^>]+rel=["']enclosure["'][^>]+href=["']([^"']+)["']/i)
  if (m) return m[1]
  m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']enclosure["']/i)
  if (m) return m[1]
  
  return ''
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
    const feedImage = findFeedImage(block)

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
      image:        feedImage,
      featured:     false,
      published_at: ok ? dt!.toISOString() : null,
      fetched_at:   new Date().toISOString(),
    })
  }
  return articles
}

Deno.serve(async () => {
  try {
    const { data: row } = await db.from('feed_config').select('feeds, categories').eq('id', 1).single()
    const feedConfig: Record<string, Array<{name: string; url: string; enabled: boolean}>> = row?.feeds ?? {}
    const customCats: Array<{key: string; label: string; hue: number}> = row?.categories ?? []

    const allFeeds: Record<string, Category> = { ...DEFAULT_FEEDS }

    // Lägg till kategorier från feed_config.categories (admin-skapade)
    for (const cat of customCats) {
      if (!allFeeds[cat.key]) {
        allFeeds[cat.key] = { label: cat.label, hue: cat.hue, sources: [] }
      }
    }

    // Lägg till eventuella kategorier i feed_config.feeds som ännu inte finns
    // (t.ex. Sverige-kategorin som är en default-kategori men saknas i customCats)
    for (const catKey of Object.keys(feedConfig)) {
      if (!allFeeds[catKey]) {
        const label = catKey.charAt(0).toUpperCase() + catKey.slice(1)
        allFeeds[catKey] = { label, hue: 200, sources: [] }
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

    // Hämta og:image för de 20 nyaste artiklarna som saknar bild från flödet
    const needsOgImage = articles.filter(a => !a.image && a.link).slice(0, 20)
    await Promise.all(
      needsOgImage.map(async a => {
        a.image = await fetchOgImage(a.link as string)
      })
    )

    const { error } = await db.from('news_articles').upsert(articles, { onConflict: 'id' })
    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`)
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
  } catch (err) {
    console.error("Critical error during news fetch:", err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
