'use strict';
// ICSSST 2027 site configuration. Any value can be overridden with an environment variable.
// Minimal .env loader (works on any Node version). Real environment variables take priority.
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    let v = m[2];
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
} catch (_) { /* no .env file */ }

const env = process.env;
module.exports = {
  port: Number(env.PORT || 3000),
  base: (env.BASE_PATH || '').replace(/\/+$/, ''),          // e.g. '/icssst2027' if served from a sub-path
  siteUrl: env.SITE_URL || 'https://YOUR-DOMAIN',
  secureCookies: env.SECURE_COOKIES ? env.SECURE_COOKIES === 'true' : env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : 1,

  googleVerification: env.GOOGLE_SITE_VERIFICATION || '',   // content of Google Search Console <meta> verification tag
  googleVerifyFile: env.GOOGLE_VERIFY_FILE || '',           // or the file name Google gives you, e.g. google1234abcd.html

  eventName: 'ICSSST 2027',
  eventFull: '11th International Conference on Solid State Science and Technology',
  eventSub: 'Malaysia’s High-Tech Era: Innovation in Nanotechnology, AI and Semiconductors',
  eventDateText: '6–8 September 2027',
  eventTime: env.EVENT_TIME || 'To be confirmed',
  eventVenue: 'Penang, Malaysia',
  seatLimit: Number(env.SEAT_LIMIT || 1000),
  regOpen: env.REG_OPEN ? env.REG_OPEN === 'true' : true,

  // Outgoing email (Zoho SMTP). Put the password in the host's environment variables as SMTP_PASS (do not commit it).
  smtp: {
    host: env.SMTP_HOST || 'smtppro.zoho.com',
    port: Number(env.SMTP_PORT || 465),
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : true,      // 465 = SSL; use SMTP_PORT=587 SMTP_SECURE=false for TLS (STARTTLS)
    user: env.SMTP_USER || 'events@usmphysics.org',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || '"ICSSST 2027" <events@usmphysics.org>',
    replyTo: env.MAIL_REPLY_TO || 'events@usmphysics.org',
  },
  // Google sign-in (OAuth 2.0). Leave the ID/secret empty to hide the button.
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: env.GOOGLE_REDIRECT_URI || '',      // default: SITE_URL + /auth/google/callback
  },
  codeMinutes: 10,         // verification code validity
  resendSeconds: 60,       // wait before another code can be requested
  maxCodeAttempts: 5,

  adminUser: env.ADMIN_USER || 'admin',
  // bcrypt hash. Create a new one with:  npm run hash -- "new-password"
  adminHash: env.ADMIN_HASH || '$2b$12$yIUnLxFZjgLscFLScT/OUe7lJqmO0cqyNZoDeEYq4KNs9cPqKth4u',
  sessionSecret: env.SESSION_SECRET || '',                  // if empty, a random one is generated into data/secret.txt

  // Certificate signatory: the Dean of the School of Physics.
  // signatureImage: optional path under public/ (e.g. 'assets/dean-sign.png'); leave empty for a blank space to sign by hand.
  signatureImage: '',
  signatoryName: 'Assoc. Prof. Dr. Azhar Abdul Rahman',
  signatoryTitle: 'Dean, School of Physics, Universiti Sains Malaysia',
};
