// The game loop and everything that glues the pieces together.
import * as THREE from 'three';
import {R, initRenderer, updateLights, render, animateMaterials, resize, setBrightness} from '../engine/render.js';
import {SHARED_UNIFORMS} from '../engine/batch.js';
import {FX} from '../engine/particles.js';
import {Input, bindInput, endFrame, down, hit, lock, unlock, press} from '../core/input.js';
import {G, SETTINGS, saveGame, loadGame, hasSave, resetState, loadSettings, saveSettings} from './state.js';
import {W, loadFloor, FLOORS, parsed, saveExplored} from './world.js';
import {spawnEntities, setTravel, setGiveItem, dropCarry, Npc} from './entities.js';
import {P, UI, SFX, ON, ITEMS, NET, cond} from './bus.js';
import {PL, initPlayer, placePlayer, updatePlayer, setCamMode, hurtPlayer, healPlayer, pipHint, savePosition} from './player.js';
import {C, TOOLS, TOOL_ORDER, useTool, revealPulse, updateCombat, spawnFloorEnemies, clearEnemies, aim} from './combat.js';
import {DLG, updateDialogue, talkTo, converse, say, choose, wait, scene, unlockForUi, relock} from './dialogue.js';
import {tracked, QUESTS, stage, setStage, startQuest} from './quests.js';
import {initHud, updateHud, dialogueKey} from '../ui/hud.js';
import {TILE, tileOf, $, clamp} from '../core/util.js';

export const GAME = {mode: 'boot', time: 0, modal: null, zoneId: null, last: 0, fps: 60, frames: 0, speed: 1, onFrame: [], busy: false};

export function boot({onReady} = {}) {
  loadSettings();
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') SETTINGS.quality = q;
  initRenderer($('stage'), SETTINGS.quality);
  setBrightness(SETTINGS.bright ?? 1);
  FX.init();
  initPlayer();
  initHud();
  bindInput(R.renderer.domElement);
  Input.onLockLost = () => { if (Input.expectUnlock) { Input.expectUnlock = false; return; } if (GAME.mode === 'play' && !GAME.modal && !DLG.active) UI.modal?.('menu'); };
  Input.onKey = e => onKey(e);
  setTravel(travel);
  setGiveItem(giveItem);
  ON.give = giveItem;
  UI.talk = npc => talkTo(npc);
  UI.selectTool = id => selectTool(id);
  UI.reveal = () => revealPulse();
  PL.onDie = () => onDeath();
  W.onLoad.push(() => FX.setScale(R.renderer.domElement.height / (2 * Math.tan(R.camera.fov * Math.PI / 360))));
  addEventListener('resize', () => FX.setScale(R.renderer.domElement.height / (2 * Math.tan(R.camera.fov * Math.PI / 360))));
  requestAnimationFrame(frame);
  onReady?.();
}

// ---------------------------------------------------------------- starting and travelling
export async function newGame() {
  resetState();
  if (ON.start) { G.floor = ON.start.floor; G.at = ON.start.at; }
  GAME.mode = 'play';
  await enterFloor(G.floor, G.at, {fade: false});
  ON.newGame?.();
  saveGame();
}
export async function continueGame() {
  if (!loadGame()) return newGame();
  GAME.mode = 'play';
  await enterFloor(G.floor, null, {fade: false, pos: G.pos});
  UI.toast('Welkom terug', 'Je gaat verder waar je was.');
}

export async function enterFloor(id, arrival, {fade = true, pos = null} = {}) {
  GAME.busy = true;
  if (fade) await UI.fade(true);
  if (W.id) { savePosition(); saveExplored(); }
  clearEnemies();
  if (P.carry) { P.carry = null; }
  loadFloor(id);
  spawnEntities();
  spawnFloorEnemies();
  const L = W.L;
  let a = arrival ? L.arrivals[arrival] : null;
  if (pos) placePlayer(pos.x, pos.z, pos.yaw);
  else {
    if (!a) a = Object.values(L.arrivals)[0] || {x: 1, z: 1, yaw: 0};
    placePlayer(a.x * TILE + 1, a.z * TILE + 1, a.yaw);
  }
  G.at = arrival || G.at;
  GAME.zoneId = null;
  ON.floor[id]?.();
  updatePlayer(0.016, false);
  GAME.busy = false;
  if (fade) await UI.fade(false);
  const def = FLOORS[id];
  if (!G.flags[`seen:${id}`] && def.depth) { G.flags[`seen:${id}`] = true; UI.banner(def.name, def.depth); }
  SFX.music(def.music || id);
  saveGame();
}
export async function travel(id, arrival) {
  if (GAME.busy) return;
  await enterFloor(id, arrival);
}

