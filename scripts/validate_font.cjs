const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root);
const fontkit=page.vendor('fontkit'),{BANK:bank,FONT_BASE64}=page.dataValues();
const font=fontkit.create(Buffer.from(FONT_BASE64,'base64')),supported=new Set(font.characterSet);
const missing=new Map(),all=new Set();
for(const t of bank)for(const q of t.tasks){
 const values=[q.prompt,q.solution,q.display,...(q.figure?.elements||[]).filter(e=>e.type==='text').map(e=>e.text)];
 for(const value of values)for(const char of String(value)){
  all.add(char);if(char.trim()&&!supported.has(char.codePointAt(0))){if(!missing.has(char))missing.set(char,[]);missing.get(char).push(q.id);}
 }
}
const report={unique_characters:all.size,missing:Object.fromEntries(missing)};
fs.writeFileSync(path.join(root,'checks/font-results.json'),JSON.stringify(report,null,2));console.log(report);if(missing.size)process.exitCode=1;
