// Typed relationships between articles. A relation is stored on one article as
// { id, type, target, note } and reads "<this> is <label> <target>". The other
// side sees the inverse automatically (parent of ↔ child of, etc.).
import * as store from './store.js';

export const REL_TYPES = {
  parent:     { label: 'Parent of',        inverse: 'child',      group: 'family' },
  child:      { label: 'Child of',         inverse: 'parent',     group: 'family' },
  spouse:     { label: 'Spouse of',        inverse: 'spouse',     group: 'family' },
  sibling:    { label: 'Sibling of',       inverse: 'sibling',    group: 'family' },
  partner:    { label: 'Partner of',       inverse: 'partner',    group: 'family' },
  friend:     { label: 'Friend of',        inverse: 'friend',     group: 'bond' },
  ally:       { label: 'Ally of',          inverse: 'ally',       group: 'bond' },
  mentor:     { label: 'Mentor of',        inverse: 'student',    group: 'bond' },
  student:    { label: 'Student of',       inverse: 'mentor',     group: 'bond' },
  rival:      { label: 'Rival of',         inverse: 'rival',      group: 'conflict' },
  enemy:      { label: 'Enemy of',         inverse: 'enemy',      group: 'conflict' },
  member:     { label: 'Member of',        inverse: 'hasMember',  group: 'affiliation' },
  hasMember:  { label: 'Has member',       inverse: 'member',     group: 'affiliation' },
  leader:     { label: 'Leader of',        inverse: 'ledBy',      group: 'affiliation' },
  ledBy:      { label: 'Led by',           inverse: 'leader',     group: 'affiliation' },
  rules:      { label: 'Rules',            inverse: 'ruledBy',    group: 'affiliation' },
  ruledBy:    { label: 'Ruled by',         inverse: 'rules',      group: 'affiliation' },
  serves:     { label: 'Serves',           inverse: 'servedBy',   group: 'affiliation' },
  servedBy:   { label: 'Served by',        inverse: 'serves',     group: 'affiliation' },
  worships:   { label: 'Worships',         inverse: 'worshippedBy', group: 'affiliation' },
  worshippedBy: { label: 'Worshipped by',  inverse: 'worships',   group: 'affiliation' },
  created:    { label: 'Creator of',       inverse: 'createdBy',  group: 'affiliation' },
  createdBy:  { label: 'Created by',       inverse: 'created',    group: 'affiliation' },
  owns:       { label: 'Owner of',         inverse: 'ownedBy',    group: 'affiliation' },
  ownedBy:    { label: 'Owned by',         inverse: 'owns',       group: 'affiliation' },
  related:    { label: 'Related to',       inverse: 'related',    group: 'other' },
};

export const REL_GROUPS = {
  family: 'Family', bond: 'Bonds', conflict: 'Conflict', affiliation: 'Affiliation', other: 'Other',
};

// All relationships touching article `a`, from both directions, deduplicated.
// Each item: { type, other, note, source } where type is from a's perspective.
export function relationsOf(a) {
  const out = [];
  const seen = new Set();
  const add = (type, other, note, source) => {
    if (!other || !REL_TYPES[type]) return;
    const key = type + ':' + other.id;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, other, note, source });
  };
  for (const r of a.relations || []) add(r.type, store.article(r.target), r.note, a.id);
  for (const o of store.articlesOf(a.worldId)) {
    if (o.id === a.id) continue;
    for (const r of o.relations || []) {
      if (r.target === a.id) add(REL_TYPES[r.type]?.inverse, o, r.note, o.id);
    }
  }
  return out;
}

// Every relationship in a world as undirected-for-display edges { from, to, type, note }.
export function worldEdges(wid) {
  const edges = [];
  const seen = new Set();
  for (const a of store.articlesOf(wid)) {
    for (const r of a.relations || []) {
      if (!store.article(r.target) || !REL_TYPES[r.type]) continue;
      const inv = REL_TYPES[r.type].inverse;
      const key = [a.id, r.type, r.target].join('|');
      const invKey = [r.target, inv, a.id].join('|');
      if (seen.has(key) || seen.has(invKey)) continue;
      seen.add(key);
      edges.push({ from: a.id, to: r.target, type: r.type, note: r.note || '' });
    }
  }
  return edges;
}

// Family links for trees: parents, children, spouses/partners, siblings of an article.
export function family(a) {
  const f = { parents: [], children: [], spouses: [], siblings: [] };
  for (const r of relationsOf(a)) {
    if (r.type === 'child') f.parents.push(r.other);
    else if (r.type === 'parent') f.children.push(r.other);
    else if (r.type === 'spouse' || r.type === 'partner') f.spouses.push(r.other);
    else if (r.type === 'sibling') f.siblings.push(r.other);
  }
  return f;
}

export const hasFamily = (a) => {
  const f = family(a);
  return f.parents.length + f.children.length + f.spouses.length + f.siblings.length > 0;
};
