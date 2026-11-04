// Everything on a floor that moves, opens, talks or can be picked up.
import * as THREE from 'three';
import {W, addEntity, setBlock, addCollider, removeCollider, moveCollider, revealedKey, tileType, walkTile, solidTile, isChasm, ent} from './world.js';
import {G, saveGame} from './state.js';
import {ON, UI, SFX, cond, CAST, ITEMS, P} from './bus.js';
import {probedMaterial} from '../engine/batch.js';
import {R, addDynamicLight, removeDynamicLight} from '../engine/render.js';
import {makeModel, glowSprite, disposeModel} from '../engine/models.js';
import {FX} from '../engine/particles.js';
import {TILE, damp, dampAngle} from '../core/util.js';
import {T} from '../engine/level.js';
import {FACING} from '../engine/levelmesh.js';

const BOX = new Map();
const boxGeo = (w, h, d) => { const k = `${w}|${h}|${d}`; let g = BOX.get(k); if (!g) BOX.set(k, g = new THREE.BoxGeometry(w, h, d)); return g; };

export class Ent {
  constructor(def) {
    this.def = def; this.id = def.id; this.type = def.type;
    this.tx = def.x; this.tz = def.z; this.x = def.x * TILE + TILE / 2; this.z = def.z * TILE + TILE / 2; this.y = 0;
    this.group = new THREE.Group(); this.group.position.set(this.x, 0, this.z);
    W.group.add(this.group);
    this.probe = {value: new THREE.Color()};
    W.probeAt(this.x, this.z, this.probe.value);
    this.key = `${W.id}:${def.type}:${def.x},${def.z}`;
    this.visible = true;
  }
  mat(hex, o = {}) { return probedMaterial({color: hex, flatShading: true, ...o}, this.probe); }
  box(w, h, d, hex, x = 0, y = 0, z = 0, o = {}, parent = this.group) {
    const m = new THREE.Mesh(boxGeo(w, h, d), o.material || this.mat(hex, o.m)); m.position.set(x, y, z); parent.add(m); return m;
  }
  get interactable() { return false; }
  label() { return ''; }
  interact() {}
  update() {}
  destroy() { if (this.model) disposeModel(this.model); if (this.col) removeCollider(this.col); if (this.light) removeDynamicLight(this.light); this.group.parent?.remove(this.group); }
  dist() { return Math.hypot(P.x - this.x, P.z - this.z); }
  setVisible(v) { this.visible = v; this.group.visible = v; if (this.col) this.col.off = !v; }
}

// which way a door or gate spans: along x when its west and east neighbours are walls
const spansX = (tx, tz) => tileType(tx - 1, tz) === T.SOLID && tileType(tx + 1, tz) === T.SOLID;

// ---------------------------------------------------------------- doors
class Door extends Ent {
  constructor(def) {
    super(def);
    const zn = W.L.zoneAt(def.x, def.z), along = spansX(def.x, def.z), h = Math.min(3.0, W.L.ceilY[def.z * W.L.W + def.x] - 0.1);
    this.group.rotation.y = along ? 0 : Math.PI / 2;
    const frame = this.mat(0x5a3e26);
    this.box(0.22, h, 0.36, 0, -0.98, h / 2, 0, {material: frame}); this.box(0.22, h, 0.36, 0, 0.98, h / 2, 0, {material: frame});
    this.hinge = new THREE.Group(); this.hinge.position.set(-0.88, 0, 0); this.group.add(this.hinge);
    const leaf = new THREE.Mesh(boxGeo(1.76, h - 0.06, 0.12), probedMaterial({map: R.tex.plank, color: def.color ?? 0xb08a62}, this.probe));
    leaf.position.set(0.88, (h - 0.06) / 2, 0); this.hinge.add(leaf);
    for (const y of [0.5, h - 0.6]) this.box(1.7, 0.1, 0.16, 0x3a3430, 0.88, y, 0, {}, this.hinge);
    this.knob = this.box(0.1, 0.1, 0.22, 0xc8a050, 1.5, 1.05, 0, {m: {emissive: 0x302010}}, this.hinge);
    if (def.lock || def.flag) {
      const c = def.lockColor ?? (def.flag ? 0x9fc3ff : 0xd8a040);
      this.plate = this.box(0.34, 0.42, 0.2, c, 1.42, 1.15, 0, {m: {emissive: c, emissiveIntensity: 0.6}}, this.hinge);
      this.lockGlow = glowSprite(c, 0.8, 0.6); this.lockGlow.position.set(1.42, 1.15, 0.2); this.hinge.add(this.lockGlow);
    }
    this.open = !!G.opened[this.key] && !def.flag;
    this.ang = this.open ? 1 : 0; this.blocked = false;
    this.syncBlock();
  }
  get locked() { return (this.def.lock && !G.keys[this.def.lock] && !G.opened[this.key]) || (this.def.flag && !cond(this.def.flag)); }
  syncBlock() { const want = this.ang < 0.6; if (want !== this.blocked) { setBlock(this.tx, this.tz, want); this.blocked = want; } }
  get interactable() { return !this.open && this.dist() < 2.6; }
  label() { return this.locked ? (this.def.label || 'Een gesloten deur') : 'Open de deur'; }
  interact() {
    if (!this.locked) { this.open = true; return; }
    if (this.def.lock && G.keys[this.def.lock]) { G.opened[this.key] = true; this.open = true; UI.toast('Ontgrendeld', ITEMS['key:' + this.def.lock]?.name || 'De deur gaat open.'); SFX.play('unlock'); return; }
    SFX.play('locked');
    UI.pip(this.def.msg || (this.def.lock ? `Op slot. Hier past ${ITEMS['key:' + this.def.lock]?.name?.toLowerCase() || 'een sleutel'} op.` : 'Deze deur gaat nog niet open.'));
  }
  update(dt) {
    if (!this.open && !this.locked && this.dist() < 2.4) { this.open = true; SFX.play('door'); }
    if (this.open && this.def.flag && !cond(this.def.flag)) this.open = false;
    if (this.open && this.def.lock) G.opened[this.key] = true;
    this.ang = damp(this.ang, this.open ? 1 : 0, 5, dt);
    this.hinge.rotation.y = -this.ang * 1.75;
    if (this.lockGlow) this.lockGlow.visible = this.locked;
    this.syncBlock();
  }
}

