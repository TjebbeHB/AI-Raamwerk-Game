// Diepte 2 · De Hal der Fundamenten.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {stage, setStage} from '../../game/quests.js';
import {say, choose, scene} from '../../game/dialogue.js';
import {giveItem, travel} from '../../game/game.js';
import {spawnEnemy} from '../../game/combat.js';
import {Crate} from '../../game/entities.js';
import {decide} from '../../ui/decision.js';
import {setupSort, restoreSort, completeTrial, trialDone, heard, heardCount, gathered} from '../puzzles.js';
import {CHAMBER} from '../framework.js';
import {labelSprite} from '../objects.js';
import {foundationsDone} from './common.js';
import {shortcut} from './f0.js';
import {TILE} from '../../core/util.js';

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const STONE = {governance: 'Eigenaarschap', culture: 'Draagvlak', capacity: 'Gedeeld geheugen', infrastructure: 'Weten waar je data staat'};

setupSort('governance', 'gov');

ON.floor.f2 = () => {
  if (stage('main') === 10) {
    setStage('main', 11, true);
    scene(async () => {
      await say('pip', 'De Hal der Fundamenten. Kijk die pilaren. Vier fundamenten die elke toepassing dragen. Drie zijn ingestort.');
      await say('pip', 'In het midden staat de grote lift naar beneden, maar die zakt pas als alle vier de fundamentstenen terug op hun voetstuk liggen.');
      await say('pip', 'Noord: Governance. Oost: Cultuur & Adoptie. West: Kennis & Capaciteit. Zuid: Infrastructuur & Data. Elke vleugel heeft een hoeder, en elke hoeder een proef.');
      setStage('main', 11);
    });
  }
  // stone pedestals and the lift
  for (const id of Object.keys(STONE)) { const s = ent(`slot_${id}`); if (s) s.def.placed = () => !!G.flags[`steen:${id}`]; }
  const lift = ent('biglift'); if (lift) lift.def.ready = () => !!G.flags.lift_ready;
  // labels above the data crates
  for (const e of W.ents) if (e instanceof Crate && e.def.label) { const s = labelSprite(e.def.label, {maxW: 18, color: e.def.kind === 'geheim' ? '#ffd0c0' : '#d0ffe0'}); s.position.y = 2.1; e.group.add(s); }
  if (G.flags['trial:infrastructure']) for (const e of W.ents) if (e instanceof Crate) e.def.fixed = true;
  restoreSort('gov');
};

// ---- the foundation stones ----
for (const id of Object.keys(STONE)) {
  ON.use[`slot_${id}`] = () => {
    if (G.flags[`steen:${id}`]) { UI.pip(`De steen van ${CHAMBER[id].title} ligt er. ${STONE[id]}.`); return; }
    if (!G.items[`steen:${id}`]) { UI.pip(`Hier hoort de fundamentsteen van ${CHAMBER[id].title}. Die krijg je van de hoeder van die vleugel.`); return; }
    G.flags[`steen:${id}`] = true;
    SFX.play('crystal'); UI.toast('Fundament hersteld', `${CHAMBER[id].title}: ${STONE[id]}. (${foundationsDone()}/4)`, 'good');
    saveGame();
    if (foundationsDone() >= 4) awakenKing();
  };
}
function awakenKing() {
  setStage('main', 12);
  scene(async () => {
    await say('nar', 'De vier stenen gloeien op. De grote lift kraakt en zakt een centimeter. En dan dendert er iets de hal in.');
    await say('nar', '‘WAAROM DUURT DIT ZO LANG?! VRIJDAG MOET HET LIVE! LIVE! LIVE!’');
    await say('pip', 'De Haastkoning! Hij wil de lift kapen om zonder stoppen naar beneden te stormen. Duik weg als hij aanstormt (Spatie), en geef hem bedenktijd met de Weegschaal (2)!');
    G.flags.king_awake = true;
    spawnEnemy('king', 31 * TILE + 1, 36 * TILE + 1, {group: 'boss_king', aware: true});
  });
}
ON.cleared.boss_king = () => {
  G.flags.lift_ready = true;
  setStage('main', 13);
  scene(async () => {
    await say('pip', 'Duizelig van al die bedenktijd. Hij rolt weg, op zoek naar een kortere deadline.');
    await say('pip', 'De lift is vrij! Op naar de Galerij der Domeinen. Daar wordt het pas echt specifiek.');
  });
};
ON.use.biglift = () => {
  if (!G.flags.lift_ready) { UI.pip(foundationsDone() < 4 ? `De lift zakt pas als alle vier de fundamenten staan (${foundationsDone()}/4).` : 'Eerst die koning van de lift af.'); return; }
  travel('f3', 'from_f2');
};

