// Offline cache and updates: each version's files are served intact from that
// version's cache (a changed file on the server doesn't leak into it), the app
// opens offline, and a new version replaces the cache as a whole. A new version
// waits for the user ("!" on Settings, with what's new), even mid-edit.
// Uses its own copy of the app, served on another port, so it can change files.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { run, check } = require('./lib');

const repo = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-offline-'));
for (const f of fs.readdirSync(repo)) if (!['.git', 'tests', 'tools', 'node_modules'].includes(f)) fs.cpSync(path.join(repo, f), path.join(dir, f), { recursive: true });
const PORT = 8767;
const URL = `http://localhost:${PORT}/`;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: dir, stdio: 'ignore' });
process.on('exit', () => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

run('offline cache and updates', async ({ browser, errors }) => {
  await new Promise((r) => setTimeout(r, 800));
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  const version = () => fs.readFileSync(path.join(dir, 'js/version.js'), 'utf8').match(/WA_VERSION = '([^']+)'/)[1];
  const caches = () => p.evaluate(async () => Promise.all((await self.caches.keys()).map(async (k) => [k, await (await (await self.caches.open(k)).match('css/app.css'))?.text()])));

  await p.goto(URL);
  await p.waitForSelector('.world-card');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForSelector('.world-card');
  check('the service worker controls the page', await p.evaluate(() => !!navigator.serviceWorker.controller));
  let c = await caches();
  check('one cache, named for this version', c.length === 1 && c[0][0] === 'worldatlas-' + version(), c.map(([k]) => k));

  // A file changes on the server without a new version: the cached version stays whole.
  fs.appendFileSync(path.join(dir, 'css/app.css'), '\n/* CHANGED ON SERVER */\n');
  await p.reload(); await p.waitForSelector('.world-card'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForSelector('.world-card'); await p.waitForTimeout(800);
  c = await caches();
  check('a changed file doesn’t leak into the installed version’s cache', !c[0][1].includes('CHANGED ON SERVER'));

  // Offline: the app still opens.
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.world-card', { timeout: 5000 }).catch(() => {});
  check('the app opens offline', !!(await p.$('.world-card')));
  await ctx.setOffline(false);

  // A new version: installs as a whole, then waits for the user, who sees what's new in it.
  const old = version();
  const bump = (v) => { fs.writeFileSync(path.join(dir, 'js/version.js'), fs.readFileSync(path.join(dir, 'js/version.js'), 'utf8').replace(/WA_VERSION = '[^']+'/, `WA_VERSION = '${v}'`)); };
  const log = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), log.replace("# What's new\n\n", "# What's new\n\n## 99.1.0\n\n- **Second test update.**\n\n## 99.0.0\n\n- **First test update.**\n\n"));
  let navigated = false;
  const onNav = (f) => { if (f === p.mainFrame()) navigated = true; };
  p.on('framenavigated', onNav);
  bump('99.0.0');
  await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await p.waitForSelector('body.update-ready', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  check('a new version doesn’t take over by itself', !navigated && (await p.evaluate(() => self.WA_VERSION)) === old);
  check('a “!” on the Settings link says an update is ready', await p.evaluate(() => getComputedStyle(document.querySelector('#sidebar .nav-settings'), '::after').content === '"!"'));
  check('no pop-up: the “!” is all that shows', !(await p.$('#modal-root > *')));
  await p.click('#sidebar .nav-settings');
  await p.waitForSelector('#updNotes:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('in Settings the notes start folded', await p.$eval('#updNotes details', (d) => !d.open).catch(() => false));
  await p.click('#updNotes summary');
  const notes = (await p.textContent('#updNotes').catch(() => '')) || '';
  check('Settings shows what’s new in it', notes.includes('First test update') && notes.includes('99.0.0') && !notes.includes(old + ' ·'), notes.slice(0, 200));
  p.off('framenavigated', onNav);
  await p.click('#doUpd');
  await p.waitForFunction(() => self.WA_VERSION === '99.0.0', null, { timeout: 15000 }).catch(() => {});
  await p.waitForSelector('.settings, .world-card', { timeout: 10000 });
  await p.waitForTimeout(500);
  c = await caches();
  check('Update now: the new version replaces the old cache', c.length === 1 && c[0][0] === 'worldatlas-99.0.0', c.map(([k]) => k));
  check('and brings the changed file with it', c[0][1].includes('CHANGED ON SERVER'));
  check('the page reloaded onto the new version', (await p.evaluate(() => self.WA_VERSION)) === '99.0.0', await p.evaluate(() => self.WA_VERSION));

  // Another update arrives mid-edit: nothing reloads; it's applied when the user chooses, after saving.
  await p.goto(`${URL}#/`); await p.waitForSelector('.world-card');
  await p.click('.world-card');
  await p.waitForSelector('#newArt');
  const wid = await p.evaluate(() => location.hash.split('/')[2]);
  await p.goto(`${URL}#/w/${wid}/new/article?title=Mid-edit`);
  await p.waitForSelector('textarea[name=body]');
  await p.fill('textarea[name=summary]', 'Half written…');
  navigated = false;
  p.on('framenavigated', onNav);
  bump('99.1.0');
  await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await p.waitForSelector('body.update-ready', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  check('mid-edit, the update doesn’t reload the page', !navigated && (await p.inputValue('textarea[name=summary]')) === 'Half written…');
  check('mid-edit, nothing pops up', !(await p.$('#modal-root > *')));
  await p.evaluate(async () => (await import('./js/app.js')).applyUpdate());
  await p.waitForTimeout(1500);
  check('updating while still editing asks to save first', !navigated && (await p.textContent('#toast')).includes('Save or cancel'));
  p.off('framenavigated', onNav);
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  check('the “!” stays after saving, until the user chooses', await p.evaluate(() => document.body.classList.contains('update-ready')));
  await p.click('#sidebar .nav-settings');
  await p.waitForSelector('#doUpd:not([hidden])');
  const notes2 = (await p.textContent('#updNotes').catch(() => '')) || '';
  check('the notes cover only what’s newer than this version', notes2.includes('Second test update') && !notes2.includes('First test update'), notes2.slice(0, 200));
  await p.click('#doUpd');
  await p.waitForFunction(() => self.WA_VERSION === '99.1.0', null, { timeout: 15000 }).catch(() => {});
  await p.waitForSelector('.article, .world-card, .settings', { timeout: 10000 });
  check('then it updates and reloads onto the new version', (await p.evaluate(() => self.WA_VERSION)) === '99.1.0', await p.evaluate(() => self.WA_VERSION));
  check('and the edit was saved', await p.evaluate(async () => { const s = await import('./js/store.js'); return [...s.data.articles.values()].some((a) => a.title === 'Mid-edit' && a.summary === 'Half written…'); }));
});
