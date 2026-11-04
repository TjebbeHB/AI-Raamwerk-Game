// The Zegelkamer: the dossier, the verdict, and the ending. The ending has three tabs:
// what happened afterwards (the epilogue), how your descent went ('Jouw afdaling') and a
// debrief that turns the session into a group conversation ('Nabespreking').
import {$, el, esc, addStyles} from '../core/util.js';
import {UI, SFX, NET, ON} from '../game/bus.js';
import {G, SETTINGS, saveGame} from '../game/state.js';
import {GAME} from '../game/game.js';
import {unlockForUi} from '../game/dialogue.js';
import {assess, judge, epilogue, report, VERDICT, VERDICT_QUESTION, JUDGEMENTS, STATE_LABEL, CHAMBER} from '../content/framework.js';
import {facts, playstyle, fmtMin} from '../content/nabespreking.js';
import {storeCouncil, roleChips} from './decision.js';
import {renderSummary} from './summary.js';
import {renderDebrief} from './debrief.js';

export function dossierGrid(d) {
  const grid = el('div', {class: 'dgrid'});
  for (const c of d.chambers) grid.append(el('div', {class: `dcell ${c.state} ${c.critical ? 'crit' : ''}`},
    el('b', {text: c.title}), el('span', {class: 'st', text: STATE_LABEL[c.state]}),
    el('span', {style: 'font-size:11px;color:var(--dim)', text: c.group === 'foundation' ? 'fundament' : c.group === 'domain' ? 'domein' : 'noodzaak'})));
  return grid;
}

// choose the verdict: returns {choice, ceiling, judgement}
export function decideVerdict() {
  const auto = window.__orakel?.autoVerdict;
  if (auto !== undefined) {
    const d = assess(), choice = auto === 'ceiling' ? d.ceiling : auto;
    G.verdict = {choice, ceiling: d.ceiling, judgement: judge(choice, d.ceiling), votes: null, at: Date.now()};
    storeCouncil('verdict');
    saveGame();
    return Promise.resolve(G.verdict);
  }
  return new Promise(resolve => {
    GAME.modal = 'decision'; unlockForUi();
    $('decision').hidden = false;
    $('decTitle').textContent = 'Het besluit';
    $('decPlace').textContent = 'De Zegelkamer · Diepte 4';
    let choice = null;
    NET.openVote?.('verdict', VERDICT_QUESTION, VERDICT.map(o => o.title), false);
    NET.onTally = () => render();
    const d = assess();
    function render() {
      const tally = NET.active && NET.tallies?.id === 'verdict' ? NET.tallies : null;
      const body = $('decBody');
      body.innerHTML = '';
      const opts = el('div', {class: 'opts'});
      VERDICT.forEach((o, i) => opts.append(el('button', {class: 'optb', 'aria-pressed': String(choice === i), onclick: () => { choice = i; SFX.play('switch'); render(); }},
        el('span', {class: 'box', text: choice === i ? '●' : ''}), el('span', {}, el('b', {style: 'font-family:var(--f-display);font-size:16px', text: o.title}), el('br'), o.text),
        el('span', {class: 'votes', text: tally ? `${tally.counts[i] || 0} ▲` : ''}),
        tally ? roleChips(tally, i) : null)));
      body.append(el('div', {class: 'dec'},
        el('div', {class: 'case'}, el('p', {text: 'Op de wanden van de Zegelkamer gloeit jullie dossier. Wat stevig staat, wat open is, en wat je nooit hebt bekeken.'}),
          dossierGrid(d), el('div', {class: 'q', text: VERDICT_QUESTION}), opts),
        el('div', {class: 'side'}, el('div', {class: 'verdictbox'}, el('h3', {text: 'Eerst kiezen, dan kijken'}),
          el('p', {style: 'margin:0;font-size:14px;line-height:1.5;color:var(--dim)', text: 'Pas nadat je het besluit bezegelt, laat het dossier zien welk besluit het kon dragen, en waarom. Er is geen score.'})),
          el('div', {class: 'label', text: `${d.strong.length} stevig · ${d.open.length} open · ${d.blind.length} blinde vlekken`}),
          tally ? el('div', {class: 'label', text: `Adviesraad: ${tally.ballots} stemmen`}) : null,
          tally ? roleChips(tally, -1, {legend: true}) : null)));
      const bar = $('decBar');
      bar.innerHTML = '';
      bar.append(el('span', {class: 'note', text: choice === null ? 'Kies één besluit.' : `Gekozen: ${VERDICT[choice].title}`}),
        el('button', {class: 'go', disabled: choice === null, onclick: seal}, 'Bezegel het besluit'));
    }
    function seal() {
      const live = NET.active && NET.tallies?.id === 'verdict' ? NET.tallies : null;
      const tally = live ? live.counts.slice() : null;
      storeCouncil('verdict', live);
      NET.closeVote?.(); NET.onTally = null;
      const j = judge(choice, d.ceiling);
      G.verdict = {choice, ceiling: d.ceiling, judgement: j, votes: tally, at: Date.now()};
      saveGame();
      SFX.play('bossDie');
      // show what the dossier could carry
      const body = $('decBody');
      body.innerHTML = '';
      body.append(el('div', {class: 'prose'},
        el('p', {}, 'Jullie besluit: ', el('b', {text: VERDICT[choice].title}), '.'),
        el('p', {}, 'Het hoogste besluit dat het dossier kon dragen: ', el('b', {text: VERDICT[d.ceiling].title}), '.'),
        el('h3', {text: JUDGEMENTS[j]}),
        d.reasons.length ? el('ul', {}, d.reasons.map(r => el('li', {text: r.text}))) : el('p', {text: 'Het dossier vond geen beperkingen. Alles wat ertoe deed, staat stevig.'})));
      const bar = $('decBar');
      bar.innerHTML = '';
      bar.append(el('button', {class: 'go', onclick: () => { $('decision').hidden = true; GAME.modal = null; resolve(G.verdict); }}, 'Een jaar later…'));
    }
    render();
  });
}

