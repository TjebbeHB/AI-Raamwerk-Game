// The heads-up display and the dialogue box: trust, place, quest, tools, prompts, the faces and
// voices of whoever is talking, and the accessibility settings that change how all of it looks.
import * as THREE from 'three';
import {$, el, esc, clamp, TILE, tileOf, IS_TOUCH, addStyles} from '../core/util.js';
import {UI, P, SFX} from '../game/bus.js';
import {G, SETTINGS, saveSettings} from '../game/state.js';
import {W} from '../game/world.js';
import {T} from '../engine/level.js';
import {R, setReducedMotion} from '../engine/render.js';
import {TOOLS, TOOL_ORDER, C, REVEAL_CD} from '../game/combat.js';
import {DLG, advance, pick, moveSel, leave, canLeave} from '../game/dialogue.js';
import {PL} from '../game/player.js';
import {Input, openModalEl} from '../core/input.js';
import {codesFor, keyLabel} from '../core/keys.js';
import {hasPortrait, startTalking, stopTalking, hidePortrait} from './portrait.js';

const H = {toasts: [], bannerT: 0, pipT: 0, numbers: [], hurtT: 0, flashT: 0, tracker: null, mapT: 0, ghost: 1,
  zoom: 1, blipCd: 0, autoT: -1, statusT: 0, toolKey: '', ring: '', touchKey: ''};
const touchUi = () => !!(IS_TOUCH || Input.touch);

export function initHud() {
  // tool slots
  const tools = $('tools');
  for (const id of TOOL_ORDER) {
    const t = TOOLS[id];
    tools.append(el('button', {class: 'tool', id: `tool-${id}`, style: `--c:${t.css}`, onclick: () => UI.selectTool?.(id)},
      el('kbd', {text: TOOL_ORDER.indexOf(id) + 1}), el('span', {class: 'ic', text: t.icon}), el('span', {class: 'cd'}), el('span', {class: 'nm', text: t.name})));
  }
  tools.append(el('button', {class: 'tool small', id: 'tool-reveal', style: '--c:#fff1b8', onclick: () => UI.reveal?.()},
    el('kbd', {text: 'R'}), el('span', {class: 'ic', text: '☀'}), el('span', {class: 'cd'}), el('span', {class: 'nm', text: 'Onthul'})));
  // trust bar segments
  const bar = $('trustBar');
  for (let i = 1; i < 8; i++) bar.append(el('span', {class: 'seg', style: `left:${(i / 8) * 100}%`}));
  // dialogue clicks
  $('dialog').addEventListener('click', e => { if (e.target.closest('button')) return; advance(); });
  // compact HUD: tap the trust ring for the whole card; it folds back by itself
  $('status').addEventListener('click', e => {
    if (!document.body.classList.contains('compact') || e.target.closest('#tracker')) return;
    const open = $('status').classList.toggle('open'); H.statusT = open ? 7 : 0; SFX.play(open ? 'open' : 'close');
  });
  $('btnMini').addEventListener('click', () => { SETTINGS.miniMap = SETTINGS.miniMap === false; saveSettings(); applySettings(); });
  // touch: one tool button that shows what is in your hand and switches on a tap
  const tt = $('tTool');
  tt.addEventListener('touchstart', e => { e.preventDefault(); tt.classList.add('down'); nextTool(); }, {passive: false});
  tt.addEventListener('touchend', () => tt.classList.remove('down'));
  tt.addEventListener('click', nextTool);
  addEventListener('resize', () => applySettings());
  Object.assign(UI, {toast, banner, pip, number, hurt, flash, boss, target: setTarget, dlgOpen, dlgClose, dlgLine, dlgChoices, dlgSelect, dlgFinish, prompt: setPrompt, applySettings, refreshKeys});
  applySettings();
  refreshKeys();
}

