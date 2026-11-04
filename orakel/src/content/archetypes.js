// The four archetypes of the character creator: who you are in the Gewelf, what you are good at
// and what people tease you about. Pure data and plain functions (no DOM, no three.js), so tests
// can import it. The passives go through MOD_SOURCES (game/mods.js); the abilities live in
// game/ability.js; the creator (ui/creator.js) shows the cards and the presets.
//
//   ARCHETYPES, archetypeById(id)   the cards: name, role, icon, passives, ability, weakness
//   applyStart(G)                   start bonuses for a new game (the Handhaver: +30 max trust)
//   makeHero(partial)               a complete, clean hero for G.hero
//   HERO_PRESETS                    ready-made looks for a quick start
import {MOD_SOURCES, invalidateMods} from '../game/mods.js';
import {DEFAULT_LOOK} from '../game/hero.js';
import {normalizeLook} from './looks.js';

export const ARCHETYPE_IDS = ['handhaver', 'datatovenaar', 'archivaris', 'verbinder'];

export const ARCHETYPES = [
  {
    id: 'handhaver', name: 'De Handhaver', short: 'Handhaver', role: 'krijger', icon: '🛡️', color: 0xc0442c, css: '#ef6a4c', mood: 'smug',
    tagline: 'Regels zijn er om mensen te beschermen. Ook tegen monsters.',
    text: 'Je kent elke verordening uit je hoofd en je stempel zit los in de holster. Wat jij goedkeurt, blijft goedgekeurd.',
    passives: ['+30 maximaal vertrouwen', 'Je Zegel slaat 25% harder', 'Je krijgt 15% minder schade'],
    mods: {sealDmg: 1.25, damageTaken: 0.85},
    start: {maxHp: 30},
    ability: {
      id: 'dwangsom', name: 'Last onder dwangsom', short: 'Dwangsom', cd: 14,
      text: 'Een reusachtig stempel dreunt op de vloer. Alles om je heen staat even stil, verbijsterd door zoveel rechtsgeldigheid.',
      npc: 'lookaround',
      quips: ['De vloer is nu officieel gehandhaafd. De vloer had niets misdaan.', 'Ergens in het gebouw valt een dossier van een plank. Uit respect.', 'Afgehandeld. Wat precies, dat zoeken we later uit.'],
    },
    weakness: 'Kan geen formulier ongestempeld laten.',
  },
  {
    id: 'datatovenaar', name: 'De Datatovenaar', short: 'Datatovenaar', role: 'tovenaar', icon: '🔮', color: 0x3a64d0, css: '#7aa2ff', mood: 'thinking',
    tagline: 'Je gelooft het pas als het in een draaitabel staat.',
    text: 'Waar anderen een mening hebben, heb jij een dashboard. Je Toetslamp brandt feller dan die van wie dan ook.',
    passives: ['Je Toetslamp doet 30% meer schade en laadt sneller op', 'Je onthulling reikt een stuk verder'],
    mods: {lampDmg: 1.3, lampCd: 0.8, revealRadius: 1.3},
    ability: {
      id: 'steekproef', name: 'Steekproef', short: 'Steekproef', cd: 12,
      text: 'Vijf lichtschichten zoeken zelf hun doel: een aselecte steekproef uit alle monsters die je ziet. Wat glanst, laat zien wat er echt zit.',
      npc: 'thinking',
      quips: ['Een steekproef van nul monsters. Statistisch gezien is het hier heel veilig.', 'Vijf lichtjes, nul monsters. Representatief? Dat hangt af van je definitie.', 'De steekproef is klein, maar de conclusie is groot: hier is niks.'],
    },
    weakness: 'Wil voor elke beslissing eerst een nulmeting. Ook voor de lunch.',
  },
  {
    id: 'archivaris', name: 'De Archivaris', short: 'Archivaris', role: 'verkenner', icon: '🗂️', color: 0x3a8a4a, css: '#6cc47a', mood: 'happy',
    tagline: 'Alles is al eens eerder geprobeerd. Jij weet in welke map.',
    text: 'Je kent elke gang, elke kast en elke vergeten la. Wat verstopt is, vind jij. Wat zoek is, ook.',
    passives: ['Je loopt 10% sneller en duikt vaker weg', 'Je voelt geheimen in de buurt', 'Verslagen monsters laten vaker iets lekkers achter'],
    mods: {speed: 1.1, dashCd: 0.7, secretSense: 8, lootLuck: 0.12},
    ability: {
      id: 'ordnerval', name: 'Ordnerval', short: 'Ordnerval', cd: 12,
      text: 'Een loodzware ordner (deel 7 van 12) valt uit het niets op je doelwit en pint alles eromheen vast.',
      npc: 'nod',
      quips: ['Plof. Deel 7 van 12. De andere elf liggen nog in het archief.', 'Iemand moet die ordner straks terugzetten. Dat ben jij.', 'Gearchiveerd. Bewaartermijn: zeven jaar, of tot het monster terugkomt.'],
    },
    weakness: 'Gooit nooit iets weg. Heeft de notulen van 1987 nog, op kleur gesorteerd.',
  },
  {
    id: 'verbinder', name: 'De Verbinder', short: 'Verbinder', role: 'genezer', icon: '☕', color: 0xd89a2a, css: '#f2b84e', mood: 'laugh',
    tagline: 'Elk probleem begint met een goed gesprek. En koffie.',
    text: 'Je weet hoe het met iedereen gaat, ook met de mensen die dat zelf nog niet weten. Waar jij bent, zakt de spanning.',
    passives: ['Je Weegschaal golft 25% harder', 'Koffie en snacks helen 50% meer', 'Buiten gevechten krijg je langzaam vertrouwen terug'],
    mods: {scaleDmg: 1.25, healMult: 1.5, regen: 0.5},
    ability: {
      id: 'koffie', name: 'Koffie voor iedereen', short: 'Koffie', cd: 18,
      text: 'Je schenkt koffie voor iedereen in de buurt. Jij krijgt vertrouwen terug, en monsters vergeten even waarom ze zo boos waren.',
      npc: 'sip',
      quips: ['Je schenkt koffie voor iedereen. Niemand had erom gevraagd; iedereen neemt er een.', 'Melk en suiker staan rechts. Of links. Ze staan er in elk geval.', 'Koffie! Het officiële begin van elk goed gesprek.'],
    },
    weakness: 'Begint elk gevecht met een voorstelrondje.',
  },
];