class Gate extends Ent {
  constructor(def) {
    super(def);
    const along = spansX(def.x, def.z), h = Math.min(3.2, W.L.ceilY[def.z * W.L.W + def.x] - 0.05);
    this.group.rotation.y = along ? 0 : Math.PI / 2;
    this.bars = new THREE.Group(); this.group.add(this.bars);
    const iron = this.mat(def.color ?? 0x3a3632, {emissive: def.glow ?? 0x000000, emissiveIntensity: 0.5});
    for (let k = 0; k < 7; k++) this.box(0.09, h, 0.09, 0, -0.9 + k * 0.3, h / 2, 0, {material: iron}, this.bars);
    for (const y of [0.4, h / 2, h - 0.3]) this.box(2.0, 0.09, 0.12, 0, 0, y, 0, {material: iron}, this.bars);
    if (def.sign) { const s = this.box(0.6, 0.6, 0.04, def.signColor ?? 0x9fc3ff, 0, h * 0.6, 0.08, {m: {emissive: def.signColor ?? 0x9fc3ff, emissiveIntensity: 0.8}}, this.bars); s.rotation.z = Math.PI / 4; }
    this.h = h; this.lift = this.isOpen() ? 1 : 0; this.blocked = false;
    this.syncBlock();
  }
  isOpen() { return this.def.flag ? cond(this.def.flag) : !!this.def.open; }
  syncBlock() { const want = this.lift < 0.7; if (want !== this.blocked) { setBlock(this.tx, this.tz, want); this.blocked = want; } }
  get interactable() { return this.lift < 0.5 && this.dist() < 2.6 && !!this.def.msg; }
  label() { return this.def.label || 'Een ijzeren hek'; }
  interact() { UI.pip(this.def.msg); }
  update(dt) {
    const want = this.isOpen() ? 1 : 0;
    if (want !== this.want) { if (this.want !== undefined) SFX.play(want ? 'gateUp' : 'gateDown'); this.want = want; }
    this.lift = damp(this.lift, want, want ? 1.6 : 5, dt);
    this.bars.position.y = this.lift * (this.h - 0.2);
    this.syncBlock();
  }
}

// ---------------------------------------------------------------- truth and illusion
class Illusion extends Ent {
  constructor(def) {
    super(def);
    this.revealed = !!G.opened[revealedKey(def.x, def.z)];
    const zn = W.L.zoneAt(def.x, def.z), h = W.L.ceilY[def.z * W.L.W + def.x];
    this.material = probedMaterial({map: R.tex[zn.wall] || R.tex.brick, color: zn.tint.wall, transparent: true, opacity: 1}, this.probe);
    const geo = new THREE.BoxGeometry(TILE, h, TILE);
    geo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? h / TILE : 1); });
    this.mesh = new THREE.Mesh(geo, this.material); this.mesh.position.y = h / 2; this.group.add(this.mesh);
    this.shine = glowSprite(def.color ?? 0xffd36b, 2.4, 0); this.shine.position.y = 1.4; this.group.add(this.shine);
    this.fade = this.revealed ? 0 : 1;
    this.mesh.visible = !this.revealed;
    if (!this.revealed) { setBlock(this.tx, this.tz, true); this.blocked = true; }
  }
  reveal() {
    if (this.revealed) return;
    this.revealed = true; G.opened[revealedKey(this.tx, this.tz)] = true; G.stats.revealed++;
    if (this.blocked) { setBlock(this.tx, this.tz, false); this.blocked = false; }
    FX.burst(this.x, 1.5, this.z, 40, {color: [0xffd36b, 0xfff1b8], speed: 3, life: 1.2, s0: 0.2, spread: 1.6});
    SFX.play('reveal');
    ON.use[this.id]?.(this);
  }
  onReveal(x, z, r) { if (Math.hypot(x - this.x, z - this.z) < r + 1) this.reveal(); }
  update(dt) {
    if (this.revealed) { this.fade = Math.max(0, this.fade - dt * 1.5); this.material.opacity = this.fade; this.mesh.visible = this.fade > 0.01; }
    else this.shine.material.opacity = this.dist() < 4.5 ? 0.12 + Math.sin(R.time * 3) * 0.06 : 0;
  }
}

