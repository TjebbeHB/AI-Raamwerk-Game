// Keyboard, mouse (pointer lock), wheel and touch. Edge-triggered presses are kept
// until the end of the frame, so a quick tap is never missed.
// Games read actions, not keys: see core/keys.js (actionHit('interact'), keyLabel('dash')).
import {IS_TOUCH, clamp} from './util.js';
import {codesFor} from './keys.js';

export const Input = {
  keys: new Set(), pressed: new Set(),
  mdx: 0, mdy: 0, wheel: 0, mouseDown: [false, false, false], clicks: [0, 0, 0],
  locked: false, canvas: null, enabled: true, touch: IS_TOUCH,
  move: {x: 0, y: 0},          // touch joystick, -1..1
  lookTouch: {dx: 0, dy: 0},
  actAction: 'interact',       // what the touch E button does right now (ui/hud.js sets it: 'interact' or 'cycle')
  onLockLost: null, onKey: null,
};

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
const shown = e => !!(e && e.getClientRects().length && !e.closest('[hidden]'));
// the open modal (the topmost one when there are several), if any
export function openModalEl() {
  const list = [...document.querySelectorAll('.modal:not([hidden])')].filter(shown);
  return list.sort((a, b) => (+getComputedStyle(b).zIndex || 0) - (+getComputedStyle(a).zIndex || 0))[0] || null;
}
// In a menu, on the title screen or with the focus on a button, Tab, Space and the arrow keys do
// what they do on any web page; only in the world does the game keep them for itself.
function inUi(e) {
  const a = document.activeElement;
  if (a && a !== document.body && a !== Input.canvas && a.closest?.('button,input,select,textarea,[role=dialog],.modal,#title,[tabindex]')) return true;
  return !!openModalEl() || shown(document.getElementById('title'));
}
// keep Tab inside the open menu, so a keyboard never wanders into the HUD behind it
function trapTab(e) {
  const m = openModalEl();
  if (!m) return false;
  const items = [...m.querySelectorAll(FOCUSABLE)].filter(shown);
  if (!items.length) return false;
  const i = items.indexOf(document.activeElement);
  let next = null;
  if (i < 0) next = e.shiftKey ? items[items.length - 1] : items[0];
  else if (!e.shiftKey && i === items.length - 1) next = items[0];
  else if (e.shiftKey && i === 0) next = items[items.length - 1];
  if (next) { e.preventDefault(); next.focus(); }
  return true;
}

export function bindInput(canvas) {
  Input.canvas = canvas;
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const ui = inUi(e);
    if (e.code === 'Tab' && ui) trapTab(e);
    else if (BLOCK.has(e.code) && !ui) e.preventDefault();
    if (!e.repeat) Input.pressed.add(e.code);
    Input.keys.add(e.code);
    Input.onKey?.(e);
  });
  addEventListener('keyup', e => Input.keys.delete(e.code));
  addEventListener('blur', () => { Input.keys.clear(); Input.mouseDown = [false, false, false]; });
  canvas.addEventListener('mousedown', e => {
    if (!Input.enabled) return;
    // with a free mouse, a click in the world only takes the mouse back: it does not fire your tool
    // (unless this browser refuses to capture the mouse: then clicks keep working as before)
    if (!Input.locked && !Input.touch) { lock(); if (!Input.lockFailed) return; }
    Input.mouseDown[e.button] = true;
    Input.clicks[e.button]++;
  });
  addEventListener('mouseup', e => { Input.mouseDown[e.button] = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (!Input.locked) return;
    Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0;
  });
  canvas.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, {passive: false});
  document.addEventListener('pointerlockerror', () => { Input.lockFailed = true; });
  document.addEventListener('pointerlockchange', () => {
    const was = Input.locked;
    Input.locked = document.pointerLockElement === canvas;
    if (Input.locked) Input.lockFailed = false;
    // back in the world: the focus leaves the menu button you clicked, so Space dashes instead of pressing it again
    if (Input.locked) { const a = document.activeElement; if (a && a !== canvas) a.blur?.(); canvas.focus?.({preventScroll: true}); }
    if (was && !Input.locked) Input.onLockLost?.();
  });
  if (Input.touch) bindTouch(canvas);
}

