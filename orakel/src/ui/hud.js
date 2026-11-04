// The heads-up display and the dialogue box.
import * as THREE from 'three';
import {$, el, esc, clamp, TILE, tileOf} from '../core/util.js';
import {UI, P, CAST} from '../game/bus.js';
import {G, SETTINGS} from '../game/state.js';
import {W} from '../game/world.js';
import {T} from '../engine/level.js';
import {R} from '../engine/render.js';
import {TOOLS, TOOL_ORDER, C, REVEAL_CD} from '../game/combat.js';
import {DLG, advance, pick, moveSel} from '../game/dialogue.js';
import {PL} from '../game/player.js';

const H = {toasts: [], bannerT: 0, pipT: 0, numbers: [], hurtT: 0, flashT: 0, tracker: null, mapT: 0, ghost: 1};

export function initHud() {
  // tool slots
  const tools = $('tools');
  for (const id of TOOL_ORDER) {
    const t = TOOLS[id];
    tools.append(el('button', {class: 'tool', id: `tool-${id}`, style: `--c:${t.css}`, title: `${t.name} (${TOOL_ORDER.indexOf(id) + 1}) · ${t.attack}`, onclick: () => UI.selectTool?.(id)},
      el('kbd', {text: TOOL_ORDER.indexOf(id) + 1}), el('span', {class: 'ic', text: t.icon}), el('span', {class: 'cd'}), el('span', {class: 'nm', text: t.name})));
  }
  tools.append(el('button', {class: 'tool small', id: 'tool-reveal', style: '--c:#fff1b8', title: 'Onthullen (R of rechtermuisknop): wat niet echt is, verdwijnt', onclick: () => UI.reveal?.()},
    el('kbd', {text: 'R'}), el('span', {class: 'ic', text: '☀'}), el('span', {class: 'cd'}), el('span', {class: 'nm', text: 'Onthul'})));
  // trust bar segments
  const bar = $('trustBar');
  for (let i = 1; i < 8; i++) bar.append(el('span', {class: 'seg', style: `left:${(i / 8) * 100}%`}));
  // dialogue clicks
  $('dialog').addEventListener('click', e => { if (e.target.closest('button')) return; advance(); });
  Object.assign(UI, {toast, banner, pip, number, hurt, flash, boss, target: setTarget, dlgOpen, dlgClose, dlgLine, dlgChoices, dlgSelect, dlgFinish, prompt: setPrompt});
}

// ---------------------------------------------------------------- toasts, banners, Pip
export function toast(title, text = '', kind = '') {
  const t = el('div', {class: `card toast ${kind}`}, el('b', {text: title}), text ? el('span', {text}) : null);
  $('toasts').append(t);
  H.toasts.push({t, life: 4.5 + Math.min(4, text.length / 40)});
  while (H.toasts.length > 4) H.toasts.shift().t.remove();
}
export function banner(name, sub = '') {
  $('bannerName').textContent = name; $('bannerSub').textContent = sub;
  $('banner').classList.add('on'); H.bannerT = 3.2;
}
export function pip(text, sec) {
  if (!text) return;
  $('pipText').textContent = text;
  $('pip').classList.add('on'); H.pipT = sec ?? clamp(2.5 + text.length / 22, 3, 9);
  PL.pipTalk = 1.2;
}
export function hurt(n) {
  H.hurtT = 0.35; $('hurt').style.opacity = 1;
  if (n > 0) number(P.x, P.y + 2.1, P.z, -n, '#ff7c68', false);
}
export function flash(a = 0.4) { H.flashT = a; $('flash').style.opacity = a; }
export function boss(name, frac, phase) {
  const b = $('bossbar');
  if (name === null) { b.hidden = true; return; }
  b.hidden = false; $('bossName').textContent = name; $('bossFill').style.transform = `scaleX(${clamp(frac, 0, 1)})`; $('bossPhase').textContent = phase || '';
}

// floating damage numbers, projected from the world every frame
const proj = new THREE.Vector3();
export function number(x, y, z, n, color = '#fff', big = false) {
  const d = el('div', {style: `position:absolute;left:0;top:0;pointer-events:none;font-family:var(--f-display);font-weight:700;font-size:${big ? 24 : 17}px;color:${color};text-shadow:0 2px 6px #000,0 0 2px #000;white-space:nowrap`, text: typeof n === 'number' ? (n > 0 ? n : n) : n});
  $('hud').append(d);
  H.numbers.push({d, x, y, z, t: 0, vx: (Math.random() - 0.5) * 0.6});
}

