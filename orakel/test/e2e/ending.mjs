// The ending, the end summary and the debrief, with a rich fake end state.
//   node scripts/build-orakel.mjs --dev && node orakel/test/e2e/ending.mjs
// Covers: per-role council chips in a decision and in the verdict panel, the council tally that
// is stored with each decision, the three ending tabs (keyboard, sticky header, no overflow) at
// 1280x800 and on a phone, the Markdown export, the print view and the Snelle Lift ending.
// Screenshots: shots/ending-*.png. Every check prints one line; the exit code is 1 when one fails.
// Env: ONLY=desktop,print,phone,plain,shortcut (default all), Q (query, default ?q=low).
import fs from 'node:fs';
import {devices, GAME_URL, SHOTS, launch} from './_env.mjs';

const Q = process.env.Q ?? '?q=low';
const ONLY = (process.env.ONLY || 'desktop,print,phone,plain,shortcut').split(',');
const results = [];
const check = (name, ok, info) => {
  results.push({name, ok: !!ok});
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info === undefined ? '' : ` · ${typeof info === 'string' ? info : JSON.stringify(info)}`}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const step = (...a) => { if (process.env.VERBOSE) console.log('....', ...a); };

// ---------------------------------------------------------------- in the page: a rich end state
function fakeRich() {
  const o = window.__orakel, G = o.G, ON = o.ON, NET = o.NET, C = o.CHAMBER;
  NET.roles = [
    {id: 'inwoner', name: 'Inwoner', icon: '🏠', color: '#9fe0b0'}, {id: 'jurist', name: 'Jurist', icon: '⚖️', color: '#b9a2ff'},
    {id: 'uitvoering', name: 'Uitvoering', icon: '🛠️', color: '#ffb84a'}, {id: 'it', name: 'IT', icon: '💻', color: '#9fc3ff'}, {id: 'bestuur', name: 'Bestuur', icon: '🏛️', color: '#ff9fd8'},
  ];
  const fit = id => C[id].options.flatMap((x, i) => (x.status === 'correct' ? [i] : []));
  const sup = id => C[id].options.flatMap((x, i) => (x.status === 'supporting' ? [i] : []));
  const bad = id => C[id].options.findIndex(x => x.status === 'incorrect');
  const mk = (id, sel) => {
    const c = C[id], s = [...new Set(sel)].sort((a, b) => a - b);
    const missing = c.options.flatMap((x, i) => (x.status === 'correct' && !s.includes(i) ? [i] : []));
    const unsuitable = s.filter(i => c.options[i].status === 'incorrect');
    return {selection: s, missing, unsuitable, complete: !missing.length && !unsuitable.length, at: Date.now()};
  };
  const plan = {
    necessity: [[...fit('necessity'), ...sup('necessity')]],
    governance: [fit('governance')],
    culture: [fit('culture').slice(1)],
    capacity: [[...fit('capacity'), bad('capacity')], fit('capacity')],
    infrastructure: [[...fit('infrastructure').slice(0, 2), bad('infrastructure')]],
    evaluation: [fit('evaluation')],
    quality: [[...fit('quality'), ...sup('quality')]],
    interaction: [fit('interaction').slice(0, 2)],
    functionality: [fit('functionality')],
    sovereignty: [fit('sovereignty')],
    ethics: [[bad('ethics')], fit('ethics')],
    compliance: [[...fit('compliance').slice(0, 1), ...sup('compliance')]],
  };
  G.chambers = {};
  for (const [id, tries] of Object.entries(plan)) G.chambers[id] = {attempts: tries.map(s => mk(id, s))};
  for (const id of ['necessity', 'governance', 'culture', 'capacity', 'evaluation', 'quality', 'interaction', 'ethics', 'functionality']) G.flags[`trial:${id}`] = true;
  // the council: five roles, seven advisors
  const roles = [['inwoner', 2], ['jurist', 1], ['uitvoering', 2], ['it', 1], ['bestuur', 1]];
  const vote = (id, pick) => {
    const n = C[id].options.length, counts = Array(n).fill(0), byRole = {};
    let ballots = 0;
    for (const [r, k] of roles) {
      const rc = Array(n).fill(0);
      for (let b = 0; b < k; b++) for (const i of new Set(pick(r, b).filter(i => i >= 0))) { rc[i]++; counts[i]++; }
      byRole[r] = {counts: rc, ballots: k}; ballots += k;
    }
    return {counts, ballots, byRole, roles: NET.roles.slice(), at: Date.now()};
  };
  const style = id => (r, b) => r === 'jurist' ? [...fit(id), ...sup(id)] : r === 'bestuur' ? [bad(id), fit(id)[0]] : r === 'it' ? fit(id).slice(0, -1) : r === 'inwoner' && b ? fit(id).slice(1) : fit(id);
  G.council = {};
  for (const id of ['necessity', 'governance', 'culture', 'infrastructure', 'quality', 'interaction', 'performance', 'ethics', 'security']) G.council[id] = vote(id, style(id));
  // you and how you played
  G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: 'datatovenaar', look: {}};
  Object.assign(G.stats, {time: 3020, kills: 58, deaths: 3, abilities: 14, damageTaken: 640, distance: 2875, talks: 64, revealed: 21, coffee: 6,
    floorTime: {f0: 410, f1: 1080, f2: 1290, f3: 1560, f4: 640},
    met: {joop: 6, ilse: 3, bakker: 4, glans: 6, waarom: 4, griffel: 2, vonk: 3, ans: 1, joris: 1, mallow: 2, henk: 1, wolk: 2, mira: 2, bep: 2, noor: 2, bram: 2, kees: 2, sien: 2, wouter: 3, linde: 2, otto: 2, slotje: 2, wethouder: 2, orakel: 1}});
  const all = Object.values(C).flatMap(c => c.clues.map(k => `${c.id}:${k.id}`));
  G.bronnen = all.filter((_, i) => i % 3 !== 2 || i < 6).slice(0, 33);
  G.hallucs = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  G.cards = ['1', '2', '3', '5', '8'];
  G.crystals = ['1', '2', '3'];
  G.quests.sleutelbos = 2;
  // the registries the story-systems lane fills (sample content)
  ON.secretList = [
    {id: 's1', name: 'De nietmachine van 1987', floor: 'f0', text: 'Achter de kopieermachine: een nietmachine met een eigen personeelsnummer.'},
    {id: 's2', name: 'Het geheime koffiepotje', floor: 'f1', text: 'Iemand spaart al twintig jaar voor een nieuwe automaat. Er zit 4,15 euro in.'},
    {id: 's3', name: 'De motie van wantrouwen tegen de lift', floor: 'f2', text: 'Unaniem aangenomen, nooit uitgevoerd.'},
    {id: 's4', name: 'Het vergeten organogram', floor: 'f2', text: 'Met een afdeling die alleen uit pijlen bestaat.'},
    {id: 's5', name: 'Pips dagboek', floor: 'f3', text: '‘Dag 4012. Weer niemand die vraagt hoe het met mij gaat.’'},
    {id: 's6', name: 'De laatste fax', floor: 'f3', text: 'Hij is nog steeds aan het versturen.'},
    {id: 's7', name: 'Het reservesleuteltje', floor: 'f4', text: 'Van de Snelle Lift. Glans weet niet dat het bestaat.'},
    {id: 's8', name: 'Een ingelijste stroopwafel', floor: 'f1', text: 'Van Joop. Uit 1998.'},
  ];
  G.secrets = ['s1', 's2', 's5', 's8'];
  ON.trinketList = [
    {id: 't1', name: 'De Gelukspen', icon: '🖊️', effect: 'Toetslamp 10% sterker', text: 'Hij schrijft alleen ja als je het meent.'},
    {id: 't2', name: 'Anti-stressbal van de OR', icon: '🟠', effect: '15% minder schade', text: 'Licht ingedeukt door eerdere reorganisaties.'},
    {id: 't3', name: 'Koffiekaart met negen stempels', icon: '☕', effect: 'Koffie herstelt meer', text: 'Nog één stempel en je krijgt een gratis kop.'},
    {id: 't4', name: 'De lanyard van de hackathon', icon: '🪪', effect: 'Je vindt sneller geheimen', text: 'Uit 2019. Thema: blockchain.'},
    {id: 't5', name: 'Een plakbriefje met wachtwoord', icon: '🟨', effect: 'Geen', text: 'Er staat ‘wachtwoord’ op. Je laat het liggen. Grapje, je neemt het mee voor de beveiliging.'},
    {id: 't6', name: 'De perforator van Bep', icon: '🕳️', effect: 'Zegel reikt verder', text: 'Twee gaatjes, altijd precies goed.'},
  ];
  G.trinkets = ['t1', 't3', 't6'];
  ON.bingoList = ['Even parkeren', 'Synergie', 'Quick win', 'Laaghangend fruit', 'Op de kaart zetten', 'Integraal', 'Stip op de horizon', 'In de lead', 'Meenemen in de afweging', 'Agile', 'Pilot', 'Eigenaarschap', 'Draagvlak', 'Terugkoppelen', 'Helikopterview', 'Afstemmen']
    .map((word, i) => ({id: `b${i}`, word}));
  G.bingo = ['b0', 'b1', 'b2', 'b3', 'b5', 'b9', 'b10', 'b13', 'b15'];
  ON.achievementList = [
    {id: 'a1', name: 'Eerste werkdag', icon: '☕', text: 'De brief van de wethouder gelezen.'},
    {id: 'a2', name: 'Licht in de kelder', icon: '🔦', text: 'De Toetslamp gevonden.'},
    {id: 'a3', name: 'Ongeglansd', icon: '✨', text: 'De Glimmende Demo verslagen.'},
    {id: 'a4', name: 'Bedenktijd', icon: '⏳', text: 'De Haastkoning van zijn troon gehaald.'},
    {id: 'a5', name: 'Zeven sleutels', icon: '🗝️', text: 'De brug over de kloof gebouwd.'},
    {id: 'a6', name: 'Lekdicht', icon: '🧪', text: 'De Lekkende Hydra verzegeld.'},
    {id: 'a7', name: 'Geen fabeltje', icon: '📜', text: 'De Fabulant verslagen.'},
    {id: 'a8', name: 'Mens aan de lijn', icon: '☎️', text: 'Mevrouw Bakker geholpen.'},
    {id: 'a9', name: 'Pacifist', icon: '🕊️', text: 'Een hele diepte zonder te vechten.'},
    {id: 'a10', name: 'Alle kaartjes', icon: '📇', text: 'Alle visitekaartjes van Glans.'},
  ];
  G.achievements = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
  ON.relList = [{npc: 'joop', name: 'Joop'}, {npc: 'ilse', name: 'Ilse'}, {npc: 'bakker', name: 'Mevrouw Bakker'}, {npc: 'glans', name: 'Glans'}, {npc: 'wethouder', name: 'Wethouder Hendriks'}, {npc: 'waarom', name: 'Vrouwe Waarom'}];
  G.rel = {joop: 4, ilse: 2, bakker: 3, glans: -2, wethouder: 1, waarom: 0};
  G.choices = [
    {id: 'c1', npc: 'joop', label: 'Het Gewelf', text: 'Je vroeg Joop wat het Gewelf eigenlijk is, in plaats van meteen de sleutel te pakken.', at: 1},
    {id: 'c2', npc: 'bakker', label: 'Een mens aan de lijn', text: 'Je beloofde mevrouw Bakker dat je zou uitzoeken wat er aan de hand is. Ze hield je eraan.', at: 2},
    {id: 'c3', npc: 'glans', label: 'Geen Snelle Lift', text: 'Je bedankte Glans vriendelijk voor zijn lift. Hij gaf je toch een kaartje.', at: 3},
    {id: 'c4', npc: 'griffel', label: 'De rollenkaart', text: 'Je drong bij Griffel aan op één eigenaar. Hij zette de zes stempels op een rij.', at: 4},
    {id: 'c5', npc: 'henk', label: 'Henks vakantie', text: 'Je liet Henk zijn kennis opschrijven voordat hij naar de camping vertrok.', at: 5},
    {id: 'c6', npc: 'linde', label: 'Wie je mist', text: 'Je vroeg Linde hoe het echt met haar ging. Ze liet je de brieven zien die niemand verstond.', at: 6},
  ];
  return JSON.stringify({strong: Object.keys(G.chambers).length, council: Object.keys(G.council).length});
}

