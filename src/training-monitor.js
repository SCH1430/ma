// Fullscreen and a bounded, device-local activity journal for student practice.
globalThis.MathTrainingMonitor = (() => {
  const labels={started:'Тренажёр открыт',fullscreen_enter:'Полный экран включён',fullscreen_exit:'Выход из полного экрана',fullscreen_unavailable:'Полный экран недоступен',hidden:'Вкладка скрыта',visible:'Возврат во вкладку',closed:'Тренажёр закрыт',completed:'Работа завершена',page_left:'Страница закрыта или перезагружена',interrupted:'Предыдущее занятие прервано; точное время закрытия неизвестно'};
  const now=()=>new Date().toISOString();
  const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
  const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  function sanitize(raw){
    return (Array.isArray(raw)?raw:[]).slice(-50).filter(s=>s&&['topic','exam','work'].includes(s.kind)&&date(s.startedAt)).map(s=>({
      id:text(s.id,80),kind:s.kind,ref:text(s.ref,100),title:text(s.title,150),grade:Number.isInteger(s.grade)&&s.grade>=5&&s.grade<=11?s.grade:null,
      startedAt:date(s.startedAt),endedAt:date(s.endedAt),
      events:(Array.isArray(s.events)?s.events:[]).slice(-100).filter(e=>e&&Object.hasOwn(labels,e.type)&&date(e.at)).map(e=>({type:e.type,at:date(e.at)}))
    }));
  }
  function create({onChange=()=>{}}={}){
    let sessions=[],current=null,fullscreen=false,pending=false,unavailable=false,hidden=false,requestVersion=0;
    const root=()=>document.documentElement;
    const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
    const isFullscreen=()=>!!root()&&fullscreenElement()===root();
    const add=(session,type)=>{session.events.push({type,at:now()});session.events=session.events.slice(-100);};
    function leaveFullscreen(){
      if(!isFullscreen())return;
      try{Promise.resolve((document.exitFullscreen||document.webkitExitFullscreen)?.call(document)).catch(()=>{});}catch(error){}
    }
    function changed(){onChange();}
    function nativeChange(){
      if(!current)return;
      const next=isFullscreen();
      if(next===fullscreen)return;
      fullscreen=next;pending=false;unavailable=false;
      add(current,next?'fullscreen_enter':'fullscreen_exit');changed();
    }
    function request(){
      if(!current||pending)return;
      if(isFullscreen()){nativeChange();return;}
      const session=current,version=++requestVersion;
      const failed=()=>{
        if(version!==requestVersion||current!==session)return;
        pending=false;unavailable=true;add(session,'fullscreen_unavailable');changed();
      };
      const enter=root()?.requestFullscreen||root()?.webkitRequestFullscreen;
      if(!enter){failed();return;}
      pending=true;unavailable=false;changed();
      // Call synchronously from the launch/continue click to retain user activation.
      try{
        Promise.resolve(enter.call(root())).then(()=>{
          if(version!==requestVersion||current!==session){if(!current)leaveFullscreen();return;}
          pending=false;
          if(isFullscreen())nativeChange();else failed();
          changed();
        },failed);
      }catch(error){failed();}
    }
    function stop(reason='closed',release=true){
      if(!current)return;
      current.endedAt=now();add(current,reason);current=null;
      ++requestVersion;pending=false;fullscreen=false;unavailable=false;
      if(release)leaveFullscreen();changed();
    }
    function sync(context,reason='closed'){
      if(current&&context&&current.kind===context.kind&&current.ref===context.ref)return;
      stop(reason,!context);
      if(!context)return;
      current={...context,id:globalThis.crypto?.randomUUID?.()||'training-'+Date.now().toString(36),startedAt:now(),endedAt:'',events:[]};
      sessions.push(current);sessions=sessions.slice(-50);fullscreen=false;hidden=document.visibilityState==='hidden';
      add(current,'started');changed();request();
    }
    function restore(raw){
      sessions=sanitize(raw);
      // A browser/process crash may skip pagehide. Do not invent its close time.
      for(const session of sessions)if(!session.endedAt){session.endedAt=now();add(session,'interrupted');}
    }
    document.addEventListener('fullscreenchange',nativeChange);
    document.addEventListener('webkitfullscreenchange',nativeChange);
    document.addEventListener('visibilitychange',()=>{
      if(!current)return;
      const next=document.visibilityState==='hidden';if(next===hidden)return;
      hidden=next;add(current,next?'hidden':'visible');changed();
    });
    window.addEventListener('pagehide',()=>stop('page_left',false));
    return {restore,sync,stop,request,snapshot:()=>sessions,state:()=>({current,fullscreen,pending,unavailable}),labels};
  }
  return {create,sanitize,labels};
})();
