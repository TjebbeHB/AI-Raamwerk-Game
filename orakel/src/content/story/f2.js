// Diepte 2 · De Hal der Fundamenten.
// Four wings, four guardians, the Haastkoning, and the people in between: Henk and his handover,
// Kim who makes kwartier, Vonk's cookies, Glans and his lift music, and opa Joop's second stone.
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
import {formal} from '../../game/hero.js';
import {rel, relOf, met, choice, chose, findSecret, archOpt} from './systems.js';
import {TILE} from '../../core/util.js';

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = list => list[G.stats.steps % list.length];
const STONE = {governance: 'Eigenaarschap', culture: 'Draagvlak', capacity: 'Gedeeld geheugen', infrastructure: 'Weten waar je data staat'};
// optional questions in a conversation: only the ones that are shown, then the way out
const shown = opts => opts.filter(o => o.if === undefined || o.if);
async function chat(c, opts, bye = 'Ik ga verder.') {
  const list = shown(opts);
  if (!list.length) return;
  const i = await choose([...list, bye]);
  if (i < list.length) await list[i].run(c);
}
// after a decision: reconsider it, or one of the optional questions
async function reconsider(c, id, who, opts = []) {
  const list = shown(opts);
  const i = await choose(['Ja, opnieuw afwegen.', ...list, 'Nee.']);
  if (i === 0) await decide(id, {who});
  else if (i <= list.length) await list[i - 1].run(c);
}

setupSort('governance', 'gov');

