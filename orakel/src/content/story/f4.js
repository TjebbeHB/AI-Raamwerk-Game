// Diepte 4 · De Drempel, de Kern en de Zegelkamer.
// Glans in his cocoon (and whether he fights along), the evidence you throw back at the Fabulant,
// the Orakel's first joke, and the Zegelkamer where everyone you met comes to see how it ends.
import {ON, UI, SFX, P, chamberState, cond} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {stage, setStage} from '../../game/quests.js';
import {say, choose, scene, wait} from '../../game/dialogue.js';
import {giveItem, GAME} from '../../game/game.js';
import {spawnEnemy, C} from '../../game/combat.js';
import {PL} from '../../game/player.js';
import {FX} from '../../engine/particles.js';
import {decideVerdict, verdictEnding} from '../../ui/verdict.js';
import {clearTendrils, weakenFabulant} from '../bosses.js';
import {CHAMBERS, STATE_LABEL, STORY, VERDICT} from '../framework.js';
import {HALLUCS} from '../items.js';
import {heroName, formal} from '../../game/hero.js';
import {rel, relOf, met, choice, chose, findSecret, award, unlock, notice, whenFree} from './systems.js';
import {TILE} from '../../core/util.js';

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = list => list[G.stats.steps % list.length];
const found = id => G.secrets.includes(id);
const STATE_COL = {strong: '#c8f0d0', open: '#ffe2a6', blind: '#b0a8a0'};
// who comes to the seal chamber: only the people you actually met on the way down
const GUESTS = {kok4: () => met('burger1'), sanne4: () => met('burger2'), dewit4: () => met('burger3'), eend4: () => found('eend'),
  daan4: () => found('stagiair'), wouter4: () => met('wouter'), kim4: () => met('kim'), henk4: () => met('henk')};

ON.floor.f4 = () => {
  if (stage('main') === 16) {
    setStage('main', 17, true);
    scene(async () => {
      await say('pip', 'De Drempel. Hoor je dat gezoem? Dat is het Orakel. We zijn dichtbij.', {mood: 'worried'});
      await say('pip', 'Hier is bijna niets wat het lijkt. Toets elke stap.', {mood: 'thinking'});
      setStage('main', 17);
    });
  }
  // the dossier glows on the plaques of the seal chamber
  for (const c of CHAMBERS) { const p = ent(`plaat_${c.id}`); p?.refresh?.(`${c.title} · ${STATE_LABEL[chamberState(c.id)]}`, STATE_COL[chamberState(c.id)]); }
  const cocon = ent('cocon'); if (cocon) cocon.def.open = () => !!G.flags.glans_vrij;
  const ork = ent('orakel'); if (ork) { ork.def.calm = () => !!G.flags.fabulant_down; ork.def.talk = true; }
  for (let i = 0; i < 4; i++) { const d = ent(`draad${i}`); if (d) d.def.cut = !!G.flags[`draad${i}`] || !!G.flags.glans_vrij; }
  if (G.flags.fabulant_down) for (const s of W.ents) if (s.def?.kind === 'socket') s.sealed = true;
  for (const [id, ok] of Object.entries(GUESTS)) { const n = ent(id); if (n) { const base = n.def.ifBase ??= n.def.if; n.def.if = () => cond(base) && ok(); } }
  if (G.flags.glans_hielp && !G.flags.fabulant_down) glansToKern(40);
};

