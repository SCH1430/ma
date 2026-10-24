// Exercises the actual application event handlers and persistence boundaries.
// The PDF capture checks UI-to-generator wiring; PDF layout is audited separately.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createHarness,BANK,EXAM_BANK,KEY}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..');
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>JSON.parse(JSON.stringify(value));
const sourceDigest=()=>crypto.createHash('sha256').update(JSON.stringify([BANK,EXAM_BANK])).digest('hex');
const originalSourceDigest=sourceDigest();
const work=h=>h.state().works?.find(([key])=>key==='unified')?.[1];
const examples=q=>q.examples?.length?q.examples:[q];
const classes=BANK.flatMap(t=>t.tasks.map(q=>({...q,grade:t.grade,level:t.level,topicId:t.id})));
const examExamples=EXAM_BANK.flatMap(exam=>exam.tasks.flatMap(task=>examples(task).map((q,i)=>({...q,examId:exam.id,number:task.number,exampleNumber:examples(task).length>1?i+1:null,solutionPages:q.solutionPages?.length?q.solutionPages:task.solutionPages?.length?task.solutionPages:exam.solutionPages||[],source:'exam'}))));
const classTask=(grade,level)=>classes.find(q=>q.grade===grade&&q.level===level);
const examTask=(examId,number,index=0)=>examExamples.filter(q=>q.examId===examId&&q.number===number)[index];
const selected=[classTask(5,'basic'),classTask(11,'basic'),classTask(11,'advanced'),examTask('oge',1),examTask('ege-basic',2,1),examTask('ege-profile',13,1)];
const all=[...classes,...examExamples];
async function scenario(label,fn){try{await fn();}catch(error){test(false,label+': '+error.stack);}}
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
function sourceValue(q){return q.source==='exam'?'exam:'+q.examId:`class:${q.grade}:${q.level}`;}
async function addTask(h,q){await h.change('#source-filter',sourceValue(q));await h.input('#bank-search',q.id);await h.click(`[data-action="add"][data-id="${q.id}"]`);}
async function exported(h){await h.click('[data-action="export-work"]');const download=h.document.downloads.at(-1);return {download,payload:JSON.parse(await h.blobs.get(download.url).text())};}

