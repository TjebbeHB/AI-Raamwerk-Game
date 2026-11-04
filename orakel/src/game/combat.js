// The three tools, the reveal pulse, projectiles and the monsters.
// Each monster stands for a risk from the framework and is weak to one tool:
// the Toetslamp (test and measure), the Weegschaal (weigh, the human check), the Zegel (protect, limit).
import * as THREE from 'three';
import {P, UI, SFX, ON} from './bus.js';
import {W, collide, walkTile, flowField, los, solidTile, isChasm, surfaceAt, raycast} from './world.js';
import {G, SETTINGS, saveGame} from './state.js';
import {R, addDynamicLight, removeDynamicLight} from '../engine/render.js';
import {makeModel, glowSprite, disposeModel} from '../engine/models.js';
import {FX} from '../engine/particles.js';
import {revealAround} from './entities.js';
import {PL, hurtPlayer, healPlayer} from './player.js';
import {TILE, tileOf, clamp, damp, dampAngle} from '../core/util.js';
import {mod} from './mods.js';

export const TOOLS = {
  lamp: {key: 'Digit1', name: 'Toetslamp', icon: '🔦', color: 0xffd36b, css: '#ffd36b', cd: 0.34, attack: 'Toetsstraal: een lichtschot op afstand', text: 'Toetsen en meten. Werkt tegen beloftes zonder bewijs, verzonnen antwoorden en rommelige bronnen. Met R (of rechtermuisknop) laat je het licht openbarsten: wat niet echt is, verdwijnt.'},
  scale: {key: 'Digit2', name: 'Weegschaal', icon: '⚖️', color: 0xb9a2ff, css: '#b9a2ff', cd: 1.0, attack: 'Afweging: een golf rondom je die vertraagt', text: 'Afwegen en de menselijke toets. Een golf die alles rondom je raakt en vertraagt: bedenktijd. Werkt tegen haast, vooroordelen en blind vertrouwen.'},
  seal: {key: 'Digit3', name: 'Zegel', icon: '🔏', color: 0x7fe0a4, css: '#7fe0a4', cd: 0.55, attack: 'Zegelslag: een harde stempel van dichtbij', text: 'Beschermen en begrenzen. Een stevige stempelslag van dichtbij. Werkt tegen datalekken, verborgen instructies en te ruime rechten. Dicht ook lekken en scheuren.'},
};
export const TOOL_ORDER = ['lamp', 'scale', 'seal'];
export const REVEAL_CD = 2.2;
export const BEASTS = {};          // filled by the content: type -> definition
export const C = {enemies: [], shots: [], rings: [], drops: [], cd: {lamp: 0, scale: 0, seal: 0, reveal: 0}, alert: 0, onBossHit: null};

// ---------------------------------------------------------------- aiming
const ray = new THREE.Vector3(), camPos = new THREE.Vector3();
export function aim() {
  R.camera.getWorldPosition(camPos);
  ray.set(0, 0, -1).applyQuaternion(R.camera.quaternion);
  const max = raycast(camPos.x, camPos.y, camPos.z, ray.x, ray.y, ray.z, 40, 0.2);
  let best = null, bestScore = 0.15;
  if (SETTINGS.autoAim !== false) for (const e of C.enemies) {
    if (!e.alive || e.hidden || e.def.ghostShots) continue;
    const ex = e.x - camPos.x, ey = e.y + e.def.aimY - camPos.y, ez = e.z - camPos.z, d = Math.hypot(ex, ey, ez);
    if (d > Math.min(max + 1, 32)) continue;
    const dot = (ex * ray.x + ey * ray.y + ez * ray.z) / d;
    const off = Math.acos(clamp(dot, -1, 1));
    const score = off - (e.def.r ?? 0.5) / d;
    if (score < bestScore && los(P.x, P.z, e.x, e.z)) { bestScore = score; best = e; }
  }
  const pt = best ? new THREE.Vector3(best.x, best.y + best.def.aimY, best.z) : camPos.clone().addScaledVector(ray, max);
  return {point: pt, target: best, dir: ray.clone(), dist: max};
}

