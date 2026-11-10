// .world files: one world in a single file (its articles, maps, version
// history and every picture), to keep, send to someone or open on another
// device. A .world file is a zip archive:
//
//   manifest.json   { app: 'WorldAtlas', kind: 'world', version, name, exportedAt, images: [{ id, type, file }] }
//   world.json      the world, its articles and maps (as in sync)
//   history.json    its article versions
//   images/<id>     its pictures and fonts
//
// Opening one adds the world, or, if this device already has it, merges it in
// as restoring a backup does: newer work is kept, and an article changed in
// both places goes to the merge manager.
import * as store from './store.js';
import { RECORD_STORES } from './db.js';

const enc = new TextEncoder();

// ---- zip (stored entries; reading also handles deflated ones)

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function dosTime(d = new Date()) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

// files: [{ name, data: Uint8Array }] → Blob
export function zip(files) {
  const { time, date } = dosTime();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/x-worldatlas-world' });
}

// Blob → Map(name → Uint8Array)
export async function unzip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const v = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a .world file (no archive found).');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('This .world file is damaged.');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + csize);
    if (!name.endsWith('/')) {
      if (method === 0) out.set(name, raw);
      else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
      else throw new Error('This .world file uses a compression WorldAtlas can’t read.');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export const isZip = async (blob) => { const b = new Uint8Array(await blob.slice(0, 4).arrayBuffer()); return b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4; };

// ---- worlds

const fileName = (name) => `${(String(name || 'World').replace(/[\\/:*?"<>|]+/g, '').trim() || 'World').slice(0, 80)}.world`;

export async function exportWorld(wid) {
  const w = store.world(wid);
  if (!w) throw new Error('No such world');
  const mine = (r) => r.id === wid || r.worldId === wid;
  const recs = Object.fromEntries(RECORD_STORES.map((s) => [s, [...store.data[s].values()].filter((r) => mine(r) && !r.deleted)]));
  const history = [...store.data.history.values()].filter((h) => h.worldId === wid);
  const files = [];
  const images = [];
  for (const id of store.referencedImages({ wid, demo: store.isDemo(wid) })) {
    const rec = await store.getImage(id);
    if (!rec) continue;
    files.push({ name: `images/${id}`, data: new Uint8Array(await rec.blob.arrayBuffer()) });
    images.push({ id, type: rec.type || rec.blob.type || '', file: `images/${id}` });
  }
  const json = (o) => enc.encode(JSON.stringify(o));
  files.unshift(
    { name: 'manifest.json', data: json({ app: 'WorldAtlas', kind: 'world', version: 1, appVersion: self.WA_VERSION, name: w.name, exportedAt: new Date().toISOString(), images }) },
    { name: 'world.json', data: json({ app: 'WorldAtlas', version: 2, ...recs }) },
    { name: 'history.json', data: json({ history }) },
  );
  return { blob: zip(files), name: fileName(w.name) };
}

// Adds (or merges in) the world in a .world file. Returns { wid, name, added, clashes }.
export async function importWorld(blob) {
  const files = await unzip(blob);
  const read = (n) => { const d = files.get(n); if (!d) throw new Error(`This .world file is missing ${n}.`); return JSON.parse(new TextDecoder().decode(d)); };
  const manifest = read('manifest.json');
  if (manifest.app !== 'WorldAtlas' || manifest.kind !== 'world') throw new Error('Not a WorldAtlas .world file.');
  const body = read('world.json');
  const history = files.has('history.json') ? read('history.json').history || [] : [];
  const world = body.worlds?.[0];
  if (!world) throw new Error('This .world file has no world in it.');
  // An example world, once exported and opened, is the user's own.
  for (const w of body.worlds) delete w.demo;
  const have = new Set(await store.imageIds());
  for (const img of manifest.images || []) {
    const data = files.get(img.file || `images/${img.id}`);
    if (data && !have.has(img.id)) await store.putImage({ id: img.id, type: img.type, blob: new Blob([data], { type: img.type }), uploaded: false });
  }
  const existed = !!store.world(world.id);
  const flagged = () => [...store.data.articles.values()].filter((a) => a.conflict && !a.deleted).length;
  const before = flagged();
  const wasDemo = store.isDemo(world.id);
  if (wasDemo) await store.keepDemo(world.id);
  await store.mergeRecords(body, { history });
  await store.mergeHistory(history);
  await store.saveMeta({ localRev: store.meta.localRev + 1 });
  store.notify({ local: true, store: 'worlds' });
  return { wid: world.id, name: world.name, added: !existed, clashes: flagged() - before };
}
