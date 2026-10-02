import QRCode from 'qrcode';
import {createDungeon} from './dungeon.js';
import {CHAMBERS,VERDICT,DEPTHS,INTRO,JUDGEMENTS} from '../game/descent.cjs';
import {FRAMEWORK_URL} from '../game/topics.cjs';

const $=id=>document.getElementById(id),app=$('app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const letter=i=>String.fromCharCode(65+i),pad=n=>String(n).padStart(2,'0');
const params=new URLSearchParams(location.search),audience=params.has('join')||params.has('audience');
const FOUNDATIONS=['governance','culture','capacity','infrastructure'];
const DOMAINS=['evaluation','quality','interaction','performance','functionality','sustainability','sovereignty','ethics','compliance','security'];
const STATE_LABEL={strong:'Stevig',open:'Open punten',blind:'Blinde vlek'};
const face='<span class="g-face" aria-hidden="true"><i></i><i></i></span>';
const brand=`<a class="g-brand" href="/" aria-label="Het Gewelf, startpagina">${face}<span>HET GEWELF<small>AI-RAAMWERK · AFDALING 3.0</small></span></a>`;
let session=null,token='',world=null,busy=false,polling=false,pollTimer,toastTimer,pipTimer,connected=true,panel=null,activeClue=null,letterRead=false,lastDepth=-1,modalRestore=null,started=false;
let selected=[],selectionKey='',draftReason={},draftNotes={},draftCommit=null;
const chamber=id=>CHAMBERS.find(c=>c.id===id);
const room=id=>session?.topics[id];
const stateOf=id=>session?.dossier.chambers.find(c=>c.id===id)?.state||'blind';
const discussed=()=>session?CHAMBERS.filter(c=>session.topics[c.id].attemptCount).length:0;
const getStore=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const saveStore=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),5200)}
function groupLabel(d){return d.group==='necessity'?'DIEPTE 1 · DE VRAAG':d.group==='foundation'?`FUNDAMENT ${pad(d.number)} · ${d.title}`:`DOMEIN ${pad(d.number-4)} · ${d.title}`}

// ---------- sound: a low drone, drips, footsteps and chimes, all synthesised ----------
const sound={on:false,ctx:null,master:null,drone:null,
 start(){try{this.ctx ||= new AudioContext();this.ctx.resume();if(this.master)return;const c=this.ctx;this.master=c.createGain();this.master.gain.value=.5;this.master.connect(c.destination);
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=320;lp.connect(this.master);const g=c.createGain();g.gain.value=.05;g.connect(lp);
  for(const hz of [55,55.4,82.5]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(g);o.start()}
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.07;lg.gain.value=140;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
  const drip=()=>{if(this.on&&!document.hidden)this.tone(1400+Math.random()*900,.18,.02,'sine',true);setTimeout(drip,2500+Math.random()*6000)};drip()}catch{}},
 set(on){this.on=on;if(on)this.start();if(this.master)this.master.gain.setTargetAtTime(on?.5:0,this.ctx.currentTime,.3)},
 tone(hz,len=.5,vol=.05,type='sine',drop=false,delay=0){if(!this.on||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz,t);if(drop)o.frequency.exponentialRampToValueAtTime(hz*.45,t+len);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+len+.05)},
 step(run){if(!this.on||!this.ctx)return;const c=this.ctx,len=.09,b=c.createBuffer(1,c.sampleRate*len,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**3;const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=run?900:600;g.gain.value=run?.22:.16;s.buffer=b;s.connect(f);f.connect(g);g.connect(this.master);s.start()},
 chime(success){[392,494,...(success?[587,784]:[])].forEach((hz,i)=>this.tone(hz,.6,.05,'triangle',false,i*.1))},
 descend(){[330,262,196,147].forEach((hz,i)=>this.tone(hz,.9,.05,'sine',false,i*.14))}
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
 session=next;connected=true;
 const key=`${next.code}:${next.topic}:${next.epoch}`;
 if(selectionKey!==key){selectionKey=key;selected=audience?[...(room(next.topic)?.ownVote||[])]:[]}
 if(!audience&&(next.depth>0||discussed()))letterRead=true;
 if(audience)renderAudience();else{syncWorld();render()}
}

