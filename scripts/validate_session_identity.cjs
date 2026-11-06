// Regression scenarios execute the real application handlers and persistence.
const assert=require('node:assert/strict');
const {createHarness,BANK,KEY}=require('./validate_ui_state.cjs');
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const equal=(actual,expected,message)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),message);};
async function role(h,value){if(!h.document.querySelector(`[data-role="${value}"]`)||h.get('#welcome').hidden)await h.click('[data-action="home"]');await h.click(`[data-role="${value}"]`);}
async function profile(h,grade,letter='А'){
 await h.click(`[data-action="grade"][data-grade="${grade}"]`);
 if(grade>=10)await h.click('[data-action="level"][data-level="basic"]');
 await h.input('#first-name','Анна');await h.input('#last-name','Иванова');await h.input('#class-letter',letter);await h.submit('#profile-form');
}
async function exported(h){await h.click('[data-action="run-export"]');const download=h.document.downloads.at(-1);return JSON.parse(await h.blobs.get(download.url).text());}
(async()=>{
 const h=createHarness();await role(h,'student');await profile(h,6);
 const topic=BANK.find(t=>t.grade===6&&t.tasks[0].kind==='number'),task=topic.tasks[0];
 await h.click(`[data-action="train"][data-topic="${topic.id}"]`);await h.input('#answer',task.display);await h.submit('#answer-form');
 const id=h.state().student.id,attempts=h.state().attempts;
 check(attempts.some(([key,value])=>key===`student:${id}:${task.id}`&&value.correct),'baseline contains a real correct attempt');
 await h.click('[data-action="nav-home"]');await profile(h,5,'Б');
 equal(h.state().student.id,id,'grade and class-letter changes preserve the learner identity');
 equal(h.state().attempts,attempts,'grade and class-letter changes preserve previous answers');
 const restored=createHarness(h.store);await restored.click('[data-action="resume"]');
 equal(restored.state().student.id,id,'identity persists after reload');
 equal(restored.state().attempts,attempts,'previous-grade answers persist after reload');
 await restored.click('[data-action="nav-home"]');await profile(restored,10);await restored.click('[data-action="nav-home"]');await profile(restored,11);
 equal(restored.state().student.id,id,'moving between upper grades preserves the learner');
 equal(restored.state().attempts,attempts,'moving between upper grades preserves earlier answers');
 await restored.click('[data-action="end-session"]');
 check(!restored.state().student.id&&!restored.state().attempts.some(([key])=>key.startsWith('student:')),'explicit change of learner still clears pupil data');

 const teacher=createHarness();await role(teacher,'student');await profile(teacher,6);await role(teacher,'teacher');
 await teacher.click('[data-action="nav-catalog"]');await teacher.click('[data-action="learning-home"]');await teacher.click('[data-action="learning-diagnostic"]');
 await teacher.input('#work-run-answer','0');await teacher.submit('#work-run-answer-form');
 const original=teacher.state().activeRun;
 check(original.participantRole==='teacher'&&original.learner.name==='Просмотр учителя','teacher session snapshots its own owner');
 await role(teacher,'student');await teacher.click('[data-action="nav-works"]');
 check(!teacher.document.querySelector('[data-action="resume-run"]'),'student cannot continue the teacher session');
 check(teacher.text().includes('Это просмотр учителя'),'foreign session has an actionable ownership explanation');
 equal(teacher.state().activeRun.learner,original.learner,'changing role preserves the teacher session owner');
 equal(Object.values(teacher.state().activeRun.records).map(r=>[r.draft,r.tries,r.feedback]),Object.values(original.records).map(r=>[r.draft,r.tries,r.feedback]),'changing role preserves teacher answers');
 equal(teacher.state().learningState.events.length,0,'teacher attempt does not become student learning evidence');
 const teacherFile=await exported(teacher);
 check(teacherFile.participantRole==='teacher'&&teacherFile.learner.name==='Просмотр учителя','export under another role retains the original participant');
 check(teacherFile.learner.name!=='Анна Иванова','teacher export is not labelled with the active student name');
 await role(teacher,'teacher');await teacher.click('[data-action="nav-works"]');await teacher.click('[data-action="resume-run"]');await teacher.click('[data-action="run-finish"]');
 equal(teacher.state().learningState.events.length,0,'teacher can finish own session without awarding student progress');

 await role(teacher,'student');await teacher.click('[data-action="learning-home"]');await teacher.click('[data-action="learning-diagnostic"]');
 check(!!teacher.document.querySelector('[data-action="replace-run"]'),'starting the same work in another role asks before replacing the old run');
 await teacher.click('[data-action="replace-run"]');
 check(teacher.state().activeRun.id!==original.id&&teacher.state().activeRun.participantRole==='student','replacement creates a fresh student session');
 equal(teacher.state().activeRun.learner.id,teacher.state().student.id,'new student run is bound to the current learner');
 check(Object.values(teacher.state().activeRun.records).every(record=>record.tries===0&&!record.draft),'teacher answers do not leak into the new student run');
 await teacher.click('[data-action="run-finish"]');
 equal(teacher.state().learningState.events.length,1,'only the student session contributes to the route');

 const saved=teacher.state();saved.activeRun.learner.id='another-learner';saved.resumeRoute={...saved.resumeRoute,view:'work-run',role:'student'};
 const mismatch=createHarness(new Map([[KEY,JSON.stringify(saved)]]));
 check(!mismatch.document.querySelector('.home-hero [data-action="resume"]'),'Today does not link to a saved run owned by a different learner');
 await mismatch.click('[data-action="nav-works"]');
 check(!mismatch.document.querySelector('#work-run-answer-form')&&!mismatch.document.querySelector('[data-action="resume-run"]'),'restored session for another learner cannot be resumed');
 equal(mismatch.state().activeRun.learner.id,'another-learner','restoration does not silently reassign the owner');

 let guest=createHarness();await role(guest,'student');await guest.click('.home-hero [data-action="learning-diagnostic"]');
 await guest.input('#work-run-answer','0');guest.flush();
 const guestId=guest.state().examLearnerId,guestRunId=guest.state().activeRun.id;
 check(!!guestId&&!guest.state().student.id,'first guest work creates an identity without a school profile');
 equal(guest.state().activeRun.learner.id,guestId,'guest work owns the same identity as guest exam attempts');
 equal(guest.state().activeRun.learner.grade,5,'Today keeps the chosen grade on a guest diagnostic');
 await guest.click('[data-action="nav-home"]');await guest.click('[data-action="nav-catalog"]');await guest.click('[data-action="exam-start"]');
 equal(guest.state().examLearnerId,guestId,'visiting exams keeps the existing guest identity');
 await guest.click('[data-action="nav-home"]');await guest.click('[data-action="nav-works"]');await guest.click('[data-action="resume-run"]');
 equal(guest.state().activeRun.id,guestRunId,'the same guest run resumes after visiting an exam');
 equal(guest.get('#work-run-answer').value,'0','guest draft survives the work to exam round trip');
 guest=createHarness(guest.store);await guest.click('[data-action="resume-run"]');
 equal(guest.state().examLearnerId,guestId,'guest identity persists through reload');
 equal(guest.get('#work-run-answer').value,'0','guest work remains resumable after reload');
 for(const legacyOwner of ['missing','empty']){
  const legacy=guest.state();legacy.examLearnerId='';
  if(legacyOwner==='missing')delete legacy.activeRun.learner;else legacy.activeRun.learner.id='';
  const migrated=createHarness(new Map([[KEY,JSON.stringify(legacy)]]));await migrated.click('[data-action="resume-run"]');
  const restoredId=migrated.state().examLearnerId;
  check(!!restoredId&&migrated.state().activeRun.learner.id===restoredId,legacyOwner+' legacy guest owner is bound once to a stable identity');
  equal(migrated.get('#work-run-answer').value,'0',legacyOwner+' legacy guest draft is preserved');
  const twice=createHarness(migrated.store);await twice.click('[data-action="resume-run"]');
  equal(twice.state().activeRun.learner.id,restoredId,legacyOwner+' migrated owner stays stable on another reload');
 }

 console.log(JSON.stringify({checks,status:'passed',scope:'Cross-grade persistence, explicit learner reset, role ownership, result export, restored owner mismatch and stable guest work/exam identity'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
