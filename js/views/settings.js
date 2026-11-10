// Settings: OneDrive sync, installing the app, backups and appearance.
import * as store from '../store.js';
import * as auth from '../auth.js';
import * as sync from '../sync.js';
import { whatsNewHTML } from '../updates.js';
import { $, esc, toast, modal, confirmDialog, timeAgo, blobToDataURL, dataURLToBlob, download } from '../util.js';
import { view, state, setTitle, pageHead, icon, rowPicturesOn } from '../ui.js';
import { planImport, applyImport, isImportFormat, exportSimple } from '../importer.js';
import { exportWorld, importWorld, isZip } from '../worldfile.js';
import { TYPES } from '../store.js';
import { promptsEnabled, setPromptsEnabled } from '../prompts.js';
import { guidanceEnabled, setGuidanceEnabled } from '../guidance.js';

// Article text (Settings → Appearance): size and weight of what's written in
// articles only; the rest of the app keeps its own type. Per device.
const PROSE_WEIGHTS = [[400, 'Regular'], [500, 'Medium'], [700, 'Bold']];
export function proseSettings() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('wa.prose') || '{}') || {}; } catch { /* unreadable */ }
  const size = Math.min(135, Math.max(85, +p.size || 100));
  const weight = PROSE_WEIGHTS.some(([w]) => w === +p.weight) ? +p.weight : 400;
  return { size, weight };
}
function applyProse() {
  const { size, weight } = proseSettings();
  const root = document.documentElement.style;
  root.setProperty('--prose-size', String(size / 100));
  root.setProperty('--prose-weight', String(weight));
}
function setProse(p) {
  try { localStorage.setItem('wa.prose', JSON.stringify({ ...proseSettings(), ...p })); } catch { /* storage blocked */ }
  applyProse();
}

export function applyTheme() {
  applyProse();
  document.documentElement.dataset.theme = localStorage.getItem('wa.theme') || 'dark';
  const light = getComputedStyle(document.documentElement).colorScheme === 'light';
  document.querySelector('meta[name="theme-color"]').content = light ? '#e6dcc8' : '#161411';
}

