import * as store from './store.js';
import * as auth from './auth.js';
import * as sync from './sync.js';
import { TYPES } from './store.js';
import { render, renderInline, plain } from './markdown.js';
import { mountMap } from './mapview.js';
import { exampleWorld } from './example.js';
import {
  $, $$, esc, uid, toast, modal, confirmDialog, prepareImage, timeAgo,
  blobToDataURL, dataURLToBlob, download,
} from './util.js';

const view = $('#view');
const sidebar = $('#sidebar');
const state = { guard: null, mapCtl: null, installPrompt: null, hash: location.hash, ignoreHash: false, wid: null };

// ---------------------------------------------------------------- boot

async function boot() {
  applyTheme();
  let authError = null, returned = null;
  try { returned = await auth.handleRedirect(); } catch (e) { authError = e; }
  if (!returned && !authError && await auth.renewSessionIfNeeded()) return;
  await store.load();
  wireChrome();
  store.onChange((e) => {
    if (e.local) return;
    if (state.guard) toast('Changes arrived from another device');
    else route();
  });
  sync.onStatus(renderSyncBadge);
  sync.start();
  route();
  if (authError) toast('Sign-in failed: ' + authError.message, 7000);
  else if (returned && !returned.silent) toast('Connected to OneDrive — syncing…');
  registerSW();
  navigator.storage?.persist?.();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });

function applyTheme() {
  document.documentElement.dataset.theme = localStorage.getItem('wa.theme') || 'dark';
}

function wireChrome() {
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#searchForm').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    const wid = state.wid || store.worlds()[0]?.id;
    if (!wid) return toast('Create a world first');
    location.hash = `#/w/${wid}/search?q=${encodeURIComponent(q)}`;
    $('#searchInput').blur();
  };
  $('#newBtn').onclick = () => newArticleDialog(state.wid);
  $('#syncBtn').onclick = () => {
    const st = sync.getStatus().state;
    if (st === 'off' || st === 'reauth' || st === 'error') location.hash = '#/settings';
    else sync.sync();
  };
  addEventListener('hashchange', onHash);
  addEventListener('beforeunload', (e) => { if (state.guard) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#searchInput').focus(); }
  });
}

function renderSyncBadge({ state: st, message }) {
  const btn = $('#syncBtn');
  const labels = {
    off: ['☁', 'Local only'], syncing: ['⟳', 'Syncing…'], synced: ['✓', 'Synced'], pending: ['•', 'Unsynced'],
    offline: ['⦸', 'Offline'], error: ['⚠', 'Sync error'], reauth: ['⚠', 'Reconnect'],
  };
  const [icon, text] = labels[st];
  btn.className = 'sync-badge ' + st;
  btn.innerHTML = `<span class="sync-icon">${icon}</span><span class="sync-text">${text}</span>`;
  btn.title = message || (st === 'synced' ? 'Synced with OneDrive ' + timeAgo(store.meta.lastSync) : text);
  if ($('#oneDriveCard')) renderOneDriveCard();
}

// ---------------------------------------------------------------- routing

function onHash() {
  if (state.ignoreHash) { state.ignoreHash = false; return; }
  if (state.guard && !state.guard()) { state.ignoreHash = true; location.hash = state.hash; return; }
  state.guard = null;
  route();
}

function route() {
  state.hash = location.hash;
  state.mapCtl?.destroy();
  state.mapCtl = null;
  document.body.classList.remove('nav-open');
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const p = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(qs || '');

  if (p[0] === 'settings') return show(null, viewSettings);
  if (p[0] !== 'w' || !p[1]) return show(null, viewWorlds);
  const wid = p[1];
  if (!store.world(wid)) { toast('That world no longer exists'); return show(null, viewWorlds); }
  localStorage.setItem('wa.lastWorld', wid);
  const [sec, id, sub] = p.slice(2);
  if (!sec) return show(wid, () => viewWorld(wid));
  if (sec === 't') return show(wid, () => viewList(wid, { type: id }));
  if (sec === 'tag') return show(wid, () => viewList(wid, { tag: id }));
  if (sec === 'search') return show(wid, () => viewSearch(wid, q.get('q') || ''));
  if (sec === 'timeline') return show(wid, () => viewTimeline(wid));
  if (sec === 'maps') return show(wid, () => viewMaps(wid));
  if (sec === 'm' && store.map(id)) return show(wid, () => viewMap(wid, id));
  if (sec === 'new') {
    const type = TYPES[id] ? id : 'article';
    const a = store.newArticle(wid, type, { title: q.get('title') || '', parentId: q.get('parent') || null });
    return show(wid, () => viewEditor(wid, a, true));
  }
  if (sec === 'a' && store.article(id)) {
    if (sub === 'edit') return show(wid, () => viewEditor(wid, structuredClone(store.article(id)), false));
    return show(wid, () => viewArticle(wid, id));
  }
  toast('Not found');
  show(wid, () => viewWorld(wid));
}

function show(wid, fn) {
  state.wid = wid;
  document.body.classList.toggle('in-world', !!wid);
  renderSidebar(wid);
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  fn();
  markActiveNav();
}

function setTitle(t) { document.title = t ? `${t} · WorldAtlas` : 'WorldAtlas'; }

