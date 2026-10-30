// Markdown → sanitized HTML, with [[Wiki Links]] between articles.
// Uses the vendored marked + DOMPurify (loaded as globals in index.html).
import * as store from './store.js';
import { esc } from './util.js';
import { icon } from './icons.js';
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

// ![[Title]] shows another article's summary; ![[Title#Heading]] one of its
// sections; ![[Title#Heading|Caption]] with a caption of your own. Each sits on
// its own line and is drawn as a box linking back to the source. Excerpts
// inside an excerpt are shown as plain links, so articles can't loop.
const EXCERPT = /^!\[\[([^\]|#\n]+)(?:#([^\]|\n]+))?(?:\|([^\]\n]*))?\]\][ \t]*$/gm;

function section(body, heading) {
  const lines = String(body || '').split('\n');
  const want = heading.trim().toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase() === want);
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

function excerptHTML(wid, title, heading, caption, depth) {
  const a = store.byTitle(wid, title.trim());
  const where = esc(title.trim()) + (heading ? ` › ${esc(heading.trim())}` : '');
  if (!a) return `<div class="excerpt missing">No article called “${esc(title.trim())}” to quote from.</div>`;
  const text = heading ? section(a.body, heading) : (a.summary || a.body.split(/\n\s*\n/)[0]);
  if (text == null) return `<div class="excerpt missing">“${esc(a.title)}” has no section called “${esc(heading.trim())}”.</div>`;
  const href = `#/w/${wid}/a/${a.id}`;
  // The source link sits at the end of the excerpt's last paragraph, so the text reads as part of the article.
  const source = `<a class="excerpt-source" href="${href}" title="From ${where}">${esc(a.title)}${icon('arrow-right')}</a>`;
  let html = depth ? `<p>${esc(plain(text, 300))}</p>` : renderBody(text, wid, depth + 1);
  const last = html.lastIndexOf('</p>');
  html = last >= 0 && last + 4 >= html.trimEnd().length ? `${html.slice(0, last)} ${source}</p>${html.slice(last + 4)}` : `${html}<p class="excerpt-tail">${source}</p>`;
  return `<div class="excerpt type-${a.type}">${caption ? `<div class="excerpt-caption">${esc(caption.trim())}</div>` : ''}${html}</div>`;
}

function renderBody(src, wid, depth = 0) {
  const boxes = [];
  const withSlots = String(src || '').replace(EXCERPT, (_, title, heading, caption) => {
    boxes.push(excerptHTML(wid, title, heading, caption, depth));
    return `\n\nWAEXCERPT${boxes.length - 1}\n\n`;
  });
  return marked.parse(wikiLinks(withSlots, wid)).replace(/<p>WAEXCERPT(\d+)<\/p>/g, (_, i) => boxes[i]);
}

export function render(src, wid) {
  renderingWid = wid;
  return DOMPurify.sanitize(renderBody(src, wid));
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
