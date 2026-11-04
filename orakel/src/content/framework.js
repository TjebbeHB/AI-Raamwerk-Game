// The AI framework: fifteen chambers, their trials, the dossier and the verdict.
// Content comes straight from the original game's files, so both games tell the same framework.
import TOPICS from '../../../game/topics.json' with {type: 'json'};
import STORIES from '../../../game/stories.json' with {type: 'json'};
import TRIALS from '../../../game/trials.json' with {type: 'json'};
import DESCENT from '../../../game/descent.json' with {type: 'json'};
import {G} from '../game/state.js';
import {chamberState, ON, CAST, NET} from '../game/bus.js';
import {CAST_DEFS} from './cast.js';
import {NABESPREKING, FACILITATOR, VERDICT_TALK, SHORTCUT_TALK, GUARDIAN, DEPTHS, ARCHETYPES, facts, playstyle, relations, councilView, differs, differsVerdict, roleInfo, roleOrder, relWord, fmtDist, fmtMin} from './nabespreking.js';

export const STORY = STORIES.find(s => s.id === 'loket');
export const CHAMBERS = [
  {...STORY.necessity, trial: STORY.necessity.trial},
  ...TOPICS.map(t => ({...t, trial: TRIALS[t.id]})),
];
export const CHAMBER = Object.fromEntries(CHAMBERS.map(c => [c.id, c]));
export const FOUNDATIONS = ['governance', 'culture', 'capacity', 'infrastructure'];
export const DOMAINS = TOPICS.filter(t => t.group === 'domain').map(t => t.id);
export const CRITICAL = STORY.verdict.critical;          // quality, interaction, ethics
export const VERDICT = DESCENT.verdict.options;           // stop, research, pilot, implement
export const VERDICT_QUESTION = STORY.verdict.question;
export const EPILOGUES = STORY.epilogues;
export const JUDGEMENTS = {
  supported: 'Het dossier draagt dit besluit',
  cautious: 'Voorzichtiger dan nodig',
  beyond: 'Verder dan het dossier kan dragen',
  grounded: 'Onderbouwd gestopt',
  'cautious-stop': 'Legitiem gestopt',
};
export const STATE_LABEL = {strong: 'Stevig', open: 'Open punten', blind: 'Blinde vlek'};

// Record a decision on a chamber: complete when every fitting measure is chosen and no unsuitable one.
export function recordChoice(id, selection) {
  const c = CHAMBER[id];
  const missing = c.options.flatMap((o, i) => (o.status === 'correct' && !selection.includes(i) ? [i] : []));
  const unsuitable = selection.filter(i => c.options[i].status === 'incorrect');
  const attempt = {selection: [...selection].sort((a, b) => a - b), missing, unsuitable, complete: !missing.length && !unsuitable.length, at: Date.now()};
  (G.chambers[id] ||= {attempts: []}).attempts.push(attempt);
  return attempt;
}

// What the dossier can carry. No score: only a ceiling with reasons (same rules as Het Gewelf 3.1).
export function assess() {
  const state = id => chamberState(id);
  const title = id => CHAMBER[id].title;
  const chambers = CHAMBERS.map(c => ({id: c.id, title: c.title, group: c.group, state: state(c.id), critical: CRITICAL.includes(c.id)}));
  let ceiling = 3;
  const reasons = [];
  const limit = (level, text) => { ceiling = Math.min(ceiling, level); reasons.push({level, text}); };
  const need = state('necessity');
  if (need === 'blind') limit(1, 'De noodzaak is niet onderzocht. Zonder probleemanalyse en alternatief zonder AI is niet te zeggen of AI iets oplost.');
  else if (need === 'open') limit(1, 'De noodzaak staat nog niet stevig: niet alle kernvragen over probleem, alternatieven of succescriteria zijn beantwoord.');
  if (state('governance') !== 'strong') limit(1, 'Eigenaarschap is niet geregeld. Zonder aanspreekbare eigenaar kan zelfs een pilot niet verantwoord draaien.');
  for (const id of ['culture', 'capacity', 'infrastructure']) if (state(id) !== 'strong') limit(2, `Fundament ‘${title(id)}’ is ${state(id) === 'blind' ? 'niet onderzocht' : 'nog niet op orde'}. In een pilot kun je dat leren; in productie niet.`);
  if (state('evaluation') === 'blind') limit(1, 'Er is geen evaluatieplan besproken. Een pilot die niets meet, levert geen bewijs op voor een volgend besluit.');
  for (const id of CRITICAL) if (state(id) !== 'strong') limit(2, `Kritisch domein ‘${title(id)}’ is ${state(id) === 'blind' ? 'een blinde vlek' : 'nog open'}. Voor deze toepassing vraagt productie hier zekerheid.`);
  const solid = chambers.filter(x => x.group === 'domain' && x.state === 'strong').length;
  if (solid < 6) limit(2, `${solid} van de 10 domeinen staan stevig. Voor productie is een breder beeld nodig (minstens zes).`);
  reasons.sort((a, b) => a.level - b.level);
  return {ceiling, reasons, chambers, solid,
    strong: chambers.filter(x => x.state === 'strong').map(x => x.id),
    open: chambers.filter(x => x.state === 'open').map(x => x.id),
    blind: chambers.filter(x => x.state === 'blind').map(x => x.id)};
}
export function judge(choice, ceiling) {
  if (choice === 0) return ceiling <= 1 ? 'grounded' : 'cautious-stop';
  return choice === ceiling ? 'supported' : choice < ceiling ? 'cautious' : 'beyond';
}
export function epilogue(choice, judgement) {
  const key = VERDICT[choice].key;
  const variant = key === 'stop' ? (judgement === 'grounded' ? 'grounded' : 'cautious') : judgement === 'beyond' && key !== 'research' ? 'beyond' : 'ok';
  return EPILOGUES[key][variant];
}

