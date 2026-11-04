// Het oefenlokaal: a practice for people who rarely play games, and short tips for people who skip it.
//
//   await ON.tutorialStart()                 after a new game is set up (G reset, hero chosen): takes you to the
//                                            practice room and resolves once you are there. The practice runs by
//                                            itself, one step at a time, and ends with the normal start:
//                                            enterFloor(ON.start) and ON.newGame() (the opening scene).
//   await ON.tutorialStart({replay: true})   from the pause menu: practise again, then back to where you were,
//                                            with your game exactly as it was.
//   ON.tutorialActive()                      true while practising
//   UI.controlsCard()                        the reference card of every control (ui/controls.js)
//
// Nothing you do in the practice counts: the game state is copied before and put back after (a copy also
// sits in G.flags so a reload in the middle restarts the practice). What you practised is remembered as
// G.flags['geoefend:<step>'], and the just-in-time tips at the bottom of this file skip what you already know.
import * as THREE from 'three';
import {ON, UI, SFX, P, ITEMS, chamberState} from '../../game/bus.js';
import {G, SETTINGS, saveGame, applySave} from '../../game/state.js';
import {W, ent, tileType, walkTile} from '../../game/world.js';
import {GAME, enterFloor} from '../../game/game.js';
import {PL, savePosition} from '../../game/player.js';
import {C} from '../../game/combat.js';
import {Illusion} from '../../game/entities.js';
import {DLG, say, choose, scene, wait} from '../../game/dialogue.js';
import {QUESTS} from '../../game/quests.js';
import {T} from '../../engine/level.js';
import {R} from '../../engine/render.js';
import {FX} from '../../engine/particles.js';
import {glowSprite} from '../../engine/models.js';
import {actionHit, codesFor} from '../../core/keys.js';
import {press} from '../../core/input.js';
import {el, addStyles, IS_TOUCH, TILE, tileOf, wrapAngle} from '../../core/util.js';
import {archetype, heroName} from '../../game/hero.js';
import {CHAMBER} from '../framework.js';
import {decide} from '../../ui/decision.js';
import {controlsCard, closeControlsCard, ka, kc, ABILITIES, ARCH_LABEL} from '../../ui/controls.js';
import {onDummyHit} from '../oefenpop.js';
import {SPOTS, BEYOND} from '../floors/oefen.js';
import {archOpt} from './systems.js';

const BACKUP = 'oefen:backup';
const k = ka;                                  // the main key of an action, as a key cap
const newTut = () => ({active: false, replay: false, back: null, snap: null, steps: [], i: -1, step: null, f: {}, hits: new Set(), practised: new Set(), skip: false, finishing: false, done: null, resolveDone: null});
let TUT = newTut();
const pick = list => list[Math.floor(Math.random() * list.length)];
// the practice's own lines: once you skip, the rest of a conversation is left out
const sayT = (who, text, o) => (TUT.skip ? Promise.resolve() : say(who, text, o));
const chooseT = opts => (TUT.skip ? Promise.resolve(0) : choose(opts));
const world = ([x, z]) => ({x: x * TILE + 1, z: z * TILE + 1});
const near = (spot, r) => { const p = world(spot); return Math.hypot(P.x - p.x, P.z - p.z) < r; };
const zoneId = () => W.L?.zoneAt(tileOf(P.x), tileOf(P.z)).id;
const revKey = ([x, z]) => `rev:oefen:${x},${z}`;
const plain = html => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const joopTarget = () => ({e: 'oefenjoop'});
// the oefenpop nearest to you (they never move, so the spots from the floor file are enough)
function dummyTarget() {
  let best = SPOTS.dummies[0], bd = 1e9;
  for (const d of SPOTS.dummies) { const p = world(d), dd = Math.hypot(P.x - p.x, P.z - p.z); if (dd < bd) { bd = dd; best = d; } }
  return {t: best};
}