// ---------------------------------------------------------------- tools
export function useTool(tool) {
  if (!G.tools[tool] || C.cd[tool] > 0 || P.carry) return false;
  C.cd[tool] = TOOLS[tool].cd * mod(`${tool}Cd`);
  PL.toolAnim = 1; PL.toolAnimKind = tool; P.aimLock = 0.5; PL.kick = 1;
  const a = aim();
  if (tool === 'lamp') {
    const from = R.lantern.position.clone();
    const dir = a.point.clone().sub(from).normalize();
    shoot({x: from.x, y: from.y, z: from.z, dir, speed: 26, dmg: 10, tool, owner: 'player', color: 0xffd36b, r: 0.32, life: 1.4});
    SFX.play('lamp');
  } else if (tool === 'scale') {
    shockwave(P.x, P.y, P.z, 3.8 * mod('scaleRadius'), 9, 'scale');
    SFX.play('scale');
  } else if (tool === 'seal') {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let hitAny = false;
    for (const e of C.enemies) {
      if (!e.alive) continue;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d > (2.4 + (e.def.r ?? 0.5) * 0.6) * mod('sealReach')) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.25 && d > 1.0) continue;
      damage(e, 15, 'seal', {kx: dx / (d || 1) * 10, kz: dz / (d || 1) * 10, stun: 0.6});
      hitAny = true;
    }
    for (const o of W.ents) if (o.onHit && o.visible !== false) {
      const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz);
      if (d < 2.6 * mod('sealReach') && ((dx * fx + dz * fz) / (d || 1) > 0.3 || d < 1.2)) o.onHit('seal', 15);
    }
    const sx = P.x + fx * 1.4, sz = P.z + fz * 1.4;
    for (const fn of ON.sealSwing || []) fn(sx, sz);
    FX.burst(sx, P.y + 0.9, sz, 22, {color: [0x7fe0a4, 0xd8ffe6], speed: 4, life: 0.45, s0: 0.2});
    ringFx(sx, P.y + 0.05, sz, 1.4, 0x7fe0a4, 0.35);
    SFX.play(hitAny ? 'sealHit' : 'seal');
  }
  return true;
}

export function revealPulse() {
  if (!G.tools.lamp || C.cd.reveal > 0) return false;
  C.cd.reveal = REVEAL_CD * mod('revealCd');
  const r = (G.flags.lampBright ? 8.5 : 7) * mod('revealRadius');
  revealAround(P.x, P.z, r);
  for (const e of C.enemies) if (e.alive && Math.hypot(e.x - P.x, e.z - P.z) < r + 1) { e.exposed = 6; e.def.onReveal?.(e); }
  ringFx(P.x, P.y + 0.1, P.z, r, 0xffe8a8, 0.7, true);
  FX.ring(P.x, P.y + 1.2, P.z, 0.5, 36, {color: [0xffd36b, 0xfff1b8], speed: r * 1.4, life: 0.7, s0: 0.22, drag: 1.5});
  UI.flash(0.12);
  SFX.play('reveal');
  ON.tick.forEach?.(() => {});
  return true;
}

function shockwave(x, y, z, r, dmg, tool) {
  for (const e of C.enemies) {
    if (!e.alive) continue;
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
    if (d > r + (e.def.r ?? 0.5)) continue;
    damage(e, dmg, tool, {kx: dx / (d || 1) * 9, kz: dz / (d || 1) * 9, slow: 2.4});
  }
  for (const o of W.ents) if (o.onHit && o.visible !== false && Math.hypot(o.x - x, o.z - z) < r + 0.5) o.onHit(tool, dmg);
  ringFx(x, y + 0.1, z, r, 0xb9a2ff, 0.5, true);
  FX.ring(x, y + 0.5, z, 0.6, 30, {color: [0xb9a2ff, 0xe8dcff], speed: r * 2.2, life: 0.4, s0: 0.25, drag: 2});
  PL.shake = Math.max(PL.shake, SETTINGS.shake ? 0.18 : 0);
}

// an expanding flat ring on the floor
const RING_GEO = new THREE.RingGeometry(0.88, 1, 48);
export function ringFx(x, y, z, r, color, life, big) {
  const m = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); R.scene.add(m);
  C.rings.push({m, t: 0, life, r, big});
}

