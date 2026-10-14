// Fights in the tussenkamers: three tools, light bolts, monsters with one weakness each, and a boss at the threshold.
import * as THREE from 'three';
import {boxGeo,Batch} from './kit.js';

export const TOOLS=['lamp','scale','seal'];
export const TOOL_COLOR={lamp:0xffd36b,scale:0xb9a2ff,seal:0x7fe0a4};
// Gentle numbers: this is a workshop, not a shooter. At most two monsters press in at once and each backs off after a hit.
const STATS={wisp:{hp:2,speed:2.1,r:.4,y:1.35,dmg:6},imp:{hp:1,speed:2.7,r:.32,y:0,dmg:5},slime:{hp:2,speed:1.6,r:.48,y:0,dmg:7},shade:{hp:3,speed:1.7,r:.42,y:0,dmg:7},paper:{hp:3,speed:1.3,r:.5,y:0,dmg:8}};
const ATTACKERS=2,COOLDOWN=1.8,RETREAT=1.1;
const BOSS_HP=4;
const ghost=(color,opacity=.55)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,transparent:true,opacity,roughness:.4,depthWrite:false});
const solidMat=(color,emissive=0x000000,ei=0)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:ei,roughness:.6});
const eyeMat=new THREE.MeshBasicMaterial({color:0xfff6d8,toneMapped:false});
function mesh(geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);return m}

