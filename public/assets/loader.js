/* Loading cover for slow form submits and navigation only: never on first paint, and only once a wait passes 0.5 s. */
(function () {
  var d = document, root = d.documentElement, el;
  try {
    el = d.createElement('div');
    el.id = 'qh-load'; el.className = ''; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    // a hexagonal unit cell: six gold atoms light up in turn around the central one
    var at = '', i, ang;
    for (i = 0; i < 6; i++) { ang = Math.PI / 3 * i - Math.PI / 2; at += '<circle class="la" style="animation-delay:' + (i * 0.18).toFixed(2) + 's" cx="' + (40 + 26 * Math.cos(ang)).toFixed(1) + '" cy="' + (40 + 26 * Math.sin(ang)).toFixed(1) + '" r="5"/>'; }
    el.innerHTML = '<svg class="lcell" viewBox="0 0 80 80" aria-hidden="true"><polygon points="40,14 62.5,27 62.5,53 40,66 17.5,53 17.5,27"/><line x1="40" y1="40" x2="40" y2="14"/><line x1="40" y1="40" x2="62.5" y2="53"/><line x1="40" y1="40" x2="17.5" y2="53"/>' + at + '<circle class="lc" cx="40" cy="40" r="6"/></svg>' +
      '<div class="qh-word"><span class="lg" aria-hidden="true"><span class="lg-1">ICSSST<i>2027</i></span></span></div><div class="qh-msg" id="qh-msg">Loading</div>';
    root.appendChild(el);
  } catch (e) { return; }
  var timer, wait;
  function show(msg) {
    clearTimeout(timer); clearTimeout(wait);
    wait = setTimeout(function () {                // quick responses never flash a cover over the page
      var m = d.getElementById('qh-msg'); if (m && msg) m.textContent = msg;
      el.className = 'show';
      timer = setTimeout(hide, 45000);            // failsafe: never trap the visitor
    }, 500);
  }
  function hide() { clearTimeout(timer); clearTimeout(wait); if (el.className === 'show') el.className = 'hide'; }
  window.addEventListener('pageshow', hide);   // back/forward cache
  d.addEventListener('submit', function (e) {
    var f = e.target; if (e.defaultPrevented || !f || f.hasAttribute('data-noload')) return;
    var a = (f.getAttribute('action') || '');
    var msg = /register\/resend|register$|\/register(\?|$)/.test(a) || f.querySelector('[name=captcha]') ? 'Sending your verification code…' : 'Please wait…';
    if (/\/login(\/resend)?$/.test(a)) msg = 'Sending your sign-in code…';
    if (/verify/.test(a)) msg = 'Verifying…';
    setTimeout(function () { if (!e.defaultPrevented) show(msg); }, 0);
  }, true);
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (a.target && a.target !== '_self' || a.hasAttribute('download') || a.hasAttribute('data-noload')) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) return;   // same-page anchors
    if (/\.(csv|pdf|zip|png|jpe?g|svg)$/i.test(u.pathname)) return;
    show('Loading');
  }, true);
})();
