// All sound is made here, in code: effects from oscillators and noise, a stone-room
// reverb, and a slow generative score per floor with a drum layer that grows in fights.
import {SFX} from '../game/bus.js';
import {SETTINGS} from '../game/state.js';

let ctx = null, master, sfxBus, musicBus, verb, verbSend, noiseBuf, comp;
const A = {theme: null, themeId: null, intensity: 0, nextNote: 0, nextBeat: 0, beat: 0, pads: [], drumGain: null, melGain: null, muted: false};

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); musicBus = ctx.createGain();
  sfxBus.connect(master); musicBus.connect(master);
  // generated impulse response: a damp stone vault
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir;
  verbSend = ctx.createGain(); verbSend.gain.value = 0.28;
  verbSend.connect(verb); verb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  A.melGain = ctx.createGain(); A.melGain.gain.value = 0.5; A.melGain.connect(musicBus); A.melGain.connect(verbSend);
  A.drumGain = ctx.createGain(); A.drumGain.gain.value = 0; A.drumGain.connect(musicBus);
  volume();
  return true;
}
function volume() {
  if (!ctx) return;
  sfxBus.gain.value = A.muted ? 0 : (SETTINGS.sfx ?? 0.8) * 0.9;
  musicBus.gain.value = A.muted ? 0 : (SETTINGS.music ?? 0.5) * 0.55;
}

// ---------------------------------------------------------------- building blocks
const now = () => ctx.currentTime;
function env(g, t, a, d, peak = 1, sus = 0) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
}
function tone({type = 'sine', f = 440, f2 = null, t = 0, a = 0.005, d = 0.2, v = 0.3, rev = 0.2, bus = sfxBus, detune = 0, filter = null, q = 1} = {}) {
  const t0 = now() + t, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + a + d);
  let node = o;
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = filter.type || 'lowpass'; fl.frequency.value = filter.f; fl.Q.value = q; o.connect(fl); node = fl; }
  node.connect(g); g.connect(bus); if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(verbSend); }
  env(g, t0, a, d, v);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noise({t = 0, a = 0.005, d = 0.15, v = 0.3, f = 1200, f2 = null, type = 'bandpass', q = 1, rev = 0.2, bus = sfxBus, rate = 1} = {}) {
  const t0 = now() + t, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = rate; s.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + a + d);
  s.connect(fl); fl.connect(g); g.connect(bus);
  if (rev) { const sg = ctx.createGain(); sg.gain.value = rev; g.connect(sg); sg.connect(verbSend); }
  env(g, t0, a, d, v);
  s.start(t0, Math.random()); s.stop(t0 + a + d + 0.05);
}
const chord = (fs, o = {}) => fs.forEach((f, i) => tone({...o, f, t: (o.t || 0) + i * (o.gap ?? 0.07)}));
const N = n => 440 * Math.pow(2, (n - 69) / 12);