export function viewSettings() {
  setTitle('Settings');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const edge = /Edg/i.test(ua);
  const android = /android/i.test(ua);
  const firefox = /Firefox|FxiOS/i.test(ua);
  view.innerHTML = `<section class="page narrow settings">
    ${pageHead({ eyebrow: 'WorldAtlas', title: 'Settings &amp; sync' })}
    <div class="panel" id="aboutCard">
      <h2>About this app</h2>
      <dl class="about-list">
        <dt>Version</dt><dd><b>${esc(self.WA_VERSION || '?')}</b> <span class="muted">· built ${esc(self.WA_BUILD || '?')}</span></dd>
        <dt>Offline cache</dt><dd id="cacheVer" class="muted">checking…</dd>
        <dt>Latest online</dt><dd id="latestVer" class="muted">—</dd>
      </dl>
      <div id="updNotes" hidden></div>
      <div class="actions left">
        <button class="btn" id="checkUpd">${icon('arrows-clockwise')} Check for updates</button>
        <button class="btn primary" id="doUpd" hidden>${icon('download-simple')} Update now</button>
        <button class="btn quiet" id="resetCache" title="Clears downloaded app files only. Your worlds are not affected.">Reset offline cache</button>
      </div>
      <p class="muted small">Resetting the cache re-downloads the app. Your worlds and settings aren’t touched.</p>
    </div>
    <div class="panel">
      <h2>Install the app</h2>
      ${standalone ? `<p>${icon('check')} You’re using the installed app.</p>` : `
        <p id="installRow" ${state.installPrompt ? '' : 'hidden'}><button class="btn primary" id="installBtn">${icon('download-simple')} Install WorldAtlas</button></p>
        <p class="muted">${ios
          ? `Tap <b>Share</b>${edge ? ' (in Edge, menu ⋯ → Share)' : ''} → <b>Add to Home Screen</b>. Before iOS 16.4, use Safari.`
          : android && edge
            ? 'Menu <b>⋯</b> → <b>Add to phone</b> (or <b>Install app</b>). If it’s missing, reload and try again.'
            : android && firefox
              ? 'Menu ⋮ → <b>Add app to Home screen</b>.'
              : android
                ? 'Menu ⋮ → <b>Install app</b>.'
                : firefox
                  ? 'Firefox can’t install web apps on a computer, but WorldAtlas works fully here in a tab, offline too once it has loaded. To install it as its own app, open this page in Chrome or Edge. Your worlds are kept per browser, so connect OneDrive there to bring them across.'
                  : 'Use the install icon in the address bar, or menu → <b>Apps</b> → <b>Install WorldAtlas</b>.'}</p>`}
      <p class="muted small">Works offline. Changes sync to OneDrive when you’re online.</p>
    </div>
    <div class="panel" id="syncCard"></div>
    <div class="panel">
      <h2>Appearance</h2>
      <div class="seg" id="themeSeg">
        <button data-t="dark">${icon('moon-stars')} Nocturne</button>
        <button data-t="light">${icon('sun')} Vellum</button>
        <button data-t="auto">Match device</button>
      </div>
      <div class="field-label" style="margin-top:1.2rem">Article text <small>what you write in articles; the rest of the app stays as it is</small></div>
      <label class="bg-scale">Size<input type="range" id="proseSize" min="85" max="135" step="5" value="${proseSettings().size}"><output>${proseSettings().size}%</output></label>
      <label class="bg-scale">Weight<input type="range" id="proseWeight" min="0" max="${PROSE_WEIGHTS.length - 1}" step="1" value="${PROSE_WEIGHTS.findIndex(([w]) => w === proseSettings().weight)}"><output>${PROSE_WEIGHTS.find(([w]) => w === proseSettings().weight)[1]}</output></label>
      <div class="prose prose-sample"><p>The rain-slick capital of Vael was built on the bones of a Skyward citadel. Its <a href="#" onclick="return false">harbour</a> never sleeps, and the <strong>Lantern Guild</strong> keeps the old roads lit, <em>for a price</em>.</p></div>
      <label class="check" style="margin-top:1rem"><input type="checkbox" id="rowPicsToggle" ${rowPicturesOn() ? 'checked' : ''}> Show header images behind list rows <small class="muted">faded, on the right</small></label>
      <p class="muted small" style="margin-top:1rem">${icon('globe-hemisphere-west')} Each world’s background, noise and header edge are in its <b>World settings</b>.</p>
    </div>
    <div class="panel">
      <h2>Writing help</h2>
      <label class="check"><input type="checkbox" id="promptsToggle" ${promptsEnabled() ? 'checked' : ''}> Show writing prompts</label>
      <p class="muted small">A daily prompt on each world’s overview, and the Writing prompts page.</p>
      <label class="check"><input type="checkbox" id="guideToggle" ${guidanceEnabled() ? 'checked' : ''}> Show the writing guide in the editor</label>
      <p class="muted small">Questions to help fill out each template. Both settings apply to this device only.</p>
    </div>
    <div class="panel" id="filesCard">
      <h2>Files</h2>
      ${store.worlds().length ? `<div class="file-row">
        <div><b>Export a world</b><span class="muted small">One world, pictures and all, in a single .world file: to keep, share or open on another device.</span></div>
        <div class="toolbar"><select id="worldFileSel" aria-label="World to export">${store.worlds().map((w) => `<option value="${w.id}" ${w.id === state.wid ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
          <button class="btn primary" id="exportWorldFile">${icon('download-simple')} Export .world</button></div>
      </div>
      <div class="file-row">
        <div><b>Back up everything</b><span class="muted small">All your worlds in one backup file.</span></div>
        <button class="btn" id="exportBtn">${icon('download-simple')} Back up</button>
      </div>` : ''}
      <div class="file-row">
        <div><b>Open a file</b><span class="muted small">A .world file, a backup, or an import file. Anything you already have merges in: newer work is kept, and an article changed in both places goes to the merge manager.</span></div>
        <label class="btn">${icon('upload-simple')} Open a file<input type="file" id="openWorldFile" accept=".world,.json,.txt,application/x-worldatlas-world,application/zip,application/json,text/plain" hidden></label>
      </div>
    </div>
    <div class="panel" id="importCard">
      <h2>AI assistant</h2>
      <p class="muted">Turn notes into articles with an AI assistant: copy the instructions, give them to the assistant with your notes, then paste its reply. You’ll see a preview first.</p>
      <div class="actions left">
        <button class="btn" id="copyAiPrompt">${icon('feather')} Copy instructions</button>
        <button class="btn primary" id="pasteImport">${icon('file-text')} Paste reply</button>
        <a class="btn quiet" href="${DOCS_URL}" target="_blank" rel="noopener">${icon('arrow-square-out')} Format guide</a>
      </div>
      <label class="import-into" style="margin-top:1rem">Add to<select id="importInto">
        <option value="auto">The world named in the reply (or a new one)</option>
        ${store.worlds().map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}
        <option value="new">A new world</option>
      </select></label>
      ${store.worlds().length ? `<div class="field-label" style="margin-top:1.2rem">Give it a world to extend</div>
      <div class="toolbar" style="margin:0">
        <select id="exportWorldSel" aria-label="World">${store.worlds().map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
        <button class="btn small" id="copyWorldBtn">Copy as text</button>
        <button class="btn small quiet" id="exportWorldBtn">${icon('download-simple')} Download</button>
      </div>` : ''}
    </div>
    <p class="muted small center">Icons: Phosphor. Type: Cormorant Garamond, Alegreya.</p>
  </section>`;
  renderSyncCard();
  const seg = $('#themeSeg');
  const mark = () => { for (const b of seg.children) b.classList.toggle('on', b.dataset.t === (localStorage.getItem('wa.theme') || 'dark')); };
  seg.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    localStorage.setItem('wa.theme', b.dataset.t);
    applyTheme(); mark();
  };
  mark();
  $('#proseSize').addEventListener('input', (e) => { setProse({ size: +e.target.value }); e.target.nextElementSibling.textContent = e.target.value + '%'; });
  $('#proseWeight').addEventListener('input', (e) => {
    const [w, label] = PROSE_WEIGHTS[+e.target.value];
    setProse({ weight: w });
    e.target.nextElementSibling.textContent = label;
  });
  $('#rowPicsToggle').onchange = (e) => { try { localStorage.setItem('wa.rowPics', e.target.checked ? 'on' : 'off'); } catch { /* private mode */ } };
  $('#installBtn')?.addEventListener('click', () => state.promptInstall().then(() => state.route()));
  $('#promptsToggle').onchange = (e) => {
    setPromptsEnabled(e.target.checked);
    toast(e.target.checked ? 'Writing prompts shown' : 'Writing prompts hidden');
  };
  $('#guideToggle').onchange = (e) => {
    setGuidanceEnabled(e.target.checked);
    toast(e.target.checked ? 'Writing guide shown' : 'Writing guide hidden');
  };
  wireAbout();
  $('#exportBtn')?.addEventListener('click', exportBackup);
  $('#pasteImport').onclick = pasteDialog;
  $('#copyAiPrompt').onclick = () => copyText(aiInstructions(), 'Instructions copied');
  const sel = () => $('#exportWorldSel').value;
  const fileName = () => `${(store.world(sel())?.name || 'world').replace(/[^\w\- ]+/g, '').trim() || 'world'}.worldatlas.json`;
  $('#exportWorldBtn')?.addEventListener('click', () => download(fileName(), new Blob([JSON.stringify(exportSimple(sel()), null, 2)], { type: 'application/json' })));
  $('#copyWorldBtn')?.addEventListener('click', () => copyText(JSON.stringify(exportSimple(sel()), null, 2), 'World copied as import text'));
  $('#exportWorldFile')?.addEventListener('click', () => exportWorldFile($('#worldFileSel').value));
  $('#openWorldFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openWorldFile(f); };
}

// Sync: one panel. Choose a method, then set it up. A device uses one method
// at a time; picking another while one is on offers to switch. Add a method by
// adding it to SYNC_METHODS with a body(el) that draws and wires its setup.
const SYNC_METHODS = {
  onedrive: { label: 'OneDrive', icon: 'cloud-check', blurb: 'A private folder in your own OneDrive. Phones, tablets and computers.', body: oneDriveBody, stop: stopOneDrive },
  folder: { label: 'Custom folder', icon: 'folder', blurb: 'Sync through a folder of your choosing. Chrome or Edge on a computer.', body: folderBody, stop: () => sync.stopFolder() },
};
const syncPick = () => { try { const v = localStorage.getItem('wa.syncPick'); return SYNC_METHODS[v] ? v : null; } catch { return null; } };
const setSyncPick = (v) => { try { localStorage.setItem('wa.syncPick', v); } catch { /* storage blocked */ } };

export function renderSyncCard() {
  const el = $('#syncCard');
  if (!el) return;
  const active = sync.target();
  const pick = syncPick() || active || 'onedrive';
  el.innerHTML = `<h2>Sync</h2>
    <p class="muted small">Keep the same worlds on all your devices. Sync with:</p>
    <div class="seg sync-methods" role="radiogroup" aria-label="Sync method">${Object.entries(SYNC_METHODS).map(([k, m]) => `
      <button type="button" class="${k === pick ? 'on' : ''}" data-method="${k}" role="radio" aria-checked="${k === pick}"${k === active ? ' title="In use on this device"' : ''}>
        ${icon(m.icon)} ${m.label}${k === active ? '<span class="sync-dot" aria-label="(in use)"></span>' : ''}</button>`).join('')}</div>
    <p class="muted small sync-blurb">${SYNC_METHODS[pick].blurb}</p>
    <div class="sync-body" id="syncBody"></div>`;
  $('.sync-methods', el).onclick = (e) => {
    const b = e.target.closest('[data-method]');
    if (!b) return;
    setSyncPick(b.dataset.method);
    renderSyncCard();
  };
  const body = $('#syncBody', el);
  if (active && active !== pick) {
    // Another method is on: say so, and offer to switch.
    body.innerHTML = `<p>This device syncs with <b>${esc(sync.targetLabel())}</b>. To use ${esc(SYNC_METHODS[pick].label.replace(/^A /, 'a '))} instead, stop that first. Your worlds stay here, and in ${esc(sync.targetLabel())}.</p>
      <p><button class="btn" id="switchSync">${icon('arrows-clockwise')} Switch to ${esc(SYNC_METHODS[pick].label.replace(/^A /, 'a '))}</button></p>`;
    $('#switchSync', body).onclick = async () => {
      if (!(await confirmDialog(`Stop syncing with ${sync.targetLabel()} on this device? Your worlds stay here and there.`, 'Stop and switch', { danger: false }))) return;
      await SYNC_METHODS[active].stop();
      renderSyncCard();
    };
    return;
  }
  SYNC_METHODS[pick].body(body);
}
// Kept for callers that redraw the panel when sync's status changes.
export const renderOneDriveCard = renderSyncCard;
export const renderFolderCard = renderSyncCard;

async function stopOneDrive() {
  auth.signOut();
  await store.saveMeta({ eTags: {}, folders: {} });
  await store.resetSyncBase();
  sync.refreshStatus();
}

function oneDriveBody(el) {
  const st = sync.getStatus();
  const acct = auth.account();
  const cid = auth.clientId();
  let main;
  if (!cid) {
    main = `<p>Syncing uses a private folder in your OneDrive (<code>Apps/WorldAtlas</code>). It needs a one-time Microsoft app registration (<a href="https://github.com/Momijisu/WorldAtlas/blob/main/docs/SYNC.md" target="_blank" rel="noopener">how to set it up</a>). Paste its Application (client) ID below.</p>`;
  } else if (st.state === 'off') {
    main = `<p>Sign in with Microsoft to sync your worlds through <code>OneDrive/Apps/WorldAtlas</code>. WorldAtlas can reach only that folder.</p>
      <p><button class="btn primary" id="connectBtn">${icon('cloud-check')} Connect OneDrive</button></p>`;
  } else if (st.state === 'reauth') {
    main = `<p class="warn">${esc(st.message || 'Your OneDrive session expired.')}</p>
      <p><button class="btn primary" id="connectBtn">Reconnect OneDrive</button> <button class="btn quiet" id="disconnectBtn">Disconnect</button></p>`;
  } else {
    main = `<p>Connected as <b>${esc(acct?.name || '')}</b> <span class="muted">${esc(acct?.username || '')}</span></p>
      <p>Status: <b class="status-${st.state}">${esc({ synced: 'Up to date', syncing: 'Syncing…', pending: 'Changes waiting to upload', offline: 'Offline', error: 'Error' }[st.state] || st.state)}</b>
      <span class="muted">· last synced ${timeAgo(store.meta.lastSync)}</span></p>
      ${st.state === 'error' ? `<p class="warn">${esc(st.message)}</p>` : ''}
      <p><button class="btn primary" id="syncNowBtn">${icon('arrows-clockwise')} Sync now</button> <button class="btn quiet" id="disconnectBtn">Disconnect</button></p>`;
  }
  el.innerHTML = `${main}
    ${auth.builtInClientId ? '' : `<details ${cid ? '' : 'open'}><summary>Microsoft app registration</summary>
      <label>Application (client) ID<input id="cidInput" value="${esc(cid)}" placeholder="00000000-0000-0000-0000-000000000000"></label>
      <p class="small">Redirect URI to register (platform: <b>Single-page application</b>):<br><code class="copy">${esc(auth.redirectUri())}</code> <button class="btn small quiet" id="copyRuri">Copy</button></p>
      <button class="btn small" id="saveCid">Save client ID</button>
    </details>`}`;
  $('#connectBtn', el)?.addEventListener('click', () => auth.signIn().catch((e) => toast(e.message)));
  $('#syncNowBtn', el)?.addEventListener('click', () => sync.sync());
  $('#disconnectBtn', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog('Disconnect OneDrive on this device? Your worlds stay here and in OneDrive.', 'Disconnect'))) return;
    await stopOneDrive();
  });
  $('#saveCid', el)?.addEventListener('click', () => {
    auth.setClientId($('#cidInput', el).value);
    toast('Saved');
    sync.refreshStatus();
    renderSyncCard();
  });
  $('#copyRuri', el)?.addEventListener('click', () => navigator.clipboard?.writeText(auth.redirectUri()).then(() => toast('Copied')));
}

// A folder on this computer that another app keeps in step across devices.
function folderBody(el) {
  const st = sync.getStatus();
  const on = sync.target() === 'folder';
  let main;
  if (!sync.folderSupported()) {
    main = `<p>Keep your worlds in a folder on your PC, kept in step between your computers by any cloud storage you like.</p>
      <p class="muted small">This needs Chrome or Edge on a computer: other browsers and phones don’t let web pages use folders. Use OneDrive or backup files here.</p>`;
  } else if (!on) {
    main = `<ol class="small sync-steps"><li>Target a custom folder on your PC, or in your preferred cloud storage.</li>
        <li>Choose it below, and allow WorldAtlas to use it.</li><li>Do the same on your other computers, with the same folder.</li></ol>
      <p class="muted small">Your cloud storage carries the files between your computers. WorldAtlas only reads and writes the folder, and never sees your account.</p>
      <p><button class="btn primary" id="chooseFolderBtn">${icon('folder')} Choose folder</button></p>`;
  } else if (st.state === 'reauth') {
    main = `<p>Syncing with the folder <b>${esc(sync.folderName())}</b>.</p><p class="warn">${esc(st.message)}</p>
      <p><button class="btn primary" id="allowFolderBtn">Allow access</button> <button class="btn quiet" id="stopFolderBtn">Stop folder sync</button></p>`;
  } else {
    main = `<p>Syncing with the folder <b>${esc(sync.folderName())}</b> on this computer.</p>
      <p>Status: <b class="status-${st.state}">${esc({ synced: 'Up to date', syncing: 'Syncing…', pending: 'Changes waiting to save', error: 'Error' }[st.state] || st.state)}</b>
      <span class="muted">· last synced ${timeAgo(store.meta.lastSync)}</span></p>
      ${st.state === 'error' ? `<p class="warn">${esc(st.message)}</p>` : ''}
      <p><button class="btn primary" id="syncFolderNow">${icon('arrows-clockwise')} Sync now</button> <button class="btn quiet" id="chooseFolderBtn">Choose another folder</button> <button class="btn quiet" id="stopFolderBtn">Stop folder sync</button></p>
      <p class="muted small">How quickly changes reach your other computers depends on the app that syncs the folder.</p>`;
  }
  el.innerHTML = main;
  $('#chooseFolderBtn', el)?.addEventListener('click', async () => {
    try { if (!(await sync.chooseFolder())) toast('WorldAtlas needs permission to use that folder'); } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
    renderSyncCard();
  });
  $('#allowFolderBtn', el)?.addEventListener('click', async () => { if (!(await sync.allowFolder())) toast('Access not allowed'); renderSyncCard(); });
  $('#syncFolderNow', el)?.addEventListener('click', () => sync.sync());
  $('#stopFolderBtn', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Stop syncing with “${sync.folderName()}” on this device? Your worlds stay here and in the folder.`, 'Stop', { danger: false }))) return;
    await sync.stopFolder();
    renderSyncCard();
  });
}

