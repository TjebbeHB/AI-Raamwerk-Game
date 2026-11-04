// 'Jouw afdaling': the end summary. It reads everything defensively, so old saves, the
// Snelle Lift ending and missing registries (secrets, trinkets, bingo, achievements,
// relationships) all work: a section only appears when there is something to show.
import {el, addStyles, hashString} from '../core/util.js';
import {UI, ON, CAST} from '../game/bus.js';
import {G} from '../game/state.js';
import {assess, CHAMBERS, CHAMBER, STATE_LABEL, CRITICAL, FOUNDATIONS, DOMAINS} from '../content/framework.js';
import {facts, playstyle, relations, relWord, fmtDist, fmtMin, DEPTHS, ARCHETYPES, TITLES, titleName} from '../content/nabespreking.js';

// ---------------------------------------------------------------- faces
const HONORIFIC = new Set(['mevrouw', 'meneer', 'wethouder', 'vrouwe', 'stoker', 'de', 'het', 'van', 'der', 'den']);
export function initials(name) {
  const words = String(name || '?').split(/\s+/).filter(Boolean);
  const core = words.filter(w => !HONORIFIC.has(w.toLowerCase()));
  const use = core.length ? core : words;
  return ((use.length > 1 ? use[0][0] + use.at(-1)[0] : (use[0] || '?')[0]) || '?').toUpperCase();
}
// a face: the drawn portrait when the portrait module is there (UI.portraitURL), initials otherwise
export function portraitOf(id, mood) {
  try { const u = UI.portraitURL?.(id, mood); return typeof u === 'string' && u ? u : null; } catch (e) { return null; }
}
export function face(id, {size = 44, mood = 'neutral', name, glyph} = {}) {
  name ||= CAST[id]?.name || String(id || '?');
  const url = portraitOf(id, mood);
  // golden-angle hues, so neighbours in a list rarely share a colour
  const box = el('span', {class: `face${url ? ' img' : ''}`, style: `--s:${size}px;--fh:${Math.round((hashString(String(id)) % 97) * 137.508) % 360}`, title: name});
  box.append(url ? el('img', {src: url, alt: '', draggable: 'false', decoding: 'async'}) : el('span', {class: 'ini', 'aria-hidden': 'true', text: glyph || initials(name)}));
  return box;
}
const castName = id => CAST[id]?.name || String(id || '');
const section = (title, sub, ...kids) => {
  const content = kids.flat().filter(Boolean);
  if (!content.length) return null;
  return el('section', {class: 'sumsec'}, el('h2', {class: 'sumh', text: title}), sub ? el('p', {class: 'sumsub', text: sub}) : null, ...content);
};
const meter = (got, total, color) => el('span', {class: 'meter', style: `--m:${total ? Math.min(1, got / total) : 0};--mc:${color}`, role: 'img', 'aria-label': `${got} van ${total}`}, el('i'));

// ---------------------------------------------------------------- the summary
export function renderSummary(p) {
  const d = assess(), f = facts(G, d, ON), style = playstyle(f);
  p.append(...[
    heroCard(f, style),
    numbers(f),
    depthTimes(f),
    dossier(d),
    finds(f),
    choices(),
    people(f),
    achievements(),
    titlesInfo(f, style),
  ].filter(Boolean));
}

function heroCard(f, style) {
  const h = G.hero || {}, arch = ARCHETYPES[h.archetype], name = (h.name || '').trim();
  return el('div', {class: 'sumhero'},
    el('div', {class: 'sumface'}, face('you', {size: 112, mood: f.shortcut ? 'worried' : 'happy', name: name || 'Jij', glyph: name ? null : '✦'})),
    el('div', {class: 'sumwho'},
      el('div', {class: 'eyebrow', text: f.shortcut ? 'Jouw korte afdaling' : 'Jouw afdaling'}),
      el('div', {class: 'sumname'}, el('span', {text: name || 'De nieuwe adviseur'}), arch ? el('span', {class: 'archpill', title: arch.line, text: `${arch.name} · ${arch.kind}`}) : null),
      el('h1', {class: 'sumtitle', text: style.name}),
      el('p', {class: 'sumline', text: style.line}),
      style.also.length ? el('div', {class: 'sumalso'}, el('span', {class: 'label', text: 'Ook'}), ...style.also.map(t => el('span', {class: 'tchip', text: t.name}))) : null));
}

