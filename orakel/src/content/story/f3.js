// Diepte 3 · De Galerij der Domeinen.
// Nine guardians and their keys, Wouter and the bridge, Mevrouw Bakker at last finding a human,
// Glans getting nervous, and the small things: Bram counting to ten, Noor's bell, Kees's fifth alarm clock.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {stage, setStage} from '../../game/quests.js';
import {say, choose, scene, wait} from '../../game/dialogue.js';
import {giveItem} from '../../game/game.js';
import {decide} from '../../ui/decision.js';
import {setupSort, restoreSort, setupJudge, setupSequence, setupLevers, completeTrial, trialDone, heard, heardCount} from '../puzzles.js';
import {CHAMBER} from '../framework.js';
import {BRIDGE_KEYS} from '../items.js';
import {keysCount} from './common.js';
import {shortcut} from './f0.js';
import {formal} from '../../game/hero.js';
import {rel, relOf, met, choice, chose, findSecret, archOpt} from './systems.js';

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = list => list[G.stats.steps % list.length];
const posts = (id, n = 4) => Array.from({length: n}, (_, i) => `${id}_post${i}`);
const seq = id => CHAMBER[id].trial.steps.map((_, i) => `${id}_q${i}`);
const shown = opts => opts.filter(o => o.if === undefined || o.if);
async function chat(c, opts, bye = 'Ik ga verder.') {
  const list = shown(opts);
  if (!list.length) return;
  const i = await choose([...list, bye]);
  if (i < list.length) await list[i].run(c);
}

setupJudge('quality', posts('quality'));
setupJudge('evaluation', posts('evaluation'));
setupJudge('functionality', posts('functionality'));
setupSequence('compliance', seq('compliance'));
setupSequence('interaction', seq('interaction'));
setupLevers('performance', CHAMBER.performance.trial.levers.map((_, i) => `performance_l${i}`), {onChange: () => queueBoard()});
setupSort('sustainability', 'duur');

function queueBoard() {
  const b = ent('wachtrij');
  if (!b) return;
  const n = CHAMBER.performance.trial.levers.filter((lv, i) => ent(`performance_l${i}`)?.state === lv.correct).length;
  b.refresh(`Wachtrij: ${['4.096', '2.048', '512', '64', '0 · het stroomt!'][n]}`);
}

ON.floor.f3 = () => {
  if (stage('main') === 13) {
    setStage('main', 14, true);
    scene(async () => {
      await say('pip', 'De Galerij der Domeinen. Kijk die kloof! Daar beneden ligt de Drempel, en daarachter de Kern.', {mood: 'surprised'});
      await say('pip', 'Rond de galerij liggen de domeinen: wat moet een toepassing kunnen, en wat mag hij niet? Kwaliteit, ethiek, beveiliging, en nog zes.', {mood: 'thinking'});
      await say('pip', 'Zie je die man bij de brug? Praat eerst met hem.', {mood: 'neutral'});
      setStage('main', 14);
    });
  }
  const paal = ent('brugpaal'); if (paal) paal.def.count = () => Math.min(7, keysCount());
  const oven = ent('oven'); if (oven) oven.def.heat = () => 1 - CHAMBER.sustainability.trial.items.filter((_, i) => G.flags[`placed:duur:${i}`]).length / 4;
  queueBoard();
  restoreSort('duur');
  if (G.flags.bridge_built) for (let z = 22; z <= 44; z++) ent(`brug${z}`)?.onReveal(37 * 2 + 1, z * 2 + 1, 2);
};

