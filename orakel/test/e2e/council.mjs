// The online council end to end: the game as host, phones as advisors, on a relay this script
// starts itself. Checks that phones get different roles and see their role note during a
// decision, that the host counts votes per role, and that older phones and hosts still work.
//   node scripts/build-orakel.mjs --dev && node orakel/test/e2e/council.mjs
// Prints PASS/FAIL lines (exit code 1 on a failure); screenshots: shots/council-*.png.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GAME_URL, SHOTS, launch} from './_env.mjs';
import {ROLES, ROLE_NOTES, DEAL_TIERS} from '../../src/content/roles.js';
import {VERDICT, VERDICT_QUESTION} from '../../src/content/framework.js';
import {Mqtt} from '../../src/net/mqtt.js';
import {hashString} from '../../src/core/util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.FILE || GAME_URL;
const SH = SHOTS;
const fails = [], logs = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); if (!ok) fails.push(name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sockets = [];
// a bare MQTT client in Node, standing in for an older phone or an older game
async function bareClient() { const mq = new Mqtt(BROKER); mq.inbox = []; await mq.connect(3000); mq.onMessage = (t, m) => mq.inbox.push(m); sockets.push(mq); return mq; }

// A relay of our own on a random free port (PORT=0 would not tell the pages where it is).
async function startRelay() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const port = 18000 + Math.floor(Math.random() * 1000);
    const proc = spawn(process.execPath, [path.join(here, '../../relay/broker.mjs')], {env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'pipe']});
    const up = await new Promise(res => {
      const t = setTimeout(() => res(false), 5000);
      proc.stdout.on('data', d => { if (/listening/.test(String(d))) { clearTimeout(t); res(true); } });
      proc.on('exit', () => { clearTimeout(t); res(false); });
    });
    if (up) return {proc, port};
    proc.kill();
  }
  throw new Error('could not start the relay');
}
const relay = await startRelay();
const BROKER = `ws://localhost:${relay.port}`;
console.log('relay on', BROKER);

const browser = await launch();
const shut = async () => { for (const mq of sockets) mq.close(); await browser.close().catch(() => {}); relay.proc.kill(); };
const roleOf = p => p.evaluate(() => document.querySelector('#advisor .rolecard')?.dataset.role || null);
const advisorTop = (p, y) => p.evaluate(v => { document.getElementById('advisor').scrollTop = v; }, y);
// the phone app scrolls inside #advisor, so a tall shot needs a tall viewport
async function tallShot(p, name, h = 1900) {
  const vp = p.viewportSize();
  await p.setViewportSize({width: vp.width, height: h});
  await sleep(250);
  await p.screenshot({path: SH + name});
  await p.setViewportSize(vp);
}
async function phone(name, link) {
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const page = await ctx.newPage();
  page.on('pageerror', e => logs.push(`[${name} error] ${e.message}`));
  await page.goto(link);
  await page.waitForSelector('#advisor input');
  await page.fill('#advisor input', name);
  if (name === 'Fatima') await page.screenshot({path: SH + 'council-phone-join.png'});
  await page.tap('#advisor .go');
  return page;
}

