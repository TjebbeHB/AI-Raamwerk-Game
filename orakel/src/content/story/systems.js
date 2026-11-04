// Story systems: relationships, choices, secrets (with a secret sense), Kantoorvondsten, vergaderbingo,
// achievements, cosmetic unlocks, the people in the epilogue and two journal tabs (Geheimen, Mensen).
// The data lives in ../items.js and ../cast_extra.js; what goes where per depth is docs/inhoudsplan.md.
//
//   rel(npc, delta)            a relationship changes; shows 'Joop zal dit onthouden.' with their face
//   choice(id, {npc, label, text, pick}) / chose(id) / chose(id, pick)
//   findSecret(id), award(id), unlock(cosmeticId), notice(npc, text)
//   giveItem with a 'trinket:' or 'bingo:' id lands here through ON.afterItem (story/common.js)
//   archOpt(archetype, text): a dialogue option only that archetype sees
import {ON, UI, SFX, CAST, P, chamberState} from '../../game/bus.js';
import {G, SETTINGS, saveGame} from '../../game/state.js';
import {W, ent, FLOORS, parsed} from '../../game/world.js';
import {stage} from '../../game/quests.js';
import {MOD_SOURCES, invalidateMods, mod} from '../../game/mods.js';
import {unlockCosmetic, isArch, heroName} from '../../game/hero.js';
import {Sign, Obj, Npc, Item, Illusion, Chest, Lever, Coffee} from '../../game/entities.js';
import {giveItem} from '../../game/game.js';
import {JOURNAL_TABS} from '../../ui/menus.js';
import {SECRETS, TRINKETS, BINGO, BINGO_GRID, ACHIEVEMENTS, COSMETICS, CARDS, HALLUCS} from '../items.js';
import {REL_PEOPLE, baseId} from '../cast_extra.js';
import {CHAMBERS} from '../framework.js';
import {addStyles, el} from '../../core/util.js';

export {COSMETICS};
const later = (fn, ms) => setTimeout(fn, ms);

// registries for the journal, the summary and the ending (again in registerSystems, after common.js has run)
const registries = () => {
  Object.assign(ON, {secretList: SECRETS, trinketList: TRINKETS, bingoList: BINGO, achievementList: ACHIEVEMENTS, relList: REL_PEOPLE, cosmeticList: COSMETICS});
  ON.totals = {...ON.totals, secrets: SECRETS.length, trinkets: TRINKETS.length, bingo: BINGO.length, achievements: ACHIEVEMENTS.length};
};
registries();

// ---------------------------------------------------------------- archetype options in conversations
export const ARCH_NAME = {handhaver: 'Handhaver', datatovenaar: 'Datatovenaar', archivaris: 'Archivaris', verbinder: 'Verbinder'};
// archOpt(id, text, also): only for that archetype, and only while `also` holds
export const archOpt = (id, t, also = true) => ({t: `[${ARCH_NAME[id]}] ${t}`, if: isArch(id) && !!also, arch: id});

// ---------------------------------------------------------------- relationships
const REL = new Set(REL_PEOPLE.map(p => p.npc));
const nameOf = npc => CAST[npc]?.name || REL_PEOPLE.find(p => p.npc === npc)?.name || npc;
export const relOf = npc => G.rel[baseId(npc)] ?? 0;
export const met = npc => baseId(npc) in G.rel;
export function meet(npc) { const id = baseId(npc); if (!(id in G.rel)) G.rel[id] = 0; }
// delta > 0 warmer, < 0 cooler; a notice shows unless silent (text overrides 'X zal dit onthouden.')
export function rel(npc, delta = 0, {silent = false, text = null, mood = null} = {}) {
  const id = baseId(npc);
  G.rel[id] = (G.rel[id] ?? 0) + delta;
  if (delta && !silent) notice(id, text || `${nameOf(id)} zal dit onthouden.`, {mood: mood || (delta > 0 ? 'happy' : 'worried')});
  progress();
  return G.rel[id];
}
export const relLabel = v => (v >= 5 ? 'Dikke vrienden' : v >= 3 ? 'Warm' : v >= 1 ? 'Vriendelijk' : v <= -2 ? 'Koel' : v < 0 ? 'Afstandelijk' : 'Neutraal');

