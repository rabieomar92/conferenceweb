'use strict';
// Keep the process small on shared hosting. Hosting panels such as Hostinger count every thread as a "process".
// Node normally starts one V8 helper thread per CPU core of the (large, shared) server — often 40–60 threads per app.
// If the app was started without a thread limit, it restarts itself once in place (same process, same PID) with
// --v8-pool-size=2 and a 2-thread I/O pool: about 8–10 threads in total. Set THREAD_LIMIT=off to disable.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
{
  const os = require('os'), cores = (os.availableParallelism ? os.availableParallelism() : os.cpus().length) || 1;
  const limited = /--v8-pool-size/.test(process.execArgv.join(' ') + ' ' + (process.env.NODE_OPTIONS || ''));
  if (!limited && (cores > 3 || process.env.THREAD_LIMIT === 'force') && process.env.THREAD_LIMIT !== 'off' && !process.env.ICSSST_REEXEC && typeof process.execve === 'function') {
    try {
      process.execve(process.execPath, [process.execPath, '--v8-pool-size=2', ...process.execArgv, ...process.argv.slice(1)], { ...process.env, ICSSST_REEXEC: '1' });
    } catch (err) { console.warn('Could not limit helper threads (' + err.message + '); set NODE_OPTIONS=--v8-pool-size=2 in the hosting panel.'); }
  }
}
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const PW = require('./lib/pw');
let svgCaptchaLib; const svgCaptcha = { create: (o) => (svgCaptchaLib ||= require('svg-captcha')).create(o) };   // loaded on first use (saves memory at start-up)
const cfg = require('./config');
const { db, secret } = require('./lib/db');
const settings = require('./lib/settings');            // loads runtime settings from the database into cfg
const views = require('./lib/views');
const adminViews = require('./lib/admin-views');
const mail = require('./lib/mail');
const stripe = require('./lib/stripe');
const parts = require('./lib/participants');
const { normaliseEmail, maskEmail } = require('./lib/util');

process.on('uncaughtException', (e) => console.error('UNCAUGHT', e));
process.on('unhandledRejection', (e) => console.error('UNHANDLED', e));
const SECRET = secret(cfg);
const CATS = cfg.cats;                                   // live array, edited from the Settings page
const app = express();
const router = express.Router();
const inst = require('./lib/institutions');
const speakers = require('./lib/speakers');
const spv = require('./lib/speaker-views');

app.disable('x-powered-by');
app.set('trust proxy', cfg.trustProxy);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'frame-src': ["'self'", 'https://www.google.com'],
      'form-action': ["'self'", 'https://checkout.stripe.com', ...(process.env.STRIPE_CHECKOUT_ORIGIN ? [process.env.STRIPE_CHECKOUT_ORIGIN] : [])],          // Stripe Checkout is reached by a redirect after a form post
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': cfg.secureCookies ? [] : null,
    },
  },
}));
app.use(cookieSession({ name: 'icssst', keys: [SECRET], httpOnly: true, sameSite: 'lax', secure: cfg.secureCookies, maxAge: 8 * 3600 * 1000 }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
const i18n = require('./lib/i18n');
app.use(i18n.middleware);                                              // Bahasa Melayu / English   // speaker abstracts/biographies can be long (and non-Latin)

// ── helpers ───────────────────────────────────────────────
const ipHash = (req) => crypto.createHmac('sha256', SECRET).update(req.ip || '0').digest('hex');
const csrfToken = (req) => (req.session.csrf ||= crypto.randomBytes(24).toString('hex'));
const csrfOk = (req) => {
  const a = String(req.body?.csrf || ''), b = String(req.session.csrf || '');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
const seatsTaken = () => db.prepare('SELECT COUNT(*) c FROM registrations WHERE cancelled_at IS NULL').get().c;   // a cancelled registration frees its seat
const seatsLeft = () => (cfg.seatLimit > 0 ? Math.max(0, cfg.seatLimit - seatsTaken()) : Infinity);   // no limit set → never full
const DEFAULT_ADMIN_HASH = '$2b$12$yIUnLxFZjgLscFLScT/OUe7lJqmO0cqyNZoDeEYq4KNs9cPqKth4u';
const adminTag = () => crypto.createHmac('sha256', SECRET).update(cfg.adminUser + '|' + cfg.adminHash).digest('hex').slice(0, 20);   // changes when the admin password changes: older sessions stop working
const adminDefault = () => cfg.adminHash === DEFAULT_ADMIN_HASH && process.env.NODE_ENV === 'production';
const requireAdmin = (req, res, next) => (req.session.admin && req.session.av === adminTag() && !adminDefault() ? next() : (req.session = null, res.redirect(cfg.base + '/admin/login')));
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function newRef() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let r = 'IC27-'; for (let i = 0; i < 5; i++) r += alpha[crypto.randomInt(alpha.length)];
    if (!db.prepare('SELECT 1 FROM registrations WHERE ref=?').get(r)) return r;
  }
}
const flash = (req, ok, err) => { req.session.flash = { ok: ok || '', err: [].concat(err || []) }; };
const takeFlash = (req) => { const f = req.session.flash; req.session.flash = null; return f || { ok: '', err: [] }; };
// the header and the home-page buttons depend on who is signed in: shown here, so every page gets them
function viewer(req) {
  const s = (req && req.session) || {}, B = cfg.base;
  if (s.admin) return { href: B + '/admin', label: 'Admin', out: B + '/admin/logout' };
  if (s.pp) return { href: B + '/account', label: 'My dashboard', out: B + '/logout' };
  if (s.spk) return { href: B + '/speaker', label: 'Speaker dashboard', out: B + '/speaker/logout' };
  return null;
}
function authNav(req) {
  const w = viewer(req), B = cfg.base;
  if (!w) return `<a class="login" href="${B}/login">Log in</a><a class="pill" href="${B}/register">Register</a>`;
  return `<a class="login" href="${w.href}">${w.label}</a><form class="lo" method="post" action="${w.out}"><input type="hidden" name="csrf" value="${csrfToken(req)}"><button class="pill" type="submit">Log out</button></form>`;
}
const html = (res, body, status = 200) => {
  if (body.includes('<!--')) {
    const w = viewer(res.req), B = cfg.base;
    body = body.replace('<!--AUTHNAV-->', () => authNav(res.req))
      .replace('<!--HEROCTA-->', () => (w ? `<a class="btn" href="${w.href}">Go to my dashboard</a>` : `<a class="btn" href="${B}/register">Register now</a><a class="b2l" href="${B}/login">Already registered? Log in</a>`))
      .replace('<!--HEROCTA2-->', () => `<a class="b2l" href="${w ? w.href : B + '/login'}">${w ? 'Go to my dashboard' : 'Log in'}</a>`)
      .replaceAll('<!--LANG-->', () => i18n.switcher(res.req));
  }
  if (!/\/admin(\/|$)/.test(res.req.path)) body = i18n.translate(body.replace('</head>', () => i18n.clientDict() + '</head>'));
  return res.status(status).type('html').set('Cache-Control', 'no-store').send(body);
};

// ── captcha (server-side, single use) ─────────────────────
const captchas = new Map(); // id -> { h, t }
setInterval(() => { const now = Date.now(); for (const [k, v] of captchas) if (now - v.t > 600000) captchas.delete(k); }, 60000).unref();
router.get('/healthz', (req, res) => res.type('text').send('ok'));
router.get('/captcha.svg', (req, res) => {
  if (req.session.cap) captchas.delete(req.session.cap);
  const c = svgCaptcha.create({ size: 5, noise: 3, color: false, width: 190, height: 62, fontSize: 56, ignoreChars: '0oO1iIlLQqgG' });
  const id = crypto.randomBytes(12).toString('hex');
  captchas.set(id, { h: hmac(c.text.toUpperCase()), t: Date.now() });
  req.session.cap = id;
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(c.data.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="#F8F7F4"/>'));
});

// ── public pages ──────────────────────────────────────────
const regOpenNow = () => settings.isOpen() && seatsLeft() > 0;
router.get('/', (req, res) => { const list = speakers.published(); html(res, views.home({ left: seatsLeft(), open: regOpenNow(), speakersHtml: spv.section(list), performers: list })); });

router.get('/register', (req, res) => {
  if (req.query.done !== undefined) return res.redirect(cfg.base + '/account');
  const g = googleUser(req);
  if (g) {                                                                             // this Google account already registered → open its page
    const r = db.prepare('SELECT * FROM registrations WHERE email_key=?').get(normaliseEmail(g.email));
    if (r) {                                                                           // full row, so the session tag matches a password set earlier
      const fromLogin = !!g.login;
      return ppSignIn(req, res, r, fromLogin ? '' : i18n.t(`This Google account (${r.email}) is already registered, so we have signed you in to your registration instead.`));
    }
  }
  const errors = req.session.gerr ? [req.session.gerr] : []; req.session.gerr = null;
  html(res, views.register({ errors, left: seatsLeft(), cats: CATS, csrf: csrfToken(req), now: Math.floor(Date.now() / 1000), v: { country: 'Malaysia', full_name: g ? g.name : '', email: g ? g.email : '' }, google: g, googleOn: googleOn() }));
});

// ── Google sign-in (OAuth 2.0 authorization-code flow) ────
const googleConfigured = () => !!(cfg.google.clientId && cfg.google.clientSecret);
const googleOn = () => googleConfigured() && cfg.allowGoogle;
const redirectUri = () => cfg.google.redirectUri || cfg.siteUrl.replace(/\/+$/, '') + '/auth/google/callback';
const googleUser = (req) => { const g = req.session.g; return googleOn() && g && nowS() - g.t < 1800 ? g : null; };   // valid for 30 minutes
router.get('/auth/google', (req, res) => {
  if (!googleOn()) return res.redirect(cfg.base + '/register');
  const state = crypto.randomBytes(24).toString('hex');
  req.session.gs = { s: state, t: nowS(), next: req.query.next === 'account' ? 'account' : '' };
  const q = new URLSearchParams({ client_id: cfg.google.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q);
});
router.get('/auth/google/callback', async (req, res) => {
  const gs = req.session.gs; req.session.gs = null;                                             // single use
  const back = (msg) => { if (msg) req.session.gerr = msg; res.redirect(cfg.base + (gs && gs.next === 'account' && msg ? '/login' : '/register')); };
  if (!googleOn()) return back();
  if (req.query.error) return back(req.query.error === 'access_denied' ? 'Google sign-in was cancelled. You can try again or register with an email code.' : 'Google sign-in failed. Please try again or register with an email code.');
  if (!gs || nowS() - gs.t > 600 || !req.query.state || !safeEq(String(req.query.state), gs.s) || !req.query.code) return back('Google sign-in expired. Please try again.');
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(req.query.code), client_id: cfg.google.clientId, client_secret: cfg.google.clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15000),
    });
    const tok = await tr.json();
    if (!tr.ok || !tok.access_token) throw new Error('token: ' + (tok.error_description || tok.error || tr.status));
    const ur = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token }, signal: AbortSignal.timeout(15000) });
    const u = await ur.json();
    if (!ur.ok || !u.email) throw new Error('userinfo: ' + ur.status);
    if (!u.email_verified) return back('Your Google email address is not verified. Please use another account or register with an email code.');
    req.session.g = { email: String(u.email).toLowerCase().slice(0, 160), name: String(u.name || '').slice(0, 120), t: nowS(), login: gs.next === 'account' };
    if (gs.next === 'account' && !db.prepare('SELECT 1 FROM registrations WHERE email_key=?').get(normaliseEmail(u.email))) {
      req.session.gerr = `There is no registration for ${u.email} yet. Please complete the form below to register.`;
    }
    return res.redirect(cfg.base + '/register');                                       // /register sends registered users on to their page
  } catch (ex) {
    console.error('Google sign-in failed:', ex.message);
    return back('We could not complete Google sign-in. Please try again or register with an email code.');
  }
});
router.get('/auth/google/logout', (req, res) => { req.session.g = null; res.redirect(cfg.base + '/register'); });

// ── e-mail verification flow ──────────────────────────────
const nowS = () => Math.floor(Date.now() / 1000);
const genCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const codeHash = (key, code) => hmac(`${key}:${code}`);
const getPending = (req) => (req.session.pid ? db.prepare('SELECT * FROM pending WHERE id=?').get(req.session.pid) : null);
setInterval(() => { db.prepare('DELETE FROM pending WHERE expires_at < ?').run(nowS() - 3600); db.prepare('DELETE FROM mail_log WHERE ts < ?').run(nowS() - 3600); }, 300000).unref();

// returns an error string or '' (and records the send) – limits e-mail bombing
function mailAllowed(req, key) {
  const t = nowS();
  const perIp = db.prepare('SELECT COUNT(*) c FROM mail_log WHERE ip_hash=? AND ts>?').get(ipHash(req), t - 3600).c;
  const perKey = db.prepare('SELECT COUNT(*) c, MAX(ts) m FROM mail_log WHERE email_key=? AND ts>?').get(key, t - 3600);
  if (perIp >= cfg.perIpHour) return 'Too many verification emails requested from this connection. Please try again later.';
  if (perKey.c >= cfg.perEmailHour) return 'Too many verification emails for this address. Please try again in an hour.';
  if (perKey.m && t - perKey.m < cfg.resendSeconds) return `Please wait ${cfg.resendSeconds - (t - perKey.m)} seconds before requesting another code.`;
  return '';
}
async function sendCode(p, code) {
  const d = JSON.parse(p.data);
  const m = mail.codeEmail({ name: d.full_name, code });
  await mail.send({ to: p.email, subject: m.subject, text: m.text, html: m.html });
}
const verifyPage = (req, res, extra = {}) => {
  const p = getPending(req);
  const wait = p ? Math.max(0, cfg.resendSeconds - (nowS() - p.last_sent)) : 0;
  return html(res, views.verifyCode({ masked: maskEmail(p.email), csrf: csrfToken(req), wait, ...extra }));
};

// Insert a verified registration, send the confirmation email, and show the success page.
async function finishRegistration(req, res, d, email, key, method) {
  let ref;
  try {
    ref = newRef();
    const fee = (settings.feeOf(d.category) || {}).fee || '';
    const now = new Date().toISOString();
    db.prepare("INSERT INTO registrations (ref,full_name,email,email_key,phone,organisation,category,country,created_at,ip_hash,method,fee,pay_status,pw_hash,pw_set_at,salutation,designation,participation,paper_title) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'unpaid',?,?,?,?,?,?)")
      .run(ref, d.full_name, email, key, d.phone, d.organisation, d.category, d.country, now, ipHash(req), method, fee, d.pw_hash || null, d.pw_hash ? now : null, d.salutation || '', d.designation || '', d.participation || '', d.paper_title || '');
    d.fee = fee;
  } catch (ex) { return /UNIQUE/.test(String(ex.message)) ? 'This email address is already registered. Sign in to your registration page to pay or check your status.' : 'Something went wrong. Please try again.'; }
  const id = db.prepare('SELECT id FROM registrations WHERE ref=?').get(ref).id;
  req.session.pid = null; setPP(req, db.prepare('SELECT id,pw_set_at FROM registrations WHERE id=?').get(id));                                         // signed in: straight to payment
  if (cfg.sendConfirmation) try {
    const m = mail.confirmEmail({ name: d.full_name, ref, organisation: d.organisation, category: d.category, fee: d.fee });
    await mail.send({ to: email, subject: m.subject, text: m.text, html: m.html });
  } catch (ex) { console.error('Confirmation email failed for ' + ref + ':', ex.message); }   // registration still stands
  res.redirect(cfg.base + '/account?welcome=1');
  return '';
}