try {
  // ---------------------------------------------------------------- the host starts a council
  const host = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  host.on('pageerror', e => logs.push('[host error] ' + e.message));
  await host.goto(`${file}?q=low&broker=${BROKER}`);
  await host.waitForFunction(() => window.__orakel && !document.querySelector('#titleBtns .go')?.disabled, null, {timeout: 90000});
  await host.evaluate(async () => { document.getElementById('title').hidden = true; document.getElementById('hud').hidden = false; await __orakel.newGame(); });
  await host.evaluate(async () => { await __orakel.run(2); });
  await host.evaluate(() => document.querySelector('#btnMenu').click());
  await sleep(300);
  await host.evaluate(() => [...document.querySelectorAll('#menuBody button')].find(b => b.textContent.includes('Adviesraad')).click());
  await sleep(300);
  await host.screenshot({path: SH + 'council-host-start.png'});
  await host.evaluate(() => [...document.querySelectorAll('#councilBody button')].find(b => b.textContent.includes('Start')).click());
  await host.waitForSelector('#councilBody .code', {timeout: 15000});
  const link = await host.evaluate(() => document.querySelector('#councilBody input').value);
  const code = await host.evaluate(() => document.querySelector('#councilBody .code').textContent);
  check('the council starts on the local relay', /^[A-Z0-9]{6}$/.test(code) && link.includes(`raad=${code}`), code);
  check('NET.roles lists every role without the agendas', await host.evaluate(n => __orakel.NET.roles.length === n && __orakel.NET.roles.every(r => r.id && r.name && r.icon && r.color && !('agenda' in r)), ROLES.length));

  // ---------------------------------------------------------------- two phones join
  const p1 = await phone('Fatima', link);
  await p1.waitForSelector('#advisor .rolecard[data-role]', {timeout: 10000});
  const p2 = await phone('Sem', link);
  await p2.waitForSelector('#advisor .rolecard[data-role]', {timeout: 10000});
  await sleep(600);
  const r1 = await roleOf(p1), r2 = await roleOf(p2);
  check('the two phones get different roles', r1 && r2 && r1 !== r2, `${r1} · ${r2}`);
  check('a small council gets the core roles first', DEAL_TIERS[0].includes(r1) && DEAL_TIERS[0].includes(r2));
  const seats = await host.evaluate(() => __orakel.NET.seats);
  check('the host knows who sits where', JSON.stringify(seats) === JSON.stringify([{name: 'Fatima', role: r1}, {name: 'Sem', role: r2}]), JSON.stringify(seats));
  check('the host panel lists both members with role icons', await host.evaluate(() => document.querySelectorAll('#councilBody .hs-seat .role-ic').length === 2));
  check('the phone lists everyone at the table', await p1.evaluate(() => [...document.querySelectorAll('#advisor .chip')].map(c => c.textContent).join(' | ')).then(t => t.includes('Fatima') && t.includes('Sem')));
  await host.screenshot({path: SH + 'council-host-panel.png'});
  await p1.screenshot({path: SH + 'council-phone-role.png'});
  // the secret agenda opens on a tap
  await p1.tap('#advisor .rc-agenda');
  const agenda = await p1.evaluate(() => document.querySelector('#advisor .rc-a-t')?.textContent);
  check('the secret agenda shows after a tap', agenda === ROLES.find(r => r.id === r1).agenda);
  await p1.screenshot({path: SH + 'council-phone-agenda.png'});
  await tallShot(p1, 'council-phone-agenda-full.png');

  // ---------------------------------------------------------------- the host changes roles
  const other = ROLES.find(r => ![r1, r2].includes(r.id)).id;
  await host.selectOption('#councilBody .hs-seat:nth-child(2) select', other);
  await p2.waitForFunction(w => document.querySelector('#advisor .rolecard')?.dataset.role === w, other, {timeout: 6000}).catch(() => {});
  check('the host can set one role per member', await roleOf(p2) === other, `${await roleOf(p2)}`);
  await host.evaluate(() => [...document.querySelectorAll('#councilBody button')].find(b => b.textContent.includes('Verdeel')).click());
  await sleep(1200);
  const d1 = await roleOf(p1), d2 = await roleOf(p2);
  check('a fresh deal keeps the roles different', d1 && d2 && d1 !== d2 && DEAL_TIERS[0].includes(d1) && DEAL_TIERS[0].includes(d2), `${d1} · ${d2}`);
  await host.screenshot({path: SH + 'council-host-redeal.png'});

  // ---------------------------------------------------------------- an old phone (no role code) still takes part
  const oldPhone = await bareClient();
  oldPhone.subscribe(`gewelf-orakel/v1/${code}/h`);
  oldPhone.publish(`gewelf-orakel/v1/${code}/a`, {t: 'hi', id: 'oudtoestel1', name: 'Oude telefoon'});
  await sleep(800);
  const s0 = oldPhone.inbox.filter(m => m.t === 'state').at(-1);
  check('an old phone still gets the fields it knows', s0 && Array.isArray(s0.members) && s0.members.includes('Oude telefoon') && s0.hp > 0 && 'vote' in s0, s0 ? s0.members.join(',') : 'no state');
  const seats3 = await host.evaluate(() => __orakel.NET.seats);
  check('the old phone is dealt a role too, a different one', seats3.length === 3 && new Set(seats3.map(s => s.role)).size === 3, seats3.map(s => s.role).join(','));

  // ---------------------------------------------------------------- a decision: notes on the phones, votes per role
  await host.evaluate(() => { document.getElementById('councilModal').hidden = true; document.getElementById('menu').hidden = true; __orakel.GAME.modal = null; __orakel.autoDecide = null; window.__dec = __orakel.decide('necessity', {who: 'waarom'}); });
  await p1.waitForSelector('#advisor .rolenote', {timeout: 8000});
  await p2.waitForSelector('#advisor .rolenote', {timeout: 8000});
  for (const [p, r, who] of [[p1, d1, 'phone 1'], [p2, d2, 'phone 2']]) {
    const n = await p.evaluate(() => { const e = document.querySelector('#advisor .rolenote'); return {key: e.dataset.key, role: e.dataset.role, text: e.querySelector('p').textContent}; });
    check(`${who} sees the note of its role for this chamber`, n.key === 'necessity' && n.role === r && n.text === ROLE_NOTES.necessity[r], `${n.role}: ${n.text.slice(0, 60)}…`);
  }
  check('the role card folds during a vote', await p1.evaluate(() => document.querySelector('#advisor .rc-head').getAttribute('aria-expanded')) === 'false');
  check('before voting a phone does not see the others', await p1.evaluate(() => [...document.querySelectorAll('#advisor .optb .votes')].every(v => v.textContent === '')));
  await p1.screenshot({path: SH + 'council-phone-vote.png'});
  await p1.locator('#advisor .optb').nth(0).tap();
  await p1.locator('#advisor .optb').nth(2).tap();
  await p1.tap('#advisor .go');
  await sleep(700);
  await p2.locator('#advisor .optb').nth(2).tap();
  await p2.tap('#advisor .go');
  oldPhone.publish(`gewelf-orakel/v1/${code}/a`, {t: 'vote', id: 'oudtoestel1', name: 'Oude telefoon', key: 'necessity', picks: [1, 2]});
  await sleep(1500);
  const t = await host.evaluate(() => __orakel.NET.tallies);
  const old = seats3[2].role;
  check('the host counts all votes', JSON.stringify(t.counts.slice(0, 3)) === '[1,1,3]' && t.ballots === 3, JSON.stringify(t.counts));
  check('the host counts votes per role', t.byRole?.[d1]?.counts[0] === 1 && t.byRole[d1].counts[2] === 1 && t.byRole[d1].ballots === 1 && t.byRole?.[d2]?.counts[2] === 1 && t.byRole[d2].counts[0] === 0 && t.byRole?.[old]?.counts[1] === 1, JSON.stringify(t.byRole));
  const who = await p1.evaluate(() => [...document.querySelectorAll('#advisor .optb')].map(b => b.querySelector('.who [aria-hidden]')?.textContent || '').join(' | '));
  check('after voting the phone shows who chose what', who.split(' | ')[2].length > 0 && who.split(' | ')[3] === '', who);
  check('phones see who has voted', await p2.evaluate(() => document.querySelectorAll('#advisor .chip .ok').length) === 3);
  await p1.screenshot({path: SH + 'council-phone-voted.png'});
  await tallShot(p1, 'council-phone-voted-full.png', 2100);
  await host.screenshot({path: SH + 'council-host-decision.png'});
  // the decision closes (skipped): the council's advice is kept for the debrief
  await host.evaluate(() => [...document.querySelectorAll('#decBar button')].find(b => /Sla over|Laat/.test(b.textContent)).click());
  await sleep(600);
  const kept = await host.evaluate(() => __orakel.G.council.necessity);
  check('the council advice per role is kept in the save', kept?.ballots === 3 && kept.byRole?.[d1]?.ballots === 1, JSON.stringify(kept));
  check('phones go back to waiting when the vote closes', await p1.evaluate(() => !document.querySelector('#advisor .rolenote')));

  // ---------------------------------------------------------------- the verdict, then the agendas come out
  await host.evaluate(([q, opts]) => __orakel.NET.openVote('verdict', q, opts, false), [VERDICT_QUESTION, VERDICT.map(o => o.title)]);
  await p2.waitForSelector('#advisor .rolenote[data-key="verdict"]', {timeout: 8000});
  check('the verdict has a note per role too', await p2.evaluate(() => document.querySelector('#advisor .rolenote p').textContent) === ROLE_NOTES.verdict[d2]);
  await p2.locator('#advisor .optb').nth(1).tap();
  await p2.locator('#advisor .optb').nth(2).tap();
  check('the verdict takes one choice', await p2.evaluate(() => document.querySelectorAll('#advisor .optb[aria-pressed="true"]').length) === 1);
  await p2.tap('#advisor .go');
  await p2.screenshot({path: SH + 'council-phone-verdict.png'});
  await sleep(800);
  await host.evaluate(() => { __orakel.G.verdict = {choice: 2, ceiling: 1, judgement: 'beyond', at: Date.now()}; __orakel.NET.closeVote(); });
  await p1.waitForSelector('#advisor .reveal', {timeout: 8000});
  const reveal = await p1.evaluate(() => document.querySelector('#advisor .reveal').textContent);
  check('after the verdict every agenda is revealed', [d1, d2].every(r => reveal.includes(ROLES.find(x => x.id === r).agenda)));
  await advisorTop(p1, 0);
  await p1.screenshot({path: SH + 'council-phone-end.png'});

  // ---------------------------------------------------------------- support, leaving and stopping
  await p1.tap('#advisor .cheer');
  await sleep(1200);
  check('support from a phone arrives', await host.evaluate(() => __orakel.NET.cheers) === 1);
  await p2.close({runBeforeUnload: true});
  oldPhone.publish(`gewelf-orakel/v1/${code}/a`, {t: 'bye', id: 'oudtoestel1'});
  await sleep(1500);
  check('the member list shrinks when advisors leave', JSON.stringify(await host.evaluate(() => __orakel.NET.members)) === '["Fatima"]');
  await host.evaluate(() => document.querySelector('#btnMenu').click());
  await sleep(300);
  await host.evaluate(() => [...document.querySelectorAll('#menuBody button')].find(b => b.textContent.includes('Adviesraad')).click());
  await sleep(300);
  await host.evaluate(() => [...document.querySelectorAll('#councilBody button')].find(b => b.textContent.includes('Stop')).click());
  await p1.waitForFunction(() => document.querySelector('#advisor h1')?.textContent === 'De raad is gesloten', null, {timeout: 6000}).catch(() => {});
  check('a phone sees the council close, and keeps the reveal', await p1.evaluate(() => document.querySelector('#advisor h1')?.textContent === 'De raad is gesloten' && !!document.querySelector('#advisor .reveal')));
  check('the reveal still shows those who already left', await p1.evaluate(() => document.querySelectorAll('#advisor .reveal .rv').length) === 3);
  check('the host council is off', await host.evaluate(() => !__orakel.NET.active && __orakel.NET.seats.length === 0));
  await p1.screenshot({path: SH + 'council-phone-closed.png'});

  // ---------------------------------------------------------------- a new phone with an old host (no seats, no notes)
  const fake = await bareClient();
  fake.subscribe('gewelf-orakel/v1/OUDHST/a');
  const oldState = {t: 'state', v: 1, code: 'OUDHST', place: 'De Kamer van de Vraag', depth: 'Diepte 1', hp: 80, maxHp: 100, quest: null, members: ['Iemand'],
    vote: {key: 'necessity', question: 'Wat moeten jullie eerst vastleggen?', options: ['Optie een', 'Optie twee'], multi: true}, tally: {id: 'necessity', counts: [0, 0], ballots: 0}, ended: null, at: Date.now()};
  fake.publish('gewelf-orakel/v1/OUDHST/h', oldState, true);
  await sleep(300);
  const p3 = await phone('Noor', `${file}#raad=OUDHST&b=${encodeURIComponent(BROKER)}`);
  await p3.waitForSelector('#advisor .optb', {timeout: 8000});
  check('with an old host the phone shows no role, and still votes', await p3.evaluate(() => !document.querySelector('#advisor .rolecard') && !document.querySelector('#advisor .rolenote') && document.querySelectorAll('#advisor .optb').length === 2));
  await p3.locator('#advisor .optb').nth(1).tap();
  await p3.tap('#advisor .go');
  await sleep(800);
  const v3 = fake.inbox.find(m => m.t === 'vote');
  check('the old host receives the vote as before', v3 && v3.key === 'necessity' && JSON.stringify(v3.picks) === '[1]' && v3.name === 'Noor');
  // a forged state with nonsense seats must not break the phone or inject markup
  const id3 = await p3.evaluate(() => sessionStorage.getItem('orakel-raad-id'));
  const tag3 = hashString(`zetel:${id3}`).toString(36);
  fake.publish('gewelf-orakel/v1/OUDHST/h', {...oldState, members: 'nope', seats: [{n: '<img src=x onerror="window.__pwned=1">', r: '__proto__', k: tag3}, {n: 'Echt', r: 'constructor'}, 5, null], tally: {counts: 'x', byRole: {__proto__: 1}}, at: Date.now()}, true);
  await sleep(800);
  const forged = await p3.evaluate(() => ({card: !!document.querySelector('#advisor .rolecard'), img: !!document.querySelector('#advisor img'), pwned: !!window.__pwned, chips: document.querySelectorAll('#advisor .chip').length}));
  check('a forged state cannot claim a role or inject markup', !forged.card && !forged.img && !forged.pwned && forged.chips === 2, JSON.stringify(forged));
  fake.publish('gewelf-orakel/v1/OUDHST/h', {...oldState, seats: [{n: 'Noor', r: 'ethicus', k: tag3}], at: Date.now()}, true);
  await p3.waitForSelector('#advisor .rolecard[data-role="ethicus"]', {timeout: 5000}).catch(() => {});
  check('the phone finds its own seat by its tag', await roleOf(p3) === 'ethicus');
  await p3.screenshot({path: SH + 'council-phone-oldhost.png'});
  fake.publish('gewelf-orakel/v1/OUDHST/h', null, true);
} catch (e) {
  check('the run completes', false, e.stack || e.message);
} finally {
  console.log(logs.join('\n') || 'no page errors');
  if (logs.length) fails.push('page errors');
  await shut();
  console.log(fails.length ? `${fails.length} FAILED: ${fails.join('; ')}` : 'all council checks passed');
  process.exit(fails.length ? 1 : 0);
}
