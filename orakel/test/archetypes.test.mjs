// The archetypes of the character creator: complete cards, passives that really change the
// modifiers, the Handhaver's start bonus, clean heroes and presets inside the look schema.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCHETYPES, ARCHETYPE_IDS, archetypeById, applyStart, makeHero, HERO_PRESETS, NAME_MAX} from '../src/content/archetypes.js';
import {G, resetState} from '../src/game/state.js';
import {FACTORS, ADDS, mod, invalidateMods} from '../src/game/mods.js';
import {normalizeLook, LOOK_ENUMS} from '../src/content/looks.js';

const texts = a => [a.name, a.short, a.role, a.tagline, a.text, a.weakness, ...a.passives, a.ability.name, a.ability.short, a.ability.text, ...a.ability.quips];
const withHero = (archetype, fn) => { resetState(); G.hero = makeHero({archetype}); invalidateMods(); try { fn(); } finally { resetState(); invalidateMods(); } };

test('four archetypes with the fixed ids and complete, Dutch cards', () => {
  assert.deepEqual(ARCHETYPES.map(a => a.id), ARCHETYPE_IDS);
  assert.deepEqual(ARCHETYPE_IDS, ['handhaver', 'datatovenaar', 'archivaris', 'verbinder']);
  const roles = new Set();
  for (const a of ARCHETYPES) {
    for (const t of texts(a)) { assert.ok(typeof t === 'string' && t.trim(), `${a.id}: empty text`); assert.ok(!t.includes('\u2014'), `${a.id}: em dash in "${t}"`); }
    assert.ok(a.icon && /^#[0-9a-f]{6}$/i.test(a.css) && Number.isInteger(a.color), `${a.id}: icon or colour`);
    assert.ok(a.passives.length >= 2, `${a.id}: passives`);
    assert.ok(a.ability.cd >= 8 && a.ability.cd <= 25, `${a.id}: cooldown ${a.ability.cd}`);
    assert.ok(a.ability.short.length <= 12, `${a.id}: the slot name is too long for the HUD`);
    assert.ok(a.ability.quips.length >= 2, `${a.id}: quips`);
    roles.add(a.role);
    assert.equal(archetypeById(a.id), a);
  }
  assert.equal(roles.size, 4, 'every archetype has its own classic role');
  assert.equal(archetypeById('nope'), null);
});

test('passives only use known modifiers', () => {
  for (const a of ARCHETYPES) for (const [k, v] of Object.entries(a.mods)) {
    assert.ok(k in FACTORS || k in ADDS, `${a.id}: unknown modifier ${k}`);
    assert.ok(Number.isFinite(v), `${a.id}: ${k}`);
  }
});

test('passives change the modifiers for that archetype only', () => {
  withHero(null, () => { for (const k of ['sealDmg', 'lampDmg', 'speed', 'healMult', 'damageTaken']) assert.equal(mod(k), 1, k); assert.equal(mod('regen'), 0); assert.equal(mod('secretSense'), 0); });
  withHero('handhaver', () => { assert.equal(mod('sealDmg'), 1.25); assert.equal(mod('damageTaken'), 0.85); assert.equal(mod('lampDmg'), 1); });
  withHero('datatovenaar', () => { assert.equal(mod('lampDmg'), 1.3); assert.ok(mod('lampCd') < 1); assert.ok(mod('revealRadius') > 1); assert.equal(mod('sealDmg'), 1); });
  withHero('archivaris', () => { assert.ok(Math.abs(mod('speed') - 1.1) < 1e-9); assert.ok(mod('dashCd') < 1); assert.ok(mod('secretSense') > 0); assert.ok(mod('lootLuck') > 0); });
  withHero('verbinder', () => { assert.equal(mod('scaleDmg'), 1.25); assert.equal(mod('healMult'), 1.5); assert.ok(mod('regen') > 0); });
});

test('the Handhaver starts with 30 more trust, the others with the usual 100', () => {
  for (const a of ARCHETYPES) {
    resetState(); G.hero = makeHero({archetype: a.id}); applyStart(G);
    assert.equal(G.maxHp, a.id === 'handhaver' ? 130 : 100, a.id);
    assert.equal(G.hp, G.maxHp, a.id);
  }
  resetState(); applyStart(G); assert.equal(G.maxHp, 100, 'no hero: no bonus');
  resetState(); invalidateMods();
});

test('makeHero cleans up whatever it gets', () => {
  const h = makeHero({name: '   Sam   van   Dalen  ', pronouns: 'xe', address: 'jonkheer', archetype: 'piraat', look: {hair: 'afro', top: 'nonsense'}});
  assert.equal(h.name, 'Sam van Dalen');
  assert.equal(h.pronouns, 'die'); assert.equal(h.address, 'neutraal'); assert.equal(h.archetype, null);
  assert.equal(h.look.hair, 'afro'); assert.ok(LOOK_ENUMS.top.some(o => o.id === h.look.top));
  assert.equal(makeHero({name: 'x'.repeat(80)}).name.length, NAME_MAX);
  const v = makeHero({archetype: 'verbinder', pronouns: 'zij', address: 'mevrouw'});
  assert.deepEqual([v.archetype, v.pronouns, v.address], ['verbinder', 'zij', 'mevrouw']);
  assert.deepEqual(makeHero(v), v, 'a hero survives a second pass unchanged');
});

test('presets stay inside the look schema', () => {
  const ids = new Set();
  for (const p of HERO_PRESETS) {
    assert.ok(p.id && p.name && !ids.has(p.id), `preset ${p.id}`); ids.add(p.id);
    const L = normalizeLook(p.look);
    for (const [k, v] of Object.entries(p.look)) {
      if (k === 'extras') assert.deepEqual(L.extras, [...v].sort(), `${p.id}: extras`);
      else assert.equal(L[k], v, `${p.id}: ${k} = ${v} is not kept by normalizeLook`);
    }
  }
  assert.ok(HERO_PRESETS.length >= 4);
});
