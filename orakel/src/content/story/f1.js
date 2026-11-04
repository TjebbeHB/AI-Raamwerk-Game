// Diepte 1 · De Kelder der Beloften: Probleem & Noodzaak.
// Pip wakes up, Vrouwe Waarom asks her five whys, the three witnesses remember what you said upstairs,
// Daan still looks for the department of Innovation, and opa Joop left his first mark. Plan: docs/inhoudsplan.md.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {stage, setStage, startQuest} from '../../game/quests.js';
import {say, choose, scene, wait} from '../../game/dialogue.js';
import {giveItem} from '../../game/game.js';
import {spawnEnemy, ensureGroup} from '../../game/combat.js';
import {decide} from '../../ui/decision.js';
import {heard, heardCount} from '../puzzles.js';
import {STORY} from '../framework.js';
import {formal} from '../../game/hero.js';
import {rel, choice, chose, findSecret, award, archOpt} from './systems.js';
import {TILE} from '../../core/util.js';

const W3 = STORY.necessity.trial.witnesses;
const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = list => list[G.stats.steps % list.length];
// optional questions in a conversation: only the ones that are shown, then the way out
const shown = opts => opts.filter(o => o.if === undefined || o.if);
async function chat(c, opts, bye) {
  const list = shown(opts);
  if (!list.length) return;
  const i = await choose([...list, bye]);
  if (i < list.length) await list[i].run(c);
}

ON.floor.f1 = () => {
  if (stage('main') === 2) {
    setStage('main', 3, true);
    scene(async () => {
      await say('nar', 'De trap is langer dan je dacht. Beneden is het stil, op het druppelen van water na.');
      await say('nar', 'Je telefoonlampje knippert. Nog drie procent. Ergens verderop gloeit iets.');
    });
  }
};

// ---- the lantern and Pip ----
ON.pickup['tool:lamp'] = () => scene(async () => {
  G.flags.pip = true;
  await say('nar', 'Je pakt de oude lantaarn van de sokkel. Hij is warm. En hij snurkt.');
  await say('pip', 'Hmpf. Wie… wat… hé! Een hand! Een wárme hand!', {mood: 'surprised'});
  await say('pip', 'Zeg niks, ik raad het. Je bent van de gemeente. Je komt voor het Orakel. En je hebt geen idee waar je aan begint.', {mood: 'smug'});
  const i = await choose([
    'Klopt. Wie ben jij?',
    'Een pratende lantaarn. Natuurlijk. Waarom ook niet.',
    archOpt('verbinder', 'Tweehonderd jaar alleen in het donker. Gaat het wel?'),
    archOpt('datatovenaar', 'Hoeveel lumen ben jij eigenlijk?'),
  ]);
  if (i === 0) rel('pip', 1, {silent: true});
  else if (i === 1) await say('pip', 'Een pratende ambtenaar. Natuurlijk. Waarom ook niet. Zullen we quitte spelen?', {mood: 'laugh'});
  else if (i === 2) {
    await say('pip', 'Of het gaat?', {mood: 'surprised'});
    await say('pip', 'Dat heeft niemand ooit gevraagd. Niet in tweehonderd jaar. De molenaar niet, de burgemeester niet, en die computer van ’98 al helemaal niet.', {mood: 'sad'});
    await say('pip', 'Het gaat. Nu wel. Je hand is warm.', {mood: 'happy'});
    rel('pip', 2);
  } else if (i === 3) {
    await say('pip', 'Genoeg om een leugen te zien. Ongeveer drie.', {mood: 'smug'});
    await say('pip', 'Drie lumen is niet veel, hoor. Maar een leugen is ook niet zo groot. Hij doet alleen alsof.', {mood: 'laugh'});
    rel('pip', 1, {silent: true});
  }
  await say('pip', 'Ik ben Pip. Tweehonderd jaar lang was ik de lamp van het archief. ‘Pip, waar ligt het dossier van de molenaar?’ ‘Derde kast, tweede plank. En vraag het daarna even na bij de molenaar zelf.’', {mood: 'happy'});
  await say('pip', 'Toen kwam de elektriciteit. Daarna die computer in ’98. Daarna stof. Heel veel stof.', {mood: 'tired'});
  await say('pip', 'En nu staat er in de diepste kelder een Orakel dat álles weet. Sinds dat ding aanstaat, lekken zijn antwoorden door het hele Gewelf. Ze krijgen pootjes. Vleugeltjes. Tandjes.', {mood: 'worried'});
  await say('pip', 'Het Gewelf is gebouwd rond het raamwerk: vijftien kamers met de vragen die je moet stellen voordat je ja zegt tegen zoiets. Elke kamer heeft een hoeder. Wie het Orakel wil beoordelen, moet erlangs.', {mood: 'thinking'});
  await say('pip', 'Ik ga met je mee. Iemand moet je bijlichten. Mijn licht noemen ze de Toetslamp: wat ik beschijn, wordt getoetst.', {mood: 'smug'});
  setStage('main', 4);
  UI.toast('De Toetslamp', 'Klik (of tik op ✦) om een lichtschot af te vuren. R of de rechtermuisknop laat het licht openbarsten.', 'quest');
  // the first monsters come for the light
  for (const [x, z] of [[19, 27], [29, 31]]) spawnEnemy('demo', x * TILE + 1, z * TILE + 1, {aware: true});
  await wait(0.4);
  await say('pip', 'Daar! Demo-dwaallichten. Ze glanzen, maar ze zijn hol. Schiet erop met de Toetslamp!', {mood: 'angry'});
});
ON.trigger.t_nepmuur = () => { if (stage('main') === 4) UI.pip('Hm. Die gouden muur glanst. Echte muren glanzen niet. Laat mijn licht openbarsten: druk op R.'); };
ON.use.nepmuur = () => {
  if (stage('main') <= 4) { setStage('main', 5); UI.pip('Zie je? Die muur was een belofte. Er zat niks achter. Nou ja, een gang. Op naar de Kamer van de Vraag!'); }
};
ON.zone.lampen = () => { if (!G.tools.lamp) UI.toast('Donker', 'Op een sokkel midden in de kamer gloeit iets zachtjes.', 'quest'); };
ON.zone.vraag = () => UI.pip('De Kamer van de Vraag. Hier begint elke afdaling. Of hij eindigt hier, als je de vraag niet goed stelt.');
// the town hall has a zone 'gang' too: only the one down here glitters
ON.zone.gang = () => { if (W.id === 'f1') UI.pip('De Gang der Beloften. Alles hier glimt. Toets alles.'); };
ON.zone.archief = () => UI.pip('Het klachtenarchief. Elke la zit vol klachten die nooit zijn beantwoord. Ik krijg er de kriebels van.');
ON.zone.innovatie = () => { if (G.flags.pip) UI.pip('Een afdeling Innovatie achter een muur die er niet is. Dat verklaart eigenlijk een hoop.'); };

