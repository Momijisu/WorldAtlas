// Background wallpapers. Patterns are seamless tiles used as a CSS mask
// over a theme colour, so they suit both light and dark themes. A world can
// also use an uploaded image. A world's choice syncs; the default is per device.
import * as store from './store.js';

const svg = (w, h, body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

// Small seeded random generator so patterns look the same on every load.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function stars() {
  const r = rng(11);
  let b = '';
  for (let i = 0; i < 90; i++) b += `<circle cx="${(r() * 300).toFixed(1)}" cy="${(r() * 300).toFixed(1)}" r="${(r() < 0.9 ? 0.5 + r() * 0.8 : 1.4 + r()).toFixed(2)}" opacity="${(0.35 + r() * 0.65).toFixed(2)}"/>`;
  for (const [x, y] of [[60, 80], [210, 190]]) b += `<path d="M${x} ${y - 6}L${x + 1.2} ${y - 1.2}L${x + 6} ${y}L${x + 1.2} ${y + 1.2}L${x} ${y + 6}L${x - 1.2} ${y + 1.2}L${x - 6} ${y}L${x - 1.2} ${y - 1.2}Z"/>`;
  return svg(300, 300, `<g fill="#000">${b}</g>`);
}

function topo() {
  // Horizontally periodic contour lines; spaced evenly so the tile repeats vertically too.
  let b = '';
  for (let i = 0; i < 12; i++) {
    const base = i * (480 / 12);
    let d = '';
    for (let x = 0; x <= 480; x += 8) {
      const t = (x / 480) * Math.PI * 2;
      const y = base + 9 * Math.sin(t * 2 + i * 0.7) + 5 * Math.sin(t * 3 + i * 1.9);
      d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
    }
    b += `<path d="${d}" fill="none" stroke="#000" stroke-width="${i % 4 === 0 ? 2.1 : 1.25}"/>`;
  }
  return svg(480, 480, b);
}

const damask = () => svg(96, 96, `<g fill="none" stroke="#000" stroke-width="1.5">
  <path d="M0 0L96 96M96 0L0 96"/>
  <path d="M48 30c6 6 6 12 0 18c-6-6-6-12 0-18zM48 66c6-6 6-12 0-18c-6 6-6 12 0 18zM30 48c6-6 12-6 18 0c-6 6-12 6-18 0zM66 48c-6-6-12-6-18 0c6 6 12 6 18 0z"/>
  <circle cx="48" cy="48" r="3"/><circle cx="0" cy="0" r="5"/><circle cx="96" cy="0" r="5"/><circle cx="0" cy="96" r="5"/><circle cx="96" cy="96" r="5"/>
</g>`);

function hexes() {
  const s = 18, w = Math.sqrt(3) * s;
  const hex = (cx, cy) => `M${Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(cx + s * Math.cos(a)).toFixed(2)} ${(cy + s * Math.sin(a)).toFixed(2)}`; }).join('L')}Z`;
  const W = w, H = 3 * s;
  return svg(W.toFixed(2), H, `<path fill="none" stroke="#000" stroke-width="1.5" d="${hex(0, 0)}${hex(W, 0)}${hex(W / 2, 1.5 * s)}${hex(0, 3 * s)}${hex(W, 3 * s)}"/>`);
}

function celestial() {
  const r = rng(5);
  let b = '<g fill="none" stroke="#000" stroke-width="1.3"><circle cx="300" cy="300" r="240"/><circle cx="300" cy="300" r="170" stroke-dasharray="2 6"/><circle cx="300" cy="300" r="90"/>';
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; b += `<path d="M${300 + 90 * Math.cos(a)} ${300 + 90 * Math.sin(a)}L${300 + 240 * Math.cos(a)} ${300 + 240 * Math.sin(a)}"/>`; }
  b += '<path d="M60 0L60 600M540 0L540 600M0 60L600 60M0 540L600 540" stroke-dasharray="1 9"/></g><g fill="#000">';
  const pts = Array.from({ length: 7 }, () => [60 + r() * 480, 60 + r() * 480]);
  b += `<path d="M${pts.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join('L')}" fill="none" stroke="#000" stroke-width="1.1"/>`;
  for (const [x, y] of pts) b += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.6"/>`;
  for (let i = 0; i < 40; i++) b += `<circle cx="${(r() * 600).toFixed(0)}" cy="${(r() * 600).toFixed(0)}" r="${(0.6 + r()).toFixed(1)}"/>`;
  return svg(600, 600, b + '</g>');
}

