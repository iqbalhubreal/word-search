/* Word search engine: pure functions, no DOM. */
(function (root) {
  'use strict';

  const LD = typeof module !== 'undefined' && module.exports ? require('./langs.js') : root.WSL;
  const LANGS = LD.LANGS, L10N = LD.L10N;

  // Compass order, so the UI can lay the checkboxes out as a 3x3 grid.
  const DIRS = [
    { id: 'NW', dx: -1, dy: -1, arrow: '↖', name: 'Bottom-right to top-left' },
    { id: 'N',  dx: 0,  dy: -1, arrow: '↑', name: 'Bottom to top' },
    { id: 'NE', dx: 1,  dy: -1, arrow: '↗', name: 'Bottom-left to top-right' },
    { id: 'W',  dx: -1, dy: 0,  arrow: '←', name: 'Right to left (backwards)' },
    { id: 'E',  dx: 1,  dy: 0,  arrow: '→', name: 'Left to right' },
    { id: 'SW', dx: -1, dy: 1,  arrow: '↙', name: 'Top-right to bottom-left' },
    { id: 'S',  dx: 0,  dy: 1,  arrow: '↓', name: 'Top to bottom' },
    { id: 'SE', dx: 1,  dy: 1,  arrow: '↘', name: 'Top-left to bottom-right' }
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cleanLetters(s) {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^\p{L}]/gu, '');
  }

  const langSets = {};
  function langOf(id) {
    const l = LANGS[id] || LANGS.en;
    if (!langSets[l.id]) langSets[l.id] = { alpha: new Set(Array.from(l.alphabet || '')), map: l.map || {} };
    return l;
  }

  function clusters(s, lang) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(lang.locale, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
    }
    return s.match(/\p{L}(?:\p{M}|‍|‌|[्্]\p{L})*/gu) || [];
  }

  /** One word as the cells that go in the grid: letters, characters or letter clusters, by language. */
  function toCells(raw, langId) {
    const lang = langOf(langId), set = langSets[lang.id];
    let s = String(raw).normalize('NFC');
    if (lang.kind === 'han') return Array.from(s).filter((c) => /\p{Script=Han}/u.test(c));
    if (lang.kind === 'indic') {
      s = s.replace(/\p{N}/gu, '').replace(new RegExp('[^\\p{Script=' + lang.script + '}\\u200c\\u200d]', 'gu'), '');
      return clusters(s, lang).filter((c) => /\p{L}/u.test(c));
    }
    if (lang.kind === 'arabic') {
      s = s.replace(/[ً-ٰٟـ]/g, '');
      return Array.from(s).map((c) => set.map[c] || c).filter((c) => set.alpha.has(c));
    }
    s = s.toLocaleUpperCase(lang.locale).replace(/Œ/g, 'OE').replace(/Æ/g, 'AE');
    const out = [];
    for (const ch of s) {
      if (set.alpha.has(ch)) { out.push(ch); continue; }
      const base = ch.normalize('NFD')[0];
      if (set.alpha.has(base)) out.push(base);
    }
    return out;
  }

  // Text -> [{display, letters, cells}], deduplicated, at least 2 cells each.
  function parseWords(text, langId) {
    const lang = langOf(langId);
    const seen = new Set();
    const out = [];
    const t = String(text);
    // Without line breaks or commas, spaces separate words ("moon star comet").
    const sep = /[\n,;\t،؛]/.test(t) ? /[\n,;\t،؛]+/ : /\s+/;
    for (const raw of t.split(sep)) {
      const display = raw.trim().replace(/\s+/g, ' ').toLocaleUpperCase(lang.locale);
      const cells = toCells(raw, lang.id);
      const letters = cells.join('');
      if (cells.length < 2 || seen.has(letters)) continue;
      seen.add(letters);
      out.push({ display, letters, cells });
    }
    return out;
  }

  /* ---------- Shape masks ---------- */
  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const STAR = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1, a = -Math.PI / 2 + (i * Math.PI) / 5;
    STAR.push([r * Math.cos(a), r * Math.sin(a)]);
  }

  // Each shape takes u,v in [-1,1] (v grows downward) and says whether the cell is playable.
  const MASKS = {
    rect:     { name: 'Box', fn: () => true },
    ellipse:  { name: 'Ellipse',   fn: (u, v) => u * u + v * v <= 1 },
    diamond:  { name: 'Diamond',   fn: (u, v) => Math.abs(u) + Math.abs(v) <= 1 },
    triangle: { name: 'Triangle',  fn: (u, v) => Math.abs(u) <= (v + 1) / 2 },
    hexagon:  { name: 'Hexagon',   fn: (u, v) => Math.abs(u) + Math.abs(v) * 0.5 <= 1 },
    heart: {
      name: 'Heart',
      fn: (u, v) => {
        const x = u * 1.14, y = 1.24 - ((v + 1) / 2) * 2.12;
        return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
      }
    },
    star: {
      name: 'Star',
      fn: (u, v) => inPoly(u * 0.951, -0.93 + ((v + 1) / 2) * 1.739, STAR)
    },
    ring:     { name: 'Ring',      fn: (u, v) => { const r = u * u + v * v; return r <= 1 && r >= 0.16; } },
    cross:    { name: 'Cross',     fn: (u, v) => Math.abs(u) <= 0.36 || Math.abs(v) <= 0.36 },
    crescent: {
      name: 'Crescent',
      fn: (u, v) => u * u + v * v <= 1 && (u - 0.45) * (u - 0.45) + v * v > 0.64
    }
  };

  function blank(cols, rows, val) {
    return Array.from({ length: rows }, () => Array(cols).fill(val));
  }

  function presetMask(id, cols, rows) {
    const f = (MASKS[id] || MASKS.rect).fn;
    const m = blank(cols, rows, false);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        m[y][x] = !!f(((x + 0.5) / cols) * 2 - 1, ((y + 0.5) / rows) * 2 - 1);
    return m;
  }

  // Nearest-neighbour resample, used when the grid size changes under a hand-painted mask.
  function resampleMask(old, cols, rows) {
    const or = old.length, oc = old[0].length;
    const m = blank(cols, rows, false);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        m[y][x] = old[Math.min(or - 1, Math.floor(((y + 0.5) / rows) * or))][Math.min(oc - 1, Math.floor(((x + 0.5) / cols) * oc))];
    return m;
  }

  function countCells(mask) {
    let n = 0;
    for (const r of mask) for (const c of r) if (c) n++;
    return n;
  }

  /* ---------- Placement ---------- */
  const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function pickWeighted(items, weights, total, rng) {
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  // level: 0 none, 1 low, 2 medium, 3 high
  function weightFor(level, k) {
    if (level === 1) return Math.pow(0.2, k);
    if (level === 3) return Math.pow(6, Math.min(k, 8));
    return 1;
  }

  function attempt(rng, cols, rows, mask, dirs, words, level) {
    const grid = blank(cols, rows, '');
    const placed = [];
    const unplaced = [];
    const order = words
      .map((w, i) => ({ w, i, tie: rng() }))
      .sort((a, b) => (b.w.cells || b.w.letters).length - (a.w.cells || a.w.letters).length || a.tie - b.tie);

    for (const { w, i } of order) {
      const L = w.cells || Array.from(w.letters), n = L.length;
      const byDir = [];
      for (const d of dirs) {
        const list = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const ex = x + d.dx * (n - 1), ey = y + d.dy * (n - 1);
            if (ex < 0 || ex >= cols || ey < 0 || ey >= rows) continue;
            let ok = true, k = 0;
            for (let j = 0; j < n; j++) {
              const cx = x + d.dx * j, cy = y + d.dy * j;
              if (!mask[cy][cx]) { ok = false; break; }
              const g = grid[cy][cx];
              if (g) {
                if (level === 0 || g !== L[j]) { ok = false; break; }
                k++;
              }
            }
            if (ok && k < n) list.push([x, y, k]);
          }
        }
        if (list.length) byDir.push([d, list]);
      }
      if (!byDir.length) { unplaced.push(w); continue; }

      let d, cand;
      if (level === 3) {
        // pool every candidate so the heaviest crossings win across directions
        const all = [];
        for (const [dd, list] of byDir) for (const c of list) all.push([dd, c]);
        const ws = all.map(([, c]) => weightFor(3, c[2]));
        const tot = ws.reduce((a, b) => a + b, 0);
        [d, cand] = pickWeighted(all, ws, tot, rng);
      } else {
        // pick a direction evenly first so every ticked direction shows up
        const pair = byDir[Math.floor(rng() * byDir.length)];
        d = pair[0];
        const ws = pair[1].map((c) => weightFor(level, c[2]));
        const tot = ws.reduce((a, b) => a + b, 0);
        cand = pickWeighted(pair[1], ws, tot, rng);
      }
      const [sx, sy] = cand;
      for (let j = 0; j < n; j++) grid[sy + d.dy * j][sx + d.dx * j] = L[j];
      placed.push({ idx: i, word: w.display, letters: w.letters, cells: L, x: sx, y: sy, dx: d.dx, dy: d.dy, len: n, dir: d.id });
    }
    return { grid, placed, unplaced };
  }

  function occurrences(grid, mask, cols, rows, L, dirs) {
    const out = [], n = L.length;
    for (const d of dirs) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const ex = x + d.dx * (n - 1), ey = y + d.dy * (n - 1);
          if (ex < 0 || ex >= cols || ey < 0 || ey >= rows) continue;
          let ok = true;
          for (let j = 0; j < n; j++) {
            if (grid[y + d.dy * j][x + d.dx * j] !== L[j]) { ok = false; break; }
          }
          if (ok) out.push({ x, y, d });
        }
      }
    }
    return out;
  }

  function fillPool(lang, words, mode, onlyWord) {
    const wordChars = words.flatMap((w) => (w.cells ? w.cells : Array.from(w.letters)));
    if (onlyWord) return Array.from(new Set(onlyWord));
    if (mode === 'words' && wordChars.length) return wordChars;
    if (lang) {
      const f = lang.filler || lang.alphabet || LATIN;
      return Array.isArray(f) ? f : Array.from(f);
    }
    const nonLatin = wordChars.some((c) => !LATIN.includes(c));
    return nonLatin && wordChars.length ? wordChars : Array.from(LATIN);
  }

  function fillGrid(grid, mask, cols, rows, placed, words, dirs, mode, seed, lang) {
    const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const pool = fillPool(lang, words, mode);
    const locked = new Set();
    for (const p of placed) for (let j = 0; j < p.len; j++) locked.add((p.y + p.dy * j) * cols + (p.x + p.dx * j));

    const filler = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!mask[y][x]) continue;
        if (!grid[y][x]) { grid[y][x] = pool[Math.floor(rng() * pool.length)]; }
        if (!locked.has(y * cols + x)) filler.push(1);
      }
    }

    // Stop the filler from spelling a hidden word a second time.
    for (let pass = 0; pass < 25; pass++) {
      let changed = false;
      for (const p of placed) {
        const L = p.cells || Array.from(p.letters);
        const same = new Set();
        for (let j = 0; j < p.len; j++) same.add((p.y + p.dy * j) * cols + (p.x + p.dx * j));
        for (const o of occurrences(grid, mask, cols, rows, L, dirs)) {
          const cells = [];
          for (let j = 0; j < L.length; j++) cells.push((o.y + o.d.dy * j) * cols + (o.x + o.d.dx * j));
          if (cells.length === same.size && cells.every((c) => same.has(c))) continue;
          const free = cells.filter((c) => !locked.has(c));
          if (!free.length) continue;
          const c = free[Math.floor(rng() * free.length)];
          const cx = c % cols, cy = Math.floor(c / cols);
          const prev = grid[cy][cx];
          let next = prev, guard = 0;
          while (next === prev && guard++ < 20) next = pool[Math.floor(rng() * pool.length)];
          grid[cy][cx] = next;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  function countCrossings(placed, cols) {
    const seen = new Map();
    for (const p of placed) {
      for (let j = 0; j < p.len; j++) {
        const key = (p.y + p.dy * j) * cols + (p.x + p.dx * j);
        seen.set(key, (seen.get(key) || 0) + 1);
      }
    }
    let n = 0;
    for (const v of seen.values()) if (v > 1) n++;
    return n;
  }

  const cellKey = (cells, cols) => cells.slice().sort((a, b) => a - b).join(',');

  // Every place the word reads in any of the 8 directions, one entry per distinct set of cells.
  function distinctOccurrences(grid, mask, cols, rows, L) {
    const found = new Map();
    for (const o of occurrences(grid, mask, cols, rows, L, DIRS)) {
      const cells = [];
      for (let j = 0; j < L.length; j++) cells.push((o.y + o.d.dy * j) * cols + (o.x + o.d.dx * j));
      const k = cellKey(cells, cols);
      if (!found.has(k)) found.set(k, cells);
    }
    return found;
  }

  /**
   * One word, one answer. The grid holds only the letters of the word, and the word appears exactly once
   * in all 8 directions (counting reversed reading too). Returns null when no such grid was found.
   */
  function singleAttempt(seed, cols, rows, mask, dirs, word, deadline) {
    const rng = mulberry32(seed >>> 0);
    const r = attempt(rng, cols, rows, mask, dirs, [word], 0);
    if (!r.placed.length) return null;
    const L = word.cells || Array.from(word.letters);
    const p = r.placed[0];
    const mine = new Set();
    for (let j = 0; j < p.len; j++) mine.add((p.y + p.dy * j) * cols + (p.x + p.dx * j));
    const mineKey = cellKey(Array.from(mine), cols);
    const pool = Array.from(new Set(L));
    // weight letters by how often the word uses them, so the grid looks like the word's own letters
    const bag = L.slice();
    const grid = r.grid;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (mask[y][x] && !grid[y][x]) grid[y][x] = bag[Math.floor(rng() * bag.length)];
    }
    for (let pass = 0; pass < 400; pass++) {
      if (deadline && Date.now() > deadline) return null;
      const occ = distinctOccurrences(grid, mask, cols, rows, L);
      let changed = false;
      occ.forEach((cells, k) => {
        if (k === mineKey) return;
        const free = cells.filter((c) => !mine.has(c));
        if (!free.length) return;
        const c = free[Math.floor(rng() * free.length)];
        const cx = c % cols, cy = Math.floor(c / cols), prev = grid[cy][cx];
        let next = prev, guard = 0;
        while (next === prev && guard++ < 30) next = pool[Math.floor(rng() * pool.length)];
        grid[cy][cx] = next;
        changed = true;
      });
      if (!changed) {
        // verify once more from scratch: exactly one occurrence, and it is the placed one
        const fin = distinctOccurrences(grid, mask, cols, rows, L);
        return fin.size === 1 && fin.has(mineKey) ? { grid, placed: r.placed } : null;
      }
    }
    return null;
  }

  /**
   * opts: { cols, rows, mask?, words:[{display,letters,cells}], dirs:[ids], level:0-3,
   *         fill:'az'|'words', seed, attempts?, lang?: id, mode?: 'single' }
   */
  function generate(opts) {
    const cols = opts.cols, rows = opts.rows;
    const mask = opts.mask || blank(cols, rows, true);
    const lang = opts.lang ? langOf(opts.lang) : null;
    // Right-to-left languages read from the right, so a "forwards" direction runs right to left.
    const dirs = DIRS.filter((d) => opts.dirs.includes(d.id)).map((d) => (lang && lang.rtl ? Object.assign({}, d, { dx: -d.dx }) : d));
    const level = opts.level | 0;
    const seed = opts.seed >>> 0;
    const tries = opts.attempts || 30;
    const extra = { lang: lang ? lang.id : undefined, rtl: !!(lang && lang.rtl) };

    if (opts.mode === 'single') {
      const word = opts.words[0];
      if (!word || !dirs.length) {
        const g = blank(cols, rows, '');
        fillGrid(g, mask, cols, rows, [], opts.words, dirs, opts.fill, seed, lang);
        return Object.assign({
          cols, rows, mask, grid: g.map((row, y) => row.map((c, x) => (mask[y][x] ? c : null))), placements: [],
          unplaced: word ? [word.display] : [], crossings: 0, seed, single: true
        }, extra);
      }
      const deadline = Date.now() + 300; // short words can have no unique grid, so never search for long
      for (let a = 0; a < 40 && Date.now() < deadline; a++) {
        const res = singleAttempt((seed + a * 104729) >>> 0, cols, rows, mask, dirs, word, deadline);
        if (res) {
          const out = res.grid.map((row, y) => row.map((c, x) => (mask[y][x] ? c : null)));
          return Object.assign({ cols, rows, mask, grid: out, placements: res.placed, unplaced: [], crossings: 0, seed, single: true }, extra);
        }
      }
      // no grid with exactly one answer: show the letters but report the word as not placed
      const g = blank(cols, rows, '');
      const pool = fillPool(lang, [word], 'words', word.cells);
      const rng = mulberry32(seed);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y][x]) g[y][x] = pool[Math.floor(rng() * pool.length)];
      return Object.assign({
        cols, rows, mask, grid: g.map((row, y) => row.map((c, x) => (mask[y][x] ? c : null))), placements: [],
        unplaced: [word.display], crossings: 0, seed, single: true
      }, extra);
    }

    const words = opts.words;
    let best = null;
    if (dirs.length) {
      for (let a = 0; a < tries; a++) {
        const r = attempt(mulberry32((seed + a * 7919) >>> 0), cols, rows, mask, dirs, words, level);
        if (!best || r.placed.length > best.placed.length) best = r;
        if (!best.unplaced.length) break;
      }
    } else {
      best = { grid: blank(cols, rows, ''), placed: [], unplaced: words.slice() };
    }

    fillGrid(best.grid, mask, cols, rows, best.placed, words, dirs, opts.fill, seed, lang);
    const out = best.grid.map((row, y) => row.map((c, x) => (mask[y][x] ? c : null)));
    best.placed.sort((a, b) => a.idx - b.idx);
    return Object.assign({
      cols, rows, mask, grid: out, placements: best.placed,
      unplaced: best.unplaced.map((w) => w.display),
      crossings: countCrossings(best.placed, cols), seed
    }, extra);
  }

  /* ---------- Random word lists ---------- */
  const WORDLISTS = {
    Animals: 'tiger zebra panda koala otter falcon walrus lizard donkey badger rabbit monkey giraffe penguin dolphin buffalo leopard gorilla hedgehog flamingo crocodile squirrel kangaroo octopus peacock raccoon cheetah ostrich pelican lobster turtle jaguar beaver parrot sparrow moose camel eagle',
    Space: 'planet comet galaxy orbit meteor rocket nebula saturn jupiter eclipse cosmos lunar solar asteroid gravity quasar pulsar probe stellar satellite capsule payload mercury venus neptune uranus pluto equinox zenith apogee photon vacuum telescope astronaut',
    Food: 'pasta pizza noodle burger waffle muffin cookie biscuit sandwich avocado mango papaya cheese butter yogurt pretzel dumpling pancake omelette risotto lasagna burrito brownie cupcake almond walnut pepper garlic ginger basil nutmeg',
    Nature: 'forest river meadow canyon glacier valley desert island jungle prairie lagoon volcano tundra summit boulder pebble thunder blossom willow cedar maple orchid cactus bamboo breeze rainbow sunrise horizon waterfall mountain',
    Ocean: 'coral reef whale shark seahorse starfish jellyfish anchor harbor lighthouse tide current kelp oyster clam lobster crab shell pearl dolphin marlin barnacle plankton trident voyage galleon sailor mariner lagoon',
    Tech: 'pixel browser server python kernel cursor router modem buffer cache compile syntax binary network packet protocol firewall script widget plugin sensor laptop keyboard monitor database function variable bandwidth encrypt gateway terminal'
  };
  for (const k in WORDLISTS) WORDLISTS[k] = WORDLISTS[k].split(' ');

  function randomWords(category, count, minLen, maxLen, exclude, rng, langId) {
    rng = rng || Math.random;
    if (langId && langId !== 'en') {
      const lang = langOf(langId), skip = new Set(exclude || []), seen = new Set();
      const list = lang.words.filter((w) => {
        const cells = toCells(w, lang.id), key = cells.join('');
        if (cells.length < minLen || cells.length > maxLen || skip.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list.slice(0, count).map((w) => w.toLocaleUpperCase(lang.locale));
    }
    const pool = category === 'Mixed' || !WORDLISTS[category]
      ? [].concat(...Object.values(WORDLISTS))
      : WORDLISTS[category];
    const skip = new Set(exclude || []);
    const uniq = Array.from(new Set(pool)).filter((w) => w.length >= minLen && w.length <= maxLen && !skip.has(w.toUpperCase()));
    for (let i = uniq.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
    }
    return uniq.slice(0, count).map((w) => w.toUpperCase());
  }

  const api = {
    DIRS, MASKS, WORDLISTS, LANGS, L10N, ORDER: LD.ORDER, mulberry32, parseWords, cleanLetters, toCells, presetMask, resampleMask,
    countCells, blank, generate, randomWords, occurrences, distinctOccurrences, langOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
