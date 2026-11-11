'use strict';
// Runtime settings: stored in the database (table `settings`), editable from the admin Settings page,
// and applied onto the shared `cfg` object, so changes take effect immediately without a redeploy.
const cfg = require('../config');
const { db } = require('./db');

db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)');

// ── schema: drives validation and the settings page ──────────────────────────
// type: bool | int | text | longtext | date | datetime | list
const GROUPS = [
  { id: 'registration', title: 'Registration', blurb: 'Who can register, and how many.' },
  { id: 'payment', title: 'Fees & payment', blurb: 'What each category pays, and where they pay it (Ticket2U).' },
  { id: 'signin', title: 'Sign-in', blurb: 'How participants sign in. The defaults suit most conferences.' },
  { id: 'abuse', title: 'Spam protection', blurb: 'Limits that stop bots and email flooding. The defaults suit most conferences.' },
  { id: 'event', title: 'Event details', blurb: 'Shown on the website, emails and certificates.' },
  { id: 'cert', title: 'Certificates', blurb: 'Signatory printed on every certificate.' },
  { id: 'mail', title: 'Emails', blurb: 'The sender name and confirmation message.' },
  { id: 'site', title: 'Website', blurb: 'A banner across the top of every page, for news such as a deadline extension.' },
  { id: 'subs', title: 'Submissions', blurb: 'What oral and poster presenters submit, and until when. Turn each stage on or off.' },
];
const FIELDS = [
  // registration
  { k: 'regOpen', g: 'registration', t: 'bool', label: 'Registration is open', help: 'Turn off to close registration immediately.' },
  { k: 'seatLimit', g: 'registration', t: 'int', label: 'Number of seats', min: 0, max: 100000, help: 'Registration closes automatically when this many people have registered (cancelled registrations free their seat). Put 0 for no limit. Change it at any time.' },
  { k: 'opensAt', g: 'registration', t: 'datetime', label: 'Opens at (Malaysia time)', help: 'Optional. Before this time the site shows “registration closed”.' },
  { k: 'closesAt', g: 'registration', t: 'datetime', label: 'Closes at (Malaysia time)', help: 'Optional. Registration closes automatically at this time.' },
  { k: 'showSeatsLeft', adv: true, g: 'registration', t: 'bool', label: 'Show remaining seats publicly', help: 'If off, the site just says “Limited seats”.' },
  // payment
  { k: 'payProvider', adv: true, g: 'payment', t: 'choice', label: 'How participants pay', options: [['ticket2u', 'Ticket2U — participants pay on Ticket2U; confirm by importing Ticket2U exports'], ['both', 'Stripe, with Ticket2U as a second option'], ['stripe', 'Stripe only — card, FPX, GrabPay; confirmed automatically']], help: 'Stripe needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server (see Admin → Payments). Without them, the Stripe button is hidden.' },
  { k: 'fees', g: 'payment', t: 'fees', label: 'Registration fees', help: 'One fee per line:  Category | Fee | Ticket2U link (optional).  Write fees as RM 900.00 or USD 350.00. The Ticket2U link is the page (or ticket) where this category pays; leave it out to use the general event link below. A category whose name contains “Early Bird” is only offered until the early-bird deadline. Existing registrations keep the fee they chose.', maxItems: 12 },
  { k: 'ticket2uUrl', g: 'payment', t: 'turl', label: 'Ticket2U event page (general link)', max: 500, placeholder: 'https://www.ticket2u.com.my/event/…', help: 'Used for every category that has no link of its own. Create the event in your Ticket2U organiser dashboard, with one ticket type per category, then paste the public event link here.' },
  { k: 'earlyBirdEnds', g: 'payment', t: 'datetime', label: 'Early-bird deadline (Malaysia time)', help: 'After this time “Early Bird” categories disappear from the form. Participants who registered earlier keep their early-bird fee, but should pay before the deadline.' },
  { k: 'paymentNote', adv: true, g: 'payment', t: 'longtext', label: 'Payment instructions', max: 800, help: 'Shown on the participant’s page next to the Pay button, e.g. who to contact for an invoice, LO/purchase orders or refunds.' },
  { k: 'payEmail', adv: true, g: 'payment', t: 'bool', label: 'Email the participant when a payment is confirmed' },
  // sign-in
  { k: 'allowGoogle', adv: true, g: 'signin', t: 'bool', label: 'Allow “Continue with Google”', help: 'Needs the Google credentials to be configured on the server.' },
  { k: 'allowEmail', adv: true, g: 'signin', t: 'bool', label: 'Allow registration with an emailed code', help: 'At least one of the two methods must stay on.' },
  { k: 'codeMinutes', adv: true, g: 'signin', t: 'int', label: 'Code validity (minutes)', min: 3, max: 60 },
  { k: 'resendSeconds', adv: true, g: 'signin', t: 'int', label: 'Wait before a new code (seconds)', min: 10, max: 600 },
  { k: 'maxCodeAttempts', adv: true, g: 'signin', t: 'int', label: 'Wrong-code attempts allowed', min: 3, max: 10 },
  { k: 'maxCodeSends', adv: true, g: 'signin', t: 'int', label: 'Codes that can be sent per attempt', min: 1, max: 10 },
  // abuse
  { k: 'perIpHour', adv: true, g: 'abuse', t: 'int', label: 'Verification emails per connection per hour', min: 3, max: 500 },
  { k: 'perEmailHour', adv: true, g: 'abuse', t: 'int', label: 'Verification emails per address per hour', min: 1, max: 30 },
  { k: 'minSubmitSeconds', adv: true, g: 'abuse', t: 'int', label: 'Minimum seconds to fill the form', min: 0, max: 30, help: 'Faster submissions are treated as bots.' },
  // event
  { k: 'eventDate', g: 'event', t: 'date', label: 'First day of the event', help: 'The weekday is worked out automatically.' },
  { k: 'eventEndDate', g: 'event', t: 'odate', label: 'Last day (for a multi-day event)', help: 'Leave empty for a one-day event. Up to 14 days.' },
  { k: 'eventTime', g: 'event', t: 'text', label: 'Time', max: 80, placeholder: 'e.g. 9:00 am – 5:00 pm' },
  { k: 'eventVenue', g: 'event', t: 'text', label: 'Venue', max: 160 },
  { k: 'progNote', adv: true, g: 'event', t: 'text', label: 'Note above the programme', max: 200, help: 'Shown above the programme on the website. Leave empty for none.' },
  { k: 'venueAddress', g: 'event', t: 'longtext', label: 'Venue address', max: 300, help: 'The full postal address, shown under the venue name and used for map directions when no coordinates are set.' },
  { k: 'venueDetails', adv: true, g: 'event', t: 'longtext', label: 'Venue details', max: 800, help: 'Hall or room, floor, parking, public transport, accessibility, where to register on arrival… Shown on the event page.' },
  { k: 'mapUrl', g: 'event', t: 'url', label: 'Google Maps link', max: 500, placeholder: 'https://maps.app.goo.gl/…', help: 'Open the place in Google Maps, press Share, copy the link and paste it here. Used by the “Open in Google Maps” button.' },
  { k: 'mapCoords', adv: true, g: 'event', t: 'coords', label: 'Map coordinates (optional)', max: 40, placeholder: 'e.g. 5.3561, 100.3022', help: 'Latitude, longitude. In Google Maps, right-click the exact spot and click the numbers to copy them. This makes “Get directions” and the map point at the exact entrance.' },
  { k: 'posterSpecs', g: 'event', t: 'text', label: 'Poster size', max: 120, placeholder: 'e.g. A0 portrait (841 × 1189 mm)', help: 'Shown to poster presenters on their dashboard.' },
  { k: 'presenterNotes', adv: true, g: 'event', t: 'longtext', label: 'Notes for presenters', max: 800, help: 'Abstract deadline, talk length, where to hang posters, setup time… Shown to oral and poster presenters on their dashboard.' },
  { k: 'eventSub', adv: true, g: 'event', t: 'text', label: 'Tagline (under the title)', max: 160 },
  // submissions: abstract (typed in), extended abstract and full paper (uploaded, from your template)
  { k: 'subAbstract', g: 'subs', t: 'bool', label: 'Stage 1 — Abstract: presenters type their abstract on the website', help: 'Title, authors and affiliations, abstract (LaTeX equations allowed) and keywords. Required for every oral and poster presenter when on.' },
  { k: 'absMin', adv: true, g: 'subs', t: 'int', label: 'Abstract: minimum words', min: 0, max: 2000 },
  { k: 'absMax', adv: true, g: 'subs', t: 'int', label: 'Abstract: maximum words', min: 50, max: 2000 },
  { k: 'absDeadline', g: 'subs', t: 'datetime', label: 'Abstract deadline (Malaysia time)', help: 'After this, abstracts can no longer be changed (you can still change them as organiser). Leave empty for no deadline.' },
  { k: 'subExtended', g: 'subs', t: 'bool', label: 'Stage 2 — Extended abstract: presenters download your template and upload the filled file' },
  { k: 'extRequired', g: 'subs', t: 'bool', label: 'Extended abstract is required (otherwise optional)' },
  { k: 'extPages', g: 'subs', t: 'text', label: 'Extended abstract: length', max: 60, placeholder: 'e.g. 2–4 pages' },
  { k: 'extDeadline', g: 'subs', t: 'datetime', label: 'Extended abstract deadline (Malaysia time)' },
  { k: 'subFull', g: 'subs', t: 'bool', label: 'Stage 3 — Full paper: presenters download your template and upload the filled manuscript', help: 'For conferences that publish proceedings.' },
  { k: 'fullRequired', g: 'subs', t: 'bool', label: 'Full paper is required (otherwise optional)' },
  { k: 'fullPages', g: 'subs', t: 'text', label: 'Full paper: length', max: 60, placeholder: 'e.g. 6–8 pages' },
  { k: 'fullDeadline', g: 'subs', t: 'datetime', label: 'Full paper deadline (Malaysia time)' },
  { k: 'subNote', g: 'subs', t: 'longtext', label: 'Instructions for authors', max: 1200, help: 'Shown at the top of the Submission tab: formatting rules, proceedings journal, review process…' },
  { k: 'maxUploadMB', adv: true, g: 'subs', t: 'int', label: 'Largest file presenters may upload (MB)', min: 1, max: 25 },
  // on-site check-in
  { k: 'checkinPin', g: 'cert', t: 'text', label: 'Check-in desk PIN', max: 20, placeholder: 'e.g. 482915', help: 'Registration-desk staff open /checkin and enter this PIN to check participants in by scanning their pass. Organisers signed in here do not need it. Change it to sign every desk out.' },
  // certificates
  { k: 'certDownload', g: 'cert', t: 'bool', label: 'Participants can download their own certificate', help: 'From their dashboard, once they are marked attended and their fee is paid or waived (or once you issue it from the Certificates page).' },
  { k: 'signatoryName', g: 'cert', t: 'text', label: 'Signatory name', max: 120 },
  { k: 'signatoryTitle', g: 'cert', t: 'text', label: 'Signatory title', max: 160 },
  // mail
  { k: 'mailFromName', g: 'mail', t: 'text', label: 'Sender name', max: 80, help: 'The address itself is set by the mail account.' },
  { k: 'notifyEmail', g: 'mail', t: 'text', label: 'Tell the organisers at (cancellations and other notices)', max: 160, help: 'Leave empty to use the reply-to address.' },
  { k: 'mailReplyTo', adv: true, g: 'mail', t: 'text', label: 'Reply-to address', max: 160 },
  { k: 'sendConfirmation', g: 'mail', t: 'bool', label: 'Send a confirmation email after registration' },
  { k: 'confirmNote', g: 'mail', t: 'longtext', label: 'Extra note in the confirmation email', max: 600, help: 'Optional, e.g. parking, dress code, what to bring.' },
  // site
  { k: 'announcementOn', g: 'site', t: 'bool', label: 'Show announcement banner' },
  { k: 'announcementText', g: 'site', t: 'text', label: 'Announcement text', max: 200, placeholder: 'e.g. Programme updated — see the speakers section.' },
  { k: 'googleVerification', adv: true, g: 'site', t: 'text', label: 'Google Search Console verification code', max: 120, help: 'The “content” value of the verification meta tag. Optional.' },
  { k: 'bingVerification', adv: true, g: 'site', t: 'text', label: 'Bing Webmaster Tools verification code (also covers Yahoo and DuckDuckGo)', max: 120, help: 'The “content” value of the msvalidate.01 meta tag. Optional.' },
  { k: 'yandexVerification', adv: true, g: 'site', t: 'text', label: 'Yandex Webmaster verification code', max: 120, help: 'Optional.' },
];
const byKey = Object.fromEntries(FIELDS.map((f) => [f.k, f]));