// ---------- monster models ----------
function makeLook(look,colorHex){
 const g=new THREE.Group(),color=new THREE.Color(colorHex),mats=[],parts={};
 const keep=m=>{mats.push(m);return m};
 if(look==='wisp'){
  const core=keep(solidMat(colorHex,colorHex,1.6));parts.core=mesh(new THREE.SphereGeometry(.24,14,10),core);g.add(parts.core);
  const shell=new THREE.MeshBasicMaterial({color:colorHex,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});parts.shell=mesh(new THREE.SphereGeometry(.42,14,10),shell);g.add(parts.shell);
  for(const s of [-1,1])g.add(mesh(boxGeo(.07,.1,.03),new THREE.MeshBasicMaterial({color:0x2a1a10}),s*.09,.04,.23));
  parts.orbit=new THREE.Group();for(let k=0;k<3;k++){const o=mesh(new THREE.OctahedronGeometry(.06),core);o.position.set(Math.cos(k*2.1)*.5,0,Math.sin(k*2.1)*.5);parts.orbit.add(o)}g.add(parts.orbit);
 }else if(look==='imp'){
  const body=keep(solidMat(colorHex,colorHex,.25));g.add(mesh(boxGeo(.36,.4,.28),body,0,.5,0));g.add(mesh(boxGeo(.34,.32,.3),body,0,.88,0));
  for(const s of [-1,1]){const ear=mesh(new THREE.ConeGeometry(.07,.22,4),body,s*.13,1.12,0);ear.rotation.z=-s*.4;g.add(ear);g.add(mesh(boxGeo(.08,.26,.08),body,s*.12,.18,0));g.add(mesh(boxGeo(.07,.07,.02),eyeMat,s*.08,.9,.16))}
  parts.wings=[-1,1].map(s=>{const w=mesh(new THREE.PlaneGeometry(.5,.34),new THREE.MeshStandardMaterial({color:0xf2ead6,side:THREE.DoubleSide,roughness:.9}),s*.28,.62,-.12);w.rotation.y=s*.6;g.add(w);return w});
 }else if(look==='slime'){
  const outer=keep(ghost(colorHex,.62));parts.body=mesh(boxGeo(.8,.7,.8),outer,0,.35,0);g.add(parts.body);
  g.add(mesh(boxGeo(.36,.3,.36),solidMat(color.clone().multiplyScalar(.45).getHex()),0,.3,0));
  for(const s of [-1,1])g.add(mesh(boxGeo(.09,.12,.02),eyeMat,s*.15,.48,.41));
  parts.drip=mesh(boxGeo(.08,.14,.08),outer,.25,.06,.3);g.add(parts.drip);
 }else if(look==='shade'){
  const robe=keep(ghost(colorHex,.72));g.add(mesh(boxGeo(.62,1.2,.44),robe,0,.75,0));g.add(mesh(boxGeo(.5,.5,.4),robe,0,1.55,0));g.add(mesh(boxGeo(.58,.3,.46),robe,0,1.82,-.04));
  for(const s of [-1,1]){g.add(mesh(boxGeo(.08,.05,.02),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),s*.1,1.58,.21));g.add(mesh(boxGeo(.16,.7,.16),robe,s*.42,1.05,0))}
  parts.hem=mesh(boxGeo(.7,.12,.5),robe,0,.12,0);g.add(parts.hem);
 }else if(look==='paper'){
  const sheet=keep(solidMat(0xf2ead6,colorHex,.08));for(let k=0;k<8;k++){const m=mesh(boxGeo(.8-(k%3)*.05,.13,.58),sheet,(k%2-.5)*.06,.1+k*.15,(k%3-1)*.03);m.rotation.y=(k%3-1)*.12;g.add(m)}
  for(const s of [-1,1]){g.add(mesh(boxGeo(.1,.1,.02),new THREE.MeshBasicMaterial({color:0x2a1a10}),s*.16,1.05,.3));const arm=mesh(boxGeo(.14,.5,.1),sheet,s*.5,.7,0);arm.rotation.z=s*.3;g.add(arm)}
  parts.top=mesh(boxGeo(.86,.06,.62),solidMat(0xd94a3a),0,1.32,0);g.add(parts.top);
 }
 return {group:g,mats,parts};
}
function makeBoss(look,colorHex){
 const g=new THREE.Group(),mats=[],parts={},stone=solidMat(0xb4aa9a),trim=solidMat(colorHex,colorHex,.35);mats.push(stone,trim);
 const core=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffd36b,emissiveIntensity:2.2});parts.coreMat=core;
 if(look==='hydra'){
  const body=solidMat(0x4a6a5a,colorHex,.12);mats.push(body);g.add(mesh(boxGeo(2.6,1.3,2.0),body,0,.65,0));g.add(mesh(boxGeo(2.0,.5,1.6),body,0,1.5,0));
  parts.core=mesh(new THREE.OctahedronGeometry(.32),core,0,1.2,1.05);g.add(parts.core);
  parts.necks=[-1,0,1].map(s=>{const neck=new THREE.Group();neck.position.set(s*.75,1.7,.1);for(let k=0;k<4;k++)neck.add(mesh(boxGeo(.38,.42,.38),body,0,k*.4+.2,k*.08));
   const head=new THREE.Group();head.position.set(0,1.85,.4);head.add(mesh(boxGeo(.7,.5,.5),solidMat(0xf2ead6)));const flap=mesh(boxGeo(.72,.06,.4),solidMat(0xd9c9a0),0,.27,-.02);flap.rotation.x=-.4;head.add(flap);
   for(const e of [-1,1])head.add(mesh(boxGeo(.08,.08,.02),new THREE.MeshBasicMaterial({color:colorHex,toneMapped:false}),e*.15,.05,.26));neck.add(head);g.add(neck);return neck});
 }else{
  // fabulant and stamper share a golem frame
  for(const s of [-1,1])g.add(mesh(boxGeo(.55,1.1,.6),stone,s*.45,.55,0));
  g.add(mesh(boxGeo(1.7,1.4,1.0),stone,0,1.8,0));g.add(mesh(boxGeo(1.8,.2,1.06),trim,0,2.45,0));
  parts.head=mesh(boxGeo(.9,.8,.8),stone,0,2.95,0);g.add(parts.head);
  for(const s of [-1,1])parts.head.add(mesh(boxGeo(.14,.1,.02),new THREE.MeshBasicMaterial({color:colorHex,toneMapped:false}),s*.2,.08,.41));
  parts.core=mesh(new THREE.OctahedronGeometry(.3),core,0,1.85,.55);g.add(parts.core);
  parts.armL=new THREE.Group();parts.armL.position.set(-1.05,2.3,0);parts.armL.add(mesh(boxGeo(.42,1.3,.45),stone,0,-.6,0));g.add(parts.armL);
  parts.armR=new THREE.Group();parts.armR.position.set(1.05,2.3,0);g.add(parts.armR);
  if(look==='stamper'){parts.armR.add(mesh(boxGeo(.42,1.1,.45),stone,0,-.5,0));parts.armR.add(mesh(new THREE.CylinderGeometry(.1,.12,.4,8),solidMat(0x6b4a2e),0,-1.2,0));const st=mesh(boxGeo(.95,.4,.75),trim,0,-1.55,0);parts.armR.add(st);parts.armR.add(mesh(boxGeo(.9,.06,.7),solidMat(0xc0392e,0x601010,.4),0,-1.78,0))}
  else{parts.armR.add(mesh(boxGeo(.42,1.3,.45),stone,0,-.6,0));const mouth=mesh(boxGeo(.6,.12,.02),new THREE.MeshBasicMaterial({color:colorHex,toneMapped:false}),0,-.22,.41);parts.head.add(mouth);
   parts.bubbles=new THREE.Group();parts.bubbles.position.y=3.1;for(let k=0;k<4;k++){const b=mesh(boxGeo(.55,.34,.1),new THREE.MeshStandardMaterial({color:0xfaf6ea,emissive:0xfff2c8,emissiveIntensity:.35}));b.position.set(Math.cos(k*1.57)*1.5,.3+(k%2)*.4,Math.sin(k*1.57)*1.5);for(let d=-1;d<=1;d++)b.add(mesh(boxGeo(.06,.06,.02),new THREE.MeshBasicMaterial({color:0x3a2a1a}),d*.12,0,.06));parts.bubbles.add(b)}g.add(parts.bubbles)}
 }
 return {group:g,mats,parts};
}

