// Family tree centred on one article: ancestors above, descendants below,
// spouses/partners beside their partner, siblings beside the focus.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { family } from '../relations.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { view, state, setTitle, pageHead, icon, typeIcon, hydrateImages, worldCrumb, sep } from '../ui.js';
import { esc, $ } from '../util.js';

const W = 176, H = 66, GAP = 28, COUPLE_GAP = 22, ROW = 124, DEPTH = 3;

export function viewTree(wid, aid) {
  const world = store.world(wid);
  const focus = store.article(aid);
  const cal = calendarOf(world);
  setTitle('Family of ' + focus.title);

  const head = pageHead({
    eyebrow: `${worldCrumb(wid)} ${sep} <a href="#/w/${wid}/a/${aid}">${esc(focus.title)}</a> ${sep} Family tree`,
    title: `The House of ${esc(focus.title)}`,
    actions: `<a class="btn small" href="#/w/${wid}/graph?focus=${aid}">${icon('graph')} In graph</a>
      <a class="btn small" href="#/w/${wid}/a/${aid}">${icon('book-open-text')} Article</a>`,
  });

  const layout = buildTree(focus);
  if (layout.nodes.length < 2) {
    view.innerHTML = `<section class="page viz-page">${head}
      <div class="empty-state small"><p>No family recorded for ${esc(focus.title)} yet. Add relationships such as <i>Parent of</i> or <i>Spouse of</i> in the editor.</p>
      <p style="margin-top:1rem"><a class="btn primary small" href="#/w/${wid}/a/${aid}/edit">${icon('pencil-simple')} Edit relationships</a></p></div>
    </section>`;
    return;
  }

  view.innerHTML = `<section class="page viz-page">${head}
    <div class="viz-wrap tree-wrap">
      <div class="viz-box" id="treeBox"><div class="viz-stage" id="treeStage"></div></div>
      <div class="viz-zoom">
        <button class="icon-btn" data-z="in" aria-label="Zoom in">${icon('plus')}</button>
        <button class="icon-btn" data-z="out" aria-label="Zoom out">${icon('minus')}</button>
        <button class="icon-btn" data-z="fit" aria-label="Fit">${icon('corners-out')}</button>
      </div>
      <div class="viz-legend tree-legend"><span><i class="lg-couple"></i>Spouse / partner</span><span><i class="lg-descent"></i>Parent → child</span></div>
    </div>
  </section>`;

  const stage = $('#treeStage');
  const { minX, minY, maxX, maxY } = layout.bounds;
  const pad = 40;
  const ox = -minX + pad, oy = -minY + pad;
  const width = maxX - minX + pad * 2, height = maxY - minY + pad * 2;
  stage.style.width = width + 'px';
  stage.style.height = height + 'px';

  const svg = [`<svg class="tree-lines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`];
  for (const l of layout.lines) svg.push(`<path class="${l.cls}" d="${l.d(ox, oy)}"/>`);
  svg.push('</svg>');

  const cards = layout.nodes.map((n) => {
    const a = n.a;
    const dates = articleDateText(cal, a);
    const rel = n.label ? `<span class="tn-rel">${n.label}</span>` : '';
    return `<div class="tree-node${a.id === aid ? ' focus' : ''}" style="left:${n.x - W / 2 + ox}px;top:${n.y - H / 2 + oy}px;width:${W}px;height:${H}px" data-id="${a.id}" tabindex="0" role="button" aria-label="Show family of ${esc(a.title)}">
      ${a.image ? `<img class="tn-img" data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : `<span class="tn-img icon">${typeIcon(a.type)}</span>`}
      <span class="tn-text">${rel}<span class="tn-title">${esc(a.title)}</span>${dates ? `<span class="tn-dates">${esc(dates)}</span>` : ''}</span>
      <a class="tn-open" href="#/w/${wid}/a/${a.id}" title="Open article" aria-label="Open ${esc(a.title)}">${icon('arrow-square-out')}</a>
    </div>`;
  }).join('');
  stage.innerHTML = svg.join('') + cards;
  hydrateImages(stage);

  const pz = panZoom($('#treeBox'), stage, { width, height });
  const focusNode = layout.nodes.find((n) => n.a.id === aid);
  pz.fit();

  stage.addEventListener('click', (e) => {
    if (pz.dragged()) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.target.closest('.tn-open')) return;
    const node = e.target.closest('.tree-node');
    if (node && node.dataset.id !== aid) location.hash = `#/w/${wid}/tree/${node.dataset.id}`;
    else if (node) location.hash = `#/w/${wid}/a/${aid}`;
  }, true);
  stage.addEventListener('keydown', (e) => {
    const node = e.target.closest('.tree-node');
    if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); node.click(); }
  });
  view.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => {
    if (b.dataset.z === 'fit') pz.fit(); else pz.zoom(b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
  });
  // Large trees: zoom to a readable scale around the focus person instead of showing everything tiny.
  if (focusNode && pz.get().s < 0.55) { pz.zoom(0.75 / pz.get().s); pz.center(focusNode.x + ox, focusNode.y + oy); }
  state.cleanup = () => pz.destroy();
}