function markActiveNav() {
  const h = location.hash || '#/';
  $$('#sidebar a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === h.split('?')[0]));
}

// Fill <img data-img> / [data-bg] elements from the local image store.
async function hydrateImages(root = view) {
  for (const el of $$('[data-img]', root)) {
    const url = await store.imageURL(el.dataset.img);
    if (url) el.src = url; else el.remove();
  }
  for (const el of $$('[data-bg]', root)) {
    const url = await store.imageURL(el.dataset.bg);
    if (url) { el.style.backgroundImage = `url("${url}")`; el.classList.add('has-img'); }
  }
}

// ---------------------------------------------------------------- sidebar

function renderSidebar(wid) {
  if (!wid) {
    sidebar.innerHTML = `<nav>
      <a href="#/">🌍 All worlds</a>
      ${store.worlds().map((w) => `<a href="#/w/${w.id}">${esc(w.name)}</a>`).join('')}
      <div class="nav-sep"></div>
      <a href="#/settings">⚙️ Settings &amp; sync</a></nav>`;
    return;
  }
  const w = store.world(wid);
  const arts = store.articlesOf(wid);
  const counts = {};
  for (const a of arts) counts[a.type] = (counts[a.type] || 0) + 1;
  sidebar.innerHTML = `<nav>
    <a href="#/" class="back">← All worlds</a>
    <a href="#/w/${wid}" class="world-name">${esc(w.name)}</a>
    <a href="#/w/${wid}/t/all">📚 All articles <span class="count">${arts.length}</span></a>
    <a href="#/w/${wid}/timeline">⏳ Timeline</a>
    <a href="#/w/${wid}/maps">🗺️ Maps <span class="count">${store.mapsOf(wid).length || ''}</span></a>
    <div class="nav-title">Categories</div>
    ${Object.entries(TYPES).map(([k, t]) => `<a href="#/w/${wid}/t/${k}" class="${counts[k] ? '' : 'empty'}">${t.icon} ${t.plural} <span class="count">${counts[k] || ''}</span></a>`).join('')}
    <div class="nav-sep"></div>
    <a href="#/settings">⚙️ Settings &amp; sync</a>
  </nav>`;
}

// ---------------------------------------------------------------- worlds

function viewWorlds() {
  setTitle('');
  const ws = store.worlds();
  const signedOut = sync.getStatus().state === 'off';
  view.innerHTML = `<section class="page">
    <div class="page-head"><h1>Your worlds</h1>
      <div class="actions"><button class="btn primary" id="newWorld">+ New world</button></div></div>
    ${ws.length ? `<div class="cards">${ws.map((w) => `
      <a class="card world-card" href="#/w/${w.id}">
        <div class="card-cover" ${w.image ? `data-bg="${w.image}"` : ''}><span>${esc(w.name[0] || '?')}</span></div>
        <div class="card-body"><h3>${esc(w.name)}</h3>
          <p>${esc(plain(w.description, 140))}</p>
          <small>${store.articlesOf(w.id).length} articles · ${store.mapsOf(w.id).length} maps</small></div>
      </a>`).join('')}</div>` : `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <h2>Build your first world</h2>
        <p>Write characters, places, factions and history, link them together with <code>[[wiki links]]</code>, pin them on maps and lay them out on a timeline.</p>
        <div class="actions center">
          <button class="btn primary" id="newWorld2">Create a world</button>
          <button class="btn" id="example">Load an example world</button>
          ${signedOut ? `<a class="btn" href="#/settings">Connect OneDrive</a>` : ''}
        </div>
        ${signedOut ? `<p class="muted small">Already using WorldAtlas on another device? Connect OneDrive and your worlds will download here.</p>` : ''}
      </div>`}
  </section>`;
  $('#newWorld').onclick = () => worldDialog();
  $('#newWorld2')?.addEventListener('click', () => worldDialog());
  $('#example')?.addEventListener('click', async () => {
    const id = await exampleWorld(store);
    location.hash = `#/w/${id}`;
  });
  hydrateImages();
}

async function worldDialog(w) {
  const isNew = !w;
  w = w ? { ...w } : { id: uid(), name: '', description: '', era: '', image: null };
  await modal(isNew ? 'New world' : 'World settings', `
    <form class="form" id="wf">
      <label>Name<input name="name" required value="${esc(w.name)}"></label>
      <label>Description <small>Markdown and [[links]] supported</small><textarea name="description" rows="5">${esc(w.description)}</textarea></label>
      <label>Calendar era suffix <small>shown after years on the timeline, e.g. “AE”</small><input name="era" value="${esc(w.era || '')}"></label>
      <div class="image-field">
        <img class="thumb" ${w.image ? `data-img="${w.image}"` : 'hidden'}>
        <label class="btn small">Cover image<input type="file" accept="image/*" hidden name="file"></label>
        <button type="button" class="btn small ghost" data-rm ${w.image ? '' : 'hidden'}>Remove</button>
      </div>
      <div class="actions">
        ${isNew ? '' : '<button type="button" class="btn danger ghost" data-del>Delete world</button><span class="spacer"></span>'}
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button class="btn primary">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </form>`, {
    onMount: (m, close) => {
      hydrateImages(m);
      const f = $('#wf', m);
      const thumb = $('.thumb', m);
      $('[data-cancel]', m).onclick = () => close();
      f.file.onchange = async () => {
        const file = f.file.files[0];
        if (!file) return;
        w.image = await store.addImage(await prepareImage(file, 2000));
        thumb.src = await store.imageURL(w.image); thumb.hidden = false; $('[data-rm]', m).hidden = false;
      };
      $('[data-rm]', m).onclick = (e) => { w.image = null; thumb.hidden = true; e.target.hidden = true; };
      $('[data-del]', m)?.addEventListener('click', async () => {
        if (!(await confirmDialog(`Delete “${w.name}” and all of its articles and maps? This also removes it from OneDrive on your other devices.`))) return;
        await store.deleteWorld(w.id);
        close();
        location.hash = '#/';
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        Object.assign(w, { name: f.name.value.trim(), description: f.description.value, era: f.era.value.trim() });
        await store.save('worlds', w);
        close();
        if (isNew) location.hash = `#/w/${w.id}`; else route();
      };
    },
  });
}

function viewWorld(wid) {
  const w = store.world(wid);
  setTitle(w.name);
  const arts = store.articlesOf(wid);
  const counts = {};
  for (const a of arts) counts[a.type] = (counts[a.type] || 0) + 1;
  const recent = [...arts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  view.innerHTML = `<section class="page">
    <div class="hero" ${w.image ? `data-bg="${w.image}"` : ''}>
      <div class="hero-inner"><h1>${esc(w.name)}</h1>
      <button class="btn small" id="editWorld">⚙ World settings</button></div>
    </div>
    ${w.description ? `<div class="prose world-desc">${render(w.description, wid)}</div>` : ''}
    <div class="tiles">
      ${Object.entries(TYPES).map(([k, t]) => `
        <a class="tile" href="#/w/${wid}/t/${k}"><span class="tile-icon">${t.icon}</span><span class="tile-label">${t.plural}</span><span class="tile-count">${counts[k] || 0}</span></a>`).join('')}
      <a class="tile" href="#/w/${wid}/timeline"><span class="tile-icon">⏳</span><span class="tile-label">Timeline</span><span class="tile-count">${arts.filter((a) => a.start != null).length}</span></a>
      <a class="tile" href="#/w/${wid}/maps"><span class="tile-icon">🗺️</span><span class="tile-label">Maps</span><span class="tile-count">${store.mapsOf(wid).length}</span></a>
    </div>
    <div class="section-head"><h2>Recently edited</h2><button class="btn small primary" id="newArt">+ New article</button></div>
    ${recent.length ? articleRows(recent, wid) : `<p class="muted">No articles yet. Create one with <b>+ New article</b> — characters, locations, organizations and more.</p>`}
  </section>`;
  $('#editWorld').onclick = () => worldDialog(w);
  $('#newArt').onclick = () => newArticleDialog(wid);
  hydrateImages();
}

function articleRows(list, wid) {
  return `<ul class="rows">${list.map((a) => `
    <li><a href="#/w/${wid}/a/${a.id}" class="row-link">
      ${a.image ? `<img class="row-thumb" data-img="${a.image}" alt="">` : `<span class="row-thumb icon">${TYPES[a.type]?.icon || '📄'}</span>`}
      <span class="row-text"><span class="row-title">${esc(a.title)}</span>
      <span class="row-sub">${TYPES[a.type]?.label || 'Article'}${a.summary ? ' · ' + esc(plain(a.summary, 120)) : ''}</span></span>
    </a></li>`).join('')}</ul>`;
}

function newArticleDialog(wid, extra = '') {
  wid ||= localStorage.getItem('wa.lastWorld');
  if (!store.world(wid)) wid = store.worlds()[0]?.id;
  if (!wid) { toast('Create a world first'); return worldDialog(); }
  modal('New article', `<div class="type-grid">${Object.entries(TYPES).map(([k, t]) =>
    `<a class="type-choice" href="#/w/${wid}/new/${k}${extra}" data-go><span>${t.icon}</span>${t.label}</a>`).join('')}</div>`,
  { onMount: (m, close) => $$('[data-go]', m).forEach((a) => a.addEventListener('click', () => close())) });
}

// ---------------------------------------------------------------- lists & search

function viewList(wid, { type, tag }) {
  const all = store.articlesOf(wid);
  let list, title, newType = 'article';
  if (tag) { list = all.filter((a) => (a.tags || []).includes(tag)); title = '#' + tag; }
  else if (type && type !== 'all' && TYPES[type]) { list = all.filter((a) => a.type === type); title = `${TYPES[type].icon} ${TYPES[type].plural}`; newType = type; }
  else { list = all; title = '📚 All articles'; }
  setTitle(title);
  const sortKey = localStorage.getItem('wa.sort') || 'title';
  view.innerHTML = `<section class="page">
    <div class="page-head"><h1>${esc(title)}</h1>
      <div class="actions"><a class="btn primary" href="#/w/${wid}/new/${newType}">+ New ${TYPES[newType].label.toLowerCase()}</a></div></div>
    <div class="toolbar">
      <input type="search" id="filter" placeholder="Filter ${list.length} articles…">
      <select id="sort"><option value="title">A–Z</option><option value="updated">Recently edited</option><option value="created">Newest</option></select>
    </div>
    <div id="listOut"></div>
    ${!tag && store.allTags(wid).length ? `<div class="section-head"><h2>Tags</h2></div><div class="tags">${store.allTags(wid).map(([t, n]) => `<a class="tag" href="#/w/${wid}/tag/${encodeURIComponent(t)}">#${esc(t)} <small>${n}</small></a>`).join('')}</div>` : ''}
  </section>`;
  const sortSel = $('#sort');
  sortSel.value = sortKey;
  const draw = () => {
    const f = $('#filter').value.trim().toLowerCase();
    const sorters = {
      title: (a, b) => a.title.localeCompare(b.title),
      updated: (a, b) => b.updatedAt - a.updatedAt,
      created: (a, b) => b.createdAt - a.createdAt,
    };
    const shown = list.filter((a) => !f || a.title.toLowerCase().includes(f) || (a.summary || '').toLowerCase().includes(f)).sort(sorters[sortSel.value]);
    $('#listOut').innerHTML = shown.length ? articleRows(shown, wid) : `<p class="muted">Nothing here yet.</p>`;
    hydrateImages($('#listOut'));
  };
  $('#filter').oninput = draw;
  sortSel.onchange = () => { localStorage.setItem('wa.sort', sortSel.value); draw(); };
  draw();
}

function viewSearch(wid, q) {
  setTitle('Search');
  $('#searchInput').value = q;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const a of store.articlesOf(wid)) {
    const title = a.title.toLowerCase();
    const text = (store.articleText(a) + ' ' + (a.tags || []).join(' ')).toLowerCase();
    if (!terms.every((t) => title.includes(t) || text.includes(t))) continue;
    scored.push([a, terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0) + (title.startsWith(t) ? 5 : 0), 0)]);
  }
  scored.sort((x, y) => y[1] - x[1] || x[0].title.localeCompare(y[0].title));
  view.innerHTML = `<section class="page">
    <div class="page-head"><h1>Search</h1></div>
    <form class="toolbar" id="sf"><input type="search" name="q" value="${esc(q)}" placeholder="Search this world…"><button class="btn">Search</button></form>
    <p class="muted">${q ? `${scored.length} result${scored.length === 1 ? '' : 's'} for “${esc(q)}”` : 'Type to search titles, text, fields and tags.'}</p>
    ${articleRows(scored.map((s) => s[0]), wid)}
    ${q && !store.byTitle(wid, q) ? `<p><a class="btn" href="#/w/${wid}/new/article?title=${encodeURIComponent(q)}">+ Create “${esc(q)}”</a></p>` : ''}
  </section>`;
  $('#sf').onsubmit = (e) => { e.preventDefault(); location.hash = `#/w/${wid}/search?q=${encodeURIComponent(e.target.q.value.trim())}`; };
  hydrateImages();
}

