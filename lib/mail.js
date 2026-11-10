'use strict';
const nodemailer = require('nodemailer');
const cfg = require('../config');
const { e } = require('./views');

const configured = () => !!(cfg.smtp.user && cfg.smtp.pass);
// Candidate SMTP endpoints: the configured one first, then common Zoho alternatives.
const candidates = () => {
  const c = [{ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure }];
  for (const h of [cfg.smtp.host, 'smtp.zoho.com', 'smtppro.zoho.com']) {
    for (const [port, secure] of [[465, true], [587, false]]) c.push({ host: h, port, secure });
  }
  const seen = new Set();
  return c.filter((x) => { const k = `${x.host}:${x.port}`; if (seen.has(k)) return false; seen.add(k); return true; });
};
const mk = (o) => nodemailer.createTransport({
  host: o.host, port: o.port, secure: o.secure, requireTLS: !o.secure,
  auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
});
let working = null;          // the endpoint that last succeeded
let lastError = '';

async function send({ to, subject, text, html }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP_PASS is not set - email service not configured');
    console.log(`[DEV MAIL – SMTP not configured] to=${to} subject=${subject}\n${text}`);   // local testing only
    return { dev: true };
  }
  const msg = { from: cfg.smtp.from, replyTo: cfg.smtp.replyTo, to, subject, text, html };
  const list = working ? [working] : candidates();
  let err;
  const deadline = Date.now() + 25000;       // never keep a caller waiting for minutes when the mail server is unreachable
  for (const o of list) {
    if (err && Date.now() > deadline) break;
    try {
      const r = await mk(o).sendMail(msg);
      working = o; lastError = '';
      console.log(`Mail sent via ${o.host}:${o.port} to=${to} accepted=${JSON.stringify(r.accepted)} rejected=${JSON.stringify(r.rejected)} resp=${r.response}`);
      return r;
    } catch (ex) {
      err = ex;
      lastError = `${o.host}:${o.port} → ${ex.code || ''} ${ex.responseCode || ''} ${ex.message}`;
      console.error('SMTP attempt failed:', lastError);
      if (ex.responseCode === 535 || ex.code === 'EAUTH') { working = null; break; }   // wrong credentials: other hosts will not help
    }
  }
  working = null;
  throw err;
}

// Quick credential check: first endpoint that accepts the login wins; a wrong password stops at once.
async function check() {
  let last;
  for (const o of candidates()) {
    try { await mk(o).verify(); working = o; return { ok: true, ...o }; }
    catch (ex) { last = ex; if (ex.responseCode === 535 || ex.code === 'EAUTH') return { ok: false, auth: true, msg: ex.message }; }
  }
  return { ok: false, msg: last ? last.message : 'no SMTP endpoint reachable' };
}

// Diagnostics for the admin page: tries every candidate and reports exactly what happened.
async function diagnose() {
  const out = [];
  for (const o of candidates()) {
    const t0 = Date.now();
    try { await mk(o).verify(); out.push({ ...o, ok: true, ms: Date.now() - t0 }); }
    catch (ex) { out.push({ ...o, ok: false, ms: Date.now() - t0, code: ex.code || '', resp: ex.responseCode || '', msg: ex.message }); }
  }
  return out;
}

