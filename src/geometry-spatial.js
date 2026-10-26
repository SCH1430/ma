// Stereometry diagrams contain only givens; answers and solutions are never read.
function spatialTaskFigure(q,topic){
  if(!topic||topic.grade<10||!/геометри/i.test(topic.subject||''))return null;
  const p=String(q.prompt).toLowerCase(),g=q.generation||{},n=Number(g.parameter),form=g.form;
  const s=geometrySketch('Пространственная схема к условию: '+q.prompt,400,240);
  const num='[−-]?\\d+(?:[.,]\\d+)?',pick=pattern=>p.match(new RegExp(pattern,'i'))?.[1];
  const unit=g.model?'см':/см/.test(p)?'см':/дм/.test(p)?'дм':/\sм(?:[²³\s,.]|$)/.test(p)?'м':'';
  const cm=v=>v==null?'?':String(v)+(unit?' '+unit:'');
  let reference=true,name='';
  const namedPoints=[...String(q.prompt).matchAll(/([A-ZА-Я])\s*\(\s*([−-]?\d+(?:[.,]\d+)?)\s*;\s*([−-]?\d+(?:[.,]\d+)?)\s*;\s*([−-]?\d+(?:[.,]\d+)?)\s*\)/g)];
  function label(text,x,y,anchor='middle'){s.label(text,x,y,anchor,12);}
  function half(x,y,rx,ry,rear){for(let i=0;i<24;i++){const a=(rear?Math.PI:0)+i*Math.PI/24,b=a+Math.PI/24;s.line(x+rx*Math.cos(a),y+ry*Math.sin(a),x+rx*Math.cos(b),y+ry*Math.sin(b),rear);}}
  function box(a='a',b='b',h='h',diagonal=false){
    name='параллелепипед';
    const A=[95,180],B=[230,180],C=[295,143],D=[160,143],A1=[95,75],B1=[230,75],C1=[295,38],D1=[160,38];
    for(const [u,v] of [[A,B],[B,C],[A,A1],[B,B1],[C,C1],[A1,B1],[B1,C1],[C1,D1],[D1,A1]])s.line(...u,...v);
    for(const [u,v] of [[A,D],[D,C],[D,D1]])s.line(...u,...v,true);
    label(a,162,204);label(b,293,184);label(h,64,130);
    if(diagonal){s.line(...A,...C1,true);label('d = ?',211,121);}
  }
  function prism(area='S осн.',h='h',sides=4){
    name='призма';
    const pts=Array.from({length:sides},(_,i)=>{const a=Math.PI/2+2*Math.PI*i/sides;return[180+88*Math.cos(a),170+25*Math.sin(a)];});
    for(let i=0;i<sides;i++){const a=pts[i],b=pts[(i+1)%sides];s.line(...a,...b,(a[1]+b[1])/2<170);s.line(a[0],a[1]-111,b[0],b[1]-111);s.line(...a,a[0],a[1]-111,a[1]<151);}
    s.line(300,57,300,171);s.line(294,57,306,57);s.line(294,171,306,171);label(h,335,121);label(area,180,225);
  }
  function pyramid(area='S осн.',h='h',sides=4){
    name='пирамида';const tip=[190,33],cy=178;
    const pts=Array.from({length:sides},(_,i)=>{const a=Math.PI/2+2*Math.PI*i/sides;return[190+99*Math.cos(a),cy+27*Math.sin(a)];});
    for(let i=0;i<sides;i++){const a=pts[i],b=pts[(i+1)%sides];s.line(...a,...b,(a[1]+b[1])/2<cy);s.line(...tip,...a,a[1]<cy-5);}
    s.line(...tip,190,cy,true);s.right(190,cy);s.dot(190,cy);label('S',190,22);label('H',176,cy+15);label(h,230,143);label(area,190,228);
    if(/рассеч|сечен/.test(p)){
      const cuts=/1\/3.*2\/3/.test(p)?[1/3,2/3]:[.5];
      for(const t of cuts)s.poly(pts.map(([x,y])=>[tip[0]+(x-tip[0])*t,tip[1]+(y-tip[1])*t]),true);
      name='пирамида и параллельные сечения';
    }
  }
  function projection(h='AH',ab='AB',hb='HB'){
    name='наклонная и её проекция';s.poly([[46,153],[273,153],[337,204],[110,204]],true);
    s.line(160,39,160,176,true);s.line(160,39,293,176);s.line(160,176,293,176);s.right(160,176);
    label('A',160,26);label('H',146,192);label('B',304,190);label(h,99,107);label(ab,270,94);label(hb,228,199);
  }
  function round(kind,r='r',h='h',R='R',l=''){
    name=kind==='cone'?'конус':kind==='frustum'?'усечённый конус':'цилиндр';
    const cx=188,by=179,rx=79,ty=52,tr=kind==='frustum'?44:79;
    half(cx,by,rx,22,true);half(cx,by,rx,22,false);
    if(kind==='cone'){s.line(cx,ty,cx-rx,by);s.line(cx,ty,cx+rx,by);label('S',cx,40);}
    else{s.ellipse(cx,ty,tr,17);s.line(cx-tr,ty,cx-rx,by);s.line(cx+tr,ty,cx+rx,by);if(kind==='frustum'){s.line(cx,ty,cx+tr,ty);label(r,cx+tr/2,ty-28);}}
    s.line(cx,ty,cx,by,true);s.line(cx,by,cx+rx,by);s.right(cx,by);s.dot(cx,by);label('O',cx-13,by+15);label(h,90,115,'end');label(kind==='frustum'?R:r,229,222);if(l)label(l,314,117);
  }
  function sphere(r='R',d='',height='',section=false){
    name=height?'шаровой сегмент':section?'сечение шара':'шар';
    const cx=184,cy=123,rx=84,sy=section||height?89:123,rr=section||height?77:84;
    s.circle(cx,cy,rx);half(cx,sy,rr,16,true);half(cx,sy,rr,16,false);s.dot(cx,cy);label('O',cx-14,cy+17);
    if(section||height){s.line(cx,cy,cx,sy,true);s.line(cx,sy,cx+rr,sy);s.line(cx,cy,cx+rr,sy);s.right(cx,sy,1,1);label('H',cx-20,sy+9);label('r',cx+rr+17,sy-7,'start');label(d||'d',137,111);label(r,285,155,'start');if(height){s.line(301,39,301,sy);s.line(295,39,307,39);s.line(295,sy,307,sy);label(height,337,69);}}
    else{s.line(cx,cy,cx+68,cy-49);label(r,285,91,'start');}
  }
  function vectors(a=null,b=null,names=['a','b'],pointMode=false){
    name='пространственные векторы';const o=[161,143];s.arrow(...o,320,143);s.arrow(...o,126,213);s.arrow(...o,161,25);label('x',335,148);label('y',113,205);label('z',174,27);label('O',148,139);
    if(a&&b){
      const proj=v=>[v[0]-.35*v[1],.7*v[1]-v[2]],u=proj(a),v=proj(b),k=Math.min(110/Math.max(1,...[u,v].map(x=>Math.abs(x[0]))),97/Math.max(1,...[u,v].map(x=>Math.abs(x[1]))));
      for(const [z,i] of [[u,0],[v,1]]){const x=o[0]+k*z[0],y=o[1]+k*z[1];if(pointMode){s.line(...o,x,y,true);s.dot(x,y);}else s.arrow(...o,x,y);label(names[i],x+10,y-9);}
      if(pointMode)s.line(o[0]+k*u[0],o[1]+k*u[1],o[0]+k*v[0],o[1]+k*v[1]);
      label(names[0]+' = ('+a.join('; ')+')',93,227);label(names[1]+' = ('+b.join('; ')+')',289,227);
    }else{s.arrow(...o,251,68);s.arrow(...o,279,176);label('a',264,64);label('b',294,185);}
  }
  function similar(){
    name='подобные тела';s.poly([[50,103],[123,103],[123,183],[50,183]]);s.poly([[50,103],[72,87],[145,87],[123,103]]);s.poly([[123,103],[145,87],[145,167],[123,183]]);
    s.poly([[238,77],[329,77],[329,184],[238,184]]);s.poly([[238,77],[265,56],[356,56],[329,77]]);s.poly([[329,77],[356,56],[356,163],[329,184]]);s.arrow(167,125,214,125);label('k',191,109);label('V₁',93,221);label('V₂',289,221);
  }
  if(g.model==='spatial_distance'&&Number.isFinite(n)){
    reference=false;const k=n+2;if(form===0)projection('AH = '+cm(3*k),'AB = '+cm(5*k),'HB = ?');else box(cm(2*k),cm(3*k),cm(6*k),true);
  }else if(g.model==='solid_volume'&&Number.isFinite(n)){
    reference=false;(form===0?prism:pyramid)('S осн. = '+3*(n+4)+' см²','h = '+cm(n%9+3));
  }else if(g.model==='cylinder'&&Number.isFinite(n)){reference=false;round('cylinder','r = '+cm(n+2),'h = '+cm(n%9+3));
  }else if(g.model==='sphere'&&Number.isFinite(n)){reference=false;sphere('R = '+cm(n+2));
  }else if(g.model==='frustum'&&Number.isFinite(n)){
    reference=false;const r=n+2,R=r+n%5+1;round('frustum','r = '+cm(r),form===0?'h = '+cm(3*(n%7+1)):'h','R = '+cm(R),form===1?'l = '+cm(R+r+n+1):'');
  }else if(g.model==='sphere_section'&&Number.isFinite(n)){
    reference=false;if(form===0)sphere('R = '+cm(5*(n+2)),'d = '+cm(3*(n+2)),'',true);else sphere('R = '+cm(n+4),'','h = '+cm(n%5+1),true);
  }else if(g.model==='vectors3'&&Number.isFinite(n)){
    if(form===0){reference=false;vectors([n+2,n%7+1,n%5+2],[2,-1,3],['u','v']);}
    else{name='перпендикулярные векторы';s.arrow(127,177,127,53);s.arrow(127,177,293,177);s.right(127,177);label('u',114,43);label('v',307,181);label('u = ('+(n+2)+'; '+(n%7+1)+'; k)',109,222);label('v = (2; −1; 1)',295,222);}
  }else if(g.model==='volume_scale'){similar();
  }else if(/подобн|при увеличении всех размеров|при подобии/.test(p)&&!/сечен|вписан/.test(p)){similar();
  }else if(/вектор|a\s*=\s*\(|b\s*=\s*\(|a,b|базис/.test(p)){
    const groups=[...p.matchAll(/\(\s*([−-]?\d+(?:[.,]\d+)?)\s*;\s*([−-]?\d+(?:[.,]\d+)?)\s*;\s*([−-]?\d+(?:[.,]\d+)?)\s*\)/g)];
    if(groups.length>=2&&/вектор|a\s*=|b\s*=/.test(p)){reference=false;vectors(...groups.slice(0,2).map(m=>m.slice(1).map(v=>Number(v.replace('−','-').replace(',','.')))));}else vectors();
  }else if(/наклонн|ah.*плоскост|перпендикуляр.*плоскост/.test(p)){
    const ah=pick('AH\\s*=\\s*('+num+')'),ab=pick('AB\\s*=\\s*('+num+')')||pick('наклонн[^.]*?(?:длиной|длины)\\s*('+num+')'),hb=pick('HB\\s*=\\s*('+num+')')||pick('проекци[яю]\\s*('+num+')');
    projection(ah?'AH = '+cm(ah):'AH',ab?'AB = '+cm(ab):'AB',hb?'HB = '+cm(hb):'HB');
  }else if(/усеч[её]нн[^.]*конус/.test(p)){
    round('frustum');
  }else if(/сфер/.test(p)&&/кас/.test(p)&&/координат/.test(p)){
    name='касание плоскостей: сечение z = z₀';s.arrow(106,196,327,196);s.arrow(106,196,106,30);s.circle(185,117,79);s.dot(185,117);s.line(106,117,185,117,true);s.line(185,117,185,196,true);s.right(106,117,1,-1);s.right(185,196,1,-1);label('x',341,200);label('y',94,26);label('O',92,211);label('C',197,108);label('r',144,107);label('r',198,160);
  }else if(/шар|сфер/.test(p)&&!/вписан|описан|переплав|два шара|двух шар|тр[её]х.*шар|цилиндр|куб|полушар|полусфер|кас.*координат/.test(p)){
    const r=pick('радиус(?:а|ом)? (?:шара |сферы |равен )?('+num+')')||pick('R\\s*=\\s*('+num+')'),d=pick('расстоянии\\s*('+num+')')||pick('от центра на\\s*('+num+')'),h=pick('высот[аыоу]+\\s*(?:h\\s*=\\s*)?('+num+')')||pick('h\\s*=\\s*('+num+')');
    sphere(r?'R = '+cm(r):'R',d?'d = '+cm(d):'',/сегмент|шапк/.test(p)?h?'h = '+cm(h):'h':'',/сечен|рассеч|плоскост|отсеч/.test(p));
  }else if(/конус/.test(p)&&!/цилиндр|шар|сфер|полушар/.test(p)){
    const r=pick('радиус(?:а|ом)? (?:основания |конуса )?('+num+')')||pick('r\\s*=\\s*('+num+')'),h=pick('высот[аыу]\\s*('+num+')')||pick('h\\s*=\\s*('+num+')'),l=pick('образующ[аяую]+\\s*('+num+')')||pick('l\\s*=\\s*('+num+')');round('cone',/разв[её]ртк/.test(p)?'r':r?'r = '+cm(r):'r',h?'h = '+cm(h):'h','R',/разв[её]ртк/.test(p)&&r?'l = '+cm(r):l?'l = '+cm(l):'');
    if(/сечен|разрез|пересек/.test(p)){s.ellipse(188,115.5,39.5,11);name='конус и параллельное сечение';}
  }else if(/цилиндр/.test(p)&&!/шар|сфер|конус|призм|канал/.test(p)){
    const r=pick('радиус(?:а|ом)? (?:основания |цилиндра )?(?:равен )?('+num+')')||pick('r\\s*=\\s*('+num+')'),h=pick('высот[аыу]\\s*('+num+')')||pick('h\\s*=\\s*('+num+')');round('cylinder',r?'r = '+cm(r):'r',h?'h = '+cm(h):'h');
  }else if(/пирамид|тетраэдр/.test(p)&&!/усеч[её]нн|шар|призм/.test(p)){
    const h=pick('высот[аыу]\\s*('+num+')');pyramid('S осн.',h?'h = '+cm(h):'h',/треугольн|тетраэдр/.test(p)?3:/пятиугольн/.test(p)?5:/шестиугольн/.test(p)?6:4);
  }else if(/параллелепипед|куб|коробк|аквариум/.test(p)&&!/шар|сфер|пирамид/.test(p)){
    const dims=p.match(new RegExp('(?:р[её]бра|размеры|коробки|параллелепипеде) (?:[^.]*?равны )?('+num+')\\s*[,×]\\s*('+num+')\\s*(?:,|и|×)\\s*('+num+')','i')),a=pick('(?:ребр[ао]|ребром)\\s*('+num+')');
    const cube=/куб/.test(p);
    box(dims?cm(dims[1]):a?cm(a):'a',dims?cm(dims[2]):a?cm(a):cube?'a':'b',dims?cm(dims[3]):a?cm(a):cube?'a':'h',/пространственн.*диагонал/.test(p));if(cube)name='куб';if(/сечен|рассеч|отсек/.test(p)){s.poly([[67,106],[269,92],[332,128],[130,143]],true);name='куб и секущая плоскость';}
  }else if(/призм/.test(p)&&!/конус|цилиндр|шар/.test(p)){
    const h=pick('высот[аыу] (?:призмы )?('+num+')');prism('S осн.',h?'h = '+cm(h):'h',/треугольн/.test(p)?3:/пятиугольн/.test(p)?5:/шестиугольн/.test(p)?6:/восьмиугольн/.test(p)?8:4);
  }else if(/двугранн|плоскости пересекаются|плоскости перпендикулярн/.test(p)){
    name='двугранный угол';s.poly([[53,174],[271,174],[342,213],[124,213]],true);s.poly([[53,174],[271,174],[286,61],[68,61]]);s.line(53,174,271,174);s.dot(171,174);s.line(171,174,171,106);s.line(171,174,231,204);label('ребро',80,195);label('α',200,164);label('линейный угол',280,108);
  }else if(namedPoints.length>=2){
    const points=namedPoints.slice(0,2),values=points.map(m=>m.slice(2).map(v=>Number(v.replace('−','-').replace(',','.'))));reference=false;vectors(values[0],values[1],points.map(m=>m[1]),true);
  }else if(/координат|расстояние от|оси o|отраз|поверну|гомотети|центр.*\(/.test(p)){vectors();
  }else if(/полушар|полусфер/.test(p)&&!/цилиндр|конус/.test(p)){
    name='осевое сечение полушара';s.arc(190,159,83,0,Math.PI);s.line(107,159,273,159);s.dot(190,159);s.line(190,159,239,92);label('O',190,178);label('R',230,124);label(/без основания/.test(p)?'круг основания не включён':'круг основания',190,219);
  }else if(/шар|сфер/.test(p)&&/куб/.test(p)&&!/переплав/.test(p)){
    const outside=/около|описан/.test(p),cx=190,cy=122;
    name=outside?'диагональное сечение куба и сферы':'центральное сечение куба и шара';
    const w=outside?142:146,h=outside?100:146,r=outside?Math.hypot(w,h)/2:73;
    s.poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]);
    s.circle(cx,cy,r);s.dot(cx,cy);label('O',cx-12,cy+16);s.line(cx,cy,cx+r,cy);label('R',cx+r/2,cy-9);
    label(outside?'d основания':'a',cx,cy+h/2+22);label('a',outside?78:cx-w/2-19,cy);
  }else if(/канал/.test(p)&&/цилиндр/.test(p)){
    name='поперечное сечение канала';s.circle(168,119,79);s.circle(168,119,34);s.dot(168,119);s.line(168,119,247,119);s.line(168,119,168,85);
    label('R',226,110);label('r',155,92);s.line(301,52,301,185);s.line(294,52,308,52);s.line(294,185,308,185);label('h',320,123);label('кольцевое основание',168,224);
  }else if(/шар/.test(p)&&/просверл/.test(p)){
    name='осевое сечение шара с каналом';const cx=184,cy=121,r=83,cr=29,z=Math.sqrt(r*r-cr*cr);
    s.circle(cx,cy,r);s.line(cx-cr,cy-z,cx-cr,cy+z,true);s.line(cx+cr,cy-z,cx+cr,cy+z,true);s.line(cx,cy,cx+cr,cy);s.line(cx,cy,cx+67,cy-49);
    label('r',cx+14,cy+16);label('R',cx+100,cy-50,'start');s.line(302,cy-z,302,cy+z);s.line(295,cy-z,309,cy-z);s.line(295,cy+z,309,cy+z);label('h',322,126);
  }else if(/два шара/.test(p)&&/переплав/.test(p)){
    name='сохранение объёма при переплавке';s.circle(60,122,27);s.circle(145,122,38);s.circle(314,122,43);s.arrow(206,122,253,122);label('r₁',60,127);label('r₂',145,127);label('R',314,127);label('V₁ + V₂',103,196);label('V',314,196);
  }else if(/тр[её]х.*шар/.test(p)){
    name='касание шаров: центральное сечение';for(const x of [105,183,261]){s.circle(x,125,39);s.dot(x,125);s.line(x,125,x,86);label('r',x+12,106);}label('точки касания',183,207);s.dot(144,125);s.dot(222,125);
  }else if(/цилиндр/.test(p)&&/полушар|полусфер/.test(p)){
    name='осевое сечение цилиндра с полушаром';s.poly([[126,122],[254,122],[254,201],[126,201]]);s.arc(190,122,64,0,Math.PI);s.line(190,58,190,201,true);s.line(190,122,254,122);label('r',224,113);label('h',108,167);label('ось',207,219);
  }else if(/цилиндр/.test(p)&&/шар/.test(p)){
    if(/в шар.*вписан цилиндр/.test(p)){
      name='осевое сечение цилиндра в шаре';s.circle(190,120,89);const w=Math.sqrt(89*89-60*60);s.poly([[190-w,60],[190+w,60],[190+w,180],[190-w,180]]);s.line(190,120,190+w,60);s.dot(190,120);label('R',232,81);label('h',284,125);label('r',224,199);
    }else if(/два равных шара/.test(p)){
      name='осевое сечение цилиндра с двумя шарами';s.poly([[145,36],[233,36],[233,212],[145,212]]);s.circle(189,80,44);s.circle(189,168,44);s.line(189,36,189,212,true);label('r',258,81);label('h',123,126);
    }else{
      name='осевое сечение шара в цилиндре';s.poly([[111,43],[269,43],[269,201],[111,201]]);s.circle(190,122,79);s.line(190,43,190,201,true);s.line(190,122,269,122);label('r',234,112);label('h',93,126);
    }
  }else if(/конус/.test(p)&&/шар|сфер/.test(p)){
    if(/в шар вписан конус/.test(p)){
      name='осевое сечение конуса в шаре';s.circle(190,122,89);const halfBase=Math.sqrt(89*89-50*50);s.poly([[190,33],[190+halfBase,172],[190-halfBase,172]]);s.line(190,33,190,172,true);s.line(190,122,190+halfBase,172);label('R',249,137);label('h',172,100);label('r',225,191);
    }else{
      name='осевое сечение шара в конусе';const b=79,h=157,by=201,rad=b*h/(Math.hypot(b,h)+b);s.poly([[190,by-h],[190+b,by],[190-b,by]]);s.circle(190,by-rad,rad);s.line(190,by-h,190,by,true);label('h',158,92);label('R',201,by-rad-8);label('r основания',190,225);
    }
  }else if(/цилиндр/.test(p)&&/конус/.test(p)){
    if(/прикле|общее основание/.test(p)){
      name='осевое сечение составного тела';s.poly([[122,119],[258,119],[258,204],[122,204]]);s.poly([[122,119],[190,36],[258,119]]);s.line(190,36,190,204,true);label('r',224,113);label('h цилиндра',97,169);label('l конуса',271,77);
    }else if(/вписан/.test(p)){
      name='осевое сечение конуса в цилиндре';s.poly([[114,43],[266,43],[266,202],[114,202]]);
      if(/два конуса/.test(p)){s.poly([[114,43],[266,43],[190,122]]);s.poly([[114,202],[266,202],[190,122]]);}else s.poly([[114,202],[190,43],[266,202]]);
      s.line(190,43,190,202,true);label('h',94,129);label('r',227,224);
    }else{
      name='осевые сечения цилиндра и конуса';s.poly([[48,65],[140,65],[140,188],[48,188]]);s.poly([[240,188],[286,65],[332,188]]);s.line(94,65,94,188,true);s.line(286,65,286,188,true);label('h₁',33,127);label('h₂',354,127);label('r',118,210);label('r',310,210);
    }
  }else if(/цилиндр/.test(p)&&/призм/.test(p)){
    name='поперечное сечение оснований';const cx=169,cy=122,r=81,count=/треугольн/.test(p)?3:4;
    s.circle(cx,cy,r);s.poly(Array.from({length:count},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/count;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];}));s.dot(cx,cy);s.line(cx,cy,cx+r,cy);label('R',216,112);label('основание призмы',169,225);s.line(303,60,303,184);s.line(297,60,309,60);s.line(297,184,309,184);label('h',321,128);
  }else if(/усеч[её]нн/.test(p)&&/пирамид/.test(p)){
    name='усечённая пирамида';const sides=/пятиугольн/.test(p)?5:4;
    const base=Array.from({length:sides},(_,i)=>{const a=Math.PI/2+2*Math.PI*i/sides;return[190+96*Math.cos(a),181+25*Math.sin(a)];}),top=base.map(([x,y])=>[190+(x-190)*.48,62+(y-181)*.48]);
    for(let i=0;i<sides;i++){const a=base[i],b=base[(i+1)%sides],t=top[i],u=top[(i+1)%sides];s.line(...a,...b,(a[1]+b[1])/2<181);s.line(...t,...u);s.line(...a,...t,a[1]<165);}
    s.line(190,62,190,181,true);s.right(190,181);label('h',215,125);label('S₁',190,34);label('S₂',190,228);
  }else if(/выпукл[^ ]* многогранник/.test(p)){
    name='элементы многогранника (фрагмент)';s.poly([[75,128],[124,58],[205,77],[219,155],[141,188]],true);s.poly([[205,77],[285,57],[325,131],[219,155]]);s.line(141,188,218,216);s.line(219,155,218,216);s.line(325,131,352,181);s.dot(205,77);label('вершина',244,35);s.line(212,47,205,70);label('грань',143,128);label('ребро',275,158);label('V — вершины; E — рёбра; F — грани',198,236);
  }else if(/крыш/.test(p)){
    name='поперечное сечение крыши';s.poly([[72,188],[190,43],[308,188]]);s.line(190,43,190,188,true);s.right(190,188);label('h',207,115);label('полупролёт',249,213);label('α',277,178);label('скат',110,109);
  }else if(/прямоугольник.*вращают/.test(p)){
    name='вращение прямоугольника';s.poly([[128,63],[265,63],[265,194],[128,194]]);s.arrow(128,209,128,40);s.arrow(113,194,285,194);label('a',190,218);label('b',281,130);s.arc(128,121,24,-Math.PI/3,Math.PI/3);s.arc(196,194,24,Math.PI/6,5*Math.PI/6);label('две оси вращения',190,28);
  }else if(/квадрат.*спроецирован/.test(p)){
    name='ортогональная проекция квадрата';const top=[[83,34],[247,34],[304,146],[140,146]],bottom=[[83,154],[247,154],[304,206],[140,206]];s.poly(top);s.poly(bottom,true);for(let i=0;i<4;i++)s.line(...top[i],...bottom[i],true);label('S',180,81);label('S проекции',191,188);
  }else if(/квадрат.*лежит в плоскости/.test(p)){
    name='перпендикуляр к плоскости квадрата';const A=[105,165],B=[230,165],C=[288,199],D=[163,199],S=[105,43];s.poly([A,B,C,D],true);s.line(...S,...A,true);s.line(...S,...C);s.line(...A,...C,true);s.right(...A);for(const [t,[x,y]] of [['A',A],['B',B],['C',C],['D',D],['S',S]])label(t,x-9,y-9);label('SA',82,107);label('SC',222,116);
  }else if(/плоскост|проекци|нормаль/.test(p)){
    if(/параллельные плоскости/.test(p)){
      name='отрезок между параллельными плоскостями';s.poly([[67,55],[270,55],[325,91],[122,91]],true);s.poly([[67,153],[270,153],[325,189],[122,189]],true);s.line(143,70,143,172,true);s.line(143,70,277,172);s.line(143,172,277,172);s.right(143,172);label('A',132,58);label('B',292,182);label('h',117,123);label('α',245,160);
    }else if(/разные стороны/.test(p)&&/проекции совпадают/.test(p)){
      name='общая проекция двух точек';s.poly([[59,108],[270,108],[333,151],[122,151]],true);s.line(190,36,190,211);s.dot(190,36);s.dot(190,211);s.dot(190,128);label('A',209,37);label('H',209,128);label('B',209,214);label('h₁',164,81);label('h₂',164,175);
    }else if(/пересекает плоскость/.test(p)){
      name='отрезок и его проекция';s.poly([[45,107],[280,107],[346,149],[111,149]],true);s.line(112,43,280,206);s.line(112,43,112,128,true);s.line(280,206,280,128,true);s.line(112,128,280,128);label('A',98,35);label('B',296,215);label('h₁',89,84);label('h₂',304,175);label('проекция',190,151);
    }else if(/по одну сторону|один конец/.test(p)){
      name='высоты двух точек над плоскостью';s.poly([[45,164],[280,164],[344,208],[109,208]],true);s.line(108,72,108,185,true);s.line(270,42,270,185,true);s.dot(108,72);s.dot(270,42);label('A',95,60);label('B',285,37);label('h₁',85,130);label('h₂',299,114);if(/ломаной/.test(p)){s.line(108,72,194,185);s.line(194,185,270,42);label('M',194,206);}else s.line(108,72,270,42);
    }else{projection();name='отрезок, нормаль и проекция';}
  }else if(/a·b|a=|b=|коллинеар|a\+b/.test(p)){
    if(/середина/.test(p)){
      name='векторы к середине стороны';const A=[190,47],B=[82,190],C=[302,190],M=[192,190];s.arrow(...A,...B);s.arrow(...A,...C);s.line(...B,...C);s.line(...A,...M,true);label('A',190,34);label('B',69,204);label('C',315,204);label('M',192,209);label('a',118,109);label('b',264,110);
    }else if(/a\+b\+c/.test(p)){
      name='замкнутая сумма трёх векторов';s.arrow(83,181,281,181);s.arrow(281,181,184,52);s.arrow(184,52,83,181);label('a',180,205);label('b',263,110);label('c',109,109);
    }else if(/a·b\s*=\s*0/.test(p)){
      name='перпендикулярные векторы';s.arrow(119,183,119,48);s.arrow(119,183,299,183);s.right(119,183);label('a',105,42);label('b',313,190);
    }else vectors();
  }else return null;
  return s.figure(reference?'Опорная схема: '+name+' · не в масштабе':undefined);
}

