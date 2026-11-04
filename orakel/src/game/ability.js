// Your special ability: one per archetype (content/archetypes.js), on key F (ACTIONS.ability), the
// slot after the tools and, on touch screens, the round button with your archetype's icon.
//   Handhaver    'Last onder dwangsom'   a giant stamp comes down on the spot: a shockwave that stuns
//   Datatovenaar 'Steekproef'            five homing light bolts, a random sample of the monsters in sight
//   Archivaris   'Ordnerval'             a heavy binder drops on your target and pins everything around it
//   Verbinder    'Koffie voor iedereen'  trust for you and coffee for every monster around: they calm down
// It works from the first minute, also in the town hall where there is nothing to fight (try it near
// your colleagues), so the tutorial can let you try it. Hooks:
//   useAbility() -> true when it fired · abilityReady() · resetAbility() (newGame) · ON.abilityUsed: [(id, n) => {}]
import * as THREE from 'three';
import {P, UI, SFX, ON} from './bus.js';
import {G, SETTINGS} from './state.js';
import {C, damage, ringFx} from './combat.js';
import {PL, healPlayer} from './player.js';
import {DLG} from './dialogue.js';
import {W, solidTile, surfaceAt, los, raycast} from './world.js';
import {R, addDynamicLight, removeDynamicLight} from '../engine/render.js';
import {glowSprite} from '../engine/models.js';
import {probedMaterial} from '../engine/batch.js';
import {FX} from '../engine/particles.js';
import {actionHit, keyLabel} from '../core/keys.js';
import {$, el, addStyles, tileOf, damp, clamp, IS_TOUCH} from '../core/util.js';
import {mod, invalidateMods} from './mods.js';
import {archetypeById} from '../content/archetypes.js';

ON.abilityUsed ??= [];
const AB = {max: 1, queued: false, slot: null, touch: null, fx: [], quipT: 0, key: '', sig: null, ready: true, carryT: 0};
const current = () => archetypeById(G.hero?.archetype);
export const abilityReady = () => !!current() && !((C.cd.ability || 0) > 0);

// ---------------------------------------------------------------- using it
export function useAbility() {
  const a = current();
  if (!a || P.dead) return false;
  if ((C.cd.ability || 0) > 0) { nope(); return false; }
  if (P.carry) {
    if (AB.carryT <= 0) { AB.carryT = 6; UI.toast(a.ability.name, 'Je hebt je handen vol. Zet eerst neer wat je draagt (Q).', 'warn'); }
    nope(); return false;
  }
  AB.max = C.cd.ability = a.ability.cd * mod('abilityCd');
  G.stats.abilities = (G.stats.abilities || 0) + 1;
  let n = 0;
  try { n = EFFECTS[a.id]() || 0; } catch (e) { console.warn('ability', e); }
  colleagues(a.ability.npc);
  if (!G.flags.abilityUsed) { G.flags.abilityUsed = true; UI.toast(a.ability.name, a.ability.text, 'good'); }
  else if (!n && AB.quipT <= 0) { AB.quipT = 25; say(a.ability.quips[Math.floor(Math.random() * a.ability.quips.length)], a.ability.name); }
  for (const fn of ON.abilityUsed) { try { fn(a.id, n); } catch (e) { console.warn(e); } }
  return true;
}
const say = (line, title) => (G.flags.pip ? UI.pip(line) : UI.toast(title, line, 'quest'));

