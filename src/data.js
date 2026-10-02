import { normalizeFeedUrl } from '../supabase/functions/_shared/feed-urls.js'

export const RSS_FEEDS = {
  sport: [
    { name: 'SVT Sport', url: 'https://www.svt.se/sport/rss.xml', enabled: true },
    { name: 'Sportbladet', url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/', enabled: true },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', enabled: true },
  ],
  ai: [
    { name: 'Anthropic News', url: 'https://raw.githubusercontent.com/alan-turing-institute/ai-rss-feeds/refs/heads/main/feeds/anthropic-news.xml', enabled: true },
    { name: 'Claude Blog', url: 'https://raw.githubusercontent.com/alan-turing-institute/ai-rss-feeds/refs/heads/main/feeds/claude-blog.xml', enabled: true },
    { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', enabled: true },
    { name: 'Google Gemini', url: 'https://blog.google/products-and-platforms/products/gemini/rss/', enabled: true },
    { name: 'Google AI', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/', enabled: true },
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', enabled: true },
  ],
  skatt: [
    { name: 'Skatteverket',       url: 'https://www.skatteverket.se/rss/nyheter.rss',                        enabled: true  },
    { name: 'HFD',                url: 'https://www.domstol.se/feed/56?searchPageId=1092&scope=news',                                    enabled: true  },
    { name: 'PWC Tax Matters',    url: 'https://blogg.pwc.se/taxmatters/rss.xml',                                     enabled: true  },
  ],
  sverige: [
    { name: 'SVT Nyheter',        url: 'https://www.svt.se/rss.xml',                                         enabled: true  },
    { name: 'Dagens Nyheter',     url: 'https://www.dn.se/rss/',                                             enabled: true  },
  ],
  teknik: [
    { name: 'The Verge',          url: 'https://www.theverge.com/rss/index.xml',                             enabled: true  },
    { name: 'Feber',              url: 'https://feber.se/rss/',                                              enabled: true  },
    { name: 'Tech Radar',         url: 'https://www.techradar.com/feeds.xml',                                enabled: true  },
    { name: 'Forbes Innovation',  url: 'https://www.forbes.com/innovation/feed',                             enabled: true  },
  ],
  varlden: [
    { name: 'BBC News',           url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                        enabled: true  },
    { name: 'New York Times',     url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',             enabled: true  },
    { name: 'Associated Press',   url: 'https://feedx.net/rss/ap.xml',                                       enabled: true  },
  ],
  naringsliv: [
    { name: 'Dagens industri',    url: 'https://www.di.se/rss',                                              enabled: true  },
    { name: 'SVD Näringsliv',     url: 'https://www.svd.se/?service=rss&type=section&id=24561',              enabled: true  },
    { name: 'EFN',                url: 'https://efn.se/rss/infront',                                         enabled: true  },
  ],
  lokalt: [
    { name: 'SVT Stockholm',      url: 'https://www.svt.se/nyheter/lokalt/stockholm/rss.xml',               enabled: true  },
    { name: 'Göteborgs-Posten',   url: 'https://www.gp.se/rss',                                             enabled: false },
  ],
  kultur: [
    { name: 'Kulturnytt',         url: 'https://api.sr.se/api/rss/program/2795',                            enabled: true  },
    { name: 'Pitchfork',          url: 'https://pitchfork.com/rss/news/',                                   enabled: false },
  ],
}

export const NEWS_TABS = [
  { key: 'all', label: 'Nyheter' },
  { key: 'ai', label: 'AI' },
  { key: 'skatt', label: 'Skatt' },
  { key: 'sport', label: 'Sport' },
]

// Behåll underkategorierna för RSS-inställningar och befintliga artiklar.
export function mergeCategories(saved = []) {
  return [...CATEGORIES, ...saved.filter(c => !CATEGORIES.some(defaultCat => defaultCat.key === c.key))]
}

export const CATEGORIES = [
  { key: 'sport', label: 'Sport', hue: 130 },
  { key: 'ai', label: 'AI', hue: 260 },
  { key: 'skatt', label: 'Skatt', hue: 24 },
  { key: 'all',        label: 'Nyheter'          },
  { key: 'sverige',    label: 'Sverige'       },
  { key: 'teknik',     label: 'Teknik'        },
  { key: 'varlden',    label: 'Världen'       },
  { key: 'naringsliv', label: 'Näringsliv'    },
  { key: 'kultur',     label: 'Kultur'        },
]

export function mergeFeeds(saved = {}) {
  return Object.fromEntries(Object.entries({ ...RSS_FEEDS, ...saved }).map(([key, feeds]) => [
    key, feeds.map(feed => ({ ...feed, url: normalizeFeedUrl(feed.url) })),
  ]))
}