// ---------------------------------------------------------------- the notice: 'Joop zal dit onthouden.'
const NOTES = [];
let noteEl = null, noteBusy = false;
export function notice(npc, text, {mood = 'neutral', icon = null} = {}) {
  NOTES.push({npc, text, mood, icon});
  if (!noteBusy) nextNotice();
}
// a face for any person: their portrait when the portrait module is there, else their initial
export function face(npc, mood = 'neutral', cls = 'face') {
  const url = npc ? UI.portraitURL?.(baseId(npc), mood) : null;
  if (url) { const f = el('span', {class: cls}); f.style.backgroundImage = `url("${url}")`; return f; }
  const c = CAST[baseId(npc)], letter = nameOf(baseId(npc)).replace(/^(Mevrouw|Meneer|Vrouwe|Wethouder|Stoker|De) /, '').charAt(0) || '?';
  return el('span', {class: `${cls} none`, style: c?.color ? `color:${c.color}` : null, text: letter});
}
function nextNotice() {
  const n = NOTES.shift();
  if (!n || typeof document === 'undefined') { noteBusy = false; return; }
  noteBusy = true;
  if (!noteEl) { noteEl = el('div', {id: 'relnote', role: 'status', 'aria-live': 'polite'}); document.body.append(noteEl); }
  noteEl.replaceChildren(n.icon ? el('span', {class: 'face none', text: n.icon}) : face(n.npc, n.mood), el('span', {class: 'txt', text: n.text}));
  noteEl.classList.toggle('still', SETTINGS.motion === 'reduced');
  noteEl.classList.remove('on'); void noteEl.offsetWidth; noteEl.classList.add('on');
  SFX.play('pip');
  later(() => { noteEl.classList.remove('on'); later(nextNotice, 450); }, 2600 + Math.min(1600, n.text.length * 28));
}

// ---------------------------------------------------------------- choices
// One entry per id (the last one wins), for the summary and to branch later in the story.
export function choice(id, {npc = null, label = '', text = '', pick = null} = {}) {
  const entry = {id, npc: npc ? baseId(npc) : null, label, text, pick, at: Date.now(), floor: W.id || null};
  const i = G.choices.findIndex(c => c.id === id);
  if (i >= 0) G.choices[i] = entry; else G.choices.push(entry);
  if (entry.npc && REL.has(entry.npc)) meet(entry.npc);
  return entry;
}
// chose(id): the pick (or true), null if never chosen · chose(id, pick): was it this one?
export function chose(id, pick) {
  const c = G.choices.find(x => x.id === id);
  if (pick === undefined) return c ? (c.pick ?? true) : null;
  return !!c && c.pick === pick;
}

// ---------------------------------------------------------------- secrets
const SECRET = Object.fromEntries(SECRETS.map(s => [s.id, s]));
export const secretFound = id => G.secrets.includes(id);
export function findSecret(id) {
  const s = SECRET[id];
  if (!s) { console.warn('unknown secret', id); return false; }
  if (G.secrets.includes(id)) return false;
  G.secrets.push(id);
  SFX.play('crystal');
  UI.toast(`Geheim gevonden · ${G.secrets.length}/${SECRETS.length}`, s.name, 'secret');
  if (G.secrets.length === 1) later(() => UI.toast('Geheimen', 'Wat je vindt, staat in je dossier (J), onder Geheimen. Daar zie je ook hints voor de rest.', 'secret'), 1200);
  progress();
  saveGame();
  return true;
}
// Any map entity can carry `secret: '<id>'` in its legend: using, reading, taking or revealing it finds
// the secret. Wrapping the entity classes keeps entities.js unaware of the story systems.
function secretOn(Cls, method, ok = () => true) {
  const orig = Cls.prototype[method];
  Cls.prototype[method] = function (...args) {
    const r = orig.apply(this, args), id = this.def?.secret;
    if (id && !G.secrets.includes(id) && ok(this)) Promise.resolve(r).then(() => findSecret(id));
    return r;
  };
}
secretOn(Sign, 'interact'); secretOn(Obj, 'interact'); secretOn(Item, 'take'); secretOn(Illusion, 'reveal');
secretOn(Chest, 'interact', e => e.open); secretOn(Lever, 'interact'); secretOn(Coffee, 'interact');
// people: you have met them, and a secret person counts once the conversation is over
const npcInteract = Npc.prototype.interact;
Npc.prototype.interact = function () {
  const id = baseId(this.id), s = this.def?.secret;
  if (REL.has(id)) meet(id);
  npcInteract.call(this);
  if (s && !G.secrets.includes(s)) whenFree(() => findSecret(s));
};

// run something once the player is free again (no conversation, no open window)
const FREE = [];
export const whenFree = fn => { FREE.push(fn); };
ON.tick.push(() => { if (FREE.length) for (const fn of FREE.splice(0)) fn(); });

