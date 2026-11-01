// Actual application handlers with the local lazy loader. Run after build.py.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHarness,KEY}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..'),json=v=>JSON.parse(JSON.stringify(v));
let checks=0;const failures=[],results=[];
const test=(condition,message)=>{checks++;assert.ok(condition,message);};
const equal=(a,b,message)=>{checks++;assert.deepEqual(json(a),json(b),message);};
async function scenario(name,run){try{await run();results.push(name);}catch(error){failures.push(name+': '+error.stack);}}
async function settle(h){await h.settleAssets();await h.settleAssets();}
async function click(h,selector){await h.click(selector);await settle(h);}
function tasks(h){return json(vm.runInContext('METHOD_BANK.tasks',h.context));}
async function methods(role='teacher',store=new Map()){
 const h=createHarness(store,{initialPage:true,setupDOM(document,window){window.location={reload(){}};}});await settle(h);
 await click(h,`[data-role="${role}"]`);await click(h,'[data-action="nav-catalog"]');await click(h,'[data-action="method-home"]');return h;
}
function clock(h){h.context.__methodNow=Date.parse('2026-11-01T10:00:00Z');vm.runInContext('Date=class extends Date{constructor(...args){super(...(args.length?args:[globalThis.__methodNow]));}static now(){return globalThis.__methodNow;}}',h.context);return ms=>{h.context.__methodNow+=ms;};}
async function files(h,selector,items){const element=h.get(selector);element.files=items.map(({name='qa.json',value})=>{const text=typeof value==='string'?value:JSON.stringify(value);return {name,size:Buffer.byteLength(text),text:async()=>text};});await h.document.dispatch('change',element);await settle(h);}
async function download(h){const file=h.document.downloads.at(-1);test(!!file,'Application hands a download to the browser');return {name:file.name,text:await h.blobs.get(file.url).text()};}
(async()=>{
 const exported=[];
 await scenario('catalog, six answer filters, contrast pair and complete topic',async()=>{
  const h=await methods(),bank=tasks(h);equal(bank.length,80,'Method source contains all 80 authored tasks');equal(h.context.MathDataLoader.snapshot().loaded,['methods'],'Opening method entry loads its own local source only');
  test(bank.every(q=>q.editorialStatus==='teacher_pending'),'Published tasks do not fabricate teacher approval');
  for(const kind of ['interval','coordinates','expression','matching','steps','examples']){
   await h.change('#method-kind',kind);const visible=h.document.querySelectorAll('[data-method-task]').map(e=>e.dataset.methodTask);
   test(visible.length>0&&visible.every(id=>bank.find(q=>q.id===id).kind===kind),'Filter exposes only '+kind+' tasks');
  }
  await click(h,'[data-action="method-reset"]');const pair=bank.find(q=>q.contrastPairId);
  await click(h,`[data-action="method-run-pair"][data-id="${pair.id}"]`);equal(h.state().activeRun.ids.length,2,'Contrast action launches exactly two related conditions');
  await click(h,'[data-action="home"]');await click(h,'[data-role="teacher"]');await click(h,'[data-action="nav-catalog"]');await click(h,'[data-action="method-home"]');
  await click(h,`[data-action="method-run-topic"][data-id="${pair.id}"]`);test(!!h.document.querySelector('[data-action="replace-run"]'),'A new topic protects the existing pair results before replacement');await click(h,'[data-action="replace-run"]');
  equal(h.state().activeRun.ids.length,8,'Topic action launches all eight planned tasks');test(h.state().activeRun.ids.every(id=>bank.find(q=>q.id===id).topicId===pair.topicId),'Topic work contains no unrelated task');
  await click(h,'[data-action="home"]');await click(h,'[data-role="teacher"]');await click(h,'[data-action="nav-catalog"]');await click(h,'[data-action="method-home"]');await click(h,'[data-action="method-builder"]');
  equal(h.get('#source-filter').value,'methods','Teacher opens the dedicated source in constructor');test(/Найдено:\s*80/.test(h.text()),'Constructor offers all 80 source records');
 });
 for(const kind of ['interval','coordinates','expression','matching','steps','examples'])await scenario('student '+kind+' submission, timing, reload and export',async()=>{
  const h=await methods('student'),advance=clock(h),q=tasks(h).find(q=>q.kind===kind);await h.change('#method-kind',kind);await click(h,`[data-action="method-run-one"][data-id="${q.id}"]`);
  equal(h.state().activeRun.ids,[q.id],'One-task action is isolated for '+kind);
  if(kind==='steps'){const options=h.document.querySelector('.answer-options');test(!!options&&q.stepOptions.every(row=>options.textContent.includes(row.id+'.')&&options.textContent.includes(row.text.split(/\d/)[0].trim())),'Every step ID and its readable instruction are visible during actual work');}
  if(kind==='matching')test(h.text().includes(q.matchingOptions[0].text),'Matching options are visible during actual work');
  if(q.representations.some(r=>r.type==='graph'))test(!!h.document.querySelector('.method-graph svg'),'Actual work includes the graph representation');
  advance(1000);await h.input('#work-run-answer','not a valid answer');await h.submit('#work-run-answer-form');
  let record=h.state().activeRun.records[q.id];test(record.firstAttempt&&!record.firstAttempt.valid&&!record.firstValidAttempt,'Invalid syntax cannot become the first mathematical outcome');
  h.document.visibilityState='hidden';await h.document.dispatch('visibilitychange',h.document.documentElement);advance(50000);h.document.visibilityState='visible';await h.document.dispatch('visibilitychange',h.document.documentElement);
  if(kind==='coordinates'){advance(1000);await h.input('#work-run-answer',`${q.answer[0]+1};${q.answer[1]}`);await h.submit('#work-run-answer-form');advance(1000);}else advance(2000);
  await h.input('#work-run-answer',q.display);await h.submit('#work-run-answer-form');record=h.state().activeRun.records[q.id];
  test(record.correct,'The new '+kind+' answer is checked by the actual submit handler');test(record.firstValidAttempt.valid,'A first valid attempt is retained');equal(record.firstValidAttempt.correct,kind!=='coordinates','Later success does not replace an earlier valid failure');equal(record.firstValidAttempt.activeMs,kind==='coordinates'?2000:3000,'Hidden-tab time is excluded from the first valid active duration');test(record.firstValidAttempt.timingRecorded,'Recorded duration has explicit measurement provenance');
  const copy=new Map(h.store),reloaded=createHarness(copy,{initialPage:true});await settle(reloaded);await click(reloaded,'[data-action="resume-run"]');
  equal(reloaded.state().activeRun.records[q.id].firstValidAttempt,record.firstValidAttempt,'First valid outcome and duration survive a real application restore');test(reloaded.context.MathDataLoader.snapshot().loaded.includes('methods'),'Reload hydrates the source required by current run IDs');
  await click(reloaded,'[data-action="run-finish"]');await click(reloaded,'[data-action="run-export"]');const file=await download(reloaded),result=JSON.parse(file.text);exported.push(result);
  equal(result.participantRole,'student','Export identifies actual student practice');equal(result.tasks[0].kind,kind,'Export keeps the new format');equal(result.tasks[0].firstValidAttempt.correct,kind!=='coordinates','Export keeps first mathematical evidence rather than final status');equal(result.tasks[0].contentHash,q.contentHash,'Export identifies the source version');
 });
 await scenario('teacher result import has exact first-attempt and time denominators',async()=>{
  const h=await methods();await click(h,'[data-action="home"]');await click(h,'[data-role="teacher"]');await click(h,'[data-action="report-home"]');await files(h,'#report-files',exported.map((value,i)=>({name:'qa-student-'+i+'.json',value})));
  equal(h.state().teacherReports.length,6,'All six new answer formats import as actual result files');
  let aggregate=h.context.MathTeacherReport.aggregate(h.state().teacherReports,tasks(h));equal(aggregate.evidence.observations,6,'One first valid independent observation per submitted task');equal(aggregate.evidence.tasks.reduce((n,q)=>n+q.successes,0),5,'The first coordinate failure is visible although all final answers are correct');test(aggregate.evidence.tasks.every(q=>q.n===1&&q.timeN===1&&!q.preliminary),'Each observation and active-time denominator is explicit and insufficient for calibration');
  await files(h,'#report-files',[{name:'duplicate-export.json',value:exported[0]}]);aggregate=h.context.MathTeacherReport.aggregate(h.state().teacherReports,tasks(h));equal(aggregate.evidence.observations,6,'Repeated file imports do not inflate observational sample size');
  test(h.text().includes('Наблюдаемая сложность')&&h.text().includes('Медиана активного времени'),'Teacher sees the real evidence table');
 });
 await scenario('explicit local review, exported review and full backup round-trip',async()=>{
  const h=await methods(),q=tasks(h)[0];test(h.text().includes('Ожидает рецензии учителя'),'Initial catalogue shows pending human review');await click(h,`[data-action="method-review"][data-id="${q.id}"]`);
  test(h.text().includes('Автоматическая математическая проверка пройдена'),'Independent source checks are shown separately from a teacher review');
  // Isolated test fixture only: no authored content is marked human-reviewed.
  await h.input('#editorial-reviewer','QA: тест интерфейса');await h.input('#editorial-comment','Тестовая локальная запись для проверки сохранения и переноса.');
  const criteria=h.context.MathBankEditorial.criteria;for(const c of criteria.slice(0,3))await h.change(`[data-editorial-criterion="${c.id}"]`,true);await h.submit('#editorial-review-form');equal(h.state().editorialStore.reviews.length,0,'Three checkboxes cannot create a complete review');
  await h.change(`[data-editorial-criterion="${criteria[3].id}"]`,true);await h.submit('#editorial-review-form');equal(h.state().editorialStore.reviews.length,1,'Four explicit criteria plus author and comment create a local record');test(h.text().includes('Проверено учителем'),'UI shows only the explicitly saved review as human-reviewed');
  await click(h,'[data-action="editorial-export"]');const reviewFile=await download(h),review=JSON.parse(reviewFile.text);equal(review.format,'baza-editorial-reviews','Dedicated review file uses its own schema');equal(review.reviews[0].taskId,q.id,'Review file is attached to a concrete task');
  const imported=await methods();await click(imported,`[data-action="method-review"][data-id="${q.id}"]`);await files(imported,'#editorial-file',[{name:'qa-review.json',value:review}]);equal(imported.state().editorialStore.reviews.length,1,'Actual review import handler restores the local record');
  await click(imported,'[data-action="backup-home"]');await click(imported,'[data-action="backup-export"]');const backup=JSON.parse((await download(imported)).text);equal(backup.workspace.editorialStore.reviews.length,1,'Full backup includes editorial records');
  const destination=await methods();await click(destination,'[data-action="backup-home"]');await files(destination,'#backup-file',[{name:'qa-complete-backup.json',value:backup}]);test(!!destination.document.querySelector('#backup-preview'),'Full copy is previewed before restore');await click(destination,'[data-action="backup-confirm"]');
  const restored=createHarness(destination.store,{initialPage:true});await settle(restored);equal(restored.state().editorialStore.reviews.length,1,'Review survives full-backup confirmation and fresh application startup');await click(restored,'[data-role="teacher"]');await click(restored,'[data-action="nav-catalog"]');await click(restored,'[data-action="method-home"]');await click(restored,`[data-action="method-review"][data-id="${q.id}"]`);equal(restored.get('#editorial-reviewer').value,'QA: тест интерфейса','Review form is prefilled from the restored content-bound record');
  test(tasks(restored).every(q=>q.editorialStatus==='teacher_pending'),'QA never rewrites publication evidence to claim human source review');
 });
 if(failures.length){console.error(failures.join('\n\n'));process.exitCode=1;return;}
 const output={status:'passed',checks,scenarios:results,scope:'Actual method catalog, six new response handlers, source constructor, contrast/topic work, first valid active-time exports, report denominators and explicit local editorial backup/import.'};fs.writeFileSync(path.join(root,'checks/method-bank-ui-results.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
})().catch(error=>{console.error(error);process.exitCode=1;});
