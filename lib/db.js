'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const os = require('os');
// Pick the first writable data folder (hosts often make the app folder read-only).
function pickDir() {
  const cands = [process.env.DATA_DIR, path.join(__dirname, '..', 'data'), path.join(os.homedir() || '', '.icssst2027'), path.join(os.tmpdir(), 'icssst2027')].filter(Boolean);
  for (const d of cands) {
    try {
      fs.mkdirSync(d, { recursive: true });
      const probe = path.join(d, '.w' + process.pid); fs.writeFileSync(probe, 'x'); fs.unlinkSync(probe);
      return d;
    } catch (e) { console.error('Data folder not writable, skipping:', d, '-', e.code || e.message); }
  }
  throw new Error('No writable folder for the database. Set DATA_DIR to a writable path.');
}
const dir = pickDir();
console.log('Node ' + process.version + ' | data folder: ' + dir);
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(dir, 'icssst2027.sqlite'));
  db.pragma('journal_mode = WAL');
} catch (err) {
  // Fallback for hosts where the native better-sqlite3 build is unavailable (needs Node 22.5+).
  console.error('better-sqlite3 unavailable (' + err.message.split('\n')[0] + '), trying built-in node:sqlite');
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(path.join(dir, 'icssst2027.sqlite'));
  db.exec('PRAGMA journal_mode = WAL');
}
db.exec(`
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  organisation TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  attended INTEGER NOT NULL DEFAULT 0,
  cert_issued_at TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_key TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  data TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent INTEGER NOT NULL,
  sends INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mail_log (ip_hash TEXT, email_key TEXT, ts INTEGER);
`);
// migration: normalised e-mail column (+ unique index) so one mailbox = one registration
{
  const { normaliseEmail } = require('./util');
  if (!db.prepare('PRAGMA table_info(registrations)').all().some((c) => c.name === 'email_key')) db.exec('ALTER TABLE registrations ADD COLUMN email_key TEXT');
  if (!db.prepare('PRAGMA table_info(registrations)').all().some((c) => c.name === 'method')) db.exec("ALTER TABLE registrations ADD COLUMN method TEXT DEFAULT 'email'");
  const upd = db.prepare('UPDATE registrations SET email_key=? WHERE id=?');
  for (const r of db.prepare('SELECT id,email FROM registrations WHERE email_key IS NULL').all()) upd.run(normaliseEmail(r.email), r.id);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_reg_email_key ON registrations(email_key)');
  // indexes that keep the admin dashboard fast with 100k+ rows
  db.exec('CREATE INDEX IF NOT EXISTS ix_reg_name ON registrations(full_name COLLATE NOCASE, id)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_reg_org ON registrations(organisation COLLATE NOCASE, id)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_reg_att ON registrations(attended, cert_issued_at)');
  db.exec('CREATE INDEX IF NOT EXISTS ix_reg_cat ON registrations(category)');
  // payment (Ticket2U): fee chosen at registration, status unpaid | claimed | paid | waived
  const cols = new Set(db.prepare('PRAGMA table_info(registrations)').all().map((c) => c.name));
  for (const [c, def] of [['fee', 'TEXT'], ['pay_status', "TEXT NOT NULL DEFAULT 'unpaid'"], ['pay_ref', 'TEXT'], ['pay_amount', 'TEXT'], ['pay_note', 'TEXT'], ['pay_source', 'TEXT'], ['pay_claimed_at', 'TEXT'], ['paid_at', 'TEXT'], ['last_login', 'TEXT'], ['pay_session', 'TEXT'],
    // participant account + extra registration details
    ['pw_hash', 'TEXT'], ['pw_set_at', 'TEXT'], ['salutation', 'TEXT'], ['designation', 'TEXT'], ['department', 'TEXT'], ['participation', 'TEXT'], ['paper_title', 'TEXT'], ['paper_id', 'TEXT'], ['mass_no', 'TEXT'], ['diet', 'TEXT'], ['diet_note', 'TEXT'], ['dinner', 'TEXT'], ['billing', 'TEXT'], ['profile_at', 'TEXT']]) {
    if (!cols.has(c)) db.exec(`ALTER TABLE registrations ADD COLUMN ${c} ${def}`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS ix_reg_pay ON registrations(pay_status)');
  db.exec('CREATE TABLE IF NOT EXISTS login_codes (email_key TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_sent INTEGER NOT NULL)');
}

function secret(cfg) {
  if (cfg.sessionSecret) return cfg.sessionSecret;
  const f = path.join(dir, 'secret.txt');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}
module.exports = { db, secret, dir };