// ---------------------------------------------------------------- accessibility and layout
// Body classes and size variables from SETTINGS (index.html has the CSS). Call after any change.
export function applySettings() {
  const b = document.body, S = SETTINGS, touch = touchUi();
  const compact = S.compactHud === 'on' || (S.compactHud !== 'off' && touch);
  b.classList.toggle('touch', touch);
  b.classList.toggle('compact', compact);
  b.classList.toggle('nomini', compact && S.miniMap === false);
  b.classList.toggle('hc', S.contrast === 'high');
  b.classList.toggle('readable', S.font === 'readable');
  b.classList.toggle('reduced', S.motion === 'reduced');
  // text and interface size: the whole UI zooms, up to what the screen has room for; the reading text grows the rest
  const ui = clamp(+S.uiScale || 1, 0.85, 1.5), cap = clamp(Math.min(innerWidth / 800, innerHeight / 520), 1.1, 1.5), z = Math.min(ui, cap);
  const st = document.documentElement.style;
  st.setProperty('--ui', String(ui)); st.setProperty('--uiz', z.toFixed(3)); st.setProperty('--uit', (ui / z).toFixed(3));
  H.zoom = z;
  $('btnMini')?.setAttribute('aria-pressed', String(S.miniMap !== false));
  if (!compact) $('status')?.classList.remove('open');
  const more = $('dlgMoreKey'); if (more) { more.hidden = touch; $('dlgMoreText').textContent = touch ? 'tik om verder te gaan' : 'verder'; }
  setReducedMotion(S.motion === 'reduced');
}
// Every key shown in the HUD follows the key map (core/keys.js). Call after a remap.
export function refreshKeys() {
  TOOL_ORDER.forEach((id, i) => {
    const b = $(`tool-${id}`); if (!b) return;
    const k = keyLabel(`tool${i + 1}`);
    b.querySelector('kbd').textContent = k; b.title = `${TOOLS[id].name} (${k}) · ${TOOLS[id].attack}`;
  });
  const rv = $('tool-reveal');
  if (rv) { rv.querySelector('kbd').textContent = keyLabel('reveal'); rv.title = `Onthullen (${keyLabel('reveal')} of rechtermuisknop): wat niet echt is, verdwijnt`; }
  for (const [id, text] of [['tracker', `Opdrachten (${keyLabel('journal')})`], ['btnJournal', `Dossier en opdrachten (${keyLabel('journal')})`], ['btnMap', `Kaart (${keyLabel('map')})`],
    ['mapCard', `Kaart (${keyLabel('map')})`], ['btnCam', `Camera wisselen (${keyLabel('camera')})`], ['btnMenu', `Menu (${keyLabel('menu')})`]]) { const e = $(id); if (e) e.title = text; }
  document.querySelectorAll('kbd[data-key]').forEach(k => { k.textContent = keyLabel(k.dataset.key); });
  if ($('dlgMoreKey')) $('dlgMoreKey').textContent = keyLabel('interact');
  lastPrompt = ''; lastTarget = null;
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
  H.hurtT = 0.35; $('hurt').style.opacity = SETTINGS.motion === 'reduced' ? 0.45 : 1;
  if (n > 0) number(P.x, P.y + 2.1, P.z, -n, '#ff7c68', false);
}
// screen flashes: none with reduced motion
export function flash(a = 0.4) { if (SETTINGS.motion === 'reduced') return; H.flashT = a; $('flash').style.opacity = a; }
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
// On a keyboard: a card with the key. On a touch screen: the E button itself appears and says what it does.
const SHORT = {lamp: 'Lamp', scale: 'Schaal', seal: 'Zegel'};
const TYPE_ICON = {npc: '💬', door: '🚪', gate: '⛓', stairs: '⇣', chest: '📦', item: '✋', coffee: '☕', lever: '⚙', object: '👁', sign: '📜', fire: '🔥'};
let lastPrompt = '';
function setPrompt(text, key = keyLabel('interact'), action = 'interact', target = null) {
  const p = $('prompt'), act = $('tAct');
  if (!text) { if (!p.hidden) p.hidden = true; if (act && !act.hidden) act.hidden = true; lastPrompt = ''; return; }
  const sig = `${text}|${key}|${action}`;
  if (sig !== lastPrompt) {
    lastPrompt = sig;
    $('promptText').textContent = text; $('promptKey').textContent = key;
    Input.actAction = action;
    if (act) {
      $('tActText').textContent = action === 'cycle' ? 'Leg het terug' : text;
      $('tActIcon').textContent = action === 'cycle' ? '⤓' : target?.type === 'stairs' && !target.def?.down ? '⇡' : TYPE_ICON[target?.type] || '✋';
      act.setAttribute('aria-label', text);
    }
  }
  if (p.hidden) p.hidden = false;
  if (act && act.hidden && touchUi()) act.hidden = false;
}
// what the crosshair is on: its name, what it is weak to (icon and word, plus whether you hold the right tool), its health
let lastTarget = null;
function setTarget(e) {
  const t = $('target');
  if (!e) { if (!t.hidden) t.hidden = true; lastTarget = null; return; }
  const def = e.def, w = def.weak ? TOOLS[def.weak] : null, right = !!w && P.tool === def.weak;
  const key = `${e.id}:${Math.round(e.hp)}:${e.exposed > 0}:${P.tool}`;
  if (key !== lastTarget) {
    lastTarget = key;
    const swap = touchUi() ? 'wissel' : `wissel: ${keyLabel(`tool${TOOL_ORDER.indexOf(def.weak) + 1}`)}`;
    const weak = w ? `<span class="w" style="color:${w.css};--c:${w.css}"><span class="wi">${w.icon}</span> zwak voor ${esc(w.name)}${right ? '<b class="ok">✓ in je hand</b>' : `<b class="sw">${esc(swap)}</b>`}</span>` : '';
    const shield = def.shielded ? (e.exposed > 0 ? '<span class="w shield">✦ kwetsbaar</span>' : `<span class="w shield">✧ glanst · onthul${touchUi() ? ' ☀' : ` (${esc(keyLabel('reveal'))})`}</span>`) : '';
    t.innerHTML = `<b>${esc(def.name)}</b>${weak}${shield}
      <div class="bar" style="width:140px;height:6px;margin:5px auto 0"><i style="transform:scaleX(${clamp(e.hp / e.maxHp, 0, 1)});background:linear-gradient(90deg,#b0412e,#ff9a6a)"></i></div>`;
  }
  if (t.hidden) t.hidden = false;
}

