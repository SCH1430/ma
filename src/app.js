// One local bank serves both the trainer and the print constructor.
const WORK_LIMIT=60;
function parseAnswer(raw) {
  const value=String(raw).trim().replace(/−/g,'-').replace(/,/g,'.').replace(/\s+/g,'').replace(/sqrt/gi,'√').replace(/pi/gi,'π');
  const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  function atom(s){
    if(new RegExp(`^${number}$`).test(s))return Number(s);
    const pi=s.match(/^([+-]?)(?:(\d+(?:\.\d*)?|\.\d+)\*?)?π$/);
    if(pi)return (pi[1]==='-'?-1:1)*Number(pi[2]??1)*Math.PI;
    const m=s.match(new RegExp(`^([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)?)(?:\\*)?√(?:\\((${number})\\)|(${number}))$`));
    if(!m)return null;
    const rad=Number(m[2]??m[3]);if(rad<0)return null;
    const c=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:Number(m[1]);
    return c*Math.sqrt(rad);
  }
  const parts=value.split('/');if(parts.length>2)return null;
  if(parts[1]?.includes('π')&&parts[1].includes('*'))return null;
  const n=atom(parts[0]),d=parts.length===2?atom(parts[1]):1;
  if(n===null||d===null||d===0)return null;
  const result=n/d;return Number.isFinite(result)?result:null;
}
function answerMatches(raw,expected) {
  const value=parseAnswer(raw);
  return value!==null && Math.abs(value-expected)<=Math.min(1e-7,1e-8*Math.max(1,Math.abs(expected)));
}
function checkAnswer(raw,q){
  if(q.kind==='open')return {valid:false,correct:false};
  if(q.kind==='set'){
    const empty=String(raw).trim().toLowerCase().replace(/\s+/g,'');
    if(['∅','{}','нет','нетрешений','неткорней','нетдействительныхкорней'].includes(empty))return {valid:true,correct:q.answer.length===0};
    const parts=String(raw).split(';').map(parseAnswer);
    if(parts.some(v=>v===null)||!parts.length)return {valid:false,correct:false};
    const values=[...new Set(parts)].sort((a,b)=>a-b),expected=[...q.answer].sort((a,b)=>a-b);
    return {valid:true,correct:values.length===expected.length&&values.every((v,i)=>Math.abs(v-expected[i])<=Math.min(1e-7,1e-8*Math.max(1,Math.abs(expected[i]))))};
  }
  return {valid:parseAnswer(raw)!==null,correct:answerMatches(raw,q.answer)};
}
function answerHint(q){
  if(q.kind==='open')return 'Запишите рассуждение или выполните построение в тетради. Затем сравните с образцом и отметьте выполненные критерии.';
  if(q.angleUnit==='radian')return q.kind==='set'?'Углы в радианах. Все корни через точку с запятой, например: π/6; 5π/6. Можно писать pi вместо π. Если корней нет, введите ∅.':'Ответ в радианах без единиц: π/6, 2π/3, −π. Можно писать pi вместо π, например 2*pi/3.';
  if(q.kind==='set')return 'Все корни через точку с запятой: −2; 1/2. Порядок не важен. Если корней нет, введите ∅ или «нет решений». Не разделяйте корни запятой.';
  if(q.precision)return `Число без единиц. Округлите до ${q.precision===3?'тысячных':q.precision+' знаков'}; точка и запятая допустимы.`;
  return 'Число без единиц: −3, 0,75, 3/4. Корень: √2, 5√2/2 или sqrt(2). Число π: π/6 или pi/6. Для точного ответа используйте дробь, π или корень.';
}

