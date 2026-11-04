// People and creatures, built from boxes and a few lathes. Every model gets one probe
// uniform: the baked light where it stands, so it sits in the same light as the walls.
// Models face +z. animate(dt, st) poses them: st = {t, walk (0..1), talk, attack (0..1), hurt (0..1)}.
import * as THREE from 'three';
import {probedMaterial} from './batch.js';
import {R} from './render.js';

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
}

export function glowSprite(hex, size = 1, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: R.glow, color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false}));
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- people
export function makeHuman(spec = {}) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const s = spec.scale ?? 1;
  body.scale.setScalar(s);
  const skin = spec.skin ?? 0xe8b896, coat = spec.coat ?? 0x3d5a80, pants = spec.pants ?? 0x2a2a34, shoes = spec.shoes ?? 0x241a14, hair = spec.hair ?? 0x3a2a1c;
  const hips = k.pivot(body, 0, 0.86, 0);
  const legL = k.pivot(hips, -0.11, 0, 0), legR = k.pivot(hips, 0.11, 0, 0);
  for (const leg of [legL, legR]) {
    k.box(leg, 0.17, 0.78, 0.19, pants, 0, 0, 0, {anchor: 'top'});
    k.box(leg, 0.19, 0.1, 0.27, shoes, 0, -0.81, 0.04);
  }
  const torso = k.pivot(body, 0, 0.86, 0);
  k.box(torso, 0.5, 0.6, 0.29, coat, 0, 0.3, 0);
  if (spec.robe) k.box(torso, 0.56, 0.62, 0.34, spec.robe, 0, -0.18, 0);
  else if (spec.long) k.box(torso, 0.54, 0.3, 0.32, coat, 0, -0.05, 0);
  if (spec.shirt) k.box(torso, 0.16, 0.3, 0.02, spec.shirt, 0, 0.42, 0.15);
  if (spec.tie) k.box(torso, 0.06, 0.28, 0.02, spec.tie, 0, 0.38, 0.162);
  if (spec.badge) { k.box(torso, 0.1, 0.13, 0.02, 0xf4f0e8, 0.13, 0.33, 0.155); k.box(torso, 0.02, 0.16, 0.01, 0xd03030, 0.07, 0.46, 0.15, {rz: 0.4}); }
  if (spec.headset) { /* added on the head below */ }
  const armL = k.pivot(torso, -0.33, 0.56, 0), armR = k.pivot(torso, 0.33, 0.56, 0);
  for (const arm of [armL, armR]) {
    k.box(arm, 0.13, 0.56, 0.15, spec.sleeve ?? coat, 0, 0, 0, {anchor: 'top'});
    k.box(arm, 0.12, 0.12, 0.13, skin, 0, -0.6, 0);
  }
  const head = k.pivot(torso, 0, 0.6, 0);
  k.box(head, 0.12, 0.08, 0.12, skin, 0, 0.02, 0);
  k.box(head, 0.34, 0.37, 0.33, skin, 0, 0.24, 0);
  const eye = spec.eyes ?? 0x1a1410;
  k.box(head, 0.05, 0.06, 0.02, eye, -0.075, 0.27, 0.168); k.box(head, 0.05, 0.06, 0.02, eye, 0.075, 0.27, 0.168);
  if (spec.smile) k.box(head, 0.12, 0.03, 0.02, 0xfff4e0, 0, 0.16, 0.168);
  else k.box(head, 0.1, 0.025, 0.02, 0x8a5040, 0, 0.16, 0.168);
  if (spec.glasses) { k.box(head, 0.3, 0.02, 0.02, 0x222222, 0, 0.29, 0.172); for (const gx of [-0.075, 0.075]) k.box(head, 0.09, 0.08, 0.01, 0xcfe6ff, gx, 0.27, 0.176, {opacity: 0.45}); }
  if (spec.beard) k.box(head, 0.3, 0.14, 0.06, spec.beard, 0, 0.1, 0.16);
  const hs = spec.hairStyle ?? 'short';
  if (hs !== 'bald') {
    k.box(head, 0.36, 0.1, 0.35, hair, 0, 0.44, 0);
    k.box(head, 0.36, hs === 'long' ? 0.42 : 0.24, 0.06, hair, 0, hs === 'long' ? 0.2 : 0.32, -0.16);
    if (hs === 'long' || hs === 'bob') { k.box(head, 0.05, 0.28, 0.3, hair, -0.18, 0.28, -0.01); k.box(head, 0.05, 0.28, 0.3, hair, 0.18, 0.28, -0.01); }
    if (hs === 'bun') k.box(head, 0.16, 0.14, 0.14, hair, 0, 0.5, -0.1);
    if (hs === 'curly') k.box(head, 0.42, 0.18, 0.4, hair, 0, 0.45, -0.01);
    if (hs === 'slick') k.box(head, 0.37, 0.05, 0.36, hair, 0, 0.47, 0.01, {em: 0x222222});
  }
  const hat = spec.hat;
  if (hat === 'cap') { k.box(head, 0.38, 0.1, 0.37, spec.hatColor ?? 0x3a3a44, 0, 0.47, 0); k.box(head, 0.3, 0.03, 0.14, spec.hatColor ?? 0x3a3a44, 0, 0.43, 0.22); }
  if (hat === 'beret') k.box(head, 0.42, 0.09, 0.4, spec.hatColor ?? 0x8a2a2a, 0.03, 0.48, 0, {rz: -0.12});
  if (hat === 'tophat') { k.box(head, 0.46, 0.03, 0.44, spec.hatColor ?? 0x1a1a1e, 0, 0.45, 0); k.box(head, 0.3, 0.34, 0.3, spec.hatColor ?? 0x1a1a1e, 0, 0.63, 0); }
  if (hat === 'hood') { k.box(head, 0.42, 0.42, 0.42, spec.hatColor ?? coat, 0, 0.27, -0.04); }
  if (hat === 'quill') { k.box(head, 0.4, 0.12, 0.38, spec.hatColor ?? 0x2a2440, 0, 0.47, 0); k.box(head, 0.03, 0.42, 0.08, 0xf2ead8, 0.14, 0.68, -0.05, {rz: -0.35}); }
  if (spec.headset) { k.box(head, 0.4, 0.04, 0.06, 0x2a2a2a, 0, 0.47, 0); k.box(head, 0.05, 0.1, 0.1, 0x2a2a2a, -0.19, 0.27, 0); k.box(head, 0.03, 0.03, 0.14, 0x2a2a2a, -0.18, 0.18, 0.08); }
  // held items
  const hand = (arm, kind) => {
    const g = k.pivot(arm, 0, -0.62, 0.02);
    if (kind === 'folder') k.box(g, 0.05, 0.36, 0.28, 0xe8c060, 0, -0.05, 0.08, {em: 0xffb030, ei: 0.7});
    if (kind === 'umbrella') { k.box(g, 0.03, 0.9, 0.03, 0x2a2030, 0, -0.38, 0.05); k.box(g, 0.07, 0.07, 0.12, 0x5a3a2a, 0, 0.06, 0.08); }
    if (kind === 'clipboard') k.box(g, 0.24, 0.32, 0.03, 0xa07a50, 0, -0.12, 0.1);
    if (kind === 'keys') { k.box(g, 0.1, 0.1, 0.02, 0xc8a050, 0, -0.08, 0.05); }
    if (kind === 'suitcase') { k.box(g, 0.48, 0.36, 0.16, 0xc85030, 0, -0.22, 0.02); k.box(g, 0.12, 0.05, 0.03, 0x2a2020, 0, 0.0, 0.02); }
    if (kind === 'ruler') k.box(g, 0.04, 1.4, 0.04, 0xe8d060, 0, -0.1, 0.1);
    if (kind === 'horn') { k.cone(g, 0.18, 0.5, 0xc8a050, 0, 0.1, 0.22, {rx: -Math.PI / 2}); }
    if (kind === 'stamp') { k.box(g, 0.06, 0.18, 0.06, 0x6a4a2a, 0, -0.05, 0.08); k.box(g, 0.18, 0.06, 0.18, 0x3a7a4a, 0, -0.17, 0.08); }
    if (kind === 'book') k.box(g, 0.08, 0.3, 0.24, 0x6a2a2a, 0, -0.06, 0.1);
    if (kind === 'mug') k.cyl(g, 0.06, 0.12, 0xf4f0e8, 0, -0.04, 0.1);
    return g;
  };
  const heldL = spec.holdL ? hand(armL, spec.holdL) : null, heldR = spec.holdR ? hand(armR, spec.holdR) : null;
  if (spec.extra) spec.extra(k, {body, torso, head, armL, armR});
  const parts = {body, hips, torso, head, armL, armR, legL, legR, heldL, heldR};
  const baseY = body.position.y;
  const animate = (dt, st) => {
    const t = st.t, w = st.walk ?? 0, sw = Math.sin(t * (st.run ? 12 : 8.5)) * w;
    legL.rotation.x = sw * 0.75; legR.rotation.x = -sw * 0.75;
    armL.rotation.x = -sw * 0.6 + (st.armL ?? 0); armR.rotation.x = sw * 0.6 + (st.armR ?? 0);
    armL.rotation.z = -0.05; armR.rotation.z = 0.05;
    body.position.y = baseY + Math.abs(Math.sin(t * (st.run ? 12 : 8.5))) * 0.04 * w + Math.sin(t * 1.7) * 0.006;
    torso.rotation.y = Math.sin(t * 8.5) * 0.06 * w;
    head.rotation.y = st.look ?? Math.sin(t * 0.6) * 0.12 * (1 - w);
    head.rotation.x = st.talk ? Math.sin(t * 9) * 0.05 : 0;
    if (st.talk) { armR.rotation.x = -0.5 + Math.sin(t * 4) * 0.25; armR.rotation.z = 0.25; }
    if (st.attack) { armR.rotation.x = -1.6 + st.attack * 2.2; }
    if (st.wave) { armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.3; armR.rotation.x = 0; }
    body.rotation.x = st.hurt ? -st.hurt * 0.3 : 0;
  };
  return {root, parts, kit: k, probe: k.probe, animate, height: 1.85 * s};
}