const BY_ID = Object.fromEntries(ARCHETYPES.map(a => [a.id, a]));
export const archetypeById = id => BY_ID[id] || null;

// The passives: one source for whichever archetype you are (the cache is cleared when it changes).
let registered = false;
export function registerArchetypes() {
  if (registered) return;
  registered = true;
  MOD_SOURCES.push(g => BY_ID[g?.hero?.archetype]?.mods || null);
  invalidateMods();
}
registerArchetypes();

// Start bonuses for a new game, after resetState and G.hero.
export function applyStart(g) {
  const a = BY_ID[g?.hero?.archetype];
  if (a?.start?.maxHp) { g.maxHp += a.start.maxHp; g.hp = g.maxHp; }
  invalidateMods();
}

// A complete hero from whatever the creator, a test or an old save hands over.
export const NAME_MAX = 24;
export function makeHero(p = {}) {
  const name = String(p.name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return {
    name,
    pronouns: ['hij', 'zij', 'die'].includes(p.pronouns) ? p.pronouns : 'die',
    address: ['mevrouw', 'meneer', 'neutraal'].includes(p.address) ? p.address : 'neutraal',
    archetype: BY_ID[p.archetype] ? p.archetype : null,
    look: normalizeLook({...DEFAULT_LOOK, ...(p.look || {}), mood: 'neutral'}),
  };
}

// Ready-made looks for a quick start. Everything in them is open to everyone.
export const HERO_PRESETS = [
  {id: 'nieuw', name: 'De nieuwe collega', look: {build: 'average', skin: 0xdcaa7e, hair: 'short', hairColor: 0x5a3a22, eyes: 0x6a4424, top: 'blazer', topColor: 0x2f4f7a, top2: 0xf0e6d0, bottom: 'trousers', bottomColor: 0x3a3d44, shoes: 0x4a2e1a, lanyard: true}},
  {id: 'beleid', name: 'De beleidsmedewerker', look: {build: 'slim', skin: 0xf5d3bd, hair: 'bun', hairColor: 0xc0602a, eyes: 0x4a7a4a, freckles: true, glasses: 'round', glassesColor: 0x6a3e1e, top: 'cardigan', topColor: 0xc89a2a, top2: 0xf0e6d0, patches: true, bottom: 'skirt', bottomColor: 0x22305a, shoes: 0x8a4a22, lanyard: true}},
  {id: 'jurist', name: 'De jurist', look: {build: 'broad', height: 1.06, skin: 0x7a4a2c, hair: 'buzz', hairColor: 0x17120f, eyes: 0x3a2414, facialHair: 'goatee', facialHairColor: 0x17120f, glasses: 'square', glassesColor: 0x222226, top: 'shirt', topColor: 0xf4f2ee, tie: 0x6a1e2a, bottom: 'trousers', bottomColor: 0x1c1c22, shoes: 0x1a1616, lanyard: true}},
  {id: 'rot', name: 'De ervaren rot', look: {build: 'round', height: 0.94, skin: 0xe9be98, age: 'old', hair: 'short', hairColor: 0xc8c8cc, eyes: 0x3a6aa8, brows: 'bushy', facialHair: 'walrus', facialHairColor: 0xc8c8cc, glasses: 'half', glassesColor: 0xc8a050, extras: ['chain'], top: 'cardigan', topColor: 0x5a6e3a, top2: 0xd8c8a0, patches: true, bottom: 'trousers', bottomColor: 0x6a4a2e, shoes: 0x4a2e1a}},
  {id: 'stagiair', name: 'De frisse stagiair', look: {build: 'slim', height: 0.96, skin: 0xbf8a5e, age: 'young', hair: 'afro', hairColor: 0x3a2618, eyes: 0x3a2414, blush: true, top: 'hoodie', topColor: 0x2a8a8a, top2: 0xf4f2ee, bottom: 'shorts', bottomColor: 0x22305a, shoes: 0xeeeeea, headset: true, lanyard: true}},
  {id: 'wijk', name: 'De wijkregisseur', look: {build: 'average', skin: 0xc9a07a, hair: 'headscarf', scarfColor: 0x2a8a8a, eyes: 0x8a6a2a, top: 'jumper', topColor: 0xa8442a, top2: 0xf0e6d0, pattern: 'stripe', bottom: 'trousers', bottomColor: 0x2a2a34, shoes: 0x5a5a60, scarf: 0xc89a2a, earrings: true, lanyard: true}},
];
