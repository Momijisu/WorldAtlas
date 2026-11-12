// The world overview as a title page: centred name, an optional subtitle (World
// settings), and the contents following the description, with the random-article
// button under them when writing prompts are off. Also articles' running head
// and World settings' infobox style (boxed or in the margin).
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

  // Articles: a running head in place of the breadcrumb; the infobox in the margin.
  const vid = await store(p, (s, id) => s.byTitle(id, 'Varenhold').id, wid);
  await go(p, `#/w/${wid}/a/${vid}`, 500);
  check('the running head names the world, the parents and the article', (await p.textContent('.running-head')).replace(/\s+/g, ' ').trim() === 'Aerthal · Vael · Varenhold', await p.textContent('.running-head'));
  check('its links lead up the tree', (await p.$$eval('.running-head a', (l) => l.map((a) => a.textContent))).join() === 'Aerthal,Vael');
  check('the infobox sits in the margin', await p.$eval('article.page', (x) => x.classList.contains('ib-margin')) && (await p.$eval('.infobox', (x) => getComputedStyle(x).borderTopWidth)) === '0px');
  await go(p, `#/w/${wid}`, 400);

  // Contents follow the description, in the same column; the prompt sits beside them.
  check('the contents follow the description', await p.$eval('.intro-main', (m) => {
    const kids = [...m.children].map((c) => c.className);
    return kids[0].includes('world-desc') && kids[1] === 'contents-head' && kids[2] === 'index-grid';
  }));
  check('with prompts on, the prompt and random button sit beside', !!(await p.$('.intro-side #todayPrompt')) && !!(await p.$('.intro-side #randomArt')));

  // Prompts off: the random button moves under the contents; one column.
  await p.evaluate(() => localStorage.setItem('wa.hidePrompts', '1'));
  await go(p, `#/w/${wid}`, 400);
  await p.reload();
  await p.waitForSelector('.intro-main');
  check('with prompts off, there is no side column', !(await p.$('.intro-side')) && !(await p.$eval('.world-intro', (x) => x.classList.contains('two-col'))));
  check('the random button follows the contents', await p.$eval('#randomArt', (b) => b.parentElement.classList.contains('intro-main') && b.previousElementSibling.classList.contains('index-grid')));
  const before = await p.evaluate(() => location.hash);
  await p.click('#randomArt');
  await p.waitForTimeout(300);
  check('and still opens an article', (await p.evaluate(() => location.hash)) !== before && (await p.evaluate(() => location.hash)).includes('/a/'));

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
