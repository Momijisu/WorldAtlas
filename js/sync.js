// Two-way sync between IndexedDB and OneDrive (Apps/WorldAtlas/), one folder
// per world:
//
//   Worlds/<world name>/world.json    the world, its articles and maps
//   Worlds/<world name>/history.json  its article versions
//   Worlds/<world name>/images/<id>   its pictures and fonts
//   deleted.json                      records of deleted worlds (their folders are removed)
//   Legacy/                           the old single atlas.json layout, moved aside
//
// Records merge one by one: the newer `updatedAt` wins, so edits to different
// articles on phone and PC never clobber each other. Uploads use the file's
// eTag (If-Match), so a concurrent write from another device makes us
// re-download and merge instead of overwriting. Images are immutable files.
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
let pausedUntil = 0; // after OneDrive throttles us
export function sync() {
  if (Date.now() < pausedUntil) return Promise.resolve();
  if (running) { again = true; return running; }
  running = run().finally(() => {
    running = null;
    if (again) { again = false; sync(); }
  });
  return running;
}

async function run() {
  if (!auth.isSignedIn()) {
    if (auth.account() && await auth.renewSilently()) return run();
    return refreshStatus();
  }
  if (!navigator.onLine) return setStatus('offline', 'Offline. Changes are saved on this device.');
  setStatus('syncing');
  try {
    const rev = store.meta.localRev;
    const dirty = store.isDirty();
    const legacy = await mergeLegacy();
    const spec = deletedSpec();
    await withRetries('deleted.json', () => syncFile(spec, dirty && store.hasUnsynced(spec.scope)));
    const folders = await listWorldFolders();
    // A problem with one world (or its pictures) doesn't stop the others; it's
    // reported once the rest are done. Throttling and sign-in stop everything.
    let failed = null;
    const each = async (fn) => {
      try { return await fn(); } catch (e) {
        if (e instanceof auth.Throttled || e instanceof auth.ReauthRequired || !navigator.onLine) throw e;
        failed ||= e;
        return false;
      }
    };
    for (const wid of await worldsToSync(folders)) await each(() => syncWorld(wid, folders, dirty && store.hasUnsynced(isWorldRec(wid))));
    if (!failed) await store.saveMeta({ syncedRev: rev });
    let complete = true;
    for (const wid of liveWorlds()) complete = (await each(() => syncImages(wid))) && complete;
    if (failed) throw failed;
    await removeDeletedFolders(folders);
    // The old layout is retired only once every world folder holds its pictures.
    if (legacy && complete) await retireLegacy();
    await store.saveMeta({ lastSync: Date.now() });
    setStatus(store.isDirty() ? 'pending' : 'synced');
  } catch (e) {
    console.error('Sync failed', e);
    // A lapsed session: try renewing in the background before asking.
    if (e instanceof auth.ReauthRequired && await auth.renewSilently()) { again = true; return; }
    if (e instanceof auth.ReauthRequired) setStatus('reauth', e.message);
    else if (e instanceof auth.Throttled) {
      // Not an error: pause, then pick up where we left off.
      const wait = Math.max(60, e.seconds) * 1000;
      pausedUntil = Date.now() + wait;
      setTimeout(sync, wait + 500);
      setStatus('pending', e.message);
    }
    else if (!navigator.onLine) setStatus('offline', 'Offline. Changes are saved on this device.');
    else setStatus('error', e.message || String(e));
  }
}

// A file's contents, from the download link OneDrive gives with its details
// (same retry rules as other OneDrive requests).
const download = (item) => auth.patient(() => fetch(item['@microsoft.graph.downloadUrl']));

async function check(res, what) {
  if (res.ok) return res;
  let msg = `${what} failed (${res.status})`;
  try { msg += ': ' + (await res.json()).error.message; } catch { /* ignore */ }
  const err = new Error(msg);
  err.status = res.status;
  throw err;
}

// ---- the files