// ---- what opa Joop, the archive and the pedestal have to say ----
ON.use.opa1 = async s => {
  await UI.read(s.def.title, s.def.text);
  if (G.flags.pip) UI.pip('Opa Joop! Die ken ik. Hij noemde mij ‘het lampje’. Ik noemde hem ‘de snor’. We konden het prima vinden.');
};
ON.use.oudste_klacht = async s => {
  await UI.read(s.def.title, s.def.text);
  if (G.flags.pip) UI.pip('Laster. Dat is laster. Ik ben niet eigenwijs. Ik heb gewoon vaak gelijk. Dat is iets anders.');
};
ON.use.sokkelplaatje = async () => {
  await UI.read('Het plaatje van de sokkel', 'Een klein koperen plaatje, half onder het stof:\n\nLANTAARN NR. 1\nPetrus Ignatius Pompeius\nArchief van Dalwijk, 1824');
  if (!once('pip_naam_gelezen')) { UI.pip('Pip. Gewoon Pip. Dat hadden we toch afgesproken?'); return; }
  scene(async () => {
    await say('pip', 'Niemand noemt me zo. Níémand.', {mood: 'angry'});
    await say('pip', 'De archivaris die me aanstak, had zes kinderen en nog namen over. Die kreeg ik allemaal.', {mood: 'tired'});
    const k = await choose(['Goed, Petrus.', 'Je geheim is veilig bij mij, Pip.', archOpt('archivaris', 'Drie voornamen. In het archief noemen we dat volledig ingeschreven.')]);
    if (k === 0) await say('pip', 'Pip. Drie letters. Net als ‘nee’.', {mood: 'smug'});
    else if (k === 1) {
      await say('pip', 'Dank je. Echt. Als het Orakel het ooit vraagt: ik heet Pip, en ik weet het niet zeker.', {mood: 'happy'});
      rel('pip', 1);
    } else {
      await say('pip', 'Volledig ingeschreven. Hm. Zo had ik het nog nooit bekeken.', {mood: 'thinking'});
      await say('pip', 'Je mag het nog steeds niet hardop zeggen.', {mood: 'laugh'});
      rel('pip', 1, {silent: true});
    }
  });
};
ON.use.archieflog = async s => {
  await UI.read(s.def.title, s.def.text);
  if (!G.flags.pip || !once('archief_joop')) return;
  scene(async () => {
    await say('pip', 'J. (conciërge)…', {mood: 'thinking'});
    await say('pip', 'J.… Dat is Joop! Hij heeft in ’98 die computer uitgezet!', {mood: 'surprised'});
    if (G.flags.glans_1998) await say('pip', 'Glans zei het nog, boven: ‘Uitgezet, denk ik. Door een conciërge.’ Hij had geen idee dat het waar was.', {mood: 'laugh'});
    await say('pip', 'En daarna heeft hij mij weer aangestoken. Al die jaren wist ik niet wie dat was. Ik dacht dat het de tocht was.', {mood: 'happy'});
    if (G.items.sleutelbos && !G.flags.joop_bos) await say('pip', 'Dat moeten we hem vertellen. Als we hem zijn sleutelbos teruggeven.', {mood: 'happy'});
  });
};
ON.use.druiven = () => UI.toast('Laaghangend fruit', 'Aan een spijker, op kniehoogte, hangt een tros plastic druiven. Er zit een briefje aan: ‘Eerst deze plukken. Dan de rest. Groet, het projectteam.’');

