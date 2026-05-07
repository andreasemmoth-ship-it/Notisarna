/* global React, ReactDOM, RSS_FEEDS, CATEGORIES */
const { useState, useMemo, useEffect } = React;

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

function placeholderBg(hue) {
  const h2 = (hue + 40) % 360;
  return `linear-gradient(135deg, oklch(0.78 0.10 ${hue}) 0%, oklch(0.62 0.13 ${h2}) 100%)`;
}

const Icon = ({ name, size = 16 }) => {
  const paths = {
    search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    arrow:    <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    rss:      <><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/></>,
    plus:     <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    close:    <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    trash:    <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

// ----- Cards -----
function HeroCard({ item }) {
  return (
    <article className="hero-card">
      <div className="hero-card__media" style={{ background: placeholderBg(item.hue) }}>
        <span className="media-stripe" />
        <span className="media-label">[ {item.category} bild ]</span>
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
        <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
           rel="noopener noreferrer" className="read-more">
          Läs hela artikeln <Icon name="arrow" size={15} />
        </a>
      </div>
    </article>
  );
}

function NewsCard({ item }) {
  return (
    <article className="news-card">
      <div className="news-card__media" style={{ background: placeholderBg(item.hue) }}>
        <span className="media-stripe" />
        <span className="media-label">[ {item.category.toLowerCase()} ]</span>
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
        <a href={item.link || '#'} target={item.link ? '_blank' : undefined}
           rel="noopener noreferrer" className="read-more read-more--small">
          Läs mer <Icon name="arrow" size={13} />
        </a>
      </div>
    </article>
  );
}

// ----- Header / nav -----
function Nav({ onOpenRss, query, setQuery }) {
  return (
    <header className="nav">
      <div className="nav__brand">
        <div className="nav__logo">N</div>
        <div className="nav__name">Notisarna</div>
      </div>
      <nav className="nav__links">
        <a href="#" onClick={e => e.preventDefault()}>Flöde</a>
        <a href="#" onClick={e => e.preventDefault()}>Bevakade</a>
        <a href="#" onClick={e => e.preventDefault()}>Arkiv</a>
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
function RssDrawer({ open, onClose, feeds, setFeeds }) {
  const [newName, setNewName] = useState('');
  const [newUrl,  setNewUrl]  = useState('');
  const [newCat,  setNewCat]  = useState('skatt');

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

  return (
    <>
      <div className={`drawer-overlay ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'is-open' : ''}`}>
        <header className="drawer__head">
          <div>
            <div className="drawer__eyebrow">Inställningar</div>
            <h2>Koppla RSS-flöden</h2>
            <p>Välj vilka källor som ska läsas in per kategori.</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="drawer__body">
          <section className="add-feed">
            <h4>Lägg till nytt flöde</h4>
            <div className="add-feed__row">
              <input placeholder="Namn (t.ex. SVT Nyheter)" value={newName}
                     onChange={e => setNewName(e.target.value)} />
              <input placeholder="https://exempel.se/rss" value={newUrl}
                     onChange={e => setNewUrl(e.target.value)} />
              <select value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button className="btn btn--primary" onClick={addFeed}>
                <Icon name="plus" size={14} /> Lägg till
              </button>
            </div>
          </section>

          {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
            <section key={cat.key} className="feed-group">
              <div className="feed-group__head">
                <h4>{cat.label}</h4>
                <span className="feed-group__count">{(feeds[cat.key] || []).length} flöden</span>
              </div>
              <ul className="feed-list">
                {(feeds[cat.key] || []).length === 0 && (
                  <li className="feed-row feed-row--empty">Inga flöden ännu.</li>
                )}
                {(feeds[cat.key] || []).map((f, idx) => (
                  <li key={idx} className={`feed-row ${f.enabled ? 'is-on' : ''}`}>
                    <button className={`tgl ${f.enabled ? 'is-on' : ''}`}
                            onClick={() => toggle(cat.key, idx)}>
                      <span className="tgl__knob" />
                    </button>
                    <div className="feed-row__text">
                      <div className="feed-row__name">{f.name}</div>
                      <div className="feed-row__url">{f.url}</div>
                    </div>
                    <button className="icon-btn icon-btn--quiet" onClick={() => remove(cat.key, idx)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
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
  const [active,    setActive]    = useState('all');
  const [query,     setQuery]     = useState('');
  const [drawer,    setDrawer]    = useState(false);
  const [feeds,     setFeeds]     = useState(RSS_FEEDS);
  const [news,      setNews]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    fetch('news.json')
      .then(r => r.json())
      .then(data => {
        setNews(data.articles || []);
        setUpdatedAt(data.generated_at || '');
      })
      .catch(err => console.error('Kunde inte ladda news.json:', err))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="shell" style={{
      '--accent':  THEME.accent,
      '--bg':      THEME.bg,
      '--surface': THEME.surface,
      '--ink':     THEME.ink,
      '--muted':   THEME.muted,
      '--line':    THEME.line,
    }}>
      <Nav onOpenRss={() => setDrawer(true)} query={query} setQuery={setQuery} />

      <section className="hello">
        <div className="hello__inner">
          <div className="hello__brand">
            <div className="hello__logo">N</div>
            <div className="hello__wordmark">Notisarna</div>
          </div>
          <h1 className="hello__greet">
            <span className="hello__greet-line">{getGreeting()}, Andreas.</span>
            <span className="hello__greet-line hello__greet-line--quiet">Här kommer dina senaste nyheter.</span>
          </h1>
        </div>
      </section>

      <div className="filter-bar">
        <div className="filter-bar__inner">
          {CATEGORIES.map(c => (
            <button key={c.key}
                    className={`pill ${active === c.key ? 'is-active' : ''}`}
                    onClick={() => setActive(c.key)}>
              {c.label}
              <span className="pill__count">
                {c.key === 'all'
                  ? news.length
                  : news.filter(n => n.categoryKey === c.key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

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

        {!loading && showHero && <HeroCard item={featured} />}

        {!loading && (
          <div className="grid">
            {(showHero ? rest : filtered).map(item => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <footer className="foot">
        <div className="foot__rule" />
        <div className="foot__row">
          <span>© Notisarna 2026</span>
          <span>{updatedAt ? `Uppdaterad ${formatUpdated(updatedAt)}` : 'Uppdateras varje timme'}</span>
        </div>
      </footer>

      <RssDrawer open={drawer} onClose={() => setDrawer(false)} feeds={feeds} setFeeds={setFeeds} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
