// What the puzzle objects look like. Their meaning lives in the story files (ON.use / ON.place / ON.hit).
import * as THREE from 'three';
import {OBJECT_KINDS} from '../game/entities.js';
import {glowSprite} from '../engine/models.js';
import {R} from '../engine/render.js';
import {P, UI, SFX, ON, ITEMS} from '../game/bus.js';
import {FX} from '../engine/particles.js';
import {chamberState} from '../game/bus.js';
import {G} from '../game/state.js';
import {BINGO} from './items.js';
import {findSecret} from './story/systems.js';

// a floating label that always faces you
export function labelSprite(text, {color = '#f2e6cc', bg = 'rgba(20,15,10,.82)', border = '#b48a4a', size = 30, maxW = 22, scale = 1} = {}) {
  const words = String(text).split(' '), lines = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxW && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `600 ${size}px 'DM Sans', system-ui, sans-serif`;
  const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + 36), h = Math.ceil(lines.length * size * 1.25 + 26);
  c.width = w; c.height = h;
  g.font = `600 ${size}px 'DM Sans', system-ui, sans-serif`;
  g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = 3;
  g.beginPath(); g.roundRect?.(2, 2, w - 4, h - 4, 12); if (!g.roundRect) g.rect(2, 2, w - 4, h - 4); g.fill(); g.stroke();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, 13 + size * 0.62 + i * size * 1.25));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false, toneMapped: false}));
  const k = 0.0042 * scale;
  s.scale.set(w * k, h * k, 1);
  s.renderOrder = 4;
  return s;
}
function label(o, text, y, opts) { if (o.labelSp) o.group.remove(o.labelSp); if (!text) return; o.labelSp = labelSprite(text, opts); o.labelSp.position.y = y; o.group.add(o.labelSp); }

const show = (o, near = 7) => { if (o.labelSp) o.labelSp.visible = o.dist() < near; };

// ---- shapes of things you can carry ----
function carryShape(o, shape, color) {
  const g = new THREE.Group();
  const m = (hex, em = 0.35) => o.mat(hex, {emissive: hex, emissiveIntensity: em});
  if (shape === 'stamp') { o.box(0.1, 0.32, 0.1, 0, 0, 0.18, 0, {material: m(0x6a4a2a, 0.1)}, g); o.box(0.36, 0.12, 0.36, 0, 0, 0.0, 0, {material: m(color)}, g); }
  else if (shape === 'scroll') { o.box(0.18, 0.55, 0.18, 0, 0, 0.1, 0, {material: m(0xf4ecd8, 0.25)}, g); o.box(0.24, 0.07, 0.24, 0, 0, 0.4, 0, {material: m(color)}, g); o.box(0.24, 0.07, 0.24, 0, 0, -0.18, 0, {material: m(color)}, g); g.rotation.z = 0.4; }
  else if (shape === 'card') { o.box(0.5, 0.34, 0.03, 0, 0, 0.1, 0, {material: m(0xfff4d8, 0.3)}, g); o.box(0.42, 0.06, 0.035, 0, 0, 0.18, 0, {material: m(color)}, g); }
  else if (shape === 'orb') { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({color, toneMapped: false})); s.position.y = 0.1; g.add(s); }
  else if (shape === 'stone') { o.box(0.5, 0.5, 0.5, 0, 0, 0.15, 0, {material: m(color, 0.5)}, g); }
  else if (shape === 'key') { o.box(0.08, 0.5, 0.06, 0, 0, 0.1, 0, {material: m(color, 0.5)}, g); o.box(0.26, 0.2, 0.06, 0, 0, 0.42, 0, {material: m(color, 0.5)}, g); }
  else if (shape === 'chest') { o.box(0.6, 0.44, 0.44, 0, 0, 0.1, 0, {material: m(color, 0.25)}, g); }
  return g;
}

