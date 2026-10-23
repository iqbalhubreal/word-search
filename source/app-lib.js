/* App library and export: JPG, PDF, and puzzles saved in this browser (IndexedDB). */

/* ---------- small helpers ---------- */
function radioVal(name) {
  const r = document.querySelector('input[name=' + name + ']:checked');
  return r ? r.value : '';
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const tick = () => new Promise((r) => setTimeout(r, 0));
function slug(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function fmtDate(t) {
  try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

/* The page settings that belong to one puzzle: title, word list, lines, outline and positions. */
function pageSnapshot() {
  const o = pageOpts();
  return { showTitle: o.showTitle, title: o.title, list: o.list, lines: o.lines, outline: o.outline, offsets: clone(S.off) };
}

const LIB = { items: [], mode: 'idb', db: null, ready: false, screenOn: true, loadedId: null, busy: false };

/* ---------- which puzzles go into a PDF ---------- */
function pdfEntries() {
  const out = [];
  if (LIB.screenOn && S.puz) out.push({ name: 'On screen', puz: S.puz, page: pageSnapshot() });
  LIB.items.forEach((it) => { if (it.on) out.push({ name: it.name, puz: it.puz, page: it.page }); });
  return out;
}
function pdfPageCount() { return buildPlan().length; }

/* Keeps the Export tab honest about what the button will do. */
function syncExportUi() {
  const fmt = radioVal('fmt'), what = radioVal('what'), pdf = fmt === 'pdf';
  document.querySelectorAll('.pdf-only').forEach((e) => { e.hidden = !pdf; });
  $('sepPage').disabled = what !== 'both';
  const n = pdfEntries().length, pages = pdfPageCount();
  let label, hint;
  if (pdf) {
    label = n ? 'Export PDF · ' + pages + (pages === 1 ? ' page' : ' pages') : 'Export PDF';
    if (!n) hint = 'No puzzles are ticked yet. Tick the puzzle on screen or some saved ones in the Saved tab.';
    else {
      const p = n + (n === 1 ? ' puzzle' : ' puzzles');
      hint = what === 'puzzle' ? p + ', one per page.'
        : what === 'solution' ? 'The answer pages for ' + p + '.'
          : p + ' first, then ' + ($('sepPage').checked ? 'a Solutions page, then ' : '') + 'every solution in the same order.';
      hint += ' The book opens with the cover and five more pages, so the puzzles start on page 7.';
    }
  } else {
    label = what === 'both' ? 'Export 2 JPGs' : what === 'solution' ? 'Export solution JPG' : 'Export JPG';
    hint = what === 'both' ? 'Saves two files: the puzzle, then its answer key.' : what === 'solution' ? 'Saves the answer key for the puzzle on screen.' : 'Saves the puzzle on screen.';
  }
  if (!LIB.busy) $('exportLbl').textContent = label;
  $('exportHint').textContent = hint;
  const blocked = !!S.tooBig || LIB.busy;
  $('exportBtn').disabled = blocked || (pdf && !n);
  $('libPdf').disabled = blocked || !n || !LIB.ready;
  $('libPdfLbl').textContent = n ? 'Export ' + n + (n === 1 ? ' puzzle' : ' puzzles') + ' as PDF' : 'Export as PDF';
  if (S.tab === 'page' && !LIB.busy) render(); // the preview shows the page number, which depends on these choices
}

/* ---------- drawing one page ---------- */
function renderPage(c, puz, snap, solution, noteText) {
  const g = c.getContext('2d');
  const offsets = Object.assign({}, snap.offsets, { page: S.off.page });
  WSR.drawPage(g, c.width, c.height, puz, Object.assign({}, snap, layoutOpts(), {
    offsets, solution: !!solution, preview: false, select: null, footer: footerOpt(noteText)
  }));
}
const toJpeg = (c, q) => new Promise((res) => c.toBlob(res, 'image/jpeg', q));

/* ---------- PDF writer: one full-page JPEG per page ---------- */
function jpegInfo(b) {
  let i = 2, comps = 3;
  while (i + 9 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { comps = b[i + 9]; break; }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return { gray: comps === 1 };
}
function pdfText(s) { return String(s).replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1').slice(0, 120); }
function pdfNum(n) { return (Math.round(n * 100) / 100).toString(); }

function buildPdf(pages, wPt, hPt, title) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let pos = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (id, body) => { offs[id] = pos; put(id + ' 0 obj\n' + body + '\nendobj\n'); };
  const n = pages.length, W = pdfNum(wPt), H = pdfNum(hPt);
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [' + pages.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] /Count ' + n + ' >>');
  pages.forEach((p, i) => {
    const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2;
    obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> /ProcSet [/PDF /ImageB /ImageC] >> /Contents ' + ct + ' 0 R >>');
    const cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
    obj(ct, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    offs[im] = pos;
    put(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /' + (p.gray ? 'DeviceGray' : 'DeviceRGB') +
      ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
    put(p.bytes);
    put('\nendstream\nendobj\n');
  });
  const info = 3 + 3 * n, d = new Date(), z = (v) => String(v).padStart(2, '0');
  const stamp = 'D:' + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
  obj(info, '<< /Title (' + pdfText(title) + ') /Producer (Wordsearch Workshop) /CreationDate (' + stamp + ') >>');
  const xref = pos;
  let x = 'xref\n0 ' + (info + 1) + '\n0000000000 65535 f \n';
  for (let id = 1; id <= info; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
  put(x + 'trailer\n<< /Size ' + (info + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}

/* ---------- saving a file ---------- */
async function saveFile(name, blob) {
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) { await dl.save({ filename: name, data: blob }); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  await new Promise((r) => setTimeout(r, 250));
}

/* ---------- export ---------- */
async function doExport(forcePdf) {
  if (forcePdf === true) {
    const r = document.querySelector('input[name=fmt][value=pdf]');
    if (r) r.checked = true;
  }
  syncExportUi();
  if (!updatePx()) return;
  const fmt = radioVal('fmt'), what = radioVal('what');
  const entries = fmt === 'pdf' ? pdfEntries() : [];
  if (fmt === 'pdf' && !entries.length) { toast('Tick at least one puzzle first.'); return; }
  LIB.busy = true;
  syncExportUi();
  const lbl = (t) => { $('exportLbl').textContent = t; $('libPdfLbl').textContent = t; };
  try {
    await loadFonts();
    const e = exportSettings(), { W, H } = WSR.pagePixels(e);
    const q = (+$('pq').value || 92) / 100;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;

    if (fmt === 'jpg') {
      const snap = pageSnapshot();
      const base = slug(snap.showTitle ? snap.title : '') || 'word-search';
      const jobs = what === 'both' ? [false, true] : [what === 'solution'];
      const names = [];
      for (const sol of jobs) {
        lbl('Rendering…');
        await tick();
        renderPage(c, S.puz, snap, sol, '');
        const blob = await toJpeg(c, q);
        if (!blob) throw new Error('This browser could not create an image that large. Lower the resolution and try again.');
        const name = base + (sol ? '-solution' : '') + '.jpg';
        await saveFile(name, blob);
        names.push(name);
      }
      toast(names.length === 1 ? 'Saved ' + names[0] + ' (' + W + ' × ' + H + ' px)' : 'Saved ' + names.join(' and '));
    } else {
      await loadFonts();
      await loadScriptFonts(entries.map((x) => x.puz.lang || 'en'));
      const n = entries.length, plan = buildPlan(), total = plan.length, pages = [];
      let done = 0;
      for (const it of plan) {
        lbl('Rendering page ' + (++done) + ' of ' + total + '…');
        await tick();
        const note = planNote(it, total);
        if (it.type === 'puzzle') renderPage(c, entries[it.i].puz, entries[it.i].page, false, note);
        else if (it.type === 'solution') renderPage(c, entries[it.i].puz, entries[it.i].page, true, note);
        else if (it.type === 'cover') WSR.drawCover(c.getContext('2d'), W, H, coverSpec(), { lang: docLang() });
        else if (it.type === 'blank') WSR.drawBlank(c.getContext('2d'), W, H);
        else if (it.type === 'text') WSR.drawTextPage(c.getContext('2d'), W, H, it.pg, { footer: footerOpt(note), offsets: { page: S.off.page }, lang: docLang() });
        else {
          WSR.drawSeparator(c.getContext('2d'), W, H, {
            lang: docLang(),
            title: t10nDoc().solutions,
            sub: t10nDoc().answers(n)
          });
        }
        const blob = await toJpeg(c, q);
        if (!blob) throw new Error('This browser could not create a page that large. Lower the resolution and try again.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        pages.push(Object.assign({ bytes, w: W, h: H }, jpegInfo(bytes)));
      }
      lbl('Building PDF…');
      await tick();
      const inch = e.unit === 'mm' ? [e.w / 25.4, e.h / 25.4] : e.unit === 'in' ? [e.w, e.h] : [e.w / e.dpi, e.h / e.dpi];
      const first = entries[0].page;
      const bookTitle = $('bookTitle') ? $('bookTitle').value.trim() : '';
      const docTitle = bookTitle || (n === 1 && first.showTitle && first.title.trim() ? first.title.trim() : 'Word search puzzles');
      const blob = buildPdf(pages, inch[0] * 72, inch[1] * 72, docTitle);
      const name = (slug(bookTitle) || (n === 1 ? slug(first.showTitle ? first.title : '') || 'word-search' : 'word-search-puzzles')) + (what === 'solution' ? '-solutions' : '') + '.pdf';
      await saveFile(name, blob);
      toast('Saved ' + name + ' (' + total + (total === 1 ? ' page)' : ' pages)'));
    }
  } catch (err) {
    toast(err && err.code === 'declined' ? 'Export cancelled.' : (err && err.message) || 'Export failed.');
  } finally {
    LIB.busy = false;
    updatePx();
    syncExportUi();
  }
}

/* ---------- storage: IndexedDB, with a memory fallback ---------- */
function dbOpen() {
  return new Promise((resolve, reject) => {
    let r;
    try { r = indexedDB.open('wordsearch-workshop', 1); } catch (e) { reject(e); return; }
    r.onupgradeneeded = () => { r.result.createObjectStore('puzzles', { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
}
function dbTx(mode, run) {
  return new Promise((resolve, reject) => {
    let tx, rq;
    try { tx = LIB.db.transaction('puzzles', mode); rq = run(tx.objectStore('puzzles')); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(rq && rq.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}
function libNote(show) {
  const n = $('libNote');
  n.hidden = !show;
  n.textContent = show ? 'This browser is not letting the page keep saved puzzles, so they will last only until you close or reload it. Export a PDF before you leave.' : '';
}
function storeFailed() { LIB.mode = 'memory'; libNote(true); }
async function persist(item) {
  if (LIB.mode !== 'idb') return;
  try { await dbTx('readwrite', (s) => s.put(item)); } catch (e) { storeFailed(); }
}
async function unpersist(id) {
  if (LIB.mode !== 'idb') return;
  try { await dbTx('readwrite', (s) => s.delete(id)); } catch (e) { storeFailed(); }
}

async function libInit() {
  try {
    LIB.db = await dbOpen();
    const all = await dbTx('readonly', (s) => s.getAll());
    LIB.items = (all || []).filter((x) => x && x.puz && x.src).sort((a, b) => a.order - b.order);
    LIB.mode = 'idb';
    libNote(false);
  } catch (e) {
    LIB.db = null;
    LIB.mode = 'memory';
    libNote(true);
  }
  LIB.ready = true;
  renderLib();
  syncExportUi();
}

/* ---------- saved puzzles ---------- */
function makeItem(name, keep) {
  const ms = S.maskSrc && S.maskSrc.type === 'image' ? { type: 'custom' } : S.maskSrc;
  const maxOrder = LIB.items.reduce((m, i) => Math.max(m, i.order), 0);
  return {
    id: keep ? keep.id : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, order: keep ? keep.order : maxOrder + 1, on: keep ? keep.on : true, saved: Date.now(),
    puz: clone(S.puz), page: pageSnapshot(),
    src: {
      words: $('words').value, cols: S.cols, rows: S.rows, lock: $('lock').checked, dirs: Array.from(S.dirs),
      level: S.level, fill: S.fill, seed: S.seed, mask: clone(S.mask), maskSrc: clone(ms), lang: S.lang, mode: S.mode
    }
  };
}

async function saveCurrent() {
  if (!S.puz || !LIB.ready) return;
  let name = $('libName').value.trim().slice(0, 60);
  if (!name) {
    // no name typed: the AI names it from the words, or asks for a name when there is no API key
    if (!AI.key) { toast('Please write a name for this puzzle, or add a Gemini API key in the AI tab so it can be named for you.'); $('libName').focus(); return; }
    $('libSave').disabled = true;
    toast('Naming your puzzle…');
    try { name = await aiNameFor(S.parsed.map((w) => w.display), S.lang); }
    catch (e) { $('libSave').disabled = !LIB.ready; toast((e.message || 'The AI could not name it.') + ' Please write a name.'); $('libName').focus(); return; }
    $('libSave').disabled = !LIB.ready;
  }
  const item = makeItem(name);
  LIB.items.push(item);
  LIB.screenOn = false;
  LIB.loadedId = item.id;
  $('libName').value = '';
  renderLib();
  syncExportUi();
  toast('Saved "' + name + '". It is ticked for the PDF.');
  await persist(item);
}

function loadItem(it) {
  const s = it.src, p = it.page;
  setLang(s.lang || 'en', { keep: true });
  setMode(s.mode || 'std', { keep: true });
  $('words').value = s.words;
  S.cols = s.cols; S.rows = s.rows;
  $('cols').value = s.cols; $('rows').value = s.rows;
  $('lock').checked = !!s.lock;
  $('colsOut').textContent = s.cols; $('rowsOut').textContent = s.rows;
  paintRange($('cols')); paintRange($('rows'));
  compass.querySelectorAll('input').forEach((i) => { i.checked = s.dirs.includes(i.dataset.dir); });
  readDirs();
  const r = document.querySelector('input[name=cross][value="' + s.level + '"]');
  if (r) r.checked = true;
  setCross(s.level);
  $('fill').value = s.fill; S.fill = s.fill;
  S.mask = clone(s.mask); S.maskSrc = clone(s.maskSrc);
  syncShapeButtons();
  S.seed = s.seed;
  $('showTitle').checked = p.showTitle; $('title').value = p.title; $('listMode').value = p.list;
  $('lines').checked = p.lines; $('outline').checked = p.outline;
  const keepPage = S.off.page;
  S.off = clone(p.offsets); S.off.page = keepPage || { x: 0, y: 0 }; S.sel = null; // the page number position belongs to the whole book
  saveLayout();
  LIB.loadedId = it.id;
  LIB.screenOn = false; // the opened puzzle is already in the list, so keep it out of the PDF twice
  syncNudge();
  schedule(0);
  updatePx();
  renderLib();
  $('puzzleCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  toast('Loaded "' + it.name + '".');
}

function drawThumb(c, puz) {
  const s = 64, dpr = 2;
  c.width = s * dpr; c.height = s * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  const pad = 5, cell = Math.max(1, Math.floor((s - 2 * pad) / Math.max(puz.cols, puz.rows)));
  const ox = Math.round((s - cell * puz.cols) / 2), oy = Math.round((s - cell * puz.rows) / 2);
  puz.mask.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    g.fillStyle = '#17b3c6';
    g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
  }));
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = 0.5;
  puz.placements.forEach((pl) => {
    const x0 = (pl.x + 0.5) * cell + ox, y0 = (pl.y + 0.5) * cell + oy, len = pl.len - 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + pl.dx * len * cell, y0 + pl.dy * len * cell); g.stroke();
  });
}

function libRow(puz, name, meta, isScreen, it) {
  const on = isScreen ? LIB.screenOn : it.on;
  const li = el('li', on ? 'on' : '');
  li.dataset.id = isScreen ? 'screen' : it.id;
  const tickEl = el('input', 'tick');
  tickEl.type = 'checkbox';
  tickEl.checked = on;
  tickEl.setAttribute('aria-label', 'Put "' + name + '" in the PDF');
  const th = el('canvas', 'th');
  th.setAttribute('aria-hidden', 'true');
  drawThumb(th, puz);
  const info = el('div', 'info');
  if (isScreen) info.appendChild(el('strong', 'nm', name));
  else {
    const inp = el('input', 'nm-in');
    inp.type = 'text'; inp.value = name; inp.maxLength = 60;
    inp.setAttribute('aria-label', 'Puzzle name');
    info.appendChild(inp);
  }
  info.appendChild(el('span', 'meta', meta));
  li.append(tickEl, th, info);
  return li;
}

function libScreenRefresh() {
  const ul = $('libScreen');
  if (!ul || !S.puz) return;
  ul.textContent = '';
  const t = $('showTitle').checked && $('title').value.trim() ? $('title').value.trim() : 'Puzzle on screen';
  const p = S.puz;
  ul.appendChild(libRow(p, t, 'On screen · ' + p.cols + ' × ' + p.rows + ' · ' + p.placements.length + ' words', true));
}

function renderLib() {
  libScreenRefresh();
  const ul = $('libList');
  ul.textContent = '';
  $('libEmpty').hidden = LIB.items.length > 0;
  $('libMeta').textContent = LIB.items.length + ' saved';
  $('libSave').disabled = !LIB.ready;
  LIB.items.forEach((it, i) => {
    const meta = it.puz.cols + ' × ' + it.puz.rows + ' · ' + it.puz.placements.length + ' words · ' + fmtDate(it.saved);
    const li = libRow(it.puz, it.name, meta, false, it);
    const acts = el('div', 'acts');
    const mk = (cls, text, act, label) => {
      const b = el('button', 'btn small ' + cls, text);
      b.type = 'button'; b.dataset.act = act;
      if (label) b.setAttribute('aria-label', label);
      return b;
    };
    acts.appendChild(mk('k-blue', 'Open', 'load', 'Open ' + it.name));
    if (LIB.loadedId === it.id) acts.appendChild(mk('k-green', 'Update', 'update', 'Replace ' + it.name + ' with the puzzle on screen'));
    const up = mk('k-violet', '↑', 'up', 'Move ' + it.name + ' earlier'); up.disabled = i === 0;
    const dn = mk('k-violet', '↓', 'down', 'Move ' + it.name + ' later'); dn.disabled = i === LIB.items.length - 1;
    acts.append(up, dn, mk('k-red', 'Delete', 'del', 'Delete ' + it.name));
    li.appendChild(acts);
    ul.appendChild(li);
  });
}

$('libScreen').addEventListener('change', (e) => {
  if (!e.target.classList.contains('tick')) return;
  LIB.screenOn = e.target.checked;
  e.target.closest('li').classList.toggle('on', LIB.screenOn);
  syncExportUi();
});
$('libList').addEventListener('change', (e) => {
  const li = e.target.closest('li'), it = li && LIB.items.find((x) => x.id === li.dataset.id);
  if (!it) return;
  if (e.target.classList.contains('tick')) {
    it.on = e.target.checked;
    li.classList.toggle('on', it.on);
    persist(it);
    syncExportUi();
  } else if (e.target.classList.contains('nm-in')) {
    it.name = e.target.value.trim().slice(0, 60) || it.name;
    e.target.value = it.name;
    persist(it);
  }
});
let armed = null;
$('libList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const li = b.closest('li'), i = LIB.items.findIndex((x) => x.id === li.dataset.id);
  if (i < 0) return;
  const it = LIB.items[i], act = b.dataset.act;
  if (act === 'load') loadItem(it);
  else if (act === 'update') {
    const fresh = makeItem(it.name, it);
    LIB.items[i] = fresh;
    renderLib();
    toast('Updated "' + it.name + '" with the puzzle on screen.');
    await persist(fresh);
  } else if (act === 'up' || act === 'down') {
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= LIB.items.length) return;
    const o = LIB.items[j], t = it.order;
    it.order = o.order; o.order = t;
    LIB.items.sort((a, c) => a.order - c.order);
    renderLib();
    await Promise.all([persist(it), persist(o)]);
  } else if (act === 'del') {
    if (armed !== it.id) {
      armed = it.id;
      b.textContent = 'Tap to confirm';
      setTimeout(() => { if (armed === it.id) { armed = null; if (b.isConnected) b.textContent = 'Delete'; } }, 3000);
      return;
    }
    armed = null;
    LIB.items.splice(i, 1);
    if (LIB.loadedId === it.id) LIB.loadedId = null;
    renderLib();
    syncExportUi();
    toast('Deleted "' + it.name + '".');
    await unpersist(it.id);
  }
});

$('libSave').addEventListener('click', saveCurrent);
$('libName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCurrent(); });
$('libAll').addEventListener('click', () => {
  LIB.screenOn = true;
  LIB.items.forEach((it) => { it.on = true; persist(it); });
  renderLib(); syncExportUi();
});
$('libNone').addEventListener('click', () => {
  LIB.screenOn = false;
  LIB.items.forEach((it) => { it.on = false; persist(it); });
  renderLib(); syncExportUi();
});
$('libPdf').addEventListener('click', () => doExport(true));
$('goSaved').addEventListener('click', () => setSide('saved'));
document.querySelectorAll('input[name=fmt], input[name=what]').forEach((r) => r.addEventListener('change', syncExportUi));
$('exportBtn').addEventListener('click', () => doExport());
