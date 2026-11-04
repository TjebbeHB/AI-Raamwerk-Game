// Het oefenlokaal: a new game (a Datatovenaar called Sam, so the ability step is there too) goes into the
// practice, does every step with the debug API (keys through press(code) and key events), and ends in the
// real game on Diepte 0 with the practice state gone. Then a replay from Diepte 0, skipped halfway:
// you are back where you were. Run with: node orakel/test/e2e/run.mjs oefen
// Each [eval] line shows the step the checklist is on afterwards.
const H = `{ const o = window.__orakel, run0 = o.run; o.run = async (...a) => { try { return await run0(...a); } finally { window.__hold = true; } }; window.__hold = true; }
window.T = {
  o: window.__orakel,
  at(tx, tz, yaw) { this.o.teleport(tx, tz, yaw); this.o.P.pitch = -0.12; },
  key(code, on) { dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', {code, bubbles: true})); },
  async hold(codes, sec) { for (const c of codes) this.key(c, true); try { await this.o.run(sec); } finally { for (const c of codes) this.key(c, false); } },
  step() { const n = document.querySelector('#oefen .oh .n')?.textContent || ''; return (document.querySelector('#oefen h3')?.textContent || '(geen stap)') + ' · ' + n; },
  // real time passes for fades (they use timers), game time for everything else
  async travel(floor, max = 80) { for (let i = 0; i < max && (this.o.W.id !== floor || this.o.GAME.busy); i++) { await this.o.run(0.05); await new Promise(r => setTimeout(r, 90)); } return this.o.W.id; },
  next() { return this.o.run(1.7); },
}; 'helpers'`;
const step = (name, body, o = {}) => ({name, js: `(async()=>{const o=__orakel; ${body}})()`, shot: false, ...o});

