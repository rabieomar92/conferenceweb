'use strict';
// Canonical list of institutions and countries (used to keep names consistent across registrations).
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const file = path.join(__dirname, '..', 'public', 'assets', 'institutions.json');
const raw = fs.readFileSync(file);
const data = JSON.parse(raw.toString('utf8'));
const countries = data.countries;
const countrySet = new Set(countries);
const byLower = new Map();                                   // lower-case name -> [{ name, country }]
for (const [name, ci] of data.items) {
  const k = name.toLowerCase();
  (byLower.get(k) || byLower.set(k, []).get(k)).push({ name, country: ci >= 0 ? countries[ci] : '' });
}
const gz = zlib.gzipSync(raw, { level: 9 });
function lookup(text, country) {
  const hits = byLower.get(String(text).replace(/\s+/g, ' ').trim().toLowerCase());
  if (!hits) return null;
  return hits.find((h) => h.country === country) || hits[0];
}
function serve(req, res) {
  res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400', Vary: 'Accept-Encoding' });
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return res.set('Content-Encoding', 'gzip').send(gz);
  res.send(raw);
}
module.exports = { countries, countrySet, lookup, serve, count: data.items.length };
