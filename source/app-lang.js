/* App language and puzzle type: the 12-language picker and the "one word" mode. */
const LANG_KEY = 'wordsearch-workshop-lang-v1';
const MIRROR = { '→': '←', '←': '→', '↗': '↖', '↖': '↗', '↘': '↙', '↙': '↘' };

(function buildLangSelect() {
  const sel = $('lang');
  WS.ORDER.forEach((id) => {
    const L = WS.LANGS[id], o = document.createElement('option');
    o.value = id;
    o.textContent = L.id === 'en' ? 'English' : L.name + ' · ' + L.native;
    sel.appendChild(o);
  });
})();

function sampleFor(id) {
  const L = WS.LANGS[id];
  return id === 'en' ? SAMPLE_WORDS : L.words.slice(0, 12).map((w) => w.toLocaleUpperCase(L.locale)).join('\n');
}
const sameList = (a, b) => a.trim().split(/\s+/).join('|') === b.trim().split(/\s+/).join('|');

function syncLangUi() {
  const L = WS.LANGS[S.lang], rtl = !!L.rtl, one = S.mode === 'single';
  $('words').dir = rtl ? 'rtl' : 'ltr';
  $('words').lang = L.locale;
  // arrows show the way a word is read; right-to-left languages read from the right
  compass.querySelectorAll('.dir').forEach((lab, i) => {
    const d = WS.DIRS[i], sp = lab.querySelector('span');
    sp.textContent = rtl ? MIRROR[d.arrow] || d.arrow : d.arrow;
  });
  document.querySelectorAll('.std-only').forEach((el) => { el.hidden = one; });
  $('ptypeDesc').textContent = one
    ? 'One word hidden in a grid made only from its own letters. The word appears exactly once, in a single place.'
    : 'Many words hidden in the grid.';
  $('wordsLbl').textContent = one ? 'The word to hide (only the first word is used)' : 'One word per line, or separate with commas';
  // the Words card follows the puzzle type, so nothing says "words" once a single word is chosen
  $('words').placeholder = one ? (S.lang === 'en' ? 'PLANET' : WS.LANGS[S.lang].words[0]) : sampleFor(S.lang).split('\n').slice(0, 3).join('\n');
  $('h-words').textContent = one ? 'Your word' : 'Words';
  $('rAdd').hidden = one;
  $('rReplace').textContent = one ? 'Pick a random word' : 'Replace list';
  $('wClear').textContent = 'Clear';
  document.querySelector('input[name=ptype][value="' + (one ? 'one' : 'std') + '"]').checked = true;
}

function saveLangPrefs() {
  try { localStorage.setItem(LANG_KEY, JSON.stringify({ lang: S.lang, mode: S.mode })); } catch (e) { /* ignore */ }
}

/** opts.keep: leave the words and title alone (opening a saved puzzle). */
function setLang(id, opts) {
  if (!WS.LANGS[id]) id = 'en';
  const prev = S.lang, L = WS.LANGS[id];
  S.lang = id;
  $('lang').value = id;
  if (!(opts && opts.keep) && prev !== id) {
    if (sameList($('words').value, sampleFor(prev)) || !WS.parseWords($('words').value, id).length) $('words').value = sampleFor(id);
    const pt = (WS.L10N[prev] || {}).title;
    if (!$('title').value.trim() || $('title').value === pt || $('title').value === 'Space Words') $('title').value = L.title;
    $('rmin').value = L.len[0]; $('rmax').value = L.len[1];
  }
  syncLangUi();
  loadScriptFonts([id]).then(() => { if (S.puz) render(); });
  if (!(opts && opts.keep)) { saveLangPrefs(); schedule(0); }
}

function setMode(mode, opts) {
  S.mode = mode === 'single' ? 'single' : 'std';
  syncLangUi();
  if (!(opts && opts.keep)) { saveLangPrefs(); schedule(0); }
}

$('lang').addEventListener('change', () => setLang($('lang').value));
document.querySelectorAll('input[name=ptype]').forEach((r) => r.addEventListener('change', () => { if (r.checked) setMode(r.value === 'one' ? 'single' : 'std'); }));

function restoreLangPrefs() {
  try {
    const j = JSON.parse(localStorage.getItem(LANG_KEY) || 'null');
    if (j && WS.LANGS[j.lang]) { S.lang = j.lang; $('lang').value = j.lang; $('words').value = sampleFor(j.lang); $('title').value = WS.LANGS[j.lang].title; $('rmin').value = WS.LANGS[j.lang].len[0]; $('rmax').value = WS.LANGS[j.lang].len[1]; }
    if (j && j.mode === 'single') S.mode = 'single';
  } catch (e) { /* ignore */ }
  syncLangUi();
}
