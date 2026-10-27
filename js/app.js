import * as store from './store.js';
import * as auth from './auth.js';
import * as sync from './sync.js';
import { TYPES } from './store.js';
import { $, $$, esc, toast, timeAgo, confirmDialog } from './util.js';
import { state, icon } from './ui.js';
import { viewWorlds, viewWorld, newArticleDialog } from './views/home.js';
import { viewList, viewSearch } from './views/list.js';
import { viewArticle } from './views/article.js';
import { viewEditor } from './views/editor.js';
import { viewHistory, viewTrash } from './views/history.js';
import { viewTimeline } from './views/timeline.js';
import { viewCalendar, viewCalendarEdit } from './views/calendar.js';
import { viewMaps, viewMap } from './views/maps.js';
import { viewTree } from './views/tree.js';
import { viewGraph } from './views/graph.js';
import { viewPrompts } from './views/prompts.js';
import { viewResolve } from './views/conflict.js';
import { promptsEnabled } from './prompts.js';
import { viewSettings, renderOneDriveCard, applyTheme } from './views/settings.js';

const sidebar = $('#sidebar');
let currentHash = location.hash;
let ignoreHash = false;

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
    if (hasUnsaved()) toast('Changes arrived from another device');
    else route();
    if (e.conflicts) {
      toast(`${e.conflicts} article${e.conflicts === 1 ? ' has' : 's have'} conflicting edits to resolve`, 7000);
    }
  });
  sync.onStatus(renderSyncBadge);
  sync.start();
  route();
  if (authError) toast('Sign-in failed: ' + authError.message, 7000);
  else if (returned && !returned.silent) toast('Connected to OneDrive');
  if ('serviceWorker' in navigator) {
    // When an updated version takes over, reload once so old and new files never mix
    // (unless the user is mid-edit; they'll get the update on the next launch).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded && !hasUnsaved()) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  navigator.storage?.persist?.();
}

// Keep the install event so we can offer our own Install button, but don't
// preventDefault(): that would hide the browser's own install prompt/menu entry.
addEventListener('beforeinstallprompt', (e) => { state.installPrompt = e; showInstallButton(); });
addEventListener('appinstalled', () => { state.installPrompt = null; showInstallButton(); });

function showInstallButton() {
  const btn = document.getElementById('installTop');
  if (btn) btn.hidden = !state.installPrompt;
}

export async function promptInstall() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  showInstallButton();
}
state.promptInstall = promptInstall;

function wireChrome() {
  $('#menuBtn').innerHTML = icon('list');
  $('#newBtn').innerHTML = icon('plus');
  $('#searchForm').insertAdjacentHTML('afterbegin', icon('magnifying-glass'));
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#searchForm').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    const wid = state.wid || localStorage.getItem('wa.lastWorld') || store.worlds()[0]?.id;
    if (!store.world(wid)) return toast('Create a world first');
    location.hash = `#/w/${wid}/search?q=${encodeURIComponent(q)}`;
    $('#searchInput').blur();
  };
  $('#newBtn').onclick = () => newArticleDialog(state.wid);
  $('#installTop').onclick = promptInstall;
  showInstallButton();
  $('#syncBtn').onclick = () => {
    const st = sync.getStatus().state;
    if (st === 'off' || st === 'reauth' || st === 'error') location.hash = '#/settings';
    else sync.sync();
  };
  addEventListener('hashchange', onHash);
  // Closing or reloading the tab can only use the browser's own warning (browsers don't allow custom ones).
  addEventListener('beforeunload', (e) => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#searchInput').focus(); }
  });
}

function renderSyncBadge({ state: st, message }) {
  const btn = $('#syncBtn');
  const labels = {
    off: ['cloud-slash', 'Local only'], syncing: ['arrows-clockwise', 'Syncing'], synced: ['cloud-check', 'Synced'],
    pending: ['cloud-arrow-up', 'Unsynced'], offline: ['cloud-slash', 'Offline'], error: ['warning', 'Sync error'], reauth: ['warning', 'Reconnect'],
  };
  const [ic, text] = labels[st];
  btn.className = 'sync-badge ' + st;
  btn.innerHTML = `${icon(ic)}<span class="sync-text">${text}</span>`;
  btn.title = message || (st === 'synced' ? 'Synced with OneDrive ' + timeAgo(store.meta.lastSync) : text);
  if ($('#oneDriveCard')) renderOneDriveCard();
}

// ---------------------------------------------------------------- routing

const hasUnsaved = () => !!state.guard?.();

async function onHash() {
  if (ignoreHash) { ignoreHash = false; return; }
  if (hasUnsaved()) {
    // Stay on the current page while we ask, then follow through if confirmed.
    const target = location.hash;
    ignoreHash = true;
    location.hash = currentHash;
    const leave = await confirmDialog(state.guardMessage || 'You have unsaved changes. Leave and discard them?', 'Discard changes',
      { title: 'Unsaved changes', cancelLabel: 'Keep editing' });
    if (!leave) return;
    state.guard = null;
    location.hash = target;
    return;
  }
  state.guard = null;
  route();
}