export function lock() {
  if (Input.touch || !Input.canvas) return;
  try { const p = Input.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch (e) { /* not allowed now */ }
}
export function unlock() { if (document.pointerLockElement) document.exitPointerLock?.(); }

export const down = code => Input.keys.has(code);
export const hit = code => Input.pressed.has(code);
export function endFrame() {
  Input.pressed.clear();
  Input.mdx = Input.mdy = 0; Input.wheel = 0;
  Input.clicks = [0, 0, 0];
  Input.lookTouch.dx = Input.lookTouch.dy = 0;
}
// virtual press, used by touch buttons and tests
export const press = code => { Input.pressed.add(code); };
// press the key an action is bound to right now (so remapped keys keep working on touch buttons)
export const pressAction = action => press(codesFor(action)[0] || action);

// ---- touch: the joystick floats to wherever your left thumb lands in the lower left;
// every other touch on the world looks around, so the look area is most of the screen.
function bindTouch(canvas) {
  const joy = document.getElementById('joy'), knob = joy?.querySelector('i');
  let joyId = null, lookId = null, jx = 0, jy = 0, lx = 0, ly = 0;
  const R = 54;
  const joyZone = t => t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.45;
  const startJoy = (t, float) => {
    joyId = t.identifier;
    if (!joy) { jx = t.clientX; jy = t.clientY; return; }
    joy.style.transform = '';
    const r = joy.getBoundingClientRect(), hx = r.left + r.width / 2, hy = r.top + r.height / 2;
    if (float) { jx = t.clientX; jy = t.clientY; joy.style.transform = `translate(${jx - hx}px,${jy - hy}px)`; joy.classList.add('float'); }
    else { jx = hx; jy = hy; }
  };
  joy?.addEventListener('touchstart', e => { if (joyId === null) startJoy(e.changedTouches[0], false); e.preventDefault(); }, {passive: false});
  canvas.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (joyId === null && joyZone(t)) { startJoy(t, true); continue; }
      if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, {passive: false});
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const dx = clamp((t.clientX - jx) / R, -1, 1), dy = clamp((t.clientY - jy) / R, -1, 1);
        Input.move.x = dx; Input.move.y = dy;
        if (knob) knob.style.transform = `translate(${dx * R * 0.7}px,${dy * R * 0.7}px)`;
      } else if (t.identifier === lookId) {
        Input.lookTouch.dx += (t.clientX - lx) * 2.2; Input.lookTouch.dy += (t.clientY - ly) * 2.2;
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, {passive: true});
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null; Input.move.x = Input.move.y = 0;
        if (knob) knob.style.transform = '';
        if (joy) { joy.style.transform = ''; joy.classList.remove('float'); }
      }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  // a button presses an action (or a fixed code); hold keeps it down while the finger stays
  const btn = (id, what, hold) => {
    const b = document.getElementById(id); if (!b) return;
    const code = () => (typeof what === 'function' ? what() : what);
    let held = null;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); b.classList.add('down');
      held = code(); press(held); if (hold) Input.keys.add(held);
    }, {passive: false});
    const up = e => { e.preventDefault(); b.classList.remove('down'); if (held) Input.keys.delete(held); held = null; };
    b.addEventListener('touchend', up, {passive: false}); b.addEventListener('touchcancel', up, {passive: false});
  };
  btn('tAttack', 'Attack', true);
  btn('tAct', () => codesFor(Input.actAction || 'interact')[0]);
  btn('tDash', () => codesFor('dash')[0]);
  btn('tReveal', () => codesFor('reveal')[0]);
}
