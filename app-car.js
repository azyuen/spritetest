(() => {
  'use strict';
  // Car Asset Studio uses a single bottom-right registered world space. The BODY
  // and PAINT remain source-resolution images until export: no repeated resampling.
  const C={
    refs:{ae86:null,r32:null},body:null,paint:null,paintCanvas:null,
    paintAlign:{dx:0,dy:0,sx:1,sy:1},locked:false,
    x:0,y:0,s:1,w:1166,h:420,tool:'move',
    wheel:{rear:{image:null,x:0,y:0,r:38,placed:false},front:{image:null,x:0,y:0,r:38,placed:false}},
    zoom:1,panX:0,panY:0,history:[],redo:[],drag:null,gesture:null,
    pointers:new Map(),spacePan:false,painting:false,lastPt:null,referenceDims:{ae86:{length:0,height:0},r32:{length:0,height:0}}
  };
  const by=id=>document.getElementById(id);
  const view=by('carViewport'),surface=by('carCanvas');
  if(!view||!surface)return;
  const context=surface.getContext('2d');
  const number=(id,fallback=0)=>{const n=+by(id).value;return Number.isFinite(n)?n:fallback};
  const constrain=(n,a,b)=>Math.max(a,Math.min(b,n));
  const round=n=>Math.round(n*100)/100;
  const status=s=>{by('carStatus').textContent=s;};
  const baseName=()=>String(by('carId').value||'new_car').trim().replace(/[^a-z0-9_-]/gi,'_').slice(0,64)||'new_car';
  const activeRefKey=()=>by('carReference').value==='r32'?'r32':'ae86';
  const activeRef=()=>C.refs[activeRefKey()]||C.refs.ae86||C.refs.r32;
  const paintRect=()=>C.paint?{x:C.x+C.paintAlign.dx*C.s,y:C.y+C.paintAlign.dy*C.s,w:C.paint.w*C.paintAlign.sx*C.s,h:C.paint.h*C.paintAlign.sy*C.s}:null;
  const bodyRect=()=>C.body?{x:C.x,y:C.y,w:C.body.w*C.s,h:C.body.h*C.s}:null;
  const wnames=['rear','front'];

  function assetFromFile(file){
    if(!file)return Promise.resolve(null);
    if(!/^image\/(png|webp|jpeg)$/.test(file.type))return Promise.reject(new Error('Choose a PNG or WebP sprite.'));
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve({img,file,name:file.name,w:img.naturalWidth,h:img.naturalHeight,bounds:null})};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read '+file.name))};
      img.src=url;
    });
  }
  function alphaBounds(asset){
    if(!asset)return null;
    if(asset.bounds)return asset.bounds;
    const sample=document.createElement('canvas'),f=Math.min(1,900/Math.max(asset.w,asset.h));
    sample.width=Math.max(1,Math.ceil(asset.w*f));sample.height=Math.max(1,Math.ceil(asset.h*f));
    const ctx=sample.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(asset.img,0,0,sample.width,sample.height);
    const data=ctx.getImageData(0,0,sample.width,sample.height).data;
    let x0=sample.width,y0=sample.height,x1=-1,y1=-1;
    for(let y=0;y<sample.height;y++)for(let x=0;x<sample.width;x++){
      if(data[(y*sample.width+x)*4+3]<25)continue;
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    asset.bounds=x1<0?{x:0,y:0,w:asset.w,h:asset.h}:{x:x0*asset.w/sample.width,y:y0*asset.h/sample.height,w:(x1-x0+1)*asset.w/sample.width,h:(y1-y0+1)*asset.h/sample.height};
    return asset.bounds;
  }
  function referenceRect(asset){return{x:C.w-asset.w,y:C.h-asset.h,w:asset.w,h:asset.h};}
  function refRightBottom(){
    const ref=activeRef();if(!ref)return{x:C.w,y:C.h};
    const bounds=alphaBounds(ref),rect=referenceRect(ref);
    return{x:rect.x+bounds.x+bounds.w,y:rect.y+bounds.y+bounds.h};
  }
  function moveCar(x,y,s){
    if(!C.body)return;
    s=constrain(s,.01,10);
    const oldX=C.x,oldY=C.y,oldS=C.s;
    for(const k of wnames){const wheel=C.wheel[k];if(wheel.placed){wheel.x=x+(wheel.x-oldX)*s/oldS;wheel.y=y+(wheel.y-oldY)*s/oldS;wheel.r*=s/oldS;}}
    C.x=x;C.y=y;C.s=s;syncCarControls();syncWheels();draw();
  }
  function syncCarControls(){
    by('carX').value=round(C.x);
    by('carY').value=round(C.y);
    by('carScale').value=round(C.s*100);
  }
  function syncPaintControls(){
    by('carPaintX').value=round(C.paintAlign.dx);by('carPaintY').value=round(C.paintAlign.dy);
    by('carPaintSX').value=round(C.paintAlign.sx*100);by('carPaintSY').value=round(C.paintAlign.sy*100);
    by('carLayersLocked').checked=C.locked;
    for(const id of ['carPaintX','carPaintY','carPaintSX','carPaintSY','carResetPaint'])by(id).disabled=C.locked;
    by('carLockPair').textContent=C.locked?'Unlock to realign paint':'Align complete · lock pair';
  }
  function syncWheels(){
    for(const k of wnames){
      const p=k==='rear'?'carRear':'carFront',wheel=C.wheel[k];
      by(p+'X').value=wheel.placed?round(wheel.x):'';
      by(p+'Y').value=wheel.placed?round(wheel.y):'';
      by(p+'Radius').value=round(wheel.r);
    }
  }
  async function importAsset(id,kind){
    try{
      const file=by(id).files?.[0];if(!file)return;
      const asset=await assetFromFile(file);
      if(kind==='ae86'||kind==='r32'){
        C.refs[kind]=asset;
        if(kind==='ae86'&&!C.body){changeCanvas(asset.w,asset.h);}
        status((kind==='ae86'?'AE86':'R32')+' reference loaded. Its bottom-right corner is locked.');
      }else if(kind==='body'){
        C.body=asset;
        const s=Math.min(1,C.w/asset.w,C.h/asset.h);
        C.s=s;C.x=C.w-asset.w*s;C.y=C.h-asset.h*s;
        for(const k of wnames)C.wheel[k].placed=false;
        syncCarControls();syncWheels();status('BODY loaded. Import PAINT and align it at full resolution.');
      }else if(kind==='paint'){
        C.paint=asset;C.paintCanvas=document.createElement('canvas');
        C.paintCanvas.width=asset.w;C.paintCanvas.height=asset.h;
        C.paintCanvas.getContext('2d',{willReadFrequently:true}).drawImage(asset.img,0,0);
        C.history=[];C.redo=[];
        C.locked=false;syncPaintControls();
        status('PAINT loaded. Drag in Align paint mode to register over BODY.');
      }else{
        C.wheel[kind].image=asset;
        status((kind==='rear'?'Rear':'Front')+' wheel sprite loaded.');
      }
      updateRatio();draw();requestAnimationFrame(fitView);
    }catch(err){console.error(err);status(err.message||'Import failed.')}
  }
  const viewportSize=()=>({w:view.clientWidth||500,h:view.clientHeight||450});
  function toWorld(clientX,clientY){
    const r=view.getBoundingClientRect();
    return{x:C.w/2+(clientX-r.left-r.width/2-C.panX)/C.zoom,
           y:C.h/2+(clientY-r.top-r.height/2-C.panY)/C.zoom};
  }
  function renderWheel(ctx,key){
    const wheel=C.wheel[key];if(!wheel.placed||!by('carShowWheels').checked)return;
    ctx.save();ctx.lineWidth=Math.max(1.5,2/C.zoom);ctx.strokeStyle=key==='rear'?'#fbbf24':'#c084fc';ctx.fillStyle=ctx.strokeStyle;
    if(wheel.image)ctx.drawImage(wheel.image.img,wheel.x-wheel.r,wheel.y-wheel.r,wheel.r*2,wheel.r*2);
    ctx.beginPath();ctx.arc(wheel.x,wheel.y,wheel.r,0,Math.PI*2);ctx.stroke();
    const arm=8/C.zoom;ctx.beginPath();ctx.moveTo(wheel.x-arm,wheel.y);ctx.lineTo(wheel.x+arm,wheel.y);
    ctx.moveTo(wheel.x,wheel.y-arm);ctx.lineTo(wheel.x,wheel.y+arm);ctx.stroke();
    ctx.font=(13/C.zoom)+'px sans-serif';ctx.fillText(key.toUpperCase(),wheel.x+wheel.r+7/C.zoom,wheel.y);ctx.restore();
  }
  function draw(){
    if(!by('carStudioTab').classList.contains('active'))return;
    const size=viewportSize(),dpr=Math.max(1,Math.min(window.devicePixelRatio||1,3));
    const cw=Math.max(1,Math.round(size.w*dpr)),ch=Math.max(1,Math.round(size.h*dpr));
    if(surface.width!==cw||surface.height!==ch){surface.width=cw;surface.height=ch;}
    context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,size.w,size.h);
    context.translate(size.w/2+C.panX,size.h/2+C.panY);
    context.scale(C.zoom,C.zoom);
    context.translate(-C.w/2,-C.h/2);
    context.save();
    context.fillStyle='rgba(9,14,21,.72)';context.fillRect(0,0,C.w,C.h);
    context.strokeStyle='#7dd3fc';context.lineWidth=Math.max(1/C.zoom,1);
    context.setLineDash([10/C.zoom,7/C.zoom]);context.strokeRect(0,0,C.w,C.h);context.setLineDash([]);
    const chosen=by('carReference').value,opacity=number('carRefOpacity',45)/100;
    const keys=chosen==='both'?['ae86','r32']:chosen==='none'?[]:[chosen];
    for(const key of keys){
      const ref=C.refs[key];if(!ref)continue;const rect=referenceRect(ref);
      context.globalAlpha=opacity;context.drawImage(ref.img,rect.x,rect.y);context.globalAlpha=1;
    }
    const p=paintRect(),b=bodyRect();
    context.imageSmoothingEnabled=!by('carPixel').checked;
    if(p&&by('carShowPaint').checked)context.drawImage(C.paintCanvas,p.x,p.y,p.w,p.h);
    if(b&&by('carShowBody').checked)context.drawImage(C.body.img,b.x,b.y,b.w,b.h);
    context.restore();
    for(const k of wnames)renderWheel(context,k);
    if(b){
      context.save();context.lineWidth=Math.max(1/C.zoom,1.3);context.strokeStyle='rgba(125,211,252,.8)';
      context.setLineDash([6/C.zoom,5/C.zoom]);context.strokeRect(b.x,b.y,b.w,b.h);context.setLineDash([]);
      const z=11/C.zoom;context.fillStyle='#38bdf8';context.fillRect(b.x-z/2,b.y-z/2,z,z);
      context.restore();
    }
    if(C.paint&&!C.locked&&by('carShowPaint').checked&&p){
      context.save();context.strokeStyle='#fb7185';context.lineWidth=1/C.zoom;
      context.setLineDash([5/C.zoom,4/C.zoom]);context.strokeRect(p.x,p.y,p.w,p.h);context.restore();
    }
    const ref=activeRef(),brect=bodyRect();
    const summary='Canvas '+C.w+'×'+C.h+'px · '+(C.locked?'Layers locked':'Layers unlocked')+
      (brect?' · car '+round(brect.w)+'×'+round(brect.h)+'px':'');
    by('carMetrics').innerHTML='<div class="metric"><b>'+C.w+'×'+C.h+'</b><span>output PNG pixels</span></div>'+
      '<div class="metric"><b>'+round(C.s*100)+'%</b><span>pair scale</span></div>'+
      '<div class="metric"><b>'+wnames.filter(k=>C.wheel[k].placed).length+'/2</b><span>wheel centres</span></div>'+
      '<div class="metric"><b>'+(ref?ref.name:'not loaded')+'</b><span>reference</span></div>';
    by('carSummary').textContent=summary+'. Export remains transparent.';
    by('carZoomLabel').textContent=Math.round(C.zoom*100)+'%';
    by('carRefOpacityLabel').textContent=by('carRefOpacity').value+'%';
  }
  function fitView(){
    if(!by('carStudioTab').classList.contains('active'))return;
    const vs=viewportSize(),br=bodyRect(),pr=paintRect();
    const extents=[{x:0,y:0,w:C.w,h:C.h}];
    if(br)extents.push(br);if(pr)extents.push(pr);
    let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
    for(const a of extents){l=Math.min(l,a.x);t=Math.min(t,a.y);r=Math.max(r,a.x+a.w);b=Math.max(b,a.y+a.h);}
    C.zoom=constrain(Math.min((vs.w-56)/Math.max(1,r-l),(vs.h-65)/Math.max(1,b-t)),.04,8);
    C.panX=(C.w-l-r)/2*C.zoom;C.panY=(C.h-t-b)/2*C.zoom;draw();
  }
  function zoomAt(value,clientX,clientY){
    const pt=toWorld(clientX,clientY),r=view.getBoundingClientRect();
    C.zoom=constrain(value,.04,12);
    C.panX=clientX-r.left-r.width/2-(pt.x-C.w/2)*C.zoom;
    C.panY=clientY-r.top-r.height/2-(pt.y-C.h/2)*C.zoom;draw();
  }
  function zoomCenter(factor){
    const r=view.getBoundingClientRect();
    zoomAt(C.zoom*factor,r.left+r.width/2,r.top+r.height/2);
  }
  function changeCanvas(w,h){
    w=constrain(Math.round(w),1,8192);h=constrain(Math.round(h),1,8192);
    const dx=w-C.w,dy=h-C.h;C.x+=dx;C.y+=dy;
    for(const k of wnames)if(C.wheel[k].placed){C.wheel[k].x+=dx;C.wheel[k].y+=dy;}
    C.w=w;C.h=h;
    by('carCanvasW').value=w;by('carCanvasH').value=h;
    syncCarControls();syncWheels();draw();
  }
  function updateRatio(){
    const ref=activeRef(),dim=C.referenceDims[activeRefKey()];
    const rl=number('carRefLength'),rh=number('carRefHeight'),cl=number('carLength'),ch=number('carHeight');
    dim.length=rl;dim.height=rh;
    if(rl>0&&cl>0||rh>0&&ch>0){
      const length=rl&&cl?round(cl/rl*100)+'%':'—';
      const height=rh&&ch?round(ch/rh*100)+'%':'—';
      by('carRatio').innerHTML='Relative length: <b>'+length+'</b> · height: <b>'+height+'</b>'+
        (ref?' · reference art '+round(alphaBounds(ref).w)+'px wide':'');
    }else by('carRatio').textContent='Enter vehicle dimensions for a length/height comparison.';
  }
  function alignNose(){
    if(!C.body)return status('Import BODY first.');
    const corner=refRightBottom(),bounds=alphaBounds(C.body);
    moveCar(corner.x-(bounds.x+bounds.w)*C.s,corner.y-(bounds.y+bounds.h)*C.s,C.s);
    status('Visible nose and ground line aligned to reference.');
  }
  function applyLength(){
    const ref=activeRef(),rl=number('carRefLength'),cl=number('carLength');
    if(!C.body||!ref||!(rl>0&&cl>0))return status('Load BODY/reference and enter both lengths.');
    const rb=alphaBounds(ref),cb=alphaBounds(C.body);
    const s=constrain(rb.w*(cl/rl)/cb.w,.01,10);
    moveCar(C.x,C.y,s);alignNose();
    status('Length-based scale applied. Check height and fine-tune visually.');
  }
  function clonePaint(){return C.paintCanvas?.getContext('2d',{willReadFrequently:true}).getImageData(0,0,C.paintCanvas.width,C.paintCanvas.height)}
  function pushHistory(){
    if(!C.paintCanvas)return;C.history.push(clonePaint());if(C.history.length>12)C.history.shift();C.redo=[];
  }
  function restorePixels(data){C.paintCanvas?.getContext('2d').putImageData(data,0,0);draw();}
  function undo(){
    if(!C.history.length)return;C.redo.push(clonePaint());restorePixels(C.history.pop());
  }
  function redo(){
    if(!C.redo.length)return;C.history.push(clonePaint());restorePixels(C.redo.pop());
  }
  function paintPoint(world){
    const r=paintRect();
    if(!r||!C.paint||!r.w||!r.h)return null;
    return{x:(world.x-r.x)/r.w*C.paint.w,y:(world.y-r.y)/r.h*C.paint.h};
  }
  function paintSegment(a,b,erase=false){
    if(!C.paintCanvas||!a||!b)return;
    const ctx=C.paintCanvas.getContext('2d',{willReadFrequently:true});
    ctx.save();ctx.lineWidth=number('carBrushSize',8);ctx.lineJoin='round';ctx.lineCap='round';
    ctx.strokeStyle=by('carBrushColor').value;ctx.fillStyle=erase?'#000':by('carBrushColor').value;
    ctx.globalCompositeOperation=erase?'destination-out':'source-over';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    if(Math.hypot(a.x-b.x,a.y-b.y)<.1){ctx.beginPath();ctx.arc(b.x,b.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
    ctx.restore();draw();
  }
  function pickColor(pt){
    if(!pt||!C.paintCanvas)return;
    if(pt.x<0||pt.y<0||pt.x>=C.paint.w||pt.y>=C.paint.h)return;
    const data=C.paintCanvas.getContext('2d',{willReadFrequently:true}).getImageData(Math.floor(pt.x),Math.floor(pt.y),1,1).data;
    if(data[3]<10)return status('That paint pixel is transparent.');
    by('carBrushColor').value='#'+[0,1,2].map(i=>data[i].toString(16).padStart(2,'0')).join('');
    status('Colour sampled from PAINT.');
  }

  function setTool(name){
    C.tool=name;
    by('carTools').querySelectorAll('[data-car-tool]').forEach(btn=>btn.classList.toggle('active',btn.dataset.carTool===name));
    by('carPickRear').classList.toggle('active',name==='place-rear');
    by('carPickFront').classList.toggle('active',name==='place-front');
    view.classList.toggle('pan',name==='pan');
    if(name==='paint-align'&&C.locked)status('Unlock BODY + PAINT to realign.');
    else status({move:'Move the paired car or drag the cyan top-left handle to resize.', 'paint-align':'Drag PAINT relative to BODY before locking.',picker:'Click PAINT to sample a colour.',brush:'Paint on the PAINT layer only.',eraser:'Erase pixels from PAINT.',pan:'Drag to pan the workspace.','place-rear':'Tap rear wheel centre.','place-front':'Tap front wheel centre.'}[name]||'Ready.');
  }
  function insideRect(p,r,pad=0){return r&&p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;}
  function beginPinch(){
    const pts=[...C.pointers.values()],a=pts[0],b=pts[1];
    if(C.painting&&C.history.length)restorePixels(C.history.pop()); // Cancel accidental second-finger stroke.
    C.painting=false;C.drag=null;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    C.gesture={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:C.zoom,anchor:toWorld(mx,my)};
  }
  view.addEventListener('pointerdown',e=>{
    if(!by('carStudioTab').classList.contains('active'))return;
    if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return;
    view.setPointerCapture?.(e.pointerId);
    C.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(C.pointers.size===2){beginPinch();e.preventDefault();return;}
    if(C.pointers.size!==1)return;
    const p=toWorld(e.clientX,e.clientY),rect=bodyRect(),pr=paintRect();
    if(C.spacePan||C.tool==='pan'||e.button===1){
      C.drag={kind:'pan',clientX:e.clientX,clientY:e.clientY,px:C.panX,py:C.panY};return;
    }
    if(C.tool==='place-rear'||C.tool==='place-front'){
      const key=C.tool==='place-rear'?'rear':'front';
      Object.assign(C.wheel[key],{x:p.x,y:p.y,placed:true});
      syncWheels();setTool('move');draw();return;
    }
    if(C.tool==='picker'){pickColor(paintPoint(p));return;}
    if(C.tool==='brush'||C.tool==='eraser'){
      if(!C.paintCanvas||!insideRect(p,pr))return status('Click within PAINT to edit it.');
      const pt=paintPoint(p);pushHistory();C.painting=true;C.lastPt=pt;
      paintSegment(pt,pt,C.tool==='eraser');e.preventDefault();return;
    }
    if(C.tool==='paint-align'){
      if(C.locked)return status('Unlock the pair before aligning PAINT.');
      if(!insideRect(p,pr))return;
      C.drag={kind:'paint',point:p,dx:C.paintAlign.dx,dy:C.paintAlign.dy};return;
    }
    if(C.tool!=='move'||!rect)return;
    for(const k of wnames){
      const w=C.wheel[k];
      if(w.placed&&Math.hypot(p.x-w.x,p.y-w.y)<Math.max(14/C.zoom,w.r*.55)){
        C.drag={kind:'wheel',key:k,dx:p.x-w.x,dy:p.y-w.y};return;
      }
    }
    if(Math.hypot(p.x-rect.x,p.y-rect.y)<Math.max(20/C.zoom,12)){
      C.drag={kind:'resize',right:rect.x+rect.w,bottom:rect.y+rect.h};return;
    }
    if(insideRect(p,rect,8/C.zoom)){
      C.drag={kind:'move',point:p,x:C.x,y:C.y};return;
    }
  });
  view.addEventListener('pointermove',e=>{
    if(!C.pointers.has(e.pointerId))return;
    C.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(C.gesture&&C.pointers.size>=2){
      const pts=[...C.pointers.values()],a=pts[0],b=pts[1];
      const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2,r=view.getBoundingClientRect();
      C.zoom=constrain(C.gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/C.gesture.distance,.04,12);
      C.panX=midX-r.left-r.width/2-(C.gesture.anchor.x-C.w/2)*C.zoom;
      C.panY=midY-r.top-r.height/2-(C.gesture.anchor.y-C.h/2)*C.zoom;
      draw();e.preventDefault();return;
    }
    const p=toWorld(e.clientX,e.clientY);
    if(C.painting){
      const next=paintPoint(p);if(next){paintSegment(C.lastPt,next,C.tool==='eraser');C.lastPt=next;}return;
    }
    const d=C.drag;if(!d)return;
    if(d.kind==='pan'){C.panX=d.px+e.clientX-d.clientX;C.panY=d.py+e.clientY-d.clientY;draw();}
    if(d.kind==='move')moveCar(d.x+p.x-d.point.x,d.y+p.y-d.point.y,C.s);
    if(d.kind==='resize'){
      const sx=(d.right-p.x)/C.body.w,sy=(d.bottom-p.y)/C.body.h;
      const scale=constrain(Math.min(sx,sy),.01,10);
      moveCar(d.right-C.body.w*scale,d.bottom-C.body.h*scale,scale);
    }
    if(d.kind==='paint'){
      C.paintAlign.dx=d.dx+(p.x-d.point.x)/C.s;
      C.paintAlign.dy=d.dy+(p.y-d.point.y)/C.s;
      syncPaintControls();draw();
    }
    if(d.kind==='wheel'){
      const w=C.wheel[d.key];w.x=p.x-d.dx;w.y=p.y-d.dy;syncWheels();draw();
    }
    e.preventDefault();
  });
  function endPointer(e){
    C.pointers.delete(e.pointerId);
    if(C.pointers.size<2)C.gesture=null;
    C.drag=null;C.painting=false;C.lastPt=null;
  }
  view.addEventListener('pointerup',endPointer);
  view.addEventListener('pointercancel',endPointer);
  view.addEventListener('wheel',e=>{
    if(!by('carStudioTab').classList.contains('active'))return;
    e.preventDefault();zoomAt(C.zoom*Math.exp(-e.deltaY*.002),e.clientX,e.clientY);
  },{passive:false});
  view.addEventListener('dblclick',e=>{if(C.tool==='pan')zoomAt(C.zoom*1.5,e.clientX,e.clientY)});
  window.addEventListener('keydown',e=>{
    if(!by('carStudioTab').classList.contains('active'))return;
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(e.code==='Space'){C.spacePan=true;view.classList.add('pan');e.preventDefault();return;}
    if(C.tool!=='move'||!C.body)return;
    const amount=e.shiftKey?10:e.altKey?.25:1;
    let x=C.x,y=C.y;
    if(e.key==='ArrowLeft')x-=amount;
    else if(e.key==='ArrowRight')x+=amount;
    else if(e.key==='ArrowUp')y-=amount;
    else if(e.key==='ArrowDown')y+=amount;
    else return;
    e.preventDefault();e.stopImmediatePropagation();moveCar(x,y,C.s);
  },true);
  window.addEventListener('keyup',e=>{if(e.code==='Space'){C.spacePan=false;view.classList.toggle('pan',C.tool==='pan');}});
  window.addEventListener('blur',()=>{C.spacePan=false;view.classList.toggle('pan',C.tool==='pan');});

  by('carRefAE86').onchange=()=>importAsset('carRefAE86','ae86');
  by('carRefR32').onchange=()=>importAsset('carRefR32','r32');
  by('carBodyFile').onchange=()=>importAsset('carBodyFile','body');
  by('carPaintFile').onchange=()=>importAsset('carPaintFile','paint');
  by('carRearWheelFile').onchange=()=>importAsset('carRearWheelFile','rear');
  by('carFrontWheelFile').onchange=()=>importAsset('carFrontWheelFile','front');
  by('carReference').onchange=()=>{
    const dimensions=C.referenceDims[activeRefKey()];
    by('carRefLength').value=dimensions.length||'';
    by('carRefHeight').value=dimensions.height||'';
    updateRatio();draw();
  };
  by('carRefOpacity').oninput=draw;
  by('carLayersLocked').onchange=()=>{C.locked=by('carLayersLocked').checked;syncPaintControls();if(C.locked&&C.tool==='paint-align')setTool('move');draw()};
  by('carLockPair').onclick=()=>{C.locked=!C.locked;syncPaintControls();setTool('move');draw()};
  function readPaintControls(){
    if(C.locked)return;
    C.paintAlign.dx=number('carPaintX');C.paintAlign.dy=number('carPaintY');
    C.paintAlign.sx=constrain(number('carPaintSX',100)/100,.01,4);
    C.paintAlign.sy=constrain(number('carPaintSY',100)/100,.01,4);draw();
  }
  for(const id of ['carPaintX','carPaintY','carPaintSX','carPaintSY'])by(id).addEventListener('input',readPaintControls);
  by('carResetPaint').onclick=()=>{if(C.locked)return;C.paintAlign={dx:0,dy:0,sx:1,sy:1};syncPaintControls();draw();};
  function readCarControls(){if(C.body)moveCar(number('carX'),number('carY'),constrain(number('carScale',100)/100,.01,10));}
  for(const id of ['carX','carY','carScale'])by(id).addEventListener('change',readCarControls);
  by('carMatchNose').onclick=alignNose;
  by('carResetTransform').onclick=()=>{
    if(!C.body)return;
    const scale=Math.min(1,C.w/C.body.w,C.h/C.body.h);
    moveCar(C.w-C.body.w*scale,C.h-C.body.h*scale,scale);
  };
  for(const id of ['carRefLength','carRefHeight','carLength','carHeight'])by(id).addEventListener('input',updateRatio);
  by('carApplyLength').onclick=applyLength;
  by('carTools').querySelectorAll('[data-car-tool]').forEach(btn=>btn.onclick=()=>setTool(btn.dataset.carTool));
  by('carBrushSize').oninput=()=>{by('carBrushSizeLabel').textContent=by('carBrushSize').value+'px';};
  by('carUndo').onclick=undo;by('carRedo').onclick=redo;
  for(const id of ['carShowBody','carShowPaint','carShowWheels','carPixel'])by(id).onchange=draw;
  by('carPickRear').onclick=()=>setTool('place-rear');
  by('carPickFront').onclick=()=>setTool('place-front');
  for(const k of wnames){
    const p=k==='rear'?'carRear':'carFront';
    for(const axis of ['X','Y','Radius'])by(p+axis).addEventListener('change',()=>{
      const w=C.wheel[k];
      if(axis==='Radius'){w.r=constrain(number(p+'Radius',38),1,2048);}
      else {w[axis.toLowerCase()]=number(p+axis);w.placed=true;}
      syncWheels();draw();
    });
  }
  for(const id of ['carCanvasW','carCanvasH'])by(id).onchange=()=>changeCanvas(number('carCanvasW',C.w),number('carCanvasH',C.h));
  by('carUseAE86Canvas').onclick=()=>{
    if(!C.refs.ae86)return status('Load your AE86 reference PNG first.');
    changeCanvas(C.refs.ae86.w,C.refs.ae86.h);status('Canvas matched the AE86 image dimensions.');
  };
  by('carWider').onclick=()=>changeCanvas(C.w+40,C.h);
  by('carTaller').onclick=()=>changeCanvas(C.w,C.h+40);
  by('carZoomIn').onclick=()=>zoomCenter(1.25);
  by('carZoomOut').onclick=()=>zoomCenter(.8);
  by('carFit').onclick=fitView;
  by('carActual').onclick=()=>zoomCenter(1/C.zoom);

  function validate(){
    if(!C.body||!C.paint||!C.paintCanvas)throw new Error('Import both BODY and PAINT PNGs first.');
    if(!C.locked)throw new Error('Lock the BODY and PAINT pair before exporting.');
    if(C.w*C.h>24000000)throw new Error('Output canvas is too large. Reduce its dimensions.');
  }
  function layerCanvas(kind){
    const canvas=document.createElement('canvas');canvas.width=C.w;canvas.height=C.h;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=!by('carPixel').checked;
    const r=kind==='body'?bodyRect():paintRect(),src=kind==='body'?C.body?.img:C.paintCanvas;
    if(r&&src)ctx.drawImage(src,r.x,r.y,r.w,r.h);
    return canvas;
  }
  function geometry(){
    const name=baseName();
    const wheels={};
    for(const k of wnames){
      const wheel=C.wheel[k];
      wheels[k]=wheel.placed?{
        x:round(wheel.x),y:round(wheel.y),radius:round(wheel.r),diameter:round(wheel.r*2),
        sprite:wheel.image?'wheels/'+name+'_'+k+'.png':null
      }:null;
    }
    return{
      version:1,source:'SpriteR Car Asset Studio',carId:name,
      anchor:'bottom-right',canvas:{width:C.w,height:C.h,transparent:true},
      exports:{body:'body/'+name+'_body.png',paint:'paint/'+name+'_paint.png'},
      car:{x:round(C.x),y:round(C.y),scale:round(C.s),visiblePixelWidth:round(alphaBounds(C.body).w*C.s),
        visiblePixelHeight:round(alphaBounds(C.body).h*C.s)},
      paintAlignment:{offsetX:round(C.paintAlign.dx),offsetY:round(C.paintAlign.dy),
        scaleX:round(C.paintAlign.sx),scaleY:round(C.paintAlign.sy),pairLocked:C.locked},
      dimensionsMm:{length:number('carLength')||null,height:number('carHeight')||null,
        referenceLength:number('carRefLength')||null,referenceHeight:number('carRefHeight')||null},
      source:{body:C.body.name,paint:C.paint.name,reference:activeRef()?.name||null},
      wheels
    };
  }
  const jsonBlob=()=>new Blob([JSON.stringify(geometry(),null,2)+'\n'],{type:'application/json'});
  by('carExportGeometry').onclick=()=>{
    try{validate();downloadBlob(jsonBlob(),baseName()+'_geometry.json');status('Wheel coordinates and car geometry exported.');}
    catch(e){status(e.message)}
  };
  by('carExportPair').onclick=async()=>{
    try{
      validate();const name=baseName();
      const body=await canvasBlobPng(layerCanvas('body')),paint=await canvasBlobPng(layerCanvas('paint'));
      downloadBlob(body,name+'_body.png');
      setTimeout(()=>downloadBlob(paint,name+'_paint.png'),220);
      status('Exported aligned BODY + PAINT PNGs ('+C.w+'×'+C.h+').');
    }catch(e){console.error(e);status(e.message);}
  };

  // Self-contained store-only ZIP: PNG/WebP data is already compressed.
  const crcTable=(()=>{
    const t=new Uint32Array(256);
    for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;
  })();
  function crc32(b){let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  const le16=(v,p,n)=>v.setUint16(p,n,true),le32=(v,p,n)=>v.setUint32(p,n>>>0,true);
  async function makeZip(entries){
    const encoder=new TextEncoder(),locals=[],centers=[];let offset=0;
    for(const item of entries){
      const name=encoder.encode(item.path),bytes=new Uint8Array(await item.blob.arrayBuffer());
      if(name.length>65535||bytes.byteLength>0xffffffff)throw new Error('ZIP entry too large.');
      const crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
      le32(lv,0,0x04034b50);le16(lv,4,20);le16(lv,6,0x0800);le16(lv,8,0);
      le32(lv,14,crc);le32(lv,18,bytes.byteLength);le32(lv,22,bytes.byteLength);le16(lv,26,name.length);
      local.set(name,30);locals.push(local,bytes);
      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
      le32(cv,0,0x02014b50);le16(cv,4,20);le16(cv,6,20);le16(cv,8,0x0800);
      le32(cv,16,crc);le32(cv,20,bytes.byteLength);le32(cv,24,bytes.byteLength);
      le16(cv,28,name.length);le32(cv,42,offset);central.set(name,46);centers.push(central);
      offset+=local.length+bytes.byteLength;
    }
    const centralSize=centers.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    le32(ev,0,0x06054b50);le16(ev,8,entries.length);le16(ev,10,entries.length);
    le32(ev,12,centralSize);le32(ev,16,offset);
    return new Blob([...locals,...centers,end],{type:'application/zip'});
  }
  async function wheelPng(asset){
    const c=document.createElement('canvas');c.width=asset.w;c.height=asset.h;c.getContext('2d').drawImage(asset.img,0,0);
    return canvasBlobPng(c);
  }
  by('carExportZip').onclick=async()=>{
    const button=by('carExportZip');
    try{
      validate();button.disabled=true;status('Building car package…');
      const name=baseName();
      const entries=[
        {path:'body/'+name+'_body.png',blob:await canvasBlobPng(layerCanvas('body'))},
        {path:'paint/'+name+'_paint.png',blob:await canvasBlobPng(layerCanvas('paint'))},
        {path:'data/'+name+'_geometry.json',blob:jsonBlob()}
      ];
      for(const k of wnames){const wheel=C.wheel[k];
        if(wheel.image)entries.push({path:'wheels/'+name+'_'+k+'.png',blob:await wheelPng(wheel.image)});
      }
      const zip=await makeZip(entries);downloadBlob(zip,name+'_car_assets.zip');
      status('Car package ready: matched BODY/PAINT, wheel files and coordinate JSON.');
    }catch(e){console.error(e);status(e.message||'Could not export ZIP.');}
    finally{button.disabled=false;}
  };
  if(window.ResizeObserver)new ResizeObserver(()=>draw()).observe(view);
  window.addEventListener('resize',draw);
  document.querySelector('[data-tab="carStudioTab"]').addEventListener('click',()=>requestAnimationFrame(fitView));
  syncCarControls();syncPaintControls();syncWheels();
})();
