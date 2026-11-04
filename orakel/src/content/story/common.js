// Story glue shared by all floors: quests, coffee corners, hints, the journal's dossier tabs.
import {ON, UI, SFX, P, chamberState} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {QUESTS, DEPTH_NAMES, stage, setStage, startQuest} from '../../game/quests.js';
import {healPlayer} from '../../game/player.js';
import {scene, say, choose} from '../../game/dialogue.js';
import {JOURNAL_TABS} from '../../ui/menus.js';
import {CHAMBERS, CHAMBER, STATE_LABEL, CRITICAL, FOUNDATIONS, DOMAINS} from '../framework.js';
import {clueHtml} from '../../ui/decision.js';
import {HALLUCS, CARDS} from '../items.js';
import {heardCount} from '../puzzles.js';
import {onItem, onCoffee} from './systems.js';
import {heroName} from '../../game/hero.js';
import {el, esc, IS_TOUCH} from '../../core/util.js';

Object.assign(DEPTH_NAMES, {f0: 'het stadhuis', f1: 'Diepte 1', f2: 'Diepte 2', f3: 'Diepte 3', f4: 'Diepte 4'});
export const foundationsDone = () => FOUNDATIONS.filter(id => G.flags[`steen:${id}`]).length;
export const keysCount = () => Object.keys(G.keys).filter(k => k.startsWith('brug_')).length;

