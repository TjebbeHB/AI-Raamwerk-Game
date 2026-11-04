// The player: movement, the two cameras, the body you see in third person,
// the lantern and tool you see in first person, and what is in reach.
import * as THREE from 'three';
import {P, UI, SFX} from './bus.js';
import {DLG} from './dialogue.js';
import {Input} from '../core/input.js';
import {actionDown, actionHit, keyLabel} from '../core/keys.js';
import {W, collide, surfaceAt, isChasm, ceilAt, solidTile, markExplored, saveExplored, inBounds, tileType} from './world.js';
import {G, SETTINGS} from './state.js';
import {R} from '../engine/render.js';
import {makeHuman, makeModel, glowSprite, disposeModel, viewArmGeometry, Kit} from '../engine/models.js';
import {heroLook} from './hero.js';
import {FX} from '../engine/particles.js';
import {Crate, dropCarry} from './entities.js';
import {TILE, clamp, damp, dampAngle, tileOf, lerp, IS_TOUCH} from '../core/util.js';
import {mod} from './mods.js';
import {T} from '../engine/level.js';

const EYE = 1.62, WALK = 5.0, RUN = 7.4, DASH_V = 15, DASH_T = 0.2;
export const PL = {
  model: null, view: null, lanternV: null, toolV: {}, pip: null, pipPos: new THREE.Vector3(), pipHint: 0, pipTarget: null,
  camMode: 'third', camBlend: 1, camDist: 4.2, camCur: 4.2, camPos: new THREE.Vector3(), bob: 0, bobAmt: 0,
  target: null, pushT: 0, pushDir: null, footT: 0, dashCd: 0, toolAnim: 0, toolAnimKind: null, shake: 0, kick: 0,
  st: {t: 0, walk: 0}, fallT: 0, onDie: null, lastSafeT: 0, exploredT: 0, interactCd: 0,
};

function lanternMesh(k, parent) {
  const g = new THREE.Group(); parent.add(g);
  const frame = k.mat(0x3a3028), glass = new THREE.MeshBasicMaterial({color: 0xffd890, transparent: true, opacity: 0.55, toneMapped: false});
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(0.2, 0.03, 0.2), frame, 0, 0.13, 0); add(new THREE.BoxGeometry(0.22, 0.03, 0.22), frame, 0, -0.13, 0);
  for (const [x, z] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) add(new THREE.BoxGeometry(0.02, 0.26, 0.02), frame, x, 0, z);
  add(new THREE.BoxGeometry(0.16, 0.22, 0.16), glass, 0, 0, 0);
  const core = add(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({color: 0xfff0c0, toneMapped: false}), 0, -0.01, 0);
  add(new THREE.TorusGeometry(0.06, 0.012, 6, 12), frame, 0, 0.19, 0);
  const halo = glowSprite(0xffc870, 0.9, 0.7); g.add(halo);
  return {g, core, halo, glass};
}
function toolMesh(kind, k, parent) {
  const g = new THREE.Group(); parent.add(g);
  if (kind === 'scale') {
    const gold = k.mat(0xd8b050, {em: 0x4a3008, ei: 0.6});
    k.box(g, 0.03, 0.34, 0.03, 0xd8b050, 0, 0.0, 0, {em: 0x4a3008});
    k.box(g, 0.36, 0.025, 0.025, 0xd8b050, 0, 0.17, 0, {em: 0x4a3008});
    for (const sx of [-0.17, 0.17]) { k.box(g, 0.004, 0.12, 0.004, 0x8a7a5a, sx, 0.1, 0); const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.02, 10), gold); pan.position.set(sx, 0.04, 0); g.add(pan); }
    k.box(g, 0.12, 0.03, 0.12, 0x6a5030, 0, -0.17, 0);
  } else if (kind === 'seal') {
    k.box(g, 0.06, 0.2, 0.06, 0x6a4a2a, 0, 0.06, 0);
    k.sphere(g, 0.055, 0x6a4a2a, 0, 0.18, 0);
    k.box(g, 0.2, 0.07, 0.2, 0x2f7a4a, 0, -0.07, 0, {em: 0x0a3a18, ei: 0.8});
    k.box(g, 0.14, 0.01, 0.14, 0x7fe0a4, 0, -0.11, 0, {basic: true, toneMapped: false});
  }
  g.visible = false;
  return g;
}

