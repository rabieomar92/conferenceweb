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
    ab.value = ab.value.slice(0, s) + t + ab.value.slice(en); ab.focus(); ab.selectionStart = ab.selectionEnd = s + t.length; ab.dispatchEvent(new Event('input'));
  });
  document.addEventListener('tabshow', preview);
  count(); preview();
})();
