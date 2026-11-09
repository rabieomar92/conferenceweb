'use strict';
const cfg = require('../config');
const { e, head, foot, SITE } = require('./views');
const sp = require('./speakers');
const B = cfg.base;
const av = require('./assetv');

const HON = /^(prof|professor|assoc|associate|dr|ir|ts|mr|mrs|ms|dato'?|datuk|emeritus)\.?$/i;
const initials = (name) => { const w = String(name).split(/\s+/).filter((x) => x && !HON.test(x)); return ((w[0] || '')[0] || '') + ((w[w.length - 1] || '')[0] || ''); };
const lines = (s) => e(s).replace(/\n/g, '<br>');
const paras = (s) => String(s || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${lines(p)}</p>`).join('');
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const excerpt = (s, n = 38) => { const w = String(s || '').trim().split(/\s+/).filter(Boolean); return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ').replace(/[,;:.]$/, '') + '…'; };
const url = (s) => `${B}/speakers/${e(s.slug)}`;
const portrait = (s, cls = 'ph', lazy = true) => `<div class="${cls}">${s.photo_ver ? `<img src="${sp.photoUrl(s)}" alt="${e(s.full_name)}"${lazy ? ' loading="lazy"' : ''}>` : `<div class="mono">${e(initials(s.full_name))}</div>`}</div>`;
const affLine = (s) => [s.affiliation, s.country].filter(Boolean).map(e).join(' · ');

// ── home page section ─────────────────────────────────────
function section(list) {
  if (!list.length) return '';
  const feat = list.filter((s) => s.featured), rest = list.filter((s) => !s.featured);
  const tba = rest.length < 6 ? `<div class="spk tba"><div class="ph"><div class="mono">+</div></div><span class="label role">Speakers</span><h3>To be announced</h3><p>More invited speakers will be announced soon.</p></div>` : '';
  return `<section class="s" id="speakers"><div class="wrap grid2">
  <div class="sec-label"><span class="num">05</span><h2>Speakers</h2>${list.length ? `<a class="sec-more" href="${B}/speakers">Talks &amp; abstracts <span>→</span></a>` : ''}</div>
  <div>
    ${feat.map((s) => `<a class="spk vip" href="${url(s)}">
      ${portrait(s)}
      <div>
        <span class="label role">${e(s.role)}</span>
        <h3 style="font-size:clamp(32px,4vw,52px)">${e(s.full_name)}</h3>
        <p style="font-size:17px;max-width:520px">${s.position ? lines(s.position) : affLine(s)}</p>
        ${s.talk_title ? `<p class="talk"><span>Talk</span>${e(s.talk_title)}</p>` : ''}
        <span class="more">Read more <span>→</span></span>
      </div></a>`).join('')}
    <div class="speakers">
      ${rest.map((s) => `<a class="spk" href="${url(s)}">${portrait(s)}<span class="label role">${e(s.role)}</span><h3>${e(s.full_name)}</h3><p>${affLine(s)}</p>${s.talk_title ? `<p class="talk">${e(s.talk_title)}</p>` : ''}</a>`).join('')}
      ${tba}
    </div>
  </div>
</div></section>`;
}

// ── /speakers : programme-style list of every talk ─────────
function index(list) {
  return head(`Speakers & talks — ${cfg.eventName}`, `Invited speakers, talk titles and abstracts for ${cfg.eventName}, ${cfg.eventDateText}, Universiti Sains Malaysia.`, { path: '/speakers' }) + `
<main class="spx">
  <header class="spx-hd"><div class="wrap">
    <span class="label">${e(cfg.eventDateText)} · ${e(cfg.eventVenue)}</span>
    <h1>Speakers <em>&amp;</em> talks</h1>
    <p>Plenary, keynote and invited speakers of the 11th International Conference on Solid State Science and Technology.</p>
  </div></header>
  <div class="wrap">
    <ol class="spx-list">
    ${list.map((s, i) => `<li><a href="${url(s)}">
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
      ${portrait(s, 'ph')}
      <div class="who"><span class="label">${e(s.role)}</span><h2>${e(s.full_name)}</h2><p>${affLine(s)}</p></div>
      <div class="what">${s.talk_title ? `<h3>${e(s.talk_title)}</h3>${s.abstract ? `<p>${e(excerpt(s.abstract))}</p>` : ''}` : '<h3 class="tbc">Talk title to be announced</h3>'}${sp.slotShort(s) ? `<span class="slot">${e(sp.slotShort(s))}</span>` : ''}<span class="more">${s.abstract ? 'Read the abstract' : 'Speaker profile'} <span>→</span></span></div>
    </a></li>`).join('')}
    </ol>
    ${list.length ? '' : '<p class="body-txt">Speakers will be announced soon.</p>'}
  </div>
</main>` + foot();
}

// ── /speakers/:slug : one speaker and their talk ───────────
function detail(s, prev, next, open) {
  const desc = s.talk_title ? `${s.full_name} (${s.affiliation}) — “${s.talk_title}”. ${excerpt(s.abstract, 26)}` : `${s.full_name}, ${s.affiliation} — ${s.role} at ${cfg.eventName}, ${cfg.eventDateText}.`;
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Person', name: s.full_name, jobTitle: s.position.split('\n')[0] || undefined,
    affiliation: s.affiliation ? { '@type': 'Organization', name: s.affiliation } : undefined, url: `${SITE}/speakers/${s.slug}`,
    image: s.photo_ver ? `${SITE}/speakers/photo/${s.id}.jpg` : undefined, sameAs: s.website ? [s.website] : undefined,
    performerIn: { '@type': 'Event', name: cfg.eventName, startDate: cfg.eventDate || '2026-12-22', location: { '@type': 'Place', name: cfg.eventVenue } },
  }).replace(/</g, '\\u003c');
  return head(`${s.full_name}${s.talk_title ? ' — ' + s.talk_title : ''} | ${cfg.eventName}`, desc, { path: `/speakers/${s.slug}` }).replace('</head>', `<script type="application/ld+json">${ld}</script></head>`) + `
<main class="spd">
  <div class="wrap">
    <a class="back" href="${B}/speakers">← All speakers</a>
    <div class="spd-top">
      ${portrait(s, 'spd-ph', false)}
      <div class="spd-who">
        <span class="label">${e(s.role)}</span>
        <h1>${e(s.full_name)}</h1>
        ${s.position ? `<p class="pos">${lines(s.position)}</p>` : ''}
        <p class="aff">${affLine(s)}</p>
        ${s.website ? `<a class="web" href="${e(s.website)}" rel="noopener nofollow" target="_blank">${e(s.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ↗</a>` : ''}
      </div>
    </div>
    <section class="spd-talk">
      <div class="spd-side"><span class="label">The talk</span>
        <dl>${sp.hasSlot(s) ? `<div><dt>Date</dt><dd>${e(cfg.eventDayLabel(s.slot_date))}</dd></div><div><dt>Time</dt><dd>${e(sp.timeText(s))}</dd></div>` : `<div><dt>Date</dt><dd>${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)}</dd></div>${s.slot ? `<div><dt>Time</dt><dd>${e(s.slot)}</dd></div>` : ''}`}<div><dt>Venue</dt><dd>${e(cfg.eventVenue)}</dd></div></dl>
        ${open ? `<a class="btn" href="${B}/register">Reserve your seat <span class="arr">→</span></a>` : ''}
      </div>
      <div class="spd-main">
        <h2 class="${s.talk_title ? '' : 'tbc'}">${s.talk_title ? e(s.talk_title) : 'Talk title to be announced'}</h2>
        ${s.abstract ? `<span class="label sub">Abstract</span><div class="prose">${paras(s.abstract)}</div>` : '<p class="prose muted">The abstract will be published here soon.</p>'}
        ${s.bio ? `<span class="label sub">About the speaker</span><div class="prose">${paras(s.bio)}</div>` : ''}
      </div>
    </section>
    <nav class="spd-nav">
      ${prev ? `<a href="${url(prev)}"><span>← Previous speaker</span>${e(prev.full_name)}</a>` : '<span></span>'}
      ${next ? `<a class="r" href="${url(next)}"><span>Next speaker →</span>${e(next.full_name)}</a>` : ''}
    </nav>
  </div>
</main>` + foot();
}

// ── shared profile form (speaker portal + admin) ──────────
function profileFields(v, { admin = false } = {}) {
  const L = sp.LIMITS;
  const ta = (k, label, rows, hint, ph) => `<div class="fld"><label class="l" for="${k}">${label}</label>
      <textarea id="${k}" name="${k}" rows="${rows}" maxlength="${L[k]}" data-count="${L[k]}" placeholder="${e(ph || '')}">${e(v[k])}</textarea>
      <p class="hint"><span>${hint}</span><span class="cnt" data-for="${k}"></span></p></div>`;
  const tx = (k, label, ph, extra = '') => `<div class="fld"><label class="l" for="${k}">${label}</label><input type="text" id="${k}" name="${k}" maxlength="${L[k] || 200}" placeholder="${e(ph || '')}" value="${e(v[k])}" ${extra}></div>`;
  return `
  <fieldset class="grp"><legend><span class="n">01</span>Your talk</legend>
    <div class="fld"><label class="l" for="talk_title">Talk title</label><textarea class="tt" id="talk_title" name="talk_title" rows="2" maxlength="${L.talk_title}" placeholder="e.g. Wide-bandgap oxide thin films for power semiconductor devices">${e(v.talk_title)}</textarea></div>
    ${ta('abstract', 'Abstract', 12, 'Plain text. Leave an empty line between paragraphs. About 150–300 words reads best.', 'What your talk is about, what the audience will learn…')}
  </fieldset>
  <fieldset class="grp"><legend><span class="n">02</span>About you</legend>
    ${tx('full_name', 'Full name, with title', 'e.g. Prof. Dr. Aiko Tanaka', 'required')}
    <div class="fld"><label class="l" for="position">Position <span class="opt">(optional, one per line)</span></label><textarea id="position" name="position" rows="2" maxlength="${L.position}" placeholder="e.g. Professor, Graduate School of Science">${e(v.position)}</textarea></div>
    <div class="two">${tx('affiliation', 'Affiliation', 'e.g. Universiti Sains Malaysia')}${tx('country', 'Country', 'e.g. Malaysia')}</div>
    ${ta('bio', 'Short biography', 7, 'Written in the third person reads best on the website.', 'Prof. Tanaka received her PhD from…')}
    ${tx('website', 'Website <span class="opt">(optional)</span>', 'e.g. https://www.example.ac.jp/~tanaka')}
  </fieldset>
  ${admin ? `<fieldset class="grp"><legend><span class="n">03</span>Organiser settings</legend>
    <div class="two"><div class="fld"><label class="l" for="email">Sign-in email</label><input type="email" id="email" name="email" maxlength="160" placeholder="speaker@university.edu" value="${e(v.email || '')}"><p class="hint">The invitation is sent here. The speaker signs in with this address and their own password.</p></div>
    <div class="fld"><label class="l" for="role">Role</label><select id="role" name="role">${sp.ROLES.map((r) => `<option ${v.role === r ? 'selected' : ''}>${e(r)}</option>`).join('')}</select></div></div>
    <div class="fld"><label class="l" for="sort">Order on the page</label><input type="text" inputmode="numeric" id="sort" name="sort" value="${e(v.sort ?? 100)}"><p class="hint">Lower numbers come first.</p></div>
    <div class="sched" data-sched><div class="sched-h"><b>Talk schedule</b><span class="opt">(optional)</span></div>
      <div class="sched-g"><div class="fld"><label class="l" for="slot_date">Date</label><select id="slot_date" name="slot_date"><option value="">Not scheduled yet</option>${(cfg.eventDays || []).map((d) => `<option value="${d}" ${v.slot_date === d ? 'selected' : ''}>${e(cfg.eventDayLabel(d))}</option>`).join('')}</select></div>
      <div class="fld"><label class="l" for="slot_start">Starts</label><input type="time" id="slot_start" name="slot_start" value="${e(v.slot_start || '')}"></div>
      <div class="fld"><label class="l" for="slot_end">Ends</label><input type="time" id="slot_end" name="slot_end" value="${e(v.slot_end || '')}"></div></div>
      <p class="hint">${v.slot_mail_err ? `<b style="color:#B91C1C">The last schedule email could not be sent (${e(v.slot_mail_err)}).</b> ` : ''}${v.slot_sent_at ? `Last emailed to the speaker on ${e(String(v.slot_sent_at).slice(0, 10))}. ` : ''}You will be asked to confirm before a new date or time is saved, and can email it to the speaker.</p></div>
    <label class="consent"><input type="checkbox" name="featured" value="1" ${v.featured ? 'checked' : ''}><span><b>Featured</b> — shown large at the top (e.g. Guest of Honour).</span></label>
    <label class="consent"><input type="checkbox" name="published" value="1" ${v.published ? 'checked' : ''}><span><b>Published</b> — visible on the website.</span></label>
  </fieldset>` : ''}`;
}

const photoBox = (s, endpoint, csrf) => `<div class="pbox" data-endpoint="${e(endpoint)}" data-csrf="${e(csrf)}">
  ${portrait(s, 'ph', false)}
  <div class="pact"><label class="b2">${s.photo_ver ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${s.photo_ver ? '<button type="button" class="b2 lnk" data-remove>Remove</button>' : ''}</div>
  <p class="hint">A portrait photo, ideally head and shoulders. It is cropped to 4:5 automatically.</p>
  <p class="pmsg" role="status"></p>
</div>`;

const checkBox = (s) => {
  const c = sp.checklist(s), pct = sp.completeness(s);
  return `<div class="chk"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div><div><span class="label">Profile</span><ul>${c.map(([k, ok]) => `<li class="${ok ? 'ok' : ''}">${e(k)}</li>`).join('')}</ul></div></div>`;
};

const flashBox = (f) => `${f && f.ok ? `<div class="okmsg" role="status">${e(f.ok)}</div>` : ''}${f && f.err && f.err.length ? `<div class="err" role="alert"><ul>${f.err.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : ''}`;

// ── speaker portal ────────────────────────────────────────
const portalBar = (csrf, s) => `<header class="top"><div class="wrap"><a class="brand" href="${B}/">${require('./views').BRAND_LOGOS()}${require('./views').LOGO}</a><nav>${s && s.published ? `<a href="${url(s)}" target="_blank">View my page</a>` : ''}<form method="post" action="${B}/speaker/logout" style="display:inline"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="pill">Sign out</button></form></nav></div></header>`;

const pwField = (id, label, auto, extra = '') => `<div class="fld"><label class="l" for="${id}">${label}</label>
      <div class="pwrap"><input type="password" id="${id}" name="${id}" required maxlength="128" autocomplete="${auto}" ${extra}><button type="button" class="pwtog" data-for="${id}" aria-label="Show password">Show</button></div></div>`;
const PW_JS = `<script>(function(){document.querySelectorAll('.pwtog').forEach(function(b){b.addEventListener('click',function(){var i=document.getElementById(b.getAttribute('data-for')),show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password')})})})();</script>`;
const errBox = (err) => (err ? `<div class="err" role="alert">${e(err)}</div>` : '');
const okBox = (m) => (m ? `<div class="okmsg" role="status">${e(m)}</div>` : '');
const page = (title, aside, body, extra = '') => head(`${title} — ${cfg.eventName}`, '', { noindex: true }) + `<main class="reg spl"><div class="wrap grid">${aside}<div>${body}</div></div></main>${extra}` + foot();
const side = (h, p, facts = '') => `<aside><span class="label">Speaker portal</span><h1>${h}</h1><p>${p}</p>${facts}</aside>`;
const helpFact = `<div class="facts"><div><span>Questions</span><span>${e(cfg.smtp.replyTo)}</span></div></div>`;

function login({ csrf, err = '', info = '', email = '' }) {
  return page('Speaker sign-in',
    side('Welcome,<br><em>speaker.</em>', 'Sign in to add your talk title, abstract, biography and photo. Whatever you save appears on the conference website straight away.', helpFact),
    `<form class="f" method="post" action="${B}/speaker/login" novalidate>
    ${errBox(err)}${okBox(info)}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="email">Email address</label>
      <input type="email" id="email" name="email" required maxlength="160" autocomplete="username" ${email ? '' : 'autofocus'} placeholder="The address the organisers invited" value="${e(email)}"></div>
    ${pwField('password', 'Password', 'current-password', email ? 'autofocus' : '')}
    <button class="btn" type="submit">Sign in <span class="arr">→</span></button>
    <p class="hint" style="margin-top:18px"><a href="${B}/speaker/forgot">Forgot your password?</a> · First time here? Use the <b>Accept invitation</b> button in the email the organisers sent you.</p>
  </form>`, PW_JS);
}

function forgot({ csrf, err = '', email = '' }) {
  return page('Reset password',
    side('Forgot your<br><em>password?</em>', `Enter the email address the organisers invited and we will send you a 6-digit code (valid for ${cfg.codeMinutes} minutes). With it you can choose a new password.`, helpFact),
    `<form class="f" method="post" action="${B}/speaker/forgot" novalidate>
    ${errBox(err)}<input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="email">Email address</label>
      <input type="email" id="email" name="email" required maxlength="160" autocomplete="email" autofocus value="${e(email)}"></div>
    <button class="btn" type="submit">Email me a reset code <span class="arr">→</span></button>
    <p class="hint" style="margin-top:18px"><a href="${B}/speaker/login">Back to sign-in</a></p>
  </form>`);
}

function code({ csrf, masked, err = '', info = '' }) {
  return page('Enter your code',
    side('Check your<br><em>inbox.</em>', `If <b>${e(masked)}</b> belongs to a speaker, we have just sent a 6-digit reset code to it. It is valid for ${cfg.codeMinutes} minutes.`, '<div class="facts"><div><span>Tip</span><span>Check spam / junk if you don\'t see it</span></div></div>'),
    `<form class="f" method="post" action="${B}/speaker/verify" novalidate autocomplete="off">
    ${errBox(err)}${okBox(info)}
    <input type="hidden" name="csrf" value="${e(csrf)}">
    <div class="fld"><label class="l" for="code">Reset code</label>
      <input type="text" id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus required placeholder="······" style="font-size:38px;letter-spacing:.5em;font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif"></div>
    <button class="btn" type="submit">Continue <span class="arr">→</span></button>
  </form>
  <p style="margin-top:22px;font-size:14px"><a href="${B}/speaker/forgot" style="color:var(--muted)">Use a different email or send a new code</a></p>`,
    `<script>(function(){var c=document.getElementById('code');c.addEventListener('input',function(){c.value=c.value.replace(/\\D/g,'').slice(0,6)})})();</script>`);
}

function setPw({ csrf, action, title, h, lead, button, err = '', first = '' }) {
  return page(title, side(h, lead, helpFact),
    `<form class="f" method="post" action="${action}" novalidate>
    ${errBox(err)}<input type="hidden" name="csrf" value="${e(csrf)}">
    ${first}
    ${pwField('password', 'New password', 'new-password', 'autofocus minlength="10"')}
    ${pwField('confirm', 'Repeat the password', 'new-password', 'minlength="10"')}
    <p class="hint" style="margin:-4px 0 18px">At least 10 characters. A few random words make a strong, easy-to-remember password.</p>
    <button class="btn" type="submit">${button} <span class="arr">→</span></button>
  </form>`, PW_JS);
}
const reset = (o) => setPw({ ...o, action: `${B}/speaker/reset`, title: 'Choose a new password', h: 'Choose a new<br><em>password.</em>', lead: 'Your code was accepted. Choose a new password for the speaker portal; you will be signed in straight away.', button: 'Save password and sign in' });

function accept({ csrf, s, token, err = '' }) {
  return setPw({ csrf, err, action: `${B}/speaker/invite/${token}/accept`, title: 'Accept invitation', h: 'Welcome,<br><em>' + e(s.full_name.replace(/^(prof\.?|professor|dr\.?|assoc\.?|ir\.?|ts\.?)\s+/i, '').split(/\s+/)[0] || 'speaker') + '.</em>',
    lead: `You are invited to join <b>${e(cfg.eventName)}</b> (${e(cfg.eventDateText)}) as ${/^[AEIOU]/i.test(s.role) ? 'an' : 'a'} <b>${e(s.role)}</b>. Choose a password to accept and open your speaker portal.`, button: 'Accept invitation',
    first: `<div class="fld"><label class="l">Signing in as</label><input type="text" value="${e(s.email || '')}" readonly class="ro" tabindex="-1"></div>` })
    .replace('</form>', `<p class="hint" style="margin-top:18px">Not able to join? <a href="${B}/speaker/invite/${token}?a=decline">Decline the invitation</a></p></form>`);
}

function declineConfirm({ csrf, s, token, err = '' }) {
  return page('Decline invitation',
    side('Decline<br><em>invitation?</em>', `Dear ${e(s.full_name)}, we would be sorry to miss you. If you decline, the organisers are told and your page stays hidden from the website.`, helpFact),
    `<form class="f" method="post" action="${B}/speaker/invite/${token}/decline" novalidate>
    ${errBox(err)}<input type="hidden" name="csrf" value="${e(csrf)}">
    <button class="btn" type="submit" style="background:#B91C1C;border-color:#B91C1C">Yes, decline the invitation</button>
    <p class="hint" style="margin-top:18px">Changed your mind? <a href="${B}/speaker/invite/${token}">Accept the invitation instead</a></p>
  </form>`);
}

function notice({ h, p, link = '', label = '' }) {
  return page(String(h).replace(/<[^>]+>/g, ' ').trim(), side(h, p, helpFact), link ? `<p><a class="btn" href="${link}" style="display:inline-block;text-decoration:none">${label} <span class="arr">→</span></a></p>` : '');
}

function portal({ s, csrf, flash }) {
  const first = s.full_name.split(/\s+/).filter((w) => !HON.test(w))[0] || '';
  return head(`Your speaker profile — ${cfg.eventName}`, '', { noindex: true }).replace(/<header class="top">[\s\S]*?<\/header>/, portalBar(csrf, s)) + `
<main class="prt"><div class="wrap">
  <div class="prt-hd"><span class="label">Speaker portal</span><h1>Hello, ${e(first)}.</h1>
    <p>Everything you save here is shown on <a href="${url(s)}" target="_blank">your speaker page</a> and on the home page straight away.</p></div>
  <div class="prt-grid">
    <aside class="prt-side">${photoBox(s, `${B}/speaker/photo`, csrf)}${checkBox(s)}
      <div class="prt-meta"><div><span>Role</span><b>${e(s.role)}</b></div>${sp.slotShort(s) ? `<div><span>Your talk</span><b>${e(sp.slotText(s) || s.slot)}</b></div>` : ''}<div><span>Signed in as</span><b>${e(s.email)}</b></div></div></aside>
    <form class="f prt-form" method="post" action="${B}/speaker" novalidate data-guard>
      ${flashBox(flash)}
      <input type="hidden" name="csrf" value="${e(csrf)}">
      ${profileFields(s)}
      <div class="savebar"><span class="state">All changes saved</span><button class="btn" type="submit">Save &amp; publish <span class="arr">→</span></button></div>
    </form>
  </div>
</div></main>
<script src="${B}/assets/speaker.js?v=${av('speaker.js')}" defer></script>` + foot();
}

// ── admin ─────────────────────────────────────────────────
const ADM_CSS = `<style>
.addbar{display:flex;gap:24px;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--rule);border-left:3px solid var(--amber);padding:18px 22px;margin:0 0 26px}.addbar b{display:block;color:var(--navy);font-size:15.5px}.addbar span{display:block;color:var(--muted);font-size:14px;margin-top:2px}.addbar .b2{flex:none}
.add-card .fld{margin-bottom:18px}.add-steps{display:flex;gap:18px;margin:0 0 14px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:#B9B2C4}.add-steps i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid currentColor;border-radius:50%;margin-right:8px;font-size:10px;letter-spacing:0}.add-steps .on{color:var(--amber)}.add-steps .ck{color:var(--navy)}
.add-card h2{margin-top:0}.add-sum{border:1px solid var(--rule);margin:0 0 16px}.add-sum div{padding:12px 16px}.add-sum div+div{border-top:1px solid var(--rule)}.add-sum span{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);font-weight:700;margin-bottom:3px}.add-sum b{font:600 17px/1.35 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy);word-break:break-word}
.mdl-err{background:#FDECEC;border-left:3px solid #B91C1C;color:#7F1D1D;padding:10px 14px;font-size:14px;margin:0 0 6px}.mdl-warn{background:#FFF6E0;border-left:3px solid var(--amber);color:#6B4A0C;padding:10px 14px;font-size:14px;margin:0 0 14px}.mdl-err[hidden],.mdl-warn[hidden],.add-p[hidden]{display:none}
.add-card .consent{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5;color:var(--body,#3D3858)}.add-card .consent input{margin-top:4px;flex:none}.add-card .b2:disabled{opacity:.4;cursor:not-allowed}.mdl-card.add-card{max-height:calc(100vh - 40px);overflow:auto}
.tp{position:relative}.tp-b{width:100%;text-align:left;background:#fff;border:1px solid var(--rule);padding:11px 38px 11px 14px;font:600 18px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy);cursor:pointer;position:relative;min-height:46px}.tp-b.ph{color:#B9B2C4;font-weight:400}.tp-b:hover,.tp-b[aria-expanded=true]{border-color:var(--navy)}
.tp-b:after{content:'';position:absolute;right:14px;top:50%;width:16px;height:16px;margin-top:-8px;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6.5' fill='none' stroke='%237C748E' stroke-width='1.4'/><path d='M8 4.5V8l2.4 1.6' fill='none' stroke='%237C748E' stroke-width='1.4' stroke-linecap='round'/></svg>") no-repeat center}
.tp-pop{position:absolute;z-index:60;left:0;top:calc(100% + 6px);width:240px;background:#fff;border:1px solid var(--navy);box-shadow:0 18px 44px rgba(20,16,40,.22);padding:12px}.tp-pop[hidden]{display:none}
.tp-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tp-col>span{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);font-weight:700;margin:0 0 6px 2px}
.tp-list{display:grid;gap:3px;max-height:208px;overflow:auto;padding-right:2px}.tp-list button{border:0;background:#F6F3EC;padding:8px 0;font:500 16px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy);cursor:pointer;text-align:center}.tp-list button:hover{background:#EBE5D6}.tp-list button.on{background:var(--navy);color:#fff}
.tp-foot{display:flex;justify-content:space-between;margin-top:10px;font-size:12px}.tp-foot button{background:none;border:0;color:var(--muted);cursor:pointer;text-decoration:underline;font:inherit;padding:2px}
@media(max-width:640px){.addbar{flex-direction:column;align-items:stretch}.tp-pop{width:min(240px,calc(100vw - 60px))}}
.sched{border:1px solid var(--rule);background:#FBF8F2;padding:18px 20px 6px;margin:6px 0 18px}.sched-h{display:flex;gap:10px;align-items:baseline;margin-bottom:12px;color:var(--navy)}
.sched-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.sched-g .fld:first-child{grid-column:1/-1}.sched .fld .ss-b{font-size:17px}.sched .tp-b{white-space:nowrap;font-size:17px;min-height:0;padding:10px 38px 12px 4px;border:0;border-bottom:1px solid var(--rule);background:transparent}.sched .tp-b:hover,.sched .tp-b[aria-expanded=true]{border-bottom-color:var(--navy)}.sched .tp-b:after{right:4px}.sched select,.sched input[type=time]{width:100%;font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif}
.mdl[hidden]{display:none}.mdl{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:20px}.mdl-bg{position:absolute;inset:0;background:rgba(20,16,40,.55);backdrop-filter:blur(3px)}
.mdl-card{position:relative;background:#fff;max-width:480px;width:100%;padding:34px 34px 28px;border-top:4px solid var(--amber);box-shadow:0 30px 80px rgba(20,16,40,.35);animation:mdlIn .25s ease}@keyframes mdlIn{from{opacity:0;transform:translateY(14px)}}
.mdl-card h2{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy);font-size:28px;margin:6px 0 10px;letter-spacing:-.02em}.mdl-who{color:var(--muted);margin:0 0 18px}
.mdl-when{display:grid;grid-template-columns:1.5fr 1fr;border:1px solid var(--rule);margin-bottom:12px}.mdl-when div{padding:14px 16px}.mdl-when div+div{border-left:1px solid var(--rule)}
.mdl-when span{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);font-weight:700;margin-bottom:4px}.mdl-when b{font:600 17px/1.35 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy)}
.mdl-was{font-size:13px;color:var(--muted);margin:0 0 14px}.mdl-was:empty{display:none}.mdl-mail em{font-style:normal;color:var(--muted)}.mdl-mail.off{display:none}.mdl-act{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}
@media(max-width:640px){.mdl-card{padding:26px 22px 22px}.mdl-act{flex-direction:column-reverse}.mdl-act .b2{text-align:center}}
.adm{padding:44px 0 90px}.adm h1{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:42px;letter-spacing:-.025em;color:var(--navy);margin:8px 0 10px}.adm .intro{color:var(--muted);max-width:720px;margin-bottom:30px}
.b2{display:inline-block;background:#fff;color:var(--navy);border:1px solid var(--navy);padding:11px 16px;font:700 11px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:all .2s}
.b2:hover{background:var(--navy);color:#fff}.b2.pri{background:var(--navy);color:#fff}.b2.pri:hover{background:var(--amber);border-color:var(--amber)}.b2.dng{border-color:#B91C1C;color:#B91C1C}.b2.dng:hover{background:#B91C1C;color:#fff}
.sl{background:#fff;border:1px solid var(--rule)}.sl-row{display:grid;grid-template-columns:64px minmax(0,1.3fr) minmax(0,1.6fr) 140px 150px auto;gap:20px;align-items:center;padding:16px 20px;border-bottom:1px solid #EFEBE3}
.sl-row:last-child{border:0}.sl-row .ph{width:64px;aspect-ratio:4/5;overflow:hidden;background:var(--paper-mid);position:relative}.sl-row .ph img{width:100%;height:100%;object-fit:cover}.sl-row .mono{position:absolute;inset:0;display:grid;place-items:center;font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:22px;color:#B9B2C4}
.sl-row b{display:block;color:var(--navy);font-size:15.5px}.sl-row small{display:block;color:var(--muted);font-size:13px;line-height:1.45}.sl-row .tt{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-style:italic;color:var(--navy);font-size:15px;line-height:1.35}.sl-row .tt.no{color:#B9B2C4;font-style:normal;font-family:inherit;font-size:13px}
.bar2{height:6px;background:#EFEBE3;margin-top:6px}.bar2 i{display:block;height:100%;background:var(--amber)}.tag{display:inline-block;font-size:11px;padding:3px 9px;border:1px solid var(--rule);color:var(--muted)}.tag.y{background:#EAF4EC;border-color:#BBD9C1;color:#1F6B34}
.sl-row .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.sl-hd{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);font-weight:700;padding:12px 20px;border-bottom:1px solid var(--rule)}
.addf{display:grid;grid-template-columns:1.2fr 1.2fr 1fr auto;gap:14px;align-items:end;background:#fff;border:1px solid var(--rule);padding:22px 24px;margin:0 0 26px}.addf .fld{margin:0}
@media(max-width:1000px){.sl-row{grid-template-columns:56px 1fr;}.sl-row>*:nth-child(n+3){grid-column:2}.addf{grid-template-columns:1fr}}
</style>`;

const stLine = (s) => {
  const st = sp.state(s), d = (x) => e(String(x || '').slice(0, 10));
  return st === 'active' ? (s.last_login ? 'Active · last sign-in ' + d(s.last_login) : 'Accepted ' + d(s.accepted_at))
    : st === 'invited' ? 'Invited ' + d(s.invited_at) + ' · awaiting reply'
    : st === 'declined' ? '<span style="color:#B91C1C">Declined ' + d(s.declined_at) + '</span>' : 'Not invited';
};
function adminList({ rows, csrf, flash, topbar }) {
  return topbar + `<main class="adm"><div class="wrap">
  <span class="label">Programme</span><h1>Speakers</h1>
  <p class="intro">Add a speaker with their email, then send the invitation. The email has <b>Accept</b> and <b>Decline</b> buttons; on accepting, the speaker chooses a password and then fills in their talk, abstract, biography and photo. Their changes appear on the website immediately. You can edit any profile yourself too.</p>
  ${flashBox(flash)}
  <div class="addbar"><div><b>Adding a speaker is a deliberate step.</b><span>You will enter the details, then review and confirm them. Nothing is published or emailed until you choose to.</span></div><button type="button" class="b2 pri" id="addOpen">Add a speaker…</button></div>
  <div class="sl"><div class="sl-row sl-hd"><span></span><span>Speaker</span><span>Talk</span><span>Profile</span><span>Status</span><span></span></div>
  ${rows.map((s) => { const pct = sp.completeness(s); return `<div class="sl-row">
    ${portrait(s)}
    <div><b>${e(s.full_name)}</b><small>${e(s.role)}${s.featured ? ' · Featured' : ''}</small><small>${s.email ? e(s.email) : '<i style="color:#B91C1C">No sign-in email yet</i>'}</small></div>
    <div>${s.talk_title ? `<div class="tt">${e(s.talk_title)}</div>` : '<div class="tt no">No talk title yet</div>'}<small>${s.abstract ? words(s.abstract) + ' words abstract' : 'No abstract'}${sp.slotShort(s) ? ' · ' + e(sp.slotShort(s)) : ''}</small></div>
    <div><small>${pct}% complete</small><div class="bar2"><i style="width:${pct}%"></i></div></div>
    <div><span class="tag ${s.published ? 'y' : ''}">${s.published ? 'Published' : 'Hidden'}</span><small style="margin-top:6px">${stLine(s)}</small></div>
    <div class="acts"><a class="b2" href="${B}/admin/speakers/${s.id}">Edit</a>${s.email && sp.state(s) !== 'active' ? `<form method="post" action="${B}/admin/speakers/${s.id}/invite"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="b2">${{ new: 'Send invite', invited: 'Re-send invite', declined: 'Invite again' }[sp.state(s)]}</button></form>` : ''}${s.published ? `<a class="b2" href="${url(s)}" target="_blank">View</a>` : ''}</div>
  </div>`; }).join('')}
  ${rows.length ? '' : '<div class="sl-row"><span></span><small>No speakers yet. Add the first one above.</small></div>'}
  </div>
  <p class="hint" style="margin-top:18px">Speakers sign in at <b>${e(SITE)}/speaker</b>.</p>
</div></main>
<div class="mdl" id="addModal" hidden role="dialog" aria-modal="true" aria-labelledby="addT" data-names="${e(JSON.stringify(rows.map((r) => r.full_name.toLowerCase())))}" data-emails="${e(JSON.stringify(rows.map((r) => (r.email || '').toLowerCase()).filter(Boolean)))}"><div class="mdl-bg" data-close></div>
<form class="mdl-card add-card" method="post" action="${B}/admin/speakers/new" novalidate autocomplete="off">
  <input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="confirmed" value=""><input type="hidden" name="dup_ok" value="">
  <div class="add-steps"><span class="on" data-s="1"><i>1</i>Details</span><span data-s="2"><i>2</i>Review</span></div>
  <div class="add-p" data-p="1">
    <h2 id="addT">Who is the speaker?</h2>
    <p class="mdl-who">The email address is where the invitation goes, so please type it carefully.</p>
    <div class="fld"><label class="l" for="an">Full name, with title</label><input type="text" id="an" name="full_name" maxlength="120" placeholder="Prof. Dr. Aiko Tanaka"></div>
    <div class="fld"><label class="l" for="ae">Email address</label><input type="email" id="ae" name="email" maxlength="160" placeholder="speaker@university.edu"></div>
    <div class="fld"><label class="l" for="ae2">Type the email address again</label><input type="email" id="ae2" name="email2" maxlength="160" placeholder="speaker@university.edu" autocomplete="off"></div>
    <div class="fld"><label class="l" for="ar">Role</label><select id="ar" name="role">${sp.ROLES.map((r) => `<option ${r === 'Invited Speaker' ? 'selected' : ''}>${e(r)}</option>`).join('')}</select></div>
    <p class="mdl-err" role="alert" hidden></p>
    <div class="mdl-act"><button type="button" class="b2" data-close>Cancel</button><button type="button" class="b2 pri" id="addNext">Review</button></div>
  </div>
  <div class="add-p" data-p="2" hidden>
    <h2>Please check these details</h2>
    <p class="mdl-who">Once added, the speaker appears in your list and you can send the invitation.</p>
    <div class="add-sum"><div><span>Name</span><b data-r="n"></b></div><div><span>Email</span><b data-r="e"></b></div><div><span>Role</span><b data-r="r"></b></div></div>
    <p class="mdl-warn" hidden></p>
    <label class="consent mdl-mail"><input type="checkbox" id="addOk"><span>I have checked the name, email address and role. I understand the speaker stays hidden from the website and is not emailed until I send the invitation.</span></label>
    <div class="mdl-act"><button type="button" class="b2" id="addBack">Back</button><button type="submit" class="b2 pri" id="addGo" disabled>Add speaker</button></div>
  </div>
</form></div><script src="${B}/assets/speaker.js?v=${av('speaker.js')}" defer></script>`;
}

function adminEdit({ s, csrf, flash, topbar }) {
  return topbar + `<main class="adm prt"><div class="wrap">
  <a class="back" href="${B}/admin/speakers">← All speakers</a>
  <div class="prt-hd"><span class="label">Edit speaker</span><h1>${e(s.full_name)}</h1>${s.published ? `<p><a href="${url(s)}" target="_blank">View public page ↗</a></p>` : '<p>This speaker is hidden from the website.</p>'}</div>
  <div class="prt-grid">
    <aside class="prt-side">${photoBox(s, `${B}/admin/speakers/${s.id}/photo`, csrf)}${checkBox(s)}
      <div class="prt-meta"><div><span>Last updated</span><b>${s.updated_at ? e(s.updated_at.slice(0, 16).replace('T', ' ')) + ' UTC' : '—'}${s.updated_by ? ' · by ' + e(s.updated_by) : ''}</b></div><div><span>Last sign-in</span><b>${s.last_login ? e(s.last_login.slice(0, 10)) : 'Never'}</b></div></div>
      <form method="post" action="${B}/admin/speakers/${s.id}/delete" data-confirm="Delete ${e(s.full_name)} and their photo? This cannot be undone." style="margin-top:26px"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="b2 dng">Delete speaker</button></form>
    </aside>
    <form class="f prt-form" method="post" action="${B}/admin/speakers/${s.id}" novalidate data-guard data-spk="${e(s.full_name)}" data-email="${e(s.email || '')}" data-orig="${e(sp.slotKey(s))}" data-labels="${e(JSON.stringify(Object.fromEntries((cfg.eventDays || []).map((d) => [d, cfg.eventDayLabel(d)]))))}">
      ${flashBox(flash)}
      <input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="sched_ok" value=""><input type="hidden" name="notify" value="">
      ${profileFields(s, { admin: true })}
      <div class="savebar"><span class="state">All changes saved</span><button class="btn" type="submit">Save <span class="arr">→</span></button></div>
    </form>
  </div>
</div></main>
<div class="mdl" id="schedModal" hidden role="dialog" aria-modal="true" aria-labelledby="mdlT"><div class="mdl-bg" data-close></div><div class="mdl-card">
  <span class="label" id="mdlK">Confirm schedule</span><h2 id="mdlT">Set this talk time?</h2>
  <p class="mdl-who"></p>
  <div class="mdl-when"><div><span>Date</span><b data-d></b></div><div><span>Time</span><b data-t></b></div></div>
  <p class="mdl-was"></p>
  <label class="consent mdl-mail"><input type="checkbox" id="mdlNotify" checked><span><b>Email the speaker</b> <em data-to></em> with the date and time.</span></label>
  <div class="mdl-act"><button type="button" class="b2" data-close>Go back</button><button type="button" class="b2 pri" id="mdlOk">Confirm and save</button></div>
</div></div><script src="${B}/assets/speaker.js?v=${av('speaker.js')}" defer></script></body></html>`;
}

module.exports = { section, index, detail, login, forgot, code, reset, accept, declineConfirm, notice, portal, adminList, adminEdit, ADM_CSS };
