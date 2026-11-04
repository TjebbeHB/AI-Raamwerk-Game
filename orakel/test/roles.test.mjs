// Roles for the online council: every chamber has a note for every role, roles are dealt so the
// first advisors all differ, votes are counted per role, and what a phone reads from the network
// is checked against the known roles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES, ROLE, ROLE_NOTES, roleById, roleNote, DEAL_TIERS, dealOrder, nextRole, dealAll, tallyBallots, readSeats, readByRole} from '../src/content/roles.js';
import {CHAMBERS, CHAMBER, VERDICT} from '../src/content/framework.js';

const KEYS = [...CHAMBERS.map(c => c.id), 'verdict'];
const DASHES = /[–—]/;
const sentences = s => (s.match(/[.?!…](?=\s|$)/g) || []).length;
// a seeded random for repeatable deals
const seeded = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

test('there are six to eight roles, each with a unique id, name, icon and colour', () => {
  assert.ok(ROLES.length >= 6 && ROLES.length <= 8, `${ROLES.length} roles`);
  for (const field of ['id', 'name', 'short', 'icon', 'color']) assert.equal(new Set(ROLES.map(r => r[field])).size, ROLES.length, `duplicate ${field}`);
  for (const r of ROLES) {
    assert.match(r.id, /^[a-z]+$/, r.id);
    assert.match(r.color, /^#[0-9a-f]{6}$/i, `${r.id} colour`);
    assert.ok(r.icon && r.icon.length <= 4, `${r.id} icon`);
    assert.ok(r.short.length <= 14, `${r.id} short name is short`);
    assert.ok(!KEYS.includes(r.id), `${r.id} must not look like a chamber id`);
  }
});

test('every role has a mission, a secret agenda and a catchphrase in a sensible length', () => {
  for (const r of ROLES) {
    for (const [field, min, max] of [['mission', 40, 160], ['agenda', 40, 160], ['line', 10, 60]]) {
      const v = r[field];
      assert.equal(typeof v, 'string', `${r.id}.${field}`);
      assert.ok(v.length >= min && v.length <= max, `${r.id}.${field} is ${v.length} characters`);
      assert.ok(!DASHES.test(v), `${r.id}.${field} uses a dash`);
      assert.match(v, /[.?!]$/, `${r.id}.${field} ends a sentence`);
    }
  }
});

test('every chamber and the verdict have a note for every role, of one to three sentences', () => {
  assert.deepEqual(Object.keys(ROLE_NOTES).sort(), [...KEYS].sort());
  for (const key of KEYS) {
    assert.deepEqual(Object.keys(ROLE_NOTES[key]).sort(), ROLES.map(r => r.id).sort(), `${key}: a note per role`);
    for (const r of ROLES) {
      const note = roleNote(key, r.id);
      assert.ok(note.length >= 80 && note.length <= 240, `${key}/${r.id} is ${note.length} characters`);
      const n = sentences(note);
      assert.ok(n >= 1 && n <= 3, `${key}/${r.id} has ${n} sentences`);
      assert.ok(!DASHES.test(note), `${key}/${r.id} uses a dash`);
      assert.match(note, /[.?!]$/, `${key}/${r.id} ends a sentence`);
    }
    const texts = Object.values(ROLE_NOTES[key]);
    assert.equal(new Set(texts).size, texts.length, `${key}: every role sees the chamber differently`);
  }
});

test('notes give a perspective, not the answer: they never quote a measure', () => {
  const words = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const shingles = (s, k = 6) => { const w = words(s); return new Set(w.slice(0, Math.max(0, w.length - k + 1)).map((_, i) => w.slice(i, i + k).join(' '))); };
  for (const key of KEYS) {
    const options = key === 'verdict' ? VERDICT.map(o => o.text) : CHAMBER[key].options.map(o => o.text);
    const quoted = new Set(options.flatMap(o => [...shingles(o)]));
    for (const r of ROLES) for (const s of shingles(roleNote(key, r.id))) assert.ok(!quoted.has(s), `${key}/${r.id} quotes a measure: "${s}"`);
  }
});

test('role lookups only accept our own ids, also for keys that Object.prototype knows', () => {
  for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', null, undefined, 42, {}, ['jurist']]) {
    assert.equal(roleById(bad), null, `roleById(${String(bad)})`);
    assert.equal(roleNote('necessity', bad), '', `roleNote(necessity, ${String(bad)})`);
    assert.equal(roleNote(bad, 'jurist'), '', `roleNote(${String(bad)}, jurist)`);
  }
  assert.equal(roleById('jurist'), ROLE.jurist);
  assert.equal(roleNote('verdict', 'inwoner'), ROLE_NOTES.verdict.inwoner);
});

