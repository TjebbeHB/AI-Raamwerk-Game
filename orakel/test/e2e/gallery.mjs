// A photo studio for the people of Dalwijk: renders the whole cast and many player looks in good
// light and screenshots them (lineups front and three-quarter, the folk of the Gewelf, face
// close-ups, every hair style and top, gestures). Bundles its own small page from the real model code.
//   node orakel/test/e2e/gallery.mjs                -> orakel/test/e2e/shots/gallery-*.png
//   node orakel/test/e2e/gallery.mjs faces joop     -> only scenes whose name contains one of the words
//   LOOK='{"hair":"afro","top":"hivis"}' node orakel/test/e2e/gallery.mjs custom   -> any look: front, three-quarter, face
// Env: SHOTS (dir), PLAYWRIGHT, LOOK. Needs no game build.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {SHOTS, launch} from './_env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);

const ENTRY = `
import * as THREE from 'three';
import {R} from '../../src/engine/render.js';
import {glowTexture} from '../../src/engine/textures.js';
import {makeModel} from '../../src/engine/models.js';
import {CAST_DEFS} from '../../src/content/cast.js';
import {randomLook, SKIN_TONES, LOOK_ENUMS} from '../../src/content/looks.js';
import {makeRng} from '../../src/core/util.js';

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = '0'; document.body.append(renderer.domElement);
R.glow = glowTexture();
const PROBE = () => ({value: new THREE.Color(0.42, 0.38, 0.34)});
const HUMANS = Object.entries(CAST_DEFS).filter(([, c]) => c.model && (!c.model.kind || c.model.kind === 'gnome' || c.model.kind === 'kobold'));
const FOLK = Object.entries(CAST_DEFS).filter(([, c]) => c.model && c.model.kind && !['gnome', 'kobold'].includes(c.model.kind));

function studio(bg = 0x2a2420) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x3a2a1a, 0.9));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 0.9); rim.position.set(-4, 3, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({color: 0x6a5a4a}));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  return scene;
}
function pose(m, t = 1.3, st = {}) { for (let i = 0; i < 12; i++) m.animate(1 / 60, {t: t + i / 60, walk: 0, ...st}); }
function place(scene, spec, x, z, yaw = 0, st) {
  const m = makeModel({...spec, probe: PROBE()});
  m.root.position.set(x, spec.kind === 'pip' ? 1.3 : 0, z); m.root.rotation.y = yaw; scene.add(m.root);
  pose(m, 1.3, st);
  return m;
}
function label(text, x, y) {
  const d = document.createElement('div');
  Object.assign(d.style, {position: 'fixed', left: x + 'px', top: y + 'px', transform: 'translateX(-50%)', font: '600 12px system-ui', color: '#f4e8d0', textShadow: '0 1px 2px #000', whiteSpace: 'nowrap'});
  d.textContent = text; d.className = 'lbl'; document.body.append(d);
}
function project(cam, v) { const p = v.clone().project(cam); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
function clearLabels() { document.querySelectorAll('.lbl').forEach(e => e.remove()); }
function shoot(scene, cam, models = []) {
  renderer.render(scene, cam);
  let calls = 0; scene.traverse(o => { if ((o.isMesh || o.isSprite) && o.visible) calls++; });
  return {calls, perModel: models.length ? Math.round(calls / models.length) : 0};
}
// one row of people with name labels
function lineup(list, {yaw = 0, gap = 1.0, h = 1.05, names = true} = {}) {
  clearLabels();
  const scene = studio(), ms = [];
  list.forEach(([name, spec, turn], i) => { ms.push([name, place(scene, spec, (i - (list.length - 1) / 2) * gap, 0, turn ?? yaw)]); });
  const width = list.length * gap, cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 100);
  const hf = 2 * Math.atan(Math.tan(14 * Math.PI / 180) * cam.aspect), d = Math.max(4.2, (width / 2 + 0.3) / Math.tan(hf / 2));
  cam.position.set(0, h + 0.35, d); cam.lookAt(0, h * 0.85, 0);
  const res = shoot(scene, cam, ms.map(m => m[1]));
  if (names) for (const [name, m] of ms) { const [x, y] = project(cam, m.root.position.clone().add(new THREE.Vector3(0, -0.12, 0.3))); label(name, x, y); }
  return res;
}
const pages = (list, n) => Array.from({length: Math.ceil(list.length / n)}, (_, i) => list.slice(i * n, i * n + n));
// a close-up of one face
function face(spec, {yaw = 0.35, t = 1.3, st = {}, gesture = null, tAfter = 0} = {}) {
  clearLabels();
  const scene = studio(0x3a302a), m = place(scene, spec, 0, 0, yaw, st);
  if (gesture) { m.gesture(gesture); for (let i = 0; i < tAfter * 60; i++) m.animate(1 / 60, {t: t + i / 60, walk: 0, ...st}); }
  const hy = m.height * 0.9, cam = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.05, 50);
  cam.position.set(0, hy + 0.06, 2.1 * (m.height / 1.8) + 0.3); cam.lookAt(0, hy - 0.06, 0);
  return shoot(scene, cam, [m]);
}
function portrait(spec, opts = {}) {
  clearLabels();
  const scene = studio(0x3a302a), m = place(scene, spec, 0, 0, opts.yaw ?? 0.5, opts.st);
  if (opts.gesture) { m.gesture(opts.gesture); for (let i = 0; i < (opts.tAfter ?? 1) * 60; i++) m.animate(1 / 60, {t: 1.3 + i / 60, walk: 0}); }
  const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
  cam.position.set(0, m.height * 0.62, m.height * 2.0 + 0.6); cam.lookAt(0, m.height * 0.5, 0);
  return shoot(scene, cam, [m]);
}
const HEROES = (() => {
  const rng = makeRng(7), list = [];
  const base = {lanyard: true};
  const fixed = [
    {build: 'slim', height: 0.88, skin: 0xfbe4d5, hair: 'pixie', hairColor: 0xd02a2a, top: 'hoodie', topColor: 0x2f5fb8, bottom: 'shorts', bottomColor: 0x3a3d44, glasses: 'round'},
    {build: 'broad', height: 1.14, skin: 0x48291a, hair: 'buzz', hairColor: 0x17120f, facialHair: 'beard', top: 'blazer', topColor: 0x22305a, tie: 0xc0302a},
    {build: 'round', height: 0.94, skin: 0xdcaa7e, age: 'old', hair: 'bald', facialHair: 'moustache', facialHairColor: 0xc8c8cc, top: 'cardigan', topColor: 0x7a7a3a, patches: true, glasses: 'half'},
    {build: 'average', height: 1.02, skin: 0x93603b, hair: 'afro', hairColor: 0x17120f, top: 'tshirt', topColor: 0xe8742a, top2: 0xffffff, bottom: 'skirt', bottomColor: 0x2f4f7a, earrings: true},
    {build: 'slim', height: 1.08, skin: 0xc9a07a, hair: 'headscarf', scarfColor: 0x2a8a8a, top: 'dress', topColor: 0x6a2a5a, pattern: 'dots', bottom: 'skirt'},
    {build: 'average', height: 0.98, skin: 0xf0c4ad, age: 'young', hair: 'long', fringe: true, hairColor: 0xdcbc7c, freckles: true, top: 'jumper', topColor: 0xe890b0, pattern: 'stripe'},
    {build: 'broad', height: 1.0, skin: 0x7a4a2c, hair: 'braids', hairColor: 0x3a2618, top: 'shirt', topColor: 0xf0e6d0, pattern: 'check', tie: 0x2e5a3a},
    {build: 'average', height: 0.92, skin: 0xbf8a5e, hair: 'curly', hairColor: 0x3a2618, facialHair: 'goatee', top: 'vest', topColor: 0x3a3d44, top2: 0x7aaee0, hat: 'beanie', hatColor: 0xc89a2a},
    {build: 'round', height: 1.06, skin: 0xf5d3bd, hair: 'side', hairColor: 0x9c9c9a, age: 'old', facialHair: 'full', facialHairColor: 0xf2f2ee, top: 'hivis', topColor: 0xf0d020, top2: 0x2f4f7a, hat: 'hardhat'},
    {build: 'slim', height: 1.0, skin: 0x613a22, hair: 'ponytail', hairColor: 0x8a4ad8, top: 'hawaii', topColor: 0x2a8a8a, top2: 0xe890b0, bottom: 'shorts', glasses: 'shades'},
    {build: 'average', height: 1.1, skin: 0xa8734a, hair: 'bun', hairColor: 0x17120f, top: 'robe', topColor: 0x5a3a8a, top2: 0xc89a2a, hat: 'tophat', hatColor: 0x1c1c22},
    {build: 'average', height: 0.96, skin: 0xe9be98, hair: 'slick', hairColor: 0x5a3a22, facialHair: 'stubble', top: 'apron', topColor: 0x2e5a3a, top2: 0xf4f2ee, scarf: 0xc0302a},
  ];
  fixed.forEach((l, i) => list.push(['held ' + (i + 1), {...base, ...l}]));
  for (let i = 0; i < 12; i++) list.push(['toeval ' + (i + 1), randomLook(rng)]);
  return list;
})();
const BASE = {build: 'average', skin: 0xdcaa7e, hairColor: 0x5a3a22, top: 'blazer', topColor: 0x2f4f7a, eyes: 0x4a7a4a};
const SCENES = {
  folk: () => lineup(FOLK.map(([id, c]) => [c.name, c.model]), {gap: 1.5}),
  'heroes-1': () => lineup(HEROES.slice(0, 8), {yaw: 0.25}),
  'heroes-2': () => lineup(HEROES.slice(8, 16), {yaw: 0.25}),
  'heroes-3': () => lineup(HEROES.slice(16), {yaw: 0.25}),
  'hair-1': () => lineup(LOOK_ENUMS.hair.slice(0, 7).map(o => [o.label, {...BASE, hair: o.id, scarfColor: 0x8a3a5a}]), {yaw: 0.55}),
  'hair-2': () => lineup(LOOK_ENUMS.hair.slice(7).map(o => [o.label, {...BASE, hair: o.id, scarfColor: 0x8a3a5a}]), {yaw: 0.55}),
  'hair-back': () => lineup(LOOK_ENUMS.hair.filter(o => ['long', 'ponytail', 'bun', 'braids', 'headscarf', 'afro'].includes(o.id)).map(o => [o.label, {...BASE, hair: o.id, scarfColor: 0x8a3a5a}]), {yaw: Math.PI * 0.78, gap: 0.8}),
  'tops-1': () => lineup(LOOK_ENUMS.top.slice(0, 6).map(o => [o.label, {...BASE, top: o.id, topColor: 0x2a8a8a, top2: 0xf0e6d0, tie: o.id === 'shirt' ? 0xc0302a : null}]), {yaw: 0.35}),
  'tops-2': () => lineup(LOOK_ENUMS.top.slice(6).map(o => [o.label, {...BASE, top: o.id, topColor: 0x2a8a8a, top2: 0xf0e6d0}]), {yaw: 0.35}),
  builds: () => lineup([['slank klein', {...BASE, build: 'slim', height: 0.86}], ['slank lang', {...BASE, build: 'slim', height: 1.14}], ['gemiddeld', {...BASE}], ['breed', {...BASE, build: 'broad', height: 1.08}], ['rond', {...BASE, build: 'round', height: 0.94}], ['rond lang', {...BASE, build: 'round', height: 1.12}], ['jong', {...BASE, age: 'young', height: 0.9}], ['ouder', {...BASE, age: 'old', hairColor: 0xc8c8cc}]], {yaw: 0.4}),
  'facial-hair': () => lineup(LOOK_ENUMS.facialHair.map((o, i) => [o.label, {...BASE, skin: SKIN_TONES[(i * 2) % 12].hex, facialHair: o.id, hairColor: 0x3a2618}]), {yaw: 0.2}),
  glasses: () => lineup(LOOK_ENUMS.glasses.map(o => ['bril ' + o.label, {...BASE, glasses: o.id, hair: 'bob'}]), {yaw: 0.2}),
};
pages(HUMANS, 7).forEach((pg, i) => { SCENES['cast-' + (i + 1)] = () => lineup(pg.map(([id, c]) => [c.name, c.model])); SCENES['cast34-' + (i + 1)] = () => lineup(pg.map(([id, c]) => [c.name, c.model]), {yaw: 0.65}); });
// every mood on one face, close up (heads only)
function moods(spec) {
  clearLabels();
  const scene = studio(0x3a302a), list = LOOK_ENUMS.mood, gap = 0.56, ms = [];
  list.forEach((o, i) => { const m = place(scene, spec, ((i % 5) - 2) * gap, 0, 0.25, {mood: o.id}); m.root.position.y = i < 5 ? 0.7 : 0; ms.push([o.label, m]); });
  const h = ms[0][1].height, cam = new THREE.PerspectiveCamera(26, innerWidth / innerHeight, 0.05, 50);
  cam.position.set(0, h + 0.3, 4.4); cam.lookAt(0, h + 0.28, 0);
  const res = shoot(scene, cam, ms.map(m => m[1]));
  for (const [name, m] of ms) { const [x, y] = project(cam, m.root.position.clone().add(new THREE.Vector3(0, h * 0.76, 0.3))); label(name, x, y); }
  return res;
}
SCENES['moods-ilse'] = () => moods(CAST_DEFS.ilse.model);
SCENES['moods-hero'] = () => moods({...BASE, hair: 'curly', skin: 0x93603b, hairColor: 0x17120f});
for (const [id, c] of HUMANS) SCENES['face-' + id] = () => face(c.model);
// the folk of the Gewelf up close (the sparks float, so frame them by their height)
for (const [id, c] of FOLK) SCENES['face-' + id] = () => { clearLabels(); const scene = studio(0x3a302a), m = place(scene, c.model, 0, 0, 0.3); const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50), y = c.model.kind === 'pip' ? 1.3 : m.height * 0.72, d = c.model.kind === 'pip' ? 1.0 : 2.3; cam.position.set(0, y + 0.1, d); cam.lookAt(0, y, 0); return shoot(scene, cam, [m]); };
SCENES['face-joop-talk'] = () => face(CAST_DEFS.joop.model, {st: {talk: true}, t: 2.1});
SCENES['face-glans-moods'] = () => face(CAST_DEFS.glans.model, {st: {mood: 'surprised'}});
SCENES['face-ilse-angry'] = () => face(CAST_DEFS.ilse.model, {st: {mood: 'angry'}});
for (const [id, g, tA] of [['joop', 'jingle', 1.2], ['joop', 'whistle', 1.5], ['joop', 'tipcap', 0.9], ['glans', 'fingerguns', 1.0], ['glans', 'tie', 1.0], ['ilse', 'headset', 1.0], ['ilse', 'sip', 1.3], ['bep', 'shush', 1.1], ['bakker', 'lean', 1.4], ['burger3', 'tug', 0.6], ['wouter', 'beard', 1.2], ['kees', 'watch', 1.4], ['henk', 'stretch', 1.3], ['linde', 'listen', 1.4], ['wethouder', 'pen', 1.2], ['sien', 'sip', 1.3], ['mallow', 'tools', 1.0], ['griffel', 'write', 1.5]]) {
  SCENES['gesture-' + id + '-' + g] = () => portrait(CAST_DEFS[id].model, {gesture: g, tAfter: tA});
}
const CUSTOM = __LOOK__;
if (CUSTOM) { SCENES.custom = () => lineup([['voor', CUSTOM, 0], ['driekwart', CUSTOM, 0.7], ['zij', CUSTOM, Math.PI / 2], ['achter', CUSTOM, Math.PI]]); SCENES['face-custom'] = () => face(CUSTOM); }
window.GAL = {ready: true, scenes: Object.keys(SCENES), show: name => SCENES[name]()};
`;

