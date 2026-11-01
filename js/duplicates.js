// Finding and merging duplicate articles: the same thing written up twice
// under slightly different names ("Black Helm" / "The Black Helm",
// "Sea Watch" / "Seawatch", a typo). Titles are unique, so these are near
// matches; pairs marked "not duplicates" are remembered on the world.
import * as store from './store.js';

// "The Black Helm" → "blackhelm"; plural and people-of endings dropped per word.
function key(title) {
  return String(title || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an)\s+/, '').split(/[^a-z0-9]+/).filter(Boolean)
    .map((w) => (w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(ves)$/, 'f').replace(/(ean|ian|es|s)$/, '') : w)).join('');
}

// Edit distance, stopping early once it's over `max`.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// How alike two names are: 'same' (equal once tidied) or 'similar' (a letter or two apart), else null.
function likeness(x, y) {
  const a = key(x), b = key(y);
  if (!a || !b) return null;
  if (a === b) return 'same';
  const max = Math.min(a.length, b.length) >= 12 ? 2 : Math.min(a.length, b.length) >= 6 ? 1 : 0;
  return max && distance(a, b, max) <= max ? 'similar' : null;
}

const pairKey = (x, y) => [x, y].sort().join('|');
const dismissed = (wid) => new Set(store.world(wid)?.notDuplicates || []);

// Every pair of articles in a world that may be the same thing:
// [{ a, b, how: 'same' | 'similar' }], same-name pairs first.
export function findDuplicates(wid) {
  const arts = store.articlesOf(wid);
  const skip = dismissed(wid);
  const out = [];
  for (let i = 0; i < arts.length; i++) {
    for (let j = i + 1; j < arts.length; j++) {
      const a = arts[i], b = arts[j];
      if (skip.has(pairKey(a.id, b.id))) continue;
      let how = null;
      for (const n of store.namesOf(a)) for (const m of store.namesOf(b)) {
        const l = likeness(n, m);
        if (l === 'same') how = 'same'; else if (l && !how) how = l;
      }
      if (how) out.push({ a, b, how });
    }
  }
  return out.sort((p, q) => (p.how === q.how ? p.a.title.localeCompare(q.a.title) : p.how === 'same' ? -1 : 1));
}

// Articles whose names look like `title` (for a warning while naming one).
export function similarTo(wid, title, exceptId) {
  if (!String(title || '').trim()) return [];
  return store.articlesOf(wid).filter((a) => a.id !== exceptId && store.namesOf(a).some((n) => likeness(n, title)));
}

export async function notDuplicates(wid, aId, bId) {
  const w = store.world(wid);
  await store.save('worlds', { ...w, notDuplicates: [...new Set([...(w.notDuplicates || []), pairKey(aId, bId)])] });
}

// What merging `drop` into `keep` will do, for the confirmation.
export function mergePlan(keep, drop) {
  const wid = keep.worldId;
  const others = store.articlesOf(wid).filter((o) => o.id !== drop.id && o.id !== keep.id);
  const fields = Object.entries(drop.fields || {}).filter(([, v]) => String(v || '').trim());
  return {
    text: !!drop.body?.trim() || !!drop.gmNotes?.trim(),
    fieldsFilled: fields.filter(([k]) => !String(keep.fields?.[k] || '').trim()).length,
    fieldsKept: fields.filter(([k, v]) => String(keep.fields?.[k] || '').trim() && keep.fields[k] !== v).length,
    relations: (drop.relations || []).filter((r) => r.target !== keep.id && !(keep.relations || []).some((k) => k.type === r.type && (k.target || k.name) === (r.target || r.name))).length
      + others.filter((o) => (o.relations || []).some((r) => r.target === drop.id)).length,
    children: others.filter((o) => o.parentId === drop.id).length,
    places: store.mapsOf(wid).reduce((n, m) => n + [...(m.pins || []), ...(m.regions || [])].filter((it) => it.articleId === drop.id).length, 0),
  };
}