// The dossier as a Markdown file, to take into a real meeting: the verdict, how you played,
// the council's votes and, per chamber, what you chose and what to talk about afterwards.
const STATUS_MD = {correct: 'past', supporting: 'goede aanvulling', incorrect: 'werkt averechts'};
const nameOf = id => CAST[id]?.name || CAST_DEFS[id]?.name || String(id || '');
const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

// a council tally as Markdown list lines: per option the count, then per role
export function councilLines(entry, labels) {
  const view = councilView(entry, labels.length);
  if (!view) return [];
  const roles = roleOrder(entry.byRole, entry.roles, NET.roles);
  return labels.map((label, i) => {
    const per = roles.map(r => [roleInfo(r, entry.roles, NET.roles).name, +entry.byRole[r]?.counts?.[i] || 0]).filter(([, n]) => n > 0);
    return `- **${view.counts[i]}** · ${label}${per.length ? ` (${per.map(([n, c]) => `${n} ${c}`).join(', ')})` : ''}`;
  });
}

// the highlights of 'Jouw afdaling'
function summaryLines(d, f) {
  const style = playstyle(f), hero = G.hero || {}, arch = ARCHETYPES[hero.archetype];
  const out = ['## Jouw afdaling', '', `**Speelstijl: ${style.name}.** ${style.line}`];
  if (style.also.length) out.push(`Ook: ${style.also.map(t => t.name).join(', ')}.`);
  out.push('');
  const who = [(hero.name || '').trim(), arch && `${arch.name} (${arch.kind})`].filter(Boolean);
  if (who.length) out.push(`- Adviseur: ${who.join(', ')}`);
  const perDepth = Object.keys(DEPTHS).filter(k => f.floorTime[k] >= 30).map(k => `${DEPTHS[k].name} ${fmtMin(f.floorTime[k])}`);
  out.push(`- Tijd in het Gewelf: ${fmtMin(f.time)}${perDepth.length ? ` (${perDepth.join(' · ')})` : ''}`,
    `- Dossier: ${f.strong} stevig · ${f.open} open · ${plural(f.blind, 'blinde vlek', 'blinde vlekken')}`,
    `- Bronnen ${f.bronnen} van ${f.totals.bronnen} · hallucinaties ${f.hallucs} van ${f.totals.hallucs} · visitekaartjes ${f.cards} van ${f.totals.cards} · kristallen ${f.crystals} van ${f.totals.crystals}`);
  const finds = [['Geheimen', f.secrets], ['Kantoorvondsten', f.trinkets], ['Vergaderbingo', f.bingo], ['Prestaties', f.achievements]].filter(([, x]) => x).map(([n, x]) => `${n} ${x.got} van ${x.total}`);
  if (finds.length) out.push(`- ${finds.join(' · ')}`);
  out.push(`- Monsters verslagen: ${f.kills} · terug naar de koffie: ${f.deaths}×${f.abilities ? ` · vaardigheden gebruikt: ${f.abilities}` : ''}${f.damageTaken ? ` · schade opgelopen: ${f.damageTaken}` : ''}`);
  if (f.distance || f.talks) out.push(`- Afgelegd: ${fmtDist(f.distance)} · gesprekken: ${f.talks}${f.met ? ` met ${plural(f.met, 'persoon', 'mensen')}` : ''}`);
  const choices = (Array.isArray(G.choices) ? G.choices : []).filter(c => c && (c.label || c.text));
  if (choices.length) out.push('', '### Jouw keuzes', '', ...choices.map(c => `- ${c.npc ? `**${nameOf(c.npc)}** · ` : ''}${[c.label, c.text].filter(Boolean).join(': ')}`));
  const rels = relations(G, ON, {...CAST_DEFS, ...CAST});
  if (rels.length) out.push('', '### Relaties', '', ...rels.map(r => `- ${r.name}: ${relWord(r.v)} (${r.v > 0 ? '+' : ''}${r.v})`));
  const ach = (Array.isArray(ON.achievementList) ? ON.achievementList : []).filter(a => a && (G.achievements || []).includes(a.id));
  if (ach.length) out.push('', '### Prestaties', '', ...ach.map(a => `- ${a.name}${a.text ? `: ${a.text}` : ''}`));
  out.push('');
  return out;
}