// ---------------------------------------------------------------- the steps
// text(): desktop instructions (HTML with key caps); touch(): the same for touch screens; at: where the
// step points (tile [x, z], or a function returning {t} or {e}); begin/watch/done/after: see runPractice().
export const STEPS = [
  {id: 'look', title: 'Rondkijken',
    text: () => `Beweeg de muis om rond te kijken. Gebeurt er niets? Klik dan eerst een keer in de wereld. Draaien kan ook met ${k('turnLeft')} en ${k('turnRight')}.`,
    touch: () => 'Sleep met je vinger over de rechterkant van het scherm om rond te kijken.',
    hint: 'Kijk eens om je heen. Achter je hangt iets, speciaal voor jou.',
    begin() { TUT.f.look = 0; TUT.f.yaw = P.yaw; TUT.f.pitch = P.pitch; },
    watch(dt, free) {
      if (free) TUT.f.look += Math.abs(wrapAngle(P.yaw - TUT.f.yaw)) + Math.abs(P.pitch - TUT.f.pitch) * 0.6;
      TUT.f.yaw = P.yaw; TUT.f.pitch = P.pitch;
    },
    done: () => TUT.f.look > 2.4},
  {id: 'walk', title: 'Lopen', at: SPOTS.walk,
    text: () => `Loop naar het lichtje op de vloer met ${k('forward')} ${k('left')} ${k('back')} ${k('right')}, of met de pijltjestoetsen.`,
    touch: () => 'Duw met je duim de stick linksonder de kant op waar je heen wilt, en loop naar het lichtje.',
    hint: 'Het lichtje ligt recht voor je, op de loper.',
    done: () => near(SPOTS.walk, 1.5)},
  {id: 'run', title: 'Rennen', at: SPOTS.run,
    text: () => (SETTINGS.runToggle ? `Druk een keer op ${k('run')} en loop: nu ren je. Nog een keer ${k('run')} is weer wandelen.` : `Houd ${k('run')} ingedrukt terwijl je loopt: dan ren je.`) + ' Ren over de rode loper naar het volgende lichtje.',
    touch: () => 'Duw de stick helemaal naar de rand: dan ren je. Ren over de rode loper naar het volgende lichtje.',
    hint: 'Het lichtje ligt aan het eind van de rode loper. Rennen mag hier, zelfs in de gang.',
    begin() { TUT.f.ran = 0; },
    watch(dt, free) { if (free && P.speed > 6.3 && !(P.dashT > 0)) TUT.f.ran += dt; },
    done: () => TUT.f.ran > 0.9 && (near(SPOTS.run, 3.2) || TUT.f.ran > 2.2)},
  {id: 'dash', title: 'Over de kloof', at: SPOTS.dash,
    text: () => `Loop naar de rand van het gat en druk op ${k('dash')}: zo duik je weg, ook over een smalle kloof. Neem gerust een aanloop.`,
    touch: () => 'Loop naar de rand van het gat en tik op » om eroverheen te duiken. Neem gerust een aanloop.',
    hint: 'Ga vlak voor het gat staan, kijk naar de overkant en duik. Val je? Dan vang ik je op, beloofd.',
    begin() { UI.pip('Zie je dat gat in de vloer? Daar duiken we overheen. Niet bang zijn: wie valt, vang ik op.'); },
    done: () => BEYOND.includes(zoneId()) && !P.falling},
  {id: 'talk', title: 'Praten', at: joopTarget,
    text: () => `Loop naar Joop. Staat er onderin ‘Praat met Joop’? Druk dan op ${k('interact')}. Een antwoord kies je met de muis of met de cijfertoetsen.`,
    touch: () => 'Loop naar Joop en tik op de knop E. Een antwoord kies je door erop te tikken.',
    hint: 'Joop staat bij de koffieautomaat. Hij wacht op je, en op zijn koffie.',
    done: () => !!TUT.f.talked},
  {id: 'read', title: 'Lezen', at: SPOTS.sign,
    text: () => `Lees het bord met de huisregels, links van Joop: ga ervoor staan en druk op ${k('interact')}. Wegklikken doe je met ${kc('Escape')} of het kruisje.`,
    touch: () => 'Lees het bord met de huisregels, links van Joop: ga ervoor staan en tik op E. Wegtikken doe je met het kruisje.',
    hint: 'Het bord hangt aan de muur, links van Joop. Bordjes lezen loont: er staat vaak meer op dan je denkt.',
    done: () => !!TUT.f.read},
  {id: 'pickup', title: 'Oppakken', at: SPOTS.snack,
    text: () => `Op de sokkel ligt de stroopwafel van de maand. Ga ervoor staan en pak hem met ${k('interact')}. Veel andere dingen raap je op door er gewoon overheen te lopen.`,
    touch: () => 'Op de sokkel ligt de stroopwafel van de maand. Ga ervoor staan en tik op E. Veel andere dingen raap je op door er gewoon overheen te lopen.',
    hint: 'De stroopwafel ligt op de sokkel bij de tafel. Hij is van jou, zegt Joop.',
    done: () => !!TUT.f.picked},
  {id: 'crate', title: 'Duwen', at: SPOTS.crate,
    text: () => 'In het gangetje staat een krat. Duw hem op de groene plaat: loop er gewoon tegenaan en blijf doorlopen. Dan gaat het hek naar de oefenzaal open.',
    touch: () => 'In het gangetje staat een krat. Duw hem op de groene plaat: loop er met de stick tegenaan en blijf doorlopen. Dan gaat het hek naar de oefenzaal open.',
    hint: 'Ga recht achter de krat staan en loop het gangetje in. Hij schuift vanzelf mee.',
    done: () => !!G.flags.oefen_plaat,
    after: () => joopWalksIn()},
  {id: 'camera', title: 'Camera',
    text: () => `Druk op ${k('camera')}. Je wisselt tussen eerste persoon (door je eigen ogen) en derde persoon (over je schouder). Kies wat jij het fijnst vindt; terugwisselen kan altijd.`,
    touch: () => 'Tik rechtsboven op 👁, of op de knop hieronder. Je wisselt tussen door je eigen ogen kijken en over je schouder meekijken.',
    button: {text: '👁 Wissel camera', action: 'camera'},
    hint: 'Eerste persoon is lekker dichtbij, derde persoon geeft overzicht. Probeer allebei maar.',
    begin() { TUT.f.cam = PL.camMode; },
    done: () => PL.camMode !== TUT.f.cam},
  {id: 'journal', title: 'Je dossier',
    text: () => `Open je dossier met ${k('journal')}. Daarin staan je opdrachten, je bronnen en je afwegingen. Sluit het weer met ${k('journal')} of ${kc('Escape')}.`,
    touch: () => 'Tik rechtsboven op ❦ om je dossier te openen. Sluit het weer met het kruisje.',
    hint: 'In je dossier zie je altijd wat je opdracht is. Handig als je de draad even kwijt bent.',
    begin() { TUT.f.journal = false; },
    watch() { if (GAME.modal === 'journal') TUT.f.journal = true; },
    done: () => TUT.f.journal && !GAME.modal},
  {id: 'map', title: 'De kaart',
    text: () => `Open de kaart met ${k('map')} en sluit hem weer. Op de kaart zie je waar je al bent geweest. Later kun je er ook mee naar een koffiehoek reizen.`,
    touch: () => 'Tik rechtsboven op ◈, of op de kleine kaart. Sluit hem weer met het kruisje.',
    hint: 'De kaart tekent zichzelf terwijl je loopt. Wat je nog niet zag, is nog donker.',
    begin() { TUT.f.map = false; },
    watch() { if (GAME.modal === 'map') TUT.f.map = true; },
    done: () => TUT.f.map && !GAME.modal},
  {id: 'lamp', title: 'De Toetslamp', at: dummyTarget,
    text: () => `Kies de Toetslamp met ${k('tool1')}, kijk naar een oefenpop in de oefenzaal en klik: een lichtschot. Houd je de muisknop ingedrukt, dan blijft de lamp schieten.`,
    touch: () => 'Tik onderin op de Toetslamp (🔦), kijk naar een oefenpop in de oefenzaal en tik op ✦: een lichtschot.',
    hint: 'Kijk naar een oefenpop en klik. De lamp mikt een beetje mee; dat is geen valsspelen, dat is service.',
    begin() { grantTools(); },
    done: () => TUT.hits.has('lamp')},
  {id: 'scale', title: 'De Weegschaal', at: dummyTarget,
    text: () => `Kies de Weegschaal met ${k('tool2')}. Ga dicht bij de poppen staan en klik: je maakt een golf rondom je die alles even vertraagt.`,
    touch: () => 'Tik onderin op de Weegschaal (⚖️), ga dicht bij de poppen staan en tik op ✦: een golf rondom je.',
    hint: 'De golf reikt een paar meter. Ga midden tussen de poppen staan.',
    done: () => TUT.hits.has('scale')},
  {id: 'seal', title: 'Het Zegel', at: dummyTarget,
    text: () => `Kies het Zegel met ${k('tool3')}, loop vlak naar een pop toe en klik: een stevige stempel. Wisselen kan ook met ${k('cycle')} of het scrollwiel.`,
    touch: () => 'Tik onderin op het Zegel (🔏), loop vlak naar een pop toe en tik op ✦: een stevige stempel.',
    hint: 'Het Zegel werkt alleen van dichtbij. Loop maar flink naar zo’n pop toe; hij bijt niet.',
    done: () => TUT.hits.has('seal')},
  {id: 'reveal', title: 'Onthullen', at: SPOTS.wall,
    text: () => `Eén muur in de oefenzaal glanst een beetje te mooi. Ga ervoor staan en druk op ${k('reveal')}, of op de rechtermuisknop: wat niet echt is, verdwijnt.`,
    touch: () => 'Eén muur in de oefenzaal glanst een beetje te mooi. Ga ervoor staan en tik op ☀: wat niet echt is, verdwijnt.',
    hint: 'Het is de muur aan de zuidkant, tegenover de poppen. Hij glimt als je dichtbij komt.',
    begin() { UI.pip('Psst. Eén muur in de oefenzaal deugt niet. Ik voel het aan mijn lantaarn.'); },
    done: () => !!G.opened[revKey(SPOTS.wall)]},
  {id: 'ability', title: 'Jouw vaardigheid', at: dummyTarget, when: () => !!ABILITIES[archetype()],
    text: () => { const a = ABILITIES[archetype()]; return `Als ${ARCH_LABEL[archetype()]} heb je een eigen vaardigheid: <b>${a.name}</b>. ${a.text} Druk op ${k('ability')}, het liefst bij de poppen. Daarna laadt hij even op.`; },
    touch: () => { const a = ABILITIES[archetype()]; return `Als ${ARCH_LABEL[archetype()]} heb je een eigen vaardigheid: <b>${a.name}</b>. ${a.text} Tik op de knop hieronder, het liefst bij de poppen.`; },
    button: {text: '✦ Vaardigheid', action: 'ability'},
    hint: 'Je vaardigheid is je eigen specialiteit. Probeer hem bij de poppen: die vinden alles goed.',
    begin() { TUT.f.ab = G.stats.abilities || 0; },
    watch() { if (actionHit('ability')) TUT.f.ability = true; },
    done: () => !!TUT.f.ability || (G.stats.abilities || 0) > TUT.f.ab},
  {id: 'hint', title: 'Een hint van Pip', at: joopTarget,
    text: () => `Weet je even niet verder? Druk op ${k('hint')}: dan geeft Pip een hint en vliegt hij de goede kant op.`,
    touch: () => 'Weet je even niet verder? Tik op de knop hieronder: dan geeft Pip een hint en vliegt hij de goede kant op.',
    button: {text: '💡 Vraag Pip', action: 'hint'},
    watch() { if (actionHit('hint')) TUT.f.hinted = true; },
    done: () => !!TUT.f.hinted},
  {id: 'decide', title: 'Een afweging', at: joopTarget,
    text: () => `In het Gewelf vraagt elke hoeder je om een afweging. Joop doet het een keer voor, met de koffieautomaat. Loop naar hem toe en druk op ${k('interact')}.`,
    touch: () => 'In het Gewelf vraagt elke hoeder je om een afweging. Joop doet het een keer voor, met de koffieautomaat. Loop naar hem toe en tik op E.',
    hint: 'Joop staat in de oefenzaal, bij de bank. Hij heeft er zin in.',
    done: () => !!TUT.f.decided},
];
const CHEERS = ['Top!', 'Keurig.', 'Precies zo.', 'Helemaal goed.', 'Volgens het boekje.', 'Dat gaat als een trein.', 'Daar wordt de wethouder blij van.',
  'Goed bezig!', 'Joop steekt zijn duim op.', 'Afgevinkt. In drievoud.', 'Zo, die zit.', 'Pip maakt een rondje van blijdschap.', 'Alsof je nooit anders hebt gedaan.'];
