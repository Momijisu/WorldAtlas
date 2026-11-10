// Two-way sync between IndexedDB and a shared place: a private folder in your
// OneDrive (Apps/WorldAtlas/), or a folder on this computer that another app
// (Proton Drive, Dropbox, Google Drive, iCloud Drive, Syncthing…) keeps in step
// across devices (js/syncfolder.js). One at a time. The layout is the same:
//
//   Worlds/<world name>/world.json    the world, its articles and maps
//   Worlds/<world name>/history.json  its article versions
//   Worlds/<world name>/images/<id>   its pictures and fonts
//   deleted.json                      records of deleted worlds (their folders are removed)
//   Legacy/                           (OneDrive) the old single atlas.json layout, moved aside
//
// Records merge one by one: the newer `updatedAt` wins, so edits to different
// articles on phone and PC never clobber each other. Writes check the file's
// version first (OneDrive's eTag, or a folder file's time and size), so a
// concurrent write from another device makes us re-read and merge instead of
// overwriting. Images are immutable files.
import * as auth from './auth.js';
import * as store from './store.js';
import * as folder from './syncfolder.js';
import { RECORD_STORES } from './db.js';
import { REMOTE_FILE } from './config.js';

let status = { state: 'off', message: '' };
const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
export const getStatus = () => status;
function setStatus(state, message = '') {
  status = { state, message };
  listeners.forEach((fn) => fn(status));
}

// Where this device syncs: 'onedrive', 'folder', or null.
export const target = () => (folder.chosen() ? 'folder' : auth.isSignedIn() || auth.account() ? 'onedrive' : null);
export const targetLabel = () => (target() === 'folder' ? `the folder “${folder.folderName()}”` : 'OneDrive');
const P = () => (target() === 'folder' ? folder.provider : onedrive);

export function refreshStatus() {
  if (target() === 'folder') {
    if (folder.needsPermission()) setStatus('reauth', `Allow WorldAtlas to use the folder “${folder.folderName()}” again.`);
    else setStatus(store.isDirty() ? 'pending' : 'synced');
  } else if (auth.isSignedIn()) setStatus(store.isDirty() ? 'pending' : 'synced');
  else if (auth.account()) setStatus('reauth', 'Reconnect OneDrive to resume syncing.');
  else setStatus('off');
}

