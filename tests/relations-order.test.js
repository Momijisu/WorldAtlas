// Ordering relationships: drag (or arrow-key) the grips in the editor; the
// article's list and its family tree follow, incoming ones included. Also [[
// suggestions in infobox fields.
const { run, check, go, store } = require('./lib');

run('relationships: your own order, and [[ in infobox fields', async ({ newPage }) => {
  const p = await newPage();
  await go(p, '#/settings');
  const wid = await p.evaluate(async () => {
    const { planImport, applyImport } = await import('./js/importer.js');
    const plan = planImport({ format: 'worldatlas-import', version: 1, world: { name: 'Lumen' }, articles: [
      { title: 'Ada Wren', type: 'character', relationships: [{ type: 'parent', target: 'Bram' }, { type: 'parent', target: 'Cass' }, { type: 'friend', target: 'Dell' }] },
      { title: 'Bram', type: 'character' }, { title: 'Cass', type: 'character' }, { title: 'Dell', type: 'character' },
      // Stored on Edda's side: shows on Ada as "Parent of Edda".
      { title: 'Edda', type: 'character', relationships: [{ type: 'child', target: 'Ada Wren' }] },
    ] });
    return (await applyImport(plan)).wid;
  });
  const ada = await store(p, (s, w) => s.byTitle(w, 'Ada Wren').id, wid);
  const save = async () => { await p.click('.editor .page-head .btn.primary'); await p.waitForTimeout(800); };
  const shown = () => p.$$eval('.rel-card .rel-name', (l) => l.map((x) => x.textContent));
  const kids = () => p.$$eval('#articleTree [data-id]', (l) => {
    const names = ['Bram', 'Cass', 'Edda'];
    const name = (n) => names.find((x) => n.textContent.includes(x));
    return l.filter(name).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(name);
  });

  await go(p, `#/w/${wid}/a/${ada}`, 800);
  check('by default: in the order they were added (incoming after)', (await shown()).join() === 'Bram,Cass,Edda,Dell', await shown());

  // Editor: Edda to the top with the keyboard, Dell above Bram by dragging.
  await go(p, `#/w/${wid}/a/${ada}/edit`, 800);
  const rows = () => p.$$eval('#rels .rel-row', (l) => l.map((r) => r.querySelector('.apick-q').value));
  check('the editor lists them with grips', (await p.$$('#rels .rel-row [data-grip]')).length === 4);
  const edda = (await rows()).indexOf('Edda');
  await p.focus(`#rels .rel-row:nth-child(${edda + 1}) [data-grip]`);
  for (let i = 0; i < edda; i++) await p.keyboard.press('ArrowUp');
  check('arrow keys move a row', (await rows())[0] === 'Edda', await rows());
  const grip = await (await p.$(`#rels .rel-row:nth-child(${(await rows()).indexOf('Dell') + 1}) [data-grip]`)).boundingBox();
  const target = await (await p.$(`#rels .rel-row:nth-child(${(await rows()).indexOf('Bram') + 1})`)).boundingBox();
  await p.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await p.mouse.down();
  await p.mouse.move(grip.x + grip.width / 2, target.y + 4, { steps: 8 });
  await p.mouse.up();
  check('dragging a grip moves a row', (await rows()).join() === 'Edda,Dell,Bram,Cass', await rows());
  await save();

  const saved = await store(p, (s, id) => ({ order: s.article(id).relOrder, rels: s.article(id).relations.map((r) => r.type) }), ada);
  check('the order is saved with the article; the relationships themselves are unchanged', saved.order?.length === 4 && [...saved.rels].sort().join() === 'friend,parent,parent', saved);
  await go(p, `#/w/${wid}/a/${ada}`, 900);
  check('the article lists them in that order (within each kind)', (await shown()).join() === 'Edda,Bram,Cass,Dell', await shown());
  check('the family tree puts the children in that order', (await kids()).join() === 'Edda,Bram,Cass', await kids());

  // Infobox fields: [[ suggests articles.
  await go(p, `#/w/${wid}/a/${ada}/edit`, 800);
  await p.click('#fv-Residence');
  await p.keyboard.type('[[Br');
  await p.waitForSelector('#fields .ac-pop:not([hidden]) li');
  check('typing [[ in an infobox field suggests articles', (await p.textContent('#fields .ac-pop li')).includes('Bram'));
  await p.keyboard.press('Enter');
  check('choosing one completes the link', (await p.inputValue('#fv-Residence')) === '[[Bram]]', await p.inputValue('#fv-Residence'));
  await save();
  await go(p, `#/w/${wid}/a/${ada}`, 600);
  check('and it shows as a link in the infobox', await p.$eval('.infobox dd a[href*="/a/"]', (x) => x.textContent === 'Bram'));
});
