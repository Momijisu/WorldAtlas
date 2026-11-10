// Pictures: zooming and framing a portrait (the infobox shows the crop), and
// the right-click menu's Save image as…, Copy image and Open image on pictures.
const { run, check, openExample, go, store } = require('./lib');

run('images: portrait zoom, save and copy', async ({ newPage }) => {
  const p = await newPage({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'], init: () => localStorage.setItem('wa.editMode', 'markdown') });
  const wid = await openExample(p);
  // Give Queen Ysolde a portrait (a 200×300 PNG drawn here).
  const id = await store(p, async (s, w) => {
    const c = Object.assign(document.createElement('canvas'), { width: 200, height: 300 });
    const g = c.getContext('2d'); g.fillStyle = '#336'; g.fillRect(0, 0, 200, 300); g.fillStyle = '#c93'; g.fillRect(60, 40, 80, 80);
    const img = await s.addImage(await new Promise((r) => c.toBlob(r, 'image/png')));
    const a = s.byTitle(w, 'Queen Ysolde');
    await s.save('articles', { ...a, image: img });
    return a.id;
  }, wid);

  // At 100% the infobox shows the whole picture.
  await go(p, `#/w/${wid}/a/${id}`);
  check('at 100% the infobox shows the whole portrait', !(await p.$('.infobox-frame')) && !!(await p.$('.infobox-img')));

  // Zoom in, in the editor.
  await go(p, `#/w/${wid}/a/${id}/edit`);
  check('the editor has a zoom slider for the portrait', await p.isVisible('#imgZoom'));
  await p.$eval('#imgZoom', (e) => { e.value = 200; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the preview zooms as you slide', (await p.$eval('.image-field .thumb', (t) => t.style.transform)) === 'scale(2)');
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  check('the zoom is saved with the article', (await store(p, (s, x) => s.article(x).imageZoom, id)) === 2);
  const frame = await p.$eval('.infobox-frame', (f) => { const r = f.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: f.querySelector('img').style.transform }; }).catch(() => null);
  check('zoomed, the infobox shows a square crop, scaled', frame && frame.w === frame.h && frame.t === 'scale(2)', frame);

  // Right-click the portrait: save and copy.
  await p.click('.infobox-img', { button: 'right' });
  const labels = await p.$$eval('.ctx-menu button span', (l) => l.map((x) => x.textContent));
  check('right-clicking a picture offers Save, Copy and Open', ['Save image as…', 'Copy image', 'Open image in new tab'].every((l) => labels.includes(l)), labels);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.ctx-menu button:has-text("Save image as…")')]);
  check('Save image as… saves it, named after the article', dl.suggestedFilename() === 'Queen Ysolde.png', dl.suggestedFilename());
  await p.click('.infobox-img', { button: 'right' });
  await p.click('.ctx-menu button:has-text("Copy image")');
  await p.waitForTimeout(400);
  const copied = await p.evaluate(async () => { const items = await navigator.clipboard.read(); return items[0]?.types || []; });
  check('Copy image puts it on the clipboard', copied.includes('image/png'), copied);

  // A header image (a background, not an <img>) works too, converted to PNG to copy.
  await go(p, `#/w/${wid}/a/${await store(p, (s, w) => s.byTitle(w, 'Varenhold').id, wid)}`);
  await p.click('.article-hero', { button: 'right', position: { x: 300, y: 100 } });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('.ctx-menu button:has-text("Save image as…")')]);
  check('a header image saves too, marked as the header', dl2.suggestedFilename() === 'Varenhold header.svg', dl2.suggestedFilename());
});
