// Props for the dungeon. Static geometry is batched per level; anything that moves or changes gets its own mesh.
import * as THREE from 'three';
import {Batch,boxGeo,bannerTexture,labelTexture,cardTexture} from './kit.js';

export class Builder{
 constructor({mats,beamMat,r,groups}){
  Object.assign(this,{mats,beamMat,r,groups});
  this.batches=groups.map(()=>new Batch());this.L=0;
  this.colliders=[];this.torches=[];this.flames=[];this.embers=[];this.sparks=[];this.disposables=[];
 }
 at(L){this.L=L;return this}
 get batch(){return this.batches[this.L]}
 get group(){return this.groups[this.L]}
 add(obj){this.group.add(obj);obj.traverse?.(o=>{if(o.geometry)this.disposables.push(o.geometry);if(o.material)this.disposables.push(o.material)});return obj}
 collide(x,z,w,d){const c={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,level:this.L,on:true};this.colliders.push(c);return c}
 finish(){this.batches.forEach((b,i)=>b.build(this.mats,this.groups[i]))}
 box(key,w,h,d,x,y,z,color,ry=0,rx=0,rz=0){this.batch.box(key,w,h,d,x,y,z,color,ry,rx,rz)}
 shape(key,geo,color,x,y,z,ry=0,rx=0,rz=0){this.batch.add(key,geo,color,x,y,z,ry,rx,rz)}
 // Local frame helper: offsets along (u) and across (v) a rotation ry.
 off(x,z,ry,u,v){const c=Math.cos(ry),s=Math.sin(ry);return {x:x+c*u+s*v,z:z-s*u+c*v}}

