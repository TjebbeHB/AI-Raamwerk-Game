// 'Nabespreking': turns a play session into a group conversation. Per chamber: the state,
// the measures you chose against the fitting ones (with the framework's feedback), what the
// council voted (per role when known), the trial, questions to discuss and one small thing to
// try in your own organisation. Works without a council, for old saves and the Snelle Lift.
import {el, addStyles} from '../core/util.js';
import {ON, CAST} from '../game/bus.js';
import {G} from '../game/state.js';
import {assess, CHAMBERS, CHAMBER, STATE_LABEL, VERDICT, JUDGEMENTS} from '../content/framework.js';
import {NABESPREKING, FACILITATOR, VERDICT_TALK, SHORTCUT_TALK, GUARDIAN, facts, councilView, differs, differsVerdict} from '../content/nabespreking.js';
import {face} from './summary.js';
import {roleChips} from './decision.js';

const GROUP = {necessity: 'Noodzaak', foundation: 'Fundament', domain: 'Domein'};
const STATUS = {correct: 'Past', supporting: 'Goede aanvulling', incorrect: 'Werkt averechts'};
const FILTERS = [
  {id: 'all', name: 'Alle kamers', test: () => true},
  {id: 'open', name: 'Open punten', test: x => x.state === 'open'},
  {id: 'blind', name: 'Blinde vlekken', test: x => x.state === 'blind'},
  {id: 'differ', name: 'Raad en speler verschillen', test: x => x.differ},
];
const EMPTY = {
  open: 'Geen open punten: elke kamer die je afwoog, staat stevig.',
  blind: 'Geen blinde vlekken: je hebt elke kamer bekeken. Knap werk.',
  differ: 'De raad en de speler kozen overal hetzelfde. Of jullie zijn het echt eens, of iemand heeft heel overtuigend gepraat.',
  differNone: 'Er stemde geen adviesraad mee. Start bij een volgend spel de adviesraad in het menu (Esc): dan zie je hier waar de raad anders koos dan de speler.',
};
const S = {filter: 'all', facil: true};      // remembered while the page is open

export function renderDebrief(p, {download, print} = {}) {
  const d = assess(), v = G.verdict, f = facts(G, d, ON), council = G.council && typeof G.council === 'object' ? G.council : {};
  const rows = d.chambers.map(c => {
    const ch = CHAMBER[c.id], last = G.chambers[c.id]?.attempts?.at(-1) || null;
    const view = councilView(council[c.id], ch.options.length);
    return {...c, ch, last, entry: council[c.id] || null, view, differ: differs(last?.selection, view)};
  });
  const anyCouncil = rows.some(r => r.view) || !!councilView(council.verdict, VERDICT.length);
  let date = '';
  try { date = new Date().toLocaleDateString('nl-NL', {day: 'numeric', month: 'long', year: 'numeric'}); } catch (e) { /* no date */ }

  p.append(el('div', {class: 'printonly dbprint'}, el('b', {text: 'Het Orakel van Dalwijk · nabespreking'}), el('span', {text: date})));
  p.append(el('div', {class: 'dbtop'},
    el('div', {}, el('div', {class: 'eyebrow', text: 'Nabespreking'}), el('h1', {class: 'dbh1', text: 'Van spel naar gesprek'}),
      el('p', {class: 'dbintro', text: 'Per kamer: wat je koos, wat er paste, wat de adviesraad vond en waar je samen over kunt praten. Gebruik de filters om te kiezen waar je begint.'})),
    el('div', {class: 'dbactions noprint'},
      print ? el('button', {class: 'btn', onclick: print}, 'Print de nabespreking') : null,
      download ? el('button', {class: 'btn', onclick: download}, 'Download als Markdown') : null)));
  p.append(facilitator(), verdictCard(d, v, f, council));

  // filters and the chamber cards
  const list = el('div', {class: 'dblist'});
  const bar = el('div', {class: 'dbfilters', role: 'group', 'aria-label': 'Filter de kamers'});
  const status = el('p', {class: 'sr', 'aria-live': 'polite'});
  const counts = Object.fromEntries(FILTERS.map(x => [x.id, rows.filter(x.test).length]));
  const draw = () => {
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === S.filter)));
    list.innerHTML = '';
    const flt = FILTERS.find(x => x.id === S.filter) || FILTERS[0];
    const shown = rows.filter(flt.test);
    if (!shown.length) list.append(el('p', {class: 'dbempty', text: S.filter === 'differ' && !anyCouncil ? EMPTY.differNone : EMPTY[S.filter] || ''}));
    for (const r of shown) list.append(chamberCard(r));
    status.textContent = `${flt.name}: ${shown.length} ${shown.length === 1 ? 'kamer' : 'kamers'}`;
  };
  for (const x of FILTERS) bar.append(el('button', {class: 'btn dbf', type: 'button', 'data-f': x.id, 'aria-pressed': 'false', onclick: () => { S.filter = x.id; draw(); }},
    x.name, el('span', {class: 'cnt', text: String(counts[x.id])})));
  p.append(el('h2', {class: 'sumh dbkh', text: 'De kamers'}), bar, status, list);
  draw();
  watchPrint(p);
}

