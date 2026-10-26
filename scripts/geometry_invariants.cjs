// Mathematical checks for sketches whose topology matters to the condition.
// Distances are relative to the drawing's own scale; no screen coordinates are fixed.
module.exports=function(context,bank,test){
  const tasks=new Map(bank.flatMap(topic=>topic.tasks.map(task=>[task.id,{task,topic}])));
  const figure=id=>{
    if(typeof context.geometryFigure==='function')return context.geometryFigure(id);
    const entry=tasks.get(id);
    return entry?context.planarTaskFigure(entry.task,entry.topic):null;
  };
  const point=(x,y)=>[x,y];
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const near=(a,b,scale=1)=>Math.abs(a-b)<=Math.max(1,Math.abs(scale))*1e-5;
  const circleCentre=c=>point(c.x,c.y);
  const circles=f=>(f?.elements||[]).filter(e=>e.type==='ellipse'&&near(e.rx,e.ry,e.rx)).sort((a,b)=>b.rx-a.rx);
  const lines=f=>(f?.elements||[]).filter(e=>e.type==='line');
  const polygons=f=>(f?.elements||[]).filter(e=>e.type==='polygon');
  const label=(f,text)=>(f?.elements||[]).find(e=>e.type==='text'&&e.text===text);
  const ends=line=>[point(line.x1,line.y1),point(line.x2,line.y2)];
  const closest=(points,text)=>points.reduce((best,p)=>!best||distance(p,point(text.x,text.y))<distance(best,point(text.x,text.y))?p:best,null);
  const onCircle=(p,c)=>near(distance(p,circleCentre(c)),c.rx,c.rx);
  const check=(id,description,predicate)=>{
    const f=figure(id);
    test(!!f&&predicate(f),id+' '+description);
  };

  for(const id of ['8-11-2','8-224-2'])check(id,'AB is a diameter and C lies on the circle',f=>{
    const c=circles(f)[0],vertices=polygons(f).flatMap(p=>p.points),A=label(f,'A'),B=label(f,'B'),C=label(f,'C');
    if(!c||!vertices.length||!A||!B||!C)return false;
    const a=closest(vertices,A),b=closest(vertices,B),v=closest(vertices,C),mid=point((a[0]+b[0])/2,(a[1]+b[1])/2);
    return onCircle(a,c)&&onCircle(b,c)&&onCircle(v,c)&&near(distance(mid,circleCentre(c)),0,c.rx)&&near(distance(a,b),2*c.rx,c.rx);
  });

  for(const id of ['8-224-19','7-218-11'])check(id,'two circles touch externally',f=>{
    const [a,b]=circles(f);
    return !!a&&!!b&&near(distance(circleCentre(a),circleCentre(b)),a.rx+b.rx,a.rx+b.rx);
  });
  check('8-224-20','two circles touch internally',f=>{
    const [a,b]=circles(f);
    return !!a&&!!b&&near(distance(circleCentre(a),circleCentre(b)),Math.abs(a.rx-b.rx),a.rx+b.rx);
  });

  // Recover unit cells from the occupied region. This works for separate square
  // polygons and for a single outline, so changing the rendering style is harmless.
  function occupiedCells(f){
    const ps=polygons(f).map(p=>p.points);
    if(!ps.length)return null;
    const segments=ps.flatMap(points=>points.map((a,i)=>[a,points[(i+1)%points.length]]));
    if(segments.some(([a,b])=>!near(a[0],b[0])&&!near(a[1],b[1])))return null;
    const lengths=segments.map(([a,b])=>distance(a,b)).filter(n=>n>1e-8),step=Math.min(...lengths);
    const xs=ps.flatMap(p=>p.map(v=>v[0])),ys=ps.flatMap(p=>p.map(v=>v[1]));
    const left=Math.min(...xs),top=Math.min(...ys),cols=(Math.max(...xs)-left)/step,rows=(Math.max(...ys)-top)/step;
    if(!near(cols,Math.round(cols))||!near(rows,Math.round(rows))||cols*rows>100)return null;
    const inside=(x,y,points)=>{
      let result=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;
      }
      return result;
    };
    const cells=new Set();
    for(let y=0;y<Math.round(rows);y++)for(let x=0;x<Math.round(cols);x++){
      if(ps.some(p=>inside(left+(x+.5)*step,top+(y+.5)*step,p)))cells.add(x+','+y);
    }
    return [...cells].map(key=>{
      const [x,y]=key.split(',').map(Number);
      return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(p=>cells.has(p.join(','))).length;
    }).sort((a,b)=>a-b);
  }
  check('5-220-8','four unit squares form a T',f=>JSON.stringify(occupiedCells(f))===JSON.stringify([1,1,1,3]));
  check('6-240-11','five unit squares form a cross',f=>JSON.stringify(occupiedCells(f))===JSON.stringify([1,1,1,1,4]));
  check('6-218-12','squares of sides 2, 3 and 4 share a baseline and touch consecutively',f=>{
    const ps=polygons(f).map(p=>p.points);
    if(ps.length!==3)return false;
    const boxes=ps.map(points=>{
      const xs=points.map(v=>v[0]),ys=points.map(v=>v[1]);
      return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
    }).sort((a,b)=>a.left-b.left);
    const widths=boxes.map(b=>b.right-b.left).sort((a,b)=>a-b),scale=widths[0]/2;
    return scale>0&&widths.every((width,i)=>near(width,(i+2)*scale,scale))&&boxes.every(b=>near(b.right-b.left,b.bottom-b.top,scale)&&near(b.bottom,boxes[0].bottom,scale))&&near(boxes[0].right,boxes[1].left,scale)&&near(boxes[1].right,boxes[2].left,scale);
  });

  for(const id of ['9-223-13','9-223-14'])check(id,'unknown side count is not replaced by a complete regular polygon',f=>{
    const c=circles(f)[0];
    if(!c)return false;
    const fabricated=polygons(f).some(p=>p.points.length>=3&&p.points.every(v=>onCircle(v,c))&&p.points.every((v,i)=>near(distance(v,p.points[(i+1)%p.points.length]),distance(p.points[0],p.points[1]),c.rx)));
    const radii=lines(f).filter(line=>{
      const [a,b]=ends(line);
      return near(distance(a,circleCentre(c)),0,c.rx)&&onCircle(b,c)||near(distance(b,circleCentre(c)),0,c.rx)&&onCircle(a,c);
    });
    return !fabricated&&radii.length>=2;
  });

  check('11-218-8','radius of the cone net is its generatrix, not the base radius',f=>{
    const texts=f.elements.filter(e=>e.type==='text').map(e=>e.text);
    return texts.some(t=>/^l\s*=\s*10\b/.test(t))&&!texts.some(t=>/^r\s*=\s*10\b/.test(t));
  });
  check('11-319-9','sphere in a cone touches all sides of its axial triangle',f=>{
    const c=circles(f)[0],tri=polygons(f).find(p=>p.points.length===3);
    if(!c||!tri)return false;
    return tri.points.every((a,i)=>{
      const b=tri.points[(i+1)%3],d=Math.abs((b[0]-a[0])*(c.y-a[1])-(b[1]-a[1])*(c.x-a[0]))/distance(a,b);
      return near(d,c.rx,c.rx);
    });
  });
  for(const id of ['11-227-1','11-318-7'])check(id,'a hemisphere is shown as a semicircle, not a full sphere',f=>{
    if(circles(f).some(c=>c.rx>10))return false;
    const ls=lines(f),diameter=ls.filter(l=>near(l.y1,l.y2)).sort((a,b)=>Math.abs(b.x2-b.x1)-Math.abs(a.x2-a.x1))[0];
    if(!diameter)return false;
    const points=ls.flatMap(ends),radius=Math.abs(diameter.x2-diameter.x1)/2;
    return radius>10&&points.every(p=>p[1]<=diameter.y1+1e-5)&&near(diameter.y1-Math.min(...points.map(p=>p[1])),radius,radius);
  });

  for(const id of ['9-223-2','9-223-3','9-223-8'])check(id,'PT is tangent and P also lies on the secant',f=>{
    const c=circles(f)[0],P=label(f,'P'),T=label(f,'T'),ls=lines(f).filter(line=>!line.dash);
    if(!c||!P||!ls.length)return false;
    const endpoints=ls.flatMap(ends),p=closest(endpoints,P),centre=circleCentre(c);
    const t=T?closest(endpoints,T):endpoints.find(v=>onCircle(v,c)&&near((v[0]-c.x)*(p[0]-v[0])+(v[1]-c.y)*(p[1]-v[1]),0,c.rx*distance(p,v)));
    if(!t)return false;
    if(!onCircle(t,c)||distance(p,centre)<=c.rx)return false;
    const radius=[t[0]-c.x,t[1]-c.y],direction=[p[0]-t[0],p[1]-t[1]];
    if(!near(radius[0]*direction[0]+radius[1]*direction[1],0,c.rx*distance(p,t)))return false;
    return ls.some(line=>{
      const [a,b]=ends(line),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(!length||!near(distance(a,p),0,c.rx)&&!near(distance(b,p),0,c.rx))return false;
      const projection=((centre[0]-a[0])*dx+(centre[1]-a[1])*dy)/length;
      const offset=Math.abs((centre[0]-a[0])*dy-(centre[1]-a[1])*dx)/length;
      if(offset>=c.rx-1e-5*c.rx)return false;
      const half=Math.sqrt(c.rx*c.rx-offset*offset);
      return projection-half>=-1e-5*c.rx&&projection+half<=length+1e-5*c.rx;
    });
  });
};