// ---------- tool view model ----------
function makeTools(camera){
 const root=new THREE.Group();root.position.set(.34,-.3,-.82);root.scale.setScalar(.62);camera.add(root);
 const top=m=>{m.depthTest=false;m.depthWrite=false;return m};
 const lamp=new THREE.Group(),frame=top(new THREE.MeshStandardMaterial({color:0x9a8460,metalness:.6,roughness:.35,emissive:0x2a1c08})),glow=top(new THREE.MeshBasicMaterial({color:0xd8b060,toneMapped:false}));
 for(const [x,z] of [[-.09,-.09],[.09,-.09],[-.09,.09],[.09,.09]])lamp.add(mesh(boxGeo(.03,.28,.03),frame,x,0,z));lamp.add(mesh(boxGeo(.24,.04,.24),frame,0,.15,0));lamp.add(mesh(boxGeo(.24,.04,.24),frame,0,-.15,0));lamp.add(mesh(new THREE.SphereGeometry(.05,10,8),glow));lamp.add(mesh(new THREE.TorusGeometry(.08,.015,6,12,Math.PI),frame,0,.2,0));
 const scale=new THREE.Group(),sm=top(new THREE.MeshStandardMaterial({color:0xc9a25e,metalness:.7,roughness:.3})),sg=top(new THREE.MeshBasicMaterial({color:TOOL_COLOR.scale,toneMapped:false}));
 scale.add(mesh(boxGeo(.03,.32,.03),sm,0,-.02,0));scale.add(mesh(boxGeo(.38,.025,.025),sm,0,.14,0));for(const s of [-1,1]){scale.add(mesh(boxGeo(.008,.14,.008),sm,s*.17,.06,0));scale.add(mesh(new THREE.CylinderGeometry(.07,.05,.02,12),sm,s*.17,-.02,0))}scale.add(mesh(new THREE.OctahedronGeometry(.04),sg,0,.2,0));
 const seal=new THREE.Group(),wm=top(new THREE.MeshStandardMaterial({color:0x6b4a2e,roughness:.7})),gm=top(new THREE.MeshBasicMaterial({color:TOOL_COLOR.seal,toneMapped:false}));
 seal.add(mesh(new THREE.CylinderGeometry(.035,.045,.22,8),wm,0,.08,0));seal.add(mesh(new THREE.SphereGeometry(.05,8,6),wm,0,.21,0));seal.add(mesh(new THREE.CylinderGeometry(.11,.11,.05,16),gm,0,-.06,0));
 const models={lamp,scale,seal};for(const m of Object.values(models)){m.traverse(o=>{if(o.isMesh)o.renderOrder=999});m.visible=false;root.add(m)}
 root.visible=false;return {root,models};
}

