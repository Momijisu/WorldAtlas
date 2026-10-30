// Maps: a list of a world's maps, and the interactive map page with pins,
// regions, layers, nested maps and a "Places" finder.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { mountMap } from '../mapview.js';
import { dropzoneEmpty, wireDropzone } from '../dropzone.js';
import { TYPES } from '../store.js';
import { familyOf } from '../templates.js';
import { plain } from '../markdown.js';
import { view, state, setTitle, pageHead, icon, hydrateImages, typeIcon, typeLabel, worldCrumb, sep } from '../ui.js';
import { $, $$, esc, uid, toast, modal, confirmDialog, prepareImage } from '../util.js';

export const PIN_ICONS = ['map-pin', 'castle-turret', 'house', 'tent', 'ruins', 'stairs', 'cave', 'mountains', 'tree-evergreen', 'anchor', 'skull', 'star',
  'crown', 'flag', 'sword', 'church', 'boat', 'flame', 'diamond', 'shield', 'compass'];
const PIN_NAMES = { stairs: 'dungeon' }; // hover names where the icon's own name isn't the place
const SWATCHES = [
  '#c4553b', '#a8322d', '#d9824a', '#c4a46a', '#e3c45b', '#8a6a35',
  '#5f8f6f', '#3f6b45', '#8fae5a', '#3f8c8c', '#4f74a8', '#2f4c7a',
  '#7d5a8c', '#a85c8a', '#6b5444', '#3b3631', '#8c8c86', '#e9e1d1',
];
// How a region is drawn: filled, just its outline, or transparent (only its
// name shows; the area is outlined while hovered). Stored as 'hidden'.
const REGION_FILLS = { solid: 'Solid', outline: 'Outline', hidden: 'Transparent' };

// The map(s) containing a pin/region that links to `mid` — first one wins.
function parentMap(wid, mid) {
  return store.mapsOf(wid).find((m) => m.id !== mid &&
    [...(m.pins || []), ...(m.regions || [])].some((it) => it.mapId === mid)) || null;
}

function mapTrail(wid, mid) {
  const trail = [];
  const seen = new Set([mid]);
  let p = parentMap(wid, mid);
  while (p && !seen.has(p.id)) { trail.unshift(p); seen.add(p.id); p = parentMap(wid, p.id); }
  return trail;
}

export const itemTitle = (it) => it.label || store.article(it.articleId)?.title || store.map(it.mapId)?.name || '';

// The article a place or region stands for: the one it links to, or else the
// article its name matches (so naming a place before writing its article
// works like a [[link]] to a page that doesn't exist yet).
export const linkedArticle = (wid, it) => store.article(it.articleId) || (it.label ? store.byTitle(wid, it.label) : null);

// A layer is a template key (pins for Settlements, Characters…), a name the
// user made up, or '' for General.
const isTemplateLayer = (l) => !!l && Object.hasOwn(TYPES, l);
const layerName = (l) => (isTemplateLayer(l) ? TYPES[l].plural : l || 'General');

// Layers typed by hand before layers were templates ("Settlements",
// "character") become the matching template layer. Returns null if none change.
function templateLayers(m) {
  const byName = new Map(Object.entries(TYPES).flatMap(([k, t]) => [[k, k], [t.label.toLowerCase(), k], [t.plural.toLowerCase(), k]]));
  let changed = false;
  const fix = (it) => {
    const k = it.layer && !isTemplateLayer(it.layer) && byName.get(it.layer.trim().toLowerCase());
    if (!k) return it;
    changed = true;
    return { ...it, layer: k };
  };
  const next = { ...m, pins: (m.pins || []).map(fix), regions: (m.regions || []).map(fix) };
  return changed ? next : null;
}

// A map's layers: in the order arranged in its key (map.layerOrder, which also
// keeps empty groups), then any others, General first and the rest A–Z.
function layersOf(m) {
  const names = new Set();
  for (const it of [...(m.pins || []), ...(m.regions || [])]) names.add(it.layer || '');
  const ordered = [...new Set(m.layerOrder || [])].filter((l) => names.has(l) || (l && !isTemplateLayer(l)));
  const rest = [...names].filter((l) => !ordered.includes(l)).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  return [...ordered, ...rest];
}

// Numbered pins: counted layer by layer (in the Layers list order), then in the
// order they were placed, so each layer's places sit together in the key.
function pinNumbers(m) {
  const nums = new Map();
  let n = 0;
  for (const l of layersOf(m)) for (const p of m.pins || []) if ((p.layer || '') === l) nums.set(p.id, ++n);
  return nums;
}