QUESTS.main = {title: 'Het Orakel van Dalwijk', stages: [
  {short: 'Eerste werkdag', text: 'Lees de brief die op je bureau ligt.', log: 'Eerste werkdag bij de gemeente Dalwijk.', at: {f: 'f0', e: 'letter'}},
  {short: 'De kelderdeur', text: 'Vraag Joop, de conciërge, om de sleutel van de kelder. Zijn kamer is aan het eind van de gang.', log: 'De wethouder wil vrijdag een advies: AI inzetten of niet?', at: {f: 'f0', e: 'joop'}},
  {short: 'Naar beneden', text: 'Open de kelderdeur aan het eind van de gang en daal af naar het Gewelf.', log: 'Joop gaf je de kelderdeursleutel, en een stroopwafel.', at: {f: 'f0', e: 'down_f1'}},
  {short: 'Een lamp in het donker', text: 'Je telefoonlampje is bijna leeg. Zoek iets dat licht geeft.', log: 'Afgedaald naar het Gewelf onder het stadhuis.', at: {f: 'f1', e: 'lamp'}},
  {short: 'Wat niet echt is', text: 'Een gouden muur verspert de weg naar het noorden. Laat het licht van de lamp openbarsten (R).', log: 'Pip, de geest in de oude lantaarn, is wakker. Hij noemt het de Toetslamp.', at: {f: 'f1', e: 'nepmuur'}},
  {short: 'De Kamer van de Vraag', text: 'Ga naar het noorden, naar de Bron van Waarom. Spreek Vrouwe Waarom aan.', log: 'Wat glanst, is niet altijd echt.', at: {f: 'f1', e: 'waarom'}},
  {short: 'Drie stemmen', text: () => `Vrouwe Waarom wil dat je drie betrokkenen hoort. Ze zijn ergens in de kelders (${heardCount('necessity')}/3).`, log: 'Vrouwe Waarom laat niemand door zonder een goede vraag.', at: () => nearestWitness()},
  {short: 'De vraag van Waarom', text: 'Je hebt alle drie de stemmen gehoord. Keer terug naar Vrouwe Waarom bij de Bron.', log: 'Mevrouw Bakker, Ilse en Glans: drie kanten van hetzelfde probleem.', at: {f: 'f1', e: 'waarom'}},
  {short: 'De Gang der Beloften', text: 'Het hek naar het westen is open. Volg de Gang der Beloften naar de Showroom.', log: 'Je kreeg de Weegschaal van Vrouwe Waarom.', at: {f: 'f1', e: 'showroom'}},
  {short: 'De Glimmende Demo', text: 'Er staat iets enorms en glimmends in de Showroom. Laat het licht openbarsten (R) en toets het.', log: 'De Gang der Beloften hing vol slogans.', at: {f: 'f1', e: 'showroom'}},
  {short: 'Naar Diepte 2', text: 'De trap achter de Showroom is vrij. Daal af naar de Hal der Fundamenten.', log: 'Onder de glans van de demo zat karton.', at: {f: 'f1', e: 'down_f2'}},
  {short: 'Vier fundamenten', text: () => `Herstel de vier fundamenten (${foundationsDone()}/4): ${['governance', 'culture', 'capacity', 'infrastructure'].filter(id => !G.flags[`steen:${id}`]).map(id => ({governance: 'Governance (noord)', culture: 'Cultuur & Adoptie (oost)', capacity: 'Kennis & Capaciteit (west)', infrastructure: 'Infrastructuur & Data (zuid)'}[id])).join(', ')}.`, log: 'In de Hal der Fundamenten staan vier pilaren, drie ervan zijn ingestort.', at: () => nextWing()},
  {short: 'De Haastkoning', text: 'Er dendert iets de hal in. Geef het bedenktijd met de Weegschaal (2).', log: 'Alle vier de fundamenten staan weer.', at: {f: 'f2', e: 'biglift'}},
  {short: 'De grote lift', text: 'De grote lift in het midden van de hal is wakker. Neem hem naar Diepte 3.', log: 'De Haastkoning is van zijn troon.', at: {f: 'f2', e: 'biglift'}},
  {short: 'Zeven sleutels', text: () => `De brug over de kloof mist zeven sleutels. Verdien ze in de domeinen rond de galerij (${keysCount()}/7).`, log: 'In de Galerij der Domeinen gaapt een kloof.', at: () => ({f: 'f3', e: 'wouter'})},
  {short: 'De Brug van Zeven Sleutels', text: 'Je hebt genoeg sleutels. Breng ze naar Wouter, de brugwachter.', log: 'Zeven sleutels: data, prompts, evaluaties, en meer.', at: {f: 'f3', e: 'wouter'}},
  {short: 'De Drempel', text: 'De brug staat. Steek over en daal af naar de diepste kelder.', log: 'De brug staat, en je kunt er ook weer af.', at: {f: 'f3', e: 'down_f4'}},
  {short: 'Het Orakel', text: 'Volg de gouden draden naar de Kern van het Gewelf.', log: 'Op de Drempel klinkt de stem van het Orakel overal.', at: {f: 'f4', e: 'orakel'}},
  {short: 'De Fabulant', text: 'De Fabulant is het zelfvertrouwen van het Orakel zonder grenzen. Toets, weeg en begrens.', log: 'Het Orakel is niet slecht. Maar niemand heeft het ooit begrensd.', at: {f: 'f4', e: 'orakel'}},
  {short: 'De Zegelkamer', text: 'De Zegelkamer is open. Iedereen wacht. Bezegel het besluit.', log: 'De Fabulant is verslagen.', at: {f: 'f4', e: 'sealtable'}},
  {short: 'Een jaar later', text: 'Het besluit is bezegeld.', log: '', done: true},
]};
QUESTS.bakker = {side: true, title: 'Mevrouw Bakker zoekt een mens', stages: [
  {text: 'Mevrouw Bakker is het Gewelf in gelopen, op zoek naar ‘een balie waar een mens zit’. Misschien kom je haar dieper weer tegen.', at: () => ({f: 'f3', e: 'bakker3'})},
  {text: 'Mevrouw Bakker zit vast aan de Balie van de Tweede Kans. Help haar verder.', at: {f: 'f3', e: 'bakker3'}},
  {text: 'Mevrouw Bakker heeft een mens gesproken: jou. En Noor.', done: true},
]};
QUESTS.sleutelbos = {side: true, title: 'De sleutelbos van Joop', stages: [
  {text: 'Joop is in 1998 zijn sleutelbos kwijtgeraakt, ergens in het Gewelf. Er hangt een sleutel aan van de oude archiefkamer.', at: null},
  {text: 'Je hebt de sleutelbos van Joop. De sleutel past op de oude archiefkamer, in de kelders van Diepte 1.', at: {f: 'f1', e: 'archiefdeur'}},
  {text: 'De oude archiefkamer is weer open.', done: true},
]};
QUESTS.hallucs = {side: true, title: 'Pips verzameling hallucinaties', stages: [
  {text: () => `Pip verzamelt de gouden rollen met verzonnen antwoorden van het Orakel. ‘Zodat we weten waar het misgaat.’ (${G.hallucs.length}/12)`, at: null},
  {text: 'Alle twaalf hallucinaties gevonden. Pip is apetrots.', done: true},
]};
QUESTS.kaartjes = {side: true, title: 'De visitekaartjes van Glans', stages: [
  {text: () => `Glans strooit overal visitekaartjes rond. Raap ze op, al was het maar om de vloer schoon te houden. (${G.cards.length}/8)`, at: null},
  {text: 'Je hebt alle acht visitekaartjes. Je weet nu meer over PraatPal dan Glans zelf.', done: true},
]};

