/* Speaker portal + admin speaker editor: character counters, unsaved-changes guard, portrait upload (auto-cropped to 4:5). */
(function () {
  var d = document;
  // counters
  d.querySelectorAll('form textarea').forEach(function (t) {
    var out = d.querySelector('.cnt[data-for="' + t.id + '"]'), max = +t.getAttribute('data-count') || t.maxLength;
    function upd() { var n = t.value.length, w = t.value.trim() ? t.value.trim().split(/\s+/).length : 0; if (out) { out.textContent = w + ' words · ' + n.toLocaleString() + ' / ' + max.toLocaleString(); out.classList.toggle('bad', n > max * 0.95); } }
    t.addEventListener('input', upd); upd();
    function grow() { if (!t.offsetParent) return; t.style.height = 'auto'; t.style.height = Math.min(900, t.scrollHeight + 2) + 'px'; }
    t.addEventListener('input', grow); d.addEventListener('tabshow', grow); grow();
  });
  // unsaved changes
  var f = d.querySelector('form[data-guard]'), dirty = false, st = f && f.querySelector('.savebar .state');
  if (f) {
    f.addEventListener('input', function () { if (!dirty) { dirty = true; if (st) { st.textContent = 'Unsaved changes'; st.classList.add('dirty'); } } });
    f.addEventListener('submit', function () { dirty = false; });
    addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  // custom time picker (replaces the browser's own, which is awkward)
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  d.querySelectorAll('input[type=time]').forEach(function (inp) {
    var wrap = d.createElement('div'); wrap.className = 'tp'; inp.parentNode.insertBefore(wrap, inp); inp.type = 'hidden'; wrap.appendChild(inp);
    var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'tp-b'; btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    var pop = d.createElement('div'); pop.className = 'tp-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a time');
    pop.innerHTML = '<div class="tp-cols"><div class="tp-col"><span>Hour</span><div class="tp-list" data-h></div></div><div class="tp-col"><span>Minute</span><div class="tp-list" data-m></div></div></div><div class="tp-foot"><button type="button" data-clear>Clear</button><button type="button" data-done>Done</button></div>';
    wrap.appendChild(btn); wrap.appendChild(pop);
    var H = pop.querySelector('[data-h]'), M = pop.querySelector('[data-m]'), hs = [], ms = [], i;
    for (i = 0; i < 24; i++) { var hb = d.createElement('button'); hb.type = 'button'; hb.textContent = pad(i); hb.dataset.v = pad(i); H.appendChild(hb); hs.push(hb); }
    for (i = 0; i < 60; i += 5) { var mb = d.createElement('button'); mb.type = 'button'; mb.textContent = pad(i); mb.dataset.v = pad(i); M.appendChild(mb); ms.push(mb); }
    function parts() { var m = /^(\d\d):(\d\d)$/.exec(inp.value); return m ? [m[1], m[2]] : ['', '']; }
    function paint() { var p = parts(); btn.textContent = inp.value || '--:--'; btn.classList.toggle('ph', !inp.value);
      hs.forEach(function (b) { b.classList.toggle('on', b.dataset.v === p[0]); }); ms.forEach(function (b) { b.classList.toggle('on', b.dataset.v === p[1]); }); }
    function set(v) { if (inp.value === v) return; inp.value = v; paint(); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
    function open() { d.querySelectorAll('.tp-pop').forEach(function (x) { x.hidden = true; }); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); var on = H.querySelector('.on') || H.children[9]; if (on) H.scrollTop = on.offsetTop - 70; }
    function shut() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function () { pop.hidden ? open() : shut(); });
    H.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) set(b.dataset.v + ':' + (parts()[1] || '00')); });
    M.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { set((parts()[0] || '09') + ':' + b.dataset.v); shut(); btn.focus(); } });
    pop.querySelector('[data-clear]').addEventListener('click', function () { set(''); shut(); });
    pop.querySelector('[data-done]').addEventListener('click', function () { shut(); btn.focus(); });
    d.addEventListener('click', function (e) { if (!wrap.contains(e.target)) shut(); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') { shut(); btn.focus(); e.stopPropagation(); } });
    inp.addEventListener('tp:refresh', paint); paint();
  });
  // a start time with no end time suggests a 45-minute talk
  (function () {
    var a = d.getElementById('slot_start'), z = d.getElementById('slot_end'); if (!a || !z) return;
    a.addEventListener('change', function () { var m = /^(\d\d):(\d\d)$/.exec(a.value); if (!m || z.value) return; var t = +m[1] * 60 + +m[2] + 45; if (t >= 1440) return; z.value = pad(Math.floor(t / 60)) + ':' + pad(t % 60); z.dispatchEvent(new Event('tp:refresh')); });
  })();
  // schedule confirmation
  var sf = d.querySelector('form[data-orig]'), md = d.getElementById('schedModal');
  if (sf && md) {
    var lab = {}; try { lab = JSON.parse(sf.getAttribute('data-labels') || '{}'); } catch (_) {}
    var q = function (n) { return sf.elements[n]; }, key = function () { return [q('slot_date').value, q('slot_start').value, q('slot_end').value].join('|'); };
    var orig = sf.getAttribute('data-orig'), mail = sf.getAttribute('data-email'), okBtn = d.getElementById('mdlOk'), last = null;
    function span(a) { return a[1] ? (a[2] ? a[1] + ' – ' + a[2] : a[1]) : ''; }
    function close() { md.hidden = true; sf.dispatchEvent(new Event('input')); if (last) last.focus(); }
    sf.addEventListener('submit', function (e) {
      if (key() === orig || q('sched_ok').value === '1') return;
      e.preventDefault(); last = d.activeElement;
      var n = key().split('|'), o = orig.split('|'), clear = !n[0] && !n[1] && !n[2];
      if (!clear && (!n[0] || !n[1])) { alert((window.T||{})['Please choose both a date and a start time, or leave the schedule empty.']||'Please choose both a date and a start time, or leave the schedule empty.'); return; }
      md.querySelector('#mdlT').textContent = clear ? 'Remove the schedule?' : (o[0] ? 'Change this talk time?' : 'Set this talk time?');
      md.querySelector('.mdl-who').textContent = sf.getAttribute('data-spk') + (clear ? ' will no longer have a date and time on the website.' : ' will be shown on the website with this schedule.');
      md.querySelector('[data-d]').textContent = clear ? '—' : (lab[n[0]] || n[0]); md.querySelector('[data-t]').textContent = clear ? '—' : span(n);
      md.querySelector('.mdl-was').textContent = o[0] ? 'Currently: ' + (lab[o[0]] || o[0]) + ', ' + span(o) : '';
      var ml = md.querySelector('.mdl-mail'); ml.classList.toggle('off', clear || !mail); md.querySelector('[data-to]').textContent = mail ? '(' + mail + ')' : '';
      d.getElementById('mdlNotify').checked = !!mail; md.hidden = false; okBtn.focus();
    });
    md.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !md.hidden) close(); });
    okBtn.addEventListener('click', function () {
      q('sched_ok').value = '1'; q('notify').value = d.getElementById('mdlNotify').checked && mail && !md.querySelector('.mdl-mail').classList.contains('off') ? '1' : '';
      md.hidden = true; sf.submit();
    });
  }
  // confirm dangerous forms
  d.querySelectorAll('form[data-confirm]').forEach(function (x) { x.addEventListener('submit', function (e) { if (!confirm(x.getAttribute('data-confirm'))) e.preventDefault(); }); });
  // photo
  var box = d.querySelector('.pbox'); if (!box) return;
  var ep = box.getAttribute('data-endpoint'), csrf = box.getAttribute('data-csrf'), msg = box.querySelector('.pmsg'), inp = box.querySelector('input[type=file]');
  function say(t, bad) { msg.textContent = t; msg.className = 'pmsg' + (bad ? ' bad' : ''); }
  var ph = box.querySelector('.ph'), lbl = box.querySelector('label.b2'), acts = box.querySelector('.pact');
  function show(url) {
    var name = (d.getElementById('full_name') || {}).value || '';
    ph.innerHTML = url ? '<img alt="">' : '<div class="mono"></div>';
    if (url) ph.firstChild.src = url; else ph.firstChild.textContent = name.split(/\s+/).filter(function (w) { return !/^(prof|dr|assoc|associate|ir|ts|mr|mrs|ms)\.?$/i.test(w); }).map(function (w) { return w[0]; }).filter(Boolean).slice(0, 1).concat(name.trim().split(/\s+/).slice(-1).map(function (w) { return w[0]; })).join('');
    lbl.firstChild.nodeValue = url ? 'Replace photo' : 'Upload photo';
    var rm = acts.querySelector('[data-remove]');
    if (url && !rm) { rm = d.createElement('button'); rm.type = 'button'; rm.className = 'b2 lnk'; rm.setAttribute('data-remove', ''); rm.textContent = 'Remove'; acts.appendChild(rm); rm.addEventListener('click', removeIt); }
    if (!url && rm) rm.remove();
  }
  function ring(p) {
    var r = d.querySelector('.chk .ring'); if (!r || p == null) return; r.style.setProperty('--p', p); r.querySelector('b').textContent = p + '%';
    var li = d.querySelector('.chk li'); if (li) li.classList.toggle('ok', !!ph.querySelector('img'));
  }
  function removeIt() { if (confirm((window.T||{})['Remove the photo?']||'Remove the photo?')) { say('Removing…'); post({ remove: true }); } }
  function post(body) {
    body.csrf = csrf;
    return fetch(ep, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) return say(j.error || 'Upload failed.', true); show(j.url); ring(j.pct); say(j.url ? 'Photo saved. It is live on your page.' : 'Photo removed.'); })
      .catch(function () { say('Upload failed. Please check your connection and try again.', true); });
  }
  inp.addEventListener('change', function () {
    var file = inp.files && inp.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) return say('Please choose an image file (JPEG or PNG).', true);
    if (file.size > 25 * 1024 * 1024) return say('That image is very large; please choose one under 25 MB.', true);
    say('Preparing your photo…');
    var img = new Image(), u = URL.createObjectURL(file);
    img.onload = function () {
      var W = 960, H = 1200, iw = img.naturalWidth, ih = img.naturalHeight, r = W / H, sw, sh, sx, sy;
      if (iw / ih > r) { sh = ih; sw = ih * r; sx = (iw - sw) / 2; sy = 0; } else { sw = iw; sh = iw / r; sx = 0; sy = (ih - sh) * 0.22; }  // keep the head: crop more from the bottom
      var c = d.createElement('canvas');
      var ow = Math.min(W, Math.round(sw)), oh = Math.round(ow / r); c.width = ow; c.height = oh;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, ow, oh); g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh); URL.revokeObjectURL(u);
      if (ow < 400) say('This photo is quite small; a larger one will look sharper. Uploading…'); else say('Uploading…');
      post({ dataUrl: c.toDataURL('image/jpeg', 0.88) }); inp.value = '';
    };
    img.onerror = function () { say('This image could not be read. Please try a JPEG or PNG.', true); };
    img.src = u;
  });
  var rm0 = box.querySelector('[data-remove]'); if (rm0) rm0.addEventListener('click', removeIt);
})();