// ---- Glans has followed you down ----
ON.talk.glans2 = () => async c => {
  if (once('glans2_met')) {
    await say(c, 'U weer! Mijn Snelle Lift is meeverhuisd. Hij volgt u nu overal. Dat noemen wij klantgerichtheid.');
    await say(c, 'Hier, mijn nieuwste kaartje. Speciaal voor gemeenten.');
    giveItem('card:7');
  }
  return shortcutTalk(c);
};
async function shortcutTalk(c) {
  const i = await choose(['Ik neem de Snelle Lift.', 'Nee, dank je. Ik onderzoek verder.']);
  if (i === 0) return shortcut(c);
  await say(c, ['Zoals u wilt. Hij staat hier. Glimmend. Wachtend. Een beetje verdrietig.', 'Weet u wat het verschil is tussen onderzoek en uitstel? Ik ook niet!'][G.stats.steps % 2]);
}
ON.use.glanslift2 = () => scene(async () => { await say('nar', 'Dezelfde gouden deuren. Een nieuw bordje: ‘Nu ook op Diepte 2!’'); });

// ---- north: Griffel and the stamps ----
ON.zone.wachtkamer = () => UI.pip('De Wachtkamer van Doorverwijzing. Hier wordt elke vraag doorgestuurd naar een andere vraag. Kijk uit voor de Doorschuivers.');
ON.talk.griffel = () => async c => {
  if (once('griffel_met')) {
    await say(c, 'Welkom in de Raadzaal van Niemand. Ik ben Griffel, de griffier. Ik noteer alle besluiten. Er zijn er nog geen.');
    await say(c, CHAMBER.governance.hook);
    await say(c, 'Iedereen dacht dat een ander ze zou pakken. Twee stempels liggen in de wachtkamer, twee hier. Leg elke stempel bij de stoel die hem hoort te dragen.');
    await say('pip', 'Pak een stempel op met E, loop naar de juiste stoel en leg hem neer met E. Lees goed wat erop staat.');
    return;
  }
  if (!trialDone('governance')) { await say(c, `Nog niet alle stempels liggen op hun plek. ${CHAMBER.governance.trial.task}.`); return; }
  if (!G.items['steen:governance']) {
    await say(c, 'Kijk. Voor het eerst in jaren liggen de stempels ergens. Nu nog afspreken dat het zo blijft.');
    await say(c, CHAMBER.governance.scenario);
    const st = await decide('governance', {who: 'griffel'});
    await say(c, st === 'strong' ? 'Genoteerd. Het eerste echte besluit van deze raadzaal. Ik ben ontroerd.' : st === 'open' ? 'Genoteerd, met een kanttekening. Iemand moet nog ergens eigenaar van worden.' : 'Niets genoteerd. Ook dat noteer ik.');
    await say(c, 'Neem de fundamentsteen. Zonder eigenaar staat niets lang overeind.');
    giveItem('steen:governance'); giveItem('bron:governance:c');
    return;
  }
  await say(c, 'Wil je het besluit herzien? Ik noteer alleen het laatste.');
  if (await choose(['Ja, opnieuw afwegen.', 'Nee.']) === 0) await decide('governance', {who: 'griffel'});
};
ON.trialDone.governance = () => UI.pip('Alle stempels liggen op hun plek. Terug naar Griffel.');

