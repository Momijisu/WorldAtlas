// Tables: building one in the editor (pasting from a spreadsheet, column
// types, a new column), reading it (search, sort, rolling a row, dice cells,
// ticking a checkbox), showing it in another article with ![[Title]], and
// renames, search and backlinks reaching its cells.
const { run, check, openExample, go, store } = require('./lib');

run('tables: build, read, roll, embed', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown') });
  const wid = await openExample(p);

  // The parsers on their own.
  const unit = await p.evaluate(async () => {
    const t = await import('./js/tables.js');
    const csv = t.parseDelimited('a,"b, c",d\n1,"say ""hi""",3\n');
    const rolls = Array.from({ length: 200 }, () => t.rollDice('2d6+1').total);
    return { csv, min: Math.min(...rolls), max: Math.max(...rolls), bad: t.rollDice('hello'), pct: t.rollDice('d%') != null };
  });
  check('CSV with quotes and commas parses', JSON.stringify(unit.csv) === JSON.stringify([['a', 'b, c', 'd'], ['1', 'say "hi"', '3']]), unit.csv);
  check('2d6+1 rolls between 3 and 13', unit.min >= 3 && unit.max <= 13 && unit.max > unit.min, [unit.min, unit.max]);
  check('text that isn’t a roll is refused, d% is a roll', unit.bad === null && unit.pct);

  // Build a table in the editor.
  await go(p, `#/w/${wid}/new/article?title=Road%20Encounters`);
  check('the table editor is hidden for other templates', await p.$eval('#tableSection', (x) => x.hidden));
  await p.selectOption('select[name=type]', 'table');
  check('choosing the Table template shows the table editor', !(await p.$eval('#tableSection', (x) => x.hidden)));
  check('a new table starts with two columns and three rows', (await p.$$('.tbl-grid thead th[data-c]')).length === 2 && (await p.$$('.tbl-grid tbody tr')).length === 3);
  await p.click('[data-paste]');
  await p.fill('#tp textarea[name=text]', 'Encounter\tCount\tChance\nGoblins\t2d4\t3\nWolves\t1d6\t1\nA lost merchant\t1d2\t0');
  await p.click('#tp button.primary');
  await p.waitForTimeout(200);
  const types = await p.$$eval('.tbl-grid .col-type', (s) => s.map((x) => x.value));
  check('pasting fills the table and guesses column types', JSON.stringify(types) === JSON.stringify(['text', 'dice', 'number']), types);
  await p.selectOption('.tbl-grid th[data-c="2"] .col-type', 'chance');
  await p.click('[data-addcol]');
  await p.fill('.tbl-grid th[data-c="3"] .col-name', 'Met');
  await p.selectOption('.tbl-grid th[data-c="3"] .col-type', 'check');
  await p.fill('textarea[name=body]', 'Roll when the party makes camp.');
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);
  const saved = await store(p, (s, w) => s.byTitle(w, 'Road Encounters'), wid);
  check('the table is saved with the article', saved.type === 'table' && saved.table.columns.length === 4 && saved.table.rows.length === 3, saved.table);

  // Read it.
  const heads = await p.$$eval('.wa-table th', (h) => h.map((x) => x.textContent));
  check('the Chance column is used for rolling, not shown', JSON.stringify(heads) === JSON.stringify(['Encounter', 'Count', 'Met']), heads);
  await p.fill('.wa-table-search input', 'wolv');
  const shown = await p.$$eval('.wa-table tbody tr', (r) => r.filter((x) => !x.hidden).map((x) => x.textContent.trim().slice(0, 6)));
  check('searching filters the rows', shown.length === 1 && shown[0].startsWith('Wolves'), shown);
  check('the count says how many match', (await p.textContent('.wa-table-count')) === '1 of 3');
  await p.fill('.wa-table-search input', '');
  await p.click('.wa-table th:has-text("Encounter")');
  await p.click('.wa-table th:has-text("Encounter")');
  check('clicking a heading twice sorts it in reverse', (await p.$eval('.wa-table tbody tr td', (td) => td.textContent)) === 'Wolves');
  let merchant = false, rolled = 0;
  for (let i = 0; i < 25; i++) {
    await p.click('.wa-table [data-roll]');
    const r = await p.$eval('.wa-table tr.rolled td', (td) => td.textContent);
    if (r === 'A lost merchant') merchant = true;
    rolled++;
  }
  check('rolling picks a row each time, never one with a chance of 0', rolled === 25 && !merchant);
  check('the roll says what came up', /Rolled (Goblins|Wolves)/.test(await p.textContent('.wa-roll-result')));
  const goblins = '.wa-table tbody tr:has(td:text-is("Goblins"))';
  await p.click(`${goblins} .dice-btn`);
  const n = +(await p.textContent(`${goblins} .dice-out b`));
  check('a dice cell rolls when clicked', n >= 2 && n <= 8, n);
  await p.check(`${goblins} input[data-check]`);
  await p.waitForTimeout(300);
  const met = await store(p, (s, w) => { const a = s.byTitle(w, 'Road Encounters'); const c = a.table.columns.find((x) => x.name === 'Met'); return a.table.rows.find((r) => Object.values(r.c).includes('Goblins')).c[c.id]; }, wid);
  check('ticking a checkbox on the page saves it', met === true, met);

  // Show it in another article.
  await store(p, (s, w) => s.save('articles', { ...s.newArticle(w, 'article'), title: 'Camp Notes', body: 'Before bed:\n\n![[Road Encounters|What comes in the night]]' }), wid);
  const camp = await store(p, (s, w) => s.byTitle(w, 'Camp Notes').id, wid);
  await go(p, `#/w/${wid}/a/${camp}`);
  check('![[Table]] shows the table in another article', (await p.$$('.prose .wa-table.embedded tbody tr')).length === 3);
  check('with its caption, linking to the table', (await p.textContent('.wa-table-cap a')) === 'What comes in the night');
  await p.click('.wa-table.embedded [data-roll]');
  check('an embedded table rolls too', (await p.$$('.wa-table.embedded tr.rolled')).length === 1);

  // Search, backlinks and renames reach the cells.
  await store(p, async (s, w) => {
    const a = s.byTitle(w, 'Road Encounters');
    const col = { id: 'where', name: 'Where', type: 'article' };
    await s.save('articles', { ...a, table: { ...a.table, columns: [...a.table.columns, col], rows: a.table.rows.map((r, i) => (i ? r : { ...r, c: { ...r.c, where: 'Varenhold' } })) } });
  }, wid);
  const back = await store(p, (s, w) => s.backlinks(s.byTitle(w, 'Varenhold')).map((x) => x.title), wid);
  check('an Article cell counts as a link back', back.includes('Road Encounters'), back);
  check('search finds words in table cells', await store(p, (s, w) => s.articleText(s.byTitle(w, 'Road Encounters')).includes('Goblins'), wid));
  await store(p, (s, w) => s.renameReferences(w, 'Varenhold', 'Varenhold City'), wid);
  const cell = await store(p, (s, w) => s.byTitle(w, 'Road Encounters').table.rows.map((r) => r.c.where).find(Boolean), wid);
  check('renaming an article updates Article cells', cell === 'Varenhold City', cell);
  await store(p, (s, w) => s.renameReferences(w, 'Varenhold City', 'Varenhold'), wid);
  check('the table is part of the article’s history', await store(p, (s, w) => s.historyOf(s.byTitle(w, 'Road Encounters').id)[0].snapshot.table != null, wid));
});