// the verdict council: seven advisors, five roles
const VERDICT_TALLY = {id: 'verdict', counts: [1, 3, 2, 1], ballots: 7, byRole: {
  inwoner: {counts: [1, 1, 0, 0], ballots: 2}, jurist: {counts: [0, 1, 0, 0], ballots: 1}, uitvoering: {counts: [0, 0, 2, 0], ballots: 2}, it: {counts: [0, 0, 0, 1], ballots: 1}, bestuur: {counts: [0, 1, 0, 0], ballots: 1}}};

// ---------------------------------------------------------------- helpers
async function boot(page) {
  // software rendering on a busy machine can be slow: be patient rather than flaky
  page.setDefaultTimeout(+process.env.TIMEOUT || 120000);
  await page.goto(GAME_URL + Q);
  await page.waitForFunction(() => window.__orakel && !document.querySelector('#titleBtns .go')?.disabled, null, {timeout: 60000});
  step('title');
  await page.evaluate(() => document.querySelector('#titleBtns .go').click());
  await wait(1800);
  step('new game');
  await page.evaluate(async () => { await window.__orakel.run(3); });
  step('opening done');
}
// everything inside the ending that sticks out to the right (scrollers that may scroll are fine)
const overflow = () => {
  const W = innerWidth, out = [];
  for (const e of document.querySelectorAll('#ending *')) {
    if (e.closest('.endtabs, .dbfilters') && !e.matches('.endtabs, .dbfilters')) continue;
    const r = e.getBoundingClientRect();
    if (r.width && r.right > W + 1) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.right)}`);
  }
  const end = document.getElementById('ending');
  return {page: document.documentElement.scrollWidth > W, ending: end.scrollWidth > end.clientWidth + 1, items: out.slice(0, 8)};
};
async function tabShots(page, prefix, {scrolls = 3} = {}) {
  for (const id of ['epilogue', 'summary', 'debrief']) {
    await page.click(`#endtab-${id}`);
    await wait(500);
    step(prefix, id);
    const h = await page.evaluate(() => { const e = document.getElementById('ending'); e.scrollTop = 0; return e.scrollHeight; });
    const vh = page.viewportSize().height;
    for (let k = 0; k < scrolls && k * (vh - 80) < h; k++) {
      await page.evaluate(y => { document.getElementById('ending').scrollTop = y; }, k * (vh - 80));
      await wait(250);
      await page.screenshot({path: `${SHOTS}${prefix}-${id}-${k}.png`});
    }
    const of = await page.evaluate(overflow);
    check(`${prefix} ${id}: nothing sticks out`, !of.page && !of.ending && !of.items.length, of);
    await page.evaluate(() => { document.getElementById('ending').scrollTop = 0; });
  }
}
async function verdictFlow(page, {choice = 2, shots = null} = {}) {
  await page.evaluate(async () => {
    const o = window.__orakel;
    Object.assign(o.G.flags, {pip: true, godmode: true, fabulant_down: true, zegel_intro: true});
    Object.assign(o.G.tools, {lamp: true, scale: true, seal: true});
    o.setStage('main', 19, true);
    await o.travel('f4', 'from_f3');
    await new Promise(r => setTimeout(r, 1200));
    const t = o.W.byId.get('sealtable');
    o.teleport(t.tx, t.tz + 2, 0);
    await o.run(1);
    t.interact();
  });
  await page.waitForSelector('#decision:not([hidden])');
  await page.evaluate(t => { const N = window.__orakel.NET; N.active = true; N.tallies = t; N.onTally?.(); }, VERDICT_TALLY);
  await wait(300);
  if (shots) await page.screenshot({path: `${SHOTS}${shots}-verdict-panel.png`});
  check(`${shots || 'verdict'}: role chips in the verdict panel`, await page.evaluate(() => document.querySelectorAll('#decBody .optb .rchip').length >= 5 && !!document.querySelector('#decBody .rchips.legend')));
  await page.click(`#decBody .optb >> nth=${choice}`);
  await page.click('#decBar .go');
  await wait(400);
  await page.click('#decBar .go');          // 'Een jaar later…'
  await page.waitForSelector('#ending:not([hidden])');
  await wait(1500);
  const stored = await page.evaluate(() => window.__orakel.G.council.verdict);
  check(`${shots || 'verdict'}: the verdict tally is stored with roles`, stored && stored.ballots === 7 && stored.byRole?.jurist?.counts?.[1] === 1, stored && {ballots: stored.ballots, roles: stored.roles?.length});
}

