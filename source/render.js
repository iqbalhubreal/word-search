/* Canvas drawing shared by the on-screen puzzle, the shape editor, the page preview and the JPG export. */
(function (root) {
  'use strict';

  const BASE_MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  const BASE_SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
  const BASE_DISPLAY = '"Bricolage Grotesque", "IBM Plex Sans", system-ui, sans-serif';
  // Fonts per writing system; the Google Noto families are loaded by the page, the rest are fallbacks.
  const SCRIPT_STACK = {
    Han: '"Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei"',
    Devanagari: '"Noto Sans Devanagari", "Nirmala UI", "Mangal", "Lohit Devanagari"',
    Bengali: '"Noto Sans Bengali", "Nirmala UI", "Vrinda", "Lohit Bengali"',
    Arabic: '"Noto Sans Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma'
  };
  let FONT_MONO = BASE_MONO, FONT_SANS = BASE_SANS, FONT_DISPLAY = BASE_DISPLAY;
  const CUR = { lang: 'en', glyph: 1, rtl: false, kind: 'alpha' };
  const LDATA = () => (root.WSL || {});
  /** Switch fonts, glyph scale and direction to a puzzle language. Call before drawing. */
  function useLang(id) {
    const LG = (LDATA().LANGS || {})[id || 'en'] || (LDATA().LANGS || {}).en || {};
    CUR.lang = LG.id || 'en';
    CUR.glyph = LG.glyph || 1;
    CUR.rtl = !!LG.rtl;
    CUR.kind = LG.kind || 'alpha';
    const key = LG.kind === 'han' ? 'Han' : LG.kind === 'arabic' ? 'Arabic' : LG.script || '';
    const st = SCRIPT_STACK[key];
    if (st) { FONT_MONO = st + ', ' + BASE_SANS; FONT_SANS = st + ', ' + BASE_SANS; FONT_DISPLAY = st + ', ' + BASE_SANS; }
    else { FONT_MONO = BASE_MONO; FONT_SANS = BASE_SANS; FONT_DISPLAY = BASE_DISPLAY; }
    return CUR;
  }
  const t10n = (lang) => ((LDATA().L10N || {})[lang || CUR.lang] || (LDATA().L10N || {}).en || {});
  const INK = '#141a26';
  const PALETTE = ['#e5484d', '#f08a24', '#d6a100', '#2fa84f', '#1fa6a6', '#2d7be5', '#7c5be0', '#d6409f'];

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function capsule(ctx, cell, p, color) {
    const r = cell * 0.41;
    const sx = (p.x + 0.5) * cell, sy = (p.y + 0.5) * cell;
    const ex = (p.x + p.dx * (p.len - 1) + 0.5) * cell, ey = (p.y + p.dy * (p.len - 1) + 0.5) * cell;
    const ang = Math.atan2(ey - sy, ex - sx), len = Math.hypot(ex - sx, ey - sy);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.arc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fillStyle = hexA(color, 0.3);
    ctx.fill();
    ctx.lineWidth = Math.max(1.25, cell * 0.05);
    ctx.strokeStyle = hexA(color, 0.95);
    ctx.stroke();
    ctx.restore();
  }

  // Heavy line around the edge of the playable area, so non-rectangular shapes read clearly.
  function outline(ctx, cell, mask, color, width) {
    const rows = mask.length, cols = mask[0].length;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!mask[y][x]) continue;
        const X = x * cell, Y = y * cell;
        if (y === 0 || !mask[y - 1][x]) { ctx.moveTo(X, Y); ctx.lineTo(X + cell, Y); }
        if (y === rows - 1 || !mask[y + 1][x]) { ctx.moveTo(X, Y + cell); ctx.lineTo(X + cell, Y + cell); }
        if (x === 0 || !mask[y][x - 1]) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cell); }
        if (x === cols - 1 || !mask[y][x + 1]) { ctx.moveTo(X + cell, Y); ctx.lineTo(X + cell, Y + cell); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function innerLines(ctx, cell, mask, color, width) {
    const rows = mask.length, cols = mask[0].length;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!mask[y][x]) continue;
        if (x + 1 < cols && mask[y][x + 1]) { ctx.moveTo((x + 1) * cell, y * cell); ctx.lineTo((x + 1) * cell, (y + 1) * cell); }
        if (y + 1 < rows && mask[y + 1][x]) { ctx.moveTo(x * cell, (y + 1) * cell); ctx.lineTo((x + 1) * cell, (y + 1) * cell); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Draw the letter grid with its top-left corner at (x0, y0). o: {solution, lines, outline} */
  function drawGrid(ctx, x0, y0, cell, puz, o) {
    o = o || {};
    useLang(puz.lang);
    ctx.save();
    ctx.translate(x0, y0);
    if (o.lines) innerLines(ctx, cell, puz.mask, hexA(INK, 0.16), Math.max(1, cell * 0.022));
    if (o.solution) puz.placements.forEach((p, i) => capsule(ctx, cell, p, PALETTE[i % PALETTE.length]));
    ctx.fillStyle = INK;
    ctx.font = '600 ' + cell * 0.56 * (CUR.glyph || 1) + 'px ' + FONT_MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < puz.rows; y++) {
      for (let x = 0; x < puz.cols; x++) {
        const c = puz.grid[y][x];
        if (c) ctx.fillText(c, (x + 0.5) * cell, (y + 0.5) * cell + cell * 0.035);
      }
    }
    if (o.outline !== false) outline(ctx, cell, puz.mask, INK, Math.max(1.5, cell * 0.06));
    ctx.restore();
  }

  /** Shape editor view: playable cells are white and tinted, blocked cells are grey. */
  function drawMaskEditor(ctx, x0, y0, cell, mask, accent) {
    const rows = mask.length, cols = mask[0].length;
    ctx.save();
    ctx.translate(x0, y0);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = mask[y][x] ? hexA(accent, 0.16) : '#e4e8ef';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = 'rgba(20,26,38,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, rows * cell); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(cols * cell, y * cell + 0.5); }
    ctx.stroke();
    outline(ctx, cell, mask, accent, Math.max(2, cell * 0.08));
    ctx.restore();
  }

  /** Find the largest font and column count that fit the word list in a box. */
  function layoutList(ctx, texts, boxW, maxH, baseFs, minFs) {
    const n = texts.length;
    if (!n) return { fs: baseFs, cols: 1, rows: 0, colW: boxW, lh: baseFs, h: 0, gap: 0 };
    let fs = baseFs, res = null;
    while (fs >= minFs) {
      ctx.font = '500 ' + fs + 'px ' + FONT_SANS;
      const maxW = Math.max.apply(null, texts.map((t) => ctx.measureText(t).width));
      const itemW = maxW + fs * 1.5 + fs * 1.1;
      const cols = Math.max(1, Math.min(6, n, Math.floor(boxW / itemW)));
      const rows = Math.ceil(n / cols);
      const lh = fs * 1.62;
      res = { fs, cols, rows, colW: boxW / cols, lh, h: rows * lh, itemW: maxW + fs * 1.2 };
      if (res.h <= maxH) return res;
      fs *= 0.94;
    }
    return res;
  }

  function drawList(ctx, x, y, L, entries, solution) {
    ctx.save();
    ctx.textBaseline = 'middle';
    const box = L.fs * 0.62, rtl = CUR.rtl;
    ctx.textAlign = rtl ? 'right' : 'left';
    entries.forEach((e, i) => {
      const col = Math.floor(i / L.rows), row = i % L.rows;
      const cy = y + row * L.lh + L.lh / 2;
      const cx = rtl ? x + (L.cols - 1 - col) * L.colW + L.itemW - box : x + col * L.colW;
      ctx.lineWidth = Math.max(1, L.fs * 0.075);
      ctx.strokeStyle = INK;
      ctx.strokeRect(cx + 0.5, cy - box / 2, box, box);
      if (solution) {
        ctx.fillStyle = hexA(e.color, 0.85);
        ctx.fillRect(cx + 0.5 + L.fs * 0.1, cy - box / 2 + L.fs * 0.1, box - L.fs * 0.2, box - L.fs * 0.2);
      }
      ctx.fillStyle = INK;
      ctx.font = '500 ' + L.fs + 'px ' + FONT_SANS;
      ctx.fillText(e.text, rtl ? cx - L.fs * 0.55 : cx + box + L.fs * 0.55, cy + L.fs * 0.04);
    });
    ctx.restore();
  }

  const SEL_COLORS = { title: '#2f4df0', grid: '#12a15a', list: '#e8730a', page: '#d6336c' };
  const SEL_LABELS = { title: 'Title', grid: 'Grid', list: 'Word bank', page: 'Page number' };

  /** Shift an element by its offset, never letting it leave the page. Records its box. */
  function makePlace(W, H, base, off, boxes) {
    return function place(name, bx, by, w, h) {
      const f = off[name] || {};
      let dx = (f.x || 0) * base, dy = (f.y || 0) * base;
      const loX = -bx, hiX = W - (bx + w), loY = -by, hiY = H - (by + h);
      dx = loX <= hiX ? Math.min(Math.max(dx, loX), hiX) : 0;
      dy = loY <= hiY ? Math.min(Math.max(dy, loY), hiY) : 0;
      boxes[name] = { bx, by, w, h, x: bx + dx, y: by + dy };
      return { dx, dy };
    };
  }

  /** The page number (or any short note). f: {text, align:'left'|'center'|'right', edge:'top'|'bottom', size}. */
  function drawNote(ctx, W, H, base, m, f, place) {
    const fs = Math.max(7, base * 0.02 * (f.size > 0 ? f.size : 1));
    ctx.save();
    ctx.font = '500 ' + fs + 'px ' + FONT_SANS;
    const tw = ctx.measureText(f.text).width, h = fs * 1.3;
    const bx = f.align === 'left' ? m : f.align === 'right' ? W - m - tw : (W - tw) / 2;
    const cy = f.edge === 'top' ? m / 2 : H - m / 2;
    const by = Math.min(Math.max(cy - h / 2, 0), H - h);
    const p = place('page', bx, by, tw, h);
    ctx.fillStyle = hexA(INK, 0.6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, bx + p.dx, by + h / 2 + p.dy + fs * 0.04);
    ctx.restore();
  }

  /**
   * Full page: title, grid and word list on white. W and H are in canvas pixels.
   * o: {showTitle, title, list:'below'|'beside'|'none', solution, lines, outline,
   *     offsets:{title|grid|list:{x,y}} as fractions of the page's shorter side,
   *     margin (fraction of the shorter side), titleScale / subScale / listScale (1 = normal),
   *     footer {text, align, edge, size} for a page number, offsets.page moves it,
   *     preview (draw dotted guides), select (name of the selected element)}
   * Returns {W, H, base, boxes:{name:{bx,by,w,h,x,y}}}: bx/by is the automatic position, x/y where it was drawn.
   */
  function drawPage(ctx, W, H, puz, o) {
    useLang(puz.lang);
    const LT = t10n(puz.lang);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const base = Math.min(W, H);
    const m = Math.round(base * (o.margin >= 0 && o.margin < 0.4 ? o.margin : 0.065));
    const ts = o.titleScale > 0 ? o.titleScale : 1, ss = o.subScale > 0 ? o.subScale : 1, ls = o.listScale > 0 ? o.listScale : 1;
    let top = m;
    const off = o.offsets || {};
    const boxes = {};

    const place = makePlace(W, H, base, off, boxes);

    const title = (o.title || '').trim();
    if (o.showTitle && title) {
      let fs = base * 0.07 * ts;
      ctx.font = '700 ' + fs + 'px ' + FONT_DISPLAY;
      const maxW = W - 2 * m;
      let tw = ctx.measureText(title).width;
      if (tw > maxW) { fs *= maxW / tw; ctx.font = '700 ' + fs + 'px ' + FONT_DISPLAY; tw = ctx.measureText(title).width; }
      const sub = Math.max(8, base * 0.02 * ss);
      const subText = o.solution ? (LT.solution || 'Solution') : puz.single ? (LT.findOne || 'Find the hidden word') : (LT.find ? LT.find(puz.placements.length) : 'Find ' + puz.placements.length);
      ctx.font = '500 ' + sub + 'px ' + FONT_SANS;
      const sw = ctx.measureText(subText).width;
      const bw = Math.max(tw, sw), rtl = CUR.rtl, tx = rtl ? W - m : m;
      const p = place('title', rtl ? W - m - bw : m, top, bw, fs + sub * 1.7);
      ctx.save();
      ctx.translate(p.dx, p.dy);
      ctx.font = '700 ' + fs + 'px ' + FONT_DISPLAY;
      ctx.fillStyle = INK;
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(title, tx, top + fs * 0.82);
      ctx.font = '500 ' + sub + 'px ' + FONT_SANS;
      ctx.fillStyle = hexA(INK, 0.6);
      ctx.fillText(subText, tx, top + fs + sub * 1.3);
      ctx.restore();
      top += fs * 1.0 + sub * 2.6;
    }

    const availW = W - 2 * m, availH = H - top - m;
    const entries = puz.placements
      .map((p, i) => ({ text: p.word, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => a.text.localeCompare(b.text, (((LDATA().LANGS || {})[CUR.lang]) || {}).locale || 'en'));
    const texts = entries.map((e) => e.text);
    const gap = Math.round(base * 0.04);
    const baseFs = Math.max(8, base * 0.03 * ls), minFs = Math.max(4, Math.min(base * 0.014, baseFs * 0.9));

    let L = null, gridW = availW, gridH = availH;
    if (o.list === 'below' && entries.length) {
      L = layoutList(ctx, texts, availW, availH * 0.3, baseFs, minFs);
      gridH = availH - L.h - gap;
    } else if (o.list === 'beside' && entries.length) {
      const boxW = Math.max(availW * 0.27, base * 0.2);
      L = layoutList(ctx, texts, boxW, availH, baseFs, minFs);
      gridW = availW - boxW - gap;
      L.boxW = boxW;
    }

    const cell = Math.max(1, Math.floor(Math.min(gridW / puz.cols, gridH / puz.rows)));
    const gw = cell * puz.cols, gh = cell * puz.rows;
    const o2 = { solution: o.solution, lines: o.lines, outline: o.outline };
    const listW = L ? Math.min(L.boxW || availW, (L.cols - 1) * L.colW + L.itemW) : 0;

    let gx, gy, lx = 0, ly = 0;
    if (o.list === 'beside' && L) {
      const blockH = Math.max(gh, L.h);
      const by = top + (availH - blockH) / 2;
      gx = m + (gridW - gw) / 2;
      gy = by + (blockH - gh) / 2;
      lx = m + gridW + gap;
      ly = by + (blockH - L.h) / 2;
      if (CUR.rtl) { gx = m + (W - 2 * m - gridW) + (gridW - gw) / 2; lx = m; }
    } else {
      const blockH = gh + (L ? gap + L.h : 0);
      const by = top + Math.max(0, (availH - blockH) * 0.4);
      gx = m + (availW - gw) / 2;
      gy = by;
      lx = m;
      ly = by + gh + gap;
      if (CUR.rtl && L) lx = W - m - listW;
    }
    const pg = place('grid', gx, gy, gw, gh);
    drawGrid(ctx, gx + pg.dx, gy + pg.dy, cell, puz, o2);
    if (L) {
      if (CUR.rtl && o.list === 'beside') lx = m + (L.boxW - listW);
      const pl = place('list', lx, ly, listW, L.h);
      drawList(ctx, lx + pl.dx, ly + pl.dy, L, entries, o.solution);
    }
    if (o.footer && o.footer.text) drawNote(ctx, W, H, base, m, o.footer, place);

    // Dotted guides and the selection outline appear in the preview only, never in the export.
    if (o.preview) {
      const pad = Math.max(3, base * 0.012);
      const lw = Math.max(1.25, base * 0.0035);
      Object.keys(boxes).forEach((name) => {
        const bx = boxes[name], sel = o.select === name, col = SEL_COLORS[name];
        ctx.save();
        ctx.lineWidth = sel ? lw * 1.6 : lw;
        ctx.strokeStyle = sel ? col : hexA(col, 0.5);
        ctx.setLineDash(sel ? [lw * 4, lw * 2.5] : [lw * 1.5, lw * 3]);
        ctx.strokeRect(bx.x - pad, bx.y - pad, bx.w + 2 * pad, bx.h + 2 * pad);
        if (sel) {
          const fs = Math.max(9, base * 0.024);
          ctx.setLineDash([]);
          ctx.font = '700 ' + fs + 'px ' + FONT_SANS;
          const label = SEL_LABELS[name], tw = ctx.measureText(label).width + fs;
          const th = fs * 1.5;
          const ty = bx.y - pad - th >= 0 ? bx.y - pad - th : bx.y - pad;
          ctx.fillStyle = col;
          ctx.fillRect(bx.x - pad, ty, tw, th);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bx.x - pad + fs / 2, ty + th / 2 + fs * 0.05);
        }
        ctx.restore();
      });
    }
    ctx.restore();
    return { W, H, base, boxes };
  }

  /** Output size in pixels from the export settings. */
  function pagePixels(e) {
    let w = +e.w, h = +e.h;
    if (e.unit === 'mm') { w = (w / 25.4) * e.dpi; h = (h / 25.4) * e.dpi; }
    else if (e.unit === 'in') { w *= e.dpi; h *= e.dpi; }
    return { W: Math.max(1, Math.round(w)), H: Math.max(1, Math.round(h)) };
  }

  /* ---------- written pages (preface, introduction, closing note) ---------- */
  const TU = 1000; // text is laid out in units where the page's shorter side is 1000

  /**
   * Split {heading, body} into pages of wrapped lines.
   * o: {margin, bodyScale}. Returns [{first, m, hs, bs, head:[{t,y}], lines:[{t,y}], rule}].
   */
  function paginateText(ctx, spec, W, H, o) {
    useLang(o.lang);
    const base = Math.min(W, H), Wv = (W / base) * TU, Hv = (H / base) * TU;
    const m = TU * (o.margin >= 0 && o.margin < 0.4 ? o.margin : 0.065);
    const bs = TU * 0.026 * (o.bodyScale > 0 ? o.bodyScale : 1), lh = bs * 1.55, gapP = bs * 0.8, hs = TU * 0.058;
    const colW = Math.max(bs * 4, Wv - 2 * m), bottom = Hv - m;
    const meas = (weight, fam, size, t) => { ctx.font = weight + ' ' + size * 4 + 'px ' + fam; return ctx.measureText(t).width / 4; };
    // greedy word wrap, one paragraph at a time; very long words are split
    const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
    const wrapPara = (text, weight, fam, size) => {
      const lines = []; let cur = '';
      (text.match(/[\u3000-\u9fff\uff00-\uffef]|[^\s\u3000-\u9fff\uff00-\uffef]+/g) || []).forEach((w) => {
        const t = cur ? cur + (CJK.test(cur.slice(-1)) || CJK.test(w[0]) ? '' : ' ') + w : w;
        if (meas(weight, fam, size, t) <= colW) { cur = t; return; }
        if (cur) lines.push(cur);
        cur = w;
        while (meas(weight, fam, size, cur) > colW && cur.length > 1) {
          let k = cur.length - 1;
          while (k > 1 && meas(weight, fam, size, cur.slice(0, k)) > colW) k--;
          lines.push(cur.slice(0, k)); cur = cur.slice(k);
        }
      });
      if (cur) lines.push(cur);
      return lines;
    };
    const headText = String(spec.heading || '').trim();
    const headLines = headText ? wrapPara(headText, 800, FONT_DISPLAY, hs).slice(0, 3) : [];
    const headH = headLines.length ? headLines.length * hs * 1.15 + hs * 0.9 : 0;

    const pages = [];
    const mk = (first) => ({ first, m, hs, bs, Wv, rtl: CUR.rtl, lang: CUR.lang, head: [], lines: [], rule: null });
    let page = mk(true), y = m;
    headLines.forEach((t, i) => page.head.push({ t, y: m + hs * 0.95 + i * hs * 1.15 }));
    if (headLines.length) { page.rule = m + headLines.length * hs * 1.15 + hs * 0.12; y = m + headH; }
    pages.push(page);
    let needGap = false;
    String(spec.body || '').split(/\n/).forEach((raw) => {
      const para = raw.trim();
      if (!para) { needGap = true; return; }
      if (needGap && page.lines.length) y += gapP;
      needGap = false;
      wrapPara(para, 500, FONT_SANS, bs).forEach((t) => {
        if (y + lh > bottom && page.lines.length) { page = mk(false); pages.push(page); y = m; }
        page.lines.push({ t, y });
        y += lh;
      });
      needGap = true;
    });
    return pages;
  }

  /** Draw one page from paginateText. o: {footer, offsets:{page}} */
  function drawTextPage(ctx, W, H, pg, o) {
    useLang(pg.lang);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const base = Math.min(W, H), k = base / TU;
    ctx.save();
    ctx.scale(k, k);
    ctx.fillStyle = INK;
    ctx.textAlign = pg.rtl ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    const tx = pg.rtl ? pg.Wv - pg.m : pg.m;
    ctx.font = '800 ' + pg.hs + 'px ' + FONT_DISPLAY;
    pg.head.forEach((l) => ctx.fillText(l.t, tx, l.y));
    if (pg.rule !== null) { ctx.fillStyle = '#2f4df0'; ctx.fillRect(pg.rtl ? tx - TU * 0.12 : tx, pg.rule, TU * 0.12, Math.max(3, TU * 0.006)); }
    ctx.fillStyle = INK;
    ctx.font = '500 ' + pg.bs + 'px ' + FONT_SANS;
    pg.lines.forEach((l) => ctx.fillText(l.t, tx, l.y + pg.bs * 1.05));
    ctx.restore();
    if (o && o.footer && o.footer.text) {
      const boxes = {};
      drawNote(ctx, W, H, base, pg.m * k, o.footer, makePlace(W, H, base, (o && o.offsets) || {}, boxes));
    }
    ctx.restore();
  }

  /** Divider page: big heading, a short accent rule and one line below. o: {title, sub} */
  function drawSeparator(ctx, W, H, o) {
    useLang(o.lang);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const base = Math.min(W, H);
    let fs = base * 0.12;
    ctx.font = '800 ' + fs + 'px ' + FONT_DISPLAY;
    const tw = ctx.measureText(o.title).width;
    if (tw > W * 0.8) { fs *= (W * 0.8) / tw; ctx.font = '800 ' + fs + 'px ' + FONT_DISPLAY; }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const cy = H * 0.47;
    ctx.fillStyle = INK;
    ctx.fillText(o.title, W / 2, cy);
    const rw = Math.min(W * 0.18, base * 0.2), rh = Math.max(3, base * 0.008), ry = cy + fs * 0.3;
    ctx.fillStyle = '#2f4df0';
    ctx.fillRect(W / 2 - rw / 2, ry, rw, rh);
    if (o.sub) {
      const sf = Math.max(9, base * 0.03);
      ctx.font = '500 ' + sf + 'px ' + FONT_SANS;
      ctx.fillStyle = hexA(INK, 0.65);
      ctx.fillText(o.sub, W / 2, ry + rh + sf * 2.1);
    }
    ctx.restore();
  }

  /* ---------- cover page ---------- */
  const HEX = /^#[0-9a-fA-F]{6}$/;
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const MOTIFS = ['waves', 'stars', 'leaves', 'hex', 'circles', 'mountains', 'diamonds', 'letters', 'sun', 'stripes'];

  /** Make any design (from the AI or from nothing) safe to draw: valid colours, readable ink, known motif. */
  function cleanDesign(d, seedText) {
    d = d && typeof d === 'object' ? d : {};
    let h = 0; for (const ch of String(seedText || 'book')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360, hsl = (hh, s, l) => {
      s /= 100; l /= 100;
      const k = (n) => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    };
    const pick = (v, dflt) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : dflt);
    const bg1 = pick(d.bg1, hsl(hue, 70, 18)), bg2 = pick(d.bg2, hsl((hue + 40) % 360, 65, 30));
    const acc = [pick(d.accent1, hsl((hue + 150) % 360, 85, 62)), pick(d.accent2, hsl((hue + 200) % 360, 85, 66)), pick(d.accent3, hsl((hue + 30) % 360, 90, 64))];
    let ink = pick(d.ink, '#ffffff');
    const mid = lum(bg1) < lum(bg2) ? bg1 : bg2;
    const worst = lum(bg1) > lum(bg2) ? bg1 : bg2;
    if (contrast(ink, worst) < 4.5 || contrast(ink, mid) < 4.5) ink = contrast('#ffffff', worst) >= contrast('#141a26', worst) ? '#ffffff' : '#141a26';
    return { bg1, bg2, ink, acc, motif: MOTIFS.includes(d.motif) ? d.motif : MOTIFS[h % MOTIFS.length] };
  }

  function drawMotif(ctx, kind, x, y, w, h, rng, acc, letters, flip) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const R = (a, b) => a + rng() * (b - a), A = () => acc[Math.floor(rng() * acc.length)];
    const u = Math.min(w, h);
    if (kind === 'waves') {
      for (let i = 0; i < 6; i++) {
        const yy = y + (h * (i + 0.5)) / 6;
        ctx.beginPath();
        for (let xx = 0; xx <= w; xx += 6) { const v = yy + Math.sin(xx / (w / 6) * Math.PI * 2 + i) * u * 0.07; xx ? ctx.lineTo(x + xx, v) : ctx.moveTo(x, v); }
        ctx.strokeStyle = hexA(acc[i % acc.length], 0.8); ctx.lineWidth = u * 0.035; ctx.lineCap = 'round'; ctx.stroke();
      }
    } else if (kind === 'stars') {
      for (let i = 0; i < 26; i++) {
        const cx = x + rng() * w, cy = y + rng() * h, r = R(u * 0.03, u * 0.13);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.22 : r, a = (k * Math.PI) / 4; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = hexA(A(), R(0.5, 0.95)); ctx.fill();
      }
    } else if (kind === 'leaves') {
      for (let i = 0; i < 22; i++) {
        ctx.save(); ctx.translate(x + rng() * w, y + rng() * h); ctx.rotate(R(0, Math.PI * 2));
        const r = R(u * 0.08, u * 0.2);
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fillStyle = hexA(A(), R(0.5, 0.9)); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, u * 0.01); ctx.stroke();
        ctx.restore();
      }
    } else if (kind === 'hex') {
      const r = u * 0.17, hh = r * Math.sqrt(3);
      for (let row = -1; row < h / hh + 1; row++) for (let col = -1; col < w / (r * 1.5) + 1; col++) {
        const cx = x + col * r * 1.5, cy = y + row * hh + (col % 2 ? hh / 2 : 0);
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); } ctx.closePath();
        if (rng() < 0.4) { ctx.fillStyle = hexA(A(), R(0.35, 0.8)); ctx.fill(); }
        ctx.strokeStyle = hexA(acc[0], 0.55); ctx.lineWidth = Math.max(1.5, u * 0.012); ctx.stroke();
      }
    } else if (kind === 'circles') {
      for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.arc(x + rng() * w, y + rng() * h, R(u * 0.04, u * 0.22), 0, Math.PI * 2); ctx.fillStyle = hexA(A(), R(0.25, 0.7)); ctx.fill(); }
    } else if (kind === 'mountains') {
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath(); const base = flip ? y : y + h;
        ctx.moveTo(x, base);
        let px = x; while (px < x + w + u * 0.3) { const peak = R(h * 0.35, h * 0.95) * (1 - layer * 0.18); ctx.lineTo(px + u * 0.15, base + (flip ? 1 : -1) * peak); px += u * 0.3; ctx.lineTo(px, base); }
        ctx.closePath(); ctx.fillStyle = hexA(acc[layer % acc.length], 0.75 - layer * 0.15); ctx.fill();
      }
    } else if (kind === 'diamonds') {
      const s = u * 0.2;
      for (let row = 0; row < h / s + 2; row++) for (let col = 0; col < w / s + 2; col++) {
        if (rng() < 0.3) continue;
        const cx = x + col * s + (row % 2 ? s / 2 : 0), cy = y + row * s * 0.6;
        ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4); ctx.lineTo(cx + s * 0.3, cy); ctx.lineTo(cx, cy + s * 0.4); ctx.lineTo(cx - s * 0.3, cy); ctx.closePath();
        ctx.fillStyle = hexA(A(), R(0.4, 0.9)); ctx.fill();
      }
    } else if (kind === 'letters') {
      const s = u * 0.2, pool = letters && letters.length ? letters : 'WORDSEARCH'.split('');
      ctx.font = '800 ' + s + 'px ' + FONT_DISPLAY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let row = 0; row < h / s + 1; row++) for (let col = 0; col < w / s + 1; col++) {
        ctx.fillStyle = hexA(A(), R(0.25, 0.75));
        ctx.fillText(pool[Math.floor(rng() * pool.length)], x + col * s + s / 2, y + row * s + s / 2);
      }
    } else if (kind === 'sun') {
      const cx = x + w * R(0.3, 0.7), cy = flip ? y : y + h;
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, u * 2, a, a + 0.12); ctx.closePath(); ctx.fillStyle = hexA(acc[i % acc.length], 0.35); ctx.fill(); }
      for (let i = 3; i > 0; i--) { ctx.beginPath(); ctx.arc(cx, cy, u * 0.22 * i, 0, Math.PI * 2); ctx.fillStyle = hexA(acc[i % acc.length], 0.55); ctx.fill(); }
    } else { // stripes
      for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(x + (w / 8) * i, y); ctx.rotate(-0.5); ctx.fillStyle = hexA(acc[i % acc.length], 0.7); ctx.fillRect(0, -h, u * 0.07, h * 4); ctx.restore(); }
    }
    ctx.restore();
  }

  /**
   * The cover: a gradient, a motif in a band at the top and at the bottom, and the title centred between them.
   * spec: {title, tagline, words:[letters], design}. o: {lang}
   */
  function drawCover(ctx, W, H, spec, o) {
    useLang(o && o.lang);
    const d = cleanDesign(spec.design, spec.title);
    const base = Math.min(W, H);
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, d.bg1); g.addColorStop(1, d.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    let seed = 7; for (const ch of String(spec.title)) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
    const rng = (() => { let a = seed || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const bandH = H * 0.24;
    drawMotif(ctx, d.motif, 0, 0, W, bandH, rng, d.acc, spec.letters, true);
    drawMotif(ctx, d.motif, 0, H - bandH, W, bandH, rng, d.acc, spec.letters, false);
    // soft panel behind the text keeps it readable on any motif
    const px = W * 0.08, pw = W * 0.84;
    // title, wrapped to the panel
    const title = String(spec.title || '').trim() || 'Word Search';
    const maxW = pw * 0.9, CJKRe = /[　-鿿]/;
    const wrap = (fs) => {
      ctx.font = '800 ' + fs + 'px ' + FONT_DISPLAY;
      const toks = (title.match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+/g) || [title]);
      const lines = []; let cur = '';
      toks.forEach((t) => {
        const tt = cur ? cur + (CJKRe.test(cur.slice(-1)) || CJKRe.test(t[0]) ? '' : ' ') + t : t;
        if (ctx.measureText(tt).width <= maxW || !cur) cur = tt; else { lines.push(cur); cur = t; }
      });
      if (cur) lines.push(cur);
      return lines;
    };
    let fs = base * 0.12, lines = wrap(fs);
    while ((lines.length > 4 || lines.some((l) => ctx.measureText(l).width > maxW)) && fs > base * 0.03) { fs *= 0.92; lines = wrap(fs); }
    const lh = fs * 1.12, blockH = lines.length * lh;
    const cy = H / 2 - blockH / 2 + fs * 0.05;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const sub = String(spec.tagline || '').trim();
    const subFs = base * 0.032;
    const panelH = blockH + fs * 0.9 + (sub ? subFs * 3 : 0);
    const py = cy - fs * 0.55;
    ctx.fillStyle = hexA(d.bg1, 0.55);
    const rr = base * 0.03;
    ctx.beginPath(); ctx.moveTo(px + rr, py); ctx.arcTo(px + pw, py, px + pw, py + panelH, rr); ctx.arcTo(px + pw, py + panelH, px, py + panelH, rr); ctx.arcTo(px, py + panelH, px, py, rr); ctx.arcTo(px, py, px + pw, py, rr); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.ink; ctx.font = '800 ' + fs + 'px ' + FONT_DISPLAY;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, cy + fs * 0.8 + i * lh));
    const ry = cy + blockH + fs * 0.12;
    ctx.fillStyle = d.acc[0]; const rw = Math.min(pw * 0.3, base * 0.22);
    ctx.fillRect(W / 2 - rw / 2, ry, rw, Math.max(3, base * 0.008));
    if (sub) {
      ctx.fillStyle = d.ink; ctx.font = '500 ' + subFs + 'px ' + FONT_SANS;
      let t = sub; while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2);
      ctx.fillText(t, W / 2, ry + subFs * 2.1);
    }
    ctx.restore();
  }

  /** A page with nothing on it. */
  function drawBlank(ctx, W, H) { ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  root.WSR = { drawCover, drawBlank, cleanDesign, MOTIFS, useLang, PALETTE, FONT_MONO, FONT_SANS, FONT_DISPLAY, drawGrid, drawMaskEditor, drawPage, paginateText, drawTextPage, drawSeparator, pagePixels, hexA, SEL_COLORS, SEL_LABELS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
