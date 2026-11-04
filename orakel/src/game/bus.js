// Loose coupling between engine, entities, content and UI.
// ON: story hooks registered by the content. UI/SFX: filled in by the UI and audio modules.
import {G} from './state.js';

export const ON = {
  use: {},        // id -> async (entity) => {}      interacting with an object, sign or lever
  talk: {},       // npc id -> () => async conversation (see dialogue.js)
  trigger: {},    // trigger id -> (entity) => {}
  cleared: {},    // enemy group -> () => {}
  pickup: {},     // item id -> (item) => {}
  zone: {},       // zone id -> (zone) => {}          first entry into a zone
  place: {},      // slot id -> (slot, item) => bool  carrying something onto a slot
  hit: {},        // object id -> (entity, tool) => {}
  floor: {},      // floor id -> () => {}             after a floor is loaded
  tick: [],       // (dt) => {}                       every frame while playing
};

export const UI = {
  toast() {}, banner() {}, pip() {}, read() {}, prompt() {}, boss() {}, hurt() {}, flash() {}, fade: async () => {}, refresh() {},
  number() {}, talk() {}, target() {}, decide: async () => 'blind', modal() {},
};
export const SFX = {play() {}, music() {}, intensity() {}};

// Conditions on flags: 'a&b', 'a|!b', 'q:main>=4', 'tool:seal', 'key:kelder', 'item:kaart'
export function cond(expr) {
  if (expr === undefined || expr === null || expr === '') return true;
  if (typeof expr === 'function') return !!expr();
  return String(expr).split('|').some(alt => alt.split('&').every(term => {
    term = term.trim();
    let neg = false;
    while (term.startsWith('!')) { neg = !neg; term = term.slice(1); }
    let v;
    const m = term.match(/^q:(\w+)(>=|<=|==|>|<)(\d+)$/);
    if (m) { const s = G.quests[m[1]] ?? 0, n = +m[3]; v = m[2] === '>=' ? s >= n : m[2] === '<=' ? s <= n : m[2] === '==' ? s === n : m[2] === '>' ? s > n : s < n; }
    else if (term.startsWith('tool:')) v = !!G.tools[term.slice(5)];
    else if (term.startsWith('key:')) v = !!G.keys[term.slice(4)];
    else if (term.startsWith('item:')) v = !!G.items[term.slice(5)];
    else if (term.startsWith('chamber:')) { const [id, st] = term.slice(8).split('='); v = chamberState(id) === (st || 'strong'); }
    else v = !!G.flags[term];
    return neg ? !v : v;
  }));
}

export function chamberState(id) {
  const last = G.chambers[id]?.attempts?.at(-1);
  return !last ? 'blind' : last.complete ? 'strong' : 'open';
}

// Registries filled by the content: who is who, and what each pickup is.
export const CAST = {};        // id -> {name, title, model: spec, color, portrait}
export const ITEMS = {};       // id -> {name, text, kind, icon}

// The player, shared by reference (the player module owns the behaviour).
export const P = {
  x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: -0.12, r: 0.36,
  tool: 'lamp', carry: null, dashT: 0, falling: false, dead: false, inv: 0,
  safe: {x: 0, z: 0}, busy: false, frozen: false, onGround: true, speed: 0,
};

// The online council (filled in by council.js): advisors vote on phones.
export const NET = {
  active: false, members: [], tallies: null, onTally: null, cheers: 0,
  openVote() {}, closeVote() {}, publish() {}, setPlace() {},
};
