// Chambers: a shared template (resident, decision table, three sources, door sign) plus a unique look and a hands-on trial.
import * as THREE from 'three';
import {boxGeo,labelTexture} from './kit.js';
import {CEILING} from './layout.js';
import {SEQUENCE_ORDER} from '../trials.cjs';

export const STATE_COLOR={blind:0xffd36b,open:0xffa64a,strong:0x7ff0a8};
// Each chamber tints its own walls so rooms are recognisable at a glance.
export const TINT={necessity:0xd8c08a,governance:0xc0655a,culture:0xe0a060,capacity:0xa8906a,infrastructure:0x8fb4d0,evaluation:0x7fb87a,quality:0x9584cc,interaction:0xe0a878,performance:0x7fa8c8,functionality:0x86b8a6,sustainability:0xd8784a,sovereignty:0xa088cc,ethics:0xd08e98,compliance:0x7f9cb0,security:0x6c6088};
const SKIN=[0xe2b48c,0xc68c62,0x8d5a3b,0xf0c9a5],HAIR=[0x3b2a1e,0x7a4b2a,0xd9c27a,0x2b2b2b,0xbfbfbf],HATS=['top','cone','band'];
const RING={idle:0x8a7a5a,active:0xffc35a,done:0x7ff0a8,wrong:0xff6a5a};
const PERSONAS=[{robe:0x6a5a8a,hair:0xbfbfbf,hat:'bun'},{robe:0x3e7e6a,hair:0x7a4b2a},{robe:0x9a3e3e,hair:0x2b2b2b,hat:'band'},{robe:0x4a6aa0,hair:0xd9c27a}];
const STAKEHOLDERS=[{robe:0x6a7fa8,hair:0xd8d8d8,hat:'bun',skin:0xf0c9a5},{robe:0x3e6e5a,hair:0x3b2a1e,skin:0xc68c62},{suit:true,robe:0x27304a,hair:0x2a2018,accent:0xe7c063}];

function layoutFor(id,slot){
 const base={npc:-(slot.along-1.4),table:-(slot.along-2.7),clues:[[-4.4,-5],[4.4,-5],[-4.4,5]],witness:[[-3.3,-1.4],[3.3,-1.4],[-3.3,2.6],[3.3,2.6]],gather:[[-4.5,1],[4.5,-1.6],[-2.2,5.4],[3.6,4.4]],bins2:[[-4.55,.8],[4.55,.8]],bins3:[[-4.5,-1.4],[4.5,-1.4],[4.5,2.6]],tray:[0,2.9],row:[[-3.6,.9],[-1.2,.9],[1.2,.9],[3.6,.9]],levers:[-2,-.6,.8,2.2],dial:4.1,fight:[-2.8,1.8]};
 const over={
  necessity:{clues:[[-6.5,-5.5],[6.5,-5.5],[-6.5,5.5]],witness:[[-3.9,.8],[3.9,.8],[-3.6,-4.6]]},
  governance:{bins3:[[-4.35,-1.7],[4.35,-1.7],[4.35,2.7]]},
  capacity:{gather:[[-4.4,-1.5],[4.75,-1.4],[-2.4,5.5],[4.55,4.5]]},
  quality:{row:[[-3.6,1.7],[-1.2,1.7],[1.2,1.7],[3.6,1.7]]},
  sustainability:{clues:[[-4.4,-5],[4.4,4.9],[-4.4,5]],bins3:[[-4.65,-2.3],[-4.65,.4],[-4.65,3.1]]},
  sovereignty:{gather:[[0,.5],[-4,-2.7],[4,-2.7],[3.6,4.3]]},
  ethics:{witness:[[-4.45,-1.5],[4.45,-1.5],[4.45,3]]}
 };
 return {...base,...over[id]};
}

