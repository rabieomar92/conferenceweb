'use strict';
// Stripe Checkout, without the SDK: a Checkout Session per payment, plus webhook signature checks.
// Keys come from the environment (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) and never reach the browser.
const crypto = require('crypto');
const cfg = require('../config');

const key = () => cfg.stripe.secretKey;
const configured = () => /^(sk|rk)_(test|live)_/.test(key());
const mode = () => (/_live_/.test(key()) ? 'live' : /_test_/.test(key()) ? 'test' : '');
const API = () => (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, '');

// Stripe wants form-encoded bodies with bracketed keys: line_items[0][price_data][currency]=myr
function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, name, out);
    else out.push(encodeURIComponent(name) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
async function call(method, path, params, idem) {
  const headers = { Authorization: 'Bearer ' + key(), 'Stripe-Version': '2024-06-20' };
  let body;
  if (params && method !== 'GET') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = form(params); }
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch(API() + path + (params && method === 'GET' ? '?' + form(params) : ''), { method, headers, body, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || 'Stripe error ' + r.status); e.status = r.status; e.code = j.error && j.error.code; throw e; }
  return j;
}

// "RM 1,200.00" → { currency: 'myr', amount: 120000 }, "USD 350" → { currency: 'usd', amount: 35000 }
function parseFee(text) {
  const m = /^\s*(RM|MYR|USD|US\$|\$)\s*([\d,]+(?:\.\d{1,2})?)\s*$/i.exec(String(text || ''));
  if (!m) return null;
  const cur = /^(RM|MYR)$/i.test(m[1]) ? 'myr' : 'usd';
  const amount = Math.round(parseFloat(m[2].replace(/,/g, '')) * 100);
  return amount >= 200 ? { currency: cur, amount } : null;            // Stripe minimum is about RM 2 / USD 0.50
}
const money = (currency, amount) => `${currency === 'myr' ? 'RM' : currency.toUpperCase()} ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function createCheckout(reg, site) {
  const p = parseFee(reg.fee);
  if (!p) throw new Error(`The fee “${reg.fee}” is not an amount Stripe can charge. Check the fee table in Admin → Settings.`);
  const s = await call('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    customer_email: reg.email,
    client_reference_id: String(reg.id),
    // payment methods (card, FPX, GrabPay…) follow what is switched on in the Stripe dashboard; FPX/GrabPay only appear for MYR
    line_items: [{ quantity: 1, price_data: { currency: p.currency, unit_amount: p.amount, product_data: { name: `${cfg.eventName} registration — ${reg.category}`, description: `${cfg.eventFull}, ${cfg.eventDateText}. Ref ${reg.ref}, ${reg.full_name}` } } }],
    metadata: { ref: reg.ref, reg_id: String(reg.id), category: reg.category },
    payment_intent_data: { receipt_email: reg.email, description: `${cfg.eventName} ${reg.ref} ${reg.full_name}`.slice(0, 300), metadata: { ref: reg.ref, reg_id: String(reg.id) } },
    success_url: `${site}/account/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/account?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }, `cs-${reg.id}-${reg.category}-${p.currency}${p.amount}-${Math.floor(Date.now() / 600000)}`);   // a double click reuses the same session
  return s;
}
const getSession = (id) => call('GET', '/v1/checkout/sessions/' + encodeURIComponent(id));

// Webhook: header "t=…,v1=…"; v1 = HMAC-SHA256(secret, `${t}.${rawBody}`); reject if older than 5 minutes
function verifyWebhook(raw, header, secret = cfg.stripe.webhookSecret, tolerance = 300) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  const parts = Object.create(null), sigs = [];
  for (const kv of String(header || '').split(',')) { const [k, v] = kv.split('='); if (k === 'v1') sigs.push(v); else parts[k] = v; }
  const t = Number(parts.t);
  if (!t || !sigs.length) throw new Error('missing signature');
  if (Math.abs(Date.now() / 1000 - t) > tolerance) throw new Error('timestamp outside tolerance');
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  if (!sigs.some((s) => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)))) throw new Error('bad signature');
  return JSON.parse(raw.toString('utf8'));
}

module.exports = { configured, mode, parseFee, money, createCheckout, getSession, verifyWebhook };
