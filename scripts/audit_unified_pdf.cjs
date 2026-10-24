// Instrument the application's real PDF renderer without changing its output.
// Install before constructing createMathPDF; call audit.finish() after save().
const crypto=require('crypto');
module.exports=function install(PDFLib){
 const originalCreate=PDFLib.PDFDocument.create,documents=[];
 const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value)).digest('hex');
 PDFLib.PDFDocument.create=async function(...args){
  const doc=await originalCreate.apply(this,args),report={pages:[],images:new Map()};documents.push(report);
  const addPage=doc.addPage.bind(doc),embedPng=doc.embedPng.bind(doc);
  doc.embedPng=async function(value){const image=await embedPng(value);report.images.set(image,hash(value));return image;};
  doc.addPage=function(...pageArgs){
   const page=addPage(...pageArgs),entry={size:page.getSize(),text:[],images:[],lines:[]};report.pages.push(entry);
   const drawText=page.drawText.bind(page),drawImage=page.drawImage.bind(page),drawLine=page.drawLine.bind(page);
   page.drawText=function(value,options){
    const {x,y,size,font}=options;entry.text.push({value,x,y,size,width:font.widthOfTextAtSize(value,size),height:font.heightAtSize(size),descent:font.heightAtSize(size,{descender:true})-font.heightAtSize(size,{descender:false})});
    return drawText(value,options);
   };
   page.drawImage=function(image,options){entry.images.push({...options,nativeWidth:image.width,nativeHeight:image.height,hash:report.images.get(image)});return drawImage(image,options);};
   page.drawLine=function(options){entry.lines.push(options);return drawLine(options);};
   return page;
  };
  return doc;
 };
 return {hash,documents,finish(){
  PDFLib.PDFDocument.create=originalCreate;
  const failures=[],imageCounts={};let totalPages=0,totalImages=0,totalText=0,taskLabels=0;
  const failure=(document,page,kind,detail)=>failures.push({document,page,kind,detail});
  documents.forEach((doc,di)=>doc.pages.forEach((page,pi)=>{
   totalPages++;totalText+=page.text.length;totalImages+=page.images.length;
   if(Math.abs(page.size.width-595.28)>.1||Math.abs(page.size.height-841.89)>.1)failure(di+1,pi+1,'page-size',page.size);
   page.text.forEach(t=>{
    if(t.x<44||t.x+t.width>551||t.y<30||t.y+t.height>818)failure(di+1,pi+1,'text-bounds',t);
   });
   page.images.forEach(im=>{
    imageCounts[im.hash]=(imageCounts[im.hash]||0)+1;
    if(im.x<44.9||im.x+im.width>550.1||im.y<65.9||im.y+im.height>776)failure(di+1,pi+1,'image-bounds',im);
    if(Math.abs(im.width/im.height-im.nativeWidth/im.nativeHeight)>1e-6)failure(di+1,pi+1,'image-aspect-ratio',im);
    if(im.width<390)failure(di+1,pi+1,'image-readability-scale',im);
    page.text.forEach(t=>{
     if(t.x+t.width>im.x+.5&&t.x<im.x+im.width-.5&&t.y+t.height>im.y+.5&&t.y-t.descent<im.y+im.height-.5)failure(di+1,pi+1,'image-text-overlap',{image:im,text:t});
    });
   });
   const rows=[];
   page.text.forEach(t=>{let row=rows.find(r=>Math.abs(r.y-t.y)<.1);if(!row){row={y:t.y,parts:[]};rows.push(row);}row.parts.push(t);});
   rows.forEach(row=>{row.parts.sort((a,b)=>a.x-b.x);row.value=row.parts.map(t=>t.value).join('');});rows.sort((a,b)=>b.y-a.y);
   const labels=rows.filter(row=>/^Задание \d+/.test(row.value));taskLabels+=labels.length;
   labels.forEach((row,index)=>{
    const below=labels[index+1]?.y||65;
    const hasImage=page.images.some(im=>im.y+im.height<row.y&&im.y>=below);
    const hasWorkspace=page.lines.some(line=>line.thickness===.45&&line.start.y<row.y&&line.start.y>below);
    const hasText=rows.some(r=>r.y<row.y-27&&r.y>below&&!/^(Оригинальные решение|Решение и критерии|Используйте общий материал)/.test(r.value));
    if(!hasImage&&!hasWorkspace&&!hasText)failure(di+1,pi+1,'orphan-task-label',row.value);
   });
   const hasBody=labels.length||page.images.length||page.lines.some(line=>line.thickness===.45)||rows.some(row=>row.y<640&&row.y>66);
   if(!hasBody)failure(di+1,pi+1,'empty-content-page',rows.map(row=>row.value));
  }));
  return {documents:documents.length,pages:totalPages,images:totalImages,textRuns:totalText,taskLabels,imageCounts,failures};
 }};
};
