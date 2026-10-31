// Relationship graph: articles as nodes, typed relationships (and optionally
// [[wiki links]]) as edges, laid out with a small force simulation.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { TYPES } from '../store.js';
import { familyOf } from '../templates.js';
import { REL_TYPES, REL_GROUPS, worldEdges, relationsOf } from '../relations.js';
import { articleTreeKind } from './tree.js';
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
    clusters: prefs.clusters ?? true,
    groups: new Set(prefs.groups || Object.keys(REL_GROUPS)),
    types: new Set(prefs.types || Object.keys(TYPES)),
    panel: prefs.panel ?? innerWidth >= 1000,
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

  // Filter panel rows: kinds grouped like the sidebar (Settlements under Locations).
  const countOf = (t) => allArticles.filter((a) => a.type === t).length;
  const parents = Object.keys(TYPES).filter((t) => !TYPES[t].parent && familyOf(t).some(countOf));
  const edgeCount = (g) => relEdges.filter((e) => e.group === g).length;
  const row = (attr, label, count, extra = '', cls = '') => `<label class="check layer-row ${cls}"><input type="checkbox" ${attr}>${extra}<span>${label}</span><span class="count">${count}</span></label>`;
  view.innerHTML = `<section class="page viz-page graph-page">${head}
    ${focusId ? `<div class="graph-focus">${icon('funnel')}<span>Showing connections within two steps of <a href="#/w/${wid}/a/${focusId}">${esc(store.article(focusId).title)}</a></span>
      <a class="btn small quiet" href="#/w/${wid}/graph">${icon('x')} Show everything</a></div>` : ''}
    <div class="graph-tools">
      <div class="graph-search"><input type="search" id="gSearch" placeholder="Find a person, place, faction…" list="gTitles" aria-label="Find in graph">
        <datalist id="gTitles">${allArticles.map((a) => `<option value="${esc(a.title)}">`).join('')}</datalist></div>
      <button type="button" class="btn small" id="gFilterToggle" aria-controls="gLayers">${icon('funnel')} Filters<span class="gl-off" id="gOff"></span></button>
    </div>
    <div class="viz-wrap graph-wrap">
      <div class="viz-box" id="gBox"><svg id="gSvg" class="graph-svg"><g id="gView"><g id="gHulls"></g><g id="gEdges"></g><g id="gLabels"></g><g id="gNodes"></g></g></svg></div>
      <div class="viz-zoom">
        <button class="icon-btn" data-z="in" aria-label="Zoom in">${icon('plus')}</button>
        <button class="icon-btn" data-z="out" aria-label="Zoom out">${icon('minus')}</button>
        <button class="icon-btn" data-z="fit" aria-label="Fit">${icon('corners-out')}</button>
      </div>
      <div class="graph-empty" id="gEmpty" hidden>Nothing matches these filters.</div>
      <aside class="map-panel graph-layers" id="gLayers" hidden>
        <div class="map-panel-head"><span class="field-label">Filters</span><button type="button" class="icon-btn sm" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="gl-sec"><span class="field-label">Bonds</span><span class="gl-all"><button type="button" data-all="groups">All</button><button type="button" data-none="groups">None</button></span></div>
        ${Object.entries(REL_GROUPS).map(([g, label]) => row(`data-group="${g}"`, label, edgeCount(g), `<span class="gl-dot" style="background:var(--edge-${g})"></span>`)).join('')}
        ${row('data-opt="links"', 'Wiki links', linkEdges.length, '<span class="gl-dot dash"></span>')}
        <div class="gl-sec"><span class="field-label">Kinds</span><span class="gl-all"><button type="button" data-all="types">All</button><button type="button" data-none="types">None</button></span></div>
        ${parents.map((p) => row(`data-type="${p}"`, TYPES[p].plural, familyOf(p).reduce((n, t) => n + countOf(t), 0), typeIcon(p))
          + (familyOf(p).length > 1 ? familyOf(p).slice(1).filter(countOf).map((t) => row(`data-type="${t}"`, TYPES[t].plural, countOf(t), typeIcon(t), 'sub')).join('') : '')).join('')}
        ${row('data-opt="loose"', 'Unconnected articles', '', icon('circle'), 'gl-loose')}
        ${row('data-opt="clusters"', 'Group into clusters', '', icon('circles-three'))}
      </aside>
      <aside class="graph-info" id="gInfo" hidden></aside>
    </div>
  </section>`;

  const box = $('#gBox'), svg = $('#gSvg'), gView = $('#gView');
  const gEdges = $('#gEdges'), gNodes = $('#gNodes'), gLabels = $('#gLabels'), gHulls = $('#gHulls');
  const info = $('#gInfo');

  // Positions persist across filter changes for stability.
  const pos = new Map();
  let nodes = [], edges = [], byId = new Map(), clusters = [];
  let selected = null;
  let tf = { s: 1, x: 0, y: 0 };
  let alpha = 0, raf = 0, interacted = false;

  const syncControls = () => {
    $$('[data-opt]').forEach((c) => { c.checked = !!opt[c.dataset.opt]; });
    $$('[data-group]').forEach((c) => { c.checked = opt.groups.has(c.dataset.group); });
    $$('[data-type]').forEach((c) => {
      const fam = TYPES[c.dataset.type].parent ? [c.dataset.type] : familyOf(c.dataset.type);
      const on = fam.filter((t) => opt.types.has(t)).length;
      c.checked = on === fam.length;
      c.indeterminate = on > 0 && on < fam.length;
    });
    $('#gLayers').hidden = !opt.panel;
    $('#gFilterToggle').classList.toggle('on', opt.panel);
    // How many filters are switched off, shown on the Filters button.
    const off = Object.keys(REL_GROUPS).filter((g) => !opt.groups.has(g)).length
      + parents.flatMap(familyOf).filter((t) => countOf(t) && !opt.types.has(t)).length;
    $('#gOff').textContent = off ? ` · ${off} off` : '';
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
    nodes = [...ids].map((id) => ({ id, a: store.article(id) }));
    byId = new Map(nodes.map((n) => [n.id, n]));
    const deg = new Map();
    edges = es.map((e) => {
      deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1);
      return { ...e, s: byId.get(e.from), t: byId.get(e.to) };
    });
    nodes.forEach((n) => { n.deg = deg.get(n.id) || 0; n.w = labelWidth(n.a.title); });
    // Groups of closely connected articles; each gets its own area.
    clusters = opt.clusters ? findClusters(nodes, edges) : [];
    nodes.forEach((n) => { n.c = -1; });
    clusters.forEach((c, i) => c.members.forEach((n) => { n.c = i; }));
    edges.forEach((e) => { e.cross = e.s.c !== e.t.c || e.s.c < 0; });
    // New articles start near their group's place (groups spiral out from the centre).
    nodes.forEach((n) => {
      if (!pos.has(n.id)) {
        const [ax, ay] = n.c >= 0 ? clusterAnchor(n.c) : [0, 0];
        const ang = Math.random() * Math.PI * 2, rad = 30 + Math.random() * (n.c >= 0 ? 90 : 260);
        pos.set(n.id, { x: ax + Math.cos(ang) * rad, y: ay + Math.sin(ang) * rad, vx: 0, vy: 0, fixed: false });
      }
      n.p = pos.get(n.id);
      if (n.id === focusId && !n.p.seeded) { n.p.x = 0; n.p.y = 0; n.p.seeded = true; }
    });
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
      return `<path class="g-edge ${e.kind === 'link' ? 'link' : 'g-' + e.group}${e.cross && clusters.length ? ' cross' : ''}" data-i="${i}"><title>${esc(e.s.a.title)}: ${esc(label)} ${esc(e.t.a.title)}</title></path>`;
    }).join('');
    gNodes.innerHTML = nodes.map((n) => `
      <g class="g-node t-${n.a.type}${n.id === focusId ? ' focus' : ''}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.a.title)}">
        <circle class="g-halo" r="${R + 7}"/>
        <circle class="g-dot" r="${R}"/>
        ${typeIcon(n.a.type).replace('<svg ', `<svg x="-9" y="-9" width="18" height="18" `)}
        <text class="g-name" y="${R + 16}">${esc(truncate(n.a.title, 26))}</text>
      </g>`).join('');
    gLabels.innerHTML = '';
    gHulls.innerHTML = clusters.map((c, i) => c.members.length < 3 ? '' : `
      <g class="g-hull" style="--hc:${HULL_COLOURS[i % HULL_COLOURS.length]}"><path></path>
        <text class="g-hull-label">around ${esc(truncate(c.hub.a.title, 30))}</text></g>`).join('');
    tick(true);
  }

  // A soft blob around each group: its members' outline drawn with a very wide
  // rounded stroke, so it wraps them with padding.
  function renderHulls() {
    const gs = gHulls.children;
    let k = 0;
    clusters.forEach((c) => {
      if (c.members.length < 3) return;
      const g = gs[k++];
      const pts = c.members.flatMap((n) => [[n.p.x, n.p.y], [n.p.x, n.p.y + R + 14]]);
      const h = hull(pts);
      g.firstElementChild.setAttribute('d', 'M' + h.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z');
      const top = Math.min(...h.map((q) => q[1])), cx = h.reduce((t, q) => t + q[0], 0) / h.length;
      const t = g.lastElementChild;
      t.setAttribute('x', cx.toFixed(1)); t.setAttribute('y', (top - 44).toFixed(1));
    });
  }

  function edgePath(e) {
    const { x: x1, y: y1 } = e.s.p, { x: x2, y: y2 } = e.t.p;
    if (!e.idx && e.cross && clusters.length) {
      // Links between groups bow gently, so they read as a separate layer.
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const off = 0.14 * (e.from < e.to ? 1 : -1);
      return `M${x1} ${y1}Q${mx - dy * off} ${my + dx * off} ${x2} ${y2}`;
    }
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
    renderHulls();
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
  // Articles repel (more so between groups), relationships pull like springs
  // (short within a group, long between groups), each group draws its members
  // together, and names are kept from overlapping.
  function step() {
    const n = nodes.length;
    const k = 170;
    for (let i = 0; i < n; i++) {
      const A = nodes[i], a = A.p;
      for (let j = i + 1; j < n; j++) {
        const B = nodes[j], b = B.p;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        if (d2 > 490000) continue;
        const apart = clusters.length && A.c !== B.c ? 1.6 : 1;
        const f = (k * k) / d2 * 0.9 * apart;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = e.s.p, b = e.t.p;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const between = e.cross && clusters.length;
      const rest = between ? 280 : e.kind === 'link' ? 190 : 140;
      const f = (d - rest) * (between ? 0.012 : e.kind === 'link' ? 0.02 : 0.05);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    // Each group's members drift towards the group's middle.
    for (const c of clusters) {
      if (c.members.length < 2) continue;
      let cx = 0, cy = 0;
      for (const m of c.members) { cx += m.p.x; cy += m.p.y; }
      cx /= c.members.length; cy /= c.members.length;
      for (const m of c.members) { m.p.vx += (cx - m.p.x) * 0.02; m.p.vy += (cy - m.p.y) * 0.02; }
    }
    // Keep each article's dot-and-name box clear of its neighbours'.
    for (let i = 0; i < n; i++) {
      const A = nodes[i], a = A.p;
      for (let j = i + 1; j < n; j++) {
        const B = nodes[j], b = B.p;
        const ox = (A.w + B.w) / 2 + 10 - Math.abs(a.x - b.x);
        const oy = 2 * R + 30 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) { const s = (a.x < b.x ? -1 : 1) * ox * 0.25; a.vx += s; b.vx -= s; }
        else { const s = (a.y < b.y ? -1 : 1) * oy * 0.25; a.vy += s; b.vy -= s; }
      }
    }
    for (const nd of nodes) {
      const p = nd.p;
      p.vx -= p.x * 0.008; p.vy -= p.y * 0.008;
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
    const pad = clusters.length ? 60 : 0; // room for group outlines and labels
    const minX = Math.min(...xs) - 70 - pad, maxX = Math.max(...xs) + 70 + pad, minY = Math.min(...ys) - 50 - pad - (clusters.length ? 30 : 0), maxY = Math.max(...ys) + 60 + pad;
    // leave room for the side panel when it is open on wide screens
    const wide = r.width >= 700;
    const left = wide && opt.panel ? $('#gLayers').offsetWidth + 20 : 0; // the filter panel, on the left
    const avail = (!info.hidden && wide ? r.width - info.offsetWidth - 20 : r.width) - left;
    tf.s = Math.max(0.2, Math.min(1.4, Math.min(avail / (maxX - minX), r.height / (maxY - minY))));
    tf.x = left + avail / 2 - ((minX + maxX) / 2) * tf.s;
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
    // Left button, touch or pen; the middle button always pans (and is never a click).
    if (e.button > 1) return;
    if (e.button === 1) e.preventDefault();
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
    const node = g && e.button !== 1 ? byId.get(g.dataset.id) : null;
    drag = { node, sx: e.clientX, sy: e.clientY, tx: tf.x, ty: tf.y, moved: false, rx: r.left, ry: r.top, panOnly: e.button === 1 };
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
    if (!drag.moved && !drag.panOnly && e.type === 'pointerup') select(drag.node ? drag.node.id : null);
    drag = null;
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // middle-drag pans instead of autoscrolling
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
        ${articleTreeKind(a) ? `<a class="btn small" href="#/w/${wid}/tree/${id}">${icon('tree-structure')} ${articleTreeKind(a) === 'org' ? 'Organisation' : 'Family tree'}</a>` : ''}
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
  const changed = () => { savePrefs(opt); syncControls(); build(); };
  $$('[data-opt]').forEach((c) => c.onchange = () => { opt[c.dataset.opt] = c.checked; changed(); });
  $$('[data-group]').forEach((c) => c.onchange = () => { if (c.checked) opt.groups.add(c.dataset.group); else opt.groups.delete(c.dataset.group); changed(); });
  // A parent kind switches its sub-kinds with it.
  $$('[data-type]').forEach((c) => c.onchange = () => {
    const fam = TYPES[c.dataset.type].parent ? [c.dataset.type] : familyOf(c.dataset.type);
    fam.forEach((t) => (c.checked ? opt.types.add(t) : opt.types.delete(t)));
    changed();
  });
  $$('[data-all], [data-none]').forEach((b) => b.onclick = () => {
    const key = b.dataset.all || b.dataset.none;
    opt[key] = new Set(b.dataset.all ? (key === 'groups' ? Object.keys(REL_GROUPS) : Object.keys(TYPES)) : []);
    changed();
  });
  const setPanel = (open) => { opt.panel = open; savePrefs(opt); syncControls(); if (!interacted) fit(); };
  $('#gFilterToggle').onclick = () => setPanel(!opt.panel);
  $('#gLayers [data-close]').onclick = () => setPanel(false);
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

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('wa.graph') || '{}'); } catch { return {}; }
}
function savePrefs(opt) {
  try {
    localStorage.setItem('wa.graph', JSON.stringify({ links: opt.links, loose: opt.loose, clusters: opt.clusters, groups: [...opt.groups], types: [...opt.types], panel: opt.panel }));
  } catch { /* ignore */ }
}

// ---- groups

const HULL_COLOURS = ['#c4a46a', '#5f8f6f', '#4f74a8', '#a85c8a', '#c4553b', '#3f8c8c', '#7d5a8c', '#8fae5a', '#d9824a', '#6b8fb8'];
const labelWidth = (title) => Math.max(2 * R + 8, Math.min(26, title.length) * 6.6);
// Where group i sits to start with: a sunflower spiral, biggest groups in the middle.
const clusterAnchor = (i) => { const r = 300 * Math.sqrt(i), t = i * 2.4; return [Math.cos(t) * r, Math.sin(t) * r]; };

// Communities by the Louvain method: articles move to whichever neighbouring
// group gains the most "modularity" (links inside groups beyond what chance
// would give), then groups are merged the same way. Wiki links count less
// than typed relationships. Returns [{ members, hub }] biggest first.
function findClusters(nodes, edges) {
  let ids = nodes.map((n) => n.id);
  let links = edges.map((e) => [e.from, e.to, e.kind === 'link' ? 0.4 : 1]);
  let groupOf = new Map(ids.map((id) => [id, id])); // article → current group
  for (let level = 0; level < 3; level++) {
    const moved = louvainPass(ids, links);
    const comms = new Set(moved.values());
    if (comms.size === ids.length) break; // nothing merged
    for (const [id, g] of groupOf) groupOf.set(id, moved.get(g));
    ids = [...comms];
    const agg = new Map();
    for (const [a, b, w] of links) {
      const ca = moved.get(a), cb = moved.get(b);
      const key = ca < cb ? ca + '|' + cb : cb + '|' + ca;
      agg.set(key, (agg.get(key) || 0) + w);
    }
    links = [...agg].map(([k, w]) => { const [a, b] = k.split('|'); return [a, b, w]; });
  }
  const groups = new Map();
  for (const n of nodes) { const g = groupOf.get(n.id); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
  return [...groups.values()]
    .filter((m) => m.length > 1 || m[0].deg > 0)
    .map((members) => ({ members, hub: members.reduce((h, n) => (n.deg > h.deg ? n : h), members[0]) }))
    .sort((a, b) => b.members.length - a.members.length);
}

function louvainPass(ids, links) {
  const nb = new Map(ids.map((id) => [id, new Map()]));
  let m2 = 0;
  for (const [a, b, w] of links) {
    if (a === b) { nb.get(a).set(a, (nb.get(a).get(a) || 0) + 2 * w); m2 += 2 * w; continue; }
    nb.get(a).set(b, (nb.get(a).get(b) || 0) + w);
    nb.get(b).set(a, (nb.get(b).get(a) || 0) + w);
    m2 += 2 * w;
  }
  const comm = new Map(ids.map((id) => [id, id]));
  if (!m2) return comm;
  const k = new Map(ids.map((id) => [id, [...nb.get(id).values()].reduce((t, w) => t + w, 0)]));
  const tot = new Map(ids.map((id) => [id, k.get(id)]));
  const order = [...ids].sort();
  for (let pass = 0, moved = true; moved && pass < 20; pass++) {
    moved = false;
    for (const id of order) {
      const own = comm.get(id), ki = k.get(id);
      tot.set(own, tot.get(own) - ki);
      const toward = new Map();
      for (const [m, w] of nb.get(id)) if (m !== id) toward.set(comm.get(m), (toward.get(comm.get(m)) || 0) + w);
      let best = own, bestGain = (toward.get(own) || 0) - (tot.get(own) * ki) / m2;
      for (const [c, w] of toward) {
        const gain = w - (tot.get(c) * ki) / m2;
        if (gain > bestGain + 1e-9 || (Math.abs(gain - bestGain) < 1e-9 && c < best)) { best = c; bestGain = gain; }
      }
      tot.set(best, tot.get(best) + ki);
      if (best !== own) { comm.set(id, best); moved = true; }
    }
  }
  return comm;
}

// Convex hull (monotone chain) of [x, y] points.
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
