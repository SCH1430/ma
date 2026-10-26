// Independently measure rendered vectors, rather than accepting their labels.
module.exports=function(context,bank,test){
  const tasks=new Map(bank.flatMap(topic=>topic.tasks.map(q=>[q.id,{q,topic}])));
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const angle=(a,o,b)=>{const u=[a[0]-o[0],a[1]-o[1]],v=[b[0]-o[0],b[1]-o[1]];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;};
  const dot=(a,b,c,d)=>(b[0]-a[0])*(d[0]-c[0])+(b[1]-a[1])*(d[1]-c[1]);
  const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(a),Math.abs(b));
  const role=(e,name)=>String(e.role||'').split(/\s+/).includes(name);
  const rendered=(q,topic)=>context.planarTaskFigure(q,topic);
  const area=(A,B,C)=>Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
  const measureTriangle=(f,id)=>{
    const V=f.geometry?.vertices,outline=f.elements.find(e=>e.type==='polygon'&&role(e,'shape:ABC'));
    test(!!V&&!!outline,id+' metric triangle has a rendered outline and named vertices');
    if(!V||!outline)return null;
    test(['A','B','C'].every((name,i)=>close(distance(V[name],outline.points[i]),0)),id+' metadata equals the actual SVG/PDF polygon');
    for(const edge of ['AB','BC','CA'])test(f.elements.some(e=>e.type==='line'&&role(e,'side:'+edge)&&close(distance([e.x1,e.y1],V[edge[0]]),0)&&close(distance([e.x2,e.y2],V[edge[1]]),0)),id+' '+edge+' side role points to the rendered side');
    return V;
  };
  let measured=0;
  for(const topic of bank)for(const q of topic.tasks){
    if(topic.grade>9||!/геометри/i.test(topic.subject))continue;
    const g=q.generation;if(!g)continue;
    const f=rendered(q,topic),n=g.parameter,form=g.form,id=q.id;
    if(!f?.geometry)continue;measured++;
    test(Array.isArray(f.stages)&&f.stages.length===2&&f.stages[0].showAuxiliary===false&&f.stages[1].showAuxiliary===true,id+' two hint stages preserve the task before auxiliary construction');
    const V=f.geometry.vertices;
    if(g.model==='angles'){
      const d=2*(n%60+1),expected=form===0?21+n%120:(180-d)/2;
      test(close(angle(V.B,V.O,V.C),expected),id+' ray positions match the given or constrained adjacent angle');
      test(close(angle(V.A,V.O,V.C)+angle(V.C,V.O,V.B),180),id+' actual adjacent angles form a straight angle');
      if(form===1)test(close(angle(V.A,V.O,V.C)-angle(V.C,V.O,V.B),d),id+' adjacent angles have the stated difference');
    }
    if(['triangle','pythagoras','cosine_rule'].includes(g.model)){
      const T=measureTriangle(f,id);if(!T)continue;
      if(g.model==='triangle'){
        if(form===0){test(close(angle(T.A,T.B,T.C),26+n%49),id+' actual angle B matches given degrees');test(close(angle(T.A,T.C,T.B),37+n%31),id+' actual angle C matches given degrees');}
        else{test(close(angle(T.B,T.A,T.C),2*(n%65+10)),id+' actual vertex angle matches isosceles givens');test(close(distance(T.A,T.B),distance(T.A,T.C)),id+' equal side marks correspond to equal lengths');}
      }
      if(g.model==='pythagoras'){
        test(close(dot(T.B,T.A,T.B,T.C),0),id+' legs are perpendicular by dot product');
        test(close(distance(T.A,T.B)/distance(T.B,T.C),form===0?3/4:5/12),id+' actual legs have the ratio from the condition');
        test(close(distance(T.A,T.C)**2,distance(T.A,T.B)**2+distance(T.B,T.C)**2),id+' actual triangle obeys Pythagoras');
      }
      if(g.model==='cosine_rule'){
        const AB=n%9+2,BC=n+3,theta=form===0?60:120,scale=distance(T.B,T.C)/BC;
        test(close(angle(T.A,T.B,T.C),theta),id+' actual included angle matches the condition');
        test(close(distance(T.A,T.B)/distance(T.B,T.C),AB/BC),id+' given side ratio is preserved');
        test(close((distance(T.A,T.C)/scale)**2,AB*AB+BC*BC-2*AB*BC*Math.cos(theta*Math.PI/180)),id+' measured third side satisfies the cosine theorem');
      }
    }
    if(g.model==='perimeter'||g.model==='rectangle'){
      const a=g.model==='perimeter'?n+7:n+9,b=g.model==='perimeter'?n%9+3:n%8+4;
      test(close(distance(V.A,V.B)/distance(V.A,V.D),a/b),id+' rectangle dimensions use one scale');
      test(close(dot(V.A,V.B,V.A,V.D),0),id+' rectangle sides are perpendicular');
      if(g.model==='rectangle'&&form===1)test(close(distance(V.E,V.F)/distance(V.A,V.B),(n%3+1)/a),id+' square cut has the stated size relative to the sheet');
      if(g.model==='perimeter'&&form===1)test(close(distance(V.B,V.E)/distance(V.A,V.B),(n%4+2)/a),id+' extension has the stated size relative to the original length');
    }
    if(g.model==='trapezoid'){
      test(close(distance(V.A,V.B)/distance(V.C,V.D),(n+5)/(n+11)),id+' trapezoid base ratio matches givens');
      test(close(distance(V.A,V.H)/distance(V.A,V.B),(n%8+3)/(n+5)),id+' trapezoid height uses the same scale as bases');
      test(close(dot(V.A,V.H,V.D,V.C),0),id+' height is perpendicular to bases');
    }
    if(g.model==='box'){
      test(f.geometry.projection==='isometric',id+' solid explicitly identifies its projection');
      test(close(distance(V.A,V.B)/distance(V.B,V.C),(n+4)/(n%6+3)),id+' projected edges retain the length/width ratio');
      test(close(distance(V.C,V.C1)/distance(V.A,V.B),(n%5+2)/(n+4)),id+' projected vertical edge retains the height/length ratio');
    }
    if(g.model==='similarity'){
      test(close(distance(V.B1,V.C1)/distance(V.B,V.C),1.5),id+' exact similarity coefficient is 3/2');
      test(close(angle(V.A,V.B,V.C),angle(V.A1,V.B1,V.C1)),id+' corresponding angles match');
      test(close(area(V.A1,V.B1,V.C1)/area(V.A,V.B,V.C),2.25),id+' actual areas have the square of the similarity coefficient');
      if(form===0){const scale=distance(V.B,V.C)/(2*(n+4));test(close(area(V.A,V.B,V.C)/(scale*scale),4*(n%7+2)),id+' known side and known area are simultaneously respected');}
    }
    if(g.model==='inscribed_angle'){
      const O=f.geometry.center,r=f.geometry.radius;test(Object.values(V).every(v=>close(distance(v,O),r)),id+' all cyclic vertices lie exactly on the circumference');
      if(form===0)test(close(angle(V.A,V.C,V.B),(20+n%140)/2),id+' inscribed angle measures half the stated arc');
      else{test(close(angle(V.B,V.A,V.D),20+n%140),id+' given cyclic quadrilateral angle is geometrically correct');test(close(angle(V.B,V.A,V.D)+angle(V.B,V.C,V.D),180),id+' opposite cyclic angles are supplementary');}
    }
    if(g.model==='sector'){
      test(close(angle(V.A,V.O,V.B),30*(n%5+1)),id+' actual sector angle equals its label');
      test(close(distance(V.A,V.O),distance(V.B,V.O)),id+' bounding radii are equal');
    }
  }
  test(measured>500,'metric verification covers the generated plane geometry bank');
  for(const [id,expected] of [['7-07-8001',{A:115,B:27,C:38}],['7-07-3',{A:36,B:72,C:72}],['7-216-6',{A:28,B:62,C:90}]]){
    const entry=tasks.get(id);if(!entry){test(false,id+' accuracy fixture exists');continue;}const f=rendered(entry.q,entry.topic),T=f?.geometry?.vertices;
    test(!!T,id+' source condition uses a metric construction');if(!T)continue;
    for(const name of ['A','B','C']){const other=['A','B','C'].filter(x=>x!==name);test(close(angle(T[other[0]],T[name],T[other[1]]),expected[name]),id+' regression: actual '+name+' angle equals '+expected[name]+' degrees');}
    if(id==='7-07-8001')test(!f.elements.some(e=>e.type==='text'&&/115/.test(e.text)),id+' computed unknown angle is not printed');
    if(id==='7-07-3'){
      test(!!T.D&&close(angle(T.A,T.C,T.D),angle(T.D,T.C,T.B)),id+' CD actually bisects angle C');
      test(f.elements.some(e=>e.auxiliary===true&&role(e,'bisector')),id+' additional bisector is explicitly hidden until the second hint stage');
    }
  }
};

if(require.main===module){
  const vm=require('node:vm'),page=require('./load_page.cjs').loadPage(),{BANK}=page.dataValues(),context=vm.createContext({BANK});
  vm.runInContext(page.figuresCode(),context);let checks=0;const errors=[];
  module.exports(context,BANK,(ok,label)=>{checks++;if(!ok)errors.push(label);});
  console.log(JSON.stringify({checks,errors},null,2));if(errors.length)process.exitCode=1;
}