class Hidden extends Ent {
  constructor(def) {
    super(def);
    this.revealed = !!G.opened[revealedKey(def.x, def.z)];
    this.material = new THREE.MeshBasicMaterial({color: def.color ?? 0x9fd8ff, map: R.tex.plank, transparent: true, opacity: 0, depthWrite: false, toneMapped: false});
    this.planks = new THREE.Mesh(boxGeo(1.96, 0.08, 1.96), this.material); this.planks.position.y = -0.05; this.group.add(this.planks);
    this.fade = this.revealed ? 1 : 0;
  }
  onReveal(x, z, r) {
    if (this.revealed || Math.hypot(x - this.x, z - this.z) > r + 1) return;
    this.revealed = true; G.opened[revealedKey(this.tx, this.tz)] = true; W.flowFrom = -1;
    FX.burst(this.x, 0.1, this.z, 16, {color: 0x9fd8ff, speed: 1.2, life: 1, s0: 0.15, flat: true});
  }
  update(dt) {
    const shimmer = !this.revealed && this.dist() < 3 ? 0.05 + Math.sin(R.time * 4 + this.x) * 0.04 : 0;
    this.fade = this.revealed ? Math.min(1, this.fade + dt * 1.5) : 0;
    this.material.opacity = Math.max(shimmer, this.fade * 0.55);
  }
}

// ---------------------------------------------------------------- stairs between floors
class Stairs extends Ent {
  constructor(def) {
    super(def);
    // the stair goes into the wall it is set against
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const back = dirs.find(([dx, dz]) => tileType(def.x + dx, def.z + dz) === T.SOLID) || [0, -1];
    this.back = back;
    this.group.rotation.y = Math.atan2(-back[0], -back[1]);   // local -z = into the wall
    const stone = this.mat(def.color ?? 0x8a8478), down = def.down;
    for (let k = 0; k < 6; k++) {
      const y = down ? -0.25 * (k + 1) : 0.25 * k;
      this.box(1.9, 0.25, 0.4, 0, 0, y + 0.125 - (down ? 0 : 0), -0.6 - k * 0.38, {material: stone});
    }
    this.box(0.24, 3.1, 0.3, 0x5a4a3a, -1.0, 1.55, -0.95); this.box(0.24, 3.1, 0.3, 0x5a4a3a, 1.0, 1.55, -0.95); this.box(2.3, 0.3, 0.4, 0x5a4a3a, 0, 3.15, -0.95);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3), new THREE.MeshBasicMaterial({color: 0x000000}));
    dark.position.set(0, 1.5, -1.0); this.group.add(dark);
    this.glow = glowSprite(def.glow ?? 0xffc870, 2.6, 0.35); this.glow.position.set(0, 1.4, -0.6); this.group.add(this.glow);
  }
  get interactable() { return this.dist() < 2.6; }
  label() { return cond(this.def.need) ? (this.def.label || (this.def.down ? 'Daal af' : 'Ga naar boven')) : (this.def.lockedLabel || 'De trap is versperd'); }
  interact() {
    if (!cond(this.def.need)) { UI.pip(this.def.msg || 'Hier kun je nog niet langs.'); return; }
    ON.use[this.id]?.(this);
    if (this.def.to) travel(this.def.to, this.def.at);
  }
  update() { this.glow.material.opacity = cond(this.def.need) ? 0.35 + Math.sin(R.time * 2) * 0.08 : 0.08; }
}
export let travel = () => {};
export function setTravel(fn) { travel = fn; }

