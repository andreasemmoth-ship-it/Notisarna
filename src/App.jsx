import React, { Component, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { NEWS_TABS, NEWS_CATEGORY_KEYS } from './data.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
// Publicerade artiklar (slug, titel, beskrivning, datum), senaste först. Se vite.config.js.
import POSTS from 'virtual:posts'

// Besökare loggas inte in; klienten används bara för att läsa nyheter.
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const PAGE_SIZE = 30
const mapArticle = (row) => ({ ...row, categoryKey: row.category_key, date: row.date_sv })


// ----- Error Boundary -----
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'oklch(0.97 0.008 80)',
          fontFamily: 'Inter Tight, system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', padding: '40px', maxWidth: '420px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: '#0a0a0a',
              color: '#fff', display: 'grid', placeItems: 'center',
              fontFamily: 'Instrument Serif, serif', fontSize: 40,
              fontStyle: 'italic', margin: '0 auto 24px',
            }}>N</div>
            <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 12 }}>
              Något gick fel
            </h1>
            <p style={{ color: 'oklch(0.45 0.01 60)', marginBottom: 24, lineHeight: 1.6 }}>
              Notiserna stötte på ett oväntat fel. Prova att ladda om sidan — om problemet kvarstår är Supabase tillfälligt nere.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', borderRadius: 10, background: '#0a0a0a',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              }}
            >
              Ladda om sidan
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function placeholderBg(hue) {
  const h = hue ?? 200
  const h2 = (h + 40) % 360
  return `linear-gradient(135deg, oklch(0.78 0.10 ${h}) 0%, oklch(0.62 0.13 ${h2}) 100%)`
}

function optimizeImageUrl(url) {
  if (!url) return url
  if (url.includes('svt') && url.includes('/1200/')) {
    return url.replace('/1200/', '/600/')
  }
  return url
}


const Icon = ({ name, size = 16 }) => {
  const paths = {
    search:        <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    arrow:         <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    rss:           <><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/></>,
    rows:          <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
    grid:          <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    'book-open':   <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    moon:          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
    sun:           <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    info:          <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

// ----- Cards -----
// Nyheter öppnas hos källan i ny flik; egna artiklar öppnas på sajten.
function linkProps(item) {
  if (!item.link) return { href: '#' }
  if (item.link.startsWith('/')) return { href: item.link }
  return { href: item.link, target: '_blank', rel: 'noopener noreferrer' }
}

function HeroCard({ item }) {
  return (
    <article className="hero-card">
      <div className="hero-card__media" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={optimizeImageUrl(item.image)} alt="" className="media-img"
                 loading="lazy" decoding="async"
                 onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>
      <div className="hero-card__body">
        <div className="hero-card__meta">
          <span className="cat-tag" data-hue={item.hue}>{item.category}</span>
          <span className="dot-sep">·</span>
          <span>{item.source}</span>
          <span className="dot-sep">·</span>
          <span>{item.date}</span>
        </div>
        <h1 className="hero-card__title">{item.headline}</h1>
        <p className="hero-card__summary">{item.summary}</p>
        <div className="card__footer">
          <a {...linkProps(item)} className="read-more">
            {item.cta ?? 'Läs hela artikeln'} <Icon name="arrow" size={15} />
          </a>
        </div>
      </div>
    </article>
  )
}

function NewsCard({ item }) {
  return (
    <article className="news-card">
      <div className="news-card__media" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={optimizeImageUrl(item.image)} alt="" className="media-img"
                 loading="lazy" decoding="async"
                 onError={e => { e.target.style.display = 'none' }} />
        )}
        <span className="cat-tag cat-tag--overlay" data-hue={item.hue}>{item.category}</span>
      </div>
      <div className="news-card__body">
        <div className="news-card__meta">
          <span>{item.source}</span>
          <span className="dot-sep">·</span>
          <span>{item.date}</span>
        </div>
        <h3 className="news-card__title">{item.headline}</h3>
        <p className="news-card__summary">{item.summary}</p>
        <div className="card__footer">
          <a {...linkProps(item)} className="read-more read-more--small">
            {item.cta ?? 'Läs mer'} <Icon name="arrow" size={13} />
          </a>
        </div>
      </div>
    </article>
  )
}

function CompactCard({ item }) {
  return (
    <div className="compact-row">
      <div className="compact-row__img" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={optimizeImageUrl(item.image)} alt="" className="media-img"
               loading="lazy" decoding="async"
               onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>
      <div className="compact-row__text">
        <a {...linkProps(item)} className="compact-row__title">
          {item.headline}
        </a>
        <span className="compact-row__meta">
          {item.source}<span className="dot-sep"> · </span>{item.date}
        </span>
      </div>
    </div>
  )
}

