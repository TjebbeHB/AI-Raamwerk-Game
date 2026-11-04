// What people can look like: the hero from the character creator and everyone in Dalwijk.
// One schema for the 3D model (engine/models.js), the portraits (ui/portrait.js) and the
// creator (ui/creator.js). Pure data and plain functions: no three.js, so tests can import it.
//
//   normalizeLook(spec)  -> a complete look with defaults; old spec keys still work
//   LOOK_OPTIONS         -> every field with its Dutch label and options, in creator order
//   SKIN_TONES, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, ... -> curated palettes [{id, name, hex}]
//   randomLook(rng)      -> a tasteful random look (the creator's "Verras me")
//   lookKey(look)        -> a stable string per look (geometry caches)

// ---------------------------------------------------------------- palettes
const P = list => list.map(([id, name, hex]) => ({id, name, hex}));

// From very light to very dark; every one of them is for everyone.
export const SKIN_TONES = P([
  ['porselein', 'Porselein', 0xfbe4d5], ['licht', 'Licht', 0xf5d3bd], ['roze', 'Licht roze', 0xf0c4ad], ['zand', 'Zand', 0xe9be98],
  ['honing', 'Honing', 0xdcaa7e], ['olijf', 'Olijf', 0xc9a07a], ['karamel', 'Karamel', 0xbf8a5e], ['brons', 'Brons', 0xa8734a],
  ['kaneel', 'Kaneel', 0x93603b], ['kastanje', 'Kastanje', 0x7a4a2c], ['cacao', 'Cacao', 0x613a22], ['ebben', 'Ebben', 0x48291a],
]);
// Not for the creator by default: kobolds, spirits and other folk of the Gewelf.
export const FANTASY_SKINS = P([['kobold', 'Koboldgroen', 0x7ab05a], ['geest', 'Geestblauw', 0xa8c4e8], ['lavendel', 'Lavendel', 0xc0a8e0]]);

export const HAIR_COLORS = P([
  ['zwart', 'Zwart', 0x17120f], ['donkerbruin', 'Donkerbruin', 0x3a2618], ['bruin', 'Bruin', 0x5a3a22], ['kastanje', 'Kastanje', 0x7a4526],
  ['auburn', 'Auburn', 0x9a3e1e], ['rood', 'Rood', 0xc0602a], ['aardbei', 'Aardbeiblond', 0xd8945a], ['donkerblond', 'Donkerblond', 0xa8804a],
  ['blond', 'Blond', 0xdcbc7c], ['platina', 'Platina', 0xeee2c4], ['grijs', 'Grijs', 0x9c9c9a], ['zilver', 'Zilver', 0xc8c8cc], ['wit', 'Wit', 0xf2f2ee],
  // and for the brave
  ['blauw', 'Blauw', 0x3a6ad8], ['petrol', 'Petrol', 0x1f8a86], ['roze', 'Roze', 0xe86aa8], ['paars', 'Paars', 0x8a4ad8], ['groen', 'Groen', 0x4aa84a], ['vuurrood', 'Vuurrood', 0xd02a2a],
]);

export const EYE_COLORS = P([
  ['donkerbruin', 'Donkerbruin', 0x3a2414], ['bruin', 'Bruin', 0x6a4424], ['hazelaar', 'Hazelaar', 0x8a6a2a], ['amber', 'Amber', 0xb07a2a],
  ['groen', 'Groen', 0x4a7a4a], ['grijs', 'Grijs', 0x7a8a96], ['blauw', 'Blauw', 0x3a6aa8], ['lichtblauw', 'Lichtblauw', 0x6aa0d8],
]);

