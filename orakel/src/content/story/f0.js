// Diepte 0 · Het stadhuis: the letter, Joop and his opa, Ilse and the afvalpasbrief, Mevrouw Bakker's
// question, Glans and his lift, the waiting room, Communicatie, Reprografie, and the town hall's secrets.
// What follows from the choices here, on the other depths and in the epilogue: docs/inhoudsplan.md.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame, applySave} from '../../game/state.js';
import {ent} from '../../game/world.js';
import {stage, setStage, startQuest} from '../../game/quests.js';
import {say, choose, scene} from '../../game/dialogue.js';
import {giveItem, enterFloor, GAME} from '../../game/game.js';
import {showEnding} from '../../ui/verdict.js';
import {EPILOGUES, STORY} from '../framework.js';
import {heroName, formal, pron} from '../../game/hero.js';
import {rel, choice, chose, findSecret, award, archOpt, whenFree} from './systems.js';
import {$, esc, TILE} from '../../core/util.js';

const once = (k) => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const naam = () => heroName('');
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pick = list => list[G.stats.steps % list.length];

// ---- the letter ----
ON.use.letter = async () => {
  const n = naam();
  await UI.read(n ? `Aan ${n}, adviseur Dienstverlening` : 'Aan de nieuwe adviseur Dienstverlening', `${n ? `<p>Beste ${esc(n)},</p>` : ''}<p>Welkom bij de gemeente Dalwijk. Ik val maar meteen met de deur in huis.</p>
<p>${STORY.letter.text.replace('Ik wil volgende maand een besluit', 'Ik wil vrijdag jouw advies')}</p>
<p>Het testexemplaar van de leverancier, het ‘Orakel’, staat al in het Gewelf onder het stadhuis. Ga kijken. Spreek mensen. Kom met een besluit dat we aan inwoners kunnen uitleggen, ook als het ‘nee’ wordt.</p>
<p>Wethouder Hendriks</p>
<p><small>PS: Joop, onze conciërge, heeft de sleutel van de kelder. Neem een lamp mee; het licht beneden is nogal… wisselend.</small></p>`);
  if (stage('main') === 0) {
    setStage('main', 1);
    scene(async () => { await say('nar', 'Een advies, vrijdag. Over een Orakel in de kelder. Welkom bij de gemeente.'); });
  }
};

// ---- Joop, the caretaker, and the five sayings of his opa ----
const OPA = [
  'Mijn opa zei altijd: eerst lezen, dan rennen.',
  'Mijn opa zei altijd: wie daar zonder vragen naar beneden gaat, komt er zonder antwoorden weer uit.',
  'Mijn opa zei altijd: haast is de snelste weg naar de verkeerde deur.',
  'Mijn opa zei altijd: elke deur heeft een sleutel, maar niet elke vraag heeft een antwoord.',
  'Mijn opa zei altijd: een machine die nooit twijfelt, moet je extra goed in de gaten houden. Hij had het over de koffieautomaat. Maar toch.',
];
const opaHeard = () => OPA.filter((_, i) => G.flags[`opa${i}`]).length;
async function opa(c, i = OPA.findIndex((_, k) => !G.flags[`opa${k}`])) {
  if (i < 0) i = G.stats.steps % OPA.length;
  await say(c, OPA[i], {mood: 'thinking'});
  if (G.flags[`opa${i}`]) return;
  G.flags[`opa${i}`] = true;
  if (opaHeard() < OPA.length) return;
  await say(c, 'Dat waren ze allemaal, geloof ik. Mijn opa. Hij heette ook Joop. Iedereen in onze familie heet Joop.', {mood: 'laugh'});
  await say(c, 'Behalve tante Joke.', {mood: 'thinking'});
  await say(c, 'Hij was conciërge van het Gewelf. In 1948 heeft hij de trap naar beneden gemetseld. Als je goed kijkt, zie je zijn letter nog. Een J, met een krul.', {mood: 'happy'});
  findSecret('opa');
  rel('joop', 1, {text: 'Joop vindt het fijn dat je luistert.'});
}

