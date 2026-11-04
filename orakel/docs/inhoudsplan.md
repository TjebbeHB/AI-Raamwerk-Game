# Inhoudsplan · Het Orakel van Dalwijk

Dit plan beschrijft per diepte de keuzes die ertoe doen, de opties per archetype, de geheimen en grappen, de Kantoorvondsten, de vergaderbingo, de nieuwe personages en de lopende grappen. Diepte 0 is af en dient als voorbeeld. Diepte 1 en 2 bouwt de ene lane, Diepte 3 en 4 de andere; elk raakt alleen de eigen bestanden in `src/content/story/` en `src/content/floors/`.

Alles wat in dit plan een id heeft, bestaat al in de registers: geheimen, vondsten, bingovakjes, prestaties en cosmetica in `src/content/items.js`, nieuwe personages en aliassen in `src/content/cast_extra.js`. Er komen **geen nieuwe personages of registerregels** bij; een lane plaatst wat er staat.

## Spelregels voor het schrijven

- **Keuzes doen ertoe, maar blokkeren nooit.** Elke uitkomst van het dossier blijft bereikbaar, elke keuze kan later bijgesteld worden (bij `choice()` wint de laatste), en niemand weigert de hoofdopdracht omdat je onaardig was.
- **Warm en grappig, nooit gemeen.** Ambtenarij-humor die je herkent, zonder echte personen, bedrijven, merken of partijen. Geen em-streepjes: gebruik komma's, dubbele punten, ‘ · ’ of een nieuwe zin.
- **Je-vorm** tegen de speler, behalve bij wie dat bewust anders doet: Glans zegt ‘u’ en noemt je altijd `formal()` (‘mevrouw de adviseur’, ‘meneer de adviseur’ of ‘beste adviseur’). Mevrouw Bakker zegt ‘u’ en ‘lief kind’.
- **Stemmingen**: geef elke nieuwe regel een mood, zodat de portretten meebewegen: `say(c, tekst, {mood: 'happy'})`. Moods: `neutral`, `happy`, `laugh`, `sad`, `angry`, `surprised`, `worried`, `smug`, `thinking`, `tired`.
- **Meldingen met mate**: een relatie die echt verschuift krijgt de melding ‘X zal dit onthouden.’; kleine aardigheden gaan `{silent: true}`.

## Gereedschap (src/content/story/systems.js)

| Wat | Hoe |
|---|---|
| Relatie | `rel('joop', 1)` toont ‘Joop zal dit onthouden.’ met het gezicht van Joop. `rel(id, n, {text: 'Glans zet dit in zijn klantsysteem.'})` voor een eigen zin, `{silent: true}` zonder melding. `relOf(id)` leest de score. Aliassen (`bakker3`, `glans4`) tellen mee bij de hoofdpersoon. |
| Keuze | `choice('ilse_brief', {npc: 'ilse', label: 'De afvalpasbrief', text: 'Je besloot…', pick: 'zelf'})`. Eén regel per id, de laatste wint; de samenvatting en de epiloog lezen ze. `chose('ilse_brief')` geeft de pick, `chose('ilse_brief', 'zelf')` een ja of nee. |
| Archetype-optie | `archOpt('verbinder', 'Hoe gaat het eigenlijk met jóú?', voorwaarde)` in een `choose([...])`. De optie toont ‘[Verbinder] …’ en alleen aan dat archetype. |
| Geheim | Op de kaart: `secret: '<id>'` in de legenda van één entiteit (bord, object, persoon, item, kist, nepmuur, hendel, koffieautomaat). Lezen, gebruiken, pakken of onthullen vindt het geheim. In een verhaalbestand: `findSecret('<id>')`, letterlijk, precies één keer. |
| Vondst, bingo | Op de kaart: `{kind: 'vondst', give: 'trinket:<id>'}` (een vondst op een krukje), `{kind: 'bingo', give: 'bingo:<id>'}` (een geel briefje aan de muur, `wall: false` voor een ezel), of een whiteboard met `give`. In een gesprek: `giveItem('trinket:<id>')` of `giveItem('bingo:<id>')`, letterlijk, precies één keer. |
| Iets om naar te kijken | `{kind: 'ding', shape: 'duck', label, title, text, secret}`: een klein ding op een krukje (`stand: false` zonder krukje) dat een grap vertelt. Vormen: `duck`, `clock`, `book`, `mug`, `stamp`, `ball`, `card`, `stapler`, `rod`, `flashlight`, `agenda`, `postits`, `ticket`. |
| Inlopen | `{kind: 'geheim', secret: '<id>', r: 1.6}`: onzichtbaar; wie er binnen `r` meter komt, vindt het geheim. |
| Prestatie, cosmetica | `award('<id>')`, `unlock('<id>')`. Beide zijn veilig om vaker aan te roepen. De meeste volgen vanzelf uit de toestand (zie onder); roep ze in een gesprek aan als de melding precies dan moet komen. |
| Na het gesprek | `whenFree(fn)`: iets doen zodra de speler weer vrij is (geen gesprek, geen venster). |
| Naam en vorm | `heroName('fallback')`, `formal()` (‘mevrouw de adviseur’), `aanspreek()`, `pron().subj/obj/poss` (hij/zij/die), `isArch('archivaris')`. Bij een lege naam moet de zin ook kloppen. |