// Folder sync: choose a folder (from a click), let the browser use it again,
// or stop. Choosing or stopping starts the sync record afresh, as connecting
// or disconnecting OneDrive does.
export async function chooseFolder(handle) {
  const ok = handle ? await folder.use(handle) : await folder.choose();
  await store.saveMeta({ eTags: {}, folders: {} });
  await store.resetSyncBase();
  refreshStatus();
  if (ok) sync();
  return ok;
}
export async function allowFolder() {
  const ok = await folder.allow();
  refreshStatus();
  if (ok) sync();
  return ok;
}
export async function stopFolder() {
  await folder.forget();
  await store.saveMeta({ eTags: {}, folders: {} });
  await store.resetSyncBase();
  refreshStatus();
}
export const folderSupported = folder.supported;
export const folderName = folder.folderName;

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
  const t = target();
  if (!t) return refreshStatus();
  if (t === 'onedrive' && !auth.isSignedIn()) {
    if (auth.account() && await auth.renewSilently()) return run();
    return refreshStatus();
  }
  const p = P();
  if (p.needsNetwork && !navigator.onLine) return setStatus('offline', 'Offline. Changes are saved on this device.');
  setStatus('syncing');
  try {
    await p.ready?.();
    const rev = store.meta.localRev;
    const dirty = store.isDirty();
    const legacy = p.legacy ? await mergeLegacy() : false;
    const spec = deletedSpec();
    if (p.conflictCopies) await mergeCopies('', /^deleted.+\.json$/i, (json) => store.mergeRecords(json, { scope: spec.scope }));
    await withRetries('deleted.json', () => syncFile(spec, dirty && store.hasUnsynced(spec.scope)));
    const folders = await p.list('Worlds', true);
    // A problem with one world (or its pictures) doesn't stop the others; it's
    // reported once the rest are done. Throttling and sign-in stop everything.
    let failed = null;
    const each = async (fn) => {
      try { return await fn(); } catch (e) {
        if (e instanceof auth.Throttled || e instanceof auth.ReauthRequired || e instanceof folder.NeedsPermission || (p.needsNetwork && !navigator.onLine)) throw e;
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
    if (e instanceof folder.NeedsPermission) { setStatus('reauth', e.message); return; }
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
    else if (p.needsNetwork && !navigator.onLine) setStatus('offline', 'Offline. Changes are saved on this device.');
    else setStatus('error', e.message || String(e));
  }
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

// Folder name for a world: its name, made safe for any drive, kept unique.
const safeName = (name) => String(name || '').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 60) || 'World';
const folderMap = () => store.meta.folders || {};
const saveFolders = (map) => store.saveMeta({ folders: map });

// Live local worlds, plus folders we don't know yet (new on another device, or
// renamed there): each folder's world.json says which world it is.
async function worldsToSync(folders) {
  const map = { ...folderMap() };
  const known = new Set(Object.values(map));
  for (const name of folders) {
    if (known.has(name)) continue;
    const json = await P().readJSON(`Worlds/${name}/world.json`);
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
  // Copies a cloud app made when two devices wrote at once ("world (conflicted copy).json"):
  // merged in, then removed. Both devices may have saved their own edit already,
  // so, as with restoring a backup, version history decides: an article that's
  // an older version on one side keeps the other; changed on both, it goes to
  // the merge manager. Their history copies are read first, for that.
  let copies = false;
  if (P().conflictCopies && folders.has(name)) {
    const theirHistory = [];
    copies = await mergeCopies(`Worlds/${name}`, /^history.+\.json$/i, async (json) => { theirHistory.push(...(json.history || [])); await store.mergeHistory(json.history, (h) => h.worldId === wid); });
    copies = (await mergeCopies(`Worlds/${name}`, /^world.+\.json$/i, (json) => store.mergeRecords(json, { history: theirHistory, scope: isWorldRec(wid) }))) || copies;
  }
  const changed = await withRetries(`${name}/world.json`, () => syncFile(worldSpec(wid, `Worlds/${name}/world.json`), dirty || copies));
  if (changed || dirty || copies) await withRetries(`${name}/history.json`, () => syncFile(historySpec(wid, `Worlds/${name}/history.json`), dirty || copies));
}

// Merge each file in `dir` whose name matches (but isn't the real file), then remove it.
async function mergeCopies(dir, pattern, merge) {
  let found = false;
  for (const name of await P().list(dir)) {
    if (!pattern.test(name)) continue;
    const json = await P().readJSON(`${dir ? dir + '/' : ''}${name}`).catch(() => null);
    if (!json) continue;
    await merge(json);
    await P().remove(`${dir ? dir + '/' : ''}${name}`);
    found = true;
  }
  return found;
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
  if (!(await P().rename(`Worlds/${from}`, to))) return from; // keep the old name; it still works
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
    if (folders.has(name) && !(await P().remove(`Worlds/${name}`))) continue;
    delete map[wid];
  }
  await saveFolders(map);
}

async function withRetries(what, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fn();
    if (r !== false) return r === 'changed';
  }
  throw new Error(`${target() === 'folder' ? 'The sync folder' : 'OneDrive'} kept changing ${what} during sync. Try again shortly.`);
}

// Sync one file. Returns false on a write race (merge again), else 'changed'
// if it was read or written, or 'same'.
async function syncFile(spec, dirty) {
  const p = P();
  const tags = store.meta.eTags || {};
  const st = await p.stat(spec.path);
  let remoteTag = null, localAhead, changed = false;
  if (!st) {
    localAhead = spec.hasLocal();
  } else {
    remoteTag = st.tag;
    if (remoteTag !== tags[spec.key]) {
      localAhead = await spec.merge(await p.readJSON(spec.path, st));
      changed = true;
    } else {
      localAhead = dirty;
    }
  }
  // Snapshot now: the upload (and the sync baseline) cover exactly this state.
  const body = spec.collect();
  if (localAhead) {
    const tag = await p.writeJSON(spec.path, { app: 'WorldAtlas', version: 2, savedAt: Date.now(), ...body }, remoteTag);
    if (tag === false) return false; // someone else wrote first — merge again
    remoteTag = tag;
    changed = true;
  }
  await store.saveMeta({ eTags: { ...(store.meta.eTags || {}), [spec.key]: remoteTag } });
  await spec.agreed?.(body);
  return changed ? 'changed' : 'same';
}

const missingUntil = new Map(); // pictures not uploaded yet: when to look again