const waves = () => svg(80, 40, `<g fill="none" stroke="#000" stroke-width="1.5">
  ${[18, 13, 8].map((r) => `<path d="M${40 - r} 40a${r} ${r} 0 0 1 ${2 * r} 0M${-r} 20a${r} ${r} 0 0 1 ${2 * r} 0M${80 - r} 20a${r} ${r} 0 0 1 ${2 * r} 0M${40 - r} 0a${r} ${r} 0 0 1 ${2 * r} 0"/>`).join('')}
</g>`);

const graph = () => svg(120, 120, `<g fill="none" stroke="#000"><path d="M0 .75H120M.75 0V120" stroke-width="1.5"/><path d="M0 30.5H120M0 60.5H120M0 90.5H120M30.5 0V120M60.5 0V120M90.5 0V120" stroke-width=".8" stroke-dasharray="1.5 3.5"/></g>`);

const knots = () => svg(64, 64, `<g fill="none" stroke="#000" stroke-width="1.65"><path d="M0 16c16 0 16 32 32 32s16-32 32-32M0 48c16 0 16-32 32-32s16 32 32 32"/><circle cx="32" cy="32" r="4"/><circle cx="0" cy="32" r="4"/><circle cx="64" cy="32" r="4"/></g>`);

// name → { label, make() or src (a PNG made by tools/paper.py), size, strength (opacity of the pattern) }
export const PATTERNS = {
  plain: { label: 'Plain' },
  gradient: { label: 'Gradient', css: true, strength: 0.05 }, // drawn in css/app.css
  parchment: { label: 'Parchment', src: 'assets/backgrounds/parchment.png', size: '512px', strength: 0.2 },
  stars: { label: 'Starfield', make: stars, size: '300px', strength: 0.5 },
  celestial: { label: 'Star chart', make: celestial, size: '600px', strength: 0.17 },
  topo: { label: 'Contours', make: topo, size: '480px', strength: 0.12 },
  graph: { label: 'Survey grid', make: graph, size: '120px', strength: 0.12 },
  damask: { label: 'Damask', make: damask, size: '96px', strength: 0.12 },
  knots: { label: 'Knotwork', make: knots, size: '64px', strength: 0.11 },
  hexes: { label: 'Hex grid', make: hexes, size: '31.18px', strength: 0.1 },
  waves: { label: 'Waves', make: waves, size: '80px', strength: 0.11 },
  image: { label: 'Your image' },
};

const cache = {};
const adjustable = (name) => tiled(name) || !!PATTERNS[name]?.css || name === 'image';
const tiled = (name) => !!(PATTERNS[name]?.make || PATTERNS[name]?.src);
// Image tiles get an absolute URL: a url() inside a custom property resolves
// against the stylesheet that uses it (css/), not the page.
const maskOf = (name) => (cache[name] ??= PATTERNS[name].src ? new URL(PATTERNS[name].src, document.baseURI).href : PATTERNS[name].make());

// Gradient directions: where the glow starts and where the warm tint sits.
export const GRADIENT_DIRS = {
  top: { label: 'Top to bottom', from: '50% -20%', to: '50% 125%' },
  'top-right': { label: 'Top right to bottom left', from: '105% -15%', to: '-10% 115%' },
  'top-left': { label: 'Top left to bottom right', from: '-5% -15%', to: '110% 115%' },
};
const gradientVars = (dir) => { const d = GRADIENT_DIRS[dir] || GRADIENT_DIRS.top; return `--g-from:${d.from};--g-to:${d.to};`; };

// CSS custom properties for a pattern (used for the page and for swatches).
export const SCALE_MIN = 5, SCALE_MAX = 200;
const clampScale = (v) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(+v || 100)));