**Strenge controle per diepte.** `test/content.test.mjs` telt waar elk geheim, elke vondst en elk bingovakje ligt. Voor een diepte met `strictFinds: true` in het eigen plattegrondbestand moet alles van die diepte precies één keer geplaatst zijn, op de goede diepte. Zet die vlag aan in `floors/fN.js` zodra je diepte af is. Zolang hij uit staat, meldt de test wat er nog openstaat.

**Wat vanzelf gaat.** Elke twee seconden (alleen als je rondloopt) kijkt het systeem of er iets verdiend is: alle geheimen, de opa-tekens, de bingo, alle kaartjes, alle hallucinaties, alle bronnen, alle koffieautomaten, Joop op 4 of hoger, negen brugsleutels, de belofte aan mevrouw Bakker (`stage('bakker') >= 2` en een belofte), de overdracht van Henk (`henk_overdracht` is `samen` of `opschrijven`) en Glans die meevecht (`G.flags.glans_hielp`). Aan het eind volgen nog `geen_lift`, `geen_koffie`, `pacifist`, `dossier` en `samen`.

**De epiloog.** `systems.js` schrijft wat er van iedereen geworden is (de functie `epilogueLines()`), en plakt dat achter wat `ON.epilogueExtra` in `story/f4.js` teruggeeft. Laat in f4.js alleen regels over de wereld staan (de ingelijste hallucinaties, het dossier); oude regels over Ilse, mevrouw Bakker, Glans, Joop en Pip worden er door de systemen uitgefilterd. Welke vlaggen en keuzes de epiloog leest, staat per persoon hieronder.

## Lopende grappen

