const {TOPICS}=require('./topics.cjs');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const emptyRoom=()=>({visited:[],opened:false,votes:{},attempts:[],note:''});
function initial(){return {mode:'framework',topic:null,epoch:0,topics:Object.fromEntries(TOPICS.map(t=>[t.id,emptyRoom()]))}}
function tally(room,def){const ballots=Object.values(room.votes).filter(v=>v.length);return {counts:def.options.map((_,i)=>ballots.filter(v=>v.includes(i)).length),ballots:ballots.length}}
function view(s,viewer){
 return {mode:s.mode,code:s.code,createdAt:s.createdAt,revision:s.revision,topic:s.topic,epoch:s.epoch,completed:s.completed,role:viewer.role,name:viewer.member?.name||'Avonturier',audienceCount:s.audience.length,
  topics:Object.fromEntries(TOPICS.map(d=>{const r=s.topics[d.id],last=r.attempts.at(-1);return [d.id,{visited:[...r.visited],opened:r.opened,attemptCount:r.attempts.length,result:last?structuredClone(last):null,note:r.note,...(r.opened?tally(r,d):last?{counts:[...last.counts],ballots:last.ballots}:tally(r,d)),ownVote:viewer.member?[...(r.votes[viewer.member.token]||[])]:null}]}))};
}
function select(value,def,allowEmpty=false){
 if(!Array.isArray(value)||value.length>def.options.length||value.some(i=>!Number.isInteger(i)||i<0||i>=def.options.length)||new Set(value).size!==value.length)fail('Selecteer geldige, verschillende antwoorden.');
 if(!allowEmpty&&!value.length)fail('Selecteer ten minste één antwoord.');
 return [...value].sort((a,b)=>a-b);
}
function action(s,viewer,body){
 const {type}=body;
 if(!['enter','hub','inspect','openVote','vote','decide','retry','note','finish'].includes(type))fail('Onbekende actie.');
 if(type==='vote'?viewer.role!=='audience':viewer.role!=='host')fail(type==='vote'?'Alleen de adviesraad stemt.':'Alleen de speler bepaalt de route en het besluit.',403);
 if(s.completed)fail('Deze expeditie is afgerond.',409);
 // A visit nonce also rejects late actions after leaving and returning to the same room.
 if(body.topic!==s.topic||body.epoch!==s.epoch)fail('De speler is verdergegaan. De pagina wordt bijgewerkt; probeer opnieuw.',409);
 const def=TOPICS.find(t=>t.id===s.topic),room=def?s.topics[def.id]:null;
 if(type==='enter'){
  if(!TOPICS.some(t=>t.id===body.target))fail('Dit onderwerp bestaat niet.');
  if(room)room.opened=false;
  s.topic=body.target;s.epoch++;
  const entered=s.topics[s.topic];
  if(!entered.attempts.length){entered.opened=true;entered.votes={}}
 }else if(type==='hub'||type==='finish'){
  if(type==='finish'&&!Object.values(s.topics).some(r=>r.attempts.length))fail('Bespreek eerst ten minste één casus.');
  if(room)room.opened=false;
  s.topic=null;s.epoch++;if(type==='finish')s.completed=true;
 }else{
  if(!room)fail('Kies eerst een onderwerp.',409);
  if(type==='inspect'){
   if(!def.clues.some(c=>c.id===body.clue))fail('Deze bron hoort niet bij de ruimte.');
   if(!room.visited.includes(body.clue))room.visited.push(body.clue);
  }
  if(type==='openVote'){
   if(room.attempts.length)fail('Start een nieuwe ronde om deze casus nogmaals te bespreken.',409);
   if(!room.opened){room.votes={};room.opened=true;s.epoch++}
  }
  if(type==='retry'){
   if(!room.attempts.length)fail('Er is nog geen eerdere bespreking.',409);
   room.votes={};room.opened=true;s.epoch++;
  }
  if(type==='vote'){
   if(!room.opened)fail('De stemronde is gesloten.',409);
   room.votes[viewer.member.token]=select(body.selection,def,true);
  }
  if(type==='decide'){
   if(!room.opened)fail('Open eerst een stemronde.',409);
   const selection=select(body.selection,def),{counts,ballots}=tally(room,def);
   const missing=def.options.flatMap((o,i)=>o.status==='correct'&&!selection.includes(i)?[i]:[]);
   const unsuitable=selection.filter(i=>def.options[i].status==='incorrect');
   room.attempts.push({selection,counts,ballots,missing,unsuitable,complete:!missing.length&&!unsuitable.length,reason:clean(body.reason,800),at:new Date().toISOString()});
   room.opened=false;s.epoch++;
  }
  if(type==='note')room.note=clean(body.note);
 }
 s.revision++;return {};
}
function report(s){
 const lines=['# The Golem Below 2.0 — Expeditielogboek','',`Sessie: ${s.code}`,`Gestart: ${s.createdAt}`,`Status: ${s.completed?'Afgerond':'In uitvoering'}`,`Adviesraad: ${s.audience.length} deelnemers`,'','Stemmen zijn advies; de speler kiest. Meerdere antwoorden kunnen passen. Ondersteunende maatregelen zijn nuttig, maar vervangen de kernmaatregelen niet.',''];
 const letter=i=>String.fromCharCode(65+i);
 for(const d of TOPICS){const r=s.topics[d.id];if(!r.attempts.length)continue;
  lines.push(`## ${d.title}`,d.scenario,'',d.question,'');
  r.attempts.forEach((a,j)=>{lines.push(`### Bespreking ${j+1}`,`Keuze speler: ${a.selection.map(letter).join(', ')}`,`Toelichting: ${a.reason||'Niet ingevuld'}`,`Adviesraad: ${a.ballots} stemmen; ${a.counts.map((n,i)=>`${letter(i)}: ${n}`).join(', ')}`);
   d.options.forEach((o,i)=>lines.push(`- ${letter(i)}. ${o.text} — ${a.selection.includes(i)?'Gekozen':'Niet gekozen'}; ${o.status==='correct'?'kernmaatregel':o.status==='supporting'?'nuttige aanvulling':'niet passend in deze casus'}. ${o.feedback}`));lines.push('');
  });lines.push(`Reflectie: ${d.reflection}`,`Projectnotitie: ${r.note||'Niet ingevuld'}`,`Bron: ${d.source}`,'');
 }
 lines.push('## Nog te verkennen',...TOPICS.filter(d=>!s.topics[d.id].attempts.length).map(d=>`- ${d.title}`),'','Gebaseerd op Spel ideeën 2.0 en de aangeleverde raamwerkdocumenten. Dit logboek legt een leergesprek vast; het is geen toetsing of goedkeuring van een AI-toepassing.');return lines.join('\n');
}
module.exports={initial,view,action,report};
