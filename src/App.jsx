import React, { Component, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { NEWS_TABS, NEWS_CATEGORY_KEYS } from './data.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

// Besökare loggas inte in; klienten används bara för att läsa nyheter.
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const PAGE_SIZE = 30
const mapArticle = (row) => ({ ...row, categoryKey: row.category_key, date: row.date_sv })


// ----- Markdown / Frontmatter Parser & Static Posts Loader -----
function parseFrontmatter(markdownText) {
  const match = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { attributes: {}, body: markdownText }
  
  const yamlBlock = match[1]
  const body = match[2]
  const attributes = {}
  
  yamlBlock.split('\n').forEach(line => {
    const parts = line.split(':')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      let value = parts.slice(1).join(':').trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1)
      }
      attributes[key] = value
    }
  })
  
  return { attributes, body }
}

function renderMarkdown(md) {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')

  let inList = false
  const lines = html.split('\n')
  const processedLines = lines.map(line => {
    const listMatch = line.match(/^[\*\-]\s+(.*?)$/)
    if (listMatch) {
      let result = ''
      if (!inList) {
        inList = true
        result += '<ul>'
      }
      result += `<li>${listMatch[1]}</li>`
      return result
    } else {
      let result = ''
      if (inList) {
        inList = false
        result += '</ul>'
      }
      result += line
      return result
    }
  })
  if (inList) {
    processedLines.push('</ul>')
  }
  html = processedLines.join('\n')

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  html = html.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<h') || trimmed.startsWith('</h') || trimmed.startsWith('<ul') || trimmed.startsWith('</ul') || trimmed.startsWith('<li') || trimmed.startsWith('</li')) {
      return line
    }
    return `<p>${line}</p>`
  }).join('\n')

  return html
}

const rawPosts = import.meta.glob('./content/posts/*.md', { query: '?raw', import: 'default', eager: true })

// Endast artiklar med publicerad: true visas.
const POSTS = Object.entries(rawPosts).map(([path, content]) => ({ path, ...parseFrontmatter(content) }))
  .filter(({ attributes }) => attributes.publicerad === 'true')
  .map(({ path, attributes, body }) => {
  const sources = []
  let index = 1
  while (attributes[`source_url_${index}`]) {
    sources.push({
      url: attributes[`source_url_${index}`],
      title: attributes[`source_title_${index}`] || attributes[`source_url_${index}`]
    })
    index++
  }
  if (attributes.source_url) {
    sources.push({
      url: attributes.source_url,
      title: attributes.source_title || attributes.source_url
    })
  }
  return {
    title: attributes.title || 'Utan titel',
    date: attributes.date || '',
    description: attributes.description || '',
    image: attributes.image || '',
    sources,
    slug: attributes.slug || path.split('/').pop().replace('.md', ''),
    body,
  }
}).sort((a, b) => (b.date > a.date ? 1 : -1))

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
    close:         <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
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

// ----- Privacy modal -----
function PrivacyModal({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="privacy-modal" onClick={e => e.stopPropagation()}>
        <button className="reader-close" onClick={onClose} title="Stäng (Esc)">
          <Icon name="close" size={18} />
        </button>
        <h2>Integritetspolicy</h2>
        <p className="privacy-updated">Senast uppdaterad: juni 2026</p>

        <h3>Vad vi samlar in</h3>
        <p>Notiserna använder anonym inloggning (via Supabase) för att ge dig en personlig upplevelse utan att du behöver skapa ett konto. Vi sparar:</p>
        <ul>
          <li>Ett anonymt sessions-ID i din webbläsare (via cookie/localStorage)</li>
          <li>Vilka artiklar du har markerat som lästa</li>
          <li>Artiklar du sparar till arkivet</li>
        </ul>
        <p>Om du väljer att skapa ett konto sparas dessutom din e-postadress hos Supabase.</p>

        <h3>Varför</h3>
        <p>Data används uteslutande för att visa rätt läst/oläst-status och bevara ditt arkiv mellan besök. Vi säljer eller delar aldrig din data med tredje part.</p>

        <h3>Tredjepartstjänster</h3>
        <ul>
          <li><strong>Supabase</strong> — databas och autentisering (servrar inom EU)</li>
          <li><strong>Vercel</strong> — hosting och anonymiserad besöksstatistik (ingen spårning av individer)</li>
        </ul>

        <h3>Dina rättigheter</h3>
        <p>Du kan när som helst begära att din data raderas genom att kontakta <a href="mailto:andreas.emmoth@gmail.com">andreas.emmoth@gmail.com</a>. Anonym data raderas automatiskt om du inte loggat in på 90 dagar.</p>

        <div className="privacy-modal__footer">
          <button className="btn btn--primary" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  )
}

