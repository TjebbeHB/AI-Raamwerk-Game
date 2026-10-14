# Het Gewelf 3.1 — spelopzet, proeven en dossierregels

## Waarom deze opzet

Versie 3.0 maakte van de veertien raamwerkonderwerpen een afdaling naar één besluit. Versie 3.1 voegt drie dingen toe:

1. **Drie verhalen** (`game/stories.json`). Elk verhaal heeft een eigen organisatie, brief, bewoner, Kamer van de Vraag, casusvarianten voor de veertien kamers, monsters, eindbaas en afloop. De vragen en maatregelen van het raamwerk blijven gelijk; waar een maatregel alleen voor inwoners gold, heeft het verhaal een passende variant (bijvoorbeeld bij Mens-assistentinteractie en Functionaliteit).
2. **Een proef per kamer** (`game/trials.json`). De proef laat de groep het probleem eerst ervaren voordat ze maatregelen kiezen. De bevinding verschijnt bij de casus en in het dossier. Proeven verklappen geen antwoorden, maar maken het knelpunt zichtbaar.
3. **Tussenkamers met gevechten**. Monsters staan voor risico’s uit het raamwerk; elk monster is zwak tegen één gereedschap. Zo oefent de groep welk soort maatregel bij welk risico hoort.

## De proeven

| Type | Kamers | Wat de speler doet |
|---|---|---|
| Getuigen | Kamer van de Vraag, Cultuur & Adoptie, Ethiek | Betrokkenen of stemmen in luisterhoorns aanspreken |
| Sorteren | Governance, Infrastructuur & Data, Duurzaamheid | Voorwerpen naar de juiste tafel, poort of goot brengen; fout terug met uitleg |
| Verzamelen | Kennis & Capaciteit, Digitale soevereiniteit | Rollen of sleutels vinden, ook midden op een brug boven een kloof |
| Beoordelen | Evaluatie, Kwaliteit, Functionaliteit | Per uitspraak kiezen: bewijst het, klopt het, is het betrouwbaar |
| Volgorde | Mens-assistentinteractie, Compliance | Stappen in de goede volgorde zetten; een fout zet alles terug met een hint |
| Hendels | Technische prestaties | Vier keuzes zetten tot de wachtrij weer stroomt |
| Gevecht | Beveiliging | Fluisteraars uit een besmette bijlage tegenhouden met het Zegel |

De regels staan in `client/trials.cjs` en zijn getest. De server bewaart per kamer alleen of de proef is uitgevoerd of overgeslagen; een uitgevoerde proef wordt nooit teruggezet.

## Gevechten

- Drie gereedschappen: **Toetslamp** (toetsen en meten), **Weegschaal** (afwegen, menselijke toets) en **Zegel** (beschermen, begrenzen).
- Monsters: dwaallichten, kobolden, slijmen, schimmen en papiergolems, elk met een naam, een zwakte en een les per verhaal.
- De eindbaas wisselt drie keer van zwakte. De kern op zijn borst toont welk gereedschap nu werkt.
- Monsters vinden hun weg rond pilaren met een stromingsveld. Hooguit twee drukken tegelijk op de speler en ze deinzen terug na een treffer; het vertrouwen herstelt vanzelf als niemand aanvalt.
- Valt het vertrouwen weg, dan brengt Pip de speler terug naar de ingang zonder verlies van voortgang.
- **Rustige modus**: monsters vallen niet aan. Elk gevecht kan ook worden overgeslagen; dat staat in het dossier.
- **Steun van de raad**: adviseurs sturen vanaf hun telefoon steun (hooguit eens per vier seconden per persoon); de speler krijgt vertrouwen terug.

## De Snelle Trap

Glans, de leverancier, biedt in de Ontvangsthal en de Hal der Fundamenten een Snelle Trap aan, direct naar de Zegelkamer. Wie die neemt, slaat alle kamers over. Dat verandert niets aan de regels, maar alle overgeslagen kamers zijn blinde vlekken en het dossier vermeldt de trap.

## Wat het dossier kan dragen

`assess()` in `game/descent.cjs` bepaalt het hoogste besluit dat het dossier onderbouwt. Er is geen percentage; alleen een plafond met redenen.

| Voorwaarde | Gevolg |
|---|---|
| Probleem & Noodzaak niet stevig | maximaal *Eerst verder onderzoeken* |
| Governance niet stevig | maximaal *Eerst verder onderzoeken* (zonder eigenaar geen pilot) |
| Evaluatie digitale assistent niet besproken | maximaal *Eerst verder onderzoeken* (een pilot moet iets meten) |
| Cultuur, Kennis of Infrastructuur niet stevig | maximaal *Begrensde pilot* |
| Een van de drie kritische domeinen van het verhaal niet stevig | maximaal *Begrensde pilot* |
| Minder dan zes domeinen stevig | maximaal *Begrensde pilot* |

Het oordeel na het bezegelen is *het dossier draagt dit besluit*, *voorzichtiger dan nodig*, *verder dan het dossier kan dragen* of, bij stoppen, *onderbouwd* of *legitiem*. Bij elk besluit en oordeel hoort per verhaal een afloop **een jaar later**: bij ‘verder dan het dossier droeg’ loopt het mis, bij een onderbouwd besluit pakt het goed uit.

## Spelregels op de server

Iedere actie vermeldt de huidige kamer (`topic`) en een bezoeknummer (`epoch`); te laat ontvangen stemmen worden geweigerd. Alleen de speler beweegt (`move`), gaat kamers binnen (`enter`), rondt proeven af (`trial`), legt tussenkamers vast (`arena`), neemt de Snelle Trap (`shortcut`), beslist (`decide`) en legt afspraken vast (`commit`). Alleen adviseurs stemmen (`vote`) en sturen steun (`cheer`); in de Zegelkamer kiest iedere adviseur één besluit.

## Inhoud uitbreiden

- Een nieuw verhaal: voeg een object toe aan `game/stories.json` met dezelfde velden als de bestaande drie. De tests controleren of alle onderdelen er zijn.
- Een andere proef: pas `game/trials.json` aan; het type bepaalt de spelregels. Posities en inrichting staan in `client/world/chambers.js`.
- De plaatsing van kamers staat in `client/world/layout.js`.
