// Diepte 0 · Het stadhuis van Dalwijk: your desk, the public hall, the caretaker, the cellar door,
// and the rooms around them where the town hall keeps its secrets (see docs/inhoudsplan.md).
import {MapBuilder} from '../mapkit.js';

const m = new MapBuilder(40, 30);
// your office
m.stamp(2, 2, `
kkk..a..p
...dMd...
.........
..s.@...K
p........
........p`, {'@': [{id: 'start', dir: 'n'}], M: [{id: 'letter', kind: 'letter', label: 'Lees de brief van de wethouder', dir: 's'}], K: [{id: 'k_kantoor', dir: 'w', name: 'Jouw werkplek'}]});
m.put(6, 8, 'D');
// the corridor
m.rect(2, 9, 33, 10);
// Reprografie: the printer that (almost) never works, and Dirk of ICT
m.stamp(12, 3, `
y.Q.y
.....
N....
.....
a...M`, {Q: [{id: 'printer', kind: 'printer', dir: 's'}], N: [{id: 'dirk', dir: 'e'}],
  M: [{id: 'repro_bord', kind: 'board', dir: 'w', title: 'Reprografie', text: 'REPROGRAFIE\n\nPrinten? Eerst je pasje.\nPasje kwijt? Eerst printen.\n\nBij storing: bel ICT.\nICT is bij een storing.'}]});
m.put(14, 8, 'D');
// Vergaderkamer De Horizon: the whiteboard knows where we are going
m.stamp(18, 2, `
p.Q..p
......
.sdds.
..M...
......
s....s`, {Q: [{id: 'whiteboard', kind: 'whiteboard', dir: 's', draw: 'horizon', give: 'bingo:stip', label: 'Lees het whiteboard', title: 'Het whiteboard',
  text: 'In groene stift, met hoofdletters: STIP OP DE HORIZON.\n\nDaaronder een lange blauwe lijn: de horizon. Op de lijn: een stip. Links komt de zon op, of gaat hij onder. Dat is niet afgesproken.\n\nIn rode stift, met een pijl naar de stip: ‘Is dit hem?’\n\nOnderaan, in een ander handschrift: ‘Actie: iedereen.’'}],
  M: [{id: 'agenda', kind: 'letter', dir: 's', label: 'Lees de agenda', title: 'Agenda · ‘Visie op de visie’', text: 'Overleg ‘Visie op de visie’ · iedere maandag, 9:00 tot het af is\n\n1. Opening\n2. Vaststellen van de agenda\n3. Mededelingen\n4. Rondvraag\n5. Rondvraag over de rondvraag\n6. Sluiting\n\nNotulen: volgen. (Sinds 2019.)'}]});
m.put(20, 8, 'D');
// the caretaker's room, with a narrow door without a sign
m.stamp(25, 2, `
a...b..cb
..d......
....N....
.........
.......cc
a........`, {N: [{id: 'joop', dir: 's'}]});
m.put(29, 8, 'D');
m.put(34, 4, 'D', {id: 'magazijndeur', lock: 'magazijn', lockColor: 0xc8a050, label: 'Een smalle deur zonder bordje', msg: 'Op slot. Op de deur staat in potlood: ‘F.Z. 1974’. Joop weet vast meer. Joop weet altijd meer.'});
// the storeroom of Facilitaire Zaken, since 1974
m.stamp(35, 2, `
Q.kk
...Q
.Q..
...Q
cM.b`, {Q: [{id: 'opafoto', kind: 'portret', dir: 's', face: 'opa', title: 'Een foto aan de muur', text: 'Een vergeelde foto in een houten lijstje. Een man met een enorme snor en een platte pet staat trots naast een trap die de diepte in gaat.\n\nOp de achterkant, in potlood: ‘Opa Joop, 1948. De tweede trap is af. Wie hem afdaalt: vraag eerst waarom.’'},
  {id: 'nietmachine', kind: 'vondst', give: 'trinket:nietmachine'}, {id: 'magazijn', kind: 'geheim', secret: 'magazijn', r: 1.7}, {id: 'stempeltje', kind: 'vondst', give: 'stempeltje', shape: 'stamp'}],
  M: [{id: 'gevonden', kind: 'board', dir: 'n', title: 'Gevonden voorwerpen, 1974 tot heden', text: 'GEVONDEN VOORWERPEN · 1974 tot heden\n\n38 handschoenen (allemaal links)\n1 paraplu (niet van mevrouw Bakker, zegt mevrouw Bakker)\n400 balpennen van de gemeente, nooit gebruikt\n1 rubberen eend (?)\n1 doos ‘Diversen’, met daarin een doos ‘Overig’\n1 nietmachine, goud (NIET VAN JOU)'}]});
