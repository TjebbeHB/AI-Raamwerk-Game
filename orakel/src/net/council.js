// The online advisory council. One person plays; advisors join on their phones with a
// room code, get a role at the table (see content/roles.js), vote on every decision and send
// support in fights. Messages travel through an MQTT broker over WebSockets, so the game itself
// stays a static page.
// Default: public test brokers (no account needed). Organisations can run their own:
// any MQTT broker with WebSockets, or orakel/relay/broker.mjs, via ?broker=wss://…
//
// Protocol (topic gewelf-orakel/v1/<code>/h, retained, from the game): {t: 'state', …, members,
// seats: [{n: name, r: role id | null, k: seat tag, v?: 1 when voted}], vote: {key, question,
// options, multi, n}, tally: {id, counts, ballots, byRole?}}. Topic …/a, from the phones:
// {t: 'hi' | 'vote' | 'cheer' | 'bye', id, name, key?, picks?}. Fields a side does not know are
// ignored, so phones and games of different versions still understand each other.
import QRCode from 'qrcode';
import {Mqtt} from './mqtt.js';
import {NET, UI, SFX, P} from '../game/bus.js';
import {G, saveGame} from '../game/state.js';
import {W} from '../game/world.js';
import {tracked} from '../game/quests.js';
import {healPlayer} from '../game/player.js';
import {$, el, tileOf, hashString, addStyles} from '../core/util.js';
import {GAME} from '../game/game.js';
import {unlockForUi} from '../game/dialogue.js';
import {ROLES, roleById, roleNote, dealOrder, nextRole, dealAll, tallyBallots, readSeats, readByRole} from '../content/roles.js';

export const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const BASE = 'gewelf-orakel/v1';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHA[b % ALPHA.length]).join('');
const hostOf = url => { try { return new URL(url).host; } catch (e) { return url; } };
const customBroker = () => new URLSearchParams(location.search).get('broker');
// A phone finds its own seat by this tag, so the retained state never carries advisor ids.
export const seatTag = id => hashString(`zetel:${id}`).toString(36);
const tint = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const roleVars = r => (r ? `--role:${r.color};--role-soft:${tint(r.color, 0.13)};--role-line:${tint(r.color, 0.55)}` : '');
const asRole = r => r.name.replace(/ \(.*\)$/, '').toLowerCase();       // 'Privacy-officer (FG)' -> 'privacy-officer'

// What the decision panel and the debrief read: who is who (no agendas, those stay on the phones).
NET.roles = ROLES.map(({id, name, short, icon, color}) => ({id, name, short, icon, color}));
NET.seats = [];
NET.rolesOn = true;

// ---------------------------------------------------------------- host
const H = {mq: null, code: null, broker: null, members: new Map(), votes: {}, vote: null, voteN: 0, lastCheer: {}, last: '', heartbeat: null, tick: null, status: 'uit',
  rolesOn: true, deck: dealOrder(), past: new Map(), shown: ''};

export async function startCouncil() {
  if (H.mq) return;
  H.code = randomCode();
  H.deck = dealOrder(); H.past = new Map();
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
  H.heartbeat = setInterval(() => { prune(); push(true); refresh(); }, 12000);
  H.tick = setInterval(() => push(false), 1000);
  push(true);
  refresh();
  SFX.play('quest');
}
export function stopCouncil() {
  if (!H.mq) return;
  H.mq.publish(`${BASE}/${H.code}/h`, {t: 'end', code: H.code});
  H.mq.publish(`${BASE}/${H.code}/h`, null, true);     // clear the retained state
  const mq = H.mq;
  setTimeout(() => mq.close(), 300);
  clearInterval(H.heartbeat); clearInterval(H.tick);
  Object.assign(H, {mq: null, code: null, members: new Map(), votes: {}, vote: null, past: new Map(), status: 'uit'});
  NET.active = false; NET.tallies = null;
  sync();
  refresh();
}
export function joinLink() {
  if (!H.code) return '';
  const i = BROKERS.indexOf(H.broker), u = new URL(location.href);
  u.search = ''; u.hash = `raad=${H.code}&b=${i >= 0 ? i : encodeURIComponent(H.broker)}`;
  return u.toString();
}