const SOUNDS = {
  step: () => noise({f: 300 + Math.random() * 160, type: 'lowpass', d: 0.07, v: 0.13, rev: 0.05}),
  splash: () => { noise({f: 1800, d: 0.18, v: 0.12, q: 0.7}); noise({f: 600, d: 0.1, v: 0.08, type: 'lowpass'}); },
  dash: () => noise({f: 400, f2: 2400, d: 0.22, v: 0.22, q: 1.4}),
  lamp: () => { tone({type: 'triangle', f: 980, f2: 260, d: 0.22, v: 0.18, rev: 0.25}); noise({f: 3000, d: 0.08, v: 0.06}); },
  scale: () => { tone({f: 130, f2: 70, d: 0.5, v: 0.4, rev: 0.4}); tone({f: N(76), d: 0.9, v: 0.08, rev: 0.6}); noise({f: 500, f2: 120, d: 0.4, v: 0.18, type: 'lowpass'}); },
  seal: () => { tone({f: 90, f2: 50, d: 0.18, v: 0.45}); noise({f: 900, d: 0.06, v: 0.2}); },
  sealHit: () => { tone({f: 110, f2: 45, d: 0.25, v: 0.55, rev: 0.3}); noise({f: 1400, d: 0.1, v: 0.3}); tone({f: N(84), d: 0.3, v: 0.05}); },
  hit: () => noise({f: 700, d: 0.08, v: 0.18}),
  hitWeak: () => { noise({f: 1400, d: 0.1, v: 0.22}); chord([N(84), N(91)], {d: 0.25, v: 0.07, gap: 0.03}); },
  die: () => { chord([N(84), N(79), N(76), N(72)], {type: 'triangle', d: 0.25, v: 0.08, gap: 0.05, rev: 0.5}); noise({f: 2000, f2: 400, d: 0.4, v: 0.1}); },
  hurt: () => { tone({type: 'sawtooth', f: 160, f2: 70, d: 0.25, v: 0.16, filter: {f: 600}}); noise({f: 400, d: 0.15, v: 0.2, type: 'lowpass'}); },
  reveal: () => { [0, 4, 7, 12, 16].forEach((n, i) => tone({f: N(72 + n), t: i * 0.05, d: 0.9, v: 0.06, rev: 0.7})); noise({f: 5000, d: 0.5, v: 0.04, type: 'highpass'}); },
  door: () => { tone({type: 'sawtooth', f: 120, f2: 180, d: 0.5, v: 0.05, filter: {f: 700}, rev: 0.3}); noise({f: 200, d: 0.2, v: 0.12, type: 'lowpass'}); },
  gateUp: () => { for (let i = 0; i < 8; i++) noise({t: i * 0.09, f: 2200, d: 0.05, v: 0.06, q: 4}); tone({f: 60, d: 0.8, v: 0.12}); },
  gateDown: () => { noise({f: 300, d: 0.3, v: 0.3, type: 'lowpass'}); tone({f: 70, f2: 40, d: 0.4, v: 0.4}); },
  unlock: () => { noise({f: 3000, d: 0.04, v: 0.15, q: 6}); chord([N(72), N(79)], {d: 0.3, v: 0.08}); },
  locked: () => { for (let i = 0; i < 3; i++) noise({t: i * 0.06, f: 1800, d: 0.04, v: 0.1, q: 5}); },
  key: () => chord([N(76), N(83), N(88)], {type: 'triangle', d: 0.5, v: 0.08, rev: 0.5}),
  pick: () => chord([N(79), N(84)], {d: 0.2, v: 0.08}),
  place: () => { tone({f: 200, f2: 120, d: 0.1, v: 0.2}); chord([N(72)], {d: 0.3, v: 0.06}); },
  bron: () => chord([N(69), N(76), N(81), N(88)], {type: 'triangle', d: 0.7, v: 0.07, gap: 0.08, rev: 0.6}),
  crystal: () => chord([N(72), N(79), N(84), N(91), N(96)], {d: 1.2, v: 0.07, gap: 0.06, rev: 0.8}),
  tool: () => { chord([N(60), N(67), N(72), N(76), N(79), N(84)], {type: 'triangle', d: 1.3, v: 0.08, gap: 0.09, rev: 0.7}); tone({f: N(48), d: 1.5, v: 0.12}); },
  quest: () => chord([N(74), N(79)], {type: 'triangle', d: 0.4, v: 0.07, gap: 0.1, rev: 0.4}),
  questDone: () => chord([N(72), N(76), N(79), N(84)], {type: 'triangle', d: 0.8, v: 0.08, gap: 0.09, rev: 0.6}),
  chest: () => { tone({type: 'sawtooth', f: 90, f2: 140, d: 0.4, v: 0.05, filter: {f: 500}}); chord([N(79), N(83), N(86)], {t: 0.3, d: 0.6, v: 0.07, rev: 0.5}); },
  lever: () => { tone({f: 120, f2: 80, d: 0.12, v: 0.3}); noise({f: 1500, d: 0.05, v: 0.12, q: 3}); },
  plateOn: () => { tone({f: 90, d: 0.15, v: 0.3}); chord([N(67)], {d: 0.3, v: 0.05}); },
  plateOff: () => tone({f: 70, d: 0.1, v: 0.2}),
  push: () => noise({f: 220, d: 0.32, v: 0.22, type: 'lowpass', rate: 0.6}),
  eat: () => { for (let i = 0; i < 3; i++) noise({t: i * 0.07, f: 2500, d: 0.04, v: 0.1, q: 2}); },
  pip: () => chord([N(88), N(93)], {d: 0.18, v: 0.06, gap: 0.05, rev: 0.4}),
  blip: (k = 0) => tone({type: 'square', f: [330, 392, 262, 440, 294, 349][k % 6], d: 0.04, v: 0.025, filter: {f: 1600}, rev: 0}),
  windup: () => tone({type: 'sawtooth', f: 200, f2: 420, d: 0.35, v: 0.04, filter: {f: 1200}}),
  swing: () => noise({f: 900, f2: 300, d: 0.15, v: 0.12}),
  swoop: () => noise({f: 600, f2: 2000, d: 0.2, v: 0.1, q: 2}),
  enemyShot: () => tone({type: 'square', f: 520, f2: 200, d: 0.2, v: 0.05, filter: {f: 1500}}),
  fall: () => tone({f: 900, f2: 120, d: 0.8, v: 0.1, rev: 0.6}),
  down: () => { tone({type: 'sawtooth', f: 110, f2: 40, d: 1.4, v: 0.12, filter: {f: 400}, rev: 0.5}); },
  open: () => noise({f: 2500, d: 0.03, v: 0.06, q: 2}),
  close: () => noise({f: 1800, d: 0.03, v: 0.05, q: 2}),
  wrong: () => { tone({type: 'square', f: 180, d: 0.16, v: 0.06, filter: {f: 800}}); tone({type: 'square', f: 140, t: 0.12, d: 0.2, v: 0.06, filter: {f: 800}}); },
  right: () => chord([N(76), N(83)], {d: 0.4, v: 0.08, rev: 0.4}),
  kindle: () => { noise({f: 300, f2: 1600, d: 0.6, v: 0.2}); for (let i = 0; i < 6; i++) noise({t: 0.2 + Math.random() * 0.6, f: 3000, d: 0.02, v: 0.08, q: 5}); },
  bossDie: () => { tone({f: 60, f2: 30, d: 2.2, v: 0.6, rev: 0.6}); noise({f: 200, d: 1.5, v: 0.4, type: 'lowpass'}); chord([N(60), N(64), N(67), N(72)], {t: 0.6, type: 'triangle', d: 2.4, v: 0.07, gap: 0.02, rev: 0.9}); },
  switch: () => noise({f: 3500, d: 0.02, v: 0.06, q: 4}),
  bell: (k = 0) => { const f = N([72, 74, 76, 79, 81, 84][k % 6]); tone({f, d: 1.8, v: 0.14, rev: 0.8}); tone({f: f * 2.76, d: 0.8, v: 0.04, rev: 0.8}); },
  coffee: () => { noise({f: 800, d: 0.8, v: 0.08, q: 0.5}); chord([N(67), N(71), N(74)], {t: 0.4, type: 'triangle', d: 0.6, v: 0.07, rev: 0.5}); },
  thunder: () => { noise({f: 120, d: 2.5, v: 0.5, type: 'lowpass'}); tone({f: 45, d: 2, v: 0.4}); },
  orakel: () => { chord([N(57), N(64), N(69), N(73)], {type: 'sawtooth', d: 1.6, v: 0.025, gap: 0, filter: {f: 900}, rev: 0.9}); },
};

