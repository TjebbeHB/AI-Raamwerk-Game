// The character creator: who you are before you go down. A full-screen screen after 'Begin de
// afdaling' (and 'Nieuw spel') in three steps: jij (name, how people address you and talk about you,
// a quick look), uiterlijk (every field of the look schema, extras and the things you found in the
// Gewelf) and je rol (the four archetypes, then 'Eerst oefenen' or 'Meteen beginnen').
//   const res = await openCreator();   // {hero, tutorial}, or null when closed; menus.js starts newGame(res)
// A big pixel portrait (ui/portrait.js) and a small turning 3D figure (its own little renderer,
// disposed on close) follow every change. The last hero is remembered for the next new game.
import * as THREE from 'three';
import {el, addStyles, clamp, IS_TOUCH} from '../core/util.js';
import {SFX} from '../game/bus.js';
import {LOOK_OPTIONS, EXTRAS, normalizeLook, randomLook} from '../content/looks.js';
import {DEFAULT_LOOK, isUnlocked} from '../game/hero.js';
import {COSMETICS} from '../content/items.js';
import {ARCHETYPES, HERO_PRESETS, archetypeById, makeHero, NAME_MAX} from '../content/archetypes.js';
import {showPortrait, hidePortrait, portraitURL} from './portrait.js';
import {makeHuman, disposeModel} from '../engine/models.js';
import {keyLabel} from '../core/keys.js';

const LAST_KEY = 'orakel-dalwijk-hero-v1';
const STEPS = ['Jij', 'Uiterlijk', 'Je rol'];
const ADDRESS = [['mevrouw', 'Mevrouw'], ['meneer', 'Meneer'], ['neutraal', 'Neutraal']];
const PRONOUNS = [['hij', 'hij · hem'], ['zij', 'zij · haar'], ['die', 'die · hen']];
const FORMS = {hij: ['hij', 'hem'], zij: ['zij', 'haar'], die: ['die', 'hen']};
const GROUPS = ['Lichaam', 'Gezicht', 'Haar', 'Kleding', 'Accessoires', 'Extra’s', 'Vondsten'];
// optional colours where 'nothing' is a real choice
const NULLABLE = {tie: 'Geen', scarf: 'Geen', facialHairColor: 'Als je haar', glassesColor: 'Standaard', scarfColor: 'Standaard', hatColor: 'Standaard'};
// extras from the look schema that suit a hero, with when they make sense
const EXTRA_KEYS = [
  ['sleeves'], ['pocketsquare', l => ['blazer', 'vest'].includes(l.top)], ['chain', l => l.glasses !== 'none'], ['cateye', l => !['none', 'shades'].includes(l.glasses)],
  ['shadesUp', l => l.hat === 'none' && l.glasses !== 'shades'], ['pencil', l => l.hair === 'bun'], ['messy', l => !['bald', 'buzz', 'headscarf'].includes(l.hair)],
  ['ink'], ['tape'], ['keyring'], ['watchchain'], ['socks'], ['mailbag'], ['twinkle'],
];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const hex6 = n => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;

// ---------------------------------------------------------------- the things you find in the Gewelf
// The special pieces of a cosmetic (the top hat, the hard hat, the quill, the Hawaii shirt, the
// hi-vis vest, the director's shades) stay locked in the lists until you have earned them.
const COMMON = {hat: ['cap'], top: ['robe']};
const LOCK = {};
for (const c of COSMETICS) for (const [k, v] of Object.entries(c.look)) {
  if (['hat', 'top', 'glasses'].includes(k) && typeof v === 'string' && !(COMMON[k] || []).includes(v)) LOCK[`${k}:${v}`] ??= c;
}
const lockOf = (k, v) => { const c = LOCK[`${k}:${v}`]; return c && !isUnlocked(c.id) ? c : null; };
function allowed(look) {
  const L = {...look};
  if (lockOf('hat', L.hat)) L.hat = 'none';
  if (lockOf('top', L.top)) L.top = 'blazer';
  if (lockOf('glasses', L.glasses)) L.glasses = 'none';
  return normalizeLook(L);
}
const lookOf = partial => allowed(normalizeLook({...DEFAULT_LOOK, ...partial, mood: 'neutral'}));

