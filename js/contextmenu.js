// The app's own right-click menu, in place of the browser's (View source,
// Inspect and the rest aren't useful here). It offers what fits where you
// clicked: Back and Forward always; Cut, Copy, Paste and Select all in text
// fields and the editor; Copy and a search for selected text; and Open in new
// tab and Copy link on links. Menus a view shows itself (a map region's) take
// precedence, and Shift + right-click still opens the browser's menu.
import { state } from './ui.js';
import { esc, toast } from './util.js';

const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const key = (k) => (mac ? `⌘${k}` : `Ctrl+${k}`);

let menu = null;
function close() {
  menu?.remove();
  menu = null;
  removeEventListener('pointerdown', outside, true);
  removeEventListener('blur', close);
  removeEventListener('resize', close);
  removeEventListener('scroll', close, true);
}
const outside = (e) => { if (!menu?.contains(e.target)) close(); };

const editableOf = (el) => el?.closest?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable=""], [contenteditable="true"]');
const isField = (el) => el && /^(INPUT|TEXTAREA)$/.test(el.tagName);

function selectedText(field) {
  if (isField(field)) return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  return String(getSelection() || '');
}

async function paste(field) {
  let text;
  try { text = await navigator.clipboard.readText(); } catch {
    return toast(`The browser blocked pasting from the menu. Use ${key('V')} instead.`);
  }
  field.focus();
  if (isField(field)) {
    field.setRangeText(text, field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } else document.execCommand('insertText', false, text);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch { document.execCommand('copy'); }
}

function items(e) {
  // The field under the pointer, even if an icon drawn over its edge was what got clicked.
  const field = editableOf(e.target) || document.elementsFromPoint(e.clientX, e.clientY).map(editableOf).find(Boolean);
  const link = !field && e.target.closest?.('a[href]');
  const sel = selectedText(field).trim();
  const list = [];
  if (field) {
    const readOnly = field.readOnly || field.disabled;
    list.push(
      { label: 'Cut', hint: key('X'), off: !sel || readOnly, run: () => { field.focus(); document.execCommand('cut'); } },
      { label: 'Copy', hint: key('C'), off: !sel, run: () => { field.focus(); document.execCommand('copy'); } },
      { label: 'Paste', hint: key('V'), off: readOnly, run: () => paste(field) },
      { label: 'Select all', hint: key('A'), run: () => { field.focus(); if (isField(field)) field.select(); else document.execCommand('selectAll'); } },
      null,
    );
  } else if (sel) {
    list.push({ label: 'Copy', hint: key('C'), run: () => copyText(sel) });
    if (state.wid) list.push({ label: `Search for “${sel.length > 24 ? sel.slice(0, 23) + '…' : sel}”`, run: () => { location.hash = `#/w/${state.wid}/search?q=${encodeURIComponent(sel)}`; } });
    list.push(null);
  }
  if (link) {
    const href = new URL(link.getAttribute('href'), location.href).href;
    list.push(
      { label: 'Open in new tab', run: () => open(href, '_blank', 'noopener') },
      { label: 'Copy link', run: () => copyText(href).then(() => toast('Link copied')) },
      null,
    );
  }
  const nav = window.navigation;
  list.push(
    { label: 'Back', hint: mac ? '⌘[' : 'Alt+←', off: nav ? !nav.canGoBack : false, run: () => history.back() },
    { label: 'Forward', hint: mac ? '⌘]' : 'Alt+→', off: nav ? !nav.canGoForward : false, run: () => history.forward() },
  );
  return list;
}

function show(e) {
  close();
  const list = items(e);
  menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = list.map((it, i) => (it
    ? `<button type="button" role="menuitem" data-i="${i}" ${it.off ? 'disabled' : ''}><span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`
    : '<hr>')).join('').replace(/^<hr>|<hr>$/g, '');
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(e.clientX, innerWidth - r.width - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(e.clientY, innerHeight - r.height - 4)) + 'px';
  // Keep the focus (and selection) where it was, so Cut and Copy act on it.
  menu.addEventListener('mousedown', (ev) => ev.preventDefault());
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-i]');
    if (!b || b.disabled) return;
    const it = list[+b.dataset.i];
    close();
    it.run();
  });
  menu.addEventListener('keydown', (ev) => {
    const btns = [...menu.querySelectorAll('button:not([disabled])')];
    const i = btns.indexOf(document.activeElement);
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      btns[(i + (ev.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
    }
  });
  setTimeout(() => {
    addEventListener('pointerdown', outside, true);
    addEventListener('blur', close);
    addEventListener('resize', close);
    addEventListener('scroll', close, true);
  });
}

addEventListener('contextmenu', (e) => {
  if (e.defaultPrevented || e.shiftKey) return; // a view's own menu, or the browser's on request
  e.preventDefault();
  show(e);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu) close();
});
