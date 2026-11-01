// Derive the public inventory from exactly the data shipped to the browser.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),page=require('./load_page.cjs').loadPage(root),d=page.dataValues();
const context=vm.createContext({});vm.runInContext(page.sourceFor('src/learning-content.js'),context);
const learning=context.MathLearningContent.tasks.length;
const counts={classes:d.BANK.reduce((n,t)=>n+t.tasks.length,0),exams:d.EXAM_BANK.reduce((n,e)=>n+e.tasks.reduce((m,q)=>m+(q.examples?.length||1),0),0),source:d.SDAMGIA_BANK.tasks.length,thinking:d.THINKING_BANK.tasks.length,quality:d.QUALITY_BANK.tasks.length,methods:d.METHOD_BANK.tasks.length,learning};
const total=Object.values(counts).reduce((a,b)=>a+b,0),format=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const block=`<!-- bank-counts:start -->
В актуальном конструкторе **${format(total)} заданий**. Состав рассчитывается из
данных сборки командой \`node scripts/update_readme.cjs --write\` и проверяется в CI.

| Источник | Заданий |
| --- | ---: |
| Авторские задания по классам | ${format(counts.classes)} |
| Примеры ФИПИ (${[...new Set(d.EXAM_BANK.map(e=>e.year))].sort().join(', ')}) | ${format(counts.exams)} |
| Решу ЕГЭ / ОГЭ | ${format(counts.source)} |
| Задания на понимание | ${format(counts.thinking)} |
| Тематические пакеты | ${format(counts.quality)} |
| Практика мини-уроков и проектов | ${format(counts.learning)} |
| Способы и понимание | ${format(counts.methods)} |
<!-- bank-counts:end -->`;
const file=path.join(root,'README.md'),readme=fs.readFileSync(file,'utf8'),pattern=/<!-- bank-counts:start -->[\s\S]*?<!-- bank-counts:end -->/;
const next=pattern.test(readme)?readme.replace(pattern,block):readme.replace(/^(# [^\r\n]+)\r?\n/,'$1\n\n'+block+'\n');
if(process.argv.includes('--write')){fs.writeFileSync(file,next);console.log('README inventory updated:',counts,'total',total);}
else if(readme!==next){console.error('README inventory is stale. Run node scripts/update_readme.cjs --write');process.exitCode=1;}
else console.log('README inventory matches the distributed banks:',total);
module.exports={counts,total};
