/* Programme timetable (admin). Data comes from window.TT: { E: entries, V: venues, days, labels, base, csrf, kinds }.
   Drag a card from the tray onto a venue column, move it, pull its lower edge to change the length, drag it back to unschedule.
   Touch: press and hold a card to pick it up; a tap opens the details. */
(function () {
  'use strict';
  var TT = window.TT; if (!TT) return;
  var E = TT.E, V = TT.V, DAYS = TT.days, B = TT.base;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var mins = function (t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
  var hhmm = function (m) { m = Math.max(0, Math.min(1439, Math.round(m))); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
  var byKey = {}; E.forEach(function (x) { byKey[x.key] = x; });
  var vName = function (id) { var v = V.filter(function (y) { return y.id === +id; })[0]; return v ? v.name : 'General (no room set)'; };
  var isSched = function (x) { return !!(x.date && x.start && DAYS.indexOf(x.date) >= 0); };   // a day that no longer exists counts as not scheduled
  var durText = function (d) { return d < 60 ? d + ' min' : (d % 60 ? Math.floor(d / 60) + ' h ' + (d % 60) + ' min' : (d / 60) + ' h'); };
  var defDur = function (x) { return x.type === 'spk' ? (x.kind === 'plenary' ? 45 : 30) : x.type === 'reg' ? 20 : 30; };
  var durOf = function (x) { return x.end ? Math.max(5, mins(x.end) - mins(x.start)) : defDur(x); };
  var nameOf = function (x) { return x.type === 'item' ? x.title : x.who; };
  var subOf = function (x) { return x.type === 'item' ? x.who : (x.title || 'No title yet'); };
  var cls = function (x) { return x.type === 'spk' ? 'k-spk' : x.type === 'reg' ? 'k-reg' : 'k-' + (x.kind === 'reg' ? 'reg2' : x.kind); };

  var ZOOMS = [1.1, 1.7, 2.4, 3.4], zi = 1;
  try { var z = +localStorage.getItem('tt-zoom'); if (z >= 0 && z < ZOOMS.length && localStorage.getItem('tt-zoom') !== null) zi = z; } catch (e) { /* private mode */ }
  var day = DAYS[0], t0 = 480, t1 = 1080, ppm = ZOOMS[zi], filter = 'all', query = '';
  var grid = $('#ttGrid'), scroll = $('#ttScroll'), tray = $('#ttTray'), list = $('#ttList'), main = $('#ttMain');

  // ── clashes: two things in one room at one time ──
  function clashes() {
    var out = {}, g = {};
    E.forEach(function (x) { if (isSched(x) && x.venue) (g[x.date + '|' + x.venue] = g[x.date + '|' + x.venue] || []).push(x); });
    Object.keys(g).forEach(function (k) { var a = g[k]; for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) {
      var s1 = mins(a[i].start), e1 = s1 + (a[i].end ? durOf(a[i]) : 1), s2 = mins(a[j].start), e2 = s2 + (a[j].end ? durOf(a[j]) : 1);
      if (s1 < e2 && s2 < e1) { out[a[i].key] = a[j]; out[a[j].key] = a[i]; } } });
    return out;
  }

  var GRIP = '<svg class="tt-grip" viewBox="0 0 10 16" aria-hidden="true"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>';
  function card(x, c, inGrid) {
    var tags = '';
    if (inGrid) { if (c) tags += '<span class="tt-pill bad">Clash</span>'; else if (!x.ok) tags += '<span class="tt-pill">Draft</span>'; }
    else { tags += '<span class="tt-pill">' + esc(x.label) + '</span><span class="tt-pill">' + durText(defDur(x)) + '</span>'; if (x.type === 'reg' && !x.acc) tags += '<span class="tt-pill warn">Abstract not accepted yet</span>'; }
    var t = inGrid ? '<span class="tt-t">' + esc(x.start) + (x.end ? '–' + esc(x.end) : '') + (x.code ? ' · ' + esc(x.code) : '') + '</span>' : '';
    var sub = subOf(x);
    return '<div class="tt-card ' + cls(x) + (inGrid && !x.ok ? ' draft' : '') + (c ? ' clash' : '') + '" data-key="' + esc(x.key) + '" tabindex="0" role="button" title="' + esc(nameOf(x) + (sub ? ' — ' + sub : '') + (c ? ' (same room and time as ' + nameOf(c) + ')' : '')) + '">' +
      (inGrid ? '' : GRIP) + t + '<b>' + esc(nameOf(x)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + (tags ? '<span class="tt-tags">' + tags + '</span>' : '') + (inGrid ? '<i class="tt-rs" aria-hidden="true"></i>' : '') + '</div>';
  }

  // ── tray ──
  function renderTray() {
    var un = E.filter(function (x) { return !isSched(x); });
    var q = query.trim().toLowerCase();
    var xs = un.filter(function (x) { return (filter === 'all' || filter === x.type) && (!q || (x.who + ' ' + x.title + ' ' + (x.org || '') + ' ' + x.label).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { var o = { spk: 0, reg: 1, item: 2 }; return o[a.type] - o[b.type] || (b.acc || 0) - (a.acc || 0) || nameOf(a).localeCompare(nameOf(b)); });
    list.innerHTML = xs.map(function (x) { return card(x, null, false); }).join('') || '<p class="tt-empty">' + (un.length ? 'No one matches.' : 'Everything has a slot.') + '</p>';
    $('#ttUnN').textContent = un.length; var sw = $('#ttSwN'); if (sw) sw.textContent = un.length;
  }

  // ── grid ──
  function range() {
    var a = 480, b = 1080;
    E.forEach(function (x) { if (x.date === day && x.start) { a = Math.min(a, mins(x.start)); b = Math.max(b, mins(x.start) + durOf(x)); } });
    t0 = Math.floor(a / 60) * 60; t1 = Math.min(1440, Math.ceil(b / 60) * 60);
  }
  var PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
  function renderGrid() {
    range(); var cl = clashes();
    var cols = [{ id: 0, name: 'General', details: 'No room set' }].concat(V);
    var H = Math.round((t1 - t0) * ppm);
    grid.style.setProperty('--n', cols.length); grid.style.setProperty('--ppm', ppm);
    var todays = E.filter(function (x) { return x.date === day && x.start; });
    var focusKey = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('tt-card') && document.activeElement.closest('.tt-col') ? document.activeElement.getAttribute('data-key') : '';
    var head = '<div class="tt-head"><div class="tt-corner"></div>' + cols.map(function (c) {
      var n = todays.filter(function (x) { return (+x.venue || 0) === c.id; }).length;
      return '<div class="tt-ch" data-hv="' + c.id + '"><div><b>' + esc(c.name) + '</b><small>' + (c.details ? esc(c.details) + ' · ' : '') + n + (n === 1 ? ' entry' : ' entries') + '</small></div>' + (c.id ? '<button type="button" class="tt-ic" data-venue="' + c.id + '" aria-label="Edit venue ' + esc(c.name) + '" title="Edit venue">' + PEN + '</button>' : '') + '</div>'; }).join('') +
      '<button type="button" class="tt-addv" data-venue="0" title="Add a venue" aria-label="Add a venue">+</button></div>';
    var times = ''; for (var m = t0; m <= t1; m += 60) times += '<span style="top:' + Math.round((m - t0) * ppm) + 'px">' + hhmm(m % 1440 === 0 && m ? 1439 : m).replace('23:59', '24:00') + '</span>';
    var body = '<div class="tt-body" style="height:' + H + 'px"><div class="tt-times">' + times + '</div>' + cols.map(function (c) {
      var xs = todays.filter(function (x) { return (+x.venue || 0) === c.id; }).sort(function (a, b) { return mins(a.start) - mins(b.start) || durOf(b) - durOf(a); });
      // overlapping cards share the column side by side
      var lanes = [], grp = [], gEnd = -1, out = '';
      var flush = function () { grp.forEach(function (g) { var w = 100 / lanes.length; out += place(g.x, g.lane * w, w, cl[g.x.key]); }); grp = []; lanes = []; };
      xs.forEach(function (x) { var s = mins(x.start), en = s + Math.max(durOf(x), 14 / ppm);
        if (s >= gEnd) flush();
        var l = 0; while (l < lanes.length && lanes[l] > s) l++; lanes[l] = en; grp.push({ x: x, lane: l }); gEnd = Math.max(gEnd, en); });
      flush();
      return '<div class="tt-col' + (c.id ? '' : ' g') + '" data-v="' + c.id + '">' + out + '</div>'; }).join('') + '<div class="tt-pad"></div></div>';
    grid.innerHTML = head + body + (todays.length ? '' : '<p class="tt-blank">Nothing on this day yet.<br>Drag a card from <b>To schedule</b> onto a room and time, or click an empty slot to add an event.</p>');
    if (popKey) { var pc = grid.querySelector('[data-key="' + popKey + '"]'); if (pc) pc.classList.add('pop'); popKey = ''; }
    if (focusKey) { var fc = grid.querySelector('[data-key="' + focusKey + '"]'); if (fc) fc.focus({ preventScroll: true }); }
    renderBar(cl);
  }
  var popKey = '';
  function place(x, left, w, c) {
    var top = Math.round((mins(x.start) - t0) * ppm), h = Math.max(18, Math.round(durOf(x) * ppm) - 2);
    return card(x, c, true).replace('class="tt-card', 'style="top:' + (top + 1) + 'px;height:' + h + 'px;left:calc(' + left + '% + 2px);width:calc(' + w + '% - 4px)" class="tt-card' + (h < 30 ? ' xs' : h < 50 ? ' sm' : '') + (w < 60 ? ' nar' : ''));
  }

  function renderBar(cl) {
    var todays = E.filter(function (x) { return x.date === day && x.start; }), on = todays.filter(function (x) { return x.ok; }).length, nc = Object.keys(cl).filter(function (k) { return byKey[k].date === day; }).length;
    var s = '';
    if (!todays.length) s = '<span class="tt-pill">Nothing on this day yet</span>';
    else { s += '<span class="tt-pill' + (on === todays.length ? ' good' : '') + '">' + on + ' of ' + todays.length + ' on the website</span>';
      if (todays.length - on) s += '<span class="tt-pill warn">' + (todays.length - on) + ' draft' + (todays.length - on === 1 ? '' : 's') + '</span>';
      if (nc) s += '<span class="tt-pill bad">' + nc + ' in a room clash</span>'; }
    $('#ttStat').innerHTML = s;
    var f = $('#ttPub'); f.elements.namedItem('day').value = day;
    $('#ttPubOn').hidden = !(todays.length && on < todays.length); $('#ttPubOff').hidden = !on;
    [].forEach.call(document.querySelectorAll('.tt-tab'), function (b) { var d = b.getAttribute('data-day'), on2 = d === day; b.setAttribute('aria-selected', on2);
      b.querySelector('span').textContent = b.getAttribute('data-short') + ' · ' + E.filter(function (x) { return x.date === d && x.start; }).length; });
    $('#ttZin').disabled = zi >= ZOOMS.length - 1; $('#ttZout').disabled = zi <= 0;
  }
  function render() { renderTray(); renderGrid(); }

  // ── saving a move ──
  var toastEl = null, toastT = 0;
  function toast(msg, undo, err) {
    if (toastEl) toastEl.remove(); clearTimeout(toastT);
    toastEl = document.createElement('div'); toastEl.className = 'tt-toast' + (err ? ' err' : ''); toastEl.setAttribute('role', 'status');
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button">Undo</button>' : '');
    if (undo) toastEl.querySelector('button').onclick = function () { toastEl.remove(); undo(); };
    $('.tt-page').appendChild(toastEl); toastT = setTimeout(function () { if (toastEl) toastEl.remove(); }, err ? 9000 : 7000);
  }
  var queue = Promise.resolve(), busy = 0;
  function saving(d, failed) { busy = Math.max(0, busy + d); var el = $('#ttSave'); if (!el) return;
    el.className = 'tt-save ' + (busy ? 'busy' : failed ? 'bad' : 'ok'); el.textContent = busy ? 'Saving…' : failed ? 'Not saved' : 'All changes saved'; }
  window.addEventListener('beforeunload', function (ev) { if (busy) { ev.preventDefault(); ev.returnValue = ''; } });
  var snapOf = function (x) { return { date: x.date, start: x.start, end: x.end, venue: x.venue, ok: x.ok }; };
  function commit(x, n, canUndo) {
    var prev = snapOf(x);
    if (prev.date === n.date && prev.start === n.start && prev.end === n.end && (+prev.venue || 0) === (+n.venue || 0)) return;
    x.date = n.date; x.start = n.start; x.end = n.end; x.venue = +n.venue || 0; if (!isSched(x)) x.ok = 0; else if (n.ok !== undefined) x.ok = n.ok;
    var mine = snapOf(x), body = JSON.stringify({ key: x.key, slot_date: x.date, slot_start: x.start, slot_end: x.end, slot_venue: x.venue || '', slot_ok: x.ok ? '1' : '0' });
    popKey = x.key; render(); saving(1);
    // one save at a time, in order: a slow answer can never overwrite a newer move
    queue = queue.then(function () { return fetch(B + '/admin/programme/move', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': TT.csrf }, credentials: 'same-origin', body: body }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: r.status === 401 || r.redirected ? 'You have been signed out. Please reload the page and sign in.' : 'The server did not answer properly. Please reload the page.' }; }); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Could not save.');
        saving(-1);
        var what = nameOf(x), c = clashes()[x.key];
        var msg = !isSched(x) ? what + ' is back in the list.' : what + ' · ' + x.start + (x.end ? '–' + x.end : '') + ', ' + vName(x.venue) + '.';
        if (c) msg += ' Clashes with ' + nameOf(c) + '.';
        else if (x.sent && isSched(x) && x.type !== 'item') msg += ' The presenter was emailed an earlier time; open the card to email the new one.';
        toast(msg, canUndo === false ? null : function () { commit(x, prev, false); });
      })
      .catch(function (ex) { saving(-1, true);
        var cur = snapOf(x), same = cur.date === mine.date && cur.start === mine.start && cur.end === mine.end && cur.venue === mine.venue;
        if (same) { x.date = prev.date; x.start = prev.start; x.end = prev.end; x.venue = prev.venue; x.ok = prev.ok; render(); }   // only undo our own change, not a newer one
        toast('Not saved: ' + (ex.message === 'Failed to fetch' ? 'no connection to the server. Check your internet and try again.' : ex.message), null, true); });
  }

  // ── dragging ──
  var pend = null, drag = null, lastDrag = 0, raf = 0, lastEv = null;
  var colAt = function (x, y) { var el = document.elementFromPoint(x, y); return el ? { col: el.closest('.tt-col'), tray: el.closest('.tt-tray') } : {}; };
  function begin() {
    drag = pend; pend = null; clearTimeout(drag.timer);
    document.documentElement.classList.add('tt-dragging');
    if (drag.mode === 'move') {
      var g = drag.card.cloneNode(true); g.removeAttribute('style'); g.className = g.className.replace(/\b(xs|sm|clash)\b/g, '') + ' tt-ghost'; $('.tt-page').appendChild(g); drag.ghost = g;
      drag.card.classList.add('src'); $('#ttDropHint').classList.toggle('on', drag.inGrid);
    } else drag.card.classList.add('rsz');
    if (drag.touch && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* ignore */ } }
    move(drag.ev);
  }
  function clearPrev() { var p = $('.tt-prev'); if (p) p.remove(); p = $('.tt-now'); if (p) p.remove(); p = $('.tt-ch.on'); if (p) p.classList.remove('on'); tray.classList.remove('drop'); }
  function mark(v, m) { var h = grid.querySelector('.tt-ch[data-hv="' + v + '"]'); if (h) h.classList.add('on'); var g = $('.tt-times'); if (g) { var b = document.createElement('i'); b.className = 'tt-now'; b.style.top = Math.round((m - t0) * ppm) + 'px'; b.textContent = hhmm(m); g.appendChild(b); } }
  function move(ev) {
    lastEv = ev; var x = drag.x;
    if (drag.mode === 'resize') {
      var col = drag.card.parentNode, r = col.getBoundingClientRect(), s = mins(x.start);
      var en = Math.max(s + 5, Math.min(t1, Math.round((t0 + (ev.clientY - r.top) / ppm) / 5) * 5));
      drag.end = hhmm(en); drag.card.style.height = Math.max(18, Math.round((en - s) * ppm) - 2) + 'px';
      var t = drag.card.querySelector('.tt-t'); if (t) t.textContent = x.start + '–' + drag.end + ' · ' + durText(en - s);
      clearPrev(); mark(+x.venue || 0, en);
      return;
    }
    drag.ghost.style.transform = 'translate(' + (ev.clientX + 14) + 'px,' + (ev.clientY + 12) + 'px) rotate(-1.5deg)';
    var at = colAt(ev.clientX, ev.clientY); clearPrev(); drag.target = null;
    if (at.col) {
      var rc = at.col.getBoundingClientRect(), d = durOf(x);
      var m = Math.round((t0 + (ev.clientY - rc.top - (drag.inGrid ? drag.oy : 14)) / ppm) / 5) * 5; m = Math.max(t0, Math.min(t1 - d, m));
      var p = document.createElement('div'); p.className = 'tt-prev'; p.style.top = Math.round((m - t0) * ppm) + 'px'; p.style.height = Math.max(22, Math.round(d * ppm)) + 'px'; p.textContent = hhmm(m) + '–' + hhmm(m + d);
      at.col.appendChild(p); drag.target = { v: +at.col.getAttribute('data-v'), m: m, d: d }; mark(drag.target.v, m);
    } else if (at.tray && drag.inGrid) { tray.classList.add('drop'); drag.target = { un: true }; }
  }
  function autoScroll() {
    if (drag && lastEv) { var r = scroll.getBoundingClientRect(), y = lastEv.clientY, x = lastEv.clientX, k = 0, kx = 0;
      if (x > r.left && x < r.right) { if (y < r.top + 56 && y > r.top - 40) k = -12; else if (y > r.bottom - 48 && y < r.bottom + 40) k = 12; }
      if (y > r.top && y < r.bottom && drag.mode === 'move') { if (x < r.left + 70 && x > r.left) kx = -12; else if (x > r.right - 40) kx = 12; }
      if (k || kx) { scroll.scrollTop += k; scroll.scrollLeft += kx; move(lastEv); } }
    raf = requestAnimationFrame(autoScroll);
  }
  function finish(apply) {
    var d = drag; drag = null; lastEv = null; lastDrag = Date.now();
    document.documentElement.classList.remove('tt-dragging'); clearPrev(); $('#ttDropHint').classList.remove('on');
    if (d.ghost) d.ghost.remove(); d.card.classList.remove('src', 'rsz');
    if (!apply) { render(); return; }
    var x = d.x;
    if (d.mode === 'resize') { if (d.end) commit(x, { date: x.date, start: x.start, end: d.end, venue: x.venue }); else render(); return; }
    if (!d.target) { render(); return; }
    if (d.target.un) commit(x, { date: '', start: '', end: '', venue: x.venue });
    else commit(x, { date: day, start: hhmm(d.target.m), end: hhmm(d.target.m + d.target.d), venue: d.target.v });
  }
  document.addEventListener('pointerdown', function (ev) {
    if (ev.button || drag) return;
    var c = ev.target.closest('.tt-card'); if (!c || !c.closest('#ttMain')) return;
    var x = byKey[c.getAttribute('data-key')]; if (!x) return;
    var r = c.getBoundingClientRect(), rs = !!ev.target.closest('.tt-rs');
    pend = { x: x, card: c, mode: rs ? 'resize' : 'move', sx: ev.clientX, sy: ev.clientY, oy: Math.min(ev.clientY - r.top, 40), touch: ev.pointerType !== 'mouse', inGrid: !!c.closest('.tt-col'), ev: ev };
    if (pend.touch) pend.timer = setTimeout(function () { if (pend) begin(); }, rs ? 120 : 320);
  });
  window.addEventListener('pointermove', function (ev) {
    if (drag) { move(ev); return; }
    if (!pend) return;
    var dist = Math.abs(ev.clientX - pend.sx) + Math.abs(ev.clientY - pend.sy); pend.ev = ev;
    if (!pend.touch && dist > 5) begin(); else if (pend.touch && dist > 10) { clearTimeout(pend.timer); pend = null; }
  });
  var up = function (ok) { return function () { if (pend) { clearTimeout(pend.timer); pend = null; } if (drag) finish(ok); }; };
  window.addEventListener('pointerup', up(true)); window.addEventListener('pointercancel', up(false));
  document.addEventListener('touchmove', function (ev) { if (drag) ev.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (ev) { if (ev.target.closest && ev.target.closest('.tt-card') && (drag || pend)) ev.preventDefault(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && drag) finish(false); });
  raf = requestAnimationFrame(autoScroll);

  // ── dialogs (plain forms: saving reloads the page on the same day) ──
  var sd = $('#slotDlg'), f = sd.querySelector('form');
  function openSlot(x) {
    var it = x.type === 'item';
    [].forEach.call(sd.querySelectorAll('.it-only'), function (el) { el.hidden = !it; }); [].forEach.call(sd.querySelectorAll('.talk-only'), function (el) { el.hidden = it; });
    $('#slT').textContent = it ? (x.id ? 'Edit event' : 'Add an event') : (x.date ? 'Edit schedule' : 'Schedule this talk');
    $('#slWho').textContent = it ? '' : x.who + ' · ' + x.label + (x.title ? ' — ' + x.title : '');
    var el = function (n) { return f.elements.namedItem(n); }, set = function (n, v) { var i = el(n); i.value = v; if (i._flatpickr) i._flatpickr.setDate(v || null, false); if (i.tagName === 'SELECT') i.dispatchEvent(new Event('change')); };
    set('type', x.type); set('id', x.id || ''); set('title', it ? x.title || '' : ''); set('kind', it ? (x.kind || 'session') : 'session'); set('who', it ? x.who || '' : '');
    set('slot_date', x.date || ''); set('slot_start', x.start || ''); set('slot_end', x.end || ''); set('slot_venue', x.venue || ''); set('slot_code', x.code || ''); el('slot_ok').checked = !!x.ok;
    var m = $('#slMail'); m.checked = false; m.disabled = !x.email;
    $('#slMailH').textContent = x.email ? ('Day, time and venue, with a link to their ' + (x.type === 'spk' ? 'speaker portal' : 'dashboard') + '.' + (x.sent ? ' Last emailed ' + x.sent + '.' : '')) : 'There is no email address for this presenter.';
    $('#slDel').hidden = !it || !x.id;
    sd.showModal(); if (it && !x.id) setTimeout(function () { el('title').focus(); }, 60);
  }
  function openVenue(id) {
    var x = V.filter(function (y) { return y.id === id; })[0] || { name: '', details: '', sort: (V.length + 1) * 10 }, vd = $('#venDlg'), g = vd.querySelector('form');
    g.elements.namedItem('id').value = id || ''; g.elements.namedItem('name').value = x.name; g.elements.namedItem('details').value = x.details || ''; g.elements.namedItem('sort').value = x.sort;
    $('#vnT').textContent = id ? 'Edit venue' : 'Add a venue'; $('#vnDel').hidden = !id; vd.showModal(); setTimeout(function () { g.elements.namedItem('name').focus(); }, 60);
  }
  [].forEach.call(document.querySelectorAll('dialog.au-dlg'), function (d) { d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.closest('[data-close]')) d.close(); }); });
  var ask = function (id, q, ok) { var bt = document.getElementById(id); if (bt) bt.addEventListener('click', function (ev) { if (bt.__ok) { bt.__ok = false; return; } ev.preventDefault(); window.ui.confirm(q, { danger: true, ok: ok }).then(function (y) { if (y) { bt.__ok = true; bt.click(); } }); }); };
  ask('slDel', 'Delete this event?', 'Delete event'); ask('vnDel', 'Delete this venue? Anything scheduled there moves to “General”.', 'Delete venue');
  f.addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.id === 'slDel') return;
    var el = function (n) { return f.elements.namedItem(n); }, a = el('slot_start').value, b = el('slot_end').value;
    if (b && a && b <= a) { ev.preventDefault(); window.ui.alert('The end time must be after the start time.'); return; }
    if (el('slot_ok').checked && !(el('slot_date').value && a)) { ev.preventDefault(); window.ui.alert('To show it on the website, choose the day and the start time first.'); return; }
    if (el('type').value === 'item' && !el('title').value.trim()) { ev.preventDefault(); el('title').focus(); }
  });

  // ── clicks ──
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var v = t.closest('[data-venue]'); if (v) { openVenue(+v.getAttribute('data-venue')); return; }
    if (t.closest('[data-new-item]')) { openSlot({ type: 'item', id: 0, kind: 'session', date: day, ok: 0 }); return; }
    var tab = t.closest('.tt-tab'); if (tab) { setDay(tab.getAttribute('data-day')); return; }
    var fl = t.closest('.tt-flt button'); if (fl) { filter = fl.getAttribute('data-f'); [].forEach.call(document.querySelectorAll('.tt-flt button'), function (b) { b.setAttribute('aria-pressed', b === fl); }); renderTray(); return; }
    var sw = t.closest('.tt-sw button'); if (sw) { setView(sw.getAttribute('data-view')); return; }
    if (t.closest('#ttZin')) { zoom(1); return; } if (t.closest('#ttZout')) { zoom(-1); return; }
    if (Date.now() - lastDrag < 350) return;
    var c = t.closest('.tt-card'); if (c && c.closest('#ttMain')) { var x = byKey[c.getAttribute('data-key')]; if (x) openSlot(x); return; }
    if (t.classList && t.classList.contains('tt-col')) {                      // empty space: a new event right there
      var r = t.getBoundingClientRect(), m = Math.max(t0, Math.min(t1 - 30, Math.floor((t0 + (ev.clientY - r.top) / ppm) / 15) * 15));
      openSlot({ type: 'item', id: 0, kind: 'session', date: day, start: hhmm(m), end: hhmm(m + 30), venue: +t.getAttribute('data-v') || '', ok: 0 });
    }
  });
  document.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('tt-card')) { ev.preventDefault(); var x = byKey[ev.target.getAttribute('data-key')]; if (x) openSlot(x); } });
  // arrow keys nudge the focused card: up/down 5 minutes, Shift + up/down changes the length, left/right changes room
  document.addEventListener('keydown', function (ev) {
    var c = ev.target; if (!c.classList || !c.classList.contains('tt-card') || !c.closest('.tt-col') || drag) return;
    var k = ev.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(k) < 0 || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var x = byKey[c.getAttribute('data-key')]; if (!x) return; ev.preventDefault();
    var s = mins(x.start), d = durOf(x), ids = [0].concat(V.map(function (v) { return v.id; })), vi = ids.indexOf(+x.venue || 0);
    if (k === 'ArrowLeft' || k === 'ArrowRight') { vi = Math.max(0, Math.min(ids.length - 1, vi + (k === 'ArrowLeft' ? -1 : 1))); }
    else if (ev.shiftKey) d = Math.max(5, Math.min(1440 - s, d + (k === 'ArrowUp' ? -5 : 5)));
    else s = Math.max(0, Math.min(1440 - d, s + (k === 'ArrowUp' ? -5 : 5)));
    commit(x, { date: x.date, start: hhmm(s), end: hhmm(s + d), venue: ids[vi] });
  });
  // a quiet "+ 10:15" follows the mouse over empty space
  var hint = null;
  grid.addEventListener('mousemove', function (ev) {
    var t = ev.target; if (hint) { hint.remove(); hint = null; }
    if (drag || !t.classList || !t.classList.contains('tt-col')) return;
    var r = t.getBoundingClientRect(), m = Math.max(t0, Math.min(t1 - 30, Math.floor((t0 + (ev.clientY - r.top) / ppm) / 15) * 15));
    hint = document.createElement('div'); hint.className = 'tt-add'; hint.style.top = Math.round((m - t0) * ppm) + 'px'; hint.textContent = '+ ' + hhmm(m); t.appendChild(hint);
  });
  grid.addEventListener('mouseleave', function () { if (hint) { hint.remove(); hint = null; } });
  $('#ttQ').addEventListener('input', function () { query = this.value; renderTray(); });

  function setDay(d) { if (DAYS.indexOf(d) < 0) return; day = d; try { history.replaceState(null, '', '#d' + DAYS.indexOf(d)); sessionStorage.setItem('tt-day', d); } catch (e) { /* ignore */ } renderGrid(); firstScroll(); }
  function setView(v) { main.setAttribute('data-view', v); [].forEach.call(document.querySelectorAll('.tt-sw button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v); }); }
  function zoom(d) { var mid = (scroll.scrollTop + scroll.clientHeight / 2) / ppm; zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + d)); ppm = ZOOMS[zi]; try { localStorage.setItem('tt-zoom', zi); } catch (e) { /* ignore */ } renderGrid(); scroll.scrollTop = mid * ppm - scroll.clientHeight / 2; }
  function firstScroll() { var a = null; E.forEach(function (x) { if (x.date === day && x.start) a = a === null ? mins(x.start) : Math.min(a, mins(x.start)); }); scroll.scrollTop = Math.max(0, ((a === null ? 510 : a) - t0 - 30) * ppm); }

  var h = (location.hash || '').slice(1), di = /^d(\d+)$/.exec(h);
  if (di && DAYS[+di[1]]) day = DAYS[+di[1]]; else { try { var sdy = sessionStorage.getItem('tt-day'); if (sdy && DAYS.indexOf(sdy) >= 0) day = sdy; } catch (e) { /* ignore */ } }
  try { sessionStorage.setItem('tt-day', day); } catch (e) { /* ignore */ }
  if (!DAYS.length) { grid.innerHTML = '<p class="tt-blank">The conference dates are not set yet. Set them under Settings, then come back.</p>'; return; }
  render(); firstScroll(); setView(h === 'un' ? 'tray' : 'grid');
})();
