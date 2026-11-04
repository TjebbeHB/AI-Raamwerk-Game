// Title screen, pause menu and options, journal, map, reader.
import {$, el, esc, TILE, fmtTime, IS_TOUCH} from '../core/util.js';
import {UI, SFX, ON, P, ITEMS, CAST} from '../game/bus.js';
import {G, SETTINGS, saveSettings, saveGame, hasSave, saveCode, readSaveCode, applySave, clearSave, storageAvailable} from '../game/state.js';
import {W, FLOORS} from '../game/world.js';
import {GAME, newGame, continueGame, travel, enterFloor} from '../game/game.js';
import {Input, lock} from '../core/input.js';
import {unlockForUi} from '../game/dialogue.js';
import {journal, QUESTS} from '../game/quests.js';
import {drawTiles, drawMarkers} from './hud.js';
import {tracked} from '../game/quests.js';
import {placePlayer, rebuildHeroModel} from '../game/player.js';
import {invalidateMods} from '../game/mods.js';
import {makeHero} from '../content/archetypes.js';
import {openCreator} from './creator.js';
import {setQuality, setBrightness, R} from '../engine/render.js';
import {BEASTS, TOOLS} from '../game/combat.js';

export const JOURNAL_TABS = [];
let jTab = 'quests';

export function initMenus() {
  Object.assign(UI, {modal: openModal, closeModal, read: openReader, fade});
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal()));
  for (const id of ['journal', 'mapModal', 'menu', 'reader', 'councilModal']) $(id).addEventListener('mousedown', e => { if (e.target.id === id) closeModal(); });
  $('btnJournal').onclick = () => openModal('journal');
  $('btnMap').onclick = () => openModal('map'); $('mapCard').onclick = () => openModal('map');
  $('btnMenu').onclick = () => openModal('menu');
  $('btnCam').onclick = () => UI.toggleCam?.();
  $('tracker').onclick = () => openModal('journal');
  $('bigmap').addEventListener('click', mapClick);
  JOURNAL_TABS.push(
    {id: 'quests', name: 'Opdrachten', render: renderQuests},
    {id: 'finds', name: 'Vondsten', render: renderFinds},
    {id: 'beasts', name: 'Monsters', render: renderBeasts},
  );
}

// ---------------------------------------------------------------- title
// Test hook: window.__orakel.autoHero = {archetype: 'verbinder'} (or ?hero=verbinder) skips the character
// creator with a default look; {name, look, tutorial} work too. Automated browsers (navigator.webdriver,
// so the e2e scripts) skip it as well, as the default hero, unless the address has ?creator.
function autoHero() {
  const q = new URLSearchParams(location.search);
  if (window.__orakel?.autoHero) return window.__orakel.autoHero;
  if (q.has('hero')) return {archetype: q.get('hero')};
  if (navigator.webdriver && !q.has('creator')) return {};
  return null;
}
export function showTitle() {
  GAME.mode = 'title';
  $('title').hidden = false; $('hud').hidden = true; $('touch').hidden = true;
  const btns = $('titleBtns');
  btns.innerHTML = '';
  const start = async fn => { SFX.unlock?.(); $('title').hidden = true; $('hud').hidden = false; if (IS_TOUCH) $('touch').hidden = false; await fn(); if (!IS_TOUCH) lock(); };
  // a new game: first who you are (ui/creator.js), then the practice round or straight to the town hall
  const fresh = async () => {
    SFX.unlock?.();
    const auto = autoHero();
    let res = auto ? {hero: makeHero(auto), tutorial: !!auto.tutorial} : null;
    if (!res) {
      const hold = GAME.noRender;
      GAME.noRender = true;   // the creator covers the world: no need to draw it meanwhile
      try { res = await openCreator(); } finally { GAME.noRender = hold; }
    }
    if (res) await start(() => newGame(res));
  };
  // an old save without a hero is the default hero; with one, your body and your passives come back
  const resume = async () => { await continueGame(); rebuildHeroModel(); invalidateMods(); };
  if (hasSave()) {
    btns.append(el('button', {class: 'go', onclick: () => start(resume)}, 'Verder spelen'));
    btns.append(el('button', {class: 'btn', onclick: () => { if (confirm('Opnieuw beginnen? Je bewaarde voortgang in deze browser wordt overschreven.')) fresh(); }}, 'Nieuw spel'));
  } else btns.append(el('button', {class: 'go', onclick: fresh}, 'Begin de afdaling'));
  btns.append(el('button', {class: 'btn', onclick: () => UI.councilHost?.()}, 'Adviesraad (multiplayer)'));
  btns.append(el('button', {class: 'btn', onclick: () => openOptionsOnly()}, 'Opties'));
  btns.append(el('button', {class: 'btn', onclick: () => openSaveCode()}, 'Spelcode'));
  if (!storageAvailable()) $('status').textContent = 'Let op: deze browser bewaart geen voortgang (privévenster?). Gebruik de spelcode om later verder te gaan.';
}