// ---------------------------------------------------------------- projectiles
export function shoot(o) {
  const s = glowSprite(o.color, o.r * 4.2, 1);
  s.position.set(o.x, o.y, o.z); R.scene.add(s);
  const core = new THREE.Mesh(new THREE.SphereGeometry(o.r * 0.45, 8, 6), new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false}));
  s.add(core);
  const light = o.owner === 'player' ? addDynamicLight({x: o.x, y: o.y, z: o.z, hex: o.color, i: 1, range: 6, dyn: 6, prio: 2}) : null;
  C.shots.push({...o, vx: o.dir.x * o.speed, vy: o.dir.y * o.speed, vz: o.dir.z * o.speed, t: 0, s, light});
}
function updateShots(dt) {
  for (let i = C.shots.length - 1; i >= 0; i--) {
    const p = C.shots[i];
    p.t += dt;
    let dead = p.t > p.life;
    const steps = 3;
    for (let k = 0; k < steps && !dead; k++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; p.z += p.vz * dt / steps;
      if (p.homing && p.owner === 'enemy') { const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz) || 1; p.vx = damp(p.vx, dx / d * p.speed, p.homing, dt / steps); p.vz = damp(p.vz, dz / d * p.speed, p.homing, dt / steps); }
      const tx = tileOf(p.x), tz = tileOf(p.z);
      if (solidTile(tx, tz) || p.y < surfaceAt(p.x, p.z) - 0.1 && !isChasm(tx, tz) || p.y > W.L.ceilY[tz * W.L.W + tx]) { dead = true; break; }
      if (p.owner === 'player') {
        for (const e of C.enemies) {
          if (!e.alive || e.hidden || e.def.ghostShots) continue;   // ghostShots: shots fly through (the Hydra's body, to reach its heads)
          const dy = p.y - (e.y + e.def.aimY);
          if (Math.hypot(p.x - e.x, p.z - e.z) < (e.def.r ?? 0.5) + p.r && Math.abs(dy) < (e.def.h ?? 1.6) * 0.7) { damage(e, p.dmg, p.tool, {kx: p.vx * 0.15, kz: p.vz * 0.15}); dead = true; break; }
        }
        if (!dead) for (const o of W.ents) if (o.onHit && o.visible !== false && Math.hypot(p.x - o.x, p.z - o.z) < (o.def.r ?? 0.7) + 0.2 && p.y < 3) { o.onHit(p.tool, p.dmg); dead = true; break; }
      } else if (!P.dead && Math.hypot(p.x - P.x, p.z - P.z) < 0.5 + p.r && p.y > P.y && p.y < P.y + 2) {
        hurtPlayer(p.dmg, p.x - p.vx, p.z - p.vz); p.onHitPlayer?.(); dead = true;
      }
    }
    p.s.position.set(p.x, p.y, p.z);
    if (p.light) { p.light.x = p.x; p.light.y = p.y; p.light.z = p.z; }
    if (Math.random() < 0.7) FX.one({x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, life: 0.35, s0: p.r * 0.9, color: p.color});
    if (dead) {
      FX.burst(p.x, p.y, p.z, 14, {color: [p.color, 0xffffff], speed: 3, life: 0.4, s0: 0.15});
      R.scene.remove(p.s); p.s.material.dispose(); p.s.children[0].geometry.dispose();
      if (p.light) removeDynamicLight(p.light);
      C.shots.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- monsters
let nextId = 1;
export function spawnEnemy(type, x, z, o = {}) {
  const def = BEASTS[type];
  if (!def) { console.warn('unknown beast', type); return null; }
  const probe = {value: new THREE.Color(0.3, 0.25, 0.2)};
  const model = makeModel({...def.model, probe});
  R.scene.add(model.root);
  const e = {id: nextId++, type, def: {aimY: 1.0, r: 0.5, h: 1.6, ...def}, x, z, y: def.fly ? 0 : surfaceAt(x, z), vx: 0, vz: 0, hp: (o.hp ?? def.hp) * hpScale(), maxHp: (o.hp ?? def.hp) * hpScale(), alive: true, model, probe,
    state: o.aware ? 'chase' : 'idle', t: 0, st: {t: Math.random() * 10, walk: 0}, home: {x, z}, yaw: Math.random() * 6.28, group: o.group, aware: !!o.aware, atkT: 0.5 + Math.random(), stun: 0, slow: 0, hitT: 0, exposed: 0, dieT: 0, boss: !!def.boss, ...o.extra};
  model.root.position.set(x, e.y, z);
  def.init?.(e);
  C.enemies.push(e);
  return e;
}
const hpScale = () => (SETTINGS.difficulty === 'story' ? 0.7 : SETTINGS.difficulty === 'hard' ? 1.3 : 1);

export function damage(e, amount, tool, o = {}) {
  if (!e.alive) return;
  if (e.invuln) { if (!e.invulnT || e.invulnT < performance.now()) { e.invulnT = performance.now() + 600; UI.number(e.x, e.y + (e.def.aimY ?? 1) + 0.8, e.z, e.def.immuneText || 'Onkwetsbaar', '#aaa', false); } FX.burst(e.x, e.y + (e.def.aimY ?? 1), e.z, 6, {color: 0xffffff, speed: 2, life: 0.3, s0: 0.12}); return; }
  const def = e.def;
  let mult = 1;
  if (def.weak) mult = tool === def.weak ? 2.5 : 0.4;
  if (def.shielded && !e.exposed) { mult *= 0.1; if (!e.shieldHint) { e.shieldHint = true; UI.pip(def.shieldHint || 'Het glanst te veel. Laat eerst het licht openbarsten (R) om te zien wat er echt zit.'); } }
  if (def.damageFilter) mult = def.damageFilter(e, tool, mult, amount);
  if (SETTINGS.difficulty === 'story') mult *= 1.4;
  const dmg = Math.round(amount * mult * (G.flags.sharp ? 1.15 : 1) * mod(`${tool}Dmg`));
  e.hp -= dmg;
  e.hitT = 0.14; e.aware = true;
  if (o.kx !== undefined && !def.heavy) { e.vx += o.kx * (def.light ? 1.4 : 0.8); e.vz += o.kz * (def.light ? 1.4 : 0.8); }
  if (o.stun && !def.heavy) e.stun = Math.max(e.stun, o.stun);
  if (o.slow) e.slow = Math.max(e.slow, o.slow);
  if (tool === def.weak) { e.stun = Math.max(e.stun, 0.25); if (e.state === 'windup') e.state = 'recover', e.t = 0.4; }
  UI.number(e.x, e.y + def.aimY + 0.6, e.z, dmg, tool === def.weak ? TOOLS[tool].css : '#bbb', tool === def.weak);
  FX.burst(e.x, e.y + def.aimY, e.z, tool === def.weak ? 18 : 8, {color: [TOOLS[tool]?.color ?? 0xffffff, def.color ?? 0xffffff], speed: 3, life: 0.5, s0: 0.16});
  SFX.play(tool === def.weak ? 'hitWeak' : 'hit');
  if (tool !== def.weak && def.weak && !G.flags[`hint:${e.type}`] && dmg > 0) {
    G.flags[`hint:${e.type}`] = 1;
    UI.pip(`${def.name} is ongevoelig voor de ${TOOLS[tool].name}. Probeer de ${TOOLS[def.weak].name} (${TOOL_ORDER.indexOf(def.weak) + 1}).`);
  }
  def.onHit?.(e, tool, dmg);
  if (e.boss) C.onBossHit?.(e);
  if (e.hp <= 0) kill(e);
}

export function kill(e, quiet = false) {
  if (!e.alive) return;
  e.alive = false; e.dieT = 0;
  if (quiet) return;
  G.stats.kills++;
  FX.burst(e.x, e.y + e.def.aimY, e.z, 40, {color: [e.def.color ?? 0xffffff, 0xffffff, 0xffe8a8], speed: 4.5, life: 0.9, s0: 0.22, up: 1});
  SFX.play(e.boss ? 'bossDie' : 'die');
  if (e.boss) UI.boss(null);
  e.def.onDeath?.(e);
  if (!G.flags[`lesson:${e.type}`] && e.def.lesson) {
    G.flags[`lesson:${e.type}`] = 1;
    UI.toast(`Les: ${e.def.name}`, e.def.lesson, 'good');
  }
  // drops: stroopwafels keep you going
  if (!e.def.noDrop && Math.random() < (e.def.drop ?? 0.28) + mod('lootLuck')) dropSnack(e.x, e.z);
  if (e.group) {
    const left = C.enemies.some(o => o !== e && o.alive && o.group === e.group);
    if (!left) { if (!e.def.respawn) G.cleared[e.group] = true; ON.cleared[e.group]?.(); saveGame(); }
  }
}

function dropSnack(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0.5, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), new THREE.MeshBasicMaterial({color: 0xd89a50}));
  m.rotation.x = 0.5; g.add(m); g.add(glowSprite(0xffc870, 1.0, 0.6));
  R.scene.add(g);
  C.drops.push({g, x, z, t: 0});
}
function updateDrops(dt) {
  for (let i = C.drops.length - 1; i >= 0; i--) {
    const d = C.drops[i]; d.t += dt;
    d.g.position.y = 0.55 + Math.sin(d.t * 3) * 0.1; d.g.rotation.y += dt * 2;
    if (Math.hypot(P.x - d.x, P.z - d.z) < 1.2 || d.t > 40) {
      if (d.t <= 40) { healPlayer(15); UI.toast('Stroopwafel', '+15 vertrouwen. Even op adem komen.', 'good'); SFX.play('eat'); }
      R.scene.remove(d.g); C.drops.splice(i, 1);
    }
  }
}

