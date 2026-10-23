const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fontkit=require(path.join(root,'src/vendor/fontkit.umd.min.js'));
const font=fontkit.create(fs.readFileSync(path.join(root,'src/vendor/DejaVuSans.ttf'))),supported=new Set(font.characterSet);
const bank=JSON.parse(fs.readFileSync(path.join(root,'checks/bank.json'),'utf8'));
const missing=new Map(),all=new Set();
for(const t of bank)for(const q of t.tasks){
 const values=[q.prompt,q.solution,q.display,...(q.figure?.elements||[]).filter(e=>e.type==='text').map(e=>e.text)];
 for(const value of values)for(const char of String(value)){
  all.add(char);if(char.trim()&&!supported.has(char.codePointAt(0))){if(!missing.has(char))missing.set(char,[]);missing.get(char).push(q.id);}
 }
}
const report={unique_characters:all.size,missing:Object.fromEntries(missing)};
fs.writeFileSync(path.join(root,'checks/font-results.json'),JSON.stringify(report,null,2));console.log(report);if(missing.size)process.exitCode=1;
