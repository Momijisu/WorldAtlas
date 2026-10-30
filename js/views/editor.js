// Article editor: content, infobox fields, calendar dates, relationships.
import * as store from '../store.js';
import { TYPES, GROUPS } from '../store.js';
import { render, headingsOf } from '../markdown.js';
import { calendarOf, formatDate } from '../calendar.js';
import { REL_TYPES, REL_GROUPS } from '../relations.js';
import { resolvePrompt, recordAnswer } from '../prompts.js';
import { guidanceFor, guidanceEnabled, headingsIn } from '../guidance.js';
import { $, $$, esc, uid, toast, confirmDialog, prepareImage } from '../util.js';
import { wireFocus, BANNER_POS } from '../focus.js';
import { dropzoneEmpty, wireDropzone } from '../dropzone.js';
import { scriptsFor, familyFor, HANDS } from '../scripts.js';
import { view, state, setTitle, hydrateImages, icon, typeIcon, articleOptions, pageHead, worldCrumb, sep } from '../ui.js';

export function viewEditor(wid, a, isNew, { prompt: promptKey } = {}) {
  const prompt = promptKey ? resolvePrompt(wid, promptKey) : null;
  const w = store.world(wid);
  const cal = calendarOf(w);
  const oldTitle = a.title;
  a.fields ||= {};
  a.tags ||= [];
  a.relations ||= [];
  // What this edit is based on, to spot changes synced in while editing.
  const baseAt = a.updatedAt;
  const baseContent = JSON.stringify(store.contentOf(a));
  let dirty = isNew && !!a.title;
  state.guard = () => dirty;
  state.guardMessage = 'Discard your unsaved changes to this article?';
  setTitle(isNew ? 'New article' : 'Editing ' + a.title);
  const excluded = isNew ? new Set() : new Set([a.id, ...store.descendantIds(a)]);
  const cancelHref = isNew ? (a.parentId ? `#/w/${wid}/a/${a.parentId}` : `#/w/${wid}`) : `#/w/${wid}/a/${a.id}`;
  // A month past the end of the calendar (e.g. after months were removed) is kept as is.
  const monthOpts = (sel) => `<option value="">Month</option>` +
    cal.months.map((m, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(m.name)}</option>`).join('') +
    (sel != null && sel >= cal.months.length ? `<option value="${sel}" selected>Month ${sel + 1}</option>` : '');
  const dateRow = (prefix, y, m, d) => `<div class="date-row">
      <input name="${prefix}" type="number" step="1" value="${y ?? ''}" placeholder="Year" aria-label="Year">
      <select name="${prefix}M" aria-label="Month">${monthOpts(m)}</select>
      <input name="${prefix}D" type="number" min="1" step="1" value="${d ?? ''}" placeholder="Day" aria-label="Day">
    </div>`;

  view.innerHTML = `<form class="page editor" id="ed" autocomplete="off">
    ${pageHead({
      sticky: true,
      eyebrow: `${worldCrumb(wid)} ${sep} ${isNew ? 'New' : 'Editing'} ${esc((TYPES[a.type] || TYPES.article).label.toLowerCase())}`,
      title: esc(a.title || 'Untitled'),
      actions: `${isNew ? '' : `<button type="button" class="btn danger" id="del">${icon('trash')}<span class="hide-sm">Delete</span></button>`}
        <a class="btn quiet" href="${cancelHref}">Cancel</a>
        <button class="btn primary">${icon('check')} Save</button>`,
    })}
    ${a.conflict ? `<div class="conflict-banner">${icon('warning')}<div><b>Conflicting edits.</b> Saving here won’t clear the conflict. <a href="#/w/${wid}/a/${a.id}/resolve">Resolve it</a>.</div></div>` : ''}
    ${prompt ? `<div class="prompt-callout">${icon('feather')}<div><div class="eyebrow">Writing prompt</div><p>${esc(prompt.text)}</p></div></div>` : ''}
    <div class="editor-grid">
      <div class="editor-main">
        <label>Title<input name="title" required value="${esc(a.title)}" placeholder="e.g. Queen Ysolde"></label>
        <div class="row">
          <label>Template<select name="type">${Object.entries(GROUPS).map(([g, gl]) => `<optgroup label="${esc(gl)}">${Object.entries(TYPES).filter(([, t]) => t.group === g).map(([k, t]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${t.label}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <label>Part of <small>(parent article)</small><select name="parentId">${articleOptions(wid, a.parentId, { exclude: excluded })}</select></label>
        </div>
        <p class="tpl-hint" id="tplHint"></p>
        <label>Summary <small>shown in lists and link previews</small><textarea name="summary" rows="2" class="ac-target">${esc(a.summary)}</textarea></label>
        ${guidanceEnabled() ? '<details class="guide" id="guide"><summary></summary><ol class="guide-list"></ol></details>' : ''}
        <div class="field-label">Content <small>Markdown · type <code>[[</code> to link another article</small></div>
        <div class="md-toolbar">
          <button type="button" data-md="bold" title="Bold">${icon('text-b')}</button>
          <button type="button" data-md="italic" title="Italic">${icon('text-italic')}</button>
          <button type="button" data-md="h2" title="Heading">${icon('text-h-two')}</button>
          <button type="button" data-md="h3" title="Subheading">${icon('text-h-three')}</button>
          <button type="button" data-md="ul" title="Bullet list">${icon('list-bullets')}</button>
          <button type="button" data-md="quote" title="Quote">${icon('quotes')}</button>
          <button type="button" data-md="link" title="Link to article">${icon('link-simple')}</button>
          <button type="button" data-md="hr" title="Divider">${icon('minus')}</button>
          <span class="md-script"><button type="button" id="scriptBtn" title="Handwriting or a world font" aria-haspopup="true">${icon('feather')}<span class="hide-sm">Script</span></button>
            <span class="script-menu" id="scriptMenu" hidden></span></span>
          <span class="spacer"></span>
          <span class="seg md-mode" role="group" aria-label="Editing view">
            <button type="button" data-mode="live" title="See formatting as you type">Live</button>
            <button type="button" data-mode="markdown" title="Plain Markdown">Markdown</button>
            <button type="button" data-mode="preview" title="Read-only preview">${icon('eye')}<span class="hide-sm">Preview</span></button>
          </span>
        </div>
        <textarea name="body" rows="18" class="md ac-target" placeholder="**bold**, *italic*, ## heading, - list, [[Article link]]">${esc(a.body)}</textarea>
        <div class="live-editor" id="liveBody" hidden></div>
        <div class="prose md-preview" hidden></div>
        <details class="secret-edit" ${a.gmNotes ? 'open' : ''}><summary>${icon('lock-simple')} Secrets &amp; GM notes</summary>
          <textarea name="gmNotes" rows="5" class="ac-target" placeholder="Collapsed on the article page">${esc(a.gmNotes)}</textarea></details>
      </div>
      <aside class="editor-side">
        <div class="panel">
          <div class="field-label">Portrait / image</div>
          <div class="image-field">
            <img class="thumb" ${a.image ? `data-img="${a.image}"` : 'hidden'} alt="">
            ${dropzoneEmpty('a portrait')}
            <label class="btn small">${icon('image')} Choose image<input type="file" accept="image/*" hidden id="imgFile"></label>
            <button type="button" class="btn small quiet" id="imgRm" ${a.image ? '' : 'hidden'}>Remove</button>
            <button type="button" class="btn small quiet" id="portraitFromBanner" hidden>${icon('image')} Use header image</button>
            <p class="small muted focus-hint" id="imgHint" ${a.image ? '' : 'hidden'}>Drag the picture to choose what shows in thumbnails. The infobox shows it whole.</p>
          </div>
        </div>
        <div class="panel">
          <div class="field-label">Header image <small>banner behind the title</small></div>
          <div class="image-field">
            <img class="thumb banner-thumb" ${a.banner ? `data-img="${a.banner}"` : 'hidden'} alt="">
            ${dropzoneEmpty('a header image')}
            <label class="btn small">${icon('image')} Choose image<input type="file" accept="image/*" hidden id="bannerFile"></label>
            <button type="button" class="btn small quiet" id="bannerRm" ${a.banner ? '' : 'hidden'}>Remove</button>
            <button type="button" class="btn small quiet" id="bannerFromPortrait" hidden>${icon('image')} Use portrait</button>
            <p class="small muted focus-hint" id="bannerHint" ${a.banner ? '' : 'hidden'}>Drag the picture to choose what stays in view.</p>
          </div>
        </div>
        ${store.mapsOf(wid).length ? `<div class="panel">
          <label class="field-label" for="mapPick">Map <small>shown on this article</small></label>
          <select id="mapPick" name="mapId"><option value="">None</option>${store.mapsOf(wid).sort((x, y) => x.name.localeCompare(y.name))
            .map((m) => `<option value="${m.id}" ${a.mapId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
        </div>` : ''}
        <div class="panel">
          <div class="field-label">Date <small>for the timeline and calendar</small></div>
          <div class="muted small" style="margin-bottom:.3rem">Date / start</div>
          ${dateRow('start', a.start, a.startM, a.startD)}
          <div class="muted small" style="margin:.6rem 0 .3rem">End <small>(optional)</small></div>
          ${dateRow('end', a.end, a.endM, a.endD)}
          <div class="date-preview" id="datePreview"></div>
          <label>Date text <small>optional, replaces the date shown</small><input name="dateLabel" value="${esc(a.dateLabel)}" placeholder="e.g. The Long Winter"></label>
          <a class="small" href="#/w/${wid}/calendar/edit">${icon('calendar-blank')} Calendar settings</a>
        </div>
        <div class="panel">
          <div class="field-label">Relationships</div>
          <div id="rels"></div>
          <button type="button" class="btn small" id="addRel">${icon('plus')} Add relationship</button>
        </div>
        <div class="panel">
          <div class="field-label">Infobox</div>
          <div id="fields"></div>
          <button type="button" class="btn small" id="addField">${icon('plus')} Add field</button>
        </div>
        <div class="panel">
          <label>Tags <small>comma separated</small><input name="tags" value="${esc(a.tags.join(', '))}" placeholder="noble, ancient, war"></label>
        </div>
      </aside>
    </div>
  </form>`;

  const f = $('#ed');
  hydrateImages();
  const markDirty = () => { dirty = true; };
  f.addEventListener('input', markDirty);
  f.addEventListener('change', markDirty);
  f.title.addEventListener('input', () => { $('.page-head h1', f).textContent = f.title.value || 'Untitled'; });

  // Dates
  const readDate = (p) => {
    const y = f[p].value.trim();
    if (y === '' || isNaN(+y)) return null;
    const m = f[p + 'M'].value === '' ? null : +f[p + 'M'].value;
    const dRaw = f[p + 'D'].value.trim();
    const d = m == null || dRaw === '' || isNaN(+dRaw) ? null : Math.max(1, Math.min(Math.round(+dRaw), cal.months[m]?.days ?? Infinity));
    return { y: Math.round(+y), m, d };
  };
  const preview = () => {
    const s = readDate('start'), e = readDate('end');
    $('#datePreview').textContent = f.dateLabel.value.trim() || (s ? formatDate(cal, s) + (e ? ' – ' + formatDate(cal, e) : '') : '');
  };
  ['start', 'startM', 'startD', 'end', 'endM', 'endD', 'dateLabel'].forEach((n) => f[n].addEventListener('input', preview));
  ['startM', 'endM'].forEach((n) => f[n].addEventListener('change', preview));
  preview();

  // Relationships
  const relsEl = $('#rels');
  const relTypeOptions = (sel) => Object.entries(REL_GROUPS).map(([g, gl]) =>
    `<optgroup label="${gl}">${Object.entries(REL_TYPES).filter(([, t]) => t.group === g)
      .map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t.label}</option>`).join('')}</optgroup>`).join('');
  // from: the article a relationship is stored on, when it was added there.
  const addRel = (r = { id: uid(), type: 'ally', target: '', note: '' }, from = null) => {
    const row = document.createElement('div');
    row.className = 'rel-row';
    row.dataset.id = r.id;
    if (from) row.dataset.from = from;
    row.innerHTML = `<div class="top"><select class="rt" aria-label="Relationship">${relTypeOptions(r.type)}</select>
        <button type="button" class="icon-btn" title="Remove">${icon('x')}</button></div>
      <select class="rtarget" aria-label="Related article">${articleOptions(wid, r.target, { exclude: new Set([a.id]), none: 'Choose an article' })}${r.target && !store.article(r.target) ? `<option value="${esc(r.target)}" selected>(deleted article)</option>` : ''}</select>
      <input class="rnote" placeholder="Note (optional)" value="${esc(r.note || '')}">
      ${from ? `<small class="muted rel-from">Added on ${esc(store.article(from)?.title || 'another article')}</small>` : ''}`;
    row.querySelector('button').onclick = () => { row.remove(); dirty = true; };
    relsEl.appendChild(row);
    return row;
  };
  a.relations.forEach((r) => addRel(r));
  // Relationships added on other articles that point here, shown from this
  // side. Changing or removing one here updates the article it's stored on.
  const own = new Set(a.relations.map((r) => r.type + r.target));
  const incoming = isNew ? [] : store.articlesOf(wid).filter((o) => o.id !== a.id)
    .flatMap((o) => (o.relations || []).filter((r) => r.target === a.id && REL_TYPES[r.type]).map((rel) => ({ from: o.id, rel })))
    .filter(({ from, rel }) => !own.has(REL_TYPES[rel.type].inverse + from));
  incoming.forEach(({ from, rel }) => addRel({ id: rel.id, type: REL_TYPES[rel.type].inverse, target: from, note: rel.note }, from));
  $('#addRel').onclick = () => addRel().querySelector('.rtarget').focus();

  // Infobox fields, grouped by the template's sections; extra fields go under "Other".
  const fieldsEl = $('#fields');
  const customRow = (k = '', v = '') => `<div class="kv"><input class="k" placeholder="Field" value="${esc(k)}"><input class="v" placeholder="Value" value="${esc(v)}"><button type="button" class="icon-btn" title="Remove" data-rm>${icon('x')}</button></div>`;
  const readFields = () => $$('.kv', fieldsEl).map((row) => [row.querySelector('.k').value.trim(), row.querySelector('.v').value]).filter(([k]) => k);
  function drawFields(values, type) {
    const t = TYPES[type] || TYPES.article;
    const map = new Map(values);
    const inTemplate = new Set(t.fields);
    let html = '';
    for (const sec of t.sections) {
      html += `<div class="kv-sec">${esc(sec.name)}</div>`;
      for (const k of sec.fields) {
        html += `<div class="kv tpl"><input class="k" type="hidden" value="${esc(k)}"><label class="k-lab" for="fv-${esc(k)}">${esc(k)}</label><input class="v" id="fv-${esc(k)}" value="${esc(map.get(k) ?? '')}"></div>`;
      }
    }
    const extra = values.filter(([k]) => !inTemplate.has(k));
    html += `<div class="kv-sec" id="otherSec" ${extra.length || !t.sections.length ? '' : 'hidden'}>${t.sections.length ? 'Other' : 'Fields'}</div>`;
    html += extra.map(([k, v]) => customRow(k, v)).join('');
    fieldsEl.innerHTML = html;
  }
  fieldsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { rm.closest('.kv').remove(); dirty = true; }
  });
  drawFields(Object.entries(a.fields), a.type);
  $('#addField').onclick = () => {
    $('#otherSec').hidden = false;
    fieldsEl.insertAdjacentHTML('beforeend', customRow());
    $$('.kv .k', fieldsEl).at(-1).focus();
  };
  const tplHint = () => { $('#tplHint').textContent = TYPES[f.type.value]?.hint || ''; };
  tplHint();
  f.type.onchange = () => {
    const next = new Set(TYPES[f.type.value].fields);
    // Keep anything filled in, plus fields of the new template; drop empty leftovers.
    drawFields(readFields().filter(([k, v]) => v.trim() || next.has(k)), f.type.value);
    tplHint();
    drawGuide();
  };

  // Writing guide: questions for this template; choosing one adds its heading to the article.
  const guide = $('#guide');
  function drawGuide() {
    if (!guide) return;
    const items = guidanceFor(f.type.value);
    const have = headingsIn(f.body.value);
    const done = items.filter((g) => have.has(g.h.toLowerCase())).length;
    $('summary', guide).innerHTML = `${icon('compass')} Writing guide <span class="muted">· ${esc(TYPES[f.type.value]?.label || 'Article')} · ${done} of ${items.length} covered</span>`;
    $('.guide-list', guide).innerHTML = items.map((g, i) => `
      <li class="${have.has(g.h.toLowerCase()) ? 'done' : ''}"><button type="button" data-g="${i}">
        <span class="g-mark">${have.has(g.h.toLowerCase()) ? icon('check') : icon('plus')}</span>
        <span><b>${esc(g.h)}</b><span class="g-q">${esc(g.q)}</span></span>
      </button></li>`).join('');
  }
  if (guide) {
    try { guide.open = localStorage.getItem('wa.guideOpen') !== '0' && (isNew || !a.body); } catch { guide.open = isNew; }
    guide.addEventListener('toggle', () => { try { localStorage.setItem('wa.guideOpen', guide.open ? '1' : '0'); } catch { /* ignore */ } });
    $('.guide-list', guide).onclick = async (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      const g = guidanceFor(f.type.value)[+b.dataset.g];
      const body = f.body;
      if (mode === 'preview') await setMode(lastEditMode);
      const re = new RegExp('^#{1,4}\\s+' + g.h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'im');
      const m = body.value.match(re);
      let pos;
      if (m) pos = m.index + m[0].length;
      else {
        const sepr = body.value.trim() ? (body.value.endsWith('\n\n') ? '' : body.value.endsWith('\n') ? '\n' : '\n\n') : '';
        body.value += `${sepr}## ${g.h}\n`;
        pos = body.value.length;
        body.dispatchEvent(new Event('input', { bubbles: true }));
      }
      body.focus();
      body.setSelectionRange(pos, pos);
      if (mode === 'live') { live.setValue(body.value, pos, pos); live.focus(); return; }
      const lineH = parseFloat(getComputedStyle(body).lineHeight) || 26;
      body.scrollTop = Math.max(0, body.value.slice(0, pos).split('\n').length * lineH - body.clientHeight / 2);
    };
    f.body.addEventListener('input', drawGuide);
    drawGuide();
  }

  // Image
  const thumb = $('.image-field .thumb:not(.banner-thumb)', f);
  const iFocus = wireFocus(thumb, { get: () => a.imagePos, set: (v) => { a.imagePos = v; dirty = true; }, ratio: 1 });
  const bThumb = $('.banner-thumb', f);
  $$('.image-field', f).forEach((z) => wireDropzone(z));
  // The header image's preview has the shape the article's header has on this
  // screen: as wide as the page, clamp(220px, 38vw, 420px) tall (css/features.css).
  const heroRatio = () => (f.clientWidth || 1000) / Math.min(420, Math.max(220, innerWidth * 0.38));
  const bFocus = wireFocus(bThumb, { get: () => a.bannerPos, set: (v) => { a.bannerPos = v; dirty = true; }, ratio: heroRatio, fallback: BANNER_POS });
  // Portrait and header image. Either can reuse the other's picture (the same
  // stored image, so nothing is imported twice).
  const pics = {
    image: { thumb, hint: '#imgHint', rm: '#imgRm', focus: iFocus, max: undefined },
    banner: { thumb: bThumb, hint: '#bannerHint', rm: '#bannerRm', focus: bFocus, max: 2400 },
  };
  const syncShare = () => {
    $('#bannerFromPortrait').hidden = !a.image || a.banner === a.image;
    $('#portraitFromBanner').hidden = !a.banner || a.image === a.banner;
  };
  const setPic = async (key, id) => {
    const p = pics[key];
    a[key] = id;
    a[key + 'Pos'] = null;
    if (id) p.thumb.src = await store.imageURL(id);
    p.thumb.hidden = $(p.hint).hidden = $(p.rm).hidden = !id;
    p.focus.refresh();
    syncShare();
    dirty = true;
  };
  for (const [key, input] of [['image', '#imgFile'], ['banner', '#bannerFile']]) {
    $(input).onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await setPic(key, await store.addImage(await prepareImage(file, pics[key].max)));
    };
    $(pics[key].rm).onclick = () => setPic(key, null);
  }
  $('#bannerFromPortrait').onclick = () => setPic('banner', a.image);
  $('#portraitFromBanner').onclick = () => setPic('image', a.banner);
  syncShare();

  // Markdown helpers
  const body = f.body;
  $$('[data-md]').forEach((b) => { b.onclick = () => mdCommand(body, b.dataset.md); });
  // Script menu: handwriting and the world's fonts, each shown in itself.
  const menu = $('#scriptMenu');
  $('#scriptBtn').onclick = (e) => {
    e.stopPropagation();
    menu.innerHTML = scriptsFor(wid).map((sc) => `<button type="button" data-script="${esc(sc.name)}"><span style="font-family:${esc(sc.family)}">${esc(sc.label)}</span><small>${esc(sc.name)}</small></button>`).join('')
      + '<p class="small muted">Add fonts for runes in World settings.</p>';
    menu.hidden = !menu.hidden;
  };
  menu.onclick = (e) => {
    const b = e.target.closest('[data-script]');
    if (!b) return;
    menu.hidden = true;
    scriptCommand(body, b.dataset.script);
  };
  f.addEventListener('click', (e) => { if (!e.target.closest('.md-script')) menu.hidden = true; });

  // Editing views. Live shows formatting as you type (CodeMirror, loaded on
  // first use); Markdown is the plain textarea; Preview is read-only. The
  // textarea always holds the text: saving, the toolbar, the Script menu and
  // the writing guide all work on it, and Live is kept in step with it.
  let mode = 'markdown', lastEditMode = 'markdown', live = null, fromLive = false;
  const liveBox = $('#liveBody'), pv = $('.md-preview', f);
  const startLive = async () => {
    const { createLiveEditor } = await import('../../vendor/live-editor.js');
    live = createLiveEditor(liveBox, {
      doc: body.value,
      label: 'Article content',
      titles: () => store.articlesOf(wid).filter((x) => x.id !== a.id).map((x) => x.title),
      isKnown: (t) => { const [title, sec] = t.split('#'); const x = store.byTitle(wid, title.trim()); return !!x && (sec == null || headingsOf(x.body).some((h) => h.toLowerCase() === sec.trim().toLowerCase())); },
      headings: (t) => headingsOf(store.byTitle(wid, t)?.body),
      fontFor: (n) => familyFor(n, wid),
      isHand: (n) => !!HANDS[n.toLowerCase()],
      onUpdate: (u) => {
        if (u.docChanged) {
          fromLive = true;
          body.value = live.getValue();
          body.dispatchEvent(new Event('input', { bubbles: true }));
          fromLive = false;
        }
        const s = live.getSelection();
        body.setSelectionRange(s.from, s.to);
      },
    });
  };
  // A toolbar or guide change to the textarea is copied into Live.
  body.addEventListener('input', () => {
    if (mode !== 'live' || fromLive || !live) return;
    live.setValue(body.value, body.selectionStart, body.selectionEnd);
    live.focus();
  });
  const setMode = async (m) => {
    if (m === 'live' && !live) {
      try { await startLive(); } catch (err) { console.error(err); toast('Live editing couldn’t load; using Markdown'); m = 'markdown'; }
    }
    if (m === 'live') live.setValue(body.value, body.selectionStart, body.selectionEnd);
    mode = m;
    if (m !== 'preview') { lastEditMode = m; try { localStorage.setItem('wa.editMode', m); } catch { /* private mode */ } }
    body.hidden = m !== 'markdown';
    liveBox.hidden = m !== 'live';
    pv.hidden = m !== 'preview';
    if (m === 'preview') pv.innerHTML = render(body.value, wid);
    $$('.md-mode [data-mode]', f).forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $$('[data-md], #scriptBtn', f).forEach((b) => { b.disabled = m === 'preview'; });
  };
  $('.md-mode', f).onclick = (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
  let saved = 'live';
  try { saved = localStorage.getItem('wa.editMode') || 'live'; } catch { /* default */ }
  setMode(saved === 'markdown' ? 'markdown' : 'live');
  $$('.ac-target', f).forEach((ta) => attachAutocomplete(ta, wid));

  $('#del')?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete “${a.title}”? You can restore it from Recently deleted.`))) return;
    await store.deleteArticle(a.id);
    state.guard = null;
    location.hash = `#/w/${wid}`;
  });

  f.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); f.requestSubmit(); } });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const title = f.title.value.trim().replace(/[[\]|]/g, '');
    if (!title) return toast('Give it a title');
    const clash = store.byTitle(wid, title);
    if (clash && clash.id !== a.id) return toast(`Another article is already called “${title}”`);
    const fields = {};
    for (const [k, v] of readFields()) fields[k] = v;
    const seen = new Set();
    const relations = [];
    const onSource = new Map(); // incoming relationship id → note, for those left where they are
    for (const row of $$('.rel-row', relsEl)) {
      const r = { id: row.dataset.id, type: row.querySelector('.rt').value, target: row.querySelector('.rtarget').value, note: row.querySelector('.rnote').value.trim() };
      if (!r.target || seen.has(r.type + r.target)) continue;
      seen.add(r.type + r.target);
      const inc = row.dataset.from && incoming.find((i) => i.rel.id === r.id && i.from === row.dataset.from);
      // Unchanged apart from its note: it stays on the other article.
      if (inc && r.target === inc.from && r.type === REL_TYPES[inc.rel.type].inverse) { onSource.set(r.id, r.note); continue; }
      relations.push(inc ? { ...r, id: uid() } : r); // changed: now stored here
    }
    const s = readDate('start');
    const en = s ? readDate('end') : null;
    Object.assign(a, {
      title, type: f.type.value, parentId: f.parentId.value || null,
      summary: f.summary.value, body: f.body.value, gmNotes: f.gmNotes.value,
      tags: [...new Set(f.tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))],
      fields, relations,
      start: s?.y ?? null, startM: s?.m ?? null, startD: s?.d ?? null,
      end: en?.y ?? null, endM: en?.m ?? null, endD: en?.d ?? null,
      dateLabel: f.dateLabel.value.trim(),
      mapId: f.mapId ? f.mapId.value || null : a.mapId || null,
    });
    // Changed on another device while this was open: keep both versions.
    const cur = !isNew && store.article(a.id);
    if (cur && cur.updatedAt !== baseAt) {
      const theirs = JSON.stringify(store.contentOf(cur));
      delete a.conflict;
      if (cur.conflict) a.conflict = cur.conflict;
      else if (theirs !== baseContent && theirs !== JSON.stringify(store.contentOf(a))) {
        a.conflict = { theirs: store.contentOf(cur), theirsAt: cur.updatedAt, at: Date.now() };
      }
    }
    await store.save('articles', a);
    // Update the other articles whose relationships were removed, moved here or re-noted.
    for (const from of new Set(incoming.map((i) => i.from))) {
      const src = store.article(from);
      if (!src) continue;
      const next = (src.relations || []).flatMap((r) => {
        if (r.target !== a.id || !incoming.some((i) => i.rel.id === r.id)) return [r];
        if (!onSource.has(r.id)) return [];
        return [{ ...r, note: onSource.get(r.id) }];
      });
      if (JSON.stringify(next) !== JSON.stringify(src.relations || [])) await store.save('articles', { ...src, relations: next });
    }
    if (a.conflict && !cur?.conflict && cur) toast('This article also changed on another device. Both versions are kept for you to resolve.', 7000);
    if (prompt) await recordAnswer(wid, prompt.key, a.id);
    if (!isNew && oldTitle && oldTitle.trim().toLowerCase() !== title.toLowerCase()) {
      await store.renameReferences(wid, oldTitle, title);
    }
    dirty = false;
    state.guard = null;
    toast('Saved');
    location.hash = `#/w/${wid}/a/${a.id}`;
  };
}

