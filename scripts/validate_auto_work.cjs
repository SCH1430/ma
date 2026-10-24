// Check automatic selection and the real app events that assemble/export works.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createHarness,BANK,EXAM_BANK,KEY}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sameSet=(a,b)=>same([...a].sort(),[...b].sort());
const clone=value=>JSON.parse(JSON.stringify(value));
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;};
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const work=h=>h.state().works?.find(([key])=>key==='unified')?.[1];
const examples=q=>q.examples?.length?q.examples:[q];
const classes=BANK.flatMap(t=>t.tasks.map(q=>({...q,source:'class',grade:t.grade,level:t.level,topicId:t.id})));
const exams=EXAM_BANK.flatMap(exam=>exam.tasks.flatMap(parent=>examples(parent).map((q,i)=>({...q,source:'exam',examId:exam.id,number:parent.number,exampleNumber:examples(parent).length>1?i+1:null}))));
const digest=()=>crypto.createHash('sha256').update(JSON.stringify([BANK,EXAM_BANK])).digest('hex');
const originalDigest=digest();
async function scenario(label,fn){try{await fn();}catch(error){test(false,label+': '+error.stack);}}
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
async function addTask(h,q){await h.change('#source-filter','all');await h.input('#bank-search',q.id);await h.click(`[data-action="add"][data-id="${q.id}"]`);await h.input('#bank-search','');}
async function count(h,value){await h.input('#auto-count',String(value));}
const result=h=>h.get('#auto-result').textContent;
const cardIds=h=>h.document.querySelectorAll('.bank-task').map(card=>card.querySelector('[data-action="add"],[data-action="remove"]').dataset.id);