// ---- a domain guardian: hello, the trial, the decision, a key for the bridge ----
// chat: () => [{t, if, run}], extra questions (one per archetype is enough) shown while you wait and afterwards
function guardian(id, npc, {hello, after, pip, waiting, react, chat: extra = () => []}) {
  ON.talk[npc] = () => async c => {
    if (once(`${npc}_met`)) {
      for (const l of hello) await say(c, ...(Array.isArray(l) ? [l[0], {mood: l[1]}] : [l]));
      if (after) await after(c);
      await say(c, CHAMBER[id].trial.intro);
      if (pip) await say('pip', pip);
      return;
    }
    if (!trialDone(id)) { await say(c, waiting(), {mood: 'thinking'}); return chat(c, extra()); }
    if (!G.keys[`brug_${id}`]) {
      await say(c, CHAMBER[id].trial.done || 'De proef is gedaan.', {mood: 'happy'});
      await say(c, CHAMBER[id].scenario);
      const st = await decide(id, {who: npc});
      await say(c, react[st], {mood: st === 'strong' ? 'happy' : st === 'open' ? 'thinking' : 'sad'});
      await say(c, `Neem deze sleutel mee voor de brug: ${BRIDGE_KEYS[id]}. En deze bron, voor je dossier.`, {mood: 'neutral'});
      giveItem(`key:brug_${id}`); giveItem(`bron:${id}:c`);
      if (keysCount() >= 7 && stage('main') === 14) { setStage('main', 15); UI.pip('Zeven sleutels! Terug naar Wouter, bij de brug.'); }
      else if (keysCount() >= 9) UI.pip('Negen sleutels! Alle negen. Wouter gaat dit niet geloven.');
      else if (stage('main') === 14) UI.toast('Sleutels voor de brug', `${keysCount()} van de 7`, 'quest');
      return;
    }
    await say(c, 'Wil je je afweging herzien? Het dossier onthoudt alleen je laatste keuze.', {mood: 'neutral'});
    const list = shown(extra());
    const i = await choose(['Ja, opnieuw afwegen.', ...list, 'Nee, ik ga verder.']);
    if (i === 0) await decide(id, {who: npc});
    else if (i <= list.length) await list[i - 1].run(c);
  };
}
const judged = id => CHAMBER[id].trial.items.filter((_, i) => G.flags[`judged:${id}:${i}`]).length;
// one question per archetype and guardian: the Handhaver wants a signature, the Datatovenaar the numbers,
// the Archivaris knows the old procedure, the Verbinder asks how the guardian is doing
const ask = (arch, flag, text, lines) => ({...archOpt(arch, text, !G.flags[flag]), run: async c => { G.flags[flag] = true; for (const [l, mood] of lines) await say(c, l, {mood}); }});

