(() => {
  'use strict';
  // Loaded advisory only. This module NEVER changes the car sprite transform.
  const $ = id => document.getElementById(id);
  const root = $('carProportionGuide'), selector = $('carProportionVehicle');
  const info = $('carProportionStatus');
  if (!root || !selector || !info) return;
  let dimensions = null, localOverride = false;
  const text = (tag, content, cls = '') => {
    const node = document.createElement(tag);
    node.textContent = content;
    if (cls) node.className = cls;
    return node;
  };
  const valid = json => Boolean(json && json.references && json.vehicles &&
    json.assets && typeof json.vehicles === 'object' && typeof json.assets === 'object' &&
    json.references.ae86 && json.references.r32);
  const basename = name => String(name || '').split(/[\\/]/).pop(); // case-sensitive on purpose

  function importedLayerFilename(id) {
    return basename($(id)?.files?.[0]?.name || '');
  }
  function match(name) {
    return name && Object.prototype.hasOwnProperty.call(dimensions.assets, name)
      ? dimensions.assets[name] : null;
  }
  function autoVehicle() {
    const body = importedLayerFilename('carBodyFile');
    const paint = importedLayerFilename('carPaintFile');
    const bodyMatch = match(body), paintMatch = match(paint);
    if (bodyMatch && paintMatch && bodyMatch.vehicleId !== paintMatch.vehicleId) {
      return { error: 'BODY and PAINT filenames identify different vehicles. Check the imported layers or choose a vehicle manually.' };
    }
    const found = bodyMatch || paintMatch;
    if (found) return { id: found.vehicleId, filename: bodyMatch ? body : paint };
    const names = [body,paint].filter(Boolean);
    if (names.length) {
      return {error: 'No exact filename match for ' + names.join(' / ') +
        '. Choose the car from the list below, or upload an updated dimensions JSON.'};
    }
    return {error: 'Import a matching BODY/PAINT PNG, or choose the target car manually.'};
  }
  function fmtDelta(value,kind) {
    if (!Number.isFinite(value)) return 'not specified';
    const amount = Math.abs(value).toFixed(1).replace(/\.0$/, '');
    if (Math.abs(value) < 0.05) return kind === 'height' ? 'about the same height' : 'about the same ' + (kind === 'wheelbase' ? 'wheelbase' : 'length');
    const word = kind === 'height' ? (value > 0 ? 'taller' : 'lower')
      : (value > 0 ? 'longer' : 'shorter');
    return amount + '% ' + word;
  }
  const formatMm = value => Number(value).toLocaleString('en-AU') + ' mm';
  function selectedRefs() {
    const key = $('carReference').value;
    return key === 'both' ? ['ae86','r32'] : key === 'r32' ? ['r32'] : ['ae86'];
  }
  function render() {
    root.replaceChildren();
    if (!dimensions) {
      info.textContent = 'Loading vehicle size references…';
      return;
    }
    const auto = selector.value === 'auto';
    const found = auto ? autoVehicle() : {id:selector.value};
    const vehicle = found.id && dimensions.vehicles[found.id];
    if (!vehicle) {
      info.textContent = found.error || 'Choose a supported car.';
      root.appendChild(text('div', found.error || 'No vehicle dimensions selected.', 'car-proportion-empty'));
      return;
    }
    info.textContent = (auto ? 'Matched exact filename: '+found.filename+' · ' : 'Selected manually · ') +
      'guide only — no automatic resizing';
    const title = text('div',vehicle.name,'car-proportion-name');
    root.appendChild(title);
    root.appendChild(text('div',vehicle.variant || '', 'car-proportion-variant'));

    for (const refId of selectedRefs()) {
      const comparison=vehicle.vsReferencePct?.[refId];
      if (!comparison) continue;
      const card=document.createElement('div');
      card.className='car-proportion-comparison';
      card.appendChild(text('div','Compared with ' + (refId==='ae86' ? 'Toyota AE86' : 'Skyline R32 GT-R')+':','car-proportion-reference'));
      card.appendChild(text('div',fmtDelta(comparison.length,'length')+' · '+fmtDelta(comparison.height,'height'),'car-proportion-primary'));
      card.appendChild(text('div','Wheelbase: '+fmtDelta(comparison.wheelbase,'wheelbase'),'car-proportion-secondary'));
      root.appendChild(card);
    }
    if ($('carReference').value === 'none') root.appendChild(text('div','AE86 comparison shown (reference overlay hidden).','car-proportion-note'));
    root.appendChild(text('div',
      'Real dimensions: '+formatMm(vehicle.lengthMm)+' long · '+formatMm(vehicle.heightMm)+
      ' high · '+formatMm(vehicle.wheelbaseMm)+' wheelbase', 'car-proportion-measurements'));
    if (vehicle.confidence && vehicle.confidence !== 'high')
      root.appendChild(text('div','Dimension confidence: '+vehicle.confidence+'.','car-proportion-note'));
    if (vehicle.note) root.appendChild(text('div',vehicle.note,'car-proportion-note'));
    root.appendChild(text('div','Visual guide only: compare the visible car, not transparent PNG dimensions. No stretching or automatic scale changes.','car-proportion-disclaimer'));
  }
  function setDimensions(json, source) {
    if (!valid(json)) throw new Error('Invalid SpriteR dimensions JSON.');
    dimensions=json;
    const last=selector.value||'auto';
    selector.replaceChildren();
    const autoOption=document.createElement('option');
    autoOption.value='auto';autoOption.textContent='Auto-detect from BODY / PAINT filename';selector.appendChild(autoOption);
    const sorted=Object.entries(json.vehicles).sort((a,b)=>a[1].name.localeCompare(b[1].name));
    for (const [id,v] of sorted) {
      const opt=document.createElement('option');opt.value=id;
      opt.textContent=v.name+' — '+(v.variant||id);
      selector.appendChild(opt);
    }
    selector.value=last==='auto'||json.vehicles[last]?last:'auto';
    $('carProportionDataStatus').textContent=sorted.length+' vehicles · '+Object.keys(json.assets).length+
      ' exact filenames ('+source+')';
    render();
  }
  selector.addEventListener('change',render);
  $('carReference').addEventListener('change',render);
  $('carBodyFile').addEventListener('change',()=>{
    if(selector.value!=='auto')selector.value='auto';
    render();
  });
  $('carPaintFile').addEventListener('change',()=>{
    if(selector.value!=='auto')selector.value='auto';
    render();
  });
  $('carProportionUpload').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      const json=JSON.parse(await file.text());
      setDimensions(json,'uploaded JSON');localOverride=true;
    }catch(err){
      info.textContent='Could not load dimensions JSON: '+(err.message||'invalid file');
    }
  });
  fetch('spriter_vehicle_dimensions.json?v=20261013')
    .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json();})
    .then(json=>{if(!localOverride)setDimensions(json,'bundled');})
    .catch(err=>{info.textContent='Bundled dimension data could not load ('+err.message+'). Upload the JSON using the control above.';});
})();
