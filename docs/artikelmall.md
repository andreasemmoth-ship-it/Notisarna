---
# Kopiera filen till src/content/posts/<slug>.md och fyll i fälten.
titel: "Rubriken som visas överst och i sökresultat"
beskrivning: "Ingressen. Visas under rubriken och som meta description (helst under 160 tecken)."
slug: kort-adress-med-bindestreck      # blir notiserna.se/artiklar/kort-adress-med-bindestreck
datum: 2026-10-19                      # publiceringsdatum, ÅÅÅÅ-MM-DD
senastGranskad: 2026-10-19             # uppdatera när artikeln granskas på nytt
publicerad: false                      # true = visas, byggs och hamnar i sitemap
video: https://www.tiktok.com/@konto/video/1234567890123456789   # valfri; TikTok eller YouTube Shorts
affiliate: false                       # true om texten innehåller annonslänkar
kallor:
  - titel: "Konsumentverket – exempelsida"
    url: https://www.konsumentverket.se/
  - "En källa utan länk går också bra"
# bild: /images/blogg/bild.jpeg        # valfri bild överst
---
Brödtexten skrivs i Markdown. Använd ## för mellanrubriker (rubriken ovan är sidans enda h1).

En vanlig länk: [Konsumentverket](https://www.konsumentverket.se/).

En annonslänk märks med titeln "annons": [Tjänstens namn](https://exempel.se/?ref=notiserna "annons").
Den får rel="sponsored noopener" och texten "Annonslänk – Notiserna kan få ersättning om du
använder tjänsten." visas automatiskt ovanför det första stycket med en annonslänk. Kräver
affiliate: true, annars stoppas bygget.
