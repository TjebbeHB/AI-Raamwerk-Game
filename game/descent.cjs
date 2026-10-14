// Session rules for "Het Gewelf": one player descends, the council advises, the dossier informs the verdict.
const {content,storyOf,levelOf,epilogue,LEVELS,CHAMBER_IDS,ARENA_LEVEL,DEFAULT_STORY,STORIES}=require('./stories.cjs');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const emptyRoom=()=>({visited:[],opened:false,votes:{},attempts:[],note:'',trial:null});
const CHEER_GAP=4000;

function initial({story,peaceful}={}){
 return {mode:'descent',story:storyOf(story).id,peaceful:!!peaceful,level:0,topic:null,epoch:0,shortcut:false,
  topics:Object.fromEntries([...CHAMBER_IDS.map(id=>[id,emptyRoom()]),['verdict',emptyRoom()]]),
  arenas:{a1:null,a2:null,a3:null},cheers:{n:0,last:null},commitments:{owner:'',firstStep:'',reviewDate:'',stopCondition:''}};
}
// Sessions saved by 3.0 had one story, five depths and no trials or arenas.
function normalize(s){
 s.story ??= DEFAULT_STORY;
 if(s.level===undefined){s.level=[0,1,3,5,7][s.depth]??0;delete s.depth}
 s.peaceful ??= false;s.shortcut ??= false;s.arenas ??= {a1:null,a2:null,a3:null};s.cheers ??= {n:0,last:null};
 for(const r of Object.values(s.topics))r.trial ??= null;
 return s;
}

// The dossier: what is solid, what is open and what was never looked at. No score, only a ceiling the evidence can carry.
function assess(topics,storyId=DEFAULT_STORY,shortcut=false){
 const c=content(storyId);
 const state=id=>{const last=topics[id]?.attempts?.at(-1);return !last?'blind':last.complete?'strong':'open'};
 const title=id=>c.chambers.find(x=>x.id===id).title;
 const chambers=c.chambers.map(x=>({id:x.id,title:x.title,group:x.group,state:state(x.id)}));
 let ceiling=3;const reasons=[];
 const limit=(level,text)=>{ceiling=Math.min(ceiling,level);reasons.push({level,text})};
 const need=state('necessity');
 if(need==='blind')limit(1,'De noodzaak is niet onderzocht. Zonder probleemanalyse en alternatief zonder AI is niet te zeggen of AI iets oplost.');
 else if(need==='open')limit(1,'De noodzaak staat nog niet stevig: niet alle kernvragen over probleem, alternatieven of succescriteria zijn beantwoord.');
 if(state('governance')!=='strong')limit(1,'Eigenaarschap is niet geregeld. Zonder aanspreekbare eigenaar kan zelfs een pilot niet verantwoord draaien.');
 for(const id of ['culture','capacity','infrastructure'])if(state(id)!=='strong')limit(2,`Fundament ‘${title(id)}’ is ${state(id)==='blind'?'niet onderzocht':'nog niet op orde'}. In een pilot kun je dat leren; in productie niet.`);
 if(state('evaluation')==='blind')limit(1,'Er is geen evaluatieplan besproken. Een pilot die niets meet, levert geen bewijs op voor een volgend besluit.');
 for(const id of c.verdict.critical)if(state(id)!=='strong')limit(2,`Kritisch domein ‘${title(id)}’ is ${state(id)==='blind'?'een blinde vlek':'nog open'}. Voor deze toepassing vraagt productie hier zekerheid.`);
 const solid=chambers.filter(x=>x.group==='domain'&&x.state==='strong').length;
 if(solid<6)limit(2,`${solid} van de 10 domeinen staan stevig. Voor productie is een breder beeld nodig (minstens zes).`);
 reasons.sort((x,y)=>x.level-y.level);
 return {ceiling,reasons,chambers,critical:[...c.verdict.critical],shortcut:!!shortcut,strong:chambers.filter(x=>x.state==='strong').map(x=>x.id),open:chambers.filter(x=>x.state==='open').map(x=>x.id),blind:chambers.filter(x=>x.state==='blind').map(x=>x.id)};
}
function judge(choice,ceiling){
 if(choice===0)return ceiling<=1?'grounded':'cautious-stop';
 return choice===ceiling?'supported':choice<ceiling?'cautious':'beyond';
}

