// Offline PDF creation: all layout, fonts and tasks remain in the current tab.
async function createMathPDF({tasks,title,variant,grade,level='basic',answers}) {
  const {PDFDocument,rgb}=PDFLib;
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes=Uint8Array.from(atob(FONT_BASE64),c=>c.charCodeAt(0));
  const font=await doc.embedFont(fontBytes,{subset:true});
  const ink=rgb(.13,.2,.15),muted=rgb(.32,.39,.31),line=rgb(.79,.83,.77),shade=rgb(227/255,237/255,218/255);
  doc.setTitle(title||'Самостоятельная работа');doc.setAuthor('Математическое пространство 1430');
  doc.setSubject(`Математика, ${grade} класс. Авторские задания по темам ФРП.`);
  const pages=[];
  const wrap=(text,size,width)=>{
    const lines=[];let lineText='';
    for(const word of String(text).replace(/[–—−]/g,'-').split(/\s+/)){
      const candidate=lineText?`${lineText} ${word}`:word;
      if(font.widthOfTextAtSize(candidate,size)<=width){lineText=candidate;continue;}
      if(lineText)lines.push(lineText);lineText='';
      for(const char of word){if(font.widthOfTextAtSize(lineText+char,size)>width){lines.push(lineText);lineText='';}lineText+=char;}
    }
    if(lineText)lines.push(lineText);return lines;
  };
  const text=(page,value,x,y,size=11,color=ink)=>page.drawText(String(value).replace(/[–—−]/g,'-'),{x,y,size,font,color});
  const clean=s=>String(s).replace(/[–—−]/g,'-');
  function tokenBox(t,size){
    if(t.type==='fraction'){
      const top=rowBox(mathTokens(t.top),size*.78),bottom=rowBox(mathTokens(t.bottom),size*.78),bar=size*.25,gap=size*.16;
      const topY=bar+gap+top.descent,bottomY=bar-gap-bottom.ascent;
      return {width:Math.max(top.width,bottom.width)+6,ascent:topY+top.ascent,descent:-bottomY+bottom.descent,topY,bottomY};
    }
    const s=t.type==='text'?size:size*.65,shift=t.type==='sup'?size*.5:t.type==='sub'?-size*.24:0;
    return {width:font.widthOfTextAtSize(clean(t.text),s),ascent:s*.82+shift,descent:Math.max(0,s*.22-shift)};
  }
  function rowBox(tokens,size){
    const boxes=tokens.map(t=>tokenBox(t,size));return {width:boxes.reduce((sum,b)=>sum+b.width,0),ascent:Math.max(size*.82,...boxes.map(b=>b.ascent)),descent:Math.max(size*.22,...boxes.map(b=>b.descent))};
  }
  const rowWidth=(tokens,size)=>rowBox(tokens,size).width;
  function mathRow(page,tokens,x,y,size,color=ink){
    for(const t of tokens){
      const box=tokenBox(t,size),w=box.width;
      if(t.type==='fraction'){
        const top=mathTokens(t.top),bottom=mathTokens(t.bottom),small=size*.78;
        mathRow(page,top,x+(w-rowWidth(top,small))/2,y+box.topY,small,color);
        mathRow(page,bottom,x+(w-rowWidth(bottom,small))/2,y+box.bottomY,small,color);
        page.drawLine({start:{x:x+1,y:y+size*.25},end:{x:x+w-1,y:y+size*.25},thickness:.6,color});
      }else text(page,t.text,x,y+(t.type==='sup'?size*.5:t.type==='sub'?-size*.24:0),t.type==='text'?size:size*.65,color);
      x+=w;
    }
  }
  function mathParagraph(page,value,x,y,size,width,color=ink){
    const groups=[];let current=[];
    for(const t of mathTokens(value)){
      if(t.type!=='text'){current.push(t);continue;}
      for(const part of t.text.split(/(\s+)/)){
        if(!part)continue;
        if(/^\s+$/.test(part)){if(current.length)groups.push(current);current=[];}
        else current.push({type:'text',text:part});
      }
    }
    if(current.length)groups.push(current);
    const lines=[];let line=[];
    for(const g of groups){
      const candidate=line.length?[...line,{type:'text',text:' '},...g]:g;
      if(line.length&&rowWidth(candidate,size)>width){lines.push(line);line=[...g];}else line=candidate;
    }
    if(line.length)lines.push(line);
    let previous=null;
    for(const row of lines){
      const box=rowBox(row,size);
      if(previous)y-=Math.max(size*2.05,previous.descent+box.ascent+5);
      else y-=Math.max(0,box.ascent-size);
      mathRow(page,row,x,y,size,color);previous=box;
    }
    return y-Math.max(0,(previous?.descent||0)-size*.22);
  }
  function diagram(page,id,top){
    const f=geometryFigure(id);if(!f)return 0;
    const scale=1,x=(595.28-f.width*scale)/2;
    const point=(px,py)=>({x:x+px*scale,y:top-py*scale});
    for(const p of f.elements){
      if(p.type==='line')page.drawLine({start:point(p.x1,p.y1),end:point(p.x2,p.y2),thickness:1,color:muted,...(p.dash?{dashArray:[3,3]}:{})});
      if(p.type==='polygon'){
        const path=p.points.map(([px,py],i)=>`${i?'L':'M'} ${px} ${py}`).join(' ')+' Z';
        page.drawSvgPath(path,{x,y:top,scale,borderWidth:1,borderColor:muted,...(p.fill?{color:shade}:{})});
      }
      if(p.type==='ellipse')page.drawEllipse({...point(p.x,p.y),xScale:p.rx*scale,yScale:p.ry*scale,borderWidth:1,borderColor:muted,...(p.fill?{color:shade}:{})});
      if(p.type==='text'){
        const tokens=mathTokens(p.text),w=rowWidth(tokens,p.size*scale),q=point(p.x,p.y);
        mathRow(page,tokens,q.x-(p.anchor==='middle'?w/2:p.anchor==='end'?w:0),q.y,p.size*scale,ink);
      }
    }
    text(page,f.caption||'Схема, не в масштабе',210,top-f.height*scale-15,7,muted);
    return f.height*scale+22;
  }
  function base(isKey){
    const page=doc.addPage([595.28,841.89]);pages.push(page);
    text(page,'1430  ×  МАТЕМАТИКА',45,797,10,muted);
    let titleSize=18;while(wrap(title||'Самостоятельная работа',titleSize,505).length>2&&titleSize>12)titleSize--;
    const titleLines=wrap(title||'Самостоятельная работа',titleSize,505);
    titleLines.forEach((l,i)=>text(page,l,45,765-i*23,titleSize));
    text(page,`${grade} класс${grade>=10?' · '+(level==='advanced'?'углублённый':'базовый')+' уровень':''}`,45,718,10,muted);
    text(page,`Вариант ${variant||'1'}${isKey?' · Ответы для учителя':''}`,45,703,10,muted);
    page.drawLine({start:{x:45,y:691},end:{x:550,y:691},thickness:1.2,color:ink});
    if(!isKey)text(page,'Имя и фамилия: ______________________________  Класс: ______',45,671,10);
    return page;
  }
  for(const group of taskPages(tasks)){
    const page=base(false);
    group.forEach(({q,number},j)=>{
      const top=650-j*274;
      const end=mathParagraph(page,`${number}. ${q.prompt}`,45,top,11,505);
      const h=diagram(page,q.id,end-18),start=h?end-18-h-15:end-35;
      const count=group.length===1?Math.min(12,Math.floor((start-80)/22)):6;
      for(let k=0;k<count;k++)page.drawLine({start:{x:45,y:start-k*22},end:{x:550,y:start-k*22},thickness:.45,color:line});
    });
  }
  if(answers)for(let i=0;i<tasks.length;i+=3){
    const page=base(true);let y=672;
    for(let j=i;j<Math.min(i+3,tasks.length);j++){
      const q=tasks[j];y=mathParagraph(page,`${j+1}. Ответ: ${q.display.replace(/\./g,',')}.`,45,y,11,505);y-=28;
      y=mathParagraph(page,q.solution,45,y,10,505,muted);y-=29;
    }
  }
  pages.forEach((page,i)=>{
    page.drawLine({start:{x:45,y:47},end:{x:550,y:47},thickness:.5,color:line});
    text(page,'Авторские задания по темам ФРП · школа 1430',45,32,8,muted);
    text(page,`${i+1} / ${pages.length}`,520,32,8,muted);
  });
  return doc.save();
}
