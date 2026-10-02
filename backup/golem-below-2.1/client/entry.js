const params=new URLSearchParams(location.search);
async function start(){
 let story=params.has('story');
 const code=(params.get('join')||'').trim().toUpperCase();
 if(/^[A-Z2-9]{6}$/.test(code)){
  try{const res=await fetch(`/api/game/${code}/info`,{signal:AbortSignal.timeout(6000)});if(res.ok)story=(await res.json()).mode==='story'}catch{}
 }
 if(story){document.documentElement.lang='en';await import('./game.js')}
 else await import('./framework.js');
}
start();
