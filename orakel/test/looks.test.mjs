// The look schema: every option is valid, old cast specs still work, every person in the cast
// has a complete look, and random looks stay inside the schema.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLook, LOOK_OPTIONS, LOOK_ENUMS, BASE_LOOK, EXTRAS, randomLook, lookKey, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, toHex} from '../src/content/looks.js';
import {CAST_DEFS} from '../src/content/cast.js';
import {DEFAULT_LOOK} from '../src/game/hero.js';
import {makeRng} from '../src/core/util.js';

const isHex = v => Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const enumKeys = ['build', 'age', 'brows', 'nose', 'facialHair', 'glasses', 'hair', 'hat', 'top', 'bottom', 'pattern', 'mood'];
function assertComplete(L, who) {
  for (const k of Object.keys(BASE_LOOK)) assert.ok(k in L, `${who}: missing ${k}`);
  for (const k of enumKeys) assert.ok(LOOK_ENUMS[k].some(o => o.id === L[k]), `${who}: ${k} = ${L[k]} is not an option`);
  for (const k of ['skin', 'eyes', 'hairColor', 'topColor', 'top2', 'bottomColor', 'shoes']) assert.ok(isHex(L[k]), `${who}: ${k} is not a colour`);
  assert.ok(L.height >= 0.5 && L.height <= 1.5, `${who}: height ${L.height}`);
  for (const e of L.extras) assert.ok(e in EXTRAS, `${who}: unknown extra ${e}`);
}

test('LOOK_OPTIONS: every field has a Dutch label and valid options or palette', () => {
  const keys = new Set();
  for (const o of LOOK_OPTIONS) {
    assert.ok(o.key && o.label && o.group && o.type, `incomplete option ${JSON.stringify(o)}`);
    assert.ok(!keys.has(o.key), `duplicate option ${o.key}`); keys.add(o.key);
    assert.ok(o.key in BASE_LOOK, `${o.key} is not part of the look`);
    if (o.type === 'choice') { assert.ok(o.options.length >= 2); for (const c of o.options) assert.ok(c.id && c.label, `${o.key}: option without a label`); }
    if (o.type === 'color') { assert.ok(o.palette.length >= 3); for (const c of o.palette) assert.ok(isHex(c.hex) && c.name, `${o.key}: bad colour`); }
    if (o.type === 'range') assert.ok(o.min < 1 && o.max > 1 && o.step > 0);
  }
  for (const k of ['build', 'height', 'skin', 'age', 'hair', 'hairColor', 'facialHair', 'glasses', 'top', 'topColor', 'bottom', 'shoes']) assert.ok(keys.has(k), `the creator needs ${k}`);
  assert.ok(SKIN_TONES.length >= 10 && HAIR_COLORS.length >= 12 && CLOTH_COLORS.length >= 20);
});

test('normalizeLook: the hero default and an empty spec are complete', () => {
  assertComplete(normalizeLook({}), 'empty');
  assertComplete(normalizeLook(DEFAULT_LOOK), 'DEFAULT_LOOK');
  assertComplete(normalizeLook(null), 'null');
});

test('normalizeLook: old spec keys keep working', () => {
  const L = normalizeLook({coat: 0x3a5a3a, pants: 0x5a4a3a, hair: 0xb0b0b0, hairStyle: 'bob', beard: 0x4a3a2a, glasses: true, badge: true, smile: true, scale: 0.92});
  assert.equal(L.topColor, 0x3a5a3a); assert.equal(L.bottomColor, 0x5a4a3a); assert.equal(L.hairColor, 0xb0b0b0); assert.equal(L.hair, 'bob');
  assert.equal(L.facialHair, 'beard'); assert.equal(L.facialHairColor, 0x4a3a2a); assert.equal(L.glasses, 'square'); assert.equal(L.lanyard, true);
  assert.equal(L.mood, 'happy'); assert.equal(L.height, 0.92);
  const robe = normalizeLook({robe: 0x2a2440, coat: 0x3a3450});
  assert.equal(robe.top, 'robe'); assert.equal(robe.topColor, 0x2a2440); assert.equal(robe.top2, 0x3a3450);
});

test('normalizeLook: bad values fall back instead of breaking a model', () => {
  const L = normalizeLook({build: 'huge', hair: 'mohawk', top: 'spacesuit', skin: 'pink', height: 9, holdR: 'chainsaw', extras: ['keyring', 'laser'], glasses: 'monocle', topColor: '#ff8800'});
  assertComplete(L, 'bad');
  assert.equal(L.build, BASE_LOOK.build); assert.equal(L.hair, BASE_LOOK.hair); assert.equal(L.top, BASE_LOOK.top); assert.equal(L.skin, BASE_LOOK.skin);
  assert.equal(L.height, 1.5); assert.equal(L.holdR, null); assert.deepEqual(L.extras, ['keyring']); assert.equal(L.glasses, 'none'); assert.equal(L.topColor, 0xff8800);
  assert.equal(toHex('#00ff00'), 0x00ff00); assert.equal(toHex('nope', 7), 7);
});

test('every person in the cast has a complete, valid look', () => {
  for (const [id, c] of Object.entries(CAST_DEFS)) {
    if (!c.model || (c.model.kind && !['gnome', 'kobold'].includes(c.model.kind))) continue;
    const L = normalizeLook(c.model);
    assertComplete(L, id);
    for (const k of ['build', 'hair', 'top']) assert.ok(c.model[k], `${id}: the bible look should set ${k} itself`);
  }
  // Dalwijk is a mixed town: light and dark skin, several builds and ages
  const people = Object.values(CAST_DEFS).filter(c => c.model && !c.model.kind).map(c => normalizeLook(c.model));
  const lum = h => (0.299 * (h >> 16 & 255) + 0.587 * (h >> 8 & 255) + 0.114 * (h & 255)) / 255;
  assert.ok(people.filter(l => lum(l.skin) < 0.5).length >= 5, 'at least five people with brown or darker skin');
  assert.ok(people.some(l => lum(l.skin) < 0.3), 'and someone with dark skin');
  assert.ok(new Set(people.map(l => l.build)).size === 4, 'all four builds appear');
  assert.ok(people.filter(l => l.age === 'old').length >= 3 && people.some(l => l.age === 'young'));
  // Joop is unforgettable: walrus moustache, cap, cardigan with elbow patches, keys
  const joop = normalizeLook(CAST_DEFS.joop.model);
  assert.equal(joop.facialHair, 'walrus'); assert.equal(joop.hat, 'cap'); assert.equal(joop.top, 'cardigan'); assert.ok(joop.patches);
  assert.ok(joop.extras.includes('keyring')); assert.equal(joop.idle, 'keys');
});

test('randomLook stays inside the schema, and lookKey is stable', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 200; i++) assertComplete(randomLook(rng), `random ${i}`);
  const a = normalizeLook({hair: 'afro', skin: 0x613a22}), b = normalizeLook({skin: 0x613a22, hair: 'afro'});
  assert.equal(lookKey(a), lookKey(b));
  assert.notEqual(lookKey(a), lookKey(normalizeLook({hair: 'bun', skin: 0x613a22})));
});
