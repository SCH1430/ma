// Classic script loading supports both an offline folder and GitHub Pages.
// Only manifest-owned relative paths can be requested, never imported JSON URLs.
globalThis.MathDataLoader = (() => {
  if(typeof ASSET_MANIFEST==='undefined')return null;
  const manifest=ASSET_MANIFEST,assets=manifest.assets,loaded=new Set(),pending=new Map(),byId=new Map();
  for(const [key,asset] of Object.entries(assets))for(const id of asset.ids||[])byId.set(id,key);
  const topicOrder=new Map(manifest.topics.map((topic,index)=>[topic.id,index])),examOrder=new Map(manifest.exams.map((exam,index)=>[exam.id,index]));
  const taskOrder=new Map(Object.values(assets).flatMap(asset=>asset.ids||[]).map((id,index)=>[id,index]));
  function canonicalize(){
    BANK.sort((a,b)=>topicOrder.get(a.id)-topicOrder.get(b.id));
    EXAM_BANK.sort((a,b)=>examOrder.get(a.id)-examOrder.get(b.id));
    SDAMGIA_BANK.tasks.sort((a,b)=>taskOrder.get(a.id)-taskOrder.get(b.id));
  }
  function present(key){
    if(key.startsWith('class:'))return BANK.some(t=>t.grade===Number(key.slice(6)));
    if(key.startsWith('exam:'))return EXAM_BANK.some(e=>e.id===key.slice(5));
    if(key.startsWith('subtype:'))return (assets[key].ids||[]).every(id=>SDAMGIA_BANK.tasks.some(q=>q.id===id));
    if(key==='enrichment')return typeof THINKING_BANK!=='undefined'&&THINKING_BANK.tasks.length>0;
    if(key==='quality')return typeof QUALITY_BANK!=='undefined'&&QUALITY_BANK.tasks.length>0;
    if(key==='methods')return typeof METHOD_BANK!=='undefined'&&METHOD_BANK.tasks.length>0;
    if(key==='pdf-lib')return typeof PDFLib!=='undefined';
    if(key==='fontkit')return typeof fontkit!=='undefined';
    if(key==='pdf-font')return typeof FONT_BASE64!=='undefined';
    return false;
  }
  const has=key=>loaded.has(key)||present(key);
  function load(key){
    const asset=assets[key];if(!asset)return Promise.reject(Error('Unknown local asset: '+key));
    if(has(key)){loaded.add(key);return Promise.resolve();}
    if(pending.has(key))return pending.get(key);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=asset.file;script.async=false;
      script.dataset.lazyAsset=key;
      script.onload=()=>{pending.delete(key);if(!present(key)){script.remove();reject(Error('Invalid local asset: '+key));return;}canonicalize();loaded.add(key);resolve();};
      script.onerror=()=>{pending.delete(key);script.remove();reject(Error('Cannot load local asset: '+key));};
      (document.head||document.body).append(script);
    });
    pending.set(key,promise);return promise;
  }
  const contentKeys=()=>Object.keys(assets).filter(key=>!['pdf-lib','fontkit','pdf-font'].includes(key));
  function sourceKeys(source='all'){
    if(source==='all')return contentKeys();
    if(source==='classes')return contentKeys().filter(key=>key.startsWith('class:'));
    if(source.startsWith('class:')){const key=source.split(':').slice(0,2).join(':');return assets[key]?[key]:[];}
    if(source==='sdamgia')return contentKeys().filter(key=>key.startsWith('subtype:'));
    if(source.startsWith('sdamgia:'))return contentKeys().filter(key=>key.startsWith('subtype:')&&assets[key].exam===source.slice(8));
    return assets[source]?[source]:[];
  }
  const idsKeys=ids=>[...new Set((Array.isArray(ids)?ids:[]).map(id=>byId.get(id)).filter(Boolean))];
  function workspaceKeys(raw){
    const keys=new Set(),seen=new WeakSet();
    function visit(value,depth=0){
      if(depth>25)return;
      if(typeof value==='string'){
        const key=byId.get(value)||byId.get(value.split(':').at(-1));if(key)keys.add(key);
      }else if(value&&typeof value==='object'){
        if(seen.has(value))return;seen.add(value);
        if(Array.isArray(value))for(const item of value)visit(item,depth+1);
        else for(const [key,item] of Object.entries(value)){visit(key,depth+1);visit(item,depth+1);}
      }
    }
    visit(raw);
    const route=raw?.resumeRoute;
    if(route?.grade&&assets['class:'+route.grade])keys.add('class:'+route.grade);
    if(route?.examId&&assets['exam:'+route.examId])keys.add('exam:'+route.examId);
    if(['method-bank','editorial'].includes(route?.view)&&assets.methods)keys.add('methods');
    // Context restoration validates class sources and topic IDs against BANK.
    // Loading only an explicit class keeps saved filters valid without turning
    // a default "all" source in every student's workspace into an eager boot.
    const context=raw?.builderContext;
    if(typeof context?.source==='string'&&context.source.startsWith('class:'))for(const key of sourceKeys(context.source))keys.add(key);
    const topic=manifest.topics.find(item=>item.id===context?.topic);
    if(topic&&assets['class:'+topic.grade])keys.add('class:'+topic.grade);
    return [...keys];
  }
  function routeKeys(route,source='all'){
    if(['method-bank','editorial'].includes(route.view)&&assets.methods)return ['methods'];
    if(route.view==='builder')return sourceKeys(source);
    if(route.view==='help')return contentKeys();
    if(route.view==='exam')return assets['exam:'+route.examId]?['exam:'+route.examId]:[];
    if(['levels','profile','topics','train','result','learning'].includes(route.view)&&assets['class:'+route.grade])return ['class:'+route.grade];
    return [];
  }
  const ensure=keys=>Promise.all([...new Set(keys)].map(load));
  return Object.freeze({manifest,has,load,sourceKeys,routeKeys,workspaceKeys,idsKeys,
    needsRoute:(route,source)=>routeKeys(route,source).some(key=>!has(key)),
    needsWorkspace:raw=>workspaceKeys(raw).some(key=>!has(key)),
    ensureSource:source=>ensure(sourceKeys(source)),ensureRoute:(route,source)=>ensure(routeKeys(route,source)),
    ensureIds:ids=>ensure(idsKeys(ids)),ensureWorkspace:raw=>ensure(workspaceKeys(raw)),
    ensureAll:()=>ensure(contentKeys()),ensurePDF:async()=>{await load('pdf-lib');await load('fontkit');await load('pdf-font');},
    snapshot:()=>({loaded:Object.keys(assets).filter(has),pending:[...pending.keys()]})});
})();