const stepText = s => (IS_TOUCH ? s.touch : s.text)?.() || '';
function stepTarget(s = TUT.step) {
  if (!s?.at) return null;
  const a = typeof s.at === 'function' ? s.at() : {t: s.at};
  return a || null;
}
function targetPos(a) {
  if (!a) return null;
  if (a.e) { const e = ent(a.e); return e && e.visible !== false ? {x: e.x, z: e.z} : null; }
  return a.t ? world(a.t) : null;
}

// the tracker and the minimap ring follow the current step (the tracker itself is hidden while practising)
QUESTS.oefen = {side: true, title: 'Het oefenlokaal', stages: [
  {short: 'Oefenen', text: () => (TUT.step ? `${TUT.step.title}: ${plain(stepText(TUT.step))}` : 'Oefenen met Joop en Pip.'), at: () => stepTarget()},
  {text: 'Klaar met oefenen.', done: true},
]};

// ---------------------------------------------------------------- waiting on the world
// until(pred): resolves on the first frame where pred({free, inRoom}) holds. Frames are game frames,
// so the automated playthrough (window.__orakel.run) can fast-forward the practice too.
const WAITERS = [];
const until = pred => new Promise(r => WAITERS.push({pred, r}));
function frameState() {
  const inRoom = TUT.active && GAME.mode === 'play' && W.id === 'oefen' && !GAME.busy;
  return {inRoom, free: inRoom && !GAME.modal && !DLG.active && !P.dead};
}
GAME.onFrame.push(dt => {
  const st = frameState();
  if (TUT.active && st.inRoom) TUT.step?.watch?.(dt, st.free);
  for (let i = WAITERS.length - 1; i >= 0; i--) {
    let ok = false;
    try { ok = WAITERS[i].pred(st); } catch (e) { console.warn('oefenlokaal', e); ok = true; }
    if (ok) WAITERS.splice(i, 1)[0].r();
  }
  updatePanel(dt);
  updateMarker(dt, st);
  updateTip(dt);
});

// ---------------------------------------------------------------- starting
export async function tutorialStart({replay = false, resume = null} = {}) {
  if (TUT.active) { if (!resume) UI.toast('Het oefenlokaal', 'Je bent al aan het oefenen.', 'quest'); return {done: TUT.done}; }
  if (GAME.busy) await until(() => !GAME.busy);
  // the opening scene of a new game may already be running: let it rush by, it plays again after the practice
  if (DLG.active && !replay && !resume) { DLG.auto = true; await until(() => !DLG.active); DLG.auto = false; }
  let snap, back;
  if (resume) ({snap, back} = resume);
  else {
    back = replay && W.id && W.id !== 'oefen' ? {floor: W.id, pos: {x: P.x, z: P.z, yaw: P.yaw}} : null;
    if (back) savePosition();
    delete G.flags[BACKUP];
    snap = JSON.stringify(G);
  }
  TUT = newTut();
  Object.assign(TUT, {active: true, replay: !!back, back, snap});
  TUT.done = new Promise(r => { TUT.resolveDone = r; });
  TUT.steps = STEPS.filter(s => !s.when || s.when());
  // the practice state: everything you need, nothing that can hurt, and a copy of the real game
  G.flags[BACKUP] = JSON.stringify({snap, back});
  Object.assign(G.flags, {pip: true, pipHidden: false, godmode: true, track: 'oefen'});
  delete G.flags.oefen_plaat;
  for (const key of Object.keys(G.opened)) if (key.startsWith('oefen:') || key.startsWith('rev:oefen:')) delete G.opened[key];
  for (const key of Object.keys(G.flags)) if (key.startsWith('zone:oefen:') || key === 'seen:oefen') delete G.flags[key];
  delete G.explored.oefen;
  G.quests.oefen = 0;
  G.tools = {lamp: false, scale: false, seal: false};       // the oefenset comes later, from Joop
  G.hp = G.maxHp;
  GAME.mode = 'play';
  closeControlsCard();
  if (GAME.modal) UI.closeModal?.(true);
  document.body.classList.add('oefenen');
  await enterFloor('oefen', 'start');
  runPractice();
  return {done: TUT.done};
}

