/* Hero: a solid-atom crystal in real perspective.
   - Atoms (gold and navy spheres, navy bonds) assemble out of a scattered cloud when the page opens.
   - The crystal turns slowly, tilts toward the pointer, and the pointer pushes atoms aside.
   - Scrolling flies the camera into the crystal while the hero stays pinned; the headline, logo and sun move at their own depths (CSS variables --p, --mx, --my).
   Draws only while the hero is on screen. Reduced motion: one still frame, no pinning. Home page only. */
(function () {
  var hero = document.querySelector('.hero'), stick = hero && hero.querySelector('.hero-stick');
  if (!hero || !stick || !window.HTMLCanvasElement) return;
  var cv = document.createElement('canvas'); cv.className = 'lattice'; cv.setAttribute('aria-hidden', 'true');
  stick.insertBefore(cv, stick.firstChild);
  var g = cv.getContext('2d'); if (!g) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var de = document.documentElement, header = document.querySelector('header.top');

  // ── headline: each word rises out of a mask ──
  var h1 = hero.querySelector('h1');
  if (h1 && !still) {
    var words = h1.textContent.trim().split(/\s+/), i = 0;
    h1.setAttribute('aria-label', h1.textContent.trim());
    h1.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true" style="--i:' + (i++) + '"><span>' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></span>'; }).join(' ');
  }

  // ── solid spheres, drawn once ──
  function sprite(c0, c1, c2) {
    var s = document.createElement('canvas'); s.width = s.height = 64; var x = s.getContext('2d');
    var r = x.createRadialGradient(24, 21, 3, 32, 32, 31); r.addColorStop(0, c0); r.addColorStop(.45, c1); r.addColorStop(1, c2);
    x.fillStyle = r; x.beginPath(); x.arc(32, 32, 31, 0, 6.2832); x.fill(); return s;
  }
  var GOLD = sprite('#FFF0B8', '#F6B400', '#A96A00'), NAVY = sprite('#7C93D6', '#1D3480', '#0A1438');

  // ── the crystal (rock-salt arrangement: gold and navy alternate on a cubic grid) ──
  var small = innerWidth < 760, NX = small ? 7 : 11, NY = small ? 6 : 8, NZ = small ? 6 : 8;
  var A = [], B = [], idx = {};
  (function () {
    var maxd = Math.hypot(NX, NY, NZ) / 2, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var x = 0; x < NX; x++) for (var y = 0; y < NY; y++) for (var z = 0; z < NZ; z++) {
      var hx = x - (NX - 1) / 2, hy = y - (NY - 1) / 2, hz = z - (NZ - 1) / 2, th = rnd() * 6.2832, ph = Math.acos(2 * rnd() - 1), rr = 7 + rnd() * 9;
      idx[x + ',' + y + ',' + z] = A.push({ x: hx, y: hy, z: hz, g: (x + y + z) % 2 === 0, sx: Math.sin(ph) * Math.cos(th) * rr, sy: Math.sin(ph) * Math.sin(th) * rr, sz: Math.cos(ph) * rr, d: Math.hypot(hx, hy, hz) / maxd * .8 + rnd() * .35 }) - 1;
    }
    for (var k in idx) { var q = k.split(',').map(Number), a = idx[k]; [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (d) { var n = idx[(q[0] + d[0]) + ',' + (q[1] + d[1]) + ',' + (q[2] + d[2])]; if (n !== undefined) B.push([a, n]); }); }
  })();

  var W = 0, H = 0, dpr = 1, F = 600, raf = 0, on = true, t0 = performance.now();
  var mx = 0, my = 0, tx = 0, ty = 0, px = -1e4, py = -1e4, p = 0, pin = false, runway = 1, y0 = 0, hh = 69;
  var lp = '', lx = '', ly = '', lsx = '', lsy = '', lastT = 0, vis = [], band = [[], [], []];
  var P = new Array(A.length);
  for (var n0 = 0; n0 < A.length; n0++) P[n0] = { x: 0, y: 0, f: 0, z: 0, r: 0, a: 0, g: A[n0].g, i: n0 };

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 4); }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); }

  var stack = false, textTop = 0;
  function measure() {
    var r = stick.getBoundingClientRect();
    dpr = Math.min(innerWidth < 760 ? 1.5 : 1.25, window.devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = Math.min(W * (W < 760 ? 1.15 : 0.62), H * 1.25);
    stack = innerWidth <= 860; textTop = H;
    var hc = stick.querySelector('.hcopy'); if (stack && hc) textTop = Math.max(160, hc.getBoundingClientRect().top - r.top);
    F = Math.min(W * (W < 760 ? 1.15 : 0.62), H * 1.25); if (stack) F = Math.min(W * 1.1, textTop * 1.5);
    hh = header ? header.offsetHeight : 69;
    pin = !still && innerWidth > 860 && innerHeight >= 620;
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
    raf = 0; if (!on || document.hidden) return;
    // once settled and nothing is moving, 30 fps is plenty; never spend more than needed
    var calm = now - t0 > 3200 && Math.abs(progress() - p) < 0.0008 && px < -9e3;
    if (!still && calm && now - lastT < 30) { raf = requestAnimationFrame(frame); return; }
    lastT = now;
    var t = still ? 99 : (now - t0) / 1000;
    p += (progress() - p) * (still ? 1 : 0.14);                    // eased, so the camera never jerks
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    var vp = p.toFixed(3), vx = mx.toFixed(2), vy = my.toFixed(2);
    if (vp !== lp) { stick.style.setProperty('--p', lp = vp); } if (vx !== lx) { stick.style.setProperty('--mx', lx = vx); } if (vy !== ly) { stick.style.setProperty('--my', ly = vy); }
    var vsx = (px < -9e3 ? W * 0.7 : px).toFixed(0), vsy = (py < -9e3 ? H * 0.45 : py).toFixed(0);
    if (vsx !== lsx || vsy !== lsy) { stick.style.setProperty('--sx', (lsx = vsx) + 'px'); stick.style.setProperty('--sy', (lsy = vsy) + 'px'); }
    g.clearRect(0, 0, W, H);

    var ep = p * p * (3 - 2 * p), D = 17 - 14.6 * ep;               // camera distance: flies into the crystal as you scroll
    var th = t * 0.09 + mx * 0.25 + ep * 1.5, ph = -0.34 + my * 0.12 + ep * 0.35;
    var cth = Math.cos(th), sth = Math.sin(th), cph = Math.cos(ph), sph = Math.sin(ph);
    var cx0 = stack ? W * 0.5 : W * 0.7, cx = cx0 - (stack ? 0 : ep * W * 0.2), cy = stack ? textTop * 0.5 : H * 0.5;
    var zoomIn = 1 + ep * 0.2, wave = t * 1.1, maskA = 0.56 * (1 - ep), maskB = 0.2 * (1 - ep);
    var i, a, q; vis.length = 0;
    for (i = 0; i < A.length; i++) {
      a = A[i]; q = P[i];
      var u = still ? 1 : ease((t - 0.2 - a.d) / 1.5), s = 1 - u;
      var X = a.x + a.sx * s, Y = a.y + a.sy * s + Math.sin(wave + a.x * .55 + a.z * .4) * .07 * u, Z = a.z + a.sz * s;
      var x1 = X * cth + Z * sth, z1 = -X * sth + Z * cth, y1 = Y * cph - z1 * sph, z2 = Y * sph + z1 * cph;
      var dz = D + z2; if (dz < 0.7) { q.f = 0; continue; }
      var f = F * zoomIn / dz, sx = cx + x1 * f, sy = cy + y1 * f;
      var dx = sx - px, dy = sy - py, dd = Math.hypot(dx, dy), push = 0, near = 0;
      if (dd < 150) { near = 1 - dd / 150; push = near * near * 26 / (dd + 1); sx += dx * push; sy += dy * push; }
      var al = clamp(u * 1.4) * smooth(2.2, 4.2, dz) * (1 - smooth(20, 34, dz)) * (0.45 + 0.55 * smooth(maskB, maskA + 0.08, sx / W));
      if (W < 760) al *= 0.8;
      if (stack) al *= 1 - smooth(textTop - 40, textTop - 4, sy);   // never draw lattice over the copy
      var ex = (sx - cx0) / (W * 0.27), ey = (sy - cy) / (H * 0.32), ed = Math.sqrt(ex * ex + ey * ey);
      al *= 1 - (1 - 0.07 - 0.93 * smooth(0.6, 1.3, ed)) * (1 - ep) * (W < 760 ? 0 : 1);   // a clear pool of paper behind the logo, filling in as the camera dives
      if (al < 0.01) { q.f = 0; continue; }
      q.f = 1; q.x = sx; q.y = sy; q.z = dz; q.r = Math.min(46, Math.max(1.1, 0.17 * f * (1 + near * 0.6))); q.a = al; q.n = near; vis.push(q);
    }
    vis.sort(function (m, n) { return n.z - m.z; });                // far to near
    // bonds, in three depth bands (one stroke each)
    g.lineWidth = Math.max(0.8, F / 560); g.lineCap = 'round';
    band[0].length = band[1].length = band[2].length = 0;
    for (i = 0; i < B.length; i++) {
      var p1 = P[B[i][0]], p2 = P[B[i][1]]; if (!p1.f || !p2.f) continue;
      var zz = (p1.z + p2.z) / 2; band[zz > 15 ? 0 : zz > 9 ? 1 : 2].push(p1, p2);
    }
    for (var bi = 0; bi < 3; bi++) {
      g.strokeStyle = 'rgba(24,40,92,' + [0.10, 0.17, 0.28][bi] * (bi === 2 ? 1 - ep * 0.4 : 1) + ')'; g.beginPath();
      for (var k = 0; k < band[bi].length; k += 2) { var m1 = band[bi][k], m2 = band[bi][k + 1]; g.moveTo(m1.x, m1.y); g.lineTo(m2.x, m2.y); }
      g.stroke();
    }
    var lga = -1;
    for (i = 0; i < vis.length; i++) {
      q = vis[i]; var ga = Math.round(q.a * (0.55 + 0.45 * smooth(2, 12, 24 - q.z)) * 8) / 8; if (ga !== lga) { g.globalAlpha = lga = ga; }
      var r = q.r; g.drawImage(q.g ? GOLD : NAVY, q.x - r, q.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
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
  addEventListener('load', function () { measure(); kick(); });
  addEventListener('scroll', function () { if (still) { p = progress(); kick(); } }, { passive: true });
  measure(); kick();
})();
