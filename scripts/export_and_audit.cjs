const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const page=require('./load_page.cjs').loadPage(root),{BANK,FONT_BASE64}=page.dataValues();
const PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit');
const outputs=path.join(root,'output/pdf');fs.mkdirSync(outputs,{recursive:true});
const reports=[];let activeReport;
const originalCreate=PDFLib.PDFDocument.create.bind(PDFLib.PDFDocument);
PDFLib.PDFDocument.create=async(...args)=>{
 const doc=await originalCreate(...args),add=doc.addPage.bind(doc);let pageNo=0;
 doc.addPage=(...a)=>{
  const page=add(...a),index=++pageNo,draw=page.drawText.bind(page),drawPath=page.drawSvgPath.bind(page),texts=[];
  activeReport.pages.push({index,texts});
  page.drawText=(value,opts)=>{
   const size=opts.size||12,w=opts.font.widthOfTextAtSize(value,size);
   const item={text:value,x:opts.x,y:opts.y,w,size};texts.push(item);
   if(opts.x<25||opts.x+w>573||opts.y<20||opts.y+size>823)activeReport.errors.push({page:index,type:'bounds',...item});
   return draw(value,opts);
  };
  page.drawSvgPath=(value,opts)=>{
   activeReport.polygons[opts.color?'filled':'outline']++;
   return drawPath(value,opts);
  };
  return page;
 };
 return doc;
};
const ctx={PDFLib,fontkit,BANK,FONT_BASE64,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),console};
Object.assign(ctx,new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn {createMathPDF,geometryFigure};')(PDFLib,fontkit,BANK,ctx.FONT_BASE64));
(async()=>{
 const groups=[...new Set(BANK.map(t=>`${t.grade}-${t.level}`))];
 for(const key of groups){
  const [g,level]=key.split('-'),grade=Number(g),tasks=BANK.filter(t=>t.grade===grade&&t.level===level).flatMap(t=>t.tasks);
  activeReport={key,tasks:tasks.length,pages:[],polygons:{filled:0,outline:0},errors:[]};
  const bytes=await ctx.createMathPDF({tasks,title:'Проверка полного банка',variant:'Аудит',grade,level,answers:true});
  fs.writeFileSync(path.join(outputs,`audit-${key}.pdf`),bytes);
  const expectedPolygons={filled:0,outline:0};
  for(const q of tasks)for(const element of ctx.geometryFigure(q.id)?.elements||[]){
   if(element.type==='polygon')expectedPolygons[element.fill?'filled':'outline']++;
  }
  for(const kind of ['filled','outline'])if(activeReport.polygons[kind]!==expectedPolygons[kind]){
   activeReport.errors.push({type:'polygon-'+kind,expected:expectedPolygons[kind],actual:activeReport.polygons[kind]});
  }
  for(const page of activeReport.pages){
   const ts=page.texts;
   for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++){
    const a=ts[i],b=ts[j];
    const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    const oy=Math.min(a.y+a.size*.8,b.y+b.size*.8)-Math.max(a.y-a.size*.15,b.y-b.size*.15);
    if(ox>1.5&&oy>2.5)activeReport.errors.push({page:page.index,type:'text-overlap',a:a.text,b:b.text,ox,oy});
   }
  }
  fs.writeFileSync(path.join(root,`checks/pdf-layout-${key}.json`),JSON.stringify(activeReport,null,2));
  reports.push({key,tasks:tasks.length,pages:activeReport.pages.length,polygons:activeReport.polygons,errors:activeReport.errors});
 }
 fs.writeFileSync(path.join(root,'checks/pdf-results.json'),JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports,null,2));
 if(reports.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.log('PDF audit failed:',e.message);process.exitCode=1;});
