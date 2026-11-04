// Backup files between two devices: restoring a backup takes what the file
// has newer, keeps what this device has newer, and sends articles changed in
// both places to the merge manager instead of overwriting either side.
const fs = require('fs');
const { run, check, URL } = require('./lib');

run('backups: restore merges, clashes go to the merge manager', async ({ browser, errors }) => {
  const device = async () => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(URL); await p.waitForSelector('.world-card');
    return p;
  };
  const backup = async (p) => {
    await p.goto(URL + '#/settings'); await p.waitForSelector('#exportBtn');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
    return fs.readFileSync(await dl.path(), 'utf8');
  };
  const restore = async (p, text) => {
    await p.goto(URL + '#/settings'); await p.waitForSelector('#importFile', { state: 'attached' });
    await p.setInputFiles('#importFile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await p.waitForTimeout(800);
    return p.textContent('#toast');
  };
  const edit = (p, id, body) => p.evaluate(async ([i, b]) => { const s = await import('./js/store.js'); await s.save('articles', { ...s.article(i), body: b }); }, [id, body]);
  const get = (p, id) => p.evaluate(async (i) => (await import('./js/store.js')).article(i), id);

  const A = await device();
  const ids = await A.evaluate(async () => { const s = await import('./js/store.js'); const w = s.worlds()[0].id; const t = (x) => s.byTitle(w, x).id; return { ost: t('River Ost'), guild: t('Lantern Guild'), varen: t('Varenhold') }; });
  const B = await device();
  await restore(B, await backup(A)); // B starts as a copy of A

  await edit(A, ids.ost, 'A: the river is rising.');
  await edit(B, ids.ost, 'B: the river froze over.');   // changed in both places
  await edit(A, ids.guild, 'A: the Guild has a new master.'); // changed only on A
  await edit(B, ids.varen, 'B: the upper city sank a foot.'); // changed only on B

  const toast = await restore(B, await backup(A));
  const ost = await get(B, ids.ost), guild = await get(B, ids.guild), varen = await get(B, ids.varen);
  check('an article changed only in the file is taken from it', guild.body === 'A: the Guild has a new master.', guild.body);
  check('an article changed only here is kept', varen.body === 'B: the upper city sank a foot.', varen.body);
  check('an article changed in both places keeps ours and goes to the merge manager', ost.body === 'B: the river froze over.' && ost.conflict?.theirs.body === 'A: the river is rising.', ost);
  check('the import says so', /1 article was changed in both places/.test(toast), toast);
  await B.goto(`${URL}#/w/${ost.worldId}/a/${ids.ost}/resolve`); await B.waitForTimeout(700);
  check('the merge manager opens on it, with both versions', (await B.textContent('body')).includes('the river is rising') && (await B.textContent('body')).includes('the river froze over'));

  // Restoring the same file again changes nothing new and adds no new clash.
  const again = await restore(B, await backup(A));
  check('restoring the same file again finds no new clash', again === 'Backup imported', again);
  // Restoring an old backup over newer work keeps the newer work.
  const C = await device();
  const old = await backup(C);
  await restore(C, await backup(A));
  await edit(C, ids.guild, 'C: newer still.');
  await restore(C, old);
  check('an older backup doesn’t undo newer work', (await get(C, ids.guild)).body === 'C: newer still.');
});
