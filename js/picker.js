// Article picker: a text field that searches the world's articles (titles and
// other names) as you type and lists matches to pick; when nothing matches it
// offers to create the article. Stands in for a <select>: the chosen id is in
// a hidden input carrying the given name/class, so forms read it as before.
import * as store from './store.js';
import { TYPES, GROUPS } from './store.js';
import { esc, modal, toast, $ } from './util.js';
import { icon, typeIcon } from './ui.js';

const MAX = 8;

// value: the selected article id (or ''). name/cls: put on the hidden input.
// nameCls: allow a name with no article yet (kept in a hidden input with this
// class; `named` is its current value), for things you'll write up later.
export function pickerHTML({ name = '', cls = '', value = '', placeholder = 'Type to find an article', label = '', nameCls = '', named = '' } = {}) {
  const a = value && store.article(value);
  const shown = a ? a.title : named || (value ? '(deleted article)' : '');
  return `<span class="apick"${nameCls ? ' data-names' : ''}>
    <input type="hidden"${name ? ` name="${name}"` : ''}${cls ? ` class="${cls}"` : ''} value="${esc(value || '')}">
    ${nameCls ? `<input type="hidden" class="${nameCls}" value="${esc(a ? '' : named)}">` : ''}
    <input class="apick-q" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(shown)}"${label ? ` aria-label="${esc(label)}"` : ''}
      role="combobox" aria-autocomplete="list" aria-expanded="false">
    <ul class="apick-list" role="listbox" hidden></ul>
    ${nameCls ? '<small class="apick-note"></small>' : ''}
  </span>`;
}

// Wire every picker under `root`. exclude: ids not to offer (e.g. the article itself).
// createType: the template a new article starts as (or a function giving it).
export function wirePickers(root, wid, { exclude = new Set(), createType = 'article' } = {}) {
  root.querySelectorAll('.apick:not([data-wired])').forEach((el) => wire(el, wid, { exclude, createType }));
}

function wire(el, wid, { exclude, createType }) {
  el.dataset.wired = '1';
  const [hidden, nameIn] = el.querySelectorAll('input[type=hidden]'), q = el.querySelector('.apick-q'), list = el.querySelector('.apick-list');
  const names = el.hasAttribute('data-names'), note = el.querySelector('.apick-note');
  let items = [], idx = -1;
  const current = () => store.article(hidden.value);
  const showNote = () => { if (note) note.textContent = !hidden.value && nameIn.value ? `No article called “${nameIn.value}” yet. You can write it later.` : ''; };
  // a: an article; or text: a name with no article (when names are allowed)
  const set = (a, text = '') => {
    const before = hidden.value + '|' + (nameIn?.value || '');
    hidden.value = a ? a.id : '';
    if (nameIn) nameIn.value = a ? '' : text;
    q.value = a ? a.title : text;
    close();
    showNote();
    if (hidden.value + '|' + (nameIn?.value || '') !== before) hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };
  showNote();
  const close = () => { list.hidden = true; q.setAttribute('aria-expanded', 'false'); idx = -1; };
  const pool = () => store.articlesOf(wid).filter((a) => !exclude.has(a.id));
  const draw = () => {
    const text = q.value.trim(), t = text.toLowerCase();
    const named = (a) => store.namesOf(a).find((n) => n.toLowerCase().includes(t));
    const rank = (a) => (a.title.toLowerCase().startsWith(t) ? 0 : a.title.toLowerCase().includes(t) ? 1 : 2);
    const hits = pool().filter((a) => !t || named(a)).sort((x, y) => rank(x) - rank(y) || x.title.localeCompare(y.title)).slice(0, MAX);
    const exact = t && store.byName(wid, text);
    items = hits.map((a) => ({ a, alias: t && !a.title.toLowerCase().includes(t) ? named(a) : '' }));
    if (text && !exact && names) items.push({ keep: text });
    if (text && !exact) items.push({ create: text });
    if (!items.length) return close();
    list.innerHTML = items.map((it, i) => (it.keep
      ? `<li role="option" data-i="${i}" class="apick-keep${i === idx ? ' on' : ''}">${icon('pencil-simple')}<span>Use “${esc(it.keep)}” for now <small>no article yet</small></span></li>`
      : it.create
      ? `<li role="option" data-i="${i}" class="apick-new${i === idx ? ' on' : ''}">${icon('plus')}<span>Create “${esc(it.create)}”</span></li>`
      : `<li role="option" data-i="${i}" class="${i === idx ? 'on' : ''}${it.a.id === hidden.value ? ' sel' : ''}">${typeIcon(it.a.type)}<span>${esc(it.a.title)}${it.alias ? ` <small>also ${esc(it.alias)}</small>` : ''}</span><small>${esc(TYPES[it.a.type]?.label || '')}</small></li>`)).join('');
    list.hidden = false;
    q.setAttribute('aria-expanded', 'true');
  };
  const choose = (it) => (it.keep ? set(null, it.keep) : it.create ? createDialog(wid, it.create, typeof createType === 'function' ? createType(el) : createType, (a) => { set(a); q.focus(); }) : set(it.a));

  q.addEventListener('focus', () => { q.select(); draw(); });
  q.addEventListener('input', (e) => {
    e.stopPropagation(); // typing to search isn't an edit until something is picked
    idx = -1;
    if (!q.value.trim() && (hidden.value || nameIn?.value)) set(null); // cleared: nothing
    draw();
  });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) draw();
      if (!items.length) return;
      idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      draw();
    } else if (e.key === 'Enter') {
      if (list.hidden) return;
      e.preventDefault(); // never submit the form from here
      const it = items[idx >= 0 ? idx : 0];
      if (it) choose(it);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault(); e.stopPropagation(); close();
    }
  });
  // Leaving the field: an exact name picks that article; otherwise it goes back to what was chosen.
  q.addEventListener('blur', () => setTimeout(() => {
    if (el.contains(document.activeElement) || document.querySelector('#modal-root .apick-create')) return;
    const text = q.value.trim();
    const match = text && pool().find((a) => store.namesOf(a).some((n) => n.toLowerCase() === text.toLowerCase()));
    if (match) set(match);
    else if (names && text) set(null, text); // a name to write up later
    else { const c = current(); q.value = c ? c.title : nameIn?.value || (hidden.value ? '(deleted article)' : ''); close(); }
  }, 150));
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault();
    choose(items[+li.dataset.i]);
  });
}

// Make a new article with this title, choosing its template.
function createDialog(wid, title, type, done) {
  modal(`Create “${title}”`, `<form class="form apick-create">
      <label>Template<select name="type">${Object.entries(GROUPS).map(([g, gl]) => `<optgroup label="${esc(gl)}">${Object.entries(TYPES).filter(([, t]) => t.group === g)
        .map(([k, t]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <p class="muted small" style="margin:0">It starts empty; you can write it later.</p>
      <div class="actions"><button class="btn primary">${icon('plus')} Create</button></div></form>`, {
    onMount: (m, close) => {
      const f = $('.apick-create', m);
      f.type.focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const a = store.newArticle(wid, f.type.value, { title });
        await store.save('articles', a);
        close();
        toast(`Created “${title}”`);
        done(a);
      };
    },
  });
}