// ---------------------------------------------------------------- prompt and target
let lastPrompt = '';
function setPrompt(text, key = 'E') {
  const p = $('prompt');
  if (!text) { if (!p.hidden) p.hidden = true; lastPrompt = ''; return; }
  if (text !== lastPrompt) { $('promptText').innerHTML = esc(text).replace(/^(\S+)/, '$1'); $('promptKey').textContent = key; lastPrompt = text; }
  if (p.hidden) p.hidden = false;
}
let lastTarget = null;
function setTarget(e) {
  const t = $('target');
  if (!e) { if (!t.hidden) t.hidden = true; lastTarget = null; return; }
  const def = e.def, w = def.weak ? TOOLS[def.weak] : null;
  const key = `${e.id}:${Math.round(e.hp)}:${e.exposed > 0}`;
  if (key !== lastTarget) {
    lastTarget = key;
    t.innerHTML = `<b>${esc(def.name)}</b>${w ? `<span class="w" style="color:${w.css}">zwak voor ${w.icon} ${esc(w.name)}</span>` : ''}${def.shielded && !(e.exposed > 0) ? '<span class="w">glanst · onthul (R)</span>' : ''}
      <div class="bar" style="width:140px;height:6px;margin:5px auto 0"><i style="transform:scaleX(${clamp(e.hp / e.maxHp, 0, 1)});background:linear-gradient(90deg,#b0412e,#ff9a6a)"></i></div>`;
  }
  if (t.hidden) t.hidden = false;
}

// ---------------------------------------------------------------- dialogue box
let typing = null;
function dlgOpen() { $('dialog').hidden = false; $('hud').classList.add('talking'); }
function dlgClose() { $('dialog').hidden = true; $('dlgChoices').hidden = true; typing = null; DLG.typing = false; }
function dlgLine(sp, text, o) {
  const box = $('dialog');
  box.className = `card ${sp.cls || ''}`;
  $('dlgName').textContent = sp.name; $('dlgTitle').textContent = sp.title || '';
  if (sp.color) $('dlgName').style.color = sp.color; else $('dlgName').style.color = '';
  $('dlgChoices').hidden = true; $('dlgMore').hidden = false;
  const tx = $('dlgText');
  tx.textContent = '';
  typing = {text, i: 0, speed: 55 * (SETTINGS.textSpeed ?? 1) * (o.fast ? 2 : 1)};
  DLG.typing = true;
  if (DLG.auto || SETTINGS.textSpeed >= 3) dlgFinish();
}
function dlgFinish() { if (!typing) return; $('dlgText').textContent = typing.text; typing = null; DLG.typing = false; }
function dlgChoices(list) {
  const ol = $('dlgChoices');
  ol.innerHTML = '';
  if (!list) { ol.hidden = true; return; }
  dlgFinish();
  list.forEach((c, i) => ol.append(el('li', {}, el('button', {class: i === 0 ? 'sel' : '', onclick: () => pick(i)}, el('kbd', {text: i + 1}), el('span', {text: c.t})))));
  ol.hidden = false; $('dlgMore').hidden = true;
}
function dlgSelect(i) { [...$('dlgChoices').querySelectorAll('button')].forEach((b, k) => b.classList.toggle('sel', k === i)); }
export function dialogueKey(code) {
  if (!DLG.active) return false;
  if (DLG.choices) {
    const n = parseInt(code.replace('Digit', '').replace('Numpad', ''), 10);
    if (n >= 1 && n <= 9) { pick(n - 1); return true; }
    if (code === 'ArrowDown' || code === 'KeyS') { moveSel(1); return true; }
    if (code === 'ArrowUp' || code === 'KeyW') { moveSel(-1); return true; }
  }
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' || code === 'KeyF') { advance(); return true; }
  return false;
}