// ---------------------------------------------------------------- modals
function openModal(name) {
  if (GAME.mode !== 'play' && name !== 'options' && name !== 'save' && name !== 'council') return;
  if (GAME.modal && GAME.modal !== name) closeModal(true);
  GAME.modal = name;
  unlockForUi();
  SFX.play('open');
  if (name === 'journal') { $('journal').hidden = false; renderJournal(); }
  else if (name === 'map') { $('mapModal').hidden = false; renderMap(); }
  else if (name === 'menu') { $('menu').hidden = false; renderMenu(); }
}
export function closeModal(silent) {
  for (const id of ['journal', 'mapModal', 'menu', 'reader', 'councilModal']) $(id).hidden = true;
  const was = GAME.modal;
  GAME.modal = null;
  if (!silent) SFX.play('close');
  if (GAME.mode === 'play' && !silent && !IS_TOUCH && was !== 'decision') lock();
  readerDone?.(); readerDone = null;
}

// a fade to black and back, awaited by travel and scenes
function fade(on, sec = 0.5) {
  const f = $('fader');
  f.style.transition = `opacity ${sec}s`;
  f.classList.toggle('on', !!on);
  return new Promise(r => setTimeout(r, sec * 1000 + 30));
}

// ---------------------------------------------------------------- reader
let readerDone = null;
function openReader(title, html, {wide = false} = {}) {
  $('readTitle').textContent = title;
  $('readBody').innerHTML = typeof html === 'string' && !html.trim().startsWith('<') ? html.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('') : html;
  $('reader').hidden = false;
  if (GAME.mode === 'play') { GAME.modal = 'reader'; unlockForUi(); }
  void wide;
  return new Promise(r => { readerDone = r; });
}

