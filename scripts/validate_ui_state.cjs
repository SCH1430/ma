// Integration checks execute the real app IIFE against a small DOM/event model.
// This checks application state and generated markup, not layout or browser QA.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const page=require('./load_page.cjs').loadPage(root);
const {BANK,EXAM_BANK,COMPETENCY_DATA,EXAM_DIFFICULTY_DATA,BANK_STATS}=page.dataValues();
// The UI scenarios can substitute PDF capture while still using deployed app scripts.
const source=page.runtimeCode({exclude:['src/pdf.js']});
const KEY='mat1430.workspace.v2';
let generatedIdentity=0;
const decode=value=>String(value).replace(/&(?:amp|lt|gt|quot|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[s]));

class Element {
 constructor(tag,document,attributes={}){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.attributes={...attributes};this.children=[];this.parentElement=null;this.listeners={};this.value=attributes.value||'';this.checked='checked' in attributes;this.hidden='hidden' in attributes;this.files=[];this.selectionStart=0;this.selectionEnd=0;this.customValidity='';}
 get id(){return this.attributes.id||'';}set id(value){this.attributes.id=value;}
 get disabled(){return 'disabled' in this.attributes;}set disabled(value){if(value)this.attributes.disabled='';else delete this.attributes.disabled;}
 get dataset(){return Object.fromEntries(Object.entries(this.attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));}
 get classList(){return {contains:name=>(this.attributes.class||'').split(/\s+/).includes(name),add:(...names)=>{this.attributes.class=[...new Set([...(this.attributes.class||'').split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.attributes.class=(this.attributes.class||'').split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle:(name,force)=>{const present=this.classList.contains(name),next=force===undefined?!present:!!force;if(next)this.classList.add(name);else this.classList.remove(name);return next;}};}
 setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}removeAttribute(name){delete this.attributes[name];}hasAttribute(name){return name in this.attributes;}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
 set innerHTML(html){this._html=String(html);this.children=[];parseHTML(this._html,this);}
 get innerHTML(){return this._html||'';}
 set textContent(text){this._text=String(text);this.children=[];}
 get textContent(){return this._text!==undefined?this._text:this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
 matches(selector){return selector.split(',').some(part=>matchesSelector(this,part.trim()));}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 contains(node){for(let current=node;current;current=current.parentElement)if(current===this)return true;return false;}
 querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(typeof child==='string')continue;if(child.matches(selector))result.push(child);visit(child);}};visit(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
 focus(){this.ownerDocument.activeElement=this;}
 scrollIntoView(){}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 setCustomValidity(message){this.customValidity=message;}
 reportValidity(){return this.querySelectorAll('input,textarea,select').every(e=>!e.customValidity&&(!e.hasAttribute('required')||e.value!=='')&&(!e.attributes.pattern||new RegExp('^(?:'+e.attributes.pattern+')$').test(e.value)));}
 click(){if(this.tagName==='A'&&this.download){this.ownerDocument.downloads.push({name:this.download,url:this.href});return;}if(this.tagName==='INPUT'&&this.attributes.type==='file'){this.ownerDocument.filePickerOpened=true;return;}return this.ownerDocument.dispatch('click',this);}
}
function matchesSelector(node,selector){
 const parts=selector.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g)||[];
 if(!matchesSimple(node,parts.pop()))return false;
 for(let index=parts.length-1;index>=0;index--){let parent=node.parentElement;while(parent&&!matchesSimple(parent,parts[index]))parent=parent.parentElement;if(!parent)return false;node=parent;}
 return true;
}
function matchesSimple(node,selector){
 if(!selector)return false;
 for(const match of selector.matchAll(/:not\(([^()]*)\)/g))if(node.matches(match[1]))return false;
 selector=selector.replace(/:not\([^()]*\)/g,'');
 if(selector.includes(':disabled')){if(!node.disabled)return false;selector=selector.replace(':disabled','');}
 for(const match of selector.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g))if(!node.hasAttribute(match[1])||(match[2]!==undefined&&node.getAttribute(match[1])!==match[2]))return false;
 selector=selector.replace(/\[[^\]]*\]/g,'');
 const id=selector.match(/#([\w-]+)/);if(id&&node.id!==id[1])return false;
 for(const match of selector.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(match[1]))return false;
 const tag=selector.match(/^[a-z][\w-]*/i);return !tag||node.tagName===tag[0].toUpperCase();
}
function parseHTML(html,parent){
 const stack=[parent],voidTags=new Set(['input','br','hr','img','meta','link','area','source','wbr']);
 for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
  if(token.startsWith('<!--'))continue;
  if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
  if(token.startsWith('<')){
   const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attributes={};
   for(const match of token.slice(tag.length+1).replace(/\/?\s*>$/,'').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attributes[match[1]]=decode(match[2]??match[3]??match[4]??'');
   const element=new Element(tag,parent.ownerDocument,attributes);stack.at(-1).append(element);
   if(!voidTags.has(tag.toLowerCase())&&!token.endsWith('/>'))stack.push(element);
  }else stack.at(-1).children.push(decode(token));
 }
 for(const select of parent.querySelectorAll('select')){const options=select.querySelectorAll('option'),selected=options.find(option=>option.hasAttribute('selected'))||options[0];select.value=selected?.attributes.value||selected?.textContent||'';}
 for(const textarea of parent.querySelectorAll('textarea'))textarea.value=textarea.textContent;
}
function createHarness(store=new Map(),options={}){
 const timers=new Map(),windowListeners={},blobs=new Map();let timerId=0,networkCalls=0;
 const document={listeners:{},downloads:[],title:'',activeElement:null,addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);},createElement(tag){return new Element(tag,this);},getElementById(id){return this.body.querySelector('#'+id);},querySelector(selector){return this.body.querySelector(selector);},querySelectorAll(selector){return this.body.querySelectorAll(selector);},async dispatch(type,target,extra={}){const event={type,target,preventDefault(){this.defaultPrevented=true;},...extra};for(let node=target;node;node=node.parentElement)for(const handler of node.listeners[type]||[])await handler(event);for(const handler of this.listeners[type]||[])await handler(event);await Promise.resolve();await Promise.resolve();}};
 document.body=new Element('body',document);
 document.body.innerHTML='<a class="skip-link"></a><div id="welcome"><button data-role="student"></button><button data-role="teacher"></button></div><main id="app" hidden></main><div id="notice" hidden></div>';
 const window={scrollY:0,scrollTo(){},matchMedia(){return {matches:!!options.mobile};},addEventListener(type,handler){(windowListeners[type]??=[]).push(handler);},print(){this.printed=true;}};
 const history={entries:[],index:-1,pushState(state,title,url){this.entries=this.entries.slice(0,this.index+1);this.entries.push({state,url});this.index++;},replaceState(state,title,url){if(this.index<0){this.entries.push({state,url});this.index=0;}else this.entries[this.index]={state,url};},back(){if(this.index>0){const entry=this.entries[--this.index];for(const handler of windowListeners.popstate||[])handler({state:entry.state});}}};
 const localStorage={getItem(key){if(options.failStorage)throw Error('storage disabled');return store.get(key)??null;},setItem(key,value){if(options.failStorage)throw Error('storage disabled');store.set(key,value);},removeItem(key){store.delete(key);}};
 const context={BANK,EXAM_BANK,COMPETENCY_DATA,EXAM_DIFFICULTY_DATA,BANK_STATS,document,window,history,localStorage,console,Blob,atob:value=>Buffer.from(value,'base64').toString('binary'),URL:{createObjectURL(blob){const url='blob:integration-'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(){}},crypto:{randomUUID:()=>`integration-${++generatedIdentity}`},setTimeout(callback){const id=++timerId;timers.set(id,callback);return id;},clearTimeout(id){timers.delete(id);},fetch(){networkCalls++;throw Error('network forbidden in integration checks');},...(options.createMathPDF?{createMathPDF:options.createMathPDF}:{})};
 vm.createContext(context);if(options.builtPage)page.execute(context);else vm.runInContext(source,context,{filename:'baza-app.integration.js'});
 const get=selector=>{const element=document.querySelector(selector);if(!element)throw Error('missing element: '+selector);return element;};
 return {store,document,context,window,history,get,blobs,
  state:()=>JSON.parse(store.get(KEY)||'{}'),
  html:()=>get('#app').innerHTML,
  text:()=>get('#app').textContent,
  async click(selector){const element=get(selector);if(element.disabled)throw Error('disabled element: '+selector);element.focus();await document.dispatch('click',element);},
  async input(selector,value){const element=get(selector);element.focus();element.value=value;element.selectionStart=element.selectionEnd=value.length;await document.dispatch('input',element);},
  async change(selector,value){const element=get(selector);element.focus();if(typeof value==='boolean')element.checked=value;else element.value=value;await document.dispatch('change',element);},
  async submit(selector){await document.dispatch('submit',get(selector));},
  async import(payload){const file=typeof payload==='string'?payload:JSON.stringify(payload),element=get('#import-file');element.files=[{size:Buffer.byteLength(file),text:async()=>file}];await document.dispatch('change',element);await Promise.resolve();await Promise.resolve();},
  flush(){const pending=[...timers.values()];timers.clear();for(const callback of pending)callback();},
  pagehide(){for(const handler of windowListeners.pagehide||[])handler();},
  networkCalls:()=>networkCalls
 };
}

