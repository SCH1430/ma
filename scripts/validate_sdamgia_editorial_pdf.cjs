// A reviewed source correction must reach the actual PDF key without old tiles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const {BANK,SDAMGIA_BANK,FONT_BASE64}=page.dataValues();
const task=SDAMGIA_BANK.tasks.find(q=>q.id==='sdamgia-ege-profile-26594');
assert(task?.solutionEditorialNote&&task.solution.includes('2v² − 31v − 475 = 0'),'Build the reviewed source correction first');
assert.deepEqual(task.solutionImages,[],'The broken original solution must not be exported');
const raw=JSON.parse(fs.readFileSync(path.join(root,'src/sdamgia/bank.json'),'utf8')).tasks.find(q=>q.id===task.id);
const PDFLib=page.vendor('pdf-lib'),fontkit=page.vendor('fontkit'),audit=require('./audit_unified_pdf.cjs')(PDFLib);
const create=new Function('PDFLib','fontkit','BANK','FONT_BASE64',page.figuresCode()+'\n'+page.sourceFor('src/pdf.js')+'\nreturn createMathPDF;')(PDFLib,fontkit,BANK,FONT_BASE64);
(async()=>{
 const bytes=await create({tasks:[task],title:'Проверка исправленного разбора',variant:'1',grade:null,level:null,answers:true});
 const doc=audit.documents[0],text=doc.pages.flatMap(p=>p.text.map(t=>t.value)).join(' '),layout=audit.finish();
 assert(text.replace(/\s+/g,'').includes('исправленаопечаткаисточника'),'The correction is disclosed in the key');
 assert(text.includes('4761')&&text.includes('550')&&text.includes('1425'),'The independently checked derivation is rendered as actual PDF text');
 for(const image of raw.solutionImages)assert(!layout.imageCounts[audit.hash(image)],'A broken source solution tile reached the PDF');
 assert.deepEqual(layout.failures,[],'Corrected key has no PDF layout failures');
 const output=path.resolve(root,process.argv[2]||'output/pdf/sdamgia-corrected-26594.pdf');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
 console.log(JSON.stringify({status:'passed',taskId:task.id,pages:layout.pages,images:layout.images,correctedNativeSolution:true,brokenSourceTilesExcluded:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