function numbers(f) {
  const tiles = [
    [fmtMin(f.time), 'in het Gewelf'],
    [`${f.strong}/${f.chambers}`, 'kamers stevig'],
    [`${f.bronnen}/${f.totals.bronnen}`, 'bronnen gevonden'],
    [f.kills, 'monsters verslagen'],
    [f.deaths, 'keer terug naar de koffie'],
    f.abilities || G.hero?.archetype ? [f.abilities, 'keer je vaardigheid gebruikt'] : null,
    [f.damageTaken, 'vertrouwen verloren in gevechten'],
    f.distance >= 1 ? [fmtDist(f.distance), 'gelopen'] : null,
    f.talks ? [f.talks, f.met ? `gesprekken, met ${f.met} ${f.met === 1 ? 'persoon' : 'mensen'}` : 'gesprekken'] : null,
    f.choices ? [f.choices, f.choices === 1 ? 'keuze die ertoe deed' : 'keuzes die ertoe deden'] : null,
  ].filter(Boolean);
  return section('In cijfers', null, el('div', {class: 'stats sumstats'}, tiles.map(([b, s]) => el('div', {class: 'stat'}, el('b', {text: String(b)}), el('span', {text: s})))));
}

function depthTimes(f) {
  const ids = Object.keys(DEPTHS).filter(k => f.floorTime[k] > 0);
  if (!ids.length) return null;
  const rest = Math.max(0, f.active - f.tracked);
  const max = Math.max(1, ...ids.map(k => f.floorTime[k]), rest);
  const row = (label, sub, s, cls = '') => el('div', {class: `drow ${cls}`},
    el('span', {class: 'dl'}, el('b', {text: label}), sub ? el('small', {text: sub}) : null),
    el('span', {class: 'dbar'}, el('i', {style: `--w:${Math.max(0.02, s / max)}`})),
    el('span', {class: 'dt', text: fmtMin(s)}));
  const talk = f.tracked - f.active;
  return section('Tijd per diepte', talk > 90 ? `Waarvan ${fmtMin(talk)} in gesprek, aan het lezen of aan het afwegen.` : null,
    el('div', {class: 'depths'},
      ids.map((k, i) => row(DEPTHS[k].name, DEPTHS[k].depth, f.floorTime[k], `d${i}`)),
      rest > 60 ? row('Eerder', 'niet per diepte bijgehouden', rest, 'rest') : null));
}

function dossier(d) {
  const byId = Object.fromEntries(d.chambers.map(c => [c.id, c]));
  const groups = [['Noodzaak', ['necessity']], ['Fundamenten', FOUNDATIONS], ['Domeinen', DOMAINS]];
  const counts = el('div', {class: 'dcounts'},
    el('span', {class: 'strong', text: `${d.strong.length} stevig`}), el('span', {class: 'open', text: `${d.open.length} open punten`}), el('span', {class: 'blind', text: `${d.blind.length} ${d.blind.length === 1 ? 'blinde vlek' : 'blinde vlekken'}`}));
  return section('Het dossier', null, counts, groups.map(([title, ids]) => [
    el('h3', {class: 'label sumg', text: title}),
    el('div', {class: 'dgrid'}, ids.filter(id => byId[id]).map(id => {
      const c = byId[id], ch = CHAMBER[id], tries = G.chambers[id]?.attempts?.length || 0;
      const found = ch.clues.filter(k => G.bronnen.includes(`${id}:${k.id}`)).length;
      return el('div', {class: `dcell ${c.state} ${CRITICAL.includes(id) ? 'crit' : ''}`},
        el('b', {text: ch.title}), el('span', {class: 'st', text: STATE_LABEL[c.state]}),
        el('span', {class: 'dmeta', text: `${found}/${ch.clues.length} bronnen${tries > 1 ? ` · ${tries}× afgewogen` : ''}`}));
    })),
  ]));
}