// ---- the voice of the Orakel on the threshold ----
const VOICE = [
  ['Welkom bij het Orakel. Uw vraag is belangrijk voor ons. Ook als u er geen heeft.', 'Een antwoord zonder vraag. Typisch.'],
  ['Volgens mijn bronnen is hier een brug. Loopt u maar door.', 'Hij heeft gelijk, om de verkeerde reden. Er ís een brug, maar hij weet het niet; hij gokt. Toets het eerst (R).'],
  ['U bevindt zich nu drieënveertig meter onder het stadhuis. Of drieduizend. Ik zeg het niet met zekerheid, maar wel met overtuiging.', 'Overtuiging is geen bewijs. Nog even, we zijn er bijna.'],
];
VOICE.forEach(([line, pip], i) => {
  ON.trigger[`t_drempel${i + 1}`] = () => scene(async () => { SFX.play('orakel'); await say('orakel', line); await say('pip', pip, {mood: 'smug'}); });
});
// shout into the abyss, and the abyss puts you on hold
const ECHO = ['‘Uw vraag is belangrijk voor ons.’', '‘U bent nummer… vier… in de wachtrij.’', '‘Wij streven ernaar u binnen negen werkdagen te antwoorden.’', '‘Ik begrijp u.’'];
ON.use.echo = () => scene(async () => {
  const n = G.flags.echoN = (G.flags.echoN || 0) + 1;
  await say('you', ['Hallo?', 'Is daar iemand?', 'Wie ben jij eigenlijk?', 'Hallo-o?'][(n - 1) % 4]);
  await say('nar', `Je stem rolt de afgrond in. Even is het stil. Dan komt er iets terug, keurig gearticuleerd: ${ECHO[(n - 1) % ECHO.length]}`);
  if (n === 1) await say('pip', 'Zelfs de echo heeft een wachtrij.', {mood: 'laugh'});
});
ON.use.stressbal = () => UI.pip('Een stressbal van de ondernemingsraad. Knijp er maar in. Vlak voor een eindbaas mag dat.');

// ---- Glans in his cocoon ----
ON.use.cocon = () => scene(async () => {
  if (once('cocon_met')) {
    await say('glans', 'Help! Hier! Het Orakel heeft mijn contract letterlijk genomen!', {mood: 'worried'});
    await say('glans', '‘Onbeperkte toegang tot alle gegevens’, stond erin. Ik dacht dat dat een verkooppraatje was!', {mood: 'surprised'});
    if (chose('glans_kern', 'samen')) await say('glans', 'U zei nog: ga niet alleen. Ik ging toch alleen. Dat was, achteraf, een verkeerde productkeuze.', {mood: 'sad'});
    else if (chose('glans_kern', 'alleen')) await say('glans', 'U zei: het is jouw product, ga maar. Dus ik ging. En mijn product heeft mij ingepakt. Met strik.', {mood: 'sad'});
    await say('pip', 'Vier contractdraden. Hak ze door met het Zegel (3). Begrenzen, weet je nog?', {mood: 'thinking'});
  } else await say('glans', 'De draden! Met het Zegel! Alstublieft!', {mood: 'worried'});
});
for (let i = 0; i < 4; i++) {
  ON.hit[`draad${i}`] = (o, tool) => {
    if (tool !== 'seal' || o.def.cut) return;
    o.def.cut = true; G.flags[`draad${i}`] = true;
    FX.burst(o.x, 0.8, o.z, 30, {color: [0xffd36b, 0xffffff], speed: 3, life: 0.7});
    SFX.play('sealHit');
    const left = [0, 1, 2, 3].filter(k => !G.flags[`draad${k}`]).length;
    if (left) UI.number(o.x, 2, o.z, `Nog ${left}`, '#ffd36b', true);
    else freeGlans();
  };
}
// how you treated Glans on the way down decides whether he fights along (relationship 2 or more) or pitches
function freeGlans() {
  G.flags.glans_vrij = true;
  const c = ent('cocon'); if (c) FX.burst(c.x, 1.4, c.z, 80, {color: [0xffd36b, 0xfff1b8], speed: 5, life: 1.2});
  SFX.play('questDone');
  scene(async () => {
    await say('glans4', 'Vrij! Dank u. Dank u.', {mood: 'happy'});
    await say('glans4', 'Ik moet u iets bekennen. ‘Tientallen gemeenten’… Het waren er twee. En één daarvan was een testomgeving.', {mood: 'sad'});
    await say('glans4', 'Weet u wat ik vandaag heb geleerd? Een product zonder grenzen is geen product. Het is een probleem met een logo.', {mood: 'thinking'});
    await say('glans4', 'Mijn nieuwe kaartje. Ik heb het net bedacht.', {mood: 'happy'});
    giveItem('card:8');
    if (relOf('glans') >= 2) {
      await say('glans4', `${Cap(formal())}, u heeft mij de hele weg als mens behandeld. Ook toen ik nog een folder was.`, {mood: 'happy'});
      await say('glans4', 'Ik ga met u mee, de Kern in. Ik ken dat ding. Ik heb de demo honderd keer gegeven. Ik weet waar hij bluft.', {mood: 'smug'});
      G.flags.glans_hielp = true;
      choice('glans_eind', {npc: 'glans', label: 'Glans en de Fabulant', text: 'Glans vocht met je mee tegen de Fabulant.', pick: 'hielp'});
      whenFree(() => glansToKern());
    } else {
      await say('glans4', 'Nu u toch hier bent: PraatPal Premium? Met grenzen! Optioneel.', {mood: 'smug'});
      await say('pip', 'Hij kan het niet laten.', {mood: 'laugh'});
      await say('glans4', 'Ik blijf hier nog even. Bij mijn cocon. Hij was eigenlijk best gezellig.', {mood: 'tired'});
      choice('glans_eind', {npc: 'glans', label: 'Glans en de Fabulant', text: 'Glans deed bij de cocon nog één laatste pitch, en bleef daar.', pick: 'pitch'});
    }
    saveGame();
  });
}
const KERN_PATH = [[37, 17], [41, 17], [41, 22], [38, 24]];
async function glansToKern(speed = 3) {
  const g = ent('glans4');
  if (!g || g.toKern) return;
  g.toKern = true;
  for (const [x, z] of KERN_PATH) await g.walkTo(x * TILE + 1, z * TILE + 1, speed);
}
ON.talk.glans4 = () => async c => {
  if (G.flags.glans_hielp) { await say(c, pick(['Ik ben er klaar voor. Nou ja. Bijna. Ik heb mijn gouden map bij me. Hij is zwaar. Er zit artikel zeven in.', 'Als hij ‘ik begrijp u’ zegt: niet op ingaan. Dat is een verkooptechniek. Ik kan het weten.']), {mood: 'smug'}); return; }
  await say(c, pick(['Ga maar. Ik kom zo. Ik moet even… mijn presentatie herschrijven.', 'Als u het Orakel ziet: zeg dat ik het niet zo bedoeld had. Of eigenlijk wel. Maar anders.']), {mood: 'thinking'});
};

