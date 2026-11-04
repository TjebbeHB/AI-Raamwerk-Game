// Portraits: JRPG / visual-novel faces for the one-on-one conversations, drawn as procedural
// pixel art. A 96 x 96 bust is painted into typed arrays (a part id and a shade tone per pixel),
// then it gets contact shadows, clean outlines, a rim light and a framed panel tinted with the
// character's colour. Everything follows the LOOK SCHEMA (game/hero.js), so the 3D model, the
// creator and the portrait agree on hair, colours, glasses, facial hair and clothes.
//
// subject: a cast id ('glans3' follows its alias to 'glans'), 'you' (the hero, with an archetype
// badge), a look object (old cast specs work too) or {kind: 'pip' | 'spark' | 'cloud' | 'owl' |
// 'padlock' | 'gnome' | 'kobold' | 'orakel' | 'fabulant', color}. mood: one of MOODS.
//   drawPortrait(canvas, subject, {mood, mouth 0..1, blink 0..1, size, frame, flip, badge})
//   portraitURL(subject, mood, {scale = 2}) -> cached PNG data URL (also UI.portraitURL)
//   portraitImg(subject, mood, {size}) -> <img class="portrait">
//   startTalking(canvas, subject, mood) / stopTalking(canvas) / showPortrait / hidePortrait(canvas)
//   preloadPortraits(subjects, moods), hasPortrait(subject), renderPortrait (pure, no DOM: tests)
// Show canvases and images with class "portrait" (image-rendering: pixelated) at 96, 192 or 288 px.
import {UI, CAST} from '../game/bus.js';
import {SETTINGS} from '../game/state.js';
import {DEFAULT_LOOK, heroLook, archetype} from '../game/hero.js';
import {addStyles} from '../core/util.js';

export const PORTRAIT_SIZE = 96;
export const MOODS = ['neutral', 'happy', 'laugh', 'sad', 'angry', 'surprised', 'worried', 'smug', 'thinking', 'tired'];
const N = 96, NN = N * N;
const LINE = 0, SH2 = 1, SH = 2, BASE = 3, LIT = 4, HI = 5;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampv = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- colour
const cr = h => (h >> 16) & 255, cg = h => (h >> 8) & 255, cb = h => h & 255;
const c255 = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const pack = (r, g, b) => (c255(r) << 16) | (c255(g) << 8) | c255(b);
export const mix = (a, b, t) => pack(cr(a) + (cr(b) - cr(a)) * t, cg(a) + (cg(b) - cg(a)) * t, cb(a) + (cb(b) - cb(a)) * t);
function toHsl(c) {
  const r = cr(c) / 255, g = cg(c) / 255, b = cb(c) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; s = clamp01(s); l = clamp01(l);
  if (!s) return pack(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return pack(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
}
// move hue h toward t by fraction k along the short way round, but never more than max degrees
const hueTo = (h, t, k, max = 180) => { const d = ((((t - h) % 360) + 540) % 360 - 180) * k; return h + (d > max ? max : d < -max ? -max : d); };
export const luma = c => (cr(c) * 0.299 + cg(c) * 0.587 + cb(c) * 0.114) / 255;
// Six hue-shifted tones per colour: shadows lean cool (skin: rosy, metal: brown), lights lean warm.
// [0 line, 1 deep shadow, 2 shadow, 3 base, 4 light, 5 highlight]
const RAMPS = new Map();
function ramp(hex, kind = 0) {           // kind: 0 cloth, 1 skin, 2 hair, 3 glowing, 4 metal
  const key = hex * 8 + kind;
  let r = RAMPS.get(key);
  if (r) return r;
  const [h, s, l] = toHsl(hex), grey = s < 0.07;
  const cool = kind === 1 ? 350 : kind === 4 ? 28 : 246, warm = kind === 1 ? 36 : 52, hc = grey ? cool : h, hw = grey ? warm : h, add = grey ? 0.05 : kind === 3 ? 0.04 : 0.1;
  const dk = kind === 3 ? [0.55, 0.72, 0.86] : kind === 4 ? [0.3, 0.56, 0.78] : [0.34, 0.6, 0.8];
  r = [
    fromHsl(hueTo(hc, cool, 0.32, 24), s + add * 1.3, l * dk[0] + 0.012),
    fromHsl(hueTo(hc, cool, 0.2, 16), s + add, l * dk[1]),
    fromHsl(hueTo(hc, cool, 0.1, 9), s + add * 0.5, l * dk[2]),
    hex,
    fromHsl(hueTo(hw, warm, 0.08, 6), s * 0.96, l + (1 - l) * (kind === 3 ? 0.35 : 0.2)),
    fromHsl(hueTo(hw, warm, 0.16, 10), s * (kind === 4 ? 0.7 : 0.85), l + (1 - l) * (kind === 3 ? 0.7 : kind === 4 ? 0.6 : 0.46)),
  ];
  RAMPS.set(key, r);
  return r;
}

// ---------------------------------------------------------------- raster core
// Every pixel has a part (0 = background), a tone into that part's ramp, or an override colour.
const PART = new Uint8Array(NN), TONE = new Uint8Array(NN), OVER = new Int32Array(NN), FLAG = new Uint8Array(NN);
const XS = new Float64Array(96);
let PARTS = [null], FLIP = false;
function begin() { PART.fill(0); TONE.fill(BASE); OVER.fill(0x1a120c); FLAG.fill(0); PARTS = [null]; }
// a part: its ramp and how it takes outlines (line), soft inner lines, rim light, the shadow it casts below (cast)
function part(r, o = {}) { PARTS.push({r, line: true, soft: false, rim: true, cast: 0, recv: true, ink: null, ...o}); return PARTS.length - 1; }
const sh0 = (sh, x, y) => (typeof sh === 'number' ? sh : sh(x, y));
function plotter(p, sh, clip) {
  return (x, y) => { if (clip && !clip(x, y)) return; const i = y * N + x; PART[i] = p; TONE[i] = sh0(sh, x, y); OVER[i] = -1; };
}
function eachEll(cx, cy, rx, ry, f) {
  if (rx <= 0 || ry <= 0) return;
  const y0 = Math.max(0, Math.ceil(cy - ry - 0.5)), y1 = Math.min(N - 1, Math.floor(cy + ry - 0.5));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry, k = 1 - dy * dy;
    if (k < 0) continue;
    const hw = rx * Math.sqrt(k), x0 = Math.max(0, Math.ceil(cx - hw - 0.5)), x1 = Math.min(N - 1, Math.floor(cx + hw - 0.5));
    for (let x = x0; x <= x1; x++) f(x, y);
  }
}
function eachPoly(pts, f) {
  let ymin = 1e9, ymax = -1e9;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < ymin) ymin = pts[i]; if (pts[i] > ymax) ymax = pts[i]; }
  const y0 = Math.max(0, Math.ceil(ymin - 0.5)), y1 = Math.min(N - 1, Math.floor(ymax - 0.5)), n2 = pts.length;
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    let n = 0;
    for (let i = 0, j = n2 - 2; i < n2; j = i, i += 2) {
      const ay = pts[i + 1], by = pts[j + 1];
      if ((ay > sy) !== (by > sy)) XS[n++] = pts[i] + ((sy - ay) / (by - ay)) * (pts[j] - pts[i]);
    }
    for (let a = 1; a < n; a++) { const v = XS[a]; let b = a - 1; while (b >= 0 && XS[b] > v) { XS[b + 1] = XS[b]; b--; } XS[b + 1] = v; }
    for (let k = 0; k + 1 < n; k += 2) {
      const x0 = Math.max(0, Math.ceil(XS[k] - 0.5)), x1 = Math.min(N - 1, Math.floor(XS[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) f(x, y);
    }
  }
}
const ell = (p, cx, cy, rx, ry, sh = BASE, clip) => eachEll(cx, cy, rx, ry, plotter(p, sh, clip));
const poly = (p, pts, sh = BASE, clip) => eachPoly(pts, plotter(p, sh, clip));
function rect(p, x0, y0, x1, y1, sh = BASE, clip) { const f = plotter(p, sh, clip); for (let y = Math.max(0, y0); y <= Math.min(N - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) f(x, y); }
// masks: undefined = anywhere, -1 = any figure pixel, a part id, an array of ids, or a function of the index
const inMask = (i, m) => (m === undefined ? true : m === -1 ? PART[i] > 0 : typeof m === 'number' ? PART[i] === m : Array.isArray(m) ? m.includes(PART[i]) : m(i));
function dot(x, y, col, m) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x; if (inMask(i, m)) OVER[i] = col; }
function tone(x, y, t, m) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x; if (inMask(i, m) && PART[i]) { TONE[i] = t; OVER[i] = -1; } }
const toneMin = (x, y, t, m) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x; if (inMask(i, m) && PART[i] && OVER[i] < 0 && TONE[i] > t) TONE[i] = t; };
// a plotter that sets a tone on one part only (lines drawn over hair, cloth)
const onPart = (p, t) => (x, y) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x; if (PART[i] === p && OVER[i] < 0) TONE[i] = t; };
const paintEll = (cx, cy, rx, ry, col, m) => eachEll(cx, cy, rx, ry, (x, y) => dot(x, y, col, m));
const toneEll = (cx, cy, rx, ry, t, m) => eachEll(cx, cy, rx, ry, (x, y) => tone(x, y, t, m));
function line(x0, y0, x1, y1, f) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 400; n++) { f(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// a quadratic curve as a run of touching pixels
function quad(x0, y0, qx, qy, x1, y1, f) {
  const n = Math.ceil(Math.hypot(qx - x0, qy - y0) + Math.hypot(x1 - qx, y1 - qy)) * 2 + 2;
  let px = Math.round(x0), py = Math.round(y0);
  f(px, py);
  for (let k = 1; k <= n; k++) {
    const t = k / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    const x = Math.round(a * x0 + b * qx + c * x1), y = Math.round(a * y0 + b * qy + c * y1);
    if (x !== px || y !== py) { f(x, y); px = x; py = y; }
  }
}
// a thick polyline as quads (for straps, braids, cords)
function strip(p, pts, w, sh = BASE, clip) {
  for (let k = 0; k + 3 < pts.length; k += 2) {
    const [x0, y0, x1, y1] = [pts[k], pts[k + 1], pts[k + 2], pts[k + 3]], len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / len) * w / 2, ny = ((x1 - x0) / len) * w / 2;
    poly(p, [x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], sh, clip);
  }
}
// a sphere-ish light from the upper left, banded
function ball(cx, cy, rx, ry, bias = 0, top = LIT) {
  return (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = -0.55 * nx - 0.6 * ny + 0.58 * nz + bias;
    return l > 0.86 ? Math.min(HI, top + 1) : l > 0.56 ? top : l > 0.06 ? BASE : l > -0.32 ? SH : SH2;
  };
}
// 3 x 5 pixel letters for the mug and the tickets; under FLIP they are drawn mirrored so the final flip reads right
const FONT = {A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', G: '011100101101011', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', W: '101101111111101', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010'};
function text(str, x, y, col, m) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const base = ch === 'Ë' ? 'E' : ch, g = FONT[base];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1') dot(FLIP ? 2 * x + str.length * 4 - 2 - (cx + c) : cx + c, y + r, col, m);
    if (ch === 'Ë') { dot(FLIP ? 2 * x + str.length * 4 - 2 - cx : cx, y - 2, col, m); dot(FLIP ? 2 * x + str.length * 4 - 2 - (cx + 2) : cx + 2, y - 2, col, m); }
    cx += 4;
  }
}

// ---------------------------------------------------------------- finishing passes
function passes() {
  // contact shadows: a caster darkens what lies just below it (and a little to the right: light from the upper left)
  for (let y = 1; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, p = PART[i];
    if (!p || !PARTS[p].recv) continue;
    for (let d = 1; d <= 4 && y - d >= 0; d++) {
      const xx = x - (d >> 1); if (xx < 0) break;
      const q = PART[(y - d) * N + xx];
      if (q > p && PARTS[q].cast >= d) { TONE[i] = d === 1 && TONE[i] <= SH ? SH2 : Math.min(TONE[i], SH); break; }
    }
  }
  // outlines: the front part of every boundary gets the line, the silhouette a dark ink
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, p = PART[i];
    if (!p || !PARTS[p].line) continue;
    let sil = false, inner = false;
    if (x > 0) { const q = PART[i - 1]; if (!q) sil = true; else if (q < p) inner = true; }
    if (x < N - 1) { const q = PART[i + 1]; if (!q) sil = true; else if (q < p) inner = true; }
    if (y > 0) { const q = PART[i - N]; if (!q) sil = true; else if (q < p) inner = true; }
    if (y < N - 1) { const q = PART[i + N]; if (!q) sil = true; else if (q < p) inner = true; }
    if (sil) FLAG[i] = 2; else if (inner) FLAG[i] = 1;
  }
  // rim light on edges facing the upper right
  for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) {
    const i = y * N + x, p = PART[i];
    if (!p || FLAG[i] || !PARTS[p].rim) continue;
    const r = i + 1;
    if (FLAG[r] === 2 || !PART[r] || (y > 0 && x > 44 && FLAG[i - N] === 2 && FLAG[r - N] === 2)) FLAG[i] = 4;
  }
}
function compose(out, rimCol, transparent) {
  for (let i = 0; i < NN; i++) {
    const p = PART[i], f = FLAG[i];
    let c, a = 255;
    if (!p) { c = OVER[i]; if (transparent) a = 0; }
    else {
      const P = PARTS[p];
      if (f === 2) c = P.ink ?? mix(P.r[LINE], 0x120a0e, 0.5);
      else if (f === 1) c = P.r[P.soft ? SH2 : LINE];
      else c = OVER[i] >= 0 ? OVER[i] : P.r[TONE[i]];
      if (f === 4) c = mix(c, rimCol, 0.4);
    }
    const j = (FLIP ? (i - (i % N)) + (N - 1 - (i % N)) : i) * 4;
    out[j] = cr(c); out[j + 1] = cg(c); out[j + 2] = cb(c); out[j + 3] = a;
  }
}

// ---------------------------------------------------------------- the panel and its frame
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function panel(t, glow) {
  const cols = [mix(t, 0x0a0705, 0.7), mix(t, 0x120c08, 0.45), t, mix(t, 0xfff0d6, 0.14), mix(t, 0xfff4de, 0.3)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x - 47) / 44, dy = (y - 38) / 50, v = 1.18 - Math.sqrt(dx * dx + dy * dy) * 1.25 - (y / N) * 0.22 + (glow || 0);
    const k = clampv(Math.floor(v * 3.2 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.2), 0, 4);
    OVER[y * N + x] = cols[k];
  }
}
function frame(out) {
  const ink = [12, 8, 6], gold = [212, 169, 92], hi = [246, 218, 150], lo = [150, 104, 50], inner = [30, 20, 12];
  const set = (x, y, c, a = 255) => { const j = (y * N + x) * 4; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = a; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.min(x, y, N - 1 - x, N - 1 - y);
    if (d > 2) continue;
    const corner = Math.min(x, N - 1 - x) + Math.min(y, N - 1 - y);
    if (corner < 2) { set(x, y, ink, 0); continue; }
    if (d === 0 || corner === 2) set(x, y, ink);
    else if (d === 1) set(x, y, x + y < N ? (x < y ? hi : gold) : (x > y ? lo : gold));
    else set(x, y, inner);
  }
  // little gold studs in the corners
  for (const [x, y] of [[4, 4], [N - 5, 4], [4, N - 5], [N - 5, N - 5]]) { set(x, y, gold); set(x + 1, y, lo); set(x, y + 1, lo); }
}
// a soft glow around the figure, painted onto the background (Waarom, Pip, the sparks, the Orakel)
function aura(col, rings = 5, k = 0.55) {
  let cur = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) cur[i] = PART[i] ? 1 : 0;
  for (let r = 1; r <= rings; r++) {
    const nxt = cur.slice();
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (cur[i]) continue;
      if (cur[i - 1] || cur[i + 1] || cur[i - N] || cur[i + N]) {
        nxt[i] = 1;
        const a = k * (1 - (r - 1) / rings);
        if (a * 16 > BAYER[(y & 3) * 4 + (x & 3)] * 0.9) OVER[i] = mix(OVER[i], col, a);
      }
    }
    cur = nxt;
  }
}

// ---------------------------------------------------------------- the look
const ENUMS = {
  build: ['slim', 'average', 'broad', 'round'], age: ['young', 'adult', 'old'], brows: ['thin', 'normal', 'thick', 'bushy'], nose: ['small', 'normal', 'big', 'long'],
  facialHair: ['none', 'stubble', 'moustache', 'walrus', 'goatee', 'beard', 'full'], glasses: ['none', 'round', 'square', 'half', 'shades'],
  hair: ['bald', 'buzz', 'short', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf'],
  hat: ['none', 'cap', 'beret', 'beanie', 'tophat', 'hood', 'quill', 'hardhat'], bottom: ['trousers', 'skirt', 'shorts'],
  top: ['blazer', 'cardigan', 'jumper', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'robe', 'apron', 'hawaii', 'hivis'],
};
const COLOR_KEYS = new Set(['skin', 'hairColor', 'eyes', 'facialHairColor', 'glassesColor', 'scarfColor', 'hatColor', 'topColor', 'top2', 'tie', 'bottomColor', 'shoes', 'scarf']);
const OLD_KEYS = ['coat', 'pants', 'hairStyle', 'beard', 'robe', 'shirt', 'sleeve', 'smile', 'long', 'badge', 'scale'];
const colorOf = (v, d) => (typeof v === 'number' && isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim()) ? parseInt(v.trim().replace('#', ''), 16) : d);
// Any look (new schema, the old cast specs, or half a look) becomes a complete, valid look.
export function normLook(spec) {
  const s = spec && typeof spec === 'object' ? spec : {};
  // extras only come from the look itself (the hero's look already carries DEFAULT_LOOK's lanyard)
  const L = {...DEFAULT_LOOK, lanyard: false};
  delete L.top2;
  if (OLD_KEYS.some(k => s[k] !== undefined) || typeof s.hair === 'number' || typeof s.glasses === 'boolean') {
    L.lanyard = !!s.badge;
    L.top = s.robe !== undefined ? 'robe' : s.tie !== undefined || s.shirt !== undefined ? 'blazer' : 'jumper';
    L.topColor = colorOf(s.robe ?? s.coat, L.topColor);
    if (s.robe !== undefined && s.coat !== undefined) L.top2 = colorOf(s.coat);
    if (s.shirt !== undefined) L.top2 = colorOf(s.shirt);
    L.bottomColor = colorOf(s.pants, L.bottomColor);
    if (typeof s.hair === 'number') L.hairColor = s.hair;
    if (typeof s.hairStyle === 'string') L.hair = s.hairStyle;
    if (s.beard !== undefined) { L.facialHair = 'beard'; L.facialHairColor = colorOf(s.beard, L.hairColor); }
    if (s.glasses === true) L.glasses = 'round';
    if (typeof s.scale === 'number') L.height = s.scale;
    if (s.smile) L.grin = true;
  }
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null || OLD_KEYS.includes(k) || k === 'probe' || typeof v === 'function') continue;
    if (k === 'hair' && typeof v !== 'string') continue;
    if (k === 'glasses' && typeof v !== 'string') continue;
    if (ENUMS[k]) { if (ENUMS[k].includes(v)) L[k] = v; continue; }
    if (COLOR_KEYS.has(k)) { const c = colorOf(v); if (c !== undefined) L[k] = c; continue; }
    if (k === 'height') { L.height = clampv(+v || 1, 0.7, 1.4); continue; }
    L[k] = v;
  }
  if (L.hat === 'none') delete L.hat;
  if (!ENUMS.hair.includes(L.hair)) L.hair = 'short';
  return L;
}

// Details the schema cannot say, by cast id: the things that make each one unforgettable.
// A look may add its own as look.sig (for example {shadesUp: true, prop: 'mug'}).
const SIG = {
  joop: {prop: 'mug', mugText: ['BESTE', 'CONCIËRGE'], twinkle: true, checks: true},
  wethouder: {brooch: true, pen: true},
  ilse: {prop: 'tea', tired: true},
  bakker: {chain: true, bag: true, determined: true},
  glans: {shadesUp: true, grin: true, shiny: true, prop: 'folder', tan: true},
  burger1: {bread: true, ticket: '388'},
  burger2: {prop: 'form'},
  burger3: {prop: 'leash'},
  waarom: {glowEyes: true, aura: 0x9fc8ff, flow: true},
  griffel: {prop: 'book', ink: true},
  mallow: {tools: true},
  henk: {shadesUp: true, sunburn: true},
  mira: {bangs: true, tape: true, prop: 'ruler'},
  bep: {pencil: true, cateye: true, prop: 'book', bookColor: 0x3a5a7a},
  kees: {loupe: true, watch: true},
  sien: {soot: true, messy: true, prop: 'coffee', mitt: true},
  linde: {prop: 'horn'},
  bram: {postal: true, bag: true, letters: true},
};
const PROPS = new Set(['mug', 'tea', 'coffee', 'folder', 'book', 'clipboard', 'ruler', 'horn', 'leash', 'form', 'stamp', 'keys']);

