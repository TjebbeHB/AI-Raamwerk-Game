const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeWalker,jump,stepWalker,course}=require('../client/traversal.cjs');
function run(w,seconds,options={}){for(let i=0;i<seconds*120;i++)stepWalker(w,{dt:1/120,...options})}
const crate={kind:'crate',x:0,z:0,w:2,d:.65,height:.64};
const beam={kind:'beam',x:0,z:0,w:2,d:.6,bottom:1.02,top:1.43};
test('a crate stops walking but a timed jump crosses it and lands',()=>{
 const walking=makeWalker(0,1.3);run(walking,1,{dz:-1,solids:[crate]});assert.ok(walking.z>.55);
 const leaping=makeWalker(0,1.3);assert.equal(jump(leaping,[crate]),true);assert.equal(jump(leaping,[crate]),false);run(leaping,1,{dz:-1,solids:[crate]});assert.ok(leaping.z<-.8);assert.equal(leaping.y,0);assert.equal(leaping.grounded,true);
});
test('crawl fits below a beam and standing up waits until the head is clear',()=>{
 const w=makeWalker(0,1.4);run(w,.6,{dz:-1,solids:[beam]});assert.ok(w.z>.56);
 run(w,.4,{dz:-1,crouch:true,solids:[beam]});assert.ok(Math.abs(w.z)<.2);
 run(w,.1,{solids:[beam]});assert.equal(w.crouched,true);assert.equal(jump(w,[beam]),false);
 run(w,1,{dz:-1,solids:[beam]});assert.ok(w.z<-.6);assert.equal(w.crouched,false);
});
test('touching the roller resets position while clearing it in the air succeeds',()=>{
 const hazard={x:0,z:0,w:.8,d:.8,height:.62},w=makeWalker(0,0);
 assert.equal(stepWalker(w,{dt:.01,hazard}).bumped,true);assert.deepEqual([w.x,w.z],[.6,4.4]);assert.ok(w.cooldown>0);
 const airborne=makeWalker(0,0);airborne.y=1;airborne.grounded=false;
 assert.equal(stepWalker(airborne,{dt:.01,hazard}).bumped,false);assert.equal(airborne.x,0);
});
test('the course can also be bypassed on foot without jumping or crawling',()=>{
 for(const variant of [0,1]){const w=makeWalker(5,4.4);run(w,2.8,{dz:-1,solids:course(variant)});assert.ok(w.z<-4);assert.equal(w.y,0)}
});