function nearestWitness() {
  const ids = [['bakker1', 0], ['ilse1', 1], ['glans1', 2]].filter(([, i]) => !G.flags[`heard:necessity:${i}`]).map(([id]) => id);
  if (W.id !== 'f1') return {f: 'f1'};
  let best = null, bd = 1e9;
  for (const id of ids) { const e = ent(id); if (!e || e.visible === false) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = id; } }
  return best ? {e: best} : null;
}
function nextWing() {
  if (W.id !== 'f2') return {f: 'f2'};
  const order = [['governance', 'griffel'], ['culture', 'vonk'], ['capacity', 'mallow'], ['infrastructure', 'wolk']];
  let best = null, bd = 1e9;
  for (const [id, npc] of order) { if (G.flags[`steen:${id}`]) continue; const e = ent(npc); if (!e) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = npc; } }
  return best ? {e: best} : {e: 'biglift'};
}

// ---- collectible milestones ----
ON.afterItem = id => {
  if (id.startsWith('halluc:')) {
    startQuest('hallucs', true);
    if (G.hallucs.length === 6 && !G.flags.lampBright) { G.flags.lampBright = true; UI.toast('De Toetslamp brandt feller', 'Zes hallucinaties ontmaskerd. Pip: ‘Ik zie nu al van verder wat niet klopt!’ Je onthulling reikt verder.', 'good'); }
    if (G.hallucs.length >= 12 && stage('hallucs') < 1) {
      setStage('hallucs', 1);
      UI.pip('Alle twaalf! Weet je wat? Neem dit. Ik heb het tweehonderd jaar bewaard voor iemand die écht kijkt.');
      giveItemLater('kristal:4');
    }
  }
  if (id.startsWith('card:')) { startQuest('kaartjes', true); if (G.cards.length >= 8) setStage('kaartjes', 1); }
  // Kantoorvondsten, vergaderbingo and the achievements that follow from what you carry
  onItem(id);
};
// give an item from inside another item's handler, after it has finished
const giveItemLater = id => setTimeout(() => ON.give?.(id), 400);
ON.totals = {hallucs: HALLUCS.length, cards: CARDS.length, crystals: 4};
ON.hallucList = HALLUCS;
ON.cardList = CARDS;

// ---- coffee corners: pause, save, heal, travel ----
const COFFEE = ['Je drinkt een bekertje automatenkoffie. Het smaakt naar karton en vastberadenheid.', 'Koffie. Even niks. Het Gewelf wacht wel.', '‘Koffie verkeerd’ zegt de knop. Dat is het enige hier dat eerlijk is over wat het is.', 'Een collega heeft een briefje op de automaat geplakt: ‘Niet aankomen, hij is gevoelig’.', 'Pip warmt zijn handjes aan je beker. Hij heeft geen handjes.'];
ON.use.coffee = k => {
  healPlayer(999);
  if (!G.coffee.includes(k.key)) {
    G.coffee.push(k.key);
    (G.coffeeList ||= []).push({key: k.key, floor: W.id, x: k.x + Math.sin(k.group.rotation.y) * 1.6, z: k.z + Math.cos(k.group.rotation.y) * 1.6, yaw: k.group.rotation.y, name: k.def.name || W.L.zoneAt(k.tx, k.tz).name || 'Koffiehoek'});
    UI.toast('Koffiehoek gevonden', 'Hier kun je voortaan naartoe reizen vanaf de kaart (M).', 'good');
  }
  G.lastCoffee = {floor: W.id, x: k.x + Math.sin(k.group.rotation.y) * 1.6, z: k.z + Math.cos(k.group.rotation.y) * 1.6, yaw: k.group.rotation.y};
  saveGame();
  SFX.play('coffee');
  UI.toast('Pauze', `${COFFEE[(G.stats.coffee = (G.stats.coffee || 0) + 1) % COFFEE.length]} Vertrouwen hersteld, voortgang bewaard.`, 'good');
  onCoffee();
};

ON.deathLine = () => ['Hela. Je vertrouwen was op, dus ik heb je teruggebracht naar de koffie. Wat je al wist, ben je niet kwijt.', 'Even bijkomen bij de automaat. Probeer het andere gereedschap eens: kijk wat een monster zwak maakt.', 'Terug bij de koffie. Weet je dat je kunt wegduiken met Spatie?', 'Ik heb je teruggebracht. Als het te pittig is: in het menu staat de moeilijkheid ‘Verhaal’ of ‘Rustig’.'][G.stats.deaths % 4];

