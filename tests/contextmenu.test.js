// The app's right-click menu in place of the browser's.
const { run, check, openExample, go, store, center } = require('./lib');

run('right-click menu', async ({ newPage }) => {
  const p = await newPage({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 900 } });
  const wid = await openExample(p);
  const items = () => p.$$eval('.ctx-menu button', (l) => l.map((x) => x.querySelector('span').textContent + (x.disabled ? ' (off)' : '')));
  const clip = () => p.evaluate(() => navigator.clipboard.readText());

  await p.mouse.click(900, 300, { button: 'right' });
  await p.waitForTimeout(150);
  check('on the page: Back and Forward', JSON.stringify(await items()) === JSON.stringify(['Back', 'Forward (off)']), await items());
  await p.keyboard.press('Escape');
  check('Escape closes it', !(await p.$('.ctx-menu')));

  const [lx, ly] = await center(p, '.prose a.wikilink');
  await p.mouse.click(lx, ly, { button: 'right' });
  await p.waitForTimeout(150);
  check('on a link: Open in new tab and Copy link', (await items()).slice(0, 2).join() === 'Open in new tab,Copy link');
  await p.click('.ctx-menu button:has-text("Copy link")');
  await p.waitForTimeout(150);
  check('Copy link copies the full address', (await clip()).startsWith('http') && (await clip()).includes('/a/'));

  const vid = await store(p, (s, w) => s.byTitle(w, 'Varenhold').id, wid);
  await go(p, `#/w/${wid}/a/${vid}`);
  await p.evaluate(() => { const t = document.querySelector('.prose p').firstChild; const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 9); getSelection().removeAllRanges(); getSelection().addRange(r); });
  const pb = await (await p.$('.prose p')).boundingBox();
  await p.mouse.click(pb.x + 10, pb.y + 8, { button: 'right' });
  await p.waitForTimeout(150);
  check('on selected text: Copy and Search', (await items())[0] === 'Copy' && (await items())[1].startsWith('Search for “Varenhold'));
  await p.click('.ctx-menu button:has-text("Copy")');
  await p.waitForTimeout(150);
  check('Copy copies the selection', (await clip()) === 'Varenhold');

  // A text field, right-clicked over the icon drawn on its edge.
  await p.fill('#searchInput', 'hello world');
  await p.focus('#searchInput');
  const sb = await (await p.$('#searchInput')).boundingBox();
  await p.evaluate(() => document.querySelector('#searchInput').setSelectionRange(0, 5));
  await p.mouse.click(sb.x + 20, sb.y + sb.height / 2, { button: 'right' });
  await p.waitForTimeout(150);
  check('in a field: Cut, Copy, Paste, Select all', (await items()).slice(0, 4).map((x) => x.replace(' (off)', '')).join() === 'Cut,Copy,Paste,Select all', await items());
  await p.evaluate(() => document.querySelector('#searchInput').setSelectionRange(0, 5));
  await p.click('.ctx-menu button:has-text("Cut")');
  await p.waitForTimeout(150);
  check('Cut removes the selection and copies it', (await p.inputValue('#searchInput')) === ' world' && (await clip()) === 'hello');
  await p.mouse.click(sb.x + 20, sb.y + sb.height / 2, { button: 'right' });
  await p.evaluate(() => { const i = document.querySelector('#searchInput'); i.setSelectionRange(i.value.length, i.value.length); });
  await p.click('.ctx-menu button:has-text("Paste")');
  await p.waitForTimeout(200);
  check('Paste inserts the clipboard', (await p.inputValue('#searchInput')) === ' worldhello');

  const prevented = await p.evaluate(() => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, shiftKey: true, clientX: 50, clientY: 50 }); document.body.dispatchEvent(ev); return ev.defaultPrevented; });
  check('Shift + right-click is left to the browser', !prevented && !(await p.$('.ctx-menu')));
});
