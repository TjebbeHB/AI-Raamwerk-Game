// The portrait gallery: every character of the bible in neutral, mood sheets, talking frames and a
// grid of player looks, drawn by src/ui/portrait.js in Chromium and screenshotted at deviceScaleFactor 2.
//   node orakel/test/e2e/portraits.mjs        -> shots/portraits-*.png, timings as [portraits] lines
// The cast is being redesigned elsewhere, so the looks below follow the LOOK SCHEMA and the character
// bible on their own (a stub CAST). Importing this file only gives SAMPLES and LOOK_GRID (for tests).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SAMPLES = {
  pip: {name: 'Pip', title: 'lantaarngeest', color: '#ffd27a', model: {kind: 'pip'}},
  joop: {name: 'Joop', title: 'conciërge', model: {build: 'round', height: 0.97, skin: 0xf2c6a4, age: 'old', eyes: 0x3f6a8f, brows: 'bushy', nose: 'big', blush: true, facialHair: 'walrus', hair: 'short', hairColor: 0xa9a9ae, hat: 'cap', hatColor: 0x77787f, top: 'cardigan', topColor: 0x5d7a3a, top2: 0xcfc1a0, patches: true, bottom: 'trousers', bottomColor: 0x6b4a2c, shoes: 0x3a2a1a, holdR: 'keys', idle: 'keys'}},
  wethouder: {name: 'Wethouder Hendriks', title: 'portefeuille Dienstverlening', model: {build: 'slim', height: 1.06, skin: 0xf1d2bd, eyes: 0x5a6a3a, nose: 'long', hair: 'bob', hairColor: 0xc9ccd3, glasses: 'square', glassesColor: 0xc8202a, top: 'blazer', topColor: 0x1f2b4d, top2: 0xf2e8d2, bottom: 'skirt', bottomColor: 0x1f2b4d}},
  ilse: {name: 'Ilse', title: 'klantcontactcentrum', model: {build: 'average', skin: 0xf3d3bd, eyes: 0x5b7d4a, hair: 'ponytail', hairColor: 0xa5481f, freckles: true, headset: true, top: 'cardigan', topColor: 0x2b8a8a, top2: 0x8d8e94, holdR: 'mug', idle: 'headset'}},
  bakker: {name: 'Mevrouw Bakker', title: 'inwoner, 79 jaar', model: {build: 'average', height: 0.88, skin: 0xf4d9c6, age: 'old', eyes: 0x5a6a8a, brows: 'thick', hair: 'bun', hairColor: 0xf1efeb, glasses: 'half', glassesColor: 0x8a6a3a, blush: true, top: 'blazer', topColor: 0x9a7ab8, top2: 0xe8dcf0, holdR: 'umbrella', idle: 'umbrella'}},
  glans: {name: 'Glans', title: 'accountmanager, PraatPal', color: '#ffd36b', model: {build: 'slim', skin: 0xd99a62, eyes: 0x2a4a8a, brows: 'thin', hair: 'slick', hairColor: 0x0b0b12, top: 'blazer', topColor: 0x1b2752, top2: 0xffffff, tie: 0xe8b830, holdR: 'folder', idle: 'tie'}},
  burger1: {name: 'Meneer Kok', title: 'nummer 388', model: {build: 'broad', skin: 0xe9b991, eyes: 0x4a3a2a, hair: 'short', hairColor: 0x5a3a20, facialHair: 'beard', hat: 'cap', hatColor: 0x5b4229, top: 'jumper', topColor: 0x6b5a42}},
  burger2: {name: 'Sanne', title: 'komt voor een stempel', model: {build: 'average', skin: 0x6b4128, eyes: 0x2a1a10, hair: 'bob', hairColor: 0x14100c, top: 'blazer', topColor: 0xb83a3a, top2: 0x2a2a2a, earrings: true}},
  burger3: {name: 'Meneer De Wit', title: 'heeft een vraag over zijn hond', model: {build: 'average', age: 'old', skin: 0xf0c8a8, eyes: 0x4a6a8a, hair: 'side', hairColor: 0xb8b8b8, glasses: 'round', top: 'blazer', topColor: 0x3a5a3a, top2: 0xe8e4dc, holdR: 'leash', idle: 'leash'}},
  waarom: {name: 'Vrouwe Waarom', title: 'hoedster van de Bron', color: '#9fc3ff', model: {build: 'slim', height: 1.3, skin: 0xbccfe4, eyes: 0x6ab8ff, brows: 'thin', hair: 'long', hairColor: 0xaac4e6, top: 'robe', topColor: 0x8a9ab8, top2: 0xd0dcee}},
  griffel: {name: 'Griffel', title: 'griffier van de Raadzaal van Niemand', model: {build: 'slim', height: 1.12, skin: 0xe2c2a2, eyes: 0x3a3a4a, nose: 'long', hair: 'short', hairColor: 0x2a2a2a, hat: 'quill', hatColor: 0x2a2440, glasses: 'round', top: 'robe', topColor: 0x2a2440, top2: 0x6a5a8a, holdR: 'book'}},
  vonk: {name: 'Vonk', title: 'aanjager van de adoptie', color: '#ffb84a', model: {kind: 'spark', color: 0xffb84a}},
  ans: {name: 'Ans', title: 'dertig jaar ervaring', model: {kind: 'spark', color: 0x9fb0ff}},
  joris: {name: 'Joris', title: 'net begonnen', model: {kind: 'spark', color: 0x9fffd0}},
  fatma: {name: 'Fatma', title: 'teamleider', model: {kind: 'spark', color: 0xff9fd8}},
  pieter: {name: 'Pieter', title: 'werkt in deeltijd', model: {kind: 'spark', color: 0xd8ff9f}},
  mallow: {name: 'Mallow', title: 'meester van de werkplaats', model: {build: 'round', height: 0.86, skin: 0xf0c8a0, eyes: 0x4a6a3a, hair: 'curly', hairColor: 0xd2aa6a, glasses: 'round', top: 'apron', topColor: 0x8a5a30, top2: 0x6a4a2a}},
  henk: {name: 'Henk', title: 'collega, vanaf morgen op vakantie', model: {build: 'average', skin: 0xf0c0a0, eyes: 0x3a5a7a, hair: 'short', hairColor: 0x6a4020, top: 'hawaii', topColor: 0xf07a2a, top2: 0xffe050, bottom: 'shorts', bottomColor: 0xd8c8a0, holdR: 'suitcase'}},
  wolk: {name: 'Wolk', title: 'verkoper van wolkenpoorten', color: '#cfe0ff', model: {kind: 'cloud', color: 0xdfe6f0}},
  wouter: {name: 'Wouter', title: 'brugwachter', model: {build: 'broad', skin: 0xd8a880, eyes: 0x3a2a1a, hair: 'short', hairColor: 0x6a4020, facialHair: 'full', hat: 'cap', hatColor: 0x4a3a2a, top: 'hivis', topColor: 0xff8a1a, top2: 0x6a4a2a}},
  mira: {name: 'Mira', title: 'meetmeester', model: {build: 'average', skin: 0x9a6038, eyes: 0x2a1a10, hair: 'bob', hairColor: 0x141010, top: 'blazer', topColor: 0xf0f0ee, top2: 0x4a6a8a, holdR: 'ruler'}},
  bep: {name: 'Bep', title: 'bibliothecaris van Bijna Waar', model: {build: 'average', age: 'old', skin: 0xf0d0b8, eyes: 0x4a3a5a, hair: 'bun', hairColor: 0xa0a0a4, glasses: 'round', glassesColor: 0x6a2a5a, top: 'cardigan', topColor: 0x6a2a5a, top2: 0xe8e0d0, holdR: 'book', idle: 'shush'}},
  noor: {name: 'Noor', title: 'loketkabouter', model: {kind: 'gnome', build: 'round', height: 0.7, skin: 0xf0c0a0, eyes: 0x3a5a7a, hair: 'short', hairColor: 0xf0f0f0, facialHair: 'full', facialHairColor: 0xf4f4f4, hat: 'beret', hatColor: 0xc04030, top: 'blazer', topColor: 0x3a6a4a, top2: 0xe8e0d0}},
  kees: {name: 'Kees', title: 'klokkenmaker van het afsprakenatelier', model: {build: 'slim', age: 'old', skin: 0xf0c8a8, eyes: 0x4a5a6a, hair: 'short', hairColor: 0xf2f2f2, brows: 'bushy', glasses: 'round', glassesColor: 0x8a6a3a, top: 'vest', topColor: 0x5a4a3a, top2: 0xe8e0d0}},
  bram: {name: 'Bram', title: 'postkobold', model: {kind: 'kobold', build: 'slim', height: 0.7, skin: 0x8ab060, hair: 'short', hairColor: 0x3a4a1a, hat: 'cap', hatColor: 0x2a4a8a, top: 'jumper', topColor: 0x7a8a3a}},
  sien: {name: 'Stoker Sien', title: 'bakt broodjes op de modelmachine', model: {build: 'average', skin: 0xf4d0b0, eyes: 0x4a6a3a, hair: 'bun', hairColor: 0xd06a28, freckles: true, top: 'apron', topColor: 0xe8dcc8, top2: 0xa84a2a, holdR: 'mug'}},
  otto: {name: 'Otto', title: 'archiefuil', model: {kind: 'owl', color: 0x8a6a4a, glasses: true, stamp: true}},
  slotje: {name: 'Slotje', title: 'boekenwachter', model: {kind: 'padlock', color: 0xc8a040}},
  linde: {name: 'Linde', title: 'hoedster van de Luisterzaal', model: {build: 'slim', skin: 0x7a4a2a, eyes: 0x2a1a10, hair: 'braids', hairColor: 0x141010, top: 'robe', topColor: 0x1e3a7a, top2: 0xc8a050, holdR: 'horn', earrings: true}},
  orakel: {name: 'Het Orakel', title: 'PraatPal Orakel™', color: '#ffd36b'},
  fabulant: {name: 'De Fabulant', title: 'die alles weet, of iets wat erop lijkt', color: '#c7a0ff'},
};
export const ALIASES = {bakker4: 'bakker', glans3: 'glans', ilse4: 'ilse', joop4: 'joop'};