const isWorldRec = (wid) => (r) => r.id === wid || r.worldId === wid;
const liveWorlds = () => [...store.data.worlds.values()].filter((w) => !w.deleted && store.syncable(w)).map((w) => w.id);
const deletedWorlds = () => new Set([...store.data.worlds.values()].filter((w) => w.deleted && store.syncable(w)).map((w) => w.id));
const recordsWhere = (keep) => Object.fromEntries(RECORD_STORES.map((s) => [s, [...store.data[s].values()].filter((r) => store.syncable(r) && keep(r))]));
const snapshotOf = (body) => Object.fromEntries(RECORD_STORES.flatMap((s) => (body[s] || []).map((r) => [r.id, r.updatedAt || 0])));

// A world's records: world.json in its folder.
const worldSpec = (wid, path) => ({
  path, key: `w:${wid}`,
  collect: () => recordsWhere(isWorldRec(wid)),
  merge: (json) => store.mergeRecords(json, { detectConflicts: true, scope: isWorldRec(wid) }),
  hasLocal: () => true,
  agreed: (body) => store.markSynced(snapshotOf(body)),
});
// A world's article versions: history.json in its folder.
const historySpec = (wid, path) => ({
  path, key: `h:${wid}`,
  collect: () => ({ history: [...store.data.history.values()].filter((h) => store.syncable(h) && h.worldId === wid) }),
  merge: (json) => store.mergeHistory(json.history, (h) => h.worldId === wid),
  hasLocal: () => [...store.data.history.values()].some((h) => store.syncable(h) && h.worldId === wid),
});
// Deleted worlds and everything that was in them, so other devices delete them too.
function deletedSpec() {
  const gone = () => deletedWorlds();
  const inGone = (r) => gone().has(r.id) || gone().has(r.worldId);
  return {
    path: 'deleted.json', key: 'deleted', scope: inGone,
    collect: () => recordsWhere(inGone),
    merge: (json) => store.mergeRecords(json, { scope: inGone }),
    hasLocal: () => gone().size > 0,
    agreed: (body) => store.markSynced(snapshotOf(body)),
  };
}

// Folder name for a world: its name, made safe for OneDrive, kept unique.
const safeName = (name) => String(name || '').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 60) || 'World';
const folderMap = () => store.meta.folders || {};
const saveFolders = (map) => store.saveMeta({ folders: map });

// The folders in Worlds/, or an empty set before the first world.
const listWorldFolders = () => listNames(`${ROOT}:/Worlds:/children?$select=name,folder&$top=200`, true);

// Names of the items in a folder listing (only folders if foldersOnly).
async function listNames(url, foldersOnly = false) {
  const names = new Set();
  while (url) {
    const res = await auth.graph(url);
    if (res.status === 404) break;
    const json = await (await check(res, 'Listing OneDrive')).json();
    for (const it of json.value || []) if (!foldersOnly || it.folder) names.add(it.name);
    url = json['@odata.nextLink'] || null;
  }
  return names;
}

// Live local worlds, plus folders we don't know yet (new on another device, or
// renamed there): each folder's world.json says which world it is.
async function worldsToSync(folders) {
  const map = { ...folderMap() };
  const known = new Set(Object.values(map));
  for (const name of folders) {
    if (known.has(name)) continue;
    const json = await readJSON(`Worlds/${name}/world.json`);
    const wid = json?.worlds?.[0]?.id;
    if (!wid) continue;
    if (deletedWorlds().has(wid)) continue;
    await store.mergeRecords(json, { detectConflicts: true, scope: isWorldRec(wid) });
    map[wid] = name;
  }
  await saveFolders(map);
  return liveWorlds();
}