// ---- your body: the third-person figure is built from your look (game/hero.js) and stands in
// the baked light where you are; the first-person hands wear the same skin and sleeves.
function buildHeroBody() {
  const m = makeHuman({...heroLook(), probe: PL.probe});
  PL.model = m; R.scene.add(m.root);
  // the lantern hangs upright from your left hand, the tools sit in your right
  PL.lantern3 = lanternMesh(m.kit, m.parts.hangL); PL.lantern3.g.scale.setScalar(1.1); PL.lantern3.g.position.set(0, -0.2, 0.02);
  PL.tool3 = {scale: toolMesh('scale', m.kit, m.parts.handR), seal: toolMesh('seal', m.kit, m.parts.handR)};
  PL.tool3.seal.position.y = -0.04;
  PL.carry3 = new THREE.Group(); PL.carry3.position.set(0, 1.0, 0.42); m.root.add(PL.carry3);
  // sample the baked light every few frames, so you sit in the same light as the walls and everyone else
  const animate = m.animate;
  let tick = 0;
  m.animate = (dt, st) => { if (W.probeAt && (tick++ & 7) === 0) W.probeAt(P.x, P.z, PL.probe.value); animate(dt, st); };
}
function buildViewArms() {
  const look = heroLook();
  PL.viewArms?.forEach(a => { a.parent?.remove(a); a.geometry.dispose(); });
  PL.viewArms = [[PL.armL, 1], [PL.armR, -1]].map(([arm, side]) => { const a = new THREE.Mesh(viewArmGeometry(look, side), PL.viewMat); arm.add(a); return a; });
}
// Call after G.hero.look changes (the character creator does): rebuilds your body and your hands.
export function rebuildHeroModel() {
  const old = PL.model, oldLantern = PL.lantern3?.g;
  buildHeroBody();
  if (old) {
    PL.model.root.position.copy(old.root.position); PL.model.root.rotation.copy(old.root.rotation); PL.model.root.visible = old.root.visible;
    // the old lantern was made for the old body; the body's own geometry stays cached per look, the tools use shared boxes
    oldLantern?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } else if (o.isSprite) o.material.dispose(); });
    disposeModel(old);
  }
  carryShown = undefined;
  if (PL.armL) buildViewArms();
}

export function initPlayer() {
  PL.probe = {value: new THREE.Color(0.3, 0.26, 0.22)};
  PL.rebuildHero = rebuildHeroModel;   // also reachable through PL (and so through the debug API)
  buildHeroBody();
  // first-person view model, attached to the camera
  const view = new THREE.Group(); R.viewCamera.add(view); PL.view = view;
  const vk = new Kit({value: new THREE.Color(0, 0, 0)});
  vk.mat = (hex, o = {}) => o.basic ? new THREE.MeshBasicMaterial({color: hex, toneMapped: o.toneMapped ?? true}) : new THREE.MeshLambertMaterial({color: hex, flatShading: true, emissive: o.em ?? 0, emissiveIntensity: o.ei ?? 1});
  PL.viewMat = new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true});
  const armL = new THREE.Group(); armL.position.set(-0.34, -0.3, -0.72); view.add(armL);
  PL.lanternV = lanternMesh(vk, armL); PL.lanternV.g.position.set(0, -0.2, -0.02); PL.lanternV.g.scale.setScalar(0.9);
  PL.armL = armL;
  const armR = new THREE.Group(); armR.position.set(0.34, -0.32, -0.74); view.add(armR);
  PL.toolV = {scale: toolMesh('scale', vk, armR), seal: toolMesh('seal', vk, armR)};
  for (const t of Object.values(PL.toolV)) t.position.set(0, 0.06, -0.06);
  PL.carryV = new THREE.Group(); PL.carryV.position.set(0, 0.02, -0.08); armR.add(PL.carryV);
  PL.armR = armR;
  buildViewArms();
  // Pip, the lantern spirit
  PL.pip = makeModel({kind: 'pip'}); R.scene.add(PL.pip.root); PL.pip.root.visible = false;
  PL.camMode = SETTINGS.cam; PL.camDist = PL.camCur = SETTINGS.camDist ?? 4.2;
  PL.camBlend = PL.camMode === 'third' ? 1 : 0;
  // the eye button in the HUD and the camera option in the menu
  UI.toggleCam = () => setCamMode(PL.camMode === 'first' ? 'third' : 'first');
  UI.setCam = mode => { if (mode !== PL.camMode) setCamMode(mode); };
}

