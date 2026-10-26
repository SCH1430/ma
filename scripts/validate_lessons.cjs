// Source-backed lesson and misconception checks. No browser or server is needed.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const bank=Array.from({length:7},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,`src/tasks/grade_${String(i+5).padStart(2,'0')}.json`),'utf8'))).flat();
const snapshot=JSON.stringify(bank),context=vm.createContext({BANK:bank});
const source=name=>fs.readFileSync(path.join(root,'src',name+'.js'),'utf8');
vm.runInContext(source('app').split('/* UI */')[0],context);
vm.runInContext(['geometry-core','geometry-planar','geometry-spatial','math-figures'].map(source).join('\n'),context);
vm.runInContext(source('lesson-support'),context);
const lessons=context.MathLessons,all=bank.flatMap(t=>t.tasks),byId=new Map(all.map(q=>[q.id,q]));
let checks=0;const errors=[],methods=new Set(),examples=new Set(),stepCounts=[],pairs=[];
const test=(ok,label)=>{checks++;if(!ok)errors.push(label)};
const normalized=s=>String(s).replace(/\s+/g,' ').trim();
const numbers=s=>new Set(String(s).match(/[−-]?\d+(?:[.,]\d+)?/g)||[]);
test(!!lessons&&typeof lessons.example==='function'&&typeof lessons.feedback==='function','classic-script API');
test(lessons.example(null)===null&&lessons.example('missing-topic')===null,'invalid topics are ignored');
test(lessons.example({id:'one',tasks:[all[0]]})===null,'one task cannot be both example and practice');
test(!/\b(?:document|window|fetch|XMLHttpRequest|WebSocket|localStorage)\b/.test(source('lesson-support')),'lesson support has no UI, network or storage dependency');

for(const topic of bank){
  const lesson=lessons.example(topic);
  test(!!lesson,topic.id+' has a worked example');if(!lesson)continue;
  const q=byId.get(lesson.id),practice=byId.get(lesson.practiceId),ids=new Set(topic.tasks.map(q=>q.id));
  test(!!q&&!!practice&&ids.has(q.id)&&ids.has(practice.id)&&q.id!==practice.id,topic.id+' example and practice are different tasks in this topic');
  test(lesson.prompt===q.prompt&&lesson.answer===q.display,topic.id+' example uses its source condition and exact answer');
  test(Array.isArray(lesson.steps)&&lesson.steps.length>0&&lesson.steps.every(s=>typeof s==='string'&&s.trim().length>2),topic.id+' meaningful source steps');
  test(normalized(lesson.steps.join(' '))===normalized(q.solution),topic.id+' complete source solution survives step splitting');
  test(typeof lesson.theorem==='string'&&lesson.theorem.length>35&&!lesson.theorem.startsWith('Используем определение'),topic.id+' specific mathematical rule');
  test(Array.isArray(lesson.given)&&lesson.given.length>0&&lesson.given.every(s=>typeof s==='string'&&s.length>3)&&typeof lesson.find==='string'&&lesson.find.length>5,topic.id+' given and goal are readable');
  const inputNumbers=numbers(q.prompt);
  test([...numbers(lesson.given.join(' '))].every(n=>inputNumbers.has(n)),topic.id+' givens contain no invented numerical data');
  test(lesson.figureId===null||lesson.figureId===q.id&&!!context.geometryFigure(q.id),topic.id+' figure belongs to the example');
  methods.add(lesson.theorem);examples.add(q.id);stepCounts.push(lesson.steps.length);
  pairs.push({topic:topic.id,example:q.id,practice:practice.id,steps:lesson.steps.length});
  for(const active of topic.tasks){
    const e=lessons.example(topic,active),others=topic.tasks.filter(q=>q.id!==active.id&&q.canonicalId!==active.canonicalId||q.id!==active.id&&!q.canonicalId);
    test(!!e&&e.id!==active.id&&e.practiceId===active.id,active.id+' active practice is never the revealed example');
    if(!e)continue;
    const chosen=byId.get(e.id),sameKind=others.filter(q=>q.kind===active.kind);
    test(!sameKind.length||chosen.kind===active.kind,active.id+' examples preserve response format when available');
    const siblings=others.filter(q=>q.kind===active.kind&&q.generation?.model===active.generation?.model&&q.generation?.form===active.generation?.form&&active.generation);
    if(siblings.length)test(chosen.generation?.model===active.generation.model&&chosen.generation?.form===active.generation.form,active.id+' parameter variants teach the same model and form');
  }
}
test(methods.size>=45,'examples explain diverse mathematical methods');
test(examples.size===bank.length,'every topic has its own source example');
test(stepCounts.filter(n=>n>1).length>=bank.length*.8,'most examples show several actual source transitions');
test(JSON.stringify(bank)===snapshot,'lessons do not alter the source bank or task order');

