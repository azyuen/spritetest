(() => {
  const R = state.referenceLayout = state.referenceLayout || {};
  Object.assign(R, {
    canvasId: R.canvasId || R.refId || null,
    activeKind: R.activeKind || 'reference',
    activeId: R.activeId || null,
    refLayers: R.refLayers || R.refLayerState || {},
    targetLayers: R.targetLayers || {},
    viewZoom: Number.isFinite(R.viewZoom) ? R.viewZoom : 1,
    viewX: Number.isFinite(R.viewX) ? R.viewX : 0,
    viewY: Number.isFinite(R.viewY) ? R.viewY : 0,
    mode: R.mode || 'move',
    guidesLoaded: !!R.guidesLoaded
  });

  const getAsset = id => state.assets.find(a => a.id === id) || null;
  const canvasAsset = () => getAsset(R.canvasId);
  const activeAsset = () => getAsset(R.activeId);
  const n = (id, fallback = 0) => {
    const v = +$(id).value;
    return Number.isFinite(v) ? v : fallback;
  };
  const bool = id => !!$(id)?.checked;
  const STORAGE_KEY = 'spriter-reference-layout-guides-v1';

  function setStatus(msg) {
    const el = $('referenceStatus');
    if (el) el.textContent = msg;
  }

  function defaultGuides(ref = canvasAsset()) {
    const w = ref?.w || 1000;
    const h = ref?.h || 1000;
    return {
      hEnabled: true,
      hY: Math.round(h * 0.78),
      hColor: '#f97316',
      circleEnabled: true,
      circleX: Math.round(w * 0.5),
      circleY: Math.round(h * 0.72),
      circleR: Math.round(Math.min(w, h) * 0.12),
      circleColor: '#22d3ee',
      vEnabled: true,
      vX: Math.round(w * 0.2),
      vTop: Math.round(h * 0.08),
      vBottom: Math.round(h * 0.92),
      vStep: Math.max(10, Math.round(h / 10)),
      vMajor: 5,
      vColor: '#a78bfa'
    };
  }

  function readGuideControls() {
    return {
      hEnabled: bool('guideHEnabled'),
      hY: n('guideHY', 0),
      hColor: $('guideHColor').value,
      circleEnabled: bool('guideCircleEnabled'),
      circleX: n('guideCircleX', 0),
      circleY: n('guideCircleY', 0),
      circleR: Math.max(1, n('guideCircleR', 1)),
      circleColor: $('guideCircleColor').value,
      vEnabled: bool('guideVEnabled'),
      vX: n('guideVX', 0),
      vTop: n('guideVTop', 0),
      vBottom: n('guideVBottom', 0),
      vStep: Math.max(1, n('guideVStep', 50)),
      vMajor: Math.max(1, Math.round(n('guideVMajor', 5))),
      vColor: $('guideVColor').value
    };
  }

  function writeGuideControls(g) {
    $('guideHEnabled').checked = g.hEnabled !== false;
    $('guideHY').value = Math.round(g.hY ?? 0);
    $('guideHColor').value = g.hColor || '#f97316';
    $('guideCircleEnabled').checked = g.circleEnabled !== false;
    $('guideCircleX').value = Math.round(g.circleX ?? 0);
    $('guideCircleY').value = Math.round(g.circleY ?? 0);
    $('guideCircleR').value = Math.max(1, Math.round(g.circleR ?? 1));
    $('guideCircleColor').value = g.circleColor || '#22d3ee';
    $('guideVEnabled').checked = g.vEnabled !== false;
    $('guideVX').value = Math.round(g.vX ?? 0);
    $('guideVTop').value = Math.round(g.vTop ?? 0);
    $('guideVBottom').value = Math.round(g.vBottom ?? 0);
    $('guideVStep').value = Math.max(1, Math.round(g.vStep ?? 50));
    $('guideVMajor').value = Math.max(1, Math.round(g.vMajor ?? 5));
    $('guideVColor').value = g.vColor || '#a78bfa';
  }

  function loadGuidePreset() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        writeGuideControls({...defaultGuides(), ...JSON.parse(raw)});
        R.guidesLoaded = true;
        return true;
      }
    } catch (err) {
      console.warn('SpriteR guide preset load failed', err);
    }
    return false;
  }

  function saveGuidePreset() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readGuideControls()));
      R.guidesLoaded = true;
      setStatus('Guide preset saved on this device.');
    } catch {
      setStatus('Could not save the guide preset in this browser.');
    }
  }

  function resetGuides() {
    writeGuideControls(defaultGuides());
    render();
    setStatus('Guides reset relative to the output canvas.');
  }

  function defaultLayerState(asset, kind) {
    const ref = canvasAsset();
    const cx = ref ? ref.w / 2 : asset.w / 2;
    const cy = ref ? ref.h / 2 : asset.h / 2;
    const isCanvas = asset.id === R.canvasId;
    return {
      cx, cy, sx: 1, sy: 1,
      visible: kind === 'reference' ? isCanvas : false,
      opacity: kind === 'reference' ? 100 : 85,
      locked: kind === 'reference' ? isCanvas : false,
      export: false
    };
  }

  function layerState(kind, id) {
    const store = kind === 'reference' ? R.refLayers : R.targetLayers;
    const asset = getAsset(id);
    if (!asset) return null;
    if (!store[id]) store[id] = defaultLayerState(asset, kind);
    return store[id];
  }

  function currentState() {
    return R.activeId ? layerState(R.activeKind, R.activeId) : null;
  }

  function layerRect(asset, st) {
    if (!asset || !st) return null;
    const w = asset.w * st.sx;
    const h = asset.h * st.sy;
    return {x: st.cx - w / 2, y: st.cy - h / 2, w, h};
  }

  function visibleReferenceLayers() {
    return state.assets.filter(a => layerState('reference', a.id)?.visible);
  }

  function visibleTargetLayers() {
    return state.assets.filter(a => layerState('target', a.id)?.visible);
  }

  function exportTargetLayers() {
    return state.assets.filter(a => layerState('target', a.id)?.export);
  }

  function activate(kind, id) {
    if (!getAsset(id)) return;
    R.activeKind = kind;
    R.activeId = id;
    syncTransformInputs();
    renderLists();
    render();
  }

  function renderReferenceList() {
    const el = $('guideReferenceLayers');
    if (!el) return;
    if (!state.assets.length) {
      el.innerHTML = '<div class="status">Load PNG assets first.</div>';
      return;
    }
    el.innerHTML = state.assets.map((a, i) => {
      const s = layerState('reference', a.id);
      const active = R.activeKind === 'reference' && R.activeId === a.id;
      const canvasTag = a.id === R.canvasId ? '<span class="reference-layer-badge">canvas</span>' : '';
      return '<div class="reference-independent-row ' + (active ? 'active' : '') + '">' +
        '<button class="reference-layer-select ' + (active ? 'active' : '') + '" data-ref-active="' + a.id + '" title="Edit this reference layer">' + (i + 1) + '</button>' +
        '<div class="reference-independent-main"><div class="reference-independent-name">' + esc(a.name) + ' ' + canvasTag + '</div><small>' + a.w + '×' + a.h + '</small></div>' +
        '<label class="reference-mini-check" title="Visible"><input type="checkbox" data-ref-visible="' + a.id + '" ' + (s.visible ? 'checked' : '') + '> Eye</label>' +
        '<label class="reference-mini-check" title="Lock transform"><input type="checkbox" data-ref-lock="' + a.id + '" ' + (s.locked ? 'checked' : '') + '> Lock</label>' +
        '<div class="reference-layer-opacity"><input type="range" min="0" max="100" value="' + s.opacity + '" data-ref-opacity="' + a.id + '"><small data-ref-opacity-label="' + a.id + '">' + s.opacity + '%</small></div>' +
      '</div>';
    }).join('');

    el.querySelectorAll('[data-ref-active]').forEach(b => b.onclick = () => activate('reference', b.dataset.refActive));
    el.querySelectorAll('[data-ref-visible]').forEach(cb => cb.onchange = () => {
      layerState('reference', cb.dataset.refVisible).visible = cb.checked;
      render();
    });
    el.querySelectorAll('[data-ref-lock]').forEach(cb => cb.onchange = () => {
      layerState('reference', cb.dataset.refLock).locked = cb.checked;
      if (R.activeKind === 'reference' && R.activeId === cb.dataset.refLock) syncTransformInputs();
      renderReferenceList();
      render();
    });
    el.querySelectorAll('[data-ref-opacity]').forEach(slider => slider.oninput = () => {
      const id = slider.dataset.refOpacity;
      layerState('reference', id).opacity = +slider.value;
      const lab = el.querySelector('[data-ref-opacity-label="' + id + '"]');
      if (lab) lab.textContent = slider.value + '%';
      render();
    });
  }

  function renderTargetList() {
    const el = $('guideTargetLayers');
    if (!el) return;
    if (!state.assets.length) {
      el.innerHTML = '<div class="status">Load PNG assets first.</div>';
      return;
    }
    el.innerHTML = state.assets.map((a, i) => {
      const s = layerState('target', a.id);
      const active = R.activeKind === 'target' && R.activeId === a.id;
      return '<div class="reference-independent-row ' + (active ? 'active' : '') + '">' +
        '<button class="reference-layer-select ' + (active ? 'active' : '') + '" data-target-active="' + a.id + '" title="Edit this target layer">' + (i + 1) + '</button>' +
        '<div class="reference-independent-main"><div class="reference-independent-name">' + esc(a.name) + '</div><small>' + a.w + '×' + a.h + '</small></div>' +
        '<label class="reference-mini-check" title="Visible"><input type="checkbox" data-target-visible="' + a.id + '" ' + (s.visible ? 'checked' : '') + '> Eye</label>' +
        '<label class="reference-mini-check" title="Lock transform"><input type="checkbox" data-target-lock="' + a.id + '" ' + (s.locked ? 'checked' : '') + '> Lock</label>' +
        '<label class="reference-mini-check" title="Include in export"><input type="checkbox" data-target-export="' + a.id + '" ' + (s.export ? 'checked' : '') + '> Export</label>' +
        '<div class="reference-layer-opacity"><input type="range" min="0" max="100" value="' + s.opacity + '" data-target-opacity="' + a.id + '"><small data-target-opacity-label="' + a.id + '">' + s.opacity + '%</small></div>' +
      '</div>';
    }).join('');

    el.querySelectorAll('[data-target-active]').forEach(b => b.onclick = () => activate('target', b.dataset.targetActive));
    el.querySelectorAll('[data-target-visible]').forEach(cb => cb.onchange = () => {
      layerState('target', cb.dataset.targetVisible).visible = cb.checked;
      render();
    });
    el.querySelectorAll('[data-target-lock]').forEach(cb => cb.onchange = () => {
      layerState('target', cb.dataset.targetLock).locked = cb.checked;
      if (R.activeKind === 'target' && R.activeId === cb.dataset.targetLock) syncTransformInputs();
      renderTargetList();
      render();
    });
    el.querySelectorAll('[data-target-export]').forEach(cb => cb.onchange = () => {
      layerState('target', cb.dataset.targetExport).export = cb.checked;
      render();
    });
    el.querySelectorAll('[data-target-opacity]').forEach(slider => slider.oninput = () => {
      const id = slider.dataset.targetOpacity;
      layerState('target', id).opacity = +slider.value;
      const lab = el.querySelector('[data-target-opacity-label="' + id + '"]');
      if (lab) lab.textContent = slider.value + '%';
      render();
    });
  }

  function renderLists() {
    renderReferenceList();
    renderTargetList();
  }

  function syncAssets() {
    const canvasSel = $('guideReferenceCanvas');
    if (!canvasSel) return;
    const valid = new Set(state.assets.map(a => a.id));
    Object.keys(R.refLayers).forEach(id => { if (!valid.has(id)) delete R.refLayers[id]; });
    Object.keys(R.targetLayers).forEach(id => { if (!valid.has(id)) delete R.targetLayers[id]; });

    const options = state.assets.map((a, i) => '<option value="' + a.id + '">' + (i + 1) + ' · ' + esc(a.name) + ' (' + a.w + '×' + a.h + ')</option>').join('');
    canvasSel.innerHTML = options || '<option value="">Load assets first</option>';

    if (!state.assets.length) {
      R.canvasId = R.activeId = null;
      renderLists();
      render();
      return;
    }

    if (!valid.has(R.canvasId)) R.canvasId = state.assets[0].id;
    canvasSel.value = R.canvasId;

    // Ensure all layer states exist without overwriting existing work.
    state.assets.forEach(a => {
      layerState('reference', a.id);
      layerState('target', a.id);
    });

    const canvasState = layerState('reference', R.canvasId);
    if (canvasState && !R.guidesLoaded && !loadGuidePreset()) writeGuideControls(defaultGuides(canvasAsset()));
    R.guidesLoaded = true;

    if (!R.activeId || !valid.has(R.activeId)) {
      R.activeKind = 'reference';
      R.activeId = R.canvasId;
    }
    renderLists();
    syncTransformInputs();
    render();
  }

  function syncTransformInputs() {
    const asset = activeAsset();
    const st = currentState();
    const label = $('guideEditingLabel');
    if (!asset || !st) {
      if (label) label.textContent = 'No layer selected';
      return;
    }
    if (label) label.innerHTML = '<b>' + (R.activeKind === 'reference' ? 'Reference' : 'Target') + ':</b> ' + esc(asset.name) + (st.locked ? ' · 🔒 locked' : '');
    $('guideTargetX').value = +st.cx.toFixed(2);
    $('guideTargetY').value = +st.cy.toFixed(2);
    $('guideScaleX').value = +(st.sx * 100).toFixed(3);
    $('guideScaleY').value = +(st.sy * 100).toFixed(3);
    $('guideLockAspect').checked = st.lockAspect !== false;
    const rect = layerRect(asset, st);
    $('guideTargetSize').textContent = rect ? Math.round(rect.w) + ' × ' + Math.round(rect.h) + 'px' : '—';
    const disabled = st.locked;
    ['guideTargetX','guideTargetY','guideScaleX','guideScaleY','guideLockAspect','guideCenterSprite','guideFitWidth','guideResetSprite','guideNudgeUp','guideNudgeDown','guideNudgeLeft','guideNudgeRight'].forEach(id => { if ($(id)) $(id).disabled = disabled; });
  }

  function drawHorizontal(ctx, ref, g) {
    if (!g.hEnabled) return;
    ctx.save(); ctx.strokeStyle = g.hColor; ctx.fillStyle = g.hColor; ctx.lineWidth = 2; ctx.setLineDash([14,8]);
    ctx.beginPath(); ctx.moveTo(0, g.hY + .5); ctx.lineTo(ref.w, g.hY + .5); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif'; ctx.fillText('H ' + Math.round(g.hY) + 'px', 10, Math.max(14, g.hY - 7)); ctx.restore();
  }

  function drawCircle(ctx, g) {
    if (!g.circleEnabled) return;
    ctx.save(); ctx.strokeStyle = g.circleColor; ctx.fillStyle = g.circleColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.circleX, g.circleY, g.circleR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.circleX - 10, g.circleY); ctx.lineTo(g.circleX + 10, g.circleY); ctx.moveTo(g.circleX, g.circleY - 10); ctx.lineTo(g.circleX, g.circleY + 10); ctx.stroke();
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif'; ctx.fillText('R ' + Math.round(g.circleR) + 'px', g.circleX + g.circleR + 7, g.circleY); ctx.restore();
  }

  function drawVerticalRuler(ctx, g) {
    if (!g.vEnabled) return;
    const top = Math.min(g.vTop, g.vBottom), bottom = Math.max(g.vTop, g.vBottom), step = Math.max(1, g.vStep), majorEvery = Math.max(1, g.vMajor);
    ctx.save(); ctx.strokeStyle = g.vColor; ctx.fillStyle = g.vColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.vX + .5, top); ctx.lineTo(g.vX + .5, bottom); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
    let index = 0;
    for (let y = top; y <= bottom + .01; y += step, index++) {
      const major = index % majorEvery === 0, len = major ? 18 : 10;
      ctx.beginPath(); ctx.moveTo(g.vX - len, y + .5); ctx.lineTo(g.vX + len, y + .5); ctx.stroke();
      if (major) ctx.fillText(String(Math.round(y)), g.vX + len + 5, y + 4);
    }
    ctx.restore();
  }

  function drawLayer(ctx, asset, st) {
    if (!asset || !st?.visible) return;
    const t = layerRect(asset, st);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, st.opacity / 100));
    ctx.imageSmoothingEnabled = !$('guidePixel').checked;
    ctx.drawImage(asset.img, t.x, t.y, t.w, t.h);
    ctx.restore();
  }

  function drawActiveOutline(ctx) {
    const asset = activeAsset(), st = currentState();
    if (!asset || !st || !st.visible) return;
    const t = layerRect(asset, st);
    ctx.save();
    ctx.strokeStyle = st.locked ? '#fbbf24' : (R.activeKind === 'reference' ? '#38bdf8' : '#fb7185');
    ctx.lineWidth = 2;
    ctx.setLineDash([8,5]);
    ctx.strokeRect(t.x + 1, t.y + 1, Math.max(0, t.w - 2), Math.max(0, t.h - 2));
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillText((R.activeKind === 'reference' ? 'REF' : 'TARGET') + (st.locked ? ' · LOCKED' : ''), t.x + 6, Math.max(14, t.y - 6));
    ctx.restore();
  }

  function render() {
    const c = $('guideCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const ref = canvasAsset();
    if (!ref) {
      c.width = c.height = 1;
      ctx.clearRect(0,0,1,1);
      $('guideMetrics').innerHTML = '';
      $('guideSummary').textContent = 'Load PNG layers in Assets.';
      return;
    }

    c.width = ref.w;
    c.height = ref.h;
    ctx.clearRect(0,0,c.width,c.height);

    for (const asset of state.assets) drawLayer(ctx, asset, layerState('reference', asset.id));
    for (const asset of state.assets) drawLayer(ctx, asset, layerState('target', asset.id));

    const g = readGuideControls();
    drawHorizontal(ctx, ref, g);
    drawCircle(ctx, g);
    drawVerticalRuler(ctx, g);
    drawActiveOutline(ctx);

    applyView();
    syncTransformInputs();

    const refs = visibleReferenceLayers(), targets = visibleTargetLayers(), exports = exportTargetLayers();
    $('guideMetrics').innerHTML =
      '<div class="metric"><b>' + ref.w + '×' + ref.h + '</b><span>output canvas</span></div>' +
      '<div class="metric"><b>' + refs.length + '</b><span>visible references</span></div>' +
      '<div class="metric"><b>' + targets.length + '</b><span>visible targets</span></div>' +
      '<div class="metric"><b>' + exports.length + '</b><span>export targets</span></div>';

    const asset = activeAsset(), st = currentState();
    if (asset && st) {
      const rect = layerRect(asset, st);
      $('guideSummary').innerHTML =
        '<b>Editing:</b> ' + (R.activeKind === 'reference' ? 'Reference · ' : 'Target · ') + esc(asset.name) +
        '<br><b>Centre:</b> ' + st.cx.toFixed(2) + ', ' + st.cy.toFixed(2) + 'px' +
        '<br><b>Size:</b> ' + rect.w.toFixed(1) + ' × ' + rect.h.toFixed(1) + 'px' +
        '<br><b>Scale:</b> ' + (st.sx * 100).toFixed(3) + '% / ' + (st.sy * 100).toFixed(3) + '%' +
        '<br><b>State:</b> ' + (st.visible ? 'visible' : 'hidden') + ' · ' + (st.locked ? 'locked' : 'editable') +
        (R.activeKind === 'target' ? ' · ' + (st.export ? 'export enabled' : 'not exporting') : '');
    }
  }

  function applyView() {
    const c = $('guideCanvas');
    if (!c) return;
    c.style.width = Math.max(1, c.width * R.viewZoom) + 'px';
    c.style.height = Math.max(1, c.height * R.viewZoom) + 'px';
    c.style.transform = 'translate(calc(-50% + ' + R.viewX + 'px), calc(-50% + ' + R.viewY + 'px))';
    $('guideZoom').value = Math.max(5, Math.min(800, R.viewZoom * 100));
    $('guideZoomLabel').textContent = Math.round(R.viewZoom * 100) + '%';
    $('guideToolbarZoom').textContent = Math.round(R.viewZoom * 100) + '%';
  }

  function fitView() {
    const ref = canvasAsset(), vp = $('guideViewport');
    if (!ref || !vp) return;
    const rr = vp.getBoundingClientRect();
    if (rr.width < 10 || rr.height < 10) return;
    const pad = 32;
    R.viewZoom = Math.max(.05, Math.min(8, (rr.width - pad) / ref.w, (rr.height - pad) / ref.h));
    R.viewX = R.viewY = 0;
    applyView();
  }

  function setMode(mode) {
    R.mode = mode;
    $('guideModeMove').classList.toggle('active', mode === 'move');
    $('guideModePan').classList.toggle('active', mode === 'pan');
    $('guideViewport').classList.toggle('pan-mode', mode === 'pan');
    $('guideHelp').textContent = mode === 'pan'
      ? 'Pan preview · pinch or scroll to zoom · layer transforms stay fixed'
      : 'Drag the selected unlocked layer · all other layers stay exactly where they are';
  }

  function changeActive(mutator, message) {
    const st = currentState();
    if (!st || st.locked) {
      if (st?.locked) setStatus('That layer is locked. Unlock it before editing.');
      return;
    }
    mutator(st);
    syncTransformInputs();
    render();
    if (message) setStatus(message);
  }

  function centerActive() {
    const ref = canvasAsset();
    if (!ref) return;
    changeActive(st => { st.cx = ref.w / 2; st.cy = ref.h / 2; }, 'Active layer centred.');
  }

  function fitActiveWidth() {
    const ref = canvasAsset(), asset = activeAsset();
    if (!ref || !asset) return;
    changeActive(st => {
      const s = ref.w / asset.w;
      st.sx = st.sy = s;
      st.cx = ref.w / 2;
    }, 'Active layer fitted to output width.');
  }

  function resetActive() {
    const asset = activeAsset(), ref = canvasAsset();
    if (!asset || !ref) return;
    changeActive(st => {
      st.cx = ref.w / 2; st.cy = ref.h / 2; st.sx = 1; st.sy = 1;
    }, 'Active layer transform reset.');
  }

  function moveActive(dx, dy) {
    changeActive(st => { st.cx += dx; st.cy += dy; });
  }

  function setAllReferenceLocks(lock) {
    state.assets.forEach(a => layerState('reference', a.id).locked = lock);
    renderLists(); syncTransformInputs(); render();
    setStatus(lock ? 'All reference layers locked.' : 'All reference layers unlocked.');
  }

  function setReferenceVisibility(visible) {
    state.assets.forEach(a => layerState('reference', a.id).visible = visible);
    renderReferenceList(); render();
  }

  function setTargetVisibility(visible) {
    state.assets.forEach(a => layerState('target', a.id).visible = visible);
    renderTargetList(); render();
  }

  function setAllTargetExports(on) {
    state.assets.forEach(a => layerState('target', a.id).export = on);
    renderTargetList(); render();
  }

  function renderLayerCanvas(asset, st) {
    const ref = canvasAsset();
    if (!ref || !asset || !st) return null;
    const out = document.createElement('canvas');
    out.width = ref.w;
    out.height = ref.h;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = !$('guidePixel').checked;
    const t = layerRect(asset, st);
    ctx.drawImage(asset.img, t.x, t.y, t.w, t.h);
    return out;
  }

  function layerBlob(asset, st) {
    return new Promise((resolve, reject) => {
      const out = renderLayerCanvas(asset, st);
      if (!out) return reject(new Error('Could not render layer'));
      out.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode PNG')), 'image/png');
    });
  }

  async function exportActiveTarget() {
    if (R.activeKind !== 'target') return setStatus('Select a target layer first.');
    const asset = activeAsset(), st = currentState();
    if (!asset || !st) return;
    try {
      downloadBlob(await layerBlob(asset, st), strip(asset.name) + '_positioned.png');
      setStatus('Active target exported.');
    } catch (err) {
      console.error(err); setStatus('Active export failed.');
    }
  }

  async function exportSelectedIndividually() {
    const layers = exportTargetLayers();
    if (!layers.length) return setStatus('Mark at least one target layer for export.');
    setStatus('Preparing ' + layers.length + ' PNGs…');
    try {
      for (let i = 0; i < layers.length; i++) {
        const asset = layers[i], st = layerState('target', asset.id);
        downloadBlob(await layerBlob(asset, st), strip(asset.name) + '_positioned.png');
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      setStatus('Downloaded ' + layers.length + ' individually positioned PNGs.');
    } catch (err) {
      console.error(err); setStatus('Individual export failed. Try ZIP export.');
    }
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) { let crc = 0xffffffff; for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
  function blobBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(b => new Uint8Array(b));
    return new Promise((resolve,reject) => {
      const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result)); r.onerror = () => reject(r.error || new Error('Could not read PNG')); r.readAsArrayBuffer(blob);
    });
  }
  function header(size){return new Uint8Array(size)} function u16(v,o,x){v.setUint16(o,x,true)} function u32(v,o,x){v.setUint32(o,x>>>0,true)}
  function dosTime(d){return ((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((d.getSeconds()/2)&31)}
  function dosDate(d){return (((Math.max(1980,d.getFullYear())-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31)}
  async function zipStore(files) {
    const enc = new TextEncoder(), locals = [], centrals = [], now = new Date(); let offset = 0;
    for (const file of files) {
      const name = enc.encode(file.name), data = await blobBytes(file.blob), crc = crc32(data);
      const local = header(30 + name.length), lv = new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u16(lv,10,dosTime(now));u16(lv,12,dosDate(now));u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);u16(lv,28,0);local.set(name,30);locals.push(local,data);
      const central = header(46 + name.length), cv = new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u16(cv,12,dosTime(now));u16(cv,14,dosDate(now));u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);central.set(name,46);centrals.push(central);offset += local.length + data.length;
    }
    const size = centrals.reduce((sum,p)=>sum+p.length,0), end = header(22), ev = new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,size);u32(ev,16,offset);u16(ev,20,0);
    return new Blob([...locals,...centrals,end],{type:'application/zip'});
  }

  async function exportSelectedZip() {
    const layers = exportTargetLayers();
    if (!layers.length) return setStatus('Mark at least one target layer for export.');
    const button = $('guideExportZip'); button.disabled = true;
    try {
      const files = [];
      for (const asset of layers) files.push({name: strip(asset.name) + '_positioned.png', blob: await layerBlob(asset, layerState('target', asset.id))});
      downloadBlob(await zipStore(files), 'spriter-positioned-targets.zip');
      setStatus('ZIP ready · ' + files.length + ' independently positioned PNGs.');
    } catch (err) {
      console.error(err); setStatus('ZIP export failed.');
    } finally { button.disabled = false; }
  }

  function exportSetup() {
    const ref = canvasAsset();
    if (!ref) return setStatus('Choose an output canvas first.');
    const serialise = (kind, asset) => {
      const st = layerState(kind, asset.id);
      return {name:asset.name,sourceWidth:asset.w,sourceHeight:asset.h,centreX:st.cx,centreY:st.cy,scaleX:st.sx,scaleY:st.sy,visible:st.visible,opacity:st.opacity,locked:st.locked,...(kind==='target'?{export:st.export}:{})};
    };
    const payload = {
      app:'SpriteR', format:'Reference Layout', version:3,
      outputCanvas:{name:ref.name,width:ref.w,height:ref.h},
      references:state.assets.map(a=>serialise('reference',a)),
      targets:state.assets.map(a=>serialise('target',a)),
      guides:readGuideControls()
    };
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'spriter-reference-layout.json');
    setStatus('Complete layer setup JSON exported.');
  }

  $('guideReferenceCanvas').onchange = () => {
    R.canvasId = $('guideReferenceCanvas').value;
    const ref = canvasAsset();
    if (ref && !R.guidesLoaded) writeGuideControls(defaultGuides(ref));
    state.assets.forEach(a => { layerState('reference',a.id); layerState('target',a.id); });
    if (!R.activeId) { R.activeKind='reference'; R.activeId=R.canvasId; }
    renderLists(); syncTransformInputs(); render(); requestAnimationFrame(fitView);
  };

  $('guideLockAllRefs').onclick = () => setAllReferenceLocks(true);
  $('guideUnlockAllRefs').onclick = () => setAllReferenceLocks(false);
  $('guideShowAllRefs').onclick = () => setReferenceVisibility(true);
  $('guideHideAllRefs').onclick = () => setReferenceVisibility(false);
  $('guideShowAllTargets').onclick = () => setTargetVisibility(true);
  $('guideHideAllTargets').onclick = () => setTargetVisibility(false);
  $('guideExportAllTargets').onclick = () => setAllTargetExports(true);
  $('guideExportNoTargets').onclick = () => setAllTargetExports(false);

  $('guideTargetX').oninput = () => changeActive(st => { st.cx = n('guideTargetX', st.cx); });
  $('guideTargetY').oninput = () => changeActive(st => { st.cy = n('guideTargetY', st.cy); });
  $('guideScaleX').oninput = () => changeActive(st => {
    st.sx = Math.max(.01,n('guideScaleX',100)/100);
    if (st.lockAspect !== false) { st.sy = st.sx; $('guideScaleY').value = $('guideScaleX').value; }
  });
  $('guideScaleY').oninput = () => changeActive(st => {
    st.sy = Math.max(.01,n('guideScaleY',100)/100);
    if (st.lockAspect !== false) { st.sx = st.sy; $('guideScaleX').value = $('guideScaleY').value; }
  });
  $('guideLockAspect').onchange = () => changeActive(st => { st.lockAspect = bool('guideLockAspect'); });
  $('guideCenterSprite').onclick = centerActive;
  $('guideFitWidth').onclick = fitActiveWidth;
  $('guideResetSprite').onclick = resetActive;
  $('guideNudgeLeft').onclick = () => moveActive(-n('guideNudgeStep',1),0);
  $('guideNudgeRight').onclick = () => moveActive(n('guideNudgeStep',1),0);
  $('guideNudgeUp').onclick = () => moveActive(0,-n('guideNudgeStep',1));
  $('guideNudgeDown').onclick = () => moveActive(0,n('guideNudgeStep',1));

  ['guideHEnabled','guideHY','guideHColor','guideCircleEnabled','guideCircleX','guideCircleY','guideCircleR','guideCircleColor','guideVEnabled','guideVX','guideVTop','guideVBottom','guideVStep','guideVMajor','guideVColor','guidePixel'].forEach(id => {
    const el=$(id); if(!el)return; el.addEventListener(el.type==='checkbox'||el.type==='color'?'change':'input',render);
  });

  $('guideSavePreset').onclick = saveGuidePreset;
  $('guideResetPreset').onclick = resetGuides;
  $('guideExportSprite').onclick = exportActiveTarget;
  $('guideExportSelected').onclick = exportSelectedIndividually;
  $('guideExportZip').onclick = exportSelectedZip;
  $('guideExportJson').onclick = exportSetup;
  $('guideModeMove').onclick = () => setMode('move');
  $('guideModePan').onclick = () => setMode('pan');
  $('guideZoom').oninput = () => { R.viewZoom=n('guideZoom',100)/100; applyView(); };
  $('guideFit').onclick = fitView;
  $('guideActual').onclick = () => { R.viewZoom=1;R.viewX=R.viewY=0;applyView(); };
  $('guideResetView').onclick = () => { R.viewX=R.viewY=0;applyView(); };
  $('guideZoomOut').onclick = () => { R.viewZoom=Math.max(.05,R.viewZoom/1.2);applyView(); };
  $('guideZoomIn').onclick = () => { R.viewZoom=Math.min(8,R.viewZoom*1.2);applyView(); };
  $('guideToolbarFit').onclick = fitView;

  const canvas=$('guideCanvas'), viewport=$('guideViewport'), pointers=new Map();
  let drag=null, gesture=null;

  function canvasPoint(e) {
    const rr=canvas.getBoundingClientRect();
    return {x:(e.clientX-rr.left)*canvas.width/rr.width,y:(e.clientY-rr.top)*canvas.height/rr.height,rect:rr};
  }
  function insideActive(pt) {
    const asset=activeAsset(),st=currentState(),t=layerRect(asset,st);
    return !!t&&pt.x>=t.x&&pt.x<=t.x+t.w&&pt.y>=t.y&&pt.y<=t.y+t.h;
  }
  function beginGesture() {
    const pts=[...pointers.values()];
    if(pts.length<2)return;
    gesture={distance:Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)),zoom:R.viewZoom,midX:(pts[0].x+pts[1].x)/2,midY:(pts[0].y+pts[1].y)/2,viewX:R.viewX,viewY:R.viewY};
    drag=null;
  }

  viewport.addEventListener('pointerdown',e=>{
    if(!canvasAsset())return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); viewport.setPointerCapture?.(e.pointerId);
    if(pointers.size===2){beginGesture();e.preventDefault();return}
    if(R.mode==='pan'){drag={kind:'pan',x:e.clientX,y:e.clientY,vx:R.viewX,vy:R.viewY};e.preventDefault();return}
    const st=currentState(); if(!st||st.locked)return;
    const p=canvasPoint(e);
    if(insideActive(p)){drag={kind:'layer',x:e.clientX,y:e.clientY,cx:st.cx,cy:st.cy,rect:p.rect};e.preventDefault()}
  });
  viewport.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(gesture&&pointers.size>=2){
      const pts=[...pointers.values()],dist=Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y));
      R.viewZoom=Math.max(.05,Math.min(8,gesture.zoom*dist/gesture.distance));
      R.viewX=gesture.viewX+((pts[0].x+pts[1].x)/2-gesture.midX); R.viewY=gesture.viewY+((pts[0].y+pts[1].y)/2-gesture.midY); applyView();e.preventDefault();return;
    }
    if(drag?.kind==='pan'){R.viewX=drag.vx+e.clientX-drag.x;R.viewY=drag.vy+e.clientY-drag.y;applyView();e.preventDefault();return}
    if(drag?.kind==='layer'){
      const st=currentState(); if(!st||st.locked)return;
      st.cx=drag.cx+(e.clientX-drag.x)*canvas.width/drag.rect.width; st.cy=drag.cy+(e.clientY-drag.y)*canvas.height/drag.rect.height;
      syncTransformInputs(); render(); e.preventDefault();
    }
  });
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)gesture=null;drag=null};
  viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
  viewport.addEventListener('wheel',e=>{if(!canvasAsset())return;e.preventDefault();R.viewZoom=Math.max(.05,Math.min(8,R.viewZoom*Math.exp(-e.deltaY*.002)));applyView()},{passive:false});

  window.addEventListener('keydown',e=>{
    if(!$('referenceTab').classList.contains('active'))return;
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(R.mode!=='move')return;
    const st=currentState(); if(!st||st.locked)return;
    const step=e.shiftKey?10:(e.altKey?.25:1);
    if(e.key==='ArrowLeft')moveActive(-step,0);else if(e.key==='ArrowRight')moveActive(step,0);else if(e.key==='ArrowUp')moveActive(0,-step);else if(e.key==='ArrowDown')moveActive(0,step);else return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);

  window.addEventListener('spriter:assetschanged',syncAssets);
  document.querySelector('[data-tab="referenceTab"]')?.addEventListener('click',()=>requestAnimationFrame(()=>{syncAssets();render();fitView()}));
  let lastWidth=window.innerWidth;
  window.addEventListener('resize',()=>{const changed=Math.abs(window.innerWidth-lastWidth)>24;lastWidth=window.innerWidth;if(changed&&$('referenceTab').classList.contains('active'))requestAnimationFrame(fitView)});

  setMode(R.mode);
  syncAssets();
})();