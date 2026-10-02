// Small deterministic movement model, shared by the voxel scene and collision tests.
const RADIUS=.27,STAND=1.73,CRAWL=.72;
const overlaps=(x,z,o,pad=RADIUS)=>Math.abs(x-o.x)<o.w/2+pad&&Math.abs(z-o.z)<o.d/2+pad;
function makeWalker(x=.6,z=4.4){return {x,z,y:0,vy:0,grounded:true,crouched:false,cooldown:0}}
function jump(w,solids=[]){if(!w.grounded||w.crouched||solids.some(o=>o.kind==='beam'&&overlaps(w.x,w.z,o)))return false;w.vy=6.2;w.grounded=false;return true}
function blocked(x,z,w,solids){const head=w.y+(w.crouched?CRAWL:STAND);return solids.some(o=>overlaps(x,z,o)&&(o.kind==='beam'?head>o.bottom&&w.y<o.top:w.y<o.height-.02))}
function patrolPosition(time,variant=0){return {x:Math.sin(time*.85+variant)*2.25,z:-.25,w:.8,d:.8,height:.62}}
function stepWalker(w,{dx=0,dz=0,crouch=false,dt,solids=[],hazard=null,spawn={x:.6,z:4.4}}){
 dt=Math.min(Math.max(dt,0),.05);w.cooldown=Math.max(0,w.cooldown-dt);
 w.crouched=crouch||solids.some(o=>o.kind==='beam'&&overlaps(w.x,w.z,o)&&w.y+STAND>o.bottom&&w.y<o.top);
 const priorY=w.y;w.vy-=15*dt;w.y+=w.vy*dt;
 for(const o of solids)if(o.kind==='beam'&&overlaps(w.x,w.z,o)&&priorY+(w.crouched?CRAWL:STAND)<=o.bottom&&w.y+(w.crouched?CRAWL:STAND)>o.bottom){w.y=o.bottom-(w.crouched?CRAWL:STAND);w.vy=0}
 let floor=0;for(const o of solids)if(o.kind==='crate'&&overlaps(w.x,w.z,o)&&priorY>=o.height-.03)floor=Math.max(floor,o.height);
 w.grounded=w.y<=floor&&w.vy<=0;if(w.grounded){w.y=floor;w.vy=0}
 const len=Math.hypot(dx,dz),speed=w.crouched?1.5:3.3;
 if(len>.03){const nx=Math.max(-6.6,Math.min(6.6,w.x+dx/len*speed*dt)),nz=Math.max(-5.3,Math.min(5.7,w.z+dz/len*speed*dt));if(!blocked(nx,nz,w,solids)){w.x=nx;w.z=nz}else if(!blocked(nx,w.z,w,solids))w.x=nx;else if(!blocked(w.x,nz,w,solids))w.z=nz}
 if(hazard&&w.cooldown===0&&overlaps(w.x,w.z,hazard)&&w.y<hazard.height){Object.assign(w,makeWalker(spawn.x,spawn.z),{cooldown:1.6});return {bumped:true}}
 return {bumped:false};
}
function course(variant=0){
 // Obstacles do not seal the room: walking around is always possible.
 const flip=variant%2?-1:1;
 return [{kind:'crate',x:flip*1.1,z:2.5,w:1.5,d:.65,height:.64},{kind:'beam',x:-flip*2,z:.7,w:2.1,d:.6,bottom:1.02,top:1.43},{kind:'post',x:-flip*2-1.18,z:.7,w:.26,d:.65,height:1.5},{kind:'post',x:-flip*2+1.18,z:.7,w:.26,d:.65,height:1.5}];
}
module.exports={makeWalker,jump,blocked,stepWalker,course,patrolPosition,overlaps};