// ---- Vrouwe Waarom, and her five whys ----
const WHY = [
  ['Omdat inwoners wachten.', 'thinking'],
  ['Omdat een brief onduidelijk is.', 'thinking'],
  ['Omdat niemand eigenaar is.', 'sad'],
  ['Omdat iedereen dacht dat een ander het deed.', 'tired'],
  ['Omdat… je stelt goede vragen.', 'happy'],
];
async function fiveWhys(c) {
  for (;;) {
    const k = G.flags.waaromN || 0;
    G.flags.waaromN = k + 1;
    await say(c, WHY[k][0], {mood: WHY[k][1]});
    if (k === 1) await say('pip', 'Ze gaat ervoor zitten. Ze zit al driehonderd jaar.', {mood: 'laugh'});
    if (k === WHY.length - 1) {
      await say(c, 'Vijf keer waarom. De meeste mensen stoppen bij drie. Bij drie richten ze een werkgroep op.', {mood: 'laugh'});
      await say(c, 'Wie vijf keer durft te vragen, mag mijn mantel lenen. Voor de volgende keer dat je ergens komt waar iedereen al een antwoord heeft.', {mood: 'happy'});
      findSecret('vijf_waaroms');
      rel('waarom', 1, {silent: true});
      return;
    }
    if (await choose(['Waarom?', 'Genoeg waarom voor vandaag.']) === 1) {
      await say(c, 'Ook goed. De vraag loopt niet weg. Dat doen vragen nooit.', {mood: 'neutral'});
      return;
    }
  }
}
const waaromExtra = () => [
  {t: 'Waarom?', if: (G.flags.waaromN || 0) < WHY.length, run: fiveWhys},
  {...archOpt('archivaris', 'De archivarissen van 1648 schreven: vraag eerst waarom.', !G.flags.waarom_1648), run: async c => {
    G.flags.waarom_1648 = true;
    await say(c, 'Je hebt de muur gelezen.', {mood: 'surprised'});
    await say(c, 'Bijna niemand leest de muur. Ze lezen de samenvatting van de muur. Die is nooit gemaakt.', {mood: 'laugh'});
    rel('waarom', 1);
  }},
];
function stevig(st) { if (st === 'strong' && once('waarom_stevig')) rel('waarom', 2); }
ON.talk.waarom = () => async c => {
  const m = stage('main');
  if (m <= 5) {
    if (m < 5) setStage('main', 5, true);
    await say(c, 'Halt. Wie de Kamer van de Vraag betreedt, stelt eerst een vraag.', {mood: 'angry'});
    await say(c, 'Niet aan mij. Aan de mensen om wie het gaat.', {mood: 'thinking'});
    await say(c, 'Boven wil iemand een Orakel. Maar welk probleem lost het op? Wie heeft er last van? Is er een eenvoudiger weg?', {mood: 'thinking'});
    await say(c, 'Drie mensen dwalen door deze kelders: een inwoner, een medewerker van het klantcontact en de verkoper zelf. Hoor ze alle drie. Dan stel ik mijn vraag.', {mood: 'neutral'});
    setStage('main', 6);
    await say('pip', 'Ze is altijd zo. Ze heeft ooit een burgemeester drie dagen laten wachten omdat hij ‘omdat het kan’ zei.', {mood: 'laugh'});
    return;
  }
  if (m === 6) {
    await say(c, `Je hebt er ${heardCount('necessity')} van de drie gehoord. Luister verder. De inwoner, de medewerker, de verkoper.`, {mood: 'neutral'});
    return chat(c, waaromExtra(), 'Ik ga verder luisteren.');
  }
  if (m === 7) {
    await say(c, 'Drie stemmen. Drie kanten van hetzelfde probleem. Wat heb je gehoord?', {mood: 'thinking'});
    await say('pip', 'Een derde van de vragen gaat over één onduidelijke brief. Niet iedereen kan of wil digitaal. En niemand heeft gemeten welke vragen er echt binnenkomen.', {mood: 'thinking'});
    await say(c, 'Dan is dit mijn vraag. Wat moet je eerst vastleggen, voordat AI hier überhaupt een optie is?', {mood: 'neutral'});
    const st = await decide('necessity', {who: 'waarom'});
    if (st === 'strong') await say(c, 'Goed gevraagd. Wie zo begint, weet straks ook wanneer hij moet stoppen.', {mood: 'happy'});
    else if (st === 'open') await say(c, 'Je bent op weg, maar er ontbreekt iets. Het dossier zal het onthouden. Je kunt hier altijd terugkomen.', {mood: 'thinking'});
    else await say(c, 'Geen vraag gesteld. Dan neem je ook geen antwoord mee naar beneden. Het dossier zal het onthouden.', {mood: 'sad'});
    stevig(st);
    await say(c, 'Neem dit mee. Wie ‘waarom’ vraagt, leert wegen.', {mood: 'neutral'});
    giveItem('tool:scale');
    await say(c, 'En deze bron, voor je dossier.', {mood: 'neutral'});
    giveItem('bron:necessity:c');
    G.flags.f1_gate = true;
    setStage('main', 8);
    await say(c, 'Het hek van de Showroom staat open, achter de Gang der Beloften. Daar wacht de belofte die het hardst glimt.', {mood: 'thinking'});
    await say('pip', 'De Weegschaal! Daarmee geef je bedenktijd. Haastkobolden kunnen daar niet tegen. Probeer hem maar eens (2).', {mood: 'happy'});
    return;
  }
  // after the decision: talk again to reconsider, or to ask why once more
  await say(c, 'Wil je je antwoord herzien? Het dossier onthoudt alleen je laatste keuze.', {mood: 'neutral'});
  const extra = shown(waaromExtra());
  const i = await choose(['Ja, laat me opnieuw afwegen.', ...extra, 'Nee, ik ga verder.']);
  if (i === 0) stevig(await decide('necessity', {who: 'waarom'}));
  else if (i <= extra.length) await extra[i - 1].run(c);
};
ON.trialDone.necessity = () => { if (stage('main') <= 6) setStage('main', 7); UI.pip('Dat waren ze alle drie. Terug naar Vrouwe Waarom, bij de Bron.'); };

