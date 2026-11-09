'use strict';
// Speakers: profiles, passwordless speaker sign-in (emailed 6-digit code), speaker portal, admin management and public pages.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cfg = require('../config');
const { db, dir: DATA_DIR } = require('./db');
const { normaliseEmail, maskEmail } = require('./util');

const PHOTO_DIR = path.join(DATA_DIR, 'speakers');
try { fs.mkdirSync(PHOTO_DIR, { recursive: true }); } catch (e) { console.error('Speaker photo folder not writable:', e.message); }

db.exec(`
CREATE TABLE IF NOT EXISTS speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  email TEXT, email_key TEXT UNIQUE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  affiliation TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Invited Speaker',
  talk_title TEXT NOT NULL DEFAULT '',
  abstract TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL DEFAULT '',
  photo_ver INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 100,
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  auto_pub INTEGER NOT NULL DEFAULT 1,
  created_at TEXT, updated_at TEXT, updated_by TEXT, last_login TEXT, invited_at TEXT
);
CREATE TABLE IF NOT EXISTS speaker_codes (
  email_key TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, sends INTEGER NOT NULL DEFAULT 1, last_sent INTEGER NOT NULL
);`);

const cols = db.prepare('PRAGMA table_info(speakers)').all().map((c) => c.name);
if (!cols.includes('auto_pub')) db.exec('ALTER TABLE speakers ADD COLUMN auto_pub INTEGER NOT NULL DEFAULT 1');
for (const [c, t] of [['slot_date', 'TEXT'], ['slot_start', 'TEXT'], ['slot_end', 'TEXT'], ['slot_sent', 'TEXT'], ['slot_sent_at', 'TEXT'], ['slot_mail_err', 'TEXT'], ['pw_hash', 'TEXT'], ['pw_set_at', 'TEXT'], ['invite_hash', 'TEXT'], ['invite_exp', 'INTEGER'], ['accepted_at', 'TEXT'], ['declined_at', 'TEXT']]) if (!cols.includes(c)) db.exec(`ALTER TABLE speakers ADD COLUMN ${c} ${t}`);
db.exec('CREATE TABLE IF NOT EXISTS speaker_fails (k TEXT PRIMARY KEY, n INTEGER NOT NULL, first_ts INTEGER NOT NULL, until INTEGER NOT NULL DEFAULT 0)');

const ROLES = ['Guest of Honour', 'Keynote Speaker', 'Invited Speaker', 'Speaker', 'Panellist', 'Session Chair'];
const LIMITS = { full_name: 120, position: 400, affiliation: 200, country: 60, talk_title: 220, abstract: 4000, bio: 2500, website: 200, slot: 80 };
const nowIso = () => new Date().toISOString();

const HONORIFIC = /^(prof|professor|assoc|associate|asst|assistant|dr|ir|ts|mr|mrs|ms|miss|madam|sir|dato'?|datuk|tan sri|emeritus)\.?$/i;
function slugify(name) {
  const words = String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length > 1 && HONORIFIC.test(words[0])) words.shift();
  return words.join('-').toLowerCase().slice(0, 60) || 'speaker';
}
function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name); let s = base, i = 2;
  while (db.prepare('SELECT 1 FROM speakers WHERE slug=? AND id<>?').get(s, exceptId)) s = `${base}-${i++}`;
  return s;
}

// ── queries ─────────────────────────────────────────────
const ORDER = "ORDER BY (role='Guest of Honour') DESC, featured DESC, sort ASC, id ASC";
const all = () => db.prepare(`SELECT * FROM speakers ${ORDER}`).all();
const published = () => db.prepare(`SELECT * FROM speakers WHERE published=1 ${ORDER}`).all();
const byId = (id) => db.prepare('SELECT * FROM speakers WHERE id=?').get(id);
const bySlug = (s) => db.prepare('SELECT * FROM speakers WHERE slug=?').get(String(s));
const byEmailKey = (k) => db.prepare('SELECT * FROM speakers WHERE email_key=?').get(k);
const photoFile = (id) => path.join(PHOTO_DIR, `${Number(id)}.jpg`);
const photoUrl = (s) => (s.photo_ver ? `${cfg.base}/speakers/photo/${s.id}.jpg?v=${s.photo_ver}` : '');

// what a speaker still has to fill in (drives the checklist in the portal and the admin overview)
function checklist(s) {
  return [
    ['Photo', !!s.photo_ver], ['Talk title', !!s.talk_title.trim()], ['Abstract', s.abstract.trim().length >= 200],
    ['About you', s.bio.trim().length >= 120], ['Affiliation', !!s.affiliation.trim()],
  ];
}
const completeness = (s) => { const c = checklist(s); return Math.round((100 * c.filter((x) => x[1]).length) / c.length); };

// (no seeded speakers: add keynote / plenary / invited speakers from Admin → Speakers)

