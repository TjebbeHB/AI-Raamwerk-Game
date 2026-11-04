// De nabespreking: discussion questions per chamber, tips for whoever leads the conversation,
// and the playstyle titles of the end summary. Pure data and pure functions (no DOM, no
// framework import), so report(), the tests and the UI can all use it without cycles.
import {fmtTime} from '../core/util.js';

// who asks the question in each chamber (cast ids, see content/cast.js)
export const GUARDIAN = {
  necessity: 'waarom', governance: 'griffel', culture: 'vonk', capacity: 'mallow', infrastructure: 'wolk',
  evaluation: 'mira', quality: 'bep', interaction: 'noor', performance: 'bram', functionality: 'kees',
  sustainability: 'sien', sovereignty: 'wouter', ethics: 'linde', compliance: 'otto', security: 'slotje',
};

export const DEPTHS = {
  f0: {depth: 'Diepte 0', name: 'Het stadhuis'},
  f1: {depth: 'Diepte 1', name: 'De Kelder der Beloften'},
  f2: {depth: 'Diepte 2', name: 'De Hal der Fundamenten'},
  f3: {depth: 'Diepte 3', name: 'De Galerij der Domeinen'},
  f4: {depth: 'Diepte 4', name: 'De Kern'},
};

export const ARCHETYPES = {
  handhaver: {name: 'De Handhaver', kind: 'krijger', line: 'stevig in de schoenen, met een zwaar Zegel'},
  datatovenaar: {name: 'De Datatovenaar', kind: 'tovenaar', line: 'een felle Toetslamp en een scherpe blik'},
  archivaris: {name: 'De Archivaris', kind: 'verkenner', line: 'snel, en vindt wat verstopt ligt'},
  verbinder: {name: 'De Verbinder', kind: 'heler', line: 'koffie voor iedereen, en een luisterend oor'},
};