// ----- Nav -----
function Nav({ query, setQuery, active, onGoHome, onShowArticles, colorScheme, onToggleTheme }) {
  return (
    <header className="nav">
      <a className="nav__brand" href="/" onClick={e => { e.preventDefault(); onGoHome() }}>
        <div className="nav__logo">N</div>
        <div className="nav__name">Notiserna</div>
      </a>
      <nav className="nav__links" aria-label="Huvudmeny">
        <a href="/" onClick={e => { e.preventDefault(); onGoHome() }}
           className={active !== 'artiklar' ? 'is-active' : ''}>Nyheter</a>
        <a href="/artiklar" onClick={e => { e.preventDefault(); onShowArticles() }}
           className={active === 'artiklar' ? 'is-active' : ''}>Artiklar</a>
        <a href="/om">Om</a>
      </nav>
      <div className="nav__right">
        <div className="nav__search">
          <Icon name="search" size={14} />
          <input placeholder="Sök…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="icon-btn theme-toggle" onClick={onToggleTheme}
                title={colorScheme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}>
          <Icon name={colorScheme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  )
}

// ----- MobileNav -----
function MobileNav({ active, onGoHome, onShowArticles }) {
  return (
    <nav className="mobile-nav" aria-label="Huvudmeny">
      <a className={`mobile-nav__item ${active !== 'artiklar' ? 'is-active' : ''}`} href="/"
         onClick={e => { e.preventDefault(); onGoHome() }}>
        <Icon name="rss" size={20} />
        <span>Nyheter</span>
      </a>
      <a className={`mobile-nav__item ${active === 'artiklar' ? 'is-active' : ''}`} href="/artiklar"
         onClick={e => { e.preventDefault(); onShowArticles() }}>
        <Icon name="book-open" size={20} />
        <span>Artiklar</span>
      </a>
      <a className="mobile-nav__item" href="/om">
        <Icon name="info" size={20} />
        <span>Om</span>
      </a>
    </nav>
  )
}

// ----- Egna artiklar som kort i flödet -----
const postDateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const POST_ITEMS = POSTS.map(post => ({
  id: `post-${post.slug}`,
  category: 'Artikel',
  source: 'Notiserna',
  date: postDateFormat.format(new Date(`${post.datum}T00:00:00Z`)),
  headline: post.titel,
  summary: post.beskrivning,
  link: `/artiklar/${post.slug}`,
  image: post.bild || '/images/blogg/notiserna.jpeg',
  hue: 220,
  cta: 'Läs artikeln',
}))

function formatUpdated(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function App() {
  const [active,        setActive]        = useState(() => {
    const cat = new URLSearchParams(window.location.search).get('cat')
    return NEWS_TABS.some(t => t.key === cat) ? cat : 'all'
  })
  const [query,         setQuery]         = useState(() =>
    new URLSearchParams(window.location.search).get('q') ?? ''
  )
  const [news,          setNews]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [updatedAt,     setUpdatedAt]     = useState(null)
  const [viewMode,      setViewMode]      = useState(() => localStorage.getItem('viewMode') || 'grid')
  const [hasMore,       setHasMore]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const loadedCount = useRef(PAGE_SIZE)
  const newsGeneration = useRef(0)
  const [newsError, setNewsError] = useState('')

  // Mörkt/ljust läge
  const [colorScheme, setColorScheme] = useState(() => {
    const stored = localStorage.getItem('colorScheme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const toggleTheme = useCallback(() => {
    setColorScheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('colorScheme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorScheme)
  }, [colorScheme])

  // Scroll to top when active view/tab changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [active])

  // Synka flik/sökning → URL (delningsbara länkar)
  useEffect(() => {
    const p = new URLSearchParams()
    if (active !== 'all')      p.set('cat', active)
    if (query.trim())          p.set('q', query.trim())
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname)
  }, [active, query])

  const goHome = useCallback(() => {
    setActive('all')
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const changeViewMode = useCallback((mode) => {
    setViewMode(mode)
    localStorage.setItem('viewMode', mode)
  }, [])

  // Filtrera före paginering så varje flik får egna, kompletta sidor.
  const newsQuery = useCallback(() => {
    let request = db.from('news_articles').select('*')
    if (active === 'all') {
      request = request.in('category_key', NEWS_CATEGORY_KEYS).not('image', 'is', null).neq('image', '')
    } else {
      request = request.eq('category_key', active)
    }
    return request.order('published_at', { ascending: false }).order('id')
  }, [active])

  const fetchNews = useCallback(() => {
    const generation = newsGeneration.current
    const limit = loadedCount.current
    return newsQuery().range(0, limit - 1).then(({ data, error }) => {
      if (generation !== newsGeneration.current) return
      if (error) { setNewsError('Kunde inte hämta nyheter. Försök igen om en stund.'); return }
      if (limit < loadedCount.current) return
      const articles = (data || []).map(mapArticle)
      setNewsError('')
      setNews(articles)
      loadedCount.current = Math.max(PAGE_SIZE, articles.length)
      setHasMore(articles.length === limit)
      setUpdatedAt(articles[0]?.fetched_at ?? null)
    }).finally(() => {
      if (generation === newsGeneration.current) setLoading(false)
    })
  }, [newsQuery])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const generation = newsGeneration.current
    const from = news.length
    newsQuery().range(from, from + PAGE_SIZE - 1).then(({ data, error }) => {
      if (generation !== newsGeneration.current) return
      if (error) { setNewsError('Kunde inte ladda fler nyheter. Försök igen.'); return }
      setNewsError('')
      const articles = (data || []).map(mapArticle)
      setNews(prev => {
        const ids = new Set(prev.map(item => item.id))
        return [...prev, ...articles.filter(item => !ids.has(item.id))]
      })
      loadedCount.current = from + articles.length
      setHasMore(articles.length === PAGE_SIZE)
    }).finally(() => {
      if (generation === newsGeneration.current) setLoadingMore(false)
    })
  }, [newsQuery, news.length, loadingMore, hasMore])

  useEffect(() => {
    newsGeneration.current += 1
    loadedCount.current = PAGE_SIZE
    setNews([])
    setUpdatedAt(null)
    setLoadingMore(false)
    setNewsError('')
    // Artikelfliken visar egna artiklar och behöver ingen hämtning.
    if (active === 'artiklar') {
      setLoading(false)
      setHasMore(false)
      return
    }
    setLoading(true)
    setHasMore(true)
    fetchNews()
    const interval = setInterval(fetchNews, 60000)
    let refreshTimer
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(fetchNews, 500)
    }
    const channel = db.channel('news-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, scheduleRefresh)
      .subscribe()
    return () => {
      newsGeneration.current += 1
      clearInterval(interval)
      clearTimeout(refreshTimer)
      db.removeChannel(channel)
    }
  }, [fetchNews, active])

  const filtered = useMemo(() => {
    let list = news
    if (active === 'artiklar') list = POST_ITEMS
    else if (active === 'all') list = list.filter(i => NEWS_CATEGORY_KEYS.includes(i.categoryKey))
    else list = list.filter(i => i.categoryKey === active)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(i =>
        i.headline.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [news, active, query])

  // Herokortet på startsidan är den senaste egna artikeln, annars en utvald nyhet.
  const featured = useMemo(() => {
    if (active === 'all' && POST_ITEMS.length > 0) return POST_ITEMS[0]
    return filtered.find(i => i.featured) || filtered[0]
  }, [filtered, active])

  const rest = useMemo(() => {
    return filtered.filter(i => i.id !== featured?.id)
  }, [filtered, featured])

  const showHero = featured && active === 'all' && !query

  return (
    <div className="shell">
      <Nav query={query} setQuery={setQuery} active={active}
           onGoHome={goHome} onShowArticles={() => setActive('artiklar')}
           colorScheme={colorScheme} onToggleTheme={toggleTheme} />

      <div className="filter-bar">
        <div className="filter-bar__inner">
          {NEWS_TABS.map(c => (
            <button key={c.key}
                    className={`pill ${active === c.key ? 'is-active' : ''}`}
                    onClick={() => setActive(c.key)}
                    aria-pressed={active === c.key}>
              {c.label}
              {active === c.key && <span className="pill__count">{filtered.length}</span>}
            </button>
          ))}
          <div className="filter-bar__tools">
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                      onClick={() => changeViewMode('grid')} title="Rutnät">
                <Icon name="grid" size={15} />
              </button>
              <button className={`view-btn ${viewMode === 'compact' ? 'is-active' : ''}`}
                      onClick={() => changeViewMode('compact')} title="Kompakt lista">
                <Icon name="rows" size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="content">
        {newsError && <div className="empty" role="alert"><p>{newsError}</p></div>}
        {loading && <div className="empty"><p>Hämtar nyheter…</p></div>}
        {!loading && !newsError && filtered.length === 0 && (
          <div className="empty">
            <h3>Inga artiklar matchar</h3>
            <p>Prova att rensa sökningen eller välj en annan flik.</p>
          </div>
        )}

        {!loading && viewMode === 'grid' && (
          <>
            {showHero && <HeroCard item={featured} />}
            <div className="grid">
              {(showHero ? rest : filtered).map(item => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}

        {!loading && viewMode === 'compact' && (
          <div className="compact-list">
            {filtered.map(item => (
              <CompactCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="load-more">
            <button className="btn btn--ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Hämtar…' : 'Ladda fler nyheter'}
            </button>
          </div>
        )}
      </main>

      <footer className="foot">
        <div className="foot__rule" />
        <div className="foot__row">
          <span>
            © Notiserna 2026
            {' · '}
            <a className="foot__privacy-link" href="/om">Om sajten</a>
            {' · '}
            <a className="foot__privacy-link" href="/integritet">Integritetspolicy</a>
          </span>
          <span>{updatedAt ? `Uppdaterad ${formatUpdated(updatedAt)}` : 'Uppdateras var 15:e minut'}</span>
        </div>
      </footer>

      <MobileNav active={active} onGoHome={goHome} onShowArticles={() => setActive('artiklar')} />
    </div>
  )
}

export { ErrorBoundary }
export default App
