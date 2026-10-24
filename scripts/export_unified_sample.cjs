// Representative mixed worksheet and PDF layout audit using the real renderer.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const page=require('./load_page.cjs').loadPage(root),{BANK,FONT_BASE64,EXAM_BANK}=page.dataValues();
const PDFLib=page.vendor('pdf-lib');
const fontkit=page.vendor('fontkit');
const audit=require('./audit_unified_pdf.cjs')(PDFLib);
const font=FONT_BASE64;
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.sourceFor('src/math-figures.js')+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,font);
const classes=BANK.flatMap(t=>t.tasks.map(q=>({...q,grade:t.grade,level:t.level,source:'class',sourceLabel:`${t.grade} класс · ${t.level==='advanced'?'углублённый':'базовый'} курс`})));
function examTask(id,number,index=0){
 const exam=EXAM_BANK.find(e=>e.id===id),parent=exam.tasks.find(t=>t.number===number),examples=parent.examples?.length?parent.examples:[parent],q=examples[index];
 return {...q,source:'exam',examId:id,sourceLabel:exam.title+' · демоверсия 2026',number,exampleNumber:examples.length>1?index+1:null,kind:q.answerKind,display:q.answerText,solutionPages:q.solutionPages?.length?q.solutionPages:exam.solutionPages||[],contextImages:q.contextImages?.length?q.contextImages:parent.contextImages||[]};
}
const tasks=[
 classes.find(q=>q.grade===5&&q.kind!=='open'),
 classes.find(q=>q.grade===11&&q.level==='basic'),
 classes.find(q=>q.grade===11&&q.level==='advanced'),
 classes.find(q=>q.grade===6&&q.figure),
 classes.find(q=>q.grade===6&&q.kind==='open'),
 examTask('oge',1),examTask('oge',2),examTask('oge',25),
 examTask('ege-basic',3,2),examTask('ege-basic',19,3),
 examTask('ege-profile',13,0),examTask('ege-profile',17,1)
];
if(tasks.some(q=>!q))throw new Error('Representative worksheet source task missing');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
 const out=path.join(root,'output/pdf');fs.mkdirSync(out,{recursive:true});
 const reports=[];
 for(const answers of [false,true]){
  const before=audit.documents.length;
  const bytes=await create({tasks,title:'Сборная работа по математике',variant:'1',grade:null,level:null,answers});
  const file=path.join(out,answers?'1430-mixed-teacher.pdf':'1430-mixed-student.pdf');fs.writeFileSync(file,bytes);
  const document=audit.documents[before],images=document.pages.flatMap(p=>p.images),expected=tasks.filter(q=>q.source==='exam').flatMap(q=>q.images);
  const errors=[];
  const context=tasks.find(q=>q.contextImages?.length).contextImages[0],contextHash=audit.hash(context);
  if(images.filter(i=>i.hash===contextHash).length!==1)errors.push('Shared OGE context must appear exactly once');
  for(const image of expected)if(!images.some(i=>i.hash===audit.hash(image)))errors.push('Original task image missing');
  for(const image of tasks.filter(q=>q.kind==='open'&&q.source==='exam').flatMap(q=>q.solutionPages.map(p=>p.image))){
   if(images.some(i=>i.hash===audit.hash(image))!==answers)errors.push('Teacher criteria isolation failed');
  }
  const text=document.pages.flatMap(p=>p.text.map(t=>t.value)).join(' ');
  if(/undefined|null класс|null/.test(text))errors.push('Missing source metadata in PDF');
  reports.push({file,answers,tasks:tasks.length,pages:document.pages.length,images:images.length,sha256:sha(bytes),errors});
 }
 const layout=audit.finish(),report={samples:reports,layout};
 fs.writeFileSync(path.join(root,'checks/unified-pdf-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({samples:reports,layout:{documents:layout.documents,pages:layout.pages,images:layout.images,failures:layout.failures}},null,2));
 if(layout.failures.length||reports.some(r=>r.errors.length))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
