// Check the official 2026 demo bank, its embedded source assets, answer formats,
// and the same route boundary used by local-storage restoration.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const page=require('./load_page.cjs').loadPage(root),{BANK:bank,EXAM_BANK:exams}=page.dataValues();
const manifest=read('src/exams/2026/manifest.json');
// Transcribed from the original official answer tables, independently of the
// extraction manifest: OGE PDF page 8, basic PDF page 15, profile PDF page 10.
const oracle=read('checks/exam-answer-oracle.json');
const specs={
 oge:{numbers:25,openFrom:20,pdf:'ma_9_2026/МА-9 ОГЭ 2026_ДЕМО.pdf',counts:Array(25).fill(1)},
 'ege-basic':{numbers:21,openFrom:Infinity,pdf:'ma_11_2026/МА-11 ЕГЭ 2026 ДЕМО_базовый.pdf',counts:[4,2,3,3,3,3,3,2,2,3,4,4,4,3,4,4,4,3,4,4,4]},
 'ege-profile':{numbers:19,openFrom:13,pdf:'ma_11_2026/МА-11 ЕГЭ 2026 ДЕМО_профильный.pdf',counts:[4,3,4,3,4,4,3,3,3,3,3,4,2,2,2,2,2,2,2]}
};
let checks=0;const errors=[],summaries=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normalized=values=>values.map(value=>String(value).replace(/,/g,'.').replace(/−|–/g,'-').replace(/\s+/g,'')).sort();
const examples=task=>task.examples?.length?task.examples:[task];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function dataBytes(value,mime,label){
 const match=typeof value==='string'&&value.match(new RegExp('^data:'+mime+';base64,([A-Za-z0-9+/]+={0,2})$'));
 test(!!match,label+' is embedded as a data URI');
 if(!match)return null;
 const bytes=Buffer.from(match[1],'base64');
 test(bytes.toString('base64')===match[1],label+' has valid complete base64');
 return bytes;
}
function imageAsset(value,label){
 const bytes=dataBytes(value,'image/(?:png|jpeg)',label);if(!bytes)return;
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
 test(bytes.length>500&&(png||jpeg),label+' contains an actual PNG/JPEG');
 if(png)test(bytes.readUInt32BE(16)>100&&bytes.readUInt32BE(20)>20,label+' has nonempty readable dimensions');
}
function fragmentAsset(examId,fragment,label,pageCount){
 test(Number.isInteger(fragment.page)&&fragment.page>0&&fragment.page<=pageCount,label+' refers to an original source page');
 const box=fragment.bbox;
 test(Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box[0]>=0&&box[1]>=0&&box[2]<=842.1&&box[3]<=595.4&&box[2]>box[0]&&box[3]>box[1],label+' has a complete in-page crop');
 if(!Array.isArray(box)||box.length!==4)return null;
 const key=examId+'-'+fragment.page+'-'+box.map(value=>Number(value).toFixed(3)).join('-');
 const file=path.join(root,'src/exams/2026/images',examId,hash(Buffer.from(key)).slice(0,20)+'.png');
 test(fs.existsSync(file),label+' has a retained source crop');
 return fs.existsSync(file)?'data:image/png;base64,'+fs.readFileSync(file).toString('base64'):null;
}
function attempt(label,callback){try{callback();}catch(error){test(false,label+': '+error.stack);}}

test(Array.isArray(exams)&&exams.length===3,'three separately named official demo banks exist');
test(manifest.year===2026&&manifest.exams?.length===3,'the extraction manifest is confined to the three 2026 demos');
test(same(exams.map(e=>e.id).sort(),Object.keys(specs).sort()),'OGE, EGE basic and EGE profile are the only exam banks');
const seenIds=new Set(),classIds=new Set(bank.flatMap(topic=>topic.tasks.map(q=>q.id)));
const context={BANK:bank,EXAM_BANK:exams};vm.createContext(context);
vm.runInContext(page.sourceFor('src/exam-support.js'),context);
vm.runInContext(page.sourceFor('src/app.js').split('/* UI */')[0],context);
const check=(raw,q)=>context.MathExam.checkAnswer(raw,q,context.parseAnswer);
test(typeof context.safeRoute==='function'&&typeof context.MathExam?.checkAnswer==='function','application route and exam-answer boundaries load');