export function buildChamber(b,def,slot,k){
 const {cx,cz,dirX,dirZ,along,across,level}=slot,px=-dirZ,pz=dirX,face=Math.atan2(dirX,dirZ),color=new THREE.Color(def.color),hex=color.getHex(),ceil=CEILING[def.id]||6;
 const P=(s,a)=>({x:cx+px*s+dirX*a,z:cz+pz*s+dirZ*a});
 const perpRy=Math.atan2(-pz,px),alongRy=Math.atan2(-dirZ,dirX),wallRy=side=>Math.atan2(-px*side,-pz*side),toward=(p,q)=>Math.atan2(q.x-p.x,q.z-p.z);
 const wall=(side,a,inset=0)=>P(side*(across-inset),a);
 const lay=layoutFor(def.id,slot);
 b.at(level);
 const c={b,def,slot,P,face,perpRy,alongRy,wallRy,toward,wall,lay,color,hex,ceil,across,along,updates:[],done:[],chamber:null};
 const chamber={id:def.id,slot,level,interact:[],clueItems:{},trial:null,update(t,dt,ctx){c.updates.forEach(f=>f(t,dt,ctx));this.trial?.update(t,dt,ctx)}};
 c.chamber=chamber;
 // resident behind the decision table
 const np=P(0,lay.npc),style=def.id==='necessity'?{robe:0x9a7a3a,hair:0xe8e0d0,hat:'cone',skin:0xf0c9a5}:{robe:color.clone().multiplyScalar(.75).getHex(),skin:SKIN[k%4],hair:HAIR[k%5],hat:HATS[k%3]};
 const npc=b.figure(np.x,np.z,face,style);
 chamber.npc={group:npc,marker:b.marker(np.x,2.55,np.z,STATE_COLOR.blind),baseYaw:face};
 chamber.interact.push({kind:'npc',id:def.id,box:new THREE.Box3(new THREE.Vector3(np.x-.45,0,np.z-.45),new THREE.Vector3(np.x+.45,2.3,np.z+.45)),label:`Praat met ${def.npc}`});
 if(def.id==='interaction'){
  // a long counter instead of a table
  const tp=P(0,lay.table-.1);b.box('wood',6.6,1.05,.7,tp.x,.525,tp.z,0x7a4e2e,perpRy);b.box('wood',6.8,.08,.9,tp.x,1.08,tp.z,0xa8784a,perpRy);b.collide(tp.x,tp.z,Math.abs(px)*6.7+Math.abs(dirX)*.8,Math.abs(pz)*6.7+Math.abs(dirZ)*.8);
  for(const s of [-2.3,2.3]){const p=P(s,lay.table-.1);b.box('plain',1.1,.7,.04,p.x,1.48,p.z,0xcfe6f0,perpRy)}
 }else{
  const tp=P(0,lay.table);b.table(tp.x,tp.z,perpRy,2.2,.9);b.box('plain',.5,.03,.36,tp.x,.935,tp.z,0xf0e2bd,perpRy);const cp=P(.75,lay.table);b.candles(cp.x,.92,cp.z);
 }
 // the three sources
 def.clues.forEach((clue,j)=>{const [s,a]=lay.clues[j],p=P(s,a),prop=b.sourceProp(j,p.x,p.z,hex);chamber.clueItems[clue.id]=prop;
  chamber.interact.push({kind:'clue',id:def.id,clue:clue.id,box:new THREE.Box3(new THREE.Vector3(p.x-.45,0,p.z-.45),new THREE.Vector3(p.x+.45,1.7,p.z+.45)),label:`Bekijk bron: ${clue.title}`})});
 // torches, banner, carpet
 const big=def.id==='necessity',dim=def.id==='security'?.55:1;
 const mood=new THREE.Color(TINT[def.id]||hex).lerp(new THREE.Color(0xffc080),.3).getHex();
 for(const side of [-1,1])for(const a of big?[-4,4]:[-2.6,2.4]){const p=wall(side,a);b.torch(p.x,p.z,-px*side,-pz*side,2.5,mood,dim)}
 for(const s of big?[-3,3]:[-2.6,2.6]){const p=P(s,-along);b.torch(p.x,p.z,dirX,dirZ,2.6,0xffa04a,dim)}
 const bp=P(0,-(along-.06));b.banner(bp.x,bp.z,face,def.color,def.group==='necessity'?'?':String(def.number).padStart(2,'0'));
 const c0=P(-1.1,lay.table+.7),c1=P(1.1,along-.2);b.carpet(c0.x,c0.z,c1.x,c1.z,color.clone().multiplyScalar(.45));
 // sign and status seal outside, above the doorway on the hall side
 if(!big){const o=P(0,along+3.02);
  b.sign(o.x,4.72,o.z,face,[def.title,def.place.toUpperCase()],{size:44,sub:20});
  const seal=b.add(new THREE.Mesh(new THREE.OctahedronGeometry(.2),new THREE.MeshBasicMaterial({color:STATE_COLOR.blind,toneMapped:false})));const sp=P(0,along+2.7);seal.position.set(sp.x,3.62,sp.z);seal.scale.set(1,1,.4);seal.rotation.y=face;chamber.seal=seal;
  b.box('wood',3.3,.22,.22,o.x+dirX*.1,4.24,o.z+dirZ*.1,0x5e3c22,face);
  // a coloured veil of mist marks a room the team has not discussed yet
  const veil=b.add(new THREE.Mesh(new THREE.PlaneGeometry(2.9,3.9),b.beamMat(hex,.5)));veil.material.side=THREE.FrontSide;const vp=P(0,along+1.5);veil.position.set(vp.x,1.95,vp.z);veil.rotation.y=face;chamber.veil=veil;
 }
 LOOKS[def.id]?.(c);
 chamber.trial=buildTrial(c);
 if(chamber.trial)chamber.trial.onDone=on=>c.done.forEach(f=>f(on));
 return chamber;
}

