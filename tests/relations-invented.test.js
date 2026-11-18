// "Inventor of" / "Invented by": a relationship type pair, from the editor's
// list and from an import (with its plain-English names).
const { run, check, go, store } = require('./lib');

run('relationships: inventor of / invented by', async ({ newPage }) => {
  const p = await newPage();
  await go(p, '#/settings');
  const wid = await p.evaluate(async () => {
    const { planImport, applyImport } = await import('./js/importer.js');
    const plan = planImport({ format: 'worldatlas-import', version: 1, world: { name: 'Lumen' }, articles: [
      { title: 'Ada Wren', type: 'character' },
      { title: 'Lantern Engine', type: 'technology', relationships: [{ type: 'invented by', target: 'Ada Wren' }] },
      { title: 'Glass Lamp', type: 'item', relationships: [{ type: 'Invented by', target: 'Ada Wren' }] },
      { title: 'Sky Loom', type: 'technology', relationships: [{ type: 'inventedBy', target: 'Ada Wren' }] },
    ] });
    return (await applyImport(plan)).wid;
  });
  const rels = await store(p, (s, w) => s.articlesOf(w).flatMap((a) => (a.relations || []).map((r) => r.type)), wid);
  check('“invented by”, its label and its key all read as inventedBy', rels.length === 3 && rels.every((t) => t === 'inventedBy'), rels);

  const ada = await store(p, (s, w) => s.byTitle(w, 'Ada Wren').id, wid);
  await go(p, `#/w/${wid}/a/${ada}`, 600);
  const cards = await p.$$eval('.rel-card', (l) => l.map((c) => c.querySelector('.rel-kind').textContent + ' ' + c.querySelector('.rel-name').textContent));
  check('the inventor’s page lists what they invented', cards.filter((c) => c.startsWith('Inventor of')).length === 3, cards);

  const engine = await store(p, (s, w) => s.byTitle(w, 'Lantern Engine').id, wid);
  await go(p, `#/w/${wid}/a/${engine}`, 600);
  const eCards = await p.$$eval('.rel-card', (l) => l.map((c) => c.querySelector('.rel-kind').textContent + ' ' + c.querySelector('.rel-name').textContent));
  check('the invention’s page names its inventor', eCards.includes('Invented by Ada Wren'), eCards);

  // Offered in the editor's relationship types.
  await go(p, `#/w/${wid}/a/${engine}/edit`, 800);
  const opts = await p.$$eval('select option', (l) => l.map((o) => o.textContent.trim()));
  check('the editor offers both', opts.includes('Inventor of') && opts.includes('Invented by'), opts.filter((o) => /by|of/.test(o)).slice(0, 40));
});