// ---------------------------------------------------------------- layout

function buildTree(focus) {
  const gen = new Map(); // id → generation
  const labels = new Map();
  const add = (a, g, label) => { if (a && !gen.has(a.id)) { gen.set(a.id, g); if (label) labels.set(a.id, label); return true; } return false; };
  const fam = new Map();
  const famOf = (a) => { if (!fam.has(a.id)) fam.set(a.id, family(a)); return fam.get(a.id); };

  add(focus, 0);
  // siblings: explicit + shared parents
  const sibs = new Map();
  for (const s of famOf(focus).siblings) sibs.set(s.id, s);
  for (const p of famOf(focus).parents) for (const c of famOf(p).children) if (c.id !== focus.id) sibs.set(c.id, c);
  for (const s of famOf(focus).spouses) add(s, 0, 'Spouse');
  for (const s of sibs.values()) add(s, 0, 'Sibling');

  // ancestors
  let frontier = [focus, ...sibs.values()];
  for (let g = -1; g >= -DEPTH; g--) {
    const next = [];
    for (const a of frontier) for (const p of famOf(a).parents) if (add(p, g)) next.push(p);
    for (const p of [...next]) for (const s of famOf(p).spouses) if (add(s, g)) next.push(s);
    frontier = next;
    if (!frontier.length) break;
  }
  // descendants (of focus and focus's spouses)
  frontier = [focus, ...famOf(focus).spouses];
  for (let g = 1; g <= DEPTH; g++) {
    const next = [];
    for (const a of frontier) for (const c of famOf(a).children) if (add(c, g)) next.push(c);
    for (const c of [...next]) for (const s of famOf(c).spouses) if (add(s, g)) next.push(s);
    frontier = next;
    if (!frontier.length) break;
  }

  const ids = [...gen.keys()];
  const art = new Map(ids.map((id) => [id, store.article(id)]));
  const inTree = (a) => gen.has(a.id);
  const spousesIn = (id) => famOf(art.get(id)).spouses.filter((s) => inTree(s) && gen.get(s.id) === gen.get(id)).map((s) => s.id);
  const parentsIn = (id) => famOf(art.get(id)).parents.filter((p) => inTree(p) && gen.get(p.id) === gen.get(id) - 1).map((p) => p.id);
  const childrenIn = (id) => famOf(art.get(id)).children.filter((c) => inTree(c) && gen.get(c.id) === gen.get(id) + 1).map((c) => c.id);

  // Group each row into "units": a person plus their in-row spouses (chain).
  const rows = new Map();
  for (const [id, g] of gen) { if (!rows.has(g)) rows.set(g, []); rows.get(g).push(id); }
  const unitsOf = (g) => {
    const seen = new Set();
    const units = [];
    const order = rows.get(g);
    for (const id of order) {
      if (seen.has(id)) continue;
      const unit = [];
      const stack = [id];
      while (stack.length) {
        const x = stack.pop();
        if (seen.has(x)) continue;
        seen.add(x); unit.push(x);
        for (const s of spousesIn(x)) stack.push(s);
      }
      units.push(unit);
    }
    return units;
  };

  const x = new Map();
  const unitWidth = (u) => u.length * W + (u.length - 1) * COUPLE_GAP;
  const placeRow = (units, desired) => {
    // desired: unit → centre x (or null). Sort by desired, then sweep to remove overlaps and recentre.
    const items = units.map((u, i) => ({ u, d: desired(u) ?? null, i }));
    let fallback = 0;
    for (const it of items) { if (it.d == null) it.d = fallback; fallback = it.d + unitWidth(it.u) + GAP; }
    items.sort((p, q) => p.d - q.d || p.i - q.i);
    let right = -Infinity;
    const placed = items.map((it) => {
      const w = unitWidth(it.u);
      const left = Math.max(it.d - w / 2, right + GAP);
      right = left + w;
      return { ...it, left, w };
    });
    const drift = placed.reduce((s, p) => s + (p.left + p.w / 2 - p.d), 0) / placed.length;
    for (const p of placed) {
      let cx = p.left - drift + W / 2;
      for (const id of p.u) { x.set(id, cx); cx += W + COUPLE_GAP; }
    }
  };
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

  // Row 0: siblings left, focus (+ spouses) centre, ordered by explicit arrangement.
  const r0 = unitsOf(0);
  const focusUnit = r0.find((u) => u.includes(focus.id));
  // Put focus first within its unit, spouses to the right.
  focusUnit.sort((p, q) => (p === focus.id ? -1 : q === focus.id ? 1 : 0));
  const others = r0.filter((u) => u !== focusUnit);
  const half = Math.ceil(others.length / 2);
  const ordered0 = [...others.slice(0, half), focusUnit, ...others.slice(half)];
  let cursor = 0;
  const pos0 = new Map(ordered0.map((u) => { const c = cursor + unitWidth(u) / 2; cursor += unitWidth(u) + GAP; return [u, c]; }));
  placeRow(ordered0, (u) => pos0.get(u));

  const gens = [...rows.keys()];
  for (let g = -1; g >= Math.min(...gens); g--) {
    const units = unitsOf(g);
    placeRow(units, (u) => mean(u.flatMap((id) => childrenIn(id)).filter((c) => x.has(c)).map((c) => x.get(c))));
    // Within a couple unit, put the blood ancestor nearest the child side: keep as is.
  }
  for (let g = 1; g <= Math.max(...gens); g++) {
    const units = unitsOf(g);
    placeRow(units, (u) => mean(u.flatMap((id) => parentsIn(id)).filter((p) => x.has(p)).map((p) => x.get(p))));
  }
  // A second pass for ancestors so couples centre over the settled descendants.
  for (let g = -1; g >= Math.min(...gens); g--) {
    placeRow(unitsOf(g), (u) => mean(u.flatMap((id) => childrenIn(id)).filter((c) => x.has(c)).map((c) => x.get(c))));
  }

  const y = (id) => gen.get(id) * ROW;
  const nodes = ids.map((id) => ({ a: art.get(id), x: x.get(id), y: y(id), label: labels.get(id) }));

  // Lines: couples, then parent-set → children.
  const lines = [];
  const coupleSeen = new Set();
  for (const id of ids) {
    for (const s of spousesIn(id)) {
      const key = [id, s].sort().join('|');
      if (coupleSeen.has(key)) continue;
      coupleSeen.add(key);
      const [l, r] = x.get(id) < x.get(s) ? [id, s] : [s, id];
      const x1 = x.get(l) + W / 2, x2 = x.get(r) - W / 2, yy = y(id);
      lines.push({ cls: 'couple', d: (ox, oy) => `M${x1 + ox} ${yy + oy}H${x2 + ox}` });
    }
  }
  const families = new Map(); // parent key → children ids
  for (const id of ids) {
    const ps = parentsIn(id).sort();
    if (!ps.length) continue;
    const key = ps.join('|');
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(id);
  }
  for (const [key, kids] of families) {
    const ps = key.split('|');
    let ox0, oy0;
    if (ps.length >= 2 && coupleSeen.has([ps[0], ps[1]].sort().join('|'))) {
      ox0 = (x.get(ps[0]) + x.get(ps[1])) / 2; oy0 = y(ps[0]);
    } else {
      ox0 = mean(ps.map((p) => x.get(p))); oy0 = y(ps[0]) + H / 2;
    }
    const busY = y(ps[0]) + H / 2 + (ROW - H) / 2;
    const xs = kids.map((k) => x.get(k));
    const minK = Math.min(ox0, ...xs), maxK = Math.max(ox0, ...xs);
    lines.push({
      cls: 'descent',
      d: (ox, oy) => `M${ox0 + ox} ${oy0 + oy}V${busY + oy}M${minK + ox} ${busY + oy}H${maxK + ox}` +
        kids.map((k) => `M${x.get(k) + ox} ${busY + oy}V${y(k) - H / 2 + oy}`).join(''),
    });
  }

  const bounds = {
    minX: Math.min(...nodes.map((n) => n.x)) - W / 2, maxX: Math.max(...nodes.map((n) => n.x)) + W / 2,
    minY: Math.min(...nodes.map((n) => n.y)) - H / 2, maxY: Math.max(...nodes.map((n) => n.y)) + H / 2,
  };
  return { nodes, lines, bounds };
}

