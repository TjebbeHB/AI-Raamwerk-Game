const descent=require('./descent.cjs');
const MAX_AUDIENCE=15;
const clean=(v,max=600)=>String(v??'').trim().slice(0,max);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}
function validateCode(code){if(!/^[A-Z2-9]{6}$/.test(code))fail('Vul de zescijferige code van de speler in.');return code}
function randomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=crypto.getRandomValues(new Uint8Array(6));return Array.from(a,n=>alphabet[n%alphabet.length]).join('')}
function newSession(code=randomCode(),options={}){return {code,hostToken:crypto.randomUUID(),createdAt:new Date().toISOString(),revision:0,completed:false,audience:[],...descent.initial(options)}}
// Sessions from the previous top-down versions live on in backup/golem-below-2.1.
function current(s){if(s.mode!=='descent')fail('Deze sessie hoort bij een vorige versie van het spel. Start een nieuwe afdaling.',410)}
function identity(s,token){if(token&&token===s.hostToken)return {role:'host'};const member=token?s.audience.find(p=>p.token===token):null;if(member)return {role:'audience',member};fail('Deze sessie vraagt om je bewaarde toegangspas. Sluit opnieuw aan.',401)}
function publicSession(s,token){current(s);return descent.view(s,identity(s,token))}
function join(s,body){
 current(s);descent.normalize(s);
 if(body.token){const old=s.audience.find(p=>p.token===body.token);if(old)return {token:old.token};}
 if(s.completed)fail('Deze afdaling is afgerond. Vraag de speler om een nieuwe sessiecode.',409);
 if(s.audience.length>=MAX_AUDIENCE)fail('De adviesraad is vol (15 deelnemers).',409);
 const token=crypto.randomUUID();s.audience.push({token,name:clean(body.name,32)||`Raadslid ${s.audience.length+1}`});s.revision++;return {token};
}
function applyAction(s,token,body){current(s);return descent.action(s,identity(s,token),body)}
function buildReport(s,token){current(s);identity(s,token);return descent.report(s)}
module.exports={MAX_AUDIENCE,newSession,validateCode,identity,publicSession,join,applyAction,buildReport,fail};
