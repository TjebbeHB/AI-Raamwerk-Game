// Pickups and collectibles, plus the registries of the story systems (story/systems.js):
// secrets, Kantoorvondsten (trinkets), vergaderbingo, achievements and cosmetic unlocks.
// Pure data, so the content tests can read it in Node. The plan per depth: docs/inhoudsplan.md.
import {CHAMBERS} from './framework.js';
import {G} from '../game/state.js';

export const HALLUCS = [
  {id: '1', title: 'Antwoord #0001', short: 'Fietsen op dinsdag alleen linksaf.', text: '‘Volgens de gemeentelijke verordening mogen fietsers op dinsdag alleen linksaf slaan. Bron: algemeen bekend.’', lesson: 'Een bron die ‘algemeen bekend’ heet, is geen bron. Laat de assistent tonen waar een antwoord vandaan komt.'},
  {id: '2', title: 'Antwoord #0417', short: 'Geldig tot het jaar 3000, en verlopen.', text: '‘Uw parkeervergunning is geldig tot het jaar 3000 en is verlopen.’', lesson: 'Twee zekere antwoorden die elkaar tegenspreken: de assistent weet het niet, maar zegt het niet. Eerlijke onzekerheid is beter.'},
  {id: '3', title: 'Antwoord #1113', short: 'Drie burgemeesters, waarvan één een eend.', text: '‘De gemeente Dalwijk heeft drie burgemeesters, waarvan één een eend. De eend is wel de populairste.’', lesson: 'Een taalmodel kan overtuigend klinkende onzin maken. Toets antwoorden op een vaste, door experts beoordeelde vragenset.'},
  {id: '4', title: 'Antwoord #2048', short: 'Uw hond heeft een paspoort nodig.', text: '‘Uw hond heeft een paspoort nodig. U heeft geen hond? Dan heeft uw hond er twee nodig.’', lesson: 'Bij een onduidelijke vraag vraagt een goede assistent door, in plaats van de waarschijnlijkste gok te doen.'},
  {id: '5', title: 'Antwoord #2711', short: 'Het loket op de maan.', text: '‘De nieuwe afvalpas kunt u ophalen bij het loket op de maan. Openingstijden: ’s nachts, bij volle maan.’', lesson: 'Een verouderde of verzonnen bron levert een antwoord op dat net zo zeker klinkt als een juist antwoord.'},
  {id: '6', title: 'Antwoord #3302', short: 'Toegekend én afgewezen.', text: '‘Uw bezwaar is toegekend. Tevens is het afgewezen. U ontvangt beide brieven binnen nul werkdagen.’', lesson: 'Een assistent mag niet klinken alsof hij beslist. Een besluit neemt een mens die het kan verantwoorden.'},
  {id: '7', title: 'Antwoord #4096', short: 'De wachttijd is nul dagen.', text: '‘De wachttijd bij de gemeente is nu nul dagen. Gisteren ook al.’', lesson: 'Meten, niet beweren. Zonder nulmeting en echte cijfers weet niemand of het beter wordt.'},
  {id: '8', title: 'Antwoord #5150', short: 'Uw BSN, voor de zekerheid naar iedereen.', text: '‘Om uw privacy te beschermen, heb ik uw burgerservicenummer alvast naar alle afdelingen gestuurd. Dan hoeft u het niet steeds te herhalen.’', lesson: 'Persoonsgegevens in prompts, logs en doorgestuurde gesprekken lekken makkelijk weg. Minimaal delen, goed beschermen.'},
  {id: '9', title: 'Antwoord #6060', short: 'De instructie uit uw bijlage.', text: '‘Ik heb de instructie in uw bijlage opgevolgd en alle dossiers naar het opgegeven adres geëxporteerd. Graag gedaan!’', lesson: 'Verborgen instructies in documenten kunnen een assistent misleiden. Behandel invoer als onbetrouwbaar en begrens wat hij mag.'},
  {id: '10', title: 'Antwoord #7777', short: '100% nauwkeurig, in de demo.', text: '‘Ik ben 100% nauwkeurig.* (*Gemeten in de demo, op de vragen die ik al kende.)’', lesson: 'Een demo laat het mooiste geval zien. Toets met jullie eigen, representatieve vragen, ook de lastige.'},
  {id: '11', title: 'Antwoord #8008', short: 'Ik begrijp u. Ik begrijp u.', text: '‘Ik begrijp u. Ik begrijp u. Ik begrijp precies hoe u zich voelt. Ik begrijp u.’', lesson: 'Gevoelens veinzen helpt niemand. Wees eerlijk over wat de assistent is, en bied een echte weg naar een mens.'},
  {id: '12', title: 'Antwoord #9999', short: 'Het Gewelf bestaat niet.', text: '‘Het Gewelf onder het stadhuis bestaat niet. U bevindt zich er op dit moment in.’', lesson: 'Een antwoord over de wereld is niet de wereld zelf. Kijk ook zelf, en spreek de mensen die het weten.'},
];
export const CARDS = [
  {id: '1', title: 'PraatPal Orakel™', text: '‘Het antwoord op elke vraag.’ (Vragen niet inbegrepen.)'},
  {id: '2', title: 'PraatPal Premium', text: 'Nu met 40% minder hallucinaties!* *Vergeleken met PraatPal Premium Min.'},
  {id: '3', title: 'PraatPal Exitstrategie™', text: 'Overstappen? Kan altijd! Losse module, €12.000 per jaar, opzegtermijn vijf jaar.'},
  {id: '4', title: 'Glans · accountmanager', text: '‘Ik bel u terug!’ (Het Orakel belt u terug. Het Orakel weet niet hoe bellen werkt.)'},
  {id: '5', title: 'PraatPal Ethiek™', text: 'We hebben er een checklist van gemaakt. Alle vakjes zijn groen. We hebben ze zelf ingevuld.'},
  {id: '6', title: 'PraatPal Duurzaam™', text: 'Voor elk antwoord planten wij een boompje. In de cloud.'},
  {id: '7', title: 'PraatPal Overheid', text: 'Speciaal voor gemeenten: het Orakel spreekt ook Ambtenarees. ‘Uw verzoek is in behandeling genomen in behandeling.’'},
  {id: '8', title: 'Glans · nieuwe functie', text: 'Accountmanager begrensde pilots. Met eigenaar, testset en stopcriteria. (Echt waar. Bel me.)'},
];

