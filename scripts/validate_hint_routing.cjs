// Exercise actual hints across the complete class bank, with semantic regression
// cases for misleading words and declared generator methods. This is routing QA,
// not a claim of independent mathematical review of every source problem.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const bank=Array.from({length:7},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,`src/tasks/grade_${String(i+5).padStart(2,'0')}.json`),'utf8'))).flat();
const all=bank.flatMap(t=>t.tasks),byId=new Map(all.map(q=>[q.id,q])),snapshot=JSON.stringify(bank);
const context=vm.createContext({BANK:bank});
for(const name of ['learning-support','lesson-support'])vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),context);
const help=q=>context.MathLearning.help(q),words=q=>Object.values(help(q)).join(' ');
let checks=0,generated=0;const errors=[],models=new Set(),families=new Set();
const test=(ok,label)=>{checks++;if(!ok)errors.push(label);};
const expect=(q,pattern,label)=>{test(!!q,'task exists: '+label);if(q)test(pattern.test(words(q)),label);};
for(const q of all){
 const actual=help(q);
 test(typeof actual.hint==='string'&&actual.hint.trim().length>15&&typeof actual.step==='string'&&actual.step.trim().length>15,q.id+' has two readable stages');
 test(actual.hint!==actual.step&&actual.hint!==q.solution&&actual.step!==q.solution,q.id+' does not substitute its full solution for staged help');
 // The helper must be independent of correct answers, even when source objects
 // contain them. Throwing getters catch accidental answer/solution inspection.
 const guarded={...q};
 for(const field of ['answer','display','solution'])Object.defineProperty(guarded,field,{get(){throw Error('Hint read '+field+' for '+q.id);}});
 test(JSON.stringify(help(guarded))===JSON.stringify(actual),q.id+' hint is independent of its answer');
 if(q.hints){
  const pair=Array.isArray(q.hints)?q.hints:[q.hints.hint,q.hints.step];
  test(actual.hint===pair[0]&&actual.step===pair[1],q.id+' preserves authored assistance');
 }
 if(q.generation){
  generated++;models.add(q.generation.model);families.add(q.generation.model+':'+q.generation.form);
  // Contexts from a different topic must not change a declared method. Previously
  // the same generated family received probability, geometry or OДЗ advice merely
  // because it appeared in a differently named topic.
  const misleading={...q,prompt:'Прямоугольник, отрезок, площадь, вероятность, остаток.',topic:'Углы',topicTitle:'Площадь',subject:'Статистика'};
  test(JSON.stringify(help(misleading))===JSON.stringify(actual),q.id+' follows its declared method despite incidental topic words');
 }
}
test(all.length===7488,'complete 7488-task class bank was inspected');
test(generated===3744&&models.size===82&&families.size===164,'all 3744 generated tasks / 82 models / 164 model forms were inspected');
test(JSON.stringify(bank)===snapshot,'assistance leaves source tasks unchanged');

// The real application evaluates the helper while BANK is empty. Populate it
// later in reverse grade order and sort as the lazy loader does: caches must not
// depend on the initial load or on topics being appended at the end forever.
const lazyBank=[],lazyContext=vm.createContext({BANK:lazyBank});
vm.runInContext(fs.readFileSync(path.join(root,'src/learning-support.js'),'utf8'),lazyContext);
for(let grade=11;grade>=5;grade--){
 const added=bank.filter(topic=>topic.grade===grade);lazyBank.push(...added);lazyBank.sort((a,b)=>a.grade-b.grade);
 for(const topic of added)for(const q of topic.tasks)test(JSON.stringify(lazyContext.MathLearning.help(q))===JSON.stringify(help(q)),q.id+' lazy-loaded hint matches full-bank hint');
}

for(const [id,pattern,label] of [
 ['5-06-1',/Периметр.*внешней границы/,'rectangle perimeter is not an angle problem'],
 ['5-07-1',/площад/, 'rectangle area is not an angle problem'],
 ['5-211-5',/разделите часть на целое/, 'cut strip is a part-to-whole problem'],
 ['8-05-1',/Пифагор|a² \+ b² = c²/,'a genuine right triangle retains Pythagoras']
])expect(byId.get(id),pattern,label);

