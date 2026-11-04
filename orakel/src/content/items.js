// Pickups and collectibles.
import {CHAMBERS} from './framework.js';

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
  };
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
