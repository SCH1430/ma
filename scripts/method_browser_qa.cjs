// Offline file:// integration in a real browser, including a real authored PDF.
// QA records live only in isolated browser contexts; publication stays pending.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {PDFDocument}=require('../src/vendor/pdf-lib.min.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/method-browser-qa'),entry=pathToFileURL(path.join(root,'index.html')).href;
const report={scenarios:[],pageErrors:[],remoteRequests:[]};
async function ready(page){await page.locator('[data-role="teacher"]:enabled').waitFor();}
async function noOverflow(page,label){const box=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert(box.content<=box.width+1,label+': '+JSON.stringify(box));}
async function download(page,selector,name){const event=page.waitForEvent('download',{timeout:90000});await page.locator(selector).click();const file=await event,target=path.join(out,name);await file.saveAs(target);return target;}
async function classes(page,role){if(await page.locator('#app').isVisible()){if(!await page.locator('[data-action="home"]').count()&&await page.locator('[data-action="end-session"]').count())await page.locator('[data-action="end-session"]').click();for(let i=0;i<6&&!await page.locator('[data-action="home"]').count()&&await page.locator('#app').isVisible();i++){await page.locator('[data-action="back"]').first().click();await page.waitForTimeout(50);}if(await page.locator('#app').isVisible())await page.locator('[data-action="home"]').first().click();}await page.locator(`[data-role="${role}"]`).click();}
async function methodHome(page,role){await classes(page,role);await page.locator('[data-action="method-home"]').click();await page.locator('.method-card').first().waitFor();}
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',acceptDownloads:true,timezoneId:'Europe/Moscow'});await context.setOffline(true);
   await context.addInitScript(()=>{const OriginalDate=Date;globalThis.__methodNow=OriginalDate.parse('2026-11-01T10:00:00Z');globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[globalThis.__methodNow]));}static now(){return globalThis.__methodNow;}};});
   const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',error=>report.pageErrors.push({scenario:name,message:error.message}));page.on('request',request=>{if(/^https?:/.test(request.url()))report.remoteRequests.push(request.url());});
   await page.goto(entry);await ready(page);await methodHome(page,'student');
   assert.equal(await page.evaluate(()=>METHOD_BANK.tasks.length),80);assert.deepEqual(await page.evaluate(()=>MathDataLoader.snapshot().loaded),['methods']);await noOverflow(page,name+' catalog');
   await page.screenshot({path:path.join(out,name+'-catalog.png')});const resultFiles=[];
   for(const kind of ['interval','coordinates','expression','matching','steps','examples']){
    if(kind!=='interval')await methodHome(page,'student');await page.locator('#method-kind').selectOption(kind);await page.locator('.method-card').first().waitFor();
    const id=await page.locator('.method-card').first().getAttribute('data-method-task'),task=await page.evaluate(id=>METHOD_BANK.tasks.find(q=>q.id===id),id);assert.equal(task.kind,kind);
    await page.locator(`[data-action="method-run-one"][data-id="${id}"]`).click();if(await page.locator('[data-action="replace-run"]').count())await page.locator('[data-action="replace-run"]').click();await page.locator('#work-run-answer').waitFor();await page.bringToFront();
    if(kind==='steps')assert(await page.locator('.answer-options').isVisible());
    if(kind==='matching')assert.equal(await page.locator('.answer-options').count(),2);
    if(task.representations.some(r=>r.type==='graph'))assert(await page.locator('.method-graph svg').isVisible());
    await page.evaluate(()=>{__methodNow+=1000;});await page.locator('#work-run-answer').fill(task.display);await page.locator('#work-run-answer-form button').click();
    assert((await page.locator('#work-run-feedback').textContent()).includes('Ответ верный'));
    const record=await page.evaluate(id=>JSON.parse(localStorage.getItem('mat1430.workspace.v2')).activeRun.records[id],id);assert(record.firstValidAttempt.correct&&record.firstValidAttempt.valid);assert(record.firstValidAttempt.timingRecorded);assert(record.firstValidAttempt.activeMs>=1000);assert.equal(record.firstValidAttempt.contentHash,task.contentHash);
    await noOverflow(page,name+' '+kind);await page.screenshot({path:path.join(out,name+'-'+kind+'.png'),fullPage:true});
    await page.locator('[data-action="run-finish"]').first().click();const target=await download(page,'[data-action="run-export"]',name+'-'+kind+'-results.json'),result=JSON.parse(await fs.readFile(target,'utf8'));assert.equal(result.participantRole,'student');assert(result.tasks[0].firstValidAttempt.correct);resultFiles.push(target);
   }
   await classes(page,'teacher');await page.locator('[data-action="report-home"]').click();await page.locator('#report-files').setInputFiles(resultFiles);await page.locator('.bank-evidence table').waitFor();
   const observed=await page.evaluate(()=>MathTeacherReport.aggregate(JSON.parse(localStorage.getItem('mat1430.workspace.v2')).teacherReports,METHOD_BANK.tasks).evidence);assert.equal(observed.observations,6);assert(observed.tasks.every(q=>q.n===1&&q.timeN===1&&!q.preliminary));await noOverflow(page,name+' report');await page.screenshot({path:path.join(out,name+'-evidence.png'),fullPage:true});
   await methodHome(page,'teacher');await page.locator('#method-kind').selectOption('coordinates');const reviewId=await page.locator('.method-card').first().getAttribute('data-method-task');
   assert((await page.locator('.method-review-status').first().textContent()).includes('Ожидает рецензии учителя'));await page.locator(`[data-action="method-review"][data-id="${reviewId}"]`).click();await page.locator('#editorial-review-form').waitFor();
   await page.locator('#editorial-reviewer').fill('QA: тест интерфейса');await page.locator('#editorial-comment').fill('Изолированная тестовая запись для проверки UI, экспорта и резервной копии.');for(const box of await page.locator('[data-editorial-criterion]').all())await box.check();await page.locator('#editorial-review-form button').click();
   assert((await page.locator('.editorial-review').textContent()).includes('Проверено учителем'));await noOverflow(page,name+' editorial');await page.screenshot({path:path.join(out,name+'-editorial.png'),fullPage:true});
   const reviewFile=await download(page,'[data-action="editorial-export"]',name+'-qa-editorial.json'),reviewData=JSON.parse(await fs.readFile(reviewFile,'utf8'));assert.equal(reviewData.reviews.length,1);assert.equal(reviewData.reviews[0].taskId,reviewId);
   await page.reload();await ready(page);await page.locator('[data-action="resume"]').click();await page.locator('#editorial-reviewer').waitFor();assert.equal(await page.locator('#editorial-reviewer').inputValue(),'QA: тест интерфейса');
   await page.locator('#editorial-file').setInputFiles(reviewFile);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mat1430.workspace.v2')).editorialStore.reviews.length),1);
   await page.locator('[data-action="backup-home"]').click();const backupFile=await download(page,'[data-action="backup-export"]',name+'-qa-workspace.json'),backup=JSON.parse(await fs.readFile(backupFile,'utf8'));assert.equal(backup.workspace.editorialStore.reviews.length,1);assert.equal(backup.workspace.teacherReports.length,6);
   await page.locator('#backup-file').setInputFiles(backupFile);await page.locator('#backup-preview').waitFor();await page.locator('[data-action="backup-cancel"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mat1430.workspace.v2')).editorialStore.reviews.length),1);
   await methodHome(page,'teacher');await page.locator('[data-action="method-reset"]').click();await page.locator('[data-action="method-builder"]').click();await page.locator('#source-filter').waitFor();assert.equal(await page.locator('#source-filter').inputValue(),'methods');
   const selected=await page.evaluate(()=>[METHOD_BANK.tasks.find(q=>q.kind==='steps'),METHOD_BANK.tasks.find(q=>q.kind==='matching'),METHOD_BANK.tasks.find(q=>q.representations.some(r=>r.type==='graph'))].map(q=>({id:q.id,stepOptions:q.stepOptions||[],matchingOptions:q.matchingOptions||[],representations:q.representations})));
   for(const q of selected){await page.locator('#bank-search').fill(q.id);await page.locator(`[data-action="add"][data-id="${q.id}"]`).click();}
   if(name==='mobile')await page.locator('[data-action="open-work"]').click();await page.locator('[data-action="print-preview"]').click();await page.locator('[data-action="download"]').waitFor();
   await page.evaluate(async()=>{await MathDataLoader.ensurePDF();const original=createMathPDF;globalThis.__methodPdf={texts:[],circles:0,segments:0};globalThis.createMathPDF=async options=>{const create=PDFLib.PDFDocument.create;PDFLib.PDFDocument.create=async(...args)=>{const doc=await create(...args),add=doc.addPage.bind(doc);doc.addPage=(...params)=>{const p=add(...params),text=p.drawText.bind(p),circle=p.drawCircle.bind(p),line=p.drawLine.bind(p);p.drawText=(s,o)=>{__methodPdf.texts.push(s);return text(s,o);};p.drawCircle=o=>{__methodPdf.circles++;return circle(o);};p.drawLine=o=>{if(o.thickness===1.7)__methodPdf.segments++;return line(o);};return p;};return doc;};try{return await original(options);}finally{PDFLib.PDFDocument.create=create;}};});
   const pdfFile=await download(page,'[data-action="download"]',name+'-methods-options-graph.pdf'),bytes=await fs.readFile(pdfFile),pdf=await PDFDocument.load(bytes);assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert(pdf.getPageCount()>0);
   const drawn=await page.evaluate(()=>__methodPdf),normalize=value=>value.replace(/[\s/]+/g,''),printed=normalize(drawn.texts.join(' '));await fs.writeFile(path.join(out,name+'-pdf-drawing.json'),JSON.stringify(drawn,null,2)+'\n');assert(printed.includes('Шагидляупорядочивания:'));assert(printed.includes('Вариантысоответствия:'));assert(drawn.circles>=2&&drawn.segments>=1,'Actual PDF contains graph points and segments');
   // PDF fractions are drawn as numerator, bar and denominator, not slash text.
   for(const row of selected.find(q=>q.stepOptions.length).stepOptions)assert(printed.includes(normalize(row.id+'. '+row.text)),'Actual PDF includes each identified step option');for(const row of selected.find(q=>q.matchingOptions.length).matchingOptions)assert(printed.includes(normalize(row.id+'. '+row.text)),'Actual PDF includes identified matching options');
   assert(await page.evaluate(()=>METHOD_BANK.tasks.every(q=>q.editorialStatus==='teacher_pending')),'QA never changes publication to assert teacher review');
   report.scenarios.push({name,formats:6,sourceTasks:80,actualStudentResultFiles:6,observations:observed.observations,reviewAndBackupRoundTrip:true,pdfPages:pdf.getPageCount(),pdfGraphPoints:drawn.circles,pdfGraphSegments:drawn.segments});await context.close();
  }
  assert.deepEqual(report.remoteRequests,[],'Offline app must not request remote resources');assert.deepEqual(report.pageErrors,[],'No uncaught browser errors');await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
