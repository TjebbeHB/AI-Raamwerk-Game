// Diepte 0 with the story systems: a Verbinder called Sam reads the letter, talks to everyone,
// makes the choices that matter, finds every secret of the town hall and goes down the stairs.
// Choice indexes count the options as shown (options hidden by `if` do not count).
// The page only renders inside run() (its last frame is what the screenshot shows), and every few
// steps the game is saved and the page reloaded: software rendering on a busy machine is slow,
// and short page sessions keep its memory in check.
const T = `{ const o = window.__orakel, run0 = o.run; o.run = async (...a) => { try { return await run0(...a); } finally { window.__hold = true; } }; window.__hold = true; }
window.T = {
  o: window.__orakel,
  at(tx, tz, yaw) { this.o.teleport(tx, tz, yaw); this.o.P.pitch = -0.12; },
  async talk(id, choices = [], sec = 4) { const e = this.o.W.byId.get(id); e.interact(); await this.o.run(sec, {choices}); return this.o.DLG.log.slice(-3).join(' | '); },
  async use(id, sec = 0.4) { await this.o.W.byId.get(id).interact(); await this.o.run(sec); },
  close() { const r = document.getElementById('reader'); if (!r.hidden) r.querySelector('[data-close]').click(); },
  state() { const G = this.o.G; return {secrets: G.secrets, trinkets: G.trinkets, bingo: G.bingo, ach: G.achievements, rel: G.rel, choices: G.choices.map(c => c.id + '=' + c.pick)}; },
}; 'helpers'`;
const step = (name, body, o = {}) => ({name, js: `(async()=>{const o=__orakel; ${body}})()`, ...o});
// save, reload the page, continue the saved game and put the helpers back
const checkpoint = n => [
  {name: `save${n}`, shot: false, js: `(async()=>{const o=__orakel; o.G.pos = {x: o.P.x, z: o.P.z, yaw: o.P.yaw}; o.saveGame(); setTimeout(() => location.reload(), 50); return 'reloading'})()`, wait: 3500},
  {name: `continue${n}`, shot: false, js: `document.querySelector('#titleBtns .go').click(); 'continued'`, wait: 2500},
  {name: `helpers${n}`, shot: false, js: T, wait: 50},
];