// ----- Om Notiserna -----
function AboutModal({ onClose, onOpenPrivacy }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        <button className="reader-close" onClick={onClose} title="Stäng (Esc)">
          <Icon name="close" size={18} />
        </button>

        <div className="about-modal__logo">N</div>
        <h2>Om Notiserna</h2>
        <p className="about-modal__lead">
          Notiserna samlar nyheter från svenska och internationella källor i ett personligt flöde — utan algoritmer, utan reklam, uppdaterat var 15:e minut.
        </p>

        <h3>Vem driver sajten?</h3>
        <p>
          Notiserna är ett personligt projekt byggt med React och Supabase.
          Sajten drivs av <a href="mailto:andreas.emmoth@gmail.com">Andreas Emmoth</a>.
        </p>

        <div className="about-modal__footer">
          <button className="btn btn--ghost btn--sm" onClick={() => { onClose(); onOpenPrivacy() }}>
            Integritetspolicy <Icon name="arrow" size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ----- GDPR banner -----
function GdprBanner({ onAccept, onOpenPrivacy }) {
  return (
    <div className="gdpr-banner">
      <p className="gdpr-banner__text">
        Vi använder cookies och anonym inloggning för att spara bokmärken och lästa artiklar.{' '}
        <button className="gdpr-link" onClick={onOpenPrivacy}>Läs mer</button>
      </p>
      <button className="btn btn--primary btn--sm" onClick={onAccept}>
        Jag förstår
      </button>
    </div>
  )
}

// ----- Cards -----
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
          <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
             rel="noopener noreferrer" className="read-more">
            Läs hela artikeln <Icon name="arrow" size={15} />
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
          <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
             rel="noopener noreferrer" className="read-more read-more--small">
            Läs mer <Icon name="arrow" size={13} />
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
        <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
           rel="noopener noreferrer" className="compact-row__title">
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
function Nav({ query, setQuery, active, onSetActive, onGoHome, onOpenAbout, colorScheme, onToggleTheme }) {
  return (
    <header className="nav">
      <button className="nav__brand" onClick={onGoHome}>
        <div className="nav__logo">N</div>
        <div className="nav__name">Notiserna</div>
      </button>
      <nav className="nav__links">
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('all') }}
           className={active !== 'artiklar' ? 'is-active' : ''}>Nyheter</a>
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('artiklar') }}
           className={active === 'artiklar' ? 'is-active' : ''}>Artiklar</a>
        <a href="#" onClick={e => { e.preventDefault(); onOpenAbout() }}>Om</a>
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
function MobileNav({ active, onSetActive, onOpenAbout }) {
  return (
    <nav className="mobile-nav">
      <button 
        className={`mobile-nav__item ${active !== 'artiklar' ? 'is-active' : ''}`}
        onClick={() => onSetActive('all')}
      >
        <Icon name="rss" size={20} />
        <span>Nyheter</span>
      </button>
      <button 
        className={`mobile-nav__item ${active === 'artiklar' ? 'is-active' : ''}`}
        onClick={() => onSetActive('artiklar')}
      >
        <Icon name="book-open" size={20} />
        <span>Artiklar</span>
      </button>
      <button 
        className="mobile-nav__item"
        onClick={onOpenAbout}
      >
        <Icon name="info" size={20} />
        <span>Om</span>
      </button>
    </nav>
  )
}

