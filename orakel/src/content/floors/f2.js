// Diepte 2 · De Hal der Fundamenten: Governance, Cultuur & Adoptie, Kennis & Capaciteit, Infrastructuur & Data.
import {MapBuilder} from '../mapkit.js';
import {sortPieces, sortSlots} from '../puzzles.js';
import {CHAMBER} from '../framework.js';

const m = new MapBuilder(64, 62);

// ---------------------------------------------------------------- the great hall
m.stamp(22, 22, `
....................
.o................o.
...................K
.........Q..........
....................
....................
....................
..Q......Q.......Q..
....................
....................
M...................
QN..................
.........Q..........
....................
.o......M.........o.
....................`, {K: [{id: 'k_hal', dir: 'w', name: 'De Hal der Fundamenten'}],
  Q: [{id: 'slot_governance', kind: 'stoneslot', found: 'governance', label: 'Governance'}, {id: 'slot_capacity', kind: 'stoneslot', found: 'capacity', label: 'Kennis & Capaciteit'}, {id: 'biglift', kind: 'biglift'}, {id: 'slot_culture', kind: 'stoneslot', found: 'culture', label: 'Cultuur & Adoptie'}, {id: 'glanslift2', kind: 'glanslift', dir: 'e'}, {id: 'slot_infrastructure', kind: 'stoneslot', found: 'infrastructure', label: 'Infrastructuur & Data'}],
  M: [{id: 'card7', kind: 'plaque', dir: 'e', title: 'Glans was hier', text: 'Een gouden bordje, met plakband aan de muur: ‘PraatPal Snelle Lift · Nu ook op Diepte 2! · Vraag naar de mogelijkheden.’'}, {id: 'fundamenten', kind: 'stone', dir: 'n', title: 'De vier fundamenten', text: 'Wie bouwt zonder eigenaar, bouwt op niemand.\nWie bouwt zonder mensen, bouwt voor niemand.\nWie bouwt zonder kennis, bouwt op een ander.\nWie bouwt zonder te weten waar zijn data staat, bouwt op drijfzand.\n\nZet de vier stenen terug. Dan zakt de lift.'}],
  N: [{id: 'glans2', dir: 'e'}]});
m.ent(31, 33, 'E', {kind: 'king', group: 'boss_king', if: 'king_awake'});
// opa Joop leaned a stone against the north-west pillar
m.ent(24, 23, 'M', {id: 'opa2', kind: 'stone', dir: 'e', title: 'Een steen tegen de pilaar', secret: 'opa_d2',
  text: 'Tegen de pilaar staat een steen, keurig recht. Er is iets in gekrast, met een krul aan de J:\n\n‘J. 1948. Wie goed fundeert, hoeft zich niet te haasten. Opa.’'});
// arrival from Diepte 1, south-west of the hall
m.stamp(23, 39, `
..@..
.....
..<..`, {'@': [{id: 'from_f1', dir: 'n'}], '<': [{id: 'up_f1', to: 'f1', at: 'from_f2', label: 'Terug naar Diepte 1'}]});
m.put(25, 38, '.');
m.ent(27, 40, 'I', {id: 'snack:f2a'});
// arrival by lift from Diepte 3
m.ent(32, 30, '@', {id: 'from_f3', dir: 's'});