// ---------------------------------------------------------------- creatures
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
function pip(spec) {
  const k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0);
  const core = k.sphere(body, 0.13, 0xffcf6a, 0, 0, 0, {basic: true, sy: 1.15});
  const tip = k.cone(body, 0.09, 0.22, 0xff9a3a, 0, 0.17, 0, {basic: true});
  const halo = glowSprite(0xffa040, 0.9, 0.55); body.add(halo);
  k.sphere(body, 0.025, 0x2a1406, -0.045, 0.02, 0.115, {basic: true}); k.sphere(body, 0.025, 0x2a1406, 0.045, 0.02, 0.115, {basic: true});
  return {root, parts: {body, core, halo}, kit: k, probe: k.probe, glow: true, animate: (dt, st) => {
    body.position.y = Math.sin(st.t * 3.1) * 0.06;
    tip.rotation.z = Math.sin(st.t * 7) * 0.25; tip.scale.y = 0.22 * (1 + Math.sin(st.t * 11) * 0.15);
    halo.scale.setScalar(0.9 * (1 + Math.sin(st.t * 9) * 0.08) * (st.talk ? 1.25 : 1));
  }, height: 0.4};
}
// generic small fantasy folk: owl, kobold, gnome, spark, cloud, padlock
function folk(spec) {
  const kind = spec.kind, k = new Kit(spec.probe), root = new THREE.Group(), body = k.pivot(root, 0, 0, 0), c = spec.color ?? 0x8a7a6a;
  let head = body, animate;
  if (kind === 'owl') {
    k.box(body, 0.6, 0.75, 0.5, c, 0, 0.42, 0);
    k.box(body, 0.44, 0.5, 0.06, 0xe8d8b8, 0, 0.42, 0.25);
    head = k.pivot(body, 0, 0.8, 0);
    k.box(head, 0.62, 0.46, 0.5, c, 0, 0.2, 0);
    for (const sx of [-1, 1]) { k.box(head, 0.2, 0.2, 0.03, 0xffe08a, sx * 0.14, 0.22, 0.26); k.box(head, 0.09, 0.09, 0.02, 0x1a1008, sx * 0.14, 0.22, 0.28); k.box(head, 0.1, 0.16, 0.1, c, sx * 0.22, 0.5, 0, {rz: sx * -0.3}); }
    k.cone(head, 0.05, 0.12, 0xd8a040, 0, 0.1, 0.3, {rx: Math.PI / 2 + 0.8});
    if (spec.glasses) k.box(head, 0.46, 0.02, 0.02, 0x222222, 0, 0.3, 0.3);
    const wl = k.pivot(body, -0.32, 0.7, 0), wr = k.pivot(body, 0.32, 0.7, 0);
    k.box(wl, 0.08, 0.6, 0.42, c, 0, 0, 0, {anchor: 'top'}); k.box(wr, 0.08, 0.6, 0.42, c, 0, 0, 0, {anchor: 'top'});
    if (spec.stamp) k.box(wr, 0.22, 0.12, 0.22, 0xc03020, 0, -0.65, 0.1);
    animate = (dt, st) => { head.rotation.y = Math.sin(st.t * 0.9) * 0.4; head.rotation.z = st.talk ? Math.sin(st.t * 6) * 0.1 : 0; wl.rotation.z = -0.1 - (st.talk ? Math.abs(Math.sin(st.t * 5)) * 0.6 : 0); wr.rotation.z = 0.1 + (st.talk ? Math.abs(Math.sin(st.t * 5 + 1)) * 0.6 : 0); body.position.y = Math.sin(st.t * 2) * 0.02; };
  } else if (kind === 'spark') {
    const core = k.sphere(body, 0.3, c, 0, 1.0, 0, {basic: true, toneMapped: false, sy: 1.25});
    const halo = glowSprite(c, 1.6, 0.8); halo.position.y = 1.0; body.add(halo);
    const tip = k.cone(body, 0.2, 0.45, c, 0, 1.45, 0, {basic: true, toneMapped: false});
    k.sphere(body, 0.045, 0x2a1406, -0.1, 1.05, 0.27, {basic: true}); k.sphere(body, 0.045, 0x2a1406, 0.1, 1.05, 0.27, {basic: true});
    const dim = spec.dim ?? 0;
    animate = (dt, st) => { const p = 1 + Math.sin(st.t * 8) * 0.08; core.scale.set(0.3 * p, 0.37 * p, 0.3 * p); tip.rotation.z = Math.sin(st.t * 6) * 0.3; halo.material.opacity = 0.8 * (st.dim ? 0.35 : 1); body.position.y = Math.sin(st.t * 2.2) * 0.08; };
    void dim;
  } else if (kind === 'cloud') {
    for (const [x, y, z, r] of [[0, 1.2, 0, 0.45], [-0.4, 1.1, 0, 0.32], [0.4, 1.12, 0.02, 0.34], [0.15, 1.45, -0.05, 0.3], [-0.2, 1.4, 0.05, 0.28]]) k.sphere(body, r, c, x, y, z, {em: 0x404858, ei: 0.4});
    k.box(body, 0.07, 0.07, 0.02, 0x1a2030, -0.12, 1.26, 0.44); k.box(body, 0.07, 0.07, 0.02, 0x1a2030, 0.12, 1.26, 0.44);
    k.box(body, 0.16, 0.03, 0.02, 0x1a2030, 0, 1.12, 0.45);
    animate = (dt, st) => { body.position.y = Math.sin(st.t * 1.5) * 0.12; body.rotation.y = Math.sin(st.t * 0.7) * 0.15; };
  } else if (kind === 'padlock') {
    k.box(body, 0.6, 0.55, 0.3, c, 0, 0.55, 0, {em: 0x2a2010, ei: 0.3});
    k.box(body, 0.08, 0.45, 0.1, 0x9a9aa2, -0.2, 1.0, 0); k.box(body, 0.08, 0.45, 0.1, 0x9a9aa2, 0.2, 1.0, 0); k.box(body, 0.48, 0.08, 0.1, 0x9a9aa2, 0, 1.2, 0);
    k.box(body, 0.08, 0.14, 0.02, 0x1a1008, 0, 0.5, 0.16);
    k.box(body, 0.06, 0.06, 0.02, 0xfff4d0, -0.12, 0.7, 0.16, {basic: true}); k.box(body, 0.06, 0.06, 0.02, 0xfff4d0, 0.12, 0.7, 0.16, {basic: true});
    for (const sx of [-1, 1]) k.box(body, 0.08, 0.3, 0.08, c, sx * 0.14, 0.13, 0);
    animate = (dt, st) => { body.position.y = Math.abs(Math.sin(st.t * (st.talk ? 6 : 1.5))) * 0.05; body.rotation.z = Math.sin(st.t * 1.2) * 0.05; };
  } else {
    // kobold / gnome / scribe: a small person
    const h = makeHuman({...spec, scale: spec.scale ?? 0.72});
    h.root.traverse(o => o.material && h.kit.list.push(o.material));
    return h;
  }
  return {root, parts: {body, head}, kit: k, probe: k.probe, animate, height: spec.h ?? 1.4};
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
  if (kind === 'human') return makeHuman(spec);
  if (kind === 'wisp') return wisp(spec);
  if (kind === 'imp') return imp(spec);
  if (kind === 'slime') return slime(spec);
  if (kind === 'shade') return shade(spec);
  if (kind === 'golem') return golem(spec);
  if (kind === 'pip') return pip(spec);
  if (['owl', 'spark', 'cloud', 'padlock', 'kobold', 'gnome', 'scribe'].includes(kind)) return folk(spec);
  return boss(spec);
}

export function disposeModel(m) {
  for (const mat of m.kit?.list || []) mat.dispose?.();
  m.root.parent?.remove(m.root);
}