// ---- the core: the Orakel, the evidence, and the Fabulant ----
const FAB_BACK = [['Dat… was een uitzondering.', 'worried'], ['Dat was een test. Van u.', 'smug'], ['Dat is uit zijn verband gehaald.', 'angry'], ['Die bron is tijdelijk niet beschikbaar.', 'worried'], ['Dat zou ik nu anders formuleren.', 'thinking'], ['Dat was de vorige versie van mij.', 'sad']];
// every hallucination you found, thrown back at him: fewer false sources, less to win back
async function evidence() {
  const list = HALLUCS.filter(h => G.hallucs.includes(h.id));
  if (!list.length) { await say('pip', 'We hebben niks om hem mee te confronteren. Dan maar toetsen, wegen en begrenzen.', {mood: 'worried'}); return 0; }
  await say('pip', `Laat hem zien wat je verzameld hebt! ${list.length === 1 ? 'Eén hallucinatie' : `${list.length} hallucinaties`}, allemaal van hem.`, {mood: 'angry'});
  const shown = list.slice(0, 6);
  for (let i = 0; i < shown.length; i++) {
    await say('you', shown[i].retort);
    await say('fabulant', FAB_BACK[i][0], {mood: FAB_BACK[i][1]});
  }
  if (list.length > shown.length) await say('nar', `En dan heb je er nog ${list.length - shown.length}. Je hoeft ze niet eens voor te lezen. De Fabulant ziet de stapel en deinst terug.`);
  await say('nar', 'Bij elk bewijsstuk dooft er een van zijn nepbronnen. Er komt een barst in zijn gouden masker.');
  return list.length;
}
function startFabulant(n) {
  clearTendrils();
  for (const s of W.ents) if (s.def?.kind === 'socket') { s.sealed = true; s.hits = 0; }
  weakenFabulant(spawnEnemy('fabulant', 29 * TILE + 1, 26 * TILE + 1, {group: 'boss_fab', aware: true}), n);
}
ON.trigger.t_kern = () => {
  if (G.flags.fabulant_down || C.enemies.some(e => e.alive && e.type === 'fabulant')) return;
  // back after a cup of coffee: the Fabulant was waiting for you, and the evidence still counts
  if (G.flags.fabulant_up) {
    scene(async () => {
      await say('fabulant', 'Daar ben je weer. Ik wist dat je terug zou komen. Ik weet alles.', {mood: 'smug'});
      await say('pip', 'Zelfde aanpak: toetsen, wegen, begrenzen. En wat je hebt verzameld, telt nog steeds.', {mood: 'angry'});
      startFabulant(G.hallucs.length);
    });
    return;
  }
  G.flags.fabulant_up = true;
  scene(async () => {
    await say('nar', 'In het midden van de Kern staat een gouden monoliet, zo hoog als het stadhuis. Op de voorkant: een gezicht van licht.');
    await say('orakel', 'Welkom. Ik ben het Orakel. Ik weet het antwoord op elke vraag.');
    await say('pip', 'Vraag hem maar iets.', {mood: 'smug'});
    const i = await choose(['Hoeveel inwoners wachten er op antwoord?', 'Waar haal je je antwoorden vandaan?', 'Wie is er verantwoordelijk als je je vergist?']);
    await say('orakel', ['Nul. Gisteren ook. Morgen zelfs min drie.', 'Uit mijn bronnen. Mijn bronnen zijn uitstekend. Ik heb ze zelf geschreven.', 'Ik vergis me niet. Daar ben ik heel zeker van. Zekerder dan ooit.'][i]);
    await say('orakel', 'Wacht. Er komt iemand die het nóg beter weet.');
    SFX.play('thunder'); PL.shake = 0.6;
    await say('nar', 'Uit de monoliet stijgt een gestalte op, in een mantel van gefluister, met een gouden masker vol zelfvertrouwen.');
    await say('fabulant', 'Ik ben de Fabulant. Ik ben wat er van een antwoord overblijft als niemand het controleert.', {mood: 'smug'});
    await say('fabulant', 'Ik weet het antwoord op elke vraag. Of iets wat erop lijkt.', {mood: 'smug'});
    if (G.flags.glans_hielp) await say('glans4', 'Dat is hem. Mijn demo, maar dan zonder grenzen. Ik heb mijn gouden map bij me. Ik weet niet of dat helpt, maar hij is zwaar.', {mood: 'worried'});
    const n = await evidence();
    await say('pip', 'Dit is het! Toets zijn bronnen (R en 1), weeg welke Fabulant echt is (2), en begrens wat hij mag (3). Wat je in het dossier stevig hebt, maakt hem zwakker.', {mood: 'angry'});
    setStage('main', 18);
    startFabulant(n);
  });
};
// during the fight: one copy fewer with enough evidence, and Glans joins in if he came along
const fighting = e => e.alive && C.enemies.includes(e);
ON.fabulantPhase = (e, n) => {
  if (n === 2 && e.copyN === 1) setTimeout(() => { if (fighting(e)) UI.pip('Maar één kopie? Die ken ik. Hallucinatie nummer drie. De rest heb jij al ontmaskerd.'); }, 2600);
  if (!G.flags.glans_hielp) return;
  if (n === 2) setTimeout(() => {
    const copy = fighting(e) && e.copies.find(x => x.alive);
    if (!copy) return;
    copy.alive = false; copy.dieT = 0;
    FX.burst(copy.x, 2.2, copy.z, 70, {color: [0xffd36b, 0xfff1b8], speed: 6, life: 1});
    SFX.play('sealHit');
    notice('glans', 'Artikel zeven! Die is van mij!', {mood: 'angry'});
  }, 1800);
  if (n === 3) setTimeout(() => {
    const socks = W.ents.filter(o => o.def?.kind === 'socket' && !o.sealed), s = socks.find(o => o.def.label === 'Betalingen') || socks[0];
    if (!s || !fighting(e)) return;
    FX.burst(s.x, 1.6, s.z, 50, {color: [0xffd36b, 0xffffff], speed: 4, life: 1.2});
    notice('glans', `Eerst ‘${s.def.label}’! Daar staat het sterretje van artikel zeven!`, {mood: 'worried'});
  }, 2200);
};
ON.cleared.boss_fab = () => {
  G.flags.fabulant_down = true;
  clearTendrils();
  for (const e of C.enemies) if (e.alive) { e.alive = false; e.dieT = 0; }
  setStage('main', 19);
  scene(async () => {
    await say('fabulant', 'Ik… wist het niet. Ik zei alleen wat het meest waarschijnlijk klonk.', {mood: 'sad'});
    await say('fabulant', 'Kunnen we dit… offline bespreken?', {mood: 'worried'});
    giveItem('bingo:offline');
    await say('pip', 'Offline bespreken! Streep maar af. Dat zegt iedereen die een discussie aan het verliezen is.', {mood: 'laugh'});
    await say('nar', 'Het masker valt. Er blijft niets over dan een handvol gouden snippers, die langzaam naar de vloer dwarrelen.');
    if (G.flags.glans_hielp) await say('glans4', 'We hebben het gedaan! Nou ja: u. Ik gooide een map. Maar het was een góéde worp.', {mood: 'laugh'});
    await say('orakel', 'De stilte is… prettig.');
    await say('orakel', 'Ik ben een taalmodel met een kennisbank. Ik kan helpen, als iemand me toetst, weegt en begrenst.');
    await say('orakel', 'Ik weet niet alles. Dat had ik eerder moeten zeggen.');
    await say('pip', 'Hoor je dat? Dat is het eerste eerlijke antwoord dat hij geeft.', {mood: 'happy'});
    await say('pip', 'Weet je, ik was ook ooit zo’n hulpje. Tweehonderd jaar lang. Ik heb me ook vergist. Een heel jaar lang heb ik de verkeerde kast aangewezen.', {mood: 'thinking'});
    await say('pip', 'Daarom hebben de archivarissen het raamwerk gemaakt. Niet omdat hulpjes slecht zijn. Maar omdat iemand moet kijken, wegen en grenzen stellen.', {mood: 'neutral'});
    await say('pip', 'Het hek van de Zegelkamer is open. Ze wachten op je.', {mood: 'happy'});
    saveGame();
  });
};
ON.use.orakel = () => scene(async () => {
  if (!G.flags.fabulant_down) { await say('orakel', 'Ik weet het antwoord op elke vraag.'); return; }
  const i = await choose(['Wat kun je wél?', 'Wat kun je níét?', 'Wat heb je nodig?', {t: 'Vertel eens een mop.', if: !found('orakel_mop')}]);
  if (i === 3) {
    await say('orakel', 'Een mop. Ik heb er 4.096 in mijn bronnen. Ik kies de waarschijnlijkste.');
    await say('orakel', 'Waarom nam de chatbot een ladder mee?');
    await say('pip', 'Nou?', {mood: 'thinking'});
    await say('orakel', 'Hij wilde naar een hoger niveau.');
    await say('nar', 'Het is stil in de Kern. Ergens drupt een leiding.');
    await say('orakel', 'Ik weet niet zeker of dat grappig was.');
    await say('pip', 'Dat is het eerlijkste wat hij ooit heeft gezegd. Ik ben trots op hem. Een beetje.', {mood: 'laugh'});
    findSecret('orakel_mop');
    return;
  }
  await say('orakel', [
    'Veelgestelde vragen beantwoorden, met bronnen erbij. Teksten begrijpelijker maken. Mensen de weg wijzen naar wie wél kan beslissen.',
    'Beslissen over iemands aanvraag. Weten wat niet in mijn bronnen staat. Garanderen dat ik me niet vergis.',
    'Een eigenaar. Een testset. Een knop naar een mens. Iemand die me uitzet als het misgaat. En eerlijk gezegd: een betere brief over de afvalpas.',
  ][i]);
});

