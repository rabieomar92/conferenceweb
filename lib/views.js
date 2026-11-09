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
    organizer: [{ '@type': 'CollegeOrUniversity', name: 'School of Physics, Universiti Sains Malaysia', url: 'https://www.usm.my' }],
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
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mainnav">Menu</button>
  <nav id="mainnav" aria-label="Main"><a class="n-sec" href="${B}/#about">About</a><a class="n-sec" href="${B}/#topics">Topics</a><a class="n-sec" href="${B}/#programme">Programme</a><a class="n-sec" href="${B}/#fees">Fees</a><span class="n-act"><!--AUTHNAV--></span></nav>
</div></header>
<script>(function(){var b=document.querySelector('.menu-btn'),h=document.querySelector('header.top');if(!b)return;b.addEventListener('click',function(){var o=h.classList.toggle('open');b.setAttribute('aria-expanded',o)});h.addEventListener('click',function(ev){if(ev.target.closest('.n-sec')){h.classList.remove('open');b.setAttribute('aria-expanded','false')}})})();</script>`;
}
function foot() {
  return boldAbbr(`<section class="partners"><div class="wrap row">
  <div class="pgroup"><span class="label">Organised by</span><div class="logos">
    <img class="sp" src="${B}/assets/sop.png" alt="School of Physics, Universiti Sains Malaysia" width="160" height="56"><img class="us" src="${B}/assets/usm-apex.png" alt="Universiti Sains Malaysia (APEX)" width="170" height="52">
  </div></div>
  <div class="pgroup"><span class="label">In collaboration with</span><div class="logos mass"><img class="ms" src="${B}/assets/mass.png" alt="The Malaysian Solid State Science and Technology Society (MASS)" width="76" height="76"></div></div>
  <div class="pgroup"><span class="label">Secure payments</span><div class="logos"><span class="ptxt">${cfg.payProvider === 'ticket2u' ? 'Ticket2U' : cfg.payProvider === 'both' ? 'Stripe · Ticket2U' : 'Stripe'}<br><small>Cards · FPX · e-wallets</small></span></div></div>
