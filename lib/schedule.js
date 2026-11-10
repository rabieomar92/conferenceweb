'use strict';
// Venues and the conference schedule.
//   venues      — rooms the organisers set up in Admin → Programme (a talk without one shows "To be confirmed")
//   talks       — invited speakers (speakers table) and oral presenters (registrations table) each carry
//                 slot_date / slot_start / slot_end / slot_venue / slot_code and slot_ok (shown on the website)
//   prog_items  — everything else on the programme: registration, breaks, ceremonies, plenaries, technical sessions
// The public programme is built from what has been confirmed (slot_ok / ok = 1) and has a date and a start time.
const cfg = require('../config');
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS venues (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 100, created_at TEXT);
CREATE TABLE IF NOT EXISTS prog_items (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'other', title TEXT NOT NULL, who TEXT NOT NULL DEFAULT '',
  slot_date TEXT, slot_start TEXT, slot_end TEXT, slot_venue INTEGER, ok INTEGER NOT NULL DEFAULT 0, updated_at TEXT);`);
for (const t of ['speakers', 'registrations']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  for (const [c, ty] of [['slot_date', 'TEXT'], ['slot_start', 'TEXT'], ['slot_end', 'TEXT'], ['slot_venue', 'INTEGER'], ['slot_code', 'TEXT'], ['slot_ok', 'INTEGER NOT NULL DEFAULT 0'], ['slot_sent_at', 'TEXT']])
    if (!cols.includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${ty}`);
}
// first run: the rooms of the draft programme, so the organisers start from something
if (!db.prepare('SELECT 1 FROM venues LIMIT 1').get()) {
  const ins = db.prepare('INSERT INTO venues (name, details, sort, created_at) VALUES (?,?,?,?)');
  ['Ballroom', 'Hibiscus 1', 'Hibiscus 2', 'Hibiscus 5'].forEach((n, i) => ins.run(n, '', (i + 1) * 10, new Date().toISOString()));
}

