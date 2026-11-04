// Het oefenlokaal: a small, bright practice room in the basement of the town hall, where Joop and Pip
// teach the controls (content/story/tutorial.js). It is not a depth of the Gewelf: you only come here
// to practise, before your first day starts or from the pause menu, and nothing you do here counts.
//
//   ontvangst (look, walk) -> de rode loper (run) -> de Kloof van Formulier B (dash)
//   -> de koffiehoek van Joop (talk, read, pick up, push a crate) -> het hek -> de oefenzaal
//   (camera, journal, map, the three tools on the oefenpoppen, reveal, ability, hint, a mock decision)
//   -> het nisje behind the fake wall.
import {MapBuilder} from '../mapkit.js';

// Where the steps of the practice point at (tile coordinates); the unit test checks every one is reachable.
export const SPOTS = {
  start: [5, 20], walk: [5, 16], run: [5, 6], gap: [8, 3], dash: [9, 3],
  joop: [14, 2], sign: [12, 1], snack: [11, 5], crate: [15, 8], plate: [15, 10], gate: [19, 4],
  dummies: [[23, 3], [25, 3], [27, 3]], tools: [25, 5], wall: [25, 10], nis: [25, 12],
  // Joop walks into the oefenzaal once the gate is open: one straight line per leg
  joopPath: [[18, 4], [21, 4], [21, 7]],
};
// the zones beyond the chasm: you made it across
export const BEYOND = ['koffiehoek', 'oefenzaal', 'nis'];

const m = new MapBuilder(31, 23);
// ontvangst: you arrive facing north; behind you hangs a poster for whoever looks around
m.stamp(2, 15, `
p.,,,..p
..,,,..k
..,,,..k
M.......
......f.
...@....
p..M...p`, {'@': [{id: 'start', dir: 'n'}], M: [
  {id: 'oefen_welkom', kind: 'board', dir: 'e', title: 'Welkom in het oefenlokaal', text: 'OEFENLOKAAL · sinds 1987\n\nHier oefenen nieuwe collega’s alles wat ze in het Gewelf nodig hebben.\n\nOefenen mag. Fouten maken ook. Vooral dat.\n\nVragen? Joop zit achterin, bij de koffie.'},
  {id: 'oefen_achter', kind: 'poster', dir: 'n', title: 'Kijk eens achter je', text: 'GOED ZO!\n\nJe kijkt achter je. Dat is precies wat een goede adviseur doet: ook even kijken wat er achter een besluit zit.\n\n(Deze poster hangt hier speciaal voor jou. En voor iedereen die rondkijkt.)'}]});
// de rode loper: three tiles wide, long enough to run
m.rect(4, 5, 6, 14, ',');
// de Kloof van Formulier B: a narrow gap you dash over
m.rect(4, 2, 9, 4);
m.rect(8, 2, 8, 4, '_');
m.ent(6, 2, 'M', {id: 'oefen_kloofbord', kind: 'plaque', dir: 's', title: 'Let op', text: 'LET OP: GAT IN DE REGELS\n\nDit gat ontstond in 1994, toen formulier B werd afgeschaft maar formulier C nog niet bestond.\n\nOversteken: neem een aanloop en duik eroverheen (Spatie). Wie valt, wordt opgevangen. Dat is beleid.'});
// de koffiehoek van Joop: Joop, the house rules, a stroopwafel and a crate that wants to go somewhere
m.stamp(9, 1, `
p..M..e.kp
.....N....
..........
.d........
..I.......
p.........
p........p`, {N: [{id: 'oefenjoop', dir: 's'}],
  M: [{id: 'oefen_regels', kind: 'board', dir: 's', title: 'Huisregels van het oefenlokaal', text: 'HUISREGELS VAN HET OEFENLOKAAL\n\n1. Oefenen mag. Fouten maken ook.\n\n2. De oefenpoppen hebben geen gevoelens. Ze doen alsof, voor de sfeer.\n\n3. Laat het lokaal achter zoals je het aantrof, met één stroopwafel minder.\n\n4. Wie zich verveelt, mag de uitleg overslaan. Joop is dan heel even beledigd.\n\nFacilitaire Zaken, 1987'}],
  I: [{id: 'snack:oefen', manual: true, pedestal: true, label: 'Pak de stroopwafel van de maand', color: 0xd89a50}]});
