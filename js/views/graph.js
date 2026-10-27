// Relationship graph: articles as nodes, typed relationships (and optionally
// [[wiki links]]) as edges, laid out with a small force simulation.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { TYPES } from '../store.js';
import { REL_TYPES, REL_GROUPS, worldEdges, relationsOf, hasFamily } from '../relations.js';
import { view, state, setTitle, pageHead, icon, typeIcon, typeLabel, hydrateImages, worldCrumb, sep } from '../ui.js';
import { esc, $, $$ } from '../util.js';
import { plain } from '../markdown.js';

const R = 17;

export function viewGraph(wid, q) {
  setTitle('Relationships');
  const focusId = store.article(q.get('focus')) ? q.get('focus') : null;
  const allArticles = store.articlesOf(wid);
  const relEdges = worldEdges(wid).map((e) => ({ ...e, kind: 'rel', group: REL_TYPES[e.type].group }));
  const linkEdges = wikiEdges(wid, relEdges);

  const prefs = loadPrefs();
  const opt = {
    links: prefs.links ?? false,
    loose: prefs.loose ?? false,
    groups: new Set(prefs.groups || Object.keys(REL_GROUPS)),
    types: new Set(prefs.types || Object.keys(TYPES)),
  };

  const head = pageHead({
    eyebrow: `${worldCrumb(wid)} ${sep} Atlas`,
    title: 'Relationships',
    actions: focusId ? '' : '',
  });

  if (!relEdges.length && !linkEdges.length) {
    view.innerHTML = `<section class="page viz-page">${head}
      <div class="empty-state small"><p>No relationships yet. Add them in an article’s editor, under <b>Relationships</b>.</p></div></section>`;
    return;
  }

  const typesPresent = Object.keys(TYPES).filter((t) => allArticles.some((a) => a.type === t));
  view.innerHTML = `<section class="page viz-page graph-page">${head}
    ${focusId ? `<div class="graph-focus">${icon('funnel')}<span>Showing connections within two steps of <a href="#/w/${wid}/a/${focusId}">${esc(store.article(focusId).title)}</a></span>
      <a class="btn small quiet" href="#/w/${wid}/graph">${icon('x')} Show everything</a></div>` : ''}
    <div class="graph-tools">
      <div class="graph-search"><input type="search" id="gSearch" placeholder="Find a person, place, faction…" list="gTitles" aria-label="Find in graph">
        <datalist id="gTitles">${allArticles.map((a) => `<option value="${esc(a.title)}">`).join('')}</datalist></div>
      <div class="seg" role="group" aria-label="Display options">
        <button type="button" data-opt="links" title="Also draw [[wiki links]] between articles">${icon('link-simple')} Wiki links</button>
        <button type="button" data-opt="loose" title="Show articles without any connection">${icon('circle')} Unconnected</button>
      </div>
      <button type="button" class="btn small quiet" id="gFilterToggle">${icon('funnel')} Filters</button>
    </div>
    <div class="graph-filters" id="gFilters">
      <div class="gf-row"><span class="field-label">Bonds</span><div class="chips">
        ${Object.entries(REL_GROUPS).map(([g, label]) => `<button type="button" class="chip" data-group="${g}"><span class="swatch" style="background:var(--edge-${g})"></span>${label}</button>`).join('')}
        <span class="chip legend-link" title="Dashed lines are [[wiki links]]"><span class="swatch dash"></span>Wiki link</span>
      </div></div>
      <div class="gf-row"><span class="field-label">Kinds</span><div class="chips">
        ${typesPresent.map((t) => `<button type="button" class="chip" data-type="${t}">${typeIcon(t)}${TYPES[t].plural}</button>`).join('')}
      </div></div>
    </div>
    <div class="viz-wrap graph-wrap">
      <div class="viz-box" id="gBox"><svg id="gSvg" class="graph-svg"><g id="gView"><g id="gEdges"></g><g id="gLabels"></g><g id="gNodes"></g></g></svg></div>
      <div class="viz-zoom">
        <button class="icon-btn" data-z="in" aria-label="Zoom in">${icon('plus')}</button>
        <button class="icon-btn" data-z="out" aria-label="Zoom out">${icon('minus')}</button>
        <button class="icon-btn" data-z="fit" aria-label="Fit">${icon('corners-out')}</button>
      </div>
      <div class="graph-empty" id="gEmpty" hidden>Nothing matches these filters.</div>
      <aside class="graph-info" id="gInfo" hidden></aside>
    </div>
  </section>`;

  const box = $('#gBox'), svg = $('#gSvg'), gView = $('#gView');
  const gEdges = $('#gEdges'), gNodes = $('#gNodes'), gLabels = $('#gLabels');
  const info = $('#gInfo');

  // Positions persist across filter changes for stability.
  const pos = new Map();
  let nodes = [], edges = [], byId = new Map();
  let selected = null;
  let tf = { s: 1, x: 0, y: 0 };
  let alpha = 0, raf = 0, interacted = false;

  const syncControls = () => {
    $$('[data-opt]').forEach((b) => b.classList.toggle('on', !!opt[b.dataset.opt]));
    $$('[data-group]').forEach((b) => b.classList.toggle('on', opt.groups.has(b.dataset.group)));
    $$('[data-type]').forEach((b) => b.classList.toggle('on', opt.types.has(b.dataset.type)));
  };

  function build() {
    let es = relEdges.filter((e) => opt.groups.has(e.group));
    if (opt.links) es = es.concat(linkEdges);
    const okType = (id) => { const a = store.article(id); return a && opt.types.has(a.type); };
    es = es.filter((e) => okType(e.from) && okType(e.to));
    let ids = new Set(es.flatMap((e) => [e.from, e.to]));
    if (opt.loose) allArticles.filter((a) => opt.types.has(a.type)).forEach((a) => ids.add(a.id));
    if (focusId) {
      ids.add(focusId);
      const keep = new Set([focusId]);
      let frontier = [focusId];
      for (let hop = 0; hop < 2; hop++) {
        const next = [];
        for (const e of es) {
          if (frontier.includes(e.from) && !keep.has(e.to)) { keep.add(e.to); next.push(e.to); }
          if (frontier.includes(e.to) && !keep.has(e.from)) { keep.add(e.from); next.push(e.from); }
        }
        frontier = next;
      }
      ids = keep;
      es = es.filter((e) => keep.has(e.from) && keep.has(e.to));
    }
    nodes = [...ids].map((id) => {
      if (!pos.has(id)) {
        const ang = Math.random() * Math.PI * 2, rad = 60 + Math.random() * 220;
        pos.set(id, { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, vx: 0, vy: 0, fixed: false });
      }
      const p = pos.get(id);
      if (id === focusId && !p.seeded) { p.x = 0; p.y = 0; p.seeded = true; }
      return { id, a: store.article(id), p };
    });
    byId = new Map(nodes.map((n) => [n.id, n]));
    const deg = new Map();
    edges = es.map((e) => {
      deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1);
      return { ...e, s: byId.get(e.from), t: byId.get(e.to) };
    });
    nodes.forEach((n) => { n.deg = deg.get(n.id) || 0; });
    // parallel edges between the same pair get a curve offset
    const pairCount = new Map();
    for (const e of edges) {
      const k = [e.from, e.to].sort().join('|');
      e.idx = pairCount.get(k) || 0;
      pairCount.set(k, e.idx + 1);
    }
    draw();
    $('#gEmpty').hidden = nodes.length > 0;
    if (selected && !byId.has(selected)) select(null);
    else if (selected) select(selected);
    kick(1);
  }

  function draw() {
    gEdges.innerHTML = edges.map((e, i) => {
      const label = e.kind === 'rel' ? REL_TYPES[e.type].label : 'Mentions';
      return `<path class="g-edge ${e.kind === 'link' ? 'link' : 'g-' + e.group}" data-i="${i}"><title>${esc(e.s.a.title)}: ${esc(label)} ${esc(e.t.a.title)}</title></path>`;
    }).join('');
    gNodes.innerHTML = nodes.map((n) => `
      <g class="g-node t-${n.a.type}${n.id === focusId ? ' focus' : ''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.a.title)}">
        <circle class="g-halo" r="${R + 7}"/>
        <circle class="g-dot" r="${R}"/>
        ${typeIcon(n.a.type).replace('<svg ', `<svg x="-9" y="-9" width="18" height="18" `)}
        <text class="g-name" y="${R + 16}">${esc(truncate(n.a.title, 26))}</text>
      </g>`).join('');
    gLabels.innerHTML = '';
    tick(true);
  }

  function edgePath(e) {
    const { x: x1, y: y1 } = e.s.p, { x: x2, y: y2 } = e.t.p;
    if (!e.idx) return `M${x1} ${y1}L${x2} ${y2}`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const off = 26 * Math.ceil(e.idx / 2) * (e.idx % 2 ? 1 : -1);
    return `M${x1} ${y1}Q${mx - (dy / len) * off} ${my + (dx / len) * off} ${x2} ${y2}`;
  }

  function render() {
    const paths = gEdges.children;
    for (let i = 0; i < edges.length; i++) paths[i].setAttribute('d', edgePath(edges[i]));
    const gs = gNodes.children;
    for (let i = 0; i < nodes.length; i++) gs[i].setAttribute('transform', `translate(${nodes[i].p.x.toFixed(1)},${nodes[i].p.y.toFixed(1)})`);
    renderLabels();
  }

  function renderLabels() {
    if (!selected) { gLabels.innerHTML = ''; return; }
    gLabels.innerHTML = edges.filter((e) => e.from === selected || e.to === selected).map((e) => {
      const [from, to] = e.from === selected ? [e.s.p, e.t.p] : [e.t.p, e.s.p];
      const mx = from.x + (to.x - from.x) * 0.58, my = from.y + (to.y - from.y) * 0.58 - 4;
      // label reads from the selected node's perspective
      let label = 'Mentions';
      if (e.kind === 'rel') label = e.from === selected ? REL_TYPES[e.type].label : REL_TYPES[REL_TYPES[e.type].inverse].label;
      return `<text class="g-elabel" x="${mx}" y="${my}">${esc(label)}</text>`;
    }).join('');
  }

  // ---- simulation
  function step() {
    const n = nodes.length;
    const k = 150;
    for (let i = 0; i < n; i++) {
      const a = nodes[i].p;
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j].p;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        if (d2 > 360000) continue;
        const f = (k * k) / d2 * 0.9;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const e of edges) {
      const a = e.s.p, b = e.t.p;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const rest = e.kind === 'link' ? 210 : 165;
      const f = (d - rest) * (e.kind === 'link' ? 0.02 : 0.05);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const nd of nodes) {
      const p = nd.p;
      p.vx -= p.x * 0.012; p.vy -= p.y * 0.012;
      if (p.fixed) { p.vx = 0; p.vy = 0; continue; }
      const sp = Math.hypot(p.vx, p.vy), max = 30;
      if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      p.x += p.vx * alpha; p.y += p.vy * alpha;
      p.vx *= 0.55; p.vy *= 0.55;
    }
  }

  function tick(once) {
    if (!once) {
      for (let i = 0; i < 2; i++) step();
      alpha *= 0.975;
    }
    render();
    if (!once) {
      if (alpha > 0.02) raf = requestAnimationFrame(() => tick());
      else { raf = 0; if (!interacted) fit(); }
    }
  }

  function kick(a = 0.6) {
    alpha = Math.max(alpha, a);
    if (!raf) raf = requestAnimationFrame(() => tick());
  }

  // ---- view transform
  const applyTf = () => gView.setAttribute('transform', `translate(${tf.x},${tf.y}) scale(${tf.s})`);
  function fit() {
    const r = box.getBoundingClientRect();
    if (!nodes.length || !r.width) return;
    const xs = nodes.map((n) => n.p.x), ys = nodes.map((n) => n.p.y);
    const minX = Math.min(...xs) - 70, maxX = Math.max(...xs) + 70, minY = Math.min(...ys) - 50, maxY = Math.max(...ys) + 60;
    // leave room for the side panel when it is open on wide screens
    const avail = !info.hidden && r.width >= 700 ? r.width - info.offsetWidth - 20 : r.width;
    tf.s = Math.max(0.2, Math.min(1.4, Math.min(avail / (maxX - minX), r.height / (maxY - minY))));
    tf.x = avail / 2 - ((minX + maxX) / 2) * tf.s;
    tf.y = r.height / 2 - ((minY + maxY) / 2) * tf.s;
    applyTf();
  }
  const zoomAt = (cx, cy, f) => {
    interacted = true;
    const ns = Math.max(0.15, Math.min(tf.s * f, 4));
    tf.x = cx - (cx - tf.x) * (ns / tf.s); tf.y = cy - (cy - tf.y) * (ns / tf.s); tf.s = ns;
    applyTf();
  };
  const toGraph = (cx, cy) => ({ x: (cx - tf.x) / tf.s, y: (cy - tf.y) / tf.s });
  function centreOn(n) {
    interacted = true;
    const r = box.getBoundingClientRect();
    tf.s = Math.max(tf.s, 1);
    tf.x = r.width / 2 - n.p.x * tf.s; tf.y = r.height / 2 - n.p.y * tf.s;
    applyTf();
  }

  // ---- pointer interaction: drag node, pan background, pinch zoom
  const pts = new Map();
  let drag = null, pinch = null;
  box.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const r = box.getBoundingClientRect();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: tf.s };
      if (drag?.node) drag.node.p.fixed = false;
      drag = null;
      return;
    }
    const g = e.target.closest('.g-node');
    const node = g ? byId.get(g.dataset.id) : null;
    drag = { node, sx: e.clientX, sy: e.clientY, tx: tf.x, ty: tf.y, moved: false, rx: r.left, ry: r.top };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) {
      // hover highlight (mouse)
      if (e.pointerType === 'mouse') {
        const g = e.target.closest('.g-node');
        hover(g ? g.dataset.id : null);
      }
      return;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.getBoundingClientRect();
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.s * d) / pinch.d / tf.s);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; box.classList.add('dragging'); }
    if (!drag.moved) return;
    if (drag.node) {
      const p = toGraph(e.clientX - r.left, e.clientY - r.top);
      drag.node.p.x = p.x; drag.node.p.y = p.y; drag.node.p.fixed = true;
      interacted = true;
      kick(0.35);
      render();
    } else {
      interacted = true;
      tf.x = drag.tx + dx; tf.y = drag.ty + dy; applyTf();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: tf.s }; } // a third finger lifted
    else if (pts.size < 2) pinch = null;
    if (!drag || pts.size) { if (!pts.size) drag = null; return; }
    box.classList.remove('dragging');
    if (drag.node) drag.node.p.fixed = false;
    if (!drag.moved && e.type === 'pointerup') select(drag.node ? drag.node.id : null);
    drag = null;
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = box.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  box.addEventListener('keydown', (e) => {
    const g = e.target.closest('.g-node');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.id); }
  });
  $$('[data-z]').forEach((b) => b.onclick = () => {
    if (b.dataset.z === 'fit') { interacted = false; fit(); return; }
    const r = box.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
  });

  function neighbours(id) {
    const s = new Set([id]);
    for (const e of edges) { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from); }
    return s;
  }
  function highlight(id) {
    svg.classList.toggle('has-hl', !!id);
    const nb = id ? neighbours(id) : null;
    for (const g of gNodes.children) g.classList.toggle('hl', !!nb && nb.has(g.dataset.id));
    for (const p of gEdges.children) {
      const e = edges[+p.dataset.i];
      p.classList.toggle('hl', !!id && (e.from === id || e.to === id));
    }
  }
  function hover(id) { if (!selected) highlight(id); }

  function select(id) {
    selected = id;
    for (const g of gNodes.children) g.classList.toggle('sel', g.dataset.id === id);
    highlight(id);
    renderLabels();
    if (!id) { info.hidden = true; return; }
    const a = store.article(id);
    const rels = relationsOf(a);
    info.hidden = false;
    info.innerHTML = `
      <button class="icon-btn gi-close" aria-label="Close">${icon('x')}</button>
      <div class="gi-head">
        ${a.image ? `<img class="gi-img" data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : `<span class="gi-img icon">${typeIcon(a.type)}</span>`}
        <div><div class="eyebrow">${typeLabel(a.type)}</div><div class="gi-title">${esc(a.title)}</div></div>
      </div>
      ${a.summary ? `<p class="gi-sum">${esc(plain(a.summary, 220))}</p>` : ''}
      ${rels.length ? `<ul class="gi-rels">${rels.slice(0, 12).map((r) => `
        <li><span class="gi-kind" style="--c:var(--edge-${REL_TYPES[r.type].group})">${REL_TYPES[r.type].label}</span>
          <a href="#/w/${wid}/graph${focusId ? '?focus=' + focusId : ''}" data-go="${r.other.id}">${esc(r.other.title)}</a></li>`).join('')}
        ${rels.length > 12 ? `<li class="muted">and ${rels.length - 12} more…</li>` : ''}</ul>` : '<p class="muted small">No typed relationships.</p>'}
      <div class="gi-actions">
        <a class="btn small primary" href="#/w/${wid}/a/${id}">${icon('book-open-text')} Open</a>
        ${hasFamily(a) ? `<a class="btn small" href="#/w/${wid}/tree/${id}">${icon('tree-structure')} Family tree</a>` : ''}
        ${id !== focusId ? `<a class="btn small" href="#/w/${wid}/graph?focus=${id}">${icon('funnel')} Focus</a>` : ''}
      </div>`;
    hydrateImages(info);
    // On narrow screens the sheet covers the lower half: keep the node visible above it.
    const r = box.getBoundingClientRect();
    const n = byId.get(id);
    if (n && r.width < 700) {
      tf.s = Math.max(tf.s, 0.85);
      tf.x = r.width / 2 - n.p.x * tf.s; tf.y = r.height * 0.24 - n.p.y * tf.s;
      applyTf();
      interacted = true; // don't let the settling layout re-fit it under the sheet
    }
    info.querySelector('.gi-close').onclick = () => select(null);
    info.querySelectorAll('[data-go]').forEach((l) => l.onclick = (ev) => {
      ev.preventDefault();
      const n = byId.get(l.dataset.go);
      if (n) { select(n.id); centreOn(n); }
    });
  }

  // ---- controls
  $$('[data-opt]').forEach((b) => b.onclick = () => { opt[b.dataset.opt] = !opt[b.dataset.opt]; savePrefs(opt); syncControls(); build(); });
  $$('[data-group]').forEach((b) => b.onclick = () => { toggle(opt.groups, b.dataset.group); savePrefs(opt); syncControls(); build(); });
  $$('[data-type]').forEach((b) => b.onclick = () => { toggle(opt.types, b.dataset.type); savePrefs(opt); syncControls(); build(); });
  $('#gFilterToggle').onclick = (e) => {
    const open = $('#gFilters').classList.toggle('open');
    e.currentTarget.classList.toggle('on', open);
  };
  const search = $('#gSearch');
  const find = () => {
    const t = search.value.trim().toLowerCase();
    if (!t) return;
    const n = nodes.find((x) => x.a.title.toLowerCase() === t) || nodes.find((x) => x.a.title.toLowerCase().includes(t));
    if (n) { select(n.id); centreOn(n); search.blur(); }
    else {
      const a = allArticles.find((x) => x.title.toLowerCase().includes(t));
      if (a) location.hash = `#/w/${wid}/graph?focus=${a.id}`;
    }
  };
  search.addEventListener('change', find);
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });

  syncControls();
  build();
  // Pre-settle off-screen so the first paint is calm rather than an explosion.
  for (let i = 0; i < 160; i++) { alpha = Math.max(0.05, 1 - i / 160); step(); }
  alpha = 0.3;
  render();
  if (focusId) select(focusId);
  fit();

  const ro = new ResizeObserver(() => { if (!interacted) fit(); });
  ro.observe(box);
  state.cleanup = () => { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); };
}

function wikiEdges(wid, relEdges) {
  const out = [];
  const seen = new Set(relEdges.map((e) => [e.from, e.to].sort().join('|')));
  for (const a of store.articlesOf(wid)) {
    for (const t of new Set(store.linkedTitles(store.articleText(a)))) {
      const b = store.byTitle(wid, t);
      if (!b || b.id === a.id) continue;
      const k = [a.id, b.id].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ from: a.id, to: b.id, kind: 'link', type: null, group: 'link' });
    }
  }
  return out;
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function toggle(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('wa.graph') || '{}'); } catch { return {}; }
}
function savePrefs(opt) {
  try {
    localStorage.setItem('wa.graph', JSON.stringify({ links: opt.links, loose: opt.loose, groups: [...opt.groups], types: [...opt.types] }));
  } catch { /* ignore */ }
}
