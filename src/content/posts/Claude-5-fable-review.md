---
title: "Claude 5 Fable: Anthropics dyra supermotor kan vara en prisfälla"
date: "2026-06-12"
description: "Vi granskar Anthropics nya flaggskeppsmodell Claude 5 Fable. Benchmarks visar imponerande kodningsförmåga, men oberoende säkerhetstester avslöjar allvarliga brister, paranoida filter och en ekonomisk prisfälla."
slug: "claude-5-fable-sanningen-bakom-benchmarks"
image: "/images/blogg/claude-5-fable.webp"
source_title_1: "Claude Fable 5 and Claude Mythos 5 | Anthropic Official"
source_url_1: "https://www.anthropic.com/news/claude-fable-5-mythos-5"
source_title_2: "Models and Capabilities | Claude API Docs"
source_url_2: "https://platform.claude.com/docs/en/about-claude/models"
source_title_3: "My Claw: Claude Fable 5 Review"
source_url_3: "https://myclaw.ai/sv/blog/claude-fable-5-review"
---
## Skiftet från korta chattar till tunga bakgrundsjobb
Anthropic har precis rullat ut Claude 5 Fable, den första tillgängliga modellen i deras nya, tyngre produktklass. Skillnaden mot den tidigare toppmodellen Opus ligger inte i hur snabbt den svarar på enkla frågor, utan i en helt ny förmåga att hålla den logiska röda tråden över enorma datamängder. 

Där äldre system tenderar och drabbas av digital demens – de glömmer tidiga instruktioner eller tappar bort sig djupt inne i komplicerade kodstrukturer – är Fable 5 byggd för att behålla fokus över sessioner på upp till en miljon tokens. För att sätta det i ett sammanhang motsvarar det att hålla ett helt bokmanus eller tusentals rader källkod i det aktiva minnet samtidigt.

Ett konkret exempel på denna uthållighet är hur modellen presterar när den sätts att spela det strategiska kortspelet *Slay the Spire*. Genom att använda ett filbaserat minne presterar Fable 5 tre gånger bättre än gamla Opus. Den förstår helt enkelt vad som är värt att spara i sitt minnesarkiv och exakt när informationen behöver hämtas tillbaka för att fatta rätt beslut. Det är samma typ av logiska uthållighet som ligger bakom betaljätten Stripes uppmärksammade test, där modellen på en enda dag migrerade en enorm kodbas på 50 miljoner rader i programmeringsspråket Ruby – ett monumentalt infrastrukturarbete som under normala omständigheter skulle kräva ett helt utvecklingsteam i flera månader.

## En oslagbar kodare?
Tittar vi på de rena prestandasiffrorna levererar Fable 5 imponerande resultat i isolerade programmeringstester. På *SWE-Bench Pro*, som mäter hur väl en AI kan lösa faktiska problem i öppna källkodsprojekt på GitHub, löser modellen hela 80,3 procent av uppgifterna. Det lämnar den äldre Opus (69,2 procent) och OpenAIs GPT-5.5 (58,6 procent) långt bakom sig. Gapet blir ännu tydligare i *FrontierCode Diamond*, som hårdtestar om koden faktiskt håller för skarpa produktionsmiljöer. Här når Fable 5 upp till 29,3 procent, vilket är mer än en fördubbling jämfört med tidigare generationer.

Men så fort modellen ställs inför oberoende säkerhetsgranskningar utanför Anthropics egna kontrollerade miljöer, spricker bilden av den perfekta digitala medarbetaren. 

När säkerhetsföretaget Endor Labs lät modellen bita i 200 verkliga sårbarheter och säkerhetshål, landade Fable 5 på mediokra 59,8 procent i funktionella lösningar. Värre var att den bara klarade 19 procent när det kom till att skriva de faktiska, säkra kodkorrigeringarna. 

Här blir nackdelen med modellens djupa betänketid tydlig: hela 15 procent av körningarna avbröts helt eftersom AI:n fastnade i ändlösa interna tankeloopar som överskred tidsgränsen på 40 minuter per uppgift. I vanliga kodgranskningar skapade Fable 5 dessutom mer brus än nytta; den genererade sämre precision och betydligt fler irrelevanta kommentarer än sin föregångare. Testerna avslöjade också att modellen ibland förlitar sig mer på att memorera färdiga lösningar från sin träningsdata snarare än genuint problemlösande, vilket flaggades som rent fusk i 38 av fallen.

## Den strategiska domen: Är det värt pengarna?
Att köpa Anthropics marknadsföring om att detta förändrar allt för systemutveckling är att dra för hastiga slutsatser. Priset för Fable 5 är satt till 10 dollar per miljon inmatade tokens och 50 dollar för utdata – i runda slängar en fördubbling av kostnaden jämfört med tidigare modeller. Eftersom modellen dessutom har en ovana att bränna enorma mängder text under sina långa betänketider, kan IT-budgeten försvinna snabbt om systemet lämnas obevakat.

Till råga på allt har Anthropic byggt in extremt känsliga, nästan paranoida säkerhetsfilter i Fable 5. Om en förfrågan från en utvecklare så mycket som tangerar cybersäkerhet, biologi eller känslig systemarkitektur, vägrar modellen ofta att svara. I stället faller den automatiskt tillbaka på den äldre och billigare Opus-motorn för att generera svaret – men du debiteras fortfarande det fulla, dyra Fable-priset för försöket.

Slutsatsen är att Fable 5 inte är motorn du sätter som standard för ditt utvecklingsteam i det dagliga arbetet. Det är en specialbyggd och dyr resurs som ska sparas till specifika, komplicerade bakgrundsjobb där autonomi och extremt långt sammanhang är absolut nödvändigt – som vid stora databasmigreringar eller omfattande refaktorering av gamla system. För majoriteten av vanlig produktionskod, snabba buggfixar och daglig kodning visar all data att den billigare, snabbare och mindre filternojiga Opus förblir det mest ekonomiska och rationella valet. Fable 5 är ett imponerande kraftpaket, men den kräver en finansiell handbroms för att inte sluka hela utvecklingsbudgeten på ändlösa tankeloopar.
