// One local bank serves both the trainer and the print constructor.
function parseAnswer(raw) {
  const value=String(raw).trim().replace(/−/g,'-').replace(/,/g,'.').replace(/\s+/g,'').replace(/sqrt/gi,'√');
  const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  function atom(s){
    if(new RegExp(`^${number}$`).test(s))return Number(s);
    const m=s.match(new RegExp(`^([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)?)(?:\\*)?√(?:\\((${number})\\)|(${number}))$`));
    if(!m)return null;
    const rad=Number(m[2]??m[3]);if(rad<0)return null;
    const c=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:Number(m[1]);
    return c*Math.sqrt(rad);
  }
  const parts=value.split('/');if(parts.length>2)return null;
  const n=atom(parts[0]),d=parts.length===2?atom(parts[1]):1;
  if(n===null||d===null||d===0)return null;
  const result=n/d;return Number.isFinite(result)?result:null;
}
function answerMatches(raw,expected) {
  const value=parseAnswer(raw);
  return value!==null && Math.abs(value-expected)<=Math.min(1e-7,1e-8*Math.max(1,Math.abs(expected)));
}
function checkAnswer(raw,q){
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
  if(q.kind==='set')return 'Все корни через точку с запятой: −2; 1/2. Порядок не важен. Если корней нет, введите ∅ или «нет решений». Не разделяйте корни запятой.';
  if(q.precision)return `Число без единиц. Округлите до ${q.precision===3?'тысячных':q.precision+' знаков'}; точка и запятая допустимы.`;
  return 'Число без единиц: −3, 0,75, 3/4. Корень: √2, 5√2/2 или sqrt(2). Для точного ответа используйте дробь или корень.';
}
/* UI */
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
  const topicCount=n=>`${n} ${plural(n,'тема','темы','тем')}`;
  const taskCount=n=>`${n} ${plural(n,'задание','задания','заданий')}`;
  const baseTitle='1430 — пространство математики';
  const source59='https://edsoo.ru/wp-content/uploads/2025/07/2025_ooo_frp_matematika-5-9_baza.pdf';
  const sourceBasic='https://edsoo.ru/wp-content/uploads/2025/07/2025_soo_frp_matematika_10_11_baz.pdf';
  const source1011='https://edsoo.ru/wp-content/uploads/2025/07/2025_soo_frp_matematika_10_11_ugl.pdf';
  const student={first:'',last:'',letter:''};
  const attempts=new Map(),works=new Map();
  let route={view:'home',role:null,grade:null,level:null,topic:null,index:0,difficulty:'all'};
  let filter='all',subjectFilter='all',difficultyFilter='all',trickyOnly=false,presetLevel='',presetCount=3,toastTimer;
  const levels=['Базовый','Средний','Повышенный','Суперсложный'];
  const levelDescriptions=['Одно правило или формула','Несколько последовательных действий','Выбор метода, преобразования и ограничения','Нестандартная идея и сочетание приёмов'];
  const subjectSymbols={
    'Числа и вычисления':['numbers','<path d="M4 7h8M8 3v8M15 6h5M4 17h7M15 15h5m-5 4h5"/>'],
    'Текстовые задачи':['word','<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15M6 8h3m6 0h3M6 12h3m6 0h3"/>'],
    'Наглядная геометрия':['geometry','<path d="M4 20 10 4l10 16H4Zm2-5h4v5"/>'],
    'Геометрия':['geometry','<path d="M4 20 10 4l10 16H4Zm2-5h4v5"/>'],
    'Алгебра':['algebra','<path d="m4 7 7 10m0-10L4 17m11-8h6m-6 6h6"/>'],
    'Алгебра и начала математического анализа':['analysis','<path d="M4 3v17h17M7 16c3 0 3-10 6-10s3 10 7 10"/>'],
    'Вероятность и статистика':['probability','<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="currentColor" stroke="none"><circle cx="8" cy="8" r="1.3"/><circle cx="16" cy="8" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="8" cy="16" r="1.3"/><circle cx="16" cy="16" r="1.3"/></g>']
  };
  function subjectIcon(subject){
    const [name,shape]=subjectSymbols[subject]||subjectSymbols['Числа и вычисления'];
    return `<span class="subject-icon subject-icon--${name}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">${shape}</svg></span>`;
  }
  function difficultyBadge(level){
    const index=levels.indexOf(level),tone=['basic','medium','advanced','challenge'][index]||'basic';
    return `<span class="difficulty-badge difficulty--${tone}"><span class="difficulty-bars" aria-hidden="true">${[0,1,2,3].map(i=>`<i${i<=index?' class="filled"':''}></i>`).join('')}</span>${esc(level)}</span>`;
  }
  const difficultyTags=q=>`<div class="difficulty">${difficultyBadge(q.difficulty)}${q.tricky?'<span class="tricky-badge">✦ Хитрая задача</span>':''}</div>`;
  const programLabel=()=>route.level==='advanced'?'Углублённый':'Базовый';
  const roleLabel=()=>route.role==='teacher'?'Учитель':'Ученик';
  const topics=()=>BANK.filter(t=>t.grade===route.grade&&(t.level||'basic')===(route.level||'basic'));
  const currentTopic=()=>{const t=BANK.find(t=>t.id===route.topic);return route.difficulty&&route.difficulty!=='all'?{...t,tasks:t.tasks.filter(q=>q.difficulty===route.difficulty)}:t;};
  const allTasks=BANK.flatMap(t=>t.tasks.map(q=>({...q,topic:t.title,topicId:t.id,grade:t.grade,level:t.level,subject:t.subject})));
  const question=id=>allTasks.find(q=>q.id===id);
  const work=()=>{
    const key=`${route.grade}:${route.level||'basic'}`;
    if(!works.has(key)) works.set(key,{ids:[],title:'Самостоятельная работа',variant:'1',answers:false});
    return works.get(key);
  };
  const record=id=>{
    const key=`${route.role}:${id}`;
    if(!attempts.has(key)) attempts.set(key,{draft:'',tries:0,correct:false,revealed:false,feedback:''});
    return attempts.get(key);
  };
  const action=(key,label,cls='secondary',attrs='')=>`<button type="button" class="${cls}" data-action="${key}" ${attrs}>${label}</button>`;
  const note=()=>`<div class="bottom-note"><span>Авторский банк по темам ФРП · 23.10.2026</span>${action('help','О программе и заданиях','text-button')}</div>`;
  const header=(title,subtitle)=>`<div class="screen-head"><div class="trail">${action('back','← Назад','text-button')}<span>${roleLabel()}${route.grade?` · ${route.grade} класс`:''}</span>${route.grade>=10&&route.level?`<span class="badge">${programLabel()} курс</span>`:''}</div><h1 tabindex="-1" id="screen-title">${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;
  function notify(text){ $('notice').textContent=text; $('notice').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('notice').hidden=true;},2400); }
  function go(view,data={}) {
    route={...route,...data,view};
    history.pushState({mat1430:true,route},'',`#${view}`);
    render(true);
  }
  function back(){ history.back(); }
  function render(focus=false){
    $('welcome').hidden=route.view!=='home'; $('app').hidden=route.view==='home';
    document.body.classList.toggle('app-mode',route.view!=='home');
    document.title=route.view==='home'?baseTitle:`1430 — ${roleLabel()}${route.grade?` · ${route.grade} класс`:''}`;
    document.querySelector('.skip-link').textContent=route.view==='home'?'Перейти к выбору роли':'Перейти к содержимому';
    if(route.view==='home') {
      $('app').innerHTML='';
      if(focus){document.querySelector('[data-role="student"]').focus({preventScroll:true});window.scrollTo(0,0);}
      return;
    }
    if(!route.role){route={...route,view:'home'};render(focus);return;}
    const pages={classes:renderClasses,levels:renderLevels,profile:renderProfile,topics:renderTopics,train:renderTrainer,result:renderResult,builder:renderBuilder,print:renderPrint,help:renderHelp};
    if(!pages[route.view]) return;
    $('app').innerHTML=pages[route.view]();
    if(focus){window.scrollTo(0,0);$('screen-title')?.focus({preventScroll:true});}
  }
  function renderClasses(){
    return header('В каком вы классе?',route.role==='teacher'?'Выберите класс для тренажёра и печатной работы.':'Выберите свой класс. Дальше — знакомство и тема урока.')+
      `<div class="class-grid">${Array.from({length:7},(_,i)=>i+5).map(g=>`<button type="button" class="glass class-card" data-action="grade" data-grade="${g}" aria-label="${g} класс"><strong>${g}<small>класс</small></strong><span>${g>=10?'Базовый и углублённый курсы':topicCount(BANK.filter(t=>t.grade===g).length)}</span></button>`).join('')}</div>`+note();
  }
  function renderLevels(){
    return header('Выберите программу.',`${route.grade} класс. Уровень курса определяет темы; сложность заданий выбирается отдельно внутри каждой темы.`)+`<div class="level-grid">${['basic','advanced'].map(level=>{const ts=BANK.filter(t=>t.grade===route.grade&&t.level===level);return `<button class="glass level-card" type="button" data-action="level" data-level="${level}"><span class="eyebrow">Уровень программы</span><h2>${level==='basic'?'Базовый':'Углублённый'}</h2><p>${topicCount(ts.length)} · ${taskCount(ts.reduce((sum,t)=>sum+t.tasks.length,0))}</p><span>Выбрать →</span></button>`;}).join('')}</div>`+note();
  }
  function renderProfile(){
    return header('Давайте познакомимся.',`${route.grade} класс. Как к вам обращаться?`)+
      `<form id="profile-form" class="glass profile"><div class="field-grid"><label class="field" for="first-name">Имя<input id="first-name" name="first" required maxlength="40" autocomplete="off" value="${esc(student.first)}" placeholder="Например, Саша"></label><label class="field" for="last-name">Фамилия<input id="last-name" name="last" required maxlength="60" autocomplete="off" value="${esc(student.last)}" placeholder="Например, Иванова"></label></div><label class="field letter-field" for="class-letter">Буква класса<input id="class-letter" name="letter" required maxlength="1" pattern="[А-Яа-яЁёA-Za-z]" autocomplete="off" value="${esc(student.letter)}" placeholder="А" title="Одна буква класса"></label><p class="muted">Имя используется только в этой вкладке. После перезагрузки оно исчезнет; на сервер ничего не отправляется.</p><button class="primary" type="submit">Выбрать тему →</button></form>`;
  }
  function renderTopics(){
    const intro=route.role==='teacher'?'Откройте тренажёр для просмотра или соберите задания в печатную работу.':`${student.first}, выберите тему, которую назвал учитель на уроке.`;
    return header('Сегодня разбираемся.',intro)+`<div class="toolbar"><span class="badge">${topicCount(topics().length)} · ${taskCount(topics().reduce((s,t)=>s+t.tasks.length,0))}${route.role==='student'?` · ${esc(student.first)} ${esc(student.last)}, ${route.grade}${esc(student.letter)}`:''}</span>${route.role==='teacher'?action('builder','Конструктор работы ↗','primary'):''}</div>`+
      `${route.grade<=6?'<p class="muted">Единый курс «Математика». Темы сгруппированы по разделам.</p>':''}${[...new Set(topics().map(t=>t.subject))].map(subject=>`<section class="subject-section"><h2 class="subject-heading">${subjectIcon(subject)}<span class="subject-heading-copy">${esc(subject)} <small>${topics().filter(t=>t.subject===subject).length} ${plural(topics().filter(t=>t.subject===subject).length,'тема','темы','тем')}</small></span></h2><div class="topic-grid">${topics().filter(t=>t.subject===subject).map(t=>`<article class="glass topic-card"><span class="subject">${subjectIcon(t.subject)}<span>${esc(t.subject)}</span></span><h3>${esc(t.title)}</h3><p class="muted">${taskCount(t.tasks.length)} · с объяснениями</p><div class="topic-actions">${action('train',route.role==='teacher'?'Посмотреть тренажёр':'Начать →',route.role==='teacher'?'secondary':'primary',`data-topic="${t.id}"`)}${route.role==='teacher'?action('builder','В работу +','secondary',`data-topic="${t.id}"`):''}</div></article>`).join('')}</div></section>`).join('')}`+note();
  }
  function renderTrainer(){
    const t=currentTopic(),q=t.tasks[route.index],r=record(q.id),done=t.tasks.filter(x=>record(x.id).correct).length;
    return `<div class="trainer">`+header(t.title,route.role==='teacher'?'Режим учителя: тот же тренажёр и тот же банк заданий.':`${student.first}, решайте в своём темпе. Можно попробовать ещё раз или посмотреть объяснение.`)+
      `<label class="field training-filter" for="training-difficulty">Сложность в этой теме<select id="training-difficulty"><option value="all">Все ступени</option>${levels.map(d=>`<option value="${d}" ${route.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></label><div class="progress" role="progressbar" aria-label="Проверенные задания" aria-valuemin="0" aria-valuemax="${t.tasks.length}" aria-valuenow="${done}"><span style="width:${done/t.tasks.length*100}%"></span></div><article class="glass task-card"><div class="task-meta"><span class="subject-label">${subjectIcon(t.subject)}<span>${esc(t.subject)} · ${route.grade} класс${route.grade>=10?' · '+programLabel()+' курс':''}</span></span><span>Задание ${route.index+1} из ${t.tasks.length}</span></div>${difficultyTags(q)}<h2 class="task-prompt">${mathHTML(q.prompt)}</h2>${figureSVG(q.id)}<form id="answer-form"><div class="answer-row"><label class="field" for="answer">Ваш ответ<input id="answer" name="answer" autocomplete="off" spellcheck="false" maxlength="60" inputmode="text" value="${esc(r.draft)}" ${r.correct?'readonly':''} aria-describedby="answer-format${r.feedback?' feedback':''}"></label><button type="submit" class="primary" ${r.correct?'disabled':''}>${r.correct?'Проверено ✓':'Проверить'}</button></div><p class="muted" id="answer-format">${esc(answerHint(q))}</p></form>${r.feedback?`<div id="feedback" class="feedback ${r.correct?'':'wrong'}" role="status"><strong>${r.correct?'Верно. Продолжаем!':r.feedback==='format'?'Проверьте запись ответа.':'Пока не сходится.'}</strong><p>${r.correct?mathHTML(q.solution):r.feedback==='format'?esc(answerHint(q))+' Знаменатель не должен быть нулём.':'Попробуйте ещё раз. Если нужна помощь, откройте объяснение.'}</p></div>`:''}${!r.correct?action('reveal',r.revealed?'Объяснение открыто':'Показать объяснение','text-button',r.revealed?'disabled':''):''}${r.revealed&&!r.correct?`<div class="solution"><strong>Ответ: ${mathHTML(q.display.replace(/\./g,','))}.</strong> ${mathHTML(q.solution)}</div>`:''}</article><div class="task-nav"><div class="dots" aria-label="Номер задания">${t.tasks.map((x,i)=>action('task',String(i+1),`task-dot ${record(x.id).correct?'done':''}`,`data-index="${i}" aria-label="Задание ${i+1}${record(x.id).correct?', проверено':''}" ${i===route.index?'aria-current="step"':''}`)).join('')}</div>${action(route.index===t.tasks.length-1?'finish':'next',route.index===t.tasks.length-1?'Завершить →':'Следующее →',r.correct?'primary':'secondary')}</div></div>`;
  }
  function renderResult(){
    const t=currentTopic(),done=t.tasks.filter(q=>record(q.id).correct).length;
    return header('Ещё один шаг вперёд.',t.title)+`<section class="glass result"><span class="eyebrow">Практика завершена</span><div class="result-number">${done}<span class="muted"> / ${t.tasks.length}</span></div><h2>Задания с верным ответом</h2><p class="muted">Это практика, а не оценка. Можно вернуться к теме и разобрать оставшиеся задания.</p><div class="toolbar">${action('repeat','Начать заново','secondary')}${action('topics','К темам →','primary')}</div></section>`;
  }
  function presetCandidates(){return allTasks.filter(q=>q.grade===route.grade&&q.level===route.level&&q.topicId===filter&&q.difficulty===presetLevel&&(!trickyOnly||q.tricky));}
  function renderPresets(){
    if(filter==='all')return '<div class="glass preset-panel"><h2>Заготовки по сложности</h2><p class="muted">Выберите одну тему в фильтре. Можно собрать работу вручную из любых тем или посмотреть готовую подборку и добавить её к выбранным заданиям.</p></div>';
    const ts=allTasks.filter(q=>q.topicId===filter&&(!trickyOnly||q.tricky)),selected=presetCandidates().slice(0,presetCount);
    return `<section class="glass preset-panel"><h2>Заготовки по теме</h2><p class="muted">Сначала посмотрите состав. Добавление сохраняет все задания, которые уже выбраны вручную. Состав и порядок можно изменить.</p><div class="preset-grid">${levels.map((d,i)=>{const n=ts.filter(q=>q.difficulty===d).length;return `<button type="button" class="preset-card" data-action="preset-preview" data-difficulty="${d}" aria-pressed="${presetLevel===d}" ${n?'':'disabled'}><strong>${difficultyBadge(d)}</strong><span>${levelDescriptions[i]}</span><small>${taskCount(n)}${trickyOnly?' · хитрые':''}</small></button>`;}).join('')}</div>${presetLevel?`<div id="preset-preview" tabindex="-1"><h3>${esc(presetLevel)} · состав заготовки</h3><label class="field" for="preset-count">Количество заданий<select id="preset-count">${Array.from({length:presetCandidates().length},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===presetCount?'selected':''}>${n}</option>`).join('')}</select></label><ol class="preset-preview-list">${selected.map(q=>`<li><strong>№ ${q.id}${work().ids.includes(q.id)?' · уже выбрано':''}</strong><p>${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}</li>`).join('')}</ol>${action('preset-add','Добавить эту заготовку +','primary',selected.some(q=>!work().ids.includes(q.id))&&work().ids.length<24?'':'disabled')}<p class="muted">В работу добавятся только новые задания. Лимит работы — 24.</p></div>`:''}</section>`;
  }
  function renderBuilder(){
    if(route.role!=='teacher')return header('Выберите тему','Конструктор доступен в режиме учителя.');
    const w=work(),list=allTasks.filter(q=>q.grade===route.grade&&q.level===route.level&&(subjectFilter==='all'||q.subject===subjectFilter)&&(filter==='all'||q.topicId===filter)&&(difficultyFilter==='all'||q.difficulty===difficultyFilter)&&(!trickyOnly||q.tricky));
    const subjects=[...new Set(topics().map(t=>t.subject))];
    return header('Соберите свою работу.','Выберите конкретные задания или добавьте заготовку по теме и сложности. Количество и порядок определяете вы.')+`<div class="builder-grid"><section><div class="glass bank-filters"><label class="field" for="subject-filter">Предмет / раздел<select id="subject-filter"><option value="all">Все предметы и разделы</option>${subjects.map(subject=>`<option value="${esc(subject)}" ${subjectFilter===subject?'selected':''}>${esc(subject)}</option>`).join('')}</select></label><label class="field" for="bank-filter">Тема<select id="bank-filter"><option value="all">Все темы · ${route.grade} класс</option>${subjects.filter(s=>subjectFilter==='all'||s===subjectFilter).map(subject=>`<optgroup label="${esc(subject)}">${topics().filter(t=>t.subject===subject).map(t=>`<option value="${t.id}" ${filter===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select></label><label class="field" for="difficulty-filter">Сложность задания<select id="difficulty-filter"><option value="all">Все ступени сложности</option>${levels.map(d=>`<option value="${d}" ${difficultyFilter===d?'selected':''}>${d}</option>`).join('')}</select></label><label class="check"><input id="tricky-only" type="checkbox" ${trickyOnly?'checked':''}>Только хитрые задачи</label><p class="muted">Найдено: ${taskCount(list.length)}. Сложность — ступень внутри выбранной школьной программы.</p></div>${renderPresets()}<div id="bank-list">${list.length?list.map(q=>`<article class="glass bank-task"><h3>${subjectIcon(q.subject)}<span>${esc(q.subject)} · ${esc(q.topic)} · № ${q.id}</span></h3>${difficultyTags(q)}<p>${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}${action(w.ids.includes(q.id)?'remove':'add',w.ids.includes(q.id)?'✓ Добавлено · убрать':'Добавить в работу +','secondary',`data-id="${q.id}" ${!w.ids.includes(q.id)&&w.ids.length>=24?'disabled':''}`)}</article>`).join(''):'<div class="glass empty">Для сочетания фильтров заданий нет. Измените сложность или отключите фильтр хитрых задач.</div>'}</div></section><aside class="glass work-panel"><h2>В работе <span class="badge">${w.ids.length} / 24</span></h2><label class="field" for="work-title">Название<input id="work-title" maxlength="70" value="${esc(w.title)}"></label><label class="field" for="work-variant">Вариант<input id="work-variant" maxlength="20" value="${esc(w.variant)}"></label>${w.ids.length?`<ol class="work-list">${w.ids.map((id,i)=>`<li><p><strong>${i+1}.</strong> ${mathHTML(question(id).prompt)}</p><div class="mini-actions">${action('up','↑','',`data-id="${id}" aria-label="Поднять задание ${i+1}" ${i===0?'disabled':''}`)}${action('down','↓','',`data-id="${id}" aria-label="Опустить задание ${i+1}" ${i===w.ids.length-1?'disabled':''}`)}${action('remove','Удалить','',`data-id="${id}" aria-label="Удалить задание ${i+1}"`)}</div></li>`).join('')}</ol>`:'<p class="empty">Пока здесь пусто. Добавьте первое задание из банка.</p>'}<label class="check"><input id="include-answers" type="checkbox" ${w.answers?'checked':''}>Включить ответы и объяснения на отдельных страницах для учителя</label>${action('print-preview','Предпросмотр A4 →','primary',w.ids.length?'':'disabled')}<p class="muted">До 24 заданий из разных тем. В работе будет место для решений. PDF скачивается без подключения к интернету.</p></aside></div>`;
  }
  function printMarkup(){
    const w=work(),tasks=w.ids.map(question),pages=[];
    const top=(isKey)=>`<div class="sheet-header"><div class="sheet-brand">1430 × МАТЕМАТИКА</div><h2>${esc(w.title.trim()||'Самостоятельная работа')}${isKey?' · ответы':''}</h2><div class="sheet-meta">${route.grade} класс${route.grade>=10?' · '+programLabel().toLowerCase()+' уровень':''} · Вариант ${esc(w.variant.trim()||'1')}${isKey?' · Для учителя':''}</div></div>`;
    for(const group of taskPages(tasks))pages.push(`${top(false)}<div class="name-line">Имя и фамилия: __________________________ Класс: ______</div>${group.map(({q,number})=>`<section class="print-question ${group.length===1?'single':''}"><p><strong>${number}.</strong> ${mathHTML(q.prompt)}</p>${figureSVG(q.id,true)}<div class="solution-lines" aria-label="Место для решения"></div></section>`).join('')}`);
    if(w.answers)for(let i=0;i<tasks.length;i+=3)pages.push(`${top(true)}${tasks.slice(i,i+3).map((q,j)=>`<section class="answer-key"><strong>${i+j+1}. Ответ: ${mathHTML(q.display.replace(/\./g,','))}.</strong><p>${mathHTML(q.solution)}</p></section>`).join('')}`);
    return pages.map((html,i)=>`<article class="sheet">${html}<div class="sheet-footer"><span>Авторские задания по темам ФРП · школа 1430</span><span>${i+1} / ${pages.length}</span></div></article>`).join('');
  }
  function renderPrint(){
    if(route.role!=='teacher'||!work().ids.length)return header('Работа пока пуста.','Вернитесь в конструктор и добавьте задания.');
    return header('Готово к печати.',`${taskCount(work().ids.length)} · ${work().answers?'ответы включены отдельными страницами':'без ответов'}`)+`<div class="print-instructions glass" style="padding:20px"><strong>Работа в формате A4</strong><p>Скачайте готовый PDF с местом для решений. Можно также открыть обычную печать: выберите A4, масштаб 100% и отключите колонтитулы браузера.</p><div style="display:flex;gap:12px;flex-wrap:wrap">${action('download','Скачать PDF ↓','primary')}${action('print','Печать','secondary')}</div><p id="pdf-status" role="status" class="muted" style="margin-bottom:0"></p></div><div class="print-root">${printMarkup()}</div>`;
  }
  function renderHelp(){
    const groups=[...new Set(BANK.map(t=>`${t.grade}:${t.level}`))].map(key=>{const [grade,level]=key.split(':');return {grade:Number(grade),level,ts:BANK.filter(t=>t.grade===Number(grade)&&t.level===level)};}).sort((a,b)=>a.grade-b.grade||(a.level==='basic'?-1:1));
    const unique=BANK_STATS.independent_groups;
    return header('Откуда берутся темы.','Официальные программы сверены 23 октября 2026 года.')+`<article class="glass source-box"><h2>Авторские задания по темам ФРП</h2><p>Условия, решения и рисунки созданы для проекта. Это не официальный банк упражнений ФРП и не полное покрытие программы. В каталогах ${allTasks.length} записей. После объединения числовых и шаблонных вариантов — ${unique} самостоятельных групп задач. Отдельно: ${BANK_STATS.numeric_or_template_variants} вариантов и ${BANK_STATS.cross_catalog_reuses} повторных размещений в программах. ${BANK_STATS.target_reached?'Числовые варианты и найденные смысловые повторы объединены при подсчёте.':'Проверка смысловой близости продолжается; это рабочий объём банка.'} 5–6 классы изучают единый курс «Математика»; начиная с 7-го выделены алгебра, геометрия, вероятность и статистика. Для 10 и 11 есть отдельные базовые и углублённые программы с собственным распределением тем.</p><p><a href="${source59}" target="_blank" rel="noopener noreferrer">ФРП 5–9, базовый уровень (2025)</a><br><a href="${sourceBasic}" target="_blank" rel="noopener noreferrer">ФРП 10–11, базовый уровень (2025)</a><br><a href="${source1011}" target="_blank" rel="noopener noreferrer">ФРП 10–11, углублённый уровень (2025)</a></p><table><thead><tr><th>Программа</th><th>Темы и объём</th><th>Страницы ФРП</th></tr></thead><tbody>${groups.map(({grade,level,ts})=>`<tr><th>${grade} класс${grade>=10?'<br>'+(level==='basic'?'Базовый':'Углублённый'):''}</th><td>${ts.map(t=>esc(t.title)).join('; ')}.<br><strong>${topicCount(ts.length)} · ${taskCount(ts.reduce((sum,t)=>sum+t.tasks.length,0))}</strong></td><td>${[...new Set(ts.map(t=>t.ref))].join(', ')}</td></tr>`).join('')}</tbody></table><h2>Ступени сложности</h2><p>${levels.map((d,i)=>`${d}: ${levelDescriptions[i].toLowerCase()}`).join('. ')}. Это авторская градация внутри темы, а не уровень программы. «Хитрая задача» — дополнительный тег: нужно внимательно проверить ограничения или заметить полезную закономерность. Объяснение идеи находится в решении.</p><h2>Проверка ответа</h2><p>Числа принимаются с точкой или запятой, дроби — как a/b, корни — как √2 или 5√2/2. Несколько корней вводятся через точку с запятой в любом порядке. Если нужно округление, это указано в условии. Единицы в поле ответа не вводятся. Для точных дробных и иррациональных ответов используйте дробь или корень.</p><h2>Локальная работа</h2><p>Имя, фамилия, класс, ответы и состав работы хранятся в памяти вкладки. Перезагрузка очищает их. Выбор роли меняет действия интерфейса, это не система авторизации. Ученик и учитель используют один и тот же банк. Ссылки на ФРП требуют интернета; сам тренажёр и скачивание PDF работают локально.</p></article>`;
  }
  document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>go('classes',{role:b.dataset.role,grade:null,level:null,topic:null,index:0,difficulty:'all'})));
  $('app').addEventListener('input',event=>{
    const e=event.target;
    if(e.id==='answer')record(currentTopic().tasks[route.index].id).draft=e.value;
    if(e.id==='work-title')work().title=e.value;
    if(e.id==='work-variant')work().variant=e.value;
    if(e.id==='first-name')student.first=e.value;
    if(e.id==='last-name')student.last=e.value;
    if(e.id==='class-letter')student.letter=e.value.toUpperCase();
  });
  $('app').addEventListener('change',event=>{
    if(event.target.id==='subject-filter'){subjectFilter=event.target.value;filter='all';presetLevel='';render();$('subject-filter').focus();}
    if(event.target.id==='bank-filter'){filter=event.target.value;presetLevel='';render();$('bank-filter').focus();}
    if(event.target.id==='difficulty-filter'){difficultyFilter=event.target.value;render();$('difficulty-filter').focus();}
    if(event.target.id==='tricky-only'){trickyOnly=event.target.checked;presetLevel='';render();$('tricky-only').focus();}
    if(event.target.id==='preset-count'){presetCount=Math.max(1,Math.min(presetCandidates().length,Number(event.target.value)||1));render();$('preset-count').focus();}
    if(event.target.id==='training-difficulty'){route={...route,difficulty:event.target.value,index:0};history.replaceState({mat1430:true,route},'', '#train');render();$('training-difficulty').focus();}
    if(event.target.id==='include-answers')work().answers=event.target.checked;
  });
  $('app').addEventListener('submit',event=>{
    event.preventDefault();
    if(event.target.id==='profile-form'){
      const first=$('first-name'),last=$('last-name');
      first.setCustomValidity(first.value.trim()?'':'Введите имя.');last.setCustomValidity(last.value.trim()?'':'Введите фамилию.');
      if(!event.target.reportValidity())return;
      student.first=first.value.trim();student.last=last.value.trim();student.letter=$('class-letter').value.toUpperCase();go('topics');
    }
    if(event.target.id==='answer-form'){
      const q=currentTopic().tasks[route.index],r=record(q.id);r.draft=$('answer').value;
      const checked=checkAnswer(r.draft,q);
      if(!checked.valid)r.feedback='format';
      else {r.tries++;r.correct=checked.correct;r.feedback=r.correct?'correct':'wrong';}
      render();$('answer').focus({preventScroll:true});
    }
  });
  $('app').addEventListener('click',async event=>{
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    const a=b.dataset.action,id=b.dataset.id;
    if(a==='back'){back();return;}
    if(a==='help'){go('help');return;}
    if(a==='grade'){subjectFilter='all';filter='all';difficultyFilter='all';trickyOnly=false;presetLevel='';const grade=Number(b.dataset.grade);go(grade>=10?'levels':route.role==='teacher'?'topics':'profile',{grade,level:grade>=10?null:'basic',topic:null,index:0,difficulty:'all'});return;}
    if(a==='level'){go(route.role==='teacher'?'topics':'profile',{level:b.dataset.level,topic:null,index:0,difficulty:'all'});return;}
    if(a==='topics'){go('topics');return;}
    if(a==='train'){go('train',{topic:b.dataset.topic,index:0,difficulty:'all'});return;}
    if(a==='task'||a==='next'){
      route={...route,index:a==='task'?Number(b.dataset.index):route.index+1};history.replaceState({mat1430:true,route},'', '#train');render(true);return;
    }
    if(a==='finish'){go('result');return;}
    if(a==='reveal'){record(currentTopic().tasks[route.index].id).revealed=true;render();$('answer').focus({preventScroll:true});return;}
    if(a==='repeat'){currentTopic().tasks.forEach(q=>attempts.delete(`${route.role}:${q.id}`));go('train',{index:0});return;}
    if(route.role!=='teacher')return;
    if(a==='builder'){subjectFilter='all';difficultyFilter='all';trickyOnly=false;presetLevel='';filter=b.dataset.topic||'all';go('builder');return;}
    if(a==='preset-preview'){presetLevel=b.dataset.difficulty;presetCount=Math.min(3,presetCandidates().length);render();$('preset-preview')?.focus();return;}
    if(a==='preset-add'){const w=work(),selected=presetCandidates().slice(0,presetCount),room=24-w.ids.length,toAdd=selected.filter(q=>!w.ids.includes(q.id)).slice(0,room);w.ids.push(...toAdd.map(q=>q.id));render();notify('Добавлено '+taskCount(toAdd.length)+'. Ручной выбор сохранён.');return;}
    if(a==='add'||a==='remove'||a==='up'||a==='down'){
      const w=work(),i=w.ids.indexOf(id);
      if(a==='add'&&i<0&&w.ids.length<24){w.ids.push(id);notify('Задание добавлено в работу');}
      if(a==='remove'&&i>=0){w.ids.splice(i,1);notify('Задание удалено');}
      if(a==='up'&&i>0)[w.ids[i-1],w.ids[i]]=[w.ids[i],w.ids[i-1]];
      if(a==='down'&&i>=0&&i<w.ids.length-1)[w.ids[i+1],w.ids[i]]=[w.ids[i],w.ids[i+1]];
      const scroll=window.scrollY;render();window.scrollTo(0,scroll);
      const same=[...$('app').querySelectorAll('[data-action]')].find(x=>x.dataset.id===id&&(x.dataset.action===a||x.dataset.action===(a==='add'?'remove':'add')));
      same?.focus({preventScroll:true});return;
    }
    if(a==='print-preview'&&work().ids.length){go('print');return;}
    if(a==='download'){
      b.disabled=true;$('pdf-status').textContent='Собираем PDF…';
      try {
        const w=work(),bytes=await createMathPDF({tasks:w.ids.map(question),title:w.title.trim(),variant:w.variant.trim(),grade:route.grade,level:route.level,answers:w.answers});
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
        const link=document.createElement('a');link.href=url;link.download=`1430-math-class-${route.grade}-${route.level}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        if($('pdf-status'))$('pdf-status').textContent='PDF сформирован и передан браузеру для сохранения.';
      } catch(error) {if($('pdf-status'))$('pdf-status').textContent='Не удалось создать PDF. Попробуйте обычную печать.';console.error(error);}
      finally {b.disabled=false;}
      return;
    }
    if(a==='print'){window.print();return;}
  });
  // Clear field errors as soon as the user edits, before native form validation.
  $('app').addEventListener('input',e=>{if(e.target.matches('#first-name,#last-name'))e.target.setCustomValidity('');});
  window.addEventListener('popstate',event=>{route=event.state?.mat1430?event.state.route:{view:'home',role:null,grade:null,topic:null,index:0};render(true);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&route.view!=='home'){event.preventDefault();back();}});
  history.replaceState({mat1430:true,route},'', '#home');
  render();
})();
