import * as store from './store.js';
import * as auth from './auth.js';
import * as sync from './sync.js';
import { TYPES } from './store.js';
import { codexOf, navShown } from './templates.js';
import { $, $$, esc, toast, timeAgo, confirmDialog } from './util.js';
import { state, icon } from './ui.js';
import { viewWorlds, viewWorld, newArticleDialog, worldDialog, arrangeCodex } from './views/home.js';
import { exampleWorld } from './example.js';
import { applyBackground, moveDeviceDefaults } from './backgrounds.js';
import { oldDeviceEdge } from './edges.js';
import { convertLegacyTables } from './tables.js';
import { wirePreviews } from './preview.js';
import './contextmenu.js';
import './lightbox.js';
import { loadWorldFonts } from './scripts.js';
import { viewList, viewSearch } from './views/list.js';
import { viewArticle } from './views/article.js';
import { viewEditor } from './views/editor.js';
import { viewHistory, viewTrash } from './views/history.js';
import { viewDuplicates } from './views/duplicates.js';
import { viewTimeline } from './views/timeline.js';
import { viewCalendar, viewCalendarEdit } from './views/calendar.js';
import { viewMaps, viewMap } from './views/maps.js';
import { viewTree } from './views/tree.js';
import { viewGraph } from './views/graph.js';
import { viewPrompts } from './views/prompts.js';
import { viewResolve } from './views/conflict.js';
import { promptsEnabled } from './prompts.js';
import { viewSettings, renderSyncCard, applyTheme } from './views/settings.js';

const sidebar = $('#sidebar');
let currentHash = location.hash;

// A sticky page head (the editor's) gets its backing only once it has stuck.
addEventListener('scroll', () => {
  const head = document.querySelector('.page-head.sticky');
  if (!head) return;
  const top = parseFloat(getComputedStyle(head).top) || 0;
  head.classList.toggle('stuck', head.getBoundingClientRect().top <= top + 1 && scrollY > 0);
}, { passive: true });

// Header images span the whole content area (beside the sidebar), wider than
// the page column; CSS reads that width from --view-w.
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--view-w', `${Math.round(e.contentRect.width)}px`)).observe($('#view'));
let lastRendered = null;
let ignoreHash = false;

// ---------------------------------------------------------------- boot

async function boot() {
  applyTheme();
  let authError = null, returned = null;
  try { returned = await auth.handleRedirect(); } catch (e) { authError = e; }
  await store.load();
  await convertLegacyTables();
  await moveDeviceDefaults(oldDeviceEdge());
  await seedDemo();
  wireChrome();
  wirePreviews();
  store.onChange((e) => {
    if (e.local) return;
    convertLegacyTables(); // a 1.56 table synced in from another device
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
    // When an updated version takes over, reload once so old and new files never mix.
    // Mid-edit (another window may have updated), say so instead and let the user reload.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      if (hasUnsaved()) { updateReady(null); return; }
      reloaded = true;
      location.reload();
    });
    // updateViaCache 'none': always fetch sw.js and js/version.js fresh when checking for updates.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // A downloaded update waits for the user: the "!" says it's ready.
      // (Unless "Update now" was chosen before it finished downloading: then it takes over.)
      const offer = (w) => {
        if (!w || !navigator.serviceWorker.controller) return;
        if (wantUpdate) w.postMessage('activate'); else updateReady(w);
      };
      swReg = reg;
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
      });
      // Apps are often left open for days: check for a new version shortly after
      // opening, every ten minutes, and on coming back to the app.
      setTimeout(checkForUpdate, 3000);
      setInterval(checkForUpdate, 10 * 60e3);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
    }).catch((e) => console.warn('SW registration failed', e));
  }
  navigator.storage?.persist?.();
  // The installed app opening a .world file (double-clicked on the computer).
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      for (const h of params.files || []) (await import('./views/settings.js')).openWorldFile(await h.getFile());
    });
  }
}

