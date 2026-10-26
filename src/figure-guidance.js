// Educational annotations are derived from the drawing and its givens, never from an answer.
function guideGeometryFigure(q,topic,original){
  if(!original)return null;
  const geo=/геометри/i.test(topic?.subject||'');
  const f={...original,elements:original.elements.map(p=>({...p}))};
  if(!geo)return f;
  const roles=p=>String(p.role||'').split(/\s+/).filter(Boolean);
  for(const p of f.elements){
    if(p.role)continue;
    if(p.type==='text'){
      const t=String(p.text).trim();
      p.role=/[?]/.test(t)?'unknown':/°|^[αβγ]$/.test(t)?'angle':/^(?:h|AH|SH|OH)\b/i.test(t)?'height':/^[Rr](?:\s|\s*=|$)/.test(t)?'radius':/^S(?:\s|\s*=|₁|₂|$)/.test(t)?'area':/^[A-ZА-ЯO](?:[₀-₉′])?$/.test(t)?'vertex':/[0-9]/.test(t)?'given':'label';
      if(/[0-9]/.test(t)&&!t.includes('?')&&!p.role.includes('given'))p.role+=' given';
    }else p.role=p.type==='polygon'?'figure':'outline';
  }
  const has=role=>f.elements.some(p=>roles(p).some(r=>r===role||r.startsWith(role+':')));
  if(!f.stages?.length){
    const text=String(q.prompt).toLowerCase();
    const relation=/спроецирован|площадь проекции/.test(text)?'Найдите угол между плоскостями. Площадь ортогональной проекции равна площади фигуры, умноженной на косинус этого угла.':/катет|гипотенуз|наклонн|проекци|диагонал|сечен|рассеч/.test(text)?'Найдите прямоугольный треугольник на рисунке. Сопоставьте его стороны с известными отрезками; вспомогательные линии показаны отдельно.':/подобн/.test(text)?'Сопоставьте соответствующие стороны. Для площадей используйте квадрат коэффициента подобия, для объёмов — куб.':/объ[её]м/.test(text)?'Выделите основание и перпендикулярную ему высоту. Выберите формулу объёма именно этого тела.':/сектор|дуг|окружност|круг/.test(text)?'Сопоставьте радиус, дугу и отмеченные углы. Уточните, является угол центральным или вписанным.':/уг[ло]|биссектрис/.test(text)?'Найдите связанные углы: смежные, вертикальные или углы одного треугольника. Используйте их свойства.':'Сопоставьте выделенные элементы с условием и запишите связывающее их равенство.';
    f.stages=[
      {title:'Данные на чертеже',description:'Сначала сопоставьте известные величины с подписями. Искомая величина отмечена знаком вопроса или названа в условии.',highlight:['given','angle','area'],showAuxiliary:false},
      {title:'Связь между величинами',description:relation,highlight:['height','radius','projection','diagonal','side','auxiliary'],showAuxiliary:true}
    ];
    // A static outline has no inferred geometric relationships: highlight only actual labels.
    if(!f.stages[1].highlight.some(has))f.stages[1].highlight=['given','angle','area','unknown'];
  }
  if(Number(topic.grade)>=10&&!f.section&&!f.views?.section)f.section=geometrySectionFigure(q,topic,f);
  if(f.section){f.section={...f.section,elements:f.section.elements.map(p=>({...p}))};for(const p of f.section.elements)if(!p.role)p.role=p.type==='text'?/[0-9]/.test(p.text)?'given':/^[rR]$/.test(p.text)?'radius':/^h$/.test(p.text)?'height':'label':'outline';f.section.stages=f.stages;}
  return f;
}
function geometrySectionFigure(q,topic,f){
  const p=String(q.prompt).toLowerCase(),g=q.generation||{},n=g.parameter,form=g.form;
  if(/осевое сечение|центральное сечение|диагональное сечение|поперечное сечение/.test(f.caption||''))return null;
  const s=geometrySketch('',400,260),labels=[],line=(role,...args)=>{const before=s.figure().elements.length;s.line(...args);for(const e of s.figure().elements.slice(before))e.role=role;};
  const point=(x,y,name,dx=0,dy=0)=>{s.dot(x,y);if(name)s.label(name,x+dx,y+dy);};
  const fit=(points)=>{
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(240/Math.max(1,maxX-minX),160/Math.max(1,maxY-minY));
    return points.map(([x,y])=>[200+(x-(minX+maxX)/2)*scale,123+(y-(minY+maxY)/2)*scale]);
  };
  const number='[−-]?\\d+(?:[.,]\\d+)?',pick=pattern=>{const m=p.match(new RegExp(pattern,'i'));return m?Number(m[1].replace('−','-').replace(',','.')):null;};
  const make=(alt,caption)=>{const out=s.figure(caption);out.alt=alt;out.sectionOnly=true;return out;};
  function axial(kind,r,h,R=r,side=''){
    const rr=Number(r)||3,hh=Number(h)||4,RR=Number(R)||rr;
    const world=kind==='cone'?[[-RR,0],[0,-hh],[RR,0]]:kind==='frustum'?[[-RR,0],[-rr,-hh],[rr,-hh],[RR,0]]:[[-rr,0],[-rr,-hh],[rr,-hh],[rr,0]];
    const pts=fit(world);s.poly(pts,true);const top=Math.min(...pts.map(p=>p[1])),bottom=Math.max(...pts.map(p=>p[1])),left=Math.min(...pts.map(p=>p[0])),right=Math.max(...pts.map(p=>p[0]));
    line('height',200,top,200,bottom,true);s.right(200,bottom);
    line('radius',200,bottom,right,bottom);s.label(h!=null?'h = '+h:'h',left-18,(top+bottom)/2,'end',13);s.label(r!=null&&kind!=='frustum'?'r = '+r:kind==='frustum'?(R!=null?'R = '+R:'R'):'r',200+(right-200)/2,bottom+23,'middle',13);
    if(kind==='frustum'){line('radius',200,top,pts[2][0],top);s.label(r!=null?'r = '+r:'r',200,top-12,'middle',13);}
    if(side)s.label(side,right+18,(top+bottom)/2,'start',13);
    point(200,bottom,'O',-12,17);
    return make('Осевое сечение: высота h перпендикулярна основанию; r и R обозначают радиусы.','Осевое сечение · '+(r!=null&&h!=null?'пропорции по данным':'опорная схема'));
  }
  if(g.model==='spatial_distance'){
    const k=n+2,a=form===0?4*k:Math.hypot(2*k,3*k),h=form===0?3*k:6*k;
    const [A,H,B]=fit([[0,-h],[0,0],[a,0]]);s.poly([A,H,B],true);line('height',...A,...H);line('projection',...H,...B);s.right(...H);
    point(...A,'A',-10,-10);point(...H,'H',-12,18);point(...B,'B',13,18);s.label(form===0?'AH = '+3*k:'h = '+6*k,H[0]-14,(A[1]+H[1])/2,'end',13);s.label(form===0?'HB = ?':'d основания',(H[0]+B[0])/2,H[1]+23,'middle',13);s.label(form===0?'AB = '+5*k:'d = ?',(A[0]+B[0])/2+28,(A[1]+B[1])/2-10,'start',13);
    return make('Плоский прямоугольный треугольник AHB: AH — высота, HB — проекция, AB — наклонная.','Метрический треугольник сечения · пропорции по данным');
  }
  if(g.model==='cylinder')return axial('cylinder',n+2,n%9+3);
  if(g.model==='frustum'){
    const r=n+2,R=r+n%5+1,l=R+r+n+1,h=form===0?3*(n%7+1):Math.sqrt(l*l-(R-r)*(R-r));
    const out=axial('frustum',r,h,R,form===1?'l = '+l:'');if(form===1)for(const e of out.elements)if(e.type==='text'&&/^h =/.test(e.text))e.text='h';return out;
  }
  if(g.model==='sphere'||g.model==='sphere_section'||(/шар|сфер/.test(p)&&!/куб|конус|цилиндр|кас|полушар|полусфер|переплав/.test(p))){
    const R=g.model==='sphere'?n+2:g.model==='sphere_section'?form===0?5*(n+2):n+4:pick('радиус(?:а|ом)? (?:шара |сферы |равен )?('+number+')')||pick('r\\s*=\\s*('+number+')');
    const d=g.model==='sphere_section'?form===0?3*(n+2):R-(n%5+1):pick('расстоянии\\s*('+number+')');
    const radius=85,cy=126,scale=R?radius/R:1;s.circle(190,cy,radius);point(190,cy,'O',-12,19);
    if(d!=null&&R&&Math.abs(d)<R){const y=cy-d*scale,x=Math.sqrt(R*R-d*d)*scale;line('radius',190,cy,190+x,y);line('height',190,cy,190,y,true);line('radius',190-x,y,190+x,y);s.right(190,y,1,1);s.label('r',190+x/2,y-10);s.label('d',175,(cy+y)/2,'end');s.label('R = '+R,290,143,'start',13);}
    else{line('radius',190,cy,275,cy);s.label(R?'R = '+R:'R',232,cy-12,'middle',13);}
    return make('Центральное сечение шара: радиус шара R, расстояние до секущей d и радиус сечения r.','Центральное сечение · '+(R?'пропорции по данным':'опорная схема'));
  }
  if(g.model==='solid_volume'){const out=axial(form===0?'cylinder':'cone',null,n%9+3);for(const e of out.elements)if(e.type==='text'){if(e.text==='r')e.text='отрезок основания';if(e.text==='O')e.text='H';}out.alt='Вертикальное сечение тела: h — перпендикулярная основанию высота.';out.caption='Опорное вертикальное сечение '+(form===0?'призмы':'пирамиды');return out;}
  if(/конус/.test(p)&&!/шар|сфер|цилиндр|разв[её]ртк/.test(p)){
    if(/усеч/.test(p)){
      const raw=String(q.prompt),rMatch=raw.match(/\br\s*=\s*(\d+(?:[.,]\d+)?)/),RMatch=raw.match(/\bR\s*=\s*(\d+(?:[.,]\d+)?)/),pair=p.match(/радиус[а-яё]* основани[яй][^\d]*(\d+(?:[.,]\d+)?)\s*(?:см)?\s*и\s*(\d+(?:[.,]\d+)?)/);
      const radii=pair?pair.slice(1).map(x=>Number(x.replace(',','.'))):[],r=rMatch?Number(rMatch[1].replace(',','.')):radii.length?Math.min(...radii):null,R=RMatch?Number(RMatch[1].replace(',','.')):radii.length?Math.max(...radii):null;
      const h=pick('(?:высот[аыу]\\s*|h\\s*=\\s*)('+number+')'),l=pick('(?:образующ[аяую]+\\s*|l\\s*=\\s*)('+number+')');
      const derived=h==null&&r!=null&&R!=null&&l!=null&&l>Math.abs(R-r)?Math.sqrt(l*l-(R-r)*(R-r)):null;
      const out=axial('frustum',r,h??derived,R,l!=null?'l = '+l:'');if(derived!=null)for(const e of out.elements)if(e.type==='text'&&/^h =/.test(e.text))e.text='h';return out;
    }
    return axial('cone',pick('(?:радиус(?:а)? (?:основания |конуса )?|r\\s*=\\s*)('+number+')'),pick('(?:высот[аыу]\\s*|h\\s*=\\s*)('+number+')'));
  }
  if(/цилиндр/.test(p)&&!/шар|сфер|конус|канал|призм/.test(p))return axial('cylinder',pick('(?:радиус(?:а)? (?:основания |цилиндра )?|r\\s*=\\s*)('+number+')'),pick('(?:высот[аыу]\\s*|h\\s*=\\s*)('+number+')'));
  if(/спроецирован|площадь проекции/.test(p)){
    const angle=pick('под углом\\s*('+number+')')||60,alpha=angle*Math.PI/180,pts=fit([[0,0],[Math.cos(alpha),-Math.sin(alpha)],[Math.cos(alpha),0]]),[O,A,H]=pts;
    line('plane:source',...O,...A);line('plane:projection',O[0]-35,O[1],H[0]+40,H[1]);line('height',...A,...H,true);s.right(...H,-1,-1);s.arc(O[0],O[1],26,0,alpha);
    s.label('α = '+angle+'°',O[0]+47,O[1]-17,'middle',13);s.label('исходная плоскость',200,26,'middle',13);s.label('плоскость проекции',213,230,'middle',13);s.label('S проекции = S · cos α',200,252,'middle',13);
    return make('Сечение перпендикулярно ребру пересечения плоскостей. Линейный угол α равен углу между плоскостями; площади связаны косинусом α.','Линейный угол между плоскостями');
  }
  if(/наклонн|проекци|перпендикуляр.*плоскост/.test(p)){
    const pts=[[111,48],[111,205],[309,205]];s.poly(pts,true);s.right(111,205);s.label('A',101,36);s.label('H',98,225);s.label('B',322,225);s.label('AH',88,131);s.label('HB',210,230);s.label('AB',224,115);return make('Треугольник AHB: AH — перпендикуляр к плоскости, HB — проекция AB.','Опорный метрический треугольник');
  }
  return null;
}
