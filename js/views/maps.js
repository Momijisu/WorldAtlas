// Maps: a list of a world's maps, and the interactive map page with pins,
// regions, layers, nested maps and a "Places" finder.
import * as store from '../store.js';
import { posCSS } from '../focus.js';
import { mountMap } from '../mapview.js';
import { dropzoneEmpty, wireDropzone } from '../dropzone.js';
import { TYPES } from '../store.js';
import { familyOf } from '../templates.js';
import { plain } from '../markdown.js';
import { view, state, setTitle, pageHead, icon, hydrateImages, articleOptions, typeIcon, typeLabel, worldCrumb, sep } from '../ui.js';
import { $, $$, esc, uid, toast, modal, confirmDialog, prepareImage } from '../util.js';

export const PIN_ICONS = ['map-pin', 'castle-turret', 'house', 'tent', 'ruins', 'stairs', 'cave', 'mountains', 'tree-evergreen', 'anchor', 'skull', 'star',
  'crown', 'flag', 'sword', 'church', 'boat', 'flame', 'diamond', 'shield', 'compass'];
const PIN_NAMES = { stairs: 'dungeon' }; // hover names where the icon's own name isn't the place
const SWATCHES = ['#c4553b', '#c4a46a', '#5f8f6f', '#4f74a8', '#7d5a8c', '#3b3631', '#e9e1d1'];

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

const itemTitle = (it) => it.label || store.article(it.articleId)?.title || store.map(it.mapId)?.name || '';

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