(async()=>{
 await scenario('global teacher entry and student route boundary',async()=>{
  const h=createHarness();await h.click('[data-role="teacher"]');
  test(h.state().resumeRoute.view==='classes'&&!!h.document.querySelector('[data-action="builder-home"]'),'class and exam catalogue exposes the teacher constructor before choosing a class');
  const catalogueHTML=h.html();test(catalogueHTML.indexOf('constructor-entry')>=0&&catalogueHTML.indexOf('constructor-entry')<catalogueHTML.indexOf('catalog-layout'),'constructor entry appears before the class and exam grids');
  await h.click('[data-action="builder-home"]');
  test(h.state().resumeRoute.view==='builder'&&h.state().resumeRoute.grade===null&&h.state().resumeRoute.level===null,'constructor opens with no class or programme requirement');
  const options=h.get('#source-filter').querySelectorAll('option').map(x=>x.getAttribute('value'));
  test(['class:5:basic','class:11:basic','class:11:advanced','exam:oge','exam:ege-basic','exam:ege-profile'].every(value=>options.includes(value)),'source filter exposes classes, upper-school programmes and all three official exam banks');
  test(h.get('[data-action="print-preview"]').disabled,'empty work cannot enter print preview');
  const student=createHarness();await student.click('[data-role="student"]');
  test(student.get('[data-action="builder-home"]').textContent.includes('учителя'),'student catalogue clearly identifies the separate teacher constructor');
  for(const view of ['builder','print']){
   const route=student.context.safeRoute({view,role:'student',grade:6,level:'basic'},BANK,EXAM_BANK);
   test(route.view==='classes'&&route.grade===null,'student cannot restore teacher '+view+' state');
  }
 });
 await scenario('constructor exposes every official alternative example',async()=>{
  const catalogue=createHarness();await teacher(catalogue);
  for(const exam of EXAM_BANK){
   await catalogue.change('#source-filter','exam:'+exam.id);const actual=[];
   for(let page=0;page<10;page++){
    actual.push(...catalogue.document.querySelectorAll('.bank-task').map(card=>card.querySelector('[data-action="add"]').dataset.id));
    const next=catalogue.document.querySelector('[data-action="bank-next"]');if(!next||next.disabled)break;
    await catalogue.click('[data-action="bank-next"]');
   }
   const expected=exam.tasks.flatMap(examples).map(q=>q.id);
   test(same(actual,expected),exam.id+' constructor pagination exposes every official 2026 alternative once in source order');
  }
 });
 await scenario('complete OGE work and its next variant retain all 25 tasks',async()=>{
  const state=new Map(),oge=examExamples.filter(q=>q.examId==='oge'),ids=oge.map(q=>q.id);let full=createHarness(state);await teacher(full);
  for(const q of oge)await addTask(full,q);
  test(same(work(full).ids,ids),'all 25 OGE tasks can be added to one work without truncation');
  test(full.get('#work-heading').textContent.includes('25 / 60'),'work counter displays the complete OGE work against the 60-task limit');
  await full.click('[data-action="save-work"]');const result=await exported(full);
  test(same(result.payload.work.ids,ids)&&full.state().library.some(entry=>same(entry.ids,ids)),'JSON export and library save preserve the complete 25-task OGE work');
  full.pagehide();full=createHarness(state);await full.click('[data-action="resume"]');
  test(same(work(full).ids,ids),'reload preserves all 25 tasks of a complete OGE work');
  await full.click('[data-action="new-variant"]');
  test(same(work(full).ids,ids)&&work(full).variant==='2','the next OGE variant preserves all 25 official tasks');
  test(full.state().library.some(entry=>entry.variant==='1'&&same(entry.ids,ids))&&full.state().library.some(entry=>entry.variant==='2'&&same(entry.ids,ids)),'both complete OGE variants remain available in the library');
 });
 const store=new Map(),pdfCalls=[];let h=createHarness(store,{createMathPDF:async value=>{pdfCalls.push(value);return new Uint8Array(Buffer.from('%PDF-capture'));}}),expectedIds=selected.map(q=>q.id),mixedExport;
 await scenario('one ordered work survives every source filter',async()=>{
  await teacher(h);
  for(const [index,q] of selected.entries()){
   const previous=index?selected.slice(0,index).map(x=>x.id):[];
   await h.change('#source-filter',sourceValue(q));
   test(same(work(h).ids,previous),'source change preserves the earlier selection before '+q.id);
   await h.input('#bank-search',q.id);
   test(h.document.querySelectorAll('.bank-task').length===1,'exact ID search finds the source example '+q.id);
   const card=h.document.querySelector('.bank-task');
   if(q.source==='exam'){
    test(same(card.querySelectorAll('.exam-task-image').map(img=>img.getAttribute('src')),[...(q.contextImages||[]),...q.images]),q.id+' displays the complete official condition and shared context');
    test(card.textContent.includes('2026'),q.id+' visibly identifies the official demo year');
   }
   await h.click(`[data-action="add"][data-id="${q.id}"]`);
   test(same(work(h).ids,selected.slice(0,index+1).map(x=>x.id)),'adding '+q.id+' appends to the same work');
  }
  await h.change('#source-filter','all');await h.input('#bank-search','');
  test(same(work(h).ids,expectedIds),'showing all sources keeps the complete mixed work');
  await h.click(`#work-panel [data-action="up"][data-id="${selected[5].id}"]`);
  [expectedIds[4],expectedIds[5]]=[expectedIds[5],expectedIds[4]];
  test(same(work(h).ids,expectedIds),'moving an exam example changes only the selected order');
  await h.input('#work-title','Классы, ОГЭ и ЕГЭ');await h.input('#work-variant','Смешанный А');await h.input('#variant-seed','экзамены-2026');await h.change('#include-answers',true);h.flush();
  await h.click('[data-action="save-work"]');
  test(h.state().library.some(entry=>same(entry.ids,expectedIds)&&entry.title==='Классы, ОГЭ и ЕГЭ'),'library saves a mixed work without dropping any source');
  const result=await exported(h);mixedExport=result.payload;
  test(result.download.name.endsWith('.json')&&mixedExport.format==='mat1430-work'&&mixedExport.version===2,'mixed work exports with the version-two interchange schema');
  test(same(mixedExport.work.ids,expectedIds)&&mixedExport.work.answers===true&&mixedExport.work.seed==='экзамены-2026','JSON export keeps mixed order, answer flag and variant key');
  h.pagehide();h=createHarness(store,{createMathPDF:async value=>{pdfCalls.push(value);return new Uint8Array(Buffer.from('%PDF-capture'));}});await h.click('[data-action="resume"]');
  test(h.state().resumeRoute.view==='builder'&&h.state().resumeRoute.grade===null&&same(work(h).ids,expectedIds),'reload resumes the global constructor with all selected sources');
  test(h.get('#work-title').value==='Классы, ОГЭ и ЕГЭ'&&h.get('#work-variant').value==='Смешанный А'&&h.get('#include-answers').checked,'reload preserves mixed-work metadata');
 });
 await scenario('mixed preview and exact PDF payload',async()=>{
  await h.click('[data-action="print-preview"]');
  test(h.state().resumeRoute.view==='print'&&h.state().resumeRoute.grade===null,'mixed work enters print preview without a misleading class assignment');
  const print=h.get('.print-root');
  test(!print.textContent.includes('null класс')&&!print.textContent.includes('undefined'),'preview has complete source-neutral metadata');
  test(print.querySelectorAll('.print-question').length===expectedIds.length,'preview includes every selected class and exam task once');
  for(const id of expectedIds.filter(id=>id.startsWith('exam-'))){
   const original=examExamples.find(q=>q.id===id),images=print.querySelectorAll('.exam-task-image').map(img=>img.getAttribute('src'));
   test([...(original.contextImages||[]),...original.images].every(src=>images.includes(src)),id+' preview retains every original statement image');
  }
  await h.click('[data-action="download"]');
  const payload=pdfCalls.at(-1),download=h.document.downloads.at(-1);
  test(pdfCalls.length===1&&payload&&same(payload.tasks.map(q=>q.id),expectedIds),'PDF action forwards all selected tasks in the chosen order');
  test(payload.grade===null&&payload.level===null&&payload.title==='Классы, ОГЭ и ЕГЭ'&&payload.variant==='Смешанный А'&&payload.answers===true,'PDF receives source-neutral metadata and the answer-key preference');
  test(download?.name.endsWith('.pdf')&&!download.name.includes('null')&&h.blobs.get(download.url).type==='application/pdf','PDF result is offered with a complete source-neutral PDF filename');
  for(const q of payload.tasks.filter(q=>q.source==='exam')){
   const original=examExamples.find(item=>item.id===q.id);
   test(q.examId===original.examId&&q.number===original.number&&q.exampleNumber===original.exampleNumber,q.id+' PDF task preserves exam, official number and alternative example');
   test(same(q.images,original.images)&&same(q.contextImages,original.contextImages)&&same(q.solutionPages||[],original.solutionPages||[]),q.id+' PDF task preserves original task, shared-context and criteria assets');
   test(typeof q.answerText==='string'&&q.display===q.answerText&&typeof q.sourceLabel==='string'&&q.sourceLabel.includes('2026'),q.id+' PDF task carries its official answer label and year');
  }
  await h.click('[data-action="builder"]');test(same(work(h).ids,expectedIds),'return from print preview preserves mixed composition');
 });
 await scenario('distinct criteria crops from one original page survive print preview',async()=>{
  const first=examTask('oge',20),second=examTask('oge',21),a=first.solutionPages.find(page=>page.page===8),b=second.solutionPages.find(page=>page.page===8);
  test(!!a&&!!b&&a.image!==b.image,'real OGE tasks 20 and 21 retain distinct official criteria crops from source page 8');
  const preview=createHarness();await teacher(preview);await addTask(preview,first);await addTask(preview,second);await preview.change('#include-answers',true);await preview.click('[data-action="print-preview"]');
  const actual=preview.document.querySelectorAll('.print-root img[alt="Официальные критерии ФИПИ"]').map(image=>image.getAttribute('src'));
  const expected=[...new Set([...first.solutionPages,...second.solutionPages].map(page=>page.image))];
  test(same(actual,expected)&&actual.includes(a.image)&&actual.includes(b.image),'print preview keeps both different page-8 criteria crops and the following page-9 crop');
 });
 await scenario('JSON round trip, strict imports and variant stability',async()=>{
  const target=createHarness();await teacher(target);await target.import(mixedExport);
  test(same(work(target).ids,expectedIds)&&work(target).title===mixedExport.work.title&&work(target).answers===true,'a fresh browser imports the complete mixed JSON work');
  const before=JSON.stringify(work(target));
  for(const ids of [[...expectedIds,'missing-task'],[expectedIds[0],expectedIds[0]],[null],['exam-2025-oge-1']]){
   await target.import({...mixedExport,work:{...mixedExport.work,ids}});
   test(JSON.stringify(work(target))===before&&target.get('#notice').textContent.includes('Не удалось'),'invalid JSON task list cannot partially replace the current mixed work: '+JSON.stringify(ids));
  }
  const snapshot=clone(work(target));await target.click('[data-action="new-variant"]');
  const variant=work(target);
  test(variant.ids.length===snapshot.ids.length&&new Set(variant.ids).size===variant.ids.length,'new mixed variant keeps work length without duplicates');
  for(const [index,id] of snapshot.ids.entries()){
   const original=all.find(q=>q.id===id),next=all.find(q=>q.id===variant.ids[index]);
   test(original.source==='exam'?variant.ids[index]===id:next&&next.grade===original.grade&&next.level===original.level&&next.topicId===original.topicId&&next.kind===original.kind&&next.difficulty===original.difficulty,'new variant preserves the source and permitted substitution for '+id);
  }
  const legacy={format:'mat1430-work',version:1,grade:11,level:'advanced',work:{ids:[selected[2].id],title:'Старая подборка',variant:'Б',answers:false}};
  await target.import(legacy);
  test(same(work(target).ids,[selected[2].id])&&work(target).title==='Старая подборка'&&target.state().resumeRoute.grade===null,'legacy class JSON imports into the global constructor');
  const legacyBefore=JSON.stringify(work(target));await target.import({...legacy,work:{...legacy.work,ids:[selected[2].id,selected[3].id]}});
  test(JSON.stringify(work(target))===legacyBefore,'legacy class JSON cannot smuggle foreign exam IDs past its class boundary');
  test(target.state().library.some(entry=>entry.ids.length===expectedIds.length),'opening a legacy file preserves the previous mixed work in the library');
 });
 await scenario('old browser drafts remain accessible after migration',async()=>{
  const old6=classTask(6,'basic'),old11=selected[2];
  const saved={version:2,student:{},attempts:[],works:[['6:basic',{ids:[old6.id],title:'Черновик 6 класса',variant:'1',answers:false}],['11:advanced',{ids:[old11.id],title:'Черновик 11 класса',variant:'2',answers:true}]],library:[{id:'old-library',grade:6,level:'basic',ids:[old6.id],title:'Ранее сохранённая',variant:'3',answers:true,created:'2026-10-01'}],favorites:[old6.id],resumeRoute:{role:'teacher',view:'builder',grade:11,level:'advanced'}};
  const state=new Map([[KEY,JSON.stringify(saved)]]);let legacy=createHarness(state);await legacy.click('[data-action="resume"]');
  const migrated=legacy.state();
  test(migrated.resumeRoute.view==='builder'&&migrated.resumeRoute.grade===null,'an old teacher builder route migrates to the global constructor');
  test(['6:basic','11:advanced'].every(key=>migrated.works.some(([name])=>name===key)),'migration retains the original class draft records');
  for(const [id,task,title] of [['migration:6:basic',old6,'Черновик 6 класса'],['migration:11:advanced',old11,'Черновик 11 класса'],['old-library',old6,'Ранее сохранённая']]){
   const entry=migrated.library.find(x=>x.id===id);
   test(entry&&same(entry.ids,[task.id])&&entry.title===title,'migration exposes '+title+' in the common library');
   await legacy.click(`[data-action="load-work"][data-id="${id}"]`);
   test(same(work(legacy).ids,[task.id])&&work(legacy).title===title,'the migrated library reopens '+title);
  }
  legacy.pagehide();legacy=createHarness(state);await legacy.click('[data-action="resume"]');
  test(legacy.state().library.filter(entry=>entry.id==='migration:6:basic').length===1&&legacy.state().library.filter(entry=>entry.id==='migration:11:advanced').length===1,'repeated reload does not duplicate migrated class drafts');
  const groups=[...new Set(BANK.map(topic=>`${topic.grade}:${topic.level}`))];
  const everyOldDraft=groups.map(key=>{const [grade,level]=key.split(':');return [key,{ids:[classTask(Number(grade),level).id],title:'Старый '+key,variant:'1',answers:false}];});
  const mixed={ids:expectedIds,title:'Последний общий черновик',variant:'7',answers:true};
  const full=createHarness(new Map([[KEY,JSON.stringify({...saved,works:[...everyOldDraft,['unified',mixed]],resumeRoute:{role:'teacher',view:'builder'}})]]));
  await full.click('[data-action="resume"]');
  test(same(work(full).ids,expectedIds)&&work(full).title===mixed.title,'restoration keeps the unified draft after all nine legacy class drafts');
 });
 await scenario('unknown saved IDs and oversized composition are sanitized',async()=>{
  const valid=[...classes.slice(0,65),selected[3]].map(q=>q.id),ids=[valid[0],'unknown-id',null,valid[0],...valid.slice(1)];
  const saved={version:2,student:{},attempts:[],works:[['unified',{ids,title:'Смешанная после восстановления',variant:'1',answers:'true'}]],library:[{id:'unsafe',grade:null,level:null,ids:[selected[3].id,'unknown-id',selected[3].id],title:'Санитизация',variant:'1',answers:false}],favorites:['unknown-id',selected[3].id],resumeRoute:{role:'teacher',view:'builder'}};
  const restored=createHarness(new Map([[KEY,JSON.stringify(saved)]]));await restored.click('[data-action="resume"]');
  test(same(work(restored).ids,valid.slice(0,60))&&work(restored).answers===false,'restored mixed work rejects unknown IDs, deduplicates, enforces the 60-task limit and validates booleans');
  test(restored.state().library.some(entry=>entry.id==='unsafe'&&same(entry.ids,[selected[3].id])),'restored common library sanitizes unknown and duplicate exam IDs');
  test(same(restored.state().favorites,[selected[3].id]),'mixed favorites reject unknown IDs and retain a valid official example');
  const clean=restored.context.sanitizeWork({ids:expectedIds},all);
  test(same(clean.ids,expectedIds),'global sanitizer permits valid class and exam IDs in their original order');
  const strict=restored.context.sanitizeWork({ids:expectedIds},all,11,'advanced');
  test(same(strict.ids,[selected[2].id]),'explicit legacy grade and programme retain their original import boundary');
 });
 test(h.networkCalls()===0,'building, restoring, previewing and exporting a mixed work require no network request');
 test(sourceDigest()===originalSourceDigest,'constructing and generating variants never changes the class trainer or official exam source data');
 const report={checks,errors,scope:'Actual app IIFE events and local state, mixed JSON and PDF generator call contract; PDF layout audited separately',sources:selected.map(sourceValue)};
 fs.writeFileSync(path.join(root,'checks/unified-work-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
