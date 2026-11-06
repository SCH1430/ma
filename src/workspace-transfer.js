// Portable local workspace backups. Application restore still sanitizes every record.
globalThis.MathWorkspaceTransfer = (() => {
  const FORMAT='baza-workspace-backup',VERSION=1,MAX_BYTES=24*1024*1024;
  const fields=['version','student','examLearnerId','attempts','works','migratedWorkKeys','library','favorites','builderCompetencies','builderSubtype','builderAuto','bankTools','builderContext','recoveryState','activeRun','resumeRoute','trainingSessions','savedAt','learningState','learningRun','teacherReports','selectedExamYear','topicLearningId','editorialStore','methodView','appPreferences'];
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const bytes=value=>typeof TextEncoder==='function'?new TextEncoder().encode(value).length:unescape(encodeURIComponent(value)).length;
  function workspace(raw){
    if(!object(raw)||raw.version!==2)throw Error('Нужна резервная копия рабочего места БАЗЫ версии 2.');
    for(const name of ['attempts','works','library','favorites','trainingSessions'])if(raw[name]!==undefined&&!Array.isArray(raw[name]))throw Error('Повреждён раздел «'+name+'».');
    for(const name of ['student','bankTools','builderContext','builderAuto','appPreferences'])if(raw[name]!==undefined&&!object(raw[name]))throw Error('Повреждён раздел «'+name+'».');
    if(raw.attempts?.some(pair=>!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!object(pair[1])))throw Error('Повреждены записи попыток.');
    if(raw.works?.some(pair=>!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!object(pair[1])))throw Error('Повреждены подборки.');
    if(raw.activeRun!==undefined&&raw.activeRun!==null&&!object(raw.activeRun))throw Error('Повреждено текущее прохождение.');
    const clean={};for(const key of fields)if(Object.hasOwn(raw,key))clean[key]=raw[key];
    return clean;
  }
  function create(raw,now=new Date().toISOString()){
    return {format:FORMAT,version:VERSION,createdAt:now,workspace:workspace(raw)};
  }
  function parse(text){
    if(typeof text!=='string'||bytes(text)>MAX_BYTES)throw Error('Выберите резервную копию до 24 МБ.');
    let raw;try{raw=JSON.parse(text);}catch{throw Error('Файл не является корректным JSON.');}
    if(!object(raw)||raw.format!==FORMAT||raw.version!==VERSION)throw Error('Нужен файл полной резервной копии БАЗЫ. Подборки открываются в «Моих работах».');
    return {format:FORMAT,version:VERSION,createdAt:typeof raw.createdAt==='string'?raw.createdAt.slice(0,40):'',workspace:workspace(raw.workspace)};
  }
  function summary(raw){
    const w=workspace(raw),notes=object(w.bankTools?.notes)?Object.values(w.bankTools.notes).filter(object):[];
    return {attempts:w.attempts?.length||0,collections:w.library?.length||0,currentTasks:w.activeRun?.ids?.length||0,favorites:w.favorites?.length||0,notes:notes.length,templates:Array.isArray(w.bankTools?.templates)?w.bankTools.templates.length:0,learner:[w.student?.first,w.student?.last].filter(value=>typeof value==='string').join(' ').slice(0,110),savedAt:typeof w.savedAt==='string'?w.savedAt:'',hasLearning:!!w.learningState};
  }
  function references(raw){
    const w=workspace(raw),ids=new Set(),add=id=>{if(typeof id==='string'&&id)ids.add(id);};
    for(const pair of w.attempts||[])add(pair[0].split(':').at(-1));
    for(const pair of w.works||[]){for(const id of pair[1].ids||[])add(id);add(pair[1].exampleId);}
    for(const item of w.library||[]){for(const id of item?.ids||[])add(id);add(item?.exampleId);}
    for(const id of w.favorites||[])add(id);
    for(const id of Object.keys(w.bankTools?.notes||{}))add(id);
    for(const id of w.activeRun?.ids||[])add(id);
    add(w.activeRun?.exampleId);
    for(const id of w.resumeRoute?.taskIds||[])add(id);
    for(const id of w.recoveryState?.ids||[])add(id);
    for(const event of w.learningState?.events||[])for(const result of event?.results||[])add(result?.id);
    return [...ids];
  }
  return Object.freeze({FORMAT,VERSION,MAX_BYTES,workspace,create,parse,summary,references,bytes});
})();