// ---------------------------------------------------------------- subjects
const CREATURES = new Set(['pip', 'spark', 'cloud', 'owl', 'padlock', 'orakel', 'fabulant', 'wisp']);
const FOLK = new Set(['gnome', 'kobold', 'scribe']);
function stable(o) {
  if (!o || typeof o !== 'object') return JSON.stringify(o);
  return '{' + Object.keys(o).filter(k => k !== 'probe' && typeof o[k] !== 'function').sort().map(k => `${k}:${typeof o[k] === 'object' ? stable(o[k]) : JSON.stringify(o[k])}`).join(',') + '}';
}
const canonCache = new Map();
function canon(id) {
  const c = CAST[id];
  if (!c) return id;
  const k = canonCache.get(id);
  if (k && CAST[k] === c) return k;
  const found = Object.keys(CAST).find(key => CAST[key] === c) || id;
  canonCache.set(id, found);
  return found;
}
function fromSpec(m, id, tint) {
  const kind = m.kind && m.kind !== 'human' ? m.kind : 'human';
  if (kind === 'human' || FOLK.has(kind)) return {R: 1, id, kind, look: normLook(m), spec: m, tint, arch: ARCH[m.archetype] ? m.archetype : null, key: `${id || 'look'}|${kind}|${stable(m)}`};
  if (CREATURES.has(kind)) return {R: 1, id, kind, spec: m, tint, key: `${id || 'c'}|${kind}|${stable(m)}`};
  return {R: 1, id, kind: 'unknown', spec: m, tint, key: `unknown|${id}|${stable(m)}`};
}
// A speaker from dialogue.js ({cls, id}) or a cast entry itself points at a cast id ('' = the narrator).
function subjectId(s) {
  if (s.cls === 'you') return 'you';
  if (s.cls === 'nar') return '';
  if (typeof s.id === 'string' && CAST[s.id]) return s.id;
  for (const k of Object.keys(CAST)) if (CAST[k] === s) return k;
  return null;
}
// subject -> {kind, look | spec, id (canonical cast id), tint, key}
export function resolveSubject(subject) {
  if (subject && subject.R === 1) return subject;
  if (subject && typeof subject === 'object') { const id = subjectId(subject); if (id !== null) subject = id; }
  if (subject === 'you' || subject === 'hero') { const look = heroLook(), arch = archetype(); return {R: 1, id: 'you', kind: 'human', look: normLook(look), spec: look, tint: null, arch, key: `you|${arch}|${stable(look)}`}; }
  if (typeof subject === 'string' && subject) {
    const id = canon(subject), c = CAST[id], m = c?.model, tint = colorOf(c?.color, null);
    if (id === 'orakel' || id === 'fabulant') return {R: 1, id, kind: id, spec: m || {}, tint, key: `${id}|${stable(m || {})}`};
    if (!m) return {R: 1, id, kind: 'unknown', spec: {}, tint, key: `unknown|${id}`};
    return fromSpec(m, id, tint);
  }
  if (subject && typeof subject === 'object') return fromSpec(subject, typeof subject.id === 'string' ? subject.id : null, colorOf(subject.tint, null));
  return {R: 1, id: null, kind: 'unknown', spec: {}, tint: null, key: 'unknown|'};
}
// the narrator and empty speakers have no face
export function hasPortrait(s) {
  if (s && typeof s === 'object') { if (s.R === 1) return true; const id = subjectId(s); if (id === null) return true; s = id; }
  return !!s && s !== 'nar' && (s === 'you' || s === 'hero' || !!CAST[s]);
}

// ---------------------------------------------------------------- moods
// eye: template; look: iris offset; brow: [raise, tilt (inner end up), arch] for the near and the far brow
const MOOD = {
  neutral: {eye: 'open', look: [0, 0], brow: [[0, 0, 0], [0, 0, 0]], mouth: 'flat'},
  happy: {eye: 'smile', look: [0, 0], brow: [[1, 0, 1], [1, 0, 1]], mouth: 'smile', fx: ['twinkle']},
  laugh: {eye: 'arc', look: [0, 0], brow: [[2, 0, 1], [2, 0, 1]], mouth: 'laugh', fx: ['blush', 'joy']},
  sad: {eye: 'sad', look: [0, 1], brow: [[0, 2, 0], [0, 2, 0]], mouth: 'frown', fx: ['tear']},
  angry: {eye: 'angry', look: [0, 0], brow: [[-1, -3, 0], [-1, -3, 0]], mouth: 'grit', fx: ['vein', 'steam']},
  surprised: {eye: 'wide', look: [0, 0], brow: [[3, 0, 1], [3, 0, 1]], mouth: 'o', fx: ['shock']},
  worried: {eye: 'open', look: [-1, 0], brow: [[1, 2, 0], [1, 2, 0]], mouth: 'wavy', fx: ['sweat']},
  smug: {eye: 'half', look: [1, 0], brow: [[-1, 0, 0], [2, -1, 1]], mouth: 'smirk', fx: ['sparkle']},
  thinking: {eye: 'open', look: [1, -1], brow: [[0, 1, 0], [2, -1, 1]], mouth: 'side', fx: ['think']},
  tired: {eye: 'tired', look: [0, 1], brow: [[-1, 1, 0], [-1, 1, 0]], mouth: 'tired', fx: ['bags', 'sigh']},
};
const MOOD_TINT = {happy: 0xf0c050, laugh: 0xf0a040, sad: 0x3a5aa8, angry: 0xc8341e, surprised: 0xe8e8ff, worried: 0x5a7a9a, smug: 0xb07ae0, thinking: 0x4a9ac0, tired: 0x6a6a86};
// Eye templates, outer corner first (9 columns; the far eye drops the middle one):
// lash top row, lash thickness, last open row.
const EYES = {
  open: {t: [2, 1, 0, 0, 0, 0, 0, 1, 1], h: [1, 2, 2, 2, 2, 2, 2, 1, 1], b: [4, 5, 6, 7, 7, 7, 6, 5, 3], flick: 1},
  smile: {t: [2, 1, 0, 0, 0, 0, 0, 1, 1], h: [1, 2, 2, 2, 2, 2, 2, 1, 1], b: [3, 4, 4, 5, 5, 5, 4, 4, 3], flick: 1, lower: 1},
  half: {t: [3, 3, 3, 3, 3, 3, 3, 3, 3], h: [1, 2, 2, 2, 2, 2, 2, 2, 1], b: [4, 5, 6, 7, 7, 7, 6, 5, 4], flick: 3},
  tired: {t: [3, 3, 3, 2, 2, 2, 2, 2, 2], h: [1, 1, 2, 2, 2, 2, 2, 1, 1], b: [4, 5, 6, 7, 7, 7, 6, 5, 4], flick: 3},
  angry: {t: [1, 1, 1, 1, 1, 2, 2, 3, 3], h: [1, 2, 2, 2, 2, 2, 2, 1, 1], b: [3, 5, 6, 6, 6, 6, 6, 5, 4], flick: 0},
  sad: {t: [3, 3, 2, 2, 1, 1, 1, 1, 1], h: [1, 1, 2, 2, 2, 2, 2, 1, 1], b: [4, 6, 7, 7, 7, 7, 6, 5, 3], flick: 4},
  wide: {t: [1, 0, -1, -1, -1, -1, -1, 0, 1], h: [1, 1, 1, 1, 1, 1, 1, 1, 1], b: [5, 6, 7, 8, 8, 8, 7, 6, 4], flick: 0, small: 1},
  arc: {arc: [6, 5, 4, 3, 3, 3, 4, 5, 6]},
  closed: {arc: [4, 5, 6, 6, 6, 6, 6, 5, 4], down: 1},
};

// ---------------------------------------------------------------- people
function geom(L, kind) {
  const b = L.build, small = kind === 'gnome' || kind === 'kobold';
  const g = {cx: 47, T: 0.14, hw: 19, b, small};
  g.dy = clampv(Math.round((1 - L.height) * 14), -3, 4) + (L.age === 'old' ? 1 : 0) + (small ? 3 : 0) + (L.hat === 'tophat' ? 7 : 0);
  g.fw = {slim: 16.6, average: 17.6, broad: 18.4, round: 18.8}[b] + (small ? 0.6 : 0);
  g.jaw = {slim: 10.6, average: 12, broad: 15, round: 14.2}[b];
  g.chinW = {slim: 3.2, average: 4, broad: 6.6, round: 6}[b];
  g.top = 14 + g.dy; g.scy = 35 + g.dy; g.sry = 21;
  g.eyeY = 39 + g.dy; g.noseY = 51 + g.dy; g.mouthY = 57 + g.dy;
  g.chinY = (L.age === 'young' ? 62.6 : 63.4) + g.dy;
  g.X = d => g.cx + g.T * d * g.hw;
  g.nw = {slim: 5.6, average: 6.6, broad: 8.2, round: 7.8}[b] - (small ? 1 : 0);
  g.sw = {slim: 26, average: 30.5, broad: 36, round: 34}[b] * (small ? 0.78 : 1);
  g.shY = 69 + Math.max(0, g.dy - 1);
  g.eL = Math.round(g.X(0.62) - 8.5 - 4.5); g.eR = Math.round(g.X(0.62) + 8.5 - 4);
  g.nx = Math.round(g.X(1)); g.mx = Math.round(g.X(0.85));
  g.ncx = g.X(0.12); g.ny = g.shY - 2;
  return g;
}
// piecewise linear edge: [[u, y], ...] with y relative to the top of the skull
function edgeAt(E, u) {
  if (u <= E[0][0]) return E[0][1];
  for (let k = 1; k < E.length; k++) if (u <= E[k][0]) { const [u0, y0] = E[k - 1], [u1, y1] = E[k]; return y0 + ((u - u0) / (u1 - u0)) * (y1 - y0); }
  return E[E.length - 1][1];
}
function hairShade(cx, cy, rx, ry, shine = 1) {
  const b = ball(cx, cy, rx, ry, 0.05);
  return (x, y) => {
    let t = b(x, y);
    if (t > LIT) t = LIT;
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, r = Math.sqrt(nx * nx + ny * ny), a = Math.atan2(ny, nx);
    if (shine && r > 0.5 && r < 0.5 + 0.17 * shine && a > -2.7 && a < -0.75 && Math.sin(a * 11) > -0.45) t = t >= BASE ? HI : LIT;
    return t;
  };
}
// A fringe from lock tips: valleys sit `depth` above the shallower neighbour, so locks end in points.
function lockEdge({side, temple, tips, depth = 3.5, sideR = side, templeR = temple}) {
  const E = [[-1.5, side], [-1.03, side], [-0.95, temple]], V = [];
  tips.forEach(([u, y], k) => { if (k) { const [pu, py] = tips[k - 1], v = [(pu + u) / 2, Math.min(py, y) - depth]; E.push(v); V.push(v); } E.push([u, y]); });
  E.push([0.95, templeR], [1.03, sideR], [1.5, sideR]);
  E.valleys = V; E.tips = tips;
  return E;
}
const HAIR_EDGES = {
  short: lockEdge({side: 27, temple: 17, tips: [[-0.74, 16.5], [-0.47, 14.2], [-0.18, 16.6], [0.12, 13.6], [0.42, 16.4], [0.72, 14]], depth: 4.2}),
  buzz: [[-1.3, 25], [-1.0, 25], [-0.9, 18], [-0.7, 12.5], [0, 11.5], [0.7, 12.5], [0.9, 18], [1.0, 25], [1.3, 25]],
  side: lockEdge({side: 27, temple: 12.5, templeR: 19, tips: [[-0.52, 11.4], [-0.24, 15.4], [0.08, 18.2], [0.4, 20.6], [0.7, 19.4]], depth: 3.8}),
  slick: [[-1.3, 26], [-1.02, 26], [-0.92, 18], [-0.72, 11.5], [-0.3, 10], [0.2, 9.8], [0.6, 11], [0.84, 15], [0.95, 21], [1.02, 26], [1.3, 26]],
  curly: [[-1.3, 28], [-1.04, 28], [-0.95, 22], [-0.85, 16], [-0.7, 18], [-0.55, 14], [-0.4, 17.5], [-0.22, 13.5], [-0.05, 17], [0.12, 13.2], [0.3, 17], [0.48, 13.5], [0.64, 17], [0.8, 15], [0.92, 21], [1.04, 28], [1.3, 28]],
  afro: [[-1.45, 34], [-1.06, 34], [-0.95, 25], [-0.82, 16], [-0.5, 12.5], [0, 11.5], [0.5, 12.5], [0.82, 16], [0.95, 25], [1.06, 34], [1.45, 34]],
  pixie: lockEdge({side: 25, temple: 15, tips: [[-0.72, 14.5], [-0.46, 17.8], [-0.2, 16], [0.06, 20.4], [0.32, 18.2], [0.56, 21.8], [0.8, 17.4]], depth: 3.8}),
  bob: [[-1.5, 47], [-1.08, 47], [-0.98, 36], [-0.9, 20], [-0.72, 14], [-0.48, 12.6], [-0.26, 14.6], [-0.02, 13.4], [0.24, 16.6], [0.46, 15.6], [0.66, 18.8], [0.8, 18], [0.9, 21], [0.98, 36], [1.08, 47], [1.5, 47]],
  long: [[-1.5, 40], [-1.08, 40], [-0.98, 34], [-0.88, 20], [-0.6, 12.5], [-0.3, 9.8], [-0.06, 8.2], [0.15, 9.8], [0.48, 12.5], [0.76, 17], [0.88, 21], [0.97, 34], [1.08, 40], [1.5, 40]],
  ponytail: [[-1.3, 26], [-1.02, 26], [-0.94, 19], [-0.8, 13.5], [-0.5, 11.5], [0, 11], [0.5, 11.5], [0.8, 13.5], [0.94, 19], [1.02, 26], [1.3, 26]],
  braids: [[-1.5, 34], [-1.06, 34], [-0.97, 30], [-0.88, 19], [-0.6, 12.5], [-0.25, 10], [-0.06, 9], [0.15, 10], [0.5, 12.5], [0.86, 19], [0.97, 30], [1.06, 34], [1.5, 34]],
};
HAIR_EDGES.bun = HAIR_EDGES.ponytail;
const BANGS = lockEdge({side: 47, temple: 36, tips: [[-0.8, 21.2], [-0.52, 21.8], [-0.24, 21.2], [0.04, 21.8], [0.32, 21.2], [0.6, 21.8], [0.84, 21]], depth: 1.6});

function human(S, mood, mouth, blink) {
  let L = S.look;
  const kind = S.kind, sig = {...(SIG[S.id] || {}), ...(L.sig || {})}, M = MOOD[mood];
  if (kind === 'gnome') L = {...L, nose: 'big', brows: L.brows === 'normal' ? 'bushy' : L.brows, blush: true, facialHair: L.facialHair === 'beard' || L.facialHair === 'none' ? 'full' : L.facialHair};
  if (kind === 'kobold') L = {...L, eyes: S.spec.eyes ?? 0xe8b830};
  // sunglasses that live on the head (Glans, Henk) are not also worn over the eyes
  if (sig.shadesUp && L.glasses === 'shades') L = {...L, glasses: 'none'};
  const g = geom(L, kind), t = g.top;
  const grey = L.age === 'old' && luma(L.hairColor) < 0.62;
  const hairC = grey ? mix(L.hairColor, 0xb8b8c0, 0.32) : L.hairColor, fhC = L.facialHairColor ?? hairC;
  const skin = sig.tan ? mix(L.skin, 0xe08a3a, 0.18) : L.skin;
  const skinR = ramp(skin, 1), hairR = ramp(hairC, 2);
  const topC = L.topColor, top2C = L.top2 ?? mix(topC, 0xf0eadf, 0.75);
  const under = ['vest', 'apron', 'hivis'].includes(L.top);           // the base garment is the one underneath
  const covered = L.hair === 'headscarf' || L.hat === 'hood';
  const P = {};
  // ---- back layers: long hair, tails, buns, the bread behind Meneer Kok's shoulder
  P.hairB = part(hairR, {cast: 0});
  if (!covered) backHair(g, L, P, sig, hairR);
  if (sig.bread) bread(g);
  if (covered) hoodBack(g, L, P);
  // ---- body
  P.top = part(ramp(under ? top2C : topC), {soft: true});
  torso(g, L, P.top);
  P.hood = part(ramp(topC), {soft: true, cast: 1});
  if (L.top === 'hoodie') ell(P.hood, g.ncx, g.ny - 1.5, g.nw + 9, 6.6, ball(g.ncx - 2, g.ny - 5, g.nw + 9, 9), (x, y) => y + 0.5 > g.ny - 7);
  if (L.top === 'robe') ell(P.hood, g.ncx, g.ny - 2.5, g.nw + 11.5, 5.4, ball(g.ncx - 3, g.ny - 6, g.nw + 11, 8), (x, y) => y + 0.5 > g.ny - 7);
  P.neck = part(skinR, {cast: 0});
  neck(g, L, P.neck);
  garment(g, L, P, sig, topC, top2C, skinR);
  // ---- head
  P.ear = part(skinR);
  if (!covered && !['long', 'bob', 'braids'].includes(L.hair)) ears(g, L, P.ear, kind);
  P.face = part(skinR, {cast: 3});
  face(g, L, P.face);
  features(g, L, P, M, mood, mouth, blink, sig, skinR, hairR, kind);
  P.fhair = part(ramp(fhC, 2), {cast: 2, soft: true});
  facialHair(g, L, P, M, mood, mouth, fhC, skinR);
  if (L.glasses && L.glasses !== 'none') glasses(g, L, sig);
  P.hairF = part(hairR, {cast: 2});
  if (!covered) frontHair(g, L, P, sig, hairR, skinR);
  else headscarf(g, L, P);
  if (L.hat) hat(g, L, P, sig);
  if (sig.shadesUp) shadesUp(g);
  if (L.headset) headset(g);
  if (L.earrings) earrings(g, L, covered);
  if (sig.ticket) { const x = Math.round(g.X(0.3) + 6), y = t + 3; P.tk = part(ramp(0xf6f2e6), {cast: 1}); rect(P.tk, x - 1, y - 2, x + 11, y + 5, LIT); for (let a = x - 1; a <= x + 11; a++) dot(a, y - 2, 0xd0402a, P.tk); text(sig.ticket, x, y, 0x2a2228, P.tk); }
  // ---- hands and the thing they hold
  const prop = sig.prop || (PROPS.has(L.holdR) ? L.holdR : PROPS.has(L.holdL) ? L.holdL : null);
  if (prop) heldProp(g, L, P, sig, prop, skinR, topC, top2C, under);
  if (sig.glowEyes) {
    aura(sig.aura ?? 0x9fc8ff, 6, 0.5);
    for (const [x, y] of [[13, 22], [83, 30], [17, 58], [80, 66], [24, 38], [72, 16]]) for (const [a, b, c] of [[0, 0, 0xffffff], [-1, 0, 0xbfe0ff], [1, 0, 0xbfe0ff], [0, -1, 0xbfe0ff], [0, 1, 0xbfe0ff]]) dot(x + a, y + b, c, i => !PART[i]);
  }
  moodFx(g, M, mood, sig);
  return g;
}

