// Validate real parsing, answer oracles, delayed transfer and persistence boundaries.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({Date,Intl});
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
vm.runInContext(source('src/app.js').split('/* UI */')[0],context);
for(const file of ['src/answer-formats.js','src/bank-pedagogy.js','src/bank-evidence.js','src/learning-content.js','src/learning-path.js','src/work-runner.js'])vm.runInContext(source(file),context,{filename:file});
const L=context.MathLearningPath,C=context.MathLearningContent,R=context.MathWorkRunner,checker=context.checkAnswer;
const json=value=>JSON.parse(JSON.stringify(value));
const time='2026-11-01T09:00:00.000Z',at=days=>new Date(Date.parse(time)+days*86400000).toISOString();
const opts={grade:8,level:'basic',now:at(40),checker};
let checks=0;
function test(condition,message){checks++;assert.ok(condition,message);}
function equal(actual,expected,message){checks++;assert.deepEqual(json(actual),json(expected),message);}
const expected={
 'domain-denominator':6/2,'domain-cancellation':[],'domain-finite-check':[-2,0,2,4].filter(x=>x*x-4!==0).length,
 'domain-radical-bound':Math.ceil(7/3),'domain-root-denominator':Math.floor(4)+1,'domain-root-finite':[-1,0,1,4].filter(x=>x>=0&&x!==1).length,
 'inequality-negative':Array.from({length:30},(_,i)=>i-20).filter(x=>-3*x>12).at(-1),'inequality-count':[-2,-1,0,1,2,3,4].filter(x=>2*(x-1)<=x+1).length,'inequality-boundary':Array.from({length:30},(_,i)=>i-20).filter(x=>5-2*x>=11).at(-1),
 'percent-successive':1000*1.2*.8,'percent-reverse':1700/.85,'percent-compare':(12-8)/8*100,
 'roots-extraneous':Array.from({length:20},(_,i)=>i-6).filter(x=>x+6>=0&&Math.sqrt(x+6)===x),'roots-no-solution':Array.from({length:20},(_,i)=>i-5).filter(x=>x+5>=0&&Math.sqrt(x+5)===-2),'roots-denominator':Array.from({length:20},(_,i)=>i-8).filter(x=>x!==2&&(x*x-4)/(x-2)===5),
 'conditional-subgroup':3/12,'conditional-without-replacement':(3-1)/(5-1),'conditional-table':6/18,
 'project-tariff-cost':200+4*50,'project-tariff-equality':(500-200)/(4-2),'project-tariff-savings':(200+4*180)-(500+2*180),
 'project-repair-boxes':Math.ceil(4*3*1.05/1.5),'project-repair-budget':9*900*.9+600,'project-repair-paint':(2*(4+3)*2.5-2-3)*2/6,
 'project-survey-mean':(4*10+8*20+4*30)/(4+8+4),'project-survey-median':[12,25,10,18,60].sort((a,b)=>a-b)[2],'project-survey-share':(7+4)*100/20
};
test(C.lessons.length===6&&C.projects.length===3&&C.tasks.length===27,'complete lessons and project practices are available');
test(new Set(C.tasks.map(q=>q.id)).size===C.tasks.length,'content IDs are unique');
for(const q of C.tasks){
 equal(q.answer,expected[q.id.replace('learning-','')],'independent mathematical oracle: '+q.id);
 test(q.family&&q.skills.length&&q.skills.every(id=>context.MathBankPedagogy.definitions.some(item=>item.id===id)),'valid explicit skill/family metadata: '+q.id);
 test(q.prompt&&q.solution&&q.hint&&Number.isInteger(q.grade)&&Object.hasOwn(q,'level'),'complete authored task: '+q.id);
 test(checker(q.display,q).correct,'actual app accepts displayed exact answer: '+q.id);
 test(!checker('999999999',q).correct,'incorrect answer rejected: '+q.id);
}
for(const lesson of C.lessons){
 test(lesson.example.steps.length>=4&&lesson.error&&lesson.transfer&&lesson.practiceIds.every(id=>C.tasks.some(q=>q.id===id)),'substantive lesson and existing practice: '+lesson.id);test(C.renderLesson(lesson.id).includes('learning-lesson-practice'),'lesson can launch practice');
 const markup=C.renderLesson(lesson.id);test(markup.includes('<svg')&&markup.includes('viewBox="0 0 480 240"')&&markup.includes('role="img"')&&markup.includes('<title')&&markup.includes('<desc')&&markup.includes('<figcaption>'),'every lesson has a responsive, accessible explanatory diagram: '+lesson.id);
}
for(const project of C.projects)test(project.practiceIds.length===3&&C.renderProject(project.id).includes('learning-project-practice'),'complete project: '+project.id);
const fixture=Array.from({length:10},(_,i)=>({id:'fixture-'+i,grade:8,level:'basic',skills:['domain'],family:i===1?'family:0':'family:'+i,kind:'number',difficulty:'Базовый',prompt:'Чему равно '+i+'?',answer:i,display:String(i),solution:String(i)}));
fixture.push({...fixture[0],id:'other-level',grade:10,level:'advanced',family:'advanced'});
function activity(id,day,taskId,answer,extra={}){return {id,kind:'practice',completed:true,grade:8,level:'basic',at:at(day),results:[{id:taskId,answer:String(answer),submitted:true,...extra}]};}
let state=L.emptyState(),before=JSON.stringify(state);
state=L.recordActivity(state,activity('a',0,'fixture-0',0),fixture,opts);
test(before===JSON.stringify(L.emptyState()),'recording does not mutate initial state');
equal(state,L.recordActivity(state,activity('a',1,'fixture-2',2),fixture,opts),'duplicate completion is idempotent');
let p=L.profile(state,fixture,{...opts,now:at(.5)})[0];test(p.streak===1&&!p.due&&!p.mastered&&p.dueAt===at(1),'first independent evidence schedules one day');
let review=L.createReview(fixture,state,{...opts,now:at(.5)});test(!review.work.ids.length,'review is not available before its due time');
review=L.createReview(fixture,state,{...opts,now:at(1),count:3});test(review.work.ids.length===3&&!review.work.ids.includes('fixture-0')&&!review.work.ids.includes('fixture-1'),'review excludes used tasks and the entire used family');
test(new Set(review.work.ids.map(id=>fixture.find(q=>q.id===id).family)).size===3,'review spans unique new families');
state=L.recordActivity(state,activity('same-day',.25,'fixture-2',2),fixture,opts);p=L.profile(state,fixture,opts)[0];test(p.streak===1,'multiple same-day successes do not establish a retained skill');
state=L.recordActivity(state,activity('b',1,'fixture-3',3),fixture,opts);p=L.profile(state,fixture,{...opts,now:at(1)})[0];test(p.streak===2&&p.dueAt===at(4),'second spaced success schedules three days');
state=L.recordActivity(state,activity('c',4,'fixture-4',4),fixture,opts);p=L.profile(state,fixture,{...opts,now:at(4)})[0];test(p.streak===3&&p.mastered&&p.dueAt===at(11),'third independent spaced family establishes skill and schedules seven days');
state=L.recordActivity(state,activity('wrong',12,'fixture-5',999),fixture,opts);p=L.profile(state,fixture,opts)[0];test(p.status==='practice'&&p.streak===0&&!p.mastered,'a new error resets retention evidence');
test(L.recommendations(state,fixture,opts)[0].skillId==='domain','new error produces a skill recommendation');
const claimed=json(state);claimed.events.at(-1).results[0].status='correct';claimed.events.at(-1).results[0].independent=true;
test(L.sanitizeState(claimed,fixture,opts).events.at(-1).results[0].status==='incorrect','saved claimed correctness is independently rechecked');
const hinted=L.recordActivity(L.emptyState(),activity('hint',0,'fixture-0',0,{hintBeforeAnswer:true}),fixture,opts);p=L.profile(hinted,fixture,opts)[0];test(p.independent===0&&p.streak===0&&p.lastStatus==='supported','hints never establish independent mastery');
const changed=fixture.map(q=>q.id==='fixture-0'?{...q,prompt:'Updated question',answer:20}:q),stale=L.sanitizeState(hinted,changed,opts);test(stale.events[0].results[0].status==='updated','content changes invalidate old correctness');
test(L.sanitizeState(stale,changed,opts).events[0].results[0].status==='updated','old-version invalidation survives another reload');

