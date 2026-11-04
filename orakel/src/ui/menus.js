// Title screen, pause menu and options, journal, map, reader.
import {$, el, esc, TILE, fmtTime, IS_TOUCH, addStyles} from '../core/util.js';
import {ACTIONS, codesFor, codeLabel, keyLabel} from '../core/keys.js';
import {UI, SFX, ON, P, ITEMS, CAST} from '../game/bus.js';
import {G, SETTINGS, saveSettings, saveGame, hasSave, saveCode, readSaveCode, applySave, clearSave, storageAvailable} from '../game/state.js';
import {W, FLOORS} from '../game/world.js';
import {GAME, newGame, continueGame, travel, enterFloor} from '../game/game.js';
import {Input, lock} from '../core/input.js';
import {unlockForUi} from '../game/dialogue.js';
import {journal, QUESTS} from '../game/quests.js';
import {drawTiles, drawMarkers, applySettings} from './hud.js';
import {tracked} from '../game/quests.js';
import {placePlayer} from '../game/player.js';
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
export function showTitle() {
  GAME.mode = 'title';
  $('title').hidden = false; $('hud').hidden = true; $('touch').hidden = true;
  const btns = $('titleBtns');
  btns.innerHTML = '';
  const start = async fn => { SFX.unlock?.(); $('title').hidden = true; $('hud').hidden = false; if (IS_TOUCH) $('touch').hidden = false; await fn(); if (!IS_TOUCH) lock(); };
  if (hasSave()) {
    btns.append(el('button', {class: 'go', onclick: () => start(continueGame)}, 'Verder spelen'));
    btns.append(el('button', {class: 'btn', onclick: () => { if (confirm('Opnieuw beginnen? Je bewaarde voortgang in deze browser wordt overschreven.')) start(newGame); }}, 'Nieuw spel'));
  } else btns.append(el('button', {class: 'go', onclick: () => start(newGame)}, 'Begin de afdaling'));
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
  const go = el('button', {class: 'go', onclick: () => closeModal()}, 'Verder');
  body.append(el('div', {class: 'tbtns', style: 'margin-bottom:14px'},
    go,
    el('button', {class: 'btn', onclick: () => openModal('journal')}, 'Dossier'),
    el('button', {class: 'btn', onclick: () => openModal('map')}, 'Kaart'),
    // the controls card and the practice round come from the tutorial; without it, no buttons
    UI.controlsCard ? el('button', {class: 'btn', onclick: () => UI.controlsCard?.()}, 'Besturing') : null,
    ON.tutorialStart ? el('button', {class: 'btn', onclick: () => { closeModal(true); ON.tutorialStart?.({replay: true}); }}, 'Oefenen') : null,
    el('button', {class: 'btn', onclick: () => openSaveCode()}, 'Spelcode'),
    el('button', {class: 'btn', onclick: () => UI.councilHost?.()}, 'Adviesraad'),
    el('button', {class: 'btn', onclick: () => { saveGame(); closeModal(true); location.reload(); }}, 'Opslaan en naar het titelscherm')));
  body.append(optionsGrid());
  focusFirst(body, go);
}
function openOptionsOnly() {
  $('menu').hidden = false;
  const body = $('menuBody'); body.innerHTML = '';
  body.append(optionsGrid());
  GAME.modal = 'options';
  focusFirst(body);
}
// keyboard users start on the first button of a sheet that just opened
function focusFirst(body, first) {
  requestAnimationFrame(() => { const b = first || body.querySelector('button,input'); if (b && !body.closest('[hidden]')) b.focus({preventScroll: true}); });
}
// a row of choices: the arrow keys move between them, Enter or Space picks
function seg(label, key, options, onChange, help) {
  const wrap = el('div', {class: 'opt', role: 'group', 'aria-label': label}, el('span', {class: 'label', text: label}));
  const row = el('div', {class: 'seg'});
  for (const [v, t] of options) row.append(el('button', {class: 'btn', 'aria-pressed': String(SETTINGS[key] === v), onclick: () => {
    SETTINGS[key] = v; saveSettings(); onChange?.(v);
    row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === t)));
  }}, t));
  row.addEventListener('keydown', e => {
    const bs = [...row.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d || i < 0) return;
    e.preventDefault(); e.stopPropagation();
    bs[(i + d + bs.length) % bs.length].focus();
  });
  wrap.append(row);
  if (help) wrap.append(el('p', {text: help}));
  return wrap;
}
function slider(label, key, min, max, stepv, onChange, fmt = v => v, help) {
  const out = el('span', {text: fmt(SETTINGS[key])});
  const input = el('input', {type: 'range', min, max, step: stepv, value: SETTINGS[key], 'aria-label': label});
  // apply live, but only re-layout the interface size when you let go (so the slider stays under your mouse)
  input.oninput = () => { SETTINGS[key] = +input.value; out.textContent = fmt(SETTINGS[key]); saveSettings(); if (!onChange?.late) onChange?.(SETTINGS[key]); };
  input.onchange = () => { if (onChange?.late) onChange(SETTINGS[key]); };
  return el('label', {class: 'opt'}, el('span', {class: 'label'}, label, ' · ', out), input, help ? el('p', {text: help}) : null);
}
const late = fn => Object.assign(fn, {late: true});
const pct = v => `${Math.round(v * 100)}%`;
function optionsGrid() {
  const wrap = el('div', {class: 'optwrap'});
  const section = (title, ...items) => wrap.append(el('h3', {class: 'optsec', text: title}), el('div', {class: 'menugrid'}, ...items));
  const apply = () => applySettings();
  section('Spelen',
    seg('Camera', 'cam', [['first', 'Eerste persoon'], ['third', 'Derde persoon']], v => UI.setCam?.(v), `Wisselen kan altijd met ${keyLabel('camera')}. In derde persoon zoom je met het scrollwiel.`),
    seg('Moeilijkheid', 'difficulty', [['calm', 'Rustig'], ['story', 'Verhaal'], ['normal', 'Normaal'], ['hard', 'Pittig']], null, 'Rustig: monsters vallen niet aan (fijn voor een workshop). Verhaal: minder schade, sneller winnen.'),
    seg('Tekstsnelheid', 'textSpeed', [[0.6, 'Rustig'], [1, 'Normaal'], [1.8, 'Snel'], [3, 'Direct']]),
    seg('Gesprekken', 'autoAdvance', [[false, 'Zelf doorklikken'], [true, 'Vanzelf verder']], null, 'Vanzelf verder: na een korte pauze komt de volgende zin. Keuzes wachten altijd op jou.'),
    seg('Richthulp', 'autoAim', [[true, 'Aan'], [false, 'Uit']], null, 'Je lichtschot zoekt het monster dat het dichtst bij je vizier is.'));
  section('Toegankelijkheid',
    slider('Tekst en interface', 'uiScale', 0.9, 1.4, 0.05, late(apply), pct, 'Maakt de teksten, het dossier, de menu’s en de afwegingen groter.'),
    seg('Contrast', 'contrast', [['normal', 'Normaal'], ['high', 'Hoog contrast']], apply, 'Effen panelen, lichtere tekst en een dikke witte focusrand.'),
    seg('Lettertype', 'font', [['default', 'Sierlijk'], ['readable', 'Extra leesbaar']], apply, 'Extra leesbaar: Atkinson Hyperlegible, gemaakt om letters makkelijk uit elkaar te houden.'),
    seg('Beweging', 'motion', [['full', 'Volledig'], ['reduced', 'Rustig beeld']], apply, 'Rustig beeld: geen deinend hoofd, schuddende camera, flitsen of gloedpulsen.'),
    seg('Rennen', 'runToggle', [[false, `${keyLabel('run')} vasthouden`], [true, `${keyLabel('run')} zet aan en uit`]], null, 'Handig als lang een toets inhouden lastig is.'),
    seg('Scherm', 'compactHud', [['auto', 'Automatisch'], ['on', 'Compact'], ['off', 'Volledig']], apply, 'Compact: een kleine vertrouwensring in de hoek; tik of klik erop voor alles. Automatisch is compact op een telefoon of tablet.'));
  section('Beeld en geluid',
    seg('Graphics', 'quality', [['high', 'Mooi (gloed)'], ['low', 'Snel']], v => setQuality(v), 'Op een trage laptop: kies Snel.'),
    slider('Helderheid', 'bright', 0.7, 1.8, 0.05, v => setBrightness(v), pct),
    slider('Blikveld', 'fov', 55, 100, 1, null, v => `${v}°`),
    seg('Schudden van het beeld', 'shake', [[true, 'Aan'], [false, 'Uit']]),
    slider('Muziek', 'music', 0, 1, 0.05, () => SFX.volume?.(), pct),
    slider('Geluid', 'sfx', 0, 1, 0.05, () => SFX.volume?.(), pct),
    seg('Stemgeluidjes', 'voice', [[true, 'Aan'], [false, 'Uit']], v => { if (v) SFX.speak?.('pip', 'Hallo! Zo klink ik!', 'happy'); }, 'Iedereen praat in eigen klankjes terwijl de tekst verschijnt.'));
  section('Besturing',
    slider('Muisgevoeligheid', 'sens', 0.3, 2.5, 0.05, null, v => v.toFixed(2)),
    seg('Muis omkeren', 'invert', [[false, 'Normaal'], [true, 'Omgekeerd']]),
    el('div', {class: 'opt'}, el('span', {class: 'label', text: 'Toetsen'}),
      el('p', {text: `Lopen ${['forward', 'left', 'back', 'right'].map(keyLabel).join(' ')} · praten ${keyLabel('interact')} · wegduiken ${keyLabel('dash')} · vaardigheid ${keyLabel('ability')}`}),
      el('div', {class: 'seg'}, el('button', {class: 'btn', onclick: e => openRemap(e.target.closest('.body') || $('menuBody'))}, 'Toetsen aanpassen'))));
  return wrap;
}

