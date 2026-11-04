// Diepte 1 · De Kelder der Beloften: Probleem & Noodzaak.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {ent} from '../../game/world.js';
import {stage, setStage, startQuest} from '../../game/quests.js';
import {say, choose, scene, wait} from '../../game/dialogue.js';
import {giveItem} from '../../game/game.js';
import {spawnEnemy, ensureGroup} from '../../game/combat.js';
import {decide} from '../../ui/decision.js';
import {heard, heardCount} from '../puzzles.js';
import {STORY} from '../framework.js';
import {TILE} from '../../core/util.js';

const W3 = STORY.necessity.trial.witnesses;
const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };

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
  await say('pip', 'Hmpf. Wie… wat… hé! Een hand! Een wárme hand!');
  await say('pip', 'Zeg niks, ik raad het. Je bent van de gemeente. Je komt voor het Orakel. En je hebt geen idee waar je aan begint.');
  const i = await choose(['Klopt. Wie ben jij?', 'Een pratende lantaarn. Natuurlijk. Waarom ook niet.']);
  if (i === 1) await say('pip', 'Een pratende ambtenaar. Natuurlijk. Waarom ook niet. Zullen we quitte spelen?');
  await say('pip', 'Ik ben Pip. Tweehonderd jaar lang was ik de lamp van het archief. ‘Pip, waar ligt het dossier van de molenaar?’ ‘Derde kast, tweede plank. En vraag het daarna even na bij de molenaar zelf.’');
  await say('pip', 'Toen kwam de elektriciteit. Daarna die computer in ’98. Daarna stof. Heel veel stof.');
  await say('pip', 'En nu staat er in de diepste kelder een Orakel dat álles weet. Sinds dat ding aanstaat, lekken zijn antwoorden door het hele Gewelf. Ze krijgen pootjes. Vleugeltjes. Tandjes.');
  await say('pip', 'Het Gewelf is gebouwd rond het raamwerk: vijftien kamers met de vragen die je moet stellen voordat je ja zegt tegen zoiets. Elke kamer heeft een hoeder. Wie het Orakel wil beoordelen, moet erlangs.');
  await say('pip', 'Ik ga met je mee. Iemand moet je bijlichten. Mijn licht noemen ze de Toetslamp: wat ik beschijn, wordt getoetst.');
  setStage('main', 4);
  UI.toast('De Toetslamp', 'Klik (of tik op ✦) om een lichtschot af te vuren. R of de rechtermuisknop laat het licht openbarsten.', 'quest');
  // the first monsters come for the light
  for (const [x, z] of [[19, 27], [29, 31]]) spawnEnemy('demo', x * TILE + 1, z * TILE + 1, {aware: true});
  await wait(0.4);
  await say('pip', 'Daar! Demo-dwaallichten. Ze glanzen, maar ze zijn hol. Schiet erop met de Toetslamp!');
});
ON.trigger.t_nepmuur = () => { if (stage('main') === 4) UI.pip('Hm. Die gouden muur glanst. Echte muren glanzen niet. Laat mijn licht openbarsten: druk op R.'); };
ON.use.nepmuur = () => {
  if (stage('main') <= 4) { setStage('main', 5); UI.pip('Zie je? Die muur was een belofte. Er zat niks achter. Nou ja, een gang. Op naar de Kamer van de Vraag!'); }
};
ON.zone.lampen = () => { if (!G.tools.lamp) UI.toast('Donker', 'Op een sokkel midden in de kamer gloeit iets zachtjes.', 'quest'); };
ON.zone.vraag = () => UI.pip('De Kamer van de Vraag. Hier begint elke afdaling. Of hij eindigt hier, als je de vraag niet goed stelt.');
ON.zone.gang = () => UI.pip('De Gang der Beloften. Alles hier glimt. Toets alles.');
ON.zone.archief = () => UI.pip('Het klachtenarchief. Elke la zit vol klachten die nooit zijn beantwoord. Ik krijg er de kriebels van.');