// a lock of hair hanging from (x0, y0): it sways, waves and ends in a point, with strands along it
function hang(p, x0, y0, len, w0, w1, sway, wave, sh, phase = 0) {
  const A = [], B = [], C = [], n = 14;
  for (let k = 0; k <= n; k++) {
    const s = k / n, x = x0 + sway * s + Math.sin(s * 4.7 + phase) * wave * s, y = y0 + len * s;
    const w = (w0 + (w1 - w0) * s) * Math.min(1, (1 - s) / 0.2 + 0.06);
    A.push(x - w, y); B.unshift(x + w, y); C.push([x, y, w]);
  }
  poly(p, [...A, ...B], sh);
  for (const o of [-0.5, 0.1, 0.6]) for (let k = 1; k < n - 1; k++) { const [xa, ya, wa] = C[k], [xb, yb, wb] = C[k + 1]; line(xa + o * wa, ya, xb + o * wb, yb, onPart(p, o < 0 ? LIT : SH)); }
}
function backHair(g, L, P, sig, hairR) {
  const t = g.top, cx = g.X(-0.35), p = P.hairB, fw = g.fw;
  const sh = hairShade(cx - 4, t + 18, fw + 9, 34, 0);
  if (L.hair === 'long' || L.hair === 'braids') {
    poly(p, [cx - fw - 3, t + 14, cx + fw + 3, t + 14, cx + fw + 8, t + 52, cx + fw + 10, 97, cx - fw - 10, 97, cx - fw - 8, t + 52], sh);
    if (sig.flow) { hang(p, cx - fw - 5, t + 16, 80, 6, 8.5, -7, 3, sh, 0.5); hang(p, cx + fw + 5, t + 16, 80, 6, 8.5, 7, 3, sh, 2.2); }
  }
  if (L.hair === 'bob') ell(p, cx, t + 36, fw + 3.5, 12.5, sh);
  if (L.hair === 'ponytail') {
    poly(p, [cx - 9, t - 2, cx - 3, t + 3, cx - 12, t + 13, cx - 17, t + 28, cx - 17.5, t + 44, cx - 21, t + 53, cx - 25.5, t + 41, cx - 25, t + 24, cx - 20, t + 8], hairShade(cx - 18, t + 18, 12, 30, 1));
    for (let k = 0; k < 4; k++) quad(cx - 13 - k * 2, t + 6 + k, cx - 22 - k, t + 22, cx - 19 - k * 1.5, t + 44 - k * 3, (x, y) => tone(x, y, SH, p));
  }
  if (L.hair === 'bun') {
    const bx = cx - 1, by = t - 1.5, r = sig.messy ? 7.8 : 7.2;
    ell(p, bx, by, r, r * 0.92, hairShade(bx - 1, by - 1, r, r, 1));
    quad(bx - 4, by + 2, bx, by - 6, bx + 4, by + 1, (x, y) => tone(x, y, SH, p));
    quad(bx - 2, by + 4, bx + 3, by - 2, bx + 5, by + 3, (x, y) => tone(x, y, SH, p));
    if (sig.messy) for (const [a, l] of [[-2.4, 6], [-1.2, 5], [-0.4, 7], [-2.9, 5]]) strip(p, [bx + Math.cos(a) * r * 0.8, by + Math.sin(a) * r * 0.8, bx + Math.cos(a) * (r + l), by + Math.sin(a) * (r + l) - 1], 1.6, LIT);
    if (sig.pencil) {
      const pp = part(ramp(0xf2c230), {cast: 0});
      strip(pp, [bx - 13, by - 6, bx + 10, by + 3], 2.4, (x, y) => (y + x * 0.4 < by - 2 + bx * 0.4 ? LIT : BASE));
      ell(part(ramp(0xe88a9a)), bx - 13.5, by - 6.2, 1.6, 1.6, BASE);
      dot(Math.round(bx + 11), Math.round(by + 3), 0x2a2428);
    }
  }
}
function hoodBack(g, L, P) {
  const col = L.hair === 'headscarf' ? (L.scarfColor ?? L.hatColor ?? 0x7a3a5a) : (L.hatColor ?? L.topColor);
  P.scarfB = part(ramp(col), {soft: true});
  const cx = g.X(0.05), t = g.top;
  ell(P.scarfB, cx, t + 22, g.fw + 5.5, 26, ball(cx - 4, t + 14, g.fw + 6, 28));
  poly(P.scarfB, [cx - g.fw - 7, t + 36, cx + g.fw + 7, t + 36, cx + g.fw + 13, g.shY + 8, cx - g.fw - 13, g.shY + 8], ball(cx - 6, t + 40, g.fw + 14, 30));
}
function bread(g) {
  const p = part(ramp(0xd8a050), {cast: 0});
  for (const [x0, y0, x1, y1] of [[13, 86, 22, 40], [19, 88, 31, 46]]) {
    strip(p, [x0, y0, x1, y1], 7.4, ball((x0 + x1) / 2 - 2, (y0 + y1) / 2 - 6, 6, 28));
    ell(p, x1, y1, 3.6, 3.6, LIT);
    for (let k = 1; k < 4; k++) { const ax = x0 + (x1 - x0) * (k / 4.2), ay = y0 + (y1 - y0) * (k / 4.2); line(ax - 2, ay + 1, ax + 1, ay - 1, (x, y) => tone(x, y, SH, p)); }
  }
}
function torso(g, L, p) {
  const cx = g.cx + 0.5, w = g.sw, y0 = g.shY, nw = g.nw, fl = L.build === 'round' ? 3 : 0;
  const pts = [cx - nw - 1, y0 - 3, cx - nw - 6, y0 - 1.4, cx - w + 7, y0 + 1, cx - w + 1.8, y0 + 4.6, cx - w - 0.4, y0 + 10, cx - w - 1.4 - fl, 97, cx + w + 1.4 + fl, 97, cx + w + 0.4, y0 + 10, cx + w - 1.8, y0 + 4.6, cx + w - 7, y0 + 1, cx + nw + 6, y0 - 1.4, cx + nw + 1, y0 - 3];
  poly(p, pts, (x, y) => {
    const u = (x + 0.5 - cx) / w, v = y - y0;
    if (u > 0.8) return SH2; if (u > 0.5) return SH;
    if (u < -0.62 && v < 13) return LIT; if (v < 2.5 && u < 0.2) return LIT;
    return BASE;
  });
  // the arms: a crease down each side
  quad(cx - w + 7.5, y0 + 9, cx - w + 8.5, y0 + 17, cx - w + 8, 97, (x, y) => tone(x, y, SH, p));
  quad(cx + w - 7.5, y0 + 9, cx + w - 8.5, y0 + 17, cx + w - 8, 97, (x, y) => tone(x, y, SH2, p));
  if (L.patches) { const pp = part(ramp(0x7a5232), {soft: true}); for (const sx of [-1, 1]) { ell(pp, cx + sx * (w - 3.4), 94, 3.4, 4.6, ball(cx + sx * (w - 4) - 1, 92, 4, 5)); for (let y = 91; y < 96; y += 2) dot(Math.round(cx + sx * (w - 3.4) + sx * 2), y, 0xc8a070, pp); } }
}
function neck(g, L, p) {
  const x = g.ncx, w = g.nw;
  poly(p, [x - w, g.mouthY - 3, x + w, g.mouthY - 3, x + w + 0.9, g.shY + 3, x - w - 0.9, g.shY + 3], (px) => (px + 0.5 < x - w + 2.6 ? BASE : SH));
  if (L.age === 'old') quad(x - 2.5, g.chinY + 2, x - 3.5, g.chinY + 5, x - 3, g.shY - 1, (xx, yy) => tone(xx, yy, SH2, p));
}
function collar(p, cx, y, w, sh = LIT) {
  poly(p, [cx - w - 1.4, y - 3, cx - 0.4, y + 3.4, cx - w + 0.2, y + 5.6, cx - w - 3.2, y + 2], sh);
  poly(p, [cx + w + 1.4, y - 3, cx + 0.4, y + 3.4, cx + w - 0.2, y + 5.6, cx + w + 3.2, y + 2], sh === LIT ? BASE : sh);
}
function tie(g, col, sig) {
  const p = part(ramp(col), {soft: true, cast: 1}), x = g.ncx, y = g.ny;
  poly(p, [x - 1.6, y + 0.6, x + 1.6, y + 0.6, x + 1.2, y + 3.6, x - 1.2, y + 3.6], LIT);
  const p2 = part(ramp(col), {soft: true});
  poly(p2, [x - 1.2, y + 3.6, x + 1.2, y + 3.6, x + 3.1, 97, x - 2.9, 97], (px, py) => (px + 0.5 < x - 0.4 ? LIT : BASE));
  if (sig.shiny) for (let yy = y + 6; yy < 94; yy += 7) dot(Math.round(x - 1), yy, ramp(col)[HI], p2);
}
function garment(g, L, P, sig, topC, top2C, skinR) {
  const x = g.ncx, y = g.ny, nw = g.nw, top = L.top, topR = ramp(topC), t2R = ramp(top2C), cx = g.cx + 0.5, w = g.sw;
  const shirt = part(t2R, {soft: true}), col = part(t2R, {soft: true, cast: 1});
  if (top === 'blazer') {
    poly(shirt, [x - nw - 0.5, y - 2, x + nw + 0.5, y - 2, x + 2.5, 97, x - 2.5, 97], BASE);
    collar(col, x, y, nw - 1.2);
    if (L.tie !== undefined) tie(g, L.tie, sig);
    const lap = part(topR, {soft: true, cast: 1});
    poly(lap, [x - nw - 1.6, y - 2.6, x - 2.3, 95, x - 7.5, 87, x - nw - 7.4, y + 9, x - nw - 4.6, y + 6.2, x - nw - 6.2, y + 3.4], LIT);
    poly(lap, [x + nw + 1.6, y - 2.6, x + 2.3, 95, x + 7.5, 87, x + nw + 7.4, y + 9, x + nw + 4.6, y + 6.2, x + nw + 6.2, y + 3.4], SH);
    if (sig.shiny) for (const [a, b] of [[cx - w + 9, y + 5], [cx - w + 13, y + 3], [x - 9, y + 13], [cx + w - 12, y + 6]]) { dot(a, b, topR[HI]); dot(a + 1, b + 1, topR[LIT]); }
    if (sig.brooch) { const bx = Math.round(x - nw - 3.5), by = Math.round(y + 8); dot(bx, by, 0xffe08a); dot(bx + 1, by, 0xd8a83a); dot(bx, by + 1, 0xd8a83a); dot(bx + 1, by + 1, 0x9a6a1a); dot(bx - 1, by, 0xb8862a); dot(bx, by - 1, 0xfff4c0); }
    if (sig.pen) {
      // a lacquered fountain pen with a gold clip, in the breast pocket
      const px = Math.round(x + nw + 7), py = Math.round(y + 7);
      for (let k = 0; k < 7; k++) { dot(px, py + k, k === 0 ? 0xffe08a : k < 2 ? 0xd8a840 : 0x8a1a2a); dot(px + 1, py + k, k === 0 ? 0xd8a840 : 0x5a0e1a); }
      dot(px + 2, py + 1, 0xffe08a); dot(px + 2, py + 2, 0xd8a840); dot(px + 2, py + 3, 0xb8862a);
      for (let a = px - 3; a <= px + 5; a++) tone(a, py + 6, LIT, P.top);
    }
  } else if (top === 'cardigan' || top === 'vest' || top === 'hivis') {
    if (top === 'hivis') {
      const band = part(t2R, {soft: true});
      ell(band, x, y - 1.5, nw + 3.2, 4.4, LIT, (a, b) => b + 0.5 > y - 1.2);
      ell(P.neck, x, y - 2.6, nw + 1.3, 3.2, SH, (a, b) => b + 0.5 > y - 2.6);
    } else poly(shirt, [x - nw - 1, y - 2, x + nw + 1, y - 2, x + 3.5, 97, x - 3.5, 97], (a) => (a < x ? BASE : SH));
    if (top !== 'hivis') collar(col, x, y, nw - 1.4);
    if (top === 'vest' && L.tie !== undefined) tie(g, L.tie, sig);
    if (sig.checks) for (let yy = y; yy < 97; yy++) for (let xx = Math.floor(x - nw - 1); xx <= x + nw + 1; xx++) { if (xx % 4 === 0 || yy % 4 === 0) tone(xx, yy, (xx % 4 === 0 && yy % 4 === 0) ? SH2 : SH, [shirt, col]); }
    const open = top === 'hivis' ? 3 : 2.2;
    if (top === 'cardigan') {
      // ribbed bands along the V, two buttons
      const band = part(topR, {soft: true});
      poly(band, [x - nw - 1.8, y - 2, x - nw + 1.2, y - 2, x - open + 0.6, 97, x - open - 3, 97], LIT);
      poly(band, [x + nw + 1.8, y - 2, x + nw - 1.2, y - 2, x + open - 0.6, 97, x + open + 3, 97], BASE);
      for (let yy = y; yy < 97; yy += 2) { tone(Math.round(x - nw + (yy - y) * 0.2), yy, BASE, band); tone(Math.round(x + nw - (yy - y) * 0.2), yy, SH, band); }
      for (const by of [y + 12, y + 20]) { const bx = Math.round(x - open - 1.2); dot(bx, by, 0x3a2a1a); dot(bx + 1, by, 0x6a5040); }
    } else {
      const vp = part(topR, {soft: true, cast: top === 'hivis' ? 0 : 1}), armX = w * 0.66;
      const sh = (a, b) => (a < x - 0.5 ? (a < cx - w * 0.5 && b < y + 12 ? LIT : BASE) : a > cx + w * 0.55 ? SH : BASE);
      poly(vp, [x - nw - 1.2, y - 2.4, x - open, y + (top === 'hivis' ? 11 : 15), x - open, 97, cx - armX, 97, cx - armX + 1, y + 10, x - nw - 6.5, y + 1.6], sh);
      poly(vp, [x + nw + 1.2, y - 2.4, x + open, y + (top === 'hivis' ? 11 : 15), x + open, 97, cx + armX, 97, cx + armX - 1, y + 10, x + nw + 6.5, y + 1.6], sh);
      if (top === 'vest') {
        for (const by of [y + 19, y + 24]) { dot(Math.round(x + open), by, 0xe0c070); dot(Math.round(x + open) + 1, by, 0x8a6a2a); }
        if (sig.watch) quad(x + open + 1, y + 24, x + open + 4, y + 28, x + open + 9, y + 25, (a, b) => dot(a, b, (a + b) % 2 ? 0xffe08a : 0xc8962a));
      } else {
        const silver = (a, b, r) => { const i = b * N + a; if (PART[i] === vp) OVER[i] = r === 0 ? 0xffffff : r === 1 ? 0xd2d8de : 0x9aa2aa; };
        for (const sy of [y + 14, y + 20]) for (let a = 0; a < N; a++) for (let r = 0; r < 3; r++) silver(a, sy + r, r);
        for (const sx of [-1, 1]) for (let b = y - 1; b < y + 14; b++) for (let r = 0; r < 2; r++) silver(Math.round(x + sx * (nw + 3.5) + r * sx), b, r ? 1 : 0);
      }
    }
  } else if (top === 'jumper' || top === 'tshirt') {
    const band = part(topR, {soft: true});
    const th = top === 'jumper' ? 2.4 : 1.5;
    ell(band, x, y - 1.6, nw + 2.6 + th, 3.6 + th, (a, b) => (b % 2 && top === 'jumper' ? BASE : LIT), (a, b) => b + 0.5 > y - 1.8);
    ell(P.neck, x, y - 2.6, nw + 1.3, 3.4, SH, (a, b) => b + 0.5 > y - 2.6);
    if (L.top2 !== undefined && top === 'jumper') collar(col, x, y + 0.6, nw - 1, LIT);
    if (top === 'tshirt') {
      const arm = part(skinR, {soft: true});
      for (let b = g.shY + 16; b < 97; b++) for (let a = 0; a < N; a++) { const i = b * N + a; if (PART[i] === P.top && Math.abs(a + 0.5 - cx) / w > 0.76) { PART[i] = arm; TONE[i] = a < cx ? BASE : SH; } }
      if (L.top2 !== undefined) { const sx = Math.round(x + 7), sy = y + 12; for (const [a, b] of [[0, 1], [1, 0], [2, 1], [1, 1], [0, 2], [1, 2], [2, 2], [1, 3], [3, 0], [4, 1], [3, 1], [4, 2], [3, 2]]) dot(sx + a - 1, sy + b, t2R[BASE], P.top); }
    }
  } else if (top === 'shirt' || top === 'hawaii') {
    const cp = part(topR, {soft: true, cast: 1});
    if (top === 'hawaii' || L.tie === undefined) { poly(P.neck, [x - 3.4, y - 2, x + 3.4, y - 2, x + 0.3, y + (top === 'hawaii' ? 10 : 6)], SH); }
    if (top === 'hawaii') {
      poly(cp, [x - nw - 1.6, y - 3, x - 1.2, y + 9.5, x - 5.4, y + 11.5, x - nw - 7.5, y + 4.2], LIT);
      poly(cp, [x + nw + 1.6, y - 3, x + 1.2, y + 9.5, x + 5.4, y + 11.5, x + nw + 7.5, y + 4.2], BASE);
      const fl = ramp(L.top2 ?? 0xffe050);
      let s = 7;
      for (let k = 0; k < 26; k++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const fx = 8 + (s % 80), fy = y - 2 + ((s >> 8) % 30);
        if (Math.abs(fx - x) < 4 && fy < y + 12) continue;
        const m = [P.top, cp];
        for (const [a, b] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) dot(fx + a, fy + b, fl[BASE], m);
        dot(fx, fy, 0xf07a2a === topC ? 0xc84a1a : fl[SH2], m);
        if (k % 3 === 0) { dot(fx + 2, fy + 2, 0x2a7a3a, m); dot(fx + 3, fy + 2, 0x1a5a2a, m); }
      }
    } else {
      collar(cp, x, y, nw - 1.2);
      if (L.tie !== undefined) tie(g, L.tie, sig);
      else for (let b = y + 7; b < 97; b++) tone(Math.round(x + 0.4), b, SH, P.top);
      for (const by of [y + 12, y + 19]) dot(Math.round(x + 1.4), by, topR[HI], P.top);
      for (let a = 0; a < 7; a++) { tone(Math.round(x + 7 + a), y + 10, SH, P.top); }
      for (let b = 0; b < 7; b++) { tone(Math.round(x + 7), y + 10 + b, SH, P.top); tone(Math.round(x + 13), y + 10 + b, SH, P.top); }
    }
  } else if (top === 'hoodie') {
    ell(P.neck, x, y - 3, nw + 1, 2.6, SH, (a, b) => b + 0.5 > y - 3);
    const cord = L.top2 ?? 0xf0ece4;
    for (const sx of [-1, 1]) { line(x + sx * 3.4, y + 2, x + sx * 4.2, y + 16, (a, b) => dot(a, b, cord)); dot(Math.round(x + sx * 4.2), y + 17, mix(cord, 0x000000, 0.35)); dot(Math.round(x + sx * 4.2), y + 18, mix(cord, 0x000000, 0.35)); }
    quad(x - 13, y + 24, x, y + 21, x + 13, y + 24, (a, b) => tone(a, b, SH, P.top));
  } else if (top === 'dress') {
    // a scoop neckline with a contrasting trim, puffed sleeves, little buttons, gathers below the yoke
    const trimR = L.top2 !== undefined ? t2R : ramp(mix(topC, 0xffffff, 0.45));
    const puff = part(topR, {soft: true});
    for (const sx of [-1, 1]) ell(puff, cx + sx * (w - 5.5), g.shY + 6.5, 7.4, 6.6, ball(cx + sx * (w - 5.5) - 2, g.shY + 4, 7.4, 6.6));
    const trim = part(trimR, {soft: true});
    ell(trim, x, y - 2, nw + 8, 10, LIT, (a, b) => b + 0.5 > y - 3);
    ell(P.neck, x, y - 2.4, nw + 6.6, 8.6, (a) => (a < x - 2 ? BASE : SH), (a, b) => b + 0.5 > y - 3);
    for (const by of [y + 11, y + 15]) { dot(Math.round(x), by, trimR[BASE], P.top); dot(Math.round(x) + 1, by, trimR[SH2], P.top); }
    for (const dx of [-9, -5, 5, 9]) line(x + dx, y + 13, x + dx * 1.2, 97, onPart(P.top, SH));
  } else if (top === 'robe') {
    poly(shirt, [x - nw - 1, y - 2, x + nw + 1, y - 2, x + 7, 97, x - 4, 97], SH);
    const flap = part(topR, {soft: true, cast: 1});
    poly(flap, [x - nw - 2.2, y - 3, x - nw + 1.2, y - 3, x + 7.5, 97, cx - w - 3, 97, cx - w, y + 8], (a, b) => (a < cx - w * 0.5 && b < y + 14 ? LIT : BASE));
    const lining = part(t2R, {soft: true});
    strip(lining, [x - nw + 0.4, y - 3, x + 7.4, 97], 3.4, (a) => (a < x ? LIT : BASE));
    for (const [x0, x1] of [[cx - w + 6, cx - w + 9], [x - 8, x - 6], [cx + w - 7, cx + w - 9]]) quad(x0, g.shY + 4, x0 + 3, g.shY + 15, x1, 97, (a, b) => tone(a, b, SH, [P.top, flap]));
  } else if (top === 'apron') {
    collar(col, x, y, nw - 1.4);
    const ap = part(topR, {soft: true});
    poly(ap, [x - 10.5, y + 8, x + 10.5, y + 8, x + 12.5, 97, x - 12.5, 97], (a, b) => (a < x - 6 ? LIT : a > x + 6 ? SH : BASE));
    strip(ap, [x - 9.2, y + 8.5, x - nw - 0.6, y - 2.6], 2.2, LIT);
    strip(ap, [x + 9.2, y + 8.5, x + nw + 0.6, y - 2.6], 2.2, BASE);
    for (let a = Math.ceil(x - 9); a < x + 9; a += 2) dot(a, y + 10, topR[HI], ap);
    for (let a = Math.ceil(x - 6); a <= x + 6; a++) tone(a, y + 17, SH2, ap);
    for (let b = y + 17; b < 97; b++) { tone(Math.ceil(x - 6), b, SH2, ap); tone(Math.floor(x + 6), b, SH2, ap); }
    if (sig.tools) {
      const tp = part(ramp(0xc8302a), {cast: 1});
      rect(tp, Math.round(x - 4), y + 11, Math.round(x - 3), y + 17, LIT);
      const pen = part(ramp(0xf2c230), {cast: 1});
      rect(pen, Math.round(x + 2), y + 12, Math.round(x + 3), y + 17, BASE); dot(Math.round(x + 2), y + 12, 0xe88a9a); dot(Math.round(x + 3), y + 12, 0xe88a9a);
      const sp = part(ramp(0xa8b0b8), {cast: 1});
      rect(sp, Math.round(x - 1), y + 9, Math.round(x - 1), y + 17, LIT);
    }
  }
  if (sig.tape) {
    const tp = part(ramp(0xf0c838), {soft: true, cast: 1});
    for (const sx of [-1, 1]) strip(tp, [x + sx * (nw + 1.4), y - 3.4, x + sx * (nw + 0.4), y + 4, x + sx * 3.4, 97], 2.6, sx < 0 ? LIT : BASE);
    for (let b = y - 2; b < 97; b += 3) { dot(Math.round(x - (nw + 0.4) + (b - y) * 0.12), b, 0x3a2a1a, tp); dot(Math.round(x + (nw + 0.4) - (b - y) * 0.12), b + 1, 0x3a2a1a, tp); }
  }
  if (L.lanyard) {
    const lp = part(ramp(0xd04a30), {soft: true});
    for (const sx of [-1, 1]) strip(lp, [x + sx * (nw - 0.4), y - 3, x + sx * 1.6, 92], 1.6, sx < 0 ? LIT : BASE);
    const card = part(ramp(0xf2efe8), {cast: 1});
    rect(card, Math.round(x - 5), 89, Math.round(x + 5), 97, LIT);
    rect(card, Math.round(x - 5), 92, Math.round(x + 5), 93, SH);
    for (let a = Math.round(x - 5); a <= Math.round(x + 5); a++) dot(a, 92, 0x2f6fb0, card);
    dot(Math.round(x), 88, 0xa8b0b8); dot(Math.round(x), 87, 0xc8ccd0);
  }
  if (typeof L.scarf === 'number') {
    const sp = part(ramp(L.scarf), {soft: true, cast: 2});
    ell(sp, x, y - 1.5, nw + 5, 4.6, (a, b) => (b % 3 === 0 ? SH : a < x ? LIT : BASE), (a, b) => b + 0.5 > y - 5.5);
    poly(sp, [x + 1.5, y + 1, x + 6.5, y + 1, x + 8.5, y + 17, x + 3.5, y + 18], (a, b) => (b % 3 === 0 ? SH : BASE));
    for (let a = 0; a < 5; a += 2) dot(Math.round(x + 4 + a), y + 19, ramp(L.scarf)[SH], undefined);
  }
  if (sig.bag) {
    const bp = part(ramp(sig.postal ? 0x7a5230 : 0x5a3a2a), {soft: true, cast: 1});
    strip(bp, [cx + w - 7, g.shY - 0.5, cx - w * 0.3, 97], 3, BASE);
    if (sig.letters) { const lp = part(ramp(0xf4efe2), {cast: 1}); poly(lp, [cx - w + 2, 86, cx - w + 13, 83, cx - w + 15, 97, cx - w + 3, 97], LIT); for (let a = 0; a < 6; a++) dot(Math.round(cx - w + 6 + a), 88 - Math.round(a * 0.25), 0xa83a2a, lp); }
  }
}
function ears(g, L, p, kind) {
  const y = g.eyeY + 5.5, s = g.T * -0.2 * g.hw, xl = g.cx - g.fw - 0.6 + s, xr = g.cx + g.fw + 0.4 + s;
  if (kind === 'kobold') {
    poly(p, [xl + 2, y - 3, xl + 2, y + 3, xl - 9, y - 9], ball(xl - 2, y - 4, 7, 7));
    poly(p, [xr - 2, y - 3, xr - 2, y + 3, xr + 7, y - 9], SH);
  }
  ell(p, xl, y, 3.1, 5, ball(xl - 1, y - 1, 3.5, 5.5));
  ell(p, xr, y, 2.3, 4.6, SH);
  const ix = Math.round(xl);
  for (let k = -2; k <= 2; k++) tone(ix, Math.round(y) + k, SH, p);
  tone(ix + 1, Math.round(y) - 3, SH, p); tone(ix + 1, Math.round(y) + 2, SH, p);
}
function face(g, L, p) {
  const fw = g.fw, j = g.jaw, c = g.chinW, round = L.build === 'round', old = L.age === 'old';
  const side = [[fw, g.scy + 2, 0], [fw + 0.2, g.eyeY + 7, 0.02], [fw - (round ? 0.1 : 1.3), g.noseY + 1.6, 0.06], [j + (round ? 1.2 : 0) + (old ? 0.6 : 0), g.mouthY + 1 + (old ? 1 : 0), 0.16], [c + 2.8, g.chinY - 2.6, 0.5], [c, g.chinY - 0.7, 0.72], [c * 0.45, g.chinY, 0.85]];
  const sx = (u, d) => g.cx + u + g.T * d * g.hw, pts = [];
  for (const [u, y, d] of side) pts.push(sx(u, d), y);
  pts.push(sx(0, 0.85), g.chinY + 0.3);
  for (let k = side.length - 1; k >= 0; k--) { const [u, y, d] = side[k]; pts.push(sx(-u, d), y); }
  poly(p, pts, BASE);
  ell(p, g.cx, g.scy, fw, g.sry, BASE, (x, y) => y + 0.5 < g.scy + 8);
  // form shading: the far side in shadow, the jaw underside, a lit near cheek
  for (let y = g.top; y <= g.chinY + 1; y++) {
    let xr = -1, xl = N;
    for (let x = 0; x < N; x++) if (PART[y * N + x] === p) { if (x > xr) xr = x; if (x < xl) xl = x; }
    if (xr < 0) continue;
    const k = y > g.noseY - 2 ? 3 : 2;
    for (let d = 1; d <= k; d++) tone(xr - d, y, SH, p);
  }
  for (let x = 0; x < N; x++) {
    let yb = -1;
    for (let y = g.chinY + 1; y > g.mouthY - 2; y--) if (PART[y * N + x] === p) { yb = y; break; }
    if (yb > 0) { tone(x, yb - 1, SH, p); if (x > g.X(0.85)) tone(x, yb - 2, SH, p); }
  }
  toneEll(g.eL + 2.5, g.eyeY + 9.6, 3.2, 1.5, LIT, p);
  for (let k = 2; k <= 4; k++) tone(g.nx - 1, g.noseY - k, LIT, p);
}

