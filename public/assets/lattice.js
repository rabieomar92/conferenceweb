/* Hero: a solid-atom crystal in real perspective (the same 5×5×5 crystal as the poster).
   - Atoms (flat navy tints by depth, with bonds) assemble out of a scattered cloud when the page opens.
   - The crystal turns slowly, tilts toward the pointer, and the pointer pushes atoms aside.
   - Scrolling flies the camera into the crystal while the hero stays pinned; the headline, logo and sun move at their own depths (CSS variable --p); only the crystal follows the pointer.
   Draws only while the hero is on screen. Reduced motion: one still frame, no pinning. Home page only. */
(function () {
  var hero = document.querySelector('.hero'), stick = hero && hero.querySelector('.hero-stick');
  if (!hero || !stick || !window.HTMLCanvasElement) return;
  var cv = document.createElement('canvas'); cv.className = 'lattice'; cv.setAttribute('aria-hidden', 'true');
  stick.insertBefore(cv, stick.firstChild);
  // a faint silicon wafer behind the crystal (static image; fades and grows a little as you scroll)
  var me = document.querySelector('script[src*="lattice.js"]'), wf = document.createElement('img');
  wf.src = (me ? me.src.replace(/lattice\.js.*$/, '') : '/assets/') + 'wafer.svg'; wf.alt = ''; wf.className = 'wafer'; wf.setAttribute('aria-hidden', 'true'); wf.decoding = 'async';
  stick.insertBefore(wf, cv);
  // one registration button at a time: the header's appears only once the hero's has scrolled away
  var cta = hero.querySelector('a.btn[href$="/register"]');
  if (cta && 'IntersectionObserver' in window) { document.documentElement.classList.add('cta-here'); new IntersectionObserver(function (es) { document.documentElement.classList.toggle('cta-here', es[0].isIntersecting); }).observe(cta); }
  var g = cv.getContext('2d'); if (!g) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var de = document.documentElement, header = document.querySelector('header.top');

  // ── headline: each word rises out of a mask ──
  var h1 = hero.querySelector('h1');
  if (false && h1 && !still) {                                     // word-by-word reveal switched off: the headline is readable at once
    var words = h1.textContent.trim().split(/\s+/), i = 0;
    h1.setAttribute('aria-label', h1.textContent.trim());
    h1.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true" style="--i:' + (i++) + '"><span>' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></span>'; }).join(' ');
  }

  // ── tints, computed once: one colour, navy #12285C, as solid tints over paper #F8F7F4 (same look as the poster) ──
  var TQ = 32, TINT = [];
  for (var k0 = 0; k0 <= TQ; k0++) { var m0 = k0 / TQ; TINT.push('rgb(' + Math.round(248 + (18 - 248) * m0) + ',' + Math.round(247 + (40 - 247) * m0) + ',' + Math.round(244 + (92 - 244) * m0) + ')'); }
  function tint(m) { return TINT[m <= 0 ? 0 : m >= 1 ? TQ : Math.round(m * TQ)]; }

  // ── the crystal: a 5×5×5 simple cubic grid with its bonds ──
  var NX = 5, NY = 5, NZ = 5;
  var A = [], B = [], idx = {};
  (function () {
    var maxd = Math.hypot(NX, NY, NZ) / 2, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var x = 0; x < NX; x++) for (var y = 0; y < NY; y++) for (var z = 0; z < NZ; z++) {
      var hx = x - (NX - 1) / 2, hy = y - (NY - 1) / 2, hz = z - (NZ - 1) / 2, th = rnd() * 6.2832, ph = Math.acos(2 * rnd() - 1), rr = 3 + rnd() * 3.5;
      idx[x + ',' + y + ',' + z] = A.push({ x: hx, y: hy, z: hz, sx: Math.sin(ph) * Math.cos(th) * rr, sy: Math.sin(ph) * Math.sin(th) * rr, sz: Math.abs(Math.cos(ph)) * rr + 1, d: Math.hypot(hx, hy, hz) / maxd * .8 + rnd() * .35 }) - 1;
    }
    for (var k in idx) { var q = k.split(',').map(Number), a = idx[k]; [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (d) { var n = idx[(q[0] + d[0]) + ',' + (q[1] + d[1]) + ',' + (q[2] + d[2])]; if (n !== undefined) B.push([a, n]); }); }
  })();
  var DL = [];                                                     // this frame's bonds and atoms, drawn back to front

  var W = 0, H = 0, dpr = 1, F = 600, raf = 0, on = true, t0 = performance.now();
  var mx = 0, my = 0, tx = 0, ty = 0, px = -1e4, py = -1e4, p = 0, pin = false, runway = 1, y0 = 0, hh = 69;
  var fdt = 16.7, lp = '', lastT = 0, vis = [];
  var P = new Array(A.length);
  for (var n0 = 0; n0 < A.length; n0++) P[n0] = { x: 0, y: 0, f: 0, z: 0, r: 0, a: 0, fp: 0, i: n0, k: 1, o: null };

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 4); }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); }

  var lite = 0, lowres = false, stack = false, textTop = 0, scx = 0, scy = 0, sw = 0, sh = 0;
  function measure() {
    var r = stick.getBoundingClientRect();
    dpr = Math.min(lowres ? 1 : innerWidth < 760 ? 1.5 : 1.25, window.devicePixelRatio || 1); W = r.width; H = r.height;   // sharp on high-density screens; drops to 1 if the device struggles
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = Math.min(W * (W < 760 ? 1.15 : 0.62), H * 1.25);
    stack = innerWidth <= 860; textTop = H;
    var st = stick.querySelector('.hstage'), sr = st ? st.getBoundingClientRect() : null;
    if (sr && sr.width) { sw = sr.width; sh = sr.height; scx = sr.left - r.left + sw / 2; scy = sr.top - r.top + sh / 2; if (stack) textTop = sr.bottom - r.top + 6; }
    else { sw = W * 0.5; sh = H * 0.8; scx = W * 0.7; scy = H * 0.5; }
    F = stack ? Math.min(sw * 1.5, sh * 1.8) : Math.min(W * 0.62, H * 1.25);
    var ws = Math.round(F * 0.74 * (stack ? 1.0 : 1.18)); wf.style.width = wf.style.height = ws + 'px'; wf.style.left = Math.round(scx) + 'px'; wf.style.top = Math.round(scy) + 'px';
    hh = header ? header.offsetHeight : 69;
    pin = false;                                                  // the hero scrolls like the rest of the page; nothing holds the reader back
    de.classList.toggle('hp-on', pin);
    de.style.setProperty('--hh', hh + 'px');
    hero.style.height = ''; hero.style.height = pin ? (stick.offsetHeight + Math.round(innerHeight * 0.9)) + 'px' : '';
    runway = Math.max(1, hero.offsetHeight - stick.offsetHeight);
    y0 = hero.getBoundingClientRect().top + (window.pageYOffset || 0) - (pin ? hh : 0);
  }
  function progress() {
    var y = (window.pageYOffset || 0) - y0;
    return still ? 0 : pin ? clamp(y / runway) : clamp(y / Math.max(1, hero.offsetHeight)) * 0.7;
  }

  function frame(now) {
    raf = 0; if (!on || document.hidden || !ready) return;
    // once settled and nothing is moving, 30 fps is plenty; never spend more than needed
    var moving = Math.abs(progress() - p) > 0.0008 || px > -9e3, calm = !moving && now - t0 > 3200;
    var intro = now - t0 < 3000, budget = moving || intro ? 15 : calm ? 48 : 31; if (lite > 1) budget = Math.max(budget, 31);
    if (!still && now - lastT < budget) { raf = requestAnimationFrame(frame); return; }
    var gap = lastT ? now - lastT : 16.7; lastT = now;
    fdt += (Math.min(gap, 120) - fdt) * 0.1;
    var t = still ? 99 : (now - t0) / 1000;
    p += (progress() - p) * (still ? 1 : 0.14);                    // eased, so the camera never jerks
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    var vp = p.toFixed(3);
    if (vp !== lp) { stick.style.setProperty('--p', lp = vp); } 

    g.clearRect(0, 0, W, H);

    var ep = p * p * (3 - 2 * p), D = 7.6 - 6.2 * ep;                 // camera distance: flies into the crystal as you scroll
    var th = 0.62 + t * 0.09 + mx * 0.25 + ep * 1.5, ph = -0.52 + my * 0.12 + ep * 0.35;
    var cth = Math.cos(th), sth = Math.sin(th), cph = Math.cos(ph), sph = Math.sin(ph);
    var cx = scx, cy = scy;
    var zoomIn = 1 + ep * 0.2, wave = t * 1.1;
    var i, a, q, zmin = 1e9, zmax = -1e9; vis.length = 0;
    for (i = 0; i < A.length; i++) {
      a = A[i]; q = P[i];
      var u = still ? 1 : ease((t - 0.2 - a.d) / 1.5), s = 1 - u;
      var X = a.x + a.sx * s, Y = a.y + a.sy * s + Math.sin(wave + a.x * .55 + a.z * .4) * .05 * u, Z = a.z + a.sz * s;
      var x1 = X * cth + Z * sth, z1 = -X * sth + Z * cth, y1 = Y * cph - z1 * sph, z2 = Y * sph + z1 * cph;
      var dz = D + z2; if (dz < 0.5) { q.f = 0; continue; }
      var f = F * 0.74 * zoomIn / dz, sx = cx + x1 * f, sy = cy + y1 * f;
      var dx = sx - px, dy = sy - py, dd = Math.hypot(dx, dy), push = 0, near = 0;
      var al = clamp(u * 1.4) * smooth(0.6, 1.6, dz) * (0.12 + 0.88 * ep + 0.88 * (1 - ep) * smooth(0.42 * (1 - ep), 0.6 * (1 - ep) + 0.02, sx / W));
      if (stack) al *= 1 - smooth(textTop - 30, textTop, sy);   // never draw lattice over the copy
      if (al < 0.02) { q.f = 0; continue; }
      q.f = 1; q.u = u; q.x = sx; q.y = sy; q.z = dz; q.fp = f; q.r = Math.min(60, Math.max(1.2, 0.122 * f * (1 + near * 0.5))); q.a = al; vis.push(q);
      if (dz < zmin) zmin = dz; if (dz > zmax) zmax = dz;
    }
    var zr = Math.max(0.001, zmax - zmin);
    // one list of bonds and atoms, far to near, so nearer atoms sit over the bonds behind them (as in the poster)
    DL.length = 0;
    for (i = 0; i < vis.length; i++) { q = vis[i]; if (q.x < -q.r || q.x > W + q.r || q.y < -q.r || q.y > H + q.r) continue; q.k = 0; q.o = q; DL.push(q); }
    for (i = 0; i < B.length; i++) {
      var p1 = P[B[i][0]], p2 = P[B[i][1]]; if (!p1.f || !p2.f || p1.u < 0.96 || p2.u < 0.96) continue;
      var bz = (p1.z + p2.z) / 2; if (lite > 1 && (bz - zmin) / zr > 0.7) continue;
      var bo = B[i].o || (B[i].o = { k: 1 }); bo.z = bz + 0.02; bo.p1 = p1; bo.p2 = p2; DL.push(bo);
    }
    DL.sort(function (m, n) { return n.z - m.z; });
    g.lineCap = 'round';
    for (i = 0; i < DL.length; i++) {
      var it = DL[i], dn = (it.z - zmin) / zr;
      if (it.k) { var b1 = it.p1, b2 = it.p2; g.strokeStyle = tint((1 - (0.55 + 0.35 * dn)) * Math.min(b1.a, b2.a)); g.lineWidth = Math.max(0.7, 0.027 * (b1.fp + b2.fp) / 2); g.beginPath(); g.moveTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.stroke(); }
      else { g.fillStyle = tint((1 - (0.08 + 0.72 * dn)) * it.a); g.beginPath(); g.arc(it.x, it.y, it.r, 0, 6.2832); g.fill(); }
    }
    // quality governor: if this device spends too long drawing, shed detail (the intro itself stays as designed)
    var slow = fdt > budget * 1.5 + 4;                                // judged by real frame gaps, so drawing cost on the GPU counts too
    if (!still && !lowres && dpr > 1 && slow && now - t0 > 500) { lowres = true; fdt = 16.7; measure(); }   // sharpness goes first, at any moment
    else if (!still && now - t0 > 2600 && slow && lite < 2) { lite++; fdt = 16.7; }
    if (!still) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  function kick() { if (!raf && on) raf = requestAnimationFrame(frame); }

  hero.addEventListener('pointermove', function (ev) {
    var r = stick.getBoundingClientRect(); px = ev.clientX - r.left; py = ev.clientY - r.top;
    tx = (ev.clientX / innerWidth - 0.5) * 2; ty = (ev.clientY / innerHeight - 0.5) * 2; if (still) kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { px = py = -1e4; tx = ty = 0; if (still) kick(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on) kick(); }).observe(hero);
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { measure(); kick(); }, 150); });
  // start the intro only once the page has finished loading (fonts, images, layout), so it never competes with the browser's own work
  var ready = still;
  function go() { if (ready) return; ready = true; measure(); t0 = performance.now(); lastT = 0; kick(); }
  function whenSettled() { var f = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); f.then(function () { requestAnimationFrame(function () { requestAnimationFrame(go); }); }); }
  if (document.readyState === 'complete') whenSettled(); else addEventListener('load', whenSettled);
  setTimeout(go, 2500);                                            // never wait longer than this
  addEventListener('load', function () { measure(); kick(); });
  addEventListener('scroll', function () { if (still) { p = progress(); kick(); } }, { passive: true });
  measure(); kick();
})();
