// Tables: articles with the Table template keep rows and columns in
// `article.table`, so they sync, keep version history and go to Recently
// deleted like any other article. A table shows on its own page and inside any
// article with ![[Table title]]; readers can search it, sort by a column, roll
// a random row and roll dice cells. See docs/TABLES.md.
//
// article.table = {
//   columns: [{ id, name, type }],       // type: one of COLUMN_TYPES
//   rows: [{ id, c: { [columnId]: value } }],
//   opts: { search, roll, numbers },     // reader tools shown above the table
// }
import * as store from './store.js';
import { $, $$, esc, uid, toast, modal, download, confirmDialog } from './util.js';
import { icon } from './icons.js';
import { render, renderInline } from './markdown.js';

export const COLUMN_TYPES = {
  text: { label: 'Text', hint: 'Short text; [[links]] and **bold** work' },
  long: { label: 'Long text', hint: 'Paragraphs, formatted like an article' },
  number: { label: 'Number', hint: 'Sorts by value' },
  check: { label: 'Checkbox', hint: 'Tick it straight from the article' },
  article: { label: 'Article', hint: 'An article’s title, shown as a link' },
  link: { label: 'Web link', hint: 'An address on the web' },
  dice: { label: 'Dice', hint: 'A roll such as 2d6+1, with a button to roll it' },
  chance: { label: 'Chance', hint: 'How likely the row is when rolling the table (default 1; 0 never)' },
};

export const newTable = () => ({
  columns: [{ id: uid(), name: 'Name', type: 'text' }, { id: uid(), name: 'Description', type: 'long' }],
  rows: [0, 1, 2].map(() => ({ id: uid(), c: {} })),
  opts: { search: true, roll: true, numbers: false },
});

const blank = (v) => v == null || v === '' || v === false;
const checked = (v) => v === true || /^(true|yes|y|x|1|✓|✔|done)$/i.test(String(v ?? '').trim());

// --- dice -----------------------------------------------------------------
// "2d6+1", "d20", "1d8 + 1d4 - 2", "d%". Returns null if it isn't a roll.
export function rollDice(formula) {
  const src = String(formula || '').replace(/\s+/g, '').toLowerCase().replace(/d%/g, 'd100');
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(src) || !/d/.test(src)) return null;
  let total = 0;
  const parts = [];
  for (const [, sign, term] of src.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const k = sign === '-' ? -1 : 1;
    if (term.includes('d')) {
      const [n, sides] = term.split('d').map((x) => +x || 1);
      if (n > 200 || sides > 10000) return null;
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      total += k * rolls.reduce((s, x) => s + x, 0);
      parts.push((k < 0 ? '−' : '') + (rolls.length > 1 ? `(${rolls.join('+')})` : rolls[0]));
    } else {
      total += k * +term;
      parts.push((k < 0 ? '−' : '') + term);
    }
  }
  return { total, detail: parts.join(' + ').replace(/\+ −/g, '− ') };
}