// CSS custom properties for a pattern at a given size (percent of its natural tile).
export function patternStyle(name, scale = 100, opacity, dir) {
  const p = PATTERNS[name];
  if (p?.css) return `--bg-strength:${opacity == null ? p.strength : opacity / 100};${gradientVars(dir)}`;
  if (!tiled(name)) return '';
  const px = parseFloat(p.size) * clampScale(scale) / 100;
  return `--bg-mask:url("${maskOf(name)}");--bg-size:${px.toFixed(2)}px;--bg-strength:${opacity == null ? p.strength : opacity / 100};`;
}

// Default opacity (percent) for a background: the pattern's own strength, or 16% for an image.
export const defaultOpacity = (name) => (name === 'image' ? 16 : Math.round((PATTERNS[name]?.strength ?? 0.1) * 100));
const clampOpacity = (v) => Math.min(100, Math.max(0, Math.round(+v)));

export const deviceDefault = () => { try { return JSON.parse(localStorage.getItem('wa.bg') || 'null') || { pattern: 'plain' }; } catch { return { pattern: 'plain' }; } };
export const setDeviceDefault = (bg) => { try { localStorage.setItem('wa.bg', JSON.stringify(bg)); } catch { /* storage unavailable */ } };

// Apply the background for the current world (or the device default).
export async function applyBackground(wid) {
  return showBackground((wid && store.world(wid)?.background) || deviceDefault());
}

// Render a background directly (also used for live previews while choosing).
export async function showBackground(bg) {
  bg ||= deviceDefault();
  const name = PATTERNS[bg.pattern] ? bg.pattern : 'plain';
  const body = document.body;
  const url = name === 'image' && bg.image ? await store.imageURL(bg.image) : null;
  if (name === 'image' && !url) { body.dataset.bg = 'plain'; return; }
  body.dataset.bg = name;
  body.style.cssText = name === 'image'
    ? `--wallpaper:url("${url}");--wall-op:${clampOpacity(bg.opacity ?? defaultOpacity('image'))}%`
    : patternStyle(name, bg.scale, bg.opacity == null ? null : clampOpacity(bg.opacity), bg.dir);
}

// Small arrow showing a gradient's direction.
const dirIcon = (k) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style="transform:rotate(${{ top: 0, 'top-right': 45, 'top-left': -45 }[k]}deg)"><path d="M8 2v12M3.5 9.5 8 14l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// A picker of swatches. `current` is { pattern, image }; onPick(bg) is called on change.
export function pickerHTML(current, { allowDefault = false } = {}) {
  const sel = current?.pattern ?? (allowDefault ? 'default' : 'plain');
  const opts = Object.entries(PATTERNS).filter(([k]) => k !== 'image');
  return `<div class="bg-picker">
    ${allowDefault ? `<button type="button" class="bg-swatch ${sel === 'default' ? 'on' : ''}" data-bg="default"><span class="bg-prev" data-p="plain"></span><span>Device default</span></button>` : ''}
    ${opts.map(([k, p]) => `<button type="button" class="bg-swatch ${sel === k ? 'on' : ''}" data-bg="${k}"><span class="bg-prev" data-p="${k}" style='${patternStyle(k)}'></span><span>${p.label}</span></button>`).join('')}
    <label class="bg-swatch ${sel === 'image' ? 'on' : ''}" data-bg="image"><span class="bg-prev img" data-p="image"></span><span>Your image</span><input type="file" accept="image/*" hidden></label>
  </div>
  <div class="bg-adjust" ${adjustable(sel) ? '' : 'hidden'}>
    <label class="bg-scale" data-k="scale" ${tiled(sel) ? '' : 'hidden'}>Size
      <input type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" step="5" value="${clampScale(current?.scale ?? 100)}"><output></output></label>
    <div class="bg-scale" data-k="dir" ${sel === 'gradient' ? '' : 'hidden'}><span>Direction</span>
      <div class="seg">${Object.entries(GRADIENT_DIRS).map(([k, d]) => `<button type="button" data-dir="${k}" class="${(current?.dir || 'top') === k ? 'on' : ''}" title="${d.label}" aria-label="${d.label}">${dirIcon(k)}</button>`).join('')}</div></div>
    <label class="bg-scale" data-k="opacity">Opacity
      <input type="range" min="0" max="100" step="1" value="${clampOpacity(current?.opacity ?? defaultOpacity(sel))}"><output></output></label>
    <button type="button" class="btn small quiet" data-reset-bg>Reset</button>
  </div>`;
}