export function report() {
  const d = assess(), v = G.verdict, f = facts(G, d, ON), council = G.council || {};
  const hero = G.hero || {}, who = (hero.name || '').trim(), arch = ARCHETYPES[hero.archetype];
  let date = '';
  try { date = new Date().toLocaleDateString('nl-NL', {day: 'numeric', month: 'long', year: 'numeric'}); } catch (e) { date = new Date().toISOString().slice(0, 10); }
  const lines = ['# Het Orakel van Dalwijk · besluitdossier', '', `Gemeente Dalwijk · ${STORY.subtitle}`, '', `> ${STORY.letter.text} (${STORY.letter.from})`, '',
    'Dit dossier legt een leergesprek vast. Het is geen toetsing of goedkeuring van een AI-toepassing.', '',
    `Opgesteld${who ? ` door ${who}` : ''}${arch ? ` (${arch.name})` : ''} op ${date}.`, ''];
  if (v) {
    lines.push('## Het besluit', '', `**${VERDICT[v.choice].title}**: ${VERDICT[v.choice].text}`, '', `Oordeel: ${JUDGEMENTS[v.judgement]}  `, `Hoogste besluit dat het dossier droeg: ${VERDICT[v.ceiling].title}`, '');
    const view = councilView(council.verdict, VERDICT.length);
    if (view) {
      lines.push(`Adviesraad (${plural(view.ballots, 'stem', 'stemmen')}):`, '', ...councilLines(council.verdict, VERDICT.map(o => o.title)), '');
      if (differsVerdict(v.choice, view)) lines.push('De adviesraad koos een ander besluit dan de speler.', '');
    } else if (v.votes) lines.push(`Adviesraad: ${VERDICT.map((o, i) => `${o.title}: ${v.votes[i] || 0}`).join(', ')}`, '');
    lines.push('### Een jaar later', '', epilogue(v.choice, v.judgement), '');
  } else if (f.shortcut) {
    lines.push('## Het besluit', '', '**De Snelle Lift**: het contract van Glans is getekend zonder het Gewelf te onderzoeken.', '',
      `Oordeel: ${JUDGEMENTS.beyond}  `, `${f.blind} van de ${f.chambers} kamers zijn blinde vlekken.`, '');
  }
  lines.push(...summaryLines(d, f));
  lines.push('## Wat het besluit begrenst', '', ...(d.reasons.length ? d.reasons.map(r => `- ${r.text}`) : ['- Geen beperkingen gevonden.']), '');
  lines.push('## Nabespreking', '', FACILITATOR.introDoc, '', ...FACILITATOR.steps.map((s, i) => `${i + 1}. **${s.title}** (${s.min} min): ${s.text}`), '');
  if (v) lines.push('### Over het besluit', '', ...VERDICT_TALK.map((q, i) => `${i + 1}. ${q({choice: VERDICT[v.choice].title, ceiling: VERDICT[v.ceiling].title, same: v.choice === v.ceiling})}`), '');
  else if (f.shortcut) lines.push('### Over de Snelle Lift', '', ...SHORTCUT_TALK.map((q, i) => `${i + 1}. ${q}`), '');
  lines.push('## De kamers', '');
  for (const c of d.chambers) {
    const tries = G.chambers[c.id]?.attempts || [], last = tries.at(-1), ch = CHAMBER[c.id], talk = NABESPREKING[c.id];
    lines.push(`### ${ch.title} · ${STATE_LABEL[c.state]}${c.critical ? ' (kritisch domein)' : ''}`, '', `${ch.place}${GUARDIAN[c.id] ? ` · ${nameOf(GUARDIAN[c.id])}` : ''}`, '');
    if (last) {
      lines.push('Gekozen maatregelen:', ...last.selection.map(i => `- ${ch.options[i].text} (${STATUS_MD[ch.options[i].status] || ch.options[i].status})`));
      if (last.missing.length) lines.push('Nog niet gekozen, wel passend:', ...last.missing.map(i => `- ${ch.options[i].text}`));
      if (tries.length > 1) lines.push('', `Opnieuw afgewogen: ${tries.length} pogingen.`);
    } else lines.push('Niet onderzocht. Passend waren:', ...ch.options.filter(o => o.status === 'correct').map(o => `- ${o.text}`));
    const view = councilView(council[c.id], ch.options.length);
    if (view) {
      lines.push('', `Adviesraad (${plural(view.ballots, 'stem', 'stemmen')}):`, ...councilLines(council[c.id], ch.options.map(o => o.text)));
      if (differs(last?.selection, view)) lines.push('', 'De adviesraad koos anders dan de speler.');
    }
    if (G.flags[`trial:${c.id}`] && ch.trial?.finding) lines.push('', `Bevinding: ${ch.trial.finding}`);
    if (talk) lines.push('', 'Gespreksvragen:', '', ...talk.questions.map((q, i) => `${i + 1}. ${q}`), '', `Voor je eigen organisatie: ${talk.own}`);
    if (ch.reflection) lines.push('', `Voor je eigen project: ${ch.reflection}`);
    lines.push('');
  }
  lines.push('---', '', 'Gemaakt met Het Orakel van Dalwijk. Het spel gebruikt geen AI-model en is geen juridisch advies.', '');
  return lines.join('\n');
}
