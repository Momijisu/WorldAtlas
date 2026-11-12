// Map display, per map: fit the window to the map, the grid behind it, a frame,
// and a grid over it (squares or hexes). Previewed live in map settings. A
// fitted map's key sits beside it.
const { run, check, openExample, go, store, seedVillage } = require('./lib');

run('maps: display options', async ({ newPage }) => {
  const p = await newPage();
  await openExample(p);
  const wid = await seedVillage(p, { pinStyle: 'numbers' }); // numbered: a long, two-column key
  await go(p, `#/w/${wid}/m/village`, 1200);
  const wrap = () => p.$eval('#mapWrap', (w) => ({ cls: [...w.classList], w: w.offsetWidth, h: w.offsetHeight }));
  const map = () => store(p, (s) => s.map('village'));

  let w = await wrap();
  check('by default: the grid behind, no frame, not fitted', !w.cls.includes('no-bg-grid') && !w.cls.includes('framed') && !w.cls.includes('fit'));
  check('no grid over the map', !(await p.$('#mapBox .map-grid rect')));

  // The dialog previews as you change it.
  await p.click('#settingsBtn');
  await p.waitForSelector('#modal-root [name="fit"]');
  await p.check('#modal-root [name="fit"]');
  await p.uncheck('#modal-root [name="bgGrid"]');
  await p.check('#modal-root [name="frame"]');
  await p.click('#gridKind [data-grid="hex"]');
  await p.waitForTimeout(200);
  w = await wrap();
  check('previews: fitted, framed, no grid behind', w.cls.includes('fit') && w.cls.includes('framed') && w.cls.includes('no-bg-grid'), w.cls);
  check('previews the hex grid', !!(await p.$('#mapBox .map-grid pattern path')));
  check('the size slider shows with a grid', await p.isVisible('#gridSizeRow'));

  // Closing without saving puts it back.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  w = await wrap();
  check('cancelling restores the saved display', !w.cls.includes('fit') && !w.cls.includes('framed') && !w.cls.includes('no-bg-grid') && !(await p.$('#mapBox .map-grid rect')), w.cls);

  // Saving keeps it.
  await p.click('#settingsBtn');
  await p.waitForSelector('#modal-root [name="fit"]');
  await p.check('#modal-root [name="fit"]');
  await p.uncheck('#modal-root [name="bgGrid"]');
  await p.check('#modal-root [name="frame"]');
  await p.click('#gridKind [data-grid="square"]');
  await p.fill('#modal-root [name="gridSize"]', '120');
  await p.click('#modal-root .btn.primary');
  await p.waitForTimeout(1200);
  const m = await map();
  check('saved on the map', m.fit === true && m.bgGrid === false && m.frame === true && m.grid?.kind === 'square' && m.grid?.size === 120, m);
  w = await wrap();
  check('shown after saving', w.cls.includes('fit') && w.cls.includes('framed') && w.cls.includes('no-bg-grid'), w.cls);
  // The window takes the map's shape (1500 × 1125), inside the frame.
  const box = await p.$eval('#mapBox', (b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
  check('the fitted window has the map’s shape', Math.abs(box.w / box.h - 1500 / 1125) < 0.02, box);
  check('the corners show', await p.isVisible('.map-corner'));
  // Fitted, the key sits beside the map (its left), not over it.
  const isOpen = await p.isVisible('#layersPanel');
  if (!isOpen) { await p.click('#layersBtn'); await p.waitForTimeout(300); }
  const side = await p.evaluate(() => { const k = document.querySelector('#layersPanel').getBoundingClientRect(), m = document.querySelector('#mapWrap').getBoundingClientRect(); return { kr: k.right, ml: m.left, side: document.querySelector('#mapWrap').classList.contains('side-panel') }; });
  check('fitted, the key sits outside the map, on its left', side.side && side.kr <= side.ml, side);
  const box2 = await p.$eval('#mapBox', (b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
  check('and the map keeps its shape beside it', Math.abs(box2.w / box2.h - 1500 / 1125) < 0.02, box2);
  // Beside the map, a long key keeps to one column when it fits the map's height.
  const vp = p.viewportSize();
  const keyCols = () => p.$eval('#layersPanel', (k) => ({ cols: getComputedStyle(k.querySelector('.layer-groups')).columnCount, fits: k.scrollHeight <= k.clientHeight + 1, w: k.offsetWidth }));
  await p.setViewportSize({ width: 2000, height: 1300 });
  await p.waitForTimeout(400);
  const tall = await keyCols();
  check('with room, the key is one column', tall.cols === '1' && tall.w === 260 && tall.fits, tall);
  await p.setViewportSize({ width: 1500, height: 600 });
  await p.waitForTimeout(400);
  const short = await keyCols();
  check('without room, two', short.cols === '2' && short.w === 500, short);
  await p.setViewportSize(vp);
  await p.waitForTimeout(400);

  // In edit mode the key goes back over the map, which gets the room.
  await p.click('#editBtn');
  await p.waitForTimeout(400);
  const ed = await p.evaluate(() => { const k = document.querySelector('#layersPanel').getBoundingClientRect(), w = document.querySelector('#mapWrap'), m = w.getBoundingClientRect(); return { kl: k.left, ml: m.left, mw: m.width, side: w.classList.contains('side-panel') }; });
  check('in edit mode the key sits over the map, inside it', !ed.side && ed.kl >= ed.ml, ed);
  check('and the map is bigger', ed.mw > box2.w + 100, [ed.mw, box2.w]);
  await p.click('#editBtn');
  await p.waitForTimeout(400);
  check('Done puts the key back beside the map', await p.$eval('#mapWrap', (w) => w.classList.contains('side-panel')));
  await p.click('#layersBtn');
  await p.waitForTimeout(300);
  check('closing the key brings the map back to the middle', !(await p.$eval('#mapWrap', (w) => w.classList.contains('side-panel') || !!w.style.marginLeft)));
  check('the square grid is drawn in the map’s pixels', await p.$eval('#mapBox .map-grid pattern', (x) => x.getAttribute('width') === '120'));

  // Turning them off clears the stored keys.
  await p.click('#settingsBtn');
  await p.waitForSelector('#modal-root [name="fit"]');
  await p.uncheck('#modal-root [name="fit"]');
  await p.check('#modal-root [name="bgGrid"]');
  await p.uncheck('#modal-root [name="frame"]');
  await p.click('#gridKind [data-grid="none"]');
  await p.click('#modal-root .btn.primary');
  await p.waitForTimeout(1200);
  const m2 = await map();
  check('off again leaves nothing stored', !('fit' in m2 && m2.fit) && m2.bgGrid === undefined && !m2.frame && !m2.grid, m2);
  w = await wrap();
  check('and the map is back to normal', !w.cls.includes('fit') && !w.cls.includes('framed') && !w.cls.includes('no-bg-grid') && !(await p.$('#mapBox .map-grid rect')), w.cls);
});
