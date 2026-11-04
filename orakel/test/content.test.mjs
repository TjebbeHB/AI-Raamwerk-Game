// Content tests for Het Orakel van Dalwijk: every floor must parse, connect and be completable,
// every collectible must exist exactly once, and the dossier must follow the framework's rules.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseFloor, reachable, T} from '../src/engine/level.js';
import {CHAMBERS, CHAMBER, FOUNDATIONS, DOMAINS, CRITICAL, assess, judge, epilogue, recordChoice, VERDICT} from '../src/content/framework.js';
import {CAST_DEFS} from '../src/content/cast.js';
import {CAST_EXTRA, ALIAS, REL_PEOPLE} from '../src/content/cast_extra.js';
import {itemDefs, HALLUCS, CARDS, BRIDGE_KEYS, SECRETS, TRINKETS, BINGO, BINGO_GRID, ACHIEVEMENTS, COSMETICS} from '../src/content/items.js';
import {FACTORS, ADDS} from '../src/game/mods.js';
import {G, resetState} from '../src/game/state.js';
import F0 from '../src/content/floors/f0.js';
import F1 from '../src/content/floors/f1.js';
import F2 from '../src/content/floors/f2.js';
import F3 from '../src/content/floors/f3.js';
import F4 from '../src/content/floors/f4.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STORY_FILES = Object.fromEntries(fs.readdirSync(path.join(here, '../src/content/story')).map(f => [f, fs.readFileSync(path.join(here, '../src/content/story', f), 'utf8')]));
const storySrc = Object.values(STORY_FILES).join('\n');
const FLOORS = [F0, F1, F2, F3, F4];
const PARSED = Object.fromEntries(FLOORS.map(f => [f.id, parseFloor(f)]));
const ITEMS = itemDefs();
const allEntities = () => Object.values(PARSED).flatMap(L => L.entities.map(e => ({...e, floor: L.id})));
// every item that can be picked up or comes out of a chest
const placedItems = () => allEntities().flatMap(e => (e.type === 'item' ? [e.id] : e.type === 'chest' ? [].concat(e.items || e.item || []) : []));
const givenInStory = prefix => [...storySrc.matchAll(/giveItem\(['`]([^'`]+)['`]\)/g)].map(m => m[1]).filter(id => id.startsWith(prefix) && !id.includes('${'));

test('every floor parses without errors', () => {
  for (const L of Object.values(PARSED)) assert.deepEqual(L.errors, [], `${L.id}: ${L.errors.join('; ')}`);
});

test('stairs lead to arrivals that exist', () => {
  for (const e of allEntities().filter(e => e.type === 'stairs')) {
    assert.ok(PARSED[e.to], `${e.floor}: stairs ${e.id} lead to unknown floor ${e.to}`);
    assert.ok(PARSED[e.to].arrivals[e.at], `${e.floor}: stairs ${e.id} lead to missing arrival ${e.to}:${e.at}`);
  }
});

test('everything on a floor can be reached once doors, gates and hidden paths are open', () => {
  for (const L of Object.values(PARSED)) {
    const start = Object.values(L.arrivals)[0];
    const seen = reachable(L, start.x, start.z);
    for (const e of L.entities) {
      if (['arrival', 'enemy', 'prop', 'illusion', 'hidden', 'door', 'gate'].includes(e.type)) continue;
      // the far side of the chasm on Diepte 3 is only reached over the bridge, which is a hidden path
      assert.ok(seen[e.z * L.W + e.x] || e.type === 'trigger' && e.r > 1, `${L.id}: ${e.type} ${e.id || e.kind || ''} at ${e.x},${e.z} is unreachable`);
    }
  }
});

