// Folder sync: worlds kept in a folder on this computer that another app
// (Proton Drive, Dropbox…) carries between devices. Each test device's folder
// is the browser's private file system (it works like a folder the user picks);
// the test plays the cloud app, copying the files from one device's folder to
// the other's. Covers a second device, merging edits, a "conflicted copy" the
// cloud app made, pictures, renaming a world, Settings, and that OneDrive and a
// folder can't both be on.
const { run, check, URL } = require('./lib');

run('folder sync: through a synced folder', async ({ browser, errors }) => {
  async function device() {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(500);
    // Choose the device's folder for sync (as the folder picker would).
    await p.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const h = await root.getDirectoryHandle('ProtonDrive-WorldAtlas', { create: true });
      await (await import('./js/sync.js')).chooseFolder(h);
    });
    await p.waitForTimeout(400);
    return p;
  }
  const sync = async (p) => { await p.evaluate(async () => (await import('./js/sync.js')).sync()); await p.waitForTimeout(300); };
  // Every file in the device's folder: { path: base64 }.
  const dump = (p) => p.evaluate(async () => {
    const out = {};
    const walk = async (d, pre) => {
      for await (const [n, h] of d.entries()) {
        if (h.kind === 'directory') await walk(h, pre + n + '/');
        else { const b = new Uint8Array(await (await h.getFile()).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); out[pre + n] = btoa(s); }
      }
    };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('ProtonDrive-WorldAtlas'), '');
    return out;
  });
  // The cloud app at work: the other device's folder now holds the same files.
  const carry = async (from, to, rename = {}) => {
    const files = await dump(from);
    await to.evaluate(async ([fs, ren]) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('ProtonDrive-WorldAtlas');
      for (const [path, b64] of Object.entries(fs)) {
        const parts = (ren[path] || path).split('/');
        let d = root;
        for (const s of parts.slice(0, -1)) d = await d.getDirectoryHandle(s, { create: true });
        const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
        await w.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
        await w.close();
      }
    }, [files, rename]);
  };
  const article = (p, title) => p.evaluate(async (t) => [...(await import('./js/store.js')).data.articles.values()].find((a) => a.title === t), title);
  const edit = (p, title, body) => p.evaluate(async ([t, b]) => { const s = await import('./js/store.js'); const a = [...s.data.articles.values()].find((x) => x.title === t); await s.save('articles', { ...a, body: b }); }, [title, body]);

  // Device A: a world with an article and a picture, synced into its folder.
  const A = await device();
  await A.evaluate(async () => {
    const s = await import('./js/store.js');
    const w = { id: crypto.randomUUID(), name: 'Folderland' };
    await s.save('worlds', w);
    const img = await s.addImage(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }));
    await s.save('articles', { ...s.newArticle(w.id, 'location'), title: 'The Old Mill', body: 'It turns at night.', image: img });
  });
  await sync(A);
  let files = Object.keys(await dump(A));
  check('the world is written into the folder, in the OneDrive layout', files.includes('Worlds/Folderland/world.json') && files.includes('Worlds/Folderland/history.json') && files.some((f) => f.startsWith('Worlds/Folderland/images/')), files);
  check('the sync badge says it’s synced with the folder', (await A.getAttribute('#syncBtn', 'title')).includes('ProtonDrive-WorldAtlas'));

  // Device B: the cloud app brings the files; B picks them up, picture included.
  const B = await device();
  await carry(A, B);
  await sync(B);
  const millB = await article(B, 'The Old Mill');
  check('another device gets the world from the folder', millB?.body === 'It turns at night.', millB);
  check('and its picture', await B.evaluate(async (id) => !!(await (await import('./js/store.js')).getImage(id)), millB?.image));

  // Edits to different articles on each device merge.
  await A.evaluate(async () => { const s = await import('./js/store.js'); const w = s.worlds().find((x) => x.name === 'Folderland'); await s.save('articles', { ...s.newArticle(w.id, 'character'), title: 'The Miller', body: 'From A.' }); });
  await edit(B, 'The Old Mill', 'It turns at night. (B)');
  await sync(A); await sync(B);
  await carry(A, B, { 'Worlds/Folderland/world.json': 'Worlds/Folderland/world-from-A.json', 'Worlds/Folderland/history.json': 'Worlds/Folderland/history-from-A.json' });
  // (Both wrote world.json; the cloud app kept A's as a conflicted copy beside B's.)
  await sync(B);
  const after = Object.keys(await dump(B));
  check('a conflicted copy the cloud app made is merged in', (await article(B, 'The Miller'))?.body === 'From A.' && (await article(B, 'The Old Mill')).body === 'It turns at night. (B)');
  check('and then removed', !after.some((f) => /world-from-A|history-from-A/.test(f)), after);

  // The same article changed on both: kept for the merge manager.
  await carry(B, A); await sync(A);
  await edit(A, 'The Miller', 'A says so.');
  await edit(B, 'The Miller', 'B says otherwise.');
  await sync(A); await sync(B);
  await carry(B, A, { 'Worlds/Folderland/world.json': 'Worlds/Folderland/world (conflicted copy).json' });
  await sync(A);
  const miller = await article(A, 'The Miller');
  check('the same article changed on both goes to the merge manager', !!miller.conflict && [miller.body, miller.conflict.theirs.body].sort().join('|') === 'A says so.|B says otherwise.', miller);

  // Renaming the world renames its folder.
  await A.evaluate(async () => { const s = await import('./js/store.js'); const w = s.worlds().find((x) => x.name === 'Folderland'); await s.save('worlds', { ...w, name: 'Millshire' }); });
  await sync(A);
  files = Object.keys(await dump(A));
  check('renaming a world renames its folder', files.includes('Worlds/Millshire/world.json') && !files.some((f) => f.startsWith('Worlds/Folderland/')), [...new Set(files.map((f) => f.split('/').slice(0, 2).join('/')))]);

  // Settings: one Sync panel; the method in use is chosen, and the other offers to switch.
  await A.goto(URL + '#/settings'); await A.waitForSelector('#syncCard .sync-methods');
  check('Settings has one Sync panel, with a choice of method', JSON.stringify(await A.$$eval('#syncCard .sync-methods button', (b) => b.map((x) => x.textContent.trim()))) === JSON.stringify(['OneDrive', 'A folder on your PC']));
  check('the folder is the method in use', await A.$eval('#syncCard .sync-methods .on', (b) => b.dataset.method) === 'folder' && !!(await A.$('#syncCard .sync-methods .on .sync-dot')));
  const body = await A.textContent('#syncBody');
  check('its setup shows the folder being synced', body.includes('ProtonDrive-WorldAtlas') && body.includes('Up to date'), body.slice(0, 160));
  await A.click('[data-method="onedrive"]');
  check('choosing OneDrive while a folder is in use offers to switch', !(await A.$('#syncBody #connectBtn')) && !!(await A.$('#switchSync')) && (await A.textContent('#syncBody')).includes('ProtonDrive-WorldAtlas'));
  await A.click('#switchSync'); await A.click('.modal .btn.primary'); await A.waitForTimeout(400);
  check('switching stops folder sync and shows OneDrive’s setup', !!(await A.$('#syncBody #connectBtn, #syncBody #cidInput')) && (await A.evaluate(async () => (await import('./js/sync.js')).target())) === null);
  await A.click('[data-method="folder"]');
  check('and the folder method offers Choose folder again', !!(await A.$('#chooseFolderBtn')));
});
