// Article version history (with diffs and restore) and recently deleted articles.
import * as store from '../store.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { REL_TYPES } from '../relations.js';
import { $, $$, esc, toast, timeAgo } from '../util.js';
import { view, setTitle, pageHead, icon, typeIcon, typeLabel, worldCrumb, sep } from '../ui.js';

const when = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function viewHistory(wid, aid) {
  const a = store.article(aid);
  const versions = store.historyOf(aid);
  setTitle('History · ' + a.title);
  let sel = 0;
  view.innerHTML = `<section class="page">
    ${pageHead({
      eyebrow: `${worldCrumb(wid)} ${sep} <a href="#/w/${wid}/a/${aid}">${esc(a.title)}</a> ${sep} History`,
      title: 'Revision history',
      actions: `<a class="btn quiet" href="#/w/${wid}/a/${aid}">${icon('arrow-left')} Back to article</a>`,
    })}
    ${versions.length ? `<div class="history-grid">
      <ol class="history-list" id="hlist"></ol>
      <div class="history-detail" id="hdetail"></div>
    </div>` : `<div class="empty-state small"><p>No saved versions yet. Each time you save this article, a version is kept here (the last ${store.HISTORY_LIMIT}).</p></div>`}
  </section>`;
  if (!versions.length) return;

  const drawList = () => {
    $('#hlist').innerHTML = versions.map((h, i) => `
      <li><button class="${i === sel ? 'on' : ''}" data-i="${i}">
        <span class="h-when">${esc(when(h.savedAt))}</span>
        <span class="h-sub">${i === 0 ? 'Current version' : timeAgo(h.savedAt)}${i === versions.length - 1 ? ' · first saved' : ''}</span>
      </button></li>`).join('');
  };
  const drawDetail = () => {
    const h = versions[sel];
    const prev = versions[sel + 1];
    $('#hdetail').innerHTML = `
      <div class="history-head">
        <div><div class="eyebrow">${sel === 0 ? 'Current version' : 'Saved ' + esc(when(h.savedAt))}</div>
        <h2>${esc(h.snapshot.title)}</h2></div>
        <div class="actions">
          ${sel === 0 ? '' : `<button class="btn primary" id="restore">${icon('arrow-counter-clockwise')} Restore this version</button>`}
        </div>
      </div>
      <p class="muted small">${prev ? `Changes compared with the version saved ${esc(when(prev.savedAt))}.` : 'The first saved version.'}</p>
      ${diffSnapshots(wid, prev?.snapshot, h.snapshot)}`;
    $('#restore')?.addEventListener('click', async () => {
      await store.restoreVersion(h);
      toast('Version restored');
      location.hash = `#/w/${wid}/a/${aid}`;
    });
  };
  $('#hlist').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sel = +b.dataset.i;
    drawList(); drawDetail();
    if (matchMedia('(max-width: 760px)').matches) $('#hdetail').scrollIntoView({ behavior: 'smooth' });
  };
  drawList(); drawDetail();
}