// ---- east: Vonk and the four hesitant colleagues ----
const CULT = [
  {id: 'ans', opts: [['Laat zien waar antwoorden vandaan komen, en oefen samen met echte casussen.', true], ['Stel een verplicht gebruiksquotum in.', false, 'Een quotum? Dan ga ik dingen nalopen die ik niet vertrouw. Sneller word ik daar niet van.'], ['Geef haar een extra training over prompts.', false, 'Een training is aardig, maar het probleem is dat ik de antwoorden niet kan controleren.']]},
  {id: 'joris', opts: [['Zeg dat hij hem helemaal niet meer mag gebruiken.', false, 'Dan doe ik het gewoon thuis. Daar wordt het niet veiliger van.'], ['Maak duidelijk waar hij wel en niet voor bedoeld is, met voorbeelden.', true], ['Geef hem nog meer functies om mee te spelen.', false, 'Leuk! Maar dan weet ik nog steeds niet waar hij níét voor is.']]},
  {id: 'fatma', opts: [['Stuur haar een mail met de nieuwe regels.', false, 'Mijn team leest geen mails. Het team kijkt naar wat ik doe.'], ['Laat het team het zelf uitzoeken.', false, 'Dat doen ze al. Daarom werkt iedereen anders.'], ['Laat leidinggevenden zelf oefenen en hun ervaringen met het team delen.', true]]},
  {id: 'pieter', opts: [['Neem de training op en stuur de link.', false, 'Een opname is fijn. Maar ik heb vooral iemand nodig die ik iets kan vragen.'], ['Bied hulp op verschillende momenten, en een vast aanspreekpunt.', true], ['Zeg dat hij woensdag gewoon moet komen.', false, 'Woensdag werk ik niet. Daar is over nagedacht, toen ik mijn contract tekende.']]},
];
CULT.forEach((s, i) => {
  ON.talk[s.id] = () => async c => {
    if (G.flags[`heard:culture:${i}`]) { await say(c, ['Dank je. Ik voel me al minder… flauw.', 'Mijn lantaarn brandt weer. Voor het eerst.'][i % 2]); return; }
    await say(c, CHAMBER.culture.trial.witnesses[i].line);
    const k = await choose(s.opts.map(o => o[0]));
    if (s.opts[k][1]) {
      await say(c, 'Ja. Dát zou helpen.');
      ent(`vuur_${s.id}`)?.kindle();
      heard('culture', i);
    } else { SFX.play('wrong'); await say(c, s.opts[k][2]); }
  };
});
ON.talk.vonk = () => async c => {
  if (once('vonk_met')) {
    await say(c, 'O! Een bezoeker! Wil je een koekje? Ik heb een AI-spreekuur georganiseerd. Met koekjes.');
    await say(c, 'Alleen de koekjes worden goed gebruikt.');
    await say(c, CHAMBER.culture.trial.intro);
    await say('pip', 'Elke collega heeft een andere reden. Luister, en kies wat bij díé persoon past.');
    return;
  }
  if (!trialDone('culture')) { await say(c, `${heardCount('culture')} van de vier vonken branden. Vraag de anderen ook wat hen tegenhoudt.`); return; }
  if (!G.items['steen:culture']) {
    await say(c, 'Ze branden alle vier! Ik had niet gedacht dat het aan de koekjes lag. Het lag ook niet aan de koekjes.');
    await say(c, CHAMBER.culture.scenario);
    const st = await decide('culture', {who: 'vonk'});
    await say(c, st === 'strong' ? 'Precies! Iedereen een eigen vonk, en een eigen reden om te branden.' : st === 'open' ? 'Bijna. Eén aanpak voor iedereen dooft altijd wel ergens een vonk.' : 'Geen plan? Dan houd ik het maar bij koekjes.');
    await say(c, 'De fundamentsteen. En dit kristal: het gloeit van vertrouwen. Je kunt er meer mee hebben.');
    giveItem('steen:culture'); giveItem('bron:culture:c'); giveItem('kristal:2');
    return;
  }
  await say(c, 'Nog een koekje? Of wil je het plan herzien?');
  if (await choose(['Het plan herzien.', 'Een koekje, graag.']) === 0) await decide('culture', {who: 'vonk'});
  else { G.hp = Math.min(G.maxHp, G.hp + 10); UI.toast('Koekje', '+10 vertrouwen. Het is een heel goed koekje.', 'good'); }
};
ON.trialDone.culture = () => UI.pip('Alle vier de vonken branden! Terug naar Vonk.');
ON.zone.vonken = () => UI.pip('Het Huis van de Aarzelende Vonken. Vier collega’s laten hun licht uit. En er rennen haastkobolden rond die willen dat iedereen het nú gebruikt.');

