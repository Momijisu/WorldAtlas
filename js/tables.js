// Tables live in an article's own text as Markdown tables, so they sync, keep
// history, merge line by line and can be quoted with ![[Article#Heading]] like
// any other text. Reading, they gain a few tools, worked out from the table
// itself (see docs/TABLES.md):
//   - click a column's name to sort by it; a search box on longer tables;
//   - Roll picks a random row: by the die in the first column's name (a "d8"
//     column of numbers or ranges like 1–2), else weighted by a "Chance"
//     column, else evenly;
//   - a cell that is just a roll ("2d6+1") becomes a dice button;
//   - a cell of [ ] or [x] becomes a checkbox, tickable on the article's page.
// Writing, the editor's Table button opens a grid for the table at the cursor.
import * as store from './store.js';
import { $, $$, esc, toast, modal, download, confirmDialog } from './util.js';
import { icon } from './icons.js';

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

export const toCSV = (t) => [t.head, ...t.rows].map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');

// --- Markdown tables -------------------------------------------------------
// A table here is { head: [names], align: ['', 'left', 'center', 'right'], rows: [[cells]] }.

const DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FENCE = /^\s*(```|~~~)/;

// A table line's cells: split on pipes, but not escaped ones (\|) or those inside [[links|labels]].
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (ch === '[' && s[i + 1] === '[') { depth++; cur += '[['; i++; continue; }
    if (ch === ']' && s[i + 1] === ']' && depth) { depth--; cur += ']]'; i++; continue; }
    if (ch === '|' && !depth) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

// Where each table is in a text: [{ start, end }] as line numbers (end exclusive), skipping code blocks.
export function findTables(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { inCode = !inCode; continue; }
    if (inCode || !lines[i].includes('|') || !DELIM.test(lines[i + 1] || '') || !lines[i + 1].includes('-')) continue;
    let end = i + 2;
    while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end++;
    out.push({ start: i, end });
    i = end - 1;
  }
  return out;
}

export function parseTable(lines) {
  const head = splitRow(lines[0]);
  const align = splitRow(lines[1]).map((d) => (d.startsWith(':') && d.endsWith(':') ? 'center' : d.endsWith(':') ? 'right' : d.startsWith(':') ? 'left' : ''));
  const rows = lines.slice(2).map((l) => {
    const c = splitRow(l);
    return head.map((_, i) => (c[i] ?? '').replace(/<br\s*\/?>/gi, '\n'));
  });
  return { head, align: head.map((_, i) => align[i] || ''), rows };
}

// Columns padded to line up, so the table reads well as plain text too.
export function tableToMarkdown(t) {
  const cell = (v) => String(v ?? '').trim().replace(/\n/g, '<br>').replace(/(^|[^\\])\|(?![^[]*\]\])/g, '$1\\|');
  const head = t.head.map((h, i) => cell(h) || `Column ${i + 1}`);
  const rows = t.rows.map((r) => head.map((_, i) => cell(r[i])));
  const width = head.map((h, i) => Math.min(40, Math.max(3, h.length, ...rows.map((r) => r[i].length))));
  const pad = (v, i) => v + ' '.repeat(Math.max(0, width[i] - v.length));
  const dash = (i) => { const a = t.align?.[i] || ''; const n = Math.max(3, width[i]); return a === 'center' ? ':' + '-'.repeat(n - 2) + ':' : a === 'right' ? '-'.repeat(n - 1) + ':' : a === 'left' ? ':' + '-'.repeat(n - 1) : '-'.repeat(n); };
  const line = (cells) => `| ${cells.map(pad).join(' | ')} |`;
  return [line(head), `| ${head.map((_, i) => dash(i)).join(' | ')} |`, ...rows.map(line)].join('\n');
}

const guessHeaders = (grid) => grid.length > 1 && grid[0].every((h) => h && !/^-?\d+([.,]\d+)?$/.test(h));
export function tableFromGrid(grid, headers = guessHeaders(grid)) {
  const width = Math.max(...grid.map((r) => r.length));
  const head = headers ? grid[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const rows = (headers ? grid.slice(1) : grid).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
  return { head: Array.from({ length: width }, (_, i) => head[i] || `Column ${i + 1}`), align: Array(width).fill(''), rows };
}

// --- reading --------------------------------------------------------------
const CHECK = /^\[( |x|X)\]$/;
const RANGE = /^(\d+)(?:\s*[-–—]\s*(\d+)|\+)?$/;

// Adds the reading tools to the tables in rendered (already sanitised) HTML.
export function enhanceTables(html) {
  if (!html.includes('<table')) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  for (const table of tpl.content.querySelectorAll('table')) {
    if (table.closest('.wa-table, .statblock')) continue;
    const ths = [...table.querySelectorAll('thead th')];
    const trs = [...table.querySelectorAll('tbody tr')];
    if (!ths.length) continue;
    const names = ths.map((th) => th.textContent.trim().toLowerCase());
    const chance = names.findIndex((n) => n === 'chance' || n === 'weight');
    // A first column named after a die ("d8", "1d20", "d%") with numbers or ranges: Roll rolls that die.
    const die = /^1?d(\d+|%)$/.test(names[0]) && trs.length && trs.every((tr) => RANGE.test(tr.cells[0]?.textContent.trim() || '')) ? names[0] : '';
    ths.forEach((th, i) => {
      th.dataset.sort = i;
      th.title = `Sort by ${th.textContent.trim()}`;
      if (i === chance) th.classList.add('t-hide');
    });
    trs.forEach((tr, r) => {
      tr.dataset.i = r;
      [...tr.cells].forEach((td, i) => {
        const text = td.textContent.trim();
        td.dataset.v = text;
        if (i === chance) { td.classList.add('t-hide'); tr.dataset.w = text === '' ? 1 : Math.max(0, parseFloat(text) || 0); return; }
        if (i === 0 && die) {
          const [, lo, hi] = RANGE.exec(text);
          tr.dataset.lo = lo;
          tr.dataset.hi = text.endsWith('+') ? 1e9 : hi || lo;
        }
        if (CHECK.test(text)) {
          td.classList.add('t-check');
          td.innerHTML = `<input type="checkbox" data-check="${r}:${i}" ${/x/i.test(text) ? 'checked' : ''} aria-label="${esc(ths[i]?.textContent.trim() || 'Done')}">`;
        } else if (rollDice(text) && td.children.length === 0) {
          td.classList.add('t-dice');
          td.innerHTML = `<button type="button" class="dice-btn" data-dice="${esc(text)}" title="Roll ${esc(text)}">${icon('dice-five')}<span>${esc(text)}</span></button><span class="dice-out" aria-live="polite"></span>`;
        }
      });
    });
    // A column of numbers lines up on the right.
    ths.forEach((th, i) => {
      const vals = trs.map((tr) => tr.cells[i]?.dataset.v).filter(Boolean);
      if (i === chance || (i === 0 && die) || !vals.length || !vals.every((v) => /^-?\d+([.,]\d+)?$/.test(v))) return;
      th.classList.add('t-number');
      trs.forEach((tr) => tr.cells[i]?.classList.add('t-number'));
    });
    const box = document.createElement('div');
    box.className = 'wa-table';
    if (die) box.dataset.die = die;
    const search = trs.length >= 6;
    // Checklists (tables with [ ] boxes) aren't for rolling, unless they ask to be.
    const checklist = !!table.querySelector('[data-check]');
    const roll = die || chance >= 0 ? trs.length >= 2 : trs.length >= 3 && !checklist;
    box.innerHTML = (search || roll ? `<div class="wa-table-bar">
        ${search ? `<label class="wa-table-search">${icon('magnifying-glass')}<input type="search" placeholder="Search this table" aria-label="Search this table"></label><span class="wa-table-count muted small">${trs.length} rows</span>` : ''}
        ${roll ? `<button type="button" class="btn small quiet roll-btn" data-roll title="${die ? `Roll ${die} for a row` : chance >= 0 ? `Pick a random row, weighted by ${esc(ths[chance].textContent.trim())}` : 'Pick a random row'}">${icon('dice-five')} Roll${die ? ` ${esc(die)}` : ''}</button>` : ''}
      </div><div class="wa-roll-result" hidden></div>` : '') + '<div class="wa-table-scroll"></div>';
    table.replaceWith(box);
    box.lastElementChild.append(table);
  }
  return tpl.innerHTML;
}

function showCount(box) {
  const rows = $$('tbody tr', box);
  const vis = rows.filter((r) => !r.hidden).length;
  const el = $('.wa-table-count', box);
  if (el) el.textContent = vis === rows.length ? `${rows.length} rows` : `${vis} of ${rows.length}`;
}

function rollDiceButton(btn) {
  const r = rollDice(btn.dataset.dice);
  const out = btn.nextElementSibling;
  if (!r || !out) return;
  out.innerHTML = `<b>${r.total}</b>${/[+−(]/.test(r.detail) ? ` <span class="muted">${esc(r.detail)}</span>` : ''}`;
  out.classList.remove('fresh'); void out.offsetWidth; out.classList.add('fresh');
}

function rollTable(box) {
  const all = $$('tbody tr', box);
  const rows = all.filter((r) => !r.hidden);
  const res = $('.wa-roll-result', box);
  let pick, how = '';
  if (box.dataset.die) {
    const sides = box.dataset.die.endsWith('%') ? 100 : +box.dataset.die.replace(/^1?d/, '');
    const n = 1 + Math.floor(Math.random() * sides);
    pick = all.find((r) => n >= +r.dataset.lo && n <= +r.dataset.hi);
    how = `${n} on the ${box.dataset.die}`;
    if (!pick) { res.hidden = false; res.innerHTML = `${icon('dice-five')}<span>Rolled ${how}: no row for that number.</span>`; return; }
  } else {
    const total = rows.reduce((s, r) => s + (r.dataset.w == null ? 1 : +r.dataset.w), 0);
    if (!total) { res.hidden = false; res.textContent = 'No rows to roll on.'; return; }
    let x = Math.random() * total;
    pick = rows.find((r) => (x -= r.dataset.w == null ? 1 : +r.dataset.w) < 0) || rows.at(-1);
  }
  pick.hidden = false;
  $$('tr.rolled', box).forEach((r) => r.classList.remove('rolled'));
  pick.classList.add('rolled');
  $$('.dice-btn', pick).forEach(rollDiceButton);
  const cells = [...pick.cells].filter((td, i) => !td.classList.contains('t-hide') && !(i === 0 && box.dataset.die));
  const label = cells.map((td) => td.dataset.v).find(Boolean) || `Row ${+pick.dataset.i + 1}`;
  res.hidden = false;
  res.innerHTML = `${icon('dice-five')}<span>${how ? `Rolled ${esc(how)}: ` : 'Rolled '}<b>${esc(label.length > 90 ? label.slice(0, 89) + '…' : label)}</b></span>`;
  pick.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function sortBy(box, th) {
  const col = +th.dataset.sort;
  const dir = th.dataset.dir === 'asc' ? 'desc' : th.dataset.dir === 'desc' ? '' : 'asc';
  $$('th[data-sort]', box).forEach((h) => { delete h.dataset.dir; });
  if (dir) th.dataset.dir = dir;
  const tbody = $('tbody', box);
  const val = (tr) => tr.cells[col]?.dataset.v ?? '';
  const rows = $$('tr', tbody);
  rows.sort((a, b) => {
    if (!dir) return a.dataset.i - b.dataset.i;
    const x = val(a), y = val(b);
    const c = x === '' && y !== '' ? 1 : y === '' && x !== '' ? -1 : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? c : -c;
  });
  tbody.append(...rows);
}

// Ticking a box on an article's page changes [ ] to [x] in its text and saves.
async function toggleCheck(input) {
  const host = input.closest('[data-article]');
  const a = host && store.article(host.dataset.article);
  if (!a || input.closest('.excerpt')) return;
  const which = $$('.wa-table', host).filter((b) => !b.closest('.excerpt')).indexOf(input.closest('.wa-table'));
  const [r, c] = input.dataset.check.split(':').map(Number);
  const lines = a.body.split('\n');
  const t = findTables(a.body)[which];
  const ln = t && t.start + 2 + r;
  if (!t || ln >= t.end) return;
  const cells = splitRow(lines[ln]);
  if (!CHECK.test(cells[c] || '')) return;
  cells[c] = input.checked ? '[x]' : '[ ]';
  lines[ln] = `| ${cells.join(' | ')} |`;
  await store.save('articles', { ...a, body: lines.join('\n') });
}

document.addEventListener('click', (e) => {
  const box = e.target.closest('.wa-table');
  if (!box) return;
  const dice = e.target.closest('.dice-btn');
  if (dice) { e.preventDefault(); rollDiceButton(dice); return; }
  if (e.target.closest('[data-roll]')) { rollTable(box); return; }
  const th = e.target.closest('th[data-sort]');
  if (th && !e.target.closest('a')) sortBy(box, th);
});
document.addEventListener('input', (e) => {
  const q = e.target.closest('.wa-table-search input');
  if (!q) return;
  const box = q.closest('.wa-table');
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  for (const tr of $$('tbody tr', box)) tr.hidden = !terms.every((t) => tr.textContent.toLowerCase().includes(t));
  showCount(box);
});
document.addEventListener('change', (e) => {
  if (!e.target.matches('.wa-table input[data-check]')) return;
  // Only an article's own tables can be ticked; elsewhere the box springs back.
  if (!e.target.closest('[data-article]') || e.target.closest('.excerpt')) { e.target.checked = !e.target.checked; toast('Tick it on the article’s own page'); return; }
  toggleCheck(e.target);
});

// --- the table editor ------------------------------------------------------
// Opens the grid for a table: { head, align, rows }. Resolves with the edited
// table, 'delete', or null if cancelled.
export function editTable(initial, { isNew } = {}) {
  const t = structuredClone(initial || { head: ['Name', 'Description'], align: ['', ''], rows: [['', ''], ['', ''], ['', '']] });
  let dirty = false;
  return modal(isNew ? 'Add a table' : 'Edit table', `<form id="tblF">
    <div id="tblGrid"></div>
    <details class="tbl-tips"><summary>${icon('info')} Rolling, dice and checkboxes</summary><ul>
      <li>A cell that is just a roll, like <code>2d6+1</code>, gets a button that rolls it.</li>
      <li><code>[ ]</code> and <code>[x]</code> become checkboxes you can tick on the article’s page.</li>
      <li><b>Roll</b> picks a random row. Name the first column after a die, like <code>d8</code>, and fill it with numbers or ranges (<code>1–2</code>, <code>3</code>) to roll that die. A column called <b>Chance</b> makes rows more or less likely and stays hidden.</li>
      <li><code>[[Links]]</code>, <b>**bold**</b> and <i>*italic*</i> work in cells.</li></ul></details>
    <div class="actions">
      ${isNew ? '' : `<button type="button" class="btn danger" data-deltable>${icon('trash')} Remove table</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn quiet" data-cancel>Cancel</button>
      <button class="btn primary">${icon('check')} ${isNew ? 'Add table' : 'Done'}</button>
    </div></form>`, {
    wide: true,
    onMount: (m, close) => {
      const el = $('#tblGrid', m);
      const draw = () => {
        el.innerHTML = `<div class="tbl-ed">
          <div class="tbl-ed-scroll"><table class="tbl-grid">
            <thead><tr><th class="h-handle"></th>${t.head.map((h, i) => `<th data-c="${i}">
              <div class="col-head"><input class="col-name" value="${esc(h)}" placeholder="Column name" aria-label="Column name">
                <span class="col-tools">
                  <button type="button" class="icon-btn sm" data-move="-1" title="Move left" ${i ? '' : 'disabled'}>${icon('caret-left')}</button>
                  <button type="button" class="icon-btn sm" data-move="1" title="Move right" ${i < t.head.length - 1 ? '' : 'disabled'}>${icon('caret-right')}</button>
                  <button type="button" class="icon-btn sm" data-rmcol title="Delete column" ${t.head.length > 1 ? '' : 'disabled'}>${icon('trash')}</button></span></div>
            </th>`).join('')}<th class="h-end"></th></tr></thead>
            <tbody>${t.rows.map((r, ri) => `<tr data-r="${ri}"><td class="handle" title="Drag to move the row">${icon('dots-six-vertical')}</td>${t.head.map((_, ci) => `<td data-c="${ci}"><textarea class="cell" rows="1">${esc(r[ci] ?? '')}</textarea></td>`).join('')}
              <td class="h-end"><button type="button" class="icon-btn sm" data-rmrow title="Delete row">${icon('x')}</button></td></tr>`).join('')}</tbody>
          </table></div>
          <div class="tbl-ed-actions">
            <button type="button" class="btn small" data-addrow>${icon('plus')} Row</button>
            <button type="button" class="btn small" data-addcol>${icon('plus')} Column</button>
            <span class="spacer"></span>
            <button type="button" class="btn small quiet" data-paste>${icon('file-text')} Paste from a spreadsheet</button>
            <label class="btn small quiet">${icon('upload-simple')} Import CSV<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden data-csv></label>
            <button type="button" class="btn small quiet" data-export>${icon('download-simple')} Export CSV</button>
          </div></div>`;
        $$('textarea.cell', el).forEach(fit);
      };
      const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
      draw();
      const colOf = (n) => +n.closest('[data-c]')?.dataset.c;
      const rowOf = (n) => +n.closest('tr[data-r]')?.dataset.r;
      el.addEventListener('input', (e) => {
        const x = e.target;
        dirty = true;
        if (x.matches('.col-name')) t.head[colOf(x)] = x.value;
        else if (x.matches('.cell')) { t.rows[rowOf(x)][colOf(x)] = x.value; fit(x); }
      });
      // Enter in a cell moves down a row (Shift+Enter for a new line in the cell).
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey || !e.target.matches('.cell')) return;
        e.preventDefault();
        const r = rowOf(e.target), c = colOf(e.target);
        if (r === t.rows.length - 1) { t.rows.push(t.head.map(() => '')); draw(); }
        $(`tr[data-r="${r + 1}"] td[data-c="${c}"] .cell`, el)?.focus();
      });
      el.addEventListener('change', (e) => {
        if (!e.target.matches('[data-csv]')) return;
        const file = e.target.files[0];
        e.target.value = '';
        if (file) file.text().then((text) => fill(text));
      });
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.matches('[data-addrow]')) { t.rows.push(t.head.map(() => '')); draw(); $$('tbody tr', el).at(-1)?.querySelector('.cell')?.focus(); } else if (b.matches('[data-addcol]')) {
          t.head.push(''); t.align.push(''); t.rows.forEach((r) => r.push(''));
          draw(); $$('.col-name', el).at(-1)?.focus();
        } else if (b.matches('[data-rmrow]')) {
          if (t.rows[rowOf(b)].some((v) => v.trim()) && !(await confirmDialog('Delete this row?', 'Delete row'))) return;
          t.rows.splice(rowOf(b), 1); draw();
        } else if (b.matches('[data-rmcol]')) {
          const i = colOf(b);
          if (t.rows.some((r) => (r[i] || '').trim()) && !(await confirmDialog(`Delete the column “${t.head[i] || 'untitled'}” and everything in it?`, 'Delete column'))) return;
          t.head.splice(i, 1); t.align.splice(i, 1); t.rows.forEach((r) => r.splice(i, 1)); draw();
        } else if (b.matches('[data-move]')) {
          const i = colOf(b), j = i + +b.dataset.move;
          for (const arr of [t.head, t.align, ...t.rows]) [arr[i], arr[j]] = [arr[j], arr[i]];
          draw();
        } else if (b.matches('[data-paste]')) fill('');
        else if (b.matches('[data-export]')) download('table.csv', new Blob([toCSV(t)], { type: 'text/csv' }));
        else return;
        dirty = true;
      });
      // Rows move by dragging their handle.
      let from = null;
      el.addEventListener('pointerdown', (e) => { const h = e.target.closest('.handle'); if (h) h.closest('tr').draggable = true; });
      el.addEventListener('dragstart', (e) => { const tr = e.target.closest('tr[data-r]'); if (!tr) return; from = +tr.dataset.r; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
      el.addEventListener('dragover', (e) => {
        const tr = e.target.closest('tbody tr[data-r]');
        if (from == null || !tr) return;
        e.preventDefault();
        $$('tr.drop-before, tr.drop-after', el).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
        const r = tr.getBoundingClientRect();
        tr.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      });
      el.addEventListener('drop', (e) => {
        const tr = e.target.closest('tbody tr[data-r]');
        if (from == null || !tr) return;
        e.preventDefault();
        let to = +tr.dataset.r + (tr.classList.contains('drop-after') ? 1 : 0);
        const [row] = t.rows.splice(from, 1);
        if (to > from) to--;
        t.rows.splice(to, 0, row);
        from = null; dirty = true; draw();
      });
      el.addEventListener('dragend', () => { from = null; $$('tr[draggable]', el).forEach((x) => { x.draggable = false; x.classList.remove('dragging', 'drop-before', 'drop-after'); }); });

      function fill(text) {
        const has = t.rows.some((r) => r.some((v) => v.trim()));
        modal('Paste from a spreadsheet', `<form id="tp">
          <p class="muted small">Copy cells from Excel, Google Sheets or Numbers and paste them here, or paste CSV text.</p>
          <textarea name="text" rows="9" class="mono" placeholder="Name&#9;Description&#10;Goblin&#9;Small and mean">${esc(text)}</textarea>
          <label class="check"><input type="checkbox" name="headers" checked> The first row holds the column names</label>
          ${has ? '<label class="check"><input type="checkbox" name="append"> Add to the rows already here</label>' : ''}
          <div class="actions"><button type="button" class="btn quiet" data-cancel>Cancel</button><button class="btn primary">${icon('check')} Fill table</button></div>
        </form>`, {
          wide: true,
          onMount: (pm, pclose) => {
            const pf = $('#tp', pm);
            $('[data-cancel]', pm).onclick = () => pclose();
            pf.text.focus();
            pf.onsubmit = (ev) => {
              ev.preventDefault();
              const grid = parseDelimited(pf.text.value);
              if (!grid.length) return toast('Nothing to add');
              const next = tableFromGrid(grid, pf.headers.checked);
              if (pf.append?.checked) {
                const at = new Map(t.head.map((h, i) => [h.trim().toLowerCase(), i]));
                next.head.forEach((h) => { if (!at.has(h.trim().toLowerCase())) { at.set(h.trim().toLowerCase(), t.head.length); t.head.push(h); t.align.push(''); t.rows.forEach((r) => r.push('')); } });
                for (const r of next.rows) { const row = t.head.map(() => ''); next.head.forEach((h, i) => { row[at.get(h.trim().toLowerCase())] = r[i]; }); t.rows.push(row); }
              } else Object.assign(t, next);
              dirty = true; draw(); pclose();
              toast(`${next.rows.length} row${next.rows.length === 1 ? '' : 's'} added`);
            };
          },
        });
      }

      const f = $('#tblF', m);
      $('[data-cancel]', m).onclick = async () => { if (!dirty || await confirmDialog('Discard your changes to this table?', 'Discard', { cancelLabel: 'Keep editing' })) close(null); };
      $('[data-deltable]', m)?.addEventListener('click', async () => { if (await confirmDialog('Remove this table from the article?', 'Remove')) close('delete'); });
      f.onsubmit = (e) => {
        e.preventDefault();
        t.rows = t.rows.filter((r) => r.some((v) => v.trim()));
        close(t);
      };
      $('.cell', el)?.focus();
    },
  });
}