// ---------------------------------------------------------------- article

function formatYear(y, w) {
  if (y == null || y === '') return '';
  return `${y}${w.era ? ' ' + esc(w.era) : ''}`;
}

function dateText(a, w) {
  if (a.dateLabel) return esc(a.dateLabel);
  if (a.start == null) return '';
  return formatYear(a.start, w) + (a.end != null && a.end !== a.start ? ` – ${formatYear(a.end, w)}` : '');
}

function viewArticle(wid, id) {
  const w = store.world(wid);
  const a = store.article(id);
  setTitle(a.title);
  const t = TYPES[a.type] || TYPES.article;
  const crumbs = store.ancestors(a);
  const children = store.articlesOf(wid).filter((c) => c.parentId === a.id).sort((x, y) => x.title.localeCompare(y.title));
  const back = store.backlinks(a).sort((x, y) => x.title.localeCompare(y.title));
  const onMaps = store.mapsOf(wid).filter((m) => (m.pins || []).some((p) => p.articleId === a.id));
  const fields = Object.entries(a.fields || {}).filter(([k, v]) => k && String(v).trim());
  const date = dateText(a, w);
  view.innerHTML = `<article class="page article">
    <nav class="crumbs"><a href="#/w/${wid}">${esc(w.name)}</a>${crumbs.map((c) => ` › <a href="#/w/${wid}/a/${c.id}">${esc(c.title)}</a>`).join('')}</nav>
    <div class="page-head">
      <h1><span class="type-icon" title="${t.label}">${t.icon}</span> ${esc(a.title)}</h1>
      <div class="actions">
        <button class="btn ghost" id="addChild" title="Create an article nested under this one">+ Sub-article</button>
        <a class="btn primary" href="#/w/${wid}/a/${a.id}/edit">✎ Edit</a>
      </div>
    </div>
    <div class="article-grid">
      <div class="article-main">
        ${a.summary ? `<p class="lead">${renderInline(a.summary, wid)}</p>` : ''}
        ${a.body ? `<div class="prose">${render(a.body, wid)}</div>` : `<p class="muted">This article is empty. <a href="#/w/${wid}/a/${a.id}/edit">Start writing</a>.</p>`}
        ${a.gmNotes ? `<details class="secret"><summary>🔒 GM notes &amp; secrets</summary><div class="prose">${render(a.gmNotes, wid)}</div></details>` : ''}
        ${children.length ? `<div class="section-head"><h2>Contains</h2></div>${articleRows(children, wid)}` : ''}
        ${back.length ? `<div class="section-head"><h2>Mentioned in</h2></div>${articleRows(back, wid)}` : ''}
      </div>
      <aside class="infobox">
        ${a.image ? `<img class="infobox-img" data-img="${a.image}" alt="">` : ''}
        <div class="infobox-title">${esc(a.title)}</div>
        <div class="infobox-type"><a href="#/w/${wid}/t/${a.type}">${t.icon} ${t.label}</a></div>
        ${fields.length || date ? `<dl>
          ${date ? `<dt>Date</dt><dd>${date}</dd>` : ''}
          ${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${renderInline(v, wid)}</dd>`).join('')}
        </dl>` : ''}
        ${crumbs.length ? `<dl><dt>Part of</dt><dd><a href="#/w/${wid}/a/${crumbs.at(-1).id}">${esc(crumbs.at(-1).title)}</a></dd></dl>` : ''}
        ${onMaps.length ? `<dl><dt>On maps</dt><dd>${onMaps.map((m) => `<a href="#/w/${wid}/m/${m.id}?pin=${a.id}">${esc(m.name)}</a>`).join(', ')}</dd></dl>` : ''}
        ${(a.tags || []).length ? `<div class="tags">${a.tags.map((tg) => `<a class="tag" href="#/w/${wid}/tag/${encodeURIComponent(tg)}">#${esc(tg)}</a>`).join('')}</div>` : ''}
        <div class="muted small">Edited ${timeAgo(a.updatedAt)}</div>
      </aside>
    </div>
  </article>`;
  $('#addChild').onclick = () => newArticleDialog(wid, `?parent=${a.id}`);
  hydrateImages();
}

// ---------------------------------------------------------------- editor

function viewEditor(wid, a, isNew) {
  const w = store.world(wid);
  const oldTitle = a.title;
  a.fields ||= {};
  a.tags ||= [];
  let dirty = isNew && !!a.title;
  state.guard = () => !dirty || confirm('Discard unsaved changes?');
  setTitle(isNew ? 'New article' : 'Edit ' + a.title);
  const excluded = isNew ? new Set() : new Set([a.id, ...store.descendantIds(a)]);
  const parents = store.articlesOf(wid).filter((o) => !excluded.has(o.id)).sort((x, y) => x.title.localeCompare(y.title));
  const cancelHref = isNew ? (a.parentId ? `#/w/${wid}/a/${a.parentId}` : `#/w/${wid}`) : `#/w/${wid}/a/${a.id}`;

  view.innerHTML = `<form class="page editor" id="ed" autocomplete="off">
    <div class="page-head sticky"><h1>${isNew ? 'New' : 'Edit'} ${esc((TYPES[a.type] || TYPES.article).label.toLowerCase())}</h1>
      <div class="actions">
        ${isNew ? '' : '<button type="button" class="btn danger ghost" id="del">Delete</button>'}
        <a class="btn" href="${cancelHref}">Cancel</a>
        <button class="btn primary">Save</button>
      </div></div>
    <div class="editor-grid">
      <div class="editor-main">
        <label>Title<input name="title" required value="${esc(a.title)}" placeholder="e.g. Queen Ysolde"></label>
        <div class="row">
          <label>Template<select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}</select></label>
          <label>Parent article<select name="parentId"><option value="">— none —</option>${parents.map((p) => `<option value="${p.id}" ${p.id === a.parentId ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
        </div>
        <label>Summary <small>one or two lines, shown in lists and link tooltips</small><textarea name="summary" rows="2" class="ac-target">${esc(a.summary)}</textarea></label>
        <div class="field-label">Content <small>Markdown · type <code>[[</code> to link another article</small></div>
        <div class="md-toolbar">
          <button type="button" data-md="bold" title="Bold"><b>B</b></button>
          <button type="button" data-md="italic" title="Italic"><i>I</i></button>
          <button type="button" data-md="h2" title="Heading">H2</button>
          <button type="button" data-md="h3" title="Subheading">H3</button>
          <button type="button" data-md="ul" title="Bullet list">•</button>
          <button type="button" data-md="quote" title="Quote">❝</button>
          <button type="button" data-md="link" title="Link to article">[[ ]]</button>
          <button type="button" data-md="hr" title="Divider">―</button>
          <span class="spacer"></span>
          <button type="button" id="previewBtn">Preview</button>
        </div>
        <textarea name="body" rows="18" class="md ac-target" placeholder="Write freely. **bold**, *italic*, ## headings, - lists, and [[Other Article]] links.">${esc(a.body)}</textarea>
        <div class="prose md-preview" hidden></div>
        <details class="secret-edit" ${a.gmNotes ? 'open' : ''}><summary>🔒 GM notes &amp; secrets <small>(collapsed when reading)</small></summary>
          <textarea name="gmNotes" rows="5" class="ac-target">${esc(a.gmNotes)}</textarea></details>
      </div>
      <aside class="editor-side">
        <div class="panel">
          <div class="field-label">Image</div>
          <div class="image-field">
            <img class="thumb" ${a.image ? `data-img="${a.image}"` : 'hidden'} alt="">
            <label class="btn small">Upload<input type="file" accept="image/*" hidden id="imgFile"></label>
            <button type="button" class="btn small ghost" id="imgRm" ${a.image ? '' : 'hidden'}>Remove</button>
          </div>
        </div>
        <div class="panel">
          <label>Tags <small>comma separated</small><input name="tags" value="${esc(a.tags.join(', '))}" placeholder="noble, ancient, war"></label>
        </div>
        <div class="panel">
          <div class="field-label">Infobox</div>
          <div id="fields"></div>
          <button type="button" class="btn small" id="addField">+ Add field</button>
        </div>
        <div class="panel">
          <div class="field-label">Timeline</div>
          <div class="row">
            <label>Year<input name="start" type="number" step="any" value="${a.start ?? ''}" placeholder="e.g. 1042"></label>
            <label>End year<input name="end" type="number" step="any" value="${a.end ?? ''}"></label>
          </div>
          <label>Date text <small>optional, e.g. “Spring, 1042 ${esc(w.era || 'AE')}”</small><input name="dateLabel" value="${esc(a.dateLabel)}"></label>
        </div>
      </aside>
    </div>
  </form>`;

  const f = $('#ed');
  hydrateImages();
  f.addEventListener('input', () => { dirty = true; });
  f.addEventListener('change', () => { dirty = true; });

  // Infobox fields
  const fieldsEl = $('#fields');
  const addRow = (k = '', v = '') => {
    const row = document.createElement('div');
    row.className = 'kv';
    row.innerHTML = `<input class="k" placeholder="Field" value="${esc(k)}"><input class="v" placeholder="Value" value="${esc(v)}"><button type="button" class="icon-btn" title="Remove">✕</button>`;
    row.querySelector('button').onclick = () => { row.remove(); dirty = true; };
    fieldsEl.appendChild(row);
    return row;
  };
  Object.entries(a.fields).forEach(([k, v]) => addRow(k, v));
  $('#addField').onclick = () => addRow().querySelector('.k').focus();
  f.type.onchange = () => {
    const have = new Set($$('.kv .k', fieldsEl).map((i) => i.value.trim()));
    for (const k of TYPES[f.type.value].fields) if (!have.has(k)) addRow(k, '');
  };

  // Image
  const thumb = $('.image-field .thumb', f);
  $('#imgFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    a.image = await store.addImage(await prepareImage(file));
    thumb.src = await store.imageURL(a.image); thumb.hidden = false; $('#imgRm').hidden = false; dirty = true;
  };
  $('#imgRm').onclick = () => { a.image = null; thumb.hidden = true; $('#imgRm').hidden = true; dirty = true; };

  // Markdown helpers
  const body = f.body;
  $$('[data-md]').forEach((b) => b.onclick = () => mdCommand(body, b.dataset.md));
  $('#previewBtn').onclick = (e) => {
    const pv = $('.md-preview', f);
    const on = pv.hidden;
    pv.hidden = !on; body.hidden = on;
    e.target.textContent = on ? 'Write' : 'Preview';
    e.target.classList.toggle('on', on);
    if (on) pv.innerHTML = render(body.value, wid);
  };
  $$('.ac-target', f).forEach((ta) => attachAutocomplete(ta, wid));

  $('#del')?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete “${a.title}”? Links to it will show as missing.`))) return;
    await store.deleteArticle(a.id);
    state.guard = null;
    location.hash = `#/w/${wid}`;
  });

  f.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); f.requestSubmit(); } });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const title = f.title.value.trim().replace(/[\[\]|]/g, '');
    if (!title) return toast('Give it a title');
    const clash = store.byTitle(wid, title);
    if (clash && clash.id !== a.id) return toast(`Another article is already called “${title}”`);
    const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
    const fields = {};
    for (const row of $$('.kv', fieldsEl)) {
      const k = row.querySelector('.k').value.trim();
      if (k) fields[k] = row.querySelector('.v').value;
    }
    Object.assign(a, {
      title, type: f.type.value, parentId: f.parentId.value || null,
      summary: f.summary.value, body: f.body.value, gmNotes: f.gmNotes.value,
      tags: [...new Set(f.tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
      fields, start: num(f.start.value), end: num(f.end.value), dateLabel: f.dateLabel.value.trim(),
    });
    await store.save('articles', a);
    if (!isNew && oldTitle && oldTitle.trim().toLowerCase() !== title.toLowerCase()) {
      await store.renameReferences(wid, oldTitle, title);
    }
    dirty = false;
    state.guard = null;
    toast('Saved');
    location.hash = `#/w/${wid}/a/${a.id}`;
  };
}

