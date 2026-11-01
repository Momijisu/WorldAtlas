// Possible duplicates: finding near-identical names, marking pairs as not
// duplicates, merging one article into another (text, details, names, links,
// relationships, sub-articles, map places, prompts), and the editor's
// "similar to" note.
const { run, check, openExample, go, store } = require('./lib');

const SHOTS = process.env.WA_SHOTS;

run('duplicates: find and merge', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown'), viewport: { width: 1300, height: 1000 } });
  const wid = await openExample(p);
  // A second write-up of the Lantern Guild, plus a typo'd character and a lookalike that isn't a duplicate.
  const ids = await store(p, async (s, w) => {
    const guild = s.byTitle(w, 'Lantern Guild'), wick = s.byTitle(w, 'Mother Wick'), varen = s.byTitle(w, 'Varenhold');
    const mk = async (x) => { const a = { ...s.newArticle(w, x.type || 'article'), ...x }; await s.save('articles', a); return a; };
    const dup = await mk({ title: 'The Lantern Guild', type: 'organization', summary: '', body: 'They meet at midnight under the old bell.', gmNotes: 'Their founder still lives.',
      tags: ['secret'], fields: { Type: 'Guild', Motto: 'Different motto', Colours: 'Black and gold' },
      relations: [{ id: crypto.randomUUID(), type: 'ledBy', target: wick.id, note: '' }, { id: crypto.randomUUID(), type: 'rival', target: s.byTitle(w, 'Queen Ysolde').id, note: 'old grudge' }] });
    const child = await mk({ title: 'Bell Tower Cell', type: 'organization', parentId: dup.id });
    const linker = await mk({ title: 'Rumours', body: 'Everyone fears [[The Lantern Guild]].', relations: [{ id: crypto.randomUUID(), type: 'ally', target: dup.id, note: '' }] });
    await mk({ title: 'Mother Wik', type: 'character' });
    await mk({ title: 'Varenholm', type: 'settlement', summary: 'A different town entirely.' });
    const m = s.mapsOf(w)[0]; await s.save('maps', { ...m, pins: [...m.pins, { id: 'dpin', x: .5, y: .5, articleId: dup.id }] });
    const wd = s.world(w); await s.save('worlds', { ...wd, prompts: { ...(wd.prompts || {}), answered: { ...(wd.prompts?.answered || {}), 'p:test': [dup.id] } } });
    return { guild: guild.id, dup: dup.id, child: child.id, linker: linker.id, wick: wick.id, varen: varen.id, map: m.id };
  }, wid);

  await go(p, `#/w/${wid}/t/all`, 700);
  check('All articles says there are possible duplicates', /3 pairs of articles may be duplicates/.test(await p.textContent('.dup-banner')), await p.textContent('.dup-banner'));
  await p.click('.dup-banner'); await p.waitForTimeout(500);
  const pairs = await p.$$eval('.dup-pair', (l) => l.map((x) => [x.querySelector('.dup-how').textContent, ...[...x.querySelectorAll('.dup-title')].map((t) => t.textContent)].join(' | ')));
  check('it finds the same name with “The”, and names a letter apart', pairs.includes('Same name | Lantern Guild | The Lantern Guild') && pairs.some((x) => x.includes('Mother Wick') && x.includes('Mother Wik')) && pairs.some((x) => x.includes('Varenholm')), pairs);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/dup-page.png`, clip: { x: 250, y: 60, width: 1050, height: 640 } });

  // Not duplicates: remembered.
  await p.click('.dup-pair:has(.dup-title:text-is("Varenholm")) [data-not]'); await p.waitForTimeout(300);
  check('“Not duplicates” removes the pair and stays removed', !(await p.$('.dup-title:text-is("Varenholm")')));

  // Merge The Lantern Guild into Lantern Guild.
  await p.click(`[data-keep="${ids.guild}"][data-drop="${ids.dup}"]`); await p.waitForTimeout(300);
  const plan = await p.$$eval('.merge-plan li', (l) => l.map((x) => x.textContent));
  check('the merge says what will happen', plan.length >= 6 && plan[0].includes('becomes another name'), plan);
  if (SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: `${SHOTS}/dup-merge.png`, clip: { x: 330, y: 180, width: 640, height: 470 } }); }
  await p.click('.modal [data-go]'); await p.waitForTimeout(600);
  const g = await store(p, (s, i) => s.article(i), ids.guild);
  check('its name becomes another name of the kept article', g.aliases.includes('The Lantern Guild'));
  check('its text and secrets are added under a heading', g.body.includes('## From “The Lantern Guild”\n\nThey meet at midnight') && g.gmNotes.includes('Their founder still lives.'));
  check('empty details are filled, differing ones kept as extras', g.fields.Colours === 'Black and gold' && g.fields['Motto (from The Lantern Guild)'] === 'Different motto' && g.fields.Type === 'Guild');
  check('tags are combined', g.tags.includes('secret'));
  check('its relationships move over (without duplicating one already there)', g.relations.some((r) => r.type === 'rival' && r.note === 'old grudge') && g.relations.filter((r) => r.type === 'ledBy' && r.target === ids.wick).length <= 1);
  check('relationships pointing at it now point at the kept article', (await store(p, (s, i) => s.article(i).relations[0].target, ids.linker)) === ids.guild);
  check('its sub-articles are filed under the kept article', (await store(p, (s, i) => s.article(i).parentId, ids.child)) === ids.guild);
  check('map places point at the kept article', (await store(p, (s, i) => s.map(i).pins.find((x) => x.id === 'dpin').articleId, ids.map)) === ids.guild);
  check('answered prompts point at the kept article', JSON.stringify(await store(p, (s, w) => s.world(w).prompts.answered['p:test'], wid)) === JSON.stringify([ids.guild]));
  check('the merged-away article is in Recently deleted', !(await store(p, (s, i) => s.article(i), ids.dup)) && (await store(p, (s, a) => s.deletedArticles(a.w).some((d) => d.tomb.id === a.d), { w: wid, d: ids.dup })));
  await go(p, `#/w/${wid}/a/${ids.linker}`, 600);
  check('old links to its name still lead to the kept article', (await p.$eval('.prose a.wikilink', (a) => a.getAttribute('href'))).endsWith(`/a/${ids.guild}`));
  await go(p, `#/w/${wid}/duplicates`, 500);
  check('the merged pair is gone from the list', !(await p.$('.dup-title:text-is("The Lantern Guild")')));

  // The editor warns when a new title looks like an existing article.
  await go(p, `#/w/${wid}/new/character?title=${encodeURIComponent('Queen Ysold')}`, 900);
  check('a new article with a similar title gets a heads-up', (await p.textContent('#similarNote')).includes('Similar to Queen Ysolde'));
  if (SHOTS) { const b = await (await p.$('#similarNote')).boundingBox(); await p.screenshot({ path: `${SHOTS}/dup-similar.png`, clip: { x: b.x - 15, y: b.y - 75, width: 680, height: 120 } }); }
  await p.fill('input[name=title]', 'Brand New Name'); await p.waitForTimeout(100);
  check('…and none for a new name', await p.$eval('#similarNote', (x) => x.hidden));
});
