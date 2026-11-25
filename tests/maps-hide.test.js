// Hiding a pin or region on the map, for places whose name the map image
// already shows: nothing is drawn, but it stays clickable, listed, and
// visible (faintly) while editing.
const { run, check, openExample, go, store, closeKey, seedVillage } = require('./lib');

run('maps: hiding a pin or region on the map', async ({ newPage }) => {
  const p = await newPage();
  await openExample(p);
  const wid = await seedVillage(p);
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  const map = () => store(p, (s) => s.map('village'));
  const opacity = (sel) => p.$eval(sel, (x) => +getComputedStyle(x).opacity);

  // A pin, from its form in edit mode.
  await p.click('#editBtn');
  await p.waitForTimeout(200);
  await p.click('[data-pin="vp15"] .pin-badge');
  await p.waitForSelector('#pf [name="hide"]');
  check('the place form offers Hide on the map', !(await p.isChecked('#pf [name="hide"]')));
  await p.check('#pf [name="hide"]');
  await p.click('#pf .btn.primary');
  await p.waitForTimeout(500);
  check('it is saved on the pin', (await map()).pins.find((x) => x.id === 'vp15').hide === true);
  check('while editing, a hidden pin still shows, with its name', (await opacity('[data-pin="vp15"] .pin-badge')) > 0.3 && (await opacity('[data-pin="vp15"] .pin-label')) === 1);

  // A region, from its form.
  await p.evaluate(() => document.querySelector('[data-region="vr1"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })));
  await p.waitForTimeout(200);
  await p.click('.map-menu [data-m="details"]');
  await p.waitForSelector('#rf [name="hide"]');
  {
    check('the region form offers Hide on the map', !(await p.isChecked('#rf [name="hide"]')));
    await p.check('#rf [name="hide"]');
    await p.click('#rf .btn.primary');
    await p.waitForTimeout(500);
  }
  check('it is saved on the region', (await map()).regions[1].hide === true);
  await go(p, '#/', 200);
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  const name = (await map()).regions[1].label;

  // Reading the map: nothing drawn...
  check('a hidden pin draws no marker or name', (await opacity('[data-pin="vp15"] .pin-badge')) === 0 && (await opacity('[data-pin="vp15"] .pin-label')) === 0);
  check('a hidden region is transparent', await p.$eval('[data-region="vr1"]', (x) => x.classList.contains('region-hidden') && getComputedStyle(x).fill.includes('0)') || getComputedStyle(x).fill === 'transparent'));
  check('and its name isn’t drawn', !(await p.$$eval('.region-label', (l) => l.some((x) => x.textContent === name && getComputedStyle(x).visibility !== 'hidden'))));
  check('other places still are', (await opacity('[data-pin="vp1"] .pin-badge')) === 1);

  // ...but still there to hover and click.
  await p.hover('[data-pin="vp15"] .pin-badge');
  await p.waitForTimeout(200);
  check('hovering a hidden pin shows its name', (await opacity('[data-pin="vp15"] .pin-label')) === 1);
  await p.click('[data-pin="vp15"] .pin-badge');
  await p.waitForTimeout(300);
  check('clicking where it is opens its card', await p.isVisible('#mapInfo') && (await p.textContent('#mapInfo')).includes((await map()).pins[15].label));
  check('which links to its article', !!(await p.$('#mapInfo .info-actions a')));
  const regionName = () => p.$$eval('.region-label', (l, n) => l.some((x) => x.textContent === n && getComputedStyle(x).visibility !== 'hidden'), name);
  await p.mouse.move(0, 0);
  await p.evaluate(() => document.querySelector('[data-region="vr1"]').dispatchEvent(new PointerEvent('pointerenter')));
  check('hovering a hidden region doesn’t show its name (the map image has it)', !(await regionName()));
  await p.evaluate(() => document.querySelector('[data-region="vr1"]').dispatchEvent(new PointerEvent('pointerleave')));

  // Edit mode: names shown as usual.
  await p.click('#editBtn');
  await p.waitForTimeout(300);
  check('while editing, a hidden region’s name shows', await regionName());
  await p.click('#editBtn');
  await p.waitForTimeout(300);

  // Still in the key.
  await p.click('#placesBtn');
  await p.waitForTimeout(200);
  check('hidden places stay in the Places list', (await p.textContent('#placesList')).includes((await map()).pins[15].label));
});
