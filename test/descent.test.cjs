const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const D=require('../game/descent.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gewelf-test-'));
process.env.GOLEM_DATA_FILE=path.join(temp,'sessions.json');
const handle=require('../game/local-api.cjs');
let server,origin;
before(async()=>{server=http.createServer(async(req,res)=>{if(!await handle(req,res,new URL(req.url,`http://${req.headers.host}`))){res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`});
after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true})});
async function request(route,method='GET',body,token=''){
 const res=await fetch(origin+'/api/game/'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=res.headers.get('content-type').includes('application/json')?await res.json():await res.text();return {status:res.status,data};
}
const core=id=>D.CHAMBERS.find(c=>c.id===id).options.flatMap((o,i)=>o.status==='correct'?[i]:[]);
const topicsWith=map=>{const s=D.initial();for(const [id,state] of Object.entries(map))s.topics[id].attempts.push({complete:state==='strong'});return s.topics};

test('content: every chamber has three sources, core measures and a placement',()=>{
 assert.equal(D.CHAMBERS.length,15);
 for(const c of D.CHAMBERS){assert.equal(c.clues.length,3,c.id);assert.ok(core(c.id).length>=2,c.id);assert.ok(c.options.length>=5,c.id);assert.ok(c.npc&&c.place&&c.reflection,c.id)}
 assert.equal(D.VERDICT.options.length,4);assert.equal(D.DEPTHS.length,5);
});

test('dossier: the ceiling follows what was examined',()=>{
 assert.equal(D.assess(topicsWith({})).ceiling,1,'nothing examined: research at most');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'open'})).ceiling,1,'no owner: no pilot');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'strong'})).ceiling,1,'no evaluation plan: no pilot');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'strong',evaluation:'open'})).ceiling,2,'owner and a measured pilot');
 const all=Object.fromEntries(D.CHAMBERS.map(c=>[c.id,'strong']));
 assert.equal(D.assess(topicsWith(all)).ceiling,3);
 assert.equal(D.assess(topicsWith({...all,security:'open'})).ceiling,2,'critical domain open');
 assert.equal(D.assess(topicsWith({...all,quality:'blind',interaction:'blind',performance:'blind',functionality:'blind',sustainability:'blind'})).ceiling,2,'too few domains');
 const d=D.assess(topicsWith({necessity:'strong',governance:'open'}));
 assert.deepEqual(d.strong,['necessity']);assert.deepEqual(d.open,['governance']);assert.equal(d.blind.length,13);
 assert.ok(d.reasons.every((r,i,a)=>!i||a[i-1].level<=r.level),'most limiting reasons first');
});

test('judgement: stopping is always legitimate, overreach is named',()=>{
 assert.equal(D.judge(0,1),'grounded');assert.equal(D.judge(0,3),'cautious-stop');
 assert.equal(D.judge(2,2),'supported');assert.equal(D.judge(1,2),'cautious');assert.equal(D.judge(3,2),'beyond');
});

test('a full descent: roles, rooms, council votes, verdict, commitments and report',async()=>{
 const created=await request('create','POST',{});assert.equal(created.status,201);
 const {token:host,session:{code}}=created.data;assert.equal(created.data.session.mode,'descent');
 const a=(await request(code+'/join','POST',{name:'Mallow'})).data,b=(await request(code+'/join','POST',{name:'Bram'})).data;
 assert.equal(a.session.role,'audience');assert.equal((await request(code)).status,401);
 assert.ok(!JSON.stringify(a.session).includes(host),'host pass is never exposed');
 let s=created.data.session;
 const act=async(type,extra={},token=host)=>{const res=await request(code+'/action','POST',{type,topic:s.topic,epoch:s.epoch,...extra},token);if(res.status===200&&token===host)s=res.data.session;return res};
 assert.equal((await act('move',{depth:1},a.token)).status,403,'only the player moves');
 assert.equal((await act('move',{depth:9})).status,400);
 assert.equal((await act('move',{depth:1})).status,200);assert.equal(s.depth,1);
 assert.equal((await act('decide',{selection:[0]})).status,409,'no room entered');
 assert.equal((await act('enter',{target:'necessity'})).status,200);assert.equal(s.topic,'necessity');assert.ok(s.topics.necessity.opened);
 assert.equal((await act('move',{depth:2})).status,409,'leave the room first');
 assert.equal((await act('inspect',{clue:'b'})).status,200);assert.deepEqual(s.topics.necessity.visited,['b']);
 assert.equal((await act('inspect',{clue:'zz'})).status,400);
 assert.equal((await act('vote',{selection:[0,1]},a.token)).status,200);
 assert.equal((await act('vote',{selection:[0,2]},b.token)).status,200);
 assert.equal((await act('vote',{selection:[0]})).status,403,'the player does not vote');
 const stale=await request(code+'/action','POST',{type:'vote',topic:'necessity',epoch:s.epoch-1,selection:[1]},a.token);assert.equal(stale.status,409,'late votes are rejected');
 assert.equal((await act('decide',{selection:core('necessity'),reason:'Eerst het probleem.'})).status,200);
 const nec=s.topics.necessity.result;assert.ok(nec.complete);assert.deepEqual(nec.counts.slice(0,3),[2,1,1]);assert.equal(nec.ballots,2);
 assert.equal((await act('vote',{selection:[1]},a.token)).status,409,'votes close with the decision');
 assert.equal((await act('note',{note:'Klantreis maken'})).status,200);
 assert.equal((await act('enter',{target:'governance'})).status,200);assert.equal(s.depth,2,'entering a room sets its depth');
 assert.equal((await act('decide',{selection:[1]})).status,200);assert.ok(!s.topics.governance.result.complete);
 assert.deepEqual(s.dossier.open,['governance']);
 assert.equal((await act('retry')).status,200);assert.ok(s.topics.governance.opened);
 assert.equal((await act('decide',{selection:core('governance')})).status,200);assert.equal(s.topics.governance.attemptCount,2);
 assert.equal((await act('hub')).status,200);assert.equal(s.topic,null);
 assert.equal((await act('finish')).status,409,'seal a verdict first');
 assert.equal((await act('enter',{target:'verdict'})).status,200);assert.equal(s.depth,4);
 assert.equal((await act('vote',{selection:[1,2]},a.token)).status,400,'one verdict per advisor');
 assert.equal((await act('vote',{selection:[1]},a.token)).status,200);
 assert.equal((await act('decide',{selection:[3],reason:'Snel live'})).status,200);
 const v=s.topics.verdict.result;assert.equal(v.judgement,'beyond');assert.equal(v.ceiling,1);assert.equal(v.counts[1],1);assert.ok(v.dossier.reasons.length>0);
 assert.equal((await act('commit',{reviewDate:'morgen'})).status,400);
 assert.equal((await act('commit',{owner:'Teamleider KCC',firstStep:'Probleemanalyse',reviewDate:'2026-12-01',stopCondition:'Geen daling wachttijd'})).status,200);
 assert.equal(s.commitments.owner,'Teamleider KCC');
 assert.equal((await act('finish')).status,200);assert.ok(s.completed);
 assert.equal((await act('enter',{target:'quality'})).status,409,'completed descents are closed');
 assert.equal((await request(code+'/join','POST',{name:'Laat'})).status,409);
 const report=await request(code+'/report','GET',undefined,b.token);assert.equal(report.status,200);
 for(const text of ['Besluitdossier','Invoeren met waarborgen','Dit besluit gaat verder dan het dossier kan dragen.','Teamleider KCC','Klantreis maken','### Bespreking 2','## Blinde vlekken','- Beveiliging'])assert.ok(report.data.includes(text),text);
});

test('sessions from the previous version are refused politely',async()=>{
 const E=require('../game/engine.cjs');
 const old={code:'ABCDEF',hostToken:'x',mode:'framework',audience:[]};
 assert.throws(()=>E.publicSession(old,'x'),e=>e.status===410);
});