// Wire a picker rendered by pickerHTML(). onPick receives { pattern, image? } or null for "device default".
export function wirePicker(root, current, onPick, prepareImage) {
  const picker = root.querySelector('.bg-picker');
  const adjust = root.querySelector('.bg-adjust');
  const scaleRow = adjust.querySelector('[data-k="scale"]');
  const scale = scaleRow.querySelector('input');
  const opacity = adjust.querySelector('[data-k="opacity"] input');
  const dirRow = adjust.querySelector('[data-k="dir"]');
  let bg = current ? { ...current } : null; // null = device default
  const emit = () => { onPick(bg ? { ...bg } : null); showBackground(bg); };
  const label = () => {
    scaleRow.querySelector('output').textContent = scale.value + '%';
    opacity.nextElementSibling.textContent = opacity.value + '%';
  };
  const sync = () => {
    const name = bg?.pattern ?? 'default';
    picker.querySelectorAll('.bg-swatch').forEach((s) => s.classList.toggle('on', s.dataset.bg === name));
    adjust.hidden = !adjustable(name);
    scaleRow.hidden = !tiled(name);
    dirRow.hidden = name !== 'gradient';
    dirRow.querySelectorAll('[data-dir]').forEach((b) => b.classList.toggle('on', b.dataset.dir === (bg?.dir || 'top')));
    label();
  };
  // Picking a new background starts from its own default opacity.
  const choose = (next) => {
    bg = next;
    if (bg) { opacity.value = defaultOpacity(bg.pattern); if (tiled(bg.pattern)) bg.scale = +scale.value; }
    sync(); emit();
  };
  const imgPrev = picker.querySelector('.bg-prev.img');
  const showImage = async (id) => { const url = id && await store.imageURL(id); if (url) imgPrev.style.backgroundImage = `url("${url}")`; };
  if (current?.pattern === 'image') showImage(current.image);
  picker.addEventListener('click', (e) => {
    const sw = e.target.closest('.bg-swatch');
    if (!sw || sw.dataset.bg === 'image') return; // the image swatch opens the file picker instead
    choose(sw.dataset.bg === 'default' ? null : { pattern: sw.dataset.bg });
  });
  scale.addEventListener('input', () => { if (bg) { bg.scale = +scale.value; label(); emit(); } });
  dirRow.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dir]');
    if (!b || !bg) return;
    if (b.dataset.dir === 'top') delete bg.dir; else bg.dir = b.dataset.dir;
    sync(); emit();
  });
  opacity.addEventListener('input', () => { if (bg) { bg.opacity = +opacity.value; label(); emit(); } });
  adjust.querySelector('[data-reset-bg]').addEventListener('click', () => {
    if (!bg) return;
    scale.value = 100;
    opacity.value = defaultOpacity(bg.pattern);
    delete bg.opacity;
    delete bg.dir;
    if (tiled(bg.pattern)) bg.scale = 100;
    label(); emit();
  });
  picker.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const id = await store.addImage(await prepareImage(file, 2400));
    await showImage(id);
    choose({ pattern: 'image', image: id });
  });
  sync();
}

// Noise laid over the whole app (css/app.css body::before), per device, 0-100.
export const NOISE_DEFAULT = 25;
export function noiseLevel() {
  try { const v = localStorage.getItem('wa.noise'); return v == null ? NOISE_DEFAULT : clampOpacity(v); } catch { return NOISE_DEFAULT; }
}
export function applyNoise(level = noiseLevel()) {
  document.documentElement.style.setProperty('--noise', String(level / 1000)); // 25 → 2.5% opacity
}
export function setNoise(level) {
  try { localStorage.setItem('wa.noise', String(clampOpacity(level))); } catch { /* private mode */ }
  applyNoise();
}