guardian('quality', 'bep', {
  hello: [['Welkom in de Bibliotheek van Bijna Waar. Hier staat alles wat het Orakel ooit heeft beweerd.', 'happy'], ['Ik heb twee officiële antwoorden op dezelfde vraag. Ze spreken elkaar tegen. Ik heb ze alvast allebei ingelijst.', 'smug'], ['De antwoorden hangen in de alkoven. Pas op: niet elke kast is een kast, en niet elke vloer ontbreekt echt.', 'worried']],
  pip: 'Boekenkasten die net te mooi glanzen, en een kloof waar een brug zou moeten liggen. Laat het licht openbarsten (R) en kijk wat echt is.',
  waiting: () => `Je hebt ${judged('quality')} van de vier antwoorden getoetst. De rest hangt achter wat niet echt is.`,
  react: {strong: 'Eindelijk iemand die bronnen controleert in plaats van ze in te lijsten.', open: 'Goed begin. Maar een bron tonen is nog geen bron toetsen.', blind: 'Dan lijst ik dit gesprek ook maar in. Naast de andere twee.'},
  chat: () => [ask('datatovenaar', 'bep_cijfers', 'Hoeveel van die ingelijste antwoorden kloppen eigenlijk?', [['Ik heb het geteld. Van de 212 kloppen er 71.', 'sad'], ['Die 71 hangen in de kleinste lijstjes. Waarheid is meestal wat bescheidener.', 'thinking']])],
});
guardian('evaluation', 'mira', {
  hello: [['Mira, meetmeester. Ik heb een meetlat van drie meter.', 'smug'], ['Alleen meet niemand het goede ding. Het bestuur meet snelheid, de vakexperts meten juistheid, en de techniek meet zichzelf.', 'tired']],
  waiting: () => `${judged('evaluation')} van de vier meetpalen beoordeeld.`,
  react: {strong: 'Een testset, en meten in proef, pilot én productie. Ik ga een nieuwe meetlat kopen. Een kleinere.', open: 'Bijna. Maar wie is er eigenaar van de cijfers?', blind: 'Niet meten is ook een keuze. Een slechte, maar een keuze.'},
  chat: () => [ask('handhaver', 'mira_teken', 'Wie tekent er straks voor die cijfers?', [['Tekenen? Ik meet. Tekenen doet de stuurgroep.', 'smug'], ['De stuurgroep meet niet. Zo houden we elkaar in evenwicht. Niemand valt om, want niemand staat.', 'laugh']])],
});
guardian('functionality', 'kees', {
  hello: [['Kees, klokkenmaker. Ik heb drie afsprakenkaartjes en vier boze wekkers: ergens is iets verkeerd verplaatst.', 'worried'], ['De assistent zegt bij elke afspraak ‘geregeld!’. Ook als het niet geregeld is.', 'angry']],
  waiting: () => `${judged('functionality')} van de vier bonnetjes gecontroleerd.`,
  react: {strong: '‘Geregeld’ alleen als het systeem het bevestigt. Mijn wekkers lopen weer gelijk.', open: 'Bijna. Maar wat doet de assistent als hij twijfelt welke afspraak bedoeld is?', blind: 'Dan zet ik de wekkers maar op ‘ongeveer’.'},
  chat: () => [
    {t: 'Wat tikt er eigenlijk in je vestzak, Kees?', if: !G.secrets.includes('vijfde_wekker'), run: async c => {
      await say(c, 'In mijn vestzak?', {mood: 'surprised'});
      await say('nar', 'Kees voelt in zijn vestzak en haalt er een kleine koperen wekker uit. Hij tikt. Hij loopt twaalf jaar voor.');
      await say(c, 'De vijfde wekker. Ik zocht vier boze wekkers, en de vijfde zat al die tijd bij mij.', {mood: 'laugh'});
      await say(c, 'Twaalf jaar voor. Volgens deze wekker ben ik al met pensioen. Dat verklaart waarom ik zo moe ben.', {mood: 'tired'});
      findSecret('vijfde_wekker');
    }},
    ask('archivaris', 'kees_boek', 'Vroeger stond elke afspraak gewoon in het afsprakenboek.', [['Het afsprakenboek! Met potlood! Als er iets verschoof, zag je de gum.', 'happy'], ['Tegenwoordig verschuift alles zonder gum. Dan weet je niet eens dát het verschoven is.', 'sad']]),
  ],
});
guardian('compliance', 'otto', {
  hello: [['Hoe-hoe. Otto, archiefuil. Ik heb een indrukwekkende goedkeuringsstempel. Kijk maar.', 'smug'], ['Helaas hoort hij bij een heel andere proef. Die van vorig jaar, met alleen openbare informatie. Nu willen ze er persoonlijke dossiers aan koppelen.', 'worried']],
  after: async c => {
    await say(c, 'Hoe-hoe. Maar eerst: we moeten dit integraal bekijken.', {mood: 'thinking'});
    await say(c, 'Integraal. Dat zeg ik bij alles. Dan lijkt het alsof ik het overzicht heb.', {mood: 'smug'});
    giveItem('bingo:integraal');
  },
  waiting: () => 'Open de laden in de volgorde van een goede herbeoordeling. Begin bij het begin: waarvoor, en met welke gegevens?',
  react: {strong: 'Een nieuwe beoordeling voor een nieuw doel. Mijn oude stempel mag eindelijk met pensioen.', open: 'Hoe-hm. Er ontbreekt nog een la. Een stempel is geen vrijbrief.', blind: 'Dan stempel ik maar wat. Dat deed ik vorig jaar ook.'},
  chat: () => [ask('archivaris', 'otto_laden', 'De oude procedure had zeven laden. Waarom nu vier?', [['Hoe-hoe! Jij kent de zeven laden!', 'surprised'], ['Drie zijn er wegbezuinigd. Ze zitten nog in de kast, maar niemand mag ze opentrekken. Daar is geen procedure voor.', 'smug']])],
});
guardian('interaction', 'noor', {
  hello: [['Welkom bij de Balie van de Tweede Kans! Ik ben Noor.', 'happy'], ['Mijn balie zegt steeds ‘ik begrijp u’. De bezoeker zou liever eindelijk verder kunnen.', 'tired']],
  after: async c => { if (G.flags.tickets === 999) await say(c, 'O, en u bent toch nummer 999? Dan bent u de laatste. Daar heb ik een stoel voor.', {mood: 'laugh'}); },
  pip: 'Vier bellen, vier stappen van een goed gesprek. Luid ze in de goede volgorde. Fout? Dan begin je opnieuw.',
  waiting: () => 'Luid de bellen in de volgorde van een goed gesprek. Begin met eerlijk zijn over wat de assistent is.',
  react: {strong: 'Eerlijk, doorvragen, een mens erbij, en laten zien wat er meegaat. Zo heet mijn balie eindelijk terecht ‘tweede kans’.', open: 'Bijna. Maar weet de inwoner wat er met zijn gesprek gebeurt?', blind: 'Ik begrijp u. Grapje.'},
  chat: () => [
    {t: 'Druk op de bel van de balie.', if: !G.secrets.includes('tweede_kans'), run: counterBell},
    ask('verbinder', 'noor_hoe', 'En hoe gaat het met jóú, Noor? Al die mensen die boos zijn op de balie.', [['Met mij? Het gaat. Ze zijn niet boos op mij. Ze zijn boos op de balie.', 'sad'], ['Alleen ben ik de balie. Dat is het lastige.', 'tired'], ['Dank je dat je het vraagt. Dat staat niet in mijn gespreksregels, en toch is het de beste vraag van vandaag.', 'happy']]),
  ],
});
guardian('performance', 'bram', {
  hello: [['Bram, postkobold. Ik tel de wachtrij.', 'neutral'], ['Bij duizend ben ik opnieuw begonnen. Voor mijn gemoedsrust.', 'tired']],
  waiting: () => 'Zet de vier hendels goed. Kijk op het bord: als de wachtrij op nul staat, stroomt het.',
  react: {strong: 'Licht waar het kan, zwaar waar het moet, en monitoring aan. Ik kan eindelijk tot tien tellen en dan stoppen.', open: 'De rij is korter. Maar zie je de volgende piek aankomen?', blind: 'Dan tel ik verder. Vierduizend zesennegentig, vierduizend zevenennegentig…'},
  chat: () => [
    {t: 'Kun je tot tien tellen en dan stoppen?', if: trialDone('performance') && !G.secrets.includes('tien_tellen'), run: async c => {
      await say(c, 'Tot tien. En dan… stoppen?', {mood: 'worried'});
      await say(c, 'Een. Twee. Drie. Vier. Vijf. Zes. Zeven. Acht. Negen. Tien.', {mood: 'thinking'});
      await say('nar', 'Bram houdt zijn adem in. Er komt geen elf.');
      await say(c, 'Ik ben gestopt. Ik ben gewoon… gestopt.', {mood: 'surprised'});
      await say('nar', 'Er rolt een traan over zijn wang. Hij veegt hem weg met een postzak.');
      await say(c, 'Sorry. Het is heel lang geleden dat ik ergens mee klaar was.', {mood: 'sad'});
      findSecret('tien_tellen');
    }},
    ask('datatovenaar', 'bram_piek', 'Hoe lang duurt zo’n piek gemiddeld?', [['Elf minuten. Altijd om 9:01, als iedereen tegelijk koffie heeft en een vraag.', 'thinking'], ['Om 9:12 is het voorbij. Om 9:13 vraagt iemand waarom het om 9:01 zo traag was.', 'tired']]),
  ],
});
guardian('sustainability', 'sien', {
  hello: [['Stoker Sien. Ik bak broodjes op de modelmachine.', 'happy'], ['Maar ik vraag me af waarom openingstijden zoveel warmte opleveren.', 'thinking']],
  pip: 'Pak een vraagkaartje op en leg het in de goot die past: zoekfunctie, klein model of groot model.',
  waiting: () => 'Elke vraag in de goot die past. De machine laat het merken als het klopt: hij wordt koeler.',
  react: {strong: 'Voel je dat? Koel. En de antwoorden zijn er niet slechter op. Mijn broodjes wel, maar dat is een ander verhaal.', open: 'Het is al koeler. Maar meet je ook wat het kost per geholpen inwoner?', blind: 'Dan stook ik maar door. Wie wil er een broodje?'},
  chat: () => [ask('verbinder', 'sien_moe', 'Word je niet moe van al die warmte, Sien?', [['Moe? Ik stook al zeventien jaar.', 'smug'], ['Maar het is fijn dat je het vraagt. Wil je een broodje? Het is een beetje verbrand. Zoals ik.', 'laugh']])],
});
guardian('security', 'slotje', {
  hello: [['Klik. Klak. Slotje, boekenwachter.', 'neutral'], ['Er kwam een bijlage binnen die heel beleefd om de sleutel van alle dossiers vroeg. Ik had bijna ja gezegd. Hij was zó beleefd.', 'worried'], ['Nu kruipen er fluisteraars uit. En er is iets groots. Het lekt.', 'angry']],
  pip: 'De Lekkende Hydra! Toets de koppen met de Toetslamp (1), en zegel de stomp meteen dicht met het Zegel (3), anders groeit hij terug.',
  waiting: () => 'Zolang het lek leeft, kan ik niets sluiten. Houd het tegen!',
  react: {strong: 'Minimale rechten, begrensde tools en wantrouwen tegen elke bijlage. Klik. Klak. Dicht.', open: 'Bijna dicht. Maar een regel in de systeemprompt is geen slot.', blind: 'Dan laat ik de deur maar op een kier. Zoals altijd.'},
  chat: () => [ask('handhaver', 'slotje_wie', 'Wie heeft die bijlage eigenlijk doorgelaten?', [['Ik. Klik.', 'sad'], ['Hij zei ‘alstublieft’. Niemand zegt hier ooit alstublieft. Ik was er niet op voorbereid.', 'worried']])],
});
guardian('ethics', 'linde', {
  hello: [['Ik ben Linde. Mijn luisterhoorns verstaan keurige volzinnen prima.', 'neutral'], ['Maar juist wie het hardst hulp nodig heeft, valt erdoorheen. Een korte vraag. Een spelfout. Paniek.', 'sad']],
  pip: 'Drie hoorns, in de hoeken van de zaal. Luister naar alle drie.',
  waiting: () => `Je hebt ${heardCount('ethics')} van de drie stemmen gehoord.`,
  react: {strong: 'Je hebt de lege stoel aan tafel gezien. Dat is het begin van gelijke behandeling.', open: 'Je luistert. Maar hebben de mensen die moeten controleren daar ook tijd voor?', blind: 'Dan blijft de stoel leeg.'},
  chat: () => [ask('verbinder', 'linde_hoe', 'Wie luistert er eigenlijk naar jóú, Linde?', [['Naar mij?', 'surprised'], ['De hoorns, denk ik. Die geven altijd antwoord. Meestal ‘wat zegt u?’', 'laugh']])],
});