// ---- witness 1: Mevrouw Bakker in the wine cellar ----
ON.talk.bakker1 = () => async c => {
  if (!G.cleared.f1_wijn) { await say(c, 'Weg! Weg met die lichtjes! Ze willen me steeds iets verkopen!', {mood: 'angry'}); await say('pip', 'Eerst die dwaallichten wegtoetsen. Dan kun je met haar praten.'); return; }
  if (once('bakker1_met')) {
    await say(c, 'O, u bent het. De nieuwe. Ik zocht de balie waar een mens zit. Toen ging ik een trap af. En nog een trap.', {mood: 'tired'});
    const b = chose('bakker_belofte');
    if (b === 'belofte') await say(c, 'U had het beloofd. Ik ben vast zelf gaan kijken. Niet dat ik u niet vertrouw, lief kind. Ik vertrouw mijn eigen benen alleen wat langer.', {mood: 'smug'});
    else if (b === 'stellig') await say(c, 'Vrijdag, zei u. Een mens aan de lijn. Het staat in mijn agenda, twee keer onderstreept. Maar ik ben vast zelf gaan kijken.', {mood: 'smug'});
    else if (b === 'eerlijk') await say(c, 'U zei eerlijk dat u niets kon beloven. Dus ben ik zelf gaan zoeken.', {mood: 'thinking'});
    if (G.flags.tickets === 999) await say(c, 'U bent toch nummer 999? Dan bent u de laatste. Ik ben 412. Ik ga voor.', {mood: 'laugh'});
    await say(c, W3[0].line, {mood: 'angry'});
    const i = await choose([
      'Wat zou u wél helpen?',
      'Zal ik u terugbrengen naar boven?',
      archOpt('verbinder', 'Weten uw kleinkinderen dat u hier beneden bent?', G.flags.bakker_kleinkinderen),
      archOpt('datatovenaar', 'Hoeveel treden bent u al afgedaald?'),
    ]);
    if (i === 0) await say(c, 'Een brief die ik snap. En iemand die opneemt als ik bel. Meer vraag ik niet. Is dat nou zo moeilijk?', {mood: 'angry'});
    else if (i === 1) await say(c, 'Nee hoor. Ik vind die balie zelf wel. Ik ben negenenzeventig, lief kind, niet dood.', {mood: 'smug'});
    else if (i === 2) {
      await say(c, 'Mijn kleinkinderen? Die denken dat ik bij de kapper zit.', {mood: 'laugh'});
      await say(c, 'En zo houden we het. Als ze horen dat ik in een kelder vol lichtjes sta, komen ze niet meer alleen op zondag. Dan komen ze elke dag.', {mood: 'smug'});
      rel('bakker', 1, {silent: true});
    } else if (i === 3) {
      await say(c, 'Honderdtwaalf. Ik tel altijd. Dan weet ik hoeveel ik er terug moet.', {mood: 'smug'});
      await say(c, 'Bij honderd heb ik even gezeten. Op een vat. Er zat geen wijn in. Alleen een formulier.', {mood: 'tired'});
    }
    heard('necessity', 0);
    startQuest('bakker');
    await say(c, 'Ik ga nog een stukje verder naar beneden. Ergens moet een mens zitten.', {mood: 'thinking'});
    return;
  }
  if (chose('ilse_brief', 'inwoners') && !G.flags.brief_bakker) {
    if (await choose(['Mag ik u iets vragen over de afvalpasbrief?', 'Ik loop weer verder.']) === 1) return;
    await say(c, 'Die brief! Ik heb hem drie keer gelezen. De derde keer met een vergrootglas. Het werd er niet beter van.', {mood: 'angry'});
    await say(c, 'Schrijf gewoon wat ik moet doen, en wanneer. Ik ben negenenzeventig, niet achterlijk.', {mood: 'smug'});
    G.flags.brief_bakker = true;
    rel('bakker', 1, {silent: true});
    return;
  }
  await say(c, pick(['Gaat u maar. Ik red me wel. Ik heb een paraplu.', 'Als u die balie vindt, zeg dan dat ik eraan kom.', 'Ik fluit de wachtmuziek, dan voel ik me thuis. Panfluit. U kent hem vast.']), {mood: 'smug'});
};

