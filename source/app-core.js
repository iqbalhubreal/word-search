/* App core: state, shape builders, generation, drawing, status. */
const $ = (id) => document.getElementById(id);
const ACCENT = '#2f4df0';
const MAX_SIDE = 12000, MAX_PIXELS = 60e6, WARN_PIXELS = 25e6;

const S = {
  cols: 18, rows: 18,
  dirs: new Set(WS.DIRS.map((d) => d.id)),
  level: 2, fill: 'az',
  mask: null, maskSrc: { type: 'preset', id: 'heart' }, maskImg: null,
  seed: (Date.now() & 0x7fffffff) >>> 0,
  puz: null, parsed: [],
  tab: 'puzzle', solution: false,
  off: { title: { x: 0, y: 0 }, grid: { x: 0, y: 0 }, list: { x: 0, y: 0 }, page: { x: 0, y: 0 } },
  sel: null, pageInfo: null, lang: 'en', mode: 'std'
};

const PAGE_PRESETS = {
  a4p: { w: 210, h: 297, unit: 'mm' }, a4l: { w: 297, h: 210, unit: 'mm' },
  lp: { w: 8.5, h: 11, unit: 'in' }, ll: { w: 11, h: 8.5, unit: 'in' },
  sq: { w: 8, h: 8, unit: 'in' }, ig: { w: 1080, h: 1080, unit: 'px' },
  t5x8: { w: 5, h: 8, unit: 'in' }, t525x8: { w: 5.25, h: 8, unit: 'in' }, t55x85: { w: 5.5, h: 8.5, unit: 'in' },
  t6x9: { w: 6, h: 9, unit: 'in' }, t614x921: { w: 6.14, h: 9.21, unit: 'in' }, t7x10: { w: 7, h: 10, unit: 'in' },
  t75x925: { w: 7.5, h: 9.25, unit: 'in' }, t8x10: { w: 8, h: 10, unit: 'in' }, t825x11: { w: 8.25, h: 11, unit: 'in' },
  t85x85: { w: 8.5, h: 8.5, unit: 'in' }, t85x11: { w: 8.5, h: 11, unit: 'in' },
  a5: { w: 148, h: 210, unit: 'mm' }, a6: { w: 105, h: 148, unit: 'mm' }, b5: { w: 176, h: 250, unit: 'mm' },
  legal: { w: 8.5, h: 14, unit: 'in' }
};
const CROSS_TEXT = [
  'Words never share a letter. Each one sits on its own cells.',
  'Crossings are rare. Words mostly keep apart.',
  'Words cross when they happen to meet.',
  'Words are packed so they cross as often as they can.'
];
const SAMPLE_WORDS = 'PLANET\nCOMET\nGALAXY\nORBIT\nROCKET\nNEBULA\nSATURN\nLUNAR\nSOLAR\nECLIPSE\nMETEOR\nCOSMOS';

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
}

/* ---------- shapes from text and images ---------- */
function sampleMask(c, cols, rows, K, mode) {
  const W = cols * K;
  const d = c.getImageData(0, 0, W, rows * K).data;
  const m = WS.blank(cols, rows, false);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let on = 0;
      for (let yy = 0; yy < K; yy++) {
        for (let xx = 0; xx < K; xx++) {
          const i = ((y * K + yy) * W + x * K + xx) * 4;
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (mode === 'alpha' ? d[i + 3] > 128 : mode === 'dark' ? lum < 140 : lum >= 140) on++;
        }
      }
      m[y][x] = on / (K * K) >= (mode === 'alpha' ? 0.4 : 0.5);
    }
  }
  return m;
}

function textMask(text, cols, rows) {
  const K = 10, cv = document.createElement('canvas');
  cv.width = cols * K; cv.height = rows * K;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const fam = '"Bricolage Grotesque", Arial, Helvetica, sans-serif';
  c.fillStyle = '#000';
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.font = '800 100px ' + fam;
  const m = c.measureText(text);
  const l = m.actualBoundingBoxLeft || 0, r = m.actualBoundingBoxRight || m.width;
  const a = m.actualBoundingBoxAscent || 72, d = m.actualBoundingBoxDescent || 0;
  const bw = l + r, bh = a + d;
  if (!bw || !bh) return null;
  const k = Math.min((cv.width * 0.96) / bw, (cv.height * 0.96) / bh);
  c.font = '800 ' + 100 * k + 'px ' + fam;
  c.fillText(text, (cv.width - bw * k) / 2 + l * k, (cv.height - bh * k) / 2 + a * k);
  return sampleMask(c, cols, rows, K, 'alpha');
}

