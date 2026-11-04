// Diepte 3 · De Galerij der Domeinen.
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

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const posts = (id, n = 4) => Array.from({length: n}, (_, i) => `${id}_post${i}`);
const seq = id => CHAMBER[id].trial.steps.map((_, i) => `${id}_q${i}`);

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
      await say('pip', 'De Galerij der Domeinen. Kijk die kloof! Daar beneden ligt de Drempel, en daarachter de Kern.');
      await say('pip', 'Rond de galerij liggen de domeinen: wat moet een toepassing kunnen, en wat mag hij niet? Kwaliteit, ethiek, beveiliging, en nog zes.');
      await say('pip', 'Zie je die man bij de brug? Praat eerst met hem.');
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
function guardian(id, npc, {hello, pip, waiting, react, after}) {
  ON.talk[npc] = () => async c => {
    if (once(`${npc}_met`)) {
      for (const l of hello) await say(c, l);
      await say(c, CHAMBER[id].trial.intro);
      if (pip) await say('pip', pip);
      return;
    }
    if (!trialDone(id)) { await say(c, waiting()); return; }
    if (!G.keys[`brug_${id}`]) {
      await say(c, CHAMBER[id].trial.done || 'De proef is gedaan.');
      await say(c, CHAMBER[id].scenario);
      const st = await decide(id, {who: npc});
      await say(c, react[st]);
      await say(c, `Neem deze sleutel mee voor de brug: ${BRIDGE_KEYS[id]}. En deze bron, voor je dossier.`);
      giveItem(`key:brug_${id}`); giveItem(`bron:${id}:c`);
      if (keysCount() >= 7 && stage('main') === 14) { setStage('main', 15); UI.pip('Zeven sleutels! Terug naar Wouter, bij de brug.'); }
      else if (stage('main') === 14) UI.toast('Sleutels voor de brug', `${keysCount()} van de 7`, 'quest');
      return;
    }
    if (after) { await after(c); return; }
    await say(c, 'Wil je je afweging herzien? Het dossier onthoudt alleen je laatste keuze.');
    if (await choose(['Ja, opnieuw afwegen.', 'Nee, ik ga verder.']) === 0) await decide(id, {who: npc});
  };
}
const judged = id => CHAMBER[id].trial.items.filter((_, i) => G.flags[`judged:${id}:${i}`]).length;

