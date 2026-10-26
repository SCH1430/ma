// Keyboard, focus, section and zoom behavior against the existing offline DOM harness.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/figure-viewer.js'),'utf8');
const {createHarness}=require('./validate_ui_state.cjs');
let checks=0;const test=(value,message)=>{checks++;assert.ok(value,message);};
function bareDocument(){const listeners={};return{body:{},addEventListener(name,handler){(listeners[name]??=[]).push(handler);},listeners};}
for(const document of [undefined,bareDocument()]){
 const minimal=vm.createContext({...(document?{document}:{}),geometryFigure:()=>({width:400,height:240,elements:[]})});vm.runInContext(source,minimal);
 test(typeof minimal.MathFigureViewer.open==='function','viewer loads without a real document');test(!minimal.MathFigureViewer.open({id:'placeholder'}),'missing DOM fails gracefully');
}
(async()=>{
 const h=createHarness(),{context,document}=h;
 if(!context.MathFigureViewer)vm.runInContext(source,context);
 test(!document.querySelector('.figure-viewer-backdrop'),'dialog DOM is lazy');
 const realFigure=context.geometryFigure,realSVG=context.figureSVG;let lastOptions=null;
 const fixtures={withSection:{width:400,height:240,alt:'Тестовый чертёж',elements:[],section:{width:400,height:240,elements:[]}},plain:{width:400,height:240,alt:'Без сечения',elements:[]},views:{width:400,height:240,alt:'Коллекция видов',elements:[],views:{section:{width:400,height:240,elements:[]}}}};
 context.geometryFigure=id=>fixtures[id]||realFigure(id);
 context.figureSVG=(id,compact,options)=>(lastOptions=options,fixtures[id]?`<figure class="math-figure"><svg role="img" aria-label="${options.view}"></svg><figcaption>${options.view}</figcaption></figure>`:realSVG(id,compact,options));
 const api=context.MathFigureViewer,host=document.createElement('div');host.innerHTML='<button type="button" data-action="figure-enlarge" data-figure-id="withSection">Увеличить чертёж</button>';document.body.append(host);
 const trigger=host.querySelector('button'),main=document.querySelector('main');trigger.focus();
 await document.dispatch('click',trigger);
 const overlay=document.querySelector('.figure-viewer-backdrop'),dialog=overlay.querySelector('[role="dialog"]'),close=dialog.querySelector('[data-figure-viewer-action="close"]'),viewport=dialog.querySelector('.figure-viewer-viewport'),canvas=dialog.querySelector('.figure-viewer-canvas');
 const action=name=>dialog.querySelector('[data-figure-viewer-action="'+name+'"]');
 test(api.getState().open&&!overlay.hidden,'delegated launch opens the dialog');test(lastOptions?.interactive===false,'viewer requests a diagram without nested launcher controls');
 test(dialog.getAttribute('aria-modal')==='true'&&dialog.getAttribute('aria-labelledby'),'dialog is named and modal');
 test(document.activeElement===close,'opening moves focus to close control');test(main.hasAttribute('inert')&&main.getAttribute('aria-hidden')==='true','background is inert and hidden from accessibility tree');
 test(!dialog.querySelector('.figure-viewer-views').hidden,'section controls are available');
 await document.dispatch('keydown',close,{key:'Tab',shiftKey:true});test(document.activeElement===viewport,'Shift Tab wraps from first to last focus target');
 await document.dispatch('keydown',viewport,{key:'Tab'});test(document.activeElement===close,'Tab wraps from last to first focus target');
 trigger.focus();await document.dispatch('focusin',trigger);test(document.activeElement===close,'external focus is returned to modal');
 await document.dispatch('click',action('zoom-in'));test(api.getState().zoom===125&&canvas.getAttribute('style').includes('125%'),'zoom enlarges a scrollable canvas');
 await document.dispatch('keydown',viewport,{key:'ArrowRight'});test(viewport.scrollLeft===48,'keyboard pans the enlarged diagram');
 for(let i=0;i<20;i++)await document.dispatch('click',action('zoom-in'));test(api.getState().zoom===300&&action('zoom-in').disabled,'zoom has a 300 percent upper bound');
 await document.dispatch('click',action('section'));test(api.getState().view==='section'&&api.getState().zoom===100,'section switch resets the zoom');
 test(action('section').getAttribute('aria-pressed')==='true'&&canvas.innerHTML.includes('section'),'selected section is rendered and announced');
 await document.dispatch('click',action('original'));test(api.getState().view==='original','original drawing remains available');
 for(let i=0;i<20;i++)await document.dispatch('click',action('zoom-out'));test(api.getState().zoom===100&&action('zoom-out').disabled,'zoom has a 100 percent lower bound');
 await document.dispatch('click',viewport);test(api.getState().open,'clicking diagram content keeps dialog open');
 await document.dispatch('keydown',viewport,{key:'Escape'});test(!api.getState().open&&overlay.hidden,'Escape closes dialog');test(document.activeElement===trigger,'Escape restores launching focus');
 test(!main.hasAttribute('inert')&&!main.hasAttribute('aria-hidden')&&!document.body.classList.contains('figure-viewer-open'),'close restores background and scroll state');
 main.setAttribute('inert','');main.setAttribute('aria-hidden','false');api.open({id:'plain',trigger});
 test(dialog.querySelector('.figure-viewer-views').hidden,'tasks without a section have no unavailable section control');
 await document.dispatch('click',overlay);test(!api.getState().open,'only backdrop click closes the modal');test(main.hasAttribute('inert')&&main.getAttribute('aria-hidden')==='false','previous background attributes are restored');main.removeAttribute('inert');main.removeAttribute('aria-hidden');
 test(!api.open({id:'missing'}),'unknown task does not open empty dialog');
 test(api.open({id:'views',trigger})&&!dialog.querySelector('.figure-viewer-views').hidden,'views.section metadata also enables switching');
 test(api.refresh(),'refresh redraws open viewer');api.close();
 api.open({id:'withSection',trigger});trigger.remove();const replacement=document.createElement('button');replacement.setAttribute('data-action','figure-enlarge');replacement.setAttribute('data-figure-id','withSection');host.append(replacement);api.close();test(document.activeElement===replacement,'removed trigger is replaced by matching current launcher');
 test(!api.close()&&!api.refresh(),'closed viewer operations are idempotent');
 test(h.networkCalls()===0,'opening and zooming remain offline');
 const css=fs.readFileSync(path.join(root,'src/figure-viewer.css'),'utf8');test(/@media print[\s\S]*display:none !important/.test(css),'modal and controls are omitted from printing');test(/touch-action:pan-x pan-y pinch-zoom/.test(css),'touch scrolling preserves browser pinch zoom');
 const report={checks,errors:[]};fs.writeFileSync(path.join(root,'checks/figure-viewer-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