// ---------------------------------------------------------------- per chamber: questions and a prompt
// Grounded in game/topics.json and the story of Het Loket. Two or three questions each, then
// 'voor je eigen organisatie': one small, concrete thing to do with your own work.
export const NABESPREKING = {
  necessity: {
    questions: [
      'Een derde van de telefoontjes in Dalwijk ging over één onduidelijke brief. Welk ‘probleem’ bij jullie is eigenlijk een symptoom van iets eenvoudigers?',
      'Welk alternatief zonder AI had de negen dagen wachttijd kunnen verkorten? Waarom lag dat niet als eerste op tafel?',
      'Wanneer zouden jullie stoppen? Welk succes- of stopcriterium hadden jullie vooraf willen afspreken?',
    ],
    own: 'Kies één dienst waar mensen nu op wachten. Schrijf het probleem op in één zin, zonder het woord ‘AI’, en noem één oplossing zonder nieuwe techniek.',
  },
  governance: {
    questions: [
      'De assistent geeft morgen een fout antwoord over een vergunning. Wie belt de inwoner terug, wie herstelt de bron, en wie legt verantwoording af?',
      'Een apart AI-bestuur dat alles goedkeurt, voelt veilig. Wat gaat er in de praktijk mis als elk operationeel besluit langs zo’n loket moet?',
      'Wie zou bij jullie de domeinverantwoordelijke zijn, en wie de besluit-eigenaar? Weten die mensen dat zelf ook?',
    ],
    own: 'Teken voor één bestaande toepassing een mini-rollenkaart: wie voert uit, wie ondersteunt, wie is eindverantwoordelijk? Zet een kruis waar nu niemand staat.',
  },
  culture: {
    questions: [
      'Vonk organiseerde een spreekuur en alleen de koekjes gingen op. Wat houdt collega’s bij jullie tegen: vertrouwen, tijd of onduidelijke grenzen?',
      'Waarom werkt een verplicht gebruiksquotum averechts, terwijl het zo lekker meetbaar is?',
      'Welke leidinggevende kan het goede voorbeeld geven, ook door te laten zien wat níét werkt?',
    ],
    own: 'Beschrijf twee collega’s die heel verschillend naar een nieuw hulpmiddel kijken, zoals Ans met dertig jaar ervaring en Joris die net begint. Wat heeft ieder nodig om het eerlijk te proberen?',
  },
  capacity: {
    questions: [
      'Henk gaat morgen op vakantie en neemt de helft van de kennis mee. Wie is jullie Henk, en wat gebeurt er als die vertrekt?',
      'Wat moet je zelf blijven weten als je een assistent inkoopt, ook als de leverancier het model beheert?',
      'Wie kan bij jullie een wijzigingsvoorstel van een leverancier kritisch beoordelen? En heeft die persoon daar tijd voor?',
    ],
    own: 'Begin een levend kennisdocument voor één project. Welke drie keuzes zet je er als eerste in, en wie houdt het bij als jij er niet bent?',
  },
  infrastructure: {
    questions: [
      'Welke gegevens zou de assistent in Dalwijk verwerken, en welke daarvan vragen echt extra bescherming?',
      'De uitgang van Wolks poort stond nog op de bouwtekening. Hoe weet je vóór de livegang of je later echt kunt vertrekken?',
      'Wanneer kies je een bestaande overheidsvoorziening of open standaard, en wanneer bouw of koop je iets nieuws?',
    ],
    own: 'Kies één systeem dat jullie dagelijks gebruiken. Zoek uit waar de data staat en wat er nodig is om morgen over te stappen. Wie weet dat antwoord?',
  },
  evaluation: {
    questions: [
      'Mira had een meetlat van drie meter, maar mat niet het goede ding. Wat is in Dalwijk het goede ding om te meten?',
      'Waarom is een vaste testset met echte vragen zo belangrijk als de leverancier een update uitrolt?',
      'Bestuur, vakexperts en techniek kijken naar andere cijfers. Hoe maak je daar één gesprek van?',
    ],
    own: 'Kies voor één dienst drie meetpunten: één voor de inwoner, één voor de inhoud en één voor de techniek. Zet bij elk meetpunt de naam van wie het bewaakt.',
  },
  quality: {
    questions: [
      'Bep had twee officiële antwoorden die elkaar tegenspraken. Hoe voorkom je dat oude versies in een kennisbank blijven rondzingen?',
      'Wie herkent bij jullie een inhoudelijk fout antwoord, ook als het vloeiend en zelfverzekerd klinkt?',
      'Een bronverwijzing voelt betrouwbaar. Waarom is die nog geen bewijs dat het antwoord klopt?',
    ],
    own: 'Verzamel tien echte vragen van inwoners of collega’s en laat een vakexpert het juiste antwoord opschrijven. Gefeliciteerd: dat is het begin van een testset.',
  },
  interaction: {
    questions: [
      'De balie zei steeds ‘ik begrijp u’. Wanneer voelt menselijke taal van een assistent als hulp, en wanneer als een muur?',
      'Hoe ziet een goede overdracht naar een medewerker eruit, zodat mevrouw Bakker haar verhaal niet opnieuw hoeft te vertellen?',
      'Wat moet een inwoner kunnen zien en aanpassen van wat er tijdens het gesprek wordt onthouden?',
    ],
    own: 'Loop als inwoner door één van jullie digitale kanalen. Waar loop je vast, en hoeveel klikken kost het om een mens te spreken?',
  },
  performance: {
    questions: [
      'Na één campagne liep de postkamer vol. Welke pieken kunnen jullie nu al voorspellen, zoals de belastingaanslagen of de eerste vorstdag?',
      'Waarom stuur je niet elke vraag naar het zwaarste model, als dat de beste antwoorden geeft?',
      'Welke wachttijd vinden inwoners acceptabel, en wie heeft dat ooit aan hen gevraagd?',
    ],
    own: 'Schat voor één dienst hoeveel vragen er op een gewone dag binnenkomen, en hoeveel op de drukste dag van het jaar. Wat gebeurt er als het systeem dan traag wordt?',
  },
  functionality: {
    questions: [
      'De assistent zei ‘geregeld’ terwijl de koppeling vastzat. Bij welke taken mag een systeem dat pas zeggen na een bevestiging?',
      'Wat is erger: een assistent die doorvraagt, of een die raadt welke afspraak je bedoelde? Waarom?',
      'Na hoeveel mislukte pogingen moet een inwoner een mens spreken? En wie bepaalt dat?',
    ],
    own: 'Schrijf voor één taak de stappen uit die een assistent doorloopt. Waar zit de controle in het andere systeem, en waar de uitweg naar de balie?',
  },
  sustainability: {
    questions: [
      'Duizenden vragen over openingstijden gingen naar het grootste model. Welke vragen bij jullie hebben eigenlijk gewoon een goede zoekfunctie nodig?',
      'Is een korter antwoord altijd duurzamer? Wat verlies je als je alleen daarop stuurt?',
      'Hoe maak je verbruik zichtbaar per geholpen inwoner, in plaats van per vraag of per token?',
    ],
    own: 'Pak de drie vragen die jullie het vaakst krijgen. Kan een vaste pagina, een zoekfunctie of een hergebruikt antwoord ze afhandelen? Dan bakt Sien minder broodjes op de modelmachine.',
  },
  sovereignty: {
    questions: [
      '‘Onze servers staan toch in Europa?’ Waarom is dat maar een deel van het antwoord?',
      'Welke van de zeven sleutels, zoals data, prompts, workflows en evaluaties, zouden jullie vandaag kunnen meenemen als de leverancier stopt?',
      'Wat kost het om een overstap te oefenen? En wat kost het om dat niet te doen?',
    ],
    own: 'Maak voor één ingekocht systeem drie lijstjes: wat is van ons, wat zit bij de leverancier, en wat zou bij een overstap verloren gaan?',
  },
  ethics: {
    questions: [
      'Lindes hoorn verstond keurige volzinnen, maar miste wie het hardst hulp nodig had. Wie schrijft er bij jullie ‘anders’, en wordt die net zo goed geholpen?',
      'Medewerkers namen het advies over omdat de wachtrij groeide. Wat hebben zij nodig om echt te kunnen afwijken?',
      'Met welke inwoners of belangengroepen hadden jullie in Dalwijk eerst moeten praten?',
    ],
    own: 'Formuleer één hulpvraag op drie manieren: keurig, kort met spelfouten, en boos of verdrietig. Zou jullie dienst ze alle drie even goed helpen?',
  },
  compliance: {
    questions: [
      'Otto’s goedkeuringsstempel hoorde bij een heel andere proef. Welke goedkeuring wordt bij jullie stilletjes meegenomen naar een nieuwe toepassing?',
      'Waarom is het certificaat van een leverancier geen onderbouwing voor jullie eigen ingebruikname?',
      'Wat moet een inwoner weten als die met een AI-assistent praat? Hoe vertel je dat zonder kleine lettertjes?',
    ],
    own: 'Noem één verandering aan een bestaande toepassing, zoals nieuwe gegevens, een nieuwe doelgroep of een nieuwe taak, die een nieuwe beoordeling zou moeten starten. Wie doet die beoordeling?',
  },
  security: {
    questions: [
      'Een bijlage vroeg heel beleefd om de sleutel van alle dossiers. Waarom is ‘negeer verborgen opdrachten’ in de prompt geen beveiliging?',
      'Welke rechten heeft een assistent bij jullie echt nodig, en welke krijgt hij voor het gemak?',
      'Bij welke acties wil je altijd een bevestiging van een mens, ook als het systeem het heel zeker weet?',
    ],
    own: 'Zet voor één assistent of automatisering op een rij wat hij kan lezen en wat hij kan versturen. Wat is het ergste dat een misleidend document kan laten gebeuren?',
  },
};

