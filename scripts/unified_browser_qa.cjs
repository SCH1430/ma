// Real-browser checks for shared task presentation, narrow screens and focus.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/unified-browser-qa');
const entry=pathToFileURL(path.join(root,'index.html')).href;
const report={screens:[],pageErrors:[]};
async function ready(page){await page.waitForFunction(()=>!document.querySelector('[data-role="teacher"]')?.disabled);}
async function layout(page,label){
 const result=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
 assert(result.width<=result.viewport+1,label+': page overflows '+JSON.stringify(result));
 report.screens.push({label,...result});
}
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},reducedMotion:'reduce'});await context.setOffline(true);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(entry);await ready(page);await page.locator('[data-role="teacher"]').click();
  await page.locator('[data-action="builder-home"]').click();await page.locator('.bank-task').first().waitFor();
  assert.deepEqual(await page.evaluate(()=>MathDataLoader.snapshot().loaded),['class:5'],'constructor does not eagerly load all sources');
  const sources=['class:5:basic','exam:oge-2027','sdamgia','enrichment','quality','learning','methods'];
  for(const [index,source] of sources.entries()){
   await page.locator('#source-filter').selectOption(source);
   await page.waitForFunction(source=>document.querySelector('.bank-task')?.dataset.taskSource===source.split(':')[0]&&!MathDataLoader.snapshot().pending.length,source);
   const card=page.locator('.bank-task').first();await card.waitFor();
   assert.equal(await card.locator('.task-content').count(),1);assert.equal(await card.locator('.task-statement').count(),1);
   assert.equal(await card.locator('.task-format').count(),1);assert.equal(await card.locator('.task-answer').count(),1);
   if(source.startsWith('exam:'))assert((await card.locator('.task-context-text').textContent()).includes('175/70 R12'));
   await card.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelector('.bank-task .task-content').querySelectorAll('img')].filter(img=>img.checkVisibility()).every(img=>img.complete&&img.naturalWidth>0));
   await layout(page,width+' '+source);
   await card.screenshot({path:path.join(out,`${width}-source-${index}.png`),style:'.app-navigation,.work-toggle,.toast{visibility:hidden!important}'});
   if(source.startsWith('exam:')){
    assert.equal(await card.locator('.exam-reference-page').count(),0,'official criteria remain deferred');
    const enlarge=card.locator('.task-statement [data-task-image-open]').first();await enlarge.click();
    await page.locator('.figure-viewer-dialog').waitFor();assert.equal(await page.locator('.figure-viewer-raster').count(),1);
    await page.locator('[data-figure-viewer-action="zoom-in"]').click();assert.equal(await page.locator('.figure-viewer-scale').innerText(),'125%');
    await page.keyboard.press('Escape');assert(await enlarge.evaluate(e=>e===document.activeElement),'image viewer restores its trigger');
   }
   await card.locator('.task-answer>summary').click();await layout(page,width+' answer '+source);
   if(source.startsWith('exam:'))await card.locator('.exam-reference-page').first().waitFor();
   await card.locator('.task-answer>summary').click();
   const id=await card.getAttribute('data-task-id');await card.locator('[data-action="add"]').click();
   if(width<=650)await page.locator('[data-action="open-work"]').click();
   assert.equal(await page.locator(`.task-preview [data-task-content="${id}"]`).count(),1);
   if(width<=650)await page.keyboard.press('Escape');
  }
  await page.locator('[data-action="home"]').first().click();await page.locator('[data-role="student"]').click();
  await page.screenshot({path:path.join(out,`${width}-student-home.png`),fullPage:true});
  const order=await page.evaluate(()=>{const cls=document.querySelector('.home-class-section'),actions=document.querySelector('.home-action-grid');return !!(cls.compareDocumentPosition(actions)&Node.DOCUMENT_POSITION_FOLLOWING);});
  assert(order,'class selection precedes secondary home actions');
  await page.locator('[data-action="nav-catalog"]').first().click();await layout(page,width+' catalog');
  await page.screenshot({path:path.join(out,`${width}-catalog.png`),fullPage:true});
  await page.locator('[data-action="exam-start"]').first().click();await page.locator('[data-action="exam-references"]').click();
  const toggle=page.locator('[data-action="exam-references"]');await toggle.focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'exam-references','closing criteria retains keyboard focus');
  await context.close();
 }
 assert.deepEqual(report.pageErrors,[]);await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,pageErrors:report.pageErrors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
