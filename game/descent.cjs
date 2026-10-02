// Session rules for "Het Gewelf": one player descends, the council advises, the dossier informs the verdict.
const {TOPICS}=require('./topics.cjs');
const CONTENT=require('./descent.json');
const CHAMBERS=[CONTENT.necessity,...TOPICS];
const VERDICT=CONTENT.verdict;
const DEPTHS=CONTENT.depths;
const depthOf=id=>id==='necessity'?1:id==='verdict'?4:TOPICS.find(t=>t.id===id)?.group==='foundation'?2:3;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const emptyRoom=()=>({visited:[],opened:false,votes:{},attempts:[],note:''});
const optionsOf=id=>id==='verdict'?VERDICT.options:CHAMBERS.find(c=>c.id===id).options;

function initial(){return {mode:'descent',depth:0,topic:null,epoch:0,topics:Object.fromEntries([...CHAMBERS.map(c=>[c.id,emptyRoom()]),['verdict',emptyRoom()]]),commitments:{owner:'',firstStep:'',reviewDate:'',stopCondition:''}}}

// The dossier: what is solid, what is open and what was never looked at. No score, only a ceiling the evidence can carry.
function assess(topics){
 const state=id=>{const last=topics[id]?.attempts?.at(-1);return !last?'blind':last.complete?'strong':'open'};
 const title=id=>CHAMBERS.find(c=>c.id===id).title;
 const chambers=CHAMBERS.map(c=>({id:c.id,title:c.title,group:c.group,state:state(c.id)}));
 let ceiling=3;const reasons=[];
 const limit=(level,text)=>{ceiling=Math.min(ceiling,level);reasons.push({level,text})};
 const need=state('necessity');
 if(need==='blind')limit(1,'De noodzaak is niet onderzocht. Zonder probleemanalyse en alternatief zonder AI is niet te zeggen of AI iets oplost.');
 else if(need==='open')limit(1,'De noodzaak staat nog niet stevig: niet alle kernvragen over probleem, alternatieven of succescriteria zijn beantwoord.');
 if(state('governance')!=='strong')limit(1,'Eigenaarschap is niet geregeld. Zonder aanspreekbare eigenaar kan zelfs een pilot niet verantwoord draaien.');
 for(const id of ['culture','capacity','infrastructure'])if(state(id)!=='strong')limit(2,`Fundament ‘${title(id)}’ is ${state(id)==='blind'?'niet onderzocht':'nog niet op orde'}. In een pilot kun je dat leren; in productie niet.`);
 if(state('evaluation')==='blind')limit(1,'Er is geen evaluatieplan besproken. Een pilot die niets meet, levert geen bewijs op voor een volgend besluit.');
 for(const id of VERDICT.critical)if(state(id)!=='strong')limit(2,`Kritisch domein ‘${title(id)}’ is ${state(id)==='blind'?'een blinde vlek':'nog open'}. Productie vraagt hier zekerheid.`);
 const domains=chambers.filter(c=>c.group==='domain'),solid=domains.filter(c=>c.state==='strong').length;
 if(solid<6)limit(2,`${solid} van de 10 domeinen staan stevig. Voor productie is een breder beeld nodig (minstens zes).`);
 reasons.sort((x,y)=>x.level-y.level);
 return {ceiling,reasons,chambers,strong:chambers.filter(c=>c.state==='strong').map(c=>c.id),open:chambers.filter(c=>c.state==='open').map(c=>c.id),blind:chambers.filter(c=>c.state==='blind').map(c=>c.id)};
}
function judge(choice,ceiling){
 if(choice===0)return ceiling<=1?'grounded':'cautious-stop';
 return choice===ceiling?'supported':choice<ceiling?'cautious':'beyond';
}