// --- CSV / spreadsheet text ------------------------------------------------
// Tab-separated (pasted from a spreadsheet), comma- or semicolon-separated text.
export function parseDelimited(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!src.trim()) return [];
  const first = src.split('\n')[0];
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// A column's type from its values: numbers, rolls, ticks or long text.
function guessType(values) {
  const vals = values.filter((v) => v !== '');
  if (!vals.length) return 'text';
  if (vals.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'number';
  if (vals.every((v) => rollDice(v))) return 'dice';
  if (vals.every((v) => /^(true|false|yes|no|x|✓|✔|)$/i.test(v))) return 'check';
  if (vals.some((v) => v.length > 80)) return 'long';
  return 'text';
}

export function tableFromRows(grid, headers = true) {
  const width = Math.max(...grid.map((r) => r.length));
  const head = headers ? grid[0] : [];
  const body = headers ? grid.slice(1) : grid;
  const columns = Array.from({ length: width }, (_, i) => ({
    id: uid(), name: (head[i] || '').trim() || `Column ${i + 1}`,
    type: guessType(body.map((r) => r[i] ?? '')),
  }));
  const rows = body.map((r) => ({ id: uid(), c: Object.fromEntries(columns.map((c, i) => [c.id, c.type === 'check' ? checked(r[i]) : (r[i] ?? '')])) }));
  return { columns, rows };
}

export function tableToCSV(t) {
  const q = (v) => { const s = typeof v === 'boolean' ? (v ? 'yes' : '') : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [t.columns.map((c) => q(c.name)).join(','), ...t.rows.map((r) => t.columns.map((c) => q(r.c?.[c.id])).join(','))].join('\n');
}

// --- reading --------------------------------------------------------------

function cellHTML(col, v, wid) {
  if (col.type === 'check') return `<input type="checkbox" data-check ${checked(v) ? 'checked' : ''} aria-label="${esc(col.name)}">`;
  if (blank(v)) return '';
  const s = String(v);
  switch (col.type) {
    case 'long': return render(s, wid);
    case 'article': return renderInline(`[[${s.replace(/[[\]]/g, '')}]]`, wid);
    case 'link': {
      const href = /^[a-z][\w+.-]*:/i.test(s) ? s : 'https://' + s;
      return /^https?:/i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/i, ''))}</a>` : esc(s);
    }
    case 'dice': return rollDice(s) ? `<button type="button" class="dice-btn" data-dice="${esc(s)}" title="Roll ${esc(s)}">${icon('dice-five')}<span>${esc(s)}</span></button><span class="dice-out" aria-live="polite"></span>` : esc(s);
    default: return renderInline(s, wid);
  }
}

// The table as HTML (sanitised). `embed` adds a caption linking to the table's own page.
export function tableHTML(a, wid, { caption = '', embed = false } = {}) {
  const t = a.table;
  if (!t?.columns?.length) return embed ? `<div class="excerpt missing">“${esc(a.title)}” has no table yet.</div>` : '';
  const o = { search: true, roll: true, numbers: false, ...t.opts };
  const chance = t.columns.find((c) => c.type === 'chance');
  const shown = t.columns.filter((c) => c.type !== 'chance' || o.showChance);
  const head = `${o.numbers ? '<th class="num" data-sort="#">#</th>' : ''}${shown.map((c) => `<th data-sort="${esc(c.id)}" class="t-${c.type}" title="Sort by ${esc(c.name)}">${esc(c.name)}</th>`).join('')}`;
  const body = t.rows.map((r, i) => {
    const w = chance ? Math.max(0, parseFloat(r.c?.[chance.id]) || (blank(r.c?.[chance.id]) ? 1 : 0)) : 1;
    return `<tr data-row="${esc(r.id)}" data-i="${i}" data-w="${w}">${o.numbers ? `<td class="num" data-v="${i + 1}">${i + 1}</td>` : ''}${shown.map((c) => {
      const v = r.c?.[c.id];
      return `<td class="t-${c.type}" data-col="${esc(c.id)}" data-v="${esc(typeof v === 'boolean' ? (v ? 1 : 0) : v ?? '')}">${cellHTML(c, v, wid)}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const href = `#/w/${wid}/a/${a.id}`;
  const html = `<div class="wa-table${embed ? ' embedded' : ''}" data-table="${esc(a.id)}">
    ${embed || caption ? `<div class="wa-table-cap">${icon('table')}<a href="${href}">${esc(caption.trim() || a.title)}</a></div>` : ''}
    ${o.search || o.roll ? `<div class="wa-table-bar">
      ${o.search ? `<label class="wa-table-search">${icon('magnifying-glass')}<input type="search" placeholder="Search this table" aria-label="Search this table"></label>` : ''}
      <span class="wa-table-count muted small">${t.rows.length} row${t.rows.length === 1 ? '' : 's'}</span>
      ${o.roll && t.rows.length ? `<button type="button" class="btn small" data-roll title="Pick a random row${chance ? ', weighted by ' + esc(chance.name) : ''}">${icon('dice-five')} Roll</button>` : ''}
    </div>` : ''}
    <div class="wa-roll-result" hidden></div>
    <div class="wa-table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
  </div>`;
  return DOMPurify.sanitize(html);
}

// One set of listeners serves every table on any page, now or later.
function showCount(box) {
  const rows = $$('tbody tr', box);
  const vis = rows.filter((r) => !r.hidden).length;
  const el = $('.wa-table-count', box);
  if (el) el.textContent = vis === rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : `${vis} of ${rows.length}`;
}

function rollDiceButton(btn) {
  const r = rollDice(btn.dataset.dice);
  const out = btn.nextElementSibling;
  if (!r || !out) return;
  out.innerHTML = `<b>${r.total}</b>${r.detail.includes('+') || r.detail.includes('−') || r.detail.includes('(') ? ` <span class="muted">${esc(r.detail)}</span>` : ''}`;
  out.classList.remove('fresh'); void out.offsetWidth; out.classList.add('fresh');
}

function rollTable(box) {
  const rows = $$('tbody tr', box).filter((r) => !r.hidden);
  const total = rows.reduce((s, r) => s + (+r.dataset.w || 0), 0);
  const res = $('.wa-roll-result', box);
  if (!total) { res.hidden = false; res.textContent = 'No rows to roll on.'; return; }
  let x = Math.random() * total;
  const pick = rows.find((r) => (x -= +r.dataset.w || 0) < 0) || rows.at(-1);
  $$('tr.rolled', box).forEach((r) => r.classList.remove('rolled'));
  pick.classList.add('rolled');
  $$('.dice-btn', pick).forEach(rollDiceButton);
  const label = $$('td', pick).filter((td) => !td.classList.contains('num')).map((td) => td.textContent.trim()).find(Boolean) || `Row ${+pick.dataset.i + 1}`;
  res.hidden = false;
  res.innerHTML = `${icon('dice-five')}<span>Rolled <b>${esc(label.length > 90 ? label.slice(0, 89) + '…' : label)}</b> <span class="muted">· row ${+pick.dataset.i + 1} of ${rows.length}${rows.length < $$('tbody tr', box).length ? ' shown' : ''}</span></span>`;
  pick.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function sortBy(box, th) {
  const key = th.dataset.sort;
  const dir = th.dataset.dir === 'asc' ? 'desc' : th.dataset.dir === 'desc' ? '' : 'asc';
  $$('th[data-sort]', box).forEach((h) => { delete h.dataset.dir; });
  if (dir) th.dataset.dir = dir;
  const tbody = $('tbody', box);
  const val = (tr) => (key === '#' ? +tr.dataset.i : tr.querySelector(`td[data-col="${CSS.escape(key)}"]`)?.dataset.v ?? '');
  const rows = $$('tr', tbody);
  rows.sort((a, b) => {
    if (!dir) return a.dataset.i - b.dataset.i;
    const x = val(a), y = val(b);
    const nx = parseFloat(x), ny = parseFloat(y);
    const c = x === '' && y !== '' ? 1 : y === '' && x !== '' ? -1
      : !Number.isNaN(nx) && !Number.isNaN(ny) && String(nx) === String(x).trim() && String(ny) === String(y).trim() ? nx - ny
        : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? c : -c;
  });
  tbody.append(...rows);
}

async function toggleCheck(input) {
  const box = input.closest('.wa-table');
  const a = store.article(box?.dataset.table);
  const rowId = input.closest('tr')?.dataset.row;
  const colId = input.closest('td')?.dataset.col;
  if (!a?.table || !rowId || !colId) return;
  const table = structuredClone(a.table);
  const row = table.rows.find((r) => r.id === rowId);
  if (!row) return;
  row.c = { ...row.c, [colId]: input.checked };
  await store.save('articles', { ...a, table });
}

document.addEventListener('click', (e) => {
  const box = e.target.closest('.wa-table');
  if (!box) return;
  const dice = e.target.closest('.dice-btn');
  if (dice) { e.preventDefault(); rollDiceButton(dice); return; }
  if (e.target.closest('[data-roll]')) { rollTable(box); return; }
  const th = e.target.closest('th[data-sort]');
  if (th) sortBy(box, th);
});
document.addEventListener('input', (e) => {
  const q = e.target.closest('.wa-table-search input');
  if (!q) return;
  const box = q.closest('.wa-table');
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  for (const tr of $$('tbody tr', box)) {
    const text = tr.textContent.toLowerCase();
    tr.hidden = !terms.every((t) => text.includes(t));
  }
  showCount(box);
});
document.addEventListener('change', (e) => {
  if (e.target.matches('.wa-table input[data-check]')) toggleCheck(e.target);
});

// --- editing --------------------------------------------------------------
// The table editor inside the article editor. Returns { value() } with the
// table as it stands; onChange fires on every edit.
export function mountTableEditor(el, initial, { wid, onChange = () => {} } = {}) {
  const t = structuredClone(initial?.columns?.length ? initial : newTable());
  t.opts = { search: true, roll: true, numbers: false, ...t.opts };
  const changed = () => onChange();
  const titles = store.articlesOf(wid).map((x) => x.title).sort((x, y) => x.localeCompare(y));
  const listId = 'tblTitles';

  const cellInput = (c, v) => {
    const val = esc(typeof v === 'boolean' ? '' : v ?? '');
    switch (c.type) {
      case 'long': return `<textarea class="cell" rows="2">${val}</textarea>`;
      case 'number': case 'chance': return `<input class="cell" type="number" step="any" value="${val}" ${c.type === 'chance' ? 'placeholder="1" min="0"' : ''}>`;
      case 'check': return `<input class="cell" type="checkbox" ${checked(v) ? 'checked' : ''} aria-label="${esc(c.name)}">`;
      case 'article': return `<input class="cell" list="${listId}" value="${val}" placeholder="Article title">`;
      case 'link': return `<input class="cell" type="url" value="${val}" placeholder="https://…">`;
      case 'dice': return `<input class="cell" value="${val}" placeholder="e.g. 2d6+1">`;
      default: return `<input class="cell" value="${val}">`;
    }
  };

  function draw() {
    el.innerHTML = `<div class="tbl-ed">
      <datalist id="${listId}">${titles.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="tbl-ed-scroll"><table class="tbl-grid">
        <thead><tr><th class="h-handle" aria-label="Drag to reorder"></th>${t.columns.map((c, i) => `<th data-c="${i}">
          <div class="col-head"><input class="col-name" value="${esc(c.name)}" placeholder="Column name" aria-label="Column name">
            <span class="col-tools">
              <button type="button" class="icon-btn sm" data-move="-1" title="Move left" ${i ? '' : 'disabled'}>${icon('caret-left')}</button>
              <button type="button" class="icon-btn sm" data-move="1" title="Move right" ${i < t.columns.length - 1 ? '' : 'disabled'}>${icon('caret-right')}</button>
              <button type="button" class="icon-btn sm" data-rmcol title="Delete column">${icon('trash')}</button></span></div>
          <select class="col-type" aria-label="Column type" title="${esc(COLUMN_TYPES[c.type]?.hint || '')}">${Object.entries(COLUMN_TYPES).map(([k, ct]) => `<option value="${k}" ${k === c.type ? 'selected' : ''}>${ct.label}</option>`).join('')}</select>
        </th>`).join('')}<th class="h-end"></th></tr></thead>
        <tbody>${t.rows.map((r, ri) => `<tr data-r="${ri}"><td class="handle" title="Drag to move the row">${icon('dots-six-vertical')}</td>${t.columns.map((c, ci) => `<td data-c="${ci}" class="t-${c.type}">${cellInput(c, r.c?.[c.id])}</td>`).join('')}
          <td class="h-end"><button type="button" class="icon-btn sm" data-rmrow title="Delete row">${icon('x')}</button></td></tr>`).join('')}</tbody>
      </table></div>
      <div class="tbl-ed-actions">
        <button type="button" class="btn small" data-addrow>${icon('plus')} Row</button>
        <button type="button" class="btn small" data-addcol>${icon('plus')} Column</button>
        <span class="spacer"></span>
        <button type="button" class="btn small quiet" data-paste>${icon('file-text')} Paste from a spreadsheet</button>
        <label class="btn small quiet">${icon('upload-simple')} Import CSV<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden data-csv></label>
        <button type="button" class="btn small quiet" data-export>${icon('download-simple')} Export CSV</button>
      </div>
      <div class="tbl-ed-opts">
        <label class="check"><input type="checkbox" data-opt="search" ${t.opts.search ? 'checked' : ''}> Search box</label>
        <label class="check"><input type="checkbox" data-opt="roll" ${t.opts.roll ? 'checked' : ''}> Roll button <small class="muted">picks a random row</small></label>
        <label class="check"><input type="checkbox" data-opt="numbers" ${t.opts.numbers ? 'checked' : ''}> Row numbers</label>
      </div>
    </div>`;
  }
  draw();

  const colOf = (node) => +node.closest('th[data-c], td[data-c]')?.dataset.c;
  const rowOf = (node) => +node.closest('tr[data-r]')?.dataset.r;

  el.addEventListener('input', (e) => {
    const x = e.target;
    if (x.matches('.col-name')) { t.columns[colOf(x)].name = x.value; changed(); return; }
    if (x.matches('.cell')) {
      const c = t.columns[colOf(x)];
      const r = t.rows[rowOf(x)];
      r.c = { ...r.c, [c.id]: x.type === 'checkbox' ? x.checked : x.value };
      changed();
    }
  });
  el.addEventListener('change', (e) => {
    const x = e.target;
    if (x.matches('.col-type')) {
      const c = t.columns[colOf(x)];
      const was = c.type;
      c.type = x.value;
      // Ticks and text convert both ways.
      for (const r of t.rows) {
        const v = r.c?.[c.id];
        if (c.type === 'check' && was !== 'check') r.c[c.id] = checked(v);
        else if (was === 'check' && c.type !== 'check') r.c[c.id] = v ? 'yes' : '';
      }
      draw(); changed();
    } else if (x.matches('[data-opt]')) { t.opts[x.dataset.opt] = x.checked; changed(); } else if (x.matches('[data-csv]')) {
      const file = x.files[0];
      x.value = '';
      if (file) file.text().then((text) => pasteDialog(text));
    }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-addrow]')) {
      t.rows.push({ id: uid(), c: {} });
      draw(); changed();
      $$('tbody tr', el).at(-1)?.querySelector('.cell')?.focus();
    } else if (b.matches('[data-addcol]')) {
      t.columns.push({ id: uid(), name: '', type: 'text' });
      draw(); changed();
      $$('.col-name', el).at(-1)?.focus();
    } else if (b.matches('[data-rmrow]')) {
      const r = t.rows[rowOf(b)];
      if (Object.values(r.c || {}).some((v) => !blank(v)) && !(await confirmDialog('Delete this row?', 'Delete row'))) return;
      t.rows.splice(rowOf(b), 1);
      draw(); changed();
    } else if (b.matches('[data-rmcol]')) {
      const c = t.columns[colOf(b)];
      if (t.rows.some((r) => !blank(r.c?.[c.id])) && !(await confirmDialog(`Delete the column “${c.name || 'untitled'}” and everything in it?`, 'Delete column'))) return;
      t.columns.splice(colOf(b), 1);
      for (const r of t.rows) delete r.c?.[c.id];
      draw(); changed();
    } else if (b.matches('[data-move]')) {
      const i = colOf(b), j = i + +b.dataset.move;
      [t.columns[i], t.columns[j]] = [t.columns[j], t.columns[i]];
      draw(); changed();
    } else if (b.matches('[data-paste]')) pasteDialog('');
    else if (b.matches('[data-export]')) download(`${(document.querySelector('input[name="title"]')?.value || 'table').trim() || 'table'}.csv`, new Blob([tableToCSV(value())], { type: 'text/csv' }));
  });

  // Rows move by dragging their handle.
  let dragFrom = null;
  el.addEventListener('pointerdown', (e) => { const h = e.target.closest('.handle'); if (h) h.closest('tr').draggable = true; });
  el.addEventListener('dragstart', (e) => { const tr = e.target.closest('tr[data-r]'); if (!tr) return; dragFrom = +tr.dataset.r; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
  el.addEventListener('dragover', (e) => {
    const tr = e.target.closest('tbody tr[data-r]');
    if (dragFrom == null || !tr) return;
    e.preventDefault();
    $$('tr.drop-before, tr.drop-after', el).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    const box = tr.getBoundingClientRect();
    tr.classList.add(e.clientY < box.top + box.height / 2 ? 'drop-before' : 'drop-after');
  });
  el.addEventListener('drop', (e) => {
    const tr = e.target.closest('tbody tr[data-r]');
    if (dragFrom == null || !tr) return;
    e.preventDefault();
    let to = +tr.dataset.r + (tr.classList.contains('drop-after') ? 1 : 0);
    const [row] = t.rows.splice(dragFrom, 1);
    if (to > dragFrom) to--;
    t.rows.splice(to, 0, row);
    dragFrom = null;
    draw(); changed();
  });
  el.addEventListener('dragend', () => { dragFrom = null; $$('tr[draggable]', el).forEach((x) => { x.draggable = false; x.classList.remove('dragging', 'drop-before', 'drop-after'); }); });

  function pasteDialog(text) {
    const hasData = t.rows.some((r) => Object.values(r.c || {}).some((v) => !blank(v)));
    modal('Fill the table from a spreadsheet', `<form id="tp">
      <p class="muted small">Copy cells from Excel, Google Sheets or Numbers and paste them here, or paste CSV text.</p>
      <textarea name="text" rows="9" class="mono" placeholder="Name&#9;Description&#10;Goblin&#9;Small and mean">${esc(text)}</textarea>
      <label class="check"><input type="checkbox" name="headers" checked> The first row holds the column names</label>
      ${hasData ? `<label class="check"><input type="checkbox" name="append"> Add to the rows already here <small class="muted">(matching columns by name)</small></label>` : ''}
      <div class="actions"><button type="button" class="btn quiet" data-cancel>Cancel</button><button class="btn primary">${icon('check')} Fill table</button></div>
    </form>`, {
      wide: true,
      onMount: (m, close) => {
        const f = $('#tp', m);
        $('[data-cancel]', m).onclick = () => close();
        f.text.focus();
        f.onsubmit = (e) => {
          e.preventDefault();
          const grid = parseDelimited(f.text.value);
          if (!grid.length) return toast('Nothing to add');
          const next = tableFromRows(grid, f.headers.checked);
          if (f.append?.checked) {
            const byName = new Map(t.columns.map((c) => [c.name.trim().toLowerCase(), c]));
            for (const c of next.columns) if (!byName.has(c.name.trim().toLowerCase())) { t.columns.push(c); byName.set(c.name.trim().toLowerCase(), c); }
            for (const r of next.rows) {
              const c = {};
              for (const nc of next.columns) c[byName.get(nc.name.trim().toLowerCase()).id] = r.c[nc.id];
              t.rows.push({ id: uid(), c });
            }
          } else {
            t.columns = next.columns;
            t.rows = next.rows;
          }
          draw(); changed(); close();
          toast(`${next.rows.length} row${next.rows.length === 1 ? '' : 's'} added`);
        };
      },
    });
  }

  // Columns without names get one; rows left completely empty are dropped.
  function value() {
    const out = structuredClone(t);
    out.columns.forEach((c, i) => { c.name = c.name.trim() || `Column ${i + 1}`; });
    out.rows = out.rows.filter((r) => out.columns.some((c) => !blank(r.c?.[c.id])));
    for (const r of out.rows) r.c = Object.fromEntries(out.columns.map((c) => [c.id, r.c?.[c.id]]).filter(([, v]) => !blank(v)));
    return out;
  }
  return { value };
}