// ---------------------------------------------------------------- music
// each floor: a root, a scale, pad colour and tempo
const THEMES = {
  f0: {root: 57, scale: [0, 2, 4, 7, 9], pad: 0.5, cut: 900, bpm: 92, mel: 'triangle', rate: 1.5},
  f1: {root: 50, scale: [0, 3, 5, 7, 10], pad: 0.8, cut: 650, bpm: 96, mel: 'triangle', rate: 2.2},
  f2: {root: 52, scale: [0, 2, 3, 7, 8], pad: 0.8, cut: 750, bpm: 100, mel: 'sine', rate: 2.0},
  f3: {root: 55, scale: [0, 2, 5, 7, 10], pad: 0.7, cut: 900, bpm: 104, mel: 'triangle', rate: 1.8},
  f4: {root: 48, scale: [0, 1, 5, 7, 8], pad: 1.0, cut: 520, bpm: 110, mel: 'sine', rate: 2.6},
  seal: {root: 53, scale: [0, 4, 7, 9, 11], pad: 0.7, cut: 1200, bpm: 80, mel: 'triangle', rate: 1.4},
  boss: {root: 45, scale: [0, 1, 3, 7, 8], pad: 1.0, cut: 700, bpm: 132, mel: 'sawtooth', rate: 0.9, drums: 0.7},
};
function startPad(th) {
  for (const p of A.pads) { p.g.gain.setTargetAtTime(0.0001, now(), 1.2); p.o.forEach(o => o.stop(now() + 5)); }
  A.pads = [];
  const notes = [th.root - 12, th.root - 5, th.root + th.scale[2]];
  for (const n of notes) {
    const g = ctx.createGain(), fl = ctx.createBiquadFilter(), os = [];
    fl.type = 'lowpass'; fl.frequency.value = th.cut; fl.Q.value = 0.7;
    for (const det of [-7, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(n); o.detune.value = det; o.connect(fl); o.start(); os.push(o); }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05 + Math.random() * 0.06; lg.gain.value = th.cut * 0.35; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(); os.push(lfo);
    fl.connect(g); g.connect(musicBus); const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(verbSend);
    g.gain.value = 0.0001; g.gain.setTargetAtTime(0.045 * th.pad, now(), 2.5);
    A.pads.push({g, o: os});
  }
}
let musicTimer = null;
function tick() {
  if (!ctx || !A.theme) return;
  const th = A.theme, t = now();
  // melody: a slow random walk on the scale
  while (A.nextNote < t + 0.3) {
    const deg = Math.floor(Math.random() * th.scale.length), oct = Math.random() < 0.3 ? 12 : 0;
    const when = Math.max(A.nextNote, t);
    if (Math.random() < 0.72) tone({type: th.mel, f: N(th.root + 12 + th.scale[deg] + oct), t: when - t, a: 0.02, d: 1.6, v: 0.05 + A.intensity * 0.02, rev: 0.7, bus: A.melGain, filter: {f: 1800}});
    A.nextNote = when + th.rate * (0.6 + Math.random() * 0.8) * (1 - A.intensity * 0.35);
  }
  // drums: louder as more monsters are after you
  const beat = 60 / (th.bpm || 100) / 2;
  A.drumGain.gain.setTargetAtTime(Math.max(th.drums ?? 0, A.intensity) * 0.9, t, 0.6);
  while (A.nextBeat < t + 0.2) {
    const when = Math.max(A.nextBeat, t), k = A.beat % 8;
    if (k === 0 || k === 3 || k === 6) tone({f: 70, f2: 38, t: when - t, d: 0.25, v: 0.5, bus: A.drumGain, rev: 0.1});
    if (k === 4) noise({t: when - t, f: 1800, d: 0.12, v: 0.3, bus: A.drumGain, rev: 0.2});
    if (k % 2 === 1) noise({t: when - t, f: 6000, d: 0.03, v: 0.08, type: 'highpass', bus: A.drumGain, rev: 0});
    if (k === 7 && Math.random() < 0.5) tone({type: 'square', f: N(th.root + th.scale[Math.floor(Math.random() * 3)]), t: when - t, d: 0.15, v: 0.05, bus: A.drumGain, filter: {f: 1200}});
    A.beat++; A.nextBeat = when + beat;
  }
}

Object.assign(SFX, {
  unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!musicTimer) musicTimer = setInterval(tick, 100);
    if (!A.theme && A.themeId) { const id = A.themeId; A.themeId = null; SFX.music(id); }
  },
  play(name, arg) { if (!ctx || ctx.state !== 'running') return; const f = SOUNDS[name]; if (f) try { f(arg); } catch (e) { /* ignore */ } },
  music(id) {
    if (!ctx) { A.themeId = id; return; }
    const key = THEMES[id] ? id : THEMES[id?.split(':')[0]] ? id.split(':')[0] : 'f1';
    if (key === A.themeId && A.theme) return;
    A.themeId = key; A.theme = THEMES[key];
    startPad(A.theme);
    A.nextNote = now() + 1.5; A.nextBeat = now() + 0.5;
  },
  intensity(v) { A.intensity = v; },
  volume,
  mute(m) { A.muted = m; volume(); },
});
document.addEventListener('pointerdown', () => SFX.unlock(), {once: false, passive: true});
document.addEventListener('keydown', () => SFX.unlock(), {passive: true});