// ---- eyes, brows, nose, mouth, cheeks
function eyeCols(tpl, far) {
  const sel = a => (far ? a.filter((v, i) => i !== 4) : a);
  return tpl.arc ? {arc: sel(tpl.arc), down: tpl.down} : {t: sel(tpl.t), h: sel(tpl.h), b: sel(tpl.b), flick: tpl.flick, lower: tpl.lower, small: tpl.small};
}
function features(g, L, P, M, mood, mouth, blink, sig, skinR, hairR, kind) {
  // glowing eyes (Vrouwe Waarom): light instead of whites, a bright core instead of a pupil
  const glow = !!sig.glowEyes, lash = glow ? 0x2a4a8a : mix(0x1c1216, hairR[LINE], 0.25), white = glow ? 0xd4ecff : 0xf4f0ea, whiteSh = glow ? 0x9cc8f4 : 0xd4cacd;
  const eyeR = glow ? ramp(L.eyes ?? 0x6ab8ff, 3) : ramp(L.eyes ?? 0x3a2a1a), pupilC = glow ? 0xffffff : eyeR[LINE];
  const shades = L.glasses === 'shades';
  let tpl = EYES[M.eye];
  if (blink >= 0.75 && !tpl.arc) tpl = EYES.closed;
  // older eyes: the upper lid hoods the outer corner
  if (L.age === 'old' && !tpl.arc && !tpl.small) tpl = {...tpl, t: tpl.t.map((v, i) => (i < 3 ? v + 1 : v)), h: tpl.h.map((v, i) => (i === 0 ? 1 : v))};
  const half = blink >= 0.3 && blink < 0.75 && !tpl.arc;
  const twinkle = sig.twinkle || (M.fx || []).includes('twinkle');
  const old = L.age === 'old';
  for (const far of [false, true]) {
    const E = eyeCols(tpl, far), w = far ? 8 : 9, x0 = far ? g.eR : g.eL, y0 = g.eyeY;
    const col = i => (far ? x0 + w - 1 - i : x0 + i);   // template index 0 is the outer corner
    const idx = x => (far ? w - 1 - (x - x0) : x - x0);
    const [lx, ly] = M.look;
    if (!shades) {
      if (E.arc) {
        for (let i = 0; i < w; i++) { const r = E.arc[i]; dot(col(i), y0 + r, lash, P.face); if (i > 0 && i < w - 1) dot(col(i), y0 + r + (E.down ? -1 : 1), lash, P.face); }
        dot(col(-1), y0 + E.arc[0] + (E.down ? 1 : 0), lash, P.face);
      } else {
        // the iris and its pupil, in screen space: the look moves both eyes the same way
        const irx = E.small ? 1.7 : far ? 2.3 : 2.5, iry = E.small ? 2.3 : 3.1;
        const icx = x0 + (w - 1) / 2 + lx * (E.small ? 0.5 : 1) + (far ? -0.2 : 0.2), icy = 4.6 + ly;
        const tops = [];
        for (let i = 0; i < w; i++) {
          const bot = E.b[i], xx = col(i);
          let top = E.t[i] + E.h[i];
          if (half) top = Math.max(top, Math.min(bot - 1, 4));
          tops[xx - x0] = top;
          for (let r = top; r <= bot; r++) {
            const dxI = (xx - icx) / irx, dyI = (r - icy) / iry;
            let c = r === top ? whiteSh : white;
            if (dxI * dxI + dyI * dyI <= 1.06) {
              const pupil = Math.abs(xx - icx) < (E.small ? 0.6 : 1.05) && Math.abs(r - icy - 0.2) < (E.small ? 0.9 : 1.3);
              c = pupil ? pupilC : r <= top ? eyeR[SH2] : r < icy - 0.9 ? eyeR[SH] : r > icy + 1.5 ? eyeR[LIT] : eyeR[BASE];
            }
            dot(xx, y0 + r, c, P.face);
          }
          const lt = half ? Math.max(E.t[i], top - E.h[i]) : E.t[i];
          for (let r = 0; r < E.h[i]; r++) dot(xx, y0 + lt + r, lash, P.face);
          if (E.lower && i > 0 && i < w - 1) dot(xx, y0 + bot + 1, skinR[SH2], P.face);
          else if (i > 1 && i < w - 2) dot(xx, y0 + bot + 1, skinR[SH], P.face);
        }
        if (E.flick !== undefined) { dot(col(-1), y0 + E.flick, lash, P.face); if (!half && E.flick < 3) dot(col(-2), y0 + E.flick - 1, lash, P.face); }
        // the sparkle: upper left of the iris (the light comes from there)
        if (!half) {
          const hx = Math.round(icx - 1.3), top = tops[hx - x0] ?? 2, hy = Math.max(Math.round(icy - 1.7), top);
          if (idx(hx) >= 0 && idx(hx) < w) {
            dot(hx, y0 + hy, 0xffffff, P.face);
            if (!E.small) { dot(hx + 1, y0 + hy, 0xffffff, P.face); dot(hx, y0 + hy + 1, mix(0xffffff, eyeR[BASE], 0.35), P.face); }
          }
          if (twinkle) dot(Math.round(icx + 1.2), y0 + Math.round(icy + 1.6), 0xffffff, P.face);
        }
      }
    }
    // tired-but-kind eyes, eye bags, crow's feet
    if (sig.tired || (M.fx || []).includes('bags') || old) for (let i = 2; i < w - 1; i++) toneMin(col(i), y0 + 9, (M.fx || []).includes('bags') ? SH2 : SH, P.face);
    if (old) { dot(col(-1), y0 + 4, skinR[SH], P.face); dot(col(-2), y0 + 3, skinR[SH], P.face); dot(col(-2), y0 + 5, skinR[SH], P.face); }
    // brows
    const [br, bt, ba] = M.brow[far ? 1 : 0];
    browDraw(g, L, P, col, far, w, [br, bt - (sig.determined ? 1.2 : 0), ba], hairR);
  }
  // nose
  const nx = g.nx, ny = g.noseY, nose = L.nose;
  const s = c => dot(c[0], c[1], skinR[SH], P.face), s2 = c => dot(c[0], c[1], skinR[SH2], P.face), l = c => dot(c[0], c[1], skinR[LIT], P.face);
  if (sig.sunburn || kind === 'gnome') paintEll(nx - 0.2, ny - 0.4, 2.8, 2.3, mix(skinR[BASE], 0xe8503a, 0.42), P.face);
  if (nose === 'small') { s([nx + 1, ny]); s([nx, ny + 1]); l([nx - 1, ny - 1]); }
  else if (nose === 'big') {
    for (const [a, b] of [[-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1], [3, 0], [3, -1]]) s([nx + a, ny + b]);
    s2([nx - 2, ny + 2]); s2([nx + 2, ny + 2]); s([nx + 2, ny - 2]); s([nx + 2, ny - 3]);
    l([nx - 1, ny - 1]); l([nx, ny - 1]); l([nx - 1, ny]);
  } else if (nose === 'long') {
    for (let k = 6; k >= 1; k--) s([nx + 1, ny - k]);
    s([nx + 2, ny]); s([nx + 1, ny + 1]); s2([nx, ny + 2]); s([nx - 1, ny + 2]); l([nx - 1, ny - 1]); l([nx, ny]);
  } else { s([nx + 1, ny - 2]); s([nx + 1, ny - 1]); s([nx + 2, ny]); s2([nx + 1, ny + 1]); s([nx, ny + 1]); s([nx - 1, ny + 1]); l([nx - 1, ny - 1]); }
  // cheeks: freckles, rosy cheeks, blush, the soot on Stoker Sien
  if (L.freckles) for (const [a, b] of [[-11, -1], [-9, 0], [-12, 1], [-8, 2], [-10, 2], [-6, 1], [7, -1], [9, 0], [6, 1], [10, 1], [8, 2], [-3, -2], [1, -3], [3, -2]]) dot(nx + a, ny + b - 1, mix(skinR[BASE], 0x7a3a18, 0.42), P.face);
  const blush = L.blush || (M.fx || []).includes('blush') || mood === 'happy' && L.blush !== false && sig.twinkle;
  if (blush) for (const [cx0, rx] of [[g.eL + 2.5, 3.2], [g.eR + 4, 2.4]]) { paintEll(cx0, g.eyeY + 10.2, rx, 1.4, mix(skinR[BASE], 0xff5a6a, 0.33), P.face); }
  if ((M.fx || []).includes('blush')) for (const cx0 of [g.eL + 1, g.eR + 3]) for (let k = 0; k < 3; k++) { dot(Math.round(cx0) + k * 2, g.eyeY + 11, mix(skinR[BASE], 0xe02a4a, 0.55), P.face); dot(Math.round(cx0) + k * 2 + 1, g.eyeY + 10, mix(skinR[BASE], 0xe02a4a, 0.55), P.face); }
  if (sig.soot) { paintEll(g.eL + 1.5, g.eyeY + 11, 2.6, 1.4, mix(skinR[BASE], 0x2a2420, 0.5), P.face); dot(g.eL + 4, g.eyeY + 12, mix(skinR[BASE], 0x2a2420, 0.4), P.face); }
  if (sig.sunburn) for (const cx0 of [g.eL + 2.5, g.eR + 3.5]) paintEll(cx0, g.eyeY + 10, 2.6, 1.2, mix(skinR[BASE], 0xe8503a, 0.3), P.face);
  if (old) { quad(nx - 4, ny + 1, nx - 6, ny + 4, g.mx - 6, g.mouthY + 2, (a, b) => toneMin(a, b, SH, P.face)); quad(nx + 3, ny + 1, nx + 5, ny + 4, g.mx + 5, g.mouthY + 2, (a, b) => toneMin(a, b, SH, P.face)); for (let a = -6; a <= 6; a++) toneMin(g.X(0.5) + a, g.eyeY - 7 + (Math.abs(a) > 4 ? 1 : 0), SH, P.face); }
  if (L.facialHair !== 'walrus') mouthDraw(g, P, M, mood, mouth, skinR, sig, kind);
}
function browDraw(g, L, P, col, far, w, [raise, tilt, arch], hairR) {
  const style = L.brows || 'normal', n = w + (style === 'bushy' ? 2 : 1);
  const light = luma(hairR[BASE]) > 0.56, c = light ? hairR[SH2] : hairR[LINE], c2 = light ? hairR[SH] : hairR[SH2];
  const base = g.eyeY - 3 - raise;
  for (let k = 0; k < n; k++) {
    const i = k - (style === 'bushy' ? 2 : 1), u = (k - (n - 1) / 2) / ((n - 1) / 2);
    let y = base - arch * (1 - u * u) - tilt * (k / (n - 1)) + (k === 0 ? 1 : 0) * (style === 'thin' ? 0 : 0.6);
    y = Math.round(y);
    const th = style === 'thin' ? 1 : style === 'normal' ? (k < 2 ? 1 : 2) : style === 'thick' ? (k < 1 ? 2 : 3) : (k < 1 ? 2 : 3);
    for (let r = 0; r < th; r++) dot(col(i), y - r, r === th - 1 && th > 1 ? c2 : c, P.face);
    if (style === 'bushy' && k % 2 === 0) dot(col(i), y - th, c2, P.face);
  }
}
// mouths: closed shapes per mood, and open ones while talking (mouth 0..1)
function mouthDraw(g, P, M, mood, mouth, skinR, sig, kind) {
  const x = g.mx, y = g.mouthY, lip = mix(skinR[LINE], 0x6a1a22, 0.35), dark = 0x3a1016, tongue = 0xc8545e, teeth = 0xf6f2ea, m = P.face;
  const d = (a, b, c) => dot(x + a, y + b, c, m);
  let shape = M.mouth;
  if (sig.grin && (shape === 'flat' || shape === 'smile' || shape === 'smirk')) shape = 'grin';
  const open = mouth > 0.15 ? (mouth > 0.66 ? 3 : 2) : 0;
  const lowerLip = (w = 1, dy = 2) => { for (let a = -w; a <= w; a++) d(a, dy, skinR[SH]); };
  if (shape === 'grin') {
    // the salesman's smile: two rows of gleaming teeth, corners pulled up
    const wd = 5, h = open ? 3 : 2;
    for (let a = -wd; a <= wd; a++) d(a, -1, lip);
    d(-wd - 1, -2, lip); d(wd + 1, -2, lip);
    for (let a = -wd + 1; a <= wd - 1; a++) d(a, 0, a === -2 ? 0xffffff : teeth);
    for (let a = -wd + 2; a <= wd - 2; a++) d(a, 1, open ? dark : 0xe2ddd6);
    if (open) for (let a = -wd + 3; a <= wd - 3; a++) d(a, 2, tongue);
    d(-wd + 1, 1, lip); d(wd - 1, 1, lip);
    for (let a = -wd + 2; a <= wd - 2; a++) d(a, h, lip);
    lowerLip(2, h + 1);
    return;
  }
  if (shape === 'laugh') {
    const h = 3 + (open ? 1 : 0), wd = 4;
    for (let r = 0; r <= h; r++) { const hw = Math.max(1, wd - Math.max(0, r - 1)); for (let a = -hw; a <= hw; a++) d(a, r - 1, r === 0 ? lip : r === 1 ? teeth : r === h ? tongue : dark); }
    d(-wd - 1, -2, lip); d(wd + 1, -2, lip);
    lowerLip(2, h + 1);
    return;
  }
  if (open) {
    const smiley = shape === 'smile' || shape === 'smirk';
    const rows = shape === 'o' ? [[-1, 1], [-2, 2], [-2, 2], [-1, 1]].slice(0, open + 1) : shape === 'grit' ? [[-3, 3], [-3, 3], [-3, 3], [-2, 2]].slice(0, open + 1) : smiley ? [[-3, 3], [-3, 3], [-2, 2], [-1, 1]].slice(0, open) : [[-2, 2], [-2, 2], [-1, 1]].slice(0, open);
    rows.forEach(([a0, a1], r) => { for (let a = a0; a <= a1; a++) d(a, r, shape === 'grit' && (r === 0 || r === rows.length - 1) ? teeth : r === rows.length - 1 && rows.length >= 3 ? tongue : r === 0 && open >= 3 && Math.abs(a) <= 1 ? teeth : dark); });
    if (smiley) { d(rows[0][0] - 1, -1, lip); d(rows[0][1] + 1, -1, lip); }
    lowerLip(1, rows.length + 1);
    return;
  }
  const P0 = {
    flat: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]],
    smile: [[-3, -1], [-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0], [3, -1]],
    frown: [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]],
    wavy: [[-3, 0], [-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1], [3, 0]],
    smirk: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, -1], [3, -2]],
    side: [[1, 0], [2, 0], [3, 0], [4, -1]],
    tired: [[-2, 0], [-1, 0], [0, 0], [1, 1], [2, 1]],
  };
  if (shape === 'o') { for (const [a, b] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) d(a, b, dark); d(-1, -1, lip); d(1, -1, lip); d(-1, 1, lip); d(1, 1, lip); lowerLip(1, 3); return; }
  if (shape === 'grit') { for (let a = -3; a <= 3; a++) { d(a, -1, lip); d(a, 1, lip); d(a, 0, a % 2 ? teeth : 0xd8d0c8); } d(-4, 1, lip); d(4, 1, lip); lowerLip(2, 3); return; }
  for (const [a, b] of P0[shape] || P0.flat) d(a, b, lip);
  if (shape === 'smile') { d(-1, 3, skinR[SH]); d(0, 3, skinR[SH]); d(1, 3, skinR[SH]); }
  else if (shape === 'side') { d(2, 2, skinR[SH]); }
  else lowerLip(1, 2);
  if (kind === 'kobold' && (shape === 'smile' || shape === 'flat')) { d(-2, 1, 0xffffff); d(2, 1, 0xffffff); }
}
function facialHair(g, L, P, M, mood, mouth, col, skinR) {
  const fh = L.facialHair, p = P.fhair, x = g.mx, y = g.mouthY, R = ramp(col, 2);
  if (!fh || fh === 'none') return;
  if (fh === 'stubble') {
    const sc = mix(skinR[SH], col, 0.45);
    for (let yy = g.noseY + 2; yy <= g.chinY + 1; yy++) for (let xx = 0; xx < N; xx++) {
      const i = yy * N + xx;
      if (PART[i] !== P.face || OVER[i] >= 0) continue;
      const nearMouth = Math.abs(xx - x) < 6 && yy >= y - 2 && yy <= y + 6, low = yy > y - 1 + Math.abs(xx - g.X(0.4)) * 0.25 - 4 && yy > g.noseY + 3 + Math.max(0, 6 - Math.abs(xx - x)) * 0;
      if ((nearMouth || (low && yy > g.mouthY - 4)) && (xx + yy) % 2 === 0) OVER[i] = sc;
    }
    return;
  }
  const strands = (lo, hi) => { for (let yy = lo; yy <= hi; yy++) for (let xx = 0; xx < N; xx++) { const i = yy * N + xx; if (PART[i] === p && (xx * 3 + yy) % 4 === 0) TONE[i] = Math.max(SH2, TONE[i] - 1); } };
  if (fh === 'walrus') {
    const lift = {laugh: 3, happy: 2, smug: 1, surprised: 1, sad: -1.5, tired: -1, worried: -0.5}[mood] ?? 0, open = mouth > 0.15 || mood === 'laugh' || mood === 'surprised';
    if (open) mouthDraw({...g, mouthY: y + (mood === 'laugh' ? 4 : 3)}, P, mood === 'laugh' ? M : {...M, mouth: 'o'}, mood, mood === 'laugh' ? mouth : Math.max(0.5, mouth), skinR, {}, '');
    const up = open ? 1 : 0, lobe = (sx, lf, sc) => [x + sx * 0.6, y - 5.6 - up, x + sx * 5.6 * sc, y - 5.2 - lf * 0.3 - up, x + sx * 10.8 * sc, y - 3.2 - lf * 0.7, x + sx * 13.8 * sc, y + 1.4 - lf, x + sx * 13.4 * sc, y + 6.6 - lf * 1.4, x + sx * 11.6 * sc, y + 5.2 - lf * 1.2, x + sx * 10.2 * sc, y + 3.8 - lf, x + sx * 6.2 * sc, y + 2.6 - lf * 0.5 - up, x + sx * 1.4, y + 1.6 - up];
    const lfL = mood === 'smug' ? lift + 1.5 : lift, lfR = mood === 'thinking' ? lift + 1.5 : lift;
    const sh = ball(x - 5, y - 7, 15, 9, 0.12);
    poly(p, lobe(-1, lfL, 1), sh); poly(p, lobe(1, lfR, 0.92), sh);
    ell(p, x, y - 3 - up, 7.2, 3.8, sh);
    strands(y - 3, y + 7);
    // a few bristles poke out along the bottom
    for (let xx = x - 12; xx <= x + 12; xx += 3) { for (let yy = y + 7; yy > y - 2; yy--) { const i = yy * N + xx; if (PART[i] === p) { if (PART[i + N] !== p && yy + 1 < N) { PART[i + N] = p; TONE[i + N] = SH; } break; } } }
    if (mood === 'angry') for (let xx = x - 11; xx <= x + 11; xx += 2) { const i = (y + 3) * N + xx; if (PART[i] === p) PART[i] = P.face; }
    return;
  }
  const sh = ball(x - 5, y - 8, 16, 16, 0.1);
  const mous = (big = 1) => poly(p, [x - 0.4, y - 3.4, x - 4 * big, y - 2.6, x - 6.4 * big, y - 0.4, x - 6.8 * big, y + 0.8, x - 3.6, y - 0.9, x, y - 1.4, x + 3.6, y - 0.9, x + 6.2 * big, y + 0.8, x + 5.8 * big, y - 0.4, x + 3.6 * big, y - 2.6, x + 0.4, y - 3.4], sh);
  if (fh === 'moustache') { mous(1); return; }
  if (fh === 'goatee') {
    mous(0.85);
    poly(p, [x - 3.6, y + 2.4, x + 3.6, y + 2.4, x + 3, g.chinY + 1, x, g.chinY + 3.4, x - 3, g.chinY + 1], sh);
    for (const sx of [-1, 1]) line(x + sx * 5.6, y, x + sx * 3.8, y + 2.6, (a, b) => { const i = b * N + a; if (PART[i] === P.face) { PART[i] = p; TONE[i] = BASE; OVER[i] = -1; } });
    strands(y + 2, g.chinY + 3);
    mouthDraw(g, P, M, mood, mouth, skinR, {}, '');
    return;
  }
  // beard and full beard: follow the jaw, leave the mouth free
  const full = fh === 'full', ext = full ? 9 : 3.2, fw = g.fw, j = g.jaw + 1;
  const cxs = u => g.cx + u, top = g.eyeY + 5;
  const pts = [cxs(-fw - 0.6), top, cxs(-fw + 2.4), top + 1, cxs(-fw + 3.8), g.noseY + 2, x - 7.5, y - 1.4, x - 4.4, y - 2.6, x, y - 3.4, x + 4.4, y - 2.6, x + 7, y - 1.4, cxs(fw - 3.2), g.noseY + 2, cxs(fw - 2), top + 1, cxs(fw + 0.6), top,
    cxs(fw + 0.8), g.noseY + 3, cxs(j + (full ? 3 : 1)), g.mouthY + 3, x + g.chinW + (full ? 6 : 3), g.chinY + ext * 0.6, x + 2, g.chinY + ext, x - 2, g.chinY + ext + 0.6, x - g.chinW - (full ? 7 : 3.5), g.chinY + ext * 0.6, cxs(-j - (full ? 3 : 1)), g.mouthY + 3, cxs(-fw - 0.8), g.noseY + 3];
  poly(p, pts, sh);
  if (full) for (let k = -3; k <= 3; k++) { const bx = x + k * 3.4, by = g.chinY + ext - Math.abs(k) * 1.6; poly(p, [bx - 2, by - 2, bx + 2, by - 2, bx + 0.4, by + 2.4], sh); }
  strands(top, g.chinY + ext + 3);
  // the mouth stays visible: cut it free and redraw it
  for (let yy = y - 1; yy <= y + 3; yy++) for (let xx = x - 4; xx <= x + 4; xx++) { const i = yy * N + xx; if (PART[i] === p && Math.abs(xx - x) + Math.max(0, yy - y - 1) * 1.5 < 4.5) { PART[i] = P.face; TONE[i] = SH; OVER[i] = -1; } }
  mouthDraw(g, P, M, mood, mouth, skinR, {}, '');
}
function frontHair(g, L, P, sig, hairR, skinR) {
  const style = L.hair, t = g.top, p = P.hairF, fw = g.fw;
  if (style === 'bald') {
    toneEll(g.X(0.1) - 7, t + 6, 4, 2.4, LIT, P.face); tone(Math.round(g.X(0.1) - 9), t + 5, HI, P.face);
    return;
  }
  const vol = {buzz: 0.6, short: 2.2, side: 2.6, slick: 1.4, curly: 4.2, afro: 9.5, pixie: 1.8, bob: 2.6, long: 2.4, ponytail: 1.2, bun: 1.2, braids: 1.6}[style] ?? 2;
  const E = style === 'bob' && sig.bangs ? BANGS : HAIR_EDGES[style] || HAIR_EDGES.short;
  const ecx = g.X(0.5), cx = g.X(-0.08), cy = g.scy - 0.6 - vol * (style === 'afro' ? 0.5 : 0.25), rx = fw + 0.8 + vol, ry = g.sry + vol;
  const shade = style === 'buzz' ? ball(cx, cy, rx, ry) : hairShade(cx, cy, rx, ry, style === 'slick' ? 1.6 : style === 'afro' ? 0 : 1);
  const below = (x, y) => y + 0.5 <= t + edgeAt(E, (x + 0.5 - ecx) / fw);
  ell(p, cx, cy, rx, ry, shade, below);
  // a fuller crown: a few tufts break the perfect oval on top
  if (['short', 'side', 'pixie', 'bob', 'long', 'braids'].includes(style)) for (const [dx, dy, r] of [[-9, 2.2, 6], [-1, 0.6, 7], [8, 2.4, 6]]) ell(p, cx + dx, cy - ry + dy + 3, r, 4, shade, (x, y) => below(x, y) && y + 0.5 < cy - ry + 9);
  if (style === 'curly' || style === 'afro') {
    const n = style === 'afro' ? 20 : 12, r0 = style === 'afro' ? 3.6 : 3.4;
    for (let k = 0; k <= n; k++) { const a = Math.PI + (k / n) * Math.PI * (style === 'afro' ? 1.25 : 1) - (style === 'afro' ? Math.PI * 0.125 : 0); ell(p, cx + Math.cos(a) * (rx - 1.2), cy + Math.sin(a) * (ry - 1.2), r0, r0, shade, below); }
    // curls and the spongy texture
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (PART[i] !== p) continue;
      const hsh = ((x * 7 + y * 13) ^ (x * y)) & 15;
      if (style === 'afro') { if (hsh === 3 || hsh === 9) TONE[i] = Math.max(SH2, TONE[i] - 1); else if (hsh === 6 && TONE[i] >= BASE) TONE[i] = Math.min(HI, TONE[i] + 1); }
      else if ((x + (y >> 2) * 2) % 5 === 0 && y % 4 === 1) { TONE[i] = SH; if (x + 1 < N && PART[i + 1] === p) TONE[i + 1] = Math.min(HI, TONE[i] + 2); }
    }
  }
  if (style === 'slick') {
    ell(p, g.X(0.4) - 2, t + 9, 7, 3.4, shade, (x, y) => y + 0.5 < t + 10.5);
    // combed back with gel: tight lines that catch the light
    for (let k = 0; k < 9; k++) quad(g.X(0.3) - 15 + k * 3.6, t + 11, g.X(0.2) - 15.5 + k * 3.4, t + 4, g.X(0) - 13 + k * 3, t - 1.5, onPart(p, k % 3 === 1 ? HI : k % 3 === 2 ? SH : LIT));
  }
  if (style === 'side') quad(g.X(0.5) - 8, t - 1, g.X(0.5) - 8.6, t + 4, g.X(0.5) - 8, t + 10, (x, y) => tone(x, y, SH2, p));
  if (style === 'long' || style === 'braids' || style === 'bob') quad(g.X(0.5) - 1, t - 1, g.X(0.5) - 1.4, t + 3, g.X(0.5) - 1, t + 7, (x, y) => tone(x, y, SH2, p));
  if (style === 'buzz') for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (PART[i] === p) { if ((x + y * 3) % 4 === 0) TONE[i] = Math.min(HI, TONE[i] + 1); if (!below(x, y + 1) && (x + y) % 2) { PART[i] = P.face; TONE[i] = SH; } } }
  if (style === 'ponytail' || style === 'bun') {
    for (let k = 0; k < 5; k++) quad(g.X(0.5) - 12 + k * 6, t + 11, g.X(0.4) - 11 + k * 4, t + 4, g.X(-0.3) - 6 + k * 1.2, t + 0.5, (x, y) => tone(x, y, SH, p));
    const band = part(ramp(sig.messy ? 0x2a6a8a : 0x3a8a8a), {cast: 1});
    if (style === 'ponytail') { const bx = g.X(-0.35) - 9.5, by = t + 0.5; ell(band, bx, by, 2.6, 2.2, LIT); }
  }
  // locks: a dark line up from every valley of the fringe, a light stroke on every tip
  const onHair = t0 => (x, y) => { const i = y * N + x; if (PART[i] === p && OVER[i] < 0) TONE[i] = t0 === LIT ? Math.max(TONE[i], LIT) : Math.min(TONE[i], t0); };
  if (E.valleys) {
    for (const [u, y] of E.valleys) { const x = ecx + u * fw; quad(x, t + y + 0.5, x - u * 3 - 0.5, t + y - 3, x - u * 5 - 1.5, t + y - 7, onHair(SH)); }
    for (const [u, y] of E.tips) { const x = ecx + u * fw; line(x - 1.6 - u, t + y - 5.5, x - 0.8 - u * 0.5, t + y - 2.5, onHair(LIT)); }
  } else if (['long', 'bob', 'braids'].includes(style)) {
    for (const u of [-0.7, -0.4, 0.3, 0.62]) { const x = ecx + u * fw, y = t + edgeAt(E, u); quad(x, y - 0.5, x - u * 2, y - 5, x - u * 4, y - 9, onHair(SH)); }
  }
  // side panels and locks
  const sideL = g.X(-0.1) - fw, sideR = g.X(-0.1) + fw;
  if (style === 'bob') {
    const sh = hairShade(cx, t + 26, fw + 6, 28, 0);
    poly(p, [sideL - 3.4, t + 16, sideL + 3.4, t + 21, sideL + 4.4, t + 44, sideL + 3, t + 47.6, sideL - 3.2, t + 47.2, sideL - 4, t + 36], sh);
    poly(p, [sideR + 3.4, t + 16, sideR - 3.2, t + 21, sideR - 3.8, t + 44, sideR - 2.6, t + 47.6, sideR + 3.2, t + 47.2, sideR + 4, t + 36], (x, y) => Math.max(SH2, sh(x, y) - 1));
  }
  if (style === 'long') {
    const fl = sig.flow ? 1 : 0, sh = hairShade(cx, t + 30, fw + 8, 40, 0);
    hang(p, sideL + 0.4, t + 15, 62 + fl * 8, 4.2 + fl * 0.6, 3.6 + fl * 2.4, -2.5 - fl * 3, 0.8 + fl * 2.2, sh, 0);
    hang(p, sideR - 0.4, t + 15, 62 + fl * 8, 4.2 + fl * 0.6, 3.6 + fl * 2.4, 2.5 + fl * 3, 0.8 + fl * 2.2, (x, y) => Math.max(SH2, sh(x, y) - 1), 1.3);
  }
  if (style === 'pixie') for (const [sx, d] of [[sideL + 0.5, 1], [sideR - 0.5, -1]]) poly(p, [sx - 2 * d, t + 20, sx + 2.6 * d, t + 21, sx + 0.8 * d, t + 30], shade);
  if (style === 'braids') {
    const bead = part(ramp(0xd8a840, 4), {cast: 1});
    for (const [sx, d] of [[sideL + 1, -1], [sideR - 1, 1]]) {
      let bx = sx, by = t + 24;
      const seg = part(hairR, {soft: true, cast: 1});
      for (let k = 0; k < 18 && by < 92; k++) { const ox = bx + (k % 2 ? 0.8 : -0.8) + d * (k * 0.12); ell(seg, ox, by, 3.2, 2.5, (x, y) => (y + 0.5 < by - 0.6 && x + 0.5 < ox + 0.5 ? LIT : x + 0.5 > ox + 1.2 ? SH : BASE)); line(ox - 2, by + 1, ox + 1, by - 1, (x, y) => tone(x, y, SH, seg)); by += 3.6; bx += d * 0.15; }
      ell(bead, bx + d * 2.3, by - 0.4, 2, 1.6, LIT);
      poly(seg, [bx + d * 2.3 - 2.2, by + 1, bx + d * 2.3 + 2.2, by + 1, bx + d * 2.3, by + 5], BASE);
    }
  }
}
function headscarf(g, L, P) {
  const col = L.hair === 'headscarf' ? (L.scarfColor ?? L.hatColor ?? 0x7a3a5a) : (L.hatColor ?? L.topColor), R = ramp(col);
  const p = part(R, {soft: true, cast: 2}), cx = g.X(0.3), t = g.top, wy = g.eyeY + 5;
  const outer = (x, y) => { const a = (x + 0.5 - g.X(0.05)) / (g.fw + 5.8), b = (y + 0.5 - (t + 22)) / 26.5; return a * a + b * b <= 1; };
  const win = (x, y) => { const a = (x + 0.5 - cx) / (g.fw - 1.6), b = (y + 0.5 - wy) / (L.hair === 'headscarf' ? 19.4 : 21); return a * a + b * b <= 1; };
  const sh = ball(g.X(0.05) - 5, t + 12, g.fw + 8, 30);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (!outer(x, y) || win(x, y)) continue;
    if (y > g.chinY + 4 && L.hat === 'hood') continue;
    PART[i] = p; TONE[i] = sh(x, y); OVER[i] = -1;
  }
  // the opening: a folded edge around the face, deep shadow inside a hood
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (PART[i] !== p) continue; if (win(x - 1, y) || win(x + 1, y) || win(x, y + 1) || win(x, y - 1)) TONE[i] = L.hat === 'hood' ? SH2 : LIT; }
  if (L.hair === 'headscarf') {
    poly(p, [g.X(0.2) - g.fw + 2, g.chinY - 6, g.X(0.4) + g.fw - 3, g.chinY - 6, g.X(0.2) + g.fw + 9, g.shY + 4, g.cx + g.sw - 4, 97, g.cx - g.sw + 4, 97, g.X(0.2) - g.fw - 9, g.shY + 4], (x, y) => (x < g.cx - 8 ? LIT : x > g.cx + 10 ? SH : BASE));
    for (const [x0, x1] of [[g.cx - 14, g.cx - 18], [g.cx + 2, g.cx + 5], [g.cx + 16, g.cx + 21]]) quad(x0, g.chinY + 2, x0 + 2, g.shY + 6, x1, 97, (x, y) => tone(x, y, SH, p));
    dot(Math.round(g.X(0.4) + g.fw - 4), g.chinY - 2, 0xf0d070);
  }
  // under a hood, the fringe still peeks out
  if (L.hat === 'hood' && !['bald', 'buzz', 'slick', 'ponytail', 'bun', 'headscarf'].includes(L.hair)) {
    const ty = wy - 21, sh = hairShade(cx, ty, 14, 8, 0);
    for (const [u, len] of [[-0.6, 5], [-0.3, 7.5], [0, 6], [0.3, 8], [0.6, 5.5]]) { const x = cx + u * (g.fw - 2); poly(P.hairF, [x - 3.4, ty - 0.5, x + 3.4, ty - 0.5, x + 0.8, ty + len], sh); }
  }
}
function hat(g, L, P, sig) {
  const kind = L.hat, t = g.top, fw = g.fw, def = {cap: 0x5a5a62, beret: 0xc04030, beanie: 0x3a6a9a, tophat: 0x1e1c24, hood: L.topColor, quill: 0x2a2440, hardhat: 0xf2c230}[kind];
  const col = L.hatColor ?? def, R = ramp(col), p = part(R, {cast: 3}), cx = g.X(0.1);
  if (kind === 'cap') {
    const sh = ball(cx - 4, t + 2, fw + 4, 10);
    ell(p, cx, t + 5.5, fw + 2.8, 8.2, (x, y) => { const s = sh(x, y); return (x * 7 + y * 3) % 5 === 0 && s >= BASE ? s + 1 : (x * 7 + y * 3) % 5 === 2 ? Math.max(SH2, s - 1) : s; }, (x, y) => y + 0.5 < t + 11.8);
    const brim = part(R, {cast: 3});
    ell(brim, g.X(0.55) + 1, t + 11.6, 12.6, 2.4, (x, y) => (y + 0.5 < t + 11.2 ? BASE : SH));
    if (sig.postal) { const b = part(ramp(0xf0c838, 4)); ell(b, g.X(0.5), t + 6, 2.2, 1.8, LIT); }
  } else if (kind === 'beret') {
    const pts = [];
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, ex = Math.cos(a) * (fw + 4.6), ey = Math.sin(a) * 6.6; pts.push(cx - 2 + ex * Math.cos(-0.14) - ey * Math.sin(-0.14), t + 4.4 + ex * Math.sin(-0.14) + ey * Math.cos(-0.14)); }
    poly(p, pts, ball(cx - 8, t, fw + 6, 8));
    rect(p, Math.round(cx - 1), t - 4, Math.round(cx), t - 2, LIT);
  } else if (kind === 'beanie') {
    ell(p, cx, t + 9, fw + 2.6, 13.4, ball(cx - 5, t + 2, fw + 4, 14), (x, y) => y + 0.5 < t + 14);
    const band = part(R, {cast: 3});
    ell(band, g.X(0.15), t + 15.4, fw + 3.3, 4.6, (x) => (x % 2 ? SH : BASE), (x, y) => y + 0.5 > t + 11.6 && y + 0.5 < t + 19.6);
    ell(part(ramp(mix(col, 0xffffff, 0.4))), cx - 1, t - 4, 4.6, 4.2, ball(cx - 3, t - 6, 5, 5));
  } else if (kind === 'tophat') {
    const brim = part(R, {cast: 3});
    poly(p, [cx - 12.5, t + 4, cx + 12.5, t + 4, cx + 11.4, t - 24, cx - 11.4, t - 24], (x) => (x < cx - 8 ? LIT : x > cx + 8 ? SH : BASE));
    for (let y = t - 2; y <= t + 2; y++) for (let x = 0; x < N; x++) if (PART[y * N + x] === p) OVER[y * N + x] = y === t - 2 ? 0x8a2a2a : 0x6a1a1e;
    for (let y = t - 22; y < t - 3; y++) tone(Math.round(cx - 9), y, HI, p);
    ell(brim, cx, t + 4.4, fw + 7.6, 2.8, (x, y) => (y + 0.5 < t + 4 ? LIT : SH));
  } else if (kind === 'quill') {
    ell(p, cx, t + 5, fw + 3.4, 7.6, ball(cx - 6, t, fw + 4, 9), (x, y) => y + 0.5 < t + 11);
    for (let x = 0; x < N; x++) for (let y = t + 8; y < t + 11; y++) if (PART[y * N + x] === p) TONE[y * N + x] = SH;
    feather(part(ramp(0xf4ecdc), {cast: 1, soft: true}), cx + 8, t + 4, cx + 21, t - 2, cx + 25, t - 21, 3.6);
  } else if (kind === 'hardhat') {
    ell(p, cx, t + 9.5, fw + 2.4, 12.4, ball(cx - 5, t + 2, fw + 4, 14), (x, y) => y + 0.5 < t + 13.6);
    for (let y = t - 3; y < t + 13; y++) { tone(Math.round(cx - 1), y, LIT, p); tone(Math.round(cx), y, HI, p); tone(Math.round(cx + 1), y, SH, p); }
    const brim = part(R, {cast: 3});
    ell(brim, g.X(0.15), t + 13.4, fw + 5.4, 2.4, (x, y) => (y + 0.5 < t + 13 ? LIT : SH));
  }
  // 'hood' is drawn with the headscarf
}
// a feather along a curved spine, notched barbs on both sides
function feather(p, x0, y0, qx, qy, x1, y1, wmax) {
  const A = [], B = [], n = 16, spine = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    const x = a * x0 + b * qx + c * x1, y = a * y0 + b * qy + c * y1;
    const dx = 2 * (1 - s) * (qx - x0) + 2 * s * (x1 - qx), dy = 2 * (1 - s) * (qy - y0) + 2 * s * (y1 - qy), len = Math.hypot(dx, dy) || 1;
    const w = wmax * Math.pow(Math.sin(Math.PI * Math.min(0.999, 0.12 + s * 0.88)), 0.8) * (k % 3 === 2 ? 0.72 : 1);
    A.push(x - (dy / len) * w, y + (dx / len) * w); B.unshift(x + (dy / len) * w * 0.85, y - (dx / len) * w * 0.85);
    spine.push([x, y]);
  }
  poly(p, [...A, ...B], (x, y) => (x + y < x0 + y0 - 4 ? LIT : BASE));
  for (let k = 1; k < spine.length; k++) line(spine[k - 1][0], spine[k - 1][1], spine[k][0], spine[k][1], onPart(p, SH));
  for (let k = 3; k < n - 1; k += 3) line(spine[k][0], spine[k][1], A[k * 2], A[k * 2 + 1] + 1, onPart(p, SH));
}
function glasses(g, L, sig) {
  const kind = L.glasses, fc = L.glassesColor ?? (kind === 'shades' ? 0x18181e : 0x2c2428), fr = ramp(fc), y0 = g.eyeY - 1, y1 = g.eyeY + 7;
  const lenses = [[g.eL - 2, g.eL + 9], [g.eR - 2, g.eR + 8]];
  const hf = kind === 'half' ? 3 : 0;
  for (const [x0, x1] of lenses) {
    for (let x = x0; x <= x1; x++) for (let y = y0 + hf; y <= y1; y++) {
      // round frames lose their corners, half-moon frames get a flat top and a rounded bottom
      const cx = Math.min(x - x0, x1 - x), cy = Math.min(y - y0 - hf, y1 - y), cut = kind === 'round' ? 2 : kind === 'half' ? (y1 - y < y - y0 - hf ? 3 : 0) : 1;
      if (cx + cy < cut) continue;
      const edge = x === x0 || x === x1 || y === y0 + hf || y === y1 || cx + cy === cut;
      if (kind === 'shades') dot(x, y, edge ? fr[LINE] : y < y0 + 3 ? 0x2a3048 : y > y1 - 2 ? 0x1a1e30 : 0x222842, -1);
      else if (edge) dot(x, y, (y === y0 + hf && kind === 'square') || y === y1 ? fr[LINE] : fr[BASE], -1);
      if (kind === 'square' && y === y0 + 1 && !edge) dot(x, y, fr[SH], -1);
    }
    dot(x0 + 2, y0 + hf + 2, 0xf4fbff, -1); dot(x0 + 3, y0 + hf + 1, kind === 'shades' ? 0x8a9ac8 : 0xdcecff, -1);
    if (kind === 'shades') { dot(x0 + 2, y0 + 3, 0x6a7aa8, -1); dot(x1 - 2, y1 - 2, 0x4a5a88, -1); }
    if (sig.cateye) { const ox = x0 === lenses[0][0] ? x0 : x1, d = x0 === lenses[0][0] ? -1 : 1; dot(ox + d, y0, fr[BASE], -1); dot(ox + d * 2, y0 - 1, fr[BASE], -1); dot(ox + d, y0 - 1, fr[LIT], -1); dot(ox, y0 - 1, 0xf4fbff, -1); }
  }
  for (let x = lenses[0][1] + 1; x < lenses[1][0]; x++) dot(x, y0 + hf + 1, fr[BASE], -1);
  for (let x = Math.round(g.cx - g.fw); x < lenses[0][0]; x++) dot(x, y0 + hf + 2, fr[SH], -1);
  for (let x = lenses[1][1] + 1; x < Math.round(g.cx + g.fw - 0.5); x++) dot(x, y0 + hf + 2, fr[SH], -1);
  // the watchmaker's loupe: a brass tube over the far lens, the eye behind it magnified
  if (sig.loupe) {
    const cx = (lenses[1][0] + lenses[1][1]) / 2 + 0.5, cy = g.eyeY + 3.6, br = ramp(0xb8863a, 4);
    eachEll(cx, cy, 6.2, 6.2, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > 4.3) dot(x, y, d > 5.6 ? br[LINE] : x + y < cx + cy - 1 ? br[LIT] : br[SH]); else if (d > 3.6) dot(x, y, 0x2a2228); });
    dot(Math.round(cx - 2), Math.round(cy - 2), 0xffffff); dot(Math.round(cx - 1), Math.round(cy - 3), 0xdcecff);
  }
  if (sig.chain) for (const [sx, ex] of [[g.cx - g.fw, g.cx - g.fw + 3], [g.cx + g.fw - 1, g.cx + g.fw - 4]]) quad(sx, y0 + hf + 3, sx + (sx < 47 ? -3 : 3), g.mouthY + 4, ex, g.shY - 1, (x, y) => { if ((x + y) % 2) dot(x, y, 0xe0b85a); });
}
// sunglasses pushed up onto the hair: golden aviator frames, blue mirrored lenses
function shadesUp(g) {
  const lens = part(ramp(0x3a74c0), {cast: 1, ink: 0x6a4a10}), y = g.top + 5, gold = 0xf0c858, x1 = Math.round(g.X(0.4) - 12.5), x2 = Math.round(g.X(0.4) + 1.5);
  for (const x0 of [x1, x2]) {
    poly(lens, [x0, y - 2.4, x0 + 10, y - 2.4, x0 + 9.4, y + 1.6, x0 + 6.6, y + 3.4, x0 + 2.4, y + 3, x0 + 0.4, y + 1], (x, yy) => (yy + 0.5 < y - 0.8 ? LIT : yy + 0.5 > y + 1.6 ? SH : x < x0 + 4 ? HI : BASE));
    dot(x0 + 2, y - 1, 0xffffff); dot(x0 + 3, y - 1, 0xffffff); dot(x0 + 2, y, 0xdcecff);
  }
  for (let x = x1; x <= x2 + 9; x++) if (x < x1 + 10 || x >= x2) dot(x, y - 3, gold);
  for (let x = x1 + 10; x < x2; x++) { dot(x, y - 2, gold); }
  dot(x1 - 1, y - 2, gold); dot(x2 + 10, y - 2, gold); dot(x1 - 2, y - 1, 0xb8902a); dot(x2 + 11, y - 1, 0xb8902a);
}
function headset(g) {
  const p = part(ramp(0x2c2c34), {cast: 1}), cx = g.X(-0.1), cy = g.scy - 1, rx = g.fw + 3.4, ry = g.sry + 3.6;
  ell(p, cx, cy, rx, ry, (x, y) => (x < cx ? LIT : BASE), (x, y) => { const a = (x + 0.5 - cx) / (rx - 1.8), b = (y + 0.5 - cy) / (ry - 1.8); return a * a + b * b > 1 && y < g.eyeY + 3; });
  const ex = g.cx - g.fw - 0.8, ey = g.eyeY + 5;
  ell(p, ex, ey, 3.4, 4.4, ball(ex - 1, ey - 1, 3.6, 4.6));
  quad(ex + 1, ey + 4, ex + 2, g.mouthY + 2, g.mx - 6, g.mouthY + 1, (x, y) => dot(x, y, 0x3a3a44));
  dot(g.mx - 6, g.mouthY + 1, 0x60e090); dot(g.mx - 7, g.mouthY + 1, 0x2a2a30);
}
function earrings(g, L, covered) {
  if (covered && L.hair === 'headscarf') return;
  const hang = ['long', 'bob', 'braids', 'afro'].includes(L.hair) || covered;
  const x = Math.round(g.cx - g.fw - 0.6 + g.T * -0.2 * g.hw), y = g.eyeY + 10 + (hang ? 2 : 0);
  if (hang) { for (const [a, b] of [[0, 0], [-1, 1], [1, 1], [-1, 2], [1, 2], [0, 3]]) dot(x + a, y + b, b === 0 ? 0xfff0a0 : 0xd8a840); }
  else { dot(x, y, 0xfff0a0); dot(x + 1, y, 0xd8a840); dot(x, y + 1, 0xb8862a); }
  const xr = Math.round(g.cx + g.fw + 0.4 - 0.53);
  if (!hang) dot(xr, y, 0xd8a840);
}
function heldProp(g, L, P, sig, prop, skinR, topC, top2C, under) {
  const right = prop === 'folder' || prop === 'leash' || prop === 'ruler' || L.holdL === prop && !L.holdR;
  const s = right ? 1 : -1, cx = g.cx + 0.5, hx = cx + s * (g.sw - 11), hy = 86;
  const sl = part(ramp(under ? top2C : topC), {soft: true, cast: 1});
  const hand = part(sig.mitt ? ramp(0xd8502a) : skinR, {soft: true, cast: 1});
  // the forearm comes up from the bottom edge to the wrist, with a darker cuff
  const sleeve = (wx, wy) => { strip(sl, [wx - s * 5, 99, wx, wy], 9, (x) => (x < wx - 1.5 ? LIT : BASE)); eachEll(wx, wy + 1, 4.6, 1.8, (x, y) => tone(x, y, SH, sl)); };
  // a fist from the front: two finger creases, the thumb on top (a quilted oven mitt for Sien)
  const fist = (x, y) => {
    poly(hand, [x - 3.8, y - 2.2, x - 1.6, y - 3.8, x + 2.8, y - 3.4, x + 4, y - 0.6, x + 3.6, y + 3.2, x + 1.6, y + 4.2, x - 2.6, y + 3.8, x - 4.2, y + 1.2], (xx, yy) => (yy + 0.5 < y - 2 ? LIT : xx + 0.5 > x + 2.4 || yy + 0.5 > y + 2.9 ? SH : BASE));
    if (sig.mitt) { for (let yy = Math.round(y) - 3; yy <= y + 3; yy += 2) for (let xx = Math.round(x) - 3; xx <= x + 3; xx += 2) dot(xx, yy, 0xf2c890, hand); return; }
    for (const fy of [-0.2, 1.9]) line(x - 3, y + fy, x + 2, y + fy, onPart(hand, SH));
    line(x - 2.4, y - 2.8, x + 1, y - 3.2, onPart(hand, LIT));
    if (sig.ink) { dot(Math.round(x - 1), Math.round(y + 1), 0x1a2a5a, hand); dot(Math.round(x + 2), Math.round(y - 1), 0x1a2a5a, hand); dot(Math.round(x), Math.round(y + 3), 0x24346a, hand); }
  };
  const holdAt = (x, y) => { sleeve(x - s * 1.2, y + 4); return () => fist(x, y); };
  if (prop === 'mug' || prop === 'tea' || prop === 'coffee') {
    const big = !!sig.mugText, w = big ? 22 : 12, h = big ? 18 : 12, x0 = Math.round(hx - w / 2 + s * 3), y0 = Math.round(hy - h + 4);
    const mc = prop === 'tea' ? 0xe8945a : 0xf2ede4, m = part(ramp(mc), {cast: 1}), hxs = s < 0 ? x0 - 3 : x0 + w + 3;
    const grip = holdAt(hxs + s * 0.5, y0 + h / 2 + 1);
    poly(m, [x0, y0, x0 + w, y0, x0 + w, y0 + h - 2, x0 + w - 2, y0 + h, x0 + 2, y0 + h, x0, y0 + h - 2], (x) => (x < x0 + 3 ? LIT : x > x0 + w - 4 ? SH : BASE));
    ell(m, hxs, y0 + h / 2 - 1, 3.6, 4.4, BASE, (x, y) => { const a = (x + 0.5 - hxs) / 2, b = (y + 0.5 - (y0 + h / 2 - 1)) / 2.6; return a * a + b * b > 1; });
    ell(part(ramp(prop === 'coffee' || big ? 0x5a3418 : 0xb8742a)), x0 + w / 2, y0 + 0.6, w / 2 - 1, 1.6, BASE);
    if (big) { text(sig.mugText[0], x0 + 2, y0 + 4, 0x2a4a8a, m); text(sig.mugText[1], x0 + 2, y0 + 11, 0xb83a2a, m); }
    if (prop === 'tea') { line(x0 + w - 3, y0, x0 + w - 2, y0 + 5, (x, y) => dot(x, y, 0xf4f0e8)); rect(part(ramp(0xf2c838)), x0 + w - 4, y0 + 5, x0 + w - 1, y0 + 8, LIT); }
    for (const k of [0, 1]) { const sx = x0 + w / 2 - 3 + k * 5; quad(sx, y0 - 2, sx + 2, y0 - 5, sx, y0 - 8, (x, y) => dot(x, y, mix(OVER[y * N + x] >= 0 ? OVER[y * N + x] : 0x403020, 0xffffff, 0.45), i => !PART[i])); }
    grip();
  } else if (prop === 'folder') {
    const f = part(ramp(0xe8c050, 4), {cast: 1}), x0 = hx - 12, y0 = hy - 14, grip = holdAt(hx - s * 2, hy - 13);
    poly(f, [x0, y0 + 2, x0 + 20, y0 - 1, x0 + 23, y0 + 24, x0 + 3, y0 + 27], (x, y) => { const d = (x - x0) - (y - y0) * 0.6; return d > 6 && d < 9 ? HI : d > 14 ? SH : d < 3 ? LIT : BASE; });
    text('PP', Math.round(x0 + 7), Math.round(y0 + 8), 0x8a5a10, f);
    sparkle(Math.round(x0 + 19), Math.round(y0 + 2), 0xfff8d0);
    grip();
  } else if (prop === 'book') {
    const bc = sig.bookColor ?? 0x6a2a2a, b = part(ramp(bc), {cast: 1}), x0 = Math.round(hx - 8), y0 = hy - 12, grip = holdAt(s < 0 ? x0 + 15 : x0, y0 + 10);
    rect(b, x0, y0, x0 + 15, y0 + 20, (x) => (x < x0 + 3 ? LIT : BASE));
    for (let y = y0 + 1; y < y0 + 20; y++) dot(s < 0 ? x0 + 15 : x0, y, 0xefe6d0, b);
    for (let x = x0 + 4; x < x0 + 13; x++) { dot(x, y0 + 4, 0xd8b050, b); dot(x, y0 + 7, 0xd8b050, b); }
    grip();
  } else if (prop === 'form' || prop === 'clipboard') {
    const x0 = Math.round(hx - 5), y0 = hy - 16, grip = holdAt(x0 + 2, y0 + 13);
    if (prop === 'clipboard') rect(part(ramp(0xa07a50), {cast: 1}), x0 - 2, y0 - 2, x0 + 12, y0 + 16, BASE);
    const f = part(ramp(0xf6f2ea), {cast: 1});
    rect(f, x0, y0, x0 + 10, y0 + 13, LIT);
    for (let k = 0; k < 4; k++) for (let x = x0 + 2; x < x0 + 8 - (k === 3 ? 3 : 0); x++) dot(x, y0 + 2 + k * 2, 0x8a8aa0, f);
    rect(part(ramp(0xd04a3a)), x0 + 6, y0 + 9, x0 + 8, y0 + 11, BASE);
    if (prop === 'clipboard') rect(part(ramp(0xb8bec8)), x0 + 3, y0 - 3, x0 + 7, y0, LIT);
    grip();
  } else if (prop === 'ruler') {
    const r = part(ramp(0xf0d050), {cast: 1}), x0 = Math.round(hx - 1), grip = holdAt(x0 + 1.5, hy - 2);
    rect(r, x0, 50, x0 + 3, 96, (x) => (x === x0 ? LIT : BASE));
    for (let y = 52; y < 96; y += 2) dot(x0 + 3, y, 0x5a4a1a, r);
    for (let y = 52; y < 96; y += 6) { dot(x0 + 2, y, 0x5a4a1a, r); dot(x0 + 1, y, 0x5a4a1a, r); }
    grip();
  } else if (prop === 'horn') {
    // an ear trumpet: a brass tube from her ear that flares into a wide bell
    const br = ramp(0xd8a848, 4), p = part(br, {cast: 1}), ex = g.cx - g.fw, ey = g.eyeY + 6;
    strip(sl, [cx - g.sw + 4, 99, ex - 6, ey + 15], 8, (x) => (x < ex - 8 ? LIT : BASE));
    strip(p, [ex + 1.5, ey, ex - 3, ey + 2, ex - 7, ey + 5.5], 2.4, LIT);
    poly(p, [ex - 6, ey + 3.4, ex - 8, ey + 8.2, ex - 13.5, ey + 15.6, ex - 16.6, ey + 2.2], (x, y) => (y + 0.5 < ey + 6 ? LIT : BASE));
    ell(p, ex - 15.6, ey + 9, 3.4, 7.2, (x, y) => (y + 0.5 < ey + 7 ? HI : LIT));
    ell(part(ramp(0x3a2410), {soft: true}), ex - 15.8, ey + 9, 1.9, 5.2, (x, y) => (y + 0.5 < ey + 7 ? SH : BASE));
    fist(ex - 7, ey + 11);
  } else if (prop === 'leash') {
    // Meneer De Wit holds the lead of a dog that is not there: an empty collar dangles at the end
    const lc = 0xc0302a, lr = ramp(lc), lead = part(lr, {line: false, cast: 1}), fx = hx, fy = hy - 6, grip = holdAt(fx, fy);
    const loop = (x, y) => { const i = y * N + x; if (i >= 0 && i < NN) { PART[i] = lead; TONE[i] = x < fx ? LIT : BASE; OVER[i] = -1; } };
    for (const dx of [0, 1]) { quad(fx - 2 + dx, fy - 2, fx - 5 + dx, fy - 11, fx + 2 + dx, fy - 3, loop); }
    for (const dx of [0, 1]) quad(fx - 1 + dx, fy + 3, fx - 3 + dx, fy + 9, fx - 9 + dx, fy + 9, loop);
    const cx0 = fx - 13, cy0 = fy + 9;
    eachEll(cx0, cy0, 4, 3, (x, y) => { const d = ((x + 0.5 - cx0) / 4) ** 2 + ((y + 0.5 - cy0) / 3) ** 2; if (d > 0.42) loop(x, y); });
    const tag = part(ramp(0xe0b848, 4), {cast: 0});
    ell(tag, cx0, cy0 + 4.2, 1.7, 1.7, LIT);
    grip();
  } else if (prop === 'stamp' || prop === 'keys') {
    const grip = holdAt(hx, hy - 3);
    if (prop === 'stamp') { rect(part(ramp(0x7a5230), {cast: 1}), Math.round(hx - 1), hy - 12, Math.round(hx + 1), hy - 5, LIT); rect(part(ramp(0x3a7a4a), {cast: 1}), Math.round(hx - 4), hy - 5, Math.round(hx + 4), hy - 3, BASE); }
    else { const k = part(ramp(0xd8b050, 4), {cast: 1}); ell(k, hx, hy - 9, 4.4, 4.4, BASE, (x, y) => Math.hypot(x + 0.5 - hx, y + 0.5 - hy + 9) > 3); for (const a of [-1, 0, 1]) { strip(k, [hx + a * 3, hy - 5, hx + a * 4, hy + 2], 1.8, LIT); } }
    grip();
  }
}
function sparkle(x, y, c = 0xfff8d0) {
  for (let k = -3; k <= 3; k++) { dot(x + k, y, Math.abs(k) > 1 ? mix(c, 0xffd060, 0.5) : c); dot(x, y + k, Math.abs(k) > 1 ? mix(c, 0xffd060, 0.5) : c); }
  dot(x, y, 0xffffff);
}
// a teardrop: round below, a point on top (sweat, tears)
function drop(x, y, s = 1) {
  const p = part(ramp(0x8ac8ff), {rim: false, recv: false, soft: true, ink: 0x2a4a8a});
  ell(p, x, y + 1.7 * s, 2.1 * s, 2.3 * s, (xx, yy) => (xx + 0.5 < x - 0.3 && yy + 0.5 < y + 1.7 * s ? HI : LIT));
  poly(p, [x - 1.5 * s, y + 1.2 * s, x + 1.5 * s, y + 1.2 * s, x + 0.3, y - 2 * s], LIT);
}
function puff(p, x, y, d, n = 3) { for (let k = 0; k < n; k++) { const r = [3.4, 4, 3][k], px = x + d * k * 3.6, py = y - k * 3; ell(p, px, py, r, r * 0.92, ball(px - 1, py - 1.2, r, r)); } }
function moodFx(g, M, mood, sig) {
  const fx = M.fx || [], t = g.top;
  if (fx.includes('sweat')) drop(g.X(0.2) + g.fw - 1, t + 12, 1.35);
  if (fx.includes('tear')) drop(g.eL + 1, g.eyeY + 9, 1);
  if (fx.includes('joy')) { drop(g.eL - 1.5, g.eyeY + 3, 0.95); drop(g.eR + 9, g.eyeY + 3, 0.95); }
  if (fx.includes('vein')) {
    // the cartoon anger mark: four brackets around a gap, red with a dark rim
    const x = Math.round(g.X(0.3) + g.fw - 9), y = t + 3, pat = ['..X..X..', '..X..X..', 'XX....XX', '........', '........', 'XX....XX', '..X..X..', '..X..X..'];
    const on = (a, b) => pat[b]?.[a] === 'X';
    for (let b = -1; b <= 8; b++) for (let a = -1; a <= 8; a++) if (!on(a, b) && (on(a - 1, b) || on(a + 1, b) || on(a, b - 1) || on(a, b + 1))) dot(x + a, y + b, 0x6a0a12);
    for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) if (on(a, b)) dot(x + a, y + b, (a + b) % 3 ? 0xff4a4a : 0xff8a7a);
  }
  if (fx.includes('steam')) { const p = part(ramp(0xeeeef4), {rim: false, recv: false, soft: true, ink: 0x6a6a7c}); puff(p, g.cx - g.fw - 2, t + 9, -1); puff(p, g.cx + g.fw + 5, t + 7, 1); }
  if (fx.includes('shock')) for (const [x0, y0, x1, y1] of [[69, t - 2, 73, t - 7], [74, t + 4, 80, t + 1], [62, t - 5, 63, t - 10]]) line(x0, y0, x1, y1, (x, y) => dot(x, y, 0xfff4d0, i => !PART[i]));
  if (fx.includes('think')) {
    const p = part(ramp(0xf4f0e8), {rim: false, recv: false, soft: true, ink: 0x4a4250}), bx = Math.min(83, Math.round(g.X(0.3) + g.fw + 14)), by = t + 3;
    ell(p, g.X(0.3) + g.fw + 3, t + 19, 1.6, 1.6, LIT); ell(p, g.X(0.3) + g.fw + 7, t + 13, 2.4, 2.2, LIT);
    ell(p, bx, by, 8.4, 6, ball(bx - 2, by - 2, 8, 6));
    for (const k of [-4, 0, 4]) { dot(bx + k - 1, by, 0x4a4250); dot(bx + k, by, 0x4a4250); }
  }
  if (fx.includes('sparkle')) sparkle(Math.round(g.X(0.3) + g.fw + 9), t + 4);
  if (sig.grin && (mood === 'neutral' || mood === 'happy' || mood === 'smug')) { const x = g.mx + 6, y = g.mouthY - 2; for (const [a, b, c] of [[0, 0, 0xffffff], [-1, 0, 0xfff4c0], [1, 0, 0xfff4c0], [0, -1, 0xfff4c0], [0, 1, 0xfff4c0], [2, 0, 0xffe080], [0, -2, 0xffe080]]) dot(x + a, y + b, c); }
  if (fx.includes('sigh')) { const p = part(ramp(0xe8eef4), {rim: false, recv: false}); ell(p, g.mx + 12, g.mouthY + 3, 2.4, 1.8, LIT); ell(p, g.mx + 15, g.mouthY + 1.5, 1.8, 1.5, LIT); }
}