Object.assign(OBJECT_KINDS, {
  carry: {
    solid: false,
    build(o) {
      const d = o.def, color = d.color ?? 0xffd36b;
      o.holder = new THREE.Group(); o.holder.position.y = d.y ?? 0.95; o.group.add(o.holder);
      o.holder.add(carryShape(o, d.shape || 'scroll', color));
      o.glow = glowSprite(color, 1.2, 0.55); o.glow.position.y = 0.15; o.holder.add(o.glow);
      o.ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
      o.ring.rotation.x = -Math.PI / 2; o.ring.position.y = 0.04; o.group.add(o.ring);
      o.home = {x: o.x, z: o.z};
      label(o, d.short || d.label, 1.75, {maxW: 24});
    },
    label: o => `Pak op: ${o.def.short || o.def.label}`,
    update(o, dt) { o.holder.rotation.y += dt * 1.2; show(o, 6); o.ring.visible = !o.placed; if (o.placed) { o.holder.rotation.y = 0; if (o.glow) o.glow.material.opacity = 0.25; if (o.labelSp) o.labelSp.visible = false; } },
    interactable: o => !o.placed && !P.carry && o.dist() < 2.4,
  },
  slot: {
    build(o) {
      const d = o.def, color = d.color ?? 0xc8a050, shape = d.shape || 'table';
      if (shape === 'table') { o.box(1.6, 0.85, 1.0, 0x6e4a2c, 0, 0.425, 0); o.box(1.7, 0.08, 1.1, 0x8a5e38, 0, 0.88, 0); }
      else if (shape === 'chair') { o.box(1.0, 0.6, 1.0, 0x5a3a7a, 0, 0.3, 0); o.box(1.0, 1.6, 0.2, 0x5a3a7a, 0, 1.1, -0.42); o.box(1.1, 0.12, 1.1, 0xd8b050, 0, 1.95, -0.42, {m: {emissive: 0x4a3008}}); }
      else if (shape === 'post') { o.box(0.25, 2.2, 0.25, 0x8a7a5a, 0, 1.1, 0); o.box(1.1, 0.7, 0.08, 0xe8dcc0, 0, 1.9, 0.1, {m: {emissive: 0x302818, emissiveIntensity: 0.5}}); }
      else if (shape === 'chute') { o.box(1.4, 1.2, 1.4, 0x6a6f78, 0, 0.6, 0); o.box(1.0, 0.2, 1.0, 0x1a1a1e, 0, 1.21, 0); o.box(0.2, 2.2, 0.2, 0x8a7a5a, 0.6, 2.0, -0.6); }
      else if (shape === 'pedestal') { o.box(1.0, 0.9, 1.0, d.stone ?? 0x7a7468, 0, 0.45, 0); o.box(1.2, 0.12, 1.2, d.stone ?? 0x8a8478, 0, 0.92, 0); }
      else if (shape === 'gate') { o.box(2.0, 2.6, 0.3, 0x4a4a5a, 0, 1.3, -0.5); o.box(1.4, 1.8, 0.05, color, 0, 1.2, -0.33, {m: {emissive: color, emissiveIntensity: 0.5}}); o.box(1.4, 0.2, 1.0, 0x3a3a44, 0, 0.1, 0.2); }
      o.mark = glowSprite(color, 1.6, 0.25); o.mark.position.y = 1.3; o.group.add(o.mark);
      label(o, d.label, shape === 'chair' ? 2.7 : shape === 'gate' ? 3.0 : 2.0, {color: '#ffe2a6', border: '#e8c27a', maxW: 20});
      o.stack = 0;
    },
    label: o => (P.carry ? `Leg neer bij: ${o.def.label}` : o.def.label),
    interactable: o => !!P.carry && o.dist() < 2.6,
    update(o) { show(o, 9); o.mark.material.opacity = P.carry ? 0.35 + Math.sin(R.time * 4) * 0.15 : 0.12; },
  },
  bell: {
    build(o) {
      o.box(0.12, 2.4, 0.12, 0x5a3a20, -0.6, 1.2, 0); o.box(0.12, 2.4, 0.12, 0x5a3a20, 0.6, 1.2, 0); o.box(1.4, 0.14, 0.14, 0x5a3a20, 0, 2.4, 0);
      o.bell = new THREE.Group(); o.bell.position.y = 2.33; o.group.add(o.bell);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 0.62, 12, 1, true), o.mat(0xd8b050, {emissive: 0x4a3008, side: THREE.DoubleSide}));
      m.position.y = -0.35; o.bell.add(m);
      o.glow = glowSprite(0xffe2a6, 1.4, 0); o.glow.position.y = 1.9; o.group.add(o.glow);
      label(o, o.def.label, 3.1, {maxW: 22});
      o.swing = 0;
    },
    label: o => `Luid de bel: ${o.def.label}`,
    interact(o) { o.swing = 1; SFX.play('bell', o.def.n ?? 0); o.glow.material.opacity = 0.8; ON.use[o.id]?.(o); },
    interactable: o => o.dist() < 2.6 && !o.def.done,
    update(o, dt) { o.swing = Math.max(0, o.swing - dt * 0.8); o.bell.rotation.z = Math.sin(R.time * 9) * 0.4 * o.swing; o.glow.material.opacity = Math.max(o.def.lit ? 0.5 : 0, o.glow.material.opacity - dt); show(o, 8); },
  },
  drawer: {
    build(o) {
      o.box(1.6, 2.0, 0.8, 0x7d8a8c, 0, 1.0, -0.3);
      o.drawerMesh = o.box(1.3, 0.4, 0.7, 0xb8c0c4, 0, 1.0, -0.2, {m: {emissive: 0x202830}});
      o.glow = glowSprite(0x9fc3ff, 1.4, 0); o.glow.position.set(0, 1.0, 0.3); o.group.add(o.glow);
      label(o, o.def.label, 2.6, {maxW: 22});
    },
    label: o => `Open de la: ${o.def.label}`,
    interact(o) { SFX.play('push'); o.open = 1; ON.use[o.id]?.(o); },
    interactable: o => o.dist() < 2.6 && !o.def.done,
    update(o, dt) { o.open = Math.max(o.def.done ? 1 : 0, (o.open || 0) - dt * 0.6); o.drawerMesh.position.z = -0.2 + o.open * 0.45; o.glow.material.opacity = o.def.done ? 0.5 : 0; show(o, 8); },
  },
  post: {
    build(o) {
      o.box(0.22, 2.0, 0.22, 0x8a7a5a, 0, 1.0, 0);
      o.board = o.box(1.2, 0.8, 0.08, 0xe8dcc0, 0, 1.9, 0.08, {m: {emissive: 0x302818, emissiveIntensity: 0.5}});
      o.glow = glowSprite(0xffffff, 1.6, 0); o.glow.position.set(0, 1.9, 0.3); o.group.add(o.glow);
      label(o, o.def.label, 2.75, {maxW: 22});
    },
    label: o => (o.def.solved ? `${o.def.label} · beoordeeld` : `Beoordeel: ${o.def.label}`),
    interactable: o => o.dist() < 2.6 && !o.def.solved,
    update(o) { o.glow.material.color.set(o.def.solved ? 0x8fe0a0 : 0xffe2a6); o.glow.material.opacity = o.def.solved ? 0.6 : 0.15 + Math.sin(R.time * 2 + o.x) * 0.08; show(o, 8); },
  },
  lever2: {
    build(o) {
      o.box(0.6, 1.0, 0.5, 0x5a5048, 0, 0.5, 0);
      o.handle = new THREE.Group(); o.handle.position.set(0, 1.0, 0); o.group.add(o.handle);
      o.box(0.08, 0.75, 0.08, 0x8a7a6a, 0, 0.37, 0, {}, o.handle);
      o.knob = o.box(0.18, 0.18, 0.18, 0xd04030, 0, 0.76, 0, {m: {emissive: 0xd04030, emissiveIntensity: 0.6}}, o.handle);
      o.refresh = () => { const st = o.def.states?.[o.state] ?? ''; label(o, `${o.def.label}: ${st}`, 2.4, {maxW: 26, color: o.state === o.def.correct ? '#c8f0d0' : '#ffe2a6'}); };
      o.refresh();
    },
    label: o => `Zet om: ${o.def.label} (nu: ${o.def.states?.[o.state]})`,
    interact(o) { o.setState(o.state ? 0 : 1); SFX.play('lever'); o.refresh(); ON.use[o.id]?.(o); },
    interactable: o => o.dist() < 2.4 && !o.def.locked,
    update(o, dt) { o.handle.rotation.x += ((o.state ? 0.7 : -0.7) - o.handle.rotation.x) * Math.min(1, dt * 8); show(o, 9); },
  },
  socket: {
    build(o) {
      o.box(1.0, 1.4, 0.5, 0x2a2238, 0, 1.6, -0.6);
      o.core = o.box(0.5, 0.5, 0.3, 0xc7a0ff, 0, 1.6, -0.35, {m: {emissive: 0xc7a0ff, emissiveIntensity: 1}});
      o.glow = glowSprite(0xc7a0ff, 2.0, 0.6); o.glow.position.set(0, 1.6, -0.2); o.group.add(o.glow);
      label(o, o.def.label, 2.7, {maxW: 20, color: '#e0d0ff', border: '#c7a0ff'});
      o.sealed = true; o.hits = 0;
    },
    solid: false,
    interactable: () => false,
    hit(o, tool) {
      if (o.sealed || tool !== 'seal') return;
      o.hits++;
      const need = chamberState('security') === 'strong' ? 1 : 2;
      FX.burst(o.x, 1.6, o.z, 20, {color: [0x7fe0a4, 0xc7a0ff], speed: 3, life: 0.6});
      if (o.hits >= need) { o.sealed = true; SFX.play('sealHit'); UI.number(o.x, 2.4, o.z, 'Begrensd!', '#7fe0a4', true); }
      else UI.number(o.x, 2.4, o.z, 'Nog een keer!', '#c7a0ff', false);
    },
    update(o) { const c = o.sealed ? 0x7fe0a4 : 0xc7a0ff; o.core.material.color.setHex(c); o.core.material.emissive.setHex(c); o.glow.material.color.setHex(c); o.glow.material.opacity = o.sealed ? 0.25 : 0.6 + Math.sin(R.time * 6) * 0.2; show(o, 14); },
  },
  horn: {
    build(o) {
      o.box(0.14, 1.3, 0.14, 0x5a3a20, 0, 0.65, 0);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 14, 1, true), o.mat(0xc8a050, {emissive: 0x3a2808, side: THREE.DoubleSide}));
      cone.rotation.x = -Math.PI / 2 - 0.3; cone.position.set(0, 1.5, 0.35); o.group.add(cone);
      o.glow = glowSprite(0x9fc3ff, 1.8, 0.3); o.glow.position.set(0, 1.5, 0.9); o.group.add(o.glow);
      label(o, o.def.label, 2.6, {maxW: 22});
    },
    label: o => `Luister: ${o.def.label}`,
    interactable: o => o.dist() < 2.6,
    update(o) { o.glow.material.opacity = o.def.heard ? 0.1 : 0.3 + Math.sin(R.time * 3 + o.x) * 0.15; show(o, 8); },
  },
  glanslift: {
    build(o) {
      const gold = {m: {emissive: 0x8a6010, emissiveIntensity: 0.8}};
      o.box(2.4, 3.2, 0.4, 0xe8c060, 0, 1.6, -0.75, gold);
      o.box(0.9, 2.6, 0.06, 0xffe08a, -0.47, 1.35, -0.53, gold); o.box(0.9, 2.6, 0.06, 0xffe08a, 0.47, 1.35, -0.53, gold);
      o.box(1.4, 0.3, 0.06, 0x2a1a0a, 0, 2.95, -0.52);
      o.glow = glowSprite(0xffd36b, 3.4, 0.5); o.glow.position.set(0, 1.6, -0.2); o.group.add(o.glow);
      label(o, 'DE SNELLE LIFT · rechtstreeks naar het Orakel', 3.6, {color: '#2a1a08', bg: 'rgba(255,214,120,.92)', border: '#fff1b8', maxW: 26});
    },
    label: () => 'Bekijk de Snelle Lift',
    interactable: o => o.dist() < 2.8,
    update(o) { o.glow.material.opacity = 0.45 + Math.sin(R.time * 3) * 0.12; show(o, 12); },
  },
  biglift: {
    solid: false,
    build(o) {
      o.plat = new THREE.Group(); o.group.add(o.plat);
      o.box(3.6, 0.3, 3.6, 0x6a6258, 0, 0.15, 0, {}, o.plat);
      o.rune = o.box(2.4, 0.04, 2.4, 0x9fc3ff, 0, 0.32, 0, {m: {emissive: 0x9fc3ff, emissiveIntensity: 0.2}}, o.plat);
      for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) o.box(0.2, 0.9, 0.2, 0x8a7a5a, x, 0.75, z, {}, o.plat);
      o.glow = glowSprite(0x9fc3ff, 4, 0); o.glow.position.y = 1.2; o.group.add(o.glow);
    },
    label: o => (o.def.ready?.() ? 'Neem de grote lift naar Diepte 3' : 'De grote lift: hij reageert niet'),
    interactable: o => o.dist() < 3.2,
    update(o) { const on = !!o.def.ready?.(); o.rune.material.emissiveIntensity = on ? 0.9 + Math.sin(R.time * 3) * 0.2 : 0.1; o.glow.material.opacity = on ? 0.5 : 0; },
  },
  orakel: {
    r: 2.2,
    build(o) {
      const gold = {m: {emissive: 0x8a6010, emissiveIntensity: 0.9}};
      o.box(3.2, 1.0, 3.2, 0x2a2420, 0, 0.5, 0);
      o.body = o.box(2.0, 6.0, 2.0, 0xe8c060, 0, 4.0, 0, gold);
      o.face = o.box(1.6, 1.6, 0.08, 0x1a1408, 0, 5.2, 1.02, {m: {emissive: 0xffd36b, emissiveIntensity: 0.2}});
      o.eyeL = o.box(0.3, 0.16, 0.04, 0xffffff, -0.35, 5.45, 1.07, {m: {emissive: 0xffffff, emissiveIntensity: 1}});
      o.eyeR = o.box(0.3, 0.16, 0.04, 0xffffff, 0.35, 5.45, 1.07, {m: {emissive: 0xffffff, emissiveIntensity: 1}});
      o.mouth = o.box(0.7, 0.1, 0.04, 0xffffff, 0, 4.9, 1.07, {m: {emissive: 0xffffff, emissiveIntensity: 1}});
      for (let k = 0; k < 6; k++) o.box(1.6, 0.06, 0.06, 0xffd36b, 0, 1.6 + k * 0.5, 1.02, {m: {emissive: 0xffd36b, emissiveIntensity: 0.6}});
      o.glow = glowSprite(0xffd36b, 9, 0.35); o.glow.position.y = 4.5; o.group.add(o.glow);
    },
    label: () => 'Spreek het Orakel aan',
    interactable: o => o.dist() < 4.5 && !!o.def.talk,
    update(o) { const calm = o.def.calm?.(); o.mouth.scale.y = o.talking ? 1 + Math.abs(Math.sin(R.time * 12)) * 2 : 1; o.glow.material.opacity = calm ? 0.2 : 0.35 + Math.sin(R.time * 2) * 0.1; o.face.material.emissiveIntensity = calm ? 0.05 : 0.2 + Math.sin(R.time * 7) * 0.1; },
  },
  cocoon: {
    r: 1.0,
    build(o) {
      o.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), o.mat(0xe8c060, {emissive: 0x8a6010, emissiveIntensity: 0.7, flatShading: true}));
      o.shell.scale.set(0.9, 1.3, 0.9); o.shell.position.y = 1.3; o.group.add(o.shell);
      o.glow = glowSprite(0xffd36b, 3, 0.4); o.glow.position.y = 1.4; o.group.add(o.glow);
    },
    label: () => 'Een gouden cocon van contractpapier',
    interactable: o => o.dist() < 2.8 && !o.def.open?.(),
    update(o) { const open = !!o.def.open?.(); o.shell.visible = !open; o.glow.visible = !open; o.shell.rotation.y += 0.004; },
  },
  thread: {
    solid: false,
    build(o) {
      o.anchor = o.box(0.5, 0.5, 0.5, 0xe8c060, 0, 0.6, 0, {m: {emissive: 0x8a6010, emissiveIntensity: 0.9}});
      o.glow = glowSprite(0xffd36b, 1.6, 0.5); o.glow.position.y = 0.6; o.group.add(o.glow);
      label(o, 'Contractdraad', 1.5, {maxW: 20});
    },
    interactable: () => false,
    update(o) { const cut = !!o.def.cut; o.anchor.visible = !cut; o.glow.visible = !cut; if (o.labelSp) o.labelSp.visible = !cut && o.dist() < 8; },
  },
  bridgepost: {
    build(o) {
      o.box(1.2, 1.2, 1.2, 0x6a6258, 0, 0.6, 0);
      o.holes = [];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; o.holes.push(o.box(0.16, 0.16, 0.16, 0x1a1a1a, Math.cos(a) * 0.4, 1.25, Math.sin(a) * 0.4, {m: {emissive: 0x000000}})); }
      o.glow = glowSprite(0xffe2a6, 2, 0.2); o.glow.position.y = 1.5; o.group.add(o.glow);
    },
    label: () => 'De sleutelpaal van de brug',
    interactable: o => o.dist() < 2.6,
    update(o) { const n = o.def.count?.() ?? 0; o.holes.forEach((h, k) => { h.material.color.setHex(k < n ? 0xffd36b : 0x1a1a1a); h.material.emissive.setHex(k < n ? 0x8a6010 : 0); }); o.glow.material.opacity = 0.15 + n * 0.06; },
  },
  oven: {
    r: 1.4,
    build(o) {
      o.box(3.0, 2.6, 2.2, 0x6a5a4a, 0, 1.3, -0.4);
      o.mouthM = o.box(1.6, 1.0, 0.1, 0xff7a3a, 0, 1.1, 0.72, {m: {emissive: 0xff5a1a, emissiveIntensity: 1}});
      o.glow = glowSprite(0xff7a3a, 4, 0.6); o.glow.position.set(0, 1.2, 1); o.group.add(o.glow);
      for (const x of [-1.0, 0, 1.0]) o.box(0.3, 2.2, 0.3, 0x8a7a5a, x, 3.6, -0.6);
    },
    label: o => o.def.label || 'De modelmachine',
    interactable: o => o.dist() < 3 && !!o.def.talk,
    update(o) { const heat = o.def.heat?.() ?? 1; o.mouthM.material.emissiveIntensity = 0.3 + heat; o.glow.material.opacity = 0.2 + heat * 0.5; if (Math.random() < 0.05 * heat) FX.one({x: o.x + (Math.random() - 0.5) * 2, y: 3, z: o.z - 0.4, vy: 1.4, life: 1.5, s0: 0.3, s1: 0.8, color: 0x9a9a9a, additive: false, a: 0.4}); },
  },
  board: {
    build(o) {
      o.box(2.6, 1.6, 0.12, 0x2a2a30, 0, 2.2, -0.85);
      o.refresh = text => label(o, text, 2.2, {maxW: 22, size: 34, color: '#ffe2a6', bg: 'rgba(10,10,14,.92)', border: '#5a5a6a', scale: 1.2});
      o.refresh(o.def.label || '');
    },
    solid: false,
    interactable: () => false,
    update(o) { if (o.labelSp) o.labelSp.position.z = -0.7; },
  },
  sealtable: {
    r: 1.6,
    build(o) {
      o.box(3.2, 1.0, 2.0, 0x5a3a22, 0, 0.5, 0);
      o.box(3.4, 0.1, 2.2, 0x7a5232, 0, 1.03, 0);
      o.box(1.2, 0.04, 0.9, 0xf4ecd8, 0, 1.1, 0, {m: {emissive: 0x6a5a30, emissiveIntensity: 0.5}});
      o.seal = o.box(0.4, 0.5, 0.4, 0x2f7a4a, 0.9, 1.33, 0.2, {m: {emissive: 0x0a3a18, emissiveIntensity: 0.8}});
      o.glow = glowSprite(0xffe2a6, 3, 0.4); o.glow.position.y = 1.6; o.group.add(o.glow);
    },
    label: () => 'Bezegel het besluit',
    interactable: o => o.dist() < 3,
    update(o) { o.glow.material.opacity = 0.3 + Math.sin(R.time * 2) * 0.1; },
  },
  ticket: {
    build(o) {
      o.box(0.6, 1.5, 0.5, 0xc04030, 0, 0.75, 0);
      o.box(0.4, 0.3, 0.05, 0x1a1a1e, 0, 1.2, 0.26, {m: {emissive: 0xff4030, emissiveIntensity: 0.7}});
      label(o, 'Neem een nummer', 1.9, {maxW: 20});
    },
    label: () => 'Trek een nummertje',
    interactable: o => o.dist() < 2.2,
    update(o) { show(o, 7); },
  },
  stoneslot: {
    build(o) {
      o.box(1.3, 1.1, 1.3, 0x6a7462, 0, 0.55, 0);
      o.box(1.5, 0.14, 1.5, 0x7a8472, 0, 1.12, 0);
      o.stone = o.box(0.8, 0.8, 0.8, 0x9fd8a0, 0, 1.6, 0, {m: {emissive: 0x4a8a50, emissiveIntensity: 0.8}});
      o.glow = glowSprite(0x9fd8a0, 2.6, 0); o.glow.position.y = 1.6; o.group.add(o.glow);
      label(o, o.def.label, 2.7, {maxW: 22, color: '#d8f0d0', border: '#8fb88a'});
    },
    label: o => `Voetstuk: ${o.def.label}`,
    interactable: o => o.dist() < 2.8,
    update(o) { const placed = !!o.def.placed?.(); o.stone.visible = placed; o.glow.material.opacity = placed ? 0.45 + Math.sin(R.time * 2 + o.x) * 0.1 : 0; o.stone.rotation.y += 0.01; show(o, 14); },
  },
  plaque: {
    solid: false,
    build(o) { o.refresh = (text, color) => label(o, text, 2.2, {maxW: 18, size: 28, color: color || '#ffe2a6'}); o.refresh(o.def.label || ''); },
    interactable: () => false,
    update(o) { show(o, 14); },
  },
});

