# The Golem Below

A cooperative voxel 3D adventure about thoughtful AI decisions in public services. One player explores on the big screen. Up to 15 audience members join on their phones, read the situation and vote on advice. The player decides whether to follow the council.

## Play the dungeon

Requires Node.js 22.13+ (Node.js 26 recommended for the tests).

```bash
npm install
npm start
```

Open `http://localhost:5173` and select **Begin adventure**. Use **WASD / arrow keys** to walk and **E** to interact, or click characters, objects or the objectives in the quest panel. Sound is optional. The game saves progress after each action.

Select **Invite audience / Council** to show a QR code and audience link. Phones must use the network address printed by the server and share the computer’s Wi-Fi. The invite dialog automatically uses a network address when the player opened localhost. The computer needs to remain running, and its firewall must allow the Node server on port 5173. On devices with several network interfaces, use the printed address for the shared Wi-Fi.

Phones receive a separate text-only council view: story briefing, discovered clues, advisory voting, the player’s decision and its consequences. They never need to see the 3D scene. A session code grants audience membership; a separate device pass grants player control. Passes are kept on the joining device and never included in session views or invite links.

## The five chambers

1. **The Queue of Unfinished Business** — explore the problem before choosing AI.
2. **The Very Confident Library** — useful search, unreliable data and checking sources.
3. **The Gate and the Emergency Buns** — unequal treatment, explanations and real appeals.
4. **Pip and the Extremely Important Pump** — workable oversight, limits and fallback.
5. **The Heart of the Town** — ownership, monitored pilots and changing conditions.

Each chamber has three discoveries, three policy choices, visible consequences, a small repair task and an optional project reflection. Any decision can lead onward after helping the residents. There is no legal-compliance score. The final **Town Charter** exports choices, frozen audience votes, reasoning, benefits, concerns, project notes and next-step commitments as Markdown.

The initial adventure is in English. Learning links point to the Dutch Algoritmekader and European Commission. Story decisions are scripted; the game does not send player input to an AI model.

## Development and persistence

- `npm run check`: syntax checks for the game and preserved workshop.
- `npm run build`: browser bundle and Sites-compatible Worker output.
- `npm test`: integration tests; run the build first because hosted-storage tests import the built Worker.
- Dungeon data: `data/golem-sessions.json`; original workshop data: `data/sessions.json`.
- Set `PORT` to change the server port, or `GOLEM_DATA_FILE` to isolate dungeon data.
- Hosted version: D1 persistence with conditional writes so simultaneous votes cannot overwrite each other or a closed decision. Schema is in `db/schema.ts`; migrations are in `drizzle/`.
- Sites access controls apply before people can join a hosted session. An owner-only preview is not yet a publicly shareable audience game. Local network play is available independently of Sites access.

This is a first playable five-room adventure, with light exploration and decision puzzles rather than combat. The existing workshop remains available at `/workshop.html` on the local server, with its original flows and storage.

---

# Original AI-kader Quest workshop

Een DnD-achtige serious game voor teams van 1 tot 15 ambtenaren die een AI-toepassing willen verkennen langs het Nederlandse AI-kader.

## Starten

```bash
npm start
```

Open daarna:

- `http://localhost:5173` op deze machine
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
