// Articles: writing in the editor, [[links]], [[Title#Section]] links,
// ![[excerpts]], and "Already covered" on writing prompts.
const { run, check, openExample, go, store } = require('./lib');

run('articles: links, excerpts, prompts', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown') });
  const wid = await openExample(p);
  const ids = await store(p, (s, w) => ({ v: s.byTitle(w, 'Varenhold').id, g: s.byTitle(w, 'Lantern Guild').id }), wid);

  // Write an article in the editor and save it.
  await go(p, `#/w/${wid}/new/article?title=Test%20Notes`);
  await p.fill('textarea[name=body]', 'See [[Varenhold#Districts]].\n\n![[Varenhold#Districts|Where]]\n\n![[Night of Falling Lanterns]]\n\n![[Varenhold#Nowhere]]\n\n```\n![[Varenhold]]\n```');
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  check('saving opens the new article', /\/a\//.test(await p.evaluate(() => location.hash)));
  const link = await p.$eval('.prose a.wikilink', (a) => [a.textContent, a.getAttribute('href')]);
  check('[[Title#Section]] links to the heading', link[0] === 'Varenhold › Districts' && link[1].endsWith('?s=Districts'), link);
  check('excerpts render (section and summary)', (await p.$$('.excerpt:not(.missing)')).length === 2);
  check('a missing section is flagged', (await p.$$('.excerpt.missing')).length === 1);
  check('code blocks are left alone', (await p.$eval('pre', (x) => x.textContent)).includes('![[Varenhold]]'));
  await p.click('.prose p a.wikilink');
  await p.waitForTimeout(500);
  const top = await p.evaluate(() => [...document.querySelectorAll('.prose h2')].find((h) => h.textContent === 'Districts').getBoundingClientRect().top);
  check('a section link scrolls to the heading', top < 200, top);
  check('the excerpt counts as a link back ("Mentioned in")', await p.$$eval('.rows .row-title', (l) => l.some((x) => x.textContent === 'Test Notes')));

  // Renaming keeps section links.
  await store(p, (s, w) => s.renameReferences(w, 'Varenhold', 'Varenhold City'), wid);
  const body = await store(p, (s, w) => s.byTitle(w, 'Test Notes').body, wid);
  check('renaming updates [[Old#Section]] links', body.startsWith('See [[Varenhold City#Districts]]'), body.slice(0, 40));
  await store(p, (s, w) => s.renameReferences(w, 'Varenhold City', 'Varenhold'), wid);

  // Prompts: mark one as already covered by an existing article, then reopen it.
  await go(p, `#/w/${wid}/prompts`);
  const before = await p.$eval('#plist li', (li) => li.dataset.key);
  await p.click('#plist li [data-covered]');
  await p.waitForSelector('#covList .row-link');
  await p.fill('#covQ', 'lantern guild');
  await p.waitForTimeout(150);
  await p.click('#covList .row-link');
  await p.waitForTimeout(400);
  const answered = await store(p, (s, a) => s.world(a.w).prompts.answered[a.k], { w: wid, k: before });
  check('"Already covered" links the prompt to the article', JSON.stringify(answered) === JSON.stringify([ids.g]), answered);
  await go(p, `#/w/${wid}/a/${ids.g}`);
  check('the article shows the prompt it answers', await p.$$eval('.prompt-callout .eyebrow', (l) => l.some((x) => x.textContent === 'Answers the prompt')));
  await go(p, `#/w/${wid}/prompts`);
  await p.click('#status [data-s=answered]');
  await p.click(`#plist li[data-key="${before}"] [data-reopen]`);
  await p.waitForTimeout(300);
  check('an answered prompt can be reopened', !(await store(p, (s, a) => s.world(a.w).prompts.answered[a.k], { w: wid, k: before })));
});
