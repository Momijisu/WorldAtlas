// Settings: OneDrive sync, installing the app, backups and appearance.
import * as store from '../store.js';
import * as auth from '../auth.js';
import * as sync from '../sync.js';
import { $, esc, toast, modal, confirmDialog, timeAgo, blobToDataURL, dataURLToBlob, download } from '../util.js';
import { view, state, setTitle, pageHead, icon } from '../ui.js';
import { planImport, applyImport, isImportFormat, exportSimple } from '../importer.js';
import { TYPES } from '../store.js';
import { promptsEnabled, setPromptsEnabled } from '../prompts.js';
import { guidanceEnabled, setGuidanceEnabled } from '../guidance.js';

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
      <h2>Writing help</h2>
      <label class="check"><input type="checkbox" id="promptsToggle" ${promptsEnabled() ? 'checked' : ''}> Show writing prompts</label>
      <p class="muted small">A daily prompt on each world’s overview and a “Writing prompts” link in the sidebar. Turning this off hides them; your answered prompts and articles are kept.</p>
      <label class="check"><input type="checkbox" id="guideToggle" ${guidanceEnabled() ? 'checked' : ''}> Show the writing guide in the editor</label>
      <p class="muted small">Guiding questions for each template (appearance, motivation, history…). These settings apply to this device.</p>
    </div>
    <div class="panel" id="importCard">
      <h2>Import a world</h2>
      <p class="muted">Bring in a world written in the simple WorldAtlas import format, for example one an AI assistant has prepared from your notes. You’ll see a preview before anything is saved, and importing again updates articles with the same titles instead of duplicating them.</p>
      <div class="actions left">
        <label class="btn primary">${icon('upload-simple')} Import from file<input type="file" id="importWorldFile" accept=".json,.txt,application/json,text/plain" hidden></label>
        <button class="btn" id="pasteImport">${icon('file-text')} Paste text</button>
      </div>
      <div class="field-label" style="margin-top:1.2rem">Working with an AI assistant</div>
      <p class="muted small">Copy these instructions into an assistant such as Claude, along with your notes, documents or an exported world. It will reply with text you can paste or import here.</p>
      <div class="actions left">
        <button class="btn small" id="copyAiPrompt">${icon('feather')} Copy instructions for an assistant</button>
        <a class="btn small quiet" href="${DOCS_URL}" target="_blank" rel="noopener">${icon('arrow-square-out')} Format guide</a>
      </div>
      ${store.worlds().length ? `<div class="field-label" style="margin-top:1.2rem">Export a world in this format</div>
      <p class="muted small">Useful for asking an assistant to extend or tidy an existing world, then importing the result.</p>
      <div class="toolbar" style="margin:0">
        <select id="exportWorldSel">${store.worlds().map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
        <button class="btn small" id="exportWorldBtn">${icon('download-simple')} Download</button>
        <button class="btn small quiet" id="copyWorldBtn">Copy</button>
      </div>` : ''}
    </div>
    <div class="panel">
      <h2>Backup</h2>
      <p class="muted">Download everything — worlds, articles, maps, images and revision history — as a single file, or merge a backup back in.</p>
      <div class="actions left">
        <button class="btn" id="exportBtn">${icon('download-simple')} Export backup</button>
        <label class="btn">${icon('upload-simple')} Import backup<input type="file" id="importFile" accept=".json,application/json" hidden></label>
      </div>
    </div>
    <div class="panel" id="aboutCard">
      <h2>About this app</h2>
      <dl class="about-list">
        <dt>Version</dt><dd><b>${esc(self.WA_VERSION || '?')}</b> <span class="muted">· built ${esc(self.WA_BUILD || '?')}</span></dd>
        <dt>Offline cache</dt><dd id="cacheVer" class="muted">checking…</dd>
        <dt>Latest online</dt><dd id="latestVer" class="muted">—</dd>
      </dl>
      <div class="actions left">
        <button class="btn" id="checkUpd">${icon('arrows-clockwise')} Check for updates</button>
        <button class="btn primary" id="doUpd" hidden>${icon('download-simple')} Update now</button>
        <button class="btn quiet" id="resetCache" title="Clears downloaded app files only. Your worlds are not affected.">Reset offline cache</button>
      </div>
      <p class="muted small">If the app looks out of date, check for updates. Resetting the offline cache re-downloads the app’s files; your worlds and settings are not affected.</p>
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
  $('#guideToggle').onchange = (e) => {
    setGuidanceEnabled(e.target.checked);
    toast(e.target.checked ? 'Writing guide shown' : 'Writing guide hidden');
  };
  wireAbout();
  $('#exportBtn').onclick = exportBackup;
  $('#importFile').onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
  $('#importWorldFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) handleImportText(await f.text()); };
  $('#pasteImport').onclick = pasteDialog;
  $('#copyAiPrompt').onclick = () => copyText(aiInstructions(), 'Instructions copied — paste them into your assistant');
  const sel = () => $('#exportWorldSel').value;
  const fileName = () => `${(store.world(sel())?.name || 'world').replace(/[^\w\- ]+/g, '').trim() || 'world'}.worldatlas.json`;
  $('#exportWorldBtn')?.addEventListener('click', () => download(fileName(), new Blob([JSON.stringify(exportSimple(sel()), null, 2)], { type: 'application/json' })));
  $('#copyWorldBtn')?.addEventListener('click', () => copyText(JSON.stringify(exportSimple(sel()), null, 2), 'World copied as import text'));
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
  return importBackupJSON(await file.text());
}