async function syncWorld(wid, folders, dirty) {
  const map = { ...folderMap() };
  const want = safeName(store.world(wid)?.name);
  let name = map[wid];
  if (!name || !folders.has(name)) {
    // New here, or its folder was renamed/removed elsewhere: pick a free name.
    name = uniqueName(want, folders, wid);
  } else if (safeName(name.replace(/ \(\d+\)$/, '')) !== want) {
    name = await renameFolder(name, uniqueName(want, folders, wid), folders);
  }
  map[wid] = name;
  folders.add(name);
  await saveFolders(map);
  const changed = await withRetries(`${name}/world.json`, () => syncFile(worldSpec(wid, `Worlds/${name}/world.json`), dirty));
  if (changed || dirty) await withRetries(`${name}/history.json`, () => syncFile(historySpec(wid, `Worlds/${name}/history.json`), dirty));
}

function uniqueName(want, folders, wid) {
  const taken = new Set([...folders].map((n) => n.toLowerCase()));
  const mine = folderMap()[wid];
  if (mine) taken.delete(mine.toLowerCase());
  let name = want;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${want} (${i})`;
  return name;
}

async function renameFolder(from, to, folders) {
  if (from === to) return from;
  const res = await auth.graph(`${ROOT}:/Worlds/${encodeURIComponent(from)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }),
  });
  if (!res.ok) return from; // keep the old name; it still works
  folders.delete(from);
  folders.add(to);
  return to;
}

// A deleted world's folder is removed once deleted.json records the deletion.
async function removeDeletedFolders(folders) {
  const map = { ...folderMap() };
  for (const wid of deletedWorlds()) {
    const name = map[wid];
    if (!name) continue;
    if (folders.has(name)) {
      const res = await auth.graph(`${ROOT}:/Worlds/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) continue;
    }
    delete map[wid];
  }
  await saveFolders(map);
}

async function withRetries(what, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fn();
    if (r !== false) return r === 'changed';
  }
  throw new Error(`OneDrive kept changing ${what} during sync. Try again shortly.`);
}

const pathURL = (path) => `${ROOT}:/${path.split('/').map(encodeURIComponent).join('/')}`;

async function readJSON(path) {
  const res = await auth.graph(pathURL(path));
  if (res.status === 404) return null;
  const item = await (await check(res, 'Reading OneDrive')).json();
  return (await check(await download(item), 'Downloading ' + path)).json();
}

// Sync one file. Returns false on an eTag race (merge again), else 'changed'
// if it was downloaded or uploaded, or 'same'.
async function syncFile(spec, dirty) {
  const eTags = store.meta.eTags || {};
  const metaRes = await auth.graph(pathURL(spec.path));
  let remoteETag = null, localAhead, changed = false;
  if (metaRes.status === 404) {
    localAhead = spec.hasLocal();
  } else {
    const item = await (await check(metaRes, 'Reading OneDrive')).json();
    remoteETag = item.eTag;
    if (remoteETag !== eTags[spec.key]) {
      const content = await check(await download(item), 'Downloading ' + spec.path);
      localAhead = await spec.merge(await content.json());
      changed = true;
    } else {
      localAhead = dirty;
    }
  }
  // Snapshot now: the upload (and the sync baseline) cover exactly this state.
  const body = spec.collect();
  if (localAhead) {
    const res = await auth.graph(`${pathURL(spec.path)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(remoteETag ? { 'If-Match': remoteETag } : { 'If-None-Match': '*' }) },
      body: JSON.stringify({ app: 'WorldAtlas', version: 2, savedAt: Date.now(), ...body }),
    });
    if (res.status === 412 || res.status === 409) return false; // someone else wrote first — merge again
    remoteETag = (await (await check(res, 'Uploading ' + spec.path)).json()).eTag;
    changed = true;
  }
  await store.saveMeta({ eTags: { ...(store.meta.eTags || {}), [spec.key]: remoteETag } });
  await spec.agreed?.(body);
  return changed ? 'changed' : 'same';
}

const missingUntil = new Map(); // pictures not on OneDrive yet: when to look again

