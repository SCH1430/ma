// Offline, keyboard-accessible enlargement shared by every geometry task surface.
globalThis.MathFigureViewer=(()=>{
  const doc=typeof document==='object'?document:null;
  const state={open:false,id:null,view:'original',zoom:100,trigger:null,stage:null};
  let overlay,dialog,canvas,viewport,title,viewGroup,originalButton,sectionButton,zoomOut,zoomIn,zoomStatus,closeButton;
  let background=[],addedScrollLock=false;
  const actionOf=target=>target?.closest?.('[data-figure-viewer-action]');
  const focus=element=>{if(typeof element?.focus==='function')element.focus();};
  const focusables=()=>dialog?Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]')).filter(el=>!el.disabled&&!el.hidden&&el.getAttribute('tabindex')!=='-1'&&!el.closest?.('[hidden]')):[];
  const hasSection=figure=>!!(figure?.views?.section||figure?.section);
  function ensureDialog(){
    if(overlay)return true;
    if(!doc?.body||typeof doc.createElement!=='function'||(typeof doc.body.append!=='function'&&typeof doc.body.appendChild!=='function'))return false;
    overlay=doc.createElement('div');overlay.className='figure-viewer-backdrop';overlay.setAttribute('class','figure-viewer-backdrop');overlay.hidden=true;
    overlay.innerHTML=`<section class="figure-viewer-dialog" role="dialog" aria-modal="true" aria-labelledby="figure-viewer-title" aria-describedby="figure-viewer-help" tabindex="-1">
      <header class="figure-viewer-heading"><h2 id="figure-viewer-title">Чертёж</h2><button type="button" class="figure-viewer-close" data-figure-viewer-action="close" aria-label="Закрыть чертёж">×</button></header>
      <div class="figure-viewer-toolbar">
        <div class="figure-viewer-views" role="group" aria-label="Вид чертежа" hidden><button type="button" data-figure-viewer-action="original" aria-pressed="true">Чертёж</button><button type="button" data-figure-viewer-action="section" aria-pressed="false">Сечение</button></div>
        <div class="figure-viewer-zoom" role="group" aria-label="Масштаб чертежа"><button type="button" data-figure-viewer-action="zoom-out" aria-label="Уменьшить чертёж">−</button><output class="figure-viewer-scale" aria-live="polite" aria-atomic="true">100%</output><button type="button" data-figure-viewer-action="zoom-in" aria-label="Увеличить чертёж">+</button><button type="button" data-figure-viewer-action="reset" aria-label="Сбросить масштаб чертежа до 100 процентов">Сброс</button></div>
      </div>
      <p id="figure-viewer-help" class="figure-viewer-help">Масштаб от 100 до 300%. Перемещайте увеличенный чертёж прокруткой или пальцем. В области чертежа работают стрелки. Escape — закрыть.</p>
      <div class="figure-viewer-viewport" role="region" aria-label="Увеличенный чертёж. Используйте стрелки для перемещения" tabindex="0"><div class="figure-viewer-canvas"></div></div>
    </section>`;
    if(typeof doc.body.append==='function')doc.body.append(overlay);else doc.body.appendChild(overlay);
    dialog=overlay.querySelector('.figure-viewer-dialog');canvas=overlay.querySelector('.figure-viewer-canvas');viewport=overlay.querySelector('.figure-viewer-viewport');title=overlay.querySelector('#figure-viewer-title');viewGroup=overlay.querySelector('.figure-viewer-views');
    originalButton=actionOf(overlay.querySelector('[data-figure-viewer-action="original"]'));sectionButton=overlay.querySelector('[data-figure-viewer-action="section"]');zoomOut=overlay.querySelector('[data-figure-viewer-action="zoom-out"]');zoomIn=overlay.querySelector('[data-figure-viewer-action="zoom-in"]');zoomStatus=overlay.querySelector('.figure-viewer-scale');closeButton=overlay.querySelector('[data-figure-viewer-action="close"]');
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    return !!(dialog&&canvas&&viewport&&closeButton);
  }
  function lockBackground(){
    background=[];
    for(const node of Array.from(doc.body.children||[]))if(node!==overlay&&typeof node.setAttribute==='function'){
      background.push({node,inert:node.hasAttribute('inert'),hidden:node.getAttribute('aria-hidden')});node.setAttribute('inert','');node.setAttribute('aria-hidden','true');
    }
    addedScrollLock=!doc.body.classList?.contains('figure-viewer-open');doc.body.classList?.add('figure-viewer-open');
  }
  function unlockBackground(){
    for(const {node,inert,hidden} of background){if(!inert)node.removeAttribute('inert');if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden);}
    background=[];if(addedScrollLock)doc.body.classList?.remove('figure-viewer-open');addedScrollLock=false;
  }
  function updateZoom(next,center=true){
    if(!state.open)return false;
    const old=state.zoom;state.zoom=Math.max(100,Math.min(300,Math.round(Number(next)||100)));
    const width=viewport.clientWidth||0,height=viewport.clientHeight||0,left=viewport.scrollLeft||0,top=viewport.scrollTop||0,ratio=state.zoom/old;
    canvas.setAttribute('style','width:'+state.zoom+'%;');
    zoomOut.disabled=state.zoom===100;zoomIn.disabled=state.zoom===300;zoomStatus.textContent=state.zoom+'%';zoomStatus.setAttribute('aria-label','Масштаб '+state.zoom+' процентов');
    viewport.scrollLeft=center?Math.max(0,(left+width/2)*ratio-width/2):0;viewport.scrollTop=center?Math.max(0,(top+height/2)*ratio-height/2):0;
    return true;
  }
  function render(){
    const figure=typeof geometryFigure==='function'?geometryFigure(state.id):null;
    if(!figure||typeof figureSVG!=='function')return false;
    const section=hasSection(figure);viewGroup.hidden=!section;if(!section)state.view='original';
    title.textContent=(state.view==='section'?'Сечение':'Чертёж')+' · задание '+state.id;
    originalButton.setAttribute('aria-pressed',String(state.view==='original'));sectionButton.setAttribute('aria-pressed',String(state.view==='section'));
    canvas.innerHTML=figureSVG(state.id,false,{interactive:false,view:state.view,...(Number.isInteger(state.stage)?{stage:state.stage}:{})});updateZoom(state.zoom,false);
    return true;
  }
  function open(options={}){
    const id=typeof options==='string'?options:options?.id;
    if(typeof id!=='string'||typeof geometryFigure!=='function'||!geometryFigure(id)||!ensureDialog())return false;
    const wasOpen=state.open,provided=typeof options==='object'?options.trigger:null;
    if(provided&&!overlay.contains(provided))state.trigger=provided;else if(!wasOpen)state.trigger=doc.activeElement;
    const rawStage=typeof options==='object'?(options.stage??provided?.getAttribute?.('data-figure-stage')):null;state.stage=rawStage!=null&&Number.isInteger(Number(rawStage))?Number(rawStage):null;
    state.open=true;state.id=id;state.view='original';state.zoom=100;overlay.hidden=false;if(!wasOpen)lockBackground();
    if(!render()){close();return false;}focus(closeButton);return true;
  }
  function close(){
    if(!state.open)return false;
    const trigger=state.trigger,id=state.id;state.open=false;state.id=null;state.view='original';state.zoom=100;state.trigger=null;overlay.hidden=true;unlockBackground();
    if(trigger&&doc.body.contains?.(trigger))focus(trigger);
    else{const replacement=Array.from(doc.querySelectorAll?.('[data-action="figure-enlarge"]')||[]).find(el=>el.getAttribute('data-figure-id')===id&&!el.hidden);focus(replacement||doc.querySelector?.('main'));}
    return true;
  }
  function refresh(){if(!state.open)return false;if(!render()){close();return false;}return true;}
  function chooseView(view){
    if(view!=='original'&&view!=='section')return false;
    const f=typeof geometryFigure==='function'?geometryFigure(state.id):null;if(view==='section'&&!hasSection(f))return false;
    state.view=view;state.zoom=100;return render();
  }
  if(typeof doc?.addEventListener==='function'){
    doc.addEventListener('click',event=>{
      const enlarge=event.target?.closest?.('[data-action="figure-enlarge"]');
      if(enlarge){event.preventDefault?.();if(!state.open||!overlay?.contains(enlarge))open({id:enlarge.getAttribute('data-figure-id'),trigger:enlarge});return;}
      if(!state.open)return;const button=actionOf(event.target);if(!button||!dialog.contains(button)||button.disabled)return;
      event.preventDefault?.();const action=button.getAttribute('data-figure-viewer-action');
      if(action==='close')close();else if(action==='zoom-in')updateZoom(state.zoom+25);else if(action==='zoom-out')updateZoom(state.zoom-25);else if(action==='reset')updateZoom(100,false);else if(action==='original'||action==='section')chooseView(action);
    });
    doc.addEventListener('keydown',event=>{
      if(!state.open)return;
      if(event.key==='Escape'){event.preventDefault?.();event.stopPropagation?.();close();return;}
      if(event.key==='Tab'){
        const nodes=focusables(),first=nodes[0]||dialog,last=nodes[nodes.length-1]||dialog,active=doc.activeElement;
        if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault?.();focus(last);}
        else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault?.();focus(first);}
      }
      if(event.target===viewport&&state.zoom>100){const step=event.shiftKey?120:48,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];if(delta){event.preventDefault?.();viewport.scrollLeft=Math.max(0,(viewport.scrollLeft||0)+delta[0]);viewport.scrollTop=Math.max(0,(viewport.scrollTop||0)+delta[1]);}}
    },true);
    doc.addEventListener('focusin',event=>{if(state.open&&!dialog.contains(event.target))focus(closeButton);});
  }
  return Object.freeze({open,close,refresh,getState:()=>({open:state.open,id:state.id,view:state.view,zoom:state.zoom})});
})();
