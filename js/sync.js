// Two-way sync between IndexedDB and OneDrive (Apps/WorldAtlas/).
//
// atlas.json holds every world/article/map record (including deletion
// tombstones); history.json holds article versions. Records merge one by one:
// the newer `updatedAt` wins, so edits to different articles on phone and PC
// never clobber each other. Uploads use
// the file's eTag (If-Match), so a concurrent write from another device makes
// us re-download and merge instead of overwriting. Images are stored as
// separate immutable files in images/.
import * as auth from './auth.js';
import * as store from './store.js';
import { RECORD_STORES } from './db.js';
import { REMOTE_FILE } from './config.js';

const ROOT = '/me/drive/special/approot';
let status = { state: 'off', message: '' };
const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
export const getStatus = () => status;
function setStatus(state, message = '') {
  status = { state, message };
  listeners.forEach((fn) => fn(status));
}

export function refreshStatus() {
  if (auth.isSignedIn()) setStatus(store.isDirty() ? 'pending' : 'synced');
  else if (auth.account()) setStatus('reauth', 'Reconnect OneDrive to resume syncing.');
  else setStatus('off');
}

let running = null;
let again = false;
export function sync() {
  if (running) { again = true; return running; }
  running = run().finally(() => {
    running = null;
    if (again) { again = false; sync(); }
  });
  return running;
}

async function run() {
  if (!auth.isSignedIn()) return refreshStatus();
  if (!navigator.onLine) return setStatus('offline', 'Offline — changes are saved on this device.');
  setStatus('syncing');
  try {
    const rev = store.meta.localRev;
    const dirty = store.isDirty();
    for (const spec of FILES) {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (await syncFile(spec, dirty)) break;
      }
    }
    await store.saveMeta({ syncedRev: rev });
    await syncImages();
    await store.saveMeta({ lastSync: Date.now() });
    setStatus(store.isDirty() ? 'pending' : 'synced');
  } catch (e) {
    console.error('Sync failed', e);
    if (e instanceof auth.ReauthRequired) setStatus('reauth', e.message);
    else if (!navigator.onLine) setStatus('offline', 'Offline — changes are saved on this device.');
    else setStatus('error', e.message || String(e));
  }
}

async function check(res, what) {
  if (res.ok) return res;
  let msg = `${what} failed (${res.status})`;
  try { msg += ': ' + (await res.json()).error.message; } catch { /* ignore */ }
  const err = new Error(msg);
  err.status = res.status;
  throw err;
}

// Each OneDrive file: what goes in it and how to merge a downloaded copy.
const FILES = [
  {
    name: REMOTE_FILE,
    collect: () => Object.fromEntries(RECORD_STORES.map((s) => [s, [...store.data[s].values()]])),
    merge: (json) => store.mergeRecords(json),
    hasLocal: () => RECORD_STORES.some((s) => store.data[s].size),
  },
  {
    name: 'history.json',
    collect: () => ({ history: [...store.data.history.values()] }),
    merge: (json) => store.mergeHistory(json.history),
    hasLocal: () => store.data.history.size > 0,
  },
];

// Returns true when local and remote agree for this file, false on an eTag race.
async function syncFile(spec, dirty) {
  const metaRes = await auth.graph(`${ROOT}:/${spec.name}`);
  let remoteETag = null;
  let localAhead;
  if (metaRes.status === 404) {
    localAhead = spec.hasLocal();
  } else {
    const item = await (await check(metaRes, 'Reading OneDrive')).json();
    remoteETag = item.eTag;
    if (remoteETag !== store.meta.eTags[spec.name]) {
      const content = await check(await fetch(item['@microsoft.graph.downloadUrl']), 'Downloading ' + spec.name);
      localAhead = await spec.merge(await content.json());
    } else {
      localAhead = dirty;
    }
  }
  if (localAhead) {
    const res = await auth.graph(`${ROOT}:/${spec.name}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(remoteETag ? { 'If-Match': remoteETag } : { 'If-None-Match': '*' }) },
      body: JSON.stringify({ app: 'WorldAtlas', version: 1, savedAt: Date.now(), ...spec.collect() }),
    });
    if (res.status === 412 || res.status === 409) return false; // someone else wrote first — merge again
    remoteETag = (await (await check(res, 'Uploading ' + spec.name)).json()).eTag;
  }
  await store.saveMeta({ eTags: { ...store.meta.eTags, [spec.name]: remoteETag } });
  return true;
}

async function syncImages() {
  // Upload images created on this device.
  for (const id of await store.imageIds()) {
    const rec = await store.getImage(id);
    if (!rec || rec.uploaded) continue;
    const res = await auth.graph(`${ROOT}:/images/${id}:/content`, {
      method: 'PUT', headers: { 'Content-Type': rec.type }, body: rec.blob,
    });
    await check(res, 'Uploading image');
    await store.putImage({ ...rec, uploaded: true });
  }
  // Download images referenced by records that we don't have yet.
  const have = new Set(await store.imageIds());
  let fetched = false;
  for (const id of store.referencedImages()) {
    if (have.has(id)) continue;
    const metaRes = await auth.graph(`${ROOT}:/images/${id}`);
    if (metaRes.status === 404) continue; // not uploaded yet by the other device
    const item = await (await check(metaRes, 'Reading image')).json();
    const blob = await (await check(await fetch(item['@microsoft.graph.downloadUrl']), 'Downloading image')).blob();
    await store.putImage({ id, blob, type: item.file?.mimeType || blob.type, uploaded: true });
    fetched = true;
  }
  if (fetched) store.notify({ local: false, store: 'images' });
}

// Background scheduling: sync shortly after local edits, when the app comes
// back into view, when the network returns, and every couple of minutes.
export function start() {
  const soon = debounceSync(2500);
  store.onChange((e) => { if (e.local) { refreshStatus(); soon(); } });
  addEventListener('online', () => sync());
  addEventListener('offline', () => refreshStatus());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
    else if (store.isDirty()) sync(); // try to flush before the app is backgrounded
  });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
  refreshStatus();
  sync();
}

function debounceSync(ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(sync, ms); };
}