// ── templates ──────────────────────────────────────────────
// Built for real mail clients: tables for layout, inline styles, hex colours only (Outlook ignores rgba),
// a hidden preview line, bulletproof buttons, web fonts with safe fallbacks, and a small @media block for phones.
const SITE = () => cfg.siteUrl.replace(/\/+$/, '');
const C = { navy: '#12285C', ink: '#14203F', body: '#3A4560', muted: '#6E7790', amber: '#F2A900', label: '#9C6C00', rule: '#E3E1DA', paper: '#F8F7F4', page: '#ECEAE4' };
const SERIF = "'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif";
const SANS = SERIF;
const P = (html, more = '') => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.body};${more}">${html}</p>`;
const label = (t) => `<div style="font-family:${SANS};font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.label};margin:0 0 8px">${t}</div>`;
const h1 = (t) => `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:30px;line-height:36px;font-weight:700;color:${C.navy};letter-spacing:-0.5px">${t}</h1>`;
// bulletproof button (padding lives on the table cell, so Outlook keeps it)
const btn = (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px"><tr><td bgcolor="${C.navy}" style="background:${C.navy}">
<a class="bt" href="${e(href)}" target="_blank" style="display:inline-block;padding:16px 28px;font-family:${SANS};font-size:13px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none">${text}&nbsp;&nbsp;&rarr;</a></td></tr></table>`;
// one-time code: the trailing letter-spacing is balanced with left padding so the digits sit centred
const codeBox = (code) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr>
<td align="center" bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.rule};padding:24px 10px 22px 24px;font-family:${SANS};font-size:40px;line-height:46px;font-weight:700;letter-spacing:12px;color:${C.navy};font-variant-numeric:lining-nums tabular-nums">${e(code)}</td></tr></table>`;
// label above value: reads well at any width (no cramped two-column table on phones)
const details = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border-top:1px solid ${C.rule}">${rows.map(([k, v]) => `<tr><td style="padding:14px 0 13px;border-bottom:1px solid ${C.rule}">
<div style="font-family:${SANS};font-size:10px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.label};margin:0 0 3px">${k}</div>
<div style="font-family:${SANS};font-size:16px;line-height:23px;color:${C.ink}">${v}</div></td></tr>`).join('')}</table>`;
const small = (html) => `<p style="margin:14px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted}">${html}</p>`;

function wrap(inner, { preheader = '', kicker = '' } = {}) {
  const site = SITE(), host = site.replace(/^https?:\/\//, '');
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${e(cfg.eventName)}</title>
<style>
  body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  a{color:${C.navy}} img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  @media only screen and (max-width:520px){
    .px{padding-left:24px!important;padding-right:24px!important}
    .hd td{display:block!important;width:100%!important;text-align:left!important}
    .hd .dt{padding-top:14px!important}
    .h1 h1{font-size:26px!important;line-height:32px!important}
    .bt{padding:15px 20px!important;letter-spacing:1px!important;font-size:12px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};opacity:0">${e(preheader)}${'&#8199;&#65279;&#847; '.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px 36px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FFFFFF">
  <tr><td bgcolor="#FFFFFF" class="px" style="background:#FFFFFF;padding:22px 40px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="hd"><tr>
      <td valign="middle" style="vertical-align:middle"><a href="${site}/" target="_blank" style="text-decoration:none"><img src="${site}/assets/email-logo.png" width="190" height="119" alt="ICSSST 2027" style="display:block;width:190px;max-width:100%;height:auto;font-family:${SERIF};font-size:20px;font-weight:700;color:#FFFFFF"></a></td>
      <td valign="middle" align="right" class="dt" style="vertical-align:middle;text-align:right;font-family:${SANS};font-size:11px;line-height:17px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.label};white-space:nowrap">${e(cfg.eventDateText)}<br><span style="color:${C.navy}">Penang, Malaysia</span></td>
    </tr></table></td></tr>
  <tr><td bgcolor="${C.navy}" style="background:${C.navy};height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>
  <tr><td bgcolor="${C.amber}" style="background:${C.amber};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
  <tr><td class="px h1" style="padding:40px 40px 34px">${kicker ? label(kicker) : ''}${inner}</td></tr>
  <tr><td class="px" bgcolor="${C.paper}" style="background:${C.paper};border-top:1px solid ${C.rule};padding:24px 40px 26px">
    <p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:20px;font-weight:700;color:${C.ink}">${e(cfg.eventFull)}</p>
    <p style="margin:0 0 10px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted}">Organised by the School of Physics, Universiti Sains Malaysia, Penang</p>
    <p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted}"><a href="${site}/" target="_blank" style="color:${C.label};text-decoration:none;font-weight:700">${e(host)}</a> &nbsp;·&nbsp; Questions? Just reply to this email.</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

const venueHtml = () => `${e(cfg.eventVenue)}${cfg.venueAddress ? `<br><span style="color:${C.muted}">${e(cfg.venueAddress).replace(/\n/g, '<br>')}</span>` : ''}${cfg.map ? `<br><a href="${e(cfg.map.open)}" style="color:${C.label};font-weight:700;text-decoration:none">Open in Google Maps →</a>` : ''}`;
const first = (name) => String(name).trim().split(/\s+/)[0];

function codeEmail({ name, code }) {
  return {
    subject: `${code} is your verification code – ${cfg.eventName}`,
    text: `Hello ${first(name)},\n\nYour verification code is: ${code}\n\nEnter it on the registration page to complete your registration. The code is valid for ${cfg.codeMinutes} minutes.\n\nIf you did not try to register, you can ignore this email.\n\n${cfg.eventName} – ${cfg.eventFull}\n${SITE()}`,
    html: wrap(h1(`Your verification code`) + P(`Hello ${e(first(name))}, enter this code on the registration page to confirm your email address and complete your registration for <b style="color:${C.ink}">${e(cfg.eventName)}</b>.`) +
      codeBox(code) + P(`The code is valid for <b style="color:${C.ink}">${cfg.codeMinutes} minutes</b>.`) + small('If you did not try to register, you can safely ignore this email.'),
      { preheader: `Your code is ${code}. It is valid for ${cfg.codeMinutes} minutes.`, kicker: 'Registration · Step 2 of 2' }),
  };
}

function confirmEmail({ name, ref, organisation, category = '', fee = '' }) {
  const acct = SITE() + '/account';
  return {
    subject: `Registration received – ${cfg.eventName} (Ref ${ref}) – next step: payment`,
    text: `Hello ${first(name)},\n\nThank you for registering for ${cfg.eventName}, the ${cfg.eventFull}.\n\nReference: ${ref}\nName: ${name}\nOrganisation: ${organisation}\nCategory: ${category}\nFee: ${fee}\n\nNEXT STEP – PAY YOUR FEE\nSign in to your registration page and press Pay:\n${acct}\n\nDates: ${cfg.eventWeekday}, ${cfg.eventDateText}\nVenue: ${cfg.eventVenue}${cfg.venueAddress ? '\nAddress: ' + cfg.venueAddress : ''}${cfg.confirmNote ? '\n\n' + cfg.confirmNote : ''}\n\n${cfg.eventName} – ${cfg.eventFull}\n${SITE()}`,
    html: wrap(h1(`Thank you, ${e(first(name))}.`) + P(`Your registration for <b style="color:${C.ink}">${e(cfg.eventName)}</b> has been received. <b style="color:${C.ink}">One step left:</b> pay your fee online from your registration page.`) +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px"><tr><td style="border:1px solid ${C.navy};padding:16px 24px 15px">${label('Your reference')}<div style="font-family:${SANS};font-size:26px;line-height:32px;font-weight:700;letter-spacing:3px;color:${C.navy};font-variant-numeric:lining-nums">${e(ref)}</div></td></tr></table>` +
      details([['Category', e(category)], ['Fee', `<b>${e(fee)}</b>`], ['Name', e(name)], ['Organisation', e(organisation)], ['Dates', `${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)}`], ['Venue', venueHtml()]]) +
      btn(acct, 'Pay your fee') + small('Sign in with this email address and the password you chose, then press Pay. You can also complete your profile there, and later download your certificate.') +
      (cfg.confirmNote ? P(e(cfg.confirmNote).replace(/\n/g, '<br>'), 'margin-top:22px') : ''),
      { preheader: `Reference ${ref} · next step: pay ${fee} online`, kicker: 'Registration received' }),
  };
}

// review decision on an abstract / extended abstract / full paper, sent when the organiser ticks "Email the author"
function reviewEmail({ name, email, ref, stage, status, title, note }) {
  const what = { abs: 'abstract', ext: 'extended abstract', fp: 'full paper' }[stage] || 'submission';
  const link = SITE() + '/login';
  const head = { accepted: `Your ${what} has been accepted`, revise: `Please revise your ${what}`, rejected: `Decision on your ${what}` }[status];
  const lead = {
    accepted: `Good news: your ${what} for <b style="color:${C.ink}">${e(cfg.eventName)}</b> has been <b style="color:${C.ink}">accepted</b>.`,
    revise: `The organisers have reviewed your ${what} for <b style="color:${C.ink}">${e(cfg.eventName)}</b> and ask you to revise it.`,
    rejected: `Thank you for submitting your ${what} to <b style="color:${C.ink}">${e(cfg.eventName)}</b>. After review, it was not accepted for the programme.`,
  }[status];
  const next = { accepted: 'Sign in to your dashboard to see what comes next, such as the next submission stage and the programme.', revise: 'Sign in to your dashboard, open the Papers tab, make the changes and submit again.', rejected: 'You are still welcome to attend as a participant. Sign in to your dashboard to see your registration.' }[status];
  const plain = (h) => h.replace(/<[^>]+>/g, '');
  return {
    subject: `${head} – ${cfg.eventName} (Ref ${ref})`,
    text: `Hello ${first(name)},\n\n${plain(lead)}\n\nTitle: ${title || '-'}\nReference: ${ref}${note && status !== 'accepted' ? `\n\nNote from the organisers:\n${note}` : ''}\n\n${next}\n${link}\n\n${cfg.eventName} – ${cfg.eventFull}`,
    html: wrap(h1(e(head)) + P(`Hello ${e(first(name))},`) + P(lead) + details([['Title', e(title || '—')], ['Reference', e(ref)]]) +
      (note && status !== 'accepted' ? label('Note from the organisers') + P(e(note).replace(/\n/g, '<br>')) : '') +
      P(e(next)) + btn(link, 'Sign in to my dashboard') + small(`Sign in with ${e(email)}. Forgot your password? Choose “Email me a sign-in code” on the sign-in page.`), { preheader: `${head} · ${ref}`, kicker: 'Submission' }),
  };
}

// participant cancelled: a note to them, and one to the organisers
function cancelEmail({ name, ref, paid }) {
  const acct = SITE() + '/account';
  return {
    subject: `Registration cancelled – ${cfg.eventName} (Ref ${ref})`,
    text: `Hello ${first(name)},\n\nYour registration for ${cfg.eventName} (reference ${ref}) has been cancelled, as you asked.${paid ? '\n\nYour fee was paid; the organisers will contact you about a refund under the refund terms.' : ''}\n\nChanged your mind? You can reinstate it from your registration page while registration is open:\n${acct}\n\n${cfg.eventName} – ${cfg.eventFull}`,
    html: wrap(h1('Registration cancelled') + P(`Hello ${e(first(name))}, your registration for <b style="color:${C.ink}">${e(cfg.eventName)}</b> (reference <b style="color:${C.ink}">${e(ref)}</b>) has been cancelled, as you asked.`) +
      (paid ? P('Your fee was paid. The organisers will contact you about a refund under the refund terms.') : '') +
      btn(acct, 'Open my registration page') + small('Changed your mind? You can reinstate your registration from that page while registration is open.'), { preheader: `Reference ${ref} cancelled`, kicker: 'Registration' }),
  };
}
function cancelNoticeEmail({ r, reason, note }) {
  const rows = [['Reference', r.ref], ['Name', r.full_name], ['Email', r.email], ['Organisation', r.organisation], ['Category', `${r.category} · ${r.fee || ''}`], ['Payment', r.pay_status + (r.pay_ref ? ' · ' + r.pay_ref : '')], ['Taking part', r.participation || ''], ['Reason', reason || '(not given)'], ['Message', note || '(none)']];
  return {
    subject: `Cancellation: ${r.full_name} (${r.ref})${r.pay_status === 'paid' ? ' – PAID, refund to handle' : ''}`,
    text: `${r.full_name} cancelled their ${cfg.eventName} registration.\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nOpen in admin: ${SITE()}/admin?q=${encodeURIComponent(r.ref)}`,
    html: wrap(h1('A participant cancelled') + details(rows.map(([k, v]) => [k, e(v)])) + btn(`${SITE()}/admin?q=${encodeURIComponent(r.ref)}`, 'Open in admin') + (r.pay_status === 'paid' ? P('<b>This participant had paid.</b> Arrange the refund under the refund terms.') : ''), { preheader: `${r.full_name} · ${r.ref}`, kicker: 'Organiser notice' }),
  };
}

function loginCodeEmail({ name, code }) {
  return {
    subject: `${code} is your password code – ${cfg.eventName}`,
    text: `Hello ${first(name)},\n\nYour code to set a new password for your ${cfg.eventName} account is: ${code}\n\nIt is valid for ${cfg.codeMinutes} minutes. If you did not ask for it, you can ignore this email; your password has not changed.\n\n${SITE()}/login`,
    html: wrap(h1('Set a new password') + P(`Hello ${e(first(name))}, use this code to choose a new password for your <b style="color:${C.ink}">${e(cfg.eventName)}</b> participant account.`) +
      codeBox(code) + P(`The code is valid for <b style="color:${C.ink}">${cfg.codeMinutes} minutes</b>.`) + small('If you did not ask for this, you can safely ignore this email; your password has not changed.'),
      { preheader: `Your code is ${code}.`, kicker: 'Participant account' }),
  };
}

function paymentEmail({ name, ref, category, amount, order }) {
  return {
    subject: `Payment confirmed – ${cfg.eventName} (Ref ${ref})`,
    text: `Hello ${first(name)},\n\nWe have received your payment for ${cfg.eventName}. Your registration is now complete.\n\nReference: ${ref}\nCategory: ${category}${amount ? '\nAmount: ' + amount : ''}${order ? '\nPayment reference: ' + order : ''}\n\nYour receipt was emailed to you by the payment provider.\n\nDates: ${cfg.eventWeekday}, ${cfg.eventDateText}\nVenue: ${cfg.eventVenue}\n\nSee you in Penang!\n${SITE()}`,
    html: wrap(h1(`You’re all set, ${e(first(name))}.`) + P(`We have received your payment. Your registration for <b style="color:${C.ink}">${e(cfg.eventName)}</b> is complete.`) +
      details([['Reference', `<b>${e(ref)}</b>`], ['Category', e(category)], ...(amount ? [['Amount', e(amount)]] : []), ...(order ? [['Payment reference', e(order)]] : []), ['Dates', `${e(cfg.eventWeekday)}, ${e(cfg.eventDateText)}`], ['Venue', venueHtml()]]) +
      small('Your receipt was emailed to you separately by the payment provider.') + btn(SITE() + '/#programme', 'View the programme'),
      { preheader: `Reference ${ref} · payment received`, kicker: 'Payment confirmed' }),
  };
}

function speakerCodeEmail({ name, code }) {
  return {
    subject: `${code} is your password reset code – ${cfg.eventName}`,
    text: `Dear ${name},\n\nYour code to reset your speaker portal password is: ${code}\n\nIt is valid for ${cfg.codeMinutes} minutes. If you did not ask to reset your password, you can ignore this email; your password has not changed.\n\n${cfg.eventName} – ${cfg.eventFull}`,
    html: wrap(h1('Reset your password') + P(`Dear ${e(name)}, use this code to choose a new password for the <b style="color:${C.ink}">${e(cfg.eventName)}</b> speaker portal.`) +
      codeBox(code) + P(`The code is valid for <b style="color:${C.ink}">${cfg.codeMinutes} minutes</b>.`) + small('If you did not ask to reset your password, you can safely ignore this email; your password has not changed.'),
      { preheader: `Your code is ${code}. It is valid for ${cfg.codeMinutes} minutes.`, kicker: 'Speaker portal' }),
  };
}

function speakerInviteEmail({ name, role, acceptLink, declineLink, days = 14 }) {
  const art = /^[AEIOU]/i.test(role) ? 'an' : 'a';
  const item = (n, t, d) => `<tr><td valign="top" style="padding:12px 16px 12px 0;vertical-align:top;font-family:${SANS};font-size:15px;line-height:22px;font-weight:700;color:${C.label};width:24px">${n}</td><td style="padding:12px 0;border-bottom:1px solid ${C.rule}"><div style="font-family:${SANS};font-size:16px;line-height:22px;font-weight:700;color:${C.ink}">${t}</div><div style="font-family:${SANS};font-size:14px;line-height:21px;color:${C.muted}">${d}</div></td></tr>`;
  const ghost = (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 6px"><tr><td style="border:1px solid ${C.navy}"><a class="bt" href="${e(href)}" target="_blank" style="display:inline-block;padding:15px 27px;font-family:${SANS};font-size:13px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.navy};text-decoration:none">${text}</a></td></tr></table>`;
  return {
    subject: `You are invited to speak – ${cfg.eventName}, ${cfg.eventDateText}`,
    text: `Dear ${name},\n\nYou are warmly invited to join ${cfg.eventName} (${cfg.eventDateText}, ${cfg.eventVenue}) as ${art} ${role}.\n\nACCEPT the invitation and choose your password:\n${acceptLink}\n\nOr DECLINE the invitation:\n${declineLink}\n\nAfter accepting you can add your talk title, abstract, short biography and a portrait photo in the speaker portal; what you save appears on the conference website straight away. These links are valid for ${days} days.\n\nWith best regards,\nThe organising committee\n${cfg.eventName} – ${cfg.eventFull}`,
    html: wrap(h1(`Dear ${e(name)},`) + P(`You are warmly invited to join <b style="color:${C.ink}">${e(cfg.eventName)}</b> on ${e(cfg.eventDateText)} as ${art} <b style="color:${C.ink}">${e(role)}</b>. Please let us know whether you can take part.`) +
      btn(acceptLink, 'Accept invitation') + ghost(declineLink, 'Decline invitation') +
      small(`Accepting takes you to a page where you choose a password for the speaker portal. These links are valid for ${days} days.`) +
      P('Once you have accepted, you can add:', 'margin:22px 0 4px') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${item('1', 'Talk title and abstract', 'Plain text; about 150–300 words reads best.')}${item('2', 'Short biography and affiliation', 'Written in the third person.')}${item('3', 'Portrait photo', 'Head and shoulders; it is cropped automatically.')}</table>` +
      small('Everything you save appears on the conference website straight away.') +
      `<p style="margin:28px 0 0;font-family:${SANS};font-size:16px;line-height:26px;color:${C.body}">With best regards,<br><b style="color:${C.ink}">The organising committee</b></p>`,
      { preheader: `Accept or decline your invitation to speak on ${cfg.eventDateText}.`, kicker: `Invitation · ${role}` }),
  };
}

function speakerScheduleEmail({ name, talkTitle, dateLabel, timeText, venue, room = '', changed, portalLink, portalLabel = 'Open speaker portal' }) {
  const sub = changed ? `Your talk time has been updated – ${cfg.eventName}` : `Your talk is scheduled – ${cfg.eventName}`;
  const rows = [['Date', e(dateLabel)], ['Time', e(timeText)], ...(room ? [['Room', e(room)]] : []), ['Venue', venueHtml()]];
  if (talkTitle) rows.unshift(['Talk', e(talkTitle)]);
  return {
    subject: sub,
    text: `Dear ${name},\n\n${changed ? 'The time of your talk has been updated.' : 'We are pleased to confirm the time of your talk.'}\n\n${talkTitle ? 'Talk: ' + talkTitle + '\n' : ''}Date: ${dateLabel}\nTime: ${timeText}${room ? '\nRoom: ' + room : ''}\nVenue: ${venue}${cfg.venueAddress ? '\nAddress: ' + cfg.venueAddress : ''}${cfg.map ? '\nMap: ' + cfg.map.open : ''}\n\nIf this time does not suit you, please reply to this email as soon as possible.${portalLink ? '\n\n' + portalLabel + ': ' + portalLink : ''}\n\nWith best regards,\nThe organising committee\n${cfg.eventName} – ${cfg.eventFull}`,
    html: wrap(h1(`Dear ${e(name)},`) + P(changed ? 'The time of your talk at <b style="color:' + C.ink + '">' + e(cfg.eventName) + '</b> has been <b style="color:' + C.ink + '">updated</b>.' : 'We are pleased to confirm the time of your talk at <b style="color:' + C.ink + '">' + e(cfg.eventName) + '</b>.') +
      details(rows) + P('If this time does not suit you, please reply to this email as soon as possible and we will find a way to arrange it.') +
      (portalLink ? btn(portalLink, portalLabel) : '') +
      `<p style="margin:28px 0 0;font-family:${SANS};font-size:16px;line-height:26px;color:${C.body}">With best regards,<br><b style="color:${C.ink}">The organising committee</b></p>`,
      { preheader: `${dateLabel}, ${timeText}`, kicker: 'Talk schedule' }),
  };
}

module.exports = { reviewEmail, cancelEmail, cancelNoticeEmail, loginCodeEmail, paymentEmail, speakerScheduleEmail, send, configured, diagnose, check, codeEmail, confirmEmail, speakerCodeEmail, speakerInviteEmail, lastError: () => lastError };