// ---------------------------------------------------------------- styles
addStyles('creator', `
#creator{position:fixed;inset:0;z-index:35;display:grid;grid-template-rows:auto minmax(0,1fr) auto;color:var(--parch);
  background:radial-gradient(90% 70% at 25% 15%,rgba(80,52,22,.62),rgba(6,4,2,.97) 72%),#070504;animation:cr-in .3s ease-out}
@keyframes cr-in{from{opacity:0}to{opacity:1}}
#creator :focus-visible{outline:2px solid var(--gold-hi);outline-offset:2px}
#creator button{font-family:var(--f-ui)}
.cr-head{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left));border-bottom:1px solid var(--line)}
.cr-head h2{font-family:var(--f-display);font-weight:600;font-size:21px;margin:0;flex:1;white-space:nowrap}
.cr-pills{display:flex;gap:6px;flex-wrap:nowrap}
.cr-pill{pointer-events:auto;display:flex;gap:6px;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(242,226,196,.05);color:var(--dim);font-size:14px;cursor:pointer;white-space:nowrap}
.cr-pill b{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(242,226,196,.12);font-size:12px;color:var(--parch)}
.cr-pill.on{color:var(--parch);border-color:var(--gold)}.cr-pill.on b{background:var(--gold);color:#24180c}
.cr-main{display:grid;grid-template-columns:minmax(290px,340px) minmax(0,1fr);gap:26px;padding:18px max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left));min-height:0;max-width:1240px;width:100%;margin:0 auto;box-sizing:border-box}
.cr-preview{display:grid;align-content:start;justify-items:center;gap:12px;padding-bottom:16px}
.cr-portrait{width:288px;height:288px;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.55)}
.cr-under{display:flex;gap:12px;align-items:center;width:288px}
.cr-3d{width:120px;height:160px;flex:none;border-radius:12px;border:1px solid var(--line);background:radial-gradient(70% 60% at 50% 35%,rgba(232,194,122,.16),rgba(0,0,0,.35));touch-action:none;cursor:grab}
.cr-plate{min-width:0;display:grid;gap:3px}
.cr-plate b{font-family:var(--f-display);font-size:20px;line-height:1.15;word-break:break-word}
.cr-plate span{font-size:13px;color:var(--dim);line-height:1.35}
.cr-plate i{font-style:normal;color:var(--c,var(--gold))}
.cr-panel{overflow:auto;min-height:0;padding:0 6px 24px 2px;overscroll-behavior:contain}
.cr-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px max(16px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));border-top:1px solid var(--line);background:rgba(10,7,4,.7)}
.cr-grow{flex:1}
#creator .go:disabled,#creator .btn:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(.5);box-shadow:none}
.cr-practice{display:grid;gap:2px;text-align:left;padding:9px 18px}
.cr-practice .cr-big{display:flex;gap:8px;align-items:center;font-size:17px}
.cr-badge{display:inline-block;background:#24180c;color:#f0cf88;border-radius:10px;padding:1px 8px;font:600 11px var(--f-ui);letter-spacing:.06em;text-transform:uppercase}
.cr-rec{font:500 12.5px var(--f-ui);letter-spacing:0;opacity:.85}
.cr-direct{padding:11px 16px;font-size:15px}
.cr-sec{margin:0 0 20px}
.cr-sec h3{font-family:var(--f-display);font-weight:600;font-size:18px;color:var(--gold-hi);margin:0 0 9px}
.cr-help{font-family:var(--f-body);font-size:16.5px;color:var(--dim);margin:7px 0 0;line-height:1.38;max-width:640px}
.cr-sample{font-family:var(--f-body);font-style:italic;font-size:17.5px;margin:9px 0 0;color:#eadcbc;line-height:1.38}
.cr-sample b{font-style:normal;font-family:var(--f-ui);font-size:13px;color:var(--gold);margin-right:6px}
#creator input[type=text]{width:100%;max-width:420px;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--line-strong);background:rgba(0,0,0,.35);color:var(--parch);font:18px var(--f-ui);user-select:text;-webkit-user-select:text}
.cr-chips{display:flex;flex-wrap:wrap;gap:6px}
.cr-chip{min-height:38px;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:rgba(242,226,196,.05);color:var(--parch);font-size:14px;cursor:pointer}
.cr-chip:hover{border-color:var(--line-strong)}
.cr-chip.on{background:linear-gradient(#f0cf88,#d8a952);color:#24180c;border-color:transparent;font-weight:600}
.cr-chip.locked{opacity:.6;border-style:dashed}
.cr-row{display:grid;gap:7px;padding:11px 0;border-bottom:1px solid rgba(242,226,196,.07)}
.cr-lab{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.cr-lab small{text-transform:none;letter-spacing:0;margin-left:6px;opacity:.85}
.cr-sws{display:flex;flex-wrap:wrap;gap:7px}
.cr-sw{width:32px;height:32px;padding:0;border-radius:50%;border:2px solid rgba(0,0,0,.45);background:var(--sw);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);cursor:pointer}
.cr-sw.on{outline:3px solid var(--gold-hi);outline-offset:2px}
.cr-sw.none{width:auto;padding:0 11px;border-radius:16px;font-size:12px;color:var(--parch);background:repeating-linear-gradient(45deg,#3a3028 0 5px,#241c14 5px 10px)}
#creator input[type=range]{width:100%;max-width:420px;accent-color:var(--gold)}
.cr-ends{display:flex;justify-content:space-between;max-width:420px;font-size:12px;color:var(--dim)}
.cr-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;position:sticky;top:0;z-index:1;padding:4px 0 8px;background:linear-gradient(rgba(14,10,6,.97) 80%,rgba(14,10,6,0))}
.cr-msg{min-height:20px;font-size:14px;color:var(--open);margin:4px 0}
.cr-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:10px}
.cr-preset{display:grid;justify-items:center;gap:6px;padding:10px 6px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--parch);cursor:pointer;font-size:13px;line-height:1.25}
.cr-preset img{width:96px;height:96px;border-radius:10px}
.cr-preset.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.cr-dice{display:grid;place-items:center;width:96px;height:96px;border-radius:10px;background:rgba(242,226,196,.06);font-size:44px}
.cr-link{background:none;border:0;padding:6px 0;color:var(--gold);font-size:15px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.cr-cos{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.cr-co{display:grid;gap:3px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,.22);color:var(--parch);font-size:14px;line-height:1.35;cursor:pointer}
.cr-co b{font-family:var(--f-display);font-size:14px;color:var(--gold-hi)}
.cr-co span{color:var(--dim);font-size:13px}
.cr-co.locked{opacity:.62;cursor:default;border-style:dashed}
.cr-co.on{border-color:var(--good);box-shadow:0 0 0 1px var(--good)}
.cr-archs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.cr-arch{display:grid;gap:8px;align-content:start;padding:14px 16px;border-radius:14px;border:1px solid var(--line);border-top:4px solid var(--c);background:rgba(0,0,0,.28);cursor:pointer;transition:transform .15s,box-shadow .15s}
.cr-arch:hover{transform:translateY(-2px)}
.cr-arch.on{border-color:var(--c);box-shadow:0 0 0 2px var(--c),0 12px 30px rgba(0,0,0,.4)}
.cr-arch-top{display:flex;gap:12px;align-items:center}
.cr-arch-ic{font-size:34px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.cr-arch-top b{display:block;font-family:var(--f-display);font-size:19px;color:var(--parch)}
.cr-arch-top span{font-size:13px;color:var(--c)}
.cr-arch .cr-check{margin-left:auto;font-size:13px;color:var(--c);font-weight:700}
.cr-tag{margin:0;font-family:var(--f-body);font-style:italic;font-size:17px;line-height:1.3;color:#eadcbc}
.cr-arch ul{margin:0;padding-left:18px;font-size:14px;line-height:1.45}
.cr-abil{display:grid;gap:2px;padding:8px 10px;border-radius:10px;background:rgba(242,226,196,.05);border:1px solid var(--line);font-size:14px;line-height:1.4}
.cr-abil b{font-family:var(--f-display);font-size:15px;color:var(--c)}
.cr-weak{margin:0;font-size:13.5px;line-height:1.4;color:var(--dim)}
.cr-weak em{font-style:normal;color:var(--parch)}
@media (max-width:760px){
  .cr-main{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:8px;padding-top:10px}
  .cr-preview{display:flex;gap:10px;align-items:center;justify-content:flex-start;padding-bottom:4px}
  .cr-portrait{width:120px;height:120px;border-radius:10px}
  .cr-under{display:contents}
  .cr-3d{width:84px;height:112px}
  .cr-plate b{font-size:17px}
  .cr-plate span:last-child{display:none}
  .cr-head h2{display:none}
  .cr-pills{flex:1}
  .cr-pill{padding:6px 10px}
  .cr-foot .go,.cr-foot .btn{flex:1 1 auto}
  .cr-practice{order:-1;flex:1 1 100% !important}
  .cr-presets{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .cr-preset img,.cr-dice{width:84px;height:84px}
}
@media (max-width:380px){.cr-pill{font-size:12px;padding:5px 8px}.cr-pill b{display:none}}
@media (max-height:560px) and (min-width:761px){.cr-portrait{width:180px;height:180px}.cr-under{width:180px}.cr-3d{width:80px;height:106px}}
`);

