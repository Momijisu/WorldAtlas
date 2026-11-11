// Click a picture to see it large: portraits, header images, the world cover
// on its overview, and pictures in an article's text. Shows the whole picture
// (not the cropped frame), with its article's title. Esc, a click outside it or
// the close button closes it. Right-click inside offers Save and Copy as usual.
import * as store from './store.js';
import { esc } from './util.js';
import { icon } from './icons.js';

const PICTURES = '.infobox-img, .article-hero.has-img, .world-home .hero-img.has-img, .prose img';

let box = null;
function close() {
  box?.remove();
  box = null;
  removeEventListener('keydown', onKey, true);
}
const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };

export async function openPicture({ id, src, caption = '' }) {
  const url = id ? await store.imageURL(id) : src;
  if (!url) return;
  close();
  box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', caption || 'Picture');
  box.innerHTML = `<figure><img src="${esc(url)}" ${id ? `data-img="${esc(id)}"` : ''} alt="${esc(caption)}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>
    <button type="button" class="icon-btn lightbox-close" aria-label="Close">${icon('x')}</button>`;
  box.addEventListener('click', (e) => { if (!e.target.closest('img')) close(); });
  document.body.appendChild(box);
  addEventListener('keydown', onKey, true);
  box.querySelector('.lightbox-close').focus();
}

// The title of the article or world a picture belongs to.
function captionFor(id) {
  if (!id) return '';
  const r = [...store.data.articles.values(), ...store.data.worlds.values()].find((x) => !x.deleted && (x.image === id || x.banner === id));
  return r?.title || r?.name || '';
}

document.addEventListener('click', (e) => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const el = e.target.closest?.(PICTURES);
  if (!el || el.closest('a, button, .focus-pick, .lightbox, .md-preview')) return;
  // A header's title and buttons sit over it; only clicks on the picture itself count.
  if (el.matches('.article-hero, .hero-img') && e.target !== el) return;
  const id = el.dataset.img || el.dataset.bg;
  e.preventDefault();
  openPicture(id ? { id, caption: captionFor(id) } : { src: el.currentSrc || el.src, caption: el.alt || '' });
});