// A world's pictures and fonts: download the ones it uses that this device
// lacks, then upload the ones its folder lacks. Returns false if any are still
// missing everywhere (another device hasn't uploaded them yet).
async function syncImages(wid) {
  const name = folderMap()[wid];
  if (!name) return true;
  const used = store.referencedImages({ wid });
  const have = new Set(await store.imageIds());
  let fetched = false, complete = true;
  for (const id of used) {
    if (have.has(id)) continue;
    if ((missingUntil.get(id) || 0) > Date.now()) { complete = false; continue; } // looked recently
    // In the world's folder, or still in the old layout's images/.
    let metaRes = await auth.graph(pathURL(`Worlds/${name}/images/${id}`));
    if (metaRes.status === 404 && legacyImages) metaRes = await auth.graph(pathURL(`images/${id}`));
    if (metaRes.status === 404) { complete = false; missingUntil.set(id, Date.now() + 30 * 60e3); continue; } // not uploaded yet by the other device
    const item = await (await check(metaRes, 'Reading image')).json();
    const blob = await (await check(await download(item), 'Downloading image')).blob();
    // Found in the old images/ folder: not yet in the world's folder.
    const inFolder = !item.parentReference?.path || item.parentReference.path.includes('/Worlds/');
    await store.putImage({ id, blob, type: item.file?.mimeType || blob.type, uploaded: true, world: inFolder ? wid : null });
    fetched = true;
  }
  if (fetched) store.notify({ local: false, store: 'images' });
  // Remembered by world, so renaming its folder doesn't upload everything again.
  for (const id of used) {
    const rec = await store.getImage(id);
    if (!rec || rec.world === wid) continue;
    const res = await auth.graph(`${pathURL(`Worlds/${name}/images/${id}`)}:/content`, {
      method: 'PUT', headers: { 'Content-Type': rec.type }, body: rec.blob,
    });
    await check(res, 'Uploading image');
    await store.putImage({ ...rec, uploaded: true, world: wid });
  }
  return complete;
}

// ---- the old single-file layout (atlas.json, history.json, images/ at the top)

// Merge anything still in the old files: left from before the move to world
// folders, or written by a device still on an older version. True if found.
// One listing of the top folder says whether any of the old files exist.
let legacyImages = false;
async function mergeLegacy() {
  const top = await listNames(`${ROOT}/children?$select=name&$top=200`);
  legacyImages = top.has('images');
  let found = false;
  if (top.has(REMOTE_FILE)) {
    const atlas = await readJSON(REMOTE_FILE);
    if (atlas) { await store.mergeRecords(atlas, { detectConflicts: true }); found = true; }
  }
  if (top.has('history.json')) {
    const history = await readJSON('history.json');
    if (history) { await store.mergeHistory(history.history); found = true; }
  }
  return found || legacyImages;
}

// Once every world folder and its pictures are written, move the old files
// into Legacy/ (dated, never deleted).
async function retireLegacy() {
  const legacyId = await ensureFolder('Legacy');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  for (const [name, base, ext] of [[REMOTE_FILE, 'atlas', '.json'], ['history.json', 'history', '.json'], ['images', 'images', '']]) {
    for (let i = 1; ; i++) {
      const res = await auth.graph(pathURL(name), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentReference: { id: legacyId }, name: `${base}-${stamp}${i > 1 ? `-${i}` : ''}${ext}` }),
      });
      if (res.status === 409 && i < 9) continue; // that name is taken in Legacy/: add a number
      if (!res.ok && res.status !== 404) await check(res, 'Moving the old ' + name);
      break;
    }
  }
}

// Folders are made by writing a file into them (the same path-based upload the
// world folders use); OneDrive creates the folder on the way.
async function ensureFolder(name) {
  const res = await auth.graph(pathURL(name));
  if (res.ok) return (await res.json()).id;
  await check(await auth.graph(`${pathURL(`${name}/README.txt`)}:/content`, {
    method: 'PUT', headers: { 'Content-Type': 'text/plain' },
    body: 'Files from an older version of WorldAtlas, kept as a backup. Your worlds are now in the Worlds folder. You can delete this folder once you are happy everything is there.\n',
  }), 'Creating ' + name);
  return (await (await check(await auth.graph(pathURL(name)), 'Reading ' + name)).json()).id;
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