router.post('/register', async (req, res) => {
  const b = req.body || {}; const errors = [];
  const g = googleUser(req);                       // signed in with Google → e-mail already verified by Google
  if (g) b.email = g.email;
  const v = {
    full_name: String(b.full_name || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    email: String(b.email || '').trim().slice(0, 160),
    phone: String(b.phone || '').trim().slice(0, 30),
    organisation: String(b.organisation || '').trim().slice(0, 160),
    category: String(b.category || '').trim(),
    country: String(b.country || '').trim().slice(0, 60),
    consent: !!b.consent,
    salutation: parts.SALUTATIONS.includes(b.salutation) ? b.salutation : '',
    designation: String(b.designation || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
    participation: parts.PARTICIPATION.includes(b.participation) ? b.participation : '',
    paper_title: String(b.paper_title || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300),
  };
  const pw = String(b.password || ''), pw2 = String(b.password2 || '');
  if (!csrfOk(req)) errors.push('Your session expired. Please try again.');
  if (b.website) errors.push('Submission rejected.');                                   // honeypot
  if (!g && !cfg.allowEmail) errors.push('Registration with an email code is switched off. Please continue with Google.');
  const ts = Number(b.ts || 0);
  if (ts && Date.now() / 1000 - ts < cfg.minSubmitSeconds) errors.push('That was very quick — please try again.');
  if (!regOpenNow()) errors.push(seatsLeft() <= 0 ? 'Registration is now closed — all seats are taken.' : 'Registration is currently closed.');

  if (!g) {
    const capId = req.session.cap; const cap = capId && captchas.get(capId);
    if (capId) captchas.delete(capId); req.session.cap = null;                          // single use
    const given = String(b.captcha || '').replace(/\s+/g, '').toUpperCase();
    if (!cap || Date.now() - cap.t > 600000 || !safeEq(cap.h, hmac(given))) errors.push('The verification code was incorrect. Please try the new code.');
  }

  v.org_custom = b.org_custom === '1';
  if (!inst.countrySet.has(v.country)) { errors.push('Please choose your country from the list.'); v.country = ''; }
  {                                                                                    // institution: canonical name from the list, or an explicit "not listed" entry
    const hit = inst.lookup(v.organisation, v.country);
    if (hit) { v.organisation = hit.name; v.org_custom = false; if (!v.country && hit.country) v.country = hit.country; }
    else if (v.organisation) {
      v.organisation = v.organisation.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
      if (b.js === '1' && !v.org_custom) errors.push('Please choose your institution from the list. If it is not there, select “My institution isn’t listed”.');
      else if (v.organisation.length < 3 || !/[\p{L}]{3}/u.test(v.organisation)) errors.push('Please enter a valid institution or organisation name.');
    }
  }
  if (v.full_name.length < 3) errors.push('Please enter your full name (as it should appear on your certificate).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.push('Please enter a valid email address.');
  if (v.phone && !/^[0-9+()\-\s]{6,30}$/.test(v.phone)) errors.push('Please enter a valid phone number.');
  if (!v.organisation) errors.push('Please enter your institution or organisation.');
  if (!settings.availableFees().some((f) => f.name === v.category)) errors.push('Please choose your registration category.');
  if (!v.participation) errors.push('Please say how you are taking part (oral, poster or non-presenting).');
  { const pe = pw !== pw2 ? 'The two passwords do not match.' : speakers.checkPassword(pw, { email: v.email }); if (pe) errors.push(pe); }
  if (!v.consent) errors.push('Please agree to the use of your details for this event.');

  const key = normaliseEmail(v.email);
  if (!errors.length && db.prepare('SELECT 1 FROM registrations WHERE email_key=?').get(key)) errors.push('This email address is already registered.');
  if (!errors.length) v.pw_hash = await PW.hash(pw);                   // only the hash is kept, even in the pending sign-up
  if (!errors.length && g) {                       // Google path: no email code needed
    const err = await finishRegistration(req, res, v, g.email, key, 'google');
    if (!err) { req.session.g = null; return; }
    errors.push(err);
  }
  if (!errors.length && !g) { const m = mailAllowed(req, key); if (m) errors.push(m); }

  if (!errors.length) {
    const code = genCode(); const t = nowS();
    db.prepare('DELETE FROM pending WHERE email_key=?').run(key);                       // a new attempt replaces an older unverified one
    const info = db.prepare('INSERT INTO pending (email_key,email,data,code_hash,expires_at,last_sent,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(key, v.email.toLowerCase(), JSON.stringify(v), codeHash(key, code), t + cfg.codeMinutes * 60, t, t);
    const p = db.prepare('SELECT * FROM pending WHERE email_key=?').get(key);
    try {
      await sendCode(p, code);
      db.prepare('INSERT INTO mail_log (ip_hash,email_key,ts) VALUES (?,?,?)').run(ipHash(req), key, t);
      req.session.pid = p.id;
      return res.redirect(cfg.base + '/register/verify');
    } catch (ex) {
      console.error('Verification email failed:', ex.message);
      db.prepare('DELETE FROM pending WHERE id=?').run(p.id);
      errors.push('We could not send the verification email. Please check the address and try again, or contact ' + cfg.smtp.replyTo + '.');
    }
  }
  html(res, views.register({ errors, v, left: seatsLeft(), cats: CATS, csrf: csrfToken(req), now: Math.floor(Date.now() / 1000), google: g, googleOn: googleOn() }));
});

router.get('/register/verify', (req, res) => {
  const p = getPending(req);
  if (!p) return res.redirect(cfg.base + '/register');
  verifyPage(req, res);
});

router.post('/register/verify', async (req, res) => {
  const p = getPending(req);
  if (!p) return res.redirect(cfg.base + '/register');
  if (!csrfOk(req)) return verifyPage(req, res, { error: 'Session expired. Please try again.' });
  const fail = (msg) => { db.prepare('DELETE FROM pending WHERE id=?').run(p.id); req.session.pid = null;
    return html(res, views.register({ errors: [msg], v: JSON.parse(p.data), left: seatsLeft(), cats: CATS, csrf: csrfToken(req), now: nowS() })); };
  if (nowS() > p.expires_at) return fail('That code has expired. Please submit the form again to get a new one.');
  if (p.attempts >= cfg.maxCodeAttempts) return fail('Too many incorrect attempts. Please submit the form again.');
  const code = String(req.body.code || '').replace(/\D/g, '');
  db.prepare('UPDATE pending SET attempts = attempts + 1 WHERE id=?').run(p.id);
  if (code.length !== 6 || !safeEq(codeHash(p.email_key, code), p.code_hash)) {
    const left = cfg.maxCodeAttempts - (p.attempts + 1);
    if (left <= 0) return fail('Too many incorrect attempts. Please submit the form again.');
    return verifyPage(req, res, { error: `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.` });
  }
  // ✔ verified – complete the registration
  const d = JSON.parse(p.data);
  if (seatsLeft() <= 0) return fail('Sorry — all seats were taken while you were verifying.');
  const err = await finishRegistration(req, res, d, p.email, p.email_key, 'email');
  if (err) return fail(err);
  db.prepare('DELETE FROM pending WHERE id=?').run(p.id);
});

router.post('/register/resend', async (req, res) => {
  const p = getPending(req);
  if (!p) return res.redirect(cfg.base + '/register');
  if (!csrfOk(req)) return verifyPage(req, res, { error: 'Session expired. Please try again.' });
  const m = mailAllowed(req, p.email_key);
  if (m) return verifyPage(req, res, { error: m });
  if (p.sends >= cfg.maxCodeSends) return verifyPage(req, res, { error: 'Maximum number of codes sent. Please try again later.' });
  const code = genCode(), t = nowS();
  db.prepare('UPDATE pending SET code_hash=?, expires_at=?, last_sent=?, sends=sends+1, attempts=0 WHERE id=?').run(codeHash(p.email_key, code), t + cfg.codeMinutes * 60, t, p.id);
  try {
    await sendCode(db.prepare('SELECT * FROM pending WHERE id=?').get(p.id), code);
    db.prepare('INSERT INTO mail_log (ip_hash,email_key,ts) VALUES (?,?,?)').run(ipHash(req), p.email_key, t);
    return verifyPage(req, res, { info: 'A new code has been sent.' });
  } catch (ex) {
    console.error('Resend failed:', ex.message);
    return verifyPage(req, res, { error: 'We could not send the email. Please try again shortly.' });
  }
});

router.post('/register/cancel', (req, res) => {
  const p = getPending(req);
  if (p && csrfOk(req)) db.prepare('DELETE FROM pending WHERE id=?').run(p.id);
  req.session.pid = null;
  res.redirect(cfg.base + '/register');
});


// ── participants: sign in with an emailed code (or Google), “My registration”, Ticket2U payment ──
const currentReg = (req) => {
  if (!req.session.pp) return null;
  const r = db.prepare('SELECT * FROM registrations WHERE id=?').get(req.session.pp);
  return r && (req.session.pv || '') === (r.pw_set_at || '') ? r : null;        // a password change signs out every other device
};
const setPP = (req, r) => { req.session.pp = r.id; req.session.pv = r.pw_set_at || ''; };
const CANCELLED_OK = new Set(['/account', '/account/reinstate', '/account/delete', '/account/receipt']);
const requireReg = (req, res, next) => {
  const r = currentReg(req); if (!r) { req.session.pp = null; return res.redirect(cfg.base + '/login'); }
  if (r.cancelled_at && !CANCELLED_OK.has(req.path)) return req.method === 'GET' ? res.redirect(cfg.base + '/account') : (res.status(409), req.get('X-CSRF') ? res.json({ ok: false, error: 'This registration was cancelled.' }) : res.redirect(cfg.base + '/account'));
  req.reg = r; next();
};
const ppSignIn = (req, res, r, welcome) => {
  db.prepare('UPDATE registrations SET last_login=? WHERE id=?').run(new Date().toISOString(), r.id);
  req.session = { pp: r.id, pv: r.pw_set_at || '', csrf: crypto.randomBytes(24).toString('hex') };              // fresh session on sign-in
  if (welcome) flash(req, welcome);
  res.redirect(cfg.base + '/account');
};
// password sign-in, like the speaker portal; the emailed code is only for a forgotten password
const loginPage = (req, res, o = {}, status = 200) => { const info = req.session.gerr || ''; req.session.gerr = null; html(res, views.login({ csrf: csrfToken(req), googleOn: googleOn(), err: o.err || info, email: o.email || '', info: o.info || '' }), status); };
router.get('/login', (req, res) => (currentReg(req) ? res.redirect(cfg.base + '/account') : loginPage(req, res, { email: String(req.query.email || '').slice(0, 160) })));
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160), password = String(req.body.password || '');
  if (!csrfOk(req)) return loginPage(req, res, { err: 'Your session expired. Please try again.', email }, 400);
  if (!EMAIL_RE.test(email) || !password) return loginPage(req, res, { err: 'Please enter your email address and password.', email }, 400);
  const key = normaliseEmail(email), keys = ['ep:' + key, 'ip:' + ipHash(req)];
  const wait = speakers.locked(keys);
  if (wait) return loginPage(req, res, { err: `Too many unsuccessful attempts. Please wait ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''} or reset your password.`, email }, 429);
  const r = db.prepare('SELECT * FROM registrations WHERE email_key=?').get(key);
  const ok = await speakers.verifyPassword(r ? { pw_hash: r.pw_hash } : null, password);
  if (!ok) {
    speakers.fail(keys);
    return loginPage(req, res, { err: 'That email and password do not match. Check them, or use “Forgot or set password” below; if you have not set a password yet, that is the way in.', email }, 401);
  }
  speakers.clearFails(['ep:' + key]);
  if (PW.legacy(r.pw_hash)) PW.hash(password).then((h) => db.prepare('UPDATE registrations SET pw_hash=? WHERE id=? AND pw_hash=?').run(h, r.id, r.pw_hash)).catch(() => {});   // upgrade old bcrypt hash
  ppSignIn(req, res, r);
});
// forgotten password: email a 6-digit code → enter it → choose a new password
const forgotPage = (req, res, o = {}, status = 200) => html(res, views.forgot({ csrf: csrfToken(req), email: o.email || '', err: o.err || '' }), status);
const codePage = (req, res, o = {}, status = 200) => { const l = req.session.pl; const row = l && db.prepare('SELECT last_sent FROM login_codes WHERE email_key=?').get(l.key); html(res, views.loginCode({ csrf: csrfToken(req), masked: l.masked, wait: Math.max(0, cfg.resendSeconds - (nowS() - (row ? row.last_sent : l.t))), ...o }), status); };
async function sendLoginCode(req, key) {
  const r = db.prepare('SELECT full_name,email FROM registrations WHERE email_key=?').get(key), t = nowS();
  db.prepare('INSERT INTO mail_log (ip_hash,email_key,ts) VALUES (?,?,?)').run(ipHash(req), key, t);
  if (!r) return;                                                                        // unknown address: same response, no email (no account discovery)
  const code = genCode();
  db.prepare('INSERT INTO login_codes (email_key,code_hash,expires_at,attempts,last_sent) VALUES (?,?,?,0,?) ON CONFLICT(email_key) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, last_sent=excluded.last_sent')
    .run(key, codeHash('pp:' + key, code), t + cfg.codeMinutes * 60, t);
  const m = mail.loginCodeEmail({ name: r.full_name, code });
  mail.send({ to: r.email, subject: m.subject, text: m.text, html: m.html }).catch((ex) => console.error('Reset code email failed:', ex.message));   // not awaited: same response time for every address
}
router.get('/login/forgot', (req, res) => forgotPage(req, res, { email: String(req.query.email || '').slice(0, 160) }));
router.post('/login/forgot', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
  if (!csrfOk(req)) return forgotPage(req, res, { err: 'Your session expired. Please try again.', email }, 400);
  if (!EMAIL_RE.test(email)) return forgotPage(req, res, { err: 'Please enter a valid email address.', email }, 400);
  const key = normaliseEmail(email), lim = mailAllowed(req, key);
  if (lim) return forgotPage(req, res, { err: lim, email }, 429);
  try { await sendLoginCode(req, key); } catch (ex) { console.error('Reset code email failed:', ex.message); return forgotPage(req, res, { err: 'We could not send the email just now. Please try again shortly, or contact ' + cfg.smtp.replyTo + '.', email }, 500); }
  req.session.pl = { key, masked: maskEmail(email), t: nowS() };
  res.redirect(cfg.base + '/login/verify');
});
router.get('/login/verify', (req, res) => (req.session.pl ? codePage(req, res) : res.redirect(cfg.base + '/login/forgot')));
router.post('/login/verify', (req, res) => {
  const l = req.session.pl; if (!l) return res.redirect(cfg.base + '/login/forgot');
  if (!csrfOk(req)) return codePage(req, res, { err: 'Your session expired. Please try again.' }, 400);
  const row = db.prepare('SELECT * FROM login_codes WHERE email_key=?').get(l.key);
  const code = String(req.body.code || '').replace(/\D/g, '');
  if (!row || nowS() > row.expires_at || row.attempts >= cfg.maxCodeAttempts) { if (row) db.prepare('DELETE FROM login_codes WHERE email_key=?').run(l.key); return codePage(req, res, { err: 'That code is not valid any more. Please send a new code.' }, 400); }
  db.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE email_key=?').run(l.key);
  if (code.length !== 6 || !safeEq(codeHash('pp:' + l.key, code), row.code_hash)) { const left = cfg.maxCodeAttempts - row.attempts - 1; return codePage(req, res, { err: left > 0 ? `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please send a new code.' }, 400); }
  db.prepare('DELETE FROM login_codes WHERE email_key=?').run(l.key);
  const r = db.prepare('SELECT id FROM registrations WHERE email_key=?').get(l.key);
  if (!r) return codePage(req, res, { err: 'No registration was found for this address.' }, 400);
  req.session = { prs: { id: r.id, t: nowS() }, csrf: crypto.randomBytes(24).toString('hex') };   // the code only unlocks choosing a new password
  res.redirect(cfg.base + '/login/reset');
});
router.post('/login/resend', async (req, res) => {
  const l = req.session.pl; if (!l) return res.redirect(cfg.base + '/login/forgot');
  if (!csrfOk(req)) return codePage(req, res, { err: 'Your session expired. Please try again.' }, 400);
  const lim = mailAllowed(req, l.key); if (lim) return codePage(req, res, { err: lim }, 429);
  try { await sendLoginCode(req, l.key); } catch (ex) { console.error('Reset code resend failed:', ex.message); return codePage(req, res, { err: 'We could not send the email. Please try again shortly.' }, 500); }
  codePage(req, res, { info: 'A new code has been sent.' });
});
const ppReset = (req) => { const x = req.session.prs; return x && nowS() - x.t < 900 ? db.prepare('SELECT * FROM registrations WHERE id=?').get(x.id) : null; };
router.get('/login/reset', (req, res) => (ppReset(req) ? html(res, views.resetPw({ csrf: csrfToken(req) })) : res.redirect(cfg.base + '/login/forgot')));
router.post('/login/reset', async (req, res) => {
  const r = ppReset(req); if (!r) return res.redirect(cfg.base + '/login/forgot');
  const again = (err) => html(res, views.resetPw({ csrf: csrfToken(req), err }), 400);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  const pw = String(req.body.password || ''), err = pw !== String(req.body.password2 || '') ? 'The two passwords do not match.' : speakers.checkPassword(pw, r);
  if (err) return again(err);
  db.prepare('UPDATE registrations SET pw_hash=?, pw_set_at=? WHERE id=?').run(await PW.hash(pw), new Date().toISOString(), r.id);
  speakers.clearFails(['ep:' + r.email_key]);
  ppSignIn(req, res, db.prepare('SELECT * FROM registrations WHERE id=?').get(r.id), r.pw_hash ? 'Your password has been changed.' : 'Your password is set. Next time, sign in with your email and password.');
});
router.post('/logout', (req, res) => { req.session = null; res.redirect(cfg.base + '/login'); });
// ── conference pass: a QR code that opens the check-in page for desk staff ──
const QR = require('qrcode');
const paidOf = (r) => r.pay_status === 'paid' || r.pay_status === 'waived';
function checkinToken(r) {
  if (r.checkin_token) return r.checkin_token;
  const t = crypto.randomBytes(18).toString('base64url');
  db.prepare('UPDATE registrations SET checkin_token=? WHERE id=? AND checkin_token IS NULL').run(t, r.id);
  return db.prepare('SELECT checkin_token FROM registrations WHERE id=?').get(r.id).checkin_token;
}
async function passSvg(r) {
  if (!paidOf(r) || r.cancelled_at) return '';
  try { return await QR.toString(`${views.SITE}/checkin/t/${checkinToken(r)}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#12285C', light: '#FFFFFF' } }); } catch (_) { return ''; }
}
router.get('/account/pass', requireReg, async (req, res) => { const svg = await passSvg(req.reg); if (!svg) return res.redirect(cfg.base + '/account'); html(res, views.passPage({ r: req.reg, svg })); });
// ── cancelling, reinstating, deleting (participant) ──
const notifyTo = () => cfg.notifyEmail || cfg.smtp.replyTo;
router.post('/account/cancel', requireReg, (req, res) => {
  const r = req.reg, b = req.body || {};
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return res.redirect(cfg.base + '/account#cancel'); }
  if (r.cancelled_at) return res.redirect(cfg.base + '/account');
  if (r.attended || r.cert_issued_at) { flash(req, '', 'You have already attended, so the registration cannot be cancelled here. Please email the organisers.'); return res.redirect(cfg.base + '/account#cancel'); }
  const reason = String(b.reason || '').replace(/\s+/g, ' ').trim().slice(0, 120), note = String(b.note || '').replace(/\r/g, '').trim().slice(0, 1000);
  db.prepare('UPDATE registrations SET cancelled_at=?, cancel_reason=?, cancel_note=? WHERE id=?').run(new Date().toISOString(), reason || null, note || null, r.id);
  const paid = paidOf(r);
  mail.send({ to: r.email, ...mail.cancelEmail({ name: r.full_name, ref: r.ref, paid }) }).catch((err) => console.warn('cancel mail:', err.message));
  if (notifyTo()) mail.send({ to: notifyTo(), ...mail.cancelNoticeEmail({ r, reason, note }) }).catch((err) => console.warn('cancel notice:', err.message));
  flash(req, 'Your registration has been cancelled. The organisers have been told, and a confirmation is on its way to your email.');
  res.redirect(cfg.base + '/account');
});
router.post('/account/reinstate', requireReg, (req, res) => {
  const r = req.reg;
  if (!csrfOk(req) || !r.cancelled_at) return res.redirect(cfg.base + '/account');
  if (!regOpenNow()) { flash(req, '', 'Registration is closed, so it cannot be reinstated here. Please email the organisers.'); return res.redirect(cfg.base + '/account'); }
  db.prepare('UPDATE registrations SET cancelled_at=NULL WHERE id=?').run(r.id);
  if (notifyTo()) mail.send({ to: notifyTo(), subject: `Reinstated: ${r.full_name} (${r.ref})`, text: `${r.full_name} (${r.email}) reinstated their ${cfg.eventName} registration ${r.ref}.\n\n${views.SITE}/admin?q=${encodeURIComponent(r.ref)}` }).catch(() => {});
  flash(req, 'Welcome back — your registration is active again.'); res.redirect(cfg.base + '/account');
});
router.post('/account/delete', requireReg, (req, res) => {
  const r = req.reg;
  if (!csrfOk(req) || !r.cancelled_at) return res.redirect(cfg.base + '/account');
  if (paidOf(r) || r.pay_status === 'claimed') { flash(req, '', 'A payment record exists, so the registration cannot be deleted here. Please email the organisers.'); return res.redirect(cfg.base + '/account'); }
  for (const f of [r.ext_file, r.fp_file]) if (f) SUB.removeFile(f);
  db.prepare('DELETE FROM registrations WHERE id=?').run(r.id);
  if (notifyTo()) mail.send({ to: notifyTo(), subject: `Deleted by participant: ${r.ref}`, text: `The participant with reference ${r.ref} deleted their cancelled, unpaid registration and its data.` }).catch(() => {});
  req.session = null; res.redirect(cfg.base + '/?deleted=1');
});
// ── on-site check-in: organisers (admin session) or desk staff with the desk PIN ──
const deskTag = () => (cfg.checkinPin ? hmac('desk:' + cfg.checkinPin).slice(0, 24) : '');
const isAdminReq = (req) => !!(req.session.admin && req.session.av === adminTag() && !adminDefault());
const deskOk = (req) => isAdminReq(req) || (!!deskTag() && req.session.desk === deskTag());
const deskWho = (req) => (isAdminReq(req) ? 'organiser' : 'desk');
const ckHits = new Map();
function requireDesk(req, res, next) { if (deskOk(req)) return next(); req.session.deskNext = req.originalUrl; html(res, views.checkinLogin({ csrf: csrfToken(req), error: cfg.checkinPin ? '' : 'The desk PIN has not been set yet. An organiser can set it in Admin → Settings → Certificates, or sign in to the admin pages.' })); }
router.get('/checkin', requireDesk, (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80); let rows = [];
  if (q) { const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%'; rows = db.prepare("SELECT * FROM registrations WHERE full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR ref LIKE ? ESCAPE '\\' ORDER BY full_name LIMIT 30").all(like, like, like); }
  const stats = db.prepare("SELECT COALESCE(SUM(pay_status IN ('paid','waived') AND cancelled_at IS NULL),0) paid, COALESCE(SUM(attended=1),0) \"in\" FROM registrations").get();
  const fm = req.session.ckmsg || ''; req.session.ckmsg = null;
  html(res, views.checkinDesk({ csrf: csrfToken(req), q, rows, stats, flashMsg: fm }));
});
router.post('/checkin/login', (req, res) => {
  const ip = req.ip || '', now = Date.now(), h = (ckHits.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  if (h.length >= 10) return res.status(429).send(views.checkinLogin({ csrf: csrfToken(req), error: 'Too many attempts. Wait 15 minutes.' }));
  const pin = String((req.body || {}).pin || '');
  if (!csrfOk(req) || !cfg.checkinPin || pin.length !== cfg.checkinPin.length || !safeEq(pin, cfg.checkinPin)) { h.push(now); ckHits.set(ip, h); return html(res, views.checkinLogin({ csrf: csrfToken(req), error: 'That PIN is not correct.' })); }
  const next = req.session.deskNext && String(req.session.deskNext).startsWith(cfg.base + '/checkin') ? req.session.deskNext : cfg.base + '/checkin';
  req.session.desk = deskTag(); req.session.deskNext = null; res.redirect(next);
});
router.post('/checkin/logout', (req, res) => { if (csrfOk(req)) req.session.desk = null; res.redirect(cfg.base + '/checkin'); });
router.get('/checkin/t/:token', requireDesk, (req, res) => {
  const r = db.prepare('SELECT * FROM registrations WHERE checkin_token=?').get(String(req.params.token).slice(0, 60));
  if (!r) return res.status(404).send(views.checkinDesk({ csrf: csrfToken(req), flashMsg: 'This pass was not recognised. Search for the person instead.' }));
  res.redirect(cfg.base + '/checkin/id/' + r.id);
});
router.get('/checkin/id/:id', requireDesk, (req, res) => { const r = regById(req.params.id); if (!r) return res.redirect(cfg.base + '/checkin'); html(res, views.checkinPerson({ csrf: csrfToken(req), r, done: req.query.done !== undefined })); });
router.post('/checkin/id/:id', requireDesk, (req, res) => {
  const r = regById(req.params.id); if (!r || !csrfOk(req)) return res.redirect(cfg.base + '/checkin');
  if (r.cancelled_at) return res.redirect(cfg.base + '/checkin/id/' + r.id);
  if (!paidOf(r) && (req.body || {}).override !== '1') return res.redirect(cfg.base + '/checkin/id/' + r.id);
  if (!r.attended) db.prepare('UPDATE registrations SET attended=1, checkin_at=?, checkin_by=? WHERE id=?').run(new Date().toISOString(), deskWho(req) + (paidOf(r) ? '' : ' (unpaid, override)'), r.id);
  res.redirect(cfg.base + '/checkin/id/' + r.id + '?done');
});
router.post('/checkin/id/:id/undo', requireDesk, (req, res) => {
  const r = regById(req.params.id); if (!r || !csrfOk(req)) return res.redirect(cfg.base + '/checkin');
  if (!r.cert_issued_at) db.prepare('UPDATE registrations SET attended=0, checkin_at=NULL, checkin_by=NULL WHERE id=?').run(r.id);
  req.session.ckmsg = `Check-in undone for ${r.full_name}.`; res.redirect(cfg.base + '/checkin');
});
router.get('/account', requireReg, async (req, res) => { if (req.query.cancelled !== undefined) flash(req, '', 'Payment cancelled — nothing was charged. You can try again whenever you are ready.'); const pform = req.session.pform || null; req.session.pform = null; const prform = req.session.prform || null; req.session.prform = null; html(res, views.account({ pform, prform, r: req.reg, csrf: csrfToken(req), passSvg: await passSvg(req.reg), canReinstate: req.reg.cancelled_at && regOpenNow(), flash: takeFlash(req), payUrl: settings.payUrl(req.reg.category), welcome: req.query.welcome !== undefined, modes: payModes(), stripeAmount: (() => { const p = stripe.parseFee(req.reg.fee); return p ? stripe.money(p.currency, p.amount) : ''; })() })); });
// Stripe: card / FPX / GrabPay through Stripe Checkout; confirmed by the webhook (and by the return page, in case the webhook is slow)
const payModes = () => {
  const st = stripe.configured() && (cfg.payProvider === 'stripe' || cfg.payProvider === 'both');
  const t2u = cfg.payProvider === 'ticket2u' || cfg.payProvider === 'both' || (cfg.payProvider === 'stripe' && !stripe.configured());
  return { stripe: st, t2u };
};
function confirmStripe(s) {
  const id = Number(s.client_reference_id || (s.metadata && s.metadata.reg_id));
  if (!id || s.payment_status !== 'paid') return 0;
  return confirmPayments([id], { source: 'stripe', order: String(s.payment_intent || s.id), amount: stripe.money(s.currency, s.amount_total) });
}
router.get('/account/calendar.ics', requireReg, (req, res) => {
  const d = (iso) => iso.replace(/-/g, ''), plus = (iso) => new Date(Date.parse(iso + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const esc = (t) => String(t).replace(/[\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSSST 2027//Registration//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + req.reg.ref + '@' + (new URL(cfg.siteUrl.startsWith('http') ? cfg.siteUrl : 'https://x').hostname),
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), 'DTSTART;VALUE=DATE:' + d(cfg.eventDate), 'DTEND;VALUE=DATE:' + plus(cfg.eventEndDate || cfg.eventDate),
    'SUMMARY:' + esc(cfg.eventName + ' — ' + cfg.eventFull), 'LOCATION:' + esc([cfg.eventVenue, cfg.venueAddress].filter(Boolean).join(', ')), 'DESCRIPTION:' + esc('Registration reference ' + req.reg.ref + '. ' + cfg.siteUrl), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="icssst-2027.ics"', 'Cache-Control': 'no-store' }).send(ics);
});
router.get('/account/receipt', requireReg, (req, res) => {
  if (req.reg.pay_status !== 'paid' && req.reg.pay_status !== 'waived') return res.redirect(cfg.base + '/account#payment');
  html(res, views.receipt(req.reg));
});
router.post('/account/pay', requireReg, async (req, res) => {
  const r = req.reg;
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return res.redirect(cfg.base + '/account'); }
  if (r.pay_status === 'paid' || r.pay_status === 'waived') return res.redirect(cfg.base + '/account');
  if (!payModes().stripe) { flash(req, '', 'Online card payment is not available right now.'); return res.redirect(cfg.base + '/account'); }
  try {
    const s = await stripe.createCheckout(r, views.SITE);
    db.prepare('UPDATE registrations SET pay_session=? WHERE id=?').run(s.id, r.id);
    return res.redirect(303, s.url);
  } catch (ex) {
    console.error('Stripe checkout failed for ' + r.ref + ':', ex.message);
    flash(req, '', 'We could not open the payment page just now. Please try again in a moment, or contact ' + cfg.smtp.replyTo + '.');
    return res.redirect(cfg.base + '/account');
  }
});
router.get('/account/stripe/return', requireReg, async (req, res) => {
  const sid = String(req.query.session_id || '');
  if (/^cs_[A-Za-z0-9_]+$/.test(sid) && stripe.configured()) {
    try {
      const s = await stripe.getSession(sid);
      if (String(s.client_reference_id) === String(req.reg.id)) {
        if (s.payment_status === 'paid') { confirmStripe(s); flash(req, 'Payment received — thank you! A receipt is on its way to your email.'); }
        else if (s.status === 'complete') flash(req, 'Your payment is being processed by your bank. This page will show Paid as soon as it clears.');
      }
    } catch (ex) { console.error('Stripe return check failed:', ex.message); flash(req, 'Thank you. We are confirming your payment; this page will show Paid shortly.'); }
  }
  res.redirect(cfg.base + '/account');
});
router.post('/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  let ev;
  try { ev = stripe.verifyWebhook(req.body, req.get('stripe-signature')); }
  catch (ex) { console.error('Stripe webhook rejected:', ex.message); return res.status(400).send('Bad signature'); }
  try {
    const o = ev.data && ev.data.object;
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') confirmStripe(o);
    else if (ev.type === 'checkout.session.async_payment_failed') console.warn('Stripe payment failed for', o.client_reference_id);
    else if (ev.type === 'charge.refunded' && o.refunded && o.payment_intent) {
      const n = db.prepare("UPDATE registrations SET pay_status='unpaid', paid_at=NULL, pay_note='refunded via Stripe' WHERE pay_ref=? AND pay_status='paid'").run(String(o.payment_intent)).changes;
      if (n) console.log('Stripe refund recorded for', o.payment_intent);
    }
  } catch (ex) { console.error('Stripe webhook handling failed:', ex.message); return res.status(500).send('Error'); }   // Stripe retries
  res.json({ received: true });
});
router.post('/account/profile', requireReg, (req, res) => {
  const r = req.reg, b = req.body || {};
  if (!csrfOk(req)) { flash(req, '', 'Your session expired; your changes were not saved. Please try again.'); return res.redirect(cfg.base + '/account#profile'); }
  const { v, errors } = parts.validate(b);
  // name (printed on the certificate) is locked once a certificate has been issued
  let name = r.full_name;
  if (!r.cert_issued_at) { name = String(b.full_name || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (name.length < 3) errors.push('Please enter your full name as it should appear on your certificate.'); }
  let org = r.cert_issued_at ? r.organisation : String(b.organisation || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const country = String(b.country || '').trim().slice(0, 60);
  if (!inst.countrySet.has(country)) errors.push('Please choose your country from the list.');
  { const hit = inst.lookup(org, country); if (hit) org = hit.name; else if (org.length < 3) errors.push('Please enter your institution or organisation.'); }
  if (errors.length) { flash(req, '', errors); req.session.pform = b; return res.redirect(cfg.base + '/account#profile'); }
  db.prepare('UPDATE registrations SET full_name=?, organisation=?, country=?, phone=?, salutation=?, designation=?, department=?, participation=?, mass_no=?, diet=?, diet_note=?, dinner=?, billing=?, profile_at=? WHERE id=?')
    .run(name, org, country, v.phone, v.salutation, v.designation, v.department, v.participation, v.mass_no, v.diet, v.diet_note, v.dinner, v.billing, new Date().toISOString(), r.id);
  flash(req, 'Your profile has been saved.');
  res.redirect(cfg.base + '/account#profile');
});
// ── submissions: abstract (typed), extended abstract and full paper (uploaded) ──
const SUB = require('./lib/submit'), AUTH = require('./lib/authors');
let APDF; const apdf = () => (APDF ||= require('./lib/abstract-pdf'));          // loaded on first use (MathJax is large)
const mathCheck = (...t) => { try { return apdf().mathErrors(...t); } catch (err) { console.warn('math check failed:', err.message); return []; } };
const pdfMeta = () => ({ headLeft: `${cfg.eventName} · ${cfg.eventFull}`, headRight: `${cfg.eventDateText}, ${cfg.eventVenue}` });
const absOfReg = (r) => ({ kind: /oral/i.test(r.participation || '') ? 'Oral presentation' : /poster/i.test(r.participation || '') ? 'Poster presentation' : '', ref: r.paper_id || r.ref, title: r.paper_title || 'Untitled', authors: AUTH.read(r, r.full_name), abstract: r.abstract || '', keywords: r.keywords || '' });
const absOfSpeaker = (sp) => ({ kind: sp.role || 'Invited talk', ref: '', title: sp.talk_title || 'Title to be announced', authors: AUTH.read(sp, sp.full_name), abstract: sp.abstract || '', keywords: sp.keywords || '' });
const pdfName = (a, ref) => `${cfg.eventName.replace(/\s+/g, '')}_abstract_${String(ref || '').replace(/[^\w-]+/g, '')}.pdf`;
async function sendPdf(res, list, name, opts = {}) {
  try {
    const buf = await apdf().buffer(list, { ...pdfMeta(), title: list.length === 1 ? list[0].title.replace(/\$/g, '') : opts.title, author: list.length === 1 ? AUTH.line(list[0].authors) : cfg.eventName, ...opts });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${opts.inline === false ? 'attachment' : 'inline'}; filename="${name}"`, 'Cache-Control': 'private, no-store' }).send(buf);
  } catch (err) { console.error('PDF failed:', err); res.status(500).type('text/plain').send('Sorry, the PDF could not be made. Please try again, or tell the organisers.'); }
}
router.post('/account/presentation', requireReg, (req, res) => {
  const r = req.reg, b = req.body || {};
  if (!csrfOk(req)) { flash(req, '', 'Your session expired; your changes were not saved. Please try again.'); return res.redirect(cfg.base + '/account#presentation'); }
  if (!parts.presenting(r)) { flash(req, '', 'Choose “Oral presentation” or “Poster presentation” in your profile first.'); return res.redirect(cfg.base + '/account#profile'); }
  if (SUB.closed(cfg.absDeadline)) { flash(req, '', 'The abstract deadline has passed, so the abstract can no longer be changed. Please email the organisers.'); return res.redirect(cfg.base + '/account#presentation'); }
  const { v, errors } = SUB.validateAbstract(b, { mathCheck });
  if (errors.length) { flash(req, '', errors); req.session.prform = { paper_title: v.paper_title, abstract: v.abstract, keywords: v.keywords, authors: v.authors }; return res.redirect(cfg.base + '/account#presentation'); }
  db.prepare("UPDATE registrations SET paper_title=?, coauthors=?, authors=?, abstract=?, keywords=?, pres_at=?, abs_status=CASE WHEN abs_status='revise' THEN '' ELSE abs_status END WHERE id=?").run(v.paper_title, v.coauthors, v.authors, v.abstract, v.keywords, new Date().toISOString(), r.id);
  const left = SUB.absChecklist({ ...r, ...v }, r.full_name).filter((x) => !x[1]).map((x) => x[0]);
  flash(req, left.length ? `Saved. Still needed before the abstract is complete: ${left.join(', ')}.` : 'Your abstract has been saved.'); res.redirect(cfg.base + '/account#stage-abs');
});
router.get('/account/abstract.pdf', requireReg, (req, res) => { const r = req.reg; if (!r.paper_title) return res.redirect(cfg.base + '/account#presentation'); sendPdf(res, [absOfReg(r)], pdfName(null, r.ref)); });
const rawUpload = (mb) => express.raw({ type: () => true, limit: mb + 'mb' });
const upName = (req) => { try { return decodeURIComponent(String(req.get('X-File-Name') || '')).slice(0, 200); } catch (_) { return ''; } };
const csrfHeader = (req) => { const a = String(req.get('X-CSRF') || ''), b2 = String(req.session.csrf || ''); return a.length === b2.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b2)); };
router.post('/account/upload/:stage', requireReg, rawUpload(26), (req, res) => {
  const r = req.reg, st = SUB.stages().find((x) => x.id === req.params.stage && x.id !== 'abs');
  if (!csrfHeader(req)) return res.status(400).json({ ok: false, error: 'Your session expired. Please reload the page.' });
  if (!st) return res.status(404).json({ ok: false, error: 'This submission is not open.' });
  if (!parts.presenting(r)) return res.status(403).json({ ok: false, error: 'Only oral and poster presenters submit papers.' });
  if (st.closed) return res.status(403).json({ ok: false, error: 'The deadline has passed.' });
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buf.length) return res.status(400).json({ ok: false, error: 'The file is empty.' });
  const out = SUB.saveFile(r.id, st.id, upName(req), buf);
  if (out.error) return res.status(400).json({ ok: false, error: out.error });
  const old = r[st.id + '_file'];
  db.prepare(`UPDATE registrations SET ${st.id}_file=?, ${st.id}_name=?, ${st.id}_at=?, ${st.id}_status=CASE WHEN ${st.id}_status='revise' THEN '' ELSE ${st.id}_status END WHERE id=?`).run(out.file, out.name, new Date().toISOString(), r.id);
  if (old && old !== out.file) SUB.removeFile(old);
  res.json({ ok: true });
});
const sendStored = (res, file, name) => { const p2 = SUB.filePath(file); if (!p2 || !require('fs').existsSync(p2)) return res.status(404).type('text/plain').send('File not found.'); res.set('Cache-Control', 'private, no-store'); res.download(p2, name || path.basename(p2)); };
router.get('/account/file/:stage', requireReg, (req, res) => { const k = req.params.stage; if (!['ext', 'fp'].includes(k)) return res.status(404).end(); sendStored(res, req.reg[k + '_file'], req.reg[k + '_name']); });
router.get('/submissions/template/:stage', (req, res) => {
  const t = SUB.template(req.params.stage); if (!t) return res.status(404).type('text/plain').send('The template is not available yet.');
  res.set('Cache-Control', 'public, max-age=300'); res.download(SUB.templatePath(t), t.name);
});
router.post('/account/password', requireReg, async (req, res) => {
  const r = req.reg, b = req.body || {};
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return res.redirect(cfg.base + '/account#password'); }
  const errs = [];
  if (r.pw_hash && !(await speakers.verifyPassword({ pw_hash: r.pw_hash }, String(b.current || '')))) errs.push('Your current password is not correct.');
  const pw = String(b.password || ''); const pe = pw !== String(b.password2 || '') ? 'The two new passwords do not match.' : speakers.checkPassword(pw, r); if (pe) errs.push(pe);
  if (errs.length) { flash(req, '', errs); return res.redirect(cfg.base + '/account#password'); }
  db.prepare('UPDATE registrations SET pw_hash=?, pw_set_at=? WHERE id=?').run(await PW.hash(pw), new Date().toISOString(), r.id);
  setPP(req, db.prepare('SELECT id,pw_set_at FROM registrations WHERE id=?').get(r.id));
  flash(req, 'Your password has been changed. Other devices have been signed out.'); res.redirect(cfg.base + '/account#password');
});
// certificate: drawn in the browser (same design as the organisers' batch page); the server only says whether it is available
router.post('/account/certificate', requireReg, (req, res) => {
  if (!csrfOk(req)) return res.status(400).json({ ok: false });
  if (!parts.certReady(req.reg, cfg)) return res.status(403).json({ ok: false });
  db.prepare('UPDATE registrations SET cert_issued_at=COALESCE(cert_issued_at, ?) WHERE id=?').run(new Date().toISOString(), req.reg.id);
  res.json({ ok: true });
});
router.get('/account/signature', requireReg, (req, res) => {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(cfg.signatureData || '');
  if (!m || !parts.certReady(req.reg, cfg)) return res.status(404).end();
  res.set({ 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600' }).send(Buffer.from(m[2], 'base64'));
});
router.post('/account/paid', requireReg, (req, res) => {
  const r = req.reg;
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return res.redirect(cfg.base + '/account'); }
  if (r.pay_status === 'paid' || r.pay_status === 'waived') return res.redirect(cfg.base + '/account');
  const order = String(req.body.order || '').replace(/\s+/g, '').toUpperCase().slice(0, 40);
  if (!/^[A-Z0-9#\-_/]{4,40}$/.test(order)) { flash(req, '', 'Please enter the order number from your Ticket2U email (letters and digits).'); return res.redirect(cfg.base + '/account'); }
  db.prepare("UPDATE registrations SET pay_status='claimed', pay_ref=?, pay_claimed_at=? WHERE id=?").run(order, new Date().toISOString(), r.id);
  flash(req, 'Thank you — we will confirm your payment once it appears in Ticket2U’s records.');
  res.redirect(cfg.base + '/account');
});
router.post('/account/category', requireReg, (req, res) => {
  const r = req.reg, cat = String(req.body.category || '');
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return res.redirect(cfg.base + '/account'); }
  const f = settings.availableFees().find((x) => x.name === cat);
  if (r.pay_status !== 'unpaid') flash(req, '', 'The category can no longer be changed after paying. Please email ' + cfg.smtp.replyTo + '.');
  else if (!f) flash(req, '', 'Please choose a category from the list.');
  else { db.prepare('UPDATE registrations SET category=?, fee=? WHERE id=?').run(f.name, f.fee, r.id); flash(req, `Category changed to ${f.name} (${f.fee}).`); }
  res.redirect(cfg.base + '/account');
});

// ── speakers: public pages ────────────────────────────────
router.get('/speakers', (req, res) => html(res, spv.index(speakers.published())));
router.get('/speakers/photo/:file', (req, res) => {
  const m = /^(\d+)\.jpg$/.exec(req.params.file); const s = m && speakers.byId(Number(m[1]));
  if (!s || !s.photo_ver || !(s.published || req.session.admin || req.session.spk === s.id)) return res.status(404).end();
  res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300').sendFile(speakers.photoFile(s.id), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
router.get('/speakers/:slug', (req, res, next) => {
  const s = speakers.bySlug(req.params.slug);
  if (!s || !(s.published || req.session.admin || req.session.spk === s.id)) return next();
  const list = speakers.published(), i = list.findIndex((x) => x.id === s.id);
  html(res, spv.detail(s, i > 0 ? list[i - 1] : null, i >= 0 && i < list.length - 1 ? list[i + 1] : null, regOpenNow()));
});

// ── speakers: portal — invitation (accept/decline) → password; the emailed code is only for a forgotten password ──
const currentSpeaker = (req) => { const s = req.session.spk ? speakers.byId(req.session.spk) : null; return s && (req.session.sv || '') === (s.pw_set_at || '') ? s : null; };
const requireSpeaker = (req, res, next) => { const s = currentSpeaker(req); if (!s) { req.session.spk = null; return res.redirect(cfg.base + '/speaker/login'); } req.spk = s; next(); };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const spkSignIn = (req, res, s, welcome) => {
  db.prepare('UPDATE speakers SET last_login=? WHERE id=?').run(new Date().toISOString(), s.id);
  req.session = { spk: s.id, sv: s.pw_set_at || '', csrf: crypto.randomBytes(24).toString('hex') };       // fresh session on sign-in
  if (welcome) flash(req, welcome);
  res.redirect(cfg.base + '/speaker');
};
router.get('/speaker/login', (req, res) => (currentSpeaker(req) ? res.redirect(cfg.base + '/speaker') : html(res, spv.login({ csrf: csrfToken(req), email: String(req.query.email || '').slice(0, 160) }))));
router.post('/speaker/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160), password = String(req.body.password || '');
  const again = (err, status = 400) => html(res, spv.login({ csrf: csrfToken(req), email, err }), status);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  if (!EMAIL_RE.test(email) || !password) return again('Please enter your email address and password.');
  const key = normaliseEmail(email), keys = ['e:' + key, 'i:' + ipHash(req)];
  const wait = speakers.locked(keys);
  if (wait) return again(`Too many unsuccessful attempts. Please wait ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''} or reset your password.`, 429);
  const s = speakers.byEmailKey(key);
  if (!(await speakers.verifyPassword(s, password))) {
    speakers.fail(keys);
    return again('That email and password do not match. If you have not chosen a password yet, use the Accept invitation button in your invitation email, or reset your password.', 401);
  }
  speakers.clearFails(['e:' + key]);
  if (PW.legacy(s.pw_hash)) PW.hash(password).then((h) => db.prepare('UPDATE speakers SET pw_hash=? WHERE id=? AND pw_hash=?').run(h, s.id, s.pw_hash)).catch(() => {});   // upgrade old bcrypt hash
  spkSignIn(req, res, s);
});
router.get('/speaker/forgot', (req, res) => html(res, spv.forgot({ csrf: csrfToken(req), email: String(req.query.email || '').slice(0, 160) })));
router.post('/speaker/forgot', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
  const again = (err, status = 400) => html(res, spv.forgot({ csrf: csrfToken(req), email, err }), status);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  if (!EMAIL_RE.test(email)) return again('Please enter a valid email address.');
  const key = normaliseEmail(email);
  const lim = mailAllowed(req, key); if (lim) return again(lim, 429);
  const s = speakers.byEmailKey(key), t = nowS();
  db.prepare('INSERT INTO mail_log (ip_hash,email_key,ts) VALUES (?,?,?)').run(ipHash(req), key, t);
  if (s && speakers.state(s) !== 'declined') {      // unknown addresses get the same response (no account discovery)
    const code = genCode();
    db.prepare('INSERT INTO speaker_codes (email_key,code_hash,expires_at,attempts,sends,last_sent) VALUES (?,?,?,0,1,?) ON CONFLICT(email_key) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, sends=sends+1, last_sent=excluded.last_sent')
      .run(key, codeHash('spk:' + key, code), t + cfg.codeMinutes * 60, t);
    try { const m = mail.speakerCodeEmail({ name: s.full_name, code }); mail.send({ to: s.email, subject: m.subject, text: m.text, html: m.html }).catch((ex) => console.error('Speaker reset email failed:', ex.message)); }   // not awaited: same response time for every address
    catch (ex) { console.error('Speaker reset email failed:', ex.message); }
  }
  req.session.spl = { key, masked: maskEmail(email), t };
  res.redirect(cfg.base + '/speaker/verify');
});
router.get('/speaker/verify', (req, res) => {
  const l = req.session.spl; if (!l) return res.redirect(cfg.base + '/speaker/forgot');
  html(res, spv.code({ csrf: csrfToken(req), masked: l.masked }));
});
router.post('/speaker/verify', (req, res) => {
  const l = req.session.spl; if (!l) return res.redirect(cfg.base + '/speaker/forgot');
  const again = (err) => html(res, spv.code({ csrf: csrfToken(req), masked: l.masked, err }), 400);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  const row = db.prepare('SELECT * FROM speaker_codes WHERE email_key=?').get(l.key);
  const code = String(req.body.code || '').replace(/\D/g, '');
  if (row) db.prepare('UPDATE speaker_codes SET attempts=attempts+1 WHERE email_key=?').run(l.key);
  if (!row || nowS() > row.expires_at || row.attempts >= cfg.maxCodeAttempts) { if (row && row.attempts >= cfg.maxCodeAttempts) db.prepare('DELETE FROM speaker_codes WHERE email_key=?').run(l.key); return again(row && row.attempts < cfg.maxCodeAttempts ? 'That code has expired. Please request a new one.' : 'That code is not correct. Please request a new one.'); }
  if (code.length !== 6 || !safeEq(codeHash('spk:' + l.key, code), row.code_hash)) { const left = cfg.maxCodeAttempts - row.attempts - 1; return again(left > 0 ? `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.'); }
  const s = speakers.byEmailKey(l.key); db.prepare('DELETE FROM speaker_codes WHERE email_key=?').run(l.key);
  if (!s) return again('This speaker account no longer exists. Please contact the organisers.');
  req.session = { sprs: { id: s.id, t: nowS() }, csrf: crypto.randomBytes(24).toString('hex') };     // the code proves the mailbox; it only unlocks choosing a new password
  res.redirect(cfg.base + '/speaker/reset');
});
const resetOf = (req) => { const r = req.session.sprs; return r && nowS() - r.t < 900 ? speakers.byId(r.id) : null; };
router.get('/speaker/reset', (req, res) => (resetOf(req) ? html(res, spv.reset({ csrf: csrfToken(req) })) : res.redirect(cfg.base + '/speaker/forgot')));
router.post('/speaker/reset', async (req, res) => {
  const s = resetOf(req); if (!s) return res.redirect(cfg.base + '/speaker/forgot');
  const again = (err) => html(res, spv.reset({ csrf: csrfToken(req), err }), 400);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  const pw = String(req.body.password || ''), err = pw !== String(req.body.confirm || '') ? 'The two passwords do not match.' : speakers.checkPassword(pw, s);
  if (err) return again(err);
  await speakers.setPassword(s.id, pw); speakers.clearFails(['e:' + normaliseEmail(s.email || '')]);
  spkSignIn(req, res, speakers.byId(s.id), 'Your password has been changed.');
});
// invitation links (from the email): Accept → choose a password; Decline → confirm
const inviteOf = (req, res) => {
  const s = speakers.byInvite(req.params.token);
  if (!s) { html(res, spv.notice({ h: 'This link is<br><em>no longer valid.</em>', p: 'The invitation link was already used, has expired (links last ' + speakers.INVITE_DAYS + ' days) or was replaced by a newer one. If you have already accepted, just sign in; otherwise ask the organisers to send a new invitation.', link: cfg.base + '/speaker/login', label: 'Go to sign-in' }), 410); return null; }
  return s;
};
router.get('/speaker/invite/:token', (req, res) => {
  const s = inviteOf(req, res); if (!s) return;
  html(res, req.query.a === 'decline' ? spv.declineConfirm({ csrf: csrfToken(req), s, token: req.params.token }) : spv.accept({ csrf: csrfToken(req), s, token: req.params.token }));
});
router.post('/speaker/invite/:token/accept', async (req, res) => {
  const s = inviteOf(req, res); if (!s) return;
  const again = (err) => html(res, spv.accept({ csrf: csrfToken(req), s, token: req.params.token, err }), 400);
  if (!csrfOk(req)) return again('Your session expired. Please try again.');
  const pw = String(req.body.password || ''), err = pw !== String(req.body.confirm || '') ? 'The two passwords do not match.' : speakers.checkPassword(pw, s);
  if (err) return again(err);
  await speakers.setPassword(s.id, pw);
  spkSignIn(req, res, speakers.byId(s.id), 'Thank you for accepting. Please add your talk title, abstract, biography and photo below.');
});
router.post('/speaker/invite/:token/decline', (req, res) => {
  const s = inviteOf(req, res); if (!s) return;
  if (!csrfOk(req)) return html(res, spv.declineConfirm({ csrf: csrfToken(req), s, token: req.params.token, err: 'Your session expired. Please try again.' }), 400);
  speakers.decline(s.id);
  mail.send({ to: cfg.smtp.replyTo, subject: `Speaker declined: ${s.full_name}`, text: `${s.full_name} <${s.email}> declined the invitation to speak at ${cfg.eventName}.` }).catch((ex) => console.error('Decline notice failed:', ex.message));
  html(res, spv.notice({ h: 'Invitation<br><em>declined.</em>', p: 'Thank you for letting us know. The organisers have been told. If this was a mistake, please contact ' + cfg.smtp.replyTo + ' and we will send a new invitation.' }));
});
router.post('/speaker/logout', (req, res) => { req.session = null; res.redirect(cfg.base + '/speaker/login'); });
router.get('/speaker', requireSpeaker, (req, res) => html(res, spv.portal({ s: req.spk, csrf: csrfToken(req), flash: takeFlash(req) })));
router.get('/speaker/calendar.ics', requireSpeaker, (req, res) => {
  const s = req.spk;
  if (!speakers.hasSlot(s)) return res.redirect(cfg.base + '/speaker');
  const at = (t) => new Date(Date.parse(`${s.slot_date}T${t}:00+08:00`)).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const end = s.slot_end ? at(s.slot_end) : new Date(Date.parse(`${s.slot_date}T${s.slot_start}:00+08:00`) + 45 * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (x) => String(x).replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="icssst-2027-my-talk.ics"' }).send(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSSST 2027//Speaker//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:speaker-${s.id}@${new URL(views.SITE).hostname}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`, `DTSTART:${at(s.slot_start)}`, `DTEND:${end}`, `SUMMARY:${esc((s.talk_title ? s.talk_title + ' — ' : '') + cfg.eventName + ' (' + s.role + ')')}`, `LOCATION:${esc([cfg.eventVenue, cfg.venueAddress].filter(Boolean).join(', '))}`, `DESCRIPTION:${esc(s.full_name + '. ' + views.SITE)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n');
});
router.post('/speaker', requireSpeaker, (req, res) => {
  if (!csrfOk(req)) { flash(req, '', 'Your session expired; your changes were not saved. Please try again.'); return res.redirect(cfg.base + '/speaker'); }
  const { v, errors } = speakers.validate({ ...(req.body || {}), mathCheck });
  if (String(req.body.ver || '') !== speakers.verOf(req.spk)) errors.push(`Your page was changed${req.spk.updated_by === 'organiser' ? ' by the organisers' : ''} at ${String(req.spk.updated_at || '').slice(11, 16)} UTC, after you opened this form. Check what you wrote below, then press Save again to keep your version, or reload the page to see theirs.`);
  if (errors.length) return html(res, spv.portal({ s: { ...req.spk, ...v }, csrf: csrfToken(req), flash: { ok: '', err: errors }, ver: speakers.verOf(req.spk) }), 400);
  speakers.save(req.spk.id, v, 'speaker');
  flash(req, 'Saved. Your page on the website is up to date.');
  res.redirect(cfg.base + '/speaker');
});
const photoRoute = (getId) => [express.json({ limit: '4mb' }), (req, res) => {
  const id = getId(req); if (!id) return res.status(403).json({ ok: false, error: 'Please sign in again.' });
  if (!csrfOk(req)) return res.status(400).json({ ok: false, error: 'Your session expired. Reload the page.' });
  if (req.body && req.body.remove) { speakers.removePhoto(id); return res.json({ ok: true, url: '', pct: speakers.completeness(speakers.byId(id)) }); }
  const err = speakers.savePhoto(id, req.body && req.body.dataUrl);
  res.json(err ? { ok: false, error: err } : { ok: true, url: speakers.photoUrl(speakers.byId(id)), pct: speakers.completeness(speakers.byId(id)) });
}];
router.get('/speaker/abstract.pdf', (req, res) => { const sp = currentSpeaker(req); if (!sp) return res.redirect(cfg.base + '/speaker/login'); sendPdf(res, [absOfSpeaker(sp)], pdfName(null, sp.slug)); });
router.post('/speaker/photo', ...photoRoute((req) => (currentSpeaker(req) ? req.session.spk : 0)));

// ── speakers: admin ───────────────────────────────────────
const admBar = (req, label) => adminViews.baseHead(`${label} — ${cfg.eventName}`, spv.ADM_CSS) + adminViews.topbar(label, `<a href="${cfg.base}/admin">Participants</a><a href="${cfg.base}/admin/speakers">Speakers</a><a href="${cfg.base}/admin/settings">Settings</a>`).replace('__CSRF__', csrfToken(req));
router.get('/admin/speakers', requireAdmin, (req, res) => html(res, spv.adminList({ rows: speakers.all(), csrf: csrfToken(req), flash: takeFlash(req), topbar: admBar(req, 'Speakers') }) + '</body></html>'));
router.post('/admin/speakers/new', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const b = req.body || {};
  if (b.confirmed !== '1') { flash(req, '', 'The speaker was not added because the details were not confirmed. Please try again and tick the confirmation.'); return res.redirect(cfg.base + '/admin/speakers'); }
  const { v, errors } = speakers.validate({ ...b }, { admin: true });
  if (!v.email) errors.push('An email address is required, because the invitation is sent there.');
  else if (String(b.email2 || '').trim().toLowerCase() !== v.email) errors.push('The two email addresses were not the same.');
  if (speakers.all().some((x) => x.full_name.trim().toLowerCase() === v.full_name.trim().toLowerCase()) && b.dup_ok !== '1') errors.push(`A speaker called “${v.full_name}” already exists. Open their profile instead of adding them again.`);
  if (errors.length) { flash(req, '', errors); return res.redirect(cfg.base + '/admin/speakers'); }
  if (v.email_key && speakers.byEmailKey(v.email_key)) { flash(req, '', 'Another speaker already uses that email address.'); return res.redirect(cfg.base + '/admin/speakers'); }
  const id = speakers.create(v);
  flash(req, `${v.full_name} was added. Fill in what you know, or send the invitation so they can do it themselves.`);
  res.redirect(cfg.base + '/admin/speakers/' + id);
});
const admSpeaker = (req, res, next) => { const s = speakers.byId(parseInt(req.params.id, 10)); if (!s) return res.redirect(cfg.base + '/admin/speakers'); req.spk = s; next(); };
router.get('/admin/speakers/:id', requireAdmin, admSpeaker, (req, res) => html(res, spv.adminEdit({ s: req.spk, csrf: csrfToken(req), flash: takeFlash(req), topbar: admBar(req, 'Speakers') })));
router.post('/admin/speakers/:id', requireAdmin, admSpeaker, async (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const { v, errors } = speakers.validate({ ...(req.body || {}), mathCheck }, { admin: true });
  const stale = String(req.body.ver || '') !== speakers.verOf(req.spk);
  if (stale) errors.push(`This profile was changed${req.spk.updated_by === 'speaker' ? ' by the speaker' : ''} at ${String(req.spk.updated_at || '').slice(11, 16)} UTC, after you opened it. Check your edits below, then press Save again to overwrite, or reload to see their version.`);
  const other = v.email_key && speakers.byEmailKey(v.email_key);
  if (other && other.id !== req.spk.id) errors.push('Another speaker already uses that email address.');
  if (errors.length) return html(res, spv.adminEdit({ s: { ...req.spk, ...v }, csrf: csrfToken(req), flash: { ok: '', err: errors }, topbar: admBar(req, 'Speakers'), ver: speakers.verOf(req.spk) }), 400);
  const changed = speakers.slotKey(v) !== speakers.slotKey(req.spk) || (v.slot_venue || null) !== (req.spk.slot_venue || null);
  if (changed && req.body.sched_ok !== '1') return html(res, spv.adminEdit({ s: { ...req.spk, ...v }, csrf: csrfToken(req), flash: { ok: '', err: ['Please confirm the new talk date and time before saving.'] }, topbar: admBar(req, 'Speakers'), ver: speakers.verOf(req.spk) }), 400);
  speakers.save(req.spk.id, v, 'organiser');
  let note = '';
  if (changed && req.body.notify === '1' && speakers.hasSlot(v)) {
    const cur = speakers.byId(req.spk.id);
    if (!cur.email) note = ' No email was sent because this speaker has no email address.';
    else {                                                     // sent in the background: a slow mail server must never hold up saving
      const m = mail.speakerScheduleEmail({ name: cur.full_name, talkTitle: cur.talk_title, dateLabel: cfg.eventDayLabel(cur.slot_date), timeText: speakers.timeText(cur), venue: cfg.eventVenue, room: SCH.venueName(cur.slot_venue), changed: !!req.spk.slot_date, portalLink: speakers.state(cur) === 'active' ? `${views.SITE}/speaker` : '' });
      mail.send({ to: cur.email, subject: m.subject, text: m.text, html: m.html })
        .then(() => speakers.markSlotSent(cur.id, cur))
        .catch((ex) => { console.error('Schedule email failed:', ex.message); speakers.markSlotFail(cur.id, ex.message); });
      note = ` The schedule is being emailed to ${cur.email}; this page will show when it has been delivered.`;
    }
  }
  flash(req, 'Saved. The website is up to date.' + note);
  res.redirect(cfg.base + '/admin/speakers/' + req.spk.id);
});
router.post('/admin/speakers/:id/photo', requireAdmin, admSpeaker, ...photoRoute((req) => req.spk.id));
router.post('/admin/speakers/:id/invite', requireAdmin, admSpeaker, async (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const s = req.spk;
  if (!s.email) { flash(req, '', 'Add a sign-in email for this speaker first.'); return res.redirect(cfg.base + '/admin/speakers'); }
  try {
    if (speakers.state(s) === 'active') { flash(req, '', 'This speaker has already accepted and has a password.'); return res.redirect(cfg.base + '/admin/speakers'); }
    const token = speakers.issueInvite(s.id), link = `${views.SITE}/speaker/invite/${token}`;
    const m = mail.speakerInviteEmail({ name: s.full_name, role: s.role, acceptLink: link, declineLink: link + '?a=decline', days: speakers.INVITE_DAYS });
    const sending = mail.send({ to: s.email, subject: m.subject, text: m.text, html: m.html });
    const r = await Promise.race([sending.then(() => 'ok'), new Promise((ok) => setTimeout(() => ok('slow'), 15000))]);
    if (r === 'slow') { sending.catch((ex) => console.error('Invitation email failed:', ex.message)); flash(req, `The mail server is slow. The invitation to ${s.email} is still being sent in the background; if it does not arrive, run the email test under Settings.`); }
    else flash(req, `Invitation sent to ${s.email}.`);
  } catch (ex) { flash(req, '', 'The invitation could not be sent: ' + ex.message); }
  res.redirect(cfg.base + '/admin/speakers');
});
router.post('/admin/speakers/:id/delete', requireAdmin, admSpeaker, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  speakers.remove(req.spk.id); flash(req, `${req.spk.full_name} was deleted.`);
  res.redirect(cfg.base + '/admin/speakers');
});

router.get('/privacy', (req, res) => html(res, views.legal('privacy')));
router.get('/terms', (req, res) => html(res, views.legal('terms')));

const vHits = new Map();                                              // ip -> [window start, count]; certificate look-ups are limited so references cannot be scanned for names
setInterval(() => { const t = Date.now(); for (const [k, v] of vHits) if (t - v[0] > 600000) vHits.delete(k); }, 60000).unref();
router.get('/verify', (req, res) => {
  { const k = ipHash(req), t = Date.now(), v = vHits.get(k);
    if (!v || t - v[0] > 600000) vHits.set(k, [t, 1]); else if (++v[1] > 40) return html(res, views.verify('', null, true), 429); }
  const ref = String(req.query.c || '').toUpperCase().trim();
  const row = /^IC27-[A-Z0-9]{5}$/.test(ref) ? db.prepare('SELECT full_name, organisation, cert_issued_at FROM registrations WHERE ref=?').get(ref) : null;
  html(res, views.verify(ref, row));
});

// ── admin ─────────────────────────────────────────────────
router.get('/admin/login', (req, res) => (req.session.admin && req.session.av === adminTag() && !adminDefault() ? res.redirect(cfg.base + '/admin') : html(res, adminViews.login({ csrf: csrfToken(req) }))));
router.post('/admin/login', (req, res) => {
  const h = ipHash(req);
  db.prepare('DELETE FROM login_attempts WHERE ts < ?').run(Math.floor(Date.now() / 1000) - 900);
  const fails = db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE ip_hash=?').get(h).c;
  let err = '';
  if (adminDefault()) err = 'Organiser sign-in is switched off until a private admin password is set (ADMIN_HASH on the server). See the README.';
  else if (fails >= 6) err = 'Too many attempts. Please wait 15 minutes.';
  else if (!csrfOk(req)) err = 'Session expired. Please try again.';
  else {
    const okU = safeEq(hmac(String(req.body.user || '')), hmac(cfg.adminUser));
    const okP = bcrypt.compareSync(String(req.body.pass || ''), cfg.adminHash);
    if (okU && okP) {
      db.prepare('DELETE FROM login_attempts WHERE ip_hash=?').run(h);
      req.session = { admin: true, av: adminTag(), csrf: crypto.randomBytes(24).toString('hex') };       // fresh session on login
      return res.redirect(cfg.base + '/admin');
    }
    db.prepare('INSERT INTO login_attempts (ip_hash, ts) VALUES (?,?)').run(h, Math.floor(Date.now() / 1000));
    err = 'Incorrect username or password.';
  }
  html(res, adminViews.login({ err, csrf: csrfToken(req) }), 401);
});
router.post('/admin/logout', (req, res) => { req.session = null; res.redirect(cfg.base + '/admin/login'); });

// ── participants: server-side search, filters, sorting and pagination (built for 100k+ rows) ──
const STATUSES = ['all', 'active', 'cancelled', 'attended', 'absent', 'issued', 'pending'];       // pending = attended but no certificate yet
const SORTS = { newest: 'id DESC', oldest: 'id ASC', name: 'full_name COLLATE NOCASE ASC, id ASC', org: 'organisation COLLATE NOCASE ASC, id ASC' };
const PERS = [25, 50, 100, 200];
const PAYS = ['all', 'unpaid', 'claimed', 'paid', 'waived'];
// mark registrations as paid and (optionally) email each participant, in the background
function confirmPayments(ids, { source = 'manual', order = null, amount = null } = {}) {
  const now = new Date().toISOString(); let n = 0;
  for (const id of ids) {
    const r = db.prepare('SELECT * FROM registrations WHERE id=?').get(id);
    if (!r || r.pay_status === 'paid') continue;
    db.prepare("UPDATE registrations SET pay_status='paid', paid_at=?, pay_source=?, pay_ref=COALESCE(?, pay_ref), pay_amount=COALESCE(?, pay_amount, fee) WHERE id=?").run(now, source, order, amount, id);
    n++;
    if (cfg.payEmail) {
      const u = db.prepare('SELECT * FROM registrations WHERE id=?').get(id), m = mail.paymentEmail({ name: u.full_name, ref: u.ref, category: u.category, amount: u.pay_amount, order: u.pay_ref });
      mail.send({ to: u.email, subject: m.subject, text: m.text, html: m.html }).catch((ex) => console.error('Payment email failed for ' + u.ref + ':', ex.message));
    }
  }
  return n;
}
function adminFilter(q) {
  const w = [], p = [];
  const s = String(q.q || '').trim().slice(0, 100);
  if (s) {
    const like = '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
    w.push("(full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR organisation LIKE ? ESCAPE '\\' OR ref LIKE ? ESCAPE '\\')");
    p.push(like, like, like, like);
  }
  const status = STATUSES.includes(q.status) ? q.status : 'all';
  if (status === 'active') w.push('cancelled_at IS NULL');
  else if (status === 'cancelled') w.push('cancelled_at IS NOT NULL');
  else if (status === 'attended') w.push('attended=1');
  else if (status === 'absent') w.push('attended=0');
  else if (status === 'issued') w.push('cert_issued_at IS NOT NULL');
  else if (status === 'pending') w.push('attended=1 AND cert_issued_at IS NULL');
  const cat = CATS.includes(q.cat) ? q.cat : '';
  if (cat) { w.push('category=?'); p.push(cat); }
  const pay = PAYS.includes(q.pay) ? q.pay : 'all';
  if (pay !== 'all') { w.push('pay_status=?'); p.push(pay); }
  const sort = SORTS[q.sort] ? q.sort : 'newest';
  const per = PERS.includes(Number(q.per)) ? Number(q.per) : 50;
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', p, f: { q: s, status, cat, pay, sort, per } };
}
const parseIds = (v, max = 500) => String(v || '').split(',').map((x) => parseInt(x, 10)).filter(Number.isInteger).slice(0, max);
const filterQS = (f, extra = {}) => new URLSearchParams(Object.entries({ q: f.q, status: f.status === 'all' ? '' : f.status, cat: f.cat, pay: f.pay === 'all' ? '' : f.pay, sort: f.sort === 'newest' ? '' : f.sort, per: f.per === 50 ? '' : f.per, ...extra }).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)])).toString();

router.get('/admin', requireAdmin, (req, res) => {
  const { where, p, f } = adminFilter(req.query);
  const stats = db.prepare("SELECT COALESCE(SUM(cancelled_at IS NULL),0) total, COALESCE(SUM(cancelled_at IS NOT NULL),0) cancelled, COALESCE(SUM(attended),0) att, COALESCE(SUM(cert_issued_at IS NOT NULL),0) iss, COALESCE(SUM(pay_status='paid' AND cancelled_at IS NULL),0) paid, COALESCE(SUM(pay_status='claimed' AND cancelled_at IS NULL),0) claimed, COALESCE(SUM(pay_status='unpaid' AND cancelled_at IS NULL),0) unpaid FROM registrations").get();
  const total = where ? db.prepare(`SELECT COUNT(*) c FROM registrations ${where}`).get(...p).c : stats.total;
  const pages = Math.max(1, Math.ceil(total / f.per));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const rows = db.prepare(`SELECT id,ref,full_name,email,phone,organisation,category,country,created_at,attended,cert_issued_at,method,fee,pay_status,pay_ref,pay_amount,paid_at,pay_claimed_at,salutation,designation,department,participation,cancelled_at,cancel_reason,cancel_note,checkin_at,checkin_by,abs_mailed_at,ext_mailed_at,fp_mailed_at,paper_title,abstract IS NOT NULL AND abstract<>'' abstract,coauthors,authors,keywords,ext_file,ext_name,ext_at,fp_file,fp_name,fp_at,abs_status,ext_status,fp_status,review_note,pres_at,mass_no,diet,diet_note,dinner,billing,pay_source,pay_note,last_login,profile_at,pw_hash IS NOT NULL has_pw,authors,keywords,abs_status,ext_name,ext_file,ext_status,fp_name,fp_file,fp_status FROM registrations ${where} ORDER BY ${SORTS[f.sort]} LIMIT ? OFFSET ?`).all(...p, f.per, (page - 1) * f.per);
  html(res, adminViews.dashboard({ rows, stats, total, page, pages, f, cats: CATS, statuses: STATUSES, pays: PAYS, pers: PERS, qs: filterQS(f), csrf: csrfToken(req), flash: takeFlash(req) }));
});

// ── submissions (organisers) ──
router.post('/admin/templates/:stage', requireAdmin, rawUpload(26), (req, res) => {
  if (!csrfHeader(req)) return res.status(400).json({ ok: false, error: 'Your session expired. Reload the page.' });
  const out = SUB.saveTemplate(req.params.stage, upName(req), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
  if (out.error) return res.status(400).json({ ok: false, error: out.error });
  res.json({ ok: true });
});
router.post('/admin/templates/:stage/delete', requireAdmin, (req, res) => { if (csrfOk(req)) { SUB.removeTemplate(req.params.stage); flash(req, 'The template was removed.'); } res.redirect(cfg.base + '/admin/settings#subs'); });
const regById = (id) => db.prepare('SELECT * FROM registrations WHERE id=?').get(parseInt(id, 10) || 0);
router.get('/admin/participant/:id/abstract.pdf', requireAdmin, (req, res) => { const r = regById(req.params.id); if (!r || !r.paper_title) return res.status(404).type('text/plain').send('No abstract yet.'); sendPdf(res, [absOfReg(r)], pdfName(null, r.ref)); });
router.get('/admin/participant/:id/file/:stage', requireAdmin, (req, res) => { const r = regById(req.params.id), k = req.params.stage; if (!r || !['ext', 'fp'].includes(k)) return res.status(404).end(); sendStored(res, r[k + '_file'], `${r.ref}_${k === 'ext' ? 'extended-abstract' : 'full-paper'}_${r[k + '_name'] || ''}`); });
router.post('/admin/review', requireAdmin, (req, res) => {
  const b = req.body || {}, r = regById(b.id), k = String(b.stage || '');
  if (!csrfOk(req) || !r) return res.status(400).json({ ok: false });
  const t = new Date().toISOString();
  if (['abs', 'ext', 'fp'].includes(k)) {
    const status = ['', 'accepted', 'revise', 'rejected'].includes(b.status) ? b.status : '';
    db.prepare(`UPDATE registrations SET ${k}_status=?, review_at=? WHERE id=?`).run(status, t, r.id);
  }
  const note = b.note !== undefined ? String(b.note || '').replace(/\r/g, '').trim().slice(0, 1500) : (r.review_note || '');
  if (b.note !== undefined) db.prepare('UPDATE registrations SET review_note=?, review_at=? WHERE id=?').run(note, t, r.id);
  // optional: tell the author, with a link to sign in to their dashboard
  if (b.notify === '1' && ['abs', 'ext', 'fp'].includes(k) && ['accepted', 'revise', 'rejected'].includes(b.status)) {
    if (!mail.configured()) return res.json({ ok: true, mailed: false, error: 'Saved, but email is not set up (Settings → Emails), so the author was not emailed.' });
    mail.send({ to: r.email, ...mail.reviewEmail({ name: r.full_name, email: r.email, ref: r.ref, stage: k, status: b.status, title: r.paper_title, note }) })
      .then(() => db.prepare(`UPDATE registrations SET ${k}_mailed_at=? WHERE id=?`).run(new Date().toISOString(), r.id))
      .catch((err) => console.warn('review mail:', err.message));
    return res.json({ ok: true, mailed: true });
  }
  res.json({ ok: true });
});
// abstract book: every presenter with a title (and invited speakers with a talk), as one PDF or as LaTeX source
function bookList(q) {
  const which = String(q.which || 'all'), st = String(q.status || '');
  const regs = which === 'speakers' ? [] : db.prepare(`SELECT * FROM registrations WHERE cancelled_at IS NULL AND paper_title IS NOT NULL AND paper_title<>'' AND abstract IS NOT NULL AND abstract<>''
      ${which === 'oral' ? "AND participation LIKE 'Oral%'" : which === 'poster' ? "AND participation LIKE 'Poster%'" : "AND participation LIKE '%presentation%'"} ${st === 'accepted' ? "AND abs_status='accepted'" : st === 'notrejected' ? "AND COALESCE(abs_status,'')<>'rejected'" : ''}
      ORDER BY participation, paper_title COLLATE NOCASE LIMIT 5000`).all();
  const sp = which === 'all' || which === 'speakers' ? speakers.published().filter((x) => x.talk_title && x.abstract) : [];
  return [...sp.map(absOfSpeaker), ...regs.map(absOfReg)];
}
router.get('/admin/abstracts.pdf', requireAdmin, (req, res) => {
  const list = bookList(req.query); if (!list.length) return res.status(404).type('text/plain').send('No abstracts match.');
  sendPdf(res, list, `${cfg.eventName.replace(/\s+/g, '')}_book-of-abstracts.pdf`, { title: 'Book of Abstracts', inline: false, cover: { title: 'Book of Abstracts', sub: `${cfg.eventFull}\n${cfg.eventSub}`, foot: `${cfg.eventDateText} · ${cfg.eventVenue}\n${list.length} abstracts` } });
});
router.get('/admin/abstracts.tex', requireAdmin, (req, res) => {
  const list = bookList(req.query);
  res.set({ 'Content-Type': 'application/x-tex; charset=utf-8', 'Content-Disposition': `attachment; filename="${cfg.eventName.replace(/\s+/g, '')}_book-of-abstracts.tex"` })
    .send(apdf().tex(list, { title: 'Book of Abstracts', headLeft: cfg.eventName, cover: { title: 'Book of Abstracts', sub: cfg.eventFull, foot: `${cfg.eventDateText} · ${cfg.eventVenue}` } }));
});
router.get('/admin/speakers/:id/abstract.pdf', requireAdmin, (req, res) => { const sp = speakers.byId(parseInt(req.params.id, 10)); if (!sp) return res.status(404).end(); sendPdf(res, [absOfSpeaker(sp)], pdfName(null, sp.slug)); });
router.get('/admin/participant/:id/abstract', requireAdmin, (req, res) => {    // loaded when a participant card is opened (keeps the list light)
  const r = db.prepare('SELECT abstract FROM registrations WHERE id=?').get(parseInt(req.params.id, 10) || 0);
  if (!r) return res.status(404).end();
  res.set('Cache-Control', 'no-store').type('text/plain').send(r.abstract || '');
});
router.post('/admin/action', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const act = String(req.body.action || '');
  const back = req.body.back === 'payments' ? cfg.base + '/admin/payments' : (() => { const f = adminFilter(req.body).f; const x = filterQS(f, { page: parseInt(req.body.page, 10) > 1 ? parseInt(req.body.page, 10) : '' }); return cfg.base + '/admin' + (x ? '?' + x : ''); })();
  const now = new Date().toISOString();
  const run = (sqlSet, params) => {                              // apply to the selected ids, or to everything matching the filter
    if (req.body.scope === 'all') {
      const { where, p } = adminFilter(req.body);
      return db.prepare(`${sqlSet.pre} ${where ? where : ''}`).run(...params, ...p);
    }
    const ids = parseIds(req.body.ids, 1000);
    if (!ids.length) return null;
    return db.prepare(`${sqlSet.pre} WHERE id IN (${ids.map(() => '?').join(',')})`).run(...params, ...ids);
  };
  const pickIds = () => {
    if (req.body.scope === 'all') { const { where, p } = adminFilter(req.body); return db.prepare(`SELECT id FROM registrations ${where}`).all(...p).map((x) => x.id); }
    return parseIds(req.body.ids, 1000);
  };
  if (act === 'paid') { const n = confirmPayments(pickIds()); flash(req, `${n} payment${n === 1 ? '' : 's'} marked as paid${cfg.payEmail && n ? '; confirmation emails are being sent' : ''}.`); }
  else if (act === 'unpaid') { run({ pre: "UPDATE registrations SET pay_status='unpaid', paid_at=NULL, pay_source=NULL" }, []); flash(req, 'Payment status set back to unpaid.'); }
  else if (act === 'waived') { run({ pre: "UPDATE registrations SET pay_status='waived', paid_at=NULL, pay_source='manual', pay_note=COALESCE(pay_note,'waived by organiser')" }, []); flash(req, 'Marked as not requiring payment.'); }
  else if (act === 'attended') run({ pre: "UPDATE registrations SET attended=1, checkin_at=COALESCE(checkin_at, datetime('now')), checkin_by=COALESCE(checkin_by,'organiser (marked)')" }, []);
  else if (act === 'reinstate') { run({ pre: 'UPDATE registrations SET cancelled_at=NULL' }, []); flash(req, 'Registration reinstated.'); }
  else if (act === 'cancel') { run({ pre: "UPDATE registrations SET cancelled_at=COALESCE(cancelled_at, datetime('now')), cancel_reason=COALESCE(cancel_reason,'Cancelled by the organisers')" }, []); flash(req, 'Registration cancelled (seat released). No email was sent.'); }
  else if (act === 'unattended') run({ pre: 'UPDATE registrations SET attended=0' }, []);
  else if (act === 'revoke') { run({ pre: 'UPDATE registrations SET cert_issued_at=NULL' }, []); flash(req, 'Certificates withdrawn: they no longer verify, and participants can download again if they are still eligible.'); }
  else if (act === 'delete') {
    if (req.body.scope === 'all' && String(req.body.confirm || '') !== 'DELETE') return res.redirect(back);
    run({ pre: 'DELETE FROM registrations' }, []);
  } else if (act === 'issue') {
    const ids = parseIds(req.body.ids, 1000);
    if (ids.length) db.prepare(`UPDATE registrations SET cert_issued_at=COALESCE(cert_issued_at, ?) WHERE id IN (${ids.map(() => '?').join(',')})`).run(now, ...ids);
    return res.json({ ok: true });
  }
  res.redirect(back);
});

// certificate page: the browser pulls participants in small batches from the JSON endpoint below
function certSource(q) {
  const ids = parseIds(q.ids, 500);
  if (ids.length) return { where: `WHERE id IN (${ids.map(() => '?').join(',')})`, p: ids, src: 'ids=' + ids.join(',') };
  const { where, p, f } = adminFilter({ ...q, status: q.status || (q.scope === 'attended' ? 'attended' : 'all') });
  return { where, p, src: filterQS(f) };
}
// ── Programme: venues and the schedule of every talk and item ──
const SCH = require('./lib/schedule');
router.get('/admin/programme', requireAdmin, (req, res) => {
  const list = SCH.entries();
  html(res, adminViews.programme({ list, venues: SCH.venues(), use: SCH.venueUse(), clash: SCH.clashes(list), days: cfg.eventDays || [], dayLabel: cfg.eventDayLabel, liveOn: !!SCH.publicDays(), csrf: csrfToken(req), flash: takeFlash(req) }));
});
const progBack = (res, v) => res.redirect(cfg.base + '/admin/programme' + (v && v.slot_date ? '#d' + (cfg.eventDays || []).indexOf(v.slot_date) : v ? '#un' : ''));
router.post('/admin/programme/save', requireAdmin, (req, res) => {
  const b = req.body || {}; if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return progBack(res); }
  const type = b.type, id = parseInt(b.id, 10) || 0;
  const { v, errors } = SCH.readSlot(b);
  const now = new Date().toISOString();
  let who = '', rec = null;
  if (type === 'item') {
    const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 160), kind = SCH.KIND_KEYS.includes(b.kind) ? b.kind : 'other', host = String(b.who || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!title) errors.push('Please give the item a title.');
    if (errors.length) { flash(req, '', errors); return progBack(res, v); }
    if (id) db.prepare('UPDATE prog_items SET kind=?, title=?, who=?, slot_date=?, slot_start=?, slot_end=?, slot_venue=?, ok=?, updated_at=? WHERE id=?').run(kind, title, host, v.slot_date || null, v.slot_start || null, v.slot_end || null, v.slot_venue, v.slot_ok, now, id);
    else db.prepare('INSERT INTO prog_items (kind, title, who, slot_date, slot_start, slot_end, slot_venue, ok, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(kind, title, host, v.slot_date || null, v.slot_start || null, v.slot_end || null, v.slot_venue, v.slot_ok, now);
    who = title;
  } else if (type === 'spk' || type === 'reg') {
    const T = type === 'spk' ? 'speakers' : 'registrations';
    rec = db.prepare(`SELECT * FROM ${T} WHERE id=?`).get(id);
    if (!rec) { flash(req, '', 'That presenter no longer exists.'); return progBack(res); }
    if (errors.length) { flash(req, '', errors); return progBack(res, v); }
    db.prepare(`UPDATE ${T} SET slot_date=?, slot_start=?, slot_end=?, slot_venue=?, slot_code=?, slot_ok=? WHERE id=?`).run(v.slot_date || null, v.slot_start || null, v.slot_end || null, v.slot_venue, v.slot_code || null, v.slot_ok, id);
    if (type === 'spk') db.prepare('UPDATE speakers SET updated_at=?, updated_by=? WHERE id=?').run(now, 'organiser', id);
    who = rec.full_name;
  } else return progBack(res);
  // tell the presenter (in the background, so a slow mail server never holds up saving)
  let note = '';
  if (rec && b.notify === '1') {
    if (!v.slot_date || !v.slot_start) note = ' No email was sent: set the day and start time first.';
    else if (!rec.email) note = ' No email was sent: there is no email address.';
    else if (!mail.configured()) note = ' No email was sent: email is not set up yet (Settings → Emails).';
    else {
      const m = mail.speakerScheduleEmail({ name: rec.full_name, talkTitle: type === 'spk' ? rec.talk_title : rec.paper_title, dateLabel: cfg.eventDayLabel(v.slot_date), timeText: v.slot_end ? `${v.slot_start} – ${v.slot_end}` : v.slot_start, venue: cfg.eventVenue, room: SCH.venueName(v.slot_venue), changed: !!rec.slot_sent_at,
        portalLink: type === 'spk' ? `${views.SITE}/speaker` : `${views.SITE}/login`, portalLabel: type === 'spk' ? 'Open speaker portal' : 'Open my dashboard' });
      const T = type === 'spk' ? 'speakers' : 'registrations';
      mail.send({ to: rec.email, subject: m.subject, text: m.text, html: m.html })
        .then(() => { db.prepare(`UPDATE ${T} SET slot_sent_at=? WHERE id=?`).run(new Date().toISOString(), id); if (type === 'spk') speakers.markSlotSent(id, { ...rec, ...v }); })
        .catch((ex) => console.error('Schedule email failed:', ex.message));
      note = ` The schedule is being emailed to ${rec.email}.`;
    }
  }
  const list = SCH.entries(), key = (type === 'item' ? 'item-' : type + '-') + (id || db.prepare('SELECT MAX(id) m FROM prog_items').get().m), c = SCH.clashes(list).get(key);
  flash(req, `Saved ${who}.${v.slot_ok ? ' It is on the website programme.' : v.slot_date ? ' It is not on the website yet.' : ''}${note}`, c ? [`Room clash: ${SCH.venueName(v.slot_venue)} already has ${c.type === 'item' ? c.title : c.who} at ${c.slot_start}${c.slot_end ? '–' + c.slot_end : ''}.`] : []);
  progBack(res, v);
});
router.post('/admin/programme/item-delete', requireAdmin, (req, res) => {
  if (csrfOk(req)) { db.prepare('DELETE FROM prog_items WHERE id=?').run(parseInt((req.body || {}).id, 10) || 0); flash(req, 'Item deleted.'); }
  progBack(res);
});
router.post('/admin/programme/venue', requireAdmin, (req, res) => {
  if (!csrfOk(req)) { flash(req, '', 'Your session expired. Please try again.'); return progBack(res); }
  const id = parseInt((req.body || {}).id, 10) || 0, r = SCH.saveVenue(id, req.body || {});
  if (r.error) flash(req, '', r.error); else flash(req, id ? 'Venue updated. Every talk in it now shows the new name.' : 'Venue added.');
  progBack(res);
});
router.post('/admin/programme/venue-delete', requireAdmin, (req, res) => {
  if (csrfOk(req)) { const n = SCH.deleteVenue(parseInt((req.body || {}).id, 10) || 0); flash(req, `Venue deleted.${n ? ` ${n} ${n === 1 ? 'entry is' : 'entries are'} now “To be confirmed”.` : ''}`); }
  progBack(res);
});
router.get('/admin/certificates', requireAdmin, (req, res) => {
  const { where, p, src } = certSource(req.query);
  const hasFilter = !!(req.query.ids || req.query.scope || req.query.q || req.query.status || req.query.cat);
  const total = hasFilter ? db.prepare(`SELECT COUNT(*) c FROM registrations ${where}`).get(...p).c : 0;
  const st = String(req.query.status || req.query.scope || '');
  const label = req.query.ids ? 'Participants you selected' : ({ pending: 'Attended, no certificate yet', attended: 'Everyone who attended', issued: 'Certificates already issued', all: 'All participants' }[st] || 'Participants matching your filter') + (req.query.q ? ` · “${String(req.query.q).slice(0, 60)}”` : '');
  const counts = total ? {} : db.prepare("SELECT SUM(attended=1 AND cert_issued_at IS NULL) pending, SUM(attended=1) attended, SUM(cert_issued_at IS NOT NULL) issued FROM registrations WHERE cancelled_at IS NULL").get();
  html(res, adminViews.certificates({ total, src, csrf: csrfToken(req), label, counts }));
});
router.get('/admin/certificates.json', requireAdmin, (req, res) => {
  const { where, p } = certSource(req.query);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const after = parseInt(req.query.after, 10);
  const total = db.prepare(`SELECT COUNT(*) c FROM registrations ${where}`).get(...p).c;
  let rows;
  if (Number.isInteger(after)) {                                   // keyset paging for batch download (stable while certificates get marked as issued)
    const w2 = where ? where + ' AND id > ?' : 'WHERE id > ?';
    rows = db.prepare(`SELECT id,ref,full_name,organisation,participation FROM registrations ${w2} ORDER BY id ASC LIMIT ?`).all(...p, after, limit);
  } else {
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    rows = db.prepare(`SELECT id,ref,full_name,organisation,participation FROM registrations ${where} ORDER BY full_name COLLATE NOCASE ASC, id ASC LIMIT ? OFFSET ?`).all(...p, limit, offset);
  }
  res.set('Cache-Control', 'no-store').json({ total, rows });
});


