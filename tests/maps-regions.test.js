// Regions: editing a placed region's shape (menu, drag, add, remove, undo,
// save, Done, Escape, leaving the page), close-together points, crisp
// outlines, and region names that stay inside their region when nudged.
const { run, check, openExample, go, store, center, drag, closeKey, seedVillage } = require('./lib');

run('maps: region shapes and names', async ({ newPage }) => {
  const p = await newPage();
  await openExample(p);
  // Riverside gets two points almost on top of each other.
  const wid = await seedVillage(p);
  await store(p, async (s) => { const m = s.map('village'); m.regions[1].points.splice(2, 0, [.523, .462]); await s.save('maps', m); });
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  const points = () => store(p, (s) => s.map('village').regions[1].points);
  const dots = () => p.$$eval('.draft-dot', (l) => l.length);
  const openShape = async () => {
    const [x, y] = await center(p, '#mapBox [data-region="vr1"]');
    await p.mouse.click(x, y + 30, { button: 'right' });
    await p.waitForTimeout(150);
    await p.click('.map-menu [data-m="shape"]');
    await p.waitForTimeout(250);
  };

  const [rx, ry] = await center(p, '#mapBox [data-region="vr1"]');
  await p.mouse.click(rx, ry + 30, { button: 'right' });
  await p.waitForTimeout(150);
  check('right-clicking a region opens its menu (not the app’s)', JSON.stringify(await p.$$eval('.map-menu button', (l) => l.map((x) => x.textContent.trim()))) === JSON.stringify(['Edit shape', 'Edit details', 'Show info', 'Delete region']) && !(await p.$('.ctx-menu')));
  await p.click('.map-menu [data-m="shape"]');
  await p.waitForTimeout(250);
  const n0 = (await points()).length;
  check('Edit shape shows the points', (await dots()) === n0);
  check('the edge between two close points has no add-handle', await p.$eval('[data-mid="1"]', (x) => x.hidden));
  check('points are drawn above add-handles', await p.evaluate(() => { const d = document.querySelector('[data-vertex="1"]').getBoundingClientRect(); const e = document.elementFromPoint(d.x + d.width / 2, d.y + d.height / 2); return e.dataset.vertex !== undefined; }));

  const v0 = await center(p, '[data-vertex="0"]');
  await drag(p, v0, [v0[0] - 30, v0[1] - 20]);
  const m3 = await center(p, '[data-mid="3"]');
  await drag(p, m3, [m3[0] + 30, m3[1] + 25]);
  check('dragging an edge handle adds a point', (await dots()) === n0 + 1);
  const v5 = await center(p, '[data-vertex="5"]');
  await p.mouse.click(...v5); await p.mouse.click(...v5);
  await p.waitForTimeout(150);
  check('double-clicking a point removes it', (await dots()) === n0);
  await p.mouse.click(...(await center(p, '[data-vertex="5"]')), { button: 'right' });
  await p.waitForTimeout(150);
  check('right-clicking a point removes it (no menu)', (await dots()) === n0 - 1 && !(await p.$('.ctx-menu')) && !(await p.$('.map-menu')));
  await p.click('[data-act="shape-undo"]');
  await p.click('[data-act="shape-undo"]');
  check('undo steps back through the edits', (await dots()) === n0 + 1);
  await p.click('[data-act="shape-save"]');
  await p.waitForTimeout(300);
  check('Save shape stores the new outline', (await points()).length === n0 + 1);

  // Done also keeps the shape; Escape cancels; leaving with changes asks.
  await openShape();
  const before = JSON.stringify((await points())[0]);
  const w0 = await center(p, '[data-vertex="0"]');
  await drag(p, w0, [w0[0] + 25, w0[1] + 25]);
  await p.click('#editBtn');
  await p.waitForTimeout(400);
  check('Done keeps the edited shape', JSON.stringify((await points())[0]) !== before);
  const kept = JSON.stringify(await points());
  await openShape();
  const x0 = await center(p, '[data-vertex="0"]');
  await drag(p, x0, [x0[0] - 25, x0[1]]);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  check('Escape cancels the edit', JSON.stringify(await points()) === kept);
  await openShape();
  const y0 = await center(p, '[data-vertex="0"]');
  await drag(p, y0, [y0[0] - 25, y0[1]]);
  await p.evaluate((w) => { location.hash = `#/w/${w}/maps`; }, wid);
  await p.waitForTimeout(300);
  check('leaving with an edited shape asks first', await p.$eval('#modal-root', (x) => x.textContent.includes('new shape')));
  await p.click('#modal-root button:has-text("Keep editing")').catch(() => p.keyboard.press('Escape'));
  await p.click('[data-act="shape-cancel"]').catch(() => {});

  // Outlines keep their on-screen width at any zoom.
  await p.click('#editBtn').catch(() => {});
  const [zx, zy] = await center(p, '#mapBox [data-region="vr1"]');
  for (let i = 0; i < 8; i++) { await p.mouse.move(zx, zy); await p.mouse.wheel(0, -400); await p.waitForTimeout(60); }
  await p.waitForTimeout(300);
  const width = await p.evaluate(() => { const k = 1 / parseFloat(getComputedStyle(document.querySelector('.map-stage')).getPropertyValue('--inv')); return parseFloat(getComputedStyle(document.querySelector('#mapBox .region')).strokeWidth) * k; });
  check('region outlines stay thin when zoomed in', Math.abs(width - 1.6) < 0.05, width);

  // A small crowded region: its nudged name never leaves the region at any zoom.
  await store(p, async (s) => {
    const m = s.map('village');
    m.regions.push({ id: 'sq', label: 'Market Square', layer: 'Market Square', color: '#c4553b', fill: 'solid', points: [[.42, .47], [.50, .45], [.53, .50], [.49, .56], [.42, .55]] });
    [[-.02, -.015], [0, -.01], [.03, 0], [-.03, .02], [.02, .03], [0, .025], [-.01, .005]].forEach(([dx, dy], i) => m.pins.push({ id: 'st' + i, label: 'Stall ' + i, x: .47 + dx, y: .505 + dy, layer: 'Market Square' }));
    await s.save('maps', m);
  });
  await go(p, `#/w/${wid}/maps`, 300);
  await go(p, `#/w/${wid}/m/village`, 1200);
  await closeKey(p);
  let outside = 0, nudged = 0;
  for (let step = 0; step < 14; step++) {
    await p.mouse.move(600, 600); await p.mouse.wheel(0, step < 7 ? -180 : 260); await p.waitForTimeout(250);
    const res = await p.evaluate(() => {
      const ctm = document.querySelector('#mapBox svg').getScreenCTM();
      const labels = [...document.querySelectorAll('#mapBox .region-label')];
      return [...document.querySelectorAll('#mapBox .region')].map((poly, i) => {
        const pts = [...poly.points].map((pt) => { const q = pt.matrixTransform(ctm); return [q.x, q.y]; });
        const r = labels[i].getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2, lw = r.width * 0.8, lh = r.height * 0.7;
        const inside = ([px, py]) => { let c = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xi, yi] = pts[a], [xj, yj] = pts[b]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
        let A = 0, gx = 0, gy = 0;
        for (let a = 0; a < pts.length; a++) { const [x0, y0] = pts[a], [x1, y1] = pts[(a + 1) % pts.length]; const f = x0 * y1 - x1 * y0; A += f; gx += (x0 + x1) * f; gy += (y0 + y1) * f; }
        const moved = Math.hypot(cx - gx / (3 * A), cy - gy / (3 * A)) > 2;
        return { moved, allIn: [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([ex, ey]) => inside([cx + ex * lw / 2, cy + ey * lh / 2])) };
      });
    });
    for (const r of res) { if (r.moved) nudged++; if (r.moved && !r.allIn) outside++; }
  }
  check('nudged region names stay wholly inside their region', outside === 0, `${outside} of ${nudged} nudged`);
});