// ---------------------------------------------------------------- updates
// A new version waits for the user: a small "!" on the Settings link (and the
// menu button on phones) says it's ready, and Settings → About this app shows
// what's new in it and offers "Update now". No pop-up.
let waitingWorker = null, updateShown = false, wantUpdate = false, swReg = null;
function updateReady(w) {
  if (w) waitingWorker = w;
  updateShown = true;
  document.body.classList.add('update-ready');
}
export async function applyUpdate() {
  if (hasUnsaved()) { toast('Save or cancel what you’re editing first, then update', 4000); return; }
  // Downloaded and waiting: tell it to take over (controllerchange then reloads).
  if (waitingWorker?.state === 'installed') { waitingWorker.postMessage('activate'); return; }
  // Not downloaded yet (or no service worker): fetch it, and take over as soon as it's in.
  wantUpdate = true;
  const reg = swReg || await navigator.serviceWorker?.getRegistration();
  if (!reg) { location.reload(); return; }
  if (reg.waiting) { reg.waiting.postMessage('activate'); return; }
  await reg.update().catch(() => {});
  if (reg.waiting) reg.waiting.postMessage('activate');
  // Otherwise it's downloading: offer() activates it once installed.
}
state.applyUpdate = applyUpdate;

// One check for the whole app: ask the server which version is current. A newer
// one shows the "!" at once and starts downloading it in the background (the
// service worker's own check can lag behind); "Update now" waits for that
// download if needed. Returns the latest version, or null if it couldn't tell.
let latestSeen = null;
export async function checkForUpdate() {
  if (!navigator.onLine) return null;
  try {
    const text = await (await fetch(`js/version.js?check=${Date.now()}`, { cache: 'no-store' })).text();
    const latest = text.match(/WA_VERSION\s*=\s*'([^']+)'/)?.[1];
    if (!latest) return null;
    latestSeen = latest;
    if (latest !== self.WA_VERSION) {
      updateReady(null);
      const reg = swReg || await navigator.serviceWorker?.getRegistration();
      await reg?.update().catch(() => {});
    }
    return latest;
  } catch { return null; }
}
state.checkForUpdate = checkForUpdate;
state.latestVersion = () => latestSeen;
state.updateWaiting = () => updateShown;

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
    if (st === 'reauth' && sync.target() === 'folder') sync.allowFolder(); // the browser asks to use the folder again
    else if (st === 'reauth') auth.signIn().catch((e) => toast(e.message)); // straight back in, no picker
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
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); $('#searchInput').focus(); }
    // New article: N, Alt+N, or Ctrl/Cmd+N. Browsers keep Ctrl+N for a new
    // window in ordinary tabs, so it only reaches us where they let it through.
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    if (e.code === 'KeyN' && !e.shiftKey && (mod || !typing) && state.wid && !document.querySelector('#modal-root > *')) {
      e.preventDefault();
      newArticleDialog(state.wid);
    }
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
  btn.title = message || (st === 'synced' ? `Synced with ${sync.targetLabel()} ${timeAgo(store.meta.lastSync)}` : text);
  if ($('#syncCard')) renderSyncCard();
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
    duplicates: () => viewDuplicates(wid),
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
      return viewArticle(wid, id, { section: q.get('s') });
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

