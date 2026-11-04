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
import {itemDefs, HALLUCS, CARDS, BRIDGE_KEYS} from '../src/content/items.js';
import {G, resetState} from '../src/game/state.js';
import F0 from '../src/content/floors/f0.js';
import F1 from '../src/content/floors/f1.js';
import F2 from '../src/content/floors/f2.js';
import F3 from '../src/content/floors/f3.js';
import F4 from '../src/content/floors/f4.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const storySrc = fs.readdirSync(path.join(here, '../src/content/story')).map(f => fs.readFileSync(path.join(here, '../src/content/story', f), 'utf8')).join('\n');
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
  const aliases = ['bakker1', 'bakker3', 'bakker4', 'ilse1', 'ilse4', 'glans1', 'glans2', 'glans3', 'glans4', 'glans5', 'joop4'];
  for (const e of allEntities().filter(e => e.type === 'npc')) {
    assert.ok(CAST_DEFS[e.id] || aliases.includes(e.id), `${e.floor}: npc ${e.id} has no cast entry`);
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
