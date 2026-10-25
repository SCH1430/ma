// Source coverage plus real application event checks for competency-based selection.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createHarness,BANK,EXAM_BANK}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'checks/competencies.json'),'utf8'));
const expectedDefinitions=['calculations','equations','graphs','modelling','geometry','data','reasoning'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sameSet=(a,b)=>same([...a].sort(),[...b].sort());
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
async function scenario(label,fn){try{await fn();}catch(error){test(false,label+': '+error.stack);}}
const digest=()=>crypto.createHash('sha256').update(JSON.stringify([BANK,EXAM_BANK,config])).digest('hex');
const originalDigest=digest();
const classes=BANK.flatMap(topic=>topic.tasks.map(q=>({...q,topicId:topic.id,grade:topic.grade,level:topic.level,subject:topic.subject,source:'class'})));
const exams=EXAM_BANK.flatMap(exam=>exam.tasks.flatMap(task=>(task.examples?.length?task.examples:[task]).map(q=>({...q,examId:exam.id,source:'exam'}))));
const all=[...classes,...exams],byId=new Map(all.map(q=>[q.id,q]));
const selectedWork=h=>h.state().works?.find(([key])=>key==='unified')?.[1];
const cardIds=h=>h.document.querySelectorAll('.bank-task').map(card=>card.querySelector('[data-action="add"],[data-action="remove"]').dataset.id);
const checked=h=>h.document.querySelectorAll('[data-competency]').filter(input=>input.checked).map(input=>input.dataset.competency);
const match=(q,ids,tags)=>ids.length===0||tags(q).some(id=>ids.includes(id));
const select=async(h,id,value=true)=>h.change(`[data-competency="${id}"]`,value);
async function teacher(h){await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');}
async function everyPage(h){
 const ids=[];
 for(let page=0;page<200;page++){
  ids.push(...cardIds(h));const next=h.document.querySelector('[data-action="bank-next"]');
  if(!next||next.disabled)return ids;
  await h.click('[data-action="bank-next"]');
 }
 throw Error('pagination never reached its final page');
}

(async()=>{
 const initial=createHarness(),helper=initial.context.MathCompetencies;
 const tags=q=>Array.from(helper.forTask(q));
 await scenario('complete validated pedagogical metadata',async()=>{
  test(!!helper&&typeof helper.forTask==='function'&&typeof helper.matches==='function','competency helper exposes its lookup and matching contract');
  test(sameSet(config.competencies.map(x=>x.id),expectedDefinitions)&&config.competencies.every(x=>typeof x.title==='string'&&x.title.trim()&&typeof x.description==='string'&&x.description.trim()),'seven mathematical competencies have unique stable identifiers and useful labels');
  test(sameSet(Array.from(helper.definitions,x=>x.id),expectedDefinitions),'helper and authored competency definitions agree');
  const invalid=all.filter(q=>{const ids=tags(q);return !ids.length||ids.length!==new Set(ids).size||ids.some(id=>!expectedDefinitions.includes(id));});
  test(classes.length===7488&&exams.length===150&&byId.size===all.length&&invalid.length===0,'every one of the 7,638 class and official exam examples has a nonempty, unique, valid competency set');
  test(BANK.every(topic=>Array.isArray(config.topics[topic.id])&&config.topics[topic.id].length>0),'every class topic has an authored competency baseline');
  test(sameSet(Object.keys(config.tasks),exams.map(q=>q.id)),'all 150 official alternative examples have their own mapping and no orphan exam IDs');
  test(Object.keys(config.overrides).every(id=>byId.has(id)&&byId.get(id).source==='class'),'task overrides refer only to real class tasks');
  test(same(tags({id:'normalised-task',competencies:['geometry']}),['geometry']),'normalized task metadata takes precedence over lookup');
  test(helper.matches(byId.get('5-01-1'),[])===true&&helper.matches(byId.get('5-01-1'),['calculations'])===true&&helper.matches(byId.get('5-01-1'),['geometry'])===false,'matching supports no restriction and rejects an unrelated skill');
  test(helper.matches(byId.get('5-01-1'),['unknown-competency'])===false,'an unknown selected competency cannot silently disable filtering');
 });
 await scenario('representative mathematical distinctions',async()=>{
  for(const [id,skill] of [['5-01-1','calculations'],['7-01-1','equations'],['7-04-1','graphs'],['5-05-1','modelling'],['5-07-1','geometry'],['5-222-1','data'],['5-221-1','reasoning']])
   test(tags(byId.get(id)).includes(skill),id+' is classified by its actual mathematical skill: '+skill);
  test(same(tags(byId.get('exam-2026-ege-basic-18-1')),['calculations'])&&same(tags(byId.get('exam-2026-ege-basic-18-2')),['equations']),'different examples of EGE basic number 18 distinguish number evaluation from inequalities');
  test(tags(byId.get('exam-2026-ege-basic-21-2')).includes('geometry')&&!tags(byId.get('exam-2026-ege-basic-21-1')).includes('geometry')&&tags(byId.get('exam-2026-ege-basic-21-1')).includes('equations'),'different examples of EGE basic number 21 distinguish geometric reasoning from equation modelling');
  test(tags(byId.get('exam-2026-oge-24-1')).includes('reasoning')&&tags(byId.get('exam-2026-ege-profile-5-2')).includes('data'),'proof and sampling-probability problems remain separately discoverable');
 });
 await scenario('actual checkbox OR, exam alternatives and source transitions',async()=>{
  const h=createHarness();await teacher(h);
  const fields=h.document.querySelectorAll('fieldset').filter(field=>field.querySelector('legend')?.textContent.trim()==='Компетенции ученика');
  test(fields.length===1&&fields[0].querySelectorAll('input[type="checkbox"][data-competency]').length===7,'one labelled fieldset exposes seven independent competency checkboxes');
  test(checked(h).length===0,'constructor initially allows every competency');
  await select(h,'equations');await select(h,'graphs');
  const unionSize=all.filter(q=>match(q,['equations','graphs'],tags)).length;
  const resultStatus=h.document.querySelectorAll('.bank-filters [role="status"]').find(element=>element.textContent.includes('Найдено:'));
  test(Number(resultStatus?.textContent.match(/Найдено:\s*(\d+)/)?.[1])===unionSize&&cardIds(h).every(id=>match(byId.get(id),['equations','graphs'],tags)),'the global catalogue counts the skill union across classes and exams');
  await h.change('#source-filter','exam:ege-basic');
  const expected=exams.filter(q=>q.examId==='ege-basic'&&match(q,['equations','graphs'],tags)).map(q=>q.id);
  test(sameSet(checked(h),['equations','graphs'])&&same(cardIds(h),expected),'changing the source retains the two selected skills and shows their OR union');
  test(expected.includes('exam-2026-ege-basic-18-2')&&!expected.includes('exam-2026-ege-basic-18-1'),'actual UI filters individual alternatives rather than inheriting a whole exam number');
  h.pagehide();const restored=createHarness(h.store);await restored.click('[data-action="resume"]');
  test(sameSet(checked(restored),['equations','graphs']),'reloading and resuming the constructor restores the selected competencies');
  const badBadges=h.document.querySelectorAll('.bank-task').filter(card=>{const id=card.querySelector('[data-action="add"]').dataset.id;return !sameSet(card.querySelectorAll('.competency-tag[data-competency-tag]').map(badge=>badge.dataset.competencyTag),tags(byId.get(id)));});
  test(badBadges.length===0&&h.document.querySelectorAll('.competency-tag[data-competency-tag]').length>0,'every shown exam card displays precisely its mapped mathematical skills');
  await h.change('#source-filter','class:7:basic');
  const classExpected=classes.filter(q=>q.grade===7&&q.level==='basic'&&match(q,['equations','graphs'],tags)).map(q=>q.id);
  test(sameSet(checked(h),['equations','graphs'])&&same(await everyPage(h),classExpected),'the same skill union works across every page of a class bank');
  test(new Set(classExpected).size===classExpected.length&&h.text().includes('Страница'),'filtered pagination exposes each matching class task once');
  await select(h,'geometry');
  test(h.text().includes('Страница 1 из')&&cardIds(h).every(id=>match(byId.get(id),['equations','graphs','geometry'],tags)),'changing skills resets pagination and keeps only matching cards');
  test(h.networkCalls()===0,'competency selection and class/exam transitions remain offline');
 });
 await scenario('other filters intersect with skills; reset preserves the work',async()=>{
  const h=createHarness();await teacher(h);await h.change('#source-filter','class:5:basic');await select(h,'calculations');
  const q=byId.get('5-01-1');await h.change('#bank-filter',q.topicId);await h.change('#difficulty-filter',q.difficulty);
  const expected=classes.filter(x=>x.grade===5&&x.level==='basic'&&x.topicId===q.topicId&&x.difficulty===q.difficulty&&tags(x).includes('calculations')).map(x=>x.id);
  test(same(await everyPage(h),expected),'source, topic and difficulty intersect with the chosen skill across all pages');
  await h.input('#bank-search',q.id);test(same(cardIds(h),[q.id]),'ID search intersects with source, topic, difficulty and competency');
  await h.click(`[data-action="favorite"][data-id="${q.id}"]`);await h.change('#favorite-only',true);await h.click(`[data-action="add"][data-id="${q.id}"]`);
  test(same(cardIds(h),[q.id])&&same(selectedWork(h).ids,[q.id]),'favorite filtering remains compatible with adding the matching task to a work');
  await h.input('#bank-search','нет такого задания — компетенции');
  test(cardIds(h).length===0&&h.get('#bank-list').textContent.includes('Задания не найдены'),'an empty intersection has a clear empty state');
  await h.click('[data-action="clear-competencies"]');
  test(checked(h).length===0&&h.get('#source-filter').value==='class:5:basic'&&h.get('#bank-filter').value===q.topicId&&h.get('#difficulty-filter').value===q.difficulty&&h.get('#favorite-only').checked&&h.get('#bank-search').value.includes('нет такого'),'clear-competencies resets only skills and retains all other filters');
  await select(h,'geometry');await h.click('[data-action="reset-builder-filters"]');
  test(checked(h).length===0&&h.get('#source-filter').value==='all'&&h.get('#bank-filter').value==='all'&&h.get('#difficulty-filter').value==='all'&&!h.get('#favorite-only').checked&&!h.get('#tricky-only').checked&&h.get('#bank-search').value==='','reset-builder-filters clears the entire filtering state');
  test(same(selectedWork(h).ids,[q.id])&&h.state().favorites.includes(q.id),'both reset actions retain the selected work and the favorite itself');
 });
 await scenario('preset generation respects selected mathematical skills',async()=>{
  const h=createHarness();await teacher(h);
  const topic=BANK.find(t=>{
   const qs=classes.filter(q=>q.topicId===t.id);return expectedDefinitions.some(skill=>qs.some(q=>tags(q).includes(skill))&&qs.some(q=>!tags(q).includes(skill)));
  });
  test(!!topic,'a real mixed-skill class topic exists for the preset regression');if(!topic)return;
  const topicTasks=classes.filter(q=>q.topicId===topic.id);
  const skill=expectedDefinitions.find(id=>topicTasks.some(q=>tags(q).includes(id))&&topicTasks.some(q=>!tags(q).includes(id)));
  await h.change('#source-filter',`class:${topic.grade}:${topic.level}`);await h.change('#bank-filter',topic.id);await select(h,skill);
  const level=h.document.querySelectorAll('[data-action="preset-preview"]').find(button=>!button.disabled);
  test(!!level,'a matching preset difficulty remains available after competency filtering');if(!level)return;
  await h.click(`[data-action="preset-preview"][data-difficulty="${level.dataset.difficulty}"]`);
  const preview=h.get('#preset-preview');
  const previewIds=preview.querySelectorAll('.preset-preview-list strong').map(item=>item.textContent.match(/№\s+(\S+)/)?.[1]);
  test(previewIds.length>0&&previewIds.every(id=>tags(byId.get(id)).includes(skill)),'preset preview includes only tasks with the selected skill');
  await h.click('[data-action="preset-add"]');
  test(sameSet(selectedWork(h).ids,previewIds)&&selectedWork(h).ids.every(id=>tags(byId.get(id)).includes(skill)),'adding a preset cannot bypass the competency filter');
  await select(h,skill,false);const absent=expectedDefinitions.find(id=>topicTasks.every(q=>!tags(q).includes(id)));
  if(absent){await select(h,absent);test(h.document.querySelectorAll('[data-action="preset-preview"]').every(button=>button.disabled)&&cardIds(h).length===0,'a topic with no matching competency offers no unfiltered preset');}
 });
 await scenario('next variants preserve the task competency set',async()=>{
  const typed=classes.map(q=>({...q,competencies:tags(q)})),groups=new Map();
  for(const q of typed){const key=JSON.stringify([q.topicId,q.grade,q.level,q.difficulty,q.kind]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
  const group=[...groups.values()].find(qs=>qs.some(q=>qs.some(p=>p.id!==q.id&&sameSet(p.competencies,q.competencies)))&&qs.some(q=>!sameSet(q.competencies,qs[0].competencies)));
  test(!!group,'a real topic and difficulty contains different competency sets for variant verification');if(!group)return;
  const original=group.find(q=>group.some(p=>p.id!==q.id&&sameSet(p.competencies,q.competencies)));
  const results=Array.from({length:12},(_,index)=>initial.context.generateVariant([original.id],typed,'competency-variant-'+index)[0]);
  test(results.every(id=>sameSet(tags(byId.get(id)),original.competencies)),'variant substitutions preserve all mapped skills within the same topic, level and response format');
  test(results.some(id=>id!==original.id),'a competency-preserving alternative can still replace the original task');
 });
 test(digest()===originalDigest,'competency lookup, filtering, favorites and presets never mutate class tasks, official exam conditions, answers or source metadata');
 const report={checks,errors,scope:'Full 7,638-task metadata coverage and representative mathematical classifications; actual application checkbox, filter, pagination, preset and reset events',classTasks:classes.length,examExamples:exams.length};
 fs.writeFileSync(path.join(root,'checks/competency-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