// Selected words on one line become {{Name|words}}; anything else becomes a
// :::Name block on its own lines.
function scriptCommand(ta, name) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e);
  let insert, cs, ce;
  if (sel && !sel.includes('\n')) {
    insert = `{{${name}|${sel}}}`;
    cs = s + name.length + 3; ce = cs + sel.length;
  } else {
    const before = s && v[s - 1] !== '\n' ? '\n\n' : (s && v[s - 2] !== '\n' ? '\n' : '');
    const inner = sel || 'Written text';
    insert = `${before}:::${name}\n${inner}\n:::\n`;
    cs = s + before.length + name.length + 4; ce = cs + inner.length;
  }
  ta.value = v.slice(0, s) + insert + v.slice(e);
  ta.focus();
  ta.setSelectionRange(cs, ce);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function mdCommand(ta, cmd) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e);
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;
  let text, cs, ce;
  const wrap = (l, r, ph) => { const inner = sel || ph; text = v.slice(0, s) + l + inner + r + v.slice(e); cs = s + l.length; ce = cs + inner.length; };
  const prefix = (p) => { text = v.slice(0, lineStart) + p + v.slice(lineStart); cs = s + p.length; ce = e + p.length; };
  switch (cmd) {
    case 'bold': wrap('**', '**', 'bold text'); break;
    case 'italic': wrap('*', '*', 'italic text'); break;
    case 'link': wrap('[[', ']]', 'Article title'); break;
    case 'h2': prefix('## '); break;
    case 'h3': prefix('### '); break;
    case 'ul': prefix('- '); break;
    case 'quote': prefix('> '); break;
    case 'hr': text = v.slice(0, s) + '\n\n---\n\n' + v.slice(e); cs = ce = s + 7; break;
  }
  ta.value = text;
  ta.focus();
  ta.setSelectionRange(cs, ce);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// Suggest article titles while typing inside [[ … ]].