// ── validation ──────────────────────────────────────────
const clean = (v, max, multiline) => {
  let s = String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  s = multiline ? s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : s.replace(/\s+/g, ' ').trim();
  return s.slice(0, max);
};
function validate(b, { admin = false } = {}) {
  const v = {
    full_name: clean(b.full_name, LIMITS.full_name), position: clean(b.position, LIMITS.position, true),
    affiliation: clean(b.affiliation, LIMITS.affiliation), country: clean(b.country, LIMITS.country),
    talk_title: clean(b.talk_title, LIMITS.talk_title), abstract: clean(b.abstract, LIMITS.abstract, true),
    bio: clean(b.bio, LIMITS.bio, true), website: clean(b.website, LIMITS.website),
  };
  const errors = [];
  if (v.full_name.length < 3) errors.push('Please enter your full name as it should appear on the programme.');
  if (v.position.split('\n').length > 4) errors.push('Please keep your position to at most four lines.');
  if (v.website) {
    if (!/^https?:\/\//i.test(v.website)) v.website = 'https://' + v.website;
    try { const u = new URL(v.website); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw 0; v.website = u.href; }
    catch (_) { errors.push('The website address does not look right.'); }
  }
  for (const k of ['abstract', 'bio']) if (String(b[k] || '').length > LIMITS[k]) errors.push(`The ${k === 'bio' ? 'biography' : 'abstract'} is longer than ${LIMITS[k].toLocaleString('en-US')} characters; please shorten it.`);
  if (admin) {
    v.email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.push('Please enter a valid email address for the speaker.');
    v.email_key = v.email ? normaliseEmail(v.email) : null;
    v.role = ROLES.includes(b.role) ? b.role : 'Invited Speaker';
    const sd = String(b.slot_date || '').trim(), ss = String(b.slot_start || '').trim(), se = String(b.slot_end || '').trim(), T = /^([01]\d|2[0-3]):[0-5]\d$/;
    v.slot_date = sd; v.slot_start = ss; v.slot_end = se;
    if (sd || ss || se) {
      if (!(cfg.eventDays || []).includes(sd)) errors.push('Talk date: please choose one of the event days.');
      if (!T.test(ss)) errors.push('Talk start time: please enter a time such as 10:00.');
      if (se && !T.test(se)) errors.push('Talk end time: please enter a time such as 10:45.');
      else if (se && T.test(ss) && se <= ss) errors.push('The talk must end after it starts.');
    }
    v.sort = Math.max(0, Math.min(9999, parseInt(b.sort, 10) || 100));
    v.featured = (b.featured || v.role === 'Guest of Honour') ? 1 : 0;   // a Guest of Honour is always shown large, with talk and abstract
    v.published = b.published ? 1 : 0;
    v.auto_pub = v.published;            // an organiser who hides a speaker keeps them hidden; otherwise the speaker's first save publishes
  }
  return { v, errors };
}

function save(id, v, by) {
  if (by === 'speaker') { const cur = byId(id); if (cur && cur.auto_pub && !cur.published) v = { ...v, published: 1 }; }
  const cols = Object.keys(v);
  db.prepare(`UPDATE speakers SET ${cols.map((c) => `${c}=?`).join(',')}, updated_at=?, updated_by=? WHERE id=?`).run(...cols.map((c) => v[c]), nowIso(), by, id);
}
function create(v) {
  const t = nowIso();
  const info = db.prepare(`INSERT INTO speakers (slug,full_name,email,email_key,role,sort,featured,published,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,'admin')`)
    .run(uniqueSlug(v.full_name), v.full_name, v.email || null, v.email_key || null, v.role, v.sort, v.featured, 0, t, t);   // hidden until a profile is saved
  return Number(info.lastInsertRowid);
}

// JPEG data-URL → stored portrait (browser already cropped it to 4:5 and resized it)
function savePhoto(id, dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return 'Please choose a JPEG or PNG photo.';
  const buf = Buffer.from(m[1], 'base64');
  if (!buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'That file is not a valid image.';
  if (buf.length > 2 * 1024 * 1024) return 'The photo is too large.';
  fs.writeFileSync(photoFile(id), buf);
  db.prepare('UPDATE speakers SET photo_ver=?, updated_at=? WHERE id=?').run(Date.now() % 1e9, nowIso(), id);
  return '';
}
function removePhoto(id) {
  try { fs.unlinkSync(photoFile(id)); } catch (_) { /* already gone */ }
  db.prepare('UPDATE speakers SET photo_ver=0, updated_at=? WHERE id=?').run(nowIso(), id);
}
function remove(id) { removePhoto(id); db.prepare('DELETE FROM speakers WHERE id=?').run(id); }

// ── accounts: invitation, password, sign-in throttling ───
const INVITE_DAYS = 14, MAX_FAILS = 6, MAX_FAILS_IP = 40, FAIL_WINDOW = 15 * 60, LOCK_SECONDS = 15 * 60;
const nowS = () => Math.floor(Date.now() / 1000);
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);          // compared against when the address is unknown (same timing)
// not invited | invited | active | declined
const state = (s) => (s.declined_at && !s.pw_hash ? 'declined' : s.pw_hash ? 'active' : s.invited_at ? 'invited' : 'new');

function issueInvite(id) {                                                 // new link each time; older links stop working
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE speakers SET invite_hash=?, invite_exp=?, invited_at=?, declined_at=NULL WHERE id=?').run(sha(token), nowS() + INVITE_DAYS * 86400, new Date().toISOString(), id);
  return token;
}
function byInvite(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  const s = db.prepare('SELECT * FROM speakers WHERE invite_hash=?').get(sha(token));
  return s && s.invite_exp > nowS() ? s : null;
}
const COMMON = new Set(['password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou12', 'letmein1234', 'welcome1234', 'symposium', 'speaker1234']);
function checkPassword(pw, s) {
  pw = String(pw || '');
  if (pw.length < 10) return 'Please choose a password of at least 10 characters.';
  if (pw.length > 128) return 'That password is too long (128 characters at most).';
  const low = pw.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(pw)) return 'That password is too easy to guess. Please choose another.';
  if (s && s.email && (low === s.email.toLowerCase() || low.includes(s.email.split('@')[0].toLowerCase()) && s.email.split('@')[0].length > 4)) return 'Your password should not contain your email address.';
  return '';
}
async function setPassword(id, pw) {
  const h = await bcrypt.hash(pw, 11), t = new Date().toISOString();
  db.prepare('UPDATE speakers SET pw_hash=?, pw_set_at=?, accepted_at=COALESCE(accepted_at,?), declined_at=NULL, invite_hash=NULL, invite_exp=NULL WHERE id=?').run(h, t, t, id);
}
const decline = (id) => db.prepare('UPDATE speakers SET declined_at=?, invite_hash=NULL, invite_exp=NULL WHERE id=? AND pw_hash IS NULL').run(new Date().toISOString(), id);
async function verifyPassword(s, pw) {
  const ok = await bcrypt.compare(String(pw || '').slice(0, 128), s && s.pw_hash ? s.pw_hash : DUMMY_HASH);
  return !!(s && s.pw_hash && ok);
}
// failed sign-ins: lock a key (email or connection) for 15 minutes after 6 misses in 15 minutes
function locked(keys) {
  const t = nowS();
  for (const k of keys) { const r = db.prepare('SELECT * FROM speaker_fails WHERE k=?').get(k); if (r && r.until > t) return r.until - t; }
  return 0;
}
function fail(keys) {
  const t = nowS();
  for (const k of keys) {
    const r = db.prepare('SELECT * FROM speaker_fails WHERE k=?').get(k);
    if (!r || t - r.first_ts > FAIL_WINDOW) db.prepare('INSERT OR REPLACE INTO speaker_fails (k,n,first_ts,until) VALUES (?,1,?,0)').run(k, t);
    else db.prepare('UPDATE speaker_fails SET n=n+1, until=? WHERE k=?').run(r.n + 1 >= (k[0] === 'i' ? MAX_FAILS_IP : MAX_FAILS) ? t + LOCK_SECONDS : 0, k);
  }
}
const clearFails = (keys) => keys.forEach((k) => db.prepare('DELETE FROM speaker_fails WHERE k=?').run(k));
setInterval(() => db.prepare('DELETE FROM speaker_fails WHERE until<? AND first_ts<?').run(nowS(), nowS() - FAIL_WINDOW), 600000).unref();

