// Real application events plus a full-size PDF of every authored reasoning task.
const fs=require('node:fs'),path=require('node:path');
const {createHarness,BANK}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const {THINKING_BANK,FONT_BASE64}=page.dataValues(),tasks=THINKING_BANK.tasks;
const byId=new Map(tasks.map(q=>[q.id,q])),before=JSON.stringify(THINKING_BANK);
let checks=0;const errors=[];
const test=(value,message)=>{checks++;if(!value)errors.push(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const work=h=>h.state().works.find(([key])=>key==='unified')[1];
const cards=h=>h.document.querySelectorAll('.bank-task').map(card=>card.dataset.taskId);
async function scenario(label,fn){try{await fn();}catch(error){test(false,label+': '+error.stack);}}
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
async function downloadJSON(h,action){await h.click(`[data-action="${action}"]`);const file=h.document.downloads.at(-1);return JSON.parse(await h.blobs.get(file.url).text());}

(async()=>{
 test(tasks.length===36,'build includes all 36 authored reasoning tasks');
 test(tasks.every(q=>q.kind==='open'&&q.answer===null&&q.rubric.length===3),'reasoning tasks carry manual criteria rather than automatic answers');
 test(tasks.every(q=>q.sourceLabel.includes(q.grade+' класс')&&(q.grade<10||q.sourceLabel.includes(q.level==='advanced'?'углублённый':'базовый'))),'mixed worksheet source captions identify every task class and programme');
 await scenario('reasoning catalogue, format and topic filters',async()=>{
  const h=createHarness();await teacher(h);await h.change('#source-filter','enrichment');
  const first=cards(h);await h.click('[data-action="bank-next"]');
  const all=[...first,...cards(h)];
  test(new Set(all).size===36&&all.every(id=>byId.has(id)),'pagination exposes every supplemental task once');
  for(const format of Object.keys(THINKING_BANK.formats)){
   await h.change('#task-format',format);
   const expected=tasks.filter(q=>q.format===format);
   test(same(cards(h).slice().sort(),expected.map(q=>q.id).sort()),format+' filter includes exactly its nine grade/programme tasks');
   test(h.text().includes(THINKING_BANK.formats[format]),format+' has a readable format name');
  }
  await h.change('#task-format','all');
  for(const q of tasks){
   await h.change('#bank-filter',q.topicId);await h.input('#bank-search',q.id);
   test(same(cards(h),[q.id]),q.id+' is reachable through its canonical topic and exact ID');
  }
  await h.change('#bank-filter','all');await h.input('#bank-search','');await h.change('#task-format','error');
  await h.change('[data-skill="percent"]',true);
  test(same(cards(h),['thinking-6-basic-error']),'format and explicit mathematical micro-skill intersect without broadening');
  test(h.networkCalls()===0,'supplemental filtering is fully offline');
 });

 let payload;const classTopic=BANK.find(t=>t.grade===5),classTask=classTopic.tasks.find(q=>q.kind==='number');
 const chosen=[tasks.find(q=>q.id==='thinking-5-basic-error'),tasks.find(q=>q.id==='thinking-11-advanced-counterexample')];
 const ids=[classTask.id,...chosen.map(q=>q.id)],pdfCalls=[];
 await scenario('mixed work interchange and print pipeline',async()=>{
  const h=createHarness(new Map(),{createMathPDF:async request=>{pdfCalls.push(request);return new Uint8Array(Buffer.from('%PDF-test'));}});await teacher(h);
  await h.change('#source-filter','class:5:basic');await h.input('#bank-search',classTask.id);await h.click(`[data-action="add"][data-id="${classTask.id}"]`);
  await h.change('#source-filter','enrichment');
  for(const q of chosen){await h.input('#bank-search',q.id);await h.click(`[data-action="add"][data-id="${q.id}"]`);}
  test(same(work(h).ids,ids),'mixed work keeps class and reasoning tasks in chosen order');
  await h.input('#work-title','Смешанная работа с рассуждением');await h.change('#include-answers',true);
  await h.input(`[data-note-text="${chosen[1].id}"]`,'Личная запись учителя, не для ученика');h.flush();
  payload=await downloadJSON(h,'export-work');
  test(payload.version===2&&same(payload.work.ids,ids),'version-two export retains reasoning task IDs');
  test(!JSON.stringify(payload).includes('Личная запись учителя'),'teacher annotations are absent from pupil interchange');
  test(!Object.hasOwn(payload,'tasks')&&chosen.every(q=>payload.work.ids.includes(q.id)),'portable work references installed bank IDs without copying answer keys into interchange');
  await h.click('[data-action="print-preview"]');
  test(h.document.querySelectorAll('.print-question').length===3,'print preview contains the full mixed worksheet');
  await h.click('[data-action="download"]');
  const request=pdfCalls.at(-1);
  test(same(request?.tasks.map(q=>q.id),ids)&&request.answers===true,'download sends the ordered mixed work and teacher-key setting to real PDF API');
  for(const q of chosen)test(request.tasks.find(t=>t.id===q.id)?.solution===q.solution,q.id+' PDF pipeline retains the authored solution');
  const receiver=createHarness();await teacher(receiver);await receiver.import(payload);
  test(same(work(receiver).ids,ids),'teacher JSON import restores the mixed work');
  test(receiver.networkCalls()===0,'JSON import needs no external task download');
 });

 await scenario('student reasoning self-review and continuation',async()=>{
  const store=new Map();let h=createHarness(store);
  await h.click('[data-role="student"]');await h.click('[data-action="works-home"]');
  await h.import(payload);await h.click('[data-action="run-work"]');await h.click('[data-action="run-next"]');
  const q=chosen[0];
  test(!h.text().includes(q.solution),'starting an open task never reveals its solution from teacher export');
  await h.input('#work-run-draft','Сначала выполняю деление 6 : 3 = 2, затем вычитание 18 − 2 = 16.');h.flush();
  test(!h.state().activeRun.records[q.id].correct,'written reasoning is never marked automatically correct');
  await h.click('[data-action="run-reveal"]');
  test(h.document.querySelectorAll('[data-run-rubric]').length===3,'authored criteria are shown for manual comparison');
  test(h.get('[data-action="run-review"]').disabled,'self-review is unavailable until every criterion is checked');
  for(let i=0;i<q.rubric.length;i++)await h.change(`[data-run-rubric="${i}"]`,true);
  await h.click('[data-action="run-review"]');
  test(h.state().activeRun.records[q.id].reviewed&&!h.state().activeRun.records[q.id].correct,'self-review is distinct from an automatic correct answer');
  h.flush();h.pagehide();h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().activeRun.records[q.id].reviewed&&h.state().activeRun.index===1,'refresh preserves the exact task and manual review');
  await h.input('#work-run-draft','Исправляю рассуждение после сверки.');h.flush();
  test(!h.state().activeRun.records[q.id].reviewed&&!h.state().activeRun.records[q.id].checks.length,'editing reasoning invalidates stale self-review');
  for(let i=0;i<q.rubric.length;i++)await h.change(`[data-run-rubric="${i}"]`,true);
  await h.click('[data-action="run-review"]');await h.click('[data-action="run-finish"]');
  const results=await downloadJSON(h,'run-export'),entry=results.tasks.find(t=>t.id===q.id);
  test(entry.correct===null&&entry.reviewed===true&&results.summary.reviewed===1,'result export preserves manual status without manufacturing a numeric score');
  test(h.networkCalls()===0,'reasoning work, criteria, refresh and results are offline');
 });

 let pdfReport;
 await scenario('all 36 reasoning tasks in a real teacher-key PDF',async()=>{
  const PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit');
  const font=fontkit.create(Buffer.from(FONT_BASE64,'base64')),supported=new Set(font.characterSet);
  const audit=require('./audit_unified_pdf.cjs')(PDFLib);
  const runtime=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn {createMathPDF,mathTokens};')(PDFLib,fontkit,BANK,FONT_BASE64);
  const bytes=await runtime.createMathPDF({tasks,title:'Задания на понимание · 5–11 классы',variant:'1',grade:null,level:null,answers:true});
  const output=path.join(root,'output/pdf/enrichment-sample.pdf');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  const document=audit.documents[0],runs=document.pages.flatMap(p=>p.text),missing=[...new Set(runs.flatMap(r=>[...r.value]).filter(c=>c.trim()&&!supported.has(c.codePointAt(0))))];
  test(missing.length===0,'embedded font covers every rendered reasoning glyph: '+missing.join(' '));
  const normalized=s=>String(s).replace(/[–—−]/g,'-').replace(/\s/g,'');
  const flattened=value=>runtime.mathTokens(value).map(t=>t.type==='fraction'?flattened(t.top)+flattened(t.bottom):t.text).join('');
  const actual=normalized(runs.map(r=>r.value).join(''));
  for(const q of tasks){
   test(actual.includes(normalized(flattened(q.prompt))),q.id+' complete statement is drawn in the PDF');
   test(actual.includes(normalized(flattened(q.solution))),q.id+' complete worked solution is drawn in the teacher key');
   for(const [i,criterion] of q.rubric.entries())test(actual.includes(normalized(flattened(criterion))),q.id+' rubric '+i+' is drawn in the teacher key');
  }
  const layout=audit.finish();
  test(layout.failures.length===0,'PDF has no clipping, empty content pages or orphan labels: '+JSON.stringify(layout.failures));
  test(layout.taskLabels>=72,'every task is numbered in both worksheet and teacher key');
  const doc=await PDFLib.PDFDocument.load(bytes);
  test(doc.getPageCount()===document.pages.length&&bytes.length>10000,'saved PDF reopens with the audited number of pages');
  pdfReport={file:output,tasks:tasks.length,criteria:tasks.reduce((n,q)=>n+q.rubric.length,0),pages:doc.getPageCount(),missingGlyphs:missing,layout};
 });
 test(JSON.stringify(THINKING_BANK)===before,'filtering, exports, review and PDF leave authored content immutable');
 const report={checks,errors,tasks:tasks.length,pdf:pdfReport};
 fs.writeFileSync(path.join(root,'checks/enrichment-ui-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks,errors,tasks:tasks.length,pdf:pdfReport&&{file:pdfReport.file,pages:pdfReport.pages,criteria:pdfReport.criteria,missingGlyphs:pdfReport.missingGlyphs,layoutFailures:pdfReport.layout.failures}},null,2));
 if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
