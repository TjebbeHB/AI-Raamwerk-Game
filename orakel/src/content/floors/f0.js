// Diepte 0 · Het stadhuis van Dalwijk: your desk, the public hall, the caretaker, the cellar door.
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
// the caretaker's room
m.stamp(25, 2, `
a...b..cb
..d......
....N....
.........
.......cc
a........`, {N: [{id: 'joop', dir: 's'}]});
m.put(29, 8, 'D');
// the cellar door and the stair down
m.put(34, 9, 'D', {lock: 'kelder', label: 'De kelderdeur', msg: 'De kelderdeur zit op slot. Joop, de conciërge, heeft de sleutel.'});
m.stamp(35, 8, `
.@.
..>
...`, {'@': [{id: 'from_f1', dir: 'w'}], '>': [{id: 'down_f1', to: 'f1', at: 'from_f0', label: 'Daal af naar het Gewelf', need: 'q:main>=2'}]});
// the public hall
m.rect(12, 12, 34, 23);
m.rect(21, 11, 23, 11);
m.stamp(12, 12, `
p......Q.............p
.,,,,,,,,,,,,,,,,,,,,..
?`, {Q: [{id: 'ticket', kind: 'ticket', dir: 's'}]});
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
m.ent(16, 21, 'N', {id: 'burger1', dir: 'n', still: true});
m.ent(27, 18, 'N', {id: 'burger2', dir: 'w'});
m.ent(26, 21, 'N', {id: 'burger3', dir: 'n'});
m.put(12, 23, 'p'); m.put(34, 23, 'p'); m.put(34, 12, 'p');
// the entrance
m.rect(19, 24, 25, 27);
m.stamp(19, 24, `
p.....p
.......
.......
p.....p`);
m.put(22, 28, 'D', {flag: 'never', label: 'De voordeur', msg: 'Buiten regent het pijpenstelen. En je eerste werkdag is hier binnen.'});
m.ent(19, 25, 'M', {id: 'welkom', kind: 'board', dir: 'e', title: 'Welkom in het stadhuis', text: 'Gemeente Dalwijk · Publiekshal\n\nVergunningen · Afvalpassen · Parkeren · Toeslagen\n\nHeeft u een vraag? Neem een nummer. Wij helpen u zo snel als wij kunnen.'});

export default {
  id: 'f0', depth: 'Diepte 0', name: 'Het stadhuis', music: 'f0',
  fog: 0x14100c, fogDensity: 0.02, sky: 0xfff0d8, ground: 0x4a3a2a, hemi: 0.55,
  defaults: {wall: 'plaster', floor: 'tiles', ceil: 'beam', ceilH: 3.6, torch: 0xffe2b0, torchEvery: 4, torchI: 0.9, fill: [0xfff0d8, 0.3],
    tint: {wall: 0xe8dcc8, floor: 0xd8d0c0, ceil: 0xb89878, carpet: 0x9a7a70}},
  zones: [
    {id: 'werkplek', name: 'Jouw werkplek', sub: 'Gemeente Dalwijk · maandag, 8:57', r: [2, 2, 10, 8], floor: 'plank', tint: {floor: 0xb08458}},
    {id: 'gang', name: 'De ambtenarengang', banner: false, r: [2, 9, 37, 11], wall: 'panel', tint: {wall: 0xc8a070}, ceilH: 3.4},
    {id: 'concierge', name: 'De conciërgekamer', r: [25, 2, 33, 8], wall: 'brick', floor: 'flag', tint: {wall: 0xc9a07a, floor: 0xa89a88}},
    {id: 'hal', name: 'De publiekshal', sub: 'Wachttijd: 9 werkdagen', r: [12, 12, 34, 23], ceilH: 7, torchEvery: 3, fill: [0xfff4e0, 0.42]},
    {id: 'entree', name: 'De entree', banner: false, r: [19, 24, 25, 28], ceilH: 5},
    {id: 'kelder', name: 'De kelderdeur', r: [34, 8, 37, 10], wall: 'brick', floor: 'flag', torch: 0xff9a5a, tint: {wall: 0xa88a6a, floor: 0x9a8a78}, fill: [0xff9a5a, 0.08]},
  ],
  ...m.build(),
};
