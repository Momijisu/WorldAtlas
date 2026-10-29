"""Draw the example world's article header images (assets/demo/*.svg).

    python3 tools/demo_banners.py
"""
import math, random

W, H = 1600, 600

def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>{defs}</defs>{body}</svg>'

def ridge(rng, y0, amp, step, jag=0.5):
    """A jagged skyline path from left to right, closed along the bottom."""
    pts, x = [], -20
    while x <= W + 20:
        pts.append((x, y0 + rng.uniform(-amp, amp) * (1 if rng.random() > jag else 0.4)))
        x += rng.uniform(step * 0.6, step * 1.4)
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + f' L{W + 20} {H} L-20 {H}Z'

def varenhold():
    rng = random.Random(42)
    defs = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a26"/>'
            '<stop offset=".55" stop-color="#2c3a4c"/><stop offset=".8" stop-color="#5b5a68"/><stop offset="1" stop-color="#8a6f62"/></linearGradient>'
            '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fd4ff" stop-opacity=".75"/><stop offset="1" stop-color="#9fd4ff" stop-opacity="0"/></radialGradient>'
            '<linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4656"/><stop offset="1" stop-color="#151b24"/></linearGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    # storm clouds
    for i in range(14):
        cx, cy, rx = rng.uniform(-100, W + 100), rng.uniform(20, 220), rng.uniform(160, 380)
        if abs(cx - 805) < 260 and cy > 60: continue  # keep the floating city clear
        b.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{rx * 0.22:.0f}" fill="#0e131c" opacity="{rng.uniform(.25, .5):.2f}"/>')
    # distant hills and the river plain
    b.append(f'<path d="{ridge(rng, 430, 18, 90)}" fill="#26303d"/>')
    b.append(f'<rect y="470" width="{W}" height="130" fill="url(#river)"/>')
    # the granite spur
    b.append('<path d="M520 600 L560 470 L610 400 L650 330 L700 300 L800 292 L880 300 L940 330 L990 395 L1040 470 L1090 600Z" fill="#1d232c"/>')
    # lower city on the spur
    for i in range(46):
        x = rng.uniform(600, 1010); base = 300 + abs(x - 800) * 0.42 + rng.uniform(0, 40)
        w, h = rng.uniform(14, 34), rng.uniform(18, 54)
        b.append(f'<rect x="{x:.0f}" y="{base - h:.0f}" width="{w:.0f}" height="{h:.0f}" fill="#161b23"/>')
        if rng.random() < 0.55:
            b.append(f'<path d="M{x - 2:.0f} {base - h:.0f} L{x + w / 2:.0f} {base - h - rng.uniform(8, 18):.0f} L{x + w + 2:.0f} {base - h:.0f}Z" fill="#161b23"/>')
        for _ in range(rng.randint(0, 3)):
            b.append(f'<rect x="{x + rng.uniform(3, w - 5):.0f}" y="{base - rng.uniform(6, h - 4):.0f}" width="3" height="4" fill="#f2c46b" opacity="{rng.uniform(.6, 1):.2f}"/>')
    # the floating upper city: an inverted rock, its engine glowing beneath
    # a soft halo behind the floating city, then the city on its rock
    b.append('<ellipse cx="805" cy="170" rx="330" ry="150" fill="#7e93ad" opacity=".07"/>')
    b.append('<ellipse cx="805" cy="258" rx="70" ry="16" fill="url(#glow)" opacity=".8"/>')
    b.append('<path d="M640 182 L970 182 L935 205 L880 228 L835 250 L805 262 L775 250 L725 226 L675 204Z" fill="#3a4554"/>')
    b.append('<path d="M640 182 L970 182 L960 190 L650 190Z" fill="#5d6b7d"/>')
    for i in range(26):
        x = rng.uniform(655, 945); h = rng.uniform(26, 72) * (1.35 if abs(x - 805) < 45 else 1)
        w = rng.uniform(12, 26)
        b.append(f'<rect x="{x:.0f}" y="{182 - h:.0f}" width="{w:.0f}" height="{h + 2:.0f}" fill="#323c4a"/>')
        b.append(f'<path d="M{x - 3:.0f} {182 - h:.0f} L{x + w / 2:.0f} {182 - h - rng.uniform(10, 26):.0f} L{x + w + 3:.0f} {182 - h:.0f}Z" fill="#3a4554"/>')
        for _ in range(rng.randint(1, 3)):
            b.append(f'<rect x="{x + rng.uniform(3, w - 5):.0f}" y="{182 - rng.uniform(6, h - 4):.0f}" width="3" height="4" fill="#ffd98a"/>')
    # river reflections and rain
    for i in range(40):
        x = rng.uniform(0, W); y = rng.uniform(480, 590)
        b.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{rng.uniform(20, 90):.0f}" height="1.5" fill="#c9d6e6" opacity="{rng.uniform(.08, .25):.2f}"/>')
    rain = ''.join(f'M{x:.0f} {y:.0f}l-9 26' for x, y in ((rng.uniform(0, W + 200), rng.uniform(-30, H)) for _ in range(420)))
    b.append(f'<path d="{rain}" stroke="#cfdbea" stroke-width="1" opacity=".22"/>')
    return svg(''.join(b), defs)

