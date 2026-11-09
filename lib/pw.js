'use strict';
// Password hashing with scrypt from Node's own crypto. It runs on the I/O thread pool, so a burst of sign-ins
// never freezes the website for other visitors (bcryptjs, used before, ran on the main thread).
// Old bcrypt hashes still verify, and are upgraded to scrypt the next time that person signs in.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const N = 16384, R = 8, P = 1, LEN = 32, MAXMEM = 64 * 1024 * 1024;
const run = (pw, salt, n = N) => new Promise((ok, no) => crypto.scrypt(pw, salt, LEN, { N: n, r: R, p: P, maxmem: MAXMEM }, (err, key) => (err ? no(err) : ok(key))));
const clip = (pw) => String(pw == null ? '' : pw).slice(0, 128);
const DUMMY_SALT = crypto.randomBytes(16);

async function hash(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${N}$${salt.toString('base64')}$${(await run(clip(pw), salt)).toString('base64')}`;
}
// true when pw matches h; an empty/unknown hash costs the same time (no account discovery by timing)
async function verify(pw, h) {
  pw = clip(pw);
  if (h && h.startsWith('scrypt$')) {
    const [, n, s, k] = h.split('$'); const want = Buffer.from(k, 'base64');
    const got = await run(pw, Buffer.from(s, 'base64'), parseInt(n, 10) || N);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  }
  if (h && h.startsWith('$2')) return bcrypt.compare(pw, h);
  await run(pw, DUMMY_SALT); return false;
}
const legacy = (h) => !!h && h.startsWith('$2');

module.exports = { hash, verify, legacy };