// Abilities count as neutral damage in combat.js: no weakness bonus or penalty, no tool hint.
function hit(e, amount, opts = {}) {
  damage(e, amount, 'ability', opts);
}
const near = (x, z, r) => C.enemies.filter(e => e.alive && !e.hidden && Math.hypot(e.x - x, e.z - z) < r + (e.def.r ?? 0.5));
// a monster that was winding up forgets what it was doing
function interrupt(e, stun) {
  if (e.def.heavy) { e.slow = Math.max(e.slow, stun); return; }
  e.stun = Math.max(e.stun, stun); e.vx *= 0.2; e.vz *= 0.2;
  if (e.state === 'windup' || e.state === 'strike') { e.state = 'recover'; e.t = 0; }
}
const shake = v => { if (SETTINGS.shake !== false && SETTINGS.motion !== 'reduced') PL.shake = Math.max(PL.shake, v); };
const flash = v => { if (SETTINGS.motion !== 'reduced') UI.flash(v); };
function forward() { return {x: -Math.sin(P.yaw), z: -Math.cos(P.yaw)}; }
// the people around you react: the Verbinder's colleagues take a sip, the Archivaris gets a nod
function colleagues(gesture) {
  if (!gesture) return;
  for (const o of W.ents) if (o.model?.gesture && o.visible !== false && Math.hypot(o.x - P.x, o.z - P.z) < 7) o.model.gesture(gesture);
}

// ---------------------------------------------------------------- shared bits for the effects
const PROBE = {value: new THREE.Color(0.62, 0.56, 0.5)};
const MATS = new Map();
const mat = (hex, em = 0) => { let m = MATS.get(hex); if (!m) { m = probedMaterial({color: hex, flatShading: true, emissive: em, transparent: true}, PROBE); MATS.set(hex, m); } return m; };
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12), BALL = new THREE.SphereGeometry(1, 12, 8);
function part(g, geo, m, w, h, d, x, y, z) { const o = new THREE.Mesh(geo, m); o.scale.set(w, h, d); o.position.set(x, y, z); g.add(o); return o; }
function setOpacity(g, a) { g.traverse(o => { if (o.material) { o.material.opacity = a; } }); }
// a word stamped or printed on things, drawn once
function labelTexture(lines, {w = 512, h = 256, ink = '#c8301e', bg = null, border = true, rough = true, font = 'bold 62px Georgia, serif'} = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.strokeStyle = g.fillStyle = ink;
  if (border) { g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 4; g.strokeRect(34, 34, w - 68, h - 68); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h * 0.3)));
  if (rough) { g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260; i++) { const s = 2 + Math.random() * 5; g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
let TEX = null;
const tex = () => TEX || (TEX = {
  stamp: labelTexture(['LAST ONDER', 'DWANGSOM']),
  binder: labelTexture(['DEEL 7', 'van 12'], {w: 256, h: 256, ink: '#2a2a30', bg: '#f4f0e4', border: false, rough: false, font: 'bold 54px Georgia, serif'}),
});
const decal = (t, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2})); m.rotation.x = -Math.PI / 2; return m; };

function addFx(o) { AB.fx.push(o); return o; }
function clearFx() { for (const f of AB.fx) f.dispose?.(); AB.fx.length = 0; }
W.onLoad.push(clearFx);

