// Condition-based sketches for the 5–9 geometry bank. Never read a stored answer.
function planarTaskFigure(q,topic){
  if(!topic||topic.grade>9||!/геометри/i.test(topic.subject))return null;
  const p=q.prompt.replace(/−/g,'-'),g=q.generation||{},n=g.parameter,form=g.form;
  const number='[-+]?\\d+(?:[.,]\\d+)?',unit=(p.match(/(?:\d|\s)(см|дм|км)(?=[.,\s²³]|$)/u)||[])[1]||(/метр|\sм(?:[.,\s]|$)/u.test(p)?'м':'');
  const numeric=x=>Number(String(x).replace(',','.'));
  const value=x=>String(x).replace('-','−');
  const length=x=>`${value(x)}${unit?' '+unit:''}`;
  const match=re=>p.match(re);
  const get=(re,i=1)=>{const m=match(re);return m?m[i]:null;};
  const s=geometrySketch('');
  let reference=false;
  const omitVertexNames=()=>{const elements=s.figure().elements;for(let i=elements.length-1;i>=0;i--)if(elements[i].type==='text'&&/^[ABCDHM]$/.test(elements[i].text))elements.splice(i,1);};
  const finish=alt=>{const f=s.figure(reference?'Опорная схема · буквенные обозначения · не в масштабе':'Схема к условию · не в масштабе');f.alt=alt;return f;};
  const title=text=>s.label(text,200,24,'middle',14);
  function triangle(a='a',b='b',c='c',right=false){
    const pts=right?[[105,62],[105,190],[320,190]]:[[200,45],[75,190],[325,190]];
    s.poly(pts,true);s.label('A',pts[0][0],pts[0][1]-12);s.label('B',pts[1][0]-14,pts[1][1]+17);s.label('C',pts[2][0]+14,pts[2][1]+17);
    s.label(a,85,right?129:111);s.label(b,right?218:200,213);s.label(c,right?242:314,109);
    if(right)s.right(105,190);return pts;
  }
  function equalSides(){s.line(131,110,143,120);s.line(257,120,269,110);}
  function rectangle(a='a',b='b',info='',cut=false,square=false){
    const left=square?125:85,right=square?275:315,top=57,bottom=187;
    if(cut){s.poly([[left,top],[right-45,top],[right-45,top+43],[right,top+43],[right,bottom],[left,bottom]],true);s.line(right-45,top,right,top,true);s.line(right,top,right,top+43,true);}
    else s.poly([[left,top],[right,top],[right,bottom],[left,bottom]],true);
    s.right(left,bottom);s.label(a,200,213);s.label(b,left-30,127);if(info)s.label(info,200,130);
    return [left,right,top,bottom];
  }
  function box(a='a',b='b',h='h'){
    s.poly([[85,88],[250,88],[310,49],[145,49]],true);s.poly([[85,88],[250,88],[250,190],[85,190]],true);s.poly([[250,88],[310,49],[310,151],[250,190]],true);
    s.line(85,190,145,151,true);s.line(145,151,310,151,true);s.line(145,151,145,49,true);
    s.label(a,164,215);s.label(b,299,183);s.label(h,335,105);
  }
  function adjacent(known='α',other='β',a=58){
    const r=a*Math.PI/180,ox=200,oy=174;
    s.line(55,oy,345,oy);s.line(ox,oy,ox+125*Math.cos(r),oy-125*Math.sin(r));
    s.arc(ox,oy,30,0,r);s.arc(ox,oy,42,r,Math.PI);
    s.label('A',50,197);s.label('O',200,199);s.label('B',350,197);s.label('C',ox+130*Math.cos(r)+7,oy-130*Math.sin(r)-9);
    const knownMid=r/2,otherMid=(r+Math.PI)/2;
    s.label(known,ox+77*Math.cos(knownMid),oy-77*Math.sin(knownMid)+5);
    s.label(other,ox+83*Math.cos(otherMid),oy-83*Math.sin(otherMid)+5);
  }
  function crossed(a='α',b='β'){
    s.line(64,174,336,66);s.line(64,66,336,174);s.dot(200,120);s.label('O',200,143);
    s.arc(200,120,39,-.38,.38);s.arc(200,120,39,Math.PI-.38,Math.PI+.38);
    s.label(a,266,127);s.label(b,134,127);
  }
  function trapezoid(a='a',b='b',h='h',info=''){
    s.poly([[130,62],[270,62],[330,187],[70,187]],true);s.line(130,62,130,187,true);s.right(130,187);
    s.label(a,200,45);s.label(b,200,213);s.label(h,151,132);if(info)s.label(info,253,145);
  }
  function circle(radius='r',sector=null){
    const cx=190,cy=124,r=77;s.circle(cx,cy,r,sector===null);s.dot(cx,cy);s.label('O',179,145);
    s.line(cx,cy,cx+r,cy);s.label(radius,cx+42,cy+22);
    if(sector!==null){const a=typeof sector==='number'?sector:65,rad=-a*Math.PI/180;
      const points=[[cx,cy],...Array.from({length:33},(_,i)=>[cx+r*Math.cos(rad*i/32),cy+r*Math.sin(rad*i/32)])];s.poly(points,true);
      s.line(cx,cy,cx+r*Math.cos(rad),cy+r*Math.sin(rad));s.arc(cx,cy,25,0,-rad);
      s.dot(cx,cy);s.label(typeof sector==='number'?`${sector}°`:'α',cx+57*Math.cos(rad/2),cy+57*Math.sin(rad/2)+5);s.label('A',cx+r+16,cy+5);s.label('B',cx+(r+16)*Math.cos(rad),cy+(r+16)*Math.sin(rad));}
  }
  function inscribed(angle='α',quad=false,central=false,arc=false){
    const cx=200,cy=125,r=80;s.circle(cx,cy,r);
    if(quad){const pts=[[146,66],[270,87],[238,195],[127,157]];s.poly(pts,true);['A','B','C','D'].forEach((x,i)=>s.label(x,pts[i][0]+(pts[i][0]<200?-15:15),pts[i][1]+(pts[i][1]<125?-10:17)));s.label(angle,157,94);s.label('?',225,169);return;}
    const A=[270,164],B=[147,185],C=[173,50];s.poly([A,B,C],false);s.label('A',285,174);s.label('B',133,198);s.label('C',166,36);s.label('?',180,89);
    if(central){s.line(cx,cy,...A);s.line(cx,cy,...B);s.dot(cx,cy);s.label('O',215,121);s.label(angle,202,156);}
    else if(arc)s.label(`дуга AB: ${angle}`,205,227,'middle',13);
  }
  function similar(a='a',b='b',infoA='',infoB=''){
    s.poly([[90,90],[35,183],[145,183]],true);s.poly([[267,47],[181,183],[353,183]],true);
    s.label(a,90,206);s.label(b,267,206);s.label(infoA,90,160,'middle',12);s.label(infoB,267,160,'middle',12);
  }
  function coordinate(points,vectors=false,reflection=null,shift=null){
    if(!points.length)return null;
    const extent=Math.max(5,...points.flatMap(pt=>[Math.abs(pt.x),Math.abs(pt.y)])),step=78/extent,ox=200,oy=125,tick=/по линиям|маршрут/i.test(p)?1:Math.ceil(extent/4),spacing=step*tick;
    for(let i=-Math.floor(78/spacing);i<=Math.floor(78/spacing);i++)s.line(94,oy+i*spacing,306,oy+i*spacing,true);
    for(let i=-Math.floor(102/spacing);i<=Math.floor(102/spacing);i++)s.line(ox+i*spacing,36,ox+i*spacing,214,true);
    s.arrow(74,oy,326,oy);s.arrow(ox,218,ox,36);s.label('x',339,oy+5);s.label('y',ox+13,44);s.label('0',ox-11,oy+16);
    s.line(ox+spacing,oy-3,ox+spacing,oy+3);s.label(tick,ox+spacing,oy+17,'middle',11);s.line(ox-3,oy-spacing,ox+3,oy-spacing);s.label(tick,ox-11,oy-spacing+4,'end',11);
    points.slice(0,5).forEach((pt,i)=>{const x=ox+pt.x*step,y=oy-pt.y*step;
      if(vectors)s.arrow(ox,oy,x,y);else{s.line(x,y,x,oy,true);s.line(x,y,ox,y,true);s.dot(x,y);}
      const label=`${pt.name||String.fromCharCode(65+i)}(${value(pt.x)}; ${value(pt.y)})`;
      s.label(label,x+(x<ox?-9:9),y+(i%2?-9:-12),x<ox?'end':'start',12);
    });
    if(!vectors&&points.length===2&&!reflection&&!shift){
      if(/по линиям|маршрут/i.test(p)){const [a,b]=points;s.line(ox+a.x*step,oy-a.y*step,ox+b.x*step,oy-a.y*step);s.line(ox+b.x*step,oy-a.y*step,ox+b.x*step,oy-b.y*step);}
      else s.line(ox+points[0].x*step,oy-points[0].y*step,ox+points[1].x*step,oy-points[1].y*step);
    }
    if(reflection){const pt=points[0],x=ox+(reflection==='y'?-pt.x:pt.x)*step,y=oy-(reflection==='x'?-pt.y:pt.y)*step;
      s.dot(x,y);s.label('A′',x+(x<ox?-12:12),y+17);s.line(ox+pt.x*step,oy-pt.y*step,x,y,true);
      title(`Отражение относительно оси ${reflection}`);
    }
    if(shift){title(`Сдвиг: ${shift}`);}
    return finish(`${vectors?'Векторы':'Координатная плоскость'}: ${points.map(pt=>`${pt.name||'A'}(${value(pt.x)}; ${value(pt.y)})`).join(', ')}.${reflection?' Положение образа A′ без подписанных координат.':''}`);
  }
  if(g.model){
    if(g.model==='perimeter'){
      const a=n+7,b=n%9+3,k=n%4+2;
      rectangle(length(a),form===0?'b = ?':length(b),form===0?`P = ${2*(a+b)} м`:'');
      if(form===1){s.line(315,57,350,57,true);s.line(350,57,350,187,true);s.line(315,187,350,187,true);s.label(`+${k} см`,330,42);}
      return finish(form===0?`Прямоугольник: периметр ${2*(a+b)} м, длина ${a} м; ширина неизвестна.`:`Прямоугольник со сторонами ${a} см и ${b} см, длина увеличена на ${k} см.`);
    }
    if(g.model==='rectangle'){
      const a=n+9,b=n%8+4,k=n%3+1;
      rectangle(length(a),form===0?'b = ?':length(b),form===0?`S = ${a*b} м²`:'',form===1);
      if(form===1)s.label(`вырез ${k} × ${k} см`,250,28,'middle',13);
      return finish(form===0?`Прямоугольник: площадь ${a*b} м², одна сторона ${a} м; другая неизвестна.`:`Прямоугольник ${a} × ${b} см, в углу вырезан квадрат ${k} × ${k} см.`);
    }
    if(g.model==='box'){box(length(n+4),length(n%6+3),length(n%5+2));return finish(`Прямоугольный параллелепипед с измерениями ${n+4}, ${n%6+3}, ${n%5+2} ${unit}.`);}
    if(g.model==='angles'){
      if(form===0)adjacent(`${21+n%120}°`,'?',21+n%120);else adjacent('x',`x + ${2*(n%60+1)}°`);
      return finish(form===0?`Развёрнутый угол разделён на угол ${21+n%120}° и неизвестный угол.`:`Смежные углы x и x + ${2*(n%60+1)}°.`);
    }
    if(g.model==='coordinates')return coordinate([{x:form===0?n+3:-(n+3),y:form===0?-(n%11+2):n%11+2,name:'A'}],false,form===0?'y':null,form===1?`${n%7+1} вправо, ${n%11+4} вниз`:null);
    if(g.model==='triangle'){
      triangle('','','');if(form===0){s.label(`${26+n%49}°`,112,174);s.label(`${37+n%31}°`,287,174);s.label('?',200,88);}else{equalSides();s.label(`${2*(n%65+10)}°`,200,93);s.line(325,190,374,190);s.label('?',342,168);}
      return finish(form===0?`Треугольник: два угла ${26+n%49}° и ${37+n%31}°, третий неизвестен.`:`Равнобедренный треугольник с углом при вершине ${2*(n%65+10)}°, искомый внешний угол при основании.`);
    }
    if(g.model==='pythagoras'){
      const k=n+2;triangle(length(form===0?3*k:5*k),form===0?length(4*k):'b = ?',form===0?'c = ?':length(13*k),true);
      return finish(form===0?`Прямоугольный треугольник: катеты ${3*k} см и ${4*k} см, гипотенуза неизвестна.`:`Прямоугольный треугольник: катет ${5*k} см, гипотенуза ${13*k} см, второй катет неизвестен.`);
    }
    if(g.model==='trapezoid'){
      const a=n+5,b=n+11,h=n%8+3;trapezoid(length(a),length(b),form===0?length(h):'h = ?',form===1?`S = ${(a+b)*h/2} см²`:'');
      return finish(`Трапеция с основаниями ${a} и ${b} см; ${form===0?`высота ${h} см`:`высота неизвестна, площадь ${(a+b)*h/2} см²`}.`);
    }
    if(g.model==='similarity'){
      const a=n+4,b=n%7+2;if(form===0)similar(length(2*a),length(3*a),`S = ${4*b} см²`,'S = ?');else{reference=true;similar('a','b',`S = ${4*a} см²`,`S = ${9*a} см²`);title(`P₁ = ${2*(n+7)} см; P₂ = ?`);}
      return finish(form===0?`Подобные треугольники: соответствующие стороны ${2*a} и ${3*a} см, площадь меньшего ${4*b} см².`:'Опорная схема подобных многоугольников: площади и периметр меньшего заданы в условии.');
    }
    if(g.model==='inscribed_angle'){inscribed(`${20+n%140}°`,form===1,false,form===0);return finish(form===0?`Вписанный угол опирается на дугу ${20+n%140}°, угол неизвестен.`:`Вписанный четырёхугольник: один угол ${20+n%140}°, противоположный неизвестен.`);}
    if(g.model==='vectors2'){const a=n+3,b=n%7+2,c=n%5+1;return coordinate(form===0?[{name:'u',x:a,y:-b},{name:'v',x:c,y:2}]:[{name:'A',x:a,y:b},{name:'B',x:a+3*c,y:b+4*c}],form===0);}
    if(g.model==='sector'){circle(`r = ${n+3} см`,30*(n%5+1));return finish(`Окружность радиуса ${n+3} см, сектор с центральным углом ${30*(n%5+1)}°.`);}
    if(g.model==='cosine_rule'){
      const pts=form===0?[[160,68],[90,190],[320,190]]:[[60,49],[140,190],[320,190]];
      s.poly(pts,true);s.label('A',pts[0][0],pts[0][1]-15);s.label('B',pts[1][0]-14,211);s.label('C',335,210);
      s.label(length(n%9+2),form===0?98:69,121);s.label(length(n+3),form===0?205:233,217);s.label('c = ?',form===0?256:222,106);
      s.arc(pts[1][0],190,27,0,(form===0?60:120)*Math.PI/180);s.label(form===0?'60°':'120°',form===0?142:167,174);
      return finish(`Треугольник: стороны ${n+3} и ${n%9+2} см образуют угол ${form===0?60:120}°, третья сторона неизвестна.`);
    }
  }
  // A named diameter must pass through the centre; it is not an arbitrary chord.
  if(/опира[^.]*диаметр|AB[^.]*является диаметром|AB[^.]*диаметр|гипотенузой-диаметром/i.test(p)){
    const A=[120,127],B=[280,127],C=[200,47];s.circle(200,127,80);s.poly([A,B,C],true);s.dot(200,127);s.label('A',106,143);s.label('B',295,143);s.label('C',200,31);s.label('O',200,148);s.label('?',200,76);return finish('AB — диаметр окружности с центром O, C лежит на окружности, угол ACB неизвестен.');
  }
  if(/углы ABC и ADC|ABC.*ADC.*дугу AC/i.test(p)){
    const pt=a=>[200+80*Math.cos(a*Math.PI/180),125-80*Math.sin(a*Math.PI/180)],A=pt(200),C=pt(340),B=pt(110),D=pt(70);s.circle(200,125,80);
    for(const vertex of [B,D]){s.line(...A,...vertex);s.line(...C,...vertex);}s.label('A',A[0]-13,A[1]+17);s.label('C',C[0]+13,C[1]+17);s.label('B',B[0]-8,B[1]-12);s.label('D',D[0]+8,D[1]-12);s.label('α',B[0]+4,B[1]+28);s.label('β',D[0]-4,D[1]+28);reference=true;return finish('Опорная схема: вписанные углы ABC и ADC опираются на одну дугу AC.');
  }
  if(/параллельн.*касательн|касательн.*параллельн/i.test(p)){
    s.circle(200,125,65);s.line(65,60,335,60);s.line(65,190,335,190);s.line(200,60,200,190);s.dot(200,125);s.label('O',185,130);s.label('A',200,45);s.label('B',200,213);s.right(200,60,1,1);s.right(200,190);reference=true;return finish('Опорная схема: две параллельные касательные и перпендикулярный им диаметр AB.');
  }
  if(/касательн/i.test(p)&&/секущ/i.test(p)){
    const cx=160,cy=125,r=68,px=330,dx=px-cx,tx=cx+r*r/dx,ty=cy-r*Math.sqrt(1-r*r/(dx*dx));s.circle(cx,cy,r);s.line(92,125,px,125);s.line(tx,ty,px,125);s.line(cx,cy,tx,ty,true);s.dot(px,125);s.label('P',346,132);s.label('T',tx-5,ty-13);s.label('A',236,145);s.label('B',80,145);s.label('O',149,141);reference=true;return finish('Опорная схема: касательная PT и секущая PAB из общей внешней точки P.');
  }
  if(/(?:две|двух) окружност|окружности радиус|радиусы окружностей/i.test(p)){
    const radii=match(/радиус[а-яё]*\s*(\d+(?:[.,]\d+)?)\s*и\s*(\d+(?:[.,]\d+)?)/),R=radii?numeric(radii[1]):5,r=radii?numeric(radii[2]):3;
    const dKnown=get(/(?:между центрами|центрами)\s*(\d+(?:[.,]\d+)?)/),d=dKnown?numeric(dKnown):/внутренн/.test(p)?Math.abs(R-r):/внешн/.test(p)?R+r:Math.max(R,r);
    const scale=235/(2*Math.max(R,r)+d),x1=200-d*scale/2,x2=200+d*scale/2;s.circle(x1,125,R*scale);s.circle(x2,125,r*scale);s.line(x1,125,x2,125,true);s.dot(x1,125);s.dot(x2,125);s.label('O₁',x1-8,149);s.label('O₂',x2+8,149);s.label(radii?`R = ${R}`:'R',x1-R*scale*.4,125-R*scale-12);s.label(radii?`r = ${r}`:'r',x2+r*scale*.3,125+r*scale+21);reference=!radii;return finish('Две окружности с центрами O₁ и O₂: радиусы и взаимное расположение заданы условием.');
  }
  if(/вписан[а-яё]* окружност|окружност[^.]*вписан|описан[^.]*около окружности/i.test(p)&&/треуголь|трапеци|квадрат|четыр[её]хуголь/i.test(p)){
    if(/треуголь/i.test(p)){s.poly([[200,49],[122.06,184],[277.94,184]],true);s.circle(200,139,45);s.dot(200,139);s.line(200,139,200,184);s.label('r',216,165);}
    else if(/квадрат/i.test(p)){s.poly([[135,60],[265,60],[265,190],[135,190]],true);s.circle(200,125,65);if(/описана другая|описан.*другая/i.test(p))s.circle(200,125,65*Math.sqrt(2));s.line(200,125,265,125);s.label('r',231,145);}
    else {const x=200+(65*Math.sqrt(5)-65)/2,iso=/равнобок/.test(p);s.poly([[iso?400-x:135,60],[x,60],[x+65,190],[iso?400-x-65:135,190]],true);s.circle(200,125,65);s.line(200,125,200,190);s.label('r',215,165);if(/прямоугольн/i.test(p))s.right(135,190);}
    reference=true;return finish('Опорная схема окружности, вписанной в фигуру: радиус к стороне обозначен r.');
  }
  if(/букву Т|сложили крестом/i.test(p)){
    const cross=/крестом/i.test(p),cells=cross?[[1,0],[0,1],[1,1],[2,1],[1,2]]:[[0,0],[1,0],[2,0],[1,1]],cell=48,x=128,y=cross?47:70;
    for(const [cx,cy]of cells)s.poly([[x+cx*cell,y+cy*cell],[x+(cx+1)*cell,y+cy*cell],[x+(cx+1)*cell,y+(cy+1)*cell],[x+cx*cell,y+(cy+1)*cell]],true);title('Каждый квадрат — единичный');return finish(cross?'Крест из пяти единичных квадратов: центральный квадрат и четыре соседних.':'Т-образная фигура из четырёх единичных квадратов: три в ряд и один под средним.');
  }
  if(/паз|посередине[^.]*выемк/i.test(p)){
    s.poly([[80,62],[165,62],[165,105],[225,105],[225,62],[320,62],[320,187],[80,187]],true);s.label('a',200,212);s.label('b',56,127);s.label('ширина паза',197,40,'middle',12);s.label('глубина',251,87,'start',12);reference=true;return finish('Опорная схема: из середины стороны прямоугольника вырезан прямоугольный паз.');
  }
  if(/три квадрата со сторонами 2, 3 и 4/i.test(p)){
    const cells=[[90,140,40],[130,120,60],[190,100,80]];for(const [x,y,a]of cells){s.poly([[x,y],[x+a,y],[x+a,180],[x,180]],true);s.label(`${a/20} см`,x+a/2,y-12);}return finish('Три квадрата со сторонами 2, 3 и 4 см стоят рядом на общей линии основания.');
  }
  if(/(?:sin|cos|tg)\s*(?:α|\d)|радиан/i.test(p)&&!/треуголь|сторон|катет|гипотенуз/i.test(p)){
    const deg=get(/(?:sin|cos|tg)\s*(\d+)°/)||get(/Угол\s*(\d+)°/),a=deg?numeric(deg)*Math.PI/180:/тупой/.test(p)?2.2:1.05,cx=200,cy=139,r=77,x=cx+r*Math.cos(a),y=cy-r*Math.sin(a);
    s.circle(cx,cy,r);s.arrow(86,cy,323,cy);s.arrow(cx,225,cx,33);s.line(cx,cy,x,y);s.dot(x,y);s.line(x,y,x,cy,true);s.arc(cx,cy,27,0,a);s.label('x',337,cy+6);s.label('y',215,33);s.label('O',185,158);s.label('1',cx+r+9,cy+17);s.label('α',226,111);if(deg)title(`α = ${deg}°`);reference=!deg;return finish(`Единичная окружность: угол ${deg?deg+'°':'α'} отсчитывается от положительного направления оси x, радиус равен 1.`);
  }
  if(/стрелк.*час|часы показывают/i.test(p)){
    const time=match(/(\d{1,2}):(\d{2})/);if(time){const hour=numeric(time[1])%12+numeric(time[2])/60,minute=numeric(time[2]);s.circle(200,125,84);for(let h=1;h<=12;h++){const a=h*Math.PI/6;s.label(h,200+69*Math.sin(a),130-69*Math.cos(a),'middle',12);}s.line(200,125,200+45*Math.sin(hour*Math.PI/6),125-45*Math.cos(hour*Math.PI/6));s.line(200,125,200+65*Math.sin(minute*Math.PI/30),125-65*Math.cos(minute*Math.PI/30));s.dot(200,125);return finish(`Часы показывают ${time[0]}; изображены часовая и минутная стрелки.`);}
  }
  if(/гомотети/i.test(p)){
    const O=[90,125],A=[170,85],negative=/коэффициентом?\s*[-−]/.test(p);s.line(40,150,310,15,true);s.dot(...O);s.dot(...A);s.label('O',78,141);s.label('A',181,83);
    if(negative){s.dot(40,150);s.label('A′',40,174);s.arrow(...O,40,150);}else{s.dot(290,25);s.arrow(...O,290,25);s.label('A′',306,29);}
    reference=true;return finish('Опорная схема гомотетии: центр O, точка A и её образ A′ лежат на одной прямой.');
  }
  if(/Два отражения относительно прямых через O/i.test(p)){
    s.line(65,169,335,81);s.line(65,81,335,169);s.dot(200,125);s.label('O',200,148);s.label('a',350,80);s.label('b',350,176);s.label('α',266,130);reference=true;return finish('Опорная схема: две оси отражения пересекаются в O под углом α.');
  }
  if(/про[её]м.*ворот|ворот.*про[её]м/i.test(p)){
    s.line(80,60,320,60);s.line(80,60,80,185);s.line(320,60,320,185);s.line(80,185,174,185);s.line(226,185,320,185);s.line(174,185,226,185,true);s.label('15 м',200,42);s.label('9 м',50,128);s.label('ворота 3 м',200,213);return finish('Прямоугольный участок 15 × 9 м; в ограде оставлен проём 3 м для ворот.');
  }
  if(/Угол 76° разделили/i.test(p)){
    const ox=110,oy=190,r=160,ray=a=>[ox+r*Math.cos(a*Math.PI/180),oy-r*Math.sin(a*Math.PI/180)];s.line(ox,oy,...ray(0));s.line(ox,oy,...ray(76));s.line(ox,oy,...ray(38),true);s.arc(ox,oy,34,0,38*Math.PI/180);s.arc(ox,oy,45,38*Math.PI/180,76*Math.PI/180);s.label('O',96,211);s.label('α',170,177);s.label('α',155,141);title('Весь угол равен 76°');return finish('Угол 76° разделён биссектрисой на две равные части α.');
  }
  if(/Внутри прямого угла AOD/i.test(p)){
    const ox=95,oy=190,ray=a=>[ox+154*Math.cos(a*Math.PI/180),oy-154*Math.sin(a*Math.PI/180)];for(const a of [0,40,65,90])s.line(ox,oy,...ray(a));s.right(ox,oy);s.label('O',81,212);s.label('A',266,196);s.label('B',223,81);s.label('C',163,33);s.label('D',87,22);title('∠AOC = 65°; ∠BOD = 50°');return finish('Лучи OA, OB, OC, OD идут в этом порядке внутри прямого угла AOD. Заданы ∠AOC = 65° и ∠BOD = 50°.');
  }
  if(/Углы AOC и BOD прямые/i.test(p)){
    const ox=200,oy=190,ray=a=>[ox+130*Math.cos(a*Math.PI/180),oy-130*Math.sin(a*Math.PI/180)];[0,66,90,156].forEach(a=>s.line(ox,oy,...ray(a)));s.label('O',201,215);s.label('A',346,196);s.label('B',261,61);s.label('C',193,44);s.label('D',67,143);title('∠AOC = ∠BOD = 90°; ∠BOC = 24°');return finish('Из O выходят лучи OA, OB, OC, OD. Углы AOC и BOD прямые, BOC = 24°.');
  }
  if(/Три различные прямые проходят через одну точку/i.test(p)){
    for(const a of [0,25,92]){const r=a*Math.PI/180;s.line(200-100*Math.cos(r),125+100*Math.sin(r),200+100*Math.cos(r),125-100*Math.sin(r));}s.dot(200,125);s.label('O',215,148);s.label('25°',264,118);s.label('67°',234,73);s.label('?',155,73);return finish('Три прямые пересекаются в O. В одной полуплоскости два последовательных угла 25° и 67°, третий неизвестен.');
  }
  if(/C и D находятся по разные стороны AB/i.test(p)){
    s.poly([[95,125],[200,43],[305,125],[200,207]],true);s.line(95,125,305,125);s.label('A',78,131);s.label('B',322,131);s.label('C',200,27);s.label('D',200,229);reference=true;return finish('Опорная схема: треугольники ABC и ADB имеют общую сторону AB, вершины C и D лежат по разные стороны AB.');
  }
  if(/По одну сторону от AB построены точки C и D/i.test(p)){
    triangle('','','');title('Для C и D заданы одинаковые угловые условия');reference=true;return finish('Опорная схема треугольника ABC; положение точки D определите по угловым условиям.');
  }
  if(/О равноудалена от A и B|O равноудалена от A и B|Две хорды AB и AC равны/i.test(p)){
    s.circle(200,125,78);s.dot(200,125);const A=[200,47],B=[132.45,164],C=[267.55,164];if(/хорды/.test(p)){s.poly([A,B,C],true);s.label('A',200,30);s.label('B',119,180);s.label('C',282,180);}else{[A,B,C].forEach(pt=>s.line(200,125,...pt));s.label('O',215,131);s.label('A',200,30);s.label('B',119,180);s.label('C',282,180);}reference=true;return finish('Опорная схема окружности: точки A, B, C лежат на окружности с центром O.');
  }
  if(/Зеркало лежит между/i.test(p)){
    s.line(60,190,350,190);s.line(100,150,100,190);s.line(310,90,310,190);s.line(100,150,160,190);s.line(160,190,310,90);s.ellipse(160,190,17,4,true);s.label('h',82,174);s.label('H',329,143);s.label('d',127,214);s.label('D',237,214);s.label('зеркало',161,231,'middle',12);reference=true;return finish('Опорная схема: отражение в горизонтальном зеркале между человеком и башней, высоты h и H и расстояния d и D.');
  }
  if(/Путь сначала.*на восток.*на север|Сторона напротив.*сторону напротив 90°/i.test(p)){
    triangle('a','b','c',true);omitVertexNames();reference=true;return finish('Опорная схема прямоугольного треугольника: перпендикулярные стороны a и b, противоположная прямому углу сторона c.');
  }
  if(/Внешний угол при вершине C равен 120°/.test(p)){
    const A=[80,200],B=[260,200],C=[236.82,68.4];s.poly([A,B,C],true);s.line(...C,231.26,36.82);s.arc(...C,25,100*Math.PI/180,220*Math.PI/180);s.label('A',66,221);s.label('B',274,221);s.label('C',255,67);s.label('120°',197,64);title('Внутренние углы A : B = 1 : 2');return finish('Треугольник ABC: внешний угол при C равен 120°, внутренние углы A и B относятся как 1 : 2.');
  }
  if(/Дорога из A в C через B/.test(p)){triangle('7 км','10 км','AC = ?');return finish('Треугольник ABC: путь из A в C через B состоит из участков AB = 7 км и BC = 10 км. Прямое расстояние AC неизвестно.');}
  if(/B не лежит между A и C/.test(p)){
    s.line(75,135,325,135);[[75,'B'],[210,'A'],[325,'C']].forEach(([x,name])=>{s.dot(x,135);s.label(name,x,160);});s.line(75,91,210,91);s.line(75,61,325,61);s.label('AB = 6 см',142,81);s.label('BC = 10 см',200,48);s.label('AC = ?',267,190);return finish('Точки лежат в порядке B, A, C. Известны AB = 6 см и BC = 10 см; AC неизвестно.');
  }
  if(/Три точки лежат на одной прямой/.test(p)){
    [90,168].forEach((y,i)=>{s.line(70,y,330,y);[[80,'X'],[i?270:190,'Y'],[i?190:315,'Z']].forEach(([x,name])=>{s.dot(x,y);s.label(name,x,y+22);});});reference=true;return finish('Опорная схема: для трёх точек на прямой рассмотрите различные порядки расположения и сопоставьте данные расстояния.');
  }
  if(/забор.*столб|границе.*столб/i.test(p)){
    if(/замкнут/.test(p)){s.poly([[100,65],[300,65],[300,180],[100,180]],false);[[100,65],[300,65],[300,180],[100,180],[150,65],[250,180]].forEach(pt=>s.dot(...pt));s.label('…',230,61);s.label('…',300,133);s.label('…',160,183);s.label('d',125,47);s.label('P',200,214);}
    else {s.line(75,125,325,125);[75,125,275,325].forEach(x=>s.dot(x,125));s.label('…',200,118);s.label('d',100,104);s.label('L',200,162);}
    reference=true;return finish('Опорная схема: столбы стоят через одинаковое расстояние d вдоль границы; многоточие обозначает промежуточные столбы.');
  }
  if(/Турист прошёл по прямой/.test(p)){
    s.arrow(75,107,190,107);s.arrow(190,107,325,107);s.arrow(325,167,75,167);s.label('A',65,129);s.label('B',190,129);s.label('C',338,129);s.label('7 км',131,87);s.label('9 км',258,87);s.label('Возвращение C → A',200,198);reference=true;return finish('Схема движения: из A через B в C по одной прямой, затем обратно из C в A. Участки AB = 7 км и BC = 9 км.');
  }
  if(/Робот сделал 8 шагов вправо/.test(p)){
    s.arrow(75,87,325,87);s.arrow(325,157,137.5,157);s.line(325,87,325,157,true);s.label('8 шагов вправо',200,65);s.label('6 шагов влево',231,184);s.label('Один шаг — 1 м',200,219);reference=true;return finish('Схема двух последовательных участков пути робота: 8 шагов вправо и 6 влево. Направления показаны на отдельных строках.');
  }
  if(/углов от|значений градусов от/i.test(p)){
    [[70,170,45,'острый'],[210,170,90,'прямой'],[340,170,130,'тупой']].forEach(([x,y,a,text])=>{s.line(x,y,x+42,y);s.line(x,y,x+54*Math.cos(a*Math.PI/180),y-54*Math.sin(a*Math.PI/180));s.arc(x,y,17,0,a*Math.PI/180);s.label(text,x+5,205,'middle',12);});reference=true;return finish('Опорные примеры острого, прямого и тупого угла; подходящие целые значения выберите из диапазона условия.');
  }
  if(/пересекающиеся прямые.*равноудалённых/i.test(p)){
    const ox=120,oy=170,M=[240,170-120/Math.sqrt(3)],Q=[180,170-60*Math.sqrt(3)];s.line(60,oy,340,oy);s.line(ox,oy,ox+80,oy-80*Math.sqrt(3));s.line(...M,M[0],oy,true);s.line(...M,...Q,true);s.dot(...M);s.label('M',255,M[1]-4);s.label('d',255,140);s.label('d',207,76);s.label('O',108,190);reference=true;return finish('Опорная схема: точка M равноудалена от двух пересекающихся прямых; расстояния — перпендикуляры длины d.');
  }
  if(/тени|тень|тенью|отбрасывает|дерев|шест.*тень/i.test(p)){
    s.poly([[60,70],[60,190],[210,190]],true);s.poly([[280,142],[280,190],[340,190]],true);s.right(60,190);s.right(280,190);s.label('H',43,133);s.label('h',265,169);s.label('L',132,213);s.label('l',311,213);s.label('Параллельные солнечные лучи',200,34,'middle',13);reference=true;return finish('Опорная схема: высоты H и h перпендикулярны земле, солнечные лучи параллельны; длины теней L и l.');
  }
  if(/медиан|центр масс/i.test(p)&&!/окружност|трапец|ромб/i.test(p)){
    triangle('','','');omitVertexNames();s.line(200,45,200,190);s.line(75,190,262.5,117.5,true);s.dot(200,141.67);s.label('центр масс',263,157,'start',12);s.label('медиана',173,104,'end',12);reference=true;return finish('Опорная схема: медиана треугольника и пересечение медиан — центр масс. Обозначения вершин задаются условием.');
  }
  if(/биссектриса делит сторону|биссектриса AD делит BC/i.test(p)){
    triangle('','','');omitVertexNames();s.line(200,45,200,190);s.label('a',116,117);s.label('b',285,117);s.label('m',139,212);s.label('n',261,212);reference=true;return finish('Опорная схема: биссектриса из вершины треугольника делит противоположную сторону на части m и n; прилежащие стороны a и b.');
  }
  if(/четыр[её]хуголь/i.test(p)&&!/окружност|трапец|ромб|параллелограмм/i.test(p)){
    s.poly([[120,59],[302,74],[326,187],[72,191]],true);if(/диагонал|S\(/.test(p)){s.line(120,59,326,187);s.line(302,74,72,191);s.label('O',229,130);}s.label('A',106,48);s.label('B',315,64);s.label('C',340,207);s.label('D',58,211);reference=true;return finish('Опорная схема выпуклого четырёхугольника ABCD; числовые данные задаются условием.');
  }
  if(/сетка|сетке|клеток|клетк|клеточ|полоску/i.test(p)&&!/координат/i.test(topic.title)){
    const strips=/полоск/i.test(p),cols=strips?8:6,rows=strips?1:4,side=strips?32:37,left=(400-cols*side)/2,top=strips?100:49;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)s.poly([[left+col*side,top+row*side],[left+(col+1)*side,top+row*side],[left+(col+1)*side,top+(row+1)*side],[left+col*side,top+(row+1)*side]],false);
    s.label('Одна клетка',200,top+rows*side+25);reference=true;return finish('Опорная схема клетчатой сетки; число рядов, столбцов и выбранные клетки берутся из условия.');
  }
  if(/внешний радиус.*рамк|круглой рамк|кольц/i.test(p)){
    s.circle(200,125,81,true);s.circle(200,125,47);s.line(200,125,281,125);s.line(200,125,200,78);s.label('R',250,146);s.label('r',183,103);reference=true;return finish('Опорная схема круглой рамки: внешняя и внутренняя окружности имеют общий центр и радиусы R и r.');
  }
  if(/перпендикуляр PH|наклонная PA/i.test(p)){
    s.line(60,191,337,191);s.line(142,52,142,191);s.line(142,52,297,191);s.right(142,191);s.label('P',140,35);s.label('H',139,214);s.label('A',310,210);s.label('h',121,126);s.label('l',242,117);reference=true;return finish('Опорная схема: из P к прямой проведены перпендикуляр PH и наклонная PA.');
  }
  if(/две стороны.*образуют угол|стороны.*образуют угол/i.test(p)){
    triangle('a','b','c');omitVertexNames();s.label(get(/угол (\d+)°/)?get(/угол (\d+)°/)+'°':'α',120,171);reference=true;return finish('Опорная схема треугольника: две стороны a и b и угол α между ними.');
  }
  if(/хорд.*перпендикулярна OP|хорда AB видна из центра|дуга радиуса/i.test(p)){
    circle('R');if(/перпендикулярна OP/.test(p)){const d=Math.sqrt(77*77-51*51);s.line(190-d,175,190+d,175);s.line(190,124,190,175,true);s.right(190,175);s.label('P',205,178);s.label('A',119,193);s.label('B',261,193);}else if(/хорд/.test(p)){const a=100*Math.PI/180,A=[190+77*Math.cos(3*Math.PI/2-a/2),124-77*Math.sin(3*Math.PI/2-a/2)],B=[190+77*Math.cos(3*Math.PI/2+a/2),124-77*Math.sin(3*Math.PI/2+a/2)];s.poly([[190,124],A,B],false);s.label('A',A[0]-13,A[1]+18);s.label('B',B[0]+13,B[1]+18);s.label('α',190,155);}reference=true;return finish('Опорная схема окружности: радиус R и геометрические элементы из условия.');
  }
  // Explicit coordinates are plotted with uniform scaling on both axes.
  const pairRE=new RegExp(`(?:([A-ZА-Яa-z])\\s*(?:=|имеет координаты)?\\s*)?\\(\\s*(${number})\\s*;\\s*(${number})\\s*\\)`,'g');
  const pairs=[...p.matchAll(pairRE)].map((m,i)=>({name:m[1]||String.fromCharCode(65+i),x:numeric(m[2]),y:numeric(m[3])}));
  if(pairs.length&&/координат|абсцисс|ординат|расстоян|вектор|отраз|перенос|сдвин|четверт|длин|плоскост|точк|вершин/i.test(p)&&!/окружност|гомотети|повернул|поворот/i.test(p)){
    const reflect=/отраз|отраж/i.test(p)&&!/сначала/i.test(p)?(/ординат|оси y|Oy/.test(p)?'y':/абсцисс|оси x|Ox/.test(p)?'x':null):null;
    return coordinate(pairs,/вектор/i.test(p)&&!/точк|вершин|между/.test(p),reflect);
  }
  if(/координат|вектор/i.test(topic.title)&&!/треуголь|параллелограмм|окружност/i.test(p)){
    reference=true;s.arrow(85,165,335,165);s.arrow(190,218,190,35);s.arrow(190,165,290,75);s.label('x',345,170);s.label('y',204,35);s.label('O',177,184);s.label('a = (aₓ; aᵧ)',290,57);s.line(290,75,290,165,true);s.line(290,75,190,75,true);return finish('Опорная схема: вектор на координатной плоскости и его проекции на оси.');
  }
  // Solids in the introductory geometry course.
  if(/куб|параллелепипед|коробк|ящик|аквариум|контейнер|брусок|бак|сосуд|прямоугольный блок/i.test(p)&&!/квадрат.*куб|кубическ.*площад/i.test(p)){
    if(/кубиками ребра 2 см.*4 кубика в длину, 3 в ширину и 2 в высоту/.test(p)){box('4 кубика','3 кубика','2 кубика');title('Ребро каждого кубика — 2 см');return finish('Коробка заполнена кубиками ребра 2 см: 4 в длину, 3 в ширину и 2 в высоту.');}
    let a=get(/длин[ауы][^\d]{0,15}(\d+(?:[.,]\d+)?)/i),b=get(/ширин[ауы][^\d]{0,15}(\d+(?:[.,]\d+)?)/i),h=get(/высот[ауы][^\d]{0,15}(\d+(?:[.,]\d+)?)/i);
    const dimensions=match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/);
    if(dimensions)[,a,b,h]=dimensions;
    if(/куб/i.test(p)&&!/кубик|параллелепипед/i.test(p)){const edge=get(/(?:ребр[ао]|стороной)[^\d]{0,5}(\d+(?:[.,]\d+)?)/);box(edge?length(edge):'a',edge?length(edge):'a',edge?length(edge):'a');reference=!edge;return finish('Куб: три равных измерения. Значение ребра берётся из условия.');}
    box(a?length(a):'a',b?length(b):'b',h?length(h):'h');reference=!(a&&b&&h);return finish(`Прямоугольный параллелепипед: длина ${a||'a'}, ширина ${b||'b'}, высота ${h||'h'}.`);
  }
  // Circumferences, chords and tangents use distinct constructions.
  if(/касательн/i.test(p)){
    if(/две|касательные PA и PB|касательны[ех].*PA.*PB|PA.*PB/i.test(p)){
      s.circle(160,125,67);s.dot(160,125);s.label('O',144,135);const P=[330,125],A=[186.4,63.4],B=[186.4,186.6];s.line(...P,...A);s.line(...P,...B);s.line(160,125,...A,true);s.line(160,125,...B,true);s.label('P',347,130);s.label('A',186,47);s.label('B',186,211);reference=true;return finish('Опорная схема: из внешней точки P проведены две касательные PA и PB к окружности с центром O.');
    }
    s.circle(190,107,68);s.line(60,175,335,175);s.line(190,107,190,175);s.dot(190,107);s.label('O',176,107);s.label('A',190,197);s.label('r',211,142);s.right(190,175);reference=true;return finish('Опорная схема: радиус OA к точке касания перпендикулярен касательной.');
  }
  if(/пересекающ.*хорд|хорд.*пересека|на одной хорде|друг.*хорд/i.test(p)){
    s.circle(200,125,82);s.line(123,153,277,97);s.line(149,61,251,189);s.dot(200,125);s.label('P',215,128);s.label('A',109,163);s.label('B',291,92);s.label('C',141,47);s.label('D',260,208);s.label('AP',158,151,'middle',12);s.label('PB',242,117,'middle',12);s.label('CP',176,91,'middle',12);s.label('PD',216,169,'middle',12);reference=true;return finish('Опорная схема: хорды AB и CD пересекаются в P; сопоставьте отрезки с данными условия.');
  }
  if(/секущ/i.test(p)&&/окружност|касательн|внешн.*част|полна[яую]/i.test(p)){
    const P=[338,125],D=[170,49],t=(168*168-76*76)/(168*168+76*76),C=[P[0]+(D[0]-P[0])*t,P[1]+(D[1]-P[1])*t];
    s.circle(170,125,76);s.line(94,125,...P);s.line(...D,...P);[P,[246,125],[94,125],C,D].forEach(pt=>s.dot(...pt));s.label('P',354,132);s.label('A',250,147);s.label('B',84,146);s.label('C',C[0]+13,C[1]-8);s.label('D',164,33);reference=true;return finish('Опорная схема: секущие из внешней точки P пересекают окружность в точках A, B и C, D.');
  }
  if(/вписанн.*четыр[её]хуголь|четыр[её]хуголь.*вписан/i.test(p)){inscribed(get(/(?:угол|A)\s*(?:равен|=)?\s*(\d+)°/)||'α',true);reference=true;return finish('Опорная схема вписанного четырёхугольника ABCD с противоположными углами A и C.');}
  if(/вписанн.*угол|\bугол\s[^.]*вписан|опира.*дуг|опира.*диаметр/i.test(p)){
    const angle=get(/центральн[^.]*?(\d+)°/);inscribed(angle?`${angle}°`:'α',false,!!angle);reference=true;return finish('Опорная схема: вписанный угол ACB и дуга AB, на которую он опирается.');
  }
  if(/сектор|длину дуги|длина дуги|центральн.*уг[ло]|дуг.*центральн/i.test(p)){
    const radius=get(/радиус[а-яё]*\s*(?:равен|равна|=)?\s*(\d+(?:[.,]\d+)?)/),angle=get(/(?:уг[ло][а-яё]*|сектор[а-яё]*|дуг[а-яё]*)\s*(?:равен|равна|=)?\s*(\d+)°/);
    circle(radius?`r = ${length(radius)}`:'r',angle?numeric(angle):'α');reference=!(radius&&angle);return finish(`Окружность и сектор: радиус ${radius||'r'}, центральный угол ${angle?angle+'°':'α'}.`);
  }
  if(/кольц/i.test(p)&&/радиус/i.test(p)){s.circle(200,123,82,true);s.circle(200,123,47,false);s.line(200,123,282,123);s.line(200,123,200,76);s.label('R',252,143);s.label('r',184,99);s.label('O',184,143);reference=true;return finish('Опорная схема кольца между концентрическими окружностями радиусов R и r.');}
  if(/правильн.*(?:многоуголь|шестиуголь|пятиуголь|семиуголь|восьмиуголь|десятиуголь|двенадцатиуголь)|периметр пятиуголь|выпуклого семиуголь/i.test(p)){
    const count=/шести/.test(p)?6:/пяти/.test(p)?5:/семи/.test(p)?7:/восьми/.test(p)?8:/двенадцати/.test(p)?12:/десяти/.test(p)?10:null;
    if(!count){circle('R','α');s.line(267,124,190+77*Math.cos(-65*Math.PI/180),124+77*Math.sin(-65*Math.PI/180));reference=true;title('Число сторон n задаётся условием');return finish('Опорная схема: сторона правильного многоугольника AB и соответствующий центральный угол α. Число сторон не показано.');}
    s.circle(200,125,82);const pts=Array.from({length:count},(_,i)=>[200+82*Math.cos(-Math.PI/2+2*Math.PI*i/count),125+82*Math.sin(-Math.PI/2+2*Math.PI*i/count)]);s.poly(pts,true);s.dot(200,125);s.line(200,125,...pts[0]);s.line(200,125,...pts[1]);s.label('O',188,143);s.label('R',178,87);reference=true;return finish(`Опорная схема правильного ${count}-угольника и описанной окружности.`);
  }
  if(/окружност|круга|круг[ ,.]|диаметр/i.test(p)){
    const r=get(/радиус[а-яё]*\s*(?:равен|равна|=)?\s*(\d+(?:[.,]\d+)?)/),d=get(/диаметр[а-яё]*\s*(?:равен|равна|=)?\s*(\d+(?:[.,]\d+)?)/);
    circle(r?`r = ${length(r)}`:'r');if(d){s.line(113,124,267,124);s.label(`d = ${length(d)}`,190,225);}reference=(!r&&!d)||/треуголь|вписан|описан|координат|касани|хорд/i.test(p);return finish(`${reference?'Опорная схема круга':'Круг'} с центром O: ${r?'радиус '+r:d?'диаметр '+d:'радиус r'}.`);
  }
  if(/параллельн.*прям|прям.*параллельн|накрест лежащ|односторонн|соответственн.*уг/i.test(p)){
    s.line(50,75,350,75);s.line(50,171,350,171);s.line(130,221,275,24);s.label('a',359,80);s.label('b',359,176);s.label('c',288,30);s.label('α',260,101);s.label('β',190,156);reference=true;return finish('Опорная схема: две прямые a и b и секущая c; углы α и β расположены между прямыми.');
  }
  if(/смежн|разв[её]рнут/i.test(p)){
    const a=get(/(?:равен|равна|углы|угол)\s*(\d+)°/),delta=get(/на (\d+)° больше/);
    adjacent(a?`${a}°`:'x',delta?`x + ${delta}°`:'?',a?numeric(a):58);return finish(`Смежные углы на прямой: ${a?a+'°':'x'} и ${delta?'x + '+delta+'°':'неизвестный угол'}.`);
  }
  if(/вертикальн[^.]{0,12}уг|пересечени[ия].*прям|прям.*пересека/i.test(p)){crossed('α','β');reference=true;return finish('Опорная схема: пересекающиеся прямые и вертикальные углы α и β.');}
  if(/биссектрис.*угла|уг[ло].*биссектрис|транспортир|повернули.*луч|луч.*повернул|оборот|прямой угол|угла AOC|угла AOB/i.test(p)&&!/треуголь|равнобедрен|гипотенуз/i.test(p)){
    s.line(100,190,334,190);s.line(100,190,248,47);s.line(100,190,312,105,true);s.arc(100,190,42,0,.77);s.label('O',85,210);s.label('A',348,195);s.label('B',254,34);s.label('C',325,101);s.label('α',164,176);s.label('β',161,145);reference=true;return finish('Опорная схема: луч OC внутри угла AOB, части угла обозначены α и β.');
  }
  if(/серединн.*перпендикуляр/i.test(p)){
    s.line(80,184,320,184);s.line(200,30,200,218,true);s.line(80,184,200,62);s.line(320,184,200,62);s.right(200,184);s.dot(200,62);s.label('A',69,203);s.label('B',333,203);s.label('M',211,204);s.label('P',213,57);s.line(132,178,132,190);s.line(267,178,267,190);reference=true;return finish('Опорная схема: P на серединном перпендикуляре к AB, M — середина AB.');
  }
  // Similarity before general triangles: matching sides remain visibly paired.
  if(/подобн/i.test(p)){
    const sides=match(/стороны[^\d]*?(\d+(?:[.,]\d+)?)\s*(?:см)?\s*и\s*(\d+(?:[.,]\d+)?)/),area=get(/площадь меньшего[^\d]*(\d+(?:[.,]\d+)?)/i);
    similar(sides?length(sides[1]):'a',sides?length(sides[2]):'a′',area?`S = ${area}`:'S₁','S₂');reference=!sides;return finish('Подобные треугольники: соответствующие стороны и площади обозначены попарно.');
  }
  if(/DE параллелен BC|средн.*лини.*треуголь|треуголь.*средн.*лини/i.test(p)){
    triangle('','','');s.line(137,118,263,118);s.label('D',120,114);s.label('E',279,114);s.label('DE ∥ BC',200,222);reference=true;return finish('Опорная схема треугольника ABC: отрезок DE параллелен BC.');
  }
  if(/трапец/i.test(p)){
    const bases=match(/основани[яй][^\d]{0,10}(\d+(?:[.,]\d+)?)\s*(?:см)?\s*и\s*(\d+(?:[.,]\d+)?)/),h=get(/высот[аы][^\d]{0,8}(\d+(?:[.,]\d+)?)/);
    trapezoid(bases?length(bases[1]):'a',bases?length(bases[2]):'b',h?length(h):'h');reference=!bases;return finish(`Трапеция с основаниями ${bases?bases[1]+' и '+bases[2]:'a и b'} и высотой ${h||'h'}.`);
  }
  if(/ромб/i.test(p)){
    s.poly([[200,43],[320,125],[200,207],[80,125]],true);s.line(80,125,320,125,true);s.line(200,43,200,207,true);s.right(200,125);s.label('A',200,29);s.label('B',336,129);s.label('C',200,228);s.label('D',64,129);s.label('O',184,146);const ds=match(/диагонали[^\d]{0,10}(\d+)\s*(?:см)?\s*и\s*(\d+)/i);s.label(ds?`d₁ = ${length(ds[1])}`:'d₁',200,111);s.label(ds?`d₂ = ${length(ds[2])}`:'d₂',245,165);reference=!ds;return finish('Ромб с диагоналями d₁ и d₂, пересекающимися в O.');
  }
  if(/параллелограмм/i.test(p)){
    s.poly([[115,68],[325,68],[277,186],[67,186]],true);s.line(115,68,115,186,true);s.right(115,186);s.label('A',101,52);s.label('B',338,63);s.label('C',289,207);s.label('D',53,204);s.label('a',207,212);s.label('h',135,138);
    if(/диагонал|пересечен/i.test(p)){s.line(115,68,277,186);s.line(325,68,67,186);s.label('O',211,133);}reference=true;return finish('Опорная схема параллелограмма ABCD: основание a и перпендикулярная ему высота h.');
  }
  if(/катет|гипотенуз|лестниц|прямоугольн.*треуголь|прямоугольном\s+ABC|угол\s*[ABC]\s*=\s*90/i.test(p)){
    const legs=match(/катеты[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*(?:см)?\s*и\s*(\d+(?:[.,]\d+)?)/i),hyp=get(/(?:гипотенуз[аы]|лестница длиной)[^\d]{0,20}(\d+(?:[.,]\d+)?)/i),leg=get(/(?:один катет|катет)[^\d]{0,15}(\d+(?:[.,]\d+)?)/i);
    triangle(legs?length(legs[1]):leg?length(leg):'a',legs?length(legs[2]):'b',hyp?length(hyp):'c',true);reference=!(legs||hyp||leg)||/[ABC]{2}|угол\s*[ABC]/.test(p);
    if(reference)omitVertexNames();return finish(`${reference?'Опорная схема прямоугольного треугольника':'Прямоугольный треугольник ABC'}: два катета и гипотенуза; известные длины подписаны.`);
  }
  if(/треуголь|равнобедрен|равносторонн|в ABC |в ABCD|в треугольнике/i.test(p)){
    if(/можно ли построить|существ.*треуголь|сколько.*треуголь/i.test(p)){reference=true;triangle('a','b','c');title('Проверьте возможность построения');return finish('Опорная схема треугольника со сторонами a, b, c; возможность построения проверяется по условию.');}
    const iso=/равнобедрен|равносторонн|AB = AC|AB=AC/i.test(p);triangle('','','');if(iso)equalSides();
    const angles=match(/два угла[^\d]{0,20}(\d+)°\s*и\s*(\d+)°/i);
    if(angles){s.label(`${angles[1]}°`,112,172);s.label(`${angles[2]}°`,286,172);s.label('?',200,91);return finish(`Треугольник с двумя заданными углами ${angles[1]}° и ${angles[2]}°.`);}
    const top=get(/(?:угол при вершине|угол между равными сторонами)[^\d]{0,15}(\d+)°/);
    if(top)s.label(`${top}°`,200,90);
    if(/высот|медиан|биссектрис/i.test(p)){s.line(200,45,200,190,true);if(/высот/i.test(p))s.right(200,190);}
    const height=get(/высот[аы][^\d]{0,8}(\d+(?:[.,]\d+)?)/),base=get(/основани[ея][^\d]{0,8}(\d+(?:[.,]\d+)?)/);
    if(height)s.label(length(height),221,128);if(base)s.label(length(base),200,230);
    const side=get(/боковая сторона[^\d]{0,5}(\d+(?:[.,]\d+)?)/);if(side){s.label(length(side),104,109);s.label(length(side),297,109);}
    reference=true;omitVertexNames();return finish(`Опорная схема ${iso?'равнобедренного ':''}треугольника${/высот|медиан|биссектрис/i.test(p)?' с дополнительным отрезком из вершины':''}; буквенные обозначения вершин задаются условием.`);
  }
  if(/Из квадрата вырезали прямоугольник/i.test(p)){
    rectangle('a','a','',true,true);s.label('вырез: 3 × 5',245,31,'middle',13);reference=true;return finish('Опорная схема: из квадрата неизвестной стороны a удалён прямоугольник 3 × 5. Размеры выреза не являются сторонами исходного квадрата.');
  }
  if(/прямоуголь|квадрат|площад.*покрыт|площад.*плит/i.test(p)){
    const dims=match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/),sides=match(/стороны[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*(?:см)?\s*и\s*(\d+(?:[.,]\d+)?)/),a=dims?dims[1]:sides?sides[1]:get(/длин[ауы][^\d]{0,12}(\d+(?:[.,]\d+)?)/),b=dims?dims[2]:sides?sides[2]:get(/ширин[ауы][^\d]{0,12}(\d+(?:[.,]\d+)?)/),sq=/квадрат имеет|квадрата|квадрат со стороной|у квадрата/i.test(p)&&!/прямоуголь/i.test(p),edge=get(/сторон[ауы][^\d]{0,8}(\d+(?:[.,]\d+)?)/),area=get(/площадь[^\d]{0,22}(\d+(?:[.,]\d+)?)/),perimeter=get(/периметр[^\d]{0,22}(\d+(?:[.,]\d+)?)/);
    rectangle(a?length(a):sq&&edge?length(edge):'a',b?length(b):sq&&edge?length(edge):'b',area?`S = ${area}`:perimeter?`P = ${perimeter}`:'',/вырезал.*угл|угл.*вырезал/.test(p),sq);
    if(/диагонал/i.test(p)){s.line(sq?125:85,57,sq?275:315,187);s.label('d',210,111);}
    reference=!(a&&b||sq&&edge);return finish(`${sq?'Квадрат':'Прямоугольник'}: известные измерения из условия подписаны; остальные обозначены буквами.`);
  }
  if(/отрезк|середина|на прямой|ломан/i.test(p)){
    const zig=/ломан/i.test(p);const pts=zig?[[65,158],[137,73],[211,164],[284,85],[342,153]]:[[65,126],[200,126],[335,126]];
    pts.slice(1).forEach((pt,i)=>s.line(...pts[i],...pt));pts.forEach((pt,i)=>{s.dot(...pt);s.label(zig?String.fromCharCode(65+i):['A','M','B'][i],pt[0],pt[1]+25);});
    if(/середина/.test(p)){s.line(130,120,130,132);s.line(267,120,267,132);}reference=true;return finish(zig?'Опорная схема ломаной: длина пути складывается из длин звеньев.':'Опорная схема отрезка AB с промежуточной точкой M; порядок и длины уточните по условию.');
  }
  return null;
}
