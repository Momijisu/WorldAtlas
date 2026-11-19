// "Deputy of" / "Has deputy": from imports (and plain-English names), on the
// article, in the organisation's Deputy field, and as a row under the leaders
// in its chart, where deputies can be added and moved.
const { run, check, go, store } = require('./lib');

run('relationships: deputies', async ({ newPage }) => {
  const p = await newPage();
  await go(p, '#/settings');
  const wid = await p.evaluate(async () => {
    const { planImport, applyImport } = await import('./js/importer.js');
    const plan = planImport({ format: 'worldatlas-import', version: 1, world: { name: 'Lumen' }, articles: [
      { title: 'The Lamplighters', type: 'organization' },
      { title: 'Ada Wren', type: 'character', relationships: [{ type: 'leader', target: 'The Lamplighters' }] },
      { title: 'Cole Marsh', type: 'character', relationships: [{ type: 'second in command', target: 'The Lamplighters' }] },
      { title: 'Dell Finch', type: 'character', relationships: [{ type: 'sub-leader', target: 'The Lamplighters' }, { type: 'member', target: 'The Lamplighters' }] },
      { title: 'Edda Holm', type: 'character', relationships: [{ type: 'member', target: 'The Lamplighters' }] },
    ] });
    return (await applyImport(plan)).wid;
  });
  const types = await store(p, (s, w) => s.articlesOf(w).flatMap((a) => (a.relations || []).map((r) => r.type)), wid);
  check('“second in command” and “sub-leader” read as deputy', types.filter((t) => t === 'deputy').length === 2, types);

  const org = await store(p, (s, w) => s.byTitle(w, 'The Lamplighters').id, wid);
  await go(p, `#/w/${wid}/a/${org}`, 900);
  const cards = await p.$$eval('.rel-card', (l) => l.map((c) => `${c.querySelector('.rel-kind').textContent} ${c.querySelector('.rel-name').textContent}`));
  check('the organisation lists its deputies', cards.includes('Has deputy Cole Marsh') && cards.includes('Has deputy Dell Finch'), cards);
  const dep = await p.evaluate(() => { const dt = [...document.querySelectorAll('.infobox dt')].find((x) => x.textContent === 'Deputy'); return dt?.nextElementSibling.textContent.trim(); });
  check('its Deputy field fills in from them', dep === 'Cole Marsh, Dell Finch', dep);

  // The chart: leaders, then deputies, then members (a deputy isn't repeated as a member).
  const rows = await p.$$eval('#articleTree .org-leaders', (l) => l.map((r) => [...r.querySelectorAll('[data-id]')].map((n) => n.textContent.trim())));
  check('the chart has a leaders row, then a deputies row', rows.length === 2 && rows[0].some((t) => t.includes('Ada Wren')) && rows[1].length === 2 && rows[1].every((t) => t.includes('Deputy')), rows);
  const members = await p.$eval('#articleTree .org-members', (x) => x.textContent);
  check('a deputy who is also a member is shown once, as deputy', members.includes('Edda Holm') && !members.includes('Dell Finch'), members);

  // Full view, editing: add a deputy, and make a member a deputy.
  await go(p, `#/w/${wid}/tree/${org}`, 900);
  await p.click('#treeEdit, [data-edit-chart], button:has-text("Edit")');
  await p.waitForSelector('[data-add="deputy"]');
  await p.click('[data-add="deputy"]');
  await p.fill('#chartAdd [name="q"]', 'Fen Rook');
  await p.click('#chartAdd .btn.primary');
  await p.waitForTimeout(600);
  const fen = await store(p, (s, [w, o]) => { const f = s.byTitle(w, 'Fen Rook'); return (s.article(o).relations || []).some((r) => r.type === 'hasDeputy' && r.target === f?.id); }, [wid, org]);
  check('“+ Deputy” adds one', fen);
  await p.click('[data-person] >> text=Edda Holm');
  await p.waitForSelector('#chartPerson');
  await p.selectOption('#chartPerson [name="as"]', 'deputy');
  await p.click('#chartPerson .btn.primary');
  await p.waitForTimeout(600);
  const edda = await store(p, (s, w) => {
    const e = s.byTitle(w, 'Edda Holm'), o = s.byTitle(w, 'The Lamplighters');
    const all = [...(e.relations || []).map((r) => r.type + '>' + r.target), ...(o.relations || []).map((r) => r.type + '<' + r.target)];
    return all.filter((x) => x.includes(o.id) || x.includes(e.id));
  }, wid);
  check('a member can be made a deputy', edda.some((x) => x.startsWith('hasDeputy<')) && !edda.some((x) => x.startsWith('member>') || x.startsWith('hasMember<')), edda);
});