// ---------------------------------------------------------------- per-frame update
export function updateHud(dt, quest) {
  // typewriter
  if (typing) {
    typing.i += dt * typing.speed;
    const n = Math.min(typing.text.length, Math.floor(typing.i));
    $('dlgText').textContent = typing.text.slice(0, n);
    if (n >= typing.text.length) { typing = null; DLG.typing = false; }
  }
  // toasts
  for (let i = H.toasts.length - 1; i >= 0; i--) { const t = H.toasts[i]; t.life -= dt; if (t.life < 0.4) t.t.style.opacity = Math.max(0, t.life / 0.4); if (t.life <= 0) { t.t.remove(); H.toasts.splice(i, 1); } }
  if (H.bannerT > 0) { H.bannerT -= dt; if (H.bannerT <= 0) $('banner').classList.remove('on'); }
  if (H.pipT > 0) { H.pipT -= dt; if (H.pipT <= 0) $('pip').classList.remove('on'); }
  if (H.hurtT > 0) { H.hurtT -= dt; if (H.hurtT <= 0) $('hurt').style.opacity = 0; }
  if (H.flashT > 0) { H.flashT = Math.max(0, H.flashT - dt * 1.5); $('flash').style.opacity = H.flashT; }
  // trust
  const frac = clamp(G.hp / G.maxHp, 0, 1);
  H.ghost = Math.max(frac, H.ghost - dt * 0.4);
  $('trustFill').style.transform = `scaleX(${frac})`; $('trustGhost').style.transform = `scaleX(${H.ghost})`;
  const tt = `${Math.ceil(G.hp)}/${G.maxHp}`;
  if ($('trustText').textContent !== tt) $('trustText').textContent = tt;
  $('lowtrust').style.opacity = frac < 0.3 ? 0.6 + Math.sin(R.time * 4) * 0.3 : 0;
  // place
  if (W.L) {
    const zn = W.L.zoneAt(tileOf(P.x), tileOf(P.z));
    const name = zn.name || W.L.def.name, depth = W.L.def.depth || '';
    if ($('placeName').textContent !== name) $('placeName').textContent = name;
    if ($('placeDepth').textContent !== depth) $('placeDepth').textContent = depth;
  }
  // tools
  for (const id of TOOL_ORDER) {
    const b = $(`tool-${id}`), owned = G.tools[id];
    b.classList.toggle('locked', !owned); b.classList.toggle('on', owned && P.tool === id);
    b.querySelector('.cd').style.setProperty('--p', `${(C.cd[id] / TOOLS[id].cd) * 100}%`);
  }
  const rv = $('tool-reveal'); rv.classList.toggle('locked', !G.tools.lamp); rv.querySelector('.cd').style.setProperty('--p', `${(C.cd.reveal / REVEAL_CD) * 100}%`);
  $('crosshair').classList.toggle('tp', PL.camMode === 'third');
  // tracker
  if (quest) {
    const key = quest.title + '|' + quest.text;
    if (key !== H.tracker) { H.tracker = key; $('trackTitle').textContent = quest.title; $('trackText').textContent = quest.text; }
    let dist = '';
    if (quest.target) dist = quest.target.floor && quest.target.floor !== W.id ? (quest.target.where || 'op een andere diepte') : `${Math.round(Math.hypot(quest.target.x - P.x, quest.target.z - P.z))} m`;
    if ($('trackDist').textContent !== dist) $('trackDist').textContent = dist;
  }
  // numbers
  for (let i = H.numbers.length - 1; i >= 0; i--) {
    const n = H.numbers[i]; n.t += dt;
    proj.set(n.x + n.vx * n.t, n.y + n.t * 1.1, n.z).project(R.camera);
    const vis = proj.z < 1 && proj.z > -1;
    n.d.style.transform = `translate(${(proj.x * 0.5 + 0.5) * innerWidth}px,${(-proj.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
    n.d.style.opacity = vis ? Math.max(0, 1 - n.t / 0.9) : 0;
    if (n.t > 0.9) { n.d.remove(); H.numbers.splice(i, 1); }
  }
  // minimap
  H.mapT -= dt;
  if (H.mapT <= 0) { H.mapT = 1 / 15; drawMinimap(quest); }
}

// ---------------------------------------------------------------- minimap
export const MAPCOL = {floor: '#5a4a38', carpet: '#7a3a34', water: '#2a5a7a', chasm: '#0a0806', bridge: '#8a6a40', wall: '#cdb48a', door: '#e8c27a', unseen: '#120e0a'};
export function drawTiles(g, cx, cz, scale, w, h, {all = false} = {}) {
  const L = W.L; if (!L) return;
  const x0 = Math.floor(cx - w / 2 / scale) - 1, z0 = Math.floor(cz - h / 2 / scale) - 1, x1 = Math.ceil(cx + w / 2 / scale) + 1, z1 = Math.ceil(cz + h / 2 / scale) + 1;
  const sx = tx => (tx - cx) * scale + w / 2, sz = tz => (tz - cz) * scale + h / 2;
  const seen = (x, z) => x >= 0 && z >= 0 && x < L.W && z < L.H && (all || W.explored[z * L.W + x]);
  for (let z = Math.max(0, z0); z <= Math.min(L.H - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(L.W - 1, x1); x++) {
    const t = L.tiles[z * L.W + x];
    if (t === T.SOLID) continue;
    if (!seen(x, z)) continue;
    let c = MAPCOL.floor;
    if (t === T.CARPET) c = MAPCOL.carpet; else if (t === T.WATER) c = MAPCOL.water; else if (t === T.CHASM || (t === T.HIDDEN && !G.opened[`rev:${W.id}:${x},${z}`])) c = MAPCOL.chasm; else if (t === T.BRIDGE || t === T.HIDDEN) c = MAPCOL.bridge;
    else if (t === T.DOOR || t === T.GATE) c = MAPCOL.door; else if (t === T.ILLUSION && !G.opened[`rev:${W.id}:${x},${z}`]) continue;
    g.fillStyle = c; g.fillRect(sx(x), sz(z), scale + 0.5, scale + 0.5);
  }
  // walls: edges between seen floor and solid
  g.strokeStyle = MAPCOL.wall; g.lineWidth = Math.max(1.5, scale * 0.16); g.beginPath();
  for (let z = Math.max(0, z0); z <= Math.min(L.H - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(L.W - 1, x1); x++) {
    const t = L.tiles[z * L.W + x];
    if (t === T.SOLID || !seen(x, z)) continue;
    const solid = (a, b) => a < 0 || b < 0 || a >= L.W || b >= L.H || L.tiles[b * L.W + a] === T.SOLID || (L.tiles[b * L.W + a] === T.ILLUSION && !G.opened[`rev:${W.id}:${a},${b}`]);
    if (solid(x, z - 1)) { g.moveTo(sx(x), sz(z)); g.lineTo(sx(x + 1), sz(z)); }
    if (solid(x, z + 1)) { g.moveTo(sx(x), sz(z + 1)); g.lineTo(sx(x + 1), sz(z + 1)); }
    if (solid(x - 1, z)) { g.moveTo(sx(x), sz(z)); g.lineTo(sx(x), sz(z + 1)); }
    if (solid(x + 1, z)) { g.moveTo(sx(x + 1), sz(z)); g.lineTo(sx(x + 1), sz(z + 1)); }
  }
  g.stroke();
  return {sx, sz};
}
export function drawMarkers(g, f, scale, {quest, all = false} = {}) {
  const dot = (x, z, color, r = 3) => { g.fillStyle = color; g.beginPath(); g.arc(f.sx(x / TILE), f.sz(z / TILE), r, 0, Math.PI * 2); g.fill(); };
  for (const e of W.ents) {
    if (e.visible === false) continue;
    const seen = all || W.explored[e.tz * W.L.W + e.tx];
    if (!seen) continue;
    if (e.type === 'npc') dot(e.x, e.z, '#9fd0ff', scale * 0.32);
    else if (e.type === 'coffee') dot(e.x, e.z, '#9fe0b0', scale * 0.38);
    else if (e.type === 'stairs') { g.fillStyle = '#ffd36b'; g.fillRect(f.sx(e.tx + 0.2), f.sz(e.tz + 0.2), scale * 0.6, scale * 0.6); }
    else if (e.type === 'chest' && !e.open) dot(e.x, e.z, '#e8c27a', scale * 0.25);
  }
  if (quest?.target && (!quest.target.floor || quest.target.floor === W.id)) {
    const x = f.sx(quest.target.x / TILE), z = f.sz(quest.target.z / TILE);
    g.strokeStyle = '#ffb84a'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, z, scale * 0.6 + Math.sin(R.time * 4) * 2, 0, Math.PI * 2); g.stroke();
  }
}
function drawMinimap(quest) {
  const cv = $('minimap'), g = cv.getContext('2d'), w = cv.width, h = cv.height, scale = 13;
  g.fillStyle = MAPCOL.unseen; g.fillRect(0, 0, w, h);
  const cx = P.x / TILE, cz = P.z / TILE;
  const f = drawTiles(g, cx, cz, scale, w, h);
  if (!f) return;
  drawMarkers(g, f, scale, {quest});
  // quest arrow at the edge when the target is off the map
  if (quest?.target && (!quest.target.floor || quest.target.floor === W.id)) {
    const tx = f.sx(quest.target.x / TILE), tz = f.sz(quest.target.z / TILE);
    if (tx < 8 || tz < 8 || tx > w - 8 || tz > h - 8) {
      const a = Math.atan2(tz - h / 2, tx - w / 2), ex = w / 2 + Math.cos(a) * (w / 2 - 14), ez = h / 2 + Math.sin(a) * (h / 2 - 14);
      g.save(); g.translate(ex, ez); g.rotate(a); g.fillStyle = '#ffb84a'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
    }
  }
  // the player
  g.save(); g.translate(w / 2, h / 2); g.rotate(-P.yaw);
  g.fillStyle = '#fff4d6'; g.strokeStyle = '#1a1208'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