// ---------------------------------------------------------------- creatures
// the same mood effects for the folk: (x, y) the middle of the face, w its half width, top the top of the head
function folkFx(mood, x, y, w, top) {
  const fx = MOOD[mood].fx || [];
  if (fx.includes('sweat')) drop(x + w - 1, top + 6, 1.3);
  if (fx.includes('tear')) drop(x - w * 0.45, y + 6, 1);
  if (fx.includes('joy')) { drop(x - w * 0.7, y - 1, 0.95); drop(x + w * 0.7, y - 1, 0.95); }
  if (fx.includes('steam')) { const p = part(ramp(0xeeeef4), {rim: false, recv: false, soft: true, ink: 0x6a6a7c}); puff(p, x - w - 3, top + 7, -1); puff(p, x + w + 3, top + 5, 1); }
  if (fx.includes('shock')) for (const [x0, y0, x1, y1] of [[x + w - 2, top - 1, x + w + 2, top - 6], [x + w + 3, top + 5, x + w + 9, top + 2], [x + w - 9, top - 4, x + w - 8, top - 9]]) line(x0, y0, x1, y1, (a, b) => dot(a, b, 0xfff4d0, i => !PART[i]));
  if (fx.includes('think')) { const p = part(ramp(0xf4f0e8), {rim: false, recv: false, soft: true, ink: 0x4a4250}), bx = Math.min(83, x + w + 12), by = Math.max(12, top); ell(p, x + w + 2, by + 15, 1.6, 1.6, LIT); ell(p, x + w + 6, by + 9, 2.4, 2.2, LIT); ell(p, bx, by, 8.4, 6, ball(bx - 2, by - 2, 8, 6)); for (const k of [-4, 0, 4]) { dot(bx + k - 1, by, 0x4a4250); dot(bx + k, by, 0x4a4250); } }
  if (fx.includes('sparkle')) sparkle(Math.round(Math.min(84, x + w + 6)), Math.round(Math.max(10, top + 2)));
  if (fx.includes('sigh')) { const p = part(ramp(0xe8eef4), {rim: false, recv: false}); ell(p, x + w * 0.6 + 4, y + 10, 2.4, 1.8, LIT); ell(p, x + w * 0.6 + 7, y + 8.5, 1.8, 1.5, LIT); }
}
// a simple face for the folk without human features
const halfMask = (M, blink) => M.eye === 'half' || M.eye === 'tired' || (blink >= 0.3 && blink < 0.75);
function toonFace(x, y, s, mood, mouth, blink, o = {}) {
  const M = MOOD[mood], ink = o.ink ?? 0x2a1406, e = o.eye ?? ink, gap = Math.round(8 * s), ew = Math.max(2, Math.round(3 * s)), eh = Math.max(3, Math.round(4.4 * s)), m = o.mask;
  const closed = blink >= 0.75 || M.eye === 'arc';
  for (const sx of [-1, 1]) {
    const cx = Math.round(x + sx * gap), cy = Math.round(y);
    if (closed) { const up = M.eye === 'arc'; for (let k = -ew; k <= ew; k++) dot(cx + k, cy + (up ? Math.abs(k) > ew - 1 ? 1 : 0 : Math.abs(k) > ew - 1 ? -1 : 0), ink, m); continue; }
    const big = M.eye === 'wide' ? 1 : 0;
    for (let yy = -eh - big; yy <= eh + big; yy++) for (let xx = -ew - big; xx <= ew + big; xx++) {
      const a = xx / (ew + big + 0.4), b = yy / (eh + big + 0.4);
      if (a * a + b * b > 1) continue;
      let cut = false;
      if (M.eye === 'half' || M.eye === 'tired' || blink >= 0.3) cut = yy < -1;
      if (M.eye === 'angry') cut = yy < -eh + 1 + ((xx * -sx) + ew) * 0.6;
      if (M.eye === 'sad') cut = yy < -eh + 1 + ((xx * sx) + ew) * 0.5;
      if (M.eye === 'smile') cut = yy > eh - 2;
      if (cut) continue;
      dot(cx + xx, cy + yy, big ? (Math.abs(xx) <= 1 && Math.abs(yy) <= 1 ? ink : 0xffffff) : e, m);
    }
    if (!big) { dot(cx - 1, cy - Math.max(1, eh - 2), 0xffffff, m); if (s > 0.9) dot(cx, cy - Math.max(1, eh - 2), 0xffffff, m); }
    if (o.brows || M.eye === 'angry' || M.eye === 'sad') { const tilt = M.eye === 'angry' ? -1 : M.eye === 'sad' ? 1 : 0; for (let k = -ew; k <= ew; k++) dot(cx + k, cy - eh - 2 - Math.round((k * -sx / ew) * tilt), ink, m); }
  }
  const my = Math.round(y + 8 * s), mx = Math.round(x + (o.dx ?? 0));
  const d = (a, b, c) => dot(mx + a, my + b, c, m), dark = o.mouthCol ?? 0x5a1410;
  const open = mouth > 0.15 ? (mouth > 0.66 ? 3 : 2) : 0;
  const shape = o.grin && (M.mouth === 'flat' || M.mouth === 'smile') ? 'laugh' : M.mouth;
  if (shape === 'laugh' || open) { const h = shape === 'laugh' ? 3 + (open ? 1 : 0) + (o.grin ? 1 : 0) : open; for (let r = 0; r < h; r++) { const hw = (o.grin ? 6.5 : shape === 'laugh' || shape === 'smile' ? 3.5 : 2.2) - r * (o.grin ? 1.6 : 0.8); for (let a = -Math.round(hw); a <= Math.round(hw); a++) d(a, r, r === 0 && shape === 'laugh' ? 0xffffff : r === h - 1 && h > 2 ? 0xd85a62 : dark); } return; }
  const shapes = {flat: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]], smile: [[-3, -1], [-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0], [3, -1]], frown: [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]], wavy: [[-3, 0], [-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1], [3, 0]], smirk: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, -1], [3, -2]], side: [[1, 0], [2, 0], [3, 0], [4, -1]], tired: [[-2, 0], [-1, 0], [0, 0], [1, 1], [2, 1]], grit: [[-3, 0], [-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1], [3, 0]], o: [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]};
  for (const [a, b] of shapes[shape] || shapes.flat) d(a, b, ink);
}
function glowBody(p, cx, cy, rx, ry) {
  return (x, y) => { const a = (x + 0.5 - cx + rx * 0.18) / rx, b = (y + 0.5 - cy + ry * 0.12) / ry, r = Math.sqrt(a * a + b * b); return r < 0.4 ? HI : r < 0.72 ? LIT : r < 0.93 ? BASE : SH; };
}
function flame(p, cx, base, top, w, sh, lick = 1) {
  poly(p, [cx - w, base, cx - w * 0.55, base - (base - top) * 0.55, cx - w * 0.15, top + 4 * lick, cx + w * 0.12, top, cx + w * 0.3, top + 6 * lick, cx + w * 0.62, base - (base - top) * 0.6, cx + w, base], sh);
}
function creature(S, mood, mouth, blink) {
  const k = S.kind, sp = S.spec || {}, id = S.id, c = colorOf(sp.color, null);
  if (k === 'pip' || k === 'wisp') {
    const col = c ?? 0xffc85a, R = ramp(col, 3), p = part(R, {ink: R[LINE], rim: false});
    const gl = glowBody(p, 48, 60, 21, 22);
    flame(p, 48, 52, 14, 15, gl);
    ell(p, 48, 60, 21, 22, gl);
    aura(0xffb040, 7, 0.55);
    for (const sx of [-1, 1]) paintEll(48 + sx * 13, 66, 3.2, 1.6, mix(R[BASE], 0xff5a5a, 0.35), p);
    toonFace(48, 58, 1.15, mood, mouth, blink, {mask: p});
    folkFx(mood, 48, 58, 19, 34);
    return;
  }
  if (k === 'spark') {
    const col = c ?? 0xffb84a, R = ramp(col, 3), p = part(R, {ink: R[LINE], rim: false}), vonk = id === 'vonk';
    const gl = glowBody(p, 48, 64, 19, 22);
    flame(p, 48, 60, vonk ? 2 : 16, vonk ? 20 : 15, gl, vonk ? 1.8 : 1);
    if (vonk) { flame(p, 33, 62, 22, 7, gl); flame(p, 63, 62, 18, 7, gl); }
    ell(p, 48, 66, 20, 21, gl);
    aura(col, vonk ? 8 : 6, 0.5);
    if (id === 'pieter' || sp.dim) for (let y = 0; y < N; y++) for (let x = 49; x < N; x++) { const i = y * N + x; if (PART[i] === p) { TONE[i] = Math.max(SH2, TONE[i] - 2); if ((x + y) % 2 === 0 && x === 49) OVER[i] = R[LINE]; } }
    toonFace(48, 63, 1.1, mood, mouth, blink, {mask: p, grin: vonk});
    // Ans: thirty years of experience, tiny reading glasses perched low
    if (id === 'ans' || sp.glasses) {
      const fc = 0x241838;
      for (const sx of [-1, 1]) { const cx = 48 + sx * 9, cy = 67; for (let a = -3; a <= 3; a++) { dot(cx + a, cy - 2, fc); dot(cx + a, cy + 2, fc); } for (let b = -1; b <= 1; b++) { dot(cx - 4, cy + b, fc); dot(cx + 4, cy + b, fc); } for (let a = -3; a <= 3; a++) for (let b = -1; b <= 1; b++) dot(cx + a, cy + b, mix(R[LIT], 0xffffff, 0.35)); dot(cx - 2, cy - 1, 0xffffff); }
      for (let a = -4; a <= 4; a++) dot(48 + a, 66, fc);
    }
    if (id === 'joris' || sp.sprout) { const sp2 = part(ramp(0x5ab04a)); rect(sp2, 47, 8, 48, 18, BASE); ell(sp2, 43, 9, 4.4, 2.4, LIT); ell(sp2, 53, 7, 4.4, 2.4, BASE); }
    if (id === 'fatma' || sp.clipboard) { const b = part(ramp(0xa07a50)); rect(b, 54, 70, 70, 92, BASE); const f = part(ramp(0xf6f2ea)); rect(f, 56, 72, 68, 92, LIT); for (let r = 0; r < 4; r++) for (let x = 58; x < 66; x++) dot(x, 76 + r * 3, r === 0 && x < 61 ? 0x3a9a4a : 0x8a8aa0, f); rect(part(ramp(0xb8bec8)), 59, 68, 65, 71, LIT); ell(part(R), 55, 80, 3, 3, LIT); }
    folkFx(mood, 48, 63, 19, 42);
    return;
  }
  if (k === 'cloud') {
    const col = c ?? 0xdfe6f0, R = ramp(col), p = part(R, {soft: true});
    const sh = ball(40, 40, 40, 34, 0.15);
    for (const [x, y, r] of [[48, 56, 21], [27, 62, 14], [69, 62, 15], [36, 42, 14], [58, 40, 13], [48, 76, 20], [20, 80, 12], [76, 80, 13]]) ell(p, x, y, r, r * 0.92, sh);
    for (const [x, y, r] of [[40, 34, 6], [58, 31, 5]]) toneEll(x, y, r, r * 0.6, HI, p);
    toonFace(48, 54, 1.1, mood, mouth, blink, {mask: p, ink: 0x1a2030});
    const tc = sp.tie ?? 0xc0302a, tp = part(ramp(tc), {cast: 1});
    poly(part(ramp(0xffffff)), [42, 69, 47, 70, 44, 74], LIT); poly(part(ramp(0xffffff)), [54, 69, 49, 70, 52, 74], LIT);
    rect(tp, 47, 70, 49, 72, LIT); poly(tp, [47.2, 72.6, 48.8, 72.6, 50.6, 84, 48, 86.4, 45.4, 84], BASE);
    if (mood === 'sad') for (const [x, y] of [[30, 90], [44, 93], [60, 91]]) { const q = part(ramp(0x7ab4ff)); ell(q, x, y, 1.4, 2, LIT); }
    if (mood === 'angry') { const q = part(ramp(0xffe050)); poly(q, [78, 66, 84, 66, 80, 74, 85, 74, 74, 90, 77, 78, 73, 78], LIT); }
    folkFx(mood, 48, 54, 20, 30);
    return;
  }
  if (k === 'owl') {
    const col = c ?? 0x8a6a4a, R = ramp(col), p = part(R, {soft: true}), cream = part(ramp(0xe8d8b8), {soft: true});
    ell(p, 48, 88, 31, 26, ball(40, 76, 32, 26));
    ell(cream, 48, 90, 17, 16, BASE);
    for (let y = 78; y < 97; y += 4) for (let x = 34; x < 62; x += 4) { dot(x + (y % 8 ? 2 : 0), y, ramp(0xe8d8b8)[SH], cream); dot(x + 1 + (y % 8 ? 2 : 0), y + 1, ramp(0xe8d8b8)[SH], cream); }
    const head = part(R, {soft: true, cast: 2});
    poly(head, [22, 34, 26, 12, 34, 26], ball(26, 20, 8, 12)); poly(head, [74, 34, 70, 12, 62, 26], SH);
    ell(head, 48, 46, 26, 23, ball(40, 36, 26, 23));
    const disc = part(ramp(0xe8d8b8), {soft: true});
    for (const sx of [-1, 1]) ell(disc, 48 + sx * 10.5, 46, 10, 10, ball(48 + sx * 10.5 - 2, 43, 10, 10));
    const eyeC = 0xffd24a, M = MOOD[mood], closed = blink >= 0.75 || M.eye === 'arc';
    for (const sx of [-1, 1]) {
      const ex = 48 + sx * 10.5, ey = 46;
      if (closed) { for (let a = -5; a <= 5; a++) dot(Math.round(ex + a), ey + (Math.abs(a) > 3 ? (M.eye === 'arc' ? 1 : -1) : 0), 0x2a1a0a, disc); continue; }
      // the lids cut the round eye: flat (half), slanted in (angry) or out (sad), pushed up by the cheeks (happy)
      const half = M.eye === 'half' || M.eye === 'tired' || (blink >= 0.3 && blink < 0.75);
      eachEll(ex, ey, 6.4, 6.4, (x, y) => {
        const dy = y + 0.5 - ey, dx = (x + 0.5 - ex) * sx;
        if (half && dy < -0.5) return;
        if (M.eye === 'angry' && dy < -3 - dx * 0.8) return;
        if (M.eye === 'sad' && dy < -3.6 + dx * 0.8) return;
        if (M.eye === 'smile' && dy > 2.2 - Math.abs(dx) * 0.35) return;
        dot(x, y, eyeC, disc);
      });
      const pr = M.eye === 'wide' ? 1.6 : half ? 2.6 : 3.2, lx = M.look[0] * 1.5, ly = M.look[1] * 1.5 + (half ? 1.5 : 0);
      eachEll(ex + lx, ey + ly + 0.5, pr, pr, (x, y) => { const i = y * N + x; if (OVER[i] === eyeC) OVER[i] = 0x1a1008; });
      dot(Math.round(ex + lx - pr * 0.5), Math.round(ey + ly - pr * 0.5), 0xffffff, i => OVER[i] === 0x1a1008);
      if (sp.glasses) eachEll(ex, ey, 7.6, 7.6, (x, y) => { const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey); if (d > 6.4 && d <= 7.6) dot(x, y, d > 7 ? 0x2a2228 : 0x5a4a50); });
      // feather tufts for brows
      const [raise, tilt] = M.brow[sx < 0 ? 0 : 1];
      for (let a = -5; a <= 5; a++) { const y = Math.round(ey - 10 - raise - (a * -sx / 5) * tilt * 0.9); dot(Math.round(ex + a), y, R[LINE], head); dot(Math.round(ex + a), y - 1, Math.abs(a) < 4 ? R[SH2] : R[LINE], head); }
    }
    if (sp.glasses) for (let x = 45; x <= 51; x++) dot(x, 44, 0x2a2228);
    const beak = part(ramp(0xe8a040), {cast: 1}), open = mouth > 0.15 ? 2 : M.mouth === 'laugh' || M.mouth === 'o' ? 2 : 0;
    poly(beak, [44.6, 53, 51.4, 53, 48, 60], (x) => (x < 48 ? LIT : BASE));
    if (open) { poly(part(ramp(0x6a2a1a)), [45.5, 58, 50.5, 58, 48, 61 + open], BASE); }
    const wing = part(ramp(mix(col, 0x000000, 0.12)), {soft: true, cast: 1});
    poly(wing, [70, 70, 82, 76, 84, 97, 66, 97, 64, 84], ball(72, 76, 12, 18));
    if (sp.stamp !== false) { rect(part(ramp(0x7a5230), {cast: 1}), 70, 76, 72, 84, LIT); rect(part(ramp(0xc03020), {cast: 1}), 66, 84, 76, 88, BASE); }
    folkFx(mood, 48, 46, 22, 24);
    return;
  }
  if (k === 'padlock') {
    const col = c ?? 0xc8a040, R = ramp(col, 4), sh = part(ramp(0x9a9aa8, 4), {soft: true}), p = part(R, {soft: true, cast: 2});
    ell(sh, 48, 40, 17.5, 22, ball(40, 30, 18, 22), (x, y) => Math.hypot((x + 0.5 - 48) / 11.2, (y + 0.5 - 40) / 15.6) > 1 && y < 52);
    poly(p, [26, 50, 70, 50, 72, 54, 72, 88, 68, 92, 28, 92, 24, 88, 24, 54], ball(38, 58, 34, 34));
    for (const [x, y] of [[29, 55], [67, 55], [29, 87], [67, 87]]) { dot(x, y, R[HI], p); dot(x + 1, y + 1, R[SH2], p); }
    toonFace(48, 64, 1.05, mood, mouth, blink, {mask: p, ink: 0x2a1a08});
    const kh = part(ramp(0x2a1a0a));
    ell(kh, 48, 80, 2.6, 2.6, BASE); poly(kh, [46.4, 81, 49.6, 81, 50.6, 88, 45.4, 88], BASE);
    folkFx(mood, 48, 64, 20, 46);
    return;
  }
  if (k === 'orakel') {
    // PraatPal Orakel(TM): a golden frame around a screen face that glows
    const gold = ramp(0xf0c458, 4), fr = part(gold, {soft: true, ink: 0x4a3008}), M = MOOD[mood], angry = mood === 'angry';
    poly(fr, [24, 12, 72, 12, 80, 20, 80, 80, 72, 88, 24, 88, 16, 80, 16, 20], ball(34, 26, 44, 48));
    for (const [x, y] of [[48, 9], [14, 50], [82, 50]]) { const gem = part(ramp(0x5ad0ff, 3), {ink: 0x1a4a6a}); ell(gem, x, y, 3.3, 3.3, glowBody(gem, x, y, 3.3, 3.3)); }
    const scrC = angry ? 0x3a1018 : mood === 'sad' ? 0x0e1e3a : 0x0b2a34, sR = ramp(scrC), scr = part(sR, {soft: true, rim: false});
    poly(scr, [27, 20, 69, 20, 73, 24, 73, 76, 69, 80, 27, 80, 23, 76, 23, 24], (x, y) => { const d = (x - 48) ** 2 / 700 + (y - 50) ** 2 / 900; return d < 0.32 ? LIT : d < 0.8 ? BASE : SH; });
    for (let y = 21; y < 80; y += 3) for (let x = 23; x < 74; x++) { const i = y * N + x; if (PART[i] === scr) TONE[i] = Math.max(SH2, TONE[i] - 1); }
    for (let y = 21; y < 46; y++) for (let x = 24; x < 62; x++) { const i = y * N + x, d = x - 24 + (y - 21); if (d >= 7 && d <= 10 && PART[i] === scr) OVER[i] = mix(sR[TONE[i]], 0xffffff, 0.14); }
    aura(0xffd36b, 8, 0.5);
    const gl = angry ? 0xffb49a : 0xfff4c8, gl2 = angry ? 0xd0503a : 0x7ae0f0, lit = new Set();
    const px = (x, y, c = gl) => { x = Math.round(x); y = Math.round(y); const i = y * N + x; if (PART[i] === scr) { OVER[i] = c; lit.add(i); } };
    const blinkC = blink >= 0.75, halfE = M.eye === 'half' || M.eye === 'tired' || (blink >= 0.3 && !blinkC);
    for (const sx of [-1, 1]) {
      const ex = 48 + sx * 11, ey = 42;
      if (M.eye === 'arc' || M.eye === 'smile') for (let a = -3; a <= 3; a++) { px(ex + a, ey + Math.round(Math.abs(a) * 0.8) - 1); px(ex + a, ey + Math.round(Math.abs(a) * 0.8)); }
      else if (blinkC) for (let a = -3; a <= 3; a++) px(ex + a, ey + 1);
      else if (M.eye === 'wide') { for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const d = Math.hypot(a, b); if (d > 2.6 && d < 3.9) px(ex + a, ey + b); } px(ex, ey); }
      else if (M.eye === 'angry') for (let a = -3; a <= 3; a++) { px(ex + a, ey + Math.round(a * sx * 0.6)); px(ex + a, ey + Math.round(a * sx * 0.6) + 1); }
      else if (M.eye === 'sad') { for (let a = -3; a <= 3; a++) { px(ex + a, ey - Math.round(a * sx * 0.5)); px(ex + a, ey - Math.round(a * sx * 0.5) + 1); } for (const b of [4, 5, 7]) px(ex - sx * 2, ey + b, gl2); }
      else if (halfE) for (let a = -2; a <= 2; a++) for (let b = 0; b <= 2; b++) px(ex + a, ey + b);
      else if (mood === 'thinking') for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) px(ex + 1 + a, ey - 2 + b);
      else { const lx = mood === 'worried' ? -1 : 0; for (let a = -2; a <= 1; a++) for (let b = -3; b <= 3; b++) if (!((a === -2 || a === 1) && Math.abs(b) === 3)) px(ex + a + lx, ey + b); px(ex - 1 + lx, ey - 2, 0xffffff); }
    }
    const my = 63;
    if (mouth > 0.15 || mood === 'laugh') {
      // talking: an equaliser instead of a mouth
      const hs = [1, 3, 5, 3, 6, 2, 4, 1], amp = mood === 'laugh' ? 1.3 : mouth;
      hs.forEach((h, i) => { const hh = Math.max(0, Math.round(h * amp)); for (let b = -hh; b <= hh; b++) { px(34 + i * 4, my + b, Math.abs(b) === hh && hh ? gl2 : gl); px(35 + i * 4, my + b, Math.abs(b) === hh && hh ? gl2 : gl); } });
    } else if (mood === 'thinking') {
      // a progress bar: denkt na...
      for (let x = 33; x <= 63; x++) { px(x, my - 2, gl2); px(x, my + 2, gl2); }
      for (let y = my - 1; y <= my + 1; y++) { px(33, y, gl2); px(63, y, gl2); for (let x = 35; x <= 49; x++) px(x, y); }
    } else {
      const f = {flat: a => Math.round((1 - (a * a) / 64) * 1.2), smile: a => Math.round((1 - (a * a) / 64) * 3) - 1, frown: a => 1 - Math.round((1 - (a * a) / 64) * 2.6), wavy: a => Math.round(Math.sin(a * 0.8) * 1.4), smirk: a => (a > 1 ? -Math.round((a - 1) / 2.5) : 0), tired: () => 0, grit: a => (a % 2 ? 1 : -1), o: () => 0}[M.mouth] || (() => 0);
      if (M.mouth === 'o') { for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const d = Math.hypot(a, b); if (d > 1.8 && d < 3.1) px(48 + a, my + b); } }
      else for (let a = -8; a <= 8; a++) px(48 + a, my + f(a));
    }
    if (mood === 'tired') { const bx = 59, by = 71; for (let x = bx; x <= bx + 8; x++) { px(x, by, gl2); px(x, by + 4, gl2); } for (let y = by; y <= by + 4; y++) { px(bx, y, gl2); px(bx + 8, y, gl2); } px(bx + 9, by + 2, gl2); for (let y = by + 1; y <= by + 3; y++) px(bx + 1, y, 0xff6a5a); }
    if (mood === 'worried') for (const b of [0, 1, 2, 4]) px(67, 25 + b, 0xffd060);
    if (mood === 'smug') for (const [a, b] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) px(64 + a, 27 + b, 0xffffff);
    for (const i of lit) for (const j of [i - 1, i + 1, i - N, i + N]) if (!lit.has(j) && PART[j] === scr && OVER[j] < 0) OVER[j] = mix(gl2, sR[TONE[j]], 0.45);
    text('TM', 67, 82, gold[LINE], fr);
    return;
  }
  if (k === 'fabulant') {
    const robe = part(ramp(0x2a1640), {soft: true, ink: 0x0a0414});
    poly(robe, [48, 4, 70, 14, 80, 44, 92, 97, 4, 97, 16, 44, 26, 14], ball(40, 30, 50, 60));
    const hole = part(ramp(0x0c0616), {line: false, rim: false});
    ell(hole, 48, 47, 17, 23, BASE);
    const gold = ramp(0xe8c27a, 4), mk = part(gold, {soft: true, cast: 2}), M = MOOD[mood];
    poly(mk, [34, 34, 48, 28, 62, 34, 63, 50, 56, 62, 48, 66, 40, 62, 33, 50], ball(42, 38, 18, 22));
    const lilac = 0xd8b8ff, inkM = 0x140a20, happy = ['happy', 'laugh', 'smug'].includes(mood), sad = ['sad', 'worried', 'tired'].includes(mood);
    for (const sx of [-1, 1]) {
      const ex = 48 + sx * 7, ey = 42, closed = blink >= 0.75 || M.eye === 'arc', tilt = M.eye === 'angry' ? -1 : M.eye === 'sad' || sad ? 1 : 0;
      // the painted brow of the mask
      for (let a = -4; a <= 4; a++) dot(ex + a, ey - 5 - Math.round((a * -sx / 4) * tilt * 1.5) - (mood === 'surprised' ? 2 : 0) + (Math.abs(a) > 3 ? 1 : 0), gold[SH2], mk);
      // an almond eye hole, a glowing pupil
      for (let a = -4; a <= 4; a++) for (let b = -3; b <= 3; b++) {
        const w = 2.1 * (1 - (a / 4.4) ** 2), bb = b + (M.eye === 'angry' ? Math.round(a * -sx * 0.35) : M.eye === 'sad' ? -Math.round(a * -sx * 0.35) : 0);
        if (closed ? b !== 0 && b !== 1 : Math.abs(b - 0.3) > w + (M.eye === 'wide' ? 0.8 : 0) || (halfMask(M, blink) && b < 0)) continue;
        dot(ex + a, ey + bb, inkM, mk);
      }
      if (!closed) { const lx = M.look[0] || 0; dot(ex + lx, ey, lilac, mk); dot(ex + lx + 1, ey, mix(lilac, inkM, 0.4), mk); dot(ex + lx, ey - 1, 0xffffff, mk); }
    }
    const my = 56, open = mouth > 0.15 ? 2 : mood === 'laugh' || mood === 'surprised' ? 2 : 0, curve = happy ? 1 : sad ? -1 : 0;
    if (mood === 'surprised') { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 3; b++) if (Math.abs(a) / 2.4 + Math.abs(b - 0.5) / 3 <= 1) dot(48 + a, my + b, inkM, mk); }
    else for (let a = -6; a <= 6; a++) {
      // comedy curves up at the corners, tragedy down
      const yy = my - Math.round((a * a / 36) * 2.4 * curve) + (curve > 0 ? 1 : curve < 0 ? -1 : 0);
      dot(48 + a, yy, inkM, mk);
      for (let o = 1; o <= open; o++) if (Math.abs(a) < 5) dot(48 + a, yy + o, o === open && Math.abs(a) < 2 ? 0x6a2a4a : inkM, mk);
    }
    aura(0xb48cff, 5, 0.4);
    const core = part(ramp(0xfff1b8, 3), {rim: false, soft: true, ink: 0xd8a040});
    ell(core, 48, 85, 5.2, 5.2, glowBody(core, 48, 85, 5.2, 5.2));
    eachEll(48, 85, 9, 9, (x, y) => { const i = y * N + x, d = Math.hypot(x + 0.5 - 48, y + 0.5 - 85); if (PART[i] === robe && d > 5.6 && (d < 7 || (x + y) % 2 === 0)) OVER[i] = mix(ramp(0x2a1640)[BASE], 0xffd36b, d < 7 ? 0.45 : 0.22); });
    // the scrolls it reads its stories from, floating
    for (const [x, y] of [[14, 30], [82, 60]]) {
      const sc = part(ramp(0xf4ecd8), {soft: true}), rl = part(ramp(0xd8c49a), {soft: true});
      rect(sc, x - 3, y - 7, x + 3, y + 7, (xx) => (xx < x - 1 ? LIT : BASE));
      for (let r = -4; r <= 4; r += 2) for (let a = x - 2; a <= x + 1 + (r % 4 ? 0 : 1); a++) dot(a, y + r, 0x9a8a70, sc);
      ell(rl, x, y - 7.5, 4.6, 1.8, LIT); ell(rl, x, y + 7.5, 4.6, 1.8, BASE);
    }
    return;
  }
  // unknown: a mysterious silhouette
  const tint = S.tint ?? 0x8a7a6a, p = part(ramp(mix(tint, 0x1a1418, 0.6)), {soft: true});
  ell(p, 48, 42, 18, 21, ball(42, 36, 18, 21)); poly(p, [16, 97, 22, 74, 36, 66, 60, 66, 74, 74, 80, 97], ball(40, 70, 40, 30));
  text('?', 47, 38, mix(tint, 0xffffff, 0.6), p);
}


