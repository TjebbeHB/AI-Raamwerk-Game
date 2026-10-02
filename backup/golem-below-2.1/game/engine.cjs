const {ROOMS}=require('./content.cjs');
const framework=require('./framework.cjs');
const MAX_AUDIENCE=15;
const clean=(v,max=600)=>String(v??'').trim().slice(0,max);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}
function validateCode(code){if(!/^[A-Z2-9]{6}$/.test(code))fail('Enter the six-character code shown by the player.');return code}
function randomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=crypto.getRandomValues(new Uint8Array(6));return Array.from(a,n=>alphabet[n%alphabet.length]).join('')}
function newSession(code=randomCode(),mode='story'){
 if(mode==='framework')return {code,hostToken:crypto.randomUUID(),createdAt:new Date().toISOString(),revision:0,completed:false,audience:[],...framework.initial()};
 return {code,hostToken:crypto.randomUUID(),createdAt:new Date().toISOString(),revision:0,room:0,completed:false,audience:[],rooms:ROOMS.map(()=>({visited:[],opened:false,votes:{},decision:null,repaired:false,note:''})),charter:{project:'',owner:'',reviewDate:'',measure:'',stopCondition:''}};
}
function identity(s,token){if(token&&token===s.hostToken)return {role:'host'};const member=token?s.audience.find(p=>p.token===token):null;if(member)return {role:'audience',member};fail('This session needs your saved player or audience pass. Please rejoin.',401)}
function countsFor(room){const counts=[0,0,0];Object.values(room.votes).forEach(i=>counts[i]++);return counts}
function leadersFor(counts){const max=Math.max(...counts);return max>0?counts.map((n,i)=>n===max?i:-1).filter(i=>i>=0):[]}
function publicSession(s,token){
 const viewer=identity(s,token);
 if(s.mode==='framework')return framework.view(s,viewer);
 return {code:s.code,createdAt:s.createdAt,revision:s.revision,room:s.room,completed:s.completed,role:viewer.role,name:viewer.member?.name||'Adventurer',audienceCount:s.audience.length,rooms:s.rooms.map(r=>({visited:[...r.visited],opened:r.opened,counts:r.decision?r.decision.counts:countsFor(r),ownVote:viewer.member?(r.votes[viewer.member.token]??null):null,decision:r.decision?{...r.decision}:null,repaired:r.repaired,note:r.note})),charter:{...s.charter}};
}
function join(s,body){
 if(body.token){const old=s.audience.find(p=>p.token===body.token);if(old)return {token:old.token};}
 if(s.completed)fail('This adventure has ended. Ask the player for a new session code.',409);
 if(s.audience.length>=MAX_AUDIENCE)fail('This council is full (15 audience members).',409);
 const token=crypto.randomUUID();s.audience.push({token,name:clean(body.name,32)||`Council member ${s.audience.length+1}`});s.revision++;return {token};
}
function applyAction(s,token,body){
 const viewer=identity(s,token),type=body.type;
 if(s.mode==='framework')return framework.action(s,viewer,body);
 if(!['inspect','openVote','vote','decide','repair','note','next','charter'].includes(type))fail('Unknown action.');
 if(type!=='vote'&&viewer.role!=='host')fail('Only the player can make that decision. Audience votes are advice.',403);
 if(type==='vote'&&viewer.role!=='audience')fail('The player makes the decision; audience members cast votes.',403);
 if(body.room!==s.room)fail('The adventure moved on. Refresh before trying again.',409);
 if(s.completed&&type!=='charter')fail('This adventure is complete.',409);
 const room=s.rooms[s.room],def=ROOMS[s.room];let response={};
 if(type==='inspect'){
  if(!def.clues.some(c=>c.id===body.clue))fail('That clue is not in this chamber.');
  if(!room.visited.includes(body.clue))room.visited.push(body.clue);
 }
 if(type==='openVote'){
  if(room.decision)fail('The decision has already been made.',409);
  if(room.visited.length<def.clues.length)fail('Explore all three clues before asking the council.',409);
  room.opened=true;
 }
 if(type==='vote'){
  if(!room.opened||room.decision)fail('Voting is not open for this chamber.',409);
  if(!Number.isInteger(body.option)||body.option<0||body.option>=def.choices.length)fail('Choose one of the three options.');
  room.votes[viewer.member.token]=body.option;
 }
 if(type==='decide'){
  if(!room.opened||room.decision)fail('Open a vote before making a decision, or continue the existing decision.',409);
  if(!Number.isInteger(body.option)||body.option<0||body.option>=def.choices.length)fail('Choose one of the three options.');
  const counts=countsFor(room),leaders=leadersFor(counts);
  room.decision={option:body.option,counts,leaders,relation:leaders.length===0?'No audience votes':leaders.length>1?(leaders.includes(body.option)?'Chose a tied recommendation':'Chose another path'):leaders[0]===body.option?'Followed the council':'Chose another path',reason:clean(body.reason),at:new Date().toISOString()};
 }
 if(type==='repair'){
  if(!room.decision)fail('Make the decision first.',409);
  if(room.repaired)fail('This repair is already complete.',409);
  if(!Number.isInteger(body.option)||body.option<0||body.option>=def.puzzle.options.length)fail('Choose a repair action.');
  response.correct=body.option===def.puzzle.answer;
  if(response.correct)room.repaired=true;
 }
 if(type==='note'){room.note=clean(body.note,1200)}
 if(type==='charter'){
  if(s.room!==4||!room.repaired)fail('Finish the final chamber before writing the town charter.',409);
  for(const key of Object.keys(s.charter))if(body[key]!==undefined)s.charter[key]=clean(body[key],key==='reviewDate'?10:300);
  if(s.charter.reviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(s.charter.reviewDate))fail('Use a valid review date.');
 }
 if(type==='next'){
  if(!room.repaired)fail('Finish helping the residents before entering the passage.',409);
  if(s.room===4)s.completed=true;else s.room++;
 }
 s.revision++;return response;
}
function buildReport(s,token){
 identity(s,token);
 if(s.mode==='framework')return framework.report(s);
 const lines=['# The Golem Below — Town Charter','',`Session: ${s.code}`,`Started: ${s.createdAt}`,`Status: ${s.completed?'Adventure complete':'Adventure in progress'}`,`Audience: ${s.audience.length} council members`,''];
 for(let i=0;i<ROOMS.length;i++){
  const d=ROOMS[i],r=s.rooms[i];lines.push(`## ${i+1}. ${d.title}`,`Learning theme: ${d.theme}`);
  if(!r.decision){lines.push('Not yet decided.','');continue}
  const c=d.choices[r.decision.option];lines.push(`Player decision: ${c.title}`,`Council: ${r.decision.relation}`,`Votes at decision: ${r.decision.counts.map((n,j)=>`${d.choices[j].title}: ${n}`).join('; ')}`,`Player reasoning: ${r.decision.reason||'Not recorded'}`,`Result: ${c.outcome}`,`Benefit: ${c.benefit}`,`Remaining concern: ${c.concern}`,`Repair completed: ${r.repaired?'Yes':'No'}`,`Reflection: ${d.reflection}`,`Project note: ${r.note||'Not recorded'}`,`Learning resource: ${d.source}`,'');
 }
 lines.push('## Our next real-world step',`Project / experiment: ${s.charter.project||'To be agreed'}`,`Owner: ${s.charter.owner||'To be agreed'}`,`Review date: ${s.charter.reviewDate||'To be agreed'}`,`Success measure: ${s.charter.measure||'To be agreed'}`,`Pause or stop when: ${s.charter.stopCondition||'To be agreed'}`,'','This is an educational adventure and a discussion record, not a legal assessment or approval to deploy AI.');
 return lines.join('\n');
}
module.exports={ROOMS,MAX_AUDIENCE,newSession,validateCode,identity,publicSession,join,applyAction,buildReport,fail};
