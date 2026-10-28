// Verify pedagogical metadata against real bank records and edge cases.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),context={};
vm.runInNewContext(fs.readFileSync(path.join(root,'src/bank-pedagogy.js'),'utf8'),context);
const p=context.MathBankPedagogy,plain=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function test(condition,label){checks++;assert.ok(condition,label);}
const classes=Array.from({length:7},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,`src/tasks/grade_${String(i+5).padStart(2,'0')}.json`),'utf8'))).flat().flatMap(topic=>topic.tasks.map(q=>({...q,source:'class',topicId:topic.id,topic:topic.title,grade:topic.grade,level:topic.level||'basic'})));
const source=JSON.parse(fs.readFileSync(path.join(root,'src/sdamgia/bank.json'),'utf8')).tasks;
const snapshot=JSON.stringify([classes,source]);
const tagged=(q,id)=>p.forTask(q).includes(id),byId=id=>classes.find(q=>q.id===id);
const model=(name,form=0)=>classes.find(q=>q.generation?.model===name&&q.generation.form===form);

test(p.definitions.length>=30,'specific skills cover calculations, equations, geometry, data and reasoning');
test(new Set(p.definitions.map(d=>d.id)).size===p.definitions.length,'skill identifiers are unique');
const known=new Set(p.definitions.map(d=>d.id));
test(p.definitions.every(d=>d.title&&d.explanation&&d.prerequisites.every(id=>known.has(id)&&id!==d.id)),'every skill has guidance and valid prerequisite links');
function acyclic(id,seen=new Set()){if(seen.has(id))return false;const next=new Set([...seen,id]);return p.definitions.find(d=>d.id===id).prerequisites.every(child=>acyclic(child,next));}
test(p.definitions.every(d=>acyclic(d.id)),'prerequisites contain no cycles');
assert.deepEqual(plain(p.normalize(['domain','unknown','domain','operations'])),['operations','domain']);checks++;
assert.deepEqual(plain(p.forTask({prompt:'Решите уравнение 2x = 4.',skills:[]})),[]);checks++;
assert.deepEqual(plain(p.forTask({prompt:'Найдите площадь.',skills:['counterexample','unknown']})),['counterexample']);checks++;
test(p.matches({},[])&&!p.matches({},['unknown'])&&!p.matches({},null),'empty filter passes while unknown or malformed filters do not');
test(tagged(byId('7-01-1'),'linear-equation')&&!tagged(byId('7-01-1'),'brackets'),'an unbracketed linear equation is not tagged as bracket practice');
test(tagged(byId('7-01-2'),'brackets')&&tagged(byId('7-01-2'),'linear-equation'),'a real equation requiring expansion has both skills');
test(!tagged(byId('7-01-3'),'linear-equation'),'topic membership alone does not imply a specific equation operation');
test(tagged(model('linear',1),'brackets')&&!tagged(model('linear',0),'brackets'),'generated linear forms are differentiated');
test(tagged(model('rational',1),'domain'),'rational equation includes domain restrictions');
test(tagged({prompt:'Решите уравнение 1/x = 2.'},'domain')&&!tagged({prompt:'Решите уравнение 1/x = 2.'},'linear-equation'),'a variable denominator is not treated as a linear equation');
test(tagged({prompt:'Решите уравнение x/x = 1.'},'domain')&&!tagged({prompt:'Решите уравнение x/x = 1.'},'linear-equation'),'plain variable-over-variable form preserves domain restrictions');
test(tagged({prompt:'Решите уравнение 1/−x = 2.'},'domain')&&!tagged({prompt:'Решите уравнение 1/−x = 2.'},'linear-equation'),'signed variable denominator remains rational');
test(tagged(byId('10-02-2'),'logarithms')&&!tagged(byId('10-02-2'),'linear-equation'),'actual logarithmic equation is not misclassified as linear');
test(tagged(byId('10-02-9'),'logarithms')&&!tagged(byId('10-02-9'),'linear-equation'),'a logarithm with subscript variable base stays logarithmic');
test(!tagged(byId('7-207-2'),'linear-equation')&&!tagged({prompt:'Решите уравнение (x − 1)(x + 2) = 0.'},'linear-equation'),'products of variable factors are not classified as linear equations');
test(tagged({prompt:'Решите уравнение 5(x − 2) = 2x + 8.'},'linear-equation'),'numeric bracket multipliers still qualify as linear equations');
test(tagged(model('irrational_equation'),'root-selection'),'irrational equation includes checking roots');
test(tagged(model('statistics',0),'mean')&&!tagged(model('statistics',0),'median'),'mean and median are separate skills');
test(tagged(model('statistics',1),'median')&&!tagged(model('statistics',1),'mean'),'median model does not inherit mean');
test(!tagged({prompt:'В треугольнике проведена медиана. Найдите её длину.'},'median'),'a geometric median is not a statistical median');
test(!tagged({prompt:'График y = k/x проходит через точку (2; 3). Найдите k.'},'graph-reading'),'formula and point problems are not classified as reading a supplied graph');
test(tagged({prompt:'На рисунке изображён график функции. Найдите f(2).'},'graph-reading'),'a supplied graph is identified as graph reading');
test(!tagged({prompt:'На графике функции y = x² найдите абсциссу вершины.'},'graph-reading'),'a graph word alone does not imply a supplied visual');
test(tagged(model('linear_function',1),'function-intersection'),'intersection model receives its own skill');
test(tagged(model('pythagoras'),'pythagoras')&&tagged(model('volume_scale'),'similarity'),'geometry models retain specific method tags');
test(!tagged(model('pythagoras',1),'angles'),'the word triangle does not falsely classify a side/area problem as finding angles');
test(tagged(model('derivative'),'derivative')&&tagged(model('integral'),'integral'),'calculus models have specific tags');
test(tagged(model('probability'),'probability')&&!tagged(model('conditional'),'probability'),'classical equally-likely model is not conflated with conditional probability');
test(source.some(q=>tagged(q,'domain'))&&source.some(q=>tagged(q,'root-selection')),'source-backed plain text is classified without parsing image HTML');
for(const q of [...classes,...source])test(p.forTask(q).every(id=>known.has(id)),q.id+' has only known tags');

