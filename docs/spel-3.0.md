# Het Gewelf 3.0 — spelopzet en dossierregels

## Waarom een afdaling

Versie 2.1 liet groepen vrij kiezen uit veertien onderwerpen. Dat leverde goede gesprekken op, maar geen besluit. Versie 3.0 behoudt dezelfde kamers, bronnen en meerkeuzevragen en voegt twee dingen toe:

1. **De Kamer van de Vraag** (`game/descent.json`): vóór alle raamwerkonderwerpen de vraag of AI het probleem wel oplost. Kernmaatregelen: probleem in kaart brengen, vergelijken met oplossingen zonder AI, publieke waarde en succes- en stopcriteria vastleggen.
2. **De Zegelkamer**: een besluit met vier opties, getoetst aan het dossier dat de groep onderweg heeft opgebouwd.

De volgorde van de diepten (vraag → fundamenten → domeinen → besluit) is de leerlijn. Pip wijst steeds de volgende onbesproken kamer aan, maar niets is verplicht en via de Kaart is elke kamer direct bereikbaar.

## Wat het dossier kan dragen

`assess()` in `game/descent.cjs` bepaalt het hoogste besluit dat het dossier onderbouwt. Er is geen percentage; alleen een plafond met redenen.

| Voorwaarde | Gevolg |
|---|---|
| Probleem & Noodzaak niet stevig | maximaal *Eerst verder onderzoeken* |
| Governance niet stevig | maximaal *Eerst verder onderzoeken* (zonder eigenaar geen pilot) |
| Evaluatie digitale assistent niet besproken | maximaal *Eerst verder onderzoeken* (een pilot moet iets meten) |
| Cultuur, Kennis of Infrastructuur niet stevig | maximaal *Begrensde pilot* |
| Ethiek, Compliance of Beveiliging niet stevig | maximaal *Begrensde pilot* |
| Minder dan zes domeinen stevig | maximaal *Begrensde pilot* |

Het oordeel na het bezegelen:

- **Het dossier draagt dit besluit** — gekozen besluit = plafond.
- **Voorzichtiger dan nodig** — lager dan het plafond; verdedigbaar als de groep benoemt wat nodig is om verder te gaan.
- **Verder dan het dossier kan dragen** — hoger dan het plafond; de beperkende redenen worden getoond.
- **Niet met AI** is altijd legitiem: onderbouwd als het plafond laag is, anders met de vraag om vast te leggen waarom.

Het dossier wordt bij het bezegelen bevroren in de sessie. Opnieuw afwegen mag, ook na extra kamers.

## Spelregels op de server

Iedere actie vermeldt de huidige kamer (`topic`) en een bezoeknummer (`epoch`); te laat ontvangen stemmen worden geweigerd. Alleen de speler beweegt (`move`), gaat kamers binnen (`enter`), beslist (`decide`) en legt afspraken vast (`commit`). Alleen adviseurs stemmen (`vote`); in de Zegelkamer kiest iedere adviseur één besluit.

## Inhoud uitbreiden

Raamwerkkamers staan in `game/topics.json`, de Kamer van de Vraag, brief en besluitopties in `game/descent.json`. De plaatsing in de 3D-wereld staat bovenaan `client/dungeon.js` (`FOUNDATIONS`, `DOMAINS`).
