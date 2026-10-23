const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'checks/bank.json'),'utf8'));
const code=fs.readFileSync(path.join(root,'src/app.js'),'utf8').split('/* UI */')[0];
const ctx={BANK:bank};vm.createContext(ctx);vm.runInContext(code+'\n'+fs.readFileSync(path.join(root,'src/math-figures.js'),'utf8'),ctx);
let checks=0;const errors=[];const test=(cond,label)=>{checks++;if(!cond)errors.push(label)};
const check=(v,q)=>ctx.checkAnswer(v,q);
for(const t of bank)for(const q of t.tasks){
 test(check(q.display,q).correct,q.id+' display');
 const values=Array.isArray(q.answer)?q.answer:[q.answer];
 const decimal=values.length?values.map(v=>String(v).replace('.',',')).join(';'):'∅';
 test(check(decimal,q).correct,q.id+' comma');
 const bad=q.kind==='set'?[...q.answer,9999].join(';'):String(q.answer+1);
 test(!check(bad,q).correct,q.id+' incorrect');
 for(const input of ['', 'abc', '1/0','√-1','sqrt(-2)','<script>','1e309'])test(!check(input,q).valid,q.id+' invalid '+input);
 if(q.kind==='set'){
  test(check(q.answer.length?[...q.answer].reverse().join(';'):'нет решений',q).correct,q.id+' reversed or empty set');
  if(q.answer.length>1)test(!check(q.answer.slice(1).join(';'),q).correct,q.id+' incomplete set');
 }
 const f=ctx.geometryFigure(q.id);
 if(f){
  test(f.elements.length>0,q.id+' figure present');
  test(f.elements.filter(x=>x.type==='text').every(x=>!/[?]\s*=\s*\d/.test(x.text)),q.id+' no solved unknown');
  const svg=ctx.figureSVG(q.id);test(svg.includes('role="img"')&&svg.includes('aria-label='),q.id+' accessibility');
 }
 test(!ctx.mathHTML(q.prompt).includes('^'),q.id+' superscript rendering');
}
for(const [v,x] of [['10/24',5/12],['-2/-4',.5],['−0,75',-.75],['5√2/2',5*Math.sqrt(2)/2],['5/sqrt(2)',5/Math.sqrt(2)],['3*sqrt(8)/2',3*Math.sqrt(2)]])test(ctx.answerMatches(v,x),'equivalent '+v);
for(const v of ['2+2','1;2','√(2+2)','1//2','Infinity','NaN','0/0'])test(ctx.parseAnswer(v)===null,'malformed '+v);
// These checks protect the mathematical grouping, not just the presence of a fraction bar.
for(const [input,top,bottom] of [
 ['5√2/2','5√2','2'],['−√3/2','−√3','2'],['-√3/2','-√3','2'],
 ['√6/3','√6','3'],['√3/3','√3','3'],['5/√2','5','√2'],
 ['−2,5√(3)/−3√(5)','−2,5√(3)','−3√(5)'],['+√(2)/3','+√(2)','3'],
 ['3*√8/2','3*√8','2'],['2 · √(3) / (5 × √7)','2 · √(3)','(5 × √7)'],
 ['3/4','3','4'],['−2/−4','−2','−4'],['(a + b)/(c − d)','(a + b)','(c − d)']
]){
 const expected=[{type:'fraction',top,bottom}];
 test(JSON.stringify(ctx.mathTokens(input))===JSON.stringify(expected),'fraction grouping '+input);
 const html=ctx.mathHTML(input);
 test(html===`<span class="fraction" role="math" aria-label="${top} делить на ${bottom}"><span aria-hidden="true">${top}</span><span aria-hidden="true">${bottom}</span></span>`,'fraction HTML grouping '+input);
}
for(const operator of ['·','×','*']){
 const input=`2 ${operator} √(3) / 5 ${operator} √7`;
 test(JSON.stringify(ctx.mathTokens(input))===JSON.stringify([
  {type:'fraction',top:`2 ${operator} √(3)`,bottom:'5'},{type:'text',text:` ${operator} √7`}
 ]),'explicit product after fraction '+operator);
 test(ctx.mathHTML(input).endsWith(`<span aria-hidden="true">5</span></span> ${operator} √7`),'explicit product HTML scope '+operator);
}
const mixed='Ответы: −√3/2; √3/2. При x² = 3 и aₙ = 1/2.';
test(JSON.stringify(ctx.mathTokens(mixed))===JSON.stringify([
 {type:'text',text:'Ответы: '},{type:'fraction',top:'−√3',bottom:'2'},
 {type:'text',text:'; '},{type:'fraction',top:'√3',bottom:'2'},
 {type:'text',text:'. При x'},{type:'sup',text:'2'},
 {type:'text',text:' = 3 и a'},{type:'sub',text:'n'},
 {type:'text',text:' = '},{type:'fraction',top:'1',bottom:'2'},{type:'text',text:'.'}
]),'mixed fractions, powers, subscripts and prose');
test(ctx.mathHTML(mixed).includes('x<sup>2</sup> = 3 и a<sub>n</sub>'),'mixed notation HTML');
test(JSON.stringify(ctx.mathTokens('1+√2/2; x²−5√3/4; x −√6/3'))===JSON.stringify([
 {type:'text',text:'1+'},{type:'fraction',top:'√2',bottom:'2'},
 {type:'text',text:'; x'},{type:'sup',text:'2'},{type:'text',text:'−'},
 {type:'fraction',top:'5√3',bottom:'4'},{type:'text',text:'; x −'},
 {type:'fraction',top:'√6',bottom:'3'}
]),'binary signs stay outside radical fractions');
test(JSON.stringify(ctx.mathTokens('16^(3/4); x^2; a₁'))===JSON.stringify([
 {type:'text',text:'16'},{type:'sup',text:'(3/4)'},{type:'text',text:'; x'},
 {type:'sup',text:'2'},{type:'text',text:'; a'},{type:'sub',text:'1'}
]),'existing exponent and subscript grouping');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
test(source.includes('10_11_baz.pdf')&&source.includes('10_11_ugl.pdf'),'both official sources');
test(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(fs.readFileSync(path.join(root,'src/app.js'),'utf8')),'no remote persistence');
const report={checks,errors,figures:bank.flatMap(t=>t.tasks).filter(q=>ctx.geometryFigure(q.id)).length};
fs.writeFileSync(path.join(root,'checks/runtime-results.json'),JSON.stringify(report,null,2));console.log(report);if(errors.length)process.exitCode=1;
