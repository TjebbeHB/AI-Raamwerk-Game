// The controls card: every action with the keys it has right now (core/keys.js, so a remap shows up
// here too), in four groups, with a version for touch screens. Opens over whatever is on screen
// (the pause menu, the practice room) and pauses the game when it opens during play.
//
//   controlsCard()            opens it (registered as UI.controlsCard by content/story/tutorial.js)
//   controlsCard({touch})     force the keyboard (false) or the touch (true) version
//   kc(code) / ka(action)     key caps as HTML, for other UI that explains keys
import {ACTIONS, codesFor, codeLabel, keyLabel} from '../core/keys.js';
import {el, esc, addStyles, IS_TOUCH} from '../core/util.js';
import {SFX} from '../game/bus.js';
import {GAME} from '../game/game.js';
import {lock} from '../core/input.js';
import {unlockForUi} from '../game/dialogue.js';
import {archetype} from '../game/hero.js';
import {SETTINGS} from '../game/state.js';

// what each archetype's special ability does (the ability itself lives with the archetypes)
export const ABILITIES = {
  handhaver: {name: 'Last onder dwangsom', text: 'Je stampt op de grond: een schokgolf die monsters even verdoofd laat staan.'},
  datatovenaar: {name: 'Steekproef', text: 'Vijf lichtschichten die zelf hun doel zoeken.'},
  archivaris: {name: 'Ordnerval', text: 'Een loodzware ordner valt uit de lucht en houdt monsters op hun plek.'},
  verbinder: {name: 'Koffie voor iedereen', text: 'Je deelt koffie uit: je herstelt vertrouwen en monsters om je heen worden rustig.'},
};
export const ARCH_LABEL = {handhaver: 'Handhaver', datatovenaar: 'Datatovenaar', archivaris: 'Archivaris', verbinder: 'Verbinder'};

// key caps: every key an action has (main key first), without doubles (Shift left and right are one cap)
export const kc = code => `<kbd>${esc(codeLabel(code))}</kbd>`;
export function capsFor(action) {
  const labels = [...new Set(codesFor(action).map(codeLabel))];
  return labels.map(l => `<kbd>${esc(l)}</kbd>`).join('');
}
// just the main key of an action, as one cap
export const ka = action => `<kbd>${esc(keyLabel(action))}</kbd>`;

const KEY_GROUPS = [
  {title: 'Lopen en kijken', icon: '👣', rows: [
    {acts: ['forward', 'left', 'back', 'right'], text: 'Lopen: vooruit, opzij en achteruit'},
    {acts: ['run'], text: () => (SETTINGS.runToggle ? 'Rennen (één keer drukken; nog een keer is weer wandelen)' : 'Rennen (ingedrukt houden terwijl je loopt)')},
    {acts: ['dash']},
    {caps: ['muis'], text: 'Rondkijken (klik eerst een keer in de wereld)'},
    {acts: ['turnLeft', 'turnRight'], text: 'Draaien zonder muis'},
    {acts: ['camera'], text: 'Eerste of derde persoon'},
    {caps: ['scrollwiel'], text: 'Inzoomen en uitzoomen (derde persoon)'},
  ]},
  {title: 'Praten en gebruiken', icon: '💬', rows: [
    {acts: ['interact']},
    {caps: ['1', '2', '3'], text: 'In een gesprek: een antwoord kiezen (of klik erop)'},
    {caps: ['E', 'Spatie', 'Enter'], text: 'In een gesprek: verder'},
  ]},
  {title: 'Gereedschap', icon: '🔦', rows: [
    {caps: ['klik'], text: 'Het gekozen gereedschap gebruiken (ingedrukt houden: de lamp blijft schieten)'},
    {acts: ['tool1'], text: 'Toetslamp: een lichtschot op afstand'},
    {acts: ['tool2'], text: 'Weegschaal: een golf rondom je die vertraagt'},
    {acts: ['tool3'], text: 'Zegel: een stevige stempel van dichtbij'},
    {acts: ['cycle']},
    {acts: ['reveal'], text: 'Onthullen wat niet echt is (ook met de rechtermuisknop)'},
    {acts: ['ability'], text: () => { const a = ABILITIES[archetype()]; return a ? `Speciale vaardigheid: ${a.name}` : 'Speciale vaardigheid (als je personage er een heeft)'; }},
  ]},
  {title: 'Overzicht', icon: '🗺', rows: [
    {acts: ['journal'], text: 'Dossier en opdrachten'},
    {acts: ['map'], text: 'Kaart (klik op een koffiehoek om erheen te reizen)'},
    {acts: ['hint']},
    {acts: ['menu'], text: 'Menu en pauze (en de muis vrij maken)'},
  ]},
];
const TOUCH_GROUPS = [
  {title: 'Lopen en kijken', icon: '👣', rows: [
    {caps: ['stick'], text: 'Linksonder: duw de stick waar je heen wilt. Helemaal naar de rand is rennen.'},
    {caps: ['slepen'], text: 'Sleep met je vinger over de rechterkant van het scherm om rond te kijken.'},
    {caps: ['»'], text: 'Wegduiken, ook over een smalle kloof.'},
    {caps: ['👁'], text: 'Rechtsboven: eerste of derde persoon.'},
  ]},
  {title: 'Praten en gebruiken', icon: '💬', rows: [
    {caps: ['E'], text: 'Praten, lezen, oppakken, gebruiken.'},
    {caps: ['tik'], text: 'Tik op een antwoord om het te kiezen, of op de tekst om verder te gaan.'},
  ]},
  {title: 'Gereedschap', icon: '🔦', rows: [
    {caps: ['✦'], text: 'Het gekozen gereedschap gebruiken. Ingedrukt houden: de lamp blijft schieten.'},
    {caps: ['🔦', '⚖️', '🔏'], text: 'Onderin: tik op een gereedschap om het te kiezen.'},
    {caps: ['☀'], text: 'Onthullen wat niet echt is.'},
  ]},
  {title: 'Overzicht', icon: '🗺', rows: [
    {caps: ['❦'], text: 'Rechtsboven: dossier en opdrachten.'},
    {caps: ['◈'], text: 'De kaart. Tikken op de kleine kaart werkt ook.'},
    {caps: ['☰'], text: 'Menu en pauze.'},
  ]},
];