ON.talk.joop = () => async c => {
  const m = stage('main');
  if (m === 0) {
    const n = naam();
    await say(c, n ? `Goeiemorgen! Jij bent ${n}, toch? De nieuwe? Welkom, welkom.` : 'Goeiemorgen! Jij bent de nieuwe? Welkom, welkom.', {mood: 'happy'});
    await say(c, 'Lees eerst je post maar. De wethouder schrijft altijd een brief. Op papier. Ze houdt van papier.', {mood: 'laugh'});
    await opa(c, 0);
    return;
  }
  if (m === 1) return joopKey(c);
  if (G.items.leesbril && !G.flags.joop_bril) return joopBril(c);
  if (G.items.sleutelbos && !G.flags.joop_bos) return joopBos(c);
  await say(c, pick(['Pas op beneden. En doe de deuren achter je… nee, laat maar open. Dan kun je terug.', 'Als je verdwaalt: volg de koffieautomaten. Die vinden altijd een weg naar een stopcontact.', 'Ik hoor het als iemand de kelderdeur openmaakt. Ik hoor álle deuren. Eenendertig jaar oefening.']), {mood: 'happy'});
  const i = await choose([
    {t: 'Vertel eens wat over je opa.', if: opaHeard() < OPA.length},
    {t: 'Waar ligt het stempeltje van Sanne?', if: G.flags.sanne_vraag && !G.flags.sanne_stempel && !G.items.stempeltje},
    {t: 'Wat zit er achter die deur zonder bordje?', if: !G.keys.magazijn},
    'Tot straks, Joop.',
  ]);
  if (i === 0) return opa(c);
  if (i === 1 || i === 2) {
    await say(c, i === 1 ? 'Dat stempeltje? Dat ligt in het magazijn. Achter de deur zonder bordje.' : 'Het magazijn van Facilitaire Zaken. Sinds 1974. Er ligt van alles. Ook dingen die iedereen kwijt is.', {mood: 'thinking'});
    await say(c, G.flags.joop_bril_kwijt ? 'Ik zou je de sleutel geven, maar zonder leesbril weet ik niet eens welke het is. En die bril ben ik kwijt.' : 'De sleutel geef ik niet zomaar weg, hoor. Daar moet je me eerst eens mee helpen.', {mood: 'tired'});
    G.flags.joop_bril_kwijt = true;
  }
};
async function joopKey(c) {
  await say(c, 'Naar beneden? Naar het Gewelf? Hm.', {mood: 'worried'});
  await say(c, 'Ik doe hier al eenendertig jaar de deuren. Maar sinds dat Orakel aanstaat, ga ik daar niet meer naar beneden.', {mood: 'worried'});
  await say(c, 'De archiefkasten lopen ’s nachts. En gisteren gaf de verwarmingsketel antwoord op een vraag die ik niet had gesteld.', {mood: 'surprised'});
  const i = await choose([
    'Ik moet erheen. Mag ik de sleutel?',
    'Wat is het Gewelf eigenlijk?',
    'Geen tijd voor verhalen, Joop. De sleutel, graag.',
    archOpt('handhaver', 'Joop, de wethouder wil vrijdag een advies. Ik heb die sleutel nu nodig.'),
    archOpt('datatovenaar', 'Hoe vaak is die kelderdeur dit jaar eigenlijk opengeweest?'),
    archOpt('archivaris', 'Werkt het sleutelregister van 1993 nog? Dan teken ik netjes af.'),
    archOpt('verbinder', 'Je klinkt bezorgd, Joop. Hoe gaat het eigenlijk met jóú?'),
  ]);
  if (i === 1) {
    await say(c, 'Het Gewelf is ouder dan het stadhuis. De eerste archivarissen hebben er een soort raamwerk in de muren gehakt.', {mood: 'thinking'});
    await say(c, 'Vragen die je moet stellen voordat je ergens ja tegen zegt.', {mood: 'thinking'});
    await opa(c, 1);
    rel('joop', 1);
  } else if (i === 2) {
    await say(c, 'Ho ho. Ook goeiemorgen.', {mood: 'sad'});
    await opa(c, 2);
    rel('joop', -1);
  } else if (i === 3) {
    await say(c, 'Daadkrachtig. Zo hoor ik het graag.', {mood: 'happy'});
    await say(c, 'Mijn opa was ook zo. Die stond op zijn klompen in de deur van de burgemeester tot hij een antwoord had.', {mood: 'laugh'});
    rel('joop', 1, {text: 'Joop vond dat kordaat.'});
  } else if (i === 4) {
    await say(c, 'Elf keer. Ik houd het bij in een schriftje.', {mood: 'smug'});
    await say(c, 'Drie keer voor de verwarmingsketel, zeven keer voor het Orakel, en één keer omdat ik dacht dat ik mijn boterham beneden had laten liggen. Hij zat in mijn jaszak.', {mood: 'laugh'});
    rel('joop', 1);
  } else if (i === 5) {
    await say(c, 'Het sleutelregister! Dat heb ik zelf ingevoerd! In 1993!', {mood: 'surprised'});
    await say(c, 'Niemand tekent ooit af. Niemand. Kom hier, dan schud ik je de hand.', {mood: 'laugh'});
    await say(c, 'Voor iemand die het register kent: hier is ook de sleutel van het magazijn, achter de deur zonder bordje. Daar ligt van alles.', {mood: 'happy'});
    giveItem('key:magazijn');
    rel('joop', 2, {text: 'Joop zal dit nooit vergeten.'});
  } else if (i === 6) {
    await say(c, 'Met mij?', {mood: 'surprised'});
    await say(c, '…Niemand vraagt dat ooit. Over drie maanden ga ik met pensioen. Eenendertig jaar deuren.', {mood: 'sad'});
    await say(c, 'En dan staat er straks een Orakel in de kelder dat alles weet, behalve hoe de deuren hier werken. Je moet altijd even tillen. Links.', {mood: 'tired'});
    await say(c, 'Dank je dat je het vraagt.', {mood: 'happy'});
    G.flags.joop_pensioen = true;
    rel('joop', 2);
  }
  await say(c, 'Goed dan. Hier is de sleutel van de kelderdeur. Aan het eind van de gang.', {mood: 'neutral'});
  giveItem('key:kelder');
  await say(c, 'En neem deze stroopwafel mee. Onderzoek doe je niet op een lege maag.', {mood: 'happy'});
  giveItem('snack:joop');
  await say(c, 'O, en als je beneden ooit mijn oude sleutelbos vindt: die ben ik in ’98 kwijtgeraakt. Er hangt een sleutel aan van de oude archiefkamer.', {mood: 'thinking'});
  const p = await choose(['Ik beloof het: als ik hem vind, krijg je hem terug.', 'Ik houd mijn ogen open.']);
  if (p === 0) {
    await say(c, 'Een belofte. Dat hoor je niet vaak meer in dit gebouw.', {mood: 'happy'});
    choice('joop_sleutelbos', {npc: 'joop', label: 'De sleutelbos van Joop', text: 'Je beloofde Joop zijn sleutelbos terug te brengen.', pick: 'belofte'});
    rel('joop', 1);
  } else {
    await say(c, 'Meer vraag ik niet.', {mood: 'neutral'});
    choice('joop_sleutelbos', {npc: 'joop', label: 'De sleutelbos van Joop', text: 'Je zei dat je je ogen open zou houden.', pick: 'ogen'});
  }
  startQuest('sleutelbos');
  setStage('main', 2);
  if (!G.keys.magazijn) {
    await say(c, 'Ik zou je de weg nog op een briefje schrijven, maar ik zie geen hand voor ogen. Mijn leesbril is weg. Al sinds vanochtend.', {mood: 'tired'});
    G.flags.joop_bril_kwijt = true;
  }
}
async function joopBril(c) {
  G.flags.joop_bril = true; delete G.items.leesbril;
  await say(c, 'Mijn leesbril! Waar was die?', {mood: 'surprised'});
  await say('you', 'Meneer De Wit had hem op. Bovenop zijn eigen bril.');
  await say(c, 'Bovenop zijn eigen bril. Natuurlijk. Voor de zekerheid.', {mood: 'laugh'});
  await say(c, 'Zo. Nu zie ik pas hoe jong je bent. Dank je wel.', {mood: 'happy'});
  rel('joop', 2);
  if (G.keys.magazijn) return;
  await say(c, 'Weet je wat? Hier. De sleutel van het magazijn, achter de deur zonder bordje. Ik heb hem nog nooit aan iemand gegeven.', {mood: 'thinking'});
  giveItem('key:magazijn');
  await say(c, 'Er ligt van alles. Ook dat stempeltje waar die mevrouw al weken voor komt. En een nietmachine waar de hele kantine naar zoekt. Niet verder vertellen.', {mood: 'smug'});
}
async function joopBos(c) {
  G.flags.joop_bos = true;
  await say(c, 'Is dat… mijn sleutelbos? Uit ’98?', {mood: 'surprised'});
  await say(c, 'Zesentwintig jaar. Er hangt zelfs nog de sleutel aan van een fietsenstalling die niet meer bestaat.', {mood: 'happy'});
  if (chose('joop_sleutelbos', 'belofte')) await say(c, 'Je had het beloofd. En je hebt het gedaan. Weet je wat mijn opa zei? Een sleutel is pas een sleutel als iemand hem terugbrengt.', {mood: 'happy'});
  choice('joop_sleutelbos', {npc: 'joop', label: 'De sleutelbos van Joop', text: 'Je bracht Joop zijn sleutelbos terug.', pick: 'teruggebracht'});
  rel('joop', 2);
  await say(c, 'Houd hem maar zolang je hem nodig hebt. De oude archiefkamer is in Diepte 1, achter het klachtenarchief. Ik durf er toch niet meer heen.', {mood: 'thinking'});
}