// ---------- trials ----------
function makeRing(c,x,z,r=.55){const m=c.b.add(new THREE.Mesh(new THREE.RingGeometry(r*.7,r,28),new THREE.MeshBasicMaterial({color:RING.idle,transparent:true,opacity:.25,toneMapped:false,side:THREE.DoubleSide,depthWrite:false})));m.rotation.x=-Math.PI/2;m.position.set(x,.035,z);return m}
function addItem(c,T,{x,z,h=1.8,part=null,glow=[],ring=true,r=.55,floaty=false,icon=false}){
 const it={index:T.items.length,x,z,part,glow,floaty,state:'idle',flash:0,target:null,home:part?part.position.clone():null,ring:ring?makeRing(c,x,z,r):null,
  box:new THREE.Box3(new THREE.Vector3(x-.5,0,z-.5),new THREE.Vector3(x+.5,h,z+.5)),icon:null};
 if(icon){it.icon=c.b.marker(x,h+.45,z,RING.active);it.icon.scale.set(.8,1.2,.8)}
 T.items.push(it);return it;
}
function buildTrial(c){
 const t=c.def.trial;if(!t)return null;
 const T={type:t.type,items:[],bins:[],levers:[],needle:null,gauge:0,gaugeShown:0,spawn:[],active:false,holding:null,complete:false,onDone:null,
  setActive(on){this.active=on;for(const it of this.items)if(['idle','active'].includes(it.state))it.state=on?'active':'idle'},
  set(i,state){const it=this.items[i];if(!it)return;if(state==='wrong'){it.flash=.6;return}it.state=state;if(state==='collect')it.collectT=0},
  hold(i){this.holding=i;this.items[i].state='held'},
  place(i,bin){const it=this.items[i],bn=this.bins[bin];it.state='placed';it.target=bn.drop(bn.count++);this.holding=null},
  putBack(i){const it=this.items[i];it.state='return';it.target=it.home.clone();this.holding=null},
  setLever(i,v){const l=this.levers[i];if(l)l.state=v},
  setGauge(v){this.gauge=v},
  finish(on=true){this.complete=on;if(on){this.active=false;for(const it of this.items){if(this.type==='gather'&&it.state!=='gone'){it.state='gone';if(it.part)it.part.visible=false}else if(this.type==='sort'&&it.state!=='placed'){const bn=this.bins[this.def.items[it.index].bin];it.state='placed';it.target=bn.drop(bn.count++)}else if(!['gone','placed'].includes(it.state))it.state='done'}}this.onDone?.(on)},
  reset(){this.complete=false;this.holding=null;this.bins.forEach(b=>b.count=0);for(const it of this.items){it.state=this.active?'active':'idle';it.target=null;if(it.part){it.part.visible=true;if(it.home)it.part.position.copy(it.home);it.part.scale.setScalar(1)}}this.levers.forEach((l,i)=>l.state=this.def.levers?.[i]?.start??0);this.onDone?.(false)},
  update(t,dt,ctx){
   for(const it of this.items){
    const pulse=.5+.5*Math.sin(t*4+it.index);
    if(it.flash>0)it.flash-=dt;
    if(it.ring){const st=it.flash>0?'wrong':it.state==='active'?'active':['done','lit'].includes(it.state)?'done':'idle';it.ring.visible=!['gone','placed','held','collect','return'].includes(it.state);it.ring.material.color.setHex(RING[st]);it.ring.material.opacity=st==='active'?.35+.4*pulse:st==='idle'?.18:.6}
    if(it.icon){it.icon.visible=it.state==='active'||it.state==='done';it.icon.material.color.setHex(it.state==='done'?RING.done:RING.active);it.icon.position.y=(it.box.max.y+.45)+Math.sin(t*2.4+it.index)*.08;it.icon.rotation.y=t*1.6}
    for(const m of it.glow){if(m.emissive)m.emissiveIntensity=it.flash>0?1.6:it.state==='active'?.4+.6*pulse:['done','lit','placed'].includes(it.state)?.9:.05;if(it.flash>0)m.emissive.setHex(RING.wrong);else m.emissive.setHex(['done','lit'].includes(it.state)?RING.done:m.userData.base??RING.active)}
    const p=it.part;if(!p)continue;
    // carried items shrink so they do not block the view
    if(it.state!=='collect'&&it.state!=='gone'){const want=it.state==='held'?.55:1;if(p.scale.x!==want){p.scale.setScalar(THREE.MathUtils.lerp(p.scale.x,want,Math.min(1,dt*8)));if(Math.abs(p.scale.x-want)<.01)p.scale.setScalar(want)}}
    if(it.state==='held'&&ctx.hold){p.position.lerp(ctx.hold,Math.min(1,dt*14));p.rotation.y+=dt*.8}
    else if(it.state==='collect'&&ctx.head){it.collectT+=dt;p.position.lerp(ctx.head,Math.min(1,dt*5));p.scale.setScalar(Math.max(.05,1-it.collectT*1.4));if(it.collectT>.75){p.visible=false;it.state='gone'}}
    else if(it.target&&['placed','return'].includes(it.state)){p.position.lerp(it.target,Math.min(1,dt*7));if(p.position.distanceTo(it.target)<.02){p.position.copy(it.target);if(it.state==='return'){it.state=this.active?'active':'idle';it.target=null}}}
    else if(it.floaty&&it.home&&!['gone','placed'].includes(it.state)){p.position.y=it.home.y+Math.sin(t*2+it.index)*.07;p.rotation.y=t*(it.state==='active'?1.2:.4)}
   }
   for(const l of this.levers){const want=l.state?-.75:.75;l.pivot.rotation.x+=(want-l.pivot.rotation.x)*Math.min(1,dt*10);l.knob.material.emissive.setHex(this.complete?0x206030:0x601810)}
   if(this.needle){this.gaugeShown+=(this.gauge-this.gaugeShown)*Math.min(1,dt*3);this.needle.rotation.z=Math.PI/2-this.gaugeShown*Math.PI}
   for(const bn of this.bins)if(bn.ring){bn.ring.visible=this.active&&this.holding!==null;bn.ring.material.opacity=.4+.3*Math.sin(t*5+bn.index)}
  }};
 T.def=t;
 const B={witness,gather,sort,judge,sequence,levers,fight}[t.type];B?.(c,t,T);
 return T;
}
function glowMat(color,base=RING.active){const m=new THREE.MeshStandardMaterial({color,emissive:base,emissiveIntensity:.05,roughness:.5});m.userData.base=base;return m}
function witness(c,t,T){
 const {b,P,toward,def}=c;
 t.witnesses.forEach((w,i)=>{
  const [s,a]=c.lay.witness[i],p=P(s,a),center=P(0,a<0?a+2:a-1);
  if(def.id==='ethics'){
   // listening horns on stands, turned towards the table
   const ry=toward(p,P(0,c.lay.table));const horn=b.horn(p.x,p.z,ry);horn.material.emissive=new THREE.Color(0x000000);horn.material.userData.base=0x8a6a2a;
   const wave=b.add(new THREE.Mesh(new THREE.TorusGeometry(.5,.025,6,28),new THREE.MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.6,toneMapped:false})));const fp=b.off(p.x,p.z,ry,0,1.15);wave.position.set(fp.x,2.1,fp.z);wave.rotation.y=ry;
   const it=addItem(c,T,{x:p.x,z:p.z,h:2.9,glow:[horn.material],icon:true,r:.7});
   c.updates.push(t2=>{const on=it.state==='active';wave.visible=on;const k=(t2*.8+i*.33)%1;wave.scale.setScalar(.6+k*1.2);wave.material.opacity=on?.6*(1-k):0});
   return;
  }
  const look=def.id==='necessity'?STAKEHOLDERS[i%3]:PERSONAS[i%4];
  const fig=b.figure(p.x,p.z,toward(p,center),{...look,skin:look.skin??SKIN[(i+1)%4]});
  const it=addItem(c,T,{x:p.x,z:p.z,h:2.2,icon:true});
  if(def.id==='culture'){
   // each persona keeps a lantern; it lights up once their story is heard
   const lp=b.off(p.x,p.z,toward(p,center),.75,-.15);b.shape('metal',new THREE.CylinderGeometry(.04,.05,1.5,6),0x3a3632,lp.x,.75,lp.z);
   const glass=b.add(new THREE.Mesh(boxGeo(.26,.34,.26),new THREE.MeshStandardMaterial({color:0xffe2a0,emissive:0xffb040,emissiveIntensity:.02,transparent:true,opacity:.85})));glass.position.set(lp.x,1.65,lp.z);
   b.box('metal',.32,.06,.32,lp.x,1.85,lp.z,0x2d2a28);
   const light=b.light(lp.x,1.7,lp.z,0xffb860,0,false);
   c.updates.push(()=>{const on=['done'].includes(it.state)||T.complete;glass.material.emissiveIntensity=on?2.2:.02;light.base=on?.55:0});
  }
  it.figure=fig;
 });
}
function gather(c,t,T){
 const {b,P,def}=c;
 t.items.forEach((g,i)=>{
  const [s,a]=c.lay.gather[i],p=P(s,a);let y=1.15,part;
  if(def.id==='sovereignty'){
   y=s===0&&a>-.6&&a<1.6?.9:1.1;part=new THREE.Group();const mat=glowMat(0xe8c060,0xffd060);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.04,6,16),mat);ring.position.y=.18;part.add(ring);const shaft=new THREE.Mesh(boxGeo(.05,.36,.05),mat);part.add(shaft);for(const [yy,w] of [[-.12,.12],[-.04,.08]]){const tooth=new THREE.Mesh(boxGeo(w,.05,.05),mat);tooth.position.set(w/2,yy,0);part.add(tooth)}
   part.userData.mats=[mat];
  }else{
   // rolled parchment with a ribbon
   part=new THREE.Group();const mat=glowMat(0xefe2c2,0xffc060);const roll=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.44,10),mat);roll.rotation.z=Math.PI/2;part.add(roll);const rib=new THREE.Mesh(boxGeo(.04,.18,.18),new THREE.MeshStandardMaterial({color:0xb03a2e}));part.add(rib);part.userData.mats=[mat];
   if(def.id==='capacity'&&i===0)y=1.2;
  }
  part.position.set(p.x,y,p.z);b.add(part);
  addItem(c,T,{x:p.x,z:p.z,h:1.9,part,glow:part.userData.mats,floaty:true,r:.45});
 });
}
function sort(c,t,T){
 const {b,P,toward,def,face}=c;
 const binsPos=t.bins.length===2?c.lay.bins2:c.lay.bins3;
 t.bins.forEach((bin,i)=>{
  const [s,a]=binsPos[i],p=P(s,a),ry=toward(p,P(0,a));let drop;
  if(def.id==='governance'){b.desk(p.x,p.z,ry,bin.label);drop=n=>{const q=b.off(p.x,p.z,ry,-.45+n*.3,-.05);return new THREE.Vector3(q.x,1.0,q.z)}}
  else if(def.id==='infrastructure'){
   if(i===0){const po=b.portal(p.x,p.z,ry,0xdff3ff,1.8,2.6);c.updates.push(t2=>{po.swirl.rotation.z=t2*.8;po.surf.material.opacity=.38+.12*Math.sin(t2*2)});b.cloud(p.x,3.3,p.z,.8)}
   else{b.box('metal',1.9,2.8,.3,p.x,1.4,p.z,0x5a6672,ry);const f=b.off(p.x,p.z,ry,0,.18);b.shape('metal',new THREE.TorusGeometry(.42,.06,8,20),0xc9a25e,f.x,1.5,f.z,ry);b.box('metal',.8,.08,.08,f.x,1.5,f.z,0xc9a25e,ry,0,0,.7);b.box('metal',.8,.08,.08,f.x,1.5,f.z,0xc9a25e,ry,0,0,-.7);b.collide(p.x,p.z,1,1)}
   const lp=b.off(p.x,p.z,ry,0,.35);b.card(lp.x,3.05,lp.z,ry,bin.label,'',1.6,.4,{w:420,h:104});
   drop=n=>{const q=b.off(p.x,p.z,ry,-.55+(n%3)*.55,.75);return new THREE.Vector3(q.x,.25+Math.floor(n/3)*.4,q.z)};
  }else{
   // sustainability: hoppers with a label, feeding pipes into the wall
   b.shape('metal',new THREE.CylinderGeometry(.6,.18,.9,12,1,true),0x8a7a62,p.x,1.35,p.z);b.shape('metal',new THREE.CylinderGeometry(.62,.62,.08,12),0x5a4a38,p.x,1.82,p.z);b.pipe(p.x,p.z,0,.9,.16);b.collide(p.x,p.z,1.1,1.1);
   const lp=b.off(p.x,p.z,ry,0,.7);b.card(lp.x,2.35,lp.z,ry,bin.label,'',1.3,.36,{w:380,h:104});
   drop=n=>new THREE.Vector3(p.x,1.5+n*.05,p.z);
  }
  T.bins.push({index:i,x:p.x,z:p.z,count:0,drop,ring:makeRing(c,p.x,p.z,.95),box:new THREE.Box3(new THREE.Vector3(p.x-.8,0,p.z-.8),new THREE.Vector3(p.x+.8,2.4,p.z+.8))});
 });
 // the items wait on a tray or cart in the front half of the room
 const [ts,ta]=c.lay.tray,tp=P(ts,ta);b.table(tp.x,tp.z,c.perpRy,2.6,.8,.8,def.id==='infrastructure'?0x6a5a48:0x8a5a36);
 t.items.forEach((item,i)=>{
  const p=P(-.95+i*.63,ta);let part;
  if(def.id==='governance'){part=new THREE.Group();const mat=glowMat(0x7a3020,0xffb050);const base=new THREE.Mesh(boxGeo(.22,.1,.16),mat);part.add(base);const handle=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.2,8),new THREE.MeshStandardMaterial({color:0x6b4a2e}));handle.position.y=.15;part.add(handle);const knob=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),handle.material);knob.position.y=.27;part.add(knob);part.userData.mats=[mat]}
  else if(def.id==='infrastructure'){part=new THREE.Group();const mat=glowMat([0xc09060,0xb04a3a,0xb04a3a,0xc09060][i]??0xc09060,0xffc060);const box=new THREE.Mesh(boxGeo(.36,.3,.3),mat);part.add(box);const band=new THREE.Mesh(boxGeo(.38,.06,.32),new THREE.MeshStandardMaterial({color:0x3a3632,metalness:.6}));part.add(band);part.userData.mats=[mat]}
  else{part=new THREE.Group();const mat=glowMat(0xf2ead6,0xffc060);const env=new THREE.Mesh(boxGeo(.34,.04,.24),mat);part.add(env);const flap=new THREE.Mesh(boxGeo(.3,.02,.12),new THREE.MeshStandardMaterial({color:0xd9c9a0}));flap.position.set(0,.03,-.04);flap.rotation.x=.3;part.add(flap);part.userData.mats=[mat]}
  part.position.set(p.x,.98,p.z);b.add(part);
  addItem(c,T,{x:p.x,z:p.z,h:1.5,part,glow:part.userData.mats,r:.32});
 });
}
function judge(c,t,T){
 const {b,P,toward,def}=c;
 t.items.forEach((item,i)=>{
  const [s,a]=c.lay.row[i],p=P(s,a),ry=toward(p,P(s,a+3));let glow=[];
  if(def.id==='evaluation'){
   // measuring poles with a tag
   b.box('wood',.12,2.2,.12,p.x,1.1,p.z,0xd9c8a0);for(let y=.3;y<2.1;y+=.3)b.box('plain',.2,.03,.13,p.x,y,p.z,0x3a2a1a);b.shape('plain',new THREE.CylinderGeometry(.3,.3,.06,10),0x5e3c22,p.x,.03,p.z);b.collide(p.x,p.z,.35,.35);
   const f=b.off(p.x,p.z,ry,0,.09);b.card(f.x,1.55,f.z,ry,item.title,'',.62,.4,{w:256,h:160});
   const tip=b.add(new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),glowMat(0xffe7a0)));tip.position.set(p.x,2.28,p.z);glow=[tip.material];
  }else if(def.id==='quality'){
   b.box('wood',.18,1.05,.18,p.x,.52,p.z,0x5e3c22);b.box('wood',.66,.06,.48,p.x,1.1,p.z,0x7a4e2e,ry,-.4);b.collide(p.x,p.z,.55,.55);
   const f=b.off(p.x,p.z,ry,0,.02);const cardM=b.card(f.x,1.16,f.z,ry,item.title,'',.56,.42,{w:256,h:192});cardM.rotation.order='YXZ';cardM.rotation.x=-Math.PI/2+.4;cardM.position.y=1.15;
   const orb=b.add(new THREE.Mesh(new THREE.OctahedronGeometry(.1),glowMat(0xc6b4ff,0xb48cff)));orb.position.set(p.x,1.55,p.z);glow=[orb.material];c.updates.push(t2=>{orb.rotation.y=t2*1.5;orb.position.y=1.55+Math.sin(t2*2+i)*.05});
  }else{
   // functionality: receipts on a spike
   b.box('metal',.08,1.2,.08,p.x,.6,p.z,0x5a5048);b.shape('metal',new THREE.CylinderGeometry(.28,.3,.08,10),0x3a3632,p.x,.04,p.z);b.collide(p.x,p.z,.4,.4);
   const f=b.off(p.x,p.z,ry,0,.06);b.card(f.x,1.12,f.z,ry,item.title,'',.48,.62,{w:200,h:256});
   const lamp=b.add(new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),glowMat(0xffe7a0)));lamp.position.set(p.x,1.48,p.z);glow=[lamp.material];
  }
  addItem(c,T,{x:p.x,z:p.z,h:1.9,glow,r:.5});
 });
}
function sequence(c,t,T){
 const {b,P,toward,def}=c;
 // steps are placed out of order; the label tells the player which step each one is
 SEQUENCE_ORDER.forEach((step,i)=>{
  const [s,a]=c.lay.row[i],p=P(s,a),ry=toward(p,P(s,a+3));let glow=[];
  if(def.id==='interaction'){const bell=b.bell(p.x,p.z);bell.mat.emissive=new THREE.Color(0);bell.mat.userData.base=0xffc060;glow=[bell.mat];c.updates.push(t2=>{const it=T.items.find(x=>x.step===step);bell.group.rotation.z=it?.state==='lit'?Math.sin(t2*9)*.08:0})}
  else{
   // compliance: archive drawers that slide open
   b.box('metal',.8,1.1,.6,p.x,.55,p.z,0x5f6b78,ry);b.collide(p.x,p.z,.85,.75);
   const drawer=b.add(new THREE.Mesh(boxGeo(.68,.3,.5),glowMat(0x7f8c9a,0xffc060)));const f=b.off(p.x,p.z,ry,0,.08);drawer.position.set(f.x,.78,f.z);drawer.rotation.y=ry;glow=[drawer.material];
   const home=drawer.position.clone(),o=b.off(p.x,p.z,ry,0,.42),open=new THREE.Vector3(o.x,.78,o.z);
   const lab=b.off(p.x,p.z,ry,0,.31);b.card(lab.x,.36,lab.z,ry,`Lade ${'ABCD'[i]}`,'',.5,.22,{w:200,h:88});
   c.updates.push((t2,dt)=>{const it=T.items.find(x=>x.step===step);const target=it&&(it.state==='lit'||it.state==='done')?open:home;drawer.position.lerp(target,Math.min(1,dt*8))});
  }
  const it=addItem(c,T,{x:p.x,z:p.z,h:1.7,glow,r:.5});it.step=step;
 });
}
function levers(c,t,T){
 const {b,wall,wallRy,lay}=c;
 t.levers.forEach((l,i)=>{const a=lay.levers[i],p=wall(-1,a,.06),ry=wallRy(-1),lv=b.lever(p.x,p.z,ry);
  const lab=b.off(p.x,p.z,ry,0,.08);b.card(lab.x,2.1,lab.z,ry,l.label,'',.7,.28,{w:280,h:100});
  T.levers.push({...lv,state:l.start});
  const q=wall(-1,a,.7);addItem(c,T,{x:q.x,z:q.z,h:2.2,r:.45});
 });
 const d=wall(-1,lay.dial,.04);T.needle=b.dial(d.x,2.3,d.z,wallRy(-1),c.def.trial.gauge);
}
function fight(c,t,T){
 const {b,P}=c,[s,a]=c.lay.fight,p=P(s,a);
 b.box('wood',.5,1.0,.5,p.x,.5,p.z,0x3a2a2a);b.box('wood',.8,.08,.6,p.x,1.05,p.z,0x4a3434,0,-.3);b.collide(p.x,p.z,.7,.7);
 const scroll=b.add(new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.6,10),new THREE.MeshStandardMaterial({color:0x3a2a4a,emissive:0x8a40ff,emissiveIntensity:1.4})));scroll.rotation.z=Math.PI/2;scroll.position.set(p.x,1.2,p.z);
 for(let k=0;k<14;k++)b.sparks.push([p.x+(b.r()-.5)*.6,1.25,p.z+(b.r()-.5)*.6,0xa060ff]);
 c.updates.push(t2=>{scroll.material.emissiveIntensity=T.complete?.2:1.2+.6*Math.sin(t2*5)});
 for(const [ds,da] of [[-1.2,-1.4],[1.6,-.6],[-1.6,1.4],[1.4,1.6]]){const q=P(s+ds,a+da);T.spawn.push({x:q.x,z:q.z})}
 const it=addItem(c,T,{x:p.x,z:p.z,h:1.6,glow:[scroll.material],r:.6});it.scroll=true;
}