// titles may hold LaTeX ($\mathrm{TiO_2}$); the programme shows them as plain text (TiO₂)
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', x: 'ₓ' }, SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ' };
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Omega: 'Ω', Sigma: 'Σ', Phi: 'Φ', times: '×', pm: '±', deg: '°', circ: '°', approx: '≈', le: '≤', ge: '≥', infty: '∞' };
const map = (t, m) => (String(t).split('').every((c) => m[c]) ? String(t).split('').map((c) => m[c]).join('') : null);
function plainTex(s) {
  return String(s || '').replace(/\$\$?([^$]+)\$\$?/g, (all, m) => m
    .replace(/\\(?:mathrm|text|textrm|mathit|mathbf|textit|textbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, (a, w) => GREEK[w] || (w === ',' ? ' ' : ''))
    .replace(/_\{([^{}]*)\}|_(\w)/g, (a, x, y) => map(x || y, SUB) || (x || y))
    .replace(/\^\{([^{}]*)\}|\^(\w|[+-])/g, (a, x, y) => map(x || y, SUP) || '^' + (x || y))
    .replace(/[{}]/g, '').replace(/\\,/g, ' ').replace(/\s+/g, ' ').trim());
}

const TBC = 'To be confirmed';
const KINDS = [['session', 'Session in a room (e.g. technical session, poster session)'], ['plenary', 'Plenary / keynote (everyone)'], ['ceremony', 'Ceremony or dinner'], ['break', 'Break or meal'], ['reg', 'Registration'], ['other', 'Other']];
const KIND_KEYS = KINDS.map((k) => k[0]);
const FULL_ROLES = ['Guest of Honour', 'Keynote Speaker'];               // these speakers get a full-width block of their own

// ── venues ──
const venues = () => db.prepare('SELECT * FROM venues ORDER BY sort, id').all();
const venueById = (id) => (id ? db.prepare('SELECT * FROM venues WHERE id=?').get(id) : null);
const venueName = (id) => { const v = venueById(id); return v ? v.name : TBC; };
function saveVenue(id, b) {
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80), details = String(b.details || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const sort = Math.max(0, Math.min(9999, parseInt(b.sort, 10) || 100));
  if (!name) return { error: 'Please give the venue a name.' };
  const dup = db.prepare('SELECT id FROM venues WHERE lower(name)=lower(?) AND id<>?').get(name, id || 0);
  if (dup) return { error: `There is already a venue called “${name}”.` };
  if (id) db.prepare('UPDATE venues SET name=?, details=?, sort=? WHERE id=?').run(name, details, sort, id);
  else id = db.prepare('INSERT INTO venues (name, details, sort, created_at) VALUES (?,?,?,?)').run(name, details, sort, new Date().toISOString()).lastInsertRowid;
  return { id };
}
function deleteVenue(id) {          // anything scheduled there goes back to "To be confirmed"
  const n = ['speakers', 'registrations', 'prog_items'].reduce((a, t) => a + db.prepare(`UPDATE ${t} SET slot_venue=NULL WHERE slot_venue=?`).run(id).changes, 0);
  db.prepare('DELETE FROM venues WHERE id=?').run(id);
  return n;
}
const venueUse = () => { const m = {}; for (const t of ['speakers', 'registrations', 'prog_items']) for (const r of db.prepare(`SELECT slot_venue v, COUNT(*) n FROM ${t} WHERE slot_venue IS NOT NULL GROUP BY slot_venue`).all()) m[r.v] = (m[r.v] || 0) + r.n; return m; };

// ── one slot (talk or item): validate what the organiser typed ──
const T = /^([01]\d|2[0-3]):[0-5]\d$/;
function readSlot(b) {
  const v = { slot_date: String(b.slot_date || '').trim(), slot_start: String(b.slot_start || '').trim(), slot_end: String(b.slot_end || '').trim(), slot_code: String(b.slot_code || '').replace(/\s+/g, ' ').trim().slice(0, 24) };
  const vid = parseInt(b.slot_venue, 10); v.slot_venue = vid && venueById(vid) ? vid : null;
  v.slot_ok = b.slot_ok === '1' ? 1 : 0;
  const errors = [];
  if (v.slot_date && !(cfg.eventDays || []).includes(v.slot_date)) errors.push('Please choose one of the conference days.');
  if (v.slot_start && !T.test(v.slot_start)) errors.push('Please enter the start time like 09:30.');
  if (v.slot_end && !T.test(v.slot_end)) errors.push('Please enter the end time like 09:50.');
  if (T.test(v.slot_start) && T.test(v.slot_end) && v.slot_end <= v.slot_start) errors.push('The end time must be after the start time.');
  if (v.slot_end && !v.slot_start) errors.push('Please enter a start time as well.');
  if (v.slot_ok && !(v.slot_date && v.slot_start)) errors.push('To show it on the website, set the day and the start time first. The venue can stay “To be confirmed”.');
  if (!v.slot_date) { v.slot_start = ''; v.slot_end = ''; }
  return { v, errors };
}

// ── everything that can sit on the programme, as one list ──
const isOral = "participation LIKE 'Oral%'";
function entries() {
  const spk = db.prepare(`SELECT id, full_name, affiliation org, role, talk_title title, slot_date, slot_start, slot_end, slot_venue, slot_code, slot_ok, slot_sent_at, email, published FROM speakers WHERE COALESCE(declined_at,'')=''`).all()
    .map((r) => ({ ...r, type: 'spk', key: 'spk-' + r.id, kind: FULL_ROLES.includes(r.role) ? 'plenary' : 'talk', who: r.full_name, label: r.role }));
  const reg = db.prepare(`SELECT id, ref, full_name, organisation org, paper_title title, abs_status, slot_date, slot_start, slot_end, slot_venue, slot_code, slot_ok, slot_sent_at, email FROM registrations WHERE ${isOral} AND cancelled_at IS NULL AND COALESCE(abs_status,'')<>'rejected'`).all()
    .map((r) => ({ ...r, type: 'reg', key: 'reg-' + r.id, kind: 'talk', who: r.full_name, label: 'Oral presenter' }));
  const it = db.prepare('SELECT id, kind, title, who, slot_date, slot_start, slot_end, slot_venue, ok slot_ok FROM prog_items').all()
    .map((r) => ({ ...r, type: 'item', key: 'item-' + r.id, label: (KINDS.find((k) => k[0] === r.kind) || KINDS[5])[1].replace(/ \(.*/, '') }));
  return [...spk, ...reg, ...it];
}
const scheduled = (x) => !!(x.slot_date && x.slot_start);
const endOf = (x) => x.slot_end || x.slot_start;
// two things in the same room at the same time
function clashes(list) {
  const out = new Map(); const by = {};
  for (const x of list) if (scheduled(x) && x.slot_venue) (by[x.slot_date + '|' + x.slot_venue] = by[x.slot_date + '|' + x.slot_venue] || []).push(x);
  for (const g of Object.values(by)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j];
    if (a.slot_start < (b.slot_end || addMin(b.slot_start, 1)) && b.slot_start < (a.slot_end || addMin(a.slot_start, 1))) { out.set(a.key, b); out.set(b.key, a); }
  }
  return out;
}
const addMin = (t, m) => { const [h, mi] = t.split(':').map(Number); const n = h * 60 + mi + m; return String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };

// ── the public programme: for each day, full-width blocks and, between them, talks grouped by room ──
function publicDays() {
  const list = entries().filter((x) => x.slot_ok && scheduled(x) && (x.type !== 'spk' || x.published));
  if (!list.length) return null;
  const vs = venues(); const vName = (id) => (vs.find((v) => v.id === id) || {}).name || TBC;
  const order = (id) => { const i = vs.findIndex((v) => v.id === id); return i < 0 ? 1e6 : i; };
  return (cfg.eventDays || []).map((day) => {
    const xs = list.filter((x) => x.slot_date === day).sort((a, b) => a.slot_start.localeCompare(b.slot_start) || (a.kind === 'talk') - (b.kind === 'talk'));
    const blocks = []; let grp = null;
    const flush = () => { if (!grp) return; const cols = [...new Set(grp.map((x) => x.slot_venue || 0))].sort((a, b) => order(a || null) - order(b || null));
      blocks.push({ kind: 'parallel', time: [grp.reduce((m, x) => (x.slot_start < m ? x.slot_start : m), '99:99'), grp.reduce((m, x) => (endOf(x) > m ? endOf(x) : m), '')],
        title: cols.length > 1 ? 'Parallel sessions' : 'Session', rooms: cols.map((c) => ({ name: c ? vName(c) : TBC, tbc: !c, talks: grp.filter((x) => (x.slot_venue || 0) === c).sort((a, b) => a.slot_start.localeCompare(b.slot_start)) })) }); grp = null; };
    for (const x of xs) {
      const inRoom = x.kind === 'talk' || (x.kind === 'session' && x.slot_venue);
      if (inRoom) (grp = grp || []).push(x);
      else { flush(); blocks.push({ kind: x.kind === 'plenary' ? 'plenary' : x.kind, time: [x.slot_start, x.slot_end], title: x.type === 'item' ? x.title : (plainTex(x.title) || x.label), who: x.type === 'item' ? x.who : `${x.who}${x.org ? ' (' + x.org + ')' : ''}`, where: x.kind === 'session' && !x.slot_venue ? '' : vName(x.slot_venue), tbc: !x.slot_venue, label: x.type === 'spk' ? x.label : '' }); }
    }
    flush();
    // a session heading without a room (e.g. "Parallel sessions 1–4") names the talks that run under it
    for (let i = blocks.length - 2; i >= 0; i--) {
      const h = blocks[i], nx = blocks[i + 1];
      if (h.kind === 'session' && h.tbc && nx.kind === 'parallel' && nx.time[0] >= h.time[0] && nx.time[0] < (h.time[1] || addMin(h.time[0], 1))) {
        nx.title = h.title; nx.who = h.who; if (h.time[1] && h.time[1] > nx.time[1]) nx.time[1] = h.time[1]; if (h.time[0] < nx.time[0]) nx.time[0] = h.time[0]; blocks.splice(i, 1);
      }
    }
    return { day, blocks };
  }).filter((d) => d.blocks.length);
}

// start from the old sample programme: its structure only (registration, breaks, ceremonies, plenaries, session headings
// and room sessions such as technical or poster sessions). The sample's talks are not copied. Imported as drafts.
function importSample() {
  const { ROOMS, DAYS } = require('./programme');
  const days = cfg.eventDays || [], vs = venues();
  const vid = (name) => { if (!name) return null; const v = vs.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); return v ? v.id : null; };
  const t = (x) => (x ? x.slice(0, 2) + ':' + x.slice(2) : null);
  const KIND = { reg: 'reg', tech: 'session', break: 'break', all: 'other', plenary: 'plenary', gala: 'ceremony' };
  const ins = db.prepare('INSERT INTO prog_items (kind, title, who, slot_date, slot_start, slot_end, slot_venue, ok, updated_at) VALUES (?,?,?,?,?,?,?,0,?)');
  const now = new Date().toISOString(); let n = 0;
  db.transaction(() => {
    DAYS.forEach((d, i) => { const day = days[i]; if (!day) return;
      for (const k of d.blocks) {
        if (k.kind === 'end') continue;
        if (k.kind === 'parallel') {
          ins.run('session', k.title, '', day, t(k.time[0]), t(k.time[1]), null, now); n++;
          k.rooms.forEach((list, r) => list.filter((x) => !x[2]).forEach((x) => { ins.run('session', x[3] && !/^(Posters|Exhibition)$/.test(x[3]) && !x[4].toLowerCase().startsWith(x[3].toLowerCase()) ? `${x[3]}: ${x[4]}` : x[4], '', day, t(x[0]), t(x[1]), vid(ROOMS[r]), now); n++; }));
        } else { ins.run(KIND[k.kind] || 'other', k.title, k.who || '', day, t(k.time[0]), t(k.time[1]), vid(k.where), now); n++; }
      }
    });
  })();
  return n;
}
// show or hide everything scheduled on one day
function publishDay(day, on) {
  let n = 0;
  for (const [tb, col] of [['speakers', 'slot_ok'], ['registrations', 'slot_ok'], ['prog_items', 'ok']]) n += db.prepare(`UPDATE ${tb} SET ${col}=? WHERE slot_date=? AND slot_start IS NOT NULL AND slot_start<>''`).run(on ? 1 : 0, day).changes;
  return n;
}

// what a presenter sees about their own slot
const mySlot = (r) => (r && scheduled(r) && r.slot_ok ? { date: r.slot_date, start: r.slot_start, end: r.slot_end, venue: venueName(r.slot_venue), tbc: !r.slot_venue, code: r.slot_code || '' } : null);

module.exports = { TBC, KINDS, KIND_KEYS, venues, venueById, venueName, saveVenue, deleteVenue, venueUse, readSlot, entries, scheduled, clashes, publicDays, mySlot, importSample, publishDay, plainTex };
