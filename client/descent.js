import QRCode from 'qrcode';
import {createDungeon} from './dungeon.js';
import Trials from './trials.cjs';
import {STORIES,content as storyContent,JUDGEMENTS} from '../game/descent.cjs';
import {FRAMEWORK_URL} from '../game/topics.cjs';

const $=id=>document.getElementById(id),app=$('app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const letter=i=>String.fromCharCode(65+i),pad=n=>String(n).padStart(2,'0');
const params=new URLSearchParams(location.search),audience=params.has('join')||params.has('audience');
const FOUNDATIONS=['governance','culture','capacity','infrastructure'];
const DOMAINS=['evaluation','quality','interaction','performance','functionality','sustainability','sovereignty','ethics','compliance','security'];
const ARENA_AT={2:'a1',4:'a2',6:'a3'};
const STATE_LABEL={strong:'Stevig',open:'Open punten',blind:'Blinde vlek'};
const face='<span class="g-face" aria-hidden="true"><i></i><i></i></span>';
const brand=(sub='AI-RAAMWERK · AFDALING 3.1')=>`<a class="g-brand" href="/" aria-label="Het Gewelf, startpagina">${face}<span>HET GEWELF<small>${esc(sub)}</small></span></a>`;
let session=null,token='',world=null,content=storyContent('loket'),busy=false,polling=false,pollTimer,toastTimer,pipTimer,lessonTimer,connected=true,panel=null,activeClue=null,letterRead=false,lastLevel=-1,modalRestore=null,started=false,choosing=false;
let selected=[],selectionKey='',draftReason={},draftNotes={},draftCommit=null;
let armed=false,wrongSeen=new Set(),trial=null,judging=null,fight=null,cheersSeen=null,vendorDeclined=false,appliedStory=null,pickStory='loket',pickPeaceful=false,hp=100,tool='lamp',bossTool=null;
const doneTrials=new Set(),doneArenas=new Set(),finishedInWorld=new Set();
const chamber=id=>content.chambers.find(c=>c.id===id);
const room=id=>session?.topics[id];
const stateOf=id=>session?.dossier.chambers.find(c=>c.id===id)?.state||'blind';
const discussed=()=>session?content.chambers.filter(c=>session.topics[c.id].attemptCount).length:0;
const trialResolved=id=>doneTrials.has(id)||!!room(id)?.trial;
const arenaDone=id=>doneArenas.has(id)||!!session?.arenas?.[id];
const toolOf=id=>content.tools.find(t=>t.id===id);
const getStore=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const saveStore=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),5200)}
function groupLabel(d){return d.group==='necessity'?'DIEPTE 1 · DE VRAAG':d.group==='foundation'?`FUNDAMENT ${pad(d.number)} · ${d.title}`:`DOMEIN ${pad(d.number-4)} · ${d.title}`}

// ---------- sound: a low drone, drips, footsteps and chimes, all synthesised ----------
const sound={on:false,ctx:null,master:null,
 start(){try{this.ctx ||= new AudioContext();this.ctx.resume();if(this.master)return;const c=this.ctx;this.master=c.createGain();this.master.gain.value=.5;this.master.connect(c.destination);
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=320;lp.connect(this.master);const g=c.createGain();g.gain.value=.05;g.connect(lp);
  for(const hz of [55,55.4,82.5]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(g);o.start()}
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.07;lg.gain.value=140;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
  const drip=()=>{if(this.on&&!document.hidden)this.tone(1400+Math.random()*900,.18,.02,'sine',true);setTimeout(drip,2500+Math.random()*6000)};drip()}catch{}},
 set(on){this.on=on;if(on)this.start();if(this.master)this.master.gain.setTargetAtTime(on?.5:0,this.ctx.currentTime,.3)},
 tone(hz,len=.5,vol=.05,type='sine',drop=false,delay=0){if(!this.on||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,t);if(drop)o.frequency.exponentialRampToValueAtTime(hz*.45,t+len);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+len+.05)},
 step(run){if(!this.on||!this.ctx)return;const c=this.ctx,len=.09,b=c.createBuffer(1,c.sampleRate*len,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**3;const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=run?900:600;g.gain.value=run?.22:.16;s.buffer=b;s.connect(f);f.connect(g);g.connect(this.master);s.start()},
 chime(success){[392,494,...(success?[587,784]:[])].forEach((hz,i)=>this.tone(hz,.6,.05,'triangle',false,i*.1))},
 descend(){[330,262,196,147].forEach((hz,i)=>this.tone(hz,.9,.05,'sine',false,i*.14))},
 zap(t){this.tone({lamp:880,scale:660,seal:520}[t]||700,.18,.04,'square',true)},
 hit(){this.tone(140,.25,.08,'sawtooth',true)},
 wrong(){this.tone(220,.3,.05,'triangle',true)}
};