// ---------------------------------------------------------------- the practice, one step at a time
async function runPractice() {
  try {
    await intro();
    for (let i = 0; i < TUT.steps.length && !TUT.skip; i++) {
      const s = TUT.steps[i];
      TUT.i = i; TUT.step = s; TUT.f.okT = 0;
      s.begin?.();
      renderPanel();
      await until(st => TUT.skip || (st.free && s.done()));
      if (TUT.skip) break;
      TUT.practised.add(s.id);
      cheer(s);
      await wait(1.2);
      if (TUT.skip) break;
      await s.after?.();
    }
    if (!TUT.skip) { TUT.step = null; renderPanel(); await finale(); }
  } catch (e) { console.error('oefenlokaal', e); }
  await finish();
}

async function intro() {
  await wait(0.6);
  await scene(async () => {
    if (TUT.replay) {
      await sayT('pip', 'Weer even oefenen? Goed idee. Alles wat je hier doet, telt niet mee: je spel staat veilig opgeslagen.');
      await sayT('oefenjoop', 'Ik zit achterin, bij de koffie. Je lijstje staat links in beeld. Eén stap tegelijk, hè.', {mood: 'happy'});
      return;
    }
    await sayT('nar', 'Maandag, 8:31. Je bent vroeg. Joop, de conciërge, heeft je naar de kelder gestuurd: ‘Oefen eerst even, dan verdwaal je straks niet.’');
    await sayT('oefenjoop', 'Hallo? Ben je daar? Ik zit achterin, bij de koffie. Kom maar naar me toe: onderweg leer je alles wat je straks nodig hebt.', {mood: 'happy'});
    await sayT('pip', 'En ik ben Pip! Eigenlijk kom je mij pas beneden in het Gewelf tegen, maar voor de oefening mag ik even meedoen. Niet doorvertellen.');
    await sayT('pip', 'Links in beeld staat je lijstje: één stap tegelijk. Wil je liever meteen beginnen? Daar zit ook een knop voor.');
  });
}

function cheer(s) {
  const text = pick(CHEERS);
  TUT.f.okText = text; TUT.f.okT = 1.4;
  renderPanel();
  UI.toast(`✓ ${s.title}`, text, 'good');
  SFX.play('questDone');
  FX.burst(P.x, P.y + 1.7, P.z, 26, {color: [0xffd36b, 0x8fe0a0, 0xfff1b8], speed: 3, up: 2, life: 0.9, s0: 0.14});
}

function grantTools() {
  G.tools = {lamp: true, scale: true, seal: true};
  P.tool = G.tool = 'lamp';
  SFX.play('tool');
  UI.toast('De oefenset', 'Joop heeft de Toetslamp, de Weegschaal en het Zegel voor je klaargelegd. Van karton, maar ze doen het.', 'good');
  UI.pip('Ooh, gereedschap! Het echte vind je beneden in het Gewelf, maar dit is ook leuk. De poppen staan in de oefenzaal.');
}

// once the gate is open, Joop walks along into the oefenzaal
async function joopWalksIn() {
  await scene(async () => { await sayT('oefenjoop', 'Hoor je dat? Het hek is open! Kom, dan lopen we samen naar de oefenzaal. De krat mag blijven staan, die heeft zijn werk gedaan.', {mood: 'happy'}); });
  const j = ent('oefenjoop');
  if (!j) return;
  (async () => {
    for (const [x, z] of SPOTS.joopPath) { if (!TUT.active || ent('oefenjoop') !== j) return; const p = world([x, z]); await j.walkTo(p.x, p.z, 3.2); }
    j.baseYaw = Math.PI / 2;      // facing the poppen
  })();
}

// ---------------------------------------------------------------- talking to Joop
ON.talk.oefenjoop = () => async c => {
  if (!TUT.active) { await say(c, 'Zo, even geoefend? Goed zo.', {mood: 'happy'}); return; }
  if (TUT.step?.id === 'decide') return mockDecision(c);
  if (!TUT.f.talked) return firstTalk(c);
  const id = TUT.step?.id;
  if (id === 'crate' && !G.flags.oefen_plaat) return sayT(c, 'Het hek gaat open als er iets zwaars op de groene plaat staat. Niet ik, hoor: ik moet de koffie bijhouden.', {mood: 'laugh'});
  if (['lamp', 'scale', 'seal', 'ability'].includes(id)) return sayT(c, 'Die poppen kunnen wel wat hebben. Ik heb ze zelf gemaakt, van ordners die niemand meer opent.', {mood: 'happy'});
  if (id === 'reveal') return sayT(c, 'Die ene muur? Die heb ik nooit vertrouwd. Er staat geen bouwvergunning voor in het archief.', {mood: 'thinking'});
  await sayT(c, pick(['Gaat goed zo! Kijk in je lijstje wat de volgende stap is.', 'Rustig aan, hoor. Het Gewelf loopt niet weg. Nou ja, soms een beetje.', 'Je doet het beter dan de wethouder in 2009. Die liep drie keer tegen hetzelfde hek.']), {mood: 'happy'});
};
async function firstTalk(c) {
  await sayT(c, 'Daar ben je! Welkom in het oefenlokaal. Ik ben Joop, de conciërge. Hier oefenen nieuwe collega’s al sinds 1987.', {mood: 'happy'});
  await sayT(c, 'Nou ja. Hier hangt sinds 1987 een bordje dat dat zegt.', {mood: 'laugh'});
  await sayT(c, 'Als we praten, kies je soms een antwoord. Klik erop, of druk op het cijfer ervoor. Er is geen fout antwoord. Bijna nooit.');
  const i = await chooseT([
    'Leuk je te ontmoeten, Joop!',
    'Waarom ligt daar een stroopwafel op een sokkel?',
    'Moet ik dit echt allemaal oefenen?',
    archOpt('handhaver', 'Zijn hier ook huisregels?'),
    archOpt('datatovenaar', 'Hoeveel collega’s hebben dit oefenlokaal al gehaald?'),
    archOpt('archivaris', 'Staat dit lokaal eigenlijk op de plattegrond?'),
    archOpt('verbinder', 'En hoe gaat het met jóú vandaag, Joop?'),
  ]);
  const reply = [
    ['Insgelijks! Jij wordt een fijne collega, dat zie ik zo. Ik heb daar een neus voor. En voor lekkages.', 'happy'],
    ['Dat is de stroopwafel van de maand. Hij is van jou, als je hem pakt. Dat oefenen we zo meteen.', 'laugh'],
    ['Moeten? Niks moet. Je kunt de uitleg altijd overslaan, met de knop in je lijstje. Maar wie hier oefent, hoeft beneden minder te zoeken.', 'thinking'],
    ['Zeker. Ze hangen naast me, op het bord. Regel één: fouten maken mag. Dat voelt misschien als een regel die je wilt handhaven. Dat mag ook.', 'laugh'],
    ['Allemaal. Eén iemand twee keer, maar dat was de wethouder, en die vond het gezellig.', 'laugh'],
    ['Op de plattegrond van 1987 wel. Op die van nu niet. Druk straks maar eens op de kaart, dan zie je hem gewoon.', 'thinking'],
    ['Met mij? Goed, eigenlijk. Er vraagt bijna nooit iemand naar. Dank je. Ik zet straks extra koffie.', 'happy'],
  ][i] || ['Zo is het maar net.', 'happy'];
  await sayT(c, reply[0], {mood: reply[1]});
  await sayT(c, 'Zie je? Zo werkt praten hier: luisteren, kiezen, en soms een stroopwafel.', {mood: 'happy'});
  TUT.f.talked = true;
}

