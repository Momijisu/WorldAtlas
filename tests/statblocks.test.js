// Statblocks: written as a ```statblock block in an article's text, drawn as
// a statblock (modifiers worked out, saves, sections with [[links]], rolls
// that roll), and added or changed with the editor's Statblock button.
const { run, check, openExample, go, store } = require('./lib');

run('statblocks: write, read, roll, edit', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown') });
  const wid = await openExample(p);

  // The example: the Mistfox.
  await go(p, `#/w/${wid}/a/${await store(p, (s, w) => s.byTitle(w, 'Mistfox').id, wid)}`);
  check('a statblock in the text is drawn as a statblock', !!(await p.$('.prose .statblock')) && (await p.textContent('.statblock .sb-name')) === 'Mistfox');
  const dex = await p.$$eval('.statblock .sb-ab tbody tr', (r) => r.map((x) => [...x.children].map((c) => c.textContent)).find((c) => c[0] === 'DEX'));
  check('modifiers are worked out, and a listed save wins', JSON.stringify(dex) === JSON.stringify(['DEX', '16', '+3', '+5']), dex);
  const str = await p.$$eval('.statblock .sb-ab tbody tr', (r) => r.map((x) => [...x.children].map((c) => c.textContent)).find((c) => c[0] === 'STR'));
  check('negative modifiers use a proper minus', str[2] === '−2' && str[3] === '−2', str);
  check('the ability tables don’t get table tools', !(await p.$('.statblock .wa-table')));
  check('sections are drawn with their titles', JSON.stringify(await p.$$eval('.statblock .sb-h', (h) => h.map((x) => x.textContent))) === JSON.stringify(['Traits', 'Actions']));
  await p.click('.statblock .sb-dice[data-dice="1d4 + 3"]');
  const n = +(await p.textContent('.statblock .sb-roll b'));
  check('a roll in the text rolls when clicked', n >= 4 && n <= 7, n);
  check('statblock headings stay out of the contents list', !(await p.$$eval('#toc li', (l) => l.map((x) => x.textContent))).includes('Traits'));

  // A link to an article with a statblock previews its stats.
  await go(p, `#/w/${wid}/a/${await store(p, (s, w) => s.byTitle(w, 'Vael').id, wid)}`);
  const fox = p.locator('.wa-table a.wikilink', { hasText: 'A mistfox' });
  await fox.scrollIntoViewIfNeeded(); await fox.hover(); await p.waitForTimeout(700);
  const prev = await p.$eval('.link-preview.on', (c) => ({ top: c.querySelector('.lp-stats-top')?.textContent, ab: c.querySelectorAll('.lp-stats-ab span').length, text: c.querySelector('p')?.textContent || '' })).catch(() => null);
  check('a link preview shows the statblock in brief', prev && /AC\s*13/.test(prev.top) && /HP\s*10/.test(prev.top) && prev.ab === 6, prev);
  check('and its text isn’t the statblock’s raw lines', prev && !/ac:|str:/.test(prev.text), prev?.text);
  await p.mouse.move(5, 5);

  // Add one with the Statblock button.
  await go(p, `#/w/${wid}/new/article?title=Blighted%20Boar`);
  await p.fill('textarea[name=body]', 'A boar gone wrong in the [[Gloamwood]].');
  await p.$eval('textarea[name=body]', (t) => t.setSelectionRange(t.value.length, t.value.length));
  await p.click('#statblockBtn');
  await p.waitForSelector('#sbF');
  await p.fill('#sbF input[name=name]', 'Blighted Boar');
  await p.fill('#sbF input[name=ac]', '11');
  await p.fill('#sbF input[name=str]', '14');
  check('the form shows modifiers as you type', (await p.textContent('#sbF [data-mod="str"]')) === '+2');
  await p.fill('#sbF .sb-ed-sec:nth-child(2) .sb-sec-body', '***Gore.*** *Hit:* 4 (1d6 + 1) Piercing damage, [[Gloamwood]] style.');
  await p.click('#sbF button.primary');
  await p.waitForTimeout(200);
  let body = await p.$eval('textarea[name=body]', (t) => t.value);
  check('the statblock is written into the text', /Gloamwood\]\]\.\n\n```statblock\nname: Blighted Boar\n/.test(body) && body.includes('str: 14 | dex: 10') && body.includes('## Actions\n***Gore.***') && body.trimEnd().endsWith('```'), body);
  // Edit it: the cursor is in it.
  await p.$eval('textarea[name=body]', (t) => { const i = t.value.indexOf('ac: 11'); t.setSelectionRange(i, i); });
  await p.click('#statblockBtn');
  await p.waitForSelector('#sbF');
  check('the button opens the statblock the cursor is in', (await p.inputValue('#sbF input[name=ac]')) === '11');
  await p.fill('#sbF input[name=ac]', '12');
  await p.click('#sbF button.primary');
  await p.waitForTimeout(200);
  body = await p.$eval('textarea[name=body]', (t) => t.value);
  check('editing replaces it in place', body.includes('ac: 12') && !body.includes('ac: 11') && (body.match(/```statblock/g) || []).length === 1, body);
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  check('it shows on the saved article', (await p.textContent('.statblock .sb-name')) === 'Blighted Boar');
  check('a [[link]] in a section counts as a link back', await store(p, (s, w) => s.backlinks(s.byTitle(w, 'Gloamwood')).some((a) => a.title === 'Blighted Boar'), wid));
});
