// The AI framework: fifteen chambers, their trials, the dossier and the verdict.
// Content comes straight from the original game's files, so both games tell the same framework.
import TOPICS from '../../../game/topics.json' with {type: 'json'};
import STORIES from '../../../game/stories.json' with {type: 'json'};
import TRIALS from '../../../game/trials.json' with {type: 'json'};
import DESCENT from '../../../game/descent.json' with {type: 'json'};
import {G} from '../game/state.js';
import {chamberState} from '../game/bus.js';

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

// The dossier as a Markdown file, to take into a real meeting.
export function report() {
  const d = assess(), v = G.verdict;
  const lines = ['# Het Orakel van Dalwijk · besluitdossier', '', `Gemeente Dalwijk · ${STORY.subtitle}`, '', `> ${STORY.letter.text} (${STORY.letter.from})`, '',
    'Dit dossier legt een leergesprek vast. Het is geen toetsing of goedkeuring van een AI-toepassing.', ''];
  if (v) {
    lines.push('## Het besluit', '', `**${VERDICT[v.choice].title}**: ${VERDICT[v.choice].text}`, '', `Oordeel: ${JUDGEMENTS[v.judgement]}`, `Hoogste besluit dat het dossier droeg: ${VERDICT[v.ceiling].title}`, '');
    if (v.votes) lines.push(`Adviesraad: ${VERDICT.map((o, i) => `${o.title}: ${v.votes[i] || 0}`).join(', ')}`, '');
    lines.push('### Een jaar later', '', epilogue(v.choice, v.judgement), '');
  }
  lines.push('## Wat het besluit begrenst', '', ...(d.reasons.length ? d.reasons.map(r => `- ${r.text}`) : ['- Geen beperkingen gevonden.']), '', '## De kamers', '');
  for (const c of d.chambers) {
    const last = G.chambers[c.id]?.attempts?.at(-1), ch = CHAMBER[c.id];
    lines.push(`### ${ch.title} · ${STATE_LABEL[c.state]}${c.critical ? ' (kritisch domein)' : ''}`);
    if (last) {
      lines.push('Gekozen maatregelen:', ...last.selection.map(i => `- ${ch.options[i].text}`));
      if (last.missing.length) lines.push('Nog niet gekozen, wel passend:', ...last.missing.map(i => `- ${ch.options[i].text}`));
    } else lines.push('Niet onderzocht.');
    if (G.flags[`trial:${c.id}`] && ch.trial?.finding) lines.push('', `Bevinding: ${ch.trial.finding}`);
    if (ch.reflection) lines.push('', `Voor je eigen project: ${ch.reflection}`);
    lines.push('');
  }
  return lines.join('\n');
}
