// Map input and places: the Name field (find an article or name a new place),
// the info card's linked-map preview, and panning (left and middle button, in
// edit mode too).
const { run, check, openExample, go, store, drag, mapPoint, closeKey, seedVillage } = require('./lib');

run('maps: names, info card, panning', async ({ newPage }) => {
  const p = await newPage();
  await openExample(p);
  const wid = await seedVillage(p);
  // The Granary pin (on its own, so nothing covers it) opens the example's own map.
  const exampleMap = await store(p, (s, w) => s.mapsOf(w).find((m) => m.id !== 'village').id, wid);
  await store(p, async (s, id) => { const m = s.map('village'); m.pins[15].mapId = id; await s.save('maps', m); }, exampleMap);
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  const pins = () => store(p, (s) => s.map('village').pins);
  const fit = async () => { await p.click('[data-z="fit"]'); await p.waitForTimeout(300); };

  // Name field: type to find an article, or keep your own name. (Woods, bottom right: no pins there.)
  await p.click('#editBtn');
  await p.waitForTimeout(200);
  await p.mouse.click(...(await mapPoint(p, 0.85, 0.88)));
  await p.waitForSelector('#pf');
  check('clicking an empty spot in edit mode starts a new place', (await p.textContent('#modal-root h2')) === 'Add a place');
  await p.fill('#placeName', 'varen');
  await p.waitForTimeout(150);
  check('typing suggests matching articles', (await p.$$eval('#placeSuggest li span', (l) => l.map((x) => x.textContent))).includes('Varenhold'));
  await p.fill('#placeName', 'Ironhollow');
  await p.waitForTimeout(100);
  check('an unknown name says it will offer to create the article', (await p.textContent('.link-status')).includes('No article called “Ironhollow”'));
  await p.click('#pf .btn.primary');
  await p.waitForTimeout(300);
  const added = (await pins()).at(-1);
  check('the place saves with its name and no article', (await pins()).length === 23 && added.label === 'Ironhollow' && !added.articleId, added);
  await p.click('#editBtn');
  await p.waitForTimeout(300);
  await p.click(`[data-pin="${added.id}"] .pin-badge`);
  await p.waitForTimeout(300);
  check('its card offers to write the article', (await p.$$eval('#mapInfo .info-actions a', (l) => l.map((x) => x.textContent.trim()))).includes('Write about Ironhollow'));

  // Info card with a linked map shows a preview of it.
  await p.click('[data-pin="vp15"] .pin-badge');
  await p.waitForTimeout(500);
  check('a place that opens a map shows its preview', await p.$eval('#mapInfo', (x) => x.classList.contains('has-map') && !!x.querySelector('.info-map img[src]')));
  await p.click('#mapInfo .close');

  // Panning, zoomed in.
  const tf = () => p.$eval('.map-stage', (x) => x.style.transform);
  await p.mouse.move(800, 550); await p.mouse.wheel(0, -500); await p.waitForTimeout(200);
  let dir = 1;
  const pans = async (button) => { dir = -dir; const a = await tf(); await drag(p, [800, 550], [800 + dir * 120, 550 + dir * 60], 8, button); return a !== await tf(); };
  check('left-drag pans', await pans('left'));
  check('middle-drag pans', await pans('middle'));
  await p.click('#editBtn');
  await p.waitForTimeout(200);
  check('left-drag pans in edit mode', await pans('left'));
  check('middle-drag pans in edit mode', await pans('middle'));
  await p.mouse.click(800, 550, { button: 'middle' });
  await p.waitForTimeout(200);
  check('panning and middle-clicks never add a pin', (await pins()).length === 23 && !(await p.$('#modal-root > *')));
  await fit();
});
