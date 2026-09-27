(() => {
  const A = state.align = state.align || {};
  Object.assign(A,{
    refId:A.refId||null,
    targetId:A.targetId||null,
    linked:A.linked instanceof Set?A.linked:new Set(),
    ox:Number.isFinite(A.ox)?A.ox:0,
    oy:Number.isFinite(A.oy)?A.oy:0,
    sx:Number.isFinite(A.sx)?A.sx:1,
    sy:Number.isFinite(A.sy)?A.sy:1,
    lockAspect:A.lockAspect!==false,
    viewZoom:Number.isFinite(A.viewZoom)?A.viewZoom:1,
    viewX:Number.isFinite(A.viewX)?A.viewX:0,
    viewY:Number.isFinite(A.viewY)?A.viewY:0,
    pickMode:A.pickMode||null,
    points:A.points||{refA:null,refB:null,targetA:null,targetB:null},
    touchMode:A.touchMode||'move',
    brushColor:A.brushColor||'#ffffff',
    brushSize:Number.isFinite(A.brushSize)?A.brushSize:8,
    edits:A.edits instanceof Map?A.edits:new Map(),
    history:A.history instanceof Map?A.history:new Map(),
    overwriteIds:null
  });

  const getAsset=id=>state.assets.find(a=>a.id===id)||null;
  const refAsset=()=>getAsset(A.refId);
  const targetAsset=()=>getAsset(A.targetId);
  const num=(id,fallback=0)=>{const v=+$(id).value;return Number.isFinite(v)?v:fallback};
  const drawable=asset=>asset?(A.edits.get(asset.id)||asset.img):null;

  function setStatus(msg){const el=$('alignStatus');if(el)el.textContent=msg}

  function syncTransformInputs(){
    $('alignX').value=+(A.ox.toFixed(3));
    $('alignY').value=+(A.oy.toFixed(3));
    $('alignScaleX').value=+(A.sx*100).toFixed(3);
    $('alignScaleY').value=+(A.sy*100).toFixed(3);
    $('alignLockAspect').checked=A.lockAspect;
    updateTransformSummary();
  }

  function updateTransformSummary(){
    const ref=refAsset(),target=targetAsset();
    if(!ref||!target){$('alignTransformSummary').textContent='Choose a reference and target asset.';return}
    $('alignTransformSummary').innerHTML=
      '<b>Reference canvas:</b> '+ref.w+' × '+ref.h+'px<br>'+
      '<b>Target source:</b> '+target.w+' × '+target.h+'px<br>'+
      '<b>Shift:</b> '+A.ox.toFixed(2)+', '+A.oy.toFixed(2)+'px<br>'+
      '<b>Scale:</b> '+(A.sx*100).toFixed(3)+'%, '+(A.sy*100).toFixed(3)+'%'+
      (A.edits.has(target.id)?'<br><b>Touch-ups:</b> active':'');
  }

  function transformFor(asset){
    const ref=refAsset();
    if(!ref||!asset)return null;
    const dw=asset.w*A.sx,dh=asset.h*A.sy;
    return {x:ref.w*.5+A.ox-dw*.5,y:ref.h*.5+A.oy-dh*.5,w:dw,h:dh};
  }

  function sourceToCanvas(pt,asset=targetAsset()){
    const t=transformFor(asset);
    if(!pt||!t)return null;
    return {x:t.x+pt.x*A.sx,y:t.y+pt.y*A.sy};
  }

  function canvasToTarget(x,y){
    const target=targetAsset(),t=transformFor(target);
    if(!target||!t||!A.sx||!A.sy)return null;
    return {x:(x-t.x)/A.sx,y:(y-t.y)/A.sy};
  }

  function drawMarker(ctx,pt,color,label){
    if(!pt)return;
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;
    ctx.lineWidth=Math.max(1,2/Math.max(.25,A.viewZoom));
    const rr=10;
    ctx.beginPath();ctx.moveTo(pt.x-rr,pt.y);ctx.lineTo(pt.x+rr,pt.y);ctx.moveTo(pt.x,pt.y-rr);ctx.lineTo(pt.x,pt.y+rr);ctx.stroke();
    ctx.beginPath();ctx.arc(pt.x,pt.y,3.5,0,Math.PI*2);ctx.fill();
    ctx.font='14px ui-sans-serif,system-ui,sans-serif';ctx.fillText(label,pt.x+8,pt.y-8);ctx.restore();
  }

  function previewAssets(){
    const ids=new Set([A.refId,A.targetId]);
    if($('alignShowLinked')?.checked)for(const id of A.linked)ids.add(id);
    return state.assets.filter(a=>ids.has(a.id));
  }

  function renderAlign(){
    const c=$('alignCanvas');if(!c)return;
    const ctx=c.getContext('2d'),ref=refAsset(),target=targetAsset();
    if(!ref){
      c.width=1;c.height=1;ctx.clearRect(0,0,1,1);$('alignMetrics').innerHTML='';updateTransformSummary();return;
    }

    c.width=ref.w;c.height=ref.h;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.imageSmoothingEnabled=!$('alignPixel').checked;

    if($('alignBackgroundEnabled')?.checked){
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      ctx.fillStyle=$('alignBackgroundColor').value||'#ff00ff';ctx.fillRect(0,0,c.width,c.height);ctx.restore();
    }

    // Stack every active preview layer in the exact order shown in Assets.
    for(const asset of previewAssets()){
      const isRef=asset.id===A.refId;
      const source=drawable(asset);
      if(!source)continue;
      ctx.save();
      ctx.imageSmoothingEnabled=!$('alignPixel').checked;
      ctx.globalAlpha=isRef?num('alignRefOpacity',55)/100:num('alignTargetOpacity',75)/100;
      ctx.globalCompositeOperation=isRef?'source-over':($('alignBlend').value||'source-over');
      if(isRef)ctx.drawImage(source,0,0,asset.w,asset.h);
      else{
        const t=transformFor(asset);
        if(t)ctx.drawImage(source,t.x,t.y,t.w,t.h);
      }
      ctx.restore();
    }

    const p=A.points;
    drawMarker(ctx,p.refA,'#38bdf8','RA');
    drawMarker(ctx,p.refB,'#38bdf8','RB');
    drawMarker(ctx,sourceToCanvas(p.targetA),'#fb7185','TA');
    drawMarker(ctx,sourceToCanvas(p.targetB),'#fb7185','TB');

    ctx.save();ctx.strokeStyle='rgba(255,255,255,.22)';ctx.setLineDash([8,8]);ctx.beginPath();
    ctx.moveTo(ref.w/2,0);ctx.lineTo(ref.w/2,ref.h);ctx.moveTo(0,ref.h/2);ctx.lineTo(ref.w,ref.h/2);ctx.stroke();ctx.restore();

    $('alignRefOpacityLabel').textContent=$('alignRefOpacity').value+'%';
    $('alignMetrics').innerHTML=
      '<div class="metric"><b>'+ref.w+'×'+ref.h+'</b><span>output canvas</span></div>'+
      (target?'<div class="metric"><b>'+(A.sx*100).toFixed(2)+'%</b><span>target scale</span></div>'+
      '<div class="metric"><b>'+A.ox.toFixed(1)+', '+A.oy.toFixed(1)+'</b><span>shift px</span></div>':'')+
      '<div class="metric"><b>'+previewAssets().length+'</b><span>preview layers</span></div>';
    applyAlignView();updateTransformSummary();updatePointInfo();
  }

  function applyAlignView(){
    const c=$('alignCanvas');if(!c)return;
    c.style.width=Math.max(1,c.width*A.viewZoom)+'px';c.style.height=Math.max(1,c.height*A.viewZoom)+'px';
    c.style.transform='translate(calc(-50% + '+A.viewX+'px),calc(-50% + '+A.viewY+'px))';
    $('alignZoom').value=Math.max(5,Math.min(800,A.viewZoom*100));$('alignZoomLabel').textContent=Math.round(A.viewZoom*100)+'%';
    $('alignToolbarZoom').textContent=Math.round(A.viewZoom*100)+'%';
  }

  function zoomAt(zoom,clientX,clientY){
    const c=$('alignCanvas'),vp=$('alignViewport');if(!refAsset()||!c||!vp)return;
    const next=Math.max(.05,Math.min(8,zoom)),cr=c.getBoundingClientRect(),vr=vp.getBoundingClientRect();
    const px=(clientX-cr.left)/A.viewZoom,py=(clientY-cr.top)/A.viewZoom;
    A.viewZoom=next;
    A.viewX=clientX-(vr.left+vr.width/2)-(px-c.width/2)*next;
    A.viewY=clientY-(vr.top+vr.height/2)-(py-c.height/2)*next;
    applyAlignView();
  }
  function zoomCentre(factor){const r=$('alignViewport').getBoundingClientRect();zoomAt(A.viewZoom*factor,r.left+r.width/2,r.top+r.height/2)}
  function fitAlign(){
    const ref=refAsset(),vp=$('alignViewport');if(!ref||!vp)return;
    const rr=vp.getBoundingClientRect(),pad=36;if(rr.width<10||rr.height<10)return;
    A.viewZoom=Math.max(.05,Math.min(8,(rr.width-pad)/ref.w,(rr.height-pad)/ref.h));A.viewX=0;A.viewY=0;applyAlignView();
  }

  function syncAssetSelectors(){
    const refSel=$('alignReference'),targetSel=$('alignTarget');if(!refSel||!targetSel)return;
    const prevRef=A.refId,prevTarget=A.targetId;
    const options=state.assets.map((a,i)=>'<option value="'+a.id+'">'+(i+1)+' · '+esc(a.name)+' ('+a.w+'×'+a.h+')</option>').join('');
    refSel.innerHTML=options||'<option value="">Load assets first</option>';
    targetSel.innerHTML=options||'<option value="">Load assets first</option>';
    if(state.assets.length){
      A.refId=state.assets.some(a=>a.id===prevRef)?prevRef:state.assets[0].id;
      A.targetId=state.assets.some(a=>a.id===prevTarget)?prevTarget:(state.assets[1]?.id||state.assets[0].id);
      refSel.value=A.refId;targetSel.value=A.targetId;
    }else A.refId=A.targetId=null;
    renderLinkedList();renderAlign();
  }

  function renderLinkedList(){
    const el=$('alignLinked');if(!el)return;
    if(!state.assets.length){el.innerHTML='<div class="status">Load assets in the Assets tab first.</div>';return}
    const valid=new Set(state.assets.map(a=>a.id));
    A.linked=new Set([...A.linked].filter(id=>valid.has(id)&&id!==A.refId&&id!==A.targetId));
    el.innerHTML=state.assets.filter(a=>a.id!==A.refId&&a.id!==A.targetId).map(a=>
      '<label class="align-linked-item"><input type="checkbox" value="'+a.id+'" '+(A.linked.has(a.id)?'checked':'')+'> <span>'+esc(a.name)+'</span><small>'+a.w+'×'+a.h+'</small></label>'
    ).join('')||'<div class="status">No additional assets available.</div>';
    el.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.onchange=()=>{
      if(cb.checked)A.linked.add(cb.value);else A.linked.delete(cb.value);renderAlign();
    });
  }

  function resetTransform(){
    A.ox=0;A.oy=0;A.sx=1;A.sy=1;syncTransformInputs();renderAlign();setStatus('Transform reset.');
  }
  function nudge(dx,dy){
    const step=Math.max(.1,num('alignNudge',1));A.ox+=dx*step;A.oy+=dy*step;syncTransformInputs();renderAlign();
  }

  function updatePointInfo(){
    const p=A.points,fmt=q=>q?q.x.toFixed(1)+', '+q.y.toFixed(1):'—';
    $('alignPointInfo').innerHTML='Reference A: <code>'+fmt(p.refA)+'</code><br>Reference B: <code>'+fmt(p.refB)+'</code><br>Target A: <code>'+fmt(p.targetA)+'</code><br>Target B: <code>'+fmt(p.targetB)+'</code>';
  }
  function beginPick(mode){
    A.pickMode=mode;setTouchMode('move',false);
    setStatus('Click the preview to set '+mode.replace('ref','Reference ').replace('target','Target ')+'.');
    document.querySelectorAll('[data-align-pick]').forEach(b=>b.classList.toggle('active',b.dataset.alignPick===mode));
  }
  function clearPoints(){
    A.points={refA:null,refB:null,targetA:null,targetB:null};A.pickMode=null;
    document.querySelectorAll('[data-align-pick]').forEach(b=>b.classList.remove('active'));renderAlign();setStatus('Alignment points cleared.');
  }
  function matchTwoPoints(){
    const p=A.points,ref=refAsset(),target=targetAsset();
    if(!ref||!target||!p.refA||!p.refB||!p.targetA||!p.targetB)return setStatus('Set all four points first.');
    const dr=Math.hypot(p.refB.x-p.refA.x,p.refB.y-p.refA.y),dt=Math.hypot(p.targetB.x-p.targetA.x,p.targetB.y-p.targetA.y);
    if(dt<.001||dr<.001)return setStatus('The two points must be separated.');
    const scale=dr/dt;A.sx=scale;A.sy=scale;
    const rm={x:(p.refA.x+p.refB.x)/2,y:(p.refA.y+p.refB.y)/2},tm={x:(p.targetA.x+p.targetB.x)/2,y:(p.targetA.y+p.targetB.y)/2};
    A.ox=rm.x-ref.w/2-(tm.x-target.w/2)*scale;A.oy=rm.y-ref.h/2-(tm.y-target.h/2)*scale;
    syncTransformInputs();renderAlign();setStatus('Two-point match applied. Fine-tune with drag or arrow nudges.');
  }

  // --- Touch-up editing ----------------------------------------------------
  function ensureEditCanvas(asset){
    if(!asset)return null;
    let edit=A.edits.get(asset.id);
    if(edit&&edit.width===asset.w&&edit.height===asset.h)return edit;
    edit=document.createElement('canvas');edit.width=asset.w;edit.height=asset.h;
    edit.getContext('2d').drawImage(asset.img,0,0,asset.w,asset.h);
    A.edits.set(asset.id,edit);return edit;
  }
  function pushHistory(asset){
    const edit=ensureEditCanvas(asset);if(!edit)return;
    const copy=document.createElement('canvas');copy.width=edit.width;copy.height=edit.height;copy.getContext('2d').drawImage(edit,0,0);
    const stack=A.history.get(asset.id)||[];stack.push(copy);while(stack.length>8)stack.shift();A.history.set(asset.id,stack);
  }
  function undoTouch(){
    const target=targetAsset();if(!target)return;
    const stack=A.history.get(target.id)||[],prev=stack.pop();
    if(!prev)return setStatus('No touch-up stroke to undo.');
    const edit=document.createElement('canvas');edit.width=prev.width;edit.height=prev.height;edit.getContext('2d').drawImage(prev,0,0);
    A.edits.set(target.id,edit);renderAlign();setStatus('Last touch-up stroke undone.');
  }
  function clearTouch(){
    const target=targetAsset();if(!target)return;
    A.edits.delete(target.id);A.history.delete(target.id);renderAlign();setStatus('Target touch-ups discarded.');
  }
  function setTouchMode(mode,announce=true){
    A.touchMode=mode;
    document.querySelectorAll('[data-touch-tool]').forEach(b=>b.classList.toggle('active',b.dataset.touchTool===mode));
    $('alignViewport').classList.toggle('pan-mode',mode==='hand');
    $('alignViewport').classList.toggle('paint-mode',['picker','brush','eraser'].includes(mode));
    $('alignHelp').textContent=mode==='hand'?'Drag to pan preview · pinch or scroll to zoom · artwork stays fixed':mode==='move'?'Drag target to align · hold Space to pan · pinch or scroll to zoom':'Touch up target · hold Space to pan · pinch or scroll to zoom';
    if(announce)setStatus(mode==='move'?'Move target active.':mode==='hand'?'Pan preview active — dragging will not move any sprites.':mode==='picker'?'Colour picker active — tap the target artwork.':mode==='brush'?'Brush active — paint directly on the target.':'Eraser active — paint transparency onto the target.');
  }
  function sampleTarget(pt){
    const target=targetAsset();if(!target||!pt)return;
    const src=A.edits.get(target.id)||target.img;
    const cc=document.createElement('canvas');cc.width=target.w;cc.height=target.h;const cx=cc.getContext('2d');cx.drawImage(src,0,0,target.w,target.h);
    const x=Math.floor(pt.x),y=Math.floor(pt.y);
    if(x<0||y<0||x>=target.w||y>=target.h)return setStatus('Tap inside the target artwork to pick a colour.');
    const d=cx.getImageData(x,y,1,1).data;
    if(d[3]===0)return setStatus('That pixel is transparent.');
    const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    A.brushColor=hex;$('alignBrushColor').value=hex;setStatus('Picked '+hex+'. Switch to Brush to paint it.');
  }
  function paintSegment(asset,from,to,erase=false){
    const edit=ensureEditCanvas(asset);if(!edit||!from||!to)return;
    const ec=edit.getContext('2d');ec.save();ec.lineCap='round';ec.lineJoin='round';ec.lineWidth=A.brushSize;
    ec.globalCompositeOperation=erase?'destination-out':'source-over';ec.strokeStyle=A.brushColor;
    ec.beginPath();ec.moveTo(from.x,from.y);ec.lineTo(to.x,to.y);ec.stroke();
    if(Math.abs(from.x-to.x)<.01&&Math.abs(from.y-to.y)<.01){ec.beginPath();ec.arc(to.x,to.y,A.brushSize/2,0,Math.PI*2);erase?ec.fillStyle='rgba(0,0,0,1)':ec.fillStyle=A.brushColor;ec.fill()}
    ec.restore();renderAlign();
  }

  // --- Export / overwrite -------------------------------------------------
  function outputName(asset){
    const suffix=$('alignSuffix').value||'',ext=extOf(asset.name),base=asset.name.slice(0,-ext.length);return base+suffix+'.png';
  }
  function renderExport(asset){
    const ref=refAsset();if(!ref||!asset)return null;
    const c=document.createElement('canvas');c.width=ref.w;c.height=ref.h;const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=!$('alignPixel').checked;
    const t=transformFor(asset),src=drawable(asset);if(t&&src)ctx.drawImage(src,t.x,t.y,t.w,t.h);return c;
  }
  function exportAsset(asset,delay=0){
    const c=renderExport(asset);if(!c)return;
    setTimeout(()=>c.toBlob(blob=>blob&&downloadBlob(blob,outputName(asset)),'image/png'),delay);
  }
  function exportPrimary(){const t=targetAsset();if(!t)return setStatus('Choose a target first.');exportAsset(t);setStatus('Exported target on the exact reference canvas.')}
  function exportGroup(){
    const ids=[A.targetId,...A.linked],assets=ids.map(getAsset).filter(Boolean);
    if(!assets.length)return setStatus('Choose target assets first.');
    assets.forEach((a,i)=>exportAsset(a,i*280));setStatus('Exporting '+assets.length+' aligned PNG'+(assets.length===1?'':'s')+' with one shared transform.');
  }
  function exportJson(){
    const ref=refAsset(),target=targetAsset();if(!ref||!target)return setStatus('Choose reference and target first.');
    const payload={app:'SpriteR Canvas Align',version:2,reference:{name:ref.name,width:ref.w,height:ref.h},target:{name:target.name,width:target.w,height:target.h},transform:{offsetX:A.ox,offsetY:A.oy,scaleX:A.sx,scaleY:A.sy,origin:'canvas-centre'},linked:[...A.linked].map(id=>getAsset(id)?.name).filter(Boolean),points:A.points,touchUps:A.edits.has(target.id)};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),strip(target.name)+'_alignment.json');
  }

  function armOverwrite(ids,label){
    const assets=ids.map(getAsset).filter(Boolean);if(!assets.length)return setStatus('No loaded assets to overwrite.');
    A.overwriteIds=assets.map(a=>a.id);
    $('alignOverwriteConfirmText').textContent=canSaveOriginalPngs(assets.length)&&assets.every(a=>/\.png$/i.test(a.originalName||a.name))?
      'Choose the original '+(assets.length===1?'PNG':'folder')+' to replace '+assets.length+' file'+(assets.length===1?'':'s')+'. The loaded working copies will update too.':
      'Direct replacement is unavailable here. Export '+assets.length+' PNG'+(assets.length===1?'':'s')+' with the original names for you to replace manually?';
    $('alignOverwriteConfirm').hidden=false;setStatus(label+' — confirm below.');
  }
  function cancelOverwrite(){A.overwriteIds=null;$('alignOverwriteConfirm').hidden=true}
  async function confirmOverwrite(){
    const ids=A.overwriteIds?[...A.overwriteIds]:[];if(!ids.length)return cancelOverwrite();
    const jobs=ids.map(id=>{const asset=getAsset(id);return asset?{asset,canvas:renderExport(asset)}:null}).filter(Boolean);
    $('alignOverwriteConfirmBtn').disabled=true;
    try{
      const names=jobs.map(job=>pngNameForAsset(job.asset));
      const handles=jobs.every(job=>/\.png$/i.test(job.asset.originalName||job.asset.name))?await chooseOriginalPngHandles(names):null;
      const files=[];
      for(let i=0;i<jobs.length;i++)files.push({name:names[i],blob:await canvasBlobPng(jobs[i].canvas)});
      const saved=await saveOriginalPngResults(handles,files);
      for(const job of jobs){await replaceAssetFromCanvas(job.asset,job.canvas,false);A.edits.delete(job.asset.id);A.history.delete(job.asset.id)}
      renderAssets();rebuildFrames();A.ox=0;A.oy=0;A.sx=1;A.sy=1;syncTransformInputs();cancelOverwrite();renderAlign();
      setStatus(saved?'Original PNG'+(jobs.length===1?'':'s')+' saved and loaded copies updated.':'PNG'+(jobs.length===1?'':'s')+' downloaded. Replace the originals on your device manually; loaded copies updated.');
    }catch(err){if(err.name==='AbortError')setStatus('Save cancelled. Nothing changed.');else{console.error(err);setStatus(err.message||'Could not save the PNG.')}}
    finally{$('alignOverwriteConfirmBtn').disabled=false}
  }

  // Inputs
  $('alignReference').onchange=()=>{A.refId=$('alignReference').value;A.points.refA=A.points.refB=null;renderLinkedList();renderAlign();requestAnimationFrame(fitAlign)};
  $('alignTarget').onchange=()=>{A.targetId=$('alignTarget').value;A.points.targetA=A.points.targetB=null;renderLinkedList();renderAlign()};
  $('alignX').oninput=()=>{A.ox=num('alignX');renderAlign()};
  $('alignY').oninput=()=>{A.oy=num('alignY');renderAlign()};
  $('alignScaleX').oninput=()=>{A.sx=Math.max(.01,num('alignScaleX',100)/100);if(A.lockAspect){A.sy=A.sx;$('alignScaleY').value=$('alignScaleX').value}renderAlign()};
  $('alignScaleY').oninput=()=>{A.sy=Math.max(.01,num('alignScaleY',100)/100);if(A.lockAspect){A.sx=A.sy;$('alignScaleX').value=$('alignScaleY').value}renderAlign()};
  $('alignLockAspect').onchange=()=>{A.lockAspect=$('alignLockAspect').checked};
  ['alignRefOpacity','alignTargetOpacity','alignBackgroundColor'].forEach(id=>$(id).oninput=renderAlign);
  ['alignBlend','alignPixel','alignShowLinked','alignBackgroundEnabled'].forEach(id=>$(id).onchange=renderAlign);
  $('alignReset').onclick=resetTransform;$('alignCentre').onclick=()=>{A.ox=0;A.oy=0;syncTransformInputs();renderAlign()};
  $('alignUp').onclick=()=>nudge(0,-1);$('alignDown').onclick=()=>nudge(0,1);$('alignLeft').onclick=()=>nudge(-1,0);$('alignRight').onclick=()=>nudge(1,0);
  $('alignQuickUp').onclick=()=>nudge(0,-1);$('alignQuickDown').onclick=()=>nudge(0,1);$('alignQuickLeft').onclick=()=>nudge(-1,0);$('alignQuickRight').onclick=()=>nudge(1,0);
  $('alignMatchPoints').onclick=matchTwoPoints;$('alignClearPoints').onclick=clearPoints;
  $('alignExportPrimary').onclick=exportPrimary;$('alignExportGroup').onclick=exportGroup;$('alignExportJson').onclick=exportJson;
  $('alignZoom').oninput=()=>{const r=$('alignViewport').getBoundingClientRect();zoomAt(num('alignZoom',100)/100,r.left+r.width/2,r.top+r.height/2)};
  $('alignFit').onclick=fitAlign;$('alignToolbarFit').onclick=fitAlign;
  $('alignActual').onclick=()=>{const r=$('alignViewport').getBoundingClientRect();zoomAt(1,r.left+r.width/2,r.top+r.height/2)};
  $('alignResetView').onclick=fitAlign;
  $('alignZoomIn').onclick=()=>zoomCentre(1.25);$('alignZoomOut').onclick=()=>zoomCentre(1/1.25);
  document.querySelectorAll('[data-align-pick]').forEach(b=>b.onclick=()=>beginPick(b.dataset.alignPick));
  document.querySelectorAll('[data-touch-tool]').forEach(b=>b.onclick=()=>setTouchMode(b.dataset.touchTool));
  $('alignBrushColor').oninput=()=>{A.brushColor=$('alignBrushColor').value};
  $('alignBrushSize').oninput=()=>{A.brushSize=num('alignBrushSize',8);$('alignBrushSizeLabel').textContent=A.brushSize+'px'};
  $('alignUndoTouch').onclick=undoTouch;$('alignClearTouch').onclick=clearTouch;
  $('alignOverwritePrimary').onclick=()=>armOverwrite([A.targetId],'Overwrite target');
  $('alignOverwriteGroup').onclick=()=>armOverwrite([A.targetId,...A.linked],'Overwrite target + linked');
  $('alignOverwriteCancel').onclick=cancelOverwrite;$('alignOverwriteConfirmBtn').onclick=confirmOverwrite;
  $('alignReloadOriginals').onclick=()=>{cancelOverwrite();A.edits.clear();A.history.clear();reloadUploadedAssets(true);A.ox=0;A.oy=0;A.sx=1;A.sy=1;syncTransformInputs();renderAlign();setStatus('Uploaded originals reloaded into SpriteR.')};

  // View panning and zooming are separate from the exported target transform.
  const canvas=$('alignCanvas'),viewport=$('alignViewport');
  const pointers=new Map();let dragStart=null,painting=false,lastPaint=null,gesture=null,spacePan=false;
  function canvasPoint(e){
    const rr=canvas.getBoundingClientRect();return{x:(e.clientX-rr.left)*canvas.width/rr.width,y:(e.clientY-rr.top)*canvas.height/rr.height,rect:rr};
  }
  function insideCanvas(e){const r=canvas.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}
  function beginGesture(){
    const [a,b]=[...pointers.values()],r=canvas.getBoundingClientRect();
    const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2;
    gesture={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:A.viewZoom,x:(midX-r.left)/A.viewZoom,y:(midY-r.top)/A.viewZoom};
    if(painting)undoTouch(); // A second finger means a pinch, not a paint stroke.
    dragStart=null;painting=false;lastPaint=null;
  }
  viewport.addEventListener('pointerdown',e=>{
    if(!refAsset())return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    viewport.setPointerCapture?.(e.pointerId);
    if(pointers.size===2){beginGesture();e.preventDefault();return}
    if(pointers.size>2)return;
    const panning=A.touchMode==='hand'||spacePan||e.button===1;
    if(panning){dragStart={kind:'pan',clientX:e.clientX,clientY:e.clientY,x:A.viewX,y:A.viewY};e.preventDefault();return}
    const target=targetAsset();if(!target||!insideCanvas(e))return;
    const cp=canvasPoint(e),x=cp.x,y=cp.y;
    if(A.pickMode){
      if(A.pickMode.startsWith('ref'))A.points[A.pickMode]={x,y};else A.points[A.pickMode]=canvasToTarget(x,y);
      A.pickMode=null;document.querySelectorAll('[data-align-pick]').forEach(b=>b.classList.remove('active'));renderAlign();setStatus('Point set.');return;
    }
    if(A.touchMode==='picker'){sampleTarget(canvasToTarget(x,y));return}
    if(A.touchMode==='brush'||A.touchMode==='eraser'){
      const pt=canvasToTarget(x,y);if(!pt||pt.x<0||pt.y<0||pt.x>target.w||pt.y>target.h)return setStatus('Paint inside the target bounds.');
      pushHistory(target);painting=true;lastPaint=pt;paintSegment(target,pt,pt,A.touchMode==='eraser');e.preventDefault();return;
    }
    dragStart={kind:'target',clientX:e.clientX,clientY:e.clientY,ox:A.ox,oy:A.oy,rect:cp.rect};e.preventDefault();
  });
  viewport.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(gesture&&pointers.size>=2){
      const [a,b]=[...pointers.values()],vr=viewport.getBoundingClientRect();
      const zoom=Math.max(.05,Math.min(8,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));
      A.viewZoom=zoom;A.viewX=(a.x+b.x)/2-(vr.left+vr.width/2)-(gesture.x-canvas.width/2)*zoom;
      A.viewY=(a.y+b.y)/2-(vr.top+vr.height/2)-(gesture.y-canvas.height/2)*zoom;
      applyAlignView();e.preventDefault();return;
    }
    if(dragStart?.kind==='pan'){
      A.viewX=dragStart.x+e.clientX-dragStart.clientX;A.viewY=dragStart.y+e.clientY-dragStart.clientY;
      applyAlignView();e.preventDefault();return;
    }
    if(painting){
      const target=targetAsset(),cp=canvasPoint(e),pt=canvasToTarget(cp.x,cp.y);if(!target||!pt)return;
      paintSegment(target,lastPaint,pt,A.touchMode==='eraser');lastPaint=pt;return;
    }
    if(dragStart?.kind!=='target')return;
    A.ox=dragStart.ox+(e.clientX-dragStart.clientX)*canvas.width/dragStart.rect.width;
    A.oy=dragStart.oy+(e.clientY-dragStart.clientY)*canvas.height/dragStart.rect.height;
    syncTransformInputs();renderAlign();
  });
  const endPointer=e=>{pointers.delete(e.pointerId);if(pointers.size<2)gesture=null;dragStart=null;painting=false;lastPaint=null};
  viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
  viewport.addEventListener('wheel',e=>{if(!refAsset())return;e.preventDefault();zoomAt(A.viewZoom*Math.exp(-e.deltaY*.002),e.clientX,e.clientY)},{passive:false});
  viewport.addEventListener('dblclick',e=>{if(refAsset()){e.preventDefault();zoomAt(A.viewZoom*1.5,e.clientX,e.clientY)}});

  window.addEventListener('keydown',e=>{
    if(!$('alignTab').classList.contains('active'))return;
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.code==='Space'){spacePan=true;viewport.classList.add('pan-mode');e.preventDefault();return}
    if(A.touchMode!=='move')return;
    const step=e.shiftKey?10:(e.altKey?0.25:1);
    if(e.key==='ArrowLeft'){A.ox-=step;e.preventDefault();e.stopImmediatePropagation()}
    else if(e.key==='ArrowRight'){A.ox+=step;e.preventDefault();e.stopImmediatePropagation()}
    else if(e.key==='ArrowUp'){A.oy-=step;e.preventDefault();e.stopImmediatePropagation()}
    else if(e.key==='ArrowDown'){A.oy+=step;e.preventDefault();e.stopImmediatePropagation()}
    else return;
    syncTransformInputs();renderAlign();
  },true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'){spacePan=false;viewport.classList.toggle('pan-mode',A.touchMode==='hand')}});
  window.addEventListener('blur',()=>{spacePan=false;viewport.classList.toggle('pan-mode',A.touchMode==='hand')});

  new MutationObserver(()=>syncAssetSelectors()).observe($('assets'),{childList:true,subtree:true});
  document.querySelector('[data-tab="alignTab"]').addEventListener('click',()=>requestAnimationFrame(()=>{renderAlign();fitAlign()}));
  let lastWindowWidth=window.innerWidth;
  window.addEventListener('resize',()=>{
    const widthChanged=Math.abs(window.innerWidth-lastWindowWidth)>24;
    lastWindowWidth=window.innerWidth;
    if(widthChanged&&$('alignTab').classList.contains('active'))requestAnimationFrame(fitAlign);
  });

  $('alignBrushColor').value=A.brushColor;$('alignBrushSize').value=A.brushSize;$('alignBrushSizeLabel').textContent=A.brushSize+'px';
  setTouchMode(A.touchMode,false);syncTransformInputs();syncAssetSelectors();
})();
