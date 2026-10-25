// Reproduce the keyboard-navigation and preset-filter failures found in review.
const fs=require('fs'),path=require('path');
const {createHarness,BANK}=require('./validate_ui_state.cjs');
let checks=0;const errors=[];
const test=(ok,label)=>{checks++;if(!ok)errors.push(label);};
const work=h=>h.state().works.find(([key])=>key==='unified')[1];

(async()=>{
 const h=createHarness();
 await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');
 await h.change('#source-filter','class:5:basic');await h.change('#bank-filter','5-01');
 await h.change('#favorite-only',true);
 test(h.document.querySelectorAll('.bank-task').length===0,'empty favorites produce an empty bank');
 test(h.document.querySelectorAll('[data-action="preset-preview"]').every(b=>b.disabled),'empty favorites disable every preset');
 await h.change('#favorite-only',false);
 await h.click('[data-action="favorite"][data-id="5-01-1"]');
 await h.change('#favorite-only',true);
 await h.click('[data-action="preset-preview"][data-difficulty="Базовый"]');
 test(h.get('#preset-preview').querySelectorAll('.preset-preview-list strong').length===1,'preset contains only the single favorite');
 await h.click('[data-action="preset-add"]');
 test(JSON.stringify(work(h).ids)==='["5-01-1"]','adding a preset cannot add nonfavorites');
 await h.input('#bank-search','5-01-2');
 test(h.document.querySelectorAll('[data-action="preset-preview"]').every(b=>b.disabled),'search also restricts preset availability');
 test(h.get('[data-action="preset-add"]').disabled,'a previously open preset cannot bypass a changed search');
 await h.input('#bank-search','');await h.change('#difficulty-filter','Повышенный');
 test(h.document.querySelectorAll('[data-action="preset-preview"]').every(b=>b.disabled),'difficulty and favorites intersect for presets');
 test(JSON.stringify(work(h).ids)==='["5-01-1"]','filter changes preserve the existing work');

 await h.change('#favorite-only',false);await h.change('#difficulty-filter','all');
 await h.input('#bank-search','5-01-1');
 test(h.document.querySelectorAll('.bank-task').length===1,'complete task ID excludes longer IDs with the same prefix');
 await h.input('#bank-search','5-01-8001');
 test(h.document.querySelectorAll('.bank-task').length===1,'new tasks are discoverable by their exact ID');

 const route=JSON.stringify(h.state().resumeRoute),entries=h.history.entries.length,index=h.history.index;
 let prevented=false;
 await h.document.dispatch('click',h.get('.skip-link'),{preventDefault(){prevented=true;}});
 test(prevented,'skip link prevents fragment navigation and its null-state popstate');
 test(h.document.activeElement===h.get('#main'),'skip link focuses the main landmark');
 test(JSON.stringify(h.state().resumeRoute)===route&&!h.get('#app').hidden,'skip link keeps the current screen');
 test(h.history.entries.length===entries&&h.history.index===index,'skip link leaves application history intact');
 await h.click('[data-action="back"]');
 test(h.state().resumeRoute.view==='classes','Back still returns to the previous application screen');
 const ids=BANK.flatMap(t=>t.tasks.map(q=>q.id));
 const attempts=ids.map(id=>[`teacher:${id}`,{correct:true,tries:1,outcome:'independent'}]);
 attempts.push(...ids.slice(0,1000).map(id=>[`student:learner:${id}`,{correct:true,tries:1,outcome:'independent'}]));
 const store=new Map([['mat1430.workspace.v2',JSON.stringify({version:2,student:{id:'learner',first:'Анна',last:'Тест',letter:'А',grade:7},attempts})]]);
 const restored=createHarness(store);await restored.click('[data-role="teacher"]');
 test(restored.state().attempts.length===attempts.length,'expanded bank restores valid progress beyond the old 8000-record limit');
 test(restored.state().attempts.some(([id])=>id===attempts.at(-1)[0]),'the final saved student result is retained');
 const report={checks,errors};
 fs.writeFileSync(path.join(__dirname,'../checks/regression-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(report);if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
