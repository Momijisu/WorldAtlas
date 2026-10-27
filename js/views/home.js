// Library (all worlds), world overview, world settings and the "new article" picker.
import * as store from '../store.js';
import * as sync from '../sync.js';
import * as auth from '../auth.js';
import { TYPES, GROUPS } from '../store.js';
import { render, plain } from '../markdown.js';
import { exampleWorld } from '../example.js';
import { $, $$, esc, uid, modal, confirmDialog, prepareImage } from '../util.js';
import { view, state, setTitle, hydrateImages, articleRows, pageHead, icon, flourish } from '../ui.js';
import { todaysPrompt, promptsEnabled } from '../prompts.js';
import { pickerHTML, wirePicker, applyBackground } from '../backgrounds.js';
import { promptCard, wirePromptCard } from './prompts.js';

export function viewWorlds() {
  setTitle('');
  const ws = store.worlds();
  const signedOut = sync.getStatus().state === 'off';
  view.innerHTML = `<section class="page">
    ${ws.length ? `
      ${pageHead({ title: 'Your worlds', actions: `${ws.some((w) => store.isDemo(w.id)) ? '' : `<button class="btn quiet" id="openExample">${icon('book-open-text')} Open example</button>`}<button class="btn primary" id="newWorld">${icon('plus')} New world</button>` })}
      <div class="cards">${ws.map((w) => `
        <a class="card world-card" href="#/w/${w.id}">
          <div class="card-cover" ${w.image ? `data-bg="${w.image}"` : ''}><span>${esc((w.name[0] || '?').toUpperCase())}</span></div>
          <div class="card-body">
            <div class="eyebrow">${store.isDemo(w.id) ? 'Example · ' : ''}${store.articlesOf(w.id).length} articles · ${store.mapsOf(w.id).length} maps</div>
            <h3>${esc(w.name)}</h3>
            <p>${esc(plain(w.description, 150))}</p>
          </div>
        </a>`).join('')}</div>` : `
      <div class="empty-state">
        <img class="empty-emblem" src="icons/icon.svg" alt="">
                <h2>Begin a new world</h2>
        <p>Write up its people and places, link them together, and map out its history.</p>
        <div class="actions center">
          <button class="btn primary" id="newWorld">${icon('plus')} Create a world</button>
          <button class="btn" id="example">${icon('book-open-text')} Try an example</button>
        </div>
        ${signedOut ? `<p class="muted small" style="margin-top:1.6rem">Using WorldAtlas on another device? <a href="#/settings">Connect OneDrive</a> to load your worlds.</p>` : ''}
      </div>`}
  </section>`;
  $('#newWorld').onclick = () => worldDialog();
  $('#openExample')?.addEventListener('click', async () => {
    location.hash = `#/w/${await exampleWorld(store, { demo: true })}`;
  });
  $('#example')?.addEventListener('click', async () => {
    const id = await exampleWorld(store, { demo: !auth.account() });
    location.hash = `#/w/${id}`;
  });
  hydrateImages();
}