function layersOf(m) {
  const names = new Set();
  for (const it of [...(m.pins || []), ...(m.regions || [])]) names.add(it.layer || '');
  return [...names].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
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
      <div class="actions">
        ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')} Delete map</button><span class="spacer"></span>`}
        <button class="btn primary">${isNew ? 'Create map' : 'Save'}</button>
      </div>
    </form>`, {
    onMount: (el, close) => {
      const f = $('#mf', el);
      wireDropzone($('.image-field', f));
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
  const refresh = () => ctl.setItems({ pins: labelled(cur().pins), regions: labelled(cur().regions), hidden });
  const persist = async (patch) => {
    await store.save('maps', { ...cur(), ...patch });
    refresh();
    renderLayers();
    renderPlaces();
  };

  // ---- info card
  async function showInfo(it, kind) {
    const a = store.article(it.articleId);
    const sub = store.map(it.mapId);
    info.hidden = false;
    info.innerHTML = `<button class="icon-btn sm close" aria-label="Close">${icon('x')}</button>
      ${a?.image ? `<img data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : ''}
      <div class="info-body">
        <div class="eyebrow">${a ? `${typeIcon(a.type)} ${typeLabel(a.type)}` : kind === 'region' ? `${icon('polygon')} Region` : `${icon(it.icon || 'map-pin')} Place`}${it.layer ? ` <span class="sep">/</span> ${esc(layerName(it.layer))}` : ''}</div>
        <div class="info-title">${esc(itemTitle(it))}</div>
        ${a?.summary ? `<p>${esc(plain(a.summary, 200))}</p>` : ''}
        <div class="info-actions">
          ${a ? `<a class="btn small" href="#/w/${wid}/a/${a.id}">${icon('book-open-text')} Read article</a>` : ''}
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
  }
  $('#editBtn').onclick = () => setEditing(!editing);

  // ---- layers panel
  function renderLayers() {
    const panel = $('#layersPanel');
    const all = [...(cur().pins || []), ...(cur().regions || [])];
    const layers = layersOf(cur());
    panel.innerHTML = `<div class="map-panel-head"><span class="field-label">Layers</span><button class="icon-btn sm" data-close>${icon('x')}</button></div>
      ${layers.length ? layers.map((l) => `<label class="check layer-row">
          <input type="checkbox" data-layer="${esc(l)}" ${hidden.has(l) ? '' : 'checked'}>
          <span>${isTemplateLayer(l) ? icon(TYPES[l].icon) + ' ' : ''}${esc(layerName(l))}</span><span class="count">${all.filter((it) => (it.layer || '') === l).length}</span>
        </label>`).join('') : '<p class="muted small">No places yet. Assign pins and regions to layers in edit mode.</p>'}`;
    $$('[data-layer]', panel).forEach((cb) => cb.onchange = () => {
      if (cb.checked) hidden.delete(cb.dataset.layer); else hidden.add(cb.dataset.layer);
      saveHidden(mid, hidden);
      refresh();
    });
    panel.querySelector('[data-close]').onclick = () => { panel.hidden = true; $('#layersBtn').classList.remove('on'); };
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
  };
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
    return `<label>Layer <small>also narrows the article list</small><select name="layer">
        <option value="" ${value ? '' : 'selected'}>General</option>
        <optgroup label="Templates">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${value === k ? 'selected' : ''}>${esc(t.plural)}</option>`).join('')}</optgroup>
        ${own.length ? `<optgroup label="This map’s layers">${own.map((l) => `<option value="${esc(l)}" ${value === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</optgroup>` : ''}
        <option value="__new">New layer…</option>
      </select></label>
      <label class="new-layer" hidden>Layer name<input name="layerNew" placeholder="e.g. Trade routes"></label>`;
  };
  // Articles already placed on this map are greyed (still selectable).
  const onThisMap = () => new Set([...(cur().pins || []), ...(cur().regions || [])].map((it) => it.articleId).filter(Boolean));
  const articleField = (layer, selected) => `<select name="articleId">${articleOptions(wid, selected, { only: isTemplateLayer(layer) ? familyOf(layer) : null, dim: onThisMap(), dimNote: 'on this map' })}</select>`;
  const wireLayer = (el, f) => {
    const refill = () => {
      const keep = f.articleId.value;
      f.articleId.outerHTML = articleField(f.layer.value, keep);
      f.articleId.onchange = follow;
    };
    // An article picked while the layer is General puts the place on that template's layer.
    const follow = () => {
      const a = store.article(f.articleId.value);
      if (a && !f.layer.value) { f.layer.value = a.type; refill(); }
    };
    f.layer.onchange = () => {
      $('.new-layer', el).hidden = f.layer.value !== '__new';
      if (f.layer.value === '__new') f.layerNew.focus();
      refill();
    };
    f.articleId.onchange = follow;
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
        ${layerField(pin.layer || '')}
        <label>Linked article${articleField(pin.layer, pin.articleId)}</label>
        <label>Opens map <small>e.g. a city map from a pin on the continent</small><select name="mapId">${mapOptions(pin.mapId)}</select></label>
        <label>Label <small>defaults to the article</small><input name="label" value="${esc(pin.label || '')}"></label>
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
          if (!f.articleId.value && !f.mapId.value && !f.label.value.trim()) return toast('Add a label or link an article or map');
          const next = { ...pin, articleId: f.articleId.value, mapId: f.mapId.value, label: f.label.value.trim(),
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
        <label>Label<input name="label" value="${esc(reg.label || '')}" placeholder="e.g. The Ashen Wastes"></label>
        ${layerField(reg.layer || '')}
        <label>Linked article${articleField(reg.layer, reg.articleId)}</label>
        <label>Opens map<select name="mapId">${mapOptions(reg.mapId)}</select></label>
        ${colourField(reg.color || SWATCHES[1])}
        <div class="actions">
          ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')} Delete</button><span class="spacer"></span>`}
          <button class="btn primary">${isNew ? 'Add region' : 'Save'}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        const f = $('#rf', el);
        wireColour(el, f);
        wireLayer(el, f);
        $('[data-del]', el)?.addEventListener('click', async () => {
          await persist({ regions: (cur().regions || []).filter((r) => r.id !== reg.id) }); close();
        });
        f.onsubmit = async (e) => {
          e.preventDefault();
          const next = { ...reg, label: f.label.value.trim(), articleId: f.articleId.value, mapId: f.mapId.value,
            layer: readLayer(f), color: f.color.value };
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
    const pin = (m.pins || []).find((p) => p.articleId === focusId);
    const reg = !pin && (m.regions || []).find((r) => r.articleId === focusId);
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