// .world files (js/worldfile.js).
export async function exportWorldFile(wid) {
  try {
    const { blob, name } = await exportWorld(wid);
    download(name, blob);
  } catch (e) { toast('Couldn’t export the world: ' + e.message, 6000); }
}
export async function openWorldFile(file) {
  try {
    // A JSON or text file picked by mistake: hand it to the text importer.
    if (!(await isZip(file))) return handleImportText(await file.text(), 'auto');
    const r = await importWorld(file);
    toast(`${r.added ? 'Added' : 'Merged in'} “${r.name}”${r.clashes ? `. ${r.clashes} article${r.clashes === 1 ? ' was' : 's were'} changed in both places: see “Conflicts to resolve” in the sidebar` : ''}.`, r.clashes ? 8000 : 4000);
    location.hash = `#/w/${r.wid}`;
  } catch (e) { toast('Couldn’t open that file: ' + e.message, 6000); }
}

async function exportBackup() {
  const out = { app: 'WorldAtlas', version: 2, exportedAt: new Date().toISOString(), images: [] };
  for (const s of ['worlds', 'articles', 'maps', 'history']) out[s] = [...store.data[s].values()];
  for (const id of await store.imageIds()) {
    const rec = await store.getImage(id);
    out.images.push({ id, type: rec.type, data: await blobToDataURL(rec.blob) });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(`worldatlas-backup-${stamp}.json`, new Blob([JSON.stringify(out)], { type: 'application/json' }));
}

async function importBackupJSON(text) {
  try {
    const json = typeof text === 'string' ? JSON.parse(text) : text;
    if (json.app !== 'WorldAtlas') throw new Error('Not a WorldAtlas backup');
    const have = new Set(await store.imageIds());
    for (const img of json.images || []) {
      if (!have.has(img.id)) await store.putImage({ id: img.id, type: img.type, blob: await dataURLToBlob(img.data), uploaded: false });
    }
    // Articles changed both here and in the file go to the merge manager.
    const flagged = () => [...store.data.articles.values()].filter((a) => a.conflict && !a.deleted).length;
    const before = flagged();
    await store.mergeRecords(json, { history: json.history || [] });
    const clashes = flagged() - before;
    await store.mergeHistory(json.history || []);
    await store.saveMeta({ localRev: store.meta.localRev + 1 });
    sync.sync();
    toast(clashes ? `Backup imported. ${clashes} article${clashes === 1 ? ' was' : 's were'} changed in both places: open “Conflicts to resolve” in the sidebar to choose what to keep.` : 'Backup imported', clashes ? 7000 : 2600);
    state.route();
  } catch (e) {
    toast('Import failed: ' + e.message, 5000);
  }
}

// ---------------------------------------------------------------- version & updates

async function showNotes() {
  const el = $('#updNotes');
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';
  const html = await whatsNewHTML();
  if (!html) { delete el.dataset.loaded; return; }
  el.innerHTML = html;
  el.hidden = false;
}

async function wireAbout() {
  const running = self.WA_VERSION;
  const cacheEl = $('#cacheVer');
  const showCache = async (retry) => {
    try {
      const keys = (await caches.keys()).filter((k) => k.startsWith('worldatlas-'));
      const cached = keys.map((k) => k.slice('worldatlas-'.length));
      cacheEl.textContent = !keys.length ? 'downloading for offline use…'
        : cached.includes(running) ? `${running} · matches` : `${cached.join(', ')} · updating to ${running}…`;
      // On a first visit the cache is still being filled; look again once it's ready.
      if (retry && (!keys.length || !cached.includes(running))) {
        navigator.serviceWorker?.ready.then(() => setTimeout(() => { if (cacheEl.isConnected) showCache(false); }, 1500));
      }
    } catch { cacheEl.textContent = 'unavailable in this browser'; }
  };
  showCache(true);

  const latestEl = $('#latestVer');
  const check = async () => {
    latestEl.textContent = 'checking…';
    try {
      const text = await (await fetch(`js/version.js?check=${Date.now()}`, { cache: 'no-store' })).text();
      const latest = text.match(/WA_VERSION\s*=\s*'([^']+)'/)?.[1];
      if (!latest) throw new Error('unreadable');
      const behind = latest !== running;
      latestEl.innerHTML = behind ? `<b class="warn">${esc(latest)}</b> · an update is available` : `${esc(latest)} · you’re up to date`;
      $('#doUpd').hidden = !behind;
      if (behind) showNotes();
    } catch {
      latestEl.textContent = navigator.onLine ? 'couldn’t check right now' : 'offline: connect to check';
    }
  };
  $('#checkUpd').onclick = check;
  if (state.updateWaiting?.()) { latestEl.innerHTML = '<b class="warn">An update is ready</b>'; $('#doUpd').hidden = false; showNotes(); }
  $('#doUpd').onclick = async () => {
    $('#doUpd').disabled = true;
    $('#doUpd').textContent = 'Updating…';
    if (state.updateWaiting?.()) { state.applyUpdate(); return; }
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    // The new version takes over and the page reloads itself; reload anyway if that takes too long.
    setTimeout(() => location.reload(), 6000);
  };
  $('#resetCache').onclick = async () => {
    if (!(await confirmDialog('Clear the app’s downloaded files and reload? Your worlds, images and settings stay.', 'Reset and reload', { title: 'Reset offline cache', danger: false }))) return;
    try {
      for (const k of await caches.keys()) if (k.startsWith('worldatlas-')) await caches.delete(k);
      for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    } catch { /* ignore */ }
    location.reload();
  };
  if (navigator.onLine) check();
}

