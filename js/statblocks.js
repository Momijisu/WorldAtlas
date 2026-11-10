// Statblocks: a creature's or character's game statistics, written in an
// article's text as a fenced block so it syncs, keeps history and merges like
// any other text (and reads like the Obsidian "statblock" format):
//
//   ```statblock
//   name: Boar
//   type: Medium Beast, Unaligned
//   ac: 11
//   initiative: +0 (10)
//   hp: 13 (2d8 + 4)
//   speed: 40 ft.
//   str: 13 | dex: 11 | con: 14 | int: 2 | wis: 9 | cha: 5      (or one per line)
//   saves: Con +4
//   senses: Passive Perception 9
//   languages: None
//   cr: 1/4 (XP 50; PB +2)
//
//   ## Traits
//   ***Bloodied Fury.*** While [[Bloodied]], the boar has Advantage on attack rolls.
//
//   ## Actions
//   ***Gore.*** *Melee Attack Roll:* +3, reach 5 ft. ...
//   ```
//
// Every line is optional. Sections are Markdown, with [[links]] and dice.
// The editor's Statblock button fills one in with a form. See docs/STATBLOCKS.md.
import { $, esc, modal, confirmDialog } from './util.js';
import { icon } from './icons.js';
import { rollDice } from './tables.js';

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
// Lines shown under the abilities, in this order, with these labels.
const DETAILS = [['skills', 'Skills'], ['resistances', 'Resistances'], ['vulnerabilities', 'Vulnerabilities'], ['immunities', 'Immunities'],
  ['gear', 'Gear'], ['senses', 'Senses'], ['languages', 'Languages'], ['cr', 'CR']];