async function importBackupJSON(text) {
  try {
    const json = typeof text === 'string' ? JSON.parse(text) : text;
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

// ---------------------------------------------------------------- version & updates

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
    } catch {
      latestEl.textContent = navigator.onLine ? 'couldn’t check right now' : 'offline: connect to check';
    }
  };
  $('#checkUpd').onclick = check;
  $('#doUpd').onclick = async () => {
    $('#doUpd').disabled = true;
    $('#doUpd').textContent = 'Updating…';
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    // The new version takes over and the page reloads itself; reload anyway if that takes too long.
    setTimeout(() => location.reload(), 6000);
  };
  $('#resetCache').onclick = async () => {
    if (!(await confirmDialog('Clear the app’s downloaded files and reload? Your worlds, images and settings stay safe on this device.', 'Reset and reload', { title: 'Reset offline cache', danger: false }))) return;
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
  return `Please convert my worldbuilding material into the WorldAtlas import format, so I can paste it into the WorldAtlas app.

The format is described here: ${DOCS_URL}
In short: reply with a single JSON object (no commentary), shaped like this:
{
  "format": "worldatlas-import", "version": 1,
  "world": { "name": "...", "description": "...", "calendar": { "months": [{"name": "...", "days": 30}], "weekdays": ["..."], "eras": [{"name": "...", "abbr": "...", "start": 0}], "moons": [{"name": "...", "cycle": 30}], "currentYear": 1043 } },
  "articles": [
    { "title": "...", "type": "character|location|organization|species|item|event|religion|culture|lore|article",
      "summary": "one or two lines", "body": "Markdown, with [[Other Article Title]] links",
      "parent": "Title of the article this belongs to", "tags": ["..."],
      "fields": { "Species": "...", "Occupation": "..." },
      "date": "12 Frostmoot 1042", "endDate": "1060",
      "relationships": [{ "type": "parent|child|spouse|sibling|partner|friend|ally|mentor|student|rival|enemy|member|leader|rules|serves|worships|created|owns|related", "target": "Other Article Title", "note": "optional" }],
      "secrets": "GM-only notes" }
  ]
}

Rules:
- Use exact article titles when linking ([[Title]]), in "parent" and in relationship "target"; every title must be unique.
- Leave out the calendar if my world doesn't have a custom one. Dates use that calendar's month names; a bare year is fine.
- Only include facts from my material; don't invent details. Put anything uncertain in "secrets" with a note.
- Split large topics into separate linked articles rather than one huge article.

Here is my material:
`;
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { modal('Copy this text', `<textarea rows="14" readonly style="width:100%">${esc(text)}</textarea>`, { onMount: (el) => $('textarea', el).select() }); }
}