// ---------------------------------------------------------------- 1. desktop
async function desktop(browser) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, acceptDownloads: true});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await boot(page);

  // a decision with the council voting per role
  await page.evaluate(() => { const o = window.__orakel; o.decide('interaction', {who: 'noor'}); });
  await page.waitForSelector('#decision:not([hidden])');
  await page.evaluate(() => {
    const N = window.__orakel.NET;
    N.active = true;
    N.roles = [{id: 'inwoner', name: 'Inwoner', icon: '🏠', color: '#9fe0b0'}, {id: 'jurist', name: 'Jurist', icon: '⚖️', color: '#b9a2ff'}, {id: 'uitvoering', name: 'Uitvoering', icon: '🛠️', color: '#ffb84a'}, {id: 'it', name: 'IT', icon: '💻', color: 0x9fc3ff}];
    N.tallies = {id: 'interaction', counts: [5, 1, 4, 2, 3], ballots: 6, byRole: {inwoner: {counts: [2, 1, 2, 1, 1], ballots: 2}, jurist: {counts: [1, 0, 1, 0, 1], ballots: 1}, uitvoering: {counts: [2, 0, 1, 1, 1], ballots: 2}, it: {counts: [0, 0, 0, 0, 0], ballots: 1}}};
    N.onTally?.();
  });
  await wait(300);
  await page.screenshot({path: `${SHOTS}ending-decision-chips.png`});
  check('decision: role chips per option and a legend', await page.evaluate(() => document.querySelectorAll('#decBody .optb .rchip').length === 12 && document.querySelectorAll('#decBody .rchips.legend .rchip').length === 4));
  await page.click('#decBody .optb >> nth=0');
  await page.click('#decBody .optb >> nth=2');
  await page.click('#decBar .go');
  await wait(300);
  await page.screenshot({path: `${SHOTS}ending-decision-result.png`});
  await page.click('#decBar .go');          // 'Verder'
  await wait(300);
  const kept = await page.evaluate(() => { const o = window.__orakel, s = o.G.council.interaction; o.NET.tallies.counts[0] = 99; o.NET.tallies.byRole.inwoner.counts[0] = 99; return s && {c0: s.counts[0], r0: s.byRole.inwoner.counts[0], ballots: s.ballots, roles: s.roles.map(r => r.id)}; });
  check('decision: the council tally is stored as a copy', kept && kept.c0 === 5 && kept.r0 === 2 && kept.ballots === 6 && kept.roles.length === 4, kept);
  await page.evaluate(() => { window.__orakel.NET.active = false; window.__orakel.NET.tallies = null; });

  // the rich end state, then the verdict
  console.log('state', await page.evaluate(fakeRich));
  await verdictFlow(page, {choice: 2, shots: 'ending-desk'});
  await page.screenshot({path: `${SHOTS}ending-desk-open.png`});

  // keyboard: focus lands on the tabs; arrows, Home/End, the number keys and Tab work
  const kb = [];
  kb.push(await page.evaluate(() => document.activeElement?.id));
  await page.keyboard.press('ArrowRight'); kb.push(await page.evaluate(() => document.activeElement?.id + '|' + document.querySelector('.endtab[aria-selected=true]').id));
  await page.keyboard.press('End'); kb.push(await page.evaluate(() => document.querySelector('.endtab[aria-selected=true]').id));
  await page.keyboard.press('Home'); kb.push(await page.evaluate(() => document.querySelector('.endtab[aria-selected=true]').id));
  await page.keyboard.press('Tab'); kb.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.className));
  await page.keyboard.press('Digit3'); kb.push(await page.evaluate(() => document.querySelector('.endtab[aria-selected=true]').id));
  await page.keyboard.press('Digit1');
  // a button in a panel that closes hands the focus to the new tab
  await page.focus('.endnext-b');
  await page.keyboard.press('Enter');
  kb.push(await page.evaluate(() => document.activeElement?.id + '|' + document.querySelector('.endtab[aria-selected=true]').id));
  await page.keyboard.press('Tab'); kb.push(await page.evaluate(() => document.activeElement?.id));
  await page.keyboard.press('Digit1');
  check('ending: keyboard', kb[0] === 'endtab-epilogue' && kb[1] === 'endtab-summary|endtab-summary' && kb[2] === 'endtab-debrief' && kb[3] === 'endtab-epilogue' && kb[4] === 'endpanel-epilogue' && kb[5] === 'endtab-debrief'
    && kb[6] === 'endtab-summary|endtab-summary' && kb[7] === 'endpanel-summary', kb);

  await tabShots(page, 'ending-desk', {scrolls: 6});
  // the header sticks while scrolling
  await page.click('#endtab-debrief');
  const sticky = await page.evaluate(async () => { const e = document.getElementById('ending'); e.scrollTop = 2400; await new Promise(r => setTimeout(r, 200)); return Math.round(document.querySelector('.endhead').getBoundingClientRect().top); });
  check('ending: the tab header is sticky', sticky === 0, sticky);
  // debrief contents and filters
  const deb = await page.evaluate(() => ({
    cards: document.querySelectorAll('#endpanel-debrief .dbc').length,
    questions: [...document.querySelectorAll('#endpanel-debrief .dbc')].every(c => c.querySelectorAll('.qs li').length >= 2 && c.querySelector('.own')),
    chips: document.querySelectorAll('#endpanel-debrief .dbc .rchip').length,
    counts: Object.fromEntries([...document.querySelectorAll('.dbf')].map(b => [b.dataset.f, +b.querySelector('.cnt').textContent])),
  }));
  check('debrief: 15 chambers with questions, a prompt and role chips', deb.cards === 15 && deb.questions && deb.chips > 20, deb);
  for (const f of ['open', 'blind', 'differ']) {
    await page.click(`.dbf[data-f=${f}]`);
    await wait(250);
    const n = await page.evaluate(() => document.querySelectorAll('#endpanel-debrief .dbc').length);
    check(`debrief: filter ${f}`, n === deb.counts[f] && n > 0, {n, expected: deb.counts[f]});
    await page.evaluate(() => { document.getElementById('ending').scrollTop = document.querySelector('.dbkh').offsetTop - 70; });
    await wait(200);
    await page.screenshot({path: `${SHOTS}ending-desk-filter-${f}.png`});
  }
  await page.click('.dbf[data-f=all]');
  // the summary
  const sum = await page.evaluate(() => ({
    title: document.querySelector('.sumtitle')?.textContent,
    sections: [...document.querySelectorAll('#endpanel-summary .sumh')].map(h => h.textContent),
    depths: document.querySelectorAll('.drow').length, choices: document.querySelectorAll('.ch').length, rels: document.querySelectorAll('.rel').length,
    faces: document.querySelectorAll('.facewall .fw').length, bingo: document.querySelectorAll('.bw').length, achs: document.querySelectorAll('.ach').length,
  }));
  check('summary: title, sections and lists', sum.title && sum.depths === 5 && sum.choices === 6 && sum.rels === 6 && sum.faces >= 20 && sum.bingo === 16 && sum.achs === 10, sum);

  // the Markdown export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.endfoot .btn >> text=Download')]);
  const md = fs.readFileSync(await dl.path(), 'utf8');
  fs.writeFileSync(`${SHOTS}ending-report.md`, md);
  check('report: summary, council and questions', ['## Jouw afdaling', '**Speelstijl:', '## Nabespreking', '### Over het besluit', 'Gespreksvragen:', 'Voor je eigen organisatie:', 'Adviesraad (7 stemmen)', 'Jurist', '### Jouw keuzes', '### Relaties'].every(s => md.includes(s)), {bytes: md.length, file: dl.suggestedFilename()});

  check('desktop: no page errors', !errs.length, errs.slice(0, 5));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. print: only the open tab, on white, as A4
