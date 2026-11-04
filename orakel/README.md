# Het Orakel van Dalwijk

Een verhalende 3D-dungeon door het AI-raamwerk, voor één speler, in **eerste of derde persoon** (wisselen met <kbd>V</kbd>). Eén groot gewelf onder het stadhuis van Dalwijk, vijf dieptes, veertig ruimtes, vier eindbazen en ongeveer een tot anderhalf uur verhaal. Wie wil, speelt samen: anderen doen mee als **adviesraad** op hun telefoon.

Het hele spel is één HTML-bestand ([`docs/index.html`](../docs/index.html)), zonder server. Daardoor is het speelbaar via GitHub Pages:

**https://tjebbehb.github.io/AI-Raamwerk-Game/** (zodra Pages aan staat, zie [Publiceren](#publiceren-via-github-pages)).

## Het verhaal

Het is je eerste werkdag bij de gemeente Dalwijk. Inwoners wachten negen dagen op antwoord, en leverancier Glans heeft in het Gewelf onder het stadhuis een AI-Orakel neergezet dat ‘het antwoord op elke vraag’ belooft. Sinds het aanstaat, is daar beneden alles gaan… antwoorden: muren die er niet zijn, beloften die rondzweven, monsters van haast en hype. Vrijdag wil de wethouder jouw advies. Samen met Pip, een eigenwijze lantaarngeest, daal je af.

| Diepte | Plek | Wat er gebeurt |
|---|---|---|
| 0 | **Het stadhuis** | De brief van de wethouder, koffie, conciërge Joop met de kelder­sleutel, de wachtende inwoners en Glans met zijn glanzende lift ‘direct naar het besluit’. |
| 1 | **De Kelder der Beloften** | De Toetslamp en Pip, nepmuren die je leert doorzien, het klachten­archief, Vrouwe Waarom in de Kamer van de Vraag (probleem en noodzaak) en eindbaas **De Glimmende Demo**. |
| 2 | **De Hal der Fundamenten** | Vier vleugels, vier fundamenten: governance (stempels en een Doorschuiver), cultuur en adoptie (vonken en vuren), kennis en capaciteit, infrastructuur en data (kratten, drukplaten en een lekkende kelder). Daarna **De Haastkoning**. |
| 3 | **De Galerij der Domeinen** | Tien domeinen rond een kloof. De hoeders geven sleutels; met zeven ervan bouwt Wouter een brug naar de overkant. In het noorden wacht **De Lekkende Hydra**. |
| 4 | **De Kern** | Onzichtbare bruggen, een cocon met een bekende erin, het Orakel zelf en **De Fabulant** in drie fases. Daarna de Zegelkamer: het besluit, en wat er een jaar later gebeurt. |

Elke kamer van het raamwerk (probleem en noodzaak plus de veertien raamwerk­kamers) heeft een hoeder die een afweging vraagt. De inhoud komt rechtstreeks uit het raamwerk van dit project: `game/topics.json`, `game/stories.json` (het verhaal *Het Loket*), `game/trials.json` en `game/descent.json`.

## Zo speel je

| Toets | Actie |
|---|---|
| <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Shift</kbd> | lopen · rennen |
| muis (klik eerst in de wereld) | rondkijken; <kbd>Esc</kbd> geeft de muis vrij en opent het menu |
| <kbd>E</kbd> | praten, lezen, oppakken, gebruiken |
| klik (of ingedrukt houden) | het gekozen gereedschap gebruiken |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> · <kbd>Q</kbd> | Toetslamp · Weegschaal · Zegel · volgende (of neerzetten wat je draagt) |
| <kbd>R</kbd> of rechtermuisknop | onthullen wat niet echt is |
| <kbd>Spatie</kbd> | wegduiken, ook over smalle kloven |
| <kbd>V</kbd> · scrollwiel | eerste of derde persoon · zoomen |
| <kbd>J</kbd> / <kbd>Tab</kbd> · <kbd>M</kbd> · <kbd>H</kbd> | dossier en dagboek · kaart · een hint van Pip |

Op een tablet of telefoon verschijnen aanraakknoppen. Je voortgang wordt in de browser bewaard; met **Spelcode** in het menu neem je hem mee naar een andere browser.

**Gereedschap.** De **Toetslamp** schiet licht (toetsen en meten), de **Weegschaal** geeft een schokgolf (afwegen, de menselijke toets) en het **Zegel** slaat een boog (beschermen en begrenzen). Elk monster is zwak tegen één gereedschap en sterk tegen een ander; kijk naar een monster om te zien welk. Een Datalekslijm splitst zich als je hem niet verzegelt, een Doorschuiver schuift schade door tenzij je hem weegt, een Injectie-imp draait je besturing om.

**Verzamelen.** 45 bronnen (rollen die een afweging makkelijker maken), 12 verzonnen antwoorden van het Orakel voor Pips verzameling hallucinaties (zes maken je lamp sterker), 8 visitekaartjes van Glans en 4 kristallen. Zijpaden: de sleutelbos die Joop in 1998 kwijtraakte, en mevrouw Bakker, die het Gewelf in liep op zoek naar een balie waar een mens zit.

**Het besluit.** Elke afweging komt in het dossier als *stevig*, *open punten* of *blinde vlek*. In de Zegelkamer kies je: **niet met AI**, **eerst verder onderzoeken**, **een begrensde pilot** of **invoeren met waarborgen**. Pas daarna zie je welk besluit het dossier kon dragen, waarom, en hoe het een jaar later afloopt. Het besluitdossier is te downloaden als Markdown. Wie in het stadhuis de lift van Glans neemt, slaat alles over; ook dat heeft een afloop.

