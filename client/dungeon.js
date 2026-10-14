// First-person voxel dungeon for "Het Gewelf": five depths and three arenas, chambers with hands-on trials, and fights.
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {rng,makeTextures,makeMaterials,boxGeo,fadeTexture,bannerTexture,SHADERS} from './world/kit.js';
import {buildLayout,OX,LEVELS,FOUNDATIONS,DOMAINS,PIT_DEPTH} from './world/layout.js';
import {Builder} from './world/props.js';
import {buildChamber,STATE_COLOR,TINT} from './world/chambers.js';
import {createCombat,TOOLS} from './world/combat.js';

const EYE=1.62,RADIUS=.32,REACH=3.4,MAX_HP=100;
// Each level has its own stone: warm cellar, blue question, ember arena, mossy foundations, green cellar, violet gallery, red threshold, golden seal.
const PALETTE=[
 {wall:0xc9b49a,floor:0xb7a58e,ceil:0x6d6258,fog:0x16110e,accent:0xffc884},
 {wall:0x93a3bb,floor:0x8f98a8,ceil:0x4f5868,fog:0x0d1119,accent:0x9fc3ff},
 {wall:0xb8906a,floor:0xa88e74,ceil:0x5a4434,fog:0x150d09,accent:0xffb070,amb:1.15,density:.042},
 {wall:0x9aae94,floor:0x9a9c86,ceil:0x515d4f,fog:0x0d130f,accent:0xc6e39a},
 {wall:0x86a08a,floor:0x7e9282,ceil:0x3e4e44,fog:0x09120d,accent:0x9fffc0,amb:1.15,density:.042},
 {wall:0xa89bbd,floor:0x9c94a9,ceil:0x564d66,fog:0x110e17,accent:0xd4b4ff},
 {wall:0xa0726a,floor:0x8e7068,ceil:0x4a3030,fog:0x140808,accent:0xff8a70,amb:1.15,density:.038},
 {wall:0xc4ae84,floor:0xb5a27e,ceil:0x5f5240,fog:0x15110a,accent:0xffd98a}
];
const VERDICT_COLOR=[0xe58b7a,0x8fb7ff,0xffd36b,0x7ff0a8];
const RESIDENT_LOOKS=[{robe:0x6a7fa8,hair:0xd8d8d8,hat:'bun',skin:0xf0c9a5},{robe:0x3a5a7a,hair:0x2b2b2b,skin:0xc68c62},{robe:0x7a4a6a,hair:0x7a4b2a,skin:0xe2b48c,hat:'band',accent:0xe7c063}];
const ARENA_SLOGANS=[['BINNEN 6 WEKEN LIVE!','GARANTIE*'],['100% NAUWKEURIG*','*IN DE DEMO'],['ALTIJD SNELLER','DAN UW TEAM'],['TEKEN HIER','EN KLAAR']];

