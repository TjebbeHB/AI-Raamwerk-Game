// The online advisory council. One person plays; advisors join on their phones with a
// room code, vote on every decision and send support in fights. Messages travel through
// an MQTT broker over WebSockets, so the game itself stays a static page.
// Default: public test brokers (no account needed). Organisations can run their own:
// any MQTT broker with WebSockets, or orakel/relay/broker.mjs, via ?broker=wss://…
import QRCode from 'qrcode';
import {Mqtt} from './mqtt.js';
import {NET, UI, SFX, P} from '../game/bus.js';
import {G} from '../game/state.js';
import {W} from '../game/world.js';
import {tracked} from '../game/quests.js';
import {healPlayer} from '../game/player.js';
import {$, el, esc, tileOf} from '../core/util.js';
import {GAME} from '../game/game.js';
import {unlockForUi} from '../game/dialogue.js';

export const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const BASE = 'gewelf-orakel/v1';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHA[b % ALPHA.length]).join('');
const hostOf = url => { try { return new URL(url).host; } catch (e) { return url; } };
const customBroker = () => new URLSearchParams(location.search).get('broker');

// ---------------------------------------------------------------- host
const H = {mq: null, code: null, broker: null, members: new Map(), votes: {}, vote: null, lastCheer: {}, last: '', heartbeat: null, tick: null, status: 'uit'};

export async function startCouncil() {
  if (H.mq) return;
  H.code = randomCode();
  const list = customBroker() ? [customBroker()] : BROKERS;
  for (const url of list) {
    H.status = `verbinden met ${hostOf(url)}…`; refresh();
    const mq = new Mqtt(url);
    try { await mq.connect(); H.mq = mq; H.broker = url; break; } catch (e) { mq.close(); }
  }
  if (!H.mq) { H.status = 'geen verbinding: probeer het later opnieuw, of gebruik een eigen server (?broker=…)'; refresh(); return; }
  H.mq.subscribe(`${BASE}/${H.code}/a`);
  H.mq.onMessage = (t, m) => fromAdvisor(m);
  H.mq.onReconnect = () => push(true);
  H.mq.onStatus = s => { H.status = s === 'open' ? 'verbonden' : s === 'reconnecting' ? 'verbinding kwijt, opnieuw verbinden…' : s; refresh(); };
  H.status = 'verbonden';
  NET.active = true;
  H.heartbeat = setInterval(() => { prune(); push(true); }, 12000);
  H.tick = setInterval(() => push(false), 1000);
  push(true);
  refresh();
  SFX.play('quest');
}
export function stopCouncil() {
  if (!H.mq) return;
  H.mq.publish(`${BASE}/${H.code}/h`, {t: 'end', code: H.code});
  H.mq.publish(`${BASE}/${H.code}/h`, null, true);     // clear the retained state
  setTimeout(() => H.mq?.close(), 300);
  clearInterval(H.heartbeat); clearInterval(H.tick);
  Object.assign(H, {mq: null, code: null, members: new Map(), votes: {}, vote: null, status: 'uit'});
  NET.active = false; NET.tallies = null; NET.members = [];
  refresh();
}
export function joinLink() {
  if (!H.code) return '';
  const i = BROKERS.indexOf(H.broker), u = new URL(location.href);
  u.search = ''; u.hash = `raad=${H.code}&b=${i >= 0 ? i : encodeURIComponent(H.broker)}`;
  return u.toString();
}