// ---------------------------------------------------------------- the Handhaver: Last onder dwangsom
let stampModel = null;
function stampMesh() {
  if (stampModel) return stampModel;
  const g = new THREE.Group();
  part(g, BOX, mat(0xb8301e, 0x3a0804), 1.8, 0.46, 1.8, 0, 0.36, 0);
  part(g, BOX, mat(0x4a140e, 0x140302), 1.66, 0.14, 1.66, 0, 0.07, 0);
  part(g, BOX, mat(0xd8b050, 0x3a2a08), 1.84, 0.06, 1.84, 0, 0.6, 0);
  part(g, CYL, mat(0x8a5a32, 0x2a1408), 0.26, 1.1, 0.26, 0, 1.15, 0);
  part(g, BALL, mat(0x8a5a32, 0x2a1408), 0.42, 0.36, 0.42, 0, 1.86, 0);
  return (stampModel = g);
}
function dwangsom() {
  const x = P.x, z = P.z, y = P.y, RAD = 5.5;
  const n = near(x, z, RAD).length;
  PL.toolAnim = 1; PL.toolAnimKind = 'seal'; P.aimLock = 0.4;
  SFX.play('windup');
  const g = stampMesh(); g.position.set(x, y + 7, z); g.rotation.set(0, P.yaw, 0); setOpacity(g, 1); R.scene.add(g);
  let mark = null, t = 0, landed = false;
  addFx({
    update(dt) {
      t += dt;
      if (!landed) {
        const k = Math.min(1, t / 0.26);
        g.position.y = y + 7 - 6.95 * k * k;
        if (k >= 1) { landed = true; impact(); }
      } else if (t > 0.5) {
        const u = Math.min(1, (t - 0.5) / 0.45);
        g.position.y = y + 0.05 + u * u * 5; setOpacity(g, 1 - u);
      }
      if (mark) mark.material.opacity = clamp(1 - (t - 1.4) / 1.6, 0, 0.92);
      return t > 3;
    },
    dispose() { R.scene.remove(g); if (mark) { R.scene.remove(mark); mark.geometry.dispose(); mark.material.dispose(); } },
  });
  function impact() {
    for (const e of near(x, z, RAD)) {
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
      hit(e, 16, {kx: dx / d * 12, kz: dz / d * 12, stun: 2.6});
      interrupt(e, 2.6);
      UI.number(e.x, e.y + (e.def.aimY ?? 1) + 1.1, e.z, 'Gesommeerd', '#ffb08a', false);
    }
    // the stamp also counts as a seal for things: leaks and cracks close
    for (const o of W.ents) if (o.onHit && o.visible !== false && Math.hypot(o.x - x, o.z - z) < 3.2) o.onHit('seal', 12);
    for (const fn of ON.sealSwing || []) fn(x, z);
    mark = decal(tex().stamp, 3.6, 1.8); mark.position.set(x, surfaceAt(x, z) + 0.04, z); mark.rotation.z = P.yaw; mark.material.opacity = 0.92; R.scene.add(mark);
    ringFx(x, y + 0.06, z, RAD, 0xff7c5c, 0.6, true);
    ringFx(x, y + 0.05, z, RAD * 0.55, 0xffd0a0, 0.45, true);
    FX.ring(x, y + 0.3, z, 0.9, 44, {color: [0xff8a5c, 0xffd0a0, 0xffffff], speed: RAD * 2.2, life: 0.45, s0: 0.3, drag: 2});
    FX.burst(x, y + 0.4, z, 30, {color: [0xf8f4ea, 0xffffff, 0xe8d8b8], speed: 5, life: 1.1, s0: 0.16, up: 3, additive: false});
    UI.number(x, y + 2.8, z, 'Last onder dwangsom!', '#ffb08a', true);
    shake(0.5); flash(0.14);
    SFX.play('sealHit'); SFX.play('gateDown');
  }
  return n;
}

