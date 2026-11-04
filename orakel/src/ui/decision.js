// The decision panel: a guardian lays the case before you and you choose measures.
import {$, el, esc, addStyles} from '../core/util.js';
import {UI, SFX, NET, CAST, chamberState} from '../game/bus.js';
import {G, saveGame} from '../game/state.js';
import {GAME} from '../game/game.js';
import {unlockForUi, relock} from '../game/dialogue.js';
import {CHAMBER, recordChoice, STATE_LABEL, CRITICAL} from '../content/framework.js';
import {roleInfo, roleOrder} from '../content/nabespreking.js';

const STATUS = {correct: 'Past', incorrect: 'Werkt averechts', supporting: 'Goede aanvulling'};

// ---------------------------------------------------------------- the council's votes
// A copy of the council's tally is kept with every decision (and the verdict), for the
// debrief and the report: G.council[id] = {counts, ballots, byRole, roles, at}.
export function storeCouncil(id, t = NET.active && NET.tallies?.id === id ? NET.tallies : null) {
  if (!t || !Array.isArray(t.counts)) return null;
  const ballots = Math.max(0, +t.ballots || 0);
  G.council ||= {};
  if (!ballots && G.council[id]) return G.council[id];      // a re-vote nobody voted in keeps the earlier votes
  const byRole = t.byRole && typeof t.byRole === 'object' ? Object.fromEntries(Object.entries(t.byRole).filter(([, r]) => r && typeof r === 'object')
    .map(([r, x]) => [r, {counts: Array.isArray(x.counts) ? x.counts.map(n => Math.max(0, +n || 0)) : [], ballots: Math.max(0, +x.ballots || 0)}])) : null;
  const ids = byRole ? Object.keys(byRole) : [];
  const roles = Array.isArray(NET.roles) ? NET.roles.filter(r => r && ids.includes(r.id)).map(({id: rid, name, icon, color}) => ({id: rid, name, icon, color})) : [];
  G.council[id] = {counts: t.counts.map(n => Math.max(0, +n || 0)), ballots, byRole, roles, at: Date.now()};
  return G.council[id];
}
// Small chips per role: who picked option i (or, as a legend, how many of each role voted).
// entry is a live tally or a stored one; role names and icons come from NET.roles when known.
export function roleChips(entry, i = -1, {legend = false} = {}) {
  const byRole = entry?.byRole;
  if (!byRole || typeof byRole !== 'object') return null;
  const lists = [entry.roles, NET.roles];
  const said = [];
  const chips = roleOrder(byRole, ...lists).flatMap(id => {
    const r = roleInfo(id, ...lists), x = byRole[id] || {}, n = legend ? +x.ballots || 0 : +x.counts?.[i] || 0;
    if (n <= 0) return [];
    said.push(`${r.name} ${n}`);
    return [el('span', {class: 'rchip', style: `--rc:${r.color}`, title: `${r.name}: ${n}`},
      el('i', {'aria-hidden': 'true', text: r.icon}), legend ? el('span', {class: 'rn', text: r.name}) : el('span', {class: 'sr', text: `${r.name} `}), el('b', {text: String(n)}))];
  });
  if (!chips.length) return null;
  return el('span', {class: `rchips${legend ? ' legend' : ''}`, role: 'group', 'aria-label': `${legend ? 'Stemmen per rol' : 'Per rol'}: ${said.join(', ')}`}, chips);
}
addStyles('council-chips', `
.rchips{grid-column:2/4;display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.rchips.legend{grid-column:auto}
.rchip{display:inline-flex;align-items:center;gap:4px;padding:1px 8px 1px 6px;border-radius:11px;font-family:var(--f-ui);font-size:12px;line-height:18px;color:var(--parch);white-space:nowrap;
 background:color-mix(in srgb,var(--rc,#b9aa8c) 20%,rgba(0,0,0,.25));border:1px solid color-mix(in srgb,var(--rc,#b9aa8c) 55%,transparent)}
.rchip i{font-style:normal;font-size:12px;line-height:1}
.rchip b{font-weight:700}
.rchip .rn{color:var(--parch)}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media print{.rchip{background:color-mix(in srgb,var(--rc,#b9aa8c) 26%,#fff);border-color:color-mix(in srgb,var(--rc,#b9aa8c) 70%,#000)}}
`);