// ---- Ilse at the counter, and the afvalpasbrief ----
const QUOTES = {burger1: '‘Zeg gewoon container.’', burger2: '‘Mijn zoon dacht dat het een cryptogram was.’', burger3: '‘Niet in de magnetron.’', bakker: '‘Schrijf wat ik moet doen, en wanneer.’'};
ON.talk.ilse = () => async c => {
  if (G.items.brood && !G.flags.brood_ilse) return ilseBrood(c);
  if (once('ilse_f0')) {
    const n = naam();
    await say(c, `Jij bent de nieuwe! ${n ? `Welkom, ${n}. ` : 'Welkom. '}Sorry dat ik niet opsta, ik heb nog… even kijken… zevenenveertig mensen in de wacht.`, {mood: 'tired'});
    await say(c, 'Weet je wat het gekke is? Een derde belt over dezelfde brief. Die over de afvalpas. Niemand snapt hem.', {mood: 'thinking'});
  }
  const brief = chose('ilse_brief'), asked = Object.keys(QUOTES).filter(k => G.flags[`brief_${k}`]);
  const i = await choose([
    {t: 'Waarom herschrijven jullie die brief niet?', if: !G.flags.ilse_waarom},
    {t: 'Over die afvalpasbrief: ik heb een plan.', if: !brief && G.flags.ilse_waarom},
    {t: `Ik heb ${asked.length === 1 ? 'een inwoner' : `${asked.length} inwoners`} gesproken over de brief.`, if: brief === 'inwoners' && asked.length > 0 && !G.flags.brief_inwoners_klaar},
    'Wat vind jij van het Orakel?',
    archOpt('datatovenaar', 'Hoeveel telefoontjes zijn het precies, per dag?', !G.flags.ilse_cijfers),
    archOpt('verbinder', 'Zevenenveertig in de wacht. Hoe hou je dat vol?', !G.flags.ilse_hoe),
    'Succes met de wachtrij!',
  ]);
  if (i === 0) {
    G.flags.ilse_waarom = true;
    await say(c, 'Goeie vraag. De brief is van Communicatie, de pas is van Afval, en de klachten komen bij ons.', {mood: 'thinking'});
    await say(c, 'Iedereen denkt dat een ander hem moet aanpassen. Dus blijft hij zoals hij is. Al drie jaar.', {mood: 'tired'});
    return ilseBrief(c);
  }
  if (i === 1) return ilseBrief(c);
  if (i === 2) {
    if (asked.length < 2) { await say(c, 'Eén is een begin! Nog eentje, dan heb ik genoeg om mee te schrijven.', {mood: 'happy'}); return; }
    G.flags.brief_inwoners_klaar = true;
    await say('nar', 'Je leest voor wat de inwoners zeiden. Ilse schrijft mee op de achterkant van een klachtformulier.');
    await say(c, asked.map(k => QUOTES[k]).join(' '), {mood: 'laugh'});
    await say(c, 'Weet je wat dit is? Het begin van de eerste brief van deze gemeente die mensen in één keer snappen. En er is geen Orakel aan te pas gekomen.', {mood: 'happy'});
    award('begrijpelijk');
    rel('ilse', 1, {text: 'Ilse zal dit niet vergeten.'});
    return;
  }
  if (i === 3) {
    await say(c, 'Als het echt helpt, graag. Ik ben niet tegen hulp. Ik ben tegen hulp die niet helpt.', {mood: 'thinking'});
    await say(c, 'Het Orakel zei gisteren tegen een meneer dat zijn hond een paspoort nodig heeft. Hij heeft geen hond.', {mood: 'worried'});
  } else if (i === 4) {
    G.flags.ilse_cijfers = true;
    await say(c, 'Gisteren 212. Eergisteren 198. Ik houd een turflijst bij. Op papier.', {mood: 'smug'});
    await say(c, 'Het systeem telt alleen de mensen die niet ophangen. Dus eigenlijk zijn het er meer. En een derde gaat over die ene brief. Reken maar uit.', {mood: 'thinking'});
    rel('ilse', 1);
  } else if (i === 5) {
    G.flags.ilse_hoe = true;
    await say(c, 'Hoe ik dat volhoud?', {mood: 'surprised'});
    await say(c, 'Thee. Heel veel thee. En meneer Kok, die soms een broodje voor me meeneemt. Hij denkt dat ik dat niet doorheb.', {mood: 'happy'});
    await say(c, 'Dank je dat je het vraagt. Dat doet bijna niemand.', {mood: 'happy'});
    rel('ilse', 2);
  } else await say(c, 'Dank je. Nummer 214, alstublieft!', {mood: 'tired'});
};
async function ilseBrief(c) {
  const k = await choose([
    'Dan herschrijf ik hem zelf. Op één A4, in gewone taal.',
    'Laat het Orakel hem herschrijven. Daar is het toch voor?',
    'Laten we de inwoners in de hal vragen wat ze er niet aan snappen.',
    'Daar moet ik even over nadenken.',
  ]);
  if (k === 3) { await say(c, 'Neem je tijd. Hij ligt hier al drie jaar, hij kan nog wel een uurtje.', {mood: 'laugh'}); return; }
  if (k === 0) {
    await say(c, 'Zelf? Dat… mag dat? De brief is van Communicatie.', {mood: 'surprised'});
    await say(c, 'Loop dan wel even langs bij Ingrid, die heeft hem geschreven. Haar kamer is aan het begin van de gang. Ze bijt niet. Meestal niet.', {mood: 'smug'});
    choice('ilse_brief', {npc: 'ilse', label: 'De afvalpasbrief', text: 'Je besloot de afvalpasbrief zelf te herschrijven.', pick: 'zelf'});
    rel('ilse', 1);
  } else if (k === 1) {
    await say(c, 'Het Orakel.', {mood: 'worried'});
    await say(c, 'Hetzelfde Orakel dat een meneer een paspoort voor zijn hond aanraadde. Hij heeft geen hond.', {mood: 'worried'});
    await say(c, 'Nou ja. Jij bent de adviseur. Maar ik lees hem wel na voordat hij de deur uit gaat.', {mood: 'tired'});
    choice('ilse_brief', {npc: 'ilse', label: 'De afvalpasbrief', text: 'Je liet de afvalpasbrief door het Orakel herschrijven.', pick: 'orakel'});
    rel('ilse', -1);
  } else {
    await say(c, 'De inwoners zelf vragen?', {mood: 'surprised'});
    await say(c, 'Dat is zo logisch dat niemand het ooit gedaan heeft.', {mood: 'laugh'});
    await say(c, 'Er zitten er genoeg in de hal. Vraag er twee of drie wat ze niet snappen. Ik schrijf mee, tussen de telefoontjes door.', {mood: 'happy'});
    choice('ilse_brief', {npc: 'ilse', label: 'De afvalpasbrief', text: 'Je vroeg inwoners wat ze niet snapten aan de afvalpasbrief.', pick: 'inwoners'});
    rel('ilse', 2);
  }
}
async function ilseBrood(c) {
  G.flags.brood_ilse = true; delete G.items.brood;
  await say(c, 'Een brood? Van wie?', {mood: 'surprised'});
  await say('you', 'Van meneer Kok. Nummer 388.');
  await say(c, 'Meneer Kok… Hij is echt de liefste.', {mood: 'happy'});
  await say(c, 'Ik ben vergeten te lunchen. Gisteren ook. Ik denk dat ik sinds de fusie niet meer heb geluncht.', {mood: 'laugh'});
  await say('nar', `Ilse zwaait naar meneer Kok en wijst naar jou. ‘${Cap(pron().subj)} heeft het gebracht!’ Meneer Kok steekt zijn duim op. Hij blijft zitten. Het is tenslotte zijn plek.`);
  choice('kok', {npc: 'burger1', label: 'Meneer Kok, nummer 388', text: 'Je bracht het brood van meneer Kok naar Ilse.', pick: 'brood'});
  rel('ilse', 1, {silent: true});
  rel('burger1', 2);
}