// ---- Noor's bell: press it often enough and someone answers ----
const BELL = ['Ik begrijp u.', 'Ik begrijp u.', 'Ik begrijp u. Echt.', 'Ik begrijp u. Uw bel is belangrijk voor ons.', 'Ik begrijp u.', 'Ik begr… Ik begrijp u.', 'U belt nu zeven keer. Ik begrijp u zeven keer.', 'Ik begrijp u. Mijn collega begrijpt u ook. Ze is er alleen niet.', 'Ik… begrijp… u.'];
async function counterBell(c) {
  for (;;) {
    const n = G.flags.noorBel = (G.flags.noorBel || 0) + 1;
    SFX.play('bell', n);
    if (n >= 10) {
      await say(c, 'Ik begrijp u.', {mood: 'neutral'});
      await say(c, 'Grapje. Waarmee kan ik u helpen?', {mood: 'laugh'});
      findSecret('tweede_kans');
      return;
    }
    await say('nar', `Ping! (${n})`);
    await say(c, BELL[n - 1], {mood: n < 5 ? 'neutral' : n < 8 ? 'tired' : 'smug'});
    if (n === 5) await say('pip', 'Je weet dat dit niet sneller gaat, hè?', {mood: 'laugh'});
    if (await choose(['Druk nog een keer.', 'Laat maar.']) === 1) return;
  }
}

