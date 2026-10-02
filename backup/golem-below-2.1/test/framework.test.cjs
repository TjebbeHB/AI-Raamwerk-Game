const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../game/engine.cjs');
const {TOPICS}=require('../game/topics.cjs');
function fixture(){const s=E.newSession(undefined,'framework');const host=s.hostToken;const a=E.join(s,{name:'Noor'}).token,b=E.join(s,{name:'Pip'}).token;return {s,host,a,b,act:(type,extra={},token=host)=>E.applyAction(s,token,{type,topic:s.topic,epoch:s.epoch,...extra})}}
function prepare(f,d){f.act('enter',{target:d.id});for(const c of d.clues)f.act('inspect',{clue:c.id});f.act('openVote')}

test('all fourteen cases work in any order, including supporting answers, notes and final report',()=>{
 assert.equal(TOPICS.length,14);assert.equal(TOPICS.filter(t=>t.group==='foundation').length,4);assert.equal(new Set(TOPICS.map(t=>t.id)).size,14);
 const f=fixture();
 for(const d of [...TOPICS].reverse()){
  assert.equal(d.clues.length,3);assert.ok(d.options.some(o=>o.status==='correct'));
  prepare(f,d);
  f.act('vote',{selection:[0,1]},f.a);f.act('vote',{selection:[1,2]},f.b);
  f.act('vote',{selection:[2]},f.a);
  const before=E.publicSession(f.s,f.host).topics[d.id];assert.equal(before.ballots,2);assert.deepEqual(before.counts.slice(0,3),[0,1,2]);
  const selection=d.options.flatMap((o,i)=>o.status!=='incorrect'?[i]:[]);
  f.act('decide',{selection,reason:'Past bij onze pilot.'});
  const r=E.publicSession(f.s,f.a).topics[d.id];assert.equal(r.result.complete,true);assert.deepEqual(r.result.selection,selection);
  assert.throws(()=>f.act('vote',{selection:[0]},f.a),e=>e.status===409);
  assert.throws(()=>f.act('decide',{selection}),e=>e.status===409);
  f.act('note',{note:`Actie voor ${d.title}`});f.act('hub');
 }
 f.act('finish');assert.equal(f.s.completed,true);
 const report=E.buildReport(f.s,f.a);for(const d of TOPICS){assert.ok(report.includes(d.title));assert.ok(report.includes(`Actie voor ${d.title}`))}
 for(const value of [E.publicSession(f.s,f.a),report])for(const token of [f.a,f.b,f.host])assert.ok(!JSON.stringify(value).includes(token));
 assert.throws(()=>f.act('enter',{target:TOPICS[0].id}),e=>e.status===409);
 assert.equal(E.join(f.s,{token:f.a}).token,f.a);
});

test('late ballots cannot cross rooms, revisits or retry rounds; historical votes are frozen',()=>{
 const f=fixture(),d=TOPICS[0];prepare(f,d);const firstEpoch=f.s.epoch;
 f.act('vote',{selection:[0,2]},f.a);f.act('decide',{selection:[0]});
 const first=structuredClone(f.s.topics[d.id].attempts[0]);assert.equal(first.complete,false);assert.ok(first.missing.length);
 f.act('retry');assert.deepEqual(E.publicSession(f.s,f.host).topics[d.id].counts,[0,0,0,0,0,0]);
 assert.throws(()=>E.applyAction(f.s,f.a,{type:'vote',topic:d.id,epoch:firstEpoch,selection:[1]}),e=>e.status===409);
 f.act('vote',{selection:[1]},f.a);f.act('decide',{selection:[1,5]});assert.deepEqual(f.s.topics[d.id].attempts[0],first);assert.deepEqual(f.s.topics[d.id].attempts[1].unsuitable,[1]);
 f.act('hub');f.act('enter',{target:d.id});assert.equal(f.s.topics[d.id].attempts.length,2);assert.equal(f.s.topics[d.id].visited.length,3);
 const oldEpoch=f.s.epoch;f.act('hub');f.act('enter',{target:d.id});
 assert.throws(()=>E.applyAction(f.s,f.host,{type:'note',topic:d.id,epoch:oldEpoch,note:'stale'}),e=>e.status===409);
 const text=E.buildReport(f.s,f.host);assert.ok(text.includes('Bespreking 1'));assert.ok(text.includes('Bespreking 2'));
});