// ---------------------------------------------------------------- the facilitator's card
function facilitator() {
  const box = el('details', {class: 'facil', open: S.facil ? true : null, ontoggle: e => { S.facil = e.target.open; }},
    el('summary', {}, el('span', {class: 'fi', 'aria-hidden': 'true', text: '◷'}), el('span', {text: FACILITATOR.title})),
    el('p', {class: 'facin', text: FACILITATOR.intro}),
    el('ol', {class: 'steps'}, FACILITATOR.steps.map(s => el('li', {}, el('span', {class: 'min', text: `${s.min} min`}), el('b', {text: s.title}), el('p', {text: s.text})))),
    el('ul', {class: 'tips'}, FACILITATOR.tips.map(t => el('li', {text: t}))));
  return box;
}

// ---------------------------------------------------------------- the verdict
function verdictCard(d, v, f, council) {
  const card = el('section', {class: 'dbverdict'});
  if (v && VERDICT[v.choice]) {
    const view = councilView(council.verdict, VERDICT.length), diff = differsVerdict(v.choice, view);
    card.append(el('h2', {class: 'sumh', text: 'Het besluit'}),
      el('div', {class: 'vrow'},
        el('div', {class: 'vbox me'}, el('span', {class: 'label', text: 'Jullie besluit'}), el('b', {text: VERDICT[v.choice].title})),
        el('div', {class: 'vbox'}, el('span', {class: 'label', text: 'Het dossier droeg'}), el('b', {text: VERDICT[v.ceiling]?.title || ''})),
        el('div', {class: 'vbox'}, el('span', {class: 'label', text: 'Oordeel'}), el('b', {text: JUDGEMENTS[v.judgement] || ''}))));
    if (view) card.append(el('div', {class: 'vcouncil'},
      el('div', {class: 'label', text: `De adviesraad · ${view.ballots} ${view.ballots === 1 ? 'stem' : 'stemmen'}${diff ? ' · koos een ander besluit' : ''}`}),
      VERDICT.map((o, i) => voteRow(o.title, view, council.verdict, i, i === v.choice)), roleChips(council.verdict, -1, {legend: true})));
    if (d.reasons.length) card.append(el('details', {class: 'reasons'}, el('summary', {text: `Wat het besluit begrenst (${d.reasons.length})`}),
      el('ul', {}, d.reasons.map(r => el('li', {text: r.text})))));
    card.append(questions(VERDICT_TALK.map(q => q({choice: VERDICT[v.choice].title, ceiling: VERDICT[v.ceiling]?.title || '', same: v.choice === v.ceiling})), 'Over het besluit'));
  } else if (f.shortcut) {
    card.classList.add('lift');
    card.append(el('h2', {class: 'sumh', text: 'De Snelle Lift'}),
      el('div', {class: 'vrow'}, el('div', {class: 'vbox me'}, el('span', {class: 'label', text: 'Jullie besluit'}), el('b', {text: 'Getekend bij Glans'})),
        el('div', {class: 'vbox'}, el('span', {class: 'label', text: 'Het dossier'}), el('b', {text: `${f.blind} van ${f.chambers} kamers blinde vlek`}))),
      el('p', {class: 'dbintro', text: 'Je sloeg het hele Gewelf over. Dat is ook een gespreksonderwerp: wanneer is snel te snel? De kaarten hieronder laten zien wat er in elke kamer had gepast.'}),
      questions(SHORTCUT_TALK, 'Over de Snelle Lift'));
  } else {
    card.append(el('h2', {class: 'sumh', text: 'Het besluit'}), el('p', {class: 'dbintro', text: 'Er is nog geen besluit bezegeld. De kamers hieronder laten zien waar het dossier nu staat.'}));
  }
  return card;
}

