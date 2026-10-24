// Pure regression checks for imported/local state and balanced work variants.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const page=require('./load_page.cjs').loadPage(root),{BANK:bank}=page.dataValues();
const context={BANK:bank};vm.createContext(context);
vm.runInContext(page.sourceFor('src/app.js').split('/* UI */')[0],context);
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const run=(label,callback)=>{try{callback();}catch(error){test(false,label+': '+error.message);}};
for(const name of ['sanitizeWork','generateVariant','classifyAttempt','sanitizeRecord','safeRoute'])test(typeof context[name]==='function','helper available: '+name);
const tasks=[
 {id:'a',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'b',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'c',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'d',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'hard',topicId:'6-topic',grade:6,level:'basic',difficulty:'Повышенный',kind:'number'},
 {id:'set',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'set'},
 {id:'open',topicId:'6-topic',grade:6,level:'basic',difficulty:'Базовый',kind:'open'},
 {id:'other-topic',topicId:'6-other',grade:6,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'other-grade',topicId:'7-topic',grade:7,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'upper-basic',topicId:'10-basic',grade:10,level:'basic',difficulty:'Базовый',kind:'number'},
 {id:'upper-advanced',topicId:'10-advanced',grade:10,level:'advanced',difficulty:'Базовый',kind:'number'}
];
run('work validation',()=>{
 for(const raw of [null,undefined,42,'damaged',[],{}]){
  const clean=context.sanitizeWork(raw,tasks,6,'basic');
  test(same(clean.ids,[]),'damaged work has no task IDs: '+String(raw));
  test(clean.title==='Самостоятельная работа'&&clean.variant==='1'&&clean.answers===false,'damaged work uses defaults: '+String(raw));
 }
 const raw={ids:['b','a','b','missing','other-grade','upper-basic',null,17],title:'  Дроби  ',variant:'  Б  ',answers:true};
 const snapshot=JSON.stringify(raw),clean=context.sanitizeWork(raw,tasks,6,'basic');
 test(same(clean.ids,['b','a']),'work keeps order while rejecting duplicates and foreign grade');
 test(clean.title==='Дроби'&&clean.variant==='Б'&&clean.answers===true,'work preserves trimmed metadata');
 test(JSON.stringify(raw)===snapshot,'work sanitizer does not mutate imported input');
 test(same(context.sanitizeWork({ids:['upper-basic','upper-advanced']},tasks,10,'advanced').ids,['upper-advanced']),'work cannot import another programme');
 const longTasks=Array.from({length:30},(_,i)=>({...tasks[0],id:'long-'+i}));
 const long=context.sanitizeWork({ids:longTasks.map(q=>q.id),title:'я'.repeat(100),variant:'в'.repeat(100),answers:'false'},longTasks,6,'basic');
 test(long.ids.length===24&&new Set(long.ids).size===24,'work enforces the 24 task limit');
 test(long.title.length===70&&long.variant.length===20,'work bounds title and variant');
 test(long.answers===false,'string from imported JSON cannot enable answer key');
 const empty=context.sanitizeWork({title:'  ',variant:'  '},tasks,6,'basic');
 test(empty.title==='Самостоятельная работа'&&empty.variant==='1','blank work metadata uses defaults');
 test(context.sanitizeWork({seed:'  урок-6  '},tasks,6,'basic').seed==='урок-6','work preserves the reproducible variant key');
 test(context.sanitizeWork({seed:'я'.repeat(100)},tasks,6,'basic').seed.length===40,'work bounds the variant key');
 test(context.sanitizeWork({seed:'   '},tasks,6,'basic').seed==='1430','blank variant key uses the default');
});
run('equivalent variants',()=>{
 const source=['a','b','hard','set','open','other-topic'];
 const sourceSnapshot=JSON.stringify(source),tasksSnapshot=JSON.stringify(tasks);
 const result=context.generateVariant(source,tasks,'lesson-1');
 test(result.length===source.length,'variant preserves work length');
 test(new Set(result).size===result.length,'variant contains no duplicate task IDs');
 test(same(result,context.generateVariant(source,tasks,'lesson-1')),'variant is deterministic for the same seed');
 result.forEach((id,i)=>{
  const q=tasks.find(q=>q.id===id),original=tasks.find(q=>q.id===source[i]);
  test(!!q&&q.topicId===original.topicId&&q.difficulty===original.difficulty&&q.kind===original.kind,'variant preserves topic, difficulty and answer format for '+source[i]);
 });
 test(!source.includes(result[0])&&!source.includes(result[1]),'variant prefers unused replacements when available');
 test(result[2]==='hard'&&result[3]==='set'&&result[4]==='open','exhausted pools retain original task and format');
 const excluded=context.generateVariant(['a'],tasks,'lesson-1',['b','c']);
 test(same(excluded,['d']),'variant excludes IDs already used in another version');
 test(same(context.generateVariant(['a'],tasks,'lesson-1',['b','c','d']),['a']),'variant falls back safely when every replacement is excluded');
 test(new Set(Array.from({length:12},(_,i)=>context.generateVariant(['a'],tasks,'seed-'+i)[0])).size>1,'different seeds can create different variants');
 const invalid=context.generateVariant(['missing','a','a',null],tasks,'seed');
 test(invalid.length===1&&tasks.some(q=>q.id===invalid[0]),'variant drops unknown and duplicate source IDs');
 test(same(context.generateVariant([],tasks,'seed'),[]),'empty work makes an empty variant');
 test(JSON.stringify(source)===sourceSnapshot&&JSON.stringify(tasks)===tasksSnapshot,'variant generation does not mutate the work or bank');
});
run('saved attempt validation',()=>{
 for(const raw of [null,undefined,42,'damaged',[],{}]){
  const r=context.sanitizeRecord(raw);
  test(r.draft===''&&r.tries===0&&r.correct===false&&r.revealed===false&&r.hintLevel===0,'damaged attempt uses safe defaults: '+String(raw));
  test(r.feedback===''&&r.everWrong===false&&same(r.checks,[]),'damaged attempt has no fabricated result: '+String(raw));
 }
 const raw={draft:'решение',tries:3,correct:true,revealed:false,hintLevel:1,feedback:'correct',everWrong:true,outcome:'hinted',checks:[true,false,true]};
 const snapshot=JSON.stringify(raw),r=context.sanitizeRecord(raw);
 for(const key of Object.keys(raw))test(same(r[key],raw[key]),'valid attempt preserves '+key);
 test(JSON.stringify(raw)===snapshot,'attempt sanitizer does not mutate saved input');
 const bounded=context.sanitizeRecord({draft:'я'.repeat(5000),tries:50000,hintLevel:50,feedback:'<script>',correct:'true',revealed:'false',everWrong:'false',outcome:'independent',checks:Array(30).fill(true)});
 test(bounded.draft.length===4000,'attempt bounds saved solution length');
 test(Number.isInteger(bounded.tries)&&bounded.tries>=0&&bounded.tries<=10000,'attempt bounds try count');
 test(Number.isInteger(bounded.hintLevel)&&bounded.hintLevel>=0&&bounded.hintLevel<=2,'attempt bounds staged help level');
 test(bounded.feedback===''&&bounded.correct===false&&bounded.revealed===false&&bounded.everWrong===false,'untrusted strings cannot fabricate feedback or status');
 test(!bounded.outcome,'incomplete attempt cannot retain a successful outcome');
 test(Array.isArray(bounded.checks)&&bounded.checks.length<=10&&bounded.checks.every(v=>typeof v==='boolean'),'self-checks are bounded booleans');
 for(const value of [-9,1.5,Infinity,NaN,'5',{},null]){
  const invalid=context.sanitizeRecord({tries:value,hintLevel:value});
  test(Number.isInteger(invalid.tries)&&invalid.tries>=0&&invalid.tries<=10000,'invalid try count normalized: '+String(value));
  test(Number.isInteger(invalid.hintLevel)&&invalid.hintLevel>=0&&invalid.hintLevel<=2,'invalid help level normalized: '+String(value));
 }
 for(const feedback of ['','format','wrong','correct','self'])test(context.sanitizeRecord({feedback}).feedback===feedback,'known feedback preserved: '+feedback);
 for(const outcome of ['independent','hinted','explained'])test(context.sanitizeRecord({correct:true,outcome}).outcome===outcome,'known outcome preserved: '+outcome);
});
run('learning result classification',()=>{
 test(context.classifyAttempt({correct:false,revealed:true,hintLevel:2,outcome:'explained'})==='pending','unresolved remains pending after assistance');
 test(context.classifyAttempt({correct:true})==='independent','correct without help is independent');
 test(context.classifyAttempt({correct:true,hintLevel:1})==='hinted','correct after hint is assisted');
 test(context.classifyAttempt({correct:true,hintLevel:2})==='hinted','correct after first step is assisted');
 test(context.classifyAttempt({correct:true,revealed:true,hintLevel:2})==='explained','viewed solution has priority over hint');
 test(context.classifyAttempt({correct:true,revealed:true,outcome:'independent'})==='independent','later review does not rewrite how a task was solved');
 test(context.classifyAttempt({correct:true,outcome:'forged',hintLevel:1})==='hinted','unknown outcome falls back to actual assistance');
});
run('restored navigation',()=>{
 const topics=[...new Set(tasks.map(q=>q.topicId))].map(id=>{
  const qs=tasks.filter(q=>q.topicId===id);return {id,grade:qs[0].grade,level:qs[0].level,tasks:qs};
 });
 const base={view:'train',role:'student',grade:6,level:'basic',topic:'6-topic',index:0,difficulty:'all'};
 for(const raw of [null,undefined,42,'damaged',[],{}, {...base,role:'administrator'}])test(context.safeRoute(raw,topics).view==='home','invalid role returns to welcome: '+String(raw));
 const restored=context.safeRoute(base,topics);
 test(restored.view==='train'&&restored.role==='student'&&restored.grade===6&&restored.topic==='6-topic','valid saved lesson restores');
 test(context.safeRoute({...base,view:'<script>'},topics).view!=='<script>','unknown view is never restored');
 test(context.safeRoute({...base,grade:99},topics).view==='classes','unknown grade returns to class selection');
 test(context.safeRoute({...base,grade:10,level:'invalid'},topics).view==='levels','upper school requires a valid programme');
 for(const view of ['train','result']){
  test(context.safeRoute({...base,view,topic:'missing'},topics).view==='topics','unknown topic returns to list for '+view);
  test(context.safeRoute({...base,view,topic:'7-topic'},topics).view==='topics','another grade topic cannot restore for '+view);
 }
 const high=context.safeRoute({...base,index:999},topics);
 test(high.index===6,'saved task index is clamped to the current topic');
 test(context.safeRoute({...base,index:-5},topics).index===0,'negative saved index becomes zero');
 test(context.safeRoute({...base,index:Infinity},topics).index===0,'nonfinite saved index becomes zero');
 const filtered=context.safeRoute({...base,difficulty:'Повышенный',index:99},topics);
 test(filtered.difficulty==='Повышенный'&&filtered.index===0,'index is clamped after difficulty filtering');
 test(context.safeRoute({...base,difficulty:'unknown'},topics).difficulty==='all','unknown difficulty resets to all');
 const retry=context.safeRoute({...base,taskIds:['a','missing','a','other-grade','other-topic'],index:99},topics);
 test(!retry.taskIds||same(retry.taskIds,['a']),'retry subset rejects duplicates, unknown IDs and foreign topics');
 test(retry.index===0,'retry subset index is clamped');
});
const report={checks,errors};
fs.writeFileSync(path.join(root,'checks/features-results.json'),JSON.stringify(report,null,2));
console.log(report);if(errors.length)process.exitCode=1;