// ---- west: Mallow, Henk and the shared memory ----
const ROLS = CHAMBER.capacity.trial.items;
ON.talk.mallow = () => async c => {
  if (once('mallow_met')) {
    await say(c, 'Welkom in de Werkplaats! Hier onderhouden we de assistent. Nou ja: Henk onderhoudt hem. Ik kijk.');
    await say(c, 'Alle kennis zit veilig opgeborgen in het hoofd van Henk. Henk gaat morgen op vakantie. Drie weken.');
    await say(c, CHAMBER.capacity.trial.intro);
    await say('pip', 'Vier rollen. Eén zit vast in Henks hoofd. De rest ligt ergens in deze werkplaats. Kijk ook achter muren die net iets te nieuw lijken.');
    return;
  }
  if (!trialDone('capacity')) { await say(c, `Je hebt ${gathered('capacity', 'rol')} van de vier rollen. Leg ze in het levende archief, de lessenaar in het midden.`); return; }
  if (!G.items['steen:capacity']) {
    await say(c, 'Het levende archief is gevuld. Als Henk nu op vakantie gaat, gaat de kennis niet mee.');
    await say(c, CHAMBER.capacity.scenario);
    const st = await decide('capacity', {who: 'mallow'});
    await say(c, st === 'strong' ? 'Zo houden we zelf de regie. Ook als de leverancier het onderhoud doet.' : st === 'open' ? 'Bijna. Maar wie beoordeelt straks de wijzigingen van de leverancier?' : 'Dan bel ik Henk wel op Texel. Hij zal blij zijn.');
    await say(c, 'De fundamentsteen. Gedeeld geheugen: het zwaarste en het lichtste fundament tegelijk.');
    giveItem('steen:capacity'); giveItem('bron:capacity:c');
    return;
  }
  await say(c, 'Wil je de afweging opnieuw doen?');
  if (await choose(['Ja.', 'Nee.']) === 0) await decide('capacity', {who: 'mallow'});
};
ON.talk.henk = () => async c => {
  if (G.items['rol:3']) { await say(c, ['Texel! Drie weken! Geen telefoon, geen mail, geen Orakel!', 'Als ze bellen: het staat in het archief. Wat een zin. Ik heb hem nooit eerder kunnen zeggen.'][G.stats.steps % 2]); return; }
  await say(c, 'Morgen ga ik naar Texel. Drie weken. Geen telefoon, geen mail, geen Orakel.');
  await say(c, 'Incidenten en herstel? Die staan hier.');
  await say('nar', 'Henk tikt tegen zijn voorhoofd.');
  const i = await choose(['Kun je het opschrijven voordat je gaat?', 'Fijne vakantie!']);
  if (i === 0) {
    await say(c, 'Opschrijven… Ja. Dat had ik eigenlijk al lang moeten doen. Geef me een minuut.');
    await say('nar', 'Henk schrijft drie kantjes vol. Dan nog drie. Dan zucht hij diep, en geeft je een rol.');
    giveItem('rol:3');
  } else await say(c, 'Dank je! En bel me niet.');
};
ON.use.archief_lessenaar = () => {
  const n = gathered('capacity', 'rol');
  if (trialDone('capacity')) { UI.pip('Het levende archief: keuzes, testresultaten, wijzigingen en incidenten. Op één plek. Met Mallow als eigenaar.'); return; }
  if (n < 4) { UI.pip(`Het levende archief is nog leeg. Er ontbreken ${4 - n} rollen: ${ROLS.filter((_, i) => !G.items[`rol:${i}`]).map(r => r.label.replace('Rol: ', '')).join(', ')}.`); return; }
  completeTrial('capacity');
};
ROLS.forEach((r, i) => { ON.pickup[`rol:${i}`] = () => UI.toast(r.label, r.found, 'quest'); });
ON.pickup.sleutelbos = () => { giveItem('key:archief'); if (stage('sleutelbos') < 1) setStage('sleutelbos', 1); UI.pip('Joops sleutelbos! Die van ’98. De sleutel van de oude archiefkamer hangt er nog aan. Dat is in Diepte 1, achter het klachtenarchief.'); };
ON.trialDone.capacity = () => UI.pip('Alle rollen liggen in het levende archief. Vertel het Mallow.');
ON.zone.werkplaats = () => UI.pip('De Werkplaats van het Gedeelde Geheugen. Ik ruik soldeertin en paniek.');