function mdCommand(ta, cmd) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e);
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;
  let text, cs, ce;
  const wrap = (l, r, ph) => { const inner = sel || ph; text = v.slice(0, s) + l + inner + r + v.slice(e); cs = s + l.length; ce = cs + inner.length; };
  const prefix = (p) => { text = v.slice(0, lineStart) + p + v.slice(lineStart); cs = s + p.length; ce = e + p.length; };
  switch (cmd) {
    case 'bold': wrap('**', '**', 'bold text'); break;
    case 'italic': wrap('*', '*', 'italic text'); break;
    case 'link': wrap('[[', ']]', 'Article title'); break;
    case 'h2': prefix('## '); break;
    case 'h3': prefix('### '); break;
    case 'ul': prefix('- '); break;
    case 'quote': prefix('> '); break;
    case 'hr': text = v.slice(0, s) + '\n\n---\n\n' + v.slice(e); cs = ce = s + 7; break;
  }
  ta.value = text;
  ta.focus();
  ta.setSelectionRange(cs, ce);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// Suggest article titles while typing inside [[ … ]].
function attachAutocomplete(ta, wid) {
  const wrap = document.createElement('div');
  wrap.className = 'ac-wrap';
  ta.parentNode.insertBefore(wrap, ta);
  wrap.appendChild(ta);
  const pop = document.createElement('ul');
  pop.className = 'ac-pop';
  pop.hidden = true;
  wrap.appendChild(pop);
  let items = [], idx = 0, startPos = 0;

  const close = () => { pop.hidden = true; items = []; };
  const choose = (title) => {
    const caret = ta.selectionStart;
    const after = ta.value.slice(caret);
    const closing = after.startsWith(']]') ? '' : ']]';
    ta.value = ta.value.slice(0, startPos) + title + closing + after;
    const pos = startPos + title.length + 2;
    ta.setSelectionRange(pos, pos);
    ta.focus();
    close();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const update = () => {
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/\[\[([^\]|\n]*)$/);
    if (!m) return close();
    startPos = ta.selectionStart - m[1].length;
    const q = m[1].toLowerCase();
    const titles = store.articlesOf(wid).map((x) => x.title);
    items = titles.filter((t) => t.toLowerCase().includes(q))
      .sort((x, y) => (y.toLowerCase().startsWith(q) - x.toLowerCase().startsWith(q)) || x.localeCompare(y)).slice(0, 8);
    if (m[1].trim() && !titles.some((t) => t.toLowerCase() === q.trim())) items.push(m[1].trim());
    if (!items.length) return close();
    idx = 0;
    draw();
  };
  const draw = () => {
    pop.hidden = false;
    pop.innerHTML = items.map((t, i) => {
      const exists = store.byTitle(wid, t);
      return `<li class="${i === idx ? 'on' : ''}" data-i="${i}">${exists ? `${TYPES[exists.type]?.icon || ''} ${esc(t)}` : `＋ New: ${esc(t)}`}</li>`;
    }).join('');
  };
  ta.addEventListener('input', update);
  ta.addEventListener('click', update);
  ta.addEventListener('blur', () => setTimeout(close, 150));
  ta.addEventListener('keydown', (e) => {
    if (pop.hidden) return;
    if (e.key === 'ArrowDown') { idx = (idx + 1) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + items.length) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { choose(items[idx]); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.preventDefault(); }
  });
  pop.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
  });
}