// The hero's archetype as a small badge on the frame: a stamp, a spark, a binder or a heart.
const ARCH = {
  handhaver: [0xc0442c, ['..XXX..', '..XXX..', '...X...', '.XXXXX.', 'XXXXXXX', 'XXXXXXX']],
  datatovenaar: [0x3a64d0, ['...X...', '..XXX..', 'XXXXXXX', '..XXX..', '...X...', 'X.....X']],
  archivaris: [0x3a8a4a, ['XXX....', 'XXXXXXX', 'X.....X', 'X.XXX.X', 'X.....X', 'XXXXXXX']],
  verbinder: [0xd89a2a, ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']],
};
function badge(out, arch) {
  const a = ARCH[arch];
  if (!a) return;
  const [col, icon] = a, ring = [12, 8, 6], fill = [cr(col), cg(col), cb(col)], lc = mix(col, 0xffffff, 0.35), hi = [cr(lc), cg(lc), cb(lc)], ink = [255, 246, 222];
  const set = (x, y, c) => { const j = (y * N + x) * 4; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = 255; };
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8); if (d <= 8.2) set(x + 1, y + 1, d > 7.1 ? ring : d > 6.2 ? [212, 169, 92] : x + y < 13 ? hi : fill); }
  icon.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') set(6 + c, 6 + r, ink); }));
}
// ---------------------------------------------------------------- render, draw, cache
function panelTint(S, mood) {
  const base = S.tint ?? (S.look ? S.look.topColor : colorOf(S.spec?.color, null)) ?? 0x7a6a5a;
  let [h, s] = toHsl(base);
  if (s < 0.08) { h = 30; s = 0.1; }
  const c = fromHsl(h, Math.min(0.55, s), 0.34);
  return MOOD_TINT[mood] ? mix(c, MOOD_TINT[mood], 0.2) : c;
}
// The pure renderer: no DOM, so it also runs in node (tests). Returns {width, height, data: RGBA}.
export function renderPortrait(subject, o = {}) {
  const S = resolveSubject(subject), mood = MOOD[o.mood] ? o.mood : 'neutral';
  const mouth = clamp01(+o.mouth || 0), blink = clamp01(+o.blink || 0), framed = o.frame !== false;
  begin();
  FLIP = !!o.flip;
  const tint = panelTint(S, mood);
  panel(tint, S.kind === 'orakel' ? 0.1 : 0);
  try {
    if (S.kind === 'human' || FOLK.has(S.kind)) human(S, mood, mouth, blink);
    else creature(S, mood, mouth, blink);
  } catch (e) { console.warn('portrait', S.key, e); }
  const rim = mix(tint, 0xfff4e0, 0.55);
  passes();
  const out = new Uint8ClampedArray(NN * 4);
  compose(out, rim, !framed);
  if (framed) frame(out);
  if (framed && S.arch && o.badge !== false) badge(out, S.arch);
  FLIP = false;
  return {width: N, height: N, data: out};
}