// ---- witness 2: Ilse in the complaints archive, and the afvalpasbrief ----
const QUOTES = {burger1: 'Zeg gewoon container.', burger2: 'Mijn zoon dacht dat het een cryptogram was.', burger3: 'Niet in de magnetron.', bakker: 'Schrijf wat ik moet doen, en wanneer.'};
const briefAsked = () => Object.keys(QUOTES).filter(k => G.flags[`brief_${k}`]);
const briefChoice = (pk, text) => choice('ilse_brief', {npc: 'ilse', label: 'De afvalpasbrief', text, pick: pk});
ON.talk.ilse1 = () => async c => {
  if (G.flags['heard:necessity:1']) {
    if (chose('ilse_brief', 'inwoners') && briefAsked().length >= 2 && !G.flags.brief_inwoners_klaar) return ilseInwoners(c);
    if (!chose('ilse_brief')) return ilseBrief(c);
    await say(c, pick([
      'Als je boven bent: ik heb een nieuwe versie van de brief geschreven. Op de achterkant van een klacht.',
      'Weet je wat ik het mooiste vind? Een probleem dat je met een pen kunt oplossen.',
      G.secrets.includes('printer') ? 'Dirk zegt dat de printer boven het doet. Hij dóét het? Ik geloof het pas als ik het zie.' : 'Hier beneden is het tenminste stil. Geen telefoon. Alleen klachten. Die praten niet terug.',
    ]), {mood: 'happy'});
    return;
  }
  if (G.items['brief:afvalpas']) {
    await say(c, 'Je hebt hem! Kijk dan: ‘Met betrekking tot de modernisering van de inzamelingsstructuur…’ Zelfs ík snap het niet.', {mood: 'laugh'});
    await say(c, W3[1].line, {mood: 'thinking'});
    await say(c, 'Daar heb je geen Orakel voor nodig. Daar heb je een pen voor nodig. En iemand die eigenaar is van die brief.', {mood: 'smug'});
    const i = await choose(['Dus het probleem is niet de wachttijd?', 'Wat wil je dat ik met de brief doe?']);
    if (i === 0) await say(c, 'De wachttijd is het symptoom. De brief is één oorzaak. Er zijn er vast meer, maar niemand heeft ze ooit geteld.', {mood: 'thinking'});
    else await say(c, 'Neem hem mee in je advies. Als we hem herschrijven, scheelt dat een derde van de telefoontjes. Zonder één regel code.', {mood: 'happy'});
    heard('necessity', 1);
    return ilseBrief(c);
  }
  if (once('ilse1_met')) {
    await say(c, 'Jij hier? Ik zoek die afvalpasbrief. Ik wil hem laten zien aan iemand die er wat mee kan.', {mood: 'surprised'});
    await say(c, 'Hij moet hier ergens liggen, tussen de klachten. Achterin, denk ik. Pas op voor de papiergolem: die bestaat uit klachten die nooit zijn beantwoord. Hij is nogal… boos.', {mood: 'worried'});
    return;
  }
  await say(c, 'Heb je de brief al gevonden? Achterin het archief, in de noordoosthoek, denk ik.', {mood: 'thinking'});
};
// what you decided about the letter upstairs comes back here
async function ilseBrief(c) {
  const brief = chose('ilse_brief');
  if (brief === 'zelf' && G.flags.brief_geprint) {
    await say(c, 'Wacht. Is dat… jouw nieuwe brief? Heb je hem al geprint? Op één A4?', {mood: 'surprised'});
    await say('nar', 'Ilse legt jouw brief naast de oude. De oude telt vier kantjes en een bijlage. De jouwe begint met: ‘U krijgt een nieuwe afvalpas. Zo werkt hij.’');
    await say(c, 'Die hang ik op. Naast mijn turflijst. Dan kan ik zien hoe die lijst korter wordt.', {mood: 'happy'});
    rel('ilse', 1);
  } else if (brief === 'zelf') {
    await say(c, 'Jij zou hem zelf herschrijven, toch? Als je de printer boven aan de praat krijgt, wil ik hem als eerste lezen.', {mood: 'happy'});
    await say(c, 'Dirk zegt dat die printer het in 2016 voor het laatst deed. Geen druk.', {mood: 'laugh'});
  } else if (brief === 'orakel') {
    await say(c, 'O, en ik heb de versie van het Orakel gezien. Kijk maar.', {mood: 'worried'});
    await say('nar', 'Ilse houdt een uitdraai omhoog: ‘Geachte inwoner, u kunt uw afvalpas ophalen bij het loket op de maan. Openingstijden: bij volle maan.’');
    await say(c, 'Ik heb het nagebeld. Er nam niemand op.', {mood: 'tired'});
    const k = await choose(['Dan schrijven we hem toch samen met de inwoners.', 'Het Orakel leert vast nog.']);
    if (k === 0) {
      await say(c, 'Samen met de inwoners? Ja! Mevrouw Bakker zit hier verderop in de wijnkelder. En boven in de hal zitten er genoeg.', {mood: 'happy'});
      await say(c, 'Vraag er twee wat ze niet snappen. Ik schrijf mee, op de achterkant van een klacht.', {mood: 'laugh'});
      briefChoice('inwoners', 'Je vroeg inwoners wat ze niet snapten aan de afvalpasbrief.');
      rel('ilse', 1);
    } else {
      await say(c, 'Vast. Maar de inwoners krijgen die brief vandaag. Niet pas als het Orakel klaar is met leren.', {mood: 'sad'});
      rel('ilse', -1);
    }
  } else if (brief === 'inwoners') {
    const asked = briefAsked();
    if (!asked.length) await say(c, 'Heb je de inwoners al gevraagd wat ze niet snappen? Mevrouw Bakker zit verderop in de wijnkelder. Die heeft er vast een mening over.', {mood: 'thinking'});
    else await say(c, `Ik heb de opmerkingen van de inwoners bij me. Kijk: ‘${QUOTES[asked.includes('burger1') ? 'burger1' : asked[0]]}’ Die hangt al boven mijn bureau.`, {mood: 'laugh'});
    if (asked.length >= 2 && !G.flags.brief_inwoners_klaar) await ilseInwoners(c);
  } else {
    await say(c, 'En weet je wat ik me afvraag? Wie die brief nu eigenlijk gaat herschrijven. Iedereen denkt dat een ander het doet.', {mood: 'thinking'});
    const k = await choose(['Dan herschrijf ik hem zelf. Op één A4, in gewone taal.', 'Laat het Orakel hem herschrijven. Daar is het toch voor?', 'Laten we de inwoners vragen wat ze er niet aan snappen.', 'Daar moet ik even over nadenken.']);
    if (k === 3) { await say(c, 'Neem je tijd. Hij ligt er al drie jaar.', {mood: 'laugh'}); return; }
    if (k === 0) {
      await say(c, 'Zelf? Graag! Loop boven dan wel even langs bij Ingrid van Communicatie. Zij heeft hem geschreven, met tien juristen op haar schouder.', {mood: 'happy'});
      briefChoice('zelf', 'Je besloot de afvalpasbrief zelf te herschrijven.');
      rel('ilse', 1);
    } else if (k === 1) {
      await say(c, 'Het Orakel. Hetzelfde Orakel dat een meneer een paspoort voor zijn hond aanraadde. Hij heeft geen hond.', {mood: 'worried'});
      await say(c, 'Nou ja. Jij bent de adviseur. Ik lees hem wel na voordat hij de deur uit gaat.', {mood: 'tired'});
      briefChoice('orakel', 'Je liet de afvalpasbrief door het Orakel herschrijven.');
      rel('ilse', -1);
    } else {
      await say(c, 'De inwoners zelf vragen? Dat is zo logisch dat niemand het ooit gedaan heeft.', {mood: 'laugh'});
      await say(c, 'Mevrouw Bakker zit hier verderop. En boven in de hal zitten er genoeg. Vraag er twee, dan schrijf ik mee.', {mood: 'happy'});
      briefChoice('inwoners', 'Je vroeg inwoners wat ze niet snapten aan de afvalpasbrief.');
      rel('ilse', 2);
    }
  }
}
async function ilseInwoners(c) {
  G.flags.brief_inwoners_klaar = true;
  await say('nar', 'Je vertelt wat de inwoners zeiden. Ilse schrijft mee op de achterkant van een klachtformulier uit 1987.');
  await say(c, briefAsked().map(k => `‘${QUOTES[k]}’`).join(' '), {mood: 'laugh'});
  await say(c, 'Dit is het begin van de eerste brief van deze gemeente die mensen in één keer snappen. En er is geen Orakel aan te pas gekomen.', {mood: 'happy'});
  award('begrijpelijk');
  rel('ilse', 1, {text: 'Ilse zal dit niet vergeten.'});
}
ON.pickup['brief:afvalpas'] = () => UI.pip('De afvalpasbrief! ‘Met betrekking tot de modernisering van de inzamelingsstructuur.’ Ik snap er niks van. Breng hem naar Ilse.');

