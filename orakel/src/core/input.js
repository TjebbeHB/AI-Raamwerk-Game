// Keyboard, mouse (pointer lock), wheel and touch. Edge-triggered presses are kept
// until the end of the frame, so a quick tap is never missed.
import {IS_TOUCH, clamp} from './util.js';

export const Input = {
  keys: new Set(), pressed: new Set(),
  mdx: 0, mdy: 0, wheel: 0, mouseDown: [false, false, false], clicks: [0, 0, 0],
  locked: false, canvas: null, enabled: true, touch: IS_TOUCH,
  move: {x: 0, y: 0},          // touch joystick, -1..1
  lookTouch: {dx: 0, dy: 0},
  onLockLost: null, onKey: null,
};

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function bindInput(canvas) {
  Input.canvas = canvas;
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!e.repeat) Input.pressed.add(e.code);
    Input.keys.add(e.code);
    Input.onKey?.(e);
  });
  addEventListener('keyup', e => Input.keys.delete(e.code));
  addEventListener('blur', () => { Input.keys.clear(); Input.mouseDown = [false, false, false]; });
  canvas.addEventListener('mousedown', e => {
    if (!Input.enabled) return;
    Input.mouseDown[e.button] = true;
    Input.clicks[e.button]++;
    if (!Input.locked && !Input.touch) lock();
  });
  addEventListener('mouseup', e => { Input.mouseDown[e.button] = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (!Input.locked) return;
    Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0;
  });
  canvas.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, {passive: false});
  document.addEventListener('pointerlockchange', () => {
    const was = Input.locked;
    Input.locked = document.pointerLockElement === canvas;
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

function bindTouch(canvas) {
  const joy = document.getElementById('joy'), knob = joy?.querySelector('i');
  let joyId = null, lookId = null, jx = 0, jy = 0, lx = 0, ly = 0;
  const R = 54;
  joy?.addEventListener('touchstart', e => {
    const t = e.changedTouches[0]; joyId = t.identifier;
    const r = joy.getBoundingClientRect(); jx = r.left + r.width / 2; jy = r.top + r.height / 2;
    e.preventDefault();
  }, {passive: false});
  canvas.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) if (lookId === null && t.clientX > innerWidth * 0.35) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
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
      if (t.identifier === joyId) { joyId = null; Input.move.x = Input.move.y = 0; if (knob) knob.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  const btn = (id, code, hold) => {
    const b = document.getElementById(id); if (!b) return;
    b.addEventListener('touchstart', e => { e.preventDefault(); press(code); if (hold) Input.keys.add(code); }, {passive: false});
    b.addEventListener('touchend', e => { e.preventDefault(); Input.keys.delete(code); }, {passive: false});
  };
  btn('tAttack', 'Attack', true); btn('tAct', 'KeyE'); btn('tDash', 'Space'); btn('tReveal', 'KeyR');
}
