// Marker shapes and styles: the map settings apply them (and the key's badges
// follow), and numbers sit centred in every shape and style.
const { run, check, openExample, go, seedVillage } = require('./lib');

run('maps: marker shapes and styles', async ({ newPage }) => {
  const p = await newPage({ deviceScaleFactor: 3 });
  await openExample(p);
  const wid = await seedVillage(p, { pinStyle: 'numbers' });
  await go(p, `#/w/${wid}/m/village`, 1200);

  await p.click('#settingsBtn');
  await p.waitForSelector('#mf');
  await p.selectOption('#mf select[name=pinShape]', 'hexagon');
  await p.selectOption('#mf select[name=pinFinish]', 'parchment');
  await p.click('#mf .btn.primary');
  await p.waitForTimeout(1000);
  const attrs = await p.evaluate(() => [document.querySelector('#mapBox').dataset.shape, document.querySelector('#mapBox').dataset.finish, document.querySelector('#layersPanel').dataset.finish]);
  check('settings apply the shape and style to the map and key', JSON.stringify(attrs) === JSON.stringify(['hexagon', 'parchment', 'parchment']), attrs);
  await p.click('#settingsBtn');
  await p.waitForSelector('#mf');
  await p.selectOption('#mf select[name=pinShape]', 'pin');
  await p.selectOption('#mf select[name=pinFinish]', 'colour');
  await p.click('#mf .btn.primary');
  await p.waitForTimeout(1000);
  check('back to pin + colour clears them', await p.evaluate(() => !document.querySelector('#mapBox').dataset.shape && !document.querySelector('#mapBox').dataset.finish));

  // Centring: compare each number's ink with and without it, inside its badge.
  const offsets = await p.evaluate(async () => {
    const out = {};
    const board = document.createElement('div');
    document.body.appendChild(board);
    for (const shape of ['pin', 'circle', 'hexagon', 'diamond', 'square']) for (const finish of ['colour', 'ivory', 'parchment', 'hologram']) {
      board.innerHTML = `<div class="map-box" ${shape === 'pin' ? '' : `data-shape="${shape}"`} ${finish === 'colour' ? '' : `data-finish="${finish}"`} style="position:fixed;left:0;top:0;width:600px;height:100px;z-index:9999;background:#a98a62">
        ${[1, 3, 4, 5, 7, 12].map((n, i) => `<button class="pin numbered" style="left:${40 + i * 80}px;top:70px;--pin:#c4553b;--inv:1"><span class="pin-badge"><span class="mk-fill"></span><b style="color:#000 !important;text-shadow:none !important">${n}</b></span></button>`).join('')}</div>`;
      await document.fonts.ready;
      out[`${shape}/${finish}`] = [...board.querySelectorAll('.pin-badge')].map((b) => {
        // the ink box of the digits, from a Range over the text, against the badge's box
        const r = document.createRange(); r.selectNodeContents(b.querySelector('b'));
        const t = r.getBoundingClientRect(), bb = b.getBoundingClientRect();
        return [(t.x + t.width / 2) - (bb.x + bb.width / 2), (t.y + t.height / 2) - (bb.y + bb.height / 2)];
      });
    }
    board.remove();
    return out;
  });
  // Text boxes include the font's spacing, so this checks layout centring (to a
  // pixel); the optical nudges were tuned against rendered ink separately.
  const worst = Object.entries(offsets).flatMap(([k, l]) => l.map(([x, y]) => [k, Math.max(Math.abs(x), Math.abs(y))])).sort((a, b) => b[1] - a[1])[0];
  check('numbers are centred in every shape and style (within 1.5px)', worst[1] <= 1.5, worst);
});