export const CLOTH_COLORS = P([
  ['marine', 'Marineblauw', 0x22305a], ['donkerblauw', 'Donkerblauw', 0x2f4f7a], ['koningsblauw', 'Koningsblauw', 0x2f5fb8], ['hemelsblauw', 'Hemelsblauw', 0x7aaee0],
  ['petrol', 'Petrol', 0x2a8a8a], ['mosgroen', 'Mosgroen', 0x5a6e3a], ['bosgroen', 'Bosgroen', 0x2e5a3a], ['olijf', 'Olijf', 0x7a7a3a],
  ['mosterd', 'Mosterd', 0xc89a2a], ['oker', 'Oker', 0xb8762a], ['oranje', 'Oranje', 0xe8742a], ['roest', 'Roest', 0xa8442a],
  ['rood', 'Rood', 0xc0302a], ['bordeaux', 'Bordeaux', 0x6a1e2a], ['roze', 'Roze', 0xe890b0], ['lila', 'Lila', 0xa08ab8],
  ['pruim', 'Pruim', 0x6a2a5a], ['paars', 'Paars', 0x5a3a8a], ['creme', 'Crème', 0xf0e6d0], ['beige', 'Beige', 0xd8c8a0],
  ['camel', 'Camel', 0xb08458], ['bruin', 'Bruin', 0x6a4a2e], ['grijs', 'Grijs', 0x8a8e94], ['antraciet', 'Antraciet', 0x3a3d44],
  ['zwart', 'Zwart', 0x1c1c22], ['wit', 'Wit', 0xf4f2ee],
]);
export const SHOE_COLORS = P([['zwart', 'Zwart', 0x1a1616], ['bruin', 'Bruin', 0x4a2e1a], ['cognac', 'Cognac', 0x8a4a22], ['grijs', 'Grijs', 0x5a5a60], ['wit', 'Wit', 0xeeeeea], ['rood', 'Rood', 0xa82a2a], ['blauw', 'Blauw', 0x2a3a6a]]);
export const GLASSES_COLORS = P([['zwart', 'Zwart', 0x222226], ['schildpad', 'Schildpad', 0x6a3e1e], ['goud', 'Goud', 0xc8a050], ['zilver', 'Zilver', 0xa8acb4], ['rood', 'Rood', 0xc0282a], ['blauw', 'Blauw', 0x2a5ab0], ['groen', 'Groen', 0x2a7a4a]]);

// ---------------------------------------------------------------- the schema
const B = (id, label) => ({id, label});
const OPT = {
  build: [B('slim', 'Slank'), B('average', 'Gemiddeld'), B('broad', 'Breed'), B('round', 'Rond')],
  age: [B('young', 'Jong'), B('adult', 'Volwassen'), B('old', 'Ouder')],
  brows: [B('thin', 'Dun'), B('normal', 'Gewoon'), B('thick', 'Dik'), B('bushy', 'Borstelig')],
  nose: [B('small', 'Klein'), B('normal', 'Gewoon'), B('big', 'Groot'), B('long', 'Lang')],
  facialHair: [B('none', 'Geen'), B('stubble', 'Stoppels'), B('moustache', 'Snor'), B('walrus', 'Walrussnor'), B('goatee', 'Sik'), B('beard', 'Baard'), B('full', 'Volle baard')],
  glasses: [B('none', 'Geen'), B('round', 'Rond'), B('square', 'Hoekig'), B('half', 'Leesbril'), B('shades', 'Zonnebril')],
  hair: [B('bald', 'Kaal'), B('buzz', 'Opgeschoren'), B('short', 'Kort'), B('side', 'Zijscheiding'), B('slick', 'Achterover'), B('curly', 'Krullen'), B('afro', 'Afro'),
    B('pixie', 'Pixie'), B('bob', 'Bob'), B('long', 'Lang'), B('ponytail', 'Paardenstaart'), B('bun', 'Knot'), B('braids', 'Vlechtjes'), B('headscarf', 'Hoofddoek')],
  hat: [B('none', 'Geen'), B('cap', 'Pet'), B('beret', 'Baret'), B('beanie', 'Muts'), B('tophat', 'Hoge hoed'), B('hood', 'Capuchon'), B('quill', 'Veerhoed'), B('hardhat', 'Bouwhelm')],
  top: [B('blazer', 'Colbert'), B('cardigan', 'Vest'), B('jumper', 'Trui'), B('shirt', 'Overhemd'), B('tshirt', 'T-shirt'), B('hoodie', 'Hoodie'), B('vest', 'Gilet'),
    B('dress', 'Jurk'), B('robe', 'Gewaad'), B('apron', 'Schort'), B('hawaii', 'Hawaïhemd'), B('hivis', 'Hesje')],
  pattern: [B('plain', 'Effen'), B('check', 'Ruitjes'), B('stripe', 'Streepjes'), B('dots', 'Stippen')],
  bottom: [B('trousers', 'Broek'), B('skirt', 'Rok'), B('shorts', 'Korte broek')],
  // things people carry; the hero carries the lantern and the tools, so the creator can leave this out
  hold: [B('none', 'Niets'), B('folder', 'Map'), B('umbrella', 'Paraplu'), B('clipboard', 'Klembord'), B('keys', 'Sleutels'), B('suitcase', 'Koffer'), B('ruler', 'Meetlat'),
    B('horn', 'Hoorn'), B('stamp', 'Stempel'), B('book', 'Boek'), B('tome', 'Dik boek'), B('mug', 'Mok'), B('tea', 'Thee'), B('pen', 'Vulpen'), B('form', 'Formulier'),
    B('leash', 'Hondenriem'), B('bread', 'Broodtas'), B('handbag', 'Handtas'), B('phone', 'Telefoon')],
  mood: [B('neutral', 'Neutraal'), B('happy', 'Blij'), B('laugh', 'Lachend'), B('sad', 'Verdrietig'), B('angry', 'Boos'), B('surprised', 'Verrast'),
    B('worried', 'Bezorgd'), B('smug', 'Zelfvoldaan'), B('thinking', 'Nadenkend'), B('tired', 'Moe')],
};
export const LOOK_ENUMS = OPT;

