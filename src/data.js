export const RSS_FEEDS = {
  skatt: [
    { name: 'Skatteverket',       url: 'https://www.skatteverket.se/rss/nyheter.rss',                        enabled: true  },
    { name: 'HFD',                url: 'https://www.domstol.se/hfd/feed',                                    enabled: true  },
    { name: 'PWC Tax Matters',    url: 'https://taxmatters.pwc.se/feed',                                     enabled: true  },
  ],
  teknik: [
    { name: 'Ars Technica',       url: 'https://feeds.arstechnica.com/arstechnica/index',                    enabled: true  },
    { name: 'The Verge',          url: 'https://www.theverge.com/rss/index.xml',                             enabled: true  },
    { name: 'Hacker News',        url: 'https://hnrss.org/frontpage',                                       enabled: false },
  ],
  varlden: [
    { name: 'Reuters',            url: 'https://feeds.reuters.com/reuters/worldNews',                        enabled: true  },
    { name: 'BBC News',           url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                       enabled: true  },
  ],
  naringsliv: [
    { name: 'Dagens industri',    url: 'https://www.di.se/rss',                                              enabled: true  },
    { name: 'SVD Näringsliv',     url: 'https://www.svd.se/?service=rss&type=section&id=24561',             enabled: true  },
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

export const CATEGORIES = [
  { key: 'all',        label: 'Alla'          },
  { key: 'skatt',      label: 'Skatt & juridik' },
  { key: 'teknik',     label: 'Teknik'        },
  { key: 'varlden',    label: 'Världen'       },
  { key: 'naringsliv', label: 'Näringsliv'    },
  { key: 'lokalt',     label: 'Lokalt'        },
  { key: 'kultur',     label: 'Kultur'        },
]
