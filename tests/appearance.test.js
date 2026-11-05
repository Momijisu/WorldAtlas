// Appearance: theme and article text are app-wide (Settings); background,
// noise and header edge belong to each world (World settings). Device
// defaults from before 1.58 move into the worlds once. Settings opens with
// About, then Install, then OneDrive sync. The sidebar's buttons line up.
const { run, check, openExample, go, store } = require('./lib');

run('appearance: app-wide vs per world', async ({ newPage }) => {
  // A device that had its own defaults before 1.58.
  const p = await newPage({ init: () => { if (!localStorage.getItem('wa.defaultsMoved')) { localStorage.setItem('wa.bg', JSON.stringify({ pattern: 'spells' })); localStorage.setItem('wa.noise', '10'); localStorage.setItem('wa.edge', 'torn'); } } });
  const wid = await openExample(p);
  await p.reload(); await p.waitForTimeout(800); // the example world exists now; the move runs at start-up
  const w = await store(p, (s, x) => s.world(x), wid);
  const keys = await p.evaluate(() => ['wa.bg', 'wa.noise', 'wa.edge'].map((k) => localStorage.getItem(k)));
  check('old device defaults move into worlds without their own', w.background?.pattern === 'spells' && w.noise === 10 && w.heroEdge === 'torn', w);
  check('and the device settings are dropped', keys.every((k) => k === null), keys);

  await go(p, '#/settings');
  const order = await p.$$eval('.settings .panel h2', (h) => h.map((x) => x.textContent));
  check('Settings opens with About, Install, then OneDrive sync', JSON.stringify(order.slice(0, 4)) === JSON.stringify(['About this app', 'Install the app', 'OneDrive sync', 'Appearance']), order);
  check('Settings has no background or header edge (they’re per world)', !(await p.$('.settings .bg-picker')) && !(await p.$('.settings #edgeSeg')) && !(await p.$('.settings #noiseRange')));
  check('outside a world the app uses its own gradient', await p.evaluate(() => document.body.dataset.bg) === 'gradient');

  // World settings: noise and edge are saved with the world.
  await go(p, `#/w/${wid}`);
  await p.click('#sideWorld');
  await p.waitForSelector('#noiseRange');
  check('World settings has no “Device default” edge', !(await p.$('#edgeSeg [data-edge-opt=""]')) && (await p.textContent('#edgeSeg')).startsWith('Fade'));
  await p.$eval('#noiseRange', (e) => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('noise previews live', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--noise').trim()) === '0.04');
  await p.click('#edgeSeg [data-edge-opt="fade"]');
  await p.click('#wf button.primary');
  await p.waitForTimeout(500);
  const after = await store(p, (s, x) => s.world(x), wid);
  check('noise and edge are saved with the world (Fade is the default, so not stored)', after.noise === 40 && after.heroEdge === undefined, after);

  // The card on the worlds page has its own framing of the cover, separate from the header's.
  await p.click('#sideWorld');
  await p.waitForSelector('.card-cover-img[src]');
  const img = await (await p.$('.card-cover-img')).boundingBox();
  await p.mouse.move(img.x + img.width / 2, img.y + img.height / 2); await p.mouse.down();
  await p.mouse.move(img.x + img.width / 2 + 100, img.y + img.height / 2, { steps: 6 }); await p.mouse.up();
  await p.click('#wf button.primary'); await p.waitForTimeout(500);
  const framed = await store(p, (s, x) => s.world(x), wid);
  check('dragging the card preview frames the card only', Array.isArray(framed.cardPos) && framed.cardPos[0] < 50 && framed.imagePos == null, [framed.cardPos, framed.imagePos]);
  await go(p, '#/');
  const bgPos = await p.$eval('.world-card .card-cover', (x) => x.style.backgroundPosition);
  check('the worlds page uses the card’s own framing', bgPos.startsWith(`${framed.cardPos[0]}%`), bgPos);
  await go(p, `#/w/${wid}`);

  // Sidebar: the world settings gear lines up with the fold button.
  const [gear, fold] = await p.evaluate(() => ['#sideWorld', '#sideFold'].map((s) => document.querySelector(s).getBoundingClientRect().right));
  check('the gear and the fold button share a right edge', Math.abs(gear - fold) < 1, [gear, fold]);
});
