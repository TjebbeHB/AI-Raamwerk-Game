const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const D=require('../game/descent.cjs');
const S=require('../game/stories.cjs');
const T=require('../client/trials.cjs');
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
const core=(story,id)=>S.content(story).chambers.find(c=>c.id===id).options.flatMap((o,i)=>o.status==='correct'?[i]:[]);
const topicsWith=map=>{const s=D.initial();for(const [id,state] of Object.entries(map))s.topics[id].attempts.push({complete:state==='strong'});return s.topics};
const all=Object.fromEntries(S.CHAMBER_IDS.map(id=>[id,'strong']));

test('content: three complete stories that share the framework chambers',()=>{
 assert.deepEqual(S.STORIES.map(s=>s.id),['loket','bezwaar','woo']);
 for(const st of S.STORIES){
  const c=S.content(st.id);
  assert.equal(c.chambers.length,15,st.id);assert.equal(c.levels.length,8);
  for(const ch of c.chambers){
   assert.equal(ch.clues.length,3,`${st.id}/${ch.id}`);assert.ok(ch.options.filter(o=>o.status==='correct').length>=2,`${st.id}/${ch.id}`);
   for(const o of ch.options)assert.ok(o.text&&o.feedback,`${st.id}/${ch.id} option`);
   assert.ok(ch.trial&&ch.trial.title&&ch.trial.finding&&ch.trial.task,`${st.id}/${ch.id} trial`);assert.ok(T.total(ch.trial)>0,`${st.id}/${ch.id} trial size`);
  }
  for(const a of st.arenas)for(const w of a.waves)for(const [k,n] of w)assert.ok(st.mobs[k]&&n>0,`${st.id}/${a.id}/${k}`);
  assert.ok(st.mobs[st.boss.minion]&&st.boss.phases.length===3);
  for(const k of ['lamp','scale','seal'])assert.ok(st.boss.phases.some(p=>p.tool===k),`${st.id} boss needs every tool`);
  for(const [choice,j] of [[0,'grounded'],[0,'cautious-stop'],[1,'cautious'],[2,'supported'],[2,'beyond'],[3,'supported'],[3,'beyond']])assert.ok(S.epilogue(st.id,choice,j).length>40,`${st.id} epilogue ${choice}/${j}`);
  assert.ok(st.verdict.critical.every(id=>c.chambers.some(x=>x.id===id)));
 }
 // story overrides really change the case, not the framework question set
 const a=S.content('loket').chambers.find(c=>c.id==='governance'),b=S.content('bezwaar').chambers.find(c=>c.id==='governance');
 assert.notEqual(a.scenario,b.scenario);assert.equal(a.options.length,b.options.length);
 assert.match(S.content('woo').chambers.find(c=>c.id==='interaction').options[2].text,/lakking/);
 assert.equal(S.content('nonsense').story.id,'loket','unknown stories fall back to the first');
});

test('dossier: the ceiling follows what was examined, with critical domains per story',()=>{
 assert.equal(D.assess(topicsWith({})).ceiling,1,'nothing examined: research at most');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'open'})).ceiling,1,'no owner: no pilot');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'strong'})).ceiling,1,'no evaluation plan: no pilot');
 assert.equal(D.assess(topicsWith({necessity:'strong',governance:'strong',evaluation:'open'})).ceiling,2,'owner and a measured pilot');
 for(const id of ['loket','bezwaar','woo'])assert.equal(D.assess(topicsWith(all),id).ceiling,3,id);
 assert.equal(D.assess(topicsWith({...all,quality:'open'}),'loket').ceiling,2,'quality is critical for the resident assistant');
 assert.equal(D.assess(topicsWith({...all,quality:'open'}),'bezwaar').ceiling,3,'but not for the objections story');
 assert.equal(D.assess(topicsWith({...all,interaction:'blind'}),'bezwaar').ceiling,2);
 assert.equal(D.assess(topicsWith({...all,security:'open'}),'woo').ceiling,2);
 assert.equal(D.assess(topicsWith({...all,quality:'blind',interaction:'blind',performance:'blind',functionality:'blind',sustainability:'blind'}),'bezwaar').ceiling,2,'too few domains');
 const d=D.assess(topicsWith({necessity:'strong',governance:'open'}),'woo');
 assert.deepEqual(d.strong,['necessity']);assert.deepEqual(d.open,['governance']);assert.equal(d.blind.length,13);assert.deepEqual(d.critical,['security','compliance','quality']);
 assert.ok(d.reasons.every((r,i,a)=>!i||a[i-1].level<=r.level),'most limiting reasons first');
});

test('judgement: stopping is always legitimate, overreach is named',()=>{
 assert.equal(D.judge(0,1),'grounded');assert.equal(D.judge(0,3),'cautious-stop');
 assert.equal(D.judge(2,2),'supported');assert.equal(D.judge(1,2),'cautious');assert.equal(D.judge(3,2),'beyond');
});

