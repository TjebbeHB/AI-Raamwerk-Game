// The online council's message path: the game's own MQTT client talking to the bundled relay.
// Needs a global WebSocket (Node 22 and later).
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';

process.env.PORT = '0';
const {server} = await import('../relay/broker.mjs');
const {Mqtt} = await import('../src/net/mqtt.js');
const {ROLES, dealAll, tallyBallots, readSeats, readByRole} = await import('../src/content/roles.js');
const {CHAMBERS} = await import('../src/content/framework.js');
if (!server.listening) await once(server, 'listening');
const url = `ws://127.0.0.1:${server.address().port}`;
const clients = [];

async function client() {
  const mq = new Mqtt(url);
  mq.inbox = [];
  mq.onMessage = (topic, data) => mq.inbox.push({topic, data});
  await mq.connect(3000);
  clients.push(mq);
  return mq;
}
// wait until a client has received n messages (or fail after a while)
async function received(mq, n = 1) {
  for (let i = 0; i < 100 && mq.inbox.length < n; i++) await new Promise(r => setTimeout(r, 20));
  return mq.inbox;
}
const settle = () => new Promise(r => setTimeout(r, 120));

test.after(() => { for (const mq of clients) mq.close(); server.close(); });

test('a phone receives what the game publishes', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  const game = await client(), phone = await client();
  phone.subscribe('orakel-test/ROOM1/h');
  await settle();
  game.publish('orakel-test/ROOM1/h', {t: 'state', place: 'De Kamer van de Vraag'});
  const inbox = await received(phone);
  assert.deepEqual(inbox[0], {topic: 'orakel-test/ROOM1/h', data: {t: 'state', place: 'De Kamer van de Vraag'}});
});

test('a late joiner gets the retained state at once, and a cleared room stays empty', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  const game = await client();
  game.publish('orakel-test/ROOM2/h', {t: 'state', hp: 80}, true);
  await settle();
  const late = await client();
  late.subscribe('orakel-test/ROOM2/h');
  assert.equal((await received(late))[0].data.hp, 80);
  game.publish('orakel-test/ROOM2/h', null, true);   // what stopping the council does
  await settle();
  const later = await client();
  later.subscribe('orakel-test/ROOM2/h');
  await settle(); await settle();
  assert.equal(later.inbox.length, 0);
});

test('votes from several advisors reach the game, and rooms do not leak into each other', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  const game = await client(), other = await client();
  game.subscribe('orakel-test/ROOM3/a');
  other.subscribe('orakel-test/ROOM4/a');
  await settle();
  const a = await client(), b = await client();
  a.publish('orakel-test/ROOM3/a', {t: 'vote', id: 'a', picks: [0, 2]});
  b.publish('orakel-test/ROOM3/a', {t: 'vote', id: 'b', picks: [2]});
  const inbox = await received(game, 2);
  assert.deepEqual(inbox.map(m => m.data.id).sort(), ['a', 'b']);
  await settle();
  assert.equal(other.inbox.length, 0);
});

test('wildcard subscriptions follow the MQTT rules', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  const watcher = await client(), sender = await client();
  watcher.subscribe('orakel-test/+/h');
  await settle();
  sender.publish('orakel-test/ROOM5/h', {n: 1});
  sender.publish('orakel-test/ROOM5/a', {n: 2});
  sender.publish('orakel-test/ROOM5/h/extra', {n: 3});
  await settle(); await settle();
  assert.deepEqual(watcher.inbox.map(m => m.data.n), [1]);
});

test('oversized messages are dropped instead of relayed', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  const phone = await client(), game = await client();
  phone.subscribe('orakel-test/ROOM6/h');
  await settle();
  game.publish('orakel-test/ROOM6/h', {blob: 'x'.repeat(33000)});
  game.publish('orakel-test/ROOM6/h', {ok: true});
  const inbox = await received(phone);
  await settle();
  assert.deepEqual(inbox.map(m => m.data), [{ok: true}]);
});

test('a full council with roles still fits in one state message, with room to spare', {skip: typeof WebSocket === 'undefined' && 'no global WebSocket'}, async () => {
  // the worst case: thirty advisors with the longest names, the chamber with the longest options,
  // everyone voted for everything, and a tally per role
  const c = CHAMBERS.reduce((a, b) => (JSON.stringify(b.options).length > JSON.stringify(a.options).length ? b : a));
  const roles = dealAll(30), n = c.options.length;
  const seats = roles.map((r, i) => ({n: `Adviseur met een lange ${String(i).padStart(2, '0')}`.slice(0, 24), r, k: (1e9 + i * 7919).toString(36), v: 1}));
  const ballots = roles.map(role => ({picks: c.options.map((_, i) => i), role}));
  const state = {t: 'state', v: 1, code: 'ABCDEF', place: 'De Kamer van de Vraag', depth: 'Diepte 1', hp: 100, maxHp: 130,
    quest: {title: 'Een opdracht met een titel', text: 'x'.repeat(200)}, members: seats.map(s => s.n), seats,
    vote: {key: c.id, question: c.question, options: c.options.map(o => o.text), multi: true, n: 99},
    tally: {id: c.id, ...tallyBallots(ballots, n)}, ended: null, at: Date.now()};
  const size = Buffer.byteLength(JSON.stringify(state));
  assert.ok(size < 12 * 1024, `state is ${size} bytes`);
  assert.equal(Object.keys(state.tally.byRole).length, ROLES.length);
  const phone = await client(), game = await client();
  phone.subscribe('orakel-test/ROOM7/h');
  await settle();
  game.publish('orakel-test/ROOM7/h', state, true);
  const [got] = await received(phone);
  assert.deepEqual(got.data, state);
  // and what the phone makes of it
  const read = readSeats(got.data.seats);
  assert.equal(read.length, 30);
  assert.deepEqual(read.map(s => s.role), roles);
  assert.deepEqual(readByRole(got.data.tally.byRole, n), state.tally.byRole);
});
