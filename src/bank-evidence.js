// Observations describe imported first attempts; author difficulty stays separate.
globalThis.MathBankEvidence = (() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  // Synchronous SHA-256 also works for offline files without Web Crypto.
  function sha256(text){
    const bytes=[];for(const c of String(text)){const n=c.codePointAt(0);if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|n>>6,128|n&63);else if(n<65536)bytes.push(224|n>>12,128|n>>6&63,128|n&63);else bytes.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|n&63);}
    const bits=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);const high=Math.floor(bits/4294967296),low=bits>>>0;for(let i=3;i>=0;i--)bytes.push(high>>>i*8&255);for(let i=3;i>=0;i--)bytes.push(low>>>i*8&255);
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],r=(x,n)=>x>>>n|x<<32-n;
    for(let offset=0;offset<bytes.length;offset+=64){const w=new Array(64);for(let i=0;i<16;i++)w[i]=(bytes[offset+i*4]<<24|bytes[offset+i*4+1]<<16|bytes[offset+i*4+2]<<8|bytes[offset+i*4+3])>>>0;for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=((r(a,7)^r(a,18)^a>>>3)+w[i-16]+(r(b,17)^r(b,19)^b>>>10)+w[i-7])>>>0;}let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t1=(z+(r(e,6)^r(e,11)^r(e,25))+(e&f^~e&g)+k[i]+w[i])>>>0,t2=((r(a,2)^r(a,13)^r(a,22))+(a&b^a&c^b&c))>>>0;z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}for(const [i,v] of [a,b,c,d,e,f,g,z].entries())h[i]=(h[i]+v)>>>0;}
    return h.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  const contentFields=['id','source','year','examId','baseExamId','grade','level','topicId','kind','answerKind','prompt','text','promptHtml','context','contextImages','images','figure','answer','answers','answerText','display','solution','solutionHtml','solutionPages','rubric','hint','hints','method','rationale','methodChoice','solutionSteps','domain','check','revision','representations','stepOptions','matchingItems','matchingOptions','responseMode','validator','domainPolicy','methodIds','skills','prerequisites','difficulty','taskType','responseKind','answerSpec','allowedAnswers','representationTargets','representationLinks','contrastPairId','relatedIds'];
  function makeContentHash(q){const payload={};for(const key of contentFields)if(q&&Object.hasOwn(q,key))payload[key]=q[key];return sha256(canonical(payload));}
  const revision=q=>Number.isSafeInteger(q?.revision)&&q.revision>=0?q.revision:null;
  const version=q=>({contentHash:typeof q?.contentHash==='string'&&q.contentHash?q.contentHash:makeContentHash(q),revision:revision(q)});
  function sanitizeAttempt(raw){
    if(!raw||typeof raw!=='object'||typeof raw.valid!=='boolean'||typeof raw.correct!=='boolean')return null;
    const time=raw.timingRecorded===true&&Number.isSafeInteger(raw.activeMs)&&raw.activeMs>=0&&raw.activeMs<=86400000;
    return {answer:typeof raw.answer==='string'?raw.answer.slice(0,4000):'',valid:raw.valid,correct:raw.correct,at:typeof raw.at==='string'&&Number.isFinite(Date.parse(raw.at))?new Date(raw.at).toISOString():'',contentHash:typeof raw.contentHash==='string'?raw.contentHash.slice(0,128):'',revision:revision(raw),hintBeforeAnswer:raw.hintBeforeAnswer===true?true:raw.hintBeforeAnswer===false?false:null,solutionBeforeAnswer:raw.solutionBeforeAnswer===true?true:raw.solutionBeforeAnswer===false?false:null,timingRecorded:time,activeMs:time?raw.activeMs:null};
  }
  function earliest(a,b){if(!a)return b;if(!b)return a;return a.at&&b.at&&Date.parse(b.at)<Date.parse(a.at)?b:a;}
  function firstValid(item){const valid=sanitizeAttempt(item?.firstValidAttempt),first=sanitizeAttempt(item?.firstAttempt);return earliest(valid?.valid===true?valid:null,first?.valid===true?first:null);}
  const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;return n?n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2:null;};
  function aggregate(reports,catalog,options={}){
    const minimum=Math.max(10,Number.isInteger(options.minimum)?options.minimum:10),byId=new Map((Array.isArray(catalog)?catalog:[]).map(q=>[q.id,q]));
    const excluded={preview:0,unidentifiedRole:0,unknown:0,outdated:0,open:0,missingFirstAttempt:0,invalid:0,assisted:0,unmeasuredTime:0,duplicates:0},observations=new Map(),rows=new Map(),versions=new Map();
    for(const report of Array.isArray(reports)?reports:[]){
      if(!report||typeof report.sessionId!=='string'||!report.sessionId||!Array.isArray(report.tasks))continue;
      for(const item of report.tasks){
        if(report.participantRole==='teacher'){excluded.preview++;continue;}
        if(report.participantRole!=='student'){excluded.unidentifiedRole++;continue;}
        if(!item||typeof item.id!=='string')continue;
        const key=canonical([report.sessionId,item.id,item.contentHash||'',revision(item)]),attempt=firstValid(item);
        if(observations.has(key)){excluded.duplicates++;const existing=observations.get(key);existing.attempt=earliest(existing.attempt,attempt);continue;}
        observations.set(key,{item,attempt});
      }
    }
    for(const {item,attempt} of observations.values()){
      const q=byId.get(item.id);if(!q){excluded.unknown++;continue;}
      if(!versions.has(q.id))versions.set(q.id,version(q));const current=versions.get(q.id);
      if(!item.contentHash||item.contentHash!==current.contentHash||revision(item)!==current.revision){excluded.outdated++;continue;}
      if((q.answerKind||q.kind)==='open'){excluded.open++;continue;}
      if(!attempt){excluded.missingFirstAttempt++;continue;}
      if(attempt.contentHash!==current.contentHash||attempt.revision!==current.revision){excluded.outdated++;continue;}
      if(!attempt.valid){excluded.invalid++;continue;}
      if(attempt.hintBeforeAnswer!==false||attempt.solutionBeforeAnswer!==false){excluded.assisted++;continue;}
      if(!rows.has(q.id))rows.set(q.id,{id:q.id,title:q.topic||q.subtypeTitle||q.prompt||q.id,year:q.year??null,...current,authorDifficulty:q.difficulty||'Не задана',n:0,successes:0,times:[]});
      const row=rows.get(q.id);row.n++;if(attempt.correct)row.successes++;if(attempt.timingRecorded)row.times.push(attempt.activeMs);else excluded.unmeasuredTime++;
    }
    const tasks=[...rows.values()].map(({times,...row})=>({...row,independentSuccesses:row.successes,successRate:row.successes/row.n,timeN:times.length,medianActiveMs:median(times),preliminary:row.n>=minimum})).sort((a,b)=>b.n-a.n||a.id.localeCompare(b.id));
    return {tasks,excluded,minimum,observations:tasks.reduce((n,r)=>n+r.n,0),note:'Первая валидная попытка без подсказки и разбора. Импортированные файлы одной выборки не подтверждают общую калибровку сложности.'};
  }
  function render(reports,catalog,options={}){
    const data=aggregate(reports,catalog,options),time=ms=>ms===null?'—':Math.round(ms/1000)+' с';
    return `<section class="glass report-summary bank-evidence"><h2>Наблюдаемая сложность</h2><p>Авторская ступень сохраняется отдельно. Успех — верный ответ с первой валидной попытки без помощи; время — активная работа до этой попытки.</p>${data.tasks.length?`<div class="report-scroll"><table><caption>Наблюдения по текущей версии каждого задания</caption><thead><tr><th>Задание / версия</th><th>Авторская сложность</th><th>Успехов / наблюдений</th><th>Доля успехов</th><th>Медиана активного времени</th><th>Выборка времени</th><th>Достаточность</th></tr></thead><tbody>${data.tasks.map(r=>`<tr><th>${esc(r.id)}<small>${esc(r.contentHash.slice(0,12))}${r.revision===null?'':` · v${r.revision}`}${r.year?` · ${r.year}`:''}</small></th><td>${esc(r.authorDifficulty)}</td><td>${r.successes} / ${r.n}</td><td>${Math.round(r.successRate*100)}%</td><td>${time(r.medianActiveMs)}</td><td>n = ${r.timeN}</td><td>${r.preliminary?'Предварительный ориентир':`Нужно не менее ${data.minimum} наблюдений`}</td></tr>`).join('')}</tbody></table></div>`:'<p>Пока нет подходящих измерений. Нужны новые результаты учеников с первой валидной попыткой и совпадающей версией задания.</p>'}<p class="muted">${esc(data.note)} Учительские просмотры, помощь, открытые ответы и несовпадающие версии исключены. Старые файлы без подтверждённой первой попытки не создают измерений. Пропуски и невалидный ввод не считаются математическими ошибками.</p></section>`;
  }
  return Object.freeze({canonical,sha256,makeContentHash,version,sanitizeAttempt,firstValid,earliest,median,aggregate,render});
})();