const legacyQuestion=fixture[0];let legacyNumber=2166136261;for(const character of JSON.stringify([legacyQuestion.prompt,legacyQuestion.answer,legacyQuestion.answers,legacyQuestion.kind,legacyQuestion.answerKind])){legacyNumber^=character.charCodeAt(0);legacyNumber=Math.imul(legacyNumber,16777619);}
const legacyEvent={version:1,events:[{id:'legacy-hash-migration',at:at(0),grade:8,level:'basic',kind:'practice',results:[{id:legacyQuestion.id,answer:String(legacyQuestion.answer),submitted:true,contentHash:'local-'+(legacyNumber>>>0).toString(16),hintBeforeAnswer:false,solutionBeforeAnswer:false}]}]};
const migrated=L.sanitizeState(legacyEvent,fixture,opts);
test(migrated.events[0].results[0].status==='correct','an unchanged legacy FNV learning record remains correct');
equal(migrated.events[0].results[0].contentHash,context.MathBankEvidence.version(legacyQuestion).contentHash,'legacy learning content identity upgrades to the shared SHA identity');
test(L.sanitizeState(legacyEvent,changed,opts).events[0].results[0].status==='updated','a changed question cannot reuse a legacy learning success');

equal(L.sanitizeState({version:1,events:[{...activity('future',41,'fixture-0',0),at:at(41)}]},fixture,opts).events,[],'future-dated events are rejected');
const exhausted=L.createReview(fixture.slice(0,2),L.recordActivity(L.emptyState(),activity('only',0,'fixture-0',0),fixture.slice(0,2),opts),opts);test(!exhausted.work.ids.length&&exhausted.message.includes('закончились'),'family exhaustion is reported without silently repeating a family');
const transition=JSON.parse(source('src/method-bank/bank.json')).tasks.find(q=>q.id==='methods-percent-07');
const priorPercent={...fixture[0],id:'prior-percent',grade:6,skills:['percent']};
const nextPercent={...priorPercent,id:'next-percent',family:'new-percent',skills:['percent','fractions']};
const percentCatalog=[priorPercent,nextPercent,transition],percentOptions={...opts,grade:6,now:at(1),count:1};
const percentHistory=L.recordActivity(L.emptyState(),{...activity('percent-start',0,priorPercent.id,0),grade:6},percentCatalog,percentOptions);
const percentReview=L.createReview(percentCatalog,percentHistory,percentOptions);
equal(percentReview.work.ids,[transition.id],'due review prefers a transition for the due skill over an incidental new skill');
equal(percentReview.representationCount,1,'review identifies the selected transition');
test(L.render(percentHistory,percentCatalog,percentOptions).includes('В сегодняшней подборке есть задания на переход'), 'route previews the transition when the methods bank is available');
equal(L.createReview(percentCatalog,percentHistory,{...percentOptions,now:at(.5)}).work.ids,[],'transition does not bypass the due date');
equal(L.createSkillWork(percentCatalog,percentHistory,{...percentOptions,skillIds:['percent']}).work.ids,[nextPercent.id],'regular practice does not prefer representation transitions');
const sameFamily=[priorPercent,nextPercent,{...transition,family:priorPercent.family}];
equal(L.createReview(sameFamily,percentHistory,percentOptions).work.ids,[nextPercent.id],'transition cannot bypass the used-family exclusion');
const unloaded=L.createReview([priorPercent],percentHistory,percentOptions);
test(unloaded.representationCount===0&&!unloaded.work.ids.length&&unloaded.skillIds.includes('percent'),'a due skill remains discoverable while a new family is unavailable');
const transitionRun=R.createSession(percentReview.work,percentCatalog,{id:'transition-run',now:at(1)});
R.setDraft(transitionRun,'a-3;b-1;c-2');R.finish(transitionRun,percentCatalog,checker,{now:at(1)});
const reviewedPercent=L.recordSession(percentHistory,transitionRun,percentCatalog,{...percentOptions,kind:'review'});
const percentProgress=L.profile(reviewedPercent,percentCatalog,percentOptions).find(row=>row.id==='percent');
test(percentProgress.streak===2&&percentProgress.dueAt===at(4),'real transition answer uses the same independent evidence and interval');
equal(L.createReview(percentCatalog,reviewedPercent,{...percentOptions,now:at(4)}).work.ids,[nextPercent.id],'completed transition is not repeated when a regular new family remains');
let session=R.createSession({title:'Transfer',ids:['fixture-0','fixture-2']},fixture,{id:'runner-test',now:time});
R.setDraft(session,'0');R.submit(session,fixture,checker);R.go(session,1);R.setDraft(session,'2');R.finish(session,fixture,checker);
state=L.recordSession(L.emptyState(),session,fixture,{...opts,now:time,kind:'diagnostic'});test(state.events.length===1&&state.events[0].results.every(r=>r.independent),'real work runner completion enters learning history');
equal(state,L.recordSession(state,session,fixture,{...opts,now:time,kind:'diagnostic'}),'runner completion cannot be counted twice');
test(!L.recordSession(L.emptyState(),{...session,phase:'solving'},fixture,opts).events.length,'unfinished sessions are not counted');
const diagnostic=L.createDiagnostic(fixture,L.emptyState(),{...opts,count:8});test(diagnostic.work.ids.length===8&&!diagnostic.work.ids.includes('other-level'),'diagnostic uses requested grade and programme only');
const allClasses=[];
for(let g=5;g<=11;g++)for(const topic of JSON.parse(source('src/tasks/grade_'+String(g).padStart(2,'0')+'.json')))for(const q of topic.tasks)allClasses.push({...q,grade:topic.grade,level:topic.level||'basic',topicId:topic.id});
for(let g=5;g<=11;g++)for(const programme of g>=10?['basic','advanced']:['basic']){
 const result=L.createDiagnostic(allClasses,L.emptyState(),{grade:g,level:programme,now:time,count:8});test(result.work.ids.length===8,'full bank diagnostic available: '+g+'/'+programme);
 test(result.work.ids.every(id=>{const q=allClasses.find(q=>q.id===id);return q.grade===g&&(g<10||q.level===programme);}), 'diagnostic does not cross programme boundaries');
}
test(L.render(state,fixture,{...opts,now:at(1)}).includes('learning-diagnostic'),'route UI renders action controls');
const upper=fixture.map(q=>({...q,id:'upper-'+q.id,grade:11,level:'basic',family:'upper:'+q.family})),bridgeCatalog=[...fixture,...upper],bridgeActivity={...activity('bridge',0,'fixture-0',0),kind:'lesson',grade:11,level:'basic'};
const bridge=L.recordActivity(L.emptyState(),bridgeActivity,bridgeCatalog,opts),bridgeOptions={grade:11,level:'basic',now:at(.5),checker};
p=L.profile(bridge,bridgeCatalog,bridgeOptions)[0];test(p.foundationIndependent===1&&p.independent===0&&!p.mastered&&p.status==='foundation','lower-grade lesson is explicitly foundational evidence and awards no upper-grade mastery');
test(L.recommendations(bridge,bridgeCatalog,bridgeOptions).some(item=>item.reason.includes('11 класса')),'foundation completion recommends applying the skill in the selected grade');
const bridgeReview=L.createReview(bridgeCatalog,bridge,{...bridgeOptions,now:at(1)});test(bridgeReview.work.ids.length&&bridgeReview.work.ids.every(id=>id.startsWith('upper-')),'foundation review transfers to new tasks of the selected upper grade');
test(L.render(bridge,bridgeCatalog,bridgeOptions).includes('базовая практика: 1 из 1 верно'),'foundation results are visibly distinguished in skill map');
test(!L.profile(bridge,bridgeCatalog,{...bridgeOptions,level:'advanced'}).some(row=>row.foundationAt),'foundation evidence is scoped to the selected programme');
const invalidMixed=L.recordActivity(L.emptyState(),{...bridgeActivity,id:'mixed-not-lesson',kind:'practice'},bridgeCatalog,opts);test(!L.profile(invalidMixed,bridgeCatalog,bridgeOptions)[0].foundationAt,'an arbitrary mixed-grade practice is not presented as authored foundational learning');
const report={status:'passed',checks,tasks:C.tasks.length,lessons:C.lessons.length,projects:C.projects.length,scope:'Exact answer oracles, real parser and runner, delayed family transfer, sanitization, programme boundaries, and complete lesson content.'};
fs.writeFileSync(path.join(root,'checks/learning-path-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
