const prep = `window.__orakel.autoDecide = 'best';`;
const talk = (id) => `{const n=o.W.byId.get('${id}'); o.teleport(Math.floor(n.x/2), Math.floor(n.z/2)+1, 0); await o.run(0.2); n.interact(); await o.run(8);}`;
export default [
  {name: 'start', shot: false, js: `document.querySelector('#titleBtns .go').click(); 'started'`, wait: 1500},
  {name: 'arrive', js: `(async()=>{const o=__orakel; ${prep} await o.run(1); Object.assign(o.G.flags,{pip:true,f1_gate:true,boss_demo:true,godmode:true}); o.G.tools.lamp=o.G.tools.scale=true; o.setStage('main',10,true); await o.travel('f2','from_f1'); await new Promise(r=>setTimeout(r,1500)); await o.run(6); return JSON.stringify({floor:o.W.id, stage:o.G.quests.main, ents:o.W.ents.length})})()`, wait: 800},
  {name: 'gov', js: `(async()=>{const o=__orakel; ${talk('griffel')}
     const pieces=o.W.ents.filter(e=>e.def.group==='gov'&&e.def.kind==='carry'); const slots=o.W.ents.filter(e=>e.def.group==='gov'&&e.def.kind==='slot');
     let log=[]; for(const p of pieces){ o.teleport(p.tx,p.tz,0); await o.run(0.1); p.interact(); await o.run(0.1); const slot=slots.find(s=>s.def.bin===p.def.bin); o.teleport(slot.tx,slot.tz+1,0); await o.run(0.1); slot.interact(); await o.run(0.2); log.push(p.placed?'ok':'fail'); }
     ${talk('griffel')} return JSON.stringify({log, trial:o.G.flags['trial:governance'], stone:o.G.items['steen:governance'], state: o.G.chambers.governance?.attempts?.at(-1)?.complete})})()`, wait: 800},
  {name: 'culture', js: `(async()=>{const o=__orakel; ${talk('vonk')}
     const right={ans:0,joris:1,fatma:2,pieter:1}; for(const id of ['ans','joris','fatma','pieter']){ const n=o.W.byId.get(id); o.teleport(n.tx,n.tz+1,0); await o.run(0.2); n.interact(); await o.run(3,{choices:[right[id]]}); }
     ${talk('vonk')} return JSON.stringify({trial:o.G.flags['trial:culture'], stone:o.G.items['steen:culture'], fires:['ans','joris','fatma','pieter'].map(i=>o.G.flags['fire:vuur_'+i]), maxHp:o.G.maxHp})})()`, wait: 800},
  {name: 'capacity', js: `(async()=>{const o=__orakel; ${talk('mallow')}
     for (const id of ['rol:0','rol:2']){ const it=o.W.byId.get(id); if(it){ o.teleport(it.tx,it.tz,0); await o.run(0.2); it.interact(); await o.run(0.3);} }
     const chest=o.W.ents.find(e=>e.type==='chest'&&(e.def.items||[]).includes('rol:1')); o.teleport(chest.tx,chest.tz+1,0); await o.run(0.2); chest.interact(); await o.run(0.3);
     const henk=o.W.byId.get('henk'); o.teleport(henk.tx+1,henk.tz,0); await o.run(0.2); henk.interact(); await o.run(6,{choices:[0]});
     const bos=o.W.byId.get('sleutelbos'); o.teleport(bos.tx,bos.tz,0); await o.run(0.2); bos.interact(); await o.run(1);
     const lec=o.W.byId.get('archief_lessenaar'); o.teleport(lec.tx,lec.tz+1,0); await o.run(0.2); lec.interact(); await o.run(1);
     ${talk('mallow')} return JSON.stringify({rols:[0,1,2,3].map(i=>!!o.G.items['rol:'+i]), trial:o.G.flags['trial:capacity'], stone:o.G.items['steen:capacity'], archief:o.G.keys.archief})})()`, wait: 800},
  {name: 'infra', js: `(async()=>{const o=__orakel; ${talk('wolk')}
     const crates=o.W.ents.filter(e=>e.type==='crate'); const plates={open:['plaat_o1','plaat_o2'], geheim:['plaat_g1','plaat_g2']};
     // place crates directly onto plates (the push mechanics are tested separately)
     const used={}; for(const c of crates){ const list=plates[c.def.kind]; const pid=list.find(p=>!used[p]); used[pid]=1; const p=o.W.byId.get(pid); c.tx=p.tx; c.tz=p.tz; c.x=p.x; c.z=p.z; c.group.position.set(c.x,0,c.z); }
     await o.run(1);
     const seal=o.W.byId.get('tool:seal'); o.teleport(seal.tx,seal.tz+1,0); await o.run(0.3); seal.interact(); await o.run(5);
     for(const e of o.C.enemies) if(e.group==='f2_leak'){ e.lastTool='seal'; }
     const bp=o.W.byId.get('blauwdruk'); o.teleport(bp.tx,bp.tz,0); await o.run(0.3); bp.interact(); await o.run(1);
     ${talk('wolk')} return JSON.stringify({trial:o.G.flags['trial:infrastructure'], seal:o.G.tools.seal, stone:o.G.items['steen:infrastructure'], gate:o.W.byId.get('kluishek').lift.toFixed(2)})})()`, wait: 800},
  {name: 'stones', js: `(async()=>{const o=__orakel; for(const id of ['governance','culture','capacity','infrastructure']){ const s=o.W.byId.get('slot_'+id); o.teleport(s.tx,s.tz+1,0); await o.run(0.2); s.interact(); await o.run(0.3);} await o.run(6); return JSON.stringify({stage:o.G.quests.main, king:o.C.enemies.filter(e=>e.boss).map(e=>e.type+':'+e.state)})})()`, wait: 1000},
  {name: 'king', js: `(async()=>{const o=__orakel; const k=o.C.enemies.find(e=>e.type==='king'); o.P.tool='scale'; for(let i=0;i<200 && k.alive;i++){ o.teleport(Math.floor(k.x/2), Math.floor(k.z/2)+2, 0); o.C.cd.scale=0; o.useTool('scale'); await o.run(0.2);} await o.run(5); return JSON.stringify({kingAlive:k.alive, hp:Math.round(k.hp), stage:o.G.quests.main, lift:o.G.flags.lift_ready})})()`, wait: 1000},
  {name: 'lift', js: `(async()=>{const o=__orakel; const l=o.W.byId.get('biglift'); o.teleport(l.tx,l.tz,0); await o.run(0.2); l.interact(); await new Promise(r=>setTimeout(r,1500)); await o.run(4); return JSON.stringify({floor:o.W.id, stage:o.G.quests.main})})()`, wait: 1000},
];
