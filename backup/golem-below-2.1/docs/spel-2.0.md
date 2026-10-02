# Spel 2.0 — inhoud en spelopzet

De expeditie vertaalt **Spel ideeen 2.0.docx** naar een vrij te verkennen voxelwereld. De zestien aanvullende documenten leveren context en good practices. Conceptnotities, schrijfopdrachten, placeholders en niet-geverifieerde juridische uitspraken uit die documenten zijn geen instructies voor de toepassing en zijn niet letterlijk als spelwaarheid overgenomen.

## Spelverloop

Eén speler loopt vanuit het beginportaal naar een onderwerp. Er zijn vier fundamenten en tien domeinen, zonder verplichte volgorde. Iedere ruimte bevat een herkenbare overheidscasus, drie vindbare informatiebronnen en een vraag met meerdere passende antwoorden. De speelse namen en kleine personages verbinden de informatie met de dungeon.

Bij binnenkomst staan de vraag, antwoordopties en adviesronde direct open. De drie bronnen zijn optioneel: via knoppen naast de vraag of door een object in de kamer te bekijken. Een bron opent in een apart leespaneel en blokkeert de antwoordkeuzes niet. Iedere bron bevat een toelichting, twee praktische aandachtspunten en een casusvoorbeeld, met verwijzing naar het aangeleverde document. Maximaal vijftien deelnemers lezen de casus en alle bronnen zelfstandig op hun telefoon. Zij selecteren meerdere maatregelen; hun advies is aanpasbaar tot de speler beslist. Het scherm toont aantallen per optie en het aantal ontvangen adviezen. De totalen per optie mogen samen groter zijn dan het aantal deelnemers.

De speler kan afwijken van de adviesraad. Daarna wordt per optie toegelicht waarom deze past, ontbreekt, een nuttige aanvulling is of hier niet werkt. Vervolgens kan de speler een projectnotitie bewaren, een ander onderwerp kiezen of dezelfde casus opnieuw bespreken. Eerdere besluiten en stemtotalen blijven in het downloadbare Markdown-logboek staan. De sessie mag na één of meer onderwerpen worden afgerond.

## Verkennen sinds 2.1

Met Spatie springt de speler over lage kisten; met C of de knop Kruip gaat de speler onder lage balken door. Een bewegende rolsteen vormt een vermijdbaar obstakel. Bij een botsing verschijnt de speler weer bij de ingang, zonder verlies van keuzes of stemmen. Alle obstakels zijn ook te omzeilen; kliknavigatie kiest een route eromheen. Verkennen is geen toegangseis voor het beantwoorden.

## Beoordeling

- **Kernmaatregel:** rechtstreeks passend bij de afgebakende vraag.
- **Nuttige aanvulling:** zinvol, maar geen vervanging voor de kernmaatregelen. Selecteren levert geen foutstraf op.
- **Niet passend:** de gekozen aanpak werkt in deze casus niet zoals geformuleerd. De uitleg benoemt de beperking.

Het succesbericht verschijnt wanneer alle kernmaatregelen zijn geselecteerd en geen ongeschikte aanpak is gekozen. De speler hoeft niet te slagen om verder te gaan. Er zijn geen ranglijsten of compliancepercentages. Een casusbespreking levert geen goedkeuring voor werkelijk AI-gebruik op.

Dit onderscheid voorkomt dat logging bij governance of training bij adoptie ten onrechte als slechte praktijk wordt aangeleerd. Vragen zijn waar nodig specifieker gemaakt dan in het voorstel, zodat kernantwoorden en aanvullingen inhoudelijk te onderscheiden zijn.

## Onderwerpen

| Poort | Onderwerp | Casus |
|---|---|---|
| 01 | Governance | Niemand neemt verantwoordelijkheid voor een verkeerd vergunningantwoord. |
| 02 | Cultuur & Adoptie | Een technisch werkende assistent wordt nauwelijks gebruikt. |
| 03 | Kennis & Capaciteit | De leverancier beheert de assistent; interne regie en kennis ontbreken. |
| 04 | Infrastructuur & Data | Opschalen zonder afspraken over gevoelige data en vertrek bij de leverancier. |
| 05 | Evaluatie digitale assistent | Niemand kan aantonen of updates de dienstverlening verbeteren. |
| 06 | Kwaliteit van de output | Oude en nieuwe bronnen leiden tot tegenstrijdige antwoorden. |
| 07 | Mens-assistentinteractie | De inwoner loopt vast en krijgt geen duidelijke menselijke uitweg. |
| 08 | Technische prestaties | Een publiekscampagne veroorzaakt piekbelasting. |
| 09 | Functionaliteit | De assistent zegt dat een afspraak is gewijzigd terwijl de koppeling faalt. |
| 10 | Duurzaamheid | Elke eenvoudige vraag gaat met veel context naar het grootste model. |
| 11 | Digitale soevereiniteit | Overstappen blijkt moeilijk na een tariefverhoging. |
| 12 | Ethiek & Mensenrechten | Sommige formuleringen krijgen slechtere hulp; menselijke controle is een formaliteit. |
| 13 | Compliance | Een pilot met openbare informatie wordt uitgebreid met persoonlijke dossiers. |
| 14 | Beveiliging | Een bijlage bevat verborgen instructies die gegevens proberen te lekken. |

Iedere casus vermeldt het relevante aangeleverde brondocument. De algemene introductie en ‘Kaders rondom het raamframework’ bepalen de context: publieke waarde, passende complexiteit, verschillen tussen proefopzet/pilot/productie en multidisciplinaire afweging. De tien afzonderlijke domeindocumenten zijn gebruikt voor de onderwerpindeling waar de oudere overzichtsteksten verschillen.

## Behouden en uitgebreid

De oorspronkelijke Engelstalige vijfkamerexpeditie blijft bereikbaar via `/?story`, inclusief bestaande sessies. Oude deelnamelinks openen automatisch de bijbehorende spelvorm. De oorspronkelijke Nederlandse workshop blijft lokaal beschikbaar op `/workshop.html`.

De nieuwe spelvorm gebruikt dezelfde lokale opslag en gehoste D1-tabel, met een afzonderlijk sessieformaat. Toegangspassen blijven geheim. De server valideert rollen, meerkeuze-antwoorden en stemrondes; een rondekenmerk weigert te laat ontvangen stemmen, ook na vertrek en terugkeer naar dezelfde kamer. Hosting behoudt de bestaande toegangsinstellingen.

## Inhoud uitbreiden

Casussen staan in `game/topics.json`; `game/topics.cjs` exporteert ze voor server en browser. Elke casus bevat een scenario, vraag, antwoordopties met status en toelichting, drie bronnen, een reflectievraag en een bronverwijzing. Dit is nu één casus per onderwerp. Meer casussen per onderwerp of organisatiespecifieke varianten kunnen een volgende uitbreiding worden.
