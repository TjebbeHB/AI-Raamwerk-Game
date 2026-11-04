// Het oefenlokaal: the practice floor parses, every step points at a place you can reach (with one dash
// over the gap), the gap, the gate and the fake wall really are the lessons they teach, the oefenpop is
// harmless, and the hooks for the other lanes are in place.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseFloor, T, WALKABLE} from '../src/engine/level.js';
import {makeModel} from '../src/engine/models.js';
import {registerContent, FLOOR_DEFS} from '../src/content/index.js';
import {ON, UI, CAST, ITEMS} from '../src/game/bus.js';
import {BEASTS} from '../src/game/combat.js';
import {FLOORS} from '../src/game/world.js';
import {QUESTS} from '../src/game/quests.js';
import {G, resetState} from '../src/game/state.js';
import OEFEN, {SPOTS, BEYOND} from '../src/content/floors/oefen.js';
import {OEFEN_DEFS, onDummyHit} from '../src/content/oefenpop.js';
import {STEPS} from '../src/content/story/tutorial.js';

registerContent();
const here = path.dirname(fileURLToPath(import.meta.url));
const L = parseFloor(OEFEN);
const at = (x, z) => z * L.W + x;
const entity = id => L.entities.find(e => e.id === id);

// Reachability the way a player moves: walk, and dash over one chasm tile to the floor beyond it.
function reach({jump = true, gate = true, revealed = true} = {}) {
  const seen = new Uint8Array(L.W * L.H), start = L.arrivals.start, q = [[start.x, start.z]];
  const blocked = new Set(L.entities.filter(e => e.type === 'crate' || (e.type === 'gate' && !gate)).map(e => at(e.x, e.z)));
  const ok = (x, z) => {
    if (x < 0 || z < 0 || x >= L.W || z >= L.H || blocked.has(at(x, z))) return false;
    const t = L.tiles[at(x, z)];
    return WALKABLE.has(t) || (revealed && t === T.ILLUSION);
  };
  seen[at(start.x, start.z)] = 1;
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = x + dx, nz = z + dz;
      if (jump && L.tiles[at(nx, nz)] === T.CHASM) { nx += dx; nz += dz; }
      if (!ok(nx, nz) || seen[at(nx, nz)]) continue;
      seen[at(nx, nz)] = 1; q.push([nx, nz]);
    }
  }
  return seen;
}
// what a step points at, as a tile
function stepTile(s) {
  const a = typeof s.at === 'function' ? s.at() : s.at ? {t: s.at} : null;
  if (!a) return null;
  if (a.e) { const e = entity(a.e); assert.ok(e, `step ${s.id} points at ${a.e}, which is not on the floor`); return [e.x, e.z]; }
  return a.t;
}
// a tile counts as reachable when you can stand on it, or right next to it (people, signs, the crate)
const reachableNear = (seen, [x, z]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => seen[at(x + dx, z + dz)]);

test('the practice floor parses and is a floor of its own, not a depth', () => {
  assert.deepEqual(L.errors, [], L.errors.join('; '));
  assert.ok(L.arrivals.start, 'the practice starts at the arrival "start"');
  assert.ok(FLOORS.oefen, 'registered as a floor');
  assert.ok(!FLOOR_DEFS.includes(OEFEN), 'not one of the five depths');
  for (const e of L.entities.filter(e => e.type === 'npc')) assert.ok(CAST[e.id] && ON.talk[e.id], `npc ${e.id} needs a cast entry and a conversation`);
  for (const e of L.entities.filter(e => e.type === 'enemy')) assert.ok(BEASTS[e.kind], `unknown monster ${e.kind}`);
  for (const e of L.entities.filter(e => e.type === 'item')) assert.ok(ITEMS[e.id], `unknown item ${e.id}`);
  for (const e of L.entities.filter(e => e.type === 'sign')) assert.ok(ON.use[e.id], `sign ${e.id} counts for the reading step`);
});

test('every step points at a place you can reach', () => {
  G.hero = {name: 'Sam', archetype: 'datatovenaar'};
  try {
    const seen = reach();
    const steps = STEPS.filter(s => !s.when || s.when());
    assert.ok(steps.length >= 16, `${steps.length} steps`);
    assert.ok(steps.some(s => s.id === 'ability'), 'a hero with an archetype practises the ability');
    for (const s of steps) {
      const tile = stepTile(s);
      if (tile) assert.ok(reachableNear(seen, tile), `step ${s.id}: ${tile} is out of reach`);
    }
    // every spot except the plate, which the crate gets to (see the next test)
    for (const [name, spot] of Object.entries(SPOTS)) if (name !== 'plate') for (const tile of Array.isArray(spot[0]) ? spot : [spot]) assert.ok(reachableNear(seen, tile), `spot ${name} ${tile} is out of reach`);
  } finally { resetState(); }
  assert.ok(!STEPS.filter(s => !s.when || s.when()).some(s => s.id === 'ability'), 'without an archetype there is no ability step');
});