test('a deal uses every role once, tier by tier', () => {
  const tiers = DEAL_TIERS.flat();
  assert.deepEqual([...tiers].sort(), ROLES.map(r => r.id).sort(), 'the tiers hold every role exactly once');
  for (let s = 1; s < 30; s++) {
    const order = dealOrder(seeded(s));
    assert.deepEqual([...order].sort(), [...tiers].sort());
    let at = 0;
    for (const tier of DEAL_TIERS) { assert.deepEqual(order.slice(at, at + tier.length).sort(), [...tier].sort()); at += tier.length; }
  }
});

test('the first advisors all get different roles, after that roles repeat evenly', () => {
  for (let s = 1; s < 10; s++) {
    const order = dealOrder(seeded(s)), table = [];
    for (let i = 0; i < 20; i++) table.push(nextRole(table, order));
    assert.deepEqual(table.slice(0, ROLES.length), order, 'the first N follow the deal and all differ');
    const counts = ROLES.map(r => table.filter(x => x === r.id).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `spread: ${counts}`);
    // two people at the table: the core roles, so the discussion has some friction
    assert.ok(table.slice(0, 2).every(id => DEAL_TIERS[0].includes(id)));
  }
});

test('a role that frees up is handed out again first', () => {
  const order = dealOrder(seeded(7)), table = order.slice(0, 5);
  const gone = table.splice(1, 1)[0];
  assert.equal(nextRole(table, order), gone);
  const full = [...order, ...order.slice(0, 3)];     // eleven people
  const left = full.splice(full.indexOf(order[6]), 1)[0];
  assert.equal(nextRole(full, order), left, 'with a full table the newcomer takes the scarcest role');
});

test('dealing again spreads the roles over everyone at the table', () => {
  const order = dealOrder(seeded(3));
  assert.deepEqual(dealAll(3, order), order.slice(0, 3));
  const big = dealAll(19, order);
  assert.equal(big.length, 19);
  const counts = ROLES.map(r => big.filter(x => x === r.id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `spread: ${counts}`);
  assert.deepEqual(dealAll(0, order), []);
});

test('votes are counted overall and per role', () => {
  const t = tallyBallots([
    {picks: [0, 2], role: 'jurist'},
    {picks: [2], role: 'inwoner'},
    {picks: [2, 2, 9, -1, 1.5], role: 'jurist'},   // duplicates and nonsense indices do not count
    {picks: [], role: 'data'},                      // an empty ballot is no ballot
    {picks: [1], role: null},                       // voted while roles were off
  ], 4);
  assert.deepEqual(t.counts, [1, 1, 3, 0]);
  assert.equal(t.ballots, 4);
  assert.deepEqual(t.byRole, {inwoner: {counts: [0, 0, 1, 0], ballots: 1}, jurist: {counts: [1, 0, 2, 0], ballots: 2}});
  assert.deepEqual(Object.keys(t.byRole), ['inwoner', 'jurist'], 'roles come in the order of ROLES');
  assert.equal(tallyBallots([{picks: [0], role: 'jurist'}], 2, false).byRole, undefined, 'without roles there is no breakdown');
  assert.deepEqual(tallyBallots([], 3), {counts: [0, 0, 0], ballots: 0, byRole: {}});
});

test('a phone only believes seats with sensible names and known roles', () => {
  assert.equal(readSeats(undefined), null);
  assert.equal(readSeats({n: 'x'}), null);
  const seats = readSeats([
    {n: 'Fatima', r: 'jurist', k: 'abc', v: 1},
    {n: '<img src=x onerror=alert(1)>'.repeat(3), r: '__proto__', k: 12},
    {n: '', r: 'constructor', k: 'z'.repeat(80)},
    null, 'Sem', 7,
  ]);
  assert.equal(seats.length, 3);
  assert.deepEqual(seats[0], {name: 'Fatima', role: 'jurist', tag: 'abc', voted: true});
  assert.equal(seats[1].name.length, 24);
  assert.equal(seats[1].role, null);
  assert.equal(seats[1].tag, '');
  assert.deepEqual(seats[2], {name: 'Adviseur', role: null, tag: 'z'.repeat(16), voted: false});
  assert.equal(readSeats(Array.from({length: 500}, (_, i) => ({n: `A${i}`, r: 'data', k: `${i}`}))).length, 40, 'a flood is capped');
});

test('a phone only believes vote counts for known roles, as small whole numbers', () => {
  assert.equal(readByRole(null, 3), null);
  assert.equal(readByRole([1, 2], 3), null);
  // parsed JSON, as it arrives: there "__proto__" is an ordinary own key
  const raw = JSON.parse('{"jurist": {"counts": [1, "x", -4, 2.5, 7], "ballots": 2}, "__proto__": {"counts": [9], "ballots": 1}, "hacker": {"counts": [5], "ballots": 5}, "data": {"counts": "nope"}, "ethicus": {"counts": [1e9, 3], "ballots": 1}}');
  const by = readByRole(raw, 3);
  assert.deepEqual(by, {jurist: {counts: [1, 0, 0], ballots: 2}, ethicus: {counts: [0, 3, 0], ballots: 1}});
});
