// Settings: OneDrive sync, installing the app, backups and appearance.
import * as store from '../store.js';
import * as auth from '../auth.js';
import * as sync from '../sync.js';
import { $, esc, toast, confirmDialog, timeAgo, blobToDataURL, dataURLToBlob, download } from '../util.js';
import { view, state, setTitle, pageHead, icon } from '../ui.js';
import { promptsEnabled, setPromptsEnabled } from '../prompts.js';

export function applyTheme() {
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
  view.innerHTML = `<section class="page narrow settings">
    ${pageHead({ eyebrow: 'WorldAtlas', title: 'Settings &amp; sync' })}
    <div class="panel" id="oneDriveCard"></div>
    <div class="panel">
      <h2>Install the app</h2>
      ${standalone ? `<p>${icon('check')} You are using the installed app.</p>` : `
        ${state.installPrompt ? `<p><button class="btn primary" id="installBtn">${icon('download-simple')} Install WorldAtlas</button></p>` : ''}
        <p class="muted">${ios
          ? `On iPhone/iPad: tap <b>Share</b> ${edge ? '(in Edge: menu ⋯ → <b>Share</b>)' : ''} → <b>Add to Home Screen</b>. This needs iOS 16.4 or later in Edge/Chrome; on older iOS, use Safari.`
          : android && edge
            ? 'In Edge on Android: tap the menu <b>⋯</b> at the bottom of the screen → <b>Add to phone</b> (on some versions: <b>Install app</b> or <b>Add to Home screen</b>). If it isn’t listed, reload the page once and try again.'
            : android
              ? 'On Android (Chrome): menu ⋮ → <b>Install app</b> / <b>Add to Home screen</b>.'
              : 'On PC (Edge or Chrome): click the install icon at the right of the address bar, or menu → <b>Apps</b> → <b>Install WorldAtlas</b>.'}</p>`}
      <p class="muted small">The app works offline. Everything is saved on the device first and synced to OneDrive whenever you’re online.</p>
    </div>
    <div class="panel">
      <h2>Appearance</h2>
      <div class="seg" id="themeSeg">
        <button data-t="dark">${icon('moon-stars')} Nocturne</button>
        <button data-t="light">${icon('sun')} Vellum</button>
        <button data-t="auto">Match device</button>
      </div>
    </div>
    <div class="panel">
      <h2>Writing prompts</h2>
      <label class="check"><input type="checkbox" id="promptsToggle" ${promptsEnabled() ? 'checked' : ''}> Show writing prompts</label>
      <p class="muted small">Shows a daily prompt on each world’s overview and a “Writing prompts” link in the sidebar. Turning this off hides them on this device; your answered prompts and articles are kept.</p>
    </div>
    <div class="panel">
      <h2>Backup</h2>
      <p class="muted">Download everything — worlds, articles, maps, images and revision history — as a single file, or merge a backup back in.</p>
      <div class="actions left">
        <button class="btn" id="exportBtn">${icon('download-simple')} Export backup</button>
        <label class="btn">${icon('upload-simple')} Import backup<input type="file" id="importFile" accept=".json,application/json" hidden></label>
      </div>
    </div>
    <p class="muted small center">Your worlds live on your devices and in your own OneDrive.<br>Icons by Phosphor · Type: Cormorant Garamond, Alegreya.</p>
  </section>`;
  renderOneDriveCard();
  const seg = $('#themeSeg');
  const mark = () => { for (const b of seg.children) b.classList.toggle('on', b.dataset.t === (localStorage.getItem('wa.theme') || 'dark')); };
  seg.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    localStorage.setItem('wa.theme', b.dataset.t);
    applyTheme(); mark();
  };
  mark();
  $('#installBtn')?.addEventListener('click', () => state.promptInstall().then(() => state.route()));
  $('#promptsToggle').onchange = (e) => {
    setPromptsEnabled(e.target.checked);
    toast(e.target.checked ? 'Writing prompts shown' : 'Writing prompts hidden');
  };
  $('#exportBtn').onclick = exportBackup;
  $('#importFile').onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
}

export function renderOneDriveCard() {
  const el = $('#oneDriveCard');
  if (!el) return;
  const st = sync.getStatus();
  const acct = auth.account();
  const cid = auth.clientId();
  let main;
  if (!cid) {
    main = `<p>To sync between your phone and PC, WorldAtlas saves to a private folder in <b>your</b> OneDrive (<code>Apps/WorldAtlas</code>). This needs a one-time app registration with Microsoft — see the README — then paste the Application (client) ID below.</p>`;
  } else if (st.state === 'off') {
    main = `<p>Sign in with your Microsoft account. Your worlds are stored in <code>OneDrive/Apps/WorldAtlas</code> and kept in step on every device you connect.</p>
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
  el.innerHTML = `<h2>OneDrive sync</h2>${main}
    <details ${cid ? '' : 'open'}><summary>Microsoft app registration</summary>
      <label>Application (client) ID<input id="cidInput" value="${esc(cid)}" placeholder="00000000-0000-0000-0000-000000000000"></label>
      <p class="small">Redirect URI to register (platform: <b>Single-page application</b>):<br><code class="copy">${esc(auth.redirectUri())}</code> <button class="btn small quiet" id="copyRuri">Copy</button></p>
      <button class="btn small" id="saveCid">Save client ID</button>
    </details>`;
  $('#connectBtn')?.addEventListener('click', () => auth.signIn().catch((e) => toast(e.message)));
  $('#syncNowBtn')?.addEventListener('click', () => sync.sync());
  $('#disconnectBtn')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Disconnect OneDrive on this device? Your worlds stay on this device and in OneDrive.', 'Disconnect'))) return;
    auth.signOut();
    await store.saveMeta({ eTags: {} });
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
  const out = { app: 'WorldAtlas', version: 2, exportedAt: new Date().toISOString(), images: [] };
  for (const s of ['worlds', 'articles', 'maps', 'history']) out[s] = [...store.data[s].values()];
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
    await store.mergeHistory(json.history || []);
    await store.saveMeta({ localRev: store.meta.localRev + 1 });
    sync.sync();
    toast('Backup imported');
    state.route();
  } catch (e) {
    toast('Import failed: ' + e.message, 5000);
  }
}
