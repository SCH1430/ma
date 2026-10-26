// One vector model is used by the browser and the offline PDF renderer.
function geometrySketch(alt,width=400,height=240){
  const elements=[];
  const s={
    // Tag a construction without changing the vector API used by legacy figures.
    // More specific nested tags take precedence over their surrounding group.
    tag(role,draw){const from=elements.length;draw(s);for(let i=from;i<elements.length;i++)if(!elements[i].role)elements[i].role=role;return s;},
    line(x1,y1,x2,y2,dash=false){elements.push({type:'line',x1,y1,x2,y2,dash});},
    poly(points,fill=false){elements.push({type:'polygon',points,fill});},
    ellipse(x,y,rx,ry,fill=false){elements.push({type:'ellipse',x,y,rx,ry,fill});},
    circle(x,y,r,fill=false){s.ellipse(x,y,r,r,fill);},
    label(text,x,y,anchor='middle',size=14){elements.push({type:'text',text:String(text),x,y,anchor,size});},
    dot(x,y){s.circle(x,y,2.5,true);},
    right(x,y,dx=1,dy=-1,size=10){s.line(x+size*dx,y,x+size*dx,y+size*dy);s.line(x+size*dx,y+size*dy,x,y+size*dy);},
    arrow(x1,y1,x2,y2){const a=Math.atan2(y2-y1,x2-x1);s.line(x1,y1,x2,y2);s.line(x2,y2,x2-7*Math.cos(a-.42),y2-7*Math.sin(a-.42));s.line(x2,y2,x2-7*Math.cos(a+.42),y2-7*Math.sin(a+.42));},
    arc(x,y,r,start,end){const steps=Math.max(6,Math.ceil(Math.abs(end-start)*12));for(let i=0;i<steps;i++){const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;s.line(x+r*Math.cos(a),y-r*Math.sin(a),x+r*Math.cos(b),y-r*Math.sin(b));}},
    figure(caption='Схема к условию · не в масштабе'){return {width,height,alt,caption,elements};}
  };
  return s;
}

// One scale for both axes preserves angles, perpendicularity and side ratios.
function geometryFit(points,box={left:76,top:53,right:324,bottom:187}){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const spanX=maxX-minX,spanY=maxY-minY,scale=Math.min((box.right-box.left)/Math.max(spanX,1e-10),(box.bottom-box.top)/Math.max(spanY,1e-10));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,bx=(box.left+box.right)/2,by=(box.top+box.bottom)/2;
  return {scale,point:p=>[bx+(p[0]-cx)*scale,by+(p[1]-cy)*scale],points:points.map(p=>[bx+(p[0]-cx)*scale,by+(p[1]-cy)*scale])};
}

// World coordinates use screen orientation (positive y points down).
function geometryTriangleSSS(AB,BC,CA){
  if(!(AB>0&&BC>0&&CA>0&&AB+BC>CA&&AB+CA>BC&&BC+CA>AB))return null;
  const x=(AB*AB+BC*BC-CA*CA)/(2*BC),height=Math.sqrt(Math.max(0,AB*AB-x*x));
  return {A:[x,-height],B:[0,0],C:[BC,0]};
}
function geometryTriangleAngles(B,C,BC=1){
  const toRad=Math.PI/180,b=B*toRad,c=C*toRad;
  if(!(B>0&&C>0&&B+C<180))return null;
  const AB=BC*Math.sin(c)/Math.sin(Math.PI-b-c);
  return {A:[AB*Math.cos(b),-AB*Math.sin(b)],B:[0,0],C:[BC,0]};
}