export function createDungeon(canvas,{chambers:chamberDefs,onInteract=()=>{},onPrompt=()=>{},onLevel=()=>{},onRegion=()=>{},onLock=()=>{},onStep=()=>{},onCombat=()=>{},onArena=()=>{},onEvent=()=>{}}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.05,60);camera.rotation.order='YXZ';scene.add(camera);
 scene.fog=new THREE.FogExp2(PALETTE[0].fog,.058);scene.background=new THREE.Color(PALETTE[0].fog);
 const hemi=new THREE.HemisphereLight(0x9aa8c8,0x2a1d12,.75);scene.add(hemi);
 const tex=makeTextures(),mats=makeMaterials(tex),beamTex=fadeTexture();
 const beamMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,map:beamTex,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:false});
 const r=rng(42),groups=Array.from({length:LEVELS},()=>{const g=new THREE.Group();scene.add(g);return g});
 const G=buildLayout(),{I,isFloor,solid,floorY,ceilY,roomAt,regions,zones,spawns,returns}=G;
 const b=new Builder({mats,beamMat,r,groups});
 const disposables=[...Object.values(mats),...Object.values(tex),beamTex];

 // ---------- voxel shell, per level, tinted per chamber ----------
 const tints=regions.map(g=>g.kind==='chamber'?new THREE.Color(TINT[g.id]||0xffffff):null);
 const lists=groups.map(()=>({wall:[],floor:[],ceil:[]}));
 const tintOf=(x,z)=>{for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=G.W||nz>=G.H)continue;const k=roomAt[I(nx,nz)];if(k>=0&&!solid[I(nx,nz)]&&tints[k])return tints[k]}return null};
 for(let z=0;z<G.H;z++)for(let x=0;x<G.W;x++){
  const i=I(x,z),L=G.levelOfX(x);
  if(solid[i]){let lo=Infinity,hi=-Infinity;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(isFloor(x+dx,z+dz)){const j=I(x+dx,z+dz);lo=Math.min(lo,floorY[j]);hi=Math.max(hi,ceilY[j])}
   if(hi>-Infinity)for(let y=Math.floor(lo);y<Math.ceil(hi);y++)lists[L].wall.push([x,y,z])}
  else{lists[L].floor.push([x,z,floorY[i]]);lists[L].ceil.push([x,z,ceilY[i]]);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(isFloor(x+dx,z+dz)){const j=I(x+dx,z+dz);if(ceilY[j]>ceilY[i])for(let y=Math.floor(ceilY[i]);y<Math.ceil(ceilY[j]);y++)lists[L].wall.push([x,y,z])}}
 }
 const m4=new THREE.Matrix4(),col=new THREE.Color(),moss=new THREE.Color(0x5f7a45),cube=boxGeo(1,1,1);disposables.push(cube);
 const shellMat=map=>{const m=new THREE.MeshStandardMaterial({map,roughness:.95});disposables.push(m);return m};
 const wallMat=shellMat(tex.brick),floorMat=shellMat(tex.flag),ceilMat=shellMat(tex.rough);
 function instanced(mat,list,place,L){if(!list.length)return;const mesh=new THREE.InstancedMesh(cube,mat,list.length);list.forEach((v,k)=>{place(v,m4,col);mesh.setMatrixAt(k,m4);mesh.setColorAt(k,col)});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;groups[L].add(mesh)}
 lists.forEach((l,L)=>{const p=PALETTE[L];
  instanced(wallMat,l.wall,([x,y,z],m,c)=>{m.makeTranslation(x+.5,y+.5,z+.5);c.set(p.wall).multiplyScalar(.82+r()*.3);const t=tintOf(x,z);if(t)c.lerp(t,.58);if(y<1&&r()<.35)c.lerp(moss,.35);if(y<-1)c.multiplyScalar(.6)},L);
  instanced(floorMat,l.floor,([x,z,fy],m,c)=>{const h=fy===0?.2:fy+3.2,pit=fy<=PIT_DEPTH;m.compose(new THREE.Vector3(x+.5,pit?fy-.1:fy-h/2,z+.5),new THREE.Quaternion(),new THREE.Vector3(1,pit?.2:h,1));c.set(p.floor).multiplyScalar((.8+r()*.28)*(pit?.35:1));const t=tintOf(x,z);if(t&&!pit)c.lerp(t,.3)},L);
  instanced(ceilMat,l.ceil,([x,z,cy],m,c)=>{m.compose(new THREE.Vector3(x+.5,cy+.2,z+.5),new THREE.Quaternion(),new THREE.Vector3(1,.4,1));c.set(p.ceil).multiplyScalar(.75+r()*.35)},L);
 });

 // ---------- chambers ----------
 const defs=Object.fromEntries(chamberDefs.map(c=>[c.id,c]));
 const rooms={},interactables=[];
 const order=['necessity',...FOUNDATIONS.map(f=>f[0]),...DOMAINS.map(d=>d[0])];
 order.forEach((id,k)=>{const room=buildChamber(b,defs[id],G.chambers[id],k);rooms[id]=room;for(const it of room.interact)interactables.push({...it,level:room.level})});
 for(const room of Object.values(rooms)){const T=room.trial;if(!T)continue;
  T.items.forEach((it,i)=>interactables.push({kind:'trial',id:room.id,index:i,box:it.box,level:room.level,get label(){return room.labels?.items?.[i]||'Onderdeel van de proef'},enabled:()=>!T.complete&&!['done','gone','placed','held','collect','return'].includes(it.state)&&!(T.type==='sort'&&T.holding!==null)}));
  T.bins.forEach((bn,i)=>interactables.push({kind:'bin',id:room.id,index:i,box:bn.box,level:room.level,get label(){return `Leg neer bij: ${room.labels?.bins?.[i]||''}`},enabled:()=>T.holding!==null&&!T.complete}));
 }

 // ---------- 0 · De Ontvangsthal ----------
 b.at(0);let ox=OX[0];
 b.carpet(ox+24,15,ox+27,37.6,0x6e2a26);
 for(const z of [26,31.5,36]){b.torch(ox+18,z,1,0);b.torch(ox+33,z,-1,0)}
 const hallBanners=[b.banner(ox+21.5,20.06,0,'#8f3a30','D'),b.banner(ox+29.5,20.06,0,'#8f3a30','D')];
 for(const [x,z] of [[20,23],[30,23],[20,33],[30,33]])b.pillarDeco(ox+x+.5,z+.5,PALETTE[0].wall,6);
 b.box('wood',3,4,.2,ox+25.5,2,37.95,0x5a3a22);b.box('metal',.15,.15,.1,ox+26.1,1.8,37.8,0xc9a25e);
 b.crate(ox+19.2,36.2,.9,.3);b.crate(ox+19.4,35.1,.7,-.2);b.barrel(ox+31.6,36.3);b.barrel(ox+31.7,35.3);b.bookshelf(ox+18.4,28,Math.PI/2);b.bookshelf(ox+32.6,28,-Math.PI/2);
 const letterSpot={x:ox+25.5,z:27.5};let letter,letterBeam;
 {const {x:lx,z:lz}=letterSpot;b.box('wood',.5,1.1,.5,lx,.55,lz,0x6b4a2e);b.box('wood',.9,.1,.7,lx,1.18,lz,0x8a5a36,0,-.35);b.box('plain',.66,.03,.5,lx,1.25,lz,0xf4e7c4,0,-.35);b.box('stone',.4,.8,.4,lx+.75,.4,lz-.3,0x8d8a86);b.candles(lx+.75,.8,lz-.3);b.collide(lx+.75,lz-.3,.45,.45);
  letter=b.add(new THREE.Mesh(new THREE.PlaneGeometry(.5,.36),new THREE.MeshBasicMaterial({color:0xfff1c8,toneMapped:false})));letter.position.set(lx,1.29,lz);letter.rotation.x=-Math.PI/2+.35;
  letterBeam=b.add(new THREE.Mesh(new THREE.CylinderGeometry(.4,.55,4.6,12,1,true),beamMat(0xffd27a,.2)));letterBeam.position.set(lx,2.6,lz);
  b.collide(lx,lz,.9,.8);interactables.push({kind:'letter',id:'letter',level:0,box:new THREE.Box3(new THREE.Vector3(lx-.5,0,lz-.5),new THREE.Vector3(lx+.5,1.6,lz+.5)),label:'Lees de brief'});}
 b.sign(ox+25.5,5.45,20.02,0,['Het Gewelf','DAAL AF · DIEPTE 1'],{size:46,sub:20});
 // the vendor waits beside his golden shortcut, and the resident near the entrance
 const people={vendor:[],resident:[]};
 function vendorAt(L,fx,fz,ry,portalX,portalZ,portalRy){b.at(L);const fig=b.figure(fx,fz,ry,{suit:true,robe:0x2a3550,hair:0x1a1410,accent:0xe7c063,skin:0xf0c9a5});const folder=b.add(new THREE.Mesh(boxGeo(.36,.46,.06),new THREE.MeshStandardMaterial({color:0xe8c060,emissive:0xffc040,emissiveIntensity:.8,metalness:.6})));const fp=b.off(fx,fz,ry,.42,.12);folder.position.set(fp.x,1.05,fp.z);folder.rotation.y=ry;
  const po=b.portal(portalX,portalZ,portalRy,0xffd27a,1.8,2.8);b.light(portalX,1.8,portalZ,0xffc860,.9,false);
  const box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3((fx+portalX)/2,1.2,(fz+portalZ)/2),new THREE.Vector3(Math.abs(fx-portalX)+1.4,2.6,Math.abs(fz-portalZ)+1.4));
  const p={group:fig,folder,portal:po,level:L,baseYaw:ry};people.vendor.push(p);interactables.push({kind:'vendor',id:'vendor',level:L,box,get label(){return vendorLabel}});return p}
 let vendorLabel='Praat met Glans, de leverancier',residentLabel='Praat met de inwoner';
 vendorAt(0,ox+30.7,21.5,-Math.PI/2+.4,ox+32.98,21.6,-Math.PI/2);
 function residentAt(L,x,z,ry){b.at(L);const looks=RESIDENT_LOOKS.map(look=>{const g=b.figure(x,z,ry,look);g.visible=false;return g});b.colliders.pop();b.colliders.pop();looks[0].visible=true;
  people.resident.push({looks,level:L,baseYaw:ry,x,z});interactables.push({kind:'resident',id:'resident',level:L,box:new THREE.Box3(new THREE.Vector3(x-.45,0,z-.45),new THREE.Vector3(x+.45,2.2,z+.45)),get label(){return residentLabel}})}
 residentAt(0,ox+29.1,33.6,-Math.PI/2);

 // ---------- 1 · De Kamer van de Vraag ----------
 b.at(1);ox=OX[1];
 for(const z of [46.5,52.5])for(const s of [-1,1])b.torch(ox+26.5+s*1.5,z,-s,0,2.3);
 b.sign(ox+26.5,4.3,44,0,['De Kamer van de Vraag','DIEPTE 1'],{size:42,sub:20});
 b.sign(ox+36.98,4.2,33.5,-Math.PI/2,['Naar beneden','TUSSENKAMER I'],{size:40,sub:18});

 // ---------- arenas ----------
 const arenaState={},gates={};
 for(const [id,A] of Object.entries(G.arenas)){
  b.at(A.level);const ox2=OX[A.level],gx=(A.gate.x0+A.gate.x1)/2,theme=id==='a1'?0:id==='a2'?1:2;
  // portcullis at the exit; it rises once the arena is cleared or skipped
  const gate=new THREE.Group();for(let k=0;k<7;k++){const bar=new THREE.Mesh(boxGeo(.1,4.2,.1),new THREE.MeshStandardMaterial({color:0x3a3430,metalness:.7,roughness:.4}));bar.position.set(-1.35+k*.45,2.1,0);gate.add(bar)}for(const y of [.8,2.2,3.6]){const rail=new THREE.Mesh(boxGeo(3.1,.1,.12),new THREE.MeshStandardMaterial({color:0x2a2420,metalness:.7,roughness:.4}));rail.position.y=y;gate.add(rail)}
  gate.position.set(gx,0,A.gate.z);b.add(gate);const col=b.collide(gx,A.gate.z-.05,3.2,.3);gates[id]={gate,col,open:false,lift:0};
  arenaState[id]={done:false,armed:true,A};
  const cx=A.center.x,cz=A.center.z,w=A.x1-A.x0;
  for(const side of [-1,1])for(const dz of [-8,0,8]){const x=side<0?A.x0:A.x1,z=cz+dz;if(z<=A.z0+4||z>=A.z1-3)continue;b.torch(x,z,-side,0,2.8,theme===1?0x7fffb0:theme===2?0xff7050:0xffb060)}
  for(const [px,pz] of A.boss?[[22,21],[41,21],[22,40],[41,40]]:[[25,26],[38,26],[25,38],[38,38]])b.pillarDeco(ox2+px+1,pz+1,PALETTE[A.level].wall,A.boss?10:8);
  if(theme===0){
   // hype: posters on the pillars, gold confetti, braziers
   ARENA_SLOGANS.forEach(([t1,t2],k)=>{const [px,pz]=[[25,26],[38,26],[25,38],[38,38]][k];b.sign(ox2+px+1,2.6,pz+2.03,0,[t1,t2],{bg:'#5a1a14',border:'#ffd27a',ink:'#ffe8b0',size:40,sub:20},[1.9,.7])});
   for(let k=0;k<40;k++)b.sparks.push([A.x0+2+r()*(w-4),.5+r()*5,A.z0+2+r()*(A.z1-A.z0-4),[0xffd27a,0xff8a5c,0xfff1b8][k%3]]);
   for(const [x,z] of [[cx-6,cz+6],[cx+6,cz+6]]){b.box('metal',.8,.9,.8,x,.45,z,0x4a3a28);b.flames.push([x,1.2,z,1.6]);b.light(x,1.6,z,0xffa040,1.1,false);b.collide(x,z,.9,.9)}
   b.carpet(cx-1.5,A.z0,cx+1.5,A.z1+8,0x7a2a1a);
  }else if(theme===1){
   // leaks: pipes dripping green, puddles, a leaking barrel
   for(const x of [A.x0+.3,A.x1-.3])for(const dz of [-6,2,9]){b.pipe(x,cz+dz,0,8,.18,0x5a6a58);b.box('glow',.5,.02,.5,x+(x<cx?1:-1),.02,cz+dz+.6,0x5fff9a)}
   for(let k=0;k<10;k++){const x=A.x0+3+r()*(w-6),z=A.z0+3+r()*(A.z1-A.z0-6);b.box('glow',.6+r()*.8,.015,.5+r()*.8,x,.012,z,0x2aa860)}
   for(let k=0;k<30;k++)b.sparks.push([A.x0+2+r()*(w-4),.3+r()*6,A.z0+2+r()*(A.z1-A.z0-4),0x7fffb0]);
   b.barrel(cx-7,cz+8);b.barrel(cx+7.5,cz-7);
  }else{
   // the threshold: chains, a rune circle and two great braziers
   for(let k=0;k<10;k++){const x=A.x0+3+r()*(w-6),z=A.z0+3+r()*(A.z1-A.z0-6);b.chain(x,10,6+r()*2.5,z)}
   const rune=b.add(new THREE.Mesh(new THREE.RingGeometry(5.5,5.8,64),new THREE.MeshBasicMaterial({color:0xff6a4a,toneMapped:false,side:THREE.DoubleSide,transparent:true,opacity:.6})));rune.rotation.x=-Math.PI/2;rune.position.set(cx,.03,cz-4);
   for(const x of [cx-9,cx+9]){b.box('metal',1.1,1.2,1.1,x,.6,cz+8,0x3a2a22);b.flames.push([x,1.7,cz+8,2.2]);b.light(x,2.2,cz+8,0xff6040,1.4,false);b.collide(x,cz+8,1.2,1.2)}
   b.carpet(cx-1.5,A.z0,cx+1.5,A.z1+7,0x5a1a1a);
  }
  b.sign(gx,4.4,A.z1+.02,0,['Tussenkamer',''],{size:40,sub:18}).visible=false;
  A.spawns=A.boss?[[-6,-5],[6,-5],[-8,2],[8,2],[0,-9]].map(([dx,dz])=>({x:cx+dx,z:cz+dz})):[[-7,-7],[7,-7],[0,-9],[-9,0],[9,0],[-5,3],[5,3]].map(([dx,dz])=>({x:cx+dx,z:cz+dz}));
  A.bossAt={x:cx,z:cz-6};
 }

 // ---------- 3 · De Hal der Fundamenten ----------
 b.at(3);ox=OX[3];
 for(const z of [24,29,41,47,61]){b.pillarDeco(ox+27.5,z+.5,PALETTE[3].wall,6);b.pillarDeco(ox+33.5,z+.5,PALETTE[3].wall,6)}
 for(const z of [26.5,44,58.5,66.5]){b.torch(ox+26,z,1,0);b.torch(ox+35,z,-1,0)}
 b.carpet(ox+29,16,ox+32,68,0x2f4a2c);
 b.sign(ox+30.5,5.45,20.02,0,['De Hal der Fundamenten','DIEPTE 2'],{size:40,sub:20});
 b.crate(ox+27,66.5,.8,.4);b.crate(ox+33.8,21.2,.8,.1);
 vendorAt(3,ox+33.4,61.2,-Math.PI/2-.3,ox+34.98,63.2,-Math.PI/2);

 // ---------- 5 · De Galerij der Domeinen ----------
 b.at(5);ox=OX[5];
 for(const z of [59,46,33,20]){b.pillarDeco(ox+29.5,z+.5,PALETTE[5].wall,6);b.pillarDeco(ox+33.5,z+.5,PALETTE[5].wall,6)}
 for(const z of [61,48,35,22]){b.torch(ox+28,z,1,0);b.torch(ox+35,z,-1,0)}
 b.carpet(ox+30,8,ox+33,74,0x3d2d55);
 b.sign(ox+31.5,4.3,74,0,['De Galerij der Domeinen','DIEPTE 3'],{size:40,sub:20});
 b.sign(ox+31.5,5.45,10.02,0,['Naar De Drempel','TUSSENKAMER III'],{size:40,sub:20});

 // ---------- 7 · De Zegelkamer ----------
 b.at(7);ox=OX[7];
 const ac={x:ox+32.5,z:35};
 for(let t=0;t<3;t++)b.box('stone',6-t*1.6,.3,6-t*1.6,ac.x,.15+t*.3,ac.z,new THREE.Color(PALETTE[7].wall).multiplyScalar(.85-t*.08));
 b.box('stone',.9,1.2,.9,ac.x,1.5,ac.z,0xb59c70);b.box('metal',1.2,.12,1.2,ac.x,2.12,ac.z,0xc9a25e);b.collide(ac.x,ac.z,1.4,1.4);
 for(const [sx,sz] of [[-7,-7],[7,-7],[-7,7],[7,7]]){const x=ac.x+sx,z=ac.z+sz,ry=Math.atan2(-sx,-sz);b.box('stone',1.4,.6,1.4,x,.3,z,0x7e7466);b.box('stone',.9,2.4,.6,x,1.8,z,0xa9a08e,ry);b.box('stone',.5,.5,.5,x,3.25,z,0xb7ae9c,ry);b.box('stone',1.3,.2,.3,x,2.5,z,0x968d7b,ry);b.box('metal',.7,.22,.7,x,3.62,z,0x6b5a3a);b.flames.push([x,3.95,z,1.6]);for(let k=0;k<8;k++)b.embers.push([x,3.95,z]);b.light(x,4.3,z,0xffd98a,1.2,false);b.collide(x,z,1.4,1.4)}
 for(const [x,z,nx,nz] of [[ox+20,30,1,0],[ox+20,40,1,0],[ox+45,30,-1,0],[ox+45,40,-1,0],[ox+28,22,0,1],[ox+37,22,0,1]])b.torch(x,z,nx,nz,3.2,0xffc070);
 b.carpet(ox+31,30,ox+34,62,0x6a4a1c);
 b.sign(ox+32.5,4.9,48,0,['De Zegelkamer','DIEPTE 4 · HET BESLUIT'],{size:44,sub:20});
 interactables.push({kind:'altar',id:'verdict',level:7,box:new THREE.Box3(new THREE.Vector3(ac.x-1.2,0,ac.z-1.2),new THREE.Vector3(ac.x+1.2,3.6,ac.z+1.2)),label:'Raak het zegel aan en neem het besluit'});
 const seal=new THREE.Group();seal.position.set(ac.x,3.1,ac.z);b.add(seal);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.06,8,40),new THREE.MeshBasicMaterial({color:0xffd98a,toneMapped:false}));ring.rotation.x=Math.PI/2;seal.add(ring);
 const glyphs=VERDICT_COLOR.map(c=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.55}));seal.add(m);return m});
 const shaft=b.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2,2.6,10,20,1,true),beamMat(0xffe1a0,.22)));shaft.position.set(ac.x,6,ac.z);
 b.light(ac.x,3.4,ac.z,0xffe0a0,1.6,true);
 residentAt(7,ox+28.6,39.8,Math.atan2(ac.x-(ox+28.6),ac.z-39.8));
 let verdictChoice=-1,shaftBase=.22;
 // stair runes so the way on is readable from afar
 for(const zn of zones){b.at(zn.level);const cx=(zn.x0+zn.x1)/2,cz=(zn.z0+zn.z1)/2,down=zn.target>zn.level;
  const rune=b.add(new THREE.Mesh(new THREE.RingGeometry(.5,.62,24),new THREE.MeshBasicMaterial({color:down?0x9fd0ff:0xffd08a,toneMapped:false,side:THREE.DoubleSide,transparent:true,opacity:.85})));
  rune.rotation.x=-Math.PI/2;rune.position.set(cx,floorY[I(Math.floor(cx),Math.floor(cz))]+.03,cz);zn.rune=rune;
  b.light(cx,rune.position.y+1,cz,down?0x7fb6ff:0xffc070,.7,true);}
 b.finish();

 // flames, embers, dust, sparks
 const scaleU={value:1},timeU={value:0},camU={value:new THREE.Vector3()};
 function points(list,vertex,fragment,extra={},tinted=false){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(list.flatMap(p=>p.slice(0,3)),3));g.setAttribute('seed',new THREE.Float32BufferAttribute(list.map(()=>r()*10),1));g.setAttribute('size',new THREE.Float32BufferAttribute(list.map(p=>tinted?1:p[3]??1),1));
  if(tinted){const c=new THREE.Color();g.setAttribute('tint',new THREE.Float32BufferAttribute(list.flatMap(p=>c.set(p[3]??0xffffff).toArray()),3))}
  const m=new THREE.ShaderMaterial({uniforms:{time:timeU,scale:scaleU,...extra},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const p=new THREE.Points(g,m);p.frustumCulled=false;scene.add(p);disposables.push(g,m);return p}
 points(b.flames,SHADERS.flameVertex,SHADERS.flameFragment);points(b.embers,SHADERS.emberVertex,SHADERS.emberFragment);
 points(Array.from({length:420},()=>[r()*14,r()*6,r()*14]),SHADERS.dustVertex,SHADERS.dustFragment,{cam:camU});
 if(b.sparks.length)points(b.sparks,SHADERS.sparkVertex,SHADERS.sparkFragment,{},true);
 disposables.push(...b.disposables);

 // pooled lights follow the nearest lit torches on the current level
 const pool=Array.from({length:10},()=>{const l=new THREE.PointLight(0xffa04a,0,11,1.6);scene.add(l);return {light:l,torch:null}});
 const pip=new THREE.Group(),pipLight=new THREE.PointLight(0xffd8a0,2.2,8,1.8);
 {const pb=new Builder({mats,beamMat,r,groups:[pip]});pb.box('plain',.34,.3,.3,0,0,0,0x79a191);pb.box('plain',.36,.06,.32,0,.14,0,0xa8c2a3);pb.box('plain',.1,.07,.04,.16,.24,0,0xa4b37b);pb.box('plain',.12,.05,.02,0,-.08,.16,0x294b3d);pb.finish();
  for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.06,.08,.02),new THREE.MeshBasicMaterial({color:0xffe7a0,toneMapped:false}));eye.position.set(s*.08,.03,.16);pip.add(eye)}
  const halo=new THREE.Mesh(new THREE.SphereGeometry(.06,10,8),new THREE.MeshBasicMaterial({color:0xc8b080,toneMapped:false}));halo.position.set(0,-.26,0);pip.add(halo);
  pip.add(pipLight);pipLight.position.set(0,-.2,0);scene.add(pip)}

 // ---------- player ----------
 const player={x:spawns[0].x,z:spawns[0].z,y:0,vy:0,yaw:spawns[0].yaw,pitch:-.05,grounded:true,bob:0,level:0,region:null,hp:MAX_HP,hurtT:9,kx:0,kz:0,safe:null};
 const keys=new Set();let locked=false,paused=false,attract=true,dragging=null,focusTarget=null,fade=0,fadeDir=0,fadeThen=null,objective=null,path=[],pathTimer=0,aimed=null,aimedMob=null,lastPrompt='',stepAcc=0,disposed=false,frame=0,shakeT=0,hpSent=MAX_HP,fight=null;
 const overlay=canvas.parentElement,fadeEl=document.createElement('div');fadeEl.className='g-fade';overlay.append(fadeEl);
 const floats=[];
 function floatText(text,pos,color){const el=document.createElement('div');el.className='g-float';el.textContent=text;el.style.color=color;overlay.append(el);floats.push({el,pos:pos.clone(),t:0})}
 const cell=v=>Math.floor(v);
 const floorAt=(x,z)=>{const cx=cell(x),cz=cell(z);return isFloor(cx,cz)?floorY[I(cx,cz)]:99};
 const colliding=(x,z,rad)=>{for(const c of b.colliders)if(c.on&&c.level===player.level&&x>c.x0-rad&&x<c.x1+rad&&z>c.z0-rad&&z<c.z1+rad)return true;return false};
 function free(x,z,y,rad=RADIUS){
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cx=cell(x)+dx,cz=cell(z)+dz;const nx=Math.max(cx,Math.min(x,cx+1)),nz=Math.max(cz,Math.min(z,cz+1));if(Math.hypot(x-nx,z-nz)>=rad)continue;if(!isFloor(cx,cz)||floorY[I(cx,cz)]>y+.55)return false}
  return !colliding(x,z,rad);
 }
 // monsters avoid walls, props and the chasm
 const mobFree=(x,z,rad)=>{for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cx=cell(x)+dx,cz=cell(z)+dz;const nx=Math.max(cx,Math.min(x,cx+1)),nz=Math.max(cz,Math.min(z,cz+1));if(Math.hypot(x-nx,z-nz)>=rad)continue;if(!isFloor(cx,cz)||Math.abs(floorY[I(cx,cz)])>.5)return false}return !colliding(x,z,rad)};
 // Teleports land on the nearest free spot, so quick travel never traps the player inside a prop.
 function nearestFree(p){const L=G.levelOfX(p.x),prev=player.level;player.level=L;let out=p;if(!free(p.x,p.z,floorAt(p.x,p.z))){out=null;for(let rr=.5;rr<=3.5&&!out;rr+=.5)for(let k=0;k<16;k++){const a=k/16*Math.PI*2,x=p.x+Math.cos(a)*rr,z=p.z+Math.sin(a)*rr;if(free(x,z,floorAt(x,z))&&floorAt(x,z)>-1){out={...p,x,z};break}}}player.level=prev;return out||p}
 function place(p){p=nearestFree(p);player.x=p.x;player.z=p.z;player.yaw=p.yaw;player.pitch=-.05;player.y=floorAt(p.x,p.z);player.vy=0;player.kx=player.kz=0;player.safe=null;checkRegion();setLevel(G.levelOfX(p.x),true)}
 function setLevel(L,silent){if(L===player.level&&silent!==true)return;player.level=L;groups.forEach((g,i)=>g.visible=i===L);const p=PALETTE[L];scene.fog.color.set(p.fog);scene.fog.density=p.density??.058;scene.background.set(p.fog);hemi.intensity=p.amb??.75;hemi.color.set(p.accent).lerp(new THREE.Color(0x8090b0),.6);pathTimer=0;frame=0;onLevel(L)}
 function transition(fn){if(fadeDir)return;fadeDir=1;fadeThen=fn}
 function checkRegion(){const reg=regions.find(g=>player.x>g.x0&&player.x<g.x1&&player.z>g.z0&&player.z<g.z1)?.id||null;if(reg!==player.region){player.region=reg;onRegion(reg)}}
 function chamberEntry(id){const s=G.chambers[id],fx=Math.sin(rooms[id].npc.baseYaw),fz=Math.cos(rooms[id].npc.baseYaw),n=rooms[id].npc.group.position;return {x:s.cx+s.dirX*(s.along-1.2),z:s.cz+s.dirZ*(s.along-1.2),yaw:Math.atan2(fx,fz)}}
 function hurt(dmg,from){
  if(fight?.peaceful||fadeDir||player.hurtT<.8)return;player.hp=Math.max(0,player.hp-dmg);player.hurtT=0;shakeT=Math.max(shakeT,.25);onEvent({type:'hit',dmg});
  const dx=player.x-from.x,dz=player.z-from.z,d=Math.hypot(dx,dz)||1;player.kx=dx/d*5;player.kz=dz/d*5;
  if(player.hp<=0){onCombat({type:'down'});transition(()=>{player.hp=MAX_HP;combat.retry();if(fight?.kind==='arena')place(spawns[G.arenas[fight.id].level]);else if(fight)place(chamberEntry(fight.id))})}
 }
 const combat=createCombat({scene,camera,isFree:mobFree,getPlayer:()=>player,hurtPlayer:hurt,events:e=>{if(e.type==='clear'){const id=e.id;fight=null;setTimeout(()=>combat.stop(),900);onCombat(e);if(arenaState[id])openGate(id,true);return}onCombat(e)},floatText,shake:t=>{shakeT=Math.max(shakeT,t)}});
 function openGate(id,open){const g=gates[id];if(!g)return;g.open=open;g.col.on=!open;arenaState[id].done=open}

 // ---------- input ----------
 const typing=()=>/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
 const MOVE=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'];
 function onKey(e){
  if(e.type==='keyup'){keys.delete(e.code);return}
  if(typing()||paused||attract)return;
  if(MOVE.includes(e.code)){keys.add(e.code);if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault()}
  if(e.code==='Space'&&player.grounded){player.vy=4.6;player.grounded=false}
  if(e.repeat)return;
  // weapons: R draws or holsters, 1/2/3 picks one, Q cycles; while armed E and F attack
  const n=['Digit1','Digit2','Digit3'].indexOf(e.code);if(n>=0)combat.setTool(n);
  if(e.code==='KeyR')combat.setArmed(!combat.armed);
  if(e.code==='KeyQ'&&combat.armed)combat.setTool(TOOLS.indexOf(combat.tool)+1);
  if(e.code==='KeyF'){if(combat.armed)combat.fire();else combat.setArmed(true)}
  if(e.code==='KeyE'||e.code==='Enter'){if(combat.armed){e.preventDefault();combat.fire()}else if(aimed){e.preventDefault();interact()}}
 }
 function interact(){if(!aimed)return;const a=aimed;
  if(a.kind==='npc'){const n=rooms[a.id].npc;focusTarget=new THREE.Vector3(n.group.position.x,1.45,n.group.position.z)}
  else if(['letter','altar','clue','vendor','resident'].includes(a.kind)){focusTarget=a.box.getCenter(new THREE.Vector3());if(a.kind==='altar')focusTarget.y=2.7}
  else focusTarget=null;
  onInteract({kind:a.kind,id:a.id,clue:a.clue,index:a.index});
 }
 function onMouseMove(e){if(locked){player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-e.movementY*.0022))}else if(dragging){player.yaw-=(e.clientX-dragging.x)*.005;player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-(e.clientY-dragging.y)*.005));dragging={x:e.clientX,y:e.clientY}}}
 function onDown(e){if(paused||attract)return;if(locked){if(e.button===0){if(combat.armed)combat.fire();else interact()}return}
  if(e.pointerType==='mouse'&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{});}
  dragging={x:e.clientX,y:e.clientY,start:performance.now()}}
 function onUp(){if(dragging&&performance.now()-dragging.start<220&&!locked){if(combat.armed)combat.fire();else if(aimed)interact()}dragging=null}
 function onWheel(e){if(combat.armed&&!paused){combat.setTool(TOOLS.indexOf(combat.tool)+(e.deltaY>0?1:-1))}}
 function onLockChange(){locked=document.pointerLockElement===canvas;if(!locked)keys.clear();onLock(locked)}
 function onBlur(){keys.clear()}
 addEventListener('keydown',onKey);addEventListener('keyup',onKey);addEventListener('mousemove',onMouseMove);addEventListener('blur',onBlur);canvas.addEventListener('pointerdown',onDown);addEventListener('pointerup',onUp);canvas.addEventListener('wheel',onWheel,{passive:true});document.addEventListener('pointerlockchange',onLockChange);
 canvas.addEventListener('pointermove',e=>{if(!locked&&dragging&&e.pointerType!=='mouse')onMouseMove(e)});

 // ---------- guidance: Pip flies the shortest path to the objective ----------
 function targetPos(t){
  if(!t)return null;
  if(t.kind==='down'||t.kind==='up'){const zn=zones.find(z=>z.level===player.level&&(t.kind==='down'?z.target>z.level:z.target<z.level));return zn?{x:(zn.x0+zn.x1)/2,z:(zn.z0+zn.z1)/2,level:player.level}:null}
  if(t.kind==='letter')return {x:letterSpot.x,z:letterSpot.z+1,level:0};
  if(t.kind==='altar')return {x:ac.x,z:ac.z+2.2,level:7};
  if(t.kind==='gate'){const A=G.arenas[t.id];return {x:(A.gate.x0+A.gate.x1)/2,z:A.gate.z-2,level:A.level}}
  if(t.kind==='arena'){const A=G.arenas[t.id];return {x:A.center.x,z:A.center.z+6,level:A.level}}
  const room=rooms[t.id];if(!room)return null;
  if(t.kind==='trial'){const it=room.trial?.items[t.index];if(it)return {x:it.x,z:it.z,level:room.level}}
  if(t.kind==='bin'){const bn=room.trial?.bins[t.index];if(bn)return {x:bn.x,z:bn.z,level:room.level}}
  const g=room.npc.group,fx=Math.sin(room.npc.baseYaw),fz=Math.cos(room.npc.baseYaw);return {x:g.position.x+fx*2.4,z:g.position.z+fz*2.4,level:room.level};
 }
 function bfs(sx,sz,tx,tz){
  const start=I(sx,sz),goal=I(tx,tz);if(solid[start]||solid[goal])return [];
  const prev=new Int32Array(G.W*G.H).fill(-1),q=new Int32Array(G.W*G.H);let h=0,t=0;q[t++]=start;prev[start]=start;
  while(h<t){const c=q[h++];if(c===goal)break;const x=c%G.W,z=(c/G.W)|0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(!isFloor(nx,nz))continue;const n=I(nx,nz);if(prev[n]!==-1||floorY[n]<-3)continue;prev[n]=c;q[t++]=n}}
  if(prev[goal]===-1)return [];const out=[];for(let c=goal;c!==start;c=prev[c])out.push({x:c%G.W+.5,z:((c/G.W)|0)+.5});return out.reverse();
 }
 function updatePath(){let t=targetPos(objective);if(t&&t.level!==player.level)t=targetPos({kind:t.level>player.level?'down':'up'});path=t?bfs(cell(player.x),cell(player.z),cell(t.x),cell(t.z)):[]}

 // ---------- loop ----------
 const ray=new THREE.Raycaster(),clock=new THREE.Clock(),tmp=new THREE.Vector3(),fwd=new THREE.Vector3(),hold=new THREE.Vector3(),head=new THREE.Vector3();
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.62,.55,.82);composer.addPass(bloom);composer.addPass(new OutputPass());
 let inset=0,insetTarget=0,vw=1,vh=1;
 // A side panel shifts the view centre so the focused character stays visible beside it.
 function applyView(){if(inset<1){camera.clearViewOffset();camera.aspect=vw/vh}else{camera.aspect=(vw+inset)/vh;camera.setViewOffset(vw+inset,vh,inset,0,vw,vh)}camera.updateProjectionMatrix()}
 function resize(){const w=canvas.clientWidth||overlay.clientWidth,h=canvas.clientHeight||overlay.clientHeight;if(!w||!h)return;vw=w;vh=h;renderer.setSize(w,h,false);composer.setSize(w,h);applyView();scaleU.value=h*renderer.getPixelRatio()*.5}
 const ro=new ResizeObserver(resize);ro.observe(overlay);resize();
 function stepPlayer(dt){
  let mx=0,mz=0;const k=c=>keys.has(c);
  if(k('KeyW')||k('ArrowUp'))mz-=1;if(k('KeyS')||k('ArrowDown'))mz+=1;if(k('KeyA'))mx-=1;if(k('KeyD'))mx+=1;
  if(k('ArrowLeft'))player.yaw+=dt*2.1;if(k('ArrowRight'))player.yaw-=dt*2.1;
  const len=Math.hypot(mx,mz),run=k('ShiftLeft')||k('ShiftRight'),speed=run?5.6:3.6;
  let vx=player.kx*dt,vz=player.kz*dt;player.kx*=Math.max(0,1-dt*8);player.kz*=Math.max(0,1-dt*8);
  if(len>0){const s=Math.sin(player.yaw),c=Math.cos(player.yaw);vx+=(mx*c+mz*s)/len*speed*dt;vz+=(-mx*s+mz*c)/len*speed*dt;
   if(player.grounded){player.bob+=dt*speed*2.2;stepAcc+=dt*speed;if(stepAcc>1.55){stepAcc=0;onStep(run)}}}
  else player.bob*=.9;
  const fy=Math.max(player.y,floorAt(player.x,player.z));if(vx&&free(player.x+vx,player.z,fy))player.x+=vx;if(vz&&free(player.x,player.z+vz,fy))player.z+=vz;
  const ground=floorAt(player.x,player.z);
  if(!player.grounded){player.vy-=13*dt;player.y+=player.vy*dt;if(player.y<=ground){player.y=ground;player.vy=0;player.grounded=true}}
  else if(ground<player.y-.6){player.grounded=false;player.vy=0}
  else player.y=THREE.MathUtils.lerp(player.y,ground,Math.min(1,dt*12));
  if(player.grounded&&ground>-1)player.safe={x:player.x,z:player.z};
  // falling into the chasm: Pip pulls you back up
  if(player.y<-3.2&&!fadeDir){onEvent({type:'fall'});const id=player.region;transition(()=>place(id&&rooms[id]?chamberEntry(id):spawns[player.level]))}
  const zn=zones.find(z=>z.level===player.level&&player.x>z.x0&&player.x<z.x1&&player.z>z.z0&&player.z<z.z1);
  if(zn&&!fadeDir&&!fight)transition(()=>place(zn.target>zn.level?spawns[zn.target]:returns[zn.target]));
  checkRegion();
  // arenas wake up once the player steps inside
  for(const [id,s] of Object.entries(arenaState)){const A=s.A;if(A.level!==player.level)continue;const inside=player.x>A.x0&&player.x<A.x1&&player.z>A.z0&&player.z<A.entryZ;if(inside&&s.armed&&!s.done&&!fight){s.armed=false;onArena({type:'enter',id})}if(!inside&&player.z>A.entryZ+1)s.armed=true}
 }
 function updateLights(t){
  if(frame%12===0){camera.getWorldPosition(tmp);const near=b.torches.filter(tc=>tc.level===player.level&&tc.base>0).map(tc=>[tc,tc.pos.distanceToSquared(tmp)]).sort((a,c)=>a[1]-c[1]).slice(0,pool.length);pool.forEach((p,j)=>{p.torch=near[j]?.[0]||null;if(p.torch){p.light.position.copy(p.torch.pos);p.light.color.set(p.torch.color)}})}
  for(const p of pool){if(!p.torch){p.light.intensity=0;continue}const tc=p.torch,fl=tc.steady?1:.82+.12*Math.sin(t*11+tc.seed)+.06*Math.sin(t*23+tc.seed*2);p.light.intensity=THREE.MathUtils.lerp(p.light.intensity,7*tc.base*fl,.35)}
 }
 function updateAim(){
  aimed=null;aimedMob=null;if(paused||attract){if(lastPrompt){lastPrompt='';onPrompt('')}return}
  camera.getWorldDirection(fwd);ray.set(camera.position,fwd);let best=REACH;
  for(const it of interactables){if(it.level!==player.level||(it.enabled&&!it.enabled()))continue;const hit=ray.ray.intersectBox(it.box,tmp);if(hit){const d=hit.distanceTo(camera.position);if(d<best){best=d;aimed=it}}}
  if(!aimed&&!fight)for(const it of interactables){if(it.level!==player.level||(it.enabled&&!it.enabled()))continue;const c=it.box.getCenter(tmp);if(Math.hypot(c.x-player.x,c.z-player.z)<1.4){aimed=it;break}}
  if(combat.armed&&fight&&!aimed)aimedMob=combat.aim(camera.position,fwd);
  const text=aimed?aimed.label+(combat.armed?'#armed':''):aimedMob?`mob:${aimedMob.key}`:'';if(text!==lastPrompt){lastPrompt=text;onPrompt(aimed?{text:aimed.label,kind:aimed.kind,armed:combat.armed}:aimedMob?{mob:aimedMob.def,boss:!!aimedMob.boss,need:aimedMob.boss?aimedMob.def.phases[aimedMob.phase].tool:aimedMob.def.tool}:null)}
 }
 function updateNpcs(t,dt){
  for(const [id,room] of Object.entries(rooms)){if(room.level!==player.level)continue;const n=room.npc,g=n.group,dx=player.x-g.position.x,dz=player.z-g.position.z,dist=Math.hypot(dx,dz);
   if(dist<18){const want=dist<7?Math.atan2(dx,dz):n.baseYaw;let diff=want-g.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));g.rotation.y+=diff*Math.min(1,dt*3);g.position.y=Math.sin(t*1.6+id.length)*.025;n.marker.position.y=2.55+Math.sin(t*2+id.length)*.08;n.marker.rotation.y=t*1.4}
   for(const c of Object.values(room.clueItems)){c.beamOpacity??=c.beam.material.opacity;const bd=Math.hypot(c.beam.position.x-player.x,c.beam.position.z-player.z);c.beam.material.opacity=c.beamOpacity*THREE.MathUtils.smoothstep(bd,1.2,4);c.item.position.y=c.baseY+(c.read?0:Math.sin(t*2+c.kind)*.06);c.item.rotation.y=t*(c.read?.2:.9);c.item.material.emissiveIntensity=c.read?.15:1.1+.5*Math.sin(t*3+c.kind);c.beam.visible=!c.read}
   if(room.veil?.visible){const d=Math.hypot(room.veil.position.x-player.x,room.veil.position.z-player.z);room.veil.material.opacity=(.38+.1*Math.sin(t*1.5+id.length))*THREE.MathUtils.smoothstep(d,.8,3.5)}
   room.update(t,dt,{hold,head});
  }
  letterBeam.material.opacity=.2*THREE.MathUtils.smoothstep(Math.hypot(letterBeam.position.x-player.x,letterBeam.position.z-player.z),1.2,4);
  shaft.material.opacity=shaftBase*(.3+.7*THREE.MathUtils.smoothstep(Math.hypot(ac.x-player.x,ac.z-player.z),2.5,10));
  ring.rotation.z=t*.25;glyphs.forEach((g,k)=>{const a=t*.5+k*Math.PI/2,chosen=k===verdictChoice;g.position.set(chosen?0:Math.cos(a)*.9,chosen?Math.sin(t*1.5)*.1:Math.sin(t*1.3+k)*.12,chosen?0:Math.sin(a)*.9);g.rotation.set(t*.7,t*.9,0);g.scale.setScalar(chosen?1.9:1)});
  for(const v of people.vendor){if(v.level!==player.level)continue;v.portal.swirl.rotation.z=t*1.2;v.portal.surf.material.opacity=.45+.15*Math.sin(t*2.2);v.folder.position.y=1.05+Math.sin(t*2)*.04;const dx=player.x-v.group.position.x,dz=player.z-v.group.position.z;if(Math.hypot(dx,dz)<8){let d=Math.atan2(dx,dz)-v.group.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));v.group.rotation.y+=d*Math.min(1,dt*3)}}
  for(const g of Object.values(gates)){g.lift+=((g.open?3.8:0)-g.lift)*Math.min(1,dt*2.5);g.gate.position.y=g.lift}
 }
 const pipPos=new THREE.Vector3(spawns[0].x-1.4,2.5,spawns[0].z-2.4);
 function updatePip(t,dt){
  pathTimer-=dt;if(pathTimer<=0){updatePath();pathTimer=.45}
  let goal;
  if(attract)goal=new THREE.Vector3(spawns[0].x+Math.sin(t*.5)*2,2.3,26+Math.cos(t*.5)*2);
  else if(path.length>5&&!paused&&!fight){const p=path[Math.min(path.length-1,3)];goal=new THREE.Vector3(p.x,2.35+Math.sin(t*2.2)*.1+Math.max(0,floorAt(p.x,p.z)),p.z)}
  // otherwise Pip hovers high and to the side, and behind you during a fight
  else{const s=Math.sin(player.yaw),c=Math.cos(player.yaw),f=fight?-1.4:1.7,side=fight?.6:paused?-1.6:1.3;goal=new THREE.Vector3(player.x-s*f+c*side,player.y+(fight?2.6:2.15)+Math.sin(t*2.2)*.08,player.z-c*f-s*side)}
  pipPos.lerp(goal,Math.min(1,dt*2.4));pip.position.copy(pipPos);
  const look=path.length>5&&!paused?Math.atan2(goal.x-pip.position.x,goal.z-pip.position.z):Math.atan2(player.x-pip.position.x,player.z-pip.position.z);
  let diff=look-pip.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));pip.rotation.y+=diff*Math.min(1,dt*4);pip.rotation.z=Math.sin(t*1.7)*.08;
  pipLight.intensity=2.1+Math.sin(t*3.1)*.2;
 }
 function updateFloats(dt){for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.t+=dt;f.pos.y+=dt*.8;tmp.copy(f.pos).project(camera);if(f.t>1.1||tmp.z>1){f.el.remove();floats.splice(i,1);continue}f.el.style.transform=`translate(${(tmp.x*.5+.5)*vw}px,${(-tmp.y*.5+.5)*vh}px) translate(-50%,-50%)`;f.el.style.opacity=String(Math.min(1,(1.1-f.t)*2))}}
 function loop(){
  if(disposed)return;requestAnimationFrame(loop);frame++;
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;timeU.value=t;
  if(fadeDir){fade=Math.max(0,Math.min(1,fade+fadeDir*dt*2.6));fadeEl.style.opacity=fade;if(fade>=1&&fadeDir>0){fadeThen?.();fadeThen=null;fadeDir=-1}else if(fade<=0&&fadeDir<0)fadeDir=0}
  if(attract){const a=t*.08;player.x=spawns[0].x+Math.sin(a)*3.5;player.z=29+Math.cos(a)*5;player.y=.6;camera.position.set(player.x,player.y+EYE,player.z);camera.lookAt(spawns[0].x,1.5,27.5)}
  else{
   if(!paused)stepPlayer(dt);
   if(focusTarget&&paused){const dx=focusTarget.x-player.x,dz=focusTarget.z-player.z,wantYaw=Math.atan2(-dx,-dz),wantPitch=Math.atan2(focusTarget.y-(player.y+EYE),Math.hypot(dx,dz));let d=wantYaw-player.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));player.yaw+=d*Math.min(1,dt*3);player.pitch+=(wantPitch-player.pitch)*Math.min(1,dt*3)}
   shakeT=Math.max(0,shakeT-dt);const sh=shakeT>0?shakeT*.18:0;
   camera.position.set(player.x+(Math.random()-.5)*sh,player.y+EYE+Math.sin(player.bob)*.045+(Math.random()-.5)*sh,player.z+(Math.random()-.5)*sh);camera.rotation.set(player.pitch,player.yaw,Math.sin(player.bob*.5)*.006);
   // health returns slowly when nothing is attacking
   player.hurtT+=dt;if(player.hurtT>3&&player.hp<MAX_HP)player.hp=Math.min(MAX_HP,player.hp+8*dt);
   if(Math.abs(player.hp-hpSent)>=1||(player.hp===MAX_HP&&hpSent!==MAX_HP)){hpSent=Math.round(player.hp);onCombat({type:'hp',hp:hpSent,max:MAX_HP})}
  }
  camera.updateMatrixWorld();
  hold.set(.3,-.32,-.85).applyMatrix4(camera.matrixWorld);head.set(0,-.2,-.3).applyMatrix4(camera.matrixWorld);
  if(Math.abs(inset-insetTarget)>.5){inset+=(insetTarget-inset)*Math.min(1,dt*6);applyView()}
  camU.value.copy(camera.position);
  updateLights(t);updateNpcs(t,dt);updatePip(t,dt);updateAim();combat.update(paused?0:dt,t);updateFloats(dt);
  for(const zn of zones)if(zn.rune&&zn.level===player.level)zn.rune.material.opacity=.55+.3*Math.sin(t*2.4);
  composer.render();
 }
 place(spawns[0]);setLevel(0,true);requestAnimationFrame(loop);

 const api={
  setAttract(on){attract=on;if(!on)place(spawns[player.level]||spawns[0])},
  setPaused(on){paused=on;if(on){keys.clear();if(document.pointerLockElement===canvas)document.exitPointerLock()}else focusTarget=null},
  lock(){if(!attract&&!paused&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{})}},
  setObjective(t){objective=t;pathTimer=0},
  setInset(px){insetTarget=Math.max(0,Math.min(px,vw*.6))},
  setStatus(map){for(const [id,room] of Object.entries(rooms)){const s=map[id]||'blind',c=STATE_COLOR[s];room.npc.marker.material.color.set(c);room.seal?.material.color.set(c);if(room.veil)room.veil.visible=s==='blind'}},
  setVisited(id,list){const set=rooms[id]?.clueItems;if(!set)return;for(const [cid,c] of Object.entries(set))c.read=list.includes(cid)},
  setLetterRead(on){letterBeam.visible=!on},
  setVerdict(choice){verdictChoice=choice;const c=choice>=0?VERDICT_COLOR[choice]:0xffe1a0;shaft.material.color.set(c);ring.material.color.set(choice>=0?c:0xffd98a);shaftBase=choice>=0?.4:.22},
  // story: names on prompts, the resident's look and the emblem on the hall banners
  setStory({vendor,resident,storyIndex=0,emblem,labels={}}){
   vendorLabel=`Praat met ${vendor.name} van ${vendor.company}`;residentLabel=`Praat met ${resident.name}, ${resident.role}`;
   for(const p of people.resident)p.looks.forEach((g,i)=>g.visible=i===storyIndex%p.looks.length);
   if(emblem)for(const m of hallBanners){const old=m.material.map;m.material.map=bannerTexture('#8f3a30',emblem);m.material.needsUpdate=true;old?.dispose()}
   for(const [id,l] of Object.entries(labels))if(rooms[id])rooms[id].labels=l;
  },
  setLabels(map){for(const [id,l] of Object.entries(map))if(rooms[id])rooms[id].labels=l},
  goTo(target,instant){
   let p=null;
   if(typeof target==='number')p=spawns[target];
   else if(target==='verdict')p={x:ac.x,z:ac.z+5,yaw:0};
   else if(G.arenas[target])p=spawns[G.arenas[target].level];
   else if(rooms[target]){const n=rooms[target].npc,g=n.group,fx=Math.sin(n.baseYaw),fz=Math.cos(n.baseYaw);p={x:g.position.x+fx*4.4,z:g.position.z+fz*4.4,yaw:Math.atan2(fx,fz)};if(target==='sovereignty'||target==='quality')p=chamberEntry(target)}
   if(!p)return;if(instant)place(p);else transition(()=>place(p));
  },
  // trials
  trialActive(id,on){rooms[id]?.trial?.setActive(on)},
  trialItem(id,i,state){rooms[id]?.trial?.set(i,state)},
  trialHold(id,i){rooms[id]?.trial?.hold(i)},
  trialPlace(id,i,bin){rooms[id]?.trial?.place(i,bin)},
  trialPutBack(id,i){rooms[id]?.trial?.putBack(i)},
  trialLever(id,i,v){rooms[id]?.trial?.setLever(i,v)},
  trialGauge(id,v){rooms[id]?.trial?.setGauge(v)},
  trialFinish(id,on=true){const T=rooms[id]?.trial;if(!T)return;T.finish(on);if(on)combat.burst(new THREE.Vector3(player.x,1.6,player.z),0x7ff0a8,30,3)},
  trialReset(id){rooms[id]?.trial?.reset()},
  trialState(id){const T=rooms[id]?.trial;return T?{holding:T.holding,complete:T.complete,items:T.items.map(i=>i.state)}:null},
  // fights
  startFight(spec){
   const arena=G.arenas[spec.id],room=rooms[spec.id];
   const group=groups[arena?arena.level:room.level];
   const spawnsAt=arena?arena.spawns:room.trial.spawn;
   const reg=arena?{x0:arena.x0,x1:arena.x1,z0:arena.z0,z1:arena.z1+9}:(()=>{const g=regions.find(r=>r.id===spec.id);return {x0:g.x0-5,x1:g.x1+5,z0:g.z0-1,z1:g.z1+1}})();
   fight={...spec,kind:arena?'arena':'chamber'};
   combat.start({...spec,group,spawns:spawnsAt,bossAt:arena?.bossAt,bounds:{x0:Math.floor(reg.x0),x1:Math.ceil(reg.x1),z0:Math.floor(reg.z0),z1:Math.ceil(reg.z1)}});
  },
  stopFight(){fight=null;combat.stop()},
  setTool(i){combat.setTool(i)},
  fire(){combat.fire()},
  setArmed(on){combat.setArmed(on)},
  get armed(){return combat.armed},
  heal(n){player.hp=Math.min(MAX_HP,player.hp+n)},
  setArenaDone(id,done){if(arenaState[id]){openGate(id,done);arenaState[id].armed=!done}},
  get fighting(){return !!fight},
  get tool(){return combat.tool},
  get level(){return player.level},
  get region(){return player.region},
  get debug(){return {scene,bloom,composer,renderer,camera,rooms,combat,G,face(x,y,z){const dx=x-player.x,dz=z-player.z;player.yaw=Math.atan2(-dx,-dz);player.pitch=Math.atan2(y-(player.y+EYE),Math.hypot(dx,dz))}}},
  get player(){return {...player,camera:camera.position.toArray(),rotation:[camera.rotation.x,camera.rotation.y]}},
  dispose(){disposed=true;ro.disconnect();removeEventListener('keydown',onKey);removeEventListener('keyup',onKey);removeEventListener('mousemove',onMouseMove);removeEventListener('blur',onBlur);removeEventListener('pointerup',onUp);document.removeEventListener('pointerlockchange',onLockChange);disposables.forEach(d=>d.dispose?.());composer.dispose?.();renderer.dispose();fadeEl.remove();floats.forEach(f=>f.el.remove())}
 };
 return api;
}