**Instellingen** (menu, <kbd>Esc</kbd>): camera, moeilijkheid (*Rustig*: monsters vallen niet aan, fijn voor een workshop; *Verhaal*; *Normaal*; *Pittig*), muis, blikveld, helderheid, muziek en geluid, tekstsnelheid, graphics, beeldschudden en richthulp. Op een trage laptop: kies *Snel* bij graphics, of open het spel met `?q=low`.

## De adviesraad

Eén persoon speelt (bijvoorbeeld op het grote scherm in een workshop), de anderen doen mee op hun telefoon:

1. Open in het spel het menu (<kbd>Esc</kbd>) en kies **Adviesraad** en dan **Start de adviesraad**.
2. Anderen scannen de QR-code of openen de link. Ze vullen een voornaam of bijnaam in.
3. Bij elke afweging verschijnen de maatregelen op de telefoons. Iedereen stemt; de speler ziet per optie hoeveel stemmen er zijn en beslist zelf.
4. In gevechten kunnen adviseurs **steun sturen**: dat geeft de speler vertrouwen (levens) terug.

De berichten (de huidige vraag, stemmen, steun) gaan via een openbare MQTT-server over WebSockets: standaard `broker.emqx.io`, met `broker.hivemq.com` en `test.mosquitto.org` als reserve. Er is geen account nodig, maar deze servers zijn openbaar: deel er geen persoonsgegevens in. Een organisatie kan een eigen server gebruiken, zie hieronder.

## Ontwikkeling

```bash
npm install
npm run orakel          # bouwt, herbouwt bij elke wijziging en serveert op http://localhost:5180
npm run orakel:build    # bouwt het speelbare bestand docs/index.html
npm run orakel:test     # inhoud, kaarten, dossierregels en de berichtenlaag van de adviesraad
```

- `orakel/index.html`: de pagina (HUD, menu's, vensters). De build plakt de gebundelde code op de plek van `<!--BUNDLE-->`.
- `orakel/src/engine/`: renderer (three.js), kaartlezer (ASCII-plattegronden van 2 m per teken), samengevoegde geometrie met ingebakken fakkellicht, deeltjes en modellen.
- `orakel/src/game/`: speler en camera, entiteiten (deuren, poorten, nepmuren, kratten, hendels…), gevechten, dialogen, quests, opslag.
- `orakel/src/content/`: het verhaal. `floors/` bevat de plattegronden, `story/` de gesprekken en gebeurtenissen per diepte, `framework.js` de koppeling met het raamwerk en de dossierregels, `beasts.js` en `bosses.js` de monsters.
- `orakel/src/net/`: de adviesraad (`council.js`) en een kleine MQTT-client (`mqtt.js`).
- `orakel/relay/broker.mjs`: een eigen MQTT-server zonder afhankelijkheden.
- `orakel/test/`: `node:test`-tests: elke plattegrond is leesbaar en begaanbaar, verborgen paden zijn echt verborgen, elke bron, hallucinatie, kaart en kristal bestaat precies één keer, elke kamer heeft een hoeder, de dossierregels kloppen, en de berichten van de adviesraad komen aan.
- In de browser staat `window.__orakel` klaar voor geautomatiseerd testen (onder meer `run(seconden)`, `teleport(x, z)` en `travel(diepte, aankomst)`).

## Publiceren via GitHub Pages

1. Ga op GitHub naar **Settings → Pages**.
2. Kies bij **Build and deployment → Source** voor **Deploy from a branch**.
3. Kies de branch (nu `claude/quirky-brahmagupta-cmjs4l`, na het samenvoegen `main`) en de map **/docs**, en klik op **Save**.
4. Na een minuut staat het spel op **https://tjebbehb.github.io/AI-Raamwerk-Game/**.

Na een wijziging: `npm run orakel:build`, en commit `docs/index.html` mee. Het bestand `docs/.nojekyll` zorgt dat GitHub de pagina ongewijzigd serveert.

## Een eigen server voor de adviesraad

```bash
node orakel/relay/broker.mjs            # luistert op poort 8787 (of $PORT)
```

Open het spel daarna met `?broker=ws://localhost:8787` (lokaal), of met `?broker=wss://jouw-server/` als de server achter TLS staat. Dat laatste is nodig zodra het spel zelf via https draait, zoals op GitHub Pages. De link en QR-code voor de telefoons nemen de server automatisch mee. Elke MQTT-server met WebSockets werkt ook, bijvoorbeeld Mosquitto met:

```
listener 9001
protocol websockets
allow_anonymous true
```

De relay bewaart niets op schijf, houdt per kamer alleen de laatste stand vast (maximaal een dag) en weigert berichten groter dan 32 KB.

## Verantwoording

Het spel gebruikt geen AI-model en vervangt geen juridisch advies. Inspiratie voor de opzet (één zelfstandig HTML-bestand, een verhalende dungeon, en multiplayer via een openbare berichtenserver) kwam van Simon Willisons [Emberwick](https://simonw.github.io/emberwick/v11/emberwick.html) en [Battle Drones](https://simonwillison.net/2026/Oct/20/battledrones/); de code, kaarten, figuren en het verhaal zijn eigen werk. three.js en qrcode (beide MIT) worden meegebundeld; esbuild bouwt het bestand.