// ---------------------------------------------------------------- items
export function giveItem(id, from) {
  if (!id) return;
  const [kind, a, b] = String(id).split(':');
  const info = ITEMS[id] || ITEMS[kind] || {};
  if (kind === 'bron') {
    if (!G.bronnen.includes(`${a}:${b}`)) G.bronnen.push(`${a}:${b}`);
    UI.toast('Bron gevonden', info.name || ITEMS[`bron:${a}:${b}`]?.name || 'Een bron voor het dossier', 'bron'); SFX.play('bron');
  } else if (kind === 'halluc') {
    if (!G.hallucs.includes(a)) G.hallucs.push(a);
    UI.toast(`Hallucinatie ${G.hallucs.length}/${ON.totals?.hallucs ?? 12}`, info.short || 'Een overtuigend fout antwoord van het Orakel.', 'quest'); SFX.play('bron');
  } else if (kind === 'kristal') {
    if (!G.crystals.includes(a)) { G.crystals.push(a); G.maxHp += 25; G.hp = G.maxHp; }
    UI.toast('Vertrouwenskristal', `Je kunt meer hebben: maximaal vertrouwen ${G.maxHp}.`, 'good'); SFX.play('crystal');
  } else if (kind === 'key') {
    G.keys[a] = true; UI.toast('Sleutel', info.name || a, 'quest'); SFX.play('key');
  } else if (kind === 'tool') {
    G.tools[a] = true; selectTool(a);
    UI.toast(`Nieuw gereedschap: ${TOOLS[a].name}`, `${TOOLS[a].attack}. Toets ${TOOL_ORDER.indexOf(a) + 1}.`, 'good'); SFX.play('tool');
  } else if (kind === 'snack') {
    healPlayer(info.heal ?? 25); UI.toast(info.name || 'Stroopwafel', `+${info.heal ?? 25} vertrouwen`, 'good'); SFX.play('eat');
  } else if (kind === 'card') {
    if (!G.cards.includes(a)) G.cards.push(a);
    UI.toast(`Visitekaartje ${G.cards.length}/${ON.totals?.cards ?? 8}`, info.short || 'Glans van PraatPal', 'quest'); SFX.play('pick');
  } else {
    G.items[id] = (G.items[id] || 0) + 1;
    UI.toast(info.name || id, info.text || '', 'quest'); SFX.play('pick');
  }
  ON.pickup[id]?.(from);
  ON.afterItem?.(id);
  saveGame();
}

export function selectTool(id) {
  if (!G.tools[id]) return;
  if (P.tool !== id) SFX.play('switch');
  P.tool = id; G.tool = id;
}

// ---------------------------------------------------------------- death: Pip pulls you back
async function onDeath() {
  if (P.dead) return;
  P.dead = true; G.stats.deaths++;
  SFX.play('down');
  await UI.fade(true, 0.8);
  clearEnemies();
  const coffee = G.lastCoffee && G.lastCoffee.floor === G.floor ? G.lastCoffee : null;
  G.hp = G.maxHp;
  P.dead = false;
  spawnFloorEnemies();
  if (coffee) placePlayer(coffee.x, coffee.z, coffee.yaw ?? 0);
  else { const a = W.L.arrivals[G.at] || Object.values(W.L.arrivals)[0]; placePlayer(a.x * TILE + 1, a.z * TILE + 1, a.yaw); }
  await UI.fade(false, 0.6);
  UI.pip(ON.deathLine?.() || 'Hela. Je vertrouwen was op. Ik heb je teruggebracht naar een veilige plek; wat je al wist, ben je niet kwijt.');
  saveGame();
}

// ---------------------------------------------------------------- input
function onKey(e) {
  if (GAME.mode !== 'play') return;
  if (DLG.active) { if (dialogueKey(e.code)) e.preventDefault(); return; }
  if (GAME.modal) { if (e.code === 'Escape' || (e.code === 'KeyJ' && GAME.modal === 'journal') || (e.code === 'KeyM' && GAME.modal === 'map')) UI.closeModal?.(); return; }
  if (e.code === 'Escape' && !Input.locked) UI.modal?.('menu');
}

function interactTarget() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, bs = 1e9;
  for (const e of W.ents) {
    if (e.visible === false) continue;
    let ok = false;
    try { ok = e.interactable; } catch (err) { ok = false; }
    if (!ok) continue;
    const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz), dot = (dx * fx + dz * fz) / (d || 1);
    if (d > 1.3 && dot < 0.15) continue;
    const s = d - dot * 1.5;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