// a mock example of the decision panel: Joop is, for today, the Hoeder van de Koffieautomaat
const MOCK = {
  id: 'oefen', title: 'Oefenkamer: de koffieautomaat', place: 'Het oefenlokaal', npc: 'Joop', group: 'oefen',
  clues: [{id: 'logboek', title: 'Het storingslogboek van Joop', body: 'Drie keer thee in één week, steeds op maandagochtend, steeds bij de knop ‘koffie zwart’.',
    explanation: 'Een bron laat zien wat er echt gebeurt. Met dit logboek weet je waar je moet zoeken, nog voordat je een oplossing kiest.'}],
  scenario: 'De koffieautomaat in de kantine geeft soms thee als je op koffie drukt. Niemand weet hoe vaak. Facilitaire Zaken wil het oplossen, en iemand stelt voor om meteen een slimme automaat neer te zetten die zelf raadt wat je wilt.',
  question: 'Wat doe je eerst? Kies alles wat past: vaak is dat meer dan één.',
  options: [
    {text: 'Een week bijhouden wat de automaat geeft, en wie er last van heeft.', status: 'correct', feedback: 'Eerst meten wat er echt misgaat. Zonder dat weet je niet of een oplossing iets oplost.'},
    {text: 'Meteen een slimme automaat bestellen die raadt wat je wilt.', status: 'incorrect', feedback: 'Raden is geen oplossing als je nog niet weet wat het probleem is. En wie weet raadt hij ook thee.'},
    {text: 'Afspreken wie de eigenaar van de automaat is, en wie je belt bij een storing.', status: 'correct', feedback: 'Zonder eigenaar is een storing van iedereen, en dus van niemand.'},
    {text: 'Collega’s vragen wat ze van de automaat verwachten.', status: 'supporting', feedback: 'Een goede aanvulling: wie er elke dag koffie haalt, weet vaak al waar het knelt.'},
    {text: 'Een bordje ophangen: ‘Druk op koffie, krijg een verrassing’.', status: 'incorrect', feedback: 'Eerlijk, en zelfs grappig. Maar het probleem blijft precies zoals het was.'},
  ],
  reflection: 'Bij een echte hoeder gaat het net zo, alleen over AI in plaats van over koffie.',
};
async function mockDecision(c) {
  await sayT(c, 'Nog één ding, en dan ben je klaar. Beneden in het Gewelf staan hoeders. Elke hoeder bewaakt een kamer van het raamwerk.', {mood: 'thinking'});
  await sayT(c, 'Een hoeder legt je een geval voor en vraagt om een afweging. Jij kiest maatregelen, vaak meer dan één. Daarna zie je wat past, wat een goede aanvulling is en wat averechts werkt.');
  await sayT(c, 'Ik doe het even voor. Vandaag ben ik de Hoeder van de Koffieautomaat. Dat is een zware verantwoordelijkheid.', {mood: 'laugh'});
  await sayT('pip', 'Hij zet er zijn plechtigste stem voor op. Niet lachen, dan wordt hij verlegen.');
  if (TUT.skip) return;
  CHAMBER.oefen = MOCK;
  if (!G.bronnen.includes('oefen:logboek')) G.bronnen.push('oefen:logboek');      // Joop's logbook, to show where sources appear
  let st = 'blind';
  try { await decide('oefen', {who: 'oefenjoop', place: 'Het oefenlokaal'}); st = chamberState('oefen'); } finally { delete CHAMBER.oefen; }
  if (st === 'strong') await sayT(c, 'Stevig! Zo komt een kamer in je dossier. Het dossier bewaart elke afweging, en aan het eind kijk je wat het samen kan dragen.', {mood: 'happy'});
  else if (st === 'open') await sayT(c, 'Open punten. Geeft niks: bij een hoeder mag je opnieuw afwegen, en het dossier onthoudt je laatste keuze.', {mood: 'thinking'});
  else await sayT(c, 'Overgeslagen? Dat mag, maar dan wordt het een blinde vlek in je dossier. Je kunt later altijd terug naar de hoeder.', {mood: 'thinking'});
  await sayT(c, 'En weet je het even niet? Bronnen helpen, zoals mijn logboek. Beneden vind je ze onderweg, als rollen. Bij een afweging staan ze rechts, om in te lezen.');
  TUT.f.decided = true;
}