guardian('quality', 'bep', {
  hello: ['Welkom in de Bibliotheek van Bijna Waar. Hier staat alles wat het Orakel ooit heeft beweerd.', 'Ik heb twee officiële antwoorden op dezelfde vraag. Ze spreken elkaar tegen. Ik heb ze alvast allebei ingelijst.', 'De antwoorden hangen in de alkoven. Pas op: niet elke kast is een kast, en niet elke vloer ontbreekt echt.'],
  pip: 'Boekenkasten die net te mooi glanzen, en een kloof waar een brug zou moeten liggen. Laat het licht openbarsten (R) en kijk wat echt is.',
  waiting: () => `Je hebt ${judged('quality')} van de vier antwoorden getoetst. De rest hangt achter wat niet echt is.`,
  react: {strong: 'Eindelijk iemand die bronnen controleert in plaats van ze in te lijsten.', open: 'Goed begin. Maar een bron tonen is nog geen bron toetsen.', blind: 'Dan lijst ik dit gesprek ook maar in. Naast de andere twee.'},
});
guardian('evaluation', 'mira', {
  hello: ['Mira, meetmeester. Ik heb een meetlat van drie meter.', 'Alleen meet niemand het goede ding. Het bestuur meet snelheid, de vakexperts meten juistheid, en de techniek meet zichzelf.'],
  waiting: () => `${judged('evaluation')} van de vier meetpalen beoordeeld.`,
  react: {strong: 'Een testset, en meten in proef, pilot én productie. Ik ga een nieuwe meetlat kopen. Een kleinere.', open: 'Bijna. Maar wie is er eigenaar van de cijfers?', blind: 'Niet meten is ook een keuze. Een slechte, maar een keuze.'},
});
guardian('functionality', 'kees', {
  hello: ['Kees, klokkenmaker. Ik heb drie afsprakenkaartjes en vier boze wekkers: ergens is iets verkeerd verplaatst.', 'De assistent zegt bij elke afspraak ‘geregeld!’. Ook als het niet geregeld is.'],
  waiting: () => `${judged('functionality')} van de vier bonnetjes gecontroleerd.`,
  react: {strong: '‘Geregeld’ alleen als het systeem het bevestigt. Mijn wekkers lopen weer gelijk.', open: 'Bijna. Maar wat doet de assistent als hij twijfelt welke afspraak bedoeld is?', blind: 'Dan zet ik de wekkers maar op ‘ongeveer’.'},
});
guardian('compliance', 'otto', {
  hello: ['Hoe-hoe. Otto, archiefuil. Ik heb een indrukwekkende goedkeuringsstempel. Kijk maar.', 'Helaas hoort hij bij een heel andere proef. Die van vorig jaar, met alleen openbare informatie. Nu willen ze er persoonlijke dossiers aan koppelen.'],
  waiting: () => 'Open de laden in de volgorde van een goede herbeoordeling. Begin bij het begin: waarvoor, en met welke gegevens?',
  react: {strong: 'Een nieuwe beoordeling voor een nieuw doel. Mijn oude stempel mag eindelijk met pensioen.', open: 'Hoe-hm. Er ontbreekt nog een la. Een stempel is geen vrijbrief.', blind: 'Dan stempel ik maar wat. Dat deed ik vorig jaar ook.'},
});
guardian('interaction', 'noor', {
  hello: ['Welkom bij de Balie van de Tweede Kans! Ik ben Noor.', 'Mijn balie zegt steeds ‘ik begrijp u’. De bezoeker zou liever eindelijk verder kunnen.'],
  pip: 'Vier bellen, vier stappen van een goed gesprek. Luid ze in de goede volgorde. Fout? Dan begin je opnieuw.',
  waiting: () => 'Luid de bellen in de volgorde van een goed gesprek. Begin met eerlijk zijn over wat de assistent is.',
  react: {strong: 'Eerlijk, doorvragen, een mens erbij, en laten zien wat er meegaat. Zo heet mijn balie eindelijk terecht ‘tweede kans’.', open: 'Bijna. Maar weet de inwoner wat er met zijn gesprek gebeurt?', blind: 'Ik begrijp u. Grapje.'},
});
guardian('performance', 'bram', {
  hello: ['Bram, postkobold. Ik tel de wachtrij.', 'Bij duizend ben ik opnieuw begonnen. Voor mijn gemoedsrust.'],
  waiting: () => 'Zet de vier hendels goed. Kijk op het bord: als de wachtrij op nul staat, stroomt het.',
  react: {strong: 'Licht waar het kan, zwaar waar het moet, en monitoring aan. Ik kan eindelijk tot tien tellen en dan stoppen.', open: 'De rij is korter. Maar zie je de volgende piek aankomen?', blind: 'Dan tel ik verder. Vierduizend zesennegentig, vierduizend zevenennegentig…'},
});
guardian('sustainability', 'sien', {
  hello: ['Stoker Sien. Ik bak broodjes op de modelmachine.', 'Maar ik vraag me af waarom openingstijden zoveel warmte opleveren.'],
  pip: 'Pak een vraagkaartje op en leg het in de goot die past: zoekfunctie, klein model of groot model.',
  waiting: () => 'Elke vraag in de goot die past. De machine laat het merken als het klopt: hij wordt koeler.',
  react: {strong: 'Voel je dat? Koel. En de antwoorden zijn er niet slechter op. Mijn broodjes wel, maar dat is een ander verhaal.', open: 'Het is al koeler. Maar meet je ook wat het kost per geholpen inwoner?', blind: 'Dan stook ik maar door. Wie wil er een broodje?'},
});
guardian('security', 'slotje', {
  hello: ['Klik. Klak. Slotje, boekenwachter.', 'Er kwam een bijlage binnen die heel beleefd om de sleutel van alle dossiers vroeg. Ik had bijna ja gezegd. Hij was zó beleefd.', 'Nu kruipen er fluisteraars uit. En er is iets groots. Het lekt.'],
  pip: 'De Lekkende Hydra! Toets de koppen met de Toetslamp (1), en zegel de stomp meteen dicht met het Zegel (3), anders groeit hij terug.',
  waiting: () => 'Zolang het lek leeft, kan ik niets sluiten. Houd het tegen!',
  react: {strong: 'Minimale rechten, begrensde tools en wantrouwen tegen elke bijlage. Klik. Klak. Dicht.', open: 'Bijna dicht. Maar een regel in de systeemprompt is geen slot.', blind: 'Dan laat ik de deur maar op een kier. Zoals altijd.'},
});
guardian('ethics', 'linde', {
  hello: ['Ik ben Linde. Mijn luisterhoorns verstaan keurige volzinnen prima.', 'Maar juist wie het hardst hulp nodig heeft, valt erdoorheen. Een korte vraag. Een spelfout. Paniek.'],
  pip: 'Drie hoorns, in de hoeken van de zaal. Luister naar alle drie.',
  waiting: () => `Je hebt ${heardCount('ethics')} van de drie stemmen gehoord.`,
  react: {strong: 'Je hebt de lege stoel aan tafel gezien. Dat is het begin van gelijke behandeling.', open: 'Je luistert. Maar hebben de mensen die moeten controleren daar ook tijd voor?', blind: 'Dan blijft de stoel leeg.'},
});