const FRAMES = new Map(), URLS = new Map(), MAX_FRAMES = 240, MAX_URLS = 320;
export const portraitStats = {renders: 0, urls: 0, ms: 0};
function lru(map, key, make, max) {
  let v = map.get(key);
  if (v !== undefined) { map.delete(key); map.set(key, v); return v; }
  v = make();
  map.set(key, v);
  if (map.size > max) map.delete(map.keys().next().value);
  return v;
}
const q3 = v => (v >= 0.66 ? 1 : v >= 0.15 ? 0.5 : 0);
function newCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
// a cached 96 x 96 canvas for one frame (mouth and blink snap to three steps)
function frameCanvas(subject, mood, mouth, blink, o = {}) {
  const S = resolveSubject(subject), m = MOOD[mood] ? mood : 'neutral';
  const key = `${S.key}|${m}|${q3(mouth)}|${q3(blink)}|${o.frame !== false ? 1 : 0}|${o.flip ? 1 : 0}|${o.badge !== false ? 1 : 0}`;
  return lru(FRAMES, key, () => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const img = renderPortrait(S, {mood: m, mouth: q3(mouth), blink: q3(blink), frame: o.frame, flip: o.flip, badge: o.badge});
    const c = newCanvas(N, N);
    c.getContext('2d').putImageData(new ImageData(img.data, N, N), 0, 0);
    portraitStats.renders++;
    if (t0) portraitStats.ms += performance.now() - t0;
    return c;
  }, MAX_FRAMES);
}
function blit(canvas, src, size) {
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, size, size);
  g.drawImage(src, 0, 0, size, size);
}
const sizeOf = (canvas, o) => o.size || (canvas.width === canvas.height && canvas.width >= N ? canvas.width : N);
// Draw a portrait onto a canvas. size: the canvas resolution (use whole multiples of 96 for crisp pixels).
export function drawPortrait(canvas, subject, o = {}) {
  blit(canvas, frameCanvas(subject, o.mood, o.mouth, o.blink, o), sizeOf(canvas, o));
  canvas.classList?.add('portrait');
  return canvas;
}
// A cached data URL (PNG) for <img>: 192 px by default, crisp at 96 and 192 and fine at 288 with pixelated scaling.
export function portraitURL(subject, mood = 'neutral', o = {}) {
  const S = resolveSubject(subject), scale = o.scale || 2;
  return lru(URLS, `${S.key}|${mood}|${scale}|${o.frame !== false ? 1 : 0}|${o.flip ? 1 : 0}|${o.badge !== false ? 1 : 0}`, () => {
    const src = frameCanvas(S, mood, 0, 0, o), c = document.createElement('canvas');
    blit(c, src, N * scale);
    portraitStats.urls++;
    return c.toDataURL('image/png');
  }, MAX_URLS);
}
// An <img> for menus, the journal and the summary.
export function portraitImg(subject, mood = 'neutral', {size = 96, alt = ''} = {}) {
  const img = document.createElement('img');
  img.className = 'portrait'; img.width = size; img.height = size; img.alt = alt; img.src = portraitURL(subject, mood, {scale: size > 96 ? 3 : 2});
  return img;
}

