// Procedural pixel textures. Everything is painted at start-up from a seed, so the
// page needs no image files. Textures are near-neutral; zones tint them through
// vertex colours, so one brick texture serves the warm cellar and the blue vault.
import * as THREE from 'three';
import {makeRng, clamp} from '../core/util.js';

function canvasTexture(size, paint, {repeat = true, nearest = true, h = size} = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(size, h);
  const put = (x, y, r, gr, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= h) return;
    const i = (y * size + x) * 4;
    img.data[i] = clamp(r, 0, 255); img.data[i + 1] = clamp(gr, 0, 255); img.data[i + 2] = clamp(b, 0, 255); img.data[i + 3] = a;
  };
  paint(put, size, h, g);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.canvas = c;
  return t;
}

const N = r => r() * 2 - 1;

const PAINTERS = {
  // warm or cold masonry: 4 courses of 1 m bricks per 2 m
  brick(put, s) {
    const r = makeRng(11), tone = {};
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const row = y >> 3, off = row % 2 ? 8 : 0, bx = ((x + off) >> 4) % 2, id = row * 4 + bx;
      tone[id] ??= N(r) * 16;
      const mortar = y % 8 === 7 || (x + off) % 16 === 15;
      if (mortar) { const v = 70 + N(r) * 6; put(x, y, v, v - 2, v - 4); continue; }
      const edge = y % 8 === 0 ? 10 : y % 8 === 6 ? -10 : 0;
      const v = 158 + tone[id] + N(r) * 9 + edge + ((x * 7 + y * 3) % 5 === 0 ? -6 : 0);
      put(x, y, v, v - 4, v - 9);
    }
  },
  // big dressed blocks of the old vault
  ashlar(put, s) {
    const r = makeRng(23), tone = {};
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const row = y >> 4, off = row % 2 ? 16 : 0, bx = ((x + off) >> 5) % 2, id = row * 2 + bx;
      tone[id] ??= N(r) * 12;
      const lx = (x + off) % 32, ly = y % 16;
      if (ly === 15 || lx === 31) { const v = 64 + N(r) * 5; put(x, y, v, v, v + 2); continue; }
      const bevel = ly === 0 || lx === 0 ? 14 : ly === 14 || lx === 30 ? -14 : 0;
      const crack = (Math.abs(lx - 12 - (ly >> 1)) < 1 && id % 3 === 0 && ly > 3 && ly < 12) ? -30 : 0;
      const v = 150 + tone[id] + N(r) * 7 + bevel + crack;
      put(x, y, v, v, v + 3);
    }
  },
  // floor flagstones
  flag(put, s) {
    const r = makeRng(31), tone = {};
    const cells = [[0, 0, 18, 13], [18, 0, 14, 9], [18, 9, 14, 11], [0, 13, 11, 19], [11, 13, 7, 9], [11, 22, 21, 10], [18, 20, 14, 2]];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let k = cells.findIndex(([cx, cy, w, h]) => x >= cx && x < cx + w && y >= cy && y < cy + h);
      if (k < 0) k = 0;
      const [cx, cy, w, h] = cells[k];
      tone[k] ??= N(r) * 14;
      if (x === cx || y === cy) { const v = 72 + N(r) * 6; put(x, y, v, v - 2, v - 5); continue; }
      const edge = x === cx + 1 || y === cy + 1 ? 8 : x === cx + w - 1 || y === cy + h - 1 ? -8 : 0;
      const v = 150 + tone[k] + N(r) * 10 + edge;
      put(x, y, v, v - 3, v - 8);
    }
  },
  cobble(put, s) {
    const r = makeRng(41), pts = [];
    for (let i = 0; i < 14; i++) pts.push([r() * s, r() * s, N(r) * 18]);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let d1 = 1e9, d2 = 1e9, t = 0;
      for (const [px, py, tn] of pts) for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const d = Math.hypot(x - px - ox, y - py - oy);
        if (d < d1) { d2 = d1; d1 = d; t = tn; } else if (d < d2) d2 = d;
      }
      const gap = d2 - d1 < 1.6;
      const v = gap ? 64 + N(r) * 6 : 140 + t + N(r) * 9 + (d1 < 2.5 ? 10 : 0);
      put(x, y, v, v - 2, v - 6);
    }
  },
  plank(put, s) {
    const r = makeRng(53), tone = [];
    for (let i = 0; i < 4; i++) tone.push(N(r) * 14);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const p = x >> 3, lx = x % 8, shift = (p * 13) % s;
      const seam = lx === 7 || (y + shift) % s === 0;
      const grain = Math.sin((y + p * 11) * 0.7 + Math.sin(x * 1.3) * 0.8) * 7;
      const nail = (lx === 1 || lx === 5) && (y + shift) % s === 2;
      const v = seam ? 62 : nail ? 50 : 146 + tone[p] + grain + N(r) * 6;
      put(x, y, v, v * 0.74, v * 0.5);
    }
  },
  panel(put, s) {
    const r = makeRng(59);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const lx = x % 16, ly = y % 32;
      const frame = lx < 2 || lx > 13 || ly < 2 || ly > 29;
      const bevel = (lx === 2 || ly === 2) ? 14 : (lx === 13 || ly === 29) ? -14 : 0;
      const grain = Math.sin(y * 0.9 + x * 0.15) * 5;
      const v = (frame ? 120 : 140) + grain + bevel + N(r) * 5;
      put(x, y, v, v * 0.72, v * 0.48);
    }
  },
  plaster(put, s) {
    const r = makeRng(61);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 196 + N(r) * 7 + (r() < 0.02 ? -18 : 0);
      put(x, y, v, v - 2, v - 7);
    }
  },
  tiles(put, s) {
    const r = makeRng(67);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const tx = x >> 3, ty = y >> 3, dark = (tx + ty) % 2 === 0;
      const grout = x % 8 === 7 || y % 8 === 7;
      const v = grout ? 92 : (dark ? 104 : 196) + N(r) * 6 + (x % 8 === 0 || y % 8 === 0 ? 8 : 0);
      put(x, y, v, v - 2, v - 4);
    }
  },
  carpet(put, s) {
    const r = makeRng(71);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = Math.abs(x - 15.5), dy = Math.abs(y - 15.5);
      const diamond = Math.abs(dx + dy - 10) < 1.2;
      const dot = (x + y) % 8 === 0 && (x - y + 64) % 8 === 0;
      const v = 150 + N(r) * 8;
      if (diamond) put(x, y, 196, 156, 92); else if (dot) put(x, y, 176, 136, 80);
      else put(x, y, v * 0.82, v * 0.36, v * 0.3);
    }
  },
  // books on shelves: the library walls
  shelf(put, s) {
    const r = makeRng(79), cols = [[120, 30, 26], [34, 76, 44], [32, 46, 104], [150, 108, 40], [84, 44, 22], [28, 88, 92], [130, 116, 90], [96, 40, 90]];
    for (let row = 0; row < 4; row++) {
      let x = 0;
      while (x < s) {
        const w = 1 + Math.floor(r() * 3), h = 4 + Math.floor(r() * 3), c = cols[Math.floor(r() * cols.length)], tilt = r() < 0.1;
        for (let bx = x; bx < Math.min(s, x + w); bx++) for (let by = 0; by < 8; by++) {
          const y = row * 8 + by;
          if (by === 7) { put(bx, y, 88, 60, 36); continue; }
          if (by < 7 - h || (tilt && bx === x && by < 7 - h + 1)) { put(bx, y, 26, 20, 16); continue; }
          const band = by === 7 - h + 1 ? 30 : 0, sh = bx === x ? -18 : 0;
          put(bx, y, c[0] + band + sh + N(r) * 6, c[1] + band + sh + N(r) * 6, c[2] + band + sh + N(r) * 6);
        }
        x += w;
      }
    }
  },
  rough(put, s) {
    const r = makeRng(83);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 112 + N(r) * 16 + Math.sin(x * 0.6) * Math.cos(y * 0.5) * 8;
      put(x, y, v, v, v + 4);
    }
  },
  beam(put, s) {
    const r = makeRng(89);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const beam = (x % 16) < 5;
      const grain = Math.sin(y * 0.8 + x * 0.2) * 6;
      const v = beam ? 108 + grain + N(r) * 5 : 70 + N(r) * 6;
      put(x, y, v, v * 0.74, v * 0.52);
    }
  },
  metal(put, s) {
    const r = makeRng(97);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const lx = x % 16, ly = y % 16;
      const seam = lx === 15 || ly === 15, rivet = (lx === 2 || lx === 13) && (ly === 2 || ly === 13);
      const v = seam ? 60 : rivet ? 190 : 124 + N(r) * 7 + (lx === 0 || ly === 0 ? 10 : 0);
      put(x, y, v, v + 2, v + 6);
    }
  },
  grate(put, s) {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const bar = x % 4 === 0 || y % 4 === 0;
      const v = bar ? 120 : 26;
      put(x, y, v, v + 2, v + 6);
    }
  },
  marble(put, s) {
    const r = makeRng(101);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const vein = Math.abs(Math.sin(x * 0.18 + Math.sin(y * 0.21) * 2.4 + y * 0.05)) < 0.06;
      const tile = x % 16 === 15 || y % 16 === 15;
      const v = tile ? 120 : vein ? 150 : 206 + N(r) * 6;
      put(x, y, v, v - 2, v + 2);
    }
  },
  // dark machine panels with circuit lines; paired with an emissive mask
  circuit(put, s) {
    const r = makeRng(103);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const line = (y % 8 === 3 && (x + y) % 16 < 11) || (x % 16 === 9 && y % 16 > 4);
      const node = x % 16 === 9 && y % 8 === 3;
      const v = 40 + N(r) * 5;
      if (node) put(x, y, 255, 230, 160); else if (line) put(x, y, 200, 160, 70); else put(x, y, v, v, v + 6);
    }
  },
  paper(put, s) {
    const r = makeRng(107);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const line = y % 4 === 2 && x > 3 && x < s - 4 - ((y * 7) % 9);
      const v = line ? 120 : 226 + N(r) * 6;
      put(x, y, v, v - 4, v - 14);
    }
  },
  gold(put, s) {
    const r = makeRng(109);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const sp = r() < 0.05 ? 50 : 0;
      const v = 190 + N(r) * 20 + sp;
      put(x, y, v, v * 0.8, v * 0.36);
    }
  },
  noise(put, s) {
    const r = makeRng(113);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = 220 + N(r) * 22; put(x, y, v, v, v); }
  },
};

