import * as db from './db.js';
import { uid } from './util.js';

import { TYPES } from './templates.js';
export { TYPES, GROUPS, sectionsOf } from './templates.js';

export const data = { worlds: new Map(), articles: new Map(), maps: new Map(), history: new Map() };
export const HISTORY_LIMIT = 40;
export let meta = { key: 'sync', localRev: 0, syncedRev: 0, eTags: {}, lastSync: null };

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (detail) => listeners.forEach((fn) => fn(detail));
export const notify = emit;

export async function load() {
  for (const s of db.RECORD_STORES) {
    data[s].clear();
    for (const o of await db.getAll(s)) data[s].set(o.id, o);
  }
  data.history.clear();
  for (const h of await db.getAll('history')) data.history.set(h.id, h);
  meta = (await db.get('meta', 'sync')) || meta;
  meta.eTags ??= meta.eTag ? { 'atlas.json': meta.eTag } : {};
  syncBase = (await db.get('meta', 'base'))?.map || {};
}

export async function saveMeta(patch) {
  Object.assign(meta, patch);
  await db.put('meta', meta);
}

export const isDirty = () => meta.localRev > meta.syncedRev;

// --- writes -------------------------------------------------------------

export async function save(store, obj) {
  // Never older than the version it replaces, so a device with a slow clock
  // can't produce an edit that loses to the text it was based on.
  obj.updatedAt = Math.max(Date.now(), (data[store].get(obj.id)?.updatedAt || 0) + 1);
  obj.createdAt ??= obj.updatedAt;
  data[store].set(obj.id, obj);
  await db.put(store, obj);
  if (store === 'articles' && !obj.deleted) await recordVersion(obj);
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

// The updatedAt of each record as last agreed with OneDrive. Lets a merge tell
// "both devices edited this since the last sync" (a conflict) from "one side
// is simply newer".
let syncBase = {};

// `snapshot` is { id: updatedAt } of exactly what was uploaded or found equal,
// so edits made while a sync was in flight still count as unsynced.
export async function markSynced(snapshot) {
  Object.assign(syncBase, snapshot);
  await db.put('meta', { key: 'base', map: syncBase });
}

export async function resetSyncBase() {
  syncBase = {};
  await db.put('meta', { key: 'base', map: syncBase });
}

const sameContent = (a, b) => JSON.stringify(contentOf(a)) === JSON.stringify(contentOf(b));

// Merge records from another copy (OneDrive or a backup file): per record,
// the newer updatedAt wins. With detectConflicts, an article edited on both
// sides since the last sync keeps the local text and carries the other
// version in `conflict` until the user resolves it (this syncs, so every
// device sees the conflict). Returns true if local has anything `other` lacks.
export async function mergeRecords(other, { detectConflicts = false } = {}) {
  let localAhead = false;
  let newConflicts = 0;
  for (const s of db.RECORD_STORES) {
    const incoming = [];
    const marked = [];
    const otherById = new Map((other[s] || []).map((r) => [r.id, r]));
    for (const r of otherById.values()) {
      const l = data[s].get(r.id);
      if (!l) { incoming.push(r); continue; }
      const lu = l.updatedAt || 0, ru = r.updatedAt || 0;
      if (lu === ru) continue;
      const b = syncBase[r.id];
      if (detectConflicts && s === 'articles' && !l.deleted && !r.deleted && b != null && lu > b && ru > b && !sameContent(l, r)) {
        if (r.conflict && sameContent(r.conflict.theirs, l)) { incoming.push(r); continue; } // they already hold our version
        if (l.conflict && sameContent(l.conflict.theirs, r)) { // we already hold theirs; make sure ours wins the upload
          if (ru >= lu) marked.push({ ...l, updatedAt: ru + 1 });
          continue;
        }
        marked.push({ ...l, conflict: { theirs: contentOf(r), theirsAt: ru, at: Date.now() }, updatedAt: Math.max(lu, ru) + 1 });
        newConflicts++;
        continue;
      }
      if (ru > lu) incoming.push(r);
    }
    for (const l of data[s].values()) {
      if (!syncable(l)) continue;
      const r = otherById.get(l.id);
      if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) localAhead = true;
    }
    if (marked.length) localAhead = true;
    await applyRemote(s, [...incoming, ...marked]);
  }
  if (newConflicts) emit({ local: false, store: 'articles', conflicts: newConflicts });
  return localAhead;
}

export const conflictsOf = (wid) => articlesOf(wid).filter((a) => a.conflict);

// Save the user's merged result and clear the conflict.
export async function resolveConflict(id, content) {
  const a = { ...data.articles.get(id), ...content };
  delete a.conflict;
  return save('articles', a);
}

// --- article history ------------------------------------------------------
// Every save of an article stores a snapshot. History syncs (append-only) via
// its own OneDrive file and is pruned to the newest HISTORY_LIMIT per article.

