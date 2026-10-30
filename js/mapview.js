// Pan/zoom image viewer with pins and polygon regions. Works with mouse, wheel,
// touch and pinch. Everything is stored in image-relative coordinates (0..1) so
// it stays put at any size. Pins and labels counter-scale to keep a constant
// on-screen size while zooming.
import { icon } from './icons.js';
import { esc } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';

// embedded: inside a page that scrolls, so the wheel zooms only with Ctrl/⌘.
export function mountMap(container, { src, onPinClick, onRegionClick, onBackgroundTap, isDrawing, regionTaps, onDraftChange, embedded = false }) {
  container.innerHTML = `<div class="map-stage">
      <img draggable="false" alt="">
      <svg class="map-regions" xmlns="${SVG}" preserveAspectRatio="none"></svg>
      <div class="map-labels"></div>
      <div class="map-pins"></div>
    </div>`;
  const stage = container.querySelector('.map-stage');
  const img = stage.querySelector('img');
  const svg = stage.querySelector('svg');
  const labelLayer = stage.querySelector('.map-labels');
  const pinLayer = stage.querySelector('.map-pins');
  let s = 1, x = 0, y = 0, w = 1, h = 1;
  let items = { pins: [], regions: [], hidden: new Set() };
  let draft = null;

  // Keep the map in view: bigger than the frame, its edges can't come more
  // than EDGE px inside; smaller, it stays wholly inside the frame.
  const EDGE = 48;
  const keepInView = () => {
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const axis = (v, size, view) => (size <= view ? Math.min(Math.max(v, 0), view - size) : Math.min(Math.max(v, view - size - EDGE), EDGE));
    x = axis(x, w * s, r.width);
    y = axis(y, h * s, r.height);
  };
  // Zooming out stops a little below "fit the whole map".
  const minScale = () => {
    const r = container.getBoundingClientRect();
    return r.width && r.height ? Math.min(r.width / w, r.height / h) * 0.8 : 0.03;
  };
  const apply = () => {
    keepInView();
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    stage.style.setProperty('--inv', 1 / s);
  };
  const fit = () => {
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    s = Math.min(r.width / w, r.height / h);
    x = (r.width - w * s) / 2;
    y = (r.height - h * s) / 2;
    apply();
  };
  const zoomAt = (cx, cy, factor) => {
    const ns = Math.max(minScale(), Math.min(s * factor, 16));
    x = cx - (cx - x) * (ns / s);
    y = cy - (cy - y) * (ns / s);
    s = ns;
    apply();
  };

  const visible = (it) => !items.hidden.has(it.layer || '');

  function centroid(points) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (Math.abs(a) < 1e-9) {
      const n = points.length || 1;
      return [points.reduce((t, p) => t + p[0], 0) / n, points.reduce((t, p) => t + p[1], 0) / n];
    }
    return [cx / (3 * a), cy / (3 * a)];
  }

  function draw() {
    // regions
    svg.innerHTML = '';
    labelLayer.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const r of items.regions) {
      if (!visible(r) || !r.points || r.points.length < 3) continue;
      const poly = document.createElementNS(SVG, 'polygon');
      poly.setAttribute('points', r.points.map(([px, py]) => `${px * w},${py * h}`).join(' '));
      const fill = ['outline', 'hidden'].includes(r.fill) ? r.fill : 'solid';
      poly.setAttribute('class', `region region-${fill}`);
      poly.dataset.region = r.id;
      poly.style.setProperty('--rc', r.color || '#c4a46a');
      svg.appendChild(poly);
      if (r.label) {
        const [cx, cy] = centroid(r.points);
        const el = document.createElement('div');
        el.className = 'region-label';
        el.style.left = cx * 100 + '%';
        el.style.top = cy * 100 + '%';
        el.textContent = r.label;
        labelLayer.appendChild(el);
      }
    }
    if (draft?.length) {
      const pl = document.createElementNS(SVG, draft.length > 2 ? 'polygon' : 'polyline');
      pl.setAttribute('points', draft.map(([px, py]) => `${px * w},${py * h}`).join(' '));
      pl.setAttribute('class', 'region-draft');
      svg.appendChild(pl);
    }
    // pins + draft vertices
    pinLayer.innerHTML = '';
    for (const p of items.pins) {
      if (!visible(p)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = p.num ? 'pin numbered' : 'pin';
      el.dataset.pin = p.id;
      el.style.left = p.x * 100 + '%';
      el.style.top = p.y * 100 + '%';
      el.style.setProperty('--pin', p.color || '#c4553b');
      // Numbered pins show their number (the map's key lists the names); the name appears on hover.
      el.innerHTML = `<span class="pin-badge">${p.num ? `<b>${p.num}</b>` : icon(p.icon || 'map-pin')}</span>${p.label ? `<span class="pin-label">${esc(p.label)}</span>` : ''}`;
      el.setAttribute('aria-label', p.num ? `${p.num}. ${p.label || 'Pin'}` : p.label || 'Pin');
      // Taps and drags on a pin are handled with the map's own pointer
      // handling (a drag pans, a tap opens it); this is for the keyboard.
      el.addEventListener('click', (e) => { if (e.detail || isDrawing?.()) return; e.stopPropagation(); onPinClick?.(p, el); });
      pinLayer.appendChild(el);
    }
    (draft || []).forEach(([px, py], i) => {
      const d = document.createElement('span');
      d.className = 'draft-dot';
      d.dataset.vertex = i;
      d.style.left = px * 100 + '%';
      d.style.top = py * 100 + '%';
      pinLayer.appendChild(d);
    });
  }

  img.onload = () => {
    w = img.naturalWidth; h = img.naturalHeight;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    draw();
    fit();
  };
  img.src = src;

  // Pointer handling: one pointer pans, two pinch-zoom; a tap that barely moves is a click.
  const pts = new Map();
  let start = null, moved = false, pinch = null, downTarget = null, panOnly = false;
  let vertex = null; // index of a draft vertex being dragged
  const toImage = (e) => {
    const r = container.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left - x) / s / w)), Math.min(1, Math.max(0, (e.clientY - r.top - y) / s / h))];
  };
  const onDown = (e) => {
    // Left button, touch or pen; the middle button always pans (and is never a click).
    if (e.button > 1) return;
    if (e.button === 1) e.preventDefault(); // no autoscroll
    if (pts.size === 0) { downTarget = e.target; panOnly = e.button === 1; }
    // Pressing a vertex of the region being drawn moves it instead of adding one.
    const v = pts.size === 0 && !panOnly && e.target.closest?.('[data-vertex]');
    if (v) {
      vertex = +v.dataset.vertex;
      moved = true;
      container.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    container.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { px: e.clientX, py: e.clientY, x, y }; moved = false; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s };
      moved = true;
    }
  };
  const onMove = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (vertex != null && draft?.[vertex]) { draft[vertex] = toImage(e); draw(); return; }
    const r = container.getBoundingClientRect();
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.s * d) / pinch.d / s);
    } else if (pts.size === 1 && start) {
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) { x = start.x + dx; y = start.y + dy; apply(); }
    }
  };
  const onEnd = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (vertex != null) {
      vertex = null;
      if (pts.size === 0) { downTarget = null; start = null; }
      onDraftChange?.([...draft]);
      return;
    }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s }; } // a third finger lifted
    else if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const p = [...pts.values()][0]; start = { px: p.x, py: p.y, x, y }; }
    if (pts.size === 0) {
      if (!moved && !panOnly && e.type === 'pointerup') {
        const r = container.getBoundingClientRect();
        const ix = (e.clientX - r.left - x) / s / w, iy = (e.clientY - r.top - y) / s / h;
        const pinEl = downTarget?.closest?.('[data-pin]');
        const regionEl = downTarget?.closest?.('[data-region]');
        if (pinEl && !isDrawing?.()) {
          const pin = items.pins.find((q) => q.id === pinEl.dataset.pin);
          if (pin) onPinClick?.(pin, pinEl);
        } else if (regionEl && (regionTaps ? regionTaps() : !isDrawing?.())) {
          const reg = items.regions.find((g) => g.id === regionEl.dataset.region);
          if (reg) onRegionClick?.(reg, { x: ix, y: iy });
        } else if (ix >= 0 && ix <= 1 && iy >= 0 && iy <= 1) {
          onBackgroundTap?.({ x: ix, y: iy });
        }
      }
      start = null;
      downTarget = null;
    }
  };
  let hintTimer;
  const onWheel = (e) => {
    if (embedded && !e.ctrlKey && !e.metaKey) {
      container.classList.add('show-hint');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => container.classList.remove('show-hint'), 1200);
      return; // let the page scroll
    }
    e.preventDefault();
    const r = container.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // middle-drag pans instead of autoscrolling
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onEnd);
  container.addEventListener('pointercancel', onEnd);
  container.addEventListener('wheel', onWheel, { passive: false });
  // A drag on the map never scrolls the page, even in browsers that don't
  // fully honour touch-action.
  const noScroll = (e) => { if (e.cancelable) e.preventDefault(); };
  container.addEventListener('touchmove', noScroll, { passive: false });

  let lastSize = '';
  const ro = new ResizeObserver(() => {
    const r = container.getBoundingClientRect();
    const key = Math.round(r.width) + 'x' + Math.round(r.height);
    if (w > 1 && key !== lastSize) { lastSize = key; fit(); }
  });
  ro.observe(container);

  return {
    setItems({ pins = items.pins, regions = items.regions, hidden = items.hidden } = {}) {
      items = { pins, regions, hidden: new Set(hidden) };
      if (w > 1) draw();
    },
    setDraft(points) { draft = points ? [...points] : null; if (w > 1) draw(); },
    fit,
    zoom: (f) => { const r = container.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); },
    // Centre on a point ({x,y}) or a region (points array), zooming in if needed.
    focus(target) {
      const r = container.getBoundingClientRect();
      const base = Math.min(r.width / w, r.height / h);
      let cx, cy, ns;
      if (Array.isArray(target)) {
        const xs = target.map((p) => p[0]), ys = target.map((p) => p[1]);
        const bw = (Math.max(...xs) - Math.min(...xs)) * w || 1, bh = (Math.max(...ys) - Math.min(...ys)) * h || 1;
        ns = Math.min(r.width / bw, r.height / bh) * 0.7;
        [cx, cy] = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
      } else {
        ns = Math.max(s, base * 2.5);
        [cx, cy] = [target.x, target.y];
      }
      s = Math.max(base, Math.min(ns, 16));
      x = r.width / 2 - cx * w * s;
      y = r.height / 2 - cy * h * s;
      apply();
    },
    destroy() {
      container.removeEventListener('touchmove', noScroll);
      ro.disconnect();
      container.removeEventListener('wheel', onWheel);
    },
  };
}