// ---------------------------------------------------------------- journal
function renderJournal() {
  const tabs = $('jTabs');
  tabs.innerHTML = '';
  for (const t of JOURNAL_TABS) tabs.append(el('button', {class: 'btn', 'aria-pressed': String(t.id === jTab), onclick: () => { jTab = t.id; renderJournal(); }}, t.name));
  const body = $('jBody');
  body.innerHTML = '';
  (JOURNAL_TABS.find(t => t.id === jTab) || JOURNAL_TABS[0]).render(body);
}
function renderQuests(body) {
  const list = el('div', {class: 'jq'});
  for (const q of journal()) {
    const isTracked = (G.flags.track || 'main') === q.id;
    list.append(el('div', {class: `quest ${q.done ? 'done' : ''}`},
      el('h4', {text: `${q.side ? '' : '★ '}${q.title}`}),
      el('p', {text: q.text}),
      q.log.length ? el('ul', {}, q.log.slice(-6).map(l => el('li', {text: l}))) : null,
      !q.done && q.side ? el('button', {class: 'btn', style: 'margin-top:8px;font-size:12px', onclick: () => { G.flags.track = isTracked ? null : q.id; renderJournal(); }}, isTracked ? 'Niet meer volgen' : 'Volg deze opdracht') : null));
  }
  body.append(list);
  body.append(el('p', {class: 'label', style: 'margin-top:14px'}, `Speeltijd ${fmtTime(G.stats.time)} · monsters verslagen ${G.stats.kills} · terug naar de koffie ${G.stats.deaths}×`));
}
function renderFinds(body) {
  const total = ON.totals || {};
  const sec = (title, items) => { body.append(el('h3', {class: 'label', style: 'margin:14px 0 8px', text: title})); body.append(items); };
  const hall = el('div', {class: 'bronlist'});
  for (const h of ON.hallucList || []) {
    const got = G.hallucs.includes(h.id);
    hall.append(el('button', {class: `bron ${got ? '' : 'locked'}`, onclick: () => got && openReader(h.title, `<p class="ex">${esc(h.text)}</p><p>${esc(h.lesson)}</p>`)},
      el('b', {text: got ? h.title : 'Nog niet gevonden'}), got ? el('p', {text: h.short}) : null));
  }
  sec(`Hallucinaties van het Orakel · ${G.hallucs.length}/${total.hallucs ?? 0}`, hall);
  const cards = el('div', {class: 'bronlist'});
  for (const c of ON.cardList || []) {
    const got = G.cards.includes(c.id);
    cards.append(el('div', {class: `bron ${got ? '' : 'locked'}`}, el('b', {text: got ? c.title : '…'}), got ? el('p', {text: c.text}) : null));
  }
  sec(`Visitekaartjes van Glans · ${G.cards.length}/${total.cards ?? 0}`, cards);
  body.append(el('p', {class: 'label', style: 'margin-top:12px'}, `Vertrouwenskristallen: ${G.crystals.length}/${total.crystals ?? 0}`));
}
function renderBeasts(body) {
  const grid = el('div', {class: 'dgrid'});
  for (const [id, b] of Object.entries(BEASTS)) {
    if (b.hiddenInBook) continue;
    const met = G.flags[`lesson:${id}`];
    grid.append(el('div', {class: 'dcell'}, el('b', {text: met ? b.name : '???'}),
      met && b.weak ? el('span', {class: 'st', style: `color:${TOOLS[b.weak].css}`, text: `zwak voor ${TOOLS[b.weak].icon} ${TOOLS[b.weak].name}`}) : null,
      el('span', {style: 'font-family:var(--f-body);font-size:15px;line-height:1.35', text: met ? b.lesson : 'Nog niet verslagen.'})));
  }
  body.append(grid);
}

// ---------------------------------------------------------------- map
let mapF = null, mapScale = 1;
function renderMap() {
  const cv = $('bigmap'), g = cv.getContext('2d'), L = W.L;
  $('mapTitle').textContent = `${L.def.depth ? L.def.depth + ' · ' : ''}${L.def.name}`;
  g.fillStyle = '#0c0906'; g.fillRect(0, 0, cv.width, cv.height);
  mapScale = Math.floor(Math.min(cv.width / (L.W + 2), cv.height / (L.H + 2)));
  const cx = L.W / 2, cz = L.H / 2;
  mapF = drawTiles(g, cx, cz, mapScale, cv.width, cv.height);
  const q = tracked();
  drawMarkers(g, mapF, mapScale, {quest: q});
  // coffee corners you have visited: travel points
  for (const e of W.ents) if (e.type === 'coffee' && G.coffee.includes(e.key)) {
    g.strokeStyle = '#9fe0b0'; g.lineWidth = 3; g.beginPath(); g.arc(mapF.sx(e.tx + 0.5), mapF.sz(e.tz + 0.5), mapScale * 0.9, 0, Math.PI * 2); g.stroke();
  }
  // you
  g.save(); g.translate(mapF.sx(P.x / TILE), mapF.sz(P.z / TILE)); g.rotate(-P.yaw);
  g.fillStyle = '#fff4d6'; g.strokeStyle = '#1a1208'; g.lineWidth = 2; const s = Math.max(8, mapScale * 0.8);
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore();
  const legend = $('mapLegend');
  legend.innerHTML = '';
  for (const [c, t] of [['#9fd0ff', 'mensen'], ['#9fe0b0', 'koffiehoek (reizen)'], ['#ffd36b', 'trap'], ['#e8c27a', 'deur / kist'], ['#ffb84a', 'doel']]) legend.append(el('span', {}, el('i', {style: `background:${c}`}), t));
  // other floors' coffee corners
  const others = (G.coffeeList || []).filter(c => c.floor !== W.id);
  if (others.length) {
    legend.append(el('div', {style: 'width:100%;text-align:center;margin-top:8px'}, 'Reis naar een koffiehoek op een andere diepte:'));
    for (const c of others) legend.append(el('button', {class: 'btn', onclick: async () => { closeModal(true); await enterFloor(c.floor, null, {pos: {x: c.x, z: c.z, yaw: c.yaw}}); if (!IS_TOUCH) lock(); }}, `${FLOORS[c.floor]?.depth || ''} · ${c.name}`));
  }
  $('mapHint').textContent = G.coffee.length ? 'klik op een bezochte koffiehoek (groene ring) om erheen te reizen' : '';
}
async function mapClick(e) {
  if (!mapF) return;
  const cv = $('bigmap'), r = cv.getBoundingClientRect();
  const px = (e.clientX - r.left) * cv.width / r.width, pz = (e.clientY - r.top) * cv.height / r.height;
  const tx = (px - cv.width / 2) / mapScale + W.L.W / 2, tz = (pz - cv.height / 2) / mapScale + W.L.H / 2;
  const c = W.ents.find(o => o.type === 'coffee' && G.coffee.includes(o.key) && Math.hypot(o.tx + 0.5 - tx, o.tz + 0.5 - tz) < 1.6);
  if (!c) return;
  closeModal(true);
  await fade(true, 0.4);
  placePlayer(c.x + Math.sin(c.group.rotation.y) * 1.6, c.z + Math.cos(c.group.rotation.y) * 1.6, c.group.rotation.y);
  await fade(false, 0.4);
  if (!IS_TOUCH) lock();
}

