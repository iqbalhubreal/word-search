/* App UI: wiring controls, painting, export. */

/* ---------- words ---------- */
function clampInt(v, lo, hi, dflt) {
  v = parseInt(v, 10);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
}

function addRandom(replace) {
  if (S.mode === 'single') replace = true;
  const lim = Math.max(S.cols, S.rows);
  const count = S.mode === 'single' ? 1 : 8;
  let min = clampInt($('rmin').value, 2, 40, 4);
  let max = Math.min(clampInt($('rmax').value, 2, 40, 9), lim);
  if (min > max) min = max;
  const text = $('words').value;
  const avoid = typeof parseAvoid === 'function' ? parseAvoid() : [];
  const existing = (replace ? [] : WS.parseWords(text, S.lang).map((w) => w.cells.join(''))).concat(avoid);
  const got = WS.randomWords('Mixed', count, min, max, existing, null, S.lang);
  if (!got.length) { toast('No new words match those lengths. Widen the range or pick another theme.'); return; }
  if (got.length < count) toast('Only ' + got.length + ' words matched those lengths.');
  $('words').value = replace || !text.trim() ? got.join('\n') : text.replace(/\s+$/, '') + '\n' + got.join('\n');
  schedule(0);
}

$('words').addEventListener('input', () => schedule(S.mode === 'single' ? 500 : undefined));
$('rAdd').addEventListener('click', () => addRandom(false));
$('rReplace').addEventListener('click', () => addRandom(true));
$('wClear').addEventListener('click', () => { $('words').value = ''; schedule(0); $('words').focus(); });

/* ---------- grid size ---------- */
function paintRange(el) {
  const min = +el.min || 0, max = +el.max || 100;
  el.style.setProperty('--p', ((+el.value - min) / (max - min)) * 100 + '%');
}
function onSize(which) {
  const c = $('cols'), r = $('rows');
  if ($('lock').checked) { (which === 'cols' ? r : c).value = (which === 'cols' ? c : r).value; }
  S.cols = +c.value; S.rows = +r.value;
  $('colsOut').textContent = c.value; $('rowsOut').textContent = r.value;
  paintRange(c); paintRange(r);
  buildMask();
  schedule(40);
}
$('cols').addEventListener('input', () => onSize('cols'));
$('rows').addEventListener('input', () => onSize('rows'));
$('lock').addEventListener('change', () => { if ($('lock').checked) onSize('cols'); });
$('fill').addEventListener('change', () => { S.fill = $('fill').value; schedule(0); });

/* ---------- directions ---------- */
const compass = $('compass');
WS.DIRS.forEach((d, i) => {
  if (i === 4) {
    const core = document.createElement('div');
    core.className = 'core';
    core.textContent = 'Read';
    compass.appendChild(core);
  }
  const lab = document.createElement('label');
  lab.className = 'dir';
  lab.title = d.name;
  const inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = true;
  inp.dataset.dir = d.id;
  inp.setAttribute('aria-label', d.name);
  const s = document.createElement('span');
  s.textContent = d.arrow;
  s.setAttribute('aria-hidden', 'true');
  lab.append(inp, s);
  compass.appendChild(lab);
});
const DIR_PRESETS = {
  all: ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'], easy: ['E', 'S', 'SE'],
  straight: ['N', 'E', 'S', 'W'], diag: ['NE', 'SE', 'SW', 'NW']
};
function readDirs() {
  S.dirs = new Set(Array.from(compass.querySelectorAll('input:checked')).map((i) => i.dataset.dir));
  const match = Object.keys(DIR_PRESETS).find((k) => DIR_PRESETS[k].length === S.dirs.size && DIR_PRESETS[k].every((d) => S.dirs.has(d)));
  $('dirPreset').value = match || 'custom';
  schedule(0);
}
compass.addEventListener('change', readDirs);
$('dirPreset').addEventListener('change', () => {
  const set = DIR_PRESETS[$('dirPreset').value];
  if (!set) return;
  compass.querySelectorAll('input').forEach((i) => { i.checked = set.includes(i.dataset.dir); });
  readDirs();
});

/* ---------- crossings ---------- */
function setCross(v) {
  S.level = v;
  $('crossDesc').textContent = CROSS_TEXT[v];
}
document.querySelectorAll('input[name=cross]').forEach((r) => r.addEventListener('change', () => { setCross(+r.value); schedule(0); }));

