/* global React, ReactDOM, RSS_FEEDS, CATEGORIES */
const { useState, useMemo, useEffect, useCallback } = React;
const db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const DEFAULT_CAT_KEYS = new Set(['all', 'skatt', 'teknik', 'varlden', 'naringsliv', 'lokalt', 'kultur']);
const HUE_PALETTE = [180, 30, 260, 120, 340, 200, 80, 300, 45, 160];

function slugify(str) {
  return str.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const THEME = {
  accent:  '#0a0a0a',
  bg:      'oklch(0.97 0.008 80)',
  surface: '#fff',
  ink:     'oklch(0.16 0.01 60)',
  muted:   'oklch(0.45 0.01 60)',
  line:    'oklch(0.90 0.008 60)',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'God natt';
  if (h < 11) return 'God morgon';
  if (h < 17) return 'God eftermiddag';
  if (h < 22) return 'God kväll';
  return 'God natt';
}

function isMorning() {
  const d = new Date();
  const h = d.getHours(), m = d.getMinutes();
  return h < 9 || (h === 9 && m < 30);
}

function placeholderBg(hue) {
  const h = hue ?? 200;
  const h2 = (h + 40) % 360;
  return `linear-gradient(135deg, oklch(0.78 0.10 ${h}) 0%, oklch(0.62 0.13 ${h2}) 100%)`;
}

const Icon = ({ name, size = 16 }) => {
  const paths = {
    search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    arrow:    <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    rss:      <><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/></>,
    plus:     <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    close:    <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    check:    <path d="M20 6 9 17l-5-5"/>,
    pencil:   <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></>,
    trash:    <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></>,
    bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>,
    spark:   <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    book:    <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></>,
    spin:    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>,
    grid:    <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    listview:<><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

// ----- Cards -----
function HeroCard({ item, isArchived, onToggleArchive, onOpenReader }) {
  return (
    <article className="hero-card">
      <div className="hero-card__media" style={{ background: placeholderBg(item.hue) }}>
        {item.image
          ? <img src={item.image} alt="" className="media-img"
                 onError={e => { e.target.style.display = 'none'; }} />
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
        </div>
        <h1 className="hero-card__title">{item.headline}</h1>
        <p className="hero-card__summary">{item.summary}</p>
        <div className="card__footer">
          <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
             rel="noopener noreferrer" className="read-more">
            Läs hela artikeln <Icon name="arrow" size={15} />
          </a>
          <div className="card__actions">
            {item.link && (
              <button className="icon-btn" onClick={() => onOpenReader(item)} title="Läsläge">
                <Icon name="book" size={16} />
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
  );
}

function NewsCard({ item, isArchived, onToggleArchive, onOpenReader }) {
  return (
    <article className="news-card">
      <div className="news-card__media" style={{ background: placeholderBg(item.hue) }}>
        {item.image
          ? <img src={item.image} alt="" className="media-img"
                 onError={e => { e.target.style.display = 'none'; }} />
          : <><span className="media-stripe" /><span className="media-label">[ {item.category.toLowerCase()} ]</span></>
        }
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
          <div className="card__actions">
            {item.link && (
              <button className="icon-btn" onClick={() => onOpenReader(item)} title="Läsläge">
                <Icon name="book" size={14} />
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
  );
}

function ListCard({ item, isArchived, onToggleArchive, onOpenReader }) {
  return (
    <article className="list-card">
      <div className="list-card__media" style={{ background: placeholderBg(item.hue) }}>
        {item.image && (
          <img src={item.image} alt="" className="media-img"
               onError={e => { e.target.style.display = 'none'; }} />
        )}
      </div>
      <div className="list-card__body">
        <div className="list-card__meta">
          <span className="cat-tag cat-tag--small">{item.category}</span>
          <span className="dot-sep">·</span>
          <span>{item.source}</span>
          <span className="dot-sep">·</span>
          <span>{item.date}</span>
        </div>
        <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
           rel="noopener noreferrer">
          <h3 className="list-card__title">{item.headline}</h3>
        </a>
      </div>
      <div className="list-card__actions">
        {item.link && (
          <button className="icon-btn" onClick={() => onOpenReader(item)} title="Läsläge">
            <Icon name="book" size={14} />
          </button>
        )}
        <button className={`bookmark-btn ${isArchived ? 'is-saved' : ''}`}
                onClick={() => onToggleArchive(item)}
                title={isArchived ? 'Ta bort från arkiv' : 'Spara till arkiv'}>
          <Icon name="bookmark" size={14} />
        </button>
      </div>
    </article>
  );
}

// ----- Morning briefing -----
function MorningBriefing({ text }) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hasBullets = lines.some(l => l.startsWith('•'));
  return (
    <div className="briefing">
      <div className="briefing__icon"><Icon name="spark" size={18} /></div>
      <div className="briefing__body">
        <div className="briefing__label">AI-morgonbriefing</div>
        {hasBullets ? (
          <ul className="briefing__list">
            {lines.map((l, i) => <li key={i} className="briefing__item">{l}</li>)}
          </ul>
        ) : (
          <p className="briefing__text">{text}</p>
        )}
      </div>
    </div>
  );
}

// ----- Reader modal -----
function ReaderModal({ state, onClose }) {
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, onClose]);

  useEffect(() => {
    document.body.style.overflow = state.open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [state.open]);

  if (!state.open) return null;

  return (
    <div className="reader-overlay" onClick={onClose}>
      <article className="reader-modal" onClick={e => e.stopPropagation()}>
        <button className="reader-close icon-btn" onClick={onClose} title="Stäng">
          <Icon name="close" size={18} />
        </button>

        {state.loading && (
          <div className="reader-loading">
            <svg className="reader-spinner" width="32" height="32" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="1.7"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p>Hämtar artikel…</p>
          </div>
        )}

        {!state.loading && state.error && (
          <div className="reader-error">
            <h3>Kunde inte läsa artikeln</h3>
            <p>{state.error}</p>
            <a href={state.sourceUrl} target="_blank" rel="noopener noreferrer"
               className="btn btn--primary" style={{ marginTop: 20, alignSelf: 'flex-start' }}>
              Öppna originalsidan <Icon name="arrow" size={14} />
            </a>
          </div>
        )}

        {!state.loading && state.article && (
          <>
            {state.image && (
              <img src={state.image} alt="" className="reader-hero-img"
                   onError={e => { e.target.style.display = 'none'; }} />
            )}
            <header className="reader-head">
              {state.article.siteName && (
                <div className="reader-source">{state.article.siteName}</div>
              )}
              <h1 className="reader-title">{state.article.title}</h1>
              {state.article.byline && (
                <p className="reader-byline">{state.article.byline}</p>
              )}
            </header>
            <div className="reader-body"
                 dangerouslySetInnerHTML={{ __html: state.article.content }} />
            <footer className="reader-foot">
              <a href={state.sourceUrl} target="_blank" rel="noopener noreferrer"
                 className="read-more">
                Läs på originalsidan <Icon name="arrow" size={14} />
              </a>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

// ----- Header / nav -----
function Nav({ onOpenRss, query, setQuery, active, onSetActive, onGoHome }) {
  return (
    <header className="nav">
      <button className="nav__brand" onClick={onGoHome}>
        <div className="nav__logo">N</div>
        <div className="nav__name">Notiserna</div>
      </button>
      <nav className="nav__links">
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('all'); }}
           className={active !== 'arkiv' ? 'is-active' : ''}>Flöde</a>
        <a href="#" onClick={e => e.preventDefault()}>Bevakade</a>
        <a href="#" onClick={e => { e.preventDefault(); onSetActive('arkiv'); }}
           className={active === 'arkiv' ? 'is-active' : ''}>Arkiv</a>
      </nav>
      <div className="nav__right">
        <div className="nav__search">
          <Icon name="search" size={14} />
          <input placeholder="Sök…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn--ghost" onClick={onOpenRss}>
          <Icon name="rss" size={14} /> Källor
        </button>
      </div>
    </header>
  );
}

// ----- RSS settings drawer -----
function RssDrawer({ open, onClose, feeds, setFeeds, categories, onAddCategory, onRemoveCategory, onRenameCategory, saveStatus, saveError }) {
  const [newName,     setNewName]     = useState('');
  const [newUrl,      setNewUrl]      = useState('');
  const [newCat,      setNewCat]      = useState('skatt');
  const [newCatName,  setNewCatName]  = useState('');
  const [editing,     setEditing]     = useState(null);
  const [showCatEdit, setShowCatEdit] = useState(false);
  const [editingCat,  setEditingCat]  = useState(null);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const key = slugify(newCatName);
    if (!key || categories.some(c => c.key === key)) return;
    const usedHues = new Set(categories.map(c => c.hue).filter(Boolean));
    const hue = HUE_PALETTE.find(h => !usedHues.has(h)) ?? Math.floor(Math.random() * 360);
    onAddCategory({ key, label: newCatName.trim(), hue });
    setNewCatName('');
  };

  const saveCatRename = () => {
    if (!editingCat?.label.trim()) return;
    onRenameCategory(editingCat.key, editingCat.label.trim());
    setEditingCat(null);
  };

  const addFeed = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setFeeds(prev => ({
      ...prev,
      [newCat]: [...(prev[newCat] || []), { name: newName, url: newUrl, enabled: true }],
    }));
    setNewName(''); setNewUrl('');
  };

  const toggle = (cat, idx) => {
    setFeeds(prev => ({
      ...prev,
      [cat]: prev[cat].map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f),
    }));
  };

  const remove = (cat, idx) => {
    setFeeds(prev => ({ ...prev, [cat]: prev[cat].filter((_, i) => i !== idx) }));
  };

  const startEdit = (cat, idx, name, url) => setEditing({ cat, idx, name, url });
  const cancelEdit = () => setEditing(null);
  const saveEdit = () => {
    if (!editing || !editing.name.trim() || !editing.url.trim()) return;
    setFeeds(prev => ({
      ...prev,
      [editing.cat]: prev[editing.cat].map((f, i) =>
        i === editing.idx ? { ...f, name: editing.name.trim(), url: editing.url.trim() } : f
      ),
    }));
    setEditing(null);
  };

  return (
    <>
      <div className={`drawer-overlay ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        <header className="drawer__head">
          <div>
            <div className="drawer__eyebrow">Inställningar</div>
            <h2>Koppla RSS-flöden</h2>
            <p>Välj vilka källor som ska läsas in per kategori.</p>
            {saveStatus === 'saving' && (
              <p className="save-status save-status--saving">Sparar…</p>
            )}
            {saveStatus === 'ok' && (
              <p className="save-status save-status--ok">Sparat!</p>
            )}
            {saveStatus === 'error' && (
              <p className="save-status save-status--error">Fel: {saveError}</p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="drawer__body">
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
                  const isDefault = DEFAULT_CAT_KEYS.has(cat.key);
                  const isEditingThis = editingCat?.key === cat.key;
                  return (
                    <li key={cat.key} className="feed-row">
                      {isEditingThis ? (
                        <div className="feed-row__edit">
                          <input
                            value={editingCat.label}
                            autoFocus
                            onChange={e => setEditingCat({ ...editingCat, label: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') saveCatRename(); if (e.key === 'Escape') setEditingCat(null); }}
                          />
                          <button className="icon-btn" title="Spara" onClick={saveCatRename}>
                            <Icon name="check" size={14} />
                          </button>
                          <button className="icon-btn icon-btn--quiet" title="Avbryt" onClick={() => setEditingCat(null)}>
                            <Icon name="close" size={14} />
                          </button>
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
                  );
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
                  const isEditing = editing && editing.cat === cat.key && editing.idx === idx;
                  return (
                    <li key={idx} className={`feed-row ${f.enabled && !isEditing ? 'is-on' : ''}`}>
                      {isEditing ? (
                        <div className="feed-row__edit">
                          <input
                            value={editing.name}
                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                            placeholder="Namn"
                          />
                          <input
                            value={editing.url}
                            onChange={e => setEditing({ ...editing, url: e.target.value })}
                            placeholder="URL"
                            className="feed-row__edit-url"
                          />
                          <button className="icon-btn" title="Spara" onClick={saveEdit}>
                            <Icon name="check" size={14} />
                          </button>
                          <button className="icon-btn icon-btn--quiet" title="Avbryt" onClick={cancelEdit}>
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button className={`tgl ${f.enabled ? 'is-on' : ''}`}
                                  onClick={() => toggle(cat.key, idx)}>
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
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

function formatUpdated(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function App() {
  const [active,       setActive]       = useState('all');
  const [query,        setQuery]        = useState('');
  const [drawer,       setDrawer]       = useState(false);
  const [feeds,        setFeeds]        = useState(RSS_FEEDS);
  const [categories,   setCategories]   = useState(CATEGORIES);
  const [news,         setNews]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [updatedAt,    setUpdatedAt]    = useState(null);
  const [saveStatus,   setSaveStatus]   = useState('idle');
  const [saveError,    setSaveError]    = useState('');
  const [archived,     setArchived]     = useState(new Set());
  const [archiveItems, setArchiveItems] = useState([]);
  const [filterOpen,   setFilterOpen]   = useState(() => window.innerWidth > 880);
  const [reader,       setReader]       = useState({ open: false, loading: false, article: null, error: null, sourceUrl: '', image: '' });
  const [viewMode,     setViewMode]     = useState('grid');
  const [aiSummary,    setAiSummary]    = useState('');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    db.from('briefings').select('content').eq('date', today).limit(1)
      .then(({ data }) => { if (data?.[0]?.content) setAiSummary(data[0].content); });
  }, []);

  useEffect(() => {
    db.from('feed_config').select('feeds, categories').eq('id', 1).single()
      .then(({ data, error }) => {
        if (error) { console.error('Supabase load:', error.code, error.message); return; }
        if (data?.feeds && Object.keys(data.feeds).length > 0) setFeeds(data.feeds);
        if (data?.categories?.length) {
          setCategories([
            { key: 'all', label: 'Alla' },
            ...CATEGORIES.filter(c => c.key !== 'all'),
            ...data.categories,
          ]);
        }
      });
  }, []);

  useEffect(() => {
    db.from('archived_articles').select('id, article, saved_at').order('saved_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('Archive load:', error.message); return; }
        if (data?.length) {
          setArchiveItems(data.map(r => ({ ...r.article, savedAt: r.saved_at })));
          setArchived(new Set(data.map(r => r.id)));
        }
      });
  }, []);

  const toggleArchive = useCallback((item) => {
    const isSaved = archived.has(item.id);
    if (isSaved) {
      db.from('archived_articles').delete().eq('id', item.id)
        .then(({ error }) => {
          if (error) { console.error('Archive delete:', error.message); return; }
          setArchived(prev => { const s = new Set(prev); s.delete(item.id); return s; });
          setArchiveItems(prev => prev.filter(a => a.id !== item.id));
        });
    } else {
      db.from('archived_articles')
        .upsert({ id: item.id, article: item, saved_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) { console.error('Archive save:', error.message); return; }
          setArchived(prev => new Set([...prev, item.id]));
          setArchiveItems(prev => [{ ...item, savedAt: new Date().toISOString() }, ...prev.filter(a => a.id !== item.id)]);
        });
    }
  }, [archived]);

  const saveConfig = useCallback((newFeeds, newCats) => {
    setSaveStatus('saving');
    setSaveError('');
    const customCats = newCats.filter(c => !DEFAULT_CAT_KEYS.has(c.key));
    db.from('feed_config')
      .upsert({ id: 1, feeds: newFeeds, categories: customCats, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) {
          console.error('Supabase:', error.message);
          setSaveError(error.message);
          setSaveStatus('error');
        } else {
          setSaveStatus('ok');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      });
  }, []);

  const goHome = useCallback(() => {
    setActive('all');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const closeReader = useCallback(() => setReader(prev => ({ ...prev, open: false })), []);

  const openReader = useCallback(async (item) => {
    setReader({ open: true, loading: true, article: null, error: null, sourceUrl: item.link, image: item.image || '' });
    try {
      const fnUrl = `${window.SUPABASE_URL}/functions/v1/reader-mode?url=${encodeURIComponent(item.link)}`;
      const res = await fetch(fnUrl, {
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
        },
      });
      const data = await res.json();
      if (data.error) {
        setReader(prev => ({ ...prev, loading: false, error: data.error }));
      } else {
        setReader(prev => ({ ...prev, loading: false, article: data }));
      }
    } catch (err) {
      setReader(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  const setAndSaveFeeds = useCallback((updater) => {
    setFeeds(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveConfig(next, categories);
      return next;
    });
  }, [categories, saveConfig]);

  const handleAddCategory = useCallback((cat) => {
    const newCats = [...categories, cat];
    setCategories(newCats);
    saveConfig(feeds, newCats);
  }, [categories, feeds, saveConfig]);

  const handleRemoveCategory = useCallback((key) => {
    const newCats = categories.filter(c => c.key !== key);
    const newFeeds = { ...feeds };
    delete newFeeds[key];
    setCategories(newCats);
    setFeeds(newFeeds);
    saveConfig(newFeeds, newCats);
    if (active === key) setActive('all');
  }, [categories, feeds, active, saveConfig]);

  const handleRenameCategory = useCallback((key, newLabel) => {
    const newCats = categories.map(c => c.key === key ? { ...c, label: newLabel } : c);
    setCategories(newCats);
    saveConfig(feeds, newCats);
  }, [categories, feeds, saveConfig]);

  const fetchNews = useCallback(() => {
    db.from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { console.error('Supabase news:', error.message); return; }
        const articles = (data || []).map(row => ({
          ...row,
          categoryKey: row.category_key,
          date: row.date_sv,
        }));
        setNews(articles);
        if (articles[0]?.fetched_at) setUpdatedAt(articles[0].fetched_at);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNews();

    const channel = db.channel('news-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_articles' }, fetchNews)
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [fetchNews]);

  const filtered = useMemo(() => {
    let list = news;
    if (active !== 'all') list = list.filter(i => i.categoryKey === active);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        i.headline.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [news, active, query]);

  const featured = filtered.find(i => i.featured) || filtered[0];
  const rest      = filtered.filter(i => i !== featured);
  const showHero  = featured && active === 'all' && !query;

  const briefing = useMemo(() => {
    if (!news.length) return '';
    const seen = new Set();
    const snippets = [];
    for (const a of news) {
      if (!a.headline || !a.categoryKey) continue;
      if (!seen.has(a.categoryKey) && snippets.length < 3) {
        seen.add(a.categoryKey);
        snippets.push(`${a.headline.replace(/\.+$/, '')} (${a.source || ''})`);
      }
    }
    const d = new Date();
    const today = `${d.getDate()} ${['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'][d.getMonth()]} ${d.getFullYear()}`;
    const catCount = new Set(news.map(a => a.categoryKey)).size;
    let text = `${today}: ${news.length} artiklar från ${catCount} kategorier.`;
    if (snippets.length) text += ` Höjdpunkter: ${snippets.join(' · ')}.`;
    return text;
  }, [news]);

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
           active={active} onSetActive={setActive} onGoHome={goHome} />

      <section className="hello">
        <div className="hello__inner">
          <button className="hello__brand" onClick={goHome}>
            <div className="hello__logo">N</div>
            <div className="hello__wordmark">Notiserna</div>
          </button>
          <h1 className="hello__greet">
            <span className="hello__greet-line">{getGreeting()}, Andreas.</span>
            <span className="hello__greet-line hello__greet-line--quiet">Här kommer dina senaste nyheter.</span>
          </h1>
        </div>
      </section>

      {active !== 'arkiv' && (
        <div className="filter-bar">
          <div className="filter-bar__inner">
            <button className={`filter-toggle ${filterOpen ? 'is-open' : ''} ${active !== 'all' ? 'has-filter' : ''}`}
                    onClick={() => setFilterOpen(o => !o)}>
              {active !== 'all'
                ? categories.find(c => c.key === active)?.label
                : 'Alla kategorier'}
              <Icon name="chevron" size={14} />
            </button>
            <div className={`filter-pills ${filterOpen ? 'is-open' : ''}`}>
              {categories.map(c => (
                <button key={c.key}
                        className={`pill ${active === c.key ? 'is-active' : ''}`}
                        onClick={() => { setActive(c.key); setFilterOpen(false); }}>
                  {c.label}
                  <span className="pill__count">
                    {c.key === 'all'
                      ? news.length
                      : news.filter(n => n.categoryKey === c.key).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="filter-bar__tools">
              <div className="view-toggle">
                <button className={`view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                        onClick={() => setViewMode('grid')} title="Rutnät">
                  <Icon name="grid" size={15} />
                </button>
                <button className={`view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                        onClick={() => setViewMode('list')} title="Lista">
                  <Icon name="listview" size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {active === 'arkiv' ? (
        <main className="content">
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
                <NewsCard key={item.id} item={item} isArchived={true}
                          onToggleArchive={toggleArchive} onOpenReader={openReader} />
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="content">
          {loading && (
            <div className="empty"><p>Hämtar nyheter…</p></div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="empty">
              <h3>Inga artiklar matchar</h3>
              <p>Prova att rensa sökningen eller välj en annan kategori.</p>
            </div>
          )}

          {!loading && active === 'all' && !query && isMorning() && (
            <MorningBriefing text={aiSummary || briefing} />
          )}

          {!loading && showHero && (
            <HeroCard item={featured} isArchived={archived.has(featured.id)}
                      onToggleArchive={toggleArchive} onOpenReader={openReader} />
          )}

          {!loading && (
            viewMode === 'list' ? (
              <div className="list">
                {(showHero ? rest : filtered).map(item => (
                  <ListCard key={item.id} item={item}
                            isArchived={archived.has(item.id)} onToggleArchive={toggleArchive}
                            onOpenReader={openReader} />
                ))}
              </div>
            ) : (
              <div className="grid">
                {(showHero ? rest : filtered).map(item => (
                  <NewsCard key={item.id} item={item}
                            isArchived={archived.has(item.id)} onToggleArchive={toggleArchive}
                            onOpenReader={openReader} />
                ))}
              </div>
            )
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

      <RssDrawer open={drawer} onClose={() => setDrawer(false)} feeds={feeds} setFeeds={setAndSaveFeeds}
                 categories={categories} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory}
                 onRenameCategory={handleRenameCategory} saveStatus={saveStatus} saveError={saveError} />

      <ReaderModal state={reader} onClose={closeReader} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
