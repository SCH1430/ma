const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness,BANK,QUALITY_BANK}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root),tasks=QUALITY_BANK.tasks;
let checks=0;const test=(value,label)=>{checks++;assert.ok(value,label);};
const work=h=>h.state().works.find(([id])=>id==='unified')[1];
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
async function download(h,action){await h.click(`[data-action="${action}"]`);const d=h.document.downloads.at(-1);return JSON.parse(await h.blobs.get(d.url).text());}
(async()=>{
 const h=createHarness();await teacher(h);await h.change('#source-filter','quality');
 test(h.get('#auto-available').textContent.includes('600'),'New source is reachable and counts all 600 tasks');
 for(const p of QUALITY_BANK.packets){
  await h.change('#bank-filter',p.topicId);
  test(h.get('#auto-available').textContent.includes('20'),p.topicId+' has exactly 20 candidates');
  const q=tasks.find(q=>q.topicId===p.topicId);await h.input('#bank-search',q.id);
  test(h.document.querySelectorAll('.bank-task').length===1,p.topicId+' exact ID and topic intersect');
  test(h.text().includes('версия 1')&&h.text().includes(q.hint),p.topicId+' editorial revision and teacher hint are shown');
  await h.input('#bank-search','');
 }
 await h.change('#bank-filter','5-204');await h.change('#selection-mode','diverse');await h.input('#auto-count','12');await h.click('[data-action="auto-build"]');
 const selected=work(h).ids.map(id=>tasks.find(q=>q.id===id));
 test(selected.length===12&&new Set(selected.map(q=>q.family)).size===12,'Diverse mode selects twelve different authored families');
 test(selected.filter(q=>q.kind==='open').length===4,'The complete topic selection contains four reasoning tasks');
 for(const q of tasks){
  test(h.context.MathBankPedagogy.forTask(q).length===q.skills.length,q.id+' explicit skills remain recognized');
  if(q.kind==='number')test(h.context.checkAnswer(q.display,q).correct,q.id+' exact display is accepted by the real answer parser');
 }
 const q=tasks.find(q=>q.id==='quality-9-11-03-1'),open=tasks.find(q=>q.id==='quality-10-307-09-1');
 await h.import({format:'mat1430-work',version:2,work:{title:'Новый банк',variant:'1',ids:[q.id,open.id],answers:true}});
 const payload=await download(h,'export-work');test(payload.work.ids.join()===`${q.id},${open.id}`,'Work interchange retains stable IDs');
 const store=new Map();let student=createHarness(store);await student.click('[data-role="student"]');await student.click('[data-action="works-home"]');await student.import(payload);await student.click('[data-action="run-work"]');
 test(!student.text().includes(q.solution),'Teacher answer setting never exposes the solution at start');
 test(!!student.document.querySelector('svg'),'Authored coordinate figure reaches the runner');
 await student.click('[data-action="run-hint"]');
 test(student.text().includes(q.hint)&&!student.text().includes(q.solution),'Next-step hint is separate from the full solution');
 await student.input('#work-run-answer',q.display);await student.submit('#work-run-answer-form');
 test(student.state().activeRun.records[q.id].hintBeforeAnswer,'Hint assistance is recorded before correct submission');
 student.flush();student.pagehide();student=createHarness(store);await student.click('[data-action="resume"]');
 test(student.state().activeRun.records[q.id].hintUsed,'Hint provenance survives reload');
 await student.click('[data-action="run-next"]');await student.input('#work-run-draft','Оба исходных аргумента положительны только при x > 1.');await student.click('[data-action="run-reveal"]');
 for(let i=0;i<3;i++)await student.change(`[data-run-rubric="${i}"]`,true);
 await student.click('[data-action="run-review"]');await student.click('[data-action="run-finish"]');
 const result=await download(student,'run-export');
 test(result.summary.afterHint===1&&result.summary.independent===0&&result.summary.reviewed===1,'Assisted numeric answer and manual review remain distinct');
 test(result.tasks[0].revision===1&&result.tasks[0].contentHash===q.contentHash,'Result identifies exact authored revision');
 const runner=student.context.MathWorkRunner,old=student.state().activeRun;
 const changed=runner.sanitizeSession(old,[{...q,contentHash:'changed',revision:2},open],student.context.checkAnswer);
 test(!changed.records[q.id].correct&&!changed.records[q.id].submitted,'Stale success is not carried to a changed revision');
 test(changed.records[q.id].previousAttempt.draft===q.display,'Previous revision answer is retained without crediting the changed task');
 test(runner.sanitizeSession(changed,[{...q,contentHash:'changed',revision:2},open],student.context.checkAnswer).records[q.id].previousAttempt.draft===q.display,'Archived answer survives a second reload');
 test(student.networkCalls()===0&&h.networkCalls()===0,'All new tasks, hints and review flows are offline');

 // Exercise the real PDF engine using two representative families per packet,
 // all coordinate figures, and every glyph in the full authored bank.
 const PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit'),{FONT_BASE64}=page.dataValues();
 const audit=require('./audit_unified_pdf.cjs')(PDFLib);
 const runtime=new Function('PDFLib','fontkit','BANK','QUALITY_BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn {createMathPDF,mathTokens,geometryFigure};')(PDFLib,fontkit,BANK,QUALITY_BANK,FONT_BASE64);
 const font=fontkit.create(Buffer.from(FONT_BASE64,'base64')),supported=new Set(font.characterSet);
 const flat=s=>runtime.mathTokens(s).map(t=>t.type==='fraction'?flat(t.top)+flat(t.bottom):t.text).join('');
 const glyphs=tasks.flatMap(q=>[q.prompt,q.solution,q.hint,...(q.rubric||[])]).flatMap(s=>[...flat(s)]);
 test(glyphs.every(c=>!c.trim()||supported.has(c.codePointAt(0))),'Embedded font covers every glyph in 600 tasks');
 const sample=tasks.filter(q=>q.id.endsWith('-06-1')||q.id.endsWith('-09-1')||q.figure);
 for(const task of tasks.filter(q=>q.figure))test(runtime.geometryFigure(task.id)?.elements.length===task.figure.elements.length,task.id+' uses authored figure for screen and PDF');
 const bytes=await runtime.createMathPDF({tasks:sample,title:'Тематические пакеты · проверка печати',variant:'1',grade:null,level:null,answers:true});
 const output=path.join(root,'output/pdf/quality-bank-review.pdf');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
 const normalize=s=>String(s).replace(/[–—−]/g,'-').replace(/\s/g,''),actual=normalize(audit.documents[0].pages.flatMap(p=>p.text).map(r=>r.value).join(''));
 for(const task of sample){test(actual.includes(normalize(flat(task.prompt))),task.id+' full statement printed');test(actual.includes(normalize(flat(task.solution))),task.id+' full solution printed');for(const r of task.rubric||[])test(actual.includes(normalize(flat(r))),task.id+' criterion printed');}
 const layout=audit.finish();test(!layout.failures.length,'No PDF clipping or orphan labels: '+JSON.stringify(layout.failures));
 const pdf=await PDFLib.PDFDocument.load(bytes);test(pdf.getPageCount()===audit.documents[0].pages.length,'Generated PDF reopens');
 const report={checks,tasks:tasks.length,source:'quality',pdf:{file:output,tasks:sample.length,pages:pdf.getPageCount(),layoutFailures:layout.failures},status:'passed'};
 fs.writeFileSync(path.join(root,'checks/quality-ui-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
