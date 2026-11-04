const prep = `window.__orakel.autoDecide = 'best';`;
const near = (id, dz = 1) => `{const n=o.W.byId.get('${id}'); o.teleport(n.tx, n.tz+${dz}, 0); await o.run(0.2);}`;
const talk = (id) => `{const n=o.W.byId.get('${id}'); o.teleport(n.tx+1, n.tz, 0); await o.run(0.2); n.interact(); await o.run(9);}`;
export default [
  {name: 'start', shot: false, js: `document.querySelector('#titleBtns .go').click(); 'started'`, wait: 1500},
  {name: 'arrive', js: `(async()=>{const o=__orakel; ${prep} await o.run(1); Object.assign(o.G.flags,{pip:true,godmode:true,lift_ready:true}); Object.assign(o.G.tools,{lamp:true,scale:true,seal:true}); o.setStage('main',13,true); await o.travel('f3','from_f2'); await new Promise(r=>setTimeout(r,1500)); await o.run(6); return JSON.stringify({floor:o.W.id, stage:o.G.quests.main, ents:o.W.ents.length, en:o.C.enemies.length})})()`, wait: 900},
  {name: 'wouter', shot: false, js: `(async()=>{const o=__orakel; ${talk('wouter')} return JSON.stringify({met:o.G.flags.wouter_met})})()`, wait: 100},
  {name: 'judges', shot: false, js: `(async()=>{const o=__orakel; const out={};
     for (const id of ['quality','evaluation','functionality']) { ${''}
       const npc={quality:'bep',evaluation:'mira',functionality:'kees'}[id]; { const n=o.W.byId.get(npc); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(8); }
       const ans=o.CHAMBERS? null:null;
       for (let i=0;i<4;i++){ const p=o.W.byId.get(id+'_post'+i); o.teleport(p.tx,p.tz+1,0); await o.run(0.1); o.ON.use[p.id](); const items = window.__orakel.trial(id).items; await o.run(3,{choices:[items[i].answer]}); }
       { const n=o.W.byId.get(npc); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(10); }
       out[id]=[o.G.flags['trial:'+id], !!o.G.keys['brug_'+id]]; }
     return JSON.stringify(out)})()`, wait: 100},
  {name: 'sequences', shot: false, js: `(async()=>{const o=__orakel; const out={};
     for (const [id,npc] of [['compliance','otto'],['interaction','noor']]) {
       { const n=o.W.byId.get(npc); o.teleport(n.tx+1,n.tz+1,0); await o.run(0.2); n.interact(); await o.run(8); }
       const steps=window.__orakel.trial(id).steps.length;
       for (let i=0;i<steps;i++){ const b=o.W.byId.get(id+'_q'+i); o.teleport(b.tx,b.tz+1,0); await o.run(0.1); b.interact(); await o.run(0.3); }
       await o.run(4);
       { const n=o.W.byId.get(npc); o.teleport(n.tx+1,n.tz+1,0); await o.run(0.2); n.interact(); await o.run(10); }
       out[id]=[o.G.flags['trial:'+id], !!o.G.keys['brug_'+id]]; }
     out.bakker=o.G.quests.bakker; return JSON.stringify(out)})()`, wait: 100},
  {name: 'perf', js: `(async()=>{const o=__orakel; { const n=o.W.byId.get('bram'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(8); }
     const lv=window.__orakel.trial('performance').levers; for(let i=0;i<4;i++){ const l=o.W.byId.get('performance_l'+i); if(l.state!==lv[i].correct){ o.teleport(l.tx,l.tz+1,0); await o.run(0.1); l.interact(); await o.run(0.3);} }
     await o.run(2); { const n=o.W.byId.get('bram'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(10); }
     return JSON.stringify([o.G.flags['trial:performance'], !!o.G.keys.brug_performance])})()`, wait: 900},
  {name: 'duur', js: `(async()=>{const o=__orakel; { const n=o.W.byId.get('sien'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(8); }
     const pieces=o.W.ents.filter(e=>e.def.group==='duur'&&e.def.kind==='carry'); const slots=o.W.ents.filter(e=>e.def.group==='duur'&&e.def.kind==='slot');
     for(const p of pieces){ o.teleport(p.tx,p.tz,0); await o.run(0.1); p.interact(); await o.run(0.1); const s=slots.find(s=>s.def.bin===p.def.bin); o.teleport(s.tx,s.tz+1,0); await o.run(0.1); s.interact(); await o.run(0.2);} await o.run(3);
     { const n=o.W.byId.get('sien'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(10); }
     return JSON.stringify([o.G.flags['trial:sustainability'], !!o.G.keys.brug_sustainability])})()`, wait: 900},
  {name: 'hydra', js: `(async()=>{const o=__orakel; { const n=o.W.byId.get('slotje'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(8); }
     const h=o.C.enemies.find(e=>e.type==='hydra'); let guard=0;
     while(h.alive && guard++<300){ o.teleport(Math.floor(h.x/2), Math.floor(h.z/2)+2, 0); const heads=o.C.enemies.filter(e=>e.type==='hydraHead'&&e.alive);
        if(heads.length){ const t=heads[0]; const dx=t.x-o.P.x, dz=t.z-o.P.z; o.P.yaw=Math.atan2(-dx,-dz); o.P.pitch=Math.atan2(t.y-1.6, Math.hypot(dx,dz)); o.P.tool='lamp'; o.C.cd.lamp=0; o.useTool('lamp'); }
        else { o.P.yaw=Math.PI; o.P.pitch=0; o.P.tool='seal'; o.C.cd.seal=0; o.useTool('seal'); }
        await o.run(0.15); }
     await o.run(6); { const n=o.W.byId.get('slotje'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(10); }
     return JSON.stringify({hydra:h.alive, hp:Math.round(h.hp), stumps:h.stumps.map(s=>s&&s.sealed), trial:o.G.flags['trial:security'], key:!!o.G.keys.brug_security, guard})})()`, wait: 900},
  {name: 'ethics', shot: false, js: `(async()=>{const o=__orakel; { const n=o.W.byId.get('linde'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(8); }
     for(let i=0;i<3;i++){ const h=o.W.byId.get('hoorn'+i); o.teleport(h.tx,h.tz+1,0); await o.run(0.1); h.interact(); await o.run(4);} 
     { const n=o.W.byId.get('linde'); o.teleport(n.tx+1,n.tz,0); await o.run(0.2); n.interact(); await o.run(10); }
     return JSON.stringify([o.G.flags['trial:ethics'], !!o.G.keys.brug_ethics, Object.keys(o.G.keys).filter(k=>k.startsWith('brug_')).length, o.G.quests.main])})()`, wait: 100},
  {name: 'bridge', js: `(async()=>{const o=__orakel; ${talk('wouter')} await o.run(4); o.teleport(37,20,Math.PI); o.P.pitch=-0.2; await o.run(1); return JSON.stringify({stage:o.G.quests.main, built:o.G.flags.bridge_built, sov:o.G.chambers.sovereignty?.attempts?.length})})()`, wait: 1200},
  {name: 'cross', js: `(async()=>{const o=__orakel; o.P.yaw=Math.PI; window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); await o.run(10); window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})); return JSON.stringify({p:[Math.floor(o.P.x/2),Math.floor(o.P.z/2)], falling:o.P.falling, hp:o.G.hp})})()`, wait: 900},
];