// ---------------------------------------------------------------- the Datatovenaar: Steekproef
const BOLT_CORE = new THREE.SphereGeometry(0.13, 8, 6), BOLT_MAT = new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false});
function steekproef() {
  const f = forward(), sx = -f.z, sz = f.x;
  const ox = P.x + f.x * 0.4 + sx * 0.35, oz = P.z + f.z * 0.4 + sz * 0.35, oy = P.y + 1.45;
  // a random sample of what you can see
  const pool = C.enemies.filter(e => e.alive && !e.hidden && !e.def.ghostShots && Math.hypot(e.x - P.x, e.z - P.z) < 24 && los(P.x, P.z, e.x, e.z));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  PL.toolAnim = 1; PL.toolAnimKind = 'lamp'; P.aimLock = 0.4;
  for (let i = 0; i < 5; i++) {
    const side = (i - 2) * 0.55, up = 0.5 + Math.abs(i - 2) * 0.12;
    const dir = {x: f.x + sx * side, y: up, z: f.z + sz * side}, l = Math.hypot(dir.x, dir.y, dir.z);
    bolt(ox, oy, oz, dir.x / l, dir.y / l, dir.z / l, pool.length ? pool[i % pool.length] : null, i * 0.07, i % 2 === 0);
  }
  FX.burst(ox, oy, oz, 16, {color: [0x8fd0ff, 0xffffff], speed: 2.5, life: 0.4, s0: 0.16});
  SFX.play('reveal'); flash(0.08);
  return pool.length;
}
function bolt(x, y, z, dx, dy, dz, target, delay, lit) {
  const SPEED = 15, COLOR = 0x8fd0ff;
  const s = glowSprite(COLOR, 1.15, 1); s.add(new THREE.Mesh(BOLT_CORE, BOLT_MAT)); s.position.set(x, y, z); s.visible = false; R.scene.add(s);
  const b = {x, y, z, vx: dx * SPEED, vy: dy * SPEED, vz: dz * SPEED, t: 0, target, light: null, out: false};
  const pop = () => { FX.burst(b.x, b.y, b.z, 14, {color: [COLOR, 0xffffff], speed: 3, life: 0.4, s0: 0.15}); return true; };
  addFx({
    update(dt) {
      if (!b.out) {
        if ((delay -= dt) > 0) return false;
        b.out = true; s.visible = true; SFX.play('lamp');
        if (lit) b.light = addDynamicLight({x: b.x, y: b.y, z: b.z, hex: COLOR, i: 1, range: 6, dyn: 6, prio: 2});
      }
      b.t += dt;
      if (!b.target?.alive) b.target = nearest(b, 14);
      const tg = b.target, sp = SPEED + b.t * 8;
      if (tg) {
        const ex = tg.x - b.x, ey = tg.y + (tg.def.aimY ?? 1) - b.y, ez = tg.z - b.z, d = Math.hypot(ex, ey, ez) || 1, k = 2 + b.t * 12;
        b.vx = damp(b.vx, ex / d * sp, k, dt); b.vy = damp(b.vy, ey / d * sp, k, dt); b.vz = damp(b.vz, ez / d * sp, k, dt);
      } else b.vy = damp(b.vy, 0, 2, dt);
      for (let k = 0; k < 3; k++) {
        b.x += b.vx * dt / 3; b.y += b.vy * dt / 3; b.z += b.vz * dt / 3;
        const tx = tileOf(b.x), tz = tileOf(b.z);
        if (b.t > 0.08 && (solidTile(tx, tz) || b.y < surfaceAt(b.x, b.z) - 0.1 || b.y > (W.L.ceilY?.[tz * W.L.W + tx] ?? 99))) return pop();
        for (const e of C.enemies) {
          if (!e.alive || e.hidden || e.def.ghostShots) continue;
          if (Math.hypot(b.x - e.x, b.z - e.z) < (e.def.r ?? 0.5) + 0.3 && Math.abs(b.y - (e.y + (e.def.aimY ?? 1))) < (e.def.h ?? 1.6) * 0.7) {
            e.exposed = Math.max(e.exposed || 0, 5);   // the sample shows what is really there
            hit(e, 14, {kx: b.vx * 0.15, kz: b.vz * 0.15});
            return pop();
          }
        }
        for (const o of W.ents) if (o.onHit && o.visible !== false && b.y < 3 && Math.hypot(b.x - o.x, b.z - o.z) < (o.def?.r ?? 0.7) + 0.2) { o.onHit('lamp', 14); return pop(); }
      }
      s.position.set(b.x, b.y, b.z);
      if (b.light) { b.light.x = b.x; b.light.y = b.y; b.light.z = b.z; }
      if (Math.random() < 0.8) FX.one({x: b.x, y: b.y, z: b.z, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5, life: 0.35, s0: 0.24, color: COLOR});
      return b.t > 2.6 ? pop() : false;
    },
    dispose() { R.scene.remove(s); s.material.dispose(); if (b.light) removeDynamicLight(b.light); },
  });
}
function nearest(b, r) {
  let best = null, bd = r;
  for (const e of C.enemies) {
    if (!e.alive || e.hidden || e.def.ghostShots) continue;
    const d = Math.hypot(e.x - b.x, e.z - b.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------------------------------------------------------------- the Archivaris: Ordnerval
let binderModel = null;
function binderMesh() {
  if (binderModel) return binderModel;
  const g = new THREE.Group(), cover = mat(0x2f7a4a, 0x0a2a14), pages = mat(0xf0e6d0, 0x3a3428);
  part(g, BOX, cover, 1.36, 0.07, 1.7, 0, 0.035, 0);
  part(g, BOX, cover, 1.36, 0.07, 1.7, 0, 0.475, 0);
  part(g, BOX, cover, 0.09, 0.51, 1.7, -0.64, 0.255, 0);
  part(g, BOX, pages, 1.22, 0.37, 1.6, 0.04, 0.255, 0);
  part(g, BALL, mat(0x1a1a1e), 0.06, 0.06, 0.06, -0.69, 0.255, -0.52);
  const label = decal(tex().binder, 0.62, 0.62); label.position.set(0.1, 0.515, 0.2); label.rotation.z = Math.PI / 2; g.add(label);
  return (binderModel = g);
}
function ordnerval() {
  // where you look: the monster under the crosshair, else the floor up to 7 m ahead
  const f = forward();
  let tx = P.x + f.x * 4, tz = P.z + f.z * 4;
  const cand = C.enemies.filter(e => e.alive && !e.hidden && Math.hypot(e.x - P.x, e.z - P.z) < 16 && los(P.x, P.z, e.x, e.z))
    .map(e => { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; return {e, d, dot: (dx * f.x + dz * f.z) / d}; })
    .filter(c => c.dot > 0.55).sort((a, b) => (a.d * (2 - a.dot)) - (b.d * (2 - b.dot)));
  if (cand.length) { tx = cand[0].e.x; tz = cand[0].e.z; }
  else {
    const reach = Math.min(7, raycast(P.x, P.y + 1, P.z, f.x, 0, f.z, 7, 0.4) - 0.6);
    tx = P.x + f.x * Math.max(1.5, reach); tz = P.z + f.z * Math.max(1.5, reach);
  }
  const RAD = 2.9, n = near(tx, tz, RAD).length, ty = surfaceAt(tx, tz);
  const g = binderMesh(), spin = (Math.random() - 0.5) * 3, yaw0 = P.yaw;
  g.position.set(tx, ty + 9, tz); g.rotation.set(0.5, P.yaw, 0.3); setOpacity(g, 1); R.scene.add(g);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(tx, ty + 0.03, tz); R.scene.add(shadow);
  SFX.play('swoop');
  let t = 0, landed = false;
  addFx({
    update(dt) {
      t += dt;
      if (!landed) {
        const k = Math.min(1, t / 0.42);
        g.position.y = ty + 9 * (1 - k * k); g.rotation.x = 0.5 * (1 - k); g.rotation.z = 0.3 * (1 - k); g.rotation.y = yaw0 + spin * (1 - k);
        shadow.material.opacity = 0.45 * k; shadow.scale.setScalar(0.4 + k * 0.6);
        if (k >= 1) { landed = true; impact(); }
      } else if (t > 4.2) {
        const u = Math.min(1, (t - 4.2) / 0.5);
        g.position.y = ty - u * 0.6; setOpacity(g, 1 - u); shadow.material.opacity = 0.45 * (1 - u);
      }
      return t > 4.75;
    },
    dispose() { R.scene.remove(g); R.scene.remove(shadow); shadow.geometry.dispose(); shadow.material.dispose(); },
  });
  function impact() {
    for (const e of near(tx, tz, RAD)) {
      hit(e, 24, {});
      interrupt(e, 4);
      UI.number(e.x, e.y + (e.def.aimY ?? 1) + 1.1, e.z, 'Vastgepind', '#9fe0b0', false);
    }
    for (const o of W.ents) if (o.onHit && o.visible !== false && Math.hypot(o.x - tx, o.z - tz) < RAD) o.onHit('seal', 10);
    FX.ring(tx, ty + 0.2, tz, 0.7, 30, {color: [0xd8c8a0, 0xf0e6d0], speed: 5, up: 0.6, life: 0.6, s0: 0.32, drag: 2, additive: false});
    FX.burst(tx, ty + 0.7, tz, 24, {color: [0xf8f4ea, 0xffffff], speed: 4, life: 1.2, s0: 0.14, up: 2.6, additive: false});
    ringFx(tx, ty + 0.05, tz, RAD, 0x9fe0b0, 0.5, true);
    shake(0.35);
    SFX.play('gateDown'); SFX.play('place');
  }
  return n;
}

// ---------------------------------------------------------------- the Verbinder: Koffie voor iedereen
function koffie() {
  const RAD = 8, before = G.hp;
  healPlayer(30);
  const got = Math.round(G.hp - before);
  UI.number(P.x, P.y + 2.3, P.z, got > 0 ? `+${got} vertrouwen` : 'Lekker bakkie', '#8fe0a0', true);
  const list = near(P.x, P.z, RAD);
  for (const e of list) {
    interrupt(e, 4.5);
    const hy = e.y + (e.def.aimY ?? 1) + 0.9;
    UI.number(e.x, hy + 0.3, e.z, '☕', '#f4e6c8', true);
    FX.burst(e.x, hy, e.z, 10, {color: [0xf4f0e8, 0xe8dcc8], speed: 0.8, up: 1.4, life: 1.4, s0: 0.3, drag: 1, additive: false});
  }
  FX.ring(P.x, P.y + 0.4, P.z, 0.9, 26, {color: [0xf4ead8, 0xd8b890], speed: 2.2, up: 1.5, life: 1.3, s0: 0.34, drag: 1.2, additive: false});
  FX.burst(P.x, P.y + 1.2, P.z, 18, {color: [0x8a5a32, 0xc89a6a, 0xf4e6c8], speed: 2.5, life: 0.7, s0: 0.14, up: 1});
  ringFx(P.x, P.y + 0.05, P.z, RAD, 0x8fe0a0, 0.8, true);
  ringFx(P.x, P.y + 0.06, P.z, RAD * 0.5, 0xf2b84e, 0.6, true);
  SFX.play('coffee'); SFX.play('eat');
  return list.length;
}

const EFFECTS = {handhaver: dwangsom, datatovenaar: steekproef, archivaris: ordnerval, verbinder: koffie};

// ---------------------------------------------------------------- the slot and the touch button
addStyles('ability', `
.tool.ability{margin-left:6px}.tool.ability .ic{font-size:28px}
.tool.ability.ready,.tbtn.tability.ready{border-color:var(--c);box-shadow:0 0 0 1px var(--c),0 0 18px color-mix(in srgb,var(--c) 45%,transparent)}
.tool.ability[hidden],.tbtn.tability[hidden]{display:none}
.tool.ability.pop,.tbtn.tability.pop{animation:ab-pop .6s ease-out}
.tool.ability.nope,.tbtn.tability.nope{animation:ab-nope .3s}
@keyframes ab-pop{0%{transform:scale(1)}40%{transform:scale(1.16)}100%{transform:scale(1)}}
@keyframes ab-nope{0%,100%{translate:0}25%{translate:-4px}75%{translate:4px}}
.tbtn.tability{overflow:hidden}      /* its place in the thumb arc comes from index.html (#tAbility) */
.tbtn.tability .cd{position:absolute;inset:0;border-radius:50%;background:conic-gradient(rgba(0,0,0,.62) var(--p,0%),transparent 0);pointer-events:none}
`);
function ensureSlot() {
  if (!AB.slot && $('tools')) {
    AB.slot = el('button', {class: 'tool ability', id: 'tool-ability', hidden: true, onclick: () => { AB.queued = true; }},
      el('kbd'), el('span', {class: 'ic'}), el('span', {class: 'cd'}), el('span', {class: 'nm'}));
    $('tools').append(AB.slot);
  }
  if (!AB.touch && $('touch')) {
    AB.touch = el('button', {class: 'tbtn tability', id: 'tAbility', hidden: true}, el('span', {class: 'ic'}), el('span', {class: 'cd'}));
    AB.touch.addEventListener('touchstart', e => { e.preventDefault(); AB.queued = true; }, {passive: false});
    AB.touch.addEventListener('click', () => { AB.queued = true; });
    $('touch').append(AB.touch);
  }
}
function updateSlot() {
  const a = current(), key = a ? `${a.id}|${keyLabel('ability')}` : '';
  if (key !== AB.key) {
    AB.key = key;
    for (const b of [AB.slot, AB.touch]) if (b) { b.hidden = !a; if (a) { b.style.setProperty('--c', a.css); b.querySelector('.ic').textContent = a.icon; } }
    if (AB.slot && a) {
      AB.slot.querySelector('kbd').textContent = keyLabel('ability');
      AB.slot.querySelector('.nm').textContent = a.ability.short;
      AB.slot.title = `${a.ability.name} (${keyLabel('ability')}) · ${a.ability.text}`;
    }
    if (AB.touch && a) AB.touch.setAttribute('aria-label', `Speciale vaardigheid: ${a.ability.name}`);
  }
  if (!a) return;
  const p = `${clamp((C.cd.ability || 0) / (AB.max || 1), 0, 1) * 100}%`, ready = !((C.cd.ability || 0) > 0);
  for (const b of [AB.slot, AB.touch]) if (b) { b.querySelector('.cd').style.setProperty('--p', p); b.classList.toggle('ready', ready); }
  if (ready && !AB.ready && SETTINGS.motion !== 'reduced') pulse('pop', 600);
  AB.ready = ready;
}
function pulse(cls, ms) {
  for (const b of [AB.slot, AB.touch]) if (b) { b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls); setTimeout(() => b.classList.remove(cls), ms); }
}
function nope() { SFX.play('locked'); pulse('nope', 300); }

// ---------------------------------------------------------------- every frame while you play
export function resetAbility() {
  C.cd.ability = 0; AB.max = 1; AB.ready = true; AB.sig = null; AB.queued = false;
  clearFx(); ensureSlot(); AB.key = ''; updateSlot();
}
ON.tick.push(dt => {
  // a new game, a loaded save or the debug API changed who you are (or what you carry): recompute the modifiers
  const sig = `${G.hero?.archetype || ''}|${(G.trinkets || []).length}`;
  if (sig !== AB.sig) { AB.sig = sig; invalidateMods(); }
  ensureSlot(); updateSlot();
  for (let i = AB.fx.length - 1; i >= 0; i--) { let done = true; try { done = AB.fx[i].update(dt); } catch (e) { console.warn('ability fx', e); } if (done) { AB.fx[i].dispose?.(); AB.fx.splice(i, 1); } }
  AB.quipT -= dt; AB.carryT -= dt;
  const want = AB.queued || actionHit('ability');
  AB.queued = false;
  // pressing F next to someone starts a conversation (the old key for talking): then that wins
  if (want && !DLG.active) useAbility();
  // once per game, after a while: what your ability is and how to use it
  const a = current();
  if (a && !G.flags.abilityHint && !G.flags.abilityUsed && G.stats.time > 25) {
    G.flags.abilityHint = true;
    UI.toast(`Je vaardigheid: ${a.ability.name}`, `Druk op ${keyLabel('ability')}${IS_TOUCH ? ` of tik op ${a.icon}` : ''}. ${a.ability.text}`, 'quest');
  }
});
