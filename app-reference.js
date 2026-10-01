(() => {
  const R = state.referenceLayout = state.referenceLayout || {};
  Object.assign(R, {
    refId: R.refId || null,
    targetId: R.targetId || null,
    cx: Number.isFinite(R.cx) ? R.cx : null,
    cy: Number.isFinite(R.cy) ? R.cy : null,
    sx: Number.isFinite(R.sx) ? R.sx : 1,
    sy: Number.isFinite(R.sy) ? R.sy : 1,
    lockAspect: R.lockAspect !== false,
    viewZoom: Number.isFinite(R.viewZoom) ? R.viewZoom : 1,
    viewX: Number.isFinite(R.viewX) ? R.viewX : 0,
    viewY: Number.isFinite(R.viewY) ? R.viewY : 0,
    mode: R.mode || 'move',
    guidesLoaded: !!R.guidesLoaded
  });

  const getAsset = id => state.assets.find(a => a.id === id) || null;
  const refAsset = () => getAsset(R.refId);
  const targetAsset = () => getAsset(R.targetId);
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

  function defaultGuides(ref = refAsset()) {
    const w = ref?.w || 1000;
    const h = ref?.h || 1000;
    const step = Math.max(10, Math.round(h / 10));
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
      vStep: step,
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
        const parsed = JSON.parse(raw);
        writeGuideControls({...defaultGuides(), ...parsed});
        R.guidesLoaded = true;
        setStatus('Saved guide preset loaded.');
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
    } catch (err) {
      setStatus('Could not save the guide preset in this browser.');
    }
  }

  function resetGuides() {
    writeGuideControls(defaultGuides());
    renderReferenceLayout();
    setStatus('Guides reset relative to the current reference image.');
  }

  function syncSelectors() {
    const refSel = $('guideReference');
    const targetSel = $('guideTarget');
    if (!refSel || !targetSel) return;
    const oldRef = R.refId;
    const oldTarget = R.targetId;
    const options = state.assets.map((a, i) => '<option value="' + a.id + '">' + (i + 1) + ' · ' + esc(a.name) + ' (' + a.w + '×' + a.h + ')</option>').join('');
    refSel.innerHTML = options || '<option value="">Load assets first</option>';
    targetSel.innerHTML = options || '<option value="">Load assets first</option>';
    if (!state.assets.length) {
      R.refId = R.targetId = null;
      renderReferenceLayout();
      return;
    }
    R.refId = state.assets.some(a => a.id === oldRef) ? oldRef : state.assets[0].id;
    R.targetId = state.assets.some(a => a.id === oldTarget) ? oldTarget : (state.assets[1]?.id || state.assets[0].id);
    refSel.value = R.refId;
    targetSel.value = R.targetId;
    const ref = refAsset();
    if (R.cx == null || R.cy == null) {
      R.cx = ref.w / 2;
      R.cy = ref.h / 2;
    }
    if (!R.guidesLoaded) {
      if (!loadGuidePreset()) writeGuideControls(defaultGuides(ref));
      R.guidesLoaded = true;
    }
    syncTransformInputs();
    renderReferenceLayout();
  }

  function targetRect() {
    const ref = refAsset();
    const target = targetAsset();
    if (!ref || !target) return null;
    const w = target.w * R.sx;
    const h = target.h * R.sy;
    return {x: R.cx - w / 2, y: R.cy - h / 2, w, h};
  }

  function syncTransformInputs() {
    const target = targetAsset();
    if (!target) return;
    $('guideTargetX').value = +(R.cx ?? 0).toFixed(2);
    $('guideTargetY').value = +(R.cy ?? 0).toFixed(2);
    $('guideScaleX').value = +(R.sx * 100).toFixed(3);
    $('guideScaleY').value = +(R.sy * 100).toFixed(3);
    $('guideLockAspect').checked = R.lockAspect;
    const rect = targetRect();
    $('guideTargetSize').textContent = rect ? Math.round(rect.w) + ' × ' + Math.round(rect.h) + 'px' : '—';
  }

  function drawHorizontal(ctx, ref, g) {
    if (!g.hEnabled) return;
    ctx.save();
    ctx.strokeStyle = g.hColor;
    ctx.fillStyle = g.hColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 8]);
    ctx.beginPath();
    ctx.moveTo(0, g.hY + .5);
    ctx.lineTo(ref.w, g.hY + .5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillText('H ' + Math.round(g.hY) + 'px', 10, Math.max(14, g.hY - 7));
    ctx.restore();
  }

  function drawCircle(ctx, g) {
    if (!g.circleEnabled) return;
    ctx.save();
    ctx.strokeStyle = g.circleColor;
    ctx.fillStyle = g.circleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.circleX, g.circleY, g.circleR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.circleX - 10, g.circleY);
    ctx.lineTo(g.circleX + 10, g.circleY);
    ctx.moveTo(g.circleX, g.circleY - 10);
    ctx.lineTo(g.circleX, g.circleY + 10);
    ctx.stroke();
    ctx.font = '12px ui-sans-serif,system-ui,sans-serif';
    ctx.fillText('R ' + Math.round(g.circleR) + 'px', g.circleX + g.circleR + 7, g.circleY);
    ctx.restore();
  }

  function drawVerticalRuler(ctx, g) {
    if (!g.vEnabled) return;
    const top = Math.min(g.vTop, g.vBottom);
    const bottom = Math.max(g.vTop, g.vBottom);
    const step = Math.max(1, g.vStep);
    const majorEvery = Math.max(1, g.vMajor);
    ctx.save();
    ctx.strokeStyle = g.vColor;
    ctx.fillStyle = g.vColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.vX + .5, top);
    ctx.lineTo(g.vX + .5, bottom);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
    let index = 0;
    for (let y = top; y <= bottom + .01; y += step, index++) {
      const major = index % majorEvery === 0;
      const len = major ? 18 : 10;
      ctx.beginPath();
      ctx.moveTo(g.vX - len, y + .5);
      ctx.lineTo(g.vX + len, y + .5);
      ctx.stroke();
      if (major) ctx.fillText(String(Math.round(y)), g.vX + len + 5, y + 4);
    }
    if ((bottom - top) % step > 1) {
      ctx.beginPath();
      ctx.moveTo(g.vX - 18, bottom + .5);
      ctx.lineTo(g.vX + 18, bottom + .5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderReferenceLayout() {
    const c = $('guideCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const ref = refAsset();
    const target = targetAsset();
    if (!ref) {
      c.width = c.height = 1;
      ctx.clearRect(0, 0, 1, 1);
      $('guideMetrics').innerHTML = '';
      $('guideSummary').textContent = 'Load a reference image and transparent sprite in the Assets tab.';
      return;
    }
    c.width = ref.w;
    c.height = ref.h;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = !$('guidePixel').checked;
    const refAlpha = n('guideRefOpacity', 100) / 100;
    const targetAlpha = n('guideTargetOpacity', 85) / 100;
    ctx.save();
    ctx.globalAlpha = refAlpha;
    ctx.drawImage(ref.img, 0, 0, ref.w, ref.h);
    ctx.restore();
    if (target) {
      const t = targetRect();
      ctx.save();
      ctx.globalAlpha = targetAlpha;
      ctx.imageSmoothingEnabled = !$('guidePixel').checked;
      ctx.drawImage(target.img, t.x, t.y, t.w, t.h);
      ctx.restore();
    }
    const g = readGuideControls();
    drawHorizontal(ctx, ref, g);
    drawCircle(ctx, g);
    drawVerticalRuler(ctx, g);
    applyView();
    syncTransformInputs();
    $('guideMetrics').innerHTML = '<div class="metric"><b>' + ref.w + '×' + ref.h + '</b><span>reference canvas</span></div>' +
      (target ? '<div class="metric"><b>' + (R.sx * 100).toFixed(2) + '%</b><span>sprite scale</span></div><div class="metric"><b>' + R.cx.toFixed(1) + ', ' + R.cy.toFixed(1) + '</b><span>sprite centre</span></div>' : '');
    const rect = targetRect();
    $('guideSummary').innerHTML = target ? '<b>Sprite centre:</b> ' + R.cx.toFixed(2) + ', ' + R.cy.toFixed(2) + 'px<br><b>Sprite size:</b> ' + rect.w.toFixed(1) + ' × ' + rect.h.toFixed(1) + 'px<br><b>Scale:</b> ' + (R.sx * 100).toFixed(3) + '% / ' + (R.sy * 100).toFixed(3) + '%' : 'Choose a target sprite.';
    $('guideRefOpacityLabel').textContent = Math.round(refAlpha * 100) + '%';
    $('guideTargetOpacityLabel').textContent = Math.round(targetAlpha * 100) + '%';
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
    const ref = refAsset();
    const vp = $('guideViewport');
    if (!ref || !vp) return;
    const rr = vp.getBoundingClientRect();
    if (rr.width < 10 || rr.height < 10) return;
    const pad = 32;
    R.viewZoom = Math.max(.05, Math.min(8, (rr.width - pad) / ref.w, (rr.height - pad) / ref.h));
    R.viewX = 0;
    R.viewY = 0;
    applyView();
  }

  function setMode(mode) {
    R.mode = mode;
    $('guideModeMove').classList.toggle('active', mode === 'move');
    $('guideModePan').classList.toggle('active', mode === 'pan');
    $('guideViewport').classList.toggle('pan-mode', mode === 'pan');
    $('guideHelp').textContent = mode === 'pan' ? 'Pan preview · pinch or scroll to zoom · sprite stays fixed' : 'Drag sprite to position · arrow keys nudge · pinch or scroll to zoom';
  }

  function moveSprite(dx, dy) {
    if (!targetAsset()) return;
    R.cx += dx;
    R.cy += dy;
    syncTransformInputs();
    renderReferenceLayout();
  }

  function exportAlignedSprite() {
    const ref = refAsset();
    const target = targetAsset();
    if (!ref || !target) return setStatus('Choose a reference image and target sprite first.');
    const out = document.createElement('canvas');
    out.width = ref.w;
    out.height = ref.h;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = !$('guidePixel').checked;
    const t = targetRect();
    ctx.drawImage(target.img, t.x, t.y, t.w, t.h);
    out.toBlob(blob => downloadBlob(blob, strip(target.name) + '_positioned.png'));
    setStatus('Positioned sprite exported on the reference canvas. Guides and reference image were not baked in.');
  }

  function exportSetup() {
    const ref = refAsset();
    const target = targetAsset();
    if (!ref || !target) return setStatus('Choose a reference and target first.');
    const payload = {
      app: 'SpriteR',
      format: 'Reference Layout',
      version: 1,
      reference: {name: ref.name, width: ref.w, height: ref.h},
      target: {name: target.name, sourceWidth: target.w, sourceHeight: target.h},
      transform: {centreX: R.cx, centreY: R.cy, scaleX: R.sx, scaleY: R.sy, origin: 'centre'},
      guides: readGuideControls()
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}), strip(target.name) + '_reference-layout.json');
    setStatus('Reference layout JSON exported.');
  }

  $('guideReference').onchange = () => {
    R.refId = $('guideReference').value;
    const ref = refAsset();
    if (ref) {
      R.cx = ref.w / 2;
      R.cy = ref.h / 2;
      if (!localStorage.getItem(STORAGE_KEY)) writeGuideControls(defaultGuides(ref));
    }
    syncTransformInputs();
    renderReferenceLayout();
    requestAnimationFrame(fitView);
  };
  $('guideTarget').onchange = () => {
    R.targetId = $('guideTarget').value;
    const ref = refAsset();
    if (ref) { R.cx = ref.w / 2; R.cy = ref.h / 2; }
    R.sx = R.sy = 1;
    syncTransformInputs();
    renderReferenceLayout();
  };

  $('guideTargetX').oninput = () => { R.cx = n('guideTargetX', R.cx || 0); renderReferenceLayout(); };
  $('guideTargetY').oninput = () => { R.cy = n('guideTargetY', R.cy || 0); renderReferenceLayout(); };
  $('guideScaleX').oninput = () => {
    R.sx = Math.max(.01, n('guideScaleX', 100) / 100);
    if (R.lockAspect) { R.sy = R.sx; $('guideScaleY').value = $('guideScaleX').value; }
    renderReferenceLayout();
  };
  $('guideScaleY').oninput = () => {
    R.sy = Math.max(.01, n('guideScaleY', 100) / 100);
    if (R.lockAspect) { R.sx = R.sy; $('guideScaleX').value = $('guideScaleY').value; }
    renderReferenceLayout();
  };
  $('guideLockAspect').onchange = () => { R.lockAspect = bool('guideLockAspect'); };
  $('guideCenterSprite').onclick = () => {
    const ref = refAsset(); if (!ref) return;
    R.cx = ref.w / 2; R.cy = ref.h / 2; syncTransformInputs(); renderReferenceLayout();
  };
  $('guideResetSprite').onclick = () => {
    const ref = refAsset(); if (!ref) return;
    R.cx = ref.w / 2; R.cy = ref.h / 2; R.sx = R.sy = 1; syncTransformInputs(); renderReferenceLayout(); setStatus('Sprite transform reset.');
  };
  $('guideFitWidth').onclick = () => {
    const ref = refAsset(), target = targetAsset(); if (!ref || !target) return;
    const s = ref.w / target.w; R.sx = R.sy = s; R.cx = ref.w / 2; syncTransformInputs(); renderReferenceLayout();
  };

  ['guideHEnabled','guideHY','guideHColor','guideCircleEnabled','guideCircleX','guideCircleY','guideCircleR','guideCircleColor','guideVEnabled','guideVX','guideVTop','guideVBottom','guideVStep','guideVMajor','guideVColor','guideRefOpacity','guideTargetOpacity','guidePixel'].forEach(id => {
    const el = $(id); if (!el) return;
    el.addEventListener(el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input', renderReferenceLayout);
  });

  $('guideSavePreset').onclick = saveGuidePreset;
  $('guideResetPreset').onclick = resetGuides;
  $('guideExportSprite').onclick = exportAlignedSprite;
  $('guideExportJson').onclick = exportSetup;
  $('guideModeMove').onclick = () => setMode('move');
  $('guideModePan').onclick = () => setMode('pan');
  $('guideNudgeLeft').onclick = () => moveSprite(-n('guideNudgeStep', 1), 0);
  $('guideNudgeRight').onclick = () => moveSprite(n('guideNudgeStep', 1), 0);
  $('guideNudgeUp').onclick = () => moveSprite(0, -n('guideNudgeStep', 1));
  $('guideNudgeDown').onclick = () => moveSprite(0, n('guideNudgeStep', 1));
  $('guideZoom').oninput = () => { R.viewZoom = n('guideZoom', 100) / 100; applyView(); };
  $('guideFit').onclick = fitView;
  $('guideActual').onclick = () => { R.viewZoom = 1; R.viewX = R.viewY = 0; applyView(); };
  $('guideResetView').onclick = () => { R.viewX = R.viewY = 0; applyView(); };
  $('guideZoomOut').onclick = () => { R.viewZoom = Math.max(.05, R.viewZoom / 1.2); applyView(); };
  $('guideZoomIn').onclick = () => { R.viewZoom = Math.min(8, R.viewZoom * 1.2); applyView(); };
  $('guideToolbarFit').onclick = fitView;

  const canvas = $('guideCanvas');
  const viewport = $('guideViewport');
  const pointers = new Map();
  let drag = null;
  let gesture = null;

  function canvasPoint(e) {
    const rr = canvas.getBoundingClientRect();
    return {x: (e.clientX - rr.left) * canvas.width / rr.width, y: (e.clientY - rr.top) * canvas.height / rr.height, rect: rr};
  }

  function inTarget(pt) {
    const t = targetRect();
    return !!t && pt.x >= t.x && pt.x <= t.x + t.w && pt.y >= t.y && pt.y <= t.y + t.h;
  }

  function beginGesture() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return;
    gesture = {
      distance: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
      zoom: R.viewZoom,
      midX: (pts[0].x + pts[1].x) / 2,
      midY: (pts[0].y + pts[1].y) / 2,
      viewX: R.viewX,
      viewY: R.viewY
    };
    drag = null;
  }

  viewport.addEventListener('pointerdown', e => {
    if (!refAsset()) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    viewport.setPointerCapture?.(e.pointerId);
    if (pointers.size === 2) { beginGesture(); e.preventDefault(); return; }
    if (R.mode === 'pan') {
      drag = {kind: 'pan', x: e.clientX, y: e.clientY, vx: R.viewX, vy: R.viewY};
      e.preventDefault();
      return;
    }
    const p = canvasPoint(e);
    if (inTarget(p)) {
      drag = {kind: 'target', x: e.clientX, y: e.clientY, cx: R.cx, cy: R.cy, rect: p.rect};
      e.preventDefault();
    }
  });

  viewport.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (gesture && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      R.viewZoom = Math.max(.05, Math.min(8, gesture.zoom * dist / gesture.distance));
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      R.viewX = gesture.viewX + (midX - gesture.midX);
      R.viewY = gesture.viewY + (midY - gesture.midY);
      applyView();
      e.preventDefault();
      return;
    }
    if (drag?.kind === 'pan') {
      R.viewX = drag.vx + e.clientX - drag.x;
      R.viewY = drag.vy + e.clientY - drag.y;
      applyView();
      e.preventDefault();
      return;
    }
    if (drag?.kind === 'target') {
      R.cx = drag.cx + (e.clientX - drag.x) * canvas.width / drag.rect.width;
      R.cy = drag.cy + (e.clientY - drag.y) * canvas.height / drag.rect.height;
      syncTransformInputs();
      renderReferenceLayout();
      e.preventDefault();
    }
  });

  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) gesture = null;
    drag = null;
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('wheel', e => {
    if (!refAsset()) return;
    e.preventDefault();
    R.viewZoom = Math.max(.05, Math.min(8, R.viewZoom * Math.exp(-e.deltaY * .002)));
    applyView();
  }, {passive: false});

  window.addEventListener('keydown', e => {
    if (!$('referenceTab').classList.contains('active')) return;
    if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (R.mode !== 'move') return;
    const step = e.shiftKey ? 10 : (e.altKey ? .25 : 1);
    if (e.key === 'ArrowLeft') moveSprite(-step, 0);
    else if (e.key === 'ArrowRight') moveSprite(step, 0);
    else if (e.key === 'ArrowUp') moveSprite(0, -step);
    else if (e.key === 'ArrowDown') moveSprite(0, step);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener('spriter:assetschanged', syncSelectors);
  document.querySelector('[data-tab="referenceTab"]')?.addEventListener('click', () => requestAnimationFrame(() => { syncSelectors(); renderReferenceLayout(); fitView(); }));
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const changed = Math.abs(window.innerWidth - lastWidth) > 24;
    lastWidth = window.innerWidth;
    if (changed && $('referenceTab').classList.contains('active')) requestAnimationFrame(fitView);
  });

  setMode(R.mode);
  syncSelectors();
})();