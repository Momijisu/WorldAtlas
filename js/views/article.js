// Reading view of a single article.
import * as store from '../store.js';
import { TYPES, sectionsOf } from '../store.js';
import { render, renderInline } from '../markdown.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { relationsOf, REL_TYPES, REL_GROUPS, hasFamily } from '../relations.js';
import { $, esc, timeAgo } from '../util.js';
import { view, state, setTitle, hydrateImages, articleRows, icon, typeIcon, flourish, sep } from '../ui.js';
import { newArticleDialog } from './home.js';
import { promptsAnsweredBy } from '../prompts.js';
import { posCSS, BANNER_POS } from '../focus.js';
import { mountMap } from '../mapview.js';
import { itemTitle, linkedArticle } from './maps.js';

export function viewArticle(wid, id, { section } = {}) {
  const w = store.world(wid);
  const a = store.article(id);
  const cal = calendarOf(w);
  setTitle(a.title);
  const t = TYPES[a.type] || TYPES.article;
  const crumbs = store.ancestors(a);
  const children = store.articlesOf(wid).filter((c) => c.parentId === a.id).sort((x, y) => x.title.localeCompare(y.title));
  const back = store.backlinks(a).sort((x, y) => x.title.localeCompare(y.title));
  const onMaps = store.mapsOf(wid).filter((m) => [...(m.pins || []), ...(m.regions || [])].some((it) => linkedArticle(wid, it)?.id === a.id));
  const sections = sectionsOf(a.type, a.fields || {});
  const fieldCount = sections.reduce((n, sec) => n + sec.entries.length, 0);
  const date = articleDateText(cal, a);
  const rels = relationsOf(a);
  const versions = store.historyOf(a.id).length;
  const map = a.mapId && store.map(a.mapId)?.worldId === wid ? store.map(a.mapId) : null;

  const relGroups = {};
  for (const r of rels) (relGroups[REL_TYPES[r.type].group] ||= []).push(r);
  const relHTML = Object.keys(REL_GROUPS).filter((g) => relGroups[g]).map((g) => `
    <div class="field-label" style="margin-top:1rem">${REL_GROUPS[g]}</div>
    <div class="rel-list">${relGroups[g].map((r) => `
      <a class="rel-card" href="#/w/${wid}/a/${r.other.id}">${typeIcon(r.other.type)}
        <span><span class="rel-kind">${REL_TYPES[r.type].label}</span><br><span class="rel-name">${esc(r.other.title)}</span>
        ${r.note ? `<br><span class="rel-note">${esc(r.note)}</span>` : ''}</span></a>`).join('')}</div>`).join('');

  view.innerHTML = `<article class="page article">
    ${a.banner ? `<div class="article-hero" data-bg="${a.banner}" style="background-position:${posCSS(a.bannerPos, BANNER_POS)}"></div>` : ''}
    <div class="page-head article-head${a.banner ? ' over-hero' : ''}">
      <div>
        <div class="eyebrow"><a href="#/w/${wid}">${esc(w.name)}</a>${crumbs.map((c) => ` ${sep} <a href="#/w/${wid}/a/${c.id}">${esc(c.title)}</a>`).join('')}</div>
        <h1>${esc(a.title)}</h1>
      </div>
      <div class="actions">
        <button class="btn quiet" id="addChild" title="Create an article nested under this one">${icon('plus')} Sub-article</button>
        <a class="btn quiet" href="#/w/${wid}/a/${a.id}/history" title="Earlier versions">${icon('clock-counter-clockwise')} History${versions > 1 ? ` <span class="muted">${versions}</span>` : ''}</a>
        <a class="btn primary" href="#/w/${wid}/a/${a.id}/edit">${icon('pencil-simple')} Edit</a>
      </div>
    </div>
    ${a.conflict ? `<div class="conflict-banner">${icon('warning')}<div><b>Conflicting edits.</b> This article was changed on two devices before they synced. Both versions are kept until you choose.
      <div class="actions left" style="margin-top:.7rem"><a class="btn small primary" href="#/w/${wid}/a/${a.id}/resolve">${icon('arrows-out-cardinal')} Resolve conflict</a></div></div></div>` : ''}
    <div class="article-grid">
      <div class="article-main">
        ${promptsAnsweredBy(wid, a.id).map((p) => `<div class="prompt-callout small">${icon('feather')}<div><div class="eyebrow">Answers the prompt</div><p>${esc(p.text)}</p></div></div>`).join('')}
        <details class="toc" id="toc" hidden open><summary>${icon('list-bullets')} Contents</summary><ol></ol></details>
        ${a.summary ? `<p class="lead">${renderInline(a.summary, wid)}</p>` : ''}
        ${a.body ? `<div class="prose">${render(a.body, wid)}</div>` : `<div class="empty-state small"><p>Nothing written yet. <a href="#/w/${wid}/a/${a.id}/edit">Start writing</a>.</p></div>`}
        ${a.gmNotes ? `<details class="secret"><summary>${icon('lock-simple')} Secrets &amp; GM notes</summary><div class="prose no-dropcap">${render(a.gmNotes, wid)}</div></details>` : ''}
        ${map ? `${flourish()}<div class="section-head" style="margin-top:0"><h2>Map</h2>
          <a class="btn small" href="#/w/${wid}/m/${map.id}">${icon('arrow-square-out')} Open ${esc(map.name)}</a></div>
          <div class="map-wrap article-map"><div class="map-box" id="articleMap" data-hint="${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + scroll to zoom"></div>
            <div class="viz-zoom"><button type="button" class="icon-btn" data-z="in" aria-label="Zoom in">${icon('plus')}</button><button type="button" class="icon-btn" data-z="out" aria-label="Zoom out">${icon('minus')}</button><button type="button" class="icon-btn" data-z="fit" aria-label="Fit">${icon('corners-out')}</button></div></div>` : ''}
        ${rels.length ? `${flourish()}<div class="section-head" style="margin-top:0"><h2>Relationships</h2>
          <div class="actions">
            ${hasFamily(a) ? `<a class="btn small" href="#/w/${wid}/tree/${a.id}">${icon('tree-structure')} Family tree</a>` : ''}
            <a class="btn small" href="#/w/${wid}/graph?focus=${a.id}">${icon('graph')} Web</a>
          </div></div>${relHTML}` : ''}
        ${children.length ? `${flourish()}<div class="section-head" style="margin-top:0"><h2>Contains</h2></div>${articleRows(children, wid)}` : ''}
        ${back.length ? `${flourish()}<div class="section-head" style="margin-top:0"><h2>Mentioned in</h2></div>${articleRows(back, wid)}` : ''}
      </div>
      <aside class="infobox"><div class="infobox-inner">
        ${a.image ? `<img class="infobox-img" data-img="${a.image}" alt="">` : ''}
        <div class="infobox-title">${esc(a.title)}</div>
        <div class="infobox-type"><a href="#/w/${wid}/t/${a.type}">${t.label}</a></div>
        ${fieldCount || date || crumbs.length || onMaps.length ? `<dl>
          ${date ? `<dt>Date</dt><dd>${esc(date)}</dd>` : ''}
          ${sections.map((sec) => `${sections.length > 1 ? `<div class="ib-sec">${esc(sec.name)}</div>` : ''}${sec.entries.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${renderInline(v, wid)}</dd>`).join('')}`).join('')}
          ${crumbs.length ? `<dt>Part of</dt><dd><a href="#/w/${wid}/a/${crumbs.at(-1).id}">${esc(crumbs.at(-1).title)}</a></dd>` : ''}
          ${onMaps.length ? `<dt>Maps</dt><dd>${onMaps.map((m) => `<a href="#/w/${wid}/m/${m.id}?pin=${a.id}">${esc(m.name)}</a>`).join(', ')}</dd>` : ''}
        </dl>` : ''}
        ${(a.tags || []).length ? `<div class="tags">${a.tags.map((tg) => `<a class="tag" href="#/w/${wid}/tag/${encodeURIComponent(tg)}">#${esc(tg)}</a>`).join('')}</div>` : ''}
        <div class="stamp">Revised ${timeAgo(a.updatedAt)}</div>
      </div></aside>
    </div>
  </article>`;
  $('#addChild').onclick = () => newArticleDialog(wid, `?parent=${a.id}`);
  hydrateImages();
  contents();
  if (map) embedMap(wid, map);
  if (section) goToSection(section);
}

// [[Title#Section]] links open the article at that heading.
function goToSection(name) {
  const want = name.trim().toLowerCase();
  const h = [...view.querySelectorAll('.article-main > .prose :is(h1, h2, h3, h4, h5, h6)')]
    .find((x) => !x.closest('.excerpt') && x.textContent.trim().toLowerCase() === want);
  if (h) requestAnimationFrame(() => h.scrollIntoView({ block: 'start' }));
}

// The article's map, embedded: pan, zoom, and pins/regions that open their article or map.
async function embedMap(wid, map) {
  const box = $('#articleMap');
  const src = await store.imageURL(map.image);
  if (!box?.isConnected) return; // left the page meanwhile
  if (!src) { box.innerHTML = '<p class="muted pad">This map’s image hasn’t downloaded yet.</p>'; return; }
  const go = (it) => {
    const linked = linkedArticle(wid, it);
    if (linked) location.hash = `#/w/${wid}/a/${linked.id}`;
    else if (it.mapId && store.map(it.mapId)) location.hash = `#/w/${wid}/m/${it.mapId}`;
  };
  const ctl = mountMap(box, { src, onPinClick: go, onRegionClick: go, embedded: true });
  const labelled = (list) => (list || []).map((it) => ({ ...it, label: itemTitle(it) }));
  ctl.setItems({ pins: labelled(map.pins), regions: labelled(map.regions) });
  box.parentElement.querySelector('.viz-zoom').onclick = (e) => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') ctl.zoom(1.4); else if (z === 'out') ctl.zoom(1 / 1.4); else if (z === 'fit') ctl.fit();
  };
  const prev = state.cleanup;
  state.cleanup = () => { prev?.(); ctl.destroy(); };
}

