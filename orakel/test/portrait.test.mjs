// Portrait tests: the pure renderer (src/ui/portrait.js renderPortrait) runs without a DOM, so we can
// check that every character and mood draws, that every look field shows, and what a portrait costs.
// Run with: node --test orakel/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST, UI} from '../src/game/bus.js';
import {G} from '../src/game/state.js';
import {DEFAULT_LOOK} from '../src/game/hero.js';
import {renderPortrait, resolveSubject, normLook, hasPortrait, MOODS, PORTRAIT_SIZE} from '../src/ui/portrait.js';
import {SAMPLES, ALIASES, LOOK_GRID} from './e2e/portraits.mjs';

Object.assign(CAST, SAMPLES);
for (const [k, v] of Object.entries(ALIASES)) CAST[k] = CAST[v];

const hash = img => { let h = 2166136261; for (let i = 0; i < img.data.length; i++) h = Math.imul(h ^ img.data[i], 16777619); return h >>> 0; };
const px = (img, x, y) => { const j = (y * img.width + x) * 4; return [...img.data.slice(j, j + 4)]; };

test('every character of the bible draws in every mood', () => {
  for (const id of Object.keys(SAMPLES)) for (const mood of MOODS) {
    const img = renderPortrait(id, {mood});
    assert.equal(img.width, PORTRAIT_SIZE); assert.equal(img.height, PORTRAIT_SIZE);
    assert.equal(img.data.length, PORTRAIT_SIZE * PORTRAIT_SIZE * 4);
    assert.equal(px(img, 48, 48)[3], 255, `${id} ${mood}: the panel is opaque`);
  }
});

test('the ten moods look different, for people and for the folk', () => {
  for (const id of ['joop', 'glans', 'ilse', 'you', 'pip', 'vonk', 'wolk', 'otto', 'slotje', 'orakel', 'fabulant', 'noor', 'bram']) {
    const seen = new Set(MOODS.map(mood => hash(renderPortrait(id, {mood}))));
    assert.equal(seen.size, MOODS.length, `${id}: some moods look the same`);
  }
});

test('talking and blinking frames differ from the resting face', () => {
  for (const id of ['joop', 'ilse', 'you', 'pip', 'orakel', 'otto', 'fabulant']) {
    const rest = hash(renderPortrait(id));
    for (const o of [{mouth: 0.5}, {mouth: 1}, {blink: 0.5}, {blink: 1}]) assert.notEqual(hash(renderPortrait(id, o)), rest, `${id} ${JSON.stringify(o)}`);
  }
});

