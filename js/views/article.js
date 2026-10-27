// Reading view of a single article.
import * as store from '../store.js';
import { TYPES } from '../store.js';
import { render, renderInline } from '../markdown.js';
import { calendarOf, articleDateText } from '../calendar.js';
import { relationsOf, REL_TYPES, REL_GROUPS, hasFamily } from '../relations.js';
import { $, esc, timeAgo } from '../util.js';
import { view, setTitle, hydrateImages, articleRows, icon, typeIcon, flourish, sep } from '../ui.js';
import { newArticleDialog } from './home.js';
import { promptsAnsweredBy } from '../prompts.js';

export function viewArticle(wid, id) {
  const w = store.world(wid);
  const a = store.article(id);
  const cal = calendarOf(w);
  setTitle(a.title);
  const t = TYPES[a.type] || TYPES.article;
  const crumbs = store.ancestors(a);
  const children = store.articlesOf(wid).filter((c) => c.parentId === a.id).sort((x, y) => x.title.localeCompare(y.title));
  const back = store.backlinks(a).sort((x, y) => x.title.localeCompare(y.title));
  const onMaps = store.mapsOf(wid).filter((m) => (m.pins || []).some((p) => p.articleId === a.id) || (m.regions || []).some((r) => r.articleId === a.id));
  const fields = Object.entries(a.fields || {}).filter(([k, v]) => k && String(v).trim());
  const date = articleDateText(cal, a);
  const rels = relationsOf(a);
  const versions = store.historyOf(a.id).length;

  const relGroups = {};
  for (const r of rels) (relGroups[REL_TYPES[r.type].group] ||= []).push(r);
  const relHTML = Object.keys(REL_GROUPS).filter((g) => relGroups[g]).map((g) => `
    <div class="field-label" style="margin-top:1rem">${REL_GROUPS[g]}</div>
    <div class="rel-list">${relGroups[g].map((r) => `
      <a class="rel-card" href="#/w/${wid}/a/${r.other.id}">${typeIcon(r.other.type)}
        <span><span class="rel-kind">${REL_TYPES[r.type].label}</span><br><span class="rel-name">${esc(r.other.title)}</span>
        ${r.note ? `<br><span class="rel-note">${esc(r.note)}</span>` : ''}</span></a>`).join('')}</div>`).join('');

  view.innerHTML = `<article class="page article">
    ${a.banner ? `<div class="article-hero" data-bg="${a.banner}"></div>` : ''}
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
        ${promptsAnsweredBy(wid, a.id).map((p) => `<div class="prompt-callout small">${icon('feather')}<div><div class="eyebrow">Written for the prompt</div><p>${esc(p.text)}</p></div></div>`).join('')}
        ${a.summary ? `<p class="lead">${renderInline(a.summary, wid)}</p>` : ''}
        ${a.body ? `<div class="prose">${render(a.body, wid)}</div>` : `<div class="empty-state small"><p>Nothing written yet. <a href="#/w/${wid}/a/${a.id}/edit">Start writing</a>.</p></div>`}
        ${a.gmNotes ? `<details class="secret"><summary>${icon('lock-simple')} Secrets &amp; GM notes</summary><div class="prose no-dropcap">${render(a.gmNotes, wid)}</div></details>` : ''}
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
        ${fields.length || date || crumbs.length || onMaps.length ? `<dl>
          ${date ? `<dt>Date</dt><dd>${esc(date)}</dd>` : ''}
          ${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${renderInline(v, wid)}</dd>`).join('')}
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
}
