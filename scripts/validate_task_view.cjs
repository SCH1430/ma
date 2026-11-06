// Render every distributed task, preserving each source's mathematical content.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadPage}=require('./load_page.cjs');
const {createHarness}=require('./validate_ui_state.cjs');
const data=loadPage().dataValues(),h=createHarness(),view=h.context.MathTaskView;
const classes=data.BANK.flatMap(topic=>topic.tasks.map(q=>({...q,source:'class',grade:topic.grade,level:topic.level,topic:topic.title,subject:topic.subject})));
const exams=data.EXAM_BANK.flatMap(exam=>exam.tasks.flatMap(parent=>(parent.examples?.length?parent.examples:[parent]).map(q=>({...q,source:'exam',number:parent.number,kind:q.answerKind,prompt:q.text,display:q.answerText,contextImages:q.contextImages?.length?q.contextImages:parent.contextImages||[],contextText:q.contextText||parent.contextText||'',contextDescription:q.contextDescription||parent.contextDescription||''}))));
const catalog=[...classes,...exams,...data.SDAMGIA_BANK.tasks,...data.THINKING_BANK.tasks,...data.QUALITY_BANK.tasks,...data.METHOD_BANK.tasks,...vm.runInContext('MathLearningContent.tasks',h.context)];
const bySource={},byFormat={};let imageTasks=0,contexts=0;
for(const q of catalog){
 const label=q.id;assert.ok(label,'task ID');assert.ok(q.prompt||q.text||q.promptHtml,`${label}: condition is present`);
 assert.ok(view.formats[view.kind(q)],`${label}: supported response presentation`);
 const html=view.content(q,{mathHTML:h.context.mathHTML,figureSVG:h.context.figureSVG,compact:true,lazy:true});
 const holder=h.document.createElement('section');holder.innerHTML=html;
 assert.equal(holder.querySelectorAll('[data-task-content]').length,1,`${label}: one shared content block`);
 assert.equal(holder.querySelectorAll('.task-statement').length,1,`${label}: one condition block`);
 if(q.promptHtml)assert.ok(html.includes(q.promptHtml),`${label}: original formula HTML preserved`);
 if(q.source==='exam'){
  assert.ok((q.images||[]).length,`${label}: original condition exists`);
  for(const src of q.images)assert.ok(html.includes(src),`${label}: no missing condition fragment`);
  for(const src of q.contextImages||[])assert.ok(html.includes(src),`${label}: no missing shared condition fragment`);
  if(q.contextImages?.length){contexts++;assert.ok(q.contextText&&html.includes('task-context-text'),`${label}: shared condition has a text alternative`);}
 }
 if((q.images||[]).length||q.promptHtml?.includes('<img'))imageTasks++;
 assert.equal(typeof view.answer(q,{mathHTML:h.context.mathHTML}),'string',`${label}: answer renders`);
 assert.ok(q.source==='exam'||q.solution||q.solutionHtml,`${label}: explanation is present`);
 bySource[q.source||'class']=(bySource[q.source||'class']||0)+1;byFormat[view.kind(q)]=(byFormat[view.kind(q)]||0)+1;
}
assert.equal(new Set(catalog.map(q=>q.id)).size,catalog.length,'unique IDs across sources');
assert.equal(catalog.length,8735);assert.equal(contexts,10);
(async()=>{
 const cold=createHarness(new Map(),{initialPage:true});await cold.click('[data-role="teacher"]');await cold.click('[data-action="builder-home"]');await cold.settleAssets();
 assert.deepEqual(cold.scriptLoads,['data/tasks/grade_05.js'],'default builder loads only the selected class');
 assert.equal(cold.get('#source-filter').value,'class:5:basic');
 await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');
 const sources=['class:5:basic','exam:oge-2027','sdamgia','enrichment','quality','learning','methods'];
 for(const source of sources){
  await h.change('#source-filter',source);
  const card=h.get('.bank-task'),id=card.dataset.taskId;
  assert.ok(card.querySelector('.task-format'),source+': response format shown');
  assert.ok(card.querySelector('.task-content'),source+': common condition');
  assert.ok(card.querySelector('.task-answer'),source+': common answer disclosure');
  if(source.startsWith('exam:')){
   const referenceHost=card.querySelector('[data-reference-task]');assert.equal(referenceHost.querySelectorAll('img').length,0,'closed criteria do not duplicate full PDF pages in the DOM');
   const disclosure=card.querySelector('.task-answer');disclosure.open=true;await h.document.dispatch('toggle',disclosure);
   assert.ok(referenceHost.querySelectorAll('img').length,'opening criteria hydrates the official pages');
  }
  await h.click(`[data-action="add"][data-id="${id}"]`);
  assert.ok(h.document.querySelector(`.task-preview [data-task-content="${id}"]`),source+': work preview retains condition');
 }
 await cold.change('#source-filter','all');await cold.settleAssets();
 assert.equal(cold.context.MathDataLoader.snapshot().loaded.length,41,'all sources remain explicitly available');
 const report={status:'passed',tasks:catalog.length,bySource,byFormat,imageTasks,accessibleSharedContexts:contexts,bankSources:sources.length,defaultBuilderContentScripts:1};
 fs.writeFileSync('checks/task-view-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
