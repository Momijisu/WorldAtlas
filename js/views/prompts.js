// Writing prompts: a drawn prompt, the full library with filters, and custom prompts.
import * as store from '../store.js';
import { TYPES } from '../store.js';
import { CATEGORIES, allPrompts, pickPrompt, updatePromptState } from '../prompts.js';
import { $, esc, uid, modal, toast } from '../util.js';
import { view, setTitle, pageHead, icon, worldCrumb, sep } from '../ui.js';

const catLabel = (c) => CATEGORIES[c]?.label || 'Your prompts';
const catIcon = (c) => CATEGORIES[c]?.icon || 'feather';

export const answerHref = (wid, p) => `#/w/${wid}/new/${TYPES[p.type] ? p.type : 'article'}?prompt=${encodeURIComponent(p.key)}`;
export const addToHref = (wid, p) => `#/w/${wid}/a/${p.about.id}/edit?prompt=${encodeURIComponent(p.key)}`;

// The large prompt card (used here and on the world overview).
export function promptCard(wid, p, { eyebrow = 'A prompt for you', draw = true } = {}) {
  if (!p) {
    return `<div class="prompt-card empty"><div class="eyebrow">${icon('feather')} ${esc(eyebrow)}</div>
      <p class="prompt-text">You’ve answered or set aside every prompt. <a href="#/w/${wid}/prompts">Add your own</a>.</p></div>`;
  }
  return `<div class="prompt-card" data-key="${esc(p.key)}">
    <div class="eyebrow">${icon('feather')} ${esc(eyebrow)} <span class="sep">/</span> ${esc(catLabel(p.cat))}</div>
    <p class="prompt-text">${esc(p.text)}</p>
    <div class="actions left">
      <a class="btn primary" href="${answerHref(wid, p)}">${icon('pencil-simple')} New ${esc((TYPES[p.type] || TYPES.article).label.toLowerCase())} article</a>
      ${p.about ? `<a class="btn" href="${addToHref(wid, p)}">${icon('plus')} Add to ${esc(p.about.title)}</a>` : ''}
      ${draw ? `<button class="btn quiet" data-draw>${icon('arrows-clockwise')} Another</button>` : ''}
      <button class="btn quiet" data-dismiss title="Hide this prompt">${icon('eye-slash')} Not for me</button>
    </div>
  </div>`;
}

// Wire up Another / Not-for-me buttons inside a container holding a promptCard.
export function wirePromptCard(wid, root, { onChange }) {
  const card = $('.prompt-card', root);
  if (!card?.dataset.key) return;
  $('[data-draw]', card)?.addEventListener('click', () => onChange(pickPrompt(wid, { exclude: [card.dataset.key] })));
  $('[data-dismiss]', card)?.addEventListener('click', async () => {
    const key = card.dataset.key;
    await updatePromptState(wid, (st) => { if (!st.dismissed.includes(key)) st.dismissed.push(key); });
    toast('Prompt set aside');
    onChange(pickPrompt(wid, { exclude: [key] }));
  });
}