// Contents box: lists the article's headings once there are a few, and
// highlights the one being read. Links scroll rather than change the hash,
// which the router owns.
function contents() {
  const box = $('#toc');
  const heads = [...view.querySelectorAll('.article-main > .prose :is(h1, h2, h3), .article-main > .section-head h2')].filter((h) => !h.closest('.excerpt'));
  if (heads.filter((h) => h.closest('.prose')).length < 2) return;
  const used = new Set();
  const top = Math.min(...heads.map((h) => +h.tagName[1]));
  box.querySelector('ol').innerHTML = heads.map((h, i) => {
    let id = 'h-' + (h.textContent.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || i);
    while (used.has(id)) id += '-' + i;
    used.add(id);
    h.id = id;
    return `<li class="toc-l${+h.tagName[1] - top}"><a href="#" data-to="${id}">${esc(h.textContent)}</a></li>`;
  }).join('');
  box.hidden = false;
  if (matchMedia('(max-width: 860px)').matches && heads.length > 6) box.open = false;
  box.addEventListener('click', (e) => {
    const link = e.target.closest('[data-to]');
    if (!link) return;
    e.preventDefault();
    document.getElementById(link.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const links = new Map([...box.querySelectorAll('[data-to]')].map((l) => [l.dataset.to, l]));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) {
      for (const l of links.values()) l.classList.toggle('on', l.dataset.to === en.target.id);
    }
  }, { rootMargin: '0px 0px -70% 0px' });
  heads.forEach((h) => io.observe(h));
  state.cleanup = () => io.disconnect();
}
