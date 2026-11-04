// The end summary and the debrief: every chamber has something to talk about, the playstyle
// titles follow their rules, council tallies are read the same way everywhere, and the
// downloadable report carries the summary, the council's votes and the discussion questions.
// Run with: node --test orakel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHAMBERS, CHAMBER, recordChoice, report, assess, VERDICT} from '../src/content/framework.js';
import {NABESPREKING, GUARDIAN, FACILITATOR, VERDICT_TALK, SHORTCUT_TALK, TITLES, facts, playstyle, councilView, differs, differsVerdict, relations, roleInfo, roleOrder, fmtDist, fmtMin, DEPTHS} from '../src/content/nabespreking.js';
import {CAST_DEFS} from '../src/content/cast.js';
import {G, resetState} from '../src/game/state.js';
import {ON} from '../src/game/bus.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fit = id => CHAMBER[id].options.flatMap((o, i) => (o.status === 'correct' ? [i] : []));
const bad = id => CHAMBER[id].options.findIndex(o => o.status === 'incorrect');
const sample = () => ({...facts(resetAndGet(), assess(), {}), verdict: 2, judgement: 'supported'});
function resetAndGet() { resetState(); return G; }

// ---------------------------------------------------------------- the content
test('every chamber has two or three discussion questions and a prompt for your own organisation', () => {
  for (const c of CHAMBERS) {
    const n = NABESPREKING[c.id];
    assert.ok(n, `no debrief for ${c.id}`);
    assert.ok(n.questions.length >= 2 && n.questions.length <= 3, `${c.id}: ${n.questions.length} questions`);
    for (const q of n.questions) assert.ok(q.length > 30 && q.trim().endsWith('?'), `${c.id}: not a question: ${q}`);
    assert.ok(typeof n.own === 'string' && n.own.length > 40, `${c.id}: no prompt for your own organisation`);
  }
  assert.deepEqual(Object.keys(NABESPREKING).sort(), CHAMBERS.map(c => c.id).sort());
});

test('every chamber has a guardian from the cast', () => {
  for (const c of CHAMBERS) assert.ok(CAST_DEFS[GUARDIAN[c.id]], `${c.id}: unknown guardian ${GUARDIAN[c.id]}`);
});

test('the facilitator plan adds up to twenty minutes and the verdict has questions', () => {
  assert.equal(FACILITATOR.steps.reduce((a, s) => a + s.min, 0), 20);
  assert.ok(FACILITATOR.tips.length >= 3);
  assert.equal(VERDICT_TALK.length, 3);
  assert.ok(VERDICT_TALK.every(q => q({choice: 'A', ceiling: 'B', same: false}).length > 20));
  assert.equal(SHORTCUT_TALK.length, 3);
});

test('no em dashes in the texts and code of the summary and the debrief', () => {
  const files = ['../src/content/nabespreking.js', '../src/ui/summary.js', '../src/ui/debrief.js', '../src/ui/verdict.js'];
  for (const f of files) assert.ok(!fs.readFileSync(path.join(here, f), 'utf8').includes('—'), `${f} contains an em dash`);
});

// ---------------------------------------------------------------- playstyle titles
test('there are 8 to 12 titles, each with a rule, and the last one always fits', () => {
  assert.ok(TITLES.length >= 8 && TITLES.length <= 12, `${TITLES.length} titles`);
  assert.equal(new Set(TITLES.map(t => t.id)).size, TITLES.length);
  for (const t of TITLES) assert.ok(t.rule && t.rule.length > 15, `${t.id} has no rule`);
  assert.equal(TITLES.at(-1).test({}), true);
});

