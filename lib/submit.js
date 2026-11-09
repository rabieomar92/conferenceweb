'use strict';
// Submission stages for oral and poster presenters:
//   1. abstract (typed on the website)   2. extended abstract (uploaded file)   3. full paper (uploaded file)
// Each stage is switched on/off, required/optional and given a deadline in Admin → Settings → Submissions.
// Stage 2 and 3 use the organisers' template (a .docx uploaded in Settings), which authors fill in and upload back.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('../config');
const AU = require('./authors');

const { dir: DATA } = require('./db');
const DIR = path.join(DATA, 'papers'), TPL = path.join(DATA, 'templates');
for (const d of [DIR, TPL]) fs.mkdirSync(d, { recursive: true });

const now = () => Date.now();
const closed = (iso) => !!iso && Date.parse(iso) < now();
const STATUS = { '': 'Not reviewed yet', accepted: 'Accepted', revise: 'Revision requested', rejected: 'Not accepted' };
function stages() {
  return [
    { id: 'abs', n: 1, name: 'Abstract', on: cfg.subAbstract !== false, req: true, deadline: cfg.absDeadline || '', what: `${cfg.absMin ? cfg.absMin + '–' : 'up to '}${cfg.absMax || 300} words` },
    { id: 'ext', n: 2, name: 'Extended abstract', on: !!cfg.subExtended, req: !!cfg.extRequired, deadline: cfg.extDeadline || '', what: cfg.extPages || '', tpl: template('ext') },
    { id: 'fp', n: 3, name: 'Full paper', on: !!cfg.subFull, req: !!cfg.fullRequired, deadline: cfg.fullDeadline || '', what: cfg.fullPages || '', tpl: template('fp') },
  ].filter((s) => s.on).map((s, i) => ({ ...s, n: i + 1, closed: closed(s.deadline) }));
}
const anyOn = () => stages().length > 0;

// ── words: an equation counts as one word ──
const words = (t) => String(t || '').replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g, ' x ').trim().split(/\s+/).filter(Boolean).length;

// ── abstract ──
function absChecklist(r, name) {
  const au = AU.read(r, name); const n = words(r.abstract);
  return [
    ['Abstract title', !!(r.paper_title || '').trim()],
    ['Authors and affiliations', AU.filled(au)],
    [`Abstract (${cfg.absMin ? cfg.absMin + '–' : ''}${cfg.absMax} words)`, n >= (cfg.absMin || 1) && n <= (cfg.absMax || 99999)],
  ];
}
function validateAbstract(b, { mathCheck } = {}) {
  const line = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const multi = (s, n) => String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  const v = { paper_title: line(b.paper_title, 300), abstract: multi(b.abstract, 12000), keywords: line(b.keywords, 300) }, errors = [];
  const au = AU.validate(b.authors); v.authors = JSON.stringify(au.value); v.coauthors = AU.plain(au.value).slice(0, 2000);
  if (!v.paper_title) errors.push('Please enter the title.');
  errors.push(...au.errors);
  const n = words(v.abstract);
  if (v.abstract && cfg.absMax && n > cfg.absMax) errors.push(`The abstract has ${n} words; the limit is ${cfg.absMax}. Please shorten it.`);
  if (mathCheck) errors.push(...mathCheck(v.abstract, v.paper_title));
  return { v, errors, words: n };
}

// ── uploaded files (extended abstract, full paper) ──
const KINDS = { pdf: { mime: 'application/pdf', magic: (b) => b.slice(0, 5).toString() === '%PDF-' }, docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: (b) => b[0] === 0x50 && b[1] === 0x4b } };
function kindOf(name, buf) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  if (!KINDS[ext]) return null;
  return KINDS[ext].magic(buf) ? ext : null;
}
const safeName = (s) => String(s || 'file').replace(/[^\w.\- ()]+/g, '_').replace(/\s+/g, ' ').slice(-120);
function saveFile(regId, stage, name, buf) {
  const ext = kindOf(name, buf); if (!ext) return { error: 'Please upload a PDF (.pdf) or Word (.docx) file.' };
  const max = (cfg.maxUploadMB || 10) * 1024 * 1024; if (buf.length > max) return { error: `The file is larger than ${cfg.maxUploadMB || 10} MB.` };
  const file = `${regId}-${stage}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(DIR, file), buf);
  return { file, name: safeName(name) };
}
const filePath = (file) => (file && /^[\w.-]+$/.test(file) ? path.join(DIR, file) : null);
function removeFile(file) { const p = filePath(file); if (p) fs.rm(p, { force: true }, () => {}); }
const mimeOf = (file) => (KINDS[String(file).split('.').pop()] || {}).mime || 'application/octet-stream';

// ── organisers' templates (one per stage, .docx or .pdf) ──
function template(stage) {
  const meta = path.join(TPL, stage + '.json');
  try { const j = JSON.parse(fs.readFileSync(meta, 'utf8')); return fs.existsSync(path.join(TPL, j.file)) ? j : null; } catch (_) { return null; }
}
function saveTemplate(stage, name, buf) {
  if (!['ext', 'fp'].includes(stage)) return { error: 'Unknown stage.' };
  const ext = String(name || '').toLowerCase().split('.').pop();
  if (!['docx', 'doc', 'dotx', 'pdf', 'zip', 'tex'].includes(ext)) return { error: 'Upload the template as .docx (Word), .dotx, .doc, .pdf, .tex or .zip.' };
  if (buf.length > 25 * 1024 * 1024) return { error: 'The template is larger than 25 MB.' };
  const old = template(stage); if (old) fs.rm(path.join(TPL, old.file), { force: true }, () => {});
  const file = `${stage}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(TPL, file), buf);
  const meta = { file, name: safeName(name), size: buf.length, at: new Date().toISOString() };
  fs.writeFileSync(path.join(TPL, stage + '.json'), JSON.stringify(meta));
  return meta;
}
function removeTemplate(stage) { const t = template(stage); if (t) fs.rm(path.join(TPL, t.file), { force: true }, () => {}); fs.rm(path.join(TPL, stage + '.json'), { force: true }, () => {}); }
const templatePath = (t) => (t ? path.join(TPL, t.file) : null);

// what the presenter still has to do, per stage
function state(r, name) {
  return stages().map((s) => {
    const done = s.id === 'abs' ? absChecklist(r, name).every((x) => x[1]) : !!r[s.id + '_file'];
    return { ...s, done, at: s.id === 'abs' ? r.pres_at : r[s.id + '_at'], status: r[s.id + '_status'] || '', file: s.id === 'abs' ? null : r[s.id + '_file'], fileName: s.id === 'abs' ? null : r[s.id + '_name'] };
  });
}
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

module.exports = { stages, anyOn, state, words, absChecklist, validateAbstract, saveFile, filePath, removeFile, mimeOf, template, saveTemplate, removeTemplate, templatePath, STATUS, closed, fmtSize };