// ---- puzzles with a story ----
CHAMBER.ethics.trial.witnesses.forEach((v, i) => {
  ON.use[`hoorn${i}`] = () => scene(async () => {
    await say('nar', 'Je drukt je oor tegen de koperen hoorn. Ver weg, door het geruis, klinkt een stem.');
    await say(v.name, v.line);
    if (heard('ethics', i)) { const h = ent(`hoorn${i}`); if (h) h.def.heard = true; }
  });
});
ON.cleared.boss_hydra = () => { completeTrial('security'); scene(async () => { await say('pip', 'De Hydra is leeg. Alle lekken zijn dicht. Ga naar Slotje!', {mood: 'happy'}); }); };
ON.trialDone.interaction = () => { UI.pip('De bellen klinken als een goed gesprek. Kijk, de balie draait geen rondjes meer.'); if (stage('bakker') === 1) helpBakker(); };
ON.trialDone.sustainability = () => UI.pip('De modelmachine koelt af. Hoor je hem zuchten van opluchting?');
ON.trialDone.performance = () => UI.pip('Het stroomt weer! En dankzij de monitoring zien we de volgende piek aankomen.');
for (const id of ['quality', 'evaluation', 'functionality', 'compliance', 'ethics']) ON.trialDone[id] = () => UI.pip(`Proef gedaan. Terug naar ${{quality: 'Bep', evaluation: 'Mira', functionality: 'Kees', compliance: 'Otto', ethics: 'Linde'}[id]}.`);

