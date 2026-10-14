const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const engine=require('./engine.cjs');
const dataFile=process.env.GOLEM_DATA_FILE||path.join(__dirname,'../data/gewelf-sessions.json');
let sessions={};
try{sessions=JSON.parse(fs.readFileSync(dataFile,'utf8')).sessions||{}}catch(e){if(e.code!=='ENOENT')throw new Error(`Kon de sessies niet lezen: ${e.message}`)}
function commit(code,session){const candidate={...sessions,[code]:session};fs.mkdirSync(path.dirname(dataFile),{recursive:true});const temp=`${dataFile}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify({sessions:candidate},null,2));fs.renameSync(temp,dataFile);sessions=candidate}
function send(res,status,body,type='application/json'){res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body)}
async function bodyFor(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>24000)engine.fail('Dit verzoek is te groot.',413)}try{return text?JSON.parse(text):{}}catch{engine.fail('Stuur geldige JSON.')}}
module.exports=async function gameApi(req,res,url){
 if(!url.pathname.startsWith('/api/game/'))return false;
 try{
  if(req.method==='GET'&&url.pathname==='/api/game/network'){
   const port=process.env.PORT||5173;
   const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>`http://${x.address}:${port}`);
   send(res,200,{origin:addresses[0]||url.origin,local:true});return true;
  }
  const body=req.method==='POST'?await bodyFor(req):{};
  if(req.method==='POST'&&url.pathname==='/api/game/create'){
   let s=engine.newSession(undefined,{story:body.story,peaceful:body.peaceful===true});while(sessions[s.code])s=engine.newSession(undefined,{story:body.story,peaceful:body.peaceful===true});commit(s.code,s);send(res,201,{token:s.hostToken,session:engine.publicSession(s,s.hostToken)});return true;
  }
  const match=url.pathname.match(/^\/api\/game\/([A-Z2-9]{6})(?:\/(join|action|report|info))?$/);if(!match)engine.fail('Route niet gevonden.',404);
  const s=sessions[match[1]];if(!s)engine.fail('Deze sessie bestaat niet. Controleer de code bij de speler.',404);
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(req.method==='GET'&&match[2]==='info')send(res,200,{mode:s.mode||'story'});
  else if(req.method==='GET'&&!match[2])send(res,200,{session:engine.publicSession(s,token)});
  else if(req.method==='GET'&&match[2]==='report')send(res,200,engine.buildReport(s,token),'text/markdown');
  else if(req.method==='POST'&&match[2]==='join'){
   const copy=structuredClone(s),result=engine.join(copy,body);commit(s.code,copy);send(res,200,{...result,session:engine.publicSession(copy,result.token)});
  }else if(req.method==='POST'&&match[2]==='action'){
   const copy=structuredClone(s),result=engine.applyAction(copy,token,body);commit(s.code,copy);send(res,200,{...result,session:engine.publicSession(copy,token)});
  }else engine.fail('Methode niet toegestaan.',405);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Het Gewelf kon deze actie niet bewaren. Probeer het opnieuw.'})}
 return true;
};