// A grid of player looks: every hair style, a range of skin tones, ages, glasses, facial hair and tops.
const SKINS = [0xf6dcc8, 0xefc6a2, 0xe2b490, 0xc9915f, 0xa86c40, 0x8a5430, 0x6b3e22, 0x4a2a18];
const HAIRS = ['bald', 'buzz', 'short', 'side', 'slick', 'curly', 'afro', 'pixie', 'bob', 'long', 'ponytail', 'bun', 'braids', 'headscarf'];
const HAIR_COLS = [0x1a1410, 0x4a3222, 0x8a5a2a, 0xd8b060, 0xb0482a, 0x9a9aa2, 0xeeeeee, 0x2a3a8a];
const TOPS = ['blazer', 'cardigan', 'jumper', 'shirt', 'tshirt', 'hoodie', 'vest', 'dress', 'robe', 'apron', 'hawaii', 'hivis'];
const TOP_COLS = [0x2f4f7a, 0x7a2a3a, 0x3a6a4a, 0xe8e4dc, 0x4a4a52, 0xc8783a, 0x5a3a7a, 0x2a8a8a, 0x8a6a4a, 0xd04a5a, 0x6a8ab8, 0xffb020];
export const LOOK_GRID = [
  ...HAIRS.map((hair, i) => ({build: ['slim', 'average', 'broad', 'round'][i % 4], skin: SKINS[i % SKINS.length], hair, hairColor: HAIR_COLS[i % HAIR_COLS.length], scarfColor: 0x2a6a8a, eyes: [0x3a2a1a, 0x3a6a9a, 0x4a7a3a, 0x7a5a2a][i % 4], top: TOPS[i % TOPS.length], topColor: TOP_COLS[i % TOP_COLS.length], top2: 0xe8e4dc, age: ['young', 'adult', 'adult', 'old'][i % 4], label: hair})),
  ...['none', 'stubble', 'moustache', 'walrus', 'goatee', 'beard', 'full'].map((fh, i) => ({build: ['average', 'broad', 'slim', 'round'][i % 4], skin: SKINS[(i * 3 + 1) % SKINS.length], hair: ['short', 'buzz', 'side', 'bald', 'slick', 'curly', 'short'][i], hairColor: HAIR_COLS[(i * 2 + 1) % 6], facialHair: fh, top: TOPS[(i + 3) % TOPS.length], topColor: TOP_COLS[(i + 5) % TOP_COLS.length], age: i % 3 === 2 ? 'old' : 'adult', label: fh})),
  ...['round', 'square', 'half', 'shades'].map((gl, i) => ({skin: SKINS[(i * 2 + 2) % SKINS.length], hair: ['bob', 'pixie', 'bun', 'short'][i], hairColor: HAIR_COLS[(i + 2) % HAIR_COLS.length], glasses: gl, glassesColor: [0x2a2228, 0xc8202a, 0x8a6a3a, 0x18181e][i], top: ['cardigan', 'blazer', 'dress', 'tshirt'][i], topColor: TOP_COLS[(i + 2) % TOP_COLS.length], age: ['adult', 'young', 'old', 'adult'][i], label: gl})),
  ...['cap', 'beret', 'beanie', 'tophat', 'hood', 'quill', 'hardhat'].map((hat, i) => ({skin: SKINS[(i * 5 + 3) % SKINS.length], hair: ['short', 'long', 'curly', 'slick', 'short', 'bob', 'buzz'][i], hairColor: HAIR_COLS[(i + 4) % HAIR_COLS.length], hat, hatColor: [0x6a6a72, 0x2a4a8a, 0xc04a3a, 0x1e1c24, 0x5a3a7a, 0x2a2440, 0xf2c230][i], top: ['jumper', 'blazer', 'hoodie', 'vest', 'hoodie', 'robe', 'hivis'][i], topColor: TOP_COLS[(i + 7) % TOP_COLS.length], top2: 0x5a4a3a, label: hat})),
  ...[{label: 'oud + sproeten', age: 'old', freckles: true, blush: true, hair: 'bun', hairColor: 0xd8d8dc}, {label: 'oorbellen + sjaal', earrings: true, scarf: 0xc8402a, hair: 'pixie', hairColor: 0x2a1a10, skin: 0x8a5430}, {label: 'headset + keycord', headset: true, lanyard: true, hair: 'braids', hairColor: 0x1a1410, skin: 0x5a3420}, {label: 'jong + blos', age: 'young', blush: true, hair: 'curly', hairColor: 0xd8b060, freckles: true}, {label: 'non-binair, afro', hair: 'afro', hairColor: 0x7a3a8a, skin: 0x6b3e22, earrings: true, top: 'hoodie', topColor: 0x2a8a6a}, {label: 'hoofddoek + bril', hair: 'headscarf', scarfColor: 0x8a2a4a, glasses: 'round', skin: 0xc9915f, top: 'cardigan', topColor: 0x3a4a6a}].map(o => ({top: 'blazer', topColor: 0x2f4f7a, top2: 0xe8e4dc, ...o})),
];

