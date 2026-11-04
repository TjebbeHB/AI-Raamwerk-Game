// Pooled point-sprite particles: one additive system (sparks, magic, embers) and one
// normal system (dust, paper scraps, splashes).
import * as THREE from 'three';
import {R} from './render.js';

const VS = `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale;
varying vec3 vColor; varying float vAlpha;
void main(){ vColor = aColor; vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS_ADD = `varying vec3 vColor; varying float vAlpha;
void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p); if (d > 1.0) discard; float a = (1.0 - d); gl_FragColor = vec4(vColor * a * vAlpha * 1.6, 1.0); }`;
const FS_NORM = `varying vec3 vColor; varying float vAlpha;
void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = max(abs(p.x), abs(p.y)); if (d > 1.0) discard; gl_FragColor = vec4(vColor, vAlpha); }`;

class System {
  constructor(n, additive) {
    this.n = n; this.free = []; this.parts = [];
    for (let i = n - 1; i >= 0; i--) this.free.push(i);
    this.pos = new Float32Array(n * 3).fill(-9999); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = {value: 600};
    const m = new THREE.ShaderMaterial({uniforms: {uScale: this.uScale}, vertexShader: VS, fragmentShader: additive ? FS_ADD : FS_NORM,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending});
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  spawn(p) {
    const i = this.free.pop();
    if (i === undefined) return null;
    p.i = i; p.age = 0;
    this.parts.push(p);
    return p;
  }
  update(dt) {
    const {pos, col, size, alpha} = this;
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k];
      p.age += dt;
      const i = p.i;
      if (p.age >= p.life) { pos[i * 3 + 1] = -9999; alpha[i] = 0; this.free.push(i); this.parts[k] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= (p.g ?? 0) * dt;
      const dr = Math.exp(-(p.drag ?? 0) * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const t = p.age / p.life;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r; col[i * 3 + 1] = p.gg; col[i * 3 + 2] = p.b;
      size[i] = p.s0 + (p.s1 - p.s0) * t;
      alpha[i] = (p.a ?? 1) * (t < 0.1 ? t / 0.1 : 1 - Math.pow((t - 0.1) / 0.9, p.fade ?? 1.5));
    }
    const g = this.points.geometry;
    for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) g.attributes[a].needsUpdate = true;
  }
  clear() { for (const p of this.parts) { this.pos[p.i * 3 + 1] = -9999; this.alpha[p.i] = 0; this.free.push(p.i); } this.parts.length = 0; }
}

const tmp = new THREE.Color();
export const FX = {
  add: null, norm: null,
  init() {
    this.add = new System(2600, true); this.norm = new System(1200, false);
    R.scene.add(this.add.points); R.scene.add(this.norm.points);
  },
  setScale(v) { if (this.add) { this.add.uScale.value = v; this.norm.uScale.value = v; } },
  // one particle: o = {x,y,z, vx,vy,vz, life, s0, s1, color, g, drag, additive, floor, a}
  one(o) {
    tmp.set(o.color ?? 0xffffff);
    const sys = o.additive === false ? this.norm : this.add;
    return sys.spawn({x: o.x, y: o.y, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, life: o.life ?? 0.8, s0: o.s0 ?? o.s ?? 0.2, s1: o.s1 ?? 0, r: tmp.r, gg: tmp.g, b: tmp.b, g: o.g, drag: o.drag, floor: o.floor, a: o.a, fade: o.fade});
  },
  burst(x, y, z, n, o = {}) {
    const sp = o.speed ?? 3;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * (o.flat ? 0.15 : 0.9), v = sp * (0.4 + Math.random() * 0.8);
      this.one({...o, x: x + (Math.random() - 0.5) * (o.spread ?? 0.2), y: y + (Math.random() - 0.5) * (o.spread ?? 0.2), z: z + (Math.random() - 0.5) * (o.spread ?? 0.2),
        vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + (o.up ?? 0), vz: Math.sin(a) * Math.cos(e) * v,
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.7), color: Array.isArray(o.color) ? o.color[k % o.color.length] : o.color});
    }
  },
  ring(x, y, z, r, n, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, v = o.speed ?? 6;
      this.one({...o, x: x + Math.cos(a) * r, y, z: z + Math.sin(a) * r, vx: Math.cos(a) * v, vy: o.up ?? 0.3, vz: Math.sin(a) * v, color: Array.isArray(o.color) ? o.color[k % o.color.length] : o.color});
    }
  },
  update(dt) { this.add?.update(dt); this.norm?.update(dt); },
  clear() { this.add?.clear(); this.norm?.clear(); },
};
