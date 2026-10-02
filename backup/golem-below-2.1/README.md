# The Golem Below 2.1

Een Nederlandstalige voxel-expeditie door het AI-raamwerk, gebaseerd op **Spel ideeen 2.0**. Eén speler verkent de dungeon op het grote scherm. Maximaal vijftien adviseurs denken mee via hun telefoon. De speler beslist.

## Starten

Voor de broncode: Node.js 22.13+ (Node.js 26 voor de tests).

```bash
npm install
npm start
```

Open `http://localhost:5173` en kies **Start de expeditie**. Loop met WASD/pijltjestoetsen spring met Spatie, kruip met C en gebruik E om te kijken, of klik op een poort, bron of opdrachtknop. Geluid is optioneel. Het spel bewaart de voortgang na iedere actie.

Via **Adviesraad** verschijnt een QR-code en deelnamelink. Computer en telefoons moeten hetzelfde netwerk gebruiken. De computer moet blijven draaien; de firewall moet de gekozen serverpoort toelaten. Gebruik bij meerdere netwerkinterfaces het serveradres van de gedeelde wifi. De telefoon toont tekst, alle optionele bronnen, stemopties en de spelerskeuze; het 3D-scherm is niet nodig.

## De vrije expeditie

Het beginportaal geeft toegang tot **vier fundamenten en tien domeinen**. Kies zelf de volgorde. Iedere ruimte heeft een casus, drie informatiebronnen, meerdere selecteerbare maatregelen en inhoudelijke feedback. De raad mag meerdere opties kiezen en een advies aanpassen of intrekken. De speler mag van het advies afwijken.

De vraag, antwoordopties en adviesronde zijn direct beschikbaar bij binnenkomst. Alle 42 bronkaarten zijn optioneel en bevatten uitleg, twee praktische aandachtspunten en een voorbeeld. Open ze naast de vraag via de bronknoppen, of loop naar de objecten in de kamer. Ook de raad kan iedere bron zelfstandig lezen.

Spring over kisten, kruip onder balken en ontwijk de bewegende rolsteen. Je kunt ook om obstakels heen lopen; klikken navigeert automatisch eromheen. Een botsing zet alleen je personage terug bij de ingang. Antwoorden en stemmen blijven bewaard. De knoppen **Spring** en **Kruip / Sta op** zijn een alternatief voor het toetsenbord.

Kernmaatregelen, nuttige aanvullingen en ongeschikte aanpakken krijgen verschillende uitleg. Jullie kunnen een onderwerp opnieuw bespreken; alle rondes blijven bewaard. Projectnotities en de bevroren stemmen bij elk besluit staan in het downloadbare logboek. Na één of meer onderwerpen kunnen jullie afronden. Reken op circa vijf minuten per onderwerp.

Zie [de inhoudelijke uitwerking](docs/spel-2.0.md) voor de casussen, bronkeuzes en beoordelingsnuances. De casussen zijn gescript; het spel verstuurt spelersinvoer niet naar een AI-model.

## Delen met partners

```bash
npm run package:partners
```

Dit maakt `share/The-Golem-Below-2.1-Partner-Pack.zip` met de browserbundel, lokale server, Nederlandse startinstructies en launchers voor Mac, Windows en Linux. Het pakket bevat geen sessies, bron-DOCX-bestanden, hostingconfiguratie of toegangspassen. Partners hebben Node.js nodig; `npm install` of een build is niet nodig. Upload de ZIP naar Drive; partners downloaden en pakken hem volledig uit. De gehoste site behoudt zijn eigen toegangsinstellingen.

## The original five chambers (English)

1. **The Queue of Unfinished Business** — explore the problem before choosing AI.
2. **The Very Confident Library** — useful search, unreliable data and checking sources.
3. **The Gate and the Emergency Buns** — unequal treatment, explanations and real appeals.
4. **Pip and the Extremely Important Pump** — workable oversight, limits and fallback.
5. **The Heart of the Town** — ownership, monitored pilots and changing conditions.

Each chamber has three discoveries, three policy choices, visible consequences, a small repair task and an optional project reflection. Any decision can lead onward after helping the residents. There is no legal-compliance score. The final **Town Charter** exports choices, frozen audience votes, reasoning, benefits, concerns, project notes and next-step commitments as Markdown.

This original adventure is available at `/?story`. Existing sessions and their phone links remain usable. Learning links point to the Dutch Algoritmekader and European Commission. Story decisions are scripted; the game does not send player input to an AI model.

## Development and persistence

- `npm run check`: syntax checks for the game and preserved workshop.
- `npm run build`: browser bundle and Sites-compatible Worker output.
- `npm test`: integration tests; run the build first because hosted-storage tests import the built Worker.
- Dungeon data: `data/golem-sessions.json`; original workshop data: `data/sessions.json`.
- Set `PORT` to change the server port, or `GOLEM_DATA_FILE` to isolate dungeon data.
- Hosted version: D1 persistence with conditional writes so simultaneous votes cannot overwrite each other or a closed decision. Schema is in `db/schema.ts`; migrations are in `drizzle/`.
- Sites access controls apply before people can join a hosted session. An owner-only preview is not yet a publicly shareable audience game. Local network play is available independently of Sites access.

The game combines light exploration and educational choices; the 2.0 mode lets groups choose the topics most relevant to them. The existing workshop remains available at `/workshop.html` on the local server, with its original flows and storage.

---

# Original AI-kader Quest workshop

Een DnD-achtige serious game voor teams van 1 tot 15 ambtenaren die een AI-toepassing willen verkennen langs het Nederlandse AI-kader.

## Starten

```bash
npm start
```

Open daarna:

- `http://localhost:5173/workshop.html` op deze machine
- het lokale netwerkadres dat de server print voor andere deelnemers op hetzelfde netwerk

De eerste deelnemer of degene die "Ik faciliteer deze sessie" aanvinkt krijgt facilitatorrechten. De facilitator opent levels, sluit of opent stemmen, kiest kaarten en rolt AI-kader encounters.

## Spelverloop

1. **Probleem en noodzaak** - sticky notes, stemmen, gekozen probleem en oplossingsroute.
2. **Mens-assistent relatie** - keuze uit tools, chat, agents en copilot, met specifieke rollen uit de PDF-brief.
3. **AI-kader proef** - D20 encounters rond AI Act risico, rechten, data/privacy, transparantie, menselijke regie en lifecycle.
4. **Implementatiepact** - besluit, acties, eigenaar, evaluatiemoment en markdown verslag.

De server bewaart sessies lokaal in `data/sessions.json` zodra een sessie wordt gebruikt. Het verslag is te downloaden via de knop **Download verslag**.

## Bronnen In Het Spel

- Algoritmekader: https://minbzk.github.io/Algoritmekader/
- Digitale Overheid: Algoritmekader: https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmekader/
- EU AI Act: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- Algoritmeregister: https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmeregister/

Bronnen verwerkt op 1 juli 2026. Dit spel vervangt geen juridisch advies.
