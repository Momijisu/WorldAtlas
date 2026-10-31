// The map key: numbered pins, folding, two columns, arranging in edit mode
// (drag, keyboard, groups), counts, and groups that stand for regions.
const { run, check, openExample, go, store, center, drag, closeKey, seedVillage } = require('./lib');

run('maps: numbered pins and the key', async ({ newPage }) => {
  const p = await newPage();
  await openExample(p);
  const wid = await seedVillage(p, { pinStyle: 'numbers' });
  await go(p, `#/w/${wid}/m/village`, 1200);
  const groups = () => p.$$eval('#layersPanel .layer-group', (gs) => gs.map((g) => [g.dataset.group, [...g.querySelectorAll('[data-key]')].map((b) => b.textContent.trim())]));
  const map = () => store(p, (s) => s.map('village'));

  check('pins show numbers', (await p.$$('#mapBox .pin.numbered')).length === 22);
  check('the key lists every place', (await groups()).reduce((n, [, l]) => n + l.length, 0) === 22);
  check('a long key uses two columns', await p.$eval('#layersPanel', (x) => x.classList.contains('two-col')));
  check('counts are places only', JSON.stringify(await p.$$eval('#layersPanel .layer-row .count', (l) => l.map((x) => x.textContent))) === JSON.stringify(['13', '5', '3', '1']));

  // Folding.
  await p.click('[data-fold="Old Town"]');
  check('folding hides a group’s places', !(await groups())[0][1].length);
  check('folded key drops to one column', !(await p.$eval('#layersPanel', (x) => x.classList.contains('two-col'))));
  await p.click('[data-fold="Old Town"]');

  // Hovering a numbered pin: only its marker reacts, and its name shows on top.
  await closeKey(p);
  const badge = await (await p.$('[data-pin="vp0"] .pin-badge')).boundingBox();
  await p.mouse.move(badge.x + 40, badge.y - 12);
  await p.waitForTimeout(200);
  check('the hidden name doesn’t widen the hover area', !(await p.$$eval('.pin-label', (l) => l.some((x) => getComputedStyle(x).opacity !== '0'))));
  await p.mouse.move(badge.x + badge.width / 2, badge.y + badge.height / 2);
  await p.waitForTimeout(200);
  check('hovering the marker shows its name, above other pins', await p.$eval('[data-pin="vp0"]', (x) => getComputedStyle(x).zIndex === '5' && getComputedStyle(x.querySelector('.pin-label')).opacity === '1'));
  await p.click('#layersBtn');

  // A group holding regions: hovering lights them, clicking zooms (one region also opens its card).
  await p.hover('[data-group-regions="vr1"]');
  check('hovering a group name lights its region', await p.$eval('#mapBox [data-region="vr1"]', (x) => x.classList.contains('lit')));
  await p.click('[data-group-regions="vr0"]');
  await p.waitForTimeout(500);
  check('clicking it opens the region’s card', await p.$eval('#mapInfo', (x) => !x.hidden && x.querySelector('.info-title').textContent === 'Old Town'));

  // Arranging in edit mode.
  await p.click('#editBtn');
  await p.waitForTimeout(300);
  check('edit mode turns the key into "Arrange the key"', (await p.textContent('#layersPanel .field-label')) === 'Arrange the key');
  // drag Market Cross (by its name) to the top of Riverside
  await drag(p, await center(p, '[data-key="pin:vp1"]'), await center(p, '[data-item="pin:vp6"]').then(([x, y]) => [x, y - 6]));
  let m = await map();
  check('dragging a place by its name moves it to another group', m.pins.find((x) => x.id === 'vp1').layer === 'Riverside');
  const riverside = (await groups()).find(([g]) => g === 'Riverside')[1];
  check('numbers follow the new order', riverside[0].endsWith('Market Cross'), riverside);
  // keyboard: move it back up into Old Town's end
  await p.focus('[data-item="pin:vp1"] [data-grip]');
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(300);
  check('arrow keys on a grip move a place between groups', (await map()).pins.find((x) => x.id === 'vp1').layer === 'Old Town');
  // reorder groups by dragging a heading
  await p.$eval('[data-group="Outskirts"]', (x) => x.scrollIntoView({ block: 'end' }));
  await drag(p, await center(p, '[data-group="Outskirts"] > .layer-line [data-grip]'), await center(p, '[data-group="The Farms"] > .layer-line').then(([x, y]) => [x, y - 8]));
  check('dragging a group heading reorders groups', (await map()).layerOrder.join() === 'Old Town,Riverside,Outskirts,The Farms', (await map()).layerOrder);
  // new group, rename (renames a same-named region too), remove
  await p.click('[data-new-group]');
  await p.fill('#gf input[name=name]', 'Harbour');
  await p.click('#gf .btn.primary');
  await p.waitForTimeout(300);
  check('a new empty group appears', (await groups()).some(([g]) => g === 'Harbour'));
  await p.click('[data-rename="Riverside"]');
  await p.fill('#gf input[name=name]', 'The Riverside');
  await p.click('#gf .btn.primary');
  await p.waitForTimeout(300);
  m = await map();
  check('renaming a group renames its same-named region', m.regions.find((r) => r.id === 'vr1').label === 'The Riverside' && m.pins.filter((x) => x.layer === 'The Riverside').length >= 5);
  await p.click('[data-remove="Harbour"]');
  await p.waitForTimeout(300);
  check('removing an empty group needs no confirmation', !(await groups()).some(([g]) => g === 'Harbour'));
});