// Room codes are visible to anyone on a public broker, so everything an advisor sends is
// untrusted: names are shown as plain text only, and the council has a maximum size.
const MAX_MEMBERS = 30;
function fromAdvisor(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || m.id.length > 40) return;
  if (m.t === 'bye') { if (H.members.delete(m.id)) { NET.members = [...H.members.values()].map(x => x.name); push(true); refresh(); } return; }
  const was = H.members.get(m.id);
  if (!was && H.members.size >= MAX_MEMBERS) return;
  const name = String(m.name || '').slice(0, 24).trim() || 'Adviseur';
  H.members.set(m.id, {name, seen: Date.now()});
  if (!was) { UI.toast('Adviesraad', `${name} doet mee.`, 'good'); push(true); }
  if (m.t === 'vote' && H.vote && m.key === H.vote.key && Array.isArray(m.picks)) {
    const n = H.vote.options.length;
    const picks = [...new Set(m.picks.filter(i => Number.isInteger(i) && i >= 0 && i < n))].slice(0, H.vote.multi ? n : 1);
    (H.votes[m.key] ||= {})[m.id] = picks;
    NET.tallies = tally(m.key);
    NET.onTally?.();
    push(true);
  }
  if (m.t === 'cheer') {
    const now = Date.now();
    if (now - (H.lastCheer[m.id] || 0) < 4000) return;
    H.lastCheer[m.id] = now;
    NET.cheers = (NET.cheers || 0) + 1;
    if (W.L && G.hp > 0) { healPlayer(8); UI.number(P.x, P.y + 2.3, P.z, `+8 · ${name}`, '#8fe0a0', true); }
    UI.toast('Steun van de raad', `${name} gelooft in je.`, 'good');
    SFX.play('pip');
    push(true);
  }
  NET.members = [...H.members.values()].map(x => x.name);
  refresh();
}
function prune() { const now = Date.now(); for (const [id, x] of H.members) if (now - x.seen > 70000) H.members.delete(id); NET.members = [...H.members.values()].map(x => x.name); }
function tally(key) {
  const ballots = Object.values(H.votes[key] || {}).filter(v => v.length);
  const n = H.vote?.key === key ? H.vote.options.length : 0;
  return {id: key, counts: Array.from({length: n}, (_, i) => ballots.filter(v => v.includes(i)).length), ballots: ballots.length};
}
function snapshot() {
  const zn = W.L ? W.L.zoneAt(tileOf(P.x), tileOf(P.z)) : null, q = W.L ? tracked() : null;
  return {
    t: 'state', v: 1, code: H.code,
    place: zn?.name || W.L?.def.name || 'Het stadhuis', depth: W.L?.def.depth || '',
    hp: Math.max(0, Math.round(G.hp)), maxHp: G.maxHp, quest: q ? {title: q.title, text: q.text} : null,
    members: [...H.members.values()].map(x => x.name),
    vote: H.vote ? {key: H.vote.key, question: H.vote.question, options: H.vote.options, multi: H.vote.multi} : null,
    tally: H.vote ? tally(H.vote.key) : null,
    ended: G.verdict ? {title: G.verdict.title || null, choice: G.verdict.choice, judgement: G.verdict.judgement} : null,
  };
}
function push(force) {
  if (!H.mq) return;
  const s = snapshot(), key = JSON.stringify({...s, hp: Math.round(s.hp / 5)});
  if (!force && key === H.last) return;
  H.last = key;
  H.mq.publish(`${BASE}/${H.code}/h`, {...s, at: Date.now()}, true);
}
NET.openVote = (key, question, options, multi) => { H.vote = {key, question, options, multi}; H.votes[key] = {}; NET.tallies = tally(key); push(true); };
NET.closeVote = () => { H.vote = null; push(true); };
NET.publish = () => push(true);

