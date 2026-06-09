import React, { Component, useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RSS_FEEDS, CATEGORIES } from './data.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } from './config.js'

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const DEFAULT_CAT_KEYS = new Set(['all', 'sverige', 'teknik', 'varlden', 'naringsliv', 'kultur'])
const HIDDEN_ANON_CATS = new Set(['skatt', 'lokalt', 'kultur'])
const HUE_PALETTE = [180, 30, 260, 120, 340, 200, 80, 300, 45, 160]
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

const POSTS = Object.entries(rawPosts).map(([path, content]) => {
  const { attributes, body } = parseFrontmatter(content)
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

function slugify(str) {
  return str.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function placeholderBg(hue) {
  const h = hue ?? 200
  const h2 = (h + 40) % 360
  return `linear-gradient(135deg, oklch(0.78 0.10 ${h}) 0%, oklch(0.62 0.13 ${h2}) 100%)`
}

const Icon = ({ name, size = 16 }) => {
  const paths = {
    search:        <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    arrow:         <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    rss:           <><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/></>,
    plus:          <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    close:         <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    check:         <path d="M20 6 9 17l-5-5"/>,
    pencil:        <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></>,
    trash:         <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></>,
    bookmark:      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>,
    logout:        <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    'chevron-down':<path d="m6 9 6 6 6-6"/>,
    'chevron-up':  <path d="m18 15-6-6-6 6"/>,
    rows:          <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
    grid:          <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    'book-open':   <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    moon:          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
    sun:           <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    lock:          <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
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

  const PUBLIC_ABOUT_CATS = new Set(['sverige', 'teknik', 'varlden', 'naringsliv'])

  const sourcesByCategory = Object.entries(RSS_FEEDS)
    .filter(([key]) => PUBLIC_ABOUT_CATS.has(key))
    .map(([key, feeds]) => {
      const cat = CATEGORIES.find(c => c.key === key)
      return { label: cat?.label ?? key, feeds: feeds.filter(f => f.enabled) }
    }).filter(g => g.feeds.length > 0)

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

        <h3>Aktiva källor</h3>
        <div className="about-sources">
          {sourcesByCategory.map(({ label, feeds }) => (
            <div key={label} className="about-sources__group">
              <span className="about-sources__cat">{label}</span>
              <span className="about-sources__names">{feeds.map(f => f.name).join(' · ')}</span>
            </div>
          ))}
        </div>

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

// ----- Login -----
function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-card__logo">N</div>
        <h1 className="login-card__title">Notiserna</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="E-post" value={email}
                 onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Lösenord" value={password}
                 onChange={e => setPassword(e.target.value)} required />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Loggar in…' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ----- Cards -----
function BlogHeroCard({ post, onClick }) {
  return (
    <article className="hero-card blog-hero-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="hero-card__media" style={{ background: placeholderBg(220) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {post.image && (
          <img src={post.image} alt="" className="media-img"
                 loading="lazy" decoding="async" />
        )}
      </div>
      <div className="hero-card__body">
        <div className="hero-card__meta">
          <span className="cat-tag" style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '16px', height: '16px', borderRadius: '4px',
              background: 'var(--on-accent)', color: 'var(--accent)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'Instrument Serif, serif', fontSize: '11px',
              fontStyle: 'italic', fontWeight: 'bold', lineHeight: 1
            }}>N</span>
            Notiserna.se
          </span>
          <span className="dot-sep">·</span>
          <span>Redaktionen</span>
          <span className="dot-sep">·</span>
          <span>{post.date}</span>
        </div>
        <h1 className="hero-card__title">{post.title}</h1>
        <p className="hero-card__summary">{post.description}</p>
        <div className="card__footer">
          <span className="read-more">
            Läs hela artikeln <Icon name="arrow" size={15} />
          </span>
        </div>
      </div>
    </article>
  )
}

function HeroCard({ item, isArchived, onToggleArchive, isRead, onRead, onOpenReader }) {
  return (
    <article className={`hero-card ${isRead ? 'is-read' : ''}`}>
      <div className="hero-card__media" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={item.image} alt="" className="media-img"
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
          {isRead && <span className="read-badge"><Icon name="check" size={11} /> Läst</span>}
        </div>
        <h1 className="hero-card__title">{item.headline}</h1>
        <p className="hero-card__summary">{item.summary}</p>
        <div className="card__footer">
          <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
             rel="noopener noreferrer" className="read-more"
             onClick={() => onRead(item.id)}>
            Läs hela artikeln <Icon name="arrow" size={15} />
          </a>
          <div className="card__actions">
            {item.link && (
              <button className="reader-btn" onClick={() => onOpenReader(item)} title="Läsläge">
                <Icon name="book-open" size={16} />
              </button>
            )}
            <button className={`bookmark-btn ${isArchived ? 'is-saved' : ''}`}
                    onClick={() => onToggleArchive(item)}
                    title={isArchived ? 'Ta bort från arkiv' : 'Spara till arkiv'}>
              <Icon name="bookmark" size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function NewsCard({ item, isArchived, onToggleArchive, isRead, onRead, onOpenReader }) {
  return (
    <article className={`news-card ${isRead ? 'is-read' : ''}`}>
      <div className="news-card__media" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={item.image} alt="" className="media-img"
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
          {isRead && <span className="read-badge"><Icon name="check" size={10} /> Läst</span>}
        </div>
        <h3 className="news-card__title">{item.headline}</h3>
        <p className="news-card__summary">{item.summary}</p>
        <div className="card__footer">
          <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
             rel="noopener noreferrer" className="read-more read-more--small"
             onClick={() => onRead(item.id)}>
            Läs mer <Icon name="arrow" size={13} />
          </a>
          <div className="card__actions">
            {item.link && (
              <button className="reader-btn" onClick={() => onOpenReader(item)} title="Läsläge">
                <Icon name="book-open" size={14} />
              </button>
            )}
            <button className={`bookmark-btn ${isArchived ? 'is-saved' : ''}`}
                    onClick={() => onToggleArchive(item)}
                    title={isArchived ? 'Ta bort från arkiv' : 'Spara till arkiv'}>
              <Icon name="bookmark" size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function CompactCard({ item, isArchived, onToggleArchive, isRead, onRead, onOpenReader }) {
  return (
    <div className={`compact-row ${isRead ? 'is-read' : ''}`}>
      <div className="compact-row__img" style={{ background: placeholderBg(item.hue) }}>
        <div className="placeholder-logo-wrap">
          <div className="placeholder-logo">N</div>
        </div>
        {item.image && (
          <img src={item.image} alt="" className="media-img"
               loading="lazy" decoding="async"
               onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>
      <div className="compact-row__text">
        <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
           rel="noopener noreferrer" className="compact-row__title"
           onClick={() => onRead(item.id)}>
          {item.headline}
        </a>
        <span className="compact-row__meta">
          {item.source}<span className="dot-sep"> · </span>{item.date}
        </span>
      </div>
      <div className="compact-row__actions">
        {isRead && <span className="compact-row__check"><Icon name="check" size={12} /></span>}
        {item.link && (
          <button className="reader-btn" onClick={() => onOpenReader(item)} title="Läsläge">
            <Icon name="book-open" size={14} />
          </button>
        )}
        <button className={`bookmark-btn ${isArchived ? 'is-saved' : ''}`}
                onClick={() => onToggleArchive(item)}
                title={isArchived ? 'Ta bort från arkiv' : 'Spara till arkiv'}>
          <Icon name="bookmark" size={14} />
        </button>
      </div>
    </div>
  )
}

// ----- Reader modal -----
function ReaderModal({ item, onClose }) {
  const [state,   setState]   = useState('loading')
  const [data,    setData]    = useState(null)
  const [errMsg,  setErrMsg]  = useState('')

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token || SUPABASE_ANON_KEY
      fetch(
        `${SUPABASE_URL}/functions/v1/reader-mode?url=${encodeURIComponent(item.link)}`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
          }
        }
      )
        .then(r => r.json())
        .then(json => {
          if (json.error) { setErrMsg(json.error); setState('error') }
          else { setData(json); setState('ok') }
        })
        .catch(err => { setErrMsg(String(err)); setState('error') })
    })
  }, [item.link])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="reader-modal" onClick={e => e.stopPropagation()}>
        <button className="reader-close" onClick={onClose} title="Stäng (Esc)">
          <Icon name="close" size={18} />
        </button>

        {state === 'loading' && (
          <div className="reader-loading">
            <div className="reader-spinner" />
            <p>Hämtar artikel…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="reader-error">
            <h2>Kunde inte hämta artikeln</h2>
            <p>Sidan kan vara bakom en betalvägg eller blockera externa hämtningar.</p>
            <p className="reader-error__detail">{errMsg}</p>
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
              Öppna originalsidan <Icon name="arrow" size={14} />
            </a>
          </div>
        )}

        {state === 'ok' && data && (
          <article className="reader-content">
            <h1 className="reader-title">{data.title || item.headline}</h1>
            {data.byline && <p className="reader-byline">{data.byline}</p>}
            <div className="reader-body" dangerouslySetInnerHTML={{ __html: data.content }} />
            <div className="reader-footer">
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
                Öppna originalsidan <Icon name="arrow" size={13} />
              </a>
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

// ----- Login modal -----
function LoginModal({ onClose, isAnon }) {
  const [tab,      setTab]      = useState('in')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    if (tab === 'in') {
      const { error } = await db.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false) }
      else onClose()
    } else {
      // updateUser bevarar samma user_id → all anon-data följer med automatiskt
      const { error } = await db.auth.updateUser({ email, password })
      if (error) { setError(error.message); setLoading(false) }
      else setDone(true)
    }
  }

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="reader-close" onClick={onClose} title="Stäng (Esc)">
          <Icon name="close" size={18} />
        </button>

        {done ? (
          <div className="login-modal__done">
            <div className="login-modal__logo">N</div>
            <h2>Välkommen!</h2>
            <p>Vi har skickat en bekräftelse till din e-post. Klicka på länken i mailet — sedan är allt ditt arkiv och din läst-historik synkad permanent.</p>
          </div>
        ) : (
          <>
            <div className="login-modal__logo">N</div>
            {isAnon && (
              <div className="login-modal__tabs">
                <button className={tab === 'up' ? 'is-active' : ''} onClick={() => { setTab('up'); setError('') }}>
                  Skapa konto
                </button>
                <button className={tab === 'in' ? 'is-active' : ''} onClick={() => { setTab('in'); setError('') }}>
                  Logga in
                </button>
              </div>
            )}

            {tab === 'up' ? (
              <div className="signup-benefits">
                <p className="signup-benefits__lead">
                  Allt du läst och sparat idag följer automatiskt med — inget försvinner.
                </p>
                <ul className="signup-benefits__list">
                  <li><Icon name="check" size={13} /> Synkroniseras på alla dina enheter</li>
                  <li><Icon name="check" size={13} /> Arkiv och läst-historik sparas permanent</li>
                  <li><Icon name="check" size={13} /> Lås upp fler kategorier (Skatt, Lokalt, Kultur)</li>
                  <li><Icon name="check" size={13} /> Gratis, alltid</li>
                </ul>
              </div>
            ) : (
              !isAnon && <p className="login-modal__hint">Välkommen tillbaka.</p>
            )}

            <form onSubmit={submit} className="login-form" style={{ marginTop: '1rem', width: '100%' }}>
              <input type="email" placeholder="E-postadress" value={email}
                     onChange={e => setEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder={tab === 'up' ? 'Välj ett lösenord' : 'Lösenord'} value={password}
                     onChange={e => setPassword(e.target.value)} required />
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Väntar…' : tab === 'in' ? 'Logga in' : 'Skapa konto — det är gratis'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ----- Nav -----
function Nav({ onOpenRss, query, setQuery, active, onSetActive, onLogout, isAnon, isAdmin, onOpenLogin, onGoHome, onOpenAbout, colorScheme, onToggleTheme }) {
  return (
    <header className="nav">
      <button className="nav__brand" onClick={onGoHome}>
        <div className="nav__logo">N</div>
        <div className="nav__name">Notiserna</div>
      </button>
      <nav className="nav__links">
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('all') }}
           className={active !== 'arkiv' && active !== 'artiklar' ? 'is-active' : ''}>Flöde</a>
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('artiklar') }}
           className={active === 'artiklar' ? 'is-active' : ''}>Artiklar</a>
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('arkiv') }}
           className={active === 'arkiv' ? 'is-active' : ''}>Arkiv</a>
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
        {isAnon ? (
          <button className="btn btn--ghost" onClick={onOpenLogin}>
            Logga in
          </button>
        ) : (
          <>
            {isAdmin && (
              <button className="btn btn--ghost" onClick={onOpenRss}>
                <Icon name="rss" size={14} /> Källor
              </button>
            )}
            <button className="btn btn--ghost" onClick={onLogout} title="Logga ut">
              <Icon name="logout" size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

// ----- Quick-add category presets -----
const QUICK_ADD_PRESETS = [
  { key: 'skatt',  label: 'Skatt & juridik', hue: 30 },
  { key: 'lokalt', label: 'Lokalt',          hue: 200 },
]

// ----- RSS drawer -----
function RssDrawer({ open, onClose, feeds, setFeeds, categories, onAddCategory, onRemoveCategory, onRenameCategory, saveStatus, saveError }) {
  const [newName,     setNewName]     = useState('')
  const [newUrl,      setNewUrl]      = useState('')
  const [newCat,      setNewCat]      = useState('teknik')
  const [newCatName,  setNewCatName]  = useState('')
  const [editing,     setEditing]     = useState(null)
  const [showCatEdit, setShowCatEdit] = useState(false)
  const [editingCat,  setEditingCat]  = useState(null)

  const missingPresets = QUICK_ADD_PRESETS.filter(p => !categories.some(c => c.key === p.key))

  const quickAdd = (preset) => {
    onAddCategory(preset)
    // Also restore default feeds for the category
    const defaultFeeds = RSS_FEEDS[preset.key]
    if (defaultFeeds) {
      setFeeds(prev => ({ ...prev, [preset.key]: defaultFeeds }))
    }
  }

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    const key = slugify(newCatName)
    if (!key || categories.some(c => c.key === key)) return
    const usedHues = new Set(categories.map(c => c.hue).filter(Boolean))
    const hue = HUE_PALETTE.find(h => !usedHues.has(h)) ?? Math.floor(Math.random() * 360)
    onAddCategory({ key, label: newCatName.trim(), hue })
    setNewCatName('')
  }

  const saveCatRename = () => {
    if (!editingCat?.label.trim()) return
    onRenameCategory(editingCat.key, editingCat.label.trim())
    setEditingCat(null)
  }

  const addFeed = () => {
    if (!newName.trim() || !newUrl.trim()) return
    setFeeds(prev => ({
      ...prev,
      [newCat]: [...(prev[newCat] || []), { name: newName, url: newUrl, enabled: true }],
    }))
    setNewName(''); setNewUrl('')
  }

  const toggle = (cat, idx) => {
    setFeeds(prev => ({
      ...prev,
      [cat]: prev[cat].map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f),
    }))
  }

  const remove = (cat, idx) => {
    setFeeds(prev => ({ ...prev, [cat]: prev[cat].filter((_, i) => i !== idx) }))
  }

  const startEdit = (cat, idx, name, url) => setEditing({ cat, idx, name, url })
  const cancelEdit = () => setEditing(null)
  const saveEdit = () => {
    if (!editing || !editing.name.trim() || !editing.url.trim()) return
    setFeeds(prev => ({
      ...prev,
      [editing.cat]: prev[editing.cat].map((f, i) =>
        i === editing.idx ? { ...f, name: editing.name.trim(), url: editing.url.trim() } : f
      ),
    }))
    setEditing(null)
  }

  return (
    <>
      <div className={`drawer-overlay ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        <header className="drawer__head">
          <div>
            <div className="drawer__eyebrow drawer__eyebrow--admin">
              <Icon name="lock" size={10} /> Admin
            </div>
            <h2>Flödeskonfiguration</h2>
            <p>Styr vilka RSS-källor och kategorier som visas för <strong>alla besökare</strong> av Notiserna.</p>
            {saveStatus === 'saving' && <p className="save-status save-status--saving">Sparar…</p>}
            {saveStatus === 'ok'     && <p className="save-status save-status--ok">Sparat!</p>}
            {saveStatus === 'error'  && <p className="save-status save-status--error">Fel: {saveError}</p>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="drawer__body">
          {missingPresets.length > 0 && (
            <section className="quick-add-cats">
              <h4>Lägg till fler kategorier</h4>
              <p className="quick-add-cats__hint">Dessa kategorier är dolda för oinloggade besökare men kan aktiveras för ditt konto.</p>
              <div className="quick-add-cats__btns">
                {missingPresets.map(p => (
                  <button key={p.key} className="btn btn--outline" onClick={() => quickAdd(p)}>
                    <Icon name="plus" size={14} /> {p.label}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="add-feed">
            <h4>Kategorier</h4>
            <div className="add-feed__row">
              <input placeholder="Nytt kategorinamn (t.ex. Sverige)" value={newCatName}
                     onChange={e => setNewCatName(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
              <button className="btn btn--primary" onClick={handleAddCategory}>
                <Icon name="plus" size={14} /> Skapa
              </button>
            </div>
            <button className="btn btn--ghost" style={{ marginTop: '0.5rem' }}
                    onClick={() => setShowCatEdit(v => !v)}>
              <Icon name="pencil" size={14} /> {showCatEdit ? 'Stäng redigering' : 'Redigera kategorier'}
            </button>
            {showCatEdit && (
              <ul className="feed-list" style={{ marginTop: '0.5rem' }}>
                {categories.filter(c => c.key !== 'all').map(cat => {
                  const isDefault = DEFAULT_CAT_KEYS.has(cat.key)
                  const isEditingThis = editingCat?.key === cat.key
                  return (
                    <li key={cat.key} className="feed-row">
                      {isEditingThis ? (
                        <div className="feed-row__edit">
                          <input value={editingCat.label} autoFocus
                                 onChange={e => setEditingCat({ ...editingCat, label: e.target.value })}
                                 onKeyDown={e => { if (e.key === 'Enter') saveCatRename(); if (e.key === 'Escape') setEditingCat(null) }} />
                          <button className="icon-btn" title="Spara" onClick={saveCatRename}><Icon name="check" size={14} /></button>
                          <button className="icon-btn icon-btn--quiet" title="Avbryt" onClick={() => setEditingCat(null)}><Icon name="close" size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <div className="feed-row__text">
                            <div className="feed-row__name">{cat.label}</div>
                            {isDefault && <div className="feed-row__url">Standard</div>}
                          </div>
                          {!isDefault && (
                            <>
                              <button className="icon-btn icon-btn--quiet" title="Byt namn"
                                      onClick={() => setEditingCat({ key: cat.key, label: cat.label })}>
                                <Icon name="pencil" size={14} />
                              </button>
                              <button className="icon-btn icon-btn--quiet" title="Ta bort"
                                      onClick={() => onRemoveCategory(cat.key)}>
                                <Icon name="trash" size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="add-feed">
            <h4>Lägg till flöde</h4>
            <div className="add-feed__row">
              <input placeholder="Namn (t.ex. SVT Nyheter)" value={newName}
                     onChange={e => setNewName(e.target.value)} />
              <input placeholder="https://exempel.se/rss" value={newUrl}
                     onChange={e => setNewUrl(e.target.value)} />
              <select value={newCat} onChange={e => setNewCat(e.target.value)}>
                {categories.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button className="btn btn--primary" onClick={addFeed}>
                <Icon name="plus" size={14} /> Lägg till
              </button>
            </div>
          </section>

          {categories.filter(c => c.key !== 'all').map(cat => (
            <section key={cat.key} className="feed-group">
              <div className="feed-group__head">
                <h4>{cat.label}</h4>
                <span className="feed-group__count">{(feeds[cat.key] || []).length} flöden</span>
              </div>
              <ul className="feed-list">
                {(feeds[cat.key] || []).length === 0 && (
                  <li className="feed-row feed-row--empty">Inga flöden ännu.</li>
                )}
                {(feeds[cat.key] || []).map((f, idx) => {
                  const isEditing = editing && editing.cat === cat.key && editing.idx === idx
                  return (
                    <li key={idx} className={`feed-row ${f.enabled && !isEditing ? 'is-on' : ''}`}>
                      {isEditing ? (
                        <div className="feed-row__edit">
                          <input value={editing.name}
                                 onChange={e => setEditing({ ...editing, name: e.target.value })}
                                 placeholder="Namn" />
                          <input value={editing.url}
                                 onChange={e => setEditing({ ...editing, url: e.target.value })}
                                 placeholder="URL" className="feed-row__edit-url" />
                          <button className="icon-btn" title="Spara" onClick={saveEdit}><Icon name="check" size={14} /></button>
                          <button className="icon-btn icon-btn--quiet" title="Avbryt" onClick={cancelEdit}><Icon name="close" size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <button className={`tgl ${f.enabled ? 'is-on' : ''}`} onClick={() => toggle(cat.key, idx)}>
                            <span className="tgl__knob" />
                          </button>
                          <div className="feed-row__text">
                            <div className="feed-row__name">{f.name}</div>
                            <div className="feed-row__url">{f.url}</div>
                          </div>
                          <button className="icon-btn icon-btn--quiet" title="Redigera"
                                  onClick={() => startEdit(cat.key, idx, f.name, f.url)}>
                            <Icon name="pencil" size={14} />
                          </button>
                          <button className="icon-btn icon-btn--quiet" title="Ta bort"
                                  onClick={() => remove(cat.key, idx)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
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
  const [session,   setSession]   = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setAuthReady(true)
      } else {
        db.auth.signInAnonymously().then(({ data }) => {
          setSession(data.session)
          setAuthReady(true)
        })
      }
    })
    const { data: { subscription } } = db.auth.onAuthStateChange((_, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = useCallback(() => {
    db.auth.signOut().then(() => {
      window.location.href = window.location.origin + window.location.pathname
    })
  }, [])

  const [active,        setActive]        = useState(() => {
    const p = new URLSearchParams(window.location.search)
    const view = p.get('view')
    if (view === 'arkiv') return 'arkiv'
    if (view === 'artiklar') return 'artiklar'
    return p.get('cat') ?? 'all'
  })
  const [activeSlug,    setActiveSlug]    = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('view') === 'artiklar' ? p.get('slug') : null
  })
  const [query,         setQuery]         = useState(() =>
    new URLSearchParams(window.location.search).get('q') ?? ''
  )
  const [drawer,        setDrawer]        = useState(false)
  const [feeds,         setFeeds]         = useState(RSS_FEEDS)
  const [categories,    setCategories]    = useState(CATEGORIES)
  const [news,          setNews]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [updatedAt,     setUpdatedAt]     = useState(null)
  const [saveStatus,    setSaveStatus]    = useState('idle')
  const [saveError,     setSaveError]     = useState('')
  const [archived,      setArchived]      = useState(new Set())
  const [archiveItems,  setArchiveItems]  = useState([])
  const [readArticles,  setReadArticles]  = useState(new Set())
  const [viewMode,      setViewMode]      = useState(() => localStorage.getItem('viewMode') || 'grid')
  const [readerItem,    setReaderItem]    = useState(null)
  const [loginOpen,     setLoginOpen]     = useState(false)
  const [hasMore,       setHasMore]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)

  const openReader  = useCallback((item) => setReaderItem(item), [])
  const closeReader = useCallback(() => setReaderItem(null), [])
  const isAnon  = session?.user?.is_anonymous ?? false
  const isAdmin = session?.user?.email === ADMIN_EMAIL

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

  // Synka active/query/slug → URL (delningsbara länkar)
  useEffect(() => {
    const p = new URLSearchParams()
    if (active === 'arkiv')    p.set('view', 'arkiv')
    else if (active === 'artiklar' && activeSlug) {
      p.set('view', 'artiklar')
      p.set('slug', activeSlug)
    }
    else if (active !== 'all') p.set('cat', active)
    if (query.trim())          p.set('q', query.trim())
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname)
  }, [active, activeSlug, query])

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

  useEffect(() => {
    db.from('feed_config').select('feeds, categories').eq('id', 1).single()
      .then(({ data, error }) => {
        if (error) { console.error('Supabase load:', error.code, error.message); return }
        if (data?.feeds && Object.keys(data.feeds).length > 0) setFeeds(data.feeds)
        if (data?.categories?.length) {
          setCategories([
            { key: 'all', label: 'Alla' },
            ...CATEGORIES.filter(c => c.key !== 'all'),
            ...data.categories,
          ])
        }
      })
  }, [])

  useEffect(() => {
    if (!session) return
    setArchiveItems([]); setArchived(new Set())
    db.from('archived_articles').select('id, article, saved_at').order('saved_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('Archive load:', error.message); return }
        if (data?.length) {
          setArchiveItems(data.map(r => ({ ...r.article, savedAt: r.saved_at })))
          setArchived(new Set(data.map(r => r.id)))
        }
      })
  }, [session?.user?.id])

  useEffect(() => {
    if (!session) return
    setReadArticles(new Set())
    db.from('read_articles').select('article_id')
      .then(({ data, error }) => {
        if (error) { console.error('Read load:', error.message); return }
        if (data?.length) setReadArticles(new Set(data.map(r => r.article_id)))
      })
  }, [session?.user?.id])



  const markAsRead = useCallback((id) => {
    if (readArticles.has(id)) return
    setReadArticles(prev => new Set([...prev, id]))
    db.from('read_articles')
      .upsert(
        { article_id: String(id), read_at: new Date().toISOString(), user_id: session?.user?.id },
        { onConflict: 'article_id,user_id' }
      )
      .then(({ error }) => { if (error) console.error('Mark read:', error.message) })
  }, [readArticles, session?.user?.id])

  const toggleArchive = useCallback((item) => {
    const isSaved = archived.has(item.id)
    if (isSaved) {
      db.from('archived_articles').delete().eq('id', item.id)
        .then(({ error }) => {
          if (error) { console.error('Archive delete:', error.message); return }
          setArchived(prev => { const s = new Set(prev); s.delete(item.id); return s })
          setArchiveItems(prev => prev.filter(a => a.id !== item.id))
        })
    } else {
      db.from('archived_articles')
        .upsert(
          { id: item.id, article: item, saved_at: new Date().toISOString(), user_id: session?.user?.id },
          { onConflict: 'id,user_id' }
        )
        .then(({ error }) => {
          if (error) { console.error('Archive save:', error.message); return }
          setArchived(prev => new Set([...prev, item.id]))
          setArchiveItems(prev => [{ ...item, savedAt: new Date().toISOString() }, ...prev.filter(a => a.id !== item.id)])
        })
    }
  }, [archived, session?.user?.id])

  const saveConfig = useCallback((newFeeds, newCats) => {
    setSaveStatus('saving')
    setSaveError('')
    const customCats = newCats.filter(c => !DEFAULT_CAT_KEYS.has(c.key))
    db.from('feed_config')
      .upsert({ id: 1, feeds: newFeeds, categories: customCats, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) {
          console.error('Supabase:', error.message)
          setSaveError(error.message)
          setSaveStatus('error')
        } else {
          setSaveStatus('ok')
          setTimeout(() => setSaveStatus('idle'), 2000)
        }
      })
  }, [])

  const setAndSaveFeeds = useCallback((updater) => {
    setFeeds(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveConfig(next, categories)
      return next
    })
  }, [categories, saveConfig])

  const handleAddCategory = useCallback((cat) => {
    const newCats = [...categories, cat]
    setCategories(newCats)
    saveConfig(feeds, newCats)
  }, [categories, feeds, saveConfig])

  const handleRemoveCategory = useCallback((key) => {
    const newCats = categories.filter(c => c.key !== key)
    const newFeeds = { ...feeds }
    delete newFeeds[key]
    setCategories(newCats)
    setFeeds(newFeeds)
    saveConfig(newFeeds, newCats)
    if (active === key) setActive('all')
  }, [categories, feeds, active, saveConfig])

  const handleRenameCategory = useCallback((key, newLabel) => {
    const newCats = categories.map(c => c.key === key ? { ...c, label: newLabel } : c)
    setCategories(newCats)
    saveConfig(feeds, newCats)
  }, [categories, feeds, saveConfig])

  const changeViewMode = useCallback((mode) => {
    setViewMode(mode)
    localStorage.setItem('viewMode', mode)
  }, [])

  const fetchNews = useCallback(() => {
    db.from('news_articles')
      .select('*')
      .not('image', 'is', null)
      .neq('image', '')
      .order('published_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data, error }) => {
        if (error) { console.error('Supabase news:', error.message); return }
        const articles = (data || []).map(mapArticle)
        setNews(articles)
        setHasMore(articles.length === PAGE_SIZE)
        if (articles[0]?.fetched_at) setUpdatedAt(articles[0].fetched_at)
      })
      .finally(() => setLoading(false))
  }, []) // stabil – inga beroenden som ändras

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const from = news.length
    db.from('news_articles')
      .select('*')
      .not('image', 'is', null)
      .neq('image', '')
      .order('published_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .then(({ data, error }) => {
        if (error) { console.error('Load more:', error.message); return }
        const articles = (data || []).map(mapArticle)
        setNews(prev => [...prev, ...articles])
        setHasMore(articles.length === PAGE_SIZE)
      })
      .finally(() => setLoadingMore(false))
  }, [news.length, loadingMore, hasMore])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 60000) // Fallback: hämta var 60:e sekund

    const channel = db.channel('news-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, fetchNews)
      .subscribe()

    return () => {
      clearInterval(interval)
      db.removeChannel(channel)
    }
  }, [fetchNews, session?.user?.id])

  const filtered = useMemo(() => {
    let list = news
    if (isAnon) list = list.filter(i => !HIDDEN_ANON_CATS.has(i.categoryKey))
    if (active !== 'all') list = list.filter(i => i.categoryKey === active)
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
  }, [news, active, query, isAnon])

  const markAllAsRead = useCallback(() => {
    const unread = filtered.filter(i => !readArticles.has(i.id))
    if (!unread.length) return
    setReadArticles(prev => new Set([...prev, ...unread.map(i => i.id)]))
    const rows = unread.map(i => ({ article_id: String(i.id), read_at: new Date().toISOString(), user_id: session?.user?.id }))
    db.from('read_articles').upsert(rows, { onConflict: 'article_id,user_id' })
      .then(({ error }) => { if (error) console.error('Mark all read:', error.message) })
  }, [filtered, readArticles, session?.user?.id])

  const latestPost = POSTS[0]
  const showBlogHero = latestPost && active === 'all' && !query

  const unreadCount = filtered.filter(i => !readArticles.has(i.id)).length

  if (!authReady) return null

  return (
    <div className="shell">
      <Nav onOpenRss={() => setDrawer(true)} query={query} setQuery={setQuery}
           active={active} onSetActive={handleSetActive} onLogout={handleLogout}
           isAnon={isAnon} isAdmin={isAdmin} onOpenLogin={() => setLoginOpen(true)}
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


      {active !== 'arkiv' && (
        <div className="filter-bar">
          <div className="filter-bar__inner">
            {categories
              .filter(c => !isAnon || !HIDDEN_ANON_CATS.has(c.key))
              .map(c => (
              <button key={c.key}
                      className={`pill ${active === c.key ? 'is-active' : ''}`}
                      onClick={() => setActive(c.key)}>
                {c.label}
                <span className="pill__count">
                  {c.key === 'all'
                    ? (isAnon ? news.filter(n => !HIDDEN_ANON_CATS.has(n.categoryKey)).length : news.length)
                    : news.filter(n => n.categoryKey === c.key).length}
                </span>
              </button>
            ))}
            <div className="filter-bar__tools">
              {unreadCount > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={markAllAsRead} title="Markera alla som lästa">
                  <Icon name="check" size={13} /> Markera alla lästa ({unreadCount})
                </button>
              )}
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

      {active === 'arkiv' ? (
        <main className="content">
          {isAnon && (
            <div className="anon-banner">
              <span className="anon-banner__text">
                <strong>Du läser anonymt</strong> — Skapa ett gratis konto för att lägga till egna RSS-källor, anpassa dina kategorier och få ett helt personligt nyhetsflöde sparat på alla dina enheter.
              </span>
              <button className="btn btn--primary" onClick={() => setLoginOpen(true)}>
                Skapa konto gratis
              </button>
            </div>
          )}
          <div className="archive-header">
            <h2>Arkiv</h2>
            <p>{archiveItems.length} sparade artiklar</p>
          </div>
          {archiveItems.length === 0 ? (
            <div className="empty">
              <h3>Arkivet är tomt</h3>
              <p>Klicka på bokmärkesikonen på en artikel för att spara den här.</p>
            </div>
          ) : (
            <div className="grid">
              {archiveItems.map(item => (
                <NewsCard key={item.id} item={item} isArchived={true} onToggleArchive={toggleArchive}
                          isRead={readArticles.has(item.id)} onRead={markAsRead} onOpenReader={openReader} />
              ))}
            </div>
          )}
        </main>
      ) : active === 'artiklar' && activeSlug ? (
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
          {isAnon && (
            <div className="anon-banner">
              <span className="anon-banner__text">
                <strong>Du läser anonymt</strong> — Skapa ett gratis konto för att lägga till egna RSS-källor, anpassa dina kategorier och få ett helt personligt nyhetsflöde sparat på alla dina enheter.
              </span>
              <button className="btn btn--primary" onClick={() => setLoginOpen(true)}>
                Skapa konto gratis
              </button>
            </div>
          )}
          <div className="article-archive-header">
            <h2>Artiklar</h2>
            <p>Våra egna fördjupningar och analyser</p>
          </div>
          {POSTS.length === 0 ? (
            <div className="empty">
              <h3>Inga artiklar hittades</h3>
              <p>Vi fyller på med nytt innehåll inom kort.</p>
            </div>
          ) : (
            <div className="article-archive-list">
              {POSTS.map(post => (
                <article key={post.slug} className="article-archive-item" onClick={() => setActiveSlug(post.slug)}>
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
                </article>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="content">
          {isAnon && (
            <div className="anon-banner">
              <span className="anon-banner__text">
                <strong>Du läser anonymt</strong> — Skapa ett gratis konto för att lägga till egna RSS-källor, anpassa dina kategorier och få ett helt personligt nyhetsflöde sparat på alla dina enheter.
              </span>
              <button className="btn btn--primary" onClick={() => setLoginOpen(true)}>
                Skapa konto gratis
              </button>
            </div>
          )}

          {loading && <div className="empty"><p>Hämtar nyheter…</p></div>}
          {!loading && filtered.length === 0 && (
            <div className="empty">
              <h3>Inga artiklar matchar</h3>
              <p>Prova att rensa sökningen eller välj en annan kategori.</p>
            </div>
          )}

          {!loading && viewMode === 'grid' && (
            <>
              {showBlogHero && (
                <BlogHeroCard post={latestPost} onClick={() => {
                  setActive('artiklar')
                  setActiveSlug(latestPost.slug)
                }} />
              )}
              <div className="grid">
                {filtered.map(item => (
                  <NewsCard key={item.id} item={item}
                            isArchived={archived.has(item.id)} onToggleArchive={toggleArchive}
                            isRead={readArticles.has(item.id)} onRead={markAsRead} onOpenReader={openReader} />
                ))}
              </div>
            </>
          )}

          {!loading && viewMode === 'compact' && (
            <div className="compact-list">
              {filtered.map(item => (
                <CompactCard key={item.id} item={item}
                             isArchived={archived.has(item.id)} onToggleArchive={toggleArchive}
                             isRead={readArticles.has(item.id)} onRead={markAsRead} onOpenReader={openReader} />
              ))}
            </div>
          )}

          {!loading && hasMore && !query && (
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

      {readerItem && <ReaderModal item={readerItem} onClose={closeReader} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isAnon={isAnon} />}
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} onOpenPrivacy={() => { setAboutOpen(false); setPrivacyOpen(true) }} />}
      {!gdprOk && <GdprBanner onAccept={acceptGdpr} onOpenPrivacy={() => setPrivacyOpen(true)} />}

      {isAdmin && (
        <RssDrawer open={drawer} onClose={() => setDrawer(false)} feeds={feeds} setFeeds={setAndSaveFeeds}
                   categories={categories} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory}
                   onRenameCategory={handleRenameCategory} saveStatus={saveStatus} saveError={saveError} />
      )}
    </div>
  )
}

export { ErrorBoundary }
export default App