// ---------------------------------------------------------------- simple import

const DOCS_URL = 'https://github.com/Momijisu/WorldAtlas/blob/main/docs/IMPORT_FORMAT.md';

function aiInstructions() {
  return `Convert my worldbuilding material into the WorldAtlas import format: ${DOCS_URL}

Reply with only a JSON object shaped like this:
{
  "format": "worldatlas-import", "version": 1,
  "world": { "name": "...", "description": "...", "calendar": { "months": [{"name": "...", "days": 30}], "weekdays": ["..."], "eras": [{"name": "...", "abbr": "...", "start": 0}], "moons": [{"name": "...", "cycle": 30}], "currentYear": 1043 } },
  "articles": [
    { "title": "...", "type": "character|species|culture|profession|title|location|settlement|building|organization|religion|event|conflict|plot|myth|spell|law|condition|technology|item|vehicle|material|tradition|language|lore|article",
      "aliases": ["other names it goes by"], "summary": "one or two lines", "body": "Markdown, with [[Other Article Title]] links",
      "parent": "Title of the article this belongs to", "tags": ["..."],
      "fields": { "Type": "what kind of thing it is, e.g. Ruin, Port town, Guild", "Occupation": "for characters" },
      "date": "12 Frostmoot 1042", "endDate": "1060",
      "relationships": [{ "type": "parent|child|spouse|sibling|partner|friend|ally|mentor|student|rival|enemy|member|leader|rules|serves|worships|created|owns|locatedIn|related", "target": "Other Article Title", "note": "optional" }],
      "secrets": "GM-only notes" }
  ]
}

Rules:
- Use unique titles, and the exact title in [[links]], "parent" and "target".
- To show a section of another article inside this one, put ![[Title#Heading]] on its own line (![[Title]] shows its summary) instead of repeating the text.
- Put rumours, warnings and asides in callouts: a line "> [!note] Optional title" (or tip, info, important, warning, danger, quote) followed by "> text" lines.
- List other names an article goes by in "aliases".
- Leave out "calendar" if my world has no custom calendar. Dates use its month names; a bare year is fine.
- Only use facts from my material. Put anything uncertain in "secrets".
- Split large topics into several linked articles.
- Use the most specific type: settlement (towns, cities) and building (castles, ruins, temples) are kinds of location; conflict (wars, battles, feuds) is a kind of event.
- Fill the "Type" field (a character's "Occupation") with a short label; lists show it next to the title.
- Put letters, notes and inscriptions in the body as a handwritten block: a line ":::cursive" (or ":::print"), the text, then a line ":::".
- A place's position: use "locatedIn" relationships (e.g. a town locatedIn its province), or "parent" to file it under that article.

Here is my material:
`;
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { modal('Copy this text', `<textarea rows="14" readonly style="width:100%">${esc(text)}</textarea>`, { onMount: (el) => $('textarea', el).select() }); }
}