async function finale() {
  await scene(async () => {
    const name = heroName('');
    if (TUT.replay) {
      await sayT('oefenjoop', 'Weer helemaal bij! Zelfs ik oefen nog weleens. Met deuren, vooral.', {mood: 'happy'});
      await sayT('oefenjoop', 'Ik breng je terug naar waar je was. Alles ligt er nog precies zo.');
      return;
    }
    await sayT('oefenjoop', 'Zo. Je kunt lopen, rennen, duiken, praten, lezen, duwen, toetsen, wegen, zegelen en onthullen. Dat kunnen de meeste collega’s na tien jaar nog niet.', {mood: 'happy'});
    await sayT('oefenjoop', `En vergeet je iets? In het menu staat alles nog een keer, en Pip weet de weg. Niemand doet dit werk alleen${name ? `, ${name}` : ''}.`, {mood: 'happy'});
    await sayT('pip', 'Ik kruip nu weer even in mijn lantaarn. Tot beneden! Doe straks maar alsof je me nog nooit hebt gezien.');
    await sayT('oefenjoop', 'Kom. Boven ligt een brief op je bureau. De wethouder schrijft altijd op papier.', {mood: 'laugh'});
  });
}

// ---------------------------------------------------------------- the end: the real game again
function skip() {
  if (!TUT.active || TUT.finishing || TUT.skip) return;
  TUT.skip = true;
  rush();
  SFX.play('close');
  UI.toast('Uitleg overgeslagen', 'Joop: ‘Ook goed. Ik ben niet beledigd. Een beetje.’', 'quest');
}
// let the conversation on screen run by itself (and put the autopilot back as it was afterwards)
function rush() { if (DLG.active && !TUT.rushing) { TUT.autoWas = DLG.auto; TUT.rushing = true; DLG.auto = true; } }
async function finish() {
  if (TUT.finishing) return;
  TUT.finishing = true;
  // a conversation that is still going (you skipped halfway): let it rush by
  if (DLG.active) { rush(); await until(() => !DLG.active); }
  if (TUT.rushing) { DLG.auto = TUT.autoWas; TUT.rushing = false; }
  closeControlsCard();
  if (GAME.modal) UI.closeModal?.(true);
  await UI.fade(true);
  const {snap, back} = TUT, practised = [...TUT.practised];
  hidePanel(); hideMarker();
  document.body.classList.remove('oefenen');
  document.body.style.removeProperty('--oefen-pip');
  delete CHAMBER.oefen;
  TUT.active = false;
  try { applySave(JSON.parse(snap)); } catch (e) { console.warn('oefenlokaal: no copy of the game to put back', e); }
  G.flags.geoefend = true;
  for (const id of practised) G.flags[`geoefend:${id}`] = true;
  P.tool = G.tool || 'lamp';
  // leave without letting the practice room's position or map end up in the save
  W.id = null;
  if (back) await enterFloor(back.floor, null, {fade: false, pos: back.pos});
  else {
    if (ON.start) { G.floor = ON.start.floor; G.at = ON.start.at; }
    await enterFloor(G.floor, G.at, {fade: false});
  }
  savePosition(); saveGame();
  await UI.fade(false);
  if (back) UI.toast('Terug in het spel', 'Je bent weer waar je was. Alles staat er nog.', 'good');
  else ON.newGame?.();
  TUT.resolveDone?.();
}

// a save made in the middle of the practice (and a reload): the practice starts again, the copy of the game is kept
ON.floor.oefen = () => {
  if (TUT.active) return;
  let data = null;
  try { data = JSON.parse(G.flags[BACKUP] || 'null'); } catch (e) { data = null; }
  setTimeout(() => {
    if (data?.snap) tutorialStart({resume: data});
    else {
      // no copy to go back to: start the real game from the beginning of the day
      if (ON.start) { G.floor = ON.start.floor; G.at = ON.start.at; }
      enterFloor(G.floor, G.at).then(() => ON.newGame?.());
    }
  }, 0);
};

// ---------------------------------------------------------------- what the practice room responds to
for (const id of ['oefen_regels', 'oefen_welkom', 'oefen_achter', 'oefen_kloofbord', 'oefen_nis']) ON.use[id] = s => { TUT.f.read = true; return UI.read(s.def.title, s.def.text); };
ON.pickup['snack:oefen'] = () => { TUT.f.picked = true; };
ON.use.oefen_nepmuur = e => {
  FX.burst(e.x, 1.6, e.z, 60, {color: [0xffd36b, 0x8fe0a0, 0xff8fb0, 0x9fc3ff], speed: 4, up: 3, life: 1.4, s0: 0.16});
  setTimeout(() => UI.pip('Ha! Er zat helemaal geen muur. Er zat een nisje. Altijd even toetsen.'), 300);
};
onDummyHit(tool => {
  if (!TUT.active) return;
  TUT.hits.add(tool);
  if (!['lamp', 'scale', 'seal', 'pass'].includes(tool)) TUT.f.ability = true;
});

// ---------------------------------------------------------------- the checklist panel
addStyles('oefen', `
body.oefenen #tracker{display:none}
body.oefenen #pip{top:var(--oefen-pip,auto);bottom:auto}
#oefen{position:fixed;left:max(16px,env(safe-area-inset-left));top:120px;width:min(330px,calc(100vw - 32px));z-index:6;padding:12px 14px;display:grid;gap:7px;pointer-events:none}
#oefen[hidden]{display:none}
#oefen button{pointer-events:auto}
#oefen .oh{display:flex;align-items:center;gap:8px;font-family:var(--f-ui);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
#oefen .oh .n{margin-left:auto;color:var(--dim);letter-spacing:.04em;text-transform:none;font-size:12px}
.pipdot{width:16px;height:16px;flex:none;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:radial-gradient(circle at 45% 40%,#fff6d0,#ffc85a 45%,#e8862a 75%);box-shadow:0 0 10px #ffb84a}
#oefen .dots{display:flex;gap:4px;flex-wrap:wrap}
#oefen .dots i{width:9px;height:9px;border-radius:50%;background:rgba(242,226,196,.12);border:1px solid rgba(242,226,196,.28)}
#oefen .dots i.done{background:var(--good);border-color:var(--good)}
#oefen .dots i.cur{background:var(--gold);border-color:var(--gold-hi);box-shadow:0 0 8px var(--gold)}
#oefen h3{margin:2px 0 0;font-family:var(--f-display);font-size:19px;line-height:1.2;color:var(--gold-hi)}
#oefen .ot{margin:0;font-family:var(--f-body);font-size:17px;line-height:1.38;color:var(--parch)}
#oefen .ot kbd,#oefentip kbd{font-size:13px;padding:2px 7px;border-bottom-width:3px;background:rgba(255,236,190,.1);border-color:rgba(255,226,166,.55);color:var(--gold-hi);vertical-align:1px}
#oefen .ok{font-family:var(--f-display);font-size:18px;color:var(--good);animation:oefenok .5s ease-out}
#oefen .ob{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
#oefen .ob .btn{font-size:13px;padding:6px 10px}
#oefen .ob .act{background:rgba(232,194,122,.2);border-color:var(--gold)}
#oefen .ob .skip{margin-left:auto}
#oefen .ft{font-size:12px;color:var(--dim)}
#oefen.mini{top:auto!important;bottom:max(16px,env(safe-area-inset-bottom));z-index:24;width:auto;grid-template-columns:auto auto;align-items:center;gap:12px}
#oefen.mini>:not(.oh):not(.ob){display:none}
#oefen.mini .ob>:not(.skip){display:none}
#oefen.mini .ob .skip{margin-left:0}
@keyframes oefenok{0%{transform:scale(.7);opacity:0}50%{transform:scale(1.12);opacity:1}100%{transform:none}}
@media (max-width:560px){#oefen{width:min(290px,calc(100vw - 32px));padding:10px 12px}#oefen .ot{font-size:15px}#oefen h3{font-size:17px}}
@media (max-height:700px){#oefen .ft{display:none}#oefen .ot{font-size:16px}}
@media (max-height:500px){#oefen{width:min(290px,calc(100vw - 32px));padding:8px 10px;gap:5px}#oefen h3{font-size:16px}#oefen .ot{font-size:14.5px;line-height:1.3}}
#oefentip{position:absolute;left:50%;bottom:205px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));padding:10px 38px 11px 46px;font-family:var(--f-body);font-size:16.5px;line-height:1.38;pointer-events:auto;animation:oefentip .4s ease-out}
@keyframes oefentip{0%{transform:translateX(-50%) translateY(10px);opacity:0}100%{transform:translateX(-50%);opacity:1}}
#oefentip[hidden]{display:none}
#oefentip .pipdot{position:absolute;left:14px;top:13px;width:20px;height:20px}
#oefentip .tl{display:block;font-family:var(--f-ui);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:2px}
#oefentip .x{position:absolute;right:6px;top:6px;width:26px;height:26px;font-size:12px}
@media (max-width:640px) and (min-height:501px) and (hover:none) and (pointer:coarse){#oefentip{bottom:330px;font-size:15px}}
@media (max-height:500px){#oefentip{bottom:auto;top:calc(max(14px,env(safe-area-inset-top)) + 64px);font-size:14.5px;width:min(440px,calc(100vw - 32px))}}
`);