// ---------------------------------------------------------------- people
// How people say hello when you first walk up (cast greet), and the little sounds of their habits.
const GREETS = {wave: 'wave', nod: 'nod', tipcap: 'tipcap', fingerguns: 'fingerguns'};
const HABIT_SFX = {jingle: 'locked', tipcap: 'pick', whistle: 'pip'};
export class Npc extends Ent {
  constructor(def) {
    super(def);
    const c = CAST[def.id] || {name: def.id, model: {}};
    this.cast = c;
    this.model = makeModel({npc: true, ...c.model, probe: this.probe});
    this.group.add(this.model.root);
    this.yaw = def.dir ? FACING[def.dir] : 0; this.baseYaw = this.yaw;
    this.model.root.rotation.y = this.yaw;
    // st.mood is a mood id (see engine/models.js) that the conversation may set while someone speaks
    this.st = {t: Math.random() * 10, walk: 0, talk: false, look: null, mood: null};
    this.col = addCollider({x: this.x, z: this.z, r: c.r ?? 0.42, npc: true});
    this.path = null;
    this.setVisible(cond(def.if));
    this.bubbleT = 0;
    this.greeted = false;
    // a jingle of keys or a whistle, only when you are close enough to hear it
    this.model.onGesture = name => { const s = HABIT_SFX[name]; if (s && this.visible && this.dist() < 6) SFX.play(s); };
  }
  get interactable() { return this.visible && !this.path && this.dist() < (this.cast.reach ?? 2.8) && !this.def.mute; }
  label() { return this.def.label || `Praat met ${this.cast.name}`; }
  interact() { ON.talk[this.id] ? UI.talk(this) : UI.pip('…'); }
  // scripted walking: returns a promise that resolves on arrival
  walkTo(x, z, speed = 2.2) { return new Promise(res => { this.path = {x, z, speed, res}; }); }
  face(x, z) { this.faceAt = {x, z}; }
  update(dt) {
    if (this.def.if !== undefined) { const v = cond(this.def.if); if (v !== this.visible) this.setVisible(v); }
    if (!this.visible) return;
    this.st.t += dt;
    if (this.path) {
      const {x, z, speed} = this.path, dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { const r = this.path.res; this.path = null; this.st.walk = 0; r(); }
      else { const s = Math.min(d, speed * dt); this.x += dx / d * s; this.z += dz / d * s; this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt); this.st.walk = 1; }
      this.group.position.set(this.x, this.y, this.z);
      moveCollider(this.col, this.x, this.z);
      W.probeAt(this.x, this.z, this.probe.value);
    } else {
      const d = this.dist(), toYou = Math.atan2(P.x - this.x, P.z - this.z);
      let want = this.baseYaw;
      if (this.faceAt) want = Math.atan2(this.faceAt.x - this.x, this.faceAt.z - this.z);
      else if (d < 5 && !this.def.still) want = toYou;
      this.yaw = dampAngle(this.yaw, want, 4, dt);
      // the head turns to you before the body does (and for people who stay where they are)
      const rel = Math.atan2(Math.sin(toYou - this.yaw), Math.cos(toYou - this.yaw));
      this.st.look = d < 6.5 && Math.abs(rel) < 2.2 && !this.faceAt ? Math.max(-0.95, Math.min(0.95, rel)) : null;
      // say hello once, the first time you walk up
      if (!this.greeted && d < 3.6 && !this.talking && this.model.gesture) {
        this.greeted = true;
        this.model.gesture(GREETS[this.cast.greet] || 'wave');
      }
    }
    this.model.root.rotation.y = this.yaw;
    this.model.animate(dt, this.st);
  }
}

// ---------------------------------------------------------------- loot
class Chest extends Ent {
  constructor(def) {
    super(def);
    this.open = !!G.opened[this.key];
    this.group.rotation.y = def.dir ? FACING[def.dir] : 0;
    const wood = probedMaterial({map: R.tex.plank, color: def.color ?? 0xa0703c}, this.probe), trim = this.mat(0xd8b050, {emissive: 0x3a2a08});
    this.box(1.1, 0.55, 0.7, 0, 0, 0.275, 0, {material: wood});
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.55, -0.35); this.group.add(this.lid);
    this.box(1.12, 0.22, 0.72, 0, 0, 0.11, 0.35, {material: wood}, this.lid);
    this.box(1.14, 0.06, 0.06, 0, 0, 0.02, 0.71, {material: trim}, this.lid);
    this.box(0.16, 0.2, 0.06, 0, 0, 0.42, 0.37, {material: trim});
    this.glow = glowSprite(0xffd36b, 1.6, this.open ? 0 : 0.4); this.glow.position.y = 0.9; this.group.add(this.glow);
    this.lid.rotation.x = this.open ? -1.9 : 0;
    this.col = addCollider({x: this.x, z: this.z, r: 0.55});
  }
  get interactable() { return !this.open && this.dist() < 2.4; }
  label() { return 'Open de kist'; }
  interact() {
    if (this.def.need && !cond(this.def.need)) { UI.pip(this.def.msg || 'De kist zit vast.'); return; }
    this.open = true; G.opened[this.key] = true; SFX.play('chest');
    FX.burst(this.x, 0.8, this.z, 30, {color: [0xffd36b, 0xffffff], speed: 2.5, up: 2, life: 1});
    for (const it of [].concat(this.def.items || this.def.item || [])) giveItem(it, this);
    ON.use[this.id]?.(this);
    saveGame();
  }
  update(dt) {
    this.lid.rotation.x = damp(this.lid.rotation.x, this.open ? -1.9 : 0, 6, dt);
    this.glow.material.opacity = this.open ? Math.max(0, this.glow.material.opacity - dt) : 0.3 + Math.sin(R.time * 2.5) * 0.1;
  }
}

export let giveItem = () => {};
export function setGiveItem(fn) { giveItem = fn; }

