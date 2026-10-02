# Het Gewelf 3.0

Een Nederlandstalige 3D-afdaling door het AI-raamwerk. De wethouder wil weten of de gemeente een digitale assistent met AI gaat inzetten. Eén speler loopt in first person door het Gewelf onder het stadhuis. Maximaal vijftien adviseurs denken mee via hun telefoon. Onderaan, in de Zegelkamer, besluiten jullie: **niet met AI**, **eerst onderzoeken**, **een begrensde pilot** of **invoeren met waarborgen**.

De vorige top-down voxelversie (The Golem Below 2.1, inclusief het Engelstalige vijfkamer-avontuur) staat volledig in [`backup/golem-below-2.1`](backup/golem-below-2.1/BACKUP.md).

## Starten

Node.js 22.13+ (Node.js 26 voor de tests).

```bash
npm install
npm start
```

Open `http://localhost:5173` en kies **Begin de afdaling**.

| Toets | Actie |
|---|---|
| Klik in de wereld | rondkijken met de muis (Esc geeft de muis vrij) |
| WASD / pijltjes | lopen en draaien |
| Shift | rennen |
| Spatie | springen |
| E of klikken | praten, een bron lezen, het zegel aanraken |
| M | kaart: direct naar een kamer reizen |

Pip, de lantaarngolem, vliegt vooruit naar het volgende doel. Trappen lopen echt omlaag: loop erin om af te dalen. Zonder WebGL blijven alle kamers via de Kaart bereikbaar.

## De afdaling

| Diepte | Ruimte | Wat er gebeurt |
|---|---|---|
| 0 | De Ontvangsthal | De brief van de wethouder op de lessenaar. |
| 1 | De Kamer van de Vraag | Probleem & noodzaak: is AI hier eigenlijk het antwoord? |
| 2 | De Hal der Fundamenten | Governance, Cultuur & Adoptie, Kennis & Capaciteit, Infrastructuur & Data. |
| 3 | De Galerij der Domeinen | Tien domeinen, van Evaluatie tot Beveiliging. Kies wat telt. |
| 4 | De Zegelkamer | Het besluit, de afspraken en het besluitdossier. |

Elke kamer werkt zoals in de vorige versie: een herkenbare casus, drie optionele bronnen op sokkels in de kamer, meerdere passende maatregelen, een adviesronde op de telefoons en uitleg per optie (kernmaatregel, nuttige aanvulling, niet passend). Daarna komt de kamer in het **dossier**:

- **Stevig** — alle kernmaatregelen gekozen en geen ongeschikte aanpak (groene markering);
- **Open punten** — er ontbreekt iets of er is een ongeschikte aanpak gekozen (oranje);
- **Blinde vlek** — niet besproken (de deuropening gloeit nog).

In de Zegelkamer zien speler en raad eerst het dossier, kiezen dan zelf een besluit en zien pas daarna welk besluit het dossier kon dragen en waarom (bijvoorbeeld: *zonder eigenaar kan zelfs een pilot niet verantwoord draaien*). Stoppen is altijd een legitieme uitkomst. Er is geen score. Tot slot leggen jullie eigenaar, eerste stap, evaluatiedatum en stopcriterium vast en downloaden jullie het besluitdossier (Markdown). Zie [docs/spel-3.0.md](docs/spel-3.0.md) voor de regels.

## Adviesraad

Via **Adviesraad** verschijnt een QR-code en deelnamelink. Computer en telefoons moeten hetzelfde netwerk gebruiken. De telefoon toont de casus, alle bronnen, de stemopties, het dossier en het besluit; het 3D-scherm is niet nodig. Stemmen zijn advies; de speler beslist.

## Ontwikkeling

- `npm run check` — syntaxcontrole.
- `npm run build` — browserbundel en Worker-uitvoer voor hosting.
- `npm test` — regels van het dossier en een volledige afdaling via de API.
- `npm run package:partners` — ZIP voor partners in `share/`.
- Code: `client/dungeon.js` (Three.js-wereld), `client/descent.js` (HUD, panelen, telefoons), `game/descent.cjs` (spelregels en dossier), `game/descent.json` (brief, Kamer van de Vraag, besluitopties), `game/topics.json` (de veertien raamwerkkamers).
- Lokale opslag: `data/gewelf-sessions.json` (of `GOLEM_DATA_FILE`). Gehost: dezelfde D1-tabel met voorwaardelijke schrijfacties. Sessies van de vorige versie worden netjes geweigerd.
- `?debug` achter de URL zet `window.__gewelf` aan voor testen.

## Licentie

Open source onder de [MIT-licentie](LICENSE). Gebruik, aanpassen en delen mag, ook voor andere organisaties.

De oorspronkelijke workshop blijft lokaal beschikbaar op `/workshop.html`. Dit spel genereert geen antwoorden met een AI-model en vervangt geen juridisch advies.