// ── Ticket2U payment import: paste/upload the attendee or sales export, match by email (or reference), mark paid ──
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = String(text).replace(/^﻿/, '');
  const delim = (text.split(/\r?\n/)[0].match(/\t/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}
function matchImport(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'The file has no data rows. Export the attendee or sales list from your Ticket2U organiser dashboard as CSV.' };
  const hdr = rows[0].map((h) => String(h).trim().toLowerCase());
  const find = (...res) => { for (const re of res) { const i = hdr.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
  const ci = { email: find(/^e-?mail/, /email/), order: find(/order\s*(no|number|id|#)?$/, /^order/, /booking/, /transaction/, /ticket\s*(no|number|id)/, /invoice/), amount: find(/^(total|amount|grand total|net)/, /amount|total|price|paid/), ref: find(/reference|ref\b|registration/), status: find(/^(payment\s*)?status/) };
  if (ci.email < 0) return { error: 'No “Email” column was found in the first row. Check that you exported the attendee/sales list with headings.' };
  const out = { matched: [], already: [], unknown: [], skipped: [], cols: Object.fromEntries(Object.entries(ci).map(([k, i]) => [k, i >= 0 ? rows[0][i] : ''])) };
  const seen = new Set();
  for (const r of rows.slice(1)) {
    const email = String(r[ci.email] || '').trim(), order = ci.order >= 0 ? String(r[ci.order] || '').trim().slice(0, 40) : '', amount = ci.amount >= 0 ? String(r[ci.amount] || '').trim().slice(0, 30) : '';
    const status = ci.status >= 0 ? String(r[ci.status] || '').trim().toLowerCase() : '';
    if (status && /(cancel|refund|fail|pending|unpaid|void)/.test(status)) { out.skipped.push({ email, order, why: status }); continue; }
    let reg = null;
    const refM = ci.ref >= 0 && /IC27-[A-Z0-9]{5}/i.exec(String(r[ci.ref] || '')); if (refM) reg = db.prepare('SELECT * FROM registrations WHERE ref=?').get(refM[0].toUpperCase());
    if (!reg && EMAIL_RE.test(email)) reg = db.prepare('SELECT * FROM registrations WHERE email_key=?').get(normaliseEmail(email));
    if (!reg) { out.unknown.push({ email, order, amount }); continue; }
    if (seen.has(reg.id)) continue; seen.add(reg.id);
    const item = { id: reg.id, ref: reg.ref, name: reg.full_name, email: reg.email, category: reg.category, fee: reg.fee, order, amount, claimed: reg.pay_ref || '' };
    (reg.pay_status === 'paid' || reg.pay_status === 'waived' ? out.already : out.matched).push(item);
  }
  return out;
}
router.get('/admin/submissions', requireAdmin, (req, res) => {
  const P = "participation LIKE '%presentation%' AND cancelled_at IS NULL";
  const q = (sql) => db.prepare(sql).get();
  const stats = { presenters: q(`SELECT COUNT(*) n FROM registrations WHERE ${P}`).n };
  for (const [k, done] of [['abs', "paper_title IS NOT NULL AND paper_title<>'' AND abstract IS NOT NULL AND abstract<>''"], ['ext', 'ext_file IS NOT NULL'], ['fp', 'fp_file IS NOT NULL']])
    stats[k] = q(`SELECT COALESCE(SUM(${done}),0) done, COALESCE(SUM(${k}_status='accepted'),0) accepted, COALESCE(SUM(${k}_status='revise'),0) revise, COALESCE(SUM(${k}_status='rejected'),0) rejected FROM registrations WHERE ${P}`);
  const recent = db.prepare(`SELECT id,ref,full_name,participation,paper_title,pres_at,ext_file,fp_file,abs_status FROM registrations WHERE ${P} AND paper_title IS NOT NULL AND paper_title<>'' ORDER BY COALESCE(pres_at,'') DESC LIMIT 30`).all();
  html(res, adminViews.submissions({ csrf: csrfToken(req), stats, stages: SUB.stages(), recent, speakersWithAbs: speakers.published().filter((x) => x.talk_title && x.abstract).length }));
});
router.get('/admin/payments', requireAdmin, (req, res) => html(res, adminViews.payments({ counts: db.prepare("SELECT COALESCE(SUM(pay_status='paid'),0) paid, COALESCE(SUM(pay_status='waived'),0) waived, COALESCE(SUM(pay_status='claimed'),0) claimed, COALESCE(SUM(pay_status='unpaid'),0) unpaid FROM registrations").get(), csrf: csrfToken(req), flash: takeFlash(req), t2u: cfg.ticket2uUrl, fees: cfg.fees, st: { on: stripe.configured(), mode: stripe.mode(), hook: !!cfg.stripe.webhookSecret, url: views.SITE + '/stripe/webhook', provider: cfg.payProvider, bad: cfg.fees.filter((f) => !stripe.parseFee(f.fee)).map((f) => f.name) }, paidBy: db.prepare("SELECT pay_source s, COUNT(*) n FROM registrations WHERE pay_status='paid' GROUP BY pay_source").all(), claimed: db.prepare("SELECT id,ref,full_name,email,category,fee,pay_ref,pay_claimed_at FROM registrations WHERE pay_status='claimed' ORDER BY pay_claimed_at LIMIT 500").all() })));
router.post('/admin/payments/import', express.json({ limit: '8mb' }), requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).json({ ok: false, error: 'Session expired. Reload the page.' });
  const r = matchImport(req.body && req.body.csv);
  if (r.error) return res.json({ ok: false, error: r.error });
  if (!(req.body && req.body.apply)) return res.json({ ok: true, preview: r });
  let n = 0; for (const m of r.matched) n += confirmPayments([m.id], { source: 'ticket2u-import', order: m.order || null, amount: m.amount || null });
  res.json({ ok: true, applied: n, preview: r });
});

// ── admin settings ────────────────────────────────────────
const fs = require('fs'), os = require('os');
const { dir: DATA_DIR } = require('./lib/db');
function serverStatus() {
  let dbSize = 0; try { dbSize = fs.statSync(path.join(DATA_DIR, 'icssst2027.sqlite')).size; } catch (_) { /* ignore */ }
  return {
    siteUrl: cfg.siteUrl, dataDir: DATA_DIR, dbSize, node: process.version,
    smtpHost: cfg.smtp.host + ':' + cfg.smtp.port, smtpUser: cfg.smtp.user, smtpPass: !!cfg.smtp.pass,
    googleConfigured: googleConfigured(), googleRedirect: redirectUri(),
    registrations: seatsTaken(), pending: db.prepare('SELECT COUNT(*) c FROM pending').get().c,
    sigVer: cfg.signatureVer, sigData: cfg.signatureData ? true : false,
  };
}
const settingsPage = (req, res, extra = {}) => html(res, adminViews.settings({
  groups: settings.GROUPS, fields: settings.FIELDS, vals: settings.get(), toLocal: settings.toLocalInput,
  flash: extra.flash || takeFlash(req), raw: extra.raw || null, status: serverStatus(), isOpen: settings.isOpen(), left: seatsLeft(), csrf: csrfToken(req),
}), extra.status || 200);

router.get('/admin/settings', requireAdmin, (req, res) => settingsPage(req, res));
router.post('/admin/settings', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const { errors, values } = settings.validate(req.body || {}, googleConfigured());
  if (errors.length) return settingsPage(req, res, { flash: { ok: '', err: errors }, raw: req.body || {}, status: 400 });
  settings.save(values);
  flash(req, 'Settings saved. They are active now.');
  res.redirect(cfg.base + '/admin/settings');
});
router.post('/admin/settings/reset', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  settings.resetAll(); flash(req, 'All settings are back to the defaults from the server configuration.');
  res.redirect(cfg.base + '/admin/settings');
});
router.post('/admin/settings/password', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const b = req.body || {}, errs = [];
  if (!bcrypt.compareSync(String(b.current || ''), cfg.adminHash)) errs.push('The current password is not correct.');
  const np = String(b.newpass || ''), nu = String(b.newuser || '').trim();
  if (np && np.length < 10) errs.push('The new password must be at least 10 characters.');
  if (np !== String(b.newpass2 || '')) errs.push('The two new passwords do not match.');
  if (nu && !/^[A-Za-z0-9._-]{3,40}$/.test(nu)) errs.push('Username: 3–40 letters, digits, dots, dashes or underscores.');
  if (!np && !nu) errs.push('Enter a new password and/or a new username.');
  if (errs.length) { flash(req, '', errs); return res.redirect(cfg.base + '/admin/settings#account'); }
  if (np) settings.setRaw('adminHash', bcrypt.hashSync(np, 12));
  if (nu) settings.setRaw('adminUser', nu);
  req.session.av = adminTag();                                       // keep this session; every other one is signed out
  flash(req, 'Admin login updated. Use the new details next time you sign in.');
  res.redirect(cfg.base + '/admin/settings#account');
});
router.post('/admin/settings/signature', express.json({ limit: '1mb' }), requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!csrfOk(req)) return res.status(400).json({ ok: false, error: 'Session expired. Reload the page.' });
  if (b.remove) { settings.delRaw('signatureData'); settings.delRaw('signatureAt'); return res.json({ ok: true }); }
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dataUrl || ''));
  if (!m) return res.json({ ok: false, error: 'Please choose a PNG or JPEG image.' });
  const buf = Buffer.from(m[2], 'base64');
  const magic = m[1] === 'image/png' ? buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (!magic || buf.length > 700 * 1024) return res.json({ ok: false, error: 'The image must be a real PNG/JPEG.' });
  settings.setRaw('signatureData', String(b.dataUrl)); settings.setRaw('signatureAt', String(Date.now()));
  res.json({ ok: true });
});
router.get('/admin/signature', requireAdmin, (req, res) => {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(cfg.signatureData || '');
  if (!m) return res.status(404).end();
  res.set({ 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600' }).send(Buffer.from(m[2], 'base64'));
});
router.post('/admin/settings/test-email', requireAdmin, async (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const to = String(req.body.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) { flash(req, '', 'Enter a valid email address for the test.'); return res.redirect(cfg.base + '/admin/settings#tools'); }
  try { await mail.send({ to, subject: `${cfg.eventName} — test email`, text: 'This is a test email from the conference website. Email sending works.' }); flash(req, `Test email sent to ${to}. Check the inbox (and spam).`); }
  catch (ex) { flash(req, '', 'Sending failed: ' + ex.message); }
  res.redirect(cfg.base + '/admin/settings#tools');
});
router.post('/admin/settings/smtp-pass', requireAdmin, async (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  if (req.body.clear) { settings.delRaw('smtpPass'); flash(req, 'The saved email password was removed.'); return res.redirect(cfg.base + '/admin/settings#tools'); }
  const pass = String(req.body.pass || '').trim();
  if (!pass || pass.length > 200) { flash(req, '', 'Type the email password first.'); return res.redirect(cfg.base + '/admin/settings#tools'); }
  const prev = cfg.smtp.pass; cfg.smtp.pass = pass;
  const r = await mail.check();                                        // check the password against Zoho before keeping it
  if (!r.ok) { cfg.smtp.pass = prev; flash(req, '', r.auth ? 'Zoho did not accept that password, so it was not saved. Check it (or create a Zoho app password) and try again.' : 'Could not reach the Zoho mail server to check the password (' + r.msg + '). Nothing was saved; please try again.'); return res.redirect(cfg.base + '/admin/settings#tools'); }
  settings.setRaw('smtpPass', pass);
  flash(req, `Email password saved and checked with Zoho (${r.host}:${r.port}). Verification codes and invitations can be sent now.`);
  res.redirect(cfg.base + '/admin/settings#tools');
});
router.post('/admin/settings/purge', requireAdmin, (req, res) => {
  if (!csrfOk(req)) return res.status(400).send('Bad request');
  const what = String(req.body.what || '');
  if (what === 'pending') { db.exec('DELETE FROM pending; DELETE FROM mail_log; DELETE FROM login_attempts;'); flash(req, 'Unverified sign-ups and rate-limit counters were cleared.'); }
  else if (what === 'all' && String(req.body.confirm || '') === 'DELETE') { const n = seatsTaken(); db.exec('DELETE FROM registrations; DELETE FROM pending;'); flash(req, `${n.toLocaleString('en-US')} registrations were permanently deleted.`); }
  else flash(req, '', 'Nothing was deleted. To delete all participants, type DELETE exactly.');
  res.redirect(cfg.base + '/admin/settings#tools');
});
router.get('/admin/backup.sqlite', requireAdmin, (req, res) => {
  const f = path.join(os.tmpdir(), 'qh-backup-' + crypto.randomBytes(6).toString('hex') + '.sqlite');
  try { db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); } catch (ex) { console.error('Backup failed:', ex.message); return res.status(500).send('Backup failed: ' + ex.message); }
  res.download(f, `icssst2027-backup-${new Date().toISOString().slice(0, 10)}.sqlite`, () => fs.unlink(f, () => {}));
});

router.get('/admin/mail-test', requireAdmin, async (req, res) => {
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let body = `<p>User: <b>${esc(cfg.smtp.user)}</b> · Password set: <b>${cfg.smtp.pass ? 'yes (' + cfg.smtp.pass.length + ' chars)' : 'NO'}</b> · Node ${process.version}</p>`;
  if (mail.configured()) {
    const r = await mail.diagnose();
    body += '<table border="1" cellpadding="8" style="border-collapse:collapse"><tr><th>Host</th><th>Port</th><th>Result</th></tr>' +
      r.map((x) => `<tr><td>${esc(x.host)}</td><td>${x.port}</td><td style="color:${x.ok ? 'green' : 'crimson'}">${x.ok ? 'OK (' + x.ms + ' ms)' : esc(`${x.code} ${x.resp} ${x.msg}`)}</td></tr>`).join('') + '</table>';
    {
      body += '<p>To send a test email, use Admin → Settings → Tools (a link cannot send mail on its own).</p>';
    }
  }
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><meta name="robots" content="noindex"><body style="font-family:sans-serif;padding:24px"><h2>Email diagnostics</h2>${body}<p><a href="${cfg.base}/admin">← Back</a></p>`);
});

router.get('/admin/export.csv', requireAdmin, (req, res) => {
  const { where, p } = adminFilter(req.query);
  const cell = (x) => { let s = String(x ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };   // CSV-injection safe
  res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="participants-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.write('﻿' + ['Reference', 'Title', 'Full name', 'Email', 'Phone', 'Position', 'Department', 'Organisation', 'Participation', 'Paper title', 'Paper ID', 'Authors', 'Abstract', 'Keywords', 'Abstract review', 'Extended abstract file', 'Extended abstract review', 'Full paper file', 'Full paper review', 'MASS no.', 'Diet', 'Diet note', 'Dinner', 'Invoice to', 'Category', 'Fee', 'Payment status', 'Ticket2U order', 'Amount paid', 'Paid at (UTC)', 'Country', 'Registered (UTC)', 'Attended', 'Certificate issued', 'Sign-up method'].map(cell).join(',') + '\r\n');
  let after = 0;                                                    // stream in chunks so 100k rows never sit in memory at once
  for (;;) {
    const w2 = where ? where + ' AND id > ?' : 'WHERE id > ?';
    const rows = db.prepare(`SELECT id,ref,full_name,email,phone,organisation,category,country,created_at,attended,cert_issued_at,method,fee,pay_status,pay_ref,pay_amount,paid_at,salutation,designation,department,participation,paper_title,paper_id,coauthors,abstract,mass_no,diet,diet_note,dinner,billing FROM registrations ${w2} ORDER BY id LIMIT 5000`).all(...p, after);
    if (!rows.length) break;
    res.write(rows.map((r) => [r.ref, r.salutation, r.full_name, r.email, r.phone, r.designation, r.department, r.organisation, r.participation, r.paper_title, r.paper_id, AUTH.plain(AUTH.read(r, r.full_name)) || r.coauthors, r.abstract, r.keywords, SUB.STATUS[r.abs_status || ''], r.ext_name || '', r.ext_file ? SUB.STATUS[r.ext_status || ''] : '', r.fp_name || '', r.fp_file ? SUB.STATUS[r.fp_status || ''] : '', r.mass_no, r.diet, r.diet_note, r.dinner, r.billing, r.category, r.fee, r.pay_status, r.pay_ref, r.pay_amount, r.paid_at, r.country, r.created_at, r.attended ? 'Yes' : 'No', r.cert_issued_at, r.method || 'email'].map(cell).join(',')).join('\r\n') + '\r\n');
    after = rows[rows.length - 1].id;
  }
  res.end();
});

// ── SEO: robots, sitemap, search-engine verification, IndexNow ────────────
app.use(cfg.base || '/', (req, res, next) => {
  if (/^\/(admin|verify|auth|captcha\.svg|account|login|forgot|reset|speaker(\/|$))/.test(req.path) || (req.path === '/register' && req.query.done !== undefined)) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
const ROBOTS_BLOCK = ['/admin', '/verify', '/auth', '/captcha.svg', '/account', '/login', '/forgot', '/reset', '/speaker$', '/speaker/', '/mail-test', '/*?done='].map((x) => `Disallow: ${cfg.base}${x}`).join('\n');
router.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
  // the public pages are open to every search engine; private and sign-in pages are kept out of results
  ['*', 'Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot', 'YandexBot', 'Baiduspider', 'Applebot'].map((ua) => `User-agent: ${ua}\nAllow: ${cfg.base || ''}/\n${ROBOTS_BLOCK}\n`).join('\n') +
  `\nSitemap: ${views.SITE}/sitemap.xml\n`));
// IndexNow (Bing, Yahoo, Yandex, Seznam, Naver): tells those engines about new or changed pages straight away
const INDEXNOW_KEY = cfg.indexNowKey || require('crypto').createHash('sha256').update(String(SECRET) + 'indexnow').digest('hex').slice(0, 32);
router.get('/' + INDEXNOW_KEY + '.txt', (req, res) => res.type('text/plain').send(INDEXNOW_KEY));
function publicUrls() { return ['/', '/register', '/speakers', ...speakers.published().map((x) => '/speakers/' + x.slug), '/privacy', '/terms'].map((u) => views.SITE + u); }
async function pingIndexNow() {
  if (!/^https:\/\//.test(views.SITE) || /YOUR-DOMAIN|localhost/.test(views.SITE) || process.env.NODE_ENV !== 'production') return;
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(views.SITE).host, key: INDEXNOW_KEY, keyLocation: `${views.SITE}/${INDEXNOW_KEY}.txt`, urlList: publicUrls() }) });
    console.log('IndexNow: submitted', publicUrls().length, 'pages, status', r.status);
  } catch (err) { console.warn('IndexNow: not sent (' + err.message + ')'); }
}
setTimeout(pingIndexNow, 60e3).unref();
router.get('/sitemap.xml', (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const urls = [['/', '1.0', 'daily'], ['/register', '0.9', 'weekly'], ['/speakers', '0.8', 'weekly'], ...speakers.published().map((x) => ['/speakers/' + x.slug, '0.7', 'weekly']), ['/privacy', '0.3', 'yearly'], ['/terms', '0.3', 'yearly']];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.flatMap(([u, p, c]) => [[u, p, c], [u + '?lang=ms', String(Math.max(0.1, p - 0.1).toFixed(1)), c]]).map(([u, p, c]) => `  <url><loc>${views.SITE}${u === '/' ? '/' : u.replace(/^\/\?/, '/?')}</loc><lastmod>${day}</lastmod><changefreq>${c}</changefreq><priority>${p}</priority>${u === '/' ? `<image:image><image:loc>${views.SITE}/assets/og-image.png</image:loc><image:title>ICSSST 2027 — International Conference on Solid State Science and Technology</image:title></image:image>` : ''}</url>`).join('\n') + `\n</urlset>\n`);
});
if (cfg.googleVerifyFile && /^google[a-z0-9]+\.html$/i.test(cfg.googleVerifyFile)) {
  router.get('/' + cfg.googleVerifyFile, (req, res) => res.type('text/html').send('google-site-verification: ' + cfg.googleVerifyFile));
}

app.get((cfg.base || '') + '/assets/institutions.json', inst.serve);        // gzip-compressed list (≈90 KB)
app.use((cfg.base || '') + '/assets/katex', express.static(path.join(path.dirname(require.resolve('katex/package.json')), 'dist'), { maxAge: '30d', index: false }));   // equation preview
app.use(cfg.base || '/', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(cfg.base || '/', router);
app.use((req, res) => html(res, views.head('Not found', '', { noindex: true }) + '<main class="done"><div class="wrap"><span class="label">404</span><h1>Page not found.</h1><a class="btn" href="' + cfg.base + '/">Back home <span class="arr">→</span></a></div></main>' + views.foot(), 404));
app.use((err, req, res, next) => { console.error(err); res.status(500).type('text').send('Server error'); });

if (/YOUR-DOMAIN/.test(cfg.siteUrl)) console.warn('WARNING: set SITE_URL to your real public address (used in sitemap, canonical links and social previews).');
// Always listen: hosts such as cPanel/Passenger load this file through their own loader (require.main !== module).
app.listen(process.env.PORT || cfg.port, () => console.log(`${cfg.eventName} site running (port ${process.env.PORT || cfg.port}, base '${cfg.base}', ${(() => { try { return require('fs').readdirSync('/proc/self/task').length + ' threads'; } catch (_) { return 'threads n/a'; } })()})`));
module.exports = app;
