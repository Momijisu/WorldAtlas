// Category / tag listings and search.
import * as store from '../store.js';
import { TYPES } from '../store.js';
import { $, esc } from '../util.js';
import { view, setTitle, hydrateImages, articleRows, pageHead, icon, worldCrumb, sep } from '../ui.js';

export function viewList(wid, { type, tag }) {
  const all = store.articlesOf(wid);
  let list, title, newType = 'article', ic = 'books';
  if (tag) { list = all.filter((a) => (a.tags || []).includes(tag)); title = '#' + esc(tag); ic = 'tag'; }
  else if (type === 'conflicts') { list = all.filter((a) => a.conflict); title = 'Conflicts to resolve'; ic = 'warning'; }
  else if (type && type !== 'all' && TYPES[type]) { list = all.filter((a) => a.type === type); title = TYPES[type].plural; newType = type; ic = TYPES[type].icon; }
  else { list = all; title = 'All articles'; }
  setTitle(title);
  const sortKey = localStorage.getItem('wa.sort') || 'title';
  const tags = store.allTags(wid);
  view.innerHTML = `<section class="page">
    ${pageHead({
      eyebrow: `${worldCrumb(wid)} ${sep} ${icon(ic)} ${tag ? 'Tag' : 'Codex'}`,
      title,
      actions: `<a class="btn primary" href="#/w/${wid}/new/${newType}">${icon('plus')} New ${TYPES[newType].label.toLowerCase()}</a>`,
    })}
    <div class="toolbar">
      <input type="search" id="filter" placeholder="Filter ${list.length} article${list.length === 1 ? '' : 's'}…">
      <div class="seg" id="sort">
        <button data-s="title">A–Z</button><button data-s="updated">Recent</button><button data-s="created">Newest</button>
      </div>
    </div>
    <div id="listOut"></div>
    ${!tag && tags.length ? `<div class="section-head"><h2>Tags</h2></div><div class="tags">${tags.map(([t, n]) => `<a class="tag" href="#/w/${wid}/tag/${encodeURIComponent(t)}">#${esc(t)} <small>${n}</small></a>`).join('')}</div>` : ''}
  </section>`;
  let sort = sortKey;
  const sorters = {
    title: (a, b) => a.title.localeCompare(b.title),
    updated: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
  };
  const draw = () => {
    const f = $('#filter').value.trim().toLowerCase();
    for (const b of $('#sort').children) b.classList.toggle('on', b.dataset.s === sort);
    const shown = list.filter((a) => !f || a.title.toLowerCase().includes(f) || (a.summary || '').toLowerCase().includes(f)).sort(sorters[sort]);
    $('#listOut').innerHTML = shown.length ? articleRows(shown, wid)
      : `<div class="empty-state small"><p>${list.length ? 'No matches.' : 'Nothing written here yet.'}</p></div>`;
    hydrateImages($('#listOut'));
  };
  $('#filter').oninput = draw;
  $('#sort').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sort = b.dataset.s;
    localStorage.setItem('wa.sort', sort);
    draw();
  };
  draw();
}

export function viewSearch(wid, q) {
  setTitle('Search');
  $('#searchInput').value = q;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const a of store.articlesOf(wid)) {
    const title = a.title.toLowerCase();
    const text = (store.articleText(a) + ' ' + (a.tags || []).join(' ')).toLowerCase();
    if (!terms.length || !terms.every((t) => title.includes(t) || text.includes(t))) continue;
    scored.push([a, terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0) + (title.startsWith(t) ? 5 : 0), 0)]);
  }
  scored.sort((x, y) => y[1] - x[1] || x[0].title.localeCompare(y[0].title));
  view.innerHTML = `<section class="page">
    ${pageHead({ eyebrow: `${worldCrumb(wid)} ${sep} Search`, title: q ? `“${esc(q)}”` : 'Search' })}
    <form class="toolbar" id="sf"><input type="search" name="q" value="${esc(q)}" placeholder="Search titles, text, fields and tags…"><button class="btn">${icon('magnifying-glass')} Search</button></form>
    <p class="eyebrow">${q ? `${scored.length} result${scored.length === 1 ? '' : 's'}` : ''}</p>
    ${articleRows(scored.map((s) => s[0]), wid)}
    ${q && !store.byTitle(wid, q) ? `<p style="margin-top:1.4rem"><a class="btn" href="#/w/${wid}/new/article?title=${encodeURIComponent(q)}">${icon('plus')} Create “${esc(q)}”</a></p>` : ''}
  </section>`;
  $('#sf').onsubmit = (e) => { e.preventDefault(); location.hash = `#/w/${wid}/search?q=${encodeURIComponent(e.target.q.value.trim())}`; };
  hydrateImages();
}
