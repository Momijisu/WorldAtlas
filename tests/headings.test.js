// "###Heading" with no space after the marks is a heading too: in articles,
// the contents box, excerpts and section links, and the Live editor. A single
// "#tag" stays text, and code blocks are left alone.
const { run, check, openExample, go, store } = require('./lib');

run('editor: headings without a space', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'live') });
  const wid = await openExample(p);
  const body = 'The university is split into 5 colleges.\n\nScholars can then choose a specialty track.\n\n###Education\nAssociate -> Instructor -> Professor\n\n###Archivist\nArchivist -> Master\n\n#royalty is a tag, not a heading\n\n```\n##not a heading in code\n```';
  const id = await store(p, async (s, a) => { const r = { ...s.newArticle(a.w, 'article'), title: 'Structure Test', body: a.body }; await s.save('articles', r); return r.id; }, { w: wid, body });
  await go(p, `#/w/${wid}/a/${id}`, 800);
  const hs = await p.$$eval('.prose :is(h1,h2,h3)', (l) => l.map((x) => x.tagName + ':' + x.textContent));
  check('"###Education" renders as a heading', JSON.stringify(hs) === JSON.stringify(['H3:Education', 'H3:Archivist']), hs);
  check('"#royalty" stays text, code stays code', (await p.textContent('.prose')).includes('#royalty is a tag') && (await p.textContent('pre')).includes('##not a heading'));
  check('the contents box lists them', JSON.stringify(await p.$$eval('#toc li a', (l) => l.map((x) => x.textContent))) === JSON.stringify(['Education', 'Archivist']), await p.$$eval('#toc li a', (l) => l.map((x) => x.textContent)));
  // section links and excerpts find them
  const other = await store(p, async (s, a) => { const r = { ...s.newArticle(a.w, 'article'), title: 'Uses It', body: '![[Structure Test#Education]]' }; await s.save('articles', r); return r.id; }, { w: wid });
  await go(p, `#/w/${wid}/a/${other}`, 800);
  check('an excerpt of that section works', (await p.textContent('.excerpt')).includes('Associate -> Instructor'));
  // the Live editor shows it as a heading
  await go(p, `#/w/${wid}/a/${id}/edit`, 1200);
  const cm = await p.$$eval('.cm-line', (l) => l.filter((x) => /cm-h\d/.test(x.className)).map((x) => x.className.match(/cm-h\d/)[0] + ':' + x.textContent));
  check('the Live editor styles them as headings (marks hidden)', JSON.stringify(cm) === JSON.stringify(['cm-h3:Education', 'cm-h3:Archivist']), cm);
  // heading button on "###Education" changes its level cleanly
  await p.click('.cm-line:has-text("Education")'); await p.click('[data-md="h2"]'); await p.waitForTimeout(150);
  check('the H2 button turns "###Education" into "## Education"', (await p.$eval('textarea[name=body]', (t) => t.value)).includes('\n## Education\n'));
});