let checks=0;const errors=[];
function test(condition,label){checks++;if(!condition)errors.push(label);}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const work=h=>h.state().works?.find(([key])=>key==='unified')?.[1];
const record=(h,id)=>h.state().attempts?.find(([key])=>key===`student:${h.state().student.id}:${id}`)?.[1];
const examRecord=(h,id)=>h.state().attempts?.find(([key])=>key.endsWith(':'+id))?.[1];
const examExamples=q=>q.examples?.length?q.examples:[q];
const all=BANK.flatMap(t=>t.tasks.map(q=>({...q,grade:t.grade,level:t.level,topicId:t.id})));
const numericTopic=BANK.find(t=>t.grade===6&&t.tasks.length>2&&t.tasks[0].kind==='number');
const first=numericTopic.tasks[0],second=numericTopic.tasks[1];
const openTopic=BANK.find(t=>t.grade===6&&t.tasks.some(q=>q.kind==='open'));
const open=openTopic?.tasks.find(q=>q.kind==='open');

async function chooseRole(h,role){await h.click(`[data-role="${role}"]`);await h.click('[data-action="grade"][data-grade="6"]');}
async function profile(h,firstName='Саша',lastName='Иванова'){await h.input('#first-name',firstName);await h.input('#last-name',lastName);await h.input('#class-letter','А');await h.submit('#profile-form');}
async function scenario(label,callback){try{await callback();}catch(error){test(false,label+': '+error.stack);}}
async function verifyExamDownload(h,exam,label){
 await h.click('[data-action="exam-download"]');
 const download=h.document.downloads.at(-1),blob=download&&h.blobs.get(download.url);
 test(download?.name===`fipi-math-${exam.id}-2026.pdf`&&blob?.type==='application/pdf',label+' original demo downloads as a PDF');
 if(blob){
  const bytes=Buffer.from(await blob.arrayBuffer());
  test(bytes.equals(Buffer.from(exam.pdfData.split(',')[1],'base64')),label+' downloaded PDF preserves all embedded source bytes');
  test(crypto.createHash('sha256').update(bytes).digest('hex')===exam.sha256,label+' application PDF download matches the official source checksum');
 }
}