// the crate lane: push the crate south onto the green plate, and the gate to the oefenzaal opens
m.put(15, 8, 'B', {id: 'oefen_krat', kind: 'open'});
m.put(15, 9, '.');
m.put(15, 10, 'P', {id: 'oefen_plaat', accept: 'open', flag: 'oefen_plaat', latch: true});
m.put(19, 4, 'G', {id: 'oefen_hek', flag: 'oefen_plaat', sign: true, signColor: 0x7fe0a4, label: 'Het hek naar de oefenzaal',
  msg: 'Het hek zit dicht. In het gangetje ligt een groene drukplaat. Misschien helpt het als daar iets zwaars op staat?'});
// de oefenzaal: three oefenpoppen to practise the tools on, and one wall that is a little too shiny
m.stamp(20, 1, `
p..y...ykp
..........
...E.E.E..
..........
..........
..........
..........
f........f
p........p`, {E: [{kind: 'oefenpop', group: 'oefen'}, {kind: 'oefenpop', group: 'oefen'}, {kind: 'oefenpop', group: 'oefen'}]});
m.put(25, 10, 'S', {id: 'oefen_nepmuur', color: 0xffd36b});
// het nisje behind the fake wall
m.stamp(23, 11, `
l...l
.....
p.M.p`, {M: [{id: 'oefen_nis', kind: 'plaque', dir: 'n', title: 'Gefeliciteerd', text: 'GEFELICITEERD\n\nJe hebt een nepmuur doorzien. In het Gewelf zitten er meer.\n\nIn vergaderingen ook, maar daar helpt de Toetslamp minder.'}]});

export default {
  id: 'oefen', depth: 'Kelder van het stadhuis', name: 'Het oefenlokaal', music: 'f0',
  fog: 0x1e1810, fogDensity: 0.014, sky: 0xfff2dc, ground: 0x6a5a48, hemi: 0.8,
  defaults: {wall: 'plaster', floor: 'tiles', ceil: 'beam', ceilH: 3.4, torch: 0xffe2b0, torchEvery: 3, torchI: 1.1, fill: [0xfff0d8, 0.5],
    tint: {wall: 0xf0e6d2, floor: 0xe0d8c8, ceil: 0xd8bc98, carpet: 0xb04a40}},
  zones: [
    {id: 'ontvangst', name: 'Het oefenlokaal', banner: false, r: [2, 15, 9, 21], floor: 'plank', tint: {floor: 0xc09468}, glow: [[5, 18, 3.0, 0xfff4e0, 0.8, 9]]},
    {id: 'loper', name: 'De rode loper', banner: false, r: [4, 5, 6, 14], wall: 'panel', tint: {wall: 0xd8b890, carpet: 0xb83a30}},
    {id: 'kloof', name: 'De Kloof van Formulier B', sub: 'Een gat in de regels', r: [4, 2, 8, 4], wall: 'brick', floor: 'flag', tint: {wall: 0xc9a07a, floor: 0xa89a88}},
    {id: 'koffiehoek', name: 'De koffiehoek van Joop', sub: 'Koffie verkeerd, sfeer goed', r: [9, 1, 18, 10], floor: 'plank', tint: {floor: 0xb08458, wall: 0xe8d8b8}, fill: [0xfff0d8, 0.45], glow: [[14, 4, 3.0, 0xffe2b0, 0.9, 9]]},
    {id: 'oefenzaal', name: 'De oefenzaal', sub: 'Oefenpoppen mogen geraakt worden. Collega’s niet.', r: [19, 1, 29, 10], wall: 'panel', ceilH: 4.2, tint: {wall: 0xd8c8a8, floor: 0xc8c0b0}, fill: [0xfff4e0, 0.45], glow: [[25, 5, 3.6, 0xfff0d8, 1.0, 12]]},
    {id: 'nis', name: 'Het nisje', sub: 'Hier zat een muur. Zat.', r: [23, 11, 27, 13], wall: 'brick', floor: 'carpet', ceilH: 3.0, torchEvery: 0, tint: {wall: 0xc8a070, floor: 0x9a6a50}, glow: [[25, 12, 2.4, 0xffd36b, 0.9, 6]]},
  ],
  ...m.build(),
};