class Item extends Ent {
  constructor(def) {
    super(def);
    const info = ITEMS[def.id] || ITEMS[def.id?.split(':')[0]] || {};
    this.info = info;
    this.taken = !!G.opened[this.key] || (def.id && G.items[def.id] && info.unique !== false);
    const color = def.color ?? info.color ?? 0xffd36b;
    this.holder = new THREE.Group(); this.holder.position.y = 1.0; this.group.add(this.holder);
    const kind = info.kind || 'scroll';
    if (kind === 'scroll' || kind === 'bron' || kind === 'halluc') {
      this.box(0.16, 0.5, 0.16, color === 0xffd36b ? 0xf4ecd8 : 0xeaf0ff, 0, 0, 0, {m: {emissive: color, emissiveIntensity: 0.35}}, this.holder);
      this.box(0.22, 0.07, 0.22, 0xc8a050, 0, 0.27, 0, {}, this.holder); this.box(0.22, 0.07, 0.22, 0xc8a050, 0, -0.27, 0, {}, this.holder);
      this.holder.rotation.z = 0.5;
    } else if (kind === 'crystal') {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({color, toneMapped: false})); this.holder.add(m);
    } else if (kind === 'key') {
      this.box(0.08, 0.5, 0.06, color, 0, 0, 0, {m: {emissive: color, emissiveIntensity: 0.5}}, this.holder);
      this.box(0.26, 0.2, 0.06, color, 0, 0.3, 0, {m: {emissive: color, emissiveIntensity: 0.5}}, this.holder);
      this.box(0.18, 0.06, 0.06, color, 0.1, -0.2, 0, {}, this.holder);
    } else if (kind === 'snack') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), this.mat(0xc88a40, {emissive: 0x3a2008})); m.rotation.x = 0.4; this.holder.add(m);
    } else if (kind === 'tool') {
      this.box(0.4, 0.4, 0.4, color, 0, 0, 0, {m: {emissive: color, emissiveIntensity: 0.8}}, this.holder);
    } else if (kind === 'card') {
      this.box(0.36, 0.22, 0.02, 0xfff4d8, 0, 0, 0, {m: {emissive: 0xe8c060, emissiveIntensity: 0.4}}, this.holder);
    }
    this.glow = glowSprite(color, kind === 'tool' ? 2.4 : 1.3, 0.7); this.holder.add(this.glow);
    if (def.pedestal) this.box(0.8, 0.7, 0.8, 0x6a6258, 0, 0.35, 0);
    this.setVisible(!this.taken && cond(def.if));
  }
  get interactable() { return this.visible && this.dist() < 2.2 && !!this.def.manual; }
  label() { return this.def.label || `Pak ${this.info.name || 'het voorwerp'}`; }
  interact() { this.take(); }
  take() {
    if (this.taken) return;
    this.taken = true; G.opened[this.key] = true; this.setVisible(false);
    FX.burst(this.x, 1.0, this.z, 24, {color: this.def.color ?? this.info.color ?? 0xffd36b, speed: 2, up: 1.5, life: 0.8});
    giveItem(this.def.id, this);
    ON.pickup[this.def.id]?.(this);
  }
  update(dt) {
    if (this.taken) return;
    if (this.def.if !== undefined) this.setVisible(cond(this.def.if));
    if (!this.visible) return;
    this.holder.rotation.y += dt * 1.6;
    this.holder.position.y = 1.0 + Math.sin(R.time * 2 + this.x) * 0.1;
    if (!this.def.manual && this.dist() < 1.25 && !P.falling) this.take();
  }
}

// ---------------------------------------------------------------- the coffee corner: save, heal, travel
class Coffee extends Ent {
  constructor(def) {
    super(def);
    this.group.rotation.y = def.dir ? FACING[def.dir] : 0;
    this.box(0.8, 1.7, 0.6, 0x7a2a2a, 0, 0.85, 0, {m: {emissive: 0x1a0505}});
    this.box(0.6, 0.5, 0.05, 0x1a1a1e, 0, 1.25, 0.31, {m: {emissive: 0x204030, emissiveIntensity: 0.7}});
    this.box(0.36, 0.3, 0.2, 0x2a2a2a, 0, 0.55, 0.35);
    this.cup = this.box(0.1, 0.12, 0.1, 0xf4f0e8, 0, 0.47, 0.37);
    this.box(0.7, 0.16, 0.06, 0xe8c27a, 0, 1.6, 0.31, {m: {emissive: 0xe8c27a, emissiveIntensity: 0.6}});
    this.light = addDynamicLight({x: this.x, y: 1.4, z: this.z, hex: 0x9fe0b0, i: 0.6, range: 5, kind: 'glow', dyn: 3});
    this.col = addCollider({x: this.x, z: this.z, r: 0.55});
    this.steamT = 0;
  }
  get interactable() { return this.dist() < 2.4; }
  label() { return 'Neem pauze bij de koffieautomaat'; }
  interact() { ON.use.coffee?.(this); }
  update(dt) {
    this.steamT -= dt;
    if (this.steamT < 0 && this.dist() < 14) { this.steamT = 0.35; const yaw = this.group.rotation.y; FX.one({x: this.x + Math.sin(yaw) * 0.37, y: 0.6, z: this.z + Math.cos(yaw) * 0.37, vy: 0.4, vx: (Math.random() - 0.5) * 0.1, life: 1.6, s0: 0.08, s1: 0.3, color: 0x8a8a8a, additive: false, a: 0.35}); }
  }
}

// ---------------------------------------------------------------- switches and puzzles
class Lever extends Ent {
  constructor(def) {
    super(def);
    this.group.rotation.y = def.dir ? FACING[def.dir] : 0;
    this.box(0.5, 0.9, 0.4, 0x5a5048, 0, 0.45, 0);
    this.handle = new THREE.Group(); this.handle.position.set(0, 0.9, 0); this.group.add(this.handle);
    this.box(0.08, 0.7, 0.08, 0x8a7a6a, 0, 0.35, 0, {}, this.handle);
    this.knob = this.box(0.16, 0.16, 0.16, def.color ?? 0xd04030, 0, 0.72, 0, {m: {emissive: def.color ?? 0xd04030, emissiveIntensity: 0.5}}, this.handle);
    this.col = addCollider({x: this.x, z: this.z, r: 0.35});
    this.on = !!G.flags[def.flag];
    this.handle.rotation.x = this.on ? 0.7 : -0.7;
  }
  get interactable() { return this.dist() < 2.2 && !(this.def.once && this.on) && cond(this.def.if); }
  label() { return this.def.label || 'Zet de hendel om'; }
  interact() {
    this.on = !this.on; SFX.play('lever');
    if (this.def.flag) G.flags[this.def.flag] = this.on;
    ON.use[this.id]?.(this);
  }
  update(dt) { this.on = this.def.flag ? !!G.flags[this.def.flag] : this.on; this.handle.rotation.x = damp(this.handle.rotation.x, this.on ? 0.7 : -0.7, 8, dt); }
}