 torch(x,z,nx,nz,y=2.5,color=0xffa04a,base=1){
  // x,z: point on the wall face; n: normal pointing into the room
  const ry=Math.atan2(nx,nz);
  this.box('metal',.12,.12,.28,x+nx*.12,y-.38,z+nz*.12,0x3b3430,ry);this.box('wood',.1,.5,.1,x+nx*.26,y-.22,z+nz*.26,0x7a5232,ry);
  this.box('metal',.18,.08,.18,x+nx*.26,y,z+nz*.26,0x2d2a28,ry);
  const fx=x+nx*.26,fz=z+nz*.26;this.flames.push([fx,y+.2,fz]);for(let k=0;k<5;k++)this.embers.push([fx,y+.25,fz]);
  const t={pos:new THREE.Vector3(fx+nx*.25,y+.35,fz+nz*.25),color,seed:this.r()*10,base,level:this.L};this.torches.push(t);return t;
 }
 light(x,y,z,color,base=1,steady=true){const t={pos:new THREE.Vector3(x,y,z),color,seed:this.r()*10,base,steady,level:this.L};this.torches.push(t);return t}
 pillarDeco(x,z,color,ceil){const c=new THREE.Color(color).multiplyScalar(.7);this.box('stone',1.2,.4,1.2,x,.2,z,c);this.box('stone',1.2,.4,1.2,x,ceil-.2,z,c)}
 crate(x,z,s=.8,ry=0,color=0xb08458){this.box('wood',s,s,s,x,s/2,z,color,ry);this.box('wood',s+.04,.08,s+.04,x,s*.15,z,0x6e4a2c,ry);this.box('wood',s+.04,.08,s+.04,x,s*.85,z,0x6e4a2c,ry);this.collide(x,z,s+.1,s+.1)}
 barrel(x,z){this.shape('wood',new THREE.CylinderGeometry(.36,.36,.95,10),0x9a6a40,x,.475,z);this.shape('metal',new THREE.CylinderGeometry(.375,.375,.07,10),0x3a3632,x,.2,z);this.shape('metal',new THREE.CylinderGeometry(.375,.375,.07,10),0x3a3632,x,.75,z);this.collide(x,z,.75,.75)}
 carpet(x0,z0,x1,z1,color){const [ax,bx]=[Math.min(x0,x1),Math.max(x0,x1)],[az,bz]=[Math.min(z0,z1),Math.max(z0,z1)];this.box('plain',bx-ax,.03,bz-az,(ax+bx)/2,.015,(az+bz)/2,color);this.box('plain',bx-ax-.3,.035,bz-az-.3,(ax+bx)/2,.017,(az+bz)/2,new THREE.Color(color).multiplyScalar(1.35))}
 bookshelf(x,z,ry,h=2.4,w=1.8){
  this.box('wood',w,h,.5,x,h/2,z,0x6b4a2e,ry);const rows=Math.max(1,Math.floor((h-.3)/.72)),n=Math.floor((w-.3)/.24);
  for(let shelf=0;shelf<rows;shelf++)for(let b=0;b<n;b++){const bh=.38+this.r()*.14,p=this.off(x,z,ry,-(w/2-.18)+b*.24,.06);this.box('plain',.18,bh,.34,p.x,.38+shelf*.72+bh/2,p.z,[0x8a3b2e,0x2e5a6e,0x6e5a2e,0x3e6e3a,0x5b3e6e][(b+shelf*2)%5],ry)}
  const c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry));this.collide(x,z,c*w+s*.5,s*w+c*.5);
 }
 banner(x,z,ry,color,glyph,y=3.1){const t=bannerTexture(color,glyph),m=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.2),new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.5,roughness:.9,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;this.add(m);this.disposables.push(t);this.box('metal',1.3,.08,.08,x,y+1.15,z,0x8a7040,ry);return m}
 sign(x,y,z,ry,lines,opts={},size=[2.6,.65]){const t=labelTexture(lines,opts),m=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshStandardMaterial({map:t,roughness:.7,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.18}));m.position.set(x,y,z);m.rotation.y=ry;this.add(m);this.disposables.push(t);return m}
 card(x,y,z,ry,title,body,w=.62,h=.46,opts){const t=cardTexture(title,body,opts),m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.8,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.12,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;this.add(m);this.disposables.push(t);return m}
 candles(x,y,z){for(let k=0;k<3;k++){const a=k*2.1,cx=x+Math.cos(a)*.13,cz=z+Math.sin(a)*.13,h=.14+k*.05;this.box('plain',.06,h,.06,cx,y+h/2,cz,0xf1e6c8);this.flames.push([cx,y+h+.05,cz,.35])}}
 table(x,z,ry,w=2.2,d=.9,h=.86,color=0x8a5a36){this.box('wood',w,.12,d,x,h,z,color,ry);for(const [u,v] of [[-w/2+.12,-d/2+.12],[w/2-.12,-d/2+.12],[-w/2+.12,d/2-.12],[w/2-.12,d/2-.12]]){const p=this.off(x,z,ry,u,v);this.box('wood',.12,h,.12,p.x,h/2,p.z,0x5e3c22)}const c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry));this.collide(x,z,c*w+s*d+.1,s*w+c*d+.1)}
 roundTable(x,z,r=.7,h=.82){this.shape('wood',new THREE.CylinderGeometry(r,r,.1,14),0x8a5a36,x,h,z);this.shape('wood',new THREE.CylinderGeometry(.1,.16,h,8),0x5e3c22,x,h/2,z);this.collide(x,z,r*1.5,r*1.5)}
 chair(x,z,ry,color=0x7a2e2a,high=false){const back=high?1.7:1.05;this.box('wood',.5,.08,.5,x,.48,z,0x6b4a2e,ry);const p=this.off(x,z,ry,0,-.22);this.box('wood',.5,back,.08,p.x,.48+back/2,p.z,0x5a3a22,ry);this.box('plain',.42,.06,.42,x,.54,z,color,ry);for(const [u,v] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){const q=this.off(x,z,ry,u,v);this.box('wood',.06,.48,.06,q.x,.24,q.z,0x4a301c)}this.collide(x,z,.55,.55)}
 desk(x,z,ry,label){this.table(x,z,ry,1.5,.8,.82,0x7a4e2e);const back=this.off(x,z,ry,0,-.75);this.chair(back.x,back.z,ry,0x3d4a6e);if(label){const f=this.off(x,z,ry,0,.36);this.card(f.x,1.02,f.z,ry,label,'',.9,.32,{w:320,h:112})}}
 plant(x,z,h=.9,color=0x4f8a46){this.shape('plain',new THREE.CylinderGeometry(.22,.17,.36,8),0x9a5a3a,x,.18,z);for(let k=0;k<5;k++){const a=k*1.3,lh=h*(.6+this.r()*.5);this.box('plain',.12,lh,.12,x+Math.cos(a)*.08,.36+lh/2,z+Math.sin(a)*.08,new THREE.Color(color).multiplyScalar(.8+this.r()*.4),a,.25*Math.cos(a),.25*Math.sin(a))}this.collide(x,z,.45,.45)}
 planter(x,z,ry,w=2.4,d=.8){this.box('wood',w,.5,d,x,.25,z,0x6b4a2e,ry);this.box('plain',w-.15,.06,d-.15,x,.5,z,0x3d2b1c,ry);for(let k=0;k<6;k++){const p=this.off(x,z,ry,-w/2+.3+k*(w-.6)/5,(this.r()-.5)*.3),h=.3+this.r()*.5;this.box('plain',.14,h,.14,p.x,.5+h/2,p.z,k%2?0x5e9a4e:0x7fb85c);if(k%2===0)this.box('glow',.12,.12,.12,p.x,.55+h,p.z,[0xff9ac2,0xffe07a,0xc6a8ff][k%3])}const c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry));this.collide(x,z,c*w+s*d,s*w+c*d)}
 cabinet(x,z,ry,w=1.1,h=2.2,color=0x5f6b78){this.box('metal',w,h,.6,x,h/2,z,color,ry);const rows=Math.floor(h/.5);for(let k=0;k<rows;k++){const p=this.off(x,z,ry,0,.31);this.box('metal',w-.12,.4,.02,p.x,.3+k*.5,p.z,new THREE.Color(color).multiplyScalar(1.25),ry);this.box('metal',.18,.05,.04,p.x,.36+k*.5,p.z+.0,0xd9c27a,ry)}const c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry));this.collide(x,z,c*w+s*.6,s*w+c*.6)}
 gear(x,y,z,ry,rad=.6,color=0x8a7a5a){const n=10;this.shape('metal',new THREE.CylinderGeometry(rad,rad,.12,16),color,x,y,z,ry,Math.PI/2);for(let k=0;k<n;k++){const a=k/n*Math.PI*2,p=this.off(x,z,ry,Math.cos(a)*(rad+.08),0);this.box('metal',.16,.16,.12,p.x,y+Math.sin(a)*(rad+.08),p.z,color,ry,0,a)}}
 clock(x,y,z,ry,rad=.35){this.shape('wood',new THREE.CylinderGeometry(rad+.05,rad+.05,.08,18),0x5a3a22,x,y,z,ry,Math.PI/2);const f=this.off(x,z,ry,0,.05);this.shape('plain',new THREE.CylinderGeometry(rad,rad,.04,18),0xf3ead2,f.x,y,f.z,ry,Math.PI/2);const h=this.off(x,z,ry,0,.08);const a=this.r()*6.28,b=this.r()*6.28;this.box('plain',.03,rad*.6,.02,h.x,y,h.z,0x2a2018,ry,0,a);this.box('plain',.03,rad*.85,.02,h.x,y,h.z,0x2a2018,ry,0,b)}
 chain(x,y0,y1,z){for(let y=y1;y<y0;y+=.18)this.box('metal',.08,.14,.04,x,y,z,0x4a4540,(y*3)%2?0:Math.PI/2)}
 pipe(x,z,y0,y1,rad=.14,color=0x7a6a52){this.shape('metal',new THREE.CylinderGeometry(rad,rad,y1-y0,10),color,x,(y0+y1)/2,z);this.shape('metal',new THREE.CylinderGeometry(rad+.05,rad+.05,.1,10),0x4a4038,x,y0+.2,z);this.shape('metal',new THREE.CylinderGeometry(rad+.05,rad+.05,.1,10),0x4a4038,x,y1-.2,z)}
 paperPile(x,z,h=.6,w=.7){const g=new THREE.Group();for(let y=0;y<h;y+=.06){const m=new THREE.Mesh(boxGeo(w-this.r()*.1,.05,w*.75-this.r()*.1),this.paperMat||(this.paperMat=new THREE.MeshStandardMaterial({color:0xf2ead6,roughness:.9})));m.position.set((this.r()-.5)*.08,y+.03,(this.r()-.5)*.08);m.rotation.y=(this.r()-.5)*.3;g.add(m)}g.position.set(x,0,z);this.add(g);return g}
 // Characters: a stack of voxel boxes merged into one mesh.
 figure(x,z,ry,{robe=0x8a6a3a,skin=0xe2b48c,hair=0x3b2a1e,hat=null,accent=0xe7c063,suit=false,scale=.86}={}){
  const g=new THREE.Group(),b=new Batch(),rb=new THREE.Color(robe),trim=rb.clone().lerp(new THREE.Color(0xffffff),.35);
  if(suit){b.box('plain',.22,.62,.22,-.13,.31,0,0x1e2433);b.box('plain',.22,.62,.22,.13,.31,0,0x1e2433);b.box('plain',.58,.66,.38,0,.95,0,rb);b.box('plain',.08,.4,.02,0,1.0,.2,accent);b.box('plain',.18,.12,.02,0,1.2,.2,0xf3f0e8)}
  else{b.box('plain',.62,1.05,.42,0,.62,0,rb);b.box('plain',.66,.12,.46,0,.2,0,trim)}
  b.box('plain',.5,.42,.36,0,1.32,0,rb);b.box('plain',.16,.62,.16,-.38,1.12,0,rb);b.box('plain',.16,.62,.16,.38,1.12,0,rb);b.box('plain',.14,.14,.14,-.38,.76,0,skin);b.box('plain',.14,.14,.14,.38,.76,0,skin);
  b.box('plain',.42,.42,.4,0,1.76,0,skin);b.box('plain',.46,.14,.44,0,2.02,0,hair);b.box('plain',.08,.07,.02,-.1,1.79,.205,0x1a1410);b.box('plain',.08,.07,.02,.1,1.79,.205,0x1a1410);
  if(hat==='top'){b.box('plain',.58,.06,.58,0,2.11,0,trim);b.box('plain',.36,.3,.36,0,2.29,0,rb)}else if(hat==='cone'){b.add('plain',new THREE.ConeGeometry(.3,.62,6),rb,0,2.38,0)}else if(hat==='band'){b.box('plain',.5,.08,.06,0,2.08,.2,accent)}else if(hat==='bun'){b.box('plain',.22,.2,.22,0,2.18,-.1,hair)}
  b.build({plain:this.mats.plain},g);g.scale.setScalar(scale);g.position.set(x,0,z);g.rotation.y=ry;this.add(g);this.collide(x,z,.7,.7);return g;
 }
 marker(x,y,z,color){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color,toneMapped:false}));m.scale.set(1,1.5,1);m.position.set(x,y,z);this.add(m);return m}
 sourceProp(kind,x,z,color){
  // A pedestal plus a floating, glowing item. Unread items glow; read items rest.
  this.box('stone',.62,.9,.62,x,.45,z,0x8d8a86);this.box('stone',.78,.12,.78,x,.96,z,0xa7a39c);this.box('stone',.78,.12,.78,x,.06,z,0x77736d);
  let geo;if(kind===0)geo=boxGeo(.42,.1,.32);else if(kind===1){geo=new THREE.CylinderGeometry(.07,.07,.46,8);geo.rotateZ(Math.PI/2)}else geo=new THREE.OctahedronGeometry(.17);
  const item=this.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:kind===0?0x8b3d2c:kind===1?0xe8dcb5:color,emissive:color,emissiveIntensity:1.4,roughness:.4})));item.position.set(x,1.3,z);
  const beam=this.add(new THREE.Mesh(new THREE.CylinderGeometry(.32,.45,3.6,12,1,true),this.beamMat(color,.32)));beam.position.set(x,2.2,z);
  this.collide(x,z,.8,.8);return {item,beam,baseY:1.3,read:false,kind};
 }
 pedestal(x,z,h=.95,color=0x8d8a86){this.box('stone',.5,h,.5,x,h/2,z,color);this.box('stone',.64,.1,.64,x,h,z,new THREE.Color(color).multiplyScalar(1.15));this.collide(x,z,.6,.6)}
 lever(x,z,ry){
  // Wall-mounted lever; returns the pivot so the handle can be thrown.
  this.box('metal',.5,.7,.12,x,1.3,z,0x4a4038,ry);const pivot=new THREE.Group();pivot.position.set(x,1.3,z);pivot.rotation.y=ry;
  const f=new THREE.Mesh(boxGeo(.08,.6,.08),new THREE.MeshStandardMaterial({color:0x8a7a5a,metalness:.6,roughness:.4}));f.position.set(0,.3,.12);pivot.add(f);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),new THREE.MeshStandardMaterial({color:0xc9402e,emissive:0x601810,roughness:.4}));knob.position.set(0,.62,.12);pivot.add(knob);
  this.add(pivot);return {pivot,knob};
 }
 dial(x,y,z,ry,label){
  const face=this.add(new THREE.Mesh(new THREE.CircleGeometry(.55,32),new THREE.MeshStandardMaterial({color:0xf0e6cc,roughness:.6,emissive:0x302010})));face.position.set(x,y,z);face.rotation.y=ry;
  const ring=this.add(new THREE.Mesh(new THREE.RingGeometry(.55,.66,32),new THREE.MeshStandardMaterial({color:0x8a7040,metalness:.6,roughness:.4})));ring.position.copy(face.position);ring.rotation.y=ry;
  const zones=[[0x5fbf72,0,1.05],[0xe0b23c,1.05,2.1],[0xd9573c,2.1,Math.PI]];
  for(const [c,a0,a1] of zones){const arc=this.add(new THREE.Mesh(new THREE.RingGeometry(.4,.52,24,1,a0,a1-a0),new THREE.MeshBasicMaterial({color:c,toneMapped:false})));const p=this.off(x,z,ry,0,.005);arc.position.set(p.x,y,p.z);arc.rotation.y=ry}
  const needle=new THREE.Group(),n=new THREE.Mesh(boxGeo(.04,.46,.02),new THREE.MeshBasicMaterial({color:0x221810}));n.position.y=.2;needle.add(n);const p=this.off(x,z,ry,0,.02);needle.position.set(p.x,y,p.z);needle.rotation.order='YXZ';needle.rotation.y=ry;this.add(needle);
  if(label){const q=this.off(x,z,ry,0,.01);this.card(q.x,y-.8,q.z,ry,label,'',1.1,.3,{w:360,h:96})}
  return needle;
 }
 portal(x,z,ry,color,w=2.2,h=3){
  // An arch with a swirling surface; used for the vendor's shortcut and the cloud gate.
  const p=this.off(x,z,ry,0,0);for(const s of [-1,1]){const q=this.off(x,z,ry,s*(w/2+.15),0);this.box('stone',.3,h+.2,.4,q.x,(h+.2)/2,q.z,0xb59c70,ry)}this.box('stone',w+.6,.3,.4,p.x,h+.25,p.z,0xc9a25e,ry);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const surf=this.add(new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat));surf.position.set(x,h/2+.05,z);surf.rotation.y=ry;
  const swirl=this.add(new THREE.Mesh(new THREE.RingGeometry(.2,Math.min(w,h)*.45,32,1),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})));const f=this.off(x,z,ry,0,.02);swirl.position.set(f.x,h/2+.05,f.z);swirl.rotation.y=ry;
  for(let k=0;k<10;k++)this.sparks.push([x+(this.r()-.5)*w,.3+this.r()*h*.8,z+(this.r()-.5)*.4,color]);
  return {surf,swirl};
 }
 horn(x,z,ry,color=0xc9a24e){
  this.shape('metal',new THREE.CylinderGeometry(.06,.1,1.6,8),0x5a4a32,x,.8,z);const p=this.off(x,z,ry,0,.2);
  const g=new THREE.ConeGeometry(.75,1.6,18,1,true);g.rotateX(-Math.PI/2);
  const m=this.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.35,side:THREE.DoubleSide,emissive:0x000000})));m.position.set(p.x,2.1,p.z);m.rotation.y=ry;this.collide(x,z,.7,.7);return m;
 }
 bell(x,z,color=0xd9a43a){this.shape('wood',new THREE.CylinderGeometry(.06,.08,1.1,8),0x5e3c22,x,.55,z);this.box('wood',.5,.06,.06,x,1.12,z,0x5e3c22);const g=new THREE.Group(),m=new THREE.Mesh(new THREE.CylinderGeometry(.08,.22,.3,14,1,true),new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.25,side:THREE.DoubleSide,emissive:0x000000}));g.add(m);const c=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),m.material);c.position.y=-.17;g.add(c);g.position.set(x,.92,z);this.add(g);this.collide(x,z,.5,.5);return {group:g,mat:m.material}}
 cloud(x,y,z,s=1){for(let k=0;k<4;k++)this.shape('plain',new THREE.SphereGeometry(s*(.35+this.r()*.25),10,8),0xf4f6fb,x+(this.r()-.5)*s,y+(this.r()-.5)*s*.3,z+(this.r()-.5)*s*.6)}
 chandelier(x,y,z,color=0xc9a25e){this.chain(x,y+1.2,y,z);this.shape('metal',new THREE.TorusGeometry(.6,.05,6,20),color,x,y,z,0,Math.PI/2);for(let k=0;k<6;k++){const a=k/6*Math.PI*2,cx=x+Math.cos(a)*.6,cz=z+Math.sin(a)*.6;this.box('plain',.06,.14,.06,cx,y+.1,cz,0xf1e6c8);this.flames.push([cx,y+.22,cz,.3])}this.light(x,y-.3,z,0xffc070,.8,false)}
 portrait(x,y,z,ry,color){this.box('wood',.9,1.2,.08,x,y,z,0x8a6a2a,ry);const p=this.off(x,z,ry,0,.05);this.box('plain',.7,1,.02,p.x,y,p.z,color,ry);this.box('plain',.3,.3,.03,p.x,y+.15,p.z,0xe2c8a8,ry);this.box('plain',.45,.35,.03,p.x,y-.25,p.z,new THREE.Color(color).multiplyScalar(.6),ry)}
}