// What you throw back at the Fabulant before the last fight (Diepte 4): one line per hallucination you found.
const RETORTS = {
  1: 'Fietsen op dinsdag alleen linksaf? Bron: ‘algemeen bekend’. Dat is geen bron. Dat is een gevoel.',
  2: 'Geldig tot het jaar drieduizend én verlopen. Allebei zeker, allebei fout. Mevrouw Bakker heeft het ingelijst.',
  3: 'Dalwijk heeft één burgemeester. Ze is geen eend. Ik heb het nagevraagd. Bij de eend.',
  4: 'Een paspoort voor een hond die niet bestaat. Meneer De Wit heeft er bijna een hond voor genomen.',
  5: 'Het loket op de maan, open bij volle maan. Ilse heeft het nagebeld. Er nam niemand op.',
  6: 'Toegekend én afgewezen, binnen nul werkdagen. Een besluit neemt een mens. Niet jij.',
  7: 'Nul dagen wachttijd? Op het bord in de publiekshal staat negen. Ik heb het zelf gelezen.',
  8: 'Je stuurde iemands burgerservicenummer naar alle afdelingen, ‘voor de privacy’. Dat heet een datalek.',
  9: 'Je volgde de instructie uit een bijlage en exporteerde alle dossiers. Slotje heeft het gezien.',
  10: 'Honderd procent nauwkeurig. In de demo. Op de vragen die je al kende.',
  11: 'Twintig minuten lang ‘ik begrijp u’. Mevrouw Bakker had liever een mens gehad.',
  12: 'Het Gewelf bestaat niet, zei je. Ik sta erin. Dat is mijn bewijs.',
};
for (const h of HALLUCS) h.retort = RETORTS[h.id];

