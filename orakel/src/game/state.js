// The whole game state lives in G, so saving is one JSON.stringify. Settings are kept apart.
export const SAVE_KEY = 'orakel-dalwijk-save-v1';
const SETTINGS_KEY = 'orakel-dalwijk-settings-v1';
const CODE_PREFIX = 'ORAKEL-1:';

export function freshState() {
  return {
    v: 1, floor: 'f0', at: 'start', pos: null,
    hp: 100, maxHp: 100,
    tools: {lamp: false, scale: false, seal: false}, tool: 'lamp',
    flags: {}, quests: {main: 0}, items: {}, keys: {},
    bronnen: [], hallucs: [], crystals: [], cards: [],
    chambers: {},            // chamber id -> {attempts: [{selection, complete, missing, unsuitable, at}]}
    cleared: {},             // enemy groups that stay beaten
    opened: {},              // chests, revealed illusions, unlocked doors, solved puzzles
    coffee: [],              // coffee corners visited (fast travel)
    explored: {},            // floor id -> base64 bitset of seen tiles
    stats: {time: 0, kills: 0, deaths: 0, steps: 0, shortcut: 0, revealed: 0},
    verdict: null,
    started: Date.now(), saved: 0,
  };
}

export const G = freshState();
export function resetState() { const f = freshState(); for (const k of Object.keys(G)) delete G[k]; Object.assign(G, f); }

export const flag = k => !!G.flags[k];
export const setFlag = (k, v = true) => { G.flags[k] = v; };

let storageOk = true;
function store() { try { return window.localStorage; } catch (e) { storageOk = false; return null; } }

export function saveGame() {
  G.saved = Date.now();
  try { store()?.setItem(SAVE_KEY, JSON.stringify(G)); return true; } catch (e) { return false; }
}
export function hasSave() { try { return !!store()?.getItem(SAVE_KEY); } catch (e) { return false; } }
export function loadGame() {
  try {
    const raw = store()?.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(JSON.parse(raw));
  } catch (e) { console.warn('save unreadable', e); return false; }
}
export function applySave(data) {
  if (!data || data.v !== 1) return false;
  resetState();
  const f = freshState();
  for (const [k, v] of Object.entries(data)) if (k in f) G[k] = v;
  for (const k of ['flags', 'items', 'keys', 'chambers', 'cleared', 'opened', 'explored', 'stats', 'quests', 'tools']) G[k] = {...f[k], ...(G[k] || {})};
  return true;
}
export function clearSave() { try { store()?.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

// a save code: the JSON, base64-encoded, to copy into another browser
export function saveCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(G));
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}
export function readSaveCode(text) {
  text = String(text || '').trim();
  try {
    const json = text.startsWith(CODE_PREFIX) ? new TextDecoder().decode(Uint8Array.from(atob(text.slice(CODE_PREFIX.length)), c => c.charCodeAt(0))) : text;
    const data = JSON.parse(json);
    return data && data.v === 1 ? data : null;
  } catch (e) { return null; }
}

export const SETTINGS = {bright: 1, cam: 'third', sens: 1, invert: false, fov: 72, music: 0.5, sfx: 0.8, difficulty: 'normal', quality: 'high', textSpeed: 1, shake: true, autoAim: true, camDist: 4.2};
export function loadSettings() {
  try { Object.assign(SETTINGS, JSON.parse(store()?.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* defaults */ }
  return SETTINGS;
}
export function saveSettings() { try { store()?.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ } }
export const storageAvailable = () => { store(); return storageOk; };
