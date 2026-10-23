/* Book settings: text sizes, margin, page numbers and the fixed book structure.
   Page order, always:  1 cover, 2 blank, 3 preface, 4 introduction, 5 how to play, 6 blank,
   then the puzzles (from page 7), the solutions, the closing pages, and one blank page at the very end if the total is odd.
   Everything here is remembered in this browser. */

const BOOK_KEY = 'wordsearch-workshop-book-v1';
const BOOK_CONTROLS = ['sTitle', 'sSub', 'sList', 'sMargin', 'sBody', 'pnStyle', 'pnAlign', 'pnEdge', 'pnSize',
  'sepPage', 'bookTitle', 'audience', 'bookNotes', 'avoid', 'aiB-closing', 'aiB-thanks', 'aiF-cover', 'aiF-blank1', 'aiF-blank2', 'aiF-preface', 'aiF-introduction', 'aiF-howto'];
const BOOK_SLIDERS = ['sTitle', 'sSub', 'sList', 'sMargin', 'sBody', 'pnSize'];
/* ai: what the AI chose: {slots, cover, pages:{lang:{section:{heading,body}}}}. null until it has run. */
const BK = { ai: null };

function loadBook() {
  try {
    const j = JSON.parse(localStorage.getItem(BOOK_KEY) || 'null');
    if (!j) return;
    BOOK_CONTROLS.forEach((id) => {
      const e = $(id);
      if (!e || !j.c || !(id in j.c)) return;
      if (e.type === 'checkbox') e.checked = !!j.c[id];
      else if (e.tagName === 'SELECT') { if (Array.from(e.options).some((o) => o.value === String(j.c[id]))) e.value = j.c[id]; }
      else e.value = String(j.c[id]).slice(0, 4000);
    });
    if (j.ai && typeof j.ai === 'object') BK.ai = j.ai;
  } catch (e) { /* storage unavailable: start with the defaults */ }
}
function saveBook() {
  try {
    const c = {};
    BOOK_CONTROLS.forEach((id) => { const e = $(id); if (e) c[id] = e.type === 'checkbox' ? e.checked : e.value; });
    localStorage.setItem(BOOK_KEY, JSON.stringify({ c, ai: BK.ai }));
  } catch (e) { /* ignore */ }
}

/* ---------- layout options shared by every page of the book ---------- */
function layoutOpts() {
  const v = (id, d) => (parseFloat($(id).value) || d) / 100;
  return { margin: v('sMargin', 6.5), titleScale: v('sTitle', 100), subScale: v('sSub', 100), listScale: v('sList', 100), bodyScale: v('sBody', 100) };
}
function footerOpt(text) {
  return text ? { text, align: $('pnAlign').value, edge: $('pnEdge').value, size: (parseFloat($('pnSize').value) || 100) / 100 } : null;
}
/* The language of the book's own text (page numbers, divider, written pages): the first puzzle in the PDF. */
function docLang() {
  const e = typeof pdfEntries === 'function' ? pdfEntries() : [];
  return (e[0] && e[0].puz && e[0].puz.lang) || S.lang || 'en';
}
function t10nDoc() { return WS.L10N[docLang()] || WS.L10N.en; }
function pageNote(style, pos, total, kind, n) {
  const T = t10nDoc();
  if (style === 'num') return String(pos);
  if (style === 'page') return T.pageN(pos);
  if (style === 'pageof') return T.pageOf(pos, total);
  if (style === 'label') return kind === 'puzzle' ? T.puzzleN(n) : kind === 'solution' ? T.solutionN(n) : '';
  return '';
}
const noDash = (t) => String(t == null ? '' : t).replace(/\s*[\u2014\u2013]\s*/g, ', ');

/* ---------- the fixed wording of the opening and closing pages ---------- */
/* The wording is fixed here. The AI only chooses the words that fill the {slots}. */
const PAGE_TEMPLATES = {
  preface: { heading: 'Preface', body: 'Welcome to {title}.\n\nThis book was made for {audience}, and for anyone who enjoys {mood} time with a pencil in hand. Inside are {count} about {themes}.\n\nEvery word is waiting to be found, from {examples} and many more. {wish}' },
  introduction: { heading: 'Introduction', body: '{title} holds {count} on {themes}. The grids are {grid}, and the level is {level}.\n\nEach puzzle comes with a list of words to find. Words run {dirs}.{answers}' },
  howto: { heading: 'How to play', body: '1. Read the list of words under each grid.\n2. Look for each word. Words run {dirs}.\n3. Circle the word and tick it off the list.\n4. Keep going until every word is found.' },
  closing: { heading: 'Well done', body: 'You have reached the end of {title}. We hope the {themes} kept you curious.\n\n{farewell}' },
  thanks: { heading: 'Thank you', body: 'Thank you for choosing {title}. {farewell}' }
};
const fillTemplate = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

