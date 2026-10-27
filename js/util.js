import { icon } from './icons.js';

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(ts).toLocaleDateString();
}

export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

// Simple promise-based modal. `body` is an HTML string; `onMount(el, close)`
// lets the caller wire up inputs. Resolves with whatever close() is given.
export function modal(title, body, { onMount, wide } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="modal-body">${body}</div></div>`;
    const opener = document.activeElement;
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); opener?.focus?.(); resolve(v); };
    // Only the topmost dialog answers Escape.
    const onKey = (e) => { if (e.key === 'Escape' && root.lastElementChild === wrap) { e.stopImmediatePropagation(); close(null); } };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
    wrap.querySelector('[data-close]').onclick = () => close(null);
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    onMount?.(wrap.querySelector('.modal'), close);
    wrap.querySelector('input:not([type=hidden]),textarea,select')?.focus();
  });
}

export async function confirmDialog(message, okLabel = 'Delete', { title = 'Are you sure?', cancelLabel = 'Cancel', danger = true } = {}) {
  return modal(title, `<p>${esc(message)}</p>
    <div class="actions"><button class="btn quiet" data-no>${esc(cancelLabel)}</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-yes>${esc(okLabel)}</button></div>`,
  { onMount: (m, close) => { m.querySelector('[data-no]').onclick = () => close(false); m.querySelector('[data-yes]').onclick = () => close(true); m.querySelector('[data-no]').focus(); } });
}

// Downscale an image file to a JPEG blob no larger than maxDim on either side.
// Small images and PNGs (which may carry transparency) under the limit are kept as is.
export async function prepareImage(file, maxDim = 1800) {
  const bmp = await loadImage(file);
  const { width: w, height: h } = bmp;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  if (scale === 1 && file.size < 1.5e6) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  const keepAlpha = file.type === 'image/png' && scale === 1;
  if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = keepAlpha ? 'image/png' : 'image/jpeg';
  return new Promise((res) => canvas.toBlob((b) => res(b || file), type, 0.88));
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); res(img); };
    img.onerror = () => rej(new Error('Could not read image'));
    img.src = URL.createObjectURL(file);
  });
}

export const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

export async function dataURLToBlob(url) {
  return (await fetch(url)).blob();
}

export function download(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