// ---------------------------------------------------------------- timeline

function viewTimeline(wid) {
  const w = store.world(wid);
  setTitle('Timeline');
  const items = store.articlesOf(wid).filter((a) => a.start != null)
    .sort((a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start) || a.title.localeCompare(b.title));
  const types = [...new Set(items.map((a) => a.type))];
  view.innerHTML = `<section class="page">
    <div class="page-head"><h1>⏳ Timeline</h1><div class="actions"><a class="btn primary" href="#/w/${wid}/new/event">+ New event</a></div></div>
    ${types.length > 1 ? `<div class="chips" id="tlFilter"><button class="chip on" data-t="">All</button>${types.map((t) => `<button class="chip" data-t="${t}">${TYPES[t]?.icon} ${TYPES[t]?.plural}</button>`).join('')}</div>` : ''}
    ${items.length ? `<ol class="timeline">${items.map((a) => `
      <li data-type="${a.type}">
        <div class="tl-date">${dateText(a, w)}</div>
        <a class="tl-card" href="#/w/${wid}/a/${a.id}">
          <div class="tl-title">${TYPES[a.type]?.icon || ''} ${esc(a.title)}</div>
          ${a.summary ? `<div class="tl-sum">${esc(plain(a.summary, 200))}</div>` : ''}
        </a>
      </li>`).join('')}</ol>`
    : `<div class="empty-state small"><p>Nothing on the timeline yet. Give any article a <b>Year</b> in its editor (events, births, foundings…) and it will appear here in order.</p></div>`}
  </section>`;
  $$('#tlFilter .chip').forEach((c) => c.onclick = () => {
    $$('#tlFilter .chip').forEach((x) => x.classList.toggle('on', x === c));
    $$('.timeline li').forEach((li) => { li.hidden = !!c.dataset.t && li.dataset.type !== c.dataset.t; });
  });
}

