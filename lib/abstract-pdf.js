'use strict';
// Typeset abstracts as A4 PDF, in the style of a LaTeX abstract book: TeX Gyre Pagella text, equations set by
// MathJax (TeX input → vector paths), justified paragraphs, numbered affiliations, page header and footer.
// Equations: $…$ or \(…\) inline, $$…$$ or \[…\] on their own line. A literal dollar sign is written \$.
const path = require('path');
const FONT = (n) => path.join(__dirname, '..', 'public', 'assets', 'fonts', `pagella-${n}.woff2`);
let PDFDocument, SVGtoPDF, MJ;
function lib() { PDFDocument ||= require('pdfkit'); SVGtoPDF ||= require('svg-to-pdfkit'); }

// ── MathJax, started on first use (about a second), then kept ──
function mathjax() {
  if (MJ) return MJ;
  const { mathjax: M } = require('mathjax-full/js/mathjax.js');
  const { TeX } = require('mathjax-full/js/input/tex.js');
  const { SVG } = require('mathjax-full/js/output/svg.js');
  const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
  const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
  const adaptor = liteAdaptor(); RegisterHTMLHandler(adaptor);
  const doc = M.document('', { InputJax: new TeX({ packages: AllPackages.filter((p) => !['require', 'autoload', 'html', 'bbox', 'unicode'].includes(p)), formatError: (jax, err) => { throw err; } }), OutputJax: new SVG({ fontCache: 'none' }) });
  const cache = new Map();
  MJ = (tex, display) => {
    const key = (display ? 'D' : 'I') + tex; if (cache.has(key)) return cache.get(key);
    let out;
    try {
      const svg = adaptor.innerHTML(doc.convert(tex, { display }));
      const num = (re) => { const m = re.exec(svg); return m ? parseFloat(m[1]) : 0; };
      out = { svg: svg.replace(/ (width|height)="[\d.]+ex"/g, '').replace(/ style="[^"]*"/, ''), w: num(/width="([\d.]+)ex"/), h: num(/height="([\d.]+)ex"/), va: num(/vertical-align:\s*(-?[\d.]+)ex/) };
    } catch (err) { out = { error: String(err && err.message || err).replace(/^TeX parse error:\s*/i, '').slice(0, 160) }; }
    if (cache.size > 2000) cache.clear(); cache.set(key, out); return out;
  };
  return MJ;
}

// ── split text into paragraphs, and paragraphs into text / inline math / display math ──
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$((?:\\\$|[^$\n])+?)(?<!\\)\$/g;
function parse(text) {
  const blocks = [];
  for (const para of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    if (!para.trim()) continue;
    let last = 0, cur = []; MATH_RE.lastIndex = 0; let m;
    const flush = () => { if (cur.length) blocks.push({ k: 'p', parts: cur }); cur = []; };
    while ((m = MATH_RE.exec(para))) {
      if (m.index > last) cur.push({ t: 'text', s: para.slice(last, m.index) });
      if (m[1] != null || m[2] != null) { flush(); blocks.push({ k: 'eq', tex: (m[1] ?? m[2]).trim() }); }
      else cur.push({ t: 'math', tex: (m[3] ?? m[4]).trim() });
      last = m.index + m[0].length;
    }
    if (last < para.length) cur.push({ t: 'text', s: para.slice(last) });
    flush();
  }
  blocks.forEach((b) => b.parts && b.parts.forEach((p) => { if (p.t === 'text') p.s = p.s.replace(/\\\$/g, '$').replace(/\s+/g, ' '); }));
  return blocks;
}
// equations that MathJax cannot read, for a clear message when the abstract is saved
function mathErrors(...texts) {
  const errs = [], mj = mathjax(); let n = 0;
  for (const t of texts) for (const b of parse(t)) {
    const list = b.k === 'eq' ? [[b.tex, true]] : b.parts.filter((p) => p.t === 'math').map((p) => [p.tex, false]);
    for (const [tex, d] of list) { n++; const r = mj(tex, d); if (r.error) errs.push(`Equation ${n} (${tex.length > 40 ? tex.slice(0, 40) + '…' : tex}): ${r.error}`); }
  }
  return errs;
}

// ── layout ──
const EX = 0.47;                                                     // MathJax sizes are in ex; Pagella's x-height is about 0.44 em
const A4 = [595.28, 841.89], M = { l: 70, r: 70, t: 64, b: 64 };
const NAVY = '#12285C', MUTE = '#5B6478', INK = '#1E2230';
function fonts(doc) { doc.registerFont('R', FONT('regular')); doc.registerFont('I', FONT('italic')); doc.registerFont('B', FONT('bold')); doc.registerFont('BI', FONT('bolditalic')); }
function metrics(doc, f, size) { doc.font(f).fontSize(size); const fo = doc._font; return { asc: (fo.ascender / 1000) * size, desc: (-fo.descender / 1000) * size }; }

// words and equations → lines (greedy), drawn justified, centred or left
function flow(doc, parts, o) {
  const { x, width, size, font = 'R', align = 'justify', color = INK, gap = 0.32 } = o;
  const mj = mathjax(), ex = size * EX; const fm = metrics(doc, font, size);
  const items = [];
  for (const p of parts) {
    if (p.t === 'math') {
      const r = mj(p.tex, false);
      if (r.error) { doc.font(font).fontSize(size); const s2 = '[' + p.tex + ']'; items.push({ k: 'w', s: s2, f: font, size, w: doc.widthOfString(s2), sp: p.sp }); continue; }
      const w = r.w * ex, h = r.h * ex, dep = -r.va * ex;
      items.push({ k: 'm', svg: r.svg, w, h, above: h - dep, below: dep, sp: p.sp });
      continue;
    }
    const f = p.f || font; doc.font(f).fontSize(p.size || size);
    const s = p.s; const words = s.split(/(\s+)/);
    let pendingSpace = /^\s/.test(s);
    for (const wd of words) {
      if (!wd) continue;
      if (/^\s+$/.test(wd)) { pendingSpace = true; continue; }
      items.push({ k: 'w', s: wd, f, size: p.size || size, rise: p.rise || 0, col: p.col, w: doc.widthOfString(wd), sp: pendingSpace, u: p.u });
      if (p.whole) { items[items.length - 1].s = s.trim(); items[items.length - 1].w = doc.widthOfString(s.trim()); break; }
      pendingSpace = false;
    }
    if (/\s$/.test(s)) items.push({ k: 'sp' });
  }
  // a space after an item is carried as "sp" on the next item; math items take their spacing from the text around them
  const seq = []; let wantSpace = false;
  for (const it of items) { if (it.k === 'sp') { wantSpace = true; continue; } if (it.k === 'm') it.sp = wantSpace || it.sp === true; else it.sp = it.sp || wantSpace; wantSpace = false; seq.push(it); }
  doc.font(font).fontSize(size); const spW = doc.widthOfString(' ');
  const lines = []; let cur = [], w = 0;
  for (const it of seq) {
    const add = (cur.length && it.sp ? spW : 0) + it.w;
    if (cur.length && w + add > width) { lines.push(cur); cur = []; w = 0; }
    cur.push(it); w += (cur.length > 1 && it.sp ? spW : 0) + it.w;
  }
  if (cur.length) lines.push(cur);
  let y = o.y;
  lines.forEach((ln, li) => {
    const asc = Math.max(fm.asc, ...ln.filter((i) => i.k === 'm').map((i) => i.above + 1));
    const desc = Math.max(fm.desc, ...ln.filter((i) => i.k === 'm').map((i) => i.below + 1));
    if (o.pageBreak && y + asc + desc > A4[1] - M.b) { o.pageBreak(); y = M.t + 14; }
    const natural = ln.reduce((s, it, i) => s + it.w + (i && it.sp ? spW : 0), 0);
    const gaps = ln.filter((it, i) => i && it.sp).length;
    const last = li === lines.length - 1;
    let extra = 0, start = x;
    if (align === 'justify' && !last && gaps) extra = (width - natural) / gaps;
    else if (align === 'center') start = x + (width - natural) / 2;
    const base = y + asc; let cx = start;
    ln.forEach((it, i) => {
      if (i && it.sp) cx += spW + extra;
      if (it.k === 'm') SVGtoPDF(doc, it.svg, cx, base - it.above, { width: it.w, height: it.h, assumePt: true, colorCallback: () => [[30, 34, 48], 1] });
      else {
        doc.font(it.f).fontSize(it.size).fillColor(it.col || color);
        const m2 = metrics(doc, it.f, it.size);
        doc.text(it.s, cx, base - m2.asc - (it.rise || 0), { lineBreak: false });
        if (it.u) doc.moveTo(cx, base + 1.6).lineTo(cx + it.w, base + 1.6).lineWidth(0.6).strokeColor(it.col || color).stroke();
      }
      cx += it.w;
    });
    y = base + desc + size * gap;
  });
  return y;
}

function header(doc, meta) {
  doc.font('I').fontSize(8.5).fillColor(MUTE);
  doc.text(meta.left || '', M.l, 36, { width: A4[0] - M.l - M.r, align: 'left', lineBreak: false });
  doc.text(meta.right || '', M.l, 36, { width: A4[0] - M.l - M.r, align: 'right', lineBreak: false });
  doc.moveTo(M.l, 50).lineTo(A4[0] - M.r, 50).lineWidth(0.5).strokeColor('#B9BFCC').stroke();
}
function footer(doc, n) { doc.font('R').fontSize(9).fillColor(MUTE).text(String(n), M.l, A4[1] - 40, { width: A4[0] - M.l - M.r, align: 'center', lineBreak: false }); }

// one abstract, starting at the top of the current page
function abstractPage(doc, a, state) {
  const W = A4[0] - M.l - M.r; let y = M.t + 4;
  const newPage = () => { footer(doc, state.page); doc.addPage(); state.page++; header(doc, state.meta); };
  if (a.kind || a.ref) {
    doc.font('I').fontSize(9.5).fillColor('#8A6A10').text(a.kind || '', M.l, y, { width: W, lineBreak: false });
    if (a.ref) doc.font('R').fontSize(9.5).fillColor(MUTE).text(a.ref, M.l, y, { width: W, align: 'right', lineBreak: false });
    y += 22;
  }
  // title (may contain math)
  const tparts = parse(a.title || 'Untitled')[0]; const tp = tparts && tparts.parts ? tparts.parts : [{ t: 'text', s: a.title || 'Untitled' }];
  y = flow(doc, tp.map((p) => ({ ...p, f: 'B' })), { x: M.l + 10, y, width: W - 20, size: 15.5, font: 'B', align: 'center', color: NAVY, gap: 0.18 });
  y += 8;
  // authors with superscript affiliation numbers; the presenting author is underlined, * marks the corresponding author
  const au = []; (a.authors.a || []).forEach((x, i) => {
    au.push({ t: 'text', s: (i ? ', ' : '') + x.n, f: 'R', u: x.p ? 1 : 0, whole: 1 });
    const s = (x.f || []).join(',') + (x.c ? '*' : ''); if (s) au.push({ t: 'text', s, f: 'R', size: 7.5, rise: 4.2, sp: false });
  });
  // keep ", " attached: split comma into its own text so underline only covers the name
  const au2 = []; au.forEach((p) => { if (p.t === 'text' && p.s.startsWith(', ')) { au2.push({ t: 'text', s: ',', f: 'R', sp: false }); au2.push({ ...p, s: ' ' + p.s.slice(2) }); } else au2.push(p); });
  if (au2.length) y = flow(doc, au2, { x: M.l, y, width: W, size: 11, align: 'center', gap: 0.25 });
  y += 2;
  (a.authors.f || []).forEach((t, i) => {
    y = flow(doc, [{ t: 'text', s: String(i + 1), f: 'I', size: 6.8, rise: 3.6 }, { t: 'text', s: ' ' + t, f: 'I' }], { x: M.l, y, width: W, size: 9.5, font: 'I', align: 'center', color: MUTE, gap: 0.12 });
  });
  const corr = (a.authors.a || []).filter((x) => x.c && x.e);
  if (corr.length) { y += 2; y = flow(doc, [{ t: 'text', s: '*Corresponding author: ' + corr.map((x) => x.e).join(', '), f: 'I' }], { x: M.l, y, width: W, size: 9, font: 'I', align: 'center', color: MUTE, gap: 0.1 }); }
  y += 14;
  doc.font('B').fontSize(10.5).fillColor(NAVY).text('Abstract', M.l, y, { lineBreak: false }); y += 17;
  for (const b of parse(a.abstract)) {
    if (b.k === 'eq') {
      const r = mathjax()(b.tex, true), ex = 11 * EX;
      if (r.error) { y = flow(doc, [{ t: 'text', s: '[' + b.tex + ']' }], { x: M.l, y, width: W, size: 11, align: 'center', pageBreak: newPage }); continue; }
      const w = Math.min(W, r.w * ex), h = r.h * ex * (w / (r.w * ex));
      if (y + h + 12 > A4[1] - M.b) { newPage(); y = M.t + 14; }
      SVGtoPDF(doc, r.svg, M.l + (W - w) / 2, y + 4, { width: w, height: h, assumePt: true });
      y += h + 12; continue;
    }
    y = flow(doc, b.parts, { x: M.l, y, width: W, size: 11, align: 'justify', pageBreak: newPage, gap: 0.36 }) + 5;
  }
  if (a.keywords) { y += 6; y = flow(doc, [{ t: 'text', s: 'Keywords: ', f: 'B' }, { t: 'text', s: a.keywords, f: 'I' }], { x: M.l, y, width: W, size: 10, align: 'left', pageBreak: newPage, color: INK }); }
  return y;
}

// a single abstract → PDF buffer, or many (abstract book) streamed to res
function make(list, opts = {}) {
  lib();
  const doc = new PDFDocument({ size: 'A4', margins: { top: M.t, bottom: 0, left: M.l, right: M.r }, autoFirstPage: false, bufferPages: false,
    info: { Title: opts.title || 'Abstract', Author: opts.author || '', Subject: opts.subject || '', Creator: 'ICSSST 2027 website' } });
  fonts(doc);
  const state = { page: 1, meta: { left: opts.headLeft || '', right: opts.headRight || '' } };
  if (opts.cover) {
    doc.addPage();
    doc.font('B').fontSize(30).fillColor(NAVY).text(opts.cover.title, M.l, 250, { width: A4[0] - M.l - M.r, align: 'center' });
    doc.moveDown(0.4).font('I').fontSize(13).fillColor(INK).text(opts.cover.sub || '', { align: 'center' });
    doc.moveDown(2).font('R').fontSize(11).fillColor(MUTE).text(opts.cover.foot || '', { align: 'center' });
    state.page++;
  }
  list.forEach((a) => { doc.addPage(); header(doc, state.meta); abstractPage(doc, a, state); footer(doc, state.page); state.page++; });
  return doc;
}
function buffer(list, opts) {
  return new Promise((ok, no) => { const doc = make(list, opts); const bufs = []; doc.on('data', (b) => bufs.push(b)); doc.on('end', () => ok(Buffer.concat(bufs))); doc.on('error', no); doc.end(); });
}

// ── LaTeX source (for proceedings editors): the same content as a .tex file ──
const TEXESC = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '#': '\\#', '%': '\\%', '&': '\\&', '_': '\\_', '^': '\\^{}', '~': '\\~{}', '$': '\\$' };
const texText = (s) => String(s || '').replace(/[\\{}#%&_^~$]/g, (c) => TEXESC[c]);
function texBody(t) {
  return parse(t).map((b) => (b.k === 'eq' ? `\\[\n${b.tex}\n\\]` : b.parts.map((p) => (p.t === 'math' ? `$${p.tex}$` : texText(p.s))).join(''))).join('\n\n');
}
function tex(list, opts = {}) {
  const one = (a) => {
    const au = (a.authors.a || []).map((x) => `${x.p ? '\\underline{' + texText(x.n) + '}' : texText(x.n)}\\textsuperscript{${(x.f || []).join(',')}${x.c ? '*' : ''}}`).join(', ');
    const af = (a.authors.f || []).map((t, i) => `\\textsuperscript{${i + 1}}${texText(t)}`).join('\\\\\n');
    const corr = (a.authors.a || []).filter((x) => x.c && x.e).map((x) => texText(x.e)).join(', ');
    const title = parse(a.title)[0]; const tt = title && title.parts ? title.parts.map((p) => (p.t === 'math' ? `$${p.tex}$` : texText(p.s))).join('') : texText(a.title);
    return `\\begin{abstractpage}{${texText(a.kind || '')}}{${texText(a.ref || '')}}
\\section*{\\centering ${tt}}
\\addcontentsline{toc}{section}{${texText(a.title)}}
\\begin{center}
${au}\\\\[4pt]
{\\small\\itshape ${af}}${corr ? `\\\\[2pt]\n{\\small\\itshape *Corresponding author: ${corr}}` : ''}
\\end{center}
\\paragraph{Abstract}
${texBody(a.abstract)}
${a.keywords ? `\n\\medskip\\noindent\\textbf{Keywords:} \\textit{${texText(a.keywords)}}` : ''}
\\end{abstractpage}
`;
  };
  return `% ${opts.title || 'Abstracts'} — generated by the ICSSST 2027 website
\\documentclass[11pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{tgpagella}
\\usepackage{amsmath,amssymb}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{fancyhdr}
\\pagestyle{fancy}\\fancyhf{}\\fancyhead[L]{\\small\\itshape ${texText(opts.headLeft || '')}}\\fancyfoot[C]{\\thepage}
\\newenvironment{abstractpage}[2]{\\clearpage\\noindent{\\small\\itshape #1}\\hfill{\\small #2}\\par}{\\par}
\\begin{document}
${opts.cover ? `\\begin{titlepage}\\centering\\vspace*{6cm}{\\Huge\\bfseries ${texText(opts.cover.title)}\\par}\\vspace{1em}{\\large\\itshape ${texText(opts.cover.sub || '')}\\par}\\vfill{${texText(opts.cover.foot || '')}}\\end{titlepage}\n\\tableofcontents\n` : ''}${list.map(one).join('\n')}
\\end{document}
`;
}

module.exports = { make, buffer, tex, parse, mathErrors, texText };