// ---- Vrouwe Waarom ----
ON.talk.waarom = () => async c => {
  const m = stage('main');
  if (m <= 5) {
    if (m < 5) setStage('main', 5, true);
    await say(c, 'Halt. Wie de Kamer van de Vraag betreedt, stelt eerst een vraag.');
    await say(c, 'Niet aan mij. Aan de mensen om wie het gaat.');
    await say(c, 'Boven wil iemand een Orakel. Maar welk probleem lost het op? Wie heeft er last van? Is er een eenvoudiger weg?');
    await say(c, 'Drie mensen dwalen door deze kelders: een inwoner, een medewerker van het klantcontact en de verkoper zelf. Hoor ze alle drie. Dan stel ik mijn vraag.');
    setStage('main', 6);
    await say('pip', 'Ze is altijd zo. Ze heeft ooit een burgemeester drie dagen laten wachten omdat hij ‘omdat het kan’ zei.');
    return;
  }
  if (m === 6) { await say(c, `Je hebt er ${heardCount('necessity')} van de drie gehoord. Luister verder. De inwoner, de medewerker, de verkoper.`); return; }
  if (m === 7) {
    await say(c, 'Drie stemmen. Drie kanten van hetzelfde probleem. Wat heb je gehoord?');
    await say('pip', 'Een derde van de vragen gaat over één onduidelijke brief. Niet iedereen kan of wil digitaal. En niemand heeft gemeten welke vragen er echt binnenkomen.');
    await say(c, 'Dan is dit mijn vraag. Wat moet je eerst vastleggen, voordat AI hier überhaupt een optie is?');
    const st = await decide('necessity', {who: 'waarom'});
    if (st === 'strong') await say(c, 'Goed gevraagd. Wie zo begint, weet straks ook wanneer hij moet stoppen.');
    else if (st === 'open') await say(c, 'Je bent op weg, maar er ontbreekt iets. Het dossier zal het onthouden. Je kunt hier altijd terugkomen.');
    else await say(c, 'Geen vraag gesteld. Dan neem je ook geen antwoord mee naar beneden. Het dossier zal het onthouden.');
    await say(c, 'Neem dit mee. Wie ‘waarom’ vraagt, leert wegen.');
    giveItem('tool:scale');
    await say(c, 'En deze bron, voor je dossier.');
    giveItem('bron:necessity:c');
    G.flags.f1_gate = true;
    setStage('main', 8);
    await say(c, 'Het hek van de Showroom staat open, achter de Gang der Beloften. Daar wacht de belofte die het hardst glimt.');
    await say('pip', 'De Weegschaal! Daarmee geef je bedenktijd. Haastkobolden kunnen daar niet tegen. Probeer hem maar eens (2).');
    return;
  }
  // after the decision: talk again to reconsider
  await say(c, 'Wil je je antwoord herzien? Het dossier onthoudt alleen je laatste keuze.');
  const i = await choose(['Ja, laat me opnieuw afwegen.', 'Nee, ik ga verder.']);
  if (i === 0) await decide('necessity', {who: 'waarom'});
};
ON.trialDone.necessity = () => { if (stage('main') <= 6) setStage('main', 7); UI.pip('Dat waren ze alle drie. Terug naar Vrouwe Waarom, bij de Bron.'); };

// ---- witness 1: Mevrouw Bakker in the wine cellar ----
ON.talk.bakker1 = () => async c => {
  if (!G.cleared.f1_wijn) { await say(c, 'Weg! Weg met die lichtjes! Ze willen me steeds iets verkopen!'); await say('pip', 'Eerst die dwaallichten wegtoetsen. Dan kun je met haar praten.'); return; }
  if (once('bakker1_met')) {
    await say(c, 'O, u bent het. De nieuwe. Ik zocht de balie waar een mens zit. Toen ging ik een trap af. En nog een trap.');
    await say(c, W3[0].line);
    const i = await choose(['Wat zou u wél helpen?', 'Zal ik u terugbrengen naar boven?']);
    if (i === 0) await say(c, 'Een brief die ik snap. En iemand die opneemt als ik bel. Meer vraag ik niet. Is dat nou zo moeilijk?');
    else await say(c, 'Nee hoor. Ik vind die balie zelf wel. Ik ben negenenzeventig, lief kind, niet dood.');
    heard('necessity', 0);
    startQuest('bakker');
    await say(c, 'Ik ga nog een stukje verder naar beneden. Ergens moet een mens zitten.');
    return;
  }
  await say(c, ['Gaat u maar. Ik red me wel. Ik heb een paraplu.', 'Als u die balie vindt, zeg dan dat ik eraan kom.'][G.stats.steps % 2]);
};

