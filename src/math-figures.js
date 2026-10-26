// Shared mathematical notation and vector drawings for screen and PDF.
const FIGURE_TASKS=new Map(BANK.flatMap(t=>t.tasks.map(q=>[q.id,q])));
const FIGURE_TOPICS=new Map(BANK.flatMap(t=>t.tasks.map(q=>[q.id,t])));
const FIGURE_CACHE=new Map();
const SUPER_MAP={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁽':'(','⁾':')','ⁿ':'n','ˣ':'x'};
const SUB_MAP={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₙ':'n','₊':'+'};
function mathTokens(value){
  const text=String(value),out=[];
  const decimal=String.raw`(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
  // Match a whole radical before its numeric suffix: 5√2/2 must keep 5√2 above the bar.
  const radical=String.raw`[+−-]?(?:${decimal}\s*(?:[·×*]\s*)?)?√\s*(?:\([^()]+\)|${decimal})`;
  // An explicit product after the denominator stays outside: 5/2×√3 = (5/2)×√3.
  const denominatorRadical=String.raw`[+−-]?(?:${decimal}\s*)?√\s*(?:\([^()]+\)|${decimal})`;
  const pi=String.raw`[+−-]?(?:${decimal}\s*(?:[·×*]\s*)?)?π`;
  const denominatorPi=String.raw`[+−-]?(?:${decimal}\s*)?π`;
  const operand=String.raw`(?:${radical}|${pi}|\([^()]+\)|[−-]?${decimal})`;
  const denominator=String.raw`(?:${denominatorRadical}|${denominatorPi}|\([^()]+\)|[−-]?${decimal})`;
  const pattern=new RegExp(String.raw`(${operand})\s*\/\s*(${denominator})|\^(\([^)]*\)|[+-]?\d+|[a-zA-Zα-ωΑ-Ω])|([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿˣ]+)|([₀₁₂₃₄₅₆₇₈₉ₙ₊]+)`,'g');
  let cursor=0;
  for(const m of text.matchAll(pattern)){
    let start=m.index,top=m[1];
    // In x−√3/2 the minus is a binary operator; in −√3/2 it belongs to the numerator.
    if(top&&/^[+−-]/.test(top)&&/[√π]/.test(top)&&/[\p{L}\p{N})\]]$/u.test(text.slice(0,start).trimEnd())){start++;top=top.slice(1);}
    if(start>cursor)out.push({type:'text',text:text.slice(cursor,start)});
    if(top)out.push({type:'fraction',top,bottom:m[2]});
    else if(m[3])out.push({type:'sup',text:m[3]});
    else if(m[4])out.push({type:'sup',text:[...m[4]].map(c=>SUPER_MAP[c]).join('')});
    else out.push({type:'sub',text:[...m[5]].map(c=>SUB_MAP[c]).join('')});
    cursor=m.index+m[0].length;
  }
  if(cursor<text.length)out.push({type:'text',text:text.slice(cursor)});
  return out;
}
function mathHTML(value){
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return mathTokens(value).map(t=>t.type==='text'?e(t.text):t.type==='fraction'?`<span class="fraction" role="math" aria-label="${e(t.top)} делить на ${e(t.bottom)}"><span aria-hidden="true">${mathHTML(t.top)}</span><span aria-hidden="true">${mathHTML(t.bottom)}</span></span>`:`<${t.type}>${e(t.text)}</${t.type}>`).join('');
}
function legacyGeometryFigure(id){
  const [grade,topic,n]=id.split('-').map(Number),key=`${grade}-${topic}`;
  const elements=[];
  const line=(x1,y1,x2,y2,dash=false)=>elements.push({type:'line',x1,y1,x2,y2,dash});
  const poly=(points,fill=true)=>elements.push({type:'polygon',points,fill});
  const circle=(x,y,r,fill=false)=>elements.push({type:'ellipse',x,y,rx:r,ry:r,fill});
  const ellipse=(x,y,rx,ry,fill=false)=>elements.push({type:'ellipse',x,y,rx,ry,fill});
  const label=(text,x,y,anchor='middle',size=14)=>elements.push({type:'text',text,x,y,anchor,size});
  const dot=(x,y)=>circle(x,y,2.5,true);
  const right=(x,y,dx=1,dy=-1)=>{line(x+10*dx,y,x+10*dx,y+10*dy);line(x+10*dx,y+10*dy,x,y+10*dy);};
  const arrow=(x1,y1,x2,y2)=>{line(x1,y1,x2,y2);const a=Math.atan2(y2-y1,x2-x1);line(x2,y2,x2-7*Math.cos(a-.45),y2-7*Math.sin(a-.45));line(x2,y2,x2-7*Math.cos(a+.45),y2-7*Math.sin(a+.45));};
  const box=()=>{poly([[85,60],[215,60],[265,30],[135,30]]);poly([[215,60],[265,30],[265,130],[215,160]]);poly([[85,60],[215,60],[215,160],[85,160]]);line(85,160,135,130,true);line(135,130,265,130,true);line(135,130,135,30,true);};
  let alt='';
  switch(key){
    case '5-6':case '5-7':{
      const a=topic===6?n+4:n+5,b=topic===6?n+2:4;
      poly([[85,45],[275,45],[275,135],[85,135]]);right(85,135);label('A',74,148);label('B',74,36);label('C',286,36);label('D',286,148);label(`${a} см`,180,158);label(`${b} см`,52,95);alt=`Прямоугольник ABCD: стороны ${a} см и ${b} см.`;break;
    }
    case '5-8':box();label(`${n+3} см`,150,178);label('2 см',295,104);label('3 см',286,28);alt=`Прямоугольный параллелепипед: длина ${n+3} см, ширина 3 см, высота 2 см.`;break;
    case '6-7':case '6-8':{
      const ox=180,oy=topic===8?90:145;
      arrow(35,oy,325,oy);arrow(ox,170,ox,12);label('x',335,oy+5);label('y',194,18);label('0',169,oy+17);
      if(topic===7){const x=ox-(n+2)*15,y=oy-(n+4)*15;line(x,y,x,oy,true);line(x,y,ox,y,true);dot(x,y);label(`A(−${n+2}; ${n+4})`,x-7,y-13,'middle',13);alt=`Координатная плоскость, точка A(−${n+2}; ${n+4}).`;}
      else {const x=ox+(n+1)*20,y=oy-3*n*6;line(x,y,x,2*oy-y,true);dot(x,y);dot(x,2*oy-y);label('A',x+12,y-6,'start');label('A′',x+12,2*oy-y+12,'start');label(`A(${n+1}; ${3*n})`,80,25);alt=`Точка A(${n+1}; ${3*n}) и её отражение A′ относительно оси x. Ордината A′ не указана.`;}
      break;
    }
    case '7-6':{
      const angle=40+10*n,a=angle*Math.PI/180;line(45,135,315,135);line(180,135,180+105*Math.cos(a),135-105*Math.sin(a));label('A',40,155);label('O',180,156);label('B',320,155);label(`${angle}°`,238,117);label('?',139,100);alt=`Два смежных угла: один ${angle}°, второй неизвестен.`;break;
    }
    case '7-7':poly([[180,25],[80,150],[280,150]]);line(126,82,137,90);line(223,90,234,82);label('A',180,17);label('B',67,160);label('C',293,160);label(`${40+20*n}°`,180,64);label('?',111,140);label('?',249,140);alt=`Равнобедренный треугольник ABC, AB = AC, угол A равен ${40+20*n}°. Углы при основании неизвестны.`;break;
    case '8-5':poly([[90,30],[90,145],[280,145]]);right(90,145);label('A',77,27);label('B',78,162);label('C',292,158);label(`${3*n} см`,53,89);label(`${4*n} см`,185,166);label('c = ?',216,78);alt=`Прямоугольный треугольник: катеты ${3*n} см и ${4*n} см, гипотенуза c неизвестна.`;break;
    case '8-6':poly([[115,40],[245,40],[290,145],[65,145]]);line(115,40,115,145,true);right(115,145);label(`${n+3} см`,180,25);label(`${n+7} см`,180,168);label('4 см',142,100);alt=`Трапеция с основаниями ${n+3} см, ${n+7} см и высотой 4 см.`;break;
    case '8-7':poly([[25,140],[78,66],[130,140]]);poly([[175,140],[254,28],[333,140]]);label(`${n+3} см`,78,161);label(`${2*(n+3)} см`,254,161);label(`S = ${5*n} см²`,78,124,'middle',12);label('S = ?',254,110);alt=`Два подобных треугольника. Стороны ${n+3} см и ${2*(n+3)} см. Площадь первого ${5*n} см², второго неизвестна.`;break;
    case '9-5':arrow(60,115,310,115);arrow(150,165,150,15);arrow(150,115,150+25*n,65);arrow(150,115,225,140);label('x',321,120);label('y',163,20);label('O',138,132);label(`a (${n}; 2)`,182+25*n,52);label('b (3; −1)',245,159);alt=`Векторы a(${n}; 2) и b(3; −1) от общего начала.`;break;
    case '9-6':circle(180,90,65,true);line(180,90,245,90);dot(180,90);label('O',170,110);label(`r = ${n+2} см`,213,78,'middle',13);alt=`Круг с центром O и радиусом ${n+2} см.`;break;
    case '9-7':poly([[75,145],[285,145],[138,36]]);label(`${5*n} см`,180,168);label(`${3*n} см`,82,82);label('60°',112,132);label('c',230,81);alt=`Треугольник: стороны ${3*n} см и ${5*n} см образуют угол 60°, третья сторона c неизвестна.`;break;
    case '10-5':poly([[40,112],[250,112],[325,165],[115,165]]);line(180,24,180,140,true);line(180,24,290,140);line(180,140,290,140);right(180,140);label('A',180,17);label('H',166,157);label('B',300,151);label(`${5*n} см`,259,80);label(`${4*n} см`,239,159);label('?',163,87);alt=`AH — перпендикуляр к плоскости. Наклонная AB = ${5*n} см, её проекция HB = ${4*n} см. AH неизвестно.`;break;
    case '10-6':box();label('5 см',300,104);label(`S осн. = ${6*n} см²`,153,178,'middle',13);alt=`Прямая призма: площадь основания ${6*n} см², высота 5 см.`;break;
    case '10-7':poly([[75,129],[190,162],[285,126],[169,93]]);line(180,20,75,129);line(180,20,190,162);line(180,20,285,126);line(180,20,169,93,true);line(180,20,180,129,true);right(180,129);label('6 см',211,84);label(`S осн. = ${12*n} см²`,176,179,'middle',13);alt=`Пирамида: площадь основания ${12*n} см², высота 6 см.`;break;
    case '11-5':ellipse(180,140,65,20,true);line(115,45,115,140);line(245,45,245,140);ellipse(180,45,65,20,true);line(180,45,245,45);label(`r = ${n+1} см`,179,18);label('5 см',280,100);alt=`Цилиндр: радиус ${n+1} см, высота 5 см.`;break;
    case '11-6':ellipse(180,143,66,20,true);line(180,20,114,143);line(180,20,246,143);line(180,20,180,143,true);line(180,143,246,143);label('6 см',202,87);label(`r = ${n+1} см`,219,175,'middle',13);alt=`Конус: радиус основания ${n+1} см, высота 6 см.`;break;
    case '11-7':arrow(150,110,315,110);arrow(150,110,65,166);arrow(150,110,150,15);label('x',327,115);label('y',52,177);label('z',162,20);label('O',137,104);arrow(150,110,150+23*n-26,159);arrow(150,110,219,25);label(`a (${n}; 2; −1)`,147+23*n,178,'middle',12);label('b (3; 0; 4)',247,30,'middle',12);alt=`Векторы a(${n}; 2; −1) и b(3; 0; 4) в пространстве.`;break;
    default:return null;
  }
  return {width:360,height:190,alt,elements};
}
function geometryFigure(id){
  if(FIGURE_CACHE.has(id))return FIGURE_CACHE.get(id);
  const q=FIGURE_TASKS.get(id);if(!q)return null;
  const topic=FIGURE_TOPICS.get(id);
  let figure=q.figure||(Number(topic.grade)<=9?planarTaskFigure(q,topic):spatialTaskFigure(q,topic));
  if(!figure&&q.legacyFigure)figure=legacyGeometryFigure(q.legacyFigure);
  if(!figure&&Number(id.split('-')[0])<=6&&Number(id.split('-')[2])<=3)figure=legacyGeometryFigure(id);
  const prepared=figure&&typeof guideGeometryFigure==='function'?guideGeometryFigure(q,topic,figure):figure||null;
  FIGURE_CACHE.set(id,prepared);return prepared;
}
function figureSVG(id,compact=false,options={}){
  const original=geometryFigure(id);if(!original)return '';
  const f=options.view==='section'?(original.views?.section||original.section||original):original;
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const learning=Number.isInteger(options.stage),index=learning?options.stage:-1,stage=index>=0?(f.stages||original.stages||[])[Math.min(index,(f.stages||original.stages||[]).length-1)]:null;
  const wanted=stage?.highlight||[],matches=role=>String(role||'').split(/\s+/).some(r=>wanted.some(w=>r===w||r.startsWith(w.endsWith(':')?w:w+':')));
  const showAuxiliary=options.showAuxiliary===true||!learning||index>=1&&stage?.showAuxiliary!==false;
  const shape=f.elements.filter(p=>showAuxiliary||!p.auxiliary&&!String(p.role||'').split(/\s+/).includes('auxiliary')).map(p=>{
    const selected=!!stage&&matches(p.role),color=selected?'#a34d13':'#45664c',fill=p.fill?(selected?'#fff0cc':'#e3edda'):'none';
    const attrs=`class="figure-element${selected?' figure-highlight':''}" data-figure-role="${e(p.role||'')}" stroke="${color}" stroke-width="${selected?3:1.6}"`;
    if(p.type==='line')return `<line ${attrs} x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" ${p.dash?'stroke-dasharray="4 4"':''}/>`;
    if(p.type==='polygon')return `<polygon ${attrs} points="${p.points.map(a=>a.join(',')).join(' ')}" fill="${fill}"/>`;
    if(p.type==='ellipse')return `<ellipse ${attrs} cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${fill}"/>`;
    return `<text class="figure-element${selected?' figure-highlight':''}" data-figure-role="${e(p.role||'')}" x="${p.x}" y="${p.y}" text-anchor="${p.anchor}" font-size="${f.caption?p.size:Math.max(16,p.size)}" font-weight="${selected?700:400}" stroke="none" fill="${selected?'#943e0d':'#294532'}">${e(p.text)}</text>`;
  }).join('');
  const enlarge=options.interactive===false?'':`<button type="button" class="figure-enlarge" data-action="figure-enlarge" data-figure-id="${e(id)}"${learning?` data-figure-stage="${index}"`:''} aria-label="Увеличить чертёж задания ${e(id)}">Увеличить чертёж</button>`;
  return `<figure class="math-figure ${compact?'compact':''}"${learning?` data-figure-stage="${index}"`:''}><svg viewBox="0 0 ${f.width} ${f.height}" role="img" aria-label="${e(f.alt)}" xmlns="http://www.w3.org/2000/svg"><g stroke="#45664c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" font-family="Arial, sans-serif">${shape}</g></svg><figcaption>${e(f.caption||'Схема, не в масштабе')}</figcaption>${stage?`<p class="figure-stage-label" role="status"><span aria-hidden="true">●</span> ${e(stage.title)}</p>`:''}${enlarge}</figure>`;
}

// Pages with drawings or a long condition reserve a full A4 page for the task.
function taskPages(tasks){
  const pages=[];let pending=[];
  tasks.forEach((q,i)=>{
    const entry={q,number:i+1};
    if(q.kind==='open'||geometryFigure(q.id)||q.prompt.length>220){
      if(pending.length){pages.push(pending);pending=[];}pages.push([entry]);
    }else{pending.push(entry);if(pending.length===2){pages.push(pending);pending=[];}}
  });
  if(pending.length)pages.push(pending);return pages;
}
