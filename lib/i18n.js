'use strict';
// Bahasa Melayu / English. Pages are written in English; for Malay visitors the finished HTML is translated
// fragment by fragment (text between tags, plus placeholder / aria-label / title / alt / meta content),
// using the dictionary in i18n-ms.js. Anything not in the dictionary (names, titles typed by people) stays as it is.
// The language comes from ?lang=ms|en (remembered in a cookie), then the cookie, then the browser's language.
const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();
const { exact, patterns, client } = require('./i18n-ms');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const EXACT = new Map(Object.entries(exact).map(([k, v]) => [norm(k), v]));

function lang() { const s = als.getStore(); return (s && s.lang) || 'en'; }
const isMs = () => lang() === 'ms';

function pick(req) {
  const q = String(req.query.lang || '').toLowerCase();
  if (q === 'ms' || q === 'en') return { lang: q, set: true };
  const m = /(?:^|;\s*)lang=(ms|en)\b/.exec(req.headers.cookie || '');
  if (m) return { lang: m[1], set: false };
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  return { lang: /^(ms|id)\b/.test(al) ? 'ms' : 'en', set: false };
}
function middleware(req, res, next) {
  const { lang: l, set } = pick(req);
  if (set) res.append('Set-Cookie', `lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax`);
  res.vary('Accept-Language'); res.vary('Cookie');
  als.run({ lang: l }, next);
}

function word(s) {                                                  // one fragment: exact entry, else a pattern, else unchanged
  const k = norm(s); if (!k) return s;
  let out = EXACT.get(k);
  if (out === undefined) for (const [re, rep] of patterns) { if (re.test(k)) { out = k.replace(re, rep); break; } }
  if (out === undefined) return s;
  const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
  return lead + out + trail;
}
const ATTR = /\b(placeholder|aria-label|title|alt|content|data-confirm|data-label)="([^"]*)"/g;
function translate(html) {
  if (!isMs()) return html;
  return html.replace(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->|<textarea\b[\s\S]*?<\/textarea>)|(<[^>]+>)|([^<]+)/g, (m, raw, tag, text) => {
    if (raw) return raw.startsWith('<textarea') ? raw.replace(ATTR, (a, n, v) => `${n}="${word(v)}"`) : raw;
    if (tag) return /^<(input|img|a|button|meta|textarea|select|span|label|div|svg|nav|section|form|dialog|article|abbr|time|figure|ul|li|p)\b/i.test(tag) ? tag.replace(ATTR, (a, n, v) => (n === 'content' && !/<meta\b/i.test(tag) ? a : `${n}="${word(v)}"`)) : tag;
    return word(text);
  }).replace(/<html lang="en">/, '<html lang="ms">');
}
// strings used by page scripts (alerts, live messages): exposed as window.T on Malay pages
function clientDict() { return isMs() ? `<script>window.T=${JSON.stringify(client).replace(/</g, '\\u003c')};</script>` : '<script>window.T={};</script>'; }
// header switch: shows the other language, keeps the current page
function switcher(req) {
  const u = new URL(req.originalUrl, 'http://x'); const other = isMs() ? 'en' : 'ms'; u.searchParams.set('lang', other);
  return `<a class="n-lang" href="${u.pathname}${u.search}" hreflang="${other}" lang="${other}" title="${other === 'ms' ? 'Bahasa Melayu' : 'English'}"><span${isMs() ? '' : ' class="on"'}>EN</span><i>/</i><span${isMs() ? ' class="on"' : ''}>BM</span></a>`;
}
// for text built in code (flash messages, validation errors): same dictionary
const t = (s) => (isMs() ? word(s) : s);

module.exports = { middleware, translate, lang, isMs, t, switcher, clientDict, als };
