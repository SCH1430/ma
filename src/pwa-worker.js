/* PWA_CONFIG is embedded by scripts/pwa_assets.py; this template is not served. */
'use strict';
const ROOT_URL=new URL('./',self.registration.scope);
const PREFIX='baza-pwa:'+encodeURIComponent(ROOT_URL.pathname)+':';
const CORE=PREFIX+'core:'+PWA_CONFIG.version;
const SHARED=PREFIX+'pdf:'+PWA_CONFIG.version;
const RUNTIME=PREFIX+'workspace:'+PWA_CONFIG.version;
const META=PREFIX+'state';
const packName=grade=>PREFIX+'grade:'+PWA_CONFIG.version+':'+grade;
const absolute=file=>new URL(file,ROOT_URL).href;
const MARKER=absolute('__pwa-pack-ready');
const SELECTION=absolute('__pwa-selected-classes');
const busy=new Set();
let coreRepair=null;
const allEntries=[...PWA_CONFIG.core,...PWA_CONFIG.assets];
const byUrl=new Map(allEntries.map(entry=>[absolute(entry.url),entry]));
const known=new Set(allEntries.map(entry=>absolute(entry.url)));
async function complete(name,entries){
  if(!await caches.has(name))return false;
  const cache=await caches.open(name),keys=new Set((await cache.keys()).map(request=>request.url));
  return keys.has(MARKER)&&entries.every(entry=>keys.has(absolute(entry.url)));
}
async function verifiedResponse(entry){
  async function validate(response){
    if(!response?.ok||response.type==='opaque')return false;
    const buffer=await response.clone().arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),byte=>byte.toString(16).padStart(2,'0')).join('');
    return buffer.byteLength===entry.bytes&&digest===entry.sha256;
  }
  let response,error;
  try{response=await fetch(absolute(entry.url),{cache:'no-store',credentials:'same-origin'});}catch(problem){error=problem;}
  if(await validate(response))return response;
  // An unchanged, hash-verified file can be reused across builds even offline.
  for(const name of await caches.keys())if(name.startsWith(PREFIX)){
    const cached=await (await caches.open(name)).match(absolute(entry.url));if(await validate(cached))return cached;
  }
  if(error)throw error;
  throw Error('Материалы сайта обновляются. Повторите загрузку через минуту.');
}
async function cachePack(name,entries,onProgress=()=>{}){
  if(await complete(name,entries)){onProgress(entries.length);return;}
  await caches.delete(name);const cache=await caches.open(name);
  try{
    let count=0;
    for(const entry of entries){await cache.put(absolute(entry.url),await verifiedResponse(entry));onProgress(++count);}
    await cache.put(MARKER,new Response('ready'));
    if(!await complete(name,entries))throw Error('Браузер не сохранил все материалы. Освободите место и повторите загрузку.');
  }catch(error){await caches.delete(name);throw error;}
}
async function ensureCore(){
  if(await complete(CORE,PWA_CONFIG.core))return true;
  if(!coreRepair)coreRepair=(async()=>{
    const cache=await caches.open(CORE);
    // Preserve the remaining verified shell files while offline; repair only gaps.
    for(const entry of PWA_CONFIG.core)if(!await cache.match(absolute(entry.url)))await cache.put(absolute(entry.url),await verifiedResponse(entry));
    await cache.put(MARKER,new Response('ready'));
    if(!await complete(CORE,PWA_CONFIG.core))throw Error('Не удалось восстановить приложение на устройстве.');
    return true;
  })().finally(()=>{coreRepair=null;});
  return coreRepair;
}
async function savedGrades(){
  const ready=await complete(CORE,PWA_CONFIG.core)&&await complete(SHARED,PWA_CONFIG.shared);
  if(!ready)return [];
  const grades=[];
  for(const grade of Object.keys(PWA_CONFIG.grades))if(await complete(packName(grade),PWA_CONFIG.grades[grade]))grades.push(Number(grade));
  return grades;
}
async function selectedGrades(){
  const cache=await caches.open(META),saved=await cache.match(SELECTION);
  if(saved)try{return (await saved.json()).filter(grade=>Number.isInteger(grade)&&PWA_CONFIG.grades[grade]);}catch(error){/* Recover from completed packs. */}
  const selected=new Set();
  for(const name of await caches.keys())if(name.startsWith(PREFIX+'grade:')){
    const grade=Number(name.split(':').at(-1));if(PWA_CONFIG.grades[grade]&&await (await caches.open(name)).match(MARKER))selected.add(grade);
  }
  return [...selected];
}
async function setSelected(grades){await (await caches.open(META)).put(SELECTION,new Response(JSON.stringify([...new Set(grades)].sort((a,b)=>a-b))));}
async function prepareSelected(){
  const selected=await selectedGrades();
  if(selected.length){await cachePack(SHARED,PWA_CONFIG.shared);for(const grade of selected)await cachePack(packName(grade),PWA_CONFIG.grades[grade]);}
  for(const grade of Object.keys(PWA_CONFIG.grades))if(!selected.includes(Number(grade)))await caches.delete(packName(grade));
  const runtime=await caches.open(RUNTIME),needed=new Set();
  for(const name of await caches.keys())if(name.startsWith(PREFIX+'workspace:')&&name!==RUNTIME){
    for(const request of await (await caches.open(name)).keys())if(byUrl.has(request.url))needed.add(request.url);
  }
  for(const url of needed)if(!await runtime.match(url))await runtime.put(url,await verifiedResponse(byUrl.get(url)));
}
async function notify(){for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(ROOT_URL.href))client.postMessage({type:'PACKS_CHANGED'});}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  await ensureCore();
  // Keep each previously selected class available when the user accepts an update.
  await setSelected(await selectedGrades());await prepareSelected();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Old controlled windows are excluded by APPLY_UPDATE. No automatic replacement.
  await self.clients.claim();
  // Selection may have changed while this version waited for the old windows.
  await prepareSelected();
  const keep=new Set([CORE,SHARED,RUNTIME,META,...Object.keys(PWA_CONFIG.grades).map(packName)]);
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&!keep.has(name))await caches.delete(name);
  await notify();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==ROOT_URL.origin||!url.pathname.startsWith(ROOT_URL.pathname))return;
  const navigation=event.request.mode==='navigate'&&(url.pathname===ROOT_URL.pathname||url.pathname===new URL('index.html',ROOT_URL).pathname);
  const target=navigation?absolute('index.html'):url.href;
  if(!navigation&&!known.has(target))return;
  event.respondWith((async()=>{
    const core=await caches.open(CORE),shell=await core.match(target);if(shell)return shell;
    if(PWA_CONFIG.shared.some(entry=>absolute(entry.url)===target)){
      const shared=await caches.open(SHARED),response=await shared.match(target);if(response)return response;
    }
    for(const [grade,entries] of Object.entries(PWA_CONFIG.grades))if(entries.some(entry=>absolute(entry.url)===target)){
      if(await caches.has(packName(grade))){const cache=await caches.open(packName(grade)),response=await cache.match(target);if(response)return response;}
    }
    const runtime=await caches.open(RUNTIME),cached=await runtime.match(target);if(cached)return cached;
    const response=await verifiedResponse(byUrl.get(target));
    try{await runtime.put(target,response.clone());}catch(error){/* Online work must remain available if optional caching is full. */}return response;
  })());
});
self.addEventListener('message',event=>{
  const port=event.ports?.[0],message=event.data||{};
  if(!port||!event.source?.url?.startsWith(ROOT_URL.href))return;
  const reply=data=>port.postMessage(data);
  event.waitUntil((async()=>{
    let discardPack=false;
    try{
      if(message.type==='STATUS'){
        let ready=false;try{ready=await ensureCore();}catch(error){/* Missing files remain unavailable until a successful retry online. */}
        reply({ok:true,data:{version:PWA_CONFIG.version,ready,grades:await savedGrades()}});return;
      }
      if(message.type==='APPLY_UPDATE'){
        const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url.startsWith(ROOT_URL.href));
        if(windows.length>1)throw Error('Перед обновлением закройте остальные вкладки и окна БАЗЫ. Занятия и черновики сохранятся.');
        reply({progress:0,status:'Подготавливаем обновлённые материалы…'});
        await prepareSelected();
        reply({ok:true,data:{updating:true}});await self.skipWaiting();return;
      }
      const grade=Number(message.grade);
      if(!Number.isInteger(grade)||!PWA_CONFIG.grades[grade])throw Error('Неизвестный класс.');
      if(busy.size)throw Error('В другом окне уже выполняется загрузка. Дождитесь её завершения.');
      busy.add(grade);
      try{
        if(message.type==='DOWNLOAD_GRADE'){
          discardPack=!(await savedGrades()).includes(grade);
          await ensureCore();
          const total=PWA_CONFIG.shared.length+PWA_CONFIG.grades[grade].length;
          await cachePack(SHARED,PWA_CONFIG.shared,count=>reply({progress:Math.round(count/total*100),status:'Сохраняем средства PDF…'}));
          await cachePack(packName(grade),PWA_CONFIG.grades[grade],count=>reply({progress:Math.round((PWA_CONFIG.shared.length+count)/total*100),status:`Сохраняем ${grade} класс…`}));
          const runtime=await caches.open(RUNTIME);
          const extra=[...new Set(Array.isArray(message.extraFiles)?message.extraFiles:[])].map(file=>byUrl.get(absolute(file))).filter(Boolean);
          let saved=0;
          for(const entry of extra){
            const url=absolute(entry.url);
            if(!await runtime.match(url)&&!await caches.match(url,{cacheName:CORE})&&!await caches.match(url,{cacheName:SHARED})&&!await caches.match(url,{cacheName:packName(grade)}))await runtime.put(url,await verifiedResponse(entry));
            reply({progress:100,status:`Сохраняем рабочее место: ${++saved} из ${extra.length}…`});
          }
          if(!(await savedGrades()).includes(grade))throw Error('Не все материалы сохранены. Повторите загрузку.');
          await setSelected([...(await selectedGrades()),grade]);
        }else if(message.type==='REMOVE_GRADE'){
          await caches.delete(packName(grade));
          const runtime=await caches.open(RUNTIME);
          for(const entry of PWA_CONFIG.grades[grade])await runtime.delete(absolute(entry.url));
          await setSelected((await selectedGrades()).filter(value=>value!==grade));
          if(!(await savedGrades()).length)await caches.delete(SHARED);
        }else throw Error('Неизвестное действие.');
      }finally{busy.delete(grade);}
      reply({ok:true,data:{grade}});await notify();
    }catch(error){
      if(discardPack)await caches.delete(packName(Number(message.grade)));
      reply({ok:false,error:error.name==='QuotaExceededError'?'На устройстве недостаточно свободного места. Удалите ненужные материалы и повторите загрузку.':error.message||'Не удалось сохранить материалы.'});
    }
  })());
});