export function createCombat({scene,camera,isFree,getPlayer,hurtPlayer,events,floatText,shake}){
 const tools=makeTools(camera);
 // one light reserved for the boss, created up front so the light count never changes mid-fight
 const bossLight=new THREE.PointLight(0xffe0c0,0,16,1.4);scene.add(bossLight);
 let active=null,tool=0,fireCd=0,kick=0,swap=0;const mobs=[],bolts=[],seen=new Set();
 const boltGeo=new THREE.SphereGeometry(.11,10,8),haloGeo=new THREE.SphereGeometry(.24,10,8);
 const boltMats=Object.fromEntries(TOOLS.map(t=>[t,new THREE.MeshBasicMaterial({color:TOOL_COLOR[t],toneMapped:false})]));
 const haloMats=Object.fromEntries(TOOLS.map(t=>[t,new THREE.MeshBasicMaterial({color:TOOL_COLOR[t],transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})]));
 // particle bursts on hits and defeats
 const MAXP=260,pGeo=new THREE.BoxGeometry(.08,.08,.08),pMat=new THREE.MeshBasicMaterial({toneMapped:false}),particles=new THREE.InstancedMesh(pGeo,pMat,MAXP);particles.frustumCulled=false;
 const pd=Array.from({length:MAXP},()=>({life:0,max:1,p:new THREE.Vector3(),v:new THREE.Vector3()}));let pNext=0;const m4=new THREE.Matrix4(),col=new THREE.Color(),zero=new THREE.Matrix4().makeScale(0,0,0);
 for(let i=0;i<MAXP;i++){particles.setMatrixAt(i,zero);particles.setColorAt(i,col.set(0xffffff))}
 function burst(pos,color,n=18,speed=3.2){for(let k=0;k<n;k++){const i=pNext,q=pd[i];pNext=(pNext+1)%MAXP;q.life=q.max=.5+Math.random()*.5;q.p.copy(pos);q.v.set((Math.random()-.5)*speed,Math.random()*speed*.9,(Math.random()-.5)*speed);particles.setColorAt(i,col.set(color))}particles.instanceColor.needsUpdate=true}
 let ring=null;
 function spawnMob(key,def,at,group){
  const st=STATS[def.look]||STATS.wisp,look=makeLook(def.look,def.color);at=freeSpot(at,st.r);look.group.position.set(at.x,st.y,at.z);group.add(look.group);
  const bar=makeBar();bar.position.y=(def.look==='shade'?2.3:def.look==='wisp'?.7:def.look==='paper'?1.7:1.3);look.group.add(bar);
  const m={key,def,look:def.look,...st,maxHp:st.hp,hp:st.hp,group:look.group,mats:look.mats,parts:look.parts,bar,pos:look.group.position,cd:1.5,retreat:0,flash:0,wrongCd:0,dying:0,spawn:{x:at.x,z:at.z},t:Math.random()*10};
  mobs.push(m);burst(new THREE.Vector3(at.x,1,at.z),def.color,14,2.2);return m;
 }
 function spawnBoss(def,at,group){
  at=freeSpot(at,1.3);const b=makeBoss(def.look,def.color);b.group.position.set(at.x,0,at.z);b.group.scale.setScalar(1.05);group.add(b.group);
  const bar=makeBar(2.2);bar.position.y=4.1;b.group.add(bar);
  const m={key:'boss',def,look:'boss',boss:true,phase:0,hp:BOSS_HP,maxHp:BOSS_HP,speed:1.0,r:1.25,y:0,dmg:10,retreat:0,group:b.group,mats:b.mats,parts:b.parts,bar,pos:b.group.position,cd:2,flash:0,wrongCd:0,dying:0,slam:3.2,spawn:{x:at.x,z:at.z},t:0};
  setCore(m);mobs.push(m);return m;
 }
 function setCore(m){const c=TOOL_COLOR[m.def.phases[Math.min(m.phase,m.def.phases.length-1)].tool];m.parts.coreMat.emissive.setHex(c)}
 function makeBar(w=.7){const g=new THREE.Group(),bg=new THREE.Mesh(new THREE.PlaneGeometry(w,.08),new THREE.MeshBasicMaterial({color:0x1a1210,transparent:true,opacity:.7,depthWrite:false})),fg=new THREE.Mesh(new THREE.PlaneGeometry(w,.06),new THREE.MeshBasicMaterial({color:0xffd36b,toneMapped:false,depthWrite:false}));fg.position.z=.001;g.add(bg,fg);g.userData={fg,w};return g}
 function waveSpawn(){
  const w=active.waves[active.wave];if(!w)return;let i=0;
  for(const {key,def,count} of w)for(let n=0;n<count;n++){const at=active.spawns[(i++ +active.wave*2)%active.spawns.length];spawnMob(key,def,{x:at.x+(Math.random()-.5)*.8,z:at.z+(Math.random()-.5)*.8},active.group)}
  events({type:'wave',index:active.wave,total:active.waves.length+(active.boss?1:0)});
 }
 function clearMobs(){for(const m of mobs)m.group.removeFromParent();mobs.length=0;for(const b of bolts){b.mesh.removeFromParent()}bolts.length=0;if(ring){ring.removeFromParent();ring=null}}
 function kill(m){m.dying=.35;burst(m.pos.clone().setY(m.boss?2:1),m.def.color??TOOL_COLOR.lamp,m.boss?60:22,m.boss?6:3.4);const first=!seen.has(m.key);seen.add(m.key);events({type:'kill',key:m.key,def:m.def,first,boss:!!m.boss})}
 function hit(m,t){
  if(m.dying)return;
  const need=m.boss?m.def.phases[m.phase].tool:m.def.tool;
  if(t!==need){if(m.wrongCd<=0){m.wrongCd=.9;floatText('Werkt niet',m.pos.clone().setY(m.boss?3.6:1.6),'#ff9a7a');events({type:'wrong',def:m.def,need,boss:!!m.boss})}m.flash=-.15;return}
  m.hp--;m.flash=.14;burst(m.pos.clone().setY(m.boss?2.2:1),TOOL_COLOR[t],8,2.4);floatText(m.boss?'Raak!':'−1',m.pos.clone().setY(m.boss?3.6:1.6),'#fff2c8');
  if(m.hp>0)return;
  if(m.boss&&m.phase<m.def.phases.length-1){
   m.phase++;m.hp=BOSS_HP;setCore(m);shake(.5);burst(m.pos.clone().setY(2.2),TOOL_COLOR[m.def.phases[m.phase].tool],40,5);
   events({type:'boss',phase:m.phase,tool:m.def.phases[m.phase].tool,line:m.def.phases[m.phase].line,name:m.def.name});
   for(let k=0;k<2;k++){const a=Math.random()*Math.PI*2;spawnMob(active.minion.key,active.minion.def,{x:m.pos.x+Math.cos(a)*2.4,z:m.pos.z+Math.sin(a)*2.4},active.group)}
   return;
  }
  kill(m);
 }
 // line of sight across the grid, so nothing is targeted through walls or pillars
 function sees(a,b){const dx=b.x-a.x,dz=b.z-a.z,n=Math.ceil(Math.hypot(dx,dz)/.4);for(let k=1;k<n;k++){const x=a.x+dx*k/n,z=a.z+dz*k/n;if(!isFree(x,z,.05))return false}return true}
 // A flow field: distance (in cells) from every free cell in the fight area to the player. Monsters walk downhill around pillars.
 let field=null,fieldT=0;
 function buildField(px,pz){
  const b=active.bounds,w=b.x1-b.x0,h=b.z1-b.z0,dist=new Int16Array(w*h).fill(-1),q=new Int32Array(w*h);let head=0,tail=0;
  const ok=(x,z)=>x>=0&&z>=0&&x<w&&z<h&&isFree(b.x0+x+.5,b.z0+z+.5,.3);
  const sx=Math.floor(px)-b.x0,sz=Math.floor(pz)-b.z0;if(sx<0||sz<0||sx>=w||sz>=h){field=null;return}
  dist[sz*w+sx]=0;q[tail++]=sz*w+sx;
  while(head<tail){const c=q[head++],x=c%w,z=(c/w)|0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(!ok(nx,nz))continue;const n=nz*w+nx;if(dist[n]!==-1)continue;dist[n]=dist[c]+1;q[tail++]=n}}
  field={b,w,h,dist};
 }
 function flow(m){
  if(!field)return null;const {b,w,h,dist}=field,cx=Math.floor(m.pos.x)-b.x0,cz=Math.floor(m.pos.z)-b.z0;let best=null,bd=1e9;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=w||z>=h)continue;const d=dist[z*w+x];if(d<0)continue;
   // no corner cutting past a blocked cell
   if(dx&&dz&&(dist[cz*w+x]<0||dist[z*w+cx]<0))continue;const cost=d+(dx&&dz?.4:0);if(cost<bd){bd=cost;best={x:b.x0+x+.5,z:b.z0+z+.5}}}
  if(!best)return null;const vx=best.x-m.pos.x,vz=best.z-m.pos.z,l=Math.hypot(vx,vz)||1;return {x:vx/l,z:vz/l};
 }
 function freeSpot(at,r){if(isFree(at.x,at.z,r))return at;for(let rr=.6;rr<4;rr+=.6)for(let k=0;k<12;k++){const a=k/12*Math.PI*2,x=at.x+Math.cos(a)*rr,z=at.z+Math.sin(a)*rr;if(isFree(x,z,r))return {x,z}}return at}
 function fire(){
  if(!active||fireCd>0||swap>0)return;fireCd=.32;kick=1;
  const t=TOOLS[tool],dir=new THREE.Vector3();camera.getWorldDirection(dir);const origin=camera.getWorldPosition(new THREE.Vector3()).add(dir.clone().multiplyScalar(.6)).add(new THREE.Vector3(0,-.15,0));
  // gentle aim assist: home in on the monster closest to the crosshair
  let target=null,best=.22;for(const m of mobs){if(m.dying)continue;const c=m.pos.clone().setY(m.boss?2:m.y+.6),to=c.clone().sub(origin),d=to.length();if(d>24||!sees(origin,c))continue;const ang=to.normalize().angleTo(dir);if(ang<best){best=ang;target=m}}
  const g=new THREE.Group(),core=new THREE.Mesh(boltGeo,boltMats[t]),halo=new THREE.Mesh(haloGeo,haloMats[t]);g.add(core,halo);g.position.copy(origin);active.group.add(g);
  bolts.push({mesh:g,pos:g.position,vel:dir.multiplyScalar(20),life:1.1,tool:t,target});
  events({type:'fire',tool:t});
 }
 function update(dt,t){
  fireCd=Math.max(0,fireCd-dt);kick=Math.max(0,kick-dt*6);swap=Math.max(0,swap-dt*5);
  const boss=mobs.find(m=>m.boss&&!m.dying);bossLight.intensity=boss?9:0;if(boss){bossLight.position.set(boss.pos.x,4.6,boss.pos.z+1.6);bossLight.color.set(boss.def.color).lerp(new THREE.Color(0xffffff),.5)}
  // view model
  tools.root.visible=!!active;
  if(active){const vm=tools.models[TOOLS[tool]];for(const [k,m] of Object.entries(tools.models))m.visible=k===TOOLS[tool];const pl=getPlayer();vm.position.set(Math.sin(pl.bob)*.012,-swap*.4+Math.abs(Math.cos(pl.bob))*.01,kick*.08);vm.rotation.set(-kick*.5,Math.sin(t*1.2)*.05,0)}
  // particles
  for(let i=0;i<MAXP;i++){const q=pd[i];if(q.life<=0)continue;q.life-=dt;q.v.y-=7*dt;q.p.addScaledVector(q.v,dt);const s=Math.max(0,q.life/q.max);m4.makeScale(s,s,s).setPosition(q.p);particles.setMatrixAt(i,q.life>0?m4:zero)}particles.instanceMatrix.needsUpdate=true;
  if(!active)return;
  const pl=getPlayer(),pp=new THREE.Vector3(pl.x,pl.y,pl.z);
  fieldT-=dt;if(fieldT<=0){fieldT=.35;buildField(pl.x,pl.z)}
  // bolts
  for(let i=bolts.length-1;i>=0;i--){const b=bolts[i];b.life-=dt;
   if(b.target&&!b.target.dying&&mobs.includes(b.target)){const want=b.target.pos.clone().setY(b.target.boss?2:b.target.y+.6).sub(b.pos).normalize().multiplyScalar(20);b.vel.lerp(want,Math.min(1,dt*7))}
   b.pos.addScaledVector(b.vel,dt);let gone=b.life<=0||!isFree(b.pos.x,b.pos.z,.05)||b.pos.y<.05;
   if(!gone)for(const m of mobs){if(m.dying)continue;const c=m.pos.clone().setY(m.boss?2:m.y+.55);if(c.distanceTo(b.pos)<m.r+(m.boss?.9:.32)){hit(m,b.tool);gone=true;break}}
   if(gone){burst(b.pos,TOOL_COLOR[b.tool],6,1.6);b.mesh.removeFromParent();bolts.splice(i,1)}}
  // monsters: only the nearest few may press in; the rest circle at a distance
  const near=mobs.filter(m=>!m.dying&&!m.boss).sort((a,b)=>Math.hypot(a.pos.x-pp.x,a.pos.z-pp.z)-Math.hypot(b.pos.x-pp.x,b.pos.z-pp.z)).slice(0,ATTACKERS);
  for(let i=mobs.length-1;i>=0;i--){const m=mobs[i];m.t+=dt;m.cd-=dt;m.wrongCd-=dt;m.retreat=Math.max(0,m.retreat-dt);
   if(m.dying){m.dying-=dt;m.group.scale.setScalar(Math.max(.01,1+(.35-m.dying)*2.2)*Math.max(0,m.dying/.35));if(m.dying<=0){m.group.removeFromParent();mobs.splice(i,1)}continue}
   const to=new THREE.Vector3(pp.x-m.pos.x,0,pp.z-m.pos.z),dist=to.length();to.normalize();
   const keep=active.peaceful?2.2:m.boss?2.4:near.includes(m)?m.r+.35:2.8;
   let sp=m.speed*(active.peaceful?.6:1);if(m.look==='slime')sp*=Math.max(0,Math.sin(m.t*5))*1.8;
   const dir=m.retreat>0?-.7:dist>keep?1:dist<keep-.6?-.4:0;
   // walk the flow field around obstacles; steer straight once the player is in plain sight and close
   let way=to;if(dir>0&&(dist>3||!sees(m.pos,pp))){const f=flow(m);if(f)way=new THREE.Vector3(f.x,0,f.z)}
   if(dir){const side=m.retreat>0||way!==to?0:Math.sin(m.t*.7+i)*.35,mx=(way.x+(-way.z)*side)*(dir>0?1:-Math.abs(dir)),mz=(way.z+way.x*side)*(dir>0?1:-Math.abs(dir));const nx=m.pos.x+mx*sp*dt,nz=m.pos.z+mz*sp*dt;if(isFree(nx,m.pos.z,m.r))m.pos.x=nx;if(isFree(m.pos.x,nz,m.r))m.pos.z=nz}
   for(const o of mobs){if(o===m||o.dying)continue;const dx=m.pos.x-o.pos.x,dz=m.pos.z-o.pos.z,d=Math.hypot(dx,dz),min=m.r+o.r;if(d>0&&d<min){const push=(min-d)*.5;const nx=m.pos.x+dx/d*push,nz=m.pos.z+dz/d*push;if(isFree(nx,nz,m.r)){m.pos.x=nx;m.pos.z=nz}}}
   m.group.rotation.y=Math.atan2(to.x,to.z);
   // animation per look
   if(m.look==='wisp'){m.pos.y=m.y+Math.sin(m.t*2.6)*.18;m.parts.orbit.rotation.y=m.t*3;m.parts.shell.scale.setScalar(1+Math.sin(m.t*5)*.08)}
   else if(m.look==='imp'){m.parts.wings.forEach((w,k)=>w.rotation.y=(k?-1:1)*(.6+Math.sin(m.t*22)*.5));m.pos.y=Math.abs(Math.sin(m.t*8))*.12}
   else if(m.look==='slime'){const sq=Math.sin(m.t*5);m.parts.body.scale.set(1+sq*.12,1-sq*.15,1+sq*.12);m.pos.y=Math.max(0,sq)*.25}
   else if(m.look==='shade'){m.pos.y=.1+Math.sin(m.t*1.8)*.08;m.parts.hem.scale.x=1+Math.sin(m.t*6)*.1}
   else if(m.look==='paper'){m.group.rotation.z=Math.sin(m.t*3)*.06;m.parts.top.rotation.y=Math.sin(m.t*2)*.3}
   else if(m.boss){m.parts.core.rotation.y=m.t*2;if(m.parts.bubbles)m.parts.bubbles.rotation.y=m.t*.6;if(m.parts.necks)m.parts.necks.forEach((n,k)=>{n.rotation.z=Math.sin(m.t*1.4+k*2)*.18;n.rotation.x=Math.sin(m.t*1.1+k)*.12});
    if(m.parts.armL){const swing=m.slam<1.2?(1.2-m.slam)*1.6:0;m.parts.armL.rotation.x=-swing+Math.sin(m.t*2)*.15;m.parts.armR.rotation.x=-swing-Math.sin(m.t*2)*.15}}
   // hit flash
   if(m.flash!==0){const red=m.flash<0;m.flash=red?Math.min(0,m.flash+dt):Math.max(0,m.flash-dt);for(const mt of m.mats){if(!mt.emissive)continue;mt.userData.base??=mt.emissive.getHex();mt.userData.ei??=mt.emissiveIntensity;if(m.flash!==0){mt.emissive.setHex(red?0xff3a2a:0xffffff);mt.emissiveIntensity=1.2}else{mt.emissive.setHex(mt.userData.base);mt.emissiveIntensity=mt.userData.ei}}}
   m.bar.quaternion.copy(camera.quaternion);m.bar.userData.fg.scale.x=Math.max(.001,m.hp/m.maxHp);m.bar.userData.fg.position.x=-(1-m.hp/m.maxHp)*m.bar.userData.w/2;
   // attacks
   if(!m.boss&&dist<m.r+.55&&m.cd<=0&&m.retreat<=0){m.cd=COOLDOWN;m.retreat=RETREAT;if(!active.peaceful)hurtPlayer(m.dmg,m.pos)}
   if(m.boss){m.slam-=dt;
    if(m.slam<1.2&&!ring&&dist<10){ring=new THREE.Mesh(new THREE.RingGeometry(.2,3.4,40),new THREE.MeshBasicMaterial({color:0xff5a3a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));ring.rotation.x=-Math.PI/2;ring.position.set(m.pos.x,.05,m.pos.z);active.group.add(ring)}
    if(ring){ring.position.set(m.pos.x,.05,m.pos.z);ring.material.opacity=Math.min(.55,(1.2-m.slam)*.5)}
    if(m.slam<=0){m.slam=5.2;shake(.6);burst(m.pos.clone().setY(.2),0xd9c8a0,30,5);if(ring){ring.removeFromParent();ring=null}if(dist<3.4&&!active.peaceful)hurtPlayer(16,m.pos)}
    if(dist<m.r+.6&&m.cd<=0){m.cd=COOLDOWN;if(!active.peaceful)hurtPlayer(m.dmg,m.pos)}}
  }
  // waves
  if(!mobs.some(m=>!m.dying)&&!mobs.length&&active.state==='fight'){
   active.wave++;
   if(active.wave<active.waves.length){active.state='pause';active.timer=1.4}
   else if(active.boss&&!active.bossDone){active.bossDone=true;active.state='pause';active.timer=1.6;active.spawnBoss=true}
   else{active.state='clear';const id=active.id;events({type:'clear',id})}
  }
  if(active.state==='pause'){active.timer-=dt;if(active.timer<=0){active.state='fight';if(active.spawnBoss){active.spawnBoss=false;spawnBoss(active.boss,active.bossAt,active.group);events({type:'bossIntro',def:active.boss,tool:active.boss.phases[0].tool});events({type:'wave',index:active.waves.length,total:active.waves.length+1})}else waveSpawn()}}
 }
 return {
  particles,
  burst,
  get active(){return active},
  get tool(){return TOOLS[tool]},
  start(spec){clearMobs();active={...spec,wave:0,state:spec.waves.length?'fight':'pause',timer:.8,spawnBoss:!spec.waves.length&&!!spec.boss,bossDone:!spec.waves.length&&!!spec.boss};spec.group.add(particles);if(spec.waves.length)waveSpawn();events({type:'tool',tool:TOOLS[tool]})},
  stop(){clearMobs();active=null},
  // After the player falls: restore the current wave so the fight can be retried without losing earlier progress.
  retry(){if(!active)return;const boss=mobs.find(m=>m.boss);for(const m of mobs)if(!m.boss)m.group.removeFromParent();for(let i=mobs.length-1;i>=0;i--)if(!mobs[i].boss)mobs.splice(i,1);if(boss){boss.hp=BOSS_HP;boss.pos.set(boss.spawn.x,0,boss.spawn.z);boss.slam=3.5}else if(active.state==='fight'){waveSpawn()}if(ring){ring.removeFromParent();ring=null}},
  setTool(i){if(i===tool)return;tool=(i+TOOLS.length)%TOOLS.length;swap=1;events({type:'tool',tool:TOOLS[tool]})},
  fire,update,
  aim(origin,dir){let best=null,bd=26;for(const m of mobs){if(m.dying)continue;const c=m.pos.clone().setY(m.boss?2:m.y+.6),to=c.clone().sub(origin),d=to.length();if(d>bd||!sees(origin,c))continue;const perp=to.clone().sub(dir.clone().multiplyScalar(to.dot(dir)));if(to.dot(dir)>0&&perp.length()<m.r+(m.boss?1:.35)){bd=d;best=m}}return best},
  get mobCount(){return mobs.filter(m=>!m.dying).length},
  get mobs(){return mobs}
 };
}