// In the order a creator would show them. type: choice | range | color | toggle.
// optional: the field may be absent (then the default applies); when(look): only relevant if true.
export const LOOK_OPTIONS = [
  {key: 'build', label: 'Postuur', group: 'Lichaam', type: 'choice', options: OPT.build},
  {key: 'height', label: 'Lengte', group: 'Lichaam', type: 'range', min: 0.86, max: 1.14, step: 0.02, ends: ['Klein', 'Lang']},
  {key: 'skin', label: 'Huidskleur', group: 'Lichaam', type: 'color', palette: SKIN_TONES},
  {key: 'age', label: 'Leeftijd', group: 'Lichaam', type: 'choice', options: OPT.age},
  {key: 'eyes', label: 'Oogkleur', group: 'Gezicht', type: 'color', palette: EYE_COLORS},
  {key: 'brows', label: 'Wenkbrauwen', group: 'Gezicht', type: 'choice', options: OPT.brows},
  {key: 'nose', label: 'Neus', group: 'Gezicht', type: 'choice', options: OPT.nose},
  {key: 'freckles', label: 'Sproetjes', group: 'Gezicht', type: 'toggle'},
  {key: 'blush', label: 'Blosjes', group: 'Gezicht', type: 'toggle'},
  {key: 'facialHair', label: 'Gezichtshaar', group: 'Gezicht', type: 'choice', options: OPT.facialHair},
  {key: 'facialHairColor', label: 'Kleur gezichtshaar', group: 'Gezicht', type: 'color', palette: HAIR_COLORS, optional: true, when: l => l.facialHair !== 'none'},
  {key: 'glasses', label: 'Bril', group: 'Gezicht', type: 'choice', options: OPT.glasses},
  {key: 'glassesColor', label: 'Kleur montuur', group: 'Gezicht', type: 'color', palette: GLASSES_COLORS, optional: true, when: l => l.glasses !== 'none'},
  {key: 'hair', label: 'Kapsel', group: 'Haar', type: 'choice', options: OPT.hair},
  {key: 'hairColor', label: 'Haarkleur', group: 'Haar', type: 'color', palette: HAIR_COLORS, when: l => l.hair !== 'bald' && l.hair !== 'headscarf'},
  {key: 'fringe', label: 'Pony', group: 'Haar', type: 'toggle', optional: true, when: l => ['bob', 'long', 'ponytail', 'pixie'].includes(l.hair)},
  {key: 'scarfColor', label: 'Kleur hoofddoek', group: 'Haar', type: 'color', palette: CLOTH_COLORS, optional: true, when: l => l.hair === 'headscarf'},
  {key: 'hat', label: 'Hoofddeksel', group: 'Haar', type: 'choice', options: OPT.hat},
  {key: 'hatColor', label: 'Kleur hoofddeksel', group: 'Haar', type: 'color', palette: CLOTH_COLORS, optional: true, when: l => l.hat !== 'none'},
  {key: 'top', label: 'Bovenkleding', group: 'Kleding', type: 'choice', options: OPT.top},
  {key: 'topColor', label: 'Kleur', group: 'Kleding', type: 'color', palette: CLOTH_COLORS},
  {key: 'top2', label: 'Tweede kleur', hint: 'het overhemd eronder, de voering of het motief', group: 'Kleding', type: 'color', palette: CLOTH_COLORS, optional: true},
  {key: 'pattern', label: 'Motief', group: 'Kleding', type: 'choice', options: OPT.pattern, optional: true},
  {key: 'long', label: 'Lange jas', group: 'Kleding', type: 'toggle', optional: true, when: l => ['blazer', 'cardigan', 'hoodie', 'jumper'].includes(l.top)},
  {key: 'tie', label: 'Stropdas', group: 'Kleding', type: 'color', palette: CLOTH_COLORS, optional: true, when: l => ['blazer', 'shirt', 'vest'].includes(l.top)},
  {key: 'bottom', label: 'Onderkleding', group: 'Kleding', type: 'choice', options: OPT.bottom, when: l => l.top !== 'robe'},
  {key: 'bottomColor', label: 'Kleur', group: 'Kleding', type: 'color', palette: CLOTH_COLORS, when: l => l.top !== 'robe'},
  {key: 'shoes', label: 'Schoenen', group: 'Kleding', type: 'color', palette: SHOE_COLORS},
  {key: 'lanyard', label: 'Pasje aan een keycord', group: 'Accessoires', type: 'toggle'},
  {key: 'scarf', label: 'Sjaal', group: 'Accessoires', type: 'color', palette: CLOTH_COLORS, optional: true},
  {key: 'earrings', label: 'Oorbellen', group: 'Accessoires', type: 'toggle'},
  {key: 'headset', label: 'Headset', group: 'Accessoires', type: 'toggle'},
  {key: 'patches', label: 'Elleboogstukken', group: 'Accessoires', type: 'toggle', when: l => ['blazer', 'cardigan', 'jumper'].includes(l.top)},
];