// ---- witness 2: Ilse in the complaints archive ----
ON.talk.ilse1 = () => async c => {
  if (G.flags['heard:necessity:1']) { await say(c, ['Als je boven bent: ik heb een nieuwe versie van de brief geschreven. Op de achterkant van een klacht.', 'Weet je wat ik het mooiste vind? Een probleem dat je met een pen kunt oplossen.'][G.stats.steps % 2]); return; }
  if (G.items['brief:afvalpas']) {
    await say(c, 'Je hebt hem! Kijk dan: ‘Met betrekking tot de modernisering van de inzamelingsstructuur…’ Zelfs ík snap het niet.');
    await say(c, W3[1].line);
    await say(c, 'Daar heb je geen Orakel voor nodig. Daar heb je een pen voor nodig. En iemand die eigenaar is van die brief.');
    const i = await choose(['Dus het probleem is niet de wachttijd?', 'Wat wil je dat ik met de brief doe?']);
    if (i === 0) await say(c, 'De wachttijd is het symptoom. De brief is één oorzaak. Er zijn er vast meer, maar niemand heeft ze ooit geteld.');
    else await say(c, 'Neem hem mee in je advies. Als we hem herschrijven, scheelt dat een derde van de telefoontjes. Zonder één regel code.');
    heard('necessity', 1);
    return;
  }
  if (once('ilse1_met')) {
    await say(c, 'Jij hier? Ik zoek die afvalpasbrief. Ik wil hem laten zien aan iemand die er wat mee kan.');
    await say(c, 'Hij moet hier ergens liggen, tussen de klachten. Achterin, denk ik. Pas op voor de papiergolem: die bestaat uit klachten die nooit zijn beantwoord. Hij is nogal… boos.');
    return;
  }
  await say(c, 'Heb je de brief al gevonden? Achterin het archief, in de noordoosthoek, denk ik.');
};
ON.pickup['brief:afvalpas'] = () => UI.pip('De afvalpasbrief! ‘Met betrekking tot de modernisering van de inzamelingsstructuur.’ Ik snap er niks van. Breng hem naar Ilse.');

// ---- witness 3: Glans, stuck in his own demo ----
ON.trigger.t_glanskooi = () => { if (!G.flags.glans_free) scene(async () => { await say('glans', 'Hallo? Is daar iemand? Ik zit vast in mijn eigen demo! De wanden zijn van goud! Nou ja… het líjkt goud!'); await say('pip', 'Die kooi is net zo echt als zijn garantie. Laat het licht openbarsten (R).'); }); };
ON.talk.glans1 = () => async c => {
  if (once('glans1_free')) {
    G.flags.glans_free = true;
    await say(c, 'Dank u! Die demo was zó overtuigend dat ik er zelf in geloofde. Letterlijk. Ik zat erin.');
    await say(c, W3[2].line);
    const i = await choose(['Dus jullie weten niet welke vragen inwoners stellen?', 'Hoe kom jij eigenlijk hier beneden?']);
    if (i === 0) await say(c, 'Weten, weten. We hebben een héél goed gevoel bij de vragen. Dat is ook een soort weten.');
    else await say(c, 'Met de Snelle Lift natuurlijk. Hij stopt overal. Behalve waar je moet zijn.');
    await say(c, 'Hier, neem een kaartje. Voor als u van gedachten verandert.');
    giveItem('card:6');
    heard('necessity', 2);
    return;
  }
  await say(c, ['De Showroom is verderop. Het pronkstuk staat er. Hij is iets… groter geworden dan in de folder.', 'Als u boven bent, zegt u dan tegen niemand dat ik vastzat? Slecht voor de verkoop.'][G.stats.steps % 2]);
};

// ---- the showroom and the gleaming demo ----
ON.trigger.t_showroom = () => {
  if (!G.flags.f1_gate || G.flags.boss_demo) return;
  ensureGroup('boss_demo');
  setStage('main', 9);
  scene(async () => {
    await say('nar', 'Midden in de Showroom staat een reusachtige, glimmende figuur. Op zijn scherm verschijnt een grote, witte glimlach.');
    await say('nar', '‘WELKOM BIJ DE DEMO! IK BEANTWOORD ALLE VRAGEN. OOK DIE U NOG NIET HEEFT!’');
    await say('pip', 'Dat is Glans’ demo, maar dan groot. Al dat glimmen houdt mijn licht tegen. Kom dichtbij, laat het licht openbarsten (R) en toets hem dan snel (1)!');
  });
};
ON.cleared.boss_demo = () => {
  G.flags.boss_demo = true;
  setStage('main', 10);
  scene(async () => {
    await say('pip', 'Karton! Het was karton met een lampje erin. En een heel goede presentatie.');
    await say('pip', 'De trap naar beneden is vrij. Diepte 2: de Hal der Fundamenten. Daar zie je pas of iets kan blijven staan.');
  });
  saveGame();
};

// ---- the old archive room (after finding Joop's keys on Diepte 2) ----
ON.zone.oudarchief = () => { if (stage('sleutelbos') === 1) setStage('sleutelbos', 2); UI.pip('Hier heeft Joop gewerkt. Ruik je dat? Oud papier en een beetje spijt.'); };
void P; void ent;