// ── talk schedule ───────────────────────────────────────
const hasSlot = (s) => !!(s.slot_date && s.slot_start);
const timeText = (s) => (s.slot_start ? (s.slot_end ? `${s.slot_start} – ${s.slot_end}` : s.slot_start) : '');
const slotKey = (s) => [s.slot_date || '', s.slot_start || '', s.slot_end || ''].join('|');
const slotText = (s) => (hasSlot(s) ? `${cfg.eventDayLabel(s.slot_date)} · ${timeText(s)}` : '');
const slotShort = (s) => { if (!hasSlot(s)) return s.slot || ''; const d = new Date(s.slot_date + 'T00:00:00Z'); return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${timeText(s)}`; };
const markSlotSent = (id, s) => db.prepare('UPDATE speakers SET slot_sent=?, slot_sent_at=?, slot_mail_err=NULL WHERE id=?').run(slotKey(s), nowIso(), id);
const markSlotFail = (id, msg) => db.prepare('UPDATE speakers SET slot_mail_err=? WHERE id=?').run(String(msg).slice(0, 200), id);

module.exports = {
  hasSlot, timeText, slotKey, slotText, slotShort, markSlotSent, markSlotFail,
  issueInvite, byInvite, checkPassword, setPassword, decline, verifyPassword, locked, fail, clearFails, state, INVITE_DAYS,
  ROLES, LIMITS, all, published, byId, bySlug, byEmailKey, photoFile, photoUrl, checklist, completeness,
  validate, save, create, savePhoto, removePhoto, remove, uniqueSlug, maskEmail, normaliseEmail,
};