// one row of council votes: label, a bar, the count and the roles behind it
function voteRow(label, view, entry, i, mine) {
  const n = view.counts[i] || 0, share = view.ballots ? n / view.ballots : 0;
  return el('div', {class: `vote${mine ? ' mine' : ''}${view.majority.includes(i) ? ' maj' : ''}`},
    el('span', {class: 'vl', text: label}),
    el('span', {class: 'vb', role: 'img', 'aria-label': `${n} van ${view.ballots} stemmen`}, el('i', {style: `--w:${share}`})),
    el('span', {class: 'vn', text: String(n)}), roleChips(entry, i));
}

function questions(list, title) {
  return el('div', {class: 'qs'}, el('h4', {class: 'label', text: title}), el('ol', {}, list.map(q => el('li', {text: q}))));
}

// ---------------------------------------------------------------- a chamber
function chamberCard(r) {
  const {ch, last, view, entry} = r, talk = NABESPREKING[r.id], sel = new Set(last?.selection || []);
  const tries = G.chambers[r.id]?.attempts?.length || 0, who = GUARDIAN[r.id];
  const card = el('article', {class: `dbc ${r.state}${r.critical ? ' crit' : ''}`, 'aria-labelledby': `dbc-${r.id}`});
  card.append(el('header', {class: 'dbch'},
    who ? face(who, {size: 50}) : null,
    el('div', {class: 'dbct'},
      el('div', {class: 'label', text: `${GROUP[r.group] || ''}${r.critical ? ' · kritisch voor Dalwijk' : ''}`}),
      el('h3', {id: `dbc-${r.id}`, text: ch.title}),
      el('div', {class: 'dbcw', text: `${ch.place}${who && CAST[who]?.name ? ` · ${CAST[who].name}` : ''}`})),
    el('div', {class: 'badges'},
      el('span', {class: `badge st-${r.state}`, text: STATE_LABEL[r.state]}),
      r.differ ? el('span', {class: 'badge differ', text: 'Raad koos anders'}) : null,
      tries > 1 ? el('span', {class: 'badge', text: `${tries}× afgewogen`}) : null)));

  // the measures: what you chose, what fitted, and the council next to it
  const opts = el('div', {class: `dbopts${view ? ' withc' : ''}`});
  if (view) opts.append(el('div', {class: 'dboh'}, el('span', {text: last ? 'Jij' : ''}), el('span', {text: 'Maatregel'}), el('span', {class: 'c', text: `Raad · ${view.ballots} ${view.ballots === 1 ? 'stem' : 'stemmen'}`})));
  ch.options.forEach((o, i) => {
    const chosen = sel.has(i);
    const kind = !last ? 'none' : chosen ? (o.status === 'incorrect' ? 'bad' : o.status === 'correct' ? 'good' : 'plus') : o.status === 'correct' ? 'miss' : o.status === 'incorrect' ? 'avoid' : 'skip';
    const mark = {good: '✓', plus: '✓', bad: '✕', miss: '○'}[kind] || '';
    const verdict = {good: 'Gekozen · past', plus: 'Gekozen · goede aanvulling', bad: 'Gekozen · werkt averechts', miss: 'Gemist · past wel',
      avoid: 'Terecht niet gekozen · werkt averechts', skip: 'Niet gekozen · goede aanvulling', none: STATUS[o.status]}[kind];
    const learn = kind === 'bad' || kind === 'miss' || (kind === 'none' && o.status === 'correct');
    // where your choice and the council's majority part ways
    const theirs = view ? view.majority.includes(i) : null, split = view && (last ? chosen !== theirs : theirs);
    opts.append(el('div', {class: `dbo k-${kind} s-${o.status}${learn ? ' learn' : ''}${split ? ' split' : ''}`},
      el('span', {class: 'mk', 'aria-hidden': 'true', text: mark}),
      el('div', {class: 'ot'}, el('p', {text: o.text}),
        el('span', {class: 'os'}, el('b', {text: verdict})),
        o.feedback ? el('p', {class: 'ofb', text: o.feedback}) : null),
      view ? el('div', {class: 'oc'}, el('span', {class: 'vb', role: 'img', 'aria-label': `${view.counts[i]} van ${view.ballots} stemmen`}, el('i', {style: `--w:${view.ballots ? view.counts[i] / view.ballots : 0}`})),
        el('span', {class: 'vn', text: String(view.counts[i])}), roleChips(entry, i),
        split ? el('span', {class: 'ctag', text: theirs ? 'De raad koos dit wel' : 'De raad koos dit niet'}) : null) : null));
  });
  const fbToggle = el('button', {class: 'linkb noprint', type: 'button', 'aria-expanded': 'false', onclick: () => {
    const on = card.classList.toggle('allfb');
    fbToggle.setAttribute('aria-expanded', String(on));
    fbToggle.textContent = on ? 'Toon alleen de leerpunten' : 'Toon de uitleg bij alle maatregelen';
  }}, 'Toon de uitleg bij alle maatregelen');
  card.append(el('div', {class: 'dbsec'}, el('div', {class: 'dbsh'}, el('h4', {class: 'label', text: last ? 'Jouw afweging' : 'Niet onderzocht · wat had gepast'}), fbToggle), opts));
  if (r.entry && !view) card.append(el('p', {class: 'dbnote', text: 'De adviesraad keek mee, maar stemde hier niet.'}));

  // the trial
  const tr = ch.trial;
  if (tr?.finding) {
    card.append(G.flags[`trial:${r.id}`]
      ? el('div', {class: 'dbtrial'}, el('h4', {class: 'label', text: `De proef · ${tr.title || ''}`}), el('p', {text: tr.finding}))
      : el('details', {class: 'dbtrial off'}, el('summary', {text: `De proef ‘${tr.title || 'van deze kamer'}’ deed je niet. Wat die liet zien`}), el('p', {text: tr.finding})));
  }
  // what to talk about, and what to try at work
  if (talk) {
    card.append(questions(talk.questions, 'Gespreksvragen'),
      el('div', {class: 'own'}, el('h4', {class: 'label', text: 'Voor je eigen organisatie'}), el('p', {text: talk.own}),
        ch.reflection ? el('p', {class: 'refl', text: `Uit het raamwerk: ${ch.reflection}`}) : null));
  }
  return card;
}

