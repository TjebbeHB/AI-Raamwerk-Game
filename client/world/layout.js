// The voxel grid: eight areas side by side (five depths and three arenas), linked by stairs.
export const STEP=.45,LEVELS=8,SPAN=72,W=LEVELS*SPAN,H=86;
export const OX=Array.from({length:LEVELS},(_,i)=>i*SPAN);
export const FOUNDATIONS=[['governance',54,-1],['culture',54,1],['capacity',34,-1],['infrastructure',34,1]];
export const DOMAINS=[['evaluation',66,-1],['quality',66,1],['interaction',53,-1],['performance',53,1],['functionality',40,-1],['sustainability',40,1],['sovereignty',27,-1],['ethics',27,1],['compliance',14,-1],['security',14,1]];
// Ceiling height per chamber; tall rooms for horns, shelves and furnaces.
export const CEILING={necessity:7,governance:7,quality:8,sustainability:7,sovereignty:7,ethics:9,compliance:7};
export const PIT_DEPTH=-6;

export function buildLayout(){
 const solid=new Uint8Array(W*H).fill(1),floorY=new Float32Array(W*H),ceilY=new Float32Array(W*H).fill(5),levelAt=new Int8Array(W*H).fill(-1),roomAt=new Int16Array(W*H).fill(-1);
 const I=(x,z)=>z*W+x,inside=(x,z)=>x>=0&&z>=0&&x<W&&z<H,isFloor=(x,z)=>inside(x,z)&&!solid[I(x,z)];
 let L=0;
 const carve=(x0,z0,w,d,ceil=5)=>{for(let z=z0;z<z0+d;z++)for(let x=x0;x<x0+w;x++){const i=I(x,z);solid[i]=0;ceilY[i]=ceil;floorY[i]=0;levelAt[i]=L}};
 const fill=(x,z)=>{solid[I(x,z)]=1};
 const pillar=(x,z,s=1)=>{for(let dz=0;dz<s;dz++)for(let dx=0;dx<s;dx++)fill(x+dx,z+dz)};
 const chamfer=(x0,z0,w,d,n)=>{for(let k=0;k<n;k++)for(let j=0;j<n-k;j++){fill(x0+j,z0+k);fill(x0+w-1-j,z0+k);fill(x0+j,z0+d-1-k);fill(x0+w-1-j,z0+d-1-k)}};
 const zones=[];
 function stair(x,z,dx,dz,w,len,sign,target){
  const px=Math.abs(dz),pz=Math.abs(dx);
  for(let k=0;k<len;k++)for(let j=0;j<w;j++){const cx=x+dx*k+px*j,cz=z+dz*k+pz*j,i=I(cx,cz);solid[i]=0;levelAt[i]=L;floorY[i]=sign*(k+1)*STEP;ceilY[i]=sign>0?Math.ceil((k+1)*STEP)+5:5}
  const xs=[x+dx*(len-2),x+dx*(len-1)+px*(w-1)],zs=[z+dz*(len-2),z+dz*(len-1)+pz*(w-1)];
  zones.push({x0:Math.min(...xs),x1:Math.max(...xs)+1,z0:Math.min(...zs),z1:Math.max(...zs)+1,target,level:L});
 }
 const spawns=[],returns=[],regions=[],chambers={},arenas={};
 const region=(r)=>{regions.push({...r,level:L});return regions.length-1};
 function chamber(id,cx,cz,dirX,dirZ,w,d){
  // Room rectangle centred on (cx,cz); dir points from the centre towards the door.
  const x0=Math.round(cx-w/2),z0=Math.round(cz-d/2),idx=region({id,kind:'chamber',x0,x1:x0+w,z0,z1:z0+d});
  carve(x0,z0,w,d,CEILING[id]||6);
  for(let z=z0;z<z0+d;z++)for(let x=x0;x<x0+w;x++)roomAt[I(x,z)]=idx;
  chambers[id]={id,cx,cz,dirX,dirZ,w,d,level:L,along:dirX?w/2:d/2,across:dirX?d/2:w/2};
 }
 // The sovereignty chamber is split by a chasm with a one-cell bridge.
 function chasm(id){const c=chambers[id],px=-c.dirZ,pz=c.dirX,pits=[];
  for(let z=Math.round(c.cz-c.d/2);z<c.cz+c.d/2;z++)for(let x=Math.round(c.cx-c.w/2);x<c.cx+c.w/2;x++){const ux=x+.5-c.cx,uz=z+.5-c.cz,a=ux*c.dirX+uz*c.dirZ,s=ux*px+uz*pz;if(a>-.6&&a<1.6&&Math.abs(s)>.6){floorY[I(x,z)]=PIT_DEPTH;pits.push([x,z])}}
  c.pit={a0:-.5,a1:1.5,cells:pits};
 }
 function arena(id,big){
  const ox=OX[L];
  if(big){carve(ox+17,16,31,31,10);chamfer(ox+17,16,31,31,4);carve(ox+30,47,5,8,5);stair(ox+31,55,0,1,3,5,1,L-1);carve(ox+31,8,3,8,5);stair(ox+31,7,0,-1,3,6,-1,L+1);
   for(const [x,z] of [[22,21],[41,21],[22,40],[41,40]])pillar(ox+x,z,2);
   arenas[id]={id,level:L,x0:ox+17,x1:ox+48,z0:16,z1:47,gate:{x0:ox+31,x1:ox+34,z:16},entryZ:44.5,center:{x:ox+32.5,z:30},boss:true};
   spawns[L]={x:ox+32.5,z:51.5,yaw:0};returns[L]={x:ox+32.5,z:12.5,yaw:Math.PI};
  }else{carve(ox+20,20,25,26,8);chamfer(ox+20,20,25,26,3);carve(ox+30,46,5,9,5);stair(ox+31,55,0,1,3,5,1,L-1);carve(ox+31,12,3,8,5);stair(ox+31,11,0,-1,3,6,-1,L+1);
   for(const [x,z] of [[25,26],[38,26],[25,38],[38,38]])pillar(ox+x,z,2);
   arenas[id]={id,level:L,x0:ox+20,x1:ox+45,z0:20,z1:46,gate:{x0:ox+31,x1:ox+34,z:20},entryZ:43.5,center:{x:ox+32.5,z:33}};
   spawns[L]={x:ox+32.5,z:51.5,yaw:0};returns[L]={x:ox+32.5,z:16.5,yaw:Math.PI};
  }
  const a=arenas[id];a.region=region({id,kind:'arena',x0:a.x0,x1:a.x1,z0:a.z0,z1:a.z1});
 }
 // 0 · De Ontvangsthal
 L=0;let ox=OX[L];
 carve(ox+18,20,15,18,6);carve(ox+24,14,3,6,5);stair(ox+24,13,0,-1,3,6,-1,1);
 for(const [x,z] of [[20,23],[30,23],[20,33],[30,33]])fill(ox+x,z);
 spawns[L]={x:ox+25.5,z:35.5,yaw:0};returns[L]={x:ox+25.5,z:17.5,yaw:Math.PI};
 // 1 · De Kamer van de Vraag
 L=1;ox=OX[L];
 carve(ox+24,58,5,4,5);stair(ox+25,62,0,1,3,5,1,0);carve(ox+25,44,3,14,5);
 chamber('necessity',ox+26.5,34,0,1,21,20);chamfer(ox+16,24,21,20,3);
 carve(ox+37,32,5,3,5);stair(ox+42,32,1,0,3,6,-1,2);
 spawns[L]={x:ox+26.5,z:59.5,yaw:0};returns[L]={x:ox+39.5,z:33.5,yaw:Math.PI/2};
 // 2 · eerste tussenkamer
 L=2;arena('a1');
 // 3 · De Hal der Fundamenten
 L=3;ox=OX[L];
 carve(ox+28,68,5,4,5);stair(ox+29,72,0,1,3,5,1,2);carve(ox+26,20,9,48,6);
 for(const [id,c,side] of FOUNDATIONS){if(side<0){chamber(id,ox+16.5,c+.5,1,0,13,11);carve(ox+23,c-1,3,3,4)}else{chamber(id,ox+44.5,c+.5,-1,0,13,11);carve(ox+35,c-1,3,3,4)}}
 for(const z of [24,29,41,47,61]){fill(ox+27,z);fill(ox+33,z)}
 carve(ox+29,14,3,6,5);stair(ox+29,13,0,-1,3,6,-1,4);
 spawns[L]={x:ox+30.5,z:69.5,yaw:0};returns[L]={x:ox+30.5,z:17.5,yaw:Math.PI};
 // 4 · tweede tussenkamer
 L=4;arena('a2');
 // 5 · De Galerij der Domeinen
 L=5;ox=OX[L];
 carve(ox+29,74,5,4,5);stair(ox+30,78,0,1,3,5,1,4);carve(ox+28,10,7,64,6);
 for(const [id,c,side] of DOMAINS){if(side<0){chamber(id,ox+18.5,c+.5,1,0,13,11);carve(ox+25,c-1,3,3,4)}else{chamber(id,ox+44.5,c+.5,-1,0,13,11);carve(ox+35,c-1,3,3,4)}}
 chasm('sovereignty');
 for(const z of [59,46,33,20]){fill(ox+29,z);fill(ox+33,z)}
 carve(ox+30,5,3,5,5);stair(ox+30,4,0,-1,3,4,-1,6);
 spawns[L]={x:ox+31.5,z:75.5,yaw:0};returns[L]={x:ox+31.5,z:7.5,yaw:Math.PI};
 // 6 · De Drempel
 L=6;arena('a3',true);
 // 7 · De Zegelkamer
 L=7;ox=OX[L];
 carve(ox+30,62,5,4,6);stair(ox+31,66,0,1,3,5,1,6);carve(ox+31,48,3,14,6);carve(ox+20,22,25,26,11);chamfer(ox+20,22,25,26,5);
 spawns[L]={x:ox+32.5,z:63.5,yaw:0};returns[L]=spawns[L];
 region({id:'verdict',kind:'verdict',x0:ox+20,x1:ox+45,z0:22,z1:48});
 const levelOfX=x=>Math.max(0,Math.min(LEVELS-1,Math.floor(x/SPAN)));
 return {W,H,solid,floorY,ceilY,levelAt,roomAt,I,inside,isFloor,zones,spawns,returns,regions,chambers,arenas,levelOfX};
}