async function print(browser) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await boot(page);
  await page.evaluate(fakeRich);
  await page.evaluate(t => { window.__orakel.G.council.verdict = {...t, roles: window.__orakel.NET.roles}; }, VERDICT_TALLY);
  await autoVerdict(page, 2);
  await page.click('#endtab-debrief');
  await page.emulateMedia({media: 'print'});
  const pr = await page.evaluate(() => ({bg: getComputedStyle(document.body).backgroundColor, head: getComputedStyle(document.querySelector('.endhead')).display, stage: getComputedStyle(document.getElementById('stage')).display,
    filters: getComputedStyle(document.querySelector('.dbfilters')).display, scheme: getComputedStyle(document.documentElement).colorScheme}));
  check('print: white page without the game, the header or the filters', pr.head === 'none' && pr.stage === 'none' && pr.filters === 'none' && /255, 255, 255/.test(pr.bg), pr);
  await page.pdf({path: `${SHOTS}ending-debrief.pdf`, format: 'A4', printBackground: true});
  await page.emulateMedia({media: 'screen'});
  await page.click('#endtab-summary');
  await page.emulateMedia({media: 'print'});
  await page.pdf({path: `${SHOTS}ending-summary.pdf`, format: 'A4', printBackground: true});
  await page.emulateMedia({media: 'screen'});
  check('print: no page errors', !errs.length, errs.slice(0, 5));
  await ctx.close();
}
async function autoVerdict(page, choice) {
  await page.evaluate(async c => {
    const o = window.__orakel;
    o.autoVerdict = c;
    Object.assign(o.G.flags, {pip: true, godmode: true, fabulant_down: true, zegel_intro: true});
    o.setStage('main', 19, true);
    await o.travel('f4', 'from_f3');
    await new Promise(r => setTimeout(r, 1200));
    const t = o.W.byId.get('sealtable');
    o.teleport(t.tx, t.tz + 2, 0);
    await o.run(1);
    t.interact();
  }, choice);
  await page.waitForSelector('#ending:not([hidden])');
  await wait(1500);
}

