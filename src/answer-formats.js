// Bounded, exact mathematical answer formats. No JavaScript or arbitrary code is evaluated.
globalThis.MathAnswerFormats = (() => {
  'use strict';
  const kinds=Object.freeze(['interval','coordinates','expression','matching','steps','examples']);
  const supports=value=>kinds.includes(typeof value==='string'?value:value?.answerKind||value?.kind);
  const fail=message=>{throw Error(message||'Неподдерживаемая запись');};
  const MAX_INPUT=1500,MAX_TERMS=128,MAX_DEGREE=16,MAX_DIGITS=120;
  const clean=value=>String(value??'').replace(/[−–]/g,'-').trim();
  const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;};
  function frac(n,d=1n){
    if(d===0n)fail('Деление на ноль');if(d<0n){n=-n;d=-d;}
    const g=gcd(n,d)||1n;n/=g;d/=g;
    if(n.toString().length>MAX_DIGITS||d.toString().length>MAX_DIGITS)fail('Слишком большие числа');
    return {n,d};
  }
  const add=(a,b)=>frac(a.n*b.d+b.n*a.d,a.d*b.d),neg=a=>frac(-a.n,a.d),mul=(a,b)=>frac(a.n*b.n,a.d*b.d),div=(a,b)=>frac(a.n*b.d,a.d*b.n);
  const eq=(a,b)=>a.n===b.n&&a.d===b.d,cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
  const zero=()=>frac(0n),one=()=>frac(1n),fkey=a=>a.n+'/'+a.d;
  function decimal(raw,scientific=false){
    const value=clean(raw).replace(/,/g,'.');
    const m=value.match(scientific?/^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d{1,2}))?$/:/^([+-]?)(\d+(?:\.\d*)?|\.\d+)$/);
    if(!m||m[2].length>32)fail('Нужно число или дробь');
    const parts=m[2].split('.'),digits=(parts[0]||'0')+(parts[1]||''),exponent=Number(m[3]||0)-(parts[1]?.length||0);
    if(Math.abs(exponent)>32)fail('Слишком большой порядок числа');
    let n=BigInt(digits),d=1n;if(m[1]==='-')n=-n;if(exponent<0)d=10n**BigInt(-exponent);else n*=10n**BigInt(exponent);
    return frac(n,d);
  }
  function scalar(raw){
    if(typeof raw==='number'){if(!Number.isFinite(raw))fail('Нужно конечное число');return decimal(String(raw),true);}
    const parts=clean(raw).split('/');if(parts.length>2)fail('Нужно число или дробь');
    return parts.length===2?div(decimal(parts[0]),decimal(parts[1])):decimal(parts[0]);
  }
  function pair(raw){const value=clean(raw).replace(/^\((.*)\)$/,'$1'),parts=value.split(';');if(parts.length!==2)fail('Запишите два числа через точку с запятой');return parts.map(scalar);}
  const integer=f=>{if(f.d!==1n||f.n>1000000000n||f.n< -1000000000n)fail('Нужны целые числа по модулю не больше миллиарда');return Number(f.n);};
  function finiteList(raw){if(!Array.isArray(raw)||raw.length>24)fail('Некорректный список ограничений');return [...new Map(raw.map(v=>{const f=scalar(v);return [fkey(f),f];})).values()].sort(cmp);}
  function intervals(raw,schema=false){
    let rows;
    if(schema){if(!Array.isArray(raw)||raw.length>24)fail('Нужен список промежутков');rows=raw.map(row=>{
      if(!row||typeof row.loClosed!=='boolean'||typeof row.hiClosed!=='boolean'||!Object.hasOwn(row,'lo')||!Object.hasOwn(row,'hi'))fail('Некорректный промежуток');
      return {lo:row.lo===null?null:scalar(row.lo),hi:row.hi===null?null:scalar(row.hi),loClosed:row.loClosed,hiClosed:row.hiClosed};
    });}else{
      const value=clean(raw);if(['∅','{}','нет решений','пустое множество'].includes(value.toLowerCase()))return [];
      if(/^(?:R|ℝ|\(-(?:∞|inf);\+?(?:∞|inf)\))$/i.test(value.replace(/\s/g,'')))return [{lo:null,hi:null,loClosed:false,hiClosed:false}];
      const parts=value.split(/\s*(?:∪|\bU\b|\bu\b|\|)\s*/);if(parts.length>24)fail('Слишком много промежутков');
      rows=parts.map(part=>{const m=part.trim().match(/^([[(])([^;]+);([^;]+)([\])])$/);if(!m)fail('Запишите промежуток, например (-∞; 2]');
        const left=clean(m[2]).replace(/\s/g,''),right=clean(m[3]).replace(/\s/g,'');
        return {lo:/^-(?:∞|inf|infinity)$/i.test(left)?null:scalar(m[2]),hi:/^\+?(?:∞|inf|infinity)$/i.test(right)?null:scalar(m[3]),loClosed:m[1]==='[',hiClosed:m[4]===']'};
      });
    }
    const valid=[];
    for(const row of rows){if(row.lo===null&&row.loClosed||row.hi===null&&row.hiClosed)fail('Бесконечность не включают в промежуток');
      if(row.lo!==null&&row.hi!==null){const order=cmp(row.lo,row.hi);if(order>0)fail('Левая граница больше правой');if(order===0&&!(row.loClosed&&row.hiClosed))continue;}valid.push(row);}
    valid.sort((a,b)=>a.lo===null?b.lo===null?0:-1:b.lo===null?1:cmp(a.lo,b.lo)||Number(b.loClosed)-Number(a.loClosed));
    const result=[];
    for(const row of valid){const previous=result.at(-1);if(!previous){result.push({...row});continue;}
      const order=previous.hi===null||row.lo===null?-1:cmp(row.lo,previous.hi);
      if(order<0||order===0&&(previous.hiClosed||row.loClosed)){
        if(previous.hi===null)continue;
        if(row.hi===null||cmp(row.hi,previous.hi)>0){previous.hi=row.hi;previous.hiClosed=row.hiClosed;}else if(cmp(row.hi,previous.hi)===0)previous.hiClosed ||=row.hiClosed;
      }else result.push({...row});
    }return result;
  }
  const intervalKey=rows=>rows.map(row=>`${row.loClosed?'[':'('}${row.lo===null?'-inf':fkey(row.lo)};${row.hi===null?'inf':fkey(row.hi)}${row.hiClosed?']':')'}`).join('U');

  // Exact sparse polynomial arithmetic. A rational expression is a pair of
  // polynomials; identity is checked by cross multiplication, never sampling.
  function parseExpression(raw,variables){
    if(!Array.isArray(variables)||!variables.length||variables.length>3||new Set(variables).size!==variables.length||variables.some(v=>!/^[a-z]$/.test(v)))fail('Некорректные переменные');
    let input=clean(raw).replace(/[×·]/g,'*').replace(/,/g,'.');
    const superDigits={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+'};
    input=input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g,part=>'^'+[...part].map(ch=>superDigits[ch]).join(''));
    if(input.length>500)fail('Слишком длинное выражение');
    const tokens=[];let position=0;
    while(position<input.length){const ch=input[position];if(/\s/.test(ch)){position++;continue;}const number=input.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if(number){tokens.push({type:'number',value:number[0]});position+=number[0].length;}
      else if(variables.includes(ch)){tokens.push({type:'variable',value:ch});position++;}
      else if('+-*/^()'.includes(ch)){tokens.push({type:ch,value:ch});position++;}
      else fail('Допустимы только числа, переменные, скобки и + - * / ^');
      if(tokens.length>160)fail('Слишком сложное выражение');
    }
    const expanded=[];
    for(const token of tokens){const last=expanded.at(-1),end=last&&(last.type==='number'||last.type==='variable'||last.type===')'),start=['number','variable','('].includes(token.type);
      if(end&&start){if(last.type==='number'&&token.type==='number')fail('Между числами нужен знак действия');expanded.push({type:'*'});}expanded.push(token);}
    const dimension=variables.length,key=Array(dimension).fill(0).join(','),denominators=[];let operations=0,index=0,depth=0;
    const constant=f=>f.n===0n?new Map():new Map([[key,f]]);
    const check=p=>{if(p.size>MAX_TERMS||++operations>6000)fail('Слишком сложное выражение');return p;};
    const plus=(a,b)=>{const p=new Map(a);for(const [k,c] of b){const sum=add(p.get(k)||zero(),c);if(sum.n)p.set(k,sum);else p.delete(k);}return check(p);};
    const minus=p=>new Map([...p].map(([k,c])=>[k,neg(c)]));
    const times=(a,b)=>{const p=new Map();for(const [ka,ca] of a)for(const [kb,cb] of b){const exponents=ka.split(',').map((value,i)=>Number(value)+Number(kb.split(',')[i]));if(exponents.reduce((n,v)=>n+v,0)>MAX_DEGREE)fail('Слишком высокая степень');const k=exponents.join(','),sum=add(p.get(k)||zero(),mul(ca,cb));if(sum.n)p.set(k,sum);else p.delete(k);}return check(p);};
    const unit=()=>constant(one());
    const power=(p,n)=>{let result=unit(),base=p;while(n){if(n%2)result=times(result,base);n=Math.floor(n/2);if(n)base=times(base,base);}return result;};
    const rat=(n,d=unit())=>{if(!d.size)fail('Деление на ноль');return {n,d};};
    const rationalAdd=(a,b)=>rat(plus(times(a.n,b.d),times(b.n,a.d)),times(a.d,b.d));
    const rationalMul=(a,b)=>rat(times(a.n,b.n),times(a.d,b.d));
    const rationalDiv=(a,b)=>{if(!b.n.size)fail('Деление на ноль');denominators.push(b.n);return rat(times(a.n,b.d),times(a.d,b.n));};
    function primary(){if(++depth>24)fail('Слишком много скобок');const token=expanded[index++];let result;
      if(token?.type==='number')result=rat(constant(decimal(token.value)));
      else if(token?.type==='variable'){const exponents=Array(dimension).fill(0);exponents[variables.indexOf(token.value)]=1;result=rat(new Map([[exponents.join(','),one()]]));}
      else if(token?.type==='('){result=sum();if(expanded[index++]?.type!==')')fail('Не закрыта скобка');}
      else fail('Ожидалось число, переменная или скобка');depth--;return result;
    }
    function exponent(){let value=primary();if(expanded[index]?.type==='^'){index++;let wrapped=false;if(expanded[index]?.type==='('){index++;wrapped=true;}let sign=1;if(['+','-'].includes(expanded[index]?.type)){if(expanded[index++].type==='-')sign=-1;}const number=expanded[index++];if(number?.type!=='number'||!/^\d+$/.test(number.value))fail('Степень должна быть целой');const n=sign*Number(number.value);if(Math.abs(n)>8)fail('Степень по модулю не больше 8');if(wrapped&&expanded[index++]?.type!==')')fail('Нужна целая степень');if(n===0){if(!value.n.size)fail('Ноль в нулевой степени не определён');denominators.push(value.n);}if(n<0){denominators.push(value.n);value=rat(power(value.d,-n),power(value.n,-n));}else value=rat(power(value.n,n),power(value.d,n));}return value;}
    function unary(){if(expanded[index]?.type==='+'){index++;return unary();}if(expanded[index]?.type==='-'){index++;const value=unary();return rat(minus(value.n),value.d);}return exponent();}
    function product(){let value=unary();while(['*','/'].includes(expanded[index]?.type)){const operator=expanded[index++].type,next=unary();value=operator==='*'?rationalMul(value,next):rationalDiv(value,next);}return value;}
    function sum(){let value=product();while(['+','-'].includes(expanded[index]?.type)){const operator=expanded[index++].type,next=product();value=rationalAdd(value,operator==='+'?next:rat(minus(next.n),next.d));}return value;}
    const value=sum();if(index!==expanded.length)fail('Лишние символы в выражении');
    return {...value,denominators,variables,times,minus,plus};
  }
  function univariate(poly){const result=[];for(const [key,value] of poly){const powers=key.split(',').map(Number);if(powers.slice(1).some(Boolean))fail('ОДЗ рационального выражения поддерживается для одной переменной');result[powers[0]]=value;}for(let i=0;i<result.length;i++)result[i] ||=zero();return trim(result);}
  function trim(values){while(values.length&&values.at(-1).n===0n)values.pop();return values;}
  const polynomialAt=(p,x)=>p.reduceRight((value,c)=>add(mul(value,x),c),zero());
  function remainder(a,b){a=a.map(v=>({...v}));if(!b.length)fail('Нулевой многочлен');while(a.length>=b.length&&a.length){const shift=a.length-b.length,c=div(a.at(-1),b.at(-1));for(let i=0;i<b.length;i++)a[i+shift]=add(a[i+shift]||zero(),neg(mul(c,b[i])));trim(a);}return a;}
  function divideLinear(p,r){const out=Array(p.length-1);out[out.length-1]=p.at(-1);for(let i=p.length-2;i>=1;i--)out[i-1]=add(p[i],mul(r,out[i]));return trim(out);}
  function rootsOutside(poly,excluded){
    let p=univariate(poly);if(!p.length)fail('Деление на нулевое выражение');
    for(const root of excluded)while(p.length>1&&polynomialAt(p,root).n===0n)p=divideLinear(p,root);
    if(p.length<=1)return false;
    const derivative=p.slice(1).map((coefficient,i)=>mul(coefficient,frac(BigInt(i+1)))),chain=[p,trim(derivative)];
    while(chain.at(-1).length){if(chain.length>32)fail('Слишком сложная ОДЗ');const next=trim(remainder(chain.at(-2),chain.at(-1)).map(neg));if(!next.length)break;chain.push(next);}
    function changes(negative){const signs=chain.filter(row=>row.length).map(row=>{let sign=row.at(-1).n<0n?-1:1;if(negative&&(row.length-1)%2)sign=-sign;return sign;});return signs.reduce((n,sign,i)=>n+(i>0&&sign!==signs[i-1]?1:0),0);}
    return changes(true)-changes(false)>0;
  }
  function domain(raw,variables){
    const value=clean(raw).replace(/^ОДЗ\s*:\s*/i,'');if(/^(?:[a-z](?:∈|in)(?:R|ℝ)|R|ℝ)$/i.test(value.replace(/\s/g,'')))return [];
    if(variables.length!==1)fail('Ограничения поддерживаются для одной переменной');
    const values=value.split(';').map(part=>{const match=part.trim().match(/^([a-z])\s*(?:!=|≠)\s*(.+)$/);if(!match||match[1]!==variables[0])fail('Запишите ОДЗ как x!=1; x!=2');return scalar(match[2]);});
    return [...new Map(values.map(v=>[fkey(v),v])).values()].sort(cmp);
  }
  function expression(raw,q){
    const answer=q.answer,variables=answer.variables||['x'],required=finiteList(answer.domain?.excluded||[]);
    let input=clean(raw);if(!input.includes('|'))input=input.replace(/;(?=\s*[a-z]\s*(?:!=|≠))/,'|');
    const parts=input.split('|');if(parts.length>2)fail('Отделите ОДЗ одним знаком |');
    const actual=parseExpression(parts[0],variables),expected=parseExpression(answer.expression,variables);
    const constraints=parts.length===2?domain(parts[1],variables):[];
    const domainEqual=constraints.length===required.length&&constraints.every((v,i)=>eq(v,required[i]));
    const extraDomain=actual.denominators.some(poly=>rootsOutside(poly,required));
    const difference=actual.plus(actual.times(actual.n,expected.d),actual.minus(actual.times(expected.n,actual.d)));
    return {valid:true,correct:!difference.size&&domainEqual&&!extraDomain,...(!domainEqual||extraDomain?{reason:'domain',message:'Сохраните исходную ОДЗ и не добавляйте новых запрещённых значений.'}:{})};
  }
  const exampleValidators=Object.freeze({
    'fraction-equivalent':(values,p)=>{const [a,b]=values.map(integer);return b>0&&b>=p.minDenominator&&b<=p.maxDenominator&&BigInt(a)*BigInt(p.denominator)===BigInt(b)*BigInt(p.numerator);},
    'rectangle-area':(values,p)=>{const [a,b]=values.map(integer);return a>=p.minSide&&b>=p.minSide&&a<=p.maxSide&&b<=p.maxSide&&(!p.requireDistinct||a!==b)&&eq(mul(values[0],values[1]),scalar(p.area));},
    'linear-root':(values,p)=>{const [a]=values.map(integer);return a!==0&&Math.abs(a)>=p.minCoefficient&&Math.abs(a)<=p.maxCoefficient&&add(mul(values[0],scalar(p.root)),values[1]).n===0n;},
    'probability-fraction':(values,p)=>{const [a,b]=values.map(integer);return a>=0&&a<=b&&b>=p.minTotal&&b<=p.maxTotal&&BigInt(a)*BigInt(p.valueDenominator)===BigInt(b)*BigInt(p.valueNumerator);}
  });
  const safeId=value=>typeof value==='string'&&/^[a-zA-Zа-яА-ЯЁё0-9_-]{1,32}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
  function matching(raw){const result=Object.create(null),parts=clean(raw).split(';');if(parts.length>40)fail('Слишком много соответствий');for(const part of parts){const m=part.trim().match(/^([a-zA-Zа-яА-ЯЁё0-9_]+)\s*(?:-|:|=|→)\s*([a-zA-Zа-яА-ЯЁё0-9_]+)$/);if(!m||!safeId(m[1])||!safeId(m[2])||Object.hasOwn(result,m[1]))fail('Запишите соответствия a-1; b-3 без повторов');result[m[1]]=m[2];}return result;}
  function stepIds(raw,q){const tokens=clean(raw).split(/\s*(?:;|→|,)\s*/);if(!tokens.length||tokens.length>40||tokens.some(id=>!safeId(id))||new Set(tokens).size!==tokens.length)fail('Перечислите идентификаторы шагов через ; без повторов');const allowed=new Set(q.stepOptions.map(item=>item.id));if(tokens.some(id=>!allowed.has(id)))fail('Используйте идентификаторы из списка шагов');return tokens;}
  function validateTask(q){
    const errors=[];if(!supports(q))return {valid:true,supported:false,errors};
    try{
      const kind=q.answerKind||q.kind;
      if(kind==='interval')intervals(q.answer,true);
      if(kind==='coordinates'){if(!Array.isArray(q.answer)||q.answer.length!==2)fail('Нужна пара координат');q.answer.forEach(scalar);}
      if(kind==='expression'){
        if(!q.answer||typeof q.answer.expression!=='string'||!Array.isArray(q.answer.variables)||!q.answer.domain||!Array.isArray(q.answer.domain.excluded)||q.domainPolicy!=='preserve')fail('Укажите выражение, переменные и сохраняемую ОДЗ');
        const parsed=parseExpression(q.answer.expression,q.answer.variables),excluded=finiteList(q.answer.domain.excluded);
        if(q.answer.variables.length>1&&excluded.length)fail('Исключения ОДЗ поддерживаются для одной переменной');
        if(parsed.denominators.some(poly=>rootsOutside(poly,excluded)))fail('ОДЗ эталона не включает все нули знаменателей');
      }
      if(kind==='matching'){
        if(!q.answer||Array.isArray(q.answer)||typeof q.answer!=='object'||!Object.keys(q.answer).length||Object.keys(q.answer).length>40||Object.entries(q.answer).some(([a,b])=>!safeId(a)||!safeId(b)))fail('Некорректный ключ соответствий');
        for(const key of ['matchingItems','matchingOptions'])if(q[key]!==undefined&&(!Array.isArray(q[key])||q[key].length>40||q[key].some(item=>!item||!safeId(item.id)||typeof item.text!=='string')||new Set(q[key].map(item=>item.id)).size!==q[key].length))fail('Некорректные варианты соответствий');
        if(q.matchingItems&&q.matchingItems.length!==Object.keys(q.answer).length)fail('Число левых элементов не совпадает с ключом');
        if(q.matchingItems&&Object.keys(q.answer).some(id=>!q.matchingItems.some(item=>item.id===id))||q.matchingOptions&&Object.values(q.answer).some(id=>!q.matchingOptions.some(item=>item.id===id)))fail('В ключе есть отсутствующий вариант');
      }
      if(kind==='steps'){
        if(q.responseMode!==undefined&&q.responseMode!=='order'||!Array.isArray(q.stepOptions)||!q.stepOptions.length||q.stepOptions.length>40||q.stepOptions.some(item=>!item||!safeId(item.id)||typeof item.text!=='string')||new Set(q.stepOptions.map(item=>item.id)).size!==q.stepOptions.length||!Array.isArray(q.answer)||q.answer.length!==q.stepOptions.length||new Set(q.answer).size!==q.answer.length||q.answer.some(id=>!q.stepOptions.some(item=>item.id===id)))fail('Некорректные шаги и их порядок');
      }
      if(kind==='examples'){
        const name=q.validator?.name,p=q.validator?.params;if(!Object.hasOwn(exampleValidators,name)||!p||typeof p!=='object'||Array.isArray(p))fail('Неизвестный именованный валидатор');
        const fields={ 'fraction-equivalent':['numerator','denominator','minDenominator','maxDenominator'],'rectangle-area':['area','minSide','maxSide'],'linear-root':['root','minCoefficient','maxCoefficient'],'probability-fraction':['valueNumerator','valueDenominator','minTotal','maxTotal']}[name];
        if(fields.some(key=>typeof p[key]!=='number'||!Number.isFinite(p[key])||Math.abs(p[key])>1000000000))fail('Некорректные параметры валидатора');
        if(name==='fraction-equivalent'&&(!Number.isSafeInteger(p.numerator)||!Number.isSafeInteger(p.denominator)||p.denominator<=0||!Number.isInteger(p.minDenominator)||!Number.isInteger(p.maxDenominator)||p.minDenominator<=0||p.maxDenominator<p.minDenominator))fail('Некорректные границы знаменателя');
        if(name==='rectangle-area'&&(p.area<=0||p.minSide<=0||p.maxSide<p.minSide||p.requireDistinct!==undefined&&typeof p.requireDistinct!=='boolean'))fail('Некорректные стороны прямоугольника');
        if(name==='linear-root'&&(!Number.isInteger(p.minCoefficient)||!Number.isInteger(p.maxCoefficient)||p.minCoefficient<1||p.maxCoefficient<p.minCoefficient))fail('Некорректные границы коэффициента');
        if(name==='probability-fraction'&&(!Number.isInteger(p.valueNumerator)||!Number.isInteger(p.valueDenominator)||p.valueDenominator<=0||p.valueNumerator<0||p.valueNumerator>p.valueDenominator||!Number.isInteger(p.minTotal)||!Number.isInteger(p.maxTotal)||p.minTotal<1||p.maxTotal<p.minTotal))fail('Некорректные параметры вероятности');
      }
    }catch(error){errors.push(error.message);}
    return {valid:!errors.length,supported:true,errors};
  }
  function evaluate(raw,q){
    if(!supports(q))return {valid:false,correct:false,unsupported:true};
    const schema=validateTask(q);if(!schema.valid)return {valid:false,correct:false,reason:'schema',message:'Некорректный формат задания.'};
    try{
      if(typeof raw!=='string'||raw.length>MAX_INPUT||!raw.trim())fail('Запишите ответ в указанном формате');
      const kind=q.answerKind||q.kind;
      if(kind==='interval')return {valid:true,correct:intervalKey(intervals(raw))===intervalKey(intervals(q.answer,true))};
      if(kind==='coordinates'){const values=pair(raw);return {valid:true,correct:values.every((v,i)=>eq(v,scalar(q.answer[i])))};}
      if(kind==='expression')return expression(raw,q);
      if(kind==='matching'){const actual=matching(raw),expected=q.answer;return {valid:true,correct:Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>actual[key]===value)};}
      if(kind==='steps'){const actual=stepIds(raw,q);return {valid:true,correct:actual.length===q.answer.length&&actual.every((id,i)=>id===q.answer[i])};}
      if(kind==='examples')return {valid:true,correct:exampleValidators[q.validator.name](pair(raw),q.validator.params)};
    }catch(error){return {valid:false,correct:false,reason:'format',message:error.message};}
    return {valid:false,correct:false};
  }
  function hint(q){
    const kind=q?.answerKind||q?.kind;
    if(kind==='interval')return 'Промежутки через ∪: (-∞; 2] ∪ (3; +∞). Границы разделяйте точкой с запятой. [ ] включают границу, ( ) не включают; у бесконечности только ( ). Пустое множество: ∅.';
    if(kind==='coordinates')return 'Две координаты в указанном порядке через точку с запятой: (2; -3) или 2; -3. Допустимы точные дроби и десятичная запятая.';
    if(kind==='expression')return 'Выражение с + - * / ^ и скобками; например, 2*(x+1). Сохраните исходную ОДЗ после |: x+1 | x!=2; x!=-2. Если ограничений нет, достаточно выражения. Допускаются степени от -8 до 8, многочлены и рациональные выражения.';
    if(kind==='matching')return 'Соответствия через точку с запятой: a-2; b-1; c-3. Используйте идентификаторы из условия; каждый левый элемент укажите один раз.';
    if(kind==='steps')return 'Шаблон записи: ID_первого_шага; ID_следующего_шага. Идентификаторы разделяйте точкой с запятой; используйте каждый шаг из списка один раз в найденном порядке.';
    if(kind==='examples')return ({'fraction-equivalent':'Укажите целые числитель и положительный знаменатель через ;, например 4; 6. Соблюдайте ограничения условия.','rectangle-area':'Укажите две положительные целые стороны через ;, например 3; 5. Соблюдайте площадь и ограничения условия.','linear-root':'Укажите целые коэффициенты a; b уравнения ax+b=0, например 2; -6. Коэффициент a не равен нулю.','probability-fraction':'Укажите целые числа благоприятных и всех равновозможных исходов через ;, например 2; 5. Первое число не больше второго.'})[q.validator?.name]||'';
    return '';
  }
  function renderPrompt(q,options={}){
    const esc=options.esc||((value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))),math=options.mathHTML||esc;
    const list=(rows,label)=>`<section class="answer-options"><h3>${esc(label)}</h3><ul>${rows.map(item=>`<li><strong>${esc(item.id)}.</strong> ${math(item.text)}</li>`).join('')}</ul></section>`;
    if((q.answerKind||q.kind)==='steps'&&Array.isArray(q.stepOptions))return list(q.stepOptions,'Шаги для упорядочивания');
    if((q.answerKind||q.kind)==='matching')return `${Array.isArray(q.matchingItems)?list(q.matchingItems,'Элементы'):''}${Array.isArray(q.matchingOptions)?list(q.matchingOptions,'Варианты соответствия'):''}`;
    return '';
  }
  return Object.freeze({kinds,supports,evaluate,hint,validateTask,renderPrompt});
})();
