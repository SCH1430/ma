// Exercise the actual generated worker with CacheStorage and network failures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const config=JSON.parse(source.match(/const PWA_CONFIG = (.+);\n/)[1]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.id,'./');assert.equal(manifest.display,'standalone');
assert.deepEqual(Object.keys(config.grades),['5','6','7','8','9','10','11']);
const base='https://example.invalid/math/',absolute=ref=>new URL(ref,base).href;
for(const entry of [...config.core,...config.assets]){
  assert(absolute(entry.url).startsWith(base));assert(!entry.url.startsWith('/'));
  const bytes=fs.readFileSync(path.join(root,entry.url));
  assert.equal(bytes.length,entry.bytes,entry.url+' size');
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.url+' hash');
}
assert(!config.core.some(entry=>entry.url.startsWith('data/tasks/')),'class bank is not eagerly cached');
assert(config.core.some(entry=>entry.url==='src/pwa.js'));
const stores=new Map(),listeners={},failed=new Set(),corrupt=new Set(),requests=[];
const keyOf=value=>typeof value==='string'?value:value.url;
const caches={
 async keys(){return [...stores.keys()];},async has(name){return stores.has(name);},async delete(name){return stores.delete(name);},
 async open(name){if(!stores.has(name))stores.set(name,new Map());const values=stores.get(name);return{
  async keys(){return [...values.keys()].map(url=>new Request(url));},
  async match(value){return values.get(keyOf(value))?.clone();},
  async put(key,response){values.set(keyOf(key),response.clone());},async delete(key){return values.delete(keyOf(key));}
 };},
 async match(key,options={}){for(const name of options.cacheName?[options.cacheName]:stores.keys()){
  const response=stores.get(name)?.get(keyOf(key));if(response)return response.clone();
 }}
};
let windows=[{url:base,postMessage(){}}],skipCount=0;
const context={URL,Request,Response,Set,Map,Uint8Array,console,caches,crypto:webcrypto,
 fetch:async url=>{const ref=new URL(typeof url==='string'?url:url.url).pathname.slice('/math/'.length);requests.push(ref);
  if(failed.has(ref))throw Error('offline');
  const file=path.join(root,ref);return new Response(corrupt.has(ref)?'broken':fs.readFileSync(file),{status:200});},
 self:{registration:{scope:base},clients:{async claim(){},async matchAll(){return windows;}},
  async skipWaiting(){skipCount++;},addEventListener(type,fn){listeners[type]=fn;}}
};
vm.createContext(context);vm.runInContext(source,context);
async function dispatch(type,extra={}){let pending;listeners[type]({waitUntil(value){pending=value;},...extra});await pending;}
async function message(data){const replies=[];await dispatch('message',{data,source:{url:base},ports:[{postMessage(reply){replies.push(reply);}}]});return replies.at(-1);}
(async()=>{
 await dispatch('install');await dispatch('activate');
 assert(!requests.some(ref=>ref.startsWith('data/tasks/')),'initial install caches shell only');
 assert.equal((await message({type:'STATUS'})).data.ready,true);
 assert.equal((await message({type:'STATUS'})).data.grades.length,0);
 const gradeFile=config.grades['6'][0].url;failed.add(gradeFile);
 assert.equal((await message({type:'DOWNLOAD_GRADE',grade:6})).ok,false);
 assert(!(await message({type:'STATUS'})).data.grades.includes(6),'failed class download is never marked ready');
 failed.delete(gradeFile);corrupt.add(gradeFile);
 assert.equal((await message({type:'DOWNLOAD_GRADE',grade:6})).ok,false);
 assert(!(await message({type:'STATUS'})).data.grades.includes(6),'corrupt content is rejected');
 corrupt.delete(gradeFile);
 const extra=config.grades['7'][0].url;failed.add(extra);
 assert.equal((await message({type:'DOWNLOAD_GRADE',grade:6,extraFiles:[extra]})).ok,false);
 assert(!(await message({type:'STATUS'})).data.grades.includes(6),'workspace failure cannot mark new pack ready');
 failed.delete(extra);
 assert.equal((await message({type:'DOWNLOAD_GRADE',grade:6,extraFiles:[extra]})).ok,true);
 assert((await message({type:'STATUS'})).data.grades.includes(6));
 assert(await caches.match(absolute(extra)),'existing workspace resources accompany chosen class');
 let response;listeners.fetch({request:new Request(base+'index.html'),respondWith(value){response=value;}});
 assert((await response).ok,'cached entry page is served');
 const prefix='baza-pwa:'+encodeURIComponent('/math/')+':';
 await caches.open(prefix+'core:obsolete');await caches.open('unrelated-app');
 await dispatch('activate');assert(!await caches.has(prefix+'core:obsolete'));assert(await caches.has('unrelated-app'));
 windows.push({url:base+'index.html',postMessage(){}});
 assert.equal((await message({type:'APPLY_UPDATE'})).ok,false);assert.equal(skipCount,0);
 windows.pop();assert.equal((await message({type:'APPLY_UPDATE'})).ok,true);assert.equal(skipCount,1);
 assert.equal((await message({type:'REMOVE_GRADE',grade:6})).ok,true);
 assert(!(await message({type:'STATUS'})).data.grades.includes(6));
 // The browser may evict any cache entry; readiness must reflect that loss.
 await message({type:'DOWNLOAD_GRADE',grade:6});
 const pack=[...stores.keys()].find(name=>name.startsWith(prefix+'grade:')&&name.endsWith(':6'));
 stores.get(pack).delete(absolute(gradeFile));
 assert(!(await message({type:'STATUS'})).data.grades.includes(6),'evicted resources invalidate downloaded status');
 // A waiting build must honor selections made after its initial installation.
 await message({type:'DOWNLOAD_GRADE',grade:6});
 const newerListeners={},newer={...context,self:{...context.self,addEventListener(type,fn){newerListeners[type]=fn;}}};
 vm.createContext(newer);vm.runInContext(source.replace('"version":"'+config.version+'"','"version":"next-test-build"'),newer);
 async function newerDispatch(type,extra={}){let pending;newerListeners[type]({waitUntil(value){pending=value;},...extra});await pending;}
 async function newerMessage(data){const replies=[];await newerDispatch('message',{data,source:{url:base},ports:[{postMessage(reply){replies.push(reply);}}]});return replies.at(-1);}
 await newerDispatch('install');
 assert((await newerMessage({type:'STATUS'})).data.grades.includes(6));
 await message({type:'REMOVE_GRADE',grade:6});await message({type:'DOWNLOAD_GRADE',grade:7});
 assert.equal((await newerMessage({type:'APPLY_UPDATE'})).ok,true);
 await newerDispatch('activate');
 assert.deepEqual(Array.from((await newerMessage({type:'STATUS'})).data.grades),[7],'waiting update follows current selections and cannot resurrect a removed pack');
 assert(![...stores.keys()].some(name=>name.startsWith(prefix+'grade:'+config.version+':')),'old build packs are cleaned after activation');
 const currentCore=prefix+'core:next-test-build',evictedCore=config.core.find(entry=>entry.url==='src/app.js').url;
 stores.get(currentCore).delete(absolute(evictedCore));failed.add(evictedCore);
 assert.equal((await newerMessage({type:'STATUS'})).data.ready,false,'missing core remains truthfully unavailable offline');
 assert(stores.get(currentCore).has(absolute('index.html')),'failed repair preserves the remaining shell');
 failed.delete(evictedCore);const repairStart=requests.length;
 const repaired=await Promise.all([newerMessage({type:'STATUS'}),newerMessage({type:'STATUS'}),newerMessage({type:'DOWNLOAD_GRADE',grade:7})]);
 assert(repaired.every(reply=>reply.ok));assert(repaired[0].data.ready&&repaired[1].data.ready,'online STATUS repairs core after eviction');
 assert.equal(requests.slice(repairStart).filter(ref=>ref===evictedCore).length,1,'concurrent status and download share one core repair');
 assert.equal((await newerMessage({type:'STATUS'})).data.ready,true);
 // file:// and test harnesses do not register a worker or issue requests.
 const local={window:{addEventListener(){}},console};vm.createContext(local);vm.runInContext(fs.readFileSync(path.join(root,'src/pwa.js'),'utf8'),local);
 assert.equal(local.MathPWA.getState().localFile,true);assert.equal(local.MathPWA.getState().supported,false);
 console.log('PWA: relative manifest, hashes, shell-only install, transactional class/workspace packs, corruption, removal, eviction and selection-safe updates passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
