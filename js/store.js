import * as db from './db.js';
import { uid } from './util.js';

// Article templates. `fields` pre-populate the infobox in the editor.
export const TYPES = {
  character:    { label: 'Character',    plural: 'Characters',    icon: '👤', fields: ['Full name', 'Species', 'Age', 'Born', 'Died', 'Occupation', 'Affiliation', 'Residence'] },
  location:     { label: 'Location',     plural: 'Locations',     icon: '🏰', fields: ['Type', 'Region', 'Population', 'Ruler', 'Founded', 'Climate'] },
  organization: { label: 'Organization', plural: 'Organizations', icon: '⚜️', fields: ['Type', 'Leader', 'Founded', 'Headquarters', 'Members', 'Motto'] },
  species:      { label: 'Species',      plural: 'Species',       icon: '🐉', fields: ['Lifespan', 'Height', 'Habitat', 'Diet', 'Language'] },
  item:         { label: 'Item',         plural: 'Items',         icon: '⚔️', fields: ['Type', 'Creator', 'Owner', 'Rarity', 'Material'] },
  event:        { label: 'Event',        plural: 'Events',        icon: '📜', fields: ['Type', 'Location', 'Participants', 'Outcome'] },
  religion:     { label: 'Religion',     plural: 'Religions & Deities', icon: '✨', fields: ['Deity', 'Domains', 'Symbol', 'Followers'] },
  culture:      { label: 'Culture',      plural: 'Cultures & Languages', icon: '🗣️', fields: ['Region', 'Language', 'Values', 'Customs'] },
  lore:         { label: 'Lore',         plural: 'Lore & Documents', icon: '📖', fields: ['Author', 'Written'] },
  article:      { label: 'Article',      plural: 'Other articles', icon: '📄', fields: [] },
};

export const data = { worlds: new Map(), articles: new Map(), maps: new Map() };
export let meta = { key: 'sync', localRev: 0, syncedRev: 0, eTag: null, lastSync: null };

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (detail) => listeners.forEach((fn) => fn(detail));
export const notify = emit;

export async function load() {
  for (const s of db.RECORD_STORES) {
    data[s].clear();
    for (const o of await db.getAll(s)) data[s].set(o.id, o);
  }
  meta = (await db.get('meta', 'sync')) || meta;
}

export async function saveMeta(patch) {
  Object.assign(meta, patch);
  await db.put('meta', meta);
}

export const isDirty = () => meta.localRev > meta.syncedRev;

// --- writes -------------------------------------------------------------

export async function save(store, obj) {
  obj.updatedAt = Date.now();
  obj.createdAt ??= obj.updatedAt;
  data[store].set(obj.id, obj);
  await db.put(store, obj);
  await saveMeta({ localRev: meta.localRev + 1 });
  emit({ local: true, store, id: obj.id });
  return obj;
}

async function tombstone(store, id) {
  const o = data[store].get(id);
  if (!o || o.deleted) return;
  await save(store, { id, worldId: o.worldId, deleted: true });
}

export async function deleteArticle(id) {
  const a = data.articles.get(id);
  if (!a) return;
  // Re-home children to this article's parent so they don't become orphans.
  for (const c of articlesOf(a.worldId).filter((c) => c.parentId === id)) {
    await save('articles', { ...c, parentId: a.parentId || null });
  }
  await tombstone('articles', id);
}

export async function deleteMap(id) { await tombstone('maps', id); }

export async function deleteWorld(id) {
  for (const a of articlesOf(id)) await tombstone('articles', a.id);
  for (const m of mapsOf(id)) await tombstone('maps', m.id);
  await tombstone('worlds', id);
}

// Apply records that came from elsewhere (sync / import) without bumping localRev.
export async function applyRemote(store, records) {
  await db.putMany(store, records);
  for (const r of records) data[store].set(r.id, r);
  if (records.length) emit({ local: false, store });
}

// Merge records from another copy (OneDrive or a backup file): per record,
// the newer updatedAt wins. Returns true if local has anything `other` lacks.
export async function mergeRecords(other) {
  let localAhead = false;
  for (const s of db.RECORD_STORES) {
    const incoming = [];
    const otherById = new Map((other[s] || []).map((r) => [r.id, r]));
    for (const r of otherById.values()) {
      const l = data[s].get(r.id);
      if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) incoming.push(r);
    }
    for (const l of data[s].values()) {
      const r = otherById.get(l.id);
      if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) localAhead = true;
    }
    await applyRemote(s, incoming);
  }
  return localAhead;
}

