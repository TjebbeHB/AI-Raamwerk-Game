import engine from './engine.cjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const bearer=request=>(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
async function readSession(db,code){const row=await db.prepare('SELECT data, revision FROM golem_sessions WHERE code = ?').bind(code).first();if(!row)engine.fail('Deze sessie bestaat niet. Controleer de code bij de speler.',404);return {session:JSON.parse(row.data),revision:row.revision}}
// Conditional writes make votes and host decisions atomic across Worker isolates.
async function updateSession(db,code,mutate){
 for(let attempt=0;attempt<8;attempt++){
  const {session,revision}=await readSession(db,code),result=mutate(session);
  const written=await db.prepare('UPDATE golem_sessions SET data = ?, revision = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(session),session.revision,code,revision).run();
  if(written.meta.changes===1)return {session,result};
 }
 engine.fail('De raad is druk. Probeer het opnieuw.',409);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/game/')){
   if(url.pathname.startsWith('/api/'))return json({error:'De oorspronkelijke workshop is alleen lokaal beschikbaar.'},404);
   if(env.ASSETS)return env.ASSETS.fetch(request);
   return new Response('Not found',{status:404});
  }
  try{
   if(request.method==='GET'&&url.pathname==='/api/game/network')return json({origin:url.origin,local:false});
   let body={};
   if(request.method==='POST'){
    const text=await request.text();if(text.length>24000)engine.fail('Dit verzoek is te groot.',413);
    try{body=JSON.parse(text||'{}')}catch{engine.fail('Stuur geldige JSON.')}
   }
   if(!env.DB)throw new Error('De sessiedatabase is niet beschikbaar.');
   if(request.method==='POST'&&url.pathname==='/api/game/create'){
    for(let attempt=0;attempt<5;attempt++){
     const s=engine.newSession(),written=await env.DB.prepare('INSERT INTO golem_sessions (code, data, revision) VALUES (?, ?, ?) ON CONFLICT(code) DO NOTHING').bind(s.code,JSON.stringify(s),s.revision).run();
     if(written.meta.changes===1)return json({token:s.hostToken,session:engine.publicSession(s,s.hostToken)},201);
    }
    engine.fail('Probeer opnieuw een afdaling te starten.',503);
   }
   const match=url.pathname.match(/^\/api\/game\/([A-Z2-9]{6})(?:\/(join|action|report|info))?$/);if(!match)engine.fail('Route niet gevonden.',404);
   const code=match[1],token=bearer(request);
   if(request.method==='GET'&&match[2]==='info'){const {session}=await readSession(env.DB,code);return json({mode:session.mode||'story'})}
   if(request.method==='GET'&&!match[2]){const {session}=await readSession(env.DB,code);return json({session:engine.publicSession(session,token)})}
   if(request.method==='GET'&&match[2]==='report'){const {session}=await readSession(env.DB,code);return new Response(engine.buildReport(session,token),{headers:{'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="het-gewelf-${code}.md"`}})}
   if(request.method==='POST'&&match[2]==='join'){
    const {session,result}=await updateSession(env.DB,code,s=>engine.join(s,body));return json({...result,session:engine.publicSession(session,result.token)});
   }
   if(request.method==='POST'&&match[2]==='action'){
    const {session,result}=await updateSession(env.DB,code,s=>engine.applyAction(s,token,body));return json({...result,session:engine.publicSession(session,token)});
   }
   engine.fail('Methode niet toegestaan.',405);
  }catch(e){return json({error:e.status?e.message:'Het Gewelf kon deze actie niet bewaren. Probeer het opnieuw.'},e.status||500)}
 }
};