// Readable summary of what changed between two snapshots (prev may be undefined).
function diffSnapshots(wid, prev, cur) {
  const cal = calendarOf(store.world(wid));
  const out = [];
  const p = prev || {};
  const scalar = (label, a, b) => {
    if ((a ?? '') === (b ?? '')) return;
    out.push(`<div class="diff-field"><div class="field-label">${label}</div>
      ${a ? `<div class="diff-old">${esc(a)}</div>` : ''}${b ? `<div class="diff-new">${esc(b)}</div>` : '<div class="muted small">(removed)</div>'}</div>`);
  };
  scalar('Title', p.title, cur.title);
  scalar('Template', p.type && typeLabel(p.type), typeLabel(cur.type));
  scalar('Part of', titleOf(p.parentId), titleOf(cur.parentId));
  scalar('Date', prev ? articleDateText(cal, p) : '', articleDateText(cal, cur));
  scalar('Summary', p.summary, cur.summary);
  scalar('Tags', (p.tags || []).join(', '), (cur.tags || []).join(', '));
  if ((p.banner || null) !== (cur.banner || null)) out.push(`<div class="diff-field"><div class="field-label">Header image</div><div class="muted small">${cur.banner ? 'Header image changed' : 'Header image removed'}</div></div>`);
  if ((p.image || null) !== (cur.image || null)) out.push(`<div class="diff-field"><div class="field-label">Image</div><div class="muted small">${cur.image ? 'Image changed' : 'Image removed'}</div></div>`);
  const keys = new Set([...Object.keys(p.fields || {}), ...Object.keys(cur.fields || {})]);
  for (const k of keys) scalar('Infobox · ' + esc(k), p.fields?.[k], cur.fields?.[k]);
  const relStr = (r) => `${REL_TYPES[r.type]?.label || r.type} ${titleOf(r.target) || '(deleted)'}${r.note ? ' — ' + r.note : ''}`;
  const pr = new Set((p.relations || []).map(relStr)), cr = new Set((cur.relations || []).map(relStr));
  const relLines = [...[...pr].filter((x) => !cr.has(x)).map((x) => `<div class="diff-old">${esc(x)}</div>`),
    ...[...cr].filter((x) => !pr.has(x)).map((x) => `<div class="diff-new">${esc(x)}</div>`)];
  if (relLines.length) out.push(`<div class="diff-field"><div class="field-label">Relationships</div>${relLines.join('')}</div>`);
  for (const [label, key] of [['Content', 'body'], ['Secrets & GM notes', 'gmNotes']]) {
    if ((p[key] || '') !== (cur[key] || '')) out.push(`<div class="diff-field"><div class="field-label">${label}</div>${lineDiff(p[key] || '', cur[key] || '')}</div>`);
  }
  return out.length ? `<div class="diff">${out.join('')}</div>` : '<div class="empty-state small"><p>No visible changes in this save.</p></div>';
}

const titleOf = (id) => (id ? store.data.articles.get(id)?.title || '' : '');

// Line-level diff via longest common subsequence, with unchanged runs collapsed.
function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4e6) return `<div class="diff-old">(${n} lines)</div><div class="diff-new">(${m} lines)</div>`;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { ops.push([' ', A[i]]); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ops.push(['+', B[j]]); j++; }
    else { ops.push(['-', A[i]]); i++; }
  }
  const html = [];
  for (let k = 0; k < ops.length; k++) {
    const [op, line] = ops[k];
    if (op === ' ') {
      const near = ops.slice(Math.max(0, k - 2), k + 3).some((o) => o[0] !== ' ');
      if (!near) { if (html.at(-1) !== '<div class="diff-gap">…</div>') html.push('<div class="diff-gap">…</div>'); continue; }
    }
    html.push(`<div class="diff-line ${op === '+' ? 'add' : op === '-' ? 'del' : ''}"><span>${op === ' ' ? '' : op}</span>${esc(line) || '&nbsp;'}</div>`);
  }
  return `<div class="diff-lines">${html.join('')}</div>`;
}

export function viewTrash(wid) {
  setTitle('Recently deleted');
  const items = store.deletedArticles(wid);
  view.innerHTML = `<section class="page narrow">
    ${pageHead({ eyebrow: `${worldCrumb(wid)} ${sep} Archive`, title: 'Recently deleted' })}
    <p class="muted">Deleted articles can be restored with their last saved content. Restoring brings them back on all your devices.</p>
    ${items.length ? `<ul class="rows">${items.map(({ tomb, last }) => `
      <li><div class="row-link">
        <span class="row-thumb icon">${typeIcon(last.snapshot.type)}</span>
        <span class="row-text"><span class="row-title">${esc(last.snapshot.title)}</span>
        <span class="row-sub"><b>${typeLabel(last.snapshot.type)}</b>deleted ${timeAgo(tomb.updatedAt)}</span></span>
        <button class="btn small row-meta" data-restore="${tomb.id}">${icon('arrow-counter-clockwise')} Restore</button>
      </div></li>`).join('')}</ul>`
    : '<div class="empty-state small"><p>Nothing has been deleted from this world.</p></div>'}
  </section>`;
  $$('[data-restore]').forEach((b) => {
    b.onclick = async () => {
      const h = store.historyOf(b.dataset.restore)[0];
      await store.restoreVersion(h);
      toast(`Restored “${h.snapshot.title}”`);
      location.hash = `#/w/${wid}/a/${h.articleId}`;
    };
  });
}