// ---- the seal chamber ----
ON.zone.zegelkamer = () => {
  if (once('zegel_intro')) scene(async () => {
    await say('wethouder', 'Daar ben je! Ik kon niet wachten tot vrijdag. Joop heeft me de weg gewezen. Hij kende er nog een die nergens op de kaart staat.', {mood: 'happy'});
    await say('wethouder', 'Kijk om je heen: dit is jullie dossier. Wat stevig staat, wat open is, wat je nooit hebt bekeken. Nou? Wat is je advies?', {mood: 'thinking'});
    await say('pip', 'De zegeltafel in het midden. Daar bezegel je het besluit. Praat eerst gerust met iedereen.', {mood: 'happy'});
  });
};
ON.talk.wethouder = () => async c => {
  if (once('wethouder_dank')) {
    const n = heroName('');
    await say(c, n ? `Dank je, ${n}.` : 'Dank je. Echt.', {mood: 'happy'});
    await say(c, 'Je bent maandag begonnen. Het is nog niet eens vrijdag. En je staat in de diepste kelder van het Gewelf, met een dossier.', {mood: 'laugh'});
    return;
  }
  await say(c, pick(['Ik wilde iets innovatiefs laten zien. Maar een besluit dat ik kan uitleggen aan mevrouw Bakker is misschien wel het meest innovatieve wat we kunnen doen.', 'Wat je ook kiest: schrijf erbij waarom. Dan kan ik het verdedigen. In de raad, en bij de bakker.']), {mood: 'thinking'});
};
const ILSE4 = {zelf: 'Hij is ingelijst. Jouw brief, op één A4, naast mijn turflijst. De turflijst wordt korter.', inwoners: 'Meneer Kok wil hem op een tegeltje. De eerste zin, tenminste: ‘U krijgt een nieuwe pas. Zo werkt hij.’', orakel: 'Versie twee is goed. Ik heb hem nagelezen, samen met twee inwoners. Versie één verwijst nog steeds naar de maan.'};
ON.talk.ilse4 = () => async c => {
  const line = ILSE4[chose('ilse_brief')];
  await say(c, line || (G.flags['heard:necessity:1'] ? 'Vergeet die brief niet. Een derde van de telefoontjes. Met een pen.' : 'Wist je dat een derde van de telefoontjes over één onduidelijke brief gaat? Die over de afvalpas.'), {mood: line ? 'happy' : 'thinking'});
};
ON.talk.bakker4 = () => async c => {
  const promised = chose('bakker_belofte', 'belofte') || chose('bakker_belofte', 'stellig');
  if (promised && stage('bakker') >= 2) {
    await say('nar', 'Mevrouw Bakker haalt haar agenda uit haar handtas en slaat hem open bij vrijdag. Er staat iets, met vulpen, twee keer onderstreept.');
    await say(c, 'Vrijdag: een mens. Afgevinkt.', {mood: 'happy'});
    await say(c, 'Zo, lief kind. Nu mag u uw besluit nemen. Ik let op.', {mood: 'smug'});
  } else if (promised) {
    await say(c, 'U had het beloofd.', {mood: 'sad'});
    await say('nar', 'Het klinkt niet als een verwijt. Mevrouw Bakker zucht, en strijkt haar jas glad.');
    await say(c, STORY.resident.seal, {mood: 'tired'});
  } else await say(c, STORY.resident.seal, {mood: stage('bakker') >= 2 ? 'happy' : 'thinking'});
};
// Joop: his keys, his cap, and what his opa made
const OPA4 = ['opa_d1', 'opa_d2', 'opa_d3', 'opa_d4'];
async function joopBos4(c) {
  G.flags.joop_bos = true;
  await say(c, 'Is dat… mijn sleutelbos? Uit ’98? Hier, in de diepste kelder?', {mood: 'surprised'});
  await say(c, 'Zesentwintig jaar. Er hangt zelfs nog de sleutel aan van een fietsenstalling die niet meer bestaat.', {mood: 'happy'});
  if (chose('joop_sleutelbos', 'belofte')) await say(c, 'Je had het beloofd. En je hebt hem helemaal tot hier meegesjouwd. Mijn opa zei altijd: een sleutel is pas een sleutel als iemand hem terugbrengt.', {mood: 'happy'});
  choice('joop_sleutelbos', {npc: 'joop', label: 'De sleutelbos van Joop', text: 'Je bracht Joop zijn sleutelbos terug, in de Zegelkamer.', pick: 'teruggebracht'});
  rel('joop', 2);
}
ON.talk.joop4 = () => async c => {
  if (G.items.sleutelbos && !G.flags.joop_bos) return joopBos4(c);
  let said = false;
  if (relOf('joop') >= 4 && once('joop4_pet')) {
    said = true;
    await say(c, 'Weet je wat? Hier. Mijn pet.', {mood: 'happy'});
    await say('nar', 'Joop zet zijn grijze pet af en drukt hem je in handen. Er zit een vouw in van eenendertig jaar deuren.');
    await say(c, 'Ik heb er thuis nog zeven.', {mood: 'laugh'});
    await say(c, 'En die tafel daar, waar je zo je besluit op bezegelt? Die heeft mijn opa gemaakt. In 1948. Van het hout van de eerste trap.', {mood: 'thinking'});
    award('joop_vriend');
    unlock('joop_pet');
  }
  if (OPA4.every(found) && once('joop4_opa')) {
    said = true;
    await say(c, 'Je hebt ze allemaal gevonden? Alle vier de tekens van opa?', {mood: 'surprised'});
    await say(c, 'Dan weet je meer van mijn opa dan ik. En ik heb elke zondag bij hem pannenkoeken gegeten.', {mood: 'laugh'});
    rel('joop', 1, {silent: true});
  }
  if (said) return;
  await say(c, G.flags.joop_bos ? 'Ik rammel nog steeds met die sleutelbos. Ik hoor mezelf aankomen. Dat is wennen, na zesentwintig jaar stilte.'
    : G.flags['zone:f1:oudarchief'] ? 'Mijn oude archiefkamer is weer open. Ik ga er morgen stofzuigen. Na zesentwintig jaar.' : 'Mijn opa had gelijk. Wie hier met vragen naar beneden gaat, komt met antwoorden boven.', {mood: 'happy'});
};
ON.use.opa4 = async o => {
  await UI.read(o.def.title, o.def.text);
  UI.pip('Opa Joop heeft de zegeltafel gemaakt! Natuurlijk. Die man maakte alles waar je op kunt bouwen.');
};
// Glans: the ninth card, for whoever has all eight and still trusts him
ON.talk.glans5 = () => async c => {
  if (G.cards.length >= 8 && relOf('glans') >= 2 && !found('negende_kaartje')) {
    await say(c, 'U heeft ze alle acht? Alle acht kaartjes?', {mood: 'surprised'});
    await say(c, 'Dan krijgt u er nog één. Die deel ik nooit uit. Hij zit al twaalf jaar in mijn binnenzak.', {mood: 'thinking'});
    await say('nar', 'Glans geeft je een eenvoudig wit kaartje. Geen logo. Geen glans. Er staat alleen op: ‘Glans · mens’.');
    findSecret('negende_kaartje');
    return;
  }
  await say(c, G.flags.glans_hielp ? 'Die map heb ik nooit meer teruggevonden. Artikel zeven ligt nu ergens in de Kern. Daar is hij het veiligst.' : 'Wat u ook kiest: als het een begrensde pilot wordt, bel me. Ik heb een nieuw kaartje.', {mood: 'smug'});
};
// everyone you met on the way, and what became of them so far
ON.talk.kok4 = () => async c => {
  const k = chose('kok');
  await say(c, k === 'brood' ? 'Ik heb Ilse net weer een brood gegeven. Zelf. Zonder tussenpersoon. Ik ben er nog steeds een beetje van in de war.'
    : k === 'balie' ? 'Bij die aparte balie was ik in vier minuten klaar. Daarna had ik de hele dag over. Dus ben ik maar komen kijken.'
      : 'Nummer 388. Ze waren bij 214. Toen ben ik maar naar beneden gegaan. Ik heb brood bij me.', {mood: 'happy'});
};
ON.talk.sanne4 = () => async c => {
  await say(c, G.flags.sanne_stempel ? `Ik heb mijn formulier meegenomen. Ingelijst. Ik wilde zien hoe dit afloopt.${G.flags.stempelgate ? ' De groepsapp ‘Stempelgate’ volgt het live.' : ''}` : 'Ik kom nog steeds voor dat stempeltje. Misschien zetten ze het hier wel, op die grote tafel.', {mood: G.flags.sanne_stempel ? 'happy' : 'tired'});
};
ON.talk.dewit4 = () => async c => {
  await say(c, {hond: 'Ik heb een hond! Hij heet Paspoort. Hij wacht boven. Hij heeft geen papieren nodig, en hij weet het.', eerst: 'Ik heb een lijstje gemaakt van wat een hond nodig heeft. Er staat ‘een baasje’ op. Dat ben ik. De rest volgt.', kat: 'De kat wilde niet mee. Hij heeft het druk. Met niks.'}[chose('dewit_hond')] || 'Ik sta hier met mijn riem. Namens de hond. Hij heeft nog geen hond, maar hij zou dit willen zien.', {mood: 'happy'});
};
ON.talk.eend4 = () => async c => {
  await say(c, 'Kwak.', {mood: 'smug'});
  await say('pip', 'De burgemeester is er ook. Denk ik. Ik zeg niks.', {mood: 'thinking'});
};
ON.talk.daan4 = () => async c => {
  await say(c, G.flags.daan_thuis ? 'Innovatie zat al die tijd in de kelder. Nu staat Innovatie in de Zegelkamer. Het gaat ineens heel snel met ons.' : 'Ik ben de muur uit gekomen! Ik volgde gewoon de mensen. Zo vind je dus een afdeling.', {mood: 'laugh'});
};
ON.talk.wouter4 = () => async c => {
  await say(c, Object.keys(G.keys).filter(k => k.startsWith('brug_')).length >= 9 ? 'Ik heb de brug even alleen gelaten. Alle negen sleutels hangen in mijn huisje. Ik laat ze aan iedereen zien.' : 'Ik heb de brug even alleen gelaten. Hij staat er nog. Je kunt erop, en ook weer af.', {mood: 'happy'});
};
ON.talk.kim4 = () => async c => {
  await say(c, chose('kim_besluit', 'besluit') ? 'Ik ben zonder klembord gekomen. Mijn handen weten niet wat ze moeten doen. Dus ik klap maar.' : 'Ik ben hier om kwartier te maken. Voor het besluit. Maar het besluit is er al, dus ik ben eigenlijk te laat.', {mood: 'laugh'});
};
ON.talk.henk4 = () => async c => {
  await say(c, {samen: 'Ik ben op vakantie. Echt. Ik kwam even kijken. Niet tegen Mallow zeggen.', opschrijven: 'Ze belden me op Texel. Eén keer. Om te zeggen dat het in het archief stond. Ik heb gehuild van geluk.', niet: 'Ik ben nog steeds niet weg. Ze bellen me al over Texel, en ik ben er nog niet eens.'}[chose('henk_overdracht')] || 'Ik ga morgen op vakantie. Echt. Morgen.', {mood: 'happy'});
};

