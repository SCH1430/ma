// Exercise the exact startup script list with a local classic-script transport.
// Full-bank harnesses intentionally hydrate content; these checks must not.
const assert=require('node:assert/strict'),vm=require('node:vm');
const page=require('./load_page.cjs').loadPage();
const {createHarness,KEY}=require('./validate_ui_state.cjs');
const data=page.dataValues(),first=grade=>data.BANK.find(t=>t.grade===grade).tasks[0].id;
const value=(h,code)=>vm.runInContext(code,h.context);
const settle=async h=>{await h.settleAssets();await Promise.resolve();};
(async()=>{
 const h=createHarness(new Map(),{initialPage:true});
 assert.deepEqual(h.scriptLoads,[],'an empty workspace opens without a content script');
 assert.equal(value(h,'BANK.length'),0);assert.equal(value(h,'EXAM_BANK.length'),0);
 assert.equal(value(h,'typeof FONT_BASE64'),'undefined');assert.equal(value(h,'typeof PDFLib'),'undefined');
 await h.click('[data-role="teacher"]');
 await h.click('[data-action="nav-catalog"]');
 assert(h.text().includes('33 темы'),'class cards use manifest counts before loading tasks');
 await h.click('[data-action="grade"][data-grade="6"]');await settle(h);
 assert.deepEqual(h.scriptLoads,['data/tasks/grade_06.js']);
 assert(value(h,'BANK.every(t=>t.grade===6)'));assert.equal(value(h,'EXAM_BANK.length'),0);
 assert.equal(value(h,'SDAMGIA_BANK.tasks.length'),0);
 h.history.back();await settle(h);
 await h.click('[data-action="subtype-catalog"]');await settle(h);
 assert.equal(h.scriptLoads.length,1,'subtype descriptions are available without source images');
 const subtype=data.SDAMGIA_BANK.subtypes[0],asset=page.manifest.assets['subtype:'+subtype.id];
 await h.click(`[data-action="subtype-practice"][data-subtype="${subtype.id}"]`);await settle(h);
 assert.deepEqual(h.scriptLoads,['data/tasks/grade_06.js',asset.file]);
 assert.equal(h.state().activeRun.ids.length,asset.ids.length);
 assert.equal(value(h,'typeof PDFLib'),'undefined','practice does not load PDF dependencies');
 await value(h,'MathDataLoader.ensurePDF()');await settle(h);
 assert(h.scriptLoads.includes('src/vendor/pdf-lib.min.js'));assert(h.scriptLoads.includes('src/vendor/fontkit.umd.min.js'));assert(h.scriptLoads.includes('data/font.js'));
 assert.equal(value(h,'typeof PDFLib.PDFDocument.create'),'function');
 const before=h.scriptLoads.length;await value(h,'MathDataLoader.ensurePDF()');assert.equal(h.scriptLoads.length,before,'already loaded files are reused');
 await value(h,'MathDataLoader.load("class:5")');
 assert.deepEqual(JSON.parse(value(h,'JSON.stringify(BANK.map(topic=>topic.id))')),data.BANK.filter(topic=>[5,6].includes(topic.grade)).map(topic=>topic.id),'class catalog order is independent of loading history');
 const late=data.SDAMGIA_BANK.subtypes.slice(-2).reverse();
 for(const item of late)await value(h,`MathDataLoader.load(${JSON.stringify('subtype:'+item.id)})`);
 const retained=new Set([subtype.id,...late.map(item=>item.id)]);
 assert.deepEqual(JSON.parse(value(h,'JSON.stringify(SDAMGIA_BANK.tasks.map(task=>task.id))')),data.SDAMGIA_BANK.tasks.filter(task=>retained.has(task.subtypeId)).map(task=>task.id),'subtype loading order cannot change the canonical candidate order');

 const raw={version:2,works:[['unified',{ids:[first(5)],title:'Работа',variant:'1'}]],library:[{id:'saved-6',ids:[first(6)],title:'Сохранённая',variant:'1'}],attempts:[['teacher:'+first(7),{draft:'17',tries:1}]],favorites:[first(8)],bankTools:{notes:{[first(9)]:{text:'Проверить'}}},activeRun:{version:1,id:'saved-run',ids:[first(10)],records:{},phase:'solving'},resumeRoute:{role:'teacher',view:'topics',grade:11,level:'basic'}};
 const original=JSON.stringify(raw),store=new Map([[KEY,original]]),restored=createHarness(store,{initialPage:true});
 restored.pagehide();assert.equal(store.get(KEY),original,'pending bootstrap cannot overwrite the workspace');
 await settle(restored);
 assert.deepEqual(restored.scriptLoads.sort(),Array.from({length:7},(_,i)=>`data/tasks/grade_${String(i+5).padStart(2,'0')}.js`).sort());
 const saved=restored.state();
 assert(saved.works.find(([key])=>key==='unified')[1].ids.includes(first(5)));
 assert(saved.library[0].ids.includes(first(6)));assert(saved.attempts.some(([key])=>key==='teacher:'+first(7)));
 assert(saved.favorites.includes(first(8)));assert.equal(saved.bankTools.notes[first(9)].text,'Проверить');
 assert(saved.activeRun.ids.includes(first(10)));assert.equal(saved.resumeRoute.grade,11);
 assert(!restored.scriptLoads.some(file=>file.includes('exams')||file.includes('sdamgia')||file.includes('vendor')));

 const filterStore=new Map([[KEY,JSON.stringify({version:2,builderContext:{source:'class:7:basic',topic:'7-01'},resumeRoute:{view:'builder',role:'teacher'}})]]);
 const filtered=createHarness(filterStore,{initialPage:true});await settle(filtered);
 assert.deepEqual(filtered.scriptLoads,['data/tasks/grade_07.js']);
 assert.equal(filtered.state().builderContext.source,'class:7:basic');assert.equal(filtered.state().builderContext.topic,'7-01');

 const failFile='data/tasks/grade_05.js',failedScripts=new Set([failFile]);
 const singleRaw=JSON.stringify({version:2,works:[['unified',{ids:[first(5)]}]]}),failedStore=new Map([[KEY,singleRaw]]);
 const failed=createHarness(failedStore,{initialPage:true,failedScripts});failed.context.console={...console,error(){}};await settle(failed);failed.pagehide();
 assert.equal(failedStore.get(KEY),singleRaw,'a missing local asset leaves the original saved workspace intact');
 failedScripts.delete(failFile);await value(failed,'MathDataLoader.load("class:5")');
 assert.equal(value(failed,'BANK[0].grade'),5,'a failed file can be retried');
 const loadedCount=failed.scriptLoads.length;
 await Promise.all([value(failed,'MathDataLoader.load("class:6")'),value(failed,'MathDataLoader.load("class:6")')]);
 assert.equal(failed.scriptLoads.length,loadedCount+1,'concurrent requests share one script');
 assert(page.scripts.reduce((n,s)=>n+Buffer.byteLength(s.code),0)<2*1024*1024);
 console.log('Lazy loading: empty boot, one class, one subtype, PDF on demand, complete workspace restore, failure preservation and retry passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
