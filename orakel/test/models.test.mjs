// The voxel people: every cast member and every look option builds within the draw-call budget,
// with finite geometry, and every gesture and mood animates without breaking the pose.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeModel, makeHuman, GESTURES, viewArmGeometry} from '../src/engine/models.js';
import {CAST_DEFS} from '../src/content/cast.js';
import {LOOK_ENUMS, randomLook} from '../src/content/looks.js';
import {DEFAULT_LOOK} from '../src/game/hero.js';
import {makeRng} from '../src/core/util.js';

function check(m, who, maxVisible = 22) {
  let visible = 0, meshes = 0;
  m.root.traverse(o => {
    if (!o.isMesh) return;
    meshes++; if (o.visible) visible++;
    const p = o.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) assert.fail(`${who}: a vertex is not finite`);
  });
  assert.ok(visible <= maxVisible, `${who}: ${visible} visible meshes (one draw call each)`);
  assert.ok(meshes <= 32, `${who}: ${meshes} meshes`);
  return {meshes, visible};
}
function posesFinite(m, who) {
  m.root.traverse(o => { const q = o.quaternion, p = o.position; assert.ok(Number.isFinite(q.x + q.y + q.z + q.w + p.x + p.y + p.z), `${who}: a part flew off`); });
}

test('every member of the cast builds within the budget and animates', () => {
  for (const [id, c] of Object.entries(CAST_DEFS)) {
    if (!c.model) continue;
    const m = makeModel({npc: true, ...c.model});
    check(m, id);
    assert.ok(m.height > 0.3 && m.height < 2.6, `${id}: height ${m.height}`);
    for (let i = 0; i < 120; i++) m.animate(1 / 30, {t: i / 30, walk: i < 40 ? 1 : 0, run: i < 20, talk: i > 80, look: i > 60 ? 0.6 : null});
    posesFinite(m, id);
  }
});

test('every option of the look schema builds', () => {
  const base = {...DEFAULT_LOOK};
  const fields = {hair: LOOK_ENUMS.hair, top: LOOK_ENUMS.top, hat: LOOK_ENUMS.hat, glasses: LOOK_ENUMS.glasses, facialHair: LOOK_ENUMS.facialHair,
    build: LOOK_ENUMS.build, bottom: LOOK_ENUMS.bottom, brows: LOOK_ENUMS.brows, nose: LOOK_ENUMS.nose, age: LOOK_ENUMS.age, pattern: LOOK_ENUMS.pattern};
  for (const [k, opts] of Object.entries(fields)) for (const o of opts) {
    const m = makeHuman({...base, [k]: o.id, long: true, fringe: true});
    check(m, `${k}=${o.id}`);
    m.animate(1 / 30, {t: 1, walk: 1});
  }
  for (const hold of LOOK_ENUMS.hold) check(makeHuman({...base, holdL: hold.id, holdR: hold.id}), `hold ${hold.id}`);
  // hats over big hair, and the small folk
  for (const hair of ['afro', 'curly', 'bun', 'long']) for (const hat of ['cap', 'beanie', 'tophat', 'hood']) check(makeHuman({...base, hair, hat}), `${hair} + ${hat}`);
  for (const kind of ['gnome', 'kobold']) check(makeModel({...base, kind, facialHair: 'full', extras: ['pointyEars']}), kind);
});

test('every gesture and every mood keeps the pose finite', () => {
  const m = makeHuman({...CAST_DEFS.joop.model, npc: true});
  for (const g of GESTURES) {
    assert.ok(m.gesture(g) > 0, `${g} has a duration`);
    for (let i = 0; i < 100; i++) m.animate(1 / 30, {t: i / 30});
    posesFinite(m, g);
  }
  for (const mood of LOOK_ENUMS.mood) { for (let i = 0; i < 20; i++) m.animate(1 / 30, {t: i / 30, mood: mood.id, talk: i % 2 === 0}); posesFinite(m, mood.id); }
  // the hero holds the lantern out and swings tools
  const hero = makeHuman(DEFAULT_LOOK);
  for (let i = 0; i < 60; i++) hero.animate(1 / 30, {t: i / 30, walk: 0.5, armL: -0.5, attack: (i % 10) / 10});
  posesFinite(hero, 'hero');
});

test('people who look the same share their geometry; random looks build', () => {
  const a = makeHuman(CAST_DEFS.ilse.model), b = makeHuman(CAST_DEFS.ilse.model), c = makeHuman(CAST_DEFS.bakker.model);
  assert.equal(a.parts.torsoMesh.geometry, b.parts.torsoMesh.geometry);
  assert.notEqual(a.parts.torsoMesh.geometry, c.parts.torsoMesh.geometry);
  const rng = makeRng(3);
  for (let i = 0; i < 40; i++) check(makeHuman(randomLook(rng)), `random ${i}`);
  for (const side of [1, -1]) assert.ok(viewArmGeometry(DEFAULT_LOOK, side).attributes.position.count > 0);
});
