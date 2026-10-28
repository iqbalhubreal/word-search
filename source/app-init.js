/* ---------- start ---------- */
(function init() {
  loadLayout();
  loadBook();
  syncBookOutputs();
  $('words').value = SAMPLE_WORDS;
  restoreLangPrefs();
  setCross(2);
  buildMask();
  syncShapeButtons();
  updatePx();
  regen();
  libInit();
  setTimeout(() => { if (BK.ai) drawCoverPreview(); }, 500);
  const wrap = desk.parentElement;
  let lastW = 0;
  new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; render(); } }).observe(wrap);
  window.addEventListener('resize', () => render());
  [$('cols'), $('rows'), $('pq')].forEach(paintRange);
  drawHero();
  loadFonts().then(() => { render(); drawHero(); });
})();