// ---------------------------------------------------------------- dialogue box
// The speaker's face (ui/portrait.js) talks while the text types, and their voice babbles a
// syllable at a time (core/audio.js). With 'Vanzelf verder' the line moves on after a pause.
let typing = null;
const VOWEL = /[aeiouyàáâäèéêëìíîïòóôöùúûü]/i;
// Esc stoppen (✕ on a phone): always visible in a conversation with someone, so nobody gets stuck
function leaveButton() {
  let b = $('dlgLeave');
  if (!b) {
    b = el('button', {id: 'dlgLeave', class: 'dlg-leave', type: 'button', title: 'Gesprek beëindigen (Esc)', onclick: e => { e.stopPropagation(); leave(); }});
    $('dialog').append(b);
    addStyles('dlg-leave', `#dlgLeave{position:absolute;top:10px;right:12px;display:flex;gap:6px;align-items:center;padding:4px 9px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--dim);font:13px var(--f-ui);cursor:pointer;pointer-events:auto}
#dlgLeave:hover,#dlgLeave:focus-visible{color:var(--parch);border-color:var(--line-strong)}
#dlgLeave kbd{font-size:11px}
body.touch #dlgLeave,#dlgLeave.touch{padding:6px 12px;font-size:18px}
#dlgChoices .dlg-leave-row{margin-top:4px}
#dlgChoices .dlg-leave-opt{opacity:.8;font-style:italic}
#dlgChoices .dlg-leave-opt:hover,#dlgChoices .dlg-leave-opt:focus-visible{opacity:1}`);
  }
  const show = canLeave();
  b.hidden = !show;
  if (!show) return;
  b.classList.toggle('touch', IS_TOUCH);
  b.replaceChildren(...(IS_TOUCH ? [el('span', {text: '✕'})] : [el('kbd', {text: 'Esc'}), el('span', {text: 'stoppen'})]));
}
function dlgOpen() { $('dialog').hidden = false; $('hud').classList.add('talking'); }
function dlgClose() {
  $('dialog').hidden = true; $('dlgChoices').hidden = true; typing = null; DLG.typing = false; H.autoT = -1;
  const face = $('dlgFace'); hidePortrait(face); face.hidden = true; $('dialog').classList.remove('has-face');
}
function dlgLine(sp, text, o = {}) {
  const box = $('dialog');
  box.className = `card ${sp.cls || ''}`;
  $('dlgName').textContent = sp.name; $('dlgTitle').textContent = sp.title || '';
  if (sp.color) $('dlgName').style.color = sp.color; else $('dlgName').style.color = '';
  $('dlgChoices').hidden = true; $('dlgMore').hidden = false;
  leaveButton();
  // the face: the narrator and voices outside the cast have none
  const face = $('dlgFace');
  let has = false;
  try { has = hasPortrait(sp); if (has) startTalking(face, sp, o.mood || 'neutral', {size: 96}); else hidePortrait(face); } catch (e) { has = false; }
  face.hidden = !has; box.classList.toggle('has-face', has);
  const tx = $('dlgText');
  tx.textContent = '';
  let voice = null;
  try { voice = SETTINGS.voice === false ? null : SFX.voiceFor?.(sp) || null; } catch (e) { voice = null; }
  typing = {text, i: 0, n: 0, speed: 55 * (SETTINGS.textSpeed ?? 1) * (o.fast ? 2 : 1), voice, mood: o.mood || 'neutral'};
  DLG.typing = true; H.autoT = -1; H.blipCd = 0;
  if (DLG.auto || SETTINGS.textSpeed >= 3) dlgFinish();
}
function dlgFinish() {
  if (!typing) return;
  $('dlgText').textContent = typing.text; typing = null; DLG.typing = false;
  lineDone();
}
function lineDone() {
  stopTalking($('dlgFace'));
  const len = ($('dlgText').textContent || '').length;
  H.autoT = SETTINGS.autoAdvance ? clamp(1.3 + len * 0.045, 1.8, 7) : -1;
}
function dlgChoices(list) {
  const ol = $('dlgChoices');
  ol.innerHTML = '';
  if (!list) { ol.hidden = true; return; }
  dlgFinish();
  H.autoT = -1;
  list.forEach((c, i) => ol.append(el('li', {}, el('button', {class: i === 0 ? 'sel' : '', onclick: () => pick(i)}, el('kbd', {text: i + 1}), el('span', {text: c.t})))));
  if (canLeave()) ol.append(el('li', {class: 'dlg-leave-row'}, el('button', {class: 'dlg-leave-opt', onclick: e => { e.stopPropagation(); leave(); }}, el('kbd', {text: IS_TOUCH ? '✕' : 'Esc'}), el('span', {text: 'Gesprek beëindigen'}))));
  ol.hidden = false; $('dlgMore').hidden = true;
  leaveButton();
}
function dlgSelect(i) { [...$('dlgChoices').querySelectorAll('button')].forEach((b, k) => b.classList.toggle('sel', k === i)); }
// keys in a conversation follow the key map: interact (and dash, Enter) moves on, forward and back move through the choices
export function dialogueKey(code) {
  if (!DLG.active) return false;
  if (code === 'Escape') { leave(); return true; }      // walk away, or skip a scene
  const is = a => codesFor(a).includes(code);
  if (DLG.choices) {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (m) { pick(+m[1] - 1); return true; }
    if (code === 'ArrowDown' || is('back')) { moveSel(1); return true; }
    if (code === 'ArrowUp' || is('forward')) { moveSel(-1); return true; }
  }
  if (is('interact') || is('dash') || code === 'Enter' || code === 'Space') { advance(); return true; }
  return false;
}
// one syllable per vowel group, throttled; the note comes from the letters, so a line always sounds the same
function speakTyped(text, from, to) {
  if (H.blipCd > 0) return;
  for (let i = to - 1; i >= from; i--) {
    if (!VOWEL.test(text[i]) || VOWEL.test(text[i - 1] || ' ')) continue;
    const word = /^[\p{L}'’-]*([?!]?)/u.exec(text.slice(i));
    SFX.voice?.(typing.voice, (text.charCodeAt(i) * 7 + (text.charCodeAt(i - 1) || 0) * 3 + i) % 8, typing.mood, word?.[1] || '');
    H.blipCd = 0.072;
    return;
  }
}

// ---------------------------------------------------------------- per-frame update
export function updateHud(dt, quest) {
  // typewriter, voice and the face
  H.blipCd -= dt;
  if (typing) {
    typing.i += dt * typing.speed;
    const n = Math.min(typing.text.length, Math.floor(typing.i));
    if (n !== typing.n) {
      $('dlgText').textContent = typing.text.slice(0, n);
      if (typing.voice) speakTyped(typing.text, typing.n, n);
      typing.n = n;
    }
    if (n >= typing.text.length) { typing = null; DLG.typing = false; lineDone(); }
  }
  // dialogue auto-advance (Opties, Toegankelijkheid)
  if (H.autoT > 0 && DLG.active && !DLG.typing && !DLG.choices && DLG.res && !openModalEl()) { H.autoT -= dt; if (H.autoT <= 0) { H.autoT = -1; advance(); } }
  // toasts
  for (let i = H.toasts.length - 1; i >= 0; i--) { const t = H.toasts[i]; t.life -= dt; if (t.life < 0.4) t.t.style.opacity = Math.max(0, t.life / 0.4); if (t.life <= 0) { t.t.remove(); H.toasts.splice(i, 1); } }
  if (H.bannerT > 0) { H.bannerT -= dt; if (H.bannerT <= 0) $('banner').classList.remove('on'); }
  // on touch screens the joystick and buttons would cover the dialogue box: hide them while talking
  if (H.talking !== !!DLG.active) { H.talking = !!DLG.active; document.body.classList.toggle('talking', H.talking); }
  if (H.pipT > 0) { H.pipT -= dt; if (H.pipT <= 0) $('pip').classList.remove('on'); }
  if (H.hurtT > 0) { H.hurtT -= dt; if (H.hurtT <= 0) $('hurt').style.opacity = 0; }
  if (H.flashT > 0) { H.flashT = Math.max(0, H.flashT - dt * 1.5); $('flash').style.opacity = H.flashT; }
  if (H.statusT > 0) { H.statusT -= dt; if (H.statusT <= 0) $('status').classList.remove('open'); }
  // trust: the bar, the number (with a warning sign when low) and the compact ring
  const frac = clamp(G.hp / G.maxHp, 0, 1), low = frac < 0.3;
  H.ghost = Math.max(frac, H.ghost - dt * 0.4);
  $('trustFill').style.transform = `scaleX(${frac})`; $('trustGhost').style.transform = `scaleX(${H.ghost})`;
  const tt = `${low ? '⚠ ' : ''}${Math.ceil(G.hp)}/${G.maxHp}`;
  if ($('trustText').textContent !== tt) $('trustText').textContent = tt;
  const rk = `${Math.ceil(G.hp)}|${G.maxHp}`;
  if (rk !== H.ring) {
    H.ring = rk;
    $('ringFill').setAttribute('stroke-dasharray', `${(frac * 100).toFixed(1)} 100`);
    $('ringText').textContent = Math.ceil(G.hp);
    $('trustRing').classList.toggle('low', low);
    $('trustRing').setAttribute('aria-label', `Vertrouwen ${Math.ceil(G.hp)} van ${G.maxHp}`);
  }
  $('lowtrust').style.opacity = low ? (SETTINGS.motion === 'reduced' ? 0.6 : 0.6 + Math.sin(R.time * 4) * 0.3) : 0;
  // place
  if (W.L) {
    const zn = W.L.zoneAt(tileOf(P.x), tileOf(P.z));
    const name = zn.name || W.L.def.name, depth = W.L.def.depth || '';
    if ($('placeName').textContent !== name) $('placeName').textContent = name;
    if ($('placeDepth').textContent !== depth) $('placeDepth').textContent = depth;
  }
  // tools: the bar on a keyboard, one switching button and the use button on a touch screen
  for (const id of TOOL_ORDER) {
    const b = $(`tool-${id}`), owned = G.tools[id];
    b.classList.toggle('locked', !owned); b.classList.toggle('on', owned && P.tool === id);
    b.querySelector('.cd').style.setProperty('--p', `${(C.cd[id] / TOOLS[id].cd) * 100}%`);
  }
  const rv = $('tool-reveal'); rv.classList.toggle('locked', !G.tools.lamp); rv.querySelector('.cd').style.setProperty('--p', `${(C.cd.reveal / REVEAL_CD) * 100}%`);
  if (touchUi()) updateTouch();
  $('crosshair').classList.toggle('tp', PL.camMode === 'third');
  const runShown = !!(SETTINGS.runToggle && PL.runOn);
  if ($('runChip').hidden === runShown) $('runChip').hidden = !runShown;
  // tracker
  if (quest) {
    const key = quest.title + '|' + quest.text;
    if (key !== H.tracker) { H.tracker = key; $('trackTitle').textContent = quest.title; $('trackText').textContent = quest.text; }
    let dist = '';
    if (quest.target) dist = quest.target.floor && quest.target.floor !== W.id ? (quest.target.where || 'op een andere diepte') : `${Math.round(Math.hypot(quest.target.x - P.x, quest.target.z - P.z))} m`;
    if ($('trackDist').textContent !== dist) $('trackDist').textContent = dist;
  }
  // numbers (the HUD may be zoomed: positions are in its own pixels)
  const zf = 1 / (H.zoom || 1);
  for (let i = H.numbers.length - 1; i >= 0; i--) {
    const n = H.numbers[i]; n.t += dt;
    proj.set(n.x + n.vx * n.t, n.y + n.t * 1.1, n.z).project(R.camera);
    const vis = proj.z < 1 && proj.z > -1;
    n.d.style.transform = `translate(${(proj.x * 0.5 + 0.5) * innerWidth * zf}px,${(-proj.y * 0.5 + 0.5) * innerHeight * zf}px) translate(-50%,-50%)`;
    n.d.style.opacity = vis ? Math.max(0, 1 - n.t / 0.9) : 0;
    if (n.t > 0.9) { n.d.remove(); H.numbers.splice(i, 1); }
  }
  // minimap (not while it is folded away)
  H.mapT -= dt;
  if (H.mapT <= 0) { H.mapT = 1 / 15; if (!document.body.classList.contains('nomini')) drawMinimap(quest); }
}

// the touch buttons: only what you can use right now
function updateTouch() {
  const owned = TOOL_ORDER.filter(t => G.tools[t]), tool = TOOLS[P.tool];
  const key = `${owned.join()}|${P.tool}|${!!P.carry}`;
  if (key === H.touchKey) return;
  H.touchKey = key;
  const any = owned.length > 0, atk = $('tAttack'), tb = $('tTool');
  atk.hidden = !any || !!P.carry; tb.hidden = !any; $('tReveal').hidden = !G.tools.lamp;
  if (tool) {
    atk.style.setProperty('--c', tool.css); atk.setAttribute('aria-label', `${tool.name}: ${tool.attack}`);
    tb.style.setProperty('--c', tool.css); $('tToolIcon').textContent = tool.icon; $('tToolName').textContent = SHORT[P.tool] || tool.name;
    tb.setAttribute('aria-label', owned.length > 1 ? `${tool.name} in je hand, tik om te wisselen` : `${tool.name} in je hand`);
  }
}
function nextTool() {
  const owned = TOOL_ORDER.filter(t => G.tools[t]);
  if (!owned.length) return;
  // with one tool, a tap tells you what it does
  if (owned.length === 1) { const t = TOOLS[owned[0]]; toast(t.name, t.attack); return; }
  UI.selectTool?.(owned[(owned.indexOf(P.tool) + 1) % owned.length]);
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
    const pulse = SETTINGS.motion === 'reduced' ? 0 : Math.sin(R.time * 4) * 2;
    g.strokeStyle = '#ffb84a'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, z, scale * 0.6 + pulse, 0, Math.PI * 2); g.stroke();
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
