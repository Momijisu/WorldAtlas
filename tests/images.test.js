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

  // The infobox shows a portrait square, even a tall picture.
  await go(p, `#/w/${wid}/a/${id}`);
  const sq = await p.$eval('.infobox-frame', (f) => { const r = f.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), f.querySelector('img').style.transform]; }).catch(() => null);
  check('the infobox shows a tall portrait square, unzoomed', sq && sq[0] === sq[1] && sq[2] === '', sq);

  // Zoom in, in the editor.
  await go(p, `#/w/${wid}/a/${id}/edit`);
  check('the editor has a zoom slider for the portrait', await p.isVisible('#imgZoom'));
  await p.$eval('#imgZoom', (e) => { e.value = 200; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the preview zooms as you slide', (await p.$eval('.image-field .thumb', (t) => t.style.transform)) === 'scale(2)');
  // The picture is tall, so unzoomed it only moves up and down; zoomed, it moves across too.
  const th = await (await p.$('.image-field .thumb')).boundingBox();
  await p.mouse.move(th.x + th.width / 2, th.y + th.height / 2); await p.mouse.down();
  await p.mouse.move(th.x + th.width / 2 + 40, th.y + th.height / 2 + 40, { steps: 6 }); await p.mouse.up();
  const pos = await store(p, () => null).then(() => p.evaluate(() => document.querySelector('.image-field .thumb').style.objectPosition));
  const [px, py] = pos.split(' ').map(parseFloat);
  check('a zoomed portrait can be moved both across and up and down', px < 50 && py < 50, pos);
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  check('the zoom is saved with the article', (await store(p, (s, x) => s.article(x).imageZoom, id)) === 2);
  const frame = await p.$eval('.infobox-frame', (f) => { const r = f.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: f.querySelector('img').style.transform }; }).catch(() => null);
  check('zoomed, the infobox shows a square crop, scaled', frame && frame.w === frame.h && frame.t === 'scale(2)', frame);

  // The header image zooms too.
  const vh = await store(p, (s, w) => s.byTitle(w, 'Varenhold').id, wid);
  await go(p, `#/w/${wid}/a/${vh}/edit`);
  await p.$eval('#bannerZoom', (e) => { e.value = 150; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('button:has-text("Save")'); await p.waitForTimeout(700);
  check('the header image zoom is saved', (await store(p, (s, x) => s.article(x).bannerZoom, vh)) === 1.5);
  const hero = await p.$eval('.article-hero', (h) => [h.classList.contains('zoomed'), getComputedStyle(h, '::before').transform]);
  check('and the header shows zoomed', hero[0] && /matrix\(1\.5, 0, 0, 1\.5/.test(hero[1]), hero);
  await go(p, `#/w/${wid}/a/${id}`);

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

  // Clicking a picture shows it large: the whole picture, with its article's title.
  await go(p, `#/w/${wid}/a/${id}`);
  const fr = await (await p.$('.infobox-frame')).boundingBox();
  await p.mouse.click(fr.x + 40, fr.y + 40);
  await p.waitForSelector('.lightbox img', { timeout: 3000 }).catch(() => {});
  const lb = await p.$eval('.lightbox', (l) => ({ cap: l.querySelector('figcaption')?.textContent, w: l.querySelector('img').naturalWidth, h: l.querySelector('img').naturalHeight })).catch(() => null);
  check('clicking a portrait opens it large, whole and uncropped', lb && lb.cap === 'Queen Ysolde' && lb.w === 200 && lb.h === 300, lb);
  await p.keyboard.press('Escape');
  check('Esc closes it', !(await p.$('.lightbox')));
  await go(p, `#/w/${wid}/a/${vh}`);
  await p.click('.article-hero', { position: { x: 200, y: 60 } });
  check('clicking a header image opens it too', (await p.textContent('.lightbox figcaption').catch(() => '')) === 'Varenhold');
  await p.mouse.click(10, 10);
  check('clicking outside the picture closes it', !(await p.$('.lightbox')));
  await go(p, `#/w/${wid}/a/${id}/edit`);
  await p.click('.image-field .thumb');
  check('editor previews don’t open it (they’re for framing)', !(await p.$('.lightbox')));
});