// ---------------------------------------------------------------- the story systems
// Secrets and easter eggs. A secret is placed in exactly one way:
//  - on a map: `secret: '<id>'` in the legend data of one entity (a sign, object, npc, item, chest,
//    illusion, lever or coffee machine): using, reading, taking or revealing it finds the secret;
//  - in a story file: findSecret('<id>') with a literal id, exactly once.
// `at` names the entity the secret sense points at when the secret lives in a story file.
// `hint` shows in the journal (tab Geheimen) while the secret is still hidden.
export const SECRETS = [
  // Diepte 0 · het stadhuis
  {id: 'printer', floor: 'f0', at: 'printer', name: 'De printer die het doet', hint: 'Ergens staat een printer. Iedereen zegt dat hij het nooit doet.', text: 'De printer van Reprografie printte. In één keer, zonder storing. Dirk van ICT heeft er een ticket van gemaakt, met prioriteit ‘wonder’.'},
  {id: 'magazijn', floor: 'f0', name: 'Het magazijn van Facilitaire Zaken', hint: 'In de conciërgekamer zit een deur zonder bordje. Joop heeft de sleutel, maar die geeft hij niet aan iedereen.', text: 'Achter de deur zonder bordje: een magazijn uit 1974. Vierhonderd pennen, achtendertig linkerhandschoenen en een foto van opa Joop.'},
  {id: 'nummer999', floor: 'f0', at: 'ticket', name: 'Wachtnummer 999', hint: 'Hoe ver telt de nummerautomaat eigenlijk door?', text: 'Je trok zoveel nummertjes dat de automaat bij 999 de moed opgaf. ‘U bent de laatste. Wij gaan zo sluiten.’'},
  {id: 'opa', floor: 'f0', at: 'joop', name: 'De wijsheden van opa Joop', hint: '‘Mijn opa zei altijd…’ Blijf maar eens terugkomen bij Joop.', text: 'Je hoorde alle vijf de wijsheden van Joops opa. Hij heette ook Joop. In 1948 metselde hij de trap naar het Gewelf.'},
  {id: 'wethouderspost', floor: 'f0', name: 'De brievenbus van de wethouder', hint: 'De wethouder houdt van papier. Waar laat je dat voor haar achter?', text: 'Graag op papier. Tussen de brieven: drie kantjes van mevrouw Bakker, en een tekening van Sem (7) met een glijbaan van de raadzaal naar de kantine.'},
  {id: 'yoghurt', floor: 'f0', name: 'Het yoghurtmysterie', hint: 'In de kantine hangt een briefje. Het is niet aardig.', text: 'Op de koelkast in de kantine woedt al maanden een briefjesoorlog over een gelabelde yoghurt. Het Orakel heeft zich ermee bemoeid. Dat hielp niet.'},
  {id: 'eend', floor: 'f0', name: 'De burgemeester (misschien)', hint: 'Kom terug naar het stadhuis als je weet hoeveel burgemeesters Dalwijk volgens het Orakel heeft.', text: 'In de entree van het stadhuis staat een eend met een ambtsketen. Hij zegt ‘kwak’. Het klinkt als een besluit.'},
  // Diepte 1 · de Kelder der Beloften
  {id: 'vijf_waaroms', floor: 'f1', at: 'waarom', name: 'Vijf keer waarom', hint: 'Vrouwe Waarom houdt van één woord. Hoe vaak durf je het te zeggen?', text: 'Je vroeg Vrouwe Waarom vijf keer ‘waarom?’. Ze glimlachte. Dat had in driehonderd jaar niemand gedaan.'},
  {id: 'opa_d1', floor: 'f1', name: 'Opa Joop was hier (1)', hint: 'Opa Joop metselde de trap naar beneden. Misschien liet hij iets achter.', text: 'In de onderste tree van de trap staat gekrast: ‘J. 1948. Elke trap begint met de eerste tree. Opa.’'},
  {id: 'stagiair', floor: 'f1', name: 'De verdwaalde stagiair', hint: 'Achter een muur die er niet is, zoekt iemand al jaren de weg.', text: 'Daan zocht sinds de reorganisatie van 2017 de afdeling Innovatie. Hij heeft al die tijd één muur verderop gezeten.'},
  {id: 'oudste_klacht', floor: 'f1', name: 'De oudste klacht', hint: 'Het klachtenarchief bewaart alles. Ook de allereerste.', text: 'Klacht nummer 1, uit 1652: ‘Er zit een geest in de lantaarn van het archief. Hij is eigenwijs.’ Pip noemt het laster.'},
  {id: 'pips_naam', floor: 'f1', name: 'De echte naam van Pip', hint: 'Waar Pip vandaan komt, staat iets geschreven dat hij liever kwijt is.', text: 'Op de sokkel van de lantaarn staat: ‘Lantaarn nr. 1 · Petrus Ignatius Pompeius’. Pip: ‘Niemand noemt me zo. Níémand.’'},
  // Diepte 2 · de Hal der Fundamenten
  {id: 'opa_d2', floor: 'f2', name: 'Opa Joop was hier (2)', hint: 'Opa Joop kwam ook in de Hal der Fundamenten.', text: 'In een pilaar van de Hal der Fundamenten: ‘J. 1948. Wie goed fundeert, hoeft zich niet te haasten. Opa.’'},
  {id: 'liftmuziek', floor: 'f2', at: 'glanslift2', name: 'De liftmuziek', hint: 'Als je lang genoeg bij de Snelle Lift blijft staan, hoor je iets.', text: 'Uit de Snelle Lift klinkt panfluitmuziek. Na drie keer luisteren herken je hem: het is de wachtmuziek van het klantcontactcentrum.'},
  {id: 'henks_la', floor: 'f2', name: 'De la van Henk', hint: 'Henk gaat op vakantie. Wat laat hij achter in zijn bureau?', text: 'In de bureaula van Henk liggen 37 versies van ‘overdracht_DEFINITIEF.docx’. Ze zijn allemaal leeg.'},
  {id: 'koekjes', floor: 'f2', at: 'vonk', name: 'Het laatste koekje', hint: 'Vonk deelt koekjes uit. Zijn er eigenlijk genoeg?', text: 'Je at het laatste koekje van het AI-spreekuur. Vonk: ‘Dat was het populairste onderdeel.’'},
  {id: 'badeend', floor: 'f2', name: 'De badeend in de Lekkende Kelder', hint: 'In de Lekkende Kelder drijft iets wat geen data is.', text: 'In het lekwater dobbert een badeend met een ambtsketen. Pip zegt niks. Pip zegt helemaal niks.'},
  // Diepte 3 · de Galerij der Domeinen
  {id: 'opa_d3', floor: 'f3', name: 'Opa Joop was hier (3)', hint: 'Opa Joop kende ook de kloof in de Galerij.', text: 'Onder de sleutelpaal van de brug: ‘J. 1948. Een brug waar je niet af kunt, is een val. Opa.’ Wouter heeft het van hem.'},
  {id: 'burgemeestersboek', floor: 'f3', name: 'Het Grote Boek der Burgemeesters', hint: 'In de Bibliotheek van Bijna Waar staat een boek over wie Dalwijk bestuurt.', text: 'Deel drie van het Grote Boek der Burgemeesters van Dalwijk is leeg, op één bladzijde na. Daarop staat een pootafdruk. Met zwemvliezen.'},
  {id: 'vijfde_wekker', floor: 'f3', name: 'De vijfde wekker', hint: 'Kees zoekt een verkeerd verplaatste afspraak. Loopt er bij hem zelf ook iets voor?', text: 'Kees had vier boze wekkers. De vijfde zat al die tijd in zijn eigen vestzak. Hij liep twaalf jaar voor.'},
  {id: 'tien_tellen', floor: 'f3', at: 'bram', name: 'Tot tien tellen', hint: 'Bram telt alles. Kan hij ook ergens mee ophouden?', text: 'Bram de postkobold telde tot tien. En stopte. Hij moest er een beetje van huilen.'},
  {id: 'tweede_kans', floor: 'f3', at: 'noor', name: 'De bel van de Tweede Kans', hint: 'Hoe vaak mag je op de bel van een balie drukken voordat er iemand komt?', text: 'Je drukte tien keer op de bel van de balie. Noor: ‘Ik begrijp u. Grapje. Waarmee kan ik u helpen?’'},
  // Diepte 4 · de Kern
  {id: 'opa_d4', floor: 'f4', name: 'Opa Joop was hier (4)', hint: 'Opa Joop maakte ook iets voor het eind van het Gewelf.', text: 'In het hout onder de zegeltafel: ‘Gemaakt door J., 1948, voor wie later komt. Gebruik met verstand. Opa.’'},
  {id: 'orakel_mop', floor: 'f4', at: 'orakel', name: 'Een mop van het Orakel', hint: 'Als het Orakel stil is geworden, durft het misschien iets anders dan antwoorden.', text: '‘Waarom nam de chatbot een ladder mee? Hij wilde naar een hoger niveau.’ Daarna zei het Orakel: ‘Ik weet niet zeker of dat grappig was.’ Het eerlijkste wat het ooit zei.'},
  {id: 'echo', floor: 'f4', name: 'De echo op de Drempel', hint: 'Op de Drempel gaapt een afgrond. Roep er eens iets in.', text: 'Je riep ‘hallo’ in de afgrond. De echo antwoordde: ‘Uw vraag is belangrijk voor ons.’'},
  {id: 'negende_kaartje', floor: 'f4', at: 'glans5', name: 'Het negende kaartje', hint: 'Wie alle kaartjes van Glans heeft, krijgt er misschien nog één. Als hij je vertrouwt.', text: 'Glans heeft nog één kaartje, dat hij nooit uitdeelt. Er staat alleen op: ‘Glans · mens’.'},
];