function imageMask(img, cols, rows, light) {
  if (!img) return WS.presetMask('rect', cols, rows);
  const K = 8, cv = document.createElement('canvas');
  cv.width = cols * K; cv.height = rows * K;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = light ? '#000' : '#fff';
  c.fillRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  c.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
  return sampleMask(c, cols, rows, K, light ? 'light' : 'dark');
}

function buildMask() {
  const src = S.maskSrc, cols = S.cols, rows = S.rows;
  if (src.type === 'preset') S.mask = WS.presetMask(src.id, cols, rows);
  else if (src.type === 'text') S.mask = textMask(src.text, cols, rows) || WS.presetMask('rect', cols, rows);
  else if (src.type === 'image') S.mask = imageMask(S.maskImg, cols, rows, src.light);
  else if (!S.mask || S.mask.length !== rows || S.mask[0].length !== cols) S.mask = WS.resampleMask(S.mask, cols, rows);
}

/* ---------- generation ---------- */
function regen() {
  S.parsed = WS.parseWords($('words').value, S.lang);
  const one = S.mode === 'single';
  S.puz = WS.generate({
    cols: S.mask[0].length, rows: S.mask.length, mask: S.mask, words: S.parsed,
    dirs: Array.from(S.dirs), level: S.level, fill: S.fill, seed: S.seed, lang: S.lang, mode: one ? 'single' : undefined
  });
  $('wordCount').textContent = one ? (S.parsed.length ? '1 word to find' : '0 words') : S.parsed.length + (S.parsed.length === 1 ? ' word' : ' words');
  updateStatus();
  libScreenRefresh();
  render();
}
let genTimer = 0;
function schedule(delay) {
  clearTimeout(genTimer);
  genTimer = setTimeout(regen, delay === undefined ? 180 : delay);
}

/* ---------- status, notice, chips ---------- */
function span(parent, label, strong) {
  const s = document.createElement('span');
  if (strong !== undefined) { const b = document.createElement('b'); b.textContent = strong; s.append(b, ' ' + label); }
  else s.textContent = label;
  parent.appendChild(s);
}

function updateStatus() {
  const p = S.puz, one = S.mode === 'single', total = one ? Math.min(1, S.parsed.length) : S.parsed.length, cells = WS.countCells(S.mask);
  const st = $('status');
  st.textContent = '';
  span(st, total === 1 ? 'word placed' : 'words placed', p.placements.length + '/' + total);
  span(st, S.mask[0].length + ' × ' + S.mask.length + ' grid');
  span(st, 'playable cells', cells);
  span(st, p.crossings === 1 ? 'crossing' : 'crossings', p.crossings);
  $('cellCount').textContent = cells + ' cells';

  const notice = $('notice');
  const letters = (one ? S.parsed.slice(0, 1) : S.parsed).reduce((n, w) => n + (w.cells ? w.cells.length : w.letters.length), 0);
  let msg = '';
  if (one && !S.parsed.length) msg = 'Type the one word to hide.';
  else if (one && p.unplaced.length) msg = 'No grid with exactly one answer fit "' + p.unplaced[0] + '". Try a bigger grid, more directions or a shorter word.';
  else if (one && S.parsed.length > 1) msg = 'One-word puzzles use only the first word, ' + S.parsed[0].display + '. The other ' + (S.parsed.length - 1) + ' are ignored.';
  else if (!S.dirs.size) msg = 'Tick at least one direction so words have somewhere to go.';
  else if (!cells) msg = 'The shape has no playable cells. Choose a preset or paint some cells in the Shape tab.';
  else if (p.unplaced.length) {
    msg = (p.unplaced.length === 1 ? "1 word didn't fit: " : p.unplaced.length + " words didn't fit: ") + p.unplaced.join(', ') +
      '. Try a bigger grid, more directions or a higher crossing level.';
  } else if (letters > cells * 0.9) msg = 'Your words use ' + letters + ' letters and the shape has ' + cells + ' cells, so it is very full.';
  notice.hidden = !msg;
  notice.textContent = msg;

  const chips = $('chips');
  chips.textContent = '';
  chips.classList.toggle('sol', S.solution);
  const placed = p.placements.map((pl, i) => ({ text: pl.word, color: WSR.PALETTE[i % WSR.PALETTE.length] }))
    .sort((a, b) => a.text.localeCompare(b.text, WS.LANGS[S.lang].locale));
  chips.dir = WS.LANGS[S.lang].rtl ? 'rtl' : 'ltr';
  for (const e of placed) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.style.setProperty('--c', e.color);
    const dot = document.createElement('i');
    c.append(dot, e.text);
    chips.appendChild(c);
  }
  for (const w of p.unplaced) {
    const c = document.createElement('span');
    c.className = 'chip miss';
    c.textContent = w;
    chips.appendChild(c);
  }
}

/* ---------- drawing ---------- */
const cv = $('cv'), ctx = cv.getContext('2d'), desk = $('desk');
let layout = { pad: 14, cell: 10 };

