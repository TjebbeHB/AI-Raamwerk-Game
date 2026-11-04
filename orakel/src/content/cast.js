// Who is who in Dalwijk and the Gewelf below it. model: a look (see content/looks.js) or a creature
// kind. idle: a personal gesture when they stand around; greet: what they do when you walk up.
// voice: how their syllables sound while their text types (core/audio.js TIMBRES); 'you' is only a fallback,
// your own voice follows your pronouns and archetype.
export const CAST_DEFS = {
  pip: {name: 'Pip', title: 'lantaarngeest', voice: {pitch: 760, timbre: 'squeaky'}, color: '#ffd27a', model: {kind: 'pip'}},
  you: {name: 'Jij', title: '', voice: {pitch: 192, timbre: 'warm'}},
  // ---- the town hall ----
  wethouder: {name: 'Wethouder Hendriks', title: 'portefeuille Dienstverlening', voice: {pitch: 228, timbre: 'crisp'}, greet: 'nod', model: {
    build: 'slim', height: 1.06, skin: 0xa86e4a, age: 'adult', eyes: 0x3a2414, brows: 'thin', nose: 'normal',
    hair: 'bob', hairColor: 0xc8c8cc, glasses: 'square', glassesColor: 0xc0282a,
    top: 'blazer', topColor: 0x22305a, top2: 0xf0e6d0, bottom: 'trousers', bottomColor: 0x22305a, shoes: 0x1a1616,
    earrings: true, holdR: 'pen', extras: ['brooch'], idle: 'pen', browTilt: 0.25}},
  ilse: {name: 'Ilse', title: 'klantcontactcentrum', voice: {pitch: 300, timbre: 'bright'}, greet: 'wave', model: {
    build: 'average', height: 0.98, skin: 0xf5d3bd, eyes: 0x4a7a4a, brows: 'normal', nose: 'small', freckles: true,
    hair: 'ponytail', hairColor: 0x9a3e1e, headset: true,
    top: 'cardigan', topColor: 0x2a8a8a, top2: 0x8a8e94, bottom: 'trousers', bottomColor: 0x2a2e3a, shoes: 0x3a3a40,
    lanyard: true, holdL: 'tea', idle: 'headset', mood: 'happy', lids: 0.2}},
  bakker: {name: 'Mevrouw Bakker', title: 'inwoner, 79 jaar', voice: {pitch: 285, timbre: 'quavery'}, greet: 'nod', model: {
    build: 'average', height: 0.88, skin: 0xf4d4c0, age: 'old', eyes: 0x6a7a8a, brows: 'thick', nose: 'normal', blush: true,
    hair: 'bun', hairColor: 0xf2f2ee, glasses: 'half', glassesColor: 0x8a6a4a,
    top: 'blazer', long: true, topColor: 0xa08ab8, top2: 0xe8dcc8, bottom: 'skirt', bottomColor: 0x5a4a6a, shoes: 0x2a2020,
    holdR: 'umbrella', holdL: 'handbag', extras: ['chain'], idle: 'umbrella', browTilt: 0.5}},
  glans: {name: 'Glans', title: 'accountmanager, PraatPal', voice: {pitch: 168, timbre: 'smooth'}, color: '#ffd36b', greet: 'fingerguns', model: {
    build: 'slim', height: 1.04, skin: 0xe8945a, eyes: 0x3a2a1a, brows: 'thin', nose: 'small',
    hair: 'slick', hairColor: 0x141218,
    top: 'blazer', topColor: 0x1e2a6a, top2: 0xffffff, tie: 0xe8b830, bottom: 'trousers', bottomColor: 0x1e2a6a, shoes: 0x0e0e12,
    holdL: 'folder', extras: ['shadesUp', 'shine', 'pocketsquare'], idle: 'tie', mood: 'smug', mouth: 'grin'}},
  joop: {name: 'Joop', title: 'conciërge', voice: {pitch: 104, timbre: 'warm'}, greet: 'tipcap', model: {
    build: 'round', height: 0.97, skin: 0xf0c4a8, age: 'old', eyes: 0x3a7ad0, brows: 'bushy', nose: 'big', blush: true,
    facialHair: 'walrus', facialHairColor: 0xbcbcb6, hair: 'short', hairColor: 0xa8a8a4, hat: 'cap', hatColor: 0x6a6a70,
    top: 'cardigan', topColor: 0x5a6e3a, top2: 0xe6dcc0, pattern: 'check', patternColor: 0xa0503a, patches: true,
    bottom: 'trousers', bottomColor: 0x6a4a2e, shoes: 0x3a2618,
    holdR: 'keys', extras: ['keyring', 'twinkle'], idle: 'keys', mood: 'happy'}},
  burger1: {name: 'Meneer Kok', title: 'nummer 388', voice: {pitch: 118, timbre: 'gruff'}, greet: 'nod', model: {
    build: 'broad', height: 1.02, skin: 0xc8946a, eyes: 0x4a3a2a, brows: 'thick', nose: 'big',
    hair: 'short', hairColor: 0x4a3020, facialHair: 'beard', facialHairColor: 0x5a3a22, hat: 'cap', hatColor: 0x6a4a2a,
    top: 'blazer', long: true, topColor: 0x6a5a40, top2: 0x8a3a2a, bottom: 'trousers', bottomColor: 0x3a3a44, shoes: 0x2a1e14,
    holdL: 'bread', idle: 'bread', mood: 'tired'}},
  burger2: {name: 'Sanne', title: 'komt voor een stempel', voice: {pitch: 272, timbre: 'bright'}, greet: 'wave', model: {
    build: 'average', height: 0.97, skin: 0x613a22, age: 'young', eyes: 0x2a1a10, brows: 'normal', nose: 'normal',
    hair: 'bob', hairColor: 0x141010, earrings: true,
    top: 'blazer', long: true, topColor: 0xc0302a, top2: 0x2a2a30, bottom: 'trousers', bottomColor: 0x2a2a34, shoes: 0x1a1414,
    holdR: 'form', idle: 'form', mood: 'worried'}},
  burger3: {name: 'Meneer De Wit', title: 'heeft een vraag over zijn hond', voice: {pitch: 148, timbre: 'nasal'}, greet: 'wave', model: {
    build: 'slim', height: 1.04, skin: 0xecc8a8, age: 'old', eyes: 0x6a8aa0, brows: 'normal', nose: 'long',
    hair: 'side', hairColor: 0xa8a8a8, glasses: 'round', glassesColor: 0x3a3a3e,
    top: 'blazer', long: true, topColor: 0x3a5a3a, top2: 0xd8d0c0, scarf: 0x8a2a2a, bottom: 'trousers', bottomColor: 0x5a4a3a, shoes: 0x2a1e14,
    holdR: 'leash', idle: 'leash', mood: 'thinking'}},
  // ---- the Kelder der Beloften ----
  waarom: {name: 'Vrouwe Waarom', title: 'hoedster van de Bron', voice: {pitch: 330, timbre: 'airy'}, color: '#9fc3ff', reach: 3.6, r: 0.7, greet: 'nod', model: {
    build: 'slim', height: 1.3, skin: 0x9ab2dc, eyes: 0x5ab4ff, brows: 'thin', nose: 'small',
    hair: 'long', hairColor: 0xe4ecf8, top: 'robe', topColor: 0x5e6f96, top2: 0xbcd0ee, shoes: 0x4a5a7a,
    extras: ['glow', 'glowEyes'], idle: 'float', mouth: 'smile'}},
  // ---- the Hal der Fundamenten ----
  griffel: {name: 'Griffel', title: 'griffier van de Raadzaal van Niemand', voice: {pitch: 182, timbre: 'crisp'}, greet: 'nod', model: {
    build: 'slim', height: 1.14, skin: 0xd8b090, eyes: 0x3a3a3a, brows: 'thin', nose: 'long',
    hair: 'short', hairColor: 0x2a2a2a, hat: 'quill', hatColor: 0x2a2240, glasses: 'round', glassesColor: 0xc8a050,
    top: 'robe', topColor: 0x2a2440, top2: 0x6a5a8a, shoes: 0x1a1414, holdL: 'tome', holdR: 'quill', extras: ['ink'], idle: 'read'}},
  vonk: {name: 'Vonk', title: 'aanjager van de adoptie', voice: {pitch: 420, timbre: 'sparkle'}, color: '#ffb84a', model: {kind: 'spark', color: 0xffb84a, big: true, grin: true}},
  ans: {name: 'Ans', title: 'dertig jaar ervaring', voice: {pitch: 250, timbre: 'warm'}, model: {kind: 'spark', color: 0x9fb0ff, glasses: 'half'}},
  joris: {name: 'Joris', title: 'net begonnen', voice: {pitch: 470, timbre: 'bubbly'}, model: {kind: 'spark', color: 0x9fffd0, sprout: true}},
  fatma: {name: 'Fatma', title: 'teamleider', voice: {pitch: 320, timbre: 'crisp'}, model: {kind: 'spark', color: 0xff9fd8, holdR: 'clipboard'}},
  pieter: {name: 'Pieter', title: 'werkt in deeltijd', voice: {pitch: 300, timbre: 'airy'}, model: {kind: 'spark', color: 0xd8ff9f, half: true}},
  mallow: {name: 'Mallow', title: 'meester van de werkplaats', voice: {pitch: 132, timbre: 'warm'}, greet: 'wave', model: {
    build: 'round', height: 0.88, skin: 0xe8b890, eyes: 0x5a4a2a, brows: 'thick', nose: 'big', blush: true,
    hair: 'curly', hairColor: 0xc8a068, glasses: 'round', glassesColor: 0x5a4a3a,
    top: 'apron', topColor: 0x8a5a32, top2: 0x7a5a3a, bottom: 'trousers', bottomColor: 0x4a4038, shoes: 0x3a2a1a,
    extras: ['tools', 'sleeves'], idle: 'tools', mood: 'happy'}},
  henk: {name: 'Henk', title: 'collega, vanaf morgen op vakantie', voice: {pitch: 172, timbre: 'bubbly'}, greet: 'wave', model: {
    build: 'average', height: 1.0, skin: 0xf0c0a0, eyes: 0x4a6a8a, brows: 'normal', nose: 'normal',
    hair: 'short', hairColor: 0x6a4a2a, top: 'hawaii', topColor: 0xe8742a, top2: 0xffd84a,
    bottom: 'shorts', bottomColor: 0xd8c8a0, shoes: 0x8a5a32, holdR: 'suitcase', extras: ['sunburn', 'shadesUp', 'socks'], idle: 'stretch', mood: 'happy'}},
  wolk: {name: 'Wolk', title: 'verkoper van wolkenpoorten', voice: {pitch: 196, timbre: 'airy'}, color: '#cfe0ff', model: {kind: 'cloud', color: 0xdfe6f0, tie: 0x2f5fb8}},
  // ---- the Galerij der Domeinen ----
  wouter: {name: 'Wouter', title: 'brugwachter', voice: {pitch: 94, timbre: 'gruff'}, greet: 'nod', model: {
    build: 'broad', height: 1.06, skin: 0x8a5232, eyes: 0x3a2414, brows: 'bushy', nose: 'big',
    hair: 'short', hairColor: 0x2a1a10, facialHair: 'full', facialHairColor: 0x4a2e1a, hat: 'cap', hatColor: 0x3a3a40,
    top: 'hivis', topColor: 0xff7a1a, top2: 0x6a4a32, bottom: 'trousers', bottomColor: 0x3a3a3a, shoes: 0x2a2016, idle: 'beard'}},
  mira: {name: 'Mira', title: 'meetmeester', voice: {pitch: 262, timbre: 'crisp'}, greet: 'wave', model: {
    build: 'average', height: 1.0, skin: 0x93603b, eyes: 0x2a1a10, brows: 'normal', nose: 'normal',
    hair: 'bob', fringe: true, hairColor: 0x141010,
    top: 'blazer', long: true, topColor: 0xf0f0ec, top2: 0x3a6a8a, bottom: 'trousers', bottomColor: 0x2a2a34, shoes: 0x2a2a2a,
    holdR: 'ruler', extras: ['tape'], idle: 'measure'}},
  bep: {name: 'Bep', title: 'bibliothecaris van Bijna Waar', voice: {pitch: 250, timbre: 'nasal'}, greet: 'nod', model: {
    build: 'average', height: 0.94, skin: 0xf0d0b8, age: 'old', eyes: 0x6a5a4a, brows: 'thin', nose: 'normal',
    hair: 'bun', hairColor: 0xa8a8a8, glasses: 'square', glassesColor: 0x6a2a5a,
    top: 'cardigan', topColor: 0x6a2a5a, top2: 0xe8e0d0, bottom: 'skirt', bottomColor: 0x3a3040, shoes: 0x3a2a2a,
    holdL: 'book', extras: ['pencil', 'cateye'], idle: 'shush'}},
  noor: {name: 'Noor', title: 'loketkabouter', voice: {pitch: 236, timbre: 'gruff'}, greet: 'wave', model: {
    kind: 'gnome', build: 'round', height: 0.66, skin: 0xf0c8a8, eyes: 0x3a5a8a, brows: 'bushy', nose: 'big', blush: true,
    hair: 'short', hairColor: 0xf4f4f0, facialHair: 'full', facialHairColor: 0xf8f8f4, hat: 'beret', hatColor: 0xc8302a,
    top: 'blazer', long: true, topColor: 0x2a6a3a, top2: 0xe8e0d0, bottom: 'trousers', bottomColor: 0x3a3030, shoes: 0x5a3a22,
    holdR: 'stamp', idle: 'generic', mood: 'happy'}},
  kees: {name: 'Kees', title: 'klokkenmaker van het afsprakenatelier', voice: {pitch: 150, timbre: 'tick'}, greet: 'nod', model: {
    build: 'slim', height: 0.96, skin: 0xecc4a4, age: 'old', eyes: 0x5a6a7a, brows: 'bushy', nose: 'long',
    hair: 'side', hairColor: 0xf2f2ee, glasses: 'round', glassesColor: 0xc8a050,
    top: 'vest', topColor: 0x5a3a2a, top2: 0xe8e0d0, bottom: 'trousers', bottomColor: 0x4a4a52, shoes: 0x2a1e14,
    extras: ['loupe', 'watchchain'], idle: 'watch', mood: 'thinking'}},
  bram: {name: 'Bram', title: 'postkobold', voice: {pitch: 410, timbre: 'nasal'}, greet: 'wave', model: {
    kind: 'kobold', build: 'slim', height: 0.74, skin: 0x7ab05a, eyes: 0xe8c040, brows: 'thin', nose: 'long',
    hair: 'buzz', hairColor: 0x3a4a1a, hat: 'cap', hatColor: 0x2a4a9a,
    top: 'shirt', topColor: 0x3a5aa8, bottom: 'shorts', bottomColor: 0x2a3a6a, shoes: 0x3a2a1a,
    extras: ['capBadge', 'mailbag', 'pointyEars'], idle: 'mail', mood: 'happy'}},
  sien: {name: 'Stoker Sien', title: 'bakt broodjes op de modelmachine', voice: {pitch: 220, timbre: 'warm'}, greet: 'wave', model: {
    build: 'broad', height: 0.98, skin: 0xf4ccb0, eyes: 0x4a6a3a, brows: 'normal', nose: 'small', freckles: true,
    hair: 'bun', hairColor: 0xc8602a, top: 'apron', topColor: 0x5a5048, top2: 0xa8442a,
    bottom: 'trousers', bottomColor: 0x3a3a40, shoes: 0x2a2016, holdR: 'coffee', extras: ['messy', 'soot', 'mitts', 'sleeves'], idle: 'coffee', mood: 'happy'}},
  otto: {name: 'Otto', title: 'archiefuil', voice: {pitch: 290, timbre: 'hoot'}, model: {kind: 'owl', color: 0x8a6a4a, glasses: true, stamp: true}},
  slotje: {name: 'Slotje', title: 'boekenwachter', voice: {pitch: 520, timbre: 'tick'}, model: {kind: 'padlock', color: 0xc8a040}},
  linde: {name: 'Linde', title: 'hoedster van de Luisterzaal', voice: {pitch: 212, timbre: 'smooth'}, greet: 'nod', model: {
    build: 'slim', height: 1.04, skin: 0x8a5232, eyes: 0x3a2414, brows: 'normal', nose: 'normal',
    hair: 'braids', hairColor: 0x161212, earrings: true,
    top: 'robe', topColor: 0x1e3a7a, top2: 0xd8b860, shoes: 0x2a2030, holdR: 'horn', idle: 'trumpet'}},
  // ---- the depths ----
  orakel: {name: 'Het Orakel', title: 'PraatPal Orakel™', voice: {pitch: 138, timbre: 'robot'}, color: '#ffd36b'},
  fabulant: {name: 'De Fabulant', title: 'die alles weet, of iets wat erop lijkt', voice: {pitch: 176, timbre: 'sparkle'}, color: '#c7a0ff'},
};
