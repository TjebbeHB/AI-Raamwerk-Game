// Quests: a main line and side quests. Each stage has a short title, the tracker text,
// a line for the journal once it is done, and where it points: at = {f: floor, t: [x, z]} or {f, e: entity id}.
import {G, saveGame} from './state.js';
import {UI, SFX} from './bus.js';
import {W, ent} from './world.js';
import {TILE} from '../core/util.js';

export const QUESTS = {};
export const DEPTH_NAMES = {};          // floor id -> 'Diepte 1' (for "op een andere diepte")

export const stage = id => G.quests[id] ?? (QUESTS[id]?.side ? -1 : 0);
export function startQuest(id, quiet = false) {
  if (stage(id) >= 0 && G.quests[id] !== undefined) return;
  G.quests[id] = 0;
  const q = QUESTS[id];
  if (!quiet && q) { UI.toast(q.side ? 'Nieuwe zijopdracht' : 'Nieuwe opdracht', q.title, 'quest'); SFX.play('quest'); }
}
export function setStage(id, n, quiet = false) {
  const q = QUESTS[id];
  if (!q) return;
  const was = G.quests[id] ?? -1;
  if (n <= was) return;
  G.quests[id] = Math.min(n, q.stages.length - 1);
  const s = q.stages[G.quests[id]];
  if (!quiet) {
    if (s.done) { UI.toast(q.side ? 'Zijopdracht afgerond' : 'Afgerond', q.title, 'good'); SFX.play('questDone'); }
    else { UI.toast(s.short || q.title, txt(s.text), 'quest'); SFX.play('quest'); }
  }
  saveGame();
}
export const advance = (id, quiet) => setStage(id, stage(id) + 1, quiet);
export const txt = v => (typeof v === 'function' ? v() : v);

export function questTarget(at) {
  if (!at) return null;
  const a = typeof at === 'function' ? at() : at;
  if (!a) return null;
  if (a.f && a.f !== W.id) return {floor: a.f, where: `op ${DEPTH_NAMES[a.f] || 'een andere verdieping'}`};
  if (a.e) { const e = ent(a.e); return e && e.visible !== false ? {x: e.x, z: e.z} : null; }
  if (a.t) return {x: a.t[0] * TILE + 1, z: a.t[1] * TILE + 1};
  return null;
}

// what the tracker shows: the main quest, unless a side quest was picked
export function tracked() {
  const id = G.flags.track && QUESTS[G.flags.track] && stage(G.flags.track) >= 0 && !QUESTS[G.flags.track].stages[stage(G.flags.track)].done ? G.flags.track : 'main';
  const q = QUESTS[id];
  if (!q) return null;
  const s = q.stages[stage(id)] || q.stages[0];
  return {id, title: s.short || q.title, text: txt(s.text), target: questTarget(s.at)};
}

export function journal() {
  const out = [];
  for (const [id, q] of Object.entries(QUESTS)) {
    const n = stage(id);
    if (n < 0) continue;
    const s = q.stages[n];
    out.push({id, title: q.title, side: !!q.side, done: !!s.done, text: txt(s.text), log: q.stages.slice(0, n).map(x => x.log).filter(Boolean)});
  }
  return out.sort((a, b) => (a.done - b.done) || (a.side - b.side));
}
