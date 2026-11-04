// Diepte 0 · Het stadhuis.
import {ON, UI, SFX, P} from '../../game/bus.js';
import {G, saveGame, applySave} from '../../game/state.js';
import {stage, setStage, startQuest} from '../../game/quests.js';
import {say, choose, scene} from '../../game/dialogue.js';
import {giveItem, enterFloor, GAME} from '../../game/game.js';
import {showEnding} from '../../ui/verdict.js';
import {EPILOGUES, STORY} from '../framework.js';
import {$} from '../../core/util.js';

const once = (k) => { if (G.flags[k]) return false; G.flags[k] = true; return true; };

// ---- the letter ----
ON.use.letter = async () => {
  await UI.read('Aan de nieuwe adviseur Dienstverlening', `<p>Welkom bij de gemeente Dalwijk. Ik val maar meteen met de deur in huis.</p>
<p>${STORY.letter.text.replace('Ik wil volgende maand een besluit', 'Ik wil vrijdag jouw advies')}</p>
<p>Het testexemplaar van de leverancier, het ‘Orakel’, staat al in het Gewelf onder het stadhuis. Ga kijken. Spreek mensen. Kom met een besluit dat we aan inwoners kunnen uitleggen, ook als het ‘nee’ wordt.</p>
<p>Wethouder Hendriks</p>
<p><small>PS: Joop, onze conciërge, heeft de sleutel van de kelder. Neem een lamp mee; het licht beneden is nogal… wisselend.</small></p>`);
  if (stage('main') === 0) {
    setStage('main', 1);
    scene(async () => { await say('nar', 'Een advies, vrijdag. Over een Orakel in de kelder. Welkom bij de gemeente.'); });
  }
};

// ---- Joop ----
ON.talk.joop = () => async c => {
  const m = stage('main');
  if (m === 0) {
    await say(c, 'Goeiemorgen! Jij bent de nieuwe? Welkom, welkom.');
    await say(c, 'Lees eerst je post maar. De wethouder schrijft altijd een brief. Op papier. Ze houdt van papier.');
    return;
  }
  if (m === 1) {
    await say(c, 'Naar beneden? Naar het Gewelf? Hm.');
    await say(c, 'Ik doe hier al eenendertig jaar de deuren. Maar sinds dat Orakel aanstaat, ga ik daar niet meer naar beneden.');
    await say(c, 'De archiefkasten lopen ’s nachts. En gisteren gaf de verwarmingsketel antwoord op een vraag die ik niet had gesteld.');
    const i = await choose(['Ik moet erheen. Mag ik de sleutel?', 'Wat is het Gewelf eigenlijk?']);
    if (i === 1) {
      await say(c, 'Het Gewelf is ouder dan het stadhuis. De eerste archivarissen hebben er een soort raamwerk in de muren gehakt.');
      await say(c, 'Vragen die je moet stellen voordat je ergens ja tegen zegt. Mijn opa zei altijd: wie daar zonder vragen naar beneden gaat, komt er zonder antwoorden weer uit.');
    }
    await say(c, 'Goed dan. Hier is de sleutel van de kelderdeur. Aan het eind van de gang.');
    giveItem('key:kelder');
    await say(c, 'En neem deze stroopwafel mee. Onderzoek doe je niet op een lege maag.');
    giveItem('snack:joop');
    await say(c, 'O, en als je beneden ooit mijn oude sleutelbos vindt: die ben ik in ’98 kwijtgeraakt. Er hangt een sleutel aan van de oude archiefkamer.');
    startQuest('sleutelbos');
    setStage('main', 2);
    return;
  }
  if (G.items.sleutelbos && stage('sleutelbos') === 1 && once('joop_bos')) {
    await say(c, 'Is dat… mijn sleutelbos? Uit ’98? Waar heb je die gevonden?');
    await say(c, 'Houd hem maar. De oude archiefkamer is in Diepte 1, achter het klachtenarchief. Ik durf er toch niet meer heen.');
    return;
  }
  await say(c, ['Pas op beneden. En doe de deuren achter je… nee, laat maar open. Dan kun je terug.', 'Als je verdwaalt: volg de koffieautomaten. Die vinden altijd een weg naar een stopcontact.', 'Mijn opa zei: elke deur heeft een sleutel, maar niet elke vraag heeft een antwoord.'][G.stats.steps % 3]);
};

// ---- Ilse at the counter ----
ON.talk.ilse = () => async c => {
  if (once('ilse_f0')) {
    await say(c, 'Jij bent de nieuwe! Welkom. Sorry dat ik niet opsta, ik heb nog… even kijken… zevenenveertig mensen in de wacht.');
    await say(c, 'Weet je wat het gekke is? Een derde belt over dezelfde brief. Die over de afvalpas. Niemand snapt hem.');
  }
  const i = await choose(['Waarom herschrijven jullie die brief niet?', 'Wat vind jij van het Orakel?', 'Succes met de wachtrij!']);
  if (i === 0) {
    await say(c, 'Goeie vraag. De brief is van Communicatie, de pas is van Afval, en de klachten komen bij ons.');
    await say(c, 'Iedereen denkt dat een ander hem moet aanpassen. Dus blijft hij zoals hij is. Al drie jaar.');
  } else if (i === 1) {
    await say(c, 'Als het echt helpt, graag. Ik ben niet tegen hulp. Ik ben tegen hulp die niet helpt.');
    await say(c, 'Het Orakel zei gisteren tegen een meneer dat zijn hond een paspoort nodig heeft. Hij heeft geen hond.');
  } else await say(c, 'Dank je. Nummer 214, alstublieft!');
};