- **‘Mijn opa zei altijd…’** Joop citeert zijn opa (ook Joop; ‘iedereen in onze familie heet Joop, behalve tante Joke’). Opa Joop was in 1948 conciërge van het Gewelf, metselde de trap en maakte de zegeltafel. Op elke diepte liet hij een teken achter (geheimen `opa_d1` tot en met `opa_d4`), elk met een wijsheid. Alle vier: prestatie `opa`, en Joop zegt er in de Zegelkamer iets over.
- **De visitekaartjes van Glans.** Acht stuks, plus een negende dat hij nooit uitdeelt (geheim `negende_kaartje`, Diepte 4).
- **Wachtnummers.** De nummerautomaat telt steeds harder door tot 999 (`nummer999`). Meneer Kok is nummer 388, de balie is bij 214. Later kan iemand naar je nummer vragen: ‘U bent toch 999? Dan bent u de laatste.’
- **De printer die het doet.** In Reprografie werkt hij, één keer, per archetype op een eigen manier. Daarna zegt iedereen die erover hoort ‘Hij dóét het?’. Dirk heeft er een ticket voor, prioriteit ‘wonder’, en durft hem niet te sluiten. Wie een printer tegenkomt in het Gewelf (bijvoorbeeld in Bijna Waar of de Postkamer): ‘PAPIERSTORING IN LADE 2’.
- **De eend-burgemeester** (hallucinatie #3: ‘drie burgemeesters, waarvan één een eend’). Het portret ‘Burgemeester, 1979 (?)’ in de publiekshal, de rubberen eend in de gevonden voorwerpen, de badeend in de Lekkende Kelder (`badeend`), de pootafdruk in het Grote Boek der Burgemeesters (`burgemeestersboek`), en zodra je hallucinatie #3 hebt, staat er een eend met ambtsketen in de entree van het stadhuis (`eend`). Glans: ‘Het Orakel zegt dat ik een eend ben.’
- **Panfluit.** De wachtmuziek van het klantcontactcentrum. Mevrouw Bakker kan hem meefluiten, de Snelle Lift speelt hem (`liftmuziek`).
- **‘Ik begrijp u.’** De balie van Noor, het Orakel, de Fabulant. Wie het grappig wil laten terugkomen: ‘Ik begrijp u. Grapje.’
- **‘Met betrekking tot.’** De afvalpasbrief en Communicatie.
- **Welkom01.** Iedereen zijn wachtwoord, volgens Dirk.
- **Stroopwafels en brood.** Joop geeft een stroopwafel, meneer Kok heeft altijd een brood te veel.

## De bogen

### Joop (de conciërge die je onthoudt)
- **D0**: je vraagt de kelderdeursleutel. Hoe je dat doet telt (luisteren +1, ongeduld −1, per archetype een eigen opening). Je belooft wel of niet zijn sleutelbos terug te brengen (`joop_sleutelbos`: `belofte` of `ogen`). Zijn leesbril ligt bij meneer De Wit; breng je hem terug, dan krijg je de sleutel van het magazijn. Vijf opa-wijsheden geven het geheim `opa`.
- **D1**: in de oude archiefkamer ligt het archiefboek van 1998, ondertekend ‘J. (conciërge)’. Pip: ‘J.… Dat is Joop! Hij heeft in ’98 die computer uitgezet.’ (Glans zei in D0: ‘Uitgezet, denk ik. Door een conciërge.’)
- **D2**: de sleutelbos (bestaat al). Pip, bij het oppakken, als je het beloofd had: ‘Je had het Joop beloofd, toch? Dan moet hij terug.’
- **D4, Zegelkamer (`joop4`)**: heb je de sleutelbos nog en is hij nog niet terug (`G.items.sleutelbos && !G.flags.joop_bos`): Joop krijgt hem hier terug, met dezelfde afloop als in D0 (`G.flags.joop_bos = true`, `choice('joop_sleutelbos', {…, pick: 'teruggebracht'})`, `rel('joop', 2)`). Bij `relOf('joop') >= 4`: hij geeft je zijn pet (‘Ik heb er thuis nog zeven.’) en vertelt dat zijn opa de zegeltafel maakte. Heb je alle vier de opa-tekens: ‘Je hebt ze allemaal gevonden? Dan weet je meer van mijn opa dan ik.’
- **Epiloog** leest: `joop_sleutelbos` (`teruggebracht`, `belofte`), `stage('sleutelbos') >= 2`, `relOf('joop')`.

### Glans (hoe je hem behandelt, beslist hoe het afloopt)
- **D0**: eerste ontmoeting, de bingo ‘Even sparren’, en `glans_houding`: `serieus` (+1), `spot` (−1, ‘Glans zet dit in zijn klantsysteem.’), `cijfers`, `contract` (Handhaver leest artikel zeven: alles is van PraatPal, ‘ook, technisch gezien, de kelder’, `G.flags.glans_artikel7`), `mens` (Verbinder, +2: hij is vrijdag zijn auto kwijt als Dalwijk niet tekent).
- **D1 (`glans1`, in zijn eigen demo)**: na het bevrijden een keuze: ‘Graag gedaan, Glans.’ (+1) · ‘Volgende keer neem ik de trap.’ (0) · Handhaver (als `glans_artikel7`): ‘Eerst wil ik weten hoe het zit met artikel zeven.’ · Verbinder: ‘Zat je hier lang? Je ziet bleek.’ (+2). Bij `glans_houding` is `spot`: ‘U bent die van de garantiegrap.’
- **D2 (`glans2`)** en **D3 (`glans3`)**: bij `relOf('glans') >= 2` vertrouwt hij je meer toe (D3: ‘Ik ben bang dat het Orakel gelijk heeft. Over mij. Dat ik er een ben die alleen maar antwoordt.’). D3-keuze `glans_kern`: ‘Ga niet alleen de Kern in.’ (+1) of ‘Het is jouw product. Ga maar.’ (−1).
- **D4, de cocon**: bij het bevrijden beslist de relatie. `relOf('glans') >= 2`: `G.flags.glans_hielp = true`, `choice('glans_eind', {npc: 'glans', label: 'Glans en de Fabulant', text: 'Glans vocht met je mee tegen de Fabulant.', pick: 'hielp'})`; in fase 2 van het gevecht gooit hij zijn gouden map naar een van de twee kopieën (die kopie verdwijnt: ‘Artikel zeven! Die is van mij!’), en in fase 3 roept hij welke aansluiting het eerst dicht moet. Lager dan 2: één laatste pitch (‘Nu u toch hier bent: PraatPal Premium? Met grenzen! Optioneel.’), `pick: 'pitch'`, en hij blijft bij de cocon staan.
- **D4, Zegelkamer (`glans5`)**: heb je alle acht kaartjes en `relOf('glans') >= 2`, dan geeft hij het negende: ‘Glans · mens’ (`findSecret('negende_kaartje')`, in f4.js).
- **Epiloog** leest: `G.flags.glans_hielp`, `G.flags.glans_vrij`, `relOf('glans')`, `G.stats.shortcut`.

### Mevrouw Bakker (een belofte, gehouden of gebroken)
- **D0**: zij vraagt of je een balie vindt waar een mens zit. `bakker_belofte`: `belofte`, `eerlijk` (je belooft niets), of `stellig` (Handhaver: ‘Vrijdag heeft u een mens aan de lijn.’). De Verbinder hoort waarom: haar kleinkinderen komen op zondag met de auto (`G.flags.bakker_kleinkinderen`). De Archivaris weet dat haar vergunning onder de regeling van 2009 valt (`G.flags.bakker_2009`).
- **D1 (`bakker1`)**: ze verwijst naar wat je zei: bij een belofte ‘U had het beloofd. Ik ben vast zelf gaan kijken.’, bij eerlijk ‘U zei eerlijk dat u niets kon beloven. Dus ben ik zelf gaan zoeken.’
- **D3 (`bakker3`, de Balie van de Tweede Kans)**: wordt ze geholpen (`helpBakker`, bestaat al): bij een belofte ‘U had het beloofd. En u bent gekomen.’ (de prestatie `belofte` en de paraplu volgen vanzelf). Bij `bakker_2009`: Noor bevestigt dat de regeling van 2009 geldt.
- **D4 (`bakker4`)**: gehouden: ze leest voor uit haar agenda (‘Vrijdag: een mens. Afgevinkt.’). Gebroken (belofte, maar `stage('bakker') < 2`): ‘U had het beloofd.’ Zonder verwijt, met een zucht.
- **Epiloog** leest: `bakker_belofte`, `stage('bakker')`, `G.flags.bakker_kleinkinderen`.

### Ilse en de afvalpasbrief (zelf, het Orakel, of de inwoners)
- **D0**: `ilse_brief`: `zelf` (Ilse stuurt je naar Ingrid van Communicatie; haar zegen geeft de prestatie `begrijpelijk`, en werkt de printer, dan print hij je nieuwe brief: `G.flags.brief_geprint`), `orakel` (Ilse −1, ‘ik lees hem wel na’), `inwoners` (Ilse +2; vraag twee van de vier: meneer Kok, Sanne, meneer De Wit, mevrouw Bakker; terug bij Ilse: `G.flags.brief_inwoners_klaar` en `begrijpelijk`).
- **D1 (`ilse1`, het klachtenarchief)**: haar gesprek hangt af van `chose('ilse_brief')`:
  - `zelf` met `brief_geprint`: ‘Je hebt hem al geprint? Op één A4?’ Ze legt hem naast de oude. Rel +1.
  - `orakel`: ze laat de versie van het Orakel zien: ‘U kunt uw afvalpas ophalen bij het loket op de maan.’ Keuze: ‘Dan schrijven we hem toch samen met de inwoners.’ (`choice('ilse_brief', {…, pick: 'inwoners'})`, rel +1) of ‘Het Orakel leert vast nog.’ (rel −1).
  - `inwoners`: ze heeft de opmerkingen bij zich: ‘Zeg gewoon container.’
  - nog niets gekozen: bied hier dezelfde drie opties als in D0 (zelfde ids), zodat iedereen de keuze krijgt.
- **D4 (`ilse4`)**: één zin per uitkomst (zelf: ‘Hij is ingelijst.’; inwoners: ‘Meneer Kok wil hem op een tegeltje.’; orakel: ‘Versie twee is goed. Versie één verwijst nog steeds naar de maan.’).
- **Epiloog** leest: `ilse_brief`, `G.flags['heard:necessity:1']`, `relOf('ilse')`.

### Henk (kennisoverdracht voor zijn vakantie)
- **D2 (`henk`)**: `henk_overdracht`: ‘Kun je het opschrijven voordat je gaat?’ → `opschrijven` (geeft `rol:3`, bestaat al) · nieuw: ‘Zullen we het samen doen? Jij vertelt, ik schrijf.’ → `samen` (geeft `rol:3` en `giveItem('trinket:mok')`, rel +2, ‘Zo leuk heb ik het nog nooit gehad. Over incidenten.’) · ‘Fijne vakantie!’ → `niet` (hij gaat nog niet weg; je kunt terugkomen, de laatste keuze wint). Verbinder-optie: ‘Heb jij eigenlijk zin in die vakantie, Henk?’ (‘Ik ben bang dat ik op Texel aan incidenten denk.’). Datatovenaar: ‘Hoeveel incidenten waren het vorig jaar?’ (‘Veertien. Dertien waren de knop.’).
- In zijn bureaula: geheim `henks_la`.
- **Epiloog** leest: `henk_overdracht`. Prestatie `overdracht` en het vakantieoverhemd volgen vanzelf.

### Wouter (de brugwachter)
- **D3 (`wouter`)**: negen sleutels in plaats van zeven: hij zegt er iets over, het hesje (`wouter_hesje`) volgt vanzelf. Verbinder: ‘Hoe lang sta je hier al, Wouter?’ (‘Elf jaar. Er kwam nooit iemand met sleutels.’, rel +2). Onder de sleutelpaal: `opa_d3`, ‘Een brug waar je niet af kunt, is een val.’ Wouter: ‘Dat heb ik van opa Joop. Hij bouwde de eerste brug.’
- **Epiloog** leest: het aantal `brug_`-sleutels, `G.flags.bridge_built`, `relOf('wouter')`.

### Vrouwe Waarom
- **D1 (`waarom`)**: na de eerste ontmoeting komt er een optie ‘Waarom?’ bij. Elke keer gaat ze een laag dieper (‘Omdat inwoners wachten.’ · ‘Omdat een brief onduidelijk is.’ · ‘Omdat niemand eigenaar is.’ · ‘Omdat iedereen dacht dat een ander het deed.’ · ‘Omdat… je stelt goede vragen.’). De vijfde keer: `findSecret('vijf_waaroms')`, de mantel volgt vanzelf. Archivaris: ‘De archivarissen van 1648 schreven: vraag eerst waarom.’ (rel +1). Een stevige afweging bij haar: rel +2.
- **Epiloog** leest: het geheim `vijf_waaroms`.

### De Fabulant (wat je onderweg verzamelt, gooi je terug)
- **D4, vlak voor het gevecht (`t_kern`)**: Pip: ‘Laat hem zien wat je verzameld hebt!’ Voor elke gevonden hallucinatie (maximaal zes in beeld) zeg je de regel uit `HALLUCS[i].retort` (`items.js`) en reageert de Fabulant (‘Dat… was een uitzondering.’). Gevolg, op de vijand die `spawnEnemy` teruggeeft:
  - `n = G.hallucs.length`; schild: `e.scrollsMax = Math.max(2, e.scrollsMax - Math.floor(n / 2))`, daarna `e.model.parts.scrolls.forEach((s, i) => { s.visible = i < e.scrollsMax; })`;
  - leven: `e.hp = e.maxHp = e.maxHp * (1 - Math.min(0.36, n * 0.03))`;
  - bij `n >= 8`: in fase 2 één kopie minder (een `ON.tick` die, zodra `e.phase === 2`, één levende kopie uitschakelt met een regel van Pip: ‘Die kopie ken ik. Hallucinatie nummer drie.’).
  - Nul hallucinaties: Pip: ‘We hebben niks om hem mee te confronteren. Dan maar toetsen, wegen en begrenzen.’ Het gevecht blijft altijd te winnen.
- **De laatste woorden** van de Fabulant: ‘Kunnen we dit… offline bespreken?’ en `giveItem('bingo:offline')`.

## Diepte 0 · Het stadhuis (af)

**Kaart** (`floors/f0.js`): nieuw zijn Reprografie (de printer en Dirk), Vergaderkamer De Horizon (het whiteboard en de agenda), het magazijn van Facilitaire Zaken (achter de deur zonder bordje in de conciërgekamer, sleutel `key:magazijn`), Communicatie (Ingrid, de B1-poster, de Schrijfwijzer), de kantine (koelkast, snoepautomaat, prikbord, een tweede koffieautomaat), de brievenbus van de wethouder, de burgemeestersgalerij en de eend in de entree.

**Keuzes met gevolgen**

| id | wie | opties (pick) | gevolg |
|---|---|---|---|
| `joop_sleutelbos` | Joop | `belofte` · `ogen` · later `teruggebracht` | D2 Pip herinnert je eraan; D0 of D4 terugbrengen; epiloog |
| `ilse_brief` | Ilse | `zelf` · `orakel` · `inwoners` | Ingrid, de printer, D1 Ilse, D4 Ilse, epiloog |
| `bakker_belofte` | Mevrouw Bakker | `belofte` · `eerlijk` · `stellig` | D1 en D3 Bakker, prestatie `belofte`, paraplu, epiloog |
| `glans_houding` | Glans | `serieus` · `spot` · `cijfers` · `contract` · `mens` | relatie met Glans, D1 reactie, D4 helpen of pitchen |
| `kok` | Meneer Kok | `brood` (je brengt zijn brood naar Ilse) · `balie` (Archivaris: aparte balie, hij loopt weg) | het derde brood (snack), epiloog |
| `sanne_stempel` | Sanne | `zoeken` · `gebracht` | prestatie `stempel`, epiloog |
| `dewit_hond` | Meneer De Wit | `hond` · `eerst` · `kat` | epiloog (‘Hij heet Paspoort.’) |
| `printer` | Dirk | `geduld` · `klap` · `foutlog` · `handleiding` · `gesprek` | geheim `printer`, koffiebon, het naambordje met je naam |

**Archetypes**: Joop (Handhaver kordaat; Datatovenaar hoort hoe vaak de deur open was; Archivaris kent het sleutelregister en krijgt meteen de magazijnsleutel; Verbinder hoort dat Joop over drie maanden met pensioen gaat), Mevrouw Bakker (zie haar boog), Ilse (Datatovenaar: de turflijst; Verbinder: hoe ze het volhoudt), Ingrid (alle vier), Glans (alle vier), Sanne (Handhaver wil zelf stempelen; Datatovenaar ontdekt de groepsapp ‘Stempelgate’), meneer De Wit (Archivaris: het hondenregister), meneer Kok (Archivaris), Dirk (Datatovenaar, Verbinder), de printer (elk archetype krijgt hem op een eigen manier aan de praat) en de snoepautomaat (Handhaver, Archivaris).

**Naam en aanspreekvorm**: de brief (‘Aan Sam, adviseur Dienstverlening’, ‘Beste Sam,’), het papiertje op je deur in de opening, Joop (‘Jij bent Sam, toch?’), Ilse (‘Welkom, Sam.’), Dirk (‘Je wachtwoord is Welkom01.’), het naambordje uit de printer, Glans (`formal()`), Ilse over jou tegen meneer Kok (`pron()`), en Pip in de epiloog.

**Geheimen**: `printer` (Reprografie), `magazijn` (inlopen), `nummer999` (de nummerautomaat), `opa` (vijf wijsheden van Joop), `wethouderspost` (de brievenbus), `yoghurt` (de koelkast in de kantine), `eend` (de entree, na hallucinatie #3).
**Kantoorvondsten**: `nietmachine` (magazijn), `koffiebon` (Dirk, als de printer het doet).
**Bingo**: `stip` (het whiteboard in De Horizon), `sparren` (Glans).
**Nieuwe personages**: `ingrid` (Communicatie), `dirk` (ICT), `eend` (de burgemeester?).
**Grappen zonder geheim**: de B1-poster op C2-niveau, de Schrijfwijzer (pagina 1: ‘Schrijf kort.’, 212 pagina’s), het bord van Reprografie, de agenda ‘Visie op de visie’, het prikbord (de printer in 2016, de gouden nietmachine), de gevonden voorwerpen, de burgemeestersgalerij, de snoepautomaat.

## Diepte 1 · De Kelder der Beloften (lane Diepte 1 en 2)

**Keuzes met gevolgen**
- **Pip** bij de lamp (bestaat): neem de bestaande keuze op als relatie (‘Klopt. Wie ben jij?’ `rel('pip', 1, {silent: true})`). Verbinder: ‘Tweehonderd jaar alleen in het donker. Gaat het wel?’ (rel +2, ‘Pip zal dit onthouden.’). Datatovenaar: ‘Hoeveel lumen ben jij eigenlijk?’ (‘Genoeg om een leugen te zien. Ongeveer drie.’). De epiloog leest `relOf('pip')`.
- **Mevrouw Bakker, Ilse, Glans, Vrouwe Waarom**: zie de bogen hierboven.
- **Daan** (`daan`, nieuw): de stagiair die sinds de reorganisatie van 2017 de afdeling Innovatie zoekt. Opties: ‘Kom maar mee naar boven.’ (‘Boven? Daar is het licht. Daar ben ik niet op gekleed.’) · Archivaris: ‘Volgens het organogram van 2017 zit Innovatie… hier. Je zit er al die tijd in.’ (rel +2) · Verbinder: ‘Heeft iemand je eigenlijk ooit gemist?’ (‘Mijn moeder. En de koffieautomaat, denk ik.’). Hij geeft het bingovakje ‘Parkeerlijst’: ‘Al mijn ideeën staan op de parkeerlijst. Hij is nu vierhonderd meter.’ (`giveItem('bingo:parkeerlijst')`).

**Geheimen**
- `opa_d1`: een steen (`M`, kind `stone`, `secret: 'opa_d1'`) onderaan de trap in de Trappenkelder, bij `up_f0`. Tekst: ‘J. 1948. Elke trap begint met de eerste tree. Opa.’
- `stagiair`: Daan (`N`, `{id: 'daan', secret: 'stagiair'}`) in een nis achter een nepmuur (`S`) aan de oostkant van de wijnkelder of het klachtenarchief.
- `oudste_klacht`: een la of boek in het klachtenarchief (`secret: 'oudste_klacht'`): ‘Klacht nummer 1, 1652: er zit een geest in de lantaarn. Hij is eigenwijs.’ Pip, via `ON.use`: ‘Laster. Dat is laster.’
- `pips_naam`: een plaatje op de sokkel van de lantaarn in de Lampenkamer (`secret: 'pips_naam'`, leesbaar na het oppakken van de lamp, `if: 'tool:lamp'`): ‘Lantaarn nr. 1 · Petrus Ignatius Pompeius’.
- `vijf_waaroms`: Vrouwe Waarom (in f1.js).

**Kantoorvondsten**
- `wichelroede`: `{kind: 'vondst', give: 'trinket:wichelroede'}` in een donkere hoek van de Trappenkelder of achter de vaten in de wijnkelder. Met de wichelroede voel je geheimen tot 8 meter; de Archivaris voelt ze al.
- `bhvlamp`: in de geheime nis ten oosten van de Lampenkamer (bij `halluc:1`, rond tegel 32,27).

**Bingo**
- `laaghangend`: `{kind: 'bingo', give: 'bingo:laaghangend'}` in de wijnkelder, op kniehoogte (een tros plastic druiven aan een spijker).
- `parkeerlijst`: Daan (in f1.js).

**Overig**: in de oude archiefkamer ontdekt Pip dat ‘J. (conciërge)’ Joop is (zie de boog van Joop).

## Diepte 2 · De Hal der Fundamenten (lane Diepte 1 en 2)

**Keuzes met gevolgen**
- **Henk**: zie zijn boog (`henk_overdracht`, de mok).
- **Kim** (`kim`, nieuw, ‘kwartiermaker, sinds 2019’): staat in de Wachtkamer van Doorverwijzing. ‘Ik maak kwartier voor het programma dat het project voorbereidt.’ Ze geeft het bingovakje (`giveItem('bingo:kwartiermaker')`). `kim_besluit`: ‘Neem vandaag één besluit. Eén maar.’ → `besluit` (rel +2: ‘Een besluit. Ik… stop met kwartier maken. Dat is mijn besluit.’) · ‘Succes met het kwartier.’ → `kwartier`. Handhaver: ‘Wie is eigenaar van jouw programma?’ (‘Het programma zelf. Dat is het probleem, hè?’). Datatovenaar: ‘Hoeveel kwartieren heb je al gemaakt?’ (‘Achtentwintig. Eén per kwartaal.’). De epiloog leest `kim_besluit`.
- **Glans** (`glans2`), **Griffel**, **Vonk**, **Mallow**: archetype-opties waar ze passen. Vonk: het derde koekje is het laatste (`findSecret('koekjes')`, in f2.js).
- **De sleutelbos**: bij het oppakken een regel van Pip als `chose('joop_sleutelbos', 'belofte')`.

**Geheimen**
- `opa_d2`: een steen tegen een pilaar in de Hal (`secret: 'opa_d2'`): ‘J. 1948. Wie goed fundeert, hoeft zich niet te haasten. Opa.’
- `liftmuziek`: `ON.use.glanslift2`, de derde keer: panfluit, `findSecret('liftmuziek')` (in f2.js).
- `henks_la`: een la in de Werkplaats, bij Henk (`secret: 'henks_la'`).
- `koekjes`: Vonk (in f2.js).
- `badeend`: `{kind: 'ding', shape: 'duck', secret: 'badeend', stand: false}` in het water van de Lekkende Kelder.

**Kantoorvondsten**
- `agenda`: op de lege voorzittersstoel in de Raadzaal van Niemand (`{kind: 'vondst', give: 'trinket:agenda'}`).
- `mok`: Henk, bij `samen` (in f2.js).

**Bingo**
- `draagvlak`: een poster in het Huis van de Aarzelende Vonken (`{kind: 'bingo', give: 'bingo:draagvlak'}`): ‘Draagvlak peilen? Vul de enquête over de enquête in!’
- `kwartiermaker`: Kim (in f2.js).

## Diepte 3 · De Galerij der Domeinen (lane Diepte 3 en 4)

**Keuzes met gevolgen**
- **Mevrouw Bakker** (`bakker3`), **Wouter**, **Glans** (`glans3`, `glans_kern`): zie de bogen.
- **Otto**: ‘Hoe-hoe. We moeten dit integraal bekijken.’ en `giveItem('bingo:integraal')`.
- **Bram**: na de proef de optie ‘Kun je tot tien tellen en dan stoppen?’ Hij doet het, en moet er een beetje van huilen (`findSecret('tien_tellen')`).
- **Noor**: een optie ‘Druk op de bel van de balie.’ die je kunt herhalen; de tiende keer: ‘Ik begrijp u. Grapje. Waarmee kan ik u helpen?’ (`findSecret('tweede_kans')`).
- **Archetypes** per hoeder: de Handhaver dringt aan (‘Wie tekent hiervoor?’), de Datatovenaar vraagt de cijfers, de Archivaris kent de oude procedure, de Verbinder vraagt hoe het met de hoeder zelf gaat. Eén optie per hoeder is genoeg.

**Geheimen**
- `opa_d3`: een steen onder de sleutelpaal op het Liftbordes (`secret: 'opa_d3'`).
- `burgemeestersboek`: een boek (`M`, kind `book`) in de Bibliotheek van Bijna Waar (`secret: 'burgemeestersboek'`): een pootafdruk, met zwemvliezen.
- `vijfde_wekker`: `{kind: 'ding', shape: 'clock', secret: 'vijfde_wekker'}` in het Afsprakenatelier, of in een gesprek met Kees.
- `tien_tellen` (Bram) en `tweede_kans` (Noor): in f3.js.

**Kantoorvondsten**
- `vandale`: in de Bibliotheek van Bijna Waar (`{kind: 'vondst', give: 'trinket:vandale'}`).
- `postits`: in het Afsprakenatelier.

**Bingo**
- `proeftuin`: in De Proeftuin van Morgen (`{kind: 'bingo', give: 'bingo:proeftuin'}`): een zakje zaad, ‘zaaien in Q1, oogsten in Q7’.
- `integraal`: Otto (in f3.js).

## Diepte 4 · De Kern (lane Diepte 3 en 4)

**Keuzes met gevolgen**
- **Glans in de cocon**: helpen of pitchen (`glans_eind`, `G.flags.glans_hielp`), zie zijn boog.
- **De Fabulant**: het bewijs van de hallucinaties, de laatste woorden en `bingo:offline`, zie zijn boog.
- **Het Orakel** (na het gevecht): een optie ‘Vertel eens een mop.’ (`findSecret('orakel_mop')`).
- **De Zegelkamer**: `joop4` (sleutelbos en pet), `bakker4` (de belofte), `ilse4` (de brief), `glans5` (het negende kaartje), de wethouder (‘Dank je, Sam.’, met `heroName()`). Wie wil: `kok4`, `sanne4`, `dewit4` als aliassen van de inwoners, met een zin over hun afloop; `eend4` als `G.secrets.includes('eend')` (‘De burgemeester is er ook. Denkt Pip.’).

**Geheimen**
- `opa_d4`: een bordje bij de zegeltafel (`secret: 'opa_d4'`): ‘Gemaakt door J., 1948, voor wie later komt. Gebruik met verstand. Opa.’
- `echo`: een plek aan de rand van de Drempel (`{kind: 'ding', label: 'Roep iets in de afgrond', secret: 'echo'}` met `ON.use.echo`: ‘Hallo?’ ‘Uw vraag is belangrijk voor ons.’).
- `orakel_mop` en `negende_kaartje`: in f4.js.

**Kantoorvondsten**
- `stressbal`: op een platform van de Drempel of in de Cocon (`{kind: 'vondst', give: 'trinket:stressbal'}`), vóór het laatste gevecht.

**Bingo**
- `offline`: de Fabulant (in f4.js).

**Epiloog**: zie ‘De epiloog’ bovenaan. Laat `ON.epilogueExtra` in f4.js alleen regels over de wereld teruggeven.

## Prestaties en cosmetica

| Prestatie | Hoe | Cosmetica |
|---|---|---|
| `eerste_geheim`, `alle_geheimen` | vanzelf | `directiebril` (alle geheimen van Diepte 0) |
| `nummer999` | de nummerautomaat (D0) | |
| `stempel` | Sanne (D0) | |
| `joop_vriend` | vanzelf bij Joop 4 of hoger | `joop_pet` |
| `begrijpelijk` | Ingrid of de inwoners (D0) | |
| `snelle_lift` | na ‘Terug naar maandagochtend’ | |
| `belofte` | vanzelf (D3) | `bakker_paraplu` |
| `overdracht` | vanzelf (D2) | `henk_hawaii` |
| `ontglansd` | vanzelf (D4, `glans_hielp`) | |
| `opa` | vanzelf (vier opa-tekens) | |
| `bingo` | vanzelf (de volle kaart, plus de vondst `bingokaart`) | `bingo_hoed` |
| `alle_kaartjes`, `pips_trots`, `alle_bronnen` | vanzelf | `glans_das` (alle kaartjes) |
| `koffie` | vanzelf (elke koffieautomaat) | `mok` |
| `geen_lift`, `geen_koffie`, `pacifist`, `dossier`, `samen` | aan het eind | `bhv_helm` (geen koffie), `griffel_veer` (dossier) |
| | `vijf_waaroms` gevonden | `waarom_mantel` |
| | negen brugsleutels | `wouter_hesje` |

De vergaderbingo: elke volle rij geeft +10 maximaal vertrouwen, de volle kaart de Kantoorvondst `bingokaart` en de hoge hoed. De kaart, rij voor rij: Stip op de horizon · Parkeerlijst · Integraal / Even sparren · Draagvlak · Offline bespreken / Laaghangend fruit · Kwartiermaker · Proeftuin.

## Checklist per lane

**Diepte 1 en 2**: Pip en Daan in f1.js; de reacties van Bakker, Ilse en Glans op hun D0-keuzes; de vijf waaroms; Henk (`henk_overdracht`, `mok`), Kim (`kim_besluit`, `bingo:kwartiermaker`), Vonk (`koekjes`), de liftmuziek; plaats `opa_d1`, `stagiair`, `oudste_klacht`, `pips_naam`, `wichelroede`, `bhvlamp`, `laaghangend`, `opa_d2`, `henks_la`, `badeend`, `agenda`, `draagvlak`; zet `strictFinds: true` in `floors/f1.js` en `floors/f2.js`.

**Diepte 3 en 4**: Bakker en de belofte, Wouter, Glans (`glans_kern`, `glans_eind`, `glans_hielp`, de map in het gevecht), Otto (`bingo:integraal`), Bram, Noor, de Fabulant (het bewijs, `bingo:offline`), het Orakel (`orakel_mop`), de Zegelkamer (`joop4`, `bakker4`, `ilse4`, `glans5` en het negende kaartje); plaats `opa_d3`, `burgemeestersboek`, `vijfde_wekker`, `vandale`, `postits`, `proeftuin`, `opa_d4`, `echo`, `stressbal`; haal de oude regels over mensen uit `ON.epilogueExtra`; zet `strictFinds: true` in `floors/f3.js` en `floors/f4.js`.
