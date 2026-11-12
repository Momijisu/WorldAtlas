// Import packages: the assistant's .world file — import.json plus the pictures it
// names by path (a world cover, article pictures and banners, maps) — zipped the
// usual way (deflated, inside one folder). Also the instructions that explain it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { run, check, go, store } = require('./lib');

run('import packages: JSON with pictures in a .world', async ({ newPage }) => {
  const p = await newPage();
  await go(p, '#/settings');

  // The instructions explain the package.
  const instr = await p.evaluate(async () => { let t = ''; navigator.clipboard.writeText = async (x) => { t = x; }; document.querySelector('#copyAiPrompt').click(); await new Promise((r) => setTimeout(r, 100)); return t; });
  check('the instructions say how to package pictures', instr.includes('import.json') && instr.includes('images/') && instr.includes('.world') && instr.includes('"headerImage"') && instr.includes('"maps"'));

  // Three small PNGs, drawn in the page.
  const pngs = await p.evaluate(async () => {
    const out = {};
    for (const [name, colour, w, h] of [['cover', '#a33', 300, 160], ['portrait', '#3a3', 120, 160], ['map', '#33a', 400, 300]]) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, w, h);
      out[name] = c.toDataURL('image/png').split(',')[1];
    }
    return out;
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-pkg-'));
  const root = path.join(dir, 'Lumen');
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  for (const [n, b64] of Object.entries(pngs)) fs.writeFileSync(path.join(root, 'images', `${n}.png`), Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(root, 'import.json'), JSON.stringify({
    format: 'worldatlas-import', version: 1,
    world: { name: 'Lumen', description: 'A world of lanterns.', image: 'images/cover.png' },
    articles: [
      { title: 'Ada Wren', type: 'character', summary: 'A lamplighter.', image: 'images/portrait.png', headerImage: './images/cover.png' },
      { title: 'Lamp Street', type: 'location', image: 'images/missing.png' },
    ],
    maps: [{ name: 'The Lantern Coast', image: 'images/map.png' }],
  }));
  const file = path.join(dir, 'Lumen.world');
  execFileSync('python3', ['-c', `import zipfile,os,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)
for d,_,fs in os.walk(sys.argv[2]):
  for f in fs:
    full=os.path.join(d,f); z.write(full, os.path.relpath(full, os.path.dirname(sys.argv[2])))
z.close()`, file, root]);

  await p.setInputFiles('#openWorldFile', { name: 'Lumen.world', mimeType: 'application/zip', buffer: fs.readFileSync(file) });
  await p.waitForSelector('#ipGo');
  const preview = await p.textContent('#ipv');
  check('the preview counts the pictures and maps', preview.includes('3 pictures') && preview.includes('1 map: The Lantern Coast'), preview);
  check('the button names both', (await p.textContent('#ipGo')).includes('2 articles and 1 map'));
  await p.click('#ipGo');
  await p.waitForTimeout(1500);
  check('one missing picture is reported', (await p.textContent('#toast')).includes('Lamp Street'), await p.textContent('#toast'));
  const got = await store(p, async (s) => {
    const w = s.worlds().find((x) => x.name === 'Lumen');
    const ada = s.byTitle(w.id, 'Ada Wren'), lamp = s.byTitle(w.id, 'Lamp Street');
    const maps = s.mapsOf(w.id);
    const has = async (id) => !!id && !!(await s.getImage(id))?.blob;
    return { cover: await has(w.image), portrait: await has(ada.image), banner: await has(ada.banner), lamp: lamp.image || null, maps: maps.map((m) => m.name), map: await has(maps[0]?.image) };
  });
  check('the world gets its cover', got.cover, got);
  check('the article gets its picture and banner', got.portrait && got.banner, got);
  check('the map is added with its picture', got.maps.join() === 'The Lantern Coast' && got.map, got);
  check('a missing picture leaves the article without one', got.lamp === null, got);

  // The worlds page opens one too, beside New world.
  await go(p, '#/');
  check('the worlds page has an Open .world button', !!(await p.$('.page-head #openWorldInput')));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'import.json'), 'utf8'));
  pkg.world.name = 'Lumen Two';
  // Named something other than import.json this time: any import-format JSON will do.
  fs.rmSync(path.join(root, 'import.json'));
  fs.writeFileSync(path.join(root, 'lumen-two.json'), JSON.stringify(pkg));
  fs.rmSync(file);
  execFileSync('python3', ['-c', 'import shutil,sys; shutil.make_archive(sys.argv[1], "zip", sys.argv[2])', file.replace(/\.world$/, ''), root]);
  await p.setInputFiles('#openWorldInput', { name: 'Lumen Two.zip', mimeType: 'application/zip', buffer: fs.readFileSync(file.replace(/\.world$/, '.zip')) });
  await p.waitForSelector('#ipGo');
  await p.click('#ipGo');
  await p.waitForTimeout(1500);
  check('it imports from there (the JSON under another name)', await store(p, (s) => !!s.worlds().find((x) => x.name === 'Lumen Two')));

  // A zip with neither says what it found.
  await go(p, '#/settings');
  const junk = await p.evaluate(async () => { const { zip } = await import('./js/worldfile.js'); const b = zip([{ name: 'notes.txt', data: new TextEncoder().encode('hi') }]); return [...new Uint8Array(await b.arrayBuffer())]; });
  await p.setInputFiles('#openWorldFile', { name: 'odd.world', mimeType: 'application/zip', buffer: Buffer.from(junk) });
  await p.waitForTimeout(500);
  check('an archive with neither says what it holds', (await p.textContent('#toast')).includes('no import.json') && (await p.textContent('#toast')).includes('notes.txt'), await p.textContent('#toast'));
  fs.rmSync(dir, { recursive: true, force: true });
});