// ---- Mevrouw Bakker ----
ON.talk.bakker = () => async c => {
  if (once('bakker_f0')) {
    await say(c, 'Ik bel al drie keer over mijn parkeervergunning. Als u een computer neerzet, wie neemt er dan nog op?');
    await say(c, 'En kijk eens wat ik gisteren kreeg. ‘Uw parkeervergunning is geldig tot het jaar 3000 en is verlopen.’ Allebei!');
    await say(c, 'Ondertekend door ‘het Orakel’. Lief kind, ik ben negenenzeventig. Ik heb geen tijd voor het jaar drieduizend.');
    const i = await choose(['Ik ga uitzoeken wat er aan de hand is.', 'Heeft u het al via de website geprobeerd?']);
    if (i === 0) await say(c, 'Dat zeggen ze allemaal. Maar u kijkt me tenminste aan. Dat is al wat.');
    else { await say(c, 'De website. Ja. Daar vroeg een vriendelijk venstertje of ik een robot was.'); await say(c, 'Ik weet het eerlijk gezegd niet eens zeker meer.'); }
    return;
  }
  await say(c, ['Ik wacht hier wel. Ik heb een boterham bij me, en een paraplu. Ik ben op alles voorbereid.', 'Als u beneden een balie vindt waar een mens zit, laat het me weten.', 'Mijn buurvrouw zegt dat dat Orakel alles weet. Mijn buurvrouw zegt ook dat de maan van kaas is.'][G.stats.steps % 3]);
};

// ---- the waiting room ----
ON.talk.burger1 = () => async c => { await say(c, ['Ik ben nummer 388. Ze zijn bij 214. Ik heb brood meegenomen. En een tweede brood.', 'Mijn zoon zegt dat er een computer komt die alle vragen beantwoordt. Dan stel ik hem eerst de vraag waarom ik hier al twee uur zit.'][G.stats.steps % 2]); };
ON.talk.burger2 = () => async c => { await say(c, ['Ik kom alleen voor een stempel. Al drie weken. Het is een heel klein stempeltje.', 'Op de website staat dat ik ‘online een afspraak kan maken voor het maken van een afspraak’. Dat heb ik gedaan. Nu sta ik hier.'][G.stats.steps % 2]); };
ON.talk.burger3 = () => async c => {
  await say(c, 'Het Orakel zei dat mijn hond een paspoort nodig heeft. Ik heb geen hond.');
  await say(c, 'Toen ik dat zei, antwoordde het: ‘Dan heeft uw hond er twee nodig.’ Ik overweeg nu een hond te nemen, gewoon om het uit te zoeken.');
};
ON.use.ticket = () => { G.flags.tickets = (G.flags.tickets || 388) + 1; UI.toast(`Nummer ${G.flags.tickets}`, 'Huidige beurt: 214. Geschatte wachttijd: ja.'); SFX.play('pick'); };

// ---- Glans and the Snelle Lift ----
ON.talk.glans = () => async c => {
  const first = once('glans_f0');
  if (first) {
    await say(c, 'Ah! De nieuwe adviseur! Glans, PraatPal. Accountmanager, visionair, en deze week uw allerbeste vriend.');
    await say(c, 'Het Orakel beantwoordt álle vragen van uw inwoners. Het draait al bij tientallen gemeenten.');
    await say(c, 'Waarom zou u door die stoffige kelder sjokken? Mijn Snelle Lift brengt u rechtstreeks naar het Orakel. Het contract ligt klaar. U hoeft alleen nog te tekenen.');
  } else await say(c, G.stats.shortcut ? 'U bent terug! Zullen we het nog eens proberen? Deze keer met korting!' : 'Nog steeds aan het onderzoeken? Mijn lift staat er nog, hoor. Het aanbod geldt tot vrijdag.');
  const i = await choose([{t: 'Ik neem de Snelle Lift. Waar moet ik tekenen?'}, {t: 'Ik wil het eerst zelf onderzoeken.'}, {t: 'Wat kost het eigenlijk?', if: !G.cards.includes('1')}]);
  if (i === 0) return shortcut(c);
  if (i === 1) { await say(c, 'Onderzoek! Prachtig. Kost alleen tijd, hè. En tijd is geld. En geld is… nou ja, u snapt het.'); return; }
  await say(c, 'Kosten? Ach. Het eerste jaar is het bijna gratis. Daarna hangt het af van het aantal vragen.');
  await say(c, 'En van het aantal antwoorden. En van de stand van de maan. Hier, mijn kaartje.');
  giveItem('card:1');
};
ON.use.glanslift = () => scene(async () => { await say('nar', 'Gouden deuren. Een bordje: ‘DE SNELLE LIFT · rechtstreeks naar het Orakel · tekenen bij Glans’.'); });

export async function shortcut(c) {
  const sure = await choose(['Ja. Teken.', 'Wacht. Toch maar niet.']);
  if (sure === 1) { await say(c, 'Zoals u wilt. Mijn pen ligt klaar.'); return; }
  G.pos = {x: P.x, z: P.z, yaw: P.yaw};
  const snap = JSON.stringify(G);
  G.stats.shortcut++;
  await say(c, 'Uitstekend! U zult er geen spijt van krijgen. Waarschijnlijk. Ik stuur de factuur alvast naar de wethouder.');
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
      saveGame();
    }});
  await UI.fade(false, 0.6);
}
