// What the puzzle objects look like. Their meaning lives in the story files (ON.use / ON.place / ON.hit).
import * as THREE from 'three';
import {OBJECT_KINDS} from '../game/entities.js';
import {glowSprite} from '../engine/models.js';
import {R} from '../engine/render.js';
import {P, UI, SFX, ON} from '../game/bus.js';
import {FX} from '../engine/particles.js';
import {chamberState} from '../game/bus.js';

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