export function placePlayer(x, z, yaw = 0) {
  P.x = x; P.z = z; P.y = surfaceAt(x, z); P.vx = P.vz = P.vy = 0; P.yaw = yaw; P.pitch = -0.1;
  P.falling = false; P.dashT = 0; P.safe = {x, z};
  PL.camPos.set(x, P.y + EYE, z);
  PL.pipPos.set(x - 0.6, P.y + 1.9, z);
}

export function setCamMode(mode) {
  PL.camMode = mode; SETTINGS.cam = mode;
  UI.toast('Camera', mode === 'first' ? 'Eerste persoon' : IS_TOUCH ? 'Derde persoon' : 'Derde persoon · scrollwiel zoomt');
}

function moveInput() {
  let f = 0, s = 0;
  if (actionDown('forward')) f += 1;
  if (actionDown('back')) f -= 1;
  if (actionDown('left')) s -= 1;
  if (actionDown('right')) s += 1;
  if (Input.move.x || Input.move.y) { s += Input.move.x; f -= Input.move.y; }
  const l = Math.hypot(f, s);
  if (l > 1) { f /= l; s /= l; }
  if (P.inverted > 0) { f = -f; s = -s; }
  return {f, s};
}

export function updatePlayer(dt, active) {
  const st = PL.st; st.t += dt;
  // ---- look ----
  if (active) {
    const sens = 0.0022 * (SETTINGS.sens ?? 1);
    P.yaw -= (Input.mdx + Input.lookTouch.dx) * sens;
    P.pitch -= (Input.mdy + Input.lookTouch.dy) * sens * (SETTINGS.invert ? -1 : 1);
    if (actionDown('turnLeft')) P.yaw += dt * 2.4;
    if (actionDown('turnRight')) P.yaw -= dt * 2.4;
    const third = PL.camMode === 'third';
    P.pitch = clamp(P.pitch, third ? -1.25 : -1.45, third ? 0.55 : 1.45);
    if (Input.wheel && third) { PL.camDist = clamp(PL.camDist + Input.wheel * 0.6, 1.6, 9); SETTINGS.camDist = PL.camDist; }
  }
  // ---- in a conversation, turn to the person you are talking to ----
  if (DLG.active && DLG.npc && DLG.npc.visible !== false) {
    const n = DLG.npc, dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(-dx, -dz) + (PL.camMode === 'third' ? 0.35 : 0);
    P.yaw = dampAngle(P.yaw, want, 3, dt);
    P.pitch = damp(P.pitch, Math.atan2((n.model?.height ?? 1.8) * 0.9 - 1.6, d) - (PL.camMode === 'third' ? 0.12 : 0), 3, dt);
  }
  // ---- move ----
  const {f, s} = active && !P.frozen ? moveInput() : {f: 0, s: 0};
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  let wx = fx * f + rx * s, wz = fz * f + rz * s;
  const inWater = tileType(tileOf(P.x), tileOf(P.z)) === T.WATER;
  // running: hold the run key, or (Opties, Toegankelijkheid) tap it to switch running on and off
  if (SETTINGS.runToggle) { if (active && actionHit('run')) { PL.runOn = !PL.runOn; SFX.play('switch'); } }
  else PL.runOn = false;
  const running = (SETTINGS.runToggle ? PL.runOn : actionDown('run')) || Math.hypot(Input.move.x, Input.move.y) > 0.92;
  P.inverted = Math.max(0, (P.inverted || 0) - dt); P.slowT = Math.max(0, (P.slowT || 0) - dt);
  let speed = (running ? RUN : WALK) * mod('speed') * (inWater ? 0.6 : 1) * (P.carry ? 0.9 : 1) * (P.slowT > 0 ? 0.5 : 1);
  PL.dashCd -= dt;
  if (active && actionHit('dash') && PL.dashCd <= 0 && !P.falling && !P.frozen) {
    let dx = wx, dz = wz;
    if (Math.hypot(dx, dz) < 0.1) { dx = fx; dz = fz; }
    const l = Math.hypot(dx, dz); P.dashDir = {x: dx / l, z: dz / l};
    P.dashT = DASH_T; PL.dashCd = 0.7 * mod('dashCd'); P.inv = Math.max(P.inv, 0.3);
    SFX.play('dash');
    for (let k = 0; k < 10; k++) FX.one({x: P.x, y: P.y + 0.3 + Math.random(), z: P.z, vx: -P.dashDir.x * 3 + (Math.random() - 0.5), vz: -P.dashDir.z * 3 + (Math.random() - 0.5), life: 0.4, s0: 0.15, color: 0xffd890});
  }
  let vx, vz;
  if (P.dashT > 0) { P.dashT -= dt; vx = P.dashDir.x * DASH_V; vz = P.dashDir.z * DASH_V; }
  else { P.vx = damp(P.vx, wx * speed, 12, dt); P.vz = damp(P.vz, wz * speed, 12, dt); vx = P.vx; vz = P.vz; }
  if (P.falling) { vx *= 0.3; vz *= 0.3; }
  if (P.knock) { vx += P.knock.x; vz += P.knock.z; P.knock.x *= Math.exp(-8 * dt); P.knock.z *= Math.exp(-8 * dt); if (Math.hypot(P.knock.x, P.knock.z) < 0.1) P.knock = null; }
  P.speed = Math.hypot(vx, vz);
  // integrate in small steps so a dash never tunnels through a wall
  const steps = Math.max(1, Math.ceil(P.speed * dt / 0.25));
  for (let i = 0; i < steps; i++) {
    const nx = P.x + vx * dt / steps, nz = P.z + vz * dt / steps;
    const c = collide(nx, nz, P.r);
    P.x = c.x; P.z = c.z;
  }
  // pushing crates: keep walking into one along an axis
  if (active && !P.dashT && Math.hypot(wx, wz) > 0.5) {
    const ax = Math.abs(wx) > Math.abs(wz) ? Math.sign(wx) : 0, az = ax ? 0 : Math.sign(wz);
    const tx = tileOf(P.x + ax * (P.r + 0.15)), tz = tileOf(P.z + az * (P.r + 0.15));
    const crate = W.ents.find(e => e instanceof Crate && e.tx === tx && e.tz === tz && !e.moving);
    if (crate && (tx !== tileOf(P.x) || tz !== tileOf(P.z))) {
      PL.pushT = PL.pushDir === `${ax},${az},${crate.tx},${crate.tz}` ? PL.pushT + dt : 0;
      PL.pushDir = `${ax},${az},${crate.tx},${crate.tz}`;
      if (PL.pushT > 0.22) { crate.tryPush(ax, az); PL.pushT = 0; }
    } else { PL.pushT = 0; PL.pushDir = null; }
  }
  // ---- ground, chasms and falling ----
  const ground = surfaceAt(P.x, P.z);
  const overChasm = isChasm(tileOf(P.x), tileOf(P.z));
  if (!P.falling && overChasm && P.dashT <= 0) { P.falling = true; PL.fallT = 0; P.vy = 0; SFX.play('fall'); }
  if (P.falling) {
    PL.fallT += dt; P.vy -= 22 * dt; P.y += P.vy * dt;
    if (PL.fallT > 0.9) respawnFromFall();
  } else {
    P.y = damp(P.y, overChasm ? P.y : ground, 18, dt);
    if (!overChasm && !nearChasm(P.x, P.z)) { PL.lastSafeT += dt; if (PL.lastSafeT > 0.2) { P.safe = {x: tileOf(P.x) * TILE + 1, z: tileOf(P.z) * TILE + 1}; } } else PL.lastSafeT = 0;
  }
  // footsteps
  if (P.speed > 1 && !P.falling && P.dashT <= 0) {
    PL.footT -= dt * P.speed / (running ? 2.6 : 2.2);
    if (PL.footT <= 0) { PL.footT = 1; SFX.play(inWater ? 'splash' : 'step'); G.stats.steps++; if (inWater) FX.burst(P.x, -0.1, P.z, 5, {color: 0xa8d0e8, additive: false, speed: 1.2, up: 1.5, g: 9, life: 0.5, s0: 0.08}); }
  }
  P.inv = Math.max(0, P.inv - dt);
  // explored map
  PL.exploredT -= dt;
  if (PL.exploredT <= 0) { PL.exploredT = 0.3; markExplored(P.x, P.z, 5); }
  // ---- body animation ----
  const third = PL.camMode === 'third';
  st.walk = damp(st.walk, clamp(P.speed / WALK, 0, 1.3), 10, dt);
  st.run = running && P.speed > WALK + 0.5;
  if (P.speed > 0.5) P.bodyYaw = dampAngle(P.bodyYaw ?? P.yaw, Math.atan2(vx, vz), 12, dt);
  if (PL.toolAnim > 0 || P.aimLock > 0) P.bodyYaw = dampAngle(P.bodyYaw ?? P.yaw, P.yaw + Math.PI, 20, dt);
  P.aimLock = Math.max(0, (P.aimLock || 0) - dt);
  PL.toolAnim = Math.max(0, PL.toolAnim - dt * 3.2);
  st.attack = PL.toolAnim > 0 ? Math.sin(PL.toolAnim * Math.PI) : 0;
  PL.model.root.position.set(P.x, P.y, P.z);
  PL.model.root.rotation.y = P.bodyYaw ?? P.yaw + Math.PI;
  PL.model.animate(dt, {...st, armL: -0.5});
  PL.lantern3.g.visible = G.tools.lamp;
  for (const [k, g] of Object.entries(PL.tool3)) g.visible = P.tool === k && !P.carry;
  for (const [k, g] of Object.entries(PL.toolV)) g.visible = P.tool === k && !P.carry;
  updateCarryVisual();
  updatePip(dt);
  updateCamera(dt, active);
}

