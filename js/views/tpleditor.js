// The template editor, opened from the New article window: make a template of
// your own (name, icon, category, what it's based on, infobox fields, outline),
// or change a built-in template's infobox fields and outline for this world.
// Saved in world.templates (see js/templates.js).
import * as store from '../store.js';
import { TYPES, GROUPS } from '../store.js';
import { isBuiltIn, builtInSections, applyTemplates, outlineHeadings, TEMPLATE_ICONS } from '../templates.js';
import { REL_TYPES, REL_GROUPS, fieldRelations } from '../relations.js';
import { render } from '../markdown.js';
import { $, $$, esc, uid, toast, modal, confirmDialog } from '../util.js';
import { icon } from '../ui.js';

// What fills a field unless the template says otherwise (an Organization's Leader: Led by).
const usualFill = (name) => fieldRelations(name, null)?.[0] || '';

const relSelect = (sel) => `<select class="tf-fill" aria-label="Fills in from">
    <option value="">—</option>${Object.entries(REL_GROUPS).map(([g, gl]) => `<optgroup label="${gl}">${Object.entries(REL_TYPES).filter(([, t]) => t.group === g)
    .map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t.label}</option>`).join('')}</optgroup>`).join('')}</select>`;
const grip = (what, label) => `<button type="button" class="tpl-grip" data-grip="${what}" aria-label="Move ${esc(label)}" title="Drag to reorder, or use the arrow keys">${icon('dots-six-vertical')}</button>`;
const fieldRow = (f) => `<div class="tpl-field" data-orig="${esc(f.orig || '')}">${grip('field', f.name || 'field')}
    <input class="tf-name" value="${esc(f.name)}" placeholder="Field name" aria-label="Field name">${relSelect(f.fill)}
    <button type="button" class="icon-btn sm" data-rm-field title="Remove field">${icon('x')}</button></div>`;
const sectionBox = (s) => `<div class="tpl-sec"><div class="tpl-sec-head">${grip('sec', s.name || 'section')}
    <input class="ts-name" value="${esc(s.name)}" placeholder="Section name" aria-label="Section name">
    <button type="button" class="icon-btn sm" data-rm-sec title="Remove section">${icon('trash')}</button></div>
    <div class="tpl-fields">${s.fields.map(fieldRow).join('')}</div>
    <button type="button" class="btn small quiet" data-add-field>${icon('plus')} Field</button></div>`;

// An outline as rows (headings and their prompts), when it's only that.
const outlineRowsOk = (md) => String(md || '').split('\n').every((l) => !l.trim() || /^#{2,3}\s+\S/.test(l) || /^ {0,3}> ?\[!prompt\]/i.test(l));
const rowsToOutline = (rows) => rows.filter((r) => r.text.trim())
  .map((r) => `${'#'.repeat(r.level)} ${r.text.trim()}${r.prompt.trim() ? `\n> [!prompt] ${r.prompt.trim()}` : ''}`).join('\n\n');
const outlineRow = (r) => `<div class="ol-row h${r.level}">${grip('ol', r.text || 'heading')}
    <select class="ol-level" aria-label="Level"><option value="2" ${r.level === 2 ? 'selected' : ''}>H2</option><option value="3" ${r.level === 3 ? 'selected' : ''}>H3</option></select>
    <div class="ol-main"><input class="ol-text" value="${esc(r.text)}" placeholder="${r.level === 2 ? 'Heading' : 'Subheading'}" aria-label="Heading">
      <input class="ol-prompt" value="${esc(r.prompt)}" placeholder="Prompt (optional): a question to answer here" aria-label="Prompt"></div>
    <button type="button" class="icon-btn sm" data-rm-ol title="Remove">${icon('x')}</button></div>`;

// Opens the editor. type: a template to edit, or null for a new one.
// Resolves to the template's id once saved (null if cancelled or deleted).
export function templateDialog(wid, type = null) {
  const world = store.world(wid);
  const isNew = !type;
  const custom = isNew || !isBuiltIn(type);
  const t = isNew ? null : TYPES[type];
  const def = isNew ? {} : world.templates?.[type] || {};
  const inUse = isNew ? 0 : store.articlesOf(wid).filter((a) => a.type === type).length;
  let sections = (isNew ? [{ name: 'Overview', fields: ['Type'] }] : t.sections)
    .map((s) => ({ name: s.name, fields: s.fields.map((n) => ({ name: n, orig: isNew ? '' : n, fill: fieldRelations(n, t?.fill)?.[0] || '' })) }));
  let outline = t?.outline || '';
  let iconName = t?.icon || 'file-text';
  let tab = custom ? 'details' : 'infobox';
  let olText = !outlineRowsOk(outline);

  const title = isNew ? 'New template' : `Edit template: ${t.label}`;
  return modal(title, `<form class="form tpl-form" id="tplF" novalidate>
      <div class="tpl-tabs" role="tablist"></div>
      ${custom ? '' : `<div class="tpl-builtin">${icon('info')}<div>A built-in template: its name, icon and charts stay as they are. You can change its <b>infobox fields</b> and its <b>outline</b> for this world. Fields you remove stay on articles that already use them, under “Other”.</div></div>`}
      <div class="tpl-grid"><div class="tpl-pane"></div><aside class="tpl-preview"></aside></div>
      <div class="actions">
        ${custom && !isNew ? `<button type="button" class="btn danger" data-del>${icon('trash')} Delete template</button>` : ''}
        ${inUse ? `<span class="small muted">Used by ${inUse} article${inUse === 1 ? '' : 's'}</span>` : ''}
        <span class="spacer"></span><button type="button" class="btn quiet" data-cancel>Cancel</button>
        <button class="btn primary">${icon('check')} ${isNew ? 'Create template' : 'Save'}</button></div></form>`, {
    wide: true, sticky: true,
    onMount: (m, close) => {
      m.classList.add('tpl-modal');
      const f = $('#tplF', m), pane = $('.tpl-pane', m), prev = $('.tpl-preview', m);
      // Details, kept while switching tabs.
      const details = { label: t?.label || '', plural: isNew ? '' : t.plural, group: t?.group || 'other', base: t?.base || '', hint: t?.hint || '' };

      // ---- read what's on screen back into the state
      const readPane = () => {
        if (tab === 'details') {
          details.label = f.label.value.trim(); details.plural = f.plural.value.trim();
          details.group = f.group.value; details.base = f.base.value; details.hint = f.hint.value.trim();
        } else if (tab === 'infobox') {
          sections = $$('.tpl-sec', pane).map((sec) => ({
            name: $('.ts-name', sec).value.trim(),
            fields: $$('.tpl-field', sec).map((r) => ({ name: $('.tf-name', r).value.trim(), orig: r.dataset.orig, fill: $('.tf-fill', r).value })),
          }));
        } else if (olText) outline = $('.ol-src', pane).value;
        else outline = rowsToOutline($$('.ol-row', pane).map((r) => ({ level: +$('.ol-level', r).value, text: $('.ol-text', r).value, prompt: $('.ol-prompt', r).value })));
      };

      // ---- the tabs
      // The tab bar is drawn once; switching and counting update it in place, so a
      // click right after typing (which redraws nothing) always lands.
      const tabBar = $('.tpl-tabs', m);
      tabBar.innerHTML = [...(custom ? [['details', 'sliders', 'Details']] : []), ['infobox', 'list-bullets', 'Infobox'], ['outline', 'text-h-two', 'Outline']]
        .map(([k, ic, l]) => `<button type="button" role="tab" data-tab="${k}">${icon(ic)} ${l} <span class="count"></span></button>`).join('');
      const tabs = () => {
        const fieldCount = sections.reduce((n, s) => n + s.fields.filter((x) => x.name).length, 0);
        const heads = outlineHeadings(outline).length;
        const counts = { infobox: `${fieldCount} field${fieldCount === 1 ? '' : 's'}`, outline: heads ? `${heads} heading${heads === 1 ? '' : 's'}` : '' };
        for (const b of $$('[data-tab]', tabBar)) {
          b.classList.toggle('on', b.dataset.tab === tab);
          b.setAttribute('aria-selected', b.dataset.tab === tab);
          $('.count', b).textContent = counts[b.dataset.tab] || '';
        }
      };
      tabBar.onclick = (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b || b.dataset.tab === tab) return;
        readPane();
        tab = b.dataset.tab;
        draw();
      };

      // ---- the panes
      const drawDetails = () => {
        const bases = Object.entries(TYPES).filter(([k]) => isBuiltIn(k) && k !== 'article');
        pane.innerHTML = `<div class="tpl-row2"><label>Name<input name="label" value="${esc(details.label)}" placeholder="e.g. Noble House" required></label>
            <label>Plural <small>in the sidebar</small><input name="plural" value="${esc(details.plural)}" placeholder="${esc(details.label ? details.label + 's' : 'e.g. Noble houses')}"></label></div>
          <div class="field-label">Icon</div>
          <div class="tpl-icons" role="radiogroup" aria-label="Icon">${TEMPLATE_ICONS.map((n) => `<button type="button" role="radio" aria-checked="${n === iconName}" class="${n === iconName ? 'on' : ''}" data-icon="${n}" title="${n.replace(/-/g, ' ')}">${icon(n)}</button>`).join('')}</div>
          <div class="tpl-row2">
            <label>Category <small>where it’s listed</small><select name="group">${Object.entries(GROUPS).map(([k, l]) => `<option value="${k}" ${k === details.group ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <label>Based on <small>optional</small><select name="base"><option value="">Nothing: a plain article</option>${bases.map(([k, b]) => `<option value="${k}" ${k === details.base ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select></label>
          </div>
          <p class="tpl-based small muted"></p>
          <label>Description <small>shown when choosing a template</small><input name="hint" value="${esc(details.hint)}" placeholder="e.g. A ruling family: its seat, lineage and holdings."></label>`;
        const based = () => {
          const b = TYPES[f.base.value];
          $('.tpl-based', pane).innerHTML = b ? `${icon('info')} Works like ${/^[AEIOU]/.test(b.label) ? 'an' : 'a'} ${esc(b.label)}: the same charts, writing guide and suggestions, with the fields you give it.` : `${icon('info')} Works like a plain article. Pick a template to borrow its charts and writing guide (an Organization’s chart, say).`;
        };
        based();
        f.base.onchange = based;
        $('.tpl-icons', pane).onclick = (e) => {
          const b = e.target.closest('[data-icon]');
          if (!b) return;
          iconName = b.dataset.icon;
          $$('[data-icon]', pane).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
          drawPreview();
        };
        f.label.addEventListener('input', () => { f.plural.placeholder = f.label.value.trim() ? f.label.value.trim() + 's' : 'e.g. Noble houses'; });
      };
      const drawInfobox = () => {
        pane.innerHTML = `<div class="tpl-cols"><span></span><span>Field</span><span>Fills in from</span><span></span></div>
          <div class="tpl-secs">${sections.map(sectionBox).join('')}</div>
          <div class="tpl-add"><button type="button" class="btn small" data-add-sec>${icon('plus')} Section</button>
            ${custom ? '' : `<span class="spacer"></span><button type="button" class="btn small quiet" data-reset>${icon('arrow-counter-clockwise')} Reset to the usual fields</button>`}</div>`;
      };
      const drawOutline = () => {
        const rows = olText ? [] : outlineHeadings(outline);
        pane.innerHTML = `<p class="tpl-note">Each new ${esc(custom ? details.label || 'article of this template' : t.label)} starts with these headings; articles already written aren’t changed (the writing guide can add the outline to them). A prompt shows under its heading while you write, and is never saved.</p>
          ${olText ? `<textarea class="ol-src" rows="16" spellcheck="false" placeholder="## Appearance\n> [!prompt] What would a stranger notice first?\n\n## History">${esc(outline)}</textarea>
            <p class="small muted" style="margin:.4rem 0 0">Anything Markdown can do: headings, callouts, tables, handwritten blocks. A <code>&gt; [!prompt]</code> line is a prompt; everything else goes into each new article.</p>`
          : `<div class="ol-rows">${rows.map(outlineRow).join('')}</div>`}
          <div class="tpl-add">${olText ? '' : `<button type="button" class="btn small" data-add-ol="2">${icon('plus')} Heading</button><button type="button" class="btn small quiet" data-add-ol="3">${icon('plus')} Subheading</button>`}
            <span class="spacer"></span><button type="button" class="btn small quiet" data-ol-mode>${icon(olText ? 'list-bullets' : 'file-text')} ${olText ? 'Edit as headings' : 'Edit as text'}</button></div>`;
      };
      const drawPreview = () => {
        if (tab === 'outline') {
          prev.innerHTML = `<div class="prev-label">A new ${esc((custom ? details.label : t.label) || 'article')} starts as</div>
            <div class="ol-preview">${outline.trim() ? `<div class="prose">${render(outline, wid)}</div>` : '<p class="muted small">No outline: new articles start empty.</p>'}</div>`;
          return;
        }
        const label = custom ? details.label || 'New template' : t.label;
        prev.innerHTML = `<div class="prev-label">Infobox</div><aside class="infobox"><div class="infobox-inner">
            <div class="infobox-title">${esc(label)}</div>
            <div class="infobox-type"><a>${esc(label)}</a></div>
            <dl>${sections.filter((s) => s.fields.some((x) => x.name)).map((s) => `${sections.length > 1 && s.name ? `<div class="ib-sec">${esc(s.name)}</div>` : ''}${s.fields.filter((x) => x.name)
              .map((x) => `<dt>${esc(x.name)}</dt><dd class="${x.fill ? 'rel' : 'empty'}">${x.fill ? `from “${esc(REL_TYPES[x.fill]?.label || '')}”` : '—'}</dd>`).join('')}`).join('') || '<p class="muted small">No fields yet.</p>'}</dl>
          </div></aside><p class="small muted">Empty fields are hidden on an article.</p>`;
      };
      const draw = () => {
        tabs();
        if (tab === 'details') drawDetails(); else if (tab === 'infobox') drawInfobox(); else drawOutline();
        drawPreview();
      };
      draw();
      const refresh = () => { readPane(); tabs(); drawPreview(); };
      pane.addEventListener('input', refresh);
      pane.addEventListener('change', (e) => {
        // A heading's level shows as its indent.
        const lvl = e.target.closest('.ol-level');
        if (lvl) lvl.closest('.ol-row').className = `ol-row h${lvl.value}`;
        refresh();
      });

      // ---- adding, removing, resetting
      pane.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.matches('[data-add-field]')) {
          $('.tpl-fields', b.closest('.tpl-sec')).insertAdjacentHTML('beforeend', fieldRow({ name: '', fill: '' }));
          $$('.tf-name', b.closest('.tpl-sec')).at(-1).focus();
        } else if (b.matches('[data-rm-field]')) b.closest('.tpl-field').remove();
        else if (b.matches('[data-rm-sec]')) b.closest('.tpl-sec').remove();
        else if (b.matches('[data-add-sec]')) {
          $('.tpl-secs', pane).insertAdjacentHTML('beforeend', sectionBox({ name: '', fields: [{ name: '', fill: '' }] }));
          $$('.ts-name', pane).at(-1).focus();
        } else if (b.matches('[data-reset]')) {
          sections = builtInSections(type).map((s) => ({ name: s.name, fields: s.fields.map((n) => ({ name: n, orig: n, fill: usualFill(n) })) }));
          drawInfobox();
        } else if (b.matches('[data-add-ol]')) {
          $('.ol-rows', pane).insertAdjacentHTML('beforeend', outlineRow({ level: +b.dataset.addOl, text: '', prompt: '' }));
          $$('.ol-text', pane).at(-1).focus();
        } else if (b.matches('[data-rm-ol]')) b.closest('.ol-row').remove();
        else if (b.matches('[data-ol-mode]')) {
          readPane();
          if (olText && !outlineRowsOk(outline)) {
            toast('This outline has more than headings and prompts, so it stays as text.', 5000);
            return;
          }
          olText = !olText;
          drawOutline();
        } else return;
        refresh();
      });

      // ---- reordering: drag a grip, or focus it and use the arrow keys
      const listOf = (g) => ({ field: ['.tpl-field', '.tpl-fields'], sec: ['.tpl-sec', '.tpl-secs'], ol: ['.ol-row', '.ol-rows'] }[g.dataset.grip]);
      pane.addEventListener('keydown', (e) => {
        const g = e.target.closest('[data-grip]');
        if (!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        const row = g.closest(listOf(g)[0]);
        const sib = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
        if (!sib) return;
        row.parentElement.insertBefore(e.key === 'ArrowUp' ? row : sib, e.key === 'ArrowUp' ? sib : row);
        g.focus();
        refresh();
      });
      pane.addEventListener('pointerdown', (e) => {
        const g = e.target.closest('[data-grip]');
        if (!g || e.button !== 0) return;
        e.preventDefault();
        const [rowSel] = listOf(g);
        const row = g.closest(rowSel), list = row.parentElement;
        row.classList.add('dragging');
        const move = (ev) => {
          const over = [...list.children].find((r) => r !== row && ev.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
          if (over !== row.nextElementSibling) list.insertBefore(row, over || null);
        };
        const up = () => {
          row.classList.remove('dragging');
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
          refresh();
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
      });

      $('[data-cancel]', m).onclick = () => close(null);

      // ---- deleting a custom template: its articles move to another one
      $('[data-del]', m)?.addEventListener('click', async () => {
        const arts = store.articlesOf(wid).filter((a) => a.type === type);
        let to = null;
        if (arts.length) {
          to = await modal('Delete template', `<form class="form" id="tplDel"><p style="margin-top:0">${arts.length} article${arts.length === 1 ? ' uses' : 's use'} <b>${esc(t.label)}</b>. Move ${arts.length === 1 ? 'it' : 'them'} to:</p>
              <select name="to">${Object.entries(TYPES).filter(([k]) => k !== type).map(([k, x]) => `<option value="${k}" ${k === (t.base || 'article') ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
              <p class="small muted">Their text, infobox and relationships stay as they are.</p>
              <div class="actions"><button type="button" class="btn quiet" data-no>Cancel</button><button class="btn danger solid">Move and delete</button></div></form>`, {
            onMount: (dm, dclose) => { $('[data-no]', dm).onclick = () => dclose(null); $('#tplDel', dm).onsubmit = (ev) => { ev.preventDefault(); dclose(ev.target.to.value); }; },
          });
          if (!to) return;
        } else if (!(await confirmDialog(`Delete the ${t.label} template?`, 'Delete'))) return;
        for (const a of arts) await store.save('articles', { ...store.article(a.id), type: to });
        const next = { ...store.world(wid) };
        next.templates = { ...(next.templates || {}) };
        delete next.templates[type];
        if (!Object.keys(next.templates).length) delete next.templates;
        if (next.codex) next.codex = { ...next.codex, order: (next.codex.order || []).filter((k) => k !== type), hidden: (next.codex.hidden || []).filter((k) => k !== type) };
        await store.save('worlds', next);
        applyTemplates(store.world(wid));
        toast(`Deleted the ${t.label} template${arts.length ? `; ${arts.length} article${arts.length === 1 ? '' : 's'} moved to ${TYPES[to]?.label || 'Article'}` : ''}`);
        close(null);
      });

      // ---- save
      f.onsubmit = async (e) => {
        e.preventDefault();
        readPane();
        const id = type || 'c-' + uid().slice(0, 8);
        const secs = sections.map((s) => ({ name: s.name, fields: s.fields.filter((x) => x.name) })).filter((s) => s.fields.length);
        const names = secs.flatMap((s) => s.fields.map((x) => x.name.toLowerCase()));
        const dup = names.find((n, i) => names.indexOf(n) !== i);
        if (dup) { tab = 'infobox'; draw(); return toast(`Two fields are called “${dup}”: give each its own name.`, 5000); }
        const fill = {};
        for (const x of secs.flatMap((s) => s.fields)) if (x.fill !== usualFill(x.name)) fill[x.name] = x.fill || null;
        const plain = secs.map((s) => ({ name: s.name, fields: s.fields.map((x) => x.name) }));
        let d;
        if (custom) {
          const label = details.label;
          if (!label) { tab = 'details'; draw(); f.label.focus(); return toast('Give the template a name'); }
          const clash = Object.entries(TYPES).find(([k, x]) => k !== type && [x.label, x.plural].some((n) => n.toLowerCase() === label.toLowerCase()));
          if (clash) { tab = 'details'; draw(); f.label.focus(); return toast(`There’s already a template called ${clash[1].label}`); }
          d = { custom: true, label, plural: details.plural || label + 's', icon: iconName, group: details.group || 'other', hint: details.hint, sections: plain };
          if (details.base) d.base = details.base;
          if (Object.keys(fill).length) d.fill = fill;
          if (outline.trim()) d.outline = outline.trim();
        } else {
          d = {};
          if (JSON.stringify(plain) !== JSON.stringify(builtInSections(type).map((s) => ({ name: s.name, fields: s.fields })))) d.sections = plain;
          if (Object.keys(fill).length) d.fill = fill;
          if (outline.trim()) d.outline = outline.trim();
        }
        // Renamed fields keep their values on articles that have them.
        const renames = sections.flatMap((s) => s.fields).filter((x) => x.orig && x.name && x.orig !== x.name);
        if (renames.length && type) {
          for (const a of store.articlesOf(wid).filter((x) => x.type === type)) {
            const fields = { ...(a.fields || {}) };
            let changed = false;
            for (const r of renames) {
              if (!Object.hasOwn(fields, r.orig)) continue;
              if (!String(fields[r.name] ?? '').trim()) fields[r.name] = fields[r.orig];
              delete fields[r.orig];
              changed = true;
            }
            if (changed) await store.save('articles', { ...a, fields });
          }
        }
        const next = { ...store.world(wid) };
        next.templates = { ...(next.templates || {}) };
        if (Object.keys(d).length) next.templates[id] = d; else delete next.templates[id];
        if (!Object.keys(next.templates).length) delete next.templates;
        await store.save('worlds', next);
        applyTemplates(store.world(wid));
        toast(isNew ? `Created the ${d.label} template` : 'Template saved');
        close(id);
      };
    },
  });
}
