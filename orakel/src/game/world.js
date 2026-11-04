// The loaded floor: tiles, static meshes, entities, colliders and spatial queries.
import * as THREE from 'three';
import {parseFloor, T} from '../engine/level.js';
import {buildLevelMesh} from '../engine/levelmesh.js';
import {R, setFlames, setLightSources} from '../engine/render.js';
import {FX} from '../engine/particles.js';
import {TILE, tileOf} from '../core/util.js';
import {G} from './state.js';

export const FLOORS = {};          // id -> floor definition (registered by content)
const PARSED = {}, BUILT = {};

export const W = {
  id: null, L: null, built: null, group: null,
  ents: [], byId: new Map(), block: null, cols: [], colGrid: new Map(),
  explored: null, flow: null, flowFrom: -1, flowT: 0,
  probeAt: null, onLoad: [],
};

export function registerFloor(def) { FLOORS[def.id] = def; }
export function parsed(id) { return PARSED[id] ||= parseFloor(FLOORS[id]); }

export function loadFloor(id) {
  const def = FLOORS[id];
  if (!def) throw new Error('unknown floor ' + id);
  unloadFloor();
  const L = parsed(id);
  if (L.errors.length) console.warn(L.errors);
  const built = BUILT[id] ||= buildLevelMesh(L, R.mats);
  const group = new THREE.Group();
  for (const m of built.meshes) group.add(m);
  R.scene.add(group);
  R.scene.fog.color.set(def.fog ?? 0x0b0907); R.scene.fog.density = def.fogDensity ?? 0.045;
  R.scene.background.set(def.fog ?? 0x0b0907);
  R.hemi.color.set(def.sky ?? 0x8a96b8); R.hemi.groundColor.set(def.ground ?? 0x2a1d12); R.hemi.intensity = def.hemi ?? 0.22;
  setFlames(built.flames);
  setLightSources(built.lights);
  Object.assign(W, {id, L, built, group, ents: [], byId: new Map(), block: new Uint8Array(L.W * L.H), cols: [], colGrid: new Map(), flow: null, flowFrom: -1, probeAt: built.probeAt});
  for (const c of built.colliders) addCollider({...c, static: true});
  // explored tiles (for the map)
  W.explored = new Uint8Array(L.W * L.H);
  const saved = G.explored[id];
  if (saved) try { const bin = atob(saved); for (let i = 0; i < W.explored.length; i++) W.explored[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1; } catch (e) { /* fresh */ }
  G.floor = id;
  for (const fn of W.onLoad) fn(W);
  return W;
}

export function unloadFloor() {
  for (const e of W.ents) e.destroy?.();
  if (W.group) R.scene.remove(W.group);
  FX.clear();
  W.ents = []; W.byId = new Map();
  W.group = null;
}

export function saveExplored() {
  if (!W.explored) return;
  const n = Math.ceil(W.explored.length / 8), bytes = new Uint8Array(n);
  for (let i = 0; i < W.explored.length; i++) if (W.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  G.explored[W.id] = btoa(bin);
}

export function addEntity(e) { W.ents.push(e); if (e.id) W.byId.set(e.id, e); return e; }
export function removeEntity(e) { const i = W.ents.indexOf(e); if (i >= 0) W.ents.splice(i, 1); if (e.id && W.byId.get(e.id) === e) W.byId.delete(e.id); e.destroy?.(); }
export const ent = id => W.byId.get(id);

// ---------- tiles ----------
export const inBounds = (tx, tz) => W.L && tx >= 0 && tz >= 0 && tx < W.L.W && tz < W.L.H;
export const tileType = (tx, tz) => (inBounds(tx, tz) ? W.L.tiles[tz * W.L.W + tx] : T.SOLID);
export function solidTile(tx, tz) {
  if (!inBounds(tx, tz)) return true;
  const i = tz * W.L.W + tx;
  return W.L.tiles[i] === T.SOLID || W.block[i] > 0;
}
export function setBlock(tx, tz, on) { if (!inBounds(tx, tz)) return; const i = tz * W.L.W + tx; W.block[i] = Math.max(0, W.block[i] + (on ? 1 : -1)); W.flowFrom = -1; }
export const revealedKey = (tx, tz) => `rev:${W.id}:${tx},${tz}`;
export function isChasm(tx, tz) {
  const t = tileType(tx, tz);
  return t === T.CHASM || (t === T.HIDDEN && !G.opened[revealedKey(tx, tz)]);
}
export function surfaceAt(x, z) {
  const tx = tileOf(x), tz = tileOf(z), t = tileType(tx, tz);
  if (t === T.DAIS) return 0.3;
  if (t === T.WATER) return -0.45;
  if (isChasm(tx, tz)) return -40;
  return 0;
}
export const ceilAt = (x, z) => { const tx = tileOf(x), tz = tileOf(z); return inBounds(tx, tz) ? W.L.ceilY[tz * W.L.W + tx] : 0; };
export const zoneAt = (x, z) => W.L.zoneAt(tileOf(x), tileOf(z));
// walkable for monsters and path finding: not solid, not a chasm, not a pillar
export function walkTile(tx, tz) {
  if (solidTile(tx, tz) || isChasm(tx, tz)) return false;
  return tileType(tx, tz) !== T.PILLAR;
}

// ---------- colliders: circles {x,z,r} and boxes {x,z,hw,hd} ----------
const cellKey = (tx, tz) => tx * 4096 + tz;
export function addCollider(c) {
  c.cells = [];
  const r = c.r ?? Math.max(c.hw, c.hd);
  for (let tz = tileOf(c.z - r); tz <= tileOf(c.z + r); tz++) for (let tx = tileOf(c.x - r); tx <= tileOf(c.x + r); tx++) {
    const k = cellKey(tx, tz); let a = W.colGrid.get(k); if (!a) W.colGrid.set(k, a = []); a.push(c); c.cells.push(k);
  }
  W.cols.push(c);
  return c;
}
export function removeCollider(c) {
  for (const k of c.cells || []) { const a = W.colGrid.get(k); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } }
  const i = W.cols.indexOf(c); if (i >= 0) W.cols.splice(i, 1);
}
export function moveCollider(c, x, z) { removeCollider(c); c.x = x; c.z = z; addCollider(c); }

// Push a circle out of solid tiles and colliders. Returns {x, z, hit}.
const out = {x: 0, z: 0, hit: false};
export function collide(x, z, r, self = null) {
  out.hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    const tx0 = tileOf(x - r), tx1 = tileOf(x + r), tz0 = tileOf(z - r), tz1 = tileOf(z + r);
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!solidTile(tx, tz)) continue;
      const bx0 = tx * TILE, bz0 = tz * TILE;
      const cx = Math.max(bx0, Math.min(x, bx0 + TILE)), cz = Math.max(bz0, Math.min(z, bz0 + TILE));
      let dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-5) { // centre inside the tile: push out along the shortest axis
        const l = x - bx0, rr = bx0 + TILE - x, u = z - bz0, dd = bz0 + TILE - z, m = Math.min(l, rr, u, dd);
        if (m === l) x = bx0 - r; else if (m === rr) x = bx0 + TILE + r; else if (m === u) z = bz0 - r; else z = bz0 + TILE + r;
      } else { x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
      moved = out.hit = true;
    }
    const seen = new Set();
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      const a = W.colGrid.get(cellKey(tx, tz)); if (!a) continue;
      for (const c of a) {
        if (c === self || seen.has(c) || c.off) continue;
        seen.add(c);
        if (c.r !== undefined) {
          const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-5) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; moved = out.hit = true; }
        } else {
          const cx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw)), cz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
          const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
          if (d < r && d > 1e-5) { x = cx + (dx / d) * r; z = cz + (dz / d) * r; moved = out.hit = true; }
          else if (d <= 1e-5) { z = c.z + (z < c.z ? -1 : 1) * (c.hd + r); moved = out.hit = true; }
        }
      }
    }
    if (!moved) break;
  }
  out.x = x; out.z = z;
  return out;
}

