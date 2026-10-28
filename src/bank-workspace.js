// Local teacher preferences, separate from student progress and source content.
globalThis.MathBankWorkspace = (() => {
  const formats={error:'Найди ошибку',methods:'Сравни способы',counterexample:'Приведи контрпример',insufficient:'Достаточно ли данных?'};
  const flags={good:'Для контрольной',ambiguous:'Неоднозначное условие',revision:'Нужна правка'};
  const difficulties=['Базовый','Средний','Повышенный','Суперсложный','Высокий'];
  const str=(value,max=1600)=>typeof value==='string'?value.slice(0,max):'';
  const count=value=>['string','number'].includes(typeof value)&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=60?Number(value):0;
  function settings(raw={}) {
    raw=raw&&typeof raw==='object'?raw:{};
    const quotas={};for(const d of difficulties)quotas[d]=count(raw.quotas?.[d]);
    return {skills:MathBankPedagogy.normalize(raw.skills),grouped:raw.grouped===true,format:typeof raw.format==='string'&&Object.hasOwn(formats,raw.format)?raw.format:'all',mode:['balanced','diverse','practice'].includes(raw.mode)?raw.mode:'balanced',familyId:str(raw.familyId,160),structured:raw.structured===true,openCount:count(raw.openCount),quotas,noteFilter:typeof raw.noteFilter==='string'&&(Object.hasOwn(flags,raw.noteFilter)||raw.noteFilter==='excluded')?raw.noteFilter:'all',excludeMarked:raw.excludeMarked!==false};
  }
  function restore(raw,catalog) {
    const ids=new Set(catalog.map(q=>q.id)),notes=Object.create(null);
    for(const [id,value] of Object.entries(raw?.notes||{}).slice(0,1000))if(ids.has(id)&&value&&typeof value==='object'){
      const note={text:str(value.text),flag:typeof value.flag==='string'&&Object.hasOwn(flags,value.flag)?value.flag:'',excluded:value.excluded===true};
      if(note.text||note.flag||note.excluded)notes[id]=note;
    }
    const templates=(Array.isArray(raw?.templates)?raw.templates:[]).slice(0,30).filter(t=>t&&typeof t.id==='string'&&typeof t.name==='string').map(t=>({id:str(t.id,80),name:str(t.name,70),settings:settings(t.settings),count:Number.isInteger(t.count)&&t.count>0&&t.count<=60?t.count:10,context:t.context&&typeof t.context==='object'?{source:str(t.context.source,100),topic:str(t.context.topic,100),subject:str(t.context.subject,100),difficulty:str(t.context.difficulty,30),search:str(t.context.search,200),subtype:str(t.context.subtype,120),competencies:Array.isArray(t.context.competencies)?t.context.competencies.filter(x=>typeof x==='string').slice(0,10):[],favoriteOnly:t.context.favoriteOnly===true,trickyOnly:t.context.trickyOnly===true}:{}}));
    return {...settings(raw),notes,templates};
  }
  function groups(tasks) {
    const grouped=new Map();
    for(const q of tasks){const key=MathBankPedagogy.familyKey(q);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(q);}
    return [...grouped].map(([key,tasks])=>({key,tasks}));
  }
  return Object.freeze({formats,flags,difficulties,settings,restore,groups});
})();