// ---------- host ----------
function hostShell(){
 app.innerHTML=`<div class="g-root" id="g-root">
 <canvas id="world" tabindex="0" aria-label="Het Gewelf in 3D. Klik om rond te kijken. Loop met WASD of de pijltjestoetsen. E gebruikt wat je ziet. M opent de kaart."></canvas>
 <div class="g-vignette" aria-hidden="true"></div><div class="g-crosshair" aria-hidden="true"></div>
 <div id="g-prompt" class="g-prompt" role="status"></div>
 <header class="g-hud-top">
  <div class="g-where"><div class="g-kicker" id="g-depth-label">DIEPTE 0</div><div class="g-where-name" id="g-depth-name">De Ontvangsthal</div><div class="g-objective" id="g-objective"></div></div>
  <nav class="g-actions" aria-label="Spelbediening"><button id="invite" class="g-btn" data-act>Adviesraad <b id="g-members">0</b></button><button id="map" class="g-btn">Kaart <kbd>M</kbd></button><button id="dossier" class="g-btn">Dossier</button><button id="sound" class="g-btn g-compact" aria-pressed="false">Geluid uit</button><button id="full" class="g-btn g-compact" aria-label="Volledig scherm">⛶</button></nav>
 </header>
 <div class="g-pip" id="g-pip" aria-live="polite">${face}<div><b>Pip</b><p id="g-pip-text"></p></div></div>
 <div class="g-controls" id="g-controls"><span><kbd>Klik</kbd> rondkijken</span><span><kbd>WASD</kbd> lopen</span><span><kbd>Shift</kbd> rennen</span><span><kbd>Spatie</kbd> springen</span><span><kbd>E</kbd> gebruiken</span><span><kbd>M</kbd> kaart</span></div>
 <div class="g-titlecard" id="g-titlecard" aria-hidden="true"><small></small><h2></h2><p></p></div>
 <aside class="g-reader" id="g-reader" hidden aria-label="Bron"></aside>
 <aside class="g-panel" id="g-panel" hidden></aside>
 <section class="g-start" id="g-start"></section>
 <footer class="g-status" id="g-status"></footer>
 </div>`;
 try{
  world=createDungeon($('world'),{chambers:CHAMBERS,
   onInteract:handleInteract,
   onPrompt:text=>{$('g-prompt').innerHTML=text?`<kbd>E</kbd> ${esc(text)}`:''},
   onDepth:handleDepth,
   onRegion:id=>{if(session&&!session.completed)act('hub',()=>session.topic&&session.topic!==id&&!panel?{}:null)},
   onLock:on=>$('g-root').classList.toggle('is-locked',on),
   onStep:run=>sound.step(run)});
 }catch(e){console.error(e);world=null;$('g-root').classList.add('no-webgl')}
}
function say(text,ms=9000){const el=$('g-pip');if(!el)return;$('g-pip-text').textContent=text;el.classList.add('show');clearTimeout(pipTimer);pipTimer=setTimeout(()=>el.classList.remove('show'),ms)}
function titleCard(d){const el=$('g-titlecard'),info=DEPTHS[d];el.querySelector('small').textContent=info.label.toUpperCase();el.querySelector('h2').textContent=info.name;el.querySelector('p').textContent=info.line;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function handleDepth(d){
 if(!session||!started)return;
 if(d!==lastDepth){lastDepth=d;titleCard(d);sound.descend();const lines=['Hier begint het. Lees eerst de brief op de lessenaar.','Vrouwe Waarom wacht. Zij laat niemand verder zonder een goede vraag.','Vier fundamenten. Zonder eigenaar, mensen, kennis en data draagt niets.','Tien domeinen. Kies wat voor jullie toepassing telt, maar onthoud: wat je overslaat, weet je niet.','Hier wordt het besluit bezegeld. Kijk eerst naar wat jullie dossier draagt.'];say(lines[d])}
 if(!session.completed)act('move',()=>session.depth===d?null:session.topic?null:{depth:d}).then(()=>{if(session.depth!==d&&!session.topic)act('move',()=>session.depth===d?null:{depth:d})});
 renderHud();
}
async function handleInteract({kind,id,clue}){
 if(!session||session.completed&&kind!=='letter'){if(session?.completed)toast('De afdaling is afgerond. Download het dossier via de knop Dossier.');return}
 if(kind==='letter'){letterRead=true;saveStore(`gewelf-letter-${session.code}`,true);world?.setLetterRead(true);openPanel('letter');sound.chime();return}
 if(kind==='altar'){if(session.topic!=='verdict'&&!await act('enter',{target:'verdict'}))return;openPanel('verdict');sound.chime();return}
 if(session.topic!==id&&!await act('enter',{target:id}))return;
 if(kind==='npc'){openPanel('case');sound.chime();return}
 if(kind==='clue'){await showClue(clue);world?.setPaused(true)}
}
async function showClue(id){const d=chamber(session.topic);if(!d)return;if(!room(d.id).visited.includes(id)&&!await act('inspect',{clue:id}))return;activeClue=id;renderReader();sound.tone(660,.5,.04,'triangle')}
function panelInset(){world?.setInset(panel&&innerWidth>760?Math.min(520,innerWidth-36)+18:0)}
function openPanel(name){panel=name;world?.setPaused(true);$('g-pip')?.classList.remove('show');panelInset();render();const p=$('g-panel');p.scrollTop=0;p.querySelector('button,textarea,input')?.focus({preventScroll:true})}
function closePanel(){panel=null;activeClue=null;panelInset();$('g-panel').hidden=true;$('g-reader').hidden=true;world?.setPaused(false);world?.lock();if(session?.topic&&session.topic!=='verdict'&&!world)act('hub');renderHud()}
function closeReader(){activeClue=null;$('g-reader').hidden=true;if(!panel){world?.setPaused(false);world?.lock()}}

function nextObjective(){
 if(!session)return null;if(session.completed)return {text:'De afdaling is afgerond. Download het dossier en neem het mee.'};
 const d=world?world.depth:session.depth,v=room('verdict');
 if(!letterRead)return {target:{kind:'letter'},text:'Lees de brief van de wethouder op de lessenaar'};
 if(d===0)return {target:{kind:'down'},text:'Neem de trap omlaag naar Diepte 1'};
 if(d===1)return stateOf('necessity')==='blind'?{target:{kind:'npc',id:'necessity'},text:'Spreek Vrouwe Waarom in de Kamer van de Vraag'}:{target:{kind:'down'},text:'Daal af naar de Hal der Fundamenten'};
 if(d===2){const n=FOUNDATIONS.find(id=>stateOf(id)==='blind');return n?{target:{kind:'npc',id:n},text:`Bezoek ${chamber(n).npc} · ${chamber(n).title}`}:{target:{kind:'down'},text:'De fundamenten zijn besproken. Daal af naar de Galerij'}}
 if(d===3){const n=DOMAINS.find(id=>stateOf(id)==='blind');return n?{target:{kind:'npc',id:n},text:`Bezoek ${chamber(n).npc} · ${chamber(n).title} — of daal af naar de Zegelkamer`}:{target:{kind:'down'},text:'Alle domeinen besproken. Daal af naar de Zegelkamer'}}
 return v.attemptCount&&!v.opened?{text:'Leg de afspraken vast en rond de afdaling af'}:{target:{kind:'altar'},text:'Neem het besluit bij het zegel'};
}
function syncWorld(){
 if(!world||!session)return;
 const map=Object.fromEntries(session.dossier.chambers.map(c=>[c.id,c.state]));world.setStatus(map);
 for(const c of CHAMBERS)world.setVisited(c.id,room(c.id).visited);
 world.setLetterRead(letterRead);const v=room('verdict').result;world.setVerdict(v?v.selection[0]:-1);
}
function renderHud(){
 if(audience||!$('g-root'))return;
 const d=world?world.depth:(session?.depth||0),info=DEPTHS[d];
 $('g-depth-label').textContent=`${info.label.toUpperCase()} · ${discussed()} / 15 KAMERS BESPROKEN`;$('g-depth-name').textContent=info.name;
 const o=nextObjective();$('g-objective').innerHTML=o?`<span>◆</span> ${esc(o.text)}`:'';world?.setObjective(o?.target||null);
 $('g-members').textContent=session?.audienceCount||0;$('invite').dataset.locked=String(!session);
 renderStatus();
}
function renderStatus(){const el=$('g-status');if(!el)return;el.innerHTML=session?`<span>Sessie <b>${session.code}</b></span><span>${connected?'De raad adviseert · jij beslist':'Verbinding onderbroken · opnieuw verbinden…'}</span>`:''}
function render(){if(audience){renderAudience();return}$('g-root')?.classList.toggle('has-panel',!!panel);renderHud();renderStart();renderPanel();renderReader();setBusy()}
function renderStart(){
 const el=$('g-start');if(!el)return;el.hidden=started;$('g-root').classList.toggle('is-title',!started);if(started)return;
 const saved=session&&!session.completed;
 el.innerHTML=`<div class="g-start-inner">${brand}<div class="g-kicker">EEN AFDALING NAAR EEN VERANTWOORD BESLUIT</div><h1>Het Gewelf</h1><p class="g-lead">De wethouder wil weten of de gemeente AI gaat inzetten voor inwonersvragen. Onder het stadhuis bewaart het Gewelf vijftien kamers vol vragen die je eerst moet stellen. Onderaan wacht de Zegelkamer.</p>
 <ol class="g-steps"><li><b>Verken in 3D.</b> Loop door vier diepten, spreek de bewoners en lees de bronnen.</li><li><b>Kies samen.</b> Tot vijftien adviseurs denken mee via hun telefoon. Jij beslist.</li><li><b>Bezegel het besluit.</b> Niet doen, onderzoeken, een pilot of invoeren: jullie dossier laat zien wat het draagt.</li></ol>
 ${saved?`<button id="resume" class="g-primary" data-act>Ga verder · sessie ${session.code} <span>→</span></button><button id="begin" class="g-btn g-wide" data-act>Begin een nieuwe afdaling</button>`:`<button id="begin" class="g-primary" data-act>Begin de afdaling <span>→</span></button>`}
 <p class="g-help">Solo of met maximaal 15 adviseurs · reken op 45 tot 90 minuten · voortgang wordt na iedere actie bewaard</p><a class="g-link" href="/?audience">Ik doe mee via mijn telefoon →</a></div>`;
}
function sourceChips(d){const r=room(d.id);return `<div class="g-sources"><span class="g-sources-label">Bronnen in de kamer · optioneel</span>${d.clues.map((c,i)=>`<button class="g-chip ${r.visited.includes(c.id)?'is-read':''}" data-clue="${c.id}">${['📖','📜','🔮'][i]} ${esc(c.title)}${r.visited.includes(c.id)?' ✓':''}</button>`).join('')}</div>`}
function optionList(d,r,host){return `<fieldset class="g-options"><legend class="sr-only">Kies meerdere maatregelen</legend>${d.options.map((o,i)=>`<label class="g-option ${selected.includes(i)?'selected':''}" for="option-${i}"><input id="option-${i}" type="checkbox" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${letter(i)}</span><span>${esc(o.text)}${host?`<small class="g-count">${r.counts[i]} ${r.counts[i]===1?'advies':'adviezen'}<span class="g-meter"><i style="width:${r.ballots?r.counts[i]/r.ballots*100:0}%"></i></span></small>`:''}</span></label>`).join('')}</fieldset>`}
function feedback(d,r){const a=r.result;return `<div class="g-result ${a.complete?'is-strong':'is-open'}"><span class="g-seal-icon">${a.complete?'✦':'◇'}</span><div><h2>${a.complete?'Stevig in het dossier.':'Open punten in het dossier.'}</h2><p>${a.complete?'Jullie keuze bevat alle kernmaatregelen en geen ongeschikte aanpak.':`${a.missing.length?`${a.missing.length} kernmaatregel${a.missing.length===1?' ontbreekt':'en ontbreken'}. `:''}${a.unsuitable.length?`${a.unsuitable.length} gekozen aanpak${a.unsuitable.length===1?' past':'ken passen'} hier niet. `:''}Dit telt mee als open punt bij het besluit.`}</p></div></div>
 <div class="g-advice">Keuze: <b>${a.selection.map(letter).join(', ')}</b> · ${a.ballots} ${a.ballots===1?'advies':'adviezen'}<small>Raad: ${a.counts.map((n,i)=>`${letter(i)} ${n}`).join(' · ')}</small>${a.reason?`<p>“${esc(a.reason)}”</p>`:''}</div>
 ${d.options.map((o,i)=>{const chosen=a.selection.includes(i),label=o.status==='correct'?(chosen?'Passende kernmaatregel':'Gemiste kernmaatregel'):o.status==='supporting'?'Nuttige aanvulling':chosen?'Niet passend in deze casus':'Terecht niet gekozen';return `<details class="g-feedback ${o.status}" ${(chosen||a.missing.includes(i))?'open':''}><summary><span class="g-letter">${letter(i)}</span><span><b>${label}</b><small>${chosen?'Gekozen':'Niet gekozen'}</small></span></summary><p class="g-feedback-option">${esc(o.text)}</p><p>${esc(o.feedback)}</p></details>`}).join('')}`}
function dossierGroups(dossier,compact=false){
 const chip=c=>`<span class="g-dchip is-${c.state}" title="${STATE_LABEL[c.state]}">${esc(c.title)}</span>`;
 return ['strong','open','blind'].map(s=>{const list=dossier.chambers.filter(c=>c.state===s);return `<div class="g-dgroup is-${s}"><div class="g-dgroup-head"><b>${STATE_LABEL[s]}</b><span>${list.length}</span></div>${list.length?`<div class="g-dchips">${list.map(chip).join('')}</div>`:`<p class="g-help">${s==='strong'?'Nog niets stevig onderbouwd.':s==='open'?'Geen open punten.':'Geen blinde vlekken.'}</p>`}</div>`}).join('');
}
function renderPanel(){
 const p=$('g-panel');if(!p)return;p.hidden=!panel||!session;if(p.hidden)return;
 const close=`<button class="g-close" id="close-panel" aria-label="Paneel sluiten">×</button>`;
 if(panel==='letter'){p.innerHTML=`${close}<div class="g-kicker">GEMEENTE ${INTRO.municipality.toUpperCase()} · AAN HET TEAM DIENSTVERLENING</div><h2>De brief van de wethouder</h2><div class="g-letterpaper"><p>${esc(INTRO.letter)}</p></div><div class="g-callout">${face}<p><b>Pip:</b> ${esc(INTRO.pip)}</p></div><p class="g-help">Er is geen vaste route en geen score. Wat jullie overslaan, wordt een blinde vlek in het dossier. Jullie mogen ook concluderen dat AI hier niet de juiste oplossing is.</p><button class="g-primary" id="close-panel">Ik ga op weg <span>→</span></button>`;return}
 if(panel==='map'){p.innerHTML=`${close}<div class="g-kicker">KAART VAN HET GEWELF</div><h2>Waar willen jullie heen?</h2><p class="g-lead">Klik om er direct naartoe te reizen. Handig als de tijd dringt of als de 3D-weergave niet werkt.</p>${DEPTHS.map(dp=>`<div class="g-map-depth"><div class="g-map-head"><span>${dp.label}</span><b>${esc(dp.name)}</b></div>${dp.id===0?`<button class="g-map-room" data-go="letter"><span class="g-dot"></span>Ontvangsthal · brief van de wethouder</button>`:dp.id===4?`<button class="g-map-room" data-go="verdict"><span class="g-dot is-${room('verdict').attemptCount?'strong':'blind'}"></span>Het zegel · het besluit</button>`:CHAMBERS.filter(c=>(dp.id===1&&c.group==='necessity')||(dp.id===2&&c.group==='foundation')||(dp.id===3&&c.group==='domain')).map(c=>`<button class="g-map-room" data-go="${c.id}"><span class="g-dot is-${stateOf(c.id)}"></span>${esc(c.title)}<small>${esc(c.npc)}</small></button>`).join('')}</div>`).join('')}`;return}
 if(panel==='dossier'){const ds=session.dossier;p.innerHTML=`${close}<div class="g-kicker">BESLUITDOSSIER · SESSIE ${session.code}</div><h2>Wat weten we al?</h2><p class="g-lead">${discussed()} van de 15 kamers besproken. Stevig = alle kernmaatregelen gekozen en geen ongeschikte aanpak. Open = er ontbreekt iets of er is een ongeschikte aanpak gekozen.</p>${dossierGroups(ds)}${CHAMBERS.filter(c=>room(c.id).note).map(c=>`<div class="g-note-entry"><b>${esc(c.title)}</b><p>${esc(room(c.id).note)}</p></div>`).join('')}<button id="download" class="g-primary">Download het dossier ↓</button><p class="g-help">Het dossier legt een leergesprek vast. Het is geen toetsing of toestemming om AI in te zetten.</p>`;return}
 if(panel==='verdict'){renderVerdict(p,close);return}
 const d=chamber(session.topic);if(!d){p.hidden=true;return}const r=room(d.id);
 const top=`${close}<div class="g-kicker" style="--accent:${d.color}">${esc(groupLabel(d))}</div><h2>${esc(d.place)}</h2>`;
 if(r.opened){p.innerHTML=`${top}<div class="g-npc-line">${face}<p>${esc(d.hook)}</p></div><p class="g-lead">${esc(d.scenario)}</p><p class="g-question">${esc(d.question)}</p>${sourceChips(d)}<div class="g-vote-status"><span class="g-live"></span>${r.ballots} / ${session.audienceCount} adviezen ontvangen</div><p class="g-help">Selecteer alle kernmaatregelen. Nuttige aanvullingen mogen ook.</p>${optionList(d,r,true)}<label class="g-label" for="reason">Waarom deze keuze? <span>optioneel</span></label><textarea id="reason" rows="2" maxlength="800" placeholder="Bijvoorbeeld: in onze organisatie is…">${esc(draftReason[d.id]||'')}</textarea><button id="decide" class="g-primary" data-act data-locked="${!selected.length}">${selected.length?`Leg keuze ${selected.map(letter).join(' + ')} vast`:'Selecteer jullie maatregelen'} <span>→</span></button>`}
 else p.innerHTML=`${top}${feedback(d,r)}${sourceChips(d)}<label class="g-label" for="note">Mee naar ons project</label><p class="g-help">${esc(d.reflection)}</p><textarea id="note" rows="3" maxlength="1200" placeholder="Noteer een inzicht, actie of open vraag…">${esc(draftNotes[d.id]??r.note)}</textarea><button id="saveNote" class="g-btn g-wide" data-act>Bewaar projectnotitie</button><button id="close-panel" class="g-primary">Verder verkennen <span>→</span></button><button id="retry" class="g-btn g-wide" data-act>Bespreek deze kamer opnieuw</button><details class="g-details"><summary>Bron en verdieping</summary><p>Gebaseerd op ${esc(d.source)}.</p><a href="${FRAMEWORK_URL}" target="_blank" rel="noopener">Open het AI-raamwerk ↗</a></details>`;
}
function renderVerdict(p,close){
 const r=room('verdict'),a=r.result;
 if(r.opened||!a){const ds=session.dossier;p.innerHTML=`${close}<div class="g-kicker">DIEPTE 4 · DE ZEGELKAMER</div><h2>${esc(VERDICT.question)}</h2><p class="g-lead">Kijk eerst wat jullie dossier draagt. Blinde vlekken zijn dingen die jullie niet weten; open punten zijn dingen die nog niet op orde zijn. Pas daarna zie je wat het dossier zelf zegt.</p>${dossierGroups(ds)}<div class="g-vote-status"><span class="g-live"></span>${r.ballots} / ${session.audienceCount} adviezen ontvangen</div>
  <fieldset class="g-options g-verdicts"><legend class="sr-only">Kies één besluit</legend>${VERDICT.options.map((o,i)=>`<label class="g-option g-verdict-${o.key} ${selected.includes(i)?'selected':''}" for="verdict-${i}"><input id="verdict-${i}" type="radio" name="verdict" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${i+1}</span><span><b>${esc(o.title)}</b><br>${esc(o.text)}<small class="g-count">${r.counts[i]} ${r.counts[i]===1?'advies':'adviezen'}<span class="g-meter"><i style="width:${r.ballots?r.counts[i]/r.ballots*100:0}%"></i></span></small></span></label>`).join('')}</fieldset>
  <label class="g-label" for="reason">Onderbouwing van het besluit <span>aanbevolen</span></label><textarea id="reason" rows="3" maxlength="800" placeholder="Wat geeft de doorslag, en wat zeggen jullie tegen de wethouder?">${esc(draftReason.verdict||'')}</textarea><button id="decide" class="g-primary" data-act data-locked="${!selected.length}">${selected.length?`Bezegel: ${esc(VERDICT.options[selected[0]].title)}`:'Kies een besluit'} <span>→</span></button><p class="g-help">Het besluit is altijd van jullie. Het dossier geeft daarna aan wat het onderbouwt.</p>`;return}
 const o=VERDICT.options[a.selection[0]],c=draftCommit||session.commitments;
 p.innerHTML=`${close}<div class="g-kicker">HET BESLUIT IS BEZEGELD</div><div class="g-verdict-result is-${a.judgement}"><small>Jullie besluit</small><h2>${esc(o.title)}</h2><p>${esc(JUDGEMENTS[a.judgement])}</p></div>
 <div class="g-advice">Het dossier droeg maximaal: <b>${esc(VERDICT.options[a.ceiling].title)}</b><small>Raad: ${a.counts.map((n,i)=>`${VERDICT.options[i].title} ${n}`).join(' · ')}</small>${a.reason?`<p>“${esc(a.reason)}”</p>`:''}</div>
 <h3 class="g-h3">Wat het besluit begrenst</h3>${a.dossier.reasons.length?`<ul class="g-reasons">${a.dossier.reasons.map(x=>`<li class="lvl-${x.level}">${esc(x.text)}</li>`).join('')}</ul>`:'<p class="g-help">Het dossier vond geen beperkingen. Blijf monitoren na invoering.</p>'}
 <h3 class="g-h3">Afspraken voor de echte wereld</h3><p class="g-help">Welke besluit het ook is: wie doet wat, en wanneer kijken jullie terug?</p>
 <label class="g-label" for="c-owner">Eigenaar van het vervolg</label><input id="c-owner" data-commit="owner" maxlength="300" value="${esc(c.owner)}" placeholder="Naam of rol">
 <label class="g-label" for="c-first">Eerste concrete stap</label><input id="c-first" data-commit="firstStep" maxlength="300" value="${esc(c.firstStep)}" placeholder="Bijvoorbeeld: probleemanalyse met het KCC">
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
async function invite(){if(!session)return;showModal('<h2>Haal de adviesraad erbij</h2><p class="g-lead">De uitnodiging wordt klaargezet…</p>');try{const net=await api('network'),origin=net.local?net.origin:location.origin,url=`${origin}/?join=${session.code}`;const qr=await QRCode.toDataURL(url,{width:240,margin:2,color:{dark:'#1b140e',light:'#f3e6c4'}});if(!$('g-modal'))return;showModal(`<div class="g-kicker">SAMEN AFWEGEN · MAXIMAAL 15 ADVISEURS</div><h2>De raad is welkom.</h2><div class="g-invite"><img src="${qr}" alt="QR-code om deel te nemen aan sessie ${session.code}"><div><span class="g-help">Sessiecode</span><strong class="g-code">${session.code}</strong><p>Adviseurs lezen elke kamer op hun telefoon, ook de bronnen, en geven advies. Jij neemt het besluit.</p></div></div><label class="g-label" for="invite-url">Deelnamelink</label><input id="invite-url" readonly value="${esc(url)}"><button id="copy" class="g-primary">Kopieer de link <span>⧉</span></button><p class="g-help">${net.local?'Computer en telefoons moeten op hetzelfde netwerk zitten. Werkt de link niet, controleer wifi, VPN en firewall.':'Deelnemers hebben toegang tot deze site nodig.'}</p>`)}catch(e){closeModal();toast(e.message)}}
async function download(){if(!session)return;try{if(!audience)await persistNote();const res=await fetch(`/api/game/${session.code}/report`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});if(!res.ok)throw new Error('Download niet gelukt.');const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=`het-gewelf-besluitdossier-${session.code}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){toast(e.message)}}
async function persistNote(){const id=session?.topic;if(id&&draftNotes[id]!==undefined&&draftNotes[id]!==room(id).note)return act('note',{note:draftNotes[id]});return true}
function enterWorld(){
 started=true;lastDepth=-1;closeModal();
 if(world){world.setAttract(false);const target=session.topic&&session.topic!=='verdict'?session.topic:session.topic==='verdict'?'verdict':session.depth;world.goTo(target,true);world.lock()}
 else{handleDepth(session.depth)}
 syncWorld();render();if(!letterRead)say('Ik ben Pip. Zie je die lessenaar met de brief? Daar begint ons verhaal. Loop erheen en druk op E.',12000);
}
async function begin(){
 if(busy)return;busy=true;setBusy();
 try{const data=await api('create',{method:'POST',body:{},pass:''});token=data.token;saveStore('gewelf-host',{code:data.session.code,token});draftNotes={};draftReason={};draftCommit=null;letterRead=false;session=null;setSession(data.session);poll();sound.chime(true);enterWorld()}
 catch(e){toast(e.message)}finally{busy=false;setBusy()}
}

