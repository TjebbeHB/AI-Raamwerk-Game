// First-person voxel dungeon for "Het Gewelf". Five depths share one grid; stairs and quick travel move between them.
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const W=330,H=86,STEP=.45,EYE=1.62,RADIUS=.32,REACH=3.4;
const OX=[0,68,136,204,272];
// Each depth has its own stone: warm cellar, blue question, mossy foundations, violet gallery, golden seal.
const PALETTE=[
 {wall:0xc9b49a,floor:0xb7a58e,ceil:0x6d6258,fog:0x16110e,accent:0xffc884},
 {wall:0x93a3bb,floor:0x8f98a8,ceil:0x4f5868,fog:0x0d1119,accent:0x9fc3ff},
 {wall:0x9aae94,floor:0x9a9c86,ceil:0x515d4f,fog:0x0d130f,accent:0xc6e39a},
 {wall:0xa89bbd,floor:0x9c94a9,ceil:0x564d66,fog:0x110e17,accent:0xd4b4ff},
 {wall:0xc4ae84,floor:0xb5a27e,ceil:0x5f5240,fog:0x15110a,accent:0xffd98a}
];
const FOUNDATIONS=[['governance',54,-1],['culture',54,1],['capacity',34,-1],['infrastructure',34,1]];
const DOMAINS=[['evaluation',66,-1],['quality',66,1],['interaction',53,-1],['performance',53,1],['functionality',40,-1],['sustainability',40,1],['sovereignty',27,-1],['ethics',27,1],['compliance',14,-1],['security',14,1]];
const STATE_COLOR={blind:0xffd36b,open:0xffa64a,strong:0x7ff0a8};
const VERDICT_COLOR=[0xe58b7a,0x8fb7ff,0xffd36b,0x7ff0a8];

function rng(seed){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function pixelTexture(size,paint,repeat=true){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),img=g.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const [r,gr,b]=paint(x,y),i=(y*size+x)*4;img.data[i]=r;img.data[i+1]=gr;img.data[i+2]=b;img.data[i+3]=255}
 g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.colorSpace=THREE.SRGBColorSpace;
 if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
}
function makeTextures(){
 const r=rng(7),noise=()=>r()*2-1,clamp=v=>Math.max(0,Math.min(255,v|0));
 const brickTone={};
 const brick=pixelTexture(16,(x,y)=>{const row=y>>2,off=row%2?4:0,id=`${row}:${((x+off)>>3)%2}`;brickTone[id]??=noise()*14;
  if(y%4===3||(x+off)%8===7)return [54,52,56].map(v=>clamp(v+noise()*5));
  const edge=y%4===0||(x+off)%8===0?10:0,v=150+brickTone[id]+noise()*9+edge;return [clamp(v),clamp(v-3),clamp(v-7)]});
 const flagTone={};
 const flag=pixelTexture(16,(x,y)=>{const row=y>>3,off=row%2?3:0,id=`${row}:${((x+off)>>3)}`;flagTone[id]??=noise()*16;
  if(y%8===0||(x+off)%8===0)return [60,56,52].map(v=>clamp(v+noise()*6));
  const v=146+flagTone[id]+noise()*10;return [clamp(v),clamp(v-4),clamp(v-10)]});
 const rough=pixelTexture(16,()=>{const v=118+noise()*18;return [clamp(v),clamp(v),clamp(v+4)]});
 const wood=pixelTexture(16,(x,y)=>{const plank=x>>2,seam=x%4===3,grain=Math.sin((y+plank*5)*.9)*6;const v=seam?70:132+grain+noise()*7+(plank%2)*8;return [clamp(v),clamp(v*.72),clamp(v*.48)]});
 return {brick,flag,rough,wood};
}
// UVs scaled by face size so textures tile at one repeat per world unit.
function boxGeo(w,h,d){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0],uv.getY(i)*dims[f][1])}return g}
function tint(g,color){const c=new THREE.Color(color),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g}

class Batch{
 constructor(){this.parts={}}
 add(key,geo,color,x,y,z,ry=0,rx=0,rz=0){const g=tint(geo,color);g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1)));(this.parts[key]||=[]).push(g)}
 box(key,w,h,d,x,y,z,color,ry=0,rx=0,rz=0){this.add(key,boxGeo(w,h,d),color,x,y,z,ry,rx,rz)}
 build(materials,parent){for(const [key,list] of Object.entries(this.parts)){if(!list.length)continue;const merged=mergeGeometries(list);list.forEach(g=>g.dispose());const m=new THREE.Mesh(merged,materials[key]);m.matrixAutoUpdate=false;m.frustumCulled=false;parent.add(m)}this.parts={}}
}

