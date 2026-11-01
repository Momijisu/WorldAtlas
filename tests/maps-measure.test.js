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
  await tap(0.1, 0.75); await tap(0.9, 0.75);
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
  // Drag the last point from (.66,.40) up to (.66,.30): Ashby → there is 240 px = 2.4 miles, total 4.1.
  const from = await mapPoint(p, 0.66, 0.40), to = await mapPoint(p, 0.66, 0.30);
  await p.mouse.move(...from); await p.mouse.down(); await p.mouse.move(to[0], to[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  check('dragging a point moves it and updates the total', (await p.textContent('.measure-total')) === '4.1 miles' && (await p.$$('.measure-dot')).length === 3, await bar());
  await p.click('[data-m="undo"]');
  check('Undo removes the last point', (await p.textContent('.measure-total')) === '1.7 miles');
  check('clicking pins while measuring doesn’t open them', await p.$eval('#mapInfo', (x) => x.hidden));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Escape ends measuring and clears the line', await p.$eval('#measureBar', (x) => x.hidden) && !(await p.$('.measure-dot')));
  check('nothing but the scale was saved', (await store(p, (s) => s.map('village').pins.length)) === pinsBefore);

  // Across the map: 1200 × 500 px = 1300 px = 13 miles ≈ 4 hours on foot; at a slower pace, days.
  await p.click('#measureBtn'); await tap(0.1, 0.1); await tap(0.9, 0.1 + 500 / 1125);
  check('13 miles reads as hours on foot', (await p.textContent('.measure-total')) === '13 miles' && (await bar()).includes('≈ 4 hours on foot'), await bar());
  // Horseback: 13 / 40 a day × 8 hours ≈ 3 hours. Sailing: 13 / 80 a day × 24 hours ≈ 4 hours.
  await p.click('#measureBar [data-mode="horse"]');
  check('horseback is faster', (await bar()).includes('≈ 3 hours on horseback'), await bar());
  if (SHOTS) { const r = await (await p.$('#measureBar')).boundingBox(); await p.screenshot({ path: `${SHOTS}/measure-modes.png`, clip: { x: r.x - 10, y: r.y - 10, width: r.width + 20, height: r.height + 20 } }); }
  await p.click('#measureBar [data-mode="sail"]');
  check('sailing goes on day and night', (await bar()).includes('≈ 4 hours by ship'), await bar());
  await p.click('[data-m="done"]'); await p.click('#measureBtn');
  check('the chosen way of travelling is remembered', await p.$eval('#measureBar [data-mode="sail"]', (x) => x.classList.contains('on')));
  await p.click('#measureBar [data-mode="foot"]');
  await tap(0.1, 0.1); await tap(0.9, 0.1 + 500 / 1125);
  await store(p, async (s) => { const m = s.map('village'); await s.save('maps', { ...m, pace: 6 }); });
  await p.click('[data-m="clear"]'); await tap(0.1, 0.1); await tap(0.9, 0.1 + 500 / 1125);
  check('at 6 miles a day it reads in days (13 / 6 ≈ 2)', (await bar()).includes('≈ 2 days on foot'), await bar());
  await p.click('[data-m="done"]');
  await p.click('#settingsBtn'); await p.waitForSelector('#mf');
  check('map settings show the scale', (await p.textContent('.scale-row')).includes('Set, in miles'));

  // The scale bar: bottom right once the map has a scale, a round length that stays true as you zoom.
  await p.keyboard.press('Escape');
  await go(p, `#/w/${wid}/maps`, 300); await go(p, `#/w/${wid}/m/village`, 1200);
  const sb = () => p.evaluate(() => { const b = document.querySelector('#scaleBar'); const st = document.querySelector('.map-stage');
    const z = st.getBoundingClientRect().width / 1500; // screen px per image px
    return { hidden: b.hidden, text: b.querySelector('.sb-text').textContent, px: b.querySelector('.sb-line').getBoundingClientRect().width, z }; });
  const truth = ({ text, px, z }) => { const n = parseFloat(text.replace(/,/g, '')); return Math.abs(px / z * 0.01 - n) / n; }; // 0.01 miles per image px
  let b1 = await sb();
  check('the scale bar shows once the map has a scale', !b1.hidden && /^(1|2|5)(0*) miles?$/.test(b1.text) && b1.px >= 70 && b1.px <= 210, b1);
  check('its length matches the scale', truth(b1) < 0.03, truth(b1));
  if (SHOTS) { const r = await (await p.$('#mapBox')).boundingBox(); await p.screenshot({ path: `${SHOTS}/scalebar.png`, clip: { x: r.x + r.width - 330, y: r.y + r.height - 160, width: 330, height: 160 } }); }
  for (let i = 0; i < 4; i++) { await p.mouse.move(800, 500); await p.mouse.wheel(0, -400); await p.waitForTimeout(80); }
  await p.waitForTimeout(250);
  const b2 = await sb();
  check('zooming in changes it to a shorter, still-true length', parseFloat(b2.text) < parseFloat(b1.text) && truth(b2) < 0.03, [b1.text, b2.text, truth(b2)]);
  await p.click('#layersBtn').catch(() => {});
  if (await p.$eval('#layersPanel', (x) => x.hidden)) await p.click('#layersBtn');
  await p.click('#scaleToggle');
  check('the Layers panel switch hides it', (await sb()).hidden);
  await go(p, `#/w/${wid}/maps`, 300); await go(p, `#/w/${wid}/m/village`, 1200);
  check('…and it stays hidden', (await sb()).hidden);
  await p.click('#scaleToggle');
  check('switching it back on shows it', !(await sb()).hidden);
});
