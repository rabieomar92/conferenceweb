'use strict';
const cfg = require('../config');
const { e } = require('./views');
const B = cfg.base;
const av = require('./assetv');
const myTime = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const baseHead = (title, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="${B}/assets/site.css?v=${av('site.css')}"><script src="${B}/assets/loader.js?v=${av('loader.js')}"></script><script src="${B}/assets/select.js?v=${av('select.js')}" defer></script>${extra}</head><body>`;
const ADM_TABS = [['Admin', '/admin', 'Participants'], ['Payments', '/admin/payments', 'Payments'], ['Speakers', '/admin/speakers', 'Speakers'], ['Certificates', '/admin/certificates', 'Certificates'], ['Settings', '/admin/settings', 'Settings']];
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
.selbar{display:none;background:#FFF7E6;border:1px solid #E9D3A2;padding:11px 16px;margin-bottom:12px;font-size:14px}.selbar.on{display:block}
.selbar button{background:none;border:0;color:var(--amber);font:700 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;cursor:pointer;text-decoration:underline;padding:0 0 0 6px}
.pg{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:22px}
.pg a,.pg span.cur,.pg span.gap{min-width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border:1px solid var(--rule);background:#fff;color:var(--navy);text-decoration:none;font-size:14px}
.pg a:hover{border-color:var(--navy)}.pg span.cur{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700}.pg span.gap{border:0;background:none;min-width:20px;padding:0}.pg .off{opacity:.35;pointer-events:none}
.pg form{display:inline-flex;gap:6px;margin-left:12px;align-items:center;font-size:13px;color:var(--muted)}.pg form input{width:70px;border:1px solid var(--rule);padding:9px 10px;font:400 14px 'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;outline:none}
@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}.stats div{padding:20px 18px;border-bottom:1px solid var(--rule)}.stats div:nth-child(2n){border-right:0}.stats div:nth-child(n+3){border-bottom:0}.stats b{font-size:36px}.stats span{letter-spacing:.16em}.bar>*{flex:1 1 140px;min-width:0}.bar input[type=search]{flex-basis:100%;min-width:0}}</style>`;
  const trs = rows.map((r) => `<tr>
      <td><input type="checkbox" name="ids" value="${r.id}" class="sel"></td>
      <td class="mut">${e(r.ref)}</td><td><b>${e([r.salutation, r.full_name].filter(Boolean).join(' '))}</b>${r.designation ? `<br><span class="mut">${e(r.designation)}</span>` : ''}${r.participation ? `<br><span class="tag">${e(r.participation.replace(' (non-presenting)', ''))}</span>` : ''}</td>
      <td>${e(r.email)}<br><span class="mut">${e(r.phone)}</span></td>
      <td>${e(r.organisation)}<br><span class="mut">${e(r.country)}</span></td>
      <td>${e(r.category)}<br><span class="mut">${e(r.fee || '')}</span></td>
      <td><span class="tag ${r.pay_status === 'paid' || r.pay_status === 'waived' ? 'y' : r.pay_status === 'claimed' ? 'c' : 'n'}">${e(PAYLBL[r.pay_status] || 'Unpaid')}</span>${r.pay_ref ? `<br><span class="mut">${e(r.pay_ref)}</span>` : ''}</td><td class="mut">${e(myTime(r.created_at))}${r.method === 'google' ? '<br><span class="mut">via Google</span>' : ''}</td>
      <td><span class="tag ${r.attended ? 'y' : ''}">${r.attended ? 'Attended' : '—'}</span></td>
      <td><a class="b2" style="padding:8px 12px" href="${B}/admin/certificates?ids=${r.id}">${r.cert_issued_at ? 'Re-issue' : 'Generate'}</a></td></tr>`).join('');
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
    <button type="button" class="b2 pri" id="certSel">Certificates · selected</button>
    <a class="b2" href="${B}/admin/export.csv${allQS}">Export CSV${filtered ? ' (filtered)' : ''}</a>
    <button type="button" class="b2 dng" data-act="delete">Delete</button>
  </div>
  <div class="selbar" id="selbar"></div>
  <div class="tw"><table id="tbl"><thead><tr><th><input type="checkbox" id="all" aria-label="Select all on this page"></th><th>Ref</th><th>Name</th><th>Email / Phone</th><th>Organisation</th><th>Category / Fee</th><th>Payment</th><th>Registered</th><th>Attended</th><th>Certificate</th></tr></thead><tbody>${trs}</tbody></table>
  ${rows.length ? '' : `<div class="empty">${filtered ? 'No participants match these filters.' : 'No registrations yet.'}</div>`}</div></form>
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
  if(act==='delete'){
    if(scope.value==='all'){const t=prompt('This will permanently delete ALL '+nf(n)+' matching participants.\\nType DELETE to confirm.');if(t!=='DELETE')return;document.getElementById('conf').value='DELETE'}
    else if(!confirm('Permanently delete '+n+' registration(s)?'))return;
  }
  document.getElementById('bact').value=act; f.submit();});
