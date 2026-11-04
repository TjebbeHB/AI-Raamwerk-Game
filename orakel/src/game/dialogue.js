// Conversations are async functions:  await say('pip', 'Hallo!');  const i = await choose(['Ja', 'Nee']);
// Waits run on game time, so the automated playthrough can fast-forward them.
import {UI, CAST, ON, P} from './bus.js';
import {Input, lock, unlock} from '../core/input.js';

export const DLG = {active: false, res: null, choices: null, sel: 0, auto: false, autoQ: [], log: [], who: null, typing: false, npc: null};
const WAITS = [];
export const wait = sec => new Promise(r => WAITS.push({t: sec, r}));
export function updateDialogue(dt) {
  for (let i = WAITS.length - 1; i >= 0; i--) { const w = WAITS[i]; w.t -= dt; if (w.t <= 0) { WAITS.splice(i, 1); w.r(); } }
  if (DLG.auto) {
    if (DLG.typing) UI.dlgFinish();
    else if (DLG.choices) pick(DLG.autoQ.length ? DLG.autoQ.shift() : 0);
    else if (DLG.res) advance();
  }
}

export function speaker(who) {
  if (who === 'you') return {name: 'Jij', title: '', cls: 'you'};
  if (who === 'nar' || !who) return {name: '', title: '', cls: 'nar'};
  const id = typeof who === 'string' ? who : who.id;
  const c = CAST[id];
  return {name: c?.name ?? id, title: c?.title ?? '', cls: id === 'pip' ? 'pip' : '', color: c?.color, icon: c?.icon, id};
}

export function say(who, text, o = {}) {
  return new Promise(res => {
    DLG.res = res;
    DLG.log.push(`${speaker(who).name || '~'}: ${text}`);
    if (DLG.log.length > 300) DLG.log.shift();
    DLG.who = who;
    if (DLG.npc && (who === DLG.npc.id || who === DLG.npc)) DLG.npc.st.talk = true;
    UI.dlgLine(speaker(who), text, o);
  });
}
export function choose(opts) {
  return new Promise(res => {
    const list = [], map = [];
    opts.forEach((o, i) => { const c = typeof o === 'string' ? {t: o} : o; if (c.if === undefined || c.if) { list.push(c); map.push(i); } });
    DLG.choices = {list, res: i => res(map[i])}; DLG.sel = 0;
    if (!DLG.auto) unlockForUi();
    UI.dlgChoices(list);
  });
}
export function advance() {
  if (!DLG.active) return;
  if (DLG.choices) { pick(DLG.sel); return; }
  if (DLG.typing) { UI.dlgFinish(); return; }
  const r = DLG.res; DLG.res = null;
  if (DLG.npc) DLG.npc.st.talk = false;
  r?.();
}
export function pick(i) {
  const c = DLG.choices;
  if (!c || i < 0 || i >= c.list.length) return;
  DLG.choices = null; UI.dlgChoices(null);
  DLG.log.push(`> ${c.list[i].t}`);
  c.res(i);
}
export function moveSel(d) { if (!DLG.choices) return; DLG.sel = (DLG.sel + d + DLG.choices.list.length) % DLG.choices.list.length; UI.dlgSelect(DLG.sel); }

let relockAfter = false;
export function unlockForUi() { if (Input.locked) { relockAfter = true; Input.expectUnlock = true; unlock(); } }
export function relock() { if (relockAfter && !Input.touch) { relockAfter = false; lock(); } }

// Run a conversation. Only one at a time; the world pauses while it runs.
export async function converse(npc, fn) {
  if (DLG.active || !fn) return false;
  DLG.active = true; DLG.npc = npc && npc.st ? npc : null;
  P.vx = P.vz = 0;
  if (DLG.npc) DLG.npc.talking = true;
  UI.dlgOpen();
  try { await fn(npc); }
  catch (e) { console.error('conversation', e); }
  finally {
    DLG.active = false; DLG.res = null; DLG.choices = null;
    if (DLG.npc) { DLG.npc.talking = false; DLG.npc.st.talk = false; DLG.npc = null; }
    UI.dlgClose();
    relock();
  }
  return true;
}
export function talkTo(npc) {
  const make = ON.talk[npc.id];
  const fn = make?.(npc);
  if (fn) converse(npc, fn);
}
// a one-off scene without an NPC (cutscenes, reading the letter, Pip)
export const scene = fn => converse(null, fn);