// The secret sense (De Archivaris, the wichelroede): an unfound secret within mod('secretSense') metres hums.
let spotsFor = null, spots = [];
function secretSpots() {
  if (spotsFor !== W.ents || spots.n !== W.ents.length) {
    spotsFor = W.ents; spots = []; spots.n = W.ents.length;
    for (const e of W.ents) if (e.def?.secret) spots.push({id: e.def.secret, e});
    for (const s of SECRETS) if (s.at && s.floor === W.id) { const e = ent(s.at); if (e) spots.push({id: s.id, e}); }
  }
  return spots;
}
const SENSE = {t: 0, cd: 0, told: new Set()};
ON.tick.push(dt => {
  SENSE.t -= dt; SENSE.cd -= dt;
  if (SENSE.t > 0) return;
  SENSE.t = 0.5;
  const r = mod('secretSense');
  if (!(r > 0) || SENSE.cd > 0) return;
  let best = null, bd = r;
  for (const s of secretSpots()) {
    if (G.secrets.includes(s.id) || SENSE.told.has(s.id) || s.e.visible === false) continue;
    const d = Math.hypot(s.e.x - P.x, s.e.z - P.z);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best) return;
  SENSE.told.add(best.id); SENSE.cd = 25;
  const line = senseLine(best.e);
  if (G.flags.pip) UI.pip(line); else UI.toast('Je voelt iets', line, 'secret');
});
function senseLine(e) {
  const dx = e.x - P.x, dz = e.z - P.z, side = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), front = -dx * Math.sin(P.yaw) - dz * Math.cos(P.yaw);
  const dir = front > Math.abs(side) ? 'recht voor je' : -front > Math.abs(side) ? 'achter je' : side > 0 ? 'rechts van je' : 'links van je';
  if (isArch('archivaris')) return `Je archivarisneus kriebelt. Ergens ${dir} ligt iets dat niet in de inventaris staat.`;
  if (G.trinkets.includes('wichelroede')) return `De wichelroede trilt in je tas. Er zit iets verborgen, ${dir}.`;
  return `Psst. Ik voel iets, ${dir}. Iets dat niet op de kaart staat.`;
}

// ---------------------------------------------------------------- Kantoorvondsten
const TRINKET = Object.fromEntries(TRINKETS.map(t => [t.id, t]));
for (const t of TRINKETS) MOD_SOURCES.push(g => ((g.trinkets || []).includes(t.id) ? t.mods : null));
export function giveTrinket(id) {
  if (!TRINKET[id] || G.trinkets.includes(id)) return false;
  G.trinkets.push(id);
  invalidateMods();
  if (G.trinkets.length === 1) later(() => UI.toast('Kantoorvondsten', 'Elke vondst maakt je net iets beter. Je ziet ze in je dossier (J), onder Geheimen.', 'quest'), 900);
  progress();
  return true;
}

// ---------------------------------------------------------------- vergaderbingo
const ROWS = [0, 1, 2].map(r => BINGO_GRID.slice(r * 3, r * 3 + 3));
export function markBingo(id) {
  if (!BINGO.some(b => b.id === id) || G.bingo.includes(id)) return false;
  G.bingo.push(id);
  SFX.play('quest');
  ROWS.forEach((row, r) => {
    if (G.flags[`bingo_rij${r}`] || !row.every(k => G.bingo.includes(k))) return;
    G.flags[`bingo_rij${r}`] = true; G.maxHp += 10; G.hp = Math.min(G.maxHp, G.hp + 10);
    later(() => { UI.toast('Bingo! Een volle rij', 'Je roept het zachtjes. Niemand kijkt op: het is tenslotte een overleg. Maximaal vertrouwen +10.', 'ach'); SFX.play('questDone'); }, 700);
  });
  if (G.bingo.length >= BINGO.length && !G.flags.bingo_vol) { G.flags.bingo_vol = true; later(() => giveItem('trinket:bingokaart'), 1600); }
  progress();
  return true;
}

// ---------------------------------------------------------------- achievements and cosmetics
const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const ACH_COSMETIC = {joop_vriend: 'joop_pet', alle_kaartjes: 'glans_das', bingo: 'bingo_hoed', belofte: 'bakker_paraplu', overdracht: 'henk_hawaii', koffie: 'mok', dossier: 'griffel_veer', geen_koffie: 'bhv_helm'};
export function award(id, {quiet = false} = {}) {
  const a = ACH[id];
  if (!a) { console.warn('unknown achievement', id); return false; }
  if (G.achievements.includes(id)) return false;
  G.achievements.push(id);
  if (!quiet) later(() => { UI.toast(`${a.icon} Prestatie · ${a.name}`, a.text, 'ach'); SFX.play('questDone'); }, 300);
  if (ACH_COSMETIC[id]) unlock(ACH_COSMETIC[id], {quiet});
  return true;
}
const COS = Object.fromEntries(COSMETICS.map(c => [c.id, c]));
// unlocked for good in this browser (hero.js); the flag remembers that this game earned it
export function unlock(id, {quiet = false} = {}) {
  const c = COS[id];
  if (!c || G.flags[`cosmetic:${id}`]) return false;
  G.flags[`cosmetic:${id}`] = true;
  if (!unlockCosmetic(id)) return false;
  if (!quiet) later(() => UI.toast('Nieuw voor je volgende personage', `${c.name}. Je vindt het voortaan in de personagemaker.`, 'ach'), 1100);
  return true;
}

