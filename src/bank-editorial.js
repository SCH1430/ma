// Human reviews are explicit, local records bound to the actual reviewed content.
globalThis.MathBankEditorial = (() => {
  const MAX_REVIEWS=1000;
  const criteria=Object.freeze([
    {id:'method_choice',title:'Объяснено, почему выбран этот метод'},
    {id:'step_reasons',title:'Обоснованы все нетривиальные переходы'},
    {id:'domain',title:'Сохранены ограничения, ОДЗ и условия применимости'},
    {id:'result_check',title:'Результат проверен в исходной задаче'}
  ]);
  const str=(v,max=1600)=>typeof v==='string'?v.slice(0,max):'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():'';
  const api=()=>{if(typeof MathBankEvidence==='undefined')throw Error('Модуль версий банка не загружен.');return MathBankEvidence;};
  const createStore=()=>({version:1,reviews:[]});
  function standard(q){
    const steps=Array.isArray(q?.solutionSteps)?q.solutionSteps:[];
    const fields={method_choice:{text:[q?.rationale,q?.methodChoice].filter(Boolean).join('\n'),present:!!str(q?.rationale).trim()&&!!str(q?.methodChoice).trim()},step_reasons:{steps,present:steps.length>0&&steps.every(s=>s&&!!str(s.statement).trim()&&!!str(s.reason).trim())},domain:{text:str(q?.domain),present:!!str(q?.domain).trim()},result_check:{text:str(q?.check),present:!!str(q?.check).trim()}};
    const missing=criteria.filter(c=>!fields[c.id].present).map(c=>c.id);
    return {complete:!missing.length,missing,fields};
  }
  function cleanReview(raw){
    if(!raw||typeof raw!=='object'||!str(raw.taskId,180)||!str(raw.contentHash,128)||!str(raw.fingerprint,128)||!str(raw.reviewer,120).trim()||!str(raw.comment).trim()||!date(raw.reviewedAt))return null;
    const checked={};for(const c of criteria)checked[c.id]=raw.criteria?.[c.id]===true;
    if(!criteria.every(c=>checked[c.id]))return null;
    return {id:str(raw.id,140)||[raw.taskId,raw.contentHash,raw.reviewedAt].join(':'),taskId:str(raw.taskId,180),contentHash:str(raw.contentHash,128),revision:Number.isSafeInteger(raw.revision)&&raw.revision>=0?raw.revision:null,fingerprint:str(raw.fingerprint,128),reviewer:str(raw.reviewer,120).trim(),comment:str(raw.comment).trim(),reviewedAt:date(raw.reviewedAt),criteria:checked};
  }
  function restore(raw){
    const entries=Array.isArray(raw?.reviews)?raw.reviews:[],seen=new Map();
    for(const item of entries.slice(-MAX_REVIEWS)){const review=cleanReview(item);if(review)seen.set(review.id,review);}
    return {version:1,reviews:[...seen.values()]};
  }
  function assessment(q,raw){
    const store=restore(raw),v=api().version(q),fingerprint=api().makeContentHash(q),history=store.reviews.filter(r=>r.taskId===q.id).sort((a,b)=>b.reviewedAt.localeCompare(a.reviewedAt));
    const matching=history.find(r=>r.contentHash===v.contentHash&&r.revision===v.revision&&r.fingerprint===fingerprint)||null;
    const review=matching?{...matching,at:matching.reviewedAt}:null;
    const matches=e=>!!e&&e.contentHash===v.contentHash;
    const assistantChecked=matches(q.assistantEvidence)&&q.assistantEvidence.status==='assistant_checked'&&!!str(q.assistantEvidence.checkedBy).trim();
    const mathChecked=matches(q.mathEvidence)&&q.mathEvidence.status==='passed'&&!!str(q.mathEvidence.checkedBy).trim()&&(Array.isArray(q.mathEvidence.checks)?q.mathEvidence.checks.length>0:Number.isSafeInteger(q.mathEvidence.checks)&&q.mathEvidence.checks>0);
    return {id:q.id,...v,fingerprint,standard:standard(q),status:review?'teacher_reviewed':'teacher_pending',teacherStatus:review?'teacher_reviewed':'teacher_pending',assistantChecked,assistantStatus:assistantChecked?'assistant_checked':'unknown',mathChecked,mathStatus:mathChecked?'math_checked':'unknown',review,outdated:!review&&history.length>0,previousReviews:history.filter(r=>r!==matching)};
  }
  function saveReview(raw,q,input,now=new Date().toISOString()){
    const store=restore(raw),state=assessment(q,store);
    if(!state.standard.complete)throw Error('В решении не заполнены все поля редакторского стандарта.');
    if(!criteria.every(c=>input?.criteria?.[c.id]===true))throw Error('Отметьте все четыре проверенных критерия.');
    const review=cleanReview({...input,id:globalThis.crypto?.randomUUID?.()||'review-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),taskId:q.id,...api().version(q),fingerprint:state.fingerprint,reviewedAt:now});
    if(!review)throw Error('Укажите автора, комментарий и корректное время рецензии.');
    const reviews=store.reviews.filter(r=>!(r.taskId===review.taskId&&r.contentHash===review.contentHash&&r.revision===review.revision&&r.fingerprint===review.fingerprint));
    if(reviews.length>=MAX_REVIEWS)throw Error('Сохранено 1000 рецензий. Выгрузите архив перед очисткой.');
    return {version:1,reviews:[...reviews,review]};
  }
  function exportReviews(raw,now=new Date().toISOString()){return {format:'baza-editorial-reviews',version:1,exportedAt:date(now)||new Date().toISOString(),reviews:restore(raw).reviews};}
  function importReviews(current,raw){
    const value=typeof raw==='string'?JSON.parse(raw):raw;
    if(!value||value.format!=='baza-editorial-reviews'||value.version!==1||!Array.isArray(value.reviews)||value.reviews.length>MAX_REVIEWS)throw Error('Нужен файл рецензий БАЗЫ.');
    const clean=restore(value);
    if(clean.reviews.length!==value.reviews.length)throw Error('Файл содержит неполные или повторяющиеся рецензии.');
    const reviews=new Map(restore(current).reviews.map(r=>[r.id,r]));for(const r of clean.reviews)reviews.set(r.id,r);
    if(reviews.size>MAX_REVIEWS)throw Error('После объединения получится больше 1000 рецензий.');
    return {version:1,reviews:[...reviews.values()]};
  }
  function summary(catalog,raw){
    const store=restore(raw),counts={total:0,assistant_checked:0,math_checked:0,teacher_pending:0,teacher_reviewed:0,outdated:0,standard_missing:0};
    const tasks=(Array.isArray(catalog)?catalog:[]).filter(q=>q.mathEvidence||q.assistantEvidence||q.rationale||store.reviews.some(r=>r.taskId===q.id)).map(q=>{const state=assessment(q,store);counts.total++;if(state.assistantChecked)counts.assistant_checked++;if(state.mathChecked)counts.math_checked++;counts[state.teacherStatus]++;if(state.outdated)counts.outdated++;if(!state.standard.complete)counts.standard_missing++;return {id:q.id,title:q.topic||q.prompt||q.id,...state};});
    return {counts,tasks};
  }
  function render(q,raw){
    const s=assessment(q,raw),labels={assistant_checked:'Проверено ассистентом',math_checked:'Автоматическая математическая проверка пройдена',teacher_pending:'Ожидает рецензии учителя',teacher_reviewed:'Проверено учителем'};
    return `<section class="editorial-review glass"><h2>Редакторская проверка</h2><p>Версия ${s.revision??'без номера'} · ${esc(s.contentHash.slice(0,16))}</p><ul><li>${s.assistantChecked?labels.assistant_checked:'Проверка ассистентом не подтверждена для этой версии'}</li><li>${s.mathChecked?labels.math_checked:'Автоматическая математическая проверка для этой версии не подтверждена'}</li><li>${labels[s.teacherStatus]}</li></ul>${s.outdated?'<p class="workspace-warning">Содержимое изменилось. Прежняя рецензия сохранена в истории и не действует для этой версии.</p>':''}${s.standard.complete?'':`<p class="workspace-warning">Не заполнены поля стандарта: ${s.standard.missing.map(id=>esc(criteria.find(c=>c.id===id).title)).join('; ')}.</p>`}<ol>${criteria.map(c=>`<li><strong>${esc(c.title)}</strong>${c.id==='step_reasons'?`<ol>${s.standard.fields[c.id].steps.map(step=>`<li>${esc(step.statement)}<br><em>${esc(step.reason)}</em></li>`).join('')}</ol>`:`<p>${esc(s.standard.fields[c.id].text||'Не заполнено')}</p>`}</li>`).join('')}</ol>${s.review?`<p><strong>${esc(s.review.reviewer)}</strong> · <time datetime="${esc(s.review.reviewedAt)}">${esc(s.review.reviewedAt)}</time></p><p>${esc(s.review.comment)}</p>`:'<p class="muted">Учительскую рецензию заполняет человек после прочтения решения и проверки четырёх критериев.</p>'}</section>`;
  }
  function renderSummary(catalog,store){
    const data=summary(catalog,store),c=data.counts;
    return `<section class="glass report-summary"><h2>Редакторский контроль</h2><p>Заданий со сведениями о проверке: ${c.total}. Проверка ассистентом: ${c.assistant_checked}; математическая проверка: ${c.math_checked}; рецензия учителя: ${c.teacher_reviewed}; ожидают учителя: ${c.teacher_pending}.</p>${c.outdated?`<p class="workspace-warning">Прежние рецензии отозваны после изменения содержимого: ${c.outdated}.</p>`:''}<p class="muted">Этапы учитываются отдельно. Автоматическая или ассистентская проверка не создаёт учительскую рецензию. Рецензия действует только для указанного содержимого, hash и revision.</p></section>`;
  }
  return Object.freeze({MAX_REVIEWS,criteria,createStore,standard,restore,assessment,saveReview,exportReviews,importReviews,summary,render,renderSummary});
})();