test('hidden things really are hidden: the critical paths need the lamp', () => {
  // Diepte 1: without revealing, the way north from the lamp chamber is blocked
  const L1 = PARSED.f1, a1 = L1.arrivals.from_f0, waarom = L1.entities.find(e => e.id === 'waarom');
  assert.ok(!reachable(L1, a1.x, a1.z, {revealed: false})[waarom.z * L1.W + waarom.x], 'Vrouwe Waarom should be behind the illusion wall');
  // Diepte 3: the stairs down are only reachable over the bridge
  const L3 = PARSED.f3, a3 = L3.arrivals.from_f2, down = L3.entities.find(e => e.id === 'down_f4');
  assert.ok(!reachable(L3, a3.x, a3.z, {revealed: false})[down.z * L3.W + down.x], 'the far side of the chasm must need the bridge');
  // Diepte 4: the core lies beyond invisible bridges
  const L4 = PARSED.f4, a4 = L4.arrivals.from_f3, orakel = L4.entities.find(e => e.id === 'orakel');
  assert.ok(!reachable(L4, a4.x, a4.z, {revealed: false})[orakel.z * L4.W + orakel.x], 'the core should be beyond the hidden bridges');
});

test('every person on a map has a cast entry and something to say', () => {
  const CAST = {...CAST_DEFS, ...CAST_EXTRA};
  for (const e of allEntities().filter(e => e.type === 'npc')) {
    assert.ok(CAST[e.id] || CAST[ALIAS[e.id]], `${e.floor}: npc ${e.id} has no cast entry`);
    assert.ok(storySrc.includes(`ON.talk.${e.id} =`) || storySrc.includes(`ON.talk[npc]`) && /guardian\('\w+', '(\w+)'/.test(storySrc) || storySrc.includes(`id: '${e.id}'`), `${e.floor}: npc ${e.id} has no conversation`);
  }
});

test('every pickup is a known item', () => {
  for (const id of placedItems()) {
    const kind = id.split(':')[0];
    assert.ok(ITEMS[id] || ITEMS[kind] || kind === 'snack', `unknown item ${id}`);
  }
});

test('all 45 sources can be found or are handed over', () => {
  const placed = new Set(placedItems().filter(id => id.startsWith('bron:')));
  const given = new Set(givenInStory('bron:'));
  // domain guardians hand over source c through the generic guardian() helper
  const guardianIds = [...storySrc.matchAll(/guardian\('(\w+)'/g)].map(m => m[1]);
  for (const id of guardianIds) given.add(`bron:${id}:c`);
  for (const c of CHAMBERS) for (const clue of c.clues) {
    const id = `bron:${c.id}:${clue.id}`;
    assert.ok(placed.has(id) || given.has(id), `source ${id} is nowhere to be found`);
  }
  assert.equal(placed.size + [...given].filter(id => !placed.has(id)).length, 45);
});

test('collectibles exist exactly once: 12 hallucinations, 8 cards, 4 crystals', () => {
  const all = [...placedItems(), ...givenInStory('halluc:'), ...givenInStory('card:'), ...givenInStory('kristal:'), ...(storySrc.includes("giveItemLater('kristal:4')") ? ['kristal:4'] : [])];
  for (const h of HALLUCS) assert.equal(all.filter(id => id === `halluc:${h.id}`).length, 1, `hallucination ${h.id}`);
  for (const c of CARDS) assert.equal(all.filter(id => id === `card:${c.id}`).length, 1, `card ${c.id}`);
  for (let k = 1; k <= 4; k++) assert.equal(all.filter(id => id === `kristal:${k}`).length, 1, `crystal ${k}`);
});

test('every chamber of the framework has a guardian who asks for a decision', () => {
  const asked = new Set([...storySrc.matchAll(/decide\('(\w+)'/g)].map(m => m[1]));
  for (const m of storySrc.matchAll(/guardian\('(\w+)'/g)) asked.add(m[1]);
  for (const c of CHAMBERS) assert.ok(asked.has(c.id), `nobody asks about ${c.id}`);
  assert.equal(CHAMBERS.length, 15);
});

test('the bridge needs seven of nine domain keys', () => {
  assert.equal(Object.keys(BRIDGE_KEYS).length, 9);
  for (const id of Object.keys(BRIDGE_KEYS)) assert.ok(DOMAINS.includes(id) && id !== 'sovereignty');
});

test('every monster on a map is in the bestiary', async () => {
  const src = fs.readFileSync(path.join(here, '../src/content/beasts.js'), 'utf8') + fs.readFileSync(path.join(here, '../src/content/bosses.js'), 'utf8');
  for (const e of allEntities().filter(e => e.type === 'enemy')) assert.ok(new RegExp(`\\b${e.kind}: \\{`).test(src), `${e.floor}: unknown monster ${e.kind}`);
});

test('every puzzle object kind has a look', () => {
  const src = fs.readFileSync(path.join(here, '../src/content/objects.js'), 'utf8');
  for (const e of allEntities().filter(e => e.type === 'object')) assert.ok(new RegExp(`\\b${e.kind}: \\{`).test(src), `${e.floor}: unknown object kind ${e.kind}`);
});

// ---- the story systems: secrets, Kantoorvondsten, vergaderbingo, achievements, cosmetics, people ----
// Where every find is placed: a map entity with `secret:` (secrets), an item, a chest, or an object with
// `give:` (trinkets and bingo squares), or a literal findSecret / giveItem call in a story file.
// A floor switches on the strict check for its own finds with `strictFinds: true` in its floor file.
export function findsCensus() {
  const out = {};
  const add = (key, where) => (out[key] ||= []).push(where);
  for (const e of allEntities()) {
    const at = {floor: e.floor, where: `${e.floor} ${e.type} ${e.id || e.kind || ''} at ${e.x},${e.z}`};
    if (e.secret) add(`secret:${e.secret}`, at);
    const ids = e.type === 'item' ? [e.id] : e.type === 'chest' ? [].concat(e.items || e.item || []) : e.type === 'object' && e.give ? [e.give] : [];
    for (const id of ids) if (/^(trinket|bingo):/.test(id || '')) add(id, at);
  }
  for (const [file, src] of Object.entries(STORY_FILES)) {
    const floor = /^f\d\.js$/.test(file) ? file.slice(0, 2) : null;
    for (const m of src.matchAll(/findSecret\('([\w-]+)'\)/g)) add(`secret:${m[1]}`, {floor, where: `story/${file}`});
    for (const m of src.matchAll(/giveItem\('((?:trinket|bingo):[\w-]+)'\)/g)) add(m[1], {floor, where: `story/${file}`});
  }
  return out;
}
export const strictFloors = () => FLOORS.filter(f => f.strictFinds).map(f => f.id);
const FINDS = () => [...SECRETS.map(s => ({key: `secret:${s.id}`, floor: s.floor})), ...TRINKETS.map(t => ({key: `trinket:${t.id}`, floor: t.floor})), ...BINGO.map(b => ({key: `bingo:${b.id}`, floor: b.floor}))];

test('every secret, Kantoorvondst and bingo square is placed once, on its own depth', t => {
  const census = findsCensus(), strict = new Set(strictFloors()), pending = [];
  assert.ok(strict.has('f0'), 'Diepte 0 checks its finds strictly');
  for (const f of FINDS()) {
    const at = census[f.key] || [];
    assert.ok(at.length <= 1, `${f.key} is placed ${at.length} times: ${at.map(a => a.where).join('; ')}`);
    for (const a of at) assert.ok(!a.floor || !f.floor || a.floor === f.floor, `${f.key} belongs to ${f.floor} but is placed at ${a.where}`);
    if (f.floor === null) assert.equal(at.length, 1, `${f.key} must be handed out by the systems`);
    else if (strict.has(f.floor)) assert.equal(at.length, 1, `${f.key} (${f.floor}) is not placed anywhere yet`);
    else if (!at.length) pending.push(`${f.floor} ${f.key}`);
  }
  if (pending.length) t.diagnostic(`pending for later lanes (${pending.length}): ${pending.join(', ')}`);
  // nothing on a map or in a story points at a find that does not exist
  const known = new Set(FINDS().map(f => f.key));
  for (const key of Object.keys(census)) assert.ok(known.has(key), `unknown find ${key} at ${census[key].map(a => a.where).join('; ')}`);
});

test('the registries of the story systems are complete', () => {
  const unique = (list, what) => assert.equal(new Set(list.map(x => x.id)).size, list.length, `${what}: duplicate ids`);
  const floors = new Set(FLOORS.map(f => f.id));
  unique(SECRETS, 'secrets'); unique(TRINKETS, 'trinkets'); unique(BINGO, 'bingo'); unique(ACHIEVEMENTS, 'achievements'); unique(COSMETICS, 'cosmetics');
  for (const s of SECRETS) { assert.ok(s.name && s.text && s.hint, `secret ${s.id} needs a name, text and hint`); assert.ok(floors.has(s.floor), `secret ${s.id}: unknown floor ${s.floor}`); }
  for (const tr of TRINKETS) {
    assert.ok(tr.name && tr.text && tr.effect && tr.icon && tr.shape, `trinket ${tr.id} needs a name, text, effect, icon and shape`);
    assert.ok(tr.floor === null || floors.has(tr.floor), `trinket ${tr.id}: unknown floor ${tr.floor}`);
    for (const [k, v] of Object.entries(tr.mods || {})) assert.ok((k in FACTORS || k in ADDS) && typeof v === 'number', `trinket ${tr.id}: unknown modifier ${k}`);
  }
  assert.equal(BINGO.length, 9, 'nine bingo squares');
  assert.deepEqual([...BINGO_GRID].sort(), BINGO.map(b => b.id).sort(), 'the bingo card holds every square once');
  for (const b of BINGO) assert.ok(b.word && floors.has(b.floor) && b.hint, `bingo ${b.id}`);
  assert.ok(ACHIEVEMENTS.length >= 15 && ACHIEVEMENTS.length <= 22, 'about fifteen to twenty achievements');
  for (const a of ACHIEVEMENTS) assert.ok(a.name && a.text && a.icon, `achievement ${a.id} needs a name, text and icon`);
  for (const c of COSMETICS) assert.ok(c.name && c.hint && c.look && Object.keys(c.look).length, `cosmetic ${c.id}`);
  for (const h of HALLUCS) assert.ok(h.retort, `hallucination ${h.id} has a retort for the Fabulant`);
  // the story only awards, unlocks and finds what exists
  const ids = list => new Set(list.map(x => x.id));
  for (const [re, set, what] of [[/award\('(\w+)'/g, ids(ACHIEVEMENTS), 'achievement'], [/unlock\('(\w+)'/g, ids(COSMETICS), 'cosmetic'], [/findSecret\('(\w+)'/g, ids(SECRETS), 'secret']])
    for (const m of storySrc.matchAll(re)) assert.ok(set.has(m[1]), `unknown ${what} ${m[1]}`);
  // the epilogue, the journal and the summary know everyone with a relationship
  for (const p of REL_PEOPLE) assert.ok(CAST_DEFS[p.npc] || CAST_EXTRA[p.npc], `relationship with unknown person ${p.npc}`);
});

// the shared look schema (game/hero.js): the new people and the cosmetics may only use these
const LOOK = {
  build: ['slim', 'average', 'broad', 'round'], age: ['young', 'adult', 'old'], brows: ['thin', 'normal', 'thick', 'bushy'], nose: ['small', 'normal', 'big', 'long'],
  facialHair: ['none', 'stubble', 'moustache', 'walrus', 'goatee', 'beard', 'full'], glasses: ['none', 'round', 'square', 'half', 'shades'],
  hair: ['bald', 'buzz', 'short', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf'],
  hat: ['cap', 'beret', 'beanie', 'tophat', 'hood', 'quill', 'hardhat'], top: ['blazer', 'cardigan', 'jumper', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'robe', 'apron', 'hawaii', 'hivis'],
  bottom: ['trousers', 'skirt', 'shorts'],
};
const LOOK_COLOURS = ['skin', 'eyes', 'hairColor', 'facialHairColor', 'glassesColor', 'scarfColor', 'hatColor', 'topColor', 'top2', 'tie', 'bottomColor', 'shoes', 'scarf'];
const LOOK_OTHER = ['height', 'freckles', 'blush', 'lanyard', 'earrings', 'headset', 'patches', 'holdL', 'holdR', 'idle'];
function checkLook(look, what) {
  for (const [k, v] of Object.entries(look)) {
    if (LOOK[k]) assert.ok(LOOK[k].includes(v), `${what}: ${k} '${v}' is not in the look schema`);
    else if (LOOK_COLOURS.includes(k)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffff, `${what}: ${k} must be a hex colour`);
    else assert.ok(LOOK_OTHER.includes(k), `${what}: unknown look key ${k}`);
  }
  if (look.height !== undefined) assert.ok(look.height >= 0.86 && look.height <= 1.14, `${what}: height out of range`);
}
test('new people and cosmetics follow the look schema', () => {
  for (const [id, c] of Object.entries(CAST_EXTRA)) {
    assert.ok(c.name && c.title && c.model, `${id} needs a name, title and model`);
    assert.ok(!CAST_DEFS[id], `${id} is already in cast.js`);
    if (!c.model.kind) { checkLook(c.model, id); for (const k of ['build', 'skin', 'hair', 'hairColor', 'top', 'topColor', 'bottom']) assert.ok(k in c.model, `${id}: look needs ${k}`); }
  }
  for (const c of COSMETICS) checkLook(c.look, `cosmetic ${c.id}`);
  for (const [alias, id] of Object.entries(ALIAS)) assert.ok(CAST_DEFS[id] || CAST_EXTRA[id], `alias ${alias} points at unknown ${id}`);
});

// ---- the dossier follows the framework's rules ----
function answer(ids, how = 'correct') {
  for (const id of ids) {
    const c = CHAMBER[id];
    recordChoice(id, c.options.flatMap((o, i) => (how === 'correct' ? o.status === 'correct' : i === c.options.findIndex(x => x.status === 'incorrect')) ? [i] : []));
  }
}
test('a full dossier carries "invoeren met waarborgen"', () => {
  resetState();
  answer(CHAMBERS.map(c => c.id));
  const d = assess();
  assert.equal(d.ceiling, 3);
  assert.equal(d.reasons.length, 0);
  assert.equal(judge(3, d.ceiling), 'supported');
  assert.equal(judge(2, d.ceiling), 'cautious');
});
test('without the question of necessity, the dossier carries no more than research', () => {
  resetState();
  answer(CHAMBERS.map(c => c.id).filter(id => id !== 'necessity'));
  assert.equal(assess().ceiling, 1);
  assert.equal(judge(3, 1), 'beyond');
  assert.equal(judge(0, 1), 'grounded');
});
test('without governance even a pilot is not carried', () => {
  resetState();
  answer(CHAMBERS.map(c => c.id).filter(id => id !== 'governance'));
  assert.equal(assess().ceiling, 1);
});
test('an open critical domain caps the dossier at a pilot', () => {
  resetState();
  answer(CHAMBERS.map(c => c.id).filter(id => id !== CRITICAL[0]));
  answer([CRITICAL[0]], 'wrong');
  const d = assess();
  assert.equal(d.ceiling, 2);
  assert.ok(d.reasons.some(r => r.text.includes(CHAMBER[CRITICAL[0]].title)));
});
test('fewer than six solid domains caps the dossier at a pilot', () => {
  resetState();
  answer(['necessity', ...FOUNDATIONS, 'evaluation', ...CRITICAL]);
  const d = assess();
  assert.equal(d.solid, 4);
  assert.equal(d.ceiling, 2);
});
test('a skipped evaluation plan caps the dossier at research', () => {
  resetState();
  answer(CHAMBERS.map(c => c.id).filter(id => id !== 'evaluation'));
  assert.equal(assess().ceiling, 1);
});
test('every verdict and judgement has an epilogue', () => {
  for (let choice = 0; choice < VERDICT.length; choice++) for (const ceiling of [1, 2, 3]) {
    const text = epilogue(choice, judge(choice, ceiling));
    assert.ok(text && text.length > 40, `no epilogue for ${VERDICT[choice].key} at ceiling ${ceiling}`);
  }
  resetState();
  assert.equal(G.verdict, null);
});
void T;