function pasteDialog() {
  modal('Paste import text', `<form class="form" id="pf">
      <label>Paste the text your assistant produced (or a WorldAtlas backup)<textarea name="t" rows="12" required placeholder='{ "format": "worldatlas-import", … }' style="font-family:var(--mono);font-size:.85rem"></textarea></label>
      <div class="actions"><button class="btn primary">Preview import</button></div>
    </form>`, {
    wide: true,
    onMount: (el, close) => {
      $('#pf', el).onsubmit = (e) => { e.preventDefault(); const t = e.target.t.value; close(); handleImportText(t); };
    },
  });
}

// Accepts raw JSON, JSON wrapped in a Markdown code fence, or a full backup.
function handleImportText(text) {
  let json;
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = (fenced ? fenced[1] : text).trim();
    const start = body.indexOf('{');
    json = JSON.parse(start > 0 ? body.slice(start, body.lastIndexOf('}') + 1) : body);
  } catch (e) {
    return toast('That isn’t valid import text: ' + e.message, 6000);
  }
  if (json.app === 'WorldAtlas') return importBackupJSON(json);
  if (!isImportFormat(json)) return toast('No world or articles found in that text.', 5000);
  previewImport(json);
}

function previewImport(json) {
  const name = String(json.world?.name || '').trim();
  const sameName = store.worlds().find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
  let target = sameName?.id || '';
  modal('Import preview', '<div id="ipv"></div>', {
    wide: true,
    onMount: (el, close) => {
      const draw = () => {
        let plan;
        try { plan = planImport(json, target || null); } catch (e) { $('#ipv', el).innerHTML = `<p class="warn">Couldn’t read this import: ${esc(e.message)}</p>`; return; }
        const w = plan.warnings;
        $('#ipv', el).innerHTML = `
          <label>Import into<select id="ipTarget">
            <option value="">A new world: ${esc(plan.isNewWorld ? plan.world.name : name || 'Imported world')}</option>
            ${store.worlds().map((x) => `<option value="${x.id}" ${x.id === target ? 'selected' : ''}>Existing world: ${esc(x.name)}</option>`).join('')}
          </select></label>
          <div class="import-stats">
            <div><b>${plan.create}</b><span>new</span></div>
            <div><b>${plan.update}</b><span>updated</span></div>
            <div><b>${plan.same}</b><span>unchanged</span></div>
          </div>
          <div class="chips">${Object.entries(plan.counts).map(([t, n]) => `<span class="chip">${icon(TYPES[t]?.icon)} ${n} ${esc((n === 1 ? TYPES[t]?.label : TYPES[t]?.plural) || t)}</span>`).join('')}</div>
          ${json.world?.calendar ? `<p class="small muted">${icon('calendar-blank')} ${plan.isNewWorld ? 'Includes a custom calendar.' : 'The world’s calendar will be replaced by the one in this import.'}</p>` : ''}
          ${w.length ? `<details class="import-warnings" ${w.length <= 6 ? 'open' : ''}><summary>${icon('warning')} ${w.length} thing${w.length === 1 ? '' : 's'} to check</summary><ul>${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`
            : `<p class="small" style="color:var(--ok)">${icon('check')} Everything matched up.</p>`}
          <p class="small muted">Imported articles get normal revision history, so any update can be undone from an article’s History.</p>
          <div class="actions">
            <button class="btn quiet" data-cancel>Cancel</button>
            <button class="btn primary" id="ipGo" ${plan.create + plan.update ? '' : 'disabled'}>${icon('check')} Import ${plan.create + plan.update} article${plan.create + plan.update === 1 ? '' : 's'}</button>
          </div>`;
        $('#ipTarget', el).onchange = (e) => { target = e.target.value; draw(); };
        $('[data-cancel]', el).onclick = () => close();
        $('#ipGo', el).onclick = async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Importing…';
          const { wid, failedImages } = await applyImport(plan);
          close();
          toast(failedImages.length ? `Imported. ${failedImages.length} image${failedImages.length === 1 ? '' : 's'} couldn’t be downloaded.` : `Imported ${plan.create + plan.update} articles into ${plan.world.name}`, 5000);
          location.hash = `#/w/${wid}`;
        };
      };
      draw();
    },
  });
}
