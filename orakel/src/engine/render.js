// Renderer, scene, shared materials, torch flames and the pool of dynamic lights.
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {makeTextures, glowTexture} from './textures.js';
import {bakedMaterial, SHARED_UNIFORMS} from './batch.js';
import {IS_TOUCH} from '../core/util.js';

export const R = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null,
  tex: null, mats: null, glow: null, quality: 'high',
  flames: null, pool: [], lantern: null, sources: [], dynamic: new Set(),
  time: 0,
};

export function initRenderer(container, quality = 'high') {
  const renderer = new THREE.WebGLRenderer({antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 140);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.fog = new THREE.FogExp2(0x0b0907, 0.045);
  scene.background = new THREE.Color(0x0b0907);
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  const hemi = new THREE.HemisphereLight(0x8a96b8, 0x2a1d12, 0.22);
  scene.add(hemi);
  // first-person hands live in their own little scene, drawn on top with their own light
  const viewScene = new THREE.Scene(), viewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  viewScene.add(viewCamera);
  const viewAmb = new THREE.AmbientLight(0xffffff, 0.5), viewHemi = new THREE.HemisphereLight(0xfff0d8, 0x3a2a1a, 0.6), viewLamp = new THREE.PointLight(0xffc98a, 2.5, 3, 1.5);
  viewLamp.position.set(-0.25, -0.1, -0.35);
  viewScene.add(viewAmb, viewHemi); viewCamera.add(viewLamp);
  Object.assign(R, {renderer, scene, camera, hemi, viewScene, viewCamera, viewAmb, viewLamp});
  R.tex = makeTextures();
  R.glow = glowTexture();
  R.mats = makeMaterials(R.tex);
  // a fixed pool of point lights: three.js recompiles shaders when the light count changes
  const n = quality === 'low' ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffa860, 0, 10, 2);
    l.userData = {src: null, cur: 0};
    scene.add(l);
    R.pool.push(l);
  }
  R.lantern = new THREE.PointLight(0xffc98a, 0, 13, 1.6);
  scene.add(R.lantern);
  setQuality(quality);
  window.addEventListener('resize', resize);
  resize();
  return R;
}

export function setBrightness(b) { if (R.renderer) R.renderer.toneMappingExposure = 1.3 * b; }

export function setQuality(q) {
  R.quality = q;
  const dpr = Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : IS_TOUCH ? 1.5 : 1.75);
  R.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.85) : dpr);
  if (q === 'high' && !R.composer) {
    const composer = new EffectComposer(R.renderer);
    composer.addPass(new RenderPass(R.scene, R.camera));
    const vp = new RenderPass(R.viewScene, R.viewCamera); vp.clear = false; vp.clearDepth = true;
    composer.addPass(vp);
    R.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    composer.addPass(R.bloom);
    composer.addPass(new OutputPass());
    R.composer = composer;
  }
  resize();
}