export function viewPrompts(wid) {
  setTitle('Writing prompts');
  const PAGE = 25;
  const f = { cat: '', status: 'open', limit: PAGE };
  view.innerHTML = `<section class="page">
    ${pageHead({
      eyebrow: `${worldCrumb(wid)} ${sep} Inspiration`,
      title: 'Writing prompts',
      actions: `<button class="btn" id="addPrompt">${icon('plus')} Add your own</button>`,
    })}
    <div id="drawn"></div>
    <div class="section-head"><h2>The library</h2><span class="muted small" id="tally"></span></div>
    <div class="toolbar">
      <div class="seg" id="status"><button data-s="open">Open</button><button data-s="answered">Answered</button><button data-s="dismissed">Set aside</button></div>
    </div>
    <div class="chips" id="cats"></div>
    <div id="plist"></div>
  </section>`;

  const showDrawn = (p) => {
    $('#drawn').innerHTML = promptCard(wid, p, { eyebrow: 'Drawn for you' });
    wirePromptCard(wid, $('#drawn'), { onChange: (np) => { showDrawn(np); drawList(); } });
  };

  function drawList() {
    const all = allPrompts(wid);
    const cats = [...new Set(all.map((p) => p.cat))];
    $('#cats').innerHTML = `<button class="chip ${f.cat ? '' : 'on'}" data-c="">All</button>` +
      cats.map((c) => `<button class="chip ${f.cat === c ? 'on' : ''}" data-c="${c}">${icon(catIcon(c))} ${esc(catLabel(c))}</button>`).join('');
    for (const b of $('#status').children) b.classList.toggle('on', b.dataset.s === f.status);
    const answered = all.filter((p) => p.answers.length).length;
    $('#tally').textContent = `${answered} of ${all.length} answered`;
    const list = all.filter((p) => (!f.cat || p.cat === f.cat) && (
      f.status === 'answered' ? p.answers.length : f.status === 'dismissed' ? p.dismissed && !p.answers.length : !p.answers.length && !p.dismissed));
    $('#plist').innerHTML = list.length ? `<ul class="prompt-list">${list.slice(0, f.limit).map((p) => `
      <li data-key="${esc(p.key)}">
        <span class="pl-icon">${icon(catIcon(p.cat))}</span>
        <div class="pl-body">
          <p class="pl-text">${esc(p.text)}</p>
          ${p.answers.length ? `<div class="pl-answers">Answered in ${p.answers.map((a) => `<a href="#/w/${wid}/a/${a.id}">${esc(a.title)}</a>`).join(', ')}</div>` : ''}
        </div>
        <div class="pl-actions">
          ${f.status === 'dismissed' ? `<button class="btn small" data-restore>Restore</button>` : `
            <a class="btn small" href="${answerHref(wid, p)}" title="Write a new article for this prompt">${icon('pencil-simple')}<span class="hide-sm">Write</span></a>
            ${p.about ? `<a class="btn small quiet" href="${addToHref(wid, p)}" title="Add to ${esc(p.about.title)}">${icon('plus')}<span class="hide-sm">Add to article</span></a>` : ''}
            ${!p.answers.length ? `<button class="icon-btn" data-dismiss title="Set aside">${icon('eye-slash')}</button>` : ''}`}
          ${p.custom ? `<button class="icon-btn" data-delete title="Delete your prompt">${icon('trash')}</button>` : ''}
        </div>
      </li>`).join('')}</ul>
      ${list.length > f.limit ? `<p class="center"><button class="btn" data-more>Show more <span class="muted">(${list.length - f.limit} left)</span></button></p>` : ''}`
      : `<div class="empty-state small"><p>${f.status === 'answered' ? 'None answered yet.' : f.status === 'dismissed' ? 'Nothing set aside.' : 'All answered or set aside.'}</p></div>`;
  }

  $('#cats').onclick = (e) => { const c = e.target.closest('.chip'); if (c) { f.cat = c.dataset.c; f.limit = PAGE; drawList(); } };
  $('#status').onclick = (e) => { const b = e.target.closest('button'); if (b) { f.status = b.dataset.s; f.limit = PAGE; drawList(); } };
  $('#plist').onclick = async (e) => {
    if (e.target.closest('[data-more]')) { f.limit += PAGE; drawList(); return; }
    const li = e.target.closest('li');
    if (!li) return;
    const key = li.dataset.key;
    if (e.target.closest('[data-dismiss]')) await updatePromptState(wid, (st) => { if (!st.dismissed.includes(key)) st.dismissed.push(key); });
    else if (e.target.closest('[data-restore]')) await updatePromptState(wid, (st) => { st.dismissed = st.dismissed.filter((k) => k !== key); });
    else if (e.target.closest('[data-delete]')) await updatePromptState(wid, (st) => { st.custom = st.custom.filter((c) => `c:${c.id}` !== key); });
    else return;
    drawList();
  };
  $('#addPrompt').onclick = () => customPromptDialog(wid, () => { f.status = 'open'; f.cat = ''; drawList(); });

  showDrawn(pickPrompt(wid));
  drawList();
}

function customPromptDialog(wid, done) {
  modal('Add a prompt', `<form class="form" id="cpf">
      <label>Prompt<textarea name="text" rows="3" required placeholder="e.g. What song do sailors sing when a storm is coming?"></textarea></label>
      <div class="row">
        <label>Category<select name="cat"><option value="custom">Your prompts</option>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('')}</select></label>
        <label>Answer as<select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === 'article' ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
      </div>
      <div class="actions"><button class="btn primary">Add prompt</button></div>
    </form>`, {
    onMount: (el, close) => {
      $('#cpf', el).onsubmit = async (e) => {
        e.preventDefault();
        const t = e.target;
        await updatePromptState(wid, (st) => { st.custom.push({ id: uid(), text: t.text.value.trim(), cat: t.cat.value, type: t.type.value }); });
        close();
        done();
      };
    },
  });
}
