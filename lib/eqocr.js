// Equation OCR: an image of an equation (pasted or chosen by the author) → LaTeX.
// Uses Mathpix when MATHPIX_APP_ID/MATHPIX_APP_KEY are set, otherwise Claude (ANTHROPIC_API_KEY). Off when neither is set.
'use strict';
const env = process.env;
const provider = () => (env.MATHPIX_APP_ID && env.MATHPIX_APP_KEY ? 'mathpix' : env.ANTHROPIC_API_KEY ? 'claude' : '');
const enabled = () => !!provider();

const hits = new Map();   // per-user rate limit: 40 images an hour
function allow(who) {
  const now = Date.now(), h = (hits.get(who) || []).filter((t) => now - t < 3600e3);
  if (h.length >= 40) { hits.set(who, h); return false; }
  h.push(now); hits.set(who, h); return true;
}

const clean = (s) => String(s || '').trim()
  .replace(/^```(?:latex|tex)?\s*|\s*```$/g, '')
  .replace(/^\$\$([\s\S]*)\$\$$/, '$1').replace(/^\\\[([\s\S]*)\\\]$/, '$1').replace(/^\$([\s\S]*)\$$/, '$1').replace(/^\\\(([\s\S]*)\\\)$/, '$1')
  .trim();

async function claude(mime, b64) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.OCR_MODEL || 'claude-haiku-5-5', max_tokens: 1024,
      system: 'You convert images of mathematical equations into LaTeX. Reply with the LaTeX code of the equation only: no dollar signs, no code fences, no explanation. Use standard LaTeX that KaTeX can render (amsmath is fine). If the image has several equations, put each on its own line joined with \\\\. If there is no equation in the image, reply with exactly NONE.',
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: 'LaTeX for this equation:' }] }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
  const t = clean((j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''));
  return t === 'NONE' ? '' : t;
}

async function mathpix(mime, b64) {
  const r = await fetch('https://api.mathpix.com/v3/text', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', app_id: env.MATHPIX_APP_ID, app_key: env.MATHPIX_APP_KEY },
    body: JSON.stringify({ src: `data:${mime};base64,${b64}`, formats: ['latex_styled'], math_inline_delimiters: ['', ''], math_display_delimiters: ['', ''] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
  return clean(j.latex_styled || j.text || '');
}

// dataUrl → { latex } or { error }
async function read(who, dataUrl) {
  if (!enabled()) return { error: 'Equation recognition is not available.' };
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'Please use a PNG, JPEG or WebP image.' };
  if (m[2].length > 5.5e6) return { error: 'The image is too large (4 MB at most).' };
  if (!allow(who)) return { error: 'Too many images in the last hour. Please try again later.' };
  try {
    const latex = await (provider() === 'mathpix' ? mathpix : claude)(m[1], m[2]);
    return latex ? { latex: latex.slice(0, 4000) } : { error: 'No equation was found in the image. Try a tighter crop.' };
  } catch (e) {
    console.error('[eq-ocr]', e.message);
    return { error: 'The equation could not be read just now. Please try again.' };
  }
}

module.exports = { enabled, read };