// ---- puzzles with a story ----
CHAMBER.ethics.trial.witnesses.forEach((v, i) => {
  ON.use[`hoorn${i}`] = () => scene(async () => {
    await say('nar', 'Je drukt je oor tegen de koperen hoorn. Ver weg, door het geruis, klinkt een stem.');
    await say(v.name, v.line);
    if (heard('ethics', i)) { const h = ent(`hoorn${i}`); if (h) h.def.heard = true; }
  });
});
ON.cleared.boss_hydra = () => { completeTrial('security'); scene(async () => { await say('pip', 'De Hydra is leeg. Alle lekken zijn dicht. Ga naar Slotje!'); }); };
ON.trialDone.interaction = () => { UI.pip('De bellen klinken als een goed gesprek. Kijk, de balie draait geen rondjes meer.'); if (stage('bakker') === 1) helpBakker(); };
ON.trialDone.sustainability = () => UI.pip('De modelmachine koelt af. Hoor je hem zuchten van opluchting?');
ON.trialDone.performance = () => UI.pip('Het stroomt weer! En dankzij de monitoring zien we de volgende piek aankomen.');
for (const id of ['quality', 'evaluation', 'functionality', 'compliance', 'ethics']) ON.trialDone[id] = () => UI.pip(`Proef gedaan. Terug naar ${{quality: 'Bep', evaluation: 'Mira', functionality: 'Kees', compliance: 'Otto', ethics: 'Linde'}[id]}.`);

// ---- Mevrouw Bakker, stuck at the counter ----
ON.talk.bakker3 = () => async c => {
  if (stage('bakker') < 1) setStage('bakker', 1);
  if (stage('bakker') >= 2) { await say(c, ['Ik heb een mens gesproken. Twee zelfs: u, en die aardige kabouter. Mijn dag kan niet meer stuk.', 'Mijn vergunning is gewoon geldig. Tot volgend jaar. Niet tot het jaar drieduizend.'][G.stats.steps % 2]); return; }
  await say(c, 'Daar bent u weer! Kijk nou. Ik heb eindelijk een balie gevonden.');
  await say(c, '‘Ik begrijp u,’ zegt dat ding. Al twintig minuten. Ik wil alleen weten of mijn parkeervergunning nog geldig is!');
  if (trialDone('interaction')) return helpBakker();
  await say('pip', 'Die balie draait rondjes. Als we de bellen in de goede volgorde luiden, krijgt ze vast een tweede kans.');
};
function helpBakker() {
  scene(async () => {
    await say('noor', 'Mevrouw, ik ben een assistent. Ik kan u uitleggen wat ik weet, maar over uw vergunning beslist een mens.');
    await say('noor', 'Ik zet u door naar een collega. Uw vraag en uw kenteken gaan mee; hier ziet u precies wat ik doorstuur.');
    await say('bakker3', 'Een mens! Eindelijk. Ziet u wel. Het kan best.');
    setStage('bakker', 2);
  });
}