// ---------------------------------------------------------------- the small 3D figure
function preview3d() {
  const canvas = el('canvas', {class: 'cr-3d', role: 'img', 'aria-label': 'Je personage in 3D: sleep om het te draaien'});
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'low-power'}); } catch (e) { renderer = null; }
  if (!renderer) { canvas.hidden = true; return {canvas, set() {}, gesture() {}, start() {}, dispose() {}}; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 3 / 4, 0.1, 30);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1d12, 1.5));
  const key = new THREE.DirectionalLight(0xffe0b0, 2.4); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc3ff, 1.3); rim.position.set(-3, 2.5, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false}));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const probe = {value: new THREE.Color(0.3, 0.27, 0.24)}, st = {t: 0, walk: 0};
  let model = null, yaw = 0.6, drag = null, idle = 0, raf = 0, last = 0, timer = 0, w = 0, h = 0;
  function build(look) {
    if (model) disposeModel(model);
    model = makeHuman({...look, probe});
    scene.add(model.root);
    const top = 1.95 * (look.height || 1);
    cam.position.set(0, top * 0.56, 4.9); cam.lookAt(0, top * 0.48, 0);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!drag) { idle -= dt; if (idle <= 0) yaw += dt * 0.55; }
    st.t += dt;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw && ch && (cw !== w || ch !== h)) { w = cw; h = ch; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (model) { model.root.rotation.y = yaw; model.animate(dt, st); }
    if (w) renderer.render(scene, cam);
  }
  canvas.addEventListener('pointerdown', e => { drag = {x: e.clientX, yaw}; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.014; });
  const up = () => { drag = null; idle = 2.5; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  return {
    canvas,
    set(look) { clearTimeout(timer); timer = setTimeout(() => build(look), model ? 90 : 0); },
    gesture(name) { model?.gesture?.(name); },
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    dispose() {
      cancelAnimationFrame(raf); clearTimeout(timer);
      if (model) disposeModel(model);
      floor.geometry.dispose(); floor.material.dispose();
      renderer.dispose(); renderer.forceContextLoss?.();
    },
  };
}