let coffeeN = 0;
const coffeeTotal = () => coffeeN || (coffeeN = Object.keys(FLOORS).reduce((n, id) => n + parsed(id).entities.filter(e => e.type === 'coffee').length, 0));
const BRONNEN = CHAMBERS.reduce((n, c) => n + c.clues.length, 0);
// everything that follows from the state, checked after every find, choice and relationship change
function progress() {
  const has = id => G.secrets.includes(id);
  if (G.secrets.length) award('eerste_geheim');
  if (SECRETS.every(s => has(s.id))) award('alle_geheimen');
  if (SECRETS.filter(s => s.floor === 'f0').every(s => has(s.id))) unlock('directiebril');
  if (['opa_d1', 'opa_d2', 'opa_d3', 'opa_d4'].every(has)) award('opa');
  if (has('vijf_waaroms')) unlock('waarom_mantel');
  if (G.bingo.length >= BINGO.length) award('bingo');
  if (G.cards.length >= CARDS.length) award('alle_kaartjes');
  if (G.hallucs.length >= HALLUCS.length) award('pips_trots');
  if (G.bronnen.length >= BRONNEN) award('alle_bronnen');
  if (relOf('joop') >= 4) award('joop_vriend');
  if (Object.keys(G.keys).filter(k => k.startsWith('brug_')).length >= 9) unlock('wouter_hesje');
  if (G.coffee.length && G.coffee.length >= coffeeTotal()) award('koffie');
  // arcs that end on other depths: the story files set the state, the achievement follows by itself
  if (stage('bakker') >= 2 && (chose('bakker_belofte', 'belofte') || chose('bakker_belofte', 'stellig'))) award('belofte');
  if (chose('henk_overdracht', 'samen') || chose('henk_overdracht', 'opschrijven')) award('overdracht');
  if (G.flags.glans_hielp) award('ontglansd');
}
// a cheap look every two seconds while you walk around, so achievements pop up after a conversation
const PROG = {t: 2};
ON.tick.push(dt => { if ((PROG.t -= dt) <= 0) { PROG.t = 2; progress(); } });
// what the ending checks (called when the epilogue is written, and by the summary)
export function checkEndAchievements() {
  if (!G.stats.shortcut) award('geen_lift');
  if (!G.stats.deaths) award('geen_koffie');
  if (G.stats.kills < 30) award('pacifist');
  if (CHAMBERS.every(c => chamberState(c.id) === 'strong')) award('dossier');
  if ((G.verdict?.votes || []).some(n => n > 0) || Object.values(G.council || {}).some(t => (t?.ballots ?? 0) > 0)) award('samen');
  progress();
  saveGame();
}

// ---------------------------------------------------------------- hooks from common.js
export function onItem(id) {
  const [kind, a] = String(id).split(':');
  if (kind === 'trinket') giveTrinket(a);
  else if (kind === 'bingo') markBingo(a);
  if (id === 'halluc:3') G.flags.eend = true;     // the duck mayor waits in the town hall from now on
  progress();
}
export const onCoffee = () => progress();