function finds(f) {
  const rows = [
    ['Bronnen', 'rollen die een afweging makkelijker maken', f.bronnen, f.totals.bronnen, '#9fc3ff'],
    ['Hallucinaties', 'verzonnen antwoorden van het Orakel', f.hallucs, f.totals.hallucs, '#ffd36b'],
    ['Visitekaartjes', 'van Glans, PraatPal', f.cards, f.totals.cards, '#e8c27a'],
    ['Vertrouwenskristallen', 'meer vertrouwen', f.crystals, f.totals.crystals, '#b9a2ff'],
    f.secrets && ['Geheimen', 'verborgen in het Gewelf', f.secrets.got, f.secrets.total, '#ff9fd8'],
    f.trinkets && ['Kantoorvondsten', 'voor in je bureaula', f.trinkets.got, f.trinkets.total, '#9fe0b0'],
    f.bingo && ['Vergaderbingo', 'woorden die je hoorde', f.bingo.got, f.bingo.total, '#f0a541'],
  ].filter(Boolean);
  const grid = el('div', {class: 'finds'}, rows.map(([name, sub, got, total, color]) => el('div', {class: 'find'},
    el('div', {class: 'fh'}, el('b', {text: name}), el('span', {class: 'fn', text: `${got}/${total}`})),
    meter(got, total, color), el('span', {class: 'fs', text: sub}))));
  return section('Wat je vond', null, grid, secretsList(), trinketsList(), bingoCard());
}

function secretsList() {
  const list = Array.isArray(ON.secretList) ? ON.secretList.filter(Boolean) : [];
  if (!list.length) return null;
  const have = new Set(G.secrets || []), got = list.filter(s => have.has(s.id));
  const missing = {};
  for (const s of list) if (!have.has(s.id)) missing[s.floor || '?'] = (missing[s.floor || '?'] || 0) + 1;
  const hints = Object.entries(missing).map(([fl, n]) => `${DEPTHS[fl]?.name || 'ergens'}: ${n}`);
  return el('div', {class: 'sumblock'},
    el('h3', {class: 'label sumg', text: `Geheimen · ${got.length} van ${list.length}`}),
    got.length ? el('div', {class: 'cards2'}, got.map(s => el('div', {class: 'mini'}, el('b', {text: s.name || 'Een geheim'}), el('small', {text: DEPTHS[s.floor]?.name || ''}), s.text ? el('p', {text: s.text}) : null)))
      : el('p', {class: 'sumsub', text: 'Nog geen geheimen gevonden. Kijk eens achter een kast, of onder een plant.'}),
    hints.length ? el('p', {class: 'sumsub', text: `Nog te vinden · ${hints.join(' · ')}`}) : null);
}

function trinketsList() {
  const list = Array.isArray(ON.trinketList) ? ON.trinketList.filter(Boolean) : [];
  if (!list.length) return null;
  const have = new Set(G.trinkets || []), got = list.filter(t => have.has(t.id));
  return el('div', {class: 'sumblock'},
    el('h3', {class: 'label sumg', text: `Kantoorvondsten · ${got.length} van ${list.length}`}),
    got.length ? el('div', {class: 'cards2'}, got.map(t => el('div', {class: 'mini trink'}, el('span', {class: 'ticon', 'aria-hidden': 'true', text: t.icon || '✦'}),
      el('div', {}, el('b', {text: t.name}), t.effect ? el('small', {class: 'eff', text: t.effect}) : null, t.text ? el('p', {text: t.text}) : null))))
      : el('p', {class: 'sumsub', text: 'Je bureaula is nog leeg. Er liggen in het Gewelf allerlei handige spullen.'}),
    got.length < list.length ? el('p', {class: 'sumsub', text: `Nog ${list.length - got.length} te vinden.`}) : null);
}