// Accessories only the people of Dalwijk wear (look.extras); the creator may offer some of them.
export const EXTRAS = {
  keyring: 'enorme sleutelbos aan de riem', brooch: 'broche met het wapen van Dalwijk', chain: 'brillenkoord', loupe: 'loep op de bril',
  pencil: 'potlood in de knot', shadesUp: 'zonnebril op het hoofd', sunburn: 'verbrande neus', soot: 'roetveeg op de wang', ink: 'inktvlekken op de vingers',
  mitts: 'ovenwanten', tape: 'meetlint om de nek', tools: 'gereedschap in de schortzak', watchchain: 'horlogeketting', messy: 'losse plukken',
  capBadge: 'embleem op de pet', mailbag: 'posttas', pocketsquare: 'pochet', glow: 'zacht schijnsel', glowEyes: 'oplichtende ogen',
  shine: 'glimmend pak', twinkle: 'twinkelende ogen', pointyEars: 'puntoren', socks: 'witte sokken', cateye: 'vlindermontuur', sleeves: 'opgestroopte mouwen',
};

// ---------------------------------------------------------------- defaults and normalising
// A neutral person: no accessories. (The hero's own default is DEFAULT_LOOK in game/hero.js.)
export const BASE_LOOK = {
  build: 'average', height: 1, skin: 0xe2b490, age: 'adult',
  eyes: 0x3a2a1a, brows: 'normal', nose: 'normal', freckles: false, blush: false,
  facialHair: 'none', facialHairColor: null, glasses: 'none', glassesColor: null,
  hair: 'short', hairColor: 0x4a3222, fringe: false, scarfColor: null, hat: 'none', hatColor: null,
  top: 'blazer', topColor: 0x2f4f7a, top2: 0xe8e4dc, pattern: 'plain', patternColor: null, long: false, tie: null,
  bottom: 'trousers', bottomColor: 0x2a2a34, shoes: 0x241a14,
  lanyard: false, scarf: null, earrings: false, headset: false, patches: false,
  holdL: null, holdR: null, idle: null, mood: 'neutral', mouth: null, lids: 0, browTilt: 0, extras: [],
};