test('the gap, the gate and the fake wall are real lessons', () => {
  const joop = entity('oefenjoop'), nis = entity('oefen_nis'), plate = entity('oefen_plaat'), crate = entity('oefen_krat'), wall = entity('oefen_nepmuur');
  // you only get to Joop by dashing over the gap
  assert.ok(!reachableNear(reach({jump: false}), [joop.x, joop.z]), 'Joop must be beyond the gap');
  assert.equal(L.tiles[at(...SPOTS.gap)], T.CHASM);
  for (let z = 0; z < L.H; z++) if (L.tiles[at(SPOTS.gap[0], z)] === T.CHASM) assert.equal(L.zoneAt(SPOTS.gap[0], z).id, 'kloof');
  assert.ok(BEYOND.includes(L.zoneAt(...SPOTS.dash).id), 'the landing counts as across');
  // the oefenzaal waits behind the gate; the crate can be pushed straight onto the plate from inside the koffiehoek
  const closed = reach({gate: false});
  for (const d of SPOTS.dummies) assert.ok(!closed[at(...d)], 'the poppen wait behind the gate');
  assert.equal(crate.x, plate.x, 'crate and plate in one line');
  assert.ok(closed[at(crate.x, crate.z - 1)], 'you can stand behind the crate');
  for (let z = crate.z + 1; z <= plate.z; z++) assert.ok(WALKABLE.has(L.tiles[at(crate.x, z)]), 'the crate slides all the way');
  for (let z = crate.z; z <= plate.z; z++) for (const dx of [-1, 1]) assert.equal(L.tiles[at(crate.x + dx, z)], T.SOLID, 'the lane keeps the crate from going sideways');
  assert.equal(L.tiles[at(plate.x, plate.z + 1)], T.SOLID, 'nobody gets in front of the crate');
  assert.equal(plate.accept, crate.kind);
  assert.equal(entity('oefen_hek').flag, plate.flag);
  // the nisje is only there for whoever reveals the fake wall
  assert.ok(!reach({revealed: false})[at(nis.x, nis.z)], 'the nisje is behind the fake wall');
  assert.ok(reach()[at(nis.x, nis.z)]);
  assert.deepEqual([wall.x, wall.z], SPOTS.wall);
});

test('the oefenpop never hurts and never falls over', () => {
  const def = OEFEN_DEFS.oefenpop;
  assert.equal(BEASTS.oefenpop, def);
  assert.equal(def.dmg, 0); assert.equal(def.speed, 0); assert.equal(def.attack, 'custom');
  assert.ok(def.noDrop && def.hiddenInBook && !def.lesson && !def.weak);
  const model = makeModel({kind: 'none', probe: null});
  const e = {def, model, x: 0, y: 0, z: 0, yaw: 0, hp: def.hp, maxHp: def.hp, st: {t: 0}};
  def.init(e);
  let meshes = 0; model.root.traverse(o => { if (o.isMesh) meshes++; });
  assert.ok(meshes > 8 && meshes <= 24, `${meshes} meshes`);
  const heard = [];
  const off = onDummyHit(tool => heard.push(tool));
  for (const tool of ['lamp', 'scale', 'seal']) { e.hp -= 9000; def.onHit(e, tool, 9000); assert.equal(e.hp, e.maxHp, `refilled after ${tool}`); }
  off();
  assert.deepEqual(heard, ['lamp', 'scale', 'seal']);
  for (let i = 0; i < 30; i++) { e.st.t += 0.05; model.animate(0.05, e.st); }
  model.root.traverse(o => { for (const v of [o.rotation.x, o.rotation.z]) assert.ok(Number.isFinite(v)); });
  assert.equal(def.update(e, 0.05), 'skipMove');
  assert.equal(e.aware, false, 'a dummy never starts a fight');
});

test('the hooks for the other lanes, and every text in the house style', () => {
  assert.equal(typeof ON.tutorialStart, 'function');
  assert.equal(typeof ON.tutorialActive, 'function');
  assert.equal(ON.tutorialActive(), false);
  assert.equal(typeof UI.controlsCard, 'function');
  assert.equal(CAST.oefenjoop, CAST.joop);
  assert.ok(QUESTS.oefen?.side, 'the practice tracker is a side quest, never shown outside the practice');
  G.hero = {archetype: 'verbinder'};
  try {
    for (const s of STEPS) {
      assert.ok(s.id && s.title && s.done, `step ${s.id}`);
      for (const f of [s.text, s.touch]) { const t = f(); assert.ok(t.length > 20, `step ${s.id} needs instructions`); assert.ok(!/[—–]/.test(t), `step ${s.id}: no dashes`); }
    }
  } finally { resetState(); }
  for (const f of ['src/content/story/tutorial.js', 'src/ui/controls.js', 'src/content/floors/oefen.js', 'src/content/oefenpop.js']) {
    assert.ok(!fs.readFileSync(path.join(here, '..', f), 'utf8').includes('—'), `${f} uses an em dash`);
  }
});

test('a tip shows once, and not at all for what you practised', () => {
  resetState();
  G.flags['geoefend:dash'] = true;
  assert.equal(ON.tip('dash'), false, 'practised: no tip');
  assert.equal(ON.tip('carry'), true, 'never practised: a tip');
  assert.equal(ON.tip('carry'), false, 'and only once');
  assert.equal(ON.tip('nonsense'), false);
  resetState();
});