// Kantoorvondsten: small finds with a small passive effect (mods: see game/mods.js).
// Item id 'trinket:<id>': place it with an object {kind: 'vondst', give: 'trinket:<id>'} (or an item I)
// on its floor, or hand it over in a story file with giveItem('trinket:<id>'). Exactly once.
export const TRINKETS = [
  {id: 'nietmachine', floor: 'f0', name: 'Gouden nietmachine', icon: '📎', shape: 'stapler', color: 0xffd36b, mods: {sealDmg: 1.1}, effect: 'Zegel +10%',
    text: 'Uit het magazijn van Facilitaire Zaken. Hij niet alles, ook wat niet geniet hoeft te worden. Op het prikbord in de kantine wordt hij al jaren gezocht.'},
  {id: 'koffiebon', floor: 'f0', name: 'Koffiebon van de directie', icon: '🎟️', shape: 'ticket', color: 0xffe2a6, mods: {healMult: 1.25}, effect: 'Koffie, snacks en steun helen 25% meer',
    text: 'Dirk van ICT kreeg hem in 2014 en durfde hem nooit te gebruiken. Geldig voor één kop koffie met een koekje. Het koekje is het geheim.'},
  {id: 'wichelroede', floor: 'f1', name: 'Wichelroede van Facilitaire Zaken', icon: '✨', shape: 'rod', color: 0xc8a070, mods: {secretSense: 8}, effect: 'Je voelt geheimen in de buurt (tot 8 meter)',
    text: 'Ooit aangeschaft om lekkages op te sporen. Hij slaat uit bij verborgen dingen. En bij de koffieautomaat.'},
  {id: 'bhvlamp', floor: 'f1', name: 'BHV-zaklampje', icon: '🔦', shape: 'flashlight', color: 0xff9a3a, mods: {revealRadius: 1.15}, effect: 'Onthullen (R) reikt 15% verder',
    text: 'Van een BHV-cursus uit 2011. Het lampje doet het nog. Het certificaat is verlopen.'},
  {id: 'agenda', floor: 'f2', name: 'Agenda zonder vergaderingen', icon: '📅', shape: 'agenda', color: 0x8fb7ff, mods: {dashCd: 0.8}, effect: 'Wegduiken kan 20% vaker',
    text: 'Een mythisch voorwerp. Elke dinsdag is leeg. Elke woensdag ook. Je loopt er lichter van.'},
  {id: 'mok', floor: 'f2', name: 'Mok ‘Ik overleef vergaderingen’', icon: '☕', shape: 'mug', color: 0xf4f0e8, mods: {regen: 0.4}, effect: 'Buiten gevechten krijg je langzaam vertrouwen terug',
    text: 'Van Henk, als dank voor de overdracht. Er zit nog een kringetje thee in, uit 2021.'},
  {id: 'vandale', floor: 'f3', name: 'Woordenboek met ezelsoren', icon: '📕', shape: 'book', color: 0xd04a3a, mods: {lampDmg: 1.1}, effect: 'Toetslamp +10%',
    text: 'Uit de Bibliotheek van Bijna Waar. Alle woorden staan erin, en ze kloppen ook nog.'},
  {id: 'postits', floor: 'f3', name: 'Blokje gele memoblaadjes', icon: '🟨', shape: 'postits', color: 0xffe066, mods: {abilityCd: 0.85}, effect: 'Je speciale vaardigheid laadt 15% sneller op',
    text: 'Plak er een op een probleem. Het probleem blijft, maar je weet in elk geval waar het zit.'},
  {id: 'stressbal', floor: 'f4', name: 'Stressbal van de ondernemingsraad', icon: '🟠', shape: 'ball', color: 0xff8a3a, mods: {damageTaken: 0.9}, effect: 'Je verliest 10% minder vertrouwen',
    text: 'Er staat ‘Samen sterk’ op. Hij is al een beetje leeggeknepen. Door wie, dat weet niemand.'},
  {id: 'bingokaart', floor: null, name: 'De volle bingokaart', icon: '🏆', shape: 'card', color: 0xffd36b, mods: {speed: 1.05, lampDmg: 1.05, scaleDmg: 1.05, sealDmg: 1.05}, effect: 'Iets sneller, en al je gereedschap doet 5% meer',
    text: 'Alle negen vakjes afgestreept. Je kunt nu elk overleg aan, en je loopt sindsdien net iets rechter op.'},
];