// the cellar door and the stair down
m.put(34, 9, 'D', {lock: 'kelder', label: 'De kelderdeur', msg: 'De kelderdeur zit op slot. Joop, de conciërge, heeft de sleutel.'});
m.stamp(35, 8, `
.@.
..>
...`, {'@': [{id: 'from_f1', dir: 'w'}], '>': [{id: 'down_f1', to: 'f1', at: 'from_f0', label: 'Daal af naar het Gewelf', need: 'q:main>=2'}]});
// Communicatie: where the afvalpasbrief was born
m.put(6, 11, 'D');
m.stamp(2, 12, `
k.p...M.k
.........
.d...N.d.
.s.....s.
.M.......
p.......p`, {N: [{id: 'ingrid', dir: 'n'}],
  M: [{id: 'b1poster', kind: 'poster', dir: 's', title: 'Schrijf op B1-niveau!', text: 'SCHRIJF OP B1-NIVEAU!\n\nDe gemeente Dalwijk hanteert ten behoeve van de leesbaarheid van haar communicatie-uitingen het taalniveau B1, teneinde de toegankelijkheid voor alle doelgroepen te waarborgen.\n\n(Deze poster is geschreven op C2-niveau.)'},
    {id: 'schrijfwijzer', kind: 'book', dir: 's', title: 'De Schrijfwijzer van Dalwijk', text: 'De Schrijfwijzer van Dalwijk, editie 2009. 212 pagina’s.\n\nPagina 1: ‘Schrijf kort.’\n\nPagina 47: ‘Laat inwoners meelezen.’ Iemand heeft er met potlood een uitroepteken bij gezet. En een tweede.'}]});
// De kantine: staff only, and a fridge with a history
m.stamp(2, 19, `
QQ.K..M.p
.........
..ds.sd..
.........
p...d...p`, {Q: [{id: 'koelkast', kind: 'fridge', dir: 's', title: 'De koelkast van de kantine', text: 'Op de koelkast hangt een geel briefje: ‘WIE HEEFT MIJN YOGHURT OPGEGETEN? Hij was gelabeld!! M.’\n\nDaaronder, in een ander handschrift: ‘Het Orakel zegt dat u geen yoghurt heeft.’\n\nDaaronder, weer in een ander handschrift: ‘Dan heeft mijn yoghurt er twee nodig.’\n\nIn de koelkast staan zeven gelabelde yoghurts. Alle zeven van M.', secret: 'yoghurt'},
  {id: 'snoepautomaat', kind: 'snoep', dir: 's'}],
  K: [{id: 'k_kantine', dir: 's', name: 'De kantine'}],
  M: [{id: 'prikbord', kind: 'board', dir: 's', title: 'Het prikbord van de kantine', text: 'PRIKBORD\n\nTe koop: bureaustoel. Nauwelijks gebruikt (thuiswerker).\n\nGevonden: één oortje, links. Wie mist hem?\n\nFoto: de printer van Reprografie, 14 maart 2016, toen hij het deed. (Ingelijst.)\n\nDe cursus ‘Omgaan met verandering’ gaat niet door, wegens omstandigheden.\n\nWIE HEEFT DE NIETMACHINE VAN FACILITAIRE ZAKEN? HIJ IS GOUD. HIJ IS NIET VAN JOU.'}]});