// ---------------------------------------------------------------- maps

function viewMaps(wid) {
  setTitle('Maps');
  const maps = store.mapsOf(wid);
  view.innerHTML = `<section class="page">
    <div class="page-head"><h1>🗺️ Maps</h1><div class="actions"><button class="btn primary" id="newMap">+ New map</button></div></div>
    ${maps.length ? `<div class="cards">${maps.map((m) => `
      <a class="card" href="#/w/${wid}/m/${m.id}"><div class="card-cover" data-bg="${m.image}"><span>🗺️</span></div>
      <div class="card-body"><h3>${esc(m.name)}</h3><small>${(m.pins || []).length} pins</small></div></a>`).join('')}</div>`
    : `<div class="empty-state small"><p>Upload a map image — a world, a continent, a city or a dungeon — then pin your articles onto it.</p></div>`}
  </section>`;
  $('#newMap').onclick = () => mapDialog(wid);
  hydrateImages();
}

function mapDialog(wid, m) {
  const isNew = !m;
  m = m ? { ...m } : { id: uid(), worldId: wid, name: '', image: null, pins: [] };
  modal(isNew ? 'New map' : 'Map settings', `
    <form class="form" id="mf">
      <label>Name<input name="name" required value="${esc(m.name)}" placeholder="e.g. The Known World"></label>
      <label>Map image ${isNew ? '' : '<small>(replace)</small>'}<input type="file" name="file" accept="image/*" ${isNew ? 'required' : ''}></label>
      <div class="actions">
        ${isNew ? '' : '<button type="button" class="btn danger ghost" data-del>Delete map</button><span class="spacer"></span>'}
        <button class="btn primary">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </form>`, {
    onMount: (el, close) => {
      const f = $('#mf', el);
      $('[data-del]', el)?.addEventListener('click', async () => {
        if (!(await confirmDialog(`Delete the map “${m.name}”?`))) return;
        await store.deleteMap(m.id); close(); location.hash = `#/w/${wid}/maps`;
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('.btn.primary', f);
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          if (f.file.files[0]) m.image = await store.addImage(await prepareImage(f.file.files[0], 4096));
          m.name = f.name.value.trim();
          await store.save('maps', m);
          close();
          if (isNew) location.hash = `#/w/${wid}/m/${m.id}`; else route();
        } catch (err) { toast(err.message); btn.disabled = false; }
      };
    },
  });
}