export function spawnFloorEnemies() {
  for (const def of W.L.entities) {
    if (def.type !== 'enemy') continue;
    if (def.group && G.cleared[def.group]) continue;
    if (def.if && !G.flags[def.if]) continue;
    const n = def.n ?? 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, rr = n > 1 ? 1.4 : 0;
      spawnEnemy(def.kind || def.id, def.x * TILE + 1 + Math.cos(a) * rr, def.z * TILE + 1 + Math.sin(a) * rr, {group: def.group, aware: def.aware});
    }
  }
}
// spawn a floor's enemy group now (for groups that wait on a story flag)
export function ensureGroup(group) {
  if (G.cleared[group] || C.enemies.some(e => e.alive && e.group === group)) return;
  for (const def of W.L.entities) {
    if (def.type !== 'enemy' || def.group !== group) continue;
    for (let k = 0; k < (def.n ?? 1); k++) spawnEnemy(def.kind || def.id, def.x * TILE + 1 + (k ? Math.cos(k) * 1.4 : 0), def.z * TILE + 1 + (k ? Math.sin(k) * 1.4 : 0), {group, aware: def.aware});
  }
}
export function clearEnemies() {
  UI.boss(null);
  for (const e of C.enemies) disposeModel(e.model);
  C.enemies.length = 0;
  for (const p of C.shots) { R.scene.remove(p.s); if (p.light) removeDynamicLight(p.light); }
  C.shots.length = 0;
  for (const r of C.rings) R.scene.remove(r.m);
  C.rings.length = 0;
  for (const d of C.drops) R.scene.remove(d.g);
  C.drops.length = 0;
}