// ---- south: Wolk, the crates and the vault ----
const PLATES = ['plaat_o1', 'plaat_o2', 'plaat_g1', 'plaat_g2'];
for (const p of PLATES) ON.use[p] = () => {
  if (trialDone('infrastructure')) return;
  if (PLATES.every(k => G.flags[k])) {
    for (const e of W.ents) if (e instanceof Crate) e.def.fixed = true;
    completeTrial('infrastructure');
    UI.pip('Elke kist bij de poort die past. Hoor je dat? De kluis gaat open.');
  }
};
ON.use.reset_crates = () => { if (trialDone('infrastructure')) return; for (const e of W.ents) if (e instanceof Crate) e.resetHome(); for (const k of PLATES) G.flags[k] = false; UI.toast('Teruggezet', 'De datakisten staan weer op hun beginplek.'); };
ON.talk.wolk = () => async c => {
  if (once('wolk_met')) {
    await say(c, 'Welkom bij de Poort van de Verwisselbare Wolken! Ik verkoop de snelste wolkenpoort van het rijk.');
    await say(c, 'De uitgang staat helaas nog op de bouwtekening. Maar de ingang is prachtig.');
    await say(c, CHAMBER.infrastructure.trial.intro);
    await say('pip', 'Duw de kisten (loop er gewoon tegenaan) naar de platen die bij hun kleur passen: groen is openbaar, rood is gevoelig. Vast? De hendel zet alles terug.');
    return;
  }
  if (!trialDone('infrastructure')) { await say(c, 'Elke kist naar de poort die past. Openbaar naar de publieke wolk, gevoelig naar de kluis.'); return; }
  if (!G.items.blauwdruk && !G.items['steen:infrastructure']) {
    await say(c, 'De kluis is open. Pak daar het Zegel; daarmee kun je beschermen wat beschermd moet worden.');
    await say(c, 'En als je toch bezig bent: de bouwtekening van de nooduitgang ligt in de Lekkende Kelder. Ik heb hem daar ‘tijdelijk’ neergelegd. In 2019.');
    return;
  }
  if (!G.items['steen:infrastructure']) {
    await say(c, 'De bouwtekening! Kijk: een nooduitgang. Daar stond al die tijd ‘later invullen’ bij.');
    await say(c, CHAMBER.infrastructure.scenario);
    const st = await decide('infrastructure', {who: 'wolk'});
    await say(c, st === 'strong' ? 'Een poort mét uitgang. Wie had dat gedacht. Ik ga het meteen in de folder zetten.' : st === 'open' ? 'Je bent er bijna. Maar weet je ook hoe je er weer uit komt, met je data?' : 'Geen keuze? Dan neem ik de snelste poort. Die is altijd goed. Toch?');
    await say(c, 'De fundamentsteen is voor jou. Weten waar je data staat, is het begin.');
    giveItem('steen:infrastructure'); giveItem('bron:infrastructure:c');
    return;
  }
  await say(c, 'Opnieuw afwegen?');
  if (await choose(['Ja.', 'Nee.']) === 0) await decide('infrastructure', {who: 'wolk'});
};
ON.pickup['tool:seal'] = () => scene(async () => {
  await say('pip', 'Het Zegel! Beschermen en begrenzen. Een stevige stempelslag van dichtbij (3).');
  await say('pip', 'Datalekslijmen kun je alleen met het Zegel echt dichten. Anders lekken ze verder. En daar achter, in de Lekkende Kelder, sijpelt het nogal.');
});
ON.pickup.blauwdruk = () => UI.pip('De bouwtekening van de nooduitgang! Op de achterkant staat ‘later invullen’. Breng hem naar Wolk.');
ON.zone.wolken = () => UI.pip('De Poort van de Verwisselbare Wolken. Alles glimt hier van het metaal. En van de beloftes.');
ON.zone.lekkelder = () => UI.pip('De Lekkende Kelder. Overal sijpelt data. Zegel ze dicht, anders splitsen ze.');
void P; void ent; void heard;