function pasteDialog() {
  modal('Paste import text', `<form class="form" id="pf">
      <label>Paste an import or backup<textarea name="t" rows="12" required placeholder='{ "format": "worldatlas-import", … }' style="font-family:var(--mono);font-size:.85rem"></textarea></label>
      <div class="actions"><button class="btn primary">Preview import</button></div>
    </form>`, {
    wide: true,
    onMount: (el, close) => {
      $('#pf', el).onsubmit = (e) => { e.preventDefault(); const t = e.target.t.value; close(); handleImportText(t, $('#importInto')?.value); };
    },
  });
}

// Accepts raw JSON, JSON wrapped in a Markdown code fence, or a full backup.
// into: 'auto' (the world named in the file), 'new', or a world id.
function handleImportText(text, into = 'auto') {
  let json;
  // Plain JSON first (backups and import files, which may hold ``` fences in
  // their articles); then a reply wrapped in a code fence, or with text around it.
  try { json = JSON.parse(text.trim()); } catch { /* not plain JSON */ }
  if (json) {
    if (json.app === 'WorldAtlas') return importBackupJSON(json);
    if (!isImportFormat(json)) return toast('No articles found in that text.', 5000);
    return previewImport(json, into);
  }
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = (fenced ? fenced[1] : text).trim();
    const start = body.indexOf('{');
    json = JSON.parse(start > 0 ? body.slice(start, body.lastIndexOf('}') + 1) : body);
  } catch (e) {
    return toast('Not valid import text: ' + e.message, 6000);
  }
  if (json.app === 'WorldAtlas') return importBackupJSON(json);
  if (!isImportFormat(json)) return toast('No articles found in that text.', 5000);
  previewImport(json, into);
}