// ---- the jokes on the shelves ----
ON.use.burgemeestersboek = async s => {
  await UI.read(s.def.title, s.def.text);
  UI.pip(G.flags.eend ? 'Een pootafdruk. Met zwemvliezen. Ik zeg niks. Ik denk alleen heel hard aan hallucinatie nummer drie.' : 'Een pootafdruk. Met zwemvliezen. In het boek van de burgemeesters. Ik zeg niks.');
};
ON.use.zaadzakje = () => UI.toast('Proeftuin', 'Aan de ezel hangt een zakje zaad: ‘Proeftuin AI · zaaien in Q1, oogsten in Q7’. Op de achterkant: ‘Niet gieten zonder evaluatieplan.’');
ON.use.printer3 = () => scene(async () => {
  await say('nar', G.flags.printer_ok ? 'Een printer, hier in de Postkamer. Het lampje is groen. Hij lijkt het te doen. Op het schermpje staat: ‘PAPIERSTORING IN LADE 2.’' : 'Een printer, hier in de Postkamer. Het schermpje knippert: ‘PAPIERSTORING IN LADE 2.’');
  await say('pip', G.secrets.includes('printer') ? 'Niet elke printer is die van Reprografie. Sommige printers willen gewoon niet. En dat moet je respecteren.' : 'Er zit geen lade 2 in. Ik heb gekeken.', {mood: 'laugh'});
});

// ---- Mevrouw Bakker, stuck at the counter ----
ON.talk.bakker3 = () => async c => {
  if (stage('bakker') < 1) setStage('bakker', 1);
  if (stage('bakker') >= 2) { await say(c, pick(['Ik heb een mens gesproken. Twee zelfs: u, en die aardige kabouter. Mijn dag kan niet meer stuk.', 'Mijn vergunning is gewoon geldig. Tot volgend jaar. Niet tot het jaar drieduizend.', 'Ik fluit de wachtmuziek nog. Uit gewoonte. Maar nu klinkt hij vrolijker.']), {mood: 'happy'}); return; }
  await say(c, 'Daar bent u weer! Kijk nou. Ik heb eindelijk een balie gevonden.', {mood: 'happy'});
  await say(c, '‘Ik begrijp u,’ zegt dat ding. Al twintig minuten. Ik wil alleen weten of mijn parkeervergunning nog geldig is!', {mood: 'angry'});
  if (trialDone('interaction')) return helpBakker();
  await say('pip', 'Die balie draait rondjes. Als we de bellen in de goede volgorde luiden, krijgt ze vast een tweede kans.', {mood: 'thinking'});
};
function helpBakker() {
  scene(async () => {
    await say('noor', 'Mevrouw, ik ben een assistent. Ik kan u uitleggen wat ik weet, maar over uw vergunning beslist een mens.', {mood: 'neutral'});
    await say('noor', 'Ik zet u door naar een collega. Uw vraag en uw kenteken gaan mee; hier ziet u precies wat ik doorstuur.', {mood: 'happy'});
    if (G.flags.bakker_2009) {
      await say('bakker3', 'Zeg er dan meteen bij dat mijn vergunning onder de regeling van 2009 valt. Dat wist de nieuwe ook.', {mood: 'smug'});
      await say('noor', 'De regeling van 2009… Klopt. Die geldt gewoon nog. Uw vergunning is geldig. Ik zet het erbij, dan hoeft mijn collega niet te zoeken.', {mood: 'happy'});
    }
    await say('bakker3', 'Een mens! Eindelijk. Ziet u wel. Het kan best.', {mood: 'happy'});
    const b = chose('bakker_belofte');
    if (b === 'belofte') await say('bakker3', 'U had het beloofd. En u bent gekomen.', {mood: 'happy'});
    else if (b === 'stellig') await say('bakker3', 'U zei vrijdag. Het is nog niet eens vrijdag. U bent zelfs te vroeg, lief kind.', {mood: 'laugh'});
    else if (b === 'eerlijk') { await say('bakker3', 'U had niets beloofd. En toch staat u hier. Dat vind ik eigenlijk nog mooier.', {mood: 'happy'}); rel('bakker', 1, {silent: true}); }
    if (G.flags.bakker_kleinkinderen) await say('bakker3', 'Zondag komen de kleinkinderen. Met de auto. Ik ga taart bakken. Voor de zekerheid twee.', {mood: 'laugh'});
    setStage('bakker', 2);
  });
}