const tmpC = new THREE.Color();
function updateEnemy(e, dt) {
  const def = e.def;
  e.st.t += dt; e.t += dt;
  if (!e.alive) {
    e.dieT += dt;
    const k = Math.max(0, 1 - e.dieT / 0.5);
    e.model.root.scale.setScalar(Math.max(0.01, k));
    e.model.root.position.y = e.y + (1 - k) * 0.6;
    return e.dieT > 0.5;
  }
  const custom = def.update ? def.update(e, dt) : null;
  if (custom === 'skip') return false;
  const skipMove = custom === 'skipMove';
  const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz);
  const calm = SETTINGS.difficulty === 'calm';
  // awareness
  if (!e.aware && d < (def.wake ?? 11) && !P.dead && los(e.x, e.z, P.x, P.z)) { e.aware = true; e.state = 'chase'; def.onWake?.(e); }
  if (e.aware && d > 34) { e.aware = false; e.state = 'home'; }
  e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt); e.hitT = Math.max(0, e.hitT - dt); e.exposed = Math.max(0, e.exposed - dt);
  let speed = def.speed * (e.speedMul ?? 1) * (e.slow > 0 ? 0.4 : 1) * (e.stun > 0 ? 0 : 1);
  let mx = 0, mz = 0;
  if (e.state === 'idle') {
    // drift around home
    const hx = e.home.x + Math.sin(e.st.t * 0.4 + e.id) * 1.5 - e.x, hz = e.home.z + Math.cos(e.st.t * 0.33 + e.id) * 1.5 - e.z, hd = Math.hypot(hx, hz);
    if (hd > 0.3) { mx = hx / hd * 0.3; mz = hz / hd * 0.3; }
    speed *= 0.5;
  } else if (e.state === 'home') {
    const hx = e.home.x - e.x, hz = e.home.z - e.z, hd = Math.hypot(hx, hz);
    if (hd < 0.5) { e.state = 'idle'; e.hp = e.maxHp; } else { mx = hx / hd; mz = hz / hd; }
  } else if (e.state === 'chase') {
    const want = def.keep ?? 0;
    const reach = def.range ?? 1.5;
    if (d > reach || (want && d > want + 1)) {
      const dir = steer(e, dx, dz, d);
      mx = dir[0]; mz = dir[1];
      if (want && d < want) { mx = -dx / d; mz = -dz / d; }
    } else if (want && d < want - 1) { mx = -dx / d * 0.7; mz = -dz / d * 0.7; }
    e.atkT -= dt;
    if (def.attack !== 'custom' && e.atkT <= 0 && d < (def.attackRange ?? reach + 0.3) && e.stun <= 0 && !P.dead && los(e.x, e.z, P.x, P.z)) { e.state = 'windup'; e.t = 0; SFX.play('windup'); }
  } else if (e.state === 'windup') {
    speed = 0;
    if (e.t > (def.windup ?? 0.5) * (e.slow > 0 ? 1.6 : 1)) { e.state = 'strike'; e.t = 0; strike(e, dx, dz, d, calm); }
  } else if (e.state === 'strike') {
    if (def.attack === 'swoop' || def.attack === 'leap') { speed = def.lunge ?? 9; mx = e.lx; mz = e.lz; if (!e.struck && d < (def.r ?? 0.5) + 0.7) { e.struck = true; if (!calm) hurtPlayer(def.dmg, e.x, e.z); } }
    if (e.t > (def.strikeT ?? 0.3)) { e.state = 'recover'; e.t = 0; }
  } else if (e.state === 'recover') {
    speed *= 0.3;
    if (e.t > (def.recover ?? 0.6)) { e.state = 'chase'; e.atkT = (def.rate ?? 1.4) * (0.7 + Math.random() * 0.6); }
  }
  // separation: monsters keep a little distance from each other. Stationary monsters (the Hydra
  // and its heads) stay put, heavy ones are not shoved around by small fry, and whoever gives
  // way to an immovable neighbour takes the whole step.
  if ((def.speed ?? 1) > 0) for (const o of C.enemies) {
    if (o === e || !o.alive || o.hydra === e || e.hydra === o) continue;
    if (def.heavy && !o.def.heavy) continue;
    const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), m = (def.r ?? 0.5) + (o.def.r ?? 0.5);
    if (od < m && od > 0.001) {
      const share = (o.def.speed ?? 1) > 0 && !(o.def.heavy && !def.heavy) ? 0.5 : 1;
      e.x += ox / od * (m - od) * share; e.z += oz / od * (m - od) * share;
    }
  }
  // integrate
  if (!skipMove) {
    e.vx = damp(e.vx, mx * speed, 6, dt); e.vz = damp(e.vz, mz * speed, 6, dt);
    let nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
    if (!def.fly && isChasm(tileOf(nx), tileOf(nz))) { nx = e.x; nz = e.z; e.vx *= -0.3; e.vz *= -0.3; }
    const c = collide(nx, nz, def.r ?? 0.5);
    e.x = c.x; e.z = c.z;
  }
  e.y = def.fly ? 0 : damp(e.y, surfaceAt(e.x, e.z), 12, dt);
  // face the player when aware, else the way it moves
  const faceYaw = e.aware ? Math.atan2(dx, dz) : Math.atan2(e.vx, e.vz);
  if (!skipMove && (e.aware || Math.hypot(e.vx, e.vz) > 0.2)) e.yaw = dampAngle(e.yaw, faceYaw, 8, dt);
  e.model.root.position.set(e.x, e.y, e.z);
  e.model.root.rotation.y = def.noYaw ? 0 : e.yaw;
  e.st.walk = clamp(Math.hypot(e.vx, e.vz) / Math.max(1, def.speed), 0, 1);
  e.st.attack = e.attackAnim !== undefined ? e.attackAnim : e.state === 'windup' ? Math.min(1, e.t / (def.windup ?? 0.5)) : e.state === 'strike' ? 1 - Math.min(1, e.t / 0.3) : 0;
  e.st.hurt = e.hitT > 0 ? e.hitT / 0.14 : 0;
  e.st.exposed = e.exposed > 0;
  e.model.animate(dt, e.st);
  // hit flash and light probe
  if ((e.probeT = (e.probeT || 0) - dt) <= 0) { e.probeT = 0.2; W.probeAt(e.x, e.z, e.probe.value); }
  const flash = e.hitT > 0 ? 1 : e.state === 'windup' ? 0.25 + 0.25 * Math.sin(e.t * 30) : 0;
  if (flash !== e.lastFlash) { e.lastFlash = flash; for (const m of e.model.kit.list) if (m.emissive) { m.userData.baseEm ??= m.emissive.getHex(); m.emissive.set(flash ? tmpC.setRGB(flash, flash * 0.9, flash * 0.75) : m.userData.baseEm); } }
  return false;
}

