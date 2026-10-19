# Notiserna — nyheter och vardagsekonomi

**Notiserna** har två delar:

- **Nyheter** (startsidan `/`): ett flöde med rubriker från svenska och internationella källor, hämtade
  automatiskt från RSS var 15:e minut. Flikar: *Nyheter* (allt samlat), *Sverige*, *Världen*, *Näringsliv*, *Teknik* och *Artiklar*.
- **Artiklar** (`/artiklar`): egna förklarande artiklar om vardagsekonomi. Korta videor på TikTok, Reels och
  YouTube Shorts hänvisar hit.

Besökare har inga konton och loggar inte in. Sajten hostas på **Vercel**, nyheterna ligger i **Supabase**.

---

## 🏗️ Så hänger det ihop

| Del | Hur den byggs | Fungerar utan JS |
| --- | --- | --- |
| `/` nyhetsflödet | React-app (Vite), läser `news_articles` från Supabase med anon-nyckeln | Nej |
| `/artiklar`, `/artiklar/<slug>` | Statisk HTML från Markdown, `scripts/build-static.js` | Ja |
| `/om`, `/integritet` | Statisk HTML, `scripts/lib/render.js` | Ja |
| `sitemap.xml`, `llms.txt`, `404.html` | Genereras vid build | – |

`npm run build` kör `vite build`, sedan `scripts/build-static.js` och `generate-llms-txt.js`.
Resultatet hamnar i `dist/`.

### Varför statiska artikelsidor?
Artiklarna är rent innehåll och behöver ingen React-logik. Ett eget byggskript skriver färdig HTML med hela
texten, title, meta description, canonical, Open Graph/Twitter och JSON-LD (`Article`). Sökmotorer och
länkförhandsvisningar i appar får allt utan att köra JavaScript, och sidorna laddar snabbt på mobilen.

---

## ✍️ Skriva en artikel

1. Kopiera [docs/artikelmall.md](docs/artikelmall.md) till `src/content/posts/<slug>.md`.
2. Fyll i frontmatter:

| Fält | Krav | Beskrivning |
| --- | --- | --- |
| `titel` | ja | Rubrik (sidans h1 och `<title>`) |
| `beskrivning` | ja | Ingress och meta description |
| `slug` | ja | Adressen `/artiklar/<slug>` (a–z, 0–9, bindestreck) |
| `datum` | ja | Publiceringsdatum `ÅÅÅÅ-MM-DD` |
| `senastGranskad` | ja | Visas som "Senast granskad" och blir `dateModified` |
| `publicerad` | ja | `true` = visas, byggs och hamnar i sitemap. Allt annat = dold |
| `video` | nej | Länk till TikTok (`…/video/<id>`) eller YouTube Shorts |
| `affiliate` | ja | `true` om texten har annonslänkar |
| `kallor` | nej | Lista: `- titel: "…"` + `url: …`, eller bara text |
| `bild` | nej | Bild överst, t.ex. `/images/blogg/bild.jpeg` |

3. Annonslänkar skrivs `[Tjänsten](https://… "annons")`. De får `rel="sponsored noopener"`, och märkningen
   "Annonslänk – Notiserna kan få ersättning om du använder tjänsten." visas ovanför den första. Bygget stoppas om
   en artikel har annonslänkar men `affiliate: false`.
4. Kontrollera med `npm run dev` (artikelsidorna visas även i dev-servern) eller `npm run build && npm run preview`.

Videon laddas först när besökaren trycker på den, så att TikTok/YouTube inte sätter kakor innan dess.

## 🔗 Korta länkar för videor

Videorna hänvisar till korta adresser som `notiserna.se/flyg`. De ligger som 301-omdirigeringar
överst i `redirects` i [vercel.json](vercel.json). Lägg till en rad per länk:

```json
{ "source": "/flyg", "destination": "/artiklar/forsenat-flyg-ersattning", "statusCode": 301 },
```

