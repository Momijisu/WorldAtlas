// Settings: OneDrive sync, installing the app, backups and appearance.
import * as store from '../store.js';
import * as auth from '../auth.js';
import * as sync from '../sync.js';
import { $, esc, toast, modal, confirmDialog, timeAgo, blobToDataURL, dataURLToBlob, download, prepareImage } from '../util.js';
import { view, state, setTitle, pageHead, icon } from '../ui.js';
import { planImport, applyImport, isImportFormat, exportSimple } from '../importer.js';
import { TYPES } from '../store.js';
import { promptsEnabled, setPromptsEnabled } from '../prompts.js';
import { guidanceEnabled, setGuidanceEnabled } from '../guidance.js';
import { pickerHTML, wirePicker, deviceDefault, setDeviceDefault, applyBackground, noiseLevel, setNoise, applyNoise, NOISE_DEFAULT } from '../backgrounds.js';

export function applyTheme() {
  applyNoise();
  document.documentElement.dataset.weight = localStorage.getItem('wa.weight') || 'regular';
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
      ${standalone ? `<p>${icon('check')} You’re using the installed app.</p>` : `
        ${state.installPrompt ? `<p><button class="btn primary" id="installBtn">${icon('download-simple')} Install WorldAtlas</button></p>` : ''}
        <p class="muted">${ios
          ? `Tap <b>Share</b>${edge ? ' (in Edge, menu ⋯ → Share)' : ''} → <b>Add to Home Screen</b>. Before iOS 16.4, use Safari.`
          : android && edge
            ? 'Menu <b>⋯</b> → <b>Add to phone</b> (or <b>Install app</b>). If it’s missing, reload and try again.'
            : android
              ? 'Menu ⋮ → <b>Install app</b>.'
              : 'Use the install icon in the address bar, or menu → <b>Apps</b> → <b>Install WorldAtlas</b>.'}</p>`}
      <p class="muted small">Works offline. Changes sync to OneDrive when you’re online.</p>
    </div>
    <div class="panel">
      <h2>Appearance</h2>
      <div class="seg" id="themeSeg">
        <button data-t="dark">${icon('moon-stars')} Nocturne</button>
        <button data-t="light">${icon('sun')} Vellum</button>
        <button data-t="auto">Match device</button>
      </div>
      <div class="field-label" style="margin-top:1.2rem">Text weight</div>
      <div class="seg" id="weightSeg">
        <button data-w="regular">Regular</button>
        <button data-w="light" style="font-family:'Alegreya Sans Light', var(--sans)">Light</button>
      </div>
      <div class="field-label" style="margin-top:1.2rem">Background <small>on this device; each world can choose its own in World settings</small></div>
      ${pickerHTML(deviceDefault())}
      <label class="bg-scale" style="margin-top:.9rem" title="Fine grain over the whole app that softens flat colours">Noise
        <input type="range" id="noiseRange" min="0" max="100" step="1" value="${noiseLevel()}"><output>${noiseLevel()}%</output></label>
    </div>
    <div class="panel">
      <h2>Writing help</h2>
      <label class="check"><input type="checkbox" id="promptsToggle" ${promptsEnabled() ? 'checked' : ''}> Show writing prompts</label>
      <p class="muted small">A daily prompt on each world’s overview, and the Writing prompts page.</p>
      <label class="check"><input type="checkbox" id="guideToggle" ${guidanceEnabled() ? 'checked' : ''}> Show the writing guide in the editor</label>
      <p class="muted small">Questions to help fill out each template. Both settings apply to this device only.</p>
    </div>
    <div class="panel" id="importCard">
      <h2>Import a world</h2>
      <p class="muted">Add articles from a WorldAtlas import file, for example one an AI assistant made from your notes. You’ll see a preview first. Re-importing updates articles with matching titles.</p>
      <div class="actions left">
        <label class="btn primary">${icon('upload-simple')} Import from file<input type="file" id="importWorldFile" accept=".json,.txt,application/json,text/plain" hidden></label>
        <button class="btn" id="pasteImport">${icon('file-text')} Paste text</button>
      </div>
      <div class="field-label" style="margin-top:1.2rem">Working with an AI assistant</div>
      <p class="muted small">Paste these instructions into an assistant with your notes, then import its reply here.</p>
      <div class="actions left">
        <button class="btn small" id="copyAiPrompt">${icon('feather')} Copy instructions for an assistant</button>
        <a class="btn small quiet" href="${DOCS_URL}" target="_blank" rel="noopener">${icon('arrow-square-out')} Format guide</a>
      </div>
      ${store.worlds().length ? `<div class="field-label" style="margin-top:1.2rem">Export a world in this format</div>
      <p class="muted small">Give this to an assistant to extend a world, then import its reply.</p>
      <div class="toolbar" style="margin:0">
        <select id="exportWorldSel">${store.worlds().map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
        <button class="btn small" id="exportWorldBtn">${icon('download-simple')} Download</button>
        <button class="btn small quiet" id="copyWorldBtn">Copy</button>
      </div>` : ''}
    </div>
    <div class="panel">
      <h2>Backup</h2>
      <p class="muted">Save everything, including images and history, to one file, or restore from one.</p>
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
      <p class="muted small">Resetting the cache re-downloads the app. Your worlds and settings aren’t touched.</p>
    </div>
    <p class="muted small center">Icons: Phosphor. Type: Cormorant Garamond, Alegreya.</p>
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
  const wseg = $('#weightSeg');
  const markW = () => { for (const b of wseg.children) b.classList.toggle('on', b.dataset.w === (localStorage.getItem('wa.weight') || 'regular')); };
  wseg.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    localStorage.setItem('wa.weight', b.dataset.w);
    applyTheme(); markW();
  };
  markW();
  $('#noiseRange').addEventListener('input', (e) => { setNoise(e.target.value); e.target.nextElementSibling.textContent = e.target.value + '%'; });
  $('#noiseRange').addEventListener('dblclick', (e) => { e.target.value = NOISE_DEFAULT; e.target.dispatchEvent(new Event('input')); });
  wirePicker($('#themeSeg').closest('.panel'), deviceDefault(), (bg) => { setDeviceDefault(bg || { pattern: 'plain' }); applyBackground(null); }, prepareImage);
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
  $('#importFile').onchange = (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) importBackup(file); };
  $('#importWorldFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) handleImportText(await f.text()); };
  $('#pasteImport').onclick = pasteDialog;
  $('#copyAiPrompt').onclick = () => copyText(aiInstructions(), 'Instructions copied');
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
    main = `<p>Syncing uses a private folder in your OneDrive (<code>Apps/WorldAtlas</code>). It needs a one-time Microsoft app registration (see the README). Paste its Application (client) ID below.</p>`;
  } else if (st.state === 'off') {
    main = `<p>Sign in with Microsoft to sync your worlds through <code>OneDrive/Apps/WorldAtlas</code>.</p>
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
    ${auth.builtInClientId ? '' : `<details ${cid ? '' : 'open'}><summary>Microsoft app registration</summary>
      <label>Application (client) ID<input id="cidInput" value="${esc(cid)}" placeholder="00000000-0000-0000-0000-000000000000"></label>
      <p class="small">Redirect URI to register (platform: <b>Single-page application</b>):<br><code class="copy">${esc(auth.redirectUri())}</code> <button class="btn small quiet" id="copyRuri">Copy</button></p>
      <button class="btn small" id="saveCid">Save client ID</button>
    </details>`}`;
  $('#connectBtn')?.addEventListener('click', () => auth.signIn().catch((e) => toast(e.message)));
  $('#syncNowBtn')?.addEventListener('click', () => sync.sync());
  $('#disconnectBtn')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Disconnect OneDrive on this device? Your worlds stay here and in OneDrive.', 'Disconnect'))) return;
    auth.signOut();
    await store.saveMeta({ eTags: {} });
    await store.resetSyncBase();
    sync.refreshStatus();
  });
  $('#saveCid')?.addEventListener('click', () => {
    auth.setClientId($('#cidInput').value);
    toast('Saved');
    sync.refreshStatus();
    renderOneDriveCard();
  });
  $('#copyRuri')?.addEventListener('click', () => navigator.clipboard?.writeText(auth.redirectUri()).then(() => toast('Copied')));
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
      "summary": "one or two lines", "body": "Markdown, with [[Other Article Title]] links",
      "parent": "Title of the article this belongs to", "tags": ["..."],
      "fields": { "Species": "...", "Occupation": "..." },
      "date": "12 Frostmoot 1042", "endDate": "1060",
      "relationships": [{ "type": "parent|child|spouse|sibling|partner|friend|ally|mentor|student|rival|enemy|member|leader|rules|serves|worships|created|owns|related", "target": "Other Article Title", "note": "optional" }],
      "secrets": "GM-only notes" }
  ]
}