const model=(name,form=0)=>all.find(q=>q.generation?.model===name&&q.generation.form===form);
for(const [name,form,pattern,label] of [
 ['angles',0,/Смежные углы дают 180°/,'straight angle'],
 ['angles',1,/Смежные углы дают 180°/,'two adjacent angles'],
 ['triangle',0,/углы треугольника — 180°/,'triangle angle sum'],
 ['perimeter',0,/внешней границы/,'perimeter inverse problem'],
 ['rectangle',1,/площадь выреза/,'area with a removed square'],
 ['box',1,/поверхности|внешние грани/,'surface of a solid is not a planar angle problem'],
 ['solid_volume',0,/V = S основания · h/,'prism volume uses base area and height'],
 ['solid_volume',1,/треть этого произведения/,'pyramid volume includes one third'],
 ['cosine_rule',0,/c² = a² \+ b² − 2ab cos γ/,'non-right triangle uses the cosine rule'],
 ['cosine_rule',1,/квадрат стороны.*корень не нужно/,'squared side does not require a square root'],
 ['scale',1,/пропорци/,'map segment does not select segment addition'],
 ['graph_edges',1,/вершины и рёбра/,'tree graph does not select probability'],
 ['combinations',0,/порядок выбора/,'team selection uses combinations'],
 ['combinations',1,/порядок выбора/,'different posts require ordered selection'],
 ['linear_function',1,/пересечения двух графиков/,'intersection is a function problem'],
 ['similarity',0,/площади в k²/,'area scales quadratically'],
 ['volume_scale',1,/объёмы в k³/,'volume ratio is not a linear scale'],
 ['gcd_lcm',1,/НОД и НОК/,'periodic signals require a common multiple'],
 ['binomial',1,/pᵏ\(1 − p\)ⁿ⁻ᵏ/,'success count uses the binomial model'],
 ['conditional',1,/P\(A\).*P\(B\)/,'independent joint events multiply probabilities'],
 ['composition',0,/сначала найдите g\(x\)/,'composition preserves function order'],
 ['composition',1,/g\(f\(x\)\).*порядок обратный/,'reverse composition is distinct'],
 ['integral',1,/первообразную/,'known derivative requires an antiderivative'],
 ['advanced_integral',1,/площади.*участки выше и ниже оси/,'area under a graph is not segment addition'],
 ['sphere',0,/S = 4πR²/,'sphere surface'],
 ['frustum',1,/S = π\(R \+ r\)l/,'frustum lateral surface'],
 ['sphere_section',0,/r² = R² − d²/,'sphere section radius'],
 ['uniform',1,/\(b − a\)²\/12/,'uniform variance'],
 ['poisson',1,/D\(X\) = λ/,'Poisson variance'],
 ['polynomial_remainder',0,/остаток равен P\(a\)/,'polynomial remainder is not integer division'],
 ['polynomial_remainder',1,/Cₙᵏaⁿ⁻ᵏ/,'binomial coefficient'],
 ['spatial_distance',1,/a² \+ b² \+ c²/,'space diagonal'],
 ['optimization',0,/−b\/\(2a\)/,'optimization uses the quadratic extremum']
])expect(model(name,form),pattern,label);

// Authored tasks without generator metadata still need correct semantic routing.
for(const [prompt,pattern]of [
 ['Один угол прямоугольного треугольника равен 30°. Найдите второй острый угол.',/углы треугольника — 180°/],
 ['Периметр многоугольника равен сумме пяти сторон. Найдите периметр.',/внешней границы/],
 ['Площадь основания пирамиды равна 12 см², высота равна 3 см. Найдите объём.',/треть этого произведения/],
 ['Найдите площадь поверхности сферы радиуса 4 см.',/4πR²/],
 ['Радиус цилиндра 2 см и высота 4 см. Найдите площадь полной поверхности.',/2πrh \+ 2πr²/],
 ['Найдите остаток от деления многочлена P(x) на x − 3.',/P\(a\)/]
])expect({prompt,kind:'number'},pattern,prompt);

// Worked-example rule selection has an independent geometry router. Protect it
// from the same substring collision without replacing its source solution.
function exampleFor(q,topic){const practice={...q,id:'hint-routing-probe',canonicalId:'hint-routing-probe'};return context.MathLessons.example({...topic,tasks:[q,practice]},practice);}
for(const id of ['5-06-1','5-211-5','5-07-1']){
 const q=byId.get(id),topic=bank.find(t=>t.tasks.some(q=>q.id===id)),example=exampleFor(q,topic);
 test(!!example&&!/Смежные углы|два острых угла/.test(example.theorem),id+' worked example does not mistake the shape name for an angle');
}
const report={checks,errors,classTasks:all.length,generatedTasks:generated,models:models.size,modelForms:families.size,scope:'Full-bank hint generation and answer-independence; targeted semantic routing regressions, not a full teacher review.'};
fs.writeFileSync(path.join(root,'checks/hint-routing-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
