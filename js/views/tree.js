// Trees centred on one article. People: a family tree (ancestors above,
// descendants below, spouses/partners beside their partner, siblings beside
// the focus). Organisations: a chart (any parent organisation above; its
// leaders below it; then its sub-organisations, each with their own leaders,
// and its members). Shown full-page at #/w/<world>/tree/<id> and embedded on
// the article page.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { family, relationsOf, setRelation, removeRelation } from '../relations.js';
import { parentOf } from '../templates.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { view, state, setTitle, pageHead, icon, typeIcon, hydrateImages, worldCrumb, sep } from '../ui.js';
import { esc, $, $$, modal, toast, confirmDialog } from '../util.js';

const W = 176, H = 66, GAP = 28, COUPLE_GAP = 22, ROW = 124, DEPTH = 3;

const isOrg = (a) => parentOf(a?.type) === 'organization' || a?.type === 'religion';

export function viewTree(wid, aid) {
  const focus = store.article(aid);
  const org = isOrg(focus);
  setTitle((org ? 'Structure of ' : 'Family of ') + focus.title);
  const head = pageHead({
    eyebrow: `${worldCrumb(wid)} ${sep} <a href="#/w/${wid}/a/${aid}">${esc(focus.title)}</a> ${sep} ${org ? 'Organisation' : 'Family tree'}`,
    title: org ? esc(focus.title) : `The House of ${esc(focus.title)}`,
    actions: `<a class="btn small" href="#/w/${wid}/graph?focus=${aid}">${icon('graph')} In graph</a>
      <a class="btn small" href="#/w/${wid}/a/${aid}">${icon('book-open-text')} Article</a>`,
  });
  if (!(org ? hasStructure(focus) : hasFamilyTree(focus))) {
    view.innerHTML = `<section class="page viz-page">${head}
      <div class="empty-state small"><p>${org ? `Nothing recorded about how ${esc(focus.title)} is organised yet. Add relationships such as <i>Led by</i> or <i>Has member</i>, or file other organisations under it.`
        : `No family recorded for ${esc(focus.title)} yet. Add relationships such as <i>Parent of</i> or <i>Spouse of</i> in the editor.`}</p>
      <p style="margin-top:1rem"><a class="btn primary small" href="#/w/${wid}/a/${aid}/edit">${icon('pencil-simple')} Edit relationships</a></p></div>
    </section>`;
    return;
  }
  view.innerHTML = `<section class="page viz-page">${head}<div class="viz-wrap tree-wrap" id="treeWrap"></div></section>`;
  const pz = drawTree($('#treeWrap'), wid, focus);
  state.cleanup = () => pz.destroy();
}

// The tree for an article page, if it has one: people with family, and
// organisations with leaders, members or sub-organisations.
export const articleTreeKind = (a) => (isOrg(a) ? (hasStructure(a) ? 'org' : null) : hasFamilyTree(a) ? 'family' : null);