export const TEXTURE_NAMES = Object.keys(PAINTERS);

export function makeTextures() {
  const tex = {};
  for (const [name, paint] of Object.entries(PAINTERS)) tex[name] = canvasTexture(32, paint);
  return tex;
}

// A soft round sprite for particles, flames and glows.
export function glowTexture() {
  return canvasTexture(64, (put, s) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
      const a = Math.max(0, 1 - d);
      put(x, y, 255, 255, 255, Math.round(255 * a * a));
    }
  }, {repeat: false, nearest: false});
}

// Text drawn onto a canvas: signs, plaques, banners.
export function labelTexture(lines, {w = 512, h = 256, bg = '#2a1f16', ink = '#f1e3c2', border = '#b48a4a', font = 'Cinzel, Georgia, serif', size = 44, sub = 24} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 2; g.strokeRect(24, 24, w - 48, h - 48); }
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const total = lines.length;
  lines.forEach((line, i) => {
    const big = i === 0;
    g.font = `${big ? 700 : 500} ${big ? size : sub}px ${font}`;
    const y = h / 2 + (i - (total - 1) / 2) * (big ? size * 1.1 : sub * 1.5) + (total > 1 && !big ? size * 0.15 : 0);
    let text = line;
    while (g.measureText(text).width > w - 70 && text.length > 3) text = text.slice(0, -2) + '…';
    g.fillText(text, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