ON.floor.f2 = () => {
  if (stage('main') === 10) {
    setStage('main', 11, true);
    scene(async () => {
      await say('pip', 'De Hal der Fundamenten. Kijk die pilaren. Vier fundamenten die elke toepassing dragen. Drie zijn ingestort.', {mood: 'surprised'});
      await say('pip', 'In het midden staat de grote lift naar beneden, maar die zakt pas als alle vier de fundamentstenen terug op hun voetstuk liggen.', {mood: 'thinking'});
      await say('pip', 'Noord: Governance. Oost: Cultuur & Adoptie. West: Kennis & Capaciteit. Zuid: Infrastructuur & Data. Elke vleugel heeft een hoeder, en elke hoeder een proef.', {mood: 'neutral'});
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
    await say('pip', 'De Haastkoning! Hij wil de lift kapen om zonder stoppen naar beneden te stormen. Duik weg als hij aanstormt (Spatie), en geef hem bedenktijd met de Weegschaal (2)!', {mood: 'worried'});
    G.flags.king_awake = true;
    spawnEnemy('king', 31 * TILE + 1, 36 * TILE + 1, {group: 'boss_king', aware: true});
  });
}
ON.cleared.boss_king = () => {
  G.flags.lift_ready = true;
  setStage('main', 13);
  scene(async () => {
    await say('pip', 'Duizelig van al die bedenktijd. Hij rolt weg, op zoek naar een kortere deadline.', {mood: 'laugh'});
    await say('pip', 'De lift is vrij! Op naar de Galerij der Domeinen. Daar wordt het pas echt specifiek.', {mood: 'happy'});
  });
};
ON.use.biglift = () => {
  if (!G.flags.lift_ready) { UI.pip(foundationsDone() < 4 ? `De lift zakt pas als alle vier de fundamenten staan (${foundationsDone()}/4).` : 'Eerst die koning van de lift af.'); return; }
  travel('f3', 'from_f2');
};
ON.use.opa2 = async s => {
  await UI.read(s.def.title, s.def.text);
  UI.pip('Opa Joop weer! Die man was overal. Ik denk dat hij die pilaar ook zelf heeft rechtgezet. Met zijn pet.');
};

// ---- Glans has followed you down, and so has his lift ----
ON.talk.glans2 = () => async c => {
  if (once('glans2_met')) {
    await say(c, 'U weer! Mijn Snelle Lift is meeverhuisd. Hij volgt u nu overal. Dat noemen wij klantgerichtheid.', {mood: 'smug'});
    await say(c, 'Hier, mijn nieuwste kaartje. Speciaal voor gemeenten.', {mood: 'happy'});
    giveItem('card:7');
    if (relOf('glans') >= 2) {
      await say(c, `Mag ik u iets toevertrouwen, ${formal()}? Die lift volgt u niet uit klantgerichtheid.`, {mood: 'worried'});
      await say(c, 'Ik weet niet hoe hij uit moet. In de handleiding staat alleen: ‘Uitzetten is niet nodig.’', {mood: 'sad'});
      G.flags.glans_lift_uit = true;
    }
  }
  return shortcutTalk(c);
};
async function shortcutTalk(c) {
  const i = await choose([
    'Ik neem de Snelle Lift.',
    'Nee, dank je. Ik onderzoek verder.',
    archOpt('datatovenaar', 'Hoeveel gemeenten nemen die lift eigenlijk, per week?', !G.flags.glans2_cijfers),
    archOpt('archivaris', 'Uw lift staat niet op de bouwtekening van het Gewelf.', !G.flags.glans2_tekening),
    archOpt('verbinder', 'Hoe gaat het met je auto, Glans?', G.flags.glans_week && !G.flags.glans2_auto),
  ]);
  if (i === 0) return shortcut(c);
  if (i === 2) {
    G.flags.glans2_cijfers = true;
    await say(c, 'Per week? In deze kelder? Eén. U. Bijna.', {mood: 'smug'});
    await say(c, 'Maar de groei is enorm. Van nul naar bijna één. Dat is oneindig procent.', {mood: 'laugh'});
  } else if (i === 3) {
    G.flags.glans2_tekening = true;
    await say(c, 'Daarom heet hij ook de Snelle Lift. Hij wacht niet op tekeningen.', {mood: 'smug'});
    await say(c, 'De tekeningen komen later. Samen met de uitgang.', {mood: 'worried'});
  } else if (i === 4) {
    G.flags.glans2_auto = true;
    await say(c, 'Mijn auto? Die staat er nog. Tot vrijdag.', {mood: 'sad'});
    await say(c, 'Ik heb hem gisteren nog gewassen. Voor het geval dat. U bent de enige die ernaar vraagt.', {mood: 'happy'});
    rel('glans', 1);
  } else await say(c, pick(['Zoals u wilt. Hij staat hier. Glimmend. Wachtend. Een beetje verdrietig.', 'Weet u wat het verschil is tussen onderzoek en uitstel? Ik ook niet!']), {mood: 'smug'});
}
// listen long enough and the lift plays you something
ON.use.glanslift2 = () => scene(async () => {
  const n = G.flags.lift2N = (G.flags.lift2N || 0) + 1;
  if (n === 1) { await say('nar', 'Dezelfde gouden deuren. Een nieuw bordje: ‘Nu ook op Diepte 2!’'); return; }
  if (n === 2) { await say('nar', 'Je legt je oor tegen de gouden deuren. Heel zacht klinkt er muziek. Een fluit? Meerdere fluiten?'); return; }
  if (n === 3) {
    await say('nar', 'Panfluit. Onmiskenbaar panfluit. En nu herken je het ook: het is de wachtmuziek van het klantcontactcentrum.');
    await say('pip', 'Dertig jaar wachtmuziek, en hij is nog steeds niet af. Hij begint gewoon opnieuw.', {mood: 'tired'});
    if (met('bakker')) await say('pip', 'Mevrouw Bakker kan hem meefluiten, weet je dat? Alle drie de coupletten.', {mood: 'laugh'});
    findSecret('liftmuziek');
    return;
  }
  await say('nar', pick(['De panfluit speelt door. Je merkt dat je meeneuriet. Dat is het begin.', 'Uit de lift klinkt: ‘Uw verzoek is belangrijk voor ons. U bent nummer… vier… in de wachtrij.’', 'Je luistert nog even. Het is, eerlijk is eerlijk, een lekker deuntje.']));
});

// ---- north: Kim makes kwartier, Griffel and the stamps ----
ON.zone.wachtkamer = () => UI.pip('De Wachtkamer van Doorverwijzing. Hier wordt elke vraag doorgestuurd naar een andere vraag. Kijk uit voor de Doorschuivers.');
ON.talk.kim = () => async c => {
  if (once('kim_met')) {
    await say(c, 'Kim. Kwartiermaker. Sinds 2019.', {mood: 'neutral'});
    await say(c, 'Ik maak kwartier voor het programma dat het project voorbereidt.', {mood: 'smug'});
    await say(c, 'Het project is er nog niet. Het programma ook niet. Maar het kwartier staat als een huis.', {mood: 'happy'});
    await say(c, 'Hier, dit hoort bij mijn functie. Ik deel er een uit op elke startbijeenkomst. Er zijn er al veel geweest.', {mood: 'laugh'});
    giveItem('bingo:kwartiermaker');
  } else if (chose('kim_besluit', 'besluit')) {
    await say(c, pick(['Ik heb vandaag al twee besluiten genomen. Het tweede was: lunchen.', 'Ik heb mijn klembord weggelegd. Het voelt alsof ik iets mis. Het is mijn klembord.', 'Weet je wat het rare is? Sinds ik gestopt ben, vraagt iedereen wanneer ik begin.']), {mood: 'happy'});
    return;
  } else await say(c, pick(['Nog steeds kwartier aan het maken. Het is een groot kwartier.', 'Ik heb net de planning van de planning gepland. Morgen evalueer ik hem.']), {mood: 'tired'});
  for (;;) {
    const i = await choose([
      'Neem vandaag één besluit. Eén maar.',
      archOpt('handhaver', 'Wie is eigenaar van jouw programma?', !G.flags.kim_eigenaar),
      archOpt('datatovenaar', 'Hoeveel kwartieren heb je al gemaakt?', !G.flags.kim_kwartieren),
      archOpt('verbinder', 'Vind je het eigenlijk leuk, kwartier maken?', !G.flags.kim_leuk),
      'Succes met het kwartier.',
    ]);
    if (i === 1) {
      G.flags.kim_eigenaar = true;
      await say(c, 'Het programma zelf. Dat is het probleem, hè?', {mood: 'thinking'});
      await say(c, 'Ik heb het ooit gevraagd in de stuurgroep. Die heeft een werkgroep opgericht om het uit te zoeken. De werkgroep maakt nu ook kwartier.', {mood: 'tired'});
      continue;
    }
    if (i === 2) {
      G.flags.kim_kwartieren = true;
      await say(c, 'Achtentwintig. Eén per kwartaal.', {mood: 'smug'});
      await say(c, 'Achter elkaar is dat zeven jaar. Dat is geen toeval. Dat is planning.', {mood: 'laugh'});
      continue;
    }
    if (i === 3) {
      G.flags.kim_leuk = true;
      await say(c, 'Leuk?', {mood: 'surprised'});
      await say(c, 'Ik ben ooit begonnen omdat ik dingen wilde maken. Nu maak ik ruimte voor dingen. Heel veel ruimte. Er staat nog niks in.', {mood: 'sad'});
      rel('kim', 1, {silent: true});
      continue;
    }
    if (i === 0) {
      await say(c, 'Eén besluit? Vandaag?', {mood: 'surprised'});
      await say(c, 'Dat staat niet in mijn plan van aanpak. Mijn plan van aanpak gaat over het plan van aanpak.', {mood: 'worried'});
      await say('nar', 'Kim kijkt heel lang naar haar klembord. Dan legt ze het neer.');
      await say(c, 'Een besluit. Ik… stop met kwartier maken. Dat is mijn besluit.', {mood: 'happy'});
      await say(c, 'Is dit hoe het voelt? Het voelt als vrijdagmiddag.', {mood: 'laugh'});
      choice('kim_besluit', {npc: 'kim', label: 'Kim de kwartiermaker', text: 'Je vroeg Kim om vandaag één besluit te nemen. Ze stopte met kwartier maken.', pick: 'besluit'});
      rel('kim', 2);
      return;
    }
    await say(c, 'Dank je. Het is een kwartier dat er mag zijn.', {mood: 'smug'});
    choice('kim_besluit', {npc: 'kim', label: 'Kim de kwartiermaker', text: 'Je wenste Kim succes met het kwartier.', pick: 'kwartier'});
    return;
  }
};
const griffelExtra = () => [
  {...archOpt('handhaver', 'Wie tekent hier eigenlijk voor?', !G.flags.griffel_tekent), run: async c => {
    G.flags.griffel_tekent = true;
    await say(c, 'Niemand. Daarom heet dit de Raadzaal van Niemand. We hebben het bordje zelf gemaakt.', {mood: 'smug'});
    await say(c, 'Het is niet ondertekend.', {mood: 'tired'});
  }},
  {...archOpt('archivaris', 'Waar liggen de notulen van de vorige vergadering?', !G.flags.griffel_notulen), run: async c => {
    G.flags.griffel_notulen = true;
    await say(c, 'Die zijn nog niet vastgesteld. De vergadering die ze moest vaststellen, is nog niet genotuleerd.', {mood: 'tired'});
    await say(c, 'Jij bent de eerste in jaren die ernaar vraagt. Ik noteer het. Dan hebben we tenminste íéts.', {mood: 'happy'});
  }},
];
ON.talk.griffel = () => async c => {
  if (once('griffel_met')) {
    await say(c, 'Welkom in de Raadzaal van Niemand. Ik ben Griffel, de griffier. Ik noteer alle besluiten. Er zijn er nog geen.', {mood: 'neutral'});
    await say(c, CHAMBER.governance.hook, {mood: 'thinking'});
    await say(c, 'Iedereen dacht dat een ander ze zou pakken. Twee stempels liggen in de wachtkamer, twee hier. Leg elke stempel bij de stoel die hem hoort te dragen.', {mood: 'neutral'});
    await say('pip', 'Pak een stempel op met E, loop naar de juiste stoel en leg hem neer met E. Lees goed wat erop staat.');
    return;
  }
  if (!trialDone('governance')) { await say(c, `Nog niet alle stempels liggen op hun plek. ${CHAMBER.governance.trial.task}.`, {mood: 'neutral'}); return chat(c, griffelExtra()); }
  if (!G.items['steen:governance']) {
    await say(c, 'Kijk. Voor het eerst in jaren liggen de stempels ergens. Nu nog afspreken dat het zo blijft.', {mood: 'happy'});
    await say(c, CHAMBER.governance.scenario);
    const st = await decide('governance', {who: 'griffel'});
    await say(c, st === 'strong' ? 'Genoteerd. Het eerste echte besluit van deze raadzaal. Ik ben ontroerd.' : st === 'open' ? 'Genoteerd, met een kanttekening. Iemand moet nog ergens eigenaar van worden.' : 'Niets genoteerd. Ook dat noteer ik.', {mood: st === 'strong' ? 'happy' : st === 'open' ? 'thinking' : 'sad'});
    await say(c, 'Neem de fundamentsteen. Zonder eigenaar staat niets lang overeind.', {mood: 'neutral'});
    giveItem('steen:governance'); giveItem('bron:governance:c');
    return;
  }
  await say(c, 'Wil je het besluit herzien? Ik noteer alleen het laatste.', {mood: 'neutral'});
  return reconsider(c, 'governance', 'griffel', griffelExtra());
};
ON.trialDone.governance = () => UI.pip('Alle stempels liggen op hun plek. Terug naar Griffel.');

// ---- east: Vonk, his cookies and the four hesitant colleagues ----
const CULT = [
  {id: 'ans', opts: [['Laat zien waar antwoorden vandaan komen, en oefen samen met echte casussen.', true], ['Stel een verplicht gebruiksquotum in.', false, 'Een quotum? Dan ga ik dingen nalopen die ik niet vertrouw. Sneller word ik daar niet van.'], ['Geef haar een extra training over prompts.', false, 'Een training is aardig, maar het probleem is dat ik de antwoorden niet kan controleren.']]},
  {id: 'joris', opts: [['Zeg dat hij hem helemaal niet meer mag gebruiken.', false, 'Dan doe ik het gewoon thuis. Daar wordt het niet veiliger van.'], ['Maak duidelijk waar hij wel en niet voor bedoeld is, met voorbeelden.', true], ['Geef hem nog meer functies om mee te spelen.', false, 'Leuk! Maar dan weet ik nog steeds niet waar hij níét voor is.']]},
  {id: 'fatma', opts: [['Stuur haar een mail met de nieuwe regels.', false, 'Mijn team leest geen mails. Het team kijkt naar wat ik doe.'], ['Laat het team het zelf uitzoeken.', false, 'Dat doen ze al. Daarom werkt iedereen anders.'], ['Laat leidinggevenden zelf oefenen en hun ervaringen met het team delen.', true]]},
  {id: 'pieter', opts: [['Neem de training op en stuur de link.', false, 'Een opname is fijn. Maar ik heb vooral iemand nodig die ik iets kan vragen.'], ['Bied hulp op verschillende momenten, en een vast aanspreekpunt.', true], ['Zeg dat hij woensdag gewoon moet komen.', false, 'Woensdag werk ik niet. Daar is over nagedacht, toen ik mijn contract tekende.']]},
];
CULT.forEach((s, i) => {
  ON.talk[s.id] = () => async c => {
    if (G.flags[`heard:culture:${i}`]) { await say(c, ['Dank je. Ik voel me al minder… flauw.', 'Mijn lantaarn brandt weer. Voor het eerst.'][i % 2], {mood: 'happy'}); return; }
    await say(c, CHAMBER.culture.trial.witnesses[i].line, {mood: 'worried'});
    const k = await choose(s.opts.map(o => o[0]));
    if (s.opts[k][1]) {
      await say(c, 'Ja. Dát zou helpen.', {mood: 'happy'});
      ent(`vuur_${s.id}`)?.kindle();
      heard('culture', i);
    } else { SFX.play('wrong'); await say(c, s.opts[k][2], {mood: 'sad'}); }
  };
});
// three cookies on the plate, and the third one is the last
async function koekje(c) {
  const n = G.flags.koekjes = (G.flags.koekjes || 0) + 1;
  if (n > 3) { await say(c, 'De schaal is leeg. Er ligt alleen nog een briefje: ‘Koekjes zijn op. Vragen over AI kunnen nog wel.’', {mood: 'sad'}); return; }
  G.hp = Math.min(G.maxHp, G.hp + 10);
  UI.toast('Koekje', '+10 vertrouwen. Het is een heel goed koekje.', 'good');
  if (n === 1) await say(c, 'Neem er gerust een. Ik heb er drie gebakken. Voor de drukte.', {mood: 'happy'});
  else if (n === 2) await say(c, 'Nog eentje? Natuurlijk. Er komt toch niemand.', {mood: 'laugh'});
  else {
    await say(c, 'Dat… was het laatste koekje.', {mood: 'surprised'});
    await say(c, 'Weet je dat dat het populairste onderdeel van het hele spreekuur was?', {mood: 'sad'});
    await say(c, 'Ik stuur je een evaluatie. Vraag één: wat vond u van het koekje?', {mood: 'laugh'});
    findSecret('koekjes');
  }
}
const vonkExtra = () => [
  {t: 'Een koekje, graag.', if: (G.flags.koekjes || 0) < 3, run: koekje},
  {...archOpt('verbinder', 'Hoe gaat het eigenlijk met jóú, Vonk?', !G.flags.vonk_hoe), run: async c => {
    G.flags.vonk_hoe = true;
    await say(c, 'Met mij? Ik ben de vonk. Vonken vraagt nooit iemand iets. Die moeten gewoon branden.', {mood: 'sad'});
    await say(c, 'Maar nu je het vraagt: ik ben een beetje moe. Elke week een spreekuur, en er komt nooit iemand. Behalve voor de koekjes.', {mood: 'tired'});
  }},
  {...archOpt('datatovenaar', 'Hoeveel mensen kwamen er vorige week op je spreekuur?', !G.flags.vonk_cijfers), run: async c => {
    G.flags.vonk_cijfers = true;
    await say(c, 'Drie! Twee voor de koekjes, en één had zich in de deur vergist.', {mood: 'laugh'});
    await say(c, 'Die laatste heb ik toch geholpen. Hij zocht de wc. Hij gebruikt nu AI.', {mood: 'smug'});
  }},
];
ON.talk.vonk = () => async c => {
  if (once('vonk_met')) {
    await say(c, 'O! Een bezoeker! Wil je een koekje? Ik heb een AI-spreekuur georganiseerd. Met koekjes.', {mood: 'happy'});
    await say(c, 'Alleen de koekjes worden goed gebruikt.', {mood: 'sad'});
    await say(c, CHAMBER.culture.trial.intro);
    await say('pip', 'Elke collega heeft een andere reden. Luister, en kies wat bij díé persoon past.');
    return;
  }
  if (!trialDone('culture')) { await say(c, `${heardCount('culture')} van de vier vonken branden. Vraag de anderen ook wat hen tegenhoudt.`, {mood: 'thinking'}); return chat(c, vonkExtra()); }
  if (!G.items['steen:culture']) {
    await say(c, 'Ze branden alle vier! Ik had niet gedacht dat het aan de koekjes lag. Het lag ook niet aan de koekjes.', {mood: 'happy'});
    await say(c, CHAMBER.culture.scenario);
    const st = await decide('culture', {who: 'vonk'});
    await say(c, st === 'strong' ? 'Precies! Iedereen een eigen vonk, en een eigen reden om te branden.' : st === 'open' ? 'Bijna. Eén aanpak voor iedereen dooft altijd wel ergens een vonk.' : 'Geen plan? Dan houd ik het maar bij koekjes.', {mood: st === 'strong' ? 'laugh' : 'thinking'});
    await say(c, 'De fundamentsteen. En dit kristal: het gloeit van vertrouwen. Je kunt er meer mee hebben.', {mood: 'happy'});
    giveItem('steen:culture'); giveItem('bron:culture:c'); giveItem('kristal:2');
    return;
  }
  await say(c, 'Nog een koekje? Of wil je het plan herzien?', {mood: 'happy'});
  return reconsider(c, 'culture', 'vonk', vonkExtra());
};
ON.trialDone.culture = () => UI.pip('Alle vier de vonken branden! Terug naar Vonk.');
ON.zone.vonken = () => UI.pip('Het Huis van de Aarzelende Vonken. Vier collega’s laten hun licht uit. En er rennen haastkobolden rond die willen dat iedereen het nú gebruikt.');
ON.use.draagvlakposter = () => UI.toast('Draagvlak', 'Op de poster staat: ‘Draagvlak peilen? Vul de enquête over de enquête in!’ Het stapeltje enquêtes eronder is nog net zo hoog als in 2019.');

// ---- west: Mallow, Henk and the shared memory ----
const ROLS = CHAMBER.capacity.trial.items;
const mallowExtra = () => [
  {...archOpt('datatovenaar', 'Hoeveel staat er eigenlijk al gedocumenteerd?', !G.flags.mallow_docs), run: async c => {
    G.flags.mallow_docs = true;
    await say(c, 'Eén document. Het heet ‘Vraag het Henk’.', {mood: 'smug'});
    await say(c, 'Het is heel compleet. Zolang Henk er is.', {mood: 'worried'});
  }},
];
ON.talk.mallow = () => async c => {
  if (once('mallow_met')) {
    await say(c, 'Welkom in de Werkplaats! Hier onderhouden we de assistent. Nou ja: Henk onderhoudt hem. Ik kijk.', {mood: 'happy'});
    await say(c, 'Alle kennis zit veilig opgeborgen in het hoofd van Henk. Henk gaat morgen op vakantie. Drie weken.', {mood: 'worried'});
    await say(c, CHAMBER.capacity.trial.intro);
    await say('pip', 'Vier rollen. Eén zit vast in Henks hoofd. De rest ligt ergens in deze werkplaats. Kijk ook achter muren die net iets te nieuw lijken.');
    return;
  }
  if (!trialDone('capacity')) { await say(c, `Je hebt ${gathered('capacity', 'rol')} van de vier rollen. Leg ze in het levende archief, de lessenaar in het midden.`, {mood: 'thinking'}); return chat(c, mallowExtra()); }
  if (!G.items['steen:capacity']) {
    await say(c, 'Het levende archief is gevuld. Als Henk nu op vakantie gaat, gaat de kennis niet mee.', {mood: 'happy'});
    await say(c, CHAMBER.capacity.scenario);
    const st = await decide('capacity', {who: 'mallow'});
    await say(c, st === 'strong' ? 'Zo houden we zelf de regie. Ook als de leverancier het onderhoud doet.' : st === 'open' ? 'Bijna. Maar wie beoordeelt straks de wijzigingen van de leverancier?' : 'Dan bel ik Henk wel op Texel. Hij zal blij zijn.', {mood: st === 'strong' ? 'happy' : 'thinking'});
    await say(c, 'De fundamentsteen. Gedeeld geheugen: het zwaarste en het lichtste fundament tegelijk.', {mood: 'neutral'});
    giveItem('steen:capacity'); giveItem('bron:capacity:c');
    return;
  }
  await say(c, 'Wil je de afweging opnieuw doen?', {mood: 'neutral'});
  return reconsider(c, 'capacity', 'mallow', mallowExtra());
};
// Henk and the handover: written down, together, or not at all (you can come back, the last choice wins)
const handover = (pk, text) => choice('henk_overdracht', {npc: 'henk', label: 'De overdracht van Henk', text, pick: pk});
const henkRol = () => { if (!G.items['rol:3']) giveItem('rol:3'); };
ON.talk.henk = () => async c => {
  const ov = chose('henk_overdracht');
  if (ov === 'samen' || ov === 'opschrijven') {
    await say(c, pick(['Texel! Drie weken! Geen telefoon, geen mail, geen Orakel!', 'Als ze bellen: het staat in het archief. Wat een zin. Ik heb hem nooit eerder kunnen zeggen.',
      ov === 'samen' ? 'Weet je wat ik op Texel ga doen? Niks. Het staat opgeschreven, dus ik hoef het niet meer te onthouden.' : 'Ik heb nog één ding vergeten op te schrijven. Wat de knop doet. Maar dat weet iedereen. Toch?']), {mood: 'happy'});
    return;
  }
  if (ov === 'niet') await say(c, 'Toch nog even terug? Ik ga pas morgen. Of overmorgen. Ik heb nog niks ingepakt, behalve mijn zorgen.', {mood: 'tired'});
  else {
    await say(c, 'Morgen ga ik naar Texel. Drie weken. Geen telefoon, geen mail, geen Orakel.', {mood: 'happy'});
    await say(c, 'Incidenten en herstel? Die staan hier.', {mood: 'smug'});
    await say('nar', 'Henk tikt tegen zijn voorhoofd.');
  }
  for (;;) {
    const i = await choose([
      'Kun je het opschrijven voordat je gaat?',
      'Zullen we het samen doen? Jij vertelt, ik schrijf.',
      archOpt('verbinder', 'Heb jij eigenlijk zin in die vakantie, Henk?', !G.flags.henk_zin),
      archOpt('datatovenaar', 'Hoeveel incidenten waren het vorig jaar?', !G.flags.henk_cijfers),
      'Fijne vakantie!',
    ]);
    if (i === 2) {
      G.flags.henk_zin = true;
      await say(c, 'Zin?', {mood: 'surprised'});
      await say(c, 'Eerlijk? Ik ben bang dat ik op Texel aan incidenten denk. Dat ik op het strand sta en denk: zou de knop het nog doen?', {mood: 'worried'});
      rel('henk', 1, {silent: true});
      continue;
    }
    if (i === 3) {
      G.flags.henk_cijfers = true;
      await say(c, 'Veertien. Dertien waren de knop.', {mood: 'smug'});
      await say(c, 'De veertiende was ook de knop, maar dan een andere knop. Die staat nergens beschreven.', {mood: 'tired'});
      continue;
    }
    if (i === 0) {
      await say(c, 'Opschrijven… Ja. Dat had ik eigenlijk al lang moeten doen. Geef me een minuut.', {mood: 'thinking'});
      await say('nar', 'Henk schrijft drie kantjes vol. Dan nog drie. Dan zucht hij diep, en geeft je een rol.');
      henkRol();
      handover('opschrijven', 'Je vroeg Henk zijn kennis op te schrijven voordat hij op vakantie ging.');
      rel('henk', 1);
    } else if (i === 1) {
      await say(c, 'Samen?', {mood: 'surprised'});
      await say(c, 'Niemand vraagt ooit of ik iets wil vertellen. Ze vragen alleen of ik het even wil oplossen.', {mood: 'happy'});
      await say('nar', 'Henk vertelt. Jij schrijft. Over de knop, de andere knop, en de knop die je nooit moet aanraken. Een uur later ligt er een rol, en Henk lacht.');
      await say(c, 'Zo leuk heb ik het nog nooit gehad. Over incidenten.', {mood: 'laugh'});
      await say(c, 'Hier. Mijn mok. Voor de volgende overdracht. Er zit nog een kringetje thee in, uit 2021. Niet afwassen, dat is erfgoed.', {mood: 'happy'});
      giveItem('trinket:mok');
      henkRol();
      handover('samen', 'Je deed de overdracht samen met Henk: hij vertelde, jij schreef.');
      rel('henk', 2);
    } else {
      await say(c, 'Dank je! En bel me niet.', {mood: 'happy'});
      await say('nar', 'Henk pakt zijn tas. Dan zet hij hem weer neer. ‘Misschien ga ik toch pas morgen,’ mompelt hij. ‘Kom gerust nog even terug.’');
      handover('niet', 'Je wenste Henk een fijne vakantie. De kennis ging mee naar Texel.');
    }
    return;
  }
};
ON.use.henksla = () => UI.read('De bureaula van Henk', 'In de la liggen 37 uitdraaien.\n\n‘overdracht_DEFINITIEF.docx’, ‘overdracht_DEFINITIEF_v2.docx’, ‘overdracht_DEFINITIEF_echt.docx’, ‘overdracht_DEFINITIEF_echt_NIEUW (2).docx’…\n\nZe zijn allemaal leeg. Op de laatste staat één zin: ‘Vraag het Henk.’\n\nHelemaal achterin: een zonnebrandstick, factor 50, en een schelp van Texel uit 2019.');
ON.use.archief_lessenaar = () => {
  const n = gathered('capacity', 'rol');
  if (trialDone('capacity')) { UI.pip('Het levende archief: keuzes, testresultaten, wijzigingen en incidenten. Op één plek. Met Mallow als eigenaar.'); return; }
  if (n < 4) { UI.pip(`Het levende archief is nog leeg. Er ontbreken ${4 - n} rollen: ${ROLS.filter((_, i) => !G.items[`rol:${i}`]).map(r => r.label.replace('Rol: ', '')).join(', ')}.`); return; }
  completeTrial('capacity');
};
ROLS.forEach((r, i) => { ON.pickup[`rol:${i}`] = () => UI.toast(r.label, r.found, 'quest'); });
ON.pickup.sleutelbos = () => {
  giveItem('key:archief');
  if (stage('sleutelbos') < 1) setStage('sleutelbos', 1);
  UI.pip(chose('joop_sleutelbos', 'belofte') ? 'Joops sleutelbos! Die van ’98. Je had het Joop beloofd, toch? Dan moet hij terug. Maar eerst: de sleutel van de oude archiefkamer hangt eraan. Diepte 1, achter het klachtenarchief.'
    : 'Joops sleutelbos! Die van ’98. De sleutel van de oude archiefkamer hangt er nog aan. Dat is in Diepte 1, achter het klachtenarchief.');
};
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
const wolkExtra = () => [
  {...archOpt('handhaver', 'Wie heeft die poort zonder uitgang eigenlijk goedgekeurd?', !G.flags.wolk_akkoord), run: async c => {
    G.flags.wolk_akkoord = true;
    await say(c, 'Goedgekeurd? Hij is gekocht. Dat is iets anders. Goedkeuren duurt veel langer.', {mood: 'smug'});
  }},
];
ON.talk.wolk = () => async c => {
  if (once('wolk_met')) {
    await say(c, 'Welkom bij de Poort van de Verwisselbare Wolken! Ik verkoop de snelste wolkenpoort van het rijk.', {mood: 'happy'});
    await say(c, 'De uitgang staat helaas nog op de bouwtekening. Maar de ingang is prachtig.', {mood: 'smug'});
    await say(c, CHAMBER.infrastructure.trial.intro);
    await say('pip', 'Duw de kisten (loop er gewoon tegenaan) naar de platen die bij hun kleur passen: groen is openbaar, rood is gevoelig. Vast? De hendel zet alles terug.');
    return;
  }
  if (!trialDone('infrastructure')) { await say(c, 'Elke kist naar de poort die past. Openbaar naar de publieke wolk, gevoelig naar de kluis.', {mood: 'neutral'}); return chat(c, wolkExtra()); }
  if (!G.items.blauwdruk && !G.items['steen:infrastructure']) {
    await say(c, 'De kluis is open. Pak daar het Zegel; daarmee kun je beschermen wat beschermd moet worden.', {mood: 'happy'});
    await say(c, 'En als je toch bezig bent: de bouwtekening van de nooduitgang ligt in de Lekkende Kelder. Ik heb hem daar ‘tijdelijk’ neergelegd. In 2019.', {mood: 'worried'});
    return;
  }
  if (!G.items['steen:infrastructure']) {
    await say(c, 'De bouwtekening! Kijk: een nooduitgang. Daar stond al die tijd ‘later invullen’ bij.', {mood: 'surprised'});
    await say(c, CHAMBER.infrastructure.scenario);
    const st = await decide('infrastructure', {who: 'wolk'});
    await say(c, st === 'strong' ? 'Een poort mét uitgang. Wie had dat gedacht. Ik ga het meteen in de folder zetten.' : st === 'open' ? 'Je bent er bijna. Maar weet je ook hoe je er weer uit komt, met je data?' : 'Geen keuze? Dan neem ik de snelste poort. Die is altijd goed. Toch?', {mood: st === 'strong' ? 'happy' : 'thinking'});
    await say(c, 'De fundamentsteen is voor jou. Weten waar je data staat, is het begin.', {mood: 'neutral'});
    giveItem('steen:infrastructure'); giveItem('bron:infrastructure:c');
    return;
  }
  await say(c, 'Opnieuw afwegen?', {mood: 'neutral'});
  return reconsider(c, 'infrastructure', 'wolk', wolkExtra());
};
ON.pickup['tool:seal'] = () => scene(async () => {
  await say('pip', 'Het Zegel! Beschermen en begrenzen. Een stevige stempelslag van dichtbij (3).', {mood: 'happy'});
  await say('pip', 'Datalekslijmen kun je alleen met het Zegel echt dichten. Anders lekken ze verder. En daar achter, in de Lekkende Kelder, sijpelt het nogal.', {mood: 'worried'});
});
ON.pickup.blauwdruk = () => UI.pip('De bouwtekening van de nooduitgang! Op de achterkant staat ‘later invullen’. Breng hem naar Wolk.');
ON.use.badeend = async o => {
  await UI.read(o.def.title, o.def.text);
  UI.pip('…');
  setTimeout(() => UI.pip('Ik zeg niks. Ik zeg helemaal niks.'), 1800);
};
ON.zone.wolken = () => UI.pip('De Poort van de Verwisselbare Wolken. Alles glimt hier van het metaal. En van de beloftes.');
ON.zone.lekkelder = () => UI.pip('De Lekkende Kelder. Overal sijpelt data. Zegel ze dicht, anders splitsen ze.');
void P; void ent; void heard; void Cap;
