// Render the locally imported allowlisted fragments for offline PDF export.
// Import-time helper only: NODE_PATH must provide playwright and sharp.
// No request to the source site is made here.
const fs=require('fs'),path=require('path');
const {createHash,randomUUID}=require('crypto');
const {chromium}=require('playwright'),sharp=require('sharp');
const bankPath=path.join(__dirname,'bank.json');
const cachePath=path.join(__dirname,'../../preview/sdamgia-rendered.json');
function writeJSON(file,value){
 const tmp=path.join(__dirname,'../../preview/sdamgia-render-'+randomUUID()+'.json'),marker=file+'.writing';fs.writeFileSync(marker,'writing');
 try{fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');try{fs.renameSync(tmp,file);}catch(error){if(!['EACCES','EPERM','EBUSY'].includes(error.code))throw error;fs.copyFileSync(tmp,file);fs.unlinkSync(tmp);}}
 finally{fs.rmSync(marker,{force:true});}
}
const css=`
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#17251c}
#capture{width:800px;padding:8px 10px;font:18px/1.5 Arial,sans-serif;overflow-wrap:anywhere}
p{margin:8px 0}div{max-width:100%}img{max-width:100%;height:auto}
.source-formula{display:inline-block}.source-diagram{display:block;margin:12px auto;object-fit:contain;max-height:350px}
table{border-collapse:collapse;margin:12px auto;max-width:100%}td,th{border:1px solid #6b746c;padding:7px;text-align:center}
ol,ul{margin:10px 0;padding-left:30px}center{text-align:center}br{line-height:1.5}
`;

async function tiles(buffer){
 const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const blank=y=>{for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;if(data[i]<245||data[i+1]<245||data[i+2]<245)return false;}return true;};
 const result=[];let top=0;
 while(top<info.height){
  let bottom=Math.min(top+850,info.height);
  if(bottom<info.height){let found=false;for(let y=bottom;y>top+100;y--)if(blank(y)&&blank(y-1)){bottom=y;found=true;break;}if(!found)throw Error('No clean page break in source image');}
  const png=await sharp(buffer).extract({left:0,top,width:info.width,height:bottom-top}).png().toBuffer();
  result.push('data:image/png;base64,'+png.toString('base64'));top=bottom;
 }
 return result;
}

(async()=>{
 const assets=fs.existsSync(cachePath)?JSON.parse(fs.readFileSync(cachePath,'utf8')):{};
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:840,height:1000},deviceScaleFactor:1.5});
 // Fragments are strictly local. Fail if a later import accidentally adds a
 // remote dependency rather than silently rasterizing a missing asset.
 await page.route('**/*',route=>route.abort());
 try{
  let bank;
  while(true){
   if(fs.existsSync(bankPath+'.writing')){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
   try{bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));}
   catch(error){if(!process.argv.includes('--watch'))throw error;await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  for(const [i,task] of bank.tasks.entries()){
   const signature=createHash('sha256').update([task.promptHtml,task.solutionHtml,task.answerHtml].join('\n')).digest('hex');
   if(assets[task.id]?.answerImages&&assets[task.id].renderedHtmlSha256===signature&&!process.argv.includes('--force'))continue;
   const rendered={renderedHtmlSha256:signature};
   for(const [source,target] of [['promptHtml','printImages'],['solutionHtml','solutionImages'],['answerHtml','answerImages']]){
    if(!task[source])continue;
    await page.setContent('<!doctype html><html lang="ru"><meta charset="utf-8"><style>'+css+'</style><body><main id="capture">'+task[source]+'</main></body></html>');
    await page.locator('#capture img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    const png=await page.locator('#capture').screenshot({animations:'disabled'});
    try{rendered[target]=await tiles(png);}catch(error){throw Error(task.id+' '+source+': '+error.message);}
   }
   assets[task.id]=rendered;
   if((i+1)%8===0){writeJSON(cachePath,assets);console.log(JSON.stringify({rendered:Object.keys(assets).length,total:bank.tasks.length}));}
  }
  writeJSON(cachePath,assets);
  if(bank.tasks.length===200||!process.argv.includes('--watch'))break;
  await new Promise(resolve=>setTimeout(resolve,3000));
  }
  bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));
  for(const task of bank.tasks){
   const signature=createHash('sha256').update([task.promptHtml,task.solutionHtml,task.answerHtml].join('\n')).digest('hex');
   if(assets[task.id]?.renderedHtmlSha256===signature)Object.assign(task,assets[task.id]);
   else throw Error('Missing current rasterization: '+task.id);
  }
  writeJSON(bankPath,bank);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