// Merge `drop` into `keep`: its names become keep's other names (so links to
// it still work), its text is added under a heading, empty fields are filled,
// its relationships, sub-articles, map places and answered prompts move over;
// then it's deleted (restorable from Recently deleted).
export async function mergeArticles(keepId, dropId) {
  const keep = structuredClone(store.article(keepId)), drop = store.article(dropId);
  const wid = keep.worldId;
  const add = (a, b, heading) => (b?.trim() ? (a?.trim() ? `${a.trimEnd()}\n\n## ${heading}\n\n${b.trim()}` : b.trim()) : a || '');
  keep.aliases = [...new Map([...(keep.aliases || []), drop.title, ...(drop.aliases || [])]
    .filter((n) => n && n.toLowerCase() !== keep.title.toLowerCase()).map((n) => [n.toLowerCase(), n])).values()];
  keep.summary ||= drop.summary || '';
  keep.body = add(keep.body, drop.body, `From “${drop.title}”`);
  keep.gmNotes = add(keep.gmNotes, drop.gmNotes, `From “${drop.title}”`);
  keep.fields = { ...(keep.fields || {}) };
  for (const [k, v] of Object.entries(drop.fields || {})) {
    if (!String(v || '').trim()) continue;
    if (!String(keep.fields[k] || '').trim()) keep.fields[k] = v;
    else if (keep.fields[k] !== v) keep.fields[`${k} (from ${drop.title})`] = v;
  }
  keep.tags = [...new Set([...(keep.tags || []), ...(drop.tags || [])])];
  for (const k of ['image', 'imagePos', 'banner', 'bannerPos', 'mapId', 'start', 'startM', 'startD', 'end', 'endM', 'endD', 'dateLabel']) {
    if ((keep[k] == null || keep[k] === '') && drop[k] != null && drop[k] !== '') keep[k] = drop[k];
  }
  if (!keep.parentId && drop.parentId && drop.parentId !== keep.id) keep.parentId = drop.parentId;
  const seen = new Set((keep.relations || []).map((r) => r.type + (r.target || r.name)));
  for (const r of drop.relations || []) {
    if (r.target === keep.id || seen.has(r.type + (r.target || r.name))) continue;
    seen.add(r.type + (r.target || r.name));
    keep.relations = [...(keep.relations || []), { ...r, id: crypto.randomUUID() }];
  }
  // Relationships that pointed at keep from drop's side are now about itself: drop them.
  keep.relations = (keep.relations || []).filter((r) => r.target !== drop.id);
  await store.save('articles', keep);

  for (const o of store.articlesOf(wid)) {
    if (o.id === keep.id || o.id === drop.id) continue;
    const moved = (o.relations || []).some((r) => r.target === drop.id);
    if (moved || o.parentId === drop.id) {
      await store.save('articles', { ...o, parentId: o.parentId === drop.id ? keep.id : o.parentId,
        relations: (o.relations || []).map((r) => (r.target === drop.id ? { ...r, target: keep.id } : r)) });
    }
  }
  for (const m of store.mapsOf(wid)) {
    const fix = (list) => (list || []).map((it) => (it.articleId === drop.id ? { ...it, articleId: keep.id } : it));
    if ([...(m.pins || []), ...(m.regions || [])].some((it) => it.articleId === drop.id)) await store.save('maps', { ...m, pins: fix(m.pins), regions: fix(m.regions) });
  }
  const w = store.world(wid);
  if (w.prompts?.answered) {
    const answered = Object.fromEntries(Object.entries(w.prompts.answered).map(([k, ids]) => [k, [...new Set(ids.map((i) => (i === drop.id ? keep.id : i)))]]));
    await store.save('worlds', { ...w, prompts: { ...w.prompts, answered } });
  }
  await store.deleteArticle(drop.id);
  return store.article(keep.id);
}