</div></section>
<footer class="f"><div class="wrap"><span>© 2027 ${e(cfg.eventName)} · ${e(cfg.eventFull)}</span><nav class="flinks" aria-label="Footer"><a href="${B}/privacy">Privacy Policy</a><a href="${B}/terms">Terms &amp; Refunds</a><a href="${B}/account">My registration</a><a href="${B}/speaker">Speaker portal</a><a href="${B}/admin/login">Organiser login</a></nav></div></footer>
</body></html>`);
}

const BRAND_LOGOS = (w) => `<span class="bl" aria-hidden="true"><img class="bl-s" src="${B}/assets/sop${w ? '-w' : ''}.png" alt="" width="112" height="39"><img class="bl-u" src="${B}/assets/usm${w ? '-w' : ''}.png" alt="" width="117" height="36"><img class="bl-m" src="${B}/assets/mass.png" alt="" width="46" height="46"><i></i></span>`;
const LOGO = `<span class="lg" role="img" aria-label="ICSSST 2027"><span class="lg-1" aria-hidden="true">ICSSST<i>2027</i></span><span class="lg-2" aria-hidden="true">Solid State Science &amp; Technology</span></span>`;
// the name “ICSSST 2027” is set bold in page text; tags, attributes and scripts are left alone
const ABBR = /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>|(\bICSSST[  ]2027\b)/g;
const boldAbbr = (html) => html.replace(ABBR, (m, a) => (a ? `<b class="sf">${a}</b>` : m));
const nl2br = (t) => e(t).replace(/\n+/g, '<br>');
function venueSection() {
  const m = cfg.map || {}; if (!m.open || !cfg.venueAddress) return '';   // shown once the venue address is set in Admin → Settings
  return `<section class="s" id="venue"><div class="wrap grid2">
  <div class="sec-label"><h2>Venue</h2></div>
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
const SDGS = [['4', 'Quality Education'], ['7', 'Affordable and Clean Energy'], ['9', 'Industry, Innovation and Infrastructure'], ['13', 'Climate Action']];
const hm = (x) => (x ? x.slice(0, 2) + ':' + x.slice(2) : '');
function feesSection() {
  const fees = cfg.fees || [], ends = cfg.earlyBirdEnds ? new Date(Date.parse(cfg.earlyBirdEnds) + 8 * 3600e3) : null;
  const endTxt = ends ? ends.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  return `<section class="s" id="fees"><div class="wrap grid2">
  <div class="sec-label"><h2>Registration fee</h2></div>
  <div>
    <p class="lead">Fees for the <em>three-day conference</em>, payable online once you have registered.</p>
    <ul class="fees">${fees.map((f) => `<li class="${f.early ? 'eb' : ''}${f.early && !settings.earlyOpen() ? ' gone' : ''}"><span class="fc">${e(f.name)}${f.early ? `<small>${settings.earlyOpen() ? (endTxt ? 'Until ' + e(endTxt) : 'Limited period') : 'Closed'}</small>` : ''}</span><span class="fp">${e(f.fee)}</span></li>`).join('')}</ul>
    <div class="paysteps"><h3>How registration works</h3>
      <div><span><strong>Register</strong>Create your registration and choose your fee category.</span></div>
      <div><span><strong>Pay online</strong>On your registration page, press Pay. Cards, FPX online banking and e-wallets are accepted.</span></div>
      <div><span><strong>Confirmed</strong>Your page shows <em>Paid</em> and you receive a receipt and a confirmation email.</span></div>
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
  <div class="sec-label"><h2>Programme</h2></div>
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
    ? `<!--HEROCTA-->`
    : `<span class="btn off">Registration closed</span><!--HEROCTA2-->`;
  return head(`${cfg.eventName} — ${cfg.eventFull} | ${cfg.eventDateText}, Penang`, '', { path: '/', ld: true, performers }) + boldAbbr(`
<main>
<section class="hero">
  <div class="hero-stick">
  <div class="hero-sun" aria-hidden="true"></div><div class="hero-spot" aria-hidden="true"></div>
  <div class="wrap hgrid">
  <figure class="mark">
    <svg class="lockup" viewBox="0 0 1000 500" role="img" aria-labelledby="lk-t">
      <title id="lk-t">ICSSST 2027 — International Conference on Solid State Science and Technology, Penang, Malaysia</title>
      <image href="${B}/assets/icssst-art.png" x="22" y="0" width="959" height="386"/>
      <text class="lk-main" x="60" y="486" textLength="888" lengthAdjust="spacing"><tspan class="lk-n">ICSSST</tspan><tspan class="lk-g" dx="14">2027</tspan></text>
      <defs><linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect class="lk-sheen" x="-220" y="-10" width="200" height="540" fill="url(#sheen)" transform="skewX(-18)"/>
    </svg>
  </figure>
  <div class="hcopy">
    <p class="eyebrow">The 11th International Conference on Solid State Science and Technology</p>
    <h1>${e(cfg.eventSub)}</h1>
    <p class="hfacts"><span>${e(cfg.eventDateText)}</span><span>${e(cfg.eventVenue)}</span></p>
    <div class="cta">${cta}</div>
  </div>
  <div class="hstage" aria-hidden="true"></div>
</div></div></section>

<div class="meta" id="details"><div class="wrap">
  <div class="cell"><span class="label">Dates</span><div class="v">${e(cfg.eventWeekday)},<br>${e(cfg.eventDateText)}</div></div>
  <div class="cell"><span class="label">Venue</span><div class="v">${e(cfg.eventVenue)}</div>${cfg.map && cfg.map.open && cfg.venueAddress ? '<a class="vlink" href="#venue">Map &amp; directions <span>→</span></a>' : ''}</div>
  <div class="cell org"><span class="label">Organiser</span><div class="v"><img class="org-logo" src="${B}/assets/sop.png" alt="School of Physics, Universiti Sains Malaysia" width="170" height="60"></div></div>
</div></div>

<section class="s" id="about"><div class="wrap grid2">
  <div class="sec-label"><h2>About</h2></div>
  <div>
    <p class="lead">Malaysia’s high-tech era: innovation in <em>nanotechnology, AI and semiconductors</em>.</p>
    <p class="body-txt">The 11th International Conference on Solid State Science and Technology brings researchers, students and industry together in Penang, the heart of Malaysia’s semiconductor industry, to share advances in materials, devices and the physics behind them. Three days of plenary and keynote lectures, invited and oral talks in four parallel rooms, posters, technical sessions and product demonstrations.</p>
    <h3 class="sub">Sustainable Development Goals supported</h3>
    <ul class="sdg">${SDGS.map(([n, t]) => `<li><img src="${B}/assets/sdg/goal-${n}.svg" width="405" height="405" alt="Sustainable Development Goal ${n}: ${e(t)}" loading="lazy"></li>`).join('')}</ul>
  </div>
</div></section>

<section class="s" id="topics"><div class="wrap grid2">
  <div class="sec-label"><h2>Conference topics</h2></div>
  <ul class="tlist">${TOPICS.map((t) => `<li>${e(t)}</li>`).join('')}</ul>
</div></section>

${programmeSection()}
${feesSection()}
${speakersHtml || ''}
${venueSection()}

<section class="band"><div class="wrap">
  <h2 data-plx="0.05">See you in <em>Penang</em>, ${e(cfg.eventDateText.replace(/ \d{4}$/, ''))}.</h2>
  ${open ? `<div class="cta"><a class="btn" href="${B}/register">Register now <span class="arr">→</span></a></div>` : ''}
</div></section>
</main>`) + foot();
}

const INST = require('./institutions');
const PARTS = require('./participants');
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
    <div class="two t13">
      <div class="fld"><label class="l" for="salutation">Title</label><select id="salutation" name="salutation">${PARTS.SALUTATIONS.map((x) => `<option value="${e(x)}" ${v.salutation === x ? 'selected' : ''}>${x ? e(x) : '—'}</option>`).join('')}</select></div>
      <div class="fld"><label class="l" for="full_name">Full name</label>
      <input type="text" id="full_name" name="full_name" required maxlength="120" autocomplete="name" placeholder="As on your certificate" value="${e(v.full_name)}"></div>
    </div>
    <div class="two">
      <div class="fld"><label class="l" for="email">Email</label>
        <input type="email" id="email" name="email" required maxlength="160" autocomplete="email" placeholder="name@institution.edu" value="${e(v.email)}" ${google ? 'readonly aria-readonly="true" class="ro"' : ''}></div>
      <div class="fld"><label class="l" for="phone">Phone <span class="opt">(optional)</span></label>
        <input type="tel" id="phone" name="phone" maxlength="30" autocomplete="tel" placeholder="+60 12 345 6789" value="${e(v.phone)}"></div>
    </div>
    <div class="fld"><label class="l" for="organisation">Institution / Organisation</label>
      <div class="combo">
        <input type="text" id="organisation" name="organisation" required maxlength="160" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="orgList" aria-autocomplete="list" placeholder="Start typing, e.g. Universiti Sains Malaysia" value="${e(v.organisation)}">
        <input type="hidden" name="org_custom" id="org_custom" value="${v.org_custom ? '1' : '0'}"><input type="hidden" name="js" id="js" value="">
        <ul id="orgList" role="listbox" hidden></ul>
      </div>
      <p class="hint" id="orgHint">Choose your institution from the list so every name is spelled the same. Can’t find it? Select “My institution isn’t listed”.</p></div>
    <div class="fld"><label class="l" for="designation">Position / designation</label>
      <input type="text" id="designation" name="designation" maxlength="120" autocomplete="organization-title" placeholder="e.g. Senior Lecturer, PhD student, Process Engineer" value="${e(v.designation)}"></div>
    <div class="fld"><label class="l" id="partl">I am taking part with</label>
      <div class="chips" role="radiogroup" aria-labelledby="partl">${PARTS.PARTICIPATION.map((x, i) => `<input type="radio" name="participation" id="pp${i}" value="${e(x)}" ${v.participation === x ? 'checked' : ''} required><label for="pp${i}">${e(x)}</label>`).join('')}</div></div>
    <div class="fld" id="ptf"${/presentation/i.test(v.participation || '') ? '' : ' hidden'}><label class="l" for="paper_title">Paper / abstract title <span class="opt">(can be added later)</span></label>
      <input type="text" id="paper_title" name="paper_title" maxlength="300" value="${e(v.paper_title)}"></div>
    <div class="fld"><label class="l" id="catl">Registration category &amp; fee</label>
      <div class="feechips" role="radiogroup" aria-labelledby="catl">
        ${settings.availableFees().map((f, i) => `<input type="radio" name="category" id="c${i}" value="${e(f.name)}" ${v.category === f.name ? 'checked' : ''} required><label for="c${i}"><span>${e(f.name)}</span><b>${e(f.fee)}</b></label>`).join('')}
      </div>
      <p class="hint">You pay after registering, on your registration page (card, FPX or e-wallet). MASS membership and student status may be checked.</p></div>
    <div class="fld"><label class="l" for="country">Country</label>
      <select id="country" name="country" required autocomplete="country-name">
        <option value="">Select your country…</option>${INST.countries.map((c) => `<option value="${e(c)}" ${v.country === c ? 'selected' : ''}>${e(c)}</option>`).join('')}
      </select></div>
    <div class="two">${PWF('password', 'Choose a password', 'new-password', 'At least 10 characters. You use it to sign in, pay and download your certificate.')}${PWF('password2', 'Password again', 'new-password')}</div>
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
  return head(`Register — ${cfg.eventName}, ${cfg.eventDateText}`, `Register for ${cfg.eventName}, the ${cfg.eventFull}, ${cfg.eventDateText}, Penang, Malaysia. Register and pay online.`, { path: '/register' }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <a class="back tosite" href="${B}/">← Back to the conference website</a>
    <span class="label">Registration</span>
    <h1>Register for<br>ICSSST <em>2027</em>.</h1>
    <p>Fill in your details and choose your fee category. After registering you land on your own registration page, where you pay online and can check your payment status at any time.</p>
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
<script src="${B}/assets/institution.js?v=${av('institution.js')}" defer></script>${PWJS}
<script>
document.querySelectorAll('input[name=participation]').forEach(function(r){r.addEventListener('change',function(){document.getElementById('ptf').hidden=!/presentation/i.test(r.value)})});
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
    <a class="back tosite" href="${B}/">← Back to the conference website</a>
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

function verify(ref, row, limited = false) {
  const ok = row && row.cert_issued_at;
  return head(`Certificate verification — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="done"><div class="wrap">
  <span class="label">Certificate verification</span>
  ${ok ? `<h1>Verified.</h1>
    <p class="body-txt" style="margin:0 0 26px">This certificate was issued to <b>${e(row.full_name)}</b> (${e(row.organisation)}) for participation in ${e(cfg.eventName)}, ${e(cfg.eventDateText)}.</p>
    <div class="refbox"><span class="label">Certificate no.</span><b>${e(ref)}</b></div>`
    : limited ? `<h1>Please wait.</h1><p class="body-txt" style="margin:0">Too many look-ups from your connection. Try again in a few minutes.</p>` : `<h1>Not found.</h1><p class="body-txt" style="margin:0">No issued certificate matches this reference.</p>`}
</div></main>` + foot();
}

// ── participant: sign in (Google or emailed code) and “My registration” with Ticket2U payment ──
const STATUS = { unpaid: ['Payment due', 'due'], claimed: ['Payment being checked', 'chk'], paid: ['Paid', 'ok'], waived: ['No payment needed', 'ok'] };
const myDate = (iso) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : '');
const flashBox = (fl) => (fl && (fl.ok || (fl.err && fl.err.length)) ? (fl.ok ? `<div class="okmsg" role="status">${e(fl.ok)}</div>` : '') + (fl.err && fl.err.length ? `<div class="err" role="alert"><ul>${fl.err.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : '') : '');