test(p.familyKey({id:'a',canonicalId:'c',subtypeId:'s',family:'f'})==='f','explicit family takes precedence');
test(p.familyKey({id:'a',canonicalId:'c',subtypeId:'s'})==='s','source subtype is a grouping key');
test(p.familyKey({id:'a',canonicalId:'c'})==='c'&&p.familyKey({id:'a'})==='a','unclassified tasks use canonical or unique identity');
const coveragePool=[
 {id:'one',family:'family',topicId:'t',topic:'Тема',grade:7,level:'basic',source:'class',kind:'number',difficulty:'Базовый'},
 {id:'two',family:'family',topicId:'t',topic:'Тема',grade:7,level:'basic',source:'class',kind:'open',difficulty:'Повышенный',skills:['justification']},
 {id:'three',canonicalId:'original',topicId:'t',topic:'Тема',grade:7,level:'basic',source:'class',kind:'number',difficulty:'Средний'},
 {id:'four',canonicalId:'original',topicId:'t',topic:'Тема',grade:7,level:'basic',source:'class',kind:'number',difficulty:'Средний'}
];
const row=p.coverage([...coveragePool,coveragePool[0]])[0];
test(row.count===4&&row.families===2&&row.taggedFamilies===1&&row.unclassified===2,'coverage distinguishes authored families, canonical groups and unclassified records');
test(row.open===1&&row.difficulties['Средний']===2&&row.skills.includes('justification'),'coverage counts actual formats, difficulty and skills');
test(row.gaps.includes('Менее двух размеченных семейств')&&!row.gaps.includes('Нет заданий с развёрнутым рассуждением'),'gaps describe missing metadata without inventing independent methods');
test(p.coverage([{...coveragePool[0],id:'enrichment-one',source:'enrichment'},coveragePool[0]]).length===2,'source banks with matching topic IDs remain distinguishable');
test(p.coverage(classes).reduce((sum,r)=>sum+r.count,0)===classes.length,'all class records are accounted for exactly once');
test(p.coverage(null).length===0,'invalid coverage input gives an empty map');

const original={id:'original',canonicalId:'same',grade:7,level:'basic',topicId:'linear',difficulty:'Средний',skills:['linear-equation']};
const simple={id:'simple',grade:7,level:'basic',topicId:'linear',difficulty:'Базовый',skills:['linear-equation']};
const practice={id:'practice',grade:7,level:'basic',topicId:'linear',difficulty:'Средний',skills:['linear-equation']};
const duplicate={...original,id:'duplicate'};
const higher={...practice,id:'higher',grade:11};
const advanced={...practice,id:'advanced',level:'advanced'};
const wrong={...practice,id:'wrong-skill',skills:['mean']};
const recoveryPool=[original,duplicate,higher,advanced,wrong,simple,practice];
const plan=p.recovery(original,recoveryPool);
test(plan.skillId==='linear-equation'&&plan.simple.id==='simple'&&plan.practice.id==='practice'&&!plan.missing.length,'recovery selects a simple check and a new same-skill practice task');
test(plan.explanation===p.definitions.find(d=>d.id===plan.skillId).explanation,'guidance refers to the tagged skill rather than guessing the learner error');
const short=p.recovery(original,[original,duplicate,higher,advanced,wrong,simple]);
test(short.simple.id==='simple'&&short.practice===null&&short.missing.includes('practice'),'a small pool reports shortage instead of recycling source/canonical duplicate');
const unknown=p.recovery({id:'unclassified',prompt:'Задание без разметки.'},recoveryPool);
test(unknown.skillId===null&&!unknown.simple&&!unknown.practice&&unknown.missing.includes('skill'),'unclassified original receives no guessed recovery plan');
const excluded=p.recovery(original,recoveryPool,{excludeIds:['simple']});
test(excluded.simple.id==='practice'&&excluded.practice===null,'explicit exclusions are honored without duplicating recovery stages');
const hard=p.recovery({...original,difficulty:'Базовый'},[{...practice,difficulty:'Суперсложный'}]);
test(!hard.simple&&!hard.practice,'a hard task cannot silently replace either stage of a basic recovery sequence');
const sameCanonical=p.recovery(original,[{...simple,canonicalId:'exercise'}, {...practice,canonicalId:'exercise'}]);
test(sameCanonical.simple&&!sameCanonical.practice,'separate recovery stages must have different canonical content');
const geometryPlan=p.recovery(model('pythagoras',1),classes);
test(geometryPlan.skillId==='pythagoras'&&geometryPlan.simple&&geometryPlan.practice,'recovery preserves the known generating method over a more common incidental skill');
test(p.recovery(model('pythagoras',1),classes,{skillId:'area'}).skillId==='area','an explicitly diagnosed and relevant skill can focus recovery');
test(p.recovery(original,recoveryPool,null).skillId==='linear-equation','malformed optional recovery options are handled safely');
const frozen=Object.freeze(recoveryPool.map(q=>Object.freeze({...q,skills:Object.freeze([...q.skills])})));
p.recovery(Object.freeze(original),frozen);p.coverage(frozen);
test(JSON.stringify([classes,source])===snapshot,'classification, coverage and recovery do not change canonical task contents');
console.log(JSON.stringify({checks,skills:p.definitions.length,classTasks:classes.length,sourceTasks:source.length,status:'passed'}));