// ---- Mevrouw Bakker: will she ever speak to a human? ----
ON.talk.bakker = () => async c => {
  if (once('bakker_f0')) return bakkerFirst(c);
  if (chose('ilse_brief', 'inwoners') && !G.flags.brief_bakker) {
    if (await choose(['Mag ik u iets vragen over de afvalpasbrief?', 'Ik loop weer verder.']) === 0) {
      await say(c, 'Die brief! Ik heb hem drie keer gelezen. De derde keer met een vergrootglas. Het werd er niet beter van.', {mood: 'angry'});
      await say(c, 'Schrijf gewoon wat ik moet doen, en wanneer. Ik ben negenenzeventig, niet achterlijk.', {mood: 'smug'});
      G.flags.brief_bakker = true;
      rel('bakker', 1, {silent: true});
      return;
    }
  }
  await say(c, pick(['Ik wacht hier wel. Ik heb een boterham bij me, en een paraplu. Ik ben op alles voorbereid.',
    chose('bakker_belofte', 'belofte') || chose('bakker_belofte', 'stellig') ? 'Vergeet het niet, hè. Een mens. U had het beloofd.' : 'Als u beneden een balie vindt waar een mens zit, laat het me weten.',
    'Mijn buurvrouw zegt dat dat Orakel alles weet. Mijn buurvrouw zegt ook dat de maan van kaas is.']), {mood: 'smug'});
};
async function bakkerFirst(c) {
  await say(c, 'Ik bel al drie keer over mijn parkeervergunning. Als u een computer neerzet, wie neemt er dan nog op?', {mood: 'angry'});
  await say(c, 'En kijk eens wat ik gisteren kreeg. ‘Uw parkeervergunning is geldig tot het jaar 3000 en is verlopen.’ Allebei!', {mood: 'surprised'});
  await say(c, 'Ondertekend door ‘het Orakel’. Lief kind, ik ben negenenzeventig. Ik heb geen tijd voor het jaar drieduizend.', {mood: 'tired'});
  const i = await choose([
    'Ik ga uitzoeken wat er aan de hand is.',
    'Heeft u het al via de website geprobeerd?',
    archOpt('handhaver', 'Ik regel het. Vrijdag heeft u een mens aan de lijn.'),
    archOpt('datatovenaar', 'Hoe lang zat u in de wacht, die drie keer?'),
    archOpt('archivaris', 'Uw vergunning valt nog onder de regeling van 2009. Die is niet verlopen.'),
    archOpt('verbinder', 'Waar heeft u die vergunning eigenlijk voor nodig?'),
  ]);
  if (i === 0) await say(c, 'Dat zeggen ze allemaal. Maar u kijkt me tenminste aan. Dat is al wat.', {mood: 'thinking'});
  else if (i === 1) {
    await say(c, 'De website. Ja. Daar vroeg een vriendelijk venstertje of ik een robot was.', {mood: 'smug'});
    await say(c, 'Ik weet het eerlijk gezegd niet eens zeker meer.', {mood: 'worried'});
  } else if (i === 2) {
    await say(c, 'Vrijdag. Ik schrijf het op.', {mood: 'smug'});
    await say('nar', 'Mevrouw Bakker haalt een agenda uit haar handtas en schrijft er iets in. Met een vulpen. Ze onderstreept het twee keer.');
    choice('bakker_belofte', {npc: 'bakker', label: 'Een mens voor mevrouw Bakker', text: 'Je beloofde mevrouw Bakker stellig dat ze vrijdag een mens spreekt.', pick: 'stellig'});
    rel('bakker', 1);
    return;
  } else if (i === 3) {
    await say(c, 'Veertien minuten, tweeëntwintig minuten en eenenveertig minuten. Ik heb het genoteerd. In mijn agenda. Op papier.', {mood: 'smug'});
    await say(c, 'Samen ruim een uur panfluitmuziek. Ik kan hem inmiddels meefluiten.', {mood: 'tired'});
    rel('bakker', 1, {silent: true});
  } else if (i === 4) {
    await say(c, 'Zie je wel! Dat zei ik ook al!', {mood: 'happy'});
    await say(c, 'Maar het Orakel zegt dat 2009 niet bestaat. Ik was er anders bij, in 2009.', {mood: 'angry'});
    G.flags.bakker_2009 = true;
    rel('bakker', 1, {silent: true});
  } else if (i === 5) {
    await say(c, 'Waarvoor?', {mood: 'surprised'});
    await say(c, 'Mijn kleinkinderen komen op zondag. Met de auto. Als de vergunning verloopt, komen ze niet meer zo makkelijk.', {mood: 'sad'});
    await say(c, 'Ik ben niet bang voor computers, kind. Ik ben bang dat ik op zondag alleen zit.', {mood: 'sad'});
    G.flags.bakker_kleinkinderen = true;
    rel('bakker', 2);
  }
  await say(c, 'Als u daar beneden ooit een balie vindt waar een mens zit, laat het me dan weten?', {mood: 'thinking'});
  const p = await choose(['Dat beloof ik u.', 'Ik doe mijn best. Beloven kan ik het niet.']);
  if (p === 0) {
    await say(c, 'Een belofte. Goed. Ik houd u eraan.', {mood: 'smug'});
    choice('bakker_belofte', {npc: 'bakker', label: 'Een mens voor mevrouw Bakker', text: 'Je beloofde mevrouw Bakker dat ze een mens te spreken krijgt.', pick: 'belofte'});
    rel('bakker', 1);
  } else {
    await say(c, 'Eerlijk. Dat is tegenwoordig ook wat waard.', {mood: 'happy'});
    choice('bakker_belofte', {npc: 'bakker', label: 'Een mens voor mevrouw Bakker', text: 'Je was eerlijk tegen mevrouw Bakker: beloven kon je het niet.', pick: 'eerlijk'});
    rel('bakker', 1, {text: 'Mevrouw Bakker waardeert je eerlijkheid.'});
  }
}

// ---- the waiting room: Meneer Kok (388), Sanne and her stamp, Meneer De Wit and the dog he does not have ----
ON.talk.burger1 = () => async c => {
  if (G.flags.brood_ilse && !G.flags.kok_bedankt) {
    G.flags.kok_bedankt = true;
    await say(c, 'Heeft ze het gekregen? Mooi.', {mood: 'happy'});
    await say(c, 'Hier. Het derde brood. Voor u. Ik neem altijd een reserve mee voor de reserve.', {mood: 'happy'});
    giveItem('snack:kok');
    return;
  }
  if (once('kok_f0')) await say(c, 'Ik ben nummer 388. Ze zijn bij 214. Ik heb brood meegenomen. En een tweede brood.', {mood: 'tired'});
  else await say(c, pick(['Nog 174 nummers. Als iedereen vier minuten duurt, ben ik om 16:42 aan de beurt. Ik heb het uitgerekend.', 'Mijn zoon zegt dat er een computer komt die alle vragen beantwoordt. Dan vraag ik hem eerst waarom ik hier al twee uur zit.']), {mood: 'thinking'});
  const i = await choose([
    {t: 'Waarom twee broden?', if: !G.flags.kok_brood},
    {t: 'Mag ik u iets vragen over de afvalpasbrief?', if: chose('ilse_brief', 'inwoners') && !G.flags.brief_burger1},
    archOpt('archivaris', 'Wist u dat er een aparte balie is voor wie alleen een formulier komt afgeven?'),
    'Sterkte met het wachten.',
  ]);
  if (i === 0) {
    G.flags.kok_brood = true;
    await say(c, 'Eén voor mij. En één voor Ilse, achter de balie. Ze eet nooit. Niemand ziet dat.', {mood: 'thinking'});
    await say(c, 'Zou u het haar willen geven? Als ik opsta, ben ik mijn plek kwijt. Daar heb ik twee uur voor gezeten.', {mood: 'worried'});
    if (await choose(['Natuurlijk. Geef maar.', 'Sorry, ik heb het echt te druk.']) === 0) { giveItem('brood'); rel('burger1', 1, {silent: true}); }
    else { await say(c, 'Nee, natuurlijk. U heeft het druk. Iedereen heeft het druk.', {mood: 'sad'}); rel('burger1', -1); }
  } else if (i === 1) {
    await say(c, 'De afvalpasbrief? Ik dacht dat het een prijsvraag was.', {mood: 'surprised'});
    await say(c, 'Er stond ‘inzamelingsstructuur’ in. Ik heb het opgezocht. Het betekent ‘container’. Zeg dan gewoon container.', {mood: 'smug'});
    G.flags.brief_burger1 = true;
    rel('burger1', 1, {silent: true});
  } else if (i === 2) {
    await say(c, 'Een aparte balie? Voor formulieren?', {mood: 'surprised'});
    await say(c, 'Ik zit hier al twee uur met één formulier! Waarom zegt niemand dat?', {mood: 'angry'});
    await say(c, 'Dank u wel. Echt. Hier, neem een brood. Ik heb er toch twee.', {mood: 'happy'});
    giveItem('snack:kok');
    G.flags.kok_brood = true; G.flags.kok_bedankt = true;
    choice('kok', {npc: 'burger1', label: 'Meneer Kok, nummer 388', text: 'Je wees meneer Kok de aparte balie voor formulieren.', pick: 'balie'});
    rel('burger1', 2);
    // he walks off to the right counter, round the benches, and is gone
    whenFree(async () => {
      for (const [x, z] of [[18, 22], [22, 22], [22, 14], [29, 13]]) await c.walkTo(x * TILE + 1, z * TILE + 1, 2.4);
      G.flags.kok_weg = true;
    });
  } else await say(c, 'Dank u. Ik heb brood.', {mood: 'happy'});
};