// Fees from the ICSSST 2027 poster. Ticket2U links are added from Admin → Settings once the Ticket2U event exists.
const DEFAULT_FEES = [
  { name: 'Non-MASS Members', fee: 'RM 1,200.00', url: '' },
  { name: 'MASS Members', fee: 'RM 1,000.00', url: '' },
  { name: 'Students', fee: 'RM 900.00', url: '' },
  { name: 'Early Bird (Local Participants)', fee: 'RM 800.00', url: '' },
  { name: 'International Participants', fee: 'USD 350.00', url: '' },
  { name: 'Early Bird (International Participants)', fee: 'USD 300.00', url: '' },
  { name: 'General Participants (Non-Presenting)', fee: 'RM 600.00', url: '' },
];
const DEFAULT_CATS = DEFAULT_FEES.map((f) => f.name);
const T2U_RE = /^https:\/\/([a-z0-9-]+\.)*ticket2u\.(com\.my|com|my|sg|id|ph)(\/|$)/i;
const isEarly = (name) => /early[\s-]*bird/i.test(name);
const defaults = () => ({
  regOpen: cfg.regOpen, seatLimit: cfg.seatLimit, opensAt: '', closesAt: '', showSeatsLeft: false,
  payProvider: 'ticket2u', fees: DEFAULT_FEES.map((f) => ({ ...f })), ticket2uUrl: '', earlyBirdEnds: '', paymentNote: '', payEmail: true,
  allowGoogle: true, allowEmail: true, codeMinutes: cfg.codeMinutes, resendSeconds: cfg.resendSeconds, maxCodeAttempts: cfg.maxCodeAttempts, maxCodeSends: 5,
  perIpHour: 10, perEmailHour: 5, minSubmitSeconds: 4,
  eventDate: '2027-09-06', eventEndDate: '2027-09-08', eventTime: cfg.eventTime, eventVenue: cfg.eventVenue, progNote: 'Tentative programme — subject to change. Invited talks are marked INV.', venueAddress: '', venueDetails: '', posterSpecs: '', presenterNotes: '', mapUrl: '', mapCoords: '', eventSub: cfg.eventSub,
  subAbstract: true, absMin: 150, absMax: 300, absDeadline: '', subExtended: false, extRequired: false, extPages: '2–4 pages', extDeadline: '', subFull: false, fullRequired: false, fullPages: '', fullDeadline: '', subNote: '', maxUploadMB: 10,
  notifyEmail: '', checkinPin: '',
  certDownload: true, signatoryName: cfg.signatoryName, signatoryTitle: cfg.signatoryTitle,
  mailFromName: 'ICSSST 2027', mailReplyTo: cfg.smtp.replyTo, sendConfirmation: true, confirmNote: '',
  announcementOn: false, announcementText: '', googleVerification: cfg.googleVerification || '', bingVerification: cfg.bingVerification || '', yandexVerification: cfg.yandexVerification || '',
});
const DEFAULTS = defaults();               // snapshot of the file/env values, taken before any database overrides
const ENV_ADMIN = { user: cfg.adminUser, hash: cfg.adminHash };
const ENV_SMTP_PASS = cfg.smtp.pass;          // from the SMTP_PASS environment variable (may be empty)