module.exports={createHarness,BANK,EXAM_BANK,KEY};
if(require.main===module)(async()=>{
 const store=new Map();let h=createHarness(store),originalStudent;
 await scenario('student autosave, assistance and reload',async()=>{
  test(!h.get('#welcome').hidden&&h.get('#app').hidden,'new workspace starts at role selection');
  test(!h.document.querySelector('[data-action="resume"]'),'new workspace has no fabricated resume');
  await chooseRole(h,'student');await profile(h);originalStudent=h.state().student.id;
  test(h.state().resumeRoute.view==='topics'&&!!originalStudent,'profile submission starts and saves an identified session');
  await h.click(`[data-action="train"][data-topic="${numericTopic.id}"]`);
  await h.input('#answer','999999999');await h.submit('#answer-form');
  test(record(h,first.id).everWrong&&record(h,first.id).tries===1,'wrong numeric response is tracked');
  await h.click('[data-action="hint"]');test(record(h,first.id).hintLevel===1&&!!h.document.querySelector('.hint-panel'),'first hint is rendered and saved');
  await h.click('[data-action="hint"]');test(record(h,first.id).hintLevel===2&&h.text().includes('Первый шаг'),'second assistance stage is rendered');
  await h.input('#answer',first.display);await h.submit('#answer-form');
  test(record(h,first.id).correct&&record(h,first.id).outcome==='hinted'&&record(h,first.id).tries===2,'correct response keeps assistance outcome and attempts');
  await h.click('[data-action="next"]');await h.input('#answer','3/7');h.flush();
  test(record(h,second.id).draft==='3/7'&&h.state().resumeRoute.index===1,'draft and current task are saved without submitting');
  h=createHarness(store);test(!!h.document.querySelector('[data-action="resume"]'),'reload offers to continue');
  await h.click('[data-action="resume"]');
  test(h.state().student.id===originalStudent&&h.get('#answer').value==='3/7','continue restores the same student, task and draft');
  test(record(h,first.id).correct&&record(h,first.id).outcome==='hinted','reload preserves completed assistance outcome');
  await h.click(`[data-action="task"][data-index="${numericTopic.tasks.length-1}"]`);await h.click('[data-action="finish"]');
  test(h.text().includes('С подсказкой')&&h.text().includes('были ошибки'),'lesson results explain assistance and prior errors');
  await h.click('[data-action="retry"]');
  test(h.state().resumeRoute.taskIds.includes(first.id)&&h.state().resumeRoute.taskIds.includes(second.id),'retry includes incorrect attempts and unfinished tasks');
  test(!record(h,first.id),'retry clears the selected attempt for a fresh solution');
 });
 await scenario('builder pagination, search, favorite, library and variants',async()=>{
  h=createHarness(store);await chooseRole(h,'teacher');await h.click('[data-action="builder"]');
  test(h.document.querySelectorAll('.bank-task').length===24,'builder limits one bank page to 24 tasks');
  const firstPage=h.get('#bank-list').textContent;await h.click('[data-action="bank-next"]');
  test(h.get('#bank-list').textContent!==firstPage&&h.text().includes('Страница 2'),'bank pagination changes the selected records');
  await h.input('#bank-search',first.id);
  test(h.document.querySelectorAll('.bank-task').length===1&&h.text().includes('Страница 1 из 1'),'search finds a task by ID and resets pagination');
  await h.click(`[data-action="favorite"][data-id="${first.id}"]`);await h.change('#favorite-only',true);await h.input('#bank-search','');
  test(h.document.querySelectorAll('.bank-task').length===1&&h.state().favorites.includes(first.id),'favorites filter keeps the selected task');
  await h.click(`[data-action="add"][data-id="${first.id}"]`);
  await h.input('#work-title','Дроби и НОД');await h.input('#work-variant','1');await h.change('#include-answers',true);await h.input('#variant-seed','урок-6');h.flush();
  await h.click('[data-action="save-work"]');
  const savedId=h.state().library[0].id;
  test(same(work(h).ids,[first.id])&&h.state().library.length===1,'work composition and metadata are saved in the library');
  await h.click('[data-action="new-variant"]');
  const next=work(h).ids[0],a=all.find(q=>q.id===first.id),b=all.find(q=>q.id===next);
  test(work(h).ids.length===1&&b.topicId===a.topicId&&b.difficulty===a.difficulty&&b.kind===a.kind,'new variant preserves topic, difficulty and format');
  test(h.state().library.length>=2&&work(h).variant==='2','variant preserves the original and saves the next version');
  await h.click(`[data-action="load-work"][data-id="${savedId}"]`);
  test(same(work(h).ids,[first.id])&&work(h).title==='Дроби и НОД'&&work(h).answers===true,'saved work can be reopened with its metadata');
  test(work(h).seed==='урок-6'&&h.get('#variant-seed').value==='урок-6','reopening a saved work preserves the variant key');
  await h.click('[data-action="export-work"]');
  const download=h.document.downloads.at(-1),exported=JSON.parse(await h.blobs.get(download.url).text());
  test(download.name.endsWith('.json')&&!download.name.includes('null')&&exported.format==='mat1430-work'&&exported.version===2&&same(exported.work.ids,[first.id]),'export produces a usable mixed-work JSON file');
  test(exported.work.seed==='урок-6','export preserves the reproducible variant key');
  await h.import({...exported,work:{...exported.work,ids:[second.id],title:'Открытая подборка'}});
  test(same(work(h).ids,[second.id])&&work(h).title==='Открытая подборка','import opens a validated work file');
  const before=JSON.stringify(work(h));await h.import({...exported,work:{...exported.work,ids:['missing']}});
  test(JSON.stringify(work(h))===before&&h.get('#notice').textContent.includes('Не удалось'),'invalid import preserves the current work and explains failure');
  h.pagehide();h=createHarness(store);await h.click('[data-action="resume"]');
  test(h.state().resumeRoute.view==='builder'&&same(work(h).ids,[second.id])&&h.state().favorites.includes(first.id),'reload restores teacher draft and favorites');
  test(work(h).seed==='урок-6'&&h.get('#variant-seed').value==='урок-6','reload and import preserve the variant key');
 });
 await scenario('end session isolates a new student while keeping teacher work',async()=>{
  h=createHarness(store);await chooseRole(h,'student');await profile(h);
  const teacherWork=JSON.stringify(work(h)),savedLibrary=h.state().library.length;
  await h.click(`[data-action="train"][data-topic="${numericTopic.id}"]`);await h.input('#answer','17');h.flush();
  const previousId=h.state().student.id;await h.click('[data-action="end-session"]');
  test(h.get('#first-name').value===''&&h.get('#last-name').value===''&&!h.state().student.id,'end session clears student identity from the profile');
  test(!h.state().attempts.some(([key])=>key.startsWith('student:')),'end session removes student answers from persistent state');
  test(JSON.stringify(work(h))===teacherWork&&h.state().library.length===savedLibrary,'end session preserves teacher work and saved library');
  await profile(h,'Миша','Петров');await h.click(`[data-action="train"][data-topic="${numericTopic.id}"]`);
  test(h.state().student.id!==previousId&&h.get('#answer').value===''&&!record(h,first.id),'new student starts with a new identity and no former answer');
  await h.input('#answer',first.display);await h.submit('#answer-form');
  test(record(h,first.id).outcome==='independent','new student can solve independently without former assistance');
  await h.click('[data-action="next"]');await h.click('[data-action="reveal"]');await h.input('#answer',second.display);await h.submit('#answer-form');
  test(record(h,second.id).outcome==='explained','numeric response after a full model solution is classified separately');
 });
 await scenario('open response rubric and model-based self-check',async()=>{
  test(!!open,'real bank contains an open task for grade 6');if(!open)return;
  await h.click('[data-action="back"]');await h.click(`[data-action="train"][data-topic="${openTopic.id}"]`);
  await h.click(`[data-action="task"][data-index="${openTopic.tasks.indexOf(open)}"]`);
  test(!!h.document.querySelector('#open-draft')&&!h.document.querySelector('#answer-form'),'open response has a draft rather than a numeric checker');
  await h.input('#open-draft','Моё построение и обоснование.');h.flush();
  await h.click('[data-action="reveal"]');
  test(h.document.querySelectorAll('[data-rubric]').length===open.rubric.length,'revealing an open task renders all authored self-check criteria');
  test(h.get('[data-action="self-complete"]').disabled,'self-check cannot complete before all criteria are checked');
  for(let i=0;i<open.rubric.length;i++)await h.change(`[data-rubric="${i}"]`,true);
  await h.click('[data-action="self-complete"]');
  test(record(h,open.id).correct&&record(h,open.id).outcome==='explained'&&record(h,open.id).draft.includes('обоснование'),'complete rubric saves a model-assisted self-check and draft');
  await h.click(`[data-action="task"][data-index="${openTopic.tasks.length-1}"]`);await h.click('[data-action="finish"]');
  test(h.text().includes('Самопроверка по образцу'),'open self-check is identified separately in results');
 });
 await scenario('unavailable and malformed local storage',async()=>{
  const denied=createHarness(new Map(),{failStorage:true});await chooseRole(denied,'teacher');
  test(denied.text().includes('Автосохранение недоступно'),'storage failure leaves a usable application with a clear status');
  const malformed=createHarness(new Map([[KEY,'{broken json']]));await chooseRole(malformed,'teacher');
  test(malformed.state().version===2&&malformed.state().student.id==='','malformed storage starts with clean state and can recover');
 });
 await scenario('editing the student profile starts a clean session',async()=>{
  const renamed=createHarness(store);await chooseRole(renamed,'student');const previous=renamed.state().student.id;
  await profile(renamed,'Лена','Сидорова');
  test(renamed.state().student.id!==previous&&renamed.state().student.first==='Лена','changing a student name creates a new session identity');
  test(!renamed.state().attempts.some(([key])=>key.startsWith('student:')),'changing a student name removes former attempts before selecting a topic');
 });
 await scenario('mobile work dialog accessibility state',async()=>{
  const mobile=createHarness(new Map(),{mobile:true});await chooseRole(mobile,'teacher');await mobile.click('[data-action="builder"]');
  await mobile.input('#bank-search',first.id);await mobile.click(`[data-action="add"][data-id="${first.id}"]`);await mobile.click('[data-action="open-work"]');
  test(mobile.get('#work-panel').getAttribute('role')==='dialog'&&mobile.get('#work-panel').getAttribute('aria-modal')==='true','mobile work panel declares a modal dialog');
  test(mobile.get('#builder-bank').inert&&mobile.document.body.classList.contains('work-open'),'opening mobile work panel makes the bank inert');
  mobile.get('#bank-search').focus();await mobile.document.dispatch('keydown',mobile.document.activeElement,{key:'Tab'});
  test(mobile.get('#work-panel').contains(mobile.document.activeElement),'Tab restores focus from outside the modal');
  await mobile.input('#work-title','Мобильная работа');await mobile.click('[data-action="save-work"]');
  test(mobile.get('#work-panel').contains(mobile.document.activeElement),'rerender after saving keeps keyboard focus inside work panel');
  await mobile.click(`#work-panel [data-action="remove"][data-id="${first.id}"]`);
  test(work(mobile).ids.length===0&&mobile.get('#work-panel').contains(mobile.document.activeElement),'removing a task keeps work state and dialog focus consistent');
  await mobile.document.dispatch('keydown',mobile.document.activeElement,{key:'Escape'});
  test(mobile.get('#work-panel').getAttribute('role')==='complementary'&&!mobile.get('#work-panel').hasAttribute('aria-modal')&&!mobile.get('#builder-bank').inert,'Escape restores the ordinary work panel and bank');
 });
 for(const role of ['student','teacher']){
  await scenario(role+' official OGE guest visit, assets and restoration',async()=>{
   const examStore=new Map();let visitor=createHarness(examStore);
   await visitor.click(`[data-role="${role}"]`);
   test(visitor.document.querySelectorAll('.class-section .class-card').length===7,role+' catalogue retains all seven classes');
   test(visitor.document.querySelectorAll('.exam-section .exam-entry-card').length===2,role+' catalogue offers OGE and EGE in their own section');
   test(!visitor.document.querySelector('.class-section .exam-entry-card')&&!visitor.document.querySelector('.exam-section .class-card'),role+' exams and class cards remain separate');
   await visitor.click('[data-action="exam-start"][data-exam="oge"]');
   const oge=EXAM_BANK.find(e=>e.id==='oge'),first=examExamples(oge.tasks[0])[0],second=examExamples(oge.tasks[1])[0];
   const guestId=visitor.state().examLearnerId;
   test(visitor.state().resumeRoute.view==='exam'&&visitor.state().resumeRoute.grade===null&&!visitor.document.querySelector('#profile-form'),role+' can open OGE without choosing a class or entering a profile');
   test(visitor.document.querySelectorAll('.exam-numbers [data-action="exam-task"]').length===25,role+' OGE navigation exposes every official number');
   test(same(visitor.document.querySelectorAll('.exam-task-image').map(image=>image.getAttribute('src')),[...first.contextImages,...first.images]),role+' first OGE task renders both the shared plan and its original statement');
   await visitor.input('#exam-answer','987654321');await visitor.submit('#exam-answer-form');
   test(examRecord(visitor,first.id).tries===1&&examRecord(visitor,first.id).everWrong&&!examRecord(visitor,first.id).correct,role+' OGE rejects a wrong answer and saves the attempt');
   await visitor.input('#exam-answer',first.answers[0]);await visitor.submit('#exam-answer-form');
   test(examRecord(visitor,first.id).correct&&examRecord(visitor,first.id).tries===2&&visitor.get('#exam-answer').hasAttribute('readonly'),role+' OGE accepts the official answer and prevents resubmission');
   await visitor.click('[data-action="exam-next"]');await visitor.input('#exam-answer','107,');visitor.flush();
   test(examRecord(visitor,second.id).draft==='107,'&&visitor.state().resumeRoute.index===1,role+' OGE saves unfinished input and its current number');
   await visitor.click('[data-action="exam-references"]');
   const referenceImages=visitor.document.querySelectorAll('#exam-references .exam-task-image').map(image=>image.getAttribute('src'));
   const officialReferences=[...oge.answerPages,...(oge.solutionPages||[]),...(second.solutionPages||[])].map(page=>page.image);
   test(!!visitor.document.querySelector('#exam-references')&&oge.answerPages.every(page=>referenceImages.includes(page.image))&&referenceImages.every(src=>officialReferences.includes(src)),role+' official answer and criteria page images can be opened');
   test(examRecord(visitor,second.id).revealed&&!examRecord(visitor,second.id).correct,role+' opening official answers never marks a pending response correct');
   await verifyExamDownload(visitor,oge,role+' OGE');
   visitor.pagehide();visitor=createHarness(examStore);await visitor.click('[data-action="resume"]');
   test(visitor.state().resumeRoute.view==='exam'&&visitor.state().resumeRoute.examId==='oge'&&visitor.state().resumeRoute.index===1&&visitor.get('#exam-answer').value==='107,',role+' reload restores the exact OGE task and answer draft');
   test(examRecord(visitor,first.id).correct&&examRecord(visitor,second.id).revealed,role+' reload keeps results and reference viewing');
   if(role==='student')test(!!guestId&&visitor.state().examLearnerId===guestId&&!visitor.state().student.id,role+' anonymous exam identity persists without a fabricated school profile');
   await visitor.click('[data-action="exam-prev"]');
   test(visitor.state().resumeRoute.index===0&&visitor.get('#exam-answer').value===first.answers[0],role+' previous-number navigation restores its own saved answer');
   if(role==='student'){
    await visitor.click('[data-action="end-session"]');
    test(!visitor.state().examLearnerId&&!visitor.state().attempts.some(([key])=>key.startsWith('exam-guest:')),role+' ending a guest session removes its identity and exam answers');
    await visitor.click('[data-action="exam-start"][data-exam="oge"]');
    test(visitor.state().examLearnerId!==guestId&&visitor.get('#exam-answer').value==='',role+' a new guest starts without the previous learner answer');
   }
   test(visitor.networkCalls()===0,role+' OGE visit and source download work offline');
  });
  await scenario(role+' EGE levels, independent examples and open solutions',async()=>{
   const examStore=new Map();let visitor=createHarness(examStore);
   await visitor.click(`[data-role="${role}"]`);await visitor.click('[data-action="exam-levels"]');
   test(visitor.state().resumeRoute.view==='exam-levels'&&visitor.document.querySelectorAll('.exam-level-card').length===2&&!visitor.document.querySelector('#profile-form'),role+' EGE offers basic and profile without a school class');
   await visitor.click('[data-action="exam-start"][data-exam="ege-basic"]');
   const basic=EXAM_BANK.find(e=>e.id==='ege-basic'),matching=basic.tasks.find(q=>q.number===2),[a,b]=examExamples(matching);
   await verifyExamDownload(visitor,basic,role+' EGE basic');
   await visitor.click('[data-action="exam-task"][data-index="1"]');
   test(visitor.document.querySelectorAll('[data-action="exam-example"]').length===2,role+' EGE exposes both original examples for the matching task');
   await visitor.input('#exam-answer',[...a.answers[0]].reverse().join(''));await visitor.submit('#exam-answer-form');
   test(!examRecord(visitor,a.id).correct,role+' EGE matching rejects digits entered in the wrong order');
   await visitor.input('#exam-answer',a.answers[0]);await visitor.submit('#exam-answer-form');
   await visitor.click('[data-action="exam-example"][data-example="1"]');
   test(visitor.state().resumeRoute.example===1&&visitor.get('#exam-answer').value===''&&!examRecord(visitor,b.id),role+' a second example starts with its own empty attempt');
   await visitor.input('#exam-answer',a.answers[0]);await visitor.submit('#exam-answer-form');
   test(!examRecord(visitor,b.id).correct&&examRecord(visitor,a.id).correct,role+' the first example answer is not credited to the second example');
   await visitor.input('#exam-answer','41');visitor.flush();
   visitor=createHarness(examStore);await visitor.click('[data-action="resume"]');
   test(visitor.state().resumeRoute.examId==='ege-basic'&&visitor.state().resumeRoute.index===1&&visitor.state().resumeRoute.example===1&&visitor.get('#exam-answer').value==='41',role+' reload restores the EGE level, number, example and unfinished sequence');
   await visitor.input('#exam-answer',b.answers[0]);await visitor.submit('#exam-answer-form');
   await visitor.click('[data-action="exam-example"][data-example="0"]');
   test(visitor.get('#exam-answer').value===a.answers[0]&&examRecord(visitor,a.id).correct&&examRecord(visitor,b.id).correct,role+' both example answers survive independently after reload');
   const navigation=createHarness();await navigation.click(`[data-role="${role}"]`);await navigation.click('[data-action="exam-levels"]');await navigation.click('[data-action="exam-start"][data-exam="ege-profile"]');
   test(navigation.document.querySelectorAll('.exam-numbers [data-action="exam-task"]').length===19,role+' profile navigation exposes all 19 official numbers');
   await navigation.click('[data-action="exam-task"][data-index="12"]');
   const profileExam=EXAM_BANK.find(e=>e.id==='ege-profile'),open=examExamples(profileExam.tasks[12])[0];
   await verifyExamDownload(navigation,profileExam,role+' EGE profile');
   test(!!navigation.document.querySelector('#exam-draft')&&!navigation.document.querySelector('#exam-answer-form'),role+' a profile extended response has a full-solution draft and no automatic answer form');
   await navigation.click('[data-action="exam-references"]');
   test(navigation.get('[data-action="exam-reviewed"]').disabled,role+' an empty extended response cannot be marked reviewed');
   await navigation.input('#exam-draft','Полное решение с отбором корней и обоснованием.');navigation.flush();
   await navigation.click('[data-action="exam-references"]');await navigation.click('[data-action="exam-references"]');
   await navigation.click('[data-action="exam-reviewed"]');
   test(examRecord(navigation,open.id).feedback==='self'&&!examRecord(navigation,open.id).correct&&examRecord(navigation,open.id).tries===0,role+' human review remains separate from an automatic grade');
   test(navigation.text().includes('Экзаменационный балл не выставляется.'),role+' extended-response review clearly explains its status');
   await navigation.input('#exam-draft','Исправленное полное решение.');navigation.flush();
   test(examRecord(navigation,open.id).feedback===''&&!examRecord(navigation,open.id).correct,role+' changing a reviewed solution clears the former review mark');
   await navigation.click('[data-action="back"]');
   test(navigation.state().resumeRoute.view==='exam-levels'&&navigation.document.querySelectorAll('.exam-level-card').length===2,role+' Back returns from profile tasks to EGE level selection');
   await navigation.click('[data-action="back"]');
   test(navigation.state().resumeRoute.view==='classes'&&!!navigation.document.querySelector('.exam-section'),role+' Back returns from EGE levels to the class and exam catalogue');
   test(visitor.networkCalls()===0&&navigation.networkCalls()===0,role+' EGE navigation and source references work offline');
  });
 }
 test(h.networkCalls()===0,'integration scenarios make no network requests');
 const report={checks,errors,scope:'Node VM state/event integration; no visual or browser verification',bankTasks:all.length};
 fs.writeFileSync(path.join(root,'checks/ui-state-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
