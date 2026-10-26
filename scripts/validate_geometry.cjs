// Validate the shared drawing model, condition labels and the real PDF output.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const {BANK,FONT_BASE64}=page.dataValues(),PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit');
const context=vm.createContext({BANK});vm.runInContext(page.figuresCode(),context);
const font=fontkit.create(Buffer.from(FONT_BASE64,'base64')),supported=new Set(font.characterSet);
let checks=0,figures=0,conditionFigures=0,referenceFigures=0;const errors=[],byGrade={},samples=new Map();
const test=(ok,label)=>{checks++;if(!ok)errors.push(label);};
const models=new Set(['perimeter','rectangle','box','angles','coordinates','triangle','pythagoras','trapezoid','similarity','inscribed_angle','vectors2','sector','cosine_rule','spatial_distance','solid_volume','cylinder','frustum','sphere','sphere_section','vectors3','volume_scale']);
for(const topic of BANK)for(const q of topic.tasks){
 const f=context.geometryFigure(q.id),geo=/геометри/i.test(topic.subject);
 if(geo){const row=byGrade[topic.grade]??={tasks:0,figures:0};row.tasks++;if(f)row.figures++;}
 if(q.generation&&models.has(q.generation.model)&&geo)test(!!f,q.id+' generated geometry has a figure');
 if(!f)continue;
 figures++;if(/Опорная/.test(f.caption))referenceFigures++;else conditionFigures++;
 test(f.width>0&&f.width<=505&&f.height>0&&f.height<=320,q.id+' usable drawing dimensions');
 test(typeof f.alt==='string'&&f.alt.trim().length>10,q.id+' meaningful alternative description');
 test(Array.isArray(f.elements)&&f.elements.length>0,q.id+' vector content');
 for(const e of f.elements){
  test(['line','polygon','ellipse','text'].includes(e.type),q.id+' supported vector element');
  const points=e.type==='line'?[[e.x1,e.y1],[e.x2,e.y2]]:e.type==='polygon'?e.points:e.type==='ellipse'?[[e.x-e.rx,e.y-e.ry],[e.x+e.rx,e.y+e.ry]]:[[e.x,e.y]];
  test(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=f.width&&y>=0&&y<=f.height),q.id+' drawing stays inside canvas');
  if(e.type==='text'){
   test(e.size>=10&&e.size<=24,q.id+' readable label size');
   test([...String(e.text)].every(c=>!c.trim()||supported.has(c.codePointAt(0))),q.id+' PDF font supports labels');
   const width=font.layout(String(e.text)).glyphs.reduce((sum,g)=>sum+g.advanceWidth,0)/font.unitsPerEm*e.size;
   const left=e.x-(e.anchor==='middle'?width/2:e.anchor==='end'?width:0);
   test(left>=-1&&left+width<=f.width+1,q.id+' label fits drawing: '+e.text);
  }
 }
 if(!q.figure){
  const altered={...q,answer:999999,display:'REVEALED',solution:'REVEALED'};
  const redraw=topic.grade<=9?context.planarTaskFigure(altered,topic):context.spatialTaskFigure(altered,topic);
  if(redraw)test(JSON.stringify(redraw)===JSON.stringify(f),q.id+' diagram depends only on the condition');
 }
 const key=q.generation?`${q.generation.model}:${q.generation.form}`:`grade:${topic.grade}`;
 if(!samples.has(key))samples.set(key,{...q,grade:topic.grade,level:topic.level,source:'class'});
 if(!q.figure&&!q.generation&&topic.grade>=10&&/Опорная/.test(f.caption)){
  const referenceKey='reference:'+f.caption;
  if(!samples.has(referenceKey))samples.set(referenceKey,{...q,grade:topic.grade,level:topic.level,source:'class'});
 }
}
for(const [grade,row] of Object.entries(byGrade))test(row.figures===row.tasks,grade+' every geometry task has a figure');
require('./geometry_invariants.cjs')(context,BANK,test);
for(const id of ['11-218-8','11-319-9']){
 const topic=BANK.find(t=>t.tasks.some(q=>q.id===id)),q=topic.tasks.find(q=>q.id===id);
 samples.set('critical:'+id,{...q,grade:topic.grade,level:topic.level,source:'class'});
}
const audit=require('./audit_unified_pdf.cjs')(PDFLib);
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,FONT_BASE64);
(async()=>{
 const tasks=[...samples.values()],out=path.join(root,'output/pdf/geometry-review.pdf');fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,await create({tasks,title:'Геометрия · чертежи к условиям',variant:'1',grade:null,answers:true}));
 const layout=audit.finish();test(layout.failures.length===0,'geometry PDF layout: '+JSON.stringify(layout.failures.slice(0,3)));
 const report={checks,figures,conditionFigures,referenceFigures,byGrade,sampleTasks:tasks.map(q=>q.id),pdfPages:layout.pages,errors};
 fs.writeFileSync(path.join(root,'checks/geometry-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
})().catch(error=>{console.error(error);process.exitCode=1;});