// ---------------------------------------------------------------- the epilogue: what became of everyone
const P2 = (...parts) => parts.filter(Boolean).join(' ');
export function epilogueLines() {
  const out = [], r = relOf, name = heroName('');
  // Joop
  if (met('joop')) {
    const back = chose('joop_sleutelbos', 'teruggebracht'), promised = chose('joop_sleutelbos', 'belofte');
    out.push(P2(
      back ? 'Joop heeft zijn sleutelbos terug, na zesentwintig jaar. Hij rammelt er nu zo hard mee dat je hem twee gangen verderop hoort aankomen. Hij noemt dat een functie.'
        : promised ? 'Joop heeft nooit meer naar zijn sleutelbos gevraagd. Hij weet dat je het beloofd had. Hij is te aardig om het te zeggen.'
          : 'Joop is met pensioen. Hij komt nog elke maandag langs. ‘Voor de deuren.’',
      stage('sleutelbos') >= 2 ? 'Zijn oude archiefkamer is weer in gebruik. Hij zegt dat de lantaarn er beter brandt.' : '',
      r('joop') >= 4 ? 'Op zijn afscheid hield hij een speech van negen minuten. Acht daarvan gingen over zijn opa. De negende over jou.'
        : r('joop') < 0 ? 'Hij groet je nog altijd vriendelijk. Hij noemt je alleen nog steeds ‘de nieuwe’.' : ''));
  }
  // Ilse and the letter
  const brief = chose('ilse_brief');
  const ilse = {
    zelf: 'De afvalpasbrief die jij herschreef, past op één A4. Ilse heeft hem ingelijst, naast haar turflijst. De telefoon gaat een derde minder vaak.',
    inwoners: 'De nieuwe afvalpasbrief is samen met inwoners geschreven. Meneer Kok bedacht de eerste zin: ‘U krijgt een nieuwe pas. Zo werkt hij.’ De telefoon gaat een derde minder vaak.',
    orakel: 'Het Orakel herschreef de afvalpasbrief. De eerste versie verwees naar een loket op de maan. De tweede versie hebben Ilse en twee inwoners nagekeken. Die is goed.',
  }[brief] || (G.flags['heard:necessity:1'] ? 'De afvalpasbrief is herschreven. Hij past nu op één A4, en de telefoon gaat een derde minder vaak.'
    : met('ilse') ? 'Ilse heeft nog altijd zevenenveertig mensen in de wacht. Ze vraagt zich af of iemand ooit die brief gaat herschrijven.' : '');
  if (ilse) out.push(P2(ilse, r('ilse') >= 3 ? 'Ze drinkt haar thee tegenwoordig soms gewoon warm.' : ''));
  // Mevrouw Bakker: a promise kept or broken
  if (met('bakker')) {
    const helped = stage('bakker') >= 2, promised = chose('bakker_belofte', 'belofte') || chose('bakker_belofte', 'stellig');
    out.push(P2(
      helped && promised ? 'Mevrouw Bakker belde nog één keer: om te zeggen dat ze niet meer hoeft te bellen. Je had het beloofd, en ze heeft het opgeschreven. In haar agenda. Op papier.'
        : promised ? 'Mevrouw Bakker wacht nog op een mens. Ze heeft de wethouder een brief geschreven, met de hand. Drie kantjes. Op de tweede staat wat jij haar beloofde.'
          : helped && chose('bakker_belofte', 'eerlijk') ? 'Mevrouw Bakker heeft een mens gesproken. Je had niets beloofd, en toch kwam het goed. ‘Zo hoort het,’ zegt ze.'
            : helped ? 'Mevrouw Bakker belde nog één keer, om te zeggen dat ze niet meer hoeft te bellen.'
              : 'Mevrouw Bakker belt nog steeds. Ze kent de wachtmuziek inmiddels uit haar hoofd. Panfluit.',
      G.flags.bakker_kleinkinderen && helped ? 'Op zondag komen haar kleinkinderen. Met de auto. De vergunning is geldig.' : ''));
  }
  // Glans
  if (met('glans')) {
    out.push(P2(
      G.flags.glans_hielp ? 'Glans werkt nog bij PraatPal. Hij verkoopt nu begrensde pilots, met eigenaar, testset en stopcriteria. Ze verkopen slechter. Ze werken beter. Op zijn bureau staat een foto van jullie tweeën in de Kern. Hij noemt het ‘onze demo’.'
        : G.flags.glans_vrij ? (r('glans') >= 2 ? 'Glans werkt nog bij PraatPal. Hij verkoopt nu begrensde pilots, met eigenaar, testset en stopcriteria. Ze verkopen slechter. Ze werken beter.'
          : 'Glans verkoopt inmiddels PraatPal Orakel 2.0, ‘nu met grenzen!’. Hij heeft je er drie keer over gebeld. Je hebt drie keer niet opgenomen.')
          : 'Glans is uiteindelijk zelf uit zijn cocon gekomen. Hij praat er liever niet over.',
      G.stats.shortcut ? 'Op borrels vertelt hij nog steeds dat jij ooit bijna tekende.' : ''));
  }
  // the waiting room
  const hal = [];
  if (chose('kok', 'brood')) hal.push('Meneer Kok brengt Ilse nog elke week een brood. Sinds jij het eerste bracht, durft hij het zelf te geven.');
  else if (chose('kok', 'balie')) hal.push('Meneer Kok weet nu van de aparte balie voor formulieren. Hij vertelt het aan iedereen in de wachtrij. De wachtrij is een stuk korter.');
  else if (met('burger1')) hal.push('Meneer Kok werd die maandag om 16:42 geholpen. Hij had nog één brood over.');
  if (G.flags.sanne_stempel) hal.push(`Sanne heeft haar stempel en heeft het formulier ingelijst.${G.flags.stempelgate ? ' De groepsapp ‘Stempelgate’ is opgeheven.' : ''}`);
  else if (met('burger2')) hal.push('Sanne komt nog elke dinsdag voor haar stempeltje. Het is inmiddels een traditie.');
  const hond = {hond: 'Meneer De Wit heeft een hond genomen. Hij heet Paspoort.', eerst: 'Meneer De Wit heeft eerst uitgezocht wat een hond nodig heeft. Geen paspoort. Wel een mand. De mand is er al; de hond komt in het voorjaar.', kat: 'Meneer De Wit heeft een kat genomen. De kat heeft geen paspoort nodig, maar wil er wel een.'}[chose('dewit_hond')];
  if (hond) hal.push(hond); else if (met('burger3')) hal.push('Meneer De Wit loopt nog altijd met zijn lege hondenriem door Dalwijk. Mensen groeten hem. Hij groet terug, namens de hond.');
  if (hal.length) out.push(hal.join(' '));
  // colleagues
  const coll = [];
  if (G.flags.ingrid_zegen) coll.push('Ingrid van Communicatie geeft nu de workshop ‘Schrijven voor mensen’. De eerste was vol. De tweede ook.');
  if (G.secrets.includes('printer')) coll.push('Dirk heeft het ticket ‘printer doet het’ nog altijd openstaan. Hij durft hem niet te sluiten.');
  if (G.secrets.includes('stagiair')) coll.push('Daan, de verdwaalde stagiair, heeft een vaste aanstelling bij Innovatie. De afdeling bleek in de kelder te zitten. Hij heeft nu een raam. Het is geschilderd.');
  const kim = {besluit: 'Kim heeft haar eerste besluit genomen: ze stopt met kwartier maken. Ze is nu gewoon maker.', kwartier: 'Kim maakt nog steeds kwartier. Het programma dat het project voorbereidt, wordt inmiddels zelf voorbereid door een programma.'}[chose('kim_besluit')];
  if (kim) coll.push(kim);
  if (coll.length) out.push(coll.join(' '));
  // the Gewelf
  const henk = {samen: 'Henk kwam bruin terug van Texel en vond alles precies zoals jullie het samen hadden opgeschreven. Hij had een hele week niks te doen. Hij noemt het zijn beste week ooit.',
    opschrijven: 'Henk kwam terug van Texel. Zijn kantjes hadden het team door drie weken heen geholpen. Op zijn bureau lag maar één vraag: ‘Wat bedoel je met de knop?’',
    niet: 'Henk werd op Texel vier keer gebeld over ‘die ene knop’. Hij heeft sindsdien een tweede telefoon. Die staat altijd uit.'}[chose('henk_overdracht')];
  if (henk) out.push(henk);
  const keys = Object.keys(G.keys).filter(k => k.startsWith('brug_')).length;
  if (keys >= 9) out.push('Wouter heeft alle negen sleutels aan de muur van zijn brugwachtershuisje gehangen. Hij laat ze aan iedereen zien. ‘Allemaal van ons,’ zegt hij.');
  else if (G.flags.bridge_built && r('wouter') >= 2) out.push('Wouter bewaakt zijn brug nog steeds. Er gaan nu mensen over. En, belangrijker, ook weer terug.');
  if (G.secrets.includes('vijf_waaroms')) out.push('Vrouwe Waarom staat nog altijd bij de Bron. Sinds jouw bezoek stelt ze haar vraag iets zachter. Ze stelt hem nog steeds vijf keer.');
  if (G.secrets.includes('eend')) out.push('Er zit elke ochtend een eend bij de ingang van het stadhuis. Niemand weet van wie hij is. Hij is er altijd op tijd.');
  out.push(P2(`En Pip? Pip brandt op jouw bureau${name ? `, naast het naambordje van ${name}` : ''}. ‘Ik weet het niet zeker,’ zegt hij soms. ‘Vraag het even na.’`,
    r('pip') >= 3 ? 'Tegen bezoekers noemt hij je ‘mijn collega’.' : ''));
  return out;
}
// Wrap the floor's epilogue (story/f4.js): its own lines stay, the people lines come from here.
// Lines about people that f4.js wrote before these systems existed are dropped, so nothing doubles.
const LEGACY = /^(De afvalpasbrief is herschreven|Mevrouw Bakker belt nog één keer|Glans werkt nog bij PraatPal|Glans is uiteindelijk zelf|Joop heeft zijn oude archiefkamer|En Pip\?)/;
function installEpilogue() {
  const base = ON.epilogueExtra;
  if (base?.systems) return;
  const wrapped = () => {
    checkEndAchievements();
    const own = String(base?.() || '').split('\n\n').filter(p => p && !LEGACY.test(p));
    return [...own, ...epilogueLines()].join('\n\n');
  };
  wrapped.systems = true;
  ON.epilogueExtra = wrapped;
}