// ---------------------------------------------------------------- host UI
function refresh() {
  const b = $('councilBadge');
  if (b) { b.hidden = !NET.active; b.classList.toggle('off', H.status !== 'verbonden'); $('councilText').textContent = `Adviesraad · ${H.members.size}`; }
  if (!$('councilModal').hidden) renderHost();
}
export function openCouncil() {
  if (GAME.mode === 'play') { GAME.modal = 'council'; unlockForUi(); }
  $('councilModal').hidden = false;
  renderHost();
}
function renderHost() {
  const body = $('councilBody');
  body.innerHTML = '';
  if (!H.mq) {
    body.append(el('div', {class: 'prose'},
      el('p', {text: 'Met de adviesraad spelen jullie samen: één persoon loopt door het Gewelf (bijvoorbeeld op het grote scherm), de anderen doen mee op hun telefoon. Bij elke afweging stemmen de adviseurs mee, en in gevechten kunnen ze steun sturen.'}),
      el('p', {html: '<small>Berichten gaan via een openbare MQTT-server, zonder account. Deel er geen persoonsgegevens in; gebruik een voornaam of bijnaam. Wil je organisatie een eigen server? Zie <code>orakel/relay</code> in de repository en start het spel met <code>?broker=wss://…</code>.</small>'}),
      el('div', {class: 'tbtns'}, el('button', {class: 'go', onclick: () => startCouncil()}, 'Start de adviesraad')),
      H.status !== 'uit' ? el('p', {class: 'label', text: H.status}) : null));
    return;
  }
  const link = joinLink();
  const cv = el('canvas', {width: 440, height: 440});
  QRCode.toCanvas(cv, link, {width: 440, margin: 1, color: {dark: '#1a120a', light: '#ffffff'}}).catch(() => {});
  body.append(el('div', {class: 'council'}, cv,
    el('div', {style: 'display:grid;gap:10px'},
      el('div', {class: 'label', text: 'Code'}), el('div', {class: 'code', text: H.code}),
      el('p', {style: 'margin:0;font-family:var(--f-body);font-size:16px', text: 'Scan de QR-code, of open deze link op een telefoon:'}),
      el('input', {type: 'text', readonly: true, value: link, style: 'width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.35);color:var(--parch);font-size:12px;user-select:text', onclick: e => e.target.select()}),
      el('div', {class: 'tbtns'}, el('button', {class: 'btn', onclick: () => navigator.clipboard?.writeText(link)}, 'Kopieer link'), el('button', {class: 'btn', onclick: () => stopCouncil()}, 'Stop de raad')),
      el('div', {class: 'label', text: `Status: ${H.status} · ${hostOf(H.broker)}`}),
      el('div', {class: 'label', text: `Adviseurs (${H.members.size})`}),
      el('div', {class: 'members'}, ...(H.members.size ? [...H.members.values()].map(m => el('span', {class: 'member', text: m.name})) : [el('span', {class: 'label', text: 'Nog niemand. Deel de code!'})])))));
}
UI.councilHost = () => openCouncil();
UI.refreshCouncil = refresh;

