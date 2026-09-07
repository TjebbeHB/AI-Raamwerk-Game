import {createWorld} from './world.js';
import QRCode from 'qrcode';
import {ROOMS} from '../game/content.cjs';

const paths={golem:'M5 8h14v12H5z M8 4h8v4 M8 12h2v2H8z M14 12h2v2h-2z M10 17h4',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',book:'M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4z M13 6a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 3',arrow:'M5 12h14 M13 6l6 6-6 6',expand:'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M3 16v5h5',sound:'M11 5 6 9H3v6h3l5 4z M16 9a5 5 0 0 1 0 6 M19 6a9 9 0 0 1 0 12',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',close:'M6 6l12 12 M6 18 18 6',check:'M5 12l4 4L19 6'};
const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.golem}"/></svg>`;
const brand=()=>`<div class="brand"><div class="brandmark">${icon('golem')}</div><div><div class="brand-title">THE GOLEM BELOW</div><div class="brand-sub">AN AI-KADER ADVENTURE</div></div></div>`;
const app=document.querySelector('#app');
function hostShell(){
app.innerHTML=`<header class="topbar">${brand()}<div class="top-actions"><button class="quiet-button" id="invite">${icon('users')}<span class="button-label">Invite audience</span></button><button class="icon-button" id="journal-button" aria-label="Adventure journal">${icon('book')}</button><button class="icon-button" id="sound" aria-label="Turn sound on">${icon('sound')}</button><button class="icon-button" id="fullscreen" aria-label="Enter full screen">${icon('expand')}</button></div></header><main class="layout"><section class="world-column" aria-label="The dungeon"><canvas id="world" tabindex="0" aria-label="3D dungeon. Use WASD or arrow keys to walk, E to interact, or click a character."></canvas><div class="scene-heading"><div class="eyebrow" id="scene-eyebrow">CHAMBER I · THE TOWN HALL BELOW</div><h1 id="scene-title">The Queue of Unfinished Business</h1><p id="scene-subtitle">Some problems need a little less magic.</p></div><div class="room-counter" id="room-counter"><strong>01</strong> / 05</div><div class="interaction-hint" id="interaction-hint"></div><div class="scene-tools"><button class="small-tag" id="controls"><b>W A S D</b> &nbsp; move &nbsp; <b>E</b> &nbsp; interact</button><span class="small-tag">Or click to explore</span></div><div class="dialogue"><div class="pip-face">${icon('golem')}</div><div><div class="dialogue-name" id="dialogue-name">Pip · your almost-reliable companion</div><p class="dialogue-text" id="dialogue-text">“I was built to be helpful. I’m still working out what that means. Shall we find out together?”</p></div><div class="dialogue-key"><kbd>E</kbd></div></div></section><aside class="journal" id="journal"><div class="journal-top"><span class="eyebrow">YOUR ADVENTURE</span><span class="chapter-chip">5 CHAMBERS</span></div><h2>A little help.<br>A big responsibility.</h2><p class="journal-copy">Something is amiss beneath the town hall. A queue of ghosts, a very confident library, a gate with terrible manners…</p><p class="journal-copy" style="margin-top:13px">Explore with Pip, a little golem with a lot to learn. Restore the town’s services, one thoughtful decision at a time.</p><div class="welcome-note"><strong>You play. Your audience advises.</strong><br>Friends join on their phones and vote. Their advice is yours to follow—or question.</div><div class="journal-bottom"><button class="primary" id="begin">Begin adventure ${icon('arrow')}</button><p class="helper">1 player + a phone audience · about 25 minutes<br>You can also explore on your own.</p><button class="small-link" id="join-instead">Joining the audience?</button></div></aside></main><footer class="quest-path"><span class="path-label">THE DESCENT</span>${['The queue','The library','The gate','The pump','The heart'].map((r,i)=>`<div class="path-room ${i===0?'current':''}" data-path="${i}"><span class="path-number">0${i+1}</span><span>${r}</span></div>`).join('')}</footer>`;
}
let world;
function initWorld(){try{world=createWorld(document.querySelector('#world'),{onInteract:inspect,onExit:advance,onPrompt:text=>document.querySelector('#interaction-hint').textContent=text})}catch(error){document.querySelector('.world-column').insertAdjacentHTML('beforeend','<div class="webgl-error">The 3D view needs WebGL.<p>Try a recent browser with hardware acceleration enabled.</p></div>');console.error(error)}

}

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),isAudience=params.has('join')||params.has('audience');
let session=null,token='',busy=false,polling=false,pollTimer=null,selectedChoice=null,currentScene=0,connected=true,toastTimer,modalRestore=null,soundOn=false,audioCtx=null;
const drafts={};
function storageGet(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{toast('This browser cannot remember your pass after closing. Keep this page open.')}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500)}
function sound(kind='clue'){
 if(!soundOn)return;
 try{audioCtx ||= new AudioContext();audioCtx.resume();const now=audioCtx.currentTime;const notes=kind==='success'?[392,494,587,784]:kind==='choose'?[294,392]:[523,659];notes.forEach((hz,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=hz;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(0,now+i*.09);g.gain.linearRampToValueAtTime(.05,now+i*.09+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.09+.45);o.start(now+i*.09);o.stop(now+i*.09+.5)})}catch{soundOn=false}
}
async function api(path,{method='GET',body,pass=token}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const res=await fetch(`/api/game/${path}`,{method,headers:{'Content-Type':'application/json',...(pass?{Authorization:`Bearer ${pass}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const data=await res.json();if(!res.ok){const e=new Error(data.error||'The dungeon could not complete that action.');e.status=res.status;throw e}return data}
 catch(e){if(e.name==='AbortError')throw new Error('Connection took too long. Check your connection and try again.');throw e}
 finally{clearTimeout(timer)}
}
function setSession(next){
 if(session&&session.code===next.code&&next.revision<session.revision)return;
 const roomChanged=!session||next.room!==session.room;
 session=next;connected=true;
 if(roomChanged)selectedChoice=null;
 if(isAudience){renderAudience();return}
 if(currentScene!==session.room){currentScene=session.room;world?.setRoom(currentScene,session.rooms[currentScene]);say('Pip · your almost-reliable companion',ROOMS[currentScene].pip);sound('success')}
 else world?.setState(session.rooms[currentScene]);
 renderHost();
}
async function act(type,extra={}){
 if(busy||!session)return null;
 busy=true;renderBusy();
 try{const data=await api(`${session.code}/action`,{method:'POST',body:{type,room:session.room,...extra}});setSession(data.session);return data}
 catch(e){toast(e.message);return null}
 finally{busy=false;renderBusy()}
}
function renderBusy(){document.querySelectorAll('[data-mutation]').forEach(b=>b.disabled=busy||b.dataset.disabled==='true')}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{
 if(!session||busy||polling||document.hidden)return;polling=true;
 const requestedCode=session.code,requestedToken=token;
 try{const data=await api(requestedCode,{pass:requestedToken});if(session?.code!==requestedCode||token!==requestedToken)return;const changed=data.session.revision!==session.revision||!connected;if(changed)setSession(data.session)}
 catch(e){if(session?.code!==requestedCode||token!==requestedToken)return;if(connected){connected=false;if(isAudience)renderAudience();else toast('Connection lost. Your progress is saved; reconnecting…')}}finally{polling=false}
 },1800)}
function say(name,text){if($('dialogue-name'))$('dialogue-name').textContent=name;if($('dialogue-text'))$('dialogue-text').textContent=text}
function rememberFocus(){const el=document.activeElement;if(!el||!el.id||!['INPUT','TEXTAREA'].includes(el.tagName))return()=>{};const id=el.id,start=el.selectionStart,end=el.selectionEnd;return()=>{const next=$(id);if(next){next.focus({preventScroll:true});if(next.type!=='date')next.setSelectionRange(start,end)}}}
function renderHost(){
 if(!session)return;
 const restore=rememberFocus(),r=session.rooms[session.room],d=ROOMS[session.room];
 $('scene-eyebrow').textContent=`CHAMBER ${['I','II','III','IV','V'][session.room]} · ${d.location}`;
 $('scene-title').textContent=d.title;$('scene-subtitle').textContent=d.subtitle;$('room-counter').innerHTML=`<strong>0${session.room+1}</strong> / 05`;
 $('invite').innerHTML=`${icon('users')}<span class="button-label">Council</span><span>${session.audienceCount}</span>`;
 document.querySelectorAll('[data-path]').forEach(el=>{const i=Number(el.dataset.path);el.className=`path-room ${i===session.room?'current':''} ${session.rooms[i].repaired?'complete':''}`;el.querySelector('.path-number').innerHTML=session.rooms[i].repaired?'✓':`0${i+1}`});
 const top=`<div class="journal-top"><span class="eyebrow">YOUR QUEST</span><span class="chapter-chip">${esc(d.theme)}</span></div>`;
 if(session.completed){renderEnding();restore();return}
 if(!r.opened){
  $('journal').innerHTML=`${top}<h2>${esc(d.quest)}</h2><p class="journal-copy">${esc(d.description)}</p><div class="quest-divider"></div><div class="list-heading"><span>EXPLORE THE CHAMBER</span><span>${r.visited.length} / 3</span></div>${d.clues.map(c=>`<button class="objective ${r.visited.includes(c.id)?'done':''}" data-focus="${c.id}"><span class="objective-check">${r.visited.includes(c.id)?'✓':'·'}</span><span><span class="objective-title">${esc(c.title)}</span><small>${esc(c.hint)}</small></span></button>`).join('')}<div class="journal-bottom"><div class="audience-status">${icon('users')}${session.audienceCount?`${session.audienceCount} council member${session.audienceCount===1?'':'s'} waiting`:'Your council can join at any time'}</div><button class="primary" id="open-vote" data-mutation data-disabled="${r.visited.length<3}" ${r.visited.length<3?'disabled':''}>Ask the council ${icon('arrow')}</button><p class="helper">${r.visited.length<3?'Follow the golden markers. Discover all three clues.':'Hear their advice. The final decision is yours.'}</p></div>`;
 }else if(!r.decision){
  const total=r.counts.reduce((a,b)=>a+b,0),max=Math.max(...r.counts),leaders=max?r.counts.map((n,i)=>n===max?i:-1).filter(i=>i>=0):[];
  $('journal').innerHTML=`${top}<h2>${esc(d.question)}</h2><div class="audience-status"><span class="dot"></span>${total} / ${session.audienceCount} audience votes · live</div>${d.choices.map((c,i)=>`<button class="vote-option ${selectedChoice===i?'selected':''}" data-select="${i}"><div class="choice-label">${String.fromCharCode(65+i)}${leaders.includes(i)?leaders.length>1?' · TIED ADVICE':' · COUNCIL ADVICE':''}</div><strong>${esc(c.title)}</strong><span>${esc(c.detail)}</span><div class="vote-bar"><i style="width:${total?r.counts[i]/total*100:0}%"></i></div><div class="tally">${r.counts[i]} vote${r.counts[i]===1?'':'s'}</div></button>`).join('')}<label class="field-label" for="reason">Your reasoning (optional)</label><textarea class="text-input" id="reason" data-draft="reason-${session.room}" rows="2" maxlength="600" placeholder="Why this path?">${esc(drafts[`reason-${session.room}`]||'')}</textarea><div class="journal-bottom"><button class="primary" id="decide" data-mutation data-disabled="${selectedChoice===null}" ${selectedChoice===null?'disabled':''}>Make your decision ${icon('arrow')}</button><p class="helper">Choose any path. Council votes are advice.<br>${total===0?'You can decide even without an audience.':'Votes close when you make your decision.'}</p></div>`;
 }else{
  const choice=d.choices[r.decision.option];
  $('journal').innerHTML=`${top}<div class="outcome-title">${r.repaired?'✓ CHAMBER RESTORED':'THE CHOICE IS YOURS'}</div><h2>${esc(choice.title)}</h2><span class="badge">${esc(r.decision.relation)}</span><p class="journal-copy" style="margin-top:15px">${esc(choice.outcome)}</p>${r.repaired?`<div class="insight"><strong>BACK IN YOUR WORLD</strong>${esc(d.reflection)}</div><label class="field-label" for="reflection">A note for your project (optional)</label><textarea id="reflection" class="text-input reflection" data-draft="note-${session.room}" maxlength="1200" placeholder="What does this mean for our work?">${esc(drafts[`note-${session.room}`]??r.note)}</textarea><button class="small-link" id="save-note" data-mutation>Save note to journal</button><div class="journal-bottom"><button class="primary" id="next-room" data-mutation>${session.room===4?'Write the town charter':'Enter the next chamber'} ${icon('arrow')}</button><p class="helper">${session.room===4?'One last moment to bring this back to your project.':'Or walk through the glowing passage.'}</p></div>`:`<div class="quest-divider"></div><div class="list-heading"><span>ONE MORE LITTLE QUEST</span></div><p class="journal-copy">${esc(d.puzzle.title)}</p><div class="journal-bottom"><button class="primary" id="repair">Help the residents ${icon('arrow')}</button><p class="helper">Put what you learned into practice.</p></div>`}`;
 }
 restore();renderBusy();
}
function modal(title,content){
 closeModal();modalRestore=document.activeElement;
 const backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div>${content}</section>`;document.body.append(backdrop);backdrop.querySelector('button,input,textarea')?.focus({preventScroll:true});
}
function closeModal(){document.querySelector('.modal-backdrop')?.remove();modalRestore?.focus?.({preventScroll:true});modalRestore=null}
async function begin(){
 if(busy)return;busy=true;const b=$('begin');if(b){b.disabled=true;b.textContent='Opening the passage…'}
 try{const data=await api('create',{method:'POST',body:{},pass:''});token=data.token;storageSet('golem-host',{code:data.session.code,token});setSession(data.session);startPolling();say('Pip · your almost-reliable companion',ROOMS[0].pip);sound('success');toast('Your adventure is saved as you go. Invite your council whenever you’re ready.')}
 catch(e){toast(e.message);if(b){b.disabled=false;b.textContent='Begin adventure'}}finally{busy=false;renderBusy()}
}
async function inspect(id){
 if(isAudience)return;if(!session){toast('Begin your adventure to investigate the chamber.');return}
 const d=ROOMS[session.room],clue=d.clues.find(c=>c.id===id);if(!clue)return;
 if(!session.rooms[session.room].visited.includes(id)){const data=await act('inspect',{clue:id});if(!data)return;sound('clue')}
 say(clue.speaker,clue.text);
 modal(clue.speaker,`<p style="font-size:16px;color:var(--ink)">${esc(clue.text)}</p><div class="insight"><strong>WHAT YOU DISCOVERED</strong>${esc(clue.fact)}</div><button class="primary" data-close>Keep exploring ${icon('arrow')}</button>`);
}
async function invite(){
 if(!session){toast('Begin the adventure first, then invite your audience.');return}
 let origin=location.origin,local=false;
 try{const data=await api('network');local=data.local;if(['localhost','127.0.0.1'].includes(location.hostname))origin=data.origin}catch{}
 const url=`${origin}/?join=${session.code}`;
 modal('Gather your council',`<p>Your audience joins on their phones. They receive the story and vote on advice. Only you control the adventure.</p><div class="qr-wrap"><canvas id="join-qr" aria-label="QR code for the audience link"></canvas></div><div class="session-code">${session.code}</div><div class="join-url">${esc(url)}</div><button class="primary" id="copy-invite">Copy audience link</button><p>${local?'Phones must be on the same Wi-Fi as this computer. Keep this game open.':'Everyone needs access to this site before joining the council.'}</p><p class="helper">${session.audienceCount} / 15 audience members joined</p>`);
 try{await QRCode.toCanvas($('join-qr'),url,{width:150,margin:1,color:{dark:'#1c2928',light:'#f1eee3'}})}catch{toast('The join link works even if the QR code cannot be drawn.')}
 $('copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText(url);toast('Audience link copied.')}catch{modal('Your audience link',`<p>Copy this link and share it with the council.</p><input class="text-input" value="${esc(url)}" readonly id="copy-url">`);$('copy-url').select()}};
}
function showPuzzle(){
 if(!session)return;const d=ROOMS[session.room],r=session.rooms[session.room];if(!r.decision||r.repaired)return;
 modal(d.puzzle.title,`<p>${esc(d.puzzle.intro)}</p>${session.room===3?'<div class="pressure-display"><span>BAKERY WATER LEVEL</span><div class="pressure-track"><i></i></div><strong>RISING · SENSOR STUCK</strong></div>':''}<div id="puzzle-feedback" role="status"></div>${d.puzzle.options.map((o,i)=>`<button class="vote-option" data-repair="${i}" data-mutation><strong>${esc(o)}</strong></button>`).join('')}<p class="helper">You can try again. Helping is something you learn.</p>`);
}
async function repair(option){
 const originalModal=document.querySelector('.modal-backdrop'),d=ROOMS[session.room],data=await act('repair',{option});if(!data)return;
 if(!data.correct){const feedback=originalModal?.querySelector('#puzzle-feedback');if(feedback?.isConnected)feedback.innerHTML=`<div class="connection-error">${esc(d.puzzle.wrong)}</div>`;else toast(d.puzzle.wrong);sound('choose');return}
 if(originalModal?.isConnected)closeModal();sound('success');say('Pip & friends',d.puzzle.success);world?.celebrate?.(session.room);toast('Chamber restored. The passage is open.');
}
async function advance(){
 if(!session||busy||session.completed)return;
 const r=session.rooms[session.room];if(!r.repaired){if(r.decision)showPuzzle();else toast('Investigate the clues and make your decision first.');return}
 if(session.room===4){charterModal();return}
 const note=drafts[`note-${session.room}`];if(note!==undefined&&note!==r.note){if(!await act('note',{note}))return}
 closeModal();await act('next');
}
function charterModal(){
 const c=session.charter;
 modal('Your town charter',`<p>Bring one lesson back to a real project. These fields are optional; unfinished commitments remain visible in your journal.</p><form id="charter-form"><label class="field-label" for="charter-project">Project or next experiment</label><input class="text-input" id="charter-project" name="project" maxlength="300" placeholder="What could we test next?" value="${esc(c.project)}"><label class="field-label" for="charter-owner">Who will own the next step?</label><input class="text-input" id="charter-owner" name="owner" maxlength="300" placeholder="A person or team" value="${esc(c.owner)}"><label class="field-label" for="charter-date">When will you review it?</label><input class="text-input" id="charter-date" name="reviewDate" type="date" value="${esc(c.reviewDate)}"><label class="field-label" for="charter-measure">What would improvement look like?</label><input class="text-input" id="charter-measure" name="measure" maxlength="300" placeholder="A measure that matters to residents" value="${esc(c.measure)}"><label class="field-label" for="charter-stop">What would make you pause or change course?</label><input class="text-input" id="charter-stop" name="stopCondition" maxlength="300" placeholder="An error, harm, or missing evidence" value="${esc(c.stopCondition)}"><button class="primary" type="submit" data-mutation>${session.completed?'Save charter':'Complete the adventure'} ${icon('check')}</button></form>`);
}
function renderEnding(){
 const followed=session.rooms.filter(r=>r.decision?.relation==='Followed the council').length;
 $('journal').innerHTML=`<div class="journal-top"><span class="eyebrow">ADVENTURE COMPLETE</span><span class="chapter-chip">TOWN RESTORED</span></div><h2>A better town.<br>A wiser little golem.</h2><p class="journal-copy">Five chambers, five choices, and a few well-earned buns. You helped Pip learn when to act, when to ask, and when a simpler solution is enough.</p><div class="end-stats"><div class="end-stat"><strong>5</strong>chambers restored</div><div class="end-stat"><strong>${session.audienceCount}</strong>council voices</div></div><div class="insight"><strong>THE COUNCIL & YOU</strong>${session.audienceCount?`You followed a clear audience recommendation ${followed} time${followed===1?'':'s'}. Your journal keeps the votes and your reasoning.`:'You explored on your own. Next time, invite a council to see where you agree.'}</div><p class="journal-copy">Your charter holds the benefits, open concerns and next steps. The real adventure starts back at work.</p><div class="journal-bottom"><button class="primary" id="download">Download town charter ${icon('book')}</button><button class="secondary" id="edit-charter" style="margin-top:10px">Review your commitments</button><button class="small-link" id="new-adventure">Start a new adventure</button></div>`;
 say('Pip · still learning, still helpful','“I thought being helpful meant doing everything. It turns out it also means knowing when to ask. Would you like a bun?”');
}
function showJournal(){
 if(!session){showControls();return}
 modal('The adventure journal',`<p>A record of your choices, council advice and lessons. This is a discussion record, not a legal assessment.</p>${ROOMS.map((d,i)=>{const r=session.rooms[i];return `<article class="book-entry"><h3>0${i+1} · ${esc(d.title)}</h3>${r.decision?`<span class="badge">${esc(r.decision.relation)}</span><p><strong>${esc(d.choices[r.decision.option].title)}</strong></p><p>${esc(d.choices[r.decision.option].concern)}</p>${r.note?`<p>Project note: ${esc(r.note)}</p>`:''}`:'<p>Not yet decided.</p>'}<a href="${d.source}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Explore the learning theme ↗</a></article>`}).join('')}<button class="primary" id="download">Download your journal ${icon('arrow')}</button>`);
}
async function download(){
 try{const res=await fetch(`/api/game/${session.code}/report`,{headers:{Authorization:`Bearer ${token}`}});if(!res.ok)throw new Error('Your journal could not be downloaded. Try again.');const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`the-golem-below-${session.code}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Town charter downloaded.')}catch(e){toast(e.message)}
}
function showControls(){modal('A small guide to the below',`<div class="controls-grid"><p><kbd>W A S D</kbd><br>Walk around</p><p><kbd>↑ ↓ ← →</kbd><br>Also walk around</p><p><kbd>E</kbd><br>Talk or investigate</p><p>Click a character<br>Walk over and interact</p></div><p>Follow the golden markers and investigate three clues in each chamber. You can also select clues in your quest panel to walk to them.</p><p>Ask your phone audience for advice, choose your own path, then help the residents with one final task. Every considered choice leads onward.</p><p>Five chambers · about 25 minutes · 1 player and up to 15 audience members. Sound is optional.</p>`)}

function audienceJoinForm(error=''){
 const code=(params.get('join')||'').toUpperCase();
 app.innerHTML=`<main class="audience-shell">${brand()}<div class="eyebrow">A SEAT ON THE COUNCIL</div><h1>A little advice.<br>A different adventure.</h1><p>One player explores the dungeon. You help them decide. Your phone has all the story you need—no view of the big screen required.</p><div class="audience-card"><h2>Join the council</h2>${error?`<p class="connection-error">${esc(error)}</p>`:''}<form id="join-form"><label class="field-label" for="audience-name">Your name</label><input class="text-input" id="audience-name" name="name" maxlength="32" autocomplete="given-name" placeholder="What should we call you?" required><label class="field-label" for="audience-code">Session code</label><input class="text-input" id="audience-code" name="code" maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. PIPBUN" value="${esc(code)}" required><button class="primary" type="submit">Join the adventure ${icon('arrow')}</button></form></div><p class="helper">Your votes are advice. The player chooses whether to follow.<br><a href="/">Playing on the big screen?</a></p></main>`;
}
function renderAudience(){
 const cluesOpen=!!document.querySelector('.audience-card details[open]');
 const r=session.rooms[session.room],d=ROOMS[session.room],total=r.counts.reduce((a,b)=>a+b,0);
 app.innerHTML=`<main class="audience-shell">${brand()}<div class="audience-connection"><span class="pill"><span class="dot"></span>Council · ${esc(session.code)}</span><span class="muted" style="font-size:13px">${esc(session.name)}</span></div>${!connected?'<div class="connection-error">Connection lost. Your vote is saved. Reconnecting…</div>':''}<div class="eyebrow">${session.completed?'THE TOWN IS RESTORED':`CHAMBER ${session.room+1} OF 5`}</div><h1>${session.completed?'A little wiser. A lot of buns.':esc(d.title)}</h1><p>${session.completed?'The player has finished the adventure. Your advice helped shape the journey. Talk together about what you would bring back to a real project.':esc(d.briefing)}</p><section class="audience-card">${session.completed?`<h2>Thank you, council.</h2><p>${esc(ROOMS[4].puzzle.success)}</p><button class="primary" id="download">Download the town charter ${icon('book')}</button>`:!r.opened?`<span class="pill"><span class="dot"></span>The player is exploring</span><p>You’ll be able to vote when the player has gathered the clues. You can read their discoveries here as they happen.</p><div class="list-heading" style="margin-top:23px"><span>DISCOVERED SO FAR</span><span>${r.visited.length} / 3</span></div>${d.clues.filter(c=>r.visited.includes(c.id)).map(c=>`<div class="audience-clue">${esc(c.fact)}</div>`).join('')||'<p>The first clue is still waiting to be found.</p>'}`:!r.decision?`<h2>${esc(d.question)}</h2><p>Choose the advice you want to give. You can change your vote until the player decides.</p><details><summary style="font-size:14px;color:var(--gold);cursor:pointer">Review the three clues</summary>${d.clues.map(c=>`<div class="audience-clue">${esc(c.fact)}</div>`).join('')}</details>${d.choices.map((c,i)=>`<button class="vote-option ${r.ownVote===i?'selected':''}" data-vote="${i}" data-mutation aria-pressed="${r.ownVote===i}"><div class="choice-label">${r.ownVote===i?'✓ YOUR VOTE':String.fromCharCode(65+i)}</div><strong>${esc(c.title)}</strong><span>${esc(c.detail)}</span></button>`).join('')}<p class="helper" role="status">${r.ownVote!==null?'Your vote is saved. The player can follow it or choose another path.':'Your vote stays advisory. Only the player makes the final decision.'}</p>`:`<span class="badge">THE PLAYER HAS DECIDED</span><h2 style="margin-top:15px">${esc(d.choices[r.decision.option].title)}</h2><p>${esc(d.choices[r.decision.option].outcome)}</p><div class="insight"><strong>${esc(r.decision.relation)}</strong>${total} votes were cast.${r.ownVote!==null?` Your advice: ${esc(d.choices[r.ownVote].title)}.`:''}</div>${r.decision.reason?`<p>Player’s reasoning: ${esc(r.decision.reason)}</p>`:''}<p>${r.repaired?'The passage is open. The player will continue shortly.':'The player is helping the residents with one final task.'}</p><div class="insight"><strong>THINK ABOUT YOUR OWN PROJECT</strong>${esc(d.reflection)}</div>`}</section><p class="helper">${session.audienceCount} council member${session.audienceCount===1?'':'s'} · ${session.completed?'Adventure complete':'Updates automatically'}</p></main>`;
 if(cluesOpen)document.querySelector('.audience-card details')?.setAttribute('open','');
 renderBusy();
}

document.addEventListener('input',e=>{if(e.target.dataset.draft)drafts[e.target.dataset.draft]=e.target.value});
document.addEventListener('keydown',e=>{
 const m=document.querySelector('.modal-backdrop');if(!m)return;
 if(e.key==='Escape'){e.preventDefault();closeModal()}
 if(e.key==='Tab'){const list=[...m.querySelectorAll('button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]')];if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close')){closeModal();return}
 if(b.dataset.focus){if(world)world.focus(b.dataset.focus);else inspect(b.dataset.focus);return}
 if(b.dataset.select!==undefined){selectedChoice=Number(b.dataset.select);renderHost();return}
 if(b.dataset.repair!==undefined){await repair(Number(b.dataset.repair));return}
 if(b.dataset.vote!==undefined){const data=await act('vote',{option:Number(b.dataset.vote)});if(data){sound('clue');toast('Your advice is saved.')}return}
 switch(b.id){
  case'begin':await begin();break;
  case'invite':await invite();break;
  case'controls':showControls();break;
  case'journal-button':showJournal();break;
  case'sound':soundOn=!soundOn;b.classList.toggle('sound-on',soundOn);b.setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');b.setAttribute('aria-pressed',String(soundOn));sound();toast(soundOn?'Gentle game sounds on.':'Game sounds off.');break;
  case'fullscreen':try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Full screen is unavailable here. Open the game in your browser for full screen.')}break;
  case'open-vote':if(await act('openVote')){say('Pip · listening to the council','“Many voices. One decision. I’m very glad you’re the one holding the map.”');sound('choose')}break;
  case'decide':if(selectedChoice!==null){const data=await act('decide',{option:selectedChoice,reason:drafts[`reason-${session.room}`]||''});if(data){const r=session.rooms[session.room];say('Pip · learning by doing',ROOMS[session.room].choices[r.decision.option].pip);world?.showOutcome?.(session.room,r.decision.option);sound('choose')}}break;
  case'repair':showPuzzle();break;
  case'next-room':await advance();break;
  case'save-note':if(await act('note',{note:drafts[`note-${session.room}`]??session.rooms[session.room].note}))toast('Project note saved to your journal.');break;
  case'edit-charter':charterModal();break;
  case'download':await download();break;
  case'join-instead':location.href='/?audience';break;
  case'new-adventure':closeModal();clearInterval(pollTimer);session=null;selectedChoice=null;currentScene=0;Object.keys(drafts).forEach(k=>delete drafts[k]);world?.dispose();hostShell();initWorld();await begin();break;
 }
});
document.addEventListener('submit',async e=>{
 if(e.target.id==='join-form'){
  e.preventDefault();if(busy)return;busy=true;const form=new FormData(e.target),code=String(form.get('code')).trim().toUpperCase(),button=e.target.querySelector('button');button.disabled=true;button.textContent='Finding your council…';
  try{const saved=storageGet(`golem-audience-${code}`);const data=await api(`${code}/join`,{method:'POST',body:{name:form.get('name'),token:saved?.token},pass:''});token=data.token;storageSet(`golem-audience-${code}`,{token});history.replaceState(null,'',`/?join=${code}`);setSession(data.session);startPolling()}
  catch(error){toast(error.message);button.disabled=false;button.textContent='Join the adventure'}finally{busy=false;renderBusy()}
 }
 if(e.target.id==='charter-form'){
  e.preventDefault();const values=Object.fromEntries(new FormData(e.target));if(!await act('charter',values))return;
  const note=drafts[`note-${session.room}`];if(note!==undefined&&note!==session.rooms[session.room].note){if(!await act('note',{note}))return}
  if(!session.completed){if(!await act('next'))return;sound('success')}
  closeModal();renderHost();
 }
});
async function boot(){
 if(isAudience){audienceJoinForm();const code=(params.get('join')||'').toUpperCase(),saved=storageGet(`golem-audience-${code}`);if(saved?.token&&/^[A-Z2-9]{6}$/.test(code)){token=saved.token;try{const data=await api(code);setSession(data.session);startPolling()}catch(e){token='';audienceJoinForm(e.message)}}return}
 hostShell();initWorld();const saved=storageGet('golem-host');if(saved?.code&&saved?.token){token=saved.token;const b=$('begin');b.disabled=true;b.textContent='Returning to your adventure…';try{const data=await api(saved.code);setSession(data.session);startPolling();if(data.session.room===0)say('Pip · your almost-reliable companion',ROOMS[0].pip)}catch(e){token='';b.disabled=false;b.textContent='Begin adventure';toast(e.status===404?'Your previous session is unavailable. You can start a new adventure.':e.message)}}
}
window.addEventListener('pagehide',e=>{if(!e.persisted){clearInterval(pollTimer);world?.dispose()}});
boot();
