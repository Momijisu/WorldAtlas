// Callouts (> [!type] Title, folding with - / +) in articles, the editor's
// Callout menu and the Live editor; and aliases ("Also known as"): links,
// suggestions, backlinks, search, clashes and import.
const { run, check, openExample, go, store } = require('./lib');

const SHOTS = process.env.WA_SHOTS; // a folder to save preview screenshots in, if set

run('callouts and aliases', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown'), viewport: { width: 1300, height: 950 } });
  const wid = await openExample(p);
  const ids = await store(p, (s, w) => ({ ysolde: s.byTitle(w, 'Queen Ysolde').id, varen: s.byTitle(w, 'Varenhold').id }), wid);

  // ---- callouts in an article
  const body = [
    'The Drowns flood twice a year.',
    '',
    '> [!warning] Beware the bridge',
    '> It floods at high tide. Ask the [[Lantern Guild]] for a lamp.',
    '',
    '> [!tip]',
    '> Bribes work better than threats:',
    '> - coin for the watch',
    '> - lamp oil for the guild',
    '',
    '> [!note]- What the players don’t know',
    '> The ferryman is a Guild informant.',
    '',
    '> [!caution] An unknown type is shown as its nearest kind',
    '> (caution shows as danger)',
    '',
    '> A plain quote stays a quote.',
  ].join('\n');
  const art = await store(p, async (s, a) => { const r = { ...s.newArticle(a.w, 'location'), title: 'The Drowns', body: a.body }; await s.save('articles', r); return r.id; }, { w: wid, body });
  await go(p, `#/w/${wid}/a/${art}`, 800);
  const callouts = await p.$$eval('.prose .callout', (l) => l.map((c) => [c.className.replace('callout ', ''), c.querySelector('.callout-title').textContent.trim(), c.tagName, c.open ?? null]));
  check('callouts render with their kind and title', JSON.stringify(callouts.map((c) => c.slice(0, 2))) === JSON.stringify([['callout-warning', 'Beware the bridge'], ['callout-tip', 'Tip'], ['callout-note', 'What the players don’t know'], ['callout-danger', 'An unknown type is shown as its nearest kind']]), callouts);
  check('[!note]- starts folded', callouts[2][2] === 'DETAILS' && callouts[2][3] === false);
  check('links and lists work inside a callout', !!(await p.$('.callout-warning a.wikilink')) && (await p.$$('.callout-tip li')).length === 2);
  check('a plain quote stays a quote', (await p.$$('.prose > blockquote')).length === 1);
  if (SHOTS) {
    await p.$eval('.prose', (x) => x.scrollIntoView());
    await p.screenshot({ path: `${SHOTS}/callouts-dark.png`, clip: { x: 250, y: 0, width: 700, height: 900 } });
    await p.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${SHOTS}/callouts-light.png`, clip: { x: 250, y: 0, width: 700, height: 900 } });
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  }

  // ---- the Callout menu wraps the chosen lines
  await go(p, `#/w/${wid}/a/${art}/edit`, 900);
  await p.evaluate(() => { const t = document.querySelector('textarea[name=body]'); t.focus(); t.setSelectionRange(0, t.value.indexOf('\n')); });
  await p.click('#calloutBtn');
  check('the Callout menu lists the kinds', (await p.$$eval('#calloutMenu [data-callout]', (l) => l.map((b) => b.dataset.callout))).join() === 'note,info,tip,important,warning,danger,quote');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/callout-menu.png`, clip: { x: 250, y: 380, width: 800, height: 420 } });
  await p.click('[data-callout="info"]');
  check('choosing one wraps the line', (await p.$eval('textarea[name=body]', (t) => t.value)).startsWith('> [!info]\n> The Drowns flood twice a year.'));
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(500);

  // ---- the Live editor shows callout lines in their colour, the mark hidden off the cursor line
  await p.evaluate(() => localStorage.setItem('wa.editMode', 'live'));
  await go(p, `#/w/${wid}/a/${art}`, 300);
  await go(p, `#/w/${wid}/a/${art}/edit`, 1200);
  const lines = await p.$$eval('.cm-line.cm-callout', (l) => l.map((x) => [x.className.match(/cm-callout-(\w+)/g).join(' '), x.textContent]));
  check('Live editor marks callout lines', lines.some(([c, t]) => c.includes('cm-callout-warning') && t === 'Beware the bridge'), lines);
  await p.evaluate(() => localStorage.setItem('wa.editMode', 'markdown'));

  // ---- aliases
  await go(p, `#/w/${wid}/a/${ids.ysolde}/edit`, 900);
  await p.fill('input[name=aliases]', 'The Iron Queen, Ysolde Ardent, Queen Ysolde');
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(600);
  const ys = await store(p, (s, i) => s.article(i).aliases, ids.ysolde);
  check('aliases save (the title itself is dropped)', JSON.stringify(ys) === JSON.stringify(['The Iron Queen', 'Ysolde Ardent']), ys);
  check('the article shows them', (await p.textContent('.aka')) === 'Also known as The Iron Queen, Ysolde Ardent');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/aliases-article.png`, clip: { x: 250, y: 0, width: 1050, height: 330 } });

  // a link to an alias goes to the article; suggestions show it; backlinks and search count it
  const linker = await store(p, async (s, w) => { const r = { ...s.newArticle(w, 'article'), title: 'Court Gossip', body: 'Nobody crosses [[The Iron Queen]].' }; await s.save('articles', r); return r.id; }, wid);
  await go(p, `#/w/${wid}/a/${linker}`, 600);
  check('[[Alias]] links to the article', (await p.$eval('.prose a.wikilink', (a) => a.getAttribute('href'))).endsWith(`/a/${ids.ysolde}`));
  await go(p, `#/w/${wid}/a/${ids.ysolde}`, 600);
  check('a link to an alias counts as a backlink', await p.$$eval('.rows .row-title', (l) => l.some((x) => x.textContent === 'Court Gossip')));
  await go(p, `#/w/${wid}/search?q=iron%20queen`, 600);
  check('search finds the article by its alias', await p.$$eval('.rows .row-title', (l) => l.some((x) => x.textContent === 'Queen Ysolde')));
  await go(p, `#/w/${wid}/a/${linker}/edit`, 900);
  await p.evaluate(() => { const t = document.querySelector('textarea[name=body]'); t.focus(); t.value += '\n\n[[iron'; t.setSelectionRange(t.value.length, t.value.length); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(200);
  check('[[ suggestions include aliases, pointing to the article', (await p.$$eval('.ac-pop li', (l) => l.map((x) => x.textContent.trim()))).some((x) => x === 'The Iron Queen → Queen Ysolde'));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/aliases-suggest.png`, clip: { x: 250, y: 400, width: 800, height: 380 } });

  // an alias can't be another article's name (leaving the half-typed link above: discard it)
  await go(p, `#/w/${wid}/a/${ids.ysolde}/edit`, 400);
  await p.click('#modal-root button:has-text("Discard")');
  await p.waitForTimeout(700);
  await p.fill('input[name=aliases]', 'The Iron Queen, Varenhold');
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(300);
  check('an alias that is another article’s title is refused', (await p.textContent('#toast')).includes('“Varenhold” already leads to Varenhold'));

  // import carries aliases
  const added = await p.evaluate(async () => {
    const im = await import('./js/importer.js'); const s = await import('./js/store.js');
    const w = s.worlds().find((x) => x.name !== '');
    const plan = im.planImport({ format: 'worldatlas-import', version: 1, articles: [{ title: 'Duke Varn', type: 'character', aliases: ['The Iron Duke'] }] }, location.hash.split('/')[2]);
    await im.applyImport(plan);
    return s.byName(location.hash.split('/')[2], 'the iron duke')?.title;
  });
  check('imported aliases work', added === 'Duke Varn');
});
