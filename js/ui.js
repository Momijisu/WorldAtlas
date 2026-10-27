// Shared UI state and helpers used by every view.
import * as store from './store.js';
import { rowLabel } from './templates.js';
import { posCSS } from './focus.js';
import { TYPES } from './store.js';
import { icon } from './icons.js';
import { esc, $$ } from './util.js';
import { plain } from './markdown.js';

export const view = document.getElementById('view');

// guard: () => boolean — returns true while the view has unsaved changes;
//        navigation then asks for confirmation (guardMessage) first.
// cleanup: called before the next view renders (e.g. to stop a map viewer).
export const state = { guard: null, guardMessage: '', cleanup: null, installPrompt: null, wid: null };

export function setTitle(t) { document.title = t ? `${t} · WorldAtlas` : 'WorldAtlas'; }

export const typeIcon = (type, cls = '') => icon(TYPES[type]?.icon || 'file-text', cls);
export const typeLabel = (type) => (TYPES[type] || TYPES.article).label;

// Fill <img data-img> / [data-bg] elements from the local image store.
export async function hydrateImages(root = view) {
  for (const el of $$('[data-img]', root)) {
    const url = await store.imageURL(el.dataset.img);
    if (url) el.src = url; else { el.hidden = true; el.removeAttribute('data-img'); } // image not on this device yet
  }
  for (const el of $$('[data-bg]', root)) {
    const url = await store.imageURL(el.dataset.bg);
    if (url) { el.style.backgroundImage = `url("${url}")`; el.classList.add('has-img'); }
  }
}

// Settings → Appearance: show each article's picture faded behind its list row.
export const rowPicturesOn = () => { try { return localStorage.getItem('wa.rowPics') === 'on'; } catch { return false; } };
const rowPicture = (a) => {
  const id = a.banner || a.image;
  if (!id || !rowPicturesOn()) return '';
  return `<span class="row-bg" data-bg="${esc(id)}" style="background-position:${a.banner ? posCSS(a.bannerPos, [50, 35]) : posCSS(a.imagePos)}" aria-hidden="true"></span>`;
};

// listType: the template a list is of, so its rows needn't repeat it.
export function articleRows(list, wid, meta, { listType } = {}) {
  if (!list.length) return '';
  return `<ul class="rows">${list.map((a, _, __, label = rowLabel(a, listType)) => `
    <li><a href="#/w/${wid}/a/${a.id}" class="row-link">${rowPicture(a)}
      ${a.image ? `<img class="row-thumb" data-img="${a.image}" style="object-position:${posCSS(a.imagePos)}" alt="">` : `<span class="row-thumb icon">${typeIcon(a.type)}</span>`}
      <span class="row-text"><span class="row-title">${esc(a.title)}${a.conflict ? `<span class="conflict-flag" title="Edited on two devices">${icon('warning')} Conflict</span>` : ''}</span>
      <span class="row-sub">${label ? `<b>${esc(label)}</b>` : ''}${a.summary ? esc(plain(a.summary, 130)) : ''}</span></span>
      ${meta ? `<span class="row-meta">${meta(a)}</span>` : ''}
    </a></li>`).join('')}</ul>`;
}

export const flourish = () => '<div class="flourish" aria-hidden="true"><span></span></div>';

// Page header: eyebrow (breadcrumb-ish string or HTML), title, actions HTML.
export function pageHead({ eyebrow = '', title, actions = '', sticky = false, cls = '' }) {
  return `<div class="page-head${sticky ? ' sticky' : ''} ${cls}">
    <div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1></div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

export const worldCrumb = (wid) => `<a href="#/w/${wid}">${esc(store.world(wid)?.name || '')}</a>`;
export const sep = '<span class="sep">/</span>';

// Searchable list of articles for <select> elements.
// only: a list of templates to offer (the selected article is always kept).
export function articleOptions(wid, selected, { exclude = new Set(), none = 'None', only = null } = {}) {
  const list = store.articlesOf(wid).filter((a) => !exclude.has(a.id) && (!only || only.includes(a.type) || a.id === selected))
    .sort((x, y) => x.title.localeCompare(y.title));
  return (none != null ? `<option value="">${esc(none)}</option>` : '') +
    list.map((a) => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(a.title)} · ${typeLabel(a.type)}</option>`).join('');
}

export { icon };
