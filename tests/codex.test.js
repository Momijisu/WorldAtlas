// Arranging the codex (which templates show in the sidebar and on the
// overview, and their order, saved with the world), and zooming the world's
// cover in World settings.
const { run, check, openExample, go, store } = require('./lib');

run('codex arranging and cover zoom', async ({ newPage }) => {
  const p = await newPage();
  const wid = await openExample(p);
  const sidebar = () => p.$$eval('#sidebar nav a[href*="/t/"]:not([href$="/t/all"])', (l) => l.map((a) => a.textContent.replace(/\d+$/, '').trim()));
  const grid = () => p.$$eval('.index-grid .index-cell[href*="/t/"] .label', (l) => l.map((x) => x.textContent));
  const before = await sidebar();
  check('by default the codex shows every template in use', before.length > 5 && before[0] === 'Characters', before);

  await p.click('#sidebar [data-arrange]');
  await p.waitForSelector('#codexList li');
  // Hide Species; move Locations to the top.
  await p.uncheck('#codexList li:has-text("Species") input[type=checkbox]');
  for (let i = 0; i < 6; i++) {
    const up = p.locator('#codexList li:has-text("Locations") [data-move="-1"]');
    if (await up.isDisabled()) break;
    await up.click();
  }
  await p.click('#codexF button.primary');
  await p.waitForTimeout(500);
  const after = await sidebar();
  check('a hidden template leaves the sidebar', !after.includes('Species'), after);
  check('and the order you set is kept', after[0] === 'Locations', after);
  const g = await grid();
  check('the overview grid follows it', !g.includes('Species') && g[0] === 'Locations', g);
  const codex = await store(p, (s, w) => s.world(w).codex, wid);
  check('it’s saved with the world (so it syncs)', codex?.hidden?.includes('species') && codex.order[0] === 'location', codex);
  check('hidden articles are still in All articles', (await store(p, (s, w) => s.articlesOf(w).some((a) => a.type === 'species'), wid)));

  await p.click('#sidebar [data-arrange]');
  await p.click('[data-reset]');
  await p.click('#codexF button.primary');
  await p.waitForTimeout(500);
  check('“Show all, usual order” puts it back, and clears the setting', JSON.stringify(await sidebar()) === JSON.stringify(before) && !(await store(p, (s, w) => s.world(w).codex, wid)));

  // Chronicle and Atlas: hide Calendar, and both Atlas pages (the heading goes too).
  await p.click('#sidebar [data-arrange]');
  await p.uncheck('[data-nav="calendar"]'); await p.uncheck('[data-nav="maps"]'); await p.uncheck('[data-nav="graph"]');
  await p.click('#codexF button.primary'); await p.waitForTimeout(500);
  const titles = await p.$$eval('#sidebar .nav-title', (t) => t.map((x) => x.textContent.trim()));
  const links = await p.$$eval('#sidebar nav a', (l) => l.map((a) => a.getAttribute('href')));
  check('hidden Chronicle and Atlas pages leave the sidebar', !links.some((h) => /\/calendar|\/maps|\/graph/.test(h)) && links.some((h) => h.endsWith('/timeline')), links);
  check('a section with nothing left loses its heading', titles.includes('Chronicle') && !titles.includes('Atlas'), titles);
  const cells = await p.$$eval('.index-grid .label', (l) => l.map((x) => x.textContent));
  check('and the overview grid follows', !cells.includes('Calendar') && !cells.includes('Maps') && cells.includes('Timeline'), cells);
  await p.click('#sidebar [data-arrange]'); await p.click('[data-reset]'); await p.click('#codexF button.primary'); await p.waitForTimeout(500);
  check('reset brings them back', (await p.$$eval('#sidebar nav a', (l) => l.map((a) => a.getAttribute('href')))).some((h) => h.endsWith('/graph')));

  // Cover zoom.
  await p.click('#sideWorld');
  await p.waitForSelector('#coverZoom');
  await p.$eval('#coverZoom', (e) => { e.value = 180; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the cover preview zooms as you slide', (await p.$eval('#wf .image-field .thumb', (t) => t.style.transform)) === 'scale(1.8)');
  await p.click('#wf button.primary');
  await p.waitForTimeout(600);
  check('the cover zoom is saved with the world', (await store(p, (s, w) => s.world(w).imageZoom, wid)) === 1.8);
  const hero = await p.$eval('.world-home .hero-img', (h) => [h.classList.contains('zoomed'), getComputedStyle(h, '::before').transform]);
  check('and the overview header shows zoomed', hero[0] && /matrix\(1\.8, 0, 0, 1\.8/.test(hero[1]), hero);

  // The card on the worlds page zooms too.
  await p.click('#sideWorld');
  await p.waitForSelector('#cardZoom');
  await p.$eval('#cardZoom', (e) => { e.value = 150; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('the card preview zooms as you slide', (await p.$eval('.card-cover-img', (t) => t.style.transform)) === 'scale(1.5)');
  await p.click('#wf button.primary'); await p.waitForTimeout(500);
  check('the card zoom is saved with the world', (await store(p, (s, w) => s.world(w).cardZoom, wid)) === 1.5);
  await go(p, '#/');
  const card = await p.$eval('.world-card .card-cover', (c) => [c.classList.contains('zoomed'), getComputedStyle(c, '::before').transform]);
  check('and the card on the worlds page shows zoomed', card[0] && /matrix\(1\.5, 0, 0, 1\.5/.test(card[1]), card);
});