function bingoCard() {
  const list = Array.isArray(ON.bingoList) ? ON.bingoList.filter(Boolean) : [];
  if (!list.length) return null;
  const have = new Set(G.bingo || []);
  const n = Math.round(Math.sqrt(list.length)), square = n * n === list.length && n >= 3;
  // a full row, column or diagonal on a square card is a bingo
  let lines = 0;
  if (square) {
    const on = (r, c) => have.has(list[r * n + c].id);
    for (let i = 0; i < n; i++) { if ([...Array(n).keys()].every(c => on(i, c))) lines++; if ([...Array(n).keys()].every(r => on(r, i))) lines++; }
    if ([...Array(n).keys()].every(i => on(i, i))) lines++;
    if ([...Array(n).keys()].every(i => on(i, n - 1 - i))) lines++;
  }
  const got = list.filter(b => have.has(b.id)).length;
  return el('div', {class: 'sumblock'},
    el('h3', {class: 'label sumg', text: `Vergaderbingo · ${got} van ${list.length}${lines ? ` · ${lines === 1 ? 'BINGO!' : `${lines}× BINGO!`}` : ''}`}),
    el('div', {class: `bingo${square ? ' sq' : ''}`, style: square ? `--n:${n}` : null, role: 'list'}, list.map(b => el('span', {class: `bw${have.has(b.id) ? ' on' : ''}`, role: 'listitem', 'aria-label': `${b.word}${have.has(b.id) ? ', gehoord' : ', nog niet gehoord'}`}, el('span', {text: b.word})))));
}

function choices() {
  const list = (Array.isArray(G.choices) ? G.choices : []).filter(c => c && (c.label || c.text));
  if (!list.length) return null;
  const sorted = list.map((c, i) => [c, i]).sort((a, b) => ((+a[0].at || 0) - (+b[0].at || 0)) || (a[1] - b[1])).map(([c]) => c);
  return section('Jouw keuzes', 'Wat je zei en deed, en bij wie.', el('ol', {class: 'chlist'}, sorted.map(c => el('li', {class: 'ch'},
    c.npc ? face(c.npc, {size: 46}) : el('span', {class: 'face ini0', style: '--s:46px', 'aria-hidden': 'true'}, el('span', {class: 'ini', text: '✦'})),
    el('div', {class: 'chb'}, el('div', {class: 'chh'}, c.npc ? el('span', {class: 'chw', text: castName(c.npc)}) : null, c.label ? el('b', {text: c.label}) : null), c.text ? el('p', {text: c.text}) : null)))));
}

function people(f) {
  const met = G.stats?.met && typeof G.stats.met === 'object' ? Object.entries(G.stats.met).filter(([id]) => id && id !== 'pip').sort((a, b) => b[1] - a[1]) : [];
  const rels = relations(G, ON, CAST);
  const scale = Math.max(5, ...rels.map(r => Math.abs(r.v)));
  const wall = met.length ? el('div', {class: 'sumblock'},
    el('h3', {class: 'label sumg', text: `Wie je sprak · ${met.length} ${met.length === 1 ? 'persoon' : 'mensen'}${f.talks ? `, ${f.talks} gesprekken` : ''}`}),
    el('div', {class: 'facewall'}, met.map(([id, n]) => el('div', {class: 'fw', title: `${castName(id)}: ${n}× gesproken`}, face(id, {size: 56}), el('span', {class: 'fwn', text: castName(id)}), el('span', {class: 'fwc', text: `${n}×`}))))) : null;
  const relBlock = rels.length ? el('div', {class: 'sumblock'},
    el('h3', {class: 'label sumg', text: 'Relaties'}),
    el('div', {class: 'rels'}, rels.map(r => el('div', {class: 'rel'}, face(r.npc, {size: 44, mood: r.v >= 3 ? 'happy' : r.v <= -2 ? 'angry' : 'neutral', name: r.name}),
      el('div', {class: 'relb'}, el('div', {class: 'relh'}, el('b', {text: r.name}), el('span', {class: `relw ${r.v > 0 ? 'pos' : r.v < 0 ? 'neg' : ''}`, text: relWord(r.v)})),
        el('span', {class: 'relm', role: 'img', 'aria-label': `${r.name}: ${relWord(r.v)} (${r.v})`}, el('i', {class: r.v >= 0 ? 'pos' : 'neg', style: `--w:${Math.min(1, Math.abs(r.v) / scale) * 50}%`}))))))) : null;
  return section('Mensen', null, wall, relBlock);
}