// add-speaker: two steps (details, then review + explicit confirmation)
(function () {
  var d = document, md = d.getElementById('addModal'), open = d.getElementById('addOpen'); if (!md || !open) return;
  var f = md.querySelector('form'), p1 = f.querySelector('[data-p="1"]'), p2 = f.querySelector('[data-p="2"]'), err = md.querySelector('.mdl-err'), warn = md.querySelector('.mdl-warn'), ok = d.getElementById('addOk'), go = d.getElementById('addGo');
  var names = JSON.parse(md.getAttribute('data-names') || '[]'), emails = JSON.parse(md.getAttribute('data-emails') || '[]');
  function step(n) { p1.hidden = n !== 1; p2.hidden = n !== 2; f.querySelectorAll('.add-steps span').forEach(function (x) { var k = +x.getAttribute('data-s'); x.className = k === n ? 'on' : (k < n ? 'ck' : ''); }); }
  function show() { f.reset(); f.confirmed.value = ''; ok.checked = false; go.disabled = true; err.hidden = true; step(1); md.hidden = false; f.full_name.focus(); }
  function hide() { md.hidden = true; open.focus(); }
  open.addEventListener('click', show);
  md.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) hide(); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !md.hidden) hide(); });
  function bad(t) { err.textContent = t; err.hidden = false; }
  d.getElementById('addNext').addEventListener('click', function () {
    var n = f.full_name.value.trim().replace(/\s+/g, ' '), em = f.email.value.trim().toLowerCase(), em2 = f.email2.value.trim().toLowerCase();
    if (n.length < 3) return bad('Please enter the speaker\u2019s full name, with title.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return bad('Please enter a valid email address. The invitation is sent there.');
    if (em !== em2) return bad('The two email addresses are not the same. Please check them.');
    if (emails.indexOf(em) > -1) return bad('A speaker with this email address already exists.');
    err.hidden = true; f.full_name.value = n; f.email.value = em;
    md.querySelector('[data-r=n]').textContent = n; md.querySelector('[data-r=e]').textContent = em; md.querySelector('[data-r=r]').textContent = f.role.value;
    var dup = names.indexOf(n.toLowerCase()) > -1; warn.hidden = !dup; warn.textContent = dup ? 'A speaker called \u201c' + n + '\u201d is already in the list. Please make sure this is a different person.' : '';
    ok.checked = false; go.disabled = true; step(2);
  });
  d.getElementById('addBack').addEventListener('click', function () { step(1); });
  ok.addEventListener('change', function () { go.disabled = !ok.checked; });
  f.addEventListener('submit', function (e) { if (!ok.checked) { e.preventDefault(); return; } f.confirmed.value = '1'; f.dup_ok.value = warn.hidden ? '' : '1'; go.disabled = true; go.textContent = 'Adding\u2026'; });
  f.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); if (!p1.hidden) d.getElementById('addNext').click(); } });
})();