// ---------------------------------------------------------------- the story systems: finds, bingo, secrets
// Canvas textures are drawn once per key and shared, so a floor can be entered again without redrawing.
const TEX = new Map();
function canvasTex(key, w, h, draw) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    TEX.set(key, t);
  }
  return t;
}
const HAND = `'Segoe Print','Bradley Hand','Marker Felt','Comic Sans MS',cursive`;
function wrapLines(g, text, maxW) {
  const out = []; let cur = '';
  for (const w of String(text).split(' ')) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12), BALL = new THREE.IcosahedronGeometry(1, 1);
function cyl(o, r, h, hex, x, y, z, parent) { const c = new THREE.Mesh(CYL, o.mat(hex)); c.scale.set(r, h, r); c.position.set(x, y, z); parent.add(c); return c; }

// the small voxel things you find (Kantoorvondsten and other pickups), by shape
function findShape(o, shape, color) {
  const g = new THREE.Group(), em = (hex, ei = 0.35) => ({m: {emissive: hex, emissiveIntensity: ei}});
  if (shape === 'stapler') {
    o.box(0.46, 0.07, 0.15, 0x2a2622, 0, -0.06, 0, {}, g);
    const arm = o.box(0.44, 0.08, 0.13, color, 0.01, 0.03, 0, em(color, 0.45), g); arm.rotation.z = 0.12;
    o.box(0.06, 0.06, 0.15, color, -0.2, 0.0, 0, em(color, 0.45), g);
  } else if (shape === 'ticket' || shape === 'card') {
    o.box(0.42, 0.26, 0.02, color, 0, 0, 0, em(color, 0.3), g);
    o.box(0.42, 0.05, 0.025, shape === 'card' ? 0x2a2418 : 0xc04030, 0, 0.08, 0, {}, g);
    if (shape === 'card') for (let i = -1; i <= 1; i++) o.box(0.025, 0.14, 0.03, 0x2a2418, i * 0.09, -0.04, 0, {}, g);
    else o.box(0.05, 0.05, 0.03, 0x2a2418, 0.15, -0.06, 0, {}, g);
  } else if (shape === 'rod') {
    o.box(0.05, 0.34, 0.05, color, 0, -0.12, 0, {}, g);
    for (const s of [-1, 1]) { const a = o.box(0.045, 0.34, 0.045, color, s * 0.09, 0.15, 0, {}, g); a.rotation.z = -s * 0.5; }
    o.box(0.07, 0.07, 0.07, 0xffe2a6, 0, 0.03, 0, em(0xffe2a6, 0.8), g);
  } else if (shape === 'flashlight') {
    const c = cyl(o, 0.06, 0.34, color, 0, 0, 0, g); c.rotation.z = Math.PI / 2;
    const h = cyl(o, 0.085, 0.09, 0x3a3a3a, 0.2, 0, 0, g); h.rotation.z = Math.PI / 2;
    o.box(0.02, 0.12, 0.12, 0xfff4c0, 0.25, 0, 0, em(0xfff4c0, 1), g);
  } else if (shape === 'agenda' || shape === 'book') {
    o.box(0.3, 0.38, 0.08, color, 0, 0, 0, em(color, 0.2), g);
    o.box(0.27, 0.35, 0.085, 0xf4ecd8, 0.02, 0, 0, {}, g);
    if (shape === 'agenda') o.box(0.04, 0.38, 0.09, 0x2a2a34, 0.1, 0, 0, {}, g);
    else o.box(0.3, 0.04, 0.09, 0xd8b050, 0, 0.1, 0, {}, g);
  } else if (shape === 'mug') {
    cyl(o, 0.1, 0.2, color, 0, 0, 0, g);
    o.box(0.04, 0.12, 0.03, color, 0.12, 0, 0, {}, g); o.box(0.05, 0.03, 0.03, color, 0.1, 0.05, 0, {}, g); o.box(0.05, 0.03, 0.03, color, 0.1, -0.05, 0, {}, g);
    cyl(o, 0.085, 0.01, 0x6a4020, 0, 0.09, 0, g);
  } else if (shape === 'postits') {
    o.box(0.24, 0.14, 0.24, color, 0, 0, 0, em(color, 0.3), g);
    const top = o.box(0.24, 0.012, 0.24, 0xfff2a0, 0.03, 0.076, 0.02, em(0xfff2a0, 0.4), g); top.rotation.y = 0.25;
  } else if (shape === 'ball') {
    const b = new THREE.Mesh(BALL, o.mat(color, {emissive: color, emissiveIntensity: 0.25})); b.scale.setScalar(0.15); g.add(b);
  } else if (shape === 'stamp') {
    o.box(0.08, 0.2, 0.08, 0x6a4a2a, 0, 0.06, 0, {}, g); o.box(0.2, 0.07, 0.2, color, 0, -0.07, 0, em(color, 0.4), g);
    o.box(0.12, 0.05, 0.12, 0x6a4a2a, 0, 0.18, 0, {}, g);
  } else if (shape === 'duck') {
    o.box(0.3, 0.18, 0.22, color, 0, 0, 0, em(color, 0.25), g); o.box(0.16, 0.16, 0.16, color, 0.1, 0.16, 0, em(color, 0.25), g);
    o.box(0.1, 0.05, 0.1, 0xf08a1a, 0.22, 0.14, 0, {}, g); o.box(0.08, 0.03, 0.18, 0xe8c060, 0.06, 0.07, 0, em(0xe8c060, 0.5), g);
    for (const s of [-1, 1]) o.box(0.03, 0.03, 0.02, 0x1a1208, 0.15, 0.2, s * 0.08, {}, g);
  } else if (shape === 'clock') {
    cyl(o, 0.16, 0.08, color, 0, 0, 0, g).rotation.x = Math.PI / 2;
    o.box(0.02, 0.1, 0.02, 0x1a1208, 0, 0.04, 0.05, {}, g); o.box(0.07, 0.02, 0.02, 0x1a1208, 0.03, 0, 0.05, {}, g);
    for (const s of [-1, 1]) o.box(0.06, 0.06, 0.06, 0xc8a050, s * 0.11, 0.16, 0, {}, g);
  } else {
    o.box(0.3, 0.3, 0.3, color, 0, 0, 0, em(color, 0.5), g);
  }
  return g;
}
const nameOfGive = id => (ITEMS[id]?.name || '').replace(/^Kantoorvondst: /, '');