// ---------- audience (phones) ----------
function joinForm(error=''){app.innerHTML=`<div class="g-phone"><header>${brand}</header><main class="g-phone-card"><div class="g-kicker">JOUW TELEFOON, JOUW STEM</div><h1>Neem plaats<br>in de adviesraad.</h1><p class="g-lead">De speler daalt af in het Gewelf. Jij leest mee, denkt na en geeft advies. De speler maakt de uiteindelijke keuze.</p>${error?`<p role="alert" class="g-error">${esc(error)}</p>`:''}<form id="join-form"><label class="g-label" for="code">Sessiecode</label><input id="code" name="code" required maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" autocomplete="off" value="${esc(params.get('join')||'')}" placeholder="ABC234"><label class="g-label" for="name">Naam of bijnaam</label><input id="name" name="name" required maxlength="32" autocomplete="nickname" placeholder="Hoe mogen we je noemen?"><button class="g-primary" type="submit">Sluit aan <span>→</span></button></form><a class="g-link" href="/">Ik speel op het grote scherm</a></main></div>`}
function renderAudience(){
 if(!session)return;const open=[...document.querySelectorAll('.g-phone details')].map((el,i)=>el.open?i:-1),focusId=document.activeElement?.id;
 const d=chamber(session.topic),r=room(session.topic),dp=DEPTHS[session.depth];let body;
 if(session.completed){const v=room('verdict').result;body=`<div class="g-kicker">AFDALING AFGEROND</div><h1>Bedankt voor<br>het meedenken.</h1>${v?`<div class="g-verdict-result is-${v.judgement}"><small>Het besluit</small><h2>${esc(VERDICT.options[v.selection[0]].title)}</h2><p>${esc(JUDGEMENTS[v.judgement])}</p></div>`:''}<button id="download" class="g-primary">Download het besluitdossier ↓</button>`}
 else if(session.topic==='verdict'){
  if(r.opened)body=`<div class="g-kicker">DIEPTE 4 · DE ZEGELKAMER</div><h1>${esc(VERDICT.question)}</h1><p class="g-lead">Dit is het dossier tot nu toe. Wat zou jij adviseren?</p>${dossierGroups(session.dossier)}<fieldset class="g-options g-verdicts"><legend class="sr-only">Kies één besluit</legend>${VERDICT.options.map((o,i)=>`<label class="g-option ${selected.includes(i)?'selected':''}" for="verdict-${i}"><input id="verdict-${i}" type="radio" name="verdict" value="${i}" ${selected.includes(i)?'checked':''}><span class="g-letter">${i+1}</span><span><b>${esc(o.title)}</b><br>${esc(o.text)}</span></label>`).join('')}</fieldset>${voteButton(r)}`;
  else{const a=r.result;body=`<div class="g-kicker">HET BESLUIT IS BEZEGELD</div><div class="g-verdict-result is-${a.judgement}"><small>Besluit van de speler</small><h2>${esc(VERDICT.options[a.selection[0]].title)}</h2><p>${esc(JUDGEMENTS[a.judgement])}</p></div><h3 class="g-h3">Wat het besluit begrenst</h3><ul class="g-reasons">${a.dossier.reasons.map(x=>`<li class="lvl-${x.level}">${esc(x.text)}</li>`).join('')||'<li>Geen beperkingen gevonden.</li>'}</ul>`}
 }else if(d){
  body=`<div class="g-kicker">${esc(groupLabel(d))}</div><h1>${esc(d.place)}</h1><p class="g-lead">${esc(d.scenario)}</p>`+(r.result&&!r.opened?`${feedback(d,r)}<div class="g-callout"><p>${esc(d.reflection)}</p></div><p class="g-help">De speler kiest wanneer jullie verdergaan.</p>`:`<details class="g-details"><summary>Bronnen raadplegen (optioneel)</summary>${d.clues.map(c=>`<details class="g-details"><summary>${esc(c.title)}</summary>${sourceBody(d,c)}</details>`).join('')}</details><p class="g-question">${esc(d.question)}</p><p class="g-help">Selecteer alle kernmaatregelen. Nuttige aanvullingen mogen ook. Je kunt je advies wijzigen tot de speler kiest.</p>${optionList(d,r,false)}${voteButton(r)}`);
 }else body=`<div class="g-kicker">${esc(dp.label.toUpperCase())}</div><h1>${esc(dp.name)}</h1><p class="g-lead">${esc(dp.line)}</p><div class="g-waiting">${face}<span>Pip loopt voorop. Zodra de speler een bewoner aanspreekt, verschijnt de casus hier vanzelf.</span></div><p class="g-help">${discussed()} van 15 kamers besproken · ${session.audienceCount} adviseurs</p>${dossierGroups(session.dossier)}`;
 app.innerHTML=`<div class="g-phone"><header>${brand}<span class="g-phone-code">${session.code}</span></header><main class="g-phone-card"><div class="g-phone-meta"><span>Raadslid ${esc(session.name)}</span><span>${connected?'● Verbonden':'Opnieuw verbinden…'}</span></div>${body}</main><footer>Jouw stem is advies. De speler beslist.</footer></div>`;
 document.querySelectorAll('.g-phone details').forEach((el,i)=>{if(open.includes(i))el.open=true});if(focusId)$(focusId)?.focus({preventScroll:true});setBusy();
}
function voteButton(r){const changed=JSON.stringify([...selected].sort())!==JSON.stringify(r.ownVote||[]);return `<button id="vote" class="g-primary" data-act data-locked="${!selected.length&&!r.ownVote?.length}">${selected.length?(changed?'Verstuur mijn advies':'Advies verstuurd ✓'):r.ownVote?.length?'Trek mijn advies in':'Maak eerst een keuze'} <span>→</span></button><p class="g-vote-saved" role="status">${r.ownVote?.length?`Opgeslagen advies: ${r.ownVote.map(i=>session.topic==='verdict'?VERDICT.options[i].title:letter(i)).join(', ')}${changed?' · wijziging nog niet verstuurd':''}`:'Nog geen advies verstuurd'}</p>`}