// ---------- unique looks ----------
const LOOKS={
 necessity(c){
  const {b,P,ceil}=c,w=P(0,0);
  // the Well of Why with a floating question mark
  b.shape('stone',new THREE.CylinderGeometry(1.25,1.4,.75,20),0x8f8a80,w.x,.37,w.z);b.shape('plain',new THREE.CylinderGeometry(1.05,1.05,.05,20),0x2a5a7a,w.x,.72,w.z);b.collide(w.x,w.z,2.5,2.5);
  const qm=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0xffe0a0,toneMapped:false});
  const arc=new THREE.Mesh(new THREE.TorusGeometry(.42,.09,8,24,Math.PI*1.3),mat);arc.rotation.z=-Math.PI*.15;arc.position.y=.55;qm.add(arc);
  const stem=new THREE.Mesh(boxGeo(.16,.38,.16),mat);stem.position.set(.02,-.05,0);qm.add(stem);const dot=new THREE.Mesh(boxGeo(.17,.17,.17),mat);dot.position.y=-.5;qm.add(dot);
  qm.position.set(w.x,3.4,w.z);b.add(qm);b.light(w.x,2.2,w.z,0x9fd0ff,1.1,false);
  c.updates.push(t=>{qm.rotation.y=t*.5;qm.position.y=3.4+Math.sin(t*1.2)*.12});
  for(let k=0;k<16;k++)b.sparks.push([w.x+(b.r()-.5)*1.6,.9,w.z+(b.r()-.5)*1.6,0x9fd0ff]);
  // tall mirrors along the side walls
  for(const side of [-1,1])for(const a of [-1.5,5]){const p=c.wall(side,a,.08),ry=c.wallRy(side);b.box('wood',1.3,3,.12,p.x,1.7,p.z,0x8a6a2a,ry);const f=b.off(p.x,p.z,ry,0,.07);const m=b.add(new THREE.Mesh(new THREE.PlaneGeometry(1.05,2.7),new THREE.MeshStandardMaterial({color:0xa8bccc,metalness:1,roughness:.12})));m.position.set(f.x,1.7,f.z);m.rotation.y=ry}
  for(const [s,a] of [[7.4,6.5],[-7.4,6.5],[7.4,-6],[-7.4,-6]]){const p=P(s,a);b.barrel(p.x,p.z)}
 },
 governance(c){
  const {b,P,ceil,face,toward}=c;
  const th=P(0,-6.0);b.chair(th.x,th.z,face,0x8a2a2a,true);b.box('metal',.6,.12,.08,th.x,2.3,th.z,0xd9b25e,face);
  for(const [s,a] of [[-2.5,-4.6],[2.5,-4.6]]){const p=P(s,a);b.chair(p.x,p.z,toward(p,P(0,-3.8)),0x8a2a2a,true)}
  const bench=P(-4.8,3.4);b.box('wood',.6,.5,2.4,bench.x,.25,bench.z,0x6b4a2e,c.face);b.collide(bench.x,bench.z,Math.abs(c.slot.dirX)*2.4+.7,Math.abs(c.slot.dirZ)*2.4+.7);
  for(const [side,a,col] of [[-1,-3.5,0x6a4a8a],[1,-3.5,0x4a6a8a],[-1,.9,0x8a6a4a],[1,.9,0x4a7a5a]]){const p=c.wall(side,a,.05);b.portrait(p.x,2.9,p.z,c.wallRy(side),col)}
  const ch=P(0,-.4);b.chandelier(ch.x,ceil-1.4,ch.z);
 },
 culture(c){
  const {b,P}=c,t=P(3.6,4.7);b.roundTable(t.x,t.z,.65);for(let k=0;k<3;k++){const a=k*2.1,x=t.x+Math.cos(a)*.35,z=t.z+Math.sin(a)*.35;b.shape('plain',new THREE.CylinderGeometry(.16,.16,.03,12),0xf3f0e8,x,.88,z);for(let j=0;j<3;j++)b.shape('plain',new THREE.CylinderGeometry(.06,.06,.025,10),0xb07a3a,x+(b.r()-.5)*.12,.91+j*.02,z+(b.r()-.5)*.12)}
  const bd=c.wall(1,.6,.06);const tex=labelTexture(['AI-SPREEKUUR','WOENSDAG · MET KOEKJES'],{bg:'#24402e',border:'#e8e2c8',ink:'#f0ecd8',size:44,sub:22});const m=b.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2,.9),new THREE.MeshStandardMaterial({map:tex,roughness:.9})));m.position.set(bd.x,2.2,bd.z);m.rotation.y=c.wallRy(1);b.disposables.push(tex);
  for(const a of [-3,0,3]){for(let s=-4.6;s<=4.6;s+=.7){const p=P(s,a),sag=Math.cos(s/4.6*Math.PI/2)*.5;b.box('glow',.1,.1,.1,p.x,c.ceil-.5-sag,p.z,[0xffd27a,0xff9a7a,0x9ad0ff][Math.round((s+5)*1.4)%3])}}
  const rug=P(0,1.2);b.shape('plain',new THREE.CylinderGeometry(2.2,2.2,.03,20),0x8a4a3a,rug.x,.02,rug.z);
 },
 capacity(c){
  const {b,P,wall,wallRy,alongRy}=c;
  for(const [a,len] of [[-1.4,2.4],[2.3,1.8]]){const p=wall(1,a,.45);b.table(p.x,p.z,alongRy,len,.8,.9,0x7a5a3a);for(let k=0;k<3;k++){const q=b.off(p.x,p.z,alongRy,-len/2+.4+k*.6,0);b.box('metal',.18,.06,.06,q.x,1.0,q.z,0x8a8a92,b.r()*3)}}
  const g1=wall(1,-3.6,.04);b.gear(g1.x,2.6,g1.z,wallRy(1),.7);const g2=wall(-1,-3.4,.04);b.gear(g2.x,2.9,g2.z,wallRy(-1),.55);const g3=wall(-1,-4.6,.04);b.gear(g3.x,1.9,g3.z,wallRy(-1),.4,0x6a5a42);
  // the vendor's locked chest with the test results on top
  const ch=P(-4.4,-1.5),ry=wallRy(-1);b.box('wood',1.1,.75,.7,ch.x,.38,ch.z,0x6b3a22,ry);b.box('metal',1.14,.08,.74,ch.x,.62,ch.z,0x3a3632,ry);const lock=b.off(ch.x,ch.z,ry,0,.38);b.box('metal',.16,.2,.08,lock.x,.5,lock.z,0xd9b25e,ry);b.collide(ch.x,ch.z,1.1,1.1);
  for(const u of [-.3,.3]){const q=b.off(ch.x,ch.z,ry,u,0);b.box('metal',.06,.06,.78,q.x,.5,q.z,0x4a4540,ry)}
  // the living archive fills up once the scrolls are found
  const ar=wall(-1,2.3,.35);b.box('wood',1.6,2.2,.5,ar.x,1.1,ar.z,0x5a3e28,ry);b.collide(ar.x,ar.z,Math.abs(c.slot.dirX)*1.6+.6,Math.abs(c.slot.dirZ)*1.6+.6);const frame=b.add(new THREE.Mesh(boxGeo(1.7,.06,.56),new THREE.MeshBasicMaterial({color:0xffc060,toneMapped:false})));frame.position.set(ar.x,2.24,ar.z);frame.rotation.y=ry;
  const scrolls=new THREE.Group();for(let k=0;k<4;k++){const q=b.off(ar.x,ar.z,ry,-.5+k*.33,.05),m=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.4,10),new THREE.MeshStandardMaterial({color:0xefe2c2,emissive:0xffb040,emissiveIntensity:.5}));m.rotation.z=Math.PI/2;m.position.set(q.x,1.35,q.z);scrolls.add(m)}b.add(scrolls);scrolls.visible=false;
  const near=b.light(ar.x,1.8,ar.z,0xffc070,0,true);c.done.push(on=>{scrolls.visible=on;near.base=on?.6:0;frame.material.color.setHex(on?0x7ff0a8:0xffc060)});
  const crate=P(4.55,4.5);b.crate(crate.x,crate.z,.8,.2);
 },
 infrastructure(c){
  const {b,P,wall,wallRy}=c;
  for(const side of [-1,1]){const p=wall(side,-3.1,.4),ry=wallRy(side);b.box('metal',.9,2.4,.6,p.x,1.2,p.z,0x2c3038,ry);b.collide(p.x,p.z,.9,.9);for(let k=0;k<8;k++){const q=b.off(p.x,p.z,ry,-.3+(k%2)*.6,.31);b.box('glow',.06,.04,.02,q.x,.5+Math.floor(k/2)*.45,q.z,k%3?0x7ff0a8:0x9fd0ff,ry)}}
  for(const [s,a] of [[-2.5,-2],[2.8,1.5],[-1.5,4],[1,-4.2]]){const p=P(s,a);b.cloud(p.x,c.ceil-.8,p.z,.9)}
 },
 evaluation(c){
  const {b,P,wall,wallRy,alongRy}=c;
  for(const side of [-1,1]){for(const a of [-2.6,3.8]){const p=wall(side,a,.5);b.planter(p.x,p.z,alongRy,2.2,.8)}}
  const gp=P(0,2.6);b.box('plain',4.4,.02,2.2,gp.x,.012,gp.z,0x4f7a3e,c.perpRy);
  const ru=wall(1,1.2,.15),ry=wallRy(1);b.box('wood',.28,3.2,.06,ru.x,1.6,ru.z,0xe8d27a,ry,0,0,.08);for(let k=0;k<10;k++){const q=b.off(ru.x,ru.z,ry,0,.035);b.box('plain',.14,.025,.02,q.x,.2+k*.3,q.z,0x2a2018,ry)}
 },
 quality(c){
  const {b,P,wall,wallRy}=c;
  for(const side of [-1,1])for(const a of [-3.4,-1.4,3.6]){const p=wall(side,a,.3);b.bookshelf(p.x,p.z,wallRy(side),4.2,1.8)}
  const lad=wall(1,-2.4,.55);b.box('wood',.08,3.6,.08,lad.x,1.8,lad.z,0x6b4a2e);
  for(let k=0;k<14;k++){const p=P((b.r()-.5)*7,(b.r()-.5)*9);b.box('glow',.24,.05,.18,p.x,3.6+b.r()*3,p.z,[0xc6b4ff,0xffe0a0,0x9fd0ff][k%3],b.r()*3,.3)}
  // the oracle: a crystal head on a pedestal
  const o=P(0,-1.4);b.pedestal(o.x,o.z,1.0,0x6a6080);const head=b.add(new THREE.Mesh(new THREE.OctahedronGeometry(.36,0),new THREE.MeshStandardMaterial({color:0xb4a2ff,emissive:0x8a6aff,emissiveIntensity:.9,roughness:.2,metalness:.2})));head.position.set(o.x,1.55,o.z);
  b.light(o.x,2,o.z,0xb48cff,.9,false);c.updates.push(t=>{head.rotation.y=t*.7;head.position.y=1.55+Math.sin(t*1.3)*.06});
 },
 interaction(c){
  const {b,P,wall,wallRy}=c;
  const tm=P(4.3,4.6);b.box('plain',.6,1.5,.5,tm.x,.75,tm.z,0xc0392e,wallRy(1));b.box('glow',.36,.16,.02,tm.x,1.3,tm.z,0xffe07a,wallRy(1));b.collide(tm.x,tm.z,.7,.7);
  const bd=wall(-1,-1.2,.06);b.sign(bd.x,3.2,bd.z,wallRy(-1),['NU AAN DE BEURT','042 · 043 · 044'],{bg:'#1a1010',border:'#ff5a3c',ink:'#ff8a5c',size:44,sub:24},[2.4,.62]);
  for(let k=0;k<3;k++){const p=wall(1,2.4+k*.7,.45);b.chair(p.x,p.z,wallRy(1),0x3d5a7a)}
  const pl=P(-4.5,-1.6);b.plant(pl.x,pl.z,1.1);
 },
 performance(c){
  const {b,P,wall,wallRy}=c;
  for(const a of [-3.4,-2.6,-1.8]){const p=wall(1,a,.25);b.pipe(p.x,p.z,0,c.ceil,.16,0x8aa0b4);const glass=b.add(new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.2,10),new THREE.MeshStandardMaterial({color:0xcfe6f0,transparent:true,opacity:.35,roughness:.1})));glass.position.set(p.x,2,p.z)}
  const ph=wall(1,1.6,.2),ry=wallRy(1);for(let y=0;y<4;y++)for(let u=0;u<5;u++){const q=b.off(ph.x,ph.z,ry,-1+u*.5,0);b.box('wood',.46,.36,.3,q.x,.9+y*.4,q.z,0x6b4a2e,ry);if((u+y)%2)b.box('paper',.3,.06,.2,q.x,.82+y*.4,q.z,0xf2ead6,ry)}b.collide(ph.x,ph.z,Math.abs(c.slot.dirX)*2.6+.5,Math.abs(c.slot.dirZ)*2.6+.5);
  const piles=[[-3.4,-3.6],[3.5,-.2],[2.6,4.9],[-1.8,4.9],[1.6,-3]].map(([s,a])=>{const p=P(s,a);return b.paperPile(p.x,p.z,.5+b.r()*.5)});
  c.done.push(on=>piles.forEach(g=>g.scale.set(1,on?.25:1,1)));
 },
 functionality(c){
  const {b,P,wall,wallRy}=c;
  for(let k=0;k<6;k++){const p=wall(1,-3.2+k*1.3,.04);b.clock(p.x,2.2+(k%2)*.9,p.z,wallRy(1),.3+(k%3)*.06)}
  const cal=wall(-1,-1.2,.05);const tex=labelTexture(['AFSPRAKEN','MA · DI · WO · DO · VR'],{bg:'#f0e6cc',border:'#8a5a2c',ink:'#3a2a1a',size:42,sub:22});const m=b.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshStandardMaterial({map:tex,roughness:.9})));m.position.set(cal.x,2.4,cal.z);m.rotation.y=wallRy(-1);b.disposables.push(tex);
  for(let k=0;k<12;k++){const q=b.off(cal.x,cal.z,wallRy(-1),-1+(k%6)*.4,.02);b.box('plain',.3,.2,.01,q.x,1.95-Math.floor(k/6)*.26,q.z,k===4||k===9?0xd9573c:0xe8dcc0,wallRy(-1))}
  const g=wall(-1,3.4,.04);b.gear(g.x,2.4,g.z,wallRy(-1),.6);
 },
 sustainability(c){
  const {b,P,wall,wallRy,alongRy}=c;
  const f=wall(1,-.8,.7),ry=wallRy(1);b.box('brick',2.6,2.8,1.3,f.x,1.4,f.z,0x9a5a3a,ry);b.collide(f.x,f.z,Math.abs(c.slot.dirX)*2.6+1.4,Math.abs(c.slot.dirZ)*2.6+1.4);
  const mouthPos=b.off(f.x,f.z,ry,0,.66);const mouth=b.add(new THREE.Mesh(new THREE.PlaneGeometry(1.2,.9),new THREE.MeshBasicMaterial({color:0xff7a2a,toneMapped:false})));mouth.position.set(mouthPos.x,1.1,mouthPos.z);mouth.rotation.y=ry;
  const heat=b.light(mouthPos.x,1.3,mouthPos.z,0xff6a2a,1.6,false);for(let k=0;k<10;k++)b.embers.push([mouthPos.x+(b.r()-.5)*1,1.6,mouthPos.z]);
  b.pipe(f.x,f.z,2.8,c.ceil,.3,0x6a5a48);
  for(let k=0;k<12;k++){const q=P(2+b.r()*2,-1.8+b.r()*2);b.sparks.push([q.x,c.ceil-.6,q.z,0xd0d0d0])}
  for(const a of [-3.6,3.6]){const p=wall(-1,a,.2);b.pipe(p.x,p.z,0,c.ceil,.12)}
  c.done.push(on=>{mouth.material.color.setHex(on?0x8a3a1a:0xff7a2a);heat.base=on?.5:1.6});
 },
 sovereignty(c){
  const {b,P,wall,wallRy,slot}=c,pit=slot.pit;
  // glow from deep in the chasm, chains above it, rails at the bridge ends
  const mid=P(0,.5);const bottom=b.add(new THREE.Mesh(new THREE.PlaneGeometry(slot.dirX?2:10.6,slot.dirX?10.6:2),new THREE.MeshBasicMaterial({color:0x6a3aa8,toneMapped:false})));bottom.rotation.x=-Math.PI/2;bottom.position.set(mid.x,-5.9,mid.z);b.light(mid.x,-2.5,mid.z,0xa070ff,1.4,false);
  for(let k=0;k<20;k++){const q=P((b.r()-.5)*9,-.4+b.r()*1.8);b.sparks.push([q.x,-4.5+b.r()*3,q.z,0xb48cff])}
  for(const s of [-3.2,-1.6,1.8,3.4]){const q=P(s,.5);b.chain(q.x,c.ceil,c.ceil-2.2-b.r(),q.z)}
  for(const a of [-.75,1.75])for(const s of [-.62,.62]){const q=P(s,a);b.box('wood',.1,1.1,.1,q.x,.55,q.z,0x6b4a2e)}
  // a board with seven hooks: three keys hang already, four arrive with the trial
  const hb=wall(1,-3.8,.05),ry=wallRy(1);b.box('wood',2.6,.7,.08,hb.x,2.5,hb.z,0x5a3e28,ry);
  const later=new THREE.Group();for(let k=0;k<7;k++){const q=b.off(hb.x,hb.z,ry,-1.1+k*.37,.07);b.box('metal',.05,.12,.08,q.x,2.62,q.z,0x3a3632,ry);const key=new THREE.Mesh(boxGeo(.05,.3,.05),new THREE.MeshStandardMaterial({color:0xe8c060,emissive:0xffd060,emissiveIntensity:k<3?.2:.8,metalness:.6}));key.position.set(q.x,2.42,q.z);if(k<3)b.add(key);else later.add(key)}
  b.add(later);later.visible=false;c.done.push(on=>later.visible=on);
 },
 ethics(c){
  const {b,P,wall,wallRy,ceil}=c;
  for(const side of [-1,1])for(const a of [-3.6,.6,4.4]){const p=wall(side,a,.05);b.box('plain',.9,ceil-1.2,.04,p.x,(ceil-1.2)/2+1,p.z,0x8a3a4a,wallRy(side))}
  const ch=P(0,-2.6);b.chair(ch.x,ch.z,c.face+Math.PI,0x5a7a9a);
  const cl=P(0,0);b.chandelier(cl.x,ceil-1.6,cl.z,0xb0b8c8);
 },
 compliance(c){
  const {b,P,wall,wallRy}=c;
  for(const side of [-1,1])for(const a of [-3.4,-2.2])b.cabinet(...Object.values(wall(side,a,.35)),wallRy(side),1.1,2.6);
  for(const a of [3.2,4.4])b.cabinet(...Object.values(wall(1,a,.35)),wallRy(1),1.1,2.2,0x6a7684);
  const st=P(-4.4,2.7);b.pedestal(st.x,st.z,.8,0x7a7a82);b.shape('wood',new THREE.CylinderGeometry(.07,.09,.5,8),0x6b4a2e,st.x,1.1,st.z);b.box('metal',.5,.2,.36,st.x,.92,st.z,0x3a3632);b.box('plain',.46,.04,.32,st.x,.81,st.z,0xb03a2e);
  const cardP=b.off(st.x,st.z,wallRy(-1),0,.36);b.card(cardP.x,.52,cardP.z,wallRy(-1),'Goedgekeurd','proef 2023',.5,.3,{w:220,h:132});
  for(const [s,a] of [[3.6,-4.6],[-3.2,-4.4],[2.4,4.8]]){const p=P(s,a);b.paperPile(p.x,p.z,.4+b.r()*.4,.6)}
 },
 security(c){
  const {b,P,wall,wallRy}=c;
  for(const side of [-1,1])for(const a of [-3.4,-1.4,3.4]){const p=wall(side,a,.3);b.bookshelf(p.x,p.z,wallRy(side),3,1.8);const q=b.off(p.x,p.z,wallRy(side),0,.3);b.box('metal',1.7,.04,.04,q.x,1.5,q.z,0x6a6460,wallRy(side))}
  const kr=wall(1,1.4,.05);b.shape('metal',new THREE.TorusGeometry(.5,.05,8,24),0xc9a25e,kr.x,2.8,kr.z,wallRy(1));for(let k=0;k<9;k++){const a=k/9*Math.PI*2;b.box('metal',.05,.34,.05,kr.x,2.8+Math.sin(a)*.5-.1,kr.z,0xd9b25e,wallRy(1),0,a*.3)}
  const [s,a]=c.lay.fight;for(let k=0;k<6;k++){const p=P(s+Math.cos(k)*1.1,a+Math.sin(k)*1.1);b.box('glow',.3,.01,.06,p.x,.02,p.z,0x8a50ff,k)}
 }
};