const optionsOf=(s,id)=>{const c=content(s.story);return id==='verdict'?c.verdict.options:c.chambers.find(x=>x.id===id).options};
function tally(s,room,id){const options=optionsOf(s,id),ballots=Object.values(room.votes).filter(v=>v.length);return {counts:options.map((_,i)=>ballots.filter(v=>v.includes(i)).length),ballots:ballots.length}}
function view(s,viewer){
 normalize(s);
 const topics=Object.fromEntries(Object.keys(s.topics).map(id=>{const r=s.topics[id],last=r.attempts.at(-1);return [id,{visited:[...r.visited],opened:r.opened,attemptCount:r.attempts.length,result:last?structuredClone(last):null,note:r.note,trial:r.trial?{...r.trial}:null,...(r.opened||!last?tally(s,r,id):{counts:[...last.counts],ballots:last.ballots}),ownVote:viewer.member?[...(r.votes[viewer.member.token]||[])]:null}]}));
 return {mode:s.mode,code:s.code,story:s.story,peaceful:s.peaceful,createdAt:s.createdAt,revision:s.revision,level:s.level,topic:s.topic,epoch:s.epoch,completed:s.completed,shortcut:s.shortcut,
  role:viewer.role,name:viewer.member?.name||'Ambtenaar',audienceCount:s.audience.length,topics,arenas:structuredClone(s.arenas),cheers:{n:s.cheers.n,last:s.cheers.last?{...s.cheers.last}:null},
  commitments:{...s.commitments},dossier:assess(s.topics,s.story,s.shortcut)};
}
function select(s,value,id,allowEmpty=false){
 const n=optionsOf(s,id).length;
 if(!Array.isArray(value)||value.length>n||value.some(i=>!Number.isInteger(i)||i<0||i>=n)||new Set(value).size!==value.length)fail('Selecteer geldige, verschillende antwoorden.');
 if(id==='verdict'&&value.length>1)fail('Kies één besluit.');
 if(!allowEmpty&&!value.length)fail('Selecteer ten minste één antwoord.');
 return [...value].sort((a,b)=>a-b);
}
const TYPES=['move','enter','hub','inspect','vote','decide','retry','note','commit','finish','trial','arena','shortcut','cheer'];
const AUDIENCE=['vote','cheer'];
function action(s,viewer,body){
 normalize(s);
 const {type}=body;
 if(!TYPES.includes(type))fail('Onbekende actie.');
 if(AUDIENCE.includes(type)?viewer.role!=='audience':viewer.role!=='host')fail(AUDIENCE.includes(type)?'Alleen de adviesraad stemt en moedigt aan.':'Alleen de speler bepaalt de route en het besluit.',403);
 if(s.completed&&type!=='commit')fail('Deze afdaling is afgerond.',409);
 if(type==='cheer'){
  // Cheers are not tied to a room: advisers can support the player during any fight.
  const now=Date.now();if(viewer.member.lastCheer&&now-viewer.member.lastCheer<CHEER_GAP)fail('Even wachten: je steun is net verstuurd.',429);
  viewer.member.lastCheer=now;s.cheers={n:s.cheers.n+1,last:{name:viewer.member.name,at:new Date(now).toISOString()}};
  s.revision++;return {};
 }
 // A visit nonce rejects late actions after leaving and returning to the same chamber.
 if(body.topic!==s.topic||body.epoch!==s.epoch)fail('De speler is verdergegaan. De pagina wordt bijgewerkt; probeer opnieuw.',409);
 const room=s.topic?s.topics[s.topic]:null;
 if(type==='move'){
  if(!Number.isInteger(body.level)||body.level<0||body.level>=LEVELS.length)fail('Deze plek bestaat niet.');
  if(room)fail('Verlaat eerst de kamer.',409);
  s.level=body.level;
 }else if(type==='enter'){
  if(!s.topics[body.target])fail('Deze kamer bestaat niet.');
  if(room)room.opened=false;
  s.topic=body.target;s.level=levelOf(body.target);s.epoch++;
  const entered=s.topics[s.topic];
  if(!entered.attempts.length){entered.opened=true;entered.votes={}}
 }else if(type==='hub'){
  if(room)room.opened=false;
  s.topic=null;s.epoch++;
 }else if(type==='shortcut'){
  if(room)room.opened=false;
  s.topic=null;s.level=levelOf('verdict');s.shortcut=true;s.epoch++;
 }else if(type==='arena'){
  if(!ARENA_LEVEL[body.id])fail('Deze tussenkamer bestaat niet.');
  if(!['cleared','skipped'].includes(body.outcome))fail('Onbekende afloop.');
  if(room)fail('Verlaat eerst de kamer.',409);
  const story=storyOf(s.story),known=new Set([...Object.keys(story.mobs),'boss']);
  const lessons=Array.isArray(body.lessons)?[...new Set(body.lessons.filter(k=>typeof k==='string'&&known.has(k)))]:[];
  const prev=s.arenas[body.id];
  s.arenas[body.id]=prev?.outcome==='cleared'&&body.outcome==='skipped'?prev:{outcome:body.outcome,at:new Date().toISOString(),lessons:[...new Set([...(prev?.lessons||[]),...lessons])]};
 }else if(type==='finish'){
  if(!s.topics.verdict.attempts.length)fail('Bezegel eerst een besluit in de Zegelkamer.',409);
  if(room)room.opened=false;
  s.topic=null;s.epoch++;s.completed=true;
 }else if(type==='commit'){
  if(!s.topics.verdict.attempts.length)fail('Bezegel eerst een besluit.',409);
  for(const key of Object.keys(s.commitments))if(body[key]!==undefined)s.commitments[key]=clean(body[key],key==='reviewDate'?10:300);
  if(s.commitments.reviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(s.commitments.reviewDate))fail('Gebruik een geldige datum.');
 }else{
  if(!room)fail('Ga eerst een kamer binnen.',409);
  const def=content(s.story).chambers.find(c=>c.id===s.topic);
  if(type==='inspect'){
   if(!def?.clues.some(c=>c.id===body.clue))fail('Deze bron hoort niet bij de kamer.');
   if(!room.visited.includes(body.clue))room.visited.push(body.clue);
  }
  if(type==='trial'){
   if(!def)fail('Hier is geen proef.');
   if(!['done','skipped'].includes(body.outcome))fail('Onbekende afloop van de proef.');
   if(room.trial?.outcome!=='done'||body.outcome==='done')room.trial={outcome:body.outcome,at:new Date().toISOString()};
  }
  if(type==='retry'){
   if(!room.attempts.length)fail('Er is nog geen eerdere bespreking.',409);
   room.votes={};room.opened=true;s.epoch++;
  }
  if(type==='vote'){
   if(!room.opened)fail('De adviesronde is gesloten.',409);
   room.votes[viewer.member.token]=select(s,body.selection,s.topic,true);
  }
  if(type==='decide'){
   if(!room.opened)fail('Open eerst een nieuwe ronde.',409);
   const selection=select(s,body.selection,s.topic),{counts,ballots}=tally(s,room,s.topic),reason=clean(body.reason,800),at=new Date().toISOString();
   if(s.topic==='verdict'){
    const dossier=assess(s.topics,s.story,s.shortcut),judgement=judge(selection[0],dossier.ceiling);
    room.attempts.push({selection,counts,ballots,reason,at,ceiling:dossier.ceiling,judgement,dossier,epilogue:epilogue(s.story,selection[0],judgement)});
   }else{
    const missing=def.options.flatMap((o,i)=>o.status==='correct'&&!selection.includes(i)?[i]:[]);
    const unsuitable=selection.filter(i=>def.options[i].status==='incorrect');
    room.attempts.push({selection,counts,ballots,missing,unsuitable,complete:!missing.length&&!unsuitable.length,reason,at});
   }
   room.opened=false;s.epoch++;
  }
  if(type==='note')room.note=clean(body.note);
 }
 s.revision++;return {};
}

