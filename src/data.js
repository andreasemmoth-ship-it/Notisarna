export const RSS_FEEDS = {
  skatt: [
    { name: 'Skatteverket',       url: 'https://www.skatteverket.se/rss/nyheter.rss',                        enabled: true  },
    { name: 'HFD',                url: 'https://www.domstol.se/hfd/feed',                                    enabled: true  },
    { name: 'PWC Tax Matters',    url: 'https://taxmatters.pwc.se/feed',                                     enabled: true  },
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

export const CATEGORIES = [
  { key: 'all',        label: 'Alla'          },
  { key: 'sverige',    label: 'Sverige'       },
  { key: 'teknik',     label: 'Teknik'        },
  { key: 'varlden',    label: 'Världen'       },
  { key: 'naringsliv', label: 'Näringsliv'    },
  { key: 'kultur',     label: 'Kultur'        },
]
