// Turns a parsed floor into merged static meshes with baked torch light,
// a probe grid (baked light where people stand) and the list of light sources.
import * as THREE from 'three';
import {T} from './level.js';

// props placed through the legend face a direction: local +z is their front
export const FACING = {n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2};
import {Batch} from './batch.js';
import {buildProp} from './props.js';
import {TILE, linear, hash2, smooth, lerp, makeRng} from '../core/util.js';

const CHASM_Y = -12;
const DIRV = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const surfaceY = t => (t === T.CHASM || t === T.HIDDEN || t === T.BRIDGE ? CHASM_Y : t === T.WATER ? -0.45 : t === T.DAIS ? 0.3 : 0);
const isSolid = t => t === T.SOLID;

export function buildLevelMesh(L, materials) {
  const {W, H, tiles} = L;
  const rng = makeRng(L.id.length * 977 + W * 13 + H);
  const batch = new Batch();
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? T.SOLID : tiles[z * W + x]);
  const lights = [];   // {x, y, z, color:[r,g,b] linear, i, range, kind}
  const flames = [];   // {x, y, z, color, s}
  const colliders = [];
  const solidAtPoint = (px, pz) => isSolid(at(Math.floor(px / TILE), Math.floor(pz / TILE)));

  const tint = (hex, k = 1) => { const c = linear(hex ?? 0xb0a090); return [c[0] * k, c[1] * k, c[2] * k]; };

  // ---------- surfaces ----------
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const t = at(x, z);
    if (isSolid(t)) continue;
    const zn = L.zoneAt(x, z), x0 = x * TILE, z0 = z * TILE, sy = surfaceY(t), c = L.ceilY[z * W + x];
    const vary = 0.9 + hash2(x, z, 7) * 0.18;
    // floor
    let key = null, tc = null;
    if (t === T.CHASM || t === T.HIDDEN || t === T.BRIDGE) { key = 'rough'; tc = [0.01, 0.01, 0.012]; }
    else if (t === T.CARPET) { key = 'carpet'; tc = tint(zn.tint.carpet ?? 0xffffff, vary); }
    else if (t === T.ALT) { key = zn.floor2 || 'tiles'; tc = tint(zn.tint.floor2 ?? zn.tint.floor, vary); }
    else if (t === T.WATER) { key = zn.floor; tc = tint(zn.tint.floor, 0.45 * vary); }
    else { key = zn.floor; tc = tint(zn.tint.floor, vary); }
    const floorAO = (px, pz) => {
      let n = 0;
      for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) if (solidAtPoint(px + ox, pz + oz)) n++;
      return 1 - n * 0.12;
    };
    batch.grid(key, [x0, sy, z0 + TILE], [TILE, 0, 0], [0, 0, -TILE], 2, 2, [0, 1, 0],
      (px, py, pz) => [px / TILE, -pz / TILE],
      (px, py, pz) => { const a = floorAO(px, pz); return [tc[0] * a, tc[1] * a, tc[2] * a]; });
    // bridge planks
    if (t === T.BRIDGE) {
      const walkable = n => n === T.BRIDGE || (!isSolid(n) && n !== T.CHASM && n !== T.HIDDEN);
      const along = walkable(at(x - 1, z)) || walkable(at(x + 1, z));   // the bridge runs east-west
      batch.world();
      if (along) for (let k = 0; k < 5; k++) batch.box('plank', x0 + 0.2 + k * 0.4, -0.12, z0 + TILE / 2, 0.36, 0.12, 1.9, tint(0x9a7046, 0.85 + hash2(x + k, z, 3) * 0.3));
      else for (let k = 0; k < 5; k++) batch.box('plank', x0 + TILE / 2, -0.12, z0 + 0.2 + k * 0.4, 1.9, 0.12, 0.36, tint(0x9a7046, 0.85 + hash2(x, z + k, 3) * 0.3));
      // rope rails on the open sides
      for (const [dx, dz] of DIRV) {
        const n = at(x + dx, z + dz);
        if (n !== T.CHASM && n !== T.HIDDEN) continue;
        const ex = x0 + TILE / 2 + dx * 0.95, ez = z0 + TILE / 2 + dz * 0.95;
        batch.box('plank', ex, -0.1, ez, dx ? 0.1 : 2, 0.08, dz ? 0.1 : 2, tint(0x6d4a2a), {skip: 'bottom'});
        batch.box('plain', ex, 0.9, ez, dx ? 0.05 : 2, 0.05, dz ? 0.05 : 2, tint(0xb79b6b));
        batch.box('plank', ex - (dz ? 0.95 : 0), -0.1, ez - (dx ? 0.95 : 0), 0.1, 1.05, 0.1, tint(0x5d3e22));
      }
    }
    // water surface (its own transparent material, the texture drifts in render.js)
    if (t === T.WATER) batch.grid('water', [x0, -0.16, z0 + TILE], [TILE, 0, 0], [0, 0, -TILE], 2, 2, [0, 1, 0], (px, py, pz) => [px / 4, -pz / 4], tint(zn.tint.water ?? 0x6aa8c8));
    // ceiling
    batch.grid(zn.ceil, [x0, c, z0], [TILE, 0, 0], [0, 0, TILE], 2, 2, [0, -1, 0],
      (px, py, pz) => [px / TILE, pz / TILE],
      (px, py, pz) => { const a = floorAO(px, pz) * 0.9; const k = tint(zn.tint.ceil, vary); return [k[0] * a, k[1] * a, k[2] * a]; });
    // edges: walls, cliffs, steps and lintels
    for (const [dx, dz] of DIRV) {
      const n = at(x + dx, z + dz), nOpen = !isSolid(n);
      // edge geometry: the shared edge runs along a, the face looks into this tile (normal = -d)
      const ex = dx === 1 ? x0 + TILE : x0, ez = dz === 1 ? z0 + TILE : z0;
      let o, du;
      if (dx !== 0) { o = [ex, 0, dx === 1 ? z0 : z0 + TILE]; du = [0, 0, dx === 1 ? TILE : -TILE]; }
      else { o = [dz === 1 ? x0 + TILE : x0, 0, ez]; du = [dz === 1 ? -TILE : TILE, 0, 0]; }
      const normal = [-dx, 0, -dz];
      const face = (key2, y0, y1, colFn) => {
        if (y1 - y0 < 0.01) return;
        const nv = Math.max(1, Math.ceil((y1 - y0) / 1.1));
        batch.grid(key2, [o[0], y0, o[2]], du, [0, y1 - y0, 0], 2, nv, normal,
          (px, py, pz) => [(dx !== 0 ? (dx === 1 ? pz : -pz) : (dz === 1 ? -px : px)) / TILE, py / TILE], colFn);
      };
      const wallTint = tint(zn.tint.wall, 0.88 + hash2(x * 3 + dx, z * 3 + dz, 11) * 0.24);
      const moss = zn.moss || 0, mossC = linear(0x56703a);
      if (!nOpen) {
        const y0 = sy;
        face(zn.wall, y0, c, (px, py) => {
          const a = lerp(0.6, 1, smooth(y0, y0 + 1.5, py)) * lerp(1, 0.82, smooth(c - 1.2, c, py));
          const m = moss * (1 - smooth(0, 1.6, py - Math.max(0, y0)));
          return [lerp(wallTint[0], mossC[0], m) * a, lerp(wallTint[1], mossC[1], m) * a, lerp(wallTint[2], mossC[2], m) * a];
        });
      } else {
        const nsy = surfaceY(n), nc = L.ceilY[(z + dz) * W + (x + dx)];
        if (nsy > sy + 0.01) {
          const cliff = sy <= CHASM_Y + 0.1, ck = cliff ? (zn.cliff || zn.wall) : (t === T.WATER ? zn.floor : zn.wall);
          const ctint = cliff ? tint(zn.tint.wall, 0.55) : wallTint;
          face(ck, sy, nsy, (px, py) => { const a = cliff ? lerp(0.05, 1, smooth(sy, nsy, py)) : 0.8; return [ctint[0] * a, ctint[1] * a, ctint[2] * a]; });
        }
        if (nc < c - 0.01) face(zn.wall, nc, c, () => [wallTint[0] * 0.85, wallTint[1] * 0.85, wallTint[2] * 0.85]);
      }
    }
  }

  // ---------- torches ----------
  const torchAt = new Set();
  const addTorch = (x, z, dx, dz, zn) => {
    const key = `${x},${z}`;
    if (torchAt.has(key)) return;
    torchAt.add(key);
    const c = L.ceilY[z * W + x];
    // (wx, wz) is the wall surface; the torch stands 0.2 m out from it
    const wx = x * TILE + TILE / 2 + dx * TILE / 2, wz = z * TILE + TILE / 2 + dz * TILE / 2;
    const px = wx - dx * 0.2, pz = wz - dz * 0.2, py = Math.min(2.3, c - 0.7);
    const yaw = Math.atan2(-dx, -dz);   // local -z points at the wall
    batch.frame(px, py, pz, yaw);
    batch.box('plain', 0, -0.42, -0.16, 0.2, 0.22, 0.06, tint(0x2a2420));
    batch.box('plain', 0, -0.36, -0.08, 0.05, 0.05, 0.16, tint(0x2a2420));
    batch.box('plank', 0, -0.45, 0, 0.08, 0.47, 0.08, tint(0x5a3a20));
    batch.box('plain', 0, 0.0, 0, 0.15, 0.09, 0.15, tint(0x3a3028));
    batch.world();
    const color = zn.torch ?? 0xffa860;
    lights.push({x: px - dx * 0.3, y: py + 0.3, z: pz - dz * 0.3, color: linear(color), hex: color, i: zn.torchI ?? 1, range: zn.torchR ?? 9, kind: 'torch'});
    flames.push({x: px, y: py + 0.2, z: pz, color, s: 1});
  };
  for (const {x, z} of L.torches) {
    // a 't' is a wall tile: mount it facing the first open neighbour
    for (const [dx, dz] of DIRV) {
      const n = at(x + dx, z + dz);
      if (!isSolid(n) && n !== T.CHASM) { addTorch(x + dx, z + dz, -dx, -dz, L.zoneAt(x + dx, z + dz)); break; }
    }
  }
  // automatic torches along the walls of lit zones
  const doorNear = (x, z) => { for (let ddz = -1; ddz <= 1; ddz++) for (let ddx = -1; ddx <= 1; ddx++) { const n = at(x + ddx, z + ddz); if (n === T.DOOR || n === T.GATE) return true; } return false; };
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const t = at(x, z);
    if (isSolid(t) || t === T.CHASM || t === T.HIDDEN || t === T.WATER || t === T.BRIDGE || t === T.DOOR || t === T.GATE) continue;
    const zn = L.zoneAt(x, z), every = zn.torchEvery ?? 4;
    if (!every) continue;
    for (const [dx, dz] of DIRV) {
      if (!isSolid(at(x + dx, z + dz))) continue;
      if ((x * 3 + z * 5 + (dx + 2) * 7 + (dz + 2) * 11) % every !== 0) continue;
      if (hash2(x, z, dx * 3 + dz) > 0.75 || doorNear(x, z)) continue;
      let near = false;
      for (const k of torchAt) { const [tx, tz] = k.split(',').map(Number); if (Math.abs(tx - x) + Math.abs(tz - z) < Math.max(2, every - 1)) { near = true; break; } }
      if (!near) addTorch(x, z, dx, dz, zn);
    }
  }

  // ---------- props ----------
  const placeProp = (kind, x, z, extra = {}) => {
    const zn = L.zoneAt(x, z);
    const res = buildProp(batch, kind, x, z, {rng, at, zone: zn, tint, ceil: L.ceilY[z * W + x], ...extra});
    if (res?.collider) colliders.push({...res.collider, prop: kind});
    if (res?.lights) for (const l of res.lights) lights.push(l);
    if (res?.flames) for (const f of res.flames) flames.push(f);
    return res;
  };
  for (const p of L.props) placeProp(p.kind, p.x, p.z);
  for (const e of L.entities) if (e.type === 'prop') placeProp(e.kind, e.x, e.z, {yaw: e.dir ? FACING[e.dir] : e.yaw, color: e.color, w: e.w});
  // pillars
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (at(x, z) === T.PILLAR) {
    const zn = L.zoneAt(x, z), cx = x * TILE + 1, cz = z * TILE + 1, c = L.ceilY[z * W + x], pt = tint(zn.tint.pillar ?? zn.tint.wall);
    batch.world();
    batch.box(zn.wall, cx, 0, cz, 1.5, 0.45, 1.5, pt);
    batch.prism(zn.pillar || zn.wall, cx, 0.45, cz, 0.58, 0.52, c - 0.95, 8, (px, py) => { const a = lerp(0.7, 1, smooth(0, 2, py)); return [pt[0] * a, pt[1] * a, pt[2] * a]; }, {rot: Math.PI / 8});
    batch.box(zn.wall, cx, c - 0.5, cz, 1.45, 0.5, 1.45, pt);
    colliders.push({x: cx, z: cz, r: 0.72});
  }
  // light sources declared by entities (static fires, glowing fountains)
  for (const e of L.entities) {
    if (e.type !== 'fire' || e.lit === false) continue;
    const zn = L.zoneAt(e.x, e.z), cx = e.x * TILE + 1, cz = e.z * TILE + 1, color = e.color ?? zn.torch ?? 0xff9a4a;
    const res = buildProp(batch, e.kind || 'brazier', e.x, e.z, {rng, at, zone: zn, tint, color});
    if (res?.collider) colliders.push(res.collider);
    lights.push({x: cx, y: res?.lightY ?? 1.6, z: cz, color: linear(color), hex: color, i: e.i ?? 1.6, range: e.range ?? 11, kind: 'fire'});
    if (res?.flames) for (const f of res.flames) flames.push(f);
    else flames.push({x: cx, y: 1.25, z: cz, color, s: 2.2});
  }
  for (const zn of L.zones) for (const g of zn.glow || []) lights.push({x: g[0] * TILE + 1, y: g[2] ?? 1.5, z: g[1] * TILE + 1, color: linear(g[3] ?? zn.torch ?? 0x88aaff), hex: g[3], i: g[4] ?? 1, range: g[5] ?? 10, kind: 'glow'});

  // ---------- bake ----------
  const vis = lights.map(l => losMask(L, l.x, l.z, l.range));
  const CH = 8, chunks = new Map();
  lights.forEach((l, k) => {
    const cx = Math.floor(l.x / TILE / CH), cz = Math.floor(l.z / TILE / CH);
    const key = cx + ',' + cz; if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(k);
  });
  const nearLights = (px, pz) => {
    const cx = Math.floor(px / TILE / CH), cz = Math.floor(pz / TILE / CH), out = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const a = chunks.get((cx + dx) + ',' + (cz + dz)); if (a) for (const k of a) out.push(k); }
    return out;
  };
  const sampleTile = (px, py, pz, nx, nz) => {
    let tx = Math.floor((px + nx * 0.3) / TILE), tz = Math.floor((pz + nz * 0.3) / TILE);
    if (!isSolid(at(tx, tz))) return tz * W + tx;
    for (const [ox, oz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
      tx = Math.floor((px + ox) / TILE); tz = Math.floor((pz + oz) / TILE);
      if (!isSolid(at(tx, tz))) return tz * W + tx;
    }
    return -1;
  };
  const fillOf = L.zones.map(zn => zn.fill ? linear(zn.fill[0]).map(c => c * zn.fill[1]) : null);
  const baseFill = L.base.fill ? linear(L.base.fill[0]).map(c => c * L.base.fill[1]) : [0, 0, 0];
  const out = [0, 0, 0];
  const bakeFn = (px, py, pz, nx, ny, nz) => {
    out[0] = out[1] = out[2] = 0;
    const ti = sampleTile(px, py, pz, nx, nz);
    if (ti < 0) return out;
    const zk = L.zoneOf[ti], f = zk >= 0 ? fillOf[zk] || baseFill : baseFill;
    const deep = py < -1 ? smooth(CHASM_Y, -1, py) : 1;
    out[0] = f[0] * deep; out[1] = f[1] * deep; out[2] = f[2] * deep;
    for (const k of nearLights(px, pz)) {
      if (!vis[k][ti]) continue;
      const l = lights[k], lx = l.x - px, ly = l.y - py, lz = l.z - pz, d = Math.hypot(lx, ly, lz);
      if (d > l.range) continue;
      const ndl = Math.max(0, (lx * nx + ly * ny + lz * nz) / (d || 1)) * 0.85 + 0.15;
      const win = Math.pow(1 - Math.pow(d / l.range, 2), 2);
      const a = (l.i * win * ndl) / (1 + (d * d) / 4) * deep;
      out[0] += l.color[0] * a; out[1] += l.color[1] * a; out[2] += l.color[2] * a;
    }
    return out;
  };
  const meshes = batch.build(materials, bakeFn);

  // probe grid: baked light at chest height for dynamic objects
  const probe = new Float32Array(W * H * 3);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (isSolid(at(x, z))) continue;
    const v = bakeFn(x * TILE + 1, 1.2, z * TILE + 1, 0, 0, 0);
    const i = (z * W + x) * 3;
    // a normal-less sample: lights count at roughly half strength, plus the fill
    probe[i] = v[0] * 0.75; probe[i + 1] = v[1] * 0.75; probe[i + 2] = v[2] * 0.75;
  }
  const probeAt = (px, pz, target) => {
    const fx = px / TILE - 0.5, fz = pz / TILE - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), ax = fx - x0, az = fz - z0;
    let r = 0, g = 0, b = 0, wsum = 0;
    for (const [dx, dz, w] of [[0, 0, (1 - ax) * (1 - az)], [1, 0, ax * (1 - az)], [0, 1, (1 - ax) * az], [1, 1, ax * az]]) {
      const x = x0 + dx, z = z0 + dz;
      if (isSolid(at(x, z))) continue;
      const i = (z * W + x) * 3;
      r += probe[i] * w; g += probe[i + 1] * w; b += probe[i + 2] * w; wsum += w;
    }
    if (wsum > 0) { r /= wsum; g /= wsum; b /= wsum; }
    target.set(r, g, b);
    return target;
  };
  return {meshes, lights, flames, colliders, probeAt, bakeFn};
}

// Which tiles a light at (lx, lz) can see, by marching a ray to every tile centre in range.
function losMask(L, lx, lz, range) {
  const {W, H, tiles} = L, mask = new Uint8Array(W * H);
  const tx0 = Math.floor(lx / TILE), tz0 = Math.floor(lz / TILE), R = Math.ceil(range / TILE) + 1;
  for (let tz = Math.max(0, tz0 - R); tz <= Math.min(H - 1, tz0 + R); tz++) for (let tx = Math.max(0, tx0 - R); tx <= Math.min(W - 1, tx0 + R); tx++) {
    if (tiles[tz * W + tx] === T.SOLID) continue;
    const ex = tx * TILE + 1, ez = tz * TILE + 1, d = Math.hypot(ex - lx, ez - lz);
    if (d > range + TILE) continue;
    const steps = Math.ceil(d / 0.5);
    let ok = true;
    for (let s = 1; s < steps; s++) {
      const px = lx + (ex - lx) * (s / steps), pz = lz + (ez - lz) * (s / steps);
      const t = tiles[Math.floor(pz / TILE) * W + Math.floor(px / TILE)];
      if (t === T.SOLID) { ok = false; break; }
    }
    if (ok) mask[tz * W + tx] = 1;
  }
  return mask;
}