function strike(e, dx, dz, d, calm) {
  const def = e.def;
  e.struck = false;
  if (def.attack === 'ranged') {
    const from = {x: e.x, y: e.y + def.aimY + 0.2, z: e.z};
    const dir = new THREE.Vector3(P.x - from.x, P.y + 1.1 - from.y, P.z - from.z).normalize();
    const n = def.burst ?? 1;
    for (let k = 0; k < n; k++) {
      const a = (k - (n - 1) / 2) * 0.22, cs = Math.cos(a), sn = Math.sin(a);
      shoot({...from, dir: new THREE.Vector3(dir.x * cs - dir.z * sn, dir.y, dir.x * sn + dir.z * cs), speed: def.shotSpeed ?? 11, dmg: calm ? 0 : def.dmg, owner: 'enemy', color: def.shotColor ?? def.color ?? 0xff8a5c, r: 0.26, life: 2.6, homing: def.homing, onHitPlayer: def.onShotHit});
    }
    SFX.play('enemyShot');
  } else if (def.attack === 'swoop' || def.attack === 'leap') {
    e.lx = dx / (d || 1); e.lz = dz / (d || 1);
    SFX.play('swoop');
  } else {
    // melee: a short reach in front
    if (d < (def.range ?? 1.5) + 0.6 && !calm) hurtPlayer(def.dmg, e.x, e.z);
    FX.burst(e.x + dx / (d || 1) * 0.8, e.y + 0.8, e.z + dz / (d || 1) * 0.8, 8, {color: def.color ?? 0xffffff, speed: 2, life: 0.3, s0: 0.15});
    SFX.play('swing');
  }
  def.onStrike?.(e);
}

