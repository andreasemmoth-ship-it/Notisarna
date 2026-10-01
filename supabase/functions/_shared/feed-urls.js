// Ersätt endast kända gamla adresser; behåll namn och aktiveringsstatus.
const replacements = new Map([
  ['https://www.domstol.se/hfd/feed', 'https://www.domstol.se/feed/56?searchPageId=1092&scope=news'],
  ['https://taxmatters.pwc.se/feed', 'https://blogg.pwc.se/taxmatters/rss.xml'],
])

/** @param {string} url */
export function normalizeFeedUrl(url) {
  return replacements.get(url) ?? url
}
