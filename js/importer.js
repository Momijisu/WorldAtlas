// "WorldAtlas import" format: a simple, title-based JSON description of a world
// that people (or AI assistants) can write by hand. See docs/IMPORT_FORMAT.md.
//
// planImport() turns a parsed file into a reviewable plan (what will be created
// or updated, plus warnings) without saving anything; applyImport() saves it.
// exportSimple() produces the same format from an existing world.
import * as store from './store.js';
import { TYPES } from './store.js';
import { uid } from './util.js';
import { calendarOf, presetCalendar, PRESETS, formatDate, articleStart, articleEnd } from './calendar.js';
import { REL_TYPES } from './relations.js';

export const FORMAT = 'worldatlas-import';

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// --- template names ----------------------------------------------------------

const TYPE_ALIASES = {
  character: ['character', 'characters', 'person', 'people', 'npc', 'pc', 'hero', 'villain', 'figure', 'deity', 'god', 'goddess', 'spirit'],
  species: ['species', 'race', 'creature', 'creatures', 'animal', 'monster', 'beast', 'plant', 'flora', 'fauna'],
  culture: ['culture', 'cultures', 'ethnicity', 'people group', 'society'],
  profession: ['profession', 'job', 'trade', 'occupation', 'class', 'role'],
  title: ['title', 'rank', 'office', 'position', 'honorific'],
  location: ['location', 'locations', 'place', 'region', 'country', 'nation', 'kingdom', 'realm', 'continent', 'geography', 'landmark', 'forest', 'mountain', 'river', 'sea', 'island'],
  settlement: ['settlement', 'city', 'town', 'village', 'hamlet', 'capital', 'outpost', 'port'],
  building: ['building', 'castle', 'fortress', 'temple', 'tavern', 'inn', 'tower', 'palace', 'structure', 'dungeon'],
  organization: ['organization', 'organisation', 'organizations', 'faction', 'guild', 'order', 'house', 'family', 'clan', 'group', 'company', 'military', 'army', 'government'],
  religion: ['religion', 'religions', 'faith', 'pantheon', 'cult', 'church'],
  event: ['event', 'events', 'history', 'historical event', 'disaster', 'founding'],
  conflict: ['conflict', 'war', 'battle', 'rebellion', 'revolt', 'siege', 'feud', 'military conflict'],
  plot: ['plot', 'quest', 'storyline', 'adventure', 'hook', 'mission'],
  myth: ['myth', 'legend', 'folklore', 'folk tale', 'fable', 'prophecy'],
  spell: ['spell', 'power', 'ability', 'ritual', 'incantation', 'technique'],
  law: ['natural law', 'law of nature', 'magic system', 'magic', 'physics', 'system'],
  condition: ['condition', 'disease', 'illness', 'curse', 'plague', 'affliction', 'blessing', 'mutation'],
  technology: ['technology', 'tech', 'invention', 'device', 'machine'],
  item: ['item', 'items', 'artifact', 'artefact', 'object', 'weapon', 'armor', 'armour', 'relic', 'treasure'],
  vehicle: ['vehicle', 'ship', 'boat', 'airship', 'carriage', 'wagon', 'craft'],
  material: ['material', 'substance', 'resource', 'metal', 'mineral', 'herb', 'ore', 'gem'],
  tradition: ['tradition', 'custom', 'festival', 'holiday', 'rite', 'ceremony'],
  language: ['language', 'tongue', 'dialect', 'script'],
  lore: ['lore', 'document', 'book', 'text', 'letter', 'law', 'story'],
  article: ['article', 'generic', 'other', 'note', 'misc'],
};
const typeLookup = new Map(Object.entries(TYPE_ALIASES).flatMap(([t, names]) => names.map((n) => [n, t])));

function resolveType(raw, warn, title) {
  if (raw == null || raw === '') return 'article';
  const t = typeLookup.get(norm(raw));
  if (!t) warn(`“${title}”: unknown template “${raw}”, imported as a generic article.`);
  return t || 'article';
}

// --- relationship names --------------------------------------------------------