// ---------- networking ----------
async function api(path,{method='GET',body,pass=token}={}){
 try{const res=await fetch(`/api/game/${path}`,{method,headers:{'Content-Type':'application/json',...(pass?{Authorization:`Bearer ${pass}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Opslaan is niet gelukt.'),{status:res.status});return data}
 catch(e){if(e.name==='TimeoutError'||e.name==='TypeError')throw new Error('Geen verbinding. Controleer het netwerk en probeer opnieuw.');throw e}
}
let chain=Promise.resolve();
// Actions run one after another, each with the session state current at that moment.
function act(type,extra={}){const run=()=>doAct(type,typeof extra==='function'?extra():extra);const p=chain.then(run,run);chain=p.catch(()=>{});return p}
async function doAct(type,extra){
 if(!session||extra===null)return false;busy=true;setBusy();
 try{const data=await api(`${session.code}/action`,{method:'POST',body:{type,topic:session.topic,epoch:session.epoch,...extra}});setSession(data.session);return true}
 catch(e){toast(e.message);if(e.status===409){try{setSession((await api(session.code)).session)}catch{}}return false}
 finally{busy=false;setBusy()}
}
function setBusy(){document.querySelectorAll('[data-act]').forEach(b=>b.disabled=busy||b.dataset.locked==='true')}
function poll(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{
 if(!session||busy||polling||document.hidden)return;polling=true;const code=session.code,pass=token;
 try{const {session:next}=await api(code,{pass});if(session?.code===code&&token===pass&&(next.revision!==session.revision||!connected))setSession(next)}
 catch{if(connected){connected=false;renderStatus();toast('Verbinding onderbroken. Opgeslagen voortgang blijft bewaard.')}}finally{polling=false}
},1800)}
function setSession(next){
 if(session?.code===next.code&&next.revision<session.revision)return;
 if(session?.code!==next.code){doneTrials.clear();doneArenas.clear();finishedInWorld.clear();cheersSeen=null}
 session=next;connected=true;content=storyContent(next.story);
 const key=`${next.code}:${next.topic}:${next.epoch}`;
 if(selectionKey!==key){selectionKey=key;selected=audience?[...(room(next.topic)?.ownVote||[])]:[]}
 if(!audience&&(next.level>0||discussed()))letterRead=true;
 // council support during a fight restores some trust
 if(cheersSeen===null)cheersSeen=next.cheers.n;else if(next.cheers.n>cheersSeen){const n=next.cheers.n-cheersSeen;cheersSeen=next.cheers.n;if(!audience&&world?.fighting){world.heal(15*n);toast(`✦ ${next.cheers.last?.name||'De raad'} steunt je. Je vertrouwen groeit.`);sound.chime()}}
 if(audience)renderAudience();else{applyStory();syncWorld();render()}
}

// ---------- host ----------
function hostShell(){
 app.innerHTML=`<div class="g-root" id="g-root">
 <canvas id="world" tabindex="0" aria-label="Het Gewelf in 3D. Klik om rond te kijken. Loop met WASD of de pijltjestoetsen. E gebruikt wat je ziet. M opent de kaart."></canvas>
 <div class="g-vignette" aria-hidden="true"></div><div class="g-hurt" aria-hidden="true"></div><div class="g-crosshair" id="g-crosshair" aria-hidden="true"></div>
 <div id="g-prompt" class="g-prompt" role="status"></div>
 <header class="g-hud-top">
  <div class="g-where"><div class="g-kicker" id="g-depth-label">DIEPTE 0</div><div class="g-where-name" id="g-depth-name">De Ontvangsthal</div><div class="g-objective" id="g-objective"></div><div class="g-tracker" id="g-tracker" hidden></div></div>
  <nav class="g-actions" aria-label="Spelbediening"><button id="invite" class="g-btn" data-act>Adviesraad <b id="g-members">0</b></button><button id="map" class="g-btn">Kaart <kbd>M</kbd></button><button id="dossier" class="g-btn">Dossier</button><button id="guide" class="g-btn">Gids <kbd>G</kbd></button><button id="sound" class="g-btn g-compact" aria-pressed="false">Geluid uit</button><button id="full" class="g-btn g-compact" aria-label="Volledig scherm">⛶</button></nav>
 </header>
 <div class="g-pip" id="g-pip" aria-live="polite">${face}<div><b id="g-pip-name">Pip</b><p id="g-pip-text"></p></div></div>
 <aside class="g-lesson" id="g-lesson" aria-live="polite" hidden></aside>
 <div class="g-combat" id="g-combat" hidden><div class="g-trust" id="g-trust"><span>Vertrouwen</span><div class="g-trust-bar"><i id="g-trust-fill"></i></div></div><div class="g-tools" id="g-tools"></div></div>
 <div class="g-controls" id="g-controls"></div>
 <div class="g-titlecard" id="g-titlecard" aria-hidden="true"><small></small><h2></h2><p></p></div>
 <aside class="g-reader" id="g-reader" hidden aria-label="Bron"></aside>
 <aside class="g-panel" id="g-panel" hidden></aside>
 <section class="g-judge" id="g-judge" hidden role="dialog" aria-modal="false" aria-label="Beoordeel"></section>
 <section class="g-start" id="g-start"></section>
 <footer class="g-status" id="g-status"></footer>
 </div>`;
 try{
  world=createDungeon($('world'),{chambers:content.chambers,
   onInteract:handleInteract,
   onPrompt:renderPrompt,
   onLevel:handleLevel,
   onRegion:id=>{if(session&&!session.completed)act('hub',()=>session.topic&&session.topic!==id&&!panel?{}:null)},
   onLock:on=>$('g-root').classList.toggle('is-locked',on),
   onStep:run=>sound.step(run),
   onCombat:handleCombat,
   onArena:handleArena,
   onEvent:e=>{if(e.type==='hit'){const el=document.querySelector('.g-hurt');el.classList.remove('on');void el.offsetWidth;el.classList.add('on');sound.hit()}if(e.type==='fall'){say('Oei! Ik trek je omhoog. Loop rustig over de brug; je kunt hem niet missen.');sound.descend()}}});
 }catch(e){console.error(e);world=null;$('g-root').classList.add('no-webgl')}
 renderControls();
}
function renderControls(){const el=$('g-controls');if(!el)return;el.innerHTML=armed?`<span><kbd>E</kbd>/<kbd>F</kbd>/<kbd>Klik</kbd> aanvallen</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> wapen</span><span><kbd>R</kbd> opbergen</span><span><kbd>G</kbd> gids</span>`:fight?`<span><kbd>Klik</kbd>/<kbd>F</kbd> gebruiken</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> gereedschap</span><span><kbd>WASD</kbd> lopen</span><span><kbd>Shift</kbd> rennen</span>`:`<span><kbd>Klik</kbd> rondkijken</span><span><kbd>WASD</kbd> lopen</span><span><kbd>Shift</kbd> rennen</span><span><kbd>Spatie</kbd> springen</span><span><kbd>E</kbd> gebruiken</span><span><kbd>R</kbd> wapen</span><span><kbd>M</kbd> kaart</span>`}
function renderPrompt(p){
 const el=$('g-prompt');if(!el)return;$('g-crosshair')?.classList.toggle('is-target',!!p?.mob);
 if(!p){el.innerHTML='';return}
 if(p.mob){el.innerHTML=`<span class="g-mobname">${esc(p.mob.name)}</span>`;return}
 el.innerHTML=p.armed?`<kbd>R</kbd> wapen opbergen om te gebruiken: ${esc(p.text)}`:`<kbd>E</kbd> ${esc(p.text)}`;
}
function say(text,{name='Pip',ms=9000}={}){const el=$('g-pip');if(!el)return;$('g-pip-name').textContent=name;$('g-pip-text').textContent=text;el.classList.toggle('is-other',name!=='Pip');el.classList.add('show');clearTimeout(pipTimer);pipTimer=setTimeout(()=>el.classList.remove('show'),ms)}
function lesson(title,text,kind='Les'){const el=$('g-lesson');if(!el)return;el.innerHTML=`<div class="g-kicker">📜 ${esc(kind)}</div><b>${esc(title)}</b><p>${esc(text)}</p>`;el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(lessonTimer);lessonTimer=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.hidden=true,400)},11000)}
function titleCard(L){const el=$('g-titlecard'),info=content.levels[L];el.querySelector('small').textContent=info.label.toUpperCase();el.querySelector('h2').textContent=info.name;el.querySelector('p').textContent=info.line;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function handleLevel(L){
 if(!session||!started)return;
 if(fight&&fight.level!==L){world?.stopFight();fight=null;renderCombat()}
 if(trial&&chamber(trial.id)&&Math.abs(L-levelOfChamber(trial.id))>0&&trial.def.type==='fight'){world?.stopFight();cancelTrial()}
 if(L!==lastLevel){lastLevel=L;titleCard(L);sound.descend();say(content.story.pip.levels[L])}
 if(!session.completed)act('move',()=>session.level===L?null:session.topic?null:{level:L}).then(()=>{if(session.level!==L&&!session.topic)act('move',()=>session.level===L?null:{level:L})});
 renderHud();
}
const levelOfChamber=id=>id==='necessity'?1:FOUNDATIONS.includes(id)?3:5;

// ---------- interactions ----------
async function handleInteract({kind,id,clue,index}){
 if(!session)return;
 if(session.completed&&!['letter','resident'].includes(kind)){toast('De afdaling is afgerond. Download het dossier via de knop Dossier.');return}
 const st=content.story;
 if(kind==='letter'){letterRead=true;saveStore(`gewelf-letter-${session.code}`,true);world?.setLetterRead(true);openPanel('letter');sound.chime();return}
 if(kind==='resident'){say(world?.level===7?st.resident.seal:st.resident.hall,{name:`${st.resident.name}, ${st.resident.role}`,ms:11000});sound.tone(520,.4,.04,'triangle');return}
 if(kind==='vendor'){openPanel('vendor');sound.tone(880,.3,.04,'triangle');return}
 if(kind==='altar'){if(session.topic!=='verdict'&&!await act('enter',{target:'verdict'}))return;openPanel('verdict');sound.chime();return}
 if(kind==='trial'||kind==='bin'){trialInteract(kind,id,index);return}
 if(session.topic!==id&&!await act('enter',{target:id}))return;
 if(kind==='npc'){openPanel(!trialResolved(id)&&trial?.id!==id?'trial':'case');sound.chime();return}
 if(kind==='clue'){await showClue(clue);world?.setPaused(true)}
}
async function showClue(id){const d=chamber(session.topic);if(!d)return;if(!room(d.id).visited.includes(id)&&!await act('inspect',{clue:id}))return;activeClue=id;renderReader();sound.tone(660,.5,.04,'triangle')}

// ---------- trials ----------
function trialLabels(d){
 const t=d.trial;if(!t)return {};
 switch(t.type){
  case 'witness':return {items:t.witnesses.map(w=>`${d.id==='ethics'?'Luister':'Spreek'}: ${w.name}`)};
  case 'gather':return {items:t.items.map(g=>`Pak op: ${g.label}`)};
  case 'sort':return {items:t.items.map(g=>`Pak op: ${g.label}`),bins:t.bins.map(b=>b.label)};
  case 'judge':return {items:t.items.map(i=>`Beoordeel: ${i.title}`)};
  case 'sequence':return {items:Trials.SEQUENCE_ORDER.map(s=>`${d.id==='interaction'?'Luid de bel':'Open de lade'}: ‘${t.steps[s]}’`)};
  case 'levers':return {items:t.levers.map((l,i)=>`Hendel ${l.label}: ${l.states[trial?.id===d.id?trial.st.states[i]:l.start]} (wissel)`)};
  case 'fight':return {items:['De besmette bijlage']};
 }
 return {};
}
function startTrial(id){
 const d=chamber(id);if(!d?.trial||!world)return;
 if(trial&&trial.id!==id)cancelTrial();
 trial={id,def:d.trial,st:Trials.start(d.trial)};
 world.trialReset(id);world.trialActive(id,true);
 if(d.trial.type==='levers'){d.trial.levers.forEach((l,i)=>world.trialLever(id,i,l.start));world.trialGauge(id,Trials.progress(d.trial,trial.st)/Trials.total(d.trial))}
 if(d.trial.type==='fight'){fight={kind:'chamber',id,level:levelOfChamber(id),lessons:new Set(),wave:0,total:1};world.startFight({id,waves:[[{key:d.trial.mob.key,def:d.trial.mob,count:d.trial.count}]],peaceful:session.peaceful});renderCombat()}
 world.setLabels({[id]:trialLabels(d)});
 closePanel();say(d.trial.intro,{name:d.npc,ms:11000});sound.chime();renderHud();
}
function cancelTrial(){if(!trial)return;const id=trial.id;world?.trialActive(id,false);world?.trialReset(id);if(trial.def.type==='fight'){world?.stopFight();fight=null;renderCombat()}trial=null;renderHud()}
function trialInteract(kind,id,index){
 const d=chamber(id);
 if(trialResolved(id)&&trial?.id!==id)return;
 if(trial?.id!==id){say(`Praat eerst met ${d.npc} om de proef te beginnen.`);return}
 const t=trial.def;
 if(t.type==='judge'&&kind==='trial'){openJudge(id,index);return}
 if(t.type==='fight')return;
 applyTrial(Trials.act(t,trial.st,{type:kind==='bin'?'bin':'item',index}));
}
function applyTrial(res){
 if(!trial)return;const {id,def}=trial,d=chamber(id);
 if(res.item)world?.trialItem(id,res.item[0],res.item[1]);
 if(res.hold!==undefined)world?.trialHold(id,res.hold);
 if(res.place)world?.trialPlace(id,res.place[0],res.place[1]);
 if(res.putBack!==undefined){world?.trialPutBack(id,res.putBack);world?.trialItem(id,res.putBack,'wrong')}
 if(res.reset)for(const i of res.reset)world?.trialItem(id,i,'active');
 if(res.wrong!==undefined&&res.reset){setTimeout(()=>world?.trialItem(id,res.wrong,'active'),650)}
 if(res.lever){world?.trialLever(id,res.lever[0],res.lever[1]);world?.trialGauge(id,res.gauge);world?.setLabels({[id]:trialLabels(d)})}
 if(res.line)say(res.line,{name:res.speaker,ms:12000});
 else if(res.message)say(res.message,{ms:9000});
 if(res.ok&&res.fresh)sound.tone(740,.35,.04,'triangle');else if(res.ok===false&&res.message)sound.wrong();
 if(Trials.isDone(def,trial.st))setTimeout(completeTrial,res.line?900:500);
 renderHud();
}
async function completeTrial(){
 if(!trial)return;const {id,def}=trial,d=chamber(id);trial=null;doneTrials.add(id);finishedInWorld.add(id);
 world?.trialActive(id,false);world?.trialFinish(id,true);sound.chime(true);
 if(def.type==='fight'){fight=null;renderCombat()}
 say(def.done,{name:d.npc,ms:10000});
 if(session.topic!==id&&!await act('enter',{target:id}))return;
 await act('trial',{outcome:'done'});
 if(!session.completed)openPanel('case');
}
async function skipTrial(id){
 if(trial?.id===id)cancelTrial();
 doneTrials.add(id);
 if(session.topic!==id&&!await act('enter',{target:id}))return;
 await act('trial',{outcome:'skipped'});openPanel('case');
}
function openJudge(id,index){
 judging={id,index,result:null};world?.setPaused(true);renderJudge();sound.tone(600,.3,.04,'triangle');
}
function renderJudge(){
 const el=$('g-judge');if(!el)return;el.hidden=!judging;if(!judging)return;
 const d=chamber(judging.id),t=d.trial,item=t.items[judging.index],r=judging.result;
 el.innerHTML=`<div class="g-kicker">PROEF · ${esc(t.title)}</div><h3>${esc(item.title)}</h3><p class="g-judge-text">${esc(item.text)}</p>
 ${r?`<p class="g-judge-result ${r.ok?'is-ok':'is-no'}">${r.ok?'✓ ':'✗ '}${esc(r.message)}</p>`:''}
 <div class="g-judge-actions">${r?.ok?`<button class="g-primary" id="judge-close">Verder <span>→</span></button>`:t.answers.map((a,i)=>`<button class="g-btn g-judge-answer" data-answer="${i}">${esc(a)}</button>`).join('')+`<button class="g-btn g-judge-later" id="judge-close">Later</button>`}</div>`;
 el.querySelector('button')?.focus({preventScroll:true});
}
function judgeAnswer(answer){
 if(!judging||!trial)return;const res=Trials.act(trial.def,trial.st,{type:'answer',index:judging.index,answer});judging.result=res;renderJudge();
 if(res.item)world?.trialItem(judging.id,res.item[0],res.item[1]);
 if(res.ok)sound.tone(740,.35,.04,'triangle');else sound.wrong();
 renderHud();
}
function closeJudge(){const finished=trial&&Trials.isDone(trial.def,trial.st);judging=null;renderJudge();if(!panel){world?.setPaused(false);world?.lock()}if(finished)completeTrial()}

// ---------- arenas and fights ----------
function handleArena({id}){
 if(!session||arenaDone(id)){world?.setArenaDone(id,true);return}
 const st=content.story,A=st.arenas.find(a=>a.id===id);
 const waves=A.waves.map(w=>w.map(([key,count])=>({key,def:st.mobs[key],count})));
 fight={kind:'arena',id,level:{a1:2,a2:4,a3:6}[id],lessons:new Set(),wave:0,total:waves.length+(A.boss?1:0)};
 wrongSeen.clear();world.startFight({id,waves,boss:A.boss?st.boss:null,minion:{key:st.boss.minion,def:st.mobs[st.boss.minion]},peaceful:session.peaceful});
 say(A.intro,{ms:8000});
 if(!getStore('gewelf-tools-seen')){saveStore('gewelf-tools-seen',true);toast('Val aan met E, F of klikken; wissel met 1, 2 en 3. Welk wapen werkt tegen welk monster? Zoek het op in de Gids (G).')}
 renderCombat();renderHud();
}
function handleCombat(e){
 if(e.type==='hp'){hp=e.hp;const f=$('g-trust-fill');if(f){f.style.width=`${hp}%`;f.parentElement.classList.toggle('is-low',hp<35)}return}
  if(e.type==='armed'){armed=e.on;renderCombat();renderPrompt(null);sound.tone(e.on?660:440,.15,.03,'triangle');return}
 if(e.type==='tool'){tool=e.tool;renderCombat();sound.tone(520,.12,.03,'triangle');return}
 if(e.type==='fire'){sound.zap(e.tool);return}
 if(!fight)return;
 if(e.type==='wave'){fight.wave=e.index;fight.total=e.total;renderHud();if(e.index>0)toast(`Golf ${e.index+1} van ${e.total}`);return}
 if(e.type==='kill'){fight.lessons.add(e.key);if(trial?.def.type==='fight')applyTrial(Trials.act(trial.def,trial.st,{type:'kill'}));
  if(e.boss)lesson(e.def.name,e.def.lesson,'Verslagen');else if(e.first)lesson(e.def.name,e.def.lesson);sound.chime(e.boss);renderHud();return}
 if(e.type==='wrong'){if(!wrongSeen.has(e.def.name)){wrongSeen.add(e.def.name);say(`Dat doet ${e.def.name} niets. Wat wel werkt, staat in de Gids (G).`,{ms:5000})}sound.wrong();return}
 if(e.type==='bossIntro'){bossTool=e.tool;say(e.def.intro,{name:e.def.name,ms:9000});toast('Let op de kern op zijn borst: de kleur hoort bij een wapen. De Gids (G) helpt.');renderHud();return}
 if(e.type==='boss'){bossTool=e.tool;say(e.line,{ms:7000});toast(`${e.name} verandert van kleur. Wat werkt nu?`);renderHud();return}
 if(e.type==='down'){toast('Het vertrouwen is op. Pip haalt je terug naar de ingang; jullie voortgang blijft bewaard.');return}
 if(e.type==='clear'){
  if(fight.kind==='arena'){const id=fight.id,lessons=[...fight.lessons].map(k=>k==='boss'?'boss':k);doneArenas.add(id);fight=null;bossTool=null;sound.chime(true);
   say(id==='a3'?'De weg naar de Zegelkamer is vrij. Wat jullie hier leerden, gaat mee in het dossier.':'De poort gaat open. Op naar beneden!',{ms:8000});
   act('arena',{id,outcome:'cleared',lessons});renderCombat();renderHud()}
  return;
 }
}
function skipArena(){if(!fight||fight.kind!=='arena')return;const id=fight.id,lessons=[...fight.lessons];world?.stopFight();world?.setArenaDone(id,true);doneArenas.add(id);fight=null;bossTool=null;act('arena',{id,outcome:'skipped',lessons});say('De poort is open. Het gevecht staat als overgeslagen in het dossier.');renderCombat();renderHud()}
function renderCombat(){
 const el=$('g-combat');if(!el)return;el.hidden=!started||!world;$('g-root')?.classList.toggle('is-fighting',!!fight);$('g-root')?.classList.toggle('is-armed',armed);renderControls();if(el.hidden)return;
 $('g-trust').hidden=!fight;
 $('g-tools').innerHTML=armed?content.tools.map((t,i)=>`<button class="g-tool ${t.id===tool?'is-on':''}" data-tool="${i}" style="--tool:${t.color}" title="${esc(t.attack)}"><kbd>${t.key}</kbd><span>${t.icon}</span><b>${esc(t.name)}</b></button>`).join('')+`<button class="g-attack" id="attack">⚔ Aanval <kbd>E</kbd></button><button class="g-btn g-holster" id="holster">Opbergen <kbd>R</kbd></button>`
  :`<button class="g-btn g-draw" id="draw">🗡 Wapen trekken <kbd>R</kbd></button>`;
}


// ---------- panels ----------
function panelInset(){world?.setInset(panel&&innerWidth>760?Math.min(520,innerWidth-36)+18:0)}
function openPanel(name){panel=name;world?.setPaused(true);$('g-pip')?.classList.remove('show');panelInset();render();const p=$('g-panel');p.scrollTop=0;p.querySelector('button,textarea,input')?.focus({preventScroll:true})}
function closePanel(){panel=null;activeClue=null;panelInset();$('g-panel').hidden=true;$('g-reader').hidden=true;world?.setPaused(false);world?.lock();if(session?.topic&&session.topic!=='verdict'&&!world)act('hub');renderHud()}
function closeReader(){activeClue=null;$('g-reader').hidden=true;if(!panel){world?.setPaused(false);world?.lock()}}

function nextObjective(){
 if(!session)return null;if(session.completed)return {text:'De afdaling is afgerond. Download het dossier en neem het mee.'};
 if(trial){const t=trial.def,st=trial.st;let target=null;
  if(['witness','gather','judge'].includes(t.type)){const list=t.type==='witness'?st.heard:t.type==='gather'?st.got:st.judged;const n=(t.witnesses||t.items).findIndex((_,i)=>!list.includes(i));if(n>=0)target={kind:'trial',id:trial.id,index:n}}
  if(t.type==='sort'&&st.holding===null){const n=t.items.findIndex((_,i)=>!st.placed.includes(i));if(n>=0)target={kind:'trial',id:trial.id,index:n}}
  return {target,text:`${t.task} · ${Trials.status(t,st)}`}}
 if(fight)return {text:fight.kind==='arena'?(fight.wave>=fight.total-1&&content.story.arenas.find(a=>a.id===fight.id)?.boss?`Versla ${content.story.boss.name}`:'Versla de monsters met het juiste gereedschap'):'Versla de fluisteraars met je Zegel'};
 const L=world?world.level:session.level,v=room('verdict');
 if(!letterRead)return {target:{kind:'letter'},text:'Lees de brief op de lessenaar'};
 if(L===0)return {target:{kind:'down'},text:'Neem de trap omlaag naar Diepte 1'};
 if(L===1)return stateOf('necessity')==='blind'?{target:{kind:'npc',id:'necessity'},text:'Spreek Vrouwe Waarom in de Kamer van de Vraag'}:{target:{kind:'down'},text:'Daal af naar de eerste tussenkamer'};
 if(ARENA_AT[L]){const id=ARENA_AT[L],A=content.story.arenas.find(a=>a.id===id);return arenaDone(id)?{target:{kind:'down'},text:'De poort is open. Ga verder naar beneden'}:{target:{kind:'arena',id},text:A.boss?`Versla ${content.story.boss.name}, of sla het gevecht over`:`Steek ${A.name} over`}}
 if(L===3){const n=FOUNDATIONS.find(id=>stateOf(id)==='blind');return n?{target:{kind:'npc',id:n},text:`Bezoek ${chamber(n).npc} · ${chamber(n).title}`}:{target:{kind:'down'},text:'De fundamenten zijn besproken. Daal af'}}
 if(L===5){const n=DOMAINS.find(id=>stateOf(id)==='blind');return n?{target:{kind:'npc',id:n},text:`Bezoek ${chamber(n).npc} · ${chamber(n).title} — of daal af naar De Drempel`}:{target:{kind:'down'},text:'Alle domeinen besproken. Daal af naar De Drempel'}}
 return v.attemptCount&&!v.opened?{text:'Leg de afspraken vast en rond de afdaling af'}:{target:{kind:'altar'},text:'Neem het besluit bij het zegel'};
}
function storyLabels(){const st=content.story;return {vendor:st.vendor,resident:st.resident,storyIndex:Math.max(0,STORIES.findIndex(s=>s.id===st.id)),emblem:st.letter.seal}}
function applyStory(){
 if(!world||!session||appliedStory===session.story)return;appliedStory=session.story;
 world.setStory({...storyLabels(),labels:Object.fromEntries(content.chambers.map(c=>[c.id,trialLabels(c)]))});
}
function syncWorld(){
 if(!world||!session)return;
 const map=Object.fromEntries(session.dossier.chambers.map(c=>[c.id,c.state]));world.setStatus(map);
 for(const c of content.chambers){world.setVisited(c.id,room(c.id).visited);if(room(c.id).trial?.outcome==='done'&&!finishedInWorld.has(c.id)&&trial?.id!==c.id){finishedInWorld.add(c.id);world.trialFinish(c.id,true)}}
 for(const id of ['a1','a2','a3'])if(!(fight?.id===id))world.setArenaDone(id,arenaDone(id));
 world.setLetterRead(letterRead);const v=room('verdict').result;world.setVerdict(v?v.selection[0]:-1);
}
function renderHud(){
 if(audience||!$('g-root'))return;
 const L=world?world.level:(session?.level||0),info=content.levels[L];
 $('g-depth-label').textContent=`${info.label.toUpperCase()} · ${discussed()} / 15 KAMERS BESPROKEN`;$('g-depth-name').textContent=info.name;
 const o=nextObjective();$('g-objective').innerHTML=o?`<span>◆</span> ${esc(o.text)}`:'';world?.setObjective(o?.target||null);
 const tr=$('g-tracker');
 if(trial){tr.hidden=false;tr.innerHTML=`<span class="g-tag">PROEF</span><b>${esc(trial.def.title)}</b><span>${esc(Trials.status(trial.def,trial.st))}</span><button class="g-link-btn" id="skip-trial">Sla over</button>`}
 else if(fight?.kind==='arena'){const A=content.story.arenas.find(a=>a.id===fight.id);tr.hidden=false;tr.innerHTML=`<span class="g-tag is-fight">${A.boss?'EINDBAAS':'GEVECHT'}</span><b>${A.boss&&fight.wave>=fight.total-1?esc(content.story.boss.name):`Golf ${Math.min(fight.wave+1,fight.total)} van ${fight.total}`}</b>${session?.peaceful?'<span>Rustige modus</span>':''}<button class="g-link-btn" id="skip-arena">Sla gevecht over</button>`}
 else{tr.hidden=true;tr.innerHTML=''}
 $('g-members').textContent=session?.audienceCount||0;$('invite').dataset.locked=String(!session);
 renderStatus();
}
function renderStatus(){const el=$('g-status');if(!el)return;el.innerHTML=session?`<span>${esc(content.story.title)} · <b>${session.code}</b></span><span>${connected?'De raad adviseert · jij beslist':'Verbinding onderbroken · opnieuw verbinden…'}</span>`:''}
function render(){if(audience){renderAudience();return}$('g-root')?.classList.toggle('has-panel',!!panel);renderHud();renderStart();renderPanel();renderReader();renderJudge();setBusy()}
function storyCard(s){return `<button class="g-story ${pickStory===s.id?'is-picked':''}" data-story="${s.id}" style="--story:${s.color}" aria-pressed="${pickStory===s.id}"><span class="g-story-top"><span class="g-kicker">${esc(s.org)}</span><span class="g-badge">${esc(s.difficulty)}</span></span><b>${esc(s.title)}</b><span class="g-story-sub">${esc(s.subtitle)}</span><span class="g-story-pitch">${esc(s.pitch)}</span><span class="g-chips">${s.themes.map(t=>`<i>${esc(t)}</i>`).join('')}</span></button>`}
function renderStart(){
 const el=$('g-start');if(!el)return;el.hidden=started;$('g-root').classList.toggle('is-title',!started);$('g-root').classList.toggle('is-choosing',!started&&choosing);if(started)return;
 if(choosing){el.innerHTML=`<div class="g-start-inner g-choose">${brand()}<div class="g-kicker">KIES JULLIE VERHAAL</div><h1 class="g-h1-small">Welk besluit ligt er op tafel?</h1><p class="g-lead">Drie overheidsorganisaties, drie AI-voorstellen. De kamers van het raamwerk zijn hetzelfde; de casus, de bewoners, de monsters en de gevolgen verschillen.</p>
  <div class="g-stories">${STORIES.map(storyCard).join('')}</div>
  <label class="g-toggle"><input type="checkbox" id="peaceful" ${pickPeaceful?'checked':''}><span><b>Rustige modus</b> — monsters vallen niet aan. Fijn voor groepen die vooral willen praten.</span></label>
  <button id="begin-story" class="g-primary" data-act>Begin ${esc(STORIES.find(s=>s.id===pickStory).title)} <span>→</span></button><button id="back-title" class="g-btn g-wide">Terug</button></div>`;return}
 const saved=session&&!session.completed;
 el.innerHTML=`<div class="g-start-inner">${brand()}<div class="g-kicker">EEN AFDALING NAAR EEN VERANTWOORD BESLUIT</div><h1>Het Gewelf</h1><p class="g-lead">Een overheidsorganisatie overweegt AI. Onder het gebouw bewaart het Gewelf vijftien kamers vol vragen die je eerst moet stellen, drie tussenkamers vol monsters en, helemaal onderaan, de Zegelkamer.</p>
 <ol class="g-steps"><li><b>Kies een verhaal.</b> Een loket voor inwoners, beslissingen op bezwaar of Woo-verzoeken.</li><li><b>Onderzoek en kies samen.</b> Doe in elke kamer een proef, lees de bronnen en kies maatregelen. Tot vijftien adviseurs denken mee via hun telefoon.</li><li><b>Versla wat je tegenhoudt.</b> Hype, haast, lekken en vooroordelen, elk met het juiste gereedschap.</li><li><b>Bezegel het besluit.</b> Niet doen, onderzoeken, een pilot of invoeren: jullie dossier laat zien wat het draagt, en wat er een jaar later gebeurt.</li></ol>
 ${saved?`<button id="resume" class="g-primary" data-act>Ga verder · ${esc(content.story.title)} · ${session.code} <span>→</span></button><button id="begin" class="g-btn g-wide" data-act>Begin een nieuwe afdaling</button>`:`<button id="begin" class="g-primary" data-act>Begin de afdaling <span>→</span></button>`}
 <p class="g-help">Solo of met maximaal 15 adviseurs · reken op 60 tot 120 minuten · voortgang wordt na iedere actie bewaard</p><a class="g-link" href="/?audience">Ik doe mee via mijn telefoon →</a></div>`;
}
function sourceChips(d){const r=room(d.id);return `<div class="g-sources"><span class="g-sources-label">Bronnen in de kamer · optioneel</span>${d.clues.map((c,i)=>`<button class="g-chip ${r.visited.includes(c.id)?'is-read':''}" data-clue="${c.id}">${['📖','📜','🔮'][i]} ${esc(c.title)}${r.visited.includes(c.id)?' ✓':''}</button>`).join('')}</div>`}
function optionList(d,r,host){return `<fieldset class="g-options"><legend class="sr-only">Kies meerdere maatregelen</legend>${d.options.map((o,i)=>`<label class="g-option ${selected.includes(i)?'selected':''}" for="option-${i}"><input id="option-${i}" type="checkbox" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${letter(i)}</span><span>${esc(o.text)}${host?`<small class="g-count">${r.counts[i]} ${r.counts[i]===1?'advies':'adviezen'}<span class="g-meter"><i style="width:${r.ballots?r.counts[i]/r.ballots*100:0}%"></i></span></small>`:''}</span></label>`).join('')}</fieldset>`}
function feedback(d,r){const a=r.result;return `<div class="g-result ${a.complete?'is-strong':'is-open'}"><span class="g-seal-icon">${a.complete?'✦':'◇'}</span><div><h2>${a.complete?'Stevig in het dossier.':'Open punten in het dossier.'}</h2><p>${a.complete?'Jullie keuze bevat alle kernmaatregelen en geen ongeschikte aanpak.':`${a.missing.length?`${a.missing.length} kernmaatregel${a.missing.length===1?' ontbreekt':'en ontbreken'}. `:''}${a.unsuitable.length?`${a.unsuitable.length} gekozen aanpak${a.unsuitable.length===1?' past':'ken passen'} hier niet. `:''}Dit telt mee als open punt bij het besluit.`}</p></div></div>
 <div class="g-advice">Keuze: <b>${a.selection.map(letter).join(', ')}</b> · ${a.ballots} ${a.ballots===1?'advies':'adviezen'}<small>Raad: ${a.counts.map((n,i)=>`${letter(i)} ${n}`).join(' · ')}</small>${a.reason?`<p>“${esc(a.reason)}”</p>`:''}</div>
 ${d.options.map((o,i)=>{const chosen=a.selection.includes(i),label=o.status==='correct'?(chosen?'Passende kernmaatregel':'Gemiste kernmaatregel'):o.status==='supporting'?'Nuttige aanvulling':chosen?'Niet passend in deze casus':'Terecht niet gekozen';return `<details class="g-feedback ${o.status}" ${(chosen||a.missing.includes(i))?'open':''}><summary><span class="g-letter">${letter(i)}</span><span><b>${label}</b><small>${chosen?'Gekozen':'Niet gekozen'}</small></span></summary><p class="g-feedback-option">${esc(o.text)}</p><p>${esc(o.feedback)}</p></details>`}).join('')}`}
function findingBox(d){const tr=room(d.id)?.trial;if(!d.trial)return '';if(tr?.outcome==='done'||doneTrials.has(d.id)&&tr?.outcome!=='skipped')return `<div class="g-finding"><div class="g-kicker">WAT DE PROEF LIET ZIEN · ${esc(d.trial.title)}</div><p>${esc(d.trial.finding)}</p></div>`;if(tr?.outcome==='skipped')return `<div class="g-finding is-skipped"><div class="g-kicker">PROEF OVERGESLAGEN</div><p>${esc(d.trial.title)} staat nog open. Praat opnieuw met ${esc(d.npc)} om hem alsnog te doen.</p>${world?`<button class="g-btn" id="start-trial" data-id="${d.id}">Doe de proef alsnog</button>`:''}</div>`;return ''}
function dossierGroups(dossier){
 const chip=c=>`<span class="g-dchip is-${c.state}" title="${STATE_LABEL[c.state]}">${esc(c.title)}${dossier.critical?.includes(c.id)?' ★':''}</span>`;
 return ['strong','open','blind'].map(s=>{const list=dossier.chambers.filter(c=>c.state===s);return `<div class="g-dgroup is-${s}"><div class="g-dgroup-head"><b>${STATE_LABEL[s]}</b><span>${list.length}</span></div>${list.length?`<div class="g-dchips">${list.map(chip).join('')}</div>`:`<p class="g-help">${s==='strong'?'Nog niets stevig onderbouwd.':s==='open'?'Geen open punten.':'Geen blinde vlekken.'}</p>`}</div>`}).join('')+(dossier.critical?.length?`<p class="g-help">★ Kritisch voor dit verhaal: ${dossier.critical.map(id=>esc(chamber(id).title)).join(', ')}.</p>`:'');
}
function lessonsLearned(){const st=content.story;return st.arenas.flatMap(a=>{const r=session.arenas[a.id];if(!r)return [];return (r.lessons||[]).map(k=>k==='boss'?{name:st.boss.name,lesson:st.boss.lesson}:st.mobs[k]).filter(Boolean).map(m=>({...m,arena:a.name,skipped:r.outcome==='skipped'}))})}
function renderPanel(){
 const p=$('g-panel');if(!p)return;p.hidden=!panel||!session;if(p.hidden)return;
 const close=`<button class="g-close" id="close-panel" aria-label="Paneel sluiten">×</button>`,st=content.story;
 if(panel==='letter'){p.innerHTML=`${close}<div class="g-kicker">${esc(st.org.toUpperCase())} · ${esc(st.letter.to.toUpperCase())}</div><h2>De brief</h2><div class="g-letterpaper"><p class="g-letter-to">${esc(st.letter.to)},</p><p>${esc(st.letter.text)}</p><p class="g-letter-from">— ${esc(st.letter.from)}</p></div><div class="g-callout">${face}<p><b>Pip:</b> ${esc(st.pip.intro)}</p></div><p class="g-help">Elke kamer heeft een proef, een vraag en drie bronnen. Er is geen vaste route en geen score. Wat jullie overslaan, wordt een blinde vlek in het dossier. Jullie mogen ook concluderen dat AI hier niet de juiste oplossing is. Pas op voor de man met de glimmende map: hij heeft een kortere weg.</p><button class="g-primary" id="close-panel">Ik ga op weg <span>→</span></button>`;return}
 if(panel==='vendor'){p.innerHTML=`${close}<div class="g-kicker">${esc(st.vendor.company.toUpperCase())} · ACCOUNTMANAGER</div><h2>${esc(st.vendor.name)} heeft een aanbod</h2><div class="g-npc-line g-vendor">${face}<p>“${esc(vendorDeclined?st.vendor.again:st.vendor.pitch)}”</p></div><p class="g-lead">De Snelle Trap brengt jullie direct naar de Zegelkamer. Alles wat jullie overslaan, staat daar als blinde vlek in het dossier.</p>${session.shortcut?'<p class="g-help">Jullie namen de trap al eens. Dat staat in het dossier.</p>':''}<button class="g-btn g-wide g-danger" id="take-shortcut" data-act>Neem de Snelle Trap</button><button class="g-primary" id="decline-shortcut">Nee, dank u. Wij onderzoeken het eerst <span>→</span></button>`;return}
 if(panel==='map'){const lv=content.levels;p.innerHTML=`${close}<div class="g-kicker">KAART VAN HET GEWELF · ${esc(st.title.toUpperCase())}</div><h2>Waar willen jullie heen?</h2><p class="g-lead">Klik om er direct naartoe te reizen. Handig als de tijd dringt of als de 3D-weergave niet werkt.</p>${lv.map((l,L)=>`<div class="g-map-depth"><div class="g-map-head"><span>${esc(l.label)}</span><b>${esc(l.name)}</b></div>${L===0?`<button class="g-map-room" data-go="letter"><span class="g-dot"></span>Ontvangsthal · de brief</button>`:L===7?`<button class="g-map-room" data-go="verdict"><span class="g-dot is-${room('verdict').attemptCount?'strong':'blind'}"></span>Het zegel · het besluit</button>`:ARENA_AT[L]?`<button class="g-map-room" data-go="${ARENA_AT[L]}"><span class="g-dot is-${session.arenas[ARENA_AT[L]]?.outcome==='cleared'?'strong':session.arenas[ARENA_AT[L]]?'open':'blind'}"></span>${esc(l.name)}<small>${session.arenas[ARENA_AT[L]]?.outcome==='cleared'?'doorstaan':session.arenas[ARENA_AT[L]]?'overgeslagen':'nog te doen'}</small></button>`:content.chambers.filter(c=>(L===1&&c.group==='necessity')||(L===3&&c.group==='foundation')||(L===5&&c.group==='domain')).map(c=>`<button class="g-map-room" data-go="${c.id}"><span class="g-dot is-${stateOf(c.id)}"></span>${esc(c.title)}<small>${room(c.id).trial?.outcome==='done'?'proef ✓ · ':''}${esc(c.npc)}</small></button>`).join('')}</div>`).join('')}`;return}
 if(panel==='dossier'){const ds=session.dossier,ls=lessonsLearned();p.innerHTML=`${close}<div class="g-kicker">BESLUITDOSSIER · ${esc(st.title.toUpperCase())} · ${session.code}</div><h2>Wat weten we al?</h2><p class="g-lead">${discussed()} van de 15 kamers besproken. Stevig = alle kernmaatregelen gekozen en geen ongeschikte aanpak. Open = er ontbreekt iets of er is een ongeschikte aanpak gekozen.</p>${dossierGroups(ds)}${session.shortcut?'<p class="g-callout-warn">Jullie namen de Snelle Trap van de leverancier.</p>':''}
  ${content.chambers.filter(c=>room(c.id).trial?.outcome==='done').length?`<h3 class="g-h3">Bevindingen uit de proeven</h3>${content.chambers.filter(c=>room(c.id).trial?.outcome==='done').map(c=>`<div class="g-note-entry"><b>${esc(c.title)} · ${esc(c.trial.title)}</b><p>${esc(c.trial.finding)}</p></div>`).join('')}`:''}
  ${ls.length?`<h3 class="g-h3">Lessen uit de tussenkamers</h3>${ls.map(m=>`<div class="g-note-entry"><b>${esc(m.name)}</b><p>${esc(m.lesson)}</p></div>`).join('')}`:''}
  ${content.chambers.filter(c=>room(c.id).note).map(c=>`<div class="g-note-entry"><b>Projectnotitie · ${esc(c.title)}</b><p>${esc(room(c.id).note)}</p></div>`).join('')}<button id="download" class="g-primary">Download het dossier ↓</button><p class="g-help">Het dossier legt een leergesprek vast. Het is geen toetsing of toestemming om AI in te zetten.</p>`;return}
 if(panel==='guide'){const seen=new Set([...(fight?.lessons||[]),...Object.values(session.arenas).flatMap(a=>a?.lessons||[])]);const mobs=Object.entries(st.mobs);
  p.innerHTML=`${close}<div class="g-kicker">GIDS · ${esc(st.title.toUpperCase())}</div><h2>Wat werkt tegen wat?</h2><p class="g-lead">Elk monster is zwak tegen één wapen. Een verkeerd wapen doet niets. De lessen lees je pas als je een monster hebt verslagen.</p>
  <h3 class="g-h3">Je wapens</h3>${content.tools.map(t=>`<div class="g-guide-tool" style="--tool:${t.color}"><span>${t.icon}</span><div><b>${t.key} · ${esc(t.name)}</b> — ${esc(t.attack)}<p>${esc(t.text)}</p></div></div>`).join('')}
  <h3 class="g-h3">Monsters in dit verhaal</h3>${mobs.map(([k,m])=>{const t=toolOf(m.tool);return `<div class="g-note-entry"><b>${esc(m.name)}</b> · zwak tegen <b style="color:${t.color}">${t.icon} ${esc(t.name)}</b><p>${seen.has(k)?esc(m.lesson):'<i>Versla er een om de les te lezen.</i>'}</p></div>`}).join('')}
  <div class="g-note-entry"><b>${esc(st.boss.name)}</b> · eindbaas<p>Wisselt drie keer van zwakte. De kern op zijn borst krijgt de kleur van het wapen dat dan werkt.</p></div>`;return}
 if(panel==='verdict'){renderVerdict(p,close);return}
 const d=chamber(session.topic);if(!d){p.hidden=true;return}const r=room(d.id);
 const top=`${close}<div class="g-kicker" style="--accent:${d.color}">${esc(groupLabel(d))}</div><h2>${esc(d.place)}</h2>`;
 if(panel==='trial'){const t=d.trial;p.innerHTML=`${top}<div class="g-npc-line">${face}<p>${esc(d.hook)}</p></div><p class="g-lead">${esc(d.scenario)}</p><div class="g-trial-card"><div class="g-kicker">EERST ONDERZOEKEN · PROEF</div><h3>${esc(t.title)}</h3><p>“${esc(t.intro)}”</p><p class="g-help">${esc(t.task)}. ${t.type==='fight'?(session.peaceful?'Rustige modus: de fluisteraars vallen niet aan.':'Gebruik je Zegel (3) tegen de fluisteraars.'):'Wat je ontdekt, helpt bij de keuze.'}</p></div>
  ${world?`<button class="g-primary" id="start-trial" data-id="${d.id}">Begin de proef <span>→</span></button>`:''}<button class="g-btn g-wide" id="skip-to-case" data-id="${d.id}" data-act>Sla de proef over en ga naar de keuze</button><p class="g-help">De adviesraad kan de casus en bronnen al lezen en advies geven.</p>`;return}
 if(r.opened){p.innerHTML=`${top}<div class="g-npc-line">${face}<p>${esc(d.hook)}</p></div><p class="g-lead">${esc(d.scenario)}</p>${findingBox(d)}<p class="g-question">${esc(d.question)}</p>${sourceChips(d)}<div class="g-vote-status"><span class="g-live"></span>${r.ballots} / ${session.audienceCount} adviezen ontvangen</div><p class="g-help">Selecteer alle kernmaatregelen. Nuttige aanvullingen mogen ook.</p>${optionList(d,r,true)}<label class="g-label" for="reason">Waarom deze keuze? <span>optioneel</span></label><textarea id="reason" rows="2" maxlength="800" placeholder="Bijvoorbeeld: in onze organisatie is…">${esc(draftReason[d.id]||'')}</textarea><button id="decide" class="g-primary" data-act data-locked="${!selected.length}">${selected.length?`Leg keuze ${selected.map(letter).join(' + ')} vast`:'Selecteer jullie maatregelen'} <span>→</span></button>`}
 else p.innerHTML=`${top}${feedback(d,r)}${findingBox(d)}${sourceChips(d)}<label class="g-label" for="note">Mee naar ons project</label><p class="g-help">${esc(d.reflection)}</p><textarea id="note" rows="3" maxlength="1200" placeholder="Noteer een inzicht, actie of open vraag…">${esc(draftNotes[d.id]??r.note)}</textarea><button id="saveNote" class="g-btn g-wide" data-act>Bewaar projectnotitie</button><button id="close-panel" class="g-primary">Verder verkennen <span>→</span></button><button id="retry" class="g-btn g-wide" data-act>Bespreek deze kamer opnieuw</button><details class="g-details"><summary>Bron en verdieping</summary><p>Gebaseerd op ${esc(d.source)}.</p><a href="${FRAMEWORK_URL}" target="_blank" rel="noopener">Open het AI-raamwerk ↗</a></details>`;
}
function epilogueCard(a){return a.epilogue?`<div class="g-epilogue"><div class="g-kicker">EEN JAAR LATER</div><p>${esc(a.epilogue)}</p></div>`:''}
function renderVerdict(p,close){
 const r=room('verdict'),a=r.result,V=content.verdict;
 if(r.opened||!a){const ds=session.dossier;p.innerHTML=`${close}<div class="g-kicker">DIEPTE 4 · DE ZEGELKAMER</div><h2>${esc(V.question)}</h2><p class="g-lead">Kijk eerst wat jullie dossier draagt. Blinde vlekken zijn dingen die jullie niet weten; open punten zijn dingen die nog niet op orde zijn. Pas daarna zie je wat het dossier zelf zegt.</p>${dossierGroups(ds)}${session.shortcut?'<p class="g-callout-warn">Jullie namen de Snelle Trap van de leverancier. Wat jullie oversloegen, is een blinde vlek.</p>':''}<div class="g-vote-status"><span class="g-live"></span>${r.ballots} / ${session.audienceCount} adviezen ontvangen</div>
  <fieldset class="g-options g-verdicts"><legend class="sr-only">Kies één besluit</legend>${V.options.map((o,i)=>`<label class="g-option g-verdict-${o.key} ${selected.includes(i)?'selected':''}" for="verdict-${i}"><input id="verdict-${i}" type="radio" name="verdict" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${i+1}</span><span><b>${esc(o.title)}</b><br>${esc(o.text)}<small class="g-count">${r.counts[i]} ${r.counts[i]===1?'advies':'adviezen'}<span class="g-meter"><i style="width:${r.ballots?r.counts[i]/r.ballots*100:0}%"></i></span></small></span></label>`).join('')}</fieldset>
  <label class="g-label" for="reason">Onderbouwing van het besluit <span>aanbevolen</span></label><textarea id="reason" rows="3" maxlength="800" placeholder="Wat geeft de doorslag, en wat zeggen jullie tegen ${esc(content.story.letter.from.toLowerCase())}?">${esc(draftReason.verdict||'')}</textarea><button id="decide" class="g-primary" data-act data-locked="${!selected.length}">${selected.length?`Bezegel: ${esc(V.options[selected[0]].title)}`:'Kies een besluit'} <span>→</span></button><p class="g-help">Het besluit is altijd van jullie. Het dossier geeft daarna aan wat het onderbouwt, en wat er een jaar later gebeurt.</p>`;return}
 const o=V.options[a.selection[0]],c=draftCommit||session.commitments;
 p.innerHTML=`${close}<div class="g-kicker">HET BESLUIT IS BEZEGELD</div><div class="g-verdict-result is-${a.judgement}"><small>Jullie besluit</small><h2>${esc(o.title)}</h2><p>${esc(JUDGEMENTS[a.judgement])}</p></div>
 ${epilogueCard(a)}
 <div class="g-advice">Het dossier droeg maximaal: <b>${esc(V.options[a.ceiling].title)}</b><small>Raad: ${a.counts.map((n,i)=>`${V.options[i].title} ${n}`).join(' · ')}</small>${a.reason?`<p>“${esc(a.reason)}”</p>`:''}</div>
 <h3 class="g-h3">Wat het besluit begrenst</h3>${a.dossier.reasons.length?`<ul class="g-reasons">${a.dossier.reasons.map(x=>`<li class="lvl-${x.level}">${esc(x.text)}</li>`).join('')}</ul>`:'<p class="g-help">Het dossier vond geen beperkingen. Blijf monitoren na invoering.</p>'}
 <h3 class="g-h3">Afspraken voor de echte wereld</h3><p class="g-help">Welk besluit het ook is: wie doet wat, en wanneer kijken jullie terug?</p>
 <label class="g-label" for="c-owner">Eigenaar van het vervolg</label><input id="c-owner" data-commit="owner" maxlength="300" value="${esc(c.owner)}" placeholder="Naam of rol">
 <label class="g-label" for="c-first">Eerste concrete stap</label><input id="c-first" data-commit="firstStep" maxlength="300" value="${esc(c.firstStep)}" placeholder="Bijvoorbeeld: een probleemanalyse met het team">
 <label class="g-label" for="c-date">Evaluatiedatum</label><input id="c-date" type="date" data-commit="reviewDate" value="${esc(c.reviewDate)}">
 <label class="g-label" for="c-stop">Wanneer stoppen of bijsturen we?</label><input id="c-stop" data-commit="stopCondition" maxlength="300" value="${esc(c.stopCondition)}" placeholder="Bijvoorbeeld: meer dan 2% onjuiste antwoorden">
 <button id="saveCommit" class="g-btn g-wide" data-act>Bewaar afspraken</button><button id="download" class="g-primary">Download het besluitdossier ↓</button>
 ${session.completed?'':`<button id="retry" class="g-btn g-wide" data-act>Weeg opnieuw af</button><button id="finish" class="g-btn g-wide" data-act>Rond de afdaling af</button>`}<p class="g-help">Terug naar boven om blinde vlekken te onderzoeken mag altijd. Daarna kun je opnieuw afwegen.</p>`;
}
function sourceBody(d,c){return `<p class="g-source-lead">${esc(c.body)}</p><p>${esc(c.explanation||'')}</p>${c.steps?.length?`<h3>In de praktijk</h3><ul>${c.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}${c.example?`<div class="g-example"><b>Voorbeeld</b><p>${esc(c.example)}</p></div>`:''}<p class="g-source-ref">Bewerkt uit ${esc(d.source)} · ${esc(c.section||'Good practices')}.</p>`}
function renderReader(){
 const el=$('g-reader');if(!el)return;const d=chamber(session?.topic),c=d?.clues.find(x=>x.id===activeClue);el.hidden=!c;if(!c)return;
 el.innerHTML=`<div class="g-reader-top"><span class="g-kicker">BRON · ${esc(d.title)}</span><button id="close-reader" class="g-close" aria-label="Bron sluiten">×</button></div><h2>${esc(c.title)}</h2>${sourceBody(d,c)}${panel?'':'<button id="close-reader" class="g-primary">Terug naar de kamer <span>→</span></button>'}`;
}

// ---------- invite / modal ----------
function closeModal(){const m=$('g-modal');if(m){m.remove();app.inert=false;modalRestore?.focus?.({preventScroll:true})}}
function showModal(html){closeModal();modalRestore=document.activeElement;const el=document.createElement('div');el.id='g-modal';el.className='g-modal-backdrop';el.innerHTML=`<section class="g-modal" role="dialog" aria-modal="true" aria-label="Spelinformatie"><button class="g-close" id="close-modal" aria-label="Sluiten">×</button>${html}</section>`;document.body.append(el);app.inert=true;world?.setPaused(true);el.querySelector('button,input,a')?.focus()}
async function invite(){if(!session)return;showModal('<h2>Haal de adviesraad erbij</h2><p class="g-lead">De uitnodiging wordt klaargezet…</p>');try{const net=await api('network'),origin=net.local?net.origin:location.origin,url=`${origin}/?join=${session.code}`;const qr=await QRCode.toDataURL(url,{width:240,margin:2,color:{dark:'#1b140e',light:'#f3e6c4'}});if(!$('g-modal'))return;showModal(`<div class="g-kicker">SAMEN AFWEGEN · MAXIMAAL 15 ADVISEURS</div><h2>De raad is welkom.</h2><div class="g-invite"><img src="${qr}" alt="QR-code om deel te nemen aan sessie ${session.code}"><div><span class="g-help">Sessiecode</span><strong class="g-code">${session.code}</strong><p>Adviseurs lezen elke kamer op hun telefoon, ook de bronnen, en geven advies. Tijdens gevechten kunnen ze de speler steunen. Jij neemt het besluit.</p></div></div><label class="g-label" for="invite-url">Deelnamelink</label><input id="invite-url" readonly value="${esc(url)}"><button id="copy" class="g-primary">Kopieer de link <span>⧉</span></button><p class="g-help">${net.local?'Computer en telefoons moeten op hetzelfde netwerk zitten. Werkt de link niet, controleer wifi, VPN en firewall.':'Deelnemers hebben toegang tot deze site nodig.'}</p>`)}catch(e){closeModal();toast(e.message)}}
async function download(){if(!session)return;try{if(!audience)await persistNote();const res=await fetch(`/api/game/${session.code}/report`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});if(!res.ok)throw new Error('Download niet gelukt.');const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=`het-gewelf-${session.story}-besluitdossier-${session.code}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){toast(e.message)}}
async function persistNote(){const id=session?.topic;if(id&&draftNotes[id]!==undefined&&draftNotes[id]!==room(id).note)return act('note',{note:draftNotes[id]});return true}
function enterWorld(){
 started=true;choosing=false;lastLevel=-1;closeModal();applyStory();
 if(world){world.setAttract(false);const target=session.topic&&session.topic!=='verdict'?session.topic:session.topic==='verdict'?'verdict':session.level;world.goTo(target,true);world.lock()}
 else handleLevel(session.level);
 syncWorld();render();renderCombat();if(!letterRead)say('Ik ben Pip. Zie je die lessenaar met de brief? Daar begint ons verhaal. Loop erheen en druk op E.',{ms:12000});
}
async function begin(){
 if(busy)return;busy=true;setBusy();
 try{const data=await api('create',{method:'POST',body:{story:pickStory,peaceful:pickPeaceful},pass:''});token=data.token;saveStore('gewelf-host',{code:data.session.code,token});draftNotes={};draftReason={};draftCommit=null;letterRead=false;vendorDeclined=false;trial=null;fight=null;session=null;appliedStory=null;setSession(data.session);poll();sound.chime(true);enterWorld()}
 catch(e){toast(e.message)}finally{busy=false;setBusy()}
}

// ---------- audience (phones) ----------
function joinForm(error=''){app.innerHTML=`<div class="g-phone"><header>${brand()}</header><main class="g-phone-card"><div class="g-kicker">JOUW TELEFOON, JOUW STEM</div><h1>Neem plaats<br>in de adviesraad.</h1><p class="g-lead">De speler daalt af in het Gewelf. Jij leest mee, denkt na en geeft advies. Tijdens gevechten kun je steun sturen. De speler maakt de uiteindelijke keuze.</p>${error?`<p role="alert" class="g-error">${esc(error)}</p>`:''}<form id="join-form"><label class="g-label" for="code">Sessiecode</label><input id="code" name="code" required maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" autocomplete="off" value="${esc(params.get('join')||'')}" placeholder="ABC234"><label class="g-label" for="name">Naam of bijnaam</label><input id="name" name="name" required maxlength="32" autocomplete="nickname" placeholder="Hoe mogen we je noemen?"><button class="g-primary" type="submit">Sluit aan <span>→</span></button></form><a class="g-link" href="/">Ik speel op het grote scherm</a></main></div>`}
function renderAudience(){
 if(!session)return;const open=[...document.querySelectorAll('.g-phone details')].map((el,i)=>el.open?i:-1),focusId=document.activeElement?.id;
 const st=content.story,d=chamber(session.topic),r=room(session.topic),lv=content.levels[session.level],V=content.verdict;let body;
 if(session.completed){const v=room('verdict').result;body=`<div class="g-kicker">AFDALING AFGEROND</div><h1>Bedankt voor<br>het meedenken.</h1>${v?`<div class="g-verdict-result is-${v.judgement}"><small>Het besluit</small><h2>${esc(V.options[v.selection[0]].title)}</h2><p>${esc(JUDGEMENTS[v.judgement])}</p></div>${epilogueCard(v)}`:''}<button id="download" class="g-primary">Download het besluitdossier ↓</button>`}
 else if(session.topic==='verdict'){
  if(r.opened)body=`<div class="g-kicker">DIEPTE 4 · DE ZEGELKAMER</div><h1>${esc(V.question)}</h1><p class="g-lead">Dit is het dossier tot nu toe. Wat zou jij adviseren?</p>${dossierGroups(session.dossier)}<fieldset class="g-options g-verdicts"><legend class="sr-only">Kies één besluit</legend>${V.options.map((o,i)=>`<label class="g-option ${selected.includes(i)?'selected':''}" for="verdict-${i}"><input id="verdict-${i}" type="radio" name="verdict" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${i+1}</span><span><b>${esc(o.title)}</b><br>${esc(o.text)}</span></label>`).join('')}</fieldset>${voteButton(r)}`;
  else{const a=r.result;body=`<div class="g-kicker">HET BESLUIT IS BEZEGELD</div><div class="g-verdict-result is-${a.judgement}"><small>Besluit van de speler</small><h2>${esc(V.options[a.selection[0]].title)}</h2><p>${esc(JUDGEMENTS[a.judgement])}</p></div>${epilogueCard(a)}<h3 class="g-h3">Wat het besluit begrenst</h3><ul class="g-reasons">${a.dossier.reasons.map(x=>`<li class="lvl-${x.level}">${esc(x.text)}</li>`).join('')||'<li>Geen beperkingen gevonden.</li>'}</ul>`}
 }else if(d){
  const tr=r.trial,trialLine=d.trial?(tr?.outcome==='done'?`<div class="g-finding"><div class="g-kicker">WAT DE PROEF LIET ZIEN · ${esc(d.trial.title)}</div><p>${esc(d.trial.finding)}</p></div>`:tr?.outcome==='skipped'?'':`<div class="g-finding is-pending"><div class="g-kicker">DE SPELER ONDERZOEKT · ${esc(d.trial.title)}</div><p>${esc(d.trial.task)}. De bevinding verschijnt hier zodra de proef klaar is.</p></div>`):'';
  body=`<div class="g-kicker">${esc(groupLabel(d))}</div><h1>${esc(d.place)}</h1><p class="g-lead">${esc(d.scenario)}</p>${trialLine}`+(r.result&&!r.opened?`${feedback(d,r)}<div class="g-callout"><p>${esc(d.reflection)}</p></div><p class="g-help">De speler kiest wanneer jullie verdergaan.</p>`:`<details class="g-details"><summary>Bronnen raadplegen (optioneel)</summary>${d.clues.map(c=>`<details class="g-details"><summary>${esc(c.title)}</summary>${sourceBody(d,c)}</details>`).join('')}</details><p class="g-question">${esc(d.question)}</p><p class="g-help">Selecteer alle kernmaatregelen. Nuttige aanvullingen mogen ook. Je kunt je advies wijzigen tot de speler kiest.</p>${optionList(d,r,false)}${voteButton(r)}`);
 }else if(ARENA_AT[session.level]){
  const id=ARENA_AT[session.level],A=st.arenas.find(a=>a.id===id),res=session.arenas[id],mobs=[...new Set(A.waves.flat().map(([k])=>k))].map(k=>st.mobs[k]);
  body=`<div class="g-kicker">${esc(lv.label.toUpperCase())}</div><h1>${esc(A.name)}</h1><p class="g-lead">${esc(A.intro)}</p>
  ${res?`<div class="g-finding"><div class="g-kicker">${res.outcome==='cleared'?'DOORSTAAN':'OVERGESLAGEN'}</div><p>${res.outcome==='cleared'?'De poort is open. Dit leerde de speler onderweg:':'De speler sloeg dit gevecht over.'}</p></div>${(res.lessons||[]).map(k=>k==='boss'?{name:st.boss.name,lesson:st.boss.lesson}:st.mobs[k]).filter(Boolean).map(m=>`<div class="g-note-entry"><b>${esc(m.name)}</b><p>${esc(m.lesson)}</p></div>`).join('')}`
  :`<button id="cheer" class="g-primary g-cheer" data-act>✦ Stuur steun aan de speler <span>→</span></button><p class="g-help">Je steun geeft de speler wat vertrouwen terug. Eens per paar seconden.</p>
  <h3 class="g-h3">Wat er hier rondwaart</h3>${(A.boss?[{...st.boss,tool:st.boss.phases[0].tool,boss:true},st.mobs[st.boss.minion]]:mobs).map(m=>`<div class="g-note-entry"><b>${esc(m.name)}</b>${m.boss?'':` · zwak tegen ${esc(toolOf(m.tool).name)}`}<p>${esc(m.lesson)}</p></div>`).join('')}`}`;
 }else body=`<div class="g-kicker">${esc(lv.label.toUpperCase())}</div><h1>${esc(lv.name)}</h1><p class="g-lead">${esc(lv.line)}</p><div class="g-waiting">${face}<span>Pip loopt voorop. Zodra de speler een bewoner aanspreekt, verschijnt de casus hier vanzelf.</span></div><p class="g-help">${discussed()} van 15 kamers besproken · ${session.audienceCount} adviseurs</p>${dossierGroups(session.dossier)}`;
 app.innerHTML=`<div class="g-phone" style="--story:${st.color}"><header>${brand(`${st.title} · ${st.org}`)}<span class="g-phone-code">${session.code}</span></header><main class="g-phone-card"><div class="g-phone-meta"><span>Raadslid ${esc(session.name)}</span><span>${connected?'● Verbonden':'Opnieuw verbinden…'}</span></div>${body}</main><footer>Jouw stem is advies. De speler beslist.</footer></div>`;
 document.querySelectorAll('.g-phone details').forEach((el,i)=>{if(open.includes(i))el.open=true});if(focusId)$(focusId)?.focus({preventScroll:true});setBusy();
}
function voteButton(r){const changed=JSON.stringify([...selected].sort())!==JSON.stringify(r.ownVote||[]);return `<button id="vote" class="g-primary" data-act data-locked="${!selected.length&&!r.ownVote?.length}">${selected.length?(changed?'Verstuur mijn advies':'Advies verstuurd ✓'):r.ownVote?.length?'Trek mijn advies in':'Maak eerst een keuze'} <span>→</span></button><p class="g-vote-saved" role="status">${r.ownVote?.length?`Opgeslagen advies: ${r.ownVote.map(i=>session.topic==='verdict'?content.verdict.options[i].title:letter(i)).join(', ')}${changed?' · wijziging nog niet verstuurd':''}`:'Nog geen advies verstuurd'}</p>`}

// ---------- events ----------
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.clue){if(!audience)await showClue(b.dataset.clue);return}
 if(b.dataset.story){pickStory=b.dataset.story;renderStart();return}
 if(b.dataset.answer!==undefined){judgeAnswer(Number(b.dataset.answer));return}
 if(b.dataset.tool!==undefined){world?.setTool(Number(b.dataset.tool));return}
 if(b.dataset.go){const go=b.dataset.go;panel=null;panelInset();$('g-panel').hidden=true;world?.setPaused(false);if(fight){world?.stopFight();fight=null;renderCombat()}if(trial?.def.type==='fight')cancelTrial();
  if(go==='letter'){if(world)world.goTo(0);else await handleInteract({kind:'letter'})}else if(world)world.goTo(go);else if(['a1','a2','a3'].includes(go))handleLevel({a1:2,a2:4,a3:6}[go]);else await handleInteract({kind:go==='verdict'?'altar':'npc',id:go});renderHud();return}
 switch(b.id){
  case 'begin':choosing=true;renderStart();break;
  case 'back-title':choosing=false;renderStart();break;
  case 'begin-story':await begin();break;
  case 'resume':enterWorld();break;
  case 'close-panel':await persistNote();closePanel();break;
  case 'close-reader':closeReader();break;
  case 'close-modal':closeModal();if(!panel)world?.setPaused(false);break;
  case 'judge-close':closeJudge();break;
  case 'start-trial':startTrial(b.dataset.id);break;
  case 'skip-to-case':await skipTrial(b.dataset.id);break;
  case 'skip-trial':if(trial){const id=trial.id;await skipTrial(id)}break;
  case 'skip-arena':skipArena();break;
  case 'attack':world?.fire();break;
  case 'draw':world?.setArmed(true);break;
  case 'holster':world?.setArmed(false);break;
  case 'guide':if(session){panel==='guide'?closePanel():openPanel('guide')}break;
  case 'take-shortcut':if(await act('shortcut')){const v=content.story.vendor;closePanel();say(v.taken,{name:v.name,ms:8000});world?.goTo(7);if(!world)handleLevel(7);toast('De Snelle Trap: alles wat jullie overslaan, blijft een blinde vlek in het dossier.')}break;
  case 'decline-shortcut':{const v=content.story.vendor;vendorDeclined=true;closePanel();say(v.declined,{name:v.name,ms:7000});break}
  case 'decide':{const id=session.topic;if(await act('decide',{selection:selected,reason:draftReason[id]||''})){const res=room(id).result;sound.chime(id==='verdict'||res?.complete);say(id==='verdict'?'Het zegel is gezet. Lees wat er een jaar later gebeurt, en leg vast wie wat doet.':res.complete?'Stevig! Dit kan het dossier dragen. Schrijf op wat het betekent voor jullie eigen project.':'Er blijven open punten. Dat is niet erg, zolang jullie ze meenemen naar het besluit.');$('g-panel').scrollTop=0}break}
  case 'retry':await act('retry');break;
  case 'saveNote':if(await persistNote())toast('Projectnotitie bewaard.');break;
  case 'saveCommit':if(draftCommit&&await act('commit',{...draftCommit})){draftCommit=null;toast('Afspraken bewaard.')}break;
  case 'finish':showModal(`<div class="g-kicker">AFRONDEN</div><h2>Klaar met afdalen?</h2><p class="g-lead">Na afronden sluit de adviesraad. Het besluitdossier blijft beschikbaar om te downloaden.</p><button id="confirm-finish" class="g-primary" data-act>Rond de afdaling af <span>→</span></button><button id="close-modal" class="g-btn g-wide">Nog even verder</button>`);break;
  case 'confirm-finish':if(draftCommit)await act('commit',{...draftCommit});draftCommit=null;if(await act('finish')){closeModal();panel='verdict';sound.chime(true);render()}break;
  case 'vote':if(await act('vote',{selection:selected}))toast(selected.length?'Je advies is opgeslagen.':'Je advies is ingetrokken.');break;
  case 'cheer':if(await act('cheer'))toast('Je steun is verstuurd ✦');break;
  case 'invite':await invite();break;
  case 'map':panel==='map'?closePanel():openPanel('map');break;
  case 'dossier':if(session){panel==='dossier'?closePanel():openPanel('dossier')}else toast('Begin eerst een afdaling.');break;
  case 'download':await download();break;
  case 'copy':try{await navigator.clipboard.writeText($('invite-url').value);toast('Deelnamelink gekopieerd.')}catch{$('invite-url').select();toast('Selecteer en kopieer de link uit het veld.')}break;
  case 'sound':sound.set(!sound.on);b.textContent=sound.on?'Geluid aan':'Geluid uit';b.setAttribute('aria-pressed',String(sound.on));sound.chime();break;
  case 'full':try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Volledig scherm is hier niet beschikbaar.')}break;
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='peaceful'){pickPeaceful=e.target.checked;return}
 if(e.target.matches('.g-options input')){selected=[...document.querySelectorAll('.g-options input:checked')].map(el=>Number(el.value));const y=$('g-panel')?.scrollTop;render();if(y!=null&&$('g-panel'))$('g-panel').scrollTop=y}
});
document.addEventListener('input',e=>{const id=session?.topic;if(e.target.id==='reason'&&id)draftReason[id]=e.target.value;if(e.target.id==='note'&&id)draftNotes[id]=e.target.value;if(e.target.dataset.commit){draftCommit ||= {...session.commitments};draftCommit[e.target.dataset.commit]=e.target.value}});
document.addEventListener('keydown',e=>{
 if(audience)return;const m=$('g-modal');
 if(m){if(e.key==='Escape'){e.preventDefault();closeModal();if(!panel)world?.setPaused(false)}if(e.key==='Tab'){const nodes=[...m.querySelectorAll('button:not(:disabled),a[href],input,textarea')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}return}
 if(judging){if(e.key==='Escape'){e.preventDefault();closeJudge()}return}
 if(/INPUT|TEXTAREA/.test(document.activeElement?.tagName||''))return;
 if(e.key==='Escape'){if(activeClue){closeReader();return}if(panel){persistNote();closePanel()}}
 if((e.key==='g'||e.key==='G')&&started&&session){e.preventDefault();panel==='guide'?closePanel():openPanel('guide');return}
 if((e.key==='m'||e.key==='M')&&started&&session&&!fight){e.preventDefault();panel==='map'?closePanel():openPanel('map')}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='join-form')return;e.preventDefault();if(busy)return;busy=true;const form=new FormData(e.target),code=String(form.get('code')).trim().toUpperCase(),b=e.target.querySelector('button');b.disabled=true;
 try{const saved=getStore(`gewelf-audience-${code}`),data=await api(`${code}/join`,{method:'POST',body:{name:form.get('name'),token:saved?.token},pass:''});token=data.token;saveStore(`gewelf-audience-${code}`,{token});history.replaceState(null,'',`/?join=${code}`);setSession(data.session);poll()}
 catch(err){toast(err.message);b.disabled=false}finally{busy=false;setBusy()}
});
async function boot(){
 if(audience){joinForm();const code=(params.get('join')||'').toUpperCase(),saved=getStore(`gewelf-audience-${code}`);if(saved?.token&&/^[A-Z2-9]{6}$/.test(code)){token=saved.token;try{setSession((await api(code)).session);poll()}catch(e){token='';joinForm(e.message)}}return}
 hostShell();render();
 const saved=getStore('gewelf-host');
 if(saved?.token&&saved?.code){token=saved.token;try{letterRead=!!getStore(`gewelf-letter-${saved.code}`);setSession((await api(saved.code)).session);poll()}catch(e){token='';if(e.status!==404&&e.status!==410)toast(e.message)}}
 render();
}
if(params.has('debug'))window.__gewelf={get world(){return world},get session(){return session},get trial(){return trial},get fight(){return fight},act,startTrial,handleArena,handleInteract,judgeAnswer,closeJudge,skipArena,get panel(){return panel},STORIES};
window.addEventListener('pagehide',e=>{if(!e.persisted){clearInterval(pollTimer);world?.dispose()}});
Promise.race([document.fonts?.load('700 40px Cinzel'),new Promise(r=>setTimeout(r,2500))]).catch(()=>{}).finally(boot);