// ---- Wouter and the bridge of seven keys (or nine) ----
const wouterExtra = () => [
  ask('verbinder', 'wouter_hoelang', 'Hoe lang sta je hier al, Wouter?', [['Elf jaar.', 'thinking'], ['Er kwam nooit iemand met sleutels. Wel veel mensen met een folder.', 'sad']]),
  {t: 'Er ligt een steen onder je sleutelpaal. Van opa Joop.', if: G.secrets.includes('opa_d3') && !G.flags.wouter_opa, run: async c => {
    G.flags.wouter_opa = true;
    await say(c, 'Die steen? Dat heb ik van opa Joop. ‘Een brug waar je niet af kunt, is een val.’', {mood: 'happy'});
    await say(c, 'Hij bouwde de eerste brug hier. Van touw. Met een leuning aan twee kanten, zodat je ook terug kon.', {mood: 'thinking'});
    rel('wouter', 1, {silent: true});
  }},
];
ON.talk.wouter = () => async c => {
  const n = keysCount();
  if (once('wouter_met')) {
    await say(c, 'Wouter, brugwachter. Ik heb de toegangssleutel van deze brug. Maar de leverancier heeft alle brugdelen vastgelijmd. In zijn eigen formaat.', {mood: 'tired'});
    await say(c, CHAMBER.sovereignty.hook, {mood: 'thinking'});
    await say(c, 'Om over te steken heb je de sleutels van de uitweg nodig: brondata, prompts, evaluaties, het model, en meer. Zeven stuks.', {mood: 'neutral'});
    await say(c, 'De hoeders van de domeinen rond de galerij hebben ze. Wie je helpt, geeft je er een. Er zijn er negen; zeven is genoeg.', {mood: 'neutral'});
    await say('pip', 'Negen domeinen, zeven sleutels. Je mag kiezen wat je overslaat. Maar wat je overslaat, blijft een blinde vlek in het dossier.', {mood: 'thinking'});
    return;
  }
  if (n >= 9 && once('wouter_negen')) {
    await say(c, 'Negen? Je hebt ze alle negen?', {mood: 'surprised'});
    await say(c, 'Elf jaar sta ik hier. Zeven was het maximum, zeiden ze. Nu weet ik het: zeven is het minimum.', {mood: 'happy'});
    await say(c, 'Hier. Mijn reservehesje. Wie negen sleutels brengt, hoort bij de brug.', {mood: 'laugh'});
    rel('wouter', 1, {silent: true});
  }
  if (G.flags.bridge_built) { await say(c, pick(['De brug staat. En je kunt er ook weer áf. Dat is het hele punt.', 'Een brug waar je alleen op kunt, is een val.']), {mood: 'happy'}); return chat(c, wouterExtra()); }
  if (n < 7) { await say(c, `Je hebt ${n} van de zeven sleutels. De hoeders van de domeinen hebben de rest.`, {mood: 'neutral'}); return chat(c, wouterExtra()); }
  await say(c, 'Zeven sleutels! Laat zien.', {mood: 'surprised'});
  await say('nar', 'Je steekt de sleutels één voor één in de paal. Ze passen. Niet omdat ze van goud zijn, maar omdat ze van jou zijn.');
  completeTrial('sovereignty', {quiet: true});
  await say(c, CHAMBER.sovereignty.scenario);
  const st = await decide('sovereignty', {who: 'wouter'});
  await say(c, st === 'strong' ? 'Overdraagbaar, vervangbaar en geoefend. Nu is het een brug, en geen val.' : st === 'open' ? 'Hij staat. Maar heb je de overstap ook geoefend?' : 'Hij staat. Maar of je er ooit weer af kunt…', {mood: st === 'strong' ? 'happy' : 'thinking'});
  giveItem('bron:sovereignty:c');
  await buildBridge();
  setStage('main', 16);
};
async function buildBridge() {
  G.flags.bridge_built = true;
  SFX.play('tool');
  for (let z = 22; z <= 44; z++) { ent(`brug${z}`)?.onReveal(37 * 2 + 1, z * 2 + 1, 2); SFX.play('place'); await wait(0.08); }
  saveGame();
  UI.pip('De brug! Recht over de kloof. Aan de overkant gaat het naar beneden: de Drempel.');
}
ON.use.brugpaal = () => UI.pip(`De sleutelpaal: ${Math.min(7, keysCount())} van de zeven gaten gloeien. ${keysCount() >= 7 ? 'Praat met Wouter.' : 'De hoeders van de domeinen hebben de sleutels.'}`);
ON.use.opa3 = async s => {
  await UI.read(s.def.title, s.def.text);
  if (met('wouter') && once('opa3_wouter')) scene(async () => { await say('wouter', 'Die heb je gevonden? Dat heb ik van opa Joop. Hij bouwde de eerste brug.', {mood: 'happy'}); });
};