// the town hall's paintings: three mayors, one of them a duck; and a sepia photo of opa Joop
function drawPortrait(g, w, h, who) {
  if (who === 'opa') {
    g.fillStyle = '#d8c49a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,60,30,.25)'; for (let k = 0; k < 40; k++) g.fillRect((k * 37) % w, (k * 53) % h, 2, 2);
    g.fillStyle = '#6a5034'; g.fillRect(w * 0.62, h * 0.55, w * 0.3, h * 0.45);                    // the stair going down
    for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#5a4028' : '#7a5c3c'; g.fillRect(w * 0.62, h * (0.6 + k * 0.08), w * 0.3, h * 0.04); }
    g.fillStyle = '#4a3a28'; g.beginPath(); g.ellipse(w * 0.4, h * 1.0, w * 0.34, h * 0.36, 0, 0, Math.PI * 2); g.fill();   // jacket
    g.fillStyle = '#e0c8a0'; g.beginPath(); g.ellipse(w * 0.4, h * 0.45, w * 0.17, h * 0.16, 0, 0, Math.PI * 2); g.fill();  // face
    g.fillStyle = '#3a2e22'; g.beginPath(); g.moveTo(w * 0.2, h * 0.36); g.lineTo(w * 0.6, h * 0.36); g.lineTo(w * 0.56, h * 0.27); g.lineTo(w * 0.24, h * 0.27); g.fill();   // flat cap
    g.fillRect(w * 0.18, h * 0.35, w * 0.46, h * 0.025);
    g.fillStyle = '#efe6d4'; g.beginPath(); g.ellipse(w * 0.4, h * 0.52, w * 0.15, h * 0.05, 0, 0, Math.PI); g.fill();     // the walrus moustache
    g.beginPath(); g.ellipse(w * 0.4, h * 0.515, w * 0.15, h * 0.028, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#2a2018'; for (const s of [-1, 1]) { g.fillRect(w * 0.4 + s * w * 0.07 - 4, h * 0.42, 8, 3); g.fillRect(w * 0.4 + s * w * 0.07 - 6, h * 0.395, 12, 3); }
    g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    return;
  }
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, who === 'eend' ? '#3a4a5a' : who === 'v1' ? '#4a2a2a' : '#2a3a2a'); bg.addColorStop(1, '#16120c');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // shoulders and the chain of office
  g.fillStyle = who === 'eend' ? '#f2eee2' : who === 'v1' ? '#2a2a3a' : '#20201c';
  g.beginPath(); g.ellipse(w / 2, h * 1.02, w * 0.46, h * 0.34, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8c060'; g.lineWidth = 5;
  g.beginPath(); g.arc(w / 2, h * 0.62, w * 0.24, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = '#e8c060'; g.beginPath(); g.arc(w / 2, h * 0.86, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a07a20'; g.beginPath(); g.arc(w / 2, h * 0.86, 4, 0, Math.PI * 2); g.fill();
  if (who === 'eend') {
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.22, h * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f08a1a'; g.beginPath(); g.ellipse(w / 2 + w * 0.17, h * 0.47, w * 0.13, h * 0.045, 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1208'; g.beginPath(); g.arc(w / 2 + w * 0.06, h * 0.38, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.moveTo(w / 2 - 6, h * 0.26); g.lineTo(w / 2 + 2, h * 0.19); g.lineTo(w / 2 + 6, h * 0.27); g.fill();
    return;
  }
  const skin = who === 'v1' ? '#c68c62' : '#e8b896';
  g.fillStyle = who === 'v1' ? '#1a1208' : '#9a9a96';
  g.beginPath(); g.ellipse(w / 2, h * (who === 'v1' ? 0.36 : 0.38), w * 0.21, h * 0.2, 0, 0, Math.PI * 2); g.fill();
  if (who === 'v1') { g.beginPath(); g.arc(w / 2, h * 0.16, w * 0.1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = skin; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.17, h * 0.17, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a1208';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * w * 0.065, h * 0.4, 3, 0, Math.PI * 2); g.fill(); }
  if (who === 'm1') { g.fillStyle = '#d8d8d4'; g.beginPath(); g.ellipse(w / 2, h * 0.5, w * 0.09, h * 0.028, 0, 0, Math.PI * 2); g.fill(); }
  else { g.strokeStyle = '#7a3028'; g.lineWidth = 2.5; g.beginPath(); g.arc(w / 2, h * 0.47, 8, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
}
// what is drawn on a whiteboard
function drawBoard(g, w, h, kind) {
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,130,140,.08)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(60 + k * 80, 40 + (k % 3) * 90, 70, 22, 0.3, 0, Math.PI * 2); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'horizon') {
    g.save(); g.translate(34, 62); g.rotate(-0.04); g.fillStyle = '#1f8a3a'; g.font = `700 40px ${HAND}`; g.fillText('STIP OP DE HORIZON', 0, 0); g.restore();
    g.strokeStyle = '#2a4ac0'; g.lineWidth = 5; g.beginPath(); g.moveTo(26, 192);
    for (let x = 26; x <= w - 26; x += 16) g.lineTo(x, 192 + Math.sin(x * 0.05) * 2);
    g.stroke();
    g.strokeStyle = '#e0a020'; g.lineWidth = 4; g.beginPath(); g.arc(110, 192, 34, Math.PI, 0); g.stroke();
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 5; g.beginPath(); g.moveTo(110 + Math.cos(a) * 44, 192 + Math.sin(a) * 44); g.lineTo(110 + Math.cos(a) * 58, 192 + Math.sin(a) * 58); g.stroke(); }
    g.fillStyle = '#111'; g.beginPath(); g.arc(388, 188, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c02a2a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(330, 246); g.quadraticCurveTo(352, 214, 380, 198); g.stroke();
    g.beginPath(); g.moveTo(380, 198); g.lineTo(366, 199); g.moveTo(380, 198); g.lineTo(374, 210); g.stroke();
    g.fillStyle = '#c02a2a'; g.font = `700 28px ${HAND}`; g.fillText('Is dit hem?', 214, 268);
    g.fillStyle = '#333'; g.font = `600 20px ${HAND}`; g.fillText('Actie: iedereen', 26, 268);
  }
}

Object.assign(OBJECT_KINDS, {
  // a Kantoorvondst or other find on a little stand: {kind: 'vondst', give: 'trinket:<id>'}
  vondst: {
    solid: false,
    build(o) {
      const info = ITEMS[o.def.give] || {}, color = o.def.color ?? info.color ?? 0xffd36b;
      o.base = o.def.stand === false ? 0.55 : 0.98;
      if (o.def.stand !== false) { o.box(0.5, 0.66, 0.5, 0x6e4a2c, 0, 0.33, 0); o.box(0.6, 0.06, 0.6, 0x8a5e38, 0, 0.69, 0); o.box(0.36, 0.02, 0.36, 0x9a2a2a, 0, 0.73, 0); }
      o.holder = new THREE.Group(); o.holder.position.y = o.base; o.group.add(o.holder);
      const shape = findShape(o, o.def.shape || info.shape || 'card', color); shape.rotation.x = 0.25; o.holder.add(shape);
      o.glow = glowSprite(color, 1.3, 0.45); o.holder.add(o.glow);
      o.taken = !!G.items[o.def.give];
      o.holder.visible = !o.taken;
      label(o, nameOfGive(o.def.give) || o.def.label, 1.85, {maxW: 22, color: '#ffe2a6'});
    },
    label: o => `Pak: ${nameOfGive(o.def.give) || o.def.label || 'wat hier ligt'}`,
    interactable: o => !o.taken && o.dist() < 2.4,
    interact(o) {
      o.taken = true; o.holder.visible = false;
      FX.burst(o.x, o.base, o.z, 26, {color: [o.def.color ?? ITEMS[o.def.give]?.color ?? 0xffd36b, 0xffffff], speed: 2.2, up: 1.6, life: 0.8});
      ON.give?.(o.def.give, o);
      ON.use[o.id]?.(o);
    },
    update(o, dt) {
      if (o.taken) { if (o.labelSp) o.labelSp.visible = false; return; }
      o.holder.rotation.y += dt * 1.3; o.holder.position.y = o.base + Math.sin(R.time * 2 + o.x) * 0.05;
      o.glow.material.opacity = 0.35 + Math.sin(R.time * 3 + o.z) * 0.1;
      show(o, 5);
    },
  },
  // a buzzword on a sticky note, for the vergaderbingo: {kind: 'bingo', give: 'bingo:<id>'} (on a wall; wall: false for an easel)
  bingo: {
    solid: false,
    build(o) {
      const id = String(o.def.give || '').split(':')[1], b = BINGO.find(x => x.id === id) || {word: '?'};
      o.word = b.word; o.bid = id;
      const tex = canvasTex(`bingo:${id}`, 256, 256, (g, w, h) => {
        const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#fff07a'); bg.addColorStop(1, '#f2d24a');
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, w, 34);
        g.fillStyle = '#7a5a10'; g.font = `700 19px 'DM Sans',system-ui,sans-serif`; g.textAlign = 'center'; g.fillText('VERGADERBINGO', w / 2, 24);
        g.fillStyle = '#2a2418'; g.font = `700 38px ${HAND}`;
        const lines = wrapLines(g, b.word, w - 36);
        lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + 14 + (i - (lines.length - 1) / 2) * 44));
        g.strokeStyle = 'rgba(122,90,16,.5)'; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.strokeRect(w - 54 + i * 13, h - 50 + j * 13, 11, 11);
      });
      const wall = o.def.wall !== false, y = wall ? 1.65 : 1.15, z = wall ? -0.92 : 0;
      if (!wall) { o.box(0.08, 1.2, 0.08, 0x6e4a2c, -0.3, 0.6, 0.1); o.box(0.08, 1.2, 0.08, 0x6e4a2c, 0.3, 0.6, 0.1); o.box(0.08, 1.2, 0.08, 0x6e4a2c, 0, 0.6, -0.25); }
      o.note = o.box(0.62, 0.62, 0.02, 0xffffff, 0, y, z, {m: {map: tex, emissive: 0x3a3008, emissiveIntensity: 0.35}});
      if (!wall) o.note.rotation.x = -0.2;
      o.box(0.06, 0.06, 0.03, 0xc03020, 0, y + 0.26, z + 0.02, {m: {emissive: 0x601010, emissiveIntensity: 0.6}});
      o.check = new THREE.Group(); o.check.position.set(0.12, y - 0.08, z + 0.03); o.group.add(o.check);
      const green = {m: {emissive: 0x1a8a3a, emissiveIntensity: 0.8}};
      const a = o.box(0.07, 0.2, 0.02, 0x2fbf5a, -0.08, -0.02, 0, green, o.check); a.rotation.z = 0.7;
      const c = o.box(0.07, 0.42, 0.02, 0x2fbf5a, 0.06, 0.06, 0, green, o.check); c.rotation.z = -0.55;
      o.glow = glowSprite(0xffe08a, 1.1, 0.3); o.glow.position.set(0, y, z + 0.2); o.group.add(o.glow);
    },
    label: o => (o.ticked ? `Vergaderbingo: ‘${o.word}’ is afgestreept` : `Streep af op je bingokaart: ‘${o.word}’`),
    interactable: o => !o.ticked && o.dist() < 2.6,
    interact(o) { o.ticked = true; ON.give?.(o.def.give, o); ON.use[o.id]?.(o); },
    update(o) {
      o.ticked = !!G.items[o.def.give] || G.bingo.includes(o.bid);
      o.check.visible = o.ticked;
      o.glow.material.opacity = o.ticked ? 0.06 : 0.25 + Math.sin(R.time * 2.4 + o.x) * 0.1;
    },
  },
  // a whiteboard that tells a story (and may tick a bingo square): {kind: 'whiteboard', draw, title, text, give}
  whiteboard: {
    solid: false,
    build(o) {
      o.box(2.62, 1.5, 0.06, 0x9aa0a8, 0, 1.75, -0.95);
      const tex = canvasTex(`wb:${o.def.draw}`, 512, 288, (g, w, h) => drawBoard(g, w, h, o.def.draw));
      o.box(2.46, 1.34, 0.02, 0xffffff, 0, 1.75, -0.91, {m: {map: tex, emissive: 0x2a2a2a, emissiveIntensity: 0.35}});
      o.box(2.3, 0.05, 0.16, 0x8a9098, 0, 1.03, -0.86);
      for (const [x, c] of [[-0.7, 0x2a8a3a], [-0.52, 0xc02a2a], [-0.34, 0x2a4ac0]]) o.box(0.14, 0.035, 0.035, c, x, 1.07, -0.84);
      o.box(0.18, 0.06, 0.08, 0x4a4a52, 0.7, 1.08, -0.85);
    },
    label: o => o.def.label || 'Lees het whiteboard',
    interactable: o => o.dist() < 2.8,
    async interact(o) {
      await UI.read(o.def.title || 'Het whiteboard', o.def.text || '');
      if (o.def.give && !G.items[o.def.give]) ON.give?.(o.def.give, o);
      ON.use[o.id]?.(o);
    },
  },
  // a small thing that tells a joke when you look at it (and may hide a secret):
  // {kind: 'ding', shape: 'duck' | 'clock' | 'book' | ..., color, label, title, text, secret, stand: false}
  ding: {
    solid: false,
    build(o) {
      const color = o.def.color ?? 0xffe08a;
      o.base = o.def.stand === false ? (o.def.y ?? 0.25) : 0.98;
      if (o.def.stand !== false) { o.box(0.5, 0.66, 0.5, 0x6e4a2c, 0, 0.33, 0); o.box(0.6, 0.06, 0.6, 0x8a5e38, 0, 0.69, 0); }
      o.holder = new THREE.Group(); o.holder.position.y = o.base; o.group.add(o.holder);
      o.holder.add(findShape(o, o.def.shape || 'card', color));
      if (o.def.glow !== false) { o.glow = glowSprite(color, 1.0, 0.25); o.holder.add(o.glow); }
      if (o.def.label) label(o, o.def.label, o.base + 0.85, {maxW: 22});
    },
    label: o => o.def.label || 'Bekijk het',
    interactable: o => o.dist() < 2.4,
    interact: o => (ON.use[o.id] ? ON.use[o.id](o) : UI.read(o.def.title || o.def.label || 'Iets', o.def.text || '')),
    update(o) { if (o.def.bob !== false) o.holder.position.y = o.base + Math.sin(R.time * 1.6 + o.x) * 0.04; if (o.labelSp) show(o, 5); },
  },
  // walk in, find a secret: {kind: 'geheim', secret: '<id>', r: 1.6} (invisible)
  geheim: {
    solid: false,
    build(o) { o.found = G.secrets.includes(o.def.secret); },
    interactable: () => false,
    update(o) { if (!o.found && o.dist() < (o.def.r ?? 1.6)) { o.found = true; findSecret(o.def.secret); } },
  },
  // the wethouder's mailbox, on a wall
  brievenbus: {
    solid: false,
    build(o) {
      const red = o.mat(0xb8302a, {emissive: 0x2a0806, emissiveIntensity: 0.5});
      o.box(0.72, 0.92, 0.34, 0, 0, 1.36, -0.79, {material: red});
      o.box(0.78, 0.1, 0.4, 0x8a2420, 0, 1.86, -0.79);
      o.box(0.48, 0.05, 0.04, 0x1a1010, 0, 1.6, -0.61);
      [[-0.16, 0xffffff, 0.15], [-0.04, 0xf4dce8, -0.1], [0.08, 0xffffff, 0.05], [0.19, 0xd8e8ff, -0.2]].forEach(([x, c, rz], i) => {
        const l = o.box(0.2, 0.15 + i * 0.02, 0.02, c, x, 1.68 + i * 0.012, -0.6, {m: {emissive: 0x3a3a3a, emissiveIntensity: 0.3}}); l.rotation.z = rz;
      });
      o.box(0.44, 0.14, 0.01, 0xfff4d8, 0, 1.22, -0.615, {m: {emissive: 0x4a4030, emissiveIntensity: 0.5}});
      label(o, 'Wethouder Hendriks · graag op papier', 2.4, {maxW: 18, size: 26});
    },
    label: () => 'Kijk in de brievenbus van de wethouder',
    interactable: o => o.dist() < 2.4,
    interact: o => (ON.use[o.id] ? ON.use[o.id](o) : UI.read(o.def.title || 'De brievenbus', o.def.text || '')),
    update(o) { show(o, 6); },
  },
  // the kantine fridge, with a war of notes on it
  fridge: {
    r: 0.55,
    build(o) {
      o.box(0.95, 1.95, 0.72, 0xe8e6e0, 0, 0.975, -0.55);
      o.box(0.97, 0.03, 0.74, 0xb8b6b0, 0, 1.3, -0.55);
      o.box(0.05, 0.42, 0.06, 0xa8a8a8, 0.36, 1.62, -0.17); o.box(0.05, 0.36, 0.06, 0xa8a8a8, 0.36, 0.98, -0.17);
      [[-0.18, 1.62, 0xfff07a, 0.08], [0.06, 1.52, 0xffb8d8, -0.12], [-0.12, 1.08, 0xbfe0ff, 0.05], [0.1, 0.84, 0xfff07a, -0.06]].forEach(([x, y, c, rz]) => {
        const n = o.box(0.22, 0.22, 0.01, c, x, y, -0.185, {m: {emissive: c, emissiveIntensity: 0.18}}); n.rotation.z = rz;
        o.box(0.04, 0.04, 0.02, 0xc03020, x, y + 0.09, -0.18);
      });
    },
    label: () => 'Lees de briefjes op de koelkast',
    interactable: o => o.dist() < 2.4,
    interact: o => (ON.use[o.id] ? ON.use[o.id](o) : UI.read(o.def.title || 'De koelkast', o.def.text || '')),
  },
  // the vending machine with one bar that has been hanging there since 2011
  snoep: {
    r: 0.6,
    build(o) {
      o.box(1.05, 1.95, 0.8, 0x2a5a6a, 0, 0.975, -0.5, {m: {emissive: 0x05141a, emissiveIntensity: 0.6}});
      o.box(0.7, 1.24, 0.02, 0xbfe8ff, -0.12, 1.27, -0.09, {m: {emissive: 0x6aa8c8, emissiveIntensity: 0.55}});
      const cols = [0xd84a3a, 0xf0c040, 0x4a8ad8, 0x8ad84a, 0xd88ad8, 0xf08a2a];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o.box(0.12, 0.16, 0.08, cols[(r * 4 + c) % cols.length], -0.36 + c * 0.16, 0.8 + r * 0.3, -0.16);
      o.stuck = o.box(0.12, 0.16, 0.08, 0xffd36b, 0.12, 1.69, -0.14, {m: {emissive: 0x6a4a08, emissiveIntensity: 0.5}}); o.stuck.rotation.x = 0.7; o.stuck.rotation.z = 0.3;
      o.box(0.22, 0.42, 0.02, 0x1a1a1e, 0.36, 1.32, -0.09);
      for (let k = 0; k < 6; k++) o.box(0.05, 0.04, 0.01, 0x9aa0a8, 0.31 + (k % 2) * 0.1, 1.44 - Math.floor(k / 2) * 0.08, -0.08);
      o.box(0.62, 0.18, 0.04, 0x111114, -0.12, 0.4, -0.09);
      o.glow = glowSprite(0x9fd8ff, 1.8, 0.25); o.glow.position.set(-0.1, 1.3, 0.1); o.group.add(o.glow);
      o.shake = 0;
    },
    label: () => (G.flags.reep ? 'De snoepautomaat (de reep is eruit)' : 'Probeer de snoepautomaat'),
    interactable: o => o.dist() < 2.4,
    interact: o => { o.shake = 0.6; return ON.use[o.id]?.(o); },
    update(o, dt) {
      o.stuck.visible = !G.flags.reep;
      if (o.shake > 0) { o.shake = Math.max(0, o.shake - dt); o.group.rotation.z = Math.sin(R.time * 40) * 0.025 * o.shake; } else if (o.group.rotation.z) o.group.rotation.z = 0;
    },
  },
  // a painting in a gold frame: {kind: 'portret', face: 'm1' | 'v1' | 'eend', title, text}
  portret: {
    solid: false,
    build(o) {
      o.box(1.0, 1.26, 0.08, 0xc8a050, 0, 1.95, -0.94, {m: {emissive: 0x3a2808, emissiveIntensity: 0.6}});
      const tex = canvasTex(`portret:${o.def.face}`, 160, 200, (g, w, h) => drawPortrait(g, w, h, o.def.face));
      o.box(0.82, 1.06, 0.02, 0xffffff, 0, 1.95, -0.895, {m: {map: tex, emissive: 0x201810, emissiveIntensity: 0.3}});
      o.box(0.46, 0.11, 0.03, 0xd8b050, 0, 1.22, -0.9, {m: {emissive: 0x4a3010, emissiveIntensity: 0.5}});
    },
    label: o => `Bekijk het portret: ${o.def.title}`,
    interactable: o => o.dist() < 2.6,
    interact: o => (ON.use[o.id] ? ON.use[o.id](o) : UI.read(o.def.title, o.def.text || '')),
  },
  // the Reprografie printer: a big office machine that (almost) never works
  printer: {
    r: 0.65,
    build(o) {
      const body = o.mat(0xdcdad4), dark = o.mat(0x3a3c42);
      o.box(1.25, 1.02, 0.92, 0, 0, 0.51, -0.1, {material: body});
      for (const y of [0.18, 0.42]) o.box(1.1, 0.02, 0.02, 0x9a9890, 0, y, 0.37);
      o.box(1.3, 0.06, 0.96, 0, 0, 1.05, -0.1, {material: dark});
      o.box(1.12, 0.24, 0.8, 0, 0, 1.2, -0.16, {material: body});
      o.box(0.74, 0.04, 0.46, 0x3a3c42, 0.1, 0.78, 0.42);
      o.paper = o.box(0.5, 0.02, 0.34, 0xffffff, 0.1, 0.81, 0.4, {m: {emissive: 0x605a50, emissiveIntensity: 0.3}});
      o.box(0.34, 0.16, 0.03, 0x1a1c20, -0.38, 1.1, 0.4);
      o.screen = o.box(0.26, 0.1, 0.02, 0x2a3a2a, -0.38, 1.1, 0.42, {m: {emissive: 0x40c060, emissiveIntensity: 0.5}});
      o.led = o.box(0.05, 0.05, 0.02, 0xff3020, -0.12, 1.1, 0.42, {m: {emissive: 0xff3020, emissiveIntensity: 1.2}});
      o.glow = glowSprite(0xff5040, 0.7, 0.5); o.glow.position.set(-0.12, 1.1, 0.5); o.group.add(o.glow);
      o.printT = 0;
    },
    label: () => (G.flags.printer_ok ? 'De printer (hij doet het!)' : 'Probeer iets te printen'),
    interactable: o => o.dist() < 2.6,
    interact: o => ON.use[o.id]?.(o),
    update(o, dt) {
      const ok = !!G.flags.printer_ok, on = ok || Math.sin(R.time * 6) > 0, c = ok ? 0x40ff70 : 0xff3020;
      if (o.ledC !== c) { o.ledC = c; o.led.material.color.setHex(c); o.led.material.emissive.setHex(c); o.glow.material.color.setHex(c); }
      o.led.material.emissiveIntensity = on ? 1.2 : 0.1; o.glow.material.opacity = on ? 0.5 : 0.08;
      o.screen.material.emissiveIntensity = 0.4 + Math.sin(R.time * 11) * 0.06;
      if (o.printT > 0) { o.printT = Math.max(0, o.printT - dt); const k = 1 - o.printT / 1.4; o.paper.position.z = 0.4 + k * 0.3; o.paper.position.y = 0.81 - k * 0.05; }
    },
  },
});