export function route() {
  currentHash = location.hash;
  state.cleanup?.();
  state.cleanup = null;
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
  const routes = {
    t: () => viewList(wid, { type: id }),
    tag: () => viewList(wid, { tag: id }),
    search: () => viewSearch(wid, q.get('q') || ''),
    timeline: () => viewTimeline(wid, q),
    calendar: () => (id === 'edit' ? viewCalendarEdit(wid) : viewCalendar(wid, q)),
    maps: () => viewMaps(wid),
    m: () => (store.map(id) ? viewMap(wid, id, q) : null),
    tree: () => (store.article(id) ? viewTree(wid, id) : null),
    graph: () => viewGraph(wid, q),
    trash: () => viewTrash(wid),
    prompts: () => viewPrompts(wid),
    new: () => {
      const type = TYPES[id] ? id : 'article';
      const num = (k) => (q.has(k) && q.get(k) !== '' && !isNaN(+q.get(k)) ? +q.get(k) : null);
      return viewEditor(wid, store.newArticle(wid, type, {
        title: q.get('title') || '', parentId: q.get('parent') || null,
        start: num('y'), startM: num('y') == null ? null : num('m'), startD: num('m') == null ? null : num('d'),
      }), true, { prompt: q.get('prompt') });
    },
    a: () => {
      const a = store.article(id);
      if (!a) return null;
      if (sub === 'edit') return viewEditor(wid, structuredClone(a), false, { prompt: q.get('prompt') });
      if (sub === 'history') return viewHistory(wid, id);
      if (sub === 'resolve') return viewResolve(wid, id);
      return viewArticle(wid, id);
    },
  };
  const fn = sec ? routes[sec] : () => viewWorld(wid);
  show(wid, () => {
    if (!fn || fn() === null) { toast('Not found'); viewWorld(wid); }
  });
}
state.route = route;

function show(wid, fn) {
  state.wid = wid;
  document.body.classList.toggle('in-world', !!wid);
  renderSidebar(wid);
  window.scrollTo(0, 0);
  fn();
  markActiveNav();
}

function markActiveNav() {
  const h = (location.hash || '#/').split('?')[0];
  $$('#sidebar a').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === h || (!!a.dataset.prefix && h.startsWith(a.dataset.prefix)));
  });
}

// ---------------------------------------------------------------- sidebar

function conflictNav(wid) {
  const list = store.conflictsOf(wid);
  if (!list.length) return '';
  const href = list.length === 1 ? `#/w/${wid}/a/${list[0].id}/resolve` : `#/w/${wid}/t/conflicts`;
  return nav(href, 'warning', 'Conflicts to resolve', list.length, 'class="nav-conflict"');
}

const nav = (href, ic, label, count = '', extra = '') =>
  `<a href="${href}" ${extra}>${icon(ic)}<span>${label}</span>${count !== '' ? `<span class="count">${count}</span>` : ''}</a>`;

function renderSidebar(wid) {
  if (!wid) {
    sidebar.innerHTML = `<nav>
      <div class="nav-title" style="margin-top:0">Library</div>
      ${nav('#/', 'books', 'All worlds')}
      ${store.worlds().map((w) => nav(`#/w/${w.id}`, 'globe-hemisphere-west', esc(w.name))).join('')}
      <div class="nav-sep"></div>
      ${nav('#/settings', 'gear-six', 'Settings &amp; sync')}
    </nav>`;
    return;
  }
  const w = store.world(wid);
  const arts = store.articlesOf(wid);
  const counts = {};
  for (const a of arts) counts[a.type] = (counts[a.type] || 0) + 1;
  sidebar.innerHTML = `<nav>
    <a href="#/" class="back">${icon('arrow-left')} All worlds</a>
    <div class="world-title"><a href="#/w/${wid}">${esc(w.name)}</a></div>
    <div class="world-sub eyebrow">${arts.length} articles · ${store.mapsOf(wid).length} maps</div>
    ${nav(`#/w/${wid}`, 'compass', 'Overview')}
    ${conflictNav(wid)}
    ${nav(`#/w/${wid}/t/all`, 'books', 'All articles', arts.length)}
    ${promptsEnabled() ? nav(`#/w/${wid}/prompts`, 'feather', 'Writing prompts') : ''}
    <div class="nav-title">Chronicle</div>
    ${nav(`#/w/${wid}/timeline`, 'hourglass-medium', 'Timeline')}
    ${nav(`#/w/${wid}/calendar`, 'calendar-blank', 'Calendar', '', `data-prefix="#/w/${wid}/calendar"`)}
    <div class="nav-title">Atlas</div>
    ${nav(`#/w/${wid}/maps`, 'map-trifold', 'Maps', store.mapsOf(wid).length || '', `data-prefix="#/w/${wid}/m/"`)}
    ${nav(`#/w/${wid}/graph`, 'graph', 'Relationships')}
    <div class="nav-title">Codex</div>
    ${Object.entries(TYPES).map(([k, t]) => nav(`#/w/${wid}/t/${k}`, t.icon, t.plural, counts[k] || '', counts[k] ? '' : 'class="empty"')).join('')}
    <div class="nav-sep"></div>
    ${nav(`#/w/${wid}/trash`, 'trash', 'Recently deleted')}
    ${nav('#/settings', 'gear-six', 'Settings &amp; sync')}
  </nav>`;
}

boot();