function nearChasm(x, z) {
  const tx = tileOf(x), tz = tileOf(z);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isChasm(tx + dx, tz + dz)) return true;
  return false;
}

function respawnFromFall() {
  P.falling = false; P.vy = 0;
  P.x = P.safe.x; P.z = P.safe.z; P.y = surfaceAt(P.x, P.z);
  PL.camPos.set(P.x, P.y + EYE, P.z);
  UI.flash(0.5);
  const line = fallLines[Math.floor(Math.random() * fallLines.length)];
  UI.pip(typeof line === 'function' ? line() : line);
  hurtPlayer(12, null, null, true);
}
const fallLines = ['Hup, terug naar boven. Die kloof is dieper dan het dossier.', 'Pip trekt je aan je kraag terug. ‘Niet naar beneden kijken!’', 'Gelukkig had ik een touwtje aan je badge geknoopt.', () => `Wegduiken (${IS_TOUCH ? 'de knop »' : keyLabel('dash')}) helpt over smalle kloven. Over brede niet.`];

// ---- damage ----
export function hurtPlayer(amount, fx, fz, ignoreInv = false) {
  if (P.dead) return;
  if (!ignoreInv && P.inv > 0) return;
  if (G.flags.godmode) return;
  const diff = SETTINGS.difficulty;
  if (diff === 'calm' && fx !== null) return;
  const mult = diff === 'story' ? 0.45 : diff === 'hard' ? 1.4 : 1;
  const taken = Math.round(amount * mult * mod('damageTaken'));
  G.hp = Math.max(0, G.hp - taken);
  G.stats.damageTaken = (G.stats.damageTaken || 0) + taken;
  P.inv = 0.55;
  if (fx !== null && fx !== undefined) {
    const dx = P.x - fx, dz = P.z - fz, d = Math.hypot(dx, dz) || 1;
    P.knock = {x: dx / d * 7, z: dz / d * 7};
  }
  PL.shake = Math.max(PL.shake, SETTINGS.shake && !calmView() ? 0.35 : 0);
  UI.hurt(amount);
  SFX.play('hurt');
  if (G.hp <= 0) PL.onDie?.();
}
export function healPlayer(n) { G.hp = Math.min(G.maxHp, G.hp + Math.round(n * mod('healMult'))); }