// ---------------------------------------------------------------- advisor (phone)
export function startAdvisor(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = (params.get('raad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const b = params.get('b');
  const broker = customBroker() || (b !== null && /^\d+$/.test(b) ? BROKERS[+b] : b ? decodeURIComponent(b) : BROKERS[0]);
  document.getElementById('title').hidden = true;
  const root = document.getElementById('advisor');
  root.hidden = false;
  const A = {mq: null, state: null, picks: new Set(), votedKey: null, cheerT: 0, id: null, name: ''};
  try { A.id = sessionStorage.getItem('orakel-raad-id'); } catch (e) { /* none */ }
  if (!A.id) { A.id = 'a' + Math.random().toString(36).slice(2, 12); try { sessionStorage.setItem('orakel-raad-id', A.id); } catch (e) { /* none */ } }
  try { A.name = localStorage.getItem('orakel-raad-naam') || ''; } catch (e) { /* none */ }
  const send = m => A.mq?.publish(`${BASE}/${code}/a`, {...m, id: A.id, name: A.name});

  // Re-render only when something visible changed, and keep the scroll position, so a
  // state update never swallows a tap or jumps the page while someone is reading.
  let shown = '';
  const update = m => { const key = JSON.stringify({...m, at: 0}); if (key === shown) return; shown = key; A.state = m; view(); };
  const view = () => { const y = root.scrollTop; render(); root.scrollTop = y; };   // #advisor is the scroll container
  const render = () => {
    root.innerHTML = '';
    const wrap = el('div', {class: 'adv'});
    root.append(wrap);
    wrap.append(el('div', {class: 'eyebrow', text: 'Het Orakel van Dalwijk · adviesraad'}));
    if (!A.mq) {
      wrap.append(el('h1', {text: `Doe mee met raad ${code}`}),
        el('p', {class: 'prose', style: 'margin:0', text: 'Iemand loopt door het Gewelf onder het stadhuis. Jij denkt mee: bij elke afweging stem je op de maatregelen, en in gevechten kun je steun sturen.'}));
      const inp = el('input', {type: 'text', placeholder: 'Je voornaam of een bijnaam', value: A.name, maxlength: 24});
      const status = el('p', {class: 'label'});
      wrap.append(inp, el('button', {class: 'go', onclick: async () => {
        A.name = inp.value.trim().slice(0, 24) || 'Adviseur';
        try { localStorage.setItem('orakel-raad-naam', A.name); } catch (e) { /* none */ }
        status.textContent = `Verbinden met ${hostOf(broker)}…`;
        const mq = new Mqtt(broker);
        try { await mq.connect(); } catch (e) { status.textContent = 'Geen verbinding. Controleer de code en je internet, en probeer het opnieuw.'; return; }
        A.mq = mq;
        mq.subscribe(`${BASE}/${code}/h`);
        mq.onMessage = (t, m) => { if (m.t === 'end') { A.state = {...(A.state || {}), closed: true}; shown = ''; view(); return; } if (m.t === 'state') update(m); };
        mq.onReconnect = () => send({t: 'hi'});
        send({t: 'hi'});
        setInterval(() => send({t: 'hi'}), 20000);
        addEventListener('pagehide', () => send({t: 'bye'}));
        view();
      }}, 'Doe mee'), status, el('p', {html: '<small>Je naam en stemmen gaan via een openbare server naar het spel. Deel geen persoonsgegevens.</small>'}));
      return;
    }
    const s = A.state;
    if (!s) { wrap.append(el('h1', {text: `Raad ${code}`}), el('p', {class: 'prose', text: 'Verbonden. Wachten op de speler…'})); return; }
    if (s.closed) { wrap.append(el('h1', {text: 'De raad is gesloten'}), el('p', {class: 'prose', text: 'Dank je wel voor het meedenken!'})); return; }
    wrap.append(el('h1', {text: s.place}), el('div', {class: 'label', text: `${s.depth || ''} · raad ${code} · ${s.members?.length || 0} adviseurs`}));
    wrap.append(el('div', {class: 'trust'}, el('span', {class: 'ico', text: '❤'}), el('div', {class: 'bar'}, el('i', {style: `transform:scaleX(${Math.max(0, Math.min(1, s.hp / s.maxHp))})`})), el('b', {text: `${s.hp}/${s.maxHp}`})));
    if (s.quest) wrap.append(el('div', {class: 'quest'}, el('h4', {text: s.quest.title}), el('p', {text: s.quest.text})));
    if (s.ended && s.ended.choice !== undefined) wrap.append(el('div', {class: 'verdictbox'}, el('h3', {text: 'Het besluit is bezegeld'}), el('p', {text: ['Niet met AI', 'Eerst verder onderzoeken', 'Een begrensde pilot', 'Invoeren met waarborgen'][s.ended.choice] || ''})));
    if (s.vote) {
      if (A.votedKey !== s.vote.key && A.lastKey !== s.vote.key) { A.picks = new Set(); A.lastKey = s.vote.key; }
      const box = el('div', {class: 'opts'});
      s.vote.options.forEach((o, i) => box.append(el('button', {class: 'optb', 'aria-pressed': String(A.picks.has(i)), onclick: () => { if (s.vote.multi) { A.picks.has(i) ? A.picks.delete(i) : A.picks.add(i); } else A.picks = new Set([i]); view(); }},
        el('span', {class: 'box', text: A.picks.has(i) ? '✓' : ''}), el('span', {text: o}), el('span', {class: 'votes', text: s.tally ? `${s.tally.counts[i] || 0}` : ''}))));
      wrap.append(el('div', {class: 'q', style: 'font-family:var(--f-display);font-size:18px;color:var(--gold-hi)', text: s.vote.question}),
        el('p', {class: 'label', style: 'margin:0', text: s.vote.multi ? 'Kies alle maatregelen die volgens jou passen.' : 'Kies één besluit.'}), box,
        el('button', {class: 'go', onclick: () => { send({t: 'vote', key: s.vote.key, picks: [...A.picks]}); A.votedKey = s.vote.key; SFX.play?.('pick'); view(); }}, A.votedKey === s.vote.key ? 'Stem bijwerken' : 'Stem'),
        A.votedKey === s.vote.key ? el('p', {class: 'label', text: `Je stem is verstuurd · ${s.tally?.ballots || 0} stemmen binnen`}) : null);
    } else wrap.append(el('p', {class: 'prose', style: 'margin:0', text: 'Op dit moment is er niets om over te stemmen. Zodra de speler bij een hoeder een afweging maakt, verschijnt die hier.'}));
    const wait = Math.max(0, 5 - (Date.now() - A.cheerT) / 1000);
    wrap.append(el('button', {class: 'btn cheer', disabled: wait > 0, onclick: () => { A.cheerT = Date.now(); send({t: 'cheer'}); view(); setTimeout(view, 5100); }}, wait > 0 ? 'Steun verstuurd ✓' : 'Stuur steun ❤'));
  };
  view();
}
void esc;