document.getElementById('certSel').onclick=()=>{
  if(!count()){alert('Select at least one participant first.');return}
  location.href='${B}/admin/certificates'+(scope.value==='all'?(QS?'?'+QS:'?scope=all'):'?ids='+sels().map(c=>c.value).join(','))};
</script></body></html>`;
}

function payments({ csrf, flash, t2u, fees, claimed, st = {}, paidBy = [] }) {
  const css = `<style>.adm{padding:44px 0 90px}.adm h1{font-size:42px;color:var(--navy);margin:8px 0 18px}.adm h2{font-size:22px;color:var(--navy);margin:44px 0 12px}
.card{background:#fff;border:1px solid var(--rule);padding:26px 28px;margin-bottom:22px}.mut{color:var(--muted);font-size:14px}
.b2{background:#fff;color:var(--navy);border:1px solid var(--navy);padding:12px 18px;font:700 11px 'TeX Gyre Pagella',Palatino,Georgia,serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none}.b2.pri{background:var(--navy);color:#fff}.b2:disabled{opacity:.4;cursor:default}
textarea{width:100%;min-height:150px;border:1px solid var(--rule);padding:12px;font:13px ui-monospace,Menlo,Consolas,monospace}
table{border-collapse:collapse;width:100%;font-size:14.5px;background:#fff}th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber);padding:10px;border-bottom:1px solid var(--rule)}td{padding:10px;border-bottom:1px solid #EFEBE3;vertical-align:top}
.tw{overflow-x:auto;border:1px solid var(--rule)}.err{background:#FDECEC;border:1px solid #F3B9B9;color:#8A1C1C;padding:12px 16px;margin:12px 0}.okmsg{background:#EEF6EF;border:1px solid #BBD9C1;color:#1F5130;padding:14px 18px;margin:12px 0}
ol.howto{margin:10px 0 0 20px;line-height:1.7}.sum{display:flex;gap:26px;flex-wrap:wrap;margin:16px 0}.sum b{font-size:30px;display:block;color:var(--navy)}</style>`;
  const linkRows = (fees || []).map((f) => `<tr><td>${e(f.name)}</td><td>${e(f.fee)}</td><td>${f.url ? `<a href="${e(f.url)}" target="_blank" rel="noopener">${e(f.url)}</a>` : t2u ? '<span class="mut">general event link</span>' : '<b style="color:#9A3B00">no link yet</b>'}</td></tr>`).join('');
  return baseHead(`Payments — ${cfg.eventName}`, css) + topbar('Payments', `<a href="${B}/admin">Participants</a><a href="${B}/admin/settings">Settings</a>`).replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Ticket2U</span><h1>Payments</h1>
  ${flash && flash.ok ? `<div class="okmsg">${e(flash.ok)}</div>` : ''}
  <div class="card"><b>How Ticket2U payment works</b>
    <ol class="howto"><li>Participants register here, then press <b>Pay with Ticket2U</b> on their registration page. It opens the Ticket2U link for their category (set under <a href="${B}/admin/settings#payment">Settings → Fees &amp; payment</a>).</li>
    <li>They pay on Ticket2U with the same email address and, if your Ticket2U form asks for it, their reference (IC27-…). Ticket2U holds the money and pays it out to the organiser’s bank account on its settlement schedule.</li>
    <li>Here, paste or upload the attendee / sales export from your Ticket2U organiser dashboard. Each paid row is matched to a registration by reference or email, and marked <b>Paid</b> (the participant gets an email).</li>
    <li>Payments made some other way (LO, bank transfer) can be marked paid or waived on the Participants page.</li></ol></div>
  <h2>Payment links</h2>
  <div class="tw"><table><tr><th>Category</th><th>Fee</th><th>Ticket2U link</th></tr>${linkRows}</table></div>
  <p class="mut" style="margin-top:8px">General event link: ${t2u ? `<a href="${e(t2u)}" target="_blank" rel="noopener">${e(t2u)}</a>` : '<b style="color:#9A3B00">not set — participants see “Payment opens soon”</b>'}</p>

  <h2>Import a Ticket2U export</h2>
  <div class="card">
    <p class="mut">CSV or tab-separated, with a heading row. An <b>Email</b> column is required; order number, amount, status and a reference/registration column are used when present. Cancelled, refunded or pending rows are skipped.</p>
    <p style="margin:14px 0"><input type="file" id="file" accept=".csv,.tsv,.txt,text/csv"></p>
    <textarea id="csv" placeholder="…or paste the export here"></textarea>
    <p style="margin-top:14px;display:flex;gap:10px"><button class="b2" id="prev" type="button">Check matches</button><button class="b2 pri" id="apply" type="button" disabled>Mark matched as paid</button></p>
    <div id="out"></div>
  </div>

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
  <h2>Told us they paid (${claimed.length})</h2>
  <p class="mut">Participants who entered a Ticket2U order number but are not confirmed yet. Check the order in Ticket2U, then mark them paid from the <a href="${B}/admin?pay=claimed">Participants page</a>.</p>
  <div class="tw"><table><tr><th>Ref</th><th>Name</th><th>Email</th><th>Category</th><th>Order no.</th><th>Since</th></tr>${claimed.map((r) => `<tr><td>${e(r.ref)}</td><td>${e(r.full_name)}</td><td>${e(r.email)}</td><td>${e(r.category)}<br><span class="mut">${e(r.fee || '')}</span></td><td><b>${e(r.pay_ref || '')}</b></td><td class="mut">${r.pay_claimed_at ? e(myTime(r.pay_claimed_at)) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">Nobody waiting.</td></tr>'}</table></div>
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
  const sections = groups.map((g) => `<section class="card" id="${g.id}"><h2>${e(g.title)}</h2><p class="bl">${e(g.blurb)}</p><div class="grid">${fields.filter((f) => f.g === g.id).map(field).join('')}</div></section>`).join('');
  const msgs = (flash.ok ? `<div class="ok" role="status">${e(flash.ok)}</div>` : '') + (flash.err.length ? `<div class="bad" role="alert"><ul>${flash.err.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : '');
  const st = (ok, yes, no) => `<span class="pill ${ok ? 'y' : 'n'}">${ok ? yes : no}</span>`;
  const sigSrc = status.sigData ? `${B}/admin/signature?v=${encodeURIComponent(status.sigVer)}` : '';
  const hidCsrf = `<input type="hidden" name="csrf" value="${e(csrf)}">`;
  return baseHead(`Settings — ${cfg.eventName}`, css) + topbar('Settings', `<a href="${B}/admin">← Dashboard</a>`).replace('__CSRF__', e(csrf)) + `
<main class="adm"><div class="wrap">
  <span class="label">Admin</span><h1>Settings</h1>
  <p class="lede">Changes apply immediately — no redeploy needed. Registration is currently <b>${isOpen && left > 0 ? 'open' : 'closed'}</b> · ${n(status.registrations)} registered · ${n(left)} seats left.</p>
  ${msgs}
  <nav class="snav" aria-label="Sections">${groups.map((g) => `<a href="#${g.id}">${e(g.title)}</a>`).join('')}<a href="#account">Admin account</a><a href="#tools">Tools &amp; data</a><a href="#server">Server</a></nav>
  <form method="post" action="${B}/admin/settings" id="main" novalidate>${hidCsrf}
    ${sections}
    <div class="savebar"><div class="wrap"><span class="mut" style="font-size:14px;color:var(--muted)">Edit anything above, then save.</span><span><button type="submit" class="b2 pri">Save changes</button></span></div></div>
  </form>

  <section class="card" id="signature"><h2>Signature image</h2><p class="bl">Optional. Printed above the signatory’s name on every certificate. Any PNG or JPEG, any size; it is resized automatically. A transparent background looks best.</p>
    <div class="sig"><div class="box" id="sigbox">${sigSrc ? `<img src="${sigSrc}" alt="Current signature">` : 'No signature uploaded'}</div>
    <div><input type="file" id="sigfile" accept="image/png,image/jpeg" style="display:none"><button type="button" class="b2" id="sigpick">Choose image…</button> ${sigSrc ? '<button type="button" class="b2 dng" id="sigdel">Remove</button>' : ''}<div class="h" id="sigmsg" style="font-size:13px;color:var(--muted);margin-top:8px"></div></div></div>
  </section>

  <section class="card sf" id="account"><h2>Admin account</h2><p class="bl">Change the organiser login. You must enter the current password. Use at least 10 characters.</p>
    <form method="post" action="${B}/admin/settings/password" autocomplete="off">${hidCsrf}
      <div class="grid">
        <div class="full"><label class="l" for="cur">Current password</label><input type="password" id="cur" name="current" required autocomplete="current-password"></div>
        <div><label class="l" for="nu">New username <span style="opacity:.6">(optional)</span></label><input type="text" id="nu" name="newuser" placeholder="${e(cfg.adminUser)}" autocomplete="off"></div><div></div>
        <div><label class="l" for="np">New password</label><input type="password" id="np" name="newpass" autocomplete="new-password"></div>
        <div><label class="l" for="np2">Repeat new password</label><input type="password" id="np2" name="newpass2" autocomplete="new-password"></div>
      </div><p style="margin-top:22px"><button class="b2 pri" type="submit">Update login</button></p>
    </form></section>

  <section class="card sf" id="tools"><h2>Tools &amp; data</h2><p class="bl">Send a test email, back up the database and clean up.</p>
    <form method="post" action="${B}/admin/settings/smtp-pass" class="row" style="margin-bottom:26px" autocomplete="off">${hidCsrf}
      <div><label class="l" for="sp">Email (Zoho) password for ${e(cfg.smtp.user)}</label><input type="password" id="sp" name="pass" autocomplete="new-password" placeholder="${cfg.smtpPassSource ? 'Saved — type a new one to replace it' : 'Not set — emails cannot be sent'}">
        <p class="h" style="margin-top:6px">${cfg.smtpPassSource === 'settings' ? 'Saved here in the website’s database, so redeploys keep it.' : cfg.smtpPassSource === 'environment' ? 'Currently taken from the SMTP_PASS environment variable on the server.' : '<b style="color:#B91C1C">No email password is set, so verification codes, confirmations and speaker invitations cannot be sent.</b>'} If your Zoho account uses two-step sign-in, use a Zoho app password.</p></div>
      <div style="flex:none"><button class="b2 pri" type="submit">Save &amp; test</button></div>
      ${cfg.smtpPassSource === 'settings' ? `<div style="flex:none"><button class="b2" type="submit" name="clear" value="1">Remove</button></div>` : ''}</form>
    <form method="post" action="${B}/admin/settings/test-email" class="row" style="margin-bottom:26px">${hidCsrf}
      <div><label class="l" for="te">Send a test email to</label><input type="email" id="te" name="to" placeholder="you@example.com" required></div><div style="flex:none"><button class="b2" type="submit">Send test</button></div>
      <div style="flex:none"><a class="b2" href="${B}/admin/mail-test">Run full email diagnostics</a></div></form>
    <div class="row" style="margin-bottom:26px"><div style="flex:none"><a class="b2 pri" href="${B}/admin/backup.sqlite">Download database backup</a></div><div style="flex:none"><a class="b2" href="${B}/admin/export.csv">Export all participants (CSV)</a></div></div>
    <form method="post" action="${B}/admin/settings/purge" style="margin-bottom:26px">${hidCsrf}<input type="hidden" name="what" value="pending"><button class="b2" type="submit">Clear unverified sign-ups &amp; rate-limit counters</button> <span class="h">${n(status.pending)} unverified sign-up(s) waiting.</span></form>
    <form method="post" action="${B}/admin/settings/reset" id="resetform" style="margin-bottom:26px">${hidCsrf}<button class="b2" type="submit">Reset settings to defaults</button></form>
    <div style="border-top:1px solid var(--rule);padding-top:22px"><h2 style="font-size:20px;color:#B91C1C">Danger zone</h2>
      <form method="post" action="${B}/admin/settings/purge" class="row">${hidCsrf}<input type="hidden" name="what" value="all">
        <div><label class="l" for="dc">Delete ALL ${n(status.registrations)} participants — type DELETE</label><input type="text" id="dc" name="confirm" autocomplete="off" placeholder="DELETE"></div>
        <div style="flex:none"><button class="b2 dng" type="submit">Delete everything</button></div></form></div>
  </section>

  <section class="card" id="server"><h2>Server</h2><p class="bl">Set in the server’s <code>.env</code> file or hosting panel, so they can’t be changed here.</p>
    <dl class="kv"><dt>Website address</dt><dd>${e(status.siteUrl)}</dd>
      <dt>Email account</dt><dd>${e(status.smtpUser)} via ${e(status.smtpHost)} ${st(status.smtpPass, 'password set', 'SMTP_PASS missing')}</dd>
      <dt>Google sign-in</dt><dd>${st(status.googleConfigured, 'configured', 'not configured')}<br><span class="mut" style="color:var(--muted);font-size:13px">Redirect URI: ${e(status.googleRedirect)}</span></dd>
      <dt>Data folder</dt><dd>${e(status.dataDir)} (${(status.dbSize / 1048576).toFixed(1)} MB)</dd>
      <dt>Node.js</dt><dd>${e(status.node)}</dd></dl></section>
</div></main>
<script>
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

module.exports = { payments, login, dashboard, certificates, settings, baseHead, topbar };
