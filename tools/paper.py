"""Generate the background textures: the seamless Parchment tile
(assets/backgrounds/parchment.png) and the fine noise used by Gradient
(assets/backgrounds/noise.png).

The tile is an alpha mask: the app paints the theme's brass colour through it.
Everything is built from periodic noise (FFT-filtered) and fibres drawn with
wrap-around, so the tile repeats without seams. Needs numpy and Pillow.

    python3 tools/paper.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 512
rng = np.random.default_rng(7)


def band_noise(lo, hi, power=1.0):
    """Periodic noise keeping spatial frequencies between lo and hi cycles per tile."""
    f = np.fft.fftfreq(N) * N
    r = np.hypot(*np.meshgrid(f, f))
    r[0, 0] = 1
    amp = (r >= lo) * (r <= hi) / r ** power
    spec = np.fft.fft2(rng.standard_normal((N, N))) * amp
    out = np.real(np.fft.ifft2(spec))
    return (out - out.mean()) / out.std()


def fibres(count, width, length, alpha):
    """Thin curved fibres, drawn on a 3x3 canvas and folded back so they wrap."""
    img = Image.new('L', (N * 3, N * 3), 0)
    d = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = rng.uniform(N, 2 * N, 2)
        a = rng.uniform(0, np.pi)
        L = rng.uniform(*length)
        bend = rng.uniform(-0.25, 0.25)
        pts = []
        for t in np.linspace(-0.5, 0.5, 12):
            ang = a + bend * t * 4
            pts.append((x + np.cos(ang) * L * t, y + np.sin(ang) * L * t))
        d.line(pts, fill=int(255 * rng.uniform(*alpha)), width=width)
    arr = np.asarray(img, dtype=np.float32) / 255
    folded = sum(arr[i * N:(i + 1) * N, j * N:(j + 1) * N] for i in range(3) for j in range(3))
    return np.clip(folded, 0, 1)


def blur(a, radius):
    """Gaussian blur that wraps at the edges (via FFT)."""
    f = np.fft.fftfreq(N)
    fx, fy = np.meshgrid(f, f)
    g = np.exp(-2 * (np.pi * radius) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


# Gentle cloudy unevenness, kept low so it reads as paper rather than smoke.
mottle = band_noise(2, 10, 1.2)
# Mid-scale fibrous texture: stretched noise gives a faint laid-paper feel.
mid = band_noise(12, 60, 0.8)
# Fine tooth of the paper surface.
grain = band_noise(80, 256, 0.3)
grain = blur(grain, 0.6)
grain /= grain.std()

long_f = blur(fibres(260, 1, (20, 70), (0.25, 0.6)), 0.5)
short_f = blur(fibres(900, 1, (4, 14), (0.15, 0.4)), 0.4)
# A few darker specks, as in old rag paper.
specks = np.zeros((N, N))
idx = rng.integers(0, N, (70, 2))
specks[idx[:, 0], idx[:, 1]] = rng.uniform(1, 3, 70)
specks = blur(specks, 0.9)

v = (0.045 * mottle + 0.035 * mid + 0.05 * grain
     + 0.30 * long_f + 0.18 * short_f + 0.5 * specks)
# Map to alpha: an even base with the texture on top, then normalised so the
# lightest fibres reach full alpha.
v = 0.42 + v
v = np.clip(v / np.percentile(v, 99.8), 0, 1)

alpha = (v * 255).astype(np.uint8)
la = np.zeros((N, N, 2), np.uint8)
la[..., 1] = alpha
Image.fromarray(la, 'LA').save('assets/backgrounds/parchment.png', optimize=True)
print('alpha mean %.3f sd %.3f' % (alpha.mean() / 255, alpha.std() / 255))


# Fine white noise for the Gradient background: each pixel is faintly lighter
# or darker (white or black at a low alpha), so it reads on both themes.
M = 128
n = rng.standard_normal((M, M)) / 2.5
noise = np.zeros((M, M, 2), np.uint8)
noise[..., 0] = np.where(n > 0, 255, 0)
noise[..., 1] = np.clip(np.abs(n) * 11, 0, 255).astype(np.uint8)
Image.fromarray(noise, 'LA').save('assets/backgrounds/noise.png', optimize=True)