// ---- witness 3: Glans, stuck in his own demo ----
ON.trigger.t_glanskooi = () => { if (!G.flags.glans_free) scene(async () => { await say('glans', 'Hallo? Is daar iemand? Ik zit vast in mijn eigen demo! De wanden zijn van goud! Nou ja… het líjkt goud!', {mood: 'worried'}); await say('pip', 'Die kooi is net zo echt als zijn garantie. Laat het licht openbarsten (R).', {mood: 'smug'}); }); };
ON.talk.glans1 = () => async c => {
  if (once('glans1_free')) {
    G.flags.glans_free = true;
    await say(c, 'Dank u! Die demo was zó overtuigend dat ik er zelf in geloofde. Letterlijk. Ik zat erin.', {mood: 'happy'});
    if (chose('glans_houding', 'spot')) await say(c, `Wacht eens. U bent die van de garantiegrap. ${Cap(formal())}, u staat in mijn klantsysteem. Met drie uitroeptekens.`, {mood: 'smug'});
    const k = await choose([
      'Graag gedaan, Glans.',
      'Volgende keer neem ik de trap.',
      archOpt('handhaver', 'Eerst wil ik weten hoe het zit met artikel zeven.', G.flags.glans_artikel7),
      archOpt('verbinder', 'Zat je hier lang? Je ziet bleek.'),
    ]);
    if (k === 0) {
      await say(c, 'Graag gedaan! Dat zegt nooit iemand tegen mij. Meestal zeggen ze ‘we komen erop terug’.', {mood: 'happy'});
      rel('glans', 1);
    } else if (k === 1) await say(c, 'De trap! Haha. Ouderwets. Charmant. Ik zet het in uw profiel: ‘houdt van treden’.', {mood: 'laugh'});
    else if (k === 2) {
      await say(c, 'Artikel zeven. Ja. Daar zat ik eigenlijk ook in vast. Bij wijze van spreken.', {mood: 'worried'});
      await say(c, 'Er staat dat alles van PraatPal is wat de demo aanraakt. De demo raakte mij aan. Technisch gezien ben ik nu dus van mezelf. Dat is juridisch heel ingewikkeld.', {mood: 'thinking'});
      rel('glans', 1, {silent: true});
    } else if (k === 3) {
      await say(c, 'Bleek?', {mood: 'surprised'});
      await say(c, 'Drie uur. Ik heb mijn eigen pitch elf keer gehoord. Bij de zesde keer begon ik te twijfelen. Bij de negende keer wilde ik tekenen.', {mood: 'sad'});
      await say(c, 'Dank u dat u het vraagt. Echt.', {mood: 'happy'});
      rel('glans', 2);
    }
    await say(c, W3[2].line, {mood: 'smug'});
    const i = await choose(['Dus jullie weten niet welke vragen inwoners stellen?', 'Hoe kom jij eigenlijk hier beneden?']);
    if (i === 0) await say(c, 'Weten, weten. We hebben een héél goed gevoel bij de vragen. Dat is ook een soort weten.', {mood: 'smug'});
    else await say(c, 'Met de Snelle Lift natuurlijk. Hij stopt overal. Behalve waar je moet zijn.', {mood: 'laugh'});
    await say(c, 'Hier, neem een kaartje. Voor als u van gedachten verandert.', {mood: 'happy'});
    giveItem('card:6');
    heard('necessity', 2);
    return;
  }
  await say(c, pick(['De Showroom is verderop. Het pronkstuk staat er. Hij is iets… groter geworden dan in de folder.', 'Als u boven bent, zegt u dan tegen niemand dat ik vastzat? Slecht voor de verkoop.']), {mood: 'worried'});
};

