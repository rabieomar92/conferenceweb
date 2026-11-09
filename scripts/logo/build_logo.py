#!/usr/bin/env python3
"""ICSSST 2027 logo, redrawn as flat vector art.

Every shape is a single flat colour from PALETTE (no gradients, no soft shading), and all lettering is
TeX Gyre Pagella Bold, shaped with HarfBuzz (kerning) and converted to outlines, so the SVG renders the
same everywhere without the font installed.

    python3 scripts/logo/build_logo.py [path/to/texgyrepagella-bold.otf]

writes public/assets/icssst-logo.svg (full logo) and public/assets/icssst-mark.svg (artwork only).
Needs: fonttools, uharfbuzz.
"""
import math, os, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrepagella-bold.otf'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets')

PALETTE = {
    'navy': '#12285C',     # main navy (text, deck, pylons, crescent)
    'navy2': '#2D4B8E',    # second navy step (cube side faces, cables)
    'gold': '#F2A900',     # main gold (2027, rules, atoms, bonds, swoosh)
    'sun': '#F9C93C',      # lighter gold step (sun disc, cube tops)
    'lamp': '#D7263D',     # pylon lamps
    'white': '#FFFFFF',
}
N, N2, G, SUN, LAMP, W = (PALETTE[k] for k in ('navy', 'navy2', 'gold', 'sun', 'lamp', 'white'))

# ── text to outlines ─────────────────────────────────────────────────────────
blob = hb.Blob.from_file_path(FONT); face = hb.Face(blob); hbfont = hb.Font(face)
tt = TTFont(FONT); gs = tt.getGlyphSet(); order = tt.getGlyphOrder(); UPM = tt['head'].unitsPerEm

def shape(text, size, track=0.0):
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbfont, buf, {'kern': True, 'liga': False})
    out, x = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((order[info.codepoint], x + pos.x_offset * size / UPM))
        x += pos.x_advance * size / UPM + track * size
    return out, x - track * size

def text_path(text, size, x0, baseline, track=0.0):
    glyphs, width = shape(text, size, track)
    d = []
    for name, gx in glyphs:
        pen = SVGPathPen(gs)
        s = size / UPM
        gs[name].draw(TransformPen(pen, (s, 0, 0, -s, x0 + gx, baseline)))
        d.append(pen.getCommands())
    return ' '.join(d), width

def width_of(text, size, track=0.0): return shape(text, size, track)[1]

def fit_size(text, width, track=0.0):            # font size that makes `text` exactly `width` wide
    return width / width_of(text, 100, track) * 100

# ── geometry helpers ─────────────────────────────────────────────────────────
def pt(c, r, deg): a = math.radians(deg); return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
f = lambda v: f'{v:.1f}'
P = lambda p: f'{f(p[0])},{f(p[1])}'

def deck_top(x):                                  # gently rising deck (perspective: far end on the left)
    return 463 - 72 * (1 - (1 - (x - 180) / 980) ** 1.6)
def deck_th(x): return 5 + 22 * ((x - 180) / 980) ** 1.25

parts = []
add = parts.append

# 1. sun (one flat disc, cut off at the water line)
add(f'<clipPath id="above"><rect x="0" y="0" width="1600" height="470"/></clipPath>')
add(f'<circle cx="596" cy="352" r="172" fill="{SUN}" clip-path="url(#above)"/>')

# 2. arc: thin gold band on the left, navy crescent on the right (circle fitted to the original)
C, R = (822.9, 384.8), 364.0
def band(a_from, a_to, r_out, thick, steps=90, ease=1.0):   # crescent: zero width at both ends, `thick` in the middle
    o, i = [], []
    for k in range(steps + 1):
        t = k / steps; a = a_from + (a_to - a_from) * t
        w = thick * math.sin(math.pi * t) ** ease
        o.append(pt(C, r_out, a)); i.append(pt(C, r_out - w, a))
    return 'M' + ' L'.join(P(q) for q in o + i[::-1]) + ' Z'
