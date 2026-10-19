// Flikar på startsidan. Nyheter visar alla kategorier i NEWS_CATEGORY_KEYS;
// kategoriflikarna visar bara sin kategori.
export const NEWS_TABS = [
  { key: 'all', label: 'Nyheter' },
  { key: 'sverige', label: 'Sverige' },
  { key: 'varlden', label: 'Världen' },
  { key: 'naringsliv', label: 'Näringsliv' },
  { key: 'teknik', label: 'Teknik' },
  { key: 'artiklar', label: 'Artiklar' },
]

// Kategorier som visas på sajten. Övriga kategorier i news_articles
// (t.ex. ai, sport, skatt, kultur, lokalt) kan fortfarande hämtas men visas inte.
export const NEWS_CATEGORY_KEYS = ['sverige', 'teknik', 'varlden', 'naringsliv']
