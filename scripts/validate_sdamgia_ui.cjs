// Actual application events: source-backed catalogue, mixed work interchange and
// online solving. The harness forbids application networking, including images.
const fs=require('node:fs'),path=require('node:path');
const {createHarness,BANK,EXAM_BANK,SDAMGIA_BANK,KEY}=require('./validate_ui_state.cjs');
const {loadPage}=require('./load_page.cjs');
const root=path.resolve(__dirname,'..'),page=loadPage(root);
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>JSON.parse(JSON.stringify(value));
const bank=SDAMGIA_BANK||{tasks:[],subtypes:[]};
const tasks=Array.isArray(bank.tasks)?bank.tasks:[],subtypes=Array.isArray(bank.subtypes)?bank.subtypes:[];
const work=h=>h.state().works?.find(([key])=>key==='unified')?.[1];
const runIds=h=>h.state().activeRun?.ids||h.state().activeRun?.work?.ids||[];
const examples=task=>task.examples?.length?task.examples:[task];
const classes=BANK.flatMap(topic=>topic.tasks.map(task=>({...task,grade:topic.grade,level:topic.level})));
const classTask=classes.find(task=>task.kind==='number');
const exam=EXAM_BANK.find(item=>item.id==='ege-basic');
const examTask=exam.tasks.flatMap(examples).find(task=>task.answerKind==='number');
const sourceTask=tasks.find(task=>task.kind==='number');
const sourceBefore=JSON.stringify(bank);
async function scenario(label,callback){try{await callback();}catch(error){test(false,label+': '+error.stack);}}
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
async function add(h,source,id){await h.change('#source-filter',source);await h.input('#bank-search',id);await h.click(`[data-action="add"][data-id="${id}"]`);}
async function exportWork(h){await h.click('[data-action="export-work"]');const download=h.document.downloads.at(-1);return JSON.parse(await h.blobs.get(download.url).text());}
function cardIds(h){return h.document.querySelectorAll('.bank-task').map(card=>card.querySelector('[data-action="add"],[data-action="remove"]')?.dataset.id);}