def gloamwood():
    rng = random.Random(7)
    defs = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1a1c"/>'
            '<stop offset=".5" stop-color="#25403d"/><stop offset=".8" stop-color="#5d7a5c"/><stop offset="1" stop-color="#a7a67a"/></linearGradient>'
            '<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd9c4" stop-opacity="0"/><stop offset=".5" stop-color="#cfd9c4" stop-opacity=".28"/><stop offset="1" stop-color="#cfd9c4" stop-opacity="0"/></linearGradient>'
            '<radialGradient id="lamp"><stop offset="0" stop-color="#ffd27a"/><stop offset=".25" stop-color="#ffb84d" stop-opacity=".6"/><stop offset="1" stop-color="#ffb84d" stop-opacity="0"/></radialGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    for i in range(70):
        b.append(f'<circle cx="{rng.uniform(0, W):.0f}" cy="{rng.uniform(0, 200):.0f}" r="{rng.uniform(.6, 1.3):.1f}" fill="#fff" opacity="{rng.uniform(.2, .7):.2f}"/>')

    def pines(y0, colour, size, gap, mist=None):
        out = []
        x = -40
        while x < W + 40:
            h = size * rng.uniform(0.7, 1.35); w = h * rng.uniform(0.28, 0.36); base = y0 + rng.uniform(-12, 12)
            tiers = ''.join(f'M{x - w * (1 - t * 0.28):.0f} {base - h * t * 0.78:.0f} L{x:.0f} {base - h * (t * 0.78 + 0.42):.0f} L{x + w * (1 - t * 0.28):.0f} {base - h * t * 0.78:.0f}Z' for t in (0, 0.33, 0.66))
            out.append(f'<path d="{tiers}M{x - 2:.0f} {base:.0f}h4v{size * 0.2:.0f}h-4Z" fill="{colour}"/>')
            x += gap * rng.uniform(0.6, 1.3)
        out.append(f'<rect x="0" y="{y0:.0f}" width="{W}" height="{H - y0 + 10:.0f}" fill="{colour}"/>')
        if mist:
            out.append(f'<rect x="0" y="{y0 - mist:.0f}" width="{W}" height="{mist * 1.6:.0f}" fill="url(#mist)"/>')
        return ''.join(out)

    b.append(pines(330, '#2d4a45', 120, 34, mist=70))
    b.append(pines(410, '#1d332f', 170, 46, mist=60))
    # a winding path and lanterns
    b.append('<path d="M700 600 C 740 540, 860 520, 820 470 C 790 430, 880 420, 930 395" stroke="#b9ae7c" stroke-width="12" fill="none" opacity=".45" stroke-linecap="round"/>')
    for x, y in ((822, 462), (930, 392), (720, 540), (1040, 430), (560, 470)):
        b.append(f'<circle cx="{x}" cy="{y}" r="60" fill="url(#lamp)" opacity=".9"/><circle cx="{x}" cy="{y}" r="4" fill="#fff4d6"/>')
    b.append(pines(575, '#0e1b19', 200, 80))
    for i in range(30):
        b.append(f'<circle cx="{rng.uniform(0, W):.0f}" cy="{rng.uniform(300, 560):.0f}" r="1.6" fill="#e8f5a0" opacity="{rng.uniform(.4, .9):.2f}"/>')
    return svg(''.join(b), defs)

for name, make in (('varenhold', varenhold), ('gloamwood', gloamwood)):
    with open(f'assets/demo/{name}.svg', 'w') as f:
        f.write(make())
    print(name, 'written')