// about the verdict itself: v = {choice, ceiling} as titles, same = whether they match
export const VERDICT_TALK = [
  v => `Jullie kozen ‘${v.choice}’. Welke kamer gaf daarbij de doorslag, en welke hebben jullie eigenlijk niet meegewogen?`,
  v => (v.same ? `Het dossier droeg precies ‘${v.ceiling}’. Voelde het besluit als een conclusie, of als een compromis?`
    : `Het dossier droeg ‘${v.ceiling}’. Waar zat het verschil tussen jullie gevoel en wat het dossier kon dragen?`),
  () => 'Hoe leg je dit besluit in twee zinnen uit aan mevrouw Bakker? En aan Glans?',
];
// when you took the Snelle Lift instead
export const SHORTCUT_TALK = [
  'Wat maakte de Snelle Lift zo aantrekkelijk? Herken je die verleiding uit je eigen werk: een mooie demo, een deadline, een enthousiaste leverancier?',
  'Welke vraag had je Glans moeten stellen voordat je tekende?',
  'Alle vijftien kamers zijn blinde vlekken. Welke had je als eerste willen bezoeken, en waarom die?',
];

export const FACILITATOR = {
  title: 'Voor de gespreksleider: een nabespreking van twintig minuten',
  intro: 'Zet dit scherm groot neer. Er is geen score: het gaat om de redenering achter de keuzes, niet om goed of fout.',
  introDoc: 'Een gesprek van twintig minuten, met dit dossier op tafel. Er is geen score: het gaat om de redenering achter de keuzes, niet om goed of fout.',
  steps: [
    {min: 3, title: 'Het besluit', text: 'Laat de speler in twee zinnen vertellen wat er besloten is, en waarom. Vraag daarna de adviesraad: hadden jullie hetzelfde gekozen?'},
    {min: 10, title: 'Twee of drie kamers', text: 'Kies er een paar uit. Begin waar de raad en de speler verschilden, anders bij een blinde vlek of een open punt. Lees de vragen voor en geef eerst het woord aan wie nog niets zei.'},
    {min: 5, title: 'Je eigen organisatie', text: 'Kies samen één kamer en doe de opdracht ‘Voor je eigen organisatie’. Klein en concreet is beter dan compleet.'},
    {min: 2, title: 'Afspraken', text: 'Wie doet wat, en wanneer? Download het dossier of print deze pagina als geheugensteun.'},
  ],
  tips: [
    'Vraag naar twijfel. ‘Waar twijfelde je het langst?’ levert meer op dan ‘Wat was het goede antwoord?’',
    'Dalwijk is verzonnen, de vragen zijn echt. Haal de voorbeelden zo snel mogelijk naar jullie eigen praktijk.',
    'Een blinde vlek is geen fout: het is iets wat nog niemand heeft bekeken. Dat is ook in het echt een eerlijke constatering.',
    'Speelden er adviseurs mee? Kijk dan per rol: zien de rollen in de raad hetzelfde, of juist niet? Daar zit vaak het beste gesprek.',
  ],
};