add(f'<path d="{band(214, 300, R + 6, 17, ease=.7)}" fill="{G}"/>')       # gold sweep over the top
add(f'<path d="{band(268, 358, R + 14, 46, ease=.9)}" fill="{N}"/>')      # navy crescent on the right

# 4. piers (perspective spacing) and their reflections
x = 1105.0
while x > 190:
    top = deck_top(x) + deck_th(x); w = 3 + 15 * ((x - 180) / 980) ** 1.2
    add(f'<rect x="{f(x - w / 2)}" y="{f(top - 2)}" width="{f(w)}" height="{f(476 - top + 2)}" fill="{N}"/>')
    x -= 9 + 52 * ((x - 180) / 980) ** 1.35

# 5. pylons with cable fans
PYL = [(554, 229, 9), (644, 222, 10), (771, 99, 15), (901, 105, 16)]   # x, top y, width
for px, ty, pw in PYL:
    dy = deck_top(px)
    span = 115 if pw < 12 else 175
    n = 7 if pw < 12 else 10
    for side in (-1, 1):
        for k in range(n):
            ay = ty + 18 + k * (dy - ty - 40) / n * 0.55
            bx = px + side * span * (k + 1) / n
            add(f'<line x1="{f(px)}" y1="{f(ay)}" x2="{f(bx)}" y2="{f(deck_top(bx) + 1)}" stroke="{N2}" stroke-width="1.6"/>')
for px, ty, pw in PYL:
    add(f'<path d="M{f(px - pw * .35)},{ty} L{f(px + pw * .35)},{ty} L{f(px + pw / 2)},476 L{f(px - pw / 2)},476 Z" fill="{N}"/>')
    add(f'<rect x="{f(px - pw * .45)}" y="{ty - 14}" width="{f(pw * .9)}" height="12" fill="{LAMP}"/>')
    add(f'<path d="M{f(px - pw * .6)},{ty - 14} L{f(px)},{ty - 24} L{f(px + pw * .6)},{ty - 14} Z" fill="{G}"/>')

# 6. deck: navy body, gold light strip, lamp posts
xs = [180 + i * 4 for i in range(246)]
top = ' '.join(f'L{f(x)},{f(deck_top(x))}' for x in xs)
bot = ' '.join(f'L{f(x)},{f(deck_top(x) + deck_th(x))}' for x in reversed(xs))
add(f'<path d="M180,{f(deck_top(180))} {top} {bot} Z" fill="{N}"/>')
strip = ' '.join(f'L{f(x)},{f(deck_top(x) + deck_th(x) * .28)}' for x in reversed(xs))
add(f'<path d="M180,{f(deck_top(180))} {top} {strip} Z" fill="{G}"/>')
x = 205.0
while x < 1150:
    h = 7 + 14 * ((x - 180) / 980)
    add(f'<rect x="{f(x - .9)}" y="{f(deck_top(x) - h)}" width="1.8" height="{f(h)}" fill="{N}"/><circle cx="{f(x)}" cy="{f(deck_top(x) - h)}" r="{f(1.6 + h * .12)}" fill="{G}"/>')
    x += 20 + 26 * ((x - 180) / 980)

# 7. swooshes: navy wave over a gold wave (flat bands between two curves)
add(f'<path d="M300,520 C620,462 980,508 1420,440 C1010,534 640,490 300,520 Z" fill="{N}"/>')
add(f'<path d="M560,512 C840,492 1120,508 1440,458 C1150,532 860,512 560,512 Z" fill="{G}"/>')

# 8. crystal lattice: isometric cubes (three flat faces) under a gold bond network with atoms
def cube(cx, cy, s):
    t = [(cx, cy - s), (cx + s * .866, cy - s / 2), (cx, cy), (cx - s * .866, cy - s / 2)]
    l = [(cx - s * .866, cy - s / 2), (cx, cy), (cx, cy + s), (cx - s * .866, cy + s / 2)]
    r = [(cx, cy), (cx + s * .866, cy - s / 2), (cx + s * .866, cy + s / 2), (cx, cy + s)]
    poly = lambda pts, col: f'<path d="M{" L".join(P(p) for p in pts)} Z" fill="{col}"/>'
    return poly(t, SUN) + poly(l, N) + poly(r, N2)
