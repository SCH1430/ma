// Export real mixed content: one original from every imported subtype, plus
// class/FIPI examples. Instrument the renderer to detect clipping and distortion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const {BANK,EXAM_BANK,SDAMGIA_BANK,FONT_BASE64}=page.dataValues();
if(!SDAMGIA_BANK?.subtypes?.length||!SDAMGIA_BANK?.tasks?.length)throw Error('Build the source bank before exporting the PDF sample.');
const PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit'),audit=require('./audit_unified_pdf.cjs')(PDFLib);
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,FONT_BASE64);
const classes=BANK.flatMap(topic=>topic.tasks.map(q=>({...q,source:'class',grade:topic.grade,level:topic.level,sourceLabel:`${topic.grade} класс`,topic:topic.title})));
const author=classes.find(q=>q.grade===5&&q.kind==='number');
const exam=EXAM_BANK.find(e=>e.id==='oge'),parent=exam?.tasks.find(q=>q.number===1),original=parent?.examples?.[0]||parent;
const official=original?{...original,source:'exam',examId:exam.id,sourceLabel:exam.title+' · демоверсия 2026',number:parent.number,kind:original.answerKind,display:original.answerText,contextImages:original.contextImages?.length?original.contextImages:parent.contextImages||[],solutionPages:original.solutionPages?.length?original.solutionPages:exam.solutionPages||[]}:null;
const originals=SDAMGIA_BANK.subtypes.map(subtype=>{
 const choices=SDAMGIA_BANK.tasks.filter(q=>q.subtypeId===subtype.id);
 // Include the tallest statement or solution in each subtype to stress pagination.
 const score=q=>[...(q.printImages||[]),...(q.solutionImages||[])].reduce((sum,value)=>{
  const bytes=Buffer.from((typeof value==='string'?value:value.image).split(',')[1]||'','base64');
  return sum+(bytes.length>=24?bytes.readUInt32BE(20)/Math.max(1,bytes.readUInt32BE(16)):0);
 },0);
 const selected=choices.sort((a,b)=>score(b)-score(a))[0];
 if(!selected)throw Error('Missing sample for subtype '+subtype.id);
 if(!selected.printImages?.length||!selected.solutionImages?.length)throw Error('Missing original PNG assets for '+selected.id);
 return {...selected,source:'sdamgia'};
});
if(!author||!official)throw Error('Mixed PDF sample needs both an author task and a FIPI task.');
const imageValues=values=>(values||[]).map(value=>typeof value==='string'?value:value.image);
const imageAspect=value=>{const bytes=Buffer.from(value.split(',')[1]||'','base64');return bytes.readUInt32BE(20)/Math.max(1,bytes.readUInt32BE(16));};
// A tall original starts both the worksheet and the key, exercising their
// shorter first-page content areas rather than only continuation pages.
originals.sort((a,b)=>Math.max(...imageValues([...(b.printImages||[]),...(b.solutionImages||[]) ]).map(imageAspect))-Math.max(...imageValues([...(a.printImages||[]),...(a.solutionImages||[]) ]).map(imageAspect)));
const tasks=[...originals,author,official];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
 const output=path.join(root,'output/pdf/sdamgia-sample.pdf');fs.mkdirSync(path.dirname(output),{recursive:true});
 const bytes=await create({tasks,title:'Практика по подтипам · Решу ЕГЭ и ОГЭ',variant:'1',grade:null,level:null,answers:true});
 fs.writeFileSync(output,bytes);
 const document=audit.documents[0],images=document.pages.flatMap(p=>p.images),text=document.pages.flatMap(p=>p.text.map(t=>t.value)).join(' '),errors=[];
 const taskImages=originals.flatMap(q=>imageValues(q.printImages)),solutionImages=originals.flatMap(q=>imageValues(q.solutionImages)),answerImages=originals.flatMap(q=>imageValues(q.answerImages));
 for(const [section,values] of [['statement',taskImages],['solution',solutionImages],['answer',answerImages],['FIPI',imageValues(official.images)],['context',imageValues(official.contextImages)]]){
  for(const value of values)if(!images.some(image=>image.hash===audit.hash(value)))errors.push(`Missing ${section} image ${audit.hash(value)}`);
 }
 for(const q of originals){
  if(!text.includes(String(q.sourceId)))errors.push('Source ID missing: '+q.id);
  if(!text.includes(q.sourceUrl))errors.push('Original source link missing: '+q.id);
 }
 if(/undefined|null класс|null/.test(text))errors.push('Missing source metadata in PDF');
 // Formula-heavy originals should remain images, never their spoken alt text.
 if(/дробь: числитель:|конец дроби|конец совокупности/.test(text))errors.push('Source formula alt text leaked into printable task content');
 const layout=audit.finish(),failures=layout.failures;
 const samples=images.map(image=>({hash:image.hash,width:image.width,height:image.height,nativeWidth:image.nativeWidth,nativeHeight:image.nativeHeight,effectiveDpi:image.nativeWidth/image.width*72}));
 for(const image of samples)if(image.effectiveDpi>450)errors.push(`Original scaled below readable size: ${image.hash} (${Math.round(image.effectiveDpi)} DPI)`);
 const report={file:output,sha256:sha(bytes),tasks:tasks.length,sourceTasks:originals.length,subtypes:SDAMGIA_BANK.subtypes.length,sourceStatementImages:taskImages.length,sourceSolutionImages:solutionImages.length,sourceAnswerImages:answerImages.length,pages:document.pages.length,images:images.length,errors,layout,imageSamples:samples};
 fs.writeFileSync(path.join(root,'checks/sdamgia-pdf-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({file:output,sha256:report.sha256,tasks:report.tasks,sourceTasks:report.sourceTasks,subtypes:report.subtypes,pages:report.pages,images:report.images,errors,layoutFailures:failures},null,2));
 if(errors.length||failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