// ---------------------------------------------------------------- 3. phone
async function phone(browser) {
  const ctx = await browser.newContext({...devices['iPhone 13'], deviceScaleFactor: 2, acceptDownloads: true});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await boot(page);
  await page.evaluate(fakeRich);
  await verdictFlow(page, {choice: 1, shots: 'ending-phone'});
  await tabShots(page, 'ending-phone', {scrolls: 5});
  const tabs = await page.evaluate(() => { const t = document.querySelector('.endtabs'); return {scroll: t.scrollWidth, client: t.clientWidth, overflowX: getComputedStyle(t).overflowX}; });
  check('phone: the tabs scroll sideways when they do not fit', tabs.overflowX === 'auto', tabs);
  await page.click('#endtab-debrief');
  await page.click('.dbf[data-f=differ]');
  await wait(300);
  await page.evaluate(() => { document.getElementById('ending').scrollTop = document.querySelector('.dbkh').offsetTop - 60; });
  await wait(200);
  await page.screenshot({path: `${SHOTS}ending-phone-differ.png`});
  // held sideways
  await page.setViewportSize({width: 844, height: 390});
  await wait(400);
  for (const id of ['summary', 'debrief']) {
    await page.click(`#endtab-${id}`);
    await wait(400);
    await page.screenshot({path: `${SHOTS}ending-phone-landscape-${id}.png`});
    const of = await page.evaluate(overflow);
    check(`phone sideways ${id}: nothing sticks out`, !of.page && !of.ending && !of.items.length, of);
  }
  check('phone: no page errors', !errs.length, errs.slice(0, 5));
  await ctx.close();
}

