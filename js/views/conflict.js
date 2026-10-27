// Merge resolver for an article edited on two devices before they synced.
// Shows each differing field side by side; the user picks a version (or
// combines both) per field, can hand-edit merged text, and saves the result.
import * as store from '../store.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { REL_TYPES } from '../relations.js';
import { $, $$, esc, toast, timeAgo } from '../util.js';
import { view, state, setTitle, pageHead, icon, typeLabel, worldCrumb, sep } from '../ui.js';
import { lineDiff } from './history.js';

const DATE_KEYS = ['start', 'startM', 'startD', 'end', 'endM', 'endD', 'dateLabel'];
const titleOf = (id) => (id ? store.data.articles.get(id)?.title || '(deleted article)' : 'None');
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const relKey = (r) => r.type + '|' + r.target;
const relText = (r) => `${REL_TYPES[r.type]?.label || r.type} ${titleOf(r.target)}${r.note ? ` (${r.note})` : ''}`;

// The fields that differ between the two versions, as resolver blocks.
function blocksFor(cur, other, cal) {
  const out = [];
  const add = (b) => out.push(b);
  if (!same(cur.title, other.title)) add({ id: 'title', label: 'Title', kind: 'line' });
  if (!same(cur.type, other.type)) add({ id: 'type', label: 'Template', fmt: (v) => typeLabel(v.type) });
  if (!same(cur.parentId, other.parentId)) add({ id: 'parentId', label: 'Part of', fmt: (v) => titleOf(v.parentId) });
  if (!same(DATE_KEYS.map((k) => cur[k]), DATE_KEYS.map((k) => other[k]))) add({ id: 'date', label: 'Date', fmt: (v) => articleDateText(cal, v) || 'No date' });
  for (const k of ['summary', 'body', 'gmNotes']) {
    if (!same(cur[k] || '', other[k] || '')) add({ id: k, label: { summary: 'Summary', body: 'Content', gmNotes: 'Secrets & GM notes' }[k], kind: 'text' });
  }
  const keys = new Set([...Object.keys(cur.fields || {}), ...Object.keys(other.fields || {})]);
  for (const k of keys) {
    if (!same(cur.fields?.[k] ?? '', other.fields?.[k] ?? '')) add({ id: 'field:' + k, label: 'Infobox · ' + k, fmt: (v) => v.fields?.[k] ?? 'Not set' });
  }
  if (!same([...(cur.tags || [])].sort(), [...(other.tags || [])].sort())) add({ id: 'tags', label: 'Tags', kind: 'set', fmt: (v) => (v.tags || []).map((t) => '#' + t).join('  ') || 'None' });
  if (!same((cur.relations || []).map(relKey).sort(), (other.relations || []).map(relKey).sort()) || !same(cur.relations, other.relations)) {
    add({ id: 'relations', label: 'Relationships', kind: 'set', fmt: (v) => (v.relations || []).map(relText).join('\n') || 'None' });
  }
  for (const k of ['image', 'banner']) {
    if (!same(cur[k], other[k])) add({ id: k, label: k === 'image' ? 'Portrait / image' : 'Header image', kind: 'image' });
  }
  return out;
}

