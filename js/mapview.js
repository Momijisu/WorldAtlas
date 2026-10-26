// Pan/zoom image viewer with pins. Works with mouse, wheel, touch and pinch.
// Pins are stored in image-relative coordinates (0..1) so they stay put at any size.
export function mountMap(container, { src, pins, onPinClick, onBackgroundTap }) {
  container.innerHTML = `<div class="map-stage"><img draggable="false" alt=""><div class="map-pins"></div></div>`;
  const stage = container.querySelector('.map-stage');
  const img = stage.querySelector('img');
  const pinLayer = stage.querySelector('.map-pins');
  let s = 1, x = 0, y = 0, w = 1, h = 1;

  const apply = () => {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    stage.style.setProperty('--inv', 1 / s);
  };
  const fit = () => {
    const r = container.getBoundingClientRect();
    s = Math.min(r.width / w, r.height / h);
    x = (r.width - w * s) / 2;
    y = (r.height - h * s) / 2;
    apply();
  };
  const zoomAt = (cx, cy, factor) => {
    const ns = Math.max(0.05, Math.min(s * factor, 12));
    x = cx - (cx - x) * (ns / s);
    y = cy - (cy - y) * (ns / s);
    s = ns;
    apply();
  };

  function drawPins(list) {
    pinLayer.innerHTML = '';
    for (const p of list) {
      const el = document.createElement('button');
      el.className = 'pin';
      el.style.left = p.x * 100 + '%';
      el.style.top = p.y * 100 + '%';
      el.style.setProperty('--pin', p.color || '#e0b252');
      el.innerHTML = `<span class="pin-dot"></span>${p.label ? `<span class="pin-label"></span>` : ''}`;
      if (p.label) el.querySelector('.pin-label').textContent = p.label;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); onPinClick?.(p, el); });
      pinLayer.appendChild(el);
    }
  }

  img.onload = () => {
    w = img.naturalWidth; h = img.naturalHeight;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    fit();
  };
  img.src = src;
  drawPins(pins);

  // Pointer handling: one pointer pans, two pinch-zoom; a tap that barely moves is a click.
  const pts = new Map();
  let start = null, moved = false, pinch = null;
  container.addEventListener('pointerdown', (e) => {
    container.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { px: e.clientX, py: e.clientY, x, y }; moved = false; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s };
      moved = true;
    }
  });
  container.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = container.getBoundingClientRect();
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.s * d) / pinch.d / s);
    } else if (pts.size === 1 && start) {
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      x = start.x + dx; y = start.y + dy;
      apply();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const p = [...pts.values()][0]; start = { px: p.x, py: p.y, x, y }; }
    if (pts.size === 0) {
      if (!moved && e.type === 'pointerup') {
        const r = container.getBoundingClientRect();
        const ix = (e.clientX - r.left - x) / s / w, iy = (e.clientY - r.top - y) / s / h;
        if (ix >= 0 && ix <= 1 && iy >= 0 && iy <= 1) onBackgroundTap?.({ x: ix, y: iy });
      }
      start = null;
    }
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = container.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  const ro = new ResizeObserver(() => { if (w > 1) fit(); });
  ro.observe(container);

  return {
    setPins: drawPins,
    fit,
    zoom: (f) => { const r = container.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); },
    focus: (p) => {
      const r = container.getBoundingClientRect();
      s = Math.max(s, Math.min(r.width / w, r.height / h) * 2.5);
      x = r.width / 2 - p.x * w * s; y = r.height / 2 - p.y * h * s;
      apply();
    },
    destroy: () => ro.disconnect(),
  };
}
