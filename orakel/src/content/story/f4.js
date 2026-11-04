// Diepte 4 · De Drempel, de Kern en de Zegelkamer.
import {ON, UI, SFX, P, chamberState} from '../../game/bus.js';
import {G, saveGame} from '../../game/state.js';
import {W, ent} from '../../game/world.js';
import {stage, setStage} from '../../game/quests.js';
import {say, choose, scene, wait} from '../../game/dialogue.js';
import {giveItem, GAME} from '../../game/game.js';
import {spawnEnemy, C} from '../../game/combat.js';
import {PL} from '../../game/player.js';
import {FX} from '../../engine/particles.js';
import {decideVerdict, verdictEnding} from '../../ui/verdict.js';
import {clearTendrils} from '../bosses.js';
import {CHAMBERS, STATE_LABEL, STORY, VERDICT} from '../framework.js';
import {TILE} from '../../core/util.js';

const once = k => { if (G.flags[k]) return false; G.flags[k] = true; return true; };
const STATE_COL = {strong: '#c8f0d0', open: '#ffe2a6', blind: '#b0a8a0'};

ON.floor.f4 = () => {
  if (stage('main') === 16) {
    setStage('main', 17, true);
    scene(async () => {
      await say('pip', 'De Drempel. Hoor je dat gezoem? Dat is het Orakel. We zijn dichtbij.');
      await say('pip', 'Hier is bijna niets wat het lijkt. Toets elke stap.');
      setStage('main', 17);
    });
  }
  // the dossier glows on the plaques of the seal chamber
  for (const c of CHAMBERS) { const p = ent(`plaat_${c.id}`); p?.refresh?.(`${c.title} · ${STATE_LABEL[chamberState(c.id)]}`, STATE_COL[chamberState(c.id)]); }
  const cocon = ent('cocon'); if (cocon) cocon.def.open = () => !!G.flags.glans_vrij;
  const ork = ent('orakel'); if (ork) { ork.def.calm = () => !!G.flags.fabulant_down; ork.def.talk = true; }
  for (let i = 0; i < 4; i++) { const d = ent(`draad${i}`); if (d) d.def.cut = !!G.flags[`draad${i}`] || !!G.flags.glans_vrij; }
  if (G.flags.fabulant_down) for (const s of W.ents) if (s.def?.kind === 'socket') s.sealed = true;
};

// ---- the voice of the Orakel on the threshold ----
const VOICE = [
  ['Welkom bij het Orakel. Uw vraag is belangrijk voor ons. Ook als u er geen heeft.', 'Een antwoord zonder vraag. Typisch.'],
  ['Volgens mijn bronnen is hier een brug. Loopt u maar door.', 'Hij heeft gelijk, om de verkeerde reden. Er ís een brug, maar hij weet het niet; hij gokt. Toets het eerst (R).'],
  ['U bevindt zich nu drieënveertig meter onder het stadhuis. Of drieduizend. Ik zeg het niet met zekerheid, maar wel met overtuiging.', 'Overtuiging is geen bewijs. Nog even, we zijn er bijna.'],
];
VOICE.forEach(([line, pip], i) => {
  ON.trigger[`t_drempel${i + 1}`] = () => scene(async () => { SFX.play('orakel'); await say('orakel', line); await say('pip', pip); });
});

// ---- Glans in his cocoon ----
ON.use.cocon = () => scene(async () => {
  if (once('cocon_met')) {
    await say('glans', 'Help! Hier! Het Orakel heeft mijn contract letterlijk genomen!');
    await say('glans', '‘Onbeperkte toegang tot alle gegevens’, stond erin. Ik dacht dat dat een verkooppraatje was!');
    await say('pip', 'Vier contractdraden. Hak ze door met het Zegel (3). Begrenzen, weet je nog?');
  } else await say('glans', 'De draden! Met het Zegel! Alstublieft!');
});
for (let i = 0; i < 4; i++) {
  ON.hit[`draad${i}`] = (o, tool) => {
    if (tool !== 'seal' || o.def.cut) return;
    o.def.cut = true; G.flags[`draad${i}`] = true;
    FX.burst(o.x, 0.8, o.z, 30, {color: [0xffd36b, 0xffffff], speed: 3, life: 0.7});
    SFX.play('sealHit');
    const left = [0, 1, 2, 3].filter(k => !G.flags[`draad${k}`]).length;
    if (left) UI.number(o.x, 2, o.z, `Nog ${left}`, '#ffd36b', true);
    else freeGlans();
  };
}
function freeGlans() {
  G.flags.glans_vrij = true;
  const c = ent('cocon'); if (c) FX.burst(c.x, 1.4, c.z, 80, {color: [0xffd36b, 0xfff1b8], speed: 5, life: 1.2});
  SFX.play('questDone');
  scene(async () => {
    await say('glans4', 'Vrij! Dank u. Dank u.');
    await say('glans4', 'Ik moet u iets bekennen. ‘Tientallen gemeenten’… Het waren er twee. En één daarvan was een testomgeving.');
    await say('glans4', 'Weet u wat ik vandaag heb geleerd? Een product zonder grenzen is geen product. Het is een probleem met een logo.');
    await say('glans4', 'Mijn nieuwe kaartje. Ik heb het net bedacht.');
    giveItem('card:8');
    saveGame();
  });
}
ON.talk.glans4 = () => async c => { await say(c, ['Ga maar. Ik kom zo. Ik moet even… mijn presentatie herschrijven.', 'Als u het Orakel ziet: zeg dat ik het niet zo bedoeld had. Of eigenlijk wel. Maar anders.'][G.stats.steps % 2]); };