// The Table button: edits the table the cursor is in, or adds one at the cursor.
// Works on the editor's textarea; returns once the text is updated.
export async function tableCommand(ta) {
  const v = ta.value;
  const lineNo = v.slice(0, ta.selectionStart).split('\n').length - 1;
  const at = findTables(v).find((t) => lineNo >= t.start && lineNo < t.end);
  const lines = v.split('\n');
  const result = await editTable(at ? parseTable(lines.slice(at.start, at.end)) : null, { isNew: !at });
  if (!result) return;
  let text, pos;
  if (at) {
    const md = result === 'delete' ? [] : tableToMarkdown(result).split('\n');
    lines.splice(at.start, at.end - at.start, ...md);
    text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    pos = lines.slice(0, at.start + md.length).join('\n').length;
  } else {
    if (result === 'delete' || !result.rows.length && result.head.every((h) => !h.trim())) return;
    const s = ta.selectionStart, before = v.slice(0, s), after = v.slice(ta.selectionEnd);
    const lead = !before.trim() ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const md = tableToMarkdown(result);
    text = before + lead + md + trail + after;
    pos = (before + lead + md).length;
  }
  ta.value = text;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- 1.56 tables ------------------------------------------------------------
// 1.56 kept tables as Table-template articles (article.table). They become a
// Markdown table at the end of the article's own text, as an ordinary article.
export function legacyToMarkdown(lt) {
  const cols = (lt.columns || []);
  const v = (c, r) => {
    const x = r.c?.[c.id];
    if (c.type === 'check') return x === true ? '[x]' : '[ ]';
    if (x == null || x === '') return '';
    return c.type === 'article' ? `[[${x}]]` : String(x);
  };
  return tableToMarkdown({
    head: cols.map((c) => (c.type === 'chance' ? 'Chance' : c.name)),
    align: cols.map((c) => (c.type === 'number' || c.type === 'chance' ? 'right' : '')),
    rows: (lt.rows || []).map((r) => cols.map((c) => v(c, r))),
  });
}

export async function convertLegacyTables() {
  for (const a of store.data.articles.values()) {
    if (a.deleted || !a.table?.columns?.length) continue;
    const md = legacyToMarkdown(a.table);
    const next = { ...a, body: (a.body?.trim() ? a.body.trimEnd() + '\n\n' : '') + md, table: null };
    if (next.type === 'table') next.type = 'article';
    await store.save('articles', next);
  }
}
