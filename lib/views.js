'use strict';
const cfg = require('../config');
const B = cfg.base;
const av = require('./assetv');
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SITE = cfg.siteUrl.replace(/\/+$/, '');
const DESC = `${cfg.eventName}, the ${cfg.eventFull}. Theme: ${cfg.eventSub}. ${cfg.eventDateText}, ${cfg.eventVenue}. Register and pay online.`;
function jsonLd(performers) {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Event',
    name: `${cfg.eventFull} (${cfg.eventName})`,
    description: `${cfg.eventFull}. Theme: ${cfg.eventSub}.`,
    startDate: cfg.eventDate || '2027-09-06', endDate: cfg.eventEndDate || cfg.eventDate || '2027-09-08',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'en',
    url: `${SITE}/`, image: [`${SITE}/assets/og-image.png`],
    location: { '@type': 'Place', name: cfg.eventVenue,
      address: { '@type': 'PostalAddress', streetAddress: cfg.venueAddress || undefined, addressLocality: 'Penang', addressCountry: 'MY' } },
    organizer: [{ '@type': 'Organization', name: 'Malaysian Solid State Science and Technology Society (MASS)' }, { '@type': 'CollegeOrUniversity', name: 'Universiti Sains Malaysia', url: 'https://www.usm.my' }],
    offers: (cfg.fees || []).map((f) => { const m = /^(RM|USD)\s*([\d,.]+)/i.exec(f.fee); return m ? { '@type': 'Offer', name: f.name, price: m[2].replace(/,/g, ''), priceCurrency: m[1].toUpperCase() === 'RM' ? 'MYR' : 'USD', url: `${SITE}/register` } : null; }).filter(Boolean),
    performer: (performers || []).map((p) => ({ '@type': 'Person', name: p.full_name, ...(p.affiliation ? { affiliation: { '@type': 'Organization', name: p.affiliation } } : {}) })),
  }).replace(/</g, '\\u003c');
}
function head(title, desc, o = {}) {
  const d = desc || DESC, url = `${SITE}${o.path || '/'}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(d)}">
<meta name="robots" content="${o.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">
${o.noindex ? '' : `<link rel="canonical" href="${e(url)}">`}
${cfg.googleVerification ? `<meta name="google-site-verification" content="${e(cfg.googleVerification)}">` : ''}
<meta name="theme-color" content="#12285C">
<link rel="icon" href="${B}/favicon.svg" type="image/svg+xml"><link rel="icon" href="${B}/favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="${B}/assets/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="${e(cfg.eventName)}">
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(d)}">
<meta property="og:url" content="${e(url)}"><meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="en_MY">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(d)}"><meta name="twitter:image" content="${SITE}/assets/og-image.png">
${o.ld ? `<script type="application/ld+json">${jsonLd(o.performers)}</script>` : ''}
<link rel="preload" href="${B}/assets/fonts/pagella-regular.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="${B}/assets/fonts/pagella-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${B}/assets/site.css?v=${av('site.css')}">
<script src="${B}/assets/loader.js?v=${av('loader.js')}"></script>
<script src="${B}/assets/select.js?v=${av('select.js')}" defer></script>
<script src="${B}/assets/parallax.js?v=${av('parallax.js')}" defer></script>
${o.ld ? `<script src="${B}/assets/lattice.js?v=${av('lattice.js')}" defer></script>` : ''}
</head><body>
${cfg.announcementOn && cfg.announcementText ? `<div class="announce" role="status">${e(cfg.announcementText)}</div>` : ''}
<header class="top"><div class="wrap">
  <a class="brand" href="${B}/" aria-label="${e(cfg.eventName)} — home">${BRAND_LOGOS()}${LOGO}</a>
  <nav><a href="${B}/#about">About</a><a href="${B}/#topics">Topics</a><a href="${B}/#programme">Programme</a><a href="${B}/#fees">Fees</a><a href="${B}/account">My registration</a><a class="pill" href="${B}/register">Register</a></nav>
</div></header>`;
}
function foot() {
  return `<section class="partners"><div class="wrap row">
  <div class="pgroup"><span class="label">Organised by</span><div class="logos"><span class="ptxt">Malaysian Solid State Science<br>and Technology Society (MASS)</span></div></div>
  <div class="pgroup"><span class="label">Hosted by</span><div class="logos">
    <img class="us" src="${B}/assets/usm-apex.png" alt="Universiti Sains Malaysia (APEX)"><img class="sp" src="${B}/assets/sop.png" alt="School of Physics, USM">
  </div></div>
  <div class="pgroup"><span class="label">Payments by</span><div class="logos"><span class="ptxt">Ticket2U<br><small>FPX · cards · e-wallets</small></span></div></div>
</div></section>
<footer class="f"><div class="wrap"><span>© 2027 ${e(cfg.eventName)} · ${e(cfg.eventFull)}</span><nav class="flinks" aria-label="Footer"><a href="${B}/privacy">Privacy Policy</a><a href="${B}/terms">Terms &amp; Refunds</a><a href="${B}/account">My registration</a><a href="${B}/speaker">Speaker portal</a><a href="${B}/admin/login">Organiser login</a></nav></div></footer>
</body></html>`;
}