const REL_ALIASES = {
  parent: ['parent', 'father', 'mother', 'parent of'], child: ['child', 'son', 'daughter', 'child of'],
  spouse: ['spouse', 'husband', 'wife', 'married', 'married to', 'consort'], sibling: ['sibling', 'brother', 'sister', 'twin'],
  partner: ['partner', 'lover', 'betrothed', 'fiance', 'fiancee'], friend: ['friend'], ally: ['ally', 'allied with'],
  mentor: ['mentor', 'teacher', 'master'], student: ['student', 'apprentice', 'pupil'],
  rival: ['rival'], enemy: ['enemy', 'nemesis', 'foe', 'at war with'],
  member: ['member', 'member of', 'belongs to', 'part of'], hasMember: ['has member', 'includes'],
  leader: ['leader', 'leads', 'leader of', 'head of'], ledBy: ['led by'],
  rules: ['rules', 'ruler', 'ruler of', 'governs'], ruledBy: ['ruled by', 'governed by'],
  serves: ['serves', 'servant of', 'vassal of'], servedBy: ['served by'],
  worships: ['worships', 'follower of', 'devotee of'], worshippedBy: ['worshipped by', 'worshiped by'],
  created: ['created', 'creator', 'creator of', 'made', 'founded', 'founder of'], createdBy: ['created by', 'made by', 'founded by'],
  owns: ['owns', 'owner', 'owner of'], ownedBy: ['owned by'],
  locatedIn: ['located in', 'located', 'lies in', 'situated in', 'found in', 'within'],
  locationOf: ['location of', 'contains', 'home to', 'site of'],
  related: ['related', 'related to', 'associated with', 'connected to'],
};
const relLookup = new Map();
for (const [t, names] of Object.entries(REL_ALIASES)) {
  relLookup.set(norm(t), t);
  relLookup.set(norm(REL_TYPES[t].label), t);
  for (const n of names) relLookup.set(norm(n), t);
}
const resolveRel = (raw) => relLookup.get(norm(raw).replace(/^is (the |a |an )?/, '')) || null;

// --- calendar ------------------------------------------------------------------

