// OneDrive sync end to end against a fake drive: migrating the old single-file
// layout, a second device, merging edits from both, renaming and deleting a
// world, an old-version device writing the old file again, and throttling.
const { run, check, URL } = require('./lib');
const fakeDrive = require('./fakedrive');

run('sync: OneDrive lifecycle', async ({ browser, errors }) => {
  const drive = fakeDrive();
  const { files, log, throttle } = drive;
  async function device(signedIn = true) {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => localStorage.setItem('wa.editMode', 'markdown'));
    await ctx.route(/graph\.microsoft\.com|login\.microsoftonline\.com|dl\.example/, drive.graph);
    if (signedIn) {
      await ctx.addInitScript(() => {
        if (!localStorage.getItem('wa.tokens')) localStorage.setItem('wa.tokens', JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: Date.now() + 3e6, session_at: Date.now(), account: { name: 'Test', username: 't@x' } }));
      });
    }
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(500);
    return p;
  }
  const sync = async (p) => { await p.evaluate(async () => (await import('./js/sync.js')).sync()); await p.waitForTimeout(300); };
  const folders = () => [...new Set([...files.keys()].filter((k) => k.startsWith('Worlds/')).map((k) => k.split('/')[1]))].sort();
  const worlds = (p) => p.evaluate(async () => (await import('./js/store.js')).worlds().map((w) => w.name).sort());
  const editBody = (p, title, text) => p.evaluate(async ([t, x]) => { const s = await import('./js/store.js'); const a = [...s.data.articles.values()].find((y) => y.title === t); await s.save('articles', { ...a, body: x }); }, [title, text]);
  const remoteBody = (folder, title) => JSON.parse(files.get(`Worlds/${folder}/world.json`).body.toString()).articles.find((a) => a.title === title).body;

  // 1. The old layout (one atlas.json at the root) is moved into per-world folders.
  const F = await device(false);
  const legacy = await F.evaluate(async () => {
    const s = await import('./js/store.js'); const wid = s.worlds()[0].id; await s.keepDemo(wid);
    const pick = (st) => [...s.data[st].values()];
    const imgs = [];
    for (const id of s.referencedImages()) { const r = await s.getImage(id); const buf = await r.blob.arrayBuffer(); imgs.push({ id, type: r.type, b64: btoa(String.fromCharCode(...new Uint8Array(buf))) }); }
    return { atlas: { app: 'WorldAtlas', version: 1, worlds: pick('worlds'), articles: pick('articles'), maps: pick('maps') }, history: { history: pick('history') }, imgs };
  });
  files.set('atlas.json', { body: Buffer.from(JSON.stringify(legacy.atlas)), eTag: 'e' + drive.bump(), type: 'application/json' });
  files.set('history.json', { body: Buffer.from(JSON.stringify(legacy.history)), eTag: 'e' + drive.bump(), type: 'application/json' });
  for (const i of legacy.imgs) files.set('images/' + i.id, { body: Buffer.from(i.b64, 'base64'), eTag: 'e' + drive.bump(), type: i.type });
  const L = await device();
  await sync(L); await sync(L);
  check('old layout migrates into Worlds/Aerthal', files.has('Worlds/Aerthal/world.json') && !files.has('atlas.json'), [...files.keys()].filter((k) => !k.includes('/images/')));
  check('images move into the world folder', [...files.keys()].filter((k) => k.startsWith('Worlds/Aerthal/images/')).length === legacy.imgs.length);
  check('old files are kept in Legacy/', [...files.keys()].some((k) => k.startsWith('Legacy/')));

  // 2. A fresh device gets everything.
  const M = await device();
  await sync(M);
  const mw = await M.evaluate(async () => { const s = await import('./js/store.js'); const w = s.worlds()[0]; return { arts: s.articlesOf(w.id).length, imgs: (await s.imageIds()).length }; });
  check('second device downloads the world and its images', mw.arts === legacy.atlas.articles.length && mw.imgs === legacy.imgs.length, mw);

  // 3. Edits on both devices merge; one edit uploads only its own world.
  const second = await M.evaluate(async () => { const s = await import('./js/store.js'); const w = { id: crypto.randomUUID(), name: 'Second World' }; await s.save('worlds', w); return w.id; });
  await sync(M); await sync(L);
  check('a new world gets its own folder and reaches the other device', folders().includes('Second World') && (await worlds(L)).includes('Second World'));
  log.length = 0;
  await editBody(L, 'River Ost', 'EDIT FROM L'); await sync(L);
  const puts = log.filter((x) => x.startsWith('PUT'));
  check('one edit uploads only that world', puts.length && puts.every((x) => x.includes('Worlds/Aerthal/')), puts);
  await editBody(M, 'Lantern Guild', 'EDIT FROM M'); await sync(M); await sync(L); await sync(M);
  check('edits from both devices are merged', remoteBody('Aerthal', 'River Ost') === 'EDIT FROM L' && remoteBody('Aerthal', 'Lantern Guild') === 'EDIT FROM M');

  // 4. Renaming a world renames its folder everywhere.
  await L.evaluate(async () => { const s = await import('./js/store.js'); const w = s.worlds().find((x) => x.name === 'Aerthal'); await s.save('worlds', { ...w, name: 'Aerthal Reborn' }); });
  await sync(L); await sync(M);
  check('rename moves the folder', folders().includes('Aerthal Reborn') && !folders().includes('Aerthal'), folders());
  check('rename reaches the other device', (await worlds(M)).includes('Aerthal Reborn'));

  // 5. Deleting a world removes its folder and reaches the other device.
  await L.evaluate(async (id) => (await import('./js/store.js')).deleteWorld(id), second);
  await sync(L); await sync(M);
  check('delete removes the folder and is recorded', !folders().includes('Second World') && files.has('deleted.json'));
  check('delete reaches the other device', !(await worlds(M)).includes('Second World'));

  // 6. A device on an old version writes atlas.json again: merged, then retired.
  const old = JSON.parse(files.get('Worlds/Aerthal Reborn/world.json').body.toString());
  old.articles.push({ id: 'legacy-art', worldId: old.worlds[0].id, title: 'Written On Old Version', type: 'article', body: 'hi', updatedAt: Date.now() });
  files.set('atlas.json', { body: Buffer.from(JSON.stringify(old)), eTag: 'e' + drive.bump(), type: 'application/json' });
  await sync(L);
  check('an old version’s atlas.json is merged and retired', await L.evaluate(async () => !!(await import('./js/store.js')).article('legacy-art')) && !files.has('atlas.json'));

  // 7. Throttling: a short wait is waited out; a long one pauses without an error.
  throttle.left = 2; throttle.after = 1; log.length = 0;
  await editBody(L, 'River Ost', 'AFTER A SHORT THROTTLE'); await sync(L);
  check('short throttle is waited out and the edit uploads', log.filter((x) => x === '429').length === 2 && remoteBody('Aerthal Reborn', 'River Ost') === 'AFTER A SHORT THROTTLE');
  throttle.left = 1; throttle.after = 120;
  await editBody(L, 'River Ost', 'AFTER A LONG THROTTLE'); await sync(L);
  const cls = await L.$eval('#syncBtn', (e) => e.className);
  check('long throttle pauses quietly (no error state)', !/error/.test(cls), cls);

  // 8. A sync with nothing changed is cheap.
  log.length = 0;
  await M.evaluate(async () => (await import('./js/sync.js')).sync());
  check('a quiet sync makes few requests', log.length <= 6, log);
});