// ---------------------------------------------------------------- 4. an old save: no council, no registries, no hero
async function plain(browser) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await boot(page);
  step('plain: booted');
  await page.evaluate(async () => {
    const o = window.__orakel;
    o.autoDecide = 'best';
    for (const id of ['necessity', 'governance', 'culture', 'capacity', 'infrastructure', 'evaluation', 'ethics']) await o.decide(id);
    o.autoDecide = 'mixed';
    for (const id of ['quality', 'interaction']) await o.decide(id);
    o.autoDecide = null;
    o.G.stats = {time: 2400, kills: 12, deaths: 1, steps: 300, shortcut: 0, revealed: 4};   // a save from before this version
  });
  step('plain: state set');
  await autoVerdict(page, 'ceiling');
  step('plain: ending open');
  await tabShots(page, 'ending-plain', {scrolls: 3});
  const st = await page.evaluate(() => ({
    sections: [...document.querySelectorAll('#endpanel-summary .sumh')].map(h => h.textContent),
    chips: document.querySelectorAll('#ending .rchip').length, council: document.querySelectorAll('#endpanel-debrief .oc, #endpanel-debrief .vcouncil').length,
    rest: !!document.querySelector('.drow.rest'), title: document.querySelector('.sumtitle')?.textContent,
  }));
  check('plain: sections only when there is something to show', !st.sections.includes('Mensen') && !st.sections.includes('Prestaties') && !st.sections.includes('Jouw keuzes') && st.sections.includes('Het dossier'), st);
  check('plain: no council anywhere', st.chips === 0 && st.council === 0, st);
  await page.click('#endtab-debrief');
  await page.click('.dbf[data-f=differ]');
  const msg = await page.evaluate(() => document.querySelector('.dbempty')?.textContent || '');
  check('plain: the council filter explains that nobody voted', /geen adviesraad/i.test(msg), msg.slice(0, 60));
  check('plain: no page errors', !errs.length, errs.slice(0, 5));
  await ctx.close();
}