function achievements() {
  const list = Array.isArray(ON.achievementList) ? ON.achievementList.filter(Boolean) : [];
  if (!list.length) return null;
  const have = new Set(G.achievements || []);
  const sorted = [...list.filter(a => have.has(a.id)), ...list.filter(a => !have.has(a.id))];
  return section('Prestaties', `${list.filter(a => have.has(a.id)).length} van de ${list.length} behaald.`,
    el('div', {class: 'achs'}, sorted.map(a => {
      const got = have.has(a.id);
      return el('div', {class: `ach${got ? ' got' : ''}`}, el('span', {class: 'ai', 'aria-hidden': 'true', text: got ? (a.icon || '★') : '?'}),
        el('div', {}, el('b', {text: a.name}), el('p', {text: got ? (a.text || '') : 'Nog niet behaald.'})));
    })));
}

function titlesInfo(f, style) {
  return el('details', {class: 'sumtitles'}, el('summary', {text: 'Alle titels, en hoe je ze krijgt'}),
    el('p', {class: 'sumsub', text: 'De eerste titel in deze lijst waarvan de regel klopt, wordt je titel. Daarna tellen er nog drie als bijtitel.'}),
    el('ol', {}, TITLES.map(t => el('li', {class: t.id === style.id ? 'me' : style.also.some(a => a.id === t.id) ? 'also' : ''},
      el('b', {text: titleName(t, f)}), ' · ', t.rule))));
}

