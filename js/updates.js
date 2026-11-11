// What's new (Settings → About this app): while an update waits, the changelog's
// sections for versions newer than the one running; otherwise this version's own
// notes, to read after updating. Read fresh from CHANGELOG.md.
import { esc } from './util.js';
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
    const all = text.split(/^## /m).slice(1);
    const ver = (p) => p.match(/^(\d+\.\d+\.\d+)/)?.[1];
    let parts = all.filter((p) => ver(p) && newer(ver(p), self.WA_VERSION));
    const current = !parts.length;
    if (current) parts = all.filter((p) => ver(p) === self.WA_VERSION);
    if (!parts.length) return null;
    // Version headings become subheadings; the changelog's own ### become smaller still.
    const md = parts.map((p) => '### ' + p.replace(/^### /gm, '#### ')).join('\n');
    const latest = parts[0].match(/^(\d+\.\d+\.\d+)/)[1];
    return { latest, current, notes: DOMPurify.sanitize(marked.parse(md)) };
  } catch { return null; }
}
// A collapsible "What's new" section.
const notesSection = (n, open) => `<details class="upd-details"${open ? ' open' : ''}><summary>${icon('sparkle')} What’s new in ${esc(n.latest)}${n.current ? ' <span class="muted">(this version)</span>' : ''}</summary><div class="prose no-dropcap upd-notes">${n.notes}</div></details>`;
export const whatsNewHTML = async (open = false) => { const n = await whatsNew(); return n ? notesSection(n, open) : ''; };