export default [
  {name: 'start', shot: false, js: `document.querySelector('#titleBtns .go').click(); 'started'`, wait: 1500},
  {name: 'helpers', shot: false, js: T, wait: 50},
  step('hero', `o.G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: 'verbinder', look: {}}; await o.run(1); return JSON.stringify({dlg: o.DLG.active, stage: o.G.quests.main})`, {shot: false}),
  step('letter', `o.ON.use.letter(); await o.run(0.2); return document.getElementById('readTitle').textContent`),
  step('afterletter', `T.close(); await o.run(1); return o.G.quests.main`, {shot: false}),
  // Joop: the Verbinder asks how he is really doing, then promises to bring back his keys
  step('joop', `T.at(29, 6, 0); await o.run(0.2); const log = await T.talk('joop', [3, 0]); return JSON.stringify({stage: o.G.quests.main, keys: o.G.keys, rel: o.G.rel.joop, log})`, {wait: 250}),
  step('notice', `return document.getElementById('relnote')?.textContent || 'no notice'`, {wait: 200}),
  // Ilse sits behind the counter: you must be able to talk to her from the public side
  step('reach', `T.at(30, 16, -Math.PI / 2); await o.run(0.1); for (let i = 0; i < 30; i++) { o.P.x += 0.1; await o.run(0.03); } const e = o.W.byId.get('ilse'); return JSON.stringify({d: e.dist().toFixed(2), talkable: e.interactable})`, {shot: false}),
  // Meneer De Wit wears Joop's reading glasses on top of his own; then the dog
  step('dewit', `T.at(26, 23, 0); await o.run(0.2); await T.talk('burger3', [3]); const a = !!o.G.items.leesbril; await T.talk('burger3', [2]); return JSON.stringify({bril: a, hond: o.G.choices.find(c => c.id === 'dewit_hond')?.pick})`),
  step('bril', `T.at(29, 6, 0); await o.run(0.2); await T.talk('joop'); return JSON.stringify({magazijn: !!o.G.keys.magazijn, rel: o.G.rel.joop})`, {shot: false}),
  ...checkpoint(1),
  // the storeroom behind the door without a sign
  step('magazijn', `T.at(35, 4, -Math.PI / 2); await o.run(0.2); T.at(36, 4, -Math.PI / 2 - 0.5); await o.run(0.6); await T.use('nietmachine'); await T.use('stempeltje'); o.P.yaw = 0.5; await o.run(0.3); return JSON.stringify({secrets: o.G.secrets, trinkets: o.G.trinkets, stempel: !!o.G.items.stempeltje})`, {wait: 900}),
  step('opafoto', `T.at(35, 3, 0); await o.run(0.2); await T.use('opafoto', 0.2); return document.getElementById('readTitle').textContent`, {wait: 500}),
  step('sanne', `T.close(); T.at(26, 18, -Math.PI / 2); await o.run(0.2); const log = await T.talk('burger2'); return JSON.stringify({stempel: o.G.flags.sanne_stempel, ach: o.G.achievements, log})`, {shot: false}),
  // Ilse and the afvalpasbrief: ask the residents
  step('ilse', `T.at(30, 16, -Math.PI / 2); await o.run(0.2); const log = await T.talk('ilse', [0, 2]); return JSON.stringify({brief: o.G.choices.find(c => c.id === 'ilse_brief')?.pick, log})`, {wait: 300}),
  step('kok', `T.at(16, 23, 0); await o.run(0.2); await T.talk('burger1', [1]); await T.talk('burger1', [0, 0]); return JSON.stringify({brief: o.G.flags.brief_burger1, brood: !!o.G.items.brood})`, {shot: false}),
  step('bakker', `T.at(21, 19, Math.PI / 2); await o.run(0.2); await T.talk('bakker', [2, 0]); await T.talk('bakker', [0]); return JSON.stringify({belofte: o.G.choices.find(c => c.id === 'bakker_belofte')?.pick, brief: o.G.flags.brief_bakker, kleinkinderen: o.G.flags.bakker_kleinkinderen})`, {wait: 300}),
  ...checkpoint(2),
  step('brood', `T.at(30, 16, -Math.PI / 2); await o.run(0.2); await T.talk('ilse'); await T.talk('ilse', [0]); return JSON.stringify({brood: o.G.flags.brood_ilse, klaar: o.G.flags.brief_inwoners_klaar, ach: o.G.achievements})`, {wait: 300}),
  step('kokbedankt', `T.at(16, 23, 0); await o.run(0.2); await T.talk('burger1'); return JSON.stringify({hp: o.G.hp, kok: o.G.rel.burger1})`, {shot: false}),
  // Glans: the sparren square, and the Verbinder asks him how his week is going
  step('glans', `T.at(15, 16, Math.PI / 2); await o.run(0.2); const log = await T.talk('glans', [5]); return JSON.stringify({bingo: o.G.bingo, glans: o.G.rel.glans, log})`, {wait: 300}),
  step('ingrid', `T.at(7, 12, Math.PI); await o.run(0.2); const log = await T.talk('ingrid', [0]); return log`),
  // Reprografie: the printer works for a Verbinder who asks how it is doing
  step('printer', `T.at(14, 5, 0); await o.run(0.2); await T.talk('printer', [3], 5); return JSON.stringify({ok: o.G.flags.printer_ok, trinkets: o.G.trinkets, how: o.G.choices.find(c => c.id === 'printer')?.pick})`, {wait: 400}),
  step('dirk', `T.at(13, 5, Math.PI / 2 + 0.6); await o.run(0.2); return 'dirk'`),
  ...checkpoint(3),
  step('whiteboard', `T.at(20, 3, 0); await o.run(0.2); o.W.byId.get('whiteboard').interact(); await o.run(0.2); return document.getElementById('readTitle').textContent`, {wait: 500}),
  step('vergaderkamer', `T.close(); await o.run(0.4); T.at(21, 7, 0.3); await o.run(0.2); return JSON.stringify({bingo: o.G.bingo})`, {wait: 400}),
  // the ticket machine counts on until it gives up
  step('tickets', `T.at(19, 14, 0); await o.run(0.2); for (let i = 0; i < 11; i++) { await T.use('ticket', 0.05); } return JSON.stringify({nummer: o.G.flags.tickets, secrets: o.G.secrets})`, {wait: 300}),
  step('brievenbus', `T.at(24, 14, 0); await o.run(0.2); o.W.byId.get('brievenbus').interact(); await o.run(0.2); return document.getElementById('readTitle').textContent`, {wait: 300}),
  step('galerij', `T.close(); await o.run(0.3); T.at(16, 21, Math.PI); o.P.pitch = 0.05; await o.run(0.2); return 'portretten'`, {wait: 400}),
  step('kantine', `T.at(5, 22, 0.2); await o.run(0.2); o.W.byId.get('koelkast').interact(); await o.run(0.2); T.close(); await o.run(0.3); for (let i = 0; i < 3; i++) await T.talk('snoepautomaat', [1], 2); return JSON.stringify({secrets: o.G.secrets, reep: o.G.flags.reep})`, {wait: 400}),
  ...checkpoint(4),
  // the duck mayor waits in the entrance once you know about hallucination #3
  step('eend', `o.G.flags.eend = true; T.at(22, 26, -Math.PI / 2); await o.run(0.3); const log = await T.talk('eend', [2], 2); await o.run(0.5); return JSON.stringify({secrets: o.G.secrets.length, log})`, {wait: 400}),
  step('journal', `o.press('KeyJ'); await o.run(0.1); [...document.querySelectorAll('#jTabs button')].find(b => b.textContent === 'Geheimen')?.click(); return [...document.querySelectorAll('#jTabs button')].map(b => b.textContent).join(',')`, {wait: 500}),
  step('journal2', `document.getElementById('jBody').scrollTop = 900; return 'scrolled'`, {wait: 300}),
  step('mensen', `[...document.querySelectorAll('#jTabs button')].find(b => b.textContent === 'Mensen')?.click(); return document.querySelectorAll('.relcard').length + ' mensen'`, {wait: 500}),
  // down the stairs: the main quest still flows
  step('down', `document.querySelector('#journal [data-close]')?.click(); await o.run(0.2); T.at(36, 9, -Math.PI / 2); await o.run(0.2); o.W.byId.get('down_f1').interact(); await o.run(3); return JSON.stringify({floor: o.W.id, stage: o.G.quests.main})`, {wait: 800}),
  step('state', `return JSON.stringify(T.state())`, {shot: false}),
];