export function clueHtml(c) {
  return `<p><b>${esc(c.body)}</b></p><p>${esc(c.explanation)}</p>${c.steps?.length ? `<ul>${c.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${c.example ? `<p class="ex">${esc(c.example)}</p>` : ''}${c.section ? `<p><small>Uit het raamwerk: ${esc(c.section)}</small></p>` : ''}`;
}

export function decide(id, {who, place} = {}) {
  const c = CHAMBER[id];
  // test hook: answer without the panel ('best' picks every fitting measure, 'skip' leaves a blind spot)
  const auto = window.__orakel?.autoDecide;
  if (auto) {
    if (auto !== 'skip') recordChoice(id, c.options.flatMap((o, i) => (o.status === 'correct' || (auto === 'mixed' && i === 0) ? [i] : [])));
    saveGame();
    return Promise.resolve(chamberState(id));
  }
  return new Promise(resolve => {
    let sel = new Set(), phase = 'choose', attempt = null, openClue = null;
    GAME.modal = 'decision';
    unlockForUi();
    $('decision').hidden = false;
    $('decTitle').textContent = c.title;
    $('decPlace').textContent = `${place || c.place} · ${CAST[who]?.name || c.npc}${CRITICAL.includes(id) ? ' · kritisch domein voor Dalwijk' : ''}`;
    NET.openVote?.(id, c.question, c.options.map(o => o.text), true);
    NET.onTally = () => render();
    const keys = e => {
      if (GAME.modal !== 'decision') return;
      const n = parseInt(e.key, 10);
      if (phase === 'choose' && n >= 1 && n <= c.options.length) { toggle(n - 1); e.preventDefault(); }
      if (e.key === 'Enter') { phase === 'choose' ? submit() : finish(); e.preventDefault(); }
    };
    addEventListener('keydown', keys);
    const toggle = i => { if (sel.has(i)) sel.delete(i); else sel.add(i); SFX.play('switch'); render(); };
    const submit = () => {
      if (!sel.size) { UI.toast('Kies eerst', 'Selecteer minstens één maatregel, of sla deze kamer over.', 'warn'); return; }
      attempt = recordChoice(id, [...sel]);
      phase = 'result';
      SFX.play(attempt.complete ? 'questDone' : 'quest');
      saveGame();
      render();
    };
    const finish = () => {
      removeEventListener('keydown', keys);
      if (storeCouncil(id)) saveGame();
      NET.closeVote?.(); NET.onTally = null;
      $('decision').hidden = true; GAME.modal = null;
      relock();
      resolve(chamberState(id));
    };
    const skip = () => { finish(); };
    function render() {
      const body = $('decBody');
      const found = c.clues.filter(k => G.bronnen.includes(`${id}:${k.id}`));
      const tally = NET.active && NET.tallies?.id === id ? NET.tallies : null;
      const opts = el('div', {class: 'opts'});
      c.options.forEach((o, i) => {
        const on = sel.has(i), res = phase === 'result';
        const b = el('button', {class: `optb ${res ? o.status : ''}`, 'aria-pressed': String(on), onclick: () => phase === 'choose' && toggle(i)},
          el('span', {class: 'box', text: on ? '✓' : ''}),
          el('span', {}, `${i + 1}. ${o.text}`),
          el('span', {class: 'votes', text: tally ? `${tally.counts[i] || 0} ▲` : ''}),
          tally ? roleChips(tally, i) : null);
        if (res) b.append(el('span', {class: 'fb', html: `<b>${STATUS[o.status]}</b> · ${esc(o.feedback)}`}));
        opts.append(b);
      });
      const kase = el('div', {class: 'case'},
        el('p', {text: c.scenario}),
        G.flags[`trial:${id}`] && c.trial?.finding ? el('div', {class: 'finding', html: `<b>Wat de proef liet zien.</b> ${esc(c.trial.finding)}`}) : null,
        el('div', {class: 'q', text: c.question}), opts);
      if (phase === 'result') {
        const n = attempt.missing.length, u = attempt.unsuitable.length;
        kase.append(el('div', {class: 'verdictbox', style: `margin-top:12px;border-color:${attempt.complete ? 'rgba(143,224,160,.6)' : 'rgba(242,196,107,.6)'}`},
          el('h3', {text: attempt.complete ? 'Stevig' : 'Open punten'}),
          el('p', {style: 'margin:0;font-family:var(--f-body);font-size:17px', text: attempt.complete ? 'Je koos alle passende maatregelen en geen die averechts werken. Deze kamer staat stevig in het dossier.'
            : `${n ? `Je miste ${n} passende maatregel${n > 1 ? 'en' : ''}. ` : ''}${u ? `${u} gekozen maatregel${u > 1 ? 'en werken' : ' werkt'} averechts. ` : ''}Je kunt opnieuw afwegen; het dossier onthoudt je laatste keuze.`}),
          c.reflection ? el('p', {style: 'margin:8px 0 0;font-size:14px;color:var(--dim)', text: `Voor je eigen project: ${c.reflection}`}) : null));
      }
      const side = el('div', {class: 'side'},
        el('div', {class: 'verdictbox'}, el('h3', {text: 'Zo werkt het'}), el('p', {style: 'margin:0;font-size:14px;line-height:1.5;color:var(--dim)', text: 'Kies alle maatregelen die hier passen; vaak zijn het er meer dan één. Sommige zijn een goede aanvulling, andere werken averechts. Een kamer staat stevig als je alle passende kiest en geen averechtse.'})),
        el('div', {class: 'label', text: `Jouw bronnen · ${found.length}/${c.clues.length}`}),
        ...found.map(k => {
          const open = openClue === k.id;
          return el('button', {class: 'bron', onclick: () => { openClue = open ? null : k.id; render(); }}, el('b', {text: k.title}), el('p', {html: open ? clueHtml(k) : esc(k.body)}));
        }),
        found.length < c.clues.length ? el('p', {style: 'margin:0;font-size:13px;color:var(--dim)', text: 'Bronnen vind je als rollen in de kamers van deze vleugel. Elke bron maakt de afweging makkelijker.'}) : null,
        tally ? el('div', {class: 'label', text: `Adviesraad: ${tally.ballots} ${tally.ballots === 1 ? 'stem' : 'stemmen'}`}) : NET.active ? el('div', {class: 'label', text: 'De adviesraad kijkt mee op de telefoon.'}) : null,
        tally ? roleChips(tally, -1, {legend: true}) : null);
      body.innerHTML = '';
      body.append(el('div', {class: 'dec'}, kase, side));
      const bar = $('decBar');
      bar.innerHTML = '';
      if (phase === 'choose') {
        bar.append(el('span', {class: 'note', text: `${sel.size} gekozen · toetsen 1–${c.options.length} · Enter legt vast`}),
          el('button', {class: 'btn', onclick: skip}, chamberState(id) === 'blind' ? 'Sla over (blinde vlek)' : 'Laat de vorige keuze staan'),
          el('button', {class: 'go', onclick: submit}, 'Leg vast in het dossier'));
      } else {
        bar.append(el('span', {class: 'note', text: `Deze kamer: ${STATE_LABEL[chamberState(id)]}`}));
        if (!attempt.complete) bar.append(el('button', {class: 'btn', onclick: () => { phase = 'choose'; render(); }}, 'Opnieuw afwegen'));
        bar.append(el('button', {class: 'go', onclick: finish}, 'Verder'));
      }
    }
    render();
  });
}
