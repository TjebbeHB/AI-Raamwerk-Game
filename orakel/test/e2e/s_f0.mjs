export default [
  {name: 'start', shot: false, js: `document.querySelector('#titleBtns .go').click(); 'started'`, wait: 1500},
  {name: 'office', js: `(async()=>{const o=__orakel; await o.run(2); return JSON.stringify({dlg:o.DLG.active, p:[o.P.x,o.P.z], stage:o.G.quests.main})})()`, wait: 600},
  {name: 'letter', js: `(async()=>{const o=__orakel; o.ON.use.letter(); await o.run(0.2); return document.getElementById('reader').hidden})()`, wait: 600},
  {name: 'afterletter', shot: false, js: `(async()=>{const o=__orakel; document.querySelector('#reader [data-close]').click(); await o.run(2); return JSON.stringify({stage:o.G.quests.main, dlg:o.DLG.active})})()`, wait: 100},
  {name: 'joop', shot: false, js: `(async()=>{const o=__orakel; const j=o.W.byId.get('joop'); o.teleport(29,6,0); await o.run(0.2); j.interact(); await o.run(4); return JSON.stringify({stage:o.G.quests.main, keys:o.G.keys, hp:o.G.hp, log:o.DLG.log.slice(-3)})})()`, wait: 100},
  {name: 'hall', js: `(async()=>{const o=__orakel; o.teleport(22,16,Math.PI); o.P.pitch=-0.1; await o.run(0.5); return document.getElementById('placeName').textContent})()`, wait: 800},
  {name: 'hall2', js: `(async()=>{const o=__orakel; o.P.yaw = Math.PI/2+0.4; o.P.pitch=-0.15; await o.run(0.3); return 'ok'})()`, wait: 600},
  {name: 'glans', js: `(async()=>{const o=__orakel; const g=o.W.byId.get('glans'); o.teleport(15,16,Math.PI/2); await o.run(0.3); g.interact(); await o.run(1, {auto:false}); return o.DLG.log.slice(-2).join(' | ')})()`, wait: 500},
];
