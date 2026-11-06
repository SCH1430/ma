// Pure local learning history and selection. It never changes trainer attempts.
globalThis.MathLearningPath = (() => {
  'use strict';
  const VERSION=1,DAY=86400000,MAX_EVENTS=120,MAX_RESULTS=60,INTERVALS=[1,3,7,14,30];
  const text=(value,max=160)=>typeof value==='string'?value.slice(0,max):'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const array=value=>Array.isArray(value)?value:[];
  const catalogArray=catalog=>catalog instanceof Map?[...catalog.values()]:array(catalog);
  const map=catalog=>new Map(catalogArray(catalog).filter(q=>q&&typeof q.id==='string').map(q=>[q.id,q]));
  const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  const current=options=>date(options?.now)||new Date().toISOString();
  const grade=value=>Number.isInteger(Number(value))&&Number(value)>=5&&Number(value)<=11?Number(value):null;
  const level=(value,g)=>g>=10?value==='advanced'?'advanced':'basic':null;
  const kind=q=>q?.answerKind||q?.kind||'number';
  const skills=q=>typeof MathBankPedagogy!=='undefined'?MathBankPedagogy.forTask(q):array(q?.skills).filter(id=>typeof id==='string'&&/^[a-z-]{2,60}$/.test(id));
  const definitions=()=>typeof MathBankPedagogy!=='undefined'?MathBankPedagogy.definitions:[];
  const definition=id=>definitions().find(item=>item.id===id)||{id,title:id,prerequisites:[]};
  const family=q=>text(q?.family||q?.subtypeId||q?.canonicalId||q?.id,200);
  const canonical=q=>q.canonicalId||q.id;
  const eligible=(q,g,l)=>grade(q.grade)===g&&(g<10||(q.level||'basic')===l)&&['number','set','sequence','interval','coordinates','expression','matching','steps','examples'].includes(kind(q))&&skills(q).length;
  const legacyHash=q=>{
    let value=2166136261;for(const character of JSON.stringify([q.prompt,q.answer,q.answers,q.kind,q.answerKind])){value^=character.charCodeAt(0);value=Math.imul(value,16777619);}return 'local-'+(value>>>0).toString(16);
  };
  const hash=q=>q.contentHash?text(q.contentHash,100):typeof MathBankEvidence!=='undefined'?MathBankEvidence.version(q).contentHash:legacyHash(q);
  function emptyState(){return {version:VERSION,events:[],lessonsRead:[]};}
  function basicCheck(raw,q){
    const parse=rawValue=>{const parts=String(rawValue).trim().replace(/−/g,'-').replace(/,/g,'.').split('/');if(parts.length>2||!parts.every(part=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part.trim())))return null;const result=Number(parts[0])/(parts.length===2?Number(parts[1]):1);return Number.isFinite(result)?result:null;};
    if(kind(q)==='sequence'){const actual=String(raw).replace(/\s/g,'');return {valid:/^\d+$/.test(actual),correct:array(q.answers?.length?q.answers:[q.answer??q.display]).some(answer=>String(answer).replace(/\s/g,'')===actual)};}
    if(kind(q)==='set'){
      if(['∅','{}','нет','нет решений','нет корней'].includes(String(raw).trim().toLowerCase()))return {valid:true,correct:array(q.answer).length===0};
      const actual=[...new Set(String(raw).split(';').map(parse))].sort((a,b)=>a-b),expected=[...array(q.answer)].sort((a,b)=>a-b);
      return {valid:actual.length>0&&!actual.includes(null),correct:actual.length===expected.length&&!actual.includes(null)&&actual.every((value,index)=>Math.abs(value-expected[index])<=1e-8)};
    }
    const value=parse(raw);return {valid:value!==null,correct:value!==null&&array(q.answers?.length?q.answers:[q.answer]).some(answer=>Math.abs(value-Number(answer))<=1e-8)};
  }
  function evaluate(raw,q,options){
    const checker=typeof options?.checker==='function'?options.checker:typeof checkAnswer==='function'?checkAnswer:basicCheck;
    try{return typeof MathWorkRunner!=='undefined'&&typeof MathWorkRunner.evaluate==='function'?MathWorkRunner.evaluate(raw,q,checker):kind(q)==='sequence'?basicCheck(raw,q):checker(raw,q)||{valid:false,correct:false};}catch{return {valid:false,correct:false};}
  }
  function cleanResult(raw,q,options){
    const answer=text(raw?.answer??raw?.draft,4000),fingerprint=hash(q),compatibleLegacy=!q.contentHash&&raw?.contentHash===legacyHash(q),updated=!!raw?.contentHash&&raw.contentHash!==fingerprint&&!compatibleLegacy;
    const checked=!updated&&answer.trim()?evaluate(answer,q,options):{valid:false,correct:false};
    const attempted=!!answer.trim()&&(raw?.submitted===true||['correct','incorrect','format'].includes(raw?.status));
    const correct=attempted&&checked.valid===true&&checked.correct===true;
    const hinted=raw?.hintBeforeAnswer===true,explained=raw?.solutionBeforeAnswer===true;
    return {id:q.id,family:family(q),skills:skills(q),answer,contentHash:updated?text(raw.contentHash,100):fingerprint,status:updated?'updated':!answer.trim()?'unanswered':!attempted?'pending':correct?'correct':checked.valid?'incorrect':'format',independent:correct&&!hinted&&!explained,hintBeforeAnswer:hinted,solutionBeforeAnswer:explained,submitted:attempted};
  }
  function sanitizeState(raw,catalog,options={}){
    const clean=emptyState(),byId=map(catalog),seen=new Set();
    if(!raw||raw.version!==VERSION)return clean;
    for(const event of array(raw.events).slice(-MAX_EVENTS)){
      if(!event||typeof event!=='object')continue;
      const id=text(event.id,120),at=date(event.at),g=grade(event.grade);if(!id||!at||seen.has(id)||Date.parse(at)>Date.parse(current(options))+5*60000)continue;
      const l=level(event.level,g),ids=new Set(),results=[];
      for(const result of array(event.results).slice(0,MAX_RESULTS)){
        const q=byId.get(result?.id);if(!q||ids.has(q.id)||!['number','set','sequence','interval','coordinates','expression','matching','steps','examples'].includes(kind(q)))continue;
        ids.add(q.id);results.push(cleanResult(result,q,options));
      }
      if(!results.length)continue;
      seen.add(id);clean.events.push({id,at,grade:g,level:l,kind:['diagnostic','review','practice','lesson','project','topic'].includes(event.kind)?event.kind:'practice',results});
    }
    clean.events.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
    const knownLessons=new Set(typeof MathLearningContent==='undefined'?[]:MathLearningContent.lessons.map(item=>item.id));
    clean.lessonsRead=[...new Set(array(raw.lessonsRead).filter(id=>knownLessons.has(id)))].slice(0,60);
    return clean;
  }
  function recordActivity(state,activity,catalog,options={}){
    const clean=sanitizeState(state,catalog,options);
    if(!activity||activity.completed!==true)return clean;
    const event={...activity,at:date(activity.at)||current(options),results:array(activity.results)};
    if(clean.events.some(item=>item.id===event.id))return clean;
    return sanitizeState({...clean,events:[...clean.events,event]},catalog,options);
  }
  function recordSession(state,session,catalog,options={}){
    if(!session||session.phase!=='results')return sanitizeState(state,catalog,options);
    const byId=map(catalog),qs=array(session.ids).map(id=>byId.get(id)).filter(Boolean),grades=[...new Set(qs.map(q=>grade(q.grade)).filter(Boolean))];
    return recordActivity(state,{id:'run:'+text(session.id,100),kind:options.kind||'practice',completed:true,grade:grade(options.grade)|| (grades.length===1?grades[0]:null),level:options.level||qs[0]?.level,at:date(options.now)||date(session.finishedAt)||current(options),results:qs.map(q=>{const result=session.records?.[q.id]||{};return {id:q.id,answer:result.draft,submitted:result.submitted,contentHash:result.contentHash||hash(q),hintBeforeAnswer:result.hintBeforeAnswer,solutionBeforeAnswer:result.solutionBeforeAnswer};})},catalog,options);
  }
  function markLessonRead(state,id,catalog,options={}){
    const clean=sanitizeState(state,catalog,options);if(typeof MathLearningContent!=='undefined'&&MathLearningContent.lessons.some(lesson=>lesson.id===id))clean.lessonsRead=[...new Set([...clean.lessonsRead,id])];return clean;
  }
  function profile(state,catalog,options={}){
    const g=grade(options.grade),l=level(options.level,g),now=current(options),clean=sanitizeState(state,catalog,options),byId=map(catalog),pool=catalogArray(catalog).filter(q=>eligible(q,g,l));
    const ids=new Set(pool.flatMap(skills)),makeRow=id=>({id,title:definition(id).title,prerequisites:definition(id).prerequisites,attempts:0,correct:0,independent:0,streak:0,families:new Set(),lastAt:'',lastSuccessAt:'',lastStatus:'new',dueAt:'',sessions:0,foundationAttempts:0,foundationCorrect:0,foundationIndependent:0,foundationAt:'',foundationStatus:''}),rows=new Map([...ids].map(id=>[id,makeRow(id)]));
    for(const event of clean.events){
      const groups=new Map(),foundations=new Map();
      for(const result of event.results){
        const q=byId.get(result.id);if(!q||result.status==='updated')continue;
        if(q.grade<g&&event.grade===g&&(g<10||event.level===l)&&['lesson','project'].includes(event.kind)){
          for(const id of result.skills){if(!rows.has(id))rows.set(id,makeRow(id));if(!foundations.has(id))foundations.set(id,[]);foundations.get(id).push(result);}continue;
        }
        if(!eligible(q,g,l))continue;
        for(const id of result.skills){if(!rows.has(id))continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(result);}
      }
      for(const [id,results] of foundations){
        const row=rows.get(id),answered=results.filter(result=>['correct','incorrect','format'].includes(result.status));
        row.foundationAt=event.at;row.foundationAttempts+=answered.length;row.foundationCorrect+=answered.filter(result=>result.status==='correct').length;row.foundationIndependent+=answered.filter(result=>result.independent).length;
        row.foundationStatus=answered.length===results.length&&answered.every(result=>result.independent)?'independent':answered.some(result=>result.status==='incorrect'||result.status==='format')?'needs-practice':answered.some(result=>result.status==='correct')?'supported':'unfinished';
      }
      for(const [id,results] of groups){
        const row=rows.get(id);row.sessions++;row.lastAt=event.at;
        const answered=results.filter(result=>['correct','incorrect','format'].includes(result.status));
        row.attempts+=answered.length;row.correct+=answered.filter(result=>result.status==='correct').length;row.independent+=answered.filter(result=>result.independent).length;
        const passed=answered.length>0&&answered.length===results.length&&answered.every(result=>result.independent);
        const fresh=passed&&answered.some(result=>!row.families.has(result.family));
        let advanced=false;
        if(fresh){if(!row.streak||Date.parse(event.at)-Date.parse(row.lastSuccessAt)>=DAY){row.streak++;row.lastSuccessAt=event.at;advanced=true;}answered.forEach(result=>row.families.add(result.family));row.lastStatus='independent';}
        else if(!passed){row.streak=0;row.lastStatus=answered.some(result=>result.status==='incorrect'||result.status==='format')?'needs-practice':answered.some(result=>result.status==='correct')?'supported':'unfinished';}
        else row.lastStatus='same-family';
        const interval=passed?INTERVALS[Math.min(Math.max(0,row.streak-1),INTERVALS.length-1)]:1;
        if(!passed||advanced||!row.dueAt)row.dueAt=new Date(Date.parse(event.at)+interval*DAY).toISOString();
      }
    }
    return [...rows.values()].map(({families,...row})=>{
      const foundationOnly=!row.lastAt&&!!row.foundationAt,dueAt=row.dueAt||(foundationOnly?new Date(Date.parse(row.foundationAt)+DAY).toISOString():''),due=!!dueAt&&Date.parse(dueAt)<=Date.parse(now);
      return {...row,dueAt,lastStatus:foundationOnly?'foundation':row.lastStatus,families:families.size,mastered:row.streak>=3&&families.size>=3,status:foundationOnly?row.foundationStatus==='needs-practice'?'practice':due?'due':'foundation':!row.lastAt?'new':row.lastStatus==='needs-practice'?'practice':due?'due':row.streak>=3&&families.size>=3?'established':'learning',due};
    }).sort((a,b)=>a.title.localeCompare(b.title,'ru'));
  }
  const rank=q=>({'Базовый':0,'Средний':1,'Повышенный':2,'Высокий':3,'Суперсложный':4}[q.difficulty]??2);
  function candidates(catalog,options={}){const g=grade(options.grade),l=level(options.level,g);return catalogArray(catalog).filter(q=>eligible(q,g,l)).sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id));}
  function matchesRepresentation(q,target,covered){
    if(q.source!=='methods'||q.category!=='representation')return false;
    const taskSkills=skills(q);
    return array(q.representationLinks).some(link=>link?.from&&link.to&&link.from!==link.to&&target.has(link.skill)&&!covered?.has(link.skill)&&taskSkills.includes(link.skill));
  }
  function select(pool,count,targetSkills,usedFamilies=new Set(),options={}){
    const selected=[],target=new Set(targetSkills),canonicals=new Set(),families=new Set(usedFamilies),covered=new Set(),usedIds=new Set(options.usedIds||[]);
    while(selected.length<count){
      const remaining=pool.filter(q=>!usedIds.has(q.id)&&!canonicals.has(canonical(q))&&!families.has(family(q))&&(!options.requireFamily||!!q.family));
      if(!remaining.length)break;
      const dueCoverage=q=>skills(q).filter(id=>target.has(id)&&!covered.has(id)).length;
      const coverage=q=>skills(q).reduce((sum,id)=>sum+(target.has(id)&&!covered.has(id)?100:!covered.has(id)?10:0),0)-rank(q)*2;
      remaining.sort((a,b)=>{
        if(options.preferRepresentation){
          const priority=dueCoverage(b)-dueCoverage(a)||Number(matchesRepresentation(b,target,covered))-Number(matchesRepresentation(a,target,covered));
          if(priority)return priority;
        }
        return coverage(b)-coverage(a)||a.id.localeCompare(b.id);
      });
      const q=remaining[0];selected.push(q);canonicals.add(canonical(q));families.add(family(q));usedIds.add(q.id);skills(q).forEach(id=>covered.add(id));
    }
    return selected;
  }
  function build(title,selected,targetSkills,count,kindValue,message=''){
    const covered=new Set(selected.flatMap(skills)),missing=targetSkills.filter(id=>!covered.has(id));
    return {work:{title,variant:'1',ids:selected.map(q=>q.id),answers:false},kind:kindValue,skillIds:targetSkills,missing,message:message||(!selected.length?'Подходящих новых заданий пока нет.':selected.length<count?`Подобрано ${selected.length} из ${count}: новых размеченных семейств не хватает.`:'')};
  }
  function createDiagnostic(catalog,state,options={}){
    const clean=sanitizeState(state,catalog,options),pool=candidates(catalog,options),count=Math.max(1,Math.min(12,Number.isInteger(options.count)?options.count:8)),target=[...new Set(pool.flatMap(skills))];
    const used=new Set(clean.events.flatMap(event=>event.results.map(result=>result.id)));
    const selected=select(pool,count,target,new Set(),{usedIds:used});
    return build('Входная диагностика · '+(grade(options.grade)||'')+' класс',selected,target.filter(id=>selected.some(q=>skills(q).includes(id))),count,'diagnostic','Короткая проверка отдельных навыков. Результат помогает выбрать практику и не является оценкой всей программы.');
  }
  function createSkillWork(catalog,state,options={}){
    const clean=sanitizeState(state,catalog,options),target=[...new Set(array(options.skillIds).filter(id=>typeof id==='string'))],pool=candidates(catalog,options).filter(q=>skills(q).some(id=>target.includes(id))),count=Math.max(1,Math.min(12,Number.isInteger(options.count)?options.count:3));
    const previous=clean.events.flatMap(event=>event.results),selected=select(pool,count,target,new Set(),{usedIds:previous.map(result=>result.id)});
    return build(target.length===1?'Практика · '+definition(target[0]).title:'Практика навыков',selected,target,count,'practice');
  }
  function createReview(catalog,state,options={}){
    const clean=sanitizeState(state,catalog,options),rows=profile(clean,catalog,options),target=rows.filter(row=>row.due&&row.lastStatus!=='needs-practice').sort((a,b)=>a.dueAt.localeCompare(b.dueAt)).map(row=>row.id),count=Math.max(1,Math.min(12,Number.isInteger(options.count)?options.count:5));
    const previous=clean.events.flatMap(event=>event.results),seen=new Set(previous.map(result=>result.family));
    const targetSet=new Set(target),pool=candidates(catalog,options).filter(q=>skills(q).some(id=>targetSet.has(id)));
    const selected=select(pool,count,target,seen,{requireFamily:true,preferRepresentation:true,usedIds:previous.map(result=>result.id)});
    const review=build('Повторение на новых семействах',selected,target,count,'review',!target.length?'На сегодня запланированного повторения нет.':!selected.length?'Для повторения нужны новые размеченные семейства. В текущем банке они закончились; можно выбрать другой навык или мини-урок.':'');
    return {...review,representationCount:selected.filter(q=>matchesRepresentation(q,targetSet)).length};
  }
  function recommendations(state,catalog,options={}){
    const rows=profile(state,catalog,options),out=[],limit=Number.isInteger(options.limit)?Math.max(1,Math.min(8,options.limit)):3;
    const failed=rows.filter(row=>row.status==='practice'||row.lastStatus==='supported'||row.lastStatus==='unfinished').sort((a,b)=>b.lastAt.localeCompare(a.lastAt));
    for(const row of failed){
      const prerequisite=row.prerequisites.map(id=>rows.find(item=>item.id===id)).find(item=>item&&item.status==='practice');
      const chosen=prerequisite||row;if(out.some(item=>item.skillId===chosen.id))continue;
      const lesson=typeof MathLearningContent==='undefined'?null:MathLearningContent.lessonsFor(options.grade).find(item=>item.skills.includes(chosen.id));
      const work=createSkillWork(catalog,state,{...options,skillIds:[chosen.id],count:3});
      if(!work.work.ids.length&&!lesson)continue;
      out.push({type:'practice',skillId:chosen.id,title:chosen.title,reason:prerequisite?`Этот предварительный навык понадобится для «${row.title}».`:row.lastStatus==='foundation'?'В базовой практике были ошибки. Разберите объяснение и проверьте применение навыка в выбранном классе.':row.lastStatus==='supported'?'Предыдущее решение было с помощью; проверьте навык на новой задаче.':'В последнем занятии здесь были ошибки или пропуски.',lessonId:lesson?.id||null,available:work.work.ids.length});
    }
    for(const row of rows.filter(item=>item.foundationAt&&(!item.lastAt||item.foundationAt>item.lastAt))){
      if(out.some(item=>item.skillId===row.id))continue;
      const work=createSkillWork(catalog,state,{...options,skillIds:[row.id],count:3});if(!work.work.ids.length)continue;
      out.push({type:'practice',skillId:row.id,title:row.title,reason:`Базовая практика из младшего класса пройдена. Теперь примените навык на заданиях ${grade(options.grade)} класса.`,lessonId:null,available:work.work.ids.length});
    }
    const review=createReview(catalog,state,options);if(review.work.ids.length)out.push({type:'review',title:'Повторить ранее изученное',reason:'Подошло время проверить сохранение навыка на новых размеченных семействах.',available:review.work.ids.length});
    for(const row of rows.filter(item=>item.status==='new')){
      if(out.length>=limit)break;
      const unmet=row.prerequisites.map(id=>rows.find(item=>item.id===id)).filter(item=>item&&item.status!=='established');
      if(unmet.length)continue;
      out.push({type:'practice',skillId:row.id,title:row.title,reason:'По этому навыку ещё нет результатов. Начните с короткой проверки.',available:createSkillWork(catalog,state,{...options,skillIds:[row.id],count:3}).work.ids.length});
    }
    return out.slice(0,limit);
  }
  function render(state,catalog,options={}){
    const g=grade(options.grade),l=level(options.level,g),rows=profile(state,catalog,{...options,grade:g,level:l}),recs=recommendations(state,catalog,{...options,grade:g,level:l}),clean=sanitizeState(state,catalog,options),review=createReview(catalog,state,{...options,grade:g,level:l}),eligibleIds=new Set(candidates(catalog,{grade:g,level:l}).map(q=>q.id));
    const hasHistory=clean.events.some(event=>event.grade===g&&(g<10||event.level===l)||event.results.some(result=>eligibleIds.has(result.id)));
    const lessons=typeof MathLearningContent==='undefined'?[]:MathLearningContent.lessonsFor(g),projects=typeof MathLearningContent==='undefined'?[]:MathLearningContent.projectsFor(g);
    const action=(name,label,attrs='',disabled=false)=>`<button type="button" class="secondary" data-action="${name}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;
    const when=at=>new Date(at).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'});
    const reviewNotice=review.representationCount?'В сегодняшней подборке есть задания на переход между представлениями.':review.work.ids.length?'':review.message;
    return `<div class="learning-path"><section class="glass learning-start"><div><span class="badge">${g?g+' класс':''}${g>=10?' · '+(l==='advanced'?'углублённая':'базовая')+' программа':''}</span><h2>Следующий шаг в математике</h2><p>Диагностика помогает выбрать тему. Повторение возвращает изученные навыки через 1, 3, 7, 14 и 30 дней самостоятельного решения на новых семействах. Когда есть подходящие задания, навык проверяется в другом представлении.</p></div><div class="learning-actions">${action('learning-diagnostic',hasHistory?'Новая короткая диагностика':'Начать диагностику')}${action('learning-review',`Повторить сегодня (${review.work.ids.length})`,'',!review.work.ids.length)}</div>${reviewNotice?`<p class="muted">${esc(reviewNotice)}</p>`:''}</section><section aria-labelledby="learning-next-title"><h2 id="learning-next-title">Что делать дальше</h2><div class="learning-card-grid">${recs.length?recs.map(item=>`<article class="glass learning-recommendation"><h3>${esc(item.title)}</h3><p>${esc(item.reason)}</p><div class="learning-actions">${item.type==='review'?action('learning-review','Начать повторение →'):action('learning-skill','Проверить на новых задачах →',`data-skill="${esc(item.skillId)}"`,!item.available)}${item.lessonId?action('learning-lesson','Открыть объяснение',`data-lesson="${esc(item.lessonId)}"`):''}</div></article>`).join(''):'<p class="muted">Начните с диагностики или выберите объяснение ниже.</p>'}</div></section><details class="glass learning-progress"><summary>Моя карта навыков · ${rows.filter(row=>row.lastAt||row.foundationAt).length} проверено</summary><p class="muted">Устойчивый навык — минимум три самостоятельные проверки в разных семействах с интервалом не менее суток. Это ориентир для практики, а не школьная оценка. Смена ученика начинает новый маршрут.</p><ul>${rows.map(row=>`<li><span>${esc(row.title)}</span><small>${esc(({new:'Ещё не проверен',practice:'Нужна практика',due:'Пора повторить',established:'Есть устойчивые результаты',learning:'Продолжаем закреплять',foundation:'База повторена; проверим материал выбранного класса'})[row.status])}${row.foundationAt?' · базовая практика: '+row.foundationCorrect+' из '+row.foundationAttempts+' верно':''}${row.dueAt&&!row.due?' · повтор '+when(row.dueAt):''}</small></li>`).join('')}</ul></details><section aria-labelledby="learning-lessons-title"><h2 id="learning-lessons-title">Мастерская понимания</h2><p class="muted">Объяснения доступны с указанного класса; в старших классах их можно использовать для повторения базы.</p><div class="learning-card-grid">${lessons.map(lesson=>`<article class="glass learning-content-card"><span class="badge">${lesson.minutes} минут · с ${lesson.minGrade} класса</span><h3>${esc(lesson.title)}</h3><p>${esc(lesson.idea)}</p>${action('learning-lesson','Разобраться →',`data-lesson="${esc(lesson.id)}"`)}</article>`).join('')}</div></section><section aria-labelledby="learning-projects-title"><h2 id="learning-projects-title">Математика в решениях</h2><div class="learning-card-grid">${projects.map(project=>`<article class="glass learning-content-card"><span class="badge">Мини-проект · ${project.minutes} минут</span><h3>${esc(project.title)}</h3><p>${esc(project.description)}</p>${action('learning-project','Исследовать →',`data-project="${esc(project.id)}"`)}</article>`).join('')||'<p class="muted">Мини-проекты доступны с 6 класса. Сейчас можно начать с диагностики.</p>'}</div></section></div>`;
  }
  return Object.freeze({VERSION,emptyState,sanitizeState,recordActivity,recordSession,markLessonRead,profile,recommendations,createDiagnostic,createReview,createSkillWork,render,familyKey:family});
})();
