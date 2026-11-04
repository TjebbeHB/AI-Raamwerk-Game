// People and creatures. People are detailed voxel figures built from the look schema
// (content/looks.js): every moving part (hips, torso, head, brows, eyelids, mouth, upper and
// lower arms and legs) is ONE merged mesh with vertex colours, so a whole person costs about
// fifteen draw calls. Every model gets one probe uniform: the baked light where it stands, so
// it sits in the same light as the walls. Models face +z; a person's own left is +x.
// animate(dt, st) poses them: st = {t, walk (0..1), run, talk, attack (0..1), hurt (0..1), wave,
// armL, armR (extra upper-arm swing), look (head yaw), mood (a mood id), idle (false: no gestures)}.
import * as THREE from 'three';
import {probedMaterial} from './batch.js';
import {R} from './render.js';
import {normalizeLook, lookKey} from '../content/looks.js';

const geoCache = new Map();
function boxGeo(w, h, d, anchor = 'c') {
  const key = `${w}|${h}|${d}|${anchor}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    if (anchor === 'top') g.translate(0, -h / 2, 0);
    else if (anchor === 'bottom') g.translate(0, h / 2, 0);
    geoCache.set(key, g);
  }
  return g;
}
const SPHERE = new THREE.IcosahedronGeometry(1, 2), SPHERE_LO = new THREE.IcosahedronGeometry(1, 1), CONE = new THREE.ConeGeometry(1, 1, 8), CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

class Kit {
  constructor(probe) { this.probe = probe || {value: new THREE.Color(0.3, 0.26, 0.22)}; this.mats = new Map(); this.list = []; }
  mat(hex, o = {}) {
    const key = hex + JSON.stringify(o);
    let m = this.mats.get(key);
    if (!m) {
      m = o.basic ? new THREE.MeshBasicMaterial({color: hex, transparent: !!o.opacity, opacity: o.opacity ?? 1, toneMapped: o.toneMapped ?? true, depthWrite: o.depthWrite ?? true, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending})
        : probedMaterial({color: hex, flatShading: true, emissive: o.em ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.opacity, opacity: o.opacity ?? 1, map: o.map ?? null}, this.probe);
      this.mats.set(key, m); this.list.push(m);
    }
    return m;
  }
  // the one material of a voxel figure: vertex colours, baked light from the probe, glowing voxels
  vmat() {
    if (!this._v) { this._v = probedMaterial({vertexColors: true, flatShading: true}, this.probe, {glow: true}); this.list.push(this._v); }
    return this._v;
  }
  // unlit vertex colours, for creatures made of light
  vbasic() {
    if (!this._b) { this._b = new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false}); this.list.push(this._b); }
    return this._b;
  }
  box(parent, w, h, d, hex, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, o.anchor), this.mat(hex, o));
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    parent.add(m); return m;
  }
  sphere(parent, r, hex, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(o.lo ? SPHERE_LO : SPHERE, this.mat(hex, o));
    m.scale.set(r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1)); m.position.set(x, y, z);
    parent.add(m); return m;
  }
  cone(parent, r, h, hex, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(CONE, this.mat(hex, o));
    m.scale.set(r, h, r); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    parent.add(m); return m;
  }
  cyl(parent, r, h, hex, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(CYL, this.mat(hex, o));
    m.scale.set(r, h, r); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    parent.add(m); return m;
  }
  pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  // a mesh from a merged voxel geometry (shared, cached), in this kit's material
  vox(parent, geo, x = 0, y = 0, z = 0, mat = this.vmat()) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
  }
}
export {Kit};

export function glowSprite(hex, size = 1, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: R.glow, color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false}));
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- colours (sRGB hex in, linear out)
const LIN = new Map();
function lin(hex) { let c = LIN.get(hex); if (!c) { const t = new THREE.Color(hex); c = [t.r, t.g, t.b]; LIN.set(hex, c); } return c; }
const ch = (h, s) => (h >> s) & 255;
export const mixHex = (a, b, t) => (Math.round(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t) << 16) | (Math.round(ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t) << 8) | Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t);
export const shadeHex = (a, f) => { const c = v => Math.max(0, Math.min(255, Math.round(v * f))); return (c(ch(a, 16)) << 16) | (c(ch(a, 8)) << 8) | c(ch(a, 0)); };
const lum = h => (0.299 * ch(h, 16) + 0.587 * ch(h, 8) + 0.114 * ch(h, 0)) / 255;
function hash3(x, y, z) {
  let h = Math.imul(Math.round(x * 997) | 0, 73856093) ^ Math.imul(Math.round(y * 991) | 0, 19349663) ^ Math.imul(Math.round(z * 983) | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- the voxel builder
// Boxes (optionally rotated, optionally in a local frame) merged into one indexed geometry
// with per-vertex colour and glow. Faces are flat, so it reads as voxels in any light.
const FACES = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]], [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
class Vox {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.glw = []; this.idx = []; this.n = 0; this.F = null; }
  // everything added after frame() is mirrored (sx = -1), rotated and moved: a local frame for props
  frame(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1) { this.F = {x, y, z, sx, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))}; return this; }
  noframe() { this.F = null; return this; }
  // a box by centre and size; o = {glow, jit (brightness jitter), rx, ry, rz (about the centre)}
  box(cx, cy, cz, w, h, d, hex, o) {
    const c = lin(hex), gl = o?.glow ?? 0, jit = o?.jit ?? 0;
    let r = c[0], g = c[1], b = c[2];
    if (jit) { const f = 1 + (hash3(cx, cy, cz) - 0.5) * jit; r *= f; g *= f; b *= f; }
    const rot = !!(o && (o.rx || o.ry || o.rz));
    if (rot) _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
    const F = this.F, mir = !!F && F.sx < 0, hw = w / 2, hh = h / 2, hd = d / 2;
    const skip = o?.skip ?? 0;
    for (let f = 0; f < 6; f++) {
      if (skip & (1 << f)) continue;
      const nn = FACES[f][0], cs = FACES[f][1], base = this.n;
      _n.set(nn[0], nn[1], nn[2]);
      if (rot) _n.applyQuaternion(_q);
      if (F) { _n.x *= F.sx; _n.applyQuaternion(F.q); }
      for (let i = 0; i < 4; i++) {
        const k = cs[i];
        _v.set(k[0] * hw, k[1] * hh, k[2] * hd);
        if (rot) _v.applyQuaternion(_q);
        _v.x += cx; _v.y += cy; _v.z += cz;
        if (F) { _v.x *= F.sx; _v.applyQuaternion(F.q); _v.x += F.x; _v.y += F.y; _v.z += F.z; }
        this.pos.push(_v.x, _v.y, _v.z); this.nor.push(_n.x, _n.y, _n.z); this.col.push(r, g, b); this.glw.push(gl);
      }
      this.n += 4;
      if (mir) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }
  // a box by two corners
  span(x0, y0, z0, x1, y1, z1, hex, o) { return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), hex, o); }
  // a lumpy voxel ellipsoid (curls, buns, clouds); keep(x, y, z) can cut cells away; hidden inner cells are skipped
  blob(cx, cy, cz, rx, ry, rz, cell, hex, o = {}) {
    const keep = o.keep, inside = (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1 && (!keep || keep(x, y, z));
    const nx = Math.ceil(rx / cell), ny = Math.ceil(ry / cell), nz = Math.ceil(rz / cell);
    for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) for (let k = -nz; k <= nz; k++) {
      const x = cx + i * cell, y = cy + j * cell, z = cz + k * cell;
      if (!inside(x, y, z)) continue;
      const skip = (inside(x + cell, y, z) ? 1 : 0) | (inside(x - cell, y, z) ? 2 : 0) | (inside(x, y + cell, z) ? 4 : 0) | (inside(x, y - cell, z) ? 8 : 0) | (inside(x, y, z + cell) ? 16 : 0) | (inside(x, y, z - cell) ? 32 : 0);
      if (skip === 63) continue;
      const s = cell * (1 + hash3(x, y, z) * (o.bump ?? 0.25));
      this.box(x, y, z, s, s, s, o.tint ? o.tint(x, y, z) : hex, {jit: o.jit ?? 0.14, glow: o.glow, skip});
    }
    return this;
  }
  get empty() { return this.n === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glw, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
export {Vox};
const vgeo = fn => { const v = new Vox(); fn(v); return v.empty ? null : v.geometry(); };
// ---------------------------------------------------------------- people: proportions and colours
// Sizes in metres for height 1. tw/ww: chest/waist width, td: depth, sw: shoulder span, hw: hips,
// out: how far the arms hang out from the body at rest (round people need room for the belly).
const BUILDS = {
  slim: {tw: 0.37, ww: 0.33, td: 0.22, sw: 0.42, hw: 0.32, arm: 0.105, leg: 0.128, belly: 0, head: 0.35, th: 0.5, neck: 0.1, out: 0.05},
  average: {tw: 0.44, ww: 0.4, td: 0.25, sw: 0.48, hw: 0.37, arm: 0.12, leg: 0.145, belly: 0, head: 0.36, th: 0.5, neck: 0.11, out: 0.07},
  broad: {tw: 0.55, ww: 0.47, td: 0.29, sw: 0.63, hw: 0.43, arm: 0.155, leg: 0.17, belly: 0.02, head: 0.37, th: 0.52, neck: 0.135, out: 0.1},
  round: {tw: 0.49, ww: 0.54, td: 0.31, sw: 0.5, hw: 0.47, arm: 0.135, leg: 0.165, belly: 0.1, head: 0.37, th: 0.48, neck: 0.12, out: 0.22},
};
function humanDims(L, kind) {
  const b = BUILDS[L.build] || BUILDS.average;
  const D = {...b, hipY: 0.86, thigh: 0.41, shin: 0.45, waist: 0.04, ua: 0.28, fa: 0.24, hand: 0.09, headW: b.head, headH: 0.4, headD: 0.36, hb: 0.05};
  // the small folk of the Gewelf: short legs, big heads
  if (kind === 'gnome') Object.assign(D, {hipY: 0.5, thigh: 0.24, shin: 0.26, ua: 0.22, fa: 0.19, th: 0.42, headW: b.head * 1.2, headH: 0.47, headD: 0.42, hb: 0.03});
  if (kind === 'kobold') Object.assign(D, {hipY: 0.6, thigh: 0.29, shin: 0.31, ua: 0.23, fa: 0.2, th: 0.42, headW: b.head * 1.16, headH: 0.45, headD: 0.4, hb: 0.04});
  D.shY = D.th - 0.06; D.armX = D.sw / 2 - D.arm / 2;
  D.legX = Math.max(D.leg / 2 + 0.012, D.hw / 2 - D.leg / 2 - 0.005);
  D.zc = 0.015; D.zf = D.zc + D.headD / 2; D.zb = D.zc - D.headD / 2; D.ht = D.hb + D.headH;
  D.handY = D.hipY + D.waist + D.shY - D.ua - D.fa - D.hand / 2;
  const fx = D.headW / 0.36, fy = D.headH / 0.4, big = (L.age === 'young' ? 1.08 : 1) * (kind === 'kobold' ? 1.3 : kind === 'gnome' ? 1.06 : 1);
  D.f = {fx, fy, ex: 0.083 * fx, ey: D.hb + 0.4625 * D.headH, ew: 0.084 * fx * (kind === 'kobold' ? 1.12 : 1), eh: 0.074 * fy * big,
    browY: D.hb + 0.648 * D.headH, mouthY: D.hb + 0.19 * D.headH, noseY0: D.hb + 0.29 * D.headH, noseY1: D.hb + 0.43 * D.headH, hairline: D.ht - 0.075};
  D.stoop = L.age === 'old' ? 0.1 : 0;
  return D;
}

const EYE_WHITE = 0xf4f0e8, PUPIL = 0x161010, MOUTH_IN = 0x3a1418, TEETH = 0xfbf7ee, GOLD = 0xe8c050;
function colours(L, X) {
  const skin = L.skin, hair = L.hairColor, fh = L.facialHairColor ?? hair, dark = lum(skin) < 0.38;
  const noHair = L.hair === 'bald' || L.hair === 'headscarf' || L.hair === 'buzz';
  const browBase = noHair ? (L.facialHairColor ?? (L.age === 'old' ? 0xa8a8a4 : L.hair === 'buzz' ? hair : 0x4a3424)) : hair;
  const brow = lum(browBase) > 0.72 ? shadeHex(browBase, 0.8) : browBase;
  const topPat = L.pattern === 'plain' ? null : (L.patternColor ?? null);
  return {
    skin, skinD: shadeHex(skin, 0.9), skinDD: shadeHex(skin, 0.76), skinL: mixHex(skin, 0xffffff, 0.1),
    lip: shadeHex(mixHex(skin, 0xa83a40, dark ? 0.3 : 0.5), dark ? 0.72 : 0.78),
    blush: mixHex(skin, 0xff4a5a, dark ? 0.2 : 0.34), freckle: mixHex(skin, dark ? 0x1a0a04 : 0x8a4422, dark ? 0.35 : 0.42), wrinkle: shadeHex(skin, dark ? 0.82 : 0.86),
    nose: X.sunburn ? mixHex(skin, 0xe8503a, 0.5) : L.blush && L.nose === 'big' ? mixHex(skin, 0xe86a5a, 0.22) : mixHex(skin, 0xd07060, 0.07),
    hair, hairD: shadeHex(hair, 0.78), hairL: mixHex(hair, 0xffffff, 0.22), fh, fhD: shadeHex(fh, 0.8), fhL: mixHex(fh, 0xffffff, 0.2),
    brow, lash: mixHex(brow, 0x120a06, 0.68),
    top: L.topColor, top2: L.top2, bottom: L.bottomColor, shoes: L.shoes, pat: topPat,
  };
}
// the colour of a pattern on a fabric: darker on light cloth, lighter on dark cloth
const patOn = (base, C) => C.pat ?? (lum(base) > 0.45 ? shadeHex(base, 0.62) : mixHex(base, 0xffffff, 0.35));

// ---------------------------------------------------------------- the head
// Head space: origin at the top of the torso (the neck joint), the face looks at +z.
function buildHead(v, L, D, C, X, kind) {
  const W = D.headW, H = D.headH, hb = D.hb, ht = D.ht, zc = D.zc, zf = D.zf, zb = D.zb, f = D.f, fx = f.fx;
  v.span(-D.neck / 2, -0.07, zc - D.neck * 0.48, D.neck / 2, hb + 0.04, zc + D.neck * 0.4, C.skinD);   // neck
  const jaw = hb + 0.25 * H;
  v.span(-W / 2, jaw, zb + 0.024, W / 2, ht - 0.02, zf - 0.026, C.skin);                              // skull, soft edges
  v.span(-W / 2 + 0.024, jaw, zb, W / 2 - 0.024, ht, zf, C.skin);
  v.span(-W / 2 + 0.01, jaw, zb + 0.01, W / 2 - 0.01, ht - 0.008, zf - 0.01, C.skin);
  v.span(-W / 2 + 0.022 * fx, hb, zb + 0.035, W / 2 - 0.022 * fx, jaw, zf - 0.022, C.skin);          // jaw
  v.span(-W / 2 + 0.042 * fx, hb, zb + 0.05, W / 2 - 0.042 * fx, jaw, zf, C.skin);
  v.span(-0.05 * fx, hb - 0.006, zf - 0.06, 0.05 * fx, hb + 0.032, zf + 0.004, C.skin);              // chin
  if (L.build === 'round' || kind === 'gnome') for (const s of [-1, 1]) v.span(s * (W / 2 - 0.024 * fx), hb + 0.012, zb + 0.08, s * (W / 2 - 0.001), jaw, zf - 0.02, C.skin);
  // ears
  const earY = hb + 0.45 * H, earH = 0.1 * f.fy;
  for (const s of [-1, 1]) {
    if (X.pointyEars) {
      v.span(s * W / 2, earY - 0.04, zc - 0.03, s * (W / 2 + 0.03), earY + 0.03, zc + 0.03, C.skin);
      v.box(s * (W / 2 + 0.065), earY + 0.03, zc - 0.004, 0.085, 0.04, 0.03, C.skin, {rz: s * 0.45});
      v.box(s * (W / 2 + 0.12), earY + 0.07, zc - 0.008, 0.06, 0.026, 0.022, C.skin, {rz: s * 0.65});
      v.box(s * (W / 2 + 0.06), earY + 0.025, zc + 0.012, 0.06, 0.016, 0.006, C.skinDD, {rz: s * 0.45});
    } else {
      v.span(s * W / 2, earY - earH / 2, zc - 0.035, s * (W / 2 + 0.026), earY + earH / 2, zc + 0.03, C.skin);
      v.span(s * (W / 2 + 0.021), earY - earH / 2 + 0.02, zc - 0.014, s * (W / 2 + 0.03), earY + earH / 2 - 0.02, zc + 0.016, C.skinDD);
    }
    if (L.earrings && L.hair !== 'headscarf') {
      v.box(s * (W / 2 + 0.016), earY - earH / 2 - 0.01, zc + 0.006, 0.013, 0.013, 0.013, GOLD, {glow: 0.45});
      v.box(s * (W / 2 + 0.016), earY - earH / 2 - 0.028, zc + 0.006, 0.02, 0.02, 0.008, GOLD, {glow: 0.45});
    }
  }
  // eyes: white, iris, pupil, a highlight (both lit from the upper left), the lash line on top
  for (const s of [-1, 1]) {
    const x = s * f.ex, ew = f.ew, eh = f.eh, ey = f.ey, iw = ew * 0.6, ih = eh * 0.88, ix = x - s * ew * 0.1;
    v.box(x, ey, zf + 0.001, ew, eh, 0.008, X.glowEyes ? 0xc8dcf4 : EYE_WHITE, {glow: X.glowEyes ? 0.15 : 0.05});
    v.box(ix, ey - eh * 0.03, zf + 0.004, iw, ih, 0.008, L.eyes, {glow: X.glowEyes ? 1 : 0.08});
    v.box(ix, ey - eh * 0.06, zf + 0.007, iw * 0.48, ih * 0.56, 0.008, X.glowEyes ? 0xf4fbff : PUPIL, {glow: X.glowEyes ? 1.2 : 0});
    v.box(ix - iw * 0.24, ey + ih * 0.2, zf + 0.0105, iw * 0.36, iw * 0.36, 0.006, 0xffffff, {glow: X.twinkle ? 1.4 : 0.75});
    if (X.twinkle) v.box(ix + iw * 0.26, ey - ih * 0.25, zf + 0.0105, iw * 0.2, iw * 0.2, 0.006, 0xffffff, {glow: 1.2});
    v.box(x, ey + eh / 2 + 0.004, zf + 0.004, ew + 0.012, 0.012, 0.01, C.lash);
    v.box(x + s * (ew / 2 + 0.002), ey + eh / 2 + 0.0, zf + 0.004, 0.012, 0.01, 0.01, C.lash, {rz: s * -0.5});   // a little flick outward
  }
  // nose
  const n0 = f.noseY0, n1 = f.noseY1, nc = C.nose;
  let nb = n0, nz = zf + 0.03, nw = 0.022;
  if (L.nose === 'small') { v.span(-0.015 * fx, n0 + 0.012, zf - 0.01, 0.015 * fx, n0 + 0.05, zf + 0.014, nc); v.span(-0.021 * fx, n0 + 0.004, zf - 0.01, 0.021 * fx, n0 + 0.03, zf + 0.022, nc); nb = n0 + 0.004; nz = zf + 0.022; nw = 0.018; }
  else if (L.nose === 'big') { v.span(-0.017 * fx, n0 + 0.03, zf - 0.01, 0.017 * fx, n1, zf + 0.022, nc); v.span(-0.035 * fx, n0 - 0.008, zf - 0.01, 0.035 * fx, n0 + 0.046, zf + 0.04, nc, {jit: 0.04}); v.span(-0.023 * fx, n0 - 0.01, zf + 0.02, 0.023 * fx, n0 + 0.036, zf + 0.05, nc); nb = n0 - 0.01; nz = zf + 0.05; nw = 0.03; }
  else if (L.nose === 'long') { v.span(-0.015 * fx, n0 + 0.01, zf - 0.01, 0.015 * fx, n1 + 0.008, zf + 0.028, nc); v.span(-0.019 * fx, n0 - 0.016, zf - 0.01, 0.019 * fx, n0 + 0.026, zf + 0.046, nc); nb = n0 - 0.016; nz = zf + 0.046; nw = 0.017; }
  else { v.span(-0.015 * fx, n0 + 0.02, zf - 0.01, 0.015 * fx, n1 - 0.004, zf + 0.02, nc); v.span(-0.026 * fx, n0, zf - 0.01, 0.026 * fx, n0 + 0.034, zf + 0.034, nc); nz = zf + 0.034; }
  v.span(-nw * fx, nb - 0.006, zf + 0.002, nw * fx, nb + 0.001, nz - 0.008, C.skinDD);
  // cheeks, freckles, age, soot
  if (L.blush) for (const s of [-1, 1]) { v.box(s * 0.104 * fx, hb + 0.335 * H, zf + 0.002, 0.05 * fx, 0.024, 0.006, C.blush); v.box(s * 0.104 * fx, hb + 0.335 * H, zf + 0.003, 0.034 * fx, 0.034, 0.006, C.blush); }
  if (L.freckles) for (const [x, q] of [[-0.135, 0.37], [-0.115, 0.34], [-0.1, 0.375], [-0.078, 0.335], [-0.06, 0.37], [0.06, 0.37], [0.078, 0.335], [0.1, 0.375], [0.115, 0.34], [0.135, 0.37], [-0.03, 0.4], [0.03, 0.405]]) {
    v.box(x * fx, hb + q * H, zf + (Math.abs(x) < 0.04 ? 0.02 : 0.002), 0.011, 0.011, 0.006, C.freckle);
  }
  if (L.age === 'old') {
    for (const s of [-1, 1]) {
      const x = s * (f.ex + f.ew / 2 + 0.014);
      v.box(x, f.ey + 0.01, zf + 0.002, 0.02, 0.006, 0.006, C.wrinkle, {rz: s * 0.45});
      v.box(x, f.ey - 0.006, zf + 0.002, 0.02, 0.006, 0.006, C.wrinkle, {rz: -s * 0.4});
      v.box(s * f.ex, f.ey - f.eh / 2 - 0.009, zf + 0.002, f.ew * 0.7, 0.006, 0.006, C.wrinkle);
      v.box(s * 0.052 * fx, hb + 0.25 * H, zf + 0.002, 0.007, 0.05, 0.006, C.wrinkle, {rz: -s * 0.3});
    }
    v.box(0, hb + 0.715 * H, zf + 0.002, 0.11 * fx, 0.006, 0.006, C.wrinkle);
  }
  if (X.soot) { v.box(0.11 * fx, hb + 0.3 * H, zf + 0.003, 0.05, 0.03, 0.006, 0x3a3230, {jit: 0.3}); v.box(0.13 * fx, hb + 0.27 * H, zf + 0.004, 0.025, 0.02, 0.006, 0x4a4240); }
}

// brows: one mesh each, so they can frown, worry and jump up in surprise
function buildBrow(v, L, C, s, fx) {
  const c = C.brow, J = {jit: 0.12};
  if (L.brows === 'thin') { v.box(0, 0, 0.004, 0.076 * fx, 0.01, 0.008, c); v.box(s * 0.037 * fx, -0.006, 0.004, 0.02, 0.009, 0.008, c); }
  else if (L.brows === 'thick') { v.box(0, 0.001, 0.006, 0.092 * fx, 0.024, 0.014, c, J); v.box(s * 0.046 * fx, -0.008, 0.006, 0.026, 0.018, 0.013, c, J); }
  else if (L.brows === 'bushy') {
    v.box(0, 0.003, 0.009, 0.108 * fx, 0.03, 0.02, c, J); v.box(s * 0.052 * fx, -0.01, 0.008, 0.032, 0.026, 0.018, c, J);
    for (let i = 0; i < 4; i++) v.box((-0.042 + i * 0.028) * fx, 0.02 + (i % 2) * 0.005, 0.012, 0.022, 0.014, 0.016, i % 2 ? c : mixHex(c, 0xffffff, 0.18), J);
    v.box(-s * 0.05 * fx, 0.016, 0.014, 0.016, 0.02, 0.012, c, {rz: s * 0.6});
  } else { v.box(0, 0, 0.005, 0.084 * fx, 0.017, 0.011, c); v.box(s * 0.041 * fx, -0.007, 0.005, 0.022, 0.013, 0.01, c); }
}
// eyelids: anchored at their top edge, scale.y 0..1 closes the eye
function buildLid(v, C, f) {
  v.span(-(f.ew / 2 + 0.006), -(f.eh + 0.008), 0, f.ew / 2 + 0.006, 0, 0.006, C.skinD);
  v.span(-(f.ew / 2 + 0.007), -(f.eh + 0.008), 0.003, f.ew / 2 + 0.007, -(f.eh - 0.003), 0.009, C.lash);
}
// mouths: one small mesh per shape, only one is visible
const MOUTHS = {
  line: (v, C) => { v.box(0, 0, 0.004, 0.072, 0.016, 0.008, C.lip); },
  smile: (v, C) => { v.box(0, -0.005, 0.004, 0.054, 0.016, 0.008, C.lip); for (const s of [-1, 1]) v.box(s * 0.034, 0.005, 0.004, 0.018, 0.016, 0.008, C.lip); },
  grin: (v, C) => {
    v.box(0, -0.002, 0.002, 0.112, 0.042, 0.006, MOUTH_IN); v.box(0, 0.004, 0.005, 0.1, 0.024, 0.006, TEETH, {glow: 0.6}); v.box(0, -0.016, 0.005, 0.07, 0.007, 0.006, TEETH, {glow: 0.45});
    for (const s of [-1, 1]) v.box(s * 0.059, 0.014, 0.004, 0.016, 0.016, 0.008, C.lip);
  },
  open: (v, C) => { v.span(-0.031, -0.04, 0, 0.031, 0.008, 0.007, MOUTH_IN); v.span(-0.026, -0.002, 0.003, 0.026, 0.008, 0.009, TEETH); v.span(-0.019, -0.04, 0.003, 0.019, -0.029, 0.009, 0xc85a5a); },
  o: (v, C) => { v.box(0, -0.004, 0.002, 0.028, 0.032, 0.006, MOUTH_IN); v.box(0, 0.014, 0.005, 0.03, 0.009, 0.008, C.lip); v.box(0, -0.022, 0.005, 0.03, 0.009, 0.008, C.lip); for (const s of [-1, 1]) v.box(s * 0.019, -0.004, 0.005, 0.009, 0.03, 0.008, C.lip); },
  frown: (v, C) => { v.box(0, 0.004, 0.004, 0.054, 0.016, 0.008, C.lip); for (const s of [-1, 1]) v.box(s * 0.034, -0.006, 0.004, 0.018, 0.016, 0.008, C.lip); },
  smirk: (v, C) => { v.box(-0.006, -0.002, 0.004, 0.056, 0.016, 0.008, C.lip); v.box(0.03, 0.007, 0.004, 0.02, 0.016, 0.008, C.lip); },
};

// ---------------------------------------------------------------- facial hair
// The beard is part of the head; the moustache is its own little mesh, so it can bounce while
// someone talks (and a walrus moustache hides the mouth completely, so it does all the talking).
function buildBeard(v, L, D, C) {
  const fh = L.facialHair, W = D.headW, H = D.headH, hb = D.hb, zf = D.zf, zc = D.zc, fx = D.f.fx, c = C.fh, J = {jit: 0.14};
  if (fh === 'stubble') {
    const sc = mixHex(C.skin, c, 0.42);
    v.span(-W / 2 + 0.024 * fx, hb - 0.004, zf - 0.03, W / 2 - 0.024 * fx, hb + 0.25 * H, zf + 0.003, sc);
    for (const s of [-1, 1]) v.span(s * (W / 2 - 0.023 * fx), hb + 0.004, zc - 0.03, s * (W / 2 + 0.003), hb + 0.5 * H, zf - 0.02, sc);
    v.span(-0.046 * fx, hb + 0.225 * H, zf - 0.004, 0.046 * fx, hb + 0.278 * H, zf + 0.004, sc);
    return 0.006;
  }
  if (fh === 'goatee') {
    v.span(-0.042 * fx, hb - 0.04, zf - 0.02, 0.042 * fx, hb + 0.15 * H, zf + 0.026, c, J);
    for (const s of [-1, 1]) v.span(s * 0.034 * fx, hb + 0.13 * H, zf - 0.004, s * 0.05 * fx, hb + 0.245 * H, zf + 0.012, c);
    return 0.012;
  }
  if (fh === 'beard') {
    v.span(-W / 2 + 0.016, hb - 0.035, zf - 0.04, W / 2 - 0.016, hb + 0.265 * H, zf + 0.022, c, J);
    for (const s of [-1, 1]) v.span(s * (W / 2 - 0.022), hb - 0.012, zc - 0.05, s * (W / 2 + 0.012), hb + 0.55 * H, zf - 0.03, c, J);
    return 0.026;
  }
  if (fh === 'full') {
    v.span(-W / 2 + 0.004, hb - 0.12, zf - 0.08, W / 2 - 0.004, hb + 0.27 * H, zf + 0.044, c, J);
    v.span(-W / 2 + 0.045, hb - 0.17, zf - 0.07, W / 2 - 0.045, hb - 0.11, zf + 0.032, c, J);
    v.span(-W / 2 + 0.09, hb - 0.2, zf - 0.06, W / 2 - 0.09, hb - 0.16, zf + 0.02, c, J);
    for (const s of [-1, 1]) v.span(s * (W / 2 - 0.022), hb - 0.04, zc - 0.06, s * (W / 2 + 0.016), hb + 0.56 * H, zf - 0.03, c, J);
    for (let i = 0; i < 5; i++) v.box((-0.1 + i * 0.05) * fx, hb - 0.06 - (i % 2) * 0.02, zf + 0.046, 0.012, 0.11, 0.004, C.fhD);
    return 0.048;
  }
  return 0;
}
function buildStache(v, L, C, fx) {
  const c = C.fh, J = {jit: 0.14};
  if (L.facialHair === 'walrus') {
    const hl = C.fhL, B = {bump: 0.35, jit: 0.18, tint: (x, y) => (y > -0.005 ? hl : y < -0.07 ? C.fhD : c)};
    v.blob(0, 0.008, 0.02, 0.06 * fx, 0.026, 0.028, 0.02, hl, B);
    for (const s of [-1, 1]) v.blob(s * 0.052 * fx, -0.016, 0.028, 0.072 * fx, 0.042, 0.036, 0.021, c, B);
    for (const s of [-1, 1]) v.blob(s * 0.1 * fx, -0.066, 0.02, 0.036, 0.056, 0.03, 0.02, c, B);
    return;
  }
  const big = L.facialHair === 'full' ? 1.2 : 1;
  v.box(0, 0, 0.012, 0.11 * fx * big, 0.024 * big, 0.024, c, J);
  for (const s of [-1, 1]) v.box(s * 0.056 * fx * big, -0.012, 0.01, 0.024, 0.03, 0.022, c, J);
}

// ---------------------------------------------------------------- glasses
function ring(v, x, y, z, w, h, t, c, round) {
  if (round) {
    v.box(x, y + h / 2 - t / 2, z, w * 0.58, t, 0.01, c); v.box(x, y - h / 2 + t / 2, z, w * 0.58, t, 0.01, c);
    for (const s of [-1, 1]) {
      v.box(x + s * (w / 2 - t / 2), y, z, t, h * 0.58, 0.01, c);
      for (const u of [-1, 1]) v.box(x + s * (w / 2 - t * 1.55), y + u * (h / 2 - t * 1.55), z, t * 1.5, t * 1.5, 0.01, c);
    }
  } else {
    v.box(x, y + h / 2 - t / 2, z, w, t * 1.15, 0.01, c); v.box(x, y - h / 2 + t / 2, z, w, t, 0.01, c);
    for (const s of [-1, 1]) v.box(x + s * (w / 2 - t / 2), y, z, t, h, 0.01, c);
  }
}
function buildGlasses(v, L, D, X) {
  const g = L.glasses;
  if (g === 'none') return;
  const W = D.headW, f = D.f, fx = f.fx, fc = L.glassesColor ?? (g === 'shades' ? 0x18181c : 0x2a2a2e), zg = D.zf + 0.03, t = 0.012;
  const lw = 0.104 * fx, half = g === 'half', lh = half ? 0.052 : 0.086 * f.fy, cy = half ? f.ey - 0.024 : f.ey;
  for (const s of [-1, 1]) {
    const x = s * f.ex;
    if (g === 'shades') {
      v.box(x, cy, zg, lw, 0.07, 0.01, 0x0e1216); v.box(x, cy + 0.036, zg + 0.002, lw + 0.008, t, 0.014, fc);
      v.box(x - 0.026, cy + 0.016, zg + 0.006, 0.018, 0.01, 0.004, 0xffffff, {glow: 0.9});
    } else if (half) {
      v.box(x, cy - lh / 2 + t / 2, zg, lw, t, 0.01, fc);
      for (const u of [-1, 1]) v.box(x + u * (lw / 2 - t / 2), cy, zg, t, lh, 0.01, fc);
      v.box(x, cy + lh / 2 - t / 2, zg, lw, t * 0.7, 0.01, fc);
    } else ring(v, x, cy, zg, lw, lh, t, fc, g === 'round');
    if (X.cateye && g !== 'shades') v.box(x + s * (lw / 2 - 0.004), cy + lh / 2 + 0.004, zg, 0.034, 0.016, 0.012, fc, {rz: s * 0.55});
    v.span(s * (f.ex + lw / 2 - 0.004), cy + lh / 2 - 0.022, zg - 0.006, s * (W / 2 - 0.004), cy + lh / 2 - 0.01, zg + 0.005, fc);   // hinge
    v.span(s * (W / 2 - 0.006), cy + lh / 2 - 0.022, D.zc - 0.03, s * (W / 2 + 0.006), cy + lh / 2 - 0.01, zg - 0.004, fc);         // temple
  }
  v.span(-f.ex + lw / 2 - 0.004, cy + lh / 2 - 0.03, zg - 0.004, f.ex - lw / 2 + 0.004, cy + lh / 2 - 0.018, zg + 0.004, fc);         // bridge
  if (X.loupe) { v.box(-f.ex, cy, zg + 0.03, 0.05, 0.05, 0.05, 0x3a3a40); v.box(-f.ex, cy, zg + 0.056, 0.038, 0.038, 0.006, 0xbfe4ff, {glow: 0.5}); v.box(-f.ex, cy + 0.04, zg + 0.016, 0.012, 0.03, 0.012, 0x3a3a40); }
  if (X.chain) for (const s of [-1, 1]) for (let i = 0; i < 7; i++) v.box(s * (W / 2 + 0.014 - i * 0.004), cy - 0.03 - i * 0.034, D.zc - 0.02 - i * 0.01, 0.008, 0.02, 0.008, GOLD, {glow: 0.3});
}

// ---------------------------------------------------------------- hair
// Layered shapes over the skull. Returns {top, w}: the crown height and width (for hats and headsets).
function buildHair(v, L, D, C, X) {
  const st = L.hair, W = D.headW, H = D.headH, hb = D.hb, ht = D.ht, zf = D.zf, zb = D.zb, zc = D.zc, fx = D.f.fx;
  const c = C.hair, cd = C.hairD, J = {jit: 0.1, glow: X.glow ? 0.16 : 0}, hatOn = L.hat !== 'none' && L.hat !== 'hood';
  const y = q => hb + q * H, line = D.f.hairline, backZ = Math.min(zb + 0.03, -D.td / 2 - 0.014);
  let top = ht, w = W;
  // a cap of hair over the skull: t = thickness on top, s = at the sides, the sides reach down to sideY,
  // the back down to backY, the forehead is covered down to frontY
  const shell = (t, s, frontY, sideY, backY, sideZ, col = c) => {
    v.span(-W / 2 - s, line, zb - s, W / 2 + s, ht + t * 0.4, zf + s * 0.8, col, J);
    if (t > 0.012) v.span(-W / 2 - s + 0.028, ht + t * 0.4 - 0.001, zb - s + 0.025, W / 2 + s - 0.028, ht + t, zf + s * 0.8 - 0.02, col, J);
    v.span(-W / 2 - s, sideY, zb - s, W / 2 + s, line, sideZ, col, J);
    v.span(-W / 2 - s * 0.9, backY, zb - s, W / 2 + s * 0.9, line, zb + 0.07, col, J);
    if (frontY < line) v.span(-W / 2 + 0.008, frontY, zf - 0.03, W / 2 - 0.008, line, zf + s * 0.8, col, J);
    top = Math.max(top, ht + t); w = Math.max(w, W + 2 * s);
  };
  const sideburns = (yy, col = c) => { for (const s of [-1, 1]) v.span(s * W / 2, yy, zc + 0.03, s * (W / 2 + 0.008), y(0.62), zc + 0.065, col); };
  // a fringe of locks of different lengths, fanning out a little
  const fringeBits = (n, yy, col = c, len = 0.034) => {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = -W / 2 + 0.026 + u * (W - 0.052), l = len * (0.7 + ((i * 7) % 3) * 0.24);
      v.box(x, yy - l / 2 + 0.008, zf + 0.012 + (i % 2) * 0.004, (W - 0.03) / n + 0.008, l, 0.02, i % 2 ? cd : col, {rz: (u - 0.5) * 0.35, jit: 0.1});
    }
  };
  // thin darker lines that read as strands
  const strands = (x0, x1, y0, y1, z, n = 6) => { for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / n; v.span(x - 0.004, y0 + (i % 2) * 0.02, z - 0.002, x + 0.004, y1, z + 0.003, cd); } };
  const swept = (dir, col = c) => { for (let i = 0; i < 6; i++) { const x = dir * (-W / 2 + 0.035 + i * (W - 0.07) / 5), drop = 0.01 + i * 0.011; v.box(x, line - drop / 2 + 0.004, zf + 0.014, (W - 0.04) / 6 + 0.012, drop + 0.014, 0.024, i % 2 ? cd : col, J); } };
  const blunt = (col = c) => { v.span(-W / 2 + 0.004, y(0.7), zf - 0.02, W / 2 - 0.004, line, zf + 0.026, col, J); for (let i = 0; i < 6; i++) v.box((-W / 2 + 0.03 + i * (W - 0.06) / 5), y(0.69), zf + 0.016, 0.03, 0.014, 0.02, i % 2 ? cd : col); };
  switch (st) {
    case 'bald': break;
    case 'buzz': shell(0.008, 0.006, line, y(0.56), y(0.32), zc + 0.03, mixHex(c, C.skin, 0.32)); break;
    case 'short':
      shell(0.036, 0.014, line, y(0.56), y(0.27), zc + 0.035);
      fringeBits(7, line + 0.004);
      if (!hatOn) { v.box(0.035 * fx, ht + 0.05, zf - 0.045, 0.12, 0.034, 0.1, c, {rz: 0.16, rx: -0.2, jit: 0.1}); v.box(-0.05 * fx, ht + 0.045, zc - 0.03, 0.1, 0.022, 0.12, cd, {rz: -0.12}); v.box(0.05, ht + 0.042, zb + 0.06, 0.05, 0.03, 0.05, c, {rz: 0.4}); }
      strands(-W / 2 + 0.02, W / 2 - 0.02, y(0.3), line, zb - 0.014);
      sideburns(y(0.42));
      break;
    case 'side':
      shell(0.04, 0.014, line, y(0.56), y(0.27), zc + 0.035);
      if (!hatOn) { v.span(-0.075 * fx, ht + 0.036, zb + 0.02, -0.06 * fx, ht + 0.043, zf, cd); v.span(-0.06 * fx, ht + 0.03, zc - 0.05, W / 2 + 0.01, ht + 0.06, zf + 0.012, c, J); }
      swept(1);
      sideburns(y(0.42));
      top += 0.02;
      break;
    case 'slick':
      shell(0.03, 0.012, line + 0.01, y(0.6), y(0.28), zc + 0.02);
      v.span(-W / 2 + 0.006, line, zf - 0.03, W / 2 - 0.006, ht + 0.05, zf + 0.026, c);   // the rolled front: a little quiff
      v.span(-W / 2 + 0.03, ht + 0.03, zf - 0.07, W / 2 - 0.03, ht + 0.066, zf + 0.016, c);
      top = Math.max(top, ht + 0.066);
      const sheen = mixHex(c, 0x9ab0d8, lum(c) < 0.2 ? 0.32 : 0.25);
      if (!hatOn) for (const x of [-0.08, 0.04]) v.span(x * fx, ht + 0.036, zc - 0.12, (x + 0.022) * fx, ht + 0.039, zf - 0.03, sheen, {glow: 0.2});
      v.span(-0.05 * fx, ht + 0.014, zf + 0.026, 0.06 * fx, ht + 0.024, zf + 0.029, sheen, {glow: 0.2});
      sideburns(y(0.45));
      break;
    case 'curly': {
      const cut = hatOn ? ht - 0.01 : 9, keep = (x, yy, z) => yy < cut && (yy > line - 0.01 || (z < zc + 0.03 && yy > y(0.36)) || (Math.abs(x) > W / 2 && yy > y(0.5) && z < zf - 0.03));
      v.blob(0, ht - 0.03, zc - 0.01, W / 2 + 0.055, 0.11, D.headD / 2 + 0.05, 0.048, c, {bump: 0.35, keep});
      v.blob(0, y(0.62), zb + 0.06, W / 2 + 0.045, 0.15, 0.12, 0.048, c, {bump: 0.35, keep});
      if (hatOn) shell(0.01, 0.012, line, y(0.56), y(0.3), zc + 0.03);
      fringeBits(7, line - 0.012);
      top = hatOn ? ht + 0.012 : ht + 0.1; w = W + (hatOn ? 0.1 : 0.12);
      break;
    }
    case 'afro': {
      const cut = hatOn ? ht - 0.01 : 9, keep = (x, yy, z) => yy < cut && !(z > zf - 0.075 && yy < line + 0.005) && yy > y(0.4);
      v.blob(0, ht - 0.02, zc - 0.03, W / 2 + (hatOn ? 0.08 : 0.13), 0.2, D.headD / 2 + (hatOn ? 0.08 : 0.12), 0.05, c, {bump: 0.3, keep});
      if (hatOn) shell(0.01, 0.012, line, y(0.56), y(0.3), zc + 0.03);
      v.span(-W / 2 + 0.01, line - 0.012, zf - 0.03, W / 2 - 0.01, line + 0.03, zf + 0.012, c, J);
      top = hatOn ? ht + 0.012 : ht + 0.17; w = W + (hatOn ? 0.18 : 0.28);
      break;
    }
    case 'pixie':
      shell(0.034, 0.012, line, y(0.58), y(0.3), zc + 0.03);
      if (!hatOn) v.box(-0.02 * fx, ht + 0.045, zb + 0.09, 0.2, 0.034, 0.13, c, {rx: -0.2, jit: 0.1});
      v.box(-0.035 * fx, line - 0.022, zf + 0.018, 0.27 * fx, 0.052, 0.026, c, {rz: 0.3, jit: 0.08});
      v.box(0.1 * fx, line - 0.045, zf + 0.02, 0.07, 0.03, 0.02, cd, {rz: 0.45});
      for (const s of [-1, 1]) v.box(s * 0.05, y(0.26), backZ - 0.01, 0.05, 0.05, 0.03, c);
      sideburns(y(0.4));
      break;
    case 'bob': {
      const s = 0.026;
      v.span(-W / 2 - s, line, zb - s, W / 2 + s, ht + 0.016, zf + 0.02, c, J);
      v.span(-W / 2 - s + 0.03, ht + 0.015, zb - s + 0.025, W / 2 + s - 0.03, ht + 0.036, zf - 0.006, c, J);
      v.span(-W / 2 - s, hb + 0.02, zb - s, W / 2 + s, line, zf - 0.036, c, J);
      for (const q of [-1, 1]) v.span(q * (W / 2 - 0.004), hb - 0.024, zf - 0.085, q * (W / 2 + s), hb + 0.07, zf - 0.03, c, J);   // longer at the front
      v.span(-W / 2 - s + 0.01, hb + 0.0, zb - s, W / 2 + s - 0.01, hb + 0.03, zb + 0.06, cd);
      if (L.fringe) blunt(); else swept(-1);
      top = ht + 0.036; w = W + 2 * s;
      break;
    }
    case 'long': {
      v.span(-W / 2 - 0.03, line, zb - 0.03, W / 2 + 0.03, ht + 0.018, zf + 0.022, c, J);
      v.span(-W / 2 - 0.002, ht + 0.017, zb - 0.005, W / 2 + 0.002, ht + 0.038, zf - 0.006, c, J);
      v.span(-W / 2 - 0.032, hb - 0.07, zb - 0.032, W / 2 + 0.032, line, zf - 0.075, c, J);
      v.span(-W / 2 - 0.035, hb - 0.3, backZ - 0.05, W / 2 + 0.035, hb - 0.06, backZ, c, J);                      // down the back
      v.span(-W / 2 + 0.02, hb - 0.34, backZ - 0.045, W / 2 - 0.02, hb - 0.29, backZ - 0.005, cd, J);
      for (const s of [-1, 1]) {
        v.span(s * (W / 2 - 0.016), hb - 0.16, zf - 0.075, s * (W / 2 + 0.034), line, zf - 0.008, c, J);         // strands framing the face
        v.span(s * (W / 2 - 0.006), hb - 0.2, zf - 0.07, s * (W / 2 + 0.028), hb - 0.15, zf - 0.018, cd, J);
      }
      if (!hatOn) v.span(-0.006, ht + 0.035, zb, 0.006, ht + 0.045, zf + 0.02, cd);
      if (L.fringe) blunt(); else fringeBits(5, line - 0.008);
      top = ht + 0.038; w = W + 0.064;
      break;
    }
    case 'ponytail':
      shell(0.026, 0.012, line, y(0.56), y(0.3), zc + 0.035);
      if (L.fringe) blunt();
      else {
        // pulled back: a parting, a clean hairline and two loose strands at the temples
        if (!hatOn) v.span(0.03 * fx - 0.004, ht + 0.018, zc, 0.03 * fx + 0.004, ht + 0.028, zf + 0.012, cd);
        v.span(-W / 2 + 0.03, line - 0.004, zf - 0.01, W / 2 - 0.03, line + 0.014, zf + 0.013, c, J);
        for (const s of [-1, 1]) { v.box(s * (W / 2 - 0.02), y(0.6), zf + 0.006, 0.02, 0.12, 0.018, c, {rz: s * 0.1, jit: 0.1}); v.box(s * (W / 2 - 0.026), y(0.47), zf + 0.008, 0.016, 0.05, 0.016, cd, {rz: s * -0.2}); }
      }
      strands(-W / 2 + 0.02, W / 2 - 0.02, y(0.32), line, zb - 0.012);
      sideburns(y(0.45));
      break;
    case 'bun': {
      shell(0.026, 0.012, line, y(0.56), y(0.3), zc + 0.035);
      fringeBits(6, line - 0.002);
      const onTop = X.messy, bx = 0, by = onTop ? ht + 0.05 : ht - 0.05, bz = onTop ? zc - 0.05 : zb - 0.05;
      v.blob(bx, by, bz, 0.085, 0.078, 0.075, 0.04, c, {bump: 0.25});
      v.span(-0.05, by - 0.06, bz - 0.01, 0.05, by - 0.045, bz + 0.04, cd);                                       // the band
      if (X.messy) for (const [x, yy, z, r] of [[-0.09, 0.0, 0.02, 0.6], [0.08, 0.02, -0.02, -0.7], [0.02, 0.08, 0.02, 0.2], [-0.03, -0.1, 0.12, 0.9]]) v.box(bx + x, by + yy, bz + z, 0.07, 0.022, 0.022, c, {rz: r, ry: r});
      if (X.messy) for (const s of [-1, 1]) v.box(s * (W / 2 + 0.01), y(0.55), zf - 0.05, 0.02, 0.13, 0.02, c, {rz: s * 0.15});
      if (X.pencil) { v.box(bx, by + 0.01, bz, 0.22, 0.016, 0.016, 0xf0c030, {rz: 0.55}); v.box(bx - 0.098, by - 0.054, bz, 0.03, 0.017, 0.017, 0xf4c8b0, {rz: 0.55}); v.box(bx + 0.1, by + 0.07, bz, 0.026, 0.012, 0.012, 0x3a3030, {rz: 0.55}); }
      if (!onTop) top = Math.max(top, ht + 0.03);
      else top = by + 0.08;
      break;
    }
    case 'braids':
      shell(0.03, 0.014, line, y(0.52), y(0.28), zc + 0.03);
      if (!hatOn) for (let i = -2; i <= 2; i++) v.span(i * 0.05 * fx - 0.004, ht + 0.026, zb, i * 0.05 * fx + 0.004, ht + 0.034, zf + 0.006, cd);   // cornrow lines
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) braid(v, s * (W / 2 - 0.02 - k * 0.04), line - 0.02, zf - 0.03 - k * 0.025, 0.48 + k * 0.08, c, cd);
      fringeBits(6, line - 0.006);
      top = ht + 0.03; w = W + 0.03;
      break;
    case 'headscarf': {
      const sc = L.scarfColor ?? 0x6a4a8a, sd = shadeHex(sc, 0.85), sl = mixHex(sc, 0xffffff, 0.3);
      v.span(-W / 2 - 0.03, y(0.42), zb - 0.036, W / 2 + 0.03, ht + 0.005, zf - 0.006, sc, {jit: 0.05});
      v.span(-W / 2 - 0.005, ht + 0.004, zb - 0.012, W / 2 + 0.005, ht + 0.036, zf - 0.006, sc, {jit: 0.05});
      v.span(-W / 2 + 0.03, ht + 0.035, zb + 0.02, W / 2 - 0.03, ht + 0.05, zf - 0.03, sc);
      v.span(-W / 2 + 0.004, y(0.765), zf - 0.02, W / 2 - 0.004, ht + 0.03, zf + 0.024, sc);                       // over the forehead
      v.span(-W / 2 + 0.002, y(0.745), zf - 0.004, W / 2 - 0.002, y(0.775), zf + 0.01, sl);                       // the underscarf peeking out
      for (const s of [-1, 1]) {
        v.span(s * (W / 2 - 0.012), hb - 0.03, zf - 0.07, s * (W / 2 + 0.032), y(0.78), zf + 0.016, sc);           // framing the face
        v.box(s * (W / 2 + 0.034), y(0.55), zc, 0.006, 0.18, 0.14, sd, {rx: 0.25});                                 // a fold
      }
      v.span(-W / 2 + 0.004, hb - 0.06, zf - 0.13, W / 2 - 0.004, hb + 0.004, zf + 0.02, sc);                      // under the chin
      v.span(-W / 2 - 0.05, hb - 0.17, backZ - 0.02, W / 2 + 0.05, hb - 0.0, zf + 0.0, sc);                        // over the shoulders
      for (let i = 0; i < 4; i++) { const ww = 0.36 - i * 0.07; v.span(-ww / 2, hb - 0.17 - (i + 1) * 0.035, D.td / 2 - 0.006, ww / 2, hb - 0.17 - i * 0.035, D.td / 2 + 0.02, i % 2 ? sd : sc); }
      top = ht + 0.036; w = W + 0.06;
      break;
    }
  }
  return {top, w};
}
// one braid: a zigzag of small cubes with a bead at the end (the faces where cubes touch are left out)
function braid(v, x, y0, z, len, c, cd) {
  const n = Math.round(len / 0.032);
  for (let i = 0; i < n; i++) v.box(x + (i % 2 ? 0.005 : -0.005), y0 - i * 0.032, z, 0.032, 0.036, 0.032, i % 2 ? cd : c, {skip: (i ? 4 : 0) | 8});
  v.box(x, y0 - n * 0.032 - 0.004, z, 0.03, 0.03, 0.03, GOLD, {glow: 0.3});
}
// ponytails and braids hang from their own pivot, so they swing
function buildTail(v, L, D, C) {
  const c = C.hair, cd = C.hairD, J = {jit: 0.1};
  if (L.hair === 'ponytail') {
    v.box(0, 0, -0.012, 0.064, 0.044, 0.036, shadeHex(L.topColor, 1.0));                                        // hair tie in the colour of your clothes
    const seg = [[0, -0.01, -0.05, 0.08, 0.075, 0.075], [0, -0.07, -0.095, 0.088, 0.085, 0.074], [0, -0.15, -0.125, 0.082, 0.09, 0.07], [0, -0.23, -0.14, 0.074, 0.09, 0.064], [0, -0.31, -0.145, 0.064, 0.09, 0.058], [0, -0.39, -0.14, 0.052, 0.08, 0.05], [0, -0.45, -0.13, 0.036, 0.05, 0.036]];
    seg.forEach(([x, y, z, w, h, d], i) => v.box(x, y, z, w, h, d, i % 2 ? cd : c, J));
    return {x: 0, y: D.ht - 0.02, z: D.zb + 0.035};
  }
  if (L.hair === 'braids') {
    const W = D.headW, n = 7;
    for (let i = 0; i < n; i++) { const a = -1.15 + i * 2.3 / (n - 1); braid(v, Math.sin(a) * (W / 2 - 0.01), 0, -0.02 - Math.cos(a) * 0.02, 0.5 + (i % 2) * 0.06, c, cd); }
    return {x: 0, y: D.hb + 0.5 * D.headH, z: Math.min(D.zb, -D.td / 2 - 0.035)};
  }
  return null;
}

// ---------------------------------------------------------------- hats and headsets
function buildHat(v, L, D, C, hair) {
  const h = L.hat;
  if (h === 'none') return hair.top;
  const W = D.headW, zf = D.zf, zb = D.zb, zc = D.zc, hc = L.hatColor ?? (h === 'hood' ? L.topColor : h === 'hardhat' ? 0xf0c020 : 0x3a3a44);
  const hd = shadeHex(hc, 0.82), hl = mixHex(hc, 0xffffff, 0.2), J = {jit: 0.06};
  const big = hair.w > W + 0.1, cy = Math.max(D.ht + 0.012, hair.top - 0.02), w = Math.max(W + 0.06, hair.w + 0.02), d = D.headD + 0.06 + (big ? 0.12 : 0);
  if (h === 'cap') {
    const badge = L.extras.includes('capBadge');
    if (badge) {
      v.span(-w / 2, cy - 0.035, zb - 0.035, w / 2, cy + 0.07, zf + 0.02, hc, J);
      v.span(-w / 2 + 0.02, cy - 0.045, zf - 0.01, w / 2 - 0.02, cy - 0.028, zf + 0.085, hd);
      v.box(0, cy + 0.075, zc - 0.03, 0.022, 0.012, 0.022, hd);
      v.box(0, cy + 0.025, zf + 0.024, 0.045, 0.035, 0.01, GOLD, {glow: 0.45}); v.span(-w / 2, cy - 0.01, zf + 0.016, w / 2, cy + 0.0, zf + 0.024, hl);
      return cy + 0.07;
    }
    v.span(-w / 2 + 0.012, cy - 0.035, zb - 0.03, w / 2 - 0.012, cy + 0.025, zc, hc, J);
    v.span(-w / 2, cy - 0.035, zc - 0.02, w / 2, cy + 0.045, zf - 0.03, hc, J);
    v.span(-w / 2 + 0.004, cy - 0.032, zf - 0.04, w / 2 - 0.004, cy + 0.032, zf + 0.035, hc, J);
    v.span(-w / 2 + 0.018, cy - 0.028, zf + 0.03, w / 2 - 0.018, cy + 0.008, zf + 0.062, hc, J);
    v.span(-w / 2 + 0.03, cy + 0.044, zc - 0.07, w / 2 - 0.03, cy + 0.056, zf - 0.05, hc, J);
    v.span(-w / 2 + 0.03, cy - 0.046, zf - 0.01, w / 2 - 0.03, cy - 0.03, zf + 0.09, hd);
    v.span(-0.004, cy + 0.045, zb + 0.02, 0.004, cy + 0.06, zf - 0.04, hd);
    v.box(0, cy + 0.062, zc - 0.03, 0.024, 0.012, 0.024, hd);
    return cy + 0.06;
  }
  if (h === 'beret') {
    v.box(0.025, cy + 0.01, zc - 0.005, w + 0.07, 0.06, d + 0.03, hc, {rz: -0.15, jit: 0.05});
    v.box(0.03, cy + 0.045, zc - 0.005, w - 0.03, 0.03, d - 0.06, hc, {rz: -0.15});
    v.box(0.02, cy + 0.075, zc, 0.022, 0.03, 0.022, hd);
    return cy + 0.08;
  }
  if (h === 'beanie') {
    v.span(-w / 2 - 0.006, cy - 0.075, zb - 0.034, w / 2 + 0.006, cy - 0.012, zf + 0.03, hd);
    for (let i = 0; i < 9; i++) v.span(-w / 2 + 0.01 + i * (w - 0.02) / 8 - 0.004, cy - 0.072, zf + 0.03, -w / 2 + 0.01 + i * (w - 0.02) / 8 + 0.004, cy - 0.016, zf + 0.034, shadeHex(hc, 0.7));
    v.span(-w / 2 + 0.004, cy - 0.015, zb - 0.025, w / 2 - 0.004, cy + 0.07, zf + 0.018, hc, J);
    v.span(-w / 2 + 0.04, cy + 0.07, zb + 0.015, w / 2 - 0.04, cy + 0.1, zf - 0.025, hc, J);
    v.blob(0, cy + 0.135, zc - 0.005, 0.05, 0.045, 0.05, 0.026, mixHex(hc, 0xffffff, 0.55), {bump: 0.3});
    return cy + 0.17;
  }
  if (h === 'tophat') {
    v.span(-w / 2 - 0.05, cy - 0.03, zb - 0.06, w / 2 + 0.05, cy - 0.008, zf + 0.06, hc);
    v.span(-w / 2 + 0.02, cy - 0.008, zb + 0.0, w / 2 - 0.02, cy + 0.28, zf - 0.02, hc);
    v.span(-w / 2 + 0.016, cy, zb - 0.004, w / 2 - 0.016, cy + 0.045, zf - 0.016, 0x8a2a2a);
    return cy + 0.28;
  }
  if (h === 'hood') {
    v.span(-W / 2 - 0.045, D.hb - 0.02, zb - 0.06, W / 2 + 0.045, D.ht + 0.05, zf - 0.02, hc, J);
    v.span(-W / 2 + 0.0, D.f.hairline + 0.012, zf - 0.03, W / 2 - 0.0, D.ht + 0.05, zf + 0.03, hc);
    for (const s of [-1, 1]) v.span(s * (W / 2 - 0.006), D.hb - 0.02, zf - 0.07, s * (W / 2 + 0.045), D.ht + 0.04, zf + 0.026, hd);
    v.box(0, D.ht + 0.04, zb - 0.02, 0.1, 0.06, 0.12, hc, {rx: 0.5});
    return D.ht + 0.07;
  }
  if (h === 'quill') {
    v.box(0, cy + 0.012, zc, w + 0.05, 0.065, d + 0.02, hc, {rz: 0.06, jit: 0.05});
    v.box(0, cy + 0.05, zc - 0.01, w - 0.06, 0.04, d - 0.1, hc, {rz: 0.06});
    v.span(-w / 2 - 0.02, cy - 0.02, zb - 0.02, w / 2 + 0.02, cy + 0.0, zf + 0.04, hd);
    // the feather: shaft and vane curling up and back
    let fx = -w / 2 + 0.01, fy = cy + 0.05, fz = zc - 0.02, a = 0.5;
    for (let i = 0; i < 7; i++) {
      const len = 0.07;
      v.box(fx, fy, fz, 0.012, len, 0.012, 0xb8a888, {rx: -a});
      v.box(fx - 0.004, fy, fz - 0.006, 0.006, len, 0.05 - i * 0.004, 0xf4eedc, {rx: -a, jit: 0.06});
      fy += Math.cos(a) * len; fz -= Math.sin(a) * len; a += 0.13;
    }
    return cy + 0.09;
  }
  if (h === 'hardhat') {
    v.span(-w / 2, cy - 0.04, zb - 0.02, w / 2, cy + 0.08, zf + 0.02, hc);
    v.span(-w / 2 + 0.03, cy + 0.08, zb + 0.02, w / 2 - 0.03, cy + 0.11, zf - 0.02, hc);
    v.span(-0.024, cy + 0.08, zb - 0.01, 0.024, cy + 0.125, zf + 0.012, hl);
    v.span(-w / 2 - 0.03, cy - 0.055, zb - 0.04, w / 2 + 0.03, cy - 0.036, zf + 0.09, hc);
    v.box(0.07, cy + 0.03, zf + 0.022, 0.05, 0.03, 0.006, 0x2a6ab0);
    return cy + 0.125;
  }
  return hair.top;
}
function buildHeadset(v, D, crown) {
  const W = D.headW, c = 0x2a2a2e, z = D.zc + 0.005, earY = D.hb + 0.45 * D.headH;
  v.span(-W / 2 - 0.03, crown - 0.004, z - 0.022, W / 2 + 0.03, crown + 0.018, z + 0.022, c);
  for (const s of [-1, 1]) v.span(s * (W / 2 + 0.012), earY + 0.03, z - 0.02, s * (W / 2 + 0.03), crown + 0.0, z + 0.02, c);
  v.span(-W / 2 - 0.05, earY - 0.045, z - 0.045, -W / 2 - 0.012, earY + 0.045, z + 0.045, c);                     // the ear cup (right ear)
  v.span(-W / 2 - 0.054, earY - 0.03, z - 0.03, -W / 2 - 0.048, earY + 0.03, z + 0.03, 0x4a8aff, {glow: 0.8});      // a little light: on call
  const P = [[-W / 2 - 0.032, earY - 0.035, D.zc + 0.04], [-W / 2 - 0.014, D.hb + 0.24 * D.headH, D.zf + 0.014], [-0.07, D.hb + 0.19 * D.headH, D.zf + 0.03]];
  for (let j = 0; j < 2; j++) { const a = P[j], b = P[j + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.012); for (let i = 0; i <= n; i++) { const u = i / n; v.box(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, 0.016, 0.016, 0.016, c); } }
  v.box(-0.07, D.hb + 0.19 * D.headH, D.zf + 0.034, 0.028, 0.026, 0.026, 0x1a1a1e);
}

// ---------------------------------------------------------------- the torso and what is worn on it
// Torso space: origin at the waist, the shoulders at D.th, the chest faces +z.
function buildTorso(v, L, D, C, X) {
  const {tw, ww, td, sw, th, belly} = D, top = L.top, fz = td / 2, J = {jit: 0.035};
  const under = top === 'vest' || top === 'apron' || top === 'hivis', base = under ? C.top2 : C.top;
  v.span(-ww / 2, -0.05, -td / 2, ww / 2, 0.24, fz, base, J);
  v.span(-tw / 2, 0.24, -td / 2, tw / 2, th - 0.07, fz, base, J);
  v.span(-sw / 2 + 0.01, th - 0.12, -td / 2 + 0.012, sw / 2 - 0.01, th - 0.025, fz - 0.012, base, J);
  v.span(-sw / 2 + 0.05, th - 0.025, -td / 2 + 0.03, sw / 2 - 0.05, th, fz - 0.03, base, J);
  if (belly) { v.span(-ww / 2 + 0.035, -0.03, fz - 0.02, ww / 2 - 0.035, 0.27, fz + belly * 0.6, base, J); v.span(-ww / 2 + 0.07, 0.0, fz, ww / 2 - 0.07, 0.22, fz + belly, base, J); v.span(-ww / 2 + 0.12, 0.04, fz, ww / 2 - 0.12, 0.17, fz + belly + 0.018, base, J); }
  const front = yy => (belly ? (yy > 0.04 && yy < 0.17 ? fz + belly + 0.018 : yy > 0 && yy < 0.22 ? fz + belly : yy > -0.03 && yy < 0.27 ? fz + belly * 0.6 : fz) : fz);
  // a strip on the front that follows the belly; dz = how far it stands out
  const strip = (x0, x1, y0, y1, hex, dz = 0.004, o) => {
    const cuts = [y0];
    if (belly) for (const c of [-0.03, 0, 0.04, 0.17, 0.22, 0.27]) if (c > y0 && c < y1) cuts.push(c);
    cuts.push(y1);
    for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], b = cuts[i + 1], z = front((a + b) / 2); v.span(x0, a, z - 0.006, x1, b, z + dz, hex, o); }
  };
  const button = (x, yy, hex) => v.box(x, yy, front(yy) + 0.007, 0.016, 0.016, 0.008, hex);
  // the opening of a jacket: stacked rows narrowing to a point, in the colour (and pattern) of what is under it
  const vee = (yTop, yBot, wTop, hex, pat) => {
    const n = Math.max(2, Math.round((yTop - yBot) / 0.022));
    for (let i = 0; i < n; i++) {
      const b = yTop - i * (yTop - yBot) / n, a = b - (yTop - yBot) / n, wv = Math.max(0.016, wTop * (1 - (i + 0.5) / n));
      strip(-wv / 2, wv / 2, a, b, hex, 0.003);
      if (pat === 'check' && i % 2 === 0) strip(-wv / 2, wv / 2, a + 0.004, a + 0.012, patOn(hex, C), 0.004);
      if (pat === 'check') for (let x = -0.06; x <= 0.061; x += 0.03) if (Math.abs(x) + 0.004 < wv / 2) strip(x - 0.004, x + 0.004, a, b, patOn(hex, C), 0.0045);
      if (pat === 'stripe') for (let x = -0.075; x <= 0.076; x += 0.025) if (Math.abs(x) + 0.004 < wv / 2) strip(x - 0.0035, x + 0.0035, a, b, patOn(hex, C), 0.0045);
      if (pat === 'dots' && i % 2 === 0) for (let x = -0.045; x <= 0.046; x += 0.03) if (Math.abs(x) + 0.008 < wv / 2) strip(x - 0.006, x + 0.006, a + 0.004, a + 0.016, patOn(hex, C), 0.0045);
    }
  };
  const collar = (hex, spread = 1) => {
    v.span(-D.neck / 2 - 0.016, th - 0.045, -0.06, D.neck / 2 + 0.016, th + 0.03, fz - 0.035, hex);
    for (const s of [-1, 1]) v.box(s * 0.036 * spread, th - 0.026, fz - 0.011, 0.062, 0.036, 0.016, hex, {rz: s * 0.55});
  };
  const crew = hex => v.span(-D.neck / 2 - 0.02, th - 0.035, -0.07, D.neck / 2 + 0.02, th + 0.016, fz - 0.03, hex);
  const tie = (hex, yBot) => {
    v.box(0, th - 0.045, fz + 0.0, 0.046, 0.036, 0.02, hex);
    strip(-0.018, 0.018, yBot, th - 0.06, hex, 0.009);
    v.box(0, yBot, front(yBot) + 0.006, 0.026, 0.026, 0.008, hex, {rz: 0.785});
  };
  const hem = (hex, h = 0.04) => {
    v.span(-ww / 2 - 0.005, -0.055, -td / 2 - 0.005, ww / 2 + 0.005, -0.055 + h, front(-0.04) + 0.005, hex);
    for (let i = 0; i < 9; i++) { const x = -ww / 2 + 0.03 + i * (ww - 0.06) / 8; v.span(x - 0.004, -0.053, front(-0.04) + 0.005, x + 0.004, -0.057 + h, front(-0.04) + 0.008, shadeHex(hex, 0.85)); }
  };
  // patterns on a whole garment, front and back
  const pattern = (hex, y0 = -0.05, y1 = th - 0.075) => {
    const pc = patOn(hex, C), p = L.pattern, xw = tw / 2 - 0.01;
    const both = (x0, x1, a, b) => { strip(x0, x1, a, b, pc, 0.0035); v.span(x0, a, -td / 2 - 0.0035, x1, b, -td / 2 + 0.004, pc); };
    if (p === 'stripe') for (let yy = y0 + 0.02; yy < y1; yy += 0.05) both(-xw, xw, yy, yy + 0.018);
    if (p === 'check') { for (let yy = y0 + 0.02; yy < y1; yy += 0.045) both(-xw, xw, yy, yy + 0.012); for (let x = -xw + 0.02; x < xw; x += 0.045) both(x, x + 0.012, y0, y1); }
    if (p === 'dots') for (let yy = y0 + 0.03, r = 0; yy < y1 - 0.01; yy += 0.05, r++) for (let x = -xw + 0.03 + (r % 2) * 0.025; x < xw - 0.01; x += 0.05) both(x - 0.009, x + 0.009, yy - 0.009, yy + 0.009);
  };
  const heart = (x, yy, hex) => { for (const [i, j] of [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]]) v.box(x + (i - 2) * 0.012, yy - j * 0.012, front(yy) + 0.004, 0.012, 0.012, 0.006, hex, {glow: 0.1}); };
  const flower = (x, yy, z, dir, petal, mid) => {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) v.box(x + dx * 0.014, yy + dy * 0.014, z, 0.016, 0.016, 0.006, petal);
    v.box(x, yy, z + dir * 0.001, 0.012, 0.012, 0.007, mid);
  };
  const dark = shadeHex(C.top, 0.8), lite = mixHex(C.top, 0xffffff, 0.16);
  switch (top) {
    case 'blazer': {
      vee(th - 0.004, 0.24, 0.17, C.top2, L.pattern);
      collar(C.top2);
      if (L.tie) tie(L.tie, 0.25);
      for (const s of [-1, 1]) v.box(s * 0.057, 0.37, fz + 0.008, 0.036, 0.28, 0.014, shadeHex(C.top, 0.86), {rz: -s * 0.32});
      for (const yy of [0.19, 0.11]) button(0.003, yy, shadeHex(C.top, 0.55));
      for (const s of [-1, 1]) strip(s * tw * 0.27 - 0.05, s * tw * 0.27 + 0.05, 0.06, 0.078, dark, 0.006);
      strip(tw * 0.27 - 0.04, tw * 0.27 + 0.04, 0.39, 0.402, dark, 0.006);
      if (X.pocketsquare) v.box(tw * 0.27, 0.414, fz + 0.008, 0.05, 0.026, 0.008, L.tie ?? 0xffffff, {glow: 0.15});
      if (X.brooch) { v.box(-tw * 0.26, 0.43, fz + 0.012, 0.034, 0.038, 0.01, GOLD, {glow: 0.6}); v.box(-tw * 0.26, 0.43, fz + 0.017, 0.016, 0.02, 0.006, 0x2a5ab0, {glow: 0.25}); }
      if (X.shine) { for (const s of [-1, 1]) v.span(s * (sw / 2 - 0.02), th - 0.032, -0.03, s * 0.08, th - 0.024, fz - 0.03, lite, {glow: 0.3}); v.span(-tw / 2 + 0.01, 0.3, fz, -tw / 2 + 0.02, th - 0.08, fz + 0.004, lite, {glow: 0.25}); }
      hem(shadeHex(C.top, 0.92), 0.025);
      break;
    }
    case 'cardigan': {
      vee(th - 0.004, 0.12, 0.16, C.top2, L.pattern);
      if (L.pattern !== 'plain' || L.tie) collar(C.top2);
      if (L.tie) tie(L.tie, 0.13);
      const band = mixHex(C.top, 0xffffff, 0.1);
      for (const s of [-1, 1]) v.box(s * 0.046, (th + 0.12) / 2, fz + 0.007, 0.024, th - 0.12 + 0.02, 0.012, band, {rz: -s * 0.2});
      strip(-0.014, 0.014, -0.05, 0.13, band, 0.007);
      for (const yy of [0.09, 0.02, -0.03]) button(0, yy, shadeHex(C.top, 0.55));
      for (const yy of [0.2, 0.29]) button(0.012 + 0.07 * (yy - 0.12) / (th - 0.12), yy, shadeHex(C.top, 0.55));
      for (const s of [-1, 1]) strip(s * tw * 0.26 - 0.045, s * tw * 0.26 + 0.045, 0.0, 0.085, shadeHex(C.top, 0.9), 0.008);
      hem(dark, 0.045);
      break;
    }
    case 'jumper':
      crew(dark);
      if (L.tie || L.pattern === 'check') collar(C.top2, 0.85);
      if (L.pattern !== 'plain') pattern(C.top);
      else for (const s of [-1, 1]) for (let i = 0; i < 7; i++) v.box(s * 0.075, 0.03 + i * 0.05, front(0.03 + i * 0.05) + 0.002, 0.028, 0.03, 0.008, i % 2 ? lite : C.top, {rz: s * (i % 2 ? 0.45 : -0.45)});
      hem(dark, 0.045);
      break;
    case 'shirt':
      collar(C.top);
      if (L.pattern !== 'plain') pattern(C.top);
      strip(-0.016, 0.016, -0.05, th - 0.04, shadeHex(C.top, 0.93), 0.004);
      for (let i = 0; i < 5; i++) button(0, 0.02 + i * 0.09, shadeHex(C.top, 0.7));
      strip(tw * 0.22 - 0.04, tw * 0.22 + 0.04, 0.3, 0.38, shadeHex(C.top, 0.92), 0.006);
      if (L.tie) tie(L.tie, 0.03);
      break;
    case 'tshirt':
      crew(shadeHex(C.top, 0.85));
      if (L.pattern !== 'plain') pattern(C.top);
      else if (C.top2 !== C.top) heart(tw * 0.18, 0.37, C.top2);
      hem(shadeHex(C.top, 0.9), 0.02);
      break;
    case 'hoodie':
      v.span(-0.15, th - 0.08, -td / 2 - 0.07, 0.15, th + 0.05, -td / 2 + 0.05, dark, J);
      v.span(-0.12, th - 0.02, -td / 2 - 0.05, 0.12, th + 0.06, -0.02, C.top, J);
      crew(dark);
      for (const s of [-1, 1]) { strip(s * 0.035 - 0.005, s * 0.035 + 0.005, th - 0.19, th - 0.03, 0xf4f0e8, 0.012); v.box(s * 0.035, th - 0.2, front(th - 0.2) + 0.012, 0.014, 0.02, 0.014, 0xd8d4cc); }
      strip(-0.13, 0.13, 0.0, 0.16, shadeHex(C.top, 0.88), 0.008);
      strip(-0.11, 0.11, 0.135, 0.145, shadeHex(C.top, 0.65), 0.01);
      hem(dark, 0.045);
      break;
    case 'vest': {
      collar(C.top2);
      if (L.tie) tie(L.tie, 0.2);
      const vc = C.top, vd = shadeHex(vc, 0.75), vf = front(0.1) + 0.008;
      v.span(-ww / 2 - 0.008, -0.06, -td / 2 - 0.008, ww / 2 + 0.008, 0.3, vf, vc, J);
      v.span(-tw / 2 - 0.008, 0.3, -td / 2 - 0.008, tw / 2 + 0.008, th - 0.07, 0, vc, J);
      for (let i = 0; i < 6; i++) { const a = 0.3 + i * (th - 0.37) / 6, b = a + (th - 0.37) / 6, open = 0.02 + (i + 0.5) / 6 * 0.075; for (const s of [-1, 1]) v.span(s * open, a, 0, s * (tw / 2 + 0.008), b, fz + 0.008, vc, J); }
      for (let i = 0; i < 4; i++) v.box(0, 0.05 + i * 0.065, vf + 0.004, 0.016, 0.016, 0.008, vd);
      for (const s of [-1, 1]) { v.box(s * 0.05, -0.066, vf - 0.006, 0.07, 0.05, 0.012, vc, {rz: s * 0.5}); v.span(s * 0.08, 0.14, vf, s * 0.15, 0.15, vf + 0.004, vd); }
      if (X.watchchain) for (let i = 0; i < 7; i++) { const u = i / 6; v.box(0.01 + u * 0.12, 0.13 - Math.sin(u * Math.PI) * 0.035, vf + 0.006, 0.014, 0.008, 0.006, GOLD, {glow: 0.5}); }
      break;
    }
    case 'dress':
      v.span(-0.055, th - 0.05, fz - 0.03, 0.055, th + 0.001, fz - 0.008, C.skin);
      if (L.pattern !== 'plain') pattern(C.top, 0.06);
      v.span(-ww / 2 - 0.006, 0.02, -td / 2 - 0.006, ww / 2 + 0.006, 0.05, front(0.035) + 0.006, C.top2 !== C.top ? C.top2 : dark);
      break;
    case 'robe': {
      vee(th - 0.004, 0.33, 0.1, C.skinD);
      for (const s of [-1, 1]) v.box(s * 0.05, 0.36, fz + 0.007, 0.032, 0.32, 0.012, C.top2, {rz: -s * 0.24, glow: X.glow ? 0.12 : 0});
      strip(-0.016, 0.016, -0.05, 0.2, C.top2, 0.006, {glow: X.glow ? 0.12 : 0});
      v.span(-ww / 2 - 0.008, -0.02, -td / 2 - 0.008, ww / 2 + 0.008, 0.035, front(0) + 0.008, shadeHex(C.top2, 0.8));
      if (X.glow) for (let i = 0; i < 5; i++) v.box(-0.12 + i * 0.06, 0.18 + (i % 2) * 0.05, fz + 0.004, 0.014, 0.014, 0.006, 0xeaf6ff, {glow: 1});
      break;
    }
    case 'apron': {
      if (L.pattern !== 'plain' || L.tie) collar(C.top2); else crew(shadeHex(C.top2, 0.85));
      const ac = C.top, ad = shadeHex(ac, 0.78), k = tw / 0.44;
      strip(-0.12 * k, 0.12 * k, 0.03, th - 0.08, ac, 0.012, J);
      for (const s of [-1, 1]) v.box(s * 0.09 * k, th - 0.04, fz - 0.008, 0.024, 0.09, 0.03, ac, {rz: s * 0.15});
      v.span(-ww / 2 - 0.006, -0.0, -td / 2 - 0.006, ww / 2 + 0.006, 0.03, front(0.015) + 0.006, ac);
      v.box(0, 0.015, -td / 2 - 0.02, 0.07, 0.045, 0.02, ad);
      strip(-0.07 * k, 0.07 * k, 0.12, 0.21, ad, 0.016);
      for (let i = 0; i < 8; i++) { const yy = 0.05 + i * (th - 0.14) / 7; for (const s of [-1, 1]) v.box(s * 0.112 * k, yy, front(yy) + 0.014, 0.004, 0.016, 0.004, mixHex(ac, 0xffffff, 0.35)); }
      if (X.tools) {
        const z = front(0.22) + 0.02;
        v.box(-0.035, 0.235, z, 0.016, 0.09, 0.012, 0x9aa0a8); v.box(-0.035, 0.285, z, 0.04, 0.022, 0.012, 0x9aa0a8);
        v.box(0.02, 0.23, z, 0.018, 0.07, 0.016, 0xc03020); v.box(0.02, 0.28, z, 0.006, 0.04, 0.006, 0xc8ccd4);
        v.box(0.05, 0.24, z, 0.01, 0.09, 0.01, 0xf0c030);
      }
      break;
    }
    case 'hawaii': {
      vee(th - 0.004, th - 0.12, 0.09, C.skin);
      for (const s of [-1, 1]) v.box(s * 0.066, th - 0.04, fz + 0.002, 0.085, 0.05, 0.012, C.top, {rz: -s * 0.45});
      v.span(-ww / 2 - 0.012, -0.085, -td / 2 - 0.012, ww / 2 + 0.012, -0.02, front(-0.05) + 0.01, C.top, J);
      const mid = mixHex(C.top2, 0xffffff, 0.55);
      for (let i = 0; i < 10; i++) {
        const x = (((i * 37) % 10) / 10 - 0.45) * (tw - 0.08), yy = -0.04 + (((i * 53) % 11) / 11) * (th - 0.16);
        flower(x, yy, front(yy) + 0.004, 1, C.top2, mid);
        flower(-x * 0.9, yy + 0.03, -td / 2 - 0.004, -1, C.top2, mid);
      }
      break;
    }
    case 'hivis': {
      crew(shadeHex(C.top2, 0.8));
      const hv = C.top, refl = 0xdcdfe4, vf = front(0.1) + 0.01, G = {glow: 0.2};
      v.span(-ww / 2 - 0.01, -0.045, -td / 2 - 0.01, ww / 2 + 0.01, 0.3, vf, hv, G);
      v.span(-tw / 2 - 0.01, 0.3, -td / 2 - 0.01, tw / 2 + 0.01, th - 0.06, 0, hv, G);
      for (let i = 0; i < 6; i++) { const a = 0.3 + i * (th - 0.36) / 6, b = a + (th - 0.36) / 6, open = 0.025 + (i + 0.5) / 6 * 0.08; for (const s of [-1, 1]) v.span(s * open, a, 0, s * (tw / 2 + 0.01), b, fz + 0.01, hv, G); }
      for (const yy of [0.03, 0.15]) v.span(-ww / 2 - 0.016, yy, -td / 2 - 0.016, ww / 2 + 0.016, yy + 0.036, vf + 0.006, refl, {glow: 0.5});
      for (const s of [-1, 1]) { const x = s * tw * 0.3; v.span(x - 0.018, 0.186, fz + 0.006, x + 0.018, th - 0.06, fz + 0.016, refl, {glow: 0.5}); v.span(x - 0.018, 0.186, -td / 2 - 0.016, x + 0.018, th - 0.06, -td / 2 - 0.006, refl, {glow: 0.5}); }
      v.span(-0.004, -0.04, vf, 0.004, 0.3, vf + 0.004, shadeHex(hv, 0.7));
      break;
    }
  }
  // things worn over the clothes
  if (L.lanyard) {
    const lc = 0xd8582a, by = th - 0.27, bz = front(by) + 0.016;
    for (const s of [-1, 1]) v.box(s * 0.034, th - 0.12, front(th - 0.12) + 0.015, 0.014, 0.2, 0.006, lc, {rz: -s * 0.3});
    v.box(0, by, bz, 0.072, 0.095, 0.008, 0xf4f2ee);
    v.box(0, by + 0.034, bz + 0.004, 0.072, 0.024, 0.004, 0x2f5fb8);
    v.box(-0.017, by - 0.008, bz + 0.004, 0.024, 0.03, 0.004, 0x9a8a7a);
    for (const yy of [0, -0.012, -0.024]) v.box(0.017, by + yy, bz + 0.004, 0.026, 0.005, 0.004, 0x8a8a90);
    v.box(0, by + 0.054, bz, 0.016, 0.016, 0.01, 0xb0b4b8);
  }
  if (L.scarf) {
    const sc = L.scarf, sd = shadeHex(sc, 0.76);
    v.span(-D.neck / 2 - 0.042, th - 0.055, -0.09, D.neck / 2 + 0.042, th + 0.045, fz - 0.0, sc, {jit: 0.08});
    strip(0.02, 0.085, th - 0.33, th - 0.04, sc, 0.026, J);
    strip(-0.075, -0.012, th - 0.23, th - 0.04, sc, 0.02, J);
    for (const yy of [th - 0.3, th - 0.27]) strip(0.018, 0.087, yy, yy + 0.012, sd, 0.028);
    for (let i = 0; i < 4; i++) strip(0.024 + i * 0.017 - 0.004, 0.024 + i * 0.017 + 0.004, th - 0.355, th - 0.33, sc, 0.024);
  }
  if (X.tape) for (const s of [-1, 1]) {
    const len = s > 0 ? 0.3 : 0.22, x = s * 0.062;
    strip(x - 0.013, x + 0.013, th - len, th - 0.02, 0xf0d040, 0.014);
    for (let yy = th - len + 0.015; yy < th - 0.03; yy += 0.03) strip(x - 0.013, x - 0.004, yy, yy + 0.005, 0x3a3020, 0.016);
  }
  if (X.mailbag) { v.box(0, 0.24, front(0.24) + 0.012, 0.045, 0.66, 0.012, 0x6a4a2a, {rz: 0.62}); v.box(0, 0.24, -td / 2 - 0.008, 0.045, 0.66, 0.012, 0x6a4a2a, {rz: -0.62}); }
}

// ---------------------------------------------------------------- hips, skirts, robes and coat tails
// Hip space: origin at the hip joints. The legs hang from here; skirts flare out over them.
function buildHips(v, L, D, C, X) {
  const {hw, td, ww} = D, top = L.top, J = {jit: 0.035}, robe = top === 'robe', dress = top === 'dress', skirt = L.bottom === 'skirt' && !robe && !dress;
  v.span(-hw / 2, -0.08, -td / 2 + 0.005, hw / 2, 0.09, td / 2 - 0.004, robe || dress ? C.top : C.bottom, J);
  if (['shirt', 'vest', 'apron'].includes(top) && !skirt && !robe) {
    const by = L.build === 'round' ? -0.01 : 0.03;
    v.span(-hw / 2 - 0.006, by, -td / 2, hw / 2 + 0.006, by + 0.035, td / 2 + 0.004, 0x2a1e16);
    v.span(-0.022, by - 0.002, td / 2, 0.022, by + 0.037, td / 2 + 0.01, 0xc8b070, {glow: 0.25});
  }
  if (L.bottom === 'trousers' && !robe && !dress) v.span(-0.006, -0.075, td / 2 - 0.004, 0.006, 0.02, td / 2 + 0.002, shadeHex(C.bottom, 0.78));
  const flare = (col, y0, y1, w0, w1, d0, d1, n, trim, front) => {
    for (let i = 0; i < n; i++) {
      const a = y0 - (y0 - y1) * i / n, b = y0 - (y0 - y1) * (i + 1) / n, k = (i + 0.5) / n, w = w0 + (w1 - w0) * k, d = d0 + (d1 - d0) * k;
      v.span(-w / 2, b, -d / 2, w / 2, a, d / 2, col, J);
      if (front) v.span(-0.016, b, d / 2 - 0.004, 0.016, a, d / 2 + 0.005, front, {glow: X.glow ? 0.2 : 0});
    }
    if (trim) { const w = w1 + 0.008, d = d1 + 0.008; v.span(-w / 2, y1, -d / 2, w / 2, y1 + 0.03, d / 2, trim, {glow: X.glow ? 0.25 : 0}); }
  };
  if (skirt) flare(C.bottom, 0.08, -D.thigh * 0.8, hw + 0.025, hw + 0.09, td + 0.02, td + 0.07, 5, shadeHex(C.bottom, 0.85));
  if (dress) {
    flare(C.top, 0.06, -D.thigh * 0.95, hw + 0.03, hw + 0.15, td + 0.03, td + 0.12, 5, shadeHex(C.top, 0.82));
    if (L.pattern === 'dots') for (let i = 0; i < 9; i++) { const yy = -0.05 - (i % 3) * 0.1, x = (i * 0.37 % 1 - 0.5) * hw; v.box(x, yy, (td + 0.03 + (0.09 * (0.05 - yy) / 0.4)) / 2 + 0.006, 0.02, 0.02, 0.006, patOn(C.top, C)); }
  }
  if (robe) flare(C.top, 0.06, -(D.thigh + D.shin) + 0.075, hw + 0.04, hw + 0.15, td + 0.04, td + 0.12, 7, C.top2, C.top2);
  if (L.long && ['blazer', 'cardigan', 'hoodie', 'jumper'].includes(top)) {
    const y1 = -D.thigh * 0.62, n = 4, edge = top === 'cardigan' ? mixHex(C.top, 0xffffff, 0.1) : shadeHex(C.top, 0.88);
    for (let i = 0; i < n; i++) {
      const a = 0.04 - (0.04 - y1) * i / n, b = 0.04 - (0.04 - y1) * (i + 1) / n, w = hw + 0.05 + 0.06 * (i + 0.5) / n, d = td + 0.05 + 0.05 * (i + 0.5) / n;
      v.span(-w / 2, b, -d / 2, w / 2, a, d / 2 - 0.03, C.top, J);
      for (const s of [-1, 1]) { v.span(s * 0.018, b, d / 2 - 0.035, s * w / 2, a, d / 2, C.top, J); v.span(s * 0.018, b, d / 2 - 0.004, s * 0.034, a, d / 2 + 0.004, edge); }
    }
    for (const yy of [-0.06, -0.16]) v.box(0.03, yy, td / 2 + 0.05, 0.018, 0.018, 0.01, shadeHex(C.top, 0.55));
  }
  if (top === 'apron') {
    v.span(-hw / 2 - 0.025, -D.thigh * 0.86, td / 2 + 0.004, hw / 2 + 0.025, 0.06, td / 2 + 0.022, C.top, J);
    v.span(-hw / 2 + 0.02, -0.2, td / 2 + 0.022, -0.02, -0.08, td / 2 + 0.03, shadeHex(C.top, 0.78));
  }
  if (X.mailbag) {
    const bx = hw / 2 + 0.04;
    v.span(bx - 0.04, -0.24, -0.1, bx + 0.04, 0.02, 0.12, 0x7a5432, J);
    v.span(bx + 0.04, -0.1, -0.1, bx + 0.05, 0.03, 0.12, 0x6a4428);
    v.box(bx + 0.052, -0.08, 0.01, 0.006, 0.03, 0.03, GOLD, {glow: 0.3});
    for (const z of [-0.06, -0.02, 0.03]) v.box(bx, 0.045, z, 0.05, 0.05, 0.004, 0xf4f0e6);
  }
}

// ---------------------------------------------------------------- arms and hands
function sleeve(L, C, X) {
  const t = L.top, base = ['vest', 'apron', 'hivis'].includes(t) ? C.top2 : C.top;
  const rib = shadeHex(base, 0.8);
  return {
    col: base,
    short: t === 'tshirt' || t === 'hawaii',
    rolled: !!X.sleeves || (t === 'apron' && !!X.mitts),
    threeQ: t === 'dress',
    bell: t === 'robe',
    cuff: t === 'blazer' ? C.top2 : ['cardigan', 'jumper', 'hoodie', 'hivis'].includes(t) ? rib : t === 'robe' ? C.top2 : shadeHex(base, 0.92),
    stripe: L.pattern === 'stripe' && ['tshirt', 'jumper', 'shirt', 'dress'].includes(t) ? patOn(base, C) : null,
  };
}
function buildUpperArm(v, L, D, C, X) {
  const a = D.arm, ua = D.ua, si = sleeve(L, C, X), J = {jit: 0.035};
  if (si.short) {
    v.span(-a / 2 - 0.012, -0.12, -a / 2 - 0.012, a / 2 + 0.012, 0.05, a / 2 + 0.014, si.col, J);
    v.span(-a / 2 + 0.006, -ua - 0.01, -a / 2 + 0.006, a / 2 - 0.006, -0.11, a / 2 - 0.004, C.skin);
    if (L.top === 'hawaii') v.box(0, -0.06, a / 2 + 0.016, 0.03, 0.03, 0.006, L.top2);
  } else {
    v.span(-a / 2, -ua - 0.01, -a / 2, a / 2, 0.05, a / 2 + 0.004, si.col, J);
    if (si.stripe) for (let yy = -0.03; yy > -ua; yy -= 0.05) v.span(-a / 2 - 0.003, yy - 0.018, -a / 2 - 0.003, a / 2 + 0.003, yy, a / 2 + 0.007, si.stripe);
    if (L.patches) v.span(-a * 0.36, -ua + 0.004, -a / 2 - 0.007, a * 0.36, -ua + 0.075, -a / 2 + 0.01, 0x6a4428);
    if (X.shine) v.span(-a / 2 - 0.002, -ua * 0.6, a / 2 - 0.01, -a / 2 + 0.01, 0.0, a / 2 + 0.006, mixHex(si.col, 0xffffff, 0.16), {glow: 0.25});
  }
}
function buildHand(v, D, C, s, X) {
  const hw = D.arm * 0.82, y0 = -D.fa, hl = D.hand, k = C.skin;
  if (X.mitts) {
    const m = 0xc8402a;
    v.span(-hw / 2 - 0.014, y0 - hl - 0.012, -0.036, hw / 2 + 0.014, y0 + 0.03, 0.036, m, {jit: 0.06});
    v.box(-s * (hw / 2 + 0.012), y0 - hl * 0.4, 0.02, 0.03, 0.06, 0.03, m, {rz: s * 0.3});
    v.span(-hw / 2 - 0.018, y0 + 0.0, -0.04, hw / 2 + 0.018, y0 + 0.035, 0.04, 0xf0ece4);
    for (let i = 0; i < 3; i++) v.span(-hw / 2 - 0.016, y0 - 0.02 - i * 0.03, 0.036, hw / 2 + 0.016, y0 - 0.016 - i * 0.03, 0.039, shadeHex(m, 0.78));
    return;
  }
  v.span(-hw / 2, y0 - hl * 0.6, -0.026, hw / 2, y0 + 0.006, 0.026, k);
  v.span(-hw / 2 + 0.004, y0 - hl, -0.024, hw / 2 - 0.004, y0 - hl * 0.58, 0.021, k);
  v.box(-s * (hw / 2 + 0.002), y0 - hl * 0.38, 0.016, 0.022, 0.05, 0.024, k, {rz: s * 0.3});
  v.span(-hw / 2 + 0.006, y0 - hl * 0.62, 0.021, hw / 2 - 0.006, y0 - hl * 0.58, 0.0235, C.skinD);
  if (X.ink && s < 0) for (const [x, yy] of [[0.01, -0.07], [-0.012, -0.08], [0.004, -0.05]]) v.box(x, y0 + yy, 0.025, 0.012, 0.012, 0.004, 0x1a2a6a);
}
function buildForearm(v, L, D, C, X, s, item) {
  const a = D.arm * 0.94, fa = D.fa, si = sleeve(L, C, X), J = {jit: 0.035};
  if (si.short || si.rolled) {
    v.span(-a / 2 + 0.004, -fa, -a / 2 + 0.004, a / 2 - 0.004, 0.02, a / 2 - 0.002, C.skin);
    if (si.rolled) v.span(-a / 2 - 0.008, -0.07, -a / 2 - 0.008, a / 2 + 0.008, 0.025, a / 2 + 0.01, si.col, J);
  } else if (si.threeQ) {
    v.span(-a / 2, -fa * 0.45, -a / 2, a / 2, 0.02, a / 2 + 0.004, si.col, J);
    v.span(-a / 2 + 0.005, -fa, -a / 2 + 0.005, a / 2 - 0.005, -fa * 0.45, a / 2 - 0.002, C.skin);
  } else if (si.bell) {
    v.span(-a / 2, -fa * 0.45, -a / 2, a / 2, 0.02, a / 2 + 0.004, si.col, J);
    v.span(-a / 2 - 0.022, -fa + 0.02, -a / 2 - 0.022, a / 2 + 0.022, -fa * 0.45, a / 2 + 0.026, si.col, J);
    v.span(-a / 2 - 0.036, -fa - 0.02, -a / 2 - 0.036, a / 2 + 0.036, -fa + 0.02, a / 2 + 0.04, si.col, J);
    v.span(-a / 2 - 0.04, -fa - 0.03, -a / 2 - 0.04, a / 2 + 0.04, -fa - 0.012, a / 2 + 0.044, si.cuff, {glow: X.glow ? 0.25 : 0});
  } else {
    v.span(-a / 2, -fa + 0.02, -a / 2, a / 2, 0.02, a / 2 + 0.004, si.col, J);
    v.span(-a / 2 - 0.006, -fa - 0.006, -a / 2 - 0.006, a / 2 + 0.006, -fa + 0.032, a / 2 + 0.01, si.cuff);
    if (si.stripe) for (let yy = -0.03; yy > -fa + 0.04; yy -= 0.05) v.span(-a / 2 - 0.003, yy - 0.018, -a / 2 - 0.003, a / 2 + 0.003, yy, a / 2 + 0.007, si.stripe);
    if (L.patches) v.span(-a * 0.36, -0.06, -a / 2 - 0.007, a * 0.36, 0.0, -a / 2 + 0.01, 0x6a4428);
  }
  buildHand(v, D, C, s, X);
  if (item && !HANGING.has(item)) { v.frame(0, -fa - D.hand / 2, 0, 0, 0, 0, s); ITEMS[item]?.(v, D, L); v.noframe(); }
}

// ---------------------------------------------------------------- legs and shoes
function buildThigh(v, L, D, C) {
  const l = D.leg, t = D.thigh, robe = L.top === 'robe', bare = (L.bottom === 'skirt' || L.top === 'dress') && !robe, J = {jit: 0.03};
  if (L.bottom === 'shorts' && !robe && L.top !== 'dress') {
    v.span(-l / 2 - 0.01, -t * 0.5, -l / 2 - 0.01, l / 2 + 0.01, 0.05, l / 2 + 0.012, C.bottom, J);
    v.span(-l / 2 + 0.008, -t - 0.01, -l / 2 + 0.008, l / 2 - 0.008, -t * 0.5, l / 2 - 0.004, C.skin);
  } else v.span(-l / 2 + (bare ? 0.008 : 0), -t - 0.01, -l / 2 + (bare ? 0.008 : 0), l / 2 - (bare ? 0.008 : 0), 0.05, l / 2 + (bare ? -0.004 : 0.006), bare ? C.skin : C.bottom, J);
}
function buildShin(v, L, D, C, X) {
  const l = D.leg * 0.94, sh = D.shin, robe = L.top === 'robe', bare = (L.bottom === 'skirt' || L.bottom === 'shorts' || L.top === 'dress') && !robe;
  const lw = bare ? l - 0.016 : l;
  v.span(-lw / 2, -sh + 0.09, -lw / 2, lw / 2, 0.02, lw / 2 + 0.004, bare ? C.skin : C.bottom, {jit: 0.03});
  if (!bare && !robe) v.span(-lw / 2 - 0.006, -sh + 0.09, -lw / 2 - 0.006, lw / 2 + 0.006, -sh + 0.13, lw / 2 + 0.01, C.bottom);
  if (bare && (X.socks || L.bottom === 'shorts')) v.span(-lw / 2 - 0.004, -sh + 0.085, -lw / 2 - 0.004, lw / 2 + 0.004, -sh + (X.socks ? 0.2 : 0.14), lw / 2 + 0.008, X.socks ? 0xf4f4f0 : shadeHex(C.shoes, 1.4));
  const sy = -sh, sw = D.leg + 0.024, shoe = C.shoes, sole = lum(shoe) > 0.5 ? 0x8a8a8a : 0x161210;
  v.span(-sw / 2, sy, -0.075, sw / 2, sy + 0.026, 0.155, sole);
  v.span(-sw / 2 + 0.006, sy + 0.026, -0.07, sw / 2 - 0.006, sy + 0.1, 0.06, shoe);
  v.span(-sw / 2 + 0.006, sy + 0.026, 0.06, sw / 2 - 0.006, sy + 0.072, 0.15, shoe);
  v.span(-sw / 2 + 0.004, sy + 0.026, 0.12, sw / 2 - 0.004, sy + 0.052, 0.158, shadeHex(shoe, 0.84));
  v.span(-sw / 2 + 0.014, sy + 0.072, 0.056, sw / 2 - 0.014, sy + 0.079, 0.12, mixHex(shoe, 0xffffff, 0.35));
}

// ---------------------------------------------------------------- things people carry
// In the frame of the hand: fingers point down (-y), forward is +z, the left hand's outside is +x.
const HANGING = new Set(['umbrella', 'suitcase', 'leash', 'bread', 'handbag']);
const ITEMS = {
  folder: (v, D, L) => { const gold = L.extras.includes('shine'); const c = gold ? 0xe8b830 : 0x3a6ab0; v.span(-0.016, -0.22, -0.06, 0.016, 0.1, 0.2, c, {glow: gold ? 0.35 : 0}); v.span(-0.018, -0.22, -0.064, 0.018, 0.1, -0.05, shadeHex(c, 0.75)); v.box(0.017, -0.06, 0.07, 0.004, 0.07, 0.07, gold ? 0xfff2b0 : 0xf4f0e6, {glow: gold ? 0.6 : 0}); },
  clipboard: v => { v.span(-0.012, -0.24, -0.04, 0.012, 0.06, 0.18, 0xa07a50); v.span(0.012, -0.22, -0.02, 0.016, 0.03, 0.16, 0xf4f0e6); for (let i = 0; i < 5; i++) v.span(0.016, -0.17 + i * 0.035, 0.0, 0.018, -0.165 + i * 0.035, 0.13, 0x8a8a90); v.span(-0.016, 0.03, 0.03, 0.02, 0.07, 0.1, 0xb8bcc4); },
  keys: v => { v.span(-0.004, -0.06, 0.0, 0.004, -0.052, 0.06, GOLD, {glow: 0.3}); v.span(-0.004, -0.11, 0.0, 0.004, -0.102, 0.06, GOLD, {glow: 0.3}); for (const [z, r, c] of [[0.008, 0.2, 0xc8a050], [0.022, -0.1, 0xb8bcc4], [0.036, 0.15, 0xc8a050], [0.05, -0.25, 0xa87a40]]) v.box(0.0, -0.14, z, 0.008, 0.07, 0.014, c, {rx: r, glow: 0.25}); },
  ruler: v => { v.span(-0.012, -0.64, 0.045, 0.012, 0.44, 0.075, 0xe8c838); for (let i = 0; i < 22; i++) for (const s of [-1, 1]) v.box(s * 0.013, -0.62 + i * 0.05, 0.06, 0.004, 0.006, i % 2 ? 0.012 : 0.022, 0x3a3020); },
  horn: v => { for (let i = 0; i < 6; i++) { const w = 0.03 + i * 0.022; v.box(0, 0.02 + i * 0.016, 0.04 + i * 0.04, w, w, 0.045, i === 5 ? 0x3a2a14 : 0xc8a050, {glow: 0.25}); } v.box(0, 0.1, 0.27, 0.15, 0.15, 0.02, 0xd8b060, {glow: 0.3}); v.box(0, 0.1, 0.28, 0.1, 0.1, 0.02, 0x2a1a0a); },
  stamp: v => { v.span(-0.018, -0.06, 0.02, 0.018, 0.06, 0.056, 0x7a5030); v.box(0, 0.075, 0.038, 0.05, 0.04, 0.05, 0x6a4022); v.span(-0.05, -0.105, -0.01, 0.05, -0.06, 0.086, 0x5a3a20); v.span(-0.046, -0.12, -0.006, 0.046, -0.105, 0.082, 0xc03020); },
  book: v => { v.span(-0.034, -0.18, -0.04, 0.034, 0.08, 0.16, 0x6a2a2a); v.span(-0.028, -0.17, 0.16, 0.028, 0.07, 0.166, 0xf2ead8); v.span(-0.036, -0.15, -0.044, 0.036, -0.13, 0.164, GOLD, {glow: 0.2}); },
  tome: v => { v.span(-0.05, -0.24, -0.06, 0.05, 0.1, 0.22, 0x4a2418); v.span(-0.042, -0.23, 0.22, 0.042, 0.09, 0.228, 0xf2ead8); for (const yy of [-0.24, 0.1]) for (const z of [-0.06, 0.22]) v.box(0, yy, z, 0.104, 0.03, 0.03, GOLD, {glow: 0.3}); v.box(0.052, -0.07, 0.08, 0.006, 0.08, 0.06, GOLD, {glow: 0.35}); },
  mug: (v, D, L) => mug(v, L.extras.includes('mitts') ? 0x3a3a40 : 0xf4f0e8, 0x5a3218),
  tea: v => { mug(v, 0x3a8a8a, 0x9a6a2a); v.span(0.012, 0.035, 0.07, 0.016, 0.004, 0.074, 0xf4f0e6); v.span(0.006, -0.03, 0.115, 0.03, 0.004, 0.12, 0xf0e070); },
  coffee: v => mug(v, 0x3a3a40, 0x3a2214),
  pen: v => { v.box(0, -0.06, 0.05, 0.014, 0.014, 0.15, 0x1a1a3a, {rx: 0.35}); v.box(0, -0.035, 0.12, 0.016, 0.016, 0.03, GOLD, {rx: 0.35, glow: 0.4}); v.box(0, -0.085, -0.02, 0.016, 0.016, 0.02, GOLD, {rx: 0.35, glow: 0.3}); },
  quill: v => { v.box(0, -0.02, 0.06, 0.008, 0.2, 0.008, 0x3a3030, {rx: 0.5}); for (let i = 0; i < 5; i++) v.box(0, 0.0 + i * 0.03, 0.02 - i * 0.017, 0.004, 0.03, 0.05 - i * 0.006, 0xf4eedc, {rx: 0.5}); },
  form: v => { v.span(-0.004, -0.13, 0.02, 0.004, 0.03, 0.14, 0xf4f0e6); for (let i = 0; i < 4; i++) v.span(0.004, -0.1 + i * 0.03, 0.035, 0.006, -0.096 + i * 0.03, 0.12, 0x9a9aa4); v.span(0.004, -0.122, 0.09, 0.007, -0.1, 0.125, 0xc03020); },
  phone: v => { v.span(-0.008, -0.09, 0.02, 0.008, 0.03, 0.085, 0x1a1a1e); v.span(0.008, -0.08, 0.026, 0.01, 0.022, 0.08, 0x6ab0ff, {glow: 0.9}); },
};
function mug(v, c, drink) {
  v.span(-0.04, -0.08, 0.025, 0.04, 0.03, 0.105, c);
  v.span(-0.034, 0.03, 0.031, 0.034, 0.034, 0.099, drink);
  v.span(-0.014, -0.06, -0.005, 0.014, 0.01, 0.025, c);
}
// hanging things keep their own (upright) pivot at the hand: the hand height decides how long they are
function buildHang(v, item, D, L) {
  const floor = -D.handY;
  if (item === 'umbrella') {
    v.span(-0.014, -0.02, -0.06, 0.014, 0.012, 0.02, 0x4a2e20); v.span(-0.014, -0.06, -0.066, 0.014, -0.0, -0.04, 0x4a2e20);
    v.span(-0.011, -0.16, -0.011, 0.011, 0.0, 0.011, 0x2a2420);
    for (let i = 0; i < 6; i++) { const a = -0.16 - i * 0.08, w = 0.075 - i * 0.008; v.span(-w / 2, a - 0.08, -w / 2, w / 2, a, w / 2, i % 2 ? 0x1a1a22 : 0x24242e); }
    v.span(-0.009, floor + 0.01, -0.009, 0.009, -0.64, 0.009, 0x9aa0a8);
  } else if (item === 'suitcase') {
    const c = 0xc8502a, h = Math.min(0.36, D.handY - 0.12);
    v.span(-0.012, -0.05, -0.05, 0.012, 0.012, 0.05, 0x2a2020); v.span(-0.012, -0.08, -0.06, 0.012, -0.04, -0.045, 0x2a2020); v.span(-0.012, -0.08, 0.045, 0.012, -0.04, 0.06, 0x2a2020);
    v.span(-0.07, -0.08 - h, -0.21, 0.07, -0.08, 0.21, c, {jit: 0.04});
    for (const z of [-0.21, 0.21]) for (const yy of [-0.08, -0.08 - h]) v.box(0, yy, z, 0.15, 0.03, 0.03, 0x3a3030);
    v.span(-0.072, -0.08 - h * 0.55, -0.12, 0.072, -0.08 - h * 0.25, -0.02, 0xf0e070); v.span(-0.072, -0.08 - h * 0.8, 0.04, 0.072, -0.08 - h * 0.5, 0.15, 0x3aa0d0);
    v.span(-0.073, -0.08 - h * 0.7, -0.06, 0.073, -0.08 - h * 0.62, 0.0, 0xffffff);
  } else if (item === 'leash') {
    v.span(-0.012, -0.05, -0.012, 0.012, 0.02, 0.012, 0xc03028);
    const n = 9, end = {y: floor + 0.03, z: 0.58};
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, yy = -0.05 + (end.y + 0.05) * u - Math.sin(u * Math.PI) * 0.04, z = end.z * u; v.box(0, yy, z, 0.014, 0.014, 0.11, 0xc03028, {rx: Math.atan2(-(end.y + 0.05), end.z)}); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; v.box(Math.cos(a) * 0.06, end.y, end.z + Math.sin(a) * 0.06, 0.03, 0.024, 0.03, 0xc03028); }
    v.box(0, end.y - 0.01, end.z + 0.075, 0.024, 0.024, 0.006, GOLD, {glow: 0.4});
  } else if (item === 'bread') {
    for (const z of [-0.06, 0.06]) v.span(-0.006, -0.12, z - 0.006, 0.006, 0.0, z + 0.006, 0xb8a888);
    v.span(-0.055, -0.4, -0.13, 0.055, -0.12, 0.13, 0xd8c8a0, {jit: 0.06});
    v.box(0, -0.06, -0.06, 0.05, 0.36, 0.05, 0xc88a3a, {rx: 0.25}); v.box(0.01, -0.09, 0.05, 0.05, 0.3, 0.05, 0xb87830, {rx: -0.3});
    for (let i = 0; i < 3; i++) v.box(0, -0.0 - i * 0.07, -0.06 + i * 0.018 + 0.026, 0.052, 0.012, 0.012, 0xe8b860, {rx: 0.25});
  } else if (item === 'handbag') {
    v.span(-0.01, -0.07, -0.05, 0.01, 0.012, -0.03, 0x3a2620); v.span(-0.01, -0.07, 0.03, 0.01, 0.012, 0.05, 0x3a2620); v.span(-0.01, -0.0, -0.05, 0.01, 0.012, 0.05, 0x3a2620);
    v.span(-0.055, -0.24, -0.12, 0.055, -0.07, 0.12, 0x4a2a28, {jit: 0.05});
    v.span(-0.058, -0.13, -0.122, 0.058, -0.07, 0.122, 0x3a2220);
    v.box(0.058, -0.13, 0, 0.006, 0.024, 0.03, GOLD, {glow: 0.4});
  }
}
function buildKeyring(v) {
  const g = 0xc8a050;
  v.span(-0.004, -0.004, -0.04, 0.004, 0.004, 0.04, g, {glow: 0.3}); v.span(-0.004, -0.074, -0.04, 0.004, -0.066, 0.04, g, {glow: 0.3});
  for (const z of [-0.04, 0.04]) v.span(-0.004, -0.074, z - 0.004, 0.004, 0.004, z + 0.004, g, {glow: 0.3});
  const keys = [[-0.03, 0.3, 0xc8a050, 0.11], [-0.014, 0.1, 0xb8bcc4, 0.09], [0.0, -0.05, 0xc8a050, 0.13], [0.014, -0.2, 0xa87a40, 0.1], [0.028, -0.35, 0xb8bcc4, 0.12], [-0.02, 0.5, 0xd8d0b0, 0.08], [0.022, 0.15, 0xc03020, 0.06]];
  for (const [z, r, c, len] of keys) { v.box(0, -0.09 - len / 2, z, 0.008, len, 0.016, c, {rx: r, glow: 0.25}); v.box(0, -0.075, z, 0.01, 0.028, 0.028, c, {rx: r, glow: 0.25}); }
}
// an index finger that pops out of the fist for pointing, finger guns and ssst
function buildFinger(v, D, C) {
  const y0 = -D.fa - D.hand;
  v.span(-0.012, y0 - 0.06, 0.004, 0.012, y0 + 0.012, 0.026, C.skin);
  v.span(-0.0125, y0 - 0.062, 0.012, 0.0125, y0 - 0.05, 0.0275, mixHex(C.skin, 0xffffff, 0.3));
}
function buildNote(v) {
  v.box(0, 0, 0, 0.03, 0.024, 0.01, GOLD, {glow: 1.2}); v.box(0.012, 0.035, 0, 0.007, 0.07, 0.008, GOLD, {glow: 1.2}); v.box(0.026, 0.06, 0, 0.026, 0.01, 0.008, GOLD, {glow: 1.2, rz: -0.5});
}

// ---------------------------------------------------------------- assembling a person
// Part geometries are cached per look, so people who look the same share them (and a person who
// walks onto the next floor is rebuilt for free). The cache forgets the oldest looks.
const HUMAN_GEO = new Map();
const UPRIGHT = new Set(['mug', 'tea', 'coffee']);
function humanGeometry(L, kind) {
  const key = kind + lookKey(L);
  let G = HUMAN_GEO.get(key);
  if (G) { HUMAN_GEO.delete(key); HUMAN_GEO.set(key, G); return G; }
  const X = Object.fromEntries(L.extras.map(e => [e, true])), D = humanDims(L, kind), C = colours(L, X), f = D.f;
  let hair = null, crown = 0, mz = 0, tailAt = null;
  const head = vgeo(v => {
    buildHead(v, L, D, C, X, kind);
    hair = buildHair(v, L, D, C, X);
    crown = buildHat(v, L, D, C, hair);
    if (L.headset) buildHeadset(v, D, L.hat === 'none' ? hair.top : crown - 0.02);
    mz = buildBeard(v, L, D, C);
    buildGlasses(v, L, D, X);
    if (X.shadesUp && L.hat === 'none') {
      const fc = X.shine ? GOLD : 0x2a2a2e, G2 = {glow: X.shine ? 0.5 : 0};
      v.frame(0, hair.top - 0.02, D.zf + 0.02, -0.75, 0, 0);
      for (const s of [-1, 1]) { v.box(s * f.ex, 0, 0, 0.1 * f.fx, 0.064, 0.012, 0x0e1216); v.box(s * f.ex, 0.035, 0.002, 0.108 * f.fx, 0.012, 0.016, fc, G2); v.box(s * f.ex - 0.022, 0.012, 0.007, 0.02, 0.01, 0.004, 0xffffff, {glow: 0.9}); }
      v.box(0, 0.026, 0.002, 0.07, 0.01, 0.014, fc, G2);
      v.noframe();
      for (const s of [-1, 1]) v.span(s * (D.headW / 2 + 0.006), hair.top - 0.05, D.zc - 0.05, s * (D.headW / 2 + 0.018), hair.top - 0.038, D.zf - 0.0, fc, G2);
    }
  });
  const holds = [L.holdL, L.holdR], hang = holds.map((h, i) => (HANGING.has(h) ? vgeo(v => buildHang(v, h, D, L)) : UPRIGHT.has(h) ? vgeo(v => { v.frame(0, 0, 0, 0, 0, 0, i ? -1 : 1); ITEMS[h](v, D, L); }) : null));
  G = {
    D, C, X, L, head, mz, crown, top: Math.max(crown, hair.top),
    brow: [vgeo(v => buildBrow(v, L, C, 1, f.fx)), vgeo(v => buildBrow(v, L, C, -1, f.fx))],
    lid: vgeo(v => buildLid(v, C, f)), mouths: {},
    stache: ['moustache', 'walrus', 'goatee', 'beard', 'full'].includes(L.facialHair) ? vgeo(v => buildStache(v, L, C, f.fx)) : null,
    tail: vgeo(v => { tailAt = buildTail(v, L, D, C); }), tailAt: null,
    torso: vgeo(v => buildTorso(v, L, D, C, X)), hips: vgeo(v => buildHips(v, L, D, C, X)), ua: vgeo(v => buildUpperArm(v, L, D, C, X)),
    fa: holds.map((h, i) => vgeo(v => buildForearm(v, L, D, C, X, i ? -1 : 1, UPRIGHT.has(h) ? null : h))), hang,
    thigh: vgeo(v => buildThigh(v, L, D, C)), shin: vgeo(v => buildShin(v, L, D, C, X)),
    keyring: X.keyring ? vgeo(buildKeyring) : null, note: vgeo(buildNote), finger: vgeo(v => buildFinger(v, D, C)),
  };
  G.tailAt = tailAt;
  HUMAN_GEO.set(key, G);
  if (HUMAN_GEO.size > 48) { const [k0, old] = HUMAN_GEO.entries().next().value; HUMAN_GEO.delete(k0); disposeHumanGeo(old); }
  return G;
}
function disposeHumanGeo(G) {
  // three.js uploads a disposed geometry again if someone still shows it, so this is safe
  for (const g of [G.head, G.lid, G.stache, G.tail, G.torso, G.hips, G.ua, G.thigh, G.shin, G.keyring, G.note, G.finger, ...G.brow, ...G.fa, ...G.hang, ...Object.values(G.mouths)]) g?.dispose();
}
const mouthGeo = (G, name) => (G.mouths[name] ??= vgeo(v => MOUTHS[name](v, G.C)));

// ---------------------------------------------------------------- moods and gestures
const MOODS = {
  neutral: {brow: 0, tilt: 0, lid: 0, mouth: 'line'},
  happy: {brow: 0.005, tilt: -0.12, lid: 0.1, mouth: 'smile'},
  laugh: {brow: 0.01, tilt: -0.18, lid: 0.55, mouth: 'open', open: 0.8, hx: -0.12},
  sad: {brow: 0.002, tilt: -0.5, lid: 0.3, mouth: 'frown', hx: 0.14},
  angry: {brow: -0.008, tilt: 0.55, lid: 0.18, mouth: 'frown'},
  surprised: {brow: 0.018, tilt: -0.1, lid: -0.05, mouth: 'o', hx: -0.05},
  worried: {brow: 0.006, tilt: -0.45, lid: 0.05, mouth: 'line'},
  smug: {brow: 0.003, tilt: 0.12, lid: 0.18, mouth: 'smirk', one: 0.012},
  thinking: {brow: 0.003, tilt: 0.15, lid: 0.18, mouth: 'smirk', one: 0.012, hz: 0.1},
  tired: {brow: -0.003, tilt: -0.18, lid: 0.45, mouth: 'line', hx: 0.06},
};
const SIDE = [1, -1];
const pulse = (u, a, b) => (u > a && u < b ? Math.sin((u - a) / (b - a) * Math.PI) : 0);
function arm(p, i, ux, uo = 0, fx = 0, fo = 0) { const a = p.arm[i], s = SIDE[i]; a.ux += ux; a.uz += s * uo; a.fx += fx; a.fz += s * fo; }
// Gestures: fn(p, k, u, t, S) adds to the pose with weight k at progress u (0..1); S.reach(i, point, k)
// puts a hand on a point in torso space (S.T holds named points: mouth, chin, ear, brim, tie, ...).
const GEST = {
  // everyone
  lookaround: {dur: 3.6, fn: (p, k, u) => { p.hy += Math.sin(u * Math.PI * 2) * 0.62 * k; p.hx -= 0.04 * k; }},
  shift: {dur: 3.4, fn: (p, k, u) => { const q = Math.sin(u * Math.PI) * k; p.pz += 0.05 * q; p.tz -= 0.04 * q; p.thL -= 0.05 * q; p.shL += 0.14 * q; }},
  scratch: {dur: 2.2, fn: (p, k, u, t, S) => { S.reach(1, S.T.nape, k, 0, Math.sin(t * 15) * 0.012, 0); p.hx += 0.08 * k; p.hz += 0.08 * k; S.mood = 'thinking'; }},
  arms: {dur: 5, fn: (p, k, u, t, S) => { S.reach(0, S.T.crossL, k); S.reach(1, S.T.crossR, k); p.tx -= 0.03 * k; }},
  nod: {dur: 1.3, fn: (p, k, u) => { p.hx += Math.sin(u * Math.PI * 3) * 0.14 * k; }},
  wave: {dur: 1.7, fn: (p, k, u, t, S) => { arm(p, 1, -0.15 * k, 2.35 * k, -0.45 * k, Math.sin(t * 10) * 0.4 * k); p.hz -= 0.06 * k; S.mood = 'happy'; }},
  sigh: {dur: 2.2, fn: (p, k, u, t, S) => { const q = Math.sin(u * Math.PI) * k; p.tx += 0.08 * q; p.hx += 0.14 * q; S.lidAdd = 0.45 * q; S.mood = 'tired'; }},
  thinking: {dur: 3.2, fn: (p, k, u, t, S) => { S.reach(1, S.T.chin, k, 0.02, -0.03, 0.01); S.reach(0, S.T.crossL, k * 0.8); p.hz += 0.1 * k; p.hx -= 0.08 * k; S.mood = 'thinking'; }},
  // Joop: jingles his keys, polishes one, whistles; tips his cap to say hello
  jingle: {dur: 2.6, fn: (p, k, u, t, S) => { S.reach(1, S.T.front, k, -0.08, 0.14, 0.03); S.shake[1] = Math.sin(t * 30) * 0.22 * k; p.hx += 0.14 * k; p.hy -= 0.2 * k; S.jingle = k; S.mood = 'happy'; }},
  polish: {dur: 3.2, fn: (p, k, u, t, S) => { S.reach(0, S.T.front, k, 0.03, -0.02, 0); S.reach(1, S.T.front, k, -0.02 + Math.sin(t * 9) * 0.03, 0.01 + Math.cos(t * 9) * 0.02, 0.02); p.hx += 0.22 * k; S.mood = 'happy'; }},
  whistle: {dur: 3.8, fn: (p, k, u, t, S) => { S.reach(0, S.T.backL, k); S.reach(1, S.T.backR, k); p.hx -= 0.12 * k; p.hz += Math.sin(t * 2.4) * 0.07 * k; S.note = u; S.pucker = k; S.mouth = 'o'; }},
  tipcap: {dur: 1.9, fn: (p, k, u, t, S) => { S.reach(1, S.T.brim, k); p.hx += 0.16 * pulse(u, 0.3, 0.9) * k; S.mood = 'happy'; }},
  // Glans: straightens his tie, finger guns, checks his cuffs
  tie: {dur: 2.4, fn: (p, k, u, t, S) => { const w = Math.sin(t * 12) * 0.012; S.reach(1, S.T.tie, k, -0.02, w, 0); S.reach(0, S.T.tie, k, 0.03, -0.04 - w, 0); p.hx -= 0.14 * k; S.mood = 'smug'; }},
  fingerguns: {dur: 2.3, fn: (p, k, u, t, S) => { const r = pulse(u, 0.35, 0.5) + pulse(u, 0.6, 0.75); arm(p, 0, (-1.35 + r * 0.35) * k, -0.05 * k, -0.15 * k); arm(p, 1, (-1.35 + r * 0.35) * k, -0.05 * k, -0.15 * k); S.point[0] = S.point[1] = k; p.tx -= 0.05 * k; p.hz += 0.06 * k; S.wink = u > 0.38 && u < 0.85 ? k : 0; S.mouth = 'grin'; }},
  cuffs: {dur: 1.9, fn: (p, k, u, t, S) => { S.reach(0, S.T.front, k, 0.06, 0, 0); S.reach(1, S.T.front, k, 0.05, 0.03 + Math.sin(t * 14) * 0.01, 0.03); p.hx += 0.14 * k; p.hy += 0.12 * k; }},
  // Ilse: taps her headset, nods at a caller, sips her tea
  headset: {dur: 2.4, fn: (p, k, u, t, S) => { S.reach(1, S.T.earR, k, 0, (pulse(u, 0.3, 0.42) + pulse(u, 0.55, 0.67)) * 0.02, 0); p.hz += 0.12 * k; S.talk = u > 0.4 ? k : 0; }},
  sip: {dur: 2.6, fn: (p, k, u, t, S) => { const q = pulse(u, 0.1, 0.95) * k; S.reach(S.mugSide, S.T.mouth, q, -SIDE[S.mugSide] * 0.04, 0, 0); p.hx -= 0.1 * q; S.lidAdd = 0.5 * pulse(u, 0.4, 0.8) * k; }},
  // Mevrouw Bakker: leans on her umbrella, taps it, shakes her head
  lean: {dur: 3.8, fn: (p, k, u, t) => { arm(p, 1, -0.12 * k, 0.05 * k, 0.1 * k); p.tz += 0.07 * k; p.pz -= 0.03 * k; p.hy += Math.sin(t * 2.4) * 0.16 * k; }},
  tap: {dur: 1.8, fn: (p, k, u, t, S) => { arm(p, 1, (-0.2 + Math.max(0, Math.sin(t * 11)) * 0.16) * k, 0.05 * k, -0.1 * k); S.mood = 'angry'; }},
  // Meneer De Wit: tugs the lead (no dog), looks down at where the dog should be
  tug: {dur: 2.4, fn: (p, k, u) => { const q = pulse(u, 0.2, 0.38) + pulse(u, 0.5, 0.68); arm(p, 1, (-0.3 + q * 0.45) * k, 0.06 * k, -0.35 * k); p.hx += 0.32 * k; }},
  lookdown: {dur: 3.6, fn: (p, k, u, t, S) => { p.hx += (u < 0.5 ? 0.45 : 0.1) * k; p.hy += (u < 0.5 ? 0 : Math.sin(t * 3) * 0.42) * k; S.mood = u < 0.5 ? 'worried' : 'thinking'; }},
  // Bep: ssst! and reading
  shush: {dur: 2.4, fn: (p, k, u, t, S) => { S.reach(1, S.T.lips, k); S.point[1] = k; p.hy += Math.sin(u * Math.PI * 2) * 0.3 * k; S.mouth = 'o'; S.mood = 'angry'; }},
  read: {dur: 4.4, fn: (p, k, u, t, S) => { S.reach(0, S.T.read, k); p.hx += 0.3 * k; p.hy += 0.12 * k; }},
  write: {dur: 3.4, fn: (p, k, u, t, S) => { S.reach(0, S.T.read, k); S.reach(1, S.T.read, k, -0.05 + Math.sin(t * 7) * 0.02, 0.02, 0.03); p.hx += 0.32 * k; S.mood = 'thinking'; }},
  // the rest of Dalwijk
  watch: {dur: 3.2, fn: (p, k, u, t, S) => { S.reach(1, S.T.read, k, -0.04, -0.04, -0.04); p.hx += 0.28 * k; S.mood = u > 0.6 ? 'surprised' : 'thinking'; }},
  stretch: {dur: 2.8, fn: (p, k, u, t, S) => { const q = pulse(u, 0.05, 0.95) * k; S.reach(0, S.T.up, q, 0.1, 0, 0); S.reach(1, S.T.up, q, -0.1, 0, 0); p.tx -= 0.08 * q; p.hx -= 0.1 * q; S.mouth = 'o'; S.lidAdd = 0.7 * q; }},
  beard: {dur: 2.8, fn: (p, k, u, t, S) => { S.reach(1, S.T.chin, k, 0, -0.03 - Math.abs(Math.sin(t * 4)) * 0.05, 0.02); p.hx -= 0.06 * k; S.mood = 'thinking'; }},
  pen: {dur: 2.6, fn: (p, k, u, t, S) => { S.reach(1, S.T.chin, k, -0.03, -0.04 + (pulse(u, 0.3, 0.4) + pulse(u, 0.5, 0.6)) * 0.015, 0.03); p.hx -= 0.1 * k; S.mood = 'thinking'; }},
  form: {dur: 3.2, fn: (p, k, u, t, S) => { S.reach(1, S.T.read, k, -0.05, 0, 0); p.hx += 0.26 * k; S.mood = u > 0.7 ? 'worried' : 'neutral'; }},
  listen: {dur: 3.4, fn: (p, k, u, t, S) => { S.reach(1, S.T.earR, k, -0.02, -0.03, 0.03); p.hz += 0.14 * k; S.lidAdd = 0.75 * k; }},
  measure: {dur: 3.2, fn: (p, k, u, t, S) => { arm(p, 1, -1.2 * k, 0.05 * k, -0.25 * k); p.hz -= 0.08 * k; S.wink = 0.8 * k; S.mood = 'thinking'; }},
  wipe: {dur: 2.2, fn: (p, k, u, t, S) => { S.reach(0, S.T.brow, k, Math.sin(t * 6) * 0.05, 0, 0); p.hx -= 0.06 * k; S.lidAdd = 0.4 * k; S.mood = 'tired'; }},
  sort: {dur: 3.2, fn: (p, k, u, t, S) => { S.reach(0, S.T.front, k, 0.08, 0.05, 0.08); S.reach(1, S.T.front, k, -0.08, 0.05 + Math.max(0, Math.sin(t * 6)) * 0.05, 0.08); p.hx += 0.24 * k; }},
  tools: {dur: 2.4, fn: (p, k, u, t, S) => { S.reach(1, S.T.chest, k, 0.0, -0.04, 0); p.hx += 0.2 * k; S.mood = 'happy'; }},
};
const IDLES = {
  keys: ['jingle', 'polish', 'whistle', 'whistle', 'lookaround'], tie: ['tie', 'fingerguns', 'cuffs'], headset: ['headset', 'headset', 'nod', 'sip'],
  umbrella: ['lean', 'tap', 'lookaround'], tea: ['sip', 'lookaround'], leash: ['tug', 'lookdown', 'lookaround'], shush: ['shush', 'read', 'lookaround'],
  read: ['read', 'write', 'lookaround'], watch: ['watch', 'lookaround', 'thinking'], stretch: ['stretch', 'lookaround', 'shift'], beard: ['beard', 'arms', 'lookaround'],
  pen: ['pen', 'lookaround', 'thinking'], form: ['form', 'sigh', 'lookaround'], bread: ['shift', 'sigh', 'lookaround'], trumpet: ['listen', 'lookaround'],
  measure: ['measure', 'thinking'], coffee: ['sip', 'wipe', 'lookaround'], tools: ['thinking', 'tools', 'lookaround'], mail: ['sort', 'lookaround'],
  float: ['lookaround'], generic: ['lookaround', 'shift', 'scratch', 'arms'],
};
export const GESTURES = Object.keys(GEST);

// a two-bone arm: the upper arm rotation (as a quaternion) and the elbow bend that put the hand on a point
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
function solveArm(sx, sy, sz, tx, ty, tz, l1, l2, side, out) {
  _S.set(sx, sy, sz);
  const dir = _T.set(tx - sx, ty - sy, tz - sz);
  let d = dir.length();
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.02), l1 + l2 - 0.004);
  dir.normalize();
  const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  _p.set(side * 0.75, -1, -0.45).addScaledVector(dir, -_p.dot(dir));
  if (_p.lengthSq() < 1e-6) _p.set(side, 0, 0);
  _p.normalize();
  _E.copy(_S).addScaledVector(dir, l1 * Math.cos(alpha)).addScaledVector(_p, l1 * Math.sin(alpha));
  _u.copy(_E).sub(_S).normalize();
  _w.copy(_S).addScaledVector(dir, d).sub(_E).normalize();
  const cb = Math.max(-1, Math.min(1, _u.dot(_w)));
  _z.copy(_w).addScaledVector(_u, -cb);
  if (_z.lengthSq() < 1e-8) { _z.set(0, 0, 1).addScaledVector(_u, -_u.z); if (_z.lengthSq() < 1e-6) _z.set(1, 0, 0).addScaledVector(_u, -_u.x); }
  _z.normalize();
  _u.negate();
  _x.crossVectors(_u, _z);
  out.setFromRotationMatrix(_m.makeBasis(_x, _u, _z));
  return Math.acos(cb);
}

const _qa = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _es = new THREE.Euler();
const dampTo = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function makeHuman(spec = {}) {
  const kind = spec.kind === 'gnome' || spec.kind === 'kobold' ? spec.kind : 'human';
  const L = normalizeLook(spec), G = humanGeometry(L, kind), D = G.D, f = D.f, X = G.X;
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0);
  body.scale.setScalar(L.height);
  // legs
  const hips = k.pivot(body, 0, D.hipY, 0); k.vox(hips, G.hips);
  const thL = k.pivot(hips, D.legX, 0, 0), thR = k.pivot(hips, -D.legX, 0, 0);
  const shL = k.pivot(thL, 0, -D.thigh, 0), shR = k.pivot(thR, 0, -D.thigh, 0);
  for (const g of [thL, thR]) k.vox(g, G.thigh);
  for (const g of [shL, shR]) k.vox(g, G.shin);
  // torso and head
  const torso = k.pivot(body, 0, D.hipY + D.waist, 0), torsoMesh = k.vox(torso, G.torso);
  const head = k.pivot(torso, 0, D.th, 0); k.vox(head, G.head);
  const browZ = D.zf + 0.006, browL = k.vox(head, G.brow[0], f.ex, f.browY, browZ), browR = k.vox(head, G.brow[1], -f.ex, f.browY, browZ);
  const lidY = f.ey + f.eh / 2 + 0.004, lidZ = D.zf + 0.0135, lidL = k.vox(head, G.lid, f.ex, lidY, lidZ), lidR = k.vox(head, G.lid, -f.ex, lidY, lidZ);
  lidL.visible = lidR.visible = false;
  const walrus = L.facialHair === 'walrus';
  const mouth = k.pivot(head, 0, f.mouthY, D.zf + G.mz); mouth.scale.setScalar(f.fx); mouth.visible = !walrus && L.mouth !== 'none';
  const stacheY = walrus ? D.hb + 0.235 * D.headH : f.mouthY + 0.026, stache = G.stache ? k.vox(head, G.stache, 0, stacheY, D.zf + (walrus ? 0 : G.mz * 0.7)) : null;
  const tail = G.tail ? k.pivot(head, G.tailAt.x, G.tailAt.y, G.tailAt.z) : null;
  if (tail) k.vox(tail, G.tail);
  const note = k.vox(head, G.note, 0.05, f.mouthY, D.zf + 0.06); note.visible = false;
  // arms; hang groups stay upright (umbrellas, suitcases, mugs)
  const uaL = k.pivot(torso, D.armX, D.shY, 0), uaR = k.pivot(torso, -D.armX, D.shY, 0);
  for (const g of [uaL, uaR]) k.vox(g, G.ua);
  const faL = k.pivot(uaL, 0, -D.ua, 0), faR = k.pivot(uaR, 0, -D.ua, 0);
  k.vox(faL, G.fa[0]); k.vox(faR, G.fa[1]);
  const handL = k.pivot(faL, 0, -D.fa - D.hand / 2, 0), handR = k.pivot(faR, 0, -D.fa - D.hand / 2, 0);
  const fingers = X.mitts ? [null, null] : [k.vox(faL, G.finger), k.vox(faR, G.finger)];
  for (const fm of fingers) if (fm) fm.visible = false;
  const hangL = k.pivot(handL, 0, 0, 0), hangR = k.pivot(handR, 0, 0, 0);
  if (G.hang[0]) k.vox(hangL, G.hang[0]);
  if (G.hang[1]) k.vox(hangR, G.hang[1]);
  const keyring = G.keyring ? k.pivot(hips, -D.hw / 2 - 0.014, 0.035, 0.05) : null;
  if (keyring) k.vox(keyring, G.keyring);
  const float = !!X.glow;
  let glow = null;
  if (float) { glow = glowSprite(L.eyes, 2.2, 0.18); glow.position.set(0, 1.25, 0.1); body.add(glow); }
  if (spec.extra) spec.extra(k, {body, torso, head, armL: uaL, armR: uaR});
  const parts = {body, hips, torso, head, armL: uaL, armR: uaR, legL: thL, legR: thR, foreL: faL, foreR: faR, shinL: shL, shinR: shR,
    handL, handR, hangL, hangR, heldL: handL, heldR: handR, mouth, lidL, lidR, browL, browR, stache, tail, keyring, note, glow, torsoMesh};

  // ---- animation state (one per person; no allocations per frame)
  const ua = [uaL, uaR], fa = [faL, faR], hangs = [hangL, hangR];
  const mugSide = UPRIGHT.has(L.holdR) ? 1 : UPRIGHT.has(L.holdL) ? 0 : 1;
  const idleSet = IDLES[L.idle] || (spec.npc ? IDLES.generic : null);
  const T = targets(D);
  const S = {
    seed: Math.random() * 100, blink: 1 + Math.random() * 3, blinkT: -1, g: null, gt: 0, gk: 0, forced: false, next: 1.5 + Math.random() * 4,
    browY: 0, tilt: 0, lid: 0, open: 0, look: 0, mouthMesh: null, mouthName: '',
    // per-frame overrides set by gestures
    mood: null, mouth: null, wink: 0, note: -1, pucker: 0, jingle: 0, talk: 0, shake: [0, 0], point: [0, 0], mugSide, T,
    ik: [{x: 0, y: 0, z: 0, k: 0}, {x: 0, y: 0, z: 0, k: 0}],
    reach(i, pt, kk, dx = 0, dy = 0, dz = 0) { const r = this.ik[i]; if (kk <= r.k) return; r.k = kk; r.x = pt[0] + dx; r.y = pt[1] + dy; r.z = pt[2] + dz; },
  };
  const p = {arm: [{ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0}, {ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0}], thL: 0, thR: 0, shL: 0, shR: 0, hx: 0, hy: 0, hz: 0, tx: 0, ty: 0, tz: 0, py: 0, pz: 0, by: 0};
  const robeLegs = L.top === 'robe' || L.top === 'dress' ? 0.55 : 1;
  const showMouth = (name, open) => {
    if (S.mouthName !== name) {
      if (S.mouthMesh) S.mouthMesh.visible = false;
      S.mouthMesh = mouth.getObjectByName(name) || (() => { const m = k.vox(mouth, mouthGeo(G, name)); m.name = name; return m; })();
      S.mouthMesh.visible = true; S.mouthName = name;
    }
    if (name === 'open') S.mouthMesh.scale.y = 0.22 + open * 0.78;
  };
  const startGesture = (name, forced = true) => { if (!GEST[name]) return 0; S.g = name; S.gt = 0; S.gk = forced ? 0.01 : 0; S.forced = forced; api.onGesture?.(name); return GEST[name].dur; };

  const animate = (dt, st) => {
    const t = st.t ?? 0, w = Math.min(1.25, st.walk || 0), run = st.run ? 1 : 0, talking = !!st.talk;
    for (let i = 0; i < 2; i++) { const a = p.arm[i]; a.ux = a.uy = a.uz = a.fx = a.fy = a.fz = 0; }
    p.thL = p.thR = p.shL = p.shR = p.hx = p.hy = p.hz = p.tx = p.ty = p.tz = p.py = p.pz = p.by = 0;
    S.mood = null; S.mouth = null; S.wink = 0; S.note = -1; S.pucker = 0; S.jingle = 0; S.talk = 0; S.shake[0] = S.shake[1] = 0; S.lidAdd = 0; S.point[0] = S.point[1] = 0;
    S.ik[0].k = S.ik[1].k = 0;
    // rest: arms hang a little out, elbows soft; older people stoop a little
    arm(p, 0, 0, D.out, -0.12); arm(p, 1, 0, D.out, -0.12);
    p.tx += D.stoop; p.hx -= D.stoop * 0.7;
    // walking and running
    if (w > 0.01 && !float) {
      const ph = t * (run ? 11 : 8.4), sn = Math.sin(ph), cs = Math.cos(ph), la = (run ? 0.85 : 0.6) * robeLegs, kn = (run ? 1.3 : 0.85) * robeLegs;
      p.thL += sn * w * la; p.thR -= sn * w * la;
      p.shL += (0.06 + Math.max(0, -cs) * kn) * w; p.shR += (0.06 + Math.max(0, cs) * kn) * w;
      arm(p, 0, -sn * w * (run ? 0.9 : 0.55), 0, -(0.2 + run * 0.7) * w); arm(p, 1, sn * w * (run ? 0.9 : 0.55), 0, -(0.2 + run * 0.7) * w);
      p.by -= Math.abs(sn) * 0.035 * w; p.ty += sn * 0.07 * w; p.py -= sn * 0.05 * w; p.tx += 0.16 * run * w;
    }
    const still = 1 - Math.min(1, w * 3);
    // breathing and a slow weight shift
    const br = Math.sin(t * 1.8 + S.seed);
    torsoMesh.scale.y = 1 + br * 0.012;
    head.position.y = D.th + br * 0.005;
    uaL.position.y = uaR.position.y = D.shY + br * 0.004;
    p.pz += Math.sin(t * 0.47 + S.seed) * 0.016 * still; p.tz -= Math.sin(t * 0.47 + S.seed) * 0.01 * still;
    // talking: nodding, a hand that explains things
    if (talking) {
      p.hx += Math.sin(t * 5.3) * 0.03 + Math.sin(t * 2.1) * 0.02; p.hz += Math.sin(t * 1.3) * 0.03;
      const free = L.holdR && !L.holdL ? 0 : 1, gx = Math.sin(t * 2.2 + 1) * 0.5 + 0.5, gy = Math.sin(t * 3.1) * 0.5 + 0.5;
      arm(p, free, -0.32 - 0.25 * gx, 0.14, -0.75 - 0.5 * gy, 0);
      if (L.idle === 'tie') arm(p, 1 - free, -0.25 - 0.25 * gy, 0.12, -0.6 - 0.4 * gx);
    }
    // idle gestures when standing still and not busy
    const canIdle = st.idle !== false && w < 0.05 && !talking && !st.attack && !st.wave && !(st.hurt > 0);
    if (S.g) {
      const g = GEST[S.g];
      S.gt += dt;
      const u = S.gt / g.dur;
      S.gk = canIdle || S.forced ? Math.min(1, S.gk + dt * 4) : Math.max(0, S.gk - dt * 5);
      if (u >= 1 || S.gk <= 0) { S.g = null; S.forced = false; S.next = 2.5 + Math.random() * 5; }
      else {
        const e = Math.min(1, u / 0.14, (1 - u) / 0.16), kk = e * e * (3 - 2 * e) * S.gk;
        if (kk > 0.001) g.fn(p, kk, u, t, S);
      }
    } else if (canIdle && idleSet) { S.next -= dt; if (S.next <= 0) startGesture(idleSet[Math.floor(Math.random() * idleSet.length)], false); }
    // the old moves: attack, wave, extra arm swings, hurt
    if (st.wave) arm(p, 1, -0.15, 2.35, -0.45, Math.sin(t * 10) * 0.4);
    // extra swings (the hero holds the lantern up and a little out to the side, where you can see it)
    if (st.armL) arm(p, 0, st.armL * 0.75, -st.armL * 0.7, st.armL * 1.1);
    if (st.armR) arm(p, 1, st.armR * 0.75, -st.armR * 0.7, st.armR * 1.1);
    if (st.attack) { const a = p.arm[1]; a.ux = -1.5 + st.attack * 1.0; a.fx = -0.45 + st.attack * 0.35; a.uz = -0.1; }
    // where the head looks
    S.look = dampTo(S.look, st.look ?? 0, 6, dt);
    p.hy += S.look + (st.look == null ? Math.sin(t * 0.6 + S.seed) * 0.1 * still : 0);
    // face: mood, brows, eyelids, blinking, mouth
    const md = MOODS[S.mood || st.mood || L.mood] || MOODS.neutral;
    p.hx += md.hx || 0; p.hz += md.hz || 0;
    S.browY = dampTo(S.browY, md.brow + (talking ? Math.max(0, Math.sin(t * 1.7)) * 0.005 : 0), 10, dt);
    S.tilt = dampTo(S.tilt, md.tilt + L.browTilt * 0.6, 8, dt);
    browL.position.y = f.browY + S.browY + (md.one || 0); browR.position.y = f.browY + S.browY;
    browL.rotation.z = S.tilt * 0.55; browR.rotation.z = -S.tilt * 0.55;
    S.blink -= dt;
    if (S.blink <= 0) { S.blinkT = 0; S.blink = Math.random() < 0.15 ? 0.3 : 1.8 + Math.random() * 3.6; }
    let bl = 0;
    if (S.blinkT >= 0) { S.blinkT += dt; const u = S.blinkT / 0.14; bl = u < 0.5 ? u * 2 : Math.max(0, 2 - u * 2); if (u >= 1) S.blinkT = -1; }
    S.lid = dampTo(S.lid, Math.max(-0.1, md.lid + L.lids + S.lidAdd), 10, dt);
    const lidAll = Math.max(S.lid, bl, st.dead ? 1 : 0), lL = Math.max(lidAll, S.wink);
    lidL.scale.y = Math.min(1, lL); lidR.scale.y = Math.min(1, lidAll);
    lidL.visible = lL > 0.03; lidR.visible = lidAll > 0.03;
    const speaking = talking || S.talk > 0.5;
    const tm = speaking ? Math.max(0, Math.sin(t * 15.7) * 0.5 + Math.sin(t * 9.3 + 1.3) * 0.4 + 0.25) * (Math.sin(t * 1.9 + S.seed) > 0.82 ? 0 : 1) : (md.open || 0);
    S.open = dampTo(S.open, Math.min(1, tm), 22, dt);
    if (mouth.visible) {
      const rest = (S.mood || st.mood || L.mood) === L.mood || md === MOODS.happy;
      let shape = S.mouth || (L.mouth && rest ? L.mouth : md.mouth);
      if (S.open > 0.14 && !S.mouth) shape = 'open';
      showMouth(shape, S.open);
    }
    if (stache) { stache.position.y = stacheY + S.open * (walrus ? 0.01 : 0.004); stache.scale.set(1 - S.pucker * 0.12, 1 + S.open * (walrus ? 0.14 : 0.06), 1); }
    if (fingers[0]) { fingers[0].visible = S.point[0] > 0.5; fingers[1].visible = S.point[1] > 0.5; }
    note.visible = S.note >= 0;
    if (note.visible) { const u = (S.note * 2.2) % 1; note.position.set(0.05 + Math.sin(u * 6) * 0.025, f.mouthY + 0.02 + u * 0.3, D.zf + 0.06 + u * 0.05); note.scale.setScalar(Math.max(0.05, Math.sin(u * Math.PI)) * 1.2); }
    // apply
    body.position.y = p.by + (float ? 0.1 + Math.sin(t * 1.2 + S.seed) * 0.035 : 0);
    body.rotation.x = -(st.hurt || 0) * 0.3;
    hips.rotation.set(0, p.py, p.pz);
    torso.rotation.set(p.tx, p.ty, p.tz);
    head.rotation.set(p.hx, p.hy, p.hz);
    thL.rotation.x = p.thL + (float ? 0.08 : 0); thR.rotation.x = p.thR - (float ? 0.05 : 0); shL.rotation.x = p.shL + (float ? 0.2 : 0); shR.rotation.x = p.shR + (float ? 0.12 : 0);
    for (let i = 0; i < 2; i++) {
      const a = p.arm[i], U = ua[i], F = fa[i], ik = S.ik[i];
      U.rotation.set(a.ux, a.uy, a.uz); F.rotation.set(a.fx, a.fy, a.fz + S.shake[i]);
      if (ik.k > 0.001) {
        const beta = solveArm(SIDE[i] * D.armX, D.shY, 0, ik.x, ik.y, ik.z, D.ua, D.fa + D.hand / 2, SIDE[i], _qi);
        U.quaternion.slerp(_qi, Math.min(1, ik.k));
        F.rotation.set(a.fx + (-beta - a.fx) * ik.k, a.fy * (1 - ik.k), a.fz * (1 - ik.k) + S.shake[i]);
      }
      // hanging and upright things: undo the arm's rotation, then let them swing a little
      if (hangs[i].children.length) {
        _qa.copy(U.quaternion).multiply(F.quaternion).invert();
        _qs.setFromEuler(_es.set(Math.sin(t * 8.4 + i * 3.1) * 0.07 * w + p.tx * -1, 0, Math.sin(t * 1.3 + i) * 0.02));
        hangs[i].quaternion.copy(_qa).multiply(_qs);
      }
    }
    if (tail) { tail.rotation.x = 0.06 + Math.sin(t * 1.3 + S.seed) * 0.035 + w * Math.abs(Math.sin(t * 8.4)) * 0.14 - p.hx * 0.6; tail.rotation.z = Math.sin(t * 1.7) * 0.05 - p.hy * 0.25 - p.hz * 0.5; }
    if (keyring) { keyring.rotation.x = Math.sin(t * 8.4) * 0.3 * w + S.jingle * Math.sin(t * 31) * 0.35; keyring.rotation.z = Math.sin(t * 2.3 + 1) * 0.05 + S.jingle * Math.sin(t * 23) * 0.25; }
  };
  const height = (D.hipY + D.waist + D.th + D.ht) * L.height + (float ? 0.1 : 0);
  // gesture(name) plays one now (greetings, tests); onGesture(name) is called whenever one starts
  const api = {root, parts, kit: k, probe: k.probe, animate, height, look: L, dims: D, gestures: idleSet || [], onGesture: null, gesture: name => startGesture(name, true)};
  return api;
}
// First-person arms, seen up close in the view scene: a sleeve with its cuff and a fist around the
// lantern ring (or a tool), in the colours of a look. side: 1 = left hand, -1 = right hand.
export function viewArmGeometry(spec, side = 1) {
  const L = normalizeLook(spec), X = Object.fromEntries(L.extras.map(e => [e, true])), C = colours(L, X), si = sleeve(L, C, X), bare = si.short || si.rolled;
  return vgeo(v => {
    v.span(-0.041, -0.082, 0.05, 0.041, 0.0, 0.44, bare ? C.skin : si.col, {jit: 0.04});
    if (bare && si.rolled) v.span(-0.049, -0.09, 0.3, 0.049, 0.008, 0.37, si.col);
    if (!bare) v.span(-0.047, -0.088, 0.04, 0.047, 0.006, 0.088, si.cuff);
    if (si.stripe) for (let z = 0.13; z < 0.44; z += 0.07) v.span(-0.043, -0.084, z, 0.043, 0.002, z + 0.025, si.stripe);
    if (X.mitts) { v.span(-0.052, -0.072, -0.065, 0.052, 0.03, 0.06, 0xc8402a, {jit: 0.06}); v.box(-side * 0.05, -0.01, -0.03, 0.03, 0.03, 0.05, 0xc8402a); return; }
    const k = C.skin;
    v.span(-0.044, -0.066, -0.032, 0.044, 0.014, 0.056, k);
    v.span(-0.042, -0.072, -0.052, 0.042, -0.018, -0.028, C.skinD);
    for (let i = 0; i < 4; i++) v.box(-0.03 + i * 0.02, 0.016, -0.03, 0.017, 0.008, 0.018, i % 2 ? C.skinD : k);
    v.box(-side * 0.036, -0.004, -0.024, 0.026, 0.024, 0.052, k);
  });
}
// named points in torso space that hands can reach for
function targets(D) {
  const th = D.th, f = D.f, W = D.headW, fz = D.td / 2 + D.belly;
  return {
    mouth: [0, th + f.mouthY - 0.05, D.zf + 0.07], lips: [-0.02, th + f.mouthY - 0.07, D.zf + 0.05], chin: [0, th + D.hb - 0.04, D.zf + 0.06],
    earR: [-(W / 2 + 0.06), th + D.hb + 0.4 * D.headH, D.zc + 0.03], brim: [-0.07, th + D.ht - 0.02, D.zf + 0.1], brow: [0.02, th + D.hb + 0.62 * D.headH, D.zf + 0.08],
    nape: [-0.07, th + D.ht - 0.1, D.zb - 0.05], tie: [0, th - 0.1, D.td / 2 + 0.06], chest: [0, th - 0.2, fz + 0.06], front: [0, th - 0.28, fz + 0.16],
    read: [0.03, th - 0.05, fz + 0.26], up: [0, th + D.ht + 0.45, 0.0], crossL: [-0.1, th - 0.2, fz + 0.09], crossR: [0.1, th - 0.17, fz + 0.12],
    backL: [0.07, 0.06, -D.td / 2 - 0.08], backR: [-0.07, 0.06, -D.td / 2 - 0.08],
  };
}

// ---------------------------------------------------------------- the folk of the Gewelf
// Pip, the sparks, Wolk, Otto and Slotje: voxel creatures with faces that blink and talk.
const FOLK_GEO = new Map();
const folkGeo = (key, fn) => { let g = FOLK_GEO.get(key); if (g === undefined) { g = vgeo(fn); FOLK_GEO.set(key, g); } return g; };
// two eyes with a highlight; the whole mesh squashes to blink
function eyes(v, x, y, z, w, h, white = EYE_WHITE, pupil = PUPIL) {
  for (const s of [-1, 1]) {
    v.box(s * x, y, z, w, h, 0.012, white);
    v.box(s * x - s * w * 0.08, y - h * 0.08, z + 0.004, w * 0.58, h * 0.66, 0.012, pupil);
    v.box(s * x - w * 0.22, y + h * 0.16, z + 0.009, w * 0.26, w * 0.26, 0.006, 0xffffff, {glow: 0.8});
  }
}
function blinker(S, dt) {
  S.blink -= dt;
  if (S.blink <= 0) { S.bt = 0; S.blink = Math.random() < 0.15 ? 0.3 : 1.8 + Math.random() * 3.5; }
  if (S.bt < 0) return 1;
  S.bt += dt;
  const u = S.bt / 0.14;
  if (u >= 1) { S.bt = -1; return 1; }
  return Math.max(0.08, Math.abs(1 - u * 2));
}
const talkOpen = (t, on) => (on ? Math.max(0, Math.sin(t * 15) * 0.5 + Math.sin(t * 8.7 + 1) * 0.4 + 0.3) : 0);

function pip(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), m = k.vbasic();
  const core = k.vox(body, folkGeo('pip', v => {
    v.blob(0, 0, 0, 0.13, 0.14, 0.12, 0.036, 0xffcf6a, {bump: 0.2, jit: 0.1, tint: (x, y) => (y < -0.04 ? 0xffe9a8 : y > 0.06 ? 0xffb040 : 0xffcf6a)});
    for (const s of [-1, 1]) v.box(s * 0.075, -0.035, 0.162, 0.03, 0.016, 0.006, 0xff8a5a);
    for (const s of [-1, 1]) v.box(s * 0.14, -0.03, 0.0, 0.04, 0.04, 0.04, 0xffd88a);
  }), 0, 0, 0, m);
  const face = k.vox(body, folkGeo('pipEyes', v => eyes(v, 0.045, 0, 0, 0.04, 0.05, 0xfffaf0, 0x2a1406)), 0, 0.015, 0.165, m);
  const mouth = k.vox(body, folkGeo('pipMouth', v => { v.box(0, 0, 0, 0.04, 0.02, 0.008, 0x6a2a10); v.box(0, 0.005, 0.002, 0.03, 0.006, 0.008, 0xfff4e0); }), 0, -0.04, 0.166, m);
  const tip = k.vox(body, folkGeo('pipTip', v => { v.box(0, 0.03, 0, 0.1, 0.06, 0.09, 0xffa040); v.box(0.01, 0.08, 0, 0.065, 0.05, 0.06, 0xff8a2a); v.box(0.02, 0.12, 0, 0.035, 0.04, 0.035, 0xff6a1a); }), 0, 0.12, -0.01, m);
  const halo = glowSprite(0xffa040, 0.9, 0.55); body.add(halo);
  const S = {blink: 1, bt: -1};
  return {root, parts: {body, core, halo, face, mouth, tip}, kit: k, probe: k.probe, glow: true, animate: (dt, st) => {
    body.position.y = Math.sin(st.t * 3.1) * 0.06;
    tip.rotation.z = Math.sin(st.t * 7) * 0.25; tip.scale.y = 1 + Math.sin(st.t * 11) * 0.15;
    halo.scale.setScalar(0.9 * (1 + Math.sin(st.t * 9) * 0.08) * (st.talk ? 1.25 : 1));
    face.scale.y = blinker(S, dt);
    mouth.scale.set(1, 0.6 + talkOpen(st.t, st.talk) * 1.6, 1);
    core.scale.setScalar(1 + Math.sin(st.t * 9) * 0.03);
  }, height: 0.4};
}

// Vonk and the other sparks of the adoption team: a flame with a face, small floating hands and one thing of their own
function spark(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 1.0, 0), m = k.vbasic(), c = spec.color ?? 0xffb84a;
  const big = spec.big ? 1.2 : 1, light = mixHex(c, 0xffffff, 0.55), edge = shadeHex(c, 0.78), dim = mixHex(c, 0x30343a, 0.62);
  const key = `spark${c}|${spec.big}|${spec.half}|${spec.glasses}|${spec.sprout}|${spec.grin}`;
  const tint = (x, y) => (spec.half && x < -0.02 ? dim : y < -0.12 ? light : Math.abs(x) > 0.16 ? edge : c);
  const core = k.vox(body, folkGeo(key, v => {
    v.blob(0, -0.02, 0, 0.27 * big, 0.3 * big, 0.24 * big, 0.06, c, {bump: 0.2, jit: 0.08, tint});
    v.blob(0, 0.26 * big, -0.01, 0.16 * big, 0.14 * big, 0.14 * big, 0.055, c, {bump: 0.2, jit: 0.08, tint});
    if (spec.glasses === 'half') { for (const s of [-1, 1]) { v.box(s * 0.08, 0.0, 0.265, 0.1, 0.012, 0.012, 0x2a2a2e); v.box(s * 0.08 + s * 0.045, 0.02, 0.265, 0.012, 0.04, 0.012, 0x2a2a2e); } v.box(0, 0.006, 0.265, 0.05, 0.01, 0.012, 0x2a2a2e); }
  }), 0, 0, 0, m);
  const face = k.vox(body, folkGeo('sparkEyes', v => eyes(v, 0.08, 0, 0, 0.07, 0.08)), 0, 0.06 * big, 0.3 * big, m);
  const mouth = k.vox(body, folkGeo(spec.grin ? 'sparkGrin' : 'sparkMouth', v => {
    if (spec.grin) { v.box(0, 0, 0, 0.15, 0.05, 0.008, 0x4a1a0a); v.box(0, 0.008, 0.003, 0.13, 0.022, 0.008, 0xfff8e8); for (const s of [-1, 1]) v.box(s * 0.08, 0.02, 0, 0.02, 0.02, 0.008, 0x4a1a0a); }
    else { v.box(0, 0, 0, 0.07, 0.025, 0.008, 0x4a1a0a); for (const s of [-1, 1]) v.box(s * 0.04, 0.01, 0, 0.018, 0.018, 0.008, 0x4a1a0a); }
  }), 0, -0.07 * big, 0.305 * big, m);
  const tip = k.vox(body, folkGeo(`sparkTip${c}|${spec.big}|${spec.sprout}`, v => {
    v.box(0, 0.06, 0, 0.18 * big, 0.12, 0.16 * big, c); v.box(0.02, 0.16, 0, 0.12 * big, 0.1, 0.1 * big, edge); v.box(0.035, 0.25, 0, 0.06, 0.08 * big, 0.06, shadeHex(edge, 0.9));
    if (spec.sprout) { v.box(0.035, 0.33, 0, 0.022, 0.1, 0.022, 0x3a8a3a); v.box(0.1, 0.38, 0, 0.13, 0.026, 0.07, 0x6ad86a, {rz: 0.45}); v.box(-0.03, 0.37, 0, 0.11, 0.024, 0.06, 0x52c052, {rz: -0.5}); }
  }), 0, 0.36 * big, -0.02, m);
  const hands = [1, -1].map(s => k.vox(body, folkGeo(`sparkHand${c}`, v => v.blob(0, 0, 0, 0.05, 0.05, 0.05, 0.035, light, {bump: 0.2})), s * 0.33 * big, -0.08, 0.06, m));
  let prop = null;
  if (spec.holdR === 'clipboard') { prop = k.vox(hands[1], folkGeo('sparkClip', v => { v.span(-0.1, -0.13, 0.03, 0.1, 0.13, 0.045, 0xa07a50); v.span(-0.085, -0.11, 0.045, 0.085, 0.1, 0.05, 0xf4f0e6); for (let i = 0; i < 4; i++) v.span(-0.06, -0.07 + i * 0.04, 0.05, 0.06, -0.064 + i * 0.04, 0.054, 0x8a8a90); v.span(-0.03, 0.1, 0.035, 0.03, 0.14, 0.06, 0xb8bcc4); }), 0.05, 0.0, 0.0, k.vmat()); }
  const halo = glowSprite(c, 1.7 * big, spec.half ? 0.5 : 0.8); body.add(halo);
  const S = {blink: 1, bt: -1};
  return {root, parts: {body, core, halo, face, mouth, tip, hands, prop}, kit: k, probe: k.probe, glow: true, animate: (dt, st) => {
    const t = st.t;
    body.position.y = 1.0 + Math.sin(t * 2.2) * 0.08;
    const p = 1 + Math.sin(t * 8) * 0.03 * (spec.big ? 2 : 1);
    core.scale.set(p, 1 / p, p);
    tip.rotation.z = Math.sin(t * 6) * 0.3; tip.scale.set(1, 1 + Math.sin(t * 13) * 0.14, 1);
    halo.material.opacity = (spec.half ? 0.45 : 0.8) * (st.dim ? 0.35 : 1) * (0.9 + Math.sin(t * 9) * 0.1);
    face.scale.y = blinker(S, dt);
    mouth.scale.set(1, 0.7 + talkOpen(t, st.talk) * 1.5, 1);
    hands.forEach((h, i) => { h.position.y = -0.08 + Math.sin(t * 2.7 + i * 2) * 0.04 + (st.talk && i === 0 ? Math.abs(Math.sin(t * 5)) * 0.12 : 0); h.position.z = 0.06 + (st.talk && i === 0 ? 0.08 : 0); });
    if (spec.big) body.rotation.z = Math.sin(t * 3.3) * 0.06;
  }, height: 1.5};
}

// Wolk sells cloud gateways: a cumulus with a face and a very small tie
function cloud(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0xdfe6f0;
  const puff = k.vox(body, folkGeo(`cloud${c}`, v => {
    const tint = (x, y) => (y < 1.0 ? shadeHex(c, 0.88) : y > 1.4 ? mixHex(c, 0xffffff, 0.5) : c);
    for (const [x, y, z, r] of [[0, 1.18, 0, 0.42], [-0.42, 1.08, 0.0, 0.3], [0.42, 1.1, 0.02, 0.32], [0.16, 1.48, -0.04, 0.28], [-0.2, 1.42, 0.04, 0.26], [0.62, 1.0, -0.06, 0.18], [-0.6, 0.98, -0.04, 0.16]]) v.blob(x, y, z, r, r * 0.92, r, 0.075, c, {bump: 0.25, jit: 0.06, tint, glow: 0.12});
  }), 0, 0, 0);
  const face = k.vox(body, folkGeo('cloudEyes', v => eyes(v, 0.12, 0, 0, 0.07, 0.08, 0xffffff, 0x1a2030)), 0, 1.25, 0.42);
  const mouth = k.vox(body, folkGeo('cloudMouth', v => { v.box(0, 0, 0, 0.1, 0.02, 0.01, 0x1a2030); for (const s of [-1, 1]) v.box(s * 0.058, 0.012, 0, 0.022, 0.02, 0.01, 0x1a2030); }), 0, 1.1, 0.43);
  k.vox(body, folkGeo(`cloudTie${spec.tie ?? 0x2f5fb8}`, v => { const tc = spec.tie ?? 0x2f5fb8; v.box(0, 0, 0, 0.06, 0.04, 0.03, tc); v.box(0, -0.07, 0.004, 0.04, 0.1, 0.02, tc); v.box(0, -0.13, 0.004, 0.035, 0.035, 0.02, tc, {rz: 0.785}); v.box(0, -0.06, 0.016, 0.01, 0.07, 0.004, mixHex(tc, 0xffffff, 0.4)); }), 0, 0.98, 0.4);
  const S = {blink: 1, bt: -1};
  return {root, parts: {body, puff, face, mouth}, kit: k, probe: k.probe, animate: (dt, st) => {
    body.position.y = Math.sin(st.t * 1.5) * 0.12; body.rotation.y = Math.sin(st.t * 0.7) * 0.15;
    puff.scale.set(1 + Math.sin(st.t * 1.1) * 0.02, 1 + Math.sin(st.t * 1.3 + 1) * 0.025, 1);
    face.scale.y = blinker(S, dt);
    mouth.scale.set(1, 1 + talkOpen(st.t, st.talk) * 1.8, 1);
  }, height: spec.h ?? 1.6};
}

// Otto, the archive owl: reading glasses, a stamp, and a head that turns further than you would like
function owl(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0x8a6a4a, cl = mixHex(c, 0xf0e0c0, 0.55), cd = shadeHex(c, 0.72);
  k.vox(body, folkGeo(`owlBody${c}`, v => {
    v.blob(0, 0.45, 0, 0.3, 0.38, 0.26, 0.06, c, {bump: 0.15, jit: 0.1});
    v.span(-0.2, 0.18, 0.2, 0.2, 0.68, 0.27, cl, {jit: 0.08});
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) { const x = -0.11 + i * 0.11 + (r % 2) * 0.05, y = 0.25 + r * 0.11; v.box(x - 0.015, y, 0.274, 0.03, 0.012, 0.006, cd, {rz: 0.6}); v.box(x + 0.015, y, 0.274, 0.03, 0.012, 0.006, cd, {rz: -0.6}); }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) v.box(s * 0.06 + (i - 1) * 0.025, 0.06, 0.14, 0.02, 0.05, 0.05, 0xe0a030);
    v.span(-0.36, 0.0, -0.3, 0.36, 0.05, 0.3, 0x5a3a24);
  }), 0, 0, 0);
  const head = k.pivot(body, 0, 0.82, 0);
  k.vox(head, folkGeo(`owlHead${c}|${!!spec.glasses}`, v => {
    v.blob(0, 0.2, 0, 0.32, 0.26, 0.26, 0.06, c, {bump: 0.15, jit: 0.1});
    for (const s of [-1, 1]) { v.span(s * 0.02, 0.06, 0.2, s * 0.26, 0.36, 0.27, cl); v.box(s * 0.22, 0.46, 0, 0.08, 0.14, 0.08, cd, {rz: s * -0.35}); v.box(s * 0.25, 0.53, 0, 0.05, 0.08, 0.05, cd, {rz: s * -0.5}); }
    for (const s of [-1, 1]) { v.box(s * 0.13, 0.22, 0.275, 0.16, 0.16, 0.012, 0xffd860, {glow: 0.3}); v.box(s * 0.13, 0.21, 0.282, 0.08, 0.09, 0.01, 0x1a1008); v.box(s * 0.13 - 0.03, 0.25, 0.288, 0.03, 0.03, 0.006, 0xffffff, {glow: 0.8}); }
    v.box(0, 0.11, 0.3, 0.06, 0.08, 0.06, 0xd8a040, {rx: 0.4}); v.box(0, 0.07, 0.31, 0.03, 0.04, 0.04, 0xc08a30, {rx: 0.4});
    if (spec.glasses) { for (const s of [-1, 1]) ring(v, s * 0.13, 0.22, 0.3, 0.2, 0.2, 0.014, 0x2a2a2e, true); v.box(0, 0.24, 0.3, 0.06, 0.014, 0.01, 0x2a2a2e); }
  }), 0, 0, 0);
  const lids = k.vox(head, folkGeo(`owlLids${c}`, v => { for (const s of [-1, 1]) v.span(s * 0.05, -0.16, 0, s * 0.21, 0, 0.012, cd); }), 0, 0.3, 0.29);
  lids.scale.y = 0.01; lids.visible = false;
  const wl = k.pivot(body, -0.3, 0.68, 0), wr = k.pivot(body, 0.3, 0.68, 0);
  for (const [w, s] of [[wl, -1], [wr, 1]]) k.vox(w, folkGeo(`owlWing${c}${s}`, v => { v.span(-0.04, -0.55, -0.2, 0.04, 0.02, 0.2, c, {jit: 0.1}); for (let i = 0; i < 4; i++) v.span(s * 0.042 - 0.004, -0.52 + i * 0.012, -0.18 + i * 0.09, s * 0.042 + 0.004, -0.36 + i * 0.012, -0.12 + i * 0.09, cd); }), 0, 0, 0);
  if (spec.stamp) k.vox(wr, folkGeo('owlStamp', v => { v.span(-0.03, -0.6, 0.02, 0.03, -0.48, 0.08, 0x7a5030); v.span(-0.1, -0.68, -0.04, 0.1, -0.6, 0.14, 0x5a3a20); v.span(-0.095, -0.7, -0.035, 0.095, -0.68, 0.135, 0xc03020); }), 0, 0, 0.0);
  const S = {blink: 1, bt: -1, turn: 0, turnT: 6 + Math.random() * 6};
  return {root, parts: {body, head, lids, wl, wr}, kit: k, probe: k.probe, animate: (dt, st) => {
    const t = st.t;
    S.turnT -= dt;
    if (S.turnT <= 0) { S.turn = S.turn ? 0 : (Math.random() < 0.5 ? -1 : 1) * 2.6; S.turnT = S.turn ? 1.6 : 7 + Math.random() * 8; }
    head.rotation.y = dampTo(head.rotation.y, S.turn || Math.sin(t * 0.9) * 0.35, S.turn ? 5 : 3, dt);
    head.rotation.z = st.talk ? Math.sin(t * 6) * 0.1 : Math.sin(t * 0.7) * 0.05;
    const b = blinker(S, dt); lids.visible = b < 0.95; lids.scale.y = 1 - b;
    wl.rotation.z = -0.1 - (st.talk ? Math.abs(Math.sin(t * 5)) * 0.6 : 0); wr.rotation.z = 0.1 + (st.talk ? Math.abs(Math.sin(t * 5 + 1)) * 0.6 : 0);
    body.position.y = Math.sin(t * 2) * 0.02;
  }, height: spec.h ?? 1.4};
}

// Slotje, the padlock that guards the books: its shackle lifts like a hat when it talks
function padlock(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0xc8a040;
  k.vox(body, folkGeo(`lock${c}`, v => {
    v.span(-0.32, 0.26, -0.16, 0.32, 0.84, 0.16, c, {jit: 0.06, glow: 0.12});
    v.span(-0.34, 0.3, -0.14, 0.34, 0.8, 0.14, shadeHex(c, 0.82));
    v.span(-0.3, 0.82, -0.14, 0.3, 0.86, 0.14, mixHex(c, 0xffffff, 0.3), {glow: 0.2});
    for (const [x, y] of [[-0.26, 0.32], [0.26, 0.32], [-0.26, 0.78], [0.26, 0.78]]) v.box(x, y, 0.165, 0.035, 0.035, 0.01, shadeHex(c, 0.6));
    for (const s of [-1, 1]) { v.span(s * 0.2 - 0.05, 0.0, -0.06, s * 0.2 + 0.05, 0.27, 0.06, shadeHex(c, 0.7)); v.span(s * 0.2 - 0.07, 0.0, -0.05, s * 0.2 + 0.07, 0.05, 0.12, 0x3a2a1a); }
    for (const s of [-1, 1]) { v.box(s * 0.13, 0.66, 0.166, 0.11, 0.1, 0.01, 0xfff4d0, {glow: 0.4}); v.box(s * 0.13 - s * 0.01, 0.65, 0.172, 0.05, 0.065, 0.01, 0x1a1008); v.box(s * 0.13 - 0.025, 0.675, 0.178, 0.02, 0.02, 0.006, 0xffffff, {glow: 0.8}); }
    v.box(0, 0.74, 0.166, 0.24, 0.02, 0.01, shadeHex(c, 0.55));
  }), 0, 0, 0);
  const mouth = k.vox(body, folkGeo('lockMouth', v => { v.box(0, 0.02, 0, 0.07, 0.07, 0.01, 0x1a1008); v.box(0, -0.04, 0, 0.035, 0.08, 0.01, 0x1a1008); }), 0, 0.46, 0.168);
  const shackle = k.pivot(body, 0, 0.84, 0);
  k.vox(shackle, folkGeo('lockShackle', v => { for (const s of [-1, 1]) v.span(s * 0.2 - 0.045, 0.0, -0.05, s * 0.2 + 0.045, 0.32, 0.05, 0x9a9aa2, {glow: 0.1}); v.span(-0.245, 0.28, -0.05, 0.245, 0.37, 0.05, 0x9a9aa2, {glow: 0.1}); v.span(-0.15, 0.33, -0.052, 0.15, 0.345, 0.052, 0xd8dce4, {glow: 0.3}); }), 0, 0, 0);
  return {root, parts: {body, mouth, shackle}, kit: k, probe: k.probe, animate: (dt, st) => {
    const t = st.t;
    body.position.y = Math.abs(Math.sin(t * (st.talk ? 6 : 1.5))) * 0.05; body.rotation.z = Math.sin(t * 1.2) * 0.05;
    shackle.position.y = 0.84 + (st.talk ? 0.04 + Math.abs(Math.sin(t * 6)) * 0.06 : 0);
    mouth.scale.y = 0.7 + talkOpen(t, st.talk) * 0.8;
  }, height: spec.h ?? 1.4};
}

// ---------------------------------------------------------------- monsters
function wisp(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 1.3, 0), c = spec.color ?? 0xffd36b;
  const core = k.sphere(body, 0.26, c, 0, 0, 0, {basic: true, toneMapped: false});
  const halo = glowSprite(c, 1.8, 0.75); body.add(halo);
  k.sphere(body, 0.05, 0x201408, -0.09, 0.05, 0.22, {basic: true}); k.sphere(body, 0.05, 0x201408, 0.09, 0.05, 0.22, {basic: true});
  const tail = k.cone(body, 0.16, 0.5, c, 0, 0, -0.34, {basic: true, opacity: 0.6, rx: -Math.PI / 2, add: true, depthWrite: false});
  if (spec.tag) { k.box(body, 0.22, 0.14, 0.02, 0xfff1b8, 0.22, -0.24, 0.1, {basic: true}); }
  return {root, parts: {body, core, halo}, kit: k, probe: k.probe, glow: true, animate: (dt, st) => {
    body.position.y = 1.25 + Math.sin(st.t * 2.4) * 0.18;
    const p = 1 + Math.sin(st.t * 9) * 0.06 + (st.attack || 0) * 0.4;
    core.scale.setScalar(0.26 * p); halo.scale.setScalar(1.8 * p * (st.hurt ? 1.5 : 1));
    tail.rotation.z = Math.sin(st.t * 6) * 0.4;
  }, height: 1.6};
}
function imp(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0xff8a5c, dk = spec.dark ?? 0x6a2a1a;
  const legL = k.pivot(body, -0.1, 0.42, 0), legR = k.pivot(body, 0.1, 0.42, 0);
  for (const l of [legL, legR]) { k.box(l, 0.12, 0.42, 0.13, dk, 0, 0, 0, {anchor: 'top'}); k.box(l, 0.14, 0.06, 0.2, 0x2a1a10, 0, -0.44, 0.04); }
  const torso = k.pivot(body, 0, 0.42, 0);
  k.box(torso, 0.4, 0.4, 0.28, c, 0, 0.2, 0);
  if (spec.watch) { k.cyl(torso, 0.11, 0.03, 0xfff4e0, 0, 0.24, 0.15, {rx: Math.PI / 2}); k.box(torso, 0.015, 0.08, 0.01, 0x2a1a10, 0, 0.27, 0.168); }
  if (spec.letter) k.box(torso, 0.34, 0.24, 0.05, 0xf4ecd8, 0, 0.26, -0.17, {rz: 0.2});
  const armL = k.pivot(torso, -0.26, 0.38, 0), armR = k.pivot(torso, 0.26, 0.38, 0);
  for (const a of [armL, armR]) { k.box(a, 0.1, 0.36, 0.1, c, 0, 0, 0, {anchor: 'top'}); k.box(a, 0.12, 0.1, 0.12, dk, 0, -0.38, 0); }
  const head = k.pivot(torso, 0, 0.4, 0);
  k.box(head, 0.44, 0.38, 0.38, c, 0, 0.2, 0);
  k.box(head, 0.08, 0.08, 0.02, 0xfff2a0, -0.1, 0.24, 0.2, {basic: true, toneMapped: false}); k.box(head, 0.08, 0.08, 0.02, 0xfff2a0, 0.1, 0.24, 0.2, {basic: true, toneMapped: false});
  k.box(head, 0.2, 0.04, 0.02, 0x2a0a0a, 0, 0.1, 0.2);
  for (const sx of [-1, 1]) { k.cone(head, 0.06, 0.22, 0xf4e4c0, sx * 0.15, 0.46, 0, {rz: -sx * 0.4}); k.box(head, 0.14, 0.12, 0.04, c, sx * 0.27, 0.24, 0, {rz: sx * 0.5}); }
  const tail = k.pivot(body, 0, 0.5, -0.14); k.box(tail, 0.05, 0.05, 0.4, dk, 0, 0, -0.2);
  return {root, parts: {body, head, torso}, kit: k, probe: k.probe, animate: (dt, st) => {
    const w = st.walk ?? 0, sw = Math.sin(st.t * 14) * w;
    legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8 - (st.attack || 0) * 2;
    body.position.y = Math.abs(Math.sin(st.t * 14)) * 0.06 * w; tail.rotation.y = Math.sin(st.t * 5) * 0.5;
    head.rotation.z = Math.sin(st.t * 3) * 0.08; torso.rotation.x = (st.attack || 0) * 0.4 + (st.hurt || 0) * -0.4;
  }, height: 1.3};
}
function slime(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0x7fe0a4, s = spec.size ?? 1;
  const blob = k.sphere(body, 0.55 * s, c, 0, 0.45 * s, 0, {opacity: 0.72, em: c, ei: 0.25, sy: 0.8});
  k.sphere(body, 0.25 * s, spec.dark ?? 0x2a7a4a, 0, 0.4 * s, 0, {lo: true});
  if (spec.files) for (let i = 0; i < 3; i++) k.box(body, 0.2 * s, 0.26 * s, 0.02, 0xf4ecd8, (i - 1) * 0.18 * s, 0.42 * s, (i % 2 ? -0.1 : 0.12) * s, {ry: i});
  k.sphere(body, 0.07 * s, 0x10241a, -0.16 * s, 0.62 * s, 0.4 * s, {basic: true}); k.sphere(body, 0.07 * s, 0x10241a, 0.16 * s, 0.62 * s, 0.4 * s, {basic: true});
  return {root, parts: {body, blob}, kit: k, probe: k.probe, animate: (dt, st) => {
    const q = Math.sin(st.t * (st.walk ? 9 : 3));
    body.scale.set(1 + q * 0.08 + (st.attack || 0) * 0.3, 1 - q * 0.1 - (st.attack || 0) * 0.2, 1 + q * 0.08);
  }, height: 1.0 * s};
}
const SHADE_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const SHADE_FS = `uniform vec3 uCore; uniform vec3 uRim; uniform float uHit; uniform float uFade; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0); vec3 c = mix(uCore, uRim, f) + uHit * vec3(1.5,1.3,1.1); gl_FragColor = vec4(c, (0.78 + f*0.22) * uFade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function rimMaterial(core, rim) {
  return new THREE.ShaderMaterial({uniforms: {uCore: {value: new THREE.Color(core)}, uRim: {value: new THREE.Color(rim)}, uHit: {value: 0}, uFade: {value: 1}}, vertexShader: SHADE_VS, fragmentShader: SHADE_FS, transparent: true});
}
function shade(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), s = spec.size ?? 1;
  const mat = rimMaterial(spec.core ?? 0x0a0612, spec.color ?? 0xb48cff); k.list.push(mat);
  const pts = [[0.001, 0], [0.42, 0.1], [0.5, 0.6], [0.38, 1.2], [0.28, 1.55], [0.34, 1.8], [0.28, 2.05], [0.001, 2.15]].map(p => new THREE.Vector2(p[0] * s, p[1] * s));
  const cloak = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat); body.add(cloak);
  const eyes = spec.eye ?? 0xe8dcff;
  k.sphere(body, 0.05 * s, eyes, -0.11 * s, 1.85 * s, 0.25 * s, {basic: true, toneMapped: false}); k.sphere(body, 0.05 * s, eyes, 0.11 * s, 1.85 * s, 0.25 * s, {basic: true, toneMapped: false});
  const armL = k.pivot(body, -0.4 * s, 1.45 * s, 0), armR = k.pivot(body, 0.4 * s, 1.45 * s, 0);
  for (const [a, sx] of [[armL, -1], [armR, 1]]) { const m = new THREE.Mesh(CONE, mat); m.scale.set(0.12 * s, 1.0 * s, 0.12 * s); m.position.set(sx * 0.12 * s, -0.4 * s, 0.1 * s); m.rotation.z = Math.PI + sx * 0.3; a.add(m); }
  if (spec.folder) k.box(armR, 0.06, 0.4, 0.3, 0xd04030, 0.1, -0.9 * s, 0.15);
  return {root, parts: {body, cloak}, kit: k, probe: k.probe, rim: mat, animate: (dt, st) => {
    body.position.y = 0.15 + Math.sin(st.t * 1.8) * 0.08;
    armL.rotation.x = Math.sin(st.t * 2) * 0.2 - (st.attack || 0) * 1.4; armR.rotation.x = -Math.sin(st.t * 2) * 0.2 - (st.attack || 0) * 1.4;
    mat.uniforms.uHit.value = st.hurt || 0;
  }, height: 2.2 * s};
}
function golem(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), s = spec.size ?? 1;
  const paper = R.tex?.paper, c = spec.color ?? 0xf0e6cc;
  const legL = k.pivot(body, -0.28 * s, 0.8 * s, 0), legR = k.pivot(body, 0.28 * s, 0.8 * s, 0);
  for (const l of [legL, legR]) k.box(l, 0.34 * s, 0.8 * s, 0.36 * s, c, 0, 0, 0, {anchor: 'top', map: paper});
  const torso = k.pivot(body, 0, 0.8 * s, 0);
  for (let i = 0; i < 4; i++) k.box(torso, (0.95 - i * 0.04) * s, 0.24 * s, 0.6 * s, c, (i % 2 ? 0.03 : -0.03) * s, (0.12 + i * 0.25) * s, 0, {map: paper, ry: (i - 1.5) * 0.06});
  const head = k.pivot(torso, 0, 1.05 * s, 0);
  k.box(head, 0.5 * s, 0.4 * s, 0.42 * s, c, 0, 0.2 * s, 0, {map: paper});
  k.box(head, 0.32 * s, 0.07 * s, 0.02, 0x3a1a10, 0, 0.24 * s, 0.215 * s);
  k.box(head, 0.08 * s, 0.06 * s, 0.02, spec.eye ?? 0xff6a40, -0.1 * s, 0.25 * s, 0.22 * s, {basic: true, toneMapped: false}); k.box(head, 0.08 * s, 0.06 * s, 0.02, spec.eye ?? 0xff6a40, 0.1 * s, 0.25 * s, 0.22 * s, {basic: true, toneMapped: false});
  if (spec.stamp) k.box(head, 0.3 * s, 0.12 * s, 0.02, 0xc03020, 0, 0.36 * s, 0.215 * s);
  const armL = k.pivot(torso, -0.6 * s, 0.9 * s, 0), armR = k.pivot(torso, 0.6 * s, 0.9 * s, 0);
  for (const a of [armL, armR]) { k.box(a, 0.3 * s, 0.85 * s, 0.32 * s, c, 0, 0, 0, {anchor: 'top', map: paper}); k.box(a, 0.36 * s, 0.3 * s, 0.38 * s, 0xd8ccb0, 0, -0.95 * s, 0, {map: paper}); }
  return {root, parts: {body, torso, head}, kit: k, probe: k.probe, animate: (dt, st) => {
    const w = st.walk ?? 0, sw = Math.sin(st.t * 5) * w;
    legL.rotation.x = sw * 0.5; legR.rotation.x = -sw * 0.5;
    armL.rotation.x = -sw * 0.4 - (st.attack || 0) * 2.4; armR.rotation.x = sw * 0.4 - (st.attack || 0) * 2.4;
    torso.rotation.z = Math.sin(st.t * 5) * 0.04 * w; body.position.y = Math.abs(Math.sin(st.t * 5)) * 0.05 * w;
  }, height: 2.4 * s};
}
// bosses and big set pieces
function boss(spec) {
  const kind = spec.kind, k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0);
  let animate, parts = {body};
  if (kind === 'demo') {
    const gold = spec.color ?? 0xe8c060;
    const torso = k.pivot(body, 0, 1.4, 0);
    const shell = k.box(torso, 1.4, 1.5, 0.8, gold, 0, 0.6, 0, {em: 0x6a4a10, ei: 0.6});
    const screen = k.box(torso, 0.9, 0.6, 0.04, 0x1a3a4a, 0, 1.7, 0.42, {em: 0x3fa0d0, ei: 1.2});
    const smile = k.box(torso, 0.5, 0.08, 0.02, 0xffffff, 0, 1.6, 0.45, {basic: true, toneMapped: false});
    const eyeL = k.box(torso, 0.1, 0.14, 0.02, 0xffffff, -0.2, 1.82, 0.45, {basic: true, toneMapped: false}), eyeR = k.box(torso, 0.1, 0.14, 0.02, 0xffffff, 0.2, 1.82, 0.45, {basic: true, toneMapped: false});
    k.box(torso, 1.0, 0.9, 0.04, gold, 0, 1.7, 0.4, {em: 0x6a4a10, ei: 0.6});
    const armL = k.pivot(torso, -0.9, 1.2, 0), armR = k.pivot(torso, 0.9, 1.2, 0);
    for (const a of [armL, armR]) { k.box(a, 0.34, 1.3, 0.34, gold, 0, 0, 0, {anchor: 'top', em: 0x6a4a10, ei: 0.6}); k.box(a, 0.44, 0.4, 0.44, 0xfff1b8, 0, -1.4, 0, {em: 0x8a6a20}); }
    for (const sx of [-0.4, 0.4]) k.box(body, 0.44, 1.4, 0.44, gold, sx, 0.7, 0, {em: 0x6a4a10, ei: 0.6});
    const halo = glowSprite(0xffd36b, 5, 0.35); halo.position.y = 2.4; body.add(halo);
    parts = {body, torso, shell, screen, smile, halo, armL, armR, eyeL, eyeR};
    animate = (dt, st) => {
      torso.rotation.y = Math.sin(st.t * 0.8) * 0.1; body.position.y = Math.sin(st.t * 1.6) * 0.05;
      armL.rotation.x = Math.sin(st.t * 1.2) * 0.2 - (st.attack || 0) * 2.6; armR.rotation.x = -Math.sin(st.t * 1.2) * 0.2 - (st.attack || 0) * 2.6;
      halo.material.opacity = st.exposed ? 0.05 : 0.35 + Math.sin(st.t * 4) * 0.1;
    };
  } else if (kind === 'king') {
    const c = spec.color ?? 0xff8a5c;
    const throne = k.pivot(body, 0, 0, 0);
    k.box(throne, 1.8, 0.7, 1.6, 0x7a2a2a, 0, 0.55, 0); k.box(throne, 1.8, 1.6, 0.25, 0x7a2a2a, 0, 1.6, -0.75);
    for (const [x, z] of [[-0.8, 0.6], [0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]]) k.cyl(throne, 0.28, 0.12, 0x3a2a1a, x, 0.28, z, {rz: Math.PI / 2});
    const cal = k.box(throne, 1.2, 1.0, 0.05, 0xf4ecd8, 0, 2.0, -0.9);
    k.box(throne, 1.0, 0.22, 0.02, 0xc03020, 0, 2.38, -0.93);
    const torso = k.pivot(body, 0, 0.9, 0.1);
    k.box(torso, 1.1, 0.9, 0.8, c, 0, 0.45, 0);
    const head = k.pivot(torso, 0, 0.9, 0);
    k.box(head, 0.8, 0.62, 0.66, c, 0, 0.31, 0);
    k.box(head, 0.12, 0.1, 0.02, 0xfff2a0, -0.18, 0.38, 0.34, {basic: true, toneMapped: false}); k.box(head, 0.12, 0.1, 0.02, 0xfff2a0, 0.18, 0.38, 0.34, {basic: true, toneMapped: false});
    k.box(head, 0.4, 0.06, 0.02, 0x3a0a0a, 0, 0.16, 0.34);
    for (let i = 0; i < 5; i++) k.cone(head, 0.07, 0.24, 0xffd040, -0.3 + i * 0.15, 0.72, 0, {em: 0x8a6010});
    k.box(head, 0.82, 0.1, 0.68, 0xffd040, 0, 0.62, 0, {em: 0x8a6010});
    const armL = k.pivot(torso, -0.65, 0.8, 0), armR = k.pivot(torso, 0.65, 0.8, 0);
    for (const a of [armL, armR]) { k.box(a, 0.24, 0.7, 0.24, c, 0, 0, 0, {anchor: 'top'}); }
    const watch = k.cyl(armR, 0.3, 0.06, 0xfff4e0, 0, -0.85, 0.1, {rx: Math.PI / 2}); k.box(armR, 0.03, 0.22, 0.02, 0x1a1008, 0, -0.78, 0.15);
    parts = {body, torso, head, cal, watch};
    animate = (dt, st) => { torso.rotation.z = Math.sin(st.t * 3) * 0.05; armL.rotation.x = Math.sin(st.t * 6) * 0.4 - (st.attack || 0) * 1.5; armR.rotation.x = -0.6 + Math.sin(st.t * 5) * 0.3; head.rotation.y = Math.sin(st.t * 2) * 0.2; body.rotation.z = st.dizzy ? Math.sin(st.t * 8) * 0.12 : 0; };
  } else if (kind === 'hydra') {
    const c = spec.color ?? 0x7fe0a4;
    k.sphere(body, 1.4, c, 0, 1.0, 0, {opacity: 0.8, em: c, ei: 0.2, sy: 0.7});
    for (let i = 0; i < 5; i++) k.box(body, 0.4, 0.55, 0.03, 0xf4ecd8, -0.8 + i * 0.4, 1.0, 1.2 - Math.abs(i - 2) * 0.2, {ry: i * 0.3 - 0.6});
    const necks = [];
    for (let n = 0; n < 3; n++) {
      const a = -0.7 + n * 0.7, base = k.pivot(body, Math.sin(a) * 0.8, 1.6, Math.cos(a) * 0.5);
      const segs = [];
      let prev = base;
      for (let i = 0; i < 5; i++) { const s = k.pivot(prev, 0, i ? 0.45 : 0, 0); k.sphere(s, 0.28 - i * 0.02, c, 0, 0, 0, {opacity: 0.85, em: c, ei: 0.25, lo: true}); segs.push(s); prev = s; }
      const head = k.pivot(prev, 0, 0.45, 0);
      k.box(head, 0.6, 0.45, 0.7, c, 0, 0.1, 0.15, {em: c, ei: 0.3});
      k.box(head, 0.1, 0.1, 0.02, 0xfff2a0, -0.15, 0.2, 0.51, {basic: true, toneMapped: false}); k.box(head, 0.1, 0.1, 0.02, 0xfff2a0, 0.15, 0.2, 0.51, {basic: true, toneMapped: false});
      k.box(head, 0.4, 0.06, 0.04, 0x0a2a1a, 0, -0.02, 0.5);
      necks.push({base, segs, head, a, alive: true, stump: null});
    }
    parts = {body, necks};
    animate = (dt, st) => {
      necks.forEach((n, j) => {
        n.base.visible = n.alive;
        n.base.rotation.x = 0.35 + Math.sin(st.t * 1.3 + j) * 0.15 - (st.attackHead === j ? st.attack * 0.9 : 0);
        n.base.rotation.z = n.a * 0.5 + Math.sin(st.t * 0.9 + j * 2) * 0.12;
        n.segs.forEach((s, i) => { if (i) s.rotation.x = -0.08 + Math.sin(st.t * 1.7 + j + i * 0.5) * 0.08; });
      });
      body.scale.set(1 + Math.sin(st.t * 2) * 0.03, 1 - Math.sin(st.t * 2) * 0.03, 1);
    };
  } else if (kind === 'fabulant') {
    const c = spec.color ?? 0xe8c27a;
    const mat = rimMaterial(0x140a20, 0xc7a0ff); k.list.push(mat);
    const pts = [[0.001, 0], [0.9, 0.2], [1.2, 1.0], [0.9, 2.2], [0.6, 3.0], [0.75, 3.4], [0.001, 3.6]].map(p => new THREE.Vector2(p[0], p[1]));
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat); body.add(robe);
    const mask = k.pivot(body, 0, 3.55, 0.35);
    k.box(mask, 0.9, 1.0, 0.12, c, 0, 0, 0, {em: 0x8a6010, ei: 0.9});
    k.box(mask, 0.18, 0.1, 0.04, 0x1a0a20, -0.2, 0.12, 0.07); k.box(mask, 0.18, 0.1, 0.04, 0x1a0a20, 0.2, 0.12, 0.07);
    const mouth = k.box(mask, 0.4, 0.08, 0.04, 0x1a0a20, 0, -0.22, 0.07);
    const core = k.sphere(body, 0.35, 0xfff1b8, 0, 2.2, 0.75, {basic: true, toneMapped: false});
    const coreGlow = glowSprite(0xffd36b, 2.4, 0.8); coreGlow.position.set(0, 2.2, 0.8); body.add(coreGlow);
    const ring = k.pivot(body, 0, 2.2, 0);
    const scrolls = [];
    for (let i = 0; i < 8; i++) { const sc = k.pivot(ring, Math.cos(i / 8 * Math.PI * 2) * 2.4, Math.sin(i * 1.3) * 0.5, Math.sin(i / 8 * Math.PI * 2) * 2.4); k.box(sc, 0.18, 0.7, 0.18, 0xf4ecd8, 0, 0, 0, {em: 0x6a5020, ei: 0.5}); k.box(sc, 0.24, 0.1, 0.24, 0xc8a050, 0, 0.36, 0); k.box(sc, 0.24, 0.1, 0.24, 0xc8a050, 0, -0.36, 0); scrolls.push(sc); }
    const armL = k.pivot(body, -1.0, 2.8, 0), armR = k.pivot(body, 1.0, 2.8, 0);
    for (const [a, sx] of [[armL, -1], [armR, 1]]) { const m = new THREE.Mesh(CONE, mat); m.scale.set(0.25, 1.8, 0.25); m.position.set(sx * 0.3, -0.8, 0.2); m.rotation.z = Math.PI + sx * 0.4; a.add(m); }
    parts = {body, mask, mouth, core, coreGlow, ring, scrolls, robe};
    animate = (dt, st) => {
      body.position.y = 0.4 + Math.sin(st.t * 1.1) * 0.25; ring.rotation.y += dt * (st.spin ?? 0.6);
      mask.rotation.z = Math.sin(st.t * 0.7) * 0.08; mouth.scale.y = st.talk ? 1 + Math.abs(Math.sin(st.t * 12)) * 2 : 1;
      armL.rotation.x = Math.sin(st.t * 1.4) * 0.3 - (st.attack || 0) * 1.6; armR.rotation.x = -Math.sin(st.t * 1.4) * 0.3 - (st.attack || 0) * 1.6;
      mat.uniforms.uHit.value = st.hurt || 0;
      coreGlow.material.opacity = st.exposed ? 1 : 0.35;
    };
  } else if (kind === 'worm') {
    const c = spec.color ?? 0xc8b8ff, segs = [];
    for (let i = 0; i < 9; i++) { const s = new THREE.Group(); root.add(s); k.box(s, 0.7, 0.7, 0.5, i ? 0xf4ecd8 : c, 0, 0.45, 0, i ? {map: R.tex?.paper} : {}); if (i) k.box(s, 0.3, 0.14, 0.02, 0xc03020, 0, 0.55, 0.26); segs.push(s); }
    k.box(segs[0], 0.12, 0.12, 0.02, 0xfff2a0, -0.15, 0.6, 0.26, {basic: true, toneMapped: false}); k.box(segs[0], 0.12, 0.12, 0.02, 0xfff2a0, 0.15, 0.6, 0.26, {basic: true, toneMapped: false});
    parts = {body: segs[0], segs};
    animate = (dt, st) => { segs.forEach((s, i) => { s.position.y = Math.abs(Math.sin(st.t * 6 - i * 0.6)) * 0.15; }); };
  }
  return {root, parts, kit: k, probe: k.probe, animate, height: spec.h ?? 3};
}


export function makeModel(spec) {
  const kind = spec.kind ?? 'human';
  if (kind === 'none') { const k = new Kit(spec.probe); return {root: new THREE.Group(), parts: {}, kit: k, probe: k.probe, animate() {}, height: 1}; }
  if (kind === 'human' || kind === 'gnome' || kind === 'kobold' || kind === 'scribe') return makeHuman(spec);
  if (kind === 'wisp') return wisp(spec);
  if (kind === 'imp') return imp(spec);
  if (kind === 'slime') return slime(spec);
  if (kind === 'shade') return shade(spec);
  if (kind === 'golem') return golem(spec);
  if (kind === 'pip') return pip(spec);
  if (kind === 'spark') return spark(spec);
  if (kind === 'cloud') return cloud(spec);
  if (kind === 'owl') return owl(spec);
  if (kind === 'padlock') return padlock(spec);
  return boss(spec);
}

export function disposeModel(m) {
  for (const mat of m.kit?.list || []) mat.dispose?.();
  m.root.parent?.remove(m.root);
}
