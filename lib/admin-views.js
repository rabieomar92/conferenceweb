'use strict';
const cfg = require('../config');
const { e } = require('./views');
const B = cfg.base;
const av = require('./assetv');
const MY_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const myTime = (iso) => MY_FMT.format(new Date(iso));
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const baseHead = (title, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="${B}/assets/site.css?v=${av('site.css')}"><script src="${B}/assets/loader.js?v=${av('loader.js')}"></script><script src="${B}/assets/select.js?v=${av('select.js')}" defer></script>${extra}</head><body>`;
const ADM_TABS = [['Admin', '/admin', 'Participants'], ['Payments', '/admin/payments', 'Payments'], ['Submissions', '/admin/submissions', 'Submissions'], ['Speakers', '/admin/speakers', 'Speakers'], ['Certificates', '/admin/certificates', 'Certificates'], ['Settings', '/admin/settings', 'Settings']];
const admTabs = (label) => `<nav class="admtabs" aria-label="Admin sections"><div class="wrap">${ADM_TABS.map(([k, href, t]) => `<a href="${B}${href}"${k === label ? ' aria-current="page"' : ''}>${t}</a>`).join('')}<a class="ext" href="${B}/" target="_blank">View site ↗</a></div></nav>`;
const topbar = (label, links) => `<header class="top adm-hd"><div class="wrap"><a class="brand" href="${B}/admin">${require('./views').BRAND_LOGOS()}${require('./views').LOGO} <span class="admlbl" style="font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-left:10px">${label}</span></a>
<nav>${links}<form method="post" action="${B}/admin/logout" style="display:inline"><input type="hidden" name="csrf" value="__CSRF__"><button class="pill" style="background:none;cursor:pointer;font:600 12px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;letter-spacing:.18em;text-transform:uppercase;color:var(--navy);border:1px solid var(--navy);padding:10px 20px">Sign out</button></form></nav></div></header>${admTabs(label)}`;

function login({ err, csrf }) {
  return baseHead(`Organiser login — ${cfg.eventName}`, `<style>body{display:grid;place-items:center;min-height:100vh;padding:24px}.box{width:100%;max-width:440px;background:#fff;border:1px solid var(--rule);padding:48px 44px}.box h1{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:36px;letter-spacing:-.02em;color:var(--navy);margin:12px 0 30px}.box .btn{width:100%;justify-content:space-between}.pw{width:100%;border:0;border-bottom:1px solid var(--rule);background:transparent;padding:10px 0 12px;font:400 19px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none}</style>`) + `
<form class="box f" method="post" action="${B}/admin/login" autocomplete="off">
  <span class="label">Organisers only</span><h1>Sign in</h1>
  ${err ? `<div class="err" role="alert">${e(err)}</div>` : ''}
  <input type="hidden" name="csrf" value="${e(csrf)}">
  <div class="fld"><label class="l" for="u">Username</label><input type="text" id="u" name="user" required autofocus autocomplete="username"></div>
  <div class="fld"><label class="l" for="p">Password</label><input class="pw" type="password" id="p" name="pass" required autocomplete="current-password"></div>
  <button class="btn" type="submit">Sign in <span class="arr">→</span></button>
  <p style="margin-top:22px;font-size:13px"><a href="${B}/" style="color:var(--muted)">← Back to event page</a></p>
</form></body></html>`;
}

function pager(page, pages, qs) {
  const href = (n) => `${B}/admin?${qs ? qs + '&' : ''}page=${n}`;
  const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y);
  let out = `<a class="${page <= 1 ? 'off' : ''}" href="${href(page - 1)}" rel="prev">‹ Prev</a>`, last = 0;
  for (const n of nums) {
    if (n - last > 1) out += `<span class="gap">…</span>`;
    out += n === page ? `<span class="cur" aria-current="page">${n.toLocaleString('en-US')}</span>` : `<a href="${href(n)}">${n.toLocaleString('en-US')}</a>`;
    last = n;
  }
  out += `<a class="${page >= pages ? 'off' : ''}" href="${href(page + 1)}" rel="next">Next ›</a>`;
  if (pages > 7) out += `<form method="get" action="${B}/admin">${qs ? [...new URLSearchParams(qs)].map(([k, x]) => `<input type="hidden" name="${e(k)}" value="${e(x)}">`).join('') : ''}Go to <input type="number" name="page" min="1" max="${pages}" placeholder="${page}" aria-label="Page number"> <button class="b2" style="padding:9px 14px">Go</button></form>`;
  return `<nav class="pg" aria-label="Pagination">${out}</nav>`;
}

const PAYLBL = { unpaid: 'Unpaid', claimed: 'To check', paid: 'Paid', waived: 'Waived' };
function dashboard({ rows, stats, total, page, pages, f, cats, statuses, pays = [], pers, qs, csrf, flash = null }) {
  const n = (x) => Number(x).toLocaleString('en-US');
  const left = Math.max(0, cfg.seatLimit - stats.total);
    const css = `<style>
.adm{padding:44px 0 90px}.adm h1{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:42px;letter-spacing:-.025em;color:var(--navy);margin:8px 0 30px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);background:#fff;margin-bottom:34px}
.stats div{padding:26px 28px;border-right:1px solid var(--rule)}.stats div:last-child{border:0}
.stats b{display:block;font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:44px;color:var(--navy);line-height:1}
.stats span{font-size:10px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--amber)}
.bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.bar input[type=search]{flex:1;min-width:220px;border:1px solid var(--rule);background:#fff;padding:13px 16px;font:400 15px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none}
.bar input[type=search]:focus{border-color:var(--navy)}
.b2{background:#fff;color:var(--navy);border:1px solid var(--navy);padding:12px 18px;font:700 11px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:all .2s}
.b2:hover{background:var(--navy);color:#fff}.b2.pri{background:var(--navy);color:#fff}.b2.pri:hover{background:var(--amber);border-color:var(--amber)}.b2.dng{border-color:#B91C1C;color:#B91C1C}.b2.dng:hover{background:#B91C1C;color:#fff}
.tw{overflow-x:auto;background:#fff;border:1px solid var(--rule)}
table{border-collapse:collapse;width:100%;font-size:14.5px;min-width:980px}
th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);padding:14px;border-bottom:1px solid var(--rule);white-space:nowrap}
td{padding:13px 14px;border-bottom:1px solid #EFEBE3;vertical-align:top}td:nth-child(2){white-space:nowrap}tr:hover td{background:#FBFAF7}
.tag{display:inline-block;font-size:11px;padding:3px 9px;border:1px solid var(--rule);color:var(--muted)}.tag.y{background:#EAF4EC;border-color:#BBD9C1;color:#1F6B34}.tag.c{background:#FFF9E5;border-color:#EBD493;color:#7A5A00}.tag.n{background:#FFF4EA;border-color:#F1C7A5;color:#9A3B00}
.okmsg{background:#EEF6EF;border:1px solid #BBD9C1;color:#1F5130;padding:14px 18px;margin-bottom:22px;font-size:15px}
.mut{color:var(--muted);font-size:13px}.empty{padding:60px;text-align:center;color:var(--muted)}
form.flt{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
form.flt select{border:1px solid var(--rule);background:#fff;padding:12px 12px;font:400 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none;color:var(--navy)}
.sum{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 12px;font-size:14px;color:var(--navy)}
.pcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
.pc{position:relative;background:#fff;border:1px solid var(--rule);padding:18px 20px 20px;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .2s;outline:none}
.pc:hover,.pc:focus-visible{border-color:var(--navy);box-shadow:0 10px 28px -18px rgba(18,40,92,.45);transform:translateY(-2px)}
.pc.on{border-color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber)}
.pc-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}.pc-ref{font-size:13px;color:var(--muted);flex:1;letter-spacing:.02em}
.pc-sel{display:inline-flex;padding:6px;margin:-6px}.pc-sel input{width:17px;height:17px;accent-color:var(--navy);cursor:pointer}
.pc h3{font-size:20px;line-height:1.25;color:var(--navy);margin:0 0 6px}
.pc-org{margin:0;font-size:15px;color:var(--ink);line-height:1.45}.pc-cat{margin:8px 0 0;font-size:14px;color:var(--muted)}.pc-cat span{color:var(--navy);font-weight:700;margin-left:4px}
.pc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.pc-chips:empty{display:none}
.allsel{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--navy);cursor:pointer}.allsel input{width:17px;height:17px;accent-color:var(--navy)}
dialog.pd{position:fixed;inset:0;margin:auto;border:0;padding:0;height:fit-content;overflow:auto;width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 40px);background:var(--paper,#FBFAF7);color:var(--ink);box-shadow:0 30px 80px -20px rgba(10,20,56,.45)}
html:has(dialog[open]){overflow:hidden}
dialog.pd::backdrop{background:rgba(10,20,56,.45)}
.pd-hd{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--rule);padding:22px 26px 18px;display:flex;gap:16px;align-items:flex-start}
.pd-hd h2{font-size:26px;line-height:1.2;margin:4px 0 4px;color:var(--navy)}.pd-hd p{margin:0;color:var(--muted);font-size:15px}
.pd-x{margin-left:auto;flex:none;width:40px;height:40px;border:1px solid var(--rule);background:#fff;font-size:22px;line-height:1;color:var(--navy);cursor:pointer}.pd-x:hover{border-color:var(--navy)}
.pd-bd{padding:8px 26px 26px}
.pd-sec{padding:18px 0;border-bottom:1px solid var(--rule)}.pd-sec:last-child{border:0}
.pd-sec h4{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);margin:0 0 12px}
.pd-dl{display:grid;grid-template-columns:170px 1fr;gap:8px 18px;margin:0;font-size:15px}.pd-dl dt{color:var(--muted)}.pd-dl dd{margin:0;color:var(--ink);overflow-wrap:anywhere}
.pd-abs{white-space:pre-wrap;font-size:15px;line-height:1.6;margin:10px 0 0;max-height:260px;overflow:auto;background:#fff;border:1px solid var(--rule);padding:14px 16px}
.pd-act{display:flex;flex-wrap:wrap;gap:8px}.pd-act .b2{padding:11px 15px}
.rvt{margin:14px 0 6px;border:1px solid var(--rule);background:#fff}.rvr{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--rule)}.rvr:last-child{border:0}.rvr small{display:block;color:var(--muted);font-size:12px}.rvr select{padding:8px;border:1px solid var(--rule);font:inherit;font-size:14px;background:#fff}
.pd-nl{display:block;font-size:14px;color:var(--muted);margin:14px 0 6px}#rvn{width:100%;box-sizing:border-box;border:1px solid var(--rule);padding:10px;font:inherit;font-size:15px}
@media(max-width:560px){.rvr{grid-template-columns:1fr}}
.pd-hint{font-size:13px;color:var(--muted);margin:10px 0 0}
@media(max-width:560px){.pd-dl{grid-template-columns:1fr;gap:2px}.pd-dl dd{margin-bottom:8px}.pd-hd,.pd-bd{padding-left:18px;padding-right:18px}}
.acts .b2,.acts a.b2,.bar .b2{min-height:48px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
.selbar{display:none;background:#FFF7E6;border:1px solid #E9D3A2;padding:11px 16px;margin-bottom:12px;font-size:14px}.selbar.on{display:block}
.selbar button{background:none;border:0;color:var(--amber);font:700 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;cursor:pointer;text-decoration:underline;padding:0 0 0 6px}
.pg{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:22px}
.pg a,.pg span.cur,.pg span.gap{min-width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border:1px solid var(--rule);background:#fff;color:var(--navy);text-decoration:none;font-size:14px}
.pg a:hover{border-color:var(--navy)}.pg span.cur{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700}.pg span.gap{border:0;background:none;min-width:20px;padding:0}.pg .off{opacity:.35;pointer-events:none}
.pg form{display:inline-flex;gap:6px;margin-left:12px;align-items:center;font-size:13px;color:var(--muted)}.pg form input{width:70px;border:1px solid var(--rule);padding:9px 10px;font:400 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none}
@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}.stats div{padding:20px 18px;border-bottom:1px solid var(--rule)}.stats div:nth-child(2n){border-right:0}.stats div:nth-child(n+3){border-bottom:0}.stats b{font-size:36px}.stats span{letter-spacing:.16em}.bar>*{flex:1 1 140px;min-width:0}.bar input[type=search]{flex-basis:100%;min-width:0}}</style>`;
  const payCls = (st) => (st === 'paid' || st === 'waived' ? 'y' : st === 'claimed' ? 'c' : 'n');
  const cards = rows.map((r) => {
    const name = [r.salutation, r.full_name].filter(Boolean).join(' ');
    const pres = r.participation && !/non-presenting/i.test(r.participation);
    return `<article class="pc" data-id="${r.id}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Open ${e(name)}">
      <div class="pc-top"><label class="pc-sel" title="Select"><input type="checkbox" name="ids" value="${r.id}" class="sel" aria-label="Select ${e(name)}"></label><span class="pc-ref">${e(r.ref)}</span><span class="tag ${payCls(r.pay_status)}">${e(PAYLBL[r.pay_status] || 'Unpaid')}</span></div>
      <h3>${e(name)}</h3>
      <p class="pc-org">${e(r.organisation)}${r.country ? ` · ${e(r.country)}` : ''}</p>
      <p class="pc-cat">${e(r.category)}${r.fee ? ` <span>${e(r.fee)}</span>` : ''}</p>
      <div class="pc-chips">${r.participation ? `<span class="tag">${e(r.participation.replace(' (non-presenting)', ''))}</span>` : ''}${pres && r.abstract ? '<span class="tag y">Abstract in</span>' : pres ? '<span class="tag n">No abstract yet</span>' : ''}${r.attended ? '<span class="tag y">Attended</span>' : ''}${r.cert_issued_at ? '<span class="tag y">Certificate issued</span>' : ''}</div>
    </article>`;
  }).join('');
  const AU = require('./authors'), SUBM = require('./submit'), STG = SUBM.stages();
  const DATA = Object.fromEntries(rows.map((r) => [r.id, { ...r, authorsLine: AU.line(AU.read(r, r.full_name)), affs: AU.read(r, r.full_name).f, authors: undefined, abstract: r.abstract ? 1 : 0, extAt: r.ext_at ? myTime(r.ext_at) : '', fpAt: r.fp_at ? myTime(r.fp_at) : '', created: myTime(r.created_at), paid: r.paid_at ? myTime(r.paid_at) : '', claimedAt: r.pay_claimed_at ? myTime(r.pay_claimed_at) : '', lastLogin: r.last_login ? myTime(r.last_login) : '', certAt: r.cert_issued_at ? myTime(r.cert_issued_at) : '', presAt: r.pres_at ? myTime(r.pres_at) : '' }]));
  const label = { all: 'All statuses', attended: 'Attended', absent: 'Not attended', issued: 'Certificate issued', pending: 'Attended, no certificate yet' };
  const first = total ? (page - 1) * f.per + 1 : 0, lastN = Math.min(total, page * f.per);
  const filtered = !!(f.q || f.cat || f.status !== 'all' || f.pay !== 'all');
  const sel = (name, opts, cur) => `<select name="${name}" aria-label="${name}">${opts.map(([val, lab]) => `<option value="${e(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${e(lab)}</option>`).join('')}</select>`;
  const hid = `<input type="hidden" name="q" value="${e(f.q)}"><input type="hidden" name="status" value="${e(f.status)}"><input type="hidden" name="cat" value="${e(f.cat)}"><input type="hidden" name="pay" value="${e(f.pay)}"><input type="hidden" name="sort" value="${e(f.sort)}"><input type="hidden" name="per" value="${f.per}"><input type="hidden" name="page" value="${page}">`;
  const allQS = qs ? '?' + qs : '';
  return baseHead(`Dashboard — ${cfg.eventName}`, css) + topbar('Admin', `<a href="${B}/admin/speakers">Speakers</a><a href="${B}/admin/settings">Settings</a><a href="${B}/" target="_blank">View site</a>`).replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Dashboard</span><h1>Participants</h1>
  <p style="margin:-18px 0 28px;display:flex;gap:10px;flex-wrap:wrap"><a class="b2" href="${B}/admin/payments">Import Ticket2U payments →</a><a class="b2" href="${B}/admin/speakers">Manage speakers →</a></p>
  ${flash && flash.ok ? `<div class="okmsg">${e(flash.ok)}</div>` : ''}
  <div class="stats"><div><b>${n(stats.total)}</b><span>Registered</span></div><div><a href="${B}/admin?pay=paid" style="text-decoration:none"><b>${n(stats.paid)}</b><span>Paid</span></a></div><div><a href="${B}/admin?pay=claimed" style="text-decoration:none"><b>${n(stats.claimed)}</b><span>Paid · to check</span></a></div><div><a href="${B}/admin?pay=unpaid" style="text-decoration:none"><b>${n(stats.unpaid)}</b><span>Not paid yet</span></a></div></div>
  <form class="flt" method="get" action="${B}/admin">
    <input type="search" name="q" value="${e(f.q)}" placeholder="Search name, email, organisation or reference…" aria-label="Search participants" style="flex:1;min-width:240px;border:1px solid var(--rule);background:#fff;padding:13px 16px;font:400 15px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none">
    ${sel('status', statuses.map((s) => [s, label[s]]), f.status)}
    ${sel('cat', [['', 'All categories'], ...cats.map((c) => [c, c])], f.cat)}
    ${sel('pay', pays.map((x) => [x, { all: 'All payments', unpaid: 'Unpaid', claimed: 'Paid · to check', paid: 'Paid', waived: 'Waived' }[x]]), f.pay)}
    ${sel('sort', [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A–Z'], ['org', 'Organisation A–Z']], f.sort)}
    ${sel('per', pers.map((x) => [x, x + ' per page']), f.per)}
    <button class="b2 pri" type="submit">Apply</button>${filtered ? `<a class="b2" href="${B}/admin">Reset</a>` : ''}
  </form>
  <div class="sum"><span>${total ? `Showing <b>${n(first)}–${n(lastN)}</b> of <b>${n(total)}</b>${filtered ? ' matching' : ''}` : 'No participants match.'}</span><span class="mut">Page ${n(page)} of ${n(pages)}</span></div>
  <form id="bulk" method="post" action="${B}/admin/action"><input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="action" id="bact" value=""><input type="hidden" name="scope" id="scope" value=""><input type="hidden" name="confirm" id="conf" value="">${hid}
  <div class="bar">
    <button type="button" class="b2 pri" data-act="paid">Mark paid</button>
    <button type="button" class="b2" data-act="unpaid">Mark unpaid</button>
    <button type="button" class="b2" data-act="waived">Waive fee</button>
    <button type="button" class="b2" data-act="attended">Mark attended</button>
    <button type="button" class="b2" data-act="unattended">Unmark</button>
    <button type="button" class="b2" data-act="revoke" title="Withdraw issued certificates: they stop verifying">Revoke certificate</button>
    <button type="button" class="b2 pri" id="certSel">Certificates · selected</button>
    <a class="b2" href="${B}/admin/export.csv${allQS}">Export CSV${filtered ? ' (filtered)' : ''}</a>
    <button type="button" class="b2 dng" data-act="delete">Delete</button>
  </div>
  <div class="selbar" id="selbar"></div>
  <div class="sum" style="margin-top:4px"><label class="allsel"><input type="checkbox" id="all"> Select all on this page</label><span class="mut">Click a card to see the full details and actions.</span></div>
  <div class="pcs" id="cards">${cards}</div>
  ${rows.length ? '' : `<div class="empty" style="background:#fff;border:1px solid var(--rule)">${filtered ? 'No participants match these filters.' : 'No registrations yet.'}</div>`}</form>
  <form id="one" method="post" action="${B}/admin/action" hidden><input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="action" id="oact"><input type="hidden" name="ids" id="oid">${hid}</form>
  <dialog class="pd" id="pd" aria-labelledby="pdName"><div class="pd-hd"><div><span class="label" id="pdRef"></span><h2 id="pdName"></h2><p id="pdSub"></p></div><button type="button" class="pd-x" id="pdX" aria-label="Close">×</button></div><div class="pd-bd" id="pdBody"></div></dialog>
  ${pages > 1 ? pager(page, pages, qs) : ''}
  <p class="mut" style="margin-top:18px">Times shown in Malaysia time (UTC+8).</p>
</div></main>
<script>
const TOTAL=${total}, PER=${rows.length}, QS=${JSON.stringify(qs).replace(/</g, '\\u003c')};
const f=document.getElementById('bulk'), bar=document.getElementById('selbar'), scope=document.getElementById('scope');
const sels=()=>[...document.querySelectorAll('.sel:checked')], nf=x=>x.toLocaleString('en-US');
function refresh(){
  const n=sels().length, all=scope.value==='all';
  if(all){bar.className='selbar on';bar.innerHTML='All <b>'+nf(TOTAL)+'</b> matching participants are selected. <button type="button" id="clr">Clear selection</button>';document.getElementById('clr').onclick=()=>{scope.value='';document.querySelectorAll('.sel,#all').forEach(c=>c.checked=false);refresh()};return}
  if(n&&n===PER&&TOTAL>PER){bar.className='selbar on';bar.innerHTML='All <b>'+nf(n)+'</b> on this page are selected. <button type="button" id="allm">Select all '+nf(TOTAL)+' matching</button>';document.getElementById('allm').onclick=()=>{scope.value='all';refresh()};return}
  bar.className='selbar'; bar.innerHTML='';
}
document.getElementById('all').onchange=e=>{scope.value='';document.querySelectorAll('.sel').forEach(c=>c.checked=e.target.checked);refresh()};
document.querySelectorAll('.sel').forEach(c=>c.onchange=()=>{scope.value='';refresh()});
function count(){return scope.value==='all'?TOTAL:sels().length}
document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
  const n=count(); if(!n){alert('Select at least one participant first.');return}
  const act=b.dataset.act;
  if(act==='revoke'&&!confirm('Withdraw the issued certificate of '+n+' participant(s)? They will stop verifying.'))return;
  if(act==='delete'){
    if(scope.value==='all'){const t=prompt('This will permanently delete ALL '+nf(n)+' matching participants.\\nType DELETE to confirm.');if(t!=='DELETE')return;document.getElementById('conf').value='DELETE'}
    else if(!confirm('Permanently delete '+n+' registration(s)?'))return;
  }
  document.getElementById('bact').value=act; f.submit();});
const D=${jsonForScript(DATA)}, PL=${jsonForScript(PAYLBL)}, BB=${jsonForScript(B)}, STG=${jsonForScript(STG.map((x) => ({ id: x.id, name: x.name })))}, CS=${jsonForScript(csrf)};
const dlg=document.getElementById('pd'), body=document.getElementById('pdBody');
const esc=x=>String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const row=(k,v)=>v?'<dt>'+esc(k)+'</dt><dd>'+v+'</dd>':'';
const t=(v)=>v?esc(v):'';
const btn=(act,lab,cls)=>'<button type="button" class="b2 '+(cls||'')+'" data-one="'+act+'">'+lab+'</button>';
function openCard(id){
  const r=D[id]; if(!r)return;
  document.getElementById('pdRef').textContent=r.ref;
  document.getElementById('pdName').textContent=[r.salutation,r.full_name].filter(Boolean).join(' ');
  document.getElementById('pdSub').textContent=[r.designation,r.department,r.organisation,r.country].filter(Boolean).join(' · ');
  const pres=r.participation&&!/non-presenting/i.test(r.participation), st=r.pay_status||'unpaid';
  let h='';
  h+='<div class="pd-sec"><h4>Actions</h4><div class="pd-act">'+
    (st==='paid'?btn('unpaid','Mark unpaid'):btn('paid','Mark paid','pri'))+(st!=='waived'&&st!=='paid'?btn('waived','Waive fee'):'')+(st==='waived'?btn('unpaid','Undo waiver'):'')+
    (r.attended?btn('unattended','Unmark attended'):btn('attended','Mark attended'))+
    '<a class="b2" href="'+BB+'/admin/certificates?ids='+r.id+'">'+(r.cert_issued_at?'Re-issue certificate':'Generate certificate')+'</a>'+
    (r.cert_issued_at?btn('revoke','Revoke certificate'):'')+
    '<a class="b2" href="mailto:'+encodeURIComponent(r.email).replace(/%40/g,'@')+'?subject='+encodeURIComponent('ICSSST 2027 — '+r.ref)+'">Email</a>'+
    btn('delete','Delete','dng')+'</div>'+
    (st==='claimed'?'<p class="pd-hint">This participant says they paid'+(r.pay_ref?' (order <b>'+esc(r.pay_ref)+'</b>)':'')+'. Find the order in your Ticket2U dashboard, then press Mark paid.</p>':'')+'</div>';
  h+='<div class="pd-sec"><h4>Contact</h4><dl class="pd-dl">'+row('Email','<a href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>')+row('Phone',r.phone?'<a href="tel:'+esc(r.phone.replace(/[^+\\d]/g,''))+'">'+esc(r.phone)+'</a>':'')+row('Organisation',t(r.organisation))+row('Department',t(r.department))+row('Position',t(r.designation))+row('Country',t(r.country))+'</dl></div>';
  h+='<div class="pd-sec"><h4>Registration</h4><dl class="pd-dl">'+row('Reference',t(r.ref))+row('Category',t(r.category))+row('Fee',t(r.fee))+row('Taking part as',t(r.participation))+row('MASS number',t(r.mass_no))+row('Registered',t(r.created)+(r.method==='google'?' · with Google':' · with email'))+row('Account',r.has_pw?'Password set':'Sign-in by email code only')+row('Last signed in',t(r.lastLogin))+'</dl></div>';
  h+='<div class="pd-sec"><h4>Payment</h4><dl class="pd-dl">'+row('Status','<span class="tag '+(st==='paid'||st==='waived'?'y':st==='claimed'?'c':'n')+'">'+esc(PL[st]||'Unpaid')+'</span>')+row('Order / reference',t(r.pay_ref))+row('Amount',t(r.pay_amount))+row('Paid on',t(r.paid))+row('Reported paid',t(r.claimedAt))+row('Recorded by',t({stripe:'Stripe','ticket2u-import':'Ticket2U import',manual:'Organiser'}[r.pay_source]||r.pay_source))+row('Note',t(r.pay_note))+row('Billing / receipt to',t(r.billing))+'</dl></div>';
  if(pres){
    const SO=[['','Not reviewed'],['accepted','Accepted'],['revise','Revision requested'],['rejected','Not accepted']];
    const sel=(k,v)=>'<select class="rv" data-stage="'+k+'" aria-label="Review status">'+SO.map(o=>'<option value="'+o[0]+'"'+((v||'')===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select>';
    h+='<div class="pd-sec"><h4>Submission</h4><dl class="pd-dl">'+row('Title',t(r.paper_title)||'<span class="tag n">Not given yet</span>')+row('Authors',t(r.authorsLine))+((r.affs||[]).length?row('Affiliations',r.affs.map((x,i)=>'<sup>'+(i+1)+'</sup>'+esc(x)).join('<br>')):'')+row('Keywords',t(r.keywords))+row('Updated',t(r.presAt))+'</dl>'+
      (r.abstract?'<div class="pd-abs" data-abs="'+r.id+'">Loading abstract…</div>':'<p class="pd-hint">No abstract yet.</p>')+
      '<div class="rvt">'+STG.map(s=>{const has=s.id==='abs'?!!r.paper_title:!!r[s.id+'_file'];
        return '<div class="rvr"><b>'+esc(s.name)+'</b><span>'+(s.id==='abs'?(r.paper_title?'<a href="'+BB+'/admin/participant/'+r.id+'/abstract.pdf" target="_blank">Abstract PDF</a>':'—'):(has?'<a href="'+BB+'/admin/participant/'+r.id+'/file/'+s.id+'">'+esc(r[s.id+'_name']||'File')+'</a><small>'+esc(r[s.id==='ext'?'extAt':'fpAt'])+'</small>':'Not uploaded'))+'</span>'+(has?sel(s.id,r[s.id+'_status']):'<span></span>')+'</div>'}).join('')+'</div>'+
      '<label class="pd-nl" for="rvn">Note to the author <small>(shown on their Submission tab when a revision is requested or not accepted)</small></label><textarea id="rvn" rows="3" maxlength="1500">'+esc(r.review_note||'')+'</textarea><p class="pd-act"><button type="button" class="b2" id="rvSave">Save note</button><span class="mut" id="rvMsg" role="status"></span></p></div>';
  }
  if(r.diet||r.dinner||r.diet_note)h+='<div class="pd-sec"><h4>Event details</h4><dl class="pd-dl">'+row('Diet',t(r.diet))+row('Diet note',t(r.diet_note))+row('Conference dinner',t(r.dinner))+'</dl></div>';
  h+='<div class="pd-sec"><h4>Attendance &amp; certificate</h4><dl class="pd-dl">'+row('Attended',r.attended?'<span class="tag y">Yes</span>':'Not yet')+row('Certificate',r.cert_issued_at?'Issued '+esc(r.certAt):'Not issued')+'</dl></div>';
  body.innerHTML=h;
  body.querySelectorAll('[data-one]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.one, nm=document.getElementById('pdName').textContent;
    if(a==='delete'&&!confirm('Permanently delete the registration of '+nm+'?'))return;
    if(a==='revoke'&&!confirm('Withdraw the certificate of '+nm+'? It will stop verifying.'))return;
    document.getElementById('oact').value=a; document.getElementById('oid').value=r.id; document.getElementById('one').submit();
  });
  const rvPost=(o)=>fetch(BB+'/admin/review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.assign({csrf:CS,id:r.id},o))}).then(x=>x.json());
  body.querySelectorAll('select.rv').forEach(sl=>sl.onchange=()=>{const m=document.getElementById('rvMsg');m.textContent='Saving…';rvPost({stage:sl.dataset.stage,status:sl.value}).then(j=>{m.textContent=j.ok?'Saved.':'Not saved.';if(j.ok)r[sl.dataset.stage+'_status']=sl.value})});
  var rvs=document.getElementById('rvSave');if(rvs)rvs.onclick=()=>{const m=document.getElementById('rvMsg'),v=document.getElementById('rvn').value;m.textContent='Saving…';rvPost({note:v}).then(j=>{m.textContent=j.ok?'Saved.':'Not saved.';if(j.ok)r.review_note=v})};
  var ab=body.querySelector('[data-abs]');if(ab)fetch(BB+'/admin/participant/'+r.id+'/abstract',{credentials:'same-origin'}).then(x=>x.ok?x.text():Promise.reject()).then(t=>{ab.textContent=t}).catch(()=>{ab.textContent='Could not load the abstract.'});
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  body.scrollTop=0;
}
document.getElementById('pdX').onclick=()=>dlg.close();
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
document.querySelectorAll('.pc').forEach(c=>{
  c.addEventListener('click',e=>{if(e.target.closest('.pc-sel'))return;openCard(c.dataset.id)});
  c.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.pc-sel')){e.preventDefault();openCard(c.dataset.id)}});
});
const mark=()=>document.querySelectorAll('.pc').forEach(c=>c.classList.toggle('on',c.querySelector('.sel').checked));
document.addEventListener('change',e=>{if(e.target.matches('.sel,#all'))mark()});
document.getElementById('certSel').onclick=()=>{
  if(!count()){alert('Select at least one participant first.');return}
  location.href='${B}/admin/certificates'+(scope.value==='all'?(QS?'?'+QS:'?scope=all'):'?ids='+sels().map(c=>c.value).join(','))};
</script></body></html>`;
}

function submissions({ csrf, stats, stages, recent, speakersWithAbs }) {
  const css = `.sst{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:8px 0 34px}.sst .card{margin:0;padding:22px 24px}.sst h3{margin:0 0 4px;font-size:18px;color:var(--navy)}.sst .mut{font-size:13px}
  .sst dl{display:grid;grid-template-columns:1fr auto;gap:6px 14px;margin:14px 0 0;font-size:15px}.sst dd{margin:0;font-weight:700;color:var(--navy);text-align:right}.sst a{color:inherit}
  .dlrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0 0}.dlrow .b2{display:inline-flex;align-items:center;min-height:46px}
  .rlist{border:1px solid var(--rule);background:#fff}.rli{display:grid;grid-template-columns:1fr auto;gap:6px 16px;padding:14px 18px;border-bottom:1px solid var(--rule)}.rli:last-child{border:0}.rli b{color:var(--navy)}.rli small{color:var(--muted);display:block}.rli .tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}`;
  const lbl = { '': 'Not reviewed', accepted: 'Accepted', revise: 'Revision', rejected: 'Not accepted' };
  return baseHead(`Submissions — ${cfg.eventName}`, `<style>${css}</style>`) + topbar('Submissions', '').replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Submissions</span><h1>Abstracts &amp; papers</h1>
  <p class="lede">What oral and poster presenters have sent. Stages, deadlines and templates are set in <a href="${B}/admin/settings#subs">Settings → Submissions</a>. Open a participant’s card on the <a href="${B}/admin">Participants</a> page to read, download and review.</p>
  <div class="sst">${stages.map((x) => { const t = stats[x.id] || {}; return `<section class="card"><span class="label">Stage ${x.n}</span><h3>${e(x.name)}</h3><p class="mut">${x.req ? 'Required' : 'Optional'}${x.deadline ? ' · deadline ' + e(myTime(x.deadline)) : ''}${x.closed ? ' · closed' : ''}</p>
    <dl><dt>Submitted</dt><dd>${n(t.done || 0)} / ${n(stats.presenters || 0)}</dd><dt>Accepted</dt><dd>${n(t.accepted || 0)}</dd><dt>Revision requested</dt><dd>${n(t.revise || 0)}</dd><dt>Not accepted</dt><dd>${n(t.rejected || 0)}</dd><dt>Not reviewed</dt><dd>${n(Math.max(0, (t.done || 0) - (t.accepted || 0) - (t.revise || 0) - (t.rejected || 0)))}</dd></dl></section>`; }).join('') || '<p>All stages are switched off.</p>'}</div>
  <section class="card"><h2>Book of abstracts</h2><p class="bl">Every abstract set in the same typeset layout (TeX Gyre Pagella, equations typeset), one per page, with a cover page. ${n(speakersWithAbs)} invited speaker abstract${speakersWithAbs === 1 ? '' : 's'} are included under “Everything”. The .tex file is the same content as LaTeX source, for a proceedings editor or Overleaf.</p>
    <form class="dlrow" method="get" action="${B}/admin/abstracts.pdf" target="_blank">
      <select name="which" aria-label="Which abstracts"><option value="all">Everything (speakers, oral, poster)</option><option value="oral">Oral presentations</option><option value="poster">Poster presentations</option><option value="speakers">Invited speakers only</option></select>
      <select name="status" aria-label="Review status"><option value="">Any review status</option><option value="notrejected">All except not accepted</option><option value="accepted">Accepted only</option></select>
      <button class="b2 pri" type="submit">Download PDF</button><button class="b2" type="submit" formaction="${B}/admin/abstracts.tex">Download LaTeX (.tex)</button></form>
    <p class="mut" style="margin-top:10px">A large book takes a few seconds per hundred abstracts to typeset.</p></section>
  <section class="card"><h2>Latest submissions</h2>
    ${recent.length ? `<div class="rlist">${recent.map((r) => `<div class="rli"><div><b>${e(r.paper_title || 'Untitled')}</b><small>${e(r.full_name)} · ${e(r.ref)} · ${e(/oral/i.test(r.participation) ? 'Oral' : 'Poster')}${r.pres_at ? ' · ' + e(myTime(r.pres_at)) : ''}</small></div>
      <div class="tags"><a class="b2" href="${B}/admin/participant/${r.id}/abstract.pdf" target="_blank">PDF</a>${r.ext_file ? `<a class="b2" href="${B}/admin/participant/${r.id}/file/ext">Extended</a>` : ''}${r.fp_file ? `<a class="b2" href="${B}/admin/participant/${r.id}/file/fp">Paper</a>` : ''}<span class="tag ${r.abs_status === 'accepted' ? 'y' : r.abs_status ? 'c' : ''}">${lbl[r.abs_status || '']}</span><a class="b2" href="${B}/admin?q=${encodeURIComponent(r.ref)}">Open</a></div></div>`).join('')}</div>` : '<p class="mut">Nothing submitted yet.</p>'}
  </section>
</div></main><script src="${B}/assets/select.js" defer></script></body></html>`;
}

function payments({ csrf, flash, t2u, fees, claimed, st = {}, paidBy = [], counts = {} }) {
  const css = `<style>.adm{padding:44px 0 90px}.adm h1{font-size:42px;color:var(--navy);margin:8px 0 18px}.adm h2{font-size:22px;color:var(--navy);margin:44px 0 12px}
.card{background:#fff;border:1px solid var(--rule);padding:26px 28px;margin-bottom:22px}.mut{color:var(--muted);font-size:14px}
.b2{background:#fff;color:var(--navy);border:1px solid var(--navy);padding:12px 18px;font:700 11px 'TeX Gyre Pagella',Palatino,Georgia,serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none}.b2.pri{background:var(--navy);color:#fff}.b2:disabled{opacity:.4;cursor:default}
textarea{width:100%;min-height:150px;border:1px solid var(--rule);padding:12px;font:13px ui-monospace,Menlo,Consolas,monospace}
table{border-collapse:collapse;width:100%;font-size:14.5px;background:#fff}th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);padding:10px;border-bottom:1px solid var(--rule)}td{padding:10px;border-bottom:1px solid #EFEBE3;vertical-align:top}
.tw{overflow-x:auto;border:1px solid var(--rule)}.err{background:#FDECEC;border:1px solid #F3B9B9;color:#8A1C1C;padding:12px 16px;margin:12px 0}.okmsg{background:#EEF6EF;border:1px solid #BBD9C1;color:#1F5130;padding:14px 18px;margin:12px 0}
ol.howto{margin:10px 0 0 20px;line-height:1.7}
.pstats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);background:#fff;margin:6px 0 40px}.pstats a{padding:22px 24px;border-right:1px solid var(--rule);text-decoration:none;color:inherit}.pstats a:last-child{border:0}.pstats a:hover{background:#FBFAF7}
.pstats b{display:block;font-size:40px;line-height:1;color:var(--navy)}.pstats span{display:block;margin-top:8px;font-size:14px;color:var(--muted)}
.step{display:grid;grid-template-columns:56px 1fr;gap:0 22px;padding:30px 0;border-top:1px solid var(--rule)}
.step .no{width:46px;height:46px;border-radius:50%;border:1.5px solid var(--navy);display:grid;place-items:center;font-size:20px;font-weight:700;color:var(--navy);background:#fff}
.step.ok .no{background:#1F6B34;border-color:#1F6B34;color:#fff}.step.todo .no{border-color:#C2410C;color:#C2410C}
.step h2{margin:6px 0 6px!important;font-size:24px}.step .lead2{margin:0 0 16px;font-size:16px;color:var(--ink);max-width:70ch}
.state{display:inline-block;font-size:13px;font-weight:700;padding:4px 10px;margin:0 0 14px;border:1px solid}.state.ok{color:#1F6B34;border-color:#BBD9C1;background:#EEF6EF}.state.todo{color:#9A3B00;border-color:#F1C7A5;background:#FFF4EA}
.where{background:#FFFBEF;border:1px solid #EBD493;padding:14px 18px;margin:0 0 16px;font-size:15px}.where b{color:var(--navy)}
.claim{display:grid;grid-template-columns:1fr auto;gap:12px 20px;align-items:center;background:#fff;border:1px solid var(--rule);padding:16px 18px;margin-bottom:10px}
.claim h3{margin:0 0 2px;font-size:17px;color:var(--navy)}.claim p{margin:0;font-size:14px;color:var(--muted)}.claim .ord{color:var(--navy);font-weight:700}
.claim form{display:flex;gap:8px;flex-wrap:wrap}
details.more{margin-top:40px;border-top:1px solid var(--rule);padding-top:18px}details.more summary{cursor:pointer;font-weight:700;color:var(--navy)}
@media(max-width:700px){.pstats{grid-template-columns:1fr 1fr}.pstats a:nth-child(2){border-right:0}.pstats a:nth-child(-n+2){border-bottom:1px solid var(--rule)}.step{grid-template-columns:1fr}.step .no{margin-bottom:10px}.claim{grid-template-columns:1fr}}.sum{display:flex;gap:26px;flex-wrap:wrap;margin:16px 0}.sum b{font-size:30px;display:block;color:var(--navy)}</style>`;
  const linkRows = (fees || []).map((f) => `<tr><td>${e(f.name)}</td><td>${e(f.fee)}</td><td>${f.url ? `<a href="${e(f.url)}" target="_blank" rel="noopener">${e(f.url)}</a>` : t2u ? '<span class="mut">general event link</span>' : '<b style="color:#9A3B00">no link yet</b>'}</td></tr>`).join('');
  return baseHead(`Payments — ${cfg.eventName}`, css) + topbar('Payments', `<a href="${B}/admin">Participants</a><a href="${B}/admin/settings">Settings</a>`).replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Payments</span><h1>Ticket2U payments</h1>
  <p class="mut" style="font-size:16px;max-width:70ch;margin:0 0 22px">Participants pay on Ticket2U, not on this site, so this site cannot see the payment by itself. You confirm payments here in one of two ways (step 3). Everything else is automatic.</p>
  ${flash && flash.ok ? `<div class="okmsg">${e(flash.ok)}</div>` : ''}
  <div class="pstats"><a href="${B}/admin?pay=paid"><b>${counts.paid || 0}</b><span>Paid</span></a><a href="${B}/admin?pay=claimed"><b>${counts.claimed || 0}</b><span>Say they paid · check</span></a><a href="${B}/admin?pay=unpaid"><b>${counts.unpaid || 0}</b><span>Not paid yet</span></a><a href="${B}/admin?pay=waived"><b>${counts.waived || 0}</b><span>Fee waived</span></a></div>

  ${(() => { const total = (fees || []).length, withLink = (fees || []).filter((f) => f.url).length, ok = !!t2u || withLink === total && total > 0; return `<section class="step ${ok ? 'ok' : 'todo'}"><span class="no">${ok ? '✓' : '1'}</span><div>
    <h2>Put your Ticket2U links on the site</h2>
    <span class="state ${ok ? 'ok' : 'todo'}">${ok ? (withLink === total ? `All ${total} categories have a link` : 'A general event link is set') : 'Not done: participants see “Payment opens soon”'}</span>
    <p class="lead2">In Ticket2U, create the event with one ticket type per fee category. Copy each ticket’s link and paste it in <a href="${B}/admin/settings#payment">Settings → Fees &amp; payment</a>. If you only have one link for the whole event, paste it as the general event link.</p>
    <div class="tw"><table><tr><th>Fee category</th><th>Amount</th><th>Link participants are sent to</th></tr>${linkRows}</table></div>
    <p class="mut" style="margin-top:8px">General event link: ${t2u ? `<a href="${e(t2u)}" target="_blank" rel="noopener">${e(t2u)}</a>` : '<b style="color:#9A3B00">not set</b>'}</p>
  </div></section>`; })()}

  <section class="step ok"><span class="no">✓</span><div>
    <h2>Participants register here, then pay on Ticket2U</h2>
    <p class="lead2">After registering, each participant sees a <b>Pay with Ticket2U</b> button on their dashboard, which opens the link for their category. They should pay with the <b>same email address</b> they registered with. Ticket2U collects the money and pays it to the organiser’s bank account on its own schedule. After paying, a participant can type their Ticket2U order number on their dashboard: they then appear below under “Say they paid”.</p>
    <p class="mut">Nothing to do here. Payments made another way (purchase order, bank transfer) can be marked paid or waived from a participant’s card on the <a href="${B}/admin">Participants</a> page.</p>
  </div></section>

  <section class="step ${claimed.length ? 'todo' : 'ok'}"><span class="no">3</span><div>
    <h2>Confirm who has paid</h2>
    <p class="lead2">Choose either way. Both mark the registration <b>Paid</b> and send the participant a confirmation email.</p>

    <h3 style="font-size:19px;color:var(--navy);margin:26px 0 6px">A. Check people one by one <span class="mut" style="font-weight:400">(${claimed.length} waiting)</span></h3>
    <p class="mut" style="margin:0 0 12px">These participants say they paid and gave an order number. Find that order in your Ticket2U dashboard (Orders, search the number). If it is there and paid, press <b>Confirm paid</b>.</p>
    ${claimed.length ? claimed.map((r) => `<div class="claim"><div><h3>${e(r.full_name)} <span class="mut" style="font-weight:400">${e(r.ref)}</span></h3><p>${e(r.email)} · ${e(r.category)}${r.fee ? ` · ${e(r.fee)}` : ''}</p><p>Ticket2U order: <span class="ord">${e(r.pay_ref || '—')}</span>${r.pay_claimed_at ? ` · reported ${e(myTime(r.pay_claimed_at))}` : ''}</p></div>
      <form method="post" action="${B}/admin/action"><input type="hidden" name="csrf" value="${e(csrf)}"><input type="hidden" name="ids" value="${r.id}"><input type="hidden" name="back" value="payments"><button class="b2 pri" name="action" value="paid">Confirm paid</button><button class="b2" name="action" value="unpaid" title="The order was not found or not paid">Not found</button></form></div>`).join('') : '<p class="okmsg" style="margin:0">Nobody is waiting to be checked.</p>'}

    <h3 style="font-size:19px;color:var(--navy);margin:34px 0 6px">B. Confirm many at once with the Ticket2U export</h3>
    <div class="where">In your Ticket2U organiser dashboard, open the event, go to <b>Orders</b> (or <b>Attendees</b>) and press <b>Export</b> to download a CSV or Excel file. If you have Excel, save it as CSV first. Then choose the file below.</div>
    <div class="card">
      <p style="margin:0 0 12px"><input type="file" id="file" accept=".csv,.tsv,.txt,text/csv" aria-label="Ticket2U export file"></p>
      <textarea id="csv" aria-label="Ticket2U export rows" placeholder="…or copy the rows from the export (including the heading row) and paste them here"></textarea>
      <p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="b2" id="prev" type="button">1. Check matches</button><button class="b2 pri" id="apply" type="button" disabled>2. Mark matched as paid</button></p>
      <p class="mut" style="margin:6px 0 0">Step 1 only shows what would happen; nothing changes until you press step 2. People are matched by email address (or their IC27-… reference, if your Ticket2U form asks for it). Cancelled, refunded and pending orders are ignored.</p>
      <div id="out"></div>
    </div>
  </div></section>

  <details class="more"><summary>Card payments with Stripe (optional)</summary>
  ${st.provider === 'ticket2u' ? `<p class="mut" style="margin-top:34px">Stripe is switched off. To offer card / FPX payment through Stripe instead, change “How participants pay” in <a href="${B}/admin/settings#payment">Settings</a>.</p>` : `<h2>Stripe</h2>
  <div class="card"><b>Stripe</b> — card, FPX online banking, GrabPay; payments are confirmed automatically.
    <table style="margin-top:14px"><tr><td style="width:240px">Payment method on the site</td><td><b>${e({ stripe: 'Stripe', both: 'Stripe + Ticket2U', ticket2u: 'Ticket2U only' }[st.provider] || st.provider)}</b> <a href="${B}/admin/settings#payment" class="mut">change</a></td></tr>
    <tr><td>Secret key (STRIPE_SECRET_KEY)</td><td>${st.on ? `<b style="color:#1F6B34">set — ${e(st.mode)} mode</b>${st.mode === 'test' ? ' <span class="mut">(test cards only; use the live key to take real payments)</span>' : ''}` : '<b style="color:#9A3B00">not set — the Stripe button is hidden</b>'}</td></tr>
    <tr><td>Webhook secret (STRIPE_WEBHOOK_SECRET)</td><td>${st.hook ? '<b style="color:#1F6B34">set</b>' : '<b style="color:#9A3B00">not set — payments still confirm when the participant returns to the site, but not if they close the tab</b>'}</td></tr>
    <tr><td>Webhook endpoint</td><td><code>${e(st.url || '')}</code><br><span class="mut">Stripe Dashboard → Developers → Webhooks → Add endpoint. Events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded.</span></td></tr>
    ${st.bad && st.bad.length ? `<tr><td>Fees Stripe cannot read</td><td><b style="color:#9A3B00">${e(st.bad.join(', '))}</b> <span class="mut">— write them as RM 900.00 or USD 350.00</span></td></tr>` : ''}
    <tr><td>Paid so far</td><td>${paidBy.length ? paidBy.map((x) => `${e({ stripe: 'Stripe', 'ticket2u-import': 'Ticket2U import', manual: 'marked by hand' }[x.s] || x.s || 'other')}: <b>${x.n}</b>`).join(' · ') : '<span class="mut">none yet</span>'}</td></tr></table>
  </div>
`}
  </details>
</div></main>
<script>
(function(){
var CSRF=${jsonForScript(csrf)},B=${jsonForScript(B)},ta=document.getElementById('csv'),out=document.getElementById('out'),ap=document.getElementById('apply');
var esc=function(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
document.getElementById('file').addEventListener('change',function(ev){var f=ev.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){ta.value=r.result;go(false)};r.readAsText(f)});
function tbl(list,cols){if(!list.length)return'<p class="mut">None.</p>';return'<div class="tw"><table><tr>'+cols.map(function(c){return'<th>'+c[0]+'</th>'}).join('')+'</tr>'+list.slice(0,300).map(function(x){return'<tr>'+cols.map(function(c){return'<td>'+esc(x[c[1]])+'</td>'}).join('')+'</tr>'}).join('')+'</table></div>'}
function go(apply){
  if(!ta.value.trim()){out.innerHTML='<div class="err">Choose a file or paste the export first.</div>';return}
  if(apply&&!confirm('Mark the matched registrations as paid and email them?'))return;
  out.innerHTML='<p class="mut">Working…</p>';
  fetch(B+'/admin/payments/import',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({csrf:CSRF,csv:ta.value,apply:apply})}).then(function(r){return r.json()}).then(function(j){
    if(!j.ok){out.innerHTML='<div class="err">'+esc(j.error)+'</div>';ap.disabled=true;return}
    var p=j.preview;ap.disabled=apply||!p.matched.length;
    out.innerHTML=(apply?'<div class="okmsg">'+j.applied+' registration(s) marked as paid.</div>':'')+
      '<p class="mut">Columns used: '+Object.keys(p.cols).filter(function(k){return p.cols[k]}).map(function(k){return k+' = “'+esc(p.cols[k])+'”'}).join(', ')+'</p>'+
      '<div class="sum"><span><b>'+p.matched.length+'</b>'+(apply?'matched':'to mark paid')+'</span><span><b>'+p.already.length+'</b>already paid</span><span><b>'+p.unknown.length+'</b>no registration found</span><span><b>'+p.skipped.length+'</b>skipped (not paid)</span></div>'+
      '<h3>Matched</h3>'+tbl(p.matched,[['Ref','ref'],['Name','name'],['Email','email'],['Category','category'],['Order','order'],['Amount','amount']])+
      '<h3 style="margin-top:18px">No registration found</h3><p class="mut">These people paid on Ticket2U but did not register here (or used another email). Ask them to register with the same email, then import again.</p>'+tbl(p.unknown,[['Email','email'],['Order','order'],['Amount','amount']]);
  }).catch(function(){out.innerHTML='<div class="err">Could not reach the server. Reload the page and try again.</div>'});
}
document.getElementById('prev').addEventListener('click',function(){go(false)});ap.addEventListener('click',function(){go(true)});
})();
</script></body></html>`;
}

function certificates({ total, src, csrf }) {
  const conf = { event: cfg.eventName, full: cfg.eventFull, sub: 'Theme: ' + cfg.eventSub, date: cfg.eventDateText, year: String((cfg.eventDate || '').slice(0, 4) || new Date().getFullYear()), venue: cfg.eventVenue, sigName: cfg.signatoryName, sigTitle: cfg.signatoryTitle, sigImg: cfg.signatureData ? B + '/admin/signature?v=' + encodeURIComponent(cfg.signatureVer) : '', csrf, base: B, total, src };
  const css = `<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<link rel="stylesheet" href="${B}/assets/cert.css?v=${av('cert.css')}">`;
  const body = total ? `<div class="cw"><div class="side" id="list"></div><main class="main">
    <div class="tb"><button class="b2 pri" id="one">Download PDF</button><button class="b2" id="allbtn">Download all (${Number(total).toLocaleString('en-US')}) as ZIP files</button><button class="b2 dng" id="stopbtn" hidden>Stop</button><span id="st"></span></div>
    <p class="hint">Large batches are downloaded as ZIP files of 100 certificates each. Keep this tab open until it finishes. If you stop or lose connection, reopen the dashboard, choose <b>“Attended, no certificate yet”</b> and continue.</p>
    <img id="prev" alt="Certificate preview"></main></div>
<script>window.QH_C=${jsonForScript(conf)};</script><script src="${B}/assets/cert.js?v=${av('cert.js')}"></script>`
    : `<main class="main"><p>No participants selected. <a href="${B}/admin">Back to dashboard</a>.</p></main>`;
  return baseHead(`Certificates — ${cfg.eventName}`, css) + topbar('Certificates', `<a href="${B}/admin">← Dashboard</a>`).replace('__CSRF__', e(csrf)) + body + '</body></html>';
}
function settings({ groups, fields, vals, toLocal, flash, raw, status, isOpen, left, csrf }) {
  const SUB = require('./submit');
  const tplCard = () => `<section class="card" id="g-templates"><h2>Templates</h2><p class="bl">Presenters download these from their Submission tab, fill them in and upload the result. Use Word (.docx) so authors can edit it.</p>
    ${[['ext', 'Extended abstract template'], ['fp', 'Full paper template']].map(([k, t]) => { const tp = SUB.template(k); return `<div class="tplrow"><h3>${t}</h3>
      ${tp ? `<div class="ufile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg><div><a href="${B}/submissions/template/${k}">${e(tp.name)}</a><small>${SUB.fmtSize(tp.size)} · uploaded ${e(myTime(tp.at))}</small></div>
        <form method="post" action="${B}/admin/templates/${k}/delete" data-confirm="Remove this template?" style="margin-left:auto"><input type="hidden" name="csrf" value="${e(csrf)}"><button class="b2 dng" type="submit">Remove</button></form></div>` : '<p class="mut" style="margin:0 0 10px">No template uploaded yet.</p>'}
      <div class="udrop" data-up="${k}" data-url="${B}/admin/templates/${k}" data-csrf="${e(csrf)}" data-max="25"><input type="file" id="tpl_${k}" accept=".docx,.dotx,.doc,.pdf,.tex,.zip" hidden><label for="tpl_${k}" class="b2 ${tp ? '' : 'pri'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg><span>${tp ? 'Replace template' : 'Upload template'}</span></label><span class="mut">or drop the file here</span><div class="ubar" hidden><i></i></div><p class="umsg" role="status"></p></div></div>`; }).join('')}
  </section><script src="${B}/assets/upload.js" defer></script>`;
  const n = (x) => Number(x).toLocaleString('en-US');
  const css = `<style>
.adm{padding:44px 0 120px}.adm h1{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:42px;letter-spacing:-.025em;color:var(--navy);margin:8px 0 8px}
.lede{color:var(--muted);margin:0 0 26px;max-width:680px}
.snav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 30px}.snav a{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--navy);border:1px solid var(--rule);background:#fff;padding:9px 14px}.snav a:hover{border-color:var(--navy)}
.card{background:#fff;border:1px solid var(--rule);padding:34px 36px;margin-bottom:26px;scroll-margin-top:90px}
.card h2{font-family:'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;font-size:26px;color:var(--navy);margin:0 0 4px}.card .bl{color:var(--muted);font-size:14.5px;margin:0 0 24px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px}.grid .full{grid-column:1/-1}
.sf label.l{display:block;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--amber);margin-bottom:6px}
.sf input[type=text],.sf input[type=number],.sf input[type=date],.sf input[type=datetime-local],.sf input[type=password],.sf input[type=email],.sf textarea{width:100%;border:1px solid var(--rule);background:#fff;padding:12px 14px;font:400 16px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:var(--navy);outline:none;border-radius:0}
.sf textarea{min-height:110px;resize:vertical}.sf input:focus,.sf textarea:focus{border-color:var(--navy)}
.sf .h{font-size:13px;color:var(--muted);margin-top:6px;line-height:1.45}
.sw{display:flex;align-items:flex-start;gap:14px;cursor:pointer}.sw input{position:absolute;opacity:0}.sw .tr{flex:none;width:46px;height:26px;border-radius:13px;background:#cfcad8;position:relative;transition:background .2s;margin-top:2px}
.sw .tr::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sw input:checked+.tr{background:var(--navy)}.sw input:checked+.tr::after{transform:translateX(20px)}.sw input:focus-visible+.tr{outline:2px solid var(--amber);outline-offset:2px}
.sw b{display:block;font-size:15.5px;color:var(--navy);font-weight:600}.sw .h{margin-top:2px}
.savebar{position:fixed;left:0;right:0;bottom:0;z-index:25;background:rgba(255,255,255,.96);border-top:1px solid var(--rule);padding:14px 0;backdrop-filter:blur(8px)}
.savebar .wrap{display:flex;gap:14px;align-items:center;justify-content:space-between}
.b2{background:#fff;color:var(--navy);border:1px solid var(--navy);padding:12px 18px;font:700 11px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none;display:inline-block}
.b2:hover{background:var(--navy);color:#fff}.b2.pri{background:var(--navy);color:#fff}.b2.pri:hover{background:var(--amber);border-color:var(--amber)}.b2.dng{border-color:#B91C1C;color:#B91C1C}.b2.dng:hover{background:#B91C1C;color:#fff}
.ok{background:#EAF4EC;border-left:3px solid #1F6B34;color:#14532d;padding:14px 18px;margin-bottom:24px}.bad{background:#FBEFEA;border-left:3px solid #C2410C;color:#7c2d12;padding:14px 18px;margin-bottom:24px}.bad ul{margin:0 0 0 18px}
.kv{display:grid;grid-template-columns:230px 1fr;gap:10px 20px;font-size:15px}.kv dt{color:var(--muted)}.kv dd{margin:0;color:var(--navy);word-break:break-all}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 10px;border:1px solid var(--rule)}.pill.y{background:#EAF4EC;border-color:#BBD9C1;color:#1F6B34}.pill.n{background:#FBEFEA;border-color:#E7C1B1;color:#9a3412}
.sig{display:flex;gap:24px;align-items:center;flex-wrap:wrap}.sig .box{width:260px;height:110px;border:1px dashed var(--rule);display:grid;place-items:center;background:#FBFAF7;color:var(--muted);font-size:13px}.sig img{max-width:240px;max-height:96px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.row>div{flex:1;min-width:200px}
.tplrow{padding:16px 0;border-top:1px solid var(--rule)}.tplrow h3{font-size:17px;color:var(--navy);margin:0 0 10px}.tplrow .ufile{max-width:none}
.stabs{display:grid;grid-template-columns:260px minmax(0,1fr);gap:34px;align-items:start}
.tlist{position:sticky;top:90px;display:flex;flex-direction:column;border:1px solid var(--rule);background:#fff}
.tbtn{position:relative;text-align:left;background:none;border:0;border-bottom:1px solid var(--rule);padding:14px 18px 14px 20px;cursor:pointer;font:inherit;color:var(--navy)}
.tbtn:last-child{border-bottom:0}.tbtn b{display:block;font-size:16px}.tbtn span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.35}
.tbtn:hover{background:#FBFAF7}.tbtn[aria-selected=true]{background:#FBFAF7;box-shadow:inset 3px 0 0 var(--amber)}.tbtn[aria-selected=true] b{color:var(--navy)}
.tbtn .dot{position:absolute;right:14px;top:18px;width:8px;height:8px;border-radius:50%;background:var(--amber);display:none}.tbtn.dirty .dot{display:block}.tbtn.err .dot{display:block;background:#B91C1C}
.tbody .card:last-child{margin-bottom:0}
.savebar .sbmsg{font-size:14px;color:var(--muted)}.savebar.dirty .sbmsg{color:#9A3B00;font-weight:700}.savebar.off{display:none}
@media(max-width:900px){.stabs{grid-template-columns:1fr;gap:18px}.tlist{position:static;flex-direction:row;overflow-x:auto;scrollbar-width:none}.tbtn{flex:none;border-bottom:0;border-right:1px solid var(--rule);padding:12px 16px}.tbtn span{display:none}.tbtn[aria-selected=true]{box-shadow:inset 0 -3px 0 var(--amber)}.tbtn .dot{top:8px;right:6px}}
@media(max-width:800px){.grid{grid-template-columns:1fr}.kv{grid-template-columns:1fr}.card{padding:26px 22px}}@media(max-width:520px){#tools div[style*="flex:none"]{flex:1 1 100%!important}#tools .b2{display:block;width:100%;text-align:center;white-space:normal}}</style>`;
  const val = (f) => raw ? raw[f.k] : vals[f.k];
  const field = (f) => {
    const id = 'f_' + f.k, h = f.help ? `<div class="h">${e(f.help)}</div>` : '';
    if (f.t === 'bool') { const on = raw ? !!raw[f.k] : !!vals[f.k]; return `<div class="full sf"><label class="sw"><input type="checkbox" name="${f.k}" ${on ? 'checked' : ''}><span class="tr"></span><span><b>${e(f.label)}</b>${h}</span></label></div>`; }
    const lab = `<label class="l" for="${id}">${e(f.label)}</label>`;
    if (f.t === 'int') return `<div class="sf">${lab}<input type="number" id="${id}" name="${f.k}" min="${f.min}" max="${f.max}" step="1" value="${e(val(f))}">${h}</div>`;
    if (f.t === 'date' || f.t === 'odate') return `<div class="sf">${lab}<input type="date" id="${id}" name="${f.k}" value="${e(val(f))}">${h}</div>`;
    if (f.t === 'datetime') return `<div class="sf">${lab}<input type="datetime-local" id="${id}" name="${f.k}" value="${e(raw ? raw[f.k] : toLocal(vals[f.k]))}">${h}</div>`;
    if (f.t === 'choice') return `<div class="sf full">${lab}<select id="${id}" name="${f.k}">${f.options.map(([v, t]) => `<option value="${e(v)}" ${String(val(f)) === v ? 'selected' : ''}>${e(t)}</option>`).join('')}</select>${h}</div>`;
    if (f.t === 'fees') return `<div class="sf full">${lab}<textarea id="${id}" name="${f.k}" rows="8" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13.5px">${e(raw ? raw[f.k] : (vals[f.k] || []).map((x) => [x.name, x.fee, x.url].filter(Boolean).join(' | ')).join('\n'))}</textarea>${h}</div>`;
    if (f.t === 'turl') return `<div class="sf full">${lab}<input type="url" id="${id}" name="${f.k}" maxlength="${f.max}" placeholder="${e(f.placeholder || '')}" value="${e(val(f))}">${h}</div>`;
    if (f.t === 'list') return `<div class="sf full">${lab}<textarea id="${id}" name="${f.k}" rows="5">${e(raw ? raw[f.k] : (vals[f.k] || []).join('\n'))}</textarea>${h}</div>`;
    if (f.t === 'longtext') return `<div class="sf full">${lab}<textarea id="${id}" name="${f.k}" rows="4" maxlength="${f.max}">${e(val(f))}</textarea>${h}</div>`;
    return `<div class="sf ${f.max > 100 ? 'full' : ''}">${lab}<input type="text" id="${id}" name="${f.k}" maxlength="${f.max}" value="${e(val(f))}" ${f.placeholder ? `placeholder="${e(f.placeholder)}"` : ''}>${h}</div>`;
  };
  const fieldsOf = (ids) => fields.filter((f) => ids.includes(f.g)).map(field).join('').replace(/ name="/g, ' form="main" name="');
  const grpCard = (id) => { const g = groups.find((x) => x.id === id); return g ? `<section class="card" id="g-${g.id}"><h2>${e(g.title)}</h2><p class="bl">${e(g.blurb)}</p><div class="grid">${fieldsOf([g.id])}</div></section>` : ''; };
  const TABS = [
    ['registration', 'Registration', 'Open/close, seats, dates', grpCard('registration'), true],
    ['payment', 'Fees & payment', 'Fees, Ticket2U links, early bird', grpCard('payment'), true],
    ['event', 'Event details', 'Dates, venue, map, poster size', grpCard('event'), true],
    ['certificates', 'Certificates', 'Signatory and signature', grpCard('cert') + `__SIG__`, true],
    ['emails', 'Emails', 'Sender, confirmation, Zoho, test', grpCard('mail') + `<section class="card sf" id="mailtools"><h2>Sending email</h2><p class="bl">The Zoho password the site sends with, and a test.</p>__MAILTOOLS__</section>`, true],
    ['security', 'Sign-in & security', 'Google/email sign-in, spam limits, admin login', grpCard('signin') + grpCard('abuse') + `__ACCT__`, true],
    ['subs', 'Submissions', 'Abstract, extended abstract, full paper, templates', grpCard('subs') + tplCard(), true],
    ['website', 'Website & search', 'Announcement, Google/Bing verification', grpCard('site'), true],
    ['data', 'Data & tools', 'Backup, export, clean up, server', `<section class="card sf" id="tools"><h2>Data &amp; tools</h2><p class="bl">Back up the database, export participants and clean up.</p>__DATATOOLS__</section>__SERVER__`, false],
  ];
  const msgs = (flash.ok ? `<div class="ok" role="status">${e(flash.ok)}</div>` : '') + (flash.err.length ? `<div class="bad" role="alert"><ul>${flash.err.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : '');
  const st = (ok, yes, no) => `<span class="pill ${ok ? 'y' : 'n'}">${ok ? yes : no}</span>`;
  const sigSrc = status.sigData ? `${B}/admin/signature?v=${encodeURIComponent(status.sigVer)}` : '';
  const hidCsrf = `<input type="hidden" name="csrf" value="${e(csrf)}">`;
  const parts = { __SIG__: `  <section class="card" id="signature"><h2>Signature image</h2><p class="bl">Optional. Printed above the signatory’s name on every certificate. Any PNG or JPEG, any size; it is resized automatically. A transparent background looks best.</p>
    <div class="sig"><div class="box" id="sigbox">${sigSrc ? `<img src="${sigSrc}" alt="Current signature">` : 'No signature uploaded'}</div>
    <div><input type="file" id="sigfile" accept="image/png,image/jpeg" style="display:none"><button type="button" class="b2" id="sigpick">Choose image…</button> ${sigSrc ? '<button type="button" class="b2 dng" id="sigdel">Remove</button>' : ''}<div class="h" id="sigmsg" style="font-size:13px;color:var(--muted);margin-top:8px"></div></div></div>
  </section>
`, __MAILTOOLS__: `    <form method="post" action="${B}/admin/settings/smtp-pass" class="row" style="margin-bottom:26px" autocomplete="off">${hidCsrf}
      <div><label class="l" for="sp">Email (Zoho) password for ${e(cfg.smtp.user)}</label><input type="password" id="sp" name="pass" autocomplete="new-password" placeholder="${cfg.smtpPassSource ? 'Saved — type a new one to replace it' : 'Not set — emails cannot be sent'}">
        <p class="h" style="margin-top:6px">${cfg.smtpPassSource === 'settings' ? 'Saved here in the website’s database, so redeploys keep it.' : cfg.smtpPassSource === 'environment' ? 'Currently taken from the SMTP_PASS environment variable on the server.' : '<b style="color:#B91C1C">No email password is set, so verification codes, confirmations and speaker invitations cannot be sent.</b>'} If your Zoho account uses two-step sign-in, use a Zoho app password.</p></div>
      <div style="flex:none"><button class="b2 pri" type="submit">Save &amp; test</button></div>
      ${cfg.smtpPassSource === 'settings' ? `<div style="flex:none"><button class="b2" type="submit" name="clear" value="1">Remove</button></div>` : ''}</form>
    <form method="post" action="${B}/admin/settings/test-email" class="row" style="margin-bottom:26px">${hidCsrf}
      <div><label class="l" for="te">Send a test email to</label><input type="email" id="te" name="to" placeholder="you@example.com" required></div><div style="flex:none"><button class="b2" type="submit">Send test</button></div>
      <div style="flex:none"><a class="b2" href="${B}/admin/mail-test">Run full email diagnostics</a></div></form>
`, __ACCT__: `  <section class="card sf" id="account"><h2>Admin account</h2><p class="bl">Change the organiser login. You must enter the current password. Use at least 10 characters.</p>
    <form method="post" action="${B}/admin/settings/password" autocomplete="off">${hidCsrf}
      <div class="grid">
        <div class="full"><label class="l" for="cur">Current password</label><input type="password" id="cur" name="current" required autocomplete="current-password"></div>
        <div><label class="l" for="nu">New username <span style="opacity:.6">(optional)</span></label><input type="text" id="nu" name="newuser" placeholder="${e(cfg.adminUser)}" autocomplete="off"></div><div></div>
        <div><label class="l" for="np">New password</label><input type="password" id="np" name="newpass" autocomplete="new-password"></div>
        <div><label class="l" for="np2">Repeat new password</label><input type="password" id="np2" name="newpass2" autocomplete="new-password"></div>
      </div><p style="margin-top:22px"><button class="b2 pri" type="submit">Update login</button></p>
    </form></section>
`, __DATATOOLS__: `    <div class="row" style="margin-bottom:26px"><div style="flex:none"><a class="b2 pri" href="${B}/admin/backup.sqlite">Download database backup</a></div><div style="flex:none"><a class="b2" href="${B}/admin/export.csv">Export all participants (CSV)</a></div></div>
    <form method="post" action="${B}/admin/settings/purge" style="margin-bottom:26px">${hidCsrf}<input type="hidden" name="what" value="pending"><button class="b2" type="submit">Clear unverified sign-ups &amp; rate-limit counters</button> <span class="h">${n(status.pending)} unverified sign-up(s) waiting.</span></form>
    <form method="post" action="${B}/admin/settings/reset" id="resetform" style="margin-bottom:26px">${hidCsrf}<button class="b2" type="submit">Reset settings to defaults</button></form>
    <div style="border-top:1px solid var(--rule);padding-top:22px"><h2 style="font-size:20px;color:#B91C1C">Danger zone</h2>
      <form method="post" action="${B}/admin/settings/purge" class="row">${hidCsrf}<input type="hidden" name="what" value="all">
        <div><label class="l" for="dc">Delete ALL ${n(status.registrations)} participants — type DELETE</label><input type="text" id="dc" name="confirm" autocomplete="off" placeholder="DELETE"></div>
        <div style="flex:none"><button class="b2 dng" type="submit">Delete everything</button></div></form></div>
`, __SERVER__: `  <section class="card" id="server"><h2>Server</h2><p class="bl">Set in the server’s <code>.env</code> file or hosting panel, so they can’t be changed here.</p>
    <dl class="kv"><dt>Website address</dt><dd>${e(status.siteUrl)}</dd>
      <dt>Email account</dt><dd>${e(status.smtpUser)} via ${e(status.smtpHost)} ${st(status.smtpPass, 'password set', 'SMTP_PASS missing')}</dd>
      <dt>Google sign-in</dt><dd>${st(status.googleConfigured, 'configured', 'not configured')}<br><span class="mut" style="color:var(--muted);font-size:13px">Redirect URI: ${e(status.googleRedirect)}</span></dd>
      <dt>Data folder</dt><dd>${e(status.dataDir)} (${(status.dbSize / 1048576).toFixed(1)} MB)</dd>
      <dt>Node.js</dt><dd>${e(status.node)}</dd></dl></section>
` };
  const panels = TABS.map(([id, t, sub, body, form]) => [id, t, sub, body.replace(/__(SIG|MAILTOOLS|ACCT|DATATOOLS|SERVER)__/g, (m) => parts[m]), form]).map(([id, t, sub, body, form]) => `<div class="tpanel" id="t-${id}" role="tabpanel" aria-labelledby="tb-${id}" data-form="${form ? 1 : 0}" hidden>${body}</div>`).join('');
  return baseHead(`Settings — ${cfg.eventName}`, css) + topbar('Settings', `<a href="${B}/admin">← Dashboard</a>`).replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Admin</span><h1>Settings</h1>
  <p class="lede">Changes apply immediately — no redeploy needed. Registration is currently <b>${isOpen && left > 0 ? 'open' : 'closed'}</b> · ${n(status.registrations)} registered · ${n(left)} seats left.</p>
  ${msgs}
  <form method="post" action="${B}/admin/settings" id="main" novalidate>${hidCsrf}</form>
  <div class="stabs">
    <nav class="tlist" role="tablist" aria-label="Settings sections">${TABS.map(([id, t, sub]) => `<button type="button" class="tbtn" role="tab" id="tb-${id}" aria-controls="t-${id}" data-tab="${id}"><b>${e(t)}</b><span>${e(sub)}</span><i class="dot" aria-hidden="true"></i></button>`).join('')}</nav>
    <div class="tbody">${panels}</div>
  </div>
  <div class="savebar" id="savebar"><div class="wrap"><span class="sbmsg" id="sbmsg">No unsaved changes.</span><span><button type="submit" form="main" class="b2 pri" id="savebtn">Save changes</button></span></div></div>
</div></main>
<script>
(function(){
  var btns=[].slice.call(document.querySelectorAll('.tbtn')),bar=document.getElementById('savebar'),sbm=document.getElementById('sbmsg'),dirty={};
  function show(id){var ok=false;btns.forEach(function(b){var on=b.dataset.tab===id;ok=ok||on;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;document.getElementById('t-'+b.dataset.tab).hidden=!on});
    if(!ok)return show(btns[0].dataset.tab);var p=document.getElementById('t-'+id);var sb=document.getElementById('tb-'+id);if(sb&&sb.parentNode.scrollWidth>sb.parentNode.clientWidth)sb.parentNode.scrollLeft=sb.offsetLeft-16;bar.classList.toggle('off',p.dataset.form!=='1');try{sessionStorage.setItem('admTab',id)}catch(e){}if(location.hash!=='#'+id)history.replaceState(null,'','#'+id)}
  btns.forEach(function(b,i){b.onclick=function(){show(b.dataset.tab)};b.onkeydown=function(e){var k=e.key==='ArrowDown'||e.key==='ArrowRight'?1:e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:0;if(k){e.preventDefault();var n=btns[(i+k+btns.length)%btns.length];n.focus();show(n.dataset.tab)}}});
  // errors: mark the tabs whose fields were rejected
  var errTab=null;document.querySelectorAll('.bad li').forEach(function(li){var t=li.textContent.split(':')[0].trim().toLowerCase();document.querySelectorAll('.tpanel label.l, .tpanel .sw b').forEach(function(l){if(t&&l.textContent.trim().toLowerCase()===t){var p=l.closest('.tpanel').id.slice(2);errTab=errTab||p;document.getElementById('tb-'+p).classList.add('err')}})});
  var start=(location.hash||'').slice(1);try{start=start||sessionStorage.getItem('admTab')}catch(e){}show(errTab||start||'registration');
  addEventListener('hashchange',function(){show(location.hash.slice(1))});
  var main=document.getElementById('main');
  function mark(el){if(!el||el.form!==main)return;var p=el.closest('.tpanel');if(!p)return;dirty[p.id]=1;document.getElementById('tb-'+p.id.slice(2)).classList.add('dirty');bar.classList.add('dirty');var n=Object.keys(dirty).length;sbm.textContent='Unsaved changes in '+n+' section'+(n>1?'s':'')+'. Saving keeps every section.'}
  document.addEventListener('input',function(e){mark(e.target)});document.addEventListener('change',function(e){mark(e.target)});
  main.addEventListener('submit',function(){dirty={}});
  document.addEventListener('submit',function(e){var m=e.target.getAttribute&&e.target.getAttribute('data-confirm');if(m&&!confirm(m))e.preventDefault()},true);
  addEventListener('beforeunload',function(e){if(Object.keys(dirty).length){e.preventDefault();e.returnValue=''}});
})();
(function(){
  var csrf=${JSON.stringify(csrf)}, base=${JSON.stringify(B)}, msg=document.getElementById('sigmsg');
  var pick=document.getElementById('sigpick'), file=document.getElementById('sigfile'), del=document.getElementById('sigdel');
  function post(o){o.csrf=csrf;return fetch(base+'/admin/settings/signature',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(o)}).then(function(r){return r.json()})}
  var rf=document.getElementById('resetform');if(rf)rf.addEventListener('submit',function(e){if(!confirm('Reset all settings above to the server defaults? Your admin password and signature are kept.'))e.preventDefault()});
  pick.onclick=function(){file.click()};
  // Any image size is fine: the browser shrinks it (keeping transparency) before upload; only ~56 px of height is printed on the certificate.
  function shrink(img){var s=Math.min(1,500/img.naturalHeight,1200/img.naturalWidth),out=null;
    for(var k=0;k<6;k++){var c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));var g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/png');if(out.length<650*1024)return out;s*=0.75}return out}
  file.onchange=function(){var f=file.files[0];if(!f)return;if((f.type||'').indexOf('image')!==0){msg.textContent='Please choose an image file (PNG or JPEG).';return}
    if(f.size>40*1024*1024){msg.textContent='That file is over 40 MB. Please choose a smaller one.';return}
    msg.textContent='Preparing…';var u=URL.createObjectURL(f),img=new Image();
    img.onerror=function(){URL.revokeObjectURL(u);msg.textContent='That image could not be read.'};
    img.onload=function(){var d=shrink(img);URL.revokeObjectURL(u);if(!d||d.length>690*1024){msg.textContent='Could not shrink that image enough. Try a simpler one.';return}
      msg.textContent='Uploading…';post({dataUrl:d}).then(function(j){if(j.ok)location.reload();else msg.textContent=j.error||'Upload failed.'}).catch(function(){msg.textContent='Upload failed.'})};img.src=u};
  if(del)del.onclick=function(){if(confirm('Remove the signature image?'))post({remove:true}).then(function(){location.reload()})};
})();
</script></body></html>`;
}

module.exports = { submissions, payments, login, dashboard, certificates, settings, baseHead, topbar };