test('every field of the look schema shows in the portrait', () => {
  const base = {...DEFAULT_LOOK, lanyard: false, top: 'jumper', hair: 'short'};
  const ref = hash(renderPortrait(base));
  const variants = [
    {build: 'slim'}, {build: 'broad'}, {build: 'round'}, {height: 0.88}, {skin: 0x6b3e22}, {age: 'young'}, {age: 'old'}, {eyes: 0x3a8a5a},
    {brows: 'thin'}, {brows: 'thick'}, {brows: 'bushy'}, {nose: 'small'}, {nose: 'big'}, {nose: 'long'}, {freckles: true}, {blush: true},
    ...['stubble', 'moustache', 'walrus', 'goatee', 'beard', 'full'].map(facialHair => ({facialHair})), {facialHair: 'beard', facialHairColor: 0xd04a2a},
    ...['round', 'square', 'half', 'shades'].map(glasses => ({glasses})), {glasses: 'round', glassesColor: 0xc8202a},
    ...['bald', 'buzz', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf'].map(hair => ({hair})), {hairColor: 0xd8b060},
    {hair: 'headscarf', scarfColor: 0x2a6a8a},
    ...['cap', 'beret', 'beanie', 'tophat', 'hood', 'quill', 'hardhat'].map(hat => ({hat})), {hat: 'cap', hatColor: 0xc04030},
    ...['blazer', 'cardigan', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'robe', 'apron', 'hawaii', 'hivis'].map(top => ({top})), {topColor: 0x7a2a3a}, {top: 'cardigan', top2: 0x3a6a9a},
    {top: 'blazer', tie: 0xc0302a}, {lanyard: true}, {scarf: 0xc8402a}, {earrings: true}, {headset: true}, {patches: true},
    ...['mug', 'book', 'clipboard', 'folder', 'ruler', 'horn', 'leash', 'stamp', 'keys'].map(holdR => ({holdR})),
  ];
  for (const v of variants) assert.notEqual(hash(renderPortrait({...base, ...v})), ref, `no visible change for ${JSON.stringify(v)}`);
  // the collar and colour of each top style: all twelve differ from each other
  const tops = new Set(['blazer', 'cardigan', 'jumper', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'robe', 'apron', 'hawaii', 'hivis'].map(top => hash(renderPortrait({...base, top}))));
  assert.equal(tops.size, 12);
  // and so do all fourteen hair styles
  const hairs = new Set(['bald', 'buzz', 'short', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf'].map(hair => hash(renderPortrait({...base, hair}))));
  assert.equal(hairs.size, 14);
});

test('old cast specs are normalised to the look schema', () => {
  const L = normLook({coat: 0x5a5a62, pants: 0x2a2a30, hairStyle: 'bob', hair: 0x7a7a7a, beard: 0x9a9a9a, glasses: true, scale: 0.92, shirt: 0xe8e4dc, tie: 0x8a2a2a});
  assert.equal(L.topColor, 0x5a5a62); assert.equal(L.bottomColor, 0x2a2a30); assert.equal(L.hair, 'bob'); assert.equal(L.hairColor, 0x7a7a7a);
  assert.equal(L.facialHair, 'beard'); assert.equal(L.facialHairColor, 0x9a9a9a); assert.equal(L.glasses, 'round'); assert.equal(L.height, 0.92);
  assert.equal(L.top, 'blazer'); assert.equal(L.top2, 0xe8e4dc); assert.equal(L.lanyard, false);
  const robe = normLook({robe: 0x2a2440, coat: 0x3a3450, hat: 'quill'});
  assert.equal(robe.top, 'robe'); assert.equal(robe.topColor, 0x2a2440); assert.equal(robe.top2, 0x3a3450); assert.equal(robe.hat, 'quill');
  // missing or broken fields fall back to the defaults, colours may be css strings
  const odd = normLook({hair: 'mohawk', build: 'huge', skin: '#8a5430', top: 'cape'});
  assert.equal(odd.hair, 'short'); assert.equal(odd.build, DEFAULT_LOOK.build); assert.equal(odd.skin, 0x8a5430); assert.equal(odd.top, DEFAULT_LOOK.top);
  // the real (old style) cast still draws
  for (const spec of [{coat: 0x3a3a48, pants: 0x2a2a30, hair: 0x7a7a7a, tie: 0x8a2a2a, shirt: 0xe8e4dc, glasses: true}, {kind: 'gnome', coat: 0x3a6a4a, hat: 'beret', hatColor: 0xc04030, beard: 0xf0f0f0, hair: 0xf0f0f0, scale: 0.7}, {kind: 'kobold', coat: 0x7a8a3a, skin: 0x8ab060, hair: 0x3a4a1a, hat: 'cap', hatColor: 0x2a4a8a, scale: 0.7}]) assert.ok(hash(renderPortrait(spec)));
});

test('subjects: aliases follow the cast, the hero follows G.hero, unknowns fall back', () => {
  assert.equal(resolveSubject('glans3').key, resolveSubject('glans').key);
  assert.equal(resolveSubject('bakker4').id, 'bakker');
  assert.equal(hash(renderPortrait('joop4')), hash(renderPortrait('joop')));
  const before = resolveSubject('you').key;
  G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: 'archivaris', look: {...DEFAULT_LOOK, hair: 'afro', hairColor: 0x2a1a10}};
  assert.notEqual(resolveSubject('you').key, before);
  assert.equal(resolveSubject('you').look.hair, 'afro');
  G.hero = null;
  for (const s of ['niemand', {kind: 'draak'}, {kind: 'spark'}, {kind: 'owl'}, {}, null, 'orakel', 'fabulant']) assert.ok(hash(renderPortrait(s)), `fallback for ${JSON.stringify(s)}`);
  assert.equal(hasPortrait('nar'), false); assert.equal(hasPortrait(''), false); assert.equal(hasPortrait('joop'), true); assert.equal(hasPortrait('you'), true); assert.equal(hasPortrait('niemand'), false);
  assert.equal(typeof UI.portraitURL, 'function');
});

test('options: deterministic, flip mirrors, frame false is transparent', () => {
  assert.equal(hash(renderPortrait('ilse', {mood: 'happy'})), hash(renderPortrait('ilse', {mood: 'happy'})));
  const a = renderPortrait('you'), b = renderPortrait('you', {flip: true});
  for (const [x, y] of [[20, 30], [40, 50], [60, 70], [47, 47], [10, 85]]) assert.deepEqual(px(b, 95 - x, y), px(a, x, y));
  const t = renderPortrait('you', {frame: false});
  assert.equal(px(t, 1, 1)[3], 0); assert.equal(px(t, 4, 50)[3], 0); assert.equal(px(t, 48, 48)[3], 255);
});

test('a portrait is cheap to draw', () => {
  for (const L of LOOK_GRID) renderPortrait(L);                       // warm up
  const t0 = performance.now(); let n = 0;
  for (const id of Object.keys(SAMPLES)) for (const mood of ['neutral', 'happy', 'angry']) { renderPortrait(id, {mood}); n++; }
  const ms = (performance.now() - t0) / n;
  assert.ok(ms < 12, `${ms.toFixed(2)} ms per portrait`);
});
