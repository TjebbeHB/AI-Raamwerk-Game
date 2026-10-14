// Shared building blocks: pixel textures, batched voxel geometry, labels and particle shaders.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function rng(seed){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
export function pixelTexture(size,paint,repeat=true){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),img=g.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const [r,gr,b]=paint(x,y),i=(y*size+x)*4;img.data[i]=r;img.data[i+1]=gr;img.data[i+2]=b;img.data[i+3]=255}
 g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.colorSpace=THREE.SRGBColorSpace;
 if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
}
export function makeTextures(){
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
 const paper=pixelTexture(16,(x,y)=>{const line=y%4===2&&x>2&&x<13?-34:0,v=226+noise()*8+line;return [clamp(v),clamp(v-6),clamp(v-22)]});
 return {brick,flag,rough,wood,paper};
}
// UVs scaled by face size so textures tile at one repeat per world unit.
export function boxGeo(w,h,d){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0],uv.getY(i)*dims[f][1])}return g}
export function tint(g,color){const c=new THREE.Color(color),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));if(g.index)return g.toNonIndexed();return g}
const tmpM=new THREE.Matrix4(),tmpQ=new THREE.Quaternion(),tmpE=new THREE.Euler(),tmpV=new THREE.Vector3(),ONE=new THREE.Vector3(1,1,1);
// Static props are merged per material so a whole level draws in a handful of calls.
export class Batch{
 constructor(){this.parts={}}
 add(key,geo,color,x,y,z,ry=0,rx=0,rz=0){let g=tint(geo,color);if(geo!==g)geo.dispose();g.applyMatrix4(tmpM.compose(tmpV.set(x,y,z),tmpQ.setFromEuler(tmpE.set(rx,ry,rz,'YXZ')),ONE));(this.parts[key]||=[]).push(g)}
 box(key,w,h,d,x,y,z,color,ry=0,rx=0,rz=0){this.add(key,boxGeo(w,h,d),color,x,y,z,ry,rx,rz)}
 build(materials,parent){for(const [key,list] of Object.entries(this.parts)){if(!list.length)continue;const merged=mergeGeometries(list);list.forEach(g=>g.dispose());const m=new THREE.Mesh(merged,materials[key]);m.matrixAutoUpdate=false;m.updateMatrix();parent.add(m)}this.parts={}}
}
export function makeMaterials(tex){
 return {
  stone:new THREE.MeshStandardMaterial({map:tex.rough,vertexColors:true,roughness:.92}),
  brick:new THREE.MeshStandardMaterial({map:tex.brick,vertexColors:true,roughness:.95}),
  wood:new THREE.MeshStandardMaterial({map:tex.wood,vertexColors:true,roughness:.85}),
  paper:new THREE.MeshStandardMaterial({map:tex.paper,vertexColors:true,roughness:.9}),
  plain:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}),
  metal:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.75}),
  glow:new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),
 };
}
export function fadeTexture(){const c=document.createElement('canvas');c.width=4;c.height=64;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,'#000');gr.addColorStop(.35,'#555');gr.addColorStop(.85,'#fff');gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,4,64);return new THREE.CanvasTexture(c)}
export function wrapLines(g,text,maxWidth){const words=String(text).split(/\s+/),lines=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(g.measureText(next).width>maxWidth&&line){lines.push(line);line=w}else line=next}if(line)lines.push(line);return lines}
export function labelTexture(lines,{w=512,h=128,bg='#2a1f17',border='#c9a25e',ink='#f3dfae',font='Cinzel, Georgia, serif',size=46,sub=24}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle=border;g.lineWidth=6;g.strokeRect(7,7,w-14,h-14);g.lineWidth=2;g.strokeRect(16,16,w-32,h-32);
 g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
 const [title,small]=lines;let s=size;g.font=`700 ${s}px ${font}`;while(g.measureText(title).width>w-60&&s>14){s-=2;g.font=`700 ${s}px ${font}`}
 g.fillText(title,w/2,small?h/2-sub*.55:h/2);if(small){let ss=sub;g.font=`600 ${ss}px ${font}`;while(g.measureText(small).width>w-60&&ss>10){ss-=1;g.font=`600 ${ss}px ${font}`}g.fillStyle=border;g.fillText(small,w/2,h/2+s*.62)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
// A small card with a title and a few wrapped lines, used on trial pedestals and desks.
export function cardTexture(title,body='',{w=256,h=192,bg='#efe2c2',ink='#2b2016',accent='#8a5a2c'}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle='rgba(120,80,30,.18)';g.fillRect(0,0,w,10);g.fillRect(0,h-10,w,10);
 g.strokeStyle=accent;g.lineWidth=4;g.strokeRect(10,14,w-20,h-28);
 g.fillStyle=ink;g.textAlign='center';g.textBaseline='top';g.font='700 26px Cinzel, Georgia, serif';
 const tl=wrapLines(g,title,w-40).slice(0,2);tl.forEach((l,i)=>g.fillText(l,w/2,26+i*30));
 if(body){g.font='500 18px Georgia, serif';wrapLines(g,body,w-44).slice(0,4).forEach((l,i)=>g.fillText(l,w/2,30+tl.length*30+8+i*22))}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export function bannerTexture(color,glyph){
 const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
 g.fillStyle=color;g.fillRect(0,0,64,112);for(let i=0;i<4;i++){g.beginPath();g.moveTo(i*16,112);g.lineTo(i*16+8,126);g.lineTo(i*16+16,112);g.fill()}
 g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,0,64,6);g.fillStyle='#f6dfa4';g.fillRect(6,10,52,3);g.fillRect(6,100,52,3);
 g.font='700 30px Cinzel, Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#24180f';g.fillText(glyph,32,58);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;
}
export const SHADERS={
 flameVertex:`attribute float seed;attribute float size;uniform float time;uniform float scale;varying float vFlick;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float f=.86+.12*sin(time*13.+seed*7.)+.07*sin(time*31.+seed*3.);vFlick=f;gl_PointSize=min(.55*size*f*scale*projectionMatrix[1][1]/max(-mv.z,.2),256.);gl_Position=projectionMatrix*mv;}`,
 flameFragment:`varying float vFlick;void main(){vec2 p=gl_PointCoord-vec2(.5,.62);p.x*=1.9+p.y*1.4;float r=length(p);float a=smoothstep(.42,0.,r);vec3 col=mix(vec3(1.,.32,.06),vec3(1.,.9,.55),smoothstep(.28,0.,r));gl_FragColor=vec4(col*2.4*vFlick*a,a);}`,
 emberVertex:`attribute float seed;uniform float time;uniform float scale;varying float vLife;
void main(){float life=fract(time*.35+seed);vec3 p=position+vec3(sin(time*1.7+seed*19.)*.12*life,life*1.5,cos(time*1.3+seed*11.)*.12*life);vLife=life;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(.06*scale*projectionMatrix[1][1]/max(-mv.z,.2),64.);gl_Position=projectionMatrix*mv;}`,
 emberFragment:`varying float vLife;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,r)*(1.-vLife);gl_FragColor=vec4(vec3(1.,.55,.18)*2.*a,a);}`,
 dustVertex:`attribute float seed;uniform float time;uniform float scale;uniform vec3 cam;varying float vA;
void main(){vec3 box=vec3(14.,6.,14.);vec3 p=position+vec3(sin(time*.11+seed*9.)*.6,time*.05+seed,cos(time*.09+seed*5.)*.6);p=mod(p-cam+box*.5,box)-box*.5+cam;vec4 mv=modelViewMatrix*vec4(p,1.);vA=.35+.35*sin(time*.8+seed*20.);gl_PointSize=min(.035*scale*projectionMatrix[1][1]/max(-mv.z,.2),32.);gl_Position=projectionMatrix*mv;}`,
 dustFragment:`varying float vA;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,r)*vA*.55;gl_FragColor=vec4(vec3(1.,.86,.62)*a,a);}`,
 sparkVertex:`attribute float seed;attribute vec3 tint;uniform float time;uniform float scale;varying float vA;varying vec3 vTint;
void main(){float life=fract(time*.5+seed);vec3 p=position+vec3(sin(seed*40.+time)*.35,life*1.2-.2,cos(seed*31.+time)*.35);vA=sin(life*3.1416);vTint=tint;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(.07*scale*projectionMatrix[1][1]/max(-mv.z,.2),48.);gl_Position=projectionMatrix*mv;}`,
 sparkFragment:`varying float vA;varying vec3 vTint;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,r)*vA;gl_FragColor=vec4(vTint*1.8*a,a);}`
};