async function main() {
  const {build} = await import('esbuild');
  const {SHOTS, launch} = await import('./_env.mjs');
  const src = path.resolve(here, '../../src');
  const entry = `
    import {CAST} from ${JSON.stringify(src + '/game/bus.js')};
    import {G} from ${JSON.stringify(src + '/game/state.js')};
    import * as PT from ${JSON.stringify(src + '/ui/portrait.js')};
    window.PT = PT; window.CAST = CAST; window.G = G;
  `;
  const res = await build({stdin: {contents: entry, resolveDir: here, loader: 'js'}, bundle: true, write: false, format: 'iife', target: ['es2022'], logLevel: 'warning'});
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const page0 = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#14100c;color:#f2e6cc;font:13px/1.3 system-ui,sans-serif}
    h2{font:600 18px Georgia,serif;color:#ffe2a6;margin:18px 0 8px}
    .row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
    figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;width:min-content}
    figcaption{font-size:11px;color:#b9aa8c;text-align:center;max-width:110px}
    .big canvas{width:288px;height:288px}.mid canvas{width:192px;height:192px}.small canvas{width:96px;height:96px}
    img.portrait{width:96px;height:96px}
  </style></head><body><script>${js}</script></body></html>`;
  const file = SHOTS + 'portraits-gallery.html';
  fs.writeFileSync(file, page0);
  const browser = await launch();
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 2});
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(pathToFileURL(file).href);
  const samples = JSON.parse(JSON.stringify(SAMPLES));
  const shot = async (name, html, fn, arg) => {
    await page.evaluate(([h, f, a, s, al]) => {
      document.body.querySelectorAll('section').forEach(e => e.remove());
      Object.assign(window.CAST, s);
      for (const [k, v] of Object.entries(al)) window.CAST[k] = window.CAST[v];
      const sec = document.createElement('section'); sec.innerHTML = h; document.body.append(sec);
      return new Function('arg', f)(a);
    }, [html, fn, arg, samples, ALIASES]);
    await page.waitForTimeout(150);
    const el = await page.$('section');
    await el.screenshot({path: `${SHOTS}portraits-${name}.png`});
  };
  const fig = (id, cls = 'small') => `<figure class="${cls}"><canvas data-s="${id}"></canvas><figcaption></figcaption></figure>`;
  // 1. every character of the bible, neutral, at 96 px and 288 px
  const ids = Object.keys(SAMPLES);
  await shot('cast-96', `<h2>Iedereen, neutraal · 96 px</h2><div class="row">${ids.map(id => fig(id)).join('')}</div>`, `
    for (const c of document.querySelectorAll('canvas[data-s]')) { window.PT.drawPortrait(c, c.dataset.s, {size: 96}); c.nextElementSibling.textContent = window.CAST[c.dataset.s]?.name || c.dataset.s; }`);
  for (let k = 0; k < ids.length; k += 8) {
    await shot(`cast-288-${k / 8 + 1}`, `<h2>Iedereen, neutraal · 288 px</h2><div class="row">${ids.slice(k, k + 8).map(id => fig(id, 'big')).join('')}</div>`, `
      for (const c of document.querySelectorAll('canvas[data-s]')) { window.PT.drawPortrait(c, c.dataset.s, {size: 96}); c.nextElementSibling.textContent = window.CAST[c.dataset.s]?.name || c.dataset.s; }`);
  }
  // 2. mood sheets
  for (const who of ['joop', 'glans', 'ilse', 'you', 'bakker', 'pip', 'otto', 'orakel', 'fabulant', 'wolk', 'vonk', 'waarom']) {
    await shot(`moods-${who}`, `<h2>Stemmingen · ${who}</h2><div class="row">${'x'.repeat(10).split('').map(() => `<figure class="mid"><canvas></canvas><figcaption></figcaption></figure>`).join('')}</div>`, `
      const M = window.PT.MOODS; [...document.querySelectorAll('canvas')].forEach((c, i) => { window.PT.drawPortrait(c, arg, {mood: M[i], size: 96}); c.nextElementSibling.textContent = M[i]; });`, who);
  }
  // 3. talking frames (mouth 0, 0.5, 1, blink half, blink closed)
  await shot('talk', `<h2>Praten en knipperen</h2>${['joop', 'glans', 'ilse', 'you', 'wethouder', 'pip'].map(w => `<div class="row" data-w="${w}">${[0, 1, 2, 3, 4].map(() => `<figure class="mid"><canvas></canvas><figcaption></figcaption></figure>`).join('')}</div>`).join('')}`, `
    const F = [[0, 0, 'mond dicht'], [0.5, 0, 'half open'], [1, 0, 'open'], [0, 0.5, 'knipper half'], [0, 1, 'ogen dicht']];
    for (const row of document.querySelectorAll('[data-w]')) [...row.querySelectorAll('canvas')].forEach((c, i) => { window.PT.drawPortrait(c, row.dataset.w, {mouth: F[i][0], blink: F[i][1], size: 96}); c.nextElementSibling.textContent = row.dataset.w + ' · ' + F[i][2]; });`);
  // 4. you, with each archetype (the badge on the frame) and a few creator looks
  await shot('hero', `<h2>Jij, per archetype</h2><div class="row">${'x'.repeat(5).split('').map(() => `<figure class="mid"><canvas></canvas><figcaption></figcaption></figure>`).join('')}</div>`, `
    const A = [[null, {}], ['handhaver', {build: 'broad', hair: 'buzz', skin: 0x8a5430, top: 'hivis', topColor: 0xffa020, top2: 0x3a3a44}], ['datatovenaar', {hair: 'long', hairColor: 0x2a1a10, glasses: 'round', top: 'robe', topColor: 0x2a3a8a, top2: 0xd8b050}], ['archivaris', {hair: 'bun', hairColor: 0xb0482a, top: 'cardigan', topColor: 0x3a6a4a, freckles: true}], ['verbinder', {hair: 'curly', hairColor: 0xd8b060, top: 'dress', topColor: 0xd04a5a, top2: 0xf2e8d8, skin: 0xc9915f}]];
    [...document.querySelectorAll('canvas')].forEach((c, i) => { window.G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: A[i][0], look: A[i][1]}; window.PT.drawPortrait(c, 'you', {size: 96}); c.nextElementSibling.textContent = A[i][0] || 'geen archetype'; });
    window.G.hero = null;`);
  // 5. player looks
  for (let k = 0; k < LOOK_GRID.length; k += 14) {
    await shot(`looks-${k / 14 + 1}`, `<h2>Spelerslooks</h2><div class="row">${LOOK_GRID.slice(k, k + 14).map(() => `<figure class="mid"><canvas></canvas><figcaption></figcaption></figure>`).join('')}</div>`, `
      [...document.querySelectorAll('canvas')].forEach((c, i) => { const L = arg[i]; window.PT.drawPortrait(c, L, {size: 96}); c.nextElementSibling.textContent = L.label; });`, LOOK_GRID.slice(k, k + 14));
  }
  // 6. the animator: while talking the mouth flaps and the eyes blink, after stopTalking it rests
  const anim = await page.evaluate(async () => {
    const PT = window.PT, c = document.createElement('canvas');
    c.style.cssText = 'width:192px;height:192px'; document.body.append(c);
    const seen = new Set(), sample = () => seen.add(c.toDataURL());
    PT.startTalking(c, 'joop', 'happy', {size: 96});
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50)); sample(); }
    const talking = seen.size;
    PT.stopTalking(c); await new Promise(r => setTimeout(r, 120));
    seen.clear();
    for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 30)); sample(); }
    const resting = seen.size;
    PT.hidePortrait(c); c.remove();
    return {talkingFrames: talking, restingFrames: resting};
  });
  console.log('[portraits animator]', JSON.stringify(anim));
  // 7. cost: one portrait, a cached frame, URL reuse, the alias, the animator
  const perf = await page.evaluate(([s, al]) => {
    const PT = window.PT;
    Object.assign(window.CAST, s);
    for (const [k, v] of Object.entries(al)) window.CAST[k] = window.CAST[v];
    PT.clearPortraitCache();
    const t = performance.now(); let n = 0;
    for (const id of Object.keys(s)) for (const m of PT.MOODS) { PT.renderPortrait(id, {mood: m}); n++; }
    const per = (performance.now() - t) / n;
    const u1 = PT.portraitURL('glans', 'smug'), u2 = PT.portraitURL('glans3', 'smug'), urls = PT.portraitStats.urls;
    const u3 = PT.portraitURL('glans', 'smug');
    const c = document.createElement('canvas'); document.body.append(c);
    const r0 = PT.portraitStats.renders;
    PT.startTalking(c, 'joop', 'happy');
    const t2 = performance.now(); for (let i = 0; i < 200; i++) PT.drawPortrait(c, 'joop', {mood: 'happy', mouth: i % 3 / 2}); const blit = (performance.now() - t2) / 200;
    PT.stopTalking(c); PT.hidePortrait(c);
    return {renderMs: +per.toFixed(3), portraits: n, sameUrlForAlias: u1 === u2, cachedUrl: u1 === u3, urlRenders: urls, framesForTalk: PT.portraitStats.renders - r0, cachedDrawMs: +blit.toFixed(4), urlBytes: u1.length, hasUI: typeof window.PT.portraitURL === 'function'};
  }, [samples, ALIASES]);
  console.log('[portraits]', JSON.stringify(perf));
  if (errs.length) console.log('[portraits errors]', errs.join('\n'));
  await browser.close();
}

// The portraits inside the real dialogue box: the game plus portrait.js bundled into a test page
// (the HUD itself does not show portraits yet), UI.dlgLine wrapped at runtime, a short scene played.
async function dialog() {
  const {build} = await import('esbuild');
  const {SHOTS, launch, devices} = await import('./_env.mjs');
  const src = path.resolve(here, '../../src');
  const entry = `
    import ${JSON.stringify(src + '/main.js')};
    import * as PT from ${JSON.stringify(src + '/ui/portrait.js')};
    import {UI, CAST} from ${JSON.stringify(src + '/game/bus.js')};
    window.PT = PT; window.UI_ = UI; window.CAST_ = CAST;
  `;
  const res = await build({stdin: {contents: entry, resolveDir: here, loader: 'js'}, bundle: true, write: false, format: 'iife', target: ['es2022'], define: {__DEV__: 'true'}, logLevel: 'warning'});
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const html = fs.readFileSync(path.resolve(here, '../../index.html'), 'utf8').replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
  const file = SHOTS + 'portraits-dialog.html';
  fs.writeFileSync(file, html);
  const browser = await launch();
  const lines = [['joop', 'Mijn opa zei altijd: een sleutel die niet piept, is een sleutel die je vergeten bent.', 'happy'], ['glans3', 'Goedemorgen! Ik ben Glans, van PraatPal. Heeft u even, of heeft u even heel veel?', 'smug'], ['ilse', 'Dit is mijn derde thee vandaag. Het is half tien.', 'tired'], ['you', 'Even voor de duidelijkheid: wat doet dat Orakel eigenlijk?', 'thinking'], ['bakker', 'Ik sta hier al sinds de vorige gemeenteraadsverkiezingen.', 'angry']];
  // software WebGL: keep the viewports small (see README.md)
  for (const [name, opts] of [['desktop', {viewport: {width: 960, height: 540}, deviceScaleFactor: 1}], ['phone', {viewport: {width: 667, height: 375}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}]].filter(([n]) => !process.env.ONLY || process.env.ONLY === n)) {
    const ctx = await browser.newContext(opts), page = await ctx.newPage(), errs = [];
    page.setDefaultTimeout(120000);
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(pathToFileURL(file).href + '?q=low');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('#titleBtns .go').click());
    // a few real frames for the backdrop, then freeze the 3D view: the loop still runs the HUD and the typewriter
    await page.waitForFunction(() => window.__orakel && window.__orakel.GAME.frames > 4, null, {timeout: 120000});
    await page.evaluate(async s => {
      const o = window.__orakel;
      o.GAME.noRender = true;
      for (let i = 0; i < 30 && o.DLG.active; i++) { document.getElementById('dialog').click(); await new Promise(r => setTimeout(r, 120)); }
      // the looks of the character bible (this sets the model on the shared cast entries, so aliases follow)
      for (const [id, c] of Object.entries(s)) if (window.CAST_[id] && c.model) window.CAST_[id].model = c.model;
    }, SAMPLES);
    // the integration the HUD lane will make: a canvas in the box, a face per line, talking while the text types
    await page.evaluate(() => {
      const css = document.createElement('style');
      css.textContent = '#dialog.has-portrait{padding-left:128px;min-height:124px}#dialog .dlg-portrait{position:absolute;left:16px;top:14px;width:96px;height:96px;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.5)}@media (max-height:500px){#dialog.has-portrait{padding-left:92px;min-height:88px}#dialog .dlg-portrait{left:10px;top:10px;width:72px;height:72px}}';
      document.head.append(css);
      const box = document.getElementById('dialog'), cv = document.createElement('canvas'), {PT, UI_: UI} = window, {DLG} = window.__orakel;
      cv.className = 'portrait dlg-portrait'; cv.setAttribute('aria-hidden', 'true'); box.prepend(cv);
      const line = UI.dlgLine, close = UI.dlgClose;
      UI.dlgLine = (sp, text, o) => { line(sp, text, o); const on = PT.hasPortrait(sp); box.classList.toggle('has-portrait', on); cv.hidden = !on; if (on) PT.startTalking(cv, sp, o.mood || 'neutral', {size: 96}); else PT.hidePortrait(cv); };
      UI.dlgClose = () => { close(); PT.hidePortrait(cv); box.classList.remove('has-portrait'); };
      (function watch() { if (!DLG.typing) PT.stopTalking(cv); requestAnimationFrame(watch); })();
    });
    await page.evaluate(ls => { const o = window.__orakel; o.scene(async () => { for (const [who, text, mood] of ls) await o.say(who, text, {mood}); }); }, lines);
    for (let i = 0; i < lines.length; i++) {
      await page.waitForTimeout(i === 0 ? 450 : 350);
      await page.screenshot({path: `${SHOTS}portraits-dialog-${name}-${i + 1}-typing.png`});
      await page.waitForTimeout(1900);
      await page.screenshot({path: `${SHOTS}portraits-dialog-${name}-${i + 1}.png`});
      await page.evaluate(() => { const d = document.getElementById('dialog'); if (window.__orakel.DLG.typing) d.click(); d.click(); });
    }
    console.log('[portraits dialog]', name, errs.length ? errs.join(' | ') : 'no errors');
    await ctx.close();
  }
  await browser.close();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'all';
  if (mode !== 'dialog') await main();
  if (mode !== 'gallery') await dialog();
}