// walk downhill on the flow field, or straight at the player when in plain sight
function steer(e, dx, dz, d) {
  if (d < 7 && los(e.x, e.z, P.x, P.z)) return [dx / d, dz / d];
  const field = flowField(P.x, P.z);
  const w = W.L.W, tx = tileOf(e.x), tz = tileOf(e.z), here = field[tz * w + tx];
  let best = null, bd = here >= 0 ? here : 1e9;
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = tx + ox, nz = tz + oz;
    if (nx < 0 || nz < 0 || nx >= w || nz >= W.L.H) continue;
    const v = field[nz * w + nx];
    if (v >= 0 && v < bd) { bd = v; best = [nx * TILE + 1, nz * TILE + 1]; }
  }
  if (!best) return d > 0 ? [dx / d, dz / d] : [0, 0];
  const bx = best[0] - e.x, bz = best[1] - e.z, bl = Math.hypot(bx, bz) || 1;
  return [bx / bl, bz / bl];
}

export function updateCombat(dt, active) {
  for (const k of Object.keys(C.cd)) C.cd[k] = Math.max(0, C.cd[k] - dt);
  if (active) {
    for (let i = C.enemies.length - 1; i >= 0; i--) {
      const e = C.enemies[i];
      if (updateEnemy(e, dt)) { disposeModel(e.model); C.enemies.splice(i, 1); }
    }
    updateShots(dt);
    updateDrops(dt);
  }
  for (let i = C.rings.length - 1; i >= 0; i--) {
    const r = C.rings[i]; r.t += dt;
    const k = r.t / r.life;
    r.m.scale.setScalar(Math.max(0.05, r.r * (r.big ? Math.sqrt(k) : 0.6 + k * 0.4)));
    r.m.material.opacity = 0.85 * (1 - k);
    if (k >= 1) { R.scene.remove(r.m); r.m.material.dispose(); C.rings.splice(i, 1); }
  }
  // combat intensity for the music
  let alert = 0;
  for (const e of C.enemies) if (e.alive && e.aware && Math.hypot(e.x - P.x, e.z - P.z) < 22) alert += e.boss ? 3 : 1;
  C.alert = damp(C.alert, alert, 2, dt);
  SFX.intensity(Math.min(1, C.alert / 3));
  // some archetypes and finds slowly restore trust outside fights
  const regen = mod('regen');
  if (active && regen > 0 && C.alert < 0.3 && G.hp > 0 && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + regen * dt);
}
export const enemiesAlive = group => C.enemies.some(e => e.alive && (!group || e.group === group));
