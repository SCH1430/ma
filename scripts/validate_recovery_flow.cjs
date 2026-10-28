// Exercise the actual recovery UI, persistence boundaries and original attempts.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createHarness,BANK,KEY}=require('./validate_ui_state.cjs');
const classes=BANK.flatMap(t=>t.tasks.map(q=>({...q,grade:t.grade,level:t.level,topicId:t.id})));
const byId=new Map(classes.map(q=>[q.id,q]));
const topic=BANK.find(t=>t.id==='8-05'),origin=topic.tasks[0];
const digest=()=>crypto.createHash('sha256').update(JSON.stringify(BANK)).digest('hex'),initial=digest();
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const answer=q=>q.kind==='set'?q.answer.length?q.answer.join(';'):'∅':String(q.answer);
const attempt=(h,id)=>h.state().attempts?.find(([key])=>key==='teacher:'+id)?.[1];
async function trainer(store=new Map()){
 const h=createHarness(store);await h.click('[data-role="teacher"]');await h.click('[data-action="grade"][data-grade="8"]');await h.click('[data-action="train"][data-topic="8-05"]');await h.click('[data-action="lesson-practice"]');return h;
}
async function wrong(h){await h.input('#answer',String(origin.answer*origin.answer));await h.submit('#answer-form');}
async function scenario(label,run){try{await run();}catch(error){test(false,label+': '+error.stack);}}
(async()=>{
 await scenario('teacher recovery progression and reload',async()=>{
  const store=new Map();let h=await trainer(store);
  test(!h.document.querySelector('[data-action="recovery-start"]'),'recovery is not shown before an incorrect answer');
  await wrong(h);
  test(h.get('#feedback').textContent.includes('квадратный корень'),'recognizable wrong answer still gets the existing targeted feedback');
  test(!!h.document.querySelector('[data-action="recovery-start"]'),'numeric error offers an available recovery sequence');
  const originalRecord=attempt(h,origin.id);
  await h.click('[data-action="recovery-start"]');
  let state=h.state().recoveryState;
  test(state.originId===origin.id&&state.owner==='teacher'&&state.stage===0,'teacher recovery has its own owner, source and first stage');
  test(new Set([origin.id,...state.ids]).size===3&&new Set([origin,...state.ids.map(id=>byId.get(id))].map(q=>q.canonicalId||q.id)).size===3,'source, check and practice use three distinct canonical tasks');
  test(state.ids.every(id=>byId.get(id)?.grade===8&&byId.get(id)?.level===topic.level),'recovery stays within the source programme');
  test(h.get('#recovery-panel').textContent.includes('гипотенуза')&&h.get('#recovery-panel').textContent.includes('квадратный корень'),'recovery explains the relevant mathematical rule');
  await h.input('#recovery-answer','not a number');await h.submit('#recovery-answer-form');
  test(h.state().recoveryState.feedback[0]==='format'&&!h.document.querySelector('[data-action="recovery-next"]'),'invalid format does not unlock the next stage');
  await h.input('#recovery-answer','999999');await h.submit('#recovery-answer-form');
  test(h.state().recoveryState.feedback[0]==='wrong'&&!h.state().recoveryState.correct[0],'wrong recovery answer remains retryable');
  test(same(attempt(h,origin.id),originalRecord),'incorrect recovery checks do not alter the original response or tries');
  await h.input('#recovery-answer',answer(byId.get(state.ids[0])));await h.submit('#recovery-answer-form');
  test(h.state().recoveryState.correct[0]&&h.get('#recovery-answer').hasAttribute('readonly'),'correct simple check is recorded and locked');
  await h.click('[data-action="recovery-next"]');
  test(h.state().recoveryState.stage===1&&!h.state().recoveryState.correct[1],'next stage starts with a fresh ungraded answer');
  await h.input('#recovery-answer','123');h.flush();h.pagehide();h=createHarness(store);await h.click('[data-action="resume"]');
  state=h.state().recoveryState;
  test(state.stage===1&&state.correct[0]&&h.get('#recovery-answer').value==='123','reload resumes the recovery stage and unfinished draft');
  await h.input('#recovery-answer',answer(byId.get(state.ids[1])));await h.submit('#recovery-answer-form');
  test(h.state().recoveryState.correct.every(Boolean)&&h.get('#recovery-panel').textContent.includes('Оба шага пройдены'),'both correctly solved stages produce completion guidance');
  test(same(attempt(h,origin.id),originalRecord)&&!attempt(h,origin.id).correct,'completing recovery does not award the original task');
  test(state.ids.every(id=>!attempt(h,id)?.correct),'recovery does not mark ordinary trainer attempts complete');
  await h.click('[data-action="recovery-close"]');
  test(h.state().recoveryState===null&&h.document.activeElement===h.get('#answer'),'return closes recovery and focuses the original answer');
  await h.input('#answer',answer(origin));await h.submit('#answer-form');
  test(attempt(h,origin.id).correct,'the original question still requires and accepts its own answer');
  test(h.networkCalls()===0,'teacher recovery and restoration remain offline');
 });
 await scenario('saved recovery is validated rather than trusted',async()=>{
  const store=new Map(),first=await trainer(store);await wrong(first);await first.click('[data-action="recovery-start"]');
  const saved=first.state();saved.recoveryState.correct=[true,true];saved.recoveryState.drafts=['999999','999999'];saved.recoveryState.stage=1;store.set(KEY,JSON.stringify(saved));
  let h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().recoveryState.stage===0&&!h.state().recoveryState.correct.some(Boolean),'restoration independently checks claimed correctness and locks invalid stage advancement');
  const repeated=h.state();repeated.recoveryState.ids=[origin.id,repeated.recoveryState.ids[1]];store.set(KEY,JSON.stringify(repeated));h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().recoveryState===null,'saved recovery cannot use the original task as a supposedly new example');
  const missing=JSON.parse(JSON.stringify(saved));missing.recoveryState.ids=['missing-id',missing.recoveryState.ids[1]];store.set(KEY,JSON.stringify(missing));h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().recoveryState===null,'a removed task invalidates an obsolete recovery safely');
  const originalSkills=h.context.MathBankPedagogy.forTask(byId.get(origin.id));
  const unrelated=classes.find(q=>q.grade===8&&q.level===topic.level&&q.kind==='number'&&!h.context.MathBankPedagogy.forTask(q).some(id=>originalSkills.includes(id)));
  const switched=JSON.parse(JSON.stringify(saved));switched.recoveryState.ids[0]=unrelated.id;store.set(KEY,JSON.stringify(switched));h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().recoveryState===null,'a corrupted state cannot substitute an unrelated mathematical skill');
  const foreign=JSON.parse(JSON.stringify(saved));foreign.recoveryState.owner='run:someone-else';store.set(KEY,JSON.stringify(foreign));h=createHarness(store);await h.click('[data-action="resume"]');
  test(!h.document.querySelector('#recovery-answer')&&!!h.document.querySelector('[data-action="recovery-start"]'),'another session owner cannot expose saved recovery drafts');
 });
 await scenario('student work recovery remains isolated and clears on session end',async()=>{
  const store=new Map();let h=createHarness(store);await h.click('[data-role="student"]');await h.click('[data-action="works-home"]');
  await h.import({format:'mat1430-work',version:2,work:{ids:[origin.id],title:'Восстановление навыка',variant:'1',answers:false}});await h.click('[data-action="run-work"]');
  await h.input('#work-run-answer',String(origin.answer*origin.answer));await h.submit('#work-run-answer-form');
  const runId=h.state().activeRun.id,before=h.state().activeRun.records[origin.id];
  await h.click('[data-action="recovery-start"]');
  let state=h.state().recoveryState;
  test(state.owner==='run:'+runId,'student work recovery belongs to its exact run');
  await h.input('#recovery-answer',answer(byId.get(state.ids[0])));await h.submit('#recovery-answer-form');await h.click('[data-action="recovery-next"]');h.pagehide();
  h=createHarness(store);await h.click('[data-action="resume"]');state=h.state().recoveryState;
  test(h.state().activeRun.id===runId&&state.owner==='run:'+runId&&state.stage===1,'student reload continues both the same work and recovery sequence');
  await h.input('#recovery-answer',answer(byId.get(state.ids[1])));await h.submit('#recovery-answer-form');
  test(same(h.state().activeRun.records[origin.id],before),'student recovery does not change work grading, draft or tries');
  test(!(h.state().attempts||[]).some(([key])=>key.endsWith(':'+origin.id)),'student work recovery creates no ordinary trainer result');
  await h.click('[data-action="end-session"]');
  test(h.state().recoveryState===null&&h.state().activeRun===null,'ending a student session clears recovery and work progress');
  test(h.state().works.some(([key,work])=>key==='unified'&&work.ids.includes(origin.id)),'ending a session preserves the teacher work definition');
  test(h.networkCalls()===0,'student work recovery makes no network requests');
 });
 test(digest()===initial,'recovery never modifies task statements, answers, solutions or bank metadata');
 console.log(JSON.stringify({checks,errors,scope:'Actual trainer and work-run recovery events, reload, validation and owner isolation'},null,2));
 assert.equal(errors.length,0);
})().catch(error=>{console.error(error);process.exitCode=1;});