ON.talk.burger2 = () => async c => {
  if (G.items.stempeltje && !G.flags.sanne_stempel) return sanneStempel(c);
  if (G.flags.sanne_stempel) { await say(c, pick(['Klik. Ik doe het af en toe nog eens, op een leeg vel. Voor het gevoel.', 'Ik ga het formulier inlijsten. Naast mijn diploma.']), {mood: 'happy'}); return; }
  if (once('sanne_f0')) await say(c, 'Ik kom alleen voor een stempel. Al drie weken. Het is een heel klein stempeltje.', {mood: 'tired'});
  else await say(c, 'Op de website staat dat ik ‘online een afspraak kan maken voor het maken van een afspraak’. Dat heb ik gedaan. Nu sta ik hier.', {mood: 'smug'});
  const i = await choose([
    {t: 'Waarom duurt dat zo lang?', if: !G.flags.sanne_vraag},
    {t: 'Ik ga dat stempeltje voor u zoeken.', if: G.flags.sanne_vraag && !chose('sanne_stempel')},
    {t: 'Mag ik u iets vragen over de afvalpasbrief?', if: chose('ilse_brief', 'inwoners') && !G.flags.brief_burger2},
    archOpt('handhaver', 'Geef dat formulier maar. Ik zet die stempel zelf.', !G.flags.sanne_zelf),
    archOpt('datatovenaar', 'Drie weken voor één stempel. Hoeveel mensen wachten er nog op dat stempeltje?', !G.flags.stempelgate),
    'Veel succes.',
  ]);
  if (i === 0) {
    G.flags.sanne_vraag = true;
    await say(c, 'Het stempeltje is zoek. Ilse zegt dat het bij Facilitaire Zaken ligt. Facilitaire Zaken zegt dat het bij Joop ligt. En Joop zegt dat hij zijn leesbril kwijt is.', {mood: 'tired'});
    await say(c, 'Ik heb nu een spreadsheet. Met wie wat zegt.', {mood: 'smug'});
  } else if (i === 1) {
    await say(c, 'Echt? Dat zou… dat zou heel fijn zijn. Het is echt klein. Groen. Er staat ‘akkoord’ op.', {mood: 'happy'});
    choice('sanne_stempel', {npc: 'burger2', label: 'Het stempeltje van Sanne', text: 'Je beloofde Sanne haar stempeltje te zoeken.', pick: 'zoeken'});
    rel('burger2', 1);
  } else if (i === 2) {
    await say(c, 'Die brief? Ik dacht eerst dat hij in het Latijn was.', {mood: 'surprised'});
    await say(c, 'Mijn zoon dacht dat het een cryptogram was. Hij heeft hem opgelost. Het antwoord was ‘container’.', {mood: 'laugh'});
    G.flags.brief_burger2 = true;
    rel('burger2', 1, {silent: true});
  } else if (i === 3) {
    G.flags.sanne_zelf = true;
    await say(c, 'U mag geen stempels zetten. U bent nieuw.', {mood: 'smug'});
    await say(c, 'Maar ik vind het lief dat u het aanbiedt.', {mood: 'happy'});
    rel('burger2', 1, {silent: true});
  } else if (i === 4) {
    G.flags.stempelgate = true;
    await say(c, 'Zeven. We hebben een groepsapp.', {mood: 'smug'});
    await say(c, 'Hij heet ‘Stempelgate’.', {mood: 'laugh'});
    rel('burger2', 1, {silent: true});
  } else await say(c, 'Dank u. Ik heb de tijd. Dat is het probleem.', {mood: 'tired'});
};
async function sanneStempel(c) {
  G.flags.sanne_stempel = true; delete G.items.stempeltje;
  await say(c, 'Is dat… het stempeltje?', {mood: 'surprised'});
  await say('nar', 'Sanne pakt het stempeltje aan alsof het van glas is. Ze ademt erop. Ze zet het op haar formulier.');
  await say(c, 'Klik.', {mood: 'happy'});
  await say(c, 'Drie weken. Eén klik.', {mood: 'laugh'});
  await say(c, 'Dank u. Ik ga het formulier inlijsten.', {mood: 'happy'});
  choice('sanne_stempel', {npc: 'burger2', label: 'Het stempeltje van Sanne', text: 'Je vond het stempeltje van Sanne in het magazijn.', pick: 'gebracht'});
  rel('burger2', 2);
  award('stempel');
}

const HOND_IDLE = {hond: 'Ik heb het asiel al gebeld. Ze vroegen of ik een paspoort heb. Voor mezelf.', eerst: 'Ik heb een lijstje gemaakt van wat een hond nodig heeft. Er staat nog niks op. Dat is ook een begin.', kat: 'Ik heb een kattenmand besteld. De kat komt later. Katten komen altijd later.'};
ON.talk.burger3 = () => async c => {
  if (once('dewit_f0')) {
    await say(c, 'Het Orakel zei dat mijn hond een paspoort nodig heeft. Ik heb geen hond.', {mood: 'worried'});
    await say(c, 'Toen ik dat zei, antwoordde het: ‘Dan heeft uw hond er twee nodig.’', {mood: 'surprised'});
    await say(c, 'Ik overweeg nu een hond te nemen. Gewoon om het uit te zoeken.', {mood: 'thinking'});
  } else await say(c, HOND_IDLE[chose('dewit_hond')] || 'Ik sta hier met een riem. Mensen kijken. Ik kijk terug, namens de hond.', {mood: 'thinking'});
  const free = !chose('dewit_hond'), bril = !G.items.leesbril && !G.flags.joop_bril;
  const i = await choose([
    {t: 'Doe het. Iedereen verdient een hond.', if: free},
    {t: 'Zoek eerst uit wat een hond echt nodig heeft.', if: free},
    {t: 'Neem een kat. Die heeft nergens papieren voor nodig.', if: free},
    {t: G.flags.joop_bril_kwijt ? 'Is die tweede bril van u eigenlijk de leesbril van Joop?' : 'U draagt twee brillen, meneer De Wit.', if: bril},
    {t: 'Mag ik u iets vragen over de afvalpasbrief?', if: chose('ilse_brief', 'inwoners') && !G.flags.brief_burger3},
    archOpt('archivaris', 'Die riem komt van het oude hondenregister, toch? Dat bestaat al sinds 2003 niet meer.', !G.flags.dewit_register),
    'Ik laat u even.',
  ]);
  const hond = (pk, text) => choice('dewit_hond', {npc: 'burger3', label: 'Een hond voor meneer De Wit', text, pick: pk});
  if (i === 0) {
    await say(c, 'Iedereen verdient een hond. Ja. Ja!', {mood: 'happy'});
    await say(c, 'Ik ga vanmiddag naar het asiel. Alleen kijken. Zeggen ze allemaal.', {mood: 'laugh'});
    hond('hond', 'Je raadde meneer De Wit aan om een hond te nemen.'); rel('burger3', 1);
  } else if (i === 1) {
    await say(c, 'Eerst uitzoeken wat een hond nodig heeft. Voordat je hem neemt.', {mood: 'thinking'});
    await say(c, 'Dat is eigenlijk heel verstandig. Waarom doet het Orakel dat niet?', {mood: 'surprised'});
    hond('eerst', 'Je raadde meneer De Wit aan om eerst uit te zoeken wat een hond nodig heeft.'); rel('burger3', 1);
  } else if (i === 2) {
    await say(c, 'Een kat.', {mood: 'thinking'});
    await say(c, 'Een kat heeft geen paspoort nodig. Maar een kat wil er vast wel een. Uit principe.', {mood: 'laugh'});
    hond('kat', 'Je raadde meneer De Wit aan om een kat te nemen.'); rel('burger3', 1);
  } else if (i === 3) {
    await say(c, 'O, deze? Die lag op een bank. Ik dacht: misschien is hij van mijn hond.', {mood: 'surprised'});
    await say(c, 'Ik heb geen hond. Maar je weet het nooit, met het Orakel. Neem jij hem maar mee, jij werkt hier.', {mood: 'thinking'});
    giveItem('leesbril');
  } else if (i === 4) {
    await say(c, 'Er stond in dat ik ‘de pas dien te activeren’. Ik heb hem in de magnetron gelegd.', {mood: 'worried'});
    await say(c, 'Dat was niet goed. Niet voor de pas, en ook niet voor de magnetron.', {mood: 'sad'});
    G.flags.brief_burger3 = true;
    rel('burger3', 1, {silent: true});
  } else if (i === 5) {
    G.flags.dewit_register = true;
    await say(c, '…Dus mijn hond hoeft niet geregistreerd te worden?', {mood: 'surprised'});
    await say(c, 'Mijn hond die niet bestaat, hoeft niet in een register dat niet bestaat. Dit is de beste dag van mijn leven.', {mood: 'laugh'});
    rel('burger3', 1);
  } else await say(c, 'Ga maar. Ik heb nog een riem vast te houden.', {mood: 'neutral'});
};

// ---- the ticket machine counts on, and on ----
const TICKETS = [389, 390, 392, 396, 404, 420, 452, 516, 644, 900, 999];
const TICKET_MSG = ['Huidige beurt: 214. Geschatte wachttijd: ja.', 'U heeft al een nummer. U heeft er nu twee.', 'De automaat slaat er een over. Hij heeft ook zo zijn dagen.',
  'Uw nummers zitten nu samen in de wachtrij. Ze kletsen wat.', 'Nummer niet gevonden.', 'De automaat zucht. Er komt een beetje stoom uit.',
  'Iemand in de wachtrij kijkt naar je nummer. Dan naar het zijne. Dan heel lang naar het plafond.', 'Geschatte wachttijd: volgend kwartaal.',
  'Er komt een tweede bonnetje uit: ‘Gaat het wel goed met u?’', 'De automaat telt af. Hij lijkt er bijna zin in te hebben.', 'U bent de laatste. Wij gaan zo sluiten.'];