m.put(11, 21, 'D', {label: 'De kantine'});
// the public hall
m.rect(12, 12, 34, 23);
m.rect(21, 11, 23, 11);
m.stamp(12, 12, `
p......Q....Q........p
.,,,,,,,,,,,,,,,,,,,,..
?`, {Q: [{id: 'ticket', kind: 'ticket', dir: 's'}, {id: 'brievenbus', kind: 'brievenbus', dir: 's', secret: 'wethouderspost', title: 'De brievenbus van de wethouder',
  text: 'Een rode brievenbus met een sticker: ‘Wethouder Hendriks · GRAAG OP PAPIER’. Hij puilt uit.\n\nBovenop ligt een brief van mevrouw Bakker. Drie kantjes, met de hand. ‘Geachte wethouder, ik schrijf u omdat bellen niet helpt…’\n\nDaaronder een tekening van Sem (7): een glijbaan van de raadzaal naar de kantine. ‘Dan gaat vergaderen sneller.’\n\nHelemaal onderin: een glimmende envelop van PraatPal. ‘Uw persoonlijke uitnodiging voor de Snelle Lift!’ Hij is niet opengemaakt.'}]});
m.rect(21, 13, 23, 23, ',');
m.stamp(12, 14, `
Q
.
.N
.
M`, {Q: [{id: 'glanslift', kind: 'glanslift', dir: 'e'}], N: [{id: 'glans', dir: 'e'}], M: [{id: 'poster', kind: 'poster', dir: 'e', title: 'PraatPal Orakel™', text: 'BINNENKORT IN DALWIJK: HET ORAKEL\n\nHet antwoord op elke vraag.*\n\nDraait al bij tientallen gemeenten.**\n\n* Vragen niet inbegrepen.\n** Twee. Maar die waren heel tevreden in de demo.'}]});
for (const z of [17, 20]) { for (let x = 15; x <= 19; x += 2) m.put(x, z, 'f'); for (let x = 25; x <= 29; x += 2) m.put(x, z, 'f'); }
m.ent(31, 15, 'R', {kind: 'counter', dir: 'w'}); m.ent(31, 16, 'R', {kind: 'counter', dir: 'w'}); m.ent(31, 17, 'R', {kind: 'counter', dir: 'w'});
m.ent(32, 16, 'N', {id: 'ilse', dir: 'w'});
m.ent(34, 13, 'M', {id: 'wachttijd', kind: 'plaque', dir: 'w', title: 'Wachttijd', text: 'Huidige wachttijd voor een antwoord: 9 werkdagen.\n\nWij danken u voor uw geduld. Uw geduld wordt zeer gewaardeerd. Uw geduld is belangrijk voor ons.'});
m.ent(20, 19, 'N', {id: 'bakker', dir: 'e'});
m.ent(16, 21, 'N', {id: 'burger1', dir: 'n', still: true, if: '!kok_weg'});
m.ent(27, 18, 'N', {id: 'burger2', dir: 'w'});
m.ent(26, 21, 'N', {id: 'burger3', dir: 'n'});
m.put(12, 23, 'p'); m.put(34, 23, 'p'); m.put(34, 12, 'p');
// the gallery of mayors on the south wall of the hall: two people and, apparently, a duck
m.ent(14, 23, 'Q', {id: 'portret1', kind: 'portret', dir: 'n', face: 'm1', title: 'Burgemeester, 1952 tot 1964', text: 'Een strenge heer met een grijze snor en een ambtsketen. Op het bordje: ‘Burgemeester van Dalwijk, 1952 tot 1964. Opende de eerste publiekshal. Sloot hem om vijf uur.’'});
m.ent(16, 23, 'Q', {id: 'portret2', kind: 'portret', dir: 'n', face: 'v1', title: 'Burgemeester, 1964 tot 1979', text: 'Een vrouw met een hoge knot en een vriendelijke glimlach. Op het bordje: ‘Burgemeester van Dalwijk, 1964 tot 1979. Liet als eerste de telefoon aannemen door een mens. Dat mens was zijzelf.’'});
m.ent(18, 23, 'Q', {id: 'portret3', kind: 'portret', dir: 'n', face: 'eend', title: 'Burgemeester, 1979 (?)', text: 'Een eend. Met een ambtsketen. Hij kijkt je recht aan.\n\nOp het bordje: ‘Burgemeester van Dalwijk, 1979 (?). Over deze periode is weinig bekend. Het archief zegt alleen: kwak.’\n\nIemand heeft eronder geplakt: ‘Niet weghalen. Dit is cultureel erfgoed.’'});
// the entrance
m.rect(19, 24, 25, 27);
m.stamp(19, 24, `
p.....p
.......
.......
p.....p`);
m.put(22, 28, 'D', {flag: 'never', label: 'De voordeur', msg: 'Buiten regent het pijpenstelen. En je eerste werkdag is hier binnen.'});
m.ent(19, 25, 'M', {id: 'welkom', kind: 'board', dir: 'e', title: 'Welkom in het stadhuis', text: 'Gemeente Dalwijk · Publiekshal\n\nVergunningen · Afvalpassen · Parkeren · Toeslagen\n\nHeeft u een vraag? Neem een nummer. Wij helpen u zo snel als wij kunnen.'});
// once you know about hallucination #3, someone waits by the front door
m.ent(24, 26, 'N', {id: 'eend', dir: 'w', if: 'eend', secret: 'eend'});