// Draw the tree for `focus` into `wrap` (a .viz-wrap). Embedded trees zoom with
// Ctrl/⌘ + scroll so the page still scrolls, and a click opens the article.
export function drawTree(wrap, wid, focus, { embedded = false } = {}) {
  const org = isOrg(focus);
  wrap.innerHTML = `<div class="viz-box" id="treeBox"${embedded ? ` data-hint="${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + scroll to zoom"` : ''}><div class="viz-stage" id="treeStage"></div></div>
    <div class="viz-zoom">
      <button type="button" class="icon-btn" data-z="in" aria-label="Zoom in">${icon('plus')}</button>
      <button type="button" class="icon-btn" data-z="out" aria-label="Zoom out">${icon('minus')}</button>
      <button type="button" class="icon-btn" data-z="fit" aria-label="Fit">${icon('corners-out')}</button>
    </div>
    ${org ? `<button type="button" class="btn small chart-edit" aria-pressed="false">${icon('pencil-simple')} Edit</button>` : '<div class="viz-legend tree-legend"><span><i class="lg-couple"></i>Spouse / partner</span><span><i class="lg-descent"></i>Parent → child</span></div>'}`;
  const box = wrap.querySelector('.viz-box'), stage = wrap.querySelector('.viz-stage');
  let editing = false;
  const size = org ? drawOrg(stage, wid, focus) : drawFamily(stage, wid, focus);
  hydrateImages(stage);
  const pz = panZoom(box, stage, { ...size, embedded });
  pz.fit();
  // Redraw the chart in place (after an edit), keeping the view where it is.
  const redraw = () => {
    const sz = drawOrg(stage, wid, store.article(focus.id), { editing });
    hydrateImages(stage);
    pz.setSize(sz.width, sz.height);
    const { s, tx, ty } = pz.get();
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  const editBtn = wrap.querySelector('.chart-edit');
  if (editBtn) editBtn.onclick = () => {
    editing = !editing;
    editBtn.setAttribute('aria-pressed', String(editing));
    editBtn.innerHTML = editing ? `${icon('check')} Done` : `${icon('pencil-simple')} Edit`;
    wrap.classList.toggle('chart-editing', editing);
    redraw();
  };
  // Editing: the cards' buttons add, change and remove people and groups.
  stage.addEventListener('click', (e) => {
    if (!editing || pz.dragged()) return;
    const t = e.target.closest('[data-add], [data-person], [data-group]');
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (t.dataset.add) addDialog(wid, store.article(t.dataset.org), t.dataset.add, redraw);
    else if (t.dataset.person) personDialog(wid, t.dataset, stage, redraw);
    else groupDialog(t.dataset, redraw);
  }, true);

  // Full page: a person re-centres the tree on them. Embedded: open the article.
  stage.addEventListener('click', (e) => {
    if (pz.dragged()) { e.preventDefault(); e.stopPropagation(); return; }
    if (editing) { e.preventDefault(); return; }
    if (e.target.closest('.tn-open, .org-more a')) return;
    const node = e.target.closest('[data-id]');
    if (!node) return;
    const id = node.dataset.id;
    if (embedded || id === focus.id) location.hash = `#/w/${wid}/a/${id}`;
    else location.hash = `#/w/${wid}/tree/${id}`;
  }, true);
  stage.addEventListener('keydown', (e) => {
    const node = e.target.closest('[data-id]');
    if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); node.click(); }
  });
  wrap.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => {
    if (b.dataset.z === 'fit') pz.fit(); else pz.zoom(b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
  });
  // Large trees: zoom to a readable scale instead of showing everything tiny.
  // A family tree centres on the person; an organisation chart keeps its top
  // (the organisation and what's directly under it) in view.
  const f = stage.querySelector('.focus');
  if (f && pz.get().s < (org ? 0.45 : 0.55)) {
    pz.zoom((org ? 0.62 : 0.75) / pz.get().s);
    const fx = f.offsetLeft + f.offsetWidth / 2, fy = f.offsetTop + f.offsetHeight / 2;
    pz.center(fx, org ? fy + (box.clientHeight / 2 - 70) / pz.get().s : fy);
  }
  return pz;
}

// A person (or anything) as a card. `label` is a small line above the name.
function card(wid, a, { label = '', focus = false, cal, style = '', cls = 'tree-node', attrs = '' } = {}) {
  const dates = cal ? articleDateText(cal, a) : '';
  return `<div class="${cls}${focus ? ' focus' : ''}" style="${style}" data-id="${a.id}"${attrs} tabindex="0" role="button" aria-label="${esc(a.title)}">
      ${a.image ? `<img class="tn-img" data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : `<span class="tn-img icon">${typeIcon(a.type)}</span>`}
      <span class="tn-text">${label ? `<span class="tn-rel">${esc(label)}</span>` : ''}<span class="tn-title">${esc(a.title)}</span>${dates ? `<span class="tn-dates">${esc(dates)}</span>` : ''}</span>
      <a class="tn-open" href="#/w/${wid}/a/${a.id}" title="Open article" aria-label="Open ${esc(a.title)}">${icon('arrow-square-out')}</a>
    </div>`;
}

// ---------------------------------------------------------------- family

const hasFamilyTree = (a) => { const f = family(a); return !!(f.parents.length || f.children.length || f.spouses.length || f.siblings.length); };

function drawFamily(stage, wid, focus) {
  const layout = buildTree(focus);
  const cal = calendarOf(store.world(wid));
  const { minX, minY, maxX, maxY } = layout.bounds;
  const pad = 40;
  const ox = -minX + pad, oy = -minY + pad;
  const width = maxX - minX + pad * 2, height = maxY - minY + pad * 2;
  stage.style.width = width + 'px';
  stage.style.height = height + 'px';
  const svg = [`<svg class="tree-lines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`];
  for (const l of layout.lines) svg.push(`<path class="${l.cls}" d="${l.d(ox, oy)}"/>`);
  svg.push('</svg>');
  stage.innerHTML = svg.join('') + layout.nodes.map((n) => card(wid, n.a, {
    label: n.label, focus: n.a.id === focus.id, cal,
    style: `left:${n.x - W / 2 + ox}px;top:${n.y - H / 2 + oy}px;width:${W}px;height:${H}px`,
  })).join('');
  return { width, height };
}