// ---------------------------------------------------------------- pan & zoom

// Pan/zoom an absolutely positioned `stage` inside `box`. A drag only starts
// after the pointer moves a few pixels, so plain clicks on children still work.
export function panZoom(box, stage, { width, height, onTransform, maxScale = 3, minScale = 0.1 } = {}) {
  let s = 1, tx = 0, ty = 0;
  let w = width, h = height;
  const apply = () => {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    onTransform?.({ s, tx, ty });
  };
  const rect = () => box.getBoundingClientRect();
  let interacted = false;
  const zoomAt = (cx, cy, f) => {
    interacted = true;
    const ns = Math.max(minScale, Math.min(s * f, maxScale));
    tx = cx - (cx - tx) * (ns / s); ty = cy - (cy - ty) * (ns / s); s = ns;
    apply();
  };
  const fit = () => {
    const r = rect();
    if (!w || !h || !r.width) return;
    s = Math.min(1.1, Math.min(r.width / w, r.height / h) * 0.95);
    tx = (r.width - w * s) / 2; ty = (r.height - h * s) / 2;
    apply();
  };
  const center = (px, py) => {
    const r = rect();
    tx = r.width / 2 - px * s; ty = r.height / 2 - py * s;
    apply();
  };

  const pts = new Map();
  let start = null, pinch = null, moved = false, captured = false;
  const down = (e) => {
    if (e.button > 0) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { px: e.clientX, py: e.clientY, tx, ty }; moved = false; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s };
      moved = true;
    }
  };
  const move = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = rect();
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.s * d) / pinch.d / s);
    } else if (pts.size === 1 && start) {
      const dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) {
        if (!captured) { try { box.setPointerCapture(e.pointerId); } catch { /* ignore */ } captured = true; box.classList.add('dragging'); }
        interacted = true;
        tx = start.tx + dx; ty = start.ty + dy; apply();
      }
    }
  };
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s }; } // a third finger lifted
    else if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const p = [...pts.values()][0]; start = { px: p.x, py: p.y, tx, ty }; }
    if (pts.size === 0) {
      start = null; captured = false; box.classList.remove('dragging');
      // keep `moved` until the click that follows has been suppressed
      setTimeout(() => { moved = false; }, 0);
    }
  };
  const wheel = (e) => {
    e.preventDefault();
    const r = rect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', wheel, { passive: false });
  // Re-fit when the box resizes (rotation, sidebar) unless the user has moved the view.
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const r = rect();
    if (!interacted && Math.abs(r.width - lastW) > 30) fit();
    lastW = r.width;
  });
  ro.observe(box);

  return {
    fit, center,
    zoom: (f) => { const r = rect(); zoomAt(r.width / 2, r.height / 2, f); },
    dragged: () => moved,
    get: () => ({ s, tx, ty }),
    setSize: (nw, nh) => { w = nw; h = nh; },
    destroy: () => { ro.disconnect(); },
  };
}