// ---------------------------------------------------------------- journal: Geheimen and Mensen
const DEPTH = {f0: 'Diepte 0', f1: 'Diepte 1', f2: 'Diepte 2', f3: 'Diepte 3', f4: 'Diepte 4'};
const visited = f => !f || f === 'f0' || G.flags[`seen:${f}`];
function renderSecrets(body) {
  const sec = (title, node) => body.append(el('h3', {class: 'label', style: 'margin:16px 0 8px', text: title}), node);
  body.append(el('p', {class: 'prose', style: 'margin-top:0;font-size:17px', text: 'Wat je onderweg vindt. Kantoorvondsten maken je net iets beter; de vergaderbingo geeft per volle rij meer vertrouwen; geheimen zijn er gewoon voor de lol.'}));
  // the bingo card
  const card = el('div', {class: 'bingocard'});
  for (const id of BINGO_GRID) {
    const b = BINGO.find(x => x.id === id), got = G.bingo.includes(id);
    card.append(el('div', {class: `bcell ${got ? 'got' : ''}`, title: got ? '' : `${DEPTH[b.floor]} · ${b.hint}`}, el('b', {text: b.word}), el('span', {text: got ? 'afgestreept' : DEPTH[b.floor]})));
  }
  sec(`Vergaderbingo · ${G.bingo.length}/${BINGO.length}`, card);
  // trinkets
  const tl = el('div', {class: 'bronlist'});
  for (const t of TRINKETS) {
    const got = G.trinkets.includes(t.id);
    tl.append(el('div', {class: `bron trinket ${got ? '' : 'locked'}`}, el('span', {class: 'ticon', text: got ? t.icon : '?'}),
      el('div', {}, el('b', {text: got ? t.name : 'Nog niet gevonden'}), el('p', {text: got ? `${t.effect}. ${t.text}` : t.floor ? DEPTH[t.floor] : 'Een beloning voor de volle bingokaart.'}))));
  }
  sec(`Kantoorvondsten · ${G.trinkets.length}/${TRINKETS.length}`, tl);
  // secrets
  const sl = el('div', {class: 'bronlist'});
  for (const s of SECRETS) {
    const got = G.secrets.includes(s.id);
    sl.append(el('div', {class: `bron secret ${got ? '' : 'locked'}`}, el('b', {text: got ? s.name : `??? · ${DEPTH[s.floor]}`}),
      el('p', {text: got ? s.text : visited(s.floor) ? s.hint : 'Daar ben je nog niet geweest.'})));
  }
  sec(`Geheimen · ${G.secrets.length}/${SECRETS.length}`, sl);
  // achievements
  const ag = el('div', {class: 'dgrid'});
  for (const a of ACHIEVEMENTS) {
    const got = G.achievements.includes(a.id);
    ag.append(el('div', {class: `dcell ach ${got ? 'got' : 'locked'}`}, el('b', {text: `${a.icon} ${a.name}`}), el('span', {style: 'font-family:var(--f-body);font-size:15px;line-height:1.35', text: a.text})));
  }
  sec(`Prestaties · ${G.achievements.length}/${ACHIEVEMENTS.length}`, ag);
  const cos = COSMETICS.filter(c => G.flags[`cosmetic:${c.id}`]);
  if (cos.length) body.append(el('p', {class: 'label', style: 'margin-top:12px;line-height:1.6', text: `Vrijgespeeld voor je volgende personage: ${cos.map(c => c.name).join(' · ')}`}));
}
function renderPeople(body) {
  const people = REL_PEOPLE.filter(p => met(p.npc));
  body.append(el('p', {class: 'prose', style: 'margin-top:0;font-size:17px', text: people.length ? 'De mensen die je hebt gesproken, en wat ze van je onthouden.' : 'Je hebt nog niemand echt gesproken. Begin bij Joop, aan het eind van de gang.'}));
  const list = el('div', {class: 'rellist'});
  for (const p of people) {
    const v = relOf(p.npc), c = CAST[p.npc], mine = G.choices.filter(x => x.npc === p.npc);
    list.append(el('div', {class: 'relcard'}, face(p.npc, v >= 3 ? 'happy' : v < 0 ? 'worried' : 'neutral', 'relface'),
      el('div', {class: 'relbody'},
        el('div', {class: 'relhead'}, el('b', {text: c?.name || p.name}), el('span', {class: 'reltitle', text: c?.title || ''})),
        el('div', {class: 'relrow'}, el('span', {class: 'relmeter'}, el('i', {style: `width:${Math.round(Math.max(0, Math.min(1, (v + 3) / 8)) * 100)}%`})), el('span', {class: `rellabel ${v < 0 ? 'cool' : v >= 3 ? 'warm' : ''}`, text: relLabel(v)})),
        mine.length ? el('ul', {}, mine.map(x => el('li', {}, el('b', {text: `${x.label}: `}), x.text))) : null)));
  }
  body.append(list);
}
// the journal (ui/menus.js) adds its own tabs at boot, after the content: put ours right after 'Vondsten'
const MY_TABS = [{id: 'geheimen', name: 'Geheimen', render: renderSecrets}, {id: 'mensen', name: 'Mensen', render: renderPeople}];
function placeTabs() {
  for (const t of MY_TABS) { const k = JOURNAL_TABS.indexOf(t); if (k >= 0) JOURNAL_TABS.splice(k, 1); }
  const i = JOURNAL_TABS.findIndex(x => x.id === 'finds');
  JOURNAL_TABS.splice(i >= 0 ? i + 1 : JOURNAL_TABS.length, 0, ...MY_TABS);
}