// ---- Wouter and the bridge of seven keys ----
ON.talk.wouter = () => async c => {
  const n = keysCount();
  if (once('wouter_met')) {
    await say(c, 'Wouter, brugwachter. Ik heb de toegangssleutel van deze brug. Maar de leverancier heeft alle brugdelen vastgelijmd. In zijn eigen formaat.');
    await say(c, CHAMBER.sovereignty.hook);
    await say(c, 'Om over te steken heb je de sleutels van de uitweg nodig: brondata, prompts, evaluaties, het model, en meer. Zeven stuks.');
    await say(c, 'De hoeders van de domeinen rond de galerij hebben ze. Wie je helpt, geeft je er een. Er zijn er negen; zeven is genoeg.');
    await say('pip', 'Negen domeinen, zeven sleutels. Je mag kiezen wat je overslaat. Maar wat je overslaat, blijft een blinde vlek in het dossier.');
    return;
  }
  if (G.flags.bridge_built) { await say(c, ['De brug staat. En je kunt er ook weer áf. Dat is het hele punt.', 'Een brug waar je alleen op kunt, is een val.'][G.stats.steps % 2]); return; }
  if (n < 7) { await say(c, `Je hebt ${n} van de zeven sleutels. De hoeders van de domeinen hebben de rest.`); return; }
  await say(c, 'Zeven sleutels! Laat zien.');
  await say('nar', 'Je steekt de sleutels één voor één in de paal. Ze passen. Niet omdat ze van goud zijn, maar omdat ze van jou zijn.');
  completeTrial('sovereignty', {quiet: true});
  await say(c, CHAMBER.sovereignty.scenario);
  const st = await decide('sovereignty', {who: 'wouter'});
  await say(c, st === 'strong' ? 'Overdraagbaar, vervangbaar en geoefend. Nu is het een brug, en geen val.' : st === 'open' ? 'Hij staat. Maar heb je de overstap ook geoefend?' : 'Hij staat. Maar of je er ooit weer af kunt…');
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

// ---- Glans, getting nervous ----
ON.talk.glans3 = () => async c => {
  if (once('glans3_met')) {
    await say(c, 'Psst. U daar. Mag ik eerlijk zijn? Even, tussen ons?');
    await say(c, 'Het Orakel beantwoordt nu ook vragen die niemand heeft gesteld. Ook over mij. Het zegt dat ik een eend ben.');
    await say(c, 'En de Snelle Lift stopt niet meer waar ik wil. Hij gaat alleen nog maar naar beneden.');
    await say(c, 'Ik ga eens kijken in de Kern. Het is tenslotte mijn product. Min of meer.');
    return;
  }
  const i = await choose(['Neem jij de Snelle Lift maar. Ik loop.', 'Wees voorzichtig in de Kern.', 'Kan ik toch nog die lift nemen?']);
  if (i === 2) return shortcut(c);
  await say(c, i === 0 ? 'Lopen. Ja. Dat schijnt ook te werken. Mensen doen het al eeuwen.' : 'Voorzichtig? Ik ben accountmanager. Voorzichtig is mijn tweede naam. Mijn eerste naam is Glans.');
};
ON.zone.bieb = () => UI.pip('De Bibliotheek van Bijna Waar. Ik vertrouw geen enkele kast hier.');
ON.zone.luisterzaal = () => UI.pip('De Luisterzaal. Pas op voor de schimmen; je ziet ze alleen als je goed kijkt. Of als mijn licht ze laat zien.');
ON.zone.fluister = () => UI.pip('Hoor je dat gefluister? ‘Geef ons de sleutels… heel beleefd… alstublieft…’');
ON.zone.overkant = () => UI.pip('De Overkant. Die kisten daar… ze kijken naar je. Vastzitkisten! Wie erin trapt, komt er moeilijk uit.');
void P; void W; void restoreSort;