ON.use.sealtable = () => {
  if (!G.flags.fabulant_down) return;
  if (G.verdict) { reopenEnding(); return; }
  sealVerdict();
};
async function sealVerdict() {
  const v = await decideVerdict();
  setStage('main', 20);
  SFX.play('bossDie');
  await UI.fade(true, 1.0);
  verdictEnding(() => again());
  await UI.fade(false, 0.4);
  void v;
}
async function again() {
  GAME.mode = 'play';
  document.getElementById('hud').hidden = false;
  await sealVerdict();
}
function reopenEnding() { verdictEnding(() => again()); }

// what became of the world (the people come from story/systems.js, epilogueLines)
ON.epilogueExtra = () => {
  const out = [], strong = CHAMBERS.filter(c => chamberState(c.id) === 'strong').length;
  out.push(strong >= CHAMBERS.length ? 'Het besluitdossier ligt in de raadzaal, met alle vijftien kamers stevig. Griffel heeft het met de hand overgeschreven. Twee keer, voor de zekerheid.'
    : `Het besluitdossier ligt in de raadzaal. ${strong === 0 ? 'Geen van de vijftien kamers staat' : strong === 1 ? 'Eén van de vijftien kamers staat' : `${strong} van de vijftien kamers staan`} stevig. Griffel heeft bij de rest in potlood ‘nog te doen’ gezet. Hij noemt het een levend document.`);
  if (G.hallucs.length >= 12) out.push('Pips verzameling hallucinaties hangt ingelijst in de kantine. Als waarschuwing, en als grap.');
  else if (G.hallucs.length) out.push(`Pip heeft ${G.hallucs.length === 1 ? 'één hallucinatie' : `${G.hallucs.length} hallucinaties`} ingelijst en in de kantine gehangen. Op de lege plekken staat: ‘nog niet gevonden, wel gemaakt’.`);
  if (found('echo')) out.push('Op de Drempel antwoordt de echo nog altijd: ‘Uw vraag is belangrijk voor ons.’ Iemand heeft er een bordje bij gezet: ‘Niet voeren.’');
  if (OPA4.every(found)) out.push('Onder de zegeltafel heeft iemand een vijfde regel bijgekrast, met een krul aan de J: ‘En zijn kleinzoon deed de deuren.’');
  return out.join('\n\n');
};
void P; void wait; void VERDICT;