// ---- the core: the Orakel and the Fabulant ----
ON.trigger.t_kern = () => {
  if (G.flags.fabulant_down || G.flags.fabulant_up) return;
  G.flags.fabulant_up = true;
  scene(async () => {
    await say('nar', 'In het midden van de Kern staat een gouden monoliet, zo hoog als het stadhuis. Op de voorkant: een gezicht van licht.');
    await say('orakel', 'Welkom. Ik ben het Orakel. Ik weet het antwoord op elke vraag.');
    await say('pip', 'Vraag hem maar iets.');
    const i = await choose(['Hoeveel inwoners wachten er op antwoord?', 'Waar haal je je antwoorden vandaan?', 'Wie is er verantwoordelijk als je je vergist?']);
    await say('orakel', ['Nul. Gisteren ook. Morgen zelfs min drie.', 'Uit mijn bronnen. Mijn bronnen zijn uitstekend. Ik heb ze zelf geschreven.', 'Ik vergis me niet. Daar ben ik heel zeker van. Zekerder dan ooit.'][i]);
    await say('orakel', 'Wacht. Er komt iemand die het nóg beter weet.');
    SFX.play('thunder'); PL.shake = 0.6;
    await say('nar', 'Uit de monoliet stijgt een gestalte op, in een mantel van gefluister, met een gouden masker vol zelfvertrouwen.');
    await say('fabulant', 'Ik ben de Fabulant. Ik ben wat er van een antwoord overblijft als niemand het controleert.');
    await say('fabulant', 'Ik weet het antwoord op elke vraag. Of iets wat erop lijkt.');
    await say('pip', 'Dit is het! Toets zijn bronnen (R en 1), weeg welke Fabulant echt is (2), en begrens wat hij mag (3). Wat je in het dossier stevig hebt, maakt hem zwakker.');
    setStage('main', 18);
    for (const s of W.ents) if (s.def?.kind === 'socket') { s.sealed = true; s.hits = 0; }
    spawnEnemy('fabulant', 29 * TILE + 1, 26 * TILE + 1, {group: 'boss_fab', aware: true});
  });
};
ON.cleared.boss_fab = () => {
  G.flags.fabulant_down = true;
  clearTendrils();
  for (const e of C.enemies) if (e.alive) { e.alive = false; e.dieT = 0; }
  setStage('main', 19);
  scene(async () => {
    await say('fabulant', 'Ik… wist het niet. Ik zei alleen wat het meest waarschijnlijk klonk.');
    await say('nar', 'Het masker valt. Er blijft niets over dan een handvol gouden snippers, die langzaam naar de vloer dwarrelen.');
    await say('orakel', 'De stilte is… prettig.');
    await say('orakel', 'Ik ben een taalmodel met een kennisbank. Ik kan helpen, als iemand me toetst, weegt en begrenst.');
    await say('orakel', 'Ik weet niet alles. Dat had ik eerder moeten zeggen.');
    await say('pip', 'Hoor je dat? Dat is het eerste eerlijke antwoord dat hij geeft.');
    await say('pip', 'Weet je, ik was ook ooit zo’n hulpje. Tweehonderd jaar lang. Ik heb me ook vergist. Een heel jaar lang heb ik de verkeerde kast aangewezen.');
    await say('pip', 'Daarom hebben de archivarissen het raamwerk gemaakt. Niet omdat hulpjes slecht zijn. Maar omdat iemand moet kijken, wegen en grenzen stellen.');
    await say('pip', 'Het hek van de Zegelkamer is open. Ze wachten op je.');
    saveGame();
  });
};
ON.use.orakel = () => scene(async () => {
  if (!G.flags.fabulant_down) { await say('orakel', 'Ik weet het antwoord op elke vraag.'); return; }
  const i = await choose(['Wat kun je wél?', 'Wat kun je níét?', 'Wat heb je nodig?']);
  await say('orakel', [
    'Veelgestelde vragen beantwoorden, met bronnen erbij. Teksten begrijpelijker maken. Mensen de weg wijzen naar wie wél kan beslissen.',
    'Beslissen over iemands aanvraag. Weten wat niet in mijn bronnen staat. Garanderen dat ik me niet vergis.',
    'Een eigenaar. Een testset. Een knop naar een mens. Iemand die me uitzet als het misgaat. En eerlijk gezegd: een betere brief over de afvalpas.',
  ][i]);
});