// ----- Senaste artiklarna (visas ovanför nyhetsflödet) -----
function LatestPosts({ posts, onOpen, onShowAll }) {
  if (posts.length === 0) return null
  return (
    <section className="latest-posts" aria-labelledby="latest-posts-title">
      <div className="latest-posts__head">
        <h2 id="latest-posts-title" className="latest-posts__title">Senaste från Notiserna</h2>
        <a href="?view=artiklar" className="latest-posts__all"
           onClick={e => { e.preventDefault(); onShowAll() }}>
          Alla artiklar <Icon name="arrow" size={13} />
        </a>
      </div>
      <div className="latest-posts__list">
        {posts.slice(0, 3).map(post => (
          <a key={post.slug} href={`?view=artiklar&slug=${post.slug}`} className="latest-post"
             onClick={e => { e.preventDefault(); onOpen(post.slug) }}>
            <span className="latest-post__date">{post.date}</span>
            <span className="latest-post__title">{post.title}</span>
            <span className="latest-post__desc">{post.description}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

// ----- ArticleView Component -----
function ArticleView({ slug, onBack, onBackToFlow }) {
  const post = useMemo(() => POSTS.find(p => p.slug === slug), [slug])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  if (!post) {
    return (
      <div className="empty">
        <h3>Artikeln hittades inte</h3>
        <p>Den artikel du söker verkar inte finnas kvar.</p>
        <button className="btn btn--primary" onClick={onBack}>Tillbaka</button>
      </div>
    )
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?view=artiklar&slug=${post.slug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const htmlContent = useMemo(() => renderMarkdown(post.body), [post.body])

  return (
    <article className="article-view">
      <div className="article-view__back-wrapper">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          <Icon name="arrow" size={13} style={{ transform: 'rotate(180deg)', marginRight: '4px' }} /> Tillbaka till artiklar
        </button>
      </div>

      <header className="article-view__header">
        <div className="article-view__meta">
          <span>EGEN ARTIKEL</span>
          <span className="dot-sep">·</span>
          <span>{post.date}</span>
        </div>
        <h1 className="article-view__title">{post.title}</h1>
        {post.description && <p className="article-view__lead">{post.description}</p>}
        {post.image && (
          <div className="article-view__featured-image-wrapper">
            <img src={post.image} alt={post.title} className="article-view__featured-image" />
          </div>
        )}
      </header>

      <div className="article-view__content" dangerouslySetInnerHTML={{ __html: htmlContent }} />

      {post.sources && post.sources.length > 0 && (
        <div className="article-view__sources">
          <span className="article-view__sources-label">Källor &amp; vidareläsning:</span>
          <ul className="article-view__sources-list">
            {post.sources.map((src, i) => (
              <li key={i} className="article-view__sources-item">
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="article-view__source-link">
                  {src.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="article-view__divider">···</div>

      <div className="article-view__info-box">
        <h4>Notiserna Spaning</h4>
        <p>Denna artikel är en del av våra egna djuplodande analyser om intressanta ämnen inom ekonomi och teknik. Vill du tipsa om ämnen eller ge feedback? Kontakta oss via Om-sidan.</p>
      </div>

      {/* Monochrome Share buttons */}
      <div className="article-view__share">
        <span className="article-view__share-label">Dela artikeln:</span>
        <div className="article-view__share-buttons">
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn"
            title="Dela på LinkedIn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </svg>
            LinkedIn
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn"
            title="Dela på X"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X
          </a>
          <button
            onClick={handleCopy}
            className="share-btn share-btn--copy"
            title="Kopiera länk"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Kopiera länk
          </button>

          {copied && <span className="share-toast">Länken kopierad!</span>}
        </div>
      </div>

      <div className="article-view__footer-nav">
        <button className="article-view__footer-nav-btn" onClick={onBackToFlow}>
          &larr; Tillbaka till nyhetsflödet
        </button>
      </div>
    </article>
  )
}

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
    const p = new URLSearchParams(window.location.search)
    if (p.get('view') === 'artiklar') return 'artiklar'
    const cat = p.get('cat')
    return NEWS_TABS.some(t => t.key === cat) ? cat : 'all'
  })
  const [activeSlug,    setActiveSlug]    = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('view') === 'artiklar' ? p.get('slug') : null
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

  const [gdprOk,      setGdprOk]      = useState(() => !!localStorage.getItem('gdpr_ok'))
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [aboutOpen,   setAboutOpen]   = useState(false)

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
  }, [active, activeSlug])

  // Synka active/query/slug → URL (delningsbara länkar)
  useEffect(() => {
    const p = new URLSearchParams()
    if (active === 'artiklar') {
      p.set('view', 'artiklar')
      if (activeSlug) p.set('slug', activeSlug)
    }
    else if (active !== 'all') p.set('cat', active)
    if (query.trim())          p.set('q', query.trim())
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname)
  }, [active, activeSlug, query])

  // Update document title, description, canonical and OG tags for SEO
  useEffect(() => {
    let title = "Notiserna — dina nyheter, samlat på ett ställe"
    let description = "Notiserna samlar nyheter från svenska och internationella källor i ett rent, personligt flöde. Teknik, näringsliv, världen, kultur och mer — uppdaterat var 15:e minut."
    let image = "https://www.notiserna.se/images/blogg/notiserna.jpeg"
    let canonical = "https://www.notiserna.se/"

    if (active === 'artiklar' && activeSlug) {
      const post = POSTS.find(p => p.slug === activeSlug)
      if (post) {
        title = `${post.title} — Notiserna`
        description = post.description || ''
        if (post.image) {
          image = post.image.startsWith('http') ? post.image : `https://www.notiserna.se${post.image}`
        }
        canonical = `https://www.notiserna.se/?view=artiklar&slug=${activeSlug}`
      }
    } else if (active !== 'all') {
      canonical = `https://www.notiserna.se/?cat=${active}`
    }

    document.title = title

    // Update canonical link in document head
    const canonicalLink = document.querySelector('link[rel="canonical"]')
    if (canonicalLink) {
      canonicalLink.setAttribute('href', canonical)
    }
    
    const metaTags = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:image"]': image,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
      'meta[name="twitter:image"]': image,
    }

    Object.entries(metaTags).forEach(([selector, val]) => {
      const el = document.querySelector(selector)
      if (el) el.setAttribute('content', val)
    })
  }, [active, activeSlug])

  const acceptGdpr = useCallback(() => {
    localStorage.setItem('gdpr_ok', '1')
    setGdprOk(true)
  }, [])

  const goHome = useCallback(() => {
    setActive('all')
    setActiveSlug(null)
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSetActive = useCallback((tab) => {
    setActive(tab)
    setActiveSlug(null)
  }, [])

  const changeViewMode = useCallback((mode) => {
    setViewMode(mode)
    localStorage.setItem('viewMode', mode)
  }, [])

  // Filtrera före paginering så varje flik får egna, kompletta sidor.
  const newsQuery = useCallback(() => {
    let request = db.from('news_articles').select('*')
    if (active === 'all' || active === 'artiklar') {
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
    setLoading(true)
    setLoadingMore(false)
    setHasMore(true)
    setNewsError('')
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
  }, [fetchNews])

  const filtered = useMemo(() => {
    let list = news
    if (active === 'all') list = list.filter(i => NEWS_CATEGORY_KEYS.includes(i.categoryKey))
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

  const featured = useMemo(() => {
    return filtered.find(i => i.featured) || filtered[0]
  }, [filtered])

  const rest = useMemo(() => {
    return filtered.filter(i => i.id !== featured?.id)
  }, [filtered, featured])

  const showHero = featured && active === 'all' && !query

  return (
    <div className="shell">
      <Nav query={query} setQuery={setQuery}
           active={active} onSetActive={handleSetActive}
           onGoHome={goHome} onOpenAbout={() => setAboutOpen(true)}
           colorScheme={colorScheme} onToggleTheme={toggleTheme} />

      <header className="brand-header">
        <button className="brand-header__link" onClick={goHome}>
          <div className="brand-header__logo">N</div>
          <span className="brand-header__name">Notiserna</span>
          <span className="brand-header__sep">&mdash;</span>
          <span className="brand-header__tagline">Dina nyheter, samlat på ett ställe</span>
        </button>
      </header>


      {active !== 'artiklar' && (
        <LatestPosts posts={POSTS}
                     onOpen={slug => { setActive('artiklar'); setActiveSlug(slug) }}
                     onShowAll={() => handleSetActive('artiklar')} />
      )}

      {active !== 'artiklar' && (
        <div className="filter-bar">
          <div className="filter-bar__inner">
            {NEWS_TABS.map(c => (
              <button key={c.key}
                      className={`pill ${active === c.key ? 'is-active' : ''}`}
                      onClick={() => handleSetActive(c.key)}
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
      )}

      {active === 'artiklar' && activeSlug ? (
        <main className="content">
          <ArticleView slug={activeSlug}
                       onBack={() => {
                         setActive('artiklar')
                         setActiveSlug(null)
                       }}
                       onBackToFlow={() => {
                         setActive('all')
                         setActiveSlug(null)
                       }} />
        </main>
      ) : active === 'artiklar' ? (
        <main className="content">
          <div className="article-archive-header">
            <h2>Artiklar</h2>
            <p>Förklarande artiklar om vardagsekonomi, senaste först</p>
          </div>
          {POSTS.length === 0 ? (
            <div className="empty">
              <h3>Inga artiklar hittades</h3>
              <p>Vi fyller på med nytt innehåll inom kort.</p>
            </div>
          ) : (
            <div className="article-archive-list">
              {POSTS.map(post => (
                <a
                  key={post.slug}
                  href={`?view=artiklar&slug=${post.slug}`}
                  className="article-archive-item"
                  onClick={(e) => {
                    e.preventDefault()
                    setActive('artiklar')
                    setActiveSlug(post.slug)
                  }}
                >
                  {post.image && (
                    <div className="article-archive-item__img">
                      <img src={post.image} alt={post.title} loading="lazy" />
                    </div>
                  )}
                  <div className="article-archive-item__content">
                    <span className="article-archive-item__date">{post.date}</span>
                    <h3 className="article-archive-item__title">{post.title}</h3>
                    <p className="article-archive-item__desc">{post.description}</p>
                    <span className="article-archive-item__link">
                      Läs artikeln <Icon name="arrow" size={13} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </main>
      ) : (
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
      )}

      <footer className="foot">
        <div className="foot__rule" />
        <div className="foot__row">
          <span>
            © Notiserna 2026
            {' · '}
            <button className="foot__privacy-link" onClick={() => setAboutOpen(true)}>
              Om sajten
            </button>
            {' · '}
            <button className="foot__privacy-link" onClick={() => setPrivacyOpen(true)}>
              Integritetspolicy
            </button>
          </span>
          <span>{updatedAt ? `Uppdaterad ${formatUpdated(updatedAt)}` : 'Uppdateras var 15:e minut'}</span>
        </div>
      </footer>

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} onOpenPrivacy={() => { setAboutOpen(false); setPrivacyOpen(true) }} />}
      {!gdprOk && <GdprBanner onAccept={acceptGdpr} onOpenPrivacy={() => setPrivacyOpen(true)} />}

      <MobileNav active={active} onSetActive={handleSetActive} onOpenAbout={() => setAboutOpen(true)} />
    </div>
  )
}

export { ErrorBoundary }
export default App
