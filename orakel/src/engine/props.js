// Static props, built straight into the floor's Batch. Each builder works in a local
// frame centred on its tile; wall-huggers turn so local -z faces the nearest wall.
// A builder may return {collider, lights, flames, lightY}.
import {TILE, linear, hash2} from '../core/util.js';
import {T} from './level.js';

const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const wallYaw = (at, x, z, rng) => {
  const walls = DIRV.filter(([dx, dz]) => at(x + dx, z + dz) === T.SOLID);
  if (!walls.length) return null;
  const [dx, dz] = walls[Math.floor(rng() * walls.length)];
  return Math.atan2(-dx, -dz);
};
// world position of the local point (0, 0, lz) in a frame turned by yaw
const off = (cx, cz, yaw, lz) => [cx + Math.sin(yaw) * lz, cz + Math.cos(yaw) * lz];
// a box collider for a w x d footprint turned by yaw (multiples of 90 degrees)
const boxCol = (cx, cz, w, d, yaw) => {
  const q = Math.round(((yaw || 0) / (Math.PI / 2)) % 2 + 2) % 2;
  return q ? {x: cx, z: cz, hw: d / 2, hd: w / 2} : {x: cx, z: cz, hw: w / 2, hd: d / 2};
};

export const PROPS = {
  barrel(b, o) {
    const {cx, cz, rng, tint} = o, x = cx + (rng() - 0.5) * 0.5, z = cz + (rng() - 0.5) * 0.5;
    b.world();
    b.prism('plank', x, 0, z, 0.4, 0.4, 1.0, 10, tint(0xb08458, 0.9 + rng() * 0.2), {rot: rng()});
    for (const y of [0.18, 0.78]) b.prism('metal', x, y, z, 0.415, 0.415, 0.07, 10, tint(0x4a4440), {caps: false});
    return {collider: {x, z, r: 0.46}};
  },
  crate(b, o) {
    const {cx, cz, rng, tint} = o, x = cx + (rng() - 0.5) * 0.4, z = cz + (rng() - 0.5) * 0.4;
    b.frame(x, 0, z, rng() * 0.5 - 0.25);
    b.box('plank', 0, 0, 0, 0.95, 0.95, 0.95, tint(0xa47a4c, 0.85 + rng() * 0.25));
    if (rng() < 0.4) b.box('plank', 0.05, 0.95, -0.05, 0.7, 0.7, 0.7, tint(0xa47a4c, 0.8 + rng() * 0.2));
    b.world();
    return {collider: {x, z, r: 0.62}};
  },
  bookcase(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    const wood = tint(0x6e4a2c), h = Math.min(2.8, (o.ceil ?? 4) - 0.4);
    b.box('plank', 0, 0, -0.62, 1.9, h, 0.7, wood, {skip: 'front'});
    b.grid('shelf', [-0.92, 0.05, -0.27], [1.84, 0, 0], [0, h - 0.15, 0], 2, 3, [0, 0, 1], (px, py, pz, a, bb) => [a * 2, bb * (h - 0.15) / 2], tint(0xffffff, 0.92));
    b.box('plank', 0, h - 0.1, -0.6, 2.0, 0.14, 0.78, wood);
    b.world();
    return {collider: boxCol(...off(cx, cz, yaw, -0.62), 2.0, 0.8, yaw)};
  },
  table(b, o) {
    const {cx, cz, rng, tint} = o, yaw = o.yaw ?? (rng() < 0.5 ? 0 : Math.PI / 2);
    b.frame(cx, 0, cz, yaw);
    const wood = tint(0x8a5e38, 0.9 + rng() * 0.2);
    b.box('plank', 0, 0.74, 0, 1.7, 0.08, 1.0, wood);
    for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) b.box('plank', lx, 0, lz, 0.09, 0.74, 0.09, wood);
    if (rng() < 0.6) b.box('paper', (rng() - 0.5) * 0.8, 0.82, (rng() - 0.5) * 0.4, 0.42, 0.06, 0.3, tint(0xf0e6d0));
    if (rng() < 0.5) { b.prism('plain', 0.5, 0.82, 0.2, 0.05, 0.05, 0.16, 6, tint(0xf2e8c8)); }
    b.world();
    return {collider: boxCol(cx, cz, 1.8, 1.1, yaw)};
  },
  chair(b, o) {
    const {cx, cz, rng, tint} = o, x = cx + (rng() - 0.5) * 0.6, z = cz + (rng() - 0.5) * 0.6;
    b.frame(x, 0, z, rng() * Math.PI * 2);
    const wood = tint(0x7a5232);
    b.box('plank', 0, 0.44, 0, 0.5, 0.06, 0.5, wood);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box('plank', lx, 0, lz, 0.06, 0.44, 0.06, wood);
    b.box('plank', 0, 0.5, -0.22, 0.5, 0.55, 0.06, wood);
    b.world();
    return {collider: {x, z, r: 0.32}};
  },
  cabinet(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    const c = tint(0x7d8a8c, 0.85 + rng() * 0.2);
    for (const k of [-0.48, 0.48]) {
      b.box('metal', k, 0, -0.62, 0.92, 1.9, 0.7, c);
      for (let d = 0; d < 4; d++) b.box('plain', k, 0.25 + d * 0.44, -0.26, 0.5, 0.06, 0.04, tint(0xd8c890));
    }
    b.world();
    return {collider: boxCol(...off(cx, cz, yaw, -0.62), 2.0, 0.8, yaw)};
  },
  plant(b, o) {
    const {cx, cz, rng, tint} = o, x = cx + (rng() - 0.5) * 0.6, z = cz + (rng() - 0.5) * 0.6;
    b.world();
    b.prism('plain', x, 0, z, 0.26, 0.32, 0.5, 8, tint(0xa4583a));
    for (let k = 0; k < 7; k++) {
      const a = rng() * Math.PI * 2, r = 0.1 + rng() * 0.22;
      b.frame(x + Math.cos(a) * r, 0.5, z + Math.sin(a) * r, a);
      b.box('plain', 0, 0, 0, 0.18, 0.6 + rng() * 0.6, 0.06, tint(0x4f7a3a, 0.8 + rng() * 0.4));
    }
    b.world();
    return {collider: {x, z, r: 0.36}};
  },
  urn(b, o) {
    const {cx, cz, rng, tint} = o, x = cx + (rng() - 0.5) * 0.5, z = cz + (rng() - 0.5) * 0.5, c = tint(0xb88a5e, 0.8 + rng() * 0.3);
    b.world();
    b.prism('plain', x, 0, z, 0.2, 0.36, 0.45, 8, c);
    b.prism('plain', x, 0.45, z, 0.36, 0.16, 0.4, 8, c);
    b.prism('plain', x, 0.85, z, 0.16, 0.2, 0.12, 8, c);
    return {collider: {x, z, r: 0.38}};
  },
  rubble(b, o) {
    const {cx, cz, rng, tint, zone} = o;
    for (let k = 0; k < 6; k++) {
      b.frame(cx + (rng() - 0.5) * 1.4, 0, cz + (rng() - 0.5) * 1.4, rng() * 3);
      const s = 0.2 + rng() * 0.35;
      b.box(zone.wall, 0, 0, 0, s, s * 0.7, s * 1.2, tint(zone.tint.wall, 0.6 + rng() * 0.3));
    }
    b.world();
    return {collider: {x: cx, z: cz, r: 0.5}};
  },
  papers(b, o) {
    const {cx, cz, rng, tint} = o;
    for (let k = 0; k < 3; k++) {
      const x = cx + (rng() - 0.5) * 1.1, z = cz + (rng() - 0.5) * 1.1, n = 2 + Math.floor(rng() * 5);
      for (let j = 0; j < n; j++) { b.frame(x, j * 0.12, z, rng() * 0.6); b.box('paper', 0, 0, 0, 0.42, 0.12, 0.32, tint(0xece2c8, 0.85 + rng() * 0.15)); }
    }
    b.world();
    return {collider: {x: cx, z: cz, r: 0.55}};
  },
  bench(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    const wood = tint(0x7f5634);
    b.box('plank', 0, 0.42, -0.3, 1.8, 0.07, 0.45, wood);
    for (const lx of [-0.8, 0.8]) b.box('plank', lx, 0, -0.3, 0.08, 0.42, 0.4, wood);
    b.box('plank', 0, 0.5, -0.52, 1.8, 0.5, 0.06, wood);
    b.world();
    return {collider: boxCol(...off(cx, cz, yaw, -0.3), 1.9, 0.6, yaw)};
  },
  machine(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    b.box('metal', 0, 0, -0.4, 1.6, 2.1, 1.0, tint(0x6a6f78));
    b.box('circuit', 0, 0.6, 0.11, 1.1, 1.1, 0.02, tint(0xffffff));
    for (const px of [-0.6, 0.6]) b.prism('metal', px, 2.1, -0.4, 0.12, 0.12, (o.ceil ?? 4) - 2.1, 6, tint(0x8a7a5a), {caps: false});
    b.world();
    const [lx, lz] = off(cx, cz, yaw, 0.4);
    return {collider: boxCol(...off(cx, cz, yaw, -0.4), 1.7, 1.1, yaw), lights: [{x: lx, y: 1.2, z: lz, color: linear(0xffc870), i: 0.35, range: 4, kind: 'glow'}]};
  },
  candles(b, o) {
    const {cx, cz, rng, tint} = o, flames = [];
    b.world();
    b.prism('plain', cx, 0, cz, 0.3, 0.22, 0.75, 8, tint(0x6a6058));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rng(), x = cx + Math.cos(a) * 0.12, z = cz + Math.sin(a) * 0.12, h = 0.16 + rng() * 0.14;
      b.prism('plain', x, 0.75, z, 0.04, 0.04, h, 6, tint(0xf1e8cf));
      flames.push({x, y: 0.75 + h + 0.06, z, color: 0xffd08a, s: 0.35});
    }
    return {collider: {x: cx, z: cz, r: 0.34}, flames, lights: [{x: cx, y: 1.1, z: cz, color: linear(0xffc070), i: 0.5, range: 5, kind: 'glow'}]};
  },
  brazier(b, o) {
    const {cx, cz, tint, color} = o;
    b.world();
    b.prism('metal', cx, 0, cz, 0.36, 0.14, 0.2, 8, tint(0x3c3632));
    b.prism('metal', cx, 0.2, cz, 0.1, 0.1, 0.7, 6, tint(0x3c3632));
    b.prism('metal', cx, 0.9, cz, 0.18, 0.5, 0.25, 10, tint(0x4a403a));
    b.prism('plain', cx, 1.05, cz, 0.42, 0.42, 0.04, 10, tint(color ?? 0xff9a4a, 0.4), {caps: true});
    return {collider: {x: cx, z: cz, r: 0.5}, flames: [{x: cx, y: 1.3, z: cz, color: color ?? 0xff9a4a, s: 2.0}], lightY: 1.6};
  },
  // ---- larger set pieces used through the legend ----
  statue(b, o) {
    const {cx, cz, tint, zone} = o, yaw = o.yaw ?? 0, c = tint(zone.tint.pillar ?? zone.tint.wall, 0.95);
    b.frame(cx, 0, cz, yaw);
    b.box(zone.wall, 0, 0, 0, 1.4, 0.8, 1.4, c);
    b.box('plain', 0, 0.8, 0, 0.62, 1.1, 0.42, c);
    b.box('plain', 0, 1.9, 0, 0.8, 0.9, 0.5, c);
    b.box('plain', 0, 2.8, 0, 0.42, 0.46, 0.42, c);
    b.box('plain', -0.5, 2.0, 0.05, 0.2, 0.8, 0.2, c);
    b.box('plain', 0.5, 2.0, 0.05, 0.2, 0.8, 0.2, c);
    b.world();
    return {collider: {x: cx, z: cz, r: 0.85}};
  },
  fountain(b, o) {
    const {cx, cz, tint, zone} = o, c = tint(zone.tint.pillar ?? zone.tint.wall);
    b.world();
    b.prism(zone.wall, cx, 0, cz, 1.7, 1.7, 0.55, 12, c);
    b.prism('plain', cx, 0.5, cz, 1.5, 1.5, 0.02, 12, tint(0x2a5a7a, 0.7));
    b.prism(zone.wall, cx, 0.55, cz, 0.25, 0.2, 1.2, 8, c);
    b.prism(zone.wall, cx, 1.75, cz, 0.7, 0.75, 0.2, 10, c);
    return {collider: {x: cx, z: cz, r: 1.75}, lights: [{x: cx, y: 1.2, z: cz, color: linear(0x8fc8ff), i: 1.1, range: 9, kind: 'glow'}]};
  },
  lectern(b, o) {
    const {cx, cz, tint} = o, yaw = o.yaw ?? 0;
    b.frame(cx, 0, cz, yaw);
    b.box('plank', 0, 0, 0, 0.5, 0.95, 0.4, tint(0x6e4a2c));
    b.box('plank', 0, 0.95, 0.05, 0.75, 0.08, 0.55, tint(0x7e5634));
    b.box('paper', 0, 1.03, 0.05, 0.6, 0.03, 0.42, tint(0xf4ead2));
    b.world();
    return {collider: {x: cx, z: cz, r: 0.45}};
  },
  counter(b, o) {
    const {cx, cz, tint, rng} = o, yaw = o.yaw ?? 0, w = o.w ?? 1.95;
    b.frame(cx, 0, cz, yaw);
    b.box('panel', 0, 0, 0, w, 1.05, 0.7, tint(0x9a6a42));
    b.box('plank', 0, 1.05, 0, w + 0.1, 0.07, 0.82, tint(0xc8a070));
    if (rng() < 0.7) b.box('plain', (rng() - 0.5) * 1, 1.12, 0.1, 0.35, 0.28, 0.04, tint(0x303840));
    b.world();
    return {collider: boxCol(cx, cz, w + 0.1, 0.9, yaw)};
  },
  server(b, o) {
    const {cx, cz, tint} = o, yaw = o.yaw ?? 0, h = Math.min(3.4, (o.ceil ?? 5) - 0.4);
    b.frame(cx, 0, cz, yaw);
    b.box('circuit', 0, 0, 0, 1.0, h, 1.0, tint(0xffffff, 0.9));
    b.box('metal', 0, h, 0, 1.1, 0.12, 1.1, tint(0x3a3a44));
    b.world();
    return {collider: {x: cx, z: cz, r: 0.7}, lights: [{x: cx, y: 1.6, z: cz, color: linear(0xffd27a), i: 0.5, range: 5, kind: 'glow'}]};
  },
  pipes(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    for (const px of [-0.6, 0, 0.6]) b.prism('metal', px, 0, -0.8, 0.14, 0.14, (o.ceil ?? 4), 8, tint(0x9a7a4a, 0.8 + rng() * 0.3), {caps: false});
    b.box('metal', 0, 1.2, -0.8, 1.6, 0.2, 0.3, tint(0x6a5a3a));
    b.world();
    return {collider: boxCol(...off(cx, cz, yaw, -0.8), 1.8, 0.5, yaw)};
  },
  banner(b, o) {
    const {cx, cz, rng, tint, at, x, z} = o, yaw = o.yaw ?? wallYaw(at, x, z, rng) ?? 0;
    b.frame(cx, 0, cz, yaw);
    b.box('plain', 0, 1.0, -0.96, 1.1, 2.2, 0.04, tint(o.color ?? 0x8f3a30));
    b.box('plank', 0, 3.2, -0.94, 1.3, 0.08, 0.08, tint(0x5a3a20));
    b.box('gold', 0, 2.1, -0.93, 0.5, 0.5, 0.02, tint(0xffffff));
    b.world();
    return null;
  },
  pedestal(b, o) {
    const {cx, cz, tint, zone} = o;
    b.world();
    b.prism(zone.wall, cx, 0, cz, 0.55, 0.45, 0.9, 8, tint(zone.tint.pillar ?? zone.tint.wall));
    b.prism(zone.wall, cx, 0.9, cz, 0.6, 0.6, 0.1, 8, tint(zone.tint.pillar ?? zone.tint.wall, 1.1));
    return {collider: {x: cx, z: cz, r: 0.6}};
  },
  well(b, o) {
    const {cx, cz, tint} = o;
    b.world();
    b.prism('brick', cx, 0, cz, 1.0, 1.0, 0.8, 10, tint(0x8a7a6a));
    b.prism('plain', cx, 0.78, cz, 0.85, 0.85, 0.02, 10, tint(0x0a0a10));
    return {collider: {x: cx, z: cz, r: 1.05}};
  },
};

export function buildProp(b, kind, x, z, opts) {
  const fn = PROPS[kind];
  if (!fn) return null;
  const cx = x * TILE + TILE / 2, cz = z * TILE + TILE / 2;
  const rng = () => hash2(x * 31 + (opts.k = (opts.k || 0) + 1), z * 17, kind.length);
  return fn(b, {...opts, x, z, cx, cz, rng, ceil: opts.ceil});
}