test('trials: each activity has rules that cannot be shortcut',()=>{
 const c=S.content('loket').chambers,def=id=>c.find(x=>x.id===id).trial;
 // witnesses: hearing the same person twice does not count twice
 let d=def('culture'),st=T.start(d);T.act(d,st,{type:'item',index:0});T.act(d,st,{type:'item',index:0});assert.equal(T.progress(d,st),1);
 for(const i of [1,2,3])T.act(d,st,{type:'item',index:i});assert.ok(T.isDone(d,st));
 // sorting: wrong bins send the item back with an explanation
 d=def('governance');st=T.start(d);assert.ok(T.act(d,st,{type:'item',index:0}).hold===0);
 assert.equal(T.act(d,st,{type:'item',index:1}).ok,false,'one item at a time');
 let r=T.act(d,st,{type:'bin',index:2});assert.equal(r.ok,false);assert.equal(r.putBack,0);assert.ok(r.message);
 d.items.forEach((it,i)=>{T.act(d,st,{type:'item',index:i});T.act(d,st,{type:'bin',index:it.bin})});assert.ok(T.isDone(d,st));
 // judging: only the right answer counts
 d=def('evaluation');st=T.start(d);assert.equal(T.act(d,st,{type:'answer',index:0,answer:0}).ok,false);assert.equal(T.progress(d,st),0);
 d.items.forEach((it,i)=>T.act(d,st,{type:'answer',index:i,answer:it.answer}));assert.ok(T.isDone(d,st));
 // sequences reset on a wrong step
 d=def('interaction');st=T.start(d);const slotOf=step=>T.SEQUENCE_ORDER.indexOf(step);
 T.act(d,st,{type:'item',index:slotOf(0)});r=T.act(d,st,{type:'item',index:slotOf(2)});assert.equal(r.ok,false);assert.deepEqual(r.reset,[slotOf(0)]);assert.equal(T.progress(d,st),0);
 for(const step of [0,1,2,3])T.act(d,st,{type:'item',index:slotOf(step)});assert.ok(T.isDone(d,st));
 // levers: monitoring starts correct, switching it off makes things worse
 d=def('performance');st=T.start(d);assert.equal(T.progress(d,st),1);r=T.act(d,st,{type:'item',index:3});assert.equal(r.ok,false);assert.equal(T.progress(d,st),0);
 T.act(d,st,{type:'item',index:3});for(const i of [0,1,2])T.act(d,st,{type:'item',index:i});assert.ok(T.isDone(d,st));assert.match(T.status(d,st),/100%/);
 // gathering and fights
 d=def('sovereignty');st=T.start(d);for(let i=0;i<4;i++)T.act(d,st,{type:'item',index:i});assert.ok(T.isDone(d,st));
 d=def('security');st=T.start(d);for(let i=0;i<d.count;i++)T.act(d,st,{type:'kill'});assert.ok(T.isDone(d,st));
});

