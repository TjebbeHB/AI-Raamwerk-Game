// Content per story. The framework chambers stay the same; each story brings its own case, cast, monsters and endings.
const TOPICS=require('./topics.json');
const STORIES=require('./stories.json');
const TRIALS=require('./trials.json');
const BASE=require('./descent.json');
const DEFAULT_STORY='loket';
const cache={};
const storyOf=id=>STORIES.find(s=>s.id===id)||STORIES.find(s=>s.id===DEFAULT_STORY);
const mergeOptions=(options,over)=>over?options.map((o,i)=>over[i]?{...o,...over[i]}:o):options;

function chamberFor(topic,story){
 const o=story.overrides?.[topic.id]||{},trial=TRIALS[topic.id],extra=story.trials?.[topic.id];
 return {...topic,hook:o.hook||topic.hook,scenario:o.scenario||topic.scenario,question:o.question||topic.question,options:mergeOptions(topic.options,o.options),trial:extra?{...trial,...extra}:trial};
}
function content(id){
 const story=storyOf(id);
 return cache[story.id] ||= {
  story,
  chambers:[story.necessity,...TOPICS.map(t=>chamberFor(t,story))],
  levels:BASE.levels.map(l=>{if(l.kind!=='arena')return l;const a=story.arenas.find(x=>x.id===l.id);return {...l,name:a.name,line:a.intro}}),
  verdict:{...story.verdict,options:BASE.verdict.options},
  tools:BASE.tools
 };
}
// Level index of every place in the descent: 0 hall, 1 question, 2 arena, 3 foundations, 4 arena, 5 domains, 6 boss, 7 seal.
const ARENA_LEVEL={a1:2,a2:4,a3:6};
function levelOf(id){if(id==='necessity')return 1;if(id==='verdict')return 7;if(ARENA_LEVEL[id])return ARENA_LEVEL[id];return TOPICS.find(t=>t.id===id)?.group==='foundation'?3:5}
function epilogueKey(choice,judgement){const key=BASE.verdict.options[choice].key;return [key,key==='stop'?(judgement==='grounded'?'grounded':'cautious'):judgement==='beyond'&&key!=='research'?'beyond':'ok']}
function epilogue(storyId,choice,judgement){const [key,variant]=epilogueKey(choice,judgement);return storyOf(storyId).epilogues[key][variant]}
module.exports={STORIES,DEFAULT_STORY,LEVELS:BASE.levels,TOOLS:BASE.tools,VERDICT_OPTIONS:BASE.verdict.options,CHAMBER_IDS:['necessity',...TOPICS.map(t=>t.id)],ARENA_LEVEL,storyOf,content,levelOf,epilogue,epilogueKey};