// ---------------------------------------------------------------- pause menu and options
function renderMenu() {
  const body = $('menuBody');
  body.innerHTML = '';
  body.append(el('div', {class: 'tbtns', style: 'margin-bottom:14px'},
    el('button', {class: 'go', onclick: () => closeModal()}, 'Verder'),
    el('button', {class: 'btn', onclick: () => openModal('journal')}, 'Dossier'),
    el('button', {class: 'btn', onclick: () => openModal('map')}, 'Kaart'),
    el('button', {class: 'btn', onclick: () => openSaveCode()}, 'Spelcode'),
    el('button', {class: 'btn', onclick: () => UI.councilHost?.()}, 'Adviesraad'),
    el('button', {class: 'btn', onclick: () => { saveGame(); closeModal(true); location.reload(); }}, 'Opslaan en naar het titelscherm')));
  body.append(optionsGrid());
}
function openOptionsOnly() {
  $('menu').hidden = false;
  const body = $('menuBody'); body.innerHTML = '';
  body.append(optionsGrid());
  GAME.modal = 'options';
}
function seg(label, key, options, onChange, help) {
  const wrap = el('div', {class: 'opt'}, el('span', {class: 'label', text: label}));
  const row = el('div', {class: 'seg'});
  for (const [v, t] of options) row.append(el('button', {class: 'btn', 'aria-pressed': String(SETTINGS[key] === v), onclick: () => { SETTINGS[key] = v; saveSettings(); onChange?.(v); row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === t))); }}, t));
  wrap.append(row);
  if (help) wrap.append(el('p', {text: help}));
  return wrap;
}
function slider(label, key, min, max, stepv, onChange, fmt = v => v) {
  const out = el('span', {text: fmt(SETTINGS[key])});
  const input = el('input', {type: 'range', min, max, step: stepv, value: SETTINGS[key]});
  input.oninput = () => { SETTINGS[key] = +input.value; out.textContent = fmt(SETTINGS[key]); saveSettings(); onChange?.(SETTINGS[key]); };
  return el('label', {class: 'opt'}, el('span', {class: 'label'}, label, ' · ', out), input);
}
function optionsGrid() {
  return el('div', {class: 'menugrid'},
    seg('Camera', 'cam', [['first', 'Eerste persoon'], ['third', 'Derde persoon']], v => UI.setCam?.(v), 'Wisselen kan altijd met V. In derde persoon zoom je met het scrollwiel.'),
    seg('Moeilijkheid', 'difficulty', [['calm', 'Rustig'], ['story', 'Verhaal'], ['normal', 'Normaal'], ['hard', 'Pittig']], null, 'Rustig: monsters vallen niet aan (fijn voor een workshop). Verhaal: minder schade, sneller winnen.'),
    slider('Muisgevoeligheid', 'sens', 0.3, 2.5, 0.05, null, v => v.toFixed(2)),
    seg('Muis omkeren', 'invert', [[false, 'Normaal'], [true, 'Omgekeerd']]),
    slider('Blikveld', 'fov', 55, 100, 1, null, v => `${v}°`),
    slider('Helderheid', 'bright', 0.7, 1.8, 0.05, v => setBrightness(v), v => `${Math.round(v * 100)}%`),
    slider('Muziek', 'music', 0, 1, 0.05, v => SFX.volume?.(), v => `${Math.round(v * 100)}%`),
    slider('Geluid', 'sfx', 0, 1, 0.05, v => SFX.volume?.(), v => `${Math.round(v * 100)}%`),
    seg('Tekstsnelheid', 'textSpeed', [[0.6, 'Rustig'], [1, 'Normaal'], [1.8, 'Snel'], [3, 'Direct']]),
    seg('Graphics', 'quality', [['high', 'Mooi (gloed)'], ['low', 'Snel']], v => setQuality(v), 'Op een trage laptop: kies Snel.'),
    seg('Schudden van het beeld', 'shake', [[true, 'Aan'], [false, 'Uit']]),
    seg('Richthulp', 'autoAim', [[true, 'Aan'], [false, 'Uit']], null, 'Je lichtschot zoekt het monster dat het dichtst bij je vizier is.'));
}