const hiddenKey = (mid) => 'wa.map.hidden.' + mid;
function loadHidden(mid) {
  try { return new Set(JSON.parse(localStorage.getItem(hiddenKey(mid)) || '[]')); } catch { return new Set(); }
}
function saveHidden(mid, set) {
  try { localStorage.setItem(hiddenKey(mid), JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------- list

export function viewMaps(wid) {
  setTitle('Maps');
  const maps = store.mapsOf(wid);
  view.innerHTML = `<section class="page">
    ${pageHead({ eyebrow: `${worldCrumb(wid)} ${sep} Atlas`, title: 'Maps', actions: `<button class="btn primary" id="newMap">${icon('plus')} New map</button>` })}
    ${maps.length ? `<div class="cards map-cards">${maps.map((m) => {
      const parent = parentMap(wid, m.id);
      return `<a class="card" href="#/w/${wid}/m/${m.id}">
        <div class="card-cover" data-bg="${m.image}">${icon('map-trifold')}</div>
        <div class="card-body">
          ${parent ? `<div class="eyebrow">Within ${esc(parent.name)}</div>` : ''}
          <h3>${esc(m.name)}</h3>
          <div class="eyebrow">${(m.pins || []).length} places · ${(m.regions || []).length} regions</div>
        </div></a>`;
    }).join('')}</div>`
    : `<div class="empty-state small"><p>Upload a map image, then pin articles and outline regions on it.</p></div>`}
  </section>`;
  $('#newMap').onclick = () => mapDialog(wid);
  hydrateImages();
}

function mapDialog(wid, m) {
  const isNew = !m;
  m = m ? { ...m } : { id: uid(), worldId: wid, name: '', image: null, pins: [], regions: [] };
  modal(isNew ? 'New map' : 'Map settings', `
    <form class="form" id="mf">
      <label>Name<input name="name" required value="${esc(m.name)}" placeholder="e.g. The Known World"></label>
      <div class="field-label">${isNew ? 'Map image' : 'Replace image <small>optional, pins stay in place</small>'}</div>
      <div class="image-field">
        <img class="thumb" hidden alt="">
        ${dropzoneEmpty('the map image')}
        <label class="btn small">${icon('image')} Choose image<input type="file" name="file" accept="image/*" hidden></label>
        <span class="small muted dz-name"></span>
      </div>
      <div class="field-label">Pins show</div>
      <div class="seg" id="pinStyle"><button type="button" data-ps="names">Names</button><button type="button" data-ps="numbers">Numbers, with a key</button></div>
      <div class="actions">
        ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')} Delete map</button><span class="spacer"></span>`}
        <button class="btn primary">${isNew ? 'Create map' : 'Save'}</button>
      </div>
    </form>`, {
    onMount: (el, close) => {
      const f = $('#mf', el);
      wireDropzone($('.image-field', f));
      let pinStyle = m.pinStyle || 'names';
      const showStyle = () => $$('[data-ps]', el).forEach((b) => b.classList.toggle('on', b.dataset.ps === pinStyle));
      $$('[data-ps]', el).forEach((b) => b.onclick = () => { pinStyle = b.dataset.ps; showStyle(); });
      showStyle();
      f.file.addEventListener('change', () => {
        const file = f.file.files[0];
        if (!file) return;
        const t = $('.image-field .thumb', f);
        URL.revokeObjectURL(t.src);
        t.src = URL.createObjectURL(file); t.hidden = false;
        $('.dz-name', f).textContent = file.name;
      });
      $('[data-del]', el)?.addEventListener('click', async () => {
        if (!(await confirmDialog(`Delete the map “${m.name}” and its pins and regions?`))) return;
        await store.deleteMap(m.id); close(); location.hash = `#/w/${wid}/maps`;
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (isNew && !f.file.files[0]) return toast('Choose an image for the map');
        const btn = $('.btn.primary', f);
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          if (f.file.files[0]) m.image = await store.addImage(await prepareImage(f.file.files[0], 4096));
          m.name = f.name.value.trim();
          m.pinStyle = pinStyle === 'numbers' ? 'numbers' : undefined;
          await store.save('maps', m);
          close();
          if (isNew) location.hash = `#/w/${wid}/m/${m.id}`; else state.route();
        } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = 'Save'; }
      };
    },
  });
}

// ---------------------------------------------------------------- map page