let holdT = 0;
function handleInput(dt) {
  const target = interactTarget();
  PL.target = target;
  if (target) UI.prompt(target.label?.() || 'Gebruik', 'E');
  else if (P.carry) UI.prompt(`Je draagt iets · Q om het terug te leggen`, 'Q');
  else UI.prompt(null);
  if ((hit('KeyE') || hit('KeyF')) && target) { target.interact(); }
  for (const [i, id] of TOOL_ORDER.entries()) if (hit(`Digit${i + 1}`) || hit(`Numpad${i + 1}`)) selectTool(id);
  if (hit('KeyQ')) { if (P.carry) dropCarry(); else cycleTool(1); }
  if (Input.wheel && PL.camMode === 'first') cycleTool(Input.wheel > 0 ? 1 : -1);
  if (hit('KeyR') || Input.clicks[2]) revealPulse();
  const attacking = Input.mouseDown[0] || down('Attack');
  if (Input.clicks[0] || hit('Attack')) { useTool(P.tool); holdT = 0; }
  else if (attacking && P.tool === 'lamp') { holdT += dt; if (holdT > 0.15) useTool('lamp'); }
  if (hit('KeyV')) setCamMode(PL.camMode === 'first' ? 'third' : 'first');
  if (hit('KeyJ') || hit('Tab')) UI.modal?.('journal');
  if (hit('KeyM')) UI.modal?.('map');
  if (hit('KeyH')) hint();
  // what the crosshair is on
  if ((GAME.frames & 3) === 0) { const a = aim(); UI.target(a.target); }
}
function cycleTool(d) {
  const owned = TOOL_ORDER.filter(t => G.tools[t]);
  if (owned.length < 2) return;
  const i = owned.indexOf(P.tool);
  selectTool(owned[(i + d + owned.length) % owned.length]);
}
function hint() {
  const q = tracked();
  if (!q) return;
  const h = ON.hint?.() || q.text;
  UI.pip(h);
  if (q.target && !q.target.floor) pipHint(q.target);
  SFX.play('pip');
}

// ---------------------------------------------------------------- zones
function checkZone() {
  const zn = W.L.zoneAt(tileOf(P.x), tileOf(P.z));
  const id = zn.id;
  if (id === GAME.zoneId) return;
  GAME.zoneId = id;
  const key = `zone:${W.id}:${id}`;
  if (!G.flags[key] && zn.index >= 0) {
    G.flags[key] = true;
    if (zn.banner !== false && zn.name) UI.banner(zn.name, zn.sub || W.L.def.depth || '');
    ON.zone[id]?.(zn);
  }
  if (zn.music) SFX.music(zn.music); else SFX.music(W.L.def.music || W.id);
}

// ---------------------------------------------------------------- the frame
const clock = {last: performance.now()};
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - clock.last) / 1000);
  clock.last = now;
  if (window.__hold) return;
  step(dt * GAME.speed);
}
export function step(dt) {
  GAME.frames++;
  R.time += dt; SHARED_UNIFORMS.uTime.value = R.time;
  const playing = GAME.mode === 'play' && W.L && !GAME.busy;
  const active = playing && !GAME.modal && !DLG.active && !P.dead;
  updateDialogue(dt);
  if (playing) {
    if (active) { G.stats.time += dt; handleInput(dt); }
    else UI.prompt(null);
    updatePlayer(dt, active);
    for (const e of W.ents) e.update(dt);
    updateCombat(dt, active || (playing && DLG.active && DLG.combatOn));
    if (active) { checkZone(); for (const fn of ON.tick) fn(dt); }
    updateHud(dt, tracked());
  }
  for (const fn of GAME.onFrame) fn(dt);
  FX.update(dt);
  animateMaterials(dt);
  updateLights(dt, P.x, P.z);
  if (!GAME.noRender) render();
  endFrame();
}

// ---------------------------------------------------------------- debug and test hooks
export function exposeDebug(extra = {}) {
  window.__orakel = {
    G, P, W, C, R, GAME, NET, DLG, PL, QUESTS, SETTINGS, ON, THREE, stage, setStage, startQuest, travel, enterFloor, giveItem, useTool, revealPulse, newGame, continueGame, saveGame, say, choose, scene, press,
    teleport(x, z, yaw) { placePlayer(x * TILE + 1, z * TILE + 1, yaw ?? P.yaw); },
    // run the world for n seconds of game time, quickly, with conversations on autopilot
    // async: conversations are promise chains, so give them a turn between frames
    async run(sec, {auto = true, choices = []} = {}) {
      window.__hold = true; DLG.auto = auto; DLG.autoQ = choices.slice(); GAME.noRender = true;
      try {
        const n = Math.ceil(sec / (1 / 30));
        for (let i = 0; i < n; i++) { if (i === n - 1) GAME.noRender = false; step(1 / 30); await new Promise(r => setTimeout(r, 0)); }
      } finally { window.__hold = false; DLG.auto = false; GAME.noRender = false; }
    },
    ...extra,
  };
}
void clamp; void cond; void Npc; void unlockForUi; void relock; void unlock; void lock; void saveSettings; void hasSave; void hurtPlayer; void startQuest; void QUESTS; void stage; void setStage; void wait; void choose; void say; void converse; void scene; void resize; void parsed;