// ---- Pip's hints (H) ----
ON.hint = () => {
  const m = stage('main');
  if (m === 4) return 'Zie je die gouden muur? Druk op R, of klik met de rechtermuisknop. Wat niet echt is, verdwijnt in mijn licht.';
  if (m === 6) return `Drie stemmen: mevrouw Bakker, Ilse van het KCC en Glans. Ik denk dat ze in de wijnkelder, het klachtenarchief en de gang naar het westen zitten. (${heardCount('necessity')}/3)`;
  if (m === 9) return 'Al dat glimmen houdt je licht tegen. Ga dichtbij staan, laat het licht openbarsten (R) en schiet dan snel met de Toetslamp (1).';
  if (m === 11) return 'Elke vleugel heeft een hoeder en een proef. Doe de proef, praat met de hoeder, kies de maatregelen. Dan krijg je de fundamentsteen.';
  if (m === 12) return 'De Haastkoning stormt op je af. Duik opzij (Spatie) en geef hem bedenktijd met de Weegschaal (2). Als hij duizelt, raak je hem hard.';
  if (m === 14) return 'Elk domein rond de galerij heeft een proef en een hoeder. Wie je helpt, geeft je een sleutel. Je hebt er zeven nodig, er zijn er negen.';
  if (m === 18) return 'Drie fasen: toets zijn bronnen (R en 1), weeg welke Fabulant echt is (2), en begrens wat hij mag (3).';
  return null;
};

// ---- journal tabs: the dossier and the sources ----
JOURNAL_TABS.splice(1, 0,
  {id: 'dossier', name: 'Dossier', render(body) {
    body.append(el('p', {class: 'prose', style: 'margin-top:0;font-size:17px', text: 'Elke kamer van het raamwerk komt in het dossier: stevig als je alle passende maatregelen koos en geen averechtse, open als er nog iets ontbreekt, een blinde vlek als je er nooit bent geweest. In de Zegelkamer laat het dossier zien welk besluit het kan dragen.'}));
    for (const [title, ids] of [['Noodzaak', ['necessity']], ['Fundamenten', FOUNDATIONS], ['Domeinen', DOMAINS]]) {
      body.append(el('h3', {class: 'label', style: 'margin:14px 0 8px', text: title}));
      const grid = el('div', {class: 'dgrid'});
      for (const id of ids) {
        const c = CHAMBER[id], st = chamberState(id), last = G.chambers[id]?.attempts?.at(-1);
        grid.append(el('div', {class: `dcell ${st} ${CRITICAL.includes(id) ? 'crit' : ''}`}, el('b', {text: c.title}), el('span', {class: 'st', text: STATE_LABEL[st]}),
          el('span', {style: 'font-size:13px;color:var(--dim);font-family:var(--f-body)', text: last ? `${last.selection.length} maatregel${last.selection.length === 1 ? '' : 'en'} gekozen${last.missing.length ? `, ${last.missing.length} passende gemist` : ''}${last.unsuitable.length ? `, ${last.unsuitable.length} averechts` : ''}.` : G.flags[`trial:${id}`] ? 'Proef gedaan, nog niet besloten.' : 'Nog niet onderzocht.'})));
      }
      body.append(grid);
    }
    body.append(el('p', {class: 'label', style: 'margin-top:12px', text: '★ = kritisch domein voor een assistent die inwonersvragen beantwoordt'}));
  }},
  {id: 'bronnen', name: 'Bronnen', render(body) {
    body.append(el('p', {class: 'label', style: 'margin:0 0 10px', text: `${G.bronnen.length} van 45 bronnen gevonden. Ze helpen je kiezen bij de hoeders.`}));
    for (const c of CHAMBERS) {
      const list = el('div', {class: 'bronlist'});
      for (const k of c.clues) {
        const got = G.bronnen.includes(`${c.id}:${k.id}`);
        list.append(el('button', {class: `bron ${got ? '' : 'locked'}`, onclick: () => got && UI.read(k.title, clueHtml(k))}, el('b', {text: got ? k.title : 'Nog niet gevonden'}), got ? el('p', {text: k.body}) : null));
      }
      body.append(el('h3', {class: 'label', style: 'margin:14px 0 8px', text: c.title}), list);
    }
  }},
);

// ---- the opening ----
ON.start = {floor: 'f0', at: 'start'};
ON.newGame = () => scene(async () => {
  const name = heroName('');
  await say('nar', 'Maandag, 8:57. Gemeente Dalwijk.');
  await say('nar', `Je eerste werkdag als adviseur Dienstverlening.${name ? ` Op de deur hangt al een papiertje met ‘${name}’ erop, met plakband.` : ''} Op je bureau ligt een envelop met het gemeentewapen erop.`);
  UI.toast('Zo beweeg je', IS_TOUCH
    ? 'Stick: lopen · rechts slepen: rondkijken · E: praten en gebruiken · ✦: gereedschap'
    : 'WASD lopen · muis kijken (klik in de wereld) · E gebruiken · V wisselt eerste en derde persoon', 'quest');
  if (IS_TOUCH && innerHeight > innerWidth) UI.toast('Tip', 'Draai je telefoon een kwartslag: dan zie je meer van het Gewelf.', 'quest');
});
void choose; void esc; void ent; void startQuest;
