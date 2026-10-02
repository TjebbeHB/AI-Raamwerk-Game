const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const E=require('../game/engine.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'golem-test-'));
process.env.GOLEM_DATA_FILE=path.join(temp,'sessions.json');
const handle=require('../game/local-api.cjs');
let server,origin;
before(async()=>{server=http.createServer(async(req,res)=>{if(!await handle(req,res,new URL(req.url,`http://${req.headers.host}`))){res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`});
after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true})});
async function request(route,method='GET',body,token=''){
 const res=await fetch(origin+'/api/game/'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=res.headers.get('content-type').includes('application/json')?await res.json():await res.text();return {status:res.status,data};
}
function noTokens(view,...tokens){const text=JSON.stringify(view);for(const token of tokens)assert.ok(!text.includes(token),'A session pass was exposed');assert.ok(!text.includes('hostToken'));}

test('five chambers: separate player and audience, changed votes, override, repairs, frozen report',async()=>{
 const created=await request('create','POST',{});assert.equal(created.status,201);
 const {token:host,session:{code}}=created.data;
 const a=(await request(code+'/join','POST',{name:'Mallow'})).data;
 const b=(await request(code+'/join','POST',{name:'Bramble'})).data;
 assert.equal(a.session.role,'audience');
 assert.equal((await request(code)).status,401);
 const act=(type,room,extra={},token=host)=>request(code+'/action','POST',{type,room,...extra},token);
 assert.equal((await act('inspect',0,{clue:'signs'},a.token)).status,403);
 assert.equal((await act('openVote',0)).status,409);
 assert.equal((await act('vote',0,{option:0},a.token)).status,409);
 const rejoin=(await request(code+'/join','POST',{name:'same member',token:a.token})).data;
 assert.equal(rejoin.token,a.token);assert.equal(rejoin.session.audienceCount,2);
 for(let room=0;room<5;room++){
  for(const clue of E.ROOMS[room].clues)assert.equal((await act('inspect',room,{clue:clue.id})).status,200);
  assert.equal((await act('openVote',room)).status,200);
  assert.equal((await act('vote',room,{option:0},host)).status,403);
  await act('vote',room,{option:2},a.token);await act('vote',room,{option:0},a.token);await act('vote',room,{option:0},b.token);
  const before=(await request(code,'GET',undefined,host)).data.session;assert.deepEqual(before.rooms[room].counts,[2,0,0]);
  const chosen=await act('decide',room,{option:1,reason:'We considered the tradeoff.'});assert.equal(chosen.status,200);
  assert.equal(chosen.data.session.rooms[room].decision.relation,'Chose another path');
  noTokens(chosen.data.session,host,a.token,b.token);
  assert.equal((await act('vote',room,{option:2},a.token)).status,409);
  assert.equal((await act('decide',room,{option:2})).status,409);
  assert.equal((await act('next',room)).status,409);
  const wrong=await act('repair',room,{option:(E.ROOMS[room].puzzle.answer+1)%3});assert.equal(wrong.data.correct,false);
  assert.equal(wrong.data.session.rooms[room].repaired,false);
  const repair=await act('repair',room,{option:E.ROOMS[room].puzzle.answer});assert.equal(repair.data.correct,true);
  await act('note',room,{note:`Project reflection ${room+1}`});
  if(room===4)assert.equal((await act('charter',room,{owner:'Service team',project:'Small trial',reviewDate:'2026-10-01',measure:'Residents helped',stopCondition:'Missed urgent cases'})).status,200);
  assert.equal((await act('next',room)).status,200);
  assert.equal((await act('vote',room,{option:2},a.token)).status,409);
 }
 const final=(await request(code,'GET',undefined,host)).data.session;assert.equal(final.completed,true);assert.equal(final.room,4);assert.equal(final.rooms.filter(r=>r.repaired).length,5);
 const report=await request(code+'/report','GET',undefined,host);assert.equal(report.status,200);assert.ok(report.data.includes('Project reflection 5'));assert.ok(report.data.includes('Owner: Service team'));noTokens(report.data,host,a.token,b.token);
 const stored=JSON.parse(fs.readFileSync(process.env.GOLEM_DATA_FILE,'utf8')).sessions[code];assert.equal(stored.completed,true);assert.deepEqual(stored.rooms[0].decision.counts,[2,0,0]);
});

test('ties and zero audience votes both allow player choice',()=>{
 for(const tied of[false,true]){
  const s=E.newSession();for(const c of E.ROOMS[0].clues)E.applyAction(s,s.hostToken,{type:'inspect',room:0,clue:c.id});E.applyAction(s,s.hostToken,{type:'openVote',room:0});
  if(tied){const a=E.join(s,{name:'A'}),b=E.join(s,{name:'B'});E.applyAction(s,a.token,{type:'vote',room:0,option:0});E.applyAction(s,b.token,{type:'vote',room:0,option:1})}
  E.applyAction(s,s.hostToken,{type:'decide',room:0,option:1});assert.equal(s.rooms[0].decision.relation,tied?'Chose a tied recommendation':'No audience votes');
 }
});

test('every choice path can finish, with no AI route required',()=>{
 for(let option=0;option<3;option++){
  const s=E.newSession();for(let room=0;room<5;room++){
   for(const c of E.ROOMS[room].clues)E.applyAction(s,s.hostToken,{type:'inspect',room,clue:c.id});
   for(const action of[{type:'openVote'},{type:'decide',option},{type:'repair',option:E.ROOMS[room].puzzle.answer},{type:'next'}])E.applyAction(s,s.hostToken,{room,...action});
  }assert.equal(s.completed,true);
 }
});

test('membership limit, reconnect, token isolation and invalid actions',()=>{
 const s=E.newSession(),other=E.newSession();let first;
 for(let i=0;i<15;i++){const a=E.join(s,{name:'Member '+i});first ||= a}
 assert.equal(E.join(s,{token:first.token}).token,first.token);
 assert.throws(()=>E.join(s,{name:'Overflow'}),e=>e.status===409);
 assert.throws(()=>E.publicSession(s,other.hostToken),e=>e.status===401);
 assert.throws(()=>E.applyAction(s,s.hostToken,{type:'inspect',room:1,clue:'mallow'}),e=>e.status===409);
 assert.throws(()=>E.applyAction(s,s.hostToken,{type:'teleport',room:0}),e=>e.status===400);
 noTokens(E.publicSession(s,first.token),s.hostToken,...s.audience.map(a=>a.token));
});

test('hosted Worker CAS preserves simultaneous votes and freezes one decision',async()=>{
 const {DatabaseSync}=require('node:sqlite');const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE golem_sessions (code TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)');
 const db={
  prepare(query){
   return {bind(...values){
    return {
     async first(){return sql.prepare(query).get(...values)},
     async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}}}
    };
   }};
  }
 };
 const worker=(await import(pathToFileURL(path.resolve('dist/server/index.js')).href)).default;
 const call=async(route,method='GET',body,token='')=>{const res=await worker.fetch(new Request('https://test.invalid/api/game/'+route,{method,headers:{'Content-Type':'application/json',Authorization:token?`Bearer ${token}`:''},body:body===undefined?undefined:JSON.stringify(body)}),{DB:db});return {status:res.status,data:await res.json()}};
 const created=await call('create','POST',{});assert.equal(created.status,201);const {token:host,session:{code}}=created.data;
 const joined=await Promise.all(Array.from({length:4},(_,i)=>call(code+'/join','POST',{name:'Voter '+i})));assert.ok(joined.every(x=>x.status===200));
 for(const c of E.ROOMS[0].clues)await call(code+'/action','POST',{type:'inspect',room:0,clue:c.id},host);
 await call(code+'/action','POST',{type:'openVote',room:0},host);
 const ballots=await Promise.all(joined.map(j=>call(code+'/action','POST',{type:'vote',room:0,option:0},j.data.token)));assert.ok(ballots.every(x=>x.status===200));
 const state=await call(code,'GET',undefined,host);assert.deepEqual(state.data.session.rooms[0].counts,[4,0,0]);
 const choices=await Promise.all([1,2].map(option=>call(code+'/action','POST',{type:'decide',room:0,option},host)));assert.deepEqual(choices.map(c=>c.status).sort(),[200,409]);
 const after=await call(code,'GET',undefined,host);assert.deepEqual(after.data.session.rooms[0].decision.counts,[4,0,0]);
 assert.equal((await call(code+'/action','POST',{type:'vote',room:0,option:1},joined[0].data.token)).status,409);
 const noauth=await call(code);assert.equal(noauth.status,401);sql.close();
});

test('local framework API retains visits, audience multiselect and notes on disk',async()=>{
 const made=await request('create','POST',{mode:'framework'});assert.equal(made.status,201);let s=made.data.session;const host=made.data.token,code=s.code;
 assert.equal((await request(code+'/info')).data.mode,'framework');
 const a=(await request(code+'/join','POST',{name:'Adviseur'})).data.token;
 const act=async(type,extra={},pass=host)=>{const r=await request(code+'/action','POST',{type,topic:s.topic,epoch:s.epoch,...extra},pass);assert.equal(r.status,200);s=r.data.session;return r};
 await act('enter',{target:'security'});for(const clue of ['a','b','c'])await act('inspect',{clue});await act('openVote');
 await act('vote',{selection:[1,3,4]},a);await act('decide',{selection:[1,3,4]});assert.equal(s.topics.security.result.complete,true);
 await act('note',{note:'Toolrechten beperken'});await act('hub');await act('finish');
 const stored=JSON.parse(fs.readFileSync(process.env.GOLEM_DATA_FILE,'utf8')).sessions[code];assert.equal(stored.topics.security.note,'Toolrechten beperken');
 const report=await request(code+'/report','GET',undefined,a);assert.equal(report.status,200);assert.ok(report.data.includes('Toolrechten beperken'));noTokens(report.data,host,a);
});
