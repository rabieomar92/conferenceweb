/* Institution autocomplete: keeps names consistent by choosing from a canonical list. */
(function () {
  var input = document.getElementById('organisation'); if (!input) return;
  var list = document.getElementById('orgList'), custom = document.getElementById('org_custom'),
      country = document.getElementById('country'), hint = document.getElementById('orgHint'), js = document.getElementById('js');
  js.value = '1';
  var data = null, loading = null, active = -1, shown = [];
  var norm = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  var initials = function (s) { return s.split(' ').filter(function (w) { return w.length > 2 && !/^(of|and|the|for|dan)$/.test(w); }).map(function (w) { return w[0]; }).join(''); };

  function load() {
    if (data) return Promise.resolve();
    return loading || (loading = fetch(input.getAttribute('data-src') || (document.querySelector('link[rel=stylesheet][href*="site.css"]').getAttribute('href').replace(/site\.css.*$/, 'institutions.json')))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        data = d.items.map(function (it, i) { var n = norm(it[0]); return { name: it[0], n: n, ini: initials(n), c: it[1] >= 0 ? d.countries[it[1]] : '', i: i }; });
        data.countries = d.countries;
      }).catch(function () { loading = null; }));
  }
  function search(q) {
    var nq = norm(q); if (nq.length < 1 || !data) return [];
    var out = [], pad = ' ' + nq, compact = nq.replace(/ /g, ''), toks = nq.split(' ');
    for (var k = 0; k < data.length; k++) {
      var it = data[k], s = -1;
      if (nq.indexOf(' ') < 0 && compact.length >= 2 && it.ini === compact) s = -1 + 0.5;       // exact initials: "usm" → Universiti Sains Malaysia
      else if (it.n.indexOf(nq) === 0) s = 0;
      else if (nq.indexOf(' ') < 0 && compact.length >= 2 && it.ini.indexOf(compact) === 0) s = 1;
      else if ((' ' + it.n).indexOf(pad) >= 0) s = 2;
      else if (toks.length > 1 && toks.every(function (t) { return (' ' + it.n).indexOf(' ' + t) >= 0; })) s = 2.5;   // "univ malaya"
      else if (nq.length >= 3 && it.n.indexOf(nq) >= 0) s = 3;
      if (s >= 0 || s === -0.5) out.push([s, it.i, it]);
      if (out.length > 4000) break;
    }
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });   // curated entries come first in the file
    return out.slice(0, 8).map(function (x) { return x[2]; });
  }
  function exact(q) { var nq = norm(q); if (!data) return null; for (var k = 0; k < data.length; k++) if (data[k].n === nq) return data[k]; return null; }
  function setCountry(c) { if (!c || !country) return; for (var i = 0; i < country.options.length; i++) if (country.options[i].value === c) { country.value = c; return; } }

  function render(items, q) {
    shown = items.map(function (it) { return { it: it }; });
    var typed = q.replace(/\s+/g, ' ').trim();
    if (typed.length >= 3 && !exact(typed)) shown.push({ custom: typed });
    list.innerHTML = '';
    shown.forEach(function (s, idx) {
      var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'org-' + idx;
      if (s.custom) { li.className = 'cust'; li.innerHTML = '<b>My institution isn’t listed</b><small></small>'; li.querySelector('small').textContent = 'Use “' + s.custom + '”'; }
      else { li.innerHTML = '<span></span><small></small>'; li.firstChild.textContent = s.it.name; li.lastChild.textContent = s.it.c; }
      li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(idx); });
      list.appendChild(li);
    });
    active = shown.length && !shown[0].custom ? 0 : -1; mark();
    list.hidden = !shown.length; input.setAttribute('aria-expanded', String(!!shown.length));
  }
  function mark() {
    Array.prototype.forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', String(i === active)); li.classList.toggle('on', i === active); });
    if (active >= 0) input.setAttribute('aria-activedescendant', 'org-' + active); else input.removeAttribute('aria-activedescendant');
    if (active >= 0 && list.children[active]) list.children[active].scrollIntoView({ block: 'nearest' });
  }
  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function choose(idx) {
    var s = shown[idx]; if (!s) return;
    if (s.custom) { input.value = s.custom; custom.value = '1'; hint.textContent = 'Saved as typed. Please check the spelling.'; hint.classList.remove('bad'); }
    else { input.value = s.it.name; custom.value = '0'; setCountry(s.it.c); hint.textContent = '✓ Selected from the list.'; hint.classList.remove('bad'); }
    close();
  }
  input.addEventListener('focus', function () { load(); });
  input.addEventListener('input', function () {
    custom.value = '0';
    load().then(function () { render(search(input.value), input.value); });
  });
  input.addEventListener('keydown', function (e) {
    if (list.hidden && e.key === 'ArrowDown') { load().then(function () { render(search(input.value), input.value); }); return; }
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % shown.length; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; mark(); }
    else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(active); } }
    else if (e.key === 'Escape') { close(); }
  });
  input.addEventListener('blur', function () {
    close();
    var t = input.value.replace(/\s+/g, ' ').trim(); if (!t) return;
    load().then(function () {
      var m = exact(t);
      if (m) { input.value = m.name; custom.value = '0'; if (!country.value) setCountry(m.c); hint.textContent = '✓ Selected from the list.'; hint.classList.remove('bad'); }
      else if (custom.value !== '1') { hint.textContent = 'Please choose your institution from the list, or select “My institution isn’t listed”.'; hint.classList.add('bad'); }
    });
  });
  if (input.value) load();
})();