// ---- the seal chamber ----
ON.zone.zegelkamer = () => {
  if (once('zegel_intro')) scene(async () => {
    await say('wethouder', 'Daar ben je! Ik kon niet wachten tot vrijdag. Joop heeft me de weg gewezen. Hij kende er nog een die nergens op de kaart staat.');
    await say('wethouder', 'Kijk om je heen: dit is jullie dossier. Wat stevig staat, wat open is, wat je nooit hebt bekeken. Nou? Wat is je advies?');
    await say('pip', 'De zegeltafel in het midden. Daar bezegel je het besluit. Praat eerst gerust met iedereen.');
  });
};
ON.talk.wethouder = () => async c => {
  await say(c, ['Ik wilde iets innovatiefs laten zien. Maar een besluit dat ik kan uitleggen aan mevrouw Bakker is misschien wel het meest innovatieve wat we kunnen doen.', 'Wat je ook kiest: schrijf erbij waarom. Dan kan ik het verdedigen. In de raad, en bij de bakker.'][G.stats.steps % 2]);
};
ON.talk.ilse4 = () => async c => { await say(c, G.flags['heard:necessity:1'] ? 'Vergeet die brief niet. Een derde van de telefoontjes. Met een pen.' : 'Wist je dat een derde van de telefoontjes over één onduidelijke brief gaat? Die over de afvalpas.'); };
ON.talk.bakker4 = () => async c => { await say(c, STORY.resident.seal); };
ON.talk.joop4 = () => async c => { await say(c, G.flags['zone:f1:oudarchief'] ? 'Mijn oude archiefkamer is weer open. Ik ga er morgen stofzuigen. Na zesentwintig jaar.' : 'Mijn opa had gelijk. Wie hier met vragen naar beneden gaat, komt met antwoorden boven.'); };
ON.talk.glans5 = () => async c => { await say(c, 'Wat u ook kiest: als het een begrensde pilot wordt, bel me. Ik heb een nieuw kaartje.'); };

ON.use.sealtable = () => {
  if (!G.flags.fabulant_down) return;
  if (G.verdict) { reopenEnding(); return; }
  sealVerdict();
};
async function sealVerdict() {
  const v = await decideVerdict();
  setStage('main', 20);
  SFX.play('bossDie');
  await UI.fade(true, 1.0);
  verdictEnding(() => again());
  await UI.fade(false, 0.4);
}
async function again() {
  GAME.mode = 'play';
  document.getElementById('hud').hidden = false;
  await sealVerdict();
}
function reopenEnding() { verdictEnding(() => again()); }

// what else happened, depending on how you played
ON.epilogueExtra = () => {
  const out = [];
  if (G.flags['heard:necessity:1']) out.push('De afvalpasbrief is herschreven. Hij past nu op één A4, en de telefoon gaat een derde minder vaak.');
  if (stage('bakker') >= 2) out.push('Mevrouw Bakker belt nog één keer, om te zeggen dat ze niet meer hoeft te bellen.');
  if (G.flags.glans_vrij) out.push('Glans werkt nog bij PraatPal. Hij verkoopt nu begrensde pilots, met eigenaar, testset en stopcriteria. Ze verkopen slechter. Ze werken beter.');
  else out.push('Glans is uiteindelijk zelf uit zijn cocon gekomen. Hij praat er liever niet over.');
  if (stage('sleutelbos') >= 2) out.push('Joop heeft zijn oude archiefkamer weer in gebruik genomen. Hij zegt dat de lantaarn er beter brandt.');
  if (G.hallucs.length >= 12) out.push('Pips verzameling hallucinaties hangt ingelijst in de kantine. Als waarschuwing, en als grap.');
  out.push(`En Pip? Pip brandt op het bureau van de nieuwe adviseur. ‘Ik weet het niet zeker,’ zegt hij soms. ‘Vraag het even na.’`);
  return out.join('\n\n');
};
void P; void wait; void VERDICT;