const TOP = [['ac', 'AC'], ['initiative', 'Initiative'], ['hp', 'HP'], ['speed', 'Speed']];
const KNOWN = new Set(['name', 'type', 'saves', ...ABILITIES, ...TOP.map(([k]) => k), ...DETAILS.map(([k]) => k)]);
const ALIASES = { 'armor class': 'ac', 'armour class': 'ac', 'hit points': 'hp', challenge: 'cr', 'saving throws': 'saves', size: 'type', strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha', equipment: 'gear', 'damage resistances': 'resistances', 'damage immunities': 'immunities', 'condition immunities': 'immunities', 'damage vulnerabilities': 'vulnerabilities' };

export const FENCE = /^```statblock[^\n]*\n([\s\S]*?)\n?```[ \t]*$/gm;

// The block's text → { fields: {key: value}, extra: [[label, value]], sections: [{ title, body }] }.
export function parseStatblock(src) {
  const fields = {}, extra = [], sections = [];
  let sec = null;
  for (const line of String(src || '').split('\n')) {
    const h = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (h) { sec = { title: h[1].trim(), body: '' }; sections.push(sec); continue; }
    if (sec) { sec.body += line + '\n'; continue; }
    if (!line.trim()) continue;
    // "str: 13 | dex: 11 | ..." on one line, or one per line.
    for (const part of line.split(/\s+\|\s+/)) {
      const m = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/.exec(part);
      if (!m) { if (!sections.length) { sec = { title: '', body: line + '\n' }; sections.push(sec); } break; }
      const raw = m[1].trim().toLowerCase();
      const key = ALIASES[raw] || raw;
      if (KNOWN.has(key)) fields[key] = m[2].trim(); else extra.push([m[1].trim(), m[2].trim()]);
    }
  }
  for (const s of sections) s.body = s.body.trim();
  return { fields, extra, sections: sections.filter((s) => s.title || s.body) };
}

export function statblockToText({ fields, extra = [], sections = [] }) {
  const lines = [];
  const put = (k) => { if (fields[k]?.trim()) lines.push(`${k}: ${fields[k].trim()}`); };
  ['name', 'type', 'ac', 'initiative', 'hp', 'speed'].forEach(put);
  const ab = ABILITIES.filter((k) => fields[k]?.trim());
  if (ab.length) lines.push(ab.map((k) => `${k}: ${fields[k].trim()}`).join(' | '));
  put('saves');
  DETAILS.forEach(([k]) => put(k));
  for (const [l, v] of extra) if (l.trim() && v.trim()) lines.push(`${l.trim()}: ${v.trim()}`);
  for (const s of sections) if (s.title.trim() || s.body.trim()) lines.push('', `## ${s.title.trim() || 'Notes'}`, s.body.trim());
  return '```statblock\n' + lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n```';
}

const mod = (score) => {
  const n = parseInt(score, 10);
  if (Number.isNaN(n)) return null;
  const m = Math.floor((n - 10) / 2);
  return m;
};
const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);

// Saving throws from "Str +5, Con +4" (any order, any case).
function savesOf(text) {
  const out = {};
  for (const m of String(text || '').matchAll(/\b(str|dex|con|int|wis|cha)[a-z]*\.?\s*([+−-]\s*\d+)/gi)) out[m[1].toLowerCase()] = m[2].replace(/\s/g, '').replace('-', '−');
  return out;
}

// In a section each line is an entry ("***Bite.*** …"), so lines written one
// under another become separate paragraphs. Lists, tables and quotes keep
// their lines together.
const KEEP = /^\s*([-*+]\s|\d+[.)]\s|\||>)/;
function entries(body) {
  const lines = body.split('\n');
  return lines.map((l, i) => {
    const next = lines[i + 1];
    return l.trim() && next?.trim() && !KEEP.test(l) && !KEEP.test(next) ? l + '\n' : l;
  }).join('\n');
}

// HTML for a statblock. `inline` and `block` render Markdown (with [[links]]) for this world.
export function statblockHTML(src, { inline, block }) {
  const { fields: f, extra, sections } = parseStatblock(src);
  const saves = savesOf(f.saves);
  const row = (k) => {
    const m = mod(f[k]);
    const save = saves[k] || (m == null ? '' : signed(m));
    return `<tr><th scope="row">${k.toUpperCase()}</th><td class="sb-score">${esc(f[k] ?? '')}</td><td class="sb-mod">${m == null ? '' : signed(m)}</td><td class="sb-save${saves[k] ? ' prof' : ''}">${esc(save)}</td></tr>`;
  };
  const abilities = ABILITIES.some((k) => f[k]) ? `<div class="sb-abilities">${[ABILITIES.slice(0, 3), ABILITIES.slice(3)].map((g) => `<table class="sb-ab">
      <thead><tr><th></th><th></th><th>Mod</th><th>Save</th></tr></thead><tbody>${g.map(row).join('')}</tbody></table>`).join('')}</div>` : '';
  const line = (label, v) => `<div class="stat-line"><b>${esc(label)}</b> ${inline(v)}</div>`;
  const top = [
    f.ac || f.initiative ? `<div class="stat-line">${f.ac ? `<b>AC</b> ${inline(f.ac)}` : ''}${f.ac && f.initiative ? '<span class="sb-gap"></span>' : ''}${f.initiative ? `<b>Initiative</b> ${inline(f.initiative)}` : ''}</div>` : '',
    f.hp ? line('HP', f.hp) : '', f.speed ? line('Speed', f.speed) : '',
  ].join('');
  // CR sits at the top right, beside the name.
  const details = [...DETAILS.filter(([k]) => f[k] && k !== 'cr').map(([k, l]) => line(l, f[k])), ...extra.map(([l, v]) => line(l, v))].join('');
  // Sections with nothing in them (left from the form) aren't shown.
  const secs = sections.filter((s) => s.body.trim()).map((s) => `<section class="sb-sec">${s.title ? `<div class="sb-h">${inline(s.title)}</div>` : ''}<div class="sb-body">${block(entries(s.body))}</div></section>`).join('');
  return diceButtons(`<div class="statblock${secs ? ' two' : ''}">
    ${f.name || f.cr ? `<div class="sb-head"><div class="sb-name">${f.name ? inline(f.name) : ''}</div>${f.cr ? `<div class="sb-cr"><b>CR</b> ${inline(f.cr)}</div>` : ''}</div>` : ''}
    <div class="sb-cols"><div class="sb-core">
      ${f.type ? `<div class="sb-type">${inline(f.type)}</div>` : ''}
      ${top ? `<div class="sb-top">${top}</div>` : ''}
      ${abilities}
      ${details ? `<div class="sb-details">${details}</div>` : ''}
    </div>${secs ? `<div class="sb-secs">${secs}</div>` : ''}</div>
  </div>`);
}

// Rolls in the text ("1d6 + 1", "2d8+4", "d20") become buttons that roll them.
const ROLL = /\(?\b\d*d(?:\d+|%)(?:\s*[+−-]\s*\d+)?\b\)?/g;
function diceButtons(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walk = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) if (ROLL.test(walk.currentNode.data) && !walk.currentNode.parentElement.closest('a, button, code')) nodes.push(walk.currentNode);
  for (const n of nodes) {
    ROLL.lastIndex = 0;
    const span = document.createElement('span');
    // A roll keeps its brackets beside it, so "(4d12 + 7)" never splits across lines.
    span.innerHTML = esc(n.data).replace(ROLL, (whole) => {
      const open = whole.startsWith('(') ? '(' : '', close = whole.endsWith(')') ? ')' : '';
      const r = whole.slice(open.length, whole.length - close.length);
      return rollDice(r.replace('−', '-')) ? `<span class="sb-nw">${open}<button type="button" class="sb-dice" data-dice="${r.replace('−', '-')}" title="Roll ${r}">${r}</button>${close}</span>` : whole;
    });
    n.replaceWith(...span.childNodes);
  }
  return tpl.innerHTML;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('.statblock .sb-dice');
  if (!b) return;
  const r = rollDice(b.dataset.dice);
  if (!r) return;
  let out = b.nextElementSibling;
  if (!out?.classList.contains('sb-roll')) { out = document.createElement('span'); out.className = 'sb-roll'; b.after(out); }
  out.innerHTML = ` → <b>${r.total}</b>${/[+−(]/.test(r.detail) ? ` <span class="muted">(${esc(r.detail)})</span>` : ''}`;
  out.classList.remove('fresh'); void out.offsetWidth; out.classList.add('fresh');
});

// --- link previews -----------------------------------------------------------
// The article's first statblock, small: AC, HP and speed, then the abilities.
export function miniStatblockHTML(body) {
  FENCE.lastIndex = 0;
  const m = FENCE.exec(String(body || ''));
  FENCE.lastIndex = 0;
  if (!m) return '';
  const { fields: f } = parseStatblock(m[1]);
  const first = (v) => esc(String(v).split(/[(;]/)[0].trim());
  const top = [['AC', f.ac], ['HP', f.hp], ['Speed', f.speed], ['CR', f.cr]].filter(([, v]) => v).map(([l, v]) => `<span><b>${l}</b> ${first(v)}</span>`).join('');
  const ab = ABILITIES.filter((k) => f[k]).map((k) => { const md = mod(f[k]); return `<span><b>${k.toUpperCase()}</b>${esc(f[k])}${md == null ? '' : `<i>${signed(md)}</i>`}</span>`; }).join('');
  if (!top && !ab) return '';
  return `<div class="lp-stats">${top ? `<div class="lp-stats-top">${top}</div>` : ''}${ab ? `<div class="lp-stats-ab">${ab}</div>` : ''}</div>`;
}
// The text without its statblocks, for a preview's opening lines.
export const withoutStatblocks = (body) => String(body || '').replace(FENCE, '');

// --- the editor's form -------------------------------------------------------
const BLANK = `name: \ntype: \nac: \nhp: \nspeed: 30 ft.\nstr: 10 | dex: 10 | con: 10 | int: 10 | wis: 10 | cha: 10\n\n## Traits\n\n## Actions\n`;

function statblockDialog(src, isNew) {
  const sb = parseStatblock(src ?? BLANK);
  const f0 = sb.fields;
  const fld = (k, label, ph = '', cls = '') => `<label class="${cls}">${label}<input name="${k}" value="${esc(f0[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  const secRow = (s) => `<div class="sb-ed-sec"><div class="sb-ed-sec-head"><input class="sb-sec-title" value="${esc(s.title)}" placeholder="Section, e.g. Reactions" aria-label="Section title">
      <button type="button" class="icon-btn sm" data-rmsec title="Remove section">${icon('trash')}</button></div>
      <textarea class="sb-sec-body" rows="4" placeholder="***Name.*** What it does. [[Links]] and dice like 2d6 work.">${esc(s.body)}</textarea></div>`;
  return modal(isNew ? 'Add a statblock' : 'Edit statblock', `<form id="sbF" class="form sb-ed">
    <div class="row">${fld('name', 'Name', 'e.g. Boar')}${fld('type', 'Type', 'e.g. Medium Beast, Unaligned')}</div>
    <div class="row four">${fld('ac', 'AC', '11')}${fld('initiative', 'Initiative', '+0 (10)')}${fld('hp', 'HP', '13 (2d8 + 4)')}${fld('speed', 'Speed', '40 ft.')}</div>
    <div class="field-label">Abilities <small>modifiers are worked out for you</small></div>
    <div class="sb-ed-ab">${ABILITIES.map((k) => `<label>${k.toUpperCase()}<input name="${k}" inputmode="numeric" value="${esc(f0[k] ?? '')}"><output data-mod="${k}"></output></label>`).join('')}</div>
    ${fld('saves', 'Saving throws <small>only those that differ from the modifier</small>', 'e.g. Con +4, Wis +2')}
    <div class="row">${fld('skills', 'Skills', 'e.g. Perception +3')}${fld('senses', 'Senses', 'e.g. Passive Perception 9')}</div>
    <div class="row">${fld('resistances', 'Resistances')}${fld('immunities', 'Immunities')}</div>
    <div class="row">${fld('vulnerabilities', 'Vulnerabilities')}${fld('gear', 'Gear')}</div>
    <div class="row">${fld('languages', 'Languages', 'e.g. None')}${fld('cr', 'CR', 'e.g. 1/4 (XP 50; PB +2)')}</div>
    <div class="field-label" style="margin-top:.6rem">Sections <small>traits, actions, reactions… in Markdown</small></div>
    <div id="sbSecs">${(sb.sections.length ? sb.sections : [{ title: 'Traits', body: '' }, { title: 'Actions', body: '' }]).map(secRow).join('')}</div>
    <button type="button" class="btn small" data-addsec>${icon('plus')} Section</button>
    <div class="actions">
      ${isNew ? '' : `<button type="button" class="btn danger" data-delsb>${icon('trash')} Remove statblock</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn quiet" data-cancel>Cancel</button>
      <button class="btn primary">${icon('check')} ${isNew ? 'Add statblock' : 'Done'}</button>
    </div></form>`, {
    wide: true,
    onMount: (m, close) => {
      const f = $('#sbF', m);
      const showMods = () => ABILITIES.forEach((k) => { const v = mod(f[k].value); $(`[data-mod="${k}"]`, m).textContent = v == null ? '' : signed(v); });
      f.addEventListener('input', showMods);
      showMods();
      $('[data-addsec]', m).onclick = () => { $('#sbSecs', m).insertAdjacentHTML('beforeend', secRow({ title: '', body: '' })); $$last('.sb-sec-title', m).focus(); };
      $('#sbSecs', m).addEventListener('click', (e) => { const b = e.target.closest('[data-rmsec]'); if (b) b.closest('.sb-ed-sec').remove(); });
      $('[data-cancel]', m).onclick = () => close(null);
      $('[data-delsb]', m)?.addEventListener('click', async () => { if (await confirmDialog('Remove this statblock from the article?', 'Remove')) close('delete'); });
      f.onsubmit = (e) => {
        e.preventDefault();
        const fields = {};
        for (const k of KNOWN) if (f[k]) fields[k] = f[k].value;
        const sections = [...m.querySelectorAll('.sb-ed-sec')].map((x) => ({ title: x.querySelector('.sb-sec-title').value, body: x.querySelector('.sb-sec-body').value }));
        close(statblockToText({ fields, extra: sb.extra, sections }));
      };
      f.name.focus();
    },
  });
}
const $$last = (sel, root) => [...root.querySelectorAll(sel)].at(-1);

// The Statblock button: edits the statblock the cursor is in, or adds one at the cursor.
export async function statblockCommand(ta) {
  const v = ta.value, at = ta.selectionStart;
  let hit = null;
  for (const m of v.matchAll(FENCE)) if (at >= m.index && at <= m.index + m[0].length) hit = m;
  const result = await statblockDialog(hit ? hit[1] : null, !hit);
  if (!result) return;
  let text, pos;
  if (hit) {
    const repl = result === 'delete' ? '' : result;
    text = (v.slice(0, hit.index) + repl + v.slice(hit.index + hit[0].length)).replace(/\n{3,}/g, '\n\n');
    pos = hit.index + repl.length;
  } else {
    if (result === 'delete') return;
    const before = v.slice(0, at), after = v.slice(ta.selectionEnd);
    const lead = !before.trim() ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    text = before + lead + result + trail + after;
    pos = (before + lead + result).length;
  }
  ta.value = text;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
