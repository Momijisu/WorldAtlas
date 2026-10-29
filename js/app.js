import * as store from './store.js';
import * as auth from './auth.js';
import * as sync from './sync.js';
import { TYPES } from './store.js';
import { templateCounts } from './templates.js';
import { $, $$, esc, toast, timeAgo, confirmDialog } from './util.js';
import { state, icon } from './ui.js';
import { viewWorlds, viewWorld, newArticleDialog } from './views/home.js';
import { exampleWorld } from './example.js';
import { applyBackground } from './backgrounds.js';
import { wirePreviews } from './preview.js';
import { loadWorldFonts } from './scripts.js';
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
let lastRendered = null;
let ignoreHash = false;

// ---------------------------------------------------------------- boot

async function boot() {
  applyTheme();
  let authError = null, returned = null;
  try { returned = await auth.handleRedirect(); } catch (e) { authError = e; }
  await store.load();
  await seedDemo();
  wireChrome();
  wirePreviews();
  store.onChange((e) => {
    if (e.local) return;
    if (hasUnsaved()) toast('Changes arrived from another device');
    else route({ keepScroll: true });
    if (e.conflicts) {
      toast(`${e.conflicts} article${e.conflicts === 1 ? ' has' : 's have'} conflicting edits to resolve`, 7000);
    }
  });
  sync.onStatus(renderSyncBadge);
  sync.start();
  // Keep the OneDrive sign-in alive in the background (see auth.renewSilently).
  const renew = async () => { if (auth.needsRenewal() && await auth.renewSilently()) sync.sync(); };
  renew();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renew(); });
  setInterval(renew, 60 * 60e3);
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
    // updateViaCache 'none': always fetch sw.js and js/version.js fresh when checking for updates.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // Apps are often left open for days: check for a new version regularly and on return.
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      setInterval(check, 30 * 60e3);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }).catch((e) => console.warn('SW registration failed', e));
  }
  navigator.storage?.persist?.();
}

// On a first visit with nothing saved, open a local-only example world so there
// is something to explore. Not for signed-in devices (their worlds are on the
// way from OneDrive), and never again once seeded or removed.
async function seedDemo() {
  try {
    if (localStorage.getItem('wa.demoSeeded')) return;
    localStorage.setItem('wa.demoSeeded', '1');
  } catch { return; }
  if (store.data.worlds.size || auth.account()) return;
  // Created for newcomers to explore, but they start on the worlds page.
  await exampleWorld(store, { demo: true });
}

// Keep the install event so we can offer our own Install button, but don't
// preventDefault(): that would hide the browser's own install prompt/menu entry.
// An offer that arrived before this module loaded was kept by index.html.
if (window.waInstallPrompt) state.installPrompt = window.waInstallPrompt;
addEventListener('beforeinstallprompt', (e) => { state.installPrompt = e; showInstallButton(); });
addEventListener('appinstalled', () => { state.installPrompt = null; showInstallButton(); });

// The top-bar button and the one in Settings show whenever an offer is waiting
// (Settings may have been drawn before the offer arrived).
function showInstallButton() {
  for (const id of ['installTop', 'installRow']) {
    const el = document.getElementById(id);
    if (el) el.hidden = !state.installPrompt;
  }
}
state.showInstallButton = showInstallButton;

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
    if (st === 'reauth') auth.signIn().catch((e) => toast(e.message)); // straight back in, no picker
    else if (st === 'off' || st === 'error') location.hash = '#/settings';
    else sync.sync();
  };
  // Links to articles that don't exist yet: ask which template to start from.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-create]');
    if (!a || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    newArticleDialog(state.wid, '', { title: a.dataset.create });
  });
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

