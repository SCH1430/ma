// Real-browser smoke tests. Run after build.py; Playwright is a QA dependency.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {PDFDocument}=require('../src/vendor/pdf-lib.min.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/browser-qa');
const entry=pathToFileURL(path.join(root,'index.html')).href;
const report={scenarios:[],pageErrors:[],remoteRequests:[]};
async function download(page,selector,name){const event=page.waitForEvent('download',{timeout:90000});await page.locator(selector).click();const file=await event,target=path.join(out,name);await file.saveAs(target);return target;}
async function noOverflow(page,label){const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));assert(size.content<=size.viewport+1,label+': horizontal overflow '+JSON.stringify(size));}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('[data-role="teacher"]')?.disabled&&(!!document.querySelector('#dashboard')||!document.querySelector('#welcome')?.hidden));}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',acceptDownloads:true});await context.setOffline(true);
   const page=await context.newPage();page.setDefaultTimeout(20000);
   page.on('pageerror',error=>report.pageErrors.push({scenario:name,message:error.message}));
   page.on('request',request=>{if(/^https?:/.test(request.url()))report.remoteRequests.push(request.url());});
   await page.goto(entry);await ready(page);await noOverflow(page,name+' welcome');
   assert.equal(await page.title(),'БАЗА · Математика школы 1430');
   assert.deepEqual(await page.evaluate(()=>MathDataLoader.snapshot().loaded),[]);
   await page.locator('[data-role="teacher"]').click();await page.locator('[data-action="grade"][data-grade="5"]').click();
   await page.locator('.topic-card').first().waitFor();
   assert.deepEqual(await page.evaluate(()=>MathDataLoader.snapshot().loaded),['class:5']);
   const task=await page.evaluate(()=>BANK.find(t=>t.grade===5).tasks[0]);
   await page.locator('[data-action="train"]').first().click();
   assert(await page.locator('#lesson-example-body').isHidden());
   if(name==='mobile'){const answer=await page.locator('#answer').boundingBox();assert(answer&&answer.y+answer.height<=height,'short practice response fits the first mobile screen');}
   await page.locator('[data-action="lesson-toggle"]').click();assert(await page.locator('#lesson-example-body').isVisible());
   await page.locator('[data-action="lesson-practice"]').click();assert(await page.locator('#answer').evaluate(input=>input===document.activeElement));
   await page.locator('#answer').fill(task.display);await page.locator('#answer-form button').click();
   assert((await page.locator('#feedback').textContent()).includes('Верно'));
   await noOverflow(page,name+' trainer');await page.screenshot({path:path.join(out,name+'-trainer.png')});
   await page.locator('[data-action="back"]').first().click();await page.locator('[data-action="builder"]').first().click();await page.locator('#source-filter').waitFor();
   assert.deepEqual(await page.evaluate(()=>MathDataLoader.snapshot().loaded),['class:5']);
   await page.locator('#bank-search').fill(task.id);await page.locator('[data-action="add"]').first().click();
   if(name==='mobile'){await page.locator('[data-action="open-work"]').click();assert(await page.locator('#work-panel').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action="open-work"]').getAttribute('aria-expanded'),'false');}
   await noOverflow(page,name+' builder');await page.screenshot({path:path.join(out,name+'-builder.png')});
   if(name==='desktop'){
    await page.locator('#source-filter').selectOption('exam:oge-2027');await page.locator('.exam-bank-task').first().waitFor();await page.locator('.exam-bank-task [data-action="add"]').first().click();
    await page.locator('#source-filter').selectOption('class:5:basic');
   }
   if(name==='mobile')await page.locator('[data-action="open-work"]').click();
   await page.locator('[data-action="print-preview"]').click();await page.locator('[data-action="download"]').waitFor();
   assert.equal(await page.evaluate(()=>typeof PDFLib),'undefined');
   await page.evaluate(()=>{const create=createMathPDF;globalThis.__qaPdfText=[];globalThis.createMathPDF=async options=>{await MathDataLoader.ensurePDF();const original=PDFLib.PDFDocument.create;PDFLib.PDFDocument.create=async(...args)=>{const doc=await original(...args),add=doc.addPage.bind(doc);doc.addPage=(...params)=>{const page=add(...params),draw=page.drawText.bind(page);page.drawText=(text,style)=>{__qaPdfText.push(text);return draw(text,style);};return page;};return doc;};try{return await create(options);}finally{PDFLib.PDFDocument.create=original;}};});
   const pdfFile=await download(page,'[data-action="download"]',name+'-work.pdf'),bytes=await fs.readFile(pdfFile),pdf=await PDFDocument.load(bytes);
   assert(bytes.subarray(0,4).toString()==='%PDF');assert(pdf.getPageCount()>0);assert.equal(pdf.getAuthor(),'БАЗА · Математика школы 1430');
   if(name==='desktop'){const text=(await page.evaluate(()=>__qaPdfText)).join('\n');assert(text.includes('2027'));assert(text.includes('проект демоверсии'));assert(!text.includes('ФИПИ 2026'));assert(!pdf.getSubject().includes('2026'));}
   assert((await page.evaluate(()=>MathDataLoader.snapshot().loaded)).includes('pdf-font'));
   await page.locator('[data-action="backup-home"]').click();
   const backupFile=await download(page,'[data-action="backup-export"]',name+'-workspace.json');
   const backup=JSON.parse(await fs.readFile(backupFile,'utf8'));assert.equal(backup.format,'baza-workspace-backup');assert(backup.workspace.works.find(([key])=>key==='unified')[1].ids.includes(task.id));
   await page.locator('#backup-file').setInputFiles(backupFile);await page.locator('#backup-preview').waitFor();await page.locator('[data-action="backup-cancel"]').click();
   await page.reload();await ready(page);assert.deepEqual((await page.evaluate(()=>MathDataLoader.snapshot().loaded)).sort(),(name==='desktop'?['class:5','exam:oge-2027']:['class:5']).sort());
   await page.locator('[data-action="resume"]').click();await page.locator('[data-action="back"]').first().click();
   // Start a fresh role choice to cover the new learning entry without relying on history internals.
   if(!await page.locator('[data-role="teacher"]').isVisible())await page.locator('[data-action="home"]').first().click();await page.locator('[data-role="teacher"]').click();await page.locator('[data-action="nav-catalog"]').first().click();
   await page.locator('[data-action="learning-home"]').click();await page.locator('.learning-path').waitFor();await page.locator('#learning-grade').selectOption('8');await page.locator('[data-action="learning-lesson"]').first().waitFor();await noOverflow(page,name+' learning');
   await page.screenshot({path:path.join(out,name+'-learning.png')});
   await page.locator('[data-action="learning-lesson"]').first().click();await page.locator('[data-action="learning-lesson-practice"]').waitFor();
   await noOverflow(page,name+' lesson');await page.screenshot({path:path.join(out,name+'-lesson.png'),fullPage:true});
   await page.locator('[data-action="learning-lesson-practice"]').click();await page.locator('.work-runner').waitFor();
   const answer=await page.evaluate(()=>{const run=JSON.parse(localStorage.getItem('mat1430.workspace.v2')).activeRun;return MathLearningContent.tasks.find(q=>q.id===run.ids[0]).display;});
   await page.locator('#work-run-answer').fill(answer);await page.locator('#work-run-answer-form button').click();await page.locator('[data-action="run-finish"]').first().click();
   const resultsFile=await download(page,'[data-action="run-export"]',name+'-results.json');
   await page.locator('[data-action="home"]').first().click();await page.locator('[data-role="teacher"]').click();await page.locator('[data-action="report-home"]').click();
   await page.locator('#report-files').setInputFiles(resultsFile);await page.locator('.report-summary').first().waitFor();await noOverflow(page,name+' report');
   assert((await page.locator('.report-summary').first().textContent()).includes('1 прохождений'));
   const csvFile=await download(page,'[data-action="report-export"]',name+'-class.csv');assert((await fs.readFile(csvFile,'utf8')).includes('Самостоятельно'));
   await page.screenshot({path:path.join(out,name+'-report.png')});
   const followup=page.locator('[data-action="report-practice"]').first();await followup.click();
   await page.locator('#source-filter').waitFor();
   if(name==='mobile')assert.equal(await page.locator('[data-action="open-work"]').getAttribute('aria-expanded'),'true');
   await page.locator('#work-panel .practice-example').waitFor();
   await page.locator('[data-action="print-preview"]').click();
   await page.locator('.print-root .practice-example').waitFor();
   await download(page,'[data-action="download"]',name+'-report-practice.pdf');
   report.scenarios.push({name,fileProtocol:true,isolatedClass:true,actualPDFPages:pdf.getPageCount(),...(name==='desktop'?{actualPDFExamYear:2027,projectLabelInPDF:true}:{}),backupRoundTripPreview:true,learningLessonPractice:true,teacherResultImportCSV:true});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});await context.setOffline(true);const page=await context.newPage();
  page.on('pageerror',error=>report.pageErrors.push({scenario:'student-exam',message:error.message}));
  page.on('request',request=>{if(/^https?:/.test(request.url()))report.remoteRequests.push(request.url());});
  await page.goto(entry);await ready(page);await page.locator('[data-role="student"]').click();await page.locator('[data-action="nav-catalog"]').first().click();
  const years=await page.locator('#exam-year option').evaluateAll(options=>options.map(option=>option.value));
  assert(years.includes('2026'));
  const latest=years[0];await page.locator('#exam-year').selectOption(latest);await page.locator('[data-action="exam-start"]').first().click();
  await page.locator('.exam-trainer .task-statement img').first().waitFor();
  assert((await page.evaluate(()=>MathDataLoader.snapshot().loaded)).every(key=>key.startsWith('exam:')));
  await page.waitForFunction(()=>[...document.querySelectorAll('.exam-trainer img')].every(img=>img.complete&&img.naturalWidth>0));
  const images=await page.locator('.exam-trainer img').evaluateAll(images=>images.map(img=>({complete:img.complete,width:img.naturalWidth})));assert(images.length&&images.every(img=>img.complete&&img.width>0));
  if(await page.locator('[data-action="training-fullscreen"]').isVisible())await page.locator('[data-action="training-fullscreen"]').click();
  const fullscreen=await page.evaluate(()=>!!document.fullscreenElement);
  if(fullscreen){await page.evaluate(()=>document.exitFullscreen());await page.locator('[data-action="training-fullscreen"]').waitFor();}
  assert(await page.locator('.training-screen-status').isVisible());
  await page.screenshot({path:path.join(out,'student-exam.png')});
  report.scenarios.push({name:'student-exam',year:latest,years,onlySelectedExamLoaded:true,fullscreenEntered:fullscreen});await context.close();
  const practice=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await practice.setOffline(true);
  const pupil=await practice.newPage();pupil.on('pageerror',error=>report.pageErrors.push({scenario:'student-today',message:error.message}));
  await pupil.goto(entry);await ready(pupil);await pupil.locator('[data-role="student"]').click();
  const today=pupil.locator('.home-hero');assert.equal(await today.locator('.primary').count(),1);
  await noOverflow(pupil,'student today');await pupil.screenshot({path:path.join(out,'mobile-today.png')});
  await today.locator('[data-action="learning-diagnostic"]').click();await pupil.locator('#work-run-answer').waitFor();
  assert(await pupil.locator('body').evaluate(body=>body.classList.contains('is-solving')));
  await pupil.locator('#work-run-answer').fill('1');await pupil.locator('[data-action="nav-home"]').click();
  await today.locator('[data-action="resume-run"]').click();assert.equal(await pupil.locator('#work-run-answer').inputValue(),'1');
  await noOverflow(pupil,'student practice');await pupil.screenshot({path:path.join(out,'mobile-today-task.png')});
  await pupil.locator('[data-action="run-finish"]').first().click();const next=pupil.locator('.work-run-results .next-step');
  assert(await next.isVisible());assert.equal(await next.locator('.primary').count(),1);
  await noOverflow(pupil,'student results');await pupil.screenshot({path:path.join(out,'mobile-today-results.png')});
  await pupil.evaluate(async()=>{
   await MathDataLoader.load('class:6');
   const original=BANK.filter(topic=>topic.grade===6).flatMap(topic=>topic.tasks).find(task=>task.kind==='number'&&task.family&&MathBankPedagogy.forTask(task).join()==='percent');
   if(!original)throw Error('A class task for the percentage skill is required');
   localStorage.setItem('mat1430.workspace.v2',JSON.stringify({version:2,appPreferences:{role:'student',grade:6,level:'basic'},learningState:{version:1,events:[{id:'qa-due-percent',kind:'practice',grade:6,at:new Date(Date.now()-2*86400000).toISOString(),results:[{id:original.id,answer:original.display,submitted:true}]}]}}));
  });
  await pupil.reload();await ready(pupil);await today.locator('[data-action="learning-review"]').click();
  await pupil.locator('.task-context-note').waitFor();
  assert((await pupil.evaluate(()=>JSON.parse(localStorage.getItem('mat1430.workspace.v2')).activeRun.ids)).includes('methods-percent-07'));
  await noOverflow(pupil,'student review');
  report.scenarios.push({name:'student-today',directDiagnostic:true,resumeDraft:true,nextStepInResults:true,reviewWithChangedRepresentation:true});await practice.close();
  assert.deepEqual(report.remoteRequests,[],'the offline application makes no remote request');assert.deepEqual(report.pageErrors,[],'the real browser reports no uncaught app errors');
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