// A world's pictures and fonts: download the ones it uses that this device
// lacks, then upload the ones its folder lacks. Returns false if any are still
// missing everywhere (another device hasn't uploaded them yet).
async function syncImages(wid) {
  const p = P();
  const name = folderMap()[wid];
  if (!name) return true;
  const used = store.referencedImages({ wid });
  const have = new Set(await store.imageIds());
  let fetched = false, complete = true;
  for (const id of used) {
    if (have.has(id)) continue;
    if ((missingUntil.get(id) || 0) > Date.now()) { complete = false; continue; } // looked recently
    const got = await p.readImage(`Worlds/${name}/images/${id}`, id);
    if (!got) { complete = false; missingUntil.set(id, Date.now() + 30 * 60e3); continue; } // not uploaded yet by the other device
    await store.putImage({ id, blob: got.blob, type: got.type || got.blob.type, uploaded: true, world: got.inFolder === false ? null : wid });
    fetched = true;
  }
  if (fetched) store.notify({ local: false, store: 'images' });
  // Remembered by world, so renaming its folder doesn't upload everything again.
  for (const id of used) {
    const rec = await store.getImage(id);
    if (!rec || rec.world === wid) continue;
    await p.writeBlob(`Worlds/${name}/images/${id}`, rec.blob, rec.type);
    await store.putImage({ ...rec, uploaded: true, world: wid });
  }
  return complete;
}

// ---- OneDrive (Microsoft Graph)

const ROOT = '/me/drive/special/approot';
const pathURL = (path) => `${ROOT}:/${path.split('/').map(encodeURIComponent).join('/')}`;
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

let legacyImages = false;
const onedrive = {
  kind: 'onedrive',
  needsNetwork: true,
  legacy: true,
  list: (dir, foldersOnly) => listNames(`${dir ? `${ROOT}:/${dir}:` : ROOT}/children?$select=name,folder&$top=200`, foldersOnly),
  async stat(path) {
    const res = await auth.graph(pathURL(path));
    if (res.status === 404) return null;
    const item = await (await check(res, 'Reading OneDrive')).json();
    return { tag: item.eTag, item };
  },
  async readJSON(path, st) {
    st ||= await this.stat(path);
    if (!st) return null;
    return (await check(await download(st.item), 'Downloading ' + path)).json();
  },
  async writeJSON(path, body, ifTag) {
    const res = await auth.graph(`${pathURL(path)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(ifTag ? { 'If-Match': ifTag } : { 'If-None-Match': '*' }) },
      body: JSON.stringify(body),
    });
    if (res.status === 412 || res.status === 409) return false;
    return (await (await check(res, 'Uploading ' + path)).json()).eTag;
  },
  // In the world's folder, or still in the old layout's images/.
  async readImage(path, id) {
    let res = await auth.graph(pathURL(path));
    if (res.status === 404 && legacyImages) res = await auth.graph(pathURL(`images/${id}`));
    if (res.status === 404) return null;
    const item = await (await check(res, 'Reading image')).json();
    const blob = await (await check(await download(item), 'Downloading image')).blob();
    // Found in the old images/ folder: not yet in the world's folder.
    const inFolder = !item.parentReference?.path || item.parentReference.path.includes('/Worlds/');
    return { blob, type: item.file?.mimeType, inFolder };
  },
  async writeBlob(path, blob, type) {
    await check(await auth.graph(`${pathURL(path)}:/content`, { method: 'PUT', headers: { 'Content-Type': type }, body: blob }), 'Uploading image');
  },
  async rename(dir, to) {
    const res = await auth.graph(pathURL(dir), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }) });
    return res.ok;
  },
  async remove(path) {
    const res = await auth.graph(pathURL(path), { method: 'DELETE' });
    return res.ok || res.status === 404;
  },
};
folder.provider.readImage = async (path) => folder.provider.readBlob(path);

// ---- the old single-file layout on OneDrive (atlas.json, history.json, images/ at the top)

// Merge anything still in the old files: left from before the move to world
// folders, or written by a device still on an older version. True if found.
// One listing of the top folder says whether any of the old files exist.
async function mergeLegacy() {
  const top = await onedrive.list('');
  legacyImages = top.has('images');
  let found = false;
  if (top.has(REMOTE_FILE)) {
    const atlas = await onedrive.readJSON(REMOTE_FILE);
    if (atlas) { await store.mergeRecords(atlas, { detectConflicts: true }); found = true; }
  }
  if (top.has('history.json')) {
    const history = await onedrive.readJSON('history.json');
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
export async function start() {
  await folder.load();
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