test('a full descent in the objections story: roles, trials, arenas, cheers, verdict, epilogue and report',async()=>{
 const created=await request('create','POST',{story:'bezwaar',peaceful:true});assert.equal(created.status,201);
 const {token:host,session:{code}}=created.data;let s=created.data.session;
 assert.equal(s.story,'bezwaar');assert.equal(s.peaceful,true);assert.equal(s.level,0);
 const a=(await request(code+'/join','POST',{name:'Mallow'})).data,b=(await request(code+'/join','POST',{name:'Bram'})).data;
 assert.equal(a.session.role,'audience');assert.equal((await request(code)).status,401);
 assert.ok(!JSON.stringify(a.session).includes(host),'host pass is never exposed');
 const act=async(type,extra={},token=host)=>{const res=await request(code+'/action','POST',{type,topic:s.topic,epoch:s.epoch,...extra},token);if(res.status===200&&token===host)s=res.data.session;return res};
 assert.equal((await act('move',{level:1},a.token)).status,403,'only the player moves');
 assert.equal((await act('move',{level:8})).status,400);
 assert.equal((await act('move',{level:1})).status,200);assert.equal(s.level,1);
 assert.equal((await act('trial',{outcome:'done'})).status,409,'no room entered');
 assert.equal((await act('enter',{target:'necessity'})).status,200);assert.equal(s.topic,'necessity');assert.ok(s.topics.necessity.opened);
 assert.equal((await act('trial',{outcome:'maybe'})).status,400);
 assert.equal((await act('trial',{outcome:'done'})).status,200);assert.equal(s.topics.necessity.trial.outcome,'done');
 assert.equal((await act('trial',{outcome:'skipped'})).status,200);assert.equal(s.topics.necessity.trial.outcome,'done','a finished trial is never downgraded');
 assert.equal((await act('vote',{selection:[0,1]},a.token)).status,200);
 assert.equal((await act('vote',{selection:[0,2]},b.token)).status,200);
 assert.equal((await act('vote',{selection:[0]})).status,403,'the player does not vote');
 const stale=await request(code+'/action','POST',{type:'vote',topic:'necessity',epoch:s.epoch-1,selection:[1]},a.token);assert.equal(stale.status,409,'late votes are rejected');
 assert.equal((await act('decide',{selection:core('bezwaar','necessity'),reason:'Eerst bellen.'})).status,200);
 const nec=s.topics.necessity.result;assert.ok(nec.complete);assert.deepEqual(nec.counts.slice(0,3),[2,1,1]);
 assert.equal((await act('arena',{id:'a1',outcome:'cleared'})).status,409,'leave the room first');
 assert.equal((await act('hub')).status,200);
 // arenas and council support
 assert.equal((await act('move',{level:2})).status,200);
 assert.equal((await act('cheer',{},a.token)).status,200);assert.equal((await act('cheer',{},a.token)).status,429,'support is rate limited');
 assert.equal((await act('cheer',{},b.token)).status,200);assert.equal((await act('cheer',{},host)).status,403);
 s=(await request(code,'GET',undefined,host)).data.session;assert.equal(s.cheers.n,2);assert.equal(s.cheers.last.name,'Bram');
 assert.equal((await act('arena',{id:'a9',outcome:'cleared'})).status,400);
 assert.equal((await act('arena',{id:'a1',outcome:'cleared',lessons:['backlog','promise','nope']})).status,200);
 assert.deepEqual(s.arenas.a1.lessons,['backlog','promise']);
 assert.equal((await act('arena',{id:'a1',outcome:'skipped'})).status,200);assert.equal(s.arenas.a1.outcome,'cleared','a cleared arena stays cleared');
 assert.equal((await act('enter',{target:'governance'})).status,200);assert.equal(s.level,3,'entering a room sets its level');
 assert.equal((await act('trial',{outcome:'skipped'})).status,200);
 assert.equal((await act('decide',{selection:[1]})).status,200);assert.ok(!s.topics.governance.result.complete);
 assert.equal((await act('retry')).status,200);
 assert.equal((await act('decide',{selection:core('bezwaar','governance')})).status,200);assert.equal(s.topics.governance.attemptCount,2);
 // the vendor's shortcut jumps to the seal chamber and is remembered
 assert.equal((await act('shortcut')).status,200);assert.equal(s.level,7);assert.equal(s.topic,null);assert.ok(s.shortcut);assert.ok(s.dossier.shortcut);
 assert.equal((await act('finish')).status,409,'seal a verdict first');
 assert.equal((await act('enter',{target:'verdict'})).status,200);
 assert.equal((await act('vote',{selection:[1,2]},a.token)).status,400,'one verdict per advisor');
 assert.equal((await act('vote',{selection:[1]},a.token)).status,200);
 assert.equal((await act('decide',{selection:[3],reason:'Snel klaar'})).status,200);
 const v=s.topics.verdict.result;assert.equal(v.judgement,'beyond');assert.equal(v.ceiling,1);assert.equal(v.epilogue,S.epilogue('bezwaar',3,'beyond'));
 assert.equal((await act('commit',{reviewDate:'morgen'})).status,400);
 assert.equal((await act('commit',{owner:'Teamleider bezwaar',firstStep:'Bezwaarmakers bellen',reviewDate:'2026-12-01',stopCondition:'Meer vernietigde besluiten'})).status,200);
 assert.equal((await act('finish')).status,200);assert.ok(s.completed);
 assert.equal((await act('cheer',{},b.token)).status,409,'no support after the end');
 assert.equal((await request(code+'/join','POST',{name:'Laat'})).status,409);
 const report=await request(code+'/report','GET',undefined,b.token);assert.equal(report.status,200);
 for(const text of ['De Bezwaarkamer','Uitvoeringsdienst Woonlasten','rustige modus','Invoeren met waarborgen','Dit besluit gaat verder dan het dossier kan dragen.','### Een jaar later','Snelle Trap','Teamleider bezwaar','Proef: Hoor de betrokkenen — uitgevoerd.','Bevinding:','overgeslagen','## Lessen uit de tussenkamers','Achterstandsgolem','### Bespreking 2','## Blinde vlekken','- Beveiliging'])assert.ok(report.data.includes(text),text);
});

test('sessions from 3.0 keep working; sessions from 2.x are refused politely',()=>{
 const E=require('../game/engine.cjs');
 const old={code:'ABCDEF',hostToken:'x',mode:'framework',audience:[]};
 assert.throws(()=>E.publicSession(old,'x'),e=>e.status===410);
 const v30={code:'ABCDEG',hostToken:'h',mode:'descent',audience:[],revision:3,completed:false,depth:2,topic:null,epoch:4,topics:Object.fromEntries([...S.CHAMBER_IDS,'verdict'].map(id=>[id,{visited:[],opened:false,votes:{},attempts:[],note:''}])),commitments:{owner:'',firstStep:'',reviewDate:'',stopCondition:''}};
 const view=E.publicSession(v30,'h');assert.equal(view.story,'loket');assert.equal(view.level,3,'depth 2 (foundations) becomes level 3');assert.equal(view.topics.governance.trial,null);assert.deepEqual(view.arenas,{a1:null,a2:null,a3:null});
 assert.doesNotThrow(()=>E.applyAction(v30,'h',{type:'move',level:4,topic:null,epoch:4}));assert.equal(v30.level,4);
});