function tally(room,id){const options=optionsOf(id),ballots=Object.values(room.votes).filter(v=>v.length);return {counts:options.map((_,i)=>ballots.filter(v=>v.includes(i)).length),ballots:ballots.length}}
function view(s,viewer){
 const topics=Object.fromEntries(Object.keys(s.topics).map(id=>{const r=s.topics[id],last=r.attempts.at(-1);return [id,{visited:[...r.visited],opened:r.opened,attemptCount:r.attempts.length,result:last?structuredClone(last):null,note:r.note,...(r.opened||!last?tally(r,id):{counts:[...last.counts],ballots:last.ballots}),ownVote:viewer.member?[...(r.votes[viewer.member.token]||[])]:null}]}));
 return {mode:s.mode,code:s.code,createdAt:s.createdAt,revision:s.revision,depth:s.depth,topic:s.topic,epoch:s.epoch,completed:s.completed,role:viewer.role,name:viewer.member?.name||'Ambtenaar',audienceCount:s.audience.length,topics,commitments:{...s.commitments},dossier:assess(s.topics)};
}
function select(value,id,allowEmpty=false){
 const n=optionsOf(id).length;
 if(!Array.isArray(value)||value.length>n||value.some(i=>!Number.isInteger(i)||i<0||i>=n)||new Set(value).size!==value.length)fail('Selecteer geldige, verschillende antwoorden.');
 if(id==='verdict'&&value.length>1)fail('Kies één besluit.');
 if(!allowEmpty&&!value.length)fail('Selecteer ten minste één antwoord.');
 return [...value].sort((a,b)=>a-b);
}
const TYPES=['move','enter','hub','inspect','vote','decide','retry','note','commit','finish'];
function action(s,viewer,body){
 const {type}=body;
 if(!TYPES.includes(type))fail('Onbekende actie.');
 if(type==='vote'?viewer.role!=='audience':viewer.role!=='host')fail(type==='vote'?'Alleen de adviesraad stemt.':'Alleen de speler bepaalt de route en het besluit.',403);
 if(s.completed&&type!=='commit')fail('Deze afdaling is afgerond.',409);
 // A visit nonce rejects late actions after leaving and returning to the same chamber.
 if(body.topic!==s.topic||body.epoch!==s.epoch)fail('De speler is verdergegaan. De pagina wordt bijgewerkt; probeer opnieuw.',409);
 const room=s.topic?s.topics[s.topic]:null;
 if(type==='move'){
  if(!Number.isInteger(body.depth)||!DEPTHS.some(d=>d.id===body.depth))fail('Deze diepte bestaat niet.');
  if(room)fail('Verlaat eerst de kamer.',409);
  s.depth=body.depth;
 }else if(type==='enter'){
  if(!s.topics[body.target])fail('Deze kamer bestaat niet.');
  if(room)room.opened=false;
  s.topic=body.target;s.depth=depthOf(body.target);s.epoch++;
  const entered=s.topics[s.topic];
  if(!entered.attempts.length){entered.opened=true;entered.votes={}}
 }else if(type==='hub'){
  if(room)room.opened=false;
  s.topic=null;s.epoch++;
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
  const def=CHAMBERS.find(c=>c.id===s.topic);
  if(type==='inspect'){
   if(!def?.clues.some(c=>c.id===body.clue))fail('Deze bron hoort niet bij de kamer.');
   if(!room.visited.includes(body.clue))room.visited.push(body.clue);
  }
  if(type==='retry'){
   if(!room.attempts.length)fail('Er is nog geen eerdere bespreking.',409);
   room.votes={};room.opened=true;s.epoch++;
  }
  if(type==='vote'){
   if(!room.opened)fail('De adviesronde is gesloten.',409);
   room.votes[viewer.member.token]=select(body.selection,s.topic,true);
  }
  if(type==='decide'){
   if(!room.opened)fail('Open eerst een nieuwe ronde.',409);
   const selection=select(body.selection,s.topic),{counts,ballots}=tally(room,s.topic),reason=clean(body.reason,800),at=new Date().toISOString();
   if(s.topic==='verdict'){
    const dossier=assess(s.topics);
    room.attempts.push({selection,counts,ballots,reason,at,ceiling:dossier.ceiling,judgement:judge(selection[0],dossier.ceiling),dossier});
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
 const letter=i=>String.fromCharCode(65+i),v=s.topics.verdict.attempts.at(-1);
 const lines=['# Het Gewelf — Besluitdossier','',`Sessie: ${s.code}`,`Gestart: ${s.createdAt}`,`Status: ${s.completed?'Afgerond':'In uitvoering'}`,`Adviesraad: ${s.audience.length} deelnemers`,'',`> ${CONTENT.intro.letter}`,'','Stemmen zijn advies; de speler kiest. Dit dossier legt een leergesprek vast; het is geen toetsing of goedkeuring van een AI-toepassing.',''];
 lines.push('## Besluit');
 if(v){const o=VERDICT.options[v.selection[0]];lines.push(`**${o.title}** — ${o.text}`,'',`Oordeel van het dossier: ${JUDGEMENTS[v.judgement]}`,`Hoogste besluit dat het dossier droeg: ${VERDICT.options[v.ceiling].title}`,`Toelichting speler: ${v.reason||'Niet ingevuld'}`,`Adviesraad: ${v.ballots} stemmen; ${v.counts.map((n,i)=>`${VERDICT.options[i].title}: ${n}`).join(', ')}`,'','Wat het besluit begrenst:',...(v.dossier.reasons.length?v.dossier.reasons.map(r=>`- ${r.text}`):['- Geen beperkingen gevonden.']),'');
  const c=s.commitments;lines.push('### Afspraken',`- Eigenaar: ${c.owner||'Nog niet vastgelegd'}`,`- Eerste stap: ${c.firstStep||'Nog niet vastgelegd'}`,`- Evaluatiedatum: ${c.reviewDate||'Nog niet vastgelegd'}`,`- Stopcriterium: ${c.stopCondition||'Nog niet vastgelegd'}`,'');
 }else lines.push('Nog geen besluit bezegeld.','');
 for(const d of CHAMBERS){const r=s.topics[d.id];if(!r.attempts.length)continue;
  lines.push(`## ${d.title} — ${d.place}`,d.scenario,'',d.question,'');
  r.attempts.forEach((a,j)=>{lines.push(`### Bespreking ${j+1}`,`Keuze speler: ${a.selection.map(letter).join(', ')}`,`Toelichting: ${a.reason||'Niet ingevuld'}`,`Adviesraad: ${a.ballots} stemmen; ${a.counts.map((n,i)=>`${letter(i)}: ${n}`).join(', ')}`);
   d.options.forEach((o,i)=>lines.push(`- ${letter(i)}. ${o.text} — ${a.selection.includes(i)?'Gekozen':'Niet gekozen'}; ${o.status==='correct'?'kernmaatregel':o.status==='supporting'?'nuttige aanvulling':'niet passend in deze casus'}. ${o.feedback}`));lines.push('');
  });lines.push(`Reflectie: ${d.reflection}`,`Projectnotitie: ${r.note||'Niet ingevuld'}`,`Bron: ${d.source}`,'');
 }
 lines.push('## Blinde vlekken',...(CHAMBERS.filter(d=>!s.topics[d.id].attempts.length).map(d=>`- ${d.title}`)),'','Gebaseerd op het AI-raamwerk en de aangeleverde raamwerkdocumenten.');
 return lines.join('\n');
}
module.exports={CHAMBERS,VERDICT,DEPTHS,INTRO:CONTENT.intro,JUDGEMENTS,depthOf,assess,judge,initial,view,action,report};