// ---------------------------------------------------------------- save code
function openSaveCode() {
  const body = el('div', {class: 'prose'});
  body.append(el('p', {text: 'Je voortgang staat in deze browser. Kopieer deze spelcode naar een veilige plek; plak hem later hier (ook in een andere browser) om verder te spelen.'}));
  const out = el('textarea', {readonly: true, rows: 4, style: 'width:100%;font-family:ui-monospace,monospace;font-size:12px;background:rgba(0,0,0,.35);color:var(--parch);border:1px solid var(--line);border-radius:8px;padding:8px'});
  out.value = GAME.mode === 'play' ? (saveGame(), saveCode()) : (hasSave() ? (applySave(JSON.parse(localStorage.getItem('orakel-dalwijk-save-v1'))), saveCode()) : '');
  body.append(out);
  body.append(el('div', {class: 'tbtns', style: 'margin:8px 0 18px'}, el('button', {class: 'btn', onclick: () => { out.select(); navigator.clipboard?.writeText(out.value); }}, 'Kopieer')));
  body.append(el('h3', {text: 'Een spelcode terugzetten'}));
  const inp = el('textarea', {rows: 3, placeholder: 'ORAKEL-1:…', style: 'width:100%;font-family:ui-monospace,monospace;font-size:12px;background:rgba(0,0,0,.35);color:var(--parch);border:1px solid var(--line);border-radius:8px;padding:8px;user-select:text'});
  const msg = el('span', {class: 'label'});
  body.append(inp, el('div', {class: 'tbtns', style: 'margin-top:8px'}, el('button', {class: 'go', onclick: () => {
    const data = readSaveCode(inp.value);
    if (!data) { msg.textContent = 'Dat is geen geldige spelcode.'; return; }
    try { localStorage.setItem('orakel-dalwijk-save-v1', JSON.stringify(data)); location.reload(); } catch (e) { msg.textContent = 'Deze browser kan niets bewaren.'; }
  }}, 'Zet terug en herlaad'), msg));
  $('reader').hidden = false; $('readTitle').textContent = 'Spelcode'; $('readBody').innerHTML = ''; $('readBody').append(body);
  if (GAME.mode === 'play') { GAME.modal = 'reader'; unlockForUi(); }
  void clearSave; void QUESTS; void ITEMS; void CAST; void travel; void Input; void R;
}