// ---- Glans, getting nervous ----
ON.talk.glans3 = () => async c => {
  if (once('glans3_met')) {
    await say(c, 'Psst. U daar. Mag ik eerlijk zijn? Even, tussen ons?', {mood: 'worried'});
    await say(c, 'Het Orakel beantwoordt nu ook vragen die niemand heeft gesteld. Ook over mij. Het zegt dat ik een eend ben.', {mood: 'sad'});
    await say(c, 'En de Snelle Lift stopt niet meer waar ik wil. Hij gaat alleen nog maar naar beneden.', {mood: 'worried'});
    if (relOf('glans') >= 2) {
      await say(c, `En, ${formal()}… ik ben bang dat het Orakel gelijk heeft. Over mij. Dat ik er een ben die alleen maar antwoordt.`, {mood: 'sad'});
      await say(c, 'Iemand die op elke vraag ‘ja, dat kan’ zegt. Omdat dat beter verkoopt dan ‘ik weet het niet’.', {mood: 'thinking'});
    }
    await say(c, 'Ik ga eens kijken in de Kern. Het is tenslotte mijn product. Min of meer.', {mood: 'thinking'});
    const k = await choose(['Ga niet alleen de Kern in.', 'Het is jouw product. Ga maar.']);
    if (k === 0) {
      await say(c, 'Niet alleen?', {mood: 'surprised'});
      await say(c, 'U bent de eerste klant die zich zorgen maakt om de accountmanager. Ik weet niet in welk vakje ik dat moet zetten.', {mood: 'happy'});
      await say(c, 'Ik ga toch. Maar ik ga met een beter gevoel.', {mood: 'thinking'});
      choice('glans_kern', {npc: 'glans', label: 'Glans en de Kern', text: 'Je zei tegen Glans: ga niet alleen de Kern in.', pick: 'samen'});
      rel('glans', 1);
    } else {
      await say(c, 'Precies. Mijn product. Mijn verantwoordelijkheid. Dat staat ook in artikel zeven.', {mood: 'smug'});
      await say(c, 'Of artikel acht. Ik heb het nooit helemaal uitgelezen.', {mood: 'worried'});
      choice('glans_kern', {npc: 'glans', label: 'Glans en de Kern', text: 'Je zei tegen Glans: het is jouw product, ga maar.', pick: 'alleen'});
      rel('glans', -1);
    }
    return;
  }
  const i = await choose(['Neem jij de Snelle Lift maar. Ik loop.', 'Wees voorzichtig in de Kern.', 'Kan ik toch nog die lift nemen?']);
  if (i === 2) return shortcut(c);
  await say(c, i === 0 ? 'Lopen. Ja. Dat schijnt ook te werken. Mensen doen het al eeuwen.' : 'Voorzichtig? Ik ben accountmanager. Voorzichtig is mijn tweede naam. Mijn eerste naam is Glans.', {mood: i === 0 ? 'thinking' : 'smug'});
};
ON.zone.bieb = () => UI.pip('De Bibliotheek van Bijna Waar. Ik vertrouw geen enkele kast hier.');
ON.zone.luisterzaal = () => UI.pip('De Luisterzaal. Pas op voor de schimmen; je ziet ze alleen als je goed kijkt. Of als mijn licht ze laat zien.');
ON.zone.fluister = () => UI.pip('Hoor je dat gefluister? ‘Geef ons de sleutels… heel beleefd… alstublieft…’');
ON.zone.overkant = () => UI.pip('De Overkant. Die kisten daar… ze kijken naar je. Vastzitkisten! Wie erin trapt, komt er moeilijk uit.');
void P; void W; void restoreSort; void Cap;