class Plate extends Ent {
  constructor(def) {
    super(def);
    this.plate = this.box(1.5, 0.12, 1.5, def.color ?? 0x8a7a68, 0, 0.06, 0, {m: {emissive: def.color ?? 0x000000, emissiveIntensity: 0.25}});
    if (def.accept) { const c = CRATE_TYPES[def.accept]?.color ?? 0xffffff; this.mark = this.box(0.7, 0.02, 0.7, c, 0, 0.13, 0, {m: {emissive: c, emissiveIntensity: 0.7}}); }
    this.pressed = false;
  }
  update(dt) {
    let p = false;
    if (!this.def.accept && Math.hypot(P.x - this.x, P.z - this.z) < 0.9) p = true;
    for (const e of W.ents) if (e instanceof Crate && e.tx === this.tx && e.tz === this.tz && !e.moving && (!this.def.accept || e.def.kind === this.def.accept)) p = true;
    if (p !== this.pressed) { this.pressed = p; SFX.play(p ? 'plateOn' : 'plateOff'); if (this.def.flag && (p || !this.def.latch)) G.flags[this.def.flag] = p; ON.use[this.id]?.(this); }
    this.plate.position.y = damp(this.plate.position.y, this.pressed ? 0.02 : 0.06, 10, dt);
  }
}

export const CRATE_TYPES = {
  open: {color: 0x7fe0a4, label: 'OPENBAAR'}, intern: {color: 0x8fb7ff, label: 'INTERN'}, geheim: {color: 0xff8a70, label: 'VERTROUWELIJK'},
  plain: {color: 0xb08458, label: ''},
};
class Crate extends Ent {
  constructor(def) {
    super(def);
    const t = CRATE_TYPES[def.kind] || CRATE_TYPES.plain;
    const wood = probedMaterial({map: R.tex.plank, color: 0xb08458}, this.probe);
    this.box(1.6, 1.3, 1.6, 0, 0, 0.65, 0, {material: wood});
    if (def.kind && def.kind !== 'plain') for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const b = this.box(0.9, 0.5, 0.04, t.color, Math.sin(ry) * 0.81, 0.75, Math.cos(ry) * 0.81, {m: {emissive: t.color, emissiveIntensity: 0.45}}); b.rotation.y = ry; }
    this.home = {x: def.x, z: def.z};
    setBlock(this.tx, this.tz, true);
    this.push = 0; this.moving = null;
  }
  get interactable() { return false; }
  tryPush(dx, dz) {
    if (this.moving || this.def.fixed) return false;
    const nx = this.tx + dx, nz = this.tz + dz;
    if (!walkTile(nx, nz) || tileType(nx, nz) === T.WATER || tileType(nx, nz) === T.DOOR) return false;
    for (const e of W.ents) if ((e instanceof Crate && e.tx === nx && e.tz === nz) || ((e instanceof Npc || e instanceof Chest) && e.visible && e.tx === nx && e.tz === nz)) return false;
    setBlock(this.tx, this.tz, false);
    this.moving = {fx: this.x, fz: this.z, t: 0};
    this.tx = nx; this.tz = nz;
    setBlock(nx, nz, true);
    SFX.play('push');
    return true;
  }
  resetHome() { if (this.moving) return; setBlock(this.tx, this.tz, false); this.tx = this.home.x; this.tz = this.home.z; setBlock(this.tx, this.tz, true); this.x = this.tx * TILE + 1; this.z = this.tz * TILE + 1; this.group.position.set(this.x, 0, this.z); }
  update(dt) {
    if (this.moving) {
      const m = this.moving; m.t = Math.min(1, m.t + dt / 0.28);
      const tx = this.tx * TILE + 1, tz = this.tz * TILE + 1, e = m.t * m.t * (3 - 2 * m.t);
      this.x = m.fx + (tx - m.fx) * e; this.z = m.fz + (tz - m.fz) * e;
      this.group.position.set(this.x, 0, this.z);
      if (m.t >= 1) { this.moving = null; W.probeAt(this.x, this.z, this.probe.value); FX.burst(this.x, 0.1, this.z, 10, {color: 0x9a8a78, additive: false, speed: 1.5, life: 0.6, s0: 0.12, flat: true}); }
    }
  }
}

