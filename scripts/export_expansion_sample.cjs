// Exercise every added prompt/solution family through the real A4 PDF renderer.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const {BANK,FONT_BASE64}=page.dataValues(),PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit');
const audit=require('./audit_unified_pdf.cjs')(PDFLib);
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.sourceFor('src/math-figures.js')+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,FONT_BASE64);
const families=new Map();
for(const t of BANK)for(const q of t.tasks)if(q.generation?.batch==='2026-10-double'&&!families.has(q.family)){
 families.set(q.family,{...q,grade:t.grade,level:t.level,source:'class',sourceLabel:`${t.grade} класс · ${t.level==='advanced'?'углублённый':'базовый'} курс`});
}
(async()=>{
 const tasks=[...families.values()],out=path.join(root,'output/pdf');fs.mkdirSync(out,{recursive:true});
 assert.equal(tasks.length,164);
 const samples=[];
 for(let offset=0;offset<tasks.length;offset+=60){
  const batch=tasks.slice(offset,offset+60);
  for(const answers of [false,true]){
   const file=path.join(out,`baza-expansion-${offset/60+1}-${answers?'teacher':'student'}.pdf`);
   const bytes=await create({tasks:batch,title:'Новые задания · проверка печати',variant:String(offset/60+1),grade:null,level:null,answers});
   fs.writeFileSync(file,bytes);samples.push({file:path.relative(root,file),tasks:batch.length,answers,bytes:bytes.length});
  }
 }
 const layout=audit.finish();
 const report={families:families.size,samples,layout:{documents:layout.documents,pages:layout.pages,textRuns:layout.textRuns,failures:layout.failures}};
 fs.writeFileSync(path.join(root,'checks/expansion-pdf-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));assert.equal(layout.failures.length,0);
})().catch(error=>{console.error(error);process.exitCode=1;});
