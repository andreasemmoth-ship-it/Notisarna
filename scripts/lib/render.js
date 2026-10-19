// Genererar statisk HTML för artikelsidor och övriga innehållssidor.
// Sidorna fungerar utan JavaScript; React-appen laddas bara på startsidan.
import { Marked } from 'marked'
import { parseVideo } from './posts.js'

export const SITE_URL = 'https://www.notiserna.se'
export const SITE_NAME = 'Notiserna'
const DEFAULT_IMAGE = `${SITE_URL}/images/blogg/notiserna.jpeg`

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const dateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export function formatDate(iso) {
  return iso ? dateFormat.format(new Date(`${iso}T00:00:00Z`)) : ''
}

function absoluteUrl(url) {
  if (!url) return ''
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export const articleUrl = slug => `/artiklar/${slug}`

// ----- Markdown -----
export const AD_LABEL = 'Annonslänk – Notiserna kan få ersättning om du använder tjänsten.'
export const DISCLAIMER = 'Allmän information, inte individuell rådgivning. Text, presentatör och röst i våra videor är AI-genererade och granskade av människa.'

function isExternal(href) {
  return /^https?:\/\//.test(href) && !href.startsWith(SITE_URL)
}

// Annonslänkar skrivs i Markdown med titeln "annons": [Tjänsten](https://… "annons")
const isAdLink = title => typeof title === 'string' && title.trim().toLowerCase() === 'annons'

function createMarked() {
  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        const attrs = [`href="${escapeHtml(href)}"`]
        if (isAdLink(title)) {
          attrs.push('target="_blank"', 'rel="sponsored noopener"', 'class="ad-link"')
        } else {
          if (title) attrs.push(`title="${escapeHtml(title)}"`)
          if (isExternal(href)) attrs.push('target="_blank"', 'rel="noopener"')
        }
        return `<a ${attrs.join(' ')}>${text}</a>`
      },
      // Artikelns rubrik är sidans enda h1; rubriker i texten börjar på h2.
      heading({ tokens, depth }) {
        const level = Math.min(Math.max(depth, 2), 6)
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`
      },
    },
  })
  return marked
}

// Renderar brödtexten och lägger annonsmärkningen ovanför det första
// stycke (eller lista, tabell …) som innehåller en annonslänk.
function renderArticleBody(post) {
  const marked = createMarked()
  const tokens = marked.lexer(post.body)
  let labelled = false
  const blocks = tokens.map(token => {
    const block = [token]
    block.links = tokens.links
    const html = marked.parser(block)
    if (labelled || !html.includes('class="ad-link"')) return html
    if (!post.affiliate) {
      throw new Error(`${post.file}: innehåller annonslänkar men har affiliate: false. Sätt affiliate: true.`)
    }
    labelled = true
    return `<p class="ad-label">${AD_LABEL}</p>\n${html}`
  })
  if (post.affiliate && !labelled) {
    console.warn(`Varning: ${post.file} har affiliate: true men inga länkar märkta "annons".`)
  }
  return blocks.join('')
}

// ----- Ikoner (samma som i React-appen) -----
const ICONS = {
  arrow: '<path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m11 19-7-7 7-7"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
}
function icon(name, size = 16, className = '') {
  return `<svg${className ? ` class="${className}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
}

// ----- Sidmall -----
const NAV_ITEMS = [
  { key: 'nyheter', href: '/', label: 'Nyheter', icon: 'rss' },
  { key: 'artiklar', href: '/artiklar', label: 'Artiklar', icon: 'book-open' },
  { key: 'om', href: '/om', label: 'Om', icon: 'info' },
]

function navHtml(active) {
  const links = NAV_ITEMS.map(item =>
    `<a href="${item.href}"${item.key === active ? ' class="is-active" aria-current="page"' : ''}>${item.label}</a>`).join('\n        ')
  return `<header class="nav">
      <a class="nav__brand" href="/">
        <div class="nav__logo">N</div>
        <div class="nav__name">Notiserna</div>
      </a>
      <nav class="nav__links" aria-label="Huvudmeny">
        ${links}
      </nav>
      <div class="nav__right">
        <button type="button" class="icon-btn theme-toggle" data-theme-toggle title="Byt mellan ljust och mörkt läge" aria-label="Byt mellan ljust och mörkt läge">
          ${icon('moon', 16, 'theme-toggle__moon')}${icon('sun', 16, 'theme-toggle__sun')}
        </button>
      </div>
    </header>`
}

function mobileNavHtml(active) {
  const items = NAV_ITEMS.map(item =>
    `<a class="mobile-nav__item${item.key === active ? ' is-active' : ''}" href="${item.href}"${item.key === active ? ' aria-current="page"' : ''}>
        ${icon(item.icon, 20)}
        <span>${item.label}</span>
      </a>`).join('\n      ')
  return `<nav class="mobile-nav" aria-label="Huvudmeny">
      ${items}
    </nav>`
}

function footerHtml() {
  return `<footer class="foot">
      <div class="foot__rule"></div>
      <div class="foot__row">
        <span>© Notiserna ${new Date().getFullYear()} · <a class="foot__privacy-link" href="/om">Om sajten</a> · <a class="foot__privacy-link" href="/integritet">Integritetspolicy</a></span>
        <span>Allmän information, inte rådgivning</span>
      </div>
    </footer>`
}

// Samma tema-logik som i index.html, så att mörkt läge följer med mellan sidor.
const THEME_INIT = `(function(){try{var s=localStorage.getItem('colorScheme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`
const THEME_TOGGLE = `document.querySelectorAll('[data-theme-toggle]').forEach(function(b){b.addEventListener('click',function(){var n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('colorScheme',n)}catch(e){}})});`

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

/**
 * @param {object} page
 * @param {string} page.title        <title> och og:title
 * @param {string} page.description
 * @param {string} page.path         t.ex. /artiklar/slug
 * @param {string} page.body         HTML inuti <main>
 * @param {string} page.active       nyheter | artiklar | om
 * @param {string} page.headAssets   <link>-taggar för CSS från Vite-bygget
 * @param {string} [page.ogType]
 * @param {string} [page.image]
 * @param {string} [page.extraHead]
 * @param {string} [page.extraScripts]
 * @param {string} [page.robots]
 */
export function layout(page) {
  const url = `${SITE_URL}${page.path}`
  const image = absoluteUrl(page.image) || DEFAULT_IMAGE
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
  <meta name="robots" content="${page.robots ?? 'index, follow'}" />

  <meta property="og:type" content="${page.ogType ?? 'website'}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:locale" content="sv_SE" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
${page.extraHead ?? ''}
  <script>${THEME_INIT}</script>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ${page.headAssets}
</head>
<body>
  <div class="shell">
    ${navHtml(page.active)}

    <main class="content">
${page.body}
    </main>

    ${footerHtml()}

    ${mobileNavHtml(page.active)}
  </div>
  <script>${THEME_TOGGLE}</script>
${page.extraScripts ?? ''}
  <script defer src="/_vercel/insights/script.js"></script>
  <script defer src="/_vercel/speed-insights/script.js"></script>
</body>
</html>
`
}

// ----- Artikelsida -----
function sourcesHtml(sources) {
  if (!sources.length) return ''
  const items = sources.map(src => `<li class="article-view__sources-item">${src.url
    ? `<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener" class="article-view__source-link">${escapeHtml(src.title)}</a>`
    : escapeHtml(src.title)}</li>`).join('\n          ')
  return `
      <section class="article-view__sources" aria-labelledby="kallor">
        <h2 id="kallor" class="article-view__sources-label">Källor</h2>
        <ul class="article-view__sources-list">
          ${items}
        </ul>
      </section>`
}

function shareHtml(post) {
  const url = encodeURIComponent(`${SITE_URL}${articleUrl(post.slug)}`)
  return `
      <div class="article-view__share">
        <span class="article-view__share-label">Dela artikeln:</span>
        <div class="article-view__share-buttons">
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener" class="share-btn">LinkedIn</a>
          <a href="https://twitter.com/intent/tweet?url=${url}&amp;text=${encodeURIComponent(post.titel)}" target="_blank" rel="noopener" class="share-btn">X</a>
          <button type="button" class="share-btn share-btn--copy" data-share hidden>Kopiera länk</button>
          <span class="share-toast" data-share-toast hidden>Länken kopierad!</span>
        </div>
      </div>`
}

// Videon laddas först när besökaren trycker på den. Då hämtas inget från
// TikTok/YouTube (och inga kakor sätts) förrän besökaren själv väljer det.
// Utan JavaScript leder länken till videon på plattformen.
function videoHtml(post) {
  const video = parseVideo(post.video)
  if (!video) return ''
  return `
      <figure class="article-video">
        <a class="article-video__facade" href="${escapeHtml(video.url)}" target="_blank" rel="noopener"
           data-video-embed="${escapeHtml(video.embed)}" data-video-title="${escapeHtml(post.titel)}">
          <span class="article-video__play" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z"/></svg></span>
          <span class="article-video__label">Se videon</span>
          <span class="article-video__note">Spelas upp från ${video.platform}. När du startar videon hämtas innehåll från ${video.platform}.</span>
        </a>
      </figure>`
}

const VIDEO_SCRIPT = `<script>document.querySelectorAll('[data-video-embed]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var f=document.createElement('iframe');f.src=a.getAttribute('data-video-embed');f.title=a.getAttribute('data-video-title')||'Video';f.className='article-video__frame';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');a.replaceWith(f)})})</script>`

// Delningsknappen kräver JavaScript och visas bara när den fungerar.
const SHARE_SCRIPT = `<script>(function(){var b=document.querySelector('[data-share]');if(!b)return;var t=document.querySelector('[data-share-toast]');var canShare=!!navigator.share;if(!canShare&&!navigator.clipboard)return;b.textContent=canShare?'Dela':'Kopiera länk';b.hidden=false;b.addEventListener('click',function(){var u=document.querySelector('link[rel=canonical]').href;if(canShare){navigator.share({title:document.title,url:u}).catch(function(){});return}navigator.clipboard.writeText(u).then(function(){t.hidden=false;setTimeout(function(){t.hidden=true},2000)})})})();</script>`

export function renderArticlePage(post, { headAssets }) {
  const path = articleUrl(post.slug)
  const content = renderArticleBody(post)
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.titel,
    description: post.beskrivning,
    image: [absoluteUrl(post.bild) || DEFAULT_IMAGE],
    datePublished: post.datum,
    dateModified: post.senastGranskad,
    inLanguage: 'sv-SE',
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${path}` },
    author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon-192.png` },
    },
  })

  const image = post.bild ? `
        <div class="article-view__featured-image-wrapper">
          <img src="${escapeHtml(post.bild)}" alt="" class="article-view__featured-image" width="1280" height="720" />
        </div>` : ''

  const body = `    <article class="article-view">
      <div class="article-view__back-wrapper">
        <a class="btn btn--ghost btn--sm" href="/artiklar">${icon('arrow-left', 13)} Alla artiklar</a>
      </div>

      <header class="article-view__header">
        <div class="article-view__meta">
          <span>Artikel</span>
          <span class="dot-sep">·</span>
          <time datetime="${post.datum}">${formatDate(post.datum)}</time>
        </div>
        <h1 class="article-view__title">${escapeHtml(post.titel)}</h1>
        <p class="article-view__lead">${escapeHtml(post.beskrivning)}</p>
        <p class="article-view__reviewed">Senast granskad: <time datetime="${post.senastGranskad}">${formatDate(post.senastGranskad)}</time></p>${image}
      </header>
${videoHtml(post)}

      <div class="article-view__content">
${content}
      </div>
${sourcesHtml(post.kallor)}

      <aside class="article-view__info-box article-view__disclaimer">
        <p>${DISCLAIMER}</p>
      </aside>
${shareHtml(post)}

      <div class="article-view__footer-nav">
        <a class="article-view__footer-nav-btn" href="/">${icon('arrow-left', 13)} Till nyheterna</a>
      </div>
    </article>`

  return layout({
    title: `${post.titel} — ${SITE_NAME}`,
    description: post.beskrivning,
    path,
    image: post.bild,
    ogType: 'article',
    active: 'artiklar',
    headAssets,
    body,
    extraHead: `  <meta property="article:published_time" content="${post.datum}" />
  <meta property="article:modified_time" content="${post.senastGranskad}" />
  ${ld}`,
    extraScripts: (post.video ? VIDEO_SCRIPT : '') + SHARE_SCRIPT,
  })
}

// ----- Artikellista -----
export function renderArticlesIndex(posts, { headAssets }) {
  const items = posts.length === 0
    ? `      <div class="empty">
        <h3>Inga artiklar ännu</h3>
        <p>Vi fyller på med nytt innehåll inom kort.</p>
      </div>`
    : `      <div class="article-archive-list">
${posts.map(post => `        <a href="${articleUrl(post.slug)}" class="article-archive-item">${post.bild ? `
          <div class="article-archive-item__img"><img src="${escapeHtml(post.bild)}" alt="" loading="lazy" /></div>` : ''}
          <div class="article-archive-item__content">
            <time class="article-archive-item__date" datetime="${post.datum}">${formatDate(post.datum)}</time>
            <h2 class="article-archive-item__title">${escapeHtml(post.titel)}</h2>
            <p class="article-archive-item__desc">${escapeHtml(post.beskrivning)}</p>
            <span class="article-archive-item__link">Läs artikeln ${icon('arrow', 13)}</span>
          </div>
        </a>`).join('\n')}
      </div>`

  return layout({
    title: `Artiklar — ${SITE_NAME}`,
    description: 'Förklarande artiklar om vardagsekonomi från Notiserna.',
    path: '/artiklar',
    active: 'artiklar',
    headAssets,
    body: `      <div class="article-archive-header">
        <h1>Artiklar</h1>
        <p>Förklarande artiklar om vardagsekonomi, senaste först</p>
      </div>
${items}`,
  })
}

// ----- 404 -----
export function renderNotFound({ headAssets }) {
  return layout({
    title: `Sidan finns inte — ${SITE_NAME}`,
    description: 'Sidan du letar efter finns inte.',
    path: '/404',
    active: '',
    robots: 'noindex',
    headAssets,
    body: `      <div class="empty">
        <h1>Sidan finns inte</h1>
        <p>Länken kan vara felskriven eller så har sidan flyttats.</p>
        <p><a class="btn btn--primary" href="/">Till nyheterna</a> <a class="btn btn--ghost" href="/artiklar">Alla artiklar</a></p>
      </div>`,
  })
}

// ----- Sitemap -----
export function renderSitemap(entries) {
  const urls = entries.map(e => `  <url>
    <loc>${escapeHtml(`${SITE_URL}${e.path}`)}</loc>${e.lastmod ? `
    <lastmod>${e.lastmod}</lastmod>` : ''}
  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

// ----- Textsidor (Om, Integritet) -----
function textPage({ title, lead, path, active, description, content, headAssets }) {
  return layout({
    title: `${title} — ${SITE_NAME}`,
    description,
    path,
    active,
    headAssets,
    body: `    <article class="article-view text-page">
      <header class="article-view__header">
        <h1 class="article-view__title">${title}</h1>
        <p class="article-view__lead">${lead}</p>
      </header>
      <div class="article-view__content">
${content}
      </div>
    </article>`,
  })
}

export function renderAboutPage({ headAssets }) {
  return textPage({
    title: 'Om Notiserna',
    lead: 'Nyheter och förklarande artiklar om vardagsekonomi.',
    description: 'Vad Notiserna är, hur nyheter, artiklar och AI-genererade videor tas fram och granskas, annonslänkar och kontakt.',
    path: '/om',
    active: 'om',
    headAssets,
    content: `<h2>Vad är Notiserna?</h2>
<p>Notiserna har två delar. <a href="/">Nyheterna</a> är ett flöde med rubriker från svenska och internationella nyhetskällor som uppdateras automatiskt ungefär var femtonde minut. Varje nyhet länkar till källan, där du läser hela texten. <a href="/artiklar">Artiklarna</a> är våra egna och förklarar vardagsekonomi: sådant som påverkar plånboken, som avgifter, avtal, skatter och priser.</p>

<h2>Våra videor</h2>
<p>Många artiklar hör ihop med en kort video på TikTok, Instagram eller YouTube. Text, presentatör och röst i videorna är AI-genererade. Presentatören är alltså ingen verklig person. Varje video granskas av en människa innan den publiceras, och artikeln här på sajten innehåller källorna som videon bygger på.</p>

<h2>Så tar vi fram och granskar innehållet</h2>
<ul>
<li>Vi utgår från primärkällor när det går, till exempel myndigheter, lagtext och företagens egna villkor. Källorna listas längst ner i varje artikel.</li>
<li>AI-verktyg används för att ta fram utkast till text och video. En människa kontrollerar fakta, siffror och källor och ansvarar för det som publiceras.</li>
<li>Varje artikel visar när den senast granskades. Regler och priser ändras, så kontrollera alltid aktuella villkor innan du fattar beslut.</li>
<li>Hittar du ett fel? Hör av dig så rättar vi det.</li>
</ul>
<p>Innehållet är allmän information och inte individuell rådgivning.</p>

<h2>Annonslänkar</h2>
<p>Sajten kan innehålla annonslänkar (affiliatelänkar). Om du använder en tjänst via en sådan länk kan Notiserna få ersättning, utan att det kostar dig något extra. Annonslänkar är alltid märkta med texten ”Annonslänk” ovanför den första länken i artikeln. Ersättningen påverkar inte vad vi skriver.</p>

<h2>Kontakt</h2>
<p>Notiserna drivs av [NAMN/KONTAKT].</p>
<p>E-post: [NAMN/KONTAKT]</p>
<p>Läs om hur vi hanterar personuppgifter i vår <a href="/integritet">integritetspolicy</a>.</p>`,
  })
}

export function renderPrivacyPage({ headAssets }) {
  return textPage({
    title: 'Integritetspolicy',
    lead: 'Notiserna har inga konton och ingen inloggning. Här beskriver vi vad som ändå sparas och vilka tjänster sajten använder.',
    description: 'Hur Notiserna hanterar personuppgifter: inga konton, inga kakor, cookiefri besöksstatistik från Vercel.',
    path: '/integritet',
    active: '',
    headAssets,
    content: `<p><em>Senast uppdaterad: oktober 2026</em></p>

<h2>Inga konton, ingen inloggning</h2>
<p>Du kan inte skapa konto eller logga in på Notiserna, och vi använder inga sessions-ID. Vi vet inte vem du är när du besöker sajten.</p>

<h2>Vad som sparas i din webbläsare</h2>
<p>Notiserna sätter inga kakor (cookies). Två inställningar kan sparas i webbläsarens lokala lagring (localStorage), och bara om du själv gör ett val:</p>
<ul>
<li><strong>colorScheme</strong> – om du valt ljust eller mörkt läge.</li>
<li><strong>viewMode</strong> – om du valt rutnät eller lista i nyhetsflödet.</li>
</ul>
<p>Uppgifterna lämnar aldrig din enhet. Du tar bort dem genom att rensa webbplatsdata för notiserna.se i webbläsaren.</p>

<h2>Besöksstatistik</h2>
<p>Vi använder Vercel Web Analytics och Vercel Speed Insights för att förstå hur många som besöker sajten och hur snabbt sidorna laddar. Tjänsterna använder inga kakor. Enligt Vercel samlas uppgifterna in i aggregerad form, till exempel vilken sida som visades, varifrån besökaren kom, land, typ av enhet och webbläsare samt laddningstider. Enligt Vercel går enskilda besökare inte att identifiera eller följa mellan olika webbplatser.</p>

<h2>Tjänster vi använder</h2>
<ul>
<li><strong>Vercel</strong> – driftar sajten. Som alla webbservrar tar Vercel emot din IP-adress för att kunna skicka sidan till dig.</li>
<li><strong>Supabase</strong> – databasen som nyhetsflödet hämtas från. Din webbläsare hämtar nyheterna direkt därifrån, och Supabase tar då emot din IP-adress.</li>
<li><strong>Google Fonts</strong> – typsnitten hämtas från Google, som då tar emot din IP-adress.</li>
<li><strong>TikTok och YouTube</strong> – videor i artiklarna laddas först när du trycker på dem. Då hämtas innehåll från plattformen, och dess egen integritetspolicy gäller.</li>
</ul>

<h2>Länkar till andra webbplatser</h2>
<p>Nyheter och annonslänkar leder till andra webbplatser. När du klickar dig vidare gäller deras villkor och integritetspolicyer, och de kan sätta egna kakor.</p>

<h2>Tidigare versioner av sajten</h2>
<p>Tidigare kunde besökare spara bokmärken och läst-historik via anonym inloggning. Funktionen är borttagen. [BEKRÄFTA: Sparade uppgifter raderades ÅÅÅÅ-MM-DD.]</p>

<h2>Dina rättigheter och kontakt</h2>
<p>Personuppgiftsansvarig är [NAMN/KONTAKT]. Du har rätt att begära information om, rättelse av och radering av personuppgifter som rör dig. Kontakta oss på [NAMN/KONTAKT]. Du kan också lämna klagomål till Integritetsskyddsmyndigheten (IMY).</p>`,
  })
}