export function resize() {
  if (!R.renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  R.camera.updateProjectionMatrix();
  R.viewCamera.aspect = w / h;
  R.viewCamera.updateProjectionMatrix();
  if (R.composer) R.composer.setSize(w, h);
  if (R.flames) R.flames.material.uniforms.uScale.value = R.renderer.domElement.height / (2 * Math.tan(R.camera.fov * Math.PI / 360));
}

function makeMaterials(tex) {
  const mats = {};
  for (const [name, t] of Object.entries(tex)) mats[name] = bakedMaterial({map: t});
  mats.plain = bakedMaterial({map: tex.noise});
  mats.circuit = bakedMaterial({map: tex.circuit, emissive: 0xffffff, emissiveMap: tex.circuit, emissiveIntensity: 0.55});
  mats.gold = bakedMaterial({map: tex.gold, emissive: 0x6a4a10, emissiveIntensity: 0.4});
  const wt = tex.noise.clone(); wt.needsUpdate = true; wt.repeat.set(1, 1);
  mats.water = bakedMaterial({map: wt, transparent: true, opacity: 0.72, depthWrite: false, emissive: 0x0a2a3a, emissiveIntensity: 0.6});
  mats.water.userData.drift = wt;
  return mats;
}

// ---- torch flames: one Points object per floor, flickering in the shader ----
const FLAME_VS = `
attribute float aSize; attribute float aPhase; attribute vec3 aColor;
uniform float uTime; uniform float uScale;
varying vec3 vColor; varying float vFlick;
void main(){
  float f = 0.82 + 0.12 * sin(uTime * 11.0 + aPhase) + 0.08 * sin(uTime * 23.7 + aPhase * 1.7);
  vFlick = f; vColor = aColor;
  vec3 p = position; p.y += 0.03 * sin(uTime * 7.0 + aPhase);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * f * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FS = `
varying vec3 vColor; varying float vFlick;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(vec2(p.x * (1.5 + p.y * 0.7), (p.y + 0.15) * 0.85));
  float a = smoothstep(1.0, 0.0, r);
  vec3 core = mix(vColor, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 0.0, r));
  gl_FragColor = vec4(core * (1.4 + vFlick), a * a);
}`;

export function setFlames(list) {
  if (R.flames) { R.scene.remove(R.flames); R.flames.geometry.dispose(); R.flames = null; }
  if (!list.length) return;
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
  const c = new THREE.Color();
  list.forEach((f, i) => {
    pos.set([f.x, f.y, f.z], i * 3);
    c.set(f.color ?? 0xffa860);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 0.42 * (f.s ?? 1);
    phase[i] = (i * 2.399) % 6.283;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: {uTime: SHARED_UNIFORMS.uTime, uScale: {value: 600}},
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  R.flames = new THREE.Points(g, m);
  R.flames.frustumCulled = false;
  R.scene.add(R.flames);
  resize();
}

// ---- dynamic lights: the nearest light sources borrow a real PointLight ----
// sources: static {x,y,z,hex,i,range,kind} from the floor; dynamic ones are added by entities
export function setLightSources(list) { R.sources = list; for (const l of R.pool) { l.userData.src = null; l.userData.cur = 0; l.intensity = 0; } }
export function addDynamicLight(src) { R.dynamic.add(src); return src; }
export function removeDynamicLight(src) { R.dynamic.delete(src); }

let poolT = 0;
export function updateLights(dt, fx, fz) {
  poolT -= dt;
  if (poolT <= 0) {
    poolT = 0.25;
    const all = [];
    for (const s of R.sources) { const d = Math.hypot(s.x - fx, s.z - fz); if (d < 22) all.push([d - (s.kind === 'fire' ? 3 : 0), s]); }
    for (const s of R.dynamic) { if (s.on === false) continue; const d = Math.hypot(s.x - fx, s.z - fz); if (d < 26) all.push([d - 6 - (s.prio || 0), s]); }
    all.sort((a, b) => a[0] - b[0]);
    const want = all.slice(0, R.pool.length).map(a => a[1]);
    // keep lights that stay in the set on their slot, so they do not pop
    const free = [];
    for (const l of R.pool) if (!want.includes(l.userData.src)) { l.userData.next = null; free.push(l); } else l.userData.next = l.userData.src;
    for (const s of want) if (!R.pool.some(l => l.userData.next === s)) { const l = free.shift(); if (l) l.userData.next = s; }
  }
  const t = R.time;
  for (const l of R.pool) {
    const u = l.userData;
    if (u.next !== u.src) {
      // fade out the old source before taking the new one
      u.cur = Math.max(0, u.cur - dt * 6);
      if (u.cur <= 0.01) { u.src = u.next; u.cur = 0; }
    } else if (u.src) u.cur = Math.min(1, u.cur + dt * 4);
    const s = u.src;
    if (!s) { l.intensity = 0; continue; }
    l.position.set(s.x, s.y, s.z);
    if (s.hex !== undefined && l.userData.hex !== s.hex) { l.color.set(s.hex); l.userData.hex = s.hex; }
    l.distance = s.range ?? 9;
    const flick = s.kind === 'torch' || s.kind === 'fire' || s.flicker ? 0.85 + 0.1 * Math.sin(t * 11 + s.x) + 0.06 * Math.sin(t * 27 + s.z) : 1;
    l.intensity = (s.dyn ?? (s.kind === 'torch' ? 5 : s.kind === 'fire' ? 9 : 4)) * (s.i ?? 1) * flick * u.cur;
  }
}

export function animateMaterials(dt) {
  const wt = R.mats?.water?.userData.drift;
  if (wt) { wt.offset.x = (wt.offset.x + dt * 0.03) % 1; wt.offset.y = (wt.offset.y + dt * 0.017) % 1; }
}

export function render() {
  if (R.composer && R.quality === 'high') { R.composer.render(); return; }
  const r = R.renderer;
  r.autoClear = false;
  r.clear();
  r.render(R.scene, R.camera);
  r.clearDepth();
  r.render(R.viewScene, R.viewCamera);
}