// ---------------------------------------------------------------- styles
addStyles('story-systems', `
#relnote{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));z-index:18;display:flex;align-items:center;gap:11px;max-width:min(470px,calc(100vw - 32px));padding:6px 18px 6px 6px;border-radius:999px;
  background:linear-gradient(90deg,rgba(20,14,8,.94),rgba(34,25,14,.88));border:1px solid rgba(232,194,122,.45);box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 0 4px rgba(232,194,122,.07);
  pointer-events:none;opacity:0;transform:translate(-50%,-12px);transition:opacity .4s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)}
#relnote.on{opacity:1;transform:translate(-50%,0)}
#relnote.still,#relnote.still.on{transform:translate(-50%,0);transition:opacity .3s linear}
#relnote .face{width:40px;height:40px;border-radius:50%;flex:none;background:#2a2016 center/cover no-repeat;border:2px solid rgba(232,194,122,.7);box-shadow:0 0 14px rgba(232,194,122,.3)}
#relnote .face.none{display:grid;place-items:center;font-family:var(--f-display);font-weight:700;font-size:19px;color:var(--gold-hi)}
#relnote .txt{font-family:var(--f-body);font-style:italic;font-size:18px;line-height:1.25;color:var(--parch);text-shadow:0 1px 2px #000}
@media (prefers-reduced-motion:reduce){#relnote,#relnote.on{transform:translate(-50%,0);transition:opacity .3s linear}}
@media (max-width:640px) and (min-height:501px){#relnote{top:auto;bottom:calc(46% + 10px)}}
@media (max-height:500px){#relnote{top:max(8px,env(safe-area-inset-top));padding:4px 14px 4px 4px;gap:8px}#relnote .face{width:30px;height:30px}#relnote .face.none{font-size:15px}#relnote .txt{font-size:15px}}
.toast.secret{border-left-color:#c7a0ff}.toast.secret b{color:#e6d8ff}
.toast.ach{border-left-color:#ffd36b;background:linear-gradient(90deg,rgba(74,54,16,.94),var(--panel) 70%)}
.bingocard{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:560px}
.bcell{min-height:74px;padding:9px 8px;border-radius:10px;border:1px dashed var(--line-strong);background:rgba(0,0,0,.22);display:grid;align-content:center;justify-items:center;gap:3px;text-align:center;position:relative;overflow:hidden}
.bcell b{font-family:var(--f-display);font-size:13px;line-height:1.2;color:var(--dim)}
.bcell span{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);opacity:.8}
.bcell.got{border:1px solid rgba(232,194,122,.6);background:rgba(232,194,122,.12)}
.bcell.got b{color:var(--gold-hi)}.bcell.got span{color:var(--good)}
.bcell.got::after{content:'';position:absolute;inset:auto -8px 6px auto;width:46px;height:46px;border-radius:50%;border:3px solid rgba(143,224,160,.55);transform:rotate(-14deg)}
.bron.trinket{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;cursor:default}
.bron.trinket .ticon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:21px;background:rgba(232,194,122,.12);border:1px solid rgba(232,194,122,.35)}
.bron.trinket b{color:var(--gold-hi)}.bron.secret{cursor:default}.bron.secret b{color:#e6d8ff}
.dcell.ach.locked{opacity:.42}.dcell.ach.got{border-color:rgba(232,194,122,.5)}.dcell.ach.got b{color:var(--gold-hi)}
.rellist{display:grid;gap:8px}
.relcard{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(0,0,0,.2)}
.relface{width:52px;height:52px;border-radius:12px;background:#2a2016 center/cover no-repeat;border:1px solid rgba(232,194,122,.45)}
.relface.none{display:grid;place-items:center;font-family:var(--f-display);font-weight:700;font-size:24px;color:var(--gold-hi)}
.relbody{display:grid;gap:4px;min-width:0}
.relhead b{font-family:var(--f-display);font-size:16px;color:var(--gold-hi);margin-right:8px}
.reltitle{font-size:12px;color:var(--dim)}
.relrow{display:flex;align-items:center;gap:10px}
.relmeter{flex:0 1 160px;height:6px;border-radius:4px;background:rgba(242,226,196,.12);overflow:hidden}
.relmeter i{display:block;height:100%;background:linear-gradient(90deg,#b0806a,var(--gold))}
.rellabel{font-size:12px;letter-spacing:.06em;color:var(--dim)}.rellabel.warm{color:var(--good)}.rellabel.cool{color:#9fc3ff}
.relbody ul{margin:2px 0 0;padding-left:18px;font-family:var(--f-body);font-size:15px;line-height:1.35;color:var(--parch)}
.relbody li b{font-family:var(--f-ui);font-size:12px;letter-spacing:.04em;color:var(--dim);font-weight:600}
@media (max-width:560px){.bcell{min-height:64px}.bcell b{font-size:12px}}
`);

// ---------------------------------------------------------------- set up (from content/index.js)
export function registerSystems() {
  registries();
  installEpilogue();
  W.onLoad.push(() => { invalidateMods(); spotsFor = null; placeTabs(); });
}