test('title rules on sample states', () => {
  const base = sample();
  assert.equal(playstyle({...base, verdict: null, judgement: null, time: 0}).id, 'nieuw');
  assert.equal(playstyle({...base, verdict: null, judgement: null, shortcut: true}).id, 'snel');
  assert.equal(playstyle({...base, time: 30 * 60, strong: 8}).id, 'snel');
  assert.equal(playstyle({...base, time: 30 * 60, strong: 13, bronnen: 40}).id, 'grondig', 'fast but thorough is thorough');
  assert.equal(playstyle({...base, time: 90 * 60, strong: 12, bronnen: 35}).id, 'grondig');
  assert.equal(playstyle({...base, time: 90 * 60, bingo: {got: 13, total: 16}}).id, 'bingo');
  assert.equal(playstyle({...base, time: 90 * 60, bingo: {got: 12, total: 16}}).id, 'nieuw', '75% is not yet a bingo champion');
  assert.equal(playstyle({...base, time: 90 * 60, hallucs: 12}).id, 'hallu');
  assert.equal(playstyle({...base, time: 90 * 60, kills: 75}).id, 'monster');
  assert.equal(playstyle({...base, time: 90 * 60, deaths: 7}).id, 'doorzetter');
  assert.equal(playstyle({...base, time: 90 * 60, deaths: 7, verdict: null}).id, 'nieuw', 'you only persevere when you reach the verdict');
  assert.equal(playstyle({...base, time: 90 * 60, reweighed: 4}).id, 'herweger');
  assert.equal(playstyle({...base, time: 90 * 60, warm: 5}).id, 'netwerk');
  assert.equal(playstyle({...base, time: 90 * 60, met: 31}).id, 'netwerk');
  assert.equal(playstyle({...base, time: 90 * 60, judgement: 'cautious'}).id, 'zeker');
  assert.equal(playstyle({...base, time: 90 * 60, bronnen: 41}).id, 'archief');
  assert.equal(playstyle({...base, time: 90 * 60, secrets: {got: 6, total: 8}}).id, 'archief');
  // Joop's title follows your pronouns, and is neutral by default
  const joop = {...base, time: 90 * 60, sleutelbos: true};
  assert.equal(playstyle({...joop, pron: 'hij'}).name, 'Vriend van de Conciërge');
  assert.equal(playstyle({...joop, pron: 'zij'}).name, 'Vriendin van de Conciërge');
  assert.equal(playstyle({...joop, pron: 'die'}).name, 'Maatje van de Conciërge');
  assert.equal(playstyle({...base, time: 90 * 60, joop: 3}).id, 'joop');
  // side titles: the next matches, at most three, never the fallback
  const many = playstyle({...base, time: 90 * 60, strong: 12, bronnen: 42, kills: 90, deaths: 8, reweighed: 5, hallucs: 12});
  assert.equal(many.id, 'grondig');
  assert.deepEqual(many.also.map(t => t.id), ['hallu', 'archief', 'monster']);
  assert.ok(many.line.includes('12 van de 15'));
});

test('facts read old saves and missing registries without NaN', () => {
  resetState();
  G.stats = {time: 1234, kills: 3, deaths: 1, steps: 40, shortcut: 0, revealed: 2};      // a save from before floorTime, met and distance
  const f = facts(G, assess(), {});
  for (const k of ['time', 'active', 'tracked', 'kills', 'deaths', 'abilities', 'damageTaken', 'distance', 'talks', 'strong', 'open', 'blind']) assert.ok(Number.isFinite(f[k]), `${k} is ${f[k]}`);
  assert.equal(f.time, 1234);
  assert.equal(f.met, null);
  assert.equal(f.secrets, null);
  assert.equal(f.bingo, null);
  assert.equal(f.blind, 15);
  assert.equal(playstyle(f).id, 'nieuw');
  // time per depth counts conversations as well, so the total is the larger of the two
  G.stats.floorTime = {f0: 600, f1: 900};
  assert.equal(facts(G, assess(), {}).time, 1500);
  // registries count only what they list
  const g = facts({...G, secrets: ['a', 'b', 'x'], bingo: ['b1']}, assess(), {secretList: [{id: 'a'}, {id: 'b'}, {id: 'c'}], bingoList: [{id: 'b1', word: 'Synergie'}]});
  assert.deepEqual(g.secrets, {got: 2, total: 3});
  assert.deepEqual(g.bingo, {got: 1, total: 1});
});

// ---------------------------------------------------------------- council tallies
test('a council tally: majority, favourites and where it differs from you', () => {
  const v = councilView({counts: [4, 1, 3, 0], ballots: 6}, 4);
  assert.deepEqual(v.majority, [0, 2]);
  assert.deepEqual(v.top, [0]);
  assert.equal(differs([0, 2], v), false);
  assert.equal(differs([0], v), true);
  assert.equal(differs([0, 1, 2], v), true);
  assert.equal(differs(undefined, v), true, 'skipping a chamber the council voted on is a difference');
  assert.equal(councilView({counts: [0, 0], ballots: 0}, 2), null);
  assert.equal(councilView(null, 2), null);
  assert.equal(differs([1], null), false);
  const tie = councilView({counts: [2, 2, 1, 0], ballots: 5}, 4);
  assert.deepEqual(tie.top, [0, 1]);
  assert.equal(differsVerdict(1, tie), false);
  assert.equal(differsVerdict(2, tie), true);
  // roles: stored metadata first, then the live council, then a readable fallback
  assert.equal(roleInfo('jurist', [{id: 'jurist', name: 'Jurist', icon: '⚖', color: 0xb9a2ff}]).color, '#b9a2ff');
  assert.equal(roleInfo('burger', null, []).name, 'Burger');
  assert.deepEqual(roleOrder({it: {ballots: 1, counts: [1]}, jurist: {ballots: 2, counts: [0]}, leeg: {ballots: 0, counts: [0]}}, [{id: 'jurist'}, {id: 'it'}]), ['jurist', 'it']);
});