(async()=>{
 test(tasks.length>=180&&tasks.length<=220,'source bank contains approximately 200 real tasks');
 test(new Set(tasks.map(task=>task.id)).size===tasks.length,'source task identifiers are unique');
 test(subtypes.length>=20,'catalogue contains at least twenty distinct subtypes');
 test(['ege-profile','ege-basic','oge'].every(exam=>tasks.some(task=>task.exam===exam)),'all three requested exam programmes have source tasks');
 test(classes.length===7488,'adding the external source preserves every existing class task');
 for(const task of tasks){
  test(subtypes.some(subtype=>subtype.id===task.subtypeId),task.id+' references an existing subtype');
  const url=new URL(task.sourceUrl);
  test(url.protocol==='https:'&&/(^|\.)sdamgia\.ru$/.test(url.hostname)&&url.searchParams.get('id')===String(task.sourceId),task.id+' retains the exact original source URL and number');
  test(typeof task.prompt==='string'&&task.prompt.trim().length>10,task.id+' has a searchable textual condition');
  test(typeof task.solution==='string'&&task.solution.trim().length>10,task.id+' has a readable solution');
  test(!/<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:/i.test((task.promptHtml||'')+(task.solutionHtml||'')),task.id+' contains no executable source HTML');
  const imageRefs=[...((task.promptHtml||'')+(task.solutionHtml||'')).matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]);
  test(imageRefs.every(src=>/^data:image\/(?:svg\+xml|png|jpeg|gif|webp)[;,]/i.test(src)),task.id+' embeds every formula/diagram image for offline use');
  if(/установите\s+соответствие/i.test(task.prompt))test(task.kind==='sequence',task.id+' matching-table answer is an ordered digit sequence');
  if(task.subtypeId==='sdamgia-oge-cat-113')test(task.kind==='number',task.id+' progression asks for a numeric value rather than an ordered answer string');
 }
 await scenario('source filters, exact search and subtype selection',async()=>{
  const h=createHarness();await teacher(h);
  const options=h.get('#source-filter').querySelectorAll('option').map(option=>option.getAttribute('value'));
  test(['sdamgia','sdamgia:ege-profile','sdamgia:ege-basic','sdamgia:oge'].every(value=>options.includes(value)),'source filter exposes Решу ЕГЭ and all three programmes');
  for(const examId of ['ege-profile','ege-basic','oge']){
   await h.change('#source-filter','sdamgia:'+examId);
   const expected=tasks.filter(task=>task.exam===examId),ids=cardIds(h);
   test(ids.length>0&&ids.every(id=>expected.some(task=>task.id===id)),examId+' source filter renders only its own tasks');
   test(!h.get('#builder-assembly').textContent.includes('Демоверсия ФИПИ'),examId+' automatic assembly does not misattribute Решу ЕГЭ tasks to a FIPI demo');
   const selected=expected[0];await h.input('#bank-search',selected.id);
   test(same(cardIds(h),[selected.id]),selected.id+' is found by its permanent internal ID');
   await h.input('#bank-search',String(selected.sourceId));
   const matching=expected.filter(task=>String(task.sourceId)===String(selected.sourceId));
   test(same(cardIds(h).slice().sort(),matching.map(task=>task.id).sort()),selected.id+' exact source-number search does not match incidental digits in conditions');
  }
  await h.change('#source-filter','sdamgia');
  const subtype=subtypes.find(item=>tasks.some(task=>task.subtypeId===item.id));
  await h.change('#subtype-filter',subtype.id);
  const expected=tasks.filter(task=>task.subtypeId===subtype.id),ids=cardIds(h);
  test(ids.length>0&&ids.every(id=>expected.some(task=>task.id===id)),'subtype filter limits the builder to the selected method/condition family');
  test(h.text().includes(subtype.title),'selected subtype has a visible human-readable title');
  await h.input('#auto-count','3');await h.click('[data-action="auto-build"]');
  test(work(h).ids.length===3&&work(h).ids.every(id=>expected.some(task=>task.id===id)),'automatic assembly respects the chosen external source subtype');
  await h.change('#source-filter','all');await h.input('#bank-search',sourceTask.id);
  const classTopic=BANK.find(topic=>topic.subject==='Геометрия');
  await h.change('#subject-filter',classTopic.subject);await h.change('#bank-filter',classTopic.id);await h.change('#tricky-only',true);
  test(same(cardIds(h),[sourceTask.id]),'class subject/topic/tricky filters do not silently exclude a source-backed task in the combined bank');
  test(h.networkCalls()===0,'filtering and searching source-backed tasks make no network requests');
 });
 await scenario('new catalogue shortcuts respect the mobile work dialog',async()=>{
  const mobile=createHarness(new Map(),{mobile:true});await teacher(mobile);await add(mobile,'sdamgia:'+sourceTask.exam,sourceTask.id);
  await mobile.click('[data-action="open-work"]');
  test(mobile.get('.catalog-shortcuts').inert&&mobile.get('#builder-bank').inert,'opening the work dialog makes both the bank and new catalogue shortcuts inert');
  await mobile.document.dispatch('keydown',mobile.document.activeElement,{key:'Escape'});
  test(!mobile.get('.catalog-shortcuts').inert&&!mobile.get('#builder-bank').inert,'closing the work dialog restores catalogue shortcut access');
 });
 await scenario('catalogue entry for both roles',async()=>{
  for(const role of ['teacher','student']){
   const h=createHarness();await h.click(`[data-role="${role}"]`);await h.click('[data-action="subtype-catalog"]');
   test(h.state().resumeRoute.view==='subtypes'&&h.state().resumeRoute.role===role,role+' enters the subtype catalogue without changing role');
   test(h.document.querySelectorAll('.subtype-card').length===subtypes.length,role+' can inspect every subtype');
   await h.change('#subtype-exam-filter','oge');
   const oge=subtypes.filter(item=>item.exam==='oge');
   test(h.document.querySelectorAll('.subtype-card').length===oge.length,'catalogue programme filter selects only OGE subtypes for '+role);
   await h.input('#subtype-search','такого подтипа не существует 999999');
   test(h.document.querySelectorAll('.subtype-card').length===0,'catalogue search has a truthful empty state for '+role);
   await h.input('#subtype-search','');
   const subtype=oge[0];await h.click(`[data-action="subtype-practice"][data-subtype="${subtype.id}"]`);
   test(h.state().resumeRoute.view==='work-run'&&h.state().resumeRoute.role===role,role+' can practise a catalogue subtype immediately');
   test(runIds(h).length>0&&runIds(h).length<=10&&runIds(h).every(id=>tasks.some(task=>task.id===id&&task.subtypeId===subtype.id)),role+' subtype practice contains only up to ten relevant tasks');
   test(h.networkCalls()===0,role+' subtype practice remains offline');
  }
 });
 const store=new Map(),pdfCalls=[];let h=createHarness(store,{createMathPDF:async value=>{pdfCalls.push(value);return new Uint8Array(Buffer.from('%PDF-test'));}}),payload,ids;
 await scenario('mixed source selection and JSON interchange',async()=>{
  await teacher(h);await add(h,`class:${classTask.grade}:${classTask.level}`,classTask.id);await add(h,'exam:ege-basic',examTask.id);await add(h,'sdamgia:'+sourceTask.exam,sourceTask.id);
  ids=[classTask.id,examTask.id,sourceTask.id];test(same(work(h).ids,ids),'one work preserves class, official demo and Решу ЕГЭ tasks in the chosen order');
  await h.input('#work-title','Смешанная работа онлайн');await h.change('#include-answers',true);h.flush();
  await h.click('[data-action="save-work"]');payload=await exportWork(h);
  test(payload.version===2&&same(payload.work.ids,ids),'version-two JSON interchange preserves all three sources');
  await h.click('[data-action="subtype-catalog"]');
  const subtype=subtypes[0];await h.click(`[data-action="subtype-builder"][data-subtype="${subtype.id}"]`);
  test(h.state().resumeRoute.view==='builder'&&same(work(h).ids,ids),'opening a subtype in the builder preserves the existing mixed work');
  test(h.get('#subtype-filter').value===subtype.id,'catalogue opens its exact subtype in the constructor');
  await h.click('[data-action="print-preview"]');
  const previewImages=h.document.querySelectorAll('.print-root img').map(image=>image.getAttribute('src'));
  test(h.document.querySelectorAll('.print-question').length===2&&(sourceTask.printImages||[]).length>0&&sourceTask.printImages.every(src=>previewImages.includes(src)),'print preview retains both existing-bank tasks and every original source statement fragment');
  await h.click('[data-action="download"]');
  test(same(pdfCalls.at(-1)?.tasks.map(task=>task.id),ids),'PDF action forwards the sourced task together with the existing banks');
  await h.click('[data-action="builder"]');
  await h.click('[data-action="new-variant"]');
  const nextSource=tasks.find(task=>task.id===work(h).ids[2]);
  test(work(h).ids.length===3&&work(h).ids[1]===examTask.id&&nextSource&&nextSource.exam===sourceTask.exam&&nextSource.subtypeId===sourceTask.subtypeId&&nextSource.kind===sourceTask.kind&&nextSource.difficulty===sourceTask.difficulty,'mixed variant retains official originals and replaces sourced tasks only within the same programme/subtype/format/difficulty');
  await h.import(payload);
  test(same(work(h).ids,ids),'mixed JSON restores the original selected source tasks after variant generation');
 });
 await scenario('student imports a teacher work without entering teacher mode',async()=>{
  const student=createHarness();await student.click('[data-role="student"]');await student.click('[data-action="works-home"]');
  test(student.state().resumeRoute.view==='works','student has a dedicated saved/imported works screen');
  await student.import(payload);
  test(student.state().resumeRoute.role==='student'&&student.state().resumeRoute.view==='works','student import preserves the learner role and works screen');
  test(same(work(student).ids,ids),'student import retains all mixed-source tasks');
  const before=JSON.stringify(work(student));await student.import({...payload,work:{...payload.work,ids:[...ids,'unknown-task']}});
  test(JSON.stringify(work(student))===before,'invalid imported task IDs cannot partially overwrite a learner work');
  await student.click('[data-action="run-work"]');
  test(student.state().resumeRoute.role==='student'&&student.state().resumeRoute.view==='work-run','learner can solve the imported teacher work directly');
  test(same(runIds(student),ids),'learner run preserves the imported task order');
 });
 await scenario('online mixed work has isolated attempts and survives reload',async()=>{
  await h.click('[data-action="run-work"]');
  test(h.state().resumeRoute.view==='work-run'&&same(runIds(h),ids),'current mixed work starts an online run with the exact task order');
  test(h.state().activeRun.phase==='solving'&&h.state().activeRun.index===0,'new run begins at its first task');
  test(!h.text().includes(classTask.solution),'teacher answer-key flag does not expose a solution when solving starts');
  await h.input('#work-run-answer',String(Number(classTask.answer)+123456));await h.submit('#work-run-answer-form');
  test(h.state().activeRun.records[classTask.id].submitted&&!h.state().activeRun.records[classTask.id].correct,'runner records an incorrect response on its own attempt');
  test(!(h.state().attempts||[]).some(([key])=>key.endsWith(':'+classTask.id)),'work solving does not overwrite ordinary trainer progress');
  await h.click('[data-action="run-next"]');await h.input('#work-run-answer',examTask.answerText||String(examTask.answers[0]));h.flush();
  const runId=h.state().activeRun.id;h.pagehide();h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().resumeRoute.view==='work-run'&&h.state().activeRun.id===runId&&h.state().activeRun.index===1,'reload resumes the same mixed run and selected task');
  test(h.get('#work-run-answer').value===(examTask.answerText||String(examTask.answers[0])),'reload preserves an unsubmitted official-exam answer draft');
  await h.submit('#work-run-answer-form');
  test(h.state().activeRun.records[examTask.id].correct,'runner uses the official answer format for a demo task');
  await h.click('[data-action="run-next"]');await h.input('#work-run-answer',sourceTask.display);h.flush();
  await h.click('[data-action="run-finish"]');
  test(h.state().activeRun.phase==='results','finishing the work opens results');
  test(h.state().activeRun.records[sourceTask.id].correct,'finishing evaluates the last unsent source-task draft');
  const record=h.state().activeRun.records;
  test(ids.filter(id=>record[id].correct).length===2&&record[classTask.id].submitted&&!record[classTask.id].correct,'results preserve two correct answers and one submitted incorrect answer');
  await h.click('[data-action="run-export"]');
  const download=h.document.downloads.at(-1),result=JSON.parse(await h.blobs.get(download.url).text());
  test(result.format==='baza-work-results'&&result.version===1,'online results download uses its own documented versioned format');
  test(same(result.tasks.map(task=>task.id),ids),'downloaded results preserve every original task in order');
  test(result.tasks.find(task=>task.id===sourceTask.id).correct===true&&result.tasks.find(task=>task.id===classTask.id).correct===false,'downloaded results preserve source and class grading outcomes');
  test(h.networkCalls()===0,'mixed work solving, restoration and exporting require no network');
 });
 await scenario('open work responses remain manual and have distinct results',async()=>{
  const open=classes.find(task=>task.kind==='open'),learner=createHarness();
  await learner.click('[data-role="student"]');await learner.click('[data-action="works-home"]');
  await learner.import({format:'mat1430-work',version:2,work:{ids:[open.id],title:'Работа с рассуждением',variant:'1',answers:true}});
  await learner.click('[data-action="run-work"]');
  await learner.input('#work-run-draft','Я записал рассуждение и проверил каждый переход.');learner.flush();
  await learner.click('[data-action="run-finish"]');
  test(!learner.state().activeRun.records[open.id].correct&&!learner.state().activeRun.records[open.id].reviewed,'finishing never automatically awards correctness to an open response');
  test(learner.text().includes('Ожидают сверки'),'results identify a written open answer awaiting manual review');
  await learner.click('[data-action="run-reveal"]');
  const criteria=learner.document.querySelectorAll('[data-run-rubric]');
  test(criteria.length===open.rubric.length,'open response exposes every original self-review criterion');
  for(let index=0;index<criteria.length;index++){
   await learner.change(`[data-run-rubric="${index}"]`,true);
   test(learner.document.activeElement===learner.get(`[data-run-rubric="${index}"]`),'criterion '+index+' retains keyboard focus after rerender');
  }
  await learner.click('[data-action="run-review"]');
  test(learner.state().activeRun.records[open.id].reviewed&&!learner.state().activeRun.records[open.id].correct,'manual review is recorded separately from automatically correct answers');
  await learner.click('[data-action="run-export"]');
  const download=learner.document.downloads.at(-1),result=JSON.parse(await learner.blobs.get(download.url).text());
  test(result.summary.correct===0&&result.summary.reviewed===1&&result.tasks[0].correct===null&&result.tasks[0].reviewed===true,'downloaded results keep manual review distinct from an exam score');
 });
 await scenario('a new work cannot silently discard an unfinished run',async()=>{
  const learner=createHarness();await learner.click('[data-role="student"]');await learner.click('[data-action="works-home"]');
  await learner.import({format:'mat1430-work',version:2,work:{ids:[classTask.id],title:'Первая работа',variant:'1',answers:false}});
  await learner.click('[data-action="run-work"]');await learner.input('#work-run-answer','321');learner.flush();
  const before=clone(learner.state().activeRun);await learner.click('[data-action="run-exit"]');
  await learner.import({format:'mat1430-work',version:2,work:{ids:[sourceTask.id],title:'Вторая работа',variant:'2',answers:false}});
  await learner.click('[data-action="run-work"]');
  test(learner.state().activeRun.id===before.id&&learner.state().activeRun.records[classTask.id].draft==='321','starting a different work preserves the previous unfinished run and draft');
  test(!!learner.document.querySelector('[data-action="replace-run"]')&&!!learner.document.querySelector('[data-action="resume-run"]'),'learner gets explicit choices to resume or replace the unfinished work');
  await learner.click('[data-action="replace-run"]');
  test(same(runIds(learner),[sourceTask.id])&&learner.state().activeRun.id!==before.id,'explicit replacement starts the newly requested work');
  const savedWorks=clone(learner.state().library||[]);await learner.click('[data-action="end-session"]');
  test(!learner.state().activeRun&&learner.state().resumeRoute.view==='classes','anonymous learner can finish the session and clear saved work answers on a shared device');
  test(same(learner.state().library,savedWorks),'ending a learner session preserves reusable teacher collections');
 });
 test(JSON.stringify(bank)===sourceBefore,'catalogue, solving and exports never mutate the source task bank');
 const report={checks,errors,tasks:tasks.length,subtypes:subtypes.length};
 fs.writeFileSync(path.join(root,'checks/sdamgia-ui-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(report);if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
