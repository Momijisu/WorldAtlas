// Folder sync: worlds kept in a folder on this computer, in the same layout as
// OneDrive (Worlds/<name>/world.json, history.json, images/). Point it at a
// folder that Proton Drive, Dropbox, Google Drive, iCloud Drive or Syncthing
// keeps in step across devices, and that app carries the files between them.
// Uses the File System Access API (Chrome and Edge on computers). See docs/SYNC.md.
import * as db from './db.js';

export const supported = () => typeof window.showDirectoryPicker === 'function';

let handle = null; // the chosen folder (FileSystemDirectoryHandle), kept in IndexedDB
let permission = 'unknown'; // 'granted' | 'prompt' | 'denied' | 'unknown'

export async function load() {
  try { handle = (await db.get('meta', 'folder'))?.handle || null; } catch { handle = null; }
  if (handle) permission = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt') ?? 'granted';
  return handle;
}
export const chosen = () => !!handle;
export const folderName = () => handle?.name || '';
export const needsPermission = () => !!handle && permission !== 'granted';

// Use this folder (from the picker, or a test's own folder).
export async function use(h) {
  handle = h;
  permission = (await h.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt')) ?? 'granted';
  if (permission !== 'granted') permission = (await h.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')) ?? 'granted';
  await db.put('meta', { key: 'folder', handle: h });
  return permission === 'granted';
}
export async function choose() {
  const h = await window.showDirectoryPicker({ id: 'worldatlas-sync', mode: 'readwrite' });
  return use(h);
}
export async function forget() {
  handle = null;
  permission = 'unknown';
  await db.put('meta', { key: 'folder', handle: null });
}
// The browser asks again after a restart; this must run from a click.
export async function allow() {
  if (!handle) return false;
  permission = (await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')) ?? 'granted';
  return permission === 'granted';
}

export class NeedsPermission extends Error {}

// ---- paths

const parts = (path) => path.split('/').filter(Boolean);
const notFound = (e) => e?.name === 'NotFoundError' || e?.name === 'TypeMismatchError';

async function dirAt(segs, create = false) {
  let d = handle;
  for (const s of segs) d = await d.getDirectoryHandle(s, { create });
  return d;
}
async function fileAt(path, create = false) {
  const p = parts(path);
  const dir = await dirAt(p.slice(0, -1), create);
  return dir.getFileHandle(p.at(-1), { create });
}

async function ready() {
  if (!handle) throw new Error('No folder chosen for sync.');
  if (permission !== 'granted') {
    permission = (await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt')) ?? 'granted';
    if (permission !== 'granted') throw new NeedsPermission(`Allow WorldAtlas to use the folder “${handle.name}” again.`);
  }
}

// A file's version: when it last changed and its size. Another app writing it
// (the cloud app bringing a newer copy) changes this, as an eTag would.
const tagOf = (file) => `${file.lastModified}-${file.size}`;

// The storage provider used by js/sync.js.
export const provider = {
  kind: 'folder',
  label: () => `the folder “${folderName()}”`,
  needsNetwork: false,
  conflictCopies: true, // cloud apps write "world (conflicted copy).json" next to the real one
  ready,
  async list(dir, foldersOnly = false) {
    const names = new Set();
    let d;
    try { d = await dirAt(parts(dir)); } catch (e) { if (notFound(e)) return names; throw e; }
    for await (const [name, h] of d.entries()) if (!foldersOnly || h.kind === 'directory') names.add(name);
    return names;
  },
  async stat(path) {
    try { const f = await (await fileAt(path)).getFile(); return { tag: tagOf(f), file: f }; } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async readJSON(path, st) {
    st ||= await this.stat(path);
    if (!st) return null;
    try { return JSON.parse(await st.file.text()); } catch { throw new Error(`${path} couldn’t be read. If your sync app is still downloading it, this will clear up on the next sync.`); }
  },
  // Writes unless the file changed since `ifTag` was read (null: it must not exist yet).
  async writeJSON(path, body, ifTag) {
    const cur = await this.stat(path);
    if ((cur?.tag ?? null) !== (ifTag ?? null)) return false;
    return this.writeRaw(path, new Blob([JSON.stringify(body)], { type: 'application/json' }));
  },
  async writeRaw(path, blob) {
    const fh = await fileAt(path, true);
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return tagOf(await fh.getFile());
  },
  async readBlob(path) {
    const st = await this.stat(path);
    return st ? { blob: st.file, type: st.file.type || '' } : null;
  },
  async writeBlob(path, blob) { await this.writeRaw(path, blob); },
  // Folders can't simply be renamed through the browser: copy, then remove the old one.
  async rename(dir, to) {
    const p = parts(dir);
    const parent = await dirAt(p.slice(0, -1));
    let from;
    try { from = await parent.getDirectoryHandle(p.at(-1)); } catch (e) { if (notFound(e)) return false; throw e; }
    if (typeof from.move === 'function') { try { await from.move(to); return true; } catch { /* not supported for folders here: copy instead */ } }
    const dest = await parent.getDirectoryHandle(to, { create: true });
    await copyDir(from, dest);
    await parent.removeEntry(p.at(-1), { recursive: true });
    return true;
  },
  async remove(path) {
    const p = parts(path);
    try { await (await dirAt(p.slice(0, -1))).removeEntry(p.at(-1), { recursive: true }); return true; } catch (e) { return notFound(e); }
  },
};

async function copyDir(from, to) {
  for await (const [name, h] of from.entries()) {
    if (h.kind === 'directory') await copyDir(h, await to.getDirectoryHandle(name, { create: true }));
    else {
      const w = await (await to.getFileHandle(name, { create: true })).createWritable();
      await w.write(await h.getFile());
      await w.close();
    }
  }
}
