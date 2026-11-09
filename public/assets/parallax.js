/* Light parallax: elements with data-plx move at a fraction of the scroll speed. */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = [].slice.call(document.querySelectorAll('.plx')), hero = document.querySelector('.hero');
  if (!els.length || !hero) return;
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.pageYOffset || 0, h = hero.offsetHeight;
    if (y > h + 200) return;
    for (var i = 0; i < els.length; i++) {
      var s = parseFloat(els[i].getAttribute('data-plx')) || 0;
      els[i].style.transform = 'translate3d(0,' + (y * s).toFixed(1) + 'px,0)';
    }
    var wrap = hero.querySelector('.wrap');
    if (wrap) wrap.style.opacity = Math.max(0, 1 - y / (h * 0.9)).toFixed(3);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
