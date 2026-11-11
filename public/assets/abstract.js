/* Abstract editor: live word count (an equation counts as one word) and a typeset preview with LaTeX equations (KaTeX).
   Markup: <form data-abs data-base="/" data-min="150" data-max="300"> with #paper_title, #abstract, #authors (JSON), #keywords, .abs-n and .abs-prev */
(function () {
  'use strict';
  var f = document.querySelector('form[data-abs]'); if (!f) return;
  var T = function (s) { return (window.T && window.T[s]) || s; };
  var B = f.getAttribute('data-base') || '', MIN = +f.getAttribute('data-min') || 0, MAX = +f.getAttribute('data-max') || 0;
  var ti = f.querySelector('[name=' + (f.getAttribute('data-title') || 'paper_title') + ']'), ab = f.querySelector('[name=abstract]'), au = f.querySelector('[name=authors]'), kw = f.querySelector('[name=keywords]');
  var cnt = f.querySelector('.abs-n'), prev = f.querySelector('.abs-prev');
  var MATH = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g;
  var words = function (t) { return String(t || '').replace(MATH, ' x ').trim().split(/\s+/).filter(Boolean).length; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function count() {
    if (!cnt) return; var n = words(ab.value);
    cnt.textContent = n + ' ' + T('words') + (MAX ? ' / ' + MAX : '');
    cnt.className = 'abs-n ' + (MAX && n > MAX ? 'over' : MIN && n < MIN ? 'under' : 'ok');
  }
  // KaTeX is loaded only when the preview is first shown
  var kx = null;
  function katex(cb) {
    if (window.renderMathInElement) return cb();
    if (kx) return kx.push(cb); kx = [cb];
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = B + '/assets/katex/katex.min.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = B + '/assets/katex/katex.min.js';
    s.onload = function () { var a = document.createElement('script'); a.src = B + '/assets/katex/contrib/auto-render.min.js'; a.onload = function () { kx.forEach(function (f) { f(); }); }; document.head.appendChild(a); };
    document.head.appendChild(s);
  }
  var timer = 0;
  function preview() {
    if (!prev || prev.closest('[hidden]')) return;
    clearTimeout(timer); timer = setTimeout(function () {
      var A; try { A = JSON.parse(au && au.value || '{}'); } catch (e) { A = {}; }
      var a = A.a || [], fl = A.f || [];
      var paras = String(ab.value || '').replace(/\r/g, '').split(/\n\s*\n/).filter(function (p) { return p.trim(); });
      prev.innerHTML = '<p class="pv-t">' + esc(ti.value || T('Title')) + '</p>' +
        '<p class="pv-a">' + a.map(function (x) { return (x.p ? '<u>' + esc(x.n) + '</u>' : esc(x.n)) + '<sup>' + esc((x.f || []).join(',') + (x.c ? '*' : '')) + '</sup>'; }).join(', ') + '</p>' +
        (fl.length ? '<p class="pv-f">' + fl.map(function (t, i) { return '<sup>' + (i + 1) + '</sup>' + esc(t); }).join('<br>') + '</p>' : '') +
        '<p class="pv-h">' + T('Abstract') + '</p>' + (paras.length ? paras.map(function (p) { return '<p class="pv-p">' + esc(p) + '</p>'; }).join('') : '<p class="pv-p pv-e">' + T('Your abstract will appear here.') + '</p>') +
        (kw && kw.value.trim() ? '<p class="pv-k"><b>' + T('Keywords:') + '</b> <i>' + esc(kw.value) + '</i></p>' : '');
      katex(function () {
        try { window.renderMathInElement(prev, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false }], throwOnError: false, errorColor: '#B91C1C' }); } catch (e) { /* keep plain text */ }
      });
    }, 220);
  }
  [ti, ab, au, kw].forEach(function (el) { if (el) el.addEventListener('input', function () { count(); preview(); }); });
  // help: insert an example equation at the cursor
  f.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ins]'); if (!b) return; e.preventDefault();
    var t = b.getAttribute('data-ins'), s = ab.selectionStart || ab.value.length, en = ab.selectionEnd || s;
    ab.value = ab.value.slice(0, s) + t + ab.value.slice(en); ab.focus(); ab.selectionStart = ab.selectionEnd = s + t.length; ab.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('tabshow', preview);

  // ── sections of the abstract form as tabs (Title and authors · Abstract · Keywords · Preview) ──
  var panes = [].slice.call(f.querySelectorAll('.apane')), tabs = [];
  function nAuthors() { try { return (JSON.parse(au && au.value || '{}').a || []).length; } catch (e) { return 0; } }
  function marks() {
    if (!tabs.length) return;
    var kwn = kw ? kw.value.split(/[;,]/).filter(function (x) { return x.trim(); }).length : 0, n = words(ab.value);
    var ok = { t: !!(ti && ti.value.trim()) && nAuthors() > 0, a: n > 0 && (!MIN || n >= MIN) && (!MAX || n <= MAX), k: kwn >= 3 && kwn <= 6 };
    tabs.forEach(function (b, i) { var k = panes[i].getAttribute('data-pane'); b.classList.toggle('ok', ok[k] === true); b.classList.toggle('due', ok[k] === false); });
    return ok;
  }
  function pane(i, focus) {
    panes.forEach(function (p, j) { p.hidden = i !== j; tabs[j].setAttribute('aria-selected', i === j); tabs[j].tabIndex = i === j ? 0 : -1; });
    if (focus) tabs[i].focus();
    if (panes[i].getAttribute('data-pane') === 'p') preview();
    try { sessionStorage.setItem('apane:' + location.pathname, panes[i].getAttribute('data-pane')); } catch (e) { /* private mode */ }
  }
  if (panes.length > 1) {
    var bar = document.createElement('div'); bar.className = 'atabs'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', T('Abstract sections'));
    panes.forEach(function (p, i) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'atab-' + p.getAttribute('data-pane'); p.id = p.id || 'apane-' + p.getAttribute('data-pane'); b.setAttribute('aria-controls', p.id); p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      b.innerHTML = '<span class="an">' + (i + 1) + '</span><span class="at">' + esc(T(p.getAttribute('data-label'))) + '</span>';
      b.addEventListener('click', function () { pane(i); });
      b.addEventListener('keydown', function (ev) { var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0; if (d) { ev.preventDefault(); pane((i + d + panes.length) % panes.length, true); } });
      bar.appendChild(b); tabs.push(b);
    });
    var fs = f.querySelector('.absfs') || panes[0]; fs.parentNode.insertBefore(bar, fs);
    var nav = document.createElement('div'); nav.className = 'anav';   // "Next" step inside each section
    panes.forEach(function (p, i) { if (i < panes.length - 1) { var nx = document.createElement('button'); nx.type = 'button'; nx.className = 'b2 anext'; nx.innerHTML = T('Next:') + ' ' + esc(T(panes[i + 1].getAttribute('data-label'))) + ' <span aria-hidden="true">→</span>'; nx.addEventListener('click', function () { pane(i + 1, true); window.scrollTo({ top: bar.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' }); }); var w = nav.cloneNode(); w.appendChild(nx); p.appendChild(w); } });
    var st = marks(), first = 0, last = null; try { last = sessionStorage.getItem('apane:' + location.pathname); } catch (e) { /* private mode */ }
    panes.forEach(function (p, i) { if (p.getAttribute('data-pane') === last) first = i; });
    if (last === null) ['t', 'a', 'k'].some(function (k, i) { if (st[k] === false) { first = i; return true; } });
    pane(first);
    var sb = f.querySelector('.sbtns .btn[type=submit]');
    if (sb) { var sh = document.createElement('span'); sh.className = 'hint savehint'; sh.textContent = T('Saves the title, authors, abstract and keywords together.'); sb.parentNode.appendChild(sh); }
  }

  // ── visual equation editor (MathLive): no LaTeX knowledge needed ──
  var OCR = f.hasAttribute('data-ocr'), CSRF = f.getAttribute('data-csrf') || '';
  function mathlive(cb) {
    if (window.MathfieldElement) return cb();
    var s = document.createElement('script'); s.src = B + '/assets/mathlive/mathlive.min.js';
    s.onload = function () { try { window.MathfieldElement.fontsDirectory = B + '/assets/mathlive/fonts'; window.MathfieldElement.soundsDirectory = null; } catch (e) { /* defaults */ } cb(); };
    s.onerror = function () { var m = T('The equation editor could not be loaded. Please check your connection.'); if (window.ui) ui.alert(m); else alert(m); };
    document.head.appendChild(s);
  }
  function mathAt(el, pos) {   // the $…$ / $$…$$ that contains the cursor
    var m, re = new RegExp(MATH.source, 'g');
    while ((m = re.exec(el.value))) { if (pos > m.index && pos < m.index + m[0].length) return { s: m.index, e: m.index + m[0].length, t: m[0] }; }
    return null;
  }
  var readImg = null, fld = ab, dlg = null, shade = null, mf, src, msg, target = null, sel = [0, 0];
  function inert(on) { [].forEach.call(document.body.children, function (n) { if (n !== dlg && n !== shade && !/^(SCRIPT|STYLE)$/.test(n.tagName) && !/ML__/.test(n.className || '')) { if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); } }); }
  function strip(t) { var d = /^\$\$|^\\\[/.test(t); return { d: d, l: t.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\\\(|\\\)$|^\$|\$$/g, '').trim() }; }
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'au-dlg eqdlg'; dlg.setAttribute('aria-labelledby', 'eqT');
    dlg.innerHTML = '<form method="dialog" class="au-f" novalidate><div class="au-hd"><h3 id="eqT">' + T('Equation') + '</h3><button type="button" class="au-x" aria-label="' + T('Close') + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button></div>' +
      '<div class="au-bd">' +
      '<p class="hint eqhint">' + T('Type the equation as you would write it. Use the keyboard button for symbols. Shortcuts: / makes a fraction, ^ a power, _ a subscript; type alpha, beta, sqrt or int for the symbol.') + '</p>' +
      '<math-field class="eqmf" aria-label="' + T('Equation') + '"></math-field>' +
      (OCR ? '<div class="eqocr" tabindex="0"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg><div><b>' + T('Have it as a picture?') + '</b><span>' + T('Paste a screenshot of the equation here (Ctrl+V) or') + ' <label class="eqpick">' + T('choose an image') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden></label>. ' + T('We will turn it into an equation you can edit.') + '</span><span class="eqmsg" role="status"></span></div></div>' : '') +
      '<fieldset class="eqpos"><legend class="l">' + T('Where should it go?') + '</legend><label><input type="radio" name="eqd" value="0" checked> ' + T('Inside the sentence') + '</label><label><input type="radio" name="eqd" value="1"> ' + T('On its own line') + '</label></fieldset>' +
      '<details class="eqsrc"><summary>' + T('LaTeX code (optional)') + '</summary><textarea rows="3" spellcheck="false" aria-label="LaTeX"></textarea></details>' +
      '</div><div class="au-ft"><button type="button" class="b2 eqc">' + T('Cancel') + '</button><button type="button" class="b2 pri eqok">' + T('Insert equation') + '</button></div></form>';
    shade = document.createElement('div'); shade.className = 'eqshade'; shade.hidden = true; document.body.appendChild(shade); document.body.appendChild(dlg);
    mf = dlg.querySelector('math-field'); src = dlg.querySelector('.eqsrc textarea'); msg = dlg.querySelector('.eqmsg');
    try { mf.mathVirtualKeyboardPolicy = 'auto'; mf.smartFence = true; } catch (e) { /* older engine */ }
    mf.addEventListener('input', function () { src.value = mf.value; });
    src.addEventListener('input', function () { mf.value = src.value; });
    // a non-modal dialog with our own backdrop: MathLive's suggestion list, menu and keyboard live in <body>
    // and would be hidden behind a modal dialog's top layer
    var close = function () { try { window.mathVirtualKeyboard.hide(); } catch (e) { /* none */ } dlg.close(); shade.hidden = true; document.documentElement.classList.remove('eq-open'); inert(false); fld.focus(); };
    shade.addEventListener('click', function () { mf.focus(); });
    document.addEventListener('keydown', function (ev) {   // Esc closes the dialog; MathLive handles Esc itself (and stops it) while its suggestion list is open
      if (ev.key === 'Escape' && dlg.open && !ev.defaultPrevented) { ev.preventDefault(); close(); }
    });
    dlg.querySelector('.au-x').addEventListener('click', close); dlg.querySelector('.eqc').addEventListener('click', close);
    dlg.addEventListener('cancel', function () { try { window.mathVirtualKeyboard.hide(); } catch (e) { /* none */ } });
    dlg.querySelector('.eqok').addEventListener('click', function () {
      var l = (mf.value || '').trim(), disp = dlg.querySelector('input[name=eqd]:checked').value === '1';
      var t = l ? (disp ? '$$' + l + '$$' : '$' + l + '$') : '';
      var a = target ? target.s : sel[0], b = target ? target.e : sel[1];
      if (!t && !target) return close();
      var pre = fld.value.slice(0, a), post = fld.value.slice(b);
      if (t && disp) { if (pre && !/\n$/.test(pre)) t = '\n' + t; if (post && !/^\n/.test(post)) t += '\n'; }
      else if (t) { if (pre && /\S$/.test(pre)) t = ' ' + t; if (post && /^[^\s.,;:)!?]/.test(post)) t += ' '; }
      fld.value = pre + t + post; close(); fld.selectionStart = fld.selectionEnd = a + t.length; fld.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (OCR) {
      var box = dlg.querySelector('.eqocr'), fi = box.querySelector('input[type=file]');
      var read = readImg = function (file) {
        if (!file || !/^image\//.test(file.type)) return;
        msg.className = 'eqmsg'; msg.textContent = T('Reading the equation…'); box.classList.add('busy');
        var img = new Image(), u = URL.createObjectURL(file);
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
          fetch(B + '/eq-ocr', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF }, body: JSON.stringify({ image: c.toDataURL('image/png') }) })
            .then(function (r) { return r.json(); }).then(function (j) {
              box.classList.remove('busy');
              if (!j.ok) { msg.className = 'eqmsg err'; msg.textContent = T(j.error || 'The equation could not be read.'); return; }
              mf.value = j.latex; src.value = mf.value; msg.className = 'eqmsg ok'; msg.textContent = T('Done. Please check the equation above and correct anything that was misread.'); mf.focus();
            }).catch(function () { box.classList.remove('busy'); msg.className = 'eqmsg err'; msg.textContent = T('The equation could not be read just now. Please try again.'); });
        };
        img.onerror = function () { box.classList.remove('busy'); msg.className = 'eqmsg err'; msg.textContent = T('Please use a PNG, JPEG or WebP image.'); };
        img.src = u;
      };
      fi.addEventListener('change', function () { read(fi.files[0]); fi.value = ''; });
      dlg.addEventListener('paste', function (ev) {
        var it = [].slice.call((ev.clipboardData || {}).items || []).filter(function (x) { return x.kind === 'file' && /^image\//.test(x.type); })[0];
        if (it) { ev.preventDefault(); ev.stopPropagation(); read(it.getAsFile()); }
      }, true);
      box.addEventListener('dragover', function (ev) { ev.preventDefault(); box.classList.add('over'); });
      box.addEventListener('dragleave', function () { box.classList.remove('over'); });
      box.addEventListener('drop', function (ev) { ev.preventDefault(); box.classList.remove('over'); read(ev.dataTransfer.files[0]); });
    }
  }
  function openEq(el, img) {
    fld = el || ab; if (fld.disabled || fld.readOnly) return;
    sel = [fld.selectionStart || 0, fld.selectionEnd || 0]; target = mathAt(fld, sel[0]);
    mathlive(function () {
      if (!dlg) build();
      var x = target ? strip(target.t) : { d: false, l: '' };
      var one = fld !== ab; dlg.querySelector('.eqpos').hidden = one;   // a title takes equations inside the line only
      dlg.querySelector('input[name=eqd][value="' + (x.d && !one ? 1 : 0) + '"]').checked = true;
      dlg.querySelector('.eqok').textContent = T(target ? 'Update equation' : 'Insert equation');
      if (msg) { msg.textContent = ''; msg.className = 'eqmsg'; }
      shade.hidden = false; document.documentElement.classList.add('eq-open'); inert(true); dlg.show();
      mf.value = x.l; src.value = x.l; setTimeout(function () { mf.focus(); }, 30);
      if (img && readImg) readImg(img);
    });
  }
  function eqBar(field, small) {
    if (!field) return;
    var tb = document.createElement('div'); tb.className = 'eqbar' + (small ? ' sm' : '');
    tb.innerHTML = '<button type="button" class="b2 eqbtn"><span class="eqi" aria-hidden="true">∑</span><span class="eql">' + T('Insert equation') + '</span></button>' + (small ? '' : '<span class="hint">' + T('Write equations visually, no LaTeX needed') + (OCR ? ' · ' + T('or paste a picture of one') : '') + '</span>');
    field.parentNode.insertBefore(tb, field);
    var eb = tb.querySelector('.eqbtn'), el = tb.querySelector('.eql');
    var upd = function () { el.textContent = T(mathAt(field, field.selectionStart || 0) ? 'Edit this equation' : 'Insert equation'); };
    ['keyup', 'click', 'select', 'input'].forEach(function (k) { field.addEventListener(k, upd); });
    eb.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // keep the caret where it is
    eb.addEventListener('click', function () { openEq(field); });
    field.addEventListener('dblclick', function () { if (mathAt(field, field.selectionStart || 0)) openEq(field); });
    if (OCR) field.addEventListener('paste', function (ev) {   // pasting a picture of an equation opens the editor and reads it
      var it = [].slice.call((ev.clipboardData || {}).items || []).filter(function (x) { return x.kind === 'file' && /^image\//.test(x.type); })[0];
      if (it && !field.disabled) { ev.preventDefault(); openEq(field, it.getAsFile()); }
    });
  }
  eqBar(ab); if (ti && ti.tagName === 'TEXTAREA') eqBar(ti, true);
  [ti, ab, au, kw].forEach(function (el2) { if (el2) el2.addEventListener('input', marks); });
  if (ti && ti.tagName === 'TEXTAREA') ti.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ev.preventDefault(); });   // a title is one line
  // unsaved changes: say so next to the Save button, and warn before leaving the page (the speaker form has its own guard)
  if (!f.hasAttribute('data-guard')) {
    var snap = function () { return [ti, ab, au, kw].map(function (x) { return x ? x.value : ''; }).join('\u0001'); }, base = null, dirty = false, saving = false;
    var bar2 = f.querySelector('.sbtns'), note = document.createElement('span'); note.className = 'unsaved'; note.hidden = true; note.textContent = T('Unsaved changes');
    if (bar2) bar2.appendChild(note);
    setTimeout(function () { base = snap(); }, 0);
    f.addEventListener('input', function () { if (base === null) return; dirty = snap() !== base; note.hidden = !dirty; });
    f.addEventListener('submit', function () { saving = true; });
    addEventListener('beforeunload', function (e) { if (dirty && !saving) { e.preventDefault(); e.returnValue = ''; } });
  }
  if (au) new MutationObserver(marks).observe(au, { attributes: true, attributeFilter: ['value'] });
  count(); preview();
})();