// These conditions contain misleading keywords for a broad topic-based rule.
for(const [id,fragment] of [
  ['5-215-7','12a'],['6-217-2','90°'],['6-228-4','πr + 2r'],
  ['7-07-3','Биссектриса'],['7-212-7','накрест'],['7-218-3','PA = PB'],
  ['8-06-5','S = ah'],['9-220-16','ab sin γ/2'],
  ['10-108-3','апофема'],['10-317-2','|cos α|'],
  ['10-318-3','n(n − 3)'],['11-221-3','k³'],['11-318-7','2πR²']
]){
  const topic=bank.find(t=>t.tasks.some(q=>q.id===id)),task=byId.get(id),practice={...task,id:'practice-probe',canonicalId:'practice-probe'};
  const e=lessons.example({...topic,tasks:[task,practice]},practice);
  test(e.theorem.includes(fragment),id+' rule matches the actual construction');
}

const feedback=(q,raw)=>lessons.feedback(q,raw,context.parseAnswer);
const q=id=>byId.get(id);
const model=(name,form)=>all.find(q=>q.generation?.model===name&&q.generation.form===form);
const positive=(task,input,fragment,label)=>{
  const message=feedback(task,input);
  test(typeof message==='string'&&message.startsWith('Проверьте')&&message.includes(fragment),label);
};
positive(q('10-104-1'),'30;150','радианах','recognize degree roots entered for radians');
positive(q('11-107-1'),'120','радианах','recognize a degree period entered for radians');
positive({kind:'number',answer:30,angleUnit:'degree',prompt:'Найдите угол в градусах.'},'pi/6','градусах','recognize radians entered for degrees');
const similarity=model('similarity',0),similarityN=similarity.generation.parameter;
positive(similarity,String(4*(similarityN%7+2)*1.5),'квадрат','area needs the square of the similarity factor');
positive(similarity,'1.5','квадрат','linear factor is not the requested area');
const volume=model('volume_scale',0),volumeN=volume.generation.parameter,k=volumeN%4+2;
positive(volume,String((volumeN+3)**3*k),'k³','volume needs the cube of the scale factor');
positive(model('volume_scale',1),String((model('volume_scale',1).generation.parameter%4+2)**3),'k³','volume ratio is not the linear ratio');
const pyramid=model('solid_volume',1);
positive(pyramid,String(pyramid.answer*3),'1/3','pyramid volume needs one third');
positive(q('11-108-4'),String(q('11-108-4').answer*3),'1/3','cone volume needs one third');
positive(q('5-06-1'),'15','периметр','rectangle area is not its perimeter');
positive(q('5-07-5'),'28','периметр','square perimeter is not its area');
positive(q('8-05-1'),String(q('8-05-1').answer**2),'корень','Pythagoras gives a squared length first');
positive(q('8-05-1'),'7','квадраты','sum of legs is not the hypotenuse');

for(const task of all){
  if(task.kind==='open')continue;
  test(feedback(task,task.display)===null,task.id+' correct answer receives no misconception warning');
}
for(const [task,input]of [[q('10-104-1'),'1;2'],[q('10-104-1'),'30;150;180'],[q('11-107-1'),'17'],[q('5-06-1'),'9999'],[q('5-07-5'),'1'],[q('8-05-1'),'2'],[pyramid,'7.12345'],[q('7-215-13'),'3']])test(feedback(task,input)===null,task.id+' unfamiliar error has no guessed diagnosis: '+input);
for(const input of ['', 'unknown','1/0','<script>'])test(feedback(q('8-05-1'),input)===null,'invalid input has no guessed diagnosis: '+input);
test(lessons.feedback(q('8-05-1'),'7',null)===null,'missing parser is handled');
test(feedback({kind:'number',answer:4,prompt:'Объём пирамиды 16 см³, площадь основания 12 см². Найдите высоту.'},'12')===null,'volume rule is not applied to a height question');
test(feedback({kind:'number',answer:12,prompt:'Цилиндр и конус имеют суммарный объём 48 см³. Найдите объём конуса.'},'36')===null,'one-third rule does not guess the reasoning for composite-body equations');
const pythagorasArea=model('pythagoras',1);
test(feedback(pythagorasArea,String(pythagorasArea.answer**2))===null,'Pythagoras area question is not mistaken for a missing square root of a length');
test(feedback({kind:'number',answer:15,prompt:'Стороны прямоугольника 5 и 3. Найдите площадь.'},'15')===null,'a correct answer wins over competing error patterns');

const report={checks,errors,topics:bank.length,examples:examples.size,methods:methods.size,multipleStepExamples:stepCounts.filter(n=>n>1).length,practicePairs:pairs};
fs.writeFileSync(path.join(root,'checks/lessons-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,practicePairs:report.practicePairs.length},null,2));
if(errors.length)process.exitCode=1;