const JUDGEMENTS={
 grounded:'Het dossier ondersteunt dit besluit: de noodzaak of de basis is niet aangetoond.',
 'cautious-stop':'Een legitiem besluit. Het dossier liet ruimte voor meer; leg vast waarom jullie stoppen.',
 supported:'Het dossier draagt dit besluit.',
 cautious:'Voorzichtiger dan het dossier toelaat. Verdedigbaar, zolang jullie benoemen wat er nog nodig is om verder te gaan.',
 beyond:'Dit besluit gaat verder dan het dossier kan dragen.'
};
function report(s){
 normalize(s);
 const c=content(s.story),st=c.story,letter=i=>String.fromCharCode(65+i),v=s.topics.verdict.attempts.at(-1);
 const lines=[`# Het Gewelf — Besluitdossier`,'',`Verhaal: ${st.title} · ${st.org} — ${st.subtitle}`,`Sessie: ${s.code}`,`Gestart: ${s.createdAt}`,`Status: ${s.completed?'Afgerond':'In uitvoering'}`,`Adviesraad: ${s.audience.length} deelnemers`,`Gevechten: ${s.peaceful?'rustige modus':'aan'}`,'',`> ${st.letter.to}. ${st.letter.text} — ${st.letter.from}`,'','Stemmen zijn advies; de speler kiest. Dit dossier legt een leergesprek vast; het is geen toetsing of goedkeuring van een AI-toepassing.',''];
 lines.push('## Besluit');
 if(v){const o=c.verdict.options[v.selection[0]];lines.push(`**${o.title}** — ${o.text}`,'',`Oordeel van het dossier: ${JUDGEMENTS[v.judgement]}`,`Hoogste besluit dat het dossier droeg: ${c.verdict.options[v.ceiling].title}`,`Toelichting speler: ${v.reason||'Niet ingevuld'}`,`Adviesraad: ${v.ballots} stemmen; ${v.counts.map((n,i)=>`${c.verdict.options[i].title}: ${n}`).join(', ')}`,'','Wat het besluit begrenst:',...(v.dossier.reasons.length?v.dossier.reasons.map(r=>`- ${r.text}`):['- Geen beperkingen gevonden.']),'');
  if(v.dossier.shortcut)lines.push('Let op: de groep nam de Snelle Trap van de leverancier en sloeg daarmee kamers over.','');
  if(v.epilogue)lines.push('### Een jaar later',v.epilogue,'');
  const k=s.commitments;lines.push('### Afspraken',`- Eigenaar: ${k.owner||'Nog niet vastgelegd'}`,`- Eerste stap: ${k.firstStep||'Nog niet vastgelegd'}`,`- Evaluatiedatum: ${k.reviewDate||'Nog niet vastgelegd'}`,`- Stopcriterium: ${k.stopCondition||'Nog niet vastgelegd'}`,'');
 }else lines.push('Nog geen besluit bezegeld.','');
 for(const d of c.chambers){const r=s.topics[d.id];if(!r.attempts.length&&!r.trial)continue;
  lines.push(`## ${d.title} — ${d.place}`,d.scenario,'');
  if(r.trial)lines.push(`Proef: ${d.trial.title} — ${r.trial.outcome==='done'?'uitgevoerd':'overgeslagen'}.`,...(r.trial.outcome==='done'?[`Bevinding: ${d.trial.finding}`]:[]),'');
  if(r.attempts.length)lines.push(d.question,'');
  r.attempts.forEach((a,j)=>{lines.push(`### Bespreking ${j+1}`,`Keuze speler: ${a.selection.map(letter).join(', ')}`,`Toelichting: ${a.reason||'Niet ingevuld'}`,`Adviesraad: ${a.ballots} stemmen; ${a.counts.map((n,i)=>`${letter(i)}: ${n}`).join(', ')}`);
   d.options.forEach((o,i)=>lines.push(`- ${letter(i)}. ${o.text} — ${a.selection.includes(i)?'Gekozen':'Niet gekozen'}; ${o.status==='correct'?'kernmaatregel':o.status==='supporting'?'nuttige aanvulling':'niet passend in deze casus'}. ${o.feedback}`));lines.push('');
  });
  if(r.attempts.length)lines.push(`Reflectie: ${d.reflection}`,`Projectnotitie: ${r.note||'Niet ingevuld'}`,`Bron: ${d.source}`,'');
 }
 const arenaLines=st.arenas.flatMap(a=>{const r=s.arenas[a.id];if(!r)return [];const keys=r.lessons||[];return [`### ${a.name} — ${r.outcome==='cleared'?'doorstaan':'overgeslagen'}`,...keys.map(k=>k==='boss'?`- ${st.boss.name}: ${st.boss.lesson}`:`- ${st.mobs[k].name}: ${st.mobs[k].lesson}`),'']});
 if(arenaLines.length)lines.push('## Lessen uit de tussenkamers',...arenaLines);
 lines.push('## Blinde vlekken',...(c.chambers.filter(d=>!s.topics[d.id].attempts.length).map(d=>`- ${d.title}`)),'','Gebaseerd op het AI-raamwerk en de aangeleverde raamwerkdocumenten.');
 return lines.join('\n');
}
module.exports={STORIES,LEVELS,JUDGEMENTS,content,levelOf,assess,judge,initial,normalize,view,action,report};