/* Facts worked out from the puzzles in the PDF. The AI never has to supply these. */
function bookFacts() {
  const entries = pdfEntries();
  const dirSet = new Set();
  entries.forEach((e) => e.puz.placements.forEach((p) => dirSet.add(p.dx + ',' + p.dy)));
  const dirs = Array.from(dirSet).map((d) => d.split(',').map(Number));
  const horiz = dirs.some(([dx, dy]) => dx && !dy), vert = dirs.some(([dx, dy]) => dy && !dx), diag = dirs.some(([dx, dy]) => dx && dy);
  const back = dirs.some(([dx, dy]) => dx < 0 || dy < 0);
  const kinds = [horiz && 'across', vert && 'down', diag && 'diagonally'].filter(Boolean);
  const dirText = (kinds.length ? kinds.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'in straight lines') + (back ? ', and some words run backwards or upwards' : '');
  const sizes = entries.map((e) => Math.max(e.puz.cols, e.puz.rows));
  const lo = sizes.length ? Math.min.apply(null, sizes) : 0, hi = sizes.length ? Math.max.apply(null, sizes) : 0;
  const n = entries.length;
  const first = entries[0];
  const titles = Array.from(new Set(entries.map((e) => (e.page.showTitle && e.page.title.trim()) || '').filter(Boolean)));
  return {
    entries, n, dirText, titles,
    grid: lo === hi ? lo + ' by ' + lo : 'from ' + lo + ' by ' + lo + ' up to ' + hi + ' by ' + hi,
    countText: n + (n === 1 ? ' puzzle' : ' puzzles'),
    title: $('bookTitle').value.trim() || (first && first.page.showTitle && first.page.title.trim()) || t10nDoc().title,
    words: first ? first.puz.placements.map((p) => p.word) : [],
    hasAnswers: radioVal('what') !== 'puzzle'
  };
}
function slotValues() {
  const f = bookFacts(), sl = (BK.ai && BK.ai.slots) || {};
  const list = (a) => a.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const pick = (k, d) => (typeof sl[k] === 'string' && sl[k].trim() ? noDash(sl[k].trim()) : d);
  return {
    title: f.title, count: f.countText, grid: f.grid, dirs: f.dirText,
    themes: pick('themes', f.titles.length ? list(f.titles.map((t) => t.toLowerCase())) : 'many different themes'),
    audience: pick('audience', $('audience').value.trim() || 'curious puzzle lovers'),
    mood: pick('mood', 'relaxed'),
    examples: pick('examples', f.words.slice(0, 3).join(', ') || 'the words in each list').toLowerCase(),
    level: pick('level', 'friendly'),
    wish: pick('wish', 'Happy hunting.'),
    farewell: pick('farewell', 'Thank you for playing.'),
    answers: f.hasAnswers ? '\n\nThe answers are at the back of the book, so you can check your work or get unstuck.' : ''
  };
}
/* {heading, body} of one written page, in the book's language. */
function sectionSpec(sec) {
  const lang = docLang(), cached = BK.ai && BK.ai.pages && BK.ai.pages[lang];
  if (lang !== 'en' && cached && cached[sec] && cached[sec].heading && cached[sec].body) return cached[sec];
  return { heading: PAGE_TEMPLATES[sec].heading, body: noDash(fillTemplate(PAGE_TEMPLATES[sec].body, slotValues())) };
}
/* All five pages as filled English text (what the AI translates for other languages). */
function englishPages() {
  const v = slotValues(), out = {};
  Object.keys(PAGE_TEMPLATES).forEach((k) => { out[k] = { heading: PAGE_TEMPLATES[k].heading, body: noDash(fillTemplate(PAGE_TEMPLATES[k].body, v)) }; });
  return out;
}

