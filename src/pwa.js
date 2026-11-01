/* Installation and verified, explicitly downloaded class packs. No account required. */
(() => {
  const win=typeof window!=='undefined'?window:globalThis;
  const nav=globalThis.navigator||{},loc=globalThis.location;
  const localFile=!loc||loc.protocol==='file:';
  const supported=!localFile&&globalThis.isSecureContext===true&&'serviceWorker' in nav&&'caches' in globalThis;
  const listeners=new Set();
  const assets=typeof ASSET_MANIFEST!=='undefined'?ASSET_MANIFEST.assets:{};
  const sharedBytes=['pdf-lib','fontkit','pdf-font'].reduce((n,key)=>n+(assets[key]?.bytes||0),0);
  const display=typeof win.matchMedia==='function'?win.matchMedia('(display-mode: standalone)'):null;
  const state={supported,localFile,ready:false,installed:!!(display?.matches||nav.standalone),canInstall:false,
    online:nav.onLine!==false,updateAvailable:false,busy:false,status:'',error:'',version:'',progress:0,downloadingGrade:null,
    installHelp:'Откройте меню браузера и выберите «Установить приложение». На iPhone и iPad: Safari → «Поделиться» → «На экран “Домой”» → «Открыть как веб-приложение», если этот переключатель доступен.',
    grades:Array.from({length:7},(_,i)=>({grade:i+5,downloaded:false,bytes:(assets['class:'+(i+5)]?.bytes||0)+sharedBytes}))};
  let registration=null,installPrompt=null,applyingUpdate=false;
  const getState=()=>({...state,grades:state.grades.map(g=>({...g}))});
  function emit(){for(const fn of listeners)try{fn(getState());}catch(error){console.error(error);}}
  const explain=error=>error?.message||'Не удалось выполнить действие. Проверьте соединение и свободное место на устройстве.';
  function workerRequest(type,payload={},target=registration?.active){
    return new Promise((resolve,reject)=>{
      if(!target){reject(Error('Подготовка приложения ещё не завершена. Попробуйте через несколько секунд.'));return;}
      const channel=new MessageChannel();let timer;
      const finish=(error,value)=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve(value);};
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('Загрузка не завершилась. Проверьте соединение и повторите попытку.')),120000);};
      channel.port1.onmessage=event=>{
        const reply=event.data||{};
        if(reply.progress!==undefined){state.progress=reply.progress;state.status=reply.status||state.status;emit();arm();return;}
        reply.ok?finish(null,reply.data):finish(Error(reply.error||'Не удалось обновить материалы на устройстве.'));
      };
      arm();target.postMessage({type,...payload},[channel.port2]);
    });
  }
  async function refresh(){
    if(!registration?.active)return;
    try{
      const result=await workerRequest('STATUS');
      state.version=result.version;
      state.ready=result.ready;
      state.grades=state.grades.map(grade=>({...grade,downloaded:result.grades.includes(grade.grade)}));
      state.updateAvailable=!!registration.waiting;
      emit();
    }catch(error){state.error=explain(error);emit();}
  }
  async function operate(type,grade){
    if(state.busy)throw Error('Дождитесь завершения текущей загрузки.');
    if(!Number.isInteger(grade)||grade<5||grade>11)throw Error('Выберите класс с 5 по 11.');
    if(!supported||!state.ready)throw Error(localFile?'Для установки и загрузки материалов откройте опубликованный сайт. Эта папка уже работает без интернета.':'Браузер пока не подготовил приложение для работы без интернета.');
    state.busy=true;state.error='';state.progress=0;state.downloadingGrade=grade;
    state.status=type==='DOWNLOAD_GRADE'?`Загружаем ${grade} класс…`:`Удаляем материалы ${grade} класса…`;emit();
    try{
      let extraFiles=[];
      if(type==='DOWNLOAD_GRADE')try{
        const saved=JSON.parse(globalThis.localStorage?.getItem('mat1430.workspace.v2')||'null');
        extraFiles=(globalThis.MathDataLoader?.workspaceKeys(saved)||[]).map(key=>assets[key]?.file).filter(Boolean);
      }catch(error){/* An unreadable workspace is kept intact by the application. */}
      const result=await workerRequest(type,{grade,extraFiles});
      await refresh();
      state.status=type==='DOWNLOAD_GRADE'?`${grade} класс доступен без интернета.`:`Материалы ${grade} класса удалены. Прогресс сохранён.`;
      if(type==='DOWNLOAD_GRADE')try{await nav.storage?.persist?.();}catch(error){/* Persistence is optional. */}
      return result;
    }catch(error){state.error=explain(error);state.status='';await refresh();throw error;}
    finally{state.busy=false;state.downloadingGrade=null;emit();}
  }
  async function install(){
    state.error='';
    if(state.installed)return {installed:true};
    if(!installPrompt){state.status=state.installHelp;emit();return {instructions:state.installHelp};}
    const prompt=installPrompt;installPrompt=null;state.canInstall=false;emit();
    await prompt.prompt();const result=await prompt.userChoice;
    state.status=result.outcome==='accepted'?'Установка подтверждена.':'Установку можно выполнить позже.';emit();return result;
  }
  async function applyUpdate(){
    if(state.busy)throw Error('Дождитесь завершения загрузки материалов.');
    if(!registration?.waiting)throw Error('Новая версия пока не готова.');
    applyingUpdate=true;state.busy=true;state.error='';state.status='Подготавливаем обновление…';emit();
    try{await workerRequest('APPLY_UPDATE',{},registration.waiting);}
    catch(error){applyingUpdate=false;state.busy=false;state.error=explain(error);emit();throw error;}
  }
  globalThis.MathPWA=Object.freeze({getState,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    downloadGrade:grade=>operate('DOWNLOAD_GRADE',Number(grade)),removeGrade:grade=>operate('REMOVE_GRADE',Number(grade)),install,applyUpdate});
  win.addEventListener?.('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;state.canInstall=true;emit();});
  win.addEventListener?.('appinstalled',()=>{state.installed=true;state.canInstall=false;installPrompt=null;state.status='Приложение установлено.';emit();});
  display?.addEventListener?.('change',()=>{state.installed=display.matches||!!nav.standalone;emit();});
  win.addEventListener?.('online',()=>{state.online=true;emit();refresh();registration?.update().catch(()=>{});});
  win.addEventListener?.('offline',()=>{state.online=false;emit();});
  if(!supported){state.status=localFile?'Папка проекта работает без интернета. Для установки приложения откройте сайт по HTTPS.':'Установка и загрузка без интернета доступны в поддерживающем браузере по HTTPS.';return;}
  nav.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)loc.reload();else refresh();});
  nav.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='PACKS_CHANGED')refresh();});
  (async()=>{
    try{
      registration=await nav.serviceWorker.register(new URL('../service-worker.js',document.currentScript?.src||new URL('src/pwa.js',document.baseURI)).href,{scope:new URL('./',document.baseURI).href,updateViaCache:'none'});
      const watch=worker=>worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'){state.updateAvailable=!!registration.waiting;emit();}
        if(worker.state==='activated')refresh();
      });
      registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);
      if(registration.active)await refresh();
      else{await nav.serviceWorker.ready;await refresh();}
    }catch(error){state.error='Не удалось подготовить приложение: '+explain(error);state.ready=false;emit();}
  })();
})();
