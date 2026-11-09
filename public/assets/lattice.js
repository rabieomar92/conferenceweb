/* Hero background: a honeycomb crystal lattice (gold atoms, navy bonds), as in the ICSSST 2027 logo.
   A slow travelling lattice wave (a phonon) moves the atoms; the pointer sends a gentle ripple through it.
   Draws only while the hero is on screen; a still lattice for reduced-motion visitors. Home page only. */
(function () {
  var hero = document.querySelector('.hero');
  if (!hero || !window.HTMLCanvasElement) return;
  var cv = document.createElement('canvas');
  cv.className = 'lattice'; cv.setAttribute('aria-hidden', 'true');
  hero.insertBefore(cv, hero.firstChild);
  var g = cv.getContext('2d'); if (!g) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAVY = '18,40,92', GOLD = '242,169,0';
  var W = 0, H = 0, dpr = 1, atoms = [], bonds = [], a = 46, raf = 0, on = true, t0 = performance.now();
  var mx = -1e4, my = -1e4, pulses = [];

  function build() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    a = W < 700 ? 34 : 46;                                   // bond length
    atoms = []; bonds = [];
    var dx = a * Math.sqrt(3), dy = a * 1.5, idx = {};
    var cols = Math.ceil(W / dx) + 3, rows = Math.ceil(H / dy) + 3;
    for (var j = -1; j < rows; j++) for (var i = -1; i < cols; i++) {
      // honeycomb = triangular lattice with a two-atom basis (A, B)
      var x = i * dx + (j % 2 ? dx / 2 : 0), y = j * dy;
      idx[i + ',' + j + ',A'] = atoms.push({ x: x, y: y, s: 0 }) - 1;
      idx[i + ',' + j + ',B'] = atoms.push({ x: x, y: y + a, s: 1 }) - 1;
    }
    for (var j2 = -1; j2 < rows; j2++) for (var i2 = -1; i2 < cols; i2++) {
      var A = idx[i2 + ',' + j2 + ',A'], Bb = idx[i2 + ',' + j2 + ',B'];
      if (A !== undefined && Bb !== undefined) bonds.push([A, Bb]);
      // B atom bonds to the two A atoms of the row below
      var off = j2 % 2 ? 0 : -1;
      [[i2 + off, j2 + 1], [i2 + off + 1, j2 + 1]].forEach(function (p) { var n = idx[p[0] + ',' + p[1] + ',A']; if (n !== undefined && Bb !== undefined) bonds.push([Bb, n]); });
    }
  }
  // fade the lattice in from the right, so the headline on the left stays clean
  function fade(x, y) { var f = Math.min(1, Math.max(0, (x / W - 0.28) / 0.5)); return f * Math.min(1, Math.max(0, 1.15 - y / H * 0.55)); }

  function frame(now) {
    raf = 0; if (!on) return;
    var t = still ? 0 : (now - t0) / 1000;
    g.clearRect(0, 0, W, H);
    var kx = 2 * Math.PI / (a * 7.5), ky = 2 * Math.PI / (a * 11), w = 0.55, amp = a * 0.09;
    var P = atoms.map(function (p) {
      var ph = kx * p.x + ky * p.y - w * t;
      var ux = amp * Math.sin(ph), uy = amp * 0.6 * Math.cos(ph * 0.9 + p.s);
      for (var k = 0; k < pulses.length; k++) {                     // pointer ripples
        var q = pulses[k], d = Math.hypot(p.x - q.x, p.y - q.y), age = (now - q.t) / 1000, front = age * 260;
        var e = Math.exp(-Math.pow((d - front) / 40, 2)) * Math.exp(-age * 1.6) * a * 0.22;
        if (e > 0.05 && d > 1) { ux += (p.x - q.x) / d * e; uy += (p.y - q.y) / d * e; }
      }
      var hx = Math.hypot(p.x - mx, p.y - my), glow = Math.max(0, 1 - hx / (a * 3.2));
      return { x: p.x + ux, y: p.y + uy, f: fade(p.x, p.y), glow: glow, ph: ph };
    });
    g.lineWidth = 1.1;
    for (var b = 0; b < bonds.length; b++) {
      var p1 = P[bonds[b][0]], p2 = P[bonds[b][1]], f = Math.min(p1.f, p2.f);
      if (f < 0.02) continue;
      g.strokeStyle = 'rgba(' + NAVY + ',' + (0.16 * f + 0.25 * Math.max(p1.glow, p2.glow) * f).toFixed(3) + ')';
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    }
    for (var n = 0; n < P.length; n++) {
      var p = P[n]; if (p.f < 0.02) continue;
      var sub = atoms[n].s, r = (sub ? 3.1 : 4.2) + p.glow * 2.2;
      var lum = 0.5 + 0.5 * Math.sin(p.ph);                       // atoms brighten on the wave crest
      g.fillStyle = sub ? 'rgba(' + NAVY + ',' + ((0.28 + 0.22 * lum) * p.f).toFixed(3) + ')' : 'rgba(' + GOLD + ',' + ((0.45 + 0.4 * lum + 0.3 * p.glow) * p.f).toFixed(3) + ')';
      g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill();
    }
    pulses = pulses.filter(function (q) { return now - q.t < 2600; });
    if (!still) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && on) raf = requestAnimationFrame(frame); }
  var last = 0;
  hero.addEventListener('pointermove', function (ev) {
    var r = hero.getBoundingClientRect(); mx = ev.clientX - r.left; my = ev.clientY - r.top;
    var now = performance.now(); if (!still && now - last > 900) { last = now; pulses.push({ x: mx, y: my, t: now }); }
    if (still) kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { mx = my = -1e4; if (still) kick(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; kick(); }).observe(hero);
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); kick(); }, 150); });
  build(); kick();
})();
