// .world files: a whole world (articles, maps, history, pictures) in one file.
// Export it with the button, open it on another device, and open an updated
// copy where both sides changed the same article (it goes to the merge manager).
const fs = require('fs');
const { run, check, URL, openExample, go, store } = require('./lib');

run('world files: export and open a .world', async ({ browser, errors }) => {
  const device = async () => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  const exportFile = async (p, wid) => {
    await go(p, '#/settings');
    await p.selectOption('#worldFileSel', wid);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportWorldFile')]);
    return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) };
  };
  const openFile = async (p, file) => {
    await go(p, '#/settings');
    await p.setInputFiles('#openWorldFile', { name: file.name, mimeType: 'application/x-worldatlas-world', buffer: file.buf });
    await p.waitForTimeout(900);
    return p.textContent('#toast');
  };
  const counts = (p, wid) => store(p, async (s, w) => ({
    articles: s.articlesOf(w).length, maps: s.mapsOf(w).length,
    history: [...s.data.history.values()].filter((h) => h.worldId === w).length,
    images: (await Promise.all([...s.referencedImages({ wid: w, demo: s.isDemo(w) })].map((id) => s.getImage(id)))).filter(Boolean).length,
    demo: s.isDemo(w),
  }), wid);

  const A = await device();
  const wid = await openExample(A);
  const there = await counts(A, wid);
  const file = await exportFile(A, wid);
  check('the export is one .world file named after the world', file.name === 'Aerthal.world', file.name);
  check('it’s a single archive', file.buf.slice(0, 4).toString('hex') === '504b0304');

  // Another device opens it.
  const B = await device();
  await B.goto(URL); await B.waitForSelector('.world-card, .empty-state');
  await B.evaluate(async () => { const s = await import('./js/store.js'); for (const w of s.worlds()) await s.removeDemo(w.id); });
  const toast = await openFile(B, file);
  check('opening it adds the world', /Added “Aerthal”/.test(toast), toast);
  const here = await counts(B, wid);
  check('with every article, map, version and picture', here.articles === there.articles && here.maps === there.maps && here.history === there.history && here.images === there.images && here.images > 0, [there, here]);
  check('an opened example becomes the user’s own world', here.demo === false);
  check('it opens on the world', (await B.evaluate(() => location.hash)).includes(wid));

  // Both change the same article; opening the other's file sends it to the merge manager.
  const v = await store(A, (s, w) => s.byTitle(w, 'Varenhold').id, wid);
  await store(A, (s, id) => s.save('articles', { ...s.article(id), body: 'A: the Lift sank.' }), v);
  await store(B, (s, id) => s.save('articles', { ...s.article(id), body: 'B: the Lift rose.' }), v);
  await store(A, (s, w) => s.save('articles', { ...s.newArticle(w, 'character'), title: 'Only On A', body: 'New.' }), wid);
  const fileA = await exportFile(A, wid);
  const t2 = await openFile(B, fileA);
  const vb = await store(B, (s, id) => s.article(id), v);
  check('opening a world you have merges it in', /Merged in “Aerthal”/.test(t2) && !!(await store(B, (s, w) => s.byTitle(w, 'Only On A'), wid)), t2);
  check('an article changed in both places keeps yours and goes to the merge manager', vb.body === 'B: the Lift rose.' && vb.conflict?.theirs.body === 'A: the Lift sank.', vb);
  check('the message says so', /1 article was changed in both places/.test(t2), t2);
  const t3 = await openFile(B, fileA);
  check('opening the same file again finds nothing new to clash', !/changed in both places/.test(t3), t3);

  // World settings has the export too.
  await go(A, `#/w/${wid}`);
  await A.click('#sideWorld'); await A.waitForSelector('[data-export]');
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-export]')]);
  check('World settings exports the world too', dl.suggestedFilename() === 'Aerthal.world');
});