for(const exam of exams)attempt(exam.id,()=>{
 const spec=specs[exam.id];test(!!spec,exam.id+' has a known official source');if(!spec)return;
 const source=manifest.exams.find(e=>e.id===exam.id);
 test(!!source&&source.tasks.length===spec.numbers,exam.id+' has a complete original-source manifest');
 test(exam.year===2026,exam.id+' is explicitly the 2026 demo');
 test(/2026/.test(exam.title+' '+exam.subtitle+' '+exam.sourceTitle),exam.id+' identifies the year in visible source information');
 const sourceUrl=new URL(exam.sourceUrl);
 test(sourceUrl.protocol==='https:'&&/(^|\.)fipi\.ru$/i.test(sourceUrl.hostname),exam.id+' links directly to an official FIPI domain');
 test(sourceUrl.pathname.includes('/2026/')&&exam.sourceUrl===source.archiveUrl,exam.id+' points to the exact 2026 archive');
 const pdf=dataBytes(exam.pdfData,'application/pdf',exam.id+' original PDF');
 const original=fs.readFileSync(path.join(root,'src/exams/2026/sources',spec.pdf));
 if(pdf){test(pdf.subarray(0,5).toString()==='%PDF-',exam.id+' has an actual PDF');test(hash(pdf)===hash(original),exam.id+' downloadable PDF exactly matches the retained official source');}
 test(source.sha256===hash(original)&&exam.sha256===hash(original),exam.id+' source checksums cover the exact embedded original');
 test(exam.tasks.length===spec.numbers,exam.id+' has all '+spec.numbers+' task numbers');
 test(same(exam.tasks.map(q=>q.number),Array.from({length:spec.numbers},(_,i)=>i+1)),exam.id+' preserves every official number in order');
 const answerPages=exam.answerPages||[],solutionPages=exam.solutionPages||[];
 test(answerPages.length>0,exam.id+' retains the official answer table');
 test(spec.openFrom===Infinity||solutionPages.length>0||exam.tasks.some(task=>examples(task).some(q=>q.solutionPages?.length)),exam.id+' retains expanded-response solutions and criteria');
 for(const [kind,pages] of [['answer',answerPages],['solution',solutionPages]])for(const [i,p] of pages.entries()){
  test(Number.isInteger(p.page)&&p.page>0,exam.id+' '+kind+' page '+i+' retains its original page number');
  test(typeof p.text==='string'&&p.text.trim().length>20,exam.id+' '+kind+' page '+i+' retains accessible source text');
  imageAsset(p.image,exam.id+' '+kind+' page '+p.page);
 }
 let count=0,open=0;
 for(const [index,task] of exam.tasks.entries()){
  const variants=examples(task),label=exam.id+' #'+task.number;
  test(variants.length===spec.counts[index],label+' retains every official alternative example');
  for(const field of ['answerKind','answers','text','images','contextImages'])if(task.examples?.length)test(same(task[field],variants[0][field]),label+' root '+field+' mirrors its first example');
  for(const [variantIndex,q] of variants.entries()){
   const qlabel=label+' example '+(variantIndex+1);count++;
   const sourceExample=source.tasks[index].examples[variantIndex];
   test(!!sourceExample,qlabel+' exists in the original extraction manifest');
   test(typeof q.id==='string'&&q.id.startsWith('exam-2026-'+exam.id+'-'),qlabel+' has a distinct namespaced ID');
   test(!seenIds.has(q.id)&&!classIds.has(q.id),qlabel+' does not collide with other exams or class tasks');seenIds.add(q.id);
   test(typeof q.text==='string'&&q.text.trim().length>15,qlabel+' retains accessible original text');
   test(Array.isArray(q.images)&&q.images.length>0,qlabel+' retains original task images');
   for(const [i,img] of (q.images||[]).entries())imageAsset(img,qlabel+' task image '+i);
   test(Array.isArray(q.contextImages),qlabel+' explicitly tracks shared context');
   for(const [i,img] of (q.contextImages||[]).entries())imageAsset(img,qlabel+' context image '+i);
   if(exam.id==='oge'&&task.number<=5)test(q.contextImages.length>0,qlabel+' retains the common condition and plan');
   if(sourceExample){
    test(q.text===sourceExample.text,qlabel+' retains the exact accessible text from the source manifest');
    for(const [field,fragmentField] of [['images','fragments'],['contextImages','contextFragments']]){
     const fragments=sourceExample[fragmentField]||[];
     const assets=fragments.map((fragment,i)=>fragmentAsset(exam.id,fragment,qlabel+' '+fragmentField+' '+i,source.pageCount));
     test(same(q[field],assets),qlabel+' '+field+' contains every original source fragment in order');
    }
    const solutionFragments=sourceExample.solutionFragments||[];
    if(solutionFragments.length){
     const assets=solutionFragments.map((fragment,i)=>fragmentAsset(exam.id,fragment,qlabel+' solution '+i,source.pageCount));
     test(same((q.solutionPages||[]).map(page=>page.image),assets),qlabel+' retains every page of its official solution and criteria');
    }
   }
   test(['number','sequence','open'].includes(q.answerKind),qlabel+' has a recognized response format');
   if(task.number>=spec.openFrom){
    open++;test(q.answerKind==='open',qlabel+' requires a full written solution');
    test(q.solutionPages?.length>0||solutionPages.length>0,qlabel+' supplies official criteria for human review');
    for(const [i,page] of (q.solutionPages||[]).entries()){
     imageAsset(page.image,qlabel+' official solution image '+i);
     test(typeof page.text==='string'&&page.text.trim().length>20&&Number.isInteger(page.page),qlabel+' official solution retains accessible page metadata '+i);
    }
    const result=check('42',q);test(!result.valid&&!result.correct&&result.requiresReview,qlabel+' never receives an automatic grade');
    test(!q.answers?.length,qlabel+' has no automatic answer key for a proof or solution');
   }else{
    test(q.answerKind!=='open',qlabel+' supports its official short answer');
    const isSequence=exam.id==='oge'?[11,19].includes(task.number):exam.id==='ege-basic'&&([2,7,8,18].includes(task.number)||task.number===6&&variantIndex<2);
    if(isSequence)test(q.answerKind==='sequence',qlabel+' preserves the official digit-sequence format');
    const expected=oracle[exam.id]?.[index]?.[variantIndex];
    test(!!expected&&same(normalized(q.answers||[]),normalized(expected||[])),qlabel+' answer list matches the independently read official table');
    for(const answer of expected||[])test(check(answer,q).correct,qlabel+' accepts official answer '+answer);
    test(!check('987654321987654321',q).correct,qlabel+' rejects an incorrect answer');
    test(!check('',q).valid&&!check('Ответ: 42',q).valid,qlabel+' rejects empty or explanatory text');
    if(q.answerKind==='sequence'){
     for(const answer of expected||[]){
      test(!check(answer+'.0',q).valid,qlabel+' does not reinterpret a sequence as a decimal');
      test(!check('0'+answer,q).correct,qlabel+' preserves leading digits');
      const reversed=[...answer].reverse().join('');
      if(!(expected||[]).includes(reversed))test(!check(reversed,q).correct,qlabel+' preserves digit order');
     }
    }else for(const answer of expected||[]){
     const number=Number(answer),near=String(number+Math.max(1,Math.abs(number))*1e-10);
     test(!check(near,q).correct,qlabel+' rejects numerically close but unequal answers');
     if(answer.includes('.'))test(check(answer.replace('.',','),q).correct,qlabel+' accepts the official decimal comma');
    }
   }
  }
 }
 summaries.push({id:exam.id,numbers:exam.tasks.length,examples:count,openExamples:open,sourceSha256:hash(original)});
});