// ---------------------------------------------------------------- organisations

const MEMBERS_SHOWN = 8;

// Who leads an organisation, which organisations sit under it, who belongs to
// it, and what it is part of.
// People come with the relationship's note, shown as their role ("Dean").
function structureOf(org) {
  const rels = relationsOf(org);
  const pick = (types) => rels.filter((r) => types.includes(r.type)).map((r) => ({ a: r.other, note: (r.note || '').trim(), type: r.type }));
  const uniq = (list) => [...new Map(list.filter((x) => x.a).map((x) => [x.a.id, x])).values()];
  const leaders = uniq(pick(['ledBy', 'ruledBy']));
  const below = uniq([
    ...store.articlesOf(org.worldId).filter((c) => c.parentId === org.id && isOrg(c)).map((a) => ({ a, note: '', type: 'parent' })),
    ...pick(['hasMember', 'servedBy']).filter((x) => isOrg(x.a)),
  ]);
  const members = uniq(pick(['hasMember', 'servedBy']).filter((x) => !isOrg(x.a) && !leaders.some((l) => l.a.id === x.a.id)));
  const parentArt = org.parentId && store.article(org.parentId);
  const above = uniq([...(isOrg(parentArt) ? [{ a: parentArt }] : []), ...pick(['member', 'serves']).filter((x) => isOrg(x.a))]).map((x) => x.a);
  return { leaders, below, members, above };
}
const hasStructure = (org) => { const s = structureOf(org); return !!(s.leaders.length || s.below.length || s.members.length || s.above.length); };

// The chart is nested lists laid out by CSS (lines drawn with borders), so it
// grows to fit names; the stage takes its measured size.
function drawOrg(stage, wid, focus, { editing = false } = {}) {
  const seen = new Set();
  const placed = new Set(); // people already shown lower down, under a sub-organisation
  // In edit mode, each organisation gets buttons to add people and groups.
  const adders = (org) => (editing ? `<div class="org-add">
      <button type="button" data-add="leader" data-org="${org.id}">${icon('plus')} Leader</button>
      <button type="button" data-add="member" data-org="${org.id}">${icon('plus')} Member</button>
      <button type="button" data-add="group" data-org="${org.id}">${icon('plus')} Group</button></div>` : '');
  const personAttrs = (org, x) => (editing ? ` data-person="${x.a.id}" data-org="${org.id}" data-rel="${x.type}" data-note="${esc(x.note)}"` : '');
  const node = (org, depth, via) => {
    seen.add(org.id);
    const s = structureOf(org);
    const below = depth < 2 ? s.below.filter((b) => !seen.has(b.a.id)) : [];
    below.forEach((b) => seen.add(b.a.id));
    const belowHTML = below.map((b) => `<li>${node(b.a, depth + 1, { parent: org, type: b.type })}</li>`);
    // Someone who appears under one of its parts isn't listed again here.
    const members = s.members.filter((m) => !placed.has(m.a.id));
    for (const p of [...s.leaders, ...members]) placed.add(p.a.id);
    const rest = [
      ...belowHTML,
      ...(members.length ? [`<li>${membersCard(wid, members, editing ? org : null)}</li>`] : []),
    ];
    const restHTML = rest.length ? `<ul>${rest.join('')}</ul>` : '';
    // Leaders sit between the organisation and everything under it.
    const lead = s.leaders.length
      ? `<ul><li><div class="org-leaders">${s.leaders.map((l) => card(wid, l.a, { label: l.note || 'Leader', cls: 'tree-node org-node', attrs: personAttrs(org, l) })).join('')}</div>${restHTML}</li></ul>`
      : restHTML;
    const groupAttrs = editing && via ? ` data-group="${org.id}" data-parent="${via.parent.id}" data-via="${via.type}"` : '';
    return `<div class="org-unit">${card(wid, org, { focus: org.id === focus.id, cls: 'tree-node org-node', attrs: groupAttrs })}${adders(org)}</div>${lead}`;
  };
  // Any organisation it belongs to sits above it (just that line, not their other parts).
  const { above } = structureOf(focus);
  above.forEach((a) => seen.add(a.id));
  const inner = node(focus, 0);
  const html = above.length
    ? `<ul class="org-root"><li><div class="org-leaders">${above.map((a) => card(wid, a, { label: 'Part of', cls: 'tree-node org-node' })).join('')}</div><ul><li>${inner}</li></ul></li></ul>`
    : `<ul class="org-root"><li>${inner}</li></ul>`;
  stage.innerHTML = `<div class="org-chart${editing ? ' editing' : ''}">${html}</div>`;
  const chart = stage.firstElementChild;
  return { width: chart.offsetWidth, height: chart.offsetHeight };
}

