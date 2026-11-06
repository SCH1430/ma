// Offline PDF creation: all layout, fonts and tasks remain in the current tab.
async function createMathPDF({tasks,example,title,variant,grade,level='basic',answers}) {
  if(globalThis.MathDataLoader)await MathDataLoader.ensurePDF();
  const worked=example&&MathTaskView.hasWorkedSolution(example)&&!tasks.some(q=>q.id===example.id)?example:null;
  const unified=worked||grade==null||tasks.some(q=>q.source==='exam'||q.examId||q.source==='sdamgia')||new Set(tasks.map(q=>q.grade).filter(Boolean)).size>1;
  const hasExams=tasks.some(q=>q.source==='exam'||q.examId),hasSourced=tasks.some(q=>q.source==='sdamgia');
  const {PDFDocument,rgb}=PDFLib;
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes=Uint8Array.from(atob(FONT_BASE64),c=>c.charCodeAt(0));
  const font=await doc.embedFont(fontBytes,{subset:true});
  const ink=rgb(.13,.2,.15),muted=rgb(.32,.39,.31),line=rgb(.79,.83,.77),shade=rgb(227/255,237/255,218/255);
  const brand='БАЗА · Математика школы 1430';
  doc.setTitle(title||'Самостоятельная работа');doc.setAuthor(brand);
  doc.setSubject(hasSourced?'Сборная работа по математике. Источники указаны у каждого задания; банк Решу ЕГЭ и ОГЭ.':unified?(hasExams?'Сборная работа по математике. Материалы ФИПИ соответствующих лет и задания по темам ФРП.':'Сборная работа по математике. Задания по темам ФРП.'):`Математика, ${grade} класс. Авторские задания по темам ФРП.`);
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
  function paragraphLines(value,size,width){
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
    return lines;
  }
  function mathParagraph(page,value,x,y,size,width,color=ink){
    let previous=null;
    for(const row of paragraphLines(value,size,width)){
      const box=rowBox(row,size);
      if(previous)y-=Math.max(size*2.05,previous.descent+box.ascent+5);
      else y-=Math.max(0,box.ascent-size);
      if(page)mathRow(page,row,x,y,size,color);previous=box;
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
    const captions=wrap(f.caption||'Схема, не в масштабе',7,Math.min(470,f.width));
    captions.forEach((value,i)=>text(page,value,(595.28-font.widthOfTextAtSize(value,7))/2,top-f.height*scale-14-i*11,7,muted));
    return f.height*scale+16+captions.length*11;
  }
  function base(isKey){
    const page=doc.addPage([595.28,841.89]);pages.push(page);
    text(page,brand,45,797,10,muted);
    let titleSize=18;while(wrap(title||'Самостоятельная работа',titleSize,505).length>2&&titleSize>12)titleSize--;
    const titleLines=wrap(title||'Самостоятельная работа',titleSize,505);
    titleLines.forEach((l,i)=>text(page,l,45,765-i*23,titleSize));
    text(page,`${grade} класс${grade>=10?' · '+(level==='advanced'?'углублённый':'базовый')+' уровень':''}`,45,718,10,muted);
    text(page,`Вариант ${variant||'1'}${isKey?' · Ответы для учителя':''}`,45,703,10,muted);
    page.drawLine({start:{x:45,y:691},end:{x:550,y:691},thickness:1.2,color:ink});
    if(!isKey)text(page,'Имя и фамилия: ______________________________  Класс: ______',45,671,10);
    return page;
  }
  // The shared constructor keeps the original exam fragments intact. Images are
  // embedded directly, so formulas, diagrams and official criteria never pass
  // through text recognition or the class-task solution generator.
  if(unified){
    const left=45,right=550,width=right-left,bottom=66;
    const isExam=q=>q.source==='exam'||!!q.examId;
    const sourceLabel=q=>q.sourceLabel||(isExam(q)?`${String(q.examId).startsWith('oge')?'ОГЭ':String(q.examId).startsWith('ege-basic')?'ЕГЭ, базовый уровень':'ЕГЭ, профильный уровень'} · ${q.examStatus==='project'?'проект демоверсии':'демоверсия'} ${q.year||String(q.id).match(/exam-(20\d\d)/)?.[1]||2026}`:`${q.grade||String(q.id).split('-')[0]} класс${q.grade>=10?` · ${q.level==='advanced'?'углублённый':'базовый'} уровень`:''}`);
    const taskLabel=(q,index)=>`${sourceLabel(q)}${q.source==='sdamgia'?` · № ${q.sourceId} · ${q.topic}`:isExam(q)?` · № ${q.number}${q.exampleNumber?` · пример ${q.exampleNumber}`:''}`:''}`;
    const sources=[...new Set((worked?[worked,...tasks]:tasks).map(sourceLabel))];
    const sourceSummary=sources.length>3?'Задания из разных классов и экзаменов':sources.join(' · ');
    const imageCache=new Map();
    const original=async value=>{
      const data=typeof value==='string'?value:value?.image;
      if(!data)throw new Error('Не найдено изображение условия или решения.');
      if(!imageCache.has(data))imageCache.set(data,doc.embedPng(data));
      return imageCache.get(data);
    };
    let page,y,pageTop,key=false,sectionPages=0;
    function nextPage(){
      page=doc.addPage([595.28,841.89]);pages.push(page);sectionPages++;
      text(page,brand,left,797,10,muted);
      let headingSize=sectionPages===1?18:13;
      let headingLines=wrap(title||'Самостоятельная работа',headingSize,width);
      while(headingLines.length>3&&headingSize>10){headingSize--;headingLines=wrap(title||'Самостоятельная работа',headingSize,width);}
      y=sectionPages===1?765:772;
      headingLines.forEach(value=>{text(page,value,left,y,headingSize);y-=headingSize+5;});
      if(sectionPages===1&&!key){
        for(const value of wrap(sourceSummary,9,width)){text(page,value,left,y-2,9,muted);y-=13;}
      }
      const caption=`Вариант ${variant||'1'} · ${key?'Ответы и критерии для учителя':'Задания'}`;
      text(page,caption,left,y-3,10,muted);y-=18;
      page.drawLine({start:{x:left,y},end:{x:right,y},thickness:1.1,color:ink});y-=22;
      if(!key&&sectionPages===1){text(page,'Имя и фамилия: ______________________________  Класс: ______',left,y,10);y-=27;}
      pageTop=y;
    }
    const ensure=height=>{if(y-height<bottom&&y<pageTop)nextPage();};
    function flow(value,size=11,color=ink,gap=12){
      const rows=paragraphLines(value,size,width);let previous=null;
      for(const row of rows){
        const box=rowBox(row,size);
        let step=previous?Math.max(size*1.85,previous.descent+box.ascent+5):Math.max(0,box.ascent-size);
        if(y-step-box.descent<bottom){nextPage();previous=null;step=Math.max(0,box.ascent-size);}
        y-=step;mathRow(page,row,left,y,size,color);previous=box;
      }
      y-=Math.max(0,(previous?.descent||0)-size*.22)+gap;
    }
    function label(q,index,continued=false){
      flow(`Задание ${index+1}${continued?' · продолжение':''}`,12,ink,16);
      flow(taskLabel(q,index),8.5,muted,15);
    }
    function methodCondition(q){
      for(const representation of q.representations||[]){
        if(representation.caption||representation.title)flow(representation.caption||representation.title,9,muted,12);
        if(representation.type==='text'&&representation.text)flow(representation.text,10,ink,15);
        if(representation.type==='table'){
          if(representation.headers?.length)flow(representation.headers.join(' | '),10,ink,18);
          for(const row of representation.rows||[])if(Array.isArray(row))flow(row.join(' | '),10,ink,18);
          y-=8;
        }
        if(representation.type==='graph'){
          const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite),points=(representation.points||[]).filter(valid),segments=(representation.segments||[]).filter(s=>Array.isArray(s)&&s.length===2&&s.every(valid)),all=[...points,...segments.flat()];
          if(!all.length)continue;
          const xmin=Number.isFinite(representation.xMin)?representation.xMin:Math.min(0,...all.map(p=>p[0]))-1,xmax=Number.isFinite(representation.xMax)?representation.xMax:Math.max(0,...all.map(p=>p[0]))+1,ymin=Number.isFinite(representation.yMin)?representation.yMin:Math.min(0,...all.map(p=>p[1]))-1,ymax=Number.isFinite(representation.yMax)?representation.yMax:Math.max(0,...all.map(p=>p[1]))+1;
          if(!(xmax>xmin&&ymax>ymin))continue;
          ensure(230);const base=y-195,xx=v=>left+35+(v-xmin)/(xmax-xmin)*(width-65),yy=v=>base+25+(v-ymin)/(ymax-ymin)*155;
          for(let i=0;i<=5;i++){
            const vx=xmin+(xmax-xmin)*i/5,vy=ymin+(ymax-ymin)*i/5;
            page.drawLine({start:{x:xx(vx),y:base+25},end:{x:xx(vx),y:base+180},thickness:.35,color:line});page.drawLine({start:{x:left+35,y:yy(vy)},end:{x:right-30,y:yy(vy)},thickness:.35,color:line});
            text(page,String(Number(vx.toFixed(2))),xx(vx)-5,base+10,8,muted);text(page,String(Number(vy.toFixed(2))),left+5,yy(vy)-3,8,muted);
          }
          const zx=xx(Math.max(xmin,Math.min(xmax,0))),zy=yy(Math.max(ymin,Math.min(ymax,0)));
          page.drawLine({start:{x:left+35,y:zy},end:{x:right-25,y:zy},thickness:.8,color:ink});page.drawLine({start:{x:zx,y:base+20},end:{x:zx,y:base+187},thickness:.8,color:ink});
          for(const segment of segments)page.drawLine({start:{x:xx(segment[0][0]),y:yy(segment[0][1])},end:{x:xx(segment[1][0]),y:yy(segment[1][1])},thickness:1.7,color:ink});
          if(representation.connect===true&&!segments.length)for(let i=1;i<points.length;i++)page.drawLine({start:{x:xx(points[i-1][0]),y:yy(points[i-1][1])},end:{x:xx(points[i][0]),y:yy(points[i][1])},thickness:1.7,color:ink});
          for(const p of points)page.drawCircle({x:xx(p[0]),y:yy(p[1]),size:2.7,color:ink});
          text(page,representation.xLabel||'x',right-20,zy+8,9);text(page,representation.yLabel||'y',zx+8,base+190,9);y=base-8;
        }
      }
      if(q.kind==='steps'){flow('Шаги для упорядочивания:',10,ink,16);for(const item of q.stepOptions||[])flow(`${item.id}. ${item.text}`,10,ink,18);}
      if(q.kind==='matching'){for(const [key,title] of [['matchingItems','Элементы:'],['matchingOptions','Варианты соответствия:']])if(q[key]?.length){flow(title,10,ink,16);for(const item of q[key])flow(`${item.id}. ${item.text}`,10,ink,18);}}
      if(typeof MathAnswerFormats!=='undefined'&&MathAnswerFormats.supports(q.kind))flow(MathAnswerFormats.hint(q),8.5,muted,16);
    }
    async function drawOriginal(value,continuation){
      const picture=await original(value);
      const naturalHeight=picture.height*width/picture.width;
      const fullPageSpace=pageTop-bottom-(continuation?50:0);
      const freshFragment=naturalHeight>fullPageSpace&&(y-bottom)>=fullPageSpace*.9;
      if(y-naturalHeight<bottom&&y<pageTop&&!freshFragment){nextPage();if(continuation)continuation();}
      // Full-page fragments can be a little taller than the printable area.
      // Fit the whole original on its own page; never crop a line or diagram.
      const scale=Math.min(width/picture.width,(y-bottom)/picture.height);
      const drawWidth=picture.width*scale,drawHeight=picture.height*scale;
      page.drawImage(picture,{x:left+(width-drawWidth)/2,y:y-drawHeight,width:drawWidth,height:drawHeight});
      y-=drawHeight+15;
    }
    function solutionLines(count){
      for(let i=0;i<count;i++){
        if(y<bottom+18){nextPage();flow('Место для решения · продолжение',9,muted,18);}
        page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.45,color:line});y-=22;
      }
      y-=14;
    }
    const contexts=new Map();
    tasks.forEach((q,index)=>{
      if(!isExam(q)||!q.contextImages?.length)return;
      const id=q.contextImages.map(value=>typeof value==='string'?value:value.image).join('|');
      if(!contexts.has(id))contexts.set(id,{images:q.contextImages,source:sourceLabel(q),numbers:[]});
      contexts.get(id).numbers.push(index+1);
    });
    const drawnContexts=new Set();
    nextPage();
    if(worked){
      flow('Пример с разбором',13,ink,18);
      flow(taskLabel(worked),8.5,muted,15);
      flow(worked.prompt,11,ink,20);methodCondition(worked);
      const figure=geometryFigure(worked.id);
      if(figure){ensure(figure.height+48);y-=diagram(page,worked.id,y)+20;}
      for(const paragraph of worked.solution.split(/\n\s*\n/).filter(Boolean))flow(paragraph,10,ink,18);
      if(worked.display)flow(`Ответ: ${worked.display}`,11,ink,24);
      y-=8;
    }
    for(let index=0;index<tasks.length;index++){
      const q=tasks[index],exam=isExam(q);
      if(exam&&q.contextImages?.length){
        const id=q.contextImages.map(value=>typeof value==='string'?value:value.image).join('|');
        if(!drawnContexts.has(id)){
          const context=contexts.get(id),first=await original(context.images[0]);
          ensure(Math.min(first.height*width/first.width+68,pageTop-bottom));
          flow(`Общий материал к заданиям работы: ${context.numbers.join(', ')}`,11,ink,17);
          flow(context.source,8.5,muted,15);
          for(const image of context.images)await drawOriginal(image,()=>flow('Общий материал · продолжение',10,muted,18));
          drawnContexts.add(id);y-=8;
        }
      }
      if(exam||q.source==='sdamgia'){
        const pictures=q.source==='sdamgia'?q.printImages:q.images;
        if(!pictures?.length)throw new Error(`Нет оригинального условия: ${taskLabel(q,index)}.`);
        const first=await original(pictures[0]);
        const workspace=q.kind==='open'?9:4;
        const needed=48+first.height*width/first.width+22*workspace+22;
        ensure(Math.min(needed,pageTop-bottom));
        label(q,index);
        if(q.source==='sdamgia')flow(q.sourceUrl,7,muted,15);
        for(const image of pictures)await drawOriginal(image,()=>label(q,index,true));
        if(q.contextImages?.length)flow('Используйте общий материал, приведённый выше.',8.5,muted,17);
        if(q.kind==='open')flow('Запишите развёрнутое решение.',9,muted,18);
        solutionLines(workspace);
      }else{
        const figure=geometryFigure(q.id),promptHeight=-mathParagraph(null,q.prompt,left,0,11,width)+16;
        const workspace=q.kind==='open'?10:figure?7:5;
        const needed=50+promptHeight+(figure?figure.height+37:0)+workspace*22+20;
        ensure(Math.min(needed,pageTop-bottom));
        label(q,index);flow(q.prompt,11,ink,24);methodCondition(q);
        if(figure){
          ensure(figure.height+48);const height=diagram(page,q.id,y);y-=height+20;
        }
        if(q.kind==='open')flow('Запишите развёрнутое решение.',9,muted,18);
        solutionLines(workspace);
      }
    }
    if(answers&&tasks.length){
      key=true;sectionPages=0;nextPage();
      for(let index=0;index<tasks.length;index++){
        const q=tasks[index],exam=isExam(q);
        if(q.source==='sdamgia'){
          ensure(95);label(q,index);flow(q.sourceUrl,7,muted,15);
          if(q.answerImages?.length){for(const image of q.answerImages)await drawOriginal(image,()=>label(q,index,true));}
          else if(q.display&&q.kind!=='open')flow(`Ответ: ${q.display}`,11,ink,20);
          if(q.solutionEditorialNote&&q.solution){
            flow(q.solutionEditorialNote,9,muted,16);
            for(const paragraph of q.solution.split(/\n\s*\n/).filter(Boolean))flow(paragraph,10,ink,18);
          }else{
            if(!q.solutionImages?.length)throw new Error(`Нет изображения разбора: ${taskLabel(q,index)}.`);
            for(const image of q.solutionImages)await drawOriginal(image,()=>label(q,index,true));
          }
          if(q.kind==='open'&&q.rubric?.length){flow('Критерии самопроверки:',10,ink,14);q.rubric.forEach((criterion,i)=>flow(`${i+1}) ${criterion}`,10,muted,14));}
        }else if(exam&&q.kind==='open'){
          if(!q.solutionPages?.length)throw new Error(`Нет оригинальных решения и критериев ФИПИ: ${taskLabel(q,index)}.`);
          const first=await original(q.solutionPages[0]);
          ensure(Math.min(74+first.height*width/first.width,pageTop-bottom));
          label(q,index);flow('Оригинальные решение и критерии ФИПИ',10,ink,18);
          for(const fragment of q.solutionPages){
            const image=typeof fragment==='string'?fragment:fragment.image;
            const sourcePage=typeof fragment==='object'&&fragment.page!=null?` · страница ${fragment.page}`:'';
            await drawOriginal(image,()=>{label(q,index,true);flow(`Решение и критерии ФИПИ${sourcePage}`,9,muted,17);});
          }
        }else{
          const answer=exam?(q.answerText||q.display||''):q.display;
          const estimate=54+Math.max(22,paragraphLines(`Ответ: ${answer}`,11,width).length*21)+(exam?0:Math.max(22,paragraphLines(q.solution||'',10,width).length*20));
          ensure(Math.min(estimate,pageTop-bottom));label(q,index);
          if(exam){
            if(!answer)throw new Error(`Нет официального ответа: ${taskLabel(q,index)}.`);
            flow(`Ответ: ${answer}`,11,ink,26);
          }else{
            flow(q.kind==='open'?'Образец решения':`Ответ: ${String(answer).replace(/\./g,',')}.`,11,ink,17);
            if(q.solution)flow(q.solution,10,muted,18);
            if(q.source==='methods'){
              if(q.answerExplanation)flow(q.answerExplanation,9,muted,14);
              if(q.acceptedExamples?.length)flow('Другие допустимые образцы: '+q.acceptedExamples.join(' | '),9,muted,14);
              if(q.methodChoice)flow('Выбор способа: '+q.methodChoice,9,muted,14);
              if(q.domain)flow('Ограничения: '+q.domain,9,muted,14);
              if(q.check)flow('Проверка: '+q.check,9,muted,16);
            }
            if(q.kind==='open'&&q.rubric?.length){
              flow('Критерии самопроверки:',10,ink,14);
              q.rubric.forEach((criterion,i)=>flow(`${i+1}) ${criterion}`,10,muted,14));
            }
            y-=12;
          }
        }
      }
    }
    const examYears=[...new Set(tasks.filter(isExam).map(q=>q.year||String(q.id).match(/exam-(20\d\d)/)?.[1]||2026))].sort().join(', ');
    const footer=hasSourced?'Источники указаны у заданий · Решу ЕГЭ / ОГЭ · школа 1430':hasExams?`ФИПИ ${examYears} · источники у заданий · школа 1430`:'Задания по темам ФРП · школа 1430';
    pages.forEach((page,index)=>{
      page.drawLine({start:{x:left,y:47},end:{x:right,y:47},thickness:.5,color:line});
      const number=`${index+1} / ${pages.length}`;
      text(page,footer,left,32,8,muted);text(page,number,right-font.widthOfTextAtSize(number,8),32,8,muted);
    });
    return doc.save();
  }
  for(const group of taskPages(tasks)){
    const page=base(false);
    group.forEach(({q,number},j)=>{
      const top=650-j*274;
      let end=mathParagraph(page,`${number}. ${q.prompt}`,45,top,11,505);
      if(q.kind==='open')end=mathParagraph(page,'Развёрнутое решение · самопроверка по критериям',45,end-24,9,505,muted);
      const h=diagram(page,q.id,end-18),start=h?end-18-h-15:end-35;
      const count=group.length===1?Math.min(12,Math.floor((start-80)/22)):6;
      for(let k=0;k<count;k++)page.drawLine({start:{x:45,y:start-k*22},end:{x:550,y:start-k*22},thickness:.45,color:line});
    });
  }
  if(answers&&tasks.length){
    let page=base(true),y=672;
    // Keys flow by their actual height: open tasks include a model solution and
    // criteria, so a fixed number of tasks per page would overlap the footer.
    const keyParagraph=(value,size,color=ink)=>{
      let previous=null;
      for(const row of paragraphLines(value,size,505)){
        const box=rowBox(row,size);
        let next=y-(previous?Math.max(size*2.05,previous.descent+box.ascent+5):Math.max(0,box.ascent-size));
        if(next-box.descent<66){page=base(true);y=672;previous=null;next=y-Math.max(0,box.ascent-size);}
        mathRow(page,row,45,next,size,color);y=next;previous=box;
      }
      y-=Math.max(0,(previous?.descent||0)-size*.22);
    };
    tasks.forEach((q,j)=>{
      const open=q.kind==='open';
      const paragraphs=[
        [`${j+1}. ${open?'Самопроверка по критериям':'Ответ: '+q.display.replace(/\./g,',')+'.'}`,11,ink,18],
        [q.solution,10,muted,open?15:29],
        ...(open?[['Критерии самопроверки:',10,ink,12],...(q.rubric||[]).map((criterion,i)=>[`${i+1}) ${criterion}`,10,muted,12])]:[])
      ];
      const end=paragraphs.reduce((top,[value,size,,gap])=>mathParagraph(null,value,45,top,size,505)-gap,y);
      if(y<672&&end<66){page=base(true);y=672;}
      for(const [value,size,color,gap] of paragraphs){keyParagraph(value,size,color);y-=gap;}
      if(open)y-=17;
    });
  }
  pages.forEach((page,i)=>{
    page.drawLine({start:{x:45,y:47},end:{x:550,y:47},thickness:.5,color:line});
    text(page,'Авторские задания по темам ФРП · школа 1430',45,32,8,muted);
    const number=`${i+1} / ${pages.length}`;
    text(page,number,550-font.widthOfTextAtSize(number,8),32,8,muted);
  });
  return doc.save();
}