// ---------------------------------------------------------------- styles
addStyles('summary', `
.face{--s:44px;width:var(--s);height:var(--s);flex:none;border-radius:28%;display:inline-grid;place-items:center;overflow:hidden;position:relative;
 background:radial-gradient(circle at 35% 30%,hsl(var(--fh,30) 42% 46%),hsl(var(--fh,30) 38% 26%));border:1px solid rgba(242,226,196,.28);box-shadow:0 3px 10px rgba(0,0,0,.35)}
.face img{width:100%;height:100%;object-fit:cover;display:block}
.face.img{background:#1d1710}
.face .ini{font-family:var(--f-display);font-weight:700;font-size:calc(var(--s) * .4);color:#fff4dc;text-shadow:0 1px 3px rgba(0,0,0,.5);letter-spacing:.02em}
.face.ini0{background:rgba(232,194,122,.12)}
.sumhero{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;padding:22px 24px;border-radius:16px;border:1px solid rgba(232,194,122,.35);
 background:radial-gradient(120% 140% at 0% 0%,rgba(232,194,122,.16),rgba(0,0,0,.25) 60%);margin-bottom:26px}
.sumface .face{border-radius:24px;border-color:rgba(232,194,122,.6);box-shadow:0 0 0 4px rgba(232,194,122,.12),0 8px 24px rgba(0,0,0,.45)}
.sumname{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-family:var(--f-body);font-size:20px;margin:4px 0 2px}
.archpill{font-family:var(--f-ui);font-size:12px;letter-spacing:.06em;padding:2px 10px;border-radius:12px;border:1px solid rgba(185,162,255,.5);color:var(--c-violet,#d8ccff);background:rgba(185,162,255,.1)}
.end .sumtitle{font-family:var(--f-display);font-weight:700;font-size:clamp(28px,4.4vw,44px);line-height:1.08;margin:4px 0 6px;color:var(--gold-hi);text-shadow:0 2px 22px rgba(232,170,80,.3)}
.sumline{font-family:var(--f-body);font-style:italic;font-size:19px;line-height:1.45;margin:0;color:var(--c-cream,#eadcbc);max-width:640px}
.sumalso{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:12px}
.tchip{font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid var(--line-strong);background:rgba(0,0,0,.25);color:var(--parch)}
.sumsec{margin:0 0 30px}
.sumh{font-family:var(--f-display);font-weight:600;font-size:21px;margin:0 0 4px;color:var(--parch);display:flex;align-items:center;gap:12px}
.sumh::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line-strong),transparent)}
.sumsub{margin:2px 0 10px;font-family:var(--f-body);font-size:16px;line-height:1.4;color:var(--dim)}
.sumg{margin:16px 0 8px}
.sumblock{margin-top:8px}
.end .sumstats{margin:10px 0 0;grid-template-columns:repeat(auto-fill,minmax(168px,1fr))}
.depths{display:grid;gap:8px;margin-top:10px}
.drow{display:grid;grid-template-columns:minmax(150px,230px) 1fr 70px;gap:12px;align-items:center}
.drow .dl{display:grid;line-height:1.2}
.drow .dl b{font-family:var(--f-body);font-size:17px;font-weight:600}
.drow .dl small{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.dbar{height:12px;border-radius:7px;background:rgba(0,0,0,.4);border:1px solid rgba(242,226,196,.12);overflow:hidden}
.dbar i{display:block;height:100%;width:calc(var(--w) * 100%);border-radius:7px;background:linear-gradient(90deg,#c98a3e,#ffe0a0)}
.drow.d1 .dbar i{background:linear-gradient(90deg,#b8862e,#ffd36b)}.drow.d2 .dbar i{background:linear-gradient(90deg,#6f7fd0,#b9c4ff)}
.drow.d3 .dbar i{background:linear-gradient(90deg,#4f9a72,#9fe0b0)}.drow.d4 .dbar i{background:linear-gradient(90deg,#8e62c9,#d4b6ff)}
.drow.rest .dbar i{background:repeating-linear-gradient(45deg,rgba(242,226,196,.25) 0 6px,rgba(242,226,196,.1) 6px 12px)}
.drow .dt{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--dim);text-align:right;white-space:nowrap}
.dcounts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 2px}
.dcounts span{font-size:13px;padding:3px 11px;border-radius:12px;border:1px solid var(--line)}
.dcounts .strong{color:var(--good);border-color:rgba(143,224,160,.45)}.dcounts .open{color:var(--open);border-color:rgba(242,196,107,.45)}.dcounts .blind{color:var(--blind)}
.dcell .dmeta{font-size:12px;color:var(--dim)}
.finds{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px}
.find{padding:11px 13px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.22);display:grid;gap:6px}
.find .fh{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.find .fh b{font-family:var(--f-display);font-size:14px}
.find .fn{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--gold-hi)}
.find .fs{font-size:12px;color:var(--dim)}
.meter{display:block;height:8px;border-radius:5px;background:rgba(0,0,0,.42);overflow:hidden}
.meter i{display:block;height:100%;width:calc(var(--m) * 100%);background:var(--mc);border-radius:5px;box-shadow:0 0 10px color-mix(in srgb,var(--mc) 50%,transparent)}
.cards2{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.mini{padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:rgba(0,0,0,.2)}
.mini b{font-family:var(--f-display);font-size:14px;color:var(--gold-hi)}
.mini small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-top:1px}
.mini small.eff{text-transform:none;letter-spacing:0;font-size:12px;color:var(--good)}
.mini p{margin:4px 0 0;font-family:var(--f-body);font-size:16px;line-height:1.35}
.mini.trink{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start}
.ticon{font-size:24px;line-height:1;width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:rgba(159,224,176,.1);border:1px solid rgba(159,224,176,.3)}
.bingo{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;max-width:640px}
.bingo.sq{grid-template-columns:repeat(var(--n),minmax(0,1fr))}
.bw{min-height:58px;display:grid;place-items:center;text-align:center;padding:6px;border-radius:9px;border:1px dashed rgba(242,226,196,.22);font-family:var(--f-body);font-size:15px;line-height:1.15;color:var(--dim);background:rgba(0,0,0,.18);position:relative;overflow-wrap:anywhere}
.bw.on{color:#2a1a08;border:1px solid #f0cf88;background:radial-gradient(circle at 50% 45%,#ffe6a8,#e8b65e);font-weight:600}
.bw.on::after{content:'';position:absolute;inset:7px;border-radius:50%;border:2px solid rgba(170,60,30,.45);transform:rotate(-8deg)}
.chlist{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px;position:relative}
.ch{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:11px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.2)}
.chh{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.chw{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.chh b{font-family:var(--f-display);font-size:15px;color:var(--gold-hi)}
.chb p{margin:3px 0 0;font-family:var(--f-body);font-size:17px;line-height:1.4}
.facewall{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px}
.fw{display:grid;justify-items:center;gap:3px;text-align:center;padding:8px 4px;border-radius:12px;background:rgba(0,0,0,.18);border:1px solid rgba(242,226,196,.08)}
.fwn{font-size:12px;line-height:1.2;color:var(--parch)}
.fwc{font-size:11px;color:var(--dim)}
.rels{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.rel{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.2)}
.relh{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:6px}
.relh b{font-family:var(--f-body);font-size:17px}
.relw{font-size:12px;color:var(--dim)}.relw.pos{color:var(--good)}.relw.neg{color:var(--danger)}
.relm{display:block;position:relative;height:8px;border-radius:5px;background:rgba(0,0,0,.42)}
.relm::before{content:'';position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:rgba(242,226,196,.35);border-radius:1px}
.relm i{position:absolute;top:0;bottom:0;width:var(--w);border-radius:5px}
.relm i.pos{left:50%;background:linear-gradient(90deg,#5fae78,#9fe0b0)}
.relm i.neg{right:50%;background:linear-gradient(270deg,#c8584a,#ff9a8a)}
.achs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-top:6px}
.ach{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.2);opacity:.55}
.ach.got{opacity:1;border-color:rgba(232,194,122,.45);background:linear-gradient(135deg,rgba(232,194,122,.12),rgba(0,0,0,.2))}
.ach .ai{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:rgba(0,0,0,.35);border:1px solid var(--line)}
.ach.got .ai{background:radial-gradient(circle at 40% 35%,#ffe6a8,#c98a3e);border-color:#f0cf88;color:#2a1a08}
.ach b{font-family:var(--f-display);font-size:14px}
.ach p{margin:2px 0 0;font-size:13px;line-height:1.35;color:var(--dim)}
.sumtitles{margin:8px 0 0;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,.18)}
.sumtitles summary{cursor:pointer;font-family:var(--f-display);font-size:15px;color:var(--gold-hi)}
.sumtitles ol{margin:6px 0 0;padding-left:22px;display:grid;gap:5px;font-family:var(--f-body);font-size:16px;line-height:1.35;color:var(--dim)}
.sumtitles li b{color:var(--parch);font-weight:600}
.sumtitles li.me{color:var(--parch)}.sumtitles li.me b{color:var(--gold-hi)}.sumtitles li.me::marker{color:var(--gold)}
.sumtitles li.also b{color:var(--c-violet,#d8ccff)}
@media (max-width:640px){
 .sumhero{grid-template-columns:1fr;justify-items:start;gap:14px;padding:18px}
 .sumface .face{--s:88px!important}
 .drow{grid-template-columns:1fr 64px;gap:4px 10px}.drow .dbar{grid-column:1/3;grid-row:2}
 .end .sumstats{grid-template-columns:repeat(2,minmax(0,1fr))}
 .facewall{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
 .bw{min-height:50px;font-size:13px;padding:4px}
}
@media print{
 .sumhero{background:#fff!important;border-color:rgba(122,85,18,.5)!important}
 .sumtitle{text-shadow:none!important}
 .find,.mini,.ch,.rel,.ach,.fw,.sumtitles{background:#fff!important;break-inside:avoid}
 .sumtitles{display:none}
 .sumh,.sumg{break-after:avoid}
 .sumhero,.drow,.dcell{break-inside:avoid}
 .dbar,.meter,.relm{background:#e9e3d8!important;border-color:#d6cec0!important}
 .archpill{color:#55389a!important}
 .bw{color:#4d433a}
}
`);
void CHAMBERS;