// ---- Daan, the intern who has been looking for Innovation since 2017 ----
ON.talk.daan = () => async c => {
  if (once('daan_met')) {
    await say(c, 'O! Licht! Bent u van Innovatie? Zeg alstublieft dat u van Innovatie bent.', {mood: 'surprised'});
    await say(c, 'Ik ben Daan. Stagiair. Op mijn eerste dag kreeg ik een kamernummer: Innovatie, K-0.17. Een week later was de reorganisatie van 2017. Alles werd omgenummerd.', {mood: 'tired'});
    await say(c, 'Sindsdien zoek ik de afdeling. Ik heb heel veel muren gezien. Sommige waren niet eens echt.', {mood: 'thinking'});
    const i = await choose([
      'Kom maar mee naar boven.',
      'Wat heb je al die tijd gedaan?',
      archOpt('archivaris', 'Volgens het organogram van 2017 zit Innovatie… hier. Je zit er al die tijd in.'),
      archOpt('verbinder', 'Heeft iemand je eigenlijk ooit gemist?'),
      archOpt('datatovenaar', 'Hoeveel ideeën heb je in die tijd bedacht?'),
      archOpt('handhaver', 'Wie is eigenlijk je leidinggevende?'),
    ]);
    if (i === 0) {
      await say(c, 'Boven? Daar is het licht. Daar ben ik niet op gekleed.', {mood: 'worried'});
      await say(c, 'En stel dat Innovatie net terugkomt als ik weg ben. Dan sta ik weer onderaan de lijst.', {mood: 'thinking'});
    } else if (i === 1) await say(c, 'Ideeën bedacht! Een app voor de app. Een loket voor de loketten. Een overleg over minder overleg.', {mood: 'happy'});
    else if (i === 2) {
      await say(c, 'Hier? Dus ik ben… aangekomen?', {mood: 'surprised'});
      await say(c, 'Zeven jaar op de goede plek, en niemand die het zei. Dat is eigenlijk heel innovatief.', {mood: 'laugh'});
      G.flags.daan_thuis = true;
      rel('daan', 2);
    } else if (i === 3) {
      await say(c, 'Mijn moeder. En de koffieautomaat, denk ik.', {mood: 'sad'});
      await say(c, 'Die gaf altijd een extra bekertje als ik langskwam. Ik denk dat hij me mist.', {mood: 'thinking'});
      rel('daan', 1);
    } else if (i === 4) await say(c, 'Vierhonderdtwaalf. Nummer één: een lijst om mijn ideeën op bij te houden.', {mood: 'smug'});
    else if (i === 5) await say(c, 'Volgens mijn contract: het hoofd Innovatie. Die zoek ik dus ook.', {mood: 'thinking'});
    await say(c, 'Al mijn ideeën staan op de parkeerlijst. Hij is nu vierhonderd meter. Hier, streep hem maar af. Ik kan er toch niet meer bij.', {mood: 'laugh'});
    giveItem('bingo:parkeerlijst');
    return;
  }
  await say(c, G.flags.daan_thuis ? pick(['Ik heb mezelf een welkomstmail gestuurd. Hij kwam aan. Dat is meer dan ik van de rest kan zeggen.', 'Ik zit op mijn plek. Op mijn eigen plek. Ik durf niet meer op te staan.'])
    : pick(['Als je Innovatie ziet: zeg dat ik eraan kom. Al zeven jaar.', 'Weet je wat het gekke is? De koffie is hier wel goed.']), {mood: 'happy'});
};