Rules:
- Use unique titles, and the exact title in [[links]], "parent" and "target".
- Leave out "calendar" if my world has no custom calendar. Dates use its month names; a bare year is fine.
- Only use facts from my material. Put anything uncertain in "secrets".
- Split large topics into several linked articles.

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
    return toast('Not valid import text: ' + e.message, 6000);
  }
  if (json.app === 'WorldAtlas') return importBackupJSON(json);
  if (!isImportFormat(json)) return toast('No articles found in that text.', 5000);
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
          ${json.world?.calendar ? `<p class="small muted">${icon('calendar-blank')} ${plan.isNewWorld ? 'Includes a custom calendar.' : 'Replaces this world’s calendar.'}</p>` : ''}
          ${w.length ? `<details class="import-warnings" ${w.length <= 6 ? 'open' : ''}><summary>${icon('warning')} ${w.length} warning${w.length === 1 ? '' : 's'}</summary><ul>${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`
            : `<p class="small" style="color:var(--ok)">${icon('check')} No problems found.</p>`}
          <p class="small muted">Updates can be undone from each article’s History.</p>
          <div class="actions">
            <button class="btn quiet" data-cancel>Cancel</button>
            <button class="btn primary" id="ipGo" ${plan.create + plan.update ? '' : 'disabled'}>${icon('check')} Import ${plan.create + plan.update} article${plan.create + plan.update === 1 ? '' : 's'}</button>
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
