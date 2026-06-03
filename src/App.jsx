import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RSS_FEEDS, CATEGORIES } from './data.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const DEFAULT_CAT_KEYS = new Set(['all', 'teknik', 'varlden', 'naringsliv', 'kultur'])
const HIDDEN_ANON_CATS = new Set(['skatt', 'lokalt'])
const HUE_PALETTE = [180, 30, 260, 120, 340, 200, 80, 300, 45, 160]

function slugify(str) {
  return str.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const THEME = {
  accent:  '#0a0a0a',
  bg:      'oklch(0.97 0.008 80)',
  surface: '#fff',
  ink:     'oklch(0.16 0.01 60)',
  muted:   'oklch(0.45 0.01 60)',
  line:    'oklch(0.90 0.008 60)',
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
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
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
function HeroCard({ item, isArchived, onToggleArchive, isRead, onRead, onOpenReader }) {
  return (
    <article className={`hero-card ${isRead ? 'is-read' : ''}`}>
      <div className="hero-card__media" style={{ background: placeholderBg(item.hue) }}>
        {item.image
          ? <img src={item.image} alt="" className="media-img"
                 loading="lazy" decoding="async"
                 onError={e => { e.target.style.display = 'none' }} />
          : <><span className="media-stripe" /><span className="media-label">[ {item.category} bild ]</span></>
        }
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
        {item.image
          ? <img src={item.image} alt="" className="media-img"
                 loading="lazy" decoding="async"
                 onError={e => { e.target.style.display = 'none' }} />
          : <><span className="media-stripe" /><span className="media-label">[ {item.category.toLowerCase()} ]</span></>
        }
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
    fetch(
      `${SUPABASE_URL}/functions/v1/reader-mode?url=${encodeURIComponent(item.link)}`,
      { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    )
      .then(r => r.json())
      .then(json => {
        if (json.error) { setErrMsg(json.error); setState('error') }
        else { setData(json); setState('ok') }
      })
      .catch(err => { setErrMsg(String(err)); setState('error') })
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
            <h2>Konto skapat!</h2>
            <p>Bekräfta din e-post — sedan är allt ditt läst/oläst och arkiv sparat permanent.</p>
          </div>
        ) : (
          <>
            <div className="login-modal__logo">N</div>
            {isAnon && (
              <div className="login-modal__tabs">
                <button className={tab === 'in' ? 'is-active' : ''} onClick={() => { setTab('in'); setError('') }}>
                  Logga in
                </button>
                <button className={tab === 'up' ? 'is-active' : ''} onClick={() => { setTab('up'); setError('') }}>
                  Spara konto
                </button>
              </div>
            )}
            {tab === 'up' && (
              <p className="login-modal__hint">Ditt läst/oläst och arkiv sparas till kontot automatiskt.</p>
            )}
            <form onSubmit={submit} className="login-form" style={{ marginTop: '1.25rem', width: '100%' }}>
              <input type="email" placeholder="E-post" value={email}
                     onChange={e => setEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder="Lösenord" value={password}
                     onChange={e => setPassword(e.target.value)} required />
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Väntar…' : tab === 'in' ? 'Logga in' : 'Spara mina inställningar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ----- Nav -----
function Nav({ onOpenRss, query, setQuery, active, onSetActive, onLogout, isAnon, onOpenLogin, onGoHome }) {
  return (
    <header className="nav">
      <button className="nav__brand" onClick={onGoHome}>
        <div className="nav__logo">N</div>
        <div className="nav__name">Notiserna</div>
      </button>
      <nav className="nav__links">
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('all') }}
           className={active !== 'arkiv' ? 'is-active' : ''}>Flöde</a>
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('arkiv') }}
           className={active === 'arkiv' ? 'is-active' : ''}>Arkiv</a>
      </nav>
      <div className="nav__right">
        <div className="nav__search">
          <Icon name="search" size={14} />
          <input placeholder="Sök…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {isAnon ? (
          <button className="btn btn--ghost" onClick={onOpenLogin}>
            Logga in
          </button>
        ) : (
          <>
            <button className="btn btn--ghost" onClick={onOpenRss}>
              <Icon name="rss" size={14} /> Källor
            </button>
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
            <div className="drawer__eyebrow">Inställningar</div>
            <h2>Koppla RSS-flöden</h2>
            <p>Välj vilka källor som ska läsas in per kategori.</p>
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

  const handleLogout = useCallback(() => db.auth.signOut(), [])

  const [active,        setActive]        = useState('all')
  const [query,         setQuery]         = useState('')
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

  const openReader  = useCallback((item) => setReaderItem(item), [])
  const closeReader = useCallback(() => setReaderItem(null), [])
  const isAnon = session?.user?.is_anonymous ?? false

  const goHome = useCallback(() => {
    setActive('all')
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { console.error('Supabase news:', error.message); return }
        const articles = (data || []).map(row => ({
          ...row,
          categoryKey: row.category_key,
          date: row.date_sv,
        }))
        setNews(articles)
        if (articles[0]?.fetched_at) setUpdatedAt(articles[0].fetched_at)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchNews()
    const channel = db.channel('news-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, fetchNews)
      .subscribe()
    return () => { db.removeChannel(channel) }
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

  const featured = filtered.find(i => i.featured) || filtered[0]
  const rest      = filtered.filter(i => i !== featured)
  const showHero  = featured && active === 'all' && !query

  const unreadCount = filtered.filter(i => !readArticles.has(i.id)).length

  if (!authReady) return null

  return (
    <div className="shell" style={{
      '--accent':  THEME.accent,
      '--bg':      THEME.bg,
      '--surface': THEME.surface,
      '--ink':     THEME.ink,
      '--muted':   THEME.muted,
      '--line':    THEME.line,
    }}>
      <Nav onOpenRss={() => setDrawer(true)} query={query} setQuery={setQuery}
           active={active} onSetActive={setActive} onLogout={handleLogout}
           isAnon={isAnon} onOpenLogin={() => setLoginOpen(true)} onGoHome={goHome} />

      <header className="brand-header">
        <button className="brand-header__link" onClick={goHome}>
          <div className="brand-header__logo">N</div>
          <div className="brand-header__text">
            <span className="brand-header__name">Notiserna</span>
            <span className="brand-header__tagline">Dina nyheter, samlat på ett ställe</span>
          </div>
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
                <strong>Anonym profil</strong> — Skapa ett konto för att synka inställningar och sparade artiklar på alla enheter.
              </span>
              <button className="btn btn--primary" onClick={() => setLoginOpen(true)}>
                Spara inställningar
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
      ) : (
        <main className="content">
          {isAnon && (
            <div className="anon-banner">
              <span className="anon-banner__text">
                <strong>Anonym profil</strong> — Skapa ett konto för att synka inställningar och sparade artiklar på alla enheter.
              </span>
              <button className="btn btn--primary" onClick={() => setLoginOpen(true)}>
                Spara inställningar
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
              {showHero && (
                <HeroCard item={featured} isArchived={archived.has(featured.id)} onToggleArchive={toggleArchive}
                          isRead={readArticles.has(featured.id)} onRead={markAsRead} onOpenReader={openReader} />
              )}
              <div className="grid">
                {(showHero ? rest : filtered).map(item => (
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
        </main>
      )}

      <footer className="foot">
        <div className="foot__rule" />
        <div className="foot__row">
          <span>© Notiserna 2026</span>
          <span>{updatedAt ? `Uppdaterad ${formatUpdated(updatedAt)}` : 'Uppdateras var 15:e minut'}</span>
        </div>
      </footer>

      {readerItem && <ReaderModal item={readerItem} onClose={closeReader} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isAnon={isAnon} />}

      {!isAnon && (
        <RssDrawer open={drawer} onClose={() => setDrawer(false)} feeds={feeds} setFeeds={setAndSaveFeeds}
                   categories={categories} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory}
                   onRenameCategory={handleRenameCategory} saveStatus={saveStatus} saveError={saveError} />
      )}
    </div>
  )
}

export default App
