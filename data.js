window.NEWS_DATA = [
  { id: 'n1', category: 'Skatt & juridik', categoryKey: 'skatt', source: 'Skatteverket', date: '7 maj 2026', headline: 'Nytt ställningstagande om moms vid uthyrning av verksamhetslokaler', summary: 'Skatteverket förtydligar kraven på stadigvarande användning i momspliktig verksamhet vid frivillig skattskyldighet.', featured: true, hue: 24 },
  { id: 'n2', category: 'Teknik', categoryKey: 'teknik', source: 'Ars Technica', date: '7 maj 2026', headline: 'Apple Silicon M5 — första riktiga generationsklivet sedan M1', summary: 'Tidiga benchmarks pekar på 38 % högre prestanda per watt jämfört med M4. Den nya neurala motorn klarar 60 TOPS lokalt.', hue: 220 },
  { id: 'n3', category: 'Näringsliv', categoryKey: 'naringsliv', source: 'Dagens industri', date: '7 maj 2026', headline: 'Riksbanken sänker styrräntan till 1,75 %', summary: 'Direktionen pekar på dämpad inflation och svag konjunktur. Bolåneräntor väntas följa med ned under sommaren.', hue: 150 },
  { id: 'n4', category: 'Skatt & juridik', categoryKey: 'skatt', source: 'HFD', date: '6 maj 2026', headline: 'HFD 2026 ref. 14 — Utrangeringsavdrag vid kvalificerad fusion', summary: 'Högsta förvaltningsdomstolen klargör att utrangeringsavdrag kan medges även när rivningen sker efter en fusion.', hue: 24 },
  { id: 'n5', category: 'Världen', categoryKey: 'varlden', source: 'Reuters', date: '6 maj 2026', headline: 'EU-kommissionen föreslår nya sanktioner mot Ryssland', summary: 'Det 19:e sanktionspaketet riktar in sig på skuggflottan och tredjeländer som hjälper till att kringgå tidigare beslut.', hue: 280 },
  { id: 'n6', category: 'Lokalt', categoryKey: 'lokalt', source: 'SVT Stockholm', date: '6 maj 2026', headline: 'Stockholm bygger ut tunnelbanan till Älvsjö — beslut i kväll', summary: 'Den nya gula linjen kopplar ihop söderort med Odenplan. Trafikstart planeras till 2034 och kostar 28 miljarder.', hue: 60 },
  { id: 'n7', category: 'Teknik', categoryKey: 'teknik', source: 'The Verge', date: '5 maj 2026', headline: 'EU utreder OpenAI och Anthropic för AI Act-överträdelser', summary: 'Granskningen rör transparens kring träningsdata och systemiska risker. Böter på upp till 7 % av global omsättning kan bli aktuella.', hue: 220 },
  { id: 'n8', category: 'Skatt & juridik', categoryKey: 'skatt', source: 'PWC Tax Matters', date: '5 maj 2026', headline: 'Ändrade regler för personaloptioner i fåmansföretag', summary: 'Från 1 juli 2026 utvidgas reglerna om kvalificerade personaloptioner till företag med upp till 300 anställda.', hue: 24 },
  { id: 'n9', category: 'Kultur', categoryKey: 'kultur', source: 'Kulturnytt', date: '4 maj 2026', headline: 'Ny svensk roman vinner Nordiska rådets litteraturpris', summary: 'Juryn lyfter fram bokens språkliga skärpa och samtidsobservation. Författaren tar emot priset i Reykjavik i höst.', hue: 320 },
  { id: 'n10', category: 'Näringsliv', categoryKey: 'naringsliv', source: 'SVD Näringsliv', date: '4 maj 2026', headline: 'Northvolt får ny finansiering — 12 miljarder från konsortium', summary: 'Goldman Sachs och Volkswagen leder rundan. Bolaget riktar nu in sig på lagring för elnät snarare än fordonsbatterier.', hue: 150 },
  { id: 'n11', category: 'Världen', categoryKey: 'varlden', source: 'BBC News', date: '3 maj 2026', headline: 'Klimatavtal i Bangkok — 140 länder enas om ny finansieringsfond', summary: 'Fonden ska stötta utvecklingsländer i klimatomställningen och beräknas omsätta 300 miljarder dollar till 2030.', hue: 280 },
  { id: 'n12', category: 'Teknik', categoryKey: 'teknik', source: 'Hacker News', date: '3 maj 2026', headline: 'Postgres 18 släppt — async I/O ger upp till 4× läshastighet', summary: 'Den nya io_uring-baserade exekveringsmotorn ger dramatiska förbättringar för analytiska arbetsbelastningar.', hue: 220 },
  { id: 'n13', category: 'Lokalt', categoryKey: 'lokalt', source: 'Göteborgs-Posten', date: '2 maj 2026', headline: 'Linbana över älven får grönt ljus — invigs 2029', summary: 'Stadsbyggnadsnämnden godkände planen i går. Linbanan ska gå mellan Järntorget och Lindholmen.', hue: 60 },
  { id: 'n14', category: 'Skatt & juridik', categoryKey: 'skatt', source: 'KPMG Tax News', date: '2 maj 2026', headline: 'Proposition om slopad reklamskatt lämnad till riksdagen', summary: 'Regeringen föreslår att reklamskatten avskaffas helt från 1 januari 2027. Bred politisk förankring väntas.', hue: 24 },
  { id: 'n15', category: 'Kultur', categoryKey: 'kultur', source: 'Pitchfork', date: '1 maj 2026', headline: 'Robyn släpper första albumet på åtta år', summary: 'Skivan är inspelad i Stockholm och Berlin och beskrivs som hennes mest personliga sedan Body Talk.', hue: 320 },
];

window.RSS_FEEDS = {
  skatt: [
    { name: 'Skatteverket', url: 'https://www.skatteverket.se/rss/nyheter.rss', enabled: true },
    { name: 'HFD', url: 'https://www.domstol.se/hfd/feed', enabled: true },
    { name: 'PWC Tax Matters', url: 'https://taxmatters.pwc.se/feed', enabled: true },
  ],
  teknik: [
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', enabled: true },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', enabled: true },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', enabled: false },
  ],
  varlden: [
    { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/worldNews', enabled: true },
    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', enabled: true },
  ],
  naringsliv: [
    { name: 'Dagens industri', url: 'https://www.di.se/rss', enabled: true },
    { name: 'SVD Näringsliv', url: 'https://www.svd.se/?service=rss&type=section&id=24561', enabled: true },
  ],
  lokalt: [
    { name: 'SVT Stockholm', url: 'https://www.svt.se/nyheter/lokalt/stockholm/rss.xml', enabled: true },
    { name: 'Göteborgs-Posten', url: 'https://www.gp.se/rss', enabled: false },
  ],
  kultur: [
    { name: 'Kulturnytt', url: 'https://api.sr.se/api/rss/program/2795', enabled: true },
    { name: 'Pitchfork', url: 'https://pitchfork.com/rss/news/', enabled: false },
  ],
};

window.CATEGORIES = [
  { key: 'all', label: 'Alla' },
  { key: 'skatt', label: 'Skatt & juridik' },
  { key: 'teknik', label: 'Teknik' },
  { key: 'varlden', label: 'Världen' },
  { key: 'naringsliv', label: 'Näringsliv' },
  { key: 'lokalt', label: 'Lokalt' },
  { key: 'kultur', label: 'Kultur' },
];