let panel = null;
function makePanel() {
  panel = {root: el('div', {id: 'oefen', class: 'card', role: 'region', 'aria-label': 'Oefenlokaal', 'aria-live': 'polite', hidden: true})};
  document.body.append(panel.root);
  return panel;
}
function renderPanel() {
  if (!TUT.active) return;
  const p = panel || makePanel(), s = TUT.step, n = TUT.steps.length;
  const r = p.root;
  r.innerHTML = '';
  const shown = Math.min(n, Math.max(1, TUT.i + 1));
  r.append(el('div', {class: 'oh'}, el('span', {class: 'pipdot', 'aria-hidden': 'true'}), el('span', {text: 'Het oefenlokaal'}), el('span', {class: 'n', text: s ? `stap ${shown} van ${n}` : 'klaar!'})));
  const dots = el('div', {class: 'dots', 'aria-hidden': 'true'});
  TUT.steps.forEach((x, i) => dots.append(el('i', {class: TUT.practised.has(x.id) ? 'done' : i === TUT.i && s ? 'cur' : ''})));
  r.append(dots);
  if (TUT.f.okT > 0 && TUT.f.okText) r.append(el('div', {class: 'ok', text: `✓ ${TUT.f.okText}`}));
  if (s) {
    r.append(el('h3', {text: s.title}), el('p', {class: 'ot', html: stepText(s)}));
  } else r.append(el('p', {class: 'ot', text: 'Alles geoefend. Joop heeft nog een woordje voor je.'}));
  const btns = el('div', {class: 'ob'});
  if (s?.button && IS_TOUCH) btns.append(el('button', {class: 'btn act', onclick: () => press(codesFor(s.button.action)[0])}, s.button.text));
  btns.append(el('button', {class: 'btn', onclick: () => controlsCard()}, 'Alle toetsen'));
  btns.append(el('button', {class: 'btn skip', onclick: () => { if (GAME.modal && GAME.modal !== 'decision') UI.closeModal?.(true); skip(); }}, 'Sla de uitleg over'));
  r.append(btns);
  if (!IS_TOUCH) r.append(el('div', {class: 'ft', html: `Muis vrij om te klikken? Druk op ${kc('Escape')}.`}));
}
function hidePanel() { if (panel) panel.root.hidden = true; }
let placeT = 0;
function updatePanel(dt) {
  if (!panel) return;
  const r = panel.root;
  const show = TUT.active && GAME.mode === 'play' && W.id === 'oefen' && GAME.modal !== 'decision';
  if (r.hidden === show) r.hidden = !show;
  if (!show) return;
  if (TUT.f.okT > 0) { TUT.f.okT -= dt; if (TUT.f.okT <= 0) renderPanel(); }
  r.classList.toggle('mini', !!GAME.modal);
  // sit just below the status card (whatever size the screen gives it)
  if ((placeT -= dt) <= 0) {
    placeT = 0.5;
    const b = document.querySelector('#hud .status')?.getBoundingClientRect();
    if (b && b.bottom > 0) r.style.top = `${Math.round(b.bottom + 10)}px`;
    if (!r.classList.contains('mini')) { const pb = r.getBoundingClientRect().bottom; if (pb > 0) document.body.style.setProperty('--oefen-pip', `${Math.round(Math.min(pb + 8, innerHeight - 120))}px`); }
  }
}

// ---------------------------------------------------------------- the light on the floor where the step points
let marker = null;
function makeMarker() {
  const g = new THREE.Group();
  const color = 0xffd36b;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 36), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.6, 18, 1, true), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending}));
  beam.position.y = 1.3; g.add(beam);
  const glow = glowSprite(color, 1.8, 0.55); glow.position.y = 0.45; g.add(glow);
  g.visible = false;
  R.scene.add(g);
  return (marker = {g, ring, beam, glow, t: 0});
}
function hideMarker() { if (marker) marker.g.visible = false; }
function updateMarker(dt, st) {
  if (!TUT.active || !st.inRoom) { hideMarker(); return; }
  const pos = targetPos(stepTarget());
  const m = marker || makeMarker();
  if (!pos || (TUT.f.okT > 0)) { m.g.visible = false; return; }
  m.t += dt;
  m.g.visible = true;
  m.g.position.set(pos.x, 0, pos.z);
  const s = 1 + Math.sin(m.t * 4) * 0.08;
  m.ring.scale.set(s, s, s);
  m.beam.material.opacity = 0.1 + Math.sin(m.t * 3) * 0.04;
  // fade out the beam when you are standing in it, so it does not fill the screen
  const d = Math.hypot(P.x - pos.x, P.z - pos.z);
  m.beam.visible = d > 1.6;
}

