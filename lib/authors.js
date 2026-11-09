'use strict';
// Authors and affiliations of an abstract, stored as JSON:
//   { a: [{ n: name, e: email, f: [affiliation numbers, 1-based], p: presenting (1/0), c: corresponding (1/0) }], f: [affiliation text, …] }
// Older records kept free text ("A. Rahman (USM)" per line); those are read and converted on the fly.
const MAX_AUTH = 30, MAX_AFF = 15;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function fromLegacy(text, fallbackName) {
  const lines = String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const f = [], a = [];
  for (const l of lines) {
    const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(l); const name = clean(m ? m[1] : l, 120), aff = m ? clean(m[2], 250) : '';
    let k = aff ? f.indexOf(aff) : -1; if (aff && k < 0) { f.push(aff); k = f.length - 1; }
    if (name) a.push({ n: name, e: '', f: k >= 0 ? [k + 1] : [], p: a.length ? 0 : 1, c: 0 });
  }
  if (!a.length && fallbackName) a.push({ n: fallbackName, e: '', f: [], p: 1, c: 0 });
  return { a, f };
}
// the record's authors, whatever format it was saved in
function read(rec, fallbackName) {
  if (rec && rec.authors) { try { const j = JSON.parse(rec.authors); if (j && Array.isArray(j.a)) return { a: j.a, f: Array.isArray(j.f) ? j.f : [] }; } catch (_) { /* fall through */ } }
  return fromLegacy(rec && rec.coauthors, fallbackName);
}
// validate what the browser sent (JSON text); returns { value, errors }
function validate(raw) {
  const errors = []; let j;
  try { j = JSON.parse(String(raw || '{}')); } catch (_) { return { value: { a: [], f: [] }, errors: ['The author list could not be read. Please reload the page and try again.'] }; }
  const affIn = (Array.isArray(j.f) ? j.f : []).slice(0, MAX_AFF).map((x) => clean(x, 250));
  const a = (Array.isArray(j.a) ? j.a : []).slice(0, MAX_AUTH).map((x) => ({
    n: clean(x && x.n, 120), e: clean(x && x.e, 160).toLowerCase(),
    f: [...new Set((Array.isArray(x && x.f) ? x.f : []).map((k) => parseInt(k, 10)).filter((k) => k >= 1 && k <= affIn.length && affIn[k - 1]))],
    p: x && x.p ? 1 : 0, c: x && x.c ? 1 : 0,
  })).filter((x) => x.n);
  if ((Array.isArray(j.a) ? j.a.length : 0) > MAX_AUTH) errors.push(`At most ${MAX_AUTH} authors.`);
  if (!a.length) errors.push('Please add at least one author (yourself).');
  if (a.length && !a.some((x) => x.p)) a[0].p = 1;
  if (a.filter((x) => x.p).length > 1) { let seen = false; a.forEach((x) => { if (x.p) { if (seen) x.p = 0; seen = true; } }); }
  a.forEach((x) => { if (x.e && !EMAIL_RE.test(x.e)) errors.push(`The email address of ${x.n} does not look right.`); if (x.c && !x.e) errors.push(`Please add an email address for ${x.n}, the corresponding author.`); });
  a.filter((x) => !x.f.length).forEach((x) => errors.push(`Please choose at least one affiliation for ${x.n}.`));
  // keep only affiliations that are used, numbered in order of first appearance (as in a paper)
  const order = []; a.forEach((x) => x.f.forEach((k) => { if (!order.includes(k)) order.push(k); }));
  const f = order.map((k) => affIn[k - 1]);
  a.forEach((x) => { x.f = x.f.map((k) => order.indexOf(k) + 1).sort((p, q) => p - q); });
  return { value: { a, f }, errors };
}
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', ',': '˒', '*': '*' };
const sup = (s) => String(s).split('').map((c) => SUP[c] || c).join('');
// "A. Rahman¹*, B. Lee²" — one line of text
const line = (v) => (v.a || []).map((x) => x.n + sup((x.f || []).join(',') + (x.c ? '*' : ''))).join(', ');
// for CSV / plain listings
const plain = (v) => (v.a || []).map((x) => `${x.n}${x.p ? ' (presenting)' : ''}${x.f && x.f.length ? ' [' + x.f.join(',') + ']' : ''}`).join('; ') + ((v.f || []).length ? ' — ' + v.f.map((t, i) => `[${i + 1}] ${t}`).join('; ') : '');
const filled = (v) => !!(v && v.a && v.a.length && v.a.every((x) => x.n && x.f && x.f.length));

module.exports = { read, validate, line, plain, filled, fromLegacy, MAX_AUTH, MAX_AFF };