// ---------------------------------------------------------------- north: governance
m.rect(31, 18, 32, 21);
m.stamp(25, 13, `
y.f..f....f..y
..............
......E.......
.I..........I.
..f..f..f..f..`, {E: [{kind: 'buck', n: 3, group: 'f2_buck'}], I: [{id: 'halluc:4'}, {id: 'bron:governance:a'}]});
m.ent(27, 13, 'M', {id: 'doorverwijs', kind: 'board', dir: 's', title: 'De Wachtkamer van Doorverwijzing', text: 'Uw vraag wordt doorverwezen.\n\nUw doorverwijzing wordt doorverwezen naar de afdeling Doorverwijzingen.\n\nDe afdeling Doorverwijzingen is momenteel doorverwezen.'});
// Kim has been preparing the programme that prepares the project since 2019
m.ent(34, 13, 'N', {id: 'kim', dir: 's'});
// side niches with two stamps
m.rect(22, 14, 24, 15); m.rect(39, 14, 41, 15);
m.rect(31, 11, 32, 12);
const govPieces = sortPieces('governance', 'gov', 'stamp', [0x9fc3ff, 0xffd36b, 0x8fe0a0]);
const govSlots = sortSlots('governance', 'gov', 'chair', [0x9fc3ff, 0xffd36b, 0x8fe0a0]);
m.ent(22, 14, 'Q', govPieces[0]); m.ent(41, 15, 'Q', govPieces[1]);
m.stamp(22, 2, `
.I.......N.........I
....................
..o.............o...
....................
....Q.....Q.....Q...
....................
..o.............o...
.Q................Q.
....................`, {I: [{id: 'bron:governance:b'}, {id: 'card:5'}], N: [{id: 'griffel', dir: 's'}], Q: [govSlots[0], govSlots[1], govSlots[2], govPieces[2], govPieces[3]]});
// on the chairman's seat, which has been empty for years: an agenda without a single meeting
m.ent(33, 2, 'Q', {id: 'agenda', kind: 'vondst', give: 'trinket:agenda'});
m.ent(36, 2, 'M', {id: 'presentielijst', kind: 'board', dir: 's', title: 'Presentielijst',
  text: 'PRESENTIELIJST · Raad van Niemand\n\nAanwezig: niemand\nAfwezig met kennisgeving: iedereen\nVoorzitter: vacature (sinds 2011)\n\nBesluiten: geen\nActiepunten: zie vorige keer'});

// ---------------------------------------------------------------- east: culture & adoption
m.rect(42, 29, 45, 30);
m.stamp(46, 20, `
................
.N.F.......F.N..
................
..####....####..
..#..........#..
..#..........#..
................
.......d........
.......N........
................
I..............I
................
..#..........#..
..#..........#..
..####....####..
................
................
.N.F.......F.N..
....E.....E.....
................`, {N: [{id: 'ans', dir: 's'}, {id: 'joris', dir: 's'}, {id: 'vonk', dir: 's'}, {id: 'fatma', dir: 'n'}, {id: 'pieter', dir: 'n'}],
  F: [{id: 'vuur_ans', lit: false, color: 0x9fb0ff}, {id: 'vuur_joris', lit: false, color: 0x9fffd0}, {id: 'vuur_fatma', lit: false, color: 0xff9fd8}, {id: 'vuur_pieter', lit: false, color: 0xd8ff9f}],
  I: [{id: 'bron:culture:a'}, {id: 'bron:culture:b'}], E: [{kind: 'haste', n: 2, group: 'f2_cult'}, {kind: 'haste', group: 'f2_cult'}]});
m.ent(49, 24, 'Q', {id: 'draagvlakposter', kind: 'bingo', give: 'bingo:draagvlak', dir: 'e'});

// ---------------------------------------------------------------- west: knowledge & capacity
m.rect(18, 29, 21, 30);
m.stamp(8, 24, `
....d...e.
..........
...N....d.
..........
d.........
..........
....Q.....
..........
.d......e.
.N........
..........
....d.....`, {N: [{id: 'mallow', dir: 's'}, {id: 'henk', dir: 'e'}], Q: [{id: 'archief_lessenaar', kind: 'post', label: 'Het levende archief'}]});
m.put(7, 33, 'D', {id: 'vakantiedeur', flag: 'never', label: 'Uitgang · ‘Vakantie’', msg: 'Op de deur hangt een briefje: ‘Henk is vanaf morgen drie weken weg. Vragen? Henk.’'});
m.ent(8, 34, 'Q', {id: 'henksla', kind: 'drawer', dir: 'e', label: 'Bureau van Henk', secret: 'henks_la'});
m.rect(5, 33, 6, 33);
// the mailbox of a former colleague, behind a wall that is not a wall
m.put(12, 23, 'S'); m.stamp(9, 18, `
a....a
......
..I...
I....I
.....?`, {I: [{id: 'rol:0', manual: true, label: 'Pak de rol: ontwerpkeuzes'}, {id: 'bron:capacity:a'}, {id: 'halluc:5'}]});
m.rect(12, 22, 12, 22);
// a storeroom where Joop lost his keys in 1998
m.put(7, 26, 'S'); m.stamp(3, 25, `
cbc
.I.
c.b`, {I: [{id: 'sleutelbos', manual: true, label: 'Pak de oude sleutelbos'}]});
m.rect(6, 26, 6, 26);
// the supplier's chest
m.rect(9, 36, 12, 37); m.stamp(3, 36, `
c...c.
..C...
c...b.`, {C: [{items: ['rol:1'], need: 'q:main>=11'}]});
m.rect(7, 37, 8, 37);
// the half-filled change log, guarded by paper golems
m.rect(13, 36, 13, 37);
m.stamp(14, 36, `
yy.E..
......
..I..y
.y..I.`, {E: [{kind: 'golem', n: 2, group: 'f2_cap'}], I: [{id: 'rol:2', manual: true, label: 'Pak de rol: wijzigingslog'}, {id: 'bron:capacity:b'}]});