ON.use.ticket = () => {
  const k = G.flags.ticketN = (G.flags.ticketN || 0) + 1;
  if (k > TICKETS.length) { UI.toast('De nummerautomaat', 'Hij is leeg. Er komt alleen nog een bonnetje uit: ‘Sorry.’'); SFX.play('locked'); return; }
  G.flags.tickets = TICKETS[k - 1];
  UI.toast(`Nummer ${G.flags.tickets}`, TICKET_MSG[k - 1]); SFX.play('pick');
  if (k === TICKETS.length) { findSecret('nummer999'); award('nummer999'); }
};

// ---- Communicatie: Ingrid wrote the afvalpasbrief, with ten lawyers on her shoulder ----
ON.talk.ingrid = () => async c => {
  if (once('ingrid_f0')) {
    await say(c, 'Ingrid, Communicatie. Als je komt klagen over de afvalpasbrief: neem een nummertje.', {mood: 'smug'});
    await say(c, 'Grapje. Een beetje.', {mood: 'laugh'});
  }
  const brief = chose('ilse_brief');
  if (brief === 'zelf' && !G.flags.ingrid_zegen) return ingridZegen(c);
  if (brief === 'inwoners' && once('ingrid_inw')) {
    await say(c, 'Inwoners laten meelezen? Dat staat al jaren in onze schrijfwijzer. Op pagina 47.', {mood: 'thinking'});
    await say(c, 'Niemand komt ooit voorbij pagina 12. Goed dat iemand het gewoon doet.', {mood: 'happy'});
    rel('ingrid', 1, {silent: true});
    return;
  }
  if (brief === 'orakel' && once('ingrid_ork')) {
    await say(c, 'Het Orakel gaat mijn brief herschrijven? Prima.', {mood: 'smug'});
    await say(c, 'Dan kan ik eindelijk ook eens klagen over een brief van iemand anders.', {mood: 'laugh'});
    return;
  }
  const i = await choose([{t: 'Wie heeft die afvalpasbrief eigenlijk geschreven?', if: !G.flags.ingrid_wie}, 'Wat doet Communicatie eigenlijk?', 'Ik laat je weer.']);
  if (i === 0) {
    G.flags.ingrid_wie = true;
    await say(c, 'Ik.', {mood: 'sad'});
    await say(c, 'Met tien juristen op mijn schouder. Elke zin is drie keer getoetst. Niemand snapte hem, maar iedereen vond hem goed.', {mood: 'tired'});
    await say(c, 'Als iemand hem wil herschrijven: graag. Ik wacht er al drie jaar op. Maar niemand vraagt het. Iedereen klaagt alleen.', {mood: 'sad'});
  } else if (i === 1) {
    await say(c, pick(['Wij maken het begrijpelijk. Dat staat op de deur. In vier talen. Niemand snapt het bordje.', 'We hebben een nieuwe huisstijl. De oude was ook goed, maar deze heeft een ronder lettertype.', 'Ik heb een poster over begrijpelijke taal gemaakt. Hij hangt hier. Lees hem maar eens. Hardop.']), {mood: 'smug'});
  }
};
async function ingridZegen(c) {
  await say(c, 'Ilse zegt dat jij de afvalpasbrief wilt herschrijven.', {mood: 'surprised'});
  const i = await choose([
    'Klopt. Op één A4, in gewone taal. Mag dat?',
    archOpt('datatovenaar', 'Een derde van alle telefoontjes gaat over die brief. Dat lossen we samen op.'),
    archOpt('handhaver', 'Vrijdag ligt er een nieuwe. Met of zonder jou.'),
    archOpt('archivaris', 'De versie van 2019 was korter. Waarom is die vervangen?'),
    archOpt('verbinder', 'Het lijkt me frustrerend dat iedereen over jouw brief klaagt.'),
  ]);
  if (i === 1) { await say(c, 'Een DERDE?', {mood: 'surprised'}); await say(c, 'Dat stond niet in de evaluatie. Er wás geen evaluatie.', {mood: 'worried'}); }
  else if (i === 2) { await say(c, 'Met of zonder mij.', {mood: 'angry'}); await say(c, '…Weet je wat? Je hebt gelijk. Ik ga koffie halen. Neem jij het toetsenbord maar.', {mood: 'tired'}); }
  else if (i === 3) { await say(c, 'Omdat die te kort was, zei de jurist. ‘Er moet meer in.’ Wat dan? ‘Meer.’', {mood: 'smug'}); await say(c, 'Jij bent de eerste die die versie nog kent. Respect.', {mood: 'happy'}); }
  else if (i === 4) { await say(c, 'Frustrerend? Je bent de eerste die dat zegt.', {mood: 'surprised'}); await say(c, 'Ik wilde hem zelf ook anders. Maar met tien juristen op je schouder schrijf je geen zin van vijf woorden.', {mood: 'sad'}); }
  await say(c, 'Ga je gang. Echt. Ik wacht al drie jaar op iemand die dat vraagt.', {mood: 'happy'});
  await say(c, 'Eén tip: zet bovenaan wat iemand moet doen. Niet waarom de gemeente het allemaal zo mooi heeft geregeld.', {mood: 'smug'});
  G.flags.ingrid_zegen = true;
  rel('ingrid', i === 4 ? 3 : i === 2 ? 1 : 2, {text: 'Ingrid zal dit onthouden.'});
  award('begrijpelijk');
}