// ---------- events ----------
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.clue){if(!audience)await showClue(b.dataset.clue);return}
 if(b.dataset.go){const go=b.dataset.go;panel=null;panelInset();$('g-panel').hidden=true;world?.setPaused(false);if(go==='letter'){if(world)world.goTo(0);else await handleInteract({kind:'letter'})}else if(world)world.goTo(go);else await handleInteract({kind:go==='verdict'?'altar':'npc',id:go});renderHud();return}
 switch(b.id){
  case 'begin':await begin();break;
  case 'resume':enterWorld();break;
  case 'close-panel':await persistNote();closePanel();break;
  case 'close-reader':closeReader();break;
  case 'close-modal':closeModal();if(!panel)world?.setPaused(false);break;
  case 'decide':{const id=session.topic;if(await act('decide',{selection:selected,reason:draftReason[id]||''})){const res=room(id).result;sound.chime(id==='verdict'||res?.complete);say(id==='verdict'?'Het zegel is gezet. Leg nu vast wie wat doet, en wanneer jullie terugkijken.':res.complete?'Stevig! Dit kan het dossier dragen. Schrijf op wat het betekent voor jullie eigen project.':'Er blijven open punten. Dat is niet erg, zolang jullie ze meenemen naar het besluit.');$('g-panel').scrollTop=0}break}
  case 'retry':await act('retry');break;
  case 'saveNote':if(await persistNote())toast('Projectnotitie bewaard.');break;
  case 'saveCommit':if(draftCommit&&await act('commit',{...draftCommit})){draftCommit=null;toast('Afspraken bewaard.')}break;
  case 'finish':showModal(`<div class="g-kicker">AFRONDEN</div><h2>Klaar met afdalen?</h2><p class="g-lead">Na afronden sluit de adviesraad. Het besluitdossier blijft beschikbaar om te downloaden.</p><button id="confirm-finish" class="g-primary" data-act>Rond de afdaling af <span>→</span></button><button id="close-modal" class="g-btn g-wide">Nog even verder</button>`);break;
  case 'confirm-finish':if(draftCommit)await act('commit',{...draftCommit});draftCommit=null;if(await act('finish')){closeModal();panel='verdict';sound.chime(true);render()}break;
  case 'vote':if(await act('vote',{selection:selected}))toast(selected.length?'Je advies is opgeslagen.':'Je advies is ingetrokken.');break;
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
 if(e.target.matches('.g-options input')){selected=[...document.querySelectorAll('.g-options input:checked')].map(el=>Number(el.value));const y=$('g-panel')?.scrollTop;render();if(y!=null&&$('g-panel'))$('g-panel').scrollTop=y}
});
document.addEventListener('input',e=>{const id=session?.topic;if(e.target.id==='reason'&&id)draftReason[id]=e.target.value;if(e.target.id==='note'&&id)draftNotes[id]=e.target.value;if(e.target.dataset.commit){draftCommit ||= {...session.commitments};draftCommit[e.target.dataset.commit]=e.target.value}});
document.addEventListener('keydown',e=>{
 if(audience)return;const m=$('g-modal');
 if(m){if(e.key==='Escape'){e.preventDefault();closeModal();if(!panel)world?.setPaused(false)}if(e.key==='Tab'){const nodes=[...m.querySelectorAll('button:not(:disabled),a[href],input,textarea')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}return}
 if(/INPUT|TEXTAREA/.test(document.activeElement?.tagName||''))return;
 if(e.key==='Escape'){if(activeClue){closeReader();return}if(panel){persistNote();closePanel()}}
 if((e.key==='m'||e.key==='M')&&started&&session){e.preventDefault();panel==='map'?closePanel():openPanel('map')}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='join-form')return;e.preventDefault();if(busy)return;busy=true;const form=new FormData(e.target),code=String(form.get('code')).trim().toUpperCase(),b=e.target.querySelector('button');b.disabled=true;
 try{const saved=getStore(`gewelf-audience-${code}`),data=await api(`${code}/join`,{method:'POST',body:{name:form.get('name'),token:saved?.token},pass:''});token=data.token;saveStore(`gewelf-audience-${code}`,{token});history.replaceState(null,'',`/?join=${code}`);setSession(data.session);poll()}
 catch(err){toast(err.message);b.disabled=false}finally{busy=false}
});
async function boot(){
 if(audience){joinForm();const code=(params.get('join')||'').toUpperCase(),saved=getStore(`gewelf-audience-${code}`);if(saved?.token&&/^[A-Z2-9]{6}$/.test(code)){token=saved.token;try{setSession((await api(code)).session);poll()}catch(e){token='';joinForm(e.message)}}return}
 hostShell();render();
 const saved=getStore('gewelf-host');
 if(saved?.token&&saved?.code){token=saved.token;try{letterRead=!!getStore(`gewelf-letter-${saved.code}`);setSession((await api(saved.code)).session);poll()}catch(e){token='';if(e.status!==404&&e.status!==410)toast(e.message)}}
 render();
}
if(params.has('debug'))window.__gewelf={get world(){return world},get session(){return session},act};
window.addEventListener('pagehide',e=>{if(!e.persisted){clearInterval(pollTimer);world?.dispose()}});
Promise.race([document.fonts?.load('700 40px Cinzel'),new Promise(r=>setTimeout(r,2500))]).catch(()=>{}).finally(boot);