// ---------------------------------------------------------------- just-in-time tips, for those who skipped the practice
// The first time something new matters, one short tip with the key. Each shows once per game, and not at all
// when you practised it (G.flags['geoefend:<step>']).
const TIPS = {
  lamp: {skip: 'lamp', text: () => `Je hebt de <b>Toetslamp</b>. Klik om licht te schieten; ingedrukt houden schiet door. Met ${k('reveal')} of de rechtermuisknop laat je het licht openbarsten: wat niet echt is, verdwijnt.`,
    touch: () => 'Je hebt de <b>Toetslamp</b>. Tik op ✦ om licht te schieten. Met ☀ laat je het licht openbarsten: wat niet echt is, verdwijnt.'},
  scale: {skip: 'scale', text: () => `De <b>Weegschaal</b> kies je met ${k('tool2')}. Klik en je maakt een golf rondom je die alles vertraagt. Fijn als je omsingeld wordt.`,
    touch: () => 'De <b>Weegschaal</b>: tik onderin op ⚖️ en dan op ✦ voor een golf rondom je die alles vertraagt.'},
  seal: {skip: 'seal', text: () => `Het <b>Zegel</b> kies je met ${k('tool3')}: een stevige stempel van dichtbij. Loop naar een monster toe en klik. Wisselen kan ook met ${k('cycle')}.`,
    touch: () => 'Het <b>Zegel</b>: tik onderin op 🔏, loop naar een monster toe en tik op ✦ voor een stevige stempel.'},
  reveal: {skip: 'reveal', text: () => `Die muur glanst verdacht. Druk op ${k('reveal')} (of de rechtermuisknop): wat niet echt is, verdwijnt.`,
    touch: () => 'Die muur glanst verdacht. Tik op ☀: wat niet echt is, verdwijnt.'},
  carry: {skip: null, text: () => `Je draagt iets. Breng het naar de plek waar het hoort en druk daar op ${k('interact')}. Met ${k('cycle')} leg je het terug waar je het vond.`,
    touch: () => 'Je draagt iets. Breng het naar de plek waar het hoort en tik daar op E.'},
  dash: {skip: 'dash', text: () => `Een smalle kloof. Loop naar de rand en druk op ${k('dash')}: zo duik je eroverheen.`,
    touch: () => 'Een smalle kloof. Loop naar de rand en tik op »: zo duik je eroverheen.'},
  monster: {skip: 'lamp', text: () => `Een monster! Kijk ernaar: dan zie je waar het zwak voor is. Klik om je gereedschap te gebruiken, kies met ${k('tool1')} ${k('tool2')} ${k('tool3')} en duik weg met ${k('dash')}.`,
    touch: () => 'Een monster! Kijk ernaar: dan zie je waar het zwak voor is. Tik op ✦ om je gereedschap te gebruiken, kies onderin een ander gereedschap en duik weg met ».'},
};
const TIPQ = [];
let tipEl = null, tipT = 0;
export function tip(id) {
  const t = TIPS[id];
  if (!t || G.flags[`tip:${id}`] || (t.skip && G.flags[`geoefend:${t.skip}`]) || TUT.active || W.id === 'oefen') return false;
  G.flags[`tip:${id}`] = true;
  TIPQ.push(t);
  return true;
}
function updateTip(dt) {
  if (tipEl && !tipEl.hidden) {
    tipT -= dt;
    if (tipT <= 0 || GAME.mode !== 'play') tipEl.hidden = true;
    return;
  }
  if (!TIPQ.length || GAME.mode !== 'play' || GAME.modal || DLG.active || GAME.busy) return;
  const t = TIPQ.shift();
  if (!tipEl) {
    tipEl = el('div', {id: 'oefentip', class: 'card', role: 'status', hidden: true});
    (document.getElementById('hud') || document.body).append(tipEl);
  }
  tipEl.innerHTML = '';
  tipEl.append(el('span', {class: 'pipdot', 'aria-hidden': 'true'}), el('span', {class: 'tl', text: 'Tip'}), el('span', {html: (IS_TOUCH ? t.touch : t.text)()}),
    el('button', {class: 'btn icon x', 'aria-label': 'Tip sluiten', onclick: () => { tipEl.hidden = true; }}, '✕'));
  tipEl.hidden = false;
  tipT = 9;
  SFX.play('pip');
}
// is there a chasm right next to you that one dash crosses (the tile beyond it is floor)?
function nearNarrowChasm() {
  const tx = tileOf(P.x), tz = tileOf(P.z);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (tileType(tx + dx, tz + dz) !== T.CHASM) continue;
    if (walkTile(tx + dx * 2, tz + dz * 2)) return true;
  }
  return false;
}
const TIPCHK = {t: 0};
function tipTick(dt) {
  if (TUT.active || W.id === 'oefen' || (TIPCHK.t -= dt) > 0) return;
  TIPCHK.t = 0.4;
  if (P.carry) tip('carry');
  if (G.tools.lamp && !G.flags['tip:reveal'] && W.ents.some(e => e instanceof Illusion && !e.revealed && e.visible !== false && e.dist() < 6)) tip('reveal');
  if (!G.flags['tip:dash'] && nearNarrowChasm()) tip('dash');
  if (!G.flags['tip:monster'] && C.enemies.some(e => e.alive && e.aware && !e.def.hiddenInBook && Math.hypot(e.x - P.x, e.z - P.z) < 14)) tip('monster');
}

// ---------------------------------------------------------------- set up (from content/index.js, after every story file)
export function registerTutorial() {
  ON.tutorialStart = tutorialStart;
  ON.tutorialActive = () => TUT.active;
  ON.tip = tip;
  UI.controlsCard = controlsCard;
  ITEMS['snack:oefen'] = {name: 'De stroopwafel van de maand', kind: 'snack', heal: 10, color: 0xd89a50};
  // Pip's hint (H): in the practice it is about the current step, and it counts as practised
  const prevHint = ON.hint;
  ON.hint = () => {
    if (!TUT.active) return prevHint?.();
    TUT.f.hinted = true;
    if (TUT.step?.id === 'hint') return 'Zie je? Zo werkt het. Ik wijs je nu de weg naar Joop: hij heeft nog één ding voor je.';
    return TUT.step?.hint || 'Kijk in je lijstje links in beeld: daar staat wat je nu kunt doen.';
  };
  // the tools: a tip the moment you get one (a little after the toast that announces it)
  const prevItem = ON.afterItem;
  ON.afterItem = id => {
    prevItem?.(id);
    const tool = /^tool:(lamp|scale|seal)$/.exec(id)?.[1];
    if (tool) setTimeout(() => tip(tool), 1500);
  };
  ON.tick.push(tipTick);
}