attempt('restored exam navigation',()=>{
 for(const role of ['student','teacher']){
  const common={role,grade:null,level:null,topic:null};
  const levels=context.safeRoute({...common,view:'exam-levels'},bank,exams);
  test(levels.view==='exam-levels'&&levels.grade===null&&levels.level===null,'EGE level selection works without a class for '+role);
  for(const exam of exams){
   const base={...common,view:'exam',examId:exam.id,index:0,example:0};
   const route=context.safeRoute(base,bank,exams);
   test(route.view==='exam'&&route.examId===exam.id&&route.grade===null&&route.level===null&&route.topic===null,exam.id+' restores without class metadata for '+role);
   const contaminated=context.safeRoute({...base,grade:6,level:'basic',topic:bank[0].id,taskIds:[bank[0].tasks[0].id]},bank,exams);
   test(contaminated.grade===null&&contaminated.level===null&&contaminated.topic===null&&!contaminated.taskIds,exam.id+' strips class lesson state for '+role);
   test(context.safeRoute({...base,index:999,example:999},bank,exams).index===exam.tasks.length-1,exam.id+' clamps an oversized saved task index');
   for(const index of [-1,NaN,Infinity,'2'])test(context.safeRoute({...base,index},bank,exams).index===0,exam.id+' normalizes invalid task index '+String(index));
   const multi=exam.tasks.findIndex(q=>examples(q).length>1);
   if(multi>=0){
    const count=examples(exam.tasks[multi]).length;
    test(context.safeRoute({...base,index:multi,example:999},bank,exams).example===count-1,exam.id+' clamps a saved alternative example');
    for(const example of [-1,Infinity,'2'])test(context.safeRoute({...base,index:multi,example},bank,exams).example===0,exam.id+' normalizes invalid example '+String(example));
   }
  }
  test(context.safeRoute({...common,view:'exam',examId:'missing'},bank,exams).view==='classes','unknown exam returns to catalogue for '+role);
  test(context.safeRoute({...common,view:'exam',examId:'oge'},bank,[{...exams.find(e=>e.id==='oge'),year:2025}]).view==='classes','a former-year bank cannot restore as the 2026 demo');
 }
 test(context.safeRoute({view:'exam',role:'administrator',examId:'oge'},bank,exams).view==='home','invalid role cannot restore an exam workspace');
 const sequence={answerKind:'sequence',answers:['0123']};
 test(check('0123',sequence).correct&&!check('123',sequence).correct,'the sequence checker preserves leading zeroes');
 test(!check('0213',sequence).correct&&!check('1/2',sequence).valid&&!check('1,2',sequence).valid,'the sequence checker preserves order and rejects numeric notation');
 test(!bank.some(topic=>topic.id.startsWith('exam-')||topic.tasks.some(q=>q.id.startsWith('exam-'))),'class topics and constructor keep their original bank');
 const classTasks=bank.flatMap(topic=>topic.tasks.map(q=>({...q,grade:topic.grade,level:topic.level,topicId:topic.id})));
 const ordinary=classTasks[0],examId=examples(exams[0].tasks[0])[0].id;
 const imported=context.sanitizeWork({ids:[ordinary.id,examId]},classTasks,ordinary.grade,ordinary.level);
 test(same(imported.ids,[ordinary.id]),'a class-work import cannot mix official exam tasks into an authored class worksheet');
});
const report={checks,errors,banks:summaries,scope:'Official-demo source assets, complete examples, answer-table oracle and pure app boundaries; UI tested separately'};
fs.writeFileSync(path.join(root,'checks/exam-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