export async function worldDialog(w) {
  const isNew = !w;
  w = w ? { ...w } : { id: uid(), name: '', description: '', image: null };
  await modal(isNew ? 'New world' : 'World settings', `
    <form class="form" id="wf">
      <label>Name<input name="name" required value="${esc(w.name)}" placeholder="e.g. Aerthal"></label>
      <label>Description <small>Markdown and [[links]]</small><textarea name="description" rows="5">${esc(w.description)}</textarea></label>
      <div class="field-label">Cover image</div>
      <div class="image-field">
        <img class="thumb" ${w.image ? `data-img="${w.image}"` : 'hidden'} alt="">
        <label class="btn small">${icon('image')} Choose image<input type="file" accept="image/*" hidden name="file"></label>
        <button type="button" class="btn small quiet" data-rm ${w.image ? '' : 'hidden'}>Remove</button>
      </div>
      <div class="field-label" style="margin-top:1rem">Background</div>
      ${pickerHTML(w.background, { allowDefault: true })}
      ${isNew ? '' : `<p class="small muted">Months, eras and moons: <a href="#/w/${w.id}/calendar/edit" data-cal>calendar settings</a>.</p>`}
      <div class="actions">
        ${isNew ? '' : `<button type="button" class="btn danger" data-del>${icon('trash')} Delete world</button><span class="spacer"></span>`}
        <button type="button" class="btn quiet" data-cancel>Cancel</button>
        <button class="btn primary">${isNew ? 'Create world' : 'Save'}</button>
      </div>
    </form>`, {
    onMount: (m, close) => {
      hydrateImages(m);
      const f = $('#wf', m);
      const thumb = $('.thumb', m);
      $('[data-cancel]', m).onclick = () => close();
      wirePicker(m, w.background, (bg) => { w.background = bg || undefined; if (!bg) delete w.background; }, prepareImage);
      $('[data-cal]', m)?.addEventListener('click', () => close());
      f.file.onchange = async () => {
        const file = f.file.files[0];
        if (!file) return;
        w.image = await store.addImage(await prepareImage(file, 2400));
        thumb.src = await store.imageURL(w.image); thumb.hidden = false; $('[data-rm]', m).hidden = false;
      };
      $('[data-rm]', m).onclick = (e) => { w.image = null; thumb.hidden = true; e.currentTarget.hidden = true; };
      $('[data-del]', m)?.addEventListener('click', async () => {
        if (store.isDemo(w.id)) {
          if (!(await confirmDialog('Remove the example world from this device?', 'Remove'))) return;
          await store.removeDemo(w.id);
          close();
          location.hash = '#/';
          return;
        }
        if (!(await confirmDialog(`Delete “${w.name}” and all its articles and maps? This also deletes it on your other devices.`))) return;
        await store.deleteWorld(w.id);
        close();
        location.hash = '#/';
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        Object.assign(w, { name: f.name.value.trim(), description: f.description.value });
        await store.save('worlds', w);
        close();
        if (isNew) location.hash = `#/w/${w.id}`; else state.route();
      };
    },
  });
  // The background picker previews live; put back whatever is now saved.
  applyBackground(state.wid);
}

export function viewWorld(wid) {
  const w = store.world(wid);
  setTitle(w.name);
  const arts = store.articlesOf(wid);
  const counts = {};
  for (const a of arts) counts[a.type] = (counts[a.type] || 0) + 1;
  const recent = [...arts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const cell = (href, ic, label, num) =>
    `<a class="index-cell" href="${href}">${icon(ic)}<span class="label">${label}</span><span class="num">${num}</span></a>`;
  view.innerHTML = `<section class="page">
    <div class="hero" ${w.image ? `data-bg="${w.image}"` : ''}>
      <div class="hero-inner">
        <div><h1>${esc(w.name)}</h1></div>
        <div class="actions">
          <button class="btn" id="editWorld">${icon('gear-six')} World settings</button>
          <button class="btn primary" id="newArt">${icon('plus')} New article</button>
        </div>
      </div>
    </div>
    ${store.isDemo(wid) ? `<div class="demo-banner">${icon('compass')}<div>
      <b>This is an example world.</b> Look around, open the map, try the timeline and family tree, and edit anything you like. It stays on this device and isn’t synced.
      <div class="actions left" style="margin-top:.7rem">
        <button class="btn small primary" id="newOwnWorld">${icon('plus')} Start my own world</button>
        <button class="btn small" id="keepDemo">Keep this as my own</button>
        <button class="btn small quiet" id="removeDemo">Remove example</button>
      </div></div></div>` : ''}
    ${w.description ? `<div class="prose world-desc">${render(w.description, wid)}</div>` : ''}
    <div id="todayPrompt" class="today-prompt"></div>
    ${flourish()}
    <div class="index-grid">
      ${Object.entries(TYPES).filter(([k]) => counts[k]).map(([k, t]) => cell(`#/w/${wid}/t/${k}`, t.icon, t.plural, counts[k])).join('')}
      ${cell(`#/w/${wid}/timeline`, 'hourglass-medium', 'Timeline', arts.filter((a) => a.start != null).length)}
      ${cell(`#/w/${wid}/calendar`, 'calendar-blank', 'Calendar', '')}
      ${cell(`#/w/${wid}/maps`, 'map-trifold', 'Maps', store.mapsOf(wid).length)}
      ${cell(`#/w/${wid}/graph`, 'graph', 'Relationships', '')}
    </div>
    <div class="section-head"><h2>Recently written</h2><a class="small" href="#/w/${wid}/t/all">All articles →</a></div>
    ${recent.length ? articleRows(recent, wid) : `<div class="empty-state small"><p>No articles yet. <a href="#" id="newArt2">Write the first one</a>.</p></div>`}
  </section>`;
  const showPrompt = (p, eyebrow = 'Today’s prompt') => {
    $('#todayPrompt').innerHTML = promptCard(wid, p, { eyebrow }) + `<a class="small more-prompts" href="#/w/${wid}/prompts">All writing prompts →</a>`;
    wirePromptCard(wid, $('#todayPrompt'), { onChange: (np) => showPrompt(np, 'Another prompt') });
  };
  if (promptsEnabled()) showPrompt(todaysPrompt(wid));
  $('#editWorld').onclick = () => worldDialog(w);
  $('#newOwnWorld')?.addEventListener('click', () => worldDialog());
  $('#keepDemo')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Keep Aerthal as a normal world? It will sync to OneDrive like your other worlds.', 'Keep it', { title: 'Keep the example', danger: false }))) return;
    await store.keepDemo(wid);
    state.route();
  });
  $('#removeDemo')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Remove the example world from this device? You can bring it back from the start screen.', 'Remove'))) return;
    await store.removeDemo(wid);
    location.hash = '#/';
  });
  $('#newArt').onclick = () => newArticleDialog(wid);
  $('#newArt2')?.addEventListener('click', (e) => { e.preventDefault(); newArticleDialog(wid); });
  hydrateImages();
}

// Template picker. `extra` is a query string added to the new-article link
// (e.g. "?parent=…"); `title` pre-fills the new article's title.
export function newArticleDialog(wid, extra = '', { title } = {}) {
  wid ||= localStorage.getItem('wa.lastWorld');
  if (!store.world(wid)) wid = store.worlds()[0]?.id;
  if (!wid) return worldDialog();
  if (title) extra += (extra ? '&' : '?') + 'title=' + encodeURIComponent(title);
  modal(title ? `Create “${title}”` : 'New article', `<p class="muted" style="margin-top:0">${title ? 'Pick a template to start from.' : 'Pick a template. You can change it later.'}</p>
    ${Object.entries(GROUPS).map(([g, gl]) => {
      const items = Object.entries(TYPES).filter(([, t]) => t.group === g);
      return `<div class="type-group">${esc(gl)}</div><div class="type-grid">${items.map(([k, t]) =>
        `<a class="type-choice" href="#/w/${wid}/new/${k}${extra}" data-go title="${esc(t.hint)}">${icon(t.icon)}<span><b>${t.label}</b><small>${esc(t.hint)}</small></span></a>`).join('')}</div>`;
    }).join('')}`,
  { onMount: (m, close) => $$('[data-go]', m).forEach((a) => a.addEventListener('click', () => close())) });
}
