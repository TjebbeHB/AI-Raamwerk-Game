// Diepte 1 · De Kelder der Beloften: Probleem & Noodzaak.
import {MapBuilder} from '../mapkit.js';

const m = new MapBuilder(52, 46);

// the stair cellar, where you arrive from the town hall (dark)
m.stamp(21, 36, `
.......
..b...b
.......
r.....c
...@...
.......
...<...`, {'@': [{id: 'from_f0', dir: 'n'}], '<': [{id: 'up_f0', to: 'f0', at: 'from_f1', label: 'Terug naar het stadhuis'}]});
m.rect(23, 33, 24, 35);
// the lamp chamber
m.stamp(18, 26, `
a..k.....k..a
.............
..l.......l..
......I......
.............
y...........y
..r.......r..`, {I: [{id: 'tool:lamp', manual: true, pedestal: true, label: 'Pak de oude lantaarn', color: 0xffc870}]});
// the golden wall that is not a wall, and the corridor behind it
m.put(23, 25, 'S', {id: 'nepmuur', color: 0xffd36b}); m.put(24, 25, 'S', {color: 0xffd36b});
m.rect(23, 24, 24, 24);
m.ent(24, 27, 'T', {id: 't_nepmuur', r: 1.4, repeat: true});
// a secret alcove east of the lamp chamber
m.put(31, 27, 'S'); m.rect(32, 26, 32, 27); m.ent(32, 26, 'I', {id: 'halluc:1'});
// the door to the wine cellar
m.put(31, 30, 'D'); m.rect(32, 30, 33, 30);
m.stamp(34, 26, `
bbb.b.bb.bbbb
b...........b
..bb.....bb..
.....N.......
..bb.....bb..
b.....E.....b
....I.....I..
bbb.bbbbb.bbb`, {N: [{id: 'bakker1', dir: 'w'}], E: [{kind: 'demo', n: 3, group: 'f1_wijn'}], I: [{id: 'card:3'}, {id: 'bron:necessity:b'}]});
// the chamber of the question
m.stamp(15, 10, `
....................
..o....o....o....o..
....M...............
.........N..........
....................
..o..............o..
....................
.........R..........
....................
..o..............o..
....................
..o....o....o....o..
.I.................K
....................`, {M: [{id: 'tablet', kind: 'stone', dir: 's', title: 'In de muur gehakt', text: 'Vraag eerst: waarom?\n\nWie een oplossing zoekt bij een probleem dat niemand heeft beschreven, vindt altijd een oplossing. Zelden het probleem.\n\nAnno 1648, de archivarissen van Dalwijk'}],
  N: [{id: 'waarom', dir: 's'}], R: [{kind: 'fountain'}], I: [{id: 'snack:f1a'}], K: [{id: 'k_vraag', dir: 'w', name: 'De Kamer van de Vraag'}]});
m.rect(23, 23, 24, 23);
// east to the complaints archive (a maze of shelves)
m.rect(35, 16, 36, 16);
m.stamp(37, 10, `
............
.####.####.I
.#........#.
.#.####.E.#.
...#..#.....
##.#..#.####
.N.........#
####.##.##.#
....y..y....
.##.....E.#.
.#y.####..#.
.I........#I
............`, {I: [{id: 'brief:afvalpas', manual: true, label: 'Pak de afvalpasbrief'}, {id: 'bron:necessity:a'}, {id: 'halluc:2'}],
  E: [{kind: 'halluc', n: 2, group: 'f1_arch'}, {kind: 'golem', group: 'f1_golem'}], N: [{id: 'ilse1', dir: 'e'}]});
// the old archive room, locked since 1998
m.put(42, 9, 'D', {id: 'archiefdeur', lock: 'archief', label: 'De oude archiefkamer', lockColor: 0x9fc3ff, msg: 'Een oude deur met een roestig slot. Op een bordje: ‘Archief 1897–1998’. Joop had hier ooit een sleutel van.'});
m.stamp(38, 3, `
k..k..k..k
..........
....I.....
.C......M.
..........
a...I....a`, {I: [{id: 'kristal:1'}, {id: 'snack:f1b'}], C: [{items: ['halluc:12', 'card:4']}], M: [{id: 'archieflog', kind: 'book', title: 'Het archiefboek, 1998', text: 'Laatste notitie, 14 maart 1998:\n\nVandaag een computer aangesloten die ‘alle vragen van het archief kan beantwoorden’. Hij beantwoordt ze inderdaad allemaal. Dat is het probleem.\n\nWe hebben hem uitgezet en de lantaarn weer aangestoken. De lantaarn zegt tenminste wanneer hij het niet weet.\n\nJ. (conciërge)'}]});
// west: the corridor of promises
m.rect(13, 16, 14, 16);
m.stamp(2, 12, `
M........K.
...E.......
.......E...
...........
.....?.....
....?N?....
.....?.....
..........M
M........E.
.I.........
......M....`, {M: [{kind: 'poster', dir: 'e', title: 'PraatPal', text: 'BINNEN 6 WEKEN LIVE!\n\nGARANTIE*\n\n*Op de garantie zit garantie, tot de garantie verloopt.'}, {kind: 'poster', dir: 'w', title: 'PraatPal', text: '100% NAUWKEURIG*\n\n*In de demo.'}, {kind: 'poster', dir: 'e', title: 'PraatPal', text: 'ALTIJD SNELLER DAN UW TEAM!\n\n(Uw team is uitgenodigd voor een gratis webinar over sneller worden.)'}, {kind: 'poster', dir: 'n', title: 'PraatPal', text: 'TEKEN HIER.\n\nEN KLAAR.'}],
  K: [{id: 'k_gang', dir: 's', name: 'De Gang der Beloften'}], E: [{kind: 'demo', n: 2, group: 'f1_gang'}, {kind: 'halluc', group: 'f1_gang'}, {kind: 'demo', group: 'f1_gang'}], N: [{id: 'glans1', dir: 's'}], I: [{id: 'card:2'}]});
