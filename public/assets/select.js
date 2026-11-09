/* Replaces every <select> with a modern pop-up chooser (tiles for short lists, a searchable list for long ones).
   The real <select> stays in the page (hidden), so forms, validation and scripts keep working exactly as before. */
(function () {
  var d = document, openS = null, uid = 0;
  var CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function txt(o) { return (o.textContent || '').replace(/\s+/g, ' ').trim(); }
  function close(focus) {
    if (!openS) return; var s = openS; openS = null;
    s.pop.remove(); s.btn.setAttribute('aria-expanded', 'false'); s.btn.classList.remove('open');
    d.removeEventListener('mousedown', outside, true); removeEventListener('resize', place); removeEventListener('scroll', place, true);
    if (focus) s.btn.focus();
  }
  function outside(e) { if (openS && !openS.pop.contains(e.target) && !openS.btn.contains(e.target)) close(false); }
  function place() {
    if (!openS) return; var b = openS.btn.getBoundingClientRect(), p = openS.pop, vw = innerWidth, vh = innerHeight;
    if (vw <= 560) { p.classList.add('sheet'); p.style.cssText = ''; return; }          // phones: bottom sheet
    p.classList.remove('sheet');
    var w = Math.max(b.width, openS.tiles ? 300 : 240); w = Math.min(w, vw - 24);
    var left = Math.min(Math.max(12, b.left), vw - w - 12);
    p.style.width = w + 'px'; p.style.left = left + 'px'; p.style.maxHeight = '';
    var below = vh - b.bottom - 12, above = b.top - 12, h = p.scrollHeight;
    if (below >= Math.min(h, 280) || below >= above) { p.style.top = (b.bottom + 6) + 'px'; p.style.bottom = 'auto'; p.style.maxHeight = Math.max(160, below) + 'px'; }
    else { p.style.bottom = (vh - b.top + 6) + 'px'; p.style.top = 'auto'; p.style.maxHeight = Math.max(160, above) + 'px'; }
  }
  function enhance(sel) {
    if (sel.multiple || sel.size > 1 || sel.hasAttribute('data-native') || sel.__ss) return; sel.__ss = 1;
    var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'ss-b ' + (sel.className || ''); btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    var lab = sel.getAttribute('aria-label'); if (lab) btn.setAttribute('aria-label', lab);
    var val = d.createElement('span'); val.className = 'ss-v'; btn.appendChild(val);
    sel.classList.add('ss-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true'); sel.parentNode.insertBefore(btn, sel);
    function opts() { return [].slice.call(sel.options).filter(function (o) { return !o.hidden; }); }
    function paint() {
      var o = sel.options[sel.selectedIndex], t = o ? txt(o) : '';
      val.textContent = t || 'Select…'; btn.classList.toggle('ph', !o || (!o.value && !!sel.required) || !t); btn.disabled = sel.disabled;
    }
    paint(); sel.addEventListener('change', paint); if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(paint, 0); });
    new MutationObserver(paint).observe(sel, { attributes: true, childList: true, subtree: true, attributeFilter: ['disabled', 'selected', 'label'] });
    function openIt() {
      if (openS) { var same = openS.btn === btn; close(false); if (same) return; }
      var list = opts(), labels = list.map(txt), tiles = list.length <= 8 && labels.every(function (t) { return t.length <= 22; }) && list.length > 1;
      var pop = d.createElement('div'); pop.className = 'ss-pop' + (tiles ? ' tiles' : ''); pop.setAttribute('role', 'listbox'); pop.id = 'ss' + (++uid);
      var html = '';
      if (list.length > 9) html += '<div class="ss-q"><input type="text" placeholder="Search…" aria-label="Search options" autocomplete="off" spellcheck="false"></div>';
      html += '<div class="ss-l">' + list.map(function (o, i) { return '<button type="button" role="option" class="ss-o' + (o.selected ? ' on' : '') + '" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + ' aria-selected="' + o.selected + '"><span>' + txt(o).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span>' + CHECK + '</button>'; }).join('') + '</div><p class="ss-none" hidden>Nothing matches.</p>';
      pop.innerHTML = html; d.body.appendChild(pop);
      var s = openS = { btn: btn, pop: pop, tiles: tiles }, items = [].slice.call(pop.querySelectorAll('.ss-o')), q = pop.querySelector('.ss-q input'), none = pop.querySelector('.ss-none'), cur = Math.max(0, items.findIndex(function (b) { return b.classList.contains('on'); }));
      btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open'); place();
      d.addEventListener('mousedown', outside, true); addEventListener('resize', place); addEventListener('scroll', place, true);
      function vis() { return items.filter(function (b) { return !b.hidden && !b.disabled; }); }
      function focusItem(b) { items.forEach(function (x) { x.classList.remove('hot'); }); if (b) { b.classList.add('hot'); b.scrollIntoView({ block: 'nearest' }); } }
      function choose(b) { var o = list[+b.getAttribute('data-i')]; if (!o) return; sel.value = o.value; if (sel.selectedIndex < 0 || sel.options[sel.selectedIndex] !== o) o.selected = true; paint(); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); close(true); }
      pop.addEventListener('click', function (e) { var b = e.target.closest('.ss-o'); if (b) choose(b); });
      pop.addEventListener('mousemove', function (e) { var b = e.target.closest('.ss-o'); if (b && !b.classList.contains('hot')) focusItem(b); });
      var start = items[cur]; focusItem(start); if (start) start.scrollIntoView({ block: 'center' });
      if (q) { q.focus(); q.addEventListener('input', function () { var t = q.value.trim().toLowerCase(), n = 0; items.forEach(function (b, i) { var m = !t || labels[i].toLowerCase().indexOf(t) > -1; b.hidden = !m; if (m) n++; }); none.hidden = n > 0; focusItem(vis()[0]); }); }
      var typed = '', tt;
      pop.addEventListener('keydown', key); btn.addEventListener('keydown', key);
      function key(e) {
        if (!openS || openS !== s) return; var v = vis(), i = v.findIndex(function (b) { return b.classList.contains('hot'); });
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && tiles)) { e.preventDefault(); focusItem(v[Math.min(v.length - 1, i + 1)]); }
        else if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && tiles)) { e.preventDefault(); focusItem(v[Math.max(0, i - 1)]); }
        else if (e.key === 'Home') { e.preventDefault(); focusItem(v[0]); } else if (e.key === 'End') { e.preventDefault(); focusItem(v[v.length - 1]); }
        else if (e.key === 'Enter') { e.preventDefault(); if (v[i]) choose(v[i]); }
        else if (e.key === 'Tab') close(false);
        else if (!q && e.key.length === 1 && /\S/.test(e.key)) { typed += e.key.toLowerCase(); clearTimeout(tt); tt = setTimeout(function () { typed = ''; }, 600); var m = v.find(function (b) { return labels[items.indexOf(b)].toLowerCase().indexOf(typed) === 0; }); if (m) focusItem(m); }
      }
    }
    btn.addEventListener('click', openIt);
    btn.addEventListener('keydown', function (e) { if (!openS && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openIt(); } });
    if (sel.id) d.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('label[for="' + sel.id + '"]'); if (l) { e.preventDefault(); btn.focus(); openIt(); } });
  }
  function run() { [].forEach.call(d.querySelectorAll('select'), enhance); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run); else run();
  window.QHSelect = { refresh: run };
})();