// ---------------------------------------------------------------- south: infrastructure & data
m.rect(31, 38, 32, 41);
const infra = CHAMBER.infrastructure.trial.items;
m.stamp(22, 42, `
LI.......N..........
....................
....................
.....B.B....B.B.....
....................
....................
...PP..........PP...
....................
.M...............M..`, {L: [{id: 'reset_crates', label: 'Zet de datakisten terug'}], I: [{id: 'bron:infrastructure:a'}], N: [{id: 'wolk', dir: 's'}],
  B: [1, 0, 3, 2].map(i => ({id: `kist${i}`, kind: infra[i].bin ? 'geheim' : 'open', label: infra[i].label.replace('Datakist: ', '')})),
  P: [{id: 'plaat_o1', flag: 'plaat_o1', accept: 'open'}, {id: 'plaat_o2', flag: 'plaat_o2', accept: 'open'}, {id: 'plaat_g1', flag: 'plaat_g1', accept: 'geheim'}, {id: 'plaat_g2', flag: 'plaat_g2', accept: 'geheim'}],
  M: [{kind: 'stone', dir: 'n', title: 'Publieke cloudpoort', text: 'PUBLIEKE CLOUDPOORT\n\nSnel, goedkoop, voor iedereen. Geschikt voor wat al openbaar is.'}, {kind: 'stone', dir: 'n', title: 'Eigen of soevereine kluis', text: 'EIGEN OF SOEVEREINE KLUIS\n\nVoor wat gevoelig is. Met afspraken over toegang, zeggenschap en vertrek.'}]});
m.put(37, 51, 'G', {id: 'kluishek', flag: 'trial:infrastructure', sign: true, signColor: 0xff8a70, label: 'De Kluis', msg: 'De kluis gaat pas open als elke datakist bij de juiste poort staat.'});
m.stamp(34, 52, `
........
...I....
........
.I....I.
........
........`, {I: [{id: 'tool:seal', manual: true, pedestal: true, label: 'Pak het Zegel', color: 0x7fe0a4}, {id: 'bron:infrastructure:b'}, {id: 'snack:f2b'}]});
m.put(27, 51, 'D', {id: 'lekdeur', flag: 'tool:seal', label: 'De Lekkende Kelder', lockColor: 0x7fe0a4, msg: 'Achter deze deur sijpelt iets. Met blote handen begin je daar niks. Eerst het Zegel uit de kluis.'});
m.stamp(22, 52, `
.~~~...~~~.
.~E~...~~~.
.~~~...~E~.
...........
.I....E..I.
.~~~...~~~.
.~~~...~~~.`, {E: [{kind: 'leak', group: 'f2_leak'}, {kind: 'leak', group: 'f2_leak'}, {kind: 'leak', n: 2, group: 'f2_leak'}], I: [{id: 'blauwdruk', manual: true, label: 'Pak de bouwtekening'}, {id: 'halluc:6'}]});
// something is floating in the leak water that is not data
m.ent(30, 57, 'Q', {id: 'badeend', kind: 'ding', shape: 'duck', color: 0xffd84a, stand: false, y: -0.08, on: '~', secret: 'badeend', title: 'Een badeend',
  text: 'Tussen twee datalekken dobbert een gele badeend. Hij draagt een ambtsketen.\n\nOp zijn buik staat, in watervaste stift: ‘Burgemeester (reserve)’.'});

