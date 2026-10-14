// Trial rules: what counts as progress in each hands-on activity. No 3D code, so the tests can use it too.
// Sequence steps stand in the room out of order: slot i holds step SEQUENCE_ORDER[i].
const SEQUENCE_ORDER=[2,0,3,1];
function start(def){
 switch(def.type){
  case 'witness':return {heard:[]};
  case 'gather':return {got:[]};
  case 'sort':return {placed:[],holding:null};
  case 'judge':return {judged:[]};
  case 'sequence':return {next:0,lit:[]};
  case 'levers':return {states:def.levers.map(l=>l.start)};
  case 'fight':return {defeated:0};
  default:return {};
 }
}
function total(def){return def.type==='levers'?def.levers.length:def.type==='fight'?def.count:(def.witnesses||def.items||def.steps||[]).length}
function progress(def,st){
 switch(def.type){
  case 'witness':return st.heard.length;
  case 'gather':return st.got.length;
  case 'sort':return st.placed.length;
  case 'judge':return st.judged.length;
  case 'sequence':return st.next;
  case 'levers':return def.levers.filter((l,i)=>st.states[i]===l.correct).length;
  case 'fight':return st.defeated;
  default:return 0;
 }
}
const isDone=(def,st)=>progress(def,st)>=total(def);
// Applies one player action. Returns what happened so the page can update the world and explain it.
function act(def,st,ev){
 const t=def.type;
 if(t==='witness'&&ev.type==='item'){const w=def.witnesses[ev.index];if(!w)return {ok:false};const fresh=!st.heard.includes(ev.index);if(fresh)st.heard.push(ev.index);return {ok:true,fresh,speaker:w.name,line:w.line,item:[ev.index,'done']}}
 if(t==='gather'&&ev.type==='item'){const g=def.items[ev.index];if(!g||st.got.includes(ev.index))return {ok:false};st.got.push(ev.index);return {ok:true,fresh:true,message:`${g.label}. ${g.found}`,item:[ev.index,'collect']}}
 if(t==='sort'){
  if(ev.type==='item'){if(st.placed.includes(ev.index))return {ok:false};if(st.holding!==null)return {ok:false,message:'Je draagt al iets. Breng dat eerst naar een plek.'};st.holding=ev.index;return {ok:true,hold:ev.index}}
  if(ev.type==='bin'){if(st.holding===null)return {ok:false};const i=st.holding,item=def.items[i];st.holding=null;
   if(item.bin===ev.index){st.placed.push(i);return {ok:true,fresh:true,place:[i,ev.index],message:`Goed: ${item.label.replace(/^[^:]+:\s*/,'')} → ${def.bins[ev.index].label}.`}}
   return {ok:false,putBack:i,message:item.wrong}}
 }
 if(t==='judge'&&ev.type==='answer'){const item=def.items[ev.index];if(!item||st.judged.includes(ev.index))return {ok:false};if(item.answer===ev.answer){st.judged.push(ev.index);return {ok:true,fresh:true,message:item.explain,item:[ev.index,'done']}}return {ok:false,wrong:ev.index,message:'Nog niet. Lees het nog eens goed: wat zegt dit écht?',item:[ev.index,'wrong']}}
 if(t==='sequence'&&ev.type==='item'){const step=SEQUENCE_ORDER[ev.index];if(step===undefined||st.lit.includes(ev.index))return {ok:false};
  if(step===st.next){st.next++;st.lit.push(ev.index);return {ok:true,fresh:true,message:`Stap ${step+1}: ${def.steps[step]}`,item:[ev.index,'lit']}}
  const reset=[...st.lit];st.next=0;st.lit=[];return {ok:false,reset,wrong:ev.index,message:def.hint,item:[ev.index,'wrong']}}
 if(t==='levers'&&ev.type==='item'){const l=def.levers[ev.index];if(!l)return {ok:false};st.states[ev.index]=1-st.states[ev.index];const good=st.states[ev.index]===l.correct;return {ok:good,fresh:good,lever:[ev.index,st.states[ev.index]],message:`${l.label}: ${l.states[st.states[ev.index]]}. ${good?l.good:l.bad}`,gauge:progress(def,st)/total(def)}}
 if(t==='fight'&&ev.type==='kill'){st.defeated++;return {ok:true,fresh:true}}
 return {ok:false};
}
// A short line for the HUD tracker.
function status(def,st){
 const n=progress(def,st),of=total(def);
 if(def.type==='levers')return `${def.gauge}: ${Math.round(n/of*100)}%`;
 if(def.type==='sequence')return `${n} / ${of} in de goede volgorde`;
 return `${n} / ${of}`;
}
module.exports={SEQUENCE_ORDER,start,total,progress,isDone,act,status};
