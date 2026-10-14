# Het Gewelf 3.1

Een Nederlandstalige 3D-afdaling door het AI-raamwerk. Een overheidsorganisatie overweegt AI. Eén speler loopt in first person door het Gewelf onder het gebouw; maximaal vijftien adviseurs denken mee via hun telefoon. Onderweg doen jullie in elke kamer een proef, kiezen jullie maatregelen en verslaan jullie wat je tegenhoudt. Onderaan, in de Zegelkamer, besluiten jullie: **niet met AI**, **eerst onderzoeken**, **een begrensde pilot** of **invoeren met waarborgen**. Daarna lezen jullie wat er een jaar later gebeurt.

De vorige top-down voxelversie (The Golem Below 2.1) staat in [`backup/golem-below-2.1`](backup/golem-below-2.1/BACKUP.md).

## Drie verhalen

| Verhaal | Organisatie | Voorstel | Kritische domeinen |
|---|---|---|---|
| **Het Loket** (instap) | Gemeente Dalwijk | Een digitale assistent voor inwonersvragen | Kwaliteit, Mens-assistentinteractie, Ethiek |
| **De Bezwaarkamer** | Uitvoeringsdienst Woonlasten | Een schrijfassistent voor beslissingen op bezwaar | Ethiek, Compliance, Mens-assistentinteractie |
| **Het Woo-archief** | Waterschap De Lage Weiden | Een zoek- en lakassistent voor Woo-verzoeken | Beveiliging, Compliance, Kwaliteit |

De vijftien kamers van het raamwerk zijn in elk verhaal dezelfde, maar de casus, de brief, de bewoner, de monsters, de eindbaas en de afloop verschillen. Kies bij de start ook of je **rustige modus** wilt: monsters vallen dan niet aan.

## Starten

Node.js 22.13+ (Node.js 26 voor de tests).

```bash
npm install
npm start
```

Open `http://localhost:5173`, kies **Begin de afdaling** en daarna een verhaal.

| Toets | Actie |
|---|---|
| Klik in de wereld | rondkijken met de muis (Esc geeft de muis vrij) |
| WASD / pijltjes | lopen en draaien |
| Shift · Spatie | rennen · springen |
| E of klikken | praten, een bron lezen, iets oppakken of gebruiken |
| Klik of F · 1/2/3 | in een gevecht: gereedschap gebruiken · wisselen |
| M | kaart: direct naar een kamer of tussenkamer reizen |

## De afdaling

| Plek | Wat er gebeurt |
|---|---|
| Diepte 0 · De Ontvangsthal | De brief, de bewoner van het verhaal en Glans, de leverancier met zijn **Snelle Trap** direct naar het besluit. Wie die neemt, slaat alles over; dat staat daarna in het dossier. |
| Diepte 1 · De Kamer van de Vraag | Probleem en noodzaak: hoor drie betrokkenen bij de bron van Waarom. |
| Tussenkamer I | Monsters van hype en haast. |
| Diepte 2 · De Hal der Fundamenten | Governance, Cultuur & Adoptie, Kennis & Capaciteit, Infrastructuur & Data. |
| Tussenkamer II | Lekken, vooroordelen en verborgen instructies. |
| Diepte 3 · De Galerij der Domeinen | Tien domeinen; kies wat telt. |
| De Drempel | De eindbaas van het verhaal: De Fabulant, De Stempelautomaat of De Lekkende Hydra. |
| Diepte 4 · De Zegelkamer | Het besluit, de afspraken en het besluitdossier. |

**Elke kamer** heeft een eigen inrichting en een **proef** die naar de keuze toe leidt: stempels naar de juiste tafel brengen, datakisten door de juiste poort, de antwoorden van een orakel toetsen, meetpalen beoordelen, hendels zetten in de postkamer, bellen luiden in de volgorde van een goed gesprek, sleutels verzamelen over een brug boven een kloof, naar stemmen in luisterhoorns luisteren of fluisteraars uit een besmette bijlage verslaan. De bevinding van de proef staat daarna bij de casus. Proeven zijn over te slaan.

Daarna werkt een kamer zoals in 3.0: een casus, drie optionele bronnen, meerdere passende maatregelen, een adviesronde op de telefoons en uitleg per optie. De kamer komt in het **dossier** als *stevig*, *open punten* of *blinde vlek*.

**In de tussenkamers** is elk monster zwak tegen één gereedschap: de **Toetslamp** (toetsen en meten), de **Weegschaal** (afwegen en de menselijke toets) of het **Zegel** (beschermen en begrenzen). Kijk naar een monster om te zien welk. Wie een monster verslaat, krijgt een les die in het dossier komt. Adviseurs kunnen vanaf hun telefoon **steun sturen**; dat geeft de speler vertrouwen terug. Elk gevecht is over te slaan.

In de **Zegelkamer** zien speler en raad eerst het dossier, kiezen dan een besluit en zien pas daarna welk besluit het dossier kon dragen, waarom, en hoe het verhaal **een jaar later** afloopt. Er is geen score. Zie [docs/spel-3.1.md](docs/spel-3.1.md) voor de regels.

## Ontwikkeling

- `npm run check` — syntaxcontrole.
- `npm run build` — browserbundel en Worker-uitvoer voor hosting.
- `npm test` — inhoud van de drie verhalen, dossierregels, proefregels en een volledige afdaling via de API.
- `npm run package:partners` — ZIP voor partners in `share/`.
- Inhoud: `game/stories.json` (drie verhalen: brief, cast, Kamer van de Vraag, casusvarianten, monsters, eindbaas, afloop), `game/trials.json` (de proeven per kamer), `game/topics.json` (de veertien raamwerkkamers), `game/descent.json` (plekken, besluitopties, gereedschap). `game/stories.cjs` voegt dit per verhaal samen.
- Regels: `game/descent.cjs` (sessie en dossier), `client/trials.cjs` (proeven).
- 3D: `client/dungeon.js` met `client/world/` (`layout.js` rooster, `chambers.js` kamers en proeven, `combat.js` gevechten, `props.js` en `kit.js` bouwstenen). Pagina en telefoons: `client/descent.js`.
- Lokale opslag: `data/gewelf-sessions.json` (of `GOLEM_DATA_FILE`). Sessies uit 3.0 werken door als ‘Het Loket’; sessies van de 2.x-versies worden netjes geweigerd.
- `?debug` achter de URL zet `window.__gewelf` aan voor testen.

## Licentie

Open source onder de [MIT-licentie](LICENSE). Gebruik, aanpassen en delen mag, ook voor andere organisaties.

De oorspronkelijke workshop blijft lokaal beschikbaar op `/workshop.html`. Dit spel genereert geen antwoorden met een AI-model en vervangt geen juridisch advies.
