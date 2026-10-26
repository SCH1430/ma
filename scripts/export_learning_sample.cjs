// Representative regression document: all new grade-6 diagrams and reasoning tasks.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const page=require('./load_page.cjs').loadPage(root),{BANK,FONT_BASE64}=page.dataValues();
const PDFLib=page.vendor('pdf-lib');
const fontkit=page.vendor('fontkit');
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,FONT_BASE64);
const tasks=BANK.filter(t=>t.grade===6).flatMap(t=>t.tasks).filter(q=>q.figure||q.kind==='open');
(async()=>{
 const target=path.join(root,'output/pdf/1430-learning-6.pdf');fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,await create({tasks,title:'Геометрия и рассуждения',variant:'1',grade:6,level:'basic',answers:true}));
 fs.writeFileSync(path.join(root,'checks/learning-sample.json'),JSON.stringify({file:target,taskIds:tasks.map(q=>q.id),worksheetPages:tasks.length},null,2));
 console.log({tasks:tasks.length,file:target});
})().catch(error=>{console.error(error);process.exitCode=1;});
