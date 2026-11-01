// Independent client-format checks for the authored 10 × 8 pilot. mathCheck is
// deliberately not executed here: the independent Python math audit owns it.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),bank=JSON.parse(fs.readFileSync(path.join(root,'src/method-bank/bank.json'),'utf8')),context=vm.createContext({console});
for(const file of ['src/answer-formats.js','src/app.js','src/work-runner.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').split('/* UI */')[0],context,{filename:file});
const F=context.MathAnswerFormats,R=context.MathWorkRunner,checkAnswer=context.checkAnswer,byId=new Map(bank.tasks.map(q=>[q.id,q]));
context.METHOD_BANK={};vm.runInContext(fs.readFileSync(path.join(root,'data/method-bank.js'),'utf8'),context,{filename:'data/method-bank.js'});
const shipped=context.METHOD_BANK,shippedById=new Map(shipped.tasks.map(q=>[q.id,q]));
let checks=0;const errors=[],testedKinds=new Set(),exampleValidators=new Set();
const check=(condition,message)=>{checks++;if(!condition)errors.push(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const evaluate=(raw,q)=>R.evaluate(raw,q,checkAnswer);
check(bank.tasks.length===80&&byId.size===80,'80 distinct tasks');check(bank.topics.length===10&&new Set(bank.topics.map(t=>t.id)).size===10,'10 distinct pilot topics');
check(shippedById.size===80,'80 distinct tasks in the actual browser data');
const methodIds=new Set(bank.methods.map(m=>m.id));check(methodIds.size===bank.methods.length,'method IDs are unique');
for(const topic of bank.topics){
 const tasks=bank.tasks.filter(q=>q.topicId===topic.id),counts=tasks.reduce((out,q)=>{out[q.category]=(out[q.category]||0)+1;return out;},{});
 check(tasks.length===8,topic.id+': exactly eight tasks');check(same(counts,{contrast:4,steps:2,representation:1,boundary:1}),topic.id+': 4 contrast, 2 steps, 1 representation, 1 boundary task');
 check(Array.isArray(topic.methodIds)&&topic.methodIds.length>=3&&topic.methodIds.every(id=>methodIds.has(id)),topic.id+': at least three defined methods');
 const pairs=new Map();for(const q of tasks.filter(q=>q.category==='contrast')){if(!pairs.has(q.contrastPairId))pairs.set(q.contrastPairId,[]);pairs.get(q.contrastPairId).push(q);}
 check(pairs.size===2&&[...pairs.values()].every(pair=>pair.length===2&&pair[0].prompt!==pair[1].prompt),topic.id+': two distinct contrast pairs');
 for(const pair of pairs.values())if(pair.length===2)check(pair.every(q=>q.relatedIds.includes(pair.find(other=>other!==q).id)),topic.id+': contrast navigation is reciprocal');
}
for(const q of bank.tasks){
 const deployed=shippedById.get(q.id);check(!!deployed&&deployed.kind===q.kind&&deployed.display===q.display&&same(deployed.answer,q.answer),q.id+': shipped answer matches source');
 check(deployed&&!Object.hasOwn(deployed,'mathCheck'),q.id+': independent check code is excluded from browser data');
 testedKinds.add(q.kind);
 check(q.source==='methods'&&q.grade>=5&&q.grade<=11&&['basic','advanced'].includes(q.level),q.id+': source, grade and program');
 check(['number','set','open',...F.kinds].includes(q.kind),q.id+': supported format');
 check(typeof q.prompt==='string'&&q.prompt.trim()&&typeof q.solution==='string'&&q.solution.trim()&&typeof q.display==='string'&&q.display.trim(),q.id+': complete condition, answer and solution');
 check(Array.isArray(q.solutionSteps)&&q.solutionSteps.length>=3&&q.solutionSteps.every(step=>typeof step.statement==='string'&&step.statement.trim()&&typeof step.reason==='string'&&step.reason.trim()),q.id+': solution steps have reasons');
 check(['methodChoice','rationale','domain','check'].every(key=>typeof q[key]==='string'&&q[key].trim()),q.id+': method passport has rationale, domain and check');
 check(Array.isArray(q.methodIds)&&q.methodIds.length>0&&q.methodIds.every(id=>methodIds.has(id)&&bank.topics.find(t=>t.id===q.topicId).methodIds.includes(id)),q.id+': task method belongs to its topic');
 check(Number.isSafeInteger(q.revision)&&q.revision>0&&q.editorialStatus==='teacher_pending',q.id+': explicit revision and editorial status');
 check(F.validateTask(q).valid,q.id+': answer schema '+F.validateTask(q).errors.join('; '));
 if(q.kind==='open'){check(Array.isArray(q.rubric)&&q.rubric.length>=3,q.id+': open answer has explicit criteria');check(!evaluate(q.display,q).correct,q.id+': open answer is not automatically graded');continue;}
 check(deployed&&F.validateTask(deployed).valid&&evaluate(deployed.display,deployed).correct,q.id+': actual shipped schema and display work through the client checker');
 check(evaluate(q.display,q).correct,q.id+': displayed authored answer is accepted');
 const session=R.createSession({ids:[q.id]},[q]);R.setDraft(session,q.display);check(R.submit(session,[q],checkAnswer)?.correct,q.id+': standalone runner accepts the displayed answer');
 check(R.sanitizeSession(JSON.parse(JSON.stringify(session)),[q],checkAnswer)?.records[q.id].correct,q.id+': accepted result survives restoration');
 if(q.kind==='number')check(!evaluate(String(q.answer+137),q).correct,q.id+': a different numeric result is rejected');
 if(q.kind==='set'){const wrong=q.answer.length?q.answer.slice(0,-1).join(';')||'137':'0';check(!evaluate(wrong,q).correct,q.id+': an incomplete or extra root is rejected');}
 if(q.kind==='coordinates'){
  check(evaluate('('+q.answer.join(';')+')',q).correct,q.id+': parenthesized coordinate pair accepted');
  check(!evaluate([Number(q.answer[0])+1,q.answer[1]].join(';'),q).correct,q.id+': a changed first coordinate is rejected');check(!evaluate(q.display+';0',q).valid,q.id+': a third coordinate is a format error');
 }
 if(q.kind==='interval'){
  const finite=q.answer.find(row=>row.lo!==null||row.hi!==null);
  if(finite){const mutated=q.answer.map(row=>({...row})),row=mutated[q.answer.indexOf(finite)];if(row.lo!==null)row.loClosed=!row.loClosed;else row.hiClosed=!row.hiClosed;
   const raw=mutated.map(r=>(r.loClosed?'[':'(')+(r.lo===null?'-∞':r.lo)+';'+(r.hi===null?'+∞':r.hi)+(r.hiClosed?']':')')).join('∪');check(!evaluate(raw,q).correct,q.id+': changing finite-boundary inclusion changes the answer');
  }else check(!evaluate('(0;+∞)',q).correct,q.id+': all real numbers cannot be replaced by a half-line');
  check(!evaluate('[-∞;+∞]',q).valid,q.id+': infinity cannot be a closed endpoint');
 }
 if(q.kind==='expression'){
  const parts=q.display.split('|'),domain=parts[1]?' | '+parts[1]:'',expr=parts[0].trim();
  check(evaluate(`1*(${expr})${domain}`,q).correct,q.id+': an algebraically equivalent expression is accepted');check(!evaluate(`(${expr})+1${domain}`,q).correct,q.id+': a non-equivalent expression is rejected');
  if(q.answer.domain.excluded.length)check(!evaluate(expr,q).correct,q.id+': original exclusions cannot be omitted');
  let forbidden=23;while(q.answer.domain.excluded.includes(forbidden))forbidden++;
  const extra=(q.answer.domain.excluded.length?domain+'; ':' | ')+`x!=${forbidden}`;
  check(!evaluate(expr+extra,q).correct,q.id+': an extra restriction is rejected');
  check(!evaluate(`(${expr})*(x-${forbidden})/(x-${forbidden})${domain}`,q).correct,q.id+': cancellation cannot conceal a new denominator hole');
 }
 if(q.kind==='matching'){
  const entries=Object.entries(q.answer),options=new Set(q.matchingOptions.map(item=>item.id));check(entries.every(([a,b])=>q.matchingItems.some(item=>item.id===a)&&options.has(b)),q.id+': matching IDs exist on both sides');
  check(evaluate([...entries].reverse().map(([a,b])=>a+'-'+b).join(';'),q).correct,q.id+': input order of correspondences does not matter');
  const first=entries[0],different=entries.findIndex(([,v])=>v!==first[1]),wrong=entries.map(pair=>[...pair]);if(different>0){[wrong[0][1],wrong[different][1]]=[wrong[different][1],wrong[0][1]];check(!evaluate(wrong.map(([a,b])=>a+'-'+b).join(';'),q).correct,q.id+': incorrect correspondence is rejected');}
  check(!evaluate(q.display+';'+entries[0][0]+'-'+entries[0][1],q).valid,q.id+': duplicate left-side input rejected');
 }
 if(q.kind==='steps'){
  const alternate=[...q.answer];[alternate[0],alternate[1]]=[alternate[1],alternate[0]];check(!evaluate(alternate.join(';'),q).correct,q.id+': a different step order is rejected');check(!evaluate(q.answer.slice(0,-1).join(';'),q).correct,q.id+': a missing step is rejected');
  const html=F.renderPrompt(q);check(q.stepOptions.every(option=>html.includes(option.id)),q.id+': all step options are rendered before answering');
 }
 if(q.kind==='examples'){
  exampleValidators.add(q.validator.name);check(Array.isArray(q.acceptedExamples)&&new Set(q.acceptedExamples).size>=3,q.id+': at least three constructive examples');
  for(const raw of q.acceptedExamples||[])check(evaluate(raw,q).correct,q.id+': constructive example '+raw+' accepted');
  check(!evaluate('0;0',q).correct,q.id+': degenerate zero pair rejected');check(!evaluate('1.5;2.25',q).valid,q.id+': noninteger construction rejected');
 }
}
check(exampleValidators.size===4,'all four named constructive validators appear in the source');
const steps=bank.tasks.filter(q=>q.kind==='steps');check(steps.some(q=>!same(q.answer,[...q.answer].sort())), 'step IDs do not encode the correct order for every task');
const firstDomain=byId.get('methods-domain-01'),secondDomain=byId.get('methods-domain-02');check(firstDomain.answer.expression===secondDomain.answer.expression,'domain contrast pair uses the same simplified expression');check(!evaluate(firstDomain.display,secondDomain).correct&&!evaluate(secondDomain.display,firstDomain).correct,'the two original domains remain distinct');
// Independent condition-based checks of the easy-to-confuse percentage models.
for(const [id,answer] of Object.entries({'methods-percent-01':1000*1.2*0.8,'methods-percent-02':1000+1000*0.2-1000*0.2,'methods-percent-03':1500/0.75,'methods-percent-04':1500*1.25,'methods-models-03':400*1.1,'methods-models-04':4000/9}))check(Math.abs(byId.get(id).answer-answer)<1e-9,id+': amount and percentage base agree with the condition');
check(/положительн|P\s*>\s*0/i.test(byId.get('methods-percent-08').prompt),'strict price decrease explicitly assumes a positive initial price in the visible condition');
check(byId.get('methods-models-06').solution.includes('11600')&&byId.get('methods-models-06').solution.includes('11664'),'ambiguous annual growth explains both specified assumptions');
check(/случайн|представительн/.test(byId.get('methods-models-08').solution),'sampling solution answers the requested survey-improvement part');
console.log(JSON.stringify({checks,tasks:bank.tasks.length,kinds:[...testedKinds],errors,scope:'Real client schemas and all authored displays; negative boundary/domain/representation cases; independent base-of-percentage checks. Python owns mathCheck claims.'},null,2));
if(errors.length)process.exitCode=1;