// The sidebar can fold down to its icons (wide screens only); the choice is per device.
const MINI_KEY = 'wa.navMini';
const navMini = () => { try { return localStorage.getItem(MINI_KEY) === '1'; } catch { return false; } };
function setNavMini(on) {
  try { localStorage.setItem(MINI_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  document.body.classList.toggle('nav-mini', on);
  renderSidebar(state.wid);
  markActiveNav();
}
document.body.classList.toggle('nav-mini', navMini());
const foldBtn = () => {
  const t = navMini() ? 'Show the full sidebar' : 'Fold the sidebar to icons';
  return `<button class="icon-btn sm side-fold" id="sideFold" title="${t}" aria-label="${t}">${icon('sidebar-simple')}</button>`;
};
// Folded, each link's name shows as a tooltip instead.
function wireSidebar() {
  $('#sideFold')?.addEventListener('click', () => setNavMini(!navMini()));
  $('#sideWorld')?.addEventListener('click', () => worldDialog(store.world(state.wid)));
  $$('#sidebar [data-arrange]').forEach((b) => b.addEventListener('click', () => arrangeCodex(state.wid)));
  if (navMini()) $$('#sidebar a').forEach((a) => { a.title ||= a.querySelector('span')?.textContent || ''; });
}

const nav = (href, ic, label, count = '', extra = '') =>
  `<a href="${href}" ${extra}>${icon(ic)}<span>${label}</span>${count !== '' ? `<span class="count">${count}</span>` : ''}</a>`;

// A sidebar section: its title (with the Arrange button) and the items it shows; nothing if all are hidden.
const section = (title, items) => {
  const shown = items.filter(Boolean);
  return shown.length ? `<div class="nav-title nav-title-row">${title}<button type="button" class="icon-btn sm codex-arrange" data-arrange title="Arrange the sidebar: choose what shows, and the codex's order" aria-label="Arrange the sidebar">${icon('sliders')}</button></div>${shown.join('')}` : '';
};

function renderSidebar(wid) {
  if (!wid) {
    sidebar.innerHTML = `<nav>
      <div class="side-top">${foldBtn()}</div>
      <div class="nav-title" style="margin-top:0">Library</div>
      ${nav('#/', 'books', 'All worlds')}
      ${store.worlds().map((w) => nav(`#/w/${w.id}`, 'globe-hemisphere-west', esc(w.name))).join('')}
      <div class="nav-sep"></div>
      ${nav('#/settings', 'gear-six', 'Settings &amp; sync', '', 'class="nav-settings" data-upd="Update ready"')}
    </nav>`;
    wireSidebar();
    return;
  }
  const w = store.world(wid);
  const arts = store.articlesOf(wid);
  sidebar.innerHTML = `<nav>
    <div class="side-top"><a href="#/" class="back">${icon('arrow-left')}<span>All worlds</span></a>${foldBtn()}</div>
    <div class="world-title"><a href="#/w/${wid}" title="${esc(w.name)}"><span class="world-name">${esc(w.name)}</span><span class="world-mono" aria-hidden="true">${esc((w.name[0] || '?').toUpperCase())}</span></a>
      <button class="icon-btn sm side-world" id="sideWorld" title="World settings" aria-label="World settings">${icon('gear-six')}</button></div>
    <div class="world-sub eyebrow">${store.isDemo(wid) ? 'Example · not synced' : `${arts.length} article${arts.length === 1 ? '' : 's'} · ${store.mapsOf(wid).length} map${store.mapsOf(wid).length === 1 ? '' : 's'}`}</div>
    ${conflictNav(wid)}
    ${nav(`#/w/${wid}/t/all`, 'books', 'All articles', arts.length)}
    ${promptsEnabled() ? nav(`#/w/${wid}/prompts`, 'feather', 'Writing prompts') : ''}
    ${section('Chronicle', [
      navShown(w, 'timeline') && nav(`#/w/${wid}/timeline`, 'hourglass-medium', 'Timeline'),
      navShown(w, 'calendar') && nav(`#/w/${wid}/calendar`, 'calendar-blank', 'Calendar', '', `data-prefix="#/w/${wid}/calendar"`)])}
    ${section('Atlas', [
      navShown(w, 'maps') && nav(`#/w/${wid}/maps`, 'map-trifold', 'Maps', store.mapsOf(wid).length || '', `data-prefix="#/w/${wid}/m/"`),
      navShown(w, 'graph') && nav(`#/w/${wid}/graph`, 'graph', 'Relationships')])}
    <div class="nav-title nav-title-row">Codex<button type="button" class="icon-btn sm codex-arrange" data-arrange title="Arrange the sidebar: choose what shows, and the codex's order" aria-label="Arrange the sidebar">${icon('sliders')}</button></div>
    ${codexOf(w, arts).map(([k, t, n]) => nav(`#/w/${wid}/t/${k}`, t.icon, t.plural, n)).join('') || (arts.length ? '<p class="nav-empty">Every template is hidden. Arrange the sidebar to show some.</p>' : '<p class="nav-empty">Articles you write are listed here by template.</p>')}
    <div class="nav-sep"></div>
    ${nav(`#/w/${wid}/trash`, 'trash', 'Recently deleted')}
    ${nav('#/settings', 'gear-six', 'Settings &amp; sync', '', 'class="nav-settings" data-upd="Update ready"')}
  </nav>`;
  wireSidebar();
}

boot();