// ---------------------------------------------------------------- 5. the Snelle Lift
async function shortcut(browser) {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, acceptDownloads: true});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await boot(page);
  await page.evaluate(async () => {
    const o = window.__orakel, g = o.W.ents.find(e => e.id === 'glans');
    o.teleport(g.tx, g.tz + 1, 0);
    await o.run(0.5);
    g.interact();
    await o.run(14, {choices: [0, 0]});
  });
  await page.waitForSelector('#ending:not([hidden])');
  await wait(1200);
  const st = await page.evaluate(() => ({title: document.querySelector('#endpanel-epilogue h1')?.textContent, tab: document.querySelector('.endtab[aria-selected=true] .tn')?.textContent, talks: window.__orakel.G.stats.talks, met: window.__orakel.G.stats.met}));
  check('shortcut: the Snelle Lift ending opens on its epilogue', st.title === 'De Snelle Lift' && st.tab === 'Zes weken later', st);
  check('stats: the conversation with Glans is counted', st.talks >= 1 && st.met?.glans >= 1, {talks: st.talks, met: st.met});
  await tabShots(page, 'ending-lift', {scrolls: 2});
  const lift = await page.evaluate(() => ({title: document.querySelector('.sumtitle')?.textContent, blind: document.querySelectorAll('#endpanel-debrief .dbc.blind').length, lift: !!document.querySelector('.dbverdict.lift')}));
  check('shortcut: summary title and an all-blind debrief', lift.title === 'Snelle Beslisser' && lift.blind === 15 && lift.lift, lift);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.endfoot .btn >> text=Download')]);
  const md = fs.readFileSync(await dl.path(), 'utf8');
  check('shortcut: the report tells about the Snelle Lift', md.includes('De Snelle Lift') && md.includes('### Over de Snelle Lift') && dl.suggestedFilename() === 'nabespreking-dalwijk.md', dl.suggestedFilename());
  // 'Terug naar maandagochtend' still works
  await page.click('.endfoot .go');
  await wait(2500);
  const back = await page.evaluate(() => ({mode: window.__orakel.GAME.mode, ending: document.getElementById('ending').hidden, hud: document.getElementById('hud').hidden}));
  check('shortcut: back to Monday morning', back.mode === 'play' && back.ending && !back.hud, back);
  await page.screenshot({path: `${SHOTS}ending-lift-back.png`});
  check('shortcut: no page errors', !errs.length, errs.slice(0, 5));
  await ctx.close();
}

// Every scenario runs on its own; a renderer that crashes (software WebGL on a busy machine)
// gets one more try before the scenario counts as failed.
const SCENARIOS = {desktop, print, phone, plain, shortcut};
const browser = await launch();
for (const [name, fn] of Object.entries(SCENARIOS)) {
  if (!ONLY.includes(name)) continue;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const mark = results.length;
    try { await fn(browser); break; } catch (e) {
      for (const c of browser.contexts()) await c.close().catch(() => {});
      const crashed = /crash/i.test(e.message);
      if (crashed && attempt === 1) { results.length = mark; console.log(`.... ${name}: the page crashed, trying once more`); continue; }
      check(`${name} ran to the end`, false, e.message.split('\n')[0]);
      break;
    }
  }
}
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