// ---------------------------------------------------------------- talking
// One animator per canvas: the mouth flaps while text types and the eyes blink now and then.
// Frames are pre-rendered per mood and cached, so a frame change is one drawImage.
const ANIMS = new Map();
const FLAP = [0.5, 1, 0.5, 0, 1, 0.5, 1, 1, 0.5, 0, 0.5, 1, 0, 1, 0.5, 0];
class Animator {
  constructor(canvas) { this.canvas = canvas; this.subject = null; this.mood = 'neutral'; this.talking = false; this.raf = 0; this.t = 0; this.last = 0; this.nextBlink = 2 + Math.random() * 2; this.blinkT = 0; this.flapI = 0; this.flapT = 0; this.key = ''; this.size = 0; this.opts = {}; }
  set(subject, mood, o = {}) {
    this.subject = resolveSubject(subject); this.mood = MOOD[mood] ? mood : 'neutral'; this.opts = o; this.size = o.size || sizeOf(this.canvas, {});
    // warm the cache for this mood so the first flaps do not stutter
    for (const m of [0, 0.5, 1]) frameCanvas(this.subject, this.mood, m, 0, o);
    this.key = ''; this.draw(0, 0); this.start();
  }
  start() { if (!this.raf && typeof requestAnimationFrame === 'function') { this.last = 0; this.raf = requestAnimationFrame(t => this.tick(t)); } }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.talking = false; }
  draw(mouth, blink) {
    const key = `${mouth}|${blink}`;
    if (key === this.key || !this.subject) return;
    this.key = key;
    blit(this.canvas, frameCanvas(this.subject, this.mood, mouth, blink, this.opts), this.size);
  }
  tick(now) {
    this.raf = 0;
    if (!this.canvas.isConnected && this.canvas.ownerDocument) { this.stop(); return; }
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now; this.t += dt;
    let blink = 0;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0.16; this.nextBlink = 2.2 + Math.random() * 3.2; }
    if (this.blinkT > 0) { this.blinkT -= dt; blink = this.blinkT > 0.11 || this.blinkT < 0.04 ? 0.5 : 1; }
    let mouth = 0;
    if (this.talking) {
      const reduced = SETTINGS.motion === 'reduced';
      this.flapT -= dt;
      if (this.flapT <= 0) { this.flapI = (this.flapI + 1) % FLAP.length; this.flapT = reduced ? 0.14 : 0.085 + Math.random() * 0.03; }
      mouth = reduced ? Math.min(0.5, FLAP[this.flapI]) : FLAP[this.flapI];
    }
    this.draw(mouth, blink);
    this.raf = requestAnimationFrame(t => this.tick(t));
  }
}
function animator(canvas) { let a = ANIMS.get(canvas); if (!a) { a = new Animator(canvas); ANIMS.set(canvas, a); } return a; }
// show a face that blinks (not talking)
export function showPortrait(canvas, subject, mood = 'neutral', o = {}) { const a = animator(canvas); a.talking = false; a.set(subject, mood, o); return a; }
// show a face and flap its mouth until stopTalking
export function startTalking(canvas, subject, mood = 'neutral', o = {}) {
  const a = animator(canvas);
  if (!a.subject || a.subject.key !== resolveSubject(subject).key || a.mood !== mood || a.size !== (o.size || sizeOf(canvas, {}))) a.set(subject, mood, o);
  a.talking = true; a.start();
  return a;
}
// mouth closed, eyes keep blinking; without a canvas: every talking face stops
export function stopTalking(canvas) { for (const [c, a] of ANIMS) if (!canvas || c === canvas) a.talking = false; }
export function hidePortrait(canvas) { for (const [c, a] of [...ANIMS]) if (!canvas || c === canvas) { a.stop(); ANIMS.delete(c); } }
export function clearPortraitCache() { FRAMES.clear(); URLS.clear(); canonCache.clear(); }
// Render resting faces in idle time (for example everyone on a floor that just loaded),
// so the first line of a conversation never waits for a portrait.
export function preloadPortraits(subjects, moods = ['neutral']) {
  const queue = [];
  for (const s of subjects || []) if (hasPortrait(s)) for (const m of moods) queue.push([s, m]);
  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : f => setTimeout(() => f({timeRemaining: () => 8}), 40);
  const step = deadline => {
    while (queue.length && deadline.timeRemaining() > 3) { const [s, m] = queue.shift(); try { frameCanvas(s, m, 0, 0); } catch (e) { /* no canvas here: skip */ } }
    if (queue.length) idle(step);
  };
  if (queue.length) idle(step);
  return queue.length;
}

addStyles('portrait', '.portrait{image-rendering:crisp-edges;image-rendering:pixelated}');
UI.portraitURL = portraitURL;