// ---- Reprografie: Dirk of ICT, and the printer that does not work ----
ON.talk.dirk = () => async c => {
  if (once('dirk_f0')) {
    const n = naam();
    await say(c, 'Dirk, ICT, tweede lijn. Als het om de printer gaat: heb je hem al uit en weer aan gezet?', {mood: 'tired'});
    if (n) await say(c, `Jij bent ${n}, toch? Ik heb je account vanochtend aangemaakt. Je wachtwoord is ‘Welkom01’. Iedereen zijn wachtwoord is ‘Welkom01’.`, {mood: 'smug'});
  } else if (G.flags.printer_ok) { await say(c, pick(['Niemand aankomen. Hij doet het. Ik durf niet eens te ademen.', 'Ik heb het ticket op ‘opgelost’ gezet. En daarna weer op ‘in behandeling’. Voor de zekerheid.']), {mood: 'worried'}); return; }
  const i = await choose([
    {t: 'Doet die printer het eigenlijk ooit?', if: !G.flags.dirk_ooit},
    {t: 'Wat vind jij van het Orakel?', if: !G.flags.dirk_orakel},
    archOpt('datatovenaar', 'Heb je de foutlog al bekeken?', !G.flags.dirk_log),
    archOpt('verbinder', 'Hoe lang zit je hier al met die printer?', !G.flags.dirk_hoe),
    'Ik kijk zelf wel even.',
  ]);
  if (i === 0) {
    G.flags.dirk_ooit = true;
    await say(c, 'Ooit. Op 14 maart 2016. Er is een foto van. Hij hangt in de kantine.', {mood: 'thinking'});
    await say(c, 'Sindsdien probeert iedereen het. Ik noem het de wachtrij van de hoop.', {mood: 'tired'});
  } else if (i === 1) {
    G.flags.dirk_orakel = true;
    await say(c, 'Het Orakel? Ik heb het aangesloten.', {mood: 'worried'});
    await say(c, 'Het vroeg om toegang tot alles. Ik vroeg: wat is alles? Het zei: ja.', {mood: 'surprised'});
    await say(c, 'Ik heb daar nog een ticket over openstaan. Prioriteit: middel. Achteraf gezien had dat ‘hoog’ moeten zijn.', {mood: 'tired'});
  } else if (i === 2) {
    G.flags.dirk_log = true;
    await say(c, 'De foutlog?', {mood: 'surprised'});
    await say(c, 'Daar heb ik nooit aan gedacht. Ik ben ICT, geen tovenaar.', {mood: 'laugh'});
  } else if (i === 3) {
    G.flags.dirk_hoe = true;
    await say(c, 'Sinds de fusie. Hij en ik.', {mood: 'sad'});
    await say(c, 'Hij doet het niet, ik doe het wel. We vullen elkaar aan.', {mood: 'tired'});
    rel('dirk', 1, {silent: true});
  } else await say(c, 'Succes. Ik ben hier als je me nodig hebt. Ik ben altijd hier.', {mood: 'neutral'});
};
const PRINT_ERR = ['PAPIERSTORING IN LADE 2.', 'TONER BIJNA LEEG. (Sinds 2016.)', 'UW OPDRACHT STAAT IN DE WACHTRIJ ACHTER: kerstkaart_2019_DEFINITIEF_v3.docx (418 kopieën).', 'ONBEKENDE FOUT. PROBEER HET OPNIEUW. OF NIET.'];
ON.use.printer = o => scene(async () => {
  if (G.flags.printer_ok) {
    o.printT = 1.4; SFX.play('push');
    await say('nar', pick(['De printer zoemt tevreden en print een testpagina. Hij doet het. Niemand weet waarom. Niemand durft het te vragen.', 'Je print nog een naambordje. Gewoon omdat het kan.', 'Er rolt een vel uit met één zin: ‘Graag gedaan.’ Je had niets geprint.']));
    return;
  }
  const n = G.flags.printer_tries = (G.flags.printer_tries || 0) + 1;
  await say('nar', `Het schermpje van de printer knippert: ‘${PRINT_ERR[(n - 1) % PRINT_ERR.length]}’`);
  const i = await choose([
    {t: 'Zet hem uit en weer aan.', if: !G.flags.pr_aan},
    {t: 'Geef hem een tikje.', if: !G.flags.pr_tik},
    {t: 'Praat er vriendelijk tegen.', if: !G.flags.pr_praat},
    archOpt('handhaver', 'Eén gerichte klap, precies op het logo.'),
    archOpt('datatovenaar', 'Lees de foutlog uit.'),
    archOpt('archivaris', 'Pak de handleiding uit 2003 erbij. Stap 1 tot en met 14.'),
    archOpt('verbinder', 'Vraag de printer hoe het met hem gaat.'),
    'Laat maar. Niet vandaag.',
  ]);
  if (i === 7) return;
  if (i === 0) { G.flags.pr_aan = true; await say('nar', 'Je zet hem uit. Je telt tot tien. Je zet hem weer aan. Hij maakt een geluid als een koffiezetapparaat met heimwee.'); }
  else if (i === 1) { G.flags.pr_tik = true; SFX.play('hit'); await say('nar', 'Je geeft hem een tikje. De printer piept beledigd.'); }
  else if (i === 2) { G.flags.pr_praat = true; await say('nar', 'Je zegt: ‘Goed zo, jongen. Rustig maar.’ De printer zoemt. Iets in hem lijkt te luisteren.'); }
  const all3 = G.flags.pr_aan && G.flags.pr_tik && G.flags.pr_praat;
  if (i <= 2 && !all3) { await say('nar', 'Er gebeurt niets. Behalve dat het schermpje alvast een nieuwe foutmelding bedenkt.'); return; }
  if (i <= 2) await say('nar', 'Uit, een tik en een vriendelijk woord. In die volgorde, op een maandag. Er klinkt een zacht gezoem.');
  else if (i === 3) { SFX.play('sealHit'); await say('nar', 'Je klapt precies op het logo. Eén keer. De printer denkt even na, en besluit dat hij toch liever print.'); }
  else if (i === 4) await say('nar', 'Foutcode 0x0FF1CE: ‘Gebruiker heeft te veel haast.’ Je wacht tien seconden. Je ademt uit.');
  else if (i === 5) await say('nar', 'Stap 13: wacht. Stap 14: druk op OK. Je drukt op OK. Voor zover bekend heeft nog nooit iemand stap 14 gehaald.');
  else if (i === 6) await say('nar', 'Je vraagt hoe het met hem gaat. Het blijft even stil. Dan rolt er een testpagina uit: ‘Dank je. Niemand vraagt dat ooit.’');
  await printerWorks(o, i <= 2 ? 'geduld' : ['klap', 'foutlog', 'handleiding', 'gesprek'][i - 3]);
});
const PRINT_HOW = {geduld: 'met geduld: uit, een tik en een vriendelijk woord', klap: 'met één gerichte klap', foutlog: 'door de foutlog te lezen', handleiding: 'met de handleiding uit 2003', gesprek: 'door te vragen hoe het met hem ging'};
async function printerWorks(o, how) {
  G.flags.printer_ok = true;
  o.printT = 1.4; SFX.play('questDone');
  await say('nar', `De printer print. Een warm vel, recht, zonder vlekken. Er staat op: ‘${naam() || 'Nieuwe adviseur'} · adviseur Dienstverlening’. Je naambordje. Nu ben je echt officieel.`);
  if (G.flags.ingrid_zegen && !G.flags.brief_geprint) { G.flags.brief_geprint = true; await say('nar', 'Daarna rolt er nog een vel uit: jouw nieuwe afvalpasbrief. Op één A4. Bovenaan staat wat je moet doen.'); }
  choice('printer', {npc: 'dirk', label: 'De printer van Reprografie', text: `Je kreeg de printer aan de praat ${PRINT_HOW[how]}.`, pick: how});
  findSecret('printer');
  await say('dirk', 'Hij… doet het?', {mood: 'surprised'});
  await say('dirk', 'Niemand bewegen. Ik maak hier een ticket van. Prioriteit: wonder.', {mood: 'worried'});
  await say('dirk', 'Hier. Mijn koffiebon van de directie. Ik heb hem sinds 2014 en nooit durven gebruiken. Jij hebt hem verdiend.', {mood: 'happy'});
  giveItem('trinket:koffiebon');
  rel('dirk', 2);
}

// ---- the kantine: a vending machine with one bar left, since 2011 ----
ON.use.snoepautomaat = () => scene(async () => {
  if (G.flags.reep) { await say('nar', 'De snoepautomaat is leeg, op een paar dropveters uit 2009 na. Die laat je hangen.'); return; }
  await say('nar', 'In de snoepautomaat hangt één reep scheef tussen de spiraal en het glas. Er zit een briefje op: ‘Hangt hier sinds 2011. Niet aan schudden.’');
  const i = await choose([
    'Druk op B4.',
    'Schud er voorzichtig aan.',
    archOpt('handhaver', 'Eén gerichte schop, precies onderaan.'),
    archOpt('archivaris', 'Gebruik het noodknopje dat er in 1999 in is gebouwd.'),
    'Laat maar hangen.',
  ]);
  if (i === 0) { await say('nar', 'B4 is uitverkocht. Sinds 2011.'); return; }
  if (i === 4) return;
  if (i === 1) {
    const n = G.flags.snoep_schud = (G.flags.snoep_schud || 0) + 1;
    if (n < 3) { await say('nar', ['De reep wiebelt. Hij hangt nu nóg schever.', 'Er valt een muntje uit 2001 uit de automaat. De reep niet.'][n - 1]); return; }
    await say('nar', 'Bij de derde keer laat de reep los. Hij valt. Ergens in de kantine klinkt applaus. Het is de radio.');
  } else if (i === 2) { SFX.play('hit'); await say('nar', 'Je schopt precies onderaan. De reep valt. En ook een tweede, uit 2011. Die laat je liggen.'); }
  else await say('nar', 'Achter een paneeltje zit een knop met ‘ALLEEN IN NOOD’. Een reep die al dertien jaar hangt, is een noodgeval. Hij valt.');
  G.flags.reep = true;
  giveItem('snack:reep');
});

// ---- the duck mayor (after hallucination #3) ----
ON.talk.eend = () => async c => {
  await say(c, 'Kwak.', {mood: 'neutral'});
  const i = await choose(['Goedemorgen, burgemeester.', 'Bent u… een eend?', 'Kwak?']);
  await say(c, ['Kwak.', 'Kwak!', 'Kwak kwak.'][i], {mood: ['smug', 'angry', 'happy'][i]});
  if (i === 2 && once('eend_kwak')) await say('nar', 'Je weet niet precies wat je net hebt toegezegd. Het klonk als een besluit.');
};
ON.floor.f0 = () => { if (G.flags.eend && G.flags.pip && once('eend_pip')) setTimeout(() => UI.pip('Psst. Kijk straks eens in de entree. Ik zeg niks. Ik zeg helemaal niks.'), 1800); };

