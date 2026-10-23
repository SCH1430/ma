// Run through the documented cua_repl browser binding; tab and qaFs are supplied by that session.
var qaStart = async(role,g,level)=>{await tab.reload();await tab.playwright.locator(`[data-role="${role}"]`).click();await tab.playwright.locator(`[data-action="grade"][data-grade="${g}"]`).click();if(g>=10)await tab.playwright.locator(`[data-action="level"][data-level="${level}"]`).click();if(role==='student'){await tab.playwright.locator('#first-name').fill('Тест');await tab.playwright.locator('#last-name').fill('Проверка');await tab.playwright.locator('#class-letter').fill('а');await tab.playwright.locator('#profile-form button[type="submit"]').click();}await tab.getAXState({emit:false});};
var qaScenario = async(role,g,level='basic')=>{await qaStart(role,g,level);const topics=qaBank.filter(t=>t.grade===g&&t.level===level),t=topics[0];qaAssert(await tab.playwright.locator('.topic-card').count()===topics.length,`${role} ${g} ${level} topics`);await tab.playwright.locator(`[data-action="train"][data-topic="${t.id}"]`).click();await tab.playwright.locator('#answer').fill('1/0');await tab.playwright.locator('#answer-form button').click();qaAssert((await tab.playwright.locator('#feedback').innerText()).includes('Проверьте запись'), 'format feedback');await tab.playwright.locator('#answer').fill('99999');await tab.playwright.locator('#answer-form button').click();qaAssert((await tab.playwright.locator('#feedback').innerText()).includes('Пока не сходится'),'wrong feedback');await tab.playwright.locator('[data-action="reveal"]').click();qaAssert(await tab.playwright.locator('.solution').isVisible(),'reveal');for(let i=0;i<t.tasks.length;i++){const q=t.tasks[i];await tab.playwright.locator('#answer').fill(q.display.replace('.',','));await tab.playwright.locator('#answer-form button').click();qaAssert((await tab.playwright.locator('#feedback').innerText()).includes('Верно.'),`${q.id} UI answer`);await tab.playwright.locator(`[data-action="${i===t.tasks.length-1?'finish':'next'}"]`).click();}await tab.getAXState({emit:false});qaAssert((await tab.playwright.locator('.result-number').innerText()).replace(/\s/g,'')===`${t.tasks.length}/${t.tasks.length}`,'dynamic result');await tab.playwright.locator('[data-action="repeat"]').click();qaAssert(await tab.playwright.locator('.progress').getAttribute('aria-valuenow')==='0','restart');await tab.playwright.locator('#training-difficulty').selectOption('Суперсложный');qaAssert((await tab.playwright.locator('.task-meta').innerText()).includes('из 1'),'difficulty trainer');await tab.playwright.locator('[data-action="back"]').click();await tab.playwright.locator('[data-action="topics"]').click();if(role==='student')qaAssert(await tab.playwright.locator('[data-action="builder"]').count()===0,'student constructor absent');qaResults.push({role,grade:g,level,topic:t.id,answers:t.tasks.length,result:'pass'});return `${role} ${g} ${level}: pass (${t.tasks.length} tasks)`;};
var qaBuilder = async(g,level='basic')=>{await qaStart('teacher',g,level);await tab.playwright.locator('.toolbar [data-action="builder"]').click();const ts=qaBank.filter(t=>t.grade===g&&t.level===level),first=ts[0].tasks[0].id,second=ts[1].tasks[0].id;for(const id of [first,second])await tab.playwright.locator(`[data-action="add"][data-id="${id}"]`).click();await tab.playwright.locator(`[data-action="up"][data-id="${second}"]`).click();qaAssert(await tab.playwright.locator('.work-list [data-action="remove"]').first().getAttribute('data-id')===second,'reorder up');await tab.playwright.locator(`[data-action="down"][data-id="${second}"]`).click();await tab.playwright.locator(`.work-list [data-action="remove"][data-id="${first}"]`).click();qaAssert(await tab.playwright.locator('.work-list li').count()===1,'remove');await tab.playwright.locator('#subject-filter').selectOption(ts[0].subject);await tab.playwright.locator('#bank-filter').selectOption(ts[0].id);for(const d of ['Базовый','Средний','Повышенный','Суперсложный']){await tab.playwright.locator('#difficulty-filter').selectOption(d);qaAssert(await tab.playwright.locator('.bank-task').count()===ts[0].tasks.filter(q=>q.difficulty===d).length,'difficulty filter '+d);}await tab.playwright.locator('#tricky-only').setChecked(true);qaAssert(await tab.playwright.locator('.bank-task').count()===1,'tricky filter');await tab.playwright.locator('#difficulty-filter').selectOption('Базовый');qaAssert(await tab.playwright.locator('.bank-task').count()===0,'empty combination');await tab.playwright.locator('#tricky-only').setChecked(false);await tab.playwright.locator('#difficulty-filter').selectOption('all');await tab.playwright.locator('[data-action="preset-preview"][data-difficulty="Средний"]').click();await tab.playwright.locator('#preset-count').selectOption('1');qaAssert(await tab.playwright.locator('.preset-preview-list li').count()===1,'preset count');await tab.playwright.locator('[data-action="preset-add"]').click();qaAssert(await tab.playwright.locator('.work-list li').count()===2,'preset preserves manual');qaAssert(await tab.playwright.locator(`.work-list [data-id="${second}"]`).count()===3,'manual task remains');await tab.playwright.locator('[data-action="preset-preview"][data-difficulty="Базовый"]').click();await tab.playwright.locator('#preset-count').selectOption('1');await tab.playwright.locator('[data-action="preset-add"]').click();qaAssert(await tab.playwright.locator('.work-list li').count()===3,'second preset appends');qaAssert(!await tab.playwright.locator('[data-action="preset-add"]').isEnabled(),'duplicate prevented');while(await tab.playwright.locator('.work-list [data-action="remove"]').count())await tab.playwright.locator('.work-list [data-action="remove"]').first().click();await tab.playwright.locator('#subject-filter').selectOption('all');const ids=qaSamples[`${g}-${level}`];for(const id of ids)await tab.playwright.locator(`[data-action="add"][data-id="${id}"]`).click();await tab.playwright.locator('#work-title').fill('Практика: формулы, графики и идеи');await tab.playwright.locator('#work-variant').fill('1');await tab.playwright.locator('#include-answers').setChecked(true);await tab.playwright.locator('[data-action="print-preview"]').click();await tab.getAXState({emit:false});qaAssert(await tab.playwright.locator('.print-question').count()===ids.length,'print order count');var event=tab.playwright.waitForEvent('download');await tab.playwright.locator('[data-action="download"]').click();const download=await event;const file=await download.path();qaAssert(!!file,'actual download');const target=qaRoot+`/output/pdf/1430-sample-${g}-${level}.pdf`;await qaFs.mkdir(qaRoot+'/output/pdf',{recursive:true});await qaFs.copyFile(file,target);qaResults.push({role:'builder',grade:g,level,result:'pass',sampleIds:ids,download:target});await qaFs.writeFile(qaRoot+'/checks/ui-results.json',JSON.stringify(qaResults,null,2));return `${g} ${level}: filters, presets, edits, PDF pass`;};
var qaSamples = {
  "5-basic": [
    "5-01-2",
    "5-03-1",
    "5-08-2",
    "5-06-7"
  ],
  "6-basic": [
    "6-02-4",
    "6-07-1",
    "6-08-2",
    "6-06-5"
  ],
  "7-basic": [
    "7-04-2",
    "7-08-3",
    "7-07-9",
    "7-03-3"
  ],
  "8-basic": [
    "8-10-2",
    "8-06-4",
    "8-02-2",
    "8-03-5"
  ],
  "9-basic": [
    "9-03-2",
    "9-12-2",
    "9-07-5",
    "9-10-5"
  ],
  "10-basic": [
    "10-105-3",
    "10-108-1",
    "10-104-3",
    "10-110-2"
  ],
  "10-advanced": [
    "10-07-4",
    "10-12-4",
    "10-10-3",
    "10-14-4"
  ],
  "11-basic": [
    "11-106-3",
    "11-108-2",
    "11-101-4",
    "11-111-4"
  ],
  "11-advanced": [
    "11-06-3",
    "11-09-2",
    "11-01-3",
    "11-13-3"
  ]
};
