// You: name, how people address you, your archetype and your look.
// The character creator fills G.hero; everything else reads it through these helpers,
// so old saves (without a hero) keep working with the default.
import {G} from './state.js';

// The look schema is shared by the 3D model (engine/models.js), the portraits (ui/portrait.js)
// and the creator (ui/creator.js). See LOOK_OPTIONS in content/looks.js for every option.
export const DEFAULT_LOOK = {
  build: 'average', height: 1, skin: 0xe2b490,
  hair: 'short', hairColor: 0x4a3222, eyes: 0x3a2a1a, brows: 'normal', nose: 'normal', age: 'adult',
  facialHair: 'none', glasses: 'none', freckles: false, blush: false,
  top: 'blazer', topColor: 0x2f4f7a, top2: 0xe8e4dc, bottom: 'trousers', bottomColor: 0x2a2a34, shoes: 0x241a14,
  lanyard: true,
};
export const DEFAULT_HERO = {name: '', pronouns: 'die', address: 'neutraal', archetype: null, look: DEFAULT_LOOK};

export const hero = () => G.hero || DEFAULT_HERO;
export const archetype = () => hero().archetype || null;          // 'handhaver' | 'datatovenaar' | 'archivaris' | 'verbinder' | null
export const isArch = id => archetype() === id;
export const heroLook = () => ({...DEFAULT_LOOK, ...(hero().look || {})});
export const heroName = (fallback = 'adviseur') => (hero().name || '').trim() || fallback;

// How people address you. address: 'mevrouw' | 'meneer' | 'neutraal'
export const aanspreek = () => ({mevrouw: 'mevrouw', meneer: 'meneer'}[hero().address] || '');
// 'mevrouw de adviseur' / 'meneer de adviseur' / 'beste adviseur'
export const formal = (role = 'adviseur') => (aanspreek() ? `${aanspreek()} de ${role}` : `beste ${role}`);
// Pronouns when people talk about you: pronouns 'hij' | 'zij' | 'die'
export function pron() {
  const p = hero().pronouns;
  if (p === 'hij') return {subj: 'hij', obj: 'hem', poss: 'zijn'};
  if (p === 'zij') return {subj: 'zij', obj: 'haar', poss: 'haar'};
  return {subj: 'die', obj: 'hen', poss: 'hun'};
}

// Cosmetics you unlock in the Gewelf stay unlocked for your next game (this browser only).
const UNLOCK_KEY = 'orakel-dalwijk-unlocks-v1';
function readUnlocks() { try { return JSON.parse(localStorage.getItem(UNLOCK_KEY) || '[]'); } catch (e) { return []; } }
export function isUnlocked(id) { return readUnlocks().includes(id); }
export function listUnlocked() { return readUnlocks(); }
export function unlockCosmetic(id) {
  const list = readUnlocks();
  if (list.includes(id)) return false;
  list.push(id);
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(list)); } catch (e) { /* private window: only for this game */ }
  return true;
}