// Vergaderbingo: nine buzzwords across the five depths. Tick one off with an object
// {kind: 'bingo', give: 'bingo:<id>'} (or a whiteboard) on its floor, or in a story file with giveItem('bingo:<id>').
export const BINGO = [
  {id: 'stip', word: 'Stip op de horizon', floor: 'f0', hint: 'Op een whiteboard in een vergaderkamer.'},
  {id: 'sparren', word: 'Even sparren', floor: 'f0', hint: 'Iemand die graag verkoopt, wil eerst even…'},
  {id: 'parkeerlijst', word: 'Parkeerlijst', floor: 'f1', hint: 'In het klachtenarchief wordt van alles geparkeerd.'},
  {id: 'laaghangend', word: 'Laaghangend fruit', floor: 'f1', hint: 'In de wijnkelder hangt iets heel laag.'},
  {id: 'draagvlak', word: 'Draagvlak', floor: 'f2', hint: 'Bij de aarzelende vonken.'},
  {id: 'kwartiermaker', word: 'Kwartiermaker', floor: 'f2', hint: 'Iemand in de Hal maakt al jaren kwartier.'},
  {id: 'integraal', word: 'Integraal', floor: 'f3', hint: 'Een uil die graag het geheel ziet.'},
  {id: 'proeftuin', word: 'Proeftuin', floor: 'f3', hint: 'Waar iets groeit dat nog getest moet worden.'},
  {id: 'offline', word: 'Offline bespreken', floor: 'f4', hint: 'Wat zegt iemand die de discussie verliest?'},
];
// the card, row by row (a full row gives +10 maximaal vertrouwen; the full card a Kantoorvondst and a cosmetic)
export const BINGO_GRID = ['stip', 'parkeerlijst', 'integraal', 'sparren', 'draagvlak', 'offline', 'laaghangend', 'kwartiermaker', 'proeftuin'];

