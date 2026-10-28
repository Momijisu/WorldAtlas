// Markdown → sanitized HTML, with [[Wiki Links]] between articles.
// Uses the vendored marked + DOMPurify (loaded as globals in index.html).
import * as store from './store.js';
import { esc } from './util.js';
import { scriptExtensions } from './scripts.js';

let renderingWid = null; // the world being rendered, for its fonts
marked.use({ gfm: true, breaks: true, extensions: scriptExtensions(() => renderingWid) });

// Code fences and `code spans` are left alone, so [[...]] can be shown literally.
const CODE = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/;

function wikiLinks(src, wid) {
  return String(src || '').split(CODE).map((part, i) => (i % 2 ? part : linkify(part, wid))).join('');
}

function linkify(src, wid) {
  return src.replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g, (_, title, label) => {
    const a = store.byTitle(wid, title);
    const text = esc((label || title).trim());
    if (a) return `<a class="wikilink type-${a.type}" href="#/w/${wid}/a/${a.id}" title="${esc(a.summary || a.title)}">${text}</a>`;
    return `<a class="wikilink missing" href="#/w/${wid}/new/article?title=${encodeURIComponent(title.trim())}" data-create="${esc(title.trim())}" title="Create “${esc(title.trim())}”">${text}</a>`;
  });
}

export function render(src, wid) {
  renderingWid = wid;
  return DOMPurify.sanitize(marked.parse(wikiLinks(src, wid)));
}

export function renderInline(src, wid) {
  renderingWid = wid;
  return DOMPurify.sanitize(marked.parseInline(wikiLinks(src, wid)));
}

export function plain(src, max = 160) {
  const s = String(src || '').replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g, (_, t, l) => l || t)
    .replace(/\{\{[^|{}\n]+\|([^{}\n]+)\}\}/g, '$1').replace(/^:::.*$/gm, '').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