function membersCard(wid, members, editOrg = null) {
  // Members with a role (a note on the relationship) first.
  members = [...members].sort((x, y) => (!x.note - !y.note) || x.a.title.localeCompare(y.a.title));
  const shown = members.slice(0, MEMBERS_SHOWN);
  return `<div class="tree-node org-node org-members">
      <span class="tn-text"><span class="tn-rel">${members.length} member${members.length === 1 ? '' : 's'}</span>
      <span class="org-more">${(editOrg ? members : shown).map(({ a: m, note, type }) => `<a href="#/w/${wid}/a/${m.id}" data-id="${m.id}"${editOrg ? ` data-person="${m.id}" data-org="${editOrg.id}" data-rel="${type}" data-note="${esc(note)}"` : ''}>${typeIcon(m.type)}<span>${esc(m.title)}${note ? ` <small>${esc(note)}</small>` : ''}</span></a>`).join('')}${!editOrg && members.length > shown.length ? `<span class="muted">and ${members.length - shown.length} more</span>` : ''}</span></span>
    </div>`;
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
export function panZoom(box, stage, { width, height, onTransform, maxScale = 3, minScale = 0.1, embedded = false } = {}) {
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
  let hintTimer;
  const wheel = (e) => {
    // Embedded in a page: plain scrolling scrolls the page; Ctrl/⌘ + scroll zooms.
    if (embedded && !e.ctrlKey && !e.metaKey) {
      box.classList.add('show-hint');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => box.classList.remove('show-hint'), 1200);
      return;
    }
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

// ---------------------------------------------------------------- editing the chart

const ROLE_HINT = { leader: 'e.g. Dean, Guildmaster', member: 'e.g. Head Librarian, Master' };

// Find an article (people for leaders and members, organisations for groups),
// or type a new name to create one.
function addDialog(wid, org, kind, done) {
  const wantOrg = kind === 'group';
  const label = { leader: 'Add a leader', member: 'Add a member', group: 'Add a group' }[kind];
  const pool = () => store.articlesOf(wid).filter((x) => x.id !== org.id && (wantOrg ? isOrg(x) : !isOrg(x)));
  const rank = (x) => (wantOrg || parentOf(x.type) === 'character' ? 0 : 1); // people first
  modal(`${label} to ${org.title}`, `<form class="form" id="chartAdd">
      <label>${wantOrg ? 'Organisation' : 'Person'}<input name="q" autocomplete="off" placeholder="Find an article, or type a new name"></label>
      <ul class="pick-list" id="pickList"></ul>
      ${wantOrg ? '' : `<label>Role <small>optional, shown on the chart</small><input name="note" placeholder="${ROLE_HINT[kind]}"></label>`}
      <div class="actions"><button class="btn primary" disabled>Add</button></div></form>`, {
    onMount: (el, close) => {
      const f = $('#chartAdd', el);
      let chosen = null;
      const draw = () => {
        const q = f.q.value.trim().toLowerCase();
        const hits = pool().filter((x) => !q || x.title.toLowerCase().includes(q))
          .sort((x, y) => (rank(x) - rank(y)) || (!x.title.toLowerCase().startsWith(q) - !y.title.toLowerCase().startsWith(q)) || x.title.localeCompare(y.title)).slice(0, 8);
        const exact = hits.find((x) => x.title.toLowerCase() === q);
        $('#pickList', el).innerHTML = (q && !exact ? `<li><button type="button" data-new>${icon('plus')} Create “${esc(f.q.value.trim())}” as ${wantOrg ? 'an organisation' : 'a character'}</button></li>` : '')
          + hits.map((x) => `<li><button type="button" data-pick="${x.id}" class="${chosen?.id === x.id ? 'on' : ''}">${typeIcon(x.type)} ${esc(x.title)}</button></li>`).join('');
        f.querySelector('.btn.primary').disabled = !chosen && !q;
      };
      f.q.addEventListener('input', () => { chosen = null; draw(); });
      $('#pickList', el).addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.pick) { chosen = store.article(b.dataset.pick); f.q.value = chosen.title; }
        else chosen = null;
        draw();
        if (b.dataset.new !== undefined) f.requestSubmit();
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const name = f.q.value.trim();
        let who = chosen || store.byName(wid, name);
        if (who && (wantOrg ? !isOrg(who) : isOrg(who))) who = null;
        if (!who) {
          if (!name) return;
          who = store.newArticle(wid, wantOrg ? 'organization' : 'character', { title: name });
          await store.save('articles', who);
        }
        if (kind === 'group') await store.save('articles', { ...store.article(who.id), parentId: org.id });
        else await setRelation(store.article(org.id), kind === 'leader' ? 'ledBy' : 'hasMember', who, f.note.value.trim());
        close();
        toast(`${who.title} added to ${org.title}`);
        done();
      };
      draw();
      f.q.focus();
    },
  });
}