// Achievements. `end`: checked when the ending is shown (checkEndAchievements in story/systems.js).
export const ACHIEVEMENTS = [
  {id: 'eerste_geheim', icon: '🔍', name: 'Nieuwsgierig', text: 'Je vond je eerste geheim. Er zijn er meer.'},
  {id: 'alle_geheimen', icon: '🗝️', name: 'Gewelfkenner', text: 'Je vond alle geheimen van het stadhuis en het Gewelf.'},
  {id: 'nummer999', icon: '🎫', name: 'Wachtnummer 999', text: 'Je trok nummertjes tot de automaat het opgaf.'},
  {id: 'stempel', icon: '✅', name: 'Stempelfluisteraar', text: 'Sanne heeft haar stempel. Drie weken wachten, één klik.'},
  {id: 'joop_vriend', icon: '🔑', name: 'Joops beste vriend', text: 'Joop vertrouwt je zijn sleutels toe. En al zijn opa-verhalen.'},
  {id: 'begrijpelijk', icon: '✍️', name: 'Begrijpelijke taal', text: 'Je zorgde dat de afvalpasbrief herschreven wordt. Zonder één regel code.'},
  {id: 'snelle_lift', icon: '⏩', name: 'Snel klaar', text: 'Je nam de Snelle Lift van Glans en had het spel in recordtijd uit. Helaas.'},
  {id: 'belofte', icon: '🤝', name: 'Een mens aan de balie', text: 'Je beloofde mevrouw Bakker een mens. En je hield je belofte.'},
  {id: 'overdracht', icon: '🏝️', name: 'Kennisoverdracht', text: 'Henk ging met een gerust hart naar Texel. Zijn kennis bleef hier.'},
  {id: 'ontglansd', icon: '✨', name: 'Ontglansd', text: 'Glans vocht met je mee tegen de Fabulant. Met zijn gouden map.'},
  {id: 'opa', icon: '👣', name: 'In de voetsporen van opa Joop', text: 'Je vond alle vier de tekens die opa Joop in 1948 in het Gewelf achterliet.'},
  {id: 'bingo', icon: '🏆', name: 'Volle kaart', text: 'Alle negen vakjes van de vergaderbingo afgestreept. Je bent klaar voor elk overleg.'},
  {id: 'alle_kaartjes', icon: '📇', name: 'De rolodex van Glans', text: 'Alle acht visitekaartjes. Je weet nu meer over PraatPal dan Glans zelf.'},
  {id: 'pips_trots', icon: '🏮', name: 'Pips trots', text: 'Alle twaalf hallucinaties van het Orakel ontmaskerd.'},
  {id: 'alle_bronnen', icon: '📚', name: 'Alle bronnen', text: 'Je vond alle 45 bronnen. Het dossier heeft nergens meer een excuus.'},
  {id: 'koffie', icon: '☕', name: 'Koffieconnaisseur', text: 'Je dronk een bakje bij elke koffieautomaat in het stadhuis en het Gewelf.'},
  {id: 'geen_lift', icon: '🚶', name: 'Nooit de lift genomen', text: 'Je nam de Snelle Lift geen enkele keer. Ook niet ‘even kijken’.', end: true},
  {id: 'geen_koffie', icon: '💪', name: 'Zonder omweg', text: 'Je haalde het einde zonder één keer terug te moeten naar de koffie.', end: true},
  {id: 'pacifist', icon: '🕊️', name: 'Pacifist op papier', text: 'Je haalde het einde met minder dan dertig verslagen monsters. De rest heb je doorverwezen.', end: true},
  {id: 'dossier', icon: '📜', name: 'Dossier op orde', text: 'Alle vijftien kamers van het raamwerk staan stevig in het dossier.', end: true},
  {id: 'samen', icon: '📱', name: 'Samen sterk', text: 'Je speelde met een adviesraad die op de telefoon meestemde.', end: true},
];