// ---- the showroom and the gleaming demo ----
ON.trigger.t_showroom = () => {
  if (!G.flags.f1_gate || G.flags.boss_demo) return;
  ensureGroup('boss_demo');
  setStage('main', 9);
  scene(async () => {
    await say('nar', 'Midden in de Showroom staat een reusachtige, glimmende figuur. Op zijn scherm verschijnt een grote, witte glimlach.');
    await say('nar', '‘WELKOM BIJ DE DEMO! IK BEANTWOORD ALLE VRAGEN. OOK DIE U NOG NIET HEEFT!’');
    await say('pip', 'Dat is Glans’ demo, maar dan groot. Al dat glimmen houdt mijn licht tegen. Kom dichtbij, laat het licht openbarsten (R) en toets hem dan snel (1)!', {mood: 'worried'});
  });
};
ON.cleared.boss_demo = () => {
  G.flags.boss_demo = true;
  setStage('main', 10);
  scene(async () => {
    await say('pip', 'Karton! Het was karton met een lampje erin. En een heel goede presentatie.', {mood: 'laugh'});
    await say('pip', 'De trap naar beneden is vrij. Diepte 2: de Hal der Fundamenten. Daar zie je pas of iets kan blijven staan.', {mood: 'thinking'});
  });
  saveGame();
};

// ---- the old archive room (after finding Joop's keys on Diepte 2) ----
ON.zone.oudarchief = () => { if (stage('sleutelbos') === 1) setStage('sleutelbos', 2); UI.pip('Hier heeft Joop gewerkt. Ruik je dat? Oud papier en een beetje spijt.'); };
void P; void ent; void SFX;