addStyles('controls', `
#ctlCard{z-index:26}
#ctlCard .sheet{width:min(940px,100%)}
#ctlCard header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#ctlCard header h2{flex:1;min-width:160px}
#ctlCard .body{overflow:auto;padding:4px 18px 16px}
.ctl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px 22px}
.ctl-group h3{margin:14px 0 4px;font-family:var(--f-display);font-size:16px;color:var(--gold-hi);display:flex;gap:8px;align-items:center}
.ctl-row{display:grid;grid-template-columns:minmax(92px,auto) 1fr;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}
.ctl-row:last-child{border-bottom:0}
.ctl-caps{display:flex;gap:4px;flex-wrap:wrap}
.ctl-caps kbd,.ctl-caps .cap{font-size:13px;padding:3px 8px;min-width:24px;text-align:center}
.ctl-caps .cap{font-family:var(--f-ui);border-radius:6px;border:1px dashed rgba(242,226,196,.35);color:var(--parch);background:rgba(0,0,0,.2);white-space:nowrap}
.ctl-row span.t{font-family:var(--f-body);font-size:16px;line-height:1.3;color:var(--parch)}
.ctl-foot{margin:14px 0 0;font-size:13px;color:var(--dim)}
@media (max-width:560px){.ctl-row{grid-template-columns:1fr;gap:4px}.ctl-row span.t{font-size:15px}}
`);

const CAP_WORDS = new Set(['muis', 'scrollwiel', 'klik', 'stick', 'slepen', 'tik']);
const capEl = c => (CAP_WORDS.has(c) ? el('span', {class: 'cap', text: c}) : el('kbd', {text: c}));
function row(r) {
  const text = typeof r.text === 'function' ? r.text() : r.text || ACTIONS[r.acts?.[0]]?.label || '';
  const caps = el('span', {class: 'ctl-caps'});
  // main keys first (W A S D), then the alternatives (arrow keys); the numpad is left out to keep it calm
  const codes = r.acts ? [...r.acts.map(a => codesFor(a)[0]), ...r.acts.flatMap(a => codesFor(a).slice(1))].filter(c => c && !c.startsWith('Numpad')) : [];
  for (const l of [...new Set(codes.map(codeLabel))]) caps.append(el('kbd', {text: l}));
  for (const c of r.caps || []) caps.append(capEl(c));
  return el('div', {class: 'ctl-row'}, caps, el('span', {class: 't', text}));
}

let open = null;
export function controlsCard({touch = IS_TOUCH} = {}) {
  if (open) { open.render(touch); return; }
  const paused = GAME.mode === 'play' && !GAME.modal;     // opened during play: pause and free the mouse
  if (paused) { GAME.modal = 'controls'; unlockForUi(); }
  SFX.play('open');
  let mode = touch;
  const body = el('div', {class: 'body'});
  const tabs = el('div', {class: 'tabs'});
  const sheet = el('div', {class: 'card sheet'},
    el('header', {}, el('h2', {text: 'Besturing'}), tabs, el('button', {class: 'btn icon', 'aria-label': 'Sluiten', onclick: () => close()}, '✕')),
    body);
  const wrap = el('div', {class: 'modal', id: 'ctlCard', role: 'dialog', 'aria-label': 'Besturing'}, sheet);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  const render = t => {
    mode = t;
    tabs.innerHTML = '';
    for (const [v, name] of [[false, 'Toetsenbord en muis'], [true, 'Aanraakscherm']]) tabs.append(el('button', {class: 'btn', 'aria-pressed': String(mode === v), onclick: () => render(v)}, name));
    body.innerHTML = '';
    const grid = el('div', {class: 'ctl-grid'});
    for (const g of mode ? TOUCH_GROUPS : KEY_GROUPS) grid.append(el('div', {class: 'ctl-group'}, el('h3', {}, el('span', {'aria-hidden': 'true', text: g.icon}), g.title), g.rows.map(row)));
    body.append(grid, el('p', {class: 'ctl-foot', text: mode ? 'Dit overzicht vind je altijd terug in het menu (☰).' : 'Dit overzicht vind je altijd terug in het menu (Esc). Weet je even niet verder? Pip geeft een hint.'}));
  };
  // Esc closes this card first (and not the menu underneath it)
  const keys = e => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  addEventListener('keydown', keys, {capture: true});
  function close() {
    if (!open) return;
    removeEventListener('keydown', keys, {capture: true});
    wrap.remove(); open = null;
    SFX.play('close');
    if (paused && GAME.modal === 'controls') { GAME.modal = null; if (GAME.mode === 'play' && !IS_TOUCH) lock(); }
  }
  open = {render, close};
  render(mode);
  document.body.append(wrap);
}
export const closeControlsCard = () => open?.close();
export const controlsCardOpen = () => !!open;