// These boundaries also validate locally saved and imported data.
function sanitizeWork(raw,tasks,grade,level){
  raw=raw&&typeof raw==='object'?raw:{};
  const allowed=new Set(tasks.filter(q=>grade==null||q.grade===grade&&q.level===level).map(q=>q.id));
  const text=(v,n,fallback)=>typeof v==='string'&&v.trim()?v.trim().slice(0,n):fallback;
  return {ids:[...new Set(Array.isArray(raw.ids)?raw.ids:[])].filter(id=>allowed.has(id)).slice(0,grade==null?WORK_LIMIT:24),title:text(raw.title,70,'Самостоятельная работа'),variant:text(raw.variant,20,'1'),answers:raw.answers===true,...(typeof raw.seed==='string'?{seed:text(raw.seed,40,'1430')}:{})};
}
function sanitizeRecord(raw,q){
  raw=raw&&typeof raw==='object'?raw:{};
  const count=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
  const correct=raw.correct===true&&(!q||q.kind==='open'||q.angleUnit!=='radian'||checkAnswer(raw.draft??'',q).correct);
  return {draft:typeof raw.draft==='string'?raw.draft.slice(0,4000):'',tries:count(raw.tries,10000),correct,revealed:raw.revealed===true,hintLevel:count(raw.hintLevel,2),feedback:raw.correct===true&&!correct?'':['','format','wrong','correct','self'].includes(raw.feedback)?raw.feedback:'',everWrong:raw.everWrong===true,outcome:correct&&['independent','hinted','explained'].includes(raw.outcome)?raw.outcome:'',checks:Array.isArray(raw.checks)?raw.checks.slice(0,10).map(v=>v===true):[]};
}
function classifyAttempt(r){
  if(!r||!r.correct)return 'pending';
  if(['independent','hinted','explained'].includes(r.outcome))return r.outcome;
  return r.revealed?'explained':r.hintLevel>0?'hinted':'independent';
}
function generateVariant(ids,allTasks,seed,excludedIds=[]){
  const byId=new Map(allTasks.map(q=>[q.id,q])),original=[...new Set(ids)].filter(id=>byId.has(id)).slice(0,WORK_LIMIT);
  const avoid=new Set([...original,...excludedIds]),used=new Set();let state=2166136261;
  for(const c of String(seed)){state^=c.charCodeAt(0);state=Math.imul(state,16777619)>>>0;}
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return original.map(id=>{
    const q=byId.get(id);if(q.source==='exam'||q.examId){used.add(id);return id;}const signature=Array.isArray(q.competencies)?[...q.competencies].sort().join('|'):null;const pool=allTasks.filter(p=>p.grade===q.grade&&p.level===q.level&&p.topicId===q.topicId&&p.difficulty===q.difficulty&&p.kind===q.kind&&(signature===null||[...(p.competencies||[])].sort().join('|')===signature)&&!avoid.has(p.id)&&!used.has(p.id));
    const next=pool.length?pool[Math.floor(random()*pool.length)].id:id;used.add(next);return next;
  });
}
function safeRoute(raw,bank,examBank=typeof EXAM_BANK!=='undefined'?EXAM_BANK:[]){
  raw=raw&&typeof raw==='object'?raw:{};
  const home={view:'home',role:null,grade:null,level:null,topic:null,index:0,difficulty:'all',taskIds:null,examId:null,example:0};
  if(!['student','teacher'].includes(raw.role))return home;
  const out={...home,role:raw.role,view:['home','classes','levels','profile','topics','train','result','builder','print','help','exam-levels','exam'].includes(raw.view)?raw.view:'classes'};
  if(out.view==='home'||out.view==='classes'||out.view==='help')return out;
  if(out.view==='builder'||out.view==='print')return out.role==='teacher'?out:{...out,view:'classes'};
  if(out.view==='exam-levels')return out;
  if(out.view==='exam'){
    const exam=Array.isArray(examBank)?examBank.find(e=>e&&['oge','ege-basic','ege-profile'].includes(e.id)&&e.id===raw.examId&&e.year===2026&&Array.isArray(e.tasks)&&e.tasks.length):null;
    if(!exam)return {...out,view:'classes'};
    out.examId=exam.id;
    const index=raw.number!==undefined?exam.tasks.findIndex(q=>q.number===Number(raw.number)):raw.index;
    out.index=Number.isFinite(index)?Math.max(0,Math.min(exam.tasks.length-1,Math.floor(index))):0;
    const examples=exam.tasks[out.index].examples;
    out.example=Array.isArray(examples)&&examples.length&&Number.isFinite(raw.example)?Math.max(0,Math.min(examples.length-1,Math.floor(raw.example))):0;
    return out;
  }
  const grade=Number(raw.grade);if(!Number.isInteger(grade)||grade<5||grade>11)return {...out,view:'classes'};
  out.grade=grade;out.level=grade<=9?'basic':['basic','advanced'].includes(raw.level)?raw.level:null;
  if(!out.level)return {...out,view:'levels'};
  if(out.view==='levels')return out;
  if(out.role!=='teacher'&&['builder','print'].includes(out.view))out.view='topics';
  const t=bank.find(t=>t.id===raw.topic&&t.grade===grade&&t.level===out.level);
  if(t){
    out.topic=t.id;
    out.difficulty=['Базовый','Средний','Повышенный','Суперсложный'].includes(raw.difficulty)?raw.difficulty:'all';
    let ts=t.tasks.filter(q=>out.difficulty==='all'||q.difficulty===out.difficulty);
    if(!ts.length){out.difficulty='all';ts=t.tasks;}
    if(Array.isArray(raw.taskIds)){
      const ids=new Set(ts.map(q=>q.id));out.taskIds=[...new Set(raw.taskIds)].filter(id=>ids.has(id)).slice(0,100);
      if(out.taskIds.length)ts=out.taskIds.map(id=>t.tasks.find(q=>q.id===id));else out.taskIds=null;
    }
    out.index=Number.isFinite(raw.index)?Math.max(0,Math.min(ts.length-1,Math.floor(raw.index))):0;
  }else if(['train','result'].includes(out.view))out.view='topics';
  return out;
}
/* UI */
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
  const topicCount=n=>`${n} ${plural(n,'тема','темы','тем')}`;
  const taskCount=n=>`${n} ${plural(n,'задание','задания','заданий')}`;
  const examDuration=value=>typeof value==='number'?`${value} мин`:value;
  const levels=['Базовый','Средний','Повышенный','Суперсложный'];
  const examLevels=['Базовый','Повышенный','Высокий'];
  const levelDescriptions=['Одно правило или формула','Несколько последовательных действий','Выбор метода, преобразования и ограничения','Нестандартная идея и сочетание приёмов'];
  const allTasks=BANK.flatMap(t=>t.tasks.map(q=>({...q,source:'class',sourceLabel:`${t.grade} класс${t.grade>=10?' · '+(t.level==='advanced'?'углублённый':'базовый'):''}`,topic:t.title,topicId:t.id,grade:t.grade,level:t.level,subject:t.subject}))).map(q=>({...q,competencies:MathCompetencies.forTask(q)}));
  const taskById=new Map(allTasks.map(q=>[q.id,q]));
  const exams=typeof EXAM_BANK!=='undefined'?EXAM_BANK:[];
  const examExamples=q=>Array.isArray(q.examples)&&q.examples.length?q.examples:[q];
  const examTaskById=new Map(exams.flatMap(e=>e.tasks.flatMap(examExamples).map(q=>[q.id,q])));
  const examWorkTasks=exams.flatMap(exam=>exam.tasks.flatMap(parent=>examExamples(parent).map((q,i)=>({...q,source:'exam',examId:exam.id,sourceLabel:exam.title+' · демоверсия 2026',year:exam.year,sourceUrl:exam.sourceUrl,number:parent.number,exampleNumber:examExamples(parent).length>1?i+1:null,images:q.images||[],contextImages:q.contextImages?.length?q.contextImages:parent.contextImages||[],solutionPages:q.solutionPages?.length?q.solutionPages:parent.solutionPages?.length?parent.solutionPages:exam.solutionPages||[],answerPages:exam.answerPages||[],answerText:q.answerText||'',display:q.answerText||'',kind:q.answerKind||'open',prompt:q.text||'',solution:'',rubric:[]})))).map(q=>({...q,difficulty:MathExamDifficulty.forTask(q),competencies:MathCompetencies.forTask(q)}));
  const catalogTasks=[...allTasks,...examWorkTasks],catalogById=new Map(catalogTasks.map(q=>[q.id,q]));
  const attempts=new Map(),works=new Map(),favorites=new Set(),migratedWorkKeys=new Set();
  const STORAGE_KEY='mat1430.workspace.v2',PAGE_SIZE=24;
  let student={id:'',first:'',last:'',letter:'',grade:null},examLearnerId='',library=[],resumeRoute=null,examReferencesOpen=false;
  let route=safeRoute(null,BANK),filter='all',subjectFilter='all',difficultyFilter='all',trickyOnly=false,presetLevel='',presetCount=3;
  let competencyFilter=[];
  let autoCount=10,autoResult=null;
  const builderSections=new Set();
  let sourceFilter='all',search='',topicSearch='',favoriteOnly=false,bankPage=0,presetSeed=0,workOpen=false,toastTimer,saveTimer,storageOK=true,lastSaved='',lastSignature='';
  const freshId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const question=id=>catalogById.get(id);
  const currentExam=()=>exams.find(e=>e.id===route.examId);
  const currentExamTask=()=>{const task=currentExam()?.tasks[route.index];return task?examExamples(task)[route.example]:null;};
  const programLabel=()=>route.level==='advanced'?'Углублённый':'Базовый';
  const roleLabel=()=>route.role==='teacher'?'Учитель':'Ученик';
  const outcomeNames={independent:'Самостоятельно',hinted:'С подсказкой',explained:'После разбора',pending:'Ещё не решено'};
  const topics=()=>BANK.filter(t=>t.grade===route.grade&&t.level===route.level);
  function currentTopic(){
    const t=BANK.find(t=>t.id===route.topic);
    if(!t)return null;
    let tasks=t.tasks.filter(q=>route.difficulty==='all'||q.difficulty===route.difficulty);
    if(route.taskIds)tasks=route.taskIds.map(id=>tasks.find(q=>q.id===id)).filter(Boolean);
    return {...t,tasks};
  }
  const work=()=>{
    const key='unified';
    if(!works.has(key))works.set(key,sanitizeWork(null,catalogTasks));
    return works.get(key);
  };
  const recordKey=id=>examTaskById.has(id)?route.role==='teacher'?`exam-teacher:${id}`:student.id?`exam-student:${student.id}:${id}`:`exam-guest:${examLearnerId}:${id}`:route.role==='student'?`student:${student.id}:${id}`:`teacher:${id}`;
  const record=id=>{const key=recordKey(id);if(!attempts.has(key))attempts.set(key,sanitizeRecord(null));return attempts.get(key);};
  function clearStudent(){
    for(const key of attempts.keys())if(/^(student|exam-student|exam-guest):/.test(key))attempts.delete(key);
    student={id:'',first:'',last:'',letter:'',grade:null};examLearnerId='';resumeRoute=null;
  }
  function restore(){
    try{
      const text=localStorage.getItem(STORAGE_KEY);if(!text)return;
      if(text.length>4000000)throw new Error('oversized');
      const saved=JSON.parse(text);if(saved.version!==2)return;
      competencyFilter=MathCompetencies.normalize(saved.builderCompetencies);
      if(Number.isInteger(saved.builderAuto?.count)&&saved.builderAuto.count>=1&&saved.builderAuto.count<=WORK_LIMIT)autoCount=saved.builderAuto.count;
      if(typeof saved.examLearnerId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(saved.examLearnerId))examLearnerId=saved.examLearnerId;
      const s=saved.student;
      if(s&&typeof s.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(s.id)&&typeof s.first==='string'&&s.first.trim()&&typeof s.last==='string'&&s.last.trim()&&typeof s.letter==='string'&&/^[А-ЯЁA-Z]$/i.test(s.letter)){
        student={id:s.id,first:s.first.slice(0,40),last:s.last.slice(0,60),letter:s.letter.toUpperCase(),grade:Number(s.grade)};
      }
      for(const pair of Array.isArray(saved.attempts)?saved.attempts.slice(0,catalogTasks.length*2):[]){
        if(!Array.isArray(pair)||typeof pair[0]!=='string')continue;
        const [key,value]=pair,id=key.split(':').at(-1);
        if(question(id)&&(key===`teacher:${id}`||student.id&&key===`student:${student.id}:${id}`)||examTaskById.has(id)&&(key===`exam-teacher:${id}`||student.id&&key===`exam-student:${student.id}:${id}`||examLearnerId&&key===`exam-guest:${examLearnerId}:${id}`))attempts.set(key,sanitizeRecord(value,question(id)));
      }
      for(const key of Array.isArray(saved.migratedWorkKeys)?saved.migratedWorkKeys:[])if(typeof key==='string')migratedWorkKeys.add(key);
      for(const pair of Array.isArray(saved.works)?saved.works.slice(0,20):[]){
        if(!Array.isArray(pair)||typeof pair[0]!=='string')continue;
        if(pair[0]==='unified'){works.set('unified',sanitizeWork(pair[1],catalogTasks));continue;}
        const [g,l]=pair[0].split(':');if(BANK.some(t=>t.grade===Number(g)&&t.level===l))works.set(pair[0],sanitizeWork(pair[1],allTasks,Number(g),l));
      }
      library=(Array.isArray(saved.library)?saved.library:[]).slice(0,200).filter(x=>x&&typeof x.id==='string'&&(x.grade==null||BANK.some(t=>t.grade===x.grade&&t.level===x.level))).map(x=>({...sanitizeWork(x,x.grade==null?catalogTasks:allTasks,x.grade,x.level),id:x.id.slice(0,80),grade:x.grade??null,level:x.level??null,created:typeof x.created==='string'?x.created.slice(0,30):''}));
      for(const [key,value] of works){
        if(key==='unified'||!value.ids.length||migratedWorkKeys.has(key))continue;
        if(!library.some(x=>x.id==='migration:'+key||x.title===value.title&&x.variant===value.variant&&JSON.stringify(x.ids)===JSON.stringify(value.ids))){const [g,l]=key.split(':');library.push({...value,id:'migration:'+key,grade:Number(g),level:l,created:''});}
        migratedWorkKeys.add(key);
      }
      if(!works.has('unified')){const legacy=[...works.values()].find(x=>x.ids.length);works.set('unified',sanitizeWork(legacy,catalogTasks));}
      for(const id of Array.isArray(saved.favorites)?saved.favorites:[])if(question(id))favorites.add(id);
      const resumed=safeRoute(saved.resumeRoute,BANK);
      if(resumed.view!=='home'&&(resumed.role!=='student'||student.id||examLearnerId&&['exam','exam-levels','classes'].includes(resumed.view)))resumeRoute=resumed;
      lastSaved=typeof saved.savedAt==='string'?saved.savedAt:'';
    }catch(error){storageOK=false;}
  }
  function persist(){
    clearTimeout(saveTimer);
    if(route.view!=='home'&&route.view!=='help')resumeRoute=safeRoute(route,BANK);
    const relevant=[...attempts].filter(([,r])=>r.draft||r.tries||r.hintLevel||r.revealed||r.correct||r.checks.some(Boolean));
    const data={version:2,student,examLearnerId,attempts:relevant,works:[...works],migratedWorkKeys:[...migratedWorkKeys],library,favorites:[...favorites],builderCompetencies:competencyFilter,builderAuto:{count:validAutoCount()?Number(autoCount):10},resumeRoute,savedAt:lastSaved};
    const text=JSON.stringify(data);
    try{
      if(text!==lastSignature){lastSaved=new Date().toISOString();data.savedAt=lastSaved;const next=JSON.stringify(data);localStorage.setItem(STORAGE_KEY,next);lastSignature=next;}
      storageOK=true;
    }catch(error){storageOK=false;}
    const status=$('save-state');if(status)status.textContent=storageText();
  }
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,250);}
  const storageText=()=>storageOK?'Сохраняется на этом устройстве':route.role==='teacher'?'Автосохранение недоступно. Сохраните работу в файл.':'Автосохранение недоступно. Прогресс остаётся только в открытой вкладке.';
  const action=(key,label,cls='secondary',attrs='')=>`<button type="button" class="${cls}" data-action="${key}" ${attrs}>${label}</button>`;
  const subjectSymbols={
    'Числа и вычисления':'<path d="M4 7h8M8 3v8M15 6h5M4 17h7M15 15h5m-5 4h5"/>',
    'Текстовые задачи':'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15M6 8h3m6 0h3M6 12h3m6 0h3"/>',
    'Геометрия':'<path d="M4 20 10 4l10 16H4Zm2-5h4v5"/>',
    'Алгебра':'<path d="m4 7 7 10m0-10L4 17m11-8h6m-6 6h6"/>',
    'Вероятность и статистика':'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>'
  };
  function subjectIcon(s){return `<span class="subject-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${subjectSymbols[s]||subjectSymbols[s.includes('геометрия')?'Геометрия':'Алгебра']}</svg></span>`;}
  function difficultyBadge(d){const i=d==='Высокий'?3:levels.indexOf(d);return `<span class="difficulty-badge difficulty--${['basic','medium','advanced','challenge'][i]}"><span class="difficulty-bars" aria-hidden="true">${levels.map((_,j)=>`<i${j<=i?' class="filled"':''}></i>`).join('')}</span>${esc(d)}</span>`;}
  const difficultyTags=q=>`<div class="difficulty">${difficultyBadge(q.difficulty)}${q.tricky?'<span class="tricky-badge">✦ Хитрая задача</span>':''}${q.kind==='open'?'<span class="badge">Рассуждение · самопроверка</span>':''}</div>`;
  const note=()=>`<div class="bottom-note"><span>Банк по классам: авторские задания по темам ФРП · школа 1430</span>${action('help','О программе и заданиях','text-button')}</div>`;
  function header(title,subtitle){const examSession=route.role==='student'&&['exam','exam-levels'].includes(route.view);return `<div class="screen-head"><div class="trail">${action('back','← Назад','text-button')}<span>${roleLabel()}${route.grade?` · ${route.grade} класс`:''}</span>${route.grade>=10&&route.level?`<span class="badge">${programLabel()} курс</span>`:''}</div><h1 tabindex="-1" id="screen-title">${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="session-bar"><span id="save-state" role="status">${storageText()}${examSession?` · ${student.id?esc(student.first)+' '+esc(student.last):'Гостевое занятие'}`:''}</span>${route.role==='student'&&(student.id||examSession)?`${action('end-session','Завершить занятие / сменить ученика','text-button')}`:action('home','К выбору роли','text-button')}</div>`;}
  function notify(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('notice').hidden=true;},3500);}
  function go(view,data={}){closeWork(false);examReferencesOpen=false;route=safeRoute({...route,...data,view},BANK);history.pushState({mat1430:true,route},'',`#${route.view}`);render(true);}
  function back(){closeWork(false);history.back();}
  function updateHome(){
    let panel=$('resume-panel');
    if(!panel){panel=document.createElement('div');panel.id='resume-panel';$('welcome').append(panel);}
    const examTitle=resumeRoute?.view==='exam'?exams.find(e=>e.id===resumeRoute.examId)?.title:resumeRoute?.view==='exam-levels'?'ЕГЭ · демоверсия 2026':'';
    panel.innerHTML=resumeRoute?`<div class="continue-card"><h2>Продолжим?</h2><p>${resumeRoute.role==='student'?student.id?`${esc(student.first)}${examTitle?'':` · ${resumeRoute.grade||student.grade} класс`}`:'Гостевое занятие':'Рабочее место учителя'}${examTitle?` · ${esc(examTitle)}${resumeRoute.view==='exam'?` · № ${exams.find(e=>e.id===resumeRoute.examId).tasks[resumeRoute.index].number}`:''}`:''} · данные сохранены на устройстве</p>${action('resume','Продолжить →','primary')}</div>`:'';
  }
  function render(focus=false){
    const workScroll={panel:$('work-panel')?.scrollTop||0,paper:$('work-paper-body')?.scrollTop||0};
    const active=document.activeElement;
    const previousFocus=active?{id:active.id,action:active.dataset?.action,taskId:active.dataset?.id,rubric:active.dataset?.rubric}:{};
    route=safeRoute(route,BANK);
    if(route.role==='student'&&!student.id&&!examLearnerId&&['exam','exam-levels'].includes(route.view))examLearnerId=freshId();
    if(route.role==='student'&&!student.id&&['topics','train','result'].includes(route.view))route={...route,view:'profile'};
    if(route.view==='print'&&!work().ids.length)route={...route,view:'builder'};
    $('welcome').hidden=route.view!=='home';$('app').hidden=route.view==='home';
    document.body.classList.toggle('app-mode',route.view!=='home');
    document.body.classList.toggle('work-open',workOpen&&window.matchMedia('(max-width:650px)').matches);
    document.title=route.view==='home'?'1430 — пространство математики':`1430 — ${route.view==='exam'?currentExam().title:route.view==='exam-levels'?'ЕГЭ · 2026':roleLabel()}${route.grade?` · ${route.grade} класс`:''}`;
    document.querySelector('.skip-link').textContent=route.view==='home'?'Перейти к выбору роли':'Перейти к содержимому';
    if(route.view==='home'){
      $('app').innerHTML='';updateHome();
      if(focus){document.querySelector('[data-role="student"]').focus({preventScroll:true});window.scrollTo(0,0);}
      persist();return;
    }
    const pages={classes:renderClasses,levels:renderLevels,profile:renderProfile,topics:renderTopics,train:renderTrainer,result:renderResult,builder:renderBuilder,print:renderPrint,help:renderHelp,'exam-levels':renderExamLevels,exam:renderExam};
    $('app').innerHTML=pages[route.view]();
    if(route.view==='builder'){
      syncWorkAccessibility();
      $('work-panel').scrollTop=workScroll.panel;
      $('work-paper-body').scrollTop=workScroll.paper;
    }
    persist();
    if(workOpen&&window.matchMedia('(max-width:650px)').matches){
      const panel=$('work-panel');
      const target=previousFocus.id?$(previousFocus.id):[...panel.querySelectorAll('button,input,select')].find(e=>e.dataset.action===previousFocus.action&&e.dataset.id===previousFocus.taskId&&e.dataset.rubric===previousFocus.rubric);
      (target&&panel.contains(target)?target:panel).focus({preventScroll:true});
    }
    if(focus){window.scrollTo(0,0);$('screen-title')?.focus({preventScroll:true});}
  }
  function renderClasses(){return header('Что будем разбирать?',route.role==='teacher'?'Выберите класс для тренажёра и печатной работы или откройте официальную демоверсию экзамена.':'Выберите класс или экзамен. Прогресс сохранится на этом устройстве.')+`<section class="glass constructor-entry" aria-labelledby="constructor-heading"><div><span class="badge">Рабочее место учителя</span><h2 id="constructor-heading">Конструктор работы</h2><p>Соберите одну работу из заданий 5–11 классов, ОГЭ и ЕГЭ 2026. Сохраните подборку и скачайте PDF.</p></div>${action('builder-home',route.role==='teacher'?'Создать работу →':'Открыть конструктор учителя →','primary')}</section><div class="catalog-layout"><section class="class-section" aria-labelledby="classes-heading"><h2 class="catalog-heading" id="classes-heading">По классам</h2><div class="class-grid">${Array.from({length:7},(_,i)=>i+5).map(g=>`<button class="glass class-card" type="button" data-action="grade" data-grade="${g}"><strong>${g}<small>класс</small></strong><span>${g>=10?'Базовый и углублённый курсы':topicCount(BANK.filter(t=>t.grade===g).length)}</span></button>`).join('')}</div></section>${exams.length?`<section class="exam-section" aria-labelledby="exams-heading"><h2 class="catalog-heading" id="exams-heading">Экзамены <span class="badge">2026</span></h2><div class="exam-entry-grid"><button type="button" class="glass exam-entry-card" data-action="exam-start" data-exam="oge"><span class="exam-card-top">9 класс · ФИПИ</span><strong>ОГЭ</strong><span>Демоверсия 2026 · 25 заданий</span><span class="exam-card-link">Открыть задания →</span></button><button type="button" class="glass exam-entry-card" data-action="exam-levels"><span class="exam-card-top">11 класс · ФИПИ</span><strong>ЕГЭ</strong><span>Демоверсия 2026</span><span class="exam-card-link">Базовый и профильный →</span></button></div><p class="muted exam-catalog-note">Оригинальные задания из официальных демоверсий ФИПИ за 2026 год.</p></section>`:''}</div>`+note();}
  function renderExamLevels(){
    return header('ЕГЭ по математике.','Выберите уровень. Все задания — из официальной демоверсии ФИПИ за 2026 год.')+`<div class="level-grid">${exams.filter(e=>e.id.startsWith('ege-')).map(e=>`<button type="button" class="glass level-card exam-level-card" data-action="exam-start" data-exam="${esc(e.id)}"><span class="badge">Демоверсия 2026</span><h2>${e.id==='ege-basic'?'Базовый уровень':'Профильный уровень'}</h2><p>${taskCount(e.tasks.length)}${e.duration?` · ${esc(examDuration(e.duration))}`:''}</p><span>Открыть задания →</span></button>`).join('')}</div><p class="muted exam-catalog-note">В демоверсии могут быть несколько примеров одного номера. В тренажёре сохранены все примеры, разделённые в оригинале словом «ИЛИ».</p>`;
  }
  const examStatus=q=>{const r=record(q.id);return q.answerKind==='open'?r.feedback==='self'?'Сверено с критериями':r.draft?'Есть черновик':'Нужно полное решение':r.correct?r.revealed?'Верно после просмотра ответа':'Верно':r.tries?'Были попытки':'Ещё не решено';};
  const examComplete=q=>q.answerKind==='open'?record(q.id).feedback==='self':record(q.id).correct;
  function examImages(images,label,text='',lazy=false){
    return `<figure class="exam-original">${(images||[]).map((src,i)=>`<img class="exam-task-image" src="${esc(src)}" alt="${esc(label)}${images.length>1?`, фрагмент ${i+1}`:''}" ${lazy?'loading="lazy"':''} decoding="async">`).join('')}${text?`<figcaption class="sr-only">${esc(text)}</figcaption>`:''}</figure>`;
  }
  function renderExamReferences(exam,q){
    if(!examReferencesOpen)return '';
    const pages=[...(exam.answerPages||[]),...(q.solutionPages?.length?q.solutionPages:exam.solutionPages||[])];
    return `<section class="exam-references" id="exam-references" tabindex="-1" aria-labelledby="exam-references-heading"><h3 id="exam-references-heading">Официальные ответы и критерии</h3>${q.answerText?`<p><strong>Ответ к этому примеру:</strong> ${esc(q.answerText)}</p>`:''}<p class="muted">Оригинальные страницы демоверсии ФИПИ. Развёрнутое решение сверяйте с приведёнными критериями; отметка о сверке не является экзаменационным баллом.</p><div class="exam-reference-pages">${pages.map(p=>`<div class="exam-reference-page"><p class="exam-page-label">Страница ${p.page} оригинала</p>${examImages([p.image],`Ответы и критерии ФИПИ, страница ${p.page}`,p.text,true)}</div>`).join('')}</div></section>`;
  }
  function renderExam(){
    const exam=currentExam(),numberTask=exam.tasks[route.index],examples=examExamples(numberTask),q=currentExamTask(),r=record(q.id);
    const all=exam.tasks.flatMap(examExamples),short=all.filter(x=>x.answerKind!=='open'),open=all.filter(x=>x.answerKind==='open');
    const correct=short.filter(x=>record(x.id).correct).length,reviewed=open.filter(x=>record(x.id).feedback==='self').length;
    const hint=MathExam.answerHint(q),next=route.index<exam.tasks.length-1,contextImages=q.contextImages?.length?q.contextImages:numberTask.contextImages;
    const response=q.answerKind==='open'?`<label class="field" for="exam-draft">Ваше полное решение<textarea id="exam-draft" rows="6" maxlength="4000" aria-describedby="exam-answer-format" placeholder="Запишите ход решения и обоснование. Рисунок можно выполнить в тетради.">${esc(r.draft)}</textarea></label><p class="muted" id="exam-answer-format">${esc(hint)}</p>${r.feedback==='self'?'<p class="feedback" role="status">Решение отмечено как сверенное с критериями. Экзаменационный балл не выставляется.</p>':''}`:`<form id="exam-answer-form"><div class="answer-row"><label class="field" for="exam-answer">Ваш ответ<input id="exam-answer" name="answer" autocomplete="off" spellcheck="false" maxlength="80" value="${esc(r.draft)}" ${r.correct?'readonly':''} aria-describedby="exam-answer-format${r.feedback?' exam-feedback':''}"></label><button class="primary" type="submit" ${r.correct?'disabled':''}>${r.correct?'Проверено ✓':'Проверить'}</button></div><p class="muted" id="exam-answer-format">${esc(hint)}</p></form>${r.feedback?`<div id="exam-feedback" class="feedback ${r.correct?'':'wrong'}" role="status" tabindex="-1"><strong>${r.correct?'Ответ верный.':r.feedback==='format'?'Проверьте запись ответа.':'Ответ пока не сходится.'}</strong><p>${r.correct?'Ответ совпадает с официальным ключом ФИПИ.':r.feedback==='format'?esc(hint):'Проверьте вычисления и указания в условии. Можно сравнить ответ с официальным ключом.'}</p></div>`:''}`;
    return `<div class="exam-trainer">${header(exam.title,exam.subtitle||'Официальная демоверсия ФИПИ за 2026 год. Оригинальные условия, рисунки и ответы.')}<div class="exam-overview"><span class="badge">Демоверсия 2026${exam.duration?` · ${esc(examDuration(exam.duration))}`:''}</span><p class="muted">Краткие ответы: ${correct} из ${short.length} верно${open.length?` · Развёрнутые: ${reviewed} из ${open.length} сверено`:''}${all.length!==exam.tasks.length?` · ${all.length} примеров на ${exam.tasks.length} номеров`:''}</p></div><nav class="dots exam-numbers" aria-label="Номер задания демоверсии">${exam.tasks.map((task,i)=>{const variants=examExamples(task),done=variants.every(examComplete);return action('exam-task',String(task.number),`task-dot ${done?'done':''}`,`data-index="${i}" aria-label="Задание ${task.number}${variants.length>1?`, ${variants.length} примера`:''}, ${done?'выполнено':'в работе'}" ${route.index===i?'aria-current="step"':''}`);}).join('')}</nav><article class="glass task-card exam-task-card"><div class="task-meta"><span>Оригинал ФИПИ · ${exam.year}</span><span>Номер ${numberTask.number} из ${exam.tasks.length}</span></div><h2 class="exam-task-heading">Задание ${numberTask.number} <span class="badge">${q.answerKind==='open'?'Развёрнутое решение':q.answerKind==='sequence'?'Последовательность':'Краткий ответ'}</span></h2>${examples.length>1?`<div class="exam-examples" aria-label="Примеры задания ${numberTask.number}">${examples.map((item,i)=>action('exam-example',`Пример ${i+1}`,`secondary ${route.example===i?'is-current':''}`,`data-example="${i}" aria-pressed="${route.example===i}" aria-label="Пример ${i+1}: ${esc(examStatus(item))}"`)).join('')}</div><p class="muted">В оригинале эти примеры разделены словом «ИЛИ». Ответ и черновик сохраняются для каждого примера отдельно.</p>`:''}${contextImages?.length?`<details class="exam-context" open><summary>Общее условие к заданию</summary>${examImages(contextImages,'Общее условие к заданию '+numberTask.number)}</details>`:''}${examImages(q.images,'Оригинальное условие задания '+numberTask.number,q.text)}${response}<div class="exam-review-actions">${action('exam-references',examReferencesOpen?'Скрыть ответы и критерии':'Официальные ответы и критерии','secondary',`aria-expanded="${examReferencesOpen}" aria-controls="exam-references"`)}${q.answerKind==='open'&&examReferencesOpen?action('exam-reviewed',r.feedback==='self'?'Сверка отмечена ✓':'Я сверил(а) решение с критериями','secondary',r.draft.trim()&&r.feedback!=='self'?'':'disabled'):''}</div>${renderExamReferences(exam,q)}</article><div class="task-nav">${action('exam-prev','← Предыдущий номер','secondary',route.index?'':'disabled')}${next?action('exam-next','Следующий номер →','primary'):action('exam-catalog','К экзаменам →','secondary')}</div><aside class="exam-source glass"><div><strong>Источник: <a href="${esc(exam.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(exam.sourceTitle||'ФИПИ · демоверсия 2026')}</a></strong><p class="muted">Условия показаны фрагментами оригинального документа. Полная демоверсия с инструкциями и критериями доступна в PDF.</p></div>${action('exam-download','Скачать оригинал PDF ↓','secondary',`data-exam="${esc(exam.id)}"`)}</aside></div>`;
  }
  function renderLevels(){return header('Выберите программу.',`${route.grade} класс. Сложность заданий выбирается отдельно внутри темы.`)+`<div class="level-grid">${['basic','advanced'].map(level=>{const ts=BANK.filter(t=>t.grade===route.grade&&t.level===level);return `<button class="glass level-card" type="button" data-action="level" data-level="${level}"><h2>${level==='basic'?'Базовый':'Углублённый'}</h2><p>${topicCount(ts.length)} · ${taskCount(ts.reduce((s,t)=>s+t.tasks.length,0))}</p><span>Выбрать →</span></button>`;}).join('')}</div>`+note();}
  function renderProfile(){return header('Давайте познакомимся.',`${route.grade} класс. Как к вам обращаться?`)+`<form id="profile-form" class="glass profile"><div class="field-grid"><label class="field" for="first-name">Имя<input id="first-name" required maxlength="40" autocomplete="off" value="${esc(student.first)}" placeholder="Саша"></label><label class="field" for="last-name">Фамилия<input id="last-name" required maxlength="60" autocomplete="off" value="${esc(student.last)}" placeholder="Иванова"></label></div><label class="field letter-field" for="class-letter">Буква класса<input id="class-letter" required maxlength="1" pattern="[А-Яа-яЁёA-Za-z]" autocomplete="off" value="${esc(student.letter)}" placeholder="А" title="Одна буква класса"></label><p class="muted">Имя и прогресс сохраняются только в этом браузере. На общем компьютере после занятия нажмите «Сменить ученика» — новый ученик начнёт с чистого сеанса.</p><button class="primary" type="submit">Выбрать тему →</button></form>`;}
  const matches=(text,value)=>text.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(value.toLocaleLowerCase('ru').trim().replace(/ё/g,'е'));
  function renderTopics(){
    const ts=topics().filter(t=>matches(t.title+' '+t.subject,topicSearch));
    return header('Сегодня разбираемся.',route.role==='teacher'?'Откройте тренажёр или соберите работу.':`${student.first}, выберите тему занятия.`)+`<div class="toolbar"><label class="field search-field" for="topic-search">Поиск темы<input type="search" id="topic-search" value="${esc(topicSearch)}" placeholder="Например, дроби или симметрия"></label>${route.role==='teacher'?action('builder','Конструктор работы ↗','primary'):''}<span class="badge">${topicCount(ts.length)}</span></div>${ts.length?[...new Set(ts.map(t=>t.subject))].map(s=>`<section class="subject-section"><h2 class="subject-heading">${subjectIcon(s)}${esc(s)}</h2><div class="topic-grid">${ts.filter(t=>t.subject===s).map(t=>{const done=t.tasks.filter(q=>record(q.id).correct).length;return `<article class="glass topic-card"><h3>${esc(t.title)}</h3><p class="muted">${taskCount(t.tasks.length)} · ${done?'решено '+done:'с объяснениями'}</p><div class="topic-actions">${action('train',route.role==='teacher'?'Посмотреть тренажёр':'Начать →',route.role==='teacher'?'secondary':'primary',`data-topic="${t.id}"`)}${route.role==='teacher'?action('builder','В работу +','secondary',`data-topic="${t.id}"`):''}</div></article>`;}).join('')}</div></section>`).join(''):'<p class="empty">Темы не найдены. Попробуйте другое слово.</p>'}`+note();
  }
  function helpMarkup(q,r){
    if(r.correct)return '';
    const help=MathLearning.help(q);
    return `<div class="hint-actions">${r.hintLevel<2?action('hint',r.hintLevel?'Показать первый шаг':'Небольшая подсказка','secondary'):''}${action('reveal',r.revealed?'Разбор открыт':'Полный разбор','text-button',r.revealed?'disabled':'')}</div>${r.hintLevel?`<div class="hint-panel" role="status"><strong>Подсказка</strong><p>${mathHTML(help.hint)}</p>${r.hintLevel>=2?`<strong>Первый шаг</strong><p>${mathHTML(help.step)}</p>`:''}</div>`:''}`;
  }
  function renderOpen(q,r){
    const complete=q.rubric.every((_,i)=>r.checks[i]);
    return `<div class="open-response"><label class="field" for="open-draft">Ваше рассуждение<textarea id="open-draft" rows="6" maxlength="4000" ${r.correct?'readonly':''} placeholder="Запишите ход решения. Рисунок можно выполнить в тетради.">${esc(r.draft)}</textarea></label><p class="muted">${esc(answerHint(q))}</p>${helpMarkup(q,r)}${r.revealed||r.correct?`<div class="solution"><h3>Образец рассуждения</h3><p>${mathHTML(q.solution)}</p><h3>Критерии самопроверки</h3><div class="rubric-list">${q.rubric.map((x,i)=>`<label class="check"><input type="checkbox" data-rubric="${i}" ${r.checks[i]?'checked':''} ${r.correct?'disabled':''}>${esc(x)}</label>`).join('')}</div><p class="muted">Оцените каждый пункт по своему решению. Это самостоятельная проверка, а не автоматическая оценка доказательства.</p>${action('self-complete',r.correct?'Самопроверка завершена ✓':'Все критерии выполнены','primary',complete&&!r.correct?'':'disabled')}</div>`:''}${r.correct?'<div class="feedback" role="status">Работа отмечена после самопроверки по образцу.</div>':''}</div>`;
  }
  function renderTrainer(){
    const t=currentTopic();if(!t?.tasks.length)return header('Нет заданий.','Вернитесь к темам и измените фильтр.');
    const q=t.tasks[route.index],r=record(q.id),done=t.tasks.filter(x=>record(x.id).correct).length;
    const numeric=`<form id="answer-form"><div class="answer-row"><label class="field" for="answer">Ваш ответ<input id="answer" name="answer" autocomplete="off" spellcheck="false" maxlength="60" value="${esc(r.draft)}" ${r.correct?'readonly':''} aria-describedby="answer-format${r.feedback?' feedback':''}"></label><button class="primary" type="submit" ${r.correct?'disabled':''}>${r.correct?'Проверено ✓':'Проверить'}</button></div><p class="muted" id="answer-format">${esc(answerHint(q))}</p></form>${r.feedback?`<div id="feedback" class="feedback ${r.correct?'':'wrong'}" role="status"><strong>${r.correct?'Верно. Продолжаем!':r.feedback==='format'?'Проверьте запись ответа.':'Пока не сходится.'}</strong><p>${r.correct?mathHTML(q.solution):r.feedback==='format'?esc(answerHint(q)):'Проверьте вычисления и условия задачи. Можно открыть подсказку или первый шаг.'}</p></div>`:''}${helpMarkup(q,r)}${r.revealed&&!r.correct?`<div class="solution"><strong>Ответ: ${mathHTML(q.display.replace(/\./g,','))}.</strong><p>${mathHTML(q.solution)}</p></div>`:''}`;
    return `<div class="trainer">`+header(t.title,route.role==='teacher'?'Просмотр учителя. Ученические результаты хранятся отдельно.':`${student.first}, решайте в своём темпе. Подсказки доступны на каждом шаге.`)+`${route.taskIds?'<p class="badge">Повтор выбранных заданий</p>':`<label class="field training-filter" for="training-difficulty">Сложность в этой теме<select id="training-difficulty"><option value="all">Все ступени</option>${levels.map(d=>`<option value="${d}" ${route.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></label>`}<div class="progress" role="progressbar" aria-label="Завершённые задания" aria-valuemin="0" aria-valuemax="${t.tasks.length}" aria-valuenow="${done}"><span style="width:${done/t.tasks.length*100}%"></span></div><article class="glass task-card"><div class="task-meta"><span class="subject-label">${subjectIcon(t.subject)}${esc(t.subject)} · ${route.grade} класс</span><span>Задание ${route.index+1} из ${t.tasks.length}</span></div>${difficultyTags(q)}<h2 class="task-prompt">${mathHTML(q.prompt)}</h2>${figureSVG(q.id)}${q.kind==='open'?renderOpen(q,r):numeric}${r.correct?`<p class="task-outcome">${q.kind==='open'?'Самопроверка по образцу':outcomeNames[classifyAttempt(r)]}</p>`:''}</article><div class="task-nav"><div class="dots" aria-label="Номер задания">${t.tasks.map((x,i)=>action('task',String(i+1),`task-dot ${record(x.id).correct?'done':''}`,`data-index="${i}" aria-label="Задание ${i+1}, ${x.kind==='open'&&record(x.id).correct?'самопроверка':outcomeNames[classifyAttempt(record(x.id))]}" ${i===route.index?'aria-current="step"':''}`)).join('')}</div>${action(route.index===t.tasks.length-1?'finish':'next',route.index===t.tasks.length-1?'Завершить →':'Следующее →',r.correct?'primary':'secondary')}</div></div>`;
  }
  function renderResult(){
    const t=currentTopic(),counts={independent:0,hinted:0,explained:0,pending:0,self:0};
    for(const q of t.tasks){const r=record(q.id);counts[q.kind==='open'&&r.correct?'self':classifyAttempt(r)]++;}
    const retry=t.tasks.filter(q=>!record(q.id).correct||record(q.id).everWrong).length;
    return header('Посмотрим, что получилось.',t.title)+`<section class="glass result"><span class="eyebrow">Итоги занятия</span><div class="result-number">${t.tasks.length-counts.pending}<span class="muted"> / ${t.tasks.length}</span></div><div class="result-stats">${Object.entries({...outcomeNames,self:'Самопроверка по образцу'}).map(([key,label])=>`<div><strong>${counts[key]}</strong><span>${label}</span></div>`).join('')}</div><p class="muted">Несколько попыток без подсказок считаются самостоятельным решением. Открытые задания отмечаются отдельно после самопроверки.</p><ol class="result-task-list">${t.tasks.map((q,i)=>`<li><span>${i+1}. ${q.kind==='open'&&record(q.id).correct?'Самопроверка по образцу':outcomeNames[classifyAttempt(record(q.id))]}${record(q.id).everWrong?' · были ошибки':''}</span>${action('review-task','Открыть','text-button',`data-index="${i}"`)}</li>`).join('')}</ol><div class="toolbar">${action('retry',`Повторить ошибки и пропуски (${retry})`,'primary',retry?'':'disabled')}${action('repeat','Начать тему заново','secondary')}${action('topics','К темам →','secondary')}</div></section>`;
  }
  function shuffled(values,seed){
    const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
    return [...values].sort((a,b)=>hash(`${seed}:${a.id}`)-hash(`${seed}:${b.id}`));
  }
  function presetCandidates(){return shuffled(filteredTasks().filter(q=>q.source==='class'&&q.topicId===filter&&q.difficulty===presetLevel),presetSeed);}
  function renderPresets(){
    if(filter==='all')return '<div class="glass preset-panel"><h2>Заготовки по сложности</h2><p class="muted">Выберите тему. Можно посмотреть состав заготовки и добавить её к ручному выбору.</p></div>';
    const ts=filteredTasks().filter(q=>q.source==='class'&&q.topicId===filter),pool=presetCandidates(),selected=pool.slice(0,presetCount);
    return `<section class="glass preset-panel"><h2>Заготовки по теме</h2><div class="preset-grid">${levels.map((d,i)=>{const n=ts.filter(q=>q.difficulty===d).length;return `<button class="preset-card" type="button" data-action="preset-preview" data-difficulty="${d}" aria-pressed="${presetLevel===d}" ${n?'':'disabled'}>${difficultyBadge(d)}<span>${levelDescriptions[i]}</span><small>${taskCount(n)}</small></button>`;}).join('')}</div>${presetLevel?`<div id="preset-preview" tabindex="-1"><h3>${esc(presetLevel)} · состав заготовки</h3><label class="field" for="preset-count">Количество заданий<select id="preset-count">${pool.map((_,i)=>`<option value="${i+1}" ${i+1===presetCount?'selected':''}>${i+1}</option>`).join('')}</select></label><ol class="preset-preview-list">${selected.map(q=>`<li><strong>№ ${q.id}${work().ids.includes(q.id)?' · уже выбрано':''}</strong>${competencyTags(q)}<p>${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}</li>`).join('')}</ol><div class="builder-actions">${action('preset-add','Добавить заготовку +','primary',selected.some(q=>!work().ids.includes(q.id))&&work().ids.length<WORK_LIMIT?'':'disabled')}${action('preset-shuffle','Другая подборка','secondary',pool.length>presetCount?'':'disabled')}</div><p class="muted">Добавляются только новые задания. Ручной выбор сохраняется.</p></div>`:''}</section>`;
  }
  function renderLibrary(){
    const saved=library;
    return `<section class="library-panel"><h3>Мои подборки <span class="badge">${saved.length}</span></h3>${saved.length?saved.map(x=>`<div class="library-row"><div><strong>${esc(x.title)}</strong><p class="muted">${taskCount(x.ids.length)} · ${esc(workSources(x.ids))} · Вариант ${esc(x.variant)}</p></div>${action('load-work','Открыть','secondary',`data-id="${esc(x.id)}"`)}${action('delete-work','Удалить','text-button',`data-id="${esc(x.id)}" aria-label="Удалить подборку ${esc(x.title)}"`)}</div>`).join(''):'<p class="muted">Сохраните подборку, чтобы вернуться к ней позже.</p>'}</section>`;
  }
  function builderToggle(key,label,count=0,cls='filter-toggle'){
    return action('toggle-builder-section',`<span>${label}</span>${count?`<span class="toggle-count">${count}</span>`:''}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`,cls,`id="toggle-${key}" data-section="${key}" aria-controls="builder-${key}" aria-expanded="${builderSections.has(key)}"`);
  }
  function renderWorkPanel(){
    const w=work();
    const items=w.ids.map((id,i)=>{
      const q=question(id);
      return `<li><div class="paper-task"><span class="paper-task-number">${i+1}.</span><div><p>${workTaskSummary(q)}</p>${q.source==='exam'?`<div class="paper-exam-image">${examImages(q.images,'Условие: '+taskSource(q),'',true)}</div>`:figureSVG(q.id,true)}</div></div><div class="mini-actions">${action('up','↑','',`data-id="${id}" aria-label="Поднять задание ${i+1}" ${i===0?'disabled':''}`)}${action('down','↓','',`data-id="${id}" aria-label="Опустить задание ${i+1}" ${i===w.ids.length-1?'disabled':''}`)}${action('remove','Удалить','',`data-id="${id}" aria-label="Удалить задание ${i+1}"`)}</div></li>`;
    }).join('');
    return `<button type="button" class="work-backdrop ${workOpen?'is-open':''}" data-action="close-work" aria-label="Закрыть панель работы" tabindex="-1"></button>
      <aside id="work-panel" class="work-panel ${workOpen?'is-open':''}" tabindex="-1" aria-labelledby="work-heading">
        <div class="paper-panel-heading"><h2 id="work-heading">Ваша работа <span class="badge">${w.ids.length} / ${WORK_LIMIT}</span></h2>${action('close-work','Закрыть ×','secondary work-close')}</div>
        <section class="work-paper" aria-label="Состав работы на листе А4">
          <div class="paper-masthead"><span>1430 <span aria-hidden="true">/</span> МАТЕМАТИКА</span><span>А4</span></div>
          <label class="field paper-title" for="work-title"><span>Название работы</span><input id="work-title" maxlength="70" value="${esc(w.title)}"></label>
          <div class="paper-meta"><span class="paper-name-line">Имя и фамилия</span><label class="paper-variant" for="work-variant">Вариант <input id="work-variant" maxlength="20" value="${esc(w.variant)}"></label></div>
          <div id="work-paper-body" class="paper-body" tabindex="0" role="region" aria-label="Выбранные задания">
            ${w.ids.length?`<ol class="work-list">${items}</ol>`:`<div class="paper-empty"><svg viewBox="0 0 120 100" fill="none" aria-hidden="true"><path d="M20 78h84M60 84V14" stroke="currentColor" stroke-opacity=".25"/><path d="M27 29Q60 125 93 29" stroke="currentColor" stroke-width="1.5"/><path d="m47 40 13-18 19 24-19 17-13-23Z" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".35"/><circle cx="80" cy="59" r="3" fill="currentColor"/><path d="M16 18h10m-5-5v10M96 80h10m-5-5v10" stroke="currentColor" stroke-opacity=".3"/></svg><strong>Здесь начнётся работа</strong><p>Добавляйте задания из банка —<br>они появятся на этом листе.</p></div>`}
          </div>
          <div class="paper-footer"><span>ШКОЛА 1430</span><span>${w.ids.length?taskCount(w.ids.length):'От вопроса к открытию'}</span></div>
        </section>
        <div class="paper-actions"><label class="check"><input id="include-answers" type="checkbox" ${w.answers?'checked':''}>Ответы и критерии для учителя</label>${action('print-preview','Предпросмотр А4 →','primary',w.ids.length?'':'disabled')}<div class="builder-actions paper-save-actions">${action('save-work','Сохранить подборку','secondary',w.ids.length?'':'disabled')}${action('export-work','Сохранить в файл','secondary',w.ids.length?'':'disabled')}${action('import-work','Открыть из файла','text-button')}</div><input id="import-file" type="file" accept=".json,application/json" hidden></div>
        <div class="paper-utilities">${builderToggle('variants','Следующий вариант',0,'work-utility-toggle')}<div id="builder-variants" class="work-utility-panel" ${builderSections.has('variants')?'':'hidden'}><section class="variant-controls"><h3>Следующий вариант</h3><label class="field" for="variant-seed">Ключ подбора<input id="variant-seed" maxlength="40" value="${esc(w.seed||'1430')}" aria-describedby="variant-help"></label><p class="muted" id="variant-help">Для заданий классов замены сохраняют тему, ступень сложности и формат. Оригинальные экзаменационные примеры сохраняются без замены. Одинаковый ключ и исходная работа дают одинаковый результат. Предыдущий вариант сохранится в подборках.</p>${action('new-variant','Создать следующий вариант','secondary',w.ids.length?'':'disabled')}</section></div>${builderToggle('library','Мои подборки',library.length,'work-utility-toggle')}<div id="builder-library" class="work-utility-panel" ${builderSections.has('library')?'':'hidden'}>${renderLibrary()}</div></div>
      </aside>
      <button class="primary work-toggle" type="button" data-action="open-work" aria-controls="work-panel" aria-expanded="${workOpen}">Работа · ${w.ids.length} / ${WORK_LIMIT}</button>`;
  }
  function sourceTasks(){
    if(sourceFilter==='all')return catalogTasks;
    if(sourceFilter==='classes')return allTasks;
    if(sourceFilter.startsWith('exam:'))return examWorkTasks.filter(q=>q.examId===sourceFilter.slice(5));
    const [,grade,level]=sourceFilter.split(':');return allTasks.filter(q=>q.grade===Number(grade)&&q.level===level);
  }
  function filteredTasks(){
    const exactId=catalogById.has(search.trim())?search.trim():null;
    return sourceTasks().filter(q=>MathCompetencies.matches(q,competencyFilter)&&(difficultyFilter==='all'||q.difficulty===difficultyFilter)&&(q.source==='exam'||(subjectFilter==='all'||q.subject===subjectFilter)&&(filter==='all'||q.topicId===filter)&&(!trickyOnly||q.tricky))&&(!favoriteOnly||favorites.has(q.id))&&(exactId?q.id===exactId:matches(q.prompt+' '+q.id+' '+(q.topic||'')+' '+taskSource(q),search)));
  }
  function validAutoCount(){const n=Number(autoCount);return String(autoCount).trim()!==''&&Number.isInteger(n)&&n>=1&&n<=WORK_LIMIT;}
  function renderAutoResult(){
    if(!autoResult)return '';
    if(autoResult.invalid)return '<div id="auto-result" class="auto-result" role="status" tabindex="-1"><strong>Проверьте количество заданий</strong><p>Введите целое количество заданий от 1 до 60.</p></div>';
    const r=autoResult,labels=ids=>MathCompetencies.definitions.filter(item=>ids.includes(item.id)).map(item=>item.title).join(', ');
    const heading=r.selected?`${r.mode==='build'?'Собрана новая работа':'Добавлено в работу'}: ${r.selected} из ${r.requested}`:r.capacity===0?'В работе уже 60 заданий':'Нет новых подходящих заданий';
    return `<div id="auto-result" class="auto-result ${r.shortfall||r.missingCompetencies.length?'has-shortage':''}" role="status" tabindex="-1"><strong>${heading}</strong><p>В работе: ${taskCount(r.workSize)}. ${r.selected?`Подобрано без повторов по выбранным фильтрам.`:'Состав текущей работы не изменился.'}</p>${r.previousSaved?'<p>Предыдущая работа сохранена в «Мои подборки».</p>':''}${r.shortfall?`<p>Не хватает: ${taskCount(r.shortfall)}. ${r.mode==='append'&&r.capacity<r.requested?`Свободных мест до сборки: ${r.capacity}. `:''}По фильтрам ${r.mode==='append'?'новых ':''}доступно: ${taskCount(r.available)}.</p>`:''}${r.coveredCompetencies.length?`<p>Проверяемые компетенции: ${esc(labels(r.coveredCompetencies))}.</p>`:''}${r.missingCompetencies.length?`<p class="auto-missing">Не удалось включить компетенции: ${esc(labels(r.missingCompetencies))}. Измените фильтры или увеличьте количество заданий.</p>`:''}</div>`;
  }
  function renderAutoAssembly(list,w){
    const availableNew=list.filter(q=>!w.ids.includes(q.id)).length,capacity=WORK_LIMIT-w.ids.length;
    return `<section class="glass auto-panel" aria-labelledby="auto-heading"><div class="auto-panel-heading"><span class="badge">Подбор по фильтрам</span><h2 id="auto-heading">Автоматическая сборка</h2><p class="muted" id="auto-help">Выберите источник, компетенции и сложность выше, затем укажите количество. Конструктор подберёт задания из найденных и постарается включить каждую выбранную компетенцию.</p></div><div class="auto-build-controls"><label class="field" for="auto-count">Количество заданий<input id="auto-count" type="number" inputmode="numeric" min="1" max="${WORK_LIMIT}" step="1" required value="${esc(autoCount)}" aria-describedby="auto-help auto-available"></label><div class="auto-availability" id="auto-available"><strong>Доступно: ${taskCount(list.length)}</strong><span>Для добавления без повторов: ${taskCount(availableNew)}</span><span>Свободных мест в работе: ${capacity}</span></div></div><div class="builder-actions auto-actions">${action('auto-build','Собрать новую работу','primary',list.length?'':'disabled')}${action('auto-append','Добавить к работе','secondary',availableNew&&capacity?'':'disabled')}</div><p class="muted auto-preserve-note">При новой сборке текущая непустая работа сохранится в «Мои подборки». Каждый запуск подбирает набор заново. Учитываются все фильтры банка, включая поиск и избранное.</p>${renderAutoResult()}</section>`;
  }
  function assembleWork(mode){
    const input=$('auto-count');if(input)autoCount=input.value;
    if(!validAutoCount()){
      autoResult={invalid:true};render();const next=$('auto-count');next?.setCustomValidity('Введите целое количество заданий от 1 до 60.');next?.reportValidity();$('auto-result')?.focus({preventScroll:true});return;
    }
    const w=work(),capacity=mode==='append'?WORK_LIMIT-w.ids.length:WORK_LIMIT;
    const result=MathAutoWork.select(filteredTasks(),{count:Number(autoCount),seed:freshId(),competencies:competencyFilter,excludeIds:mode==='append'?w.ids:[],limit:capacity});
    let previousSaved=false;
    if(result.ids.length){
      if(mode==='build'){previousSaved=!!saveLibrary(w);w.ids=[...result.ids];}else w.ids.push(...result.ids);
    }
    autoResult={...result,mode,capacity,previousSaved,workSize:w.ids.length};
    persist();render();$('auto-result')?.focus({preventScroll:true});$('auto-result')?.scrollIntoView({block:'nearest'});
  }
  function workSources(ids){return [...new Set(ids.map(id=>question(id)?.sourceLabel).filter(Boolean))].join(' · ');}
  function taskSource(q){return q.source==='exam'?`${q.sourceLabel} · № ${q.number}${q.exampleNumber?` · пример ${q.exampleNumber}`:''}`:`${q.sourceLabel} · ${q.topic} · № ${q.id}`;}
  function workTaskSummary(q){return q.source==='exam'?`<span class="work-source">${esc(taskSource(q))}</span>`:`<span class="work-source">${esc(q.sourceLabel)} · ${esc(q.topic)}</span>${mathHTML(q.prompt)}`;}
  function examTaskMarkup(q,lazy=false){return `${q.contextImages.length?`<div class="work-exam-context"><p class="muted">Общее условие к заданию № ${q.number}</p>${examImages(q.contextImages,'Общее условие ФИПИ к заданию '+q.number,'',lazy)}</div>`:''}${examImages(q.images,'Оригинал ФИПИ: '+taskSource(q),'',lazy)}`;}
  function competencyTags(q){
    const ids=new Set(MathCompetencies.forTask(q));
    return `<div class="competency-tags" aria-label="Проверяемые умения">${MathCompetencies.definitions.filter(item=>ids.has(item.id)).map(item=>`<span class="competency-tag" data-competency-tag="${item.id}" title="${esc(item.description)}">${esc(item.title)}</span>`).join('')}</div>`;
  }
  function renderCompetencyFilters(base){
    const counts=new Map(MathCompetencies.definitions.map(item=>[item.id,0]));
    for(const q of base)for(const id of MathCompetencies.forTask(q))counts.set(id,counts.get(id)+1);
    return `<fieldset class="competency-filter" aria-describedby="competency-help"><legend>Компетенции ученика</legend><p id="competency-help" class="muted">Какие умения должны проверять задания? При выборе нескольких достаточно одного совпадения. Числа — количество заданий в выбранном источнике.</p><div class="competency-options">${MathCompetencies.definitions.map(item=>`<label class="competency-choice ${competencyFilter.includes(item.id)?'is-selected':''}" for="competency-${item.id}" title="${esc(item.description)}"><input type="checkbox" id="competency-${item.id}" data-competency="${item.id}" ${competencyFilter.includes(item.id)?'checked':''}><span>${esc(item.title)}</span><small class="competency-count" aria-label="${taskCount(counts.get(item.id))}">${counts.get(item.id)}</small></label>`).join('')}</div><div class="competency-selection"><span class="muted" role="status">${competencyFilter.length?`Выбрано компетенций: ${competencyFilter.length}`:'Все компетенции'}</span>${action('clear-competencies','Снять выбор','text-button',competencyFilter.length?'':'disabled')}</div></fieldset>`;
  }
  function bankTask(q,w){return `<article class="glass bank-task ${q.source==='exam'?'exam-bank-task':''}"><h3>${q.source==='class'?subjectIcon(q.subject):''}<span>${esc(taskSource(q))}</span></h3>${q.source==='exam'?`${difficultyTags(q)}<span class="badge">Оригинал ФИПИ · ${q.kind==='open'?'Развёрнутое решение':'Краткий ответ'}</span>${competencyTags(q)}${examTaskMarkup(q,true)}`:`${difficultyTags(q)}${competencyTags(q)}<p>${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}`}<div class="builder-actions">${action(w.ids.includes(q.id)?'remove':'add',w.ids.includes(q.id)?'✓ Добавлено · убрать':'Добавить в работу +','secondary',`data-id="${q.id}" ${!w.ids.includes(q.id)&&w.ids.length>=WORK_LIMIT?'disabled':''}`)}${action('favorite',favorites.has(q.id)?'★ В избранном':'☆ В избранное','secondary favorite-button',`data-id="${q.id}" aria-pressed="${favorites.has(q.id)}"`)}</div></article>`;}
  function renderBuilder(){
    const w=work(),base=sourceTasks(),classTopics=BANK.filter(t=>base.some(q=>q.source==='class'&&q.topicId===t.id)),hasClasses=classTopics.length>0;
    const list=filteredTasks(),difficultyOptions=hasClasses?base.some(q=>q.source==='exam')?[...levels,'Высокий']:levels:examLevels;
    const subjects=[...new Set(classTopics.map(t=>t.subject))],pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));bankPage=Math.max(0,Math.min(bankPage,pages-1));
    const shown=list.slice(bankPage*PAGE_SIZE,(bankPage+1)*PAGE_SIZE),sourceOptions=[['all','Все классы и экзамены'],['classes','Все классы'],...Array.from({length:7},(_,i)=>i+5).flatMap(g=>(g<10?['basic']:['basic','advanced']).map(l=>[`class:${g}:${l}`,`${g} класс${g>=10?' · '+(l==='advanced'?'углублённый':'базовый'):''}`])),...exams.map(e=>['exam:'+e.id,e.title+' · 2026'])];
    const extraCount=Number(subjectFilter!=='all')+Number(filter!=='all')+Number(trickyOnly)+Number(favoriteOnly);
    const pagination=`<nav class="bank-pagination" aria-label="Страницы банка">${action('bank-prev','← Предыдущие','secondary',bankPage?'':'disabled')}<span>Страница ${bankPage+1} из ${pages}</span>${action('bank-next','Следующие →','secondary',bankPage<pages-1?'':'disabled')}</nav>`;
    return header('Конструктор работы.','Выбирайте задания из банка — состав работы сохраняется автоматически.')+`
      <div class="builder-grid"><section class="bank-section" id="builder-bank" aria-label="Банк заданий">
        <div class="glass bank-filters compact-filters">
          <div class="primary-filters">
            <label class="field source-filter" for="source-filter">Источник<select id="source-filter">${sourceOptions.map(([value,label])=>`<option value="${value}" ${sourceFilter===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>
            <label class="field search-field" for="bank-search">Поиск заданий<input type="search" id="bank-search" value="${esc(search)}" placeholder="Тема, условие или номер"></label>
            <label class="field" for="difficulty-filter">Сложность<select id="difficulty-filter"><option value="all">Все ступени</option>${difficultyOptions.map(d=>`<option value="${d}" ${difficultyFilter===d?'selected':''}>${d}</option>`).join('')}</select></label>
          </div>
          <div class="filter-switches">${builderToggle('competencies','Компетенции',competencyFilter.length)}${builderToggle('advanced','Ещё фильтры',extraCount)}${builderToggle('assembly','Автосборка и заготовки')}</div>
          <div id="builder-competencies" class="filter-expansion" ${builderSections.has('competencies')?'':'hidden'}>${renderCompetencyFilters(base)}</div>
          <div id="builder-advanced" class="filter-expansion" ${builderSections.has('advanced')?'':'hidden'}><div class="advanced-filter-grid">${hasClasses?`
            <label class="field" for="subject-filter">Предмет / раздел<select id="subject-filter"><option value="all">Все разделы</option>${subjects.map(s=>`<option value="${esc(s)}" ${subjectFilter===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
            <label class="field" for="bank-filter">Тема класса<select id="bank-filter"><option value="all">Все темы</option>${subjects.filter(s=>subjectFilter==='all'||s===subjectFilter).map(s=>`<optgroup label="${esc(s)}">${classTopics.filter(t=>t.subject===s).map(t=>`<option value="${t.id}" ${filter===t.id?'selected':''}>${t.grade} класс · ${esc(t.title)}${t.grade>=10?' · '+(t.level==='advanced'?'углублённый':'базовый'):''}</option>`).join('')}</optgroup>`).join('')}</select></label>
            <label class="check"><input id="tricky-only" type="checkbox" ${trickyOnly?'checked':''}>Только хитрые задачи</label>`:''}<label class="check"><input id="favorite-only" type="checkbox" ${favoriteOnly?'checked':''}>Только избранное</label></div>${sourceFilter==='all'?'<p class="muted filter-note">Раздел, тема и хитрые задачи относятся к классам. Сложность учитывается для всех источников.</p>':''}</div>
          <div id="builder-assembly" class="filter-expansion" ${builderSections.has('assembly')?'':'hidden'}>${renderAutoAssembly(list,w)}${hasClasses?renderPresets():`<div class="glass preset-panel"><h2>Демоверсия ФИПИ 2026</h2><p class="muted">Каждый пример можно выбрать отдельно. Условия и рисунки сохранены из оригинала демоверсии.</p></div>`}</div>
          <div class="filter-results"><p class="muted" role="status">Найдено: <strong>${taskCount(list.length)}</strong></p>${action('reset-builder-filters','Сбросить фильтры','text-button filter-reset')}</div>
        </div>
        <div class="bank-list-heading"><h2>Банк заданий</h2><span>Выберите задания для своей работы</span></div>
        <div id="bank-list" tabindex="-1">${shown.length?shown.map(q=>bankTask(q,w)).join(''):'<p class="glass empty" style="padding:20px">Задания не найдены. Измените запрос или фильтры.</p>'}</div>${pagination}
      </section>${renderWorkPanel()}</div>`;
  }
  function answerKey(q,number){
    if(q.source==='exam')return `<section class="answer-key"><strong>${number}. ${esc(taskSource(q))}</strong>${q.answerText?`<p>Ответ ФИПИ: ${esc(q.answerText)}</p>`:''}${q.kind==='open'?'<p>Решение и оценивание — по официальным критериям ФИПИ на следующих страницах.</p>':''}</section>`;
    return `<section class="answer-key"><strong>${number}. ${q.kind==='open'?'Образец · самопроверка':'Ответ: '+mathHTML(q.display.replace(/\./g,','))}</strong><p>${mathHTML(q.solution)}</p>${q.kind==='open'?`<strong>Критерии</strong><ul>${q.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>`;
  }
  function printMarkup(){
    const w=work(),tasks=w.ids.map(question),pages=[],top=isKey=>`<div class="sheet-header"><div class="sheet-brand">1430 × МАТЕМАТИКА</div><h2>${esc(w.title.trim()||'Самостоятельная работа')}${isKey?' · ответы':''}</h2><div class="sheet-meta">Вариант ${esc(w.variant.trim()||'1')}${isKey?' · Для учителя':''}</div></div>`;
    let pending=[];const flush=()=>{if(!pending.length)return;for(const group of taskPages(pending.map(x=>x.q)))pages.push(`${top(false)}<div class="name-line">Имя и фамилия: __________________________ Класс: ______</div>${group.map(({q})=>`<section class="print-question ${group.length===1?'single':''}"><p class="print-source">${esc(taskSource(q))}</p><p><strong>${tasks.indexOf(q)+1}.</strong> ${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}<div class="solution-lines" aria-label="Место для решения"></div></section>`).join('')}`);pending=[];};
    tasks.forEach((q,i)=>{if(q.source!=='exam'){pending.push({q,number:i+1});return;}flush();if(q.contextImages.length)q.contextImages.forEach((src,j)=>pages.push(`${top(false)}<section class="print-exam-block"><h3>${i+1}. ${esc(taskSource(q))} · общее условие${q.contextImages.length>1?` (${j+1}/${q.contextImages.length})`:''}</h3>${examImages([src],'Общее условие '+taskSource(q))}</section>`));q.images.forEach((src,j)=>pages.push(`${top(false)}<div class="name-line">Имя и фамилия: __________________________ Класс: ______</div><section class="print-exam-block${j===0?' print-question':''}"><h3>${i+1}. ${esc(taskSource(q))}${q.images.length>1?` · фрагмент ${j+1}/${q.images.length}`:''}</h3>${examImages([src],'Оригинал '+taskSource(q))}${j===q.images.length-1?'<div class="exam-solution-space" aria-label="Место для решения"></div>':''}</section>`));});flush();
    if(w.answers){for(let i=0;i<tasks.length;i+=3)pages.push(top(true)+tasks.slice(i,i+3).map((q,j)=>answerKey(q,i+j+1)).join(''));const included=new Set();tasks.filter(q=>q.source==='exam'&&q.kind==='open').forEach(q=>q.solutionPages.forEach(p=>{const key=p.image;if(included.has(key))return;included.add(key);pages.push(`${top(true)}<section class="print-exam-block"><h3>${tasks.indexOf(q)+1}. ${esc(taskSource(q))} · официальные решения и критерии · стр. ${esc(p.page||'')}</h3>${examImages([p.image],'Официальные критерии ФИПИ')}</section>`);}));}
    return pages.map((html,i)=>`<article class="sheet${html.includes('print-exam-block')?' exam-sheet':''}">${html}<div class="sheet-footer"><span>Задания классов: школа 1430 · Экзамены: ФИПИ 2026</span><span>${i+1} / ${pages.length}</span></div></article>`).join('');
  }
  function renderPrint(){return header('Готово к печати.',`${taskCount(work().ids.length)} · ${work().answers?'с ответами и критериями':'без ответов'}`)+`<div class="print-instructions glass" style="padding:20px"><strong>Работа в формате A4</strong><p>Готовый PDF содержит место для решения. Для обычной печати выберите A4, масштаб 100% и отключите колонтитулы браузера.</p><div class="builder-actions">${action('download','Скачать PDF ↓','primary')}${action('print','Печать','secondary')}${action('builder','Вернуться в конструктор','secondary')}</div><p id="pdf-status" role="status" class="muted"></p></div><div class="print-root">${printMarkup()}</div>`;}
  function renderHelp(){
    const groups=[...new Set(BANK.map(t=>`${t.grade}:${t.level}`))].map(key=>{const [g,l]=key.split(':');return {grade:Number(g),level:l,ts:BANK.filter(t=>t.grade===Number(g)&&t.level===l)};});
    const coverage=`<details><summary>Темы и ссылки на страницы ФРП</summary><table><thead><tr><th>Программа</th><th>Темы и объём</th><th>Страницы ФРП</th></tr></thead><tbody>${groups.map(({grade,level,ts})=>`<tr><th>${grade} класс${grade>=10?'<br>'+(level==='basic'?'Базовый':'Углублённый'):''}</th><td>${ts.map(t=>esc(t.title)).join('; ')}<br><strong>${topicCount(ts.length)} · ${taskCount(ts.reduce((n,t)=>n+t.tasks.length,0))}</strong></td><td>${[...new Set(ts.map(t=>t.ref))].map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></details>`;
    return header('О программе и заданиях.','Авторские материалы для занятий и самостоятельной практики.')+`<article class="glass source-box"><h2>Банк по темам ФРП</h2><p>В каталогах ${allTasks.length} заданий и ${BANK.length} тем. Условия, решения и рисунки созданы для проекта. Это не официальный банк ФРП и не полное покрытие программы. Числовые и шаблонные варианты объединены при подсчёте ${BANK_STATS.independent_groups} самостоятельных групп.</p><p><a href="https://edsoo.ru/wp-content/uploads/2025/07/2025_ooo_frp_matematika-5-9_baza.pdf" target="_blank" rel="noopener noreferrer">ФРП 5–9 (2025)</a><br><a href="https://edsoo.ru/wp-content/uploads/2025/07/2025_soo_frp_matematika_10_11_baz.pdf" target="_blank" rel="noopener noreferrer">ФРП 10–11, базовый уровень (2025)</a><br><a href="https://edsoo.ru/wp-content/uploads/2025/07/2025_soo_frp_matematika_10_11_ugl.pdf" target="_blank" rel="noopener noreferrer">ФРП 10–11, углублённый уровень (2025)</a></p>${coverage}<h2>Помощь и результаты</h2><p>У задания есть подсказка, первый шаг и полный разбор. В итогах отдельно показаны самостоятельные решения, решения с подсказкой и после разбора. Задания на доказательство, объяснение и построение проверяются по образцу и критериям самостоятельно; программа не оценивает текст автоматически.</p><h2>Ступени сложности</h2><p>${levels.map((d,i)=>`${d}: ${levelDescriptions[i].toLowerCase()}`).join('. ')}. Уровень программы 10–11 класса выбирается отдельно.</p><h2>Запись ответа</h2><p>Числа принимаются с точкой или запятой, дроби — a/b, корни — √2, 5√2/2 или sqrt(2). Радианы — π/6, 2π/3 или 2*pi/3. Несколько корней вводятся через точку с запятой. Если корней нет — ∅ или «нет решений». Единицы вводить не нужно.</p><h2>Локальное сохранение</h2><p>Прогресс текущего ученика, черновики, избранное и до 200 подборок сохраняются в этом браузере на устройстве. На главной странице есть «Продолжить». На общем компьютере нажмите «Завершить занятие / сменить ученика»: имя и ученические ответы удалятся из текущего сеанса. Работы учителя сохранятся. Очистка данных браузера удаляет локальные данные; подборки можно сохранить в JSON-файл и открыть позднее. Если браузер запрещает хранение для локального файла, интерфейс сообщит об этом.</p><h2>Варианты и PDF</h2><p>Следующий вариант подбирается по тем же темам, сложности и формату. Если равноценной замены в банке нет, исходное задание сохраняется, а число совпадений показывается. Ключ делает подбор воспроизводимым. Это сопоставимость по разметке банка, а не подтверждённое равенство времени решения.</p><p>Выбор роли меняет действия интерфейса; это не система авторизации. Тренажёр, хранение и экспорт PDF работают без сети. Для открытия ссылок на ФРП нужен интернет.</p></article>`;
  }
  function resetFilters(keepCompetencies=false){if(!keepCompetencies)competencyFilter=[];filter='all';subjectFilter='all';difficultyFilter='all';trickyOnly=false;favoriteOnly=false;presetLevel='';search='';bankPage=0;autoResult=null;}
  function syncWorkAccessibility(){
    const panel=$('work-panel');if(!panel)return;
    const mobile=window.matchMedia('(max-width:650px)').matches,modal=mobile&&workOpen;
    panel.setAttribute('role',modal?'dialog':'complementary');
    if(modal)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');
    document.body.classList.toggle('work-open',modal);
    for(const e of document.querySelectorAll('#builder-bank,.screen-head,.session-bar'))e.inert=modal;
  }
  function closeWork(focus=true){
    if(!workOpen)return;workOpen=false;document.body.classList.remove('work-open');
    $('work-panel')?.classList.remove('is-open');document.querySelector('.work-backdrop')?.classList.remove('is-open');
    const toggle=document.querySelector('.work-toggle');toggle?.setAttribute('aria-expanded','false');syncWorkAccessibility();if(focus)toggle?.focus();
  }
  function saveLibrary(w=work()){
    const value=sanitizeWork(w,catalogTasks);if(!value.ids.length)return null;
    const existing=library.find(x=>x.title===value.title&&x.variant===value.variant&&JSON.stringify(x.ids)===JSON.stringify(value.ids));
    if(existing){Object.assign(existing,value);return existing;}
    const entry={...value,id:freshId(),grade:null,level:null,created:new Date().toISOString()};library.unshift(entry);library=library.slice(0,200);return entry;
  }
  function downloadFile(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importWork(file){
    if(!file)return;if(file.size>200000){notify('Файл слишком большой. Выберите JSON-подборку до 200 КБ.');return;}
    try{
      const raw=JSON.parse(await file.text());
      if(raw.format!=='mat1430-work'||![1,2].includes(raw.version)||!raw.work||!Array.isArray(raw.work.ids))throw new Error('schema');
      if(raw.version===1&&!BANK.some(t=>t.grade===raw.grade&&t.level===raw.level))throw new Error('legacy schema');
      const clean=raw.version===1?sanitizeWork(raw.work,allTasks,raw.grade,raw.level):sanitizeWork(raw.work,catalogTasks);
      if(!clean.ids.length||clean.ids.length!==raw.work.ids.length)throw new Error('tasks');
      saveLibrary();works.set('unified',clean);resetFilters();sourceFilter='all';go('builder',{role:'teacher',grade:null,level:null,topic:null,taskIds:null});notify('Подборка открыта. Предыдущая работа сохранена в списке.');
    }catch(error){notify('Не удалось открыть подборку. Нужен файл БАЗЫ с действующими номерами заданий.');}
  }
  document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{topicSearch='';go('classes',{role:b.dataset.role,grade:null,level:null,topic:null,index:0,difficulty:'all',taskIds:null});}));
  $('app').addEventListener('input',event=>{
    const e=event.target;
    if(e.id==='answer'||e.id==='open-draft')record(currentTopic().tasks[route.index].id).draft=e.value;
    if(e.id==='exam-answer'||e.id==='exam-draft'){
      const r=record(currentExamTask().id),wasReviewed=r.feedback==='self';r.draft=e.value;
      if(e.id==='exam-draft'){
        if(wasReviewed){r.feedback='';const start=e.selectionStart,end=e.selectionEnd;render();$('exam-draft').focus({preventScroll:true});$('exam-draft').setSelectionRange(start,end);}
        const button=document.querySelector('[data-action="exam-reviewed"]');if(button)button.disabled=!r.draft.trim();
      }
    }
    if(e.id==='work-title')work().title=e.value;
    if(e.id==='work-variant')work().variant=e.value;
    if(e.id==='variant-seed')work().seed=e.value;
    if(e.id==='auto-count'){autoCount=e.value;autoResult=null;e.setCustomValidity('');$('auto-result')?.remove();}
    if(e.matches('#first-name,#last-name'))e.setCustomValidity('');
    if(e.id==='bank-search'||e.id==='topic-search'){
      const id=e.id,start=e.selectionStart,end=e.selectionEnd;
      if(id==='bank-search'){search=e.value;bankPage=0;autoResult=null;}else topicSearch=e.value;
      render();const next=$(id);next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end);
    }
    scheduleSave();
  });
  $('app').addEventListener('change',event=>{
    const e=event.target;let rerender=false;
    if(e.id==='auto-count'){autoCount=e.value;autoResult=null;e.setCustomValidity('');$('auto-result')?.remove();}
    if(e.id==='source-filter'){sourceFilter=e.value;resetFilters(true);rerender=true;}
    if(e.dataset.competency!==undefined){const selected=new Set(competencyFilter);if(e.checked)selected.add(e.dataset.competency);else selected.delete(e.dataset.competency);competencyFilter=MathCompetencies.normalize([...selected]);presetLevel='';bankPage=0;rerender=true;}
    if(e.id==='subject-filter'){subjectFilter=e.value;filter='all';presetLevel='';bankPage=0;rerender=true;}
    if(e.id==='bank-filter'){filter=e.value;presetLevel='';bankPage=0;rerender=true;}
    if(e.id==='difficulty-filter'){difficultyFilter=e.value;bankPage=0;rerender=true;}
    if(e.id==='tricky-only'){trickyOnly=e.checked;presetLevel='';bankPage=0;rerender=true;}
    if(e.id==='favorite-only'){favoriteOnly=e.checked;bankPage=0;rerender=true;}
    if(e.id==='preset-count'){presetCount=Math.max(1,Math.min(presetCandidates().length,Number(e.value)||1));rerender=true;}
    if(e.id==='training-difficulty'){route={...route,difficulty:e.value,index:0,taskIds:null};history.replaceState({mat1430:true,route},'','#train');rerender=true;}
    if(e.id==='include-answers')work().answers=e.checked;
    if(e.id==='import-file')importWork(e.files[0]);
    if(e.dataset.rubric!==undefined){record(currentTopic().tasks[route.index].id).checks[Number(e.dataset.rubric)]=e.checked;rerender=true;}
    if(rerender){if(route.view==='builder')autoResult=null;const idx=e.dataset.rubric,id=e.id;render();if(id)$(id)?.focus({preventScroll:true});else if(idx!==undefined)document.querySelector(`[data-rubric="${idx}"]`)?.focus({preventScroll:true});}
    persist();
  });
  $('app').addEventListener('submit',event=>{
    event.preventDefault();
    if(event.target.id==='profile-form'){
      const first=$('first-name'),last=$('last-name'),letter=$('class-letter');
      first.setCustomValidity(first.value.trim()?'':'Введите имя.');last.setCustomValidity(last.value.trim()?'':'Введите фамилию.');
      if(!event.target.reportValidity())return;
      const signature=[first.value.trim().toLowerCase(),last.value.trim().toLowerCase(),letter.value.toUpperCase(),route.grade].join('|');
      const old=[student.first.toLowerCase(),student.last.toLowerCase(),student.letter,student.grade].join('|');
      if(signature!==old)clearStudent();
      student={id:student.id||freshId(),first:first.value.trim(),last:last.value.trim(),letter:letter.value.toUpperCase(),grade:route.grade};go('topics',{topic:null,taskIds:null});
    }
    if(event.target.id==='answer-form'){
      const q=currentTopic().tasks[route.index],r=record(q.id);if(r.correct||q.kind==='open')return;r.draft=$('answer').value;
      const checked=checkAnswer(r.draft,q);
      if(!checked.valid)r.feedback='format';
      else{r.tries++;r.correct=checked.correct;r.feedback=r.correct?'correct':'wrong';if(!r.correct)r.everWrong=true;else r.outcome=classifyAttempt(r);}
      render();$(r.correct?'feedback':'answer')?.focus({preventScroll:true});
      if(r.correct)document.querySelector('[data-action="next"],[data-action="finish"]')?.focus({preventScroll:true});
    }
    if(event.target.id==='exam-answer-form'){
      const q=currentExamTask();if(!q||q.answerKind==='open')return;
      const r=record(q.id);if(r.correct)return;r.draft=$('exam-answer').value;
      const checked=MathExam.checkAnswer(r.draft,q,parseAnswer);
      if(!checked.valid)r.feedback='format';
      else{r.tries++;r.correct=checked.correct;r.feedback=r.correct?'correct':'wrong';if(!r.correct)r.everWrong=true;else r.outcome=r.revealed?'explained':'independent';}
      render();$(r.correct?'exam-feedback':'exam-answer')?.focus({preventScroll:true});
    }
  });
  document.addEventListener('click',async event=>{
    if(event.target.closest('.skip-link')){
      event.preventDefault();
      $('main').focus({preventScroll:true});$('main').scrollIntoView({block:'start'});return;
    }
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    const a=b.dataset.action,id=b.dataset.id;
    if(a==='back'){back();return;}
    if(a==='home'){go('home');return;}
    if(a==='resume'){if(resumeRoute)go(resumeRoute.view,resumeRoute);return;}
    if(a==='help'){go('help');return;}
    if(a==='end-session'){
      const grade=route.grade,level=route.level;clearStudent();history.replaceState(null,'','#home');
      go(grade?'profile':'classes',{role:'student',grade,level,topic:null,index:0,difficulty:'all',taskIds:null});notify('Занятие завершено. Новый ученик начинает с чистого сеанса.');return;
    }
    if(a==='clear-competencies'){competencyFilter=[];presetLevel='';bankPage=0;autoResult=null;render();$('competency-calculations')?.focus({preventScroll:true});return;}
    if(a==='reset-builder-filters'){resetFilters();sourceFilter='all';render();$('source-filter')?.focus({preventScroll:true});return;}
    if(a==='builder-home'){resetFilters();sourceFilter='all';go('builder',{role:'teacher',grade:null,level:null,topic:null,taskIds:null});return;}
    if(a==='exam-levels'){go('exam-levels',{grade:null,level:null,topic:null,examId:null,index:0,example:0});return;}
    if(a==='exam-start'){go('exam',{examId:b.dataset.exam,grade:null,level:null,topic:null,index:0,example:0});return;}
    if(a==='exam-catalog'){go('classes',{grade:null,level:null,topic:null,examId:null,index:0,example:0});return;}
    if(a==='exam-task'||a==='exam-next'||a==='exam-prev'||a==='exam-example'){
      if(route.view!=='exam')return;
      const index=a==='exam-next'?route.index+1:a==='exam-prev'?route.index-1:a==='exam-task'?Number(b.dataset.index):route.index;
      route=safeRoute({...route,index,example:a==='exam-example'?Number(b.dataset.example):0},BANK);examReferencesOpen=false;
      history.replaceState({mat1430:true,route},'','#exam');render(true);return;
    }
    if(a==='exam-references'){
      if(route.view!=='exam')return;examReferencesOpen=!examReferencesOpen;if(examReferencesOpen)record(currentExamTask().id).revealed=true;
      render();if(examReferencesOpen){$('exam-references').focus({preventScroll:true});$('exam-references').scrollIntoView({block:'start'});}return;
    }
    if(a==='exam-reviewed'){
      if(route.view!=='exam'||!examReferencesOpen)return;
      const q=currentExamTask(),r=record(q.id);if(q.answerKind==='open'&&r.draft.trim()){r.feedback='self';render();notify('Сверка с критериями отмечена. Экзаменационный балл не выставляется.');}return;
    }
    if(a==='exam-download'){
      const exam=exams.find(e=>e.id===b.dataset.exam);if(!exam?.pdfData)return;
      try{const bytes=Uint8Array.from(atob(exam.pdfData.split(',')[1]),c=>c.charCodeAt(0));downloadFile(bytes,`fipi-math-${exam.id}-2026.pdf`,'application/pdf');notify('Оригинальная демоверсия передана браузеру для сохранения.');}
      catch(error){notify('Не удалось открыть PDF. Воспользуйтесь ссылкой на источник ФИПИ.');}return;
    }
    if(a==='grade'){
      resetFilters();topicSearch='';const grade=Number(b.dataset.grade);go(grade>=10?'levels':route.role==='teacher'?'topics':'profile',{grade,level:grade>=10?null:'basic',topic:null,index:0,difficulty:'all',taskIds:null});return;
    }
    if(a==='level'){go(route.role==='teacher'?'topics':'profile',{level:b.dataset.level,topic:null,index:0,difficulty:'all',taskIds:null});return;}
    if(a==='topics'){go('topics',{taskIds:null});return;}
    if(a==='train'){go('train',{topic:b.dataset.topic,index:0,difficulty:'all',taskIds:null});return;}
    if(a==='task'||a==='next'||a==='review-task'){
      route={...route,view:'train',index:a==='next'?route.index+1:Number(b.dataset.index)};history.replaceState({mat1430:true,route},'','#train');render(true);return;
    }
    if(a==='finish'){go('result');return;}
    if(a==='hint'||a==='reveal'){
      const r=record(currentTopic().tasks[route.index].id);if(r.correct)return;
      if(a==='hint')r.hintLevel=Math.min(2,r.hintLevel+1);else r.revealed=true;
      render();const helpPanel=document.querySelector(a==='hint'?'.hint-panel':'.solution');if(helpPanel){helpPanel.setAttribute('tabindex','-1');helpPanel.focus({preventScroll:true});helpPanel.scrollIntoView({block:'nearest'});}return;
    }
    if(a==='self-complete'){
      const q=currentTopic().tasks[route.index],r=record(q.id);
      if(q.kind==='open'&&r.revealed&&q.rubric.every((_,i)=>r.checks[i])){r.correct=true;r.tries++;r.feedback='self';r.outcome='explained';render();}return;
    }
    if(a==='repeat'||a==='retry'){
      const t=currentTopic(),selected=a==='repeat'?BANK.find(t=>t.id===route.topic).tasks:t.tasks.filter(q=>!record(q.id).correct||record(q.id).everWrong);
      if(!selected.length)return;selected.forEach(q=>attempts.delete(recordKey(q.id)));
      go('train',{index:0,difficulty:a==='repeat'?'all':route.difficulty,taskIds:a==='repeat'?null:selected.map(q=>q.id)});return;
    }
    if(route.role!=='teacher')return;
    if(a==='toggle-builder-section'&&route.view==='builder'){
      const key=b.dataset.section;
      if(!['competencies','advanced','assembly','variants','library'].includes(key))return;
      if(builderSections.has(key))builderSections.delete(key);else builderSections.add(key);
      b.setAttribute('aria-expanded',String(builderSections.has(key)));
      $('builder-'+key).hidden=!builderSections.has(key);
      return;
    }
    if(a==='auto-build'||a==='auto-append'){assembleWork(a==='auto-build'?'build':'append');return;}
    if(a==='builder'){if(route.view!=='print'){resetFilters();filter=b.dataset.topic||'all';if(route.grade)sourceFilter=`class:${route.grade}:${route.level}`;}go('builder',{grade:null,level:null,topic:null,taskIds:null});return;}
    if(a==='open-work'){workOpen=true;render();$('work-panel').focus({preventScroll:true});return;}
    if(a==='close-work'){closeWork();return;}
    if(a==='bank-next'||a==='bank-prev'){bankPage+=a==='bank-next'?1:-1;render();$('bank-list').focus({preventScroll:true});$('bank-list').scrollIntoView({block:'start'});return;}
    if(a==='preset-preview'){presetLevel=b.dataset.difficulty;presetCount=Math.min(3,presetCandidates().length);render();$('preset-preview')?.focus();return;}
    if(a==='preset-shuffle'){presetSeed++;render();$('preset-preview')?.focus();return;}
    if(a==='preset-add'){
      const w=work(),selected=presetCandidates().slice(0,presetCount).filter(q=>!w.ids.includes(q.id)).slice(0,WORK_LIMIT-w.ids.length);w.ids.push(...selected.map(q=>q.id));autoResult=null;render();notify('Добавлено '+taskCount(selected.length)+'. Ручной выбор сохранён.');return;
    }
    if(a==='favorite'){
      if(!question(id))return;if(favorites.has(id))favorites.delete(id);else favorites.add(id);autoResult=null;render();document.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus({preventScroll:true});notify(favorites.has(id)?'Задание в избранном':'Задание убрано из избранного');return;
    }
    if(['add','remove','up','down'].includes(a)){
      if(!question(id))return;const w=work(),i=w.ids.indexOf(id),scroll=window.scrollY;
      if(a==='add'&&i<0&&w.ids.length<WORK_LIMIT)w.ids.push(id);
      if(a==='remove'&&i>=0)w.ids.splice(i,1);
      if(a==='up'&&i>0)[w.ids[i-1],w.ids[i]]=[w.ids[i],w.ids[i-1]];
      if(a==='down'&&i>=0&&i<w.ids.length-1)[w.ids[i+1],w.ids[i]]=[w.ids[i],w.ids[i+1]];
      autoResult=null;render();window.scrollTo(0,scroll);
      const panel=window.matchMedia('(max-width:650px)').matches&&workOpen?$('work-panel'):$('app');
      panel.querySelector(`[data-id="${id}"][data-action="${a==='add'?'remove':a==='remove'?'add':a}"]`)?.focus({preventScroll:true});notify(a==='remove'?'Задание удалено':'Состав работы сохранён');return;
    }
    if(a==='save-work'){if(saveLibrary()){render();notify('Подборка сохранена на устройстве.');}return;}
    if(a==='load-work'){
      const saved=library.find(x=>x.id===id);if(!saved)return;
      saveLibrary();works.set('unified',sanitizeWork(saved,catalogTasks));autoResult=null;render();notify('Подборка открыта. Предыдущая работа сохранена в списке.');return;
    }
    if(a==='delete-work'){library=library.filter(x=>x.id!==id);render();notify('Подборка удалена из списка. Открытая работа сохранена.');return;}
    if(a==='export-work'){
      const payload={format:'mat1430-work',version:2,work:sanitizeWork(work(),catalogTasks)};
      downloadFile(JSON.stringify(payload,null,2),'baza-work.json','application/json');persist();notify('Подборка передана браузеру для сохранения.');return;
    }
    if(a==='import-work'){$('import-file').click();return;}
    if(a==='new-variant'){
      const w=work(),original=[...w.ids],seed=w.seed||'1430';saveLibrary();
      const excluded=library.filter(x=>x.title===w.title).flatMap(x=>x.ids);
      const ids=generateVariant(original,catalogTasks,seed,excluded);
      const overlap=ids.filter(id=>original.includes(id)).length;
      const n=Number(w.variant);w.variant=Number.isFinite(n)&&n>=1?String(n+1):w.variant.slice(0,17)+'-2';w.ids=ids;saveLibrary();autoResult=null;render();
      notify(`Новый вариант сохранён. Заменено ${ids.length-overlap} из ${ids.length}${overlap?`; ${overlap} сохранено (экзаменационные оригиналы или нет замены)`:''}.`);return;
    }
    if(a==='print-preview'&&work().ids.length){go('print');return;}
    if(a==='download'){
      b.disabled=true;$('pdf-status').textContent='Собираем PDF…';
      try{const w=work(),bytes=await createMathPDF({tasks:w.ids.map(question),title:w.title.trim(),variant:w.variant.trim(),grade:null,level:null,answers:w.answers});downloadFile(bytes,'1430-math-work.pdf','application/pdf');if($('pdf-status'))$('pdf-status').textContent='PDF передан браузеру для сохранения.';}
      catch(error){if($('pdf-status'))$('pdf-status').textContent='Не удалось создать PDF. Попробуйте обычную печать.';console.error(error);}finally{b.disabled=false;}return;
    }
    if(a==='print'){window.print();return;}
  });
  window.addEventListener('popstate',event=>{closeWork(false);examReferencesOpen=false;route=safeRoute(event.state?.mat1430?event.state.route:null,BANK);render(true);});
  window.addEventListener('pagehide',persist);
  window.addEventListener('beforeunload',persist);
  window.addEventListener('resize',syncWorkAccessibility);
  document.addEventListener('keydown',event=>{
    if(workOpen&&window.matchMedia('(max-width:650px)').matches){
      if(event.key==='Escape'){event.preventDefault();closeWork();return;}
      if(event.key==='Tab'){
        const panel=$('work-panel'),items=[...panel.querySelectorAll('button:not(:disabled),input:not([type="hidden"]):not([hidden]),select,textarea,[tabindex="0"]')].filter(e=>{for(let node=e;node;node=node.parentElement)if(node.hidden)return false;return true;}),first=items[0],last=items.at(-1);
        if(!panel.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
        else if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel)){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel)){event.preventDefault();first?.focus();}
      }return;
    }
    if(event.key==='Escape'&&route.view!=='home'&&!event.target.matches('input,textarea,select')){event.preventDefault();back();}
  });
  restore();
  history.replaceState({mat1430:true,route},'','#home');render();
})();