// --- reads --------------------------------------------------------------

const live = (o) => o && !o.deleted;
export const worlds = () => [...data.worlds.values()].filter(live).sort((a, b) => a.name.localeCompare(b.name));
export const world = (id) => (live(data.worlds.get(id)) ? data.worlds.get(id) : null);
export const article = (id) => (live(data.articles.get(id)) ? data.articles.get(id) : null);
export const map = (id) => (live(data.maps.get(id)) ? data.maps.get(id) : null);
export const articlesOf = (wid) => [...data.articles.values()].filter((a) => live(a) && a.worldId === wid);
export const mapsOf = (wid) => [...data.maps.values()].filter((m) => live(m) && m.worldId === wid).sort((a, b) => a.name.localeCompare(b.name));

export const byTitle = (wid, title) => {
  const t = title.trim().toLowerCase();
  return articlesOf(wid).find((a) => a.title.trim().toLowerCase() === t) || null;
};

export function ancestors(a) {
  const out = [];
  const seen = new Set([a.id]);
  let p = a.parentId && article(a.parentId);
  while (p && !seen.has(p.id)) { out.unshift(p); seen.add(p.id); p = p.parentId && article(p.parentId); }
  return out;
}

export function descendantIds(a) {
  const all = articlesOf(a.worldId);
  const out = new Set();
  const walk = (id) => all.filter((c) => c.parentId === id && !out.has(c.id)).forEach((c) => { out.add(c.id); walk(c.id); });
  walk(a.id);
  return out;
}

const linkRe = /\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\]/g;
export function linkedTitles(text) {
  return [...String(text || '').matchAll(linkRe)].map((m) => m[1].trim().toLowerCase());
}

export function articleText(a) {
  return [a.summary, a.body, a.gmNotes, ...Object.values(a.fields || {})].join('\n');
}

export function backlinks(a) {
  const t = a.title.trim().toLowerCase();
  return articlesOf(a.worldId).filter((o) => o.id !== a.id && linkedTitles(articleText(o)).includes(t));
}

// Rewrite [[Old]] / [[Old|label]] references after a rename.
export async function renameReferences(wid, oldTitle, newTitle) {
  const re = new RegExp('\\[\\[\\s*' + oldTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\|[^\\]\\n]*)?\\]\\]', 'gi');
  const fix = (s) => (s ? s.replace(re, (_, lbl) => `[[${newTitle}${lbl || ''}]]`) : s);
  for (const o of articlesOf(wid)) {
    const fields = Object.fromEntries(Object.entries(o.fields || {}).map(([k, v]) => [k, fix(v)]));
    const next = { ...o, summary: fix(o.summary), body: fix(o.body), gmNotes: fix(o.gmNotes), fields };
    if (JSON.stringify(next) !== JSON.stringify(o)) await save('articles', next);
  }
}

export function allTags(wid) {
  const counts = new Map();
  for (const a of articlesOf(wid)) for (const t of a.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
}

// --- images -------------------------------------------------------------

const urlCache = new Map();

export async function addImage(blob) {
  const id = uid();
  await db.put('images', { id, blob, type: blob.type || 'image/jpeg', uploaded: false });
  await saveMeta({ localRev: meta.localRev + 1 });
  emit({ local: true, store: 'images', id });
  return id;
}

export async function imageURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.get('images', id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export const getImage = (id) => db.get('images', id);
export const putImage = (rec) => db.put('images', rec);
export const imageIds = () => db.getAllKeys('images');

export function referencedImages() {
  const ids = new Set();
  for (const w of data.worlds.values()) if (live(w) && w.image) ids.add(w.image);
  for (const a of data.articles.values()) if (live(a) && a.image) ids.add(a.image);
  for (const m of data.maps.values()) if (live(m) && m.image) ids.add(m.image);
  return ids;
}

export function newArticle(worldId, type = 'article', extra = {}) {
  return {
    id: uid(), worldId, type, title: '', parentId: null, tags: [], summary: '', body: '',
    fields: Object.fromEntries((TYPES[type]?.fields || []).map((f) => [f, ''])),
    gmNotes: '', image: null, start: null, end: null, dateLabel: '', ...extra,
  };
}