const PWF = (id, label, ac, hint = '') => `<div class="fld"><label class="l" for="${id}">${label}</label><div class="pwbox"><input type="password" id="${id}" name="${id}" required maxlength="128" autocomplete="${ac}"><button type="button" class="pwshow" data-for="${id}" aria-label="Show password">Show</button></div>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
const PWJS = `<script>document.querySelectorAll('.pwshow').forEach(function(b){b.addEventListener('click',function(){var i=document.getElementById(b.getAttribute('data-for'));var s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Hide':'Show'})})</script>`;
function login({ csrf, email = '', err = '', googleOn = false, info = '' }) {
  return head(`Sign in — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <a class="back tosite" href="${B}/">← Back to the conference website</a>
    <span class="label">Participant account</span>
    <h1>Welcome<br><em>back.</em></h1>
    <p>Sign in to pay your fee, complete your profile and, after the conference, download your certificate.</p>
    <p class="already">Not registered yet? <a href="${B}/register">Register for ${e(cfg.eventName)} →</a></p>
  </aside>
  <div class="f">
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}${info ? `<div class="okmsg" role="status">${e(info)}</div>` : ''}
    ${googleOn ? `<div class="gbox"><a class="gbtn" href="${B}/auth/google?next=account">${GLOGO}<span>Continue with Google</span></a><p>If you registered with this Google address.</p><div class="or"><span>or sign in with your password</span></div></div>` : ''}
    <form method="post" action="${B}/login" novalidate>
      <input type="hidden" name="csrf" value="${e(csrf)}">
      <div class="fld"><label class="l" for="email">Email</label><input type="email" id="email" name="email" required maxlength="160" autocomplete="username" value="${e(email)}" placeholder="The address you registered with"></div>
      ${PWF('password', 'Password', 'current-password')}
      <button class="btn" type="submit">Sign in <span class="arr">→</span></button>
    </form>
    <div class="links2"><a class="lnk" href="${B}/login/forgot${email ? '?email=' + encodeURIComponent(email) : ''}">Forgot or set password</a></div>
  </div>
</div></main>${PWJS}` + foot();
}
function forgot({ csrf, email = '', err = '' }) {
  return head(`Forgot password — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside><a class="back tosite" href="${B}/">← Back to the conference website</a><span class="label">Participant account</span><h1>Forgot your<br><em>password?</em></h1>
    <p>Enter the email address you registered with. We will email you a 6-digit code so you can choose a new password. Registered before passwords were introduced? Use this to set one.</p></aside>
  <form class="f" method="post" action="${B}/login/forgot" novalidate>
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="email">Email</label><input type="email" id="email" name="email" required maxlength="160" autocomplete="email" value="${e(email)}"></div>
    <button class="btn" type="submit">Email me a code <span class="arr">→</span></button>
    <div class="links2"><a class="lnk mut" href="${B}/login">Back to sign in</a></div>
  </form>
</div></main>` + foot();
}
function resetPw({ csrf, err = '' }) {
  return head(`Choose a password — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside><a class="back tosite" href="${B}/">← Back to the conference website</a><span class="label">Participant account</span><h1>Choose a<br><em>new password.</em></h1><p>At least 10 characters. A short sentence you can remember works well.</p></aside>
  <form class="f" method="post" action="${B}/login/reset" novalidate>
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    ${PWF('password', 'New password', 'new-password')}${PWF('password2', 'New password again', 'new-password')}
    <button class="btn" type="submit">Save and sign in <span class="arr">→</span></button>
  </form>
</div></main>${PWJS}` + foot();
}

function loginCode({ csrf, masked, err = '', info = '', wait = 0 }) {
  return head(`Enter your code — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="reg"><div class="wrap grid">
  <aside>
    <a class="back tosite" href="${B}/">← Back to the conference website</a>
    <span class="label">Forgot password</span>
    <h1>Check your<br>inbox.</h1>
    <p>If <b>${e(masked)}</b> is registered, a 6-digit code is on its way. It is valid for ${cfg.codeMinutes} minutes. Check spam or junk if it does not arrive.</p>
  </aside>
  <div>
  <form class="f" method="post" action="${B}/login/verify" novalidate autocomplete="off">
    ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}${info ? `<div class="okmsg" role="status">${e(info)}</div>` : ''}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="code">Code from the email</label>
      <input type="text" id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus required placeholder="······" class="codein"></div>
    <button class="btn" type="submit">Continue <span class="arr">→</span></button>
  </form>
  <div class="links2">
    <form method="post" action="${B}/login/resend"><input type="hidden" name="csrf" value="${e(csrf)}"><button id="rs" type="submit" class="lnk" ${wait > 0 ? 'disabled' : ''}>Send a new code${wait > 0 ? ` (<span id="w">${wait}</span>s)` : ''}</button></form>
    <a class="lnk mut" href="${B}/login/forgot">Use a different email</a>
  </div></div>
</div></main>
<script>(function(){var w=document.getElementById('w'),b=document.getElementById('rs');if(w){var n=parseInt(w.textContent,10),t=setInterval(function(){n--;if(n<=0){clearInterval(t);b.disabled=false;b.textContent='Send a new code'}else w.textContent=n},1000)}
var c=document.getElementById('code');c.addEventListener('input',function(){c.value=c.value.replace(/\D/g,'').slice(0,6)})})();</script>` + foot();
}

function account({ r, csrf, flash: fl, payUrl, welcome = false, modes = { stripe: false, t2u: true }, stripeAmount = '', pform = null, prform = null }) {
  const st = STATUS[r.pay_status] || STATUS.unpaid, fees = settings.availableFees();
  const canChange = r.pay_status === 'unpaid' && fees.length > 1;
  const first = String(r.full_name).trim().split(/\s+/)[0];
  const byStripe = r.pay_source === 'stripe';
  let pay;
  if (r.pay_status === 'paid') pay = `<p class="pdone">Your payment${r.pay_amount ? ` of <b>${e(r.pay_amount)}</b>` : ''} was received on <b>${e(myDate(r.paid_at))}</b>. ${byStripe ? 'Stripe emailed your receipt to <b>' + e(r.email) + '</b>.' : `${r.pay_ref ? `Ticket2U order <b>${e(r.pay_ref)}</b>. ` : ''}Your receipt / e-invoice is in the email from the payment provider.`}</p>`;
  else if (r.pay_status === 'waived') pay = `<p class="pdone">The organisers have marked your registration as not requiring payment${r.pay_note ? ` (${e(r.pay_note)})` : ''}.</p>`;
  else {
    const myr = /^RM/i.test(r.fee || '');
    const stripeBlock = modes.stripe ? `
    <form method="post" action="${B}/account/pay" class="paynow"><input type="hidden" name="csrf" value="${e(csrf)}">
      <button class="btn" type="submit">Pay ${e(stripeAmount || r.fee || '')} now <span class="arr">→</span></button>
    </form>
    <p class="pmeth">${myr ? '<span>Card</span><span>FPX online banking</span><span>GrabPay</span>' : '<span>Visa</span><span>Mastercard</span><span>Amex</span>'}<em>Secure checkout by Stripe</em></p>
    <p class="hint">You pay on Stripe’s secure page and come straight back here; your status changes to <b>Paid</b> automatically and Stripe emails your receipt. We never see your card or bank details.</p>` : '';
    const t2uBlock = modes.t2u ? `
    ${modes.stripe ? `<details class="alt"><summary>Prefer Ticket2U? Pay there instead</summary>` : ''}
    <ol class="psteps">
      <li><b>Open Ticket2U</b> and choose the ticket <b>“${e(r.category)}”</b>.</li>
      <li><b>Use the same details:</b> the email <b>${e(r.email)}</b> and, if asked, your reference <b>${e(r.ref)}</b>, so we can match your payment.</li>
      <li><b>Come back here</b> and enter your Ticket2U order number below.</li>
    </ol>
    <div class="cta">${payUrl ? `<a class="${modes.stripe ? 'b2' : 'btn'}" href="${e(payUrl)}" target="_blank" rel="noopener">Pay with Ticket2U <span class="arr">↗</span></a>` : `<span class="btn" style="opacity:.45;cursor:default">Payment opens soon</span>`}<button type="button" class="b2l" id="cpRef" data-ref="${e(r.ref)}">Copy reference ${e(r.ref)}</button></div>
    <form class="claim" method="post" action="${B}/account/paid" novalidate>
      <input type="hidden" name="csrf" value="${e(csrf)}">
      <label class="l" for="order">${r.pay_status === 'claimed' ? 'Change your Ticket2U order number' : 'Paid on Ticket2U? Order number'}</label>
      <div class="row1"><input type="text" id="order" name="order" maxlength="40" autocomplete="off" placeholder="e.g. T2U12345678" value="${e(r.pay_status === 'claimed' ? r.pay_ref || '' : '')}"><button class="b2" type="submit">${r.pay_status === 'claimed' ? 'Update' : 'I have paid'}</button></div>
    </form>${modes.stripe ? '</details>' : ''}` : '';
    pay = `${r.pay_status === 'claimed' ? `<p class="pchk">Thank you. You told us you paid on Ticket2U${r.pay_ref ? ` (order <b>${e(r.pay_ref)}</b>)` : ''} on ${e(myDate(r.pay_claimed_at))}. We are matching it with Ticket2U’s records; this page will show <b>Paid</b> once confirmed.</p>` : ''}
    ${!modes.stripe && !payUrl ? '<p class="hint">Online payment opens soon. We will email you when it does.</p>' : ''}${stripeBlock}${t2uBlock}
    ${cfg.paymentNote ? `<div class="pnote">${nl2br(cfg.paymentNote)}</div>` : ''}`;
  }
  // ── profile form ──
  const v = { ...r, ...(pform || {}) }, done = PARTS.completeness(r), list = PARTS.checklist(r);
  const sel = (name, opts, cur, blank) => `<select id="${name}" name="${name}">${blank ? `<option value="">${blank}</option>` : ''}${opts.map((x) => `<option value="${e(x)}" ${cur === x ? 'selected' : ''}>${x ? e(x) : '—'}</option>`).join('')}</select>`;
  const txt = (name, label, max, ph = '', extra = '') => `<div class="fld"><label class="l" for="${name}">${label}</label><input type="text" id="${name}" name="${name}" maxlength="${max}" placeholder="${e(ph)}" value="${e(v[name] || '')}" ${extra}></div>`;
  const nameLocked = !!r.cert_issued_at;
  const profile = `
    <section class="dcard" id="profile"><div class="dhd"><span class="label">Profile</span><span class="pct"><b>${done}%</b> complete</span></div>
      <div class="pbar"><i style="width:${done}%"></i></div>
      ${done < 100 ? `<ul class="todo">${list.filter((x) => !x[1]).map((x) => `<li>${e(x[0])}</li>`).join('')}</ul>` : '<p class="hint">Thank you — your profile is complete.</p>'}
      <form method="post" action="${B}/account/profile" novalidate class="pform">
        <input type="hidden" name="csrf" value="${e(csrf)}">
        <h3>About you</h3>
        <div class="two t13"><div class="fld"><label class="l" for="salutation">Title</label>${sel('salutation', PARTS.SALUTATIONS, v.salutation || '')}</div>
          <div class="fld"><label class="l" for="full_name">Full name (on your certificate)</label><input type="text" id="full_name" name="full_name" maxlength="120" value="${e(v.full_name)}" ${nameLocked ? 'readonly class="ro"' : ''}>${nameLocked ? '<p class="hint">Your certificate has been issued, so the name can no longer be changed here. Email us if it needs correcting.</p>' : ''}</div></div>
        <div class="two">${txt('designation', 'Position / designation', 120, 'e.g. Senior Lecturer')}${txt('department', 'Department / faculty', 160, 'e.g. School of Physics')}</div>
        <div class="fld"><label class="l" for="organisation">Institution / organisation</label>
          <div class="combo"><input type="text" id="organisation" name="organisation" required maxlength="160" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="orgList" aria-autocomplete="list" value="${e(v.organisation)}"${nameLocked ? " readonly" : ""}><input type="hidden" name="org_custom" id="org_custom" value="1"><input type="hidden" name="js" id="js" value=""><ul id="orgList" role="listbox" hidden></ul></div></div>
        <div class="two"><div class="fld"><label class="l" for="country">Country</label>${sel('country', INST.countries, v.country || '', 'Select your country…')}</div>${txt('phone', 'Phone', 30, '+60 12 345 6789')}</div>
        <div class="fld"><label class="l">Email</label><input type="text" value="${e(r.email)}" readonly class="ro"><p class="hint">Your email is your sign-in. To change it, email ${e(cfg.smtp.replyTo)}.</p></div>
        <h3>Your participation</h3>
        <div class="fld"><label class="l" id="pl2">Taking part with</label><div class="chips" role="radiogroup" aria-labelledby="pl2">${PARTS.PARTICIPATION.map((x, i) => `<input type="radio" name="participation" id="q${i}" value="${e(x)}" ${v.participation === x ? 'checked' : ''}><label for="q${i}">${e(x)}</label>`).join('')}</div></div>
        <p class="hint" id="ptf2"${/presentation/i.test(v.participation || '') ? '' : ' hidden'}>Presenting? Add your title, authors and abstract in the <button type="button" class="lnk" data-go="presentation">Presentation</button> tab.</p>
        ${/^MASS/i.test(r.category || '') ? txt('mass_no', 'MASS membership number', 40, 'Needed for the MASS member rate') : ''}
        <h3>On the day</h3>
        <div class="two"><div class="fld"><label class="l" for="diet">Dietary requirement</label>${sel('diet', PARTS.DIETS, v.diet || '', 'Please choose…')}</div>
          <div class="fld" id="dnf"${v.diet === 'Other' ? '' : ' hidden'}><label class="l" for="diet_note">Please specify</label><input type="text" id="diet_note" name="diet_note" maxlength="160" value="${e(v.diet_note || '')}"></div></div>
        <div class="fld"><label class="l" id="dl">Opening ceremony &amp; conference dinner</label><div class="chips" role="radiogroup" aria-labelledby="dl"><input type="radio" name="dinner" id="dy" value="yes" ${v.dinner === 'yes' ? 'checked' : ''}><label for="dy">I will attend</label><input type="radio" name="dinner" id="dn" value="no" ${v.dinner === 'no' ? 'checked' : ''}><label for="dn">I will not attend</label></div></div>
        <h3>Invoice</h3>
        <div class="fld"><label class="l" for="billing">Invoice / receipt addressed to <span class="opt">(optional)</span></label><textarea id="billing" name="billing" rows="3" maxlength="500" placeholder="Institution name and address, if your receipt must be made out to your employer">${e(v.billing || '')}</textarea></div>
        <button class="btn" type="submit">Save profile <span class="arr">→</span></button>
      </form>
    </section>`;
  // ── presentation (oral / poster) ──
  const presenting = PARTS.presenting(r), isOral = /oral/i.test(r.participation || ''), kind = isOral ? 'oral' : 'poster';
  const pv = { ...r, ...(prform || {}) }, pcl = PARTS.presChecklist(r), pdone = PARTS.presCompleteness(r), pmiss = pcl.filter((x) => !x[1]).map((x) => x[0]);
  const presentation = !presenting ? '' : `
    <div class="dgrid"><div class="dmain">
      <section class="dcard" id="presentation"><div class="dhd"><span class="label">Your ${kind} presentation</span><span class="pst ${pdone === 100 ? 'ok' : 'due'}">${pdone === 100 ? 'Received' : 'Details needed'}</span></div>
        ${pdone === 100 ? '<p class="hint" style="margin-bottom:14px">Thank you. The organisers have your title, authors and abstract. You can change them here until the abstract book is prepared.</p>' : `<p class="hint" style="margin-bottom:14px">Still needed: ${pmiss.map(e).join(', ')}.</p>`}
        <form method="post" action="${B}/account/presentation" novalidate class="pform"><input type="hidden" name="csrf" value="${e(csrf)}">
          <div class="fld"><label class="l" for="paper_title">Title</label><textarea id="paper_title" name="paper_title" rows="2" maxlength="300" placeholder="The title as it should appear in the programme">${e(pv.paper_title || '')}</textarea></div>
          <div class="fld"><label class="l" for="coauthors">Authors and affiliations</label><textarea id="coauthors" name="coauthors" rows="3" maxlength="600" placeholder="One author per line, presenting author first. e.g. A. Rahman (Universiti Sains Malaysia)">${e(pv.coauthors || '')}</textarea></div>
          <div class="fld"><label class="l" for="abstract">Abstract</label><textarea id="abstract" name="abstract" rows="10" maxlength="${PARTS.ABSTRACT_MAX}" placeholder="Plain text. Leave an empty line between paragraphs. About 150–300 words reads best.">${e(pv.abstract || '')}</textarea>
            <p class="hint"><span id="abN">${PARTS.wordCount(pv.abstract)} words</span><span>Minimum ${PARTS.ABSTRACT_MIN} words</span></p></div>
          <div class="fld"><label class="l" for="paper_id">Abstract or paper ID <span class="opt">(if the organisers gave you one)</span></label><input type="text" id="paper_id" name="paper_id" maxlength="40" value="${e(pv.paper_id || '')}"></div>
          <button class="btn" type="submit">Save presentation <span class="arr">→</span></button>
        </form>
      </section></div>
      <aside class="dside">
        <section class="dcard"><div class="dhd"><span class="label">${isOral ? 'Oral presentation' : 'Poster presentation'}</span></div>
          <dl class="dl">${isOral ? '' : `<div><dt>Poster size</dt><dd>${cfg.posterSpecs ? e(cfg.posterSpecs) : 'To be announced'}</dd></div>`}<div><dt>Date</dt><dd>${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)}</dd></div><div><dt>Session</dt><dd>${e(isOral ? 'Time and room will be emailed to you' : 'Poster session details will be emailed to you')}</dd></div><div><dt>Venue</dt><dd>${e(cfg.eventVenue)}</dd></div></dl>
          ${cfg.presenterNotes ? `<div class="pnote" style="margin-top:12px">${nl2br(cfg.presenterNotes)}</div>` : ''}</section>
        <section class="dcard"><div class="dhd"><span class="label">Checklist</span></div>
          <ul class="dtodo">${pcl.map((x) => `<li class="${x[1] ? 'dn' : ''}"><i aria-hidden="true">${x[1] ? '✓' : ''}</i><span>${e(x[0])}</span></li>`).join('')}</ul></section>
      </aside></div>`;
  // ── certificate ──
  const ready = PARTS.certReady(r, cfg);
  const certConf = { event: cfg.eventName, full: cfg.eventFull, sub: 'Theme: ' + cfg.eventSub, date: cfg.eventDateText, venue: cfg.eventVenue, sigName: cfg.signatoryName, sigTitle: cfg.signatoryTitle, sigImg: cfg.signatureData ? B + '/account/signature?v=' + encodeURIComponent(cfg.signatureVer) : '', base: B };
  const certP = { id: r.id, ref: r.ref, full_name: r.full_name, organisation: r.organisation, participation: r.participation };
  const cert = `
    <section class="dcard" id="certificate"><div class="dhd"><span class="label">Certificate</span><span class="pst ${ready ? 'ok' : 'due'}">${ready ? 'Ready' : 'After the conference'}</span></div>
      ${ready ? `<p>Your certificate of participation is ready${r.participation && /presentation/i.test(r.participation) ? `, as ${/oral/i.test(r.participation) ? 'an oral' : 'a poster'} presenter` : ''}. It carries a number that anyone can check on this website.</p>
        <div class="cta"><button class="btn" type="button" id="certBtn">Download certificate (PDF) <span class="arr">↓</span></button><span class="hint" id="certSt"></span></div>
        <img id="certPrev" alt="Preview of your certificate" hidden>`
      : `<p>Certificates become available here after the conference, once you have been marked as attending${r.pay_status === 'paid' || r.pay_status === 'waived' ? '' : ' and your fee is paid'}. The name printed is <b>${e(r.full_name)}</b>${r.organisation ? `, <span class="mut">${e(r.organisation)}</span>` : ''} — correct it in your profile before then if needed.</p>`}
    </section>`;
  const pwCard = `
    <section class="dcard" id="pwcard"><div class="dhd"><span class="label">Password</span>${r.pw_set_at ? `<span class="hint">Last changed ${e(myDate(r.pw_set_at))}</span>` : ''}</div>
      <details${r.pw_hash ? '' : ' open'}><summary>${r.pw_hash ? 'Change your password' : 'Set a password so you can sign in with it next time'}</summary>
      <form method="post" action="${B}/account/password" novalidate class="pform"><input type="hidden" name="csrf" value="${e(csrf)}">
        ${r.pw_hash ? PWF('current', 'Current password', 'current-password') : ''}<div class="two">${PWF('password', 'New password', 'new-password')}${PWF('password2', 'New password again', 'new-password')}</div>
        <button class="b2" type="submit">Save password</button></form></details>
    </section>`;
  // ── overview ──
  const paid = r.pay_status === 'paid' || r.pay_status === 'waived', claimed = r.pay_status === 'claimed';
  const DAY = 864e5, ymd = (t) => Date.parse(t + 'T00:00:00Z');
  const todayMY = ymd(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }));
  const d0 = ymd(cfg.eventDate), d1 = ymd(cfg.eventEndDate || cfg.eventDate);
  const phase = todayMY > d1 ? 'past' : todayMY >= d0 ? 'now' : 'before', toGo = Math.round((d0 - todayMY) / DAY);
  const missing = list.filter((x) => !x[1]).map((x) => x[0]);
  const presDue = presenting && pdone < 100;
  const payOpen = modes.stripe || !!payUrl;
  let next;
  if (!paid && !claimed) next = { h: 'Pay your registration fee', p: payOpen ? `Your place is confirmed once your <b>${e(stripeAmount || r.fee || '')}</b> payment is received. It takes about two minutes.` : 'Online payment opens soon. We will email you the moment it does, so there is nothing to do right now.', go: payOpen ? ['Go to payment', 'payment'] : null };
  else if (claimed) next = { h: 'We are checking your payment', p: 'You told us you paid on Ticket2U. We are matching it with Ticket2U’s records, usually within a few working days. This page and your email will show <b>Paid</b> once confirmed.', go: ['See payment details', 'payment'] };
  else if (done < 100) next = { h: 'Complete your profile', p: `${missing.length} detail${missing.length === 1 ? '' : 's'} left: ${missing.slice(0, 3).map(e).join(', ')}${missing.length > 3 ? ' and more' : ''}. It helps us plan seating, meals and your certificate.`, go: ['Complete profile', 'profile'] };
  else if (presDue) next = { h: `Send your ${kind} presentation details`, p: `We still need your ${pmiss.slice(0, 3).map((x) => e(x.toLowerCase())).join(', ')}. The organisers use them to build the programme and the abstract book.`, go: ['Add presentation details', 'presentation'] };
  else if (ready) next = { h: 'Your certificate is ready', p: 'Download your certificate of participation as a PDF.', go: ['Open certificate', 'certificate'] };
  else next = { h: 'You are all set', p: phase === 'before' ? `Nothing more to do. See you in ${e(cfg.eventVenue)} in <b>${toGo} day${toGo === 1 ? '' : 's'}</b>.` : phase === 'now' ? 'The conference is on now. Enjoy it!' : 'Thank you for taking part.', go: null };
  const steps = [
    ['Registered', true, myDate(r.created_at)],
    ['Fee paid', paid, paid ? myDate(r.paid_at) || 'Settled' : claimed ? 'Being checked' : 'Due'],
    ['Profile', done === 100, done + '% complete'],
    ...(presenting ? [['Presentation', pdone === 100, pdone === 100 ? 'Received' : pdone + '% complete']] : []),
    ['Conference', phase === 'past', cfg.eventDateText],
    ['Certificate', ready, ready ? 'Ready' : 'After the conference'],
  ];
  const cur = steps.findIndex((x) => !x[1]);
  const stepper = `<ol class="dsteps" style="--n:${steps.length}">${steps.map((x, i) => `<li class="${x[1] ? 'dn' : i === cur ? 'cur' : ''}"><i aria-hidden="true">${x[1] ? '✓' : ''}</i><b>${e(x[0])}</b><span>${e(x[2])}</span></li>`).join('')}</ol>`;
  const venueLine = [cfg.eventVenue].concat(cfg.venueAddress ? [cfg.venueAddress.split(/\n/)[0]] : []).join(' · ');
  const mailHelp = `mailto:${cfg.smtp.replyTo}?subject=${encodeURIComponent(cfg.eventName + ' ' + r.ref)}`;
  const overview = `
    <div class="dgrid">
      <div class="dmain">
        <section class="dnext ${paid && done === 100 ? 'ok' : ''}" aria-labelledby="nx-h"><span class="label">Your next step</span><h2 id="nx-h">${next.h}</h2><p>${next.p}</p>${next.go ? `<button type="button" class="btn" data-go="${next.go[1]}">${next.go[0]}</button>` : ''}</section>
        <section class="dcard"><div class="dhd"><span class="label">Your progress</span></div>${stepper}</section>
        <section class="dcard"><div class="dhd"><span class="label">Before the conference</span><span class="hint">${list.concat(presenting ? pcl : []).filter((x) => x[1]).length} of ${list.length + (presenting ? pcl.length : 0)} details given</span></div>
          <ul class="dtodo">
            <li class="${paid ? 'dn' : ''}"><i aria-hidden="true">${paid ? '✓' : ''}</i><span>Registration fee ${paid ? 'paid' : claimed ? 'being checked' : 'to be paid'}</span>${paid ? '' : '<button type="button" class="lnk" data-go="payment">Open</button>'}</li>
            ${list.map((x) => `<li class="${x[1] ? 'dn' : ''}"><i aria-hidden="true">${x[1] ? '✓' : ''}</i><span>${e(x[0])}</span>${x[1] ? '' : '<button type="button" class="lnk" data-go="profile">Add</button>'}</li>`).join('')}
            ${presenting ? pcl.map((x) => `<li class="${x[1] ? 'dn' : ''}"><i aria-hidden="true">${x[1] ? '✓' : ''}</i><span>${e(x[0])}</span>${x[1] ? '' : '<button type="button" class="lnk" data-go="presentation">Add</button>'}</li>`).join('') : ''}
          </ul></section>
      </div>
      <aside class="dside">
        <section class="dcard"><div class="dhd"><span class="label">The conference</span><span class="cdown">${phase === 'before' ? `${toGo} day${toGo === 1 ? '' : 's'} to go` : phase === 'now' ? 'Happening now' : 'Ended'}</span></div>
          <p class="dtitle">${e(cfg.eventFull)}</p>
          <dl class="dl"><div><dt>When</dt><dd>${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)}</dd></div><div><dt>Where</dt><dd>${e(venueLine)}</dd></div></dl>
          <div class="dlinks"><a class="b2l" href="${B}/account/calendar.ics">Add to my calendar</a><a class="b2l" href="${B}/#programme">Programme</a>${cfg.map && cfg.map.open && cfg.venueAddress ? `<a class="b2l" href="${e(cfg.map.open)}" target="_blank" rel="noopener">Map &amp; directions</a>` : ''}</div></section>
        <section class="dcard"><div class="dhd"><span class="label">Your registration</span><span class="pst ${st[1]}">${e(st[0])}</span></div>
          <dl class="dl"><div><dt>Reference</dt><dd><b>${e(r.ref)}</b> <button type="button" class="lnk" data-copy="${e(r.ref)}">Copy</button></dd></div>
            <div><dt>Name</dt><dd>${e(PARTS.displayName(r))}</dd></div>
            <div><dt>Category</dt><dd>${e(r.category)} · <b>${e(r.fee || '')}</b></dd></div>
            ${r.participation ? `<div><dt>Taking part</dt><dd>${e(r.participation)}</dd></div>` : ''}
            <div><dt>Registered</dt><dd>${e(myDate(r.created_at))}</dd></div></dl>
          ${paid ? `<div class="dlinks"><a class="b2l" href="${B}/account/receipt" target="_blank" rel="noopener">Print receipt</a></div>` : ''}</section>
        <section class="dcard dhelp"><span class="label">Need help?</span><p>Questions about payment, your category or your certificate? Email <a href="${e(mailHelp)}">${e(cfg.smtp.replyTo)}</a> and quote <b>${e(r.ref)}</b>.</p></section>
      </aside>
    </div>`;
  const acctPanel = `${pwCard}<form method="post" action="${B}/logout" class="signout"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="b2" type="submit">Sign out</button></form>`;
  const tabs = [['overview', 'Overview', ''], ['payment', 'Payment', st[0]], ['profile', 'Profile', done + '%'], ...(presenting ? [['presentation', isOral ? 'Oral talk' : 'Poster', pdone === 100 ? 'Received' : pdone + '%']] : []), ['certificate', 'Certificate', ready ? 'Ready' : 'Later'], ['account', 'Account', '']];
  return head(`My registration — ${cfg.eventName}`, '', { noindex: true }) + `
<main class="dash"><div class="wrap">
  <header class="dhead"><div><span class="label">Participant dashboard</span><h1>${welcome ? 'You’re registered, ' : 'Hello, '}${e(first)}.</h1></div><div class="dref"><span>Reference</span><b>${e(r.ref)}</b></div></header>
  ${flashBox(fl)}
  <nav class="dtabs2" aria-label="Dashboard sections">${tabs.map((t, i) => `<button type="button" data-tab="${t[0]}" ${i ? '' : 'aria-current="page"'}>${t[1]}${t[2] ? `<small>${e(t[2])}</small>` : ''}</button>`).join('')}</nav>
  <section class="dpanel2" data-panel="overview">${overview}</section>
  <section class="dpanel2" data-panel="payment"><div class="paycard" id="payment">
      <div class="phd"><span class="label">Payment</span><span class="pst ${st[1]}">${e(st[0])}</span></div>
      <div class="pamt"><span>${e(r.category)}</span><b>${e(r.fee || '')}</b></div>
      ${pay}
    </div>
    ${canChange ? `<details class="chg"><summary>Wrong category? Change it before you pay</summary>
      <form method="post" action="${B}/account/category"><input type="hidden" name="csrf" value="${e(csrf)}">
        <div class="feechips">${fees.map((f, i) => `<input type="radio" name="category" id="k${i}" value="${e(f.name)}" ${r.category === f.name ? 'checked' : ''}><label for="k${i}"><span>${e(f.name)}</span><b>${e(f.fee)}</b></label>`).join('')}</div>
        <button class="b2" type="submit">Save category</button></form></details>` : ''}</section>
  <section class="dpanel2" data-panel="profile">${profile}</section>
  ${presenting ? `<section class="dpanel2" data-panel="presentation">${presentation}</section>` : ''}
  <section class="dpanel2" data-panel="certificate">${cert}</section>
  <section class="dpanel2" data-panel="account">${acctPanel}</section>
</div></main>
<script>(function(){
var tabs=[].slice.call(document.querySelectorAll('.dtabs2 button')),panels=[].slice.call(document.querySelectorAll('.dpanel2'));
document.documentElement.classList.add('tabs-on');
function show(name,push){var p=panels.filter(function(x){return x.getAttribute('data-panel')===name})[0];if(!p)return;
  panels.forEach(function(x){x.hidden=x!==p});tabs.forEach(function(b){if(b.getAttribute('data-tab')===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(push)history.replaceState(null,'','#'+name)}
function fromHash(){var h=(location.hash||'').slice(1);if(!h)return show('overview');var el=document.getElementById(h),p=el&&el.closest?el.closest('.dpanel2'):null;show(p?p.getAttribute('data-panel'):(tabs.some(function(b){return b.getAttribute('data-tab')===h})?h:'overview'))}
tabs.forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-tab'),true);window.scrollTo({top:0})})});
document.addEventListener('click',function(ev){var g=ev.target.closest('[data-go]');if(g){show(g.getAttribute('data-go'),true);window.scrollTo({top:0})}var c=ev.target.closest('[data-copy]');if(c&&navigator.clipboard){var o=c.textContent;navigator.clipboard.writeText(c.getAttribute('data-copy')).then(function(){c.textContent='Copied ✓';setTimeout(function(){c.textContent=o},1600)})}});
window.addEventListener('hashchange',fromHash);fromHash();
})();</script>
<script src="${B}/assets/institution.js?v=${av('institution.js')}" defer></script>${PWJS}
<script>(function(){
var b=document.getElementById('cpRef');if(b)b.addEventListener('click',function(){var t=b.getAttribute('data-ref'),o=b.textContent;if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){b.textContent='Copied ✓';setTimeout(function(){b.textContent=o},1800)})});
document.querySelectorAll('input[name=participation]').forEach(function(x){x.addEventListener('change',function(){var h=document.getElementById('ptf2');if(h)h.hidden=!/presentation/i.test(x.value)})});
var ab=document.getElementById('abstract'),an=document.getElementById('abN');if(ab&&an)ab.addEventListener('input',function(){var n=ab.value.trim()?ab.value.trim().split(/\\s+/).length:0;an.textContent=n+' words'});
var d=document.getElementById('diet');if(d)d.addEventListener('change',function(){document.getElementById('dnf').hidden=d.value!=='Other'});
})();</script>
${ready ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" defer></script>
<script>window.QH_C=${JSON.stringify(certConf).replace(/</g, '\\u003c')};</script><script src="${B}/assets/cert.js?v=${av('cert.js')}" defer></script>
<script>document.addEventListener('DOMContentLoaded',function(){var P=${JSON.stringify(certP).replace(/</g, '\\u003c')},btn=document.getElementById('certBtn'),st=document.getElementById('certSt'),pv=document.getElementById('certPrev');
  window.ICCert.render(P).then(function(c){pv.src=c.toDataURL('image/jpeg',.85);pv.hidden=false});
  btn.addEventListener('click',function(){st.textContent='Preparing your PDF…';window.ICCert.render(P).then(function(c){window.ICCert.pdfOf(c).save(window.ICCert.fname(P));st.textContent='Downloaded.';
    fetch('${B}/account/certificate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'csrf=${e(csrf)}'})}).catch(function(){st.textContent='Sorry, something went wrong. Please try again.'})});
});</script>` : ''}` + foot();
}

function receipt(r) {
  const paid = r.pay_status === 'paid' || r.pay_status === 'waived';
  const row = (k, v) => (v ? `<tr><th>${e(k)}</th><td>${v}</td></tr>` : '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Receipt ${e(r.ref)} — ${e(cfg.eventName)}</title>
<link rel="stylesheet" href="${B}/assets/site.css?v=${av('site.css')}"></head><body class="rcpt">
<main class="rc"><header><img src="${B}/assets/icssst-art.png" alt="" width="200" height="82"><div><h1>Receipt</h1><p>${e(cfg.eventName)} · ${e(cfg.eventFull)}<br>${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)} · ${e(cfg.eventVenue)}</p></div></header>
<table>${row('Receipt for', e(PARTS.displayName(r)))}${row('Organisation', e(r.organisation))}${row('Invoice addressed to', r.billing ? nl2br(r.billing) : '')}${row('Email', e(r.email))}${row('Reference', `<b>${e(r.ref)}</b>`)}${row('Category', e(r.category))}${row('Amount', `<b>${e(r.pay_amount || r.fee || '')}</b>`)}${row('Status', r.pay_status === 'waived' ? 'No payment required' : 'Paid')}${row('Paid on', e(myDate(r.paid_at)))}${row('Payment', r.pay_source === 'stripe' ? 'Stripe' : 'Ticket2U')}${row('Order number', e(r.pay_ref || ''))}</table>
<p class="rn">${paid ? 'This page confirms that your registration fee has been received.' : 'Payment has not been received yet.'} For an official tax invoice or receipt, use the e-receipt that Ticket2U or Stripe emailed to you.</p>
<p class="no-print"><button class="btn" onclick="window.print()">Print or save as PDF</button></p>
<footer>${e(cfg.eventName)} organising committee · ${e(cfg.smtp.replyTo)}</footer></main></body></html>`;
}

const UPDATED = '9 November 2026';
const PROV = () => (cfg.payProvider === 'stripe' ? 'Stripe' : cfg.payProvider === 'both' ? 'Stripe or Ticket2U' : 'Ticket2U');
const HOST = () => e(SITE.replace(/^https?:\/\//, ''));
const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    body: () => `
<p>This policy explains how the organising committee of <b>${e(cfg.eventName)}</b>, the ${e(cfg.eventFull)} (${e(cfg.eventDateText)}, Penang), organised by the School of Physics, Universiti Sains Malaysia (“we”, “us”), handles personal data collected through <b>${HOST()}</b>.</p>
<h2>1. What we collect</h2>
<ul><li><b>Details you enter:</b> full name, email address, phone number (optional), institution or organisation, country and registration (fee) category.</li>
<li><b>Payment records:</b> the fee for your category, whether it has been paid, the amount and the payment reference (${PROV()} reference or order number). <b>We never see or store your card, bank or e-wallet details</b>; payments are made on ${PROV()}’s own pages.</li>
<li><b>If you choose “Continue with Google”:</b> your Google account name and email address and whether Google has verified that address. Nothing else from your Google account.</li>
<li><b>Technical data:</b> a one-way hashed form of your IP address (to limit abuse) and a security cookie that keeps you signed in. No advertising or tracking cookies.</li></ul>
<h2>2. Why we use it</h2>
<ul><li>to register you, let you sign in to your registration page and pay your fee;</li>
<li>to take your payment and confirm it against your registration;</li>
<li>to contact you about the programme, venue and changes;</li>
<li>to prepare the attendance list, name badges and certificates.</li></ul>
<h2>3. Sharing</h2>
<p>We do not sell your data. It is accessible only to the organising committee. Your payment is processed by <b>${PROV()}</b> under its own terms and privacy policy, using the details you give at checkout. Our hosting and email provider (Zoho Mail) process data on our behalf only to run this site and send you emails. MASS membership may be checked with MASS.</p>
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
<p>Fees are paid online from your registration page, through <b>${PROV()}</b> (FPX online banking, cards and e-wallets). ${cfg.payProvider === 'stripe' ? '' : 'At Ticket2U, use the same email address as your registration so the payment can be matched; Ticket2U may charge a processing fee shown at checkout. '}The provider issues your receipt. Fees in RM are charged in Malaysian ringgit; fees in USD are charged in US dollars and your bank may apply its own exchange rate. If your institution pays by purchase order (LO) or bank transfer, contact us before paying.</p>
<h2>4. Cancellation and refunds</h2>
<p>Requests to cancel must be emailed to <a href="mailto:${e(cfg.smtp.replyTo)}">${e(cfg.smtp.replyTo)}</a>. Refunds, where approved, are made to the original payment method through the same provider, less any non-refundable processing charges. A registration may be transferred to a colleague in the same category by emailing us before the conference. If the conference is cancelled by the organisers, fees will be refunded.</p>
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
  return head(`${d.title} — ${cfg.eventName}`, `${d.title} for the ${cfg.eventName} conference registration website.`, { path: '/' + kind }) + boldAbbr(`
<main class="legal"><div class="wrap"><span class="label">${e(cfg.eventName)}</span><h1>${d.title}</h1>${d.body()}</div></main>`) + foot();
}

module.exports = { e, head, foot, home, receipt, LOGO, BRAND_LOGOS, register, done, verifyCode, verify, legal, SITE, login, loginCode, account, forgot, resetPw };