// March a ray; returns the distance to the first wall, floor or ceiling (or max).
export function raycast(ox, oy, oz, dx, dy, dz, max, step = 0.12) {
  for (let d = step; d <= max; d += step) {
    const x = ox + dx * d, y = oy + dy * d, z = oz + dz * d, tx = tileOf(x), tz = tileOf(z);
    if (solidTile(tx, tz)) return d - step;
    if (y > W.L.ceilY[tz * W.L.W + tx] - 0.05) return d - step;
    if (y < surfaceAt(x, z) + 0.02 && !isChasm(tx, tz)) return d - step;
  }
  return max;
}
export function los(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) { const t = i / n; if (solidTile(tileOf(ax + (bx - ax) * t), tileOf(az + (bz - az) * t))) return false; }
  return true;
}

// Breadth-first distances (in tiles) from the player's tile: monsters walk downhill.
export function flowField(px, pz, maxSteps = 28) {
  const tx = tileOf(px), tz = tileOf(pz), key = tz * W.L.W + tx;
  if (key === W.flowFrom && W.flow) return W.flow;
  const {W: w, H: h} = W.L, dist = W.flow && W.flow.length === w * h ? W.flow : new Int16Array(w * h);
  dist.fill(-1);
  if (!inBounds(tx, tz)) return dist;
  const q = [key]; dist[key] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % w, z = (i / w) | 0, d = dist[i];
    if (d >= maxSteps) continue;
    for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ddx, nz = z + ddz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const j = nz * w + nx;
      if (dist[j] >= 0 || !walkTile(nx, nz)) continue;
      dist[j] = d + 1; q.push(j);
    }
  }
  W.flow = dist; W.flowFrom = key;
  return dist;
}

export function markExplored(px, pz, radius = 5) {
  if (!W.explored) return;
  const tx = tileOf(px), tz = tileOf(pz);
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    const x = tx + dx, z = tz + dz;
    if (!inBounds(x, z) || dx * dx + dz * dz > radius * radius) continue;
    const i = z * W.L.W + x;
    if (W.explored[i] || W.L.tiles[i] === T.SOLID) continue;   // the map draws walls next to explored floor
    if (los(px, pz, x * TILE + 1, z * TILE + 1)) W.explored[i] = 1;
  }
}