const BRAND_LOGOS = (w) => `<span class="bl" aria-hidden="true"><img class="bl-s" src="${B}/assets/sop${w ? '-w' : ''}.png" alt="" width="38" height="40"><img class="bl-u" src="${B}/assets/usm${w ? '-w' : ''}.png" alt="" width="117" height="36"><i></i></span>`;
const LOGO = `<span class="lg" role="img" aria-label="ICSSST 2027"><span class="lg-1" aria-hidden="true">ICSSST<i>2027</i></span><span class="lg-2" aria-hidden="true">Solid State Science &amp; Technology</span></span>`;
const nl2br = (t) => e(t).replace(/\n+/g, '<br>');
function venueSection() {
  const m = cfg.map || {}; if (!m.open) return '';
  return `<section class="s" id="venue"><div class="wrap grid2">
  <div class="sec-label"><span class="num">06</span><h2>Venue</h2></div>
  <div class="venue">
    <h3 class="vn-t">${e(cfg.eventVenue)}</h3>
    ${cfg.venueAddress ? `<p class="vn-a">${nl2br(cfg.venueAddress)}</p>` : ''}
    ${cfg.venueDetails ? `<div class="vn-d">${nl2br(cfg.venueDetails)}</div>` : ''}
    <div class="vn-b"><a class="btn" href="${e(m.open)}" target="_blank" rel="noopener">Open in Google Maps <span class="arr">↗</span></a><a class="b2l" href="${e(m.dir)}" target="_blank" rel="noopener">Get directions</a>${cfg.venueAddress ? `<button type="button" class="b2l" id="cpAddr" data-addr="${e([cfg.eventVenue, cfg.venueAddress].filter(Boolean).join(', '))}">Copy address</button>` : ''}</div>
    <div class="vn-map"><iframe title="Map of ${e(cfg.eventVenue)}" src="${e(m.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
  </div>
</div></section>
<script>(function(){var b=document.getElementById('cpAddr');if(!b)return;b.addEventListener('click',function(){var t=b.getAttribute('data-addr'),o=b.textContent;function ok(){b.textContent='Copied ✓';setTimeout(function(){b.textContent=o},1800)}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,function(){});else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(x){}a.remove()}})})();</script>`;
}
const TOPICS = ['Nanoscience and Nanotechnology', 'Quantum Optics', 'Optics and Photonics', 'Superconductivity and Magnetism', 'Ferroelectrics and Dielectrics', 'Metamaterials and Computational Materials Science', 'Polymers and Composites', 'Nuclear Materials', 'Smart Materials', 'Semiconductors and Electronic Devices', 'Solid-State Spectroscopy', 'Materials for Energy Conversion and Storage', 'Sustainable Materials and Green Technology', 'Other Topics Related to Solid-State Technology and Its Applications'];
const SDGS = [['4', 'Quality Education', '#C5192D'], ['7', 'Affordable and Clean Energy', '#C99700'], ['9', 'Industry, Innovation and Infrastructure', '#E5551E'], ['13', 'Climate Action', '#3F7E44']];
const hm = (x) => (x ? x.slice(0, 2) + ':' + x.slice(2) : '');
function feesSection() {
  const fees = cfg.fees || [], ends = cfg.earlyBirdEnds ? new Date(Date.parse(cfg.earlyBirdEnds) + 8 * 3600e3) : null;
  const endTxt = ends ? ends.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  return `<section class="s" id="fees"><div class="wrap grid2">
  <div class="sec-label"><span class="num">04</span><h2>Registration fee</h2></div>
  <div>
    <p class="lead">Register on this site, then <em>pay securely</em> through Ticket2U.</p>
    <ol class="fees">${fees.map((f, i) => `<li class="${f.early ? 'eb' : ''}${f.early && !settings.earlyOpen() ? ' gone' : ''}"><span class="fn">${i + 1}</span><span class="fc">${e(f.name)}${f.early ? `<small>${settings.earlyOpen() ? (endTxt ? 'Until ' + e(endTxt) : 'Limited period') : 'Closed'}</small>` : ''}</span><span class="fp">${e(f.fee)}</span></li>`).join('')}</ol>
    <div class="paysteps">
      <div><b>1</b><span><strong>Register</strong>Create your registration and choose your fee category.</span></div>
      <div><b>2</b><span><strong>Pay with Ticket2U</strong>Sign in to your registration page and press Pay. FPX online banking, cards and e-wallets are accepted.</span></div>
      <div><b>3</b><span><strong>Confirmed</strong>Once the organisers match your payment, your page shows <em>Paid</em> and you receive an email.</span></div>
    </div>
  </div>
</div></section>`;
}
function programmeSection() {
  const { ROOMS, DAYS } = require('./programme');
  const days = (cfg.eventDays || []).slice(0, DAYS.length);
  if (!days.length) return '';
  const dl = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const talk = ([t0, t1, code, track, name]) => `<li class="${/^INV/.test(code) ? 'inv' : ''}"><time>${hm(t0)}${t1 ? '–' + hm(t1) : ''}</time><div>${code ? `<span class="cd">${e(code)}</span>` : ''}<b>${e(name)}</b><small>${e(track)}</small></div></li>`;
  const block = (k) => {
    const time = `<time class="bt">${hm(k.time[0])}${k.time[1] ? '–' + hm(k.time[1]) : ''}</time>`;
    if (k.kind === 'parallel') return `<div class="pb par">${time}<div class="pbody"><h4>${e(k.title)}</h4><div class="rooms">${k.rooms.map((list, i) => list.length ? `<div class="room"><span class="rn">${e(ROOMS[i])}</span><ul>${list.map(talk).join('')}</ul></div>` : '').join('')}</div></div></div>`;
    return `<div class="pb ${k.kind}">${time}<div class="pbody"><h4>${e(k.title)}</h4>${k.who ? `<p class="who">${e(k.who)}</p>` : ''}${k.where ? `<p class="wh">${e(k.where)}</p>` : ''}</div></div>`;
  };
  return `<section class="s" id="programme"><div class="wrap grid2">
  <div class="sec-label"><span class="num">03</span><h2>Programme</h2></div>
  <div class="prog">
    <p class="note">Tentative programme — subject to change. Invited talks are marked <span class="cd inv">INV</span>.</p>
    <div class="dtabs" role="tablist">${days.map((d, i) => `<button type="button" role="tab" id="dt${i}" aria-controls="dp${i}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}><span>Day ${i + 1}</span>${e(dl(d))}</button>`).join('')}</div>
    ${days.map((d, i) => `<div class="dpanel" role="tabpanel" id="dp${i}" aria-labelledby="dt${i}"${i ? ' hidden' : ''}>${DAYS[i].blocks.map(block).join('')}</div>`).join('')}
  </div>
</div></section>
<script>(function(){var t=[].slice.call(document.querySelectorAll('.dtabs button'));function go(i){t.forEach(function(b,j){var on=i===j;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;document.getElementById('dp'+j).hidden=!on})}t.forEach(function(b,i){b.addEventListener('click',function(){go(i)});b.addEventListener('keydown',function(ev){var k=ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0;if(k){var n=(i+k+t.length)%t.length;go(n);t[n].focus()}})})})();</script>`;
}
function home({ left, open, speakersHtml, performers }) {
  const cta = open
    ? `<a class="btn" href="${B}/register">Register now <span class="arr">→</span></a><a class="b2l" href="${B}/account">Already registered? Pay or check status</a>`
    : `<span class="btn" style="opacity:.45;cursor:default">Registration closed</span><a class="b2l" href="${B}/account">My registration</a>`;
  return head(`${cfg.eventName} — ${cfg.eventFull} | ${cfg.eventDateText}, Penang`, '', { path: '/', ld: true, performers }) + `
<main>
<section class="hero">
  <div class="hero-glow plx" data-plx="0.10" aria-hidden="true"></div>
  <div class="wrap hgrid">
  <div>
  <span class="label">11th International Conference &nbsp;|&nbsp; Penang 2027</span>
  <h1 class="plx" data-plx="-0.05"><span class="h-1">Solid State Science</span><span class="h-2"><em>and</em> Technology</span></h1>
  <p class="theme"><span>Theme</span>${e(cfg.eventSub)}</p>
  <div class="cta">${cta}</div>
  </div>
  <img class="hero-logo plx" data-plx="0.04" src="${B}/assets/icssst-logo.png" width="1000" height="625" alt="ICSSST 2027 — International Conference on Solid State Science and Technology, Penang, Malaysia">
</div></section>

<div class="meta" id="details"><div class="wrap">
  <div class="cell"><span class="label">Dates</span><div class="v">${e(cfg.eventWeekday)},<br>${e(cfg.eventDateText)}</div></div>
  <div class="cell"><span class="label">Venue</span><div class="v">${e(cfg.eventVenue)}</div>${cfg.map && cfg.map.open && cfg.venueAddress ? '<a class="vlink" href="#venue">Map &amp; directions <span>→</span></a>' : ''}</div>
  <div class="cell"><span class="label">Organiser</span><div class="v">Malaysian Solid State Science and Technology Society</div></div>
</div></div>

<section class="s" id="about"><div class="wrap grid2">
  <div class="sec-label"><span class="num">01</span><h2>About</h2></div>
  <div>
    <p class="lead">Malaysia’s high-tech era: innovation in <em>nanotechnology, AI and semiconductors</em>.</p>
    <p class="body-txt">The 11th International Conference on Solid State Science and Technology brings researchers, students and industry together in Penang, the heart of Malaysia’s semiconductor industry, to share advances in materials, devices and the physics behind them. Three days of plenary and keynote lectures, invited and oral talks in four parallel rooms, posters, technical sessions and product demonstrations.</p>
    <div class="sdg" aria-label="Sustainable Development Goals">${SDGS.map(([n, t, c]) => `<span style="--c:${c}"><b>${n}</b>${e(t)}</span>`).join('')}</div>
  </div>
</div></section>

<section class="s" id="topics"><div class="wrap grid2">
  <div class="sec-label"><span class="num">02</span><h2>Conference topics</h2></div>
  <ol class="tlist">${TOPICS.map((t) => `<li>${e(t)}</li>`).join('')}</ol>
</div></section>

${programmeSection()}
${feesSection()}
${speakersHtml || ''}
${venueSection()}

<section class="band"><div class="wrap">
  <h2>See you in <em>Penang</em>, ${e(cfg.eventDateText.replace(/ \d{4}$/, ''))}.</h2>
  ${open ? `<div class="cta"><a class="btn" href="${B}/register">Register now <span class="arr">→</span></a></div>` : ''}
</div></section>
</main>` + foot();
}

const INST = require('./institutions');
const settings = require('./settings');
const GLOGO = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

function register({ errors = [], v = {}, left, cats, csrf, now, google = null, googleOn = false }) {
  const closed = !settings.isOpen() || left <= 0;
  const showForm = !!google || cfg.allowEmail;
  const gbox = closed || google || !googleOn ? '' : `<div class="gbox"><a class="gbtn" href="${B}/auth/google">${GLOGO}<span>Continue with Google</span></a><p>Fastest way: no email code needed. Your Gmail address is verified by Google.</p>${cfg.allowEmail ? '<div class="or"><span>or register with an email code</span></div>' : ''}</div>`;
  const form = closed ? `<div class="err" style="align-self:start">Registration is closed.</div>` : (!showForm ? `<div class="f gonly">${errors.length ? `<div class="err" role="alert"><ul>${errors.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : ''}${gbox}</div>` : `
  <form class="f" method="post" action="${B}/register" novalidate autocomplete="on">
    ${errors.length ? `<div class="err" role="alert"><ul>${errors.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : ''}
    ${gbox}
    <input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="ts" value="${now}">
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    ${google ? `<div class="gok"><span>${GLOGO}</span><div><b>Signed in with Google</b><small>${e(google.email)} · email verified</small></div><a href="${B}/auth/google/logout">Change</a></div>` : ''}
    <div class="fld"><label class="l" for="full_name">Full name</label>
      <input type="text" id="full_name" name="full_name" required maxlength="120" autocomplete="name" placeholder="As it should appear on your certificate" value="${e(v.full_name)}"></div>
    <div class="two">
      <div class="fld"><label class="l" for="email">Email</label>
        <input type="email" id="email" name="email" required maxlength="160" autocomplete="email" placeholder="name@institution.edu" value="${e(v.email)}" ${google ? 'readonly aria-readonly="true" class="ro"' : ''}></div>
      <div class="fld"><label class="l" for="phone">Phone <span style="opacity:.6;letter-spacing:.1em">(optional)</span></label>
        <input type="tel" id="phone" name="phone" maxlength="30" autocomplete="tel" placeholder="+60 12 345 6789" value="${e(v.phone)}"></div>
    </div>
    <div class="fld"><label class="l" for="organisation">Institution / Organisation</label>
      <div class="combo">
        <input type="text" id="organisation" name="organisation" required maxlength="160" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="orgList" aria-autocomplete="list" placeholder="Start typing, e.g. Universiti Sains Malaysia" value="${e(v.organisation)}">
        <input type="hidden" name="org_custom" id="org_custom" value="${v.org_custom ? '1' : '0'}"><input type="hidden" name="js" id="js" value="">
        <ul id="orgList" role="listbox" hidden></ul>
      </div>
      <p class="hint" id="orgHint">Choose your institution from the list so every name is spelled the same. Can’t find it? Select “My institution isn’t listed”.</p></div>
    <div class="fld"><label class="l" id="catl">Registration category &amp; fee</label>
      <div class="feechips" role="radiogroup" aria-labelledby="catl">
        ${settings.availableFees().map((f, i) => `<input type="radio" name="category" id="c${i}" value="${e(f.name)}" ${v.category === f.name ? 'checked' : ''} required><label for="c${i}"><span>${e(f.name)}</span><b>${e(f.fee)}</b></label>`).join('')}
      </div>
      <p class="hint">You pay after registering, on your registration page, through Ticket2U. MASS membership and student status may be checked.</p></div>
    <div class="fld"><label class="l" for="country">Country</label>
      <select id="country" name="country" required autocomplete="country-name">
        <option value="">Select your country…</option>${INST.countries.map((c) => `<option value="${e(c)}" ${v.country === c ? 'selected' : ''}>${e(c)}</option>`).join('')}
      </select></div>
    ${google ? '' : `<div class="fld"><label class="l" for="captcha">Verification</label>
      <div class="cap">
        <img id="capimg" src="${B}/captcha.svg?r=${now}" alt="Verification code image" width="190" height="62">
        <input type="text" id="captcha" name="captcha" required maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code">
        <button type="button" id="capnew" aria-label="Show a new code">New code</button>
      </div></div>`}
    <label class="consent"><input type="checkbox" name="consent" value="1" ${v.consent ? 'checked' : ''}>
      <span>I agree that my details may be used by the organisers for registration, communication and certificates for this event.</span></label>
    <button class="btn" type="submit">${google ? 'Register &amp; continue to payment' : 'Send verification code'} <span class="arr">→</span></button>
  </form>`);
  return head(`Register — ${cfg.eventName}, ${cfg.eventDateText}`, `Register for ${cfg.eventName}, the ${cfg.eventFull}, ${cfg.eventDateText}, Penang, Malaysia. Pay online with Ticket2U.`, { path: '/register' }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <span class="label">Registration</span>
    <h1>Register for<br>ICSSST <em>2027</em>.</h1>
    <p>Fill in your details and choose your fee category. After registering you land on your own registration page, where you pay with Ticket2U and can check your payment status at any time.</p>
    <p class="already">Already registered? <a href="${B}/login">Sign in to pay or check your status →</a></p>
    <div class="facts">
      <div><span>Event</span><span>${e(cfg.eventFull)}</span></div>
      <div><span>Date</span><span>${e(cfg.eventDateText)}</span></div>
      <div><span>Venue</span><span>${e(cfg.eventVenue)}${cfg.map && cfg.map.open ? ` <a href="${e(cfg.map.open)}" target="_blank" rel="noopener" style="white-space:nowrap">Map ↗</a>` : ''}</span></div>
      ${cfg.showSeatsLeft ? `<div><span>Seats left</span><span>${left} of ${cfg.seatLimit}</span></div>` : ''}
    </div>
  </aside>
  ${form}
</div></main>
<script src="${B}/assets/institution.js?v=${av('institution.js')}" defer></script>
<script>
document.getElementById('capnew')?.addEventListener('click',function(){
  document.getElementById('capimg').src='${B}/captcha.svg?r='+Date.now(); var c=document.getElementById('captcha'); c.value=''; c.focus();
});
</script>` + foot();
}

function done(ref, name, email) {
  return head(`Registration confirmed — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="done"><div class="wrap">
  <span class="label">Registration confirmed</span>
  <h1>Thank you, ${e(String(name).trim().split(' ')[0])}.</h1>
  <p class="body-txt" style="margin:0 0 26px">You are registered for ${e(cfg.eventName)} on ${e(cfg.eventDateText)}. A confirmation email has been sent${email ? ' to <b>' + e(email) + '</b>' : ''} — please keep it and your reference number, you may be asked for it on the day.</p>
  <div class="refbox"><span class="label">Your reference</span><b>${e(ref)}</b></div><br>
  <a class="btn" href="${B}/">Back to event page <span class="arr">→</span></a>
</div></main>` + foot();
}


function verifyCode({ masked, csrf, error = '', info = '', wait = 0 }) {
  return head(`Verify your email — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <span class="label">Step 2 of 2</span>
    <h1>Check your<br>inbox.</h1>
    <p>We sent a 6-digit code to <b>${e(masked)}</b>. Enter it to complete your registration. The code is valid for ${cfg.codeMinutes} minutes.</p>
    <div class="facts"><div><span>Tip</span><span>Check spam / junk if you don't see it</span></div></div>
  </aside>
  <div>
  <form class="f" method="post" action="${B}/register/verify" novalidate autocomplete="off">
    ${error ? `<div class="err" role="alert">${e(error)}</div>` : ''}
    ${info ? `<div class="err" style="background:#EEF6EF;border-color:#2F7D45;color:#1F5130" role="status">${e(info)}</div>` : ''}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="code">Verification code</label>
      <input type="text" id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus required placeholder="······" style="font-size:38px;letter-spacing:.5em;text-align:left;font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif"></div>
    <button class="btn" type="submit">Verify &amp; register <span class="arr">→</span></button>
  </form>
  <div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:22px;font-size:14px">
    <form method="post" action="${B}/register/resend"><input type="hidden" name="csrf" value="${e(csrf)}"><button id="rs" type="submit" style="background:none;border:0;cursor:pointer;color:var(--navy);text-decoration:underline;font:500 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif" ${wait > 0 ? 'disabled' : ''}>Resend code${wait > 0 ? ` (<span id="w">${wait}</span>s)` : ''}</button></form>
    <form method="post" action="${B}/register/cancel"><input type="hidden" name="csrf" value="${e(csrf)}"><button type="submit" style="background:none;border:0;cursor:pointer;color:var(--muted);text-decoration:underline;font:400 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif">Use a different email</button></form>
  </div></div>
</div></main>
<script>
(function(){var w=document.getElementById('w'),b=document.getElementById('rs');if(w){var n=parseInt(w.textContent,10),t=setInterval(function(){n--;if(n<=0){clearInterval(t);b.disabled=false;b.textContent='Resend code'}else w.textContent=n},1000)}
var c=document.getElementById('code');c.addEventListener('input',function(){c.value=c.value.replace(/\D/g,'').slice(0,6)})})();
</script>` + foot();
}

function verify(ref, row) {
  const ok = row && row.cert_issued_at;
  return head(`Certificate verification — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="done"><div class="wrap">
  <span class="label">Certificate verification</span>
  ${ok ? `<h1>Verified.</h1>
    <p class="body-txt" style="margin:0 0 26px">This certificate was issued to <b>${e(row.full_name)}</b> (${e(row.organisation)}) for participation in ${e(cfg.eventName)}, ${e(cfg.eventDateText)}.</p>
    <div class="refbox"><span class="label">Certificate no.</span><b>${e(ref)}</b></div>`
    : `<h1>Not found.</h1><p class="body-txt" style="margin:0">No issued certificate matches this reference.</p>`}
</div></main>` + foot();
}

// ── participant: sign in (Google or emailed code) and “My registration” with Ticket2U payment ──
const STATUS = { unpaid: ['Payment due', 'due'], claimed: ['Payment being checked', 'chk'], paid: ['Paid', 'ok'], waived: ['No payment needed', 'ok'] };
const myDate = (iso) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : '');
const flashBox = (fl) => (fl && (fl.ok || (fl.err && fl.err.length)) ? (fl.ok ? `<div class="okmsg" role="status">${e(fl.ok)}</div>` : '') + (fl.err && fl.err.length ? `<div class="err" role="alert"><ul>${fl.err.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : '') : '');

function login({ csrf, email = '', err = '', googleOn = false, info = '' }) {
  return head(`Sign in — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <span class="label">My registration</span>
    <h1>Sign in to<br><em>pay</em> or check.</h1>
    <p>Use the email address you registered with. We email you a 6-digit code, so there is no password to remember.</p>
    <p class="already">Not registered yet? <a href="${B}/register">Register for ${e(cfg.eventName)} →</a></p>
  </aside>
  <div class="f">
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}${info ? `<div class="okmsg" role="status">${e(info)}</div>` : ''}
    ${googleOn ? `<div class="gbox"><a class="gbtn" href="${B}/auth/google?next=account">${GLOGO}<span>Continue with Google</span></a><p>If you registered with a Gmail address.</p><div class="or"><span>or get a code by email</span></div></div>` : ''}
    <form method="post" action="${B}/login" novalidate>
      <input type="hidden" name="csrf" value="${e(csrf)}">
      <div class="fld"><label class="l" for="email">Email</label><input type="email" id="email" name="email" required maxlength="160" autocomplete="email" value="${e(email)}" placeholder="The address you registered with"></div>
      <button class="btn" type="submit">Email me a sign-in code <span class="arr">→</span></button>
    </form>
  </div>
</div></main>` + foot();
}

function loginCode({ csrf, masked, err = '', info = '', wait = 0 }) {
  return head(`Enter your code — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <span class="label">Sign in</span>
    <h1>Check your<br>inbox.</h1>
    <p>If <b>${e(masked)}</b> is registered, a 6-digit code is on its way. It is valid for ${cfg.codeMinutes} minutes. Check spam or junk if it does not arrive.</p>
  </aside>
  <div>
  <form class="f" method="post" action="${B}/login/verify" novalidate autocomplete="off">
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}${info ? `<div class="okmsg" role="status">${e(info)}</div>` : ''}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="code">Sign-in code</label>
      <input type="text" id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus required placeholder="······" class="codein"></div>
    <button class="btn" type="submit">Sign in <span class="arr">→</span></button>
  </form>
  <div class="links2">
    <form method="post" action="${B}/login/resend"><input type="hidden" name="csrf" value="${e(csrf)}"><button id="rs" type="submit" class="lnk" ${wait > 0 ? 'disabled' : ''}>Send a new code${wait > 0 ? ` (<span id="w">${wait}</span>s)` : ''}</button></form>
    <a class="lnk mut" href="${B}/login">Use a different email</a>
  </div></div>
</div></main>
<script>(function(){var w=document.getElementById('w'),b=document.getElementById('rs');if(w){var n=parseInt(w.textContent,10),t=setInterval(function(){n--;if(n<=0){clearInterval(t);b.disabled=false;b.textContent='Send a new code'}else w.textContent=n},1000)}
var c=document.getElementById('code');c.addEventListener('input',function(){c.value=c.value.replace(/\D/g,'').slice(0,6)})})();</script>` + foot();
}

function account({ r, csrf, flash: fl, payUrl, welcome = false }) {
  const st = STATUS[r.pay_status] || STATUS.unpaid, fees = settings.availableFees();
  const canChange = r.pay_status === 'unpaid' && fees.length > 1;
  const first = String(r.full_name).trim().split(/\s+/)[0];
  let pay;
  if (r.pay_status === 'paid') pay = `<p class="pdone">Your payment${r.pay_amount ? ` of <b>${e(r.pay_amount)}</b>` : ''} was confirmed on <b>${e(myDate(r.paid_at))}</b>${r.pay_ref ? `, Ticket2U order <b>${e(r.pay_ref)}</b>` : ''}. Your official receipt / e-invoice is in the Ticket2U email you received when you paid.</p>`;
  else if (r.pay_status === 'waived') pay = `<p class="pdone">The organisers have marked your registration as not requiring payment${r.pay_note ? ` (${e(r.pay_note)})` : ''}.</p>`;
  else {
    const btn = payUrl
      ? `<a class="btn" href="${e(payUrl)}" target="_blank" rel="noopener">Pay ${e(r.fee || '')} with Ticket2U <span class="arr">↗</span></a>`
      : `<span class="btn" style="opacity:.45;cursor:default">Payment opens soon</span>`;
    pay = `${r.pay_status === 'claimed' ? `<p class="pchk">Thank you. You told us you paid${r.pay_ref ? ` with Ticket2U order <b>${e(r.pay_ref)}</b>` : ''} on ${e(myDate(r.pay_claimed_at))}. We are matching it with Ticket2U’s records; this page and your email will show <b>Paid</b> once confirmed, usually within a few working days.</p>` : ''}
    <ol class="psteps">
      <li><b>Open Ticket2U.</b> The button opens the ${e(cfg.eventName)} page on Ticket2U in a new tab. Choose the ticket <b>“${e(r.category)}”</b>.</li>
      <li><b>Use the same details.</b> Give the email <b>${e(r.email)}</b> and, if Ticket2U asks, your reference <b>${e(r.ref)}</b>. This is how we match your payment.</li>
      <li><b>Pay</b> by FPX online banking, card or e-wallet. Ticket2U emails you an e-ticket and receipt.</li>
      <li><b>Come back here</b> and enter your Ticket2U order number below, so we can confirm it faster.</li>
    </ol>
    <div class="cta">${btn}<button type="button" class="b2l" id="cpRef" data-ref="${e(r.ref)}">Copy reference ${e(r.ref)}</button></div>
    ${!payUrl ? '<p class="hint">The organisers have not opened online payment yet. We will email you when it opens.</p>' : ''}
    ${cfg.paymentNote ? `<div class="pnote">${nl2br(cfg.paymentNote)}</div>` : ''}
    <form class="claim" method="post" action="${B}/account/paid" novalidate>
      <input type="hidden" name="csrf" value="${e(csrf)}">
      <label class="l" for="order">${r.pay_status === 'claimed' ? 'Change your Ticket2U order number' : 'Already paid? Ticket2U order number'}</label>
      <div class="row1"><input type="text" id="order" name="order" maxlength="40" autocomplete="off" placeholder="e.g. T2U12345678" value="${e(r.pay_status === 'claimed' ? r.pay_ref || '' : '')}"><button class="b2" type="submit">${r.pay_status === 'claimed' ? 'Update' : 'I have paid'}</button></div>
      <p class="hint">Find it in the confirmation email from Ticket2U, or in “My Tickets” on ticket2u.com.my.</p>
    </form>`;
  }
  return head(`My registration — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg acct"><div class="wrap grid">
  <aside>
    <span class="label">My registration</span>
    <h1>${welcome ? 'You’re registered,' : 'Hello,'}<br><em>${e(first)}.</em></h1>
    <div class="facts">
      <div><span>Reference</span><span><b>${e(r.ref)}</b></span></div>
      <div><span>Name</span><span>${e(r.full_name)}</span></div>
      <div><span>Email</span><span>${e(r.email)}</span></div>
      <div><span>Organisation</span><span>${e(r.organisation)}</span></div>
      <div><span>Category</span><span>${e(r.category)}</span></div>
      <div><span>Fee</span><span>${e(r.fee || '—')}</span></div>
      <div><span>Registered</span><span>${e(myDate(r.created_at))}</span></div>
    </div>
    <form method="post" action="${B}/logout" style="margin-top:22px"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="lnk mut" type="submit">Sign out</button></form>
  </aside>
  <div>
    ${flashBox(fl)}
    <div class="paycard">
      <div class="phd"><span class="label">Payment</span><span class="pst ${st[1]}">${e(st[0])}</span></div>
      <div class="pamt"><span>${e(r.category)}</span><b>${e(r.fee || '')}</b></div>
      ${pay}
    </div>
    ${canChange ? `<details class="chg"><summary>Wrong category? Change it before you pay</summary>
      <form method="post" action="${B}/account/category"><input type="hidden" name="csrf" value="${e(csrf)}">
        <div class="feechips">${fees.map((f, i) => `<input type="radio" name="category" id="k${i}" value="${e(f.name)}" ${r.category === f.name ? 'checked' : ''}><label for="k${i}"><span>${e(f.name)}</span><b>${e(f.fee)}</b></label>`).join('')}</div>
        <button class="b2" type="submit">Save category</button></form></details>` : ''}
    <div class="evbox"><span class="label">The conference</span><p><b>${e(cfg.eventFull)}</b><br>${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)} · ${e(cfg.eventVenue)}</p><a class="b2l" href="${B}/#programme">View the programme →</a></div>
  </div>
</div></main>
<script>(function(){var b=document.getElementById('cpRef');if(!b)return;b.addEventListener('click',function(){var t=b.getAttribute('data-ref'),o=b.textContent;function ok(){b.textContent='Copied ✓';setTimeout(function(){b.textContent=o},1800)}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,function(){});})})();</script>` + foot();
}

const UPDATED = '9 November 2026';
const HOST = () => e(SITE.replace(/^https?:\/\//, ''));
const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    body: () => `
<p>This policy explains how the organising committee of <b>${e(cfg.eventName)}</b>, the ${e(cfg.eventFull)} (${e(cfg.eventDateText)}, Penang), organised by the Malaysian Solid State Science and Technology Society (MASS) and hosted by Universiti Sains Malaysia (“we”, “us”), handles personal data collected through <b>${HOST()}</b>.</p>
<h2>1. What we collect</h2>
<ul><li><b>Details you enter:</b> full name, email address, phone number (optional), institution or organisation, country and registration (fee) category.</li>
<li><b>Payment records:</b> the fee for your category, whether it has been paid, and the Ticket2U order number and amount. <b>We never see or store your card, bank or e-wallet details</b>; payments are made on Ticket2U’s own pages.</li>
<li><b>If you choose “Continue with Google”:</b> your Google account name and email address and whether Google has verified that address. Nothing else from your Google account.</li>
<li><b>Technical data:</b> a one-way hashed form of your IP address (to limit abuse) and a security cookie that keeps you signed in. No advertising or tracking cookies.</li></ul>
<h2>2. Why we use it</h2>
<ul><li>to register you, let you sign in to your registration page and pay your fee;</li>
<li>to match your Ticket2U payment to your registration and confirm it;</li>
<li>to contact you about the programme, venue and changes;</li>
<li>to prepare the attendance list, name badges and certificates.</li></ul>
<h2>3. Sharing</h2>
<p>We do not sell your data. It is accessible only to the organising committee. <b>Ticket2U</b> (Ticket2U Sdn. Bhd.) processes your payment under its own terms and privacy policy, using the details you give it at checkout. Our hosting and email provider (Zoho Mail) process data on our behalf only to run this site and send you emails. MASS membership may be checked with MASS.</p>
<h2>4. Google user data</h2>
<p>Information received from Google is used only to sign you in and pre-fill your name and email address. It is not used for advertising, not transferred to others, and not used to train AI models.</p>
<h2>5. Retention and your rights</h2>
<p>Records are kept as long as needed to run the conference, issue certificates and meet financial record-keeping obligations, and are then deleted or anonymised. You may ask to access, correct or delete your personal data, in line with the Personal Data Protection Act 2010 (PDPA), by emailing <a href="mailto:${e(cfg.smtp.replyTo)}">${e(cfg.smtp.replyTo)}</a>.</p>
<h2>6. Security</h2>
<p>Data is sent over HTTPS and stored on access-controlled servers; organiser access is password-protected.</p>
<h2>7. Contact</h2>
<p>${e(cfg.eventName)} organising committee · <a href="mailto:${e(cfg.smtp.replyTo)}">${e(cfg.smtp.replyTo)}</a></p>
<p class="upd">Last updated: ${UPDATED}</p>`,
  },
  terms: {
    title: 'Terms & Refunds',
    body: () => `
<p>These terms apply to your use of <b>${HOST()}</b> and to registration for <b>${e(cfg.eventName)}</b>, the ${e(cfg.eventFull)} (${e(cfg.eventDateText)}, Penang, Malaysia).</p>
<h2>1. Registration</h2>
<p>Each person registers once, with one email address, and chooses the fee category that applies to them. Please give accurate details; your name is printed on your badge and certificate as you enter it. Your registration is complete when your fee has been paid and confirmed (or waived by the organisers).</p>
<h2>2. Fees and categories</h2>
<p>Fees are shown on the website. MASS member, student and early-bird rates apply only to eligible participants; the organisers may ask for proof (for example a student card or MASS membership number) and may ask you to pay the difference if the wrong category was chosen. Early-bird rates apply only to payments made before the early-bird deadline.</p>
<h2>3. Payment</h2>
<p>Fees are paid online through <b>Ticket2U</b>, which accepts FPX online banking, cards and e-wallets and issues the receipt / e-invoice. Ticket2U’s own terms apply to the payment, and Ticket2U may charge a processing fee shown at checkout. Use the same email address as your registration so the payment can be matched. If your institution pays by purchase order (LO) or bank transfer, contact us before paying.</p>
<h2>4. Cancellation and refunds</h2>
<p>Requests to cancel must be emailed to <a href="mailto:${e(cfg.smtp.replyTo)}">${e(cfg.smtp.replyTo)}</a>. Refunds, where approved, are made through Ticket2U to the original payment method, less any non-refundable processing charges. A registration may be transferred to a colleague in the same category by emailing us before the conference. If the conference is cancelled by the organisers, fees will be refunded.</p>
<h2>5. Changes</h2>
<p>The programme, speakers, rooms and venue may change. Registered participants will be told by email.</p>
<h2>6. Certificates</h2>
<p>Certificates are issued to registered, paid participants who attend. Each certificate carries a reference number that can be checked on this website.</p>
<h2>7. Acceptable use and liability</h2>
<p>Do not submit false or another person’s details or try to disrupt the website. To the extent permitted by law, the organisers are not liable for losses arising from changes to the event or temporary unavailability of the website.</p>
<h2>8. Governing law and contact</h2>
<p>These terms are governed by the laws of Malaysia. Questions: <a href="mailto:${e(cfg.smtp.replyTo)}">${e(cfg.smtp.replyTo)}</a>. How we handle personal data is described in our <a href="${B}/privacy">Privacy Policy</a>.</p>
<p class="upd">Last updated: ${UPDATED}</p>`,
  },
};
function legal(kind) {
  const d = LEGAL[kind];
  return head(`${d.title} — ${cfg.eventName}`, `${d.title} for the ${cfg.eventName} conference registration website.`, { path: '/' + kind }) + `
<main class="legal"><div class="wrap"><span class="label">${e(cfg.eventName)}</span><h1>${d.title}</h1>${d.body()}</div></main>` + foot();
}

module.exports = { e, head, foot, home, LOGO, BRAND_LOGOS, register, done, verifyCode, verify, legal, SITE, login, loginCode, account };
