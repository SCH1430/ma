// Exercise real application routes against controlled fullscreen/lifecycle events.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHarness,BANK,KEY}=require('./validate_ui_state.cjs');
let checks=0;const errors=[];
const test=(ok,label)=>{checks++;if(!ok)errors.push(label);};
const topic=BANK.find(t=>t.grade===6&&t.tasks[0].kind==='number');
const sessions=h=>h.state().trainingSessions||[];
const events=h=>sessions(h).at(-1)?.events||[];
const count=(h,type)=>events(h).filter(e=>e.type===type).length;
function browser(store=new Map(),config={}){
 const api={requests:0,exits:0};
 const h=createHarness(store,{...config,setupDOM(document){
  document.fullscreenElement=null;
  api.change=async element=>{document.fullscreenElement=element;await document.dispatch('fullscreenchange',document.body);};
  api.hide=async hidden=>{document.visibilityState=hidden?'hidden':'visible';await document.dispatch('visibilitychange',document.body);};
  if(config.supported!==false)document.documentElement.requestFullscreen=()=>{
   api.requests++;
   if(config.reject)return Promise.reject(Error('denied'));
   if(config.throw)return (()=>{throw Error('denied');})();
   if(config.defer)return new Promise(resolve=>{api.resolve=async()=>{await api.change(document.documentElement);resolve();};});
   return api.change(document.documentElement);
  };
  document.exitFullscreen=async()=>{api.exits++;await api.change(null);};
 }});
 return Object.assign(h,{api});
}
async function start(h,role='student'){
 await h.click(`[data-role="${role}"]`);await h.click('[data-action="grade"][data-grade="6"]');
 if(role==='student'){
  await h.input('#first-name','Саша');await h.input('#last-name','Тестов');await h.input('#class-letter','А');await h.submit('#profile-form');
 }
 await h.click(`[data-action="train"][data-topic="${topic.id}"]`);
}
(async()=>{
 const teacher=browser();await start(teacher,'teacher');
 test(teacher.api.requests===0&&sessions(teacher).length===0,'teacher preview never enters fullscreen or starts monitoring');
 const h=browser();await start(h);
 test(h.api.requests===1&&h.document.fullscreenElement===h.document.documentElement,'student launch requests fullscreen on a stable document root');
 test(sessions(h).length===1&&count(h,'started')===1&&count(h,'fullscreen_enter')===1,'start and successful entry are persisted once');
 test(events(h).every(e=>Number.isFinite(Date.parse(e.at))),'every event includes an ISO timestamp');
 test(!JSON.stringify(sessions(h)).includes('Тестов'),'journal contains no student name');
 await h.input('#answer','3/7');await h.click('[data-action="hint"]');
 test(h.api.requests===1&&sessions(h).length===1,'answer and hint rerenders keep the same fullscreen session');
 await h.document.dispatch('keydown',h.get('[data-action="next"]'),{key:'Escape'});
 test(h.state().resumeRoute.view==='train','Escape does not navigate away from a student exercise');
 await h.api.change(null);await h.document.dispatch('webkitfullscreenchange',h.document.body);
 test(count(h,'fullscreen_exit')===1,'native fullscreen exit is recorded once even with duplicate vendor events');
 test(h.get('#answer').value==='3/7'&&h.text().includes('Выход из полного экрана зафиксирован'),'exit keeps the draft and displays its status');
 test(h.api.requests===1,'exit does not immediately force the learner back into fullscreen');
 await h.click('[data-action="training-fullscreen"]');
 test(h.api.requests===2&&count(h,'fullscreen_enter')===2,'return control reenters fullscreen and records the event');
 await h.api.hide(true);await h.api.hide(true);await h.api.hide(false);
 test(count(h,'hidden')===1&&count(h,'visible')===1,'tab visibility transitions are recorded and duplicate events ignored');
 await h.click('[data-action="back"]');
 test(count(h,'closed')===1&&count(h,'fullscreen_exit')===1&&h.api.exits===1,'back records closure and releases fullscreen without a false extra exit');
 test(h.text().includes('Тренажёр закрыт'),'journal remains inspectable after closure');
 await h.click(`[data-action="train"][data-topic="${topic.id}"]`);
 await h.click(`[data-action="task"][data-index="${topic.tasks.length-1}"]`);await h.click('[data-action="finish"]');
 test(count(h,'completed')===1&&count(h,'fullscreen_exit')===0,'normal completion is distinguished from leaving fullscreen');
 test(h.document.fullscreenElement===null&&h.state().resumeRoute.view==='result','results release native fullscreen');
 await h.click('[data-action="training-export"]');
 const download=h.document.downloads.at(-1),payload=JSON.parse(await h.blobs.get(download.url).text());
 test(payload.format==='baza-training-journal'&&payload.sessions.length===2,'journal can be exported with all retained sessions');
 const saved=browser(h.store);await saved.click('[data-role="teacher"]');
 test(sessions(saved).length===2&&saved.text().includes('Работа завершена'),'saved journal is available to teacher after reload');
 const closing=browser();await start(closing);await closing.input('#answer','12/7');closing.pagehide();closing.pagehide();
 test(count(closing,'page_left')===1&&count(closing,'closed')===0,'pagehide records closure or reload exactly once');
 test(closing.state().attempts.some(([,r])=>r.draft==='12/7'),'pagehide immediately saves the latest draft');
 const resumed=browser(closing.store);await resumed.click('[data-action="resume"]');
 test(resumed.api.requests===1&&resumed.get('#answer').value==='12/7'&&sessions(resumed).length===2,'resume reenters fullscreen with the saved task and a new session');
 test(sessions(resumed)[0].events.filter(e=>e.type==='page_left').length===1,'reload preserves evidence of the previous closure');
 resumed.pagehide();resumed.document.fullscreenElement=null;resumed.windowEvent('pageshow',{persisted:true});await Promise.resolve();
 test(sessions(resumed).length===3,'back-forward cache restoration restarts monitoring');
 const crashed=browser();await start(crashed);const recovered=browser(crashed.store);
 test(count(recovered,'interrupted')===1&&count(recovered,'page_left')===0,'crash recovery reports interruption without inventing an observed closure');
 const denied=browser(new Map(),{reject:true});await start(denied);
 test(count(denied,'fullscreen_unavailable')===1&&count(denied,'fullscreen_exit')===0,'denied request is not misreported as a fullscreen exit');
 test(denied.text().includes('Браузер не разрешил')&&!denied.get('[data-action="training-fullscreen"]').disabled,'denied fullscreen leaves a usable retry control');
 const unsupported=browser(new Map(),{supported:false});await start(unsupported);
 test(count(unsupported,'fullscreen_unavailable')===1&&unsupported.get('#answer'),'unsupported browser still offers the exercise');
 const throwing=browser(new Map(),{throw:true});await start(throwing);
 test(count(throwing,'fullscreen_unavailable')===1,'synchronous fullscreen errors are handled');
 const late=browser(new Map(),{defer:true});await start(late);await late.click('[data-action="back"]');await late.api.resolve();await Promise.resolve();await Promise.resolve();
 test(late.document.fullscreenElement===null&&count(late,'closed')===1&&count(late,'fullscreen_enter')===0,'late fullscreen resolution after closure cannot trap another screen');
 const ended=browser();await start(ended);await ended.click('[data-action="end-session"]');
 test(count(ended,'closed')===1&&!ended.state().student.id&&ended.document.fullscreenElement===null,'changing pupil retains anonymous closure evidence and clears identity');
 const exam=browser();await exam.click('[data-role="student"]');await exam.click('[data-action="exam-start"][data-exam="oge"]');
 test(exam.api.requests===1&&sessions(exam)[0].kind==='exam','guest student exam also starts fullscreen monitoring');
 await exam.click('[data-action="exam-next"]');
 test(exam.api.requests===1&&sessions(exam).length===1,'exam task navigation stays in the same fullscreen session');
 const work=browser();await work.click('[data-role="teacher"]');await work.click('[data-action="builder-home"]');await work.input('#bank-search',topic.tasks[0].id);await work.click(`[data-action="add"][data-id="${topic.tasks[0].id}"]`);await work.click('[data-action="home"]');await work.click('[data-role="student"]');await work.click('[data-action="works-home"]');await work.click('[data-action="run-work"]');
 test(work.api.requests===1&&sessions(work)[0].kind==='work','student collection solving starts fullscreen monitoring');
 await work.click('[data-action="run-finish"]');
 test(count(work,'completed')===1&&work.document.fullscreenElement===null,'collection results stop monitoring and release fullscreen');
 const raw=h.state(),malicious={...sessions(h)[0],title:'<img src=x onerror=alert(1)>',events:[{type:'unknown',at:new Date().toISOString()},null,{type:'closed',at:'bad date'},...Array.from({length:120},()=>({type:'closed',at:new Date().toISOString()}))]};
 const dirty=browser(new Map([[KEY,JSON.stringify({...raw,trainingSessions:Array(60).fill(malicious)})]]));await dirty.click('[data-role="teacher"]');
 test(sessions(dirty).length===50&&sessions(dirty).every(s=>s.events.length===100),'restored journal size is bounded');
 test(!dirty.document.querySelector('#training-monitor img')&&dirty.html().includes('&lt;img'),'stored journal titles are escaped before rendering');
 const noStorage=browser(new Map(),{failStorage:true});await start(noStorage);
 test(noStorage.api.requests===1&&noStorage.text().includes('Автосохранение недоступно'),'storage failure does not prevent fullscreen practice and is disclosed');
 test([h,exam,work,denied].every(x=>x.networkCalls()===0),'monitoring remains entirely offline');
 const report={checks,errors};fs.writeFileSync(path.join(__dirname,'../checks/training-monitor-results.json'),JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(errors.length,0);
})().catch(error=>{console.error(error);process.exitCode=1;});