/* ---------- pages ---------- */
let measureCtx = null;
/* One page for one section. The text shrinks a little if it would run onto a second page, so the page count stays fixed. */
function fitPage(spec) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const { W, H } = WSR.pagePixels(exportSettings());
  const o = Object.assign({ lang: docLang() }, layoutOpts());
  let pages = WSR.paginateText(measureCtx, spec, W, H, o);
  for (let k = 0; k < 8 && pages.length > 1; k++) { o.bodyScale = (o.bodyScale || 1) * 0.92; pages = WSR.paginateText(measureCtx, spec, W, H, o); }
  return pages[0];
}
function coverSpec() {
  const f = bookFacts(), c = (BK.ai && BK.ai.cover) || {};
  const letters = Array.from(new Set(f.words.join('').replace(/\s+/g, '').split(''))).slice(0, 26);
  return { title: f.title, tagline: typeof c.tagline === 'string' && c.tagline.trim() ? noDash(c.tagline.trim()).slice(0, 80) : f.countText.replace(/^1 /, 'One ') + ' to find', letters, design: c };
}

/* The pages of the PDF in order. pos is the page number counted from the first page. */
function buildPlan() {
  const n = pdfEntries().length, what = radioVal('what'), plan = [];
  if ($('aiF-cover').checked) plan.push({ type: 'cover' });
  if ($('aiF-blank1').checked) plan.push({ type: 'blank' });
  ['preface', 'introduction', 'howto'].forEach((sec) => { if ($('aiF-' + sec).checked) plan.push({ type: 'text', sec, pg: fitPage(sectionSpec(sec)) }); });
  if ($('aiF-blank2').checked) plan.push({ type: 'blank' });
  if (what !== 'solution') for (let i = 0; i < n; i++) plan.push({ type: 'puzzle', i });
  if (what === 'both' && $('sepPage').checked && n) plan.push({ type: 'divider' });
  if (what !== 'puzzle') for (let i = 0; i < n; i++) plan.push({ type: 'solution', i });
  ['closing', 'thanks'].forEach((sec) => { if ($('aiB-' + sec).checked) plan.push({ type: 'text', sec, pg: fitPage(sectionSpec(sec)) }); });
  if (plan.length % 2) plan.push({ type: 'blank', auto: true }); // an even page count, always
  plan.forEach((p, k) => { p.pos = k + 1; });
  return plan;
}
/* Text for the page number of one page of the plan ('' when it has none). */
function planNote(it, total) {
  if (it.type === 'divider' || it.type === 'cover' || it.type === 'blank') return '';
  return pageNote($('pnStyle').value, it.pos, total, it.type, (it.i || 0) + 1);
}

/* What the Page tab shows for the page number, using a real page of the plan. */
function previewFooter() {
  if (radioVal('fmt') !== 'pdf' || $('pnStyle').value === 'none') return null;
  const plan = buildPlan(), kind = S.solution ? 'solution' : 'puzzle';
  const it = plan.find((p) => p.type === kind) || plan.find((p) => p.type === 'puzzle') || { type: kind, i: 0, pos: 7 };
  return footerOpt(planNote(it, Math.max(plan.length, 1)) || pageNote($('pnStyle').value, it.pos, Math.max(plan.length, 1), kind, 1));
}

/* ---------- sliders ---------- */
function syncBookOutputs() {
  BOOK_SLIDERS.forEach((id) => {
    const e = $(id);
    $(id + 'Out').textContent = e.value + '%';
    paintRange(e);
  });
}
function onBookChange() {
  syncBookOutputs();
  saveBook();
  if (S.tab === 'page') render();
  syncExportUi();
}
BOOK_SLIDERS.forEach((id) => $(id).addEventListener('input', onBookChange));
['pnStyle', 'pnAlign', 'pnEdge', 'sepPage', 'aiB-closing', 'aiB-thanks', 'aiF-cover', 'aiF-blank1', 'aiF-blank2', 'aiF-preface', 'aiF-introduction', 'aiF-howto'].forEach((id) => $(id).addEventListener('change', onBookChange));
$('resetType').addEventListener('click', () => {
  [['sTitle', 100], ['sSub', 100], ['sList', 100], ['sMargin', 6.5], ['sBody', 100]].forEach(([id, v]) => { $(id).value = v; });
  onBookChange();
  toast('Text sizes and margin are back to normal.');
});
$('pnMove').addEventListener('click', () => {
  if ($('pnStyle').value === 'none') { toast('Pick a page number style first.'); return; }
  setTab('page');
  setSel('page');
  $('puzzleCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});


function renderBookPages() { syncExportUi(); }
