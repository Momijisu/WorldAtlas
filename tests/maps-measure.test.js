// Measuring distances on a map: setting its scale from two points, measuring a
// route (pins snap), travel time, undo/clear, and that only the scale is saved.
const { run, check, openExample, go, store, mapPoint, closeKey, seedVillage } = require('./lib');

const SHOTS = process.env.WA_SHOTS;

run('maps: measuring distances', async ({ newPage }) => {
  const p = await newPage({ viewport: { width: 1400, height: 950 } });
  await openExample(p);
  const wid = await seedVillage(p);
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  const bar = () => p.textContent('#measureBar');
  const tap = async (fx, fy) => { await p.mouse.click(...(await mapPoint(p, fx, fy))); await p.waitForTimeout(150); };
  const pinsBefore = await store(p, (s) => s.map('village').pins.length);

  // No scale yet: Measure asks for one.
  await p.click('#measureBtn');
  check('without a scale, Measure asks to set one', (await bar()).includes('no scale yet'));
  await p.click('[data-m="scale"]');
  check('setting the scale asks for two points', (await bar()).includes('Click two points'));
  // The sea and the far woods: 1200 of the image's 1500 pixels apart. Call that 12 miles.
  await tap(0.1, 0.92); await tap(0.9, 0.92);
  await p.waitForSelector('#scaleF');
  if (SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: `${SHOTS}/measure-scale.png`, clip: { x: 420, y: 160, width: 620, height: 420 } }); }
  await p.fill('#scaleF input[name=dist]', '12');
  await p.click('#scaleF .btn.primary'); await p.waitForTimeout(400);
  const scale = await store(p, (s) => s.map('village').scale);
  check('the scale is saved with the map', scale && scale.unit === 'miles' && Math.abs(scale.perPx - 0.01) < 0.0002, scale);

  // Measure: Granary pin → Ashby Farm pin → a spot in the fields.
  await p.click('[data-pin="vp15"] .pin-badge'); await p.waitForTimeout(150);
  await p.click('[data-pin="vp16"] .pin-badge'); await p.waitForTimeout(150);
  // Granary (.40,.23) → Ashby (.50,.30): 150 × 78.75 px ≈ 169.4 px ≈ 1.7 miles
  check('clicking pins measures from their spots', (await p.textContent('.measure-total')) === '1.7 miles', await bar());
  await tap(0.66, 0.40);
  // + Ashby → (.66,.40): 240 × 112.5 px ≈ 265.1 px ≈ 2.65 → total ≈ 4.3 miles
  const total = await p.textContent('.measure-total');
  check('the total adds up each leg', total === '4.3 miles', total);
  check('with a travel time (4.3 miles at 24 a day ≈ 1 hour of an 8-hour day)', (await bar()).includes('≈ 1 hour on foot'), await bar());
  check('the running total shows on the map', (await p.textContent('.measure-label')) === total);
  if (SHOTS) { await p.waitForTimeout(2800); await p.screenshot({ path: `${SHOTS}/measure-route.png` }); }
  await p.click('[data-m="undo"]');
  check('Undo removes the last point', (await p.textContent('.measure-total')) === '1.7 miles');
  check('clicking pins while measuring doesn’t open them', await p.$eval('#mapInfo', (x) => x.hidden));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Escape ends measuring and clears the line', await p.$eval('#measureBar', (x) => x.hidden) && !(await p.$('.measure-dot')));
  check('nothing but the scale was saved', (await store(p, (s) => s.map('village').pins.length)) === pinsBefore);

  // Corner to corner: 1440 × 1080 px = 1800 px = 18 miles ≈ 6 hours; at a slower pace, days.
  await p.click('#measureBtn'); await tap(0.02, 0.02); await tap(0.98, 0.98);
  check('18 miles reads as hours on foot', (await p.textContent('.measure-total')) === '18 miles' && (await bar()).includes('≈ 6 hours on foot'), await bar());
  await store(p, async (s) => { const m = s.map('village'); await s.save('maps', { ...m, pace: 6 }); });
  await p.click('[data-m="clear"]'); await tap(0.02, 0.02); await tap(0.98, 0.98);
  check('at 6 miles a day it reads in days', (await bar()).includes('≈ 3 days on foot'), await bar());
  await p.click('[data-m="done"]');
  await p.click('#settingsBtn'); await p.waitForSelector('#mf');
  check('map settings show the scale', (await p.textContent('.scale-row')).includes('Set, in miles'));
});
