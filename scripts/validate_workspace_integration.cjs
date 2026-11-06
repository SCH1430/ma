// Execute actual app handlers for restoration, transfer, reports and learning.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness,BANK,EXAM_BANK,QUALITY_BANK,METHOD_BANK,KEY}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..'),all=BANK.flatMap(topic=>topic.tasks.map(q=>({...q,grade:topic.grade,level:topic.level||'basic',topicId:topic.id}))),first=all.find(q=>q.kind==='number'),open=all.find(q=>q.kind==='open');
const json=value=>JSON.parse(JSON.stringify(value));
let checks=0;const failures=[];
const test=(condition,message)=>{checks++;assert.ok(condition,message);};
const equal=(actual,expected,message)=>{checks++;assert.deepEqual(json(actual),json(expected),message);};
const scenario=async(name,run)=>{try{await run();}catch(error){failures.push(name+': '+error.stack);}};
const work=h=>h.state().works.find(([key])=>key==='unified')[1];
const attempt=(h,id)=>h.state().attempts.find(([key])=>key.endsWith(':'+id))?.[1];
const download=async(h,index=-1)=>{const file=h.document.downloads.at(index);test(!!file,'a file is handed to the browser');return {name:file.name,text:await h.blobs.get(file.url).text()};};
async function files(h,selector,items){const element=h.get(selector);element.files=items.map(item=>{const text=typeof item.value==='string'?item.value:JSON.stringify(item.value);return {name:item.name||'copy.json',size:Buffer.byteLength(text),text:async()=>text};});await h.document.dispatch('change',element);await Promise.resolve();await Promise.resolve();}
async function teacher(h){await h.click('[data-role="teacher"]');}
const base=()=>({version:2,student:{id:'',first:'',last:'',letter:'',grade:0},attempts:[],works:[['unified',{title:'Моя исходная работа',variant:'1',ids:[first.id],answers:false}]],library:[],favorites:[],bankTools:{notes:{},templates:[]},trainingSessions:[],resumeRoute:{view:'classes',role:'teacher'}});
(async()=>{
 await scenario('malformed saves stay recoverable',async()=>{
  for(const original of ['{"version":2,"attempts":','null','{"version":999,"attempts":[]}']){
   const store=new Map([[KEY,original]]),h=createHarness(store);await teacher(h);h.flush();
   test(store.get(KEY)===original,'unreadable or unsupported save is never overwritten by entering the app');
   test(h.text().includes('защищено от перезаписи'),'storage protection is visible');
   await h.click('[data-action="backup-home"]');await h.click('[data-action="backup-original"]');
   test((await download(h)).text===original,'original bytes can be recovered through backup UI');
   await h.click('[data-action="home"]');h.flush();test(store.get(KEY)===original,'navigation cannot overwrite protected bytes');
  }
 });
 await scenario('large valid saves survive app restoration',async()=>{
  const saved=base();saved.attempts=all.slice(0,1100).map(q=>['teacher:'+q.id,{draft:'я'.repeat(4000),tries:1,correct:false}]);
  const raw=JSON.stringify(saved);test(raw.length>4*1024*1024,'fixture exceeds former four-megabyte text threshold');
  const store=new Map([[KEY,raw]]),h=createHarness(store);await teacher(h);h.flush();
  const restored=h.state();test(restored.attempts.length===1100,'every retained large-save attempt survives restore and autosave');
  test(restored.attempts.every(([,record])=>record.draft.length===4000),'large drafts are not silently truncated beyond field limits');
  await h.click('[data-action="backup-home"]');await h.click('[data-action="backup-export"]');
  const exported=JSON.parse((await download(h)).text);test(exported.format==='baza-workspace-backup'&&exported.workspace.attempts.length===1100,'large full-workspace backup includes all attempts');
  const again=createHarness(new Map([[KEY,JSON.stringify(exported.workspace)]]));await teacher(again);test(again.state().attempts.length===1100,'large exported workspace restores again');
 });
 await scenario('exam reveal preserves earlier independent outcome and exposes neighbours',async()=>{
  const h=createHarness();await teacher(h);await h.click('[data-action="nav-catalog"]');await h.change('#exam-year','2026');
  const exam=EXAM_BANK.find(item=>item.id==='oge'&&item.year===2026),one=exam.tasks[0].examples?.[0]||exam.tasks[0],two=exam.tasks[1].examples?.[0]||exam.tasks[1];
  await h.click('[data-action="exam-start"][data-exam="oge"]');
  await h.input('#exam-answer',one.answerText);await h.submit('#exam-answer-form');test(attempt(h,one.id).outcome==='independent','correct answer before key disclosure is independent');
  await h.click('[data-action="exam-references"]');test(attempt(h,one.id).revealed&&attempt(h,one.id).outcome==='independent','later review does not rewrite existing independent evidence');
  test(attempt(h,two.id)?.revealed===true,'opening a shared key marks the neighbouring exposed answer');
  await h.click('[data-action="exam-task"][data-index="1"]');await h.input('#exam-answer',two.answerText);await h.submit('#exam-answer-form');
  test(attempt(h,two.id).outcome==='explained','an answer solved after neighbouring key disclosure is explained');
  const restored=createHarness(h.store);await restored.click('[data-action="resume"]');
  test(attempt(restored,one.id).outcome==='independent'&&attempt(restored,two.id).outcome==='explained','both provenance states survive a reload');
 });
 await scenario('backup preview, cancel, confirmation and safety download',async()=>{
  let reloads=0;const store=new Map([[KEY,JSON.stringify(base())]]),h=createHarness(store,{setupDOM(document,window){window.location={reload(){reloads++;}};}});
  await teacher(h);await h.click('[data-action="backup-home"]');await h.click('[data-action="backup-import"]');test(h.document.filePickerOpened,'backup import opens native file picker');
  const incoming=base();incoming.works[0][1].title='Восстановленная работа';incoming.favorites=[first.id];
  const copy=h.context.MathWorkspaceTransfer.create(incoming);
  await files(h,'#backup-file',[{name:'class-backup.json',value:copy}]);
  test(!!h.document.querySelector('#backup-preview')&&h.text().includes('class-backup.json'),'valid copy shows a reviewable preview');
  test(work(h).title==='Моя исходная работа'&&reloads===0,'preview does not replace current workspace');
  await h.click('[data-action="backup-cancel"]');test(!h.document.querySelector('#backup-preview')&&work(h).title==='Моя исходная работа','cancel leaves the existing workspace');
  await files(h,'#backup-file',[{value:'{broken'}]);test(!h.document.querySelector('#backup-preview')&&work(h).title==='Моя исходная работа','invalid JSON cannot replace the workspace');
  const unknown=json(copy);unknown.workspace.works[0][1].ids=['missing-task-not-in-this-bank'];const protectedBytes=store.get(KEY);
  await files(h,'#backup-file',[{name:'unknown-ids.json',value:unknown}]);
  test(!h.document.querySelector('#backup-preview')&&store.get(KEY)===protectedBytes,'a correctly formatted backup with unknown task IDs is rejected before preview without changing stored bytes');
  await files(h,'#backup-file',[{value:copy}]);await h.click('[data-action="backup-confirm"]');
  test(reloads===1&&JSON.parse(store.get(KEY)).works[0][1].title==='Восстановленная работа','explicit confirmation saves imported workspace and reloads');
  const previous=await download(h);test(previous.name==='baza-before-restore.json'&&JSON.parse(previous.text).workspace.works[0][1].title==='Моя исходная работа','the previous complete workspace is handed to the browser before replacement');
  const restored=createHarness(store);await teacher(restored);test(work(restored).title==='Восстановленная работа'&&restored.state().favorites.includes(first.id),'confirmed copy passes actual application restore');
 });
 await scenario('teacher report file flow, deduplication and export',async()=>{
  const h=createHarness();await teacher(h);await h.click('[data-action="report-home"]');await h.click('[data-action="report-import"]');test(h.document.filePickerOpened,'report import opens file picker');
  const result=(id,status)=>({format:'baza-work-results',version:1,sessionId:id,title:'Проверка сводки',variant:'1',finished:true,learner:{name:id==='ui-a'?'Аня':'Боря'},tasks:[{id:first.id,kind:'number',status},{id:open.id,kind:'open',status:id==='ui-a'?'reviewed':'awaiting-review'}]});
  await files(h,'#report-files',[{name:'anya.json',value:result('ui-a','correct')},{name:'boris.json',value:result('ui-b','incorrect')},{name:'broken.json',value:'{broken'}]);
  test(h.state().teacherReports.length===2,'valid result files are imported even when another file is invalid');
  test(h.text().includes('верно 1 из 2')&&h.text().includes('сверено 1 из 2'),'short answers and self-reviewed reasoning have separate denominators');
  test(h.text().includes('broken.json'),'invalid file is identified to the user');
  await files(h,'#report-files',[{name:'anya-updated.json',value:result('ui-a','incorrect')}]);
  test(h.state().teacherReports.length===2&&h.text().includes('верно 0 из 2'),'same session updates instead of double counting');
  await h.click('[data-action="report-export"]');const csv=await download(h);test(csv.name.endsWith('.csv')&&csv.text.includes('Аня')&&csv.text.includes('Боря'),'teacher can download the rendered class summary');
  const restored=createHarness(h.store);await restored.click('[data-action="resume"]');test(restored.state().teacherReports.length===2&&restored.text().includes('верно 0 из 2'),'report survives reload');
  await restored.click('[data-action="report-clear"]');test(restored.state().teacherReports.length===0&&!restored.document.querySelectorAll('caption').some(c=>c.textContent==='Прохождения учеников'),'clear removes all imported sessions and their table while keeping empty evidence/editorial guidance');
 });
 await scenario('teacher report creates and shares a separate worked example and practice',async()=>{
  let pdf;
  const store=new Map([[KEY,JSON.stringify(base())]]);
  const h=createHarness(store,{mobile:true,createMathPDF:async value=>{pdf=value;return new Uint8Array(Buffer.from('%PDF-capture'));}});
  await teacher(h);await h.click('[data-action="report-home"]');
  await files(h,'#report-files',[{value:{format:'baza-work-results',version:1,sessionId:'practice-source',tasks:[{id:'6-03-1',kind:'number',status:'incorrect'}]}}]);
  await h.click('[data-action="report-practice"][data-id="percent"]');
  const practice=work(h),catalog=new Map([...all,...QUALITY_BANK.tasks,...METHOD_BANK.tasks,...h.context.MathLearningContent.tasks].map(q=>[q.id,q]));
  test(h.state().resumeRoute.view==='builder'&&h.get('#work-panel').classList.contains('is-open'),'report opens the editable draft on a mobile screen');
  test(practice.ids.length>=2&&practice.ids.length<=3&&new Set(practice.ids.map(id=>catalog.get(id).family)).size===practice.ids.length,'practice contains two to three distinct families');
  test(practice.exampleId&&!practice.ids.includes(practice.exampleId)&&h.get('#work-panel').textContent.includes('Пример с разбором'),'worked example is separate from independent exercises');
  test(h.state().library.some(entry=>entry.title==='Моя исходная работа'&&entry.ids[0]===first.id),'earlier draft survives in the library');
  const references=h.context.MathWorkspaceTransfer.references(h.state());
  test(references.includes(practice.exampleId),'backup validates and loads the worked example');
  await h.click('[data-action="export-work"]');const exported=JSON.parse((await download(h)).text);
  test(exported.work.exampleId===practice.exampleId,'exported work includes the worked example');
  await h.click('[data-action="print-preview"]');
  test(h.get('.print-root').textContent.includes('Пример с разбором'),'browser print includes the worked example even without the key');
  await h.click('[data-action="download"]');
  test(pdf.example.id===practice.exampleId&&pdf.tasks.length===practice.ids.length&&!pdf.answers,'PDF receives the worked example separately from the teacher key');
  const student=createHarness();await student.click('[data-role="student"]');await student.click('[data-action="works-home"]');
  await files(student,'#import-file',[{value:exported}]);
  test(work(student).exampleId===practice.exampleId,'pupil can import the shared practice and worked example');
  await student.click('[data-action="run-work"]');
  test(student.get('.work-runner').textContent.includes('Пример с разбором'),'pupil can refer to the worked example during the practice');
  const run=student.state().activeRun;
  test(run.exampleId===practice.exampleId&&!Object.hasOwn(run.records,run.exampleId),'worked example has no answer record');
  const restored=createHarness(student.store);await restored.click('[data-action="resume-run"]');
  test(restored.state().activeRun.exampleId===practice.exampleId,'worked example survives a resumed work session');
  await restored.click('[data-action="run-finish"]');
  await restored.click('[data-action="run-export"]');
  equal(JSON.parse((await download(restored)).text).tasks.map(q=>q.id),practice.ids,'results only contain independent exercises');
 });
 await scenario('learning UI records completed practice and preserves state on reload',async()=>{
  const h=createHarness();await h.click('[data-role="student"]');await h.click('[data-action="learning-home"]');await h.change('#learning-grade','8');
  test(h.state().resumeRoute.view==='learning'&&h.state().resumeRoute.grade===8,'learning grade selection is persisted');
  await h.click('[data-action="learning-lesson"][data-lesson="domain-fractions"]');test(h.text().includes('ОДЗ')&&h.text().includes('Проверяем ошибочный способ'),'authored lesson is reachable');
  test(h.state().learningState.events.length===0,'reading explanation does not award mastery');
  await h.click('[data-action="learning-lesson-practice"]');
  const ids=[...h.state().activeRun.ids],content=h.context.MathLearningContent;
  test(ids.length===3&&h.state().learningRun.kind==='lesson','lesson launches an ordinary isolated work session with context');
  for(let index=0;index<ids.length;index++){
   const q=content.tasks.find(q=>q.id===ids[index]);await h.input('#work-run-answer',q.display);await h.submit('#work-run-answer-form');
   if(index<ids.length-1)await h.click('[data-action="run-next"]');
  }
  await h.click('[data-action="run-finish"]');
  test(h.state().learningState.events.length===1&&h.state().learningState.events[0].kind==='lesson','completed practice enters learning history once');
  test(h.state().learningState.events[0].results.every(result=>result.independent),'correct work answers become independent learning evidence');
  test(h.text().includes('Что решать дальше'),'completed work supplies next-step recommendations');
  const restored=createHarness(h.store);await restored.click('[data-action="resume"]');test(restored.state().learningState.events.length===1,'learning evidence survives reload without duplicate completion');
  await restored.click('[data-action="learning-home"]');test(restored.get('#learning-grade').value==='8','result recommendations return to the original grade');
  await restored.click('[data-action="learning-project"][data-project="tariffs"]');await restored.click('[data-action="learning-project-practice"]');
  test(restored.state().resumeRoute.view==='works'&&!!restored.document.querySelector('[data-action="replace-run"]'),'new project protects the existing results before replacing active work');
  await restored.click('[data-action="replace-run"]');test(restored.state().learningRun.kind==='project'&&restored.state().activeRun.ids.every(id=>content.tasks.find(q=>q.id===id)?.projectId==='tariffs'),'project context survives deferred replacement confirmation');
  await restored.click('[data-action="end-session"]');test(restored.state().learningState.events.length===0&&restored.state().learningRun===null,'changing pupil clears learning history and pending run ownership');
 });
 await scenario('diagnostic and delayed review run through app handlers',async()=>{
  let h=createHarness();await h.click('[data-role="student"]');await h.click('[data-action="learning-home"]');await h.change('#learning-grade','8');
  const catalog=[...all.map(q=>({...q,source:'class'})),...QUALITY_BANK.tasks,...METHOD_BANK.tasks,...h.context.MathLearningContent.tasks].map(q=>({...q,skills:h.context.MathBankPedagogy.forTask(q)})),candidates=catalog.filter(q=>q.grade===8&&q.family&&q.kind==='number'&&h.context.MathBankPedagogy.forTask(q).length);
  const original=candidates.find(q=>h.context.MathBankPedagogy.forTask(q).some(skill=>new Set(candidates.filter(other=>h.context.MathBankPedagogy.forTask(other).includes(skill)).map(other=>other.family)).size>=6));
  test(!!original,'real bank has transfer families for delayed review');
  const now=new Date().toISOString(),previous=new Date(Date.now()-8*86400000).toISOString(),saved=h.state();
  saved.learningState=h.context.MathLearningPath.recordActivity(h.context.MathLearningPath.emptyState(),{id:'integration-delayed-review',completed:true,kind:'practice',grade:8,level:'basic',at:previous,results:[{id:original.id,answer:original.display,submitted:true}]},catalog,{now,checker:h.context.checkAnswer});
  h.store.set(KEY,JSON.stringify(saved));h=createHarness(h.store);
  test(!h.get('.home-hero [data-action="learning-review"]').disabled,'Today offers due review directly after restoring real history');
  await h.click('.home-hero [data-action="learning-review"]');
  test(h.state().learningRun.kind==='review'&&h.state().activeRun.ids.length>0,'review action starts real work with review ownership');
  const selected=h.state().activeRun.ids.map(id=>catalog.find(q=>q.id===id));
  test(selected.every(q=>q&&q.family&&q.family!==original.family),'review handler selects new marked families rather than a used original family');
  test(new Set(selected.map(q=>q.family)).size===selected.length,'review work contains no repeated family');
  await h.click('[data-action="run-finish"]');test(h.state().learningState.events.length===2&&h.state().learningState.events.at(-1).kind==='review','review completion is persisted with its own kind');
  await h.click('[data-action="learning-home"]');await h.click('[data-action="learning-diagnostic"]');
  if(h.document.querySelector('[data-action="replace-run"]'))await h.click('[data-action="replace-run"]');
  test(h.state().learningRun.kind==='diagnostic'&&h.state().activeRun.ids.length===8,'diagnostic click creates eight real questions after replacement confirmation');
  test(h.state().activeRun.ids.every(id=>{const q=catalog.find(q=>q.id===id);return q?.grade===8&&q.kind!=='open'&&(['number','set','sequence'].includes(q.kind)||h.context.MathAnswerFormats.supports(q));}),'diagnostic handler keeps the selected grade and only automatically checkable answer formats');
  await h.click('[data-action="run-finish"]');test(h.state().learningState.events.length===3&&h.state().learningState.events.at(-1).kind==='diagnostic','diagnostic completion records skipped items without fabricated success');
  test(h.state().learningState.events.at(-1).results.every(result=>result.status==='unanswered'&&!result.independent),'skipped diagnostic answers award no independent result');
 });
 await scenario('older pupils receive explicit foundational evidence from earlier-grade lessons',async()=>{
  const h=createHarness();await h.click('[data-role="student"]');await h.click('[data-action="learning-home"]');await h.change('#learning-grade','11');
  await h.click('[data-action="learning-lesson"][data-lesson="domain-fractions"]');await h.click('[data-action="learning-lesson-practice"]');
  const content=h.context.MathLearningContent,ids=h.state().activeRun.ids;
  test(h.state().learningRun.grade===11&&ids.every(id=>content.tasks.find(q=>q.id===id).grade===8),'upper-grade route deliberately practices earlier-grade foundations without duplicating content IDs');
  for(let index=0;index<ids.length;index++){
   await h.input('#work-run-answer',content.tasks.find(q=>q.id===ids[index]).display);await h.submit('#work-run-answer-form');
   if(index<ids.length-1)await h.click('[data-action="run-next"]');
  }
  await h.click('[data-action="run-finish"]');
  test(h.state().learningState.events[0].grade===11,'lesson completion retains the route grade');
  test(h.text().includes('на заданиях 11 класса'),'next-step recommendation asks for transfer into the selected grade');
  await h.click('[data-action="learning-home"]');test(h.get('#learning-grade').value==='11'&&h.text().includes('базовая практика:'),'route shows foundational results explicitly in the original upper grade');
  const profile=h.context.MathLearningPath.profile(h.state().learningState,[...all,...QUALITY_BANK.tasks,...content.tasks],{grade:11,level:'basic'});
  test(profile.some(row=>row.foundationIndependent>0)&&profile.every(row=>!row.mastered),'earlier-grade success does not establish upper-grade mastery');
 });
 if(failures.length){console.error(failures.join('\n\n'));process.exitCode=1;return;}
 const report={status:'passed',checks,scenarios:9,scope:'Actual UI handlers for malformed and large saves, exam answer provenance, full backup preview and confirmation, teacher reports and shared follow-up practice, learner route persistence, diagnostics, delayed new-family review, and explicit foundational practice in upper grades.'};
 fs.writeFileSync(path.join(root,'checks/workspace-integration-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})();