// Puzzle objects: their look comes from OBJECT_KINDS, their meaning from the content (ON.use / ON.place / ON.hit).
export const OBJECT_KINDS = {};
class Obj extends Ent {
  constructor(def) {
    super(def);
    this.group.rotation.y = def.dir ? FACING[def.dir] : 0;
    this.state = G.flags[`obj:${def.id}`] ?? def.state ?? 0;
    this.holding = null;
    const kind = OBJECT_KINDS[def.kind];
    kind?.build?.(this);
    if (def.solid !== false && kind?.solid !== false) this.col = addCollider({x: this.x, z: this.z, r: def.r ?? kind?.r ?? 0.5});
    this.setVisible(cond(def.if));
  }
  setState(v) { this.state = v; if (this.def.id) G.flags[`obj:${this.def.id}`] = v; OBJECT_KINDS[this.def.kind]?.onState?.(this, v); }
  get interactable() {
    if (!this.visible || this.dist() > (this.def.reach ?? 2.5)) return false;
    const k = OBJECT_KINDS[this.def.kind];
    if (k?.interactable) return k.interactable(this);
    return !!(ON.use[this.id] || this.def.kind === 'carry' || (this.def.kind === 'slot' && P.carry));
  }
  label() { const k = OBJECT_KINDS[this.def.kind]; return (k?.label?.(this)) ?? this.def.label ?? 'Bekijk'; }
  interact() {
    const k = OBJECT_KINDS[this.def.kind];
    if (k?.interact) return k.interact(this);
    if (this.def.kind === 'carry' && !P.carry && !this.placed) return pickUp(this);
    if (this.def.kind === 'slot' && P.carry) return placeOn(this);
    ON.use[this.id]?.(this);
  }
  onHit(tool, dmg) { OBJECT_KINDS[this.def.kind]?.hit?.(this, tool, dmg); ON.hit[this.id]?.(this, tool); }
  update(dt) {
    if (this.def.if !== undefined) { const v = cond(this.def.if); if (v !== this.visible) this.setVisible(v); }
    if (this.visible) OBJECT_KINDS[this.def.kind]?.update?.(this, dt);
  }
}
// carrying: the item leaves the floor and rides along in the player's hand
export function pickUp(obj) {
  P.carry = obj; obj.setVisible(false); SFX.play('pick');
  UI.toast('Je draagt', obj.def.label?.replace(/^Pak (op )?/, '') || obj.def.name || 'iets');
}
export function placeOn(slot) {
  const item = P.carry;
  if (!item) return;
  const ok = ON.place[slot.def.group || slot.id]?.(slot, item);
  if (ok === false) { SFX.play('wrong'); return; }
  P.carry = null;
  slot.holding = item;
  slot.stack = (slot.stack || 0) + 1;
  item.tx = slot.tx; item.tz = slot.tz; item.x = slot.x; item.z = slot.z;
  item.group.position.set(slot.x + (slot.stack - 1) * 0.28 - 0.3, (slot.def.placeY ?? 0.2) + (slot.stack - 1) * 0.12, slot.z);
  item.setVisible(true);
  item.placed = slot;
  if (item.col) item.col.off = true;
  SFX.play('place');
}
export function dropCarry() {
  const item = P.carry;
  if (!item) return;
  P.carry = null;
  item.x = item.home?.x ?? item.x; item.z = item.home?.z ?? item.z;
  item.group.position.set(item.x, 0, item.z);
  item.setVisible(true);
  UI.toast('Teruggelegd', 'Het ligt weer waar je het vond.');
}

class Sign extends Ent {
  constructor(def) {
    super(def);
    this.group.rotation.y = def.dir ? FACING[def.dir] : 0;
    const kind = def.kind || 'board';
    if (kind === 'board') { this.box(1.4, 1.0, 0.08, 0x6a4a2a, 0, 1.6, -0.9); this.box(1.2, 0.8, 0.02, 0xf0e4c8, 0, 1.6, -0.85, {m: {emissive: 0x302818, emissiveIntensity: 0.5}}); for (let k = 0; k < 4; k++) this.box(0.3, 0.2, 0.01, [0xffe08a, 0xffffff, 0xbfe0ff, 0xffc0c0][k], -0.4 + k * 0.27, 1.65 + (k % 2) * 0.15, -0.83); }
    else if (kind === 'plaque') { this.box(1.0, 0.6, 0.06, 0xc8a050, 0, 1.7, -0.95, {m: {emissive: 0x4a3010, emissiveIntensity: 0.6}}); }
    else if (kind === 'poster') { this.box(1.1, 1.5, 0.03, 0xe8c060, 0, 1.7, -0.96, {m: {emissive: 0x8a6010, emissiveIntensity: 0.8}}); this.box(0.8, 0.3, 0.01, 0x2a1a0a, 0, 2.0, -0.94); }
    else if (kind === 'book') { this.box(0.5, 0.95, 0.4, 0x6e4a2c, 0, 0.475, 0); this.box(0.7, 0.06, 0.5, 0x7e5634, 0, 0.98, 0); this.box(0.62, 0.04, 0.44, 0xf4ead2, 0, 1.03, 0, {m: {emissive: 0x6a5a30, emissiveIntensity: 0.4}}); this.col = addCollider({x: this.x, z: this.z, r: 0.45}); }
    else if (kind === 'letter') { this.box(1.7, 0.78, 0.9, 0x7a5232, 0, 0.39, 0); this.box(1.8, 0.06, 1.0, 0x9a6a42, 0, 0.8, 0); this.env = this.box(0.5, 0.02, 0.34, 0xfff1d0, 0, 0.84, 0.05, {m: {emissive: 0xffd890, emissiveIntensity: 0.7}}); this.box(0.12, 0.03, 0.12, 0xc03020, 0, 0.86, 0.05); this.col = addCollider({x: this.x, z: this.z, r: 0.75}); }
    else if (kind === 'stone') { this.box(1.0, 1.6, 0.5, 0x8a8478, 0, 0.8, 0); this.box(0.8, 1.1, 0.02, 0xa8a090, 0, 0.9, 0.26, {m: {emissive: 0x2a2820, emissiveIntensity: 0.4}}); this.col = addCollider({x: this.x, z: this.z, r: 0.55}); }
    const low = kind === 'book' || kind === 'stone' || kind === 'letter';
    this.glow = glowSprite(def.color ?? 0xffe2a6, 1.2, 0.25); this.glow.position.set(0, low ? 1.1 : 1.7, low ? 0.1 : -0.7); this.group.add(this.glow);
    this.read = !!G.opened[this.key];
  }
  get interactable() { return this.dist() < 2.6 && cond(this.def.if); }
  label() { return this.def.label || 'Lees'; }
  interact() {
    this.read = true; G.opened[this.key] = true;
    if (ON.use[this.id]) return ON.use[this.id](this);
    UI.read(this.def.title || 'Een bordje', this.def.text || '');
  }
  update() { this.glow.material.opacity = this.read ? 0.08 : 0.22 + Math.sin(R.time * 2 + this.x) * 0.08; }
}