function fadeTexture(){const c=document.createElement('canvas');c.width=4;c.height=64;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,'#000');gr.addColorStop(.35,'#555');gr.addColorStop(.85,'#fff');gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,4,64);const t=new THREE.CanvasTexture(c);return t}
function labelTexture(lines,{w=512,h=128,bg='#2a1f17',border='#c9a25e',ink='#f3dfae',font='Cinzel, Georgia, serif',size=46,sub=24}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle=border;g.lineWidth=6;g.strokeRect(7,7,w-14,h-14);g.lineWidth=2;g.strokeRect(16,16,w-32,h-32);
 g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
 const [title,small]=lines;let s=size;g.font=`700 ${s}px ${font}`;while(g.measureText(title).width>w-60&&s>18){s-=2;g.font=`700 ${s}px ${font}`}
 g.fillText(title,w/2,small?h/2-sub*.55:h/2);if(small){g.font=`600 ${sub}px ${font}`;g.fillStyle=border;g.fillText(small,w/2,h/2+s*.62)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function bannerTexture(color,glyph){
 const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
 g.fillStyle=color;g.fillRect(0,0,64,112);for(let i=0;i<4;i++){g.beginPath();g.moveTo(i*16,112);g.lineTo(i*16+8,126);g.lineTo(i*16+16,112);g.fill()}
 g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,0,64,6);g.fillStyle='#f6dfa4';g.fillRect(6,10,52,3);g.fillRect(6,100,52,3);
 g.font='700 30px Cinzel, Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#24180f';g.fillText(glyph,32,58);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;
}

const flameVertex=`attribute float seed;attribute float size;uniform float time;uniform float scale;varying float vFlick;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float f=.86+.12*sin(time*13.+seed*7.)+.07*sin(time*31.+seed*3.);vFlick=f;gl_PointSize=.55*size*f*scale*projectionMatrix[1][1]/-mv.z;gl_Position=projectionMatrix*mv;}`;
const flameFragment=`varying float vFlick;void main(){vec2 p=gl_PointCoord-vec2(.5,.62);p.x*=1.9+p.y*1.4;float r=length(p);float a=smoothstep(.42,0.,r);vec3 col=mix(vec3(1.,.32,.06),vec3(1.,.9,.55),smoothstep(.28,0.,r));gl_FragColor=vec4(col*2.4*vFlick*a,a);}`;
const emberVertex=`attribute float seed;uniform float time;uniform float scale;varying float vLife;
void main(){float life=fract(time*.35+seed);vec3 p=position+vec3(sin(time*1.7+seed*19.)*.12*life,life*1.5,cos(time*1.3+seed*11.)*.12*life);vLife=life;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=.06*scale*projectionMatrix[1][1]/-mv.z;gl_Position=projectionMatrix*mv;}`;
const emberFragment=`varying float vLife;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,r)*(1.-vLife);gl_FragColor=vec4(vec3(1.,.55,.18)*2.*a,a);}`;
const dustVertex=`attribute float seed;uniform float time;uniform float scale;uniform vec3 cam;varying float vA;
void main(){vec3 box=vec3(14.,6.,14.);vec3 p=position+vec3(sin(time*.11+seed*9.)*.6,time*.05+seed,cos(time*.09+seed*5.)*.6);p=mod(p-cam+box*.5,box)-box*.5+cam;vec4 mv=modelViewMatrix*vec4(p,1.);vA=.35+.35*sin(time*.8+seed*20.);gl_PointSize=.035*scale*projectionMatrix[1][1]/-mv.z;gl_Position=projectionMatrix*mv;}`;
const dustFragment=`varying float vA;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,r)*vA*.55;gl_FragColor=vec4(vec3(1.,.86,.62)*a,a);}`;

export function createDungeon(canvas,{chambers,onInteract=()=>{},onPrompt=()=>{},onDepth=()=>{},onRegion=()=>{},onLock=()=>{},onStep=()=>{}}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.05,60);camera.rotation.order='YXZ';
 scene.fog=new THREE.FogExp2(PALETTE[0].fog,.058);scene.background=new THREE.Color(PALETTE[0].fog);
 const hemi=new THREE.HemisphereLight(0x9aa8c8,0x2a1d12,.75);scene.add(hemi);
 const tex=makeTextures();
 const mats={
  stone:new THREE.MeshStandardMaterial({map:tex.rough,vertexColors:true,roughness:.92}),
  brick:new THREE.MeshStandardMaterial({map:tex.brick,vertexColors:true,roughness:.95}),
  wood:new THREE.MeshStandardMaterial({map:tex.wood,vertexColors:true,roughness:.85}),
  plain:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}),
  metal:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.75}),
  glow:new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),
 };
 const beamTex=fadeTexture();
 const beamMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,map:beamTex,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,fog:false});
 const disposables=[...Object.values(mats),...Object.values(tex),beamTex];

 // ---------- grid ----------
 const solid=new Uint8Array(W*H).fill(1),floorY=new Float32Array(W*H),ceilY=new Float32Array(W*H).fill(5),depthAt=new Int8Array(W*H).fill(-1);
 const I=(x,z)=>z*W+x,inside=(x,z)=>x>=0&&z>=0&&x<W&&z<H;
 const isFloor=(x,z)=>inside(x,z)&&!solid[I(x,z)];
 let curDepth=0;
 function carve(x0,z0,w,d,ceil=5){for(let z=z0;z<z0+d;z++)for(let x=x0;x<x0+w;x++){const i=I(x,z);solid[i]=0;ceilY[i]=ceil;floorY[i]=0;depthAt[i]=curDepth}}
 const fill=(x,z)=>{solid[I(x,z)]=1};
 function chamfer(x0,z0,w,d,n){for(let k=0;k<n;k++)for(let j=0;j<n-k;j++){fill(x0+j,z0+k);fill(x0+w-1-j,z0+k);fill(x0+j,z0+d-1-k);fill(x0+w-1-j,z0+d-1-k)}}
 const zones=[];
 function stair(x,z,dx,dz,w,len,sign,target){
  const px=Math.abs(dz),pz=Math.abs(dx);let last;
  for(let k=0;k<len;k++)for(let j=0;j<w;j++){const cx=x+dx*k+px*j,cz=z+dz*k+pz*j,i=I(cx,cz);solid[i]=0;depthAt[i]=curDepth;floorY[i]=sign*(k+1)*STEP;ceilY[i]=sign>0?Math.ceil((k+1)*STEP)+5:5;last=[cx,cz]}
  const xs=[x+dx*(len-2),x+dx*(len-1)+px*(w-1)],zs=[z+dz*(len-2),z+dz*(len-1)+pz*(w-1)];
  zones.push({x0:Math.min(...xs),x1:Math.max(...xs)+1,z0:Math.min(...zs),z1:Math.max(...zs)+1,target,depth:curDepth});
 }
 const spawns=[],returns=[],regions=[],placements={};
 const chamberDefs=Object.fromEntries(chambers.map(c=>[c.id,c]));

 // Depth 0: de Ontvangsthal
 curDepth=0;let ox=OX[0];
 carve(ox+18,20,15,18,6);carve(ox+24,14,3,6,5);stair(ox+24,13,0,-1,3,6,-1,1);
 for(const [x,z] of [[20,23],[30,23],[20,33],[30,33]])fill(ox+x,z);
 spawns[0]={x:ox+25.5,z:35.5,yaw:0};returns[0]={x:ox+25.5,z:17.5,yaw:Math.PI};
 // Depth 1: de Kamer van de Vraag
 curDepth=1;ox=OX[1];
 carve(ox+24,58,5,4,5);stair(ox+25,62,0,1,3,5,1,0);carve(ox+25,44,3,14,5);carve(ox+16,24,21,20,7);chamfer(ox+16,24,21,20,3);
 carve(ox+37,32,5,3,5);stair(ox+42,32,1,0,3,6,-1,2);
 spawns[1]={x:ox+26.5,z:59.5,yaw:0};returns[1]={x:ox+39.5,z:33.5,yaw:Math.PI/2};
 // Depth 2: de Hal der Fundamenten
 curDepth=2;ox=OX[2];
 carve(ox+28,68,5,4,5);stair(ox+29,72,0,1,3,5,1,1);carve(ox+26,20,9,48,6);
 for(const [,c,side] of FOUNDATIONS){if(side<0){carve(ox+12,c-5,11,11,6);carve(ox+23,c-1,3,3,4)}else{carve(ox+38,c-5,11,11,6);carve(ox+35,c-1,3,3,4)}}
 for(const z of [24,29,41,47,61]){fill(ox+27,z);fill(ox+33,z)}
 carve(ox+29,14,3,6,5);stair(ox+29,13,0,-1,3,6,-1,3);
 spawns[2]={x:ox+30.5,z:69.5,yaw:0};returns[2]={x:ox+30.5,z:17.5,yaw:Math.PI};
 // Depth 3: de Galerij der Domeinen
 curDepth=3;ox=OX[3];
 carve(ox+29,74,5,4,5);stair(ox+30,78,0,1,3,5,1,2);carve(ox+28,10,7,64,6);
 for(const [,c,side] of DOMAINS){if(side<0){carve(ox+16,c-4,9,9,6);carve(ox+25,c-1,3,3,4)}else{carve(ox+38,c-4,9,9,6);carve(ox+35,c-1,3,3,4)}}
 for(const z of [59,46,33,20]){fill(ox+29,z);fill(ox+33,z)}
 carve(ox+30,5,3,5,5);stair(ox+30,4,0,-1,3,4,-1,4);
 spawns[3]={x:ox+31.5,z:75.5,yaw:0};returns[3]={x:ox+31.5,z:7.5,yaw:Math.PI};
 // Depth 4: de Zegelkamer
 curDepth=4;ox=OX[4];
 carve(ox+30,62,5,4,6);stair(ox+31,66,0,1,3,5,1,3);carve(ox+31,48,3,14,6);carve(ox+20,22,25,26,11);chamfer(ox+20,22,25,26,5);
 spawns[4]={x:ox+32.5,z:63.5,yaw:0};returns[4]=spawns[4];
 regions.push({id:'verdict',x0:ox+20,x1:ox+45,z0:22,z1:48});

 // ---------- voxel shell ----------
 const shell=new THREE.Group();scene.add(shell);
 const wallList=[],floorList=[],ceilList=[];
 const depthOfX=x=>{for(let d=OX.length-1;d>=0;d--)if(x>=OX[d])return d;return 0};
 for(let z=0;z<H;z++)for(let x=0;x<W;x++){
  const i=I(x,z);
  if(solid[i]){
   let lo=Infinity,hi=-Infinity;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(isFloor(x+dx,z+dz)){const j=I(x+dx,z+dz);lo=Math.min(lo,floorY[j]);hi=Math.max(hi,ceilY[j])}
   if(hi>-Infinity)for(let y=Math.floor(lo);y<Math.ceil(hi);y++)wallList.push([x,y,z]);
  }else{
   floorList.push([x,z,floorY[i]]);ceilList.push([x,z,ceilY[i]]);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(isFloor(x+dx,z+dz)){const j=I(x+dx,z+dz);if(ceilY[j]>ceilY[i])for(let y=Math.floor(ceilY[i]);y<Math.ceil(ceilY[j]);y++)wallList.push([x,y,z])}
  }
 }
 const r=rng(42),m4=new THREE.Matrix4(),col=new THREE.Color();
 function instanced(geo,mat,list,place){const mesh=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((v,k)=>{place(v,m4,col);mesh.setMatrixAt(k,m4);mesh.setColorAt(k,col)});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;shell.add(mesh);disposables.push(geo,mat);return mesh}
 const shellMat=map=>new THREE.MeshStandardMaterial({map,roughness:.95});
 instanced(boxGeo(1,1,1),shellMat(tex.brick),wallList,([x,y,z],m,c)=>{m.makeTranslation(x+.5,y+.5,z+.5);const p=PALETTE[depthOfX(x)],v=.82+r()*.3,moss=y<1&&r()<.35;c.set(p.wall).multiplyScalar(v);if(moss)c.lerp(new THREE.Color(0x5f7a45),.35);if(y>=Math.floor(ceilY[I(Math.min(W-1,x),z)])-1&&r()<.1)c.multiplyScalar(.8)});
 instanced(boxGeo(1,1,1),shellMat(tex.flag),floorList,([x,z,fy],m,c)=>{const h=fy===0?.2:fy+3.2;m.compose(new THREE.Vector3(x+.5,fy-h/2,z+.5),new THREE.Quaternion(),new THREE.Vector3(1,h,1));c.set(PALETTE[depthOfX(x)].floor).multiplyScalar(.8+r()*.28)});
 instanced(boxGeo(1,1,1),shellMat(tex.rough),ceilList,([x,z,cy],m,c)=>{m.compose(new THREE.Vector3(x+.5,cy+.2,z+.5),new THREE.Quaternion(),new THREE.Vector3(1,.4,1));c.set(PALETTE[depthOfX(x)].ceil).multiplyScalar(.75+r()*.35)});

 // ---------- props ----------
 const batch=new Batch(),colliders=[],interactables=[],torches=[],flames=[],embers=[],updaters=[];
 const collide=(x,z,w,d)=>colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});
 function torch(x,z,nx,nz,y=2.5,color=0xffa04a){
  // x,z: point on the wall face; n: normal pointing into the room
  const bx=x+nx*.12,bz=z+nz*.12,ry=Math.atan2(nx,nz);
  batch.box('metal',.12,.12,.28,bx,y-.38,bz,0x3b3430,ry);batch.box('wood',.1,.5,.1,x+nx*.26,y-.22,z+nz*.26,0x7a5232,ry,0,0);
  batch.box('metal',.18,.08,.18,x+nx*.26,y,z+nz*.26,0x2d2a28,ry);
  const fx=x+nx*.26,fz=z+nz*.26;flames.push([fx,y+.2,fz]);for(let k=0;k<5;k++)embers.push([fx,y+.25,fz]);
  torches.push({pos:new THREE.Vector3(fx+nx*.25,y+.35,fz+nz*.25),color,seed:r()*10,base:1});
 }
 function pillarDeco(x,z,d){const p=PALETTE[d];batch.box('stone',1.2,.4,1.2,x,.2,z,new THREE.Color(p.wall).multiplyScalar(.7));batch.box('stone',1.2,.4,1.2,x,ceilY[I(Math.floor(x),Math.floor(z))]-.2,z,new THREE.Color(p.wall).multiplyScalar(.7))}
 function crate(x,z,s=.8,ry=0){batch.box('wood',s,s,s,x,s/2,z,0xb08458,ry);batch.box('wood',s+.04,.08,s+.04,x,s*.15,z,0x6e4a2c,ry);batch.box('wood',s+.04,.08,s+.04,x,s*.85,z,0x6e4a2c,ry);collide(x,z,s+.1,s+.1)}
 function barrel(x,z){batch.add('wood',new THREE.CylinderGeometry(.36,.36,.95,10),0x9a6a40,x,.475,z);batch.add('metal',new THREE.CylinderGeometry(.375,.375,.07,10),0x3a3632,x,.2,z);batch.add('metal',new THREE.CylinderGeometry(.375,.375,.07,10),0x3a3632,x,.75,z);collide(x,z,.75,.75)}
 function carpet(x0,z0,x1,z1,color){batch.box('plain',x1-x0,.03,z1-z0,(x0+x1)/2,.015,(z0+z1)/2,color);batch.box('plain',x1-x0-.3,.035,z1-z0-.3,(x0+x1)/2,.017,(z0+z1)/2,new THREE.Color(color).multiplyScalar(1.35))}
 function bookshelf(x,z,ry){
  batch.box('wood',1.8,2.4,.5,x,1.2,z,0x6b4a2e,ry);const c=Math.cos(ry),s=Math.sin(ry);
  for(let shelf=0;shelf<3;shelf++)for(let b=0;b<7;b++){const h=.38+r()*.14,ox=-.72+b*.24,bx=x+c*ox+s*.06,bz=z-s*ox+c*.06;batch.box('plain',.18,h,.34,bx,.38+shelf*.72+h/2,bz,[0x8a3b2e,0x2e5a6e,0x6e5a2e,0x3e6e3a,0x5b3e6e][(b+shelf*2)%5],ry)}
  collide(x,z,Math.abs(c)*1.8+Math.abs(s)*.5,Math.abs(s)*1.8+Math.abs(c)*.5);
 }
 function banner(x,z,ry,color,glyph){const t=bannerTexture(color,glyph),m=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.2),new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.5,roughness:.9,side:THREE.DoubleSide}));m.position.set(x,3.1,z);m.rotation.y=ry;scene.add(m);disposables.push(t,m.geometry,m.material);batch.box('metal',1.3,.08,.08,x,4.25,z,0x8a7040,ry)}
 function sign(x,y,z,ry,lines,opts){const t=labelTexture(lines,opts),m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.65),new THREE.MeshStandardMaterial({map:t,roughness:.7,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.18}));m.position.set(x,y,z);m.rotation.y=ry;scene.add(m);disposables.push(t,m.geometry,m.material);return m}
 function candleCluster(x,y,z){for(let k=0;k<3;k++){const a=k*2.1,cx=x+Math.cos(a)*.13,cz=z+Math.sin(a)*.13,h=.14+k*.05;batch.box('plain',.06,h,.06,cx,y+h/2,cz,0xf1e6c8);flames.push([cx,y+h+.05,cz,.35])}}
 function npcFigure(def,x,z,ry,k){
  const g=new THREE.Group(),b=new Batch(),c=new THREE.Color(def.color),robe=c.clone().multiplyScalar(.75),trim=c.clone().lerp(new THREE.Color(0xffffff),.35);
  const skin=[0xe2b48c,0xc68c62,0x8d5a3b,0xf0c9a5][k%4],hair=[0x3b2a1e,0x7a4b2a,0xd9c27a,0x2b2b2b,0xbfbfbf][k%5];
  b.box('plain',.62,1.05,.42,0,.62,0,robe);b.box('plain',.66,.12,.46,0,.2,0,trim);b.box('plain',.5,.42,.36,0,1.32,0,robe);
  b.box('plain',.16,.62,.16,-.38,1.12,0,robe);b.box('plain',.16,.62,.16,.38,1.12,0,robe);b.box('plain',.14,.14,.14,-.38,.76,0,skin);b.box('plain',.14,.14,.14,.38,.76,0,skin);
  b.box('plain',.42,.42,.4,0,1.76,0,skin);b.box('plain',.46,.14,.44,0,2.02,0,hair);b.box('plain',.08,.07,.02,-.1,1.79,.205,0x1a1410);b.box('plain',.08,.07,.02,.1,1.79,.205,0x1a1410);
  const hat=k%3;if(hat===0){b.box('plain',.58,.06,.58,0,2.11,0,trim);b.box('plain',.36,.3,.36,0,2.29,0,robe)}else if(hat===1){b.add('plain',new THREE.ConeGeometry(.3,.62,6),robe,0,2.38,0)}else{b.box('plain',.5,.08,.06,0,2.08,.2,0xe7c063)}
  b.build({plain:mats.plain},g);g.scale.setScalar(.86);g.position.set(x,0,z);g.rotation.y=ry;scene.add(g);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color:STATE_COLOR.blind,toneMapped:false}));marker.scale.set(1,1.5,1);marker.position.set(x,2.55,z);scene.add(marker);disposables.push(marker.geometry,marker.material);
  collide(x,z,.7,.7);return {group:g,marker,baseYaw:ry};
 }
 const npcs={},clueItems={},doorSeals={},veils={};
 function sourceProp(kind,x,z,color){
  // A pedestal plus a floating, glowing item. Unread items glow; read items rest.
  batch.box('stone',.62,.9,.62,x,.45,z,0x8d8a86);batch.box('stone',.78,.12,.78,x,.96,z,0xa7a39c);batch.box('stone',.78,.12,.78,x,.06,z,0x77736d);
  let geo;if(kind===0){geo=boxGeo(.42,.1,.32)}else if(kind===1){geo=new THREE.CylinderGeometry(.07,.07,.46,8);geo.rotateZ(Math.PI/2)}else geo=new THREE.OctahedronGeometry(.17);
  const mat=new THREE.MeshStandardMaterial({color:kind===0?0x8b3d2c:kind===1?0xe8dcb5:color,emissive:color,emissiveIntensity:1.4,roughness:.4});
  const item=new THREE.Mesh(geo,mat);item.position.set(x,1.3,z);scene.add(item);disposables.push(geo,mat);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.32,.45,3.6,12,1,true),beamMat(color,.32));beam.position.set(x,2.2,z);scene.add(beam);disposables.push(beam.geometry,beam.material);
  collide(x,z,.8,.8);return {item,beam,baseY:1.3,read:false,kind};
 }
 function chamber(def,cx,cz,dirX,dirZ,w,d,k){
  // dir points from the room centre toward its door.
  const along=dirX?w/2:d/2,across=dirX?d/2:w/2,px=-dirZ,pz=dirX,face=Math.atan2(dirX,dirZ),c=new THREE.Color(def.color);
  regions.push({id:def.id,x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2});
  const nx=cx-dirX*(along-1.5),nz=cz-dirZ*(along-1.5);
  npcs[def.id]=npcFigure(def,nx,nz,face,k);
  interactables.push({kind:'npc',id:def.id,box:new THREE.Box3(new THREE.Vector3(nx-.45,0,nz-.45),new THREE.Vector3(nx+.45,2.3,nz+.45)),label:`Praat met ${def.npc}`});
  // decision table with candles and an open ledger
  const tx=cx-dirX*(along-2.9),tz=cz-dirZ*(along-2.9),ty=face;
  batch.box('wood',2.2*Math.abs(dirZ)+.9*Math.abs(dirX),.12,2.2*Math.abs(dirX)+.9*Math.abs(dirZ),tx,.86,tz,0x8a5a36);
  for(const s of [-1,1])batch.box('wood',.14,.8,.14,tx+px*s*.95,.4,tz+pz*s*.95,0x5e3c22);
  batch.box('plain',.5,.03,.36,tx,.935,tz,0xf0e2bd,ty);candleCluster(tx+px*.75,.92,tz+pz*.75);
  collide(tx,tz,2.3*Math.abs(dirZ)+1*Math.abs(dirX),2.3*Math.abs(dirX)+1*Math.abs(dirZ));
  // the three sources
  const spread=Math.min(across-1.4,4.2),spots=[[spread,-.6],[-spread,-.6],[spread-.4,along-2.1]];
  def.clues.forEach((clue,j)=>{const [s,a]=spots[j],x=cx+px*s+dirX*a,z=cz+pz*s+dirZ*a,prop=sourceProp(j,x,z,c.getHex());(clueItems[def.id]||={})[clue.id]=prop;
   interactables.push({kind:'clue',id:def.id,clue:clue.id,box:new THREE.Box3(new THREE.Vector3(x-.45,0,z-.45),new THREE.Vector3(x+.45,1.7,z+.45)),label:`Bekijk bron: ${clue.title}`})});
  // torches, banner, shelves, carpet
  for(const s of [-1,1])torch(cx+px*s*across,cz+pz*s*across,-px*s,-pz*s,2.5,c.getHex());
  torch(cx-dirX*along+px*1.8,cz-dirZ*along+pz*1.8,dirX,dirZ,2.6);torch(cx-dirX*along-px*1.8,cz-dirZ*along-pz*1.8,dirX,dirZ,2.6);
  banner(cx-dirX*(along-.06),cz-dirZ*(along-.06),face,def.color,def.group==='necessity'?'?':String(def.number).padStart(2,'0'));
  if(across>4.6)for(const s of [-1,1])bookshelf(cx+px*s*(across-.3)-dirX*1.2,cz+pz*s*(across-.3)-dirZ*1.2,face+s*Math.PI/2);
  carpet(Math.min(cx-px*1.1,cx+px*1.1+dirX*(along-.2))-0,Math.min(cz-pz*1.1,cz+pz*1.1+dirZ*(along-.2)),Math.max(cx-px*1.1,cx+px*1.1+dirX*(along-.2)),Math.max(cz-pz*1.1,cz+pz*1.1+dirZ*(along-.2)),c.clone().multiplyScalar(.45));
  // sign and status seal outside, above the doorway on the hall side
  const ox2=cx+dirX*(along+3)+dirX*.02,oz2=cz+dirZ*(along+3)+dirZ*.02;
  if(def.group!=='necessity'){sign(ox2,4.72,oz2,face,[def.title,def.place.toUpperCase()],{size:44,sub:20});
   const seal=new THREE.Mesh(new THREE.OctahedronGeometry(.2),new THREE.MeshBasicMaterial({color:STATE_COLOR.blind,toneMapped:false}));seal.position.set(ox2-dirX*.3,3.62,oz2-dirZ*.3);seal.scale.set(1,1,.4);seal.rotation.y=face;scene.add(seal);disposables.push(seal.geometry,seal.material);doorSeals[def.id]=seal;
   batch.box('wood',3.3,.22,.22,ox2+dirX*.1,4.24,oz2+dirZ*.1,0x5e3c22,face);
   // a coloured veil of mist marks a room the team has not discussed yet
   const veil=new THREE.Mesh(new THREE.PlaneGeometry(2.9,3.9),beamMat(c.getHex(),.5));veil.position.set(ox2-dirX*1.4,1.95,oz2-dirZ*1.4);veil.rotation.y=face;scene.add(veil);disposables.push(veil.geometry,veil.material);veils[def.id]=veil}
 }
 // Depth 0 dressing
 ox=OX[0];
 carpet(ox+24,15,ox+27,37.6,0x6e2a26);
 for(const z of [22.5,31.5,36]){torch(ox+18,z,1,0);torch(ox+33,z,-1,0)}
 banner(ox+21.5,20.06,0,'#8f3a30','D');banner(ox+29.5,20.06,0,'#8f3a30','D');
 for(const [x,z] of [[20,23],[30,23],[20,33],[30,33]])pillarDeco(ox+x+.5,z+.5,0);
 batch.box('wood',3,4,.2,ox+25.5,2,37.95,0x5a3a22);batch.box('metal',.15,.15,.1,ox+26.1,1.8,37.8,0xc9a25e);
 crate(ox+19.2,36.2,.9,.3);crate(ox+19.4,35.1,.7,-.2);barrel(ox+31.6,36.3);barrel(ox+31.7,35.3);bookshelf(ox+18.4,28,Math.PI/2);bookshelf(ox+32.6,28,-Math.PI/2);
 {const lx=ox+25.5,lz=27.5;batch.box('wood',.5,1.1,.5,lx,.55,lz,0x6b4a2e);batch.box('wood',.9,.1,.7,lx,1.18,lz,0x8a5a36,0,-.35);batch.box('plain',.66,.03,.5,lx,1.25,lz,0xf4e7c4,0,-.35);batch.box('stone',.4,.8,.4,lx+.75,.4,lz-.3,0x8d8a86);candleCluster(lx+.75,.8,lz-.3);collide(lx+.75,lz-.3,.45,.45);
  const letter=new THREE.Mesh(new THREE.PlaneGeometry(.5,.36),new THREE.MeshBasicMaterial({color:0xfff1c8,toneMapped:false}));letter.position.set(lx,1.29,lz);letter.rotation.x=-Math.PI/2+.35;scene.add(letter);disposables.push(letter.geometry,letter.material);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,.55,4.6,12,1,true),beamMat(0xffd27a,.3));beam.position.set(lx,2.6,lz);scene.add(beam);disposables.push(beam.geometry,beam.material);
  clueItems.letter={item:letter,beam,baseY:1.29,read:false,flat:true};
  collide(lx,lz,.9,.8);interactables.push({kind:'letter',id:'letter',box:new THREE.Box3(new THREE.Vector3(lx-.5,0,lz-.5),new THREE.Vector3(lx+.5,1.6,lz+.5)),label:'Lees de brief van de wethouder'});}
 sign(ox+25.5,5.45,20.02,0,['Het Gewelf','DAAL AF · DIEPTE 1'],{size:46,sub:20});
 // Depth 1
 ox=OX[1];
 chamber(chamberDefs.necessity,ox+26.5,34,0,1,21,20,0);
 for(const z of [46.5,52.5])for(const s of [-1,1])torch(ox+26.5+s*1.5,z,-s,0,2.3);
 sign(ox+26.5,4.3,44,0,['De Kamer van de Vraag','DIEPTE 1'],{size:42,sub:20});
 sign(ox+36.98,4.2,33.5,-Math.PI/2,['Naar beneden','DIEPTE 2 · FUNDAMENTEN'],{size:40,sub:18});
 for(const [x,z] of [[19,40],[34,40],[19,28],[34,28]])barrel(ox+x,z);
 // Depth 2
 ox=OX[2];
 FOUNDATIONS.forEach(([id,c,side],k)=>chamber(chamberDefs[id],side<0?ox+17.5:ox+43.5,c+.5,side<0?1:-1,0,11,11,k+1));
 for(const z of [24,29,41,47,61]){pillarDeco(ox+27.5,z+.5,2);pillarDeco(ox+33.5,z+.5,2)}
 for(const z of [26.5,44,58.5,65]){torch(ox+26,z,1,0);torch(ox+35,z,-1,0)}
 carpet(ox+29,16,ox+32,68,0x2f4a2c);
 sign(ox+30.5,5.45,20.02,0,['De Hal der Fundamenten','DIEPTE 2'],{size:40,sub:20});
 crate(ox+27,66.5,.8,.4);barrel(ox+34,66.6);crate(ox+33.8,21.2,.8,.1);
 // Depth 3
 ox=OX[3];
 DOMAINS.forEach(([id,c,side],k)=>chamber(chamberDefs[id],side<0?ox+20.5:ox+42.5,c+.5,side<0?1:-1,0,9,9,k+5));
 for(const z of [59,46,33,20]){pillarDeco(ox+29.5,z+.5,3);pillarDeco(ox+33.5,z+.5,3)}
 for(const z of [60,47,34,21]){torch(ox+28,z-.5+1.5,1,0);torch(ox+35,z-.5+1.5,-1,0)}
 carpet(ox+30,8,ox+33,74,0x3d2d55);
 sign(ox+31.5,4.3,74,0,['De Galerij der Domeinen','DIEPTE 3'],{size:40,sub:20});
 sign(ox+31.5,5.45,10.02,0,['Naar de Zegelkamer','DIEPTE 4'],{size:40,sub:20});
 // Depth 4: the Zegelkamer and its altar
 ox=OX[4];
 const ac={x:ox+32.5,z:35};
 for(let t=0;t<3;t++)batch.box('stone',6-t*1.6,.3,6-t*1.6,ac.x,.15+t*.3,ac.z,new THREE.Color(PALETTE[4].wall).multiplyScalar(.85-t*.08));
 batch.box('stone',.9,1.2,.9,ac.x,1.5,ac.z,0xb59c70);batch.box('metal',1.2,.12,1.2,ac.x,2.12,ac.z,0xc9a25e);collide(ac.x,ac.z,1.4,1.4);
 for(const [sx,sz] of [[-7,-7],[7,-7],[-7,7],[7,7]]){const x=ac.x+sx,z=ac.z+sz,ry=Math.atan2(-sx,-sz);batch.box('stone',1.4,.6,1.4,x,.3,z,0x7e7466);batch.box('stone',.9,2.4,.6,x,1.8,z,0xa9a08e,ry);batch.box('stone',.5,.5,.5,x,3.25,z,0xb7ae9c,ry);batch.box('stone',1.3,.2,.3,x,2.5,z,0x968d7b,ry);batch.box('metal',.7,.22,.7,x,3.62,z,0x6b5a3a);flames.push([x,3.95,z,1.6]);for(let k=0;k<8;k++)embers.push([x,3.95,z]);torches.push({pos:new THREE.Vector3(x,4.3,z),color:0xffd98a,seed:r()*9,base:1.2});collide(x,z,1.4,1.4)}
 for(const [x,z,nx,nz] of [[ox+20,30,1,0],[ox+20,40,1,0],[ox+45,30,-1,0],[ox+45,40,-1,0],[ox+28,22,0,1],[ox+37,22,0,1]])torch(x,z,nx,nz,3.2,0xffc070);
 carpet(ox+31,30,ox+34,62,0x6a4a1c);
 sign(ox+32.5,4.9,48,0,['De Zegelkamer','DIEPTE 4 · HET BESLUIT'],{size:44,sub:20});
 interactables.push({kind:'altar',id:'verdict',box:new THREE.Box3(new THREE.Vector3(ac.x-1.2,0,ac.z-1.2),new THREE.Vector3(ac.x+1.2,3.6,ac.z+1.2)),label:'Raak het zegel aan en neem het besluit'});
 const seal=new THREE.Group();seal.position.set(ac.x,3.1,ac.z);scene.add(seal);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.06,8,40),new THREE.MeshBasicMaterial({color:0xffd98a,toneMapped:false}));ring.rotation.x=Math.PI/2;seal.add(ring);
 const glyphs=VERDICT_COLOR.map((c,k)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.55}));seal.add(m);disposables.push(m.geometry,m.material);return m});
 disposables.push(ring.geometry,ring.material);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1.2,2.6,10,20,1,true),beamMat(0xffe1a0,.22));shaft.position.set(ac.x,6,ac.z);scene.add(shaft);disposables.push(shaft.geometry,shaft.material);
 torches.push({pos:new THREE.Vector3(ac.x,3.4,ac.z),color:0xffe0a0,seed:3,base:1.6,steady:true});
 let verdictChoice=-1,shaftBase=.22;
 // stair archways glow so the way down is readable from afar
 for(const zn of zones){const cx=(zn.x0+zn.x1)/2,cz=(zn.z0+zn.z1)/2,down=zn.target>zn.depth;
  const rune=new THREE.Mesh(new THREE.RingGeometry(.5,.62,24),new THREE.MeshBasicMaterial({color:down?0x9fd0ff:0xffd08a,toneMapped:false,side:THREE.DoubleSide,transparent:true,opacity:.85}));
  rune.rotation.x=-Math.PI/2;rune.position.set(cx,floorY[I(Math.floor(cx),Math.floor(cz))]+.03,cz);scene.add(rune);disposables.push(rune.geometry,rune.material);updaters.push(t=>{rune.material.opacity=.55+.3*Math.sin(t*2.4)});
  torches.push({pos:new THREE.Vector3(cx,rune.position.y+1,cz),color:down?0x7fb6ff:0xffc070,seed:r()*9,base:.7,steady:true});}
 batch.build(mats,scene);

 // flames, embers, dust
 const scaleU={value:1},timeU={value:0},camU={value:new THREE.Vector3()};
 function points(list,vertex,fragment,extra={}){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(list.flatMap(p=>p.slice(0,3)),3));g.setAttribute('seed',new THREE.Float32BufferAttribute(list.map(()=>r()*10),1));g.setAttribute('size',new THREE.Float32BufferAttribute(list.map(p=>p[3]??1),1));
  const m=new THREE.ShaderMaterial({uniforms:{time:timeU,scale:scaleU,...extra},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const p=new THREE.Points(g,m);p.frustumCulled=false;scene.add(p);disposables.push(g,m);return p}
 points(flames,flameVertex,flameFragment);points(embers,emberVertex,emberFragment);
 points(Array.from({length:420},()=>[r()*14,r()*6,r()*14]),dustVertex,dustFragment,{cam:camU});

 // pooled lights follow the nearest torches
 const pool=Array.from({length:10},()=>{const l=new THREE.PointLight(0xffa04a,0,11,1.6);scene.add(l);return {light:l,torch:null}});
 const pip=new THREE.Group(),pipLight=new THREE.PointLight(0xffd8a0,3.2,9,1.7);
 {const b=new Batch();b.box('plain',.34,.3,.3,0,0,0,0x79a191);b.box('plain',.36,.06,.32,0,.14,0,0xa8c2a3);b.box('plain',.1,.07,.04,.16,.24,0,0xa4b37b);b.box('plain',.12,.05,.02,0,-.08,.16,0x294b3d);b.build({plain:mats.plain},pip);
  for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.06,.08,.02),new THREE.MeshBasicMaterial({color:0xffe7a0,toneMapped:false}));eye.position.set(s*.08,.03,.16);pip.add(eye);disposables.push(eye.geometry,eye.material)}
  const halo=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:0xfff0c0,toneMapped:false}));halo.position.set(0,-.26,0);pip.add(halo);disposables.push(halo.geometry,halo.material);
  pip.add(pipLight);pipLight.position.set(0,-.2,0);scene.add(pip)}

 // ---------- player ----------
 const player={x:spawns[0].x,z:spawns[0].z,y:0,vy:0,yaw:spawns[0].yaw,pitch:-.05,grounded:true,bob:0,depth:0,region:null};
 const keys=new Set();let locked=false,paused=false,attract=true,dragging=null,focusTarget=null,fade=0,fadeDir=0,fadeThen=null,objective=null,path=[],pathTimer=0,aimed=null,lastPrompt='',stepAcc=0,disposed=false,frame=0;
 const fadeEl=document.createElement('div');fadeEl.className='g-fade';canvas.parentElement.append(fadeEl);
 const cell=v=>Math.floor(v);
 const floorAt=(x,z)=>{const cx=cell(x),cz=cell(z);return isFloor(cx,cz)?floorY[I(cx,cz)]:99};
 function free(x,z,y){
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cx=cell(x)+dx,cz=cell(z)+dz;const nx=Math.max(cx,Math.min(x,cx+1)),nz=Math.max(cz,Math.min(z,cz+1));if(Math.hypot(x-nx,z-nz)>=RADIUS)continue;if(!isFloor(cx,cz)||floorY[I(cx,cz)]>y+.55)return false}
  for(const c of colliders)if(x>c.x0-RADIUS&&x<c.x1+RADIUS&&z>c.z0-RADIUS&&z<c.z1+RADIUS)return false;
  return true;
 }
 function place(p){player.x=p.x;player.z=p.z;player.yaw=p.yaw;player.pitch=-.05;player.y=floorAt(p.x,p.z);player.vy=0;checkRegion();setDepth(depthOfX(p.x),true)}
 function setDepth(d,silent){if(d===player.depth&&silent!==true)return;player.depth=d;const p=PALETTE[d];scene.fog.color.set(p.fog);scene.background.set(p.fog);hemi.color.set(p.accent).lerp(new THREE.Color(0x8090b0),.6);pathTimer=0;onDepth(d)}
 function transition(fn){if(fadeDir)return;fadeDir=1;fadeThen=fn}
 function checkRegion(){const reg=regions.find(g=>player.x>g.x0&&player.x<g.x1&&player.z>g.z0&&player.z<g.z1)?.id||null;if(reg!==player.region){player.region=reg;onRegion(reg)}}

 // ---------- input ----------
 const typing=()=>/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
 function onKey(e){
  if(e.type==='keyup'){keys.delete(e.code);return}
  if(typing()||paused||attract)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'].includes(e.code)){keys.add(e.code);if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault()}
  if(e.code==='Space'&&player.grounded){player.vy=4.6;player.grounded=false}
  if((e.code==='KeyE'||e.code==='Enter')&&aimed&&!e.repeat){e.preventDefault();interact()}
 }
 function interact(){if(!aimed)return;const a=aimed;if(a.kind==='npc'){const n=npcs[a.id];focusTarget=new THREE.Vector3(n.group.position.x,1.45,n.group.position.z)}else{focusTarget=a.box.getCenter(new THREE.Vector3());if(a.kind==='altar')focusTarget.y=2.7}onInteract({kind:a.kind,id:a.id,clue:a.clue})}
 function onMouseMove(e){if(locked){player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-e.movementY*.0022))}else if(dragging){player.yaw-=(e.clientX-dragging.x)*.005;player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch-(e.clientY-dragging.y)*.005));dragging={x:e.clientX,y:e.clientY}}}
 function onDown(e){if(paused||attract)return;if(locked){if(e.button===0)interact();return}
  if(e.pointerType==='mouse'&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{});}
  dragging={x:e.clientX,y:e.clientY,start:performance.now()}}
 function onUp(){if(dragging&&performance.now()-dragging.start<220&&aimed&&!locked)interact();dragging=null}
 function onLockChange(){locked=document.pointerLockElement===canvas;if(!locked)keys.clear();onLock(locked)}
 function onBlur(){keys.clear()}
 addEventListener('keydown',onKey);addEventListener('keyup',onKey);addEventListener('mousemove',onMouseMove);addEventListener('blur',onBlur);canvas.addEventListener('pointerdown',onDown);addEventListener('pointerup',onUp);document.addEventListener('pointerlockchange',onLockChange);
 canvas.addEventListener('pointermove',e=>{if(!locked&&dragging&&e.pointerType!=='mouse')onMouseMove(e)});

 // ---------- guidance: Pip walks the shortest path to the objective ----------
 function targetPos(t){
  if(!t)return null;
  if(t.kind==='down'||t.kind==='up'){const zn=zones.find(z=>z.depth===player.depth&&(t.kind==='down'?z.target>z.depth:z.target<z.depth));return zn?{x:(zn.x0+zn.x1)/2,z:(zn.z0+zn.z1)/2,depth:player.depth}:null}
  if(t.kind==='letter'){const it=interactables.find(i=>i.kind==='letter');const c=it.box.getCenter(new THREE.Vector3());return {x:c.x,z:c.z+1,depth:0}}
  if(t.kind==='altar')return {x:ac.x,z:ac.z+2.2,depth:4};
  const n=npcs[t.id];if(!n)return null;const g=n.group,fx=Math.sin(n.baseYaw),fz=Math.cos(n.baseYaw);return {x:g.position.x+fx*2.4,z:g.position.z+fz*2.4,depth:depthOfX(g.position.x)};
 }
 function bfs(sx,sz,tx,tz){
  const start=I(sx,sz),goal=I(tx,tz);if(solid[start]||solid[goal])return [];
  const prev=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let h=0,t=0;q[t++]=start;prev[start]=start;
  while(h<t){const c=q[h++];if(c===goal)break;const x=c%W,z=(c/W)|0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(!isFloor(nx,nz))continue;const n=I(nx,nz);if(prev[n]!==-1)continue;prev[n]=c;q[t++]=n}}
  if(prev[goal]===-1)return [];const out=[];for(let c=goal;c!==start;c=prev[c])out.push({x:c%W+.5,z:((c/W)|0)+.5});return out.reverse();
 }
 function updatePath(){
  let t=targetPos(objective);
  if(t&&t.depth!==player.depth)t=targetPos({kind:t.depth>player.depth?'down':'up'});
  path=t?bfs(cell(player.x),cell(player.z),cell(t.x),cell(t.z)):[];
 }

 // ---------- loop ----------
 const ray=new THREE.Raycaster(),clock=new THREE.Clock(),tmp=new THREE.Vector3(),fwd=new THREE.Vector3();
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.62,.55,.82);composer.addPass(bloom);composer.addPass(new OutputPass());
 let inset=0,insetTarget=0,vw=1,vh=1;
 // A side panel shifts the view centre so the focused character stays visible beside it.
 function applyView(){if(inset<1){camera.clearViewOffset();camera.aspect=vw/vh}else{camera.aspect=(vw+inset)/vh;camera.setViewOffset(vw+inset,vh,inset,0,vw,vh)}camera.updateProjectionMatrix()}
 function resize(){const w=canvas.clientWidth||canvas.parentElement.clientWidth,h=canvas.clientHeight||canvas.parentElement.clientHeight;if(!w||!h)return;vw=w;vh=h;renderer.setSize(w,h,false);composer.setSize(w,h);applyView();scaleU.value=h*renderer.getPixelRatio()*.5}
 const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement);resize();
 function stepPlayer(dt){
  let mx=0,mz=0;const k=c=>keys.has(c);
  if(k('KeyW')||k('ArrowUp'))mz-=1;if(k('KeyS')||k('ArrowDown'))mz+=1;if(k('KeyA'))mx-=1;if(k('KeyD'))mx+=1;
  if(k('ArrowLeft'))player.yaw+=dt*2.1;if(k('ArrowRight'))player.yaw-=dt*2.1;
  const len=Math.hypot(mx,mz),run=k('ShiftLeft')||k('ShiftRight'),speed=run?5.6:3.6;
  if(len>0){const s=Math.sin(player.yaw),c=Math.cos(player.yaw),vx=(mx*c+mz*s)/len*speed*dt,vz=(-mx*s+mz*c)/len*speed*dt;
   const fy=Math.max(player.y,floorAt(player.x,player.z));if(free(player.x+vx,player.z,fy))player.x+=vx;if(free(player.x,player.z+vz,fy))player.z+=vz;
   if(player.grounded){player.bob+=dt*speed*2.2;stepAcc+=dt*speed;if(stepAcc>1.55){stepAcc=0;onStep(run)}}}
  else player.bob*=.9;
  const ground=floorAt(player.x,player.z);
  if(!player.grounded){player.vy-=13*dt;player.y+=player.vy*dt;if(player.y<=ground){player.y=ground;player.vy=0;player.grounded=true}}
  else if(ground<player.y-.6){player.grounded=false;player.vy=0}
  else player.y=THREE.MathUtils.lerp(player.y,ground,Math.min(1,dt*12));
  const zn=zones.find(z=>z.depth===player.depth&&player.x>z.x0&&player.x<z.x1&&player.z>z.z0&&player.z<z.z1);
  if(zn&&!fadeDir)transition(()=>place(zn.target>zn.depth?spawns[zn.target]:returns[zn.target]));
  checkRegion();
 }
 function updateLights(t){
  if(frame%12===0){camera.getWorldPosition(tmp);const near=torches.map(tc=>[tc,tc.pos.distanceToSquared(tmp)]).sort((a,b)=>a[1]-b[1]).slice(0,pool.length);pool.forEach((p,j)=>{p.torch=near[j]?.[0]||null;if(p.torch){p.light.position.copy(p.torch.pos);p.light.color.set(p.torch.color)}})}
  for(const p of pool){if(!p.torch){p.light.intensity=0;continue}const tc=p.torch,fl=tc.steady?1:.82+.12*Math.sin(t*11+tc.seed)+.06*Math.sin(t*23+tc.seed*2);p.light.intensity=THREE.MathUtils.lerp(p.light.intensity,7*tc.base*fl,.35)}
 }
 function updateAim(){
  aimed=null;if(paused||attract){if(lastPrompt){lastPrompt='';onPrompt('')}return}
  camera.getWorldDirection(fwd);ray.set(camera.position,fwd);let best=REACH;
  for(const it of interactables){const hit=ray.ray.intersectBox(it.box,tmp);if(hit){const d=hit.distanceTo(camera.position);if(d<best){best=d;aimed=it}}}
  if(!aimed){for(const it of interactables){const c=it.box.getCenter(new THREE.Vector3());if(Math.hypot(c.x-player.x,c.z-player.z)<1.5){aimed=it;break}}}
  const text=aimed?aimed.label:'';if(text!==lastPrompt){lastPrompt=text;onPrompt(text)}
 }
 function updateNpcs(t,dt){
  for(const [id,n] of Object.entries(npcs)){const g=n.group,dx=player.x-g.position.x,dz=player.z-g.position.z,dist=Math.hypot(dx,dz);
   if(dist>18)continue;
   const want=dist<7?Math.atan2(dx,dz):n.baseYaw;let diff=want-g.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));g.rotation.y+=diff*Math.min(1,dt*3);
   g.position.y=Math.sin(t*1.6+id.length)*.025;n.marker.position.y=2.55+Math.sin(t*2+id.length)*.08;n.marker.rotation.y=t*1.4}
  for(const [key,set] of Object.entries(clueItems)){const list=key==='letter'?[set]:Object.values(set);for(const c of list){c.beamOpacity??=c.beam.material.opacity;if(c.flat){c.beam.visible=!c.read;c.beam.material.opacity=c.beamOpacity*THREE.MathUtils.smoothstep(Math.hypot(c.beam.position.x-player.x,c.beam.position.z-player.z),1.2,4);continue}
   const bd=Math.hypot(c.beam.position.x-player.x,c.beam.position.z-player.z);c.beam.material.opacity=c.beamOpacity*THREE.MathUtils.smoothstep(bd,1.2,4);
   c.item.position.y=c.baseY+(c.read?0:Math.sin(t*2+c.kind)*.06);c.item.rotation.y=t*(c.read?.2:.9);c.item.material.emissiveIntensity=c.read?.15:1.1+.5*Math.sin(t*3+c.kind);c.beam.visible=!c.read}}
  for(const [id,v] of Object.entries(veils)){if(!v.visible)continue;const d=Math.hypot(v.position.x-player.x,v.position.z-player.z);v.material.opacity=(.38+.1*Math.sin(t*1.5+id.length))*THREE.MathUtils.smoothstep(d,.8,3.5)}
  shaft.material.opacity=shaftBase*(.3+.7*THREE.MathUtils.smoothstep(Math.hypot(ac.x-player.x,ac.z-player.z),2.5,10));
  ring.rotation.z=t*.25;glyphs.forEach((g,k)=>{const a=t*.5+k*Math.PI/2,chosen=k===verdictChoice;g.position.set(chosen?0:Math.cos(a)*.9,chosen?Math.sin(t*1.5)*.1:Math.sin(t*1.3+k)*.12,chosen?0:Math.sin(a)*.9);g.rotation.set(t*.7,t*.9,0);g.scale.setScalar(chosen?1.9:1)});
 }
 const pipPos=new THREE.Vector3(spawns[0].x+.8,1.9,spawns[0].z-1.2);
 function updatePip(t,dt){
  pathTimer-=dt;if(pathTimer<=0){updatePath();pathTimer=.45}
  let goal;
  if(attract)goal=new THREE.Vector3(spawns[0].x+Math.sin(t*.5)*2,2.3,26+Math.cos(t*.5)*2);
  else if(path.length>5&&!paused){const p=path[Math.min(path.length-1,3)];goal=new THREE.Vector3(p.x,2.35+Math.sin(t*2.2)*.1+floorAt(p.x,p.z),p.z)}
  else{const s=Math.sin(player.yaw),c=Math.cos(player.yaw);goal=new THREE.Vector3(player.x-s*.9+c*.7,player.y+1.85+Math.sin(t*2.2)*.08,player.z-c*.9-s*.7)}
  pipPos.lerp(goal,Math.min(1,dt*2.4));pip.position.copy(pipPos);
  const look=path.length>5&&!paused?Math.atan2(goal.x-pip.position.x,goal.z-pip.position.z):Math.atan2(player.x-pip.position.x,player.z-pip.position.z);
  let diff=look-pip.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));pip.rotation.y+=diff*Math.min(1,dt*4);pip.rotation.z=Math.sin(t*1.7)*.08;
  pipLight.intensity=3+Math.sin(t*3.1)*.3;
 }
 function loop(){
  if(disposed)return;requestAnimationFrame(loop);frame++;
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;timeU.value=t;
  if(fadeDir){fade=Math.max(0,Math.min(1,fade+fadeDir*dt*2.6));fadeEl.style.opacity=fade;if(fade>=1&&fadeDir>0){fadeThen?.();fadeThen=null;fadeDir=-1}else if(fade<=0&&fadeDir<0)fadeDir=0}
  if(attract){const a=t*.08;player.x=spawns[0].x+Math.sin(a)*3.5;player.z=29+Math.cos(a)*5;player.y=.6;camera.position.set(player.x,player.y+EYE,player.z);camera.lookAt(spawns[0].x,1.5,27.5)}
  else{
   if(!paused)stepPlayer(dt);
   if(focusTarget&&paused){const dx=focusTarget.x-player.x,dz=focusTarget.z-player.z,wantYaw=Math.atan2(-dx,-dz),wantPitch=Math.atan2(focusTarget.y-(player.y+EYE),Math.hypot(dx,dz));let d=wantYaw-player.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));player.yaw+=d*Math.min(1,dt*3);player.pitch+=(wantPitch-player.pitch)*Math.min(1,dt*3)}
   camera.position.set(player.x,player.y+EYE+Math.sin(player.bob)*.045,player.z);camera.rotation.set(player.pitch,player.yaw,Math.sin(player.bob*.5)*.006);
  }
  if(Math.abs(inset-insetTarget)>.5){inset+=(insetTarget-inset)*Math.min(1,dt*6);applyView()}
  camU.value.copy(camera.position);
  updateLights(t);updateNpcs(t,dt);updatePip(t,dt);updateAim();updaters.forEach(f=>f(t));
  composer.render();
 }
 place(spawns[0]);requestAnimationFrame(loop);
 const chamberIds=Object.keys(npcs);
 return {
  setAttract(on){attract=on;if(!on){place(player.depth?spawns[player.depth]:spawns[0])}},
  setPaused(on){paused=on;if(on){keys.clear();if(document.pointerLockElement===canvas)document.exitPointerLock()}else focusTarget=null},
  lock(){if(!attract&&!paused&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{})}},
  setObjective(t){objective=t;pathTimer=0},
  setInset(px){insetTarget=Math.max(0,Math.min(px,vw*.6))},
  setStatus(map){for(const id of chamberIds){const s=map[id]||'blind',c=STATE_COLOR[s];npcs[id].marker.material.color.set(c);npcs[id].marker.visible=true;doorSeals[id]?.material.color.set(c);if(veils[id])veils[id].visible=s==='blind'}},
  setVisited(id,list){const set=clueItems[id];if(!set)return;for(const [cid,c] of Object.entries(set))c.read=list.includes(cid)},
  setLetterRead(on){clueItems.letter.read=on},
  setVerdict(choice){verdictChoice=choice;const c=choice>=0?VERDICT_COLOR[choice]:0xffe1a0;shaft.material.color.set(c);ring.material.color.set(choice>=0?c:0xffd98a);shaftBase=choice>=0?.4:.22},
  goTo(target,instant){const p=typeof target==='number'?spawns[target]:(()=>{const n=npcs[target];if(target==='verdict')return {x:ac.x,z:ac.z+5,yaw:0};if(!n)return null;const g=n.group,fx=Math.sin(n.baseYaw),fz=Math.cos(n.baseYaw);return {x:g.position.x+fx*4.4,z:g.position.z+fz*4.4,yaw:Math.atan2(fx,fz)}})();
   if(!p)return;if(instant)place(p);else transition(()=>place(p))},
  get depth(){return player.depth},
  get debug(){return {scene,bloom,composer,renderer,camera}},
  get player(){return {...player,camera:camera.position.toArray(),rotation:[camera.rotation.x,camera.rotation.y]}},
  dispose(){disposed=true;ro.disconnect();removeEventListener('keydown',onKey);removeEventListener('keyup',onKey);removeEventListener('mousemove',onMouseMove);removeEventListener('blur',onBlur);removeEventListener('pointerup',onUp);document.removeEventListener('pointerlockchange',onLockChange);disposables.forEach(d=>d.dispose?.());composer.dispose?.();renderer.dispose();fadeEl.remove()}
 };
}