export default {
  id: 'f0', depth: 'Diepte 0', name: 'Het stadhuis', music: 'f0', strictFinds: true,
  fog: 0x14100c, fogDensity: 0.02, sky: 0xfff0d8, ground: 0x4a3a2a, hemi: 0.55,
  defaults: {wall: 'plaster', floor: 'tiles', ceil: 'beam', ceilH: 3.6, torch: 0xffe2b0, torchEvery: 4, torchI: 0.9, fill: [0xfff0d8, 0.3],
    tint: {wall: 0xe8dcc8, floor: 0xd8d0c0, ceil: 0xb89878, carpet: 0x9a7a70}},
  zones: [
    {id: 'werkplek', name: 'Jouw werkplek', sub: 'Gemeente Dalwijk · maandag, 8:57', r: [2, 2, 10, 8], floor: 'plank', tint: {floor: 0xb08458}},
    {id: 'reprografie', name: 'Reprografie', sub: 'Printen op eigen risico', r: [12, 3, 16, 7], wall: 'panel', ceilH: 3.2, torchEvery: 0, tint: {wall: 0xb8b4a8, floor: 0xb0aca0}, glow: [[14, 5, 3.0, 0xf0f4ff, 0.7, 7]]},
    {id: 'horizon', name: 'Vergaderkamer De Horizon', sub: 'Bezet · overleg ‘Visie op de visie’', r: [18, 2, 23, 7], wall: 'panel', floor: 'carpet', ceilH: 3.4, torchEvery: 0, tint: {wall: 0xc8b490, floor: 0x6a7a8a}, glow: [[20, 4, 3.2, 0xfff0d8, 0.8, 8]]},
    {id: 'gang', name: 'De ambtenarengang', banner: false, r: [2, 9, 37, 11], wall: 'panel', tint: {wall: 0xc8a070}, ceilH: 3.4},
    {id: 'concierge', name: 'De conciërgekamer', r: [25, 2, 33, 8], wall: 'brick', floor: 'flag', tint: {wall: 0xc9a07a, floor: 0xa89a88}},
    {id: 'magazijn', name: 'Het magazijn', sub: 'Facilitaire Zaken · sinds 1974', r: [35, 2, 38, 6], wall: 'brick', floor: 'plank', ceilH: 3.0, torchEvery: 0, tint: {wall: 0xa08068, floor: 0x8a6a48, ceil: 0x7a5a40}, fill: [0x2a2010, 0.03], glow: [[36, 4, 2.6, 0xffc870, 0.75, 6]]},
    {id: 'communicatie', name: 'Communicatie', sub: 'Wij maken het begrijpelijk', r: [2, 12, 10, 17], wall: 'panel', ceilH: 3.4, tint: {wall: 0xd8c8a8, floor: 0xc8c0b0}},
    {id: 'kantine', name: 'De kantine', sub: 'Alleen voor personeel', r: [2, 19, 10, 23], ceilH: 3.4, tint: {wall: 0xe8d8b8, floor: 0xb8b0a0}, fill: [0xfff0d8, 0.36]},
    {id: 'hal', name: 'De publiekshal', sub: 'Wachttijd: 9 werkdagen', r: [12, 12, 34, 23], ceilH: 7, torchEvery: 3, fill: [0xfff4e0, 0.42]},
    {id: 'entree', name: 'De entree', banner: false, r: [19, 24, 25, 28], ceilH: 5},
    {id: 'kelder', name: 'De kelderdeur', r: [34, 8, 37, 10], wall: 'brick', floor: 'flag', torch: 0xff9a5a, tint: {wall: 0xa88a6a, floor: 0x9a8a78}, fill: [0xff9a5a, 0.08]},
  ],
  ...m.build(),
};