/* ---------- shapes ---------- */
const shapesEl = $('shapes');
Object.keys(WS.MASKS).forEach((id) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'shape';
  b.dataset.id = id;
  const c = document.createElement('canvas');
  c.width = 60; c.height = 60;
  const g = c.getContext('2d');
  const m = WS.presetMask(id, 15, 15);
  g.fillStyle = '#ff8a1f';
  m.forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect(x * 4, y * 4, 4, 4); }));
  b.append(c, WS.MASKS[id].name);
  b.addEventListener('click', () => { S.maskSrc = { type: 'preset', id }; buildMask(); syncShapeButtons(); schedule(0); });
  shapesEl.appendChild(b);
});
function syncShapeButtons() {
  shapesEl.querySelectorAll('.shape').forEach((b) => {
    b.setAttribute('aria-pressed', String(S.maskSrc.type === 'preset' && S.maskSrc.id === b.dataset.id));
  });
}
function applyMask(m, src) {
  S.mask = m; S.maskSrc = src;
  syncShapeButtons(); schedule(0); render();
}
$('maskTextBtn').addEventListener('click', () => {
  const t = $('maskText').value.trim();
  if (!t) { toast('Type a letter or a short word first.'); $('maskText').focus(); return; }
  const m = textMask(t, S.cols, S.rows);
  if (!m || WS.countCells(m) < 10) { toast('That shape is too small. Try a bigger grid or a bolder letter.'); return; }
  applyMask(m, { type: 'text', text: t });
});
$('maskText').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('maskTextBtn').click(); });

function buildImageMask() {
  const m = imageMask(S.maskImg, S.cols, S.rows, $('imgInvert').checked);
  if (WS.countCells(m) < 10) { toast('Not enough of the image became playable. Try "Use light areas" or a higher contrast image.'); return; }
  applyMask(m, { type: 'image', light: $('imgInvert').checked });
}
$('maskImg').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => { S.maskImg = img; URL.revokeObjectURL(url); buildImageMask(); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('That file could not be read as an image.'); };
  img.src = url;
  e.target.value = '';
});
$('imgInvert').addEventListener('change', () => { if (S.maskImg) buildImageMask(); });
$('maskInvert').addEventListener('click', () => applyMask(S.mask.map((r) => r.map((c) => !c)), { type: 'custom' }));
$('maskFill').addEventListener('click', () => applyMask(WS.presetMask('rect', S.cols, S.rows), { type: 'preset', id: 'rect' }));
$('maskClear').addEventListener('click', () => applyMask(WS.blank(S.cols, S.rows, false), { type: 'custom' }));
$('paintBtn').addEventListener('click', () => { setTab('shape'); $('puzzleCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });

/* painting on the canvas */
let painting = null;
function cellAt(ev) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left - layout.pad) / layout.cell);
  const y = Math.floor((ev.clientY - r.top - layout.pad) / layout.cell);
  return x >= 0 && y >= 0 && x < S.mask[0].length && y < S.mask.length ? { x, y } : null;
}
function paintCell(x, y) {
  const w = S.mask[0].length, h = S.mask.length, val = painting.val;
  const pts = [[x, y]];
  if ($('mirX').checked) pts.push([w - 1 - x, y]);
  if ($('mirY').checked) pts.push([x, h - 1 - y]);
  if ($('mirX').checked && $('mirY').checked) pts.push([w - 1 - x, h - 1 - y]);
  let changed = false;
  for (const [px, py] of pts) if (S.mask[py][px] !== val) { S.mask[py][px] = val; changed = true; }
  if (changed) { S.maskSrc = { type: 'custom' }; syncShapeButtons(); render(); $('cellCount').textContent = WS.countCells(S.mask) + ' cells'; }
}
cv.addEventListener('pointerdown', (ev) => {
  if (S.tab !== 'shape') return;
  const c = cellAt(ev);
  if (!c) return;
  painting = { val: !S.mask[c.y][c.x] };
  cv.setPointerCapture(ev.pointerId);
  paintCell(c.x, c.y);
  ev.preventDefault();
});
cv.addEventListener('pointermove', (ev) => {
  if (!painting) return;
  const c = cellAt(ev);
  if (c) paintCell(c.x, c.y);
});
function endPaint() { if (painting) { painting = null; schedule(60); } }
cv.addEventListener('pointerup', endPaint);
cv.addEventListener('pointercancel', endPaint);