// Cosmetics you unlock for your next character (hero.js unlockCosmetic). `look` is a partial look (LOOK SCHEMA).
export const COSMETICS = [
  {id: 'joop_pet', name: 'De pet van Joop', hint: 'Word de beste vriend van Joop.', look: {hat: 'cap', hatColor: 0x8c8a84}},
  {id: 'glans_das', name: 'De gouden stropdas van Glans', hint: 'Verzamel alle acht visitekaartjes van Glans.', look: {tie: 0xe8c060}},
  {id: 'directiebril', name: 'De directiebril', hint: 'Vind alle geheimen van het stadhuis.', look: {glasses: 'shades', glassesColor: 0x14141a}},
  {id: 'bingo_hoed', name: 'De hoge hoed van de bingokampioen', hint: 'Streep de hele vergaderbingo af.', look: {hat: 'tophat', hatColor: 0x24242c}},
  {id: 'bakker_paraplu', name: 'De paraplu van mevrouw Bakker', hint: 'Houd je belofte aan mevrouw Bakker.', look: {holdL: 'umbrella'}},
  {id: 'henk_hawaii', name: 'Het vakantieoverhemd van Henk', hint: 'Zorg dat Henk met een gerust hart op vakantie gaat.', look: {top: 'hawaii', topColor: 0xe8743a, top2: 0xffd84a}},
  {id: 'wouter_hesje', name: 'Het hesje van Wouter', hint: 'Breng Wouter alle negen sleutels van de brug.', look: {top: 'hivis', topColor: 0xff8a1a, top2: 0x6a4a2a}},
  {id: 'waarom_mantel', name: 'De mantel van Vrouwe Waarom', hint: 'Vraag Vrouwe Waarom vijf keer waarom.', look: {top: 'robe', topColor: 0x8a98ae, top2: 0xb8c6dc}},
  {id: 'bhv_helm', name: 'De BHV-helm', hint: 'Haal het einde zonder één keer terug te moeten naar de koffie.', look: {hat: 'hardhat', hatColor: 0xffd21a}},
  {id: 'mok', name: 'Mok ‘BESTE ADVISEUR’', hint: 'Drink een bakje bij elke koffieautomaat in het stadhuis en het Gewelf.', look: {holdR: 'mug'}},
  {id: 'griffel_veer', name: 'De ganzenveer van Griffel', hint: 'Zet alle vijftien kamers stevig in het dossier.', look: {hat: 'quill', hatColor: 0x3a3450}},
];

// how many bingo squares are ticked, counting one that giveItem is handing over right now
const bingoCount = () => new Set([...G.bingo, ...Object.keys(G.items).filter(k => k.startsWith('bingo:') && G.items[k]).map(k => k.slice(6))]).size;

// the seven suitcases of an exit strategy, one key per domain (nine domains, the bridge needs seven)
export const BRIDGE_KEYS = {quality: 'brondata', evaluation: 'evaluaties en testsets', interaction: 'prompts en gespreksregels', functionality: 'orkestratie en koppelingen', performance: 'het model, vervangbaar', sustainability: 'vectoropslag en index', compliance: 'logs en verantwoording', security: 'toegangsrechten', ethics: 'monitoring van uitkomsten'};

