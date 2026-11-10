// What's new in a waiting update: the changelog's sections for versions newer
// than the one running, read fresh from the server (CHANGELOG.md).
import { esc, modal } from './util.js';
import { icon } from './icons.js';

const newer = (a, b) => {
  const x = a.split(/[.-]/).map(Number), y = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// { latest, html } for the versions newer than this one, or null (offline, or nothing newer).
export async function whatsNew() {
  try {
    const text = await (await fetch(`CHANGELOG.md?check=${Date.now()}`, { cache: 'no-store' })).text();
    const parts = text.split(/^## /m).slice(1).filter((p) => { const v = p.match(/^(\d+\.\d+\.\d+)/)?.[1]; return v && newer(v, self.WA_VERSION); });
    if (!parts.length) return null;
    // Version headings become subheadings; the changelog's own ### become smaller still.
    const md = parts.map((p) => '### ' + p.replace(/^### /gm, '#### ')).join('\n');
    const latest = parts[0].match(/^(\d+\.\d+\.\d+)/)[1];
    return { latest, notes: DOMPurify.sanitize(marked.parse(md)) };
  } catch { return null; }
}
// A collapsible "What's new" section.
const notesSection = (n, open) => `<details class="upd-details"${open ? ' open' : ''}><summary>${icon('sparkle')} What’s new in ${esc(n.latest)}</summary><div class="prose no-dropcap upd-notes">${n.notes}</div></details>`;
export const whatsNewHTML = async (open = false) => { const n = await whatsNew(); return n ? notesSection(n, open) : ''; };

// Shown once per version when it arrives (not mid-edit): what's new, Update now or Later.
export async function offerUpdate(apply) {
  const notes = await whatsNew();
  let seen = null;
  try { seen = localStorage.getItem('wa.updOffered'); } catch { /* storage blocked */ }
  const key = notes?.latest || 'unknown';
  if (seen === key || document.querySelector('#modal-root > *')) return;
  try { localStorage.setItem('wa.updOffered', key); } catch { /* storage blocked */ }
  modal('Update ready', `<div class="upd-offer">
      <p>WorldAtlas <b>${esc(notes?.latest || 'a new version')}</b> is ready. You’re on ${esc(self.WA_VERSION)}.</p>
      ${notes ? notesSection(notes, true) : '<p class="muted">Your worlds stay as they are; the app reloads with the new version.</p>'}
      <div class="actions"><button type="button" class="btn quiet" data-later>Later</button>
        <button type="button" class="btn primary" data-now>${icon('download-simple')} Update now</button></div>
      <p class="muted small">Later keeps the ! on Settings &amp; sync; update from there when you’re ready.</p></div>`, {
    onMount: (m, close) => {
      m.querySelector('[data-later]').onclick = () => close();
      m.querySelector('[data-now]').onclick = () => { close(); apply(); };
    },
  });
}