// ---- Glans and the Snelle Lift ----
ON.talk.glans = () => async c => {
  if (once('glans_f0')) {
    await say(c, `Ah! ${Cap(formal())}! Glans, PraatPal. Accountmanager, visionair, en deze week uw allerbeste vriend.`, {mood: 'smug'});
    await say(c, 'Het Orakel beantwoordt álle vragen van uw inwoners. Het draait al bij tientallen gemeenten.', {mood: 'happy'});
    await say(c, 'Zullen we even sparren? Ik spar graag. Ik ben, als het ware, een sparrer.', {mood: 'laugh'});
    if (!G.items['bingo:sparren']) giveItem('bingo:sparren');
    await say(c, 'Waarom zou u door die stoffige kelder sjokken? Mijn Snelle Lift brengt u rechtstreeks naar het Orakel. Het contract ligt klaar. U hoeft alleen nog te tekenen.', {mood: 'smug'});
  } else await say(c, G.stats.shortcut ? `U bent terug, ${formal()}! Zullen we het nog eens proberen? Deze keer met korting!` : 'Nog steeds aan het onderzoeken? Mijn lift staat er nog, hoor. Het aanbod geldt tot vrijdag.', {mood: 'smug'});
  const i = await choose([
    {t: 'Ik neem de Snelle Lift. Waar moet ik tekenen?'},
    {t: 'Ik wil het eerst zelf onderzoeken.'},
    {t: 'Wat kost het eigenlijk?', if: !G.cards.includes('1')},
    {t: 'Welk probleem lost het Orakel eigenlijk op?', if: !G.flags.glans_probleem},
    {t: 'Mooi pak. Zit daar ook garantie op?', if: !G.flags.glans_pak},
    archOpt('datatovenaar', 'Tientallen gemeenten. Noemt u er eens drie?', !G.flags.glans_drie),
    archOpt('handhaver', 'Eerst wil ik het contract zien. Artikel voor artikel.', !G.flags.glans_artikel7),
    archOpt('archivaris', 'In 1998 kocht deze gemeente ook een computer die alle vragen beantwoordde.', !G.flags.glans_1998),
    archOpt('verbinder', 'U praat snel, Glans. Zware week?', !G.flags.glans_week),
  ]);
  const houding = (pk, text) => choice('glans_houding', {npc: 'glans', label: 'Hoe je Glans behandelde', text, pick: pk});
  if (i === 0) return shortcut(c);
  if (i === 1) { await say(c, 'Onderzoek! Prachtig. Kost alleen tijd, hè. En tijd is geld. En geld is… nou ja, u snapt het.', {mood: 'smug'}); return; }
  if (i === 2) {
    await say(c, 'Kosten? Ach. Het eerste jaar is het bijna gratis. Daarna hangt het af van het aantal vragen.', {mood: 'smug'});
    await say(c, 'En van het aantal antwoorden. En van de stand van de maan. Hier, mijn kaartje.', {mood: 'laugh'});
    giveItem('card:1');
  } else if (i === 3) {
    G.flags.glans_probleem = true;
    await say(c, 'Welk probleem? Nou. Eh.', {mood: 'surprised'});
    await say(c, 'Vragen! Het lost… vragen op. Mensen hebben vragen, en dan… zijn ze weg.', {mood: 'worried'});
    await say(c, 'Dat is eigenlijk een heel goede vraag. Mag ik die gebruiken in mijn presentatie?', {mood: 'thinking'});
    houding('serieus', 'Je stelde Glans een echte vraag: welk probleem lost het Orakel op?');
    rel('glans', 1);
  } else if (i === 4) {
    G.flags.glans_pak = true;
    await say(c, 'Garantie? Haha! U bent grappig.', {mood: 'laugh'});
    await say(c, 'Dat zet ik in mijn klantsysteem: ‘grappig’. Met drie uitroeptekens. Dat is bij ons een waarschuwing.', {mood: 'smug'});
    houding('spot', 'Je maakte een grap over het glimmende pak van Glans.');
    rel('glans', -1, {text: 'Glans zet dit in zijn klantsysteem.'});
  } else if (i === 5) {
    G.flags.glans_drie = true;
    await say(c, 'Drie? Nou… Dalwijk. Bijna. En… nog een. En een derde die er heel dicht bij in de buurt zit.', {mood: 'worried'});
    await say(c, 'Tientallen is een groeiverwachting. Dat is ook een getal.', {mood: 'smug'});
    houding('cijfers', 'Je vroeg Glans naar de cijfers achter ‘tientallen gemeenten’.');
    rel('glans', 1, {silent: true});
  } else if (i === 6) {
    G.flags.glans_artikel7 = true;
    await say(c, 'Het contract? Natuurlijk! Hier. Artikel één tot en met zes zijn prachtig.', {mood: 'smug'});
    await say(c, 'Artikel zeven is… een uitdaging. Daar staat in dat alles van ons is. De vragen. De antwoorden. En, technisch gezien, de kelder.', {mood: 'worried'});
    houding('contract', 'Je las het contract van Glans, artikel voor artikel. Ook artikel zeven.');
  } else if (i === 7) {
    G.flags.glans_1998 = true;
    await say(c, 'Ja, maar die van ons is… nieuwer. Glimmender. En hij heeft een logo.', {mood: 'smug'});
    await say(c, 'Wat er met die van 1998 is gebeurd? Uitgezet, denk ik. Door een conciërge. Zo gaat dat met innovatie.', {mood: 'thinking'});
  } else if (i === 8) {
    G.flags.glans_week = true;
    await say(c, 'Zware week?', {mood: 'surprised'});
    await say(c, 'Eerlijk? Ik heb een target. Ik heb altijd een target. Als Dalwijk niet tekent, ben ik vrijdag mijn auto kwijt. Hij is van de zaak.', {mood: 'sad'});
    await say(c, '…Waarom vertel ik u dit? Vergeet het. Wilt u een kaartje?', {mood: 'smug'});
    houding('mens', 'Je vroeg Glans hoe het met hém ging. Hij vergat even te verkopen.');
    rel('glans', 2);
  }
};
ON.use.glanslift = () => scene(async () => { await say('nar', 'Gouden deuren. Een bordje: ‘DE SNELLE LIFT · rechtstreeks naar het Orakel · tekenen bij Glans’.'); });

export async function shortcut(c) {
  const sure = await choose(['Ja. Teken.', 'Wacht. Toch maar niet.']);
  if (sure === 1) { await say(c, 'Zoals u wilt. Mijn pen ligt klaar.', {mood: 'smug'}); return; }
  G.pos = {x: P.x, z: P.z, yaw: P.yaw};
  const snap = JSON.stringify(G);
  G.stats.shortcut++;
  await say(c, 'Uitstekend! U zult er geen spijt van krijgen. Waarschijnlijk. Ik stuur de factuur alvast naar de wethouder.', {mood: 'happy'});
  await UI.fade(true, 0.8);
  GAME.mode = 'ending';
  showEnding({title: 'De Snelle Lift', eyebrow: 'Zes weken later', judgement: 'Verder dan het dossier kan dragen',
    text: `Je tekent. De Snelle Lift suist omlaag, voorbij alle kamers, rechtstreeks naar het Orakel.\n\n${EPILOGUES.implement.beyond}\n\nIn het besluitdossier staat één zin: ‘Snelle Lift genomen.’ Alle vijftien kamers van het raamwerk zijn blinde vlekken.`,
    againLabel: 'Terug naar maandagochtend',
    onAgain: async () => {
      applySave(JSON.parse(snap)); G.stats.shortcut = (G.stats.shortcut || 0) + 1; G.flags.shortcutSeen = true;
      $('hud').hidden = false; GAME.mode = 'play';
      await enterFloor(G.floor, null, {fade: false, pos: G.pos || null});
      await UI.fade(false, 0.6);
      UI.toast('Maandagochtend, 8:57', 'Wat een nare droom. Je knippert met je ogen. Glans staat nog steeds te glimlachen. Misschien toch eerst zelf onderzoeken?');
      award('snelle_lift');
      saveGame();
    }});
  await UI.fade(false, 0.6);
}
void ent;