class Fire extends Ent {
  constructor(def) {
    super(def);
    if (def.lit !== false && !def.id) { this.static = true; return; }   // baked into the floor
    this.lit = G.flags[`fire:${def.id}`] ?? !!def.lit;
    this.box(0.7, 0.2, 0.7, 0x3c3632, 0, 0.1, 0); this.box(0.2, 0.7, 0.2, 0x3c3632, 0, 0.55, 0); this.box(0.9, 0.25, 0.9, 0x4a403a, 0, 1.0, 0);
    this.flame = glowSprite(def.color ?? 0xff9a4a, 1.8, 0); this.flame.position.y = 1.45; this.group.add(this.flame);
    this.light = addDynamicLight({x: this.x, y: 1.7, z: this.z, hex: def.color ?? 0xff9a4a, i: 1.2, range: 10, kind: 'fire', on: this.lit, prio: 4});
    this.col = addCollider({x: this.x, z: this.z, r: 0.5});
  }
  get interactable() { return !this.static && !this.lit && this.dist() < 2.4 && !!this.def.kindle; }
  label() { return this.def.label || 'Steek het vuur aan'; }
  interact() { this.kindle(); }
  kindle() { if (this.lit) return; this.lit = true; G.flags[`fire:${this.def.id}`] = true; this.light.on = true; SFX.play('kindle'); FX.burst(this.x, 1.3, this.z, 30, {color: [this.def.color ?? 0xff9a4a, 0xffe08a], speed: 2.5, up: 2, life: 0.9}); ON.use[this.id]?.(this); }
  onHit(tool) { if (tool === 'lamp' && this.def.kindle !== false && !this.lit && this.def.lampLight) this.kindle(); }
  update(dt) {
    if (this.static) return;
    if (G.flags[`fire:${this.def.id}`] && !this.lit) { this.lit = true; this.light.on = true; }
    this.flame.material.opacity = this.lit ? 0.85 + Math.sin(R.time * 13 + this.x) * 0.1 : 0;
    if (this.lit && Math.random() < dt * 8) FX.one({x: this.x + (Math.random() - 0.5) * 0.4, y: 1.3, z: this.z + (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), life: 0.8, s0: 0.12, color: this.def.color ?? 0xff9a4a});
  }
}

class Trigger extends Ent {
  constructor(def) { super(def); this.done = !!G.opened[this.key] && !def.repeat; this.inside = false; }
  update() {
    if (this.done && !this.def.repeat) return;
    const r = (this.def.r ?? 1.2) * TILE, inside = this.dist() < r && cond(this.def.if);
    if (inside && !this.inside) { if (!this.def.repeat) { this.done = true; G.opened[this.key] = true; } ON.trigger[this.id]?.(this); }
    this.inside = inside;
  }
}
class Marker extends Ent {}

const TYPES = {door: Door, gate: Gate, illusion: Illusion, hidden: Hidden, stairs: Stairs, npc: Npc, chest: Chest, item: Item, coffee: Coffee, lever: Lever, plate: Plate, crate: Crate, object: Obj, sign: Sign, fire: Fire, trigger: Trigger, vista: Marker, arrival: Marker};
export {Crate, Obj, Door, Gate, Illusion, Hidden, Item, Chest, Sign, Fire, Coffee, Lever, Plate, Stairs};

export function spawnEntities() {
  for (const def of W.L.entities) {
    if (def.type === 'enemy' || def.type === 'prop') continue;
    const C = TYPES[def.type];
    if (!C) continue;
    addEntity(new C(def));
  }
}

// The lamp's reveal pulse reaches everything within r metres.
export function revealAround(x, z, r) { for (const e of W.ents) e.onReveal?.(x, z, r); }
export const entAt = (tx, tz, Cls) => W.ents.find(e => e.tx === tx && e.tz === tz && (!Cls || e instanceof Cls));
void solidTile; void isChasm; void ent;
