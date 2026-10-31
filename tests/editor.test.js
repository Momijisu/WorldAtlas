// The editor toolbar in both modes (Markdown and Live): heading buttons set a
// line's level (replacing an existing one) and toggle off at the same level.
const { run, check, openExample, go, store } = require('./lib');
run('editor: heading buttons', async ({ newPage }) => {
  for (const mode of ['markdown', 'live']) {
    const p = await newPage({ init: (m) => localStorage.setItem('wa.editMode', m) });
    await p.addInitScript((m) => localStorage.setItem('wa.editMode', m), mode);
    const wid = await openExample(p);
    const id = await store(p, async (s, w) => { const a = { ...s.newArticle(w, 'article'), title: 'Btn Test ' + Math.random(), body: 'Intro.\n\n## Section\nText.' }; await s.save('articles', a); return a.id; }, wid);
    await go(p, `#/w/${wid}/a/${id}/edit`, 1200);
    const putCaret = async () => {
      if (mode === 'markdown') await p.evaluate(() => { const t = document.querySelector('textarea[name=body]'); const i = t.value.indexOf('Section'); t.focus(); t.setSelectionRange(i + 2, i + 2); });
      else { await p.click('.cm-line:has-text("Section")'); }
    };
    const body = () => p.$eval('textarea[name=body]', (t) => t.value.split('\n')[2]);
    await putCaret(); await p.click('[data-md="h3"]'); await p.waitForTimeout(150);
    const a1 = await body();
    await putCaret(); await p.click('[data-md="h3"]'); await p.waitForTimeout(150);
    const a2 = await body();
    await putCaret(); await p.click('[data-md="h2"]'); await p.waitForTimeout(150);
    const a3 = await body();
    check(`${mode}: H3 on a ## line makes it ###`, a1 === '### Section', a1);
    check(`${mode}: H3 again turns the heading off`, a2 === 'Section', a2);
    check(`${mode}: H2 on a plain line makes it ##`, a3 === '## Section', a3);
  }
});
