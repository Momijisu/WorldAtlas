// Possible duplicate articles: each pair side by side, to merge one into the
// other or mark as not duplicates.
import * as store from '../store.js';
import { TYPES } from '../store.js';
import { findDuplicates, mergeArticles, mergePlan, notDuplicates } from '../duplicates.js';
import { plain } from '../markdown.js';
import { esc, modal, toast, timeAgo, $ } from '../util.js';
import { view, setTitle, pageHead, icon, typeIcon, hydrateImages, worldCrumb, sep } from '../ui.js';
import { posCSS } from '../focus.js';

export function viewDuplicates(wid) {
  setTitle('Possible duplicates');
  const draw = () => {
    const pairs = findDuplicates(wid);
    const words = (a) => (a.body || '').split(/\s+/).filter(Boolean).length;
    const linksIn = (a) => store.backlinks(a).length;
    const side = (a, other) => `<div class="dup-side">
        <a class="dup-head" href="#/w/${wid}/a/${a.id}">
          ${a.image ? `<img class="row-thumb" data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : `<span class="row-thumb icon">${typeIcon(a.type)}</span>`}
          <span><span class="dup-title">${esc(a.title)}</span><span class="dup-type">${esc(TYPES[a.type]?.label || 'Article')}${a.type !== other.type ? ' <b>· different template</b>' : ''}</span></span></a>
        <p class="dup-summary">${a.summary ? esc(plain(a.summary, 160)) : '<span class="muted">No summary</span>'}</p>
        <div class="dup-stats">${words(a)} words · ${linksIn(a)} link${linksIn(a) === 1 ? '' : 's'} to it · edited ${timeAgo(a.updatedAt)}</div>
        <button type="button" class="btn small" data-keep="${a.id}" data-drop="${other.id}">${icon('arrows-merge')} Keep this one, merge the other in</button>
      </div>`;
    view.innerHTML = `<section class="page">
      ${pageHead({ eyebrow: `${worldCrumb(wid)} ${sep} Tidy up`, title: 'Possible duplicates' })}
      <p class="muted" style="max-width:46rem">Articles whose names are the same once tidied (“The Black Helm” and “Black Helm”) or a letter or two apart. Merging keeps one, adds the other’s text and details to it, moves its links, relationships and map places over, and keeps its name as another name so links still work. The merged-away article goes to Recently deleted.</p>
      ${pairs.length ? pairs.map(({ a, b, how }) => `<div class="dup-pair">
          <div class="dup-how">${how === 'same' ? 'Same name' : 'Similar names'}</div>
          <div class="dup-sides">${side(a, b)}${side(b, a)}</div>
          <div class="dup-actions"><button type="button" class="btn small quiet" data-not="${a.id}|${b.id}">${icon('check')} Not duplicates</button></div>
        </div>`).join('') : `<div class="empty-state small"><p>${icon('check')} No possible duplicates in this world.</p></div>`}
    </section>`;
    hydrateImages();
  };
  view.onclick = async (e) => {
    const k = e.target.closest('[data-keep]');
    const n = e.target.closest('[data-not]');
    if (n) {
      const [x, y] = n.dataset.not.split('|');
      await notDuplicates(wid, x, y);
      toast('Marked as not duplicates');
      draw();
    } else if (k) confirmMerge(store.article(k.dataset.keep), store.article(k.dataset.drop), draw);
  };
  draw();
}

function confirmMerge(keep, drop, done) {
  const p = mergePlan(keep, drop);
  const lines = [
    `“${drop.title}” becomes another name for “${keep.title}”, so links to it still work`,
    p.text && `its text is added at the end, under “From ${drop.title}”`,
    p.fieldsFilled && `${p.fieldsFilled} empty detail${p.fieldsFilled === 1 ? '' : 's'} filled in from it`,
    p.fieldsKept && `${p.fieldsKept} detail${p.fieldsKept === 1 ? ' that differs' : 's that differ'} kept as an extra field${p.fieldsKept === 1 ? '' : 's'}`,
    p.relations && `${p.relations} relationship${p.relations === 1 ? '' : 's'} moved over`,
    p.children && `${p.children} sub-article${p.children === 1 ? '' : 's'} filed under “${keep.title}”`,
    p.places && `${p.places} map place${p.places === 1 ? '' : 's'} pointed at “${keep.title}”`,
    `“${drop.title}” goes to Recently deleted, where it can be restored`,
  ].filter(Boolean);
  modal(`Merge into “${keep.title}”`, `<ul class="merge-plan">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="actions"><button type="button" class="btn" data-close-merge>Cancel</button><button type="button" class="btn primary" data-go>${icon('arrows-merge')} Merge</button></div>`, {
    onMount: (m, close) => {
      $('[data-close-merge]', m).onclick = () => close();
      $('[data-go]', m).onclick = async () => {
        const kept = await mergeArticles(keep.id, drop.id);
        close();
        toast(`Merged into “${kept.title}”`);
        done();
      };
    },
  });
}
