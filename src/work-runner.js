// A work run owns its answers: practicing a collection never changes topic progress.
globalThis.MathWorkRunner = (() => {
  const LIMIT=60, VERSION=1;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const catalogMap=catalog=>catalog instanceof Map?catalog:new Map((Array.isArray(catalog)?catalog:[]).map(q=>[q.id,q]));
  const kind=q=>q?.answerKind||q?.kind||'number';
  const text=(value,max=4000)=>typeof value==='string'?value.slice(0,max):'';
  const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))?value.slice(0,30):'';
  const now=()=>new Date().toISOString();
  const freshRecord=()=>({draft:'',submitted:false,correct:false,feedback:'',revealed:false,solutionBeforeAnswer:false,checks:[],reviewed:false,tries:0});
  const current=session=>session?.ids?.[session.index];
  const record=(session,id=current(session))=>session?.records?.[id];
  function evaluate(raw,q,checker){
    if(kind(q)==='open')return {valid:false,correct:false,requiresReview:true};
    if(kind(q)==='sequence'){
      const value=String(raw??'').replace(/\s+/g,'');
      const answers=Array.isArray(q.answers)?q.answers:[q.answer??q.display];
      const valid=/^\d+$/.test(value);
      return {valid,correct:valid&&answers.some(answer=>value===String(answer).replace(/\s+/g,''))};
    }
    // The official trainer compares numeric keys exactly. Keep that behavior
    // when the same FIPI task is solved in an assembled work.
    if(q.source==='exam'&&typeof MathExam!=='undefined'&&typeof parseAnswer==='function')return MathExam.checkAnswer(raw,{...q,answerKind:kind(q)},parseAnswer);
    if(typeof checker!=='function')return {valid:false,correct:false};
    if(Array.isArray(q.answers)&&kind(q)==='number'){
      const results=q.answers.map(value=>Number(String(value).replace(/,/g,'.').replace(/−/g,'-'))).filter(Number.isFinite).map(answer=>checker(raw,{...q,kind:'number',answer}));
      return {valid:results.some(result=>result.valid===true),correct:results.some(result=>result.valid===true&&result.correct===true)};
    }
    const result=checker(raw,q)||{};
    return {valid:result.valid===true,correct:result.valid===true&&result.correct===true};
  }
  function sanitizeSession(raw,catalog,checker){
    if(!raw||typeof raw!=='object'||raw.version!==VERSION||!Array.isArray(raw.ids))return null;
    const byId=catalogMap(catalog),ids=[...new Set(raw.ids.filter(id=>typeof id==='string'&&byId.has(id)))].slice(0,LIMIT);
    if(!ids.length)return null;
    const records={};
    for(const id of ids){
      const q=byId.get(id),value=raw.records&&typeof raw.records==='object'?raw.records[id]:null,r=freshRecord();
      if(value&&typeof value==='object'){
        r.draft=text(value.draft);r.revealed=value.revealed===true;r.solutionBeforeAnswer=r.revealed&&value.solutionBeforeAnswer===true;
        r.tries=Number.isSafeInteger(value.tries)?Math.max(0,Math.min(10000,value.tries)):0;
        r.checks=(Array.isArray(value.checks)?value.checks:[]).slice(0,Array.isArray(q.rubric)?Math.min(20,q.rubric.length):0).map(x=>x===true);
        r.submitted=kind(q)!=='open'&&value.submitted===true&&!!r.draft.trim();
        r.reviewed=kind(q)==='open'&&value.reviewed===true&&r.revealed&&!!r.draft.trim()&&(q.rubric||[]).every((_,i)=>r.checks[i]);
        if(r.submitted){
          if(typeof checker==='function'||kind(q)==='sequence'){
            const result=evaluate(r.draft,q,checker);r.correct=result.correct;r.feedback=result.valid?result.correct?'correct':'wrong':'format';
          }else{r.correct=value.correct===true;r.feedback=r.correct?'correct':['wrong','format'].includes(value.feedback)?value.feedback:'';}
        }
      }
      records[id]=r;
    }
    const retainedIndex=Number.isInteger(raw.index)?ids.indexOf(raw.ids[raw.index]):-1;
    return {version:VERSION,id:text(raw.id,80)||'work-run',title:text(raw.title,70).trim()||'Самостоятельная работа',variant:text(raw.variant,20).trim()||'1',ids,index:retainedIndex>=0?retainedIndex:Number.isInteger(raw.index)?Math.max(0,Math.min(ids.length-1,raw.index)):0,phase:raw.phase==='results'?'results':'solving',startedAt:date(raw.startedAt)||now(),finishedAt:raw.phase==='results'?date(raw.finishedAt):'',records};
  }
  function createSession(work,catalog,options={}){
    return sanitizeSession({version:VERSION,id:options.id||globalThis.crypto?.randomUUID?.()||'run-'+Date.now().toString(36),title:work?.title,variant:work?.variant,ids:Array.isArray(work?.ids)?[...work.ids]:[],index:0,phase:'solving',startedAt:options.now||now(),records:{}},catalog);
  }
  function setDraft(session,value){
    if(!session||session.phase!=='solving')return false;
    const r=record(session),next=text(value);if(!r||r.draft===next)return false;
    r.draft=next;r.submitted=false;r.correct=false;r.feedback='';r.reviewed=false;r.checks=[];r.solutionBeforeAnswer=false;return true;
  }
  function go(session,index){
    if(!session||!Number.isInteger(Number(index)))return false;
    session.index=Math.max(0,Math.min(session.ids.length-1,Number(index)));return true;
  }
  function submit(session,catalog,checker){
    if(!session||session.phase!=='solving')return null;
    const q=catalogMap(catalog).get(current(session)),r=record(session);if(!q||!r||kind(q)==='open')return null;
    const result=evaluate(r.draft,q,checker);if(!r.correct)r.solutionBeforeAnswer=r.revealed;r.submitted=true;r.correct=result.correct;r.feedback=result.valid?result.correct?'correct':'wrong':'format';r.tries=Math.min(10000,r.tries+1);return result;
  }
  function reveal(session){const r=record(session);if(!r)return false;r.revealed=true;return true;}
  function setCriterion(session,catalog,index,checked){
    if(!session)return false;
    const q=catalogMap(catalog).get(current(session)),r=record(session),i=Number(index);
    if(kind(q)!=='open'||!r?.revealed||!Number.isInteger(i)||i<0||i>=(q.rubric||[]).length)return false;
    r.checks[i]=checked===true;r.reviewed=false;return true;
  }
  function review(session,catalog){
    if(!session)return false;
    const q=catalogMap(catalog).get(current(session)),r=record(session);
    if(kind(q)!=='open'||!r?.revealed||!r.draft.trim()||!(q.rubric||[]).every((_,i)=>r.checks[i]))return false;
    r.reviewed=true;return true;
  }
  function finish(session,catalog,checker){
    if(!session)return null;
    const byId=catalogMap(catalog);
    for(const id of session.ids){
      const q=byId.get(id),r=record(session,id);if(!q||kind(q)==='open'||!r.draft.trim())continue;
      const result=evaluate(r.draft,q,checker);if(!r.correct)r.solutionBeforeAnswer=r.revealed;r.submitted=true;r.correct=result.correct;r.feedback=result.valid?result.correct?'correct':'wrong':'format';
    }
    session.phase='results';session.finishedAt=now();return summary(session,byId);
  }
  function reopen(session){if(!session)return false;session.phase='solving';session.finishedAt='';return true;}
  function status(q,r){
    if(kind(q)==='open')return r.reviewed?'reviewed':r.draft.trim()?'awaiting-review':'unanswered';
    if(!r.draft.trim())return 'unanswered';
    if(!r.submitted)return 'pending';
    return r.correct?'correct':'incorrect';
  }
  function summary(session,catalog){
    const byId=catalogMap(catalog),out={total:0,short:0,correct:0,incorrect:0,unanswered:0,pending:0,open:0,reviewed:0,awaitingReview:0,openUnanswered:0,independent:0,afterReveal:0};
    if(!session)return out;
    for(const id of session.ids){
      const q=byId.get(id),r=record(session,id);if(!q||!r)continue;
      out.total++;const s=status(q,r);
      if(kind(q)==='open'){out.open++;if(s==='reviewed')out.reviewed++;else if(s==='awaiting-review')out.awaitingReview++;else out.openUnanswered++;}
      else{out.short++;if(s==='correct'){out.correct++;out[r.solutionBeforeAnswer?'afterReveal':'independent']++;}else if(s==='incorrect')out.incorrect++;else if(s==='pending')out.pending++;else out.unanswered++;}
    }
    return out;
  }
  function exportResults(session,catalog){
    if(!session)return null;
    const byId=catalogMap(catalog);
    return {format:'baza-work-results',version:VERSION,sessionId:session.id,title:session.title,variant:session.variant,startedAt:session.startedAt,finishedAt:session.finishedAt,finished:session.phase==='results',summary:summary(session,byId),tasks:session.ids.map((id,index)=>{
      const q=byId.get(id),r=record(session,id);
      const state=status(q,r);
      return {number:index+1,id,source:q.sourceLabel||q.source||'',...(q.sourceUrl?{sourceUrl:q.sourceUrl}:{}),...(q.subtypeId?{subtypeId:q.subtypeId}:{}),kind:kind(q),answer:r.draft,status:state,correct:state==='correct'?true:state==='incorrect'?false:null,reviewed:r.reviewed,revealed:r.revealed,solutionBeforeAnswer:r.solutionBeforeAnswer,checks:[...r.checks],tries:r.tries};
    })};
  }
  function render(session,catalog,options={}){
    if(!session)return '<p class="empty">Работа не выбрана. Откройте сохранённую подборку.</p>';
    const byId=catalogMap(catalog),esc=options.esc||escape,math=options.mathHTML||esc,q=byId.get(current(session)),r=record(session),totals=summary(session,byId);
    if(!q||!r)return '<p class="empty">Задание недоступно в текущем банке.</p>';
    const button=(action,label,cls='secondary',attrs='')=>`<button type="button" class="${cls}" data-action="run-${action}" ${attrs}>${label}</button>`;
    const label={correct:'Верно',incorrect:'Неверно',unanswered:'Без ответа',pending:'Ответ записан','awaiting-review':'Ожидает сверки',reviewed:'Сверено по критериям'};
    const safeUrl=url=>typeof url==='string'&&/^https:\/\//i.test(url)?url:null;
    const imageMarkup=(images,alt)=>`<div class="work-run-images">${(images||[]).filter(src=>typeof src==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src)).map((src,index)=>`<img src="${esc(src)}" alt="${esc(alt)}${images.length>1?`, фрагмент ${index+1}`:''}" decoding="async">`).join('')}</div>`;
    const taskBody=()=>{
      const context=(q.contextImages||[]).length?`<details class="exam-context" open><summary>Общее условие</summary>${imageMarkup(q.contextImages,'Общее условие к заданию')}</details>`:q.context?`<div class="exam-context">${math(q.context)}</div>`:'';
      const prompt=typeof options.taskMarkup==='function'?options.taskMarkup(q):q.promptHtml?`<div class="work-run-source-html">${q.promptHtml}</div>`:(q.source==='exam'&&(q.images||[]).length?imageMarkup(q.images,'Оригинальное условие задания')+`<p class="sr-only">${esc(q.prompt||q.text||'')}</p>`:`<p class="task-prompt">${math(q.prompt||q.text||'')}</p>${imageMarkup(q.images,'Рисунок к заданию')}${options.figureSVG?options.figureSVG(q.id):''}`);
      return context+prompt;
    };
    const references=()=>{
      const pages=[...(q.solutionPages||[]),...(q.answerPages||[])];
      return `<section class="work-run-solution" aria-labelledby="work-run-solution-heading"><h3 id="work-run-solution-heading">Разбор и самопроверка</h3>${q.answerHtml?`<div class="work-run-source-html">${q.answerHtml}</div>`:q.display||q.answerText?`<p><strong>Ответ:</strong> ${math(q.display||q.answerText)}</p>`:''}${q.solutionHtml?`<div class="work-run-source-html">${q.solutionHtml}</div>`:q.solution?`<p>${math(q.solution)}</p>`:''}${pages.map(page=>`<div class="exam-reference-page"><p class="exam-page-label">Страница ${esc(page.page)} оригинала</p>${imageMarkup([page.image],'Решение и критерии')}</div>`).join('')}${kind(q)==='open'?`<p class="muted">Сверьте своё рассуждение с образцом и критериями. Развёрнутый ответ проверяется самостоятельно; автоматический балл не выставляется.</p><div class="rubric-list">${(q.rubric||[]).map((criterion,index)=>`<label class="check"><input id="work-run-criterion-${index}" type="checkbox" data-run-rubric="${index}" ${r.checks[index]?'checked':''}>${esc(criterion)}</label>`).join('')}</div>${button('review',r.reviewed?'Сверка отмечена ✓':'Я сверил(а) решение с критериями','secondary',!r.draft.trim()||r.reviewed||!(q.rubric||[]).every((_,i)=>r.checks[i])?'disabled':'')}`:''}</section>`;
    };
    const hint=kind(q)==='sequence'?'Последовательность цифр в порядке из условия. Сохраняйте ведущие нули; пробелы допустимы.':kind(q)==='set'?'Все корни через точку с запятой; порядок не важен. Если решений нет, введите ∅.':kind(q)==='open'?'Запишите рассуждение. Чертёж и вычисления можно выполнить в тетради.':'Введите число без единиц. Допустимы точка, запятая, дроби, π и квадратный корень.';
    const navigation=`<nav class="work-run-numbers" aria-label="Задания работы">${session.ids.map((id,index)=>{const state=status(byId.get(id),record(session,id));return button('task',String(index+1),'task-dot run-state-'+state,`data-index="${index}" ${session.index===index?'aria-current="step"':''} aria-label="Задание ${index+1}: ${esc(label[state])}"`);}).join('')}</nav>`;
    const overview=`<div class="work-run-top"><div><span class="badge">Вариант ${esc(session.variant)} · ${session.ids.length} заданий</span><p class="muted">Ответы этой работы сохраняются отдельно от тренажёра на этом устройстве.</p></div>${button('exit','К подборкам','secondary')}</div>`;
    const source=safeUrl(q.sourceUrl)?`<a href="${esc(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(q.sourceLabel||'Источник')} ${q.sourceId?'№ '+esc(q.sourceId):''} ↗</a>`:esc(q.sourceLabel||q.topic||'');
    const response=session.phase==='results'?`<div class="work-run-submitted"><strong>Ваш ответ:</strong> ${r.draft.trim()?math(r.draft):'Не записан'}<p class="run-state-text">${esc(label[status(q,r)])}${r.solutionBeforeAnswer&&kind(q)!=='open'?' · после просмотра разбора':''}</p></div>`:kind(q)==='open'?`<label class="field" for="work-run-draft">Ваше рассуждение<textarea id="work-run-draft" rows="7" maxlength="4000" aria-describedby="work-run-format">${esc(r.draft)}</textarea></label><p class="muted" id="work-run-format">${esc(hint)}</p>`:`<form id="work-run-answer-form"><div class="answer-row"><label class="field" for="work-run-answer">Ваш ответ<input id="work-run-answer" name="answer" autocomplete="off" spellcheck="false" maxlength="4000" value="${esc(r.draft)}" aria-describedby="work-run-format${r.feedback?' work-run-feedback':''}"></label><button type="submit" class="primary">Проверить</button></div><p class="muted" id="work-run-format">${esc(hint)}</p></form>${r.feedback?`<div class="feedback ${r.correct?'':'wrong'}" id="work-run-feedback" role="status" tabindex="-1">${r.feedback==='format'?'Проверьте формат ответа.':r.correct?r.solutionBeforeAnswer?'Ответ верный после просмотра разбора.':'Ответ верный.':'Ответ пока не сходится. Проверьте решение.'}</div>`:''}`;
    const results=session.phase==='results'?`<section class="work-run-results glass" aria-labelledby="work-run-results-heading"><h2 id="work-run-results-heading">Результаты работы</h2><dl class="work-run-counts"><div><dt>Краткие ответы</dt><dd>${totals.correct} из ${totals.short} верно</dd></div><div><dt>Неверно</dt><dd>${totals.incorrect}</dd></div><div><dt>Без ответа</dt><dd>${totals.unanswered}</dd></div>${totals.open?`<div><dt>Развёрнутые ответы</dt><dd>${totals.reviewed} из ${totals.open} сверено</dd></div><div><dt>Ожидают сверки</dt><dd>${totals.awaitingReview}</dd></div><div><dt>Рассуждение не записано</dt><dd>${totals.openUnanswered}</dd></div>`:''}</dl><p class="muted">Самостоятельно верно: ${totals.independent} · после просмотра разбора: ${totals.afterReveal}. Сверка развёрнутых ответов учитывается отдельно.</p><div class="builder-actions">${button('export','Скачать результаты JSON ↓','primary')}${button('reopen','Продолжить решать','secondary')}</div><div class="work-run-table-wrap"><table class="work-run-table"><caption class="sr-only">Ответы и результаты по заданиям</caption><thead><tr><th scope="col">Задание</th><th scope="col">Ваш ответ</th><th scope="col">Результат</th></tr></thead><tbody>${session.ids.map((id,index)=>{const task=byId.get(id),answer=record(session,id);return `<tr><th scope="row">${button('task','№ '+(index+1),'text-button',`data-index="${index}"`)}</th><td>${answer.draft.trim()?esc(answer.draft):'—'}</td><td>${esc(label[status(task,answer)])}${answer.revealed?' · разбор открыт':''}</td></tr>`;}).join('')}</tbody></table></div></section>`:'';
    return `<div class="work-runner">${overview}${results}${navigation}<article class="glass task-card work-run-card"><div class="task-meta"><span>Задание ${session.index+1} из ${session.ids.length}</span><span>${esc(q.difficulty||'')}</span></div><p class="work-run-source">${source}${q.topic||q.subtypeTitle?` · ${esc(q.subtypeTitle||q.topic)}`:''}</p>${taskBody()}${response}<div class="work-run-help">${r.revealed||session.phase==='results'?'':button('reveal','Открыть разбор','text-button')}<span class="muted">Просмотр разбора учитывается в результатах.</span></div>${r.revealed?references():session.phase==='results'?button('reveal','Посмотреть ответ и разбор','secondary'):''}</article><div class="task-nav">${button('prev','← Предыдущее','secondary',session.index?'':'disabled')}${session.index<session.ids.length-1?button('next','Следующее →','primary'):session.phase==='solving'?button('finish','Завершить работу','primary'):button('exit','К подборкам','primary')}</div>${session.phase==='solving'?`<div class="work-run-finish">${button('finish','Завершить и показать результаты','secondary')}<p class="muted">Записанные краткие ответы будут проверены, пропуски сохранятся в итогах.</p></div>`:''}</div>`;
  }
  return {createSession,sanitizeSession,setDraft,go,submit,reveal,setCriterion,review,finish,reopen,summary,exportResults,render,evaluate};
})();