test('relationships come from the registry, or from whoever G.rel mentions', () => {
  const g = {rel: {joop: 4, glans: -2, ilse: 0}};
  assert.deepEqual(relations(g, {relList: [{npc: 'joop', name: 'Joop'}, {npc: 'bakker', name: 'Mevrouw Bakker'}]}).map(r => [r.npc, r.v]), [['joop', 4], ['bakker', 0]]);
  assert.deepEqual(relations(g, {}, CAST_DEFS).map(r => r.name), ['Joop', 'Glans']);
  assert.deepEqual(relations({}, {}), []);
});

test('small formatting helpers', () => {
  assert.equal(fmtDist(640.4), '640 m');
  assert.equal(fmtDist(2875), '2,9 km');
  assert.equal(fmtMin(42), '42 sec');
  assert.equal(fmtMin(4980), '1 u 23 min');
  assert.deepEqual(Object.keys(DEPTHS), ['f0', 'f1', 'f2', 'f3', 'f4']);
});

// ---------------------------------------------------------------- the report
test('the report carries the summary, the council votes and the discussion questions', () => {
  resetState();
  for (const c of CHAMBERS) recordChoice(c.id, fit(c.id));
  recordChoice('quality', [...fit('quality'), bad('quality')]);
  const d = assess();
  G.verdict = {choice: 2, ceiling: d.ceiling, judgement: 'cautious', votes: [1, 3, 2, 1], at: 1};
  G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: 'datatovenaar', look: {}};
  Object.assign(G.stats, {time: 3000, kills: 40, deaths: 2, talks: 50, distance: 2400, met: {joop: 4, ilse: 2}, floorTime: {f0: 300, f1: 900, f2: 1000, f3: 1100, f4: 500}});
  G.choices = [{id: 'c1', npc: 'joop', label: 'Het Gewelf', text: 'Je vroeg Joop wat het Gewelf is.', at: 1}];
  G.rel = {joop: 4};
  G.council = {
    verdict: {counts: [1, 3, 2, 1], ballots: 7, byRole: {jurist: {counts: [0, 2, 0, 0], ballots: 2}, inwoner: {counts: [1, 1, 2, 1], ballots: 5}}, roles: [{id: 'jurist', name: 'Jurist', icon: '⚖'}]},
    quality: {counts: CHAMBER.quality.options.map((o, i) => (fit('quality').includes(i) ? 3 : 0)), ballots: 3, byRole: null},
  };
  ON.relList = [{npc: 'joop', name: 'Joop'}];
  ON.achievementList = [{id: 'a1', name: 'Eerste werkdag', text: 'De brief gelezen.'}];
  G.achievements = ['a1'];
  const md = report();
  for (const s of ['## Het besluit', '## Jouw afdaling', '**Speelstijl:', '- Adviseur: Sam, De Datatovenaar (tovenaar)', 'Tijd in het Gewelf: 1 u 3 min', 'De Kelder der Beloften 15 min',
    '### Jouw keuzes', '**Joop** · Het Gewelf: Je vroeg Joop wat het Gewelf is.', '### Relaties', '- Joop: warm (+4)', '### Prestaties', '- Eerste werkdag: De brief gelezen.',
    'Adviesraad (7 stemmen):', '- Eerst verder onderzoeken: 3 (Jurist 2, Inwoner 1)', 'De adviesraad koos een ander besluit dan de speler.',
    '## Nabespreking', '### Over het besluit', 'Jullie kozen ‘Een begrensde pilot’', '## De kamers', 'Gespreksvragen:', 'Voor je eigen organisatie:', 'Adviesraad (3 stemmen):', 'De adviesraad koos anders dan de speler.']) {
    assert.ok(md.includes(s), `report misses: ${s}`);
  }
  for (const c of CHAMBERS) for (const q of NABESPREKING[c.id].questions) assert.ok(md.includes(q), `${c.id}: question missing from the report`);
  assert.ok(!md.includes('undefined') && !md.includes('NaN'), 'report shows undefined or NaN');
  delete ON.relList; delete ON.achievementList;
});

test('the report works for a fresh game and for the Snelle Lift', () => {
  resetState();
  const fresh = report();
  assert.ok(fresh.includes('## Jouw afdaling') && fresh.includes('Niet onderzocht. Passend waren:'));
  assert.ok(!fresh.includes('## Het besluit'));
  G.stats.shortcut = 1;
  const lift = report();
  assert.ok(lift.includes('**De Snelle Lift**') && lift.includes('### Over de Snelle Lift') && lift.includes('15 van de 15 kamers zijn blinde vlekken.'));
  assert.ok(lift.includes('**Speelstijl: Snelle Beslisser.**'));
  assert.ok(!lift.includes('undefined') && !lift.includes('NaN'));
  for (const v of VERDICT) assert.ok(v.title);
});
