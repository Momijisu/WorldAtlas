// The world overview as a title page: centred name and an optional subtitle
// (World settings), over a compact contents grid. Also World settings' article
// infobox style (boxed or in the margin).
const { run, check, openExample, go, store } = require('./lib');

run('world overview: title page and contents', async ({ newPage }) => {
  const p = await newPage();
  const wid = await openExample(p);
  check('no subtitle until one is set', !(await p.$('.world-subtitle')));
  check('the title has its rule', !!(await p.$('.hero-title .title-rule')));

  // Subtitle and infobox style, from World settings.
  await p.click('#editWorld');
  await p.waitForSelector('#wf [name="subtitle"]');
  await p.fill('#wf [name="subtitle"]', '  An atlas of the shattered continent ');
  await p.click('#infoboxSeg [data-ib="margin"]');
  await p.click('#wf .btn.primary');
  await p.waitForTimeout(500);
  let w = await store(p, (s, id) => s.world(id), wid);
  check('the subtitle saves, trimmed', w.subtitle === 'An atlas of the shattered continent', w.subtitle);
  check('the infobox style saves', w.infobox === 'margin', w.infobox);
  check('the subtitle shows under the name', (await p.textContent('.hero .world-subtitle')) === 'An atlas of the shattered continent');

  // Articles: the infobox in the margin.
  const vid = await store(p, (s, id) => s.byTitle(id, 'Varenhold').id, wid);
  await go(p, `#/w/${wid}/a/${vid}`, 500);
  check('the infobox sits in the margin', await p.$eval('article.page', (x) => x.classList.contains('ib-margin')) && (await p.$eval('.infobox', (x) => getComputedStyle(x).borderTopWidth)) === '0px');
  await go(p, `#/w/${wid}`, 400);

  // The contents grid stays below the intro, in its compact form.
  check('the contents grid follows the intro', await p.$eval('.index-grid', (g) => g.previousElementSibling.classList.contains('flourish')));
  check('no Overview entry in the sidebar: the world’s name leads there', !(await p.$('#sidebar nav a[href$="/w/' + wid + '"]:not(.world-title a)')) && !!(await p.$(`#sidebar .world-title a[href="#/w/${wid}"]`)));
  const rows = async (width) => {
    await p.setViewportSize({ width, height: 900 });
    await p.waitForTimeout(300);
    return p.$$eval('.index-cell', (cs) => { const tops = new Map(); for (const c of cs) tops.set(c.offsetTop, (tops.get(c.offsetTop) || 0) + 1); return [...tops.values()]; });
  };
  const vp = p.viewportSize();
  for (const width of [1900, 1500, 1100, 700, 390]) {
    const r = await rows(width);
    check(`at ${width}px the contents rows are even (the last no more than one short)`, r.slice(0, -1).every((n) => n === r[0]) && r[0] - r.at(-1) < r.length, r);
  }
  await p.setViewportSize(vp);
  await p.waitForTimeout(200);
  check('its cells are compact', (await p.$eval('.index-cell', (c) => c.offsetHeight)) < 44, await p.$eval('.index-cell', (c) => c.offsetHeight));

  // Clearing both removes the keys.
  await go(p, `#/w/${wid}`, 400);
  await p.click('#editWorld');
  await p.waitForSelector('#wf [name="subtitle"]');
  await p.fill('#wf [name="subtitle"]', '');
  await p.click('#infoboxSeg [data-ib=""]');
  await p.click('#wf .btn.primary');
  await p.waitForTimeout(500);
  w = await store(p, (s, id) => s.world(id), wid);
  check('cleared, nothing is stored', !('subtitle' in w) && !('infobox' in w), w);
  check('and no subtitle shows', !(await p.$('.world-subtitle')));
  await go(p, `#/w/${wid}/a/${vid}`, 500);
  check('boxed again by default', !(await p.$eval('article.page', (x) => x.classList.contains('ib-margin'))) && (await p.$eval('.infobox', (x) => getComputedStyle(x).borderTopWidth)) === '1px');
});