test('partial exploration is retained, vote clearing is allowed, malformed selections and role changes fail',()=>{
 const f=fixture(),d=TOPICS[0];assert.throws(()=>f.act('finish'));f.act('enter',{target:d.id});
 assert.equal(f.s.topics[d.id].opened,true);f.act('inspect',{clue:'a'});f.act('hub');f.act('enter',{target:d.id});assert.deepEqual(f.s.topics[d.id].visited,['a']);
 f.act('inspect',{clue:'b'});f.act('inspect',{clue:'c'});f.act('openVote');
 for(const selection of [null,'A',[0,0],[-1],[1.2],[9],[NaN]])assert.throws(()=>f.act('vote',{selection},f.a));
 f.act('vote',{selection:[2,0]},f.a);assert.deepEqual(E.publicSession(f.s,f.a).topics[d.id].ownVote,[0,2]);
 f.act('vote',{selection:[]},f.a);assert.equal(E.publicSession(f.s,f.host).topics[d.id].ballots,0);
 assert.throws(()=>f.act('decide',{selection:[]}));assert.throws(()=>f.act('vote',{selection:[0]}),e=>e.status===403);
 for(const type of ['enter','hub','inspect','decide','retry','note','finish'])assert.throws(()=>f.act(type,{target:d.id,selection:[0],clue:'a'},f.a),e=>e.status===403);
 f.act('decide',{selection:[0,2,3,5]});assert.equal(f.s.topics[d.id].attempts[0].complete,true);
 f.act('hub');f.act('finish');assert.equal(f.s.completed,true);assert.equal(Object.values(f.s.topics).filter(r=>r.attempts.length).length,1);
});

test('hosted multi-select votes and competing decisions are atomic',async()=>{
 const {DatabaseSync}=require('node:sqlite');const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE golem_sessions (code TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)');
 const db={prepare:q=>({bind:(...args)=>({first:async()=>sql.prepare(q).get(...args),run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})})})};
 const {pathToFileURL}=require('node:url'),path=require('node:path');const worker=(await import(pathToFileURL(path.resolve('dist/server/index.js')).href)).default;
 const call=async(route,body,token='')=>{const r=await worker.fetch(new Request('https://example.invalid/api/game/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:token?`Bearer ${token}`:''},body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()}};
 const created=await call('create',{mode:'framework'});assert.equal(created.status,201);let s=created.data.session;const host=created.data.token,code=s.code;
 assert.deepEqual((await call(code+'/info')).data,{mode:'framework'});
 const members=await Promise.all([0,1,2,3].map(i=>call(code+'/join',{name:'Raad '+i})));assert.ok(members.every(m=>m.status===200));
 const action=async(type,extra={})=>{const r=await call(code+'/action',{type,topic:s.topic,epoch:s.epoch,...extra},host);assert.equal(r.status,200);s=r.data.session;return r};
 await action('enter',{target:'governance'});for(const clue of ['a','b','c'])await action('inspect',{clue});await action('openVote');
 const context={topic:s.topic,epoch:s.epoch};
 const votes=await Promise.all(members.map(m=>call(code+'/action',{...context,type:'vote',selection:[0,2]},m.data.token)));assert.ok(votes.every(v=>v.status===200));
 const before=(await call(code,undefined,host)).data.session;assert.deepEqual(before.topics.governance.counts,[4,0,4,0,0,0]);
 const decisions=await Promise.all([[0,2,3],[1]].map(selection=>call(code+'/action',{...context,type:'decide',selection},host)));assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
 const after=(await call(code,undefined,host)).data.session;assert.equal(after.topics.governance.attemptCount,1);assert.equal(after.topics.governance.result.ballots,4);sql.close();
});


test('every room can be answered immediately without visiting sources',()=>{
 const f=fixture();
 for(const d of TOPICS){
  f.act('enter',{target:d.id});assert.equal(f.s.topics[d.id].opened,true);assert.deepEqual(f.s.topics[d.id].visited,[]);
  const selection=d.options.flatMap((o,i)=>o.status==='correct'?[i]:[]);
  f.act('vote',{selection},f.a);const epoch=f.s.epoch;
  // Consulting a source during the vote does not discard votes or change the round.
  if(d.id==='governance'){f.act('inspect',{clue:'a'});assert.equal(f.s.epoch,epoch);assert.deepEqual(E.publicSession(f.s,f.a).topics[d.id].ownVote,selection)}
  f.act('decide',{selection});assert.equal(f.s.topics[d.id].attempts[0].complete,true);f.act('hub');
 }
});

test('source text adds practical depth to every clue',()=>{
 for(const d of TOPICS)for(const c of d.clues){assert.ok(c.explanation.length>180,`${d.id}/${c.id}`);assert.equal(c.steps.length,2);assert.ok(c.example.length>80);assert.ok(c.section)}
});