// ---------------------------------------------------------------- council tallies
// G.council[id] = {counts, ballots, byRole, roles}. A view of one tally for n options:
// majority = options that at least half of the ballots picked; top = the most picked option(s).
export function councilView(entry, n) {
  if (!entry || !(entry.ballots > 0)) return null;
  n = n ?? entry.counts?.length ?? 0;
  const counts = Array.from({length: n}, (_, i) => Math.max(0, +entry.counts?.[i] || 0));
  const best = Math.max(0, ...counts);
  return {
    ballots: entry.ballots, counts,
    majority: counts.flatMap((c, i) => (c > 0 && c * 2 >= entry.ballots ? [i] : [])),
    top: best > 0 ? counts.flatMap((c, i) => (c === best ? [i] : [])) : [],
  };
}
// does the council's majority differ from what you chose? (a multi-choice chamber)
export function differs(selection, view) {
  if (!view) return false;
  const mine = new Set(selection || []);
  return view.majority.length !== mine.size || view.majority.some(i => !mine.has(i));
}
// the verdict is one choice: the council differs when your choice is not (one of) its favourites
export const differsVerdict = (choice, view) => !!view && view.top.length > 0 && !view.top.includes(choice);

// role metadata: from the stored tally, then the live council, then a plain fallback
const hexColor = c => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : typeof c === 'string' && c ? c : '#b9aa8c');
export function roleInfo(id, ...lists) {
  for (const list of lists) {
    const r = Array.isArray(list) ? list.find(x => x && x.id === id) : null;
    if (r) return {id, name: String(r.name || id), icon: String(r.icon || '•'), color: hexColor(r.color)};
  }
  const name = String(id || 'adviseur');
  return {id, name: name.charAt(0).toUpperCase() + name.slice(1), icon: '•', color: '#b9aa8c'};
}
// the roles that voted, in the order the council lists them
export function roleOrder(byRole, ...lists) {
  if (!byRole || typeof byRole !== 'object') return [];
  const ids = Object.keys(byRole).filter(id => byRole[id] && (byRole[id].ballots > 0 || (byRole[id].counts || []).some(c => c > 0)));
  const known = lists.flat().filter(Boolean).map(r => r.id);
  return ids.sort((a, b) => (known.includes(a) ? known.indexOf(a) : 99) - (known.includes(b) ? known.indexOf(b) : 99));
}