const CONTENT_KEYS = ['title', 'type', 'parentId', 'tags', 'summary', 'body', 'fields', 'gmNotes', 'image', 'imagePos', 'banner', 'bannerPos',
  'start', 'startM', 'startD', 'end', 'endM', 'endD', 'dateLabel', 'relations'];
export const contentOf = (a) => Object.fromEntries(CONTENT_KEYS.map((k) => [k, a[k] ?? null]));

async function recordVersion(a) {
  const last = historyOf(a.id)[0];
  const snapshot = contentOf(a);
  if (last && JSON.stringify(last.snapshot) === JSON.stringify(snapshot)) return;
  const h = { id: uid(), articleId: a.id, worldId: a.worldId, savedAt: a.updatedAt, updatedAt: a.updatedAt, snapshot };
  data.history.set(h.id, h);
  await db.put('history', h);
  await pruneHistory(a.id);
}

export const historyOf = (articleId) =>
  [...data.history.values()].filter((h) => h.articleId === articleId).sort((x, y) => y.savedAt - x.savedAt);

async function pruneHistory(articleId) {
  const extra = historyOf(articleId).slice(HISTORY_LIMIT).map((h) => h.id);
  extra.forEach((id) => data.history.delete(id));
  await db.del('history', extra);
}

// Merge history from another copy; returns true if local has versions `other` lacks.
export async function mergeHistory(list = []) {
  const theirs = new Set(list.map((h) => h.id));
  const incoming = list.filter((h) => !data.history.has(h.id));
  await db.putMany('history', incoming);
  incoming.forEach((h) => data.history.set(h.id, h));
  for (const id of new Set(incoming.map((h) => h.articleId))) await pruneHistory(id);
  return [...data.history.values()].some((h) => !theirs.has(h.id) && syncable(h));
}

// Restoring writes the snapshot as a new current version (and revives a deleted article).
export async function restoreVersion(h) {
  const cur = data.articles.get(h.articleId) || {};
  const a = { ...cur, ...structuredClone(h.snapshot), id: h.articleId, worldId: h.worldId, deleted: undefined };
  delete a.deleted;
  return save('articles', a);
}

export function deletedArticles(wid) {
  return [...data.articles.values()]
    .filter((a) => a.deleted && a.worldId === wid)
    .map((a) => ({ tomb: a, last: historyOf(a.id)[0] }))
    .filter((x) => x.last)
    .sort((x, y) => y.tomb.updatedAt - x.tomb.updatedAt);
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

// Images used by live records; `demo` selects the demo world's instead of synced ones.
export function referencedImages({ demo = false } = {}) {
  const ids = new Set();
  const want = (o) => live(o) && syncable(o) !== demo;
  for (const w of data.worlds.values()) if (want(w)) {
    if (w.image) ids.add(w.image);
    if (w.background?.image) ids.add(w.background.image);
    for (const f of w.fonts || []) if (f.file) ids.add(f.file); // the world's own fonts
  }
  for (const a of data.articles.values()) if (want(a)) { if (a.image) ids.add(a.image); if (a.banner) ids.add(a.banner); }
  for (const m of data.maps.values()) if (want(m) && m.image) ids.add(m.image);
  return ids;
}

// --- demo world -------------------------------------------------------------
// The example world shown on a fresh install lives only on this device: it is
// never uploaded, and removing it deletes it outright rather than leaving
// deletion records to sync.

export const isDemo = (wid) => !!data.worlds.get(wid)?.demo;
export const syncable = (r) => !(r.demo || data.worlds.get(r.worldId)?.demo);

export async function removeDemo(wid) {
  if (!isDemo(wid)) return;
  const images = [...referencedImages({ demo: true })];
  for (const s of ['articles', 'maps', 'history']) {
    const ids = [...data[s].values()].filter((r) => r.worldId === wid).map((r) => r.id);
    ids.forEach((id) => data[s].delete(id));
    await db.del(s, ids);
  }
  data.worlds.delete(wid);
  await db.del('worlds', [wid]);
  await db.del('images', images);
  emit({ local: true, store: 'worlds' }); // the caller navigates away itself
}

// Turn the demo into a normal world that syncs like any other.
export async function keepDemo(wid) {
  const w = data.worlds.get(wid);
  if (!w?.demo) return;
  const next = { ...w };
  delete next.demo;
  await save('worlds', next);
}

export function newArticle(worldId, type = 'article', extra = {}) {
  return {
    id: uid(), worldId, type, title: '', parentId: null, tags: [], summary: '', body: '',
    fields: Object.fromEntries((TYPES[type]?.fields || []).map((f) => [f, ''])),
    gmNotes: '', image: null, banner: null, start: null, startM: null, startD: null, end: null, endM: null, endD: null,
    dateLabel: '', relations: [], ...extra,
  };
}