// "Adds 3 articles and updates 1 in this world; 2 already up to date."
function importSummary(plan, existing) {
  const arts = (k) => `${k} article${k === 1 ? '' : 's'}`;
  const parts = [];
  if (plan.create) parts.push(`adds ${arts(plan.create)}`);
  if (plan.update) parts.push(`updates ${plan.create ? plan.update : arts(plan.update)}`);
  let t = parts.length ? parts.join(' and ') + (existing ? ' in this world' : '') : 'nothing new to add';
  if (plan.same) t += `; ${plan.same} already up to date`;
  return t[0].toUpperCase() + t.slice(1) + '.';
}

function previewImport(json, into = 'auto') {
  const name = String(json.world?.name || '').trim();
  const sameName = store.worlds().find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
  let target = into === 'new' ? '' : into !== 'auto' && store.world(into) ? into : sameName?.id || '';
  modal('Import preview', '<div id="ipv"></div>', {
    wide: true,
    onMount: (el, close) => {
      const draw = () => {
        let plan;
        try { plan = planImport(json, target || null); } catch (e) { $('#ipv', el).innerHTML = `<p class="warn">Couldn’t read this import: ${esc(e.message)}</p>`; return; }
        const w = plan.warnings;
        const destName = target ? store.world(target).name : (plan.isNewWorld ? plan.world.name : name || 'Imported world');
        const n = plan.create + plan.update;
        $('#ipv', el).innerHTML = `
          <div class="import-dest">${icon('globe-hemisphere-west')}<div>
            <div class="eyebrow">${target ? 'Importing into' : 'Importing into a new world'}</div>
            <div class="import-dest-name">${esc(destName)}</div>
            <div class="small muted">${importSummary(plan, !!target)}</div>
          </div></div>
          <label>Change where it goes<select id="ipTarget">
            <option value="">A new world: ${esc(plan.isNewWorld ? plan.world.name : name || 'Imported world')}</option>
            ${store.worlds().map((x) => `<option value="${x.id}" ${x.id === target ? 'selected' : ''}>Existing world: ${esc(x.name)}</option>`).join('')}
          </select></label>
          <div class="import-stats">
            <div><b>${plan.create}</b><span>new</span></div>
            <div><b>${plan.update}</b><span>updated</span></div>
            <div><b>${plan.same}</b><span>unchanged</span></div>
          </div>
          <div class="chips">${Object.entries(plan.counts).map(([t, n]) => `<span class="chip">${icon(TYPES[t]?.icon)} ${n} ${esc((n === 1 ? TYPES[t]?.label : TYPES[t]?.plural) || t)}</span>`).join('')}</div>
          ${json.world?.calendar ? `<p class="small muted">${icon('calendar-blank')} ${plan.isNewWorld ? 'Includes a custom calendar.' : 'Replaces this world’s calendar.'}</p>` : ''}
          ${w.length ? `<details class="import-warnings" ${w.length <= 6 ? 'open' : ''}><summary>${icon('warning')} ${w.length} warning${w.length === 1 ? '' : 's'}</summary><ul>${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`
            : `<p class="small" style="color:var(--ok)">${icon('check')} No problems found.</p>`}
          <p class="small muted">Updates can be undone from each article’s History.</p>
          <div class="actions">
            <button class="btn quiet" data-cancel>Cancel</button>
            <button class="btn primary" id="ipGo" ${n ? '' : 'disabled'}>${icon('check')} Import ${n} article${n === 1 ? '' : 's'} into ${esc(destName)}</button>
          </div>`;
        $('#ipTarget', el).onchange = (e) => { target = e.target.value; draw(); };
        $('[data-cancel]', el).onclick = () => close();
        $('#ipGo', el).onclick = async (e) => {
          const btn = e.currentTarget;
          const label = btn.innerHTML;
          btn.disabled = true;
          btn.textContent = 'Importing…';
          let result;
          try { result = await applyImport(plan); } catch (err) {
            console.error(err);
            toast('Import failed: ' + (err.message || err), 6000);
            btn.disabled = false; btn.innerHTML = label;
            return;
          }
          const { wid, failedImages } = result;
          const n = plan.create + plan.update;
          close();
          toast(failedImages.length ? `Imported. ${failedImages.length} image${failedImages.length === 1 ? '' : 's'} couldn’t be downloaded.` : `Imported ${n} article${n === 1 ? '' : 's'} into ${plan.world.name}`, 5000);
          location.hash = `#/w/${wid}`;
        };
      };
      draw();
    },
  });
}