// ── Malaysia-time helpers (stored as ISO strings with +08:00) ────────────────
const toLocalInput = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + 8 * 3600e3).toISOString().slice(0, 16) : ''; };
const fromLocalInput = (s) => { const t = Date.parse(s + ':00+08:00'); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };

// ── validation ───────────────────────────────────────────────────────────────
function coerce(f, raw, errors) {
  const label = f.label;
  switch (f.t) {
    case 'bool': return raw === true || raw === 'on' || raw === '1' || raw === 'true';
    case 'int': {
      const n = Number(String(raw).replace(/[, ]/g, ''));
      if (!Number.isInteger(n) || n < f.min || n > f.max) { errors.push(`${label}: enter a whole number from ${f.min.toLocaleString('en-US')} to ${f.max.toLocaleString('en-US')}.`); return DEFAULTS[f.k]; }
      return n;
    }
    case 'text': case 'longtext': {
      const s = String(raw ?? '').replace(f.t === 'text' ? /\s+/g : /[ \t]+/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
      if (s.length > f.max) { errors.push(`${label}: at most ${f.max} characters.`); return s.slice(0, f.max); }
      return s;
    }
    case 'url': {
      const t = String(raw ?? '').trim(); if (!t) return '';
      let u; try { u = new URL(t); } catch (_) { u = null; }
      if (!u || u.protocol !== 'https:' || !/(^|\.)(google\.[a-z.]{2,6}|goo\.gl|g\.co|app\.goo\.gl)$/i.test(u.hostname) || t.length > f.max) { errors.push(`${label}: paste a Google Maps link that starts with https:// (use Share in Google Maps).`); return ''; }
      return u.toString();
    }
    case 'coords': {
      const t = String(raw ?? '').trim(); if (!t) return '';
      const m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(t);
      if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) { errors.push(`${label}: enter latitude and longitude such as 5.3561, 100.3022.`); return ''; }
      return `${+m[1]}, ${+m[2]}`;
    }
    case 'date': {
      const s = String(raw || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) { errors.push(`${label}: please choose a valid date.`); return DEFAULTS[f.k]; }
      return s;
    }
    case 'odate': {
      const s = String(raw || '').trim(); if (!s) return '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) { errors.push(`${label}: please choose a valid date.`); return ''; }
      return s;
    }
    case 'datetime': {
      const s = String(raw || '').trim(); if (!s) return '';
      const iso = fromLocalInput(s); if (!iso) { errors.push(`${label}: please choose a valid date and time.`); return ''; }
      return iso;
    }
    case 'choice': return f.options.some(([v]) => v === raw) ? raw : DEFAULTS[f.k];
    case 'turl': {
      const t = String(raw ?? '').trim(); if (!t) return '';
      if (!T2U_RE.test(t) || t.length > (f.max || 500)) { errors.push(`${label}: paste a Ticket2U link that starts with https://www.ticket2u.com.my/`); return ''; }
      return t;
    }
    case 'fees': {
      const out = [], seen = new Set();
      for (const [i, line] of String(raw || '').split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        const [name = '', fee = '', url = ''] = line.split('|').map((x) => x.replace(/\s+/g, ' ').trim());
        const n = i + 1;
        if (!name || name.length > 60) { errors.push(`${label}, line ${n}: the category name is missing or longer than 60 characters.`); continue; }
        if (!fee || fee.length > 30) { errors.push(`${label}, line ${n}: add the fee after a | , e.g.  Students | RM 900.00`); continue; }
        if (url && !T2U_RE.test(url)) { errors.push(`${label}, line ${n}: the payment link must be a Ticket2U link (https://www.ticket2u.com.my/…).`); continue; }
        if (seen.has(name.toLowerCase())) { errors.push(`${label}: “${name}” is listed twice.`); continue; }
        seen.add(name.toLowerCase()); out.push({ name, fee, url });
      }
      if (!out.length) { errors.push(`${label}: add at least one category.`); return DEFAULTS[f.k]; }
      if (out.length > f.maxItems) errors.push(`${label}: at most ${f.maxItems} categories.`);
      return out.slice(0, f.maxItems);
    }
    case 'list': {
      const items = [...new Set(String(raw || '').split(/\r?\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
      if (!items.length) { errors.push(`${label}: add at least one.`); return DEFAULTS[f.k]; }
      if (items.length > f.maxItems) errors.push(`${label}: at most ${f.maxItems} entries.`);
      if (items.some((x) => x.length > f.maxLen)) errors.push(`${label}: each entry at most ${f.maxLen} characters.`);
      return items.slice(0, f.maxItems).map((x) => x.slice(0, f.maxLen));
    }
  }
  return raw;
}

function validate(body, googleConfigured) {
  const errors = [], out = {};
  for (const f of FIELDS) out[f.k] = coerce(f, body[f.k], errors);
  if (!out.allowEmail && !(out.allowGoogle && googleConfigured)) errors.push('Keep at least one sign-in method on (Google sign-in only counts when it is configured on the server).');
  if (out.mailReplyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.mailReplyTo)) errors.push('Reply-to address: please enter a valid email address.');
  if (out.eventEndDate) {
    const span = (Date.parse(out.eventEndDate + 'T00:00:00Z') - Date.parse(out.eventDate + 'T00:00:00Z')) / 86400e3;
    if (span < 0) errors.push('The last day of the event cannot be before the first day.');
    else if (span > 13) errors.push('An event can span at most 14 days.');
    if (span === 0) out.eventEndDate = '';
  }
  if (out.notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.notifyEmail)) errors.push('Tell the organisers at: enter one email address.');
  if (out.checkinPin && !/^[A-Za-z0-9]{4,20}$/.test(out.checkinPin)) errors.push('Check-in desk PIN: 4–20 letters or digits.');
  if (out.absMin && out.absMax && out.absMin > out.absMax) errors.push('Abstract: the minimum number of words cannot be more than the maximum.');
  if (out.opensAt && out.closesAt && Date.parse(out.opensAt) >= Date.parse(out.closesAt)) errors.push('“Closes at” must be later than “Opens at”.');
  return { errors, values: out };
}

// ── load / save / apply ──────────────────────────────────────────────────────
let current = {};
function stored() {
  const o = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) { try { o[r.key] = JSON.parse(r.value); } catch (_) { /* ignore */ } }
  return o;
}
function apply(v) {
  current = v;
  cfg.regOpen = v.regOpen; cfg.seatLimit = v.seatLimit; cfg.opensAt = v.opensAt; cfg.closesAt = v.closesAt; cfg.showSeatsLeft = v.showSeatsLeft;
  if (!Array.isArray(cfg.cats)) cfg.cats = [];
  cfg.fees = v.fees.map((x) => ({ ...x, early: isEarly(x.name) }));
  cfg.cats.length = 0; cfg.cats.push(...cfg.fees.map((x) => x.name));      // same array object, so every module sees the change
  cfg.payProvider = v.payProvider || 'ticket2u'; cfg.ticket2uUrl = v.ticket2uUrl; cfg.earlyBirdEnds = v.earlyBirdEnds; cfg.paymentNote = v.paymentNote; cfg.payEmail = v.payEmail;
  cfg.allowGoogle = v.allowGoogle; cfg.allowEmail = v.allowEmail;
  cfg.codeMinutes = v.codeMinutes; cfg.resendSeconds = v.resendSeconds; cfg.maxCodeAttempts = v.maxCodeAttempts; cfg.maxCodeSends = v.maxCodeSends;
  cfg.perIpHour = v.perIpHour; cfg.perEmailHour = v.perEmailHour; cfg.minSubmitSeconds = v.minSubmitSeconds;
  const D = (iso) => new Date(iso + 'T00:00:00Z'), f = (d, o) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  const d0 = D(v.eventDate), d1 = v.eventEndDate && v.eventEndDate > v.eventDate ? D(v.eventEndDate) : null;
  cfg.eventDate = v.eventDate; cfg.eventEndDate = d1 ? v.eventEndDate : '';
  cfg.eventDays = []; for (let t = d0.getTime(); t <= (d1 || d0).getTime(); t += 86400e3) cfg.eventDays.push(new Date(t).toISOString().slice(0, 10));
  cfg.eventDateText = !d1 ? f(d0, { day: 'numeric', month: 'long', year: 'numeric' })
    : d0.getUTCFullYear() === d1.getUTCFullYear() && d0.getUTCMonth() === d1.getUTCMonth() ? `${d0.getUTCDate()}–${f(d1, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : d0.getUTCFullYear() === d1.getUTCFullYear() ? `${f(d0, { day: 'numeric', month: 'long' })} – ${f(d1, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `${f(d0, { day: 'numeric', month: 'long', year: 'numeric' })} – ${f(d1, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  cfg.eventWeekday = d1 ? `${f(d0, { weekday: 'long' })} – ${f(d1, { weekday: 'long' })}` : f(d0, { weekday: 'long' });
  cfg.eventDayLabel = (iso) => f(D(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  cfg.eventTime = v.eventTime; cfg.eventVenue = v.eventVenue; cfg.progNote = v.progNote || ''; cfg.eventSub = v.eventSub;
  cfg.venueAddress = v.venueAddress; cfg.venueDetails = v.venueDetails; cfg.posterSpecs = v.posterSpecs; cfg.presenterNotes = v.presenterNotes; cfg.mapUrl = v.mapUrl; cfg.mapCoords = v.mapCoords;
  { const q = v.mapCoords ? v.mapCoords.replace(/\s+/g, '') : [v.eventVenue, v.venueAddress].filter(Boolean).join(', '), enc = encodeURIComponent(q), ll = v.mapCoords ? v.mapCoords.replace(/\s+/g, '') : '';
    cfg.map = { query: q, address: v.venueAddress,
      open: v.mapUrl || `https://www.google.com/maps/search/?api=1&query=${enc}`,
      dir: `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
      embed: `https://www.google.com/maps?q=${enc}&z=16&output=embed` }; }
  cfg.certDownload = v.certDownload !== false; cfg.signatoryName = v.signatoryName; cfg.signatoryTitle = v.signatoryTitle;
  cfg.smtp.replyTo = v.mailReplyTo || DEFAULTS.mailReplyTo;
  cfg.smtp.from = `"${v.mailFromName.replace(/["\\\r\n]/g, '')}" <${cfg.smtp.user}>`;
  cfg.sendConfirmation = v.sendConfirmation; cfg.confirmNote = v.confirmNote;
  cfg.announcementOn = v.announcementOn; cfg.announcementText = v.announcementText;
  for (const f of FIELDS) if (f.g === 'subs') cfg[f.k] = v[f.k];
  cfg.notifyEmail = v.notifyEmail || ''; cfg.checkinPin = v.checkinPin || '';
  cfg.googleVerification = v.googleVerification; cfg.bingVerification = v.bingVerification || ''; cfg.yandexVerification = v.yandexVerification || '';
}
function load() {
  const s = stored(), v = defaults2();
  for (const f of FIELDS) if (s[f.k] !== undefined) v[f.k] = s[f.k];
  // sanity: stored values are trusted (they were validated on save), but never let a bad row break start-up
  if (!Array.isArray(v.fees) || !v.fees.length || v.fees.some((x) => !x || !x.name)) v.fees = DEFAULTS.fees.map((x) => ({ ...x }));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.eventDate)) v.eventDate = DEFAULTS.eventDate;
  apply(v);
  // admin account overrides
  cfg.adminUser = s.adminUser || ENV_ADMIN.user;
  cfg.adminHash = s.adminHash || ENV_ADMIN.hash;
  // email password: one saved from Admin → Settings wins over the environment variable (survives redeploys)
  cfg.smtp.pass = s.smtpPass || ENV_SMTP_PASS;
  cfg.smtpPassSource = s.smtpPass ? 'settings' : ENV_SMTP_PASS ? 'environment' : '';
  cfg.signatureData = s.signatureData || '';
  cfg.signatureVer = cfg.signatureData ? String(cfg.signatureData.length) + '-' + (s.signatureAt || '') : '';
  return v;
}
const defaults2 = () => JSON.parse(JSON.stringify(DEFAULTS));
function save(values) {
  const up = db.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at');
  const t = new Date().toISOString();
  db.exec('BEGIN'); try { for (const f of FIELDS) up.run(f.k, JSON.stringify(values[f.k]), t); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  load();
}
function setRaw(key, value) {   // admin credentials, signature image …
  db.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(key, JSON.stringify(value), new Date().toISOString());
  load();
}
function delRaw(key) { db.prepare('DELETE FROM settings WHERE key=?').run(key); load(); }
function resetAll() {            // back to the values from config / environment (keeps admin password and signature)
  db.prepare("DELETE FROM settings WHERE key NOT IN ('adminUser','adminHash','signatureData','signatureAt','smtpPass')").run(); load();
}
const get = () => current;
// fee helpers
const earlyOpen = () => !cfg.earlyBirdEnds || Date.now() < Date.parse(cfg.earlyBirdEnds);
const feeOf = (name) => cfg.fees.find((x) => x.name === name) || null;
const availableFees = () => cfg.fees.filter((x) => !x.early || earlyOpen());
const payUrl = (name) => { const f = feeOf(name); return (f && f.url) || cfg.ticket2uUrl || ''; };
const isOpen = () => {
  if (!cfg.regOpen) return false;
  const now = Date.now();
  if (cfg.opensAt && now < Date.parse(cfg.opensAt)) return false;
  if (cfg.closesAt && now >= Date.parse(cfg.closesAt)) return false;
  return true;
};

load();
module.exports = { GROUPS, FIELDS, byKey, validate, save, setRaw, delRaw, resetAll, get, load, isOpen, toLocalInput, DEFAULTS, earlyOpen, feeOf, availableFees, payUrl };