// ---------------------------------------------------------------- small formatting helpers
export const fmtDist = m => { m = Math.max(0, +m || 0); return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`; };
export const fmtMin = s => { s = Math.max(0, +s || 0); return s < 60 ? `${Math.round(s)} sec` : fmtTime(s); };
// a relationship score in words (scores are small integers around zero)
export const relWord = v => (v >= 5 ? 'dikke maatjes' : v >= 3 ? 'warm' : v >= 1 ? 'vriendelijk' : v > -1 ? 'neutraal' : v > -3 ? 'koel' : 'ijzig');
// relationships to show: the registry (ON.relList) when there is one, else whoever G.rel mentions
export function relations(g, on = {}, cast = {}) {
  const rel = g?.rel && typeof g.rel === 'object' ? g.rel : {};
  const score = id => (Number.isFinite(+rel[id]) ? Math.round(+rel[id] * 10) / 10 : 0);
  if (Array.isArray(on.relList) && on.relList.length) return on.relList.filter(r => r && r.npc).map(r => ({npc: r.npc, name: r.name || cast[r.npc]?.name || r.npc, v: score(r.npc)}));
  return Object.keys(rel).filter(id => score(id) !== 0).map(id => ({npc: id, name: cast[id]?.name || id, v: score(id)}));
}

// ---------------------------------------------------------------- how you played
// facts(G, assess(), ON): a flat snapshot for the titles, the summary and the report.
// Everything is optional: old saves, the Snelle Lift ending and missing registries all work.
export function facts(g, d, on = {}) {
  const st = g?.stats || {};
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const len = a => (Array.isArray(a) ? a.length : 0);
  const listed = (list, have) => {
    if (!Array.isArray(list) || !list.length) return null;
    const ids = new Set(list.map(x => x && x.id));
    return {got: new Set((Array.isArray(have) ? have : []).filter(id => ids.has(id))).size, total: list.length};
  };
  const floorTime = {};
  for (const [k, v] of Object.entries(st.floorTime || {})) if (num(v) > 0) floorTime[k] = num(v);
  const tracked = Object.values(floorTime).reduce((a, b) => a + b, 0);
  const attempts = Object.values(g?.chambers || {}).map(c => len(c?.attempts));
  const rel = g?.rel && typeof g.rel === 'object' ? g.rel : {};
  const relVals = Object.values(rel).map(Number).filter(Number.isFinite);
  const t = on.totals || {};
  const chambers = d?.chambers?.length || 15;
  return {
    time: Math.max(num(st.time), tracked), active: num(st.time), tracked, floorTime,
    chambers, strong: len(d?.strong), open: len(d?.open), blind: d ? len(d.blind) : chambers,
    ceiling: d?.ceiling ?? null,
    verdict: g?.verdict ? g.verdict.choice ?? null : null, judgement: g?.verdict?.judgement ?? null,
    shortcut: num(st.shortcut) > 0 && !g?.verdict,
    bronnen: len(g?.bronnen), hallucs: len(g?.hallucs), cards: len(g?.cards), crystals: len(g?.crystals),
    totals: {bronnen: t.bronnen ?? 45, hallucs: t.hallucs ?? 12, cards: t.cards ?? 8, crystals: t.crystals ?? 4},
    kills: num(st.kills), deaths: num(st.deaths), abilities: num(st.abilities), damageTaken: Math.round(num(st.damageTaken)),
    distance: num(st.distance), talks: num(st.talks), met: st.met && typeof st.met === 'object' ? Object.keys(st.met).length : null,
    revealed: num(st.revealed), coffee: num(st.coffee),
    decided: attempts.filter(n => n > 0).length, reweighed: attempts.filter(n => n > 1).length,
    choices: len(g?.choices),
    secrets: listed(on.secretList, g?.secrets), trinkets: listed(on.trinketList, g?.trinkets),
    bingo: listed(on.bingoList, g?.bingo), achievements: listed(on.achievementList, g?.achievements),
    joop: Number.isFinite(+rel.joop) ? +rel.joop : null, warm: relVals.filter(v => v >= 2).length,
    sleutelbos: num(g?.quests?.sleutelbos ?? -1) >= 2,
    pron: g?.hero?.pronouns || 'die',
  };
}

// ---------------------------------------------------------------- playstyle titles
// The first title whose rule holds is your title; the next ones (at most three) are side titles.
const share = x => (x && x.total ? x.got / x.total : 0);
export const TITLES = [
  {id: 'snel', name: 'Snelle Beslisser', rule: 'Met de Snelle Lift naar het einde, of het besluit bezegeld binnen 40 minuten (met minder dan 12 stevige kamers).',
    test: f => f.shortcut || (f.verdict !== null && f.time > 0 && f.time < 40 * 60 && f.strong < 12),
    line: f => (f.shortcut ? 'Je nam de Snelle Lift van Glans. Dat scheelde een hoop trappen, en een hoop vragen.' : `In ${fmtMin(f.time)} bij het besluit. Snel is fijn, zolang het dossier je kan bijhouden.`)},
  {id: 'grondig', name: 'De Grondige Ambtenaar', rule: 'Minstens 12 kamers stevig en minstens 35 bronnen gevonden.',
    test: f => f.strong >= 12 && f.bronnen >= 35,
    line: f => `${f.strong} van de ${f.chambers} kamers stevig en ${f.bronnen} bronnen gelezen. Dit dossier kan zo de raad in.`},
  {id: 'bingo', name: 'Bingokampioen', rule: 'Minstens 80 procent van de vergaderbingo gevonden.',
    test: f => !!f.bingo && f.bingo.total >= 5 && f.bingo.got >= Math.ceil(f.bingo.total * 0.8),
    line: f => `${f.bingo.got} van de ${f.bingo.total} bingowoorden gehoord. Geen ‘laten we dit even parkeren’ ontsnapt aan jouw oren.`},
  {id: 'hallu', name: 'Hallucinatiejager', rule: 'Alle hallucinaties van het Orakel gevonden.',
    test: f => f.totals.hallucs > 0 && f.hallucs >= f.totals.hallucs,
    line: f => `Alle ${f.totals.hallucs} verzonnen antwoorden van het Orakel gevangen. Pip wil ze inlijsten in de kantine.`},
  {id: 'joop', name: f => (f.pron === 'hij' ? 'Vriend van de Conciërge' : f.pron === 'zij' ? 'Vriendin van de Conciërge' : 'Maatje van de Conciërge'),
    rule: 'De sleutelbos van Joop gevonden en zijn oude archiefkamer weer geopend, of een warme band met Joop (relatie 3 of meer).',
    test: f => f.sleutelbos || (f.joop ?? 0) >= 3,
    line: f => (f.sleutelbos ? 'Je vond Joops sleutelbos uit ’98 en zette zijn oude archiefkamer weer open. Zijn opa zei altijd: wie oude deuren opent, krijgt er vrienden bij.' : 'Joop zet voortaan een extra kop koffie voor je klaar. Dat doet hij niet voor iedereen.')},
  {id: 'archief', name: 'Archiefrat', rule: 'Minstens 40 bronnen, of driekwart van de geheimen of kantoorvondsten gevonden.',
    test: f => f.bronnen >= 40 || share(f.secrets) >= 0.75 || share(f.trinkets) >= 0.75,
    line: f => (f.bronnen >= 40 ? `${f.bronnen} van de ${f.totals.bronnen} bronnen gevonden. Er ligt geen rol meer in het Gewelf die jij niet hebt gelezen.`
      : share(f.secrets) >= 0.75 ? `${f.secrets.got} van de ${f.secrets.total} geheimen gevonden. Het Gewelf heeft weinig verborgen hoekjes meer voor jou.`
        : `${f.trinkets.got} van de ${f.trinkets.total} kantoorvondsten verzameld. Je bureaula zit vol, en alles heeft een verhaal.`)},
  {id: 'monster', name: 'Monsterdompteur', rule: 'Minstens 70 monsters verslagen.',
    test: f => f.kills >= 70,
    line: f => `${f.kills} monsters van haast en hype verslagen. De Haastkoning stuurt je voortaan een kerstkaart.`},
  {id: 'doorzetter', name: 'Doorzetter', rule: 'Minstens 6 keer terug naar de koffie, en toch het besluit bezegeld.',
    test: f => f.deaths >= 6 && f.verdict !== null,
    line: f => `${f.deaths} keer terug naar de koffie, en toch het besluit bezegeld. De automaat kent je inmiddels bij naam.`},
  {id: 'herweger', name: 'De Herweger', rule: 'Minstens 4 kamers opnieuw afgewogen.',
    test: f => f.reweighed >= 4,
    line: f => `${f.reweighed} kamers woog je opnieuw af. Van mening veranderen als je meer weet, heet zorgvuldigheid.`},
  {id: 'netwerk', name: 'Netwerker van het Gewelf', rule: 'Een warme band met minstens 5 mensen, of met minstens 30 verschillende mensen gesproken.',
    test: f => f.warm >= 5 || (f.met ?? 0) >= 30,
    line: f => (f.warm >= 5 ? `${f.warm} mensen in Dalwijk noemen je inmiddels een collega. Bij de koffieautomaat ben je een begrip.` : `Je sprak ${f.met} verschillende mensen en wezens. Zelfs het hangslot weet hoe je heet.`)},
  {id: 'zeker', name: 'Zekerheidszoeker', rule: 'Een besluit gekozen dat voorzichtiger is dan het dossier kon dragen.',
    test: f => f.judgement === 'cautious' || f.judgement === 'cautious-stop',
    line: () => 'Het dossier droeg meer dan je koos. Je nam het zekere voor het onzekere, en dat kun je ook uitleggen.'},
  {id: 'nieuw', name: 'Ambtenaar in Opleiding', rule: 'Iedereen die geen andere titel heeft: er is altijd een tweede werkdag.',
    test: () => true,
    line: () => 'Je eerste werkdag zit erop. Het Gewelf heeft nog genoeg kamers, rollen en geheimen voor een tweede.'},
];
export const titleName = (t, f) => (typeof t.name === 'function' ? t.name(f) : t.name);
export function playstyle(f) {
  const hits = TITLES.filter(t => { try { return !!t.test(f); } catch (e) { return false; } });
  const main = hits[0] || TITLES.at(-1);
  let line = '';
  try { line = main.line(f); } catch (e) { line = ''; }
  return {id: main.id, name: titleName(main, f), line, also: hits.slice(1).filter(t => t.id !== 'nieuw').slice(0, 3).map(t => ({id: t.id, name: titleName(t, f)}))};
}
