// Image drop zones: an area that takes a file by dragging it in, pasting it
// (Ctrl/Cmd+V), clicking the area, or its Choose button. Whatever arrives is
// put into the zone's own <input type="file"> and a 'change' event fired, so
// the input's usual handler does the rest.
import { icon } from './icons.js';

// The empty state shown inside a zone until it has a picture.
export const dropzoneEmpty = (what = 'an image') => `<div class="dz-empty" aria-hidden="true">
    ${icon('upload-simple', 'dz-icon')}
    <span class="dz-pointer">Drop ${what} here, or paste it</span>
    <span class="dz-touch">Tap to choose ${what}</span>
  </div>`;

const imageFrom = (list) => [...(list || [])].find((f) => f.type.startsWith('image/'));

function deliver(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

let lastZone = null; // the zone most recently hovered or used, for pasting

export function wireDropzone(zone, input = zone.querySelector('input[type=file]')) {
  zone.classList.add('dropzone');
  if (!zone.matches('label, button')) zone.tabIndex = 0;
  zone.setAttribute('aria-label', 'Image: drop a file, paste, or press Enter to choose');
  const enter = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.addEventListener('dragenter', enter);
  zone.addEventListener('dragover', enter);
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = imageFrom(e.dataTransfer?.files);
    if (file) deliver(input, file);
  });
  zone.addEventListener('pointerenter', () => { lastZone = zone; });
  zone.addEventListener('focusin', () => { lastZone = zone; });
  // While empty, clicking the drop area opens the file chooser. Once there's a
  // picture the zone only takes drops and pastes; Choose image still works.
  zone.addEventListener('click', (e) => {
    if (e.target.closest('.dz-empty')) input.click();
  });
  zone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); input.click(); }
  });
  zone._dzInput = input;
}

// One paste handler for the page: an image on the clipboard goes to the zone
// in focus, else the one last hovered, else the first image field showing.
document.addEventListener('paste', (e) => {
  const file = imageFrom(e.clipboardData?.files);
  if (!file) return;
  const visible = [...document.querySelectorAll('.dropzone')].filter((z) => z.offsetParent);
  if (!visible.length) return;
  const zone = document.activeElement?.closest?.('.dropzone')
    || (lastZone && visible.includes(lastZone) ? lastZone : null)
    || visible.find((z) => z.classList.contains('image-field')) || visible[0];
  if (!zone?._dzInput) return;
  e.preventDefault();
  lastZone = zone;
  deliver(zone._dzInput, file);
});