// A leader or member: their role, which group they're in, or remove them.
function personDialog(wid, d, stage, done) {
  const person = store.article(d.person), org = store.article(d.org);
  const groups = [...new Set($$('[data-add="member"]', stage).map((b) => b.dataset.org))].map((id) => store.article(id)).filter(Boolean);
  const leaderRel = d.rel === 'ledBy' || d.rel === 'ruledBy';
  modal(person.title, `<form class="form" id="chartPerson">
      <p class="muted small" style="margin-top:0">${leaderRel ? 'Leads' : 'Member of'} <b>${esc(org.title)}</b></p>
      <label>Role <small>shown on the chart</small><input name="note" value="${esc(d.note || '')}" placeholder="${ROLE_HINT[leaderRel ? 'leader' : 'member']}"></label>
      <div class="row">
        <label>In<select name="org">${groups.map((g) => `<option value="${g.id}" ${g.id === org.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
        <label>As<select name="as"><option value="lead" ${leaderRel ? 'selected' : ''}>Leader</option><option value="member" ${leaderRel ? '' : 'selected'}>Member</option></select></label>
      </div>
      <div class="actions"><button type="button" class="btn danger" data-remove>${icon('trash')} Remove from ${esc(org.title)}</button><span class="spacer"></span>
        <a class="btn" href="#/w/${wid}/a/${person.id}">Open article</a><button class="btn primary">Save</button></div></form>`, {
    onMount: (el, close) => {
      const f = $('#chartPerson', el);
      $('[data-remove]', el).onclick = async () => {
        await removeRelation(org, d.rel, person);
        close(); done();
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const to = store.article(f.org.value);
        const type = f.as.value === 'lead' ? (d.rel === 'ruledBy' ? 'ruledBy' : 'ledBy') : (d.rel === 'servedBy' ? 'servedBy' : 'hasMember');
        if (to.id !== org.id || type !== d.rel) await removeRelation(store.article(org.id), d.rel, store.article(person.id));
        await setRelation(store.article(to.id), type, store.article(person.id), f.note.value.trim());
        close(); done();
      };
      f.note.focus();
    },
  });
}

// A sub-group: detach it from the organisation above it.
async function groupDialog(d, done) {
  const group = store.article(d.group), parent = store.article(d.parent);
  if (!(await confirmDialog(`Take ${group.title} out of ${parent.title}? Its own article and people stay as they are.`, 'Take it out'))) return;
  if (d.via === 'parent') await store.save('articles', { ...store.article(group.id), parentId: null });
  else await removeRelation(parent, d.via, group);
  done();
}
