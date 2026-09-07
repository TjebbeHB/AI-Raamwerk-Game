import * as THREE from 'three';

const layouts = [
 [{id:'signs',x:-4,z:-2,kind:'desk'},{id:'bramble',x:3,z:2,kind:'goblin'},{id:'ledger',x:-3,z:3,kind:'scroll'}],
 [{id:'mallow',x:-4,z:-2,kind:'mushroom'},{id:'scroll',x:3,z:2,kind:'scroll'},{id:'catalogue',x:-3,z:3,kind:'books'}],
 [{id:'permit',x:3,z:2,kind:'goblin'},{id:'records',x:-4,z:-2,kind:'desk'},{id:'appeal',x:-3,z:3,kind:'bell'}],
 [{id:'sensor',x:-4,z:-2,kind:'pump'},{id:'cutoff',x:3,z:2,kind:'lever'},{id:'operator',x:-3,z:3,kind:'desk'}],
 [{id:'trial',x:-4,z:-2,kind:'model'},{id:'owner',x:3,z:2,kind:'goblin'},{id:'change',x:-3,z:3,kind:'scroll'}]
];

export function createWorld(canvas, {onInteract,onExit,onPrompt}) {
 const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2;
 const scene = new THREE.Scene();
 const camera = new THREE.OrthographicCamera(-12,12,10,-10,.1,100);
 camera.position.set(16,20,23); camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xc8d8d7,0x354a3b,2.3));
 const sunlight=new THREE.DirectionalLight(0xffdda2,3.4);sunlight.position.set(-5,12,6);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);
 Object.assign(sunlight.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});sunlight.shadow.bias=-.0006;sunlight.shadow.normalBias=.04;scene.add(sunlight);
 const moon=new THREE.DirectionalLight(0xa6c7da,1.5);moon.position.set(4,7,-7);scene.add(moon);
 let root,player,pip,targets=[],flames=[],ghosts=[],dust,portal,portalLight,visited=[],resolved=false,selected=null,pending=null,t=0,stepT=0,frame,last=performance.now(),prompt='',lastPointer=null,disposed=false;
 let waypoints=[],effect=null,celebrationAt=-100,bridgeParts=[],water=null;
 const keys=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const mats=new Map(),cube=new THREE.BoxGeometry(1,1,1),bucket=new Map();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function mat(color,glow=false){const key=`${color}-${glow}`;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.94,emissive:glow?color:0,emissiveIntensity:glow?.6:0}));return mats.get(key)}
 // Static scenery is instanced by material; characters remain articulated groups.
 function box(x,y,z,w,h,d,color,parent=null,glow=false){
  if(!parent&&!glow){if(!bucket.has(color))bucket.set(color,[]);bucket.get(color).push([x,y,z,w,h,d]);return null}
  const m=new THREE.Mesh(cube,mat(color,glow));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;(parent||root).add(m);return m;
 }
 function flush(){const dummy=new THREE.Object3D();for(const[color,items]of bucket){const m=new THREE.InstancedMesh(cube,mat(color),items.length);items.forEach((a,i)=>{dummy.position.set(...a.slice(0,3));dummy.scale.set(...a.slice(3));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix)});m.castShadow=true;m.receiveShadow=true;root.add(m)}bucket.clear()}
 function character(kind){
  const g=new THREE.Group(),skin=kind==='goblin'?0x9eb780:kind==='ghost'?0xb6d4c5:kind==='pip'?0x9fbeb0:0xdcb888;
  if(kind==='pip'){
   box(0,.62,0,.63,.58,.45,0x6d9587,g);box(0,1.18,0,.82,.64,.59,skin,g);
   box(-.22,1.21,.31,.12,.15,.05,0xe5d690,g,true);box(.22,1.21,.31,.12,.15,.05,0xe5d690,g,true);box(0,1.03,.31,.16,.045,.03,0x52665e,g);
   box(0,.67,.245,.16,.17,.04,0xdab369,g,true);box(-.45,.64,0,.22,.55,.25,skin,g);box(.45,.64,0,.22,.55,.25,skin,g);
   box(-.19,.19,0,.23,.3,.32,0x658473,g);box(.19,.19,0,.23,.3,.32,0x658473,g);box(.22,1.6,0,.22,.2,.24,0x819b59,g);box(.34,1.68,0,.2,.1,.15,0xadc174,g);
  }else{
   const outfit=kind==='goblin'?0xb08357:kind==='ghost'?0x99b9b0:0x477b76;
   box(0,.71,0,.53,.68,.38,outfit,g);box(0,1.25,0,.58,.52,.5,skin,g);box(-.17,1.28,.255,.065,.1,.025,0x313e38,g);box(.17,1.28,.255,.065,.1,.025,0x313e38,g);
   box(-.36,.75,0,.16,.51,.2,skin,g);box(.36,.75,0,.16,.51,.2,skin,g);box(-.15,.19,0,.2,.34,.28,kind==='ghost'?skin:0x443e31,g);box(.15,.19,0,.2,.34,.28,kind==='ghost'?skin:0x443e31,g);
   if(kind==='player'){box(0,1.55,-.03,.65,.2,.58,0x477b76,g);box(0,1.3,-.24,.64,.48,.13,0x477b76,g);box(0,.82,-.24,.57,.8,.12,0xc7a15d,g);box(-.12,1.1,.26,.12,.26,.06,0xc7a15d,g)}
   if(kind==='goblin'){box(-.39,1.3,0,.24,.17,.2,skin,g);box(.39,1.3,0,.24,.17,.2,skin,g);box(0,1.55,0,.57,.22,.46,0xddd7bc,g);box(0,.76,.26,.44,.5,.07,0xe6d7af,g);box(0,.61,.43,.7,.1,.4,0x6f4e31,g);for(let i=0;i<3;i++)box(-.23+i*.23,.74,.43,.2,.17,.25,0xdeb773,g)}
  }
  return g;
 }
 function torch(x,z){box(x,1.3,z,.18,1.8,.18,0x615039);box(x,2.1,z,.38,.12,.34,0x433d2d);const f=new THREE.Group();f.position.set(x,2.28,z);box(0,0,0,.24,.4,.24,0xe9a148,f,true);box(0,.14,0,.12,.27,.12,0xffd68a,f,true);root.add(f);flames.push(f);const l=new THREE.PointLight(0xffb45d,8,6,2);l.position.set(x,2.8,z);root.add(l)}
 function scenery(room){
  for(let x=-7;x<=7;x++)for(let z=-6;z<=6;z++){const n=(Math.sin(x*71+z*139)+1)/2;box(x,-.23,z,.98,.45,.98,[0x71796c,0x777c6d,0x6b756a,0x828372][Math.floor(n*3.99)]);if(n>.92)box(x+.2,.015,z-.23,.35,.02,.19,0x525e49)}
  box(0,-.73,0,15.3,.57,13.3,0x435248);box(0,-1.1,0,14.8,.2,12.8,0x34433b);
  for(let row=0;row<4;row++){
   for(let x=-7;x<=7;x++){if(x>=3&&x<=5)continue;box(x+(row%2?.25:0),.35+row*.69,-6.4,.96,.66,.74,row%2?0x697262:0x737966)}
   for(let z=-5;z<=6;z++){if((z<=2&&row<3)||(z>2&&row===0))box(-7.4,.35+row*.69,z+(row%2?.24:0),.74,.66,.96,row%2?0x687160:0x737b69)}
  }
  for(let x=-7;x<=2;x++)box(x,3.13,-6.4,1.02,.17,.91,0x8b8b72);for(let z=-5;z<=1;z++)box(-7.4,2.45,z,.95,.17,1.02,0x838870);
  for(const side of[2.5,5.5]){box(side,1.78,-6.08,.65,3.56,.92,0x909079);box(side,3.46,-6.08,.92,.35,1.08,0xa29b7c);box(side,.22,-5.99,.92,.4,1.05,0x9c977b)}
  box(4,3.76,-6.08,2.6,.43,1.04,0x929277);box(4,4.03,-6.08,.62,.26,1.12,0xb0a57f);
  portal=new THREE.Mesh(new THREE.PlaneGeometry(2.36,3.24),new THREE.MeshStandardMaterial({color:0x696c8a,emissive:0x736592,emissiveIntensity:.85,transparent:true,opacity:.7,side:THREE.DoubleSide}));portal.position.set(4,1.64,-6.13);root.add(portal);
  portalLight=new THREE.PointLight(0xb8a2fa,12,8,2);portalLight.position.set(4,1.6,-5.5);root.add(portalLight);
  for(let x=3;x<=5;x++)box(x,.015,-5,.85,.04,.75,0xa0a68b);for(let row=0;row<3;row++)box(.4,-.23-row*.23,7+row*.6,3.2,.35,.62,0x74806e);
  torch(-6,-4.7);torch(1.4,-5.2);torch(6,4.7);
  for(let k=0;k<4;k++){box(-.9+k*.6,.015,-.3,.38,.03,.13,0x9e9c78);box(-.9+k*.6,.015,1.3,.38,.03,.13,0x9e9c78)}box(-1,.015,.5,.13,.03,1.45,0x9e9c78);box(1,.015,.5,.13,.03,1.45,0x9e9c78);
  for(let i=0;i<14;i++){const x=(Math.sin(i*53)*.5+.5)*13-6.5,z=i%2===0?-5.2:5.5;box(x,.07,z,.2+Math.abs(Math.sin(i))*.4,.16,.35,i%3?0x788257:0x93956a)}
  for(const x of[-5.7,-.7]){const c=room===1?0x656876:room===2?0x877747:0x477568;box(x,1.9,-5.95,.06,1.55,.08,0x423f32);box(x+.48,2,-5.94,.9,1.35,.08,c);box(x+.48,1.28,-5.94,.55,.2,.08,c);box(x+.48,2.09,-5.86,.18,.33,.04,0xc8b174)}
  if(room===0){for(let i=0;i<3;i++){const g=character('ghost');g.position.set(-1+i*1.05,.05,-2.9);g.rotation.y=.3;root.add(g);ghosts.push(g)}for(let i=0;i<3;i++){box(-5.7,.7,2+i*.9,.8,.13,.7,0x856f49);box(-5.7,.36,2+i*.9,.45,.7,.4,0x695b3d)}}
  if(room===1){for(const x of[-5.6,-2,0]){box(x,1.25,-5.6,1.45,2.5,.58,0x5d5239);for(const y of[.5,1.3,2.1]){box(x,y,-5.2,1.5,.12,.9,0x8a7650);for(let i=0;i<5;i++)box(x-.57+i*.27,y+.3,-5.34,.18,.4+(i%2)*.2,.45,[0x748f74,0x9b8056,0x687d8d,0xa06950,0xaea182][i])}}}
  if(room===1){box(1,.48,-2.4,3.3,.9,1.5,0x627a6b);for(let j=0;j<5;j++){const b=box(-.1+j*.55,1.12,-2.4,.53,.22,.7,0xc5b88c,root);bridgeParts.push(b)}}
  if(room===2){for(const x of[-2,-1,0]){box(x,1.1,-4.9,.12,2.2,.12,0x657066);box(x,.16,-4.9,.3,.24,.3,0x8b927c)}box(-1,2,-4.9,2.5,.18,.18,0x8b927c)}
  if(room===3){water=box(1,.06,-2,3.6,.15,2.2,0x3f777d,root);for(let i=0;i<4;i++)box(.1+i*.8,.17,-2,.48,.06,1.8,0x649599);for(let x=-5;x<3;x++)box(x,.32,-4,.85,.37,.4,0x8a8d6c);box(2,.65,-4,.42,1,.42,0x8a8d6c)}
  if(room===4){box(-.4,.27,-2.2,2,.5,2,0x686f5b);box(-.4,.65,-2.2,1.5,.3,1.5,0xa99c70);const c=box(-.4,1.43,-2.2,.7,1.25,.7,0x9ccaac,root,true);c.rotation.y=Math.PI/4;const l=new THREE.PointLight(0x90efb8,10,6,2);l.position.set(-.4,2,-2.2);root.add(l)}
 }
 function prop(item){
  const g=new THREE.Group();g.position.set(item.x,0,item.z);const kind=item.kind;
  if(kind==='goblin')g.add(character('goblin'));
  else if(kind==='mushroom'){box(0,.68,0,.57,1.2,.55,0xd1c09c,g);box(0,1.47,0,1.5,.45,1.2,0xa76548,g);box(0,1.79,0,.95,.23,.8,0xb47a57,g);box(-.4,1.7,.4,.23,.09,.2,0xe0c596,g);box(.35,1.7,-.25,.26,.1,.24,0xe0c596,g);box(-.15,.96,.29,.07,.1,.03,0x343e35,g);box(.15,.96,.29,.07,.1,.03,0x343e35,g);box(0,.5,.4,.68,.15,.6,0x607d65,g)}
  else if(['desk','scroll','books'].includes(kind)){
   box(0,.99,0,1.8,.18,1.05,0x927650,g);for(const x of[-.72,.72])for(const z of[-.38,.38])box(x,.45,z,.17,.9,.17,0x6e5c3b,g);
   box(0,1.13,0,.8,.08,.6,0xddcea2,g);box(-.28,1.14,0,.13,.15,.72,0xc5b586,g);box(.28,1.14,0,.13,.15,.72,0xc5b586,g);
   if(kind==='desk'){box(0,1.8,-.3,.09,1.4,.09,0x76613d,g);box(0,2.14,-.3,1.55,.49,.15,0xa59060,g);box(.3,2.14,-.2,.5,.11,.03,0xe1c994,g)}
   if(kind==='books')for(let i=0;i<4;i++)box(.12,1.25+i*.18,0,1-i*.1,.15,.6,[0x6b8774,0x9e764f,0x9c8e66,0x6a8385][i],g);
  }
  else if(kind==='bell'){box(0,.7,0,.5,1.4,.5,0x777a63,g);box(0,1.5,0,.95,.22,.8,0xa58d57,g);box(0,1.8,0,.6,.5,.55,0xcfb16a,g);box(0,2.14,0,.18,.16,.18,0xcfb16a,g)}
  else if(kind==='lever'){box(0,.32,0,1,.64,1,0x66796c,g);box(0,.69,0,.57,.16,.56,0xa89369,g);box(0,1.05,0,.14,.65,.15,0xc2bd9c,g);box(0,1.38,0,.6,.2,.22,0xae694a,g)}
  else if(kind==='pump'){box(0,.6,0,1.4,1.2,1.3,0x688c82,g);box(0,1.24,0,1.6,.16,1.5,0xb0a47c,g);box(0,1.62,0,.7,.64,.7,0x6a7770,g);box(0,1.65,.38,.45,.4,.09,0xbab38c,g);box(0,1.64,.44,.25,.05,.03,0x576a61,g)}
  else if(kind==='model'){box(0,.75,0,2,.2,1.5,0x8a7958,g);box(0,.36,0,1,.75,.75,0x64705c,g);for(let i=0;i<3;i++){box(-.55+i*.5,1.1,0,.4,.6,.5,0xbbaf86,g);box(-.55+i*.5,1.48,0,.5,.16,.6,0x648374,g)}}
  const marker=box(0,2.75,0,.2,.2,.2,0xefce86,g,true);marker.rotation.z=Math.PI/4;marker.rotation.x=Math.PI/4;g.userData={id:item.id};root.add(g);targets.push({...item,group:g,marker});
 }
 function clearRoom(){if(!root)return;scene.remove(root);root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&o.geometry!==cube)o.geometry.dispose();if(o.isPoints)o.material.dispose()});portal?.material.dispose()}
 function setRoom(index,state={}){
  clearRoom();root=new THREE.Group();scene.add(root);targets=[];flames=[];ghosts=[];effect=null;waypoints=[];bridgeParts=[];water=null;visited=state.visited||[];resolved=!!state.repaired;pending=null;selected=null;keys.clear();
  scenery(index);layouts[index].forEach(prop);player=character('player');player.position.set(.6,0,4.4);root.add(player);pip=character('pip');pip.position.set(1.9,0,3.6);root.add(pip);flush();
  const points=[];for(let i=0;i<48;i++)points.push(Math.sin(i*12.2)*7,1+Math.abs(Math.sin(i*4.1))*4,Math.cos(i*17.1)*5);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xd8c48d,size:.045,transparent:true,opacity:.58}));root.add(dust);setState(state);if(state.decision)showOutcome(index,state.decision.option);
 }
 function setState(state){visited=state.visited||[];resolved=!!state.repaired;for(const a of targets){a.marker.material=mat(visited.includes(a.id)?0xa3c59a:0xefce86,true);a.marker.scale.setScalar(visited.includes(a.id)?.14:.2)}if(portal){portal.material.color.set(resolved?0x8bae83:0x696c8a);portal.material.emissive.set(resolved?0x719c7e:0x736592);portalLight.color.set(resolved?0xaed999:0xb8a2fa)}}
 // Click navigation routes around props instead of getting stuck against them.
 function walkTo(x,z){
  const nodes=[],step=.4;
  for(let j=0;j<28;j++)for(let i=0;i<33;i++){const nx=-6.4+i*step,nz=-5.2+j*step;nodes.push({x:nx,z:nz,i,j,ok:!targets.some(a=>Math.hypot(nx-a.x,nz-a.z)<.86)})}
  const closest=(px,pz)=>nodes.reduce((best,n)=>n.ok&&Math.hypot(n.x-px,n.z-pz)<Math.hypot(best.x-px,best.z-pz)?n:best,nodes.find(n=>n.ok));
  const start=closest(player.position.x,player.position.z),end=closest(THREE.MathUtils.clamp(x,-6.4,6.4),THREE.MathUtils.clamp(z,-5.2,5.6)),queue=[start],prev=new Map([[start,null]]);
  for(let head=0;head<queue.length;head++){const n=queue[head];if(n===end)break;for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const i=n.i+di,j=n.j+dj;if(i<0||i>32||j<0||j>27)continue;const next=nodes[j*33+i];if(!next.ok||prev.has(next))continue;if(di&&dj&&(!nodes[n.j*33+i].ok||!nodes[j*33+n.i].ok))continue;prev.set(next,n);queue.push(next)}}
  if(!prev.has(end)){onPrompt('Try approaching from another side.');return}
  const route=[];for(let n=end;n&&n!==start;n=prev.get(n))route.unshift(new THREE.Vector3(n.x,0,n.z));
  waypoints=route;selected=waypoints.shift()||new THREE.Vector3(end.x,0,end.z);
 }
 function focus(id){const item=targets.find(x=>x.id===id);if(!item)return;walkTo(item.x+.8,item.z+1.2);pending=id}
 function showOutcome(room,choice){effect={room,choice,at:t};}
 function celebrate(){celebrationAt=t;}
 function nearest(){if(!player)return null;let near=null,dist=2.1;for(const item of targets){const d=Math.hypot(player.position.x-item.x,player.position.z-item.z);if(d<dist){dist=d;near=item}}if(Math.hypot(player.position.x-4,player.position.z+5)<2.1)return 'exit';return near}
 function interact(){if(document.querySelector('.modal-backdrop'))return;const near=nearest();if(near==='exit'){if(resolved)onExit();else onPrompt('Make your decision to open the passage.')}else if(near){pending=null;onInteract(near.id)}}
 function keydown(e){if((e.target.closest('input,textarea,select,a,[contenteditable="true"]')||(e.target.closest('button')&&e.code==='Space'))||document.querySelector('.modal-backdrop'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(['KeyE','Space'].includes(e.code)&&!e.repeat)interact()}}
 function keyup(e){keys.delete(e.code)}function blur(){keys.clear()}
 function pointerdown(e){lastPointer={x:e.clientX,y:e.clientY}}
 function pointerup(e){
  if(!lastPointer||Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>8)return;
  const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit))return;
  const hits=raycaster.intersectObjects(targets.map(t=>t.group),true);if(hits.length){let obj=hits[0].object;while(obj&&!obj.userData.id)obj=obj.parent;if(obj){focus(obj.userData.id);return}}
  if(Math.abs(hit.x)<=7&&Math.abs(hit.z)<=6){walkTo(hit.x,hit.z);pending=Math.hypot(hit.x-4,hit.z+5)<1.7?'exit':null}
 }
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h,size=aspect<1.1?12.4:10.6;camera.left=-size*aspect;camera.right=size*aspect;camera.top=size;camera.bottom=-size;camera.updateProjectionMatrix()}
 const ro=new ResizeObserver(resize);ro.observe(canvas);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointerup',pointerup);
 function animate(now){
  if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;t+=dt;
  let dx=0,dz=0;const blocked=!!document.querySelector('.modal-backdrop');
  if(!blocked){
   const sx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),sy=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
   if(sx||sy){selected=null;waypoints=[];pending=null;dx=sx*.82-sy*.57;dz=-sx*.57-sy*.82}
   else if(selected){dx=selected.x-player.position.x;dz=selected.z-player.position.z;if(Math.hypot(dx,dz)<.13){selected=waypoints.shift()||null;dx=0;dz=0;if(!selected&&pending){const id=pending;pending=null;if(id==='exit'){if(resolved)onExit();else onPrompt('Finish helping the residents to open the passage.')}else onInteract(id)}}}
   const len=Math.hypot(dx,dz);if(len>.03){
    const nx=THREE.MathUtils.clamp(player.position.x+dx/len*dt*3.3,-6.6,6.6),nz=THREE.MathUtils.clamp(player.position.z+dz/len*dt*3.3,-5.3,5.7);
    const collides=(x,z)=>targets.some(a=>Math.hypot(x-a.x,z-a.z)<.62);
    if(!collides(nx,nz)){player.position.x=nx;player.position.z=nz}else if(!collides(nx,player.position.z))player.position.x=nx;else if(!collides(player.position.x,nz))player.position.z=nz;
    player.rotation.y=Math.atan2(dx,dz);stepT+=dt*12;player.position.y=reduced?0:Math.abs(Math.sin(stepT))*.09;
   }else player.position.y=reduced?0:Math.sin(t*2)*.015;
   const px=player.position.x+1.1-pip.position.x,pz=player.position.z+.3-pip.position.z;if(Math.hypot(px,pz)>1){pip.position.x+=px*dt*2;pip.position.z+=pz*dt*2;pip.rotation.y=Math.atan2(px,pz)}pip.position.y=reduced?0:Math.sin(t*3)*.035;
   const near=nearest(),next=near==='exit'?(resolved?'E · Enter the next chamber':'The passage awaits your decision'):near?`E · ${near.kind==='goblin'?'Talk to Bramble':near.kind==='mushroom'?'Talk to Mallow':'Investigate'}`:'';if(next!==prompt){prompt=next;onPrompt(next)}
  }
  if(effect){
   const age=t-effect.at,factor=reduced?1:Math.min(age*.35,1);
   if(effect.room===0)ghosts.forEach((g,i)=>{if(effect.choice!==2||i<2){g.position.x=THREE.MathUtils.lerp(-1+i*1.05,3+i*.55,factor);g.position.z=THREE.MathUtils.lerp(-2.9,-4.5+i*.45,factor)}});
   if(effect.room===1)bridgeParts.forEach((b,i)=>{const broken=effect.choice===1&&!resolved;b.rotation.z=broken?Math.sin(i*2)*factor*.65:0;b.position.y=broken?1.12-factor*.38:1.12});
   if(effect.room===3&&water){const flood=!resolved;water.scale.x=3.6+(flood?factor*2:0);water.scale.z=2.2+(flood?factor*1.5:0);water.position.y=flood?.12+factor*.12:.06}
   if(effect.room===2){const g=targets.find(a=>a.kind==='goblin');if(g){const open=effect.choice!==2||resolved;g.group.position.z=THREE.MathUtils.lerp(2,open?-3.5:2,factor);g.group.position.x=THREE.MathUtils.lerp(3,open?4:3,factor);g.x=g.group.position.x;g.z=g.group.position.z}}
  }
  if(!reduced&&t-celebrationAt<2)pip.position.y=Math.abs(Math.sin((t-celebrationAt)*7))*.4;
  if(!reduced){flames.forEach((f,i)=>{f.scale.y=1+Math.sin(t*8+i)*.13;f.rotation.y=t*.7});ghosts.forEach((g,i)=>{g.position.y=.09+Math.sin(t*2+i)*.12});targets.forEach((a,i)=>{a.marker.position.y=2.75+Math.sin(t*2+i)*.09;a.marker.rotation.y=t});dust.rotation.y=t*.018;portal.material.opacity=.68+Math.sin(t*2)*.08}
  renderer.render(scene,camera);
 }
 setRoom(0);resize();frame=requestAnimationFrame(animate);
 return {setRoom,setState,focus,interact,showOutcome,celebrate,dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);canvas.removeEventListener('pointerdown',pointerdown);canvas.removeEventListener('pointerup',pointerup);clearRoom();renderer.dispose();mats.forEach(m=>m.dispose());cube.dispose()}};
}
