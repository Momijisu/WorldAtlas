// Shared helpers for the browser tests (Playwright + Chromium).
// Each test file runs on its own: `node tests/<name>.test.js`, against the app
// served at WA_URL (default http://localhost:8766/; tests/run.sh starts one).
const { chromium } = require('playwright');

const URL = process.env.WA_URL || 'http://localhost:8766/';

let failures = 0;
// Record a check; failures are listed and make the process exit non-zero.
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name}${detail !== '' ? ` (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`); }
  return ok;
}

// Run a test body with a browser; page errors anywhere count as a failure.
function run(title, body) {
  console.log(title);
  (async () => {
    const browser = await chromium.launch();
    const errors = [];
    try {
      await body({ browser, errors, newPage: (opts) => newPage(browser, errors, opts) });
    } finally {
      await browser.close();
    }
    check('no page errors', !errors.length, errors);
    process.exit(failures ? 1 : 0);
  })().catch((e) => { console.log(`  FAIL crashed: ${e.message}`); process.exit(1); });
}

async function newPage(browser, errors, { viewport = { width: 1400, height: 950 }, init, ...ctxOpts } = {}) {
  const ctx = await browser.newContext({ viewport, ...ctxOpts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
}

// First visit lands on the worlds list; open the example world. Returns its id.
async function openExample(page) {
  await page.goto(URL);
  await page.waitForSelector('.world-card');
  await page.click('.world-card');
  await page.waitForSelector('.demo-banner');
  return page.evaluate(() => location.hash.split('/')[2]);
}

const go = async (page, hash, wait = 600) => { await page.goto(URL + hash); await page.waitForTimeout(wait); };
const store = (page, fn, arg) => page.evaluate(async ([src, a]) => {
  const s = await import('./js/store.js');
  return new Function('s', 'a', `return (${src})(s, a)`)(s, a);
}, [fn.toString(), arg]);

const center = async (page, sel) => {
  const bb = await (await page.$(sel)).boundingBox();
  return [bb.x + bb.width / 2, bb.y + bb.height / 2];
};
// Screen position of a point on the map image (fractions 0..1).
const mapPoint = (page, fx, fy) => page.evaluate(([fx, fy]) => {
  const r = document.querySelector('#mapBox .map-stage, .map-stage').getBoundingClientRect();
  return [r.x + r.width * fx, r.y + r.height * fy];
}, [fx, fy]);
// Close the key panel if it's open (the app remembers it closed).
const closeKey = (page) => page.evaluate(() => { const b = document.querySelector('#layersPanel:not([hidden]) [data-close]'); if (b) b.click(); });

async function drag(page, [x, y], [tx, ty], steps = 8, button = 'left') {
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  for (let i = 1; i <= steps; i++) await page.mouse.move(x + ((tx - x) * i) / steps, y + ((ty - y) * i) / steps);
  await page.mouse.up({ button });
  await page.waitForTimeout(200);
}

// A crowded village map: 22 places packed around a square and a river, and
// three districts. The image is drawn here, so no test depends on a real map.
const PLACES = [
  ['The Drowned Lantern', .245, .535], ['Market Cross', .26, .58], ['Saltbeck Hall', .245, .49], ['Chapel of the Tide', .175, .43],
  ['Fishwives’ Wharf', .165, .55], ['The Old Bridge', .265, .67], ['Mill Bridge', .405, .54], ['Harrow & Sons Smithy', .315, .485],
  ['Widow Pell’s Bakery', .29, .62], ['The Gull’s Rest', .21, .6], ['Netmaker’s Row', .2, .66], ['Reeve’s House', .33, .43],
  ['Cooper’s Yard', .37, .6], ['Tannery', .45, .64], ['Hollow Lane', .36, .72], ['Granary', .4, .23],
  ['Ashby Farm', .5, .3], ['Long Field', .66, .4], ['Thornfield Farm', .62, .63], ['The Watch Stone', .3, .38],
  ['Healer’s Cottage', .43, .5], ['Ferry Steps', .2, .7],
];
const DISTRICTS = [
  ['Old Town', [[.13, .36], [.27, .33], [.36, .40], [.37, .58], [.30, .72], [.22, .79], [.14, .74], [.12, .55]], '#c4553b'],
  ['Riverside', [[.37, .52], [.52, .46], [.60, .50], [.58, .68], [.46, .76], [.33, .78], [.30, .72], [.37, .58]], '#4f7cc4'],
  ['The Farms', [[.36, .17], [.64, .17], [.97, .18], [.97, .40], [.70, .62], [.55, .42], [.36, .30]], '#d6a84a'],
];
// Saves the map (id 'village') in the open world and returns the world id.
async function seedVillage(page, extra = {}) {
  return page.evaluate(async ({ PLACES, DISTRICTS, extra }) => {
    const s = await import('./js/store.js');
    const wid = location.hash.split('/')[2];
    const c = document.createElement('canvas'); c.width = 1500; c.height = 1125;
    const g = c.getContext('2d');
    g.fillStyle = '#8f8a4e'; g.fillRect(0, 0, 1500, 1125);
    g.fillStyle = '#6d8fb0'; g.fillRect(0, 0, 230, 1125); // the sea
    g.strokeStyle = '#9cc3d6'; g.lineWidth = 60; g.beginPath(); g.moveTo(330, 790); g.bezierCurveTo(700, 560, 1100, 400, 1450, 0); g.stroke(); // the river
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${20 + (i % 30)}, 35%, ${30 + (i % 25)}%)`; g.fillRect(250 + ((i * 97) % 700), 350 + ((i * 53) % 500), 14, 10); } // houses
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const image = await s.addImage(blob);
    const inside = ([px, py], pts) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) k = !k; } return k; };
    const regions = DISTRICTS.map(([label, points, color], i) => ({ id: 'vr' + i, label, layer: label, points, color, fill: 'solid' }));
    const pins = PLACES.map(([label, x, y], i) => {
      const r = regions.find((q) => inside([x, y], q.points));
      return { id: 'vp' + i, label, x, y, icon: 'map-pin', color: r?.color || '#7b9a5c', layer: r?.layer || 'Outskirts' };
    });
    await s.save('maps', { id: 'village', worldId: wid, name: 'Saltbeck', image, pins, regions, layerOrder: ['Old Town', 'Riverside', 'The Farms', 'Outskirts'], ...extra });
    return wid;
  }, { PLACES, DISTRICTS, extra });
}

module.exports = { URL, check, run, openExample, go, store, center, drag, mapPoint, closeKey, seedVillage, PLACES, DISTRICTS };
