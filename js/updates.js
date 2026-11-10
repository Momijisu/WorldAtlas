// What's new in a waiting update (Settings → About this app): the changelog's
// sections for versions newer than the one running, read fresh from CHANGELOG.md.
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