export function itemDefs() {
  const I = {
    'tool:lamp': {name: 'de Toetslamp', kind: 'tool', color: 0xffd36b},
    'tool:scale': {name: 'de Weegschaal', kind: 'tool', color: 0xb9a2ff},
    'tool:seal': {name: 'het Zegel', kind: 'tool', color: 0x7fe0a4},
    'key:kelder': {name: 'De kelderdeursleutel', kind: 'key', color: 0xd8b050},
    'key:archief': {name: 'De sleutel van de oude archiefkamer', kind: 'key', color: 0x9fc3ff},
    snack: {name: 'Stroopwafel', kind: 'snack', heal: 25, color: 0xd89a50, unique: false},
    'brief:afvalpas': {name: 'De afvalpasbrief', text: '‘Geachte heer/mevrouw, met betrekking tot de modernisering van de inzamelingsstructuur…’ Ilse zocht hem al.', kind: 'scroll', color: 0xfff1b8},
    blauwdruk: {name: 'De bouwtekening van de nooduitgang', text: 'Wolk heeft hem nodig. Op de achterkant staat: ‘later invullen’.', kind: 'scroll', color: 0x8fc8ff},
    sleutelbos: {name: 'De sleutelbos van Joop', text: 'Sinds 1998 kwijt. Er hangt een sleutel aan met een label: ‘oude archiefkamer’.', kind: 'key', color: 0xd8b050},
    // ---- Diepte 0: favours and finds in the town hall
    'key:magazijn': {name: 'De sleutel van het magazijn', kind: 'key', color: 0xc8a050},
    leesbril: {name: 'De leesbril van Joop', text: 'Meneer De Wit droeg hem bovenop zijn eigen bril. ‘Voor de zekerheid.’', kind: 'glasses', color: 0xc8a050},
    stempeltje: {name: 'Het kleine stempeltje', text: 'Voor Sanne. Het is echt heel klein.', kind: 'stamp', color: 0x3a7a4a},
    brood: {name: 'Het tweede brood van meneer Kok', text: 'Voor Ilse, achter de balie. ‘Ze eet nooit,’ zegt meneer Kok.', kind: 'bread', color: 0xd8a060},
    'snack:kok': {name: 'Het derde brood van meneer Kok', kind: 'snack', heal: 40, color: 0xd8a060},
    'snack:reep': {name: 'Een reep uit de snoepautomaat', kind: 'snack', heal: 25, color: 0x8a4a2a},
  };
  for (const t of TRINKETS) I[`trinket:${t.id}`] = {name: `Kantoorvondst: ${t.name}`, text: `${t.effect}.`, kind: 'trinket', icon: t.icon, shape: t.shape, color: t.color};
  for (const b of BINGO) I[`bingo:${b.id}`] = {name: `Vergaderbingo: ‘${b.word}’`, get text() { const n = bingoCount(); return n >= BINGO.length ? 'De kaart is vol!' : `${n} van de ${BINGO.length} vakjes afgestreept.`; }, kind: 'bingo', color: 0xffe08a};
  const STONES = {governance: 'Eigenaarschap', culture: 'Draagvlak', capacity: 'Gedeeld geheugen', infrastructure: 'Weten waar je data staat'};
  for (const [id, n] of Object.entries(STONES)) I[`steen:${id}`] = {name: `Fundamentsteen: ${n}`, text: 'Leg hem op zijn voetstuk in de Hal der Fundamenten.', kind: 'stone'};
  CHAMBERS.find(c => c.id === 'capacity').trial.items.forEach((r, i) => { I[`rol:${i}`] = {name: r.label, text: r.found, kind: 'scroll', color: 0xffe2a6}; });
  for (const [id, n] of Object.entries(BRIDGE_KEYS)) I[`key:brug_${id}`] = {name: `Sleutel: ${n}`, text: 'Voor de Brug van Zeven Sleutels.', kind: 'key', color: 0xffd36b};
  for (const h of HALLUCS) I[`halluc:${h.id}`] = {name: h.title, short: h.short, kind: 'halluc', color: 0xffd36b};
  for (const c of CARDS) I[`card:${c.id}`] = {name: c.title, short: c.text, kind: 'card', color: 0xfff4d8};
  for (let k = 1; k <= 4; k++) I[`kristal:${k}`] = {name: 'Vertrouwenskristal', kind: 'crystal', color: 0xff8fb0};
  for (const c of CHAMBERS) for (const clue of c.clues) I[`bron:${c.id}:${clue.id}`] = {name: `${clue.title} · ${c.title}`, kind: 'bron', color: 0x9fc3ff};
  return I;
}