(async()=>{
 const initial=createHarness(),helper=initial.context.MathAutoWork,skills=initial.context.MathCompetencies;
 const tagged=[...classes,...exams].map(q=>({...q,competencies:Array.from(skills.forTask(q))}));
 const byId=new Map(tagged.map(q=>[q.id,q]));
 const select=(tasks,options)=>clone(helper.select(tasks,options));
 await scenario('official 2026 exam difficulty coverage',async()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,'checks/exam-difficulty.json'),'utf8')),difficulty=initial.context.MathExamDifficulty;
  const specifications={
   oge:{count:25,byCode:{Б:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],П:[20,21,23,24],В:[22,25]}},
   'ege-basic':{count:21,byCode:{Б:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}},
   'ege-profile':{count:19,byCode:{Б:[1,2,3,4,6,7,8],П:[5,9,10,11,12,13,14,15,16,17],В:[18,19]}}
  };
  test(data.year===2026&&same(data.levels,{Б:'Базовый',П:'Повышенный',В:'Высокий'}),'exam difficulty labels identify the official 2026 specification levels');
  for(const [id,spec] of Object.entries(specifications)){
   const authored=data.exams[id],bank=EXAM_BANK.find(exam=>exam.id===id);
   test(bank.tasks.length===spec.count&&Object.keys(authored.byNumber).length===spec.count,id+' has one sourced difficulty for each official numbered position');
   const pdf=fs.readFileSync(path.join(root,'src/exams/2026',authored.pdfPath));
   test(crypto.createHash('sha256').update(pdf).digest('hex')===authored.sha256&&authored.sourceUrl.includes('doc.fipi.ru/'),id+' difficulty mapping records the checksum of its local official specification PDF');
   for(const [code,numbers] of Object.entries(spec.byCode))
    test(numbers.every(number=>authored.byNumber[number]===code&&difficulty.forTask({examId:id,number})===data.levels[code]),id+' positions agree with the independently transcribed specification level '+code);
   test(exams.filter(q=>q.examId===id).every(q=>difficulty.forTask(q)===data.levels[authored.byNumber[q.number]]),id+' alternative examples retain the official level of their original numbered position');
  }
  test(exams.length===150&&exams.every(q=>difficulty.forTask(q)),'all 150 original exam examples have an explicit official difficulty');
  test(difficulty.forTask({examId:'unknown',number:1})===null&&difficulty.forTask({examId:'oge',number:26})===null,'unknown exams and positions cannot inherit a fabricated difficulty');
 });
 await scenario('deterministic pure selection and safe inputs',async()=>{
  test(typeof helper?.select==='function','automatic selection helper is available');
  const pool=tagged.filter(q=>q.source==='class'&&q.grade===7),snapshot=JSON.stringify(pool);
  const first=select(pool,{count:12,seed:'урок-2026'}),repeat=select(pool,{count:12,seed:'урок-2026'}),different=select(pool,{count:12,seed:'другой-урок'});
  test(same(first,repeat)&&first.selected===12&&first.requested===12&&first.shortfall===0,'the same pool and key reproduce the complete ordered selection');
  test(!same(first.ids,different.ids)&&new Set(first.ids).size===12,'a different key produces a different valid selection without duplicate IDs');
  test(first.ids.every(id=>pool.some(q=>q.id===id))&&first.available===pool.length,'selection stays entirely inside the exact supplied pool');
  const frozen=deepFreeze(clone(pool)),options=deepFreeze({count:8,seed:'frozen',competencies:['calculations','equations'],excludeIds:first.ids.slice(0,2),limit:6});
  const partial=select(frozen,options);
  test(partial.selected===6&&partial.shortfall===2&&partial.available===pool.length-2&&partial.ids.every(id=>!options.excludeIds.includes(id)),'exclusions and remaining capacity are reflected in both selection and shortage');
  test(JSON.stringify(pool)===snapshot&&JSON.stringify(frozen)===snapshot,'selecting and shuffling leave task arrays and nested metadata unchanged');
  const invalid=[null,{},[],{id:''},{id:17},{id:'valid',competencies:['equations']},{id:'valid',competencies:['graphs']},{id:'other'}];
  const clean=select(invalid,{count:5,seed:'clean',competencies:['equations','unknown'],excludeIds:['other','other']});
  test(same(clean.ids,['valid'])&&clean.available===1&&clean.shortfall===4,'malformed rows, duplicate IDs and excluded IDs cannot create extra tasks');
  test(same(clean.coveredCompetencies,['equations'])&&same(clean.missingCompetencies,['unknown']),'unknown requested skills remain explicitly missing');
  const empty=select(null,{count:7,competencies:['graphs']});
  test(empty.selected===0&&empty.available===0&&empty.shortfall===7&&same(empty.missingCompetencies,['graphs']),'an empty or invalid pool reports the full shortage without a fallback');
  for(const [value,expected] of [[undefined,10],[NaN,10],[Infinity,10],['bad',10],[0,1],[-3,1],[2.7,2],['8',8],[99,60]])
   test(select(pool,{count:value}).requested===expected,'helper defensively normalizes quantity '+String(value));
  const zero=select(pool,{count:7,limit:0,competencies:['graphs']});
  test(zero.selected===0&&zero.shortfall===7&&zero.missingCompetencies.includes('graphs'),'zero remaining capacity never selects or credits a competency');
 });
 await scenario('competency coverage and original exam-number variety',async()=>{
  const synthetic=[
   {id:'a',competencies:['calculations','equations'],topicId:'a'},
   {id:'b',competencies:['graphs'],topicId:'b'},
   {id:'c',competencies:['geometry'],topicId:'c'},
   {id:'d',competencies:['calculations'],topicId:'a'}
  ];
  const requested=['calculations','equations','graphs','geometry'];
  const covered=select(synthetic,{count:3,seed:'coverage',competencies:requested});
  test(covered.selected===3&&sameSet(covered.coveredCompetencies,requested)&&!covered.missingCompetencies.length,'selection covers every chosen competency when the available count permits');
  const short=select(synthetic,{count:1,seed:'coverage',competencies:requested});
  test(short.coveredCompetencies.length===2&&short.missingCompetencies.length===2&&short.shortfall===0,'a small but fully filled work reports skills it could not cover');
  const examPool=Array.from({length:4},(_,n)=>Array.from({length:3},(_,i)=>({id:`exam-${n+1}-${i+1}`,source:'exam',examId:'example-exam',number:n+1,exampleNumber:i+1,competencies:[]}))).flat();
  const varied=select(examPool,{count:4,seed:'four-numbers'}),lookup=new Map(examPool.map(q=>[q.id,q]));
  test(new Set(varied.ids.map(id=>lookup.get(id).number)).size===4,'one-exam selection prefers distinct official numbers before alternative examples');
  test(same(varied.ids.map(id=>lookup.get(id).number),[1,2,3,4]),'a single-exam work follows official number order');
  const real=tagged.filter(q=>q.examId==='oge'),full=select(real,{count:25,seed:'complete-oge'});
  test(full.selected===25&&same(full.ids,real.map(q=>q.id)),'all 25 OGE tasks remain selectable and ordered as in the official demo');
 });
 await scenario('quantity validation and saved automatic-build preference',async()=>{
  const h=createHarness();await teacher(h);
  test(h.get('#auto-count').value==='10'&&h.get('#auto-count').getAttribute('min')==='1'&&h.get('#auto-count').getAttribute('max')==='60','automatic builder offers an accessible 1–60 quantity defaulting to 10');
  await addTask(h,classes[0]);const before=JSON.stringify(work(h));
  for(const value of ['','0','-1','2.5','61','Infinity']){
   await count(h,value);await h.click('[data-action="auto-build"]');
   test(JSON.stringify(work(h))===before&&result(h).includes('от 1 до 60'),'invalid quantity '+JSON.stringify(value)+' explains the allowed range and preserves the work');
  }
  await count(h,7);h.flush();h.pagehide();
  const reloaded=createHarness(h.store);await reloaded.click('[data-action="resume"]');
  test(reloaded.get('#auto-count').value==='7','a valid automatic quantity survives reload');
  await count(reloaded,'bad');reloaded.flush();reloaded.pagehide();
  const clean=createHarness(reloaded.store);await clean.click('[data-action="resume"]');
  test(clean.get('#auto-count').value==='10','invalid transient quantity does not poison the saved preference');
 });
 await scenario('automatic class selection uses the complete visible filter intersection',async()=>{
  const h=createHarness();await teacher(h);await h.change('#source-filter','class:7:basic');
  await h.change('[data-competency="equations"]',true);await h.change('[data-competency="graphs"]',true);await h.change('#difficulty-filter','Средний');
  const expected=tagged.filter(q=>q.source==='class'&&q.grade===7&&q.level==='basic'&&q.difficulty==='Средний'&&q.competencies.some(id=>['equations','graphs'].includes(id)));
  test(expected.length>=8,'a real class pool has enough matching tasks for selection');
  await count(h,8);await h.click('[data-action="auto-build"]');
  test(work(h).ids.length===8&&work(h).ids.every(id=>expected.some(q=>q.id===id)),'class source, difficulty and the OR union of skills all constrain automatic selection');
  test(['equations','graphs'].every(id=>work(h).ids.some(taskId=>byId.get(taskId).competencies.includes(id))),'the selected class work represents each chosen available skill');
  const first=clone(work(h).ids);await h.click('[data-action="auto-build"]');
  test(!same(work(h).ids,first)&&work(h).ids.every(id=>expected.some(q=>q.id===id)),'repeating automatic assembly uses a fresh selection key while preserving the same filter boundaries');
  const q=expected[0];await h.change('#bank-filter',q.topicId);await h.input('#bank-search',q.id);
  await h.click(`[data-action="favorite"][data-id="${q.id}"]`);await h.change('#favorite-only',true);
  test(same(cardIds(h),[q.id]),'manual catalogue narrows to the same unique task using topic, search and favorite filters');
  await count(h,6);await h.click('[data-action="auto-build"]');
  test(same(work(h).ids,[q.id])&&result(h).includes('5'),'automatic selection respects topic, text search and favorites and reports their shortage');
  await h.input('#bank-search','такого задания нет');const before=JSON.stringify(work(h)),library=JSON.stringify(h.state().library);
  test(h.get('[data-action="auto-build"]').disabled&&h.get('[data-action="auto-append"]').disabled&&h.get('#auto-available').textContent.includes('0'),'an empty exact intersection disables assembly and explains its zero-task pool');
  await h.document.dispatch('click',h.get('[data-action="auto-build"]'));
  test(JSON.stringify(work(h))===before&&JSON.stringify(h.state().library)===library,'an empty exact intersection leaves the current work and library intact');
 });
 await scenario('official exam difficulty filters and a complete OGE assembly',async()=>{
  const h=createHarness();await teacher(h);await h.change('#source-filter','exam:oge');
  test(!!h.document.querySelector('#difficulty-filter'),'an exam source exposes its own difficulty filter');
  const difficulty=initial.context.MathExamDifficulty;
  const oge=tagged.filter(q=>q.examId==='oge');
  test(oge.every(q=>['Базовый','Повышенный','Высокий'].includes(difficulty.forTask(q))),'every official OGE task has a sourced exam difficulty');
  await h.change('#difficulty-filter','Повышенный');await count(h,60);await h.click('[data-action="auto-build"]');
  const expected=oge.filter(q=>difficulty.forTask(q)==='Повышенный');
  test(expected.length>0&&sameSet(work(h).ids,expected.map(q=>q.id)),'exam automatic assembly uses the selected official difficulty without broadening it');
  await h.change('#difficulty-filter','all');await count(h,60);await h.click('[data-action="auto-build"]');
  test(same(work(h).ids,oge.map(q=>q.id))&&result(h).includes('35'),'requesting 60 OGE tasks produces all 25 available originals and explains the 35-task shortage');
  for(const examId of ['ege-basic','ege-profile']){
   await h.change('#source-filter','exam:'+examId);await h.change('[data-competency="equations"]',true);await h.change('[data-competency="graphs"]',true);
   const expected=tagged.filter(q=>q.examId===examId&&q.competencies.some(id=>['equations','graphs'].includes(id)));
   await count(h,5);await h.click('[data-action="auto-build"]');
   test(work(h).ids.length===Math.min(5,expected.length)&&work(h).ids.every(id=>expected.some(q=>q.id===id)),examId+' assembly keeps the skill union at individual alternative-example level');
  }
  await h.change('#source-filter','exam:oge');
  for(const definition of skills.definitions)await h.change(`[data-competency="${definition.id}"]`,true);
  await count(h,1);await h.click('[data-action="auto-build"]');
  const actual=new Set(work(h).ids.flatMap(id=>byId.get(id).competencies)),missing=Array.from(skills.definitions).filter(definition=>!actual.has(definition.id));
  test(work(h).ids.length===1&&missing.length>0&&missing.every(definition=>h.get('.auto-missing').textContent.includes(definition.title)),'a filled one-task work explicitly names the selected competencies it could not represent');
  test(h.get('#auto-result').getAttribute('role')==='status'&&h.document.activeElement===h.get('#auto-result'),'the assembly result is announced and receives keyboard focus');
 });
 await scenario('replacement snapshots a mixed manual work; appending preserves it',async()=>{
  const store=new Map(),h=createHarness(store);await teacher(h);
  const original=[classes[0],exams.find(q=>q.examId==='oge')];for(const q of original)await addTask(h,q);
  await h.input('#work-title','Ручная смешанная работа');await h.input('#work-variant','А');await h.input('#variant-seed','исходный-ключ');await h.change('#include-answers',true);h.flush();
  const before=clone(work(h));await h.change('#source-filter','class:8:basic');await count(h,6);await h.click('[data-action="auto-append"]');
  const appended=clone(work(h));
  test(appended.ids.length===8&&same(appended.ids.slice(0,2),before.ids)&&new Set(appended.ids).size===8,'append retains the existing mixed order and adds only unique new tasks');
  test(appended.ids.slice(2).every(id=>byId.get(id).grade===8)&&appended.title===before.title&&appended.answers===true,'appending applies the selected source and retains work metadata');
  await count(h,4);await h.click('[data-action="auto-build"]');
  const replaced=clone(work(h)),saved=h.state().library.find(entry=>same(entry.ids,appended.ids));
  test(replaced.ids.length===4&&saved&&saved.title===before.title&&saved.variant===before.variant&&saved.seed===before.seed&&saved.answers===true,'a replacement first saves the complete previous work and all its metadata to the library');
  test(replaced.title===before.title&&replaced.variant===before.variant&&replaced.answers===true,'replacement keeps the edited title, variant and answer-key preference');
  h.pagehide();const restored=createHarness(store);await restored.click('[data-action="resume"]');
  test(same(work(restored).ids,replaced.ids)&&restored.state().library.some(entry=>same(entry.ids,appended.ids)),'reload retains both the automatic result and the recoverable manual selection');
  const workSnapshot=clone(work(restored));await restored.input('#bank-search',replaced.ids[0]);
  await restored.click(`[data-action="favorite"][data-id="${replaced.ids[0]}"]`);await restored.change('#favorite-only',true);await count(restored,3);
  test(restored.get('[data-action="auto-append"]').disabled&&same(work(restored),workSnapshot),'an already selected exact task cannot be appended twice');
 });
 await scenario('print preview retains automatic selection parameters on return',async()=>{
  const h=createHarness();await teacher(h);await h.change('#source-filter','exam:ege-profile');
  await h.change('[data-competency="geometry"]',true);await h.change('[data-competency="reasoning"]',true);await h.change('#difficulty-filter','Повышенный');
  await count(h,4);await h.click('[data-action="auto-build"]');
  const snapshot=()=>({source:h.get('#source-filter').value,competencies:h.document.querySelectorAll('[data-competency]').filter(input=>input.checked).map(input=>input.dataset.competency),difficulty:h.get('#difficulty-filter').value,count:h.get('#auto-count').value,ids:work(h).ids,result:result(h)});
  const before=clone(snapshot());await h.click('[data-action="print-preview"]');await h.click('[data-action="builder"]');
  test(before.ids.length===4&&h.state().resumeRoute.view==='builder'&&same(snapshot(),before),'returning from print preview retains source, skills, difficulty, quantity, chosen tasks and the assembly result');
 });
 await scenario('capacity limit, autosave, JSON and PDF preserve the chosen automatic tasks',async()=>{
  const h=createHarness(),calls=[];await teacher(h);await h.change('#source-filter','class:5:basic');await count(h,59);await h.click('[data-action="auto-build"]');
  const before=clone(work(h));await count(h,5);await h.click('[data-action="auto-append"]');
  test(work(h).ids.length===60&&same(work(h).ids.slice(0,59),before.ids)&&new Set(work(h).ids).size===60&&result(h).includes('4'),'append at capacity adds only the one free slot and reports four missing tasks');
  const full=clone(work(h));
  test(h.get('[data-action="auto-append"]').disabled&&same(work(h),full)&&/0|60|мест|заполнен/i.test(h.get('#auto-available').textContent),'a full 60-task work disables adding and explains its remaining capacity');
  await h.change('#source-filter','exam:oge');await count(h,3);await h.click('[data-action="auto-build"]');
  const ids=clone(work(h).ids);await h.click('[data-action="export-work"]');
  const download=h.document.downloads.at(-1),payload=JSON.parse(await h.blobs.get(download.url).text());
  test(payload.format==='mat1430-work'&&payload.version===2&&same(payload.work.ids,ids),'JSON export contains the exact automatically chosen work');
  const pdf=createHarness(h.store,{createMathPDF:async value=>{calls.push(value);return new Uint8Array(Buffer.from('%PDF-auto-capture'));}});
  await pdf.click('[data-action="resume"]');await pdf.change('#include-answers',true);await pdf.click('[data-action="print-preview"]');await pdf.click('[data-action="download"]');
  test(calls.length===1&&same(calls[0].tasks.map(q=>q.id),ids)&&calls[0].answers===true,'PDF receives every automatically chosen task in its selected order and the answer preference');
  test(calls[0].tasks.every(q=>q.examId==='oge'&&q.images.length&&q.sourceLabel.includes('2026')),'automatic exam PDF tasks retain their original 2026 condition assets and source labels');
  test(h.networkCalls()===0&&pdf.networkCalls()===0,'automatic building, persistence and export work offline');
 });
 test(digest()===originalDigest,'automatic selection, retries, exports and source transitions do not mutate the original banks');
 const report={checks,errors,scope:'Pure seeded selection, coverage and diversity; real application filter, build, append, validation, recovery, JSON and PDF payload events'};
 fs.writeFileSync(path.join(root,'checks/auto-work-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