async function viewMap(wid, mid) {
  const m = store.map(mid);
  setTitle(m.name);
  let editing = false;
  let moving = null;
  view.innerHTML = `<section class="page map-page">
    <div class="page-head"><h1>${esc(m.name)}</h1>
      <div class="actions">
        <button class="btn" id="mapSettings">⚙</button>
        <button class="btn" id="editPins">✎ Edit pins</button>
      </div></div>
    <div class="map-hint" id="mapHint" hidden>Tap the map to add a pin · tap a pin to edit it</div>
    <div class="map-wrap"><div class="map-box" id="mapBox"></div>
      <div class="map-zoom"><button class="icon-btn" data-z="in">＋</button><button class="icon-btn" data-z="out">－</button><button class="icon-btn" data-z="fit">⤢</button></div>
      <div class="map-info" id="mapInfo" hidden></div>
    </div>
  </section>`;
  const src = await store.imageURL(m.image);
  if (!src) {
    $('#mapBox').innerHTML = `<p class="muted pad">The map image hasn't downloaded yet. It will appear once this device syncs with OneDrive.</p>`;
    return;
  }
  const labelled = () => (store.map(mid)?.pins || []).map((p) => ({ ...p, label: p.label || store.article(p.articleId)?.title || '' }));
  const info = $('#mapInfo');

  const savePins = async (pins) => {
    const cur = store.map(mid);
    await store.save('maps', { ...cur, pins });
    ctl.setPins(labelled());
  };
  const showInfo = async (p) => {
    const a = store.article(p.articleId);
    info.hidden = false;
    info.innerHTML = `<button class="icon-btn close" aria-label="Close">✕</button>
      ${a?.image ? `<img data-img="${a.image}" alt="">` : ''}
      <div><div class="info-title">${a ? `${TYPES[a.type]?.icon || ''} ${esc(a.title)}` : esc(p.label)}</div>
      ${a?.summary ? `<p>${esc(plain(a.summary, 220))}</p>` : ''}
      ${a ? `<a class="btn small primary" href="#/w/${wid}/a/${a.id}">Open article →</a>` : ''}</div>`;
    info.querySelector('.close').onclick = () => { info.hidden = true; };
    hydrateImages(info);
  };
  const ctl = mountMap($('#mapBox'), {
    src,
    pins: labelled(),
    onPinClick: (p) => (editing ? pinDialog(wid, p) : showInfo(p)),
    onBackgroundTap: async (pt) => {
      info.hidden = true;
      if (moving) {
        const pins = store.map(mid).pins.map((p) => (p.id === moving ? { ...p, ...pt } : p));
        moving = null;
        $('#mapHint').textContent = 'Tap the map to add a pin · tap a pin to edit it';
        return savePins(pins);
      }
      if (editing) pinDialog(wid, { id: uid(), ...pt, articleId: '', label: '', color: '#e0b252' }, true);
    },
  });
  state.mapCtl = ctl;

  async function pinDialog(wid, pin, isNew = false) {
    const arts = store.articlesOf(wid).sort((x, y) => x.title.localeCompare(y.title));
    await modal(isNew ? 'Add pin' : 'Edit pin', `
      <form class="form" id="pf">
        <label>Linked article<select name="articleId"><option value="">— none —</option>
          ${arts.map((a) => `<option value="${a.id}" ${a.id === pin.articleId ? 'selected' : ''}>${TYPES[a.type]?.icon || ''} ${esc(a.title)}</option>`).join('')}</select></label>
        <label>Label <small>defaults to the article title</small><input name="label" value="${esc(pin.label)}"></label>
        <label>Colour<input type="color" name="color" value="${esc(pin.color || '#e0b252')}"></label>
        <div class="actions">
          ${isNew ? '' : '<button type="button" class="btn danger ghost" data-del>Delete</button><button type="button" class="btn" data-move>Move</button><span class="spacer"></span>'}
          <button class="btn primary">${isNew ? 'Add pin' : 'Save'}</button>
        </div>
      </form>`, {
      onMount: (el, close) => {
        const f = $('#pf', el);
        $('[data-del]', el)?.addEventListener('click', async () => {
          await savePins(store.map(mid).pins.filter((p) => p.id !== pin.id)); close();
        });
        $('[data-move]', el)?.addEventListener('click', () => {
          moving = pin.id;
          $('#mapHint').textContent = 'Tap the new location for this pin';
          close();
        });
        f.onsubmit = async (e) => {
          e.preventDefault();
          if (!f.articleId.value && !f.label.value.trim()) return toast('Pick an article or give the pin a label');
          const next = { ...pin, articleId: f.articleId.value, label: f.label.value.trim(), color: f.color.value };
          const pins = store.map(mid).pins || [];
          await savePins(isNew ? [...pins, next] : pins.map((p) => (p.id === pin.id ? next : p)));
          close();
        };
      },
    });
  }

  $('#editPins').onclick = (e) => {
    editing = !editing; moving = null;
    e.currentTarget.classList.toggle('primary', editing);
    e.currentTarget.textContent = editing ? '✓ Done' : '✎ Edit pins';
    $('#mapHint').hidden = !editing;
    $('#mapBox').classList.toggle('editing', editing);
    info.hidden = true;
  };
  $('#mapSettings').onclick = () => mapDialog(wid, store.map(mid));
  $$('[data-z]').forEach((b) => b.onclick = () => (b.dataset.z === 'fit' ? ctl.fit() : ctl.zoom(b.dataset.z === 'in' ? 1.5 : 1 / 1.5)));

  const focusId = new URLSearchParams(location.hash.split('?')[1] || '').get('pin');
  const focusPin = focusId && (m.pins || []).find((p) => p.articleId === focusId);
  if (focusPin) setTimeout(() => { ctl.focus(focusPin); showInfo(focusPin); }, 300);
}

// ---------------------------------------------------------------- settings