function attachAutocomplete(ta, wid) {
  const wrap = document.createElement('div');
  wrap.className = 'ac-wrap';
  ta.parentNode.insertBefore(wrap, ta);
  wrap.appendChild(ta);
  const pop = document.createElement('ul');
  pop.className = 'ac-pop';
  pop.hidden = true;
  wrap.appendChild(pop);
  let items = [], idx = 0, startPos = 0;

  const close = () => { pop.hidden = true; items = []; };
  const choose = (title) => {
    const caret = ta.selectionStart;
    const after = ta.value.slice(caret);
    const closing = after.startsWith(']]') ? '' : ']]';
    ta.value = ta.value.slice(0, startPos) + title + closing + after;
    const pos = startPos + title.length + 2;
    ta.setSelectionRange(pos, pos);
    ta.focus();
    close();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const update = () => {
    if (ta.hidden) return close(); // Live mode has its own suggestions
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/\[\[([^\]|#\n]*)$/);
    if (!m) return close();
    startPos = ta.selectionStart - m[1].length;
    const q = m[1].toLowerCase();
    const titles = store.articlesOf(wid).map((x) => x.title);
    items = titles.filter((t) => t.toLowerCase().includes(q))
      .sort((x, y) => (y.toLowerCase().startsWith(q) - x.toLowerCase().startsWith(q)) || x.localeCompare(y)).slice(0, 8);
    if (m[1].trim() && !titles.some((t) => t.toLowerCase() === q.trim())) items.push(m[1].trim());
    if (!items.length) return close();
    idx = 0;
    draw();
  };
  const draw = () => {
    pop.hidden = false;
    pop.innerHTML = items.map((t, i) => {
      const exists = store.byTitle(wid, t);
      return `<li class="${i === idx ? 'on' : ''}" data-i="${i}">${exists ? `${typeIcon(exists.type)} ${esc(t)}` : `${icon('plus')} New article: ${esc(t)}`}</li>`;
    }).join('');
  };
  ta.addEventListener('input', update);
  ta.addEventListener('click', update);
  ta.addEventListener('blur', () => setTimeout(close, 150));
  ta.addEventListener('keydown', (e) => {
    if (pop.hidden) return;
    if (e.key === 'ArrowDown') { idx = (idx + 1) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + items.length) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { choose(items[idx]); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.preventDefault(); }
  });
  pop.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
  });
}