/* ---------- sidebar tabs ---------- */
function setSide(name) {
  document.querySelectorAll('.side-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === name)));
  ['rules', 'shape', 'export', 'saved', 'ai'].forEach((n) => { $('panel-' + n).hidden = n !== name; });
}
document.querySelectorAll('.side-tabs button').forEach((b) => b.addEventListener('click', () => setSide(b.dataset.side)));

/* ---------- tabs and solution ---------- */
function setTab(t) {
  S.tab = t;
  if (t === 'shape') setSide('shape');
  else if (t === 'page') setSide('export');
  document.querySelectorAll('button[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  const hint = $('stageHint');
  hint.hidden = t === 'puzzle';
  hint.textContent = t === 'shape'
    ? 'Click or drag cells to add or remove them. The first cell you touch decides whether you are adding or erasing.'
    : t === 'page' ? 'This is the page that will be exported, with the settings on the right.' : '';
  $('solToggle').disabled = t === 'shape';
  syncNudge();
  render();
}
document.querySelectorAll('button[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('shuffle').addEventListener('click', () => { S.seed = (S.seed * 1664525 + 1013904223) >>> 0; regen(); });

function setSolution(on) {
  S.solution = on;
  $('solToggle').checked = on;
  $('chips').classList.toggle('sol', on);
  render();
}
$('solToggle').addEventListener('change', () => setSolution($('solToggle').checked));

/* ---------- moving things on the page ---------- */
const NUDGE_STEP = 0.01; // fraction of the page's shorter side per key press (about 1%)
const NUDGE_BIG = 5;       // Shift multiplies the step
const EL_NAMES = { title: 'Title', grid: 'Grid', list: 'Word bank', page: 'Page number' };
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const DPAD = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function fmtPct(v) {
  const p = Math.round(v * 10000) / 100;
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2) + '%';
}

function syncNudge() {
  $('nudge').hidden = S.tab !== 'page';
  document.querySelectorAll('#nudge [data-el]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.el === S.sel)));
  document.querySelectorAll('#nudge [data-nudge]').forEach((b) => { b.disabled = !S.sel; });
  $('nudgeReset').disabled = !S.sel;
  const o = S.sel && S.off[S.sel];
  $('nudgeRead').textContent = o ? EL_NAMES[S.sel] + ': across ' + fmtPct(o.x) + ', down ' + fmtPct(o.y) : '';
  $('nudgeHint').textContent = S.sel
    ? 'Use the arrow keys or the arrow buttons. Each press moves it about 1%. Hold Shift for bigger steps. Press Escape to let go.'
    : 'Click the title, the grid or the word bank on the page, or choose one here. Then use the arrow keys or the arrow buttons.';
}

function setSel(name) {
  if (name && S.pageInfo && !S.pageInfo.boxes[name]) {
    toast(name === 'page' ? 'Choose PDF in the Export tab and pick a page number style first.' : EL_NAMES[name] + ' is switched off. Turn it on in the Export tab.');
    return;
  }
  S.sel = name;
  syncNudge();
  render();
}

function nudge(dx, dy, big) {
  const name = S.sel, info = S.pageInfo;
  if (!name || !info || !info.boxes[name]) return;
  const b = info.boxes[name], o = S.off[name], k = NUDGE_STEP * (big ? NUDGE_BIG : 1);
  const clamp = (v, lo, hi) => (lo <= hi ? Math.min(Math.max(v, lo), hi) : 0);
  const r = (v) => Math.round(v * 1e5) / 1e5;
  o.x = r(clamp(o.x + dx * k, -b.bx / info.base, (info.W - (b.bx + b.w)) / info.base));
  o.y = r(clamp(o.y + dy * k, -b.by / info.base, (info.H - (b.by + b.h)) / info.base));
  saveLayout();
  syncNudge();
  render();
}

cv.addEventListener('pointerdown', (ev) => {
  if (S.tab !== 'page' || !S.pageInfo) return;
  const info = S.pageInfo, rect = cv.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (info.W / rect.width), y = (ev.clientY - rect.top) * (info.H / rect.height);
  const pad = Math.max(3, info.base * 0.012);
  const hit = ['page', 'list', 'grid', 'title'].find((n) => {
    const b = info.boxes[n];
    return b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
  });
  S.sel = hit || null;
  syncNudge();
  render();
});

function onArrowKey(ev) {
  if (S.tab !== 'page') return;
  if (ev.key === 'Escape' && S.sel) { S.sel = null; syncNudge(); render(); return; }
  const d = ARROWS[ev.key];
  if (!d || !S.sel) return;
  ev.preventDefault();
  nudge(d[0], d[1], ev.shiftKey);
}
cv.addEventListener('keydown', onArrowKey);
$('nudge').addEventListener('keydown', onArrowKey);

document.querySelectorAll('#nudge [data-el]').forEach((b) => b.addEventListener('click', () => setSel(b.dataset.el === S.sel ? null : b.dataset.el)));

let repeat = null;
function stopRepeat() {
  if (repeat) { clearTimeout(repeat.t); clearInterval(repeat.i); repeat = null; }
}
document.querySelectorAll('#nudge [data-nudge]').forEach((b) => {
  const d = DPAD[b.dataset.nudge];
  b.addEventListener('pointerdown', (ev) => {
    if (b.disabled) return;
    ev.preventDefault();
    nudge(d[0], d[1], ev.shiftKey);
    stopRepeat();
    const h = {};
    h.t = setTimeout(() => { h.i = setInterval(() => nudge(d[0], d[1], ev.shiftKey), 60); }, 380);
    repeat = h;
  });
  b.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); nudge(d[0], d[1], ev.shiftKey); }
  });
});
['pointerup', 'pointercancel', 'blur'].forEach((n) => window.addEventListener(n, stopRepeat));