export async function viewMap(wid, mid, q) {
  const migrated = templateLayers(store.map(mid));
  if (migrated) store.save('maps', migrated);
  const m = migrated || store.map(mid);
  setTitle(m.name);
  const trail = mapTrail(wid, mid);
  let editing = false;
  let tool = 'pin';         // 'pin' | 'region'
  let draft = null;         // region vertices being drawn
  let moving = null;        // pin id waiting for its new location
  let hidden = loadHidden(mid);
  let folded = new Set(); // layers whose key list is folded away
  try { folded = new Set(JSON.parse(localStorage.getItem('wa.map.folded.' + mid) || '[]')); } catch { /* storage unavailable */ }
  const cur = () => store.map(mid) || m;

  view.innerHTML = `<section class="page map-page">
    ${pageHead({
      cls: 'map-head',
      eyebrow: [worldCrumb(wid), `<a href="#/w/${wid}/maps">Maps</a>`, ...trail.map((t) => `<a href="#/w/${wid}/m/${t.id}">${esc(t.name)}</a>`)].join(` ${sep} `),
      title: esc(m.name),
      actions: `
        <button class="btn small quiet" id="placesBtn" title="Find a place">${icon('magnifying-glass')}<span class="hide-sm">Places</span></button>
        <button class="btn small quiet" id="layersBtn" title="Layers">${icon('stack')}<span class="hide-sm">Layers</span></button>
        <button class="btn small" id="editBtn">${icon('pencil-simple')}<span>Edit</span></button>
        <button class="icon-btn" id="settingsBtn" title="Map settings">${icon('gear-six')}</button>`,
    })}
    <div class="map-wrap">
      <div class="map-box" id="mapBox"></div>
      <div class="map-zoom">
        <button class="icon-btn" data-z="in" title="Zoom in">${icon('plus')}</button>
        <button class="icon-btn" data-z="out" title="Zoom out">${icon('minus')}</button>
        <button class="icon-btn" data-z="fit" title="Fit map">${icon('corners-out')}</button>
      </div>
      <div class="map-panel" id="layersPanel" hidden></div>
      <div class="map-panel" id="placesPanel" hidden>
        <div class="map-panel-head"><span class="field-label">Places</span><button class="icon-btn sm" data-close>${icon('x')}</button></div>
        <input type="search" id="placesQ" placeholder="Search pins & regions…">
        <ul class="places-list" id="placesList"></ul>
      </div>
      <div class="map-toolbar" id="editBar" hidden></div>
      <div class="map-info" id="mapInfo" hidden></div>
    </div>
  </section>`;

  const box = $('#mapBox');
  const src = await store.imageURL(m.image);
  if (!box.isConnected) return; // left this page while the image loaded
  if (!src) {
    box.innerHTML = `<p class="muted pad">This map’s image hasn’t downloaded yet. It will appear after the next sync.</p>`;
    return;
  }
  const info = $('#mapInfo');
  const labelled = (list) => (list || []).map((it) => ({ ...it, label: itemTitle(it) }));
  const numbered = () => cur().pinStyle === 'numbers';
  const refresh = () => {
    const nums = numbered() ? pinNumbers(cur()) : null;
    ctl.setItems({ pins: labelled(cur().pins).map((p) => (nums ? { ...p, num: nums.get(p.id) } : p)), regions: labelled(cur().regions), hidden });
  };
  const persist = async (patch) => {
    await store.save('maps', { ...cur(), ...patch });
    refresh();
    renderLayers();
    renderPlaces();
  };

  // ---- info card
  async function showInfo(it, kind) {
    const a = linkedArticle(wid, it);
    const sub = store.map(it.mapId);
    // No article yet: offer to write one, straight into the layer's template if it has one.
    const create = !a && it.label ? `<a class="btn small" href="#/w/${wid}/new/${isTemplateLayer(it.layer) ? it.layer : 'article'}?title=${encodeURIComponent(it.label)}"${isTemplateLayer(it.layer) ? '' : ` data-create="${esc(it.label)}"`}>${icon('plus')} Write about ${esc(it.label)}</a>` : '';
    info.hidden = false;
    info.classList.toggle('has-map', !!sub?.image);
    info.innerHTML = `<button class="icon-btn sm close" aria-label="Close">${icon('x')}</button>
      ${a?.image ? `<img data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : ''}
      <div class="info-body">
        <div class="eyebrow">${a ? `${typeIcon(a.type)} ${typeLabel(a.type)}` : kind === 'region' ? `${icon('polygon')} Region` : `${icon(it.icon || 'map-pin')} Place`}${it.layer ? ` <span class="sep">/</span> ${esc(layerName(it.layer))}` : ''}</div>
        <div class="info-title">${esc(itemTitle(it))}</div>
        ${a?.summary ? `<p>${esc(plain(a.summary, 200))}</p>` : ''}
        ${sub?.image ? `<a class="info-map" href="#/w/${wid}/m/${sub.id}" title="Open ${esc(sub.name)}"><img data-img="${sub.image}" alt=""><span>${icon('map-trifold')} ${esc(sub.name)}</span></a>` : ''}
        <div class="info-actions">
          ${a ? `<a class="btn small" href="#/w/${wid}/a/${a.id}">${icon('book-open-text')} Read article</a>` : create}
          ${sub ? `<a class="btn small primary" href="#/w/${wid}/m/${sub.id}">${icon('map-trifold')} Open ${esc(sub.name)}</a>` : ''}
        </div>
      </div>`;
    info.querySelector('.close').onclick = () => { info.hidden = true; };
    hydrateImages(info);
  }

  // ---- viewer
  const ctl = mountMap(box, {
    src,
    isDrawing: () => editing && tool === 'region',
    // Editing: the Pin tool drops pins anywhere, even inside regions; the
    // Region tool edits a region you tap before you start outlining a new one.
    regionTaps: () => !editing || (tool === 'region' && !draft?.length),
    onDraftChange: (points) => { draft = points; },
    onPinClick: (p) => {
      const pin = (cur().pins || []).find((x) => x.id === p.id);
      if (!pin) return;
      if (editing) pinDialog(pin); else showInfo(pin, 'pin');
    },
    onRegionClick: (r) => {
      const reg = (cur().regions || []).find((x) => x.id === r.id);
      if (!reg) return;
      if (editing) regionDialog(reg); else showInfo(reg, 'region');
    },
    onBackgroundTap: (pt) => {
      info.hidden = true;
      if (moving) {
        const pins = cur().pins.map((p) => (p.id === moving ? { ...p, ...pt } : p));
        moving = null;
        renderEditBar();
        return persist({ pins });
      }
      if (!editing) return;
      if (tool === 'region') {
        draft = [...(draft || []), [pt.x, pt.y]];
        ctl.setDraft(draft);
        renderEditBar();
      } else {
        pinDialog({ id: uid(), ...pt, articleId: '', mapId: '', label: '', color: SWATCHES[0], icon: 'map-pin', layer: lastLayer }, true);
      }
    },
  });
  state.cleanup = () => ctl.destroy();
  refresh();

  // ---- edit toolbar
  function renderEditBar() {
    const bar = $('#editBar');
    bar.hidden = !editing;
    if (!editing) return;
    if (moving) {
      bar.innerHTML = `<span class="hint">Tap the new location for this pin</span>
        <button class="btn small" data-act="cancel-move">Cancel</button>`;
    } else if (tool === 'region' && draft?.length) {
      bar.innerHTML = `<span class="hint">${draft.length} point${draft.length === 1 ? '' : 's'}, tap to add more, drag a point to move it</span>
        <button class="btn small" data-act="undo" ${draft.length ? '' : 'disabled'}>${icon('arrow-counter-clockwise')} Undo</button>
        <button class="btn small" data-act="cancel">Cancel</button>
        <button class="btn small primary" data-act="finish" ${draft.length >= 3 ? '' : 'disabled'}>${icon('check')} Finish</button>`;
    } else {
      bar.innerHTML = `<div class="seg">
          <button data-tool="pin" class="${tool === 'pin' ? 'on' : ''}">${icon('map-pin')} Pin</button>
          <button data-tool="region" class="${tool === 'region' ? 'on' : ''}">${icon('polygon')} Region</button>
        </div>
        <span class="hint">${tool === 'pin' ? 'Tap to place a pin, or tap a pin to edit it' : 'Tap to start outlining a region, or tap a region to edit it'}</span>`;
    }
    $$('[data-tool]', bar).forEach((b) => b.onclick = () => {
      tool = b.dataset.tool;
      draft = tool === 'region' ? [] : null;
      ctl.setDraft(draft);
      renderEditBar();
    });
    $$('[data-act]', bar).forEach((b) => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'cancel-move') moving = null;
      if (act === 'undo') draft = draft.slice(0, -1);
      if (act === 'cancel') { draft = []; }
      if (act === 'finish') {
        const points = draft;
        draft = [];
        regionDialog({ id: uid(), points, color: SWATCHES[1], label: '', articleId: '', mapId: '', layer: lastLayer }, true);
      }
      ctl.setDraft(draft);
      renderEditBar();
    });
  }

  function setEditing(on) {
    editing = on;
    moving = null;
    draft = on && tool === 'region' ? [] : null;
    ctl.setDraft(draft);
    const b = $('#editBtn');
    b.classList.toggle('on', on);
    b.innerHTML = on ? `${icon('check')}<span>Done</span>` : `${icon('pencil-simple')}<span>Edit</span>`;
    $('#mapBox').classList.toggle('editing', on);
    info.hidden = true;
    renderEditBar();
    renderLayers();
  }
  $('#editBtn').onclick = () => setEditing(!editing);

  // ---- layers panel
  // In edit mode the key can be arranged: drag places within and between
  // layers, drag layers to reorder them, and add, rename or remove groups.
  // Numbers follow the order.
  function renderLayers() {
    const panel = $('#layersPanel');
    const m = cur();
    const pins = m.pins || [], regions = m.regions || [];
    const all = [...pins, ...regions];
    const layers = layersOf(m);
    const nums = numbered() ? pinNumbers(m) : null;
    const arranging = editing;
    const listed = !!nums || arranging; // places are listed under their layers
    const itemsOf = (l) => [
      ...pins.filter((p) => (p.layer || '') === l).map((it) => ({ it, kind: 'pin' })),
      ...(arranging ? regions.filter((r) => (r.layer || '') === l).map((it) => ({ it, kind: 'region' })) : []),
    ];
    const grip = (label) => (arranging ? `<button type="button" class="grip" data-grip aria-label="Move ${esc(label)}" title="Drag to move, or use the arrow keys">${icon('dots-six-vertical')}</button>` : '');
    const keyFor = (l) => {
      const list = listed && !folded.has(l) ? itemsOf(l) : [];
      if (!list.length) return arranging && !folded.has(l) ? `<ol class="map-key empty" data-drop-layer="${esc(l)}"><li class="muted small">Drop places here</li></ol>` : '';
      return `<ol class="map-key${hidden.has(l) ? ' off' : ''}" data-drop-layer="${esc(l)}">${list.map(({ it, kind }) => {
        const name = itemTitle(it) || 'Untitled';
        const mark = kind === 'region' ? `<span class="key-num region" style="--pin:${esc(it.color || SWATCHES[3])}">${icon('polygon')}</span>`
          : nums ? `<span class="key-num" style="--pin:${esc(it.color || '#c4553b')}">${nums.get(it.id)}</span>`
            : `<span class="key-num" style="--pin:${esc(it.color || '#c4553b')}">${icon(it.icon || 'map-pin')}</span>`;
        return `<li data-item="${kind}:${it.id}">${grip(name)}<button type="button" data-key="${kind}:${it.id}">${mark}<span>${esc(name)}</span></button></li>`;
      }).join('')}</ol>`;
    };
    const rows = layers.reduce((n, l) => n + 1 + (listed && !folded.has(l) ? itemsOf(l).length : 0), 0);
    panel.classList.toggle('keyed', listed);
    panel.classList.toggle('arranging', arranging);
    panel.classList.toggle('two-col', listed && !arranging && rows > 16 && layers.length > 1); // arranging keeps one roomy column
    const count = (l) => all.filter((it) => (it.layer || '') === l).length;
    // A group holding a single region stands for that region (a district and the places in it).
    const regionOf = (l) => { const rs = regions.filter((r) => (r.layer || '') === l); return rs.length === 1 ? rs[0] : null; };
    panel.innerHTML = `<div class="map-panel-head"><span class="field-label">${arranging ? 'Arrange the key' : nums ? 'Key' : 'Layers'}</span><button class="icon-btn sm" data-close>${icon('x')}</button></div>
      ${layers.length ? `<div class="layer-groups">${layers.map((l) => `<div class="layer-group${folded.has(l) ? ' folded' : ''}" data-group="${esc(l)}">
        <div class="layer-line">${grip(layerName(l))}<label class="check layer-row">
          <input type="checkbox" data-layer="${esc(l)}" ${hidden.has(l) ? '' : 'checked'}>
          ${regionOf(l) ? `<button type="button" class="group-link" data-group-region="${regionOf(l).id}" title="Show ${esc(itemTitle(regionOf(l)) || layerName(l))} on the map"><span class="key-swatch" style="--rc:${esc(regionOf(l).color || SWATCHES[3])}"></span>${esc(layerName(l))}</button>`
            : `<span>${isTemplateLayer(l) ? icon(TYPES[l].icon) + ' ' : ''}${esc(layerName(l))}</span>`}<span class="count">${count(l)}</span>
        </label>${arranging && l ? `<button type="button" class="icon-btn sm" data-rename="${esc(l)}" title="Rename group">${icon('pencil-simple')}</button><button type="button" class="icon-btn sm" data-remove="${esc(l)}" title="Remove group (its places move to General)">${icon('trash')}</button>` : ''}
        ${listed && (count(l) || arranging) ? `<button type="button" class="icon-btn sm fold" data-fold="${esc(l)}" aria-expanded="${!folded.has(l)}" title="${folded.has(l) ? 'Show' : 'Hide'} this layer’s places">${icon('caret-down')}</button>` : ''}</div>${keyFor(l)}</div>`).join('')}</div>`
        : '<p class="muted small">No places yet. Assign pins and regions to layers in edit mode.</p>'}
      ${arranging ? `<button type="button" class="btn small quiet new-group" data-new-group>${icon('plus')} New group</button>` : ''}`;

    $$('[data-fold]', panel).forEach((b) => b.onclick = () => {
      const l = b.dataset.fold;
      if (folded.has(l)) folded.delete(l); else folded.add(l);
      try { localStorage.setItem('wa.map.folded.' + mid, JSON.stringify([...folded])); } catch { /* storage unavailable */ }
      renderLayers();
    });
    $$('[data-layer]', panel).forEach((cb) => cb.onchange = () => {
      if (cb.checked) hidden.delete(cb.dataset.layer); else hidden.add(cb.dataset.layer);
      saveHidden(mid, hidden);
      refresh();
      renderLayers();
    });
    $$('[data-group-region]', panel).forEach((b) => {
      const id = b.dataset.groupRegion;
      const mark = (on) => $(`#mapBox [data-region="${id}"]`)?.classList.toggle('lit', on);
      b.onmouseenter = () => mark(true);
      b.onmouseleave = () => mark(false);
      b.onfocus = () => mark(true);
      b.onblur = () => mark(false);
      b.onclick = (e) => {
        e.preventDefault(); // not the layer's checkbox
        const r = (cur().regions || []).find((x) => x.id === id);
        if (!r) return;
        if (hidden.has(r.layer || '')) { hidden.delete(r.layer || ''); saveHidden(mid, hidden); refresh(); renderLayers(); }
        ctl.focus(r.points);
        if (editing) regionDialog(r); else showInfo(r, 'region');
      };
    });
    $$('[data-key]', panel).forEach((b) => {
      const [kind, id] = b.dataset.key.split(':');
      const find = () => (kind === 'pin' ? cur().pins : cur().regions || []).find((x) => x.id === id);
      const mark = (on) => kind === 'pin' && $(`#mapBox [data-pin="${id}"]`)?.classList.toggle('lit', on);
      b.onmouseenter = () => mark(true);
      b.onmouseleave = () => mark(false);
      b.onfocus = () => mark(true);
      b.onblur = () => mark(false);
      b.onclick = () => {
        const it = find();
        if (!it) return;
        if (hidden.has(it.layer || '')) { hidden.delete(it.layer || ''); saveHidden(mid, hidden); refresh(); renderLayers(); }
        ctl.focus(kind === 'pin' ? it : it.points);
        if (arranging) (kind === 'pin' ? pinDialog : regionDialog)(it); else showInfo(it, kind);
      };
    });
    panel.querySelector('[data-close]').onclick = () => { panel.hidden = true; $('#layersBtn').classList.remove('on'); rememberLayers(false); };
    if (arranging) wireArrange(panel);
  }

  // ---- arranging the key
  const saveOrder = (order) => persist({ layerOrder: order });
  // Move a pin or region to layer `l`, before `beforeId` (another item of the same kind), or to the end of that layer.
  function moveItem(kind, id, l, beforeId) {
    const key = kind === 'pin' ? 'pins' : 'regions';
    const list = [...(cur()[key] || [])];
    const from = list.findIndex((x) => x.id === id);
    if (from < 0) return;
    const [it] = list.splice(from, 1);
    const moved = { ...it, layer: l };
    let at = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
    if (at < 0) { // after the last of that layer, else at the end
      const last = list.map((x) => x.layer || '').lastIndexOf(l);
      at = last < 0 ? list.length : last + 1;
    }
    list.splice(at, 0, moved);
    const order = layersOf(cur());
    return persist({ [key]: list, layerOrder: order.includes(l) ? order : [...order, l] });
  }
  function moveLayer(l, beforeL) {
    const order = layersOf(cur()).filter((x) => x !== l);
    const at = beforeL == null ? order.length : order.indexOf(beforeL);
    order.splice(at < 0 ? order.length : at, 0, l);
    return saveOrder(order);
  }
  function groupNameDialog(title, value, done) {
    modal(title, `<form class="form" id="gf"><label>Name<input name="name" required value="${esc(value)}" placeholder="e.g. Old Town"></label>
      <div class="actions"><button class="btn primary">Save</button></div></form>`, {
      onMount: (el, close) => {
        const f = $('#gf', el);
        f.name.select();
        f.onsubmit = (e) => {
          e.preventDefault();
          const name = f.name.value.trim();
          if (!name) return;
          if (layersOf(cur()).some((l) => l !== value && layerName(l).toLowerCase() === name.toLowerCase())) return toast('There’s already a group with that name');
          close();
          done(name);
        };
      },
    });
  }
  function wireArrange(panel) {
    $('[data-new-group]', panel).onclick = () => groupNameDialog('New group', '', (name) => saveOrder([...layersOf(cur()), name]));
    $$('[data-rename]', panel).forEach((b) => b.onclick = () => {
      const old = b.dataset.rename;
      groupNameDialog('Rename group', layerName(old), (name) => {
        // A region named like its group keeps the group's name.
        const re = (it) => ((it.layer || '') === old ? { ...it, layer: name, ...(it.points && (it.label || '').toLowerCase() === layerName(old).toLowerCase() ? { label: name } : {}) } : it);
        if (hidden.delete(old)) { hidden.add(name); saveHidden(mid, hidden); }
        persist({ pins: (cur().pins || []).map(re), regions: (cur().regions || []).map(re), layerOrder: layersOf(cur()).map((l) => (l === old ? name : l)) });
      });
    });
    $$('[data-remove]', panel).forEach((b) => b.onclick = async () => {
      const l = b.dataset.remove;
      const n = [...(cur().pins || []), ...(cur().regions || [])].filter((it) => (it.layer || '') === l).length;
      if (n && !(await confirmDialog(`Remove the group “${layerName(l)}”? Its ${n} place${n === 1 ? '' : 's'} move to General.`, 'Remove group'))) return;
      const re = (it) => ((it.layer || '') === l ? { ...it, layer: '' } : it);
      persist({ pins: (cur().pins || []).map(re), regions: (cur().regions || []).map(re), layerOrder: layersOf(cur()).filter((x) => x !== l) });
    });

    // Drag by the grip (mouse, touch or pen); arrow keys on a focused grip move one step.
    $$('[data-grip]', panel).forEach((g) => {
      const row = g.closest('[data-item], [data-group]');
      const isLayer = !row.dataset.item;
      g.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const up = e.key === 'ArrowUp';
        const refocus = (sel) => requestAnimationFrame(() => $(`${sel} [data-grip]`, $('#layersPanel'))?.focus());
        if (isLayer) {
          const order = layersOf(cur()), l = row.dataset.group, i = order.indexOf(l);
          const j = up ? i - 1 : i + 2;
          if ((up && i <= 0) || (!up && i >= order.length - 1)) return;
          moveLayer(l, order[j] ?? null).then(() => refocus(`[data-group="${CSS.escape(l)}"] > .layer-line`));
          return;
        }
        const [kind, id] = row.dataset.item.split(':');
        const sibs = $$(`[data-item^="${kind}:"]`, row.parentElement).map((x) => x.dataset.item.split(':')[1]);
        const i = sibs.indexOf(id), l = row.closest('[data-group]').dataset.group;
        const order = layersOf(cur()), li = order.indexOf(l);
        let target = l, before;
        if (up && i > 0) before = sibs[i - 1];
        else if (!up && i < sibs.length - 1) before = sibs[i + 2];
        else if (up && li > 0) target = order[li - 1]; // to the end of the layer above
        else if (!up && li < order.length - 1) { // to the start of the layer below
          target = order[li + 1];
          before = (cur()[kind === 'pin' ? 'pins' : 'regions'] || []).find((x) => (x.layer || '') === target)?.id;
        } else return;
        moveItem(kind, id, target, before).then(() => refocus(`[data-item="${kind}:${id}"]`));
      });
      const drag = (e, el) => {
        el.setPointerCapture(e.pointerId);
        row.classList.add('dragging');
        let drop = null;
        const clear = () => $$('.drop-before, .drop-after, .drop-into', panel).forEach((x) => x.classList.remove('drop-before', 'drop-after', 'drop-into'));
        const over = (ev) => {
          clear();
          drop = null;
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          if (!el || !panel.contains(el)) return;
          if (isLayer) {
            const grp = el.closest('[data-group]');
            if (!grp || grp === row) return;
            const r = grp.getBoundingClientRect();
            const after = ev.clientY > r.top + Math.min(r.height / 2, 24);
            grp.classList.add(after ? 'drop-after' : 'drop-before');
            drop = { group: grp.dataset.group, after };
            return;
          }
          const [kind] = row.dataset.item.split(':');
          const li = el.closest('[data-item]');
          if (li && li !== row && li.dataset.item.startsWith(kind + ':')) {
            const r = li.getBoundingClientRect();
            const after = ev.clientY > r.top + r.height / 2;
            li.classList.add(after ? 'drop-after' : 'drop-before');
            drop = { group: li.closest('[data-group]').dataset.group, ref: li, after };
            return;
          }
          const grp = el.closest('[data-group]');
          if (grp) { grp.classList.add('drop-into'); drop = { group: grp.dataset.group }; }
        };
        const move = (ev) => {
          // Near the panel's top or bottom edge, scroll it so the whole key can be reached.
          const r = panel.getBoundingClientRect();
          if (ev.clientY < r.top + 40) panel.scrollTop -= 12; else if (ev.clientY > r.bottom - 40) panel.scrollTop += 12;
          over(ev);
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          row.classList.remove('dragging');
          clear();
          if (!drop) return;
          if (isLayer) {
            const order = layersOf(cur()).filter((x) => x !== row.dataset.group);
            const next = drop.after ? order[order.indexOf(drop.group) + 1] ?? null : drop.group;
            moveLayer(row.dataset.group, next);
            return;
          }
          const [kind, id] = row.dataset.item.split(':');
          let before = null;
          if (drop.ref) {
            const sibs = $$(`[data-item^="${kind}:"]`, drop.ref.parentElement).map((x) => x.dataset.item.split(':')[1]).filter((x) => x !== id);
            const refId = drop.ref.dataset.item.split(':')[1];
            before = drop.after ? sibs[sibs.indexOf(refId) + 1] ?? null : refId;
          }
          moveItem(kind, id, drop.group, before);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up, { once: true });
        el.addEventListener('pointercancel', () => { el.removeEventListener('pointermove', move); row.classList.remove('dragging'); clear(); }, { once: true });
      };
      g.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        drag(e, g);
      });
      // With a mouse or pen, the name (or number) drags too, once it has moved a
      // few pixels; a plain click still opens it. On touch, swiping there scrolls
      // the panel, so the grip is the handle.
      const handle = isLayer ? row.querySelector(':scope > .layer-line .layer-row') : row.querySelector('[data-key]');
      if (!handle) return;
      let dragged = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || e.pointerType === 'touch' || e.target.closest('input')) return;
        const sx = e.clientX, sy = e.clientY;
        handle.setPointerCapture(e.pointerId);
        const pre = (ev) => {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
          stop();
          dragged = true;
          drag(ev, handle);
        };
        const stop = () => { handle.removeEventListener('pointermove', pre); handle.removeEventListener('pointerup', stop); };
        handle.addEventListener('pointermove', pre);
        handle.addEventListener('pointerup', stop);
      });
      // A drag isn't also a click (which would open the place or tick the layer).
      handle.addEventListener('click', (e) => { if (dragged) { dragged = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    });
  }

  renderLayers();

  // ---- places panel
  function renderPlaces() {
    const q = ($('#placesQ').value || '').trim().toLowerCase();
    const items = [
      ...(cur().pins || []).map((p) => ({ it: p, kind: 'pin' })),
      ...(cur().regions || []).map((r) => ({ it: r, kind: 'region' })),
    ].map((x) => ({ ...x, title: itemTitle(x.it) || 'Untitled' }))
      .filter((x) => !q || x.title.toLowerCase().includes(q) || (x.it.layer ? layerName(x.it.layer) : '').toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
    $('#placesList').innerHTML = items.length ? items.map((x, i) => `<li><button data-i="${i}">
        ${x.kind === 'region' ? icon('polygon') : icon(x.it.icon || 'map-pin')}
        <span>${esc(x.title)}</span>${x.it.layer ? `<small>${esc(layerName(x.it.layer))}</small>` : ''}</button></li>`).join('')
      : `<li class="muted small pad">${q ? 'No matches.' : 'No places on this map yet.'}</li>`;
    $$('#placesList [data-i]').forEach((b) => b.onclick = () => {
      const x = items[+b.dataset.i];
      if (hidden.has(x.it.layer || '')) { hidden.delete(x.it.layer || ''); saveHidden(mid, hidden); refresh(); renderLayers(); }
      ctl.focus(x.kind === 'region' ? x.it.points : x.it);
      showInfo(x.it, x.kind);
      if (matchMedia('(max-width: 700px)').matches) { $('#placesPanel').hidden = true; $('#placesBtn').classList.remove('on'); }
    });
  }
  $('#placesQ').oninput = renderPlaces;
  $('#placesPanel [data-close]').onclick = () => { $('#placesPanel').hidden = true; $('#placesBtn').classList.remove('on'); };
  renderPlaces();

  const togglePanel = (id, btnId, other, otherBtn) => {
    const p = $(id);
    p.hidden = !p.hidden;
    $(btnId).classList.toggle('on', !p.hidden);
    if (!p.hidden) { $(other).hidden = true; $(otherBtn).classList.remove('on'); }
    if (!p.hidden && id === '#placesPanel') $('#placesQ').focus();
    if (id === '#layersPanel') rememberLayers(!p.hidden);
  };
  // The Layers panel opens with the map unless it was closed last time.
  const rememberLayers = (open) => { try { localStorage.setItem('wa.map.layers', open ? 'open' : 'closed'); } catch { /* private mode */ } };
  let layersOpen = true;
  try { layersOpen = localStorage.getItem('wa.map.layers') !== 'closed'; } catch { /* default open */ }
  if (layersOpen) { $('#layersPanel').hidden = false; $('#layersBtn').classList.add('on'); }
  $('#layersBtn').onclick = () => togglePanel('#layersPanel', '#layersBtn', '#placesPanel', '#placesBtn');
  $('#placesBtn').onclick = () => togglePanel('#placesPanel', '#placesBtn', '#layersPanel', '#layersBtn');
  $('#settingsBtn').onclick = () => mapDialog(wid, cur());
  $$('[data-z]').forEach((b) => b.onclick = () => (b.dataset.z === 'fit' ? ctl.fit() : ctl.zoom(b.dataset.z === 'in' ? 1.5 : 1 / 1.5)));

  // ---- dialogs
  const mapOptions = (selected) => `<option value="">None</option>` + store.mapsOf(wid).filter((x) => x.id !== mid)
    .map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  // Layer picker: General, a template, or one of this map's own layers. Choosing
  // a template narrows the linked-article list to it.
  const layerField = (value) => {
    const own = layersOf(cur()).filter((l) => l && !isTemplateLayer(l));
    if (value && !isTemplateLayer(value) && !own.includes(value)) own.push(value);
    return `<label>Layer <small>its template's articles are suggested first</small><select name="layer">
        <option value="" ${value ? '' : 'selected'}>General</option>
        <optgroup label="Templates">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${value === k ? 'selected' : ''}>${esc(t.plural)}</option>`).join('')}</optgroup>
        ${own.length ? `<optgroup label="This map’s layers">${own.map((l) => `<option value="${esc(l)}" ${value === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</optgroup>` : ''}
        <option value="__new">New layer…</option>
      </select></label>
      <label class="new-layer" hidden>Layer name<input name="layerNew" placeholder="e.g. Trade routes"></label>`;
  };
  // Articles already placed on this map are greyed (still selectable).
  const onThisMap = () => new Set([...(cur().pins || []), ...(cur().regions || [])].map((it) => linkedArticle(wid, it)?.id).filter(Boolean));
  // Name: type to find an article and pick it, or keep your own name. A name
  // with no article behind it is still a link, offering to create the article.
  const nameField = (it, placeholder) => `<div class="link-field">
      <label for="placeName">Name <small>pick an article, or name a new place</small></label>
      <div class="link-box"><input id="placeName" name="label" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(it.label || store.article(it.articleId)?.title || '')}"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="placeSuggest">
      <input type="hidden" name="articleId" value="${esc(it.articleId || '')}">
      <ul class="link-suggest" id="placeSuggest" role="listbox" hidden></ul></div>
      <div class="link-status"></div>
    </div>`;
  const wireName = (el, f) => {
    const input = f.label, list = $('#placeSuggest', el), status = $('.link-status', el);
    let items = [], idx = -1;
    const showStatus = () => {
      const a = store.article(f.articleId.value);
      const text = input.value.trim();
      status.innerHTML = a ? `${icon('link-simple')} Linked to ${typeIcon(a.type)} <b>${esc(a.title)}</b>`
        : text ? `${icon('plus')} No article called “${esc(text)}” yet. The place will offer to create it.` : '';
      status.classList.toggle('new', !a && !!text);
    };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); idx = -1; };
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const fam = isTemplateLayer(f.layer.value) ? familyOf(f.layer.value) : null;
      const placed = onThisMap();
      const rank = (a) => (fam && !fam.includes(a.type) ? 2 : 0) + (a.title.toLowerCase().startsWith(q) ? 0 : 1);
      items = store.articlesOf(wid).filter((a) => !q || a.title.toLowerCase().includes(q))
        .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)).slice(0, 8);
      if (!items.length || (items.length === 1 && items[0].title.toLowerCase() === q && items[0].id === f.articleId.value)) return close();
      list.innerHTML = items.map((a, i) => `<li role="option" id="ps${i}" data-i="${i}" class="${i === idx ? 'on' : ''}${placed.has(a.id) ? ' dim' : ''}">${typeIcon(a.type)}<span>${esc(a.title)}</span><small>${placed.has(a.id) ? 'on this map' : esc(TYPES[a.type]?.label || '')}</small></li>`).join('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    const choose = (a) => {
      input.value = a.title;
      f.articleId.value = a.id;
      if (!f.layer.value) f.layer.value = a.type; // a General place moves to its template's layer
      close();
      showStatus();
    };
    input.addEventListener('input', () => {
      f.articleId.value = store.byTitle(wid, input.value.trim())?.id || '';
      idx = -1;
      draw();
      showStatus();
    });
    input.addEventListener('focus', draw);
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        draw();
        input.setAttribute('aria-activedescendant', `ps${idx}`);
      } else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); choose(items[idx]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li');
      if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
    });
    showStatus();
  };
  // What to store: no separate label when the name is just the article's title, so renames follow.
  const readName = (f) => {
    const text = f.label.value.trim();
    const a = store.article(f.articleId.value);
    return { articleId: a?.id || '', label: a && a.title === text ? '' : text };
  };
  const wireLayer = (el, f) => {
    f.layer.onchange = () => {
      $('.new-layer', el).hidden = f.layer.value !== '__new';
      if (f.layer.value === '__new') f.layerNew.focus();
    };
  };
  let lastLayer = ''; // new places start on the layer last used
  const readLayer = (f) => (lastLayer = f.layer.value === '__new' ? f.layerNew.value.trim() : f.layer.value);
  const colourField = (value) => `<div class="field-label">Colour</div>
    <div class="swatches">${SWATCHES.map((c) => `<button type="button" class="swatch ${c === value ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}
      <input type="color" name="color" value="${esc(value || SWATCHES[0])}" title="Custom colour"></div>`;
  const wireColour = (el, f) => {
    $$('.swatch', el).forEach((s) => s.onclick = () => {
      f.color.value = s.dataset.c;
      $$('.swatch', el).forEach((x) => x.classList.toggle('on', x === s));
    });
    f.color.oninput = () => $$('.swatch', el).forEach((x) => x.classList.remove('on'));
  };

  function pinDialog(pin, isNew = false) {
    modal(isNew ? 'Add a place' : 'Edit place', `
      <form class="form" id="pf">
        ${nameField(pin, 'e.g. Varenhold')}
        ${layerField(pin.layer || '')}
        <label>Opens map <small>e.g. a city map from a pin on the continent</small><select name="mapId">${mapOptions(pin.mapId)}</select></label>
        <div class="field-label">Marker</div>
        <div class="icon-picker">${PIN_ICONS.map((n) => `<button type="button" data-icon="${n}" class="${(pin.icon || 'map-pin') === n ? 'on' : ''}" title="${PIN_NAMES[n] || n.replace(/-/g, ' ')}" aria-label="${PIN_NAMES[n] || n.replace(/-/g, ' ')}">${icon(n)}</button>`).join('')}</div>
        ${colourField(pin.color)}
        <div class="actions">
          ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')}</button><button type="button" class="btn" data-move>Move</button><span class="spacer"></span>`}
          <button class="btn primary">${isNew ? 'Add place' : 'Save'}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        const f = $('#pf', el);
        wireLayer(el, f);
        wireName(el, f);
        let chosen = pin.icon || 'map-pin';
        $$('[data-icon]', el).forEach((b) => b.onclick = () => {
          chosen = b.dataset.icon;
          $$('[data-icon]', el).forEach((x) => x.classList.toggle('on', x === b));
        });
        wireColour(el, f);
        $('[data-del]', el)?.addEventListener('click', async () => {
          await persist({ pins: cur().pins.filter((p) => p.id !== pin.id) }); close();
        });
        $('[data-move]', el)?.addEventListener('click', () => { moving = pin.id; close(); renderEditBar(); });
        f.onsubmit = async (e) => {
          e.preventDefault();
          if (!f.articleId.value && !f.mapId.value && !f.label.value.trim()) return toast('Give the place a name, or link a map');
          const next = { ...pin, ...readName(f), mapId: f.mapId.value,
            layer: readLayer(f), icon: chosen, color: f.color.value };
          const pins = cur().pins || [];
          await persist({ pins: isNew ? [...pins, next] : pins.map((p) => (p.id === pin.id ? next : p)) });
          close();
        };
      },
    });
  }

  function regionDialog(reg, isNew = false) {
    modal(isNew ? 'New region' : 'Edit region', `
      <form class="form" id="rf">
        ${nameField(reg, 'e.g. The Ashen Wastes')}
        ${layerField(reg.layer || '')}
        <label>Opens map<select name="mapId">${mapOptions(reg.mapId)}</select></label>
        <div class="field-label">Style</div>
        <div class="seg region-fill">${Object.entries(REGION_FILLS).map(([k, l]) => `<button type="button" data-fill="${k}" class="${(reg.fill || 'solid') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${colourField(reg.color || SWATCHES[3])}
        <div class="actions">
          ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')} Delete</button><span class="spacer"></span>`}
          <button class="btn primary">${isNew ? 'Add region' : 'Save'}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        let fill = reg.fill || 'solid';
        $$('[data-fill]', el).forEach((b) => b.onclick = () => { fill = b.dataset.fill; $$('[data-fill]', el).forEach((x) => x.classList.toggle('on', x === b)); });
        const f = $('#rf', el);
        wireColour(el, f);
        wireLayer(el, f);
        wireName(el, f);
        $('[data-del]', el)?.addEventListener('click', async () => {
          await persist({ regions: (cur().regions || []).filter((r) => r.id !== reg.id) }); close();
        });
        f.onsubmit = async (e) => {
          e.preventDefault();
          const next = { ...reg, ...readName(f), mapId: f.mapId.value,
            layer: readLayer(f), color: f.color.value, fill };
          const regions = cur().regions || [];
          await persist({ regions: isNew ? [...regions, next] : regions.map((r) => (r.id === reg.id ? next : r)) });
          close();
        };
      },
    });
  }

  // ---- ?pin=<articleId> focus
  const focusId = q?.get('pin');
  if (focusId) {
    const pin = (m.pins || []).find((p) => linkedArticle(wid, p)?.id === focusId);
    const reg = !pin && (m.regions || []).find((r) => linkedArticle(wid, r)?.id === focusId);
    const target = pin || reg;
    if (target) {
      setTimeout(() => {
        if (hidden.has(target.layer || '')) { hidden.delete(target.layer || ''); saveHidden(mid, hidden); refresh(); renderLayers(); }
        ctl.focus(pin ? pin : reg.points);
        showInfo(target, pin ? 'pin' : 'region');
      }, 350);
    }
  }
}