// ---- carried puzzle pieces ----
let carryShown = null;
function updateCarryVisual() {
  if (carryShown === P.carry) return;
  carryShown = P.carry;
  for (const g of [PL.carry3, PL.carryV]) { while (g.children.length) g.remove(g.children[0]); }
  if (!P.carry) return;
  const color = P.carry.def.color ?? 0xf4ecd8;
  for (const [g, s] of [[PL.carry3, 1], [PL.carryV, 0.35]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.4 * s, 0.4 * s), new THREE.MeshBasicMaterial({color, toneMapped: false}));
    g.add(m); const halo = glowSprite(color, 1.2 * s, 0.6); g.add(halo);
  }
}

// ---- Pip floats by your shoulder, and flies ahead when you ask for a hint ----
function updatePip(dt) {
  const pip = PL.pip;
  pip.root.visible = !!G.flags.pip && !G.flags.pipHidden;
  if (!pip.root.visible) return;
  const third = PL.camMode === 'third';
  const side = third ? 0.75 : 1.25, ahead = third ? 0.2 : 2.6;
  let tx = P.x + Math.cos(P.yaw) * -side - Math.sin(P.yaw) * ahead, tz = P.z - Math.sin(P.yaw) * -side - Math.cos(P.yaw) * ahead, ty = P.y + (third ? 2.0 : 2.45);
  if (PL.pipHint > 0 && PL.pipTarget) {
    PL.pipHint -= dt;
    const dx = PL.pipTarget.x - P.x, dz = PL.pipTarget.z - P.z, d = Math.hypot(dx, dz) || 1, reach = Math.min(4, d);
    tx = P.x + dx / d * reach; tz = P.z + dz / d * reach; ty = P.y + 1.6;
    if (Math.random() < dt * 30) FX.one({x: PL.pipPos.x, y: PL.pipPos.y, z: PL.pipPos.z, life: 0.8, s0: 0.12, color: 0xffc870});
  }
  PL.pipPos.x = damp(PL.pipPos.x, tx, 4, dt); PL.pipPos.y = damp(PL.pipPos.y, ty, 4, dt); PL.pipPos.z = damp(PL.pipPos.z, tz, 4, dt);
  pip.root.position.copy(PL.pipPos);
  pip.root.rotation.y = Math.atan2(P.x - PL.pipPos.x, P.z - PL.pipPos.z);
  pip.animate(dt, {t: PL.st.t, talk: PL.pipTalk > 0});
  PL.pipTalk = Math.max(0, (PL.pipTalk || 0) - dt);
}
export function pipHint(target) { PL.pipHint = 2.4; PL.pipTarget = target; }