// Room codes are visible to anyone on a public broker, so everything an advisor sends is
// untrusted: names are shown as plain text only, the council has a maximum size, and roles are
// only ever dealt here (a phone cannot choose or claim one).
const MAX_MEMBERS = 30;
function fromAdvisor(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id || m.id.length > 40) return;
  if (m.t === 'bye') { if (H.members.delete(m.id)) { sync(); push(true); refresh(); } return; }
  const was = H.members.get(m.id);
  if (!was && H.members.size >= MAX_MEMBERS) return;
  const name = String(m.name || '').slice(0, 24).trim() || 'Adviseur';
  const me = {name, seen: Date.now(), role: was?.role || seatFor(m.id), tag: was?.tag || seatTag(m.id)};
  H.members.set(m.id, me);
  if (!was) {
    const r = H.rolesOn && roleById(me.role);
    UI.toast('Adviesraad', r ? `${name} schuift aan als ${asRole(r)}\u00a0${r.icon}` : `${name} doet mee.`, 'good');
    sync(); push(true);
  }
  if (m.t === 'vote' && H.vote && m.key === H.vote.key && Array.isArray(m.picks)) {
    const n = H.vote.options.length;
    const picks = [...new Set(m.picks.filter(i => Number.isInteger(i) && i >= 0 && i < n))].slice(0, H.vote.multi ? n : 1);
    // the role is the one this advisor held when voting, so a later re-deal does not rewrite history
    (H.votes[m.key] ||= {})[m.id] = {picks, role: H.rolesOn ? me.role : null};
    NET.tallies = tally(m.key);
    soon();
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
  if (was && was.name !== name) sync();
  refresh();
}
// Votes can arrive in bursts (or floods: room codes are public), so the panel and the phones hear
// about them at most every 150 ms; the tally itself is always up to date.
let soonT = 0;
function soon() {
  if (soonT) return;
  soonT = setTimeout(() => { soonT = 0; NET.onTally?.(); push(true); refresh(); }, 150);
}
// A newcomer gets back the role they had before a reconnect, otherwise the least-dealt one.
function seatFor(id) {
  const role = H.past.get(id) || nextRole([...H.members.values()].map(x => x.role), H.deck);
  H.past.set(id, role);
  return role;
}
function sync() {
  const list = [...H.members.values()];
  NET.members = list.map(x => x.name);
  NET.seats = list.map(x => ({name: x.name, role: H.rolesOn ? x.role : null}));
  NET.rolesOn = H.rolesOn;
}
function prune() { const now = Date.now(); for (const [id, x] of H.members) if (now - x.seen > 70000) H.members.delete(id); sync(); }
function tally(key) {
  const n = H.vote?.key === key ? H.vote.options.length : 0;
  return {id: key, ...tallyBallots(Object.values(H.votes[key] || {}), n, H.rolesOn)};
}
const hasVoted = id => !!(H.vote && H.votes[H.vote.key]?.[id]?.picks.length);
function snapshot() {
  const zn = W.L ? W.L.zoneAt(tileOf(P.x), tileOf(P.z)) : null, q = W.L ? tracked() : null;
  return {
    t: 'state', v: 1, code: H.code,
    place: zn?.name || W.L?.def.name || 'Het stadhuis', depth: W.L?.def.depth || '',
    hp: Math.max(0, Math.round(G.hp)), maxHp: G.maxHp, quest: q ? {title: q.title, text: q.text} : null,
    members: [...H.members.values()].map(x => x.name),
    seats: [...H.members.entries()].map(([id, x]) => ({n: x.name, r: H.rolesOn ? x.role : null, k: x.tag, ...(hasVoted(id) ? {v: 1} : {})})),
    vote: H.vote ? {key: H.vote.key, question: H.vote.question, options: H.vote.options, multi: H.vote.multi, n: H.vote.n} : null,
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
NET.openVote = (key, question, options, multi) => {
  H.vote = {key, question, options, multi, n: ++H.voteN, prev: G.council?.[key]};
  H.votes[key] = {};
  NET.tallies = tally(key);
  push(true); refresh();
};
NET.closeVote = () => {
  const v = H.vote;
  // Keep what the council advised with the save, for the debrief, unless the decision panel
  // already stored its own copy while this vote was open.
  if (v && H.mq && G.council && G.council[v.key] === v.prev) {
    const t = tally(v.key);
    if (t.ballots) {
      G.council[v.key] = {counts: t.counts, ballots: t.ballots, ...(t.byRole ? {byRole: t.byRole} : {}), at: Date.now()};
      if (GAME.mode === 'play') saveGame();
    }
  }
  H.vote = null;
  push(true); refresh();
};
NET.publish = () => push(true);
// Roles, from the host's council panel (or tests): a fresh deal, one seat, or no roles at all.
NET.redeal = () => {
  H.deck = dealOrder();
  const ids = [...H.members.keys()], roles = dealAll(ids.length, H.deck);
  ids.forEach((id, i) => { H.members.get(id).role = roles[i]; H.past.set(id, roles[i]); });
  sync(); push(true); refresh();
};
function setRoleOf(id, roleId) {
  const m = H.members.get(id), r = roleById(roleId);
  if (!m || !r) return false;
  m.role = r.id; H.past.set(id, r.id);
  sync(); push(true); refresh();
  return true;
}
NET.setRole = (index, roleId) => setRoleOf([...H.members.keys()][index], roleId);
NET.useRoles = on => {
  H.rolesOn = !!on;
  if (H.vote) NET.tallies = tally(H.vote.key);
  sync(); push(true); refresh();
  NET.onTally?.();
};

// ---------------------------------------------------------------- host UI
function hostKey() {
  return JSON.stringify([H.code, H.status, H.broker, H.rolesOn, H.vote?.n, [...H.members.entries()].map(([id, m]) => [m.name, m.role, hasVoted(id)])]);
}
function refresh() {
  const b = $('councilBadge');
  if (b) { b.hidden = !NET.active; b.classList.toggle('off', H.status !== 'verbonden'); $('councilText').textContent = `Adviesraad · ${H.members.size}`; }
  // Re-render only when something visible changed: phones say hello every 20 s, and a rebuild
  // would close a role menu the host has open.
  if (!$('councilModal').hidden && hostKey() !== H.shown) renderHost();
}
export function openCouncil() {
  if (GAME.mode === 'play') { GAME.modal = 'council'; unlockForUi(); }
  $('councilModal').hidden = false;
  renderHost();
}
const rolesToggle = () => el('button', {class: 'btn', 'aria-pressed': String(H.rolesOn), onclick: () => NET.useRoles(!H.rolesOn)}, H.rolesOn ? '✓ Spelen met rollen' : 'Spelen met rollen');
function renderHost() {
  H.shown = hostKey();
  const body = $('councilBody');
  body.innerHTML = '';
  if (!H.mq) {
    body.append(el('div', {class: 'prose'},
      el('p', {text: 'Met de adviesraad spelen jullie samen: één persoon loopt door het Gewelf (bijvoorbeeld op het grote scherm), de anderen doen mee op hun telefoon. Bij elke afweging stemmen de adviseurs mee, en in gevechten kunnen ze steun sturen.'}),
      el('p', {text: 'Iedere adviseur krijgt een rol aan tafel, zoals de inwoner, de jurist of de bestuurder: met een eigen invalshoek, een stopwoordje en een geheime agenda. Zo wordt stemmen een gesprek.'}),
      el('p', {html: '<small>Berichten gaan via een openbare MQTT-server, zonder account. Deel er geen persoonsgegevens in; gebruik een voornaam of bijnaam. Wil je organisatie een eigen server? Zie <code>orakel/relay</code> in de repository en start het spel met <code>?broker=wss://…</code>.</small>'}),
      el('div', {class: 'tbtns'}, el('button', {class: 'go', onclick: () => startCouncil()}, 'Start de adviesraad'), rolesToggle()),
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
      el('input', {type: 'text', readonly: true, value: link, 'aria-label': 'Link voor de telefoon', style: 'width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.35);color:var(--parch);font-size:12px;user-select:text', onclick: e => e.target.select()}),
      el('div', {class: 'tbtns'}, el('button', {class: 'btn', onclick: () => navigator.clipboard?.writeText(link)}, 'Kopieer link'), el('button', {class: 'btn', onclick: () => stopCouncil()}, 'Stop de raad')),
      el('div', {class: 'label', text: `Status: ${H.status} · ${hostOf(H.broker)}`}))),
    seatsPanel());
}
function seatsPanel() {
  const ms = [...H.members.entries()];
  const voting = H.vote ? ms.filter(([id]) => hasVoted(id)).length : null;
  const box = el('section', {class: 'hseats', 'aria-label': 'Adviseurs aan tafel'},
    el('div', {class: 'hs-head'},
      el('div', {class: 'label', text: `Aan tafel · ${ms.length}${voting !== null ? ` · ${voting} gestemd` : ''}`}),
      el('div', {class: 'tbtns'}, H.rolesOn && ms.length ? el('button', {class: 'btn', onclick: () => NET.redeal()}, 'Verdeel de rollen opnieuw') : null, rolesToggle())));
  if (!ms.length) { box.append(el('p', {class: 'hs-empty', text: H.rolesOn ? 'Nog niemand. Deel de code! Wie meedoet, krijgt vanzelf een rol: de eerste adviseurs allemaal een andere.' : 'Nog niemand. Deel de code!'})); return box; }
  const grid = el('div', {class: 'hs-grid'});
  for (const [id, m] of ms) {
    const r = H.rolesOn ? roleById(m.role) : null;
    grid.append(el('div', {class: 'hs-seat', style: roleVars(r)},
      el('span', {class: 'role-ic', 'aria-hidden': 'true', text: r ? r.icon : '👤'}),
      el('div', {class: 'hs-who'}, el('b', {text: m.name}), el('span', {class: `hs-st${hasVoted(id) ? ' ok' : ''}`, text: hasVoted(id) ? '✓ heeft gestemd' : H.vote ? 'denkt nog na…' : r ? `“${r.line}”` : 'adviseur'})),
      r ? el('select', {'aria-label': `Rol van ${m.name}`, onchange: e => setRoleOf(id, e.target.value)},
        ROLES.map(x => el('option', {value: x.id, selected: x.id === m.role}, `${x.icon} ${x.name}`))) : null));
  }
  box.append(grid);
  if (H.rolesOn) box.append(el('details', {class: 'hs-legend'}, el('summary', {text: 'Wat de rollen doen'}),
    el('div', {class: 'hs-roles'}, ROLES.map(r => el('div', {class: 'hs-role', style: roleVars(r)}, el('span', {class: 'role-ic', 'aria-hidden': 'true', text: r.icon}), el('p', {}, el('b', {text: r.name}), ` · ${r.mission}`)))),
    el('p', {class: 'hs-empty', text: 'De geheime agenda’s staan alleen op de telefoons. Na het besluit worden ze onthuld.'})));
  return box;
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
  const A = {mq: null, state: null, picks: new Set(), votedKey: null, lastKey: null, cheerT: 0, id: null, name: '', tag: '',
    seats: null, mine: null, role: null, deal: false, cardOpen: null, agendaOpen: false, seen: new Map(), reveal: null};
  try { A.id = sessionStorage.getItem('orakel-raad-id'); } catch (e) { /* none */ }
  if (!A.id) { A.id = 'a' + Math.random().toString(36).slice(2, 12); try { sessionStorage.setItem('orakel-raad-id', A.id); } catch (e) { /* none */ } }
  try { A.name = localStorage.getItem('orakel-raad-naam') || ''; } catch (e) { /* none */ }
  A.tag = seatTag(A.id);
  const send = m => A.mq?.publish(`${BASE}/${code}/a`, {...m, id: A.id, name: A.name});

  // Re-render only when something visible changed, and keep the scroll position, so a
  // state update never swallows a tap or jumps the page while someone is reading.
  let shown = '';
  const update = m => {
    const key = JSON.stringify({...m, at: 0}); if (key === shown) return; shown = key;
    A.state = m;
    A.seats = readSeats(m.seats);
    A.mine = A.seats?.find(s => s.tag === A.tag) || null;
    // everyone who held a role at this table, also after they left, for the reveal at the end
    for (const x of A.seats || []) if (x.role) A.seen.set(x.tag || x.name, x);
    if (m.ended && !A.reveal && A.seen.size) A.reveal = [...A.seen.values()];
    const role = A.mine?.role || null;
    if (role !== A.role) {
      if (role) { A.deal = true; try { navigator.vibrate?.(35); } catch (e) { /* not on this phone */ } }
      A.role = role; A.cardOpen = null; A.agendaOpen = false;
    }
    view();
  };
  const view = () => { const y = root.scrollTop; render(); root.scrollTop = y; };   // #advisor is the scroll container
  const render = () => {
    root.innerHTML = '';
    const wrap = el('div', {class: 'adv'});
    root.append(wrap);
    wrap.append(el('div', {class: 'eyebrow', text: 'Het Orakel van Dalwijk · adviesraad'}));
    if (!A.mq) { joinScreen(wrap); return; }
    const s = A.state;
    if (!s) { wrap.append(el('h1', {text: `Raad ${code}`}), el('p', {class: 'prose', text: 'Verbonden. Wachten op de speler…'})); return; }
    if (s.closed) {
      const r = roleById(A.role);
      wrap.append(el('h1', {text: 'De raad is gesloten'}), el('p', {class: 'prose', text: r ? `Dank je wel voor het meedenken als ${asRole(r)}\u00a0${r.icon}!` : 'Dank je wel voor het meedenken!'}));
      if (A.seen.size) wrap.append(agendas(A.reveal || [...A.seen.values()]));
      return;
    }
    wrap.append(el('h1', {text: String(s.place || 'Het Gewelf')}), el('div', {class: 'label', text: `${s.depth || ''} · raad ${code} · ${Array.isArray(s.members) ? s.members.length : 0} adviseurs`}));
    const hp = +s.hp || 0, max = +s.maxHp || 100;
    wrap.append(el('div', {class: 'trust'}, el('span', {class: 'ico', text: '❤'}), el('div', {class: 'bar'}, el('i', {style: `transform:scaleX(${Math.max(0, Math.min(1, hp / max))})`})), el('b', {text: `${Math.round(hp)}/${Math.round(max)}`})));
    const vote = s.vote && typeof s.vote === 'object' && Array.isArray(s.vote.options) ? s.vote : null;
    const ended = !!(s.ended && s.ended.choice !== undefined);
    // after the verdict the reveal of the agendas leads; before it, your role and the vote
    if (ended) {
      wrap.append(el('div', {class: 'verdictbox'}, el('h3', {text: 'Het besluit is bezegeld'}), el('p', {text: ['Niet met AI', 'Eerst verder onderzoeken', 'Een begrensde pilot', 'Invoeren met waarborgen'][s.ended.choice] || ''})));
      if (A.seen.size) wrap.append(agendas(A.reveal || [...A.seen.values()]));
    }
    if (A.role || (A.seats && !A.mine && A.seats.some(x => x.role))) wrap.append(roleCard(!!vote || ended));
    if (s.quest && !vote && !ended) wrap.append(el('div', {class: 'quest'}, el('h4', {text: String(s.quest.title || '')}), el('p', {text: String(s.quest.text || '')})));
    if (vote) voteBlock(wrap, s, vote);
    else wrap.append(el('p', {class: 'prose', style: 'margin:0', text: ended ? 'Het besluit is genomen. Op het grote scherm zie je wat er een jaar later van terechtkwam.'
      : A.role ? 'Op dit moment is er niets om over te stemmen. Lees je rol alvast door: zodra de speler bij een hoeder een afweging maakt, verschijnt die hier, met waar jouw rol op let.'
        : 'Op dit moment is er niets om over te stemmen. Zodra de speler bij een hoeder een afweging maakt, verschijnt die hier.'}));
    if (A.seats?.length) wrap.append(table(!!vote));
    const wait = Math.max(0, 5 - (Date.now() - A.cheerT) / 1000);
    wrap.append(el('button', {class: 'btn cheer', disabled: wait > 0, onclick: () => { A.cheerT = Date.now(); send({t: 'cheer'}); view(); setTimeout(view, 5100); }}, wait > 0 ? 'Steun verstuurd ✓' : 'Stuur steun ❤'));
  };

  const joinScreen = wrap => {
    wrap.append(el('h1', {text: `Doe mee met raad ${code}`}),
      el('p', {class: 'prose', style: 'margin:0', text: 'Iemand loopt door het Gewelf onder het stadhuis. Jij denkt mee: bij elke afweging stem je op de maatregelen, en in gevechten kun je steun sturen.'}),
      el('p', {class: 'adv-teaser', text: 'Je krijgt waarschijnlijk ook een rol aan tafel: inwoner, jurist, bestuurder of een van de anderen. Met een eigen invalshoek, en een geheime agenda.'}));
    const inp = el('input', {type: 'text', placeholder: 'Je voornaam of een bijnaam', value: A.name, maxlength: 24, 'aria-label': 'Je naam'});
    const status = el('p', {class: 'label', role: 'status'});
    wrap.append(inp, el('button', {class: 'go', onclick: async () => {
      A.name = inp.value.trim().slice(0, 24) || 'Adviseur';
      try { localStorage.setItem('orakel-raad-naam', A.name); } catch (e) { /* none */ }
      status.textContent = `Verbinden met ${hostOf(broker)}…`;
      const mq = new Mqtt(broker);
      try { await mq.connect(); } catch (e) { status.textContent = 'Geen verbinding. Controleer de code en je internet, en probeer het opnieuw.'; return; }
      A.mq = mq;
      mq.subscribe(`${BASE}/${code}/h`);
      mq.onMessage = (t, m) => { if (!m || typeof m !== 'object') return; if (m.t === 'end') { A.state = {...(A.state || {}), closed: true}; shown = ''; view(); return; } if (m.t === 'state') update(m); };
      mq.onReconnect = () => send({t: 'hi'});
      send({t: 'hi'});
      setInterval(() => send({t: 'hi'}), 20000);
      addEventListener('pagehide', () => send({t: 'bye'}));
      view();
    }}, 'Doe mee'), status, el('p', {html: '<small>Je naam en stemmen gaan via een openbare server naar het spel. Deel geen persoonsgegevens.</small>'}));
  };

  // Your seat: who you are at the table. Folded during a vote (unless you open it), so the question stays in view.
  const roleCard = voting => {
    const r = roleById(A.role);
    if (!r) return el('section', {class: 'rolecard waiting', 'aria-live': 'polite'}, el('span', {class: 'role-ic', 'aria-hidden': 'true', text: '🎴'}), el('p', {text: 'Je rol wordt verdeeld…'}));
    const open = A.cardOpen ?? !voting;
    const card = el('section', {class: `rolecard${A.deal ? ' dealt' : ''}`, style: roleVars(r), 'data-role': r.id, 'data-icon': r.icon, 'aria-label': `Jouw rol: ${r.name}`},
      el('button', {class: 'rc-head', 'aria-expanded': String(open), onclick: () => { A.cardOpen = !open; view(); }},
        el('span', {class: 'role-ic', 'aria-hidden': 'true', text: r.icon}),
        el('span', {class: 'rc-t'}, el('small', {text: 'Jouw rol'}), el('b', {text: r.name})),
        el('span', {class: 'chev', 'aria-hidden': 'true', text: open ? '▴' : '▾'})));
    A.deal = false;
    if (!open) return card;
    card.append(el('div', {class: 'rc-body'},
      el('p', {class: 'rc-mission', text: r.mission}),
      el('p', {class: 'rc-line'}, el('span', {class: 'label', text: 'Je stopwoordje'}), el('q', {text: r.line})),
      el('button', {class: `rc-agenda${A.agendaOpen ? ' open' : ''}`, 'aria-expanded': String(A.agendaOpen), onclick: () => { A.agendaOpen = !A.agendaOpen; view(); }},
        el('span', {class: 'rc-a-h'}, el('span', {'aria-hidden': 'true', text: '🤫 '}), 'Je geheime agenda', el('small', {text: A.agendaOpen ? 'tik om te verbergen' : 'tik om te lezen'})),
        A.agendaOpen ? el('span', {class: 'rc-a-t', text: r.agenda}) : null),
      el('p', {class: 'rc-how', text: 'Kijk bij elke afweging door de ogen van je rol en stem zoals die zou stemmen. Je agenda mag doorschemeren, maar verklap hem niet.'})));
    return card;
  };

  const voteBlock = (wrap, s, vote) => {
    const key = String(vote.key ?? ''), round = `${key}#${vote.n ?? ''}`, opts = vote.options.slice(0, 12).map(o => String(o));
    if (A.lastKey !== round) { A.picks = new Set(); A.lastKey = round; A.votedKey = null; }
    // the host's seat list says whether this vote has your ballot; older hosts do not send it
    const voted = A.votedKey === round || !!A.mine?.voted;
    const counts = Array.isArray(s.tally?.counts) ? s.tally.counts : [];
    const byRole = voted ? readByRole(s.tally?.byRole, opts.length) : null;
    const r = roleById(A.role), note = r ? roleNote(key, r.id) : '';
    wrap.append(el('div', {class: 'q', style: 'font-family:var(--f-display);font-size:19px;line-height:1.3;color:var(--gold-hi)', text: String(vote.question || '')}));
    if (note) wrap.append(el('aside', {class: 'rolenote', style: roleVars(r), 'data-key': key, 'data-role': r.id, 'aria-label': `Jouw invalshoek als ${asRole(r)}`},
      el('div', {class: 'rn-h', 'aria-hidden': 'true'}, el('span', {class: 'role-ic', text: r.icon}), `Jouw invalshoek · ${r.short}`),
      el('p', {text: note})));
    const box = el('div', {class: 'opts'});
    opts.forEach((o, i) => {
      const pickedBy = byRole ? ROLES.filter(x => byRole[x.id]?.counts[i]) : [];
      const who = pickedBy.map(x => `${x.icon}${byRole[x.id].counts[i] > 1 ? `×${byRole[x.id].counts[i]}` : ''}`).join(' ');
      box.append(el('button', {class: 'optb', 'aria-pressed': String(A.picks.has(i)), onclick: () => { if (vote.multi) { A.picks.has(i) ? A.picks.delete(i) : A.picks.add(i); } else A.picks = new Set([i]); view(); }},
        el('span', {class: 'box', text: A.picks.has(i) ? '✓' : ''}),
        el('span', {}, o, who ? el('span', {class: 'who'}, el('span', {class: 'sr', text: `Gekozen door: ${pickedBy.map(x => x.name).join(', ')}.`}), el('span', {'aria-hidden': 'true', text: who})) : null),
        el('span', {class: 'votes', text: voted ? `${+counts[i] || 0}` : ''})));
    });
    const ballots = +s.tally?.ballots || 0;
    wrap.append(el('p', {class: 'label', style: 'margin:0', text: vote.multi ? 'Kies alle maatregelen die volgens jou passen.' : 'Kies één besluit.'}), box,
      el('button', {class: 'go', disabled: !A.picks.size, onclick: () => { send({t: 'vote', key: vote.key, picks: [...A.picks]}); A.votedKey = round; if (A.mine) A.mine.voted = true; SFX.play?.('pick'); view(); }}, voted ? 'Stem bijwerken' : 'Stem'),
      el('p', {class: 'label', style: 'margin:0', text: voted ? `Je stem is verstuurd · ${ballots} ${ballots === 1 ? 'stem' : 'stemmen'} binnen` : `${ballots} ${ballots === 1 ? 'stem' : 'stemmen'} binnen · stem eerst, dan zie je hoe de anderen kozen`}));
  };

  // Who sits at the table, with their roles: handy when you want to ask the jurist something.
  const table = voting => el('section', {class: 'adv-table', 'aria-label': 'Aan tafel'},
    el('div', {class: 'label', text: `Aan tafel · ${A.seats.length}`}),
    el('div', {class: 'chips'}, A.seats.map(x => {
      const r = roleById(x.role);
      return el('span', {class: `chip${x === A.mine ? ' me' : ''}`, style: roleVars(r), title: r ? r.name : ''},
        r ? el('span', {'aria-hidden': 'true', text: r.icon}) : null, el('span', {text: x.name}), r ? el('small', {text: r.short}) : null,
        x === A.mine ? el('small', {class: 'you', text: 'jij'}) : null, voting && x.voted ? el('span', {class: 'ok', 'aria-label': 'heeft gestemd', text: '✓'}) : null);
    })));

  // After the verdict the secret agendas come out, which is half the fun of having had them.
  const agendas = seats => el('section', {class: 'reveal', 'aria-label': 'De geheime agenda’s'},
    el('h3', {text: 'De geheime agenda’s'}),
    el('p', {class: 'rv-intro', text: 'Nu mag het gezegd worden: wie had er stiekem wat in gedachten?'}),
    ...seats.filter(x => x.role).map(x => { const r = roleById(x.role); return el('div', {class: 'rv', style: roleVars(r)}, el('span', {class: 'role-ic', 'aria-hidden': 'true', text: r.icon}), el('p', {}, el('b', {text: `${x.name} · ${r.name}`}), el('br'), r.agenda)); }));

  view();
}

// ---------------------------------------------------------------- styles (host panel and phone)
// Scoped to the council panel (.hseats) and the phone app (.adv), so other screens are unaffected.
addStyles('council-roles', `
.hseats .role-ic,.adv .role-ic{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:21px;line-height:1;background:var(--role-soft,rgba(242,226,196,.08));border:1px solid var(--role-line,var(--line))}
.hseats{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:grid;gap:12px}
.hseats .hs-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.hseats .hs-head .btn{padding:7px 11px;font-size:13px}
.hseats .hs-empty{margin:0;font-size:13px;line-height:1.5;color:var(--dim)}
.hseats .hs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.hseats .hs-seat{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;padding:9px 10px;border-radius:12px;border:1px solid var(--role-line,var(--line));background:linear-gradient(135deg,var(--role-soft,rgba(0,0,0,.2)),rgba(0,0,0,.18) 70%)}
.hseats .hs-seat select{grid-column:1/-1}
.hseats .hs-who{display:grid;min-width:0}
.hseats .hs-who b{font-family:var(--f-display);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hseats .hs-st{font-size:12px;line-height:1.35;color:var(--dim);font-style:italic;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.hseats .hs-st.ok{color:var(--good);font-style:normal}
.hseats select{width:100%;min-width:0;padding:5px 6px;border-radius:7px;border:1px solid var(--line-strong);background:rgba(0,0,0,.4);color:var(--parch);font:inherit;font-size:13px;cursor:pointer}
.hseats .hs-legend summary{cursor:pointer;font-size:13px;color:var(--gold)}
.hseats .hs-roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin:10px 0}
.hseats .hs-role{display:flex;gap:10px;align-items:flex-start}
.hseats .hs-role .role-ic{width:32px;height:32px;font-size:17px}
.hseats .hs-role p{margin:0;font-family:var(--f-body);font-size:15px;line-height:1.35}
.hseats .hs-role b{font-family:var(--f-ui);font-size:13px;color:var(--role)}
.adv{padding-bottom:max(12px,env(safe-area-inset-bottom))}
.adv .eyebrow{font-size:11px;letter-spacing:.26em}
.adv h1{line-height:1.15}
.adv .optb{font-size:17px;padding:12px;min-height:52px}
.adv .optb .box{width:22px;height:22px}
.adv .go{width:100%;padding:14px 18px;font-size:17px}
.adv .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.adv .adv-teaser{margin:0;padding:10px 12px;border-radius:10px;border:1px dashed var(--line-strong);font-family:var(--f-body);font-size:16px;line-height:1.4;color:#eadcbc}
.adv .rolecard{position:relative;isolation:isolate;border-radius:14px;border:1px solid var(--role-line,var(--line));border-left:4px solid var(--role,var(--gold));background:linear-gradient(160deg,var(--role-soft,rgba(242,226,196,.06)),rgba(20,15,10,.82) 65%);box-shadow:0 10px 26px rgba(0,0,0,.35);overflow:hidden}
.adv .rolecard::after{content:attr(data-icon);position:absolute;z-index:-1;right:-18px;top:-26px;font-size:132px;line-height:1;opacity:.08;transform:rotate(14deg);pointer-events:none}
.adv .rolecard.waiting{display:flex;gap:12px;align-items:center;padding:12px 14px;border-left-color:var(--line-strong)}
.adv .rolecard.waiting p{margin:0;font-family:var(--f-body);font-size:17px;color:var(--dim)}
.adv .rolecard.dealt{animation:dealcard .7s cubic-bezier(.2,.9,.3,1.2)}
@keyframes dealcard{0%{transform:perspective(600px) rotateY(80deg) scale(.92);opacity:0}100%{transform:none;opacity:1}}
.adv .rc-head{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;background:none;border:0;text-align:left;cursor:pointer;min-height:64px}
.adv .rc-head .role-ic{width:46px;height:46px;font-size:25px}
.adv .rc-t{flex:1;display:grid;gap:1px;min-width:0}
.adv .rc-t small{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--role,var(--gold))}
.adv .rc-t b{font-family:var(--f-display);font-size:20px;line-height:1.15;color:var(--parch)}
.adv .chev{font-size:14px;color:var(--dim);padding:6px}
.adv .rc-body{display:grid;gap:10px;padding:0 14px 14px}
.adv .rc-mission{margin:0;font-family:var(--f-body);font-size:17px;line-height:1.42}
.adv .rc-line{margin:0;display:grid;gap:2px}
.adv .rc-line q{font-family:var(--f-body);font-style:italic;font-size:18px;color:var(--role,var(--gold-hi))}
.adv .rc-line q::before{content:'“'}.adv .rc-line q::after{content:'”'}
.adv .rc-agenda{display:grid;gap:6px;text-align:left;padding:10px 12px;border-radius:10px;border:1px dashed var(--role-line,var(--line-strong));background:rgba(0,0,0,.28);cursor:pointer}
.adv .rc-agenda.open{border-style:solid;background:rgba(0,0,0,.4)}
.adv .rc-a-h{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;font-family:var(--f-ui);font-size:14px;font-weight:700;color:var(--parch)}
.adv .rc-a-h small{margin-left:auto;font-weight:400;font-size:12px;color:var(--dim)}
.adv .rc-a-t{font-family:var(--f-body);font-size:17px;line-height:1.4;color:#f6ead2}
.adv .rc-how{margin:0;font-size:13px;line-height:1.45;color:var(--dim)}
.adv .rolenote{padding:11px 13px 12px;border-radius:12px;border:1px solid var(--role-line);border-left:4px solid var(--role);background:var(--role-soft)}
.adv .rn-h{display:flex;align-items:center;gap:9px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--role);font-weight:700}
.adv .rn-h .role-ic{width:28px;height:28px;font-size:15px}
.adv .rolenote p{margin:7px 0 0;font-family:var(--f-body);font-size:17px;line-height:1.42;color:var(--parch)}
.adv .optb .who{display:block;margin-top:5px;font-family:var(--f-ui);font-size:14px;letter-spacing:.06em;color:var(--dim)}
.adv .adv-table{display:grid;gap:8px}
.adv .chips{display:flex;flex-wrap:wrap;gap:6px}
.adv .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--role-line,var(--line));background:var(--role-soft,rgba(0,0,0,.2));font-size:14px}
.adv .chip small{font-size:11px;color:var(--dim)}
.adv .chip.me{box-shadow:0 0 0 2px var(--role,var(--gold)) inset}
.adv .chip .you{color:var(--role,var(--gold));font-weight:700}
.adv .chip .ok{color:var(--good);font-weight:700}
.adv .reveal{display:grid;gap:9px;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.25)}
.adv .reveal h3{margin:0;font-family:var(--f-display);font-size:18px;color:var(--gold-hi)}
.adv .reveal .rv-intro{margin:0 0 2px;font-size:13px;line-height:1.45;color:var(--dim)}
.adv .verdictbox p{margin:2px 0 0;font-family:var(--f-display);font-size:20px;color:var(--gold-hi)}
.adv .rv{display:flex;gap:10px;align-items:flex-start}
.adv .rv p{margin:0;font-family:var(--f-body);font-size:16px;line-height:1.4}
.adv .rv b{font-family:var(--f-ui);font-size:13px;color:var(--role)}
@media (prefers-reduced-motion:reduce){.adv .rolecard.dealt{animation:none}}
`);
