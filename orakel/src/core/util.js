// Small shared helpers: maths, seeded randomness, colours, DOM.
export const PI = Math.PI, TAU = Math.PI * 2, DEG = Math.PI / 180;
export const TILE = 2;               // one map character is a 2 x 2 metre tile
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const wrapAngle = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
export const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const tileOf = v => Math.floor(v / TILE);
export const centerOf = t => t * TILE + TILE / 2;

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x, z, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hashString = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export const rgb = hex => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
// sRGB hex to linear components, matching what three.js does with THREE.Color
export function linear(hex) {
  return rgb(hex).map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}

export const $ = id => document.getElementById(id);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
export const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h} u ${m} min` : `${m} min`; };
export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
