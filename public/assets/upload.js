/* File upload for extended abstract / full paper (and organisers' templates): choose or drop a file, see progress.
   <div class="udrop" data-up="ext" data-base="" data-csrf="…" data-max="10" [data-url="/admin/templates/ext"]> with an <input type=file> inside */
(function () {
  'use strict';
  var T = function (s) { return (window.T && window.T[s]) || s; };
  document.querySelectorAll('.udrop[data-up]').forEach(function (box) {
    var input = box.querySelector('input[type=file]'), bar = box.querySelector('.ubar'), fill = bar && bar.querySelector('i'), msg = box.querySelector('.umsg');
    var max = (+box.getAttribute('data-max') || 10) * 1048576, url = box.getAttribute('data-url') || (box.getAttribute('data-base') + '/account/upload/' + box.getAttribute('data-up'));
    var accept = (input.getAttribute('accept') || '').split(',').filter(function (x) { return x.charAt(0) === '.'; });
    function say(t, cls) { msg.textContent = t; msg.className = 'umsg ' + (cls || ''); }
    function send(file) {
      if (!file) return;
      var ext = '.' + file.name.toLowerCase().split('.').pop();
      if (accept.length && accept.indexOf(ext) < 0) return say(T('Please choose a file of this type:') + ' ' + accept.join(', '), 'err');
      if (file.size > max) return say(T('The file is too large. The limit is') + ' ' + Math.round(max / 1048576) + ' MB.', 'err');
      var x = new XMLHttpRequest(); x.open('POST', url);
      x.setRequestHeader('Content-Type', 'application/octet-stream'); x.setRequestHeader('X-CSRF', box.getAttribute('data-csrf')); x.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      bar.hidden = false; fill.style.width = '0'; say(T('Uploading…'));
      x.upload.onprogress = function (e) { if (e.lengthComputable) fill.style.width = Math.round(100 * e.loaded / e.total) + '%'; };
      x.onload = function () {
        var j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
        if (x.status === 200 && j.ok) { fill.style.width = '100%'; say(T('Uploaded. Thank you!'), 'ok'); setTimeout(function () { location.reload(); }, 700); }
        else { bar.hidden = true; say(j.error || T('The upload did not work. Please try again.'), 'err'); }
      };
      x.onerror = function () { bar.hidden = true; say(T('The upload did not work. Check your connection and try again.'), 'err'); };
      x.send(file);
    }
    input.addEventListener('change', function () { send(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.remove('over'); }); });
    box.addEventListener('drop', function (e) { send(e.dataTransfer.files[0]); });
  });
})();
