// Exercise the standalone work runner with real answer parsing and mixed sources.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({console});
const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8').split('/* UI */')[0];
vm.runInContext(app+'\n'+fs.readFileSync(path.join(root,'src/exam-support.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/work-runner.js'),'utf8'),context);
const runner=context.MathWorkRunner,checker=context.checkAnswer;
const catalog=[
 {id:'class-number',source:'class',kind:'number',answer:0.75,display:'3/4',prompt:'Вычислите 3/4.',solution:'Три разделить на четыре — 0,75.'},
 {id:'class-set',source:'class',kind:'set',answer:[-2,3],display:'−2; 3',prompt:'Укажите корни.',solution:'Корни −2 и 3.'},
 {id:'fipi-number',source:'exam',kind:'number',answerKind:'number',answers:['107.25'],answerText:'107,25',prompt:'Найдите высоту шины.',images:['data:image/png;base64,AAAA'],contextImages:['data:image/png;base64,BBBB'],sourceLabel:'ФИПИ · ОГЭ'},
 {id:'sequence',source:'sdamgia',sourceId:'12345',sourceLabel:'Решу ЕГЭ',sourceUrl:'https://math-ege.sdamgia.ru/problem?id=12345',kind:'sequence',answer:'0312',display:'0312',prompt:'Укажите последовательность.',solution:'Получаем последовательность 0312.'},
 {id:'open',source:'class',kind:'open',answer:null,display:'Утверждение доказано.',prompt:'Обоснуйте ответ.',solution:'Используйте теорему и обоснуйте вывод.',rubric:['Названа теорема','Получен вывод']},
 {id:'exam-open',source:'exam',kind:'open',answerKind:'open',answer:null,prompt:'Докажите утверждение.',solutionPages:[{page:9,image:'data:image/png;base64,CCCC'}]},
];
const work={title:'Смешанная работа',variant:'А',ids:catalog.map(q=>q.id),answers:true};
let checks=0;
const test=(condition,message)=>{checks++;assert.ok(condition,message);};
const equal=(actual,expected,message)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,message);};
const session=runner.createSession(work,catalog,{id:'qa-run',now:'2026-10-26T10:00:00.000Z'});
test(session.phase==='solving','new run starts solving');
test(session.id==='qa-run'&&session.title===work.title,'run identity and title snapshot');
work.ids.splice(0);work.title='Changed';equal(session.ids,catalog.map(q=>q.id),'changing constructor does not change run');
test(!runner.render(session,catalog).includes('Три разделить'),'constructor answers flag never exposes solutions');
runner.setDraft(session,'0,75');test(runner.submit(session,catalog,checker).correct,'numeric comma accepted');
test(runner.summary(session,catalog).independent===1,'independent success counted');
runner.reveal(session);test(runner.summary(session,catalog).independent===1,'reading solution after correct answer preserves independent outcome');
runner.setDraft(session,'3/4');runner.submit(session,catalog,checker);test(runner.summary(session,catalog).afterReveal===1,'new answer entered after reveal counts as assisted');
runner.go(session,1);runner.setDraft(session,'3; -2');test(runner.submit(session,catalog,checker).correct,'set order is irrelevant');
runner.setDraft(session,'3');test(!runner.submit(session,catalog,checker).correct,'missing set root rejected');
runner.setDraft(session,'-2;3');runner.submit(session,catalog,checker);
runner.go(session,2);runner.setDraft(session,'107,25');test(runner.submit(session,catalog,checker).correct,'FIPI numeric answer aliases normalized');
test(!runner.evaluate('107.25000001',catalog[2],checker).correct,'FIPI answer keeps exact official-trainer comparison');
test(runner.evaluate('429/4',catalog[2],checker).correct,'FIPI exact fractional input remains accepted');
const fipiMarkup=runner.render(session,catalog);test(fipiMarkup.includes('BBBB')&&fipiMarkup.includes('AAAA'),'official shared context and task images included');
test(fipiMarkup.includes('<p class="sr-only">Найдите высоту шины.</p>'),'official task image retains accessible text prompt');
runner.go(session,3);runner.setDraft(session,'312');test(!runner.submit(session,catalog,checker).correct,'sequence preserves leading zero');
runner.setDraft(session,'0 3 1 2');test(runner.submit(session,catalog,checker).correct,'sequence whitespace accepted');
const linked=runner.render(session,catalog);test(linked.includes('https://math-ege.sdamgia.ru/problem?id=12345')&&linked.includes('№ 12345'),'source task link and original ID displayed');
const exactAnswerCatalog=catalog.map(q=>q.id==='sequence'?{...q,answerHtml:'<span>Точная запись ответа</span>',display:'Голосовая запись формулы'}:q);
runner.reveal(session);const exactAnswerMarkup=runner.render(session,exactAnswerCatalog);
test(exactAnswerMarkup.includes('<span>Точная запись ответа</span>')&&!exactAnswerMarkup.includes('Голосовая запись формулы'),'source answer HTML replaces spoken formula text');
runner.go(session,4);runner.setDraft(session,'Используем теорему. Получаем утверждение.');
test(!runner.review(session,catalog),'open response cannot be reviewed before reading criteria');
test(!runner.submit(session,catalog,checker),'open response never auto-graded');
runner.reveal(session);test(!runner.review(session,catalog),'open response needs all rubric checks');
test(runner.render(session,catalog).includes('id="work-run-criterion-0"'),'criterion has stable ID for keyboard focus restoration');
runner.setCriterion(session,catalog,0,true);test(!runner.review(session,catalog),'partial rubric does not pass');
runner.setCriterion(session,catalog,1,true);test(runner.review(session,catalog),'complete rubric allows manual review');
test(runner.summary(session,catalog).reviewed===1&&runner.summary(session,catalog).correct===4,'manual review separate from numeric success');
runner.setCriterion(session,catalog,1,false);test(!session.records.open.reviewed,'changing a criterion invalidates review');
runner.setCriterion(session,catalog,1,true);runner.review(session,catalog);
runner.go(session,5);runner.setDraft(session,'Полное доказательство в тетради.');runner.reveal(session);
test(runner.render(session,catalog).includes('CCCC'),'official solution pages shown after reveal');
test(runner.review(session,catalog),'official open answer has explicit manual comparison without invented criteria');
const restored=runner.sanitizeSession(JSON.parse(JSON.stringify(session)),catalog,checker);
equal(restored,JSON.parse(JSON.stringify(session)),'drafts, selected task and criteria survive refresh');
const score=runner.finish(restored,catalog,checker);test(score.correct===4&&score.reviewed===2,'finish grades mixed work');
test(restored.phase==='results'&&!!restored.finishedAt,'finished phase and timestamp recorded');
test(!runner.setDraft(restored,'100'),'result view cannot silently alter draft');
const report=runner.exportResults(restored,catalog);test(report.format==='baza-work-results'&&report.finished,'downloadable result format');
test(report.tasks.find(q=>q.id==='open').correct===null&&report.tasks.find(q=>q.id==='open').reviewed,'export keeps manual and numeric checks distinct');
test(!JSON.stringify(report).includes('AAAA'),'result JSON excludes bulky task images');
test(!JSON.stringify(report).includes('solutionPages'),'result JSON excludes solution pages');
test(runner.render(restored,catalog).includes('Результаты работы'),'results screen rendered');
runner.reopen(restored);test(restored.phase==='solving'&&!restored.finishedAt,'reopen explicitly resumes work');
runner.go(restored,4);runner.setDraft(restored,'Новое рассуждение');test(!restored.records.open.reviewed&&!restored.records.open.checks.length,'editing open answer clears prior manual review');
const blank=runner.createSession({ids:catalog.map(q=>q.id)},catalog),blankScore=runner.finish(blank,catalog,checker);
test(blankScore.unanswered===4&&blankScore.openUnanswered===2&&blankScore.correct===0,'blank finish preserves unanswered counts');
const mixed=runner.createSession({ids:['class-number','class-set','open']},catalog);runner.setDraft(mixed,'1');runner.go(mixed,2);runner.setDraft(mixed,'Не проверенное доказательство.');
const mixedScore=runner.finish(mixed,catalog,checker);test(mixedScore.incorrect===1&&mixedScore.unanswered===1&&mixedScore.awaitingReview===1,'wrong, missing and awaiting review states distinct');
const beforeFinish=runner.createSession({ids:['class-number']},catalog);runner.setDraft(beforeFinish,'3/4');test(runner.finish(beforeFinish,catalog,checker).correct===1,'finish checks drafts never submitted individually');
runner.reveal(beforeFinish);test(runner.summary(beforeFinish,catalog).independent===1,'result solution reveal preserves independent score');
const forged=JSON.parse(JSON.stringify(beforeFinish));forged.records['class-number'].draft='999';forged.records['class-number'].correct=true;
test(!runner.sanitizeSession(forged,catalog,checker).records['class-number'].correct,'restore rechecks saved numeric correctness');
for(const raw of [null,{},[],{version:999,ids:['class-number']},{version:1,ids:[]},{version:1,ids:['unknown']}])test(runner.sanitizeSession(raw,catalog,checker)===null,'malformed session rejected');
test(runner.createSession({ids:{}},catalog)===null,'malformed work IDs rejected without throwing');
const dirty=runner.sanitizeSession({version:1,ids:['unknown','class-number','class-number'],index:999,phase:'<script>',records:{'class-number':{draft:'x'.repeat(5000),checks:[1,2],tries:-3}}},catalog,checker);
equal(dirty.ids,['class-number'],'unknown IDs and duplicates removed');test(dirty.index===0&&dirty.phase==='solving'&&dirty.records['class-number'].draft.length===4000,'restored bounds clamped');
test(!runner.setCriterion(dirty,catalog,999,true),'out-of-bounds criterion rejected');
test(!runner.go(dirty,NaN),'invalid index rejected');
const shifted=runner.sanitizeSession({version:1,ids:['removed','class-number','class-set'],index:1},catalog,checker);
test(shifted.ids[shifted.index]==='class-number','restore retains selected task after earlier task is removed');
const emptySubmit=runner.createSession({ids:['class-number']},catalog);runner.submit(emptySubmit,catalog,checker);
test(runner.exportResults(emptySubmit,catalog).tasks[0].correct===null,'blank response export stays unanswered rather than incorrect');
const hostile=runner.createSession({variant:'<img onerror=1>',title:'<script>',ids:['class-number']},catalog);runner.setDraft(hostile,'<script>alert(1)</script>');
const html=runner.render(hostile,catalog);test(!html.includes('<script>')&&!html.includes('variant="<img'),'user text escaped');
test(!runner.render({...hostile},[{...catalog[0],sourceUrl:'javascript:alert(1)'}]).includes('href="javascript:'),'unsafe source URL rejected');
console.log(JSON.stringify({checks,status:'passed'}));