const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function route({ keepScroll = false } = {}) {
  currentHash = location.hash;
  state.cleanup?.();
  state.cleanup = null;
  document.body.classList.remove('nav-open');
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const p = path.split('/').filter(Boolean).map(decode);
  const q = new URLSearchParams(qs || '');

  const opts = { keepScroll: keepScroll && raw === lastRendered };
  lastRendered = raw;
  if (p[0] === 'settings') return show(null, viewSettings, opts);
  if (p[0] !== 'w' || !p[1]) return show(null, viewWorlds, opts);
  const wid = p[1];
  if (!store.world(wid)) { toast('That world no longer exists'); return show(null, viewWorlds, opts); }
  localStorage.setItem('wa.lastWorld', wid);
  const [sec, id, sub] = p.slice(2);
  const routes = {
    t: () => viewList(wid, { type: id }),
    tag: () => viewList(wid, { tag: id }),
    search: () => viewSearch(wid, q.get('q') || ''),
    timeline: () => viewTimeline(wid, q),
    calendar: () => (id === 'edit' ? viewCalendarEdit(wid) : viewCalendar(wid, q)),
    maps: () => viewMaps(wid),
    m: () => (store.map(id)?.worldId === wid ? viewMap(wid, id, q) : null),
    tree: () => (store.article(id)?.worldId === wid ? viewTree(wid, id) : null),
    graph: () => viewGraph(wid, q),
    trash: () => viewTrash(wid),
    prompts: () => viewPrompts(wid),
    new: () => {
      const type = Object.hasOwn(TYPES, id || '') ? id : 'article';
      const num = (k) => (q.has(k) && q.get(k) !== '' && !isNaN(+q.get(k)) ? +q.get(k) : null);
      return viewEditor(wid, store.newArticle(wid, type, {
        title: q.get('title') || '', parentId: q.get('parent') || null,
        start: num('y'), startM: num('y') == null ? null : num('m'), startD: num('m') == null ? null : num('d'),
      }), true, { prompt: q.get('prompt') });
    },
    a: () => {
      const a = store.article(id);
      if (a?.worldId !== wid) return null;
      if (sub === 'edit') return viewEditor(wid, structuredClone(a), false, { prompt: q.get('prompt') });
      if (sub === 'history') return viewHistory(wid, id);
      if (sub === 'resolve') return viewResolve(wid, id);
      return viewArticle(wid, id);
    },
  };
  const fn = sec ? (Object.hasOwn(routes, sec) ? routes[sec] : null) : () => viewWorld(wid);
  show(wid, () => {
    if (!fn || fn() === null) { toast('Not found'); viewWorld(wid); }
  }, opts);
}
state.route = route;

// keepScroll: a re-render of the same page after a sync shouldn't jump to the top.
function show(wid, fn, { keepScroll = false } = {}) {
  const y = scrollY;
  state.wid = wid;
  document.body.classList.toggle('in-world', !!wid);
  renderSidebar(wid);
  applyBackground(wid);
  if (wid) loadWorldFonts(wid);
  window.scrollTo(0, 0);
  fn();
  if (keepScroll) requestAnimationFrame(() => window.scrollTo(0, y));
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
  sidebar.innerHTML = `<nav>
    <a href="#/" class="back">${icon('arrow-left')} All worlds</a>
    <div class="world-title"><a href="#/w/${wid}">${esc(w.name)}</a></div>
    <div class="world-sub eyebrow">${store.isDemo(wid) ? 'Example · not synced' : `${arts.length} article${arts.length === 1 ? '' : 's'} · ${store.mapsOf(wid).length} map${store.mapsOf(wid).length === 1 ? '' : 's'}`}</div>
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
    ${templateCounts(arts).map(([k, t, n]) => nav(`#/w/${wid}/t/${k}`, t.icon, t.plural, n)).join('') || '<p class="nav-empty">Articles you write are listed here by template.</p>'}
    <div class="nav-sep"></div>
    ${nav(`#/w/${wid}/trash`, 'trash', 'Recently deleted')}
    ${nav('#/settings', 'gear-six', 'Settings &amp; sync')}
  </nav>`;
}

boot();
