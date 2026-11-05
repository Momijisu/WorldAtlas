// Tables: Markdown tables in an article's text, with reading tools (sort,
// search, Roll by die or by chance, dice cells, checkboxes that save), the
// editor's Table button, quoting a table elsewhere, and 1.56's Table-template
// articles turning into ordinary tables.
const { run, check, openExample, go, store } = require('./lib');

run('tables: in the text, read, roll, edit', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown') });
  const wid = await openExample(p);

  // The parts on their own.
  const unit = await p.evaluate(async () => {
    const t = await import('./js/tables.js');
    const rolls = Array.from({ length: 200 }, () => t.rollDice('2d6+1').total);
    const md = t.tableToMarkdown({ head: ['Who', 'Note'], align: ['', ''], rows: [['[[Mistfox|A fox]]', 'a | b']] });
    const back = t.parseTable(md.split('\n'));
    return {
      csv: t.parseDelimited('a,"b, c",d\n1,"say ""hi""",3\n'),
      min: Math.min(...rolls), max: Math.max(...rolls), bad: t.rollDice('hello'),
      split: t.splitRow('| [[A|B]] | x \\| y | 3 |'),
      code: t.findTables('```\n| a | b |\n| - | - |\n```\n\n| c | d |\n| --- | --- |\n| 1 | 2 |').map((x) => [x.start, x.end]),
      round: back.rows[0],
    };
  });
  check('CSV with quotes and commas parses', JSON.stringify(unit.csv) === JSON.stringify([['a', 'b, c', 'd'], ['1', 'say "hi"', '3']]), unit.csv);
  check('2d6+1 rolls between 3 and 13; text isn’t a roll', unit.min >= 3 && unit.max <= 13 && unit.bad === null, [unit.min, unit.max]);
  check('a [[link|label]] and an escaped \\| stay in one cell', JSON.stringify(unit.split) === JSON.stringify(['[[A|B]]', 'x \\| y', '3']), unit.split);
  check('tables in code blocks are left alone', JSON.stringify(unit.code) === JSON.stringify([[5, 8]]), unit.code);
  check('a table survives writing and reading back', unit.round[0] === '[[Mistfox|A fox]]' && unit.round[1] === 'a \\| b', unit.round);

  // The example: Vael's d8 road encounters.
  const vael = await store(p, (s, w) => s.byTitle(w, 'Vael').id, wid);
  await go(p, `#/w/${wid}/a/${vael}`);
  check('a Markdown table gets the reading tools', (await p.$$('.prose .wa-table[data-die="d8"] tbody tr')).length === 6);
  check('a first column named after a die rolls that die', (await p.textContent('.wa-table [data-roll]')).trim() === 'Roll d8');
  check('longer tables get a search box', !!(await p.$('.wa-table-search input')));
  check('a [[link|label]] in a cell works', (await p.textContent('.wa-table tbody tr:nth-child(4) td:nth-child(2) a')) === 'A mistfox');
  let fits = true;
  for (let i = 0; i < 20; i++) {
    await p.click('.wa-table [data-roll]');
    const [n, lo, hi] = await p.evaluate(() => { const r = document.querySelector('.wa-table tr.rolled'); return [+/Rolled (\d+)/.exec(document.querySelector('.wa-roll-result').textContent)[1], +r.dataset.lo, +r.dataset.hi]; });
    if (n < lo || n > hi) fits = false;
  }
  check('the rolled number lands on the row whose range holds it', fits);
  await p.fill('.wa-table-search input', 'guild');
  check('searching narrows the rows', (await p.textContent('.wa-table-count')) === '1 of 6');

  // Build a table with the editor's Table button.
  await go(p, `#/w/${wid}/new/article?title=Camp%20Notes`);
  await p.fill('textarea[name=body]', '## Night\nBefore bed:');
  await p.$eval('textarea[name=body]', (t) => t.setSelectionRange(t.value.length, t.value.length));
  await p.click('#tableBtn');
  await p.waitForSelector('#tblF');
  check('a new table starts with two columns and three rows', (await p.$$('#tblF .col-name')).length === 2 && (await p.$$('#tblF tbody tr')).length === 3);
  await p.click('#tblF [data-paste]');
  await p.fill('#tp textarea[name=text]', 'Encounter\tCount\tChance\tMet\nGoblins\t2d4\t3\t[ ]\nWolves\t1d6\t1\t[ ]\nA lost merchant\t1d2\t0\t[ ]');
  await p.click('#tp button.primary');
  await p.click('#tblF button.primary');
  await p.waitForTimeout(200);
  let body = await p.$eval('textarea[name=body]', (t) => t.value);
  check('the table is written into the text as Markdown', /Before bed:\n\n\| Encounter +\| Count +\| Chance \| Met +\|\n\| -+ \|/.test(body) && body.includes('| Goblins '), body);
  // Edit it again: the cursor is in the table.
  await p.$eval('textarea[name=body]', (t) => { const i = t.value.indexOf('Wolves'); t.setSelectionRange(i, i); });
  await p.click('#tableBtn');
  await p.waitForSelector('#tblF');
  check('the Table button opens the table the cursor is in', (await p.$eval('#tblF tbody tr:nth-child(2) .cell', (x) => x.value)) === 'Wolves');
  await p.fill('#tblF tbody tr:nth-child(2) .cell', 'Grey wolves');
  await p.click('#tblF button.primary');
  await p.waitForTimeout(200);
  body = await p.$eval('textarea[name=body]', (t) => t.value);
  check('editing replaces the table in place', body.includes('| Grey wolves ') && !body.includes('| Wolves ') && (body.match(/\| Encounter/g) || []).length === 1, body);
  await p.click('button:has-text("Save")');
  await p.waitForTimeout(700);

  // Read it.
  const shown = await p.$$eval('.wa-table th', (h) => h.filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.textContent));
  check('a Chance column is used for rolling and hidden', JSON.stringify(shown) === JSON.stringify(['Encounter', 'Count', 'Met']), shown);
  check('short tables have no search box', !(await p.$('.wa-table-search')));
  let merchant = false;
  for (let i = 0; i < 25; i++) {
    await p.click('.wa-table [data-roll]');
    if ((await p.$eval('.wa-table tr.rolled td', (td) => td.textContent)) === 'A lost merchant') merchant = true;
  }
  check('rolling never picks a row with a chance of 0', !merchant);
  await p.click('.wa-table th:has-text("Encounter")');
  await p.click('.wa-table th:has-text("Encounter")');
  check('clicking a heading twice sorts it in reverse', (await p.$eval('.wa-table tbody tr td', (td) => td.textContent)) === 'Grey wolves');
  const goblins = '.wa-table tbody tr:has(td:text-is("Goblins"))';
  await p.click(`${goblins} .dice-btn`);
  const n = +(await p.textContent(`${goblins} .dice-out b`));
  check('a dice cell rolls when clicked', n >= 2 && n <= 8, n);
  await p.check(`${goblins} input[data-check]`);
  await p.waitForTimeout(300);
  body = await store(p, (s, w) => s.byTitle(w, 'Camp Notes').body, wid);
  check('ticking a box saves [x] into that row of the text, even when sorted', /\| Goblins .*\| \[x\] \|/.test(body) && /\| Grey wolves .*\| \[ \] \|/.test(body), body);

  // Quoted in another article.
  await store(p, (s, w) => s.save('articles', { ...s.newArticle(w, 'article'), title: 'Watch Rota', body: '![[Camp Notes#Night]]' }), wid);
  await go(p, `#/w/${wid}/a/${await store(p, (s, w) => s.byTitle(w, 'Watch Rota').id, wid)}`);
  check('a quoted section brings its table, with its tools', (await p.$$('.excerpt .wa-table tbody tr')).length === 3 && !!(await p.$('.excerpt .wa-table [data-roll]')));
  await p.click('.excerpt .wa-table tbody tr:has(td:text-is("Grey wolves")) input[data-check]');
  await p.waitForTimeout(300);
  check('a quoted table can’t be ticked (only on its own page)', !(await p.$eval('.excerpt .wa-table tbody tr:has(td:text-is("Grey wolves")) input[data-check]', (x) => x.checked)));

  // 1.56 Table-template articles become ordinary articles with a table in their text.
  const conv = await p.evaluate(async (w) => {
    const s = await import('./js/store.js');
    const t = await import('./js/tables.js');
    const cols = [{ id: 'a', name: 'Item', type: 'text' }, { id: 'b', name: 'Found at', type: 'article' }, { id: 'c', name: 'Got it', type: 'check' }, { id: 'd', name: 'Odds', type: 'chance' }];
    await s.save('articles', { ...s.newArticle(w, 'article'), type: 'table', title: 'Old Loot', body: 'Loot.', table: { columns: cols, rows: [{ id: 'r', c: { a: 'Rope', b: 'Varenhold', c: true, d: '2' } }] } });
    await t.convertLegacyTables();
    return s.byTitle(w, 'Old Loot');
  }, wid);
  check('a 1.56 table article becomes an ordinary article', conv.type === 'article' && conv.table == null, conv);
  check('its table is written into its text, links, ticks and chance kept', /^Loot\.\n\n\| Item +\| Found at +\| Got it \| Chance \|/.test(conv.body) && /\| Rope +\| \[\[Varenhold\]\] \| \[x\] +\| +2 +\|/.test(conv.body), conv.body);
});
