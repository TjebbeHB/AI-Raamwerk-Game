// New people for the story systems, written in the LOOK SCHEMA (see game/hero.js and docs/inhoudsplan.md).
// Every new NPC of every depth is defined here; later lanes place them on their maps but add no new ones.
// Pure data, so the content tests can read it in Node.

export const CAST_EXTRA = {
  // ---- Diepte 0 · het stadhuis
  ingrid: {name: 'Ingrid', title: 'Communicatie · schreef de afvalpasbrief', color: '#e8b04a',
    model: {build: 'broad', height: 1.02, skin: 0x8d5a3b, age: 'adult', eyes: 0x3a2414, brows: 'thick', nose: 'normal',
      hair: 'curly', hairColor: 0x1e1410, glasses: 'square', glassesColor: 0x8a2a4a, earrings: true,
      top: 'cardigan', topColor: 0xd8a032, top2: 0xf0e8d8, bottom: 'skirt', bottomColor: 0x3a3a48, shoes: 0x2a1e18,
      lanyard: true, holdR: 'clipboard', idle: 'pen'}},
  dirk: {name: 'Dirk', title: 'ICT · tweede lijn', color: '#9fd0ff',
    model: {build: 'round', height: 1.06, skin: 0xe8c0a0, age: 'adult', eyes: 0x4a6a8a, brows: 'normal', nose: 'big',
      hair: 'short', hairColor: 0x8a6a3a, facialHair: 'beard', facialHairColor: 0x7a5a30, glasses: 'round', glassesColor: 0x2a2a2a,
      top: 'hoodie', topColor: 0x34465a, top2: 0x9fd0ff, bottom: 'trousers', bottomColor: 0x2a2a30, shoes: 0x1a1a1a,
      lanyard: true, holdR: 'mug', idle: 'tea'}},
  // the duck mayor of hallucination #3: an owl-shaped folk model with duck: true until models.js draws a real duck
  eend: {name: 'De burgemeester?', title: 'een eend met een ambtsketen', color: '#ffd36b', r: 0.35, reach: 2.4,
    model: {kind: 'owl', duck: true, color: 0xf4efe2, beak: 0xf08a1a, chain: 0xe8c060}},
  // ---- Diepte 1 · de Kelder der Beloften
  daan: {name: 'Daan', title: 'stagiair, sinds 2017', color: '#b8cce0',
    model: {build: 'slim', height: 1.04, skin: 0xc68c62, age: 'young', eyes: 0x2a1a10, brows: 'normal', nose: 'small',
      hair: 'side', hairColor: 0x2a1a10, top: 'shirt', topColor: 0xb8cce0, tie: 0x6a2a3a, bottom: 'trousers', bottomColor: 0x4a4a52,
      shoes: 0x3a2a1a, lanyard: true, holdR: 'folder', idle: 'tie'}},
  // ---- Diepte 2 · de Hal der Fundamenten
  kim: {name: 'Kim', title: 'kwartiermaker, sinds 2019', color: '#e86a4a',
    model: {build: 'slim', height: 0.96, skin: 0xf2d0b8, age: 'adult', eyes: 0x4a7a4a, brows: 'thin', nose: 'normal',
      hair: 'pixie', hairColor: 0xd8d0c0, freckles: true, top: 'blazer', topColor: 0x3a6a5a, top2: 0xf4f0e8,
      bottom: 'trousers', bottomColor: 0x2a3a3a, shoes: 0x4a2a1a, scarf: 0xe86a4a, holdR: 'clipboard', idle: 'pen'}},
};

// The same people turn up on several depths: an alias id per appearance, sharing one cast entry.
// The ones without a map spot yet are there for later lanes (the Zegelkamer cast, for example).
export const ALIAS = {
  bakker1: 'bakker', bakker3: 'bakker', bakker4: 'bakker', ilse1: 'ilse', ilse4: 'ilse',
  glans1: 'glans', glans2: 'glans', glans3: 'glans', glans4: 'glans', glans5: 'glans', joop4: 'joop',
  kok4: 'burger1', sanne4: 'burger2', dewit4: 'burger3', ingrid4: 'ingrid', dirk4: 'dirk', daan4: 'daan', kim4: 'kim',
  henk4: 'henk', wouter4: 'wouter', eend4: 'eend', waarom4: 'waarom',
};
export const baseId = id => ALIAS[id] || id;

// People you can have a relationship with (the journal tab Mensen and the summary read this list).
export const REL_PEOPLE = [
  {npc: 'joop', name: 'Joop'}, {npc: 'ilse', name: 'Ilse'}, {npc: 'bakker', name: 'Mevrouw Bakker'}, {npc: 'glans', name: 'Glans'},
  {npc: 'burger1', name: 'Meneer Kok'}, {npc: 'burger2', name: 'Sanne'}, {npc: 'burger3', name: 'Meneer De Wit'},
  {npc: 'ingrid', name: 'Ingrid'}, {npc: 'dirk', name: 'Dirk'}, {npc: 'pip', name: 'Pip'}, {npc: 'waarom', name: 'Vrouwe Waarom'},
  {npc: 'daan', name: 'Daan'}, {npc: 'henk', name: 'Henk'}, {npc: 'kim', name: 'Kim'}, {npc: 'wouter', name: 'Wouter'},
  {npc: 'wethouder', name: 'Wethouder Hendriks'},
];