LC, S = (1280, 342), 52
cubes = [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1), (0, -2), (2, 0), (0, 2)]
for i, j in sorted(cubes, key=lambda c: c[1]):
    add(cube(LC[0] + i * S * .866, LC[1] + j * S * .75, S * .62))
for cx, cy, s in [(1430, 286, 14), (1452, 382, 12), (1408, 470, 13), (1150, 470, 11)]:
    add(cube(cx, cy, s))
hexv = lambda c, r: [pt(c, r, 30 + 60 * k) for k in range(6)]
nodes, bonds = [], []
for c in [(LC[0] - S * .866, LC[1] - S * .25), (LC[0] + S * .866, LC[1] - S * .25), (LC[0], LC[1] + S * 1.25)]:
    v = hexv(c, S * 1.0)
    for k in range(6): bonds.append((v[k], v[(k + 1) % 6]))
    nodes += v
uniq = []
for n in nodes:
    if all(math.hypot(n[0] - u[0], n[1] - u[1]) > 6 for u in uniq): uniq.append(n)
for a, b in bonds:
    add(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{G}" stroke-width="4" stroke-linecap="round"/>')
for n in uniq:
    add(f'<circle cx="{f(n[0])}" cy="{f(n[1])}" r="10.5" fill="{G}"/>')

art = '\n'.join(parts)

# ── lettering (TeX Gyre Pagella Bold, outlined) ──────────────────────────────
L, Rx = 132, 1468                                # rule span
d1, w1 = text_path('ICSSST', 100, 0, 0)
d2, w2 = text_path('2027', 100, 0, 0)
size, tr, gap = 184, 0.025, 0.06                  # cap height 0.681 × 184 ≈ 125 px
wa, wb = width_of('ICSSST', size, tr), width_of('2027', size, tr)
total = wa + gap * size + wb
x0 = 800 - total / 2; base = 672
t1, w1 = text_path('ICSSST', size, x0, base, tr)
t2, w2 = text_path('2027', size, x0 + wa + gap * size, base, tr)
sub = 'INTERNATIONAL CONFERENCE ON SOLID STATE SCIENCE AND TECHNOLOGY'
ssz = fit_size(sub, Rx - L - 30, 0.01)
t3, w3 = text_path(sub, ssz, L + 15, 741, 0.01)
pen = 'PENANG, MALAYSIA'
psz = 50; ptr = 0.12
t4, w4 = text_path(pen, psz, (L + Rx) / 2 - width_of(pen, psz, ptr) / 2, 830, ptr)
lettering = f'''<path d="{t1}" fill="{N}"/>
<path d="{t2}" fill="{G}"/>
<rect x="{L}" y="693" width="{Rx - L}" height="6" fill="{G}"/>
<path d="{t3}" fill="{N}"/>
<rect x="{L}" y="758" width="{Rx - L}" height="6" fill="{G}"/>
<path d="{t4}" fill="{N}"/>'''

import re
_num = re.compile(r'-?\d+\.\d{2,}')
def svg(body, vb, title):
    body = _num.sub(lambda m: f'{float(m.group()):.1f}', body)   # 0.1 px precision keeps the file small
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n{body}\n</svg>\n')

open(os.path.join(OUT, 'icssst-logo.svg'), 'w').write(svg(art + '\n' + lettering, '110 0 1380 850',
    'ICSSST 2027 — International Conference on Solid State Science and Technology, Penang, Malaysia'))
open(os.path.join(OUT, 'icssst-mark.svg'), 'w').write(svg(art, '150 0 1320 560', 'ICSSST 2027'))
print('font sizes: title %.1f, subtitle %.1f, place %d' % (size, ssz, psz))
