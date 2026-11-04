// The Zegelkamer: the dossier, the verdict, and what happens a year later.
import {$, el, esc, fmtTime} from '../core/util.js';
import {UI, SFX, NET, ON} from '../game/bus.js';
import {G, saveGame} from '../game/state.js';
import {GAME} from '../game/game.js';
import {unlockForUi} from '../game/dialogue.js';
import {assess, judge, epilogue, report, VERDICT, VERDICT_QUESTION, JUDGEMENTS, STATE_LABEL, CHAMBER} from '../content/framework.js';

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
        el('span', {class: 'votes', text: tally ? `${tally.counts[i] || 0} ▲` : ''}))));
      body.append(el('div', {class: 'dec'},
        el('div', {class: 'case'}, el('p', {text: 'Op de wanden van de Zegelkamer gloeit jullie dossier. Wat stevig staat, wat open is, en wat je nooit hebt bekeken.'}),
          dossierGrid(d), el('div', {class: 'q', text: VERDICT_QUESTION}), opts),
        el('div', {class: 'side'}, el('div', {class: 'verdictbox'}, el('h3', {text: 'Eerst kiezen, dan kijken'}),
          el('p', {style: 'margin:0;font-size:14px;line-height:1.5;color:var(--dim)', text: 'Pas nadat je het besluit bezegelt, laat het dossier zien welk besluit het kon dragen, en waarom. Er is geen score.'})),
          el('div', {class: 'label', text: `${d.strong.length} stevig · ${d.open.length} open · ${d.blind.length} blinde vlekken`}),
          tally ? el('div', {class: 'label', text: `Adviesraad: ${tally.ballots} stemmen`}) : null)));
      const bar = $('decBar');
      bar.innerHTML = '';
      bar.append(el('span', {class: 'note', text: choice === null ? 'Kies één besluit.' : `Gekozen: ${VERDICT[choice].title}`}),
        el('button', {class: 'go', disabled: choice === null, onclick: seal}, 'Bezegel het besluit'));
    }
    function seal() {
      const tally = NET.active && NET.tallies?.id === 'verdict' ? NET.tallies.counts.slice() : null;
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
  const d = assess(), t = ON.totals || {};
  return [
    [fmtTime(G.stats.time), 'speeltijd'], [`${d.strong.length}/15`, 'kamers stevig'], [`${G.bronnen.length}/45`, 'bronnen gevonden'],
    [`${G.hallucs.length}/${t.hallucs ?? 12}`, 'hallucinaties'], [`${G.cards.length}/${t.cards ?? 8}`, 'visitekaartjes'], [`${G.crystals.length}/${t.crystals ?? 4}`, 'kristallen'],
    [G.stats.kills, 'monsters verslagen'], [G.stats.deaths, 'keer terug naar de koffie'],
  ];
}

export function showEnding({title, eyebrow = 'Een jaar later', text, judgement, again = true, extra = null, onAgain = null, againLabel = 'Kies opnieuw'}) {
  GAME.mode = 'ending';
  unlockForUi();
  $('hud').hidden = true;
  const body = $('endBody');
  body.innerHTML = '';
  const download = () => {
    const blob = new Blob([report()], {type: 'text/markdown'});
    const a = el('a', {href: URL.createObjectURL(blob), download: 'besluitdossier-dalwijk.md'}); document.body.append(a); a.click(); a.remove();
  };
  body.append(...[el('div', {class: 'eyebrow', text: eyebrow}), el('h1', {text: title}),
    judgement ? el('div', {class: 'judge', text: judgement}) : null,
    el('div', {class: 'prose'}, ...String(text).split('\n\n').map(p => el('p', {text: p}))),
    extra,
    el('div', {class: 'stats'}, stats().map(([b, s]) => el('div', {class: 'stat'}, el('b', {text: String(b)}), el('span', {text: s})))),
    el('div', {class: 'tbtns'},
      again ? el('button', {class: 'go', onclick: () => { $('ending').hidden = true; onAgain?.(); }}, againLabel) : null,
      G.verdict ? el('button', {class: 'btn', onclick: download}, 'Download het besluitdossier') : null,
      el('button', {class: 'btn', onclick: () => location.reload()}, 'Terug naar het titelscherm')),
    el('p', {class: 'label', style: 'margin-top:18px;line-height:1.6', html: 'Het Orakel van Dalwijk is gebaseerd op het AI-raamwerk en <i>Het Gewelf</i>. Het spel gebruikt geen AI-model en is geen juridisch advies.'})].filter(Boolean));
  $('ending').hidden = false;
  $('ending').scrollTop = 0;
}

export function verdictEnding(onAgain) {
  const v = G.verdict;
  showEnding({title: VERDICT[v.choice].title, text: epilogue(v.choice, v.judgement) + (ON.epilogueExtra ? '\n\n' + ON.epilogueExtra() : ''), judgement: JUDGEMENTS[v.judgement], onAgain});
}
void esc; void CHAMBER; void UI;