const HAT_ALIASES = {none: 'none', '': 'none'};
const HOLDS = new Set(OPT.hold.map(o => o.id).concat(['clipboard', 'coffee', 'lantern', 'quill']));
const MOODS = new Set(OPT.mood.map(o => o.id));

// colours: numbers, '#rrggbb' or 'rrggbb'
export function toHex(v, fallback = null) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(0xffffff, Math.round(v)));
  if (typeof v === 'string') { const m = v.trim().match(/^#?([0-9a-f]{6})$/i); if (m) return parseInt(m[1], 16); }
  return fallback;
}
const pick = (v, list, fallback) => (list.some(o => o.id === v) ? v : fallback);

// Any spec (old keys, new keys, a half-filled creator look) -> a complete look.
export function normalizeLook(spec = {}) {
  const s = spec || {}, L = {...BASE_LOOK, extras: []};
  // ---- old spec keys (before the look schema): coat, pants, hair as a colour, hairStyle, beard, glasses: true, robe, long, shirt, badge, sleeve, smile, scale
  if (s.coat !== undefined) L.topColor = toHex(s.coat, L.topColor);
  if (s.pants !== undefined) L.bottomColor = toHex(s.pants, L.bottomColor);
  if (typeof s.hair === 'number') L.hairColor = s.hair;
  if (typeof s.hairStyle === 'string') L.hair = s.hairStyle;
  if (s.beard !== undefined && s.beard !== false && s.beard !== null) { L.facialHair = 'beard'; if (toHex(s.beard) !== null) L.facialHairColor = toHex(s.beard); }
  if (s.glasses === true) L.glasses = 'square';
  if (s.robe !== undefined && s.robe !== false) { L.top = 'robe'; L.topColor = toHex(s.robe, L.topColor); if (s.coat !== undefined) L.top2 = toHex(s.coat, L.top2); }
  if (s.shirt !== undefined) L.top2 = toHex(s.shirt, L.top2);
  if (s.sleeve !== undefined && s.top2 === undefined && s.shirt === undefined) L.top2 = toHex(s.sleeve, L.top2);
  if (s.badge) L.lanyard = true;
  if (s.smile) L.mood = 'happy';
  if (typeof s.scale === 'number' && s.height === undefined) L.height = s.scale;
  // ---- the schema
  for (const k of ['build', 'age', 'brows', 'nose', 'facialHair', 'top', 'bottom']) if (s[k] !== undefined) L[k] = pick(s[k], OPT[k], L[k]);
  if (typeof s.hair === 'string') L.hair = pick(s.hair, OPT.hair, L.hair);
  else L.hair = pick(L.hair, OPT.hair, 'short');
  if (typeof s.glasses === 'string') L.glasses = pick(s.glasses, OPT.glasses, 'none');
  if (s.hat !== undefined) L.hat = pick(HAT_ALIASES[s.hat] ?? s.hat, OPT.hat, 'none');
  if (s.pattern !== undefined) L.pattern = pick(s.pattern, OPT.pattern, 'plain');
  for (const k of ['skin', 'eyes', 'hairColor', 'topColor', 'top2', 'bottomColor', 'shoes']) if (s[k] !== undefined && s[k] !== null) L[k] = toHex(s[k], L[k]);
  for (const k of ['facialHairColor', 'glassesColor', 'scarfColor', 'hatColor', 'tie', 'scarf', 'patternColor']) if (s[k] !== undefined) L[k] = toHex(s[k], null);
  for (const k of ['freckles', 'blush', 'lanyard', 'earrings', 'headset', 'patches', 'long', 'fringe']) if (s[k] !== undefined) L[k] = !!s[k];
  if (typeof s.height === 'number' && Number.isFinite(s.height)) L.height = s.height;
  L.height = Math.max(0.5, Math.min(1.5, L.height));
  for (const k of ['holdL', 'holdR']) if (s[k] !== undefined) L[k] = HOLDS.has(s[k]) ? s[k] : null;
  if (typeof s.idle === 'string') L.idle = s.idle;
  if (MOODS.has(s.mood)) L.mood = s.mood;
  if (['grin', 'smile', 'line', 'none'].includes(s.mouth)) L.mouth = s.mouth;
  if (typeof s.lids === 'number') L.lids = Math.max(0, Math.min(0.7, s.lids));
  if (typeof s.browTilt === 'number') L.browTilt = Math.max(-1, Math.min(1, s.browTilt));
  if (Array.isArray(s.extras)) L.extras = s.extras.filter(e => e in EXTRAS).sort();
  // a robe covers the legs; keep the bottom sane so portraits and models agree
  if (L.top === 'robe' || L.top === 'dress') L.long = false;
  return L;
}

// A stable string per look (normalizeLook always builds keys in the same order).
export const lookKey = look => JSON.stringify(look);

// ---------------------------------------------------------------- a random, tasteful look
export function randomLook(rng = Math.random) {
  const r = list => list[Math.floor(rng() * list.length) % list.length];
  const hex = list => r(list).hex;
  const hair = r(['bald', 'buzz', 'short', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf']);
  const natural = HAIR_COLORS.slice(0, 13), age = rng() < 0.15 ? 'old' : rng() < 0.25 ? 'young' : 'adult';
  const hairColor = age === 'old' ? r([0x9c9c9a, 0xc8c8cc, 0xf2f2ee]) : rng() < 0.1 ? hex(HAIR_COLORS.slice(13)) : hex(natural);
  const top = r(['blazer', 'cardigan', 'jumper', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'hawaii', 'blazer', 'cardigan']);
  return normalizeLook({
    build: r(['slim', 'average', 'average', 'broad', 'round']), height: 0.88 + Math.round(rng() * 12) * 0.02, skin: hex(SKIN_TONES), age,
    eyes: hex(EYE_COLORS), brows: r(['thin', 'normal', 'normal', 'thick', 'bushy']), nose: r(['small', 'normal', 'normal', 'big', 'long']),
    freckles: rng() < 0.2, blush: rng() < 0.25,
    facialHair: rng() < 0.3 ? r(['stubble', 'moustache', 'goatee', 'beard', 'full', 'walrus']) : 'none',
    glasses: rng() < 0.35 ? r(['round', 'square', 'half']) : 'none', glassesColor: hex(GLASSES_COLORS),
    hair, hairColor, scarfColor: hex(CLOTH_COLORS), fringe: rng() < 0.3,
    hat: rng() < 0.12 ? r(['cap', 'beret', 'beanie']) : 'none', hatColor: hex(CLOTH_COLORS),
    top, topColor: hex(CLOTH_COLORS), top2: hex(CLOTH_COLORS), pattern: rng() < 0.2 ? r(['check', 'stripe', 'dots']) : 'plain',
    tie: ['blazer', 'shirt', 'vest'].includes(top) && rng() < 0.3 ? hex(CLOTH_COLORS) : null,
    bottom: top === 'dress' ? 'skirt' : r(['trousers', 'trousers', 'skirt', 'shorts']), bottomColor: hex(CLOTH_COLORS), shoes: hex(SHOE_COLORS),
    lanyard: rng() < 0.5, scarf: rng() < 0.12 ? hex(CLOTH_COLORS) : null, earrings: rng() < 0.3, patches: top === 'cardigan' && rng() < 0.4,
  });
}
