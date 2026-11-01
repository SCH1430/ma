// Local aggregation of exported work results; totals are recomputed from records.
globalThis.MathTeacherReport = (() => {
  const MAX_FILES=100,MAX_FILE_BYTES=2*1024*1024;
  const str=(value,max=160)=>typeof value==='string'?value.slice(0,max):'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statuses=new Set(['correct','incorrect','unanswered','pending','awaiting-review','reviewed']);
  const kinds=new Set(['number','set','sequence','open','interval','coordinates','expression','matching','steps','examples']);
  function attempt(value){
    if(typeof MathBankEvidence!=='undefined')return MathBankEvidence.sanitizeAttempt(value);
    if(!value||typeof value!=='object'||typeof value.valid!=='boolean'||typeof value.correct!=='boolean')return null;
    const timed=value.timingRecorded===true&&Number.isSafeInteger(value.activeMs)&&value.activeMs>=0&&value.activeMs<=86400000;
    return {answer:str(value.answer,4000),valid:value.valid,correct:value.correct,at:typeof value.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():'',contentHash:str(value.contentHash,128),revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:null,hintBeforeAnswer:value.hintBeforeAnswer===true?true:value.hintBeforeAnswer===false?false:null,solutionBeforeAnswer:value.solutionBeforeAnswer===true?true:value.solutionBeforeAnswer===false?false:null,timingRecorded:timed,activeMs:timed?value.activeMs:null};
  }
  const earliest=(a,b)=>!a?b:!b?a:a.at&&b.at&&Date.parse(b.at)<Date.parse(a.at)?b:a;
  function sanitize(raw,label=''){
    if(!raw||raw.format!=='baza-work-results'||raw.version!==1||typeof raw.sessionId!=='string'||!raw.sessionId.trim()||!Array.isArray(raw.tasks)||!raw.tasks.length||raw.tasks.length>60)throw Error('Нужен JSON результатов работы, скачанный учеником.');
    const seen=new Set(),tasks=raw.tasks.map(q=>{
      if(!q||typeof q.id!=='string'||!q.id||q.id.length>180||seen.has(q.id)||!statuses.has(q.status)||!kinds.has(q.kind))throw Error('Повреждены записи заданий в результатах.');
      if(q.kind==='open'&&['correct','incorrect','pending'].includes(q.status)||q.kind!=='open'&&['reviewed','awaiting-review'].includes(q.status))throw Error('Статус задания не соответствует формату ответа.');
      seen.add(q.id);
      const firstAttempt=attempt(q.firstAttempt),firstValidAttempt=attempt(q.firstValidAttempt);
      return {id:q.id,kind:q.kind,status:q.status,hintUsed:q.hintUsed===true,hintBeforeAnswer:q.hintBeforeAnswer===true,solutionBeforeAnswer:q.solutionBeforeAnswer===true,revealed:q.revealed===true,tries:Number.isSafeInteger(q.tries)?Math.max(0,Math.min(q.tries,10000)):0,revision:Number.isSafeInteger(q.revision)?q.revision:null,contentHash:str(q.contentHash,64),firstAttempt,firstValidAttempt:firstValidAttempt?.valid?firstValidAttempt:null};
    });
    const learner=raw.learner&&typeof raw.learner==='object'?str(raw.learner.name,110):'';
    return {format:'baza-work-results',version:1,sessionId:str(raw.sessionId,100),participantRole:['student','teacher'].includes(raw.participantRole)?raw.participantRole:'',title:str(raw.title,70)||'Работа',variant:str(raw.variant,20)||'1',label:learner||str(label,110)||str(raw.label,110)||'Без имени',finished:raw.finished===true,startedAt:str(raw.startedAt,40),finishedAt:str(raw.finishedAt,40),tasks};
  }
  function merge(current,incoming){
    const values=new Map();
    for(const item of [...(Array.isArray(current)?current:[]),...(Array.isArray(incoming)?incoming:[])]){
      const clean=sanitize(item,item.label),previous=values.get(clean.sessionId);
      if(previous){const earlier=new Map(previous.tasks.map(q=>[q.id,q]));for(const q of clean.tasks){const old=earlier.get(q.id);if(old&&old.contentHash===q.contentHash&&old.revision===q.revision){q.firstAttempt=earliest(old.firstAttempt,q.firstAttempt);q.firstValidAttempt=earliest(old.firstValidAttempt,q.firstValidAttempt);}}}
      values.set(clean.sessionId,clean);
    }
    if(values.size>MAX_FILES)throw Error('В одной сводке можно хранить до 100 прохождений. Очистите сводку перед следующим классом.');
    return [...values.values()];
  }
  function restore(raw){
    const out=[];for(const item of (Array.isArray(raw)?raw:[]).slice(0,MAX_FILES))try{out.push(sanitize(item,item.label));}catch{}
    return merge([],out);
  }
  function totals(tasks){
    const out={total:0,short:0,correct:0,wrong:0,unanswered:0,pending:0,open:0,reviewed:0,independent:0,hinted:0,explained:0};
    for(const q of tasks){out.total++;if(q.kind==='open'){out.open++;if(q.status==='reviewed')out.reviewed++;continue;}out.short++;
      if(q.status==='correct'){out.correct++;out[q.solutionBeforeAnswer?'explained':q.hintBeforeAnswer?'hinted':'independent']++;}
      else if(q.status==='incorrect')out.wrong++;else if(q.status==='pending')out.pending++;else out.unanswered++;
    }return out;
  }
  function aggregate(reports,catalog){
    const byId=new Map((Array.isArray(catalog)?catalog:[]).map(q=>[q.id,q])),tasks=new Map(),skills=new Map(),sessions=[];let unknown=0,outdated=0;
    for(const r of restore(reports)){
      let changed=0;
      for(const item of r.tasks){
        const q=byId.get(item.id);if(!q){unknown++;continue;}
        if(q.contentHash&&item.contentHash&&q.contentHash!==item.contentHash||q.revision&&item.revision&&q.revision!==item.revision){outdated++;changed++;continue;}
        if(!tasks.has(q.id))tasks.set(q.id,{id:q.id,title:q.topic||q.subtypeTitle||q.prompt||q.id,records:[]});tasks.get(q.id).records.push(item);
        for(const skill of q.skills||[])if(item.kind!=='open'){
          if(!skills.has(skill))skills.set(skill,{id:skill,records:[]});skills.get(skill).records.push(item);
        }
      }
      sessions.push({...r,totals:totals(r.tasks),outdated:changed});
    }
    const complete=row=>({...row,...totals(row.records),records:undefined});
    return {sessions,totals:totals(sessions.flatMap(r=>r.tasks)),unknown,outdated,evidence:typeof MathBankEvidence!=='undefined'?MathBankEvidence.aggregate(sessions,catalog):null,tasks:[...tasks.values()].map(complete).sort((a,b)=>(b.wrong+b.unanswered+b.pending)-(a.wrong+a.unanswered+a.pending)||b.total-a.total||a.id.localeCompare(b.id)),skills:[...skills.values()].map(complete).sort((a,b)=>(b.wrong+b.unanswered+b.pending)-(a.wrong+a.unanswered+a.pending)||b.total-a.total||a.id.localeCompare(b.id))};
  }
  function renderBase(reports,catalog,definitions=[]){
    const result=aggregate(reports,catalog),labels=new Map(definitions.map(q=>[q.id,q.title]));
    const percent=(n,d)=>d?Math.round(100*n/d)+'%':'—';
    return `<section class="glass report-import"><h2>Результаты класса</h2><p>Загрузите JSON результатов учеников. Повторный файл одного прохождения обновляет его запись. Можно объединить до 100 прохождений.</p><div class="builder-actions"><button class="primary" type="button" data-action="report-import">Загрузить результаты</button><button class="secondary" type="button" data-action="report-export" ${result.sessions.length?'':'disabled'}>Скачать сводку CSV</button><button class="text-button" type="button" data-action="report-clear" ${result.sessions.length?'':'disabled'}>Очистить сводку</button></div><input id="report-files" type="file" accept=".json,application/json" multiple hidden><p id="report-import-status" role="status"></p><p class="muted">Данные обрабатываются на устройстве. Показаны результаты из файлов; самопроверка рассуждений учитывается отдельно.</p></section>${result.sessions.length?`<section class="glass report-summary"><h2>${result.sessions.length} прохождений · ${result.totals.total} ответов по заданиям</h2><p>Краткие ответы: верно ${result.totals.correct} из ${result.totals.short} (${percent(result.totals.correct,result.totals.short)}), самостоятельно ${result.totals.independent}, с подсказкой ${result.totals.hinted}, после разбора ${result.totals.explained}. Рассуждения: сверено ${result.totals.reviewed} из ${result.totals.open}.</p>${result.unknown||result.outdated?`<p class="muted">В детализацию по текущему банку не включены: отсутствующие задания — ${result.unknown}, изменённые версии — ${result.outdated}. В строках прохождений сохранены итоги исходных файлов.</p>`:''}<div class="report-scroll"><table><caption>Прохождения учеников</caption><thead><tr><th>Ученик / файл</th><th>Работа</th><th>Верно кратких</th><th>Самостоятельно</th><th>С подсказкой / разбором</th><th>Сверено рассуждений</th><th>Состояние</th></tr></thead><tbody>${result.sessions.map(r=>`<tr><th>${esc(r.label)}</th><td>${esc(r.title)} · ${esc(r.variant)}</td><td>${r.totals.correct} / ${r.totals.short}</td><td>${r.totals.independent}</td><td>${r.totals.hinted} / ${r.totals.explained}</td><td>${r.totals.reviewed} / ${r.totals.open}</td><td>${r.finished?'Завершена':'Не завершена'}${r.outdated?' · есть изменённые задания':''}</td></tr>`).join('')}</tbody></table></div></section><section class="glass report-summary"><h2>Навыки для следующего урока</h2>${result.skills.length?`<ul>${result.skills.slice(0,10).map(r=>`<li><strong>${esc(labels.get(r.id)||r.id)}</strong>: ошибки ${r.wrong}, пропуски ${r.unanswered}, не проверено ${r.pending}; самостоятельно верно ${r.independent} из ${r.short} ответов по заданиям.</li>`).join('')}</ul>`:'<p>Для этих заданий нет разметки навыков в текущем банке.</p>'}<p class="muted">Один ответ может относиться к нескольким навыкам. Суммы по навыкам не складываются в число заданий.</p><div class="report-scroll"><table><caption>Задания по числу ошибок, пропусков и непроверенных ответов</caption><thead><tr><th>Задание</th><th>Ответов</th><th>Неверно</th><th>Пропущено</th><th>Не проверено</th><th>Самостоятельно верно</th></tr></thead><tbody>${result.tasks.filter(r=>r.short).map(r=>`<tr><th>${esc(r.id)}<small>${esc(r.title).slice(0,180)}</small></th><td>${r.short}</td><td>${r.wrong}</td><td>${r.unanswered}</td><td>${r.pending}</td><td>${r.independent}</td></tr>`).join('')}</tbody></table></div></section>`:''}`;
  }
  function render(reports,catalog,definitions=[],options={}){
    return renderBase(reports,catalog,definitions)+(typeof MathBankEvidence!=='undefined'?MathBankEvidence.render(restore(reports),catalog):'')+(typeof MathBankEditorial!=='undefined'?MathBankEditorial.renderSummary(catalog,options.editorialStore||options.reviews||options):'');
  }
  function csv(reports,catalog){
    const result=aggregate(reports,catalog),quote=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[\s]*[=+@-]/,"'$&")+'"';
    const rows=[['Ученик / файл','Работа','Вариант','Кратких','Верно','Самостоятельно','С подсказкой','После разбора','Неверно','Пропущено','Не проверено','Рассуждений','Сверено','Завершена']];
    for(const r of result.sessions){const t=r.totals;rows.push([r.label,r.title,r.variant,t.short,t.correct,t.independent,t.hinted,t.explained,t.wrong,t.unanswered,t.pending,t.open,t.reviewed,r.finished?'Да':'Нет']);}
    return '\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  }
  return Object.freeze({MAX_FILES,MAX_FILE_BYTES,sanitize,merge,restore,totals,aggregate,render,csv});
})();
