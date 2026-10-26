// Thin promise wrapper over IndexedDB. Everything the app owns lives here
// on the device; OneDrive is a sync target, not the source of truth.
const DB_NAME = 'worldatlas';
const DB_VERSION = 1;
export const RECORD_STORES = ['worlds', 'articles', 'maps'];

let dbp;
function open() {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of RECORD_STORES) d.createObjectStore(s, { keyPath: 'id' });
      d.createObjectStore('images', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

export async function getAll(store) {
  return req((await open()).transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  return req((await open()).transaction(store).objectStore(store).get(key));
}

export async function put(store, value) {
  const t = (await open()).transaction(store, 'readwrite');
  t.objectStore(store).put(value);
  return done(t);
}

export async function putMany(store, values) {
  if (!values.length) return;
  const t = (await open()).transaction(store, 'readwrite');
  const os = t.objectStore(store);
  for (const v of values) os.put(v);
  return done(t);
}

export async function getAllKeys(store) {
  return req((await open()).transaction(store).objectStore(store).getAllKeys());
}