- `source`: den korta adressen som sägs i videon. Använd bara små bokstäver a–z, siffror och bindestreck (inga å, ä, ö).
- `destination`: artikelns adress, alltid `/artiklar/<slug>` där `<slug>` är `slug` i artikelns frontmatter.
- Raden behöver avslutas med kommatecken om fler rader följer. JSON tillåter inga kommentarer i filen.
- `npm run build` varnar om en kort länk pekar på en artikel som inte är publicerad.
- Testa lokalt med `npm run build && npm run preview` och öppna `http://localhost:4173/flyg`.

Omdirigeringarna kontrolleras innan statiska filer och rewrites, så en kort länk får inte heta
samma sak som en befintlig sida (`/artiklar`, `/om`, `/integritet`).

## 🚀 Drift (Vercel och Supabase)

- **Frontend:** Vercel bygger med `npm run build` vid push till `main`. `vercel.json` innehåller korta länkar,
  omdirigering av gamla adresser (`?view=artiklar&slug=X` → `/artiklar/X`) och rewrites för de statiska sidorna.
- **Supabase:** nyheterna läses av besökare med rollen `anon`. Kör
  [scripts/public_read_news.sql](scripts/public_read_news.sql) en gång så att `anon` får läsa alla nyheter
  (tidigare såg bara inloggade allt). Filen innehåller också valfria steg för att ta bort gamla tabeller och
  anonyma konton.
- **Källor** hanteras direkt i Supabase, i tabellen `feed_config` (kolumnen `feeds`). Sajten visar bara
  kategorierna i `NEWS_CATEGORY_KEYS` i `src/data.js`. Andra kategorier som hämtas (t.ex. `ai`, `sport`) syns inte.

### Säker schemaläggning av `fetch-news`

`fetch-news` körs var 15:e minut via **Supabase Cron**. Funktionen kräver en separat, slumpmässig hemlighet i headern `X-Cron-Secret`; den publika anon-nyckeln räcker inte för att starta en hämtning. GitHub Actions används inte längre som en andra schemaläggare.

1. Lägg samma hemliga värde i Edge Function Secrets som `FETCH_NEWS_CRON_SECRET` och i Supabase Vault som `fetch_news_cron_secret`. Lägg även projektets publika anon-nyckel i Vault som `anon_key` för Edge-gatewayens JWT-kontroll. Lägg aldrig hemligheten i Git.
2. Kör [scripts/secure_fetch_news_cron.sql](scripts/secure_fetch_news_cron.sql) i databasen för att uppdatera cron-anropet och ta bort publik `EXECUTE`-rättighet från triggerfunktionen.
3. Driftsätt Edge-funktionen `fetch-news`. Kontrollera att anrop utan `X-Cron-Secret` får HTTP 401 och att ett cron-anrop lyckas.
4. Kör [scripts/upgrade_bbc_images.sql](scripts/upgrade_bbc_images.sql) en gång för att uppgradera äldre BBC-miniatyrer i databasen.

## ⚡ Lokal utveckling

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bygger till dist/
npm run preview    # http://localhost:4173, beter sig som Vercel för statiska sidor och korta länkar
```

## 📁 Struktur

```text
├── index.html                 # Startsidan (React-appen)
├── src/
│   ├── App.jsx                # Nyhetsflödet
│   ├── main.jsx               # Startpunkt, omdirigering av gamla länkar
│   ├── data.js                # Flikar och kategorier som visas
│   ├── config.js              # Supabase-URL och publik anon-nyckel
│   └── content/posts/         # Artiklar i Markdown
├── scripts/
│   ├── build-static.js        # Statiska sidor, 404 och sitemap.xml
│   ├── lib/posts.js           # Läser och validerar artiklar
│   ├── lib/render.js          # HTML-mallar och Markdown
│   └── *.sql                  # Databasskript
├── generate-llms-txt.js       # dist/llms.txt med publicerade artiklar
├── docs/artikelmall.md        # Mall för nya artiklar
├── styles.css                 # All CSS
├── vercel.json                # Korta länkar, omdirigeringar, rewrites
└── supabase/functions/        # Edge-funktioner (fetch-news m.fl.)
```