function sizeCanvas(w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function exportSettings() {
  return {
    w: parseFloat($('pw').value) || 1, h: parseFloat($('ph').value) || 1,
    unit: $('punit').value, dpi: parseInt($('pdpi').value, 10) || 300
  };
}

function pageOpts(preview) {
  return Object.assign({
    showTitle: $('showTitle').checked, title: $('title').value, list: $('listMode').value,
    solution: S.solution, lines: $('lines').checked, outline: $('outline').checked,
    offsets: S.off, preview: !!preview, select: preview ? S.sel : null,
    footer: preview ? previewFooter() : null
  }, layoutOpts());
}

/* Positions of the title, grid and word bank are remembered in this browser. */
const LAYOUT_KEY = 'wordsearch-workshop-layout-v1';
function loadLayout() {
  try {
    const j = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
    if (!j) return;
    ['title', 'grid', 'list', 'page'].forEach((k) => {
      if (j[k] && isFinite(j[k].x) && isFinite(j[k].y)) S.off[k] = { x: Math.max(-1, Math.min(1, +j[k].x)), y: Math.max(-1, Math.min(1, +j[k].y)) };
    });
  } catch (e) { /* storage unavailable: start with the automatic layout */ }
}
function saveLayout() {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(S.off)); } catch (e) { /* ignore */ }
}

function render() {
  if (!S.puz) return;
  const dcs = getComputedStyle(desk);
  const deskW = Math.max(120, desk.clientWidth - parseFloat(dcs.paddingLeft) - parseFloat(dcs.paddingRight));
  const maxH = Math.min(720, Math.max(320, window.innerHeight - 250));
  cv.classList.toggle('paint', S.tab === 'shape');
  cv.setAttribute('aria-label', S.tab === 'shape' ? 'Shape editor grid' : S.tab === 'page'
    ? 'Export page preview. Click the title, grid or word bank, then use the arrow keys to move it.' : 'Word search grid');
  cv.classList.toggle('pick', S.tab === 'page');
  if (S.tab === 'page') cv.tabIndex = 0; else cv.removeAttribute('tabindex');

  if (S.tab === 'page') {
    const px = WSR.pagePixels(exportSettings());
    const aspect = Math.min(5, Math.max(0.2, px.W / px.H));
    const w = Math.floor(Math.min(deskW, maxH * aspect)), h = Math.floor(w / aspect);
    sizeCanvas(w, h);
    S.pageInfo = WSR.drawPage(ctx, w, h, S.puz, pageOpts(true));
    if (S.sel && !S.pageInfo.boxes[S.sel]) { S.sel = null; syncNudge(); }
    return;
  }
  const pad = 14;
  const rows = S.tab === 'shape' ? S.mask.length : S.puz.rows;
  const cols = S.tab === 'shape' ? S.mask[0].length : S.puz.cols;
  const cell = Math.max(2, Math.floor(Math.min((deskW - 2 * pad) / cols, (maxH - 2 * pad) / rows)));
  const w = cell * cols + 2 * pad, h = cell * rows + 2 * pad;
  sizeCanvas(w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  layout = { pad, cell };
  if (S.tab === 'shape') WSR.drawMaskEditor(ctx, pad, pad, cell, S.mask, ACCENT);
  else WSR.drawGrid(ctx, pad, pad, cell, S.puz, { solution: S.solution, lines: $('lines').checked, outline: $('outline').checked });
}

const SCRIPT_FONT = { Han: 'Noto Sans SC', Devanagari: 'Noto Sans Devanagari', Bengali: 'Noto Sans Bengali', Arabic: 'Noto Sans Arabic' };
/* Load the Noto font a language needs, using a sample of its own text so only the right subset is fetched. */
function loadScriptFonts(ids) {
  const jobs = [];
  (ids || [S.lang]).forEach((id) => {
    const L = WS.LANGS[id];
    if (!L) return;
    const key = L.kind === 'han' ? 'Han' : L.kind === 'arabic' ? 'Arabic' : L.script;
    const fam = SCRIPT_FONT[key];
    if (!fam) return;
    const sample = (L.words || []).slice(0, 40).join('') + (L.title || '');
    [500, 700, 800].forEach((w) => jobs.push(document.fonts.load(w + ' 20px "' + fam + '"', sample).catch(() => {})));
  });
  return Promise.all(jobs);
}
function loadFonts() {
  const faces = ['600 20px "IBM Plex Mono"', '500 20px "IBM Plex Sans"', '700 20px "Bricolage Grotesque"', '800 20px "Bricolage Grotesque"'];
  return Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {})).concat(loadScriptFonts()))
    .then(() => document.fonts.ready)
    .catch(() => {});
}
