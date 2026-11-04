// Who is who in Dalwijk and the Gewelf below it.
export const CAST_DEFS = {
  pip: {name: 'Pip', title: 'lantaarngeest', color: '#ffd27a', model: {kind: 'pip'}},
  you: {name: 'Jij', title: ''},
  // ---- the town hall ----
  wethouder: {name: 'Wethouder Hendriks', title: 'portefeuille Dienstverlening', model: {coat: 0x3a3a48, pants: 0x2a2a30, hair: 0x7a7a7a, tie: 0x8a2a2a, shirt: 0xe8e4dc, glasses: true}},
  ilse: {name: 'Ilse', title: 'klantcontactcentrum', model: {coat: 0x4a7a5a, pants: 0x2a2a34, hair: 0x8a4a2a, hairStyle: 'long', headset: true}},
  bakker: {name: 'Mevrouw Bakker', title: 'inwoner, 79 jaar', model: {coat: 0x8a6a9a, robe: 0x7a5a8a, hair: 0xdedede, hairStyle: 'bun', glasses: true, holdR: 'umbrella', skin: 0xf0c9a5, scale: 0.92}},
  glans: {name: 'Glans', title: 'accountmanager, PraatPal', color: '#ffd36b', model: {coat: 0x24305a, pants: 0x1c2440, hair: 0x1a1410, hairStyle: 'slick', tie: 0xe8c060, shirt: 0xffffff, smile: true, holdR: 'folder'}},
  joop: {name: 'Joop', title: 'conciërge', model: {coat: 0x5a5a62, hat: 'cap', hatColor: 0x2a2a30, holdR: 'keys', beard: 0x9a9a9a, hair: 0x9a9a9a}},
  burger1: {name: 'Meneer Kok', title: 'nummer 388', model: {coat: 0x6a5a40, hat: 'cap', hatColor: 0x4a3a2a, hair: 0x4a3a2a, beard: 0x4a3a2a}},
  burger2: {name: 'Sanne', title: 'komt voor een stempel', model: {coat: 0xb04a4a, hair: 0x1a1208, hairStyle: 'bob', skin: 0xc68c62}},
  burger3: {name: 'Meneer De Wit', title: 'heeft een vraag over zijn hond', model: {coat: 0x3a5a3a, hair: 0xb0b0b0, glasses: true}},
  // ---- the Kelder der Beloften ----
  waarom: {name: 'Vrouwe Waarom', title: 'hoedster van de Bron', color: '#9fc3ff', reach: 3.6, r: 0.7, model: {robe: 0x8a98ae, coat: 0x9aa8be, skin: 0xb8c2d0, hair: 0xa8b4c4, hairStyle: 'long', scale: 1.3, eyes: 0x6aa8ff}},
  // ---- the Hal der Fundamenten ----
  griffel: {name: 'Griffel', title: 'griffier van de Raadzaal van Niemand', model: {coat: 0x3a3450, robe: 0x2a2440, hat: 'quill', hair: 0x2a2a2a, scale: 1.12, holdR: 'book'}},
  vonk: {name: 'Vonk', title: 'aanjager van de adoptie', color: '#ffb84a', model: {kind: 'spark', color: 0xffb84a}},
  ans: {name: 'Ans', title: 'dertig jaar ervaring', model: {kind: 'spark', color: 0x9fb0ff}},
  joris: {name: 'Joris', title: 'net begonnen', model: {kind: 'spark', color: 0x9fffd0}},
  fatma: {name: 'Fatma', title: 'teamleider', model: {kind: 'spark', color: 0xff9fd8}},
  pieter: {name: 'Pieter', title: 'werkt in deeltijd', model: {kind: 'spark', color: 0xd8ff9f}},
  mallow: {name: 'Mallow', title: 'meester van de werkplaats', model: {coat: 0x7a5a3a, robe: 0x6a4a2a, hair: 0xc8a070, hairStyle: 'curly', scale: 0.86, glasses: true}},
  henk: {name: 'Henk', title: 'collega, vanaf morgen op vakantie', model: {coat: 0xe8604a, shirt: 0xffe08a, pants: 0xd8c8a0, hair: 0x5a3a20, holdR: 'suitcase'}},
  wolk: {name: 'Wolk', title: 'verkoper van wolkenpoorten', color: '#cfe0ff', model: {kind: 'cloud', color: 0xdfe6f0}},
  // ---- the Galerij der Domeinen ----
  wouter: {name: 'Wouter', title: 'brugwachter', model: {coat: 0x6a5a3a, hat: 'cap', hatColor: 0x4a3a2a, beard: 0x6a4a2a, hair: 0x6a4a2a}},
  mira: {name: 'Mira', title: 'meetmeester', model: {coat: 0x4a6a8a, hair: 0x2a1a10, hairStyle: 'bob', holdR: 'ruler'}},
  bep: {name: 'Bep', title: 'bibliothecaris van Bijna Waar', model: {coat: 0x6a4a6a, robe: 0x5a3a5a, hair: 0x9a9a9a, hairStyle: 'bun', glasses: true, holdR: 'book', scale: 0.95}},
  noor: {name: 'Noor', title: 'loketkabouter', model: {kind: 'gnome', coat: 0x3a6a4a, hat: 'beret', hatColor: 0xc04030, beard: 0xf0f0f0, hair: 0xf0f0f0, scale: 0.7}},
  kees: {name: 'Kees', title: 'klokkenmaker van het afsprakenatelier', model: {coat: 0x5a4a3a, hat: 'cap', hatColor: 0x3a2a1a, glasses: true, hair: 0xd0d0d0}},
  bram: {name: 'Bram', title: 'postkobold', model: {kind: 'kobold', coat: 0x7a8a3a, skin: 0x8ab060, hair: 0x3a4a1a, hat: 'cap', hatColor: 0x2a4a8a, scale: 0.7}},
  sien: {name: 'Stoker Sien', title: 'bakt broodjes op de modelmachine', model: {coat: 0x8a4a2a, hair: 0xc87a3a, hairStyle: 'bun', holdR: 'mug'}},
  otto: {name: 'Otto', title: 'archiefuil', model: {kind: 'owl', color: 0x8a6a4a, glasses: true, stamp: true}},
  slotje: {name: 'Slotje', title: 'boekenwachter', model: {kind: 'padlock', color: 0xc8a040}},
  linde: {name: 'Linde', title: 'hoedster van de Luisterzaal', model: {coat: 0x4a5a7a, robe: 0x3a4a6a, hair: 0x1a1a1a, hairStyle: 'long', holdR: 'horn', skin: 0xc68c62}},
  // ---- the depths ----
  orakel: {name: 'Het Orakel', title: 'PraatPal Orakel™', color: '#ffd36b'},
  fabulant: {name: 'De Fabulant', title: 'die alles weet, of iets wat erop lijkt', color: '#c7a0ff'},
};
