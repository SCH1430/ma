// Verify the distributed folder, including classic script order on file://.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'checks',name),'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let checks=0;const errors=[];
const test=(condition,label)=>{checks++;if(!condition)errors.push(label);};
const refs=page.scripts.map(script=>script.reference),data=page.dataValues();
const bank=read('bank.json'),exams=read('exam-bank.json');
const grades=Array.from({length:7},(_,i)=>i+5),gradeRefs=grades.map(grade=>`data/tasks/grade_${String(grade).padStart(2,'0')}.js`);
const examRefs=['oge','ege-basic','ege-profile'].map(id=>`data/exams/${id}.js`);
const indexBytes=Buffer.byteLength(page.html);
test(indexBytes<100000,'index.html is a small entry page below 100 KB');
test(!/\bdata:[^\s"']*;base64,|[A-Za-z0-9+/]{500}/i.test(page.html),'index.html contains no embedded binary payload');
test(!/\bconst\s+(?:BANK|EXAM_BANK|FONT_BASE64)\b/.test(page.html),'index.html contains no task bank or font declarations');
test(!bank.some(topic=>topic.tasks.some(task=>page.html.includes(task.id)||page.html.includes(task.prompt))),'no class task content is embedded in index.html');
test(page.scripts.length>0&&page.scripts.every(script=>script.reference&&script.inline.trim()===''),'all scripts are external files');
test(page.scripts.every(script=>'defer' in script.attrs&&!('async' in script.attrs)&&!script.attrs.type),'ordered classic deferred scripts support offline file loading');
test(new Set(refs).size===refs.length,'every script is loaded exactly once');
test(page.styles.length===4&&page.styles.every(style=>style.file),'all stylesheet references exist locally');
test(!/<style\b/i.test(page.html),'styles are external files');
test(same(refs.filter(ref=>ref?.startsWith('data/tasks/')),gradeRefs),'each class has exactly one runtime task file, ordered 5 through 11');
test(same(refs.filter(ref=>ref?.startsWith('data/exams/')),examRefs),'each exam bank has its own runtime file');
const bankIndex=refs.indexOf('data/bank.js'),appIndex=refs.indexOf('src/app.js');
test(bankIndex>=0&&gradeRefs.concat(examRefs).every(ref=>refs.indexOf(ref)>bankIndex&&refs.indexOf(ref)<appIndex),'task banks initialize before partitions and before the app');
test(refs.at(-1)==='src/app.js','the application starts after all of its dependencies');
test(page.scripts.filter(script=>script.vendor).length===2&&['pdf-lib','fontkit'].every(name=>page.scripts.findIndex(script=>script.attrs.id==='vendor-'+name)<refs.indexOf('src/pdf.js')),'both local PDF libraries load before the renderer');
test(same(data.BANK,bank),'deployed class banks match every generated source record exactly');
test(same(data.EXAM_BANK,exams),'deployed exam banks restore every original image, PDF, answer and record exactly');
test(same(data.COMPETENCY_DATA,read('competencies.json')),'deployed competencies match their source');
test(same(data.EXAM_DIFFICULTY_DATA,read('exam-difficulty.json')),'deployed exam difficulty matches its source');
test(same(data.BANK_STATS,read('semantic-results.json').stats),'deployed bank statistics match the semantic audit exactly');
test(Buffer.from(data.FONT_BASE64,'base64').equals(fs.readFileSync(path.join(root,'src/vendor/DejaVuSans.ttf'))),'deployed PDF font preserves original bytes');
for(const [index,grade] of grades.entries()){
 const context=vm.createContext({});
 vm.runInContext(page.sourceFor('data/bank.js'),context);
 vm.runInContext(page.sourceFor(gradeRefs[index]),context);
 const isolated=JSON.parse(vm.runInContext('JSON.stringify(BANK)',context));
 test(isolated.length>0&&isolated.every(topic=>topic.grade===grade),grade+' class file contains only its own topics');
 test(same(isolated,bank.filter(topic=>topic.grade===grade)),grade+' class file independently restores all source tasks without mutation');
}
(async()=>{
 // Load every deployed script sequentially, including both real PDF vendors,
 // into the event/DOM harness used by the integration suite. No network exists.
 const {createHarness}=require('./validate_ui_state.cjs');
 const h=createHarness(new Map(),{builtPage:true});
 test(h.get('#app').hidden&&!h.get('#welcome').hidden,'complete deployed page bootstraps into role selection');
 test(vm.runInContext('BANK.length',h.context)===bank.length&&vm.runInContext('EXAM_BANK.length',h.context)===3,'ordered full-page bootstrap sees complete class and exam data');
 test(vm.runInContext('typeof createMathPDF === "function" && typeof PDFLib.PDFDocument.create === "function" && typeof fontkit.create === "function"',h.context),'full-page bootstrap exposes the real local PDF renderer and libraries');
 await h.click('[data-role="teacher"]');
 await h.click('[data-action="grade"][data-grade="6"]');
 test(h.document.querySelectorAll('.topic-card').length===bank.filter(topic=>topic.grade===6).length,'full-page teacher route renders its external grade bank');
 await h.click('[data-action="builder"]');
 test(h.document.querySelectorAll('.bank-task').length===24,'full-page constructor reads and renders the external catalog');
 test(h.networkCalls()===0,'complete offline bootstrap and navigation issue no application network requests');
 const report={checks,errors,indexBytes,topics:bank.length,tasks:bank.reduce((sum,topic)=>sum+topic.tasks.length,0),classFiles:gradeRefs,examFiles:examRefs,scripts:refs.length};
 fs.writeFileSync(path.join(root,'checks/build-results.json'),JSON.stringify(report,null,2));
 console.log(report);if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