// open every collapsed part while printing, and close them again afterwards
let printWatch = null;
function watchPrint(p) {
  if (printWatch) { removeEventListener('beforeprint', printWatch.before); removeEventListener('afterprint', printWatch.after); }
  let opened = [];
  const before = () => { if (p.hidden) return; opened = [...p.querySelectorAll('details:not([open])')]; opened.forEach(x => { x.open = true; }); };
  const after = () => { opened.forEach(x => { x.open = false; }); opened = []; };
  addEventListener('beforeprint', before); addEventListener('afterprint', after);
  printWatch = {before, after};
}

// ---------------------------------------------------------------- styles
addStyles('debrief', `
:root{--c-cream:#eadcbc;--c-sky:#cfe0ff;--c-blue:#9fc3ff;--c-violet:#d8ccff;--c-mint:#b5d8bf}
@media print{:root{--c-cream:#2a2018;--c-sky:#1f3f6e;--c-blue:#1d4f91;--c-violet:#55389a;--c-mint:#2f6b45}}
.dbtop{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between;margin-bottom:18px}
.dbtop>div:first-child{flex:1 1 520px;min-width:0}
.dbactions{flex:none}
.end .dbh1{font-family:var(--f-display);font-size:clamp(28px,4.2vw,42px);margin:6px 0 6px}
.dbintro{font-family:var(--f-body);font-size:18px;line-height:1.45;color:var(--c-cream);margin:0;max-width:700px}
.dbactions{display:flex;gap:8px;flex-wrap:wrap}
.facil{margin:0 0 22px;padding:14px 18px 16px;border-radius:14px;border:1px solid rgba(159,195,255,.32);background:linear-gradient(135deg,rgba(159,195,255,.09),rgba(0,0,0,.22))}
.facil summary{cursor:pointer;display:flex;gap:10px;align-items:center;font-family:var(--f-display);font-size:17px;font-weight:600;color:var(--c-sky);list-style:none}
.facil summary::-webkit-details-marker{display:none}
.facil summary::after{content:'▾';margin-left:auto;color:var(--dim);transition:transform .2s}
.facil:not([open]) summary::after{transform:rotate(-90deg)}
.facil .fi{font-size:18px}
.facin{margin:10px 0 12px;font-family:var(--f-body);font-size:17px;line-height:1.45}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;counter-reset:st}
.steps li{position:relative;padding:12px 12px 12px;border-radius:11px;background:rgba(0,0,0,.28);border:1px solid var(--line);counter-increment:st}
.steps li::before{content:counter(st);position:absolute;right:10px;top:8px;font-family:var(--f-display);font-size:22px;color:var(--c-sky);opacity:.3}
.steps .min{display:inline-block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--c-blue);margin-bottom:3px}
.steps b{display:block;font-family:var(--f-display);font-size:15px;color:var(--parch);margin-bottom:4px}
.steps p{margin:0;font-family:var(--f-body);font-size:15px;line-height:1.4;color:var(--dim)}
.tips{margin:12px 0 0;padding-left:20px;display:grid;gap:4px;font-family:var(--f-body);font-size:16px;line-height:1.4;color:var(--dim)}
.dbverdict{margin:0 0 26px;padding:18px 20px;border-radius:14px;border:1px solid rgba(232,194,122,.38);background:radial-gradient(120% 140% at 100% 0%,rgba(232,194,122,.13),rgba(0,0,0,.24) 60%)}
.dbverdict .sumh{margin-bottom:12px}
.dbverdict.lift{border-color:rgba(255,211,107,.55)}
.vrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px}
.vbox{padding:10px 13px;border-radius:11px;background:rgba(0,0,0,.3);border:1px solid var(--line);display:grid;gap:3px}
.vbox b{font-family:var(--f-display);font-size:17px;color:var(--parch)}
.vbox.me{border-color:rgba(232,194,122,.55)}.vbox.me b{color:var(--gold-hi)}
.vcouncil{display:grid;gap:6px;margin:6px 0 12px;padding:12px 14px;border-radius:11px;background:rgba(0,0,0,.24);border:1px solid var(--line)}
.vote{display:grid;grid-template-columns:minmax(150px,220px) 1fr 28px;gap:4px 12px;align-items:center}
.vote .vl{font-family:var(--f-body);font-size:16px}
.vote.mine .vl{color:var(--gold-hi);font-weight:600}
.vote.mine .vl::after{content:' · jullie keuze';font-family:var(--f-ui);font-size:11px;font-weight:400;color:var(--gold)}
.vote .rchips{grid-column:2/4}
.vb{display:block;height:9px;border-radius:5px;background:rgba(0,0,0,.42);overflow:hidden}
.vb i{display:block;height:100%;width:calc(var(--w) * 100%);min-width:2px;background:linear-gradient(90deg,#7d6a4c,#b9aa8c);border-radius:5px}
.maj .vb i{background:linear-gradient(90deg,#c98a3e,#ffe0a0)}
.vn{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--parch);text-align:right}
.reasons{margin:0 0 12px}
.reasons summary,.dbtrial.off summary{cursor:pointer;font-size:13px;color:var(--dim)}
.reasons ul{margin:8px 0 0;padding-left:20px;font-family:var(--f-body);font-size:16px;line-height:1.4;display:grid;gap:4px}
.qs{margin-top:12px}
.qs ol{margin:6px 0 0;padding-left:24px;display:grid;gap:6px;font-family:var(--f-body);font-size:18px;line-height:1.42}
.qs li::marker{font-family:var(--f-display);color:var(--gold)}
.dbkh{margin-top:4px}
.dbfilters{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px;padding:8px 0}
@media (min-width:701px) and (min-height:560px){.dbfilters{position:sticky;top:58px;z-index:3;margin:4px -12px 12px;padding:9px 12px;
 background:linear-gradient(rgba(15,11,7,.97),rgba(15,11,7,.95));box-shadow:0 12px 14px -12px rgba(0,0,0,.7)}}
.dbf{display:inline-flex;align-items:center;gap:8px}
.dbf .cnt{font-size:12px;min-width:22px;padding:0 6px;line-height:19px;border-radius:10px;background:rgba(0,0,0,.4);border:1px solid var(--line);text-align:center}
.dbf[aria-pressed="true"] .cnt{background:var(--gold);color:#22170b;border-color:var(--gold)}
.dblist{display:grid;gap:14px}
.dbempty{padding:18px;border-radius:12px;border:1px dashed var(--line-strong);font-family:var(--f-body);font-size:18px;color:var(--dim);margin:0}
.dbc{padding:16px 18px 18px;border-radius:14px;border:1px solid var(--line);background:rgba(0,0,0,.24);border-left:4px solid var(--blind)}
.dbc.strong{border-left-color:var(--good)}.dbc.open{border-left-color:var(--open)}
.dbch{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;margin-bottom:12px}
.dbct h3{font-family:var(--f-display);font-size:20px;margin:1px 0 2px;color:var(--parch)}
.dbc.crit .dbct h3::after{content:' ★';color:var(--gold)}
.dbcw{font-size:13px;color:var(--dim)}
.badges{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.badge{font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid var(--line-strong);white-space:nowrap;color:var(--dim)}
.badge.st-strong{color:var(--good);border-color:rgba(143,224,160,.55);background:rgba(143,224,160,.08)}
.badge.st-open{color:var(--open);border-color:rgba(242,196,107,.55);background:rgba(242,196,107,.08)}
.badge.st-blind{color:#cfc6bd;border-color:rgba(154,143,134,.6);background:rgba(154,143,134,.1)}
.badge.differ{color:var(--c-violet);border-color:rgba(185,162,255,.55);background:rgba(185,162,255,.1)}
.dbsh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.linkb{background:none;border:0;padding:2px 0;font-size:13px;color:var(--gold);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.dbopts{display:grid;gap:6px}
.dboh{display:grid;grid-template-columns:28px 1fr 236px;gap:12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);padding:0 12px}
.dboh .c{text-align:left}
.dbo{display:grid;grid-template-columns:28px 1fr;gap:12px;align-items:start;padding:9px 12px;border-radius:10px;border:1px solid rgba(242,226,196,.1);background:rgba(242,226,196,.03)}
.withc .dbo{grid-template-columns:28px 1fr 236px}
.dbo .mk{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;font-size:14px;font-weight:700;border:2px solid var(--line-strong);margin-top:1px}
.dbo.k-good .mk{background:var(--good);border-color:var(--good);color:#0f2a17}
.dbo.k-plus .mk{background:#9fc3ff;border-color:#9fc3ff;color:#102035}
.dbo.k-bad .mk{background:var(--danger);border-color:var(--danger);color:#2a0d08}
.dbo.k-miss .mk{border-color:var(--open);color:var(--open);border-style:dashed}
.dbo.k-avoid .mk,.dbo.k-skip .mk{border-color:rgba(242,226,196,.15)}
.dbo.k-none .mk{border:0}
.dbo.k-good{border-color:rgba(143,224,160,.35)}.dbo.k-bad{border-color:rgba(255,124,104,.45);background:rgba(255,124,104,.06)}.dbo.k-miss{border-color:rgba(242,196,107,.45);background:rgba(242,196,107,.05)}
.ot p{margin:0;font-family:var(--f-body);font-size:17px;line-height:1.38}
.os{display:block;margin-top:3px;font-size:12px;color:var(--dim)}
.os b{font-weight:700;letter-spacing:.04em}
.k-good .os b{color:var(--good)}.k-plus .os b{color:var(--c-blue)}.k-bad .os b{color:var(--danger)}.k-miss .os b{color:var(--open)}.k-avoid .os b{color:var(--c-mint)}
.k-none.s-correct .os b{color:var(--good)}.k-none.s-incorrect .os b{color:var(--danger)}.k-none.s-supporting .os b{color:var(--c-blue)}
.ot .ofb{display:none;margin-top:5px;font-size:15px;line-height:1.4;color:var(--dim);border-left:2px solid var(--line-strong);padding-left:10px}
.dbo.learn .ofb,.dbc.allfb .ofb{display:block}
.oc{display:grid;grid-template-columns:1fr 26px;gap:5px 8px;align-items:center;padding-top:5px}
.oc .rchips{grid-column:1/3}
.ctag{grid-column:1/3;justify-self:start;font-size:11px;letter-spacing:.04em;padding:1px 8px;border-radius:9px;color:var(--c-violet);border:1px solid rgba(185,162,255,.5);background:rgba(185,162,255,.1)}
.dbo.split{box-shadow:inset 3px 0 0 rgba(185,162,255,.75)}
.dbnote{margin:8px 0 0;font-size:13px;color:var(--dim)}
.dbtrial{margin-top:12px;padding:10px 13px;border-radius:10px;background:rgba(159,195,255,.07);border:1px solid rgba(159,195,255,.24)}
.dbtrial p{margin:4px 0 0;font-family:var(--f-body);font-size:16px;line-height:1.4}
.dbtrial.off{background:rgba(0,0,0,.18);border-style:dashed}
.own{margin-top:12px;padding:11px 14px;border-radius:10px;background:linear-gradient(135deg,rgba(143,224,160,.09),rgba(0,0,0,.2));border:1px solid rgba(143,224,160,.3)}
.own .label{color:var(--good)}
.own p{margin:4px 0 0;font-family:var(--f-body);font-size:17px;line-height:1.42}
.own .refl{font-size:15px;color:var(--dim)}
@media (max-width:860px){.steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){
 .steps{grid-template-columns:1fr}
 .dbch{grid-template-columns:auto 1fr}.badges{grid-column:1/3;justify-content:flex-start}
 .withc .dbo{grid-template-columns:28px 1fr}.withc .dbo .oc{grid-column:2}
 .dboh{display:none}
 .vote{grid-template-columns:1fr 28px}.vote .vb{grid-column:1/3;grid-row:2}.vote .vn{grid-row:1;grid-column:2}.vote .rchips{grid-column:1/3}
 .dbfilters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
 .dbf{justify-content:space-between;text-align:left;font-size:13px;padding:8px 10px;line-height:1.2}
 .facil,.dbverdict,.dbc{padding-left:14px;padding-right:14px}
 .qs ol{font-size:17px}
}
@media print{
 .dbprint.printonly{display:flex!important;justify-content:space-between;gap:12px;font-size:10pt;border-bottom:1px solid #999;padding-bottom:6px;margin-bottom:12px}
 .dbkh{break-after:avoid}
 .vb{background:#e9e3d8!important}.vb i{min-width:0}
 .dbfilters,.dbactions{display:none!important}
 .facil,.dbverdict,.dbc,.vbox,.vcouncil,.steps li,.dbtrial,.own,.dbo{background:#fff!important;backdrop-filter:none!important}
 .dbc{break-inside:avoid-page;border:1px solid #bbb;border-left-width:4px}
 .dbverdict,.facil{break-inside:avoid}
 .end .dbh1{font-size:22pt}
 .qs ol,.ot p,.own p{font-size:11.5pt}
 .ofb{font-size:10pt!important}
}
`);
void CHAMBERS;
