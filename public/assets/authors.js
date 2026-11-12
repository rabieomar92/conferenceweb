/* Authors & affiliations editor: a list of authors, each added or edited in a dialog.
   Markup:  <div class="au" data-au="authors"></div>  plus  <input type="hidden" name="authors" id="authors" value='{"a":[…],"f":[…]}'>
   Affiliations are numbered in order of first use, as in a paper. */
(function () {
  'use strict';
  var T = function (s) { return (window.T && window.T[s]) || s; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICON = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };
  document.querySelectorAll('[data-au]').forEach(function (box) {
    var input = document.getElementById(box.getAttribute('data-au'));
    var me = { n: box.getAttribute('data-me') || '', e: box.getAttribute('data-me-email') || '', aff: box.getAttribute('data-me-aff') || '' };
    var locked = box.hasAttribute('data-locked');
    var S; try { S = JSON.parse(input.value || '{}'); } catch (e) { S = {}; }
    S.a = Array.isArray(S.a) ? S.a : []; S.f = Array.isArray(S.f) ? S.f : [];
    if (!S.a.length && me.n) { if (me.aff) S.f.push(me.aff); S.a.push({ n: me.n, e: me.e, f: me.aff ? [1] : [], p: 1, c: 1, me: 1, ma: me.aff }); }
    // numbering: affiliations in order of first use
    function order() {
      var seen = []; S.a.forEach(function (x) { (x.f || []).forEach(function (k) { if (seen.indexOf(k) < 0) seen.push(k); }); });
      var nf = seen.map(function (k) { return S.f[k - 1]; });
      S.f.forEach(function (t, i) { if (seen.indexOf(i + 1) < 0 && t) nf.push(t); });           // keep unused ones at the end (still choosable)
      S.a.forEach(function (x) { x.f = (x.f || []).map(function (k) { return nf.indexOf(S.f[k - 1]) + 1; }).filter(function (k) { return k > 0; }).sort(function (p, q) { return p - q; }); });
      S.f = nf;
    }
    function save() { order(); var used = {}; S.a.forEach(function (x) { x.f.forEach(function (k) { used[k] = 1; }); });
      input.value = JSON.stringify({ a: S.a, f: S.f.filter(function (t, i) { return used[i + 1]; }).length === S.f.length ? S.f : S.f }); input.dispatchEvent(new Event('input', { bubbles: true })); }
    function render() {
      order();
      var used = {}; S.a.forEach(function (x) { x.f.forEach(function (k) { used[k] = 1; }); });
      var h = '<ol class="au-list">' + S.a.map(function (x, i) {
        return '<li class="au-row"><div class="au-who"><b>' + esc(x.n) + '</b><sup>' + esc(x.f.join(',') + (x.c ? '*' : '')) + '</sup>' +
          (x.me ? '<span class="au-tag me">' + T('You') + '</span>' : '') + (x.p ? '<span class="au-tag">' + T('Presenting') + '</span>' : '') + (x.c ? '<span class="au-tag c">' + T('Corresponding') + '</span>' : '') +
          '<small>' + (x.f.length ? x.f.map(function (k) { return esc(S.f[k - 1]); }).join(' · ') : '<i class="au-miss">' + T('No affiliation chosen') + '</i>') + (x.e ? ' · ' + esc(x.e) : '') + '</small></div>' +
          (locked ? '' : '<div class="au-act"><button type="button" class="au-ib" data-ed="' + i + '" aria-label="' + T('Edit') + ' ' + esc(x.n) + '" title="' + T('Edit') + '">' + ICON.edit + '</button>' +
          '<button type="button" class="au-ib" data-up="' + i + '" aria-label="' + T('Move up') + '" title="' + T('Move up') + '"' + (i ? '' : ' disabled') + '>' + ICON.up + '</button>' +
          '<button type="button" class="au-ib" data-dn="' + i + '" aria-label="' + T('Move down') + '" title="' + T('Move down') + '"' + (i < S.a.length - 1 ? '' : ' disabled') + '>' + ICON.down + '</button>' +
          '<button type="button" class="au-ib del" data-rm="' + i + '" aria-label="' + T('Remove') + ' ' + esc(x.n) + '" title="' + T('Remove') + '">' + ICON.del + '</button></div>') + '</li>';
      }).join('') + '</ol>';
      if (!S.a.length) h = '<p class="au-empty">' + T('No authors yet.') + '</p>';
      h += S.f.some(function (t, i) { return used[i + 1]; }) ? '<ol class="au-affs">' + S.f.map(function (t, i) { return used[i + 1] ? '<li><sup>' + (i + 1) + '</sup> ' + esc(t) + '</li>' : ''; }).join('') + '</ol>' : '';
      if (!locked) h += '<button type="button" class="b2 au-add">' + ICON.plus + '<span>' + T('Add an author') + '</span></button>';
      box.innerHTML = h;
    }
    // ── dialog ──
    var dlg = document.createElement('dialog'); dlg.className = 'au-dlg'; dlg.setAttribute('aria-labelledby', 'auT' + input.id);
    dlg.innerHTML = '<form method="dialog" class="au-f" novalidate><div class="au-hd"><h3 id="auT' + input.id + '"></h3><button type="button" class="au-x" aria-label="' + T('Close') + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button></div>' +
      '<div class="au-bd"><label class="l" for="auN' + input.id + '">' + T('Full name') + '</label><input id="auN' + input.id + '" maxlength="120" autocomplete="off" placeholder="' + T('e.g. Nur Aisyah Rahman') + '">' +
      '<label class="l" for="auE' + input.id + '">' + T('Email') + ' <span class="opt">' + T('(needed for the corresponding author)') + '</span></label><input id="auE' + input.id + '" type="email" maxlength="160" autocomplete="off">' +
      '<fieldset class="au-fs"><legend class="l">' + T('Affiliations') + '</legend><div class="au-opts"></div>' +
      '<div class="au-new"><input class="au-ni" maxlength="250" placeholder="' + T('Add a new affiliation, e.g. School of Physics, Universiti Sains Malaysia, Penang, Malaysia') + '" aria-label="' + T('New affiliation') + '"><button type="button" class="b2 au-na">' + T('Add') + '</button></div></fieldset>' +
      '<label class="au-ck"><input type="checkbox" class="au-p"> ' + T('Presenting author (the person who presents at the conference)') + '</label>' +
      '<label class="au-ck"><input type="checkbox" class="au-c"> ' + T('Corresponding author') + '</label><p class="au-err" role="alert" hidden></p></div>' +
      '<div class="au-ft"><button type="button" class="b2 au-cancel">' + T('Cancel') + '</button><button type="submit" class="btn au-ok">' + T('Save author') + '</button></div></form>';
    document.body.appendChild(dlg);
    var nm = dlg.querySelector('#auN' + input.id), em = dlg.querySelector('#auE' + input.id), opts = dlg.querySelector('.au-opts'), ni = dlg.querySelector('.au-ni'), err = dlg.querySelector('.au-err');
    var editing = -1, picks = [];
    function paintOpts() {
      opts.innerHTML = S.f.length ? S.f.map(function (t, i) {
        var mine = editing > -1 && S.a[editing] && S.a[editing].me && S.a[editing].ma === t;
        return '<label class="au-opt"><input type="checkbox" value="' + (i + 1) + '"' + (picks.indexOf(i + 1) > -1 ? ' checked' : '') + '><span>' + esc(t) + (mine ? ' <em class="au-prof">' + T('from your profile') + '</em>' : '') + '</span><button type="button" class="au-ib" data-fe="' + i + '" aria-label="' + T('Edit affiliation') + '" title="' + T('Edit affiliation') + '">' + ICON.edit + '</button></label>';
      }).join('') : '<p class="au-empty">' + T('No affiliations yet — add one below.') + '</p>';
    }
    opts.addEventListener('change', function (e) { var k = +e.target.value; if (!k) return; if (e.target.checked) { if (picks.indexOf(k) < 0) picks.push(k); } else picks = picks.filter(function (x) { return x !== k; }); });
    opts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fe]'); if (!b) return; e.preventDefault();
      var i = +b.getAttribute('data-fe'), lab = b.closest('.au-opt'), span = lab.querySelector('span');
      var inp = document.createElement('input'); inp.value = S.f[i]; inp.maxLength = 250; inp.className = 'au-fi'; span.replaceWith(inp); inp.focus(); b.hidden = true;
      var done = function () { var v = inp.value.replace(/\s+/g, ' ').trim(); if (v) S.f[i] = v; paintOpts(); };
      inp.addEventListener('keydown', function (k) { if (k.key === 'Enter') { k.preventDefault(); done(); } if (k.key === 'Escape') { k.preventDefault(); k.stopPropagation(); paintOpts(); } });
      inp.addEventListener('blur', done);
    });
    function addAff() { var v = ni.value.replace(/\s+/g, ' ').trim(); if (!v) { ni.focus(); return; } var k = S.f.indexOf(v); if (k < 0) { S.f.push(v); k = S.f.length - 1; } if (picks.indexOf(k + 1) < 0) picks.push(k + 1); ni.value = ''; paintOpts(); ni.focus(); }
    dlg.querySelector('.au-na').onclick = addAff;
    ni.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addAff(); } });
    function open(i) {
      editing = i; var x = i > -1 ? S.a[i] : { n: '', e: '', f: S.f.length === 1 ? [1] : [], p: S.a.length ? 0 : 1, c: S.a.length ? 0 : 1 };
      dlg.querySelector('h3').textContent = i > -1 ? T('Edit author') : T('Add an author');
      nm.value = x.n; em.value = x.e || ''; picks = (x.f || []).slice(); dlg.querySelector('.au-p').checked = !!x.p; dlg.querySelector('.au-c').checked = !!x.c; err.hidden = true; ni.value = '';
      paintOpts(); dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); setTimeout(function () { nm.focus(); }, 30);
    }
    function close() { dlg.close ? dlg.close() : dlg.removeAttribute('open'); }
    dlg.querySelector('.au-x').onclick = close; dlg.querySelector('.au-cancel').onclick = close;
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (ni.value.trim()) addAff();
      var x = { n: nm.value.replace(/\s+/g, ' ').trim(), e: em.value.trim().toLowerCase(), f: picks.slice().sort(function (a, b) { return a - b; }), p: dlg.querySelector('.au-p').checked ? 1 : 0, c: dlg.querySelector('.au-c').checked ? 1 : 0 };
      var msg = !x.n ? T('Please enter the author’s name.') : !x.f.length ? T('Please choose or add at least one affiliation.') : x.c && !x.e ? T('Please add an email address for the corresponding author.') : x.e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.e) ? T('That email address does not look right.') : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      if (x.p) S.a.forEach(function (y) { y.p = 0; });
      if (editing > -1) { if (S.a[editing].me) { x.me = 1; x.ma = S.a[editing].ma || ''; } S.a[editing] = x; } else S.a.push(x);
      if (!S.a.some(function (y) { return y.p; })) S.a[0].p = 1;
      save(); render(); close();
      var b = box.querySelector(editing > -1 ? '[data-ed="' + editing + '"]' : '.au-add'); if (b) b.focus();
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('au-add')) return open(-1);
      if (b.hasAttribute('data-ed')) return open(+b.getAttribute('data-ed'));
      var i;
      if (b.hasAttribute('data-up')) { i = +b.getAttribute('data-up'); S.a.splice(i - 1, 0, S.a.splice(i, 1)[0]); }
      else if (b.hasAttribute('data-dn')) { i = +b.getAttribute('data-dn'); S.a.splice(i + 1, 0, S.a.splice(i, 1)[0]); }
      else if (b.hasAttribute('data-rm')) { i = +b.getAttribute('data-rm'); var who = S.a[i]; (window.ui ? ui.confirm(T('Remove this author?') + '\n' + who.n, { danger: true, ok: T('Remove') }) : Promise.resolve(confirm(T('Remove this author?') + '\n' + who.n))).then(function (y) { if (!y) return; var k = S.a.indexOf(who); if (k < 0) return; S.a.splice(k, 1); if (S.a.length && !S.a.some(function (z) { return z.p; })) S.a[0].p = 1; save(); render(); }); return; }
      else return;
      save(); render();
    });
    save(); render();
  });
})();
