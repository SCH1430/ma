// Source-backed method passports and representations, separate from source tasks.
globalThis.MathBankMethods = (() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>typeof METHOD_BANK!=='undefined'?METHOD_BANK:{methods:[],topics:[],tasks:[]};
  const categories={contrast:'Контрастная пара',steps:'Восстановить решение',representation:'Сменить представление',boundary:'Пограничный случай'};
  const formats={number:'Число',set:'Множество чисел',open:'Рассуждение',interval:'Промежуток',coordinates:'Координаты',expression:'Выражение и ОДЗ',matching:'Соответствия',steps:'Шаги решения',examples:'Несколько примеров',sequence:'Последовательность'};
  const ids=q=>Array.isArray(q?.methodIds)?[...new Set(q.methodIds)].filter(id=>data().methods.some(method=>method.id===id)):[];
  const method=id=>data().methods.find(item=>item.id===id);
  const text=value=>typeof value==='string'?value:'';
  function graph(representation){
    const segments=(Array.isArray(representation.segments)?representation.segments:[]).filter(segment=>Array.isArray(segment)&&segment.length===2&&segment.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))).slice(0,40);
    const series=Array.isArray(representation.series)?representation.series:[{points:representation.points?.length?representation.points:segments.flat(),connect:segments.length?false:representation.connect,showPoints:!!representation.points?.length,label:representation.label||''}];
    const valid=series.slice(0,6).map(row=>({...row,points:(Array.isArray(row.points)?row.points:[]).filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)).slice(0,80)})).filter(row=>row.points.length);
    if(!valid.length)return '';
    const points=valid.flatMap(row=>row.points),bounds=representation.bounds||{xmin:representation.xMin,xmax:representation.xMax,ymin:representation.yMin,ymax:representation.yMax};
    let xmin=Number.isFinite(bounds.xmin)?bounds.xmin:Math.min(0,...points.map(p=>p[0]))-1,xmax=Number.isFinite(bounds.xmax)?bounds.xmax:Math.max(0,...points.map(p=>p[0]))+1;
    let ymin=Number.isFinite(bounds.ymin)?bounds.ymin:Math.min(0,...points.map(p=>p[1]))-1,ymax=Number.isFinite(bounds.ymax)?bounds.ymax:Math.max(0,...points.map(p=>p[1]))+1;
    if(!(xmax>xmin&&ymax>ymin))return '';
    const x=value=>52+(value-xmin)/(xmax-xmin)*374,y=value=>214-(value-ymin)/(ymax-ymin)*176;
    const colors=['#2a624d','#9b6a30','#495e9a','#8b4267','#5d7250','#6c5e92'],zeroX=x(Math.max(xmin,Math.min(xmax,0))),zeroY=y(Math.max(ymin,Math.min(ymax,0)));
    let body=`<path d="M52 ${zeroY}H430M${zeroX} 218V32" stroke="#5d7263" stroke-width="1.5"/>`;
    for(let i=0;i<=5;i++){
      const vx=xmin+(xmax-xmin)*i/5,vy=ymin+(ymax-ymin)*i/5,label=value=>Number(value.toFixed(2));
      body+=`<path d="M${x(vx)} 38V214M52 ${y(vy)}H426" stroke="#69806d" stroke-opacity=".18"/><text x="${x(vx)}" y="238" text-anchor="middle">${label(vx)}</text><text x="43" y="${y(vy)+4}" text-anchor="end">${label(vy)}</text>`;
    }
    valid.forEach((row,i)=>{
      if(row.connect!==false)body+=`<polyline points="${row.points.map(p=>x(p[0])+','+y(p[1])).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2.4"/>`;
      if(row.showPoints!==false)for(const p of row.points)body+=`<circle cx="${x(p[0])}" cy="${y(p[1])}" r="3.8" fill="${colors[i]}"/>`;
    });
    for(const segment of segments)body+=`<path d="M${x(segment[0][0])} ${y(segment[0][1])}L${x(segment[1][0])} ${y(segment[1][1])}" fill="none" stroke="${colors[0]}" stroke-width="2.4"/>`;
    const description=text(representation.description)||valid.map(row=>(row.label?row.label+': ':'')+row.points.map(p=>'('+p.join('; ')+')').join(', ')).join('. ');
    return `<figure class="method-graph"><svg viewBox="0 0 480 268" role="img" aria-label="${esc(text(representation.title)||'Координатный график')}"><title>${esc(text(representation.title)||'График')}</title><desc>${esc(description)}</desc><g font-family="sans-serif" font-size="12" fill="#294738">${body}<text x="445" y="${zeroY-8}">${esc(representation.xLabel||'x')}</text><text x="${zeroX+10}" y="25">${esc(representation.yLabel||'y')}</text></g></svg>${representation.caption?`<figcaption>${esc(representation.caption)}</figcaption>`:''}${valid.some(row=>row.label)?`<p class="muted">${valid.map((row,i)=>row.label?`<span style="color:${colors[i]}">${esc(row.label)}</span>`:'').filter(Boolean).join(' · ')}</p>`:''}</figure>`;
  }
  function representations(q,options={}){
    const math=options.mathHTML||esc;
    return (Array.isArray(q?.representations)?q.representations:[]).map(item=>{
      if(!item||typeof item!=='object')return '';
      if(item.type==='graph')return graph(item);
      if(item.type==='table'){
        const headers=Array.isArray(item.headers)?item.headers:[],rows=Array.isArray(item.rows)?item.rows:[];
        return `<div class="method-table-wrap"><table class="method-table">${item.title||item.caption?`<caption>${esc(item.title||item.caption)}</caption>`:''}${headers.length?`<thead><tr>${headers.map(value=>`<th scope="col">${math(value)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(row=>Array.isArray(row)?`<tr>${row.map(value=>`<td>${math(value)}</td>`).join('')}</tr>`:'').join('')}</tbody></table></div>`;
      }
      return item.text?`<section class="method-representation">${item.title?`<h3>${esc(item.title)}</h3>`:''}<p>${math(item.text)}</p></section>`:'';
    }).join('');
  }
  function passport(q,options={}){
    const math=options.mathHTML||esc,selected=ids(q);
    if(!selected.length&&!q?.rationale&&!q?.methodChoice)return '';
    const domain=typeof q.domain==='string'?q.domain:q.domainText||'',check=typeof q.check==='string'?q.check:q.checkText||'';
    return `<details class="method-passport"><summary>Паспорт решения${selected.length?' · '+selected.map(id=>esc(method(id).title)).join(', '):''}</summary>${q.methodChoice?`<p><strong>Как выбрать способ:</strong> ${math(q.methodChoice)}</p>`:''}${q.rationale?`<p><strong>Почему он подходит:</strong> ${math(q.rationale)}</p>`:''}${domain?`<p><strong>Ограничения:</strong> ${math(domain)}</p>`:''}${Array.isArray(q.solutionSteps)&&q.solutionSteps.length?`<ol>${q.solutionSteps.map(step=>`<li>${math(typeof step==='string'?step:step.statement)}${typeof step==='object'&&step.reason?`<p class="muted">${math(step.reason)}</p>`:''}</li>`).join('')}</ol>`:''}${check?`<p><strong>Проверка результата:</strong> ${math(check)}</p>`:''}</details>`;
  }
  function coverage(tasks){
    const groups=new Map();
    for(const q of tasks||[]){
      if(!q?.topicId)continue;
      const key=q.topicId+':'+q.grade+':'+q.level;
      if(!groups.has(key))groups.set(key,{id:key,topicId:q.topicId,title:q.topic||q.topicId,grade:q.grade,level:q.level,tasks:0,methods:new Set(),pairs:new Set(),representations:new Set(),categories:new Set()});
      const row=groups.get(key);row.tasks++;ids(q).forEach(id=>row.methods.add(id));if(q.contrastPairId)row.pairs.add(q.contrastPairId);(q.representations||[]).forEach(item=>row.representations.add(item.type));row.categories.add(q.category);
    }
    return [...groups.values()].map(row=>({...row,methods:[...row.methods],pairs:row.pairs.size,representations:[...row.representations],categories:[...row.categories]})).sort((a,b)=>a.grade-b.grade||a.title.localeCompare(b.title,'ru'));
  }
  function renderCoverage(tasks){
    const rows=coverage(tasks);
    return `<section class="glass method-overview"><h2>Покрытие способов и форматов</h2><p>Разметка способов показывает, как решать задачу. Семейство отдельно описывает её варианты. Число способов не является доказательством их независимости.</p><div class="method-table-wrap"><table class="method-table"><thead><tr><th>Тема</th><th>Заданий</th><th>Способы</th><th>Контрастные пары</th><th>Представления</th></tr></thead><tbody>${rows.map(row=>`<tr><th>${row.grade} класс · ${esc(row.title)}</th><td>${row.tasks}</td><td>${row.methods.map(id=>esc(method(id)?.title||id)).join(', ')||'Не размечено'}</td><td>${row.pairs}</td><td>${row.representations.map(esc).join(', ')||'Текст условия'}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function related(q,catalog){const known=new Map((catalog||[]).map(item=>[item.id,item]));return (q.relatedIds||[]).map(id=>known.get(id)).filter(Boolean);}
  return Object.freeze({categories,formats,methods:()=>data().methods,topics:()=>data().topics,ids,method,representations,passport,coverage,renderCoverage,related});
})();