// ---------------------------------------------------------------- key remapping
// Every action from core/keys.js, its keys, and 'Wijzig': press the new key, Esc cancels.
// A key that another action uses as its main key swaps with it; one it uses as a spare key is refused.
const FIXED = new Set(['menu']);                       // Esc always opens the menu, so the browser and the game agree
const NO_KEYS = new Set(['Escape', 'MetaLeft', 'MetaRight', 'ContextMenu', 'F5', 'F11', 'F12', 'PrintScreen', 'OSLeft', 'OSRight']);
function setKey(action, code) {
  const map = {...(SETTINGS.keymap || {})};
  if (code === ACTIONS[action].codes[0]) delete map[action]; else map[action] = code;
  SETTINGS.keymap = map;
}
function openRemap(body) {
  let capture = null;
  const note = el('p', {class: 'remapnote', role: 'status', 'aria-live': 'polite'});
  const stop = () => { if (capture) { removeEventListener('keydown', capture, true); capture = null; } };
  const back = () => { stop(); body.innerHTML = ''; if (GAME.modal === 'options') body.append(optionsGrid()); else renderMenu(); focusFirst(body); };
  const render = focusId => {
    body.innerHTML = '';
    body.append(el('div', {class: 'tbtns', style: 'margin-bottom:10px'},
      el('button', {class: 'btn', onclick: back}, '← Terug naar de opties'),
      el('button', {class: 'btn', onclick: () => { stop(); SETTINGS.keymap = {}; saveSettings(); UI.refreshKeys?.(); note.textContent = 'Alle toetsen staan weer op de standaard.'; render(); }}, 'Standaard herstellen')),
      el('h3', {class: 'optsec', text: 'Toetsen aanpassen'}), note);
    const list = el('div', {class: 'remap', role: 'list'});
    for (const [id, a] of Object.entries(ACTIONS)) {
      const custom = !!SETTINGS.keymap?.[id];
      const keys = el('span', {class: 'rk'}, codesFor(id).map((c, i) => el('kbd', {class: i ? 'alt' : '', text: codeLabel(c)})));
      const btn = FIXED.has(id) ? el('span', {class: 'label', text: 'vast'}) : el('button', {class: 'btn', id: `rm-${id}`, 'aria-label': `${a.label}: wijzig de toets`, onclick: () => listen(id, row, btn)}, 'Wijzig');
      const row = el('div', {class: `rm ${custom ? 'custom' : ''}`, role: 'listitem'}, el('span', {class: 'rl', text: a.label}), keys, btn);
      list.append(row);
    }
    body.append(list, el('p', {class: 'label', style: 'margin-top:12px;text-transform:none;letter-spacing:0', text: 'Gereedschap gebruiken: linkermuisknop. Onthullen kan ook met de rechtermuisknop. In een gesprek kies je met de cijfertoetsen.'}));
    focusFirst(body, focusId ? $(focusId) : null);
  };
  const listen = (id, row, btn) => {
    stop();
    body.querySelectorAll('.rm.wait').forEach(r => r.classList.remove('wait'));
    row.classList.add('wait'); btn.textContent = 'Druk op een toets…';
    note.textContent = `Druk op de nieuwe toets voor ‘${ACTIONS[id].label.toLowerCase()}’. Esc annuleert.`;
    capture = e => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') { stop(); note.textContent = 'Niets veranderd.'; render(`rm-${id}`); return; }
      if (NO_KEYS.has(e.code) || !e.code) { note.textContent = 'Die toets is van de browser. Kies een andere.'; return; }
      const mine = codesFor(id)[0];
      if (e.code === mine) { stop(); note.textContent = `${ACTIONS[id].label} blijft op ${codeLabel(mine)}.`; render(`rm-${id}`); return; }
      const clash = Object.keys(ACTIONS).find(o => o !== id && codesFor(o).includes(e.code));
      if (clash && (FIXED.has(clash) || codesFor(clash)[0] !== e.code)) { note.textContent = `${codeLabel(e.code)} is al in gebruik voor ‘${ACTIONS[clash].label.toLowerCase()}’. Kies een andere toets.`; return; }
      if (clash) { setKey(clash, mine); note.textContent = `Geruild: ${ACTIONS[id].label.toLowerCase()} staat nu op ${codeLabel(e.code)}, ${ACTIONS[clash].label.toLowerCase()} op ${codeLabel(mine)}.`; }
      else note.textContent = `${ACTIONS[id].label} staat nu op ${codeLabel(e.code)}.`;
      setKey(id, e.code);
      stop(); saveSettings(); UI.refreshKeys?.(); SFX.play('switch');
      render(`rm-${id}`);
    };
    addEventListener('keydown', capture, true);
  };
  render();
}
addStyles('options', `
.optsec{font-family:var(--f-display);font-size:15px;font-weight:600;color:var(--gold-hi);margin:18px 0 8px;letter-spacing:.04em}
.optwrap>.optsec:first-child{margin-top:4px}
.remap{display:grid;gap:6px}
.rm{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:rgba(0,0,0,.2)}
.rm .rl{font-size:14px}
.rm .rk{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.rm .rk kbd{font-size:12px;padding:2px 7px}
.rm .rk kbd.alt{opacity:.6}
.rm.custom .rk kbd:first-child{border-color:var(--gold);color:var(--gold-hi)}
.rm.wait{border-color:var(--gold);background:rgba(232,194,122,.12)}
.rm.wait .btn{border-color:var(--gold);color:var(--gold-hi)}
.remapnote{min-height:20px;margin:0 0 8px;font-size:14px;color:var(--gold-hi)}
@media (max-width:560px){.rm{grid-template-columns:1fr auto}.rm .rk{grid-column:1/3;justify-content:flex-start;order:3}}
`);

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