export default {
  id: 'f2', depth: 'Diepte 2', name: 'De Hal der Fundamenten', music: 'f2', strictFinds: true,
  fog: 0x0a100c, fogDensity: 0.04, sky: 0x8aa890, ground: 0x1a2418, hemi: 0.2,
  defaults: {wall: 'ashlar', floor: 'flag', ceil: 'rough', ceilH: 4.5, torch: 0xc6e39a, torchEvery: 4, fill: [0x3a5a40, 0.04], moss: 0.5,
    tint: {wall: 0x9aae94, floor: 0x9a9c86, ceil: 0x515d4f, pillar: 0xa8b8a0}},
  zones: [
    {id: 'hal', name: 'De Hal der Fundamenten', sub: 'Diepte 2', r: [22, 22, 41, 41], ceilH: 10, torchEvery: 3, torchI: 1.4, fill: [0x7a9a80, 0.12]},
    {id: 'wachtkamer', name: 'De Wachtkamer van Doorverwijzing', sub: 'Governance', r: [22, 13, 41, 21], wall: 'panel', floor: 'tiles', ceilH: 4, torch: 0xffe2b0, fill: [0xffe2b0, 0.08], tint: {wall: 0xc8a070, floor: 0xb8b0a0}, moss: 0},
    {id: 'raadzaal', name: 'De Raadzaal van Niemand', sub: 'Governance', r: [22, 2, 41, 12], wall: 'panel', floor: 'tiles', ceilH: 7, torch: 0xffd8a0, torchEvery: 3, torchI: 1.3, fill: [0xffd8a0, 0.1], tint: {wall: 0xc89a68, floor: 0xc8b8a0, pillar: 0xd8c8a8}, moss: 0},
    {id: 'vonken', name: 'Het Huis van de Aarzelende Vonken', sub: 'Cultuur & Adoptie', r: [42, 20, 61, 39], wall: 'brick', floor: 'plank', ceil: 'beam', ceilH: 6, torchEvery: 0, fill: [0x4a3a5a, 0.03], tint: {wall: 0xb89a8a, floor: 0xa07850, ceil: 0x6a5040}, moss: 0,
      glow: [[53, 28, 2.2, 0xffb84a, 1.2, 10]]},
    {id: 'werkplaats', name: 'De Werkplaats van het Gedeelde Geheugen', sub: 'Kennis & Capaciteit', r: [2, 18, 21, 41], wall: 'brick', floor: 'plank', ceil: 'beam', ceilH: 5, torch: 0xffb070, tint: {wall: 0xc0a080, floor: 0xa07850, ceil: 0x6a5040}, moss: 0},
    {id: 'wolken', name: 'De Poort van de Verwisselbare Wolken', sub: 'Infrastructuur & Data', r: [22, 42, 41, 50], wall: 'metal', floor: 'grate', ceil: 'metal', ceilH: 6, torch: 0x9fd8ff, tint: {wall: 0x9aa8b8, floor: 0x8a96a4, ceil: 0x5a6070}, moss: 0},
    {id: 'kluis', name: 'De Kluis', sub: 'Beschermen waar het moet', r: [33, 51, 41, 58], wall: 'metal', floor: 'tiles', ceilH: 4, torch: 0x7fe0a4, tint: {wall: 0x7a8a80, floor: 0x9aa89a}, moss: 0},
    {id: 'lekkelder', name: 'De Lekkende Kelder', sub: 'Hier sijpelt data door de kieren', r: [22, 51, 32, 59], wall: 'brick', floor: 'flag', ceilH: 4, torch: 0x9fffc0, torchEvery: 3, tint: {wall: 0x86a08a, floor: 0x7e9282, ceil: 0x3e4e44, water: 0x5ac890}},
  ],
  ...m.build(),
};