function buildCalendar(c, warn) {
  if (!c) return null;
  const base = presetCalendar(PRESETS[c.preset] ? c.preset : 'standard');
  const months = Array.isArray(c.months) && c.months.length
    ? c.months.map((m) => (typeof m === 'string' ? { name: m.split(':')[0].trim(), days: +(m.split(':')[1] || 30) } : { name: String(m.name || '').trim(), days: +m.days || 30 })).filter((m) => m.name)
    : base.months;
  const weekdays = Array.isArray(c.weekdays) && c.weekdays.length ? c.weekdays.map(String) : base.weekdays;
  let epoch = 0;
  if (c.firstWeekday != null) {
    epoch = typeof c.firstWeekday === 'number' ? c.firstWeekday : weekdays.findIndex((d) => norm(d) === norm(c.firstWeekday));
    if (epoch < 0) { warn(`Calendar: first weekday “${c.firstWeekday}” isn’t one of the weekdays.`); epoch = 0; }
  }
  return {
    months, weekdays, epochWeekday: epoch,
    eras: (c.eras || []).map((e) => ({ name: String(e.name || ''), abbr: String(e.abbr || e.abbreviation || ''), start: numOr(e.start ?? e.startYear, ''), restart: !!(e.countFromOne ?? e.restart) })).filter((e) => e.name),
    moons: (c.moons || []).map((m) => ({ name: String(m.name || ''), cycle: +(m.cycle || m.cycleDays || 29.5), offset: +(m.offset || 0), color: /^#[0-9a-f]{3,8}$/i.test(m.color) ? m.color : '#c4a46a' })).filter((m) => m.name),
    currentYear: numOr(c.currentYear, null),
  };
}

const numOr = (v, d) => (v === '' || v == null || isNaN(+v) ? d : Math.round(+v));

// Parse "12 Frostmoot 1042 AF", "Frostmoot 1042", "1042", -300, {year, month, day}.
function parseDate(raw, cal, warn, label) {
  if (raw == null || raw === '') return null;
  const monthIndex = (m) => {
    if (m == null || m === '') return null;
    if (typeof m === 'number' || /^\d+$/.test(String(m))) {
      const i = +m - 1;
      return i >= 0 && i < cal.months.length ? i : undefined;
    }
    const i = cal.months.findIndex((x) => norm(x.name) === norm(m));
    return i >= 0 ? i : undefined;
  };
  const eraYear = (y, eraTxt) => {
    if (!eraTxt) return y;
    const era = cal.eras.find((e) => norm(e.abbr) === norm(eraTxt) || norm(e.name) === norm(eraTxt));
    if (!era) { warn(`${label}: unknown era “${eraTxt}”, year taken as written.`); return y; }
    return era.restart && isFinite(era.start) ? y + era.start - 1 : y;
  };
  let y, m = null, d = null;
  if (typeof raw === 'number') y = raw;
  else if (typeof raw === 'object') {
    y = raw.year ?? raw.y;
    if (y == null || isNaN(+y)) { warn(`${label}: date has no year.`); return null; }
    y = eraYear(+y, raw.era);
    m = monthIndex(raw.month ?? raw.m);
    if (m === undefined) { warn(`${label}: unknown month “${raw.month ?? raw.m}”.`); m = null; }
    d = m == null ? null : raw.day ?? raw.d ?? null;
  } else {
    const s = String(raw).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
    const yearMatch = s.match(/(-?\d+)\s*([A-Za-z][A-Za-z.' ]*)?$/);
    if (!yearMatch) { warn(`${label}: couldn’t read the date “${raw}”.`); return null; }
    y = eraYear(+yearMatch[1], yearMatch[2]?.trim());
    const rest = s.slice(0, yearMatch.index).trim();
    if (rest) {
      const dm = rest.match(/^(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?(.+)$/i) || rest.match(/^(.+?)\s+(\d+)(?:st|nd|rd|th)?$/i);
      let monthTxt = rest, dayTxt = null;
      if (dm) { if (/^\d/.test(dm[1])) { dayTxt = dm[1]; monthTxt = dm[2]; } else { monthTxt = dm[1]; dayTxt = dm[2]; } }
      m = monthIndex(monthTxt);
      if (m === undefined) { warn(`${label}: unknown month “${monthTxt}” in “${raw}”.`); m = null; dayTxt = null; }
      d = dayTxt;
    }
  }
  if (d != null) {
    d = Math.round(+d);
    if (!(d >= 1) || d > cal.months[m].days) { warn(`${label}: day ${d} doesn’t exist in ${cal.months[m].name}.`); d = null; }
  }
  return { y: Math.round(+y), m, d };
}

// --- planning --------------------------------------------------------------------

export function isImportFormat(json) {
  return json && (json.format === FORMAT || (Array.isArray(json.articles) && (json.world || json.articles.some((a) => a?.title))));
}

// targetWid: an existing world to merge into, or null to create a new world.
export function planImport(json, targetWid = null) {
  const warnings = [];
  const warn = (w) => warnings.push(w);
  const src = json.world || {};
  const existing = targetWid ? store.world(targetWid) : null;
  const worldName = String(src.name || existing?.name || 'Imported world').trim();
  const newCal = buildCalendar(src.calendar, warn);
  const world = existing
    ? { ...existing, ...(src.description != null ? { description: String(src.description) } : {}), ...(newCal ? { calendar: newCal } : {}) }
    : { id: uid(), name: worldName, description: String(src.description || ''), image: null, calendar: newCal || presetCalendar('standard') };
  const cal = calendarOf(world);

  // Pass 1: one entry per title.
  const entries = [];
  const byTitle = new Map();
  for (const [i, raw] of (json.articles || []).entries()) {
    const title = String(raw?.title || raw?.name || '').trim().replace(/[[\]|]/g, '');
    if (!title) { warn(`Article #${i + 1} has no title and was skipped.`); continue; }
    if (byTitle.has(norm(title))) { warn(`“${title}” appears more than once; later entries are merged into the first.`); }
    const prior = existing ? store.byTitle(existing.id, title) : null;
    const e = byTitle.get(norm(title)) || { title, raw: {}, prior, id: prior?.id || uid() };
    Object.assign(e.raw, raw);
    if (!byTitle.has(norm(title))) { byTitle.set(norm(title), e); entries.push(e); }
  }
  const idForTitle = (t) => byTitle.get(norm(t))?.id || (existing && store.byTitle(existing.id, t)?.id) || null;

  // Pass 2: build records.
  let create = 0, update = 0, same = 0;
  for (const e of entries) {
    const r = e.raw;
    const label = `“${e.title}”`;
    const has = (k) => r[k] !== undefined;
    const base = e.prior ? structuredClone(e.prior) : store.newArticle(world.id, 'article');
    const rec = { ...base, title: e.title, worldId: world.id, id: e.id };
    if (has('type') || !e.prior) rec.type = resolveType(r.type ?? r.template ?? r.category, warn, e.title);
    if (has('summary')) rec.summary = String(r.summary ?? '');
    if (has('body') || has('content') || has('text')) rec.body = String(r.body ?? r.content ?? r.text ?? '');
    if (has('secrets') || has('gmNotes')) rec.gmNotes = String(r.secrets ?? r.gmNotes ?? '');
    if (has('tags')) rec.tags = [...new Set((Array.isArray(r.tags) ? r.tags : String(r.tags).split(',')).map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))];
    const fields = r.fields ?? r.infobox;
    if (fields && typeof fields === 'object') {
      rec.fields = { ...(e.prior ? rec.fields : Object.fromEntries((TYPES[rec.type]?.fields || []).map((f) => [f, '']))) };
      for (const [k, v] of Object.entries(fields)) rec.fields[String(k).trim()] = v == null ? '' : String(v);
    } else if (!e.prior) {
      rec.fields = Object.fromEntries((TYPES[rec.type]?.fields || []).map((f) => [f, '']));
    }
    if (has('parent')) {
      if (!r.parent) rec.parentId = null;
      else {
        const pid = idForTitle(r.parent);
        if (!pid) warn(`${label}: parent “${r.parent}” wasn’t found.`);
        else if (pid === rec.id) warn(`${label}: can’t be its own parent.`);
        else rec.parentId = pid;
      }
    }
    if (has('date') || has('start')) {
      const s = parseDate(r.date ?? r.start, cal, warn, label);
      Object.assign(rec, { start: s?.y ?? null, startM: s?.m ?? null, startD: s?.d ?? null });
    }
    if (has('endDate') || has('end')) {
      const en = parseDate(r.endDate ?? r.end, cal, warn, label);
      Object.assign(rec, { end: en?.y ?? null, endM: en?.m ?? null, endD: en?.d ?? null });
    }
    if (has('dateText') || has('dateLabel')) rec.dateLabel = String(r.dateText ?? r.dateLabel ?? '');
    const rels = r.relationships ?? r.relations;
    if (Array.isArray(rels)) {
      const out = [];
      const seen = new Set();
      for (const rel of rels) {
        const typeTxt = rel?.type ?? rel?.relation ?? rel?.kind;
        const type = resolveRel(typeTxt);
        const target = idForTitle(rel?.target ?? rel?.to ?? rel?.with ?? '');
        if (!type) { warn(`${label}: unknown relationship “${typeTxt}”.`); continue; }
        if (!target) { warn(`${label}: relationship target “${rel?.target ?? rel?.to ?? rel?.with}” wasn’t found.`); continue; }
        if (target === rec.id || seen.has(type + target)) continue;
        seen.add(type + target);
        const old = (e.prior?.relations || []).find((x) => x.type === type && x.target === target);
        out.push({ id: old?.id || uid(), type, target, note: String(rel.note || '') });
      }
      rec.relations = out;
    }
    if (r.image || r.headerImage) e.images = { image: r.image, banner: r.headerImage };
    e.record = rec;
    if (!e.prior) { e.action = 'create'; create++; }
    else if (JSON.stringify(store.contentOf(e.prior)) === JSON.stringify(store.contentOf(rec)) && !e.images) { e.action = 'same'; same++; }
    else { e.action = 'update'; update++; }
  }

  const counts = {};
  for (const e of entries) counts[e.record.type] = (counts[e.record.type] || 0) + 1;
  return {
    world, isNewWorld: !existing, calendarChanged: !!newCal && !!existing,
    entries, counts, create, update, same, warnings,
  };
}

async function fetchImage(url) {
  const blob = await (await fetch(url)).blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  return store.addImage(blob);
}

export async function applyImport(plan) {
  const failedImages = [];
  if (plan.isNewWorld || plan.calendarChanged || plan.world.description !== store.world(plan.world.id)?.description) {
    await store.save('worlds', plan.world);
  }
  for (const e of plan.entries) {
    if (e.action === 'same') continue;
    for (const [key, url] of Object.entries(e.images || {})) {
      if (!url) continue;
      try { e.record[key] = await fetchImage(url); } catch { failedImages.push(e.title); }
    }
    await store.save('articles', e.record);
  }
  return { wid: plan.world.id, failedImages };
}

// --- export ----------------------------------------------------------------------

export function exportSimple(wid) {
  const w = store.world(wid);
  const cal = calendarOf(w);
  const c = w.calendar || presetCalendar('standard');
  const title = (id) => store.article(id)?.title;
  const dateOut = (d) => (d ? formatDate({ ...cal, eras: [] }, d) : undefined);
  return {
    format: FORMAT,
    version: 1,
    world: {
      name: w.name,
      description: w.description || '',
      calendar: {
        months: c.months, weekdays: c.weekdays, firstWeekday: c.weekdays?.[c.epochWeekday || 0],
        eras: (c.eras || []).map((e) => ({ name: e.name, abbr: e.abbr, start: e.start === '' ? null : e.start, countFromOne: !!e.restart })),
        moons: c.moons || [], currentYear: c.currentYear ?? null,
      },
    },
    articles: store.articlesOf(wid).sort((a, b) => a.title.localeCompare(b.title)).map((a) => {
      const fields = Object.fromEntries(Object.entries(a.fields || {}).filter(([, v]) => String(v).trim()));
      const out = {
        title: a.title, type: a.type,
        parent: title(a.parentId),
        summary: a.summary || undefined,
        tags: a.tags?.length ? a.tags : undefined,
        date: dateOut(articleStart(a)), endDate: dateOut(articleEnd(a)), dateText: a.dateLabel || undefined,
        fields: Object.keys(fields).length ? fields : undefined,
        relationships: (a.relations || []).filter((r) => title(r.target)).map((r) => ({ type: r.type, target: title(r.target), ...(r.note ? { note: r.note } : {}) })),
        body: a.body || undefined,
        secrets: a.gmNotes || undefined,
      };
      if (!out.relationships.length) delete out.relationships;
      return JSON.parse(JSON.stringify(out));
    }),
  };
}
