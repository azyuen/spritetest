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