function viewSettings() {
  setTitle('Settings');
  const theme = localStorage.getItem('wa.theme') || 'dark';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  view.innerHTML = `<section class="page settings">
    <div class="page-head"><h1>⚙️ Settings &amp; sync</h1></div>
    <div class="panel" id="oneDriveCard"></div>
    <div class="panel">
      <h2>Install the app</h2>
      ${standalone ? '<p>✓ You are using the installed app.</p>' : `
        ${state.installPrompt ? '<p><button class="btn primary" id="installBtn">Install WorldAtlas</button></p>' : ''}
        <p class="muted">${ios
          ? 'On iPhone/iPad: open this page in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>.'
          : 'On Android (Chrome): menu ⋮ → <b>Install app</b> / <b>Add to Home screen</b>. On PC (Edge or Chrome): click the install icon at the right of the address bar, or menu → <b>Apps</b> → <b>Install</b>.'}</p>`}
      <p class="muted small">The app works offline. Everything is saved on the device first and synced to OneDrive whenever you're online.</p>
    </div>
    <div class="panel">
      <h2>Backup</h2>
      <p class="muted">Download everything (including images) as a single file, or merge a backup back in.</p>
      <div class="actions left">
        <button class="btn" id="exportBtn">⬇ Export backup</button>
        <label class="btn">⬆ Import backup<input type="file" id="importFile" accept=".json,application/json" hidden></label>
      </div>
    </div>
    <div class="panel">
      <h2>Appearance</h2>
      <label class="inline">Theme <select id="themeSel">
        <option value="dark">Dark (arcane)</option><option value="light">Light (parchment)</option><option value="auto">Match system</option></select></label>
    </div>
    <p class="muted small center">WorldAtlas · your data lives on your devices and in your own OneDrive.</p>
  </section>`;
  renderOneDriveCard();
  $('#themeSel').value = theme;
  $('#themeSel').onchange = (e) => { localStorage.setItem('wa.theme', e.target.value); applyTheme(); };
  $('#installBtn')?.addEventListener('click', async () => {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    route();
  });
  $('#exportBtn').onclick = exportBackup;
  $('#importFile').onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
}

function renderOneDriveCard() {
  const el = $('#oneDriveCard');
  const st = sync.getStatus();
  const acct = auth.account();
  const cid = auth.clientId();
  let main;
  if (!cid) {
    main = `<p>To sync between your phone and PC, WorldAtlas saves to a private folder in <b>your</b> OneDrive (<code>Apps/WorldAtlas</code>). This needs a free one-time app registration with Microsoft — see the <b>README</b> for the 5-minute walkthrough, then paste the Application (client) ID below.</p>`;
  } else if (st.state === 'off') {
    main = `<p>Sign in with your Microsoft account. Your worlds are stored in <code>OneDrive/Apps/WorldAtlas</code> and kept in sync on every device you connect.</p>
      <p><button class="btn primary" id="connectBtn">Connect OneDrive</button></p>`;
  } else if (st.state === 'reauth') {
    main = `<p class="warn">${esc(st.message || 'Your OneDrive session expired.')}</p>
      <p><button class="btn primary" id="connectBtn">Reconnect OneDrive</button> <button class="btn ghost" id="disconnectBtn">Disconnect</button></p>`;
  } else {
    main = `<p>Connected as <b>${esc(acct?.name || '')}</b> <span class="muted">${esc(acct?.username || '')}</span></p>
      <p>Status: <b class="status-${st.state}">${esc({ synced: 'Up to date', syncing: 'Syncing…', pending: 'Changes waiting to upload', offline: 'Offline', error: 'Error' }[st.state] || st.state)}</b>
      · last synced ${timeAgo(store.meta.lastSync)}</p>
      ${st.state === 'error' ? `<p class="warn">${esc(st.message)}</p>` : ''}
      <p><button class="btn primary" id="syncNowBtn">Sync now</button> <button class="btn ghost" id="disconnectBtn">Disconnect</button></p>`;
  }
  el.innerHTML = `<h2>☁️ OneDrive sync</h2>${main}
    <details ${cid ? '' : 'open'}><summary>Microsoft app registration</summary>
      <label>Application (client) ID<input id="cidInput" value="${esc(cid)}" placeholder="00000000-0000-0000-0000-000000000000"></label>
      <p class="small">Redirect URI to register (platform: <b>Single-page application</b>):<br><code class="copy" id="ruri">${esc(auth.redirectUri())}</code> <button class="btn small ghost" id="copyRuri">Copy</button></p>
      <button class="btn small" id="saveCid">Save client ID</button>
    </details>`;
  $('#connectBtn')?.addEventListener('click', () => auth.signIn().catch((e) => toast(e.message)));
  $('#syncNowBtn')?.addEventListener('click', () => sync.sync());
  $('#disconnectBtn')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Disconnect OneDrive on this device? Your worlds stay on this device and in OneDrive.', 'Disconnect'))) return;
    auth.signOut();
    await store.saveMeta({ eTag: null });
    sync.refreshStatus();
  });
  $('#saveCid').onclick = () => {
    auth.setClientId($('#cidInput').value);
    toast('Saved');
    sync.refreshStatus();
    renderOneDriveCard();
  };
  $('#copyRuri').onclick = () => navigator.clipboard?.writeText(auth.redirectUri()).then(() => toast('Copied'));
}

async function exportBackup() {
  const out = { app: 'WorldAtlas', version: 1, exportedAt: new Date().toISOString(), images: [] };
  for (const s of ['worlds', 'articles', 'maps']) out[s] = [...store.data[s].values()];
  for (const id of await store.imageIds()) {
    const rec = await store.getImage(id);
    out.images.push({ id, type: rec.type, data: await blobToDataURL(rec.blob) });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(`worldatlas-backup-${stamp}.json`, new Blob([JSON.stringify(out)], { type: 'application/json' }));
}

async function importBackup(file) {
  try {
    const json = JSON.parse(await file.text());
    if (json.app !== 'WorldAtlas') throw new Error('Not a WorldAtlas backup');
    const have = new Set(await store.imageIds());
    for (const img of json.images || []) {
      if (!have.has(img.id)) await store.putImage({ id: img.id, type: img.type, blob: await dataURLToBlob(img.data), uploaded: false });
    }
    await store.mergeRecords(json);
    await store.saveMeta({ localRev: store.meta.localRev + 1 });
    sync.sync();
    toast('Backup imported');
    route();
  } catch (e) {
    toast('Import failed: ' + e.message, 5000);
  }
}

boot();