// ---- cameras ----
const tmpV = new THREE.Vector3();
function updateCamera(dt, active) {
  const cam = R.camera, third = PL.camMode === 'third';
  PL.camBlend = damp(PL.camBlend, third ? 1 : 0, 7, dt);
  const fwdX = -Math.sin(P.yaw) * Math.cos(P.pitch), fwdY = Math.sin(P.pitch), fwdZ = -Math.cos(P.yaw) * Math.cos(P.pitch);
  // first-person eye with a gentle walking bob (none with reduced motion)
  const calm = calmView();
  PL.bobAmt = damp(PL.bobAmt, P.speed > 1 && !P.falling && !calm ? 1 : 0, 8, dt);
  PL.bob += dt * P.speed * 1.6;
  const bobY = Math.sin(PL.bob * 2) * 0.035 * PL.bobAmt, bobX = Math.cos(PL.bob) * 0.025 * PL.bobAmt;
  const eyeX = P.x + Math.cos(P.yaw) * bobX, eyeY = P.y + EYE + bobY, eyeZ = P.z - Math.sin(P.yaw) * bobX;
  // third-person orbit over the right shoulder, pulled in by walls and the ceiling
  const pivX = P.x + Math.cos(P.yaw) * 0.42, pivY = P.y + 1.6, pivZ = P.z - Math.sin(P.yaw) * 0.42;
  let want = PL.camDist;
  const ceil = ceilAt(P.x, P.z);
  let d = 0.25;
  for (; d < want; d += 0.1) {
    const x = pivX - fwdX * d, y = pivY - fwdY * d, z = pivZ - fwdZ * d, tx = tileOf(x), tz = tileOf(z);
    if (!inBounds(tx, tz) || solidTile(tx, tz) || y > Math.min(ceil, W.L.ceilY[tz * W.L.W + tx]) - 0.25 || y < surfaceAt(x, z) + 0.25 && !isChasm(tx, tz)) break;
    // keep a little gap from walls to the side
    let close = false;
    for (const [ox, oz] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) if (solidTile(tileOf(x + ox), tileOf(z + oz))) close = true;
    if (close) break;
  }
  want = Math.max(0.3, d - 0.15);
  PL.camCur = want < PL.camCur ? damp(PL.camCur, want, 20, dt) : damp(PL.camCur, want, 3, dt);
  const tpX = pivX - fwdX * PL.camCur, tpY = pivY - fwdY * PL.camCur, tpZ = pivZ - fwdZ * PL.camCur;
  const b = PL.camBlend;
  tmpV.set(lerp(eyeX, tpX, b), lerp(eyeY, tpY, b), lerp(eyeZ, tpZ, b));
  // screen shake (story scenes set PL.shake directly; reduced motion and 'Schudden uit' ignore it)
  if (calm || SETTINGS.shake === false) PL.shake = 0;
  PL.shake = Math.max(0, PL.shake - dt * 1.6);
  if (PL.shake > 0) { const s = PL.shake * PL.shake * 0.4; tmpV.x += (Math.random() - 0.5) * s; tmpV.y += (Math.random() - 0.5) * s; tmpV.z += (Math.random() - 0.5) * s; }
  if (P.falling) tmpV.y = Math.max(tmpV.y, P.y + 1.2);
  cam.position.copy(tmpV);
  PL.kick = calm ? 0 : damp(PL.kick, 0, 10, dt);
  cam.rotation.set(P.pitch + PL.kick * 0.04, P.yaw, 0);
  cam.fov = damp(cam.fov, (SETTINGS.fov ?? 72) + (P.dashT > 0 && !calm ? 6 : 0), 8, dt);
  cam.updateProjectionMatrix();
  // which body to show
  const showBody = b > 0.5 && PL.camCur > 0.9;
  PL.model.root.visible = showBody;
  PL.view.visible = b < 0.5 && G.tools.lamp;
  // first-person hands: bob, sway and tool swings
  const sway = Math.sin(PL.bob) * 0.012 * PL.bobAmt, a = PL.st.attack;
  PL.armL.position.set(-0.34 + sway, -0.3 + bobY * 0.5 + (PL.toolAnimKind === 'lamp' ? a * 0.08 : 0), -0.72 - (PL.toolAnimKind === 'lamp' ? a * 0.18 : 0));
  PL.armR.position.set(0.34 + sway, -0.32 + bobY * 0.5 - (PL.toolAnimKind === 'scale' ? a * 0.12 : 0), -0.74 - (PL.toolAnimKind === 'seal' ? a * 0.28 : 0));
  PL.armR.rotation.x = PL.toolAnimKind === 'seal' ? -a * 0.6 : PL.toolAnimKind === 'scale' ? a * 0.5 : 0;
  // the lantern light rides with the lantern
  const lit = G.tools.lamp;
  if (b > 0.5) PL.lantern3.g.getWorldPosition(tmpV);
  else { tmpV.set(-0.3, -0.42, -0.85); cam.updateMatrixWorld(); cam.localToWorld(tmpV); }
  if (!lit) tmpV.set(eyeX, eyeY, eyeZ);
  R.viewCamera.fov = cam.fov * 0.85; R.viewCamera.updateProjectionMatrix();
  W.probeAt(P.x, P.z, R.viewAmb.color); R.viewAmb.color.multiplyScalar(2.2).addScalar(0.12); R.viewAmb.intensity = 1;
  R.lantern.position.copy(tmpV);
  const flick = 0.92 + Math.sin(PL.st.t * 13) * 0.04 + Math.sin(PL.st.t * 31) * 0.03;
  R.lantern.color.set(lit ? 0xffc98a : 0xdfe8ff);
  R.lantern.intensity = (lit ? 7.5 * (G.flags.lampBright ? 1.25 : 1) : 2.2) * flick * (P.dead ? 0 : 1);
  R.lantern.distance = lit ? 14 : 8;
  for (const L of [PL.lantern3, PL.lanternV]) { L.halo.material.opacity = 0.55 + flick * 0.2; L.core.scale.setScalar(flick); }
}

// reduced motion (Opties, Toegankelijkheid): no head bob, camera shake, recoil or dash zoom
export const calmView = () => SETTINGS.motion === 'reduced';

export function savePosition() { G.pos = {x: P.x, z: P.z, yaw: P.yaw}; saveExplored(); }
export {dropCarry};
