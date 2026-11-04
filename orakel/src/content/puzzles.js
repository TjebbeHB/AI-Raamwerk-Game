// Puzzle rules for the chamber trials, driven by the trial data of the original game.
// Each trial lets you feel the problem before the guardian asks you to choose measures.
import {ON, UI, SFX, P} from '../game/bus.js';
import {G, saveGame} from '../game/state.js';
import {W, ent} from '../game/world.js';
import {scene, say, choose} from '../game/dialogue.js';
import {CHAMBER} from './framework.js';
import {FX} from '../engine/particles.js';

export const trialDone = id => !!G.flags[`trial:${id}`];
export function completeTrial(id, {quiet = false} = {}) {
  if (trialDone(id)) return;
  G.flags[`trial:${id}`] = true;
  const t = CHAMBER[id].trial;
  SFX.play('questDone');
  if (!quiet) { UI.toast(`Proef voltooid · ${t.title}`, t.done || 'Ga terug naar de hoeder van deze kamer.', 'good'); if (t.done) UI.pip(t.done); }
  ON.trialDone?.[id]?.();
  saveGame();
}
ON.trialDone = {};

// ---- sort: carry each piece to the slot that fits (governance, infrastructure via crates, sustainability)
export function setupSort(id, group) {
  const items = CHAMBER[id].trial.items;
  ON.place[group] = (slot, item) => {
    if (item.def.group !== group) { UI.pip('Dat hoort niet bij deze proef.'); return false; }
    const it = items[item.def.item];
    if (it.bin !== slot.def.bin) {
      UI.pip(it.wrong); SFX.play('wrong');
      FX.burst(slot.x, 1.4, slot.z, 12, {color: 0xff7c68, speed: 2, life: 0.5});
      return false;
    }
    item.def.done = true; G.flags[`placed:${group}:${item.def.item}`] = true;
    FX.burst(slot.x, 1.4, slot.z, 24, {color: [0x8fe0a0, 0xffffff], speed: 2.5, life: 0.7});
    SFX.play('right');
    const left = items.length - items.filter((_, i) => G.flags[`placed:${group}:${i}`]).length;
    if (left) UI.toast('Goed gelegd', `Nog ${left} te gaan.`, 'good'); else completeTrial(id);
    return true;
  };
}
// after a reload: put pieces that were already placed back on their slots
export function restoreSort(group) {
  for (const e of W.ents) {
    if (e.def?.group !== group || e.def.kind !== 'carry' || !G.flags[`placed:${group}:${e.def.item}`]) continue;
    const slot = W.ents.find(o => o.def?.kind === 'slot' && o.def.group === group && o.def.bin === e.def.bin);
    if (!slot) continue;
    slot.stack = (slot.stack || 0) + 1;
    e.placed = slot; e.x = slot.x; e.z = slot.z;
    e.group.position.set(slot.x + (slot.stack - 1) * 0.28 - 0.3, 0.2 + (slot.stack - 1) * 0.12, slot.z);
  }
}
// the carry pieces and slots for a sort trial, ready to put in a floor legend
export function sortPieces(id, group, shape, colors = []) {
  return CHAMBER[id].trial.items.map((it, i) => ({id: `${group}_p${i}`, kind: 'carry', group, item: i, bin: it.bin, chamber: id, shape, color: colors[it.bin] ?? 0xffd36b, label: it.label, short: it.label.replace(/^[^:]+:\s*/, '')}));
}
export function sortSlots(id, group, shape, colors = []) {
  return CHAMBER[id].trial.bins.map((b, i) => ({id: `${group}_s${i}`, kind: 'slot', group, bin: i, shape, label: b.label, color: colors[i] ?? 0xc8a050}));
}

// ---- witness: hear everyone (necessity, culture, ethics)
export function heard(id, who) {
  const k = `heard:${id}:${who}`;
  if (G.flags[k]) return false;
  G.flags[k] = true;
  const t = CHAMBER[id].trial, n = t.witnesses.length, got = t.witnesses.filter((_, i) => G.flags[`heard:${id}:${i}`]).length;
  if (got >= n) completeTrial(id); else UI.toast(t.task || t.title, `${got} van ${n} gehoord`, 'quest');
  return true;
}
export const heardCount = id => CHAMBER[id].trial.witnesses.filter((_, i) => G.flags[`heard:${id}:${i}`]).length;

// ---- gather: find every piece (capacity, sovereignty)
export const gathered = (id, prefix) => CHAMBER[id].trial.items.filter((_, i) => G.items[`${prefix}:${i}`]).length;

// ---- judge: decide per post (evaluation, quality, functionality)
export function setupJudge(id, postIds) {
  const t = CHAMBER[id].trial;
  postIds.forEach((pid, i) => {
    const post = () => ent(pid);
    if (G.flags[`judged:${id}:${i}`] && post()) post().def.solved = true;
    ON.use[pid] = () => scene(async () => {
      const it = t.items[i];
      await say('nar', `${it.title}. ${it.text}`);
      const a = await choose(t.answers.map(x => x));
      if (a === it.answer) {
        G.flags[`judged:${id}:${i}`] = true; const p = post(); if (p) p.def.solved = true;
        SFX.play('right');
        await say('pip', `Klopt. ${it.explain}`);
        const left = t.items.length - t.items.filter((_, k) => G.flags[`judged:${id}:${k}`]).length;
        if (!left) completeTrial(id);
      } else {
        SFX.play('wrong');
        await say('pip', `Hm, kijk nog eens. ${it.explain}`);
      }
    });
  });
}

// ---- sequence: in the order of a good conversation (interaction, compliance)
export function setupSequence(id, ids, {hint} = {}) {
  const t = CHAMBER[id].trial, key = `seq:${id}`;
  ids.forEach((oid, k) => {
    ON.use[oid] = o => {
      if (trialDone(id)) return;
      const step = o.def.step, at = G.flags[key] || 0;
      if (step === at) {
        G.flags[key] = at + 1; o.def.lit = true; SFX.play('right');
        UI.number(o.x, 3.2, o.z, `${at + 1}`, '#ffe2a6', true);
        if (at + 1 >= t.steps.length) { for (const i of ids) { const e = ent(i); if (e) e.def.done = true; } completeTrial(id); }
      } else {
        G.flags[key] = 0;
        for (const i of ids) { const e = ent(i); if (e) e.def.lit = false; }
        SFX.play('wrong');
        UI.pip(hint || `De volgorde klopt niet, alles staat weer op nul. Begin bij: ‘${t.steps[0]}’.`);
      }
    };
    void k;
  });
}
export const sequenceObjects = (id, kind, order) => CHAMBER[id].trial.steps.map((s, i) => ({id: `${id}_q${i}`, kind, step: i, label: s})).sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));

// ---- levers: set them all right (performance)
export function setupLevers(id, ids, {onChange} = {}) {
  const t = CHAMBER[id].trial;
  ids.forEach((oid, i) => {
    ON.use[oid] = o => {
      const lv = t.levers[i], good = o.state === lv.correct;
      UI.pip(good ? lv.good : lv.bad);
      const ok = ids.every((x, k) => ent(x)?.state === t.levers[k].correct);
      onChange?.(ok);
      if (ok) { for (const x of ids) { const e = ent(x); if (e) e.def.locked = true; } completeTrial(id); }
    };
  });
}
export const leverObjects = id => CHAMBER[id].trial.levers.map((lv, i) => ({id: `${id}_l${i}`, kind: 'lever2', label: lv.label, states: lv.states, correct: lv.correct, state: lv.start}));
void P; void W;