// Glans is stuck inside his own golden demo cage: four walls that are not real
for (const [x, z] of [[7, 16], [6, 17], [8, 17], [7, 18]]) m.put(x, z, 'S', {color: 0xffe08a});
m.ent(7, 14, 'T', {id: 't_glanskooi', r: 1.3});
m.rect(7, 10, 7, 10);
m.put(7, 11, 'G', {id: 'showgate', flag: 'f1_gate', sign: true, signColor: 0xffd36b, color: 0x8a6a2a, glow: 0x3a2a08, label: 'Het hek van de Showroom', msg: 'Een gouden hek. Op een bordje: ‘Showroom. Alleen voor wie de vraag heeft gesteld.’'});
// the showroom: the gleaming demo waits here
m.stamp(2, 1, `
>..............
...o.......o...
...............
...............
.......V.......
...............
...o.......o..I
@..............
.......T.......`, {'>': [{id: 'down_f2', to: 'f2', at: 'from_f1', label: 'Daal af naar Diepte 2', need: 'boss_demo', msg: 'De Glimmende Demo staat in de weg. En hij glimt nogal.'}], V: [{id: 'showroom'}], I: [{id: 'halluc:10'}], '@': [{id: 'from_f2', dir: 's'}], T: [{id: 't_showroom', r: 1.6}]});
m.ent(9, 3, 'E', {kind: 'demoBoss', group: 'boss_demo', if: 'f1_gate'});

export default {
  id: 'f1', depth: 'Diepte 1', name: 'De Kelder der Beloften', music: 'f1',
  fog: 0x0c0907, fogDensity: 0.05, sky: 0x6a7898, ground: 0x2a1d12, hemi: 0.16,
  defaults: {wall: 'brick', floor: 'flag', ceil: 'rough', ceilH: 4, torch: 0xffa860, torchEvery: 5, fill: [0x2a2a3a, 0.03],
    tint: {wall: 0xb8906a, floor: 0xa08a74, ceil: 0x5a4a3a}},
  zones: [
    {id: 'trappen', name: 'De Trappenkelder', sub: 'Diepte 1', r: [21, 33, 27, 43], torchEvery: 0, fill: [0x2a2a3a, 0.012]},
    {id: 'lampen', name: 'De Lampenkamer', r: [18, 24, 33, 32], torchEvery: 0, fill: [0x2a2a3a, 0.015], ceilH: 5},
    {id: 'wijn', name: 'De Wijnkelder', r: [31, 26, 47, 33], torchEvery: 5, torch: 0xff9a50, ceilH: 4.5},
    {id: 'vraag', name: 'De Kamer van de Vraag', sub: 'Probleem & Noodzaak', r: [15, 10, 34, 23], wall: 'ashlar', ceilH: 9, torch: 0x9fc3ff, torchEvery: 3, torchI: 1.5, fill: [0x4a6aa8, 0.12], moss: 0.2,
      tint: {wall: 0x93a3bb, floor: 0x8f98a8, ceil: 0x4f5868, pillar: 0xa8b4c8}},
    {id: 'archief', name: 'Het klachtenarchief', r: [35, 10, 48, 22], wall: 'shelf', floor: 'plank', ceil: 'beam', ceilH: 3.6, torchEvery: 0, fill: [0x6a5a40, 0.05],
      tint: {wall: 0xd8c8b0, floor: 0x9a7a58, ceil: 0x6a5a4a}, glow: [[38, 16, 2.2, 0xffd08a, 0.8, 7], [44, 12, 2.2, 0xffd08a, 0.6, 6], [41, 20, 2.2, 0xffd08a, 0.6, 6]]},
    {id: 'oudarchief', name: 'De oude archiefkamer', sub: '1897–1998', r: [38, 3, 47, 9], wall: 'shelf', floor: 'plank', ceil: 'beam', ceilH: 3.4, torchEvery: 0, fill: [0x9fc3ff, 0.05], tint: {wall: 0xb8b0a0, floor: 0x8a7050}, glow: [[42, 5, 2.4, 0x9fc3ff, 0.9, 8]]},
    {id: 'gang', name: 'De Gang der Beloften', sub: '‘Binnen zes weken live!’', r: [2, 11, 14, 22], wall: 'ashlar', ceilH: 6, torch: 0xffd36b, torchEvery: 3, fill: [0x6a5020, 0.05], tint: {wall: 0xc8b088, floor: 0xa89878, ceil: 0x6a5a40}},
    {id: 'showroom', name: 'De Showroom', sub: 'PraatPal · Live demo', r: [2, 1, 16, 10], wall: 'marble', floor: 'tiles', ceilH: 8, torch: 0xffd36b, torchEvery: 3, torchI: 1.3, fill: [0x8a6a20, 0.07], tint: {wall: 0xe8d0a0, floor: 0xd8c8a8, ceil: 0x8a7050, pillar: 0xffe0a0}},
  ],
  ...m.build(),
};
