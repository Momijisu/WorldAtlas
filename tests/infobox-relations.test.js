// Infobox fields a relationship answers: an organization's empty Leader shows
// who leads it (set from either side), linked; a typed value wins; the editor
// shows it as the field's placeholder.
const { run, check, go, store } = require('./lib');

run('infobox: fields filled from relationships', async ({ newPage }) => {
  const p = await newPage();
  await go(p, '#/settings');
  const wid = await p.evaluate(async () => {
    const { planImport, applyImport } = await import('./js/importer.js');
    const plan = planImport({ format: 'worldatlas-import', version: 1, world: { name: 'Lumen' }, articles: [
      { title: 'Ada Wren', type: 'character', relationships: [{ type: 'leader', target: 'The Lamplighters' }, { type: 'member', target: 'The Lamplighters' }] },
      { title: 'Cole Marsh', type: 'character', relationships: [{ type: 'leader', target: 'The Lamplighters' }] },
      { title: 'The Lamplighters', type: 'organization', relationships: [{ type: 'locatedIn', target: 'Brightwater' }] },
      { title: 'Lantern Engine', type: 'technology', fields: { Inventor: 'Unknown' }, relationships: [{ type: 'inventedBy', target: 'Ada Wren' }] },
      // "Leader of" a town (rather than "Rules"), set on the person.
      { title: 'Brightwater', type: 'settlement' },
      { title: 'Fen Rook', type: 'character', fields: { 'Leader of': '' }, relationships: [{ type: 'leader of', target: 'Brightwater' }] },
    ] });
    return (await applyImport(plan)).wid;
  });
  const open = async (title) => { const id = await store(p, (s, [w, t]) => s.byTitle(w, t).id, [wid, title]); await go(p, `#/w/${wid}/a/${id}`, 600); return id; };
  const field = (name) => p.evaluate((n) => { const dt = [...document.querySelectorAll('.infobox dt')].find((x) => x.textContent === n); const dd = dt?.nextElementSibling; return dd ? { text: dd.textContent.trim(), links: dd.querySelectorAll('a').length, auto: dd.classList.contains('from-rel') } : null; }, name);

  const org = await open('The Lamplighters');
  const leader = await field('Leader');
  check('an organization’s Leader shows its leaders, from their side of the relationship', leader?.text === 'Ada Wren, Cole Marsh' && leader.links === 2 && leader.auto, leader);
  check('Members shows its members', (await field('Members'))?.text === 'Ada Wren');
  const hq = await field('Headquarters');
  check('a place it’s in fills Headquarters, even before that article exists', hq?.text === 'Brightwater', hq);

  await open('Brightwater');
  check('“Leader of” a town fills its Ruler', (await field('Ruler'))?.text === 'Fen Rook');
  const fenId = await open('Fen Rook');
  const lo = await field('Leader of');
  check('a field you added, named after a relationship (“Leader of”), fills from it', lo?.text === 'Brightwater' && lo.auto, lo);
  await go(p, `#/w/${wid}/a/${fenId}/edit`, 800);
  check('and the editor says so in it', (await p.$$eval('#fields .kv:not(.tpl) .v', (l) => l.map((x) => x.placeholder))).includes('From relationships: Brightwater'));
  await open('Ada Wren');
  check('a leader’s own Affiliation shows what they lead', (await field('Affiliation'))?.text === 'The Lamplighters', await field('Affiliation'));

  await open('Lantern Engine');
  const inv = await field('Inventor');
  check('a value typed into the field wins', inv?.text === 'Unknown' && !inv.auto, inv);

  await go(p, `#/w/${wid}/a/${org}/edit`, 800);
  check('the editor shows it as the empty field’s placeholder', (await p.getAttribute('#fv-Leader', 'placeholder')) === 'From relationships: Ada Wren, Cole Marsh' && (await p.inputValue('#fv-Leader')) === '');
  check('nothing is stored in the field', !(await store(p, (s, id) => s.article(id).fields?.Leader, org)));
});