$('nudgeReset').addEventListener('click', () => {
  if (!S.sel) return;
  S.off[S.sel] = { x: 0, y: 0 };
  saveLayout(); syncNudge(); render();
});
$('nudgeResetAll').addEventListener('click', () => {
  S.off = { title: { x: 0, y: 0 }, grid: { x: 0, y: 0 }, list: { x: 0, y: 0 }, page: { x: 0, y: 0 } };
  saveLayout(); syncNudge(); render();
  toast('Title, grid, word bank and page number are back in their automatic positions.');
});

/* ---------- export settings ---------- */
const UNIT_IN = { mm: 1 / 25.4, in: 1 };
function updatePx() {
  const e = exportSettings();
  const { W, H } = WSR.pagePixels(e);
  const mp = (W * H) / 1e6;
  const out = $('pxOut');
  const tooBig = W > MAX_SIDE || H > MAX_SIDE || W * H > MAX_PIXELS;
  out.classList.toggle('bad', tooBig);
  out.textContent = W + ' × ' + H + ' px · ' + mp.toFixed(1) + ' MP' +
    (tooBig ? ' · too large, keep under 12000 px a side and 60 MP' : W * H > WARN_PIXELS ? ' · may fail on phones' : '');
  $('pdpi').disabled = e.unit === 'px';
  S.tooBig = tooBig;
  syncExportUi();
  if (S.tab === 'page') render();
  return !tooBig;
}
function applyPreset() {
  const p = PAGE_PRESETS[$('pagePreset').value];
  if (!p) return;
  $('pw').value = p.w; $('ph').value = p.h; $('punit').value = p.unit;
  updatePx();
}
$('pagePreset').addEventListener('change', applyPreset);
['pw', 'ph'].forEach((id) => $(id).addEventListener('input', () => { $('pagePreset').value = 'custom'; updatePx(); }));
let lastUnit = 'mm';
$('punit').addEventListener('change', () => {
  const u = $('punit').value, dpi = +$('pdpi').value || 300;
  const toIn = (v, unit) => (unit === 'px' ? v / dpi : v * UNIT_IN[unit]);
  const fromIn = (v, unit) => (unit === 'px' ? Math.round(v * dpi) : unit === 'mm' ? Math.round(v * 254) / 10 : Math.round(v * 100) / 100);
  $('pw').value = fromIn(toIn(+$('pw').value, lastUnit), u);
  $('ph').value = fromIn(toIn(+$('ph').value, lastUnit), u);
  lastUnit = u;
  $('pagePreset').value = 'custom';
  updatePx();
});
$('pdpi').addEventListener('change', updatePx);
$('pq').addEventListener('input', () => { $('pqOut').textContent = $('pq').value; paintRange($('pq')); });
['showTitle', 'title', 'listMode', 'listArrange', 'listArrangeCount', 'lines', 'outline'].forEach((id) => {
  $(id).addEventListener('input', () => render());
  $(id).addEventListener('change', () => render());
});
function syncListArrangeUi() {
  const mode = $('listArrange').value;
  $('listArrangeCount').disabled = mode === 'auto';
  $('listArrangeCountLbl').textContent = mode === 'rows' ? 'Number of rows' : 'Number of columns';
}
$('listArrange').addEventListener('change', syncListArrangeUi);
syncListArrangeUi();

/* ---------- site chrome ---------- */
function drawHero() {
  const c = $('heroCv');
  if (!c || !c.offsetWidth) return;
  const puz = WS.generate({
    cols: 8, rows: 8, words: WS.parseWords('SHAPE, WORDS, FIND, GRID, HIDE'),
    dirs: ['E', 'S', 'SE', 'NE', 'W'], level: 2, fill: 'az', seed: 21
  });
  const size = 280, dpr = Math.min(window.devicePixelRatio || 1, 3), pad = 16;
  c.width = size * dpr; c.height = size * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  WSR.drawGrid(g, pad, pad, Math.floor((size - 2 * pad) / 8), puz, { solution: true, lines: false, outline: true });
}
document.querySelectorAll('a[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
}));
