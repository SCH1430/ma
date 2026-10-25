// Verify the exact Pages artifact, including execution below a repository subpath.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadPage}=require('./load_page.cjs');
const {createHarness}=require('./validate_ui_state.cjs');
const root=path.resolve(__dirname,'../_site'),page=loadPage(root);
(async()=>{
 assert(fs.existsSync(path.join(root,'.nojekyll')));
 const base=new URL('https://example.invalid/baza-math/');
 for(const asset of [...page.scripts.filter(s=>s.reference).map(s=>s.reference),...page.styles.map(s=>s.attrs.href)]){
  assert.equal(new URL(asset,base).origin,base.origin);
  assert(new URL(asset,base).pathname.startsWith(base.pathname),asset+' must remain inside the repository subpath');
 }
 assert(!fs.existsSync(path.join(root,'src/tasks')),'authoring sources are excluded');
 const data=page.dataValues();
 assert.equal(data.BANK.reduce((n,t)=>n+t.tasks.length,0),7488);
 const h=createHarness(new Map(),{builtPage:true,pageRoot:root});
 await h.click('[data-role="teacher"]');await h.click('[data-action="builder-home"]');
 await h.change('#source-filter','class:11:advanced');
 await h.input('#bank-search','11-13-8001');
 assert.equal(h.document.querySelectorAll('.bank-task').length,1);
 await h.click('[data-action="add"][data-id="11-13-8001"]');
 assert(h.state().works.find(([key])=>key==='unified')[1].ids.includes('11-13-8001'));
 await h.click('[data-action="print-preview"]');
 assert(h.text().includes('Пуассона'));
 console.log('Pages artifact: relative assets, 7488 class tasks, new-task selection and print preview passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
