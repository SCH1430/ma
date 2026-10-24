// Read the deployed page in browser order. Never fetch remote code during checks.
const fs=require('fs'),path=require('path'),vm=require('vm');
const DEFAULT_ROOT=path.resolve(__dirname,'..');
const DATA_NAMES=['BANK','EXAM_BANK','BANK_STATS','COMPETENCY_DATA','EXAM_DIFFICULTY_DATA','FONT_BASE64'];
const cache=new Map();
function attributes(text){
 const result={};
 for(const match of text.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))result[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';
 return result;
}
function loadPage(root=DEFAULT_ROOT){
 root=path.resolve(root);if(cache.has(root))return cache.get(root);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 function localFile(reference){
  if(!reference||/[?#\\]/.test(reference)||/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(reference))throw Error('Expected a relative local asset: '+reference);
  const file=path.resolve(root,decodeURIComponent(reference));
  if(!file.startsWith(root+path.sep))throw Error('Asset leaves the project folder: '+reference);
  if(!fs.statSync(file).isFile())throw Error('Missing asset: '+reference);
  if(!fs.realpathSync(file).startsWith(fs.realpathSync(root)+path.sep))throw Error('Asset symlink leaves the project folder: '+reference);
  return file;
 }
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map(match=>{
  const attrs=attributes(match[1]),file=attrs.src?localFile(attrs.src):null;
  return {attrs,file,reference:attrs.src||null,inline:match[2],code:file?fs.readFileSync(file,'utf8'):match[2],vendor:attrs.id?.startsWith('vendor-')||false};
 });
 const styles=[...html.matchAll(/<link\b([^>]*)>/gi)].map(match=>attributes(match[1])).filter(attrs=>attrs.rel==='stylesheet').map(attrs=>({attrs,file:localFile(attrs.href)}));
 const runtime=scripts.filter(script=>!script.vendor&&!script.reference?.startsWith('data/'));
 function sourceFor(reference){const script=scripts.find(script=>script.reference===reference);if(!script)throw Error('Deployed script is not referenced: '+reference);return script.code;}
 let data;
 const page={root,html,scripts,styles,localFile,sourceFor,
  runtimeCode({exclude=[]}={}){return runtime.filter(script=>!exclude.includes(script.reference)).map(script=>script.code).join('\n');},
  vendor(name){const script=scripts.find(script=>script.attrs.id==='vendor-'+name);if(!script?.file)throw Error('Missing deployed vendor: '+name);return require(script.file);},
  dataValues(){
   if(!data){const context=vm.createContext({});for(const script of scripts.filter(script=>script.reference?.startsWith('data/')))vm.runInContext(script.code,context,{filename:script.file});data=JSON.parse(vm.runInContext('JSON.stringify({'+DATA_NAMES.join(',')+'})',context));}
   return data;
  },
  execute(context){for(const script of scripts)vm.runInContext(script.code,context,{filename:script.file||'index.html:inline'});}
 };
 cache.set(root,page);return page;
}
module.exports={loadPage,DATA_NAMES};