const result = await build({stdin: {contents: ENTRY.replace('__LOOK__', process.env.LOOK || 'null'), resolveDir: here, sourcefile: 'gallery-entry.js', loader: 'js'}, bundle: true, write: false, format: 'iife', target: ['es2022'], logLevel: 'warning', define: {__DEV__: 'true'}});
const html = `<!doctype html><meta charset="utf-8"><title>Galerij</title><body style="background:#111"><script>${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`;
const page = SHOTS + 'gallery.html';
fs.writeFileSync(page, html);

const browser = await launch();
const views = {wide: {width: 1600, height: 900, deviceScaleFactor: 1}, close: {width: 640, height: 720, deviceScaleFactor: 2}};
const logs = [];
for (const [vk, vp] of Object.entries(views)) {
  const pg = await browser.newPage({viewport: {width: vp.width, height: vp.height}, deviceScaleFactor: vp.deviceScaleFactor});
  pg.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error') logs.push(`[console] ${m.text()}`); });
  await pg.goto(pathToFileURL(page).href);
  await pg.waitForFunction(() => window.GAL?.ready, null, {timeout: 60000});
  const scenes = (await pg.evaluate(() => window.GAL.scenes)).filter(s => (vk === 'close') === (s.startsWith('face-') || s.startsWith('gesture-')));
  for (const s of scenes) {
    if (only.length && !only.some(w => s.includes(w))) continue;
    const t0 = Date.now();
    const r = await pg.evaluate(n => window.GAL.show(n), s);
    await pg.screenshot({path: `${SHOTS}gallery-${s}.png`});
    logs.push(`${s}: ${JSON.stringify(r)} (${Date.now() - t0} ms)`);
  }
  await pg.close();
}
await browser.close();
console.log(logs.join('\n'));
