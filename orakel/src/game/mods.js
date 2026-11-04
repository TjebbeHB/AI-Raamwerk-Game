// Modifiers: what your archetype and the things you find change about you.
// Combat and movement read them through mod(key); content adds sources.
//
//   import {MOD_SOURCES, invalidateMods} from './mods.js';
//   MOD_SOURCES.push(g => g.hero?.archetype === 'handhaver' ? {sealDmg: 1.25, damageTaken: 0.85} : null);
//   invalidateMods();   // after anything that changes the result (a new trinket, a new hero)
//
// Factor keys multiply (1 = unchanged). Additive keys add up (0 = unchanged).
import {G} from './state.js';

export const FACTORS = {
  lampDmg: 1, scaleDmg: 1, sealDmg: 1, abilityDmg: 1,   // damage of each tool (and of your special ability)
  lampCd: 1, scaleCd: 1, sealCd: 1, abilityCd: 1,       // cooldowns (below 1 is faster)
  scaleRadius: 1, sealReach: 1,                         // size of the Weegschaal wave, reach of the Zegel
  revealRadius: 1, revealCd: 1,                         // the reveal pulse
  speed: 1, dashCd: 1,                                  // walking and running speed, dash cooldown
  damageTaken: 1, healMult: 1,                          // incoming damage, healing from coffee, snacks and support
};
export const ADDS = {
  lootLuck: 0,       // extra chance (0..1) that a monster drops something
  secretSense: 0,    // metres within which hidden secrets hum (0 = off)
  regen: 0,          // trust regained per second outside fights
};
export const MOD_SOURCES = [];   // (G) => partial modifiers or null

let cache = null;
export function invalidateMods() { cache = null; }
export function mods() {
  if (cache) return cache;
  const out = {...FACTORS, ...ADDS};
  for (const src of MOD_SOURCES) {
    let m = null;
    try { m = src(G); } catch (e) { m = null; }
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (k in FACTORS) out[k] *= v;
      else if (k in ADDS) out[k] += v;
    }
  }
  cache = out;
  return out;
}
export const mod = key => mods()[key] ?? 1;