export function viewResolve(wid, aid) {
  const a = store.article(aid);
  if (!a.conflict) {
    view.innerHTML = `<section class="page narrow">${pageHead({ eyebrow: worldCrumb(wid), title: 'No conflict' })}
      <p>“${esc(a.title)}” has no conflicting edits. <a href="#/w/${wid}/a/${aid}">Back to the article</a>.</p></section>`;
    return;
  }
  const cal = calendarOf(store.world(wid));
  const cur = store.contentOf(a);
  const other = store.contentOf(a.conflict.theirs);
  const curAt = store.historyOf(aid).find((h) => same(store.contentOf(h.snapshot), cur))?.savedAt;
  const blocks = blocksFor(cur, other, cal);
  const choice = Object.fromEntries(blocks.map((b) => [b.id, b.kind === 'set' ? 'both' : 'cur']));
  let dirty = false;
  state.guard = () => dirty;
  state.guardMessage = 'Leave without saving your merge?';
  setTitle('Resolve conflict · ' + a.title);

  const side = (b, which, v) => {
    const label = which === 'cur' ? 'Current version' : 'Other version';
    const when = which === 'cur' ? (curAt ? 'saved ' + timeAgo(curAt) : '') : 'saved ' + timeAgo(a.conflict.theirsAt);
    let body;
    if (b.kind === 'image') body = v[b.id] ? `<img class="cf-img" data-img="${v[b.id]}" alt="">` : '<span class="muted">No image</span>';
    else if (b.kind === 'text' || b.kind === 'line') body = `<div class="cf-text">${esc(v[b.id] || '') || '<span class="muted">Empty</span>'}</div>`;
    else body = `<div class="cf-text">${esc(b.fmt(v))}</div>`;
    return `<button type="button" class="cf-side" data-pick="${which}"><span class="cf-side-head"><span class="cf-radio"></span>${label}<small>${esc(when)}</small></span>${body}</button>`;
  };

  view.innerHTML = `<form class="page resolver" id="rf">
    ${pageHead({
      sticky: true,
      eyebrow: `${worldCrumb(wid)} ${sep} <a href="#/w/${wid}/a/${aid}">${esc(a.title)}</a> ${sep} Conflict`,
      title: 'Resolve conflicting edits',
      actions: `<a class="btn quiet" href="#/w/${wid}/a/${aid}">Later</a><button class="btn primary">${icon('check')} Save merged version</button>`,
    })}
    <div class="conflict-banner">${icon('warning')}<div>
      <b>This article was changed on two devices before they synced.</b>
      Pick a version for each difference below. Tags and relationships can be combined, and text can be edited.
      <div class="actions left" style="margin-top:.7rem">
        <button type="button" class="btn small" data-all="cur">Use current for all</button>
        <button type="button" class="btn small" data-all="other">Use other for all</button>
      </div>
    </div></div>
    ${blocks.length ? blocks.map((b) => `
      <section class="cf-block" data-block="${esc(b.id)}">
        <div class="cf-label">${esc(b.label)}</div>
        <div class="cf-sides">${side(b, 'cur', cur)}${side(b, 'other', other)}</div>
        ${b.kind === 'set' ? `<button type="button" class="cf-both" data-pick="both"><span class="cf-radio"></span>Combine both</button>` : ''}
        ${b.kind === 'text' ? `
          <button type="button" class="cf-both" data-pick="both"><span class="cf-radio"></span>Keep both</button>
          ${b.id === 'body' || b.id === 'gmNotes' ? `<details class="cf-diff"><summary>${icon('rows')} Line-by-line differences</summary>${lineDiff(cur[b.id] || '', other[b.id] || '')}</details>` : ''}
          <label class="cf-merged">Merged text <small>this is what gets saved</small>
            <textarea rows="${b.id === 'summary' ? 3 : 10}" data-text="${b.id}"></textarea></label>` : ''}
      </section>`).join('')
    : '<div class="empty-state small"><p>Both versions match. Save to clear the conflict.</p></div>'}
  </form>`;

  const textFor = (id, pick) => pick === 'other' ? (other[id] || '') : pick === 'both'
    ? [cur[id] || '', other[id] || ''].filter((t) => t.trim()).join('\n\n---\n\n') : (cur[id] || '');
  const paint = () => {
    for (const el of $$('.cf-block')) {
      const id = el.dataset.block;
      for (const p of $$('[data-pick]', el)) p.classList.toggle('on', p.dataset.pick === choice[id]);
    }
  };
  const pick = (id, which, { updateText = true } = {}) => {
    choice[id] = which;
    const ta = $(`textarea[data-text="${CSS.escape(id)}"]`);
    if (ta && updateText) ta.value = textFor(id, which);
  };
  for (const b of blocks) pick(b.id, choice[b.id]);
  paint();

  $('#rf').addEventListener('click', (e) => {
    const all = e.target.closest('[data-all]');
    if (all) { for (const b of blocks) pick(b.id, all.dataset.all); dirty = true; paint(); return; }
    const p = e.target.closest('[data-pick]');
    if (!p) return;
    pick(p.closest('.cf-block').dataset.block, p.dataset.pick);
    dirty = true;
    paint();
  });
  $('#rf').addEventListener('input', () => { dirty = true; });
  $$('[data-img]').forEach(async (img) => { const url = await store.imageURL(img.dataset.img); if (url) img.src = url; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'muted', textContent: 'Image not downloaded yet' })); });

  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    const out = structuredClone(cur);
    for (const b of blocks) {
      const c = choice[b.id];
      const src = c === 'other' ? other : cur;
      if (b.kind === 'text') out[b.id] = $(`textarea[data-text="${CSS.escape(b.id)}"]`).value;
      else if (b.id === 'date') for (const k of DATE_KEYS) out[k] = src[k] ?? null;
      else if (b.id.startsWith('field:')) {
        const k = b.id.slice(6);
        out.fields ||= {};
        if (src.fields && k in src.fields) out.fields[k] = src.fields[k]; else delete out.fields[k];
      } else if (b.id === 'tags') out.tags = c === 'both' ? [...new Set([...(cur.tags || []), ...(other.tags || [])])] : [...(src.tags || [])];
      else if (b.id === 'relations') {
        if (c === 'both') {
          const seen = new Set();
          out.relations = [...(cur.relations || []), ...(other.relations || [])].filter((r) => !seen.has(relKey(r)) && seen.add(relKey(r)));
        } else out.relations = structuredClone(src.relations || []);
      } else {
        out[b.id] = src[b.id] ?? null;
        if (b.kind === 'image') out[b.id + 'Pos'] = src[b.id + 'Pos'] ?? null; // the focus belongs to its picture
      }
    }
    out.title = String(out.title || '').trim() || a.title;
    const clash = store.byTitle(wid, out.title);
    if (clash && clash.id !== aid) return toast(`Another article is already called “${out.title}”`);
    const oldTitle = a.title;
    await store.resolveConflict(aid, out);
    if (oldTitle.toLowerCase() !== out.title.toLowerCase()) await store.renameReferences(wid, oldTitle, out.title);
    dirty = false;
    state.guard = null;
    toast('Conflict resolved');
    location.hash = `#/w/${wid}/a/${aid}`;
  };
}
