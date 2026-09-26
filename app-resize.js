// Batch canvas resize and export. All work stays in the browser: source files
// are never uploaded, canvases keep their alpha channel, and ZIP entries use
// the original uploaded filenames.
(function(){
  const byId=id=>document.getElementById(id);
  const widthInput=byId('resizeWidth');
  const onlyReduce=byId('resizeOnlyReduce');
  const filter=byId('resizeFilter');
  const bottomSelect=byId('resizeBottom');
  const topSelect=byId('resizeTop');
  const opacity=byId('resizeOpacity');
  const blend=byId('resizeBlend');
  const canvas=byId('resizeCanvas');
  const ctx=canvas.getContext('2d');
  let overwriteMode=null;

  const clampNumber=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||min));
  const assetById=id=>state.assets.find(asset=>asset.id===id)||null;
  const bytesLabel=value=>{
    const mb=Number(value||0)/(1024*1024);
    return mb>=10?mb.toFixed(0)+' MB':mb.toFixed(1)+' MB';
  };

  function targetSize(asset){
    if(!asset)return {w:1,h:1,scale:1};
    const requested=Math.round(clampNumber(widthInput.value,1,4096));
    const w=onlyReduce.checked?Math.min(asset.w,requested):requested;
    const scale=w/asset.w;
    return {w,h:Math.max(1,Math.round(asset.h*scale)),scale};
  }

  function suggestedLayers(){
    const paint=state.assets.find(a=>/paint/i.test(a.originalName));
    const details=state.assets.find(a=>/(details|detail|body|outline)/i.test(a.originalName)&&a!==paint);
    return {bottom:paint||state.assets[0]||null,top:details||state.assets[1]||state.assets[0]||null};
  }

  function fillSelect(select,selectedId){
    select.innerHTML='';
    state.assets.forEach(asset=>{
      const option=document.createElement('option');
      option.value=asset.id;
      option.textContent=asset.originalName+'  ('+asset.w+'×'+asset.h+')';
      select.appendChild(option);
    });
    if(state.assets.some(a=>a.id===selectedId))select.value=selectedId;
  }

  function refreshSelectors(forceSuggestion=false){
    const oldBottom=bottomSelect.value;
    const oldTop=topSelect.value;
    const suggested=suggestedLayers();
    fillSelect(bottomSelect,forceSuggestion?suggested.bottom?.id:oldBottom||suggested.bottom?.id);
    fillSelect(topSelect,forceSuggestion?suggested.top?.id:oldTop||suggested.top?.id);
  }

  function drawAsset(context,asset,size,alpha=1,operation='source-over'){
    if(!asset)return;
    context.save();
    context.globalAlpha=alpha;
    context.globalCompositeOperation=operation;
    context.imageSmoothingEnabled=filter.value!=='pixel';
    if(context.imageSmoothingEnabled)context.imageSmoothingQuality='high';
    context.drawImage(asset.img,0,0,asset.w,asset.h,0,0,size.w,size.h);
    context.restore();
  }

  function renderPreview(){
    const bottom=assetById(bottomSelect.value);
    const top=assetById(topSelect.value);
    byId('resizeOpacityLabel').textContent=opacity.value+'%';
    if(!bottom&&!top){
      canvas.width=1;canvas.height=1;
      ctx.clearRect(0,0,1,1);
      byId('resizeStatus').textContent='Load assets in the Assets tab first.';
      return;
    }
    const bottomSize=targetSize(bottom||top);
    const topSize=targetSize(top||bottom);
    canvas.width=Math.max(bottomSize.w,topSize.w);
    canvas.height=Math.max(bottomSize.h,topSize.h);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawAsset(ctx,bottom,bottomSize,1,'source-over');
    drawAsset(ctx,top,topSize,Number(opacity.value)/100,blend.value);
    const sameSource=Boolean(bottom&&top&&bottom.w===top.w&&bottom.h===top.h);
    const sameOutput=bottomSize.w===topSize.w&&bottomSize.h===topSize.h;
    byId('resizeStatus').textContent=bottom&&top
      ? (sameSource&&sameOutput
        ? 'Layers match · '+bottomSize.w+' × '+bottomSize.h+' transparent canvas'
        : 'Warning: selected layers use different canvas dimensions')
      : 'Previewing one layer';
  }

  function refreshSummary(){
    const list=byId('resizeFiles');
    list.innerHTML='';
    if(!state.assets.length){
      byId('resizeSummary').textContent='Load your PNG layers in the Assets tab first.';
      byId('resizeMetrics').innerHTML='';
      renderPreview();
      return;
    }
    let sourcePixels=0;
    let outputPixels=0;
    state.assets.forEach(asset=>{
      const size=targetSize(asset);
      sourcePixels+=asset.w*asset.h;
      outputPixels+=size.w*size.h;
      const row=document.createElement('div');
      row.className='resize-file';
      const name=document.createElement('b');
      name.textContent=asset.originalName;
      const dimensions=document.createElement('span');
      dimensions.textContent=asset.w+'×'+asset.h+' → '+size.w+'×'+size.h;
      row.append(name,dimensions);
      list.appendChild(row);
    });
    const before=sourcePixels*4;
    const after=outputPixels*4;
    const saving=before?Math.max(0,Math.round((1-after/before)*100)):0;
    byId('resizeSummary').innerHTML=
      '<b>'+state.assets.length+' file'+(state.assets.length===1?'':'s')+'</b><br>'+ 
      'Decoded texture memory: <code>'+bytesLabel(before)+'</code> → <code>'+bytesLabel(after)+'</code><br>'+ 
      'Estimated graphics-memory reduction: <code>'+saving+'%</code>';
    byId('resizeMetrics').innerHTML=
      '<div class="metric"><b>'+state.assets.length+'</b><span>files</span></div>'+ 
      '<div class="metric"><b>'+Math.round(clampNumber(widthInput.value,1,4096))+'px</b><span>target width</span></div>'+ 
      '<div class="metric"><b>'+saving+'%</b><span>memory reduction</span></div>';
    renderPreview();
  }

  function refresh(forceSuggestion=false){
    refreshSelectors(forceSuggestion);
    refreshSummary();
    const disabled=!state.assets.length;
    byId('resizeDownloadSelected').disabled=disabled;
    byId('resizeDownloadZip').disabled=disabled;
  }

  function renderAssetCanvas(asset){
    const size=targetSize(asset);
    const output=document.createElement('canvas');
    output.width=size.w;
    output.height=size.h;
    const outputContext=output.getContext('2d');
    outputContext.clearRect(0,0,size.w,size.h);
    drawAsset(outputContext,asset,size,1,'source-over');
    return output;
  }

  function canvasBlob(output){
    return new Promise((resolve,reject)=>{
      if(output.toBlob){
        output.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png');
        return;
      }
      try{
        const data=atob(output.toDataURL('image/png').split(',')[1]);
        const bytes=new Uint8Array(data.length);
        for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
        resolve(new Blob([bytes],{type:'image/png'}));
      }catch(error){reject(error)}
    });
  }

  async function resizedBlob(asset){
    return canvasBlob(renderAssetCanvas(asset));
  }

  function originalPngName(asset){
    const raw=String(asset?.originalName||asset?.name||'sprite.png');
    return /\.png$/i.test(raw)?raw:raw.replace(/\.[^.]+$/, '')+'.png';
  }

  function armOverwrite(mode){
    if(!state.assets.length)return;
    overwriteMode=mode;
    const count=mode==='all'?state.assets.length:1;
    byId('resizeOverwriteConfirmText').textContent='Replace '+count+' loaded working cop'+(count===1?'y':'ies')+' with the resized result?';
    byId('resizeOverwriteConfirm').hidden=false;
    byId('resizeStatus').textContent='Confirm overwrite below.';
  }
  function cancelOverwrite(){
    overwriteMode=null;
    byId('resizeOverwriteConfirm').hidden=true;
  }
  async function confirmOverwrite(){
    if(!overwriteMode)return cancelOverwrite();
    const assets=overwriteMode==='all'?[...state.assets]:[assetById(bottomSelect.value)||state.assets[0]].filter(Boolean);
    const button=byId('resizeOverwriteConfirmBtn');
    button.disabled=true;
    try{
      for(const asset of assets){
        const output=renderAssetCanvas(asset);
        await replaceAssetFromCanvas(asset,output,false);
      }
      renderAssets();
      rebuildFrames();
      cancelOverwrite();
      refresh(true);
      byId('resizeStatus').textContent='Loaded working cop'+(assets.length===1?'y':'ies')+' overwritten. You can keep tweaking from here.';
    }catch(error){
      console.error(error);
      byId('resizeStatus').textContent='Could not overwrite the loaded working copy.';
    }finally{
      button.disabled=false;
    }
  }

  byId('resizeDownloadSelected').onclick=async()=>{
    const asset=assetById(bottomSelect.value)||state.assets[0];
    if(!asset)return;
    const button=byId('resizeDownloadSelected');
    button.disabled=true;
    byId('resizeStatus').textContent='Rendering '+asset.originalName+'…';
    try{
      const blob=await resizedBlob(asset);
      downloadBlob(blob,originalPngName(asset));
      byId('resizeStatus').textContent='Downloaded '+originalPngName(asset);
    }catch(error){
      console.error(error);
      byId('resizeStatus').textContent='Could not export this PNG.';
    }finally{button.disabled=false}
  };

  // Small store-only ZIP writer. PNG data is already compressed, so avoiding
  // another compression library is faster and keeps SpriteR fully standalone.
  const crcTable=(()=>{
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
      table[n]=c>>>0;
    }
    return table;
  })();
  function crc32(bytes){
    let crc=0xffffffff;
    for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }
  function blobBytes(blob){
    if(blob.arrayBuffer)return blob.arrayBuffer().then(buffer=>new Uint8Array(buffer));
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(new Uint8Array(reader.result));
      reader.onerror=()=>reject(reader.error||new Error('Could not read PNG data'));
      reader.readAsArrayBuffer(blob);
    });
  }
  function header(size){return new Uint8Array(size)}
  function u16(view,offset,value){view.setUint16(offset,value,true)}
  function u32(view,offset,value){view.setUint32(offset,value>>>0,true)}
  function dosTime(date){
    return ((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((date.getSeconds()/2)&31);
  }
  function dosDate(date){
    return (((Math.max(1980,date.getFullYear())-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31);
  }
  async function zipStore(files){
    const encoder=new TextEncoder();
    const localParts=[];
    const centralParts=[];
    const now=new Date();
    let offset=0;
    for(const file of files){
      const name=encoder.encode(file.name);
      const data=await blobBytes(file.blob);
      const crc=crc32(data);
      const local=header(30+name.length);
      const lv=new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);
      u16(lv,10,dosTime(now));u16(lv,12,dosDate(now));u32(lv,14,crc);
      u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);u16(lv,28,0);
      local.set(name,30);
      localParts.push(local,data);

      const central=header(46+name.length);
      const cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);
      u16(cv,12,dosTime(now));u16(cv,14,dosDate(now));u32(cv,16,crc);
      u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);
      u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);
      central.set(name,46);
      centralParts.push(central);
      offset+=local.length+data.length;
    }
    const centralSize=centralParts.reduce((total,part)=>total+part.length,0);
    const end=header(22);
    const ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,files.length);u16(ev,10,files.length);
    u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }

  byId('resizeDownloadZip').onclick=async()=>{
    if(!state.assets.length)return;
    const button=byId('resizeDownloadZip');
    button.disabled=true;
    const files=[];
    try{
      for(let i=0;i<state.assets.length;i++){
        const asset=state.assets[i];
        byId('resizeStatus').textContent='Rendering '+(i+1)+'/'+state.assets.length+' · '+asset.originalName;
        files.push({name:originalPngName(asset),blob:await resizedBlob(asset)});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      byId('resizeStatus').textContent='Packaging ZIP…';
      const zip=await zipStore(files);
      const target=Math.round(clampNumber(widthInput.value,1,4096));
      downloadBlob(zip,'spriter-resized-'+target+'px.zip');
      byId('resizeStatus').textContent='ZIP ready · '+files.length+' transparent PNGs';
    }catch(error){
      console.error(error);
      byId('resizeStatus').textContent='Export failed. Try a smaller batch.';
    }finally{button.disabled=false}
  };

  byId('resizeOverwriteSelected').onclick=()=>armOverwrite('selected');
  byId('resizeOverwriteAll').onclick=()=>armOverwrite('all');
  byId('resizeOverwriteCancel').onclick=cancelOverwrite;
  byId('resizeOverwriteConfirmBtn').onclick=confirmOverwrite;
  byId('resizeReloadOriginals').onclick=()=>{
    cancelOverwrite();
    reloadUploadedAssets(true);
    refresh(true);
    byId('resizeStatus').textContent='Uploaded originals reloaded into SpriteR.';
  };

  [widthInput,onlyReduce,filter].forEach(control=>control.addEventListener('input',refreshSummary));
  [bottomSelect,topSelect,opacity,blend].forEach(control=>control.addEventListener('input',renderPreview));
  document.querySelector('[data-tab="resizeTab"]')?.addEventListener('click',()=>setTimeout(()=>refresh(true),0));
  window.addEventListener('spriter:assetschanged',()=>refresh(false));
  refresh(false);
})();
