window.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('play').click()}if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1)});
setMode('files');
previewBatchNames();
renderAll();
updateAssetHeader();