export default [
  {name: 'start', shot: false, js: `document.querySelector('#titleBtns .go').click(); 'started'`, wait: 1500},
  {name: 'helpers', shot: false, js: H, wait: 50},
  // the opening scene of the new game is already running: the practice lets it rush by and starts
  step('oefen', `o.G.hero = {name: 'Sam', pronouns: 'die', address: 'neutraal', archetype: 'datatovenaar', look: {}}; o.ON.tutorialStart(); const f = await T.travel('oefen'); await o.run(4); return JSON.stringify({floor: f, step: T.step(), tools: o.G.tools, godmode: o.G.flags.godmode})`, {shot: true, wait: 300}),
  step('look', `o.P.yaw += 1.6; await o.run(0.1); o.P.yaw -= 1.4; await o.run(0.1); await T.next(); return T.step()`),
  step('walk', `T.at(5, 17, 0); await o.run(0.2); T.at(5, 16, 0); await T.next(); return T.step()`, {shot: true, wait: 200}),
  step('run', `T.at(5, 14, 0); await T.hold(['ShiftLeft', 'KeyW'], 2.2); await T.next(); return T.step()`),
  step('dash', `T.at(7, 3, -Math.PI / 2); o.P.x = 15.5; await o.run(0.1); o.press('Space'); await o.run(0.8); await T.next(); return T.step() + ' · x=' + o.P.x.toFixed(1)`),
  step('talk', `T.at(14, 3, 0); await o.run(0.2); o.W.byId.get('oefenjoop').interact(); await o.run(0.4, {auto: false}); return document.getElementById('dlgName').textContent + ': ' + document.getElementById('dlgText').textContent.slice(0, 60)`, {shot: true, wait: 300}),
  step('talk2', `await o.run(5, {choices: [3]}); await T.next(); return T.step() + ' · ' + o.DLG.log.slice(-3).join(' | ')`),
  step('read', `T.at(12, 2, 0); await o.run(0.2); o.W.byId.get('oefen_regels').interact(); await o.run(0.3); const t = document.getElementById('readTitle').textContent; document.querySelector('#reader [data-close]').click(); await T.next(); return t + ' -> ' + T.step()`),
  step('pickup', `T.at(11, 6, 0); await o.run(0.2); o.W.byId.get('snack:oefen').interact(); await T.next(); return T.step()`),
  step('crate', `T.at(15, 7, Math.PI); await o.run(0.2); await T.hold(['KeyW'], 2.6); await o.run(4); return T.step() + ' · plaat=' + o.G.flags.oefen_plaat`),
  // the controls card, from the checklist
  step('controls', `[...document.querySelectorAll('#oefen .ob .btn')].find(b => b.textContent === 'Alle toetsen').click(); await o.run(0.1); return document.querySelectorAll('#ctlCard .ctl-row').length + ' regels · modal=' + o.GAME.modal`, {shot: true, wait: 300}),
  step('controlsdicht', `T.key('Escape', true); T.key('Escape', false); await o.run(0.1); return 'card=' + !!document.getElementById('ctlCard') + ' · modal=' + o.GAME.modal`),
  step('camera', `o.press('KeyV'); await T.next(); return T.step()`),
  step('journal', `o.press('KeyJ'); await o.run(0.2); const m = o.GAME.modal; document.querySelector('#journal [data-close]').click(); await T.next(); return m + ' -> ' + T.step()`),
  step('map', `o.press('KeyM'); await o.run(0.2); const m = o.GAME.modal; document.querySelector('#mapModal [data-close]').click(); await T.next(); return m + ' -> ' + T.step()`),
  step('lamp', `T.at(25, 6, 0); await o.run(0.3); o.press('Digit1'); await o.run(0.1); o.useTool('lamp'); await o.run(0.6); await T.next(); return T.step()`, {shot: true, wait: 300}),
  step('scale', `T.at(25, 5, 0); o.press('Digit2'); await o.run(0.1); o.useTool('scale'); await o.run(0.3); await T.next(); return T.step()`),
  step('seal', `T.at(25, 4, 0); o.press('Digit3'); await o.run(0.1); o.useTool('seal'); await o.run(0.3); await T.next(); return T.step()`),
  step('reveal', `T.at(25, 9, Math.PI); await o.run(0.3); o.revealPulse(); await o.run(0.4); await T.next(); return T.step()`, {shot: true, wait: 300}),
  step('ability', `T.at(25, 6, 0); o.press('KeyF'); await T.next(); return T.step()`),
  step('hint', `o.press('KeyH'); await o.run(0.2); const pip = document.getElementById('pipText').textContent; await T.next(); return T.step() + ' · Pip: ' + pip`),
  // the mock decision: the real panel with Joop's coffee machine
  step('decide', `const j = o.W.byId.get('oefenjoop'); T.at(Math.floor(j.x / 2), Math.floor(j.z / 2) + 1, 0); await o.run(0.2); j.interact(); for (let i = 0; i < 30 && o.GAME.modal !== 'decision'; i++) await o.run(0.2); return o.GAME.modal + ' · ' + document.getElementById('decTitle').textContent`, {shot: true, wait: 300}),
  step('decide2', `const b = document.querySelectorAll('#decBody .optb'); b[0].click(); b[2].click(); b[3].click(); document.querySelector('#decBar .go').click(); await o.run(0.1); return document.querySelector('#decBody .verdictbox h3')?.textContent`, {shot: true, wait: 300}),
  // the finale, and the real start on Diepte 0 with the practice state gone
  step('finale', `document.querySelector('#decBar .go').click(); await o.run(6); const f = await T.travel('f0'); await o.run(3); const G = o.G; return JSON.stringify({floor: f, hero: G.hero?.name, arch: G.hero?.archetype, tools: G.tools, pip: !!G.flags.pip, godmode: !!G.flags.godmode, backup: !!G.flags['oefen:backup'], chambers: Object.keys(G.chambers), floorTime: Object.keys(G.stats.floorTime || {}), geoefend: Object.keys(G.flags).filter(k => k.startsWith('geoefend')).length, panel: document.getElementById('oefen')?.hidden, dlg: o.DLG.log.slice(-2).join(' | ')})`, {shot: true, wait: 500}),
  // just-in-time tips: a practised one stays away, a new one shows
  step('tips', `const dash = o.ON.tip('dash'), carry = o.ON.tip('carry'); for (let i = 0; i < 20 && document.getElementById('oefentip')?.hidden !== false; i++) await o.run(0.3, {auto: true}); return JSON.stringify({dash, carry, shown: document.getElementById('oefentip')?.textContent})`, {shot: true, wait: 300}),
  // practise again from Diepte 0, skip halfway, and be back where you were
  step('replay', `T.at(5, 6, 0.5); await o.run(0.3); const before = {x: o.P.x.toFixed(1), z: o.P.z.toFixed(1)}; o.ON.tutorialStart({replay: true}); await T.travel('oefen'); await o.run(3); const s = T.step(); [...document.querySelectorAll('#oefen .ob .btn')].find(b => b.textContent === 'Sla de uitleg over').click(); await o.run(0.5); const f = await T.travel('f0'); await o.run(0.5); return JSON.stringify({s, floor: f, before, after: {x: o.P.x.toFixed(1), z: o.P.z.toFixed(1)}, tools: o.G.tools, active: o.ON.tutorialActive()})`, {shot: true, wait: 400}),
];
