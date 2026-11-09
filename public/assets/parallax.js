/* Depth on scroll, in one consistent language:
   - the atom lattice behind the hero drifts slower than the page (see lattice.js),
   - the logo and the closing line float a little against the scroll,
   - the hero text eases away as you leave it,
   - each section rises into place once, as it enters the screen.
   Transforms only (no layout work), one requestAnimationFrame per scroll frame, nothing for reduced-motion visitors. */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var de = document.documentElement, vh = innerHeight, small = innerWidth < 700;
  var layers = [].slice.call(document.querySelectorAll('[data-plx]')), hero = document.querySelector('.hero'), copy = document.querySelector('.hcopy');
  var ticking = false;

  function docTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function measure() {
    vh = innerHeight; small = innerWidth < 700;
    layers.forEach(function (el) { el.__c = docTop(el) + el.offsetHeight / 2; el.__s = (parseFloat(el.getAttribute('data-plx')) || 0) * (small ? 0.5 : 1); });
  }
  function update() {
    ticking = false;
    var y = window.pageYOffset || 0;
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i], d = el.__c - y - vh / 2;
      if (d > vh * 1.2 || d < -vh * 1.2) continue;                         // off screen: leave it
      el.style.transform = 'translate3d(0,' + (d * el.__s).toFixed(1) + 'px,0)';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  // sections rise into place once
  de.classList.add('js');
  var rv = [].slice.call(document.querySelectorAll('.s .grid2 > *, .band h2, .band .cta, .meta .cell, .partners .pgroup'));
  rv.forEach(function (el, i) { el.classList.add('rv'); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });
  window.addEventListener('load', function () { measure(); update(); });
  measure(); update();
})();
