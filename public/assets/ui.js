/* Styled replacements for the browser's alert / confirm / prompt boxes.
   ui.confirm(message, {ok, danger, title}) → Promise<boolean>; ui.alert(message) → Promise; ui.prompt(message, {expect, ok, danger}) → Promise<string|null>
   Forms with data-confirm="…" ask before they submit (data-danger makes the button red). */
(function () {
  'use strict';
  if (window.ui) return;
  var T = function (s) { return (window.T && window.T[s]) || s; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function box(kind, msg, o) {
    o = o || {};
    return new Promise(function (done) {
      var d = document.createElement('dialog'); d.className = 'au-dlg uidlg'; d.setAttribute('role', kind === 'alert' ? 'alertdialog' : 'dialog'); d.setAttribute('aria-labelledby', 'uiT'); d.setAttribute('aria-describedby', 'uiM');
      var title = o.title || (kind === 'alert' ? T('Please note') : o.danger ? T('Are you sure?') : T('Please confirm'));
      d.innerHTML = '<form method="dialog" class="au-f" novalidate><div class="au-hd"><h3 id="uiT">' + esc(title) + '</h3></div>' +
        '<div class="au-bd"><p id="uiM" class="uimsg">' + esc(msg).replace(/\n/g, '<br>') + '</p>' +
        (kind === 'prompt' ? '<input class="uiin" autocomplete="off" spellcheck="false"' + (o.expect ? ' placeholder="' + esc(o.expect) + '"' : '') + '>' : '') + '</div>' +
        '<div class="au-ft">' + (kind === 'alert' ? '' : '<button type="button" class="b2 uino">' + esc(o.cancel || T('Cancel')) + '</button>') +
        '<button type="button" class="b2 ' + (o.danger ? 'dng solid' : 'pri') + ' uiok">' + esc(o.ok || (kind === 'alert' ? T('OK') : T('Continue'))) + '</button></div></form>';
      document.body.appendChild(d);
      var inp = d.querySelector('.uiin'), ok = d.querySelector('.uiok'), back = document.activeElement;
      function end(v) { d.close(); d.remove(); if (back && back.focus) try { back.focus(); } catch (e) { /* gone */ } done(v); }
      if (inp && o.expect) { ok.disabled = true; inp.addEventListener('input', function () { ok.disabled = inp.value.trim() !== o.expect; }); }
      if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!ok.disabled) ok.click(); } });
      ok.addEventListener('click', function () { end(kind === 'prompt' ? inp.value : true); });
      var no = d.querySelector('.uino'); if (no) no.addEventListener('click', function () { end(kind === 'prompt' ? null : false); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); end(kind === 'prompt' ? null : kind === 'alert' ? true : false); });
      d.showModal(); (inp || (o.danger && no) || ok).focus();
    });
  }
  window.ui = {
    confirm: function (m, o) { return box('confirm', m, o); },
    alert: function (m, o) { return box('alert', m, o); },
    prompt: function (m, o) { return box('prompt', m, o); },
  };
  // Date and time fields: a calendar/clock picker in the site's style instead of the browser's own (on phones the native picker is kept; it is the better one there)
  var ME = (document.currentScript && document.currentScript.src) || '', BASE = ME.replace(/ui\.js(\?.*)?$/, '');
  function pickers() {
    var list = [].slice.call(document.querySelectorAll('input[type=date],input[type=time],input[type=datetime-local]')).filter(function (x) { return !x._flatpickr && !x.hasAttribute('data-native'); });
    if (!list.length || !window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
    var go = function () {
      list.forEach(function (x) {
        var t = x.type, o = { allowInput: true, disableMobile: true, time_24hr: true, minuteIncrement: 5, monthSelectorType: 'static', locale: { firstDayOfWeek: 1 },
          onChange: function () { x.dispatchEvent(new Event('input', { bubbles: true })); } };
        if (t === 'date') { o.dateFormat = 'Y-m-d'; o.altInput = true; o.altFormat = 'j F Y'; }
        else if (t === 'time') { o.enableTime = true; o.noCalendar = true; o.dateFormat = 'H:i'; }
        else { o.enableTime = true; o.dateFormat = 'Y-m-d\\TH:i'; o.altInput = true; o.altFormat = 'j M Y, H:i'; }
        if (x.min) o.minDate = x.min; if (x.max) o.maxDate = x.max;
        var ph = x.getAttribute('placeholder') || (t === 'date' ? T('Choose a date') : t === 'time' ? T('Choose a time') : T('Choose date and time'));
        var fp = window.flatpickr(x, o);
        var vis = fp.altInput || x; vis.placeholder = ph; vis.classList.add('fp-in');
        if (fp.altInput) { fp.altInput.disabled = x.disabled; if (x.id) { fp.altInput.id = x.id + '_fp'; var lb = document.querySelector('label[for="' + x.id + '"]'); if (lb) lb.htmlFor = fp.altInput.id; } }
        if (!x.required) {   // a clear button for optional fields
          var cl = document.createElement('button'); cl.type = 'button'; cl.className = 'fp-clear'; cl.setAttribute('aria-label', T('Clear')); cl.innerHTML = '×';
          cl.addEventListener('click', function () { fp.clear(); x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); });
          var bx = document.createElement('span'); bx.className = 'fp-wrap'; vis.parentNode.insertBefore(bx, vis); bx.appendChild(vis); bx.appendChild(cl);
        }
      });
    };
    if (window.flatpickr) return go();
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + 'flatpickr/flatpickr.min.css'; document.head.appendChild(l);
    var sc = document.createElement('script'); sc.src = BASE + 'flatpickr/flatpickr.min.js'; sc.onload = go; document.head.appendChild(sc);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pickers); else pickers();
  window.ui && (window.ui.pickers = pickers);
  // <form data-confirm="Question?" [data-danger] [data-ok="Delete"]>: ask first, then submit for real
  document.addEventListener('submit', function (e) {
    var f = e.target, m = f.getAttribute && f.getAttribute('data-confirm');
    if (!m || f.__uiOk) { f.__uiOk = false; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    var sub = e.submitter;
    window.ui.confirm(m, { danger: f.hasAttribute('data-danger') || /delete|remove|reset|cancel/i.test(f.getAttribute('data-ok') || m), ok: f.getAttribute('data-ok') || undefined }).then(function (yes) {
      if (!yes) return; f.__uiOk = true;
      if (f.requestSubmit) f.requestSubmit(sub && sub.form === f ? sub : undefined); else f.submit();
    });
  }, true);
})();