function stats() {
  const d = assess(), t = ON.totals || {}, f = facts(G, d, ON);
  return [
    [fmtMin(f.time), 'speeltijd'], [`${d.strong.length}/15`, 'kamers stevig'], [`${G.bronnen.length}/45`, 'bronnen gevonden'],
    [`${G.hallucs.length}/${t.hallucs ?? 12}`, 'hallucinaties'], [`${G.cards.length}/${t.cards ?? 8}`, 'visitekaartjes'], [`${G.crystals.length}/${t.crystals ?? 4}`, 'kristallen'],
    [G.stats.kills, 'monsters verslagen'], [G.stats.deaths, 'keer terug naar de koffie'],
  ];
}

// ---------------------------------------------------------------- the ending
// showEnding keeps its old options (the Snelle Lift in story/f0.js uses them); `tab` picks the
// tab to open with: 'epilogue' (default), 'summary' or 'debrief'.
export const END_TABS = ['epilogue', 'summary', 'debrief'];
const END = {select: null, tab: 'epilogue'};
const NAV_KEYS = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
let rootReady = false;

export function downloadReport() {
  const blob = new Blob([report()], {type: 'text/markdown'});
  const url = URL.createObjectURL(blob);
  const a = el('a', {href: url, download: G.verdict ? 'besluitdossier-dalwijk.md' : 'nabespreking-dalwijk.md'});
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function printEnding() {
  try { window.print(); } catch (e) { UI.toast?.('Printen lukt niet', 'Deze browser kan deze pagina niet printen.', 'warn'); }
}

export function showEnding({title, eyebrow = 'Een jaar later', text, judgement, again = true, extra = null, onAgain = null, againLabel = 'Kies opnieuw', tab = 'epilogue'} = {}) {
  GAME.mode = 'ending';
  unlockForUi();
  $('hud').hidden = true;
  // the touch controls would show through the ending; bring them back when you play on
  const touch = $('touch'), touchWas = touch ? !touch.hidden : false;
  if (touch) touch.hidden = true;
  const root = $('ending'), body = $('endBody');
  prepareRoot(root);
  root.classList.toggle('calm', SETTINGS.motion === 'reduced');
  body.innerHTML = '';
  body.classList.add('end2');
  const tabs = [
    {id: 'epilogue', name: eyebrow || 'De afloop', build: p => buildEpilogue(p, {title, eyebrow, text, judgement, extra, select: id => select(id, true)})},
    {id: 'summary', name: 'Jouw afdaling', build: p => renderSummary(p)},
    {id: 'debrief', name: 'Nabespreking', build: p => renderDebrief(p, {download: downloadReport, print: printEnding})},
  ];
  const list = el('div', {class: 'endtabs', role: 'tablist', 'aria-label': 'Het einde van je afdaling'});
  const btns = {}, panels = {}, built = {};
  for (const t of tabs) {
    btns[t.id] = el('button', {class: 'endtab', type: 'button', role: 'tab', id: `endtab-${t.id}`, 'aria-controls': `endpanel-${t.id}`, 'aria-selected': 'false', tabindex: '-1',
      onclick: () => select(t.id, true)}, el('span', {class: 'tn', text: t.name}), el('span', {class: 'tk', 'aria-hidden': 'true', text: String(tabs.indexOf(t) + 1)}));
    panels[t.id] = el('section', {class: `endpanel endpanel-${t.id}`, role: 'tabpanel', id: `endpanel-${t.id}`, 'aria-labelledby': `endtab-${t.id}`, tabindex: '0', hidden: true});
    list.append(btns[t.id]);
  }
  let current = null;
  function select(id, user = false, focusTab = false) {
    const t = tabs.find(x => x.id === id) || tabs[0];
    if (!built[t.id]) {
      built[t.id] = true;
      try { t.build(panels[t.id]); } catch (e) { console.error('ending tab', t.id, e); panels[t.id].append(el('p', {class: 'prose', text: 'Dit onderdeel kon niet worden getoond.'})); }
    }
    for (const x of tabs) {
      const on = x.id === t.id;
      btns[x.id].setAttribute('aria-selected', String(on)); btns[x.id].tabIndex = on ? 0 : -1;
      panels[x.id].hidden = !on;
    }
    if (user && current !== t.id) { SFX.play?.('switch'); root.scrollTop = 0; }
    current = t.id; END.tab = t.id; root.dataset.tab = t.id;
    if (focusTab) btns[t.id].focus({preventScroll: true});
    btns[t.id].scrollIntoView?.({block: 'nearest', inline: 'nearest'});
  }
  list.addEventListener('keydown', e => {
    const ids = tabs.map(x => x.id), i = ids.indexOf(current);
    const k = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : null;
    if (k === null) return;
    e.preventDefault();
    select(ids[(k + ids.length) % ids.length], true, true);
  });
  END.select = id => select(id, true);
  const foot = el('footer', {class: 'endfoot'},
    el('div', {class: 'tbtns'},
      again ? el('button', {class: 'go', onclick: () => { root.hidden = true; END.select = null; if (touch && touchWas) touch.hidden = false; onAgain?.(); }}, againLabel) : null,
      el('button', {class: 'btn', onclick: downloadReport}, G.verdict ? 'Download het besluitdossier' : 'Download de nabespreking'),
      el('button', {class: 'btn', onclick: printEnding}, 'Print deze pagina'),
      el('button', {class: 'btn', onclick: () => location.reload()}, 'Terug naar het titelscherm')),
    el('p', {class: 'label credit', html: 'Het Orakel van Dalwijk is gebaseerd op het AI-raamwerk en <i>Het Gewelf</i>. Het spel gebruikt geen AI-model en is geen juridisch advies.'}));
  body.append(el('header', {class: 'endhead'}, el('div', {class: 'endhead-in'}, el('span', {class: 'endbrand', 'aria-hidden': 'true', text: 'Het Orakel van Dalwijk'}), list)),
    ...tabs.map(t => panels[t.id]), foot);
  root.hidden = false;
  root.scrollTop = 0;
  select(END_TABS.includes(tab) ? tab : 'epilogue', false, false);
  // move focus into the ending, so keyboard users land on the tabs
  requestAnimationFrame(() => { if (!root.hidden && !root.contains(document.activeElement)) btns[current]?.focus({preventScroll: true}); });
}
// switch the open ending to another tab (debug hook and the epilogue's buttons)
export function endingTab(id) { END.select?.(id); return END.tab; }
UI.showEnding = showEnding;
UI.endingTab = endingTab;

function prepareRoot(root) {
  if (rootReady) return;
  rootReady = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'De afloop, jouw afdaling en de nabespreking');
  root.tabIndex = -1;
  // The game keeps Tab, Space and the arrow keys for itself (core/input.js). Inside the ending
  // they should scroll, move the focus and press buttons as usual.
  root.addEventListener('keydown', e => { if (NAV_KEYS.has(e.code) && !root.hidden) e.stopPropagation(); });
  // number keys 1-3 switch tabs, unless you are typing somewhere
  root.addEventListener('keydown', e => {
    if (root.hidden || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (n >= 0 && END.select) { END.select(END_TABS[n]); e.preventDefault(); }
  });
}

function buildEpilogue(p, {title, eyebrow, text, judgement, extra, select}) {
  const v = G.verdict, d = assess(), style = playstyle(facts(G, d, ON));
  const todo = [d.open.length && `${d.open.length} open ${d.open.length === 1 ? 'punt' : 'punten'}`, d.blind.length && `${d.blind.length} ${d.blind.length === 1 ? 'blinde vlek' : 'blinde vlekken'}`].filter(Boolean);
  const next = (id, name, line) => el('button', {class: 'endnext-b', type: 'button', onclick: () => select(id)},
    el('span', {class: 'nn', text: name}), el('span', {class: 'nl', text: line}), el('span', {class: 'na', 'aria-hidden': 'true', text: '→'}));
  p.append(...[el('div', {class: 'eyebrow', text: eyebrow}), el('h1', {text: title}),
    judgement ? el('div', {class: 'judge', text: judgement}) : null,
    v && VERDICT[v.choice] && VERDICT[v.ceiling] ? el('p', {class: 'endverdict'}, 'Jullie besluit: ', el('b', {text: VERDICT[v.choice].title}), el('span', {class: 'sep', text: ' · '}), 'het dossier droeg: ', el('b', {text: VERDICT[v.ceiling].title})) : null,
    el('div', {class: 'prose'}, ...String(text ?? '').split('\n\n').map(t => el('p', {text: t}))),
    extra,
    el('div', {class: 'stats'}, stats().map(([b, s]) => el('div', {class: 'stat'}, el('b', {text: String(b)}), el('span', {text: s})))),
    el('div', {class: 'endnext'},
      next('summary', 'Jouw afdaling', `Je speelstijl: ${style.name}. En je keuzes, wat je vond en wie je sprak.`),
      next('debrief', 'Nabespreking', `${todo.length ? `${todo.join(' en ')} om samen te bespreken` : 'Gespreksvragen per kamer'}, met tips voor een gesprek van twintig minuten.`))].filter(Boolean));
}

export function verdictEnding(onAgain) {
  const v = G.verdict;
  showEnding({title: VERDICT[v.choice].title, text: epilogue(v.choice, v.judgement) + (ON.epilogueExtra ? '\n\n' + ON.epilogueExtra() : ''), judgement: JUDGEMENTS[v.judgement], onAgain});
}

// ---------------------------------------------------------------- styles: the ending frame, its tabs and print
const PAD = 'clamp(14px,3.2vw,30px)';
addStyles('ending', `
#ending{padding:0;scroll-padding-top:72px}
#ending:focus{outline:none}
#ending[data-tab=summary],#ending[data-tab=debrief]{background:radial-gradient(90% 60% at 50% 18%,rgba(52,37,17,.95),rgba(9,6,4,.985) 72%)}
#ending .end.end2{width:100%;padding:0 ${PAD} max(40px,env(safe-area-inset-bottom))}
.end2>.endpanel,.end2>.endfoot{max-width:1080px;margin-left:auto;margin-right:auto}
.endhead{position:sticky;top:0;z-index:5;margin:0 calc(-1 * ${PAD}) 26px;padding:0 ${PAD};padding-top:env(safe-area-inset-top);
 background:rgba(14,10,7,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);box-shadow:0 10px 24px rgba(0,0,0,.28)}
.endhead-in{display:flex;align-items:center;gap:18px;min-height:58px;max-width:1080px;margin:0 auto}
.endbrand{font-family:var(--f-display);font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);white-space:nowrap}
.endtabs{display:flex;gap:4px;margin-left:auto;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;min-width:0}
.endtabs::-webkit-scrollbar{display:none}
.endtab{flex:none;position:relative;display:flex;align-items:center;gap:8px;background:none;border:0;padding:18px 14px 16px;font-family:var(--f-ui);font-size:15px;font-weight:500;color:var(--dim);cursor:pointer;white-space:nowrap}
.endtab::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:transparent;transition:background .2s}
.endtab:hover{color:var(--parch)}
.endtab[aria-selected="true"]{color:var(--gold-hi)}
.endtab[aria-selected="true"]::after{background:var(--gold)}
.endtab:focus-visible{outline:2px solid var(--gold);outline-offset:-6px;border-radius:9px}
.endtab .tk{font-size:10px;line-height:15px;min-width:17px;text-align:center;border-radius:4px;border:1px solid var(--line);color:var(--dim)}
.endpanel{outline:none;animation:endin .35s ease-out}
.endpanel:focus-visible{outline:2px dashed rgba(232,194,122,.35);outline-offset:8px;border-radius:6px}
@keyframes endin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.end2>.endpanel-epilogue{max-width:820px}
.endpanel-epilogue .stats{grid-template-columns:repeat(4,minmax(0,1fr))}
.endverdict{font-family:var(--f-body);font-size:18px;color:var(--dim);margin:0 0 14px}
.endverdict b{color:var(--parch);font-weight:600}
.endnext{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin:6px 0 4px}
.endnext-b{display:grid;grid-template-columns:1fr auto;gap:2px 12px;text-align:left;padding:14px 16px;border-radius:12px;border:1px solid var(--line);background:linear-gradient(135deg,rgba(232,194,122,.1),rgba(0,0,0,.18));cursor:pointer;color:var(--parch);transition:border-color .15s,background .15s}
.endnext-b:hover{border-color:rgba(232,194,122,.6);background:linear-gradient(135deg,rgba(232,194,122,.18),rgba(0,0,0,.18))}
.endnext-b .nn{font-family:var(--f-display);font-size:17px;font-weight:600;color:var(--gold-hi)}
.endnext-b .nl{grid-column:1;font-family:var(--f-body);font-size:16px;line-height:1.35;color:var(--dim)}
.endnext-b .na{grid-column:2;grid-row:1/3;align-self:center;font-size:20px;color:var(--gold)}
.endfoot{max-width:1080px;margin:34px auto 0;padding-top:20px;border-top:1px solid var(--line)}
.endfoot .credit{margin-top:16px;line-height:1.6;letter-spacing:.08em}
.printonly{display:none}
@media (prefers-reduced-motion:reduce){.endpanel{animation:none}}
#ending.calm .endpanel{animation:none}
@media (max-width:700px){.endpanel-epilogue .stats{grid-template-columns:repeat(2,minmax(0,1fr))}.endbrand{display:none}.endtabs{margin-left:0;gap:0}.endtab{padding:16px 11px 14px;font-size:14px}.endtab .tk{display:none}.endhead{margin-bottom:20px}}
@media (hover:none) and (pointer:coarse){.endtab .tk{display:none}}
@media print{
 @page{margin:14mm 13mm}
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 :root{color-scheme:light;--parch:#17120d;--dim:#4d433a;--gold:#7a5512;--gold-hi:#5c3d07;--line:rgba(40,28,14,.2);--line-strong:rgba(40,28,14,.35);--good:#1e7a3c;--open:#9a6300;--danger:#b3261e;--blind:#6b625a}
 html,body{height:auto!important;overflow:visible!important;background:#fff!important;color:#17120d!important}
 body>*:not(#ending){display:none!important}
 #ending{position:static!important;inset:auto!important;overflow:visible!important;background:none!important;padding:0!important}
 #ending .end.end2{width:auto!important;max-width:none!important;padding:0!important}
 .endhead,.endfoot,.endnext,.noprint{display:none!important}
 .endpanel{animation:none!important}
 .printonly{display:block!important}
 .card,.stat,.dcell{background:#fff!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
 .end h1{font-size:28pt;margin-top:0}
 .stat,.dcell{break-inside:avoid}
}
`);
void esc; void CHAMBER;
