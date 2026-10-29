// Hover previews for links to articles: after a short pause over a link, a
// card shows the article's picture, template, title and opening lines.
// Mouse and pen only; on touch a tap simply follows the link.
import * as store from './store.js';
import { posCSS, BANNER_POS } from './focus.js';
import { TYPES } from './store.js';
import { plain } from './markdown.js';
import { esc } from './util.js';
import { typeIcon } from './ui.js';

const LINKS = 'a.wikilink:not(.missing), a.rel-card';
const DELAY = 350;
let card, timer, current;

function articleOf(link) {
  const m = /^#\/w\/[^/]+\/a\/([^/?]+)$/.exec(link.getAttribute('href') || '');
  return m && store.article(m[1]);
}

function hide() {
  clearTimeout(timer);
  current = null;
  card?.classList.remove('on');
}

async function show(link, a) {
  card ||= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'link-preview', role: 'tooltip' }));
  const t = TYPES[a.type] || TYPES.article;
  const text = plain(a.summary || a.body, 240);
  const pic = a.banner || a.image;
  card.innerHTML = `${pic ? '<div class="lp-img"></div>' : ''}
    <div class="lp-body">
      <div class="lp-type">${typeIcon(a.type)} ${esc(t.label)}</div>
      <div class="lp-title">${esc(a.title)}</div>
      ${text ? `<p>${esc(text)}</p>` : '<p class="muted">Nothing written yet.</p>'}
    </div>`;
  card.classList.toggle('portrait', !a.banner && !!a.image);
  place(link);
  card.classList.add('on');
  if (pic) {
    const url = await store.imageURL(pic);
    const img = card.querySelector('.lp-img');
    if (current !== link || !img) return;
    if (url) { img.style.backgroundImage = `url("${url}")`; img.style.backgroundPosition = a.banner ? posCSS(a.bannerPos, BANNER_POS) : posCSS(a.imagePos); } else img.remove();
    place(link);
  }
}

function place(link) {
  const r = link.getBoundingClientRect();
  const w = card.offsetWidth, h = card.offsetHeight, gap = 8;
  const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  const below = r.bottom + gap + h < innerHeight || r.top - gap - h < 0;
  card.style.left = `${left}px`;
  card.style.top = `${below ? r.bottom + gap : r.top - gap - h}px`;
}

export function wirePreviews() {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const link = e.target.closest?.(LINKS);
    if (!link || link === current) return;
    const a = articleOf(link);
    if (!a || a.deleted) return;
    hide();
    current = link;
    timer = setTimeout(() => show(link, a), DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (current && !current.contains(e.relatedTarget)) hide();
  });
  for (const ev of ['pointerdown', 'scroll', 'hashchange', 'keydown']) addEventListener(ev, hide, true);
}