// ---------------------------------------------------------------- the screen
let OPEN = null;
export function openCreator() {
  if (OPEN) return OPEN;
  OPEN = new Promise(resolve => build(resolve)).finally(() => { OPEN = null; });
  return OPEN;
}

function initialDraft() {
  let last = null;
  try { last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { last = null; }
  const h = makeHero(last || {look: HERO_PRESETS[0].look});
  return {step: 0, name: h.name, address: h.address, pronouns: h.pronouns, archetype: h.archetype, look: allowed(h.look),
    group: GROUPS[0], undo: [], prev: {}, mood: 'happy', preset: last ? null : HERO_PRESETS[0].id, msg: ''};
}

function build(resolve) {
  const D = initialDraft();
  const portrait = el('canvas', {class: 'cr-portrait', width: 288, height: 288, role: 'img', 'aria-label': 'Je portret'});
  const fig = preview3d();
  const plate = el('div', {class: 'cr-plate', 'aria-live': 'polite'});
  const pills = el('nav', {class: 'cr-pills', 'aria-label': 'Stappen'});
  const panel = el('div', {class: 'cr-panel'});
  const foot = el('div', {class: 'cr-foot'});
  const root = el('div', {id: 'creator', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Je personage maken'},
    el('header', {class: 'cr-head'}, el('h2', {text: 'Je personage'}), pills,
      el('button', {class: 'btn icon', 'aria-label': 'Terug naar het titelscherm', title: 'Terug naar het titelscherm', onclick: () => close(null)}, '✕')),
    el('div', {class: 'cr-main'}, el('aside', {class: 'cr-preview'}, portrait, el('div', {class: 'cr-under'}, fig.canvas, plate)), panel),
    foot);

  // ---- keys: the game's own key handler would swallow Tab and Space, so they stop here
  root.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (D.step > 0) go(D.step - 1); else close(null); }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); go(1); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.arch) { e.preventDefault(); pickArch(e.target.dataset.arch); }
  });

  // ---- the preview follows every change
  const subject = () => ({...D.look, archetype: D.archetype});
  let pT = 0, moodT = 0;
  function refresh() {
    clearTimeout(pT);
    pT = setTimeout(() => { showPortrait(portrait, subject(), D.mood, {size: 288}); fig.set(D.look); }, 40);
    plateText();
  }
  function react(mood) {
    D.mood = mood;
    clearTimeout(moodT);
    moodT = setTimeout(() => { D.mood = 'neutral'; showPortrait(portrait, subject(), 'neutral', {size: 288}); }, 1500);
  }
  function plateText() {
    const a = archetypeById(D.archetype);
    plate.style.setProperty('--c', a?.css || 'var(--gold)');
    plate.replaceChildren(el('b', {text: D.name.trim() || 'Naamloze adviseur'}),
      el('span', {}, a ? el('i', {text: `${a.name} (${a.role})`}) : 'Nog geen rol gekozen'),
      el('span', {text: 'Adviseur Dienstverlening, gemeente Dalwijk'}));
  }
  const snapshot = () => JSON.stringify(D.look);
  function pushUndo(snap = snapshot()) { D.undo.push(snap); if (D.undo.length > 40) D.undo.shift(); }
  function setLook(k, v, mood = 'happy') {
    pushUndo();
    D.look = allowed({...D.look, [k]: v});
    D.preset = null; D.msg = '';
    react(mood); refresh(); render();
  }

  // ---- steps
  function go(step) {
    D.step = clamp(step, 0, STEPS.length - 1);
    D.msg = '';
    render(true);
    if (D.step === 2) fig.gesture('wave');
  }
  function render(fresh = false) {
    const fid = !fresh && document.activeElement?.dataset?.fid, top = panel.scrollTop;
    pills.replaceChildren(...STEPS.map((s, i) => el('button', {class: `cr-pill${i === D.step ? ' on' : ''}`, 'aria-current': i === D.step ? 'step' : null, 'data-fid': `pill${i}`, onclick: () => go(i)}, el('b', {text: i + 1}), s)));
    panel.replaceChildren(...[stepJij, stepLook, stepRol][D.step]());
    foot.replaceChildren(...footer());
    plateText();
    // a fresh step starts at the top; with a keyboard the focus goes along (not on touch: no surprise keyboard)
    if (fresh) { panel.scrollTop = 0; if (!IS_TOUCH) panel.querySelector('input,button,[tabindex]')?.focus({preventScroll: true}); }
    else {
      panel.scrollTop = top;
      if (fid) root.querySelector(`[data-fid="${CSS.escape(fid)}"]`)?.focus({preventScroll: true});
    }
  }
  const sec = (title, ...kids) => el('section', {class: 'cr-sec'}, title ? el('h3', {text: title}) : null, ...kids);
  const seg = (list, cur, fid, pick) => el('div', {class: 'cr-chips', role: 'radiogroup'},
    list.map(([v, t]) => el('button', {class: `cr-chip${cur === v ? ' on' : ''}`, role: 'radio', 'aria-checked': String(cur === v), 'data-fid': `${fid}:${v}`, onclick: () => pick(v)}, t)));

  // ---- step 1: jij
  function samples() {
    const [subj, obj] = FORMS[D.pronouns] || FORMS.die, n = D.name.trim();
    const greet = {mevrouw: 'mevrouw de adviseur', meneer: 'meneer de adviseur'}[D.address] || 'beste adviseur';
    return [
      el('p', {class: 'cr-sample'}, el('b', {text: 'Joop'}), `‘Goedemorgen, ${greet}.${n ? ` Of mag ik ${n} zeggen?` : ''}’`),
      el('p', {class: 'cr-sample'}, el('b', {text: 'Ilse'}), `‘${n || 'De nieuwe adviseur'}? ${cap(subj)} is net naar beneden. Ik zou ${obj} maar volgen.’`),
    ];
  }
  function stepJij() {
    const sampleA = el('div'), sampleB = el('div');
    const fill = () => { const [a, b] = samples(); sampleA.replaceChildren(a); sampleB.replaceChildren(b); };
    fill();
    const name = el('input', {type: 'text', value: D.name, maxlength: NAME_MAX, placeholder: 'Bijvoorbeeld Sam', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Je naam', 'data-fid': 'name'});
    name.addEventListener('input', () => { D.name = name.value.slice(0, NAME_MAX); plateText(); fill(); });
    const presets = el('div', {class: 'cr-presets'},
      HERO_PRESETS.map(p => el('button', {class: `cr-preset${D.preset === p.id ? ' on' : ''}`, 'data-fid': `preset:${p.id}`, 'aria-pressed': String(D.preset === p.id), onclick: () => {
        pushUndo(); D.look = lookOf(p.look); D.preset = p.id; react('laugh'); refresh(); render(); fig.gesture('wave');
      }}, el('img', {class: 'pt-face', alt: '', src: portraitURL(lookOf(p.look), 'happy', {scale: 1})}), p.name)),
      el('button', {class: 'cr-preset', 'data-fid': 'preset:random', onclick: surprise}, el('span', {class: 'cr-dice', 'aria-hidden': 'true', text: '🎲'}), 'Verras me'));
    return [
      sec('Hoe heet je?', name, el('p', {class: 'cr-help', text: 'Mag ook leeg blijven: dan ben je gewoon de nieuwe adviseur.'})),
      sec('Hoe spreken mensen je aan?', seg(ADDRESS, D.address, 'address', v => { D.address = v; react('happy'); render(); }), sampleA),
      sec('Hoe praten mensen over je?', seg(PRONOUNS, D.pronouns, 'pron', v => { D.pronouns = v; render(); }), sampleB),
      sec('Snel een uiterlijk', el('p', {class: 'cr-help', style: 'margin:0 0 10px', text: 'Kies er een om mee te beginnen. In de volgende stap kun je alles aanpassen, van je kapsel tot je sokken.'}), presets,
        el('button', {class: 'cr-link', 'data-fid': 'skip', onclick: () => go(2)}, 'Zo is het goed: ga meteen naar je rol →')),
    ];
  }
  function surprise() {
    pushUndo();
    D.look = allowed(randomLook());
    D.preset = null; D.msg = '';
    react('surprised'); refresh(); render(); fig.gesture('lookaround');
    SFX.play('pick');
  }

  // ---- step 2: uiterlijk
  function stepLook() {
    const out = [];
    out.push(el('div', {class: 'cr-tools'},
      el('button', {class: 'btn', 'data-fid': 'random', onclick: surprise}, '🎲 Verras me'),
      el('button', {class: 'btn', 'data-fid': 'undo', disabled: !D.undo.length, onclick: () => { D.look = JSON.parse(D.undo.pop()); react('thinking'); refresh(); render(); }}, '↶ Stap terug')));
    const found = COSMETICS.filter(c => isUnlocked(c.id)).length;
    out.push(el('div', {class: 'cr-tabs', role: 'tablist'}, GROUPS.map(g => el('button', {class: `cr-chip${D.group === g ? ' on' : ''}`, role: 'tab', 'aria-selected': String(D.group === g), 'data-fid': `group:${g}`,
      onclick: () => { D.group = g; D.msg = ''; render(); panel.scrollTop = 0; }}, g === 'Vondsten' ? `${g} ${found}/${COSMETICS.length}` : g))));
    out.push(el('div', {class: 'cr-msg', 'aria-live': 'polite', text: D.msg}));
    if (D.group === 'Extra’s') out.push(...extrasRows());
    else if (D.group === 'Vondsten') out.push(cosmeticsRows());
    else for (const o of LOOK_OPTIONS) if (o.group === D.group && (!o.when || o.when(D.look))) out.push(optionRow(o));
    return out;
  }
  function optionRow(o) {
    const v = D.look[o.key];
    const row = el('div', {class: 'cr-row'}, el('span', {class: 'cr-lab'}, o.label, o.hint ? el('small', {text: o.hint}) : null));
    if (o.type === 'choice') {
      row.append(el('div', {class: 'cr-chips', role: 'radiogroup', 'aria-label': o.label}, o.options.map(c => {
        const lock = lockOf(o.key, c.id);
        return el('button', {class: `cr-chip${v === c.id ? ' on' : ''}${lock ? ' locked' : ''}`, role: 'radio', 'aria-checked': String(v === c.id), 'data-fid': `${o.key}:${c.id}`,
          title: lock ? `Nog op slot: ${lock.hint}` : null, onclick: () => (lock ? locked(lock) : setLook(o.key, c.id))}, lock ? `🔒 ${c.label}` : c.label);
      })));
    } else if (o.type === 'color') {
      const box = el('div', {class: 'cr-sws', role: 'radiogroup', 'aria-label': o.label});
      if (o.key in NULLABLE) box.append(el('button', {class: `cr-sw none${v === null || v === undefined ? ' on' : ''}`, role: 'radio', 'aria-checked': String(v == null), 'data-fid': `${o.key}:none`, onclick: () => setLook(o.key, null)}, NULLABLE[o.key]));
      for (const c of o.palette) box.append(el('button', {class: `cr-sw${v === c.hex ? ' on' : ''}`, role: 'radio', 'aria-checked': String(v === c.hex), style: `--sw:${hex6(c.hex)}`, title: c.name, 'aria-label': c.name, 'data-fid': `${o.key}:${c.hex}`, onclick: () => setLook(o.key, c.hex)}));
      row.append(box);
    } else if (o.type === 'range') {
      const input = el('input', {type: 'range', min: o.min, max: o.max, step: o.step, value: v, 'aria-label': o.label, 'data-fid': o.key});
      let snap = null;
      input.addEventListener('pointerdown', () => { snap = snapshot(); });
      input.addEventListener('input', () => { snap ??= snapshot(); D.look = allowed({...D.look, [o.key]: +input.value}); D.preset = null; refresh(); });
      input.addEventListener('change', () => { if (snap) pushUndo(snap); snap = null; react('happy'); refresh(); });
      row.append(input, el('div', {class: 'cr-ends'}, el('span', {text: o.ends?.[0] || ''}), el('span', {text: o.ends?.[1] || ''})));
    } else if (o.type === 'toggle') {
      row.append(el('div', {class: 'cr-chips'}, el('button', {class: `cr-chip${v ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!v), 'data-fid': `${o.key}:t`, onclick: () => setLook(o.key, !v)}, v ? 'Ja' : 'Nee')));
    }
    return row;
  }
  function extrasRows() {
    const list = D.look.extras || [];
    const chips = EXTRA_KEYS.filter(([k, when]) => !when || when(D.look) || list.includes(k)).map(([k]) => {
      const on = list.includes(k);
      return el('button', {class: `cr-chip${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), 'data-fid': `extra:${k}`,
        onclick: () => setLook('extras', on ? list.filter(x => x !== k) : [...list, k])}, cap(EXTRAS[k]));
    });
    return [el('p', {class: 'cr-help', style: 'margin:0 0 10px', text: 'Kleine dingen die je herkenbaar maken. Zet aan wat bij je past.'}), el('div', {class: 'cr-chips'}, chips)];
  }
  const worn = c => Object.entries(c.look).every(([k, v]) => D.look[k] === v);
  function wear(c) {
    pushUndo();
    if (worn(c)) {
      const prev = D.prev[c.id] || {}, base = normalizeLook(DEFAULT_LOOK);
      const patch = Object.fromEntries(Object.keys(c.look).map(k => [k, k in prev ? prev[k] : base[k] ?? null]));
      delete D.prev[c.id];
      D.look = allowed({...D.look, ...patch});
      react('neutral');
    } else {
      D.prev[c.id] = Object.fromEntries(Object.keys(c.look).map(k => [k, D.look[k]]));
      D.look = normalizeLook({...D.look, ...c.look});
      react('laugh'); SFX.play('pick');
    }
    D.preset = null; refresh(); render();
  }
  function cosmeticsRows() {
    return el('div', {}, el('p', {class: 'cr-help', style: 'margin:0 0 10px', text: 'Dingen die je in het Gewelf verdient. Wat je eenmaal hebt, blijft van jou, ook in een volgend spel in deze browser.'}),
      el('div', {class: 'cr-cos'}, COSMETICS.map(c => {
        const have = isUnlocked(c.id), on = have && worn(c);
        return el('button', {class: `cr-co${have ? '' : ' locked'}${on ? ' on' : ''}`, 'data-fid': `cos:${c.id}`, 'aria-pressed': have ? String(on) : null, 'aria-disabled': have ? null : 'true',
          onclick: () => (have ? wear(c) : locked(c))},
          el('b', {text: have ? c.name : `🔒 ${c.name}`}), el('span', {text: have ? (on ? 'Je draagt dit. Klik om het af te doen.' : 'Klik om het te dragen.') : c.hint}));
      })));
  }
  function locked(c) { D.msg = `Nog op slot. ${c.name}: ${c.hint}`; SFX.play('locked'); render(); }

  // ---- step 3: je rol
  function pickArch(id) {
    const a = archetypeById(id);
    if (!a) return;
    D.archetype = id;
    react(a.mood || 'happy'); refresh(); render();
    fig.gesture('wave'); SFX.play('pick');
  }
  function stepRol() {
    const ab = keyLabel('ability');
    const cards = ARCHETYPES.map(a => {
      const on = D.archetype === a.id;
      return el('div', {class: `cr-arch${on ? ' on' : ''}`, style: `--c:${a.css}`, role: 'radio', tabindex: 0, 'aria-checked': String(on), 'data-arch': a.id, 'data-fid': `arch:${a.id}`, onclick: () => pickArch(a.id)},
        el('div', {class: 'cr-arch-top'}, el('span', {class: 'cr-arch-ic', 'aria-hidden': 'true', text: a.icon}),
          el('div', {}, el('b', {text: a.name}), el('span', {text: `(${a.role})`})), on ? el('span', {class: 'cr-check', text: '✓ gekozen'}) : null),
        el('p', {class: 'cr-tag', text: a.tagline}),
        el('ul', {}, a.passives.map(p => el('li', {text: p}))),
        el('div', {class: 'cr-abil'}, el('span', {class: 'label', text: `Vaardigheid · toets ${ab}`}), el('b', {text: a.ability.name}), el('span', {text: a.ability.text})),
        el('p', {class: 'cr-weak'}, el('span', {class: 'label', text: 'Zwakte '}), el('em', {text: a.weakness})));
    });
    return [
      el('p', {class: 'cr-help', style: 'margin:0 0 14px', text: 'Iedereen kan alles in het Gewelf. Je rol bepaalt waar je goed in bent, en waar je collega’s je mee plagen.'}),
      el('div', {class: 'cr-archs', role: 'radiogroup', 'aria-label': 'Je rol'}, cards),
      el('button', {class: 'cr-link', 'data-fid': 'archrandom', onclick: () => { const rest = ARCHETYPES.filter(a => a.id !== D.archetype); pickArch(rest[Math.floor(Math.random() * rest.length)].id); }}, '🎲 Weet je het niet? Kies jij maar'),
      D.archetype ? null : el('p', {class: 'cr-help', text: 'Kies een rol, dan kun je beginnen.'}),
    ];
  }

  function footer() {
    const back = D.step > 0
      ? el('button', {class: 'btn', 'data-fid': 'back', onclick: () => go(D.step - 1)}, `← ${STEPS[D.step - 1]}`)
      : el('button', {class: 'btn', 'data-fid': 'back', onclick: () => close(null)}, '← Titelscherm');
    if (D.step < STEPS.length - 1) return [back, el('span', {class: 'cr-grow'}), el('button', {class: 'go', 'data-fid': 'next', onclick: () => go(D.step + 1)}, `Verder: ${STEPS[D.step + 1].toLowerCase()} →`)];
    const ok = !!D.archetype;
    return [back, el('span', {class: 'cr-grow'}),
      el('button', {class: 'btn cr-direct', 'data-fid': 'direct', disabled: !ok, onclick: () => finish(false)}, 'Meteen beginnen'),
      el('button', {class: 'go cr-practice', 'data-fid': 'practice', disabled: !ok, onclick: () => finish(true)},
        el('span', {class: 'cr-big'}, 'Eerst oefenen', el('span', {class: 'cr-badge', text: 'aanbevolen'})),
        el('span', {class: 'cr-rec', text: 'ongeveer 5 minuten, aanbevolen als je niet vaak games speelt'}))];
  }

  // ---- done
  function finish(tutorial) {
    if (!D.archetype) return;
    const hero = makeHero({name: D.name, address: D.address, pronouns: D.pronouns, archetype: D.archetype, look: D.look});
    try { localStorage.setItem(LAST_KEY, JSON.stringify(hero)); } catch (e) { /* a private window: only for this game */ }
    SFX.play('tool');
    close({hero, tutorial});
  }
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    clearTimeout(pT); clearTimeout(moodT);
    hidePortrait(portrait); fig.dispose(); root.remove();
    resolve(result);
  }

  document.body.append(root);
  render(true);
  showPortrait(portrait, subject(), D.mood, {size: 288});
  fig.set(D.look); fig.start();
  react('happy');
}
