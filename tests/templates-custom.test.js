// Templates of your own, from the New article window: a custom template
// (details, infobox fields that fill from relationships, an outline with
// prompts), changes to a built-in template's fields and outline, adding an
// outline to an older article, imports naming a custom template, and deleting.
const { run, check, openExample, go, store } = require('./lib');

run('templates: custom ones, built-in changes and outlines', async ({ newPage }) => {
  const p = await newPage();
  const wid = await openExample(p);
  const world = () => store(p, (s, w) => s.world(w), wid);
  const openNew = async () => { await go(p, `#/w/${wid}`, 500); await p.click('#newArt'); await p.waitForSelector('.type-choice'); };
  const tab = async (name) => { await p.click(`.tpl-tabs [data-tab="${name}"]`); await p.waitForTimeout(100); };

  // ---- a new template, from the New article window
  await openNew();
  check('the New article window offers New template', (await p.$$('#modal-root [data-new-tpl]')).length === 2);
  check('each template has an edit pencil', (await p.$$('#modal-root [data-edit-tpl]')).length > 20);
  await p.click('#modal-root .tpl-head [data-new-tpl]');
  await p.waitForSelector('#tplF [name="label"]');
  check('a new template starts on Details, in the Other category', (await p.$eval('.tpl-tabs .on', (b) => b.dataset.tab)) === 'details' && (await p.inputValue('#tplF [name="group"]')) === 'other');
  await p.fill('#tplF [name="label"]', 'Noble House');
  await p.selectOption('#tplF [name="group"]', 'groups');
  await p.selectOption('#tplF [name="base"]', 'organization');
  await p.click('#tplF [data-icon="crown"]');
  await p.fill('#tplF [name="hint"]', 'A ruling family.');

  await tab('infobox');
  await p.fill('.tpl-field .tf-name', 'Seat');
  await p.selectOption('.tpl-field .tf-fill', 'locatedIn');
  await p.click('.tpl-sec [data-add-field]');
  await p.fill('.tpl-field:last-child .tf-name', 'Head of house');
  await p.selectOption('.tpl-field:last-child .tf-fill', 'ledBy');
  check('the preview shows the fields and what fills them', (await p.textContent('.tpl-preview')).includes('Head of house') && (await p.textContent('.tpl-preview')).includes('from “Led by”'));

  await tab('outline');
  await p.click('[data-add-ol="2"]');
  await p.fill('.ol-row:last-child .ol-text', 'Lineage');
  await p.fill('.ol-row:last-child .ol-prompt', 'Who rules, and who comes next?');
  await p.click('[data-add-ol="3"]');
  await p.fill('.ol-row:last-child .ol-text', 'Heir');
  await p.click('[data-add-ol="2"]');
  await p.fill('.ol-row:last-child .ol-text', 'Holdings');
  check('the preview shows the outline, with its prompt', await p.$eval('.ol-preview', (x) => !!x.querySelector('h2') && !!x.querySelector('h3') && x.querySelector('.md-prompt')?.textContent === 'Who rules, and who comes next?'));
  check('the tabs count fields and headings', (await p.textContent('.tpl-tabs')).includes('2 fields') && (await p.textContent('.tpl-tabs')).includes('3 headings'));
  // Drag Holdings above Heir? Arrow keys: move Holdings up once (under Lineage).
  await p.focus('.ol-row:last-child [data-grip]');
  await p.keyboard.press('ArrowUp');
  check('arrow keys reorder the outline', (await p.$$eval('.ol-row .ol-text', (l) => l.map((x) => x.value))).join() === 'Lineage,Holdings,Heir');
  await p.keyboard.press('ArrowDown');
  await p.click('#tplF .actions .btn.primary');
  await p.waitForTimeout(800);

  const w1 = await world();
  const [id, d] = Object.entries(w1.templates || {}).find(([, x]) => x.custom) || [];
  check('the template is saved with the world', d?.label === 'Noble House' && d.plural === 'Noble Houses' && d.base === 'organization' && d.group === 'groups' && d.icon === 'crown', d);
  check('with its fields and what fills them', JSON.stringify(d?.sections) === JSON.stringify([{ name: 'Overview', fields: ['Seat', 'Head of house'] }]) && d.fill?.Seat === 'locatedIn' && d.fill['Head of house'] === 'ledBy', d);
  check('and its outline', d?.outline === '## Lineage\n> [!prompt] Who rules, and who comes next?\n\n### Heir\n\n## Holdings', d?.outline);
  check('creating a template starts its first article', (await p.evaluate(() => location.hash)).endsWith(`/new/${id}`));
  await p.waitForSelector('textarea[name="body"]', { state: 'attached' });
  const body0 = await p.$eval('textarea[name="body"]', (x) => x.value);
  check('which begins with the outline, prompts included while writing', body0.startsWith('## Lineage\n> [!prompt] Who rules'), body0);
  check('its infobox has the template’s fields', !!(await p.$('#fv-Seat')) && !!(await p.$('#fv-Head\\ of\\ house')));
  await p.fill('[name="title"]', 'House Ardent');
  await p.click('.editor .page-head .btn.primary');
  await p.waitForTimeout(900);
  const house = await store(p, (s, w) => s.byTitle(w, 'House Ardent'), wid);
  check('saved, the article keeps the headings and drops the prompt', house.type === id && house.body.includes('## Lineage') && house.body.includes('### Heir') && !house.body.includes('[!prompt]'), house.body);
  check('the sidebar lists the new template', (await p.$$eval('#sidebar nav a', (l) => l.map((a) => a.textContent.trim()))).some((t) => t.startsWith('Noble Houses')));

  // It works like an Organization: a leader fills Head of house and gives it a chart.
  await store(p, async (s, [w, hid]) => { const q = s.byTitle(w, 'Queen Ysolde'); await s.save('articles', { ...q, relations: [...q.relations, { id: 'r-house', type: 'leader', target: hid, note: '' }] }); }, [wid, house.id]);
  await go(p, `#/w/${wid}`, 300);
  await go(p, `#/w/${wid}/a/${house.id}`, 900);
  const head = await p.evaluate(() => { const dt = [...document.querySelectorAll('.infobox dt')].find((x) => x.textContent === 'Head of house'); return dt?.nextElementSibling.textContent.trim(); });
  check('a field set to fill from “Led by” shows the leader', head === 'Queen Ysolde', head);
  check('based on Organization, it gets an organisation chart', !!(await p.$('#articleTree .org-chart')));

  // ---- a built-in template: Character's fields and outline
  await openNew();
  await p.hover('.type-choice >> text=Character');
  await p.click('[data-edit-tpl="character"]');
  await p.waitForSelector('#tplF .tpl-secs');
  check('a built-in template opens on its infobox, with no Details tab', !(await p.$('.tpl-tabs [data-tab="details"]')) && (await p.$eval('.tpl-tabs .on', (b) => b.dataset.tab)) === 'infobox');
  const occ = await p.$$eval('.tpl-field .tf-name', (l) => l.findIndex((x) => x.value === 'Occupation'));
  await p.fill(`.tpl-field:has(.tf-name[value="Occupation"]) .tf-name`, 'Calling');
  check('found Occupation to rename', occ >= 0);
  await tab('outline');
  await p.click('[data-ol-mode]');
  await p.fill('.ol-src', '## Appearance\n> [!prompt] What would a stranger notice first?\n\n## History\n\n> [!note] Rumours\n> Fill these in later.');
  await p.click('#tplF .actions .btn.primary');
  await p.waitForTimeout(900);
  const w2 = await world();
  check('only what changed is kept for a built-in template', w2.templates.character && w2.templates.character.outline.startsWith('## Appearance') && w2.templates.character.sections?.[2]?.fields.includes('Calling') && !w2.templates.character.label, w2.templates.character);
  const ys = await store(p, (s, w) => s.byTitle(w, 'Queen Ysolde').fields, wid);
  check('a renamed field keeps its values on existing articles', ys.Calling === 'Queen of Vael' && !('Occupation' in ys), ys);
  check('closing the editor goes back to the New article window', !!(await p.$('#modal-root .type-choice')));
  await p.keyboard.press('Escape');

  // A new character starts with the outline (callouts and all); an older one can add it.
  await go(p, `#/w/${wid}/new/character`, 800);
  const nb = await p.$eval('textarea[name="body"]', (x) => x.value);
  check('a new Character starts with its outline', nb.startsWith('## Appearance\n> [!prompt]') && nb.includes('> [!note] Rumours'), nb);
  const aldric = await store(p, (s, w) => s.byTitle(w, 'King Aldric').id, wid);
  await go(p, `#/w/${wid}/a/${aldric}/edit`, 800);
  await p.evaluate(() => { const g = document.querySelector('#guide'); if (g) g.open = true; });
  check('an older Character is offered the outline', (await p.textContent('.guide-outline')).includes('Add the character outline'));
  await p.click('.guide-outline [data-outline]');
  const ab = await p.$eval('textarea[name="body"]', (x) => x.value);
  check('adding it puts the missing headings at the end', ab.includes('## Appearance') && ab.includes('## History') && ab.indexOf('## Appearance') > 10, ab.slice(-200));
  check('and the offer goes once they’re all there', (await p.textContent('.guide-outline')).trim() === '');
  await p.click('.editor .page-head .btn.primary');
  await p.waitForTimeout(800);
  check('saved', (await store(p, (s, w) => s.byTitle(w, 'King Aldric').body, wid)).includes('## Appearance'));

  // ---- imports can name a custom template
  const imported = await p.evaluate(async (w) => {
    const { planImport, applyImport } = await import('./js/importer.js');
    const plan = planImport({ format: 'worldatlas-import', version: 1, articles: [{ title: 'House Vane', type: 'Noble House' }, { title: 'House Moss', type: 'noble houses' }] }, w);
    await applyImport(plan);
    const s = await import('./js/store.js');
    return [s.byTitle(w, 'House Vane')?.type, s.byTitle(w, 'House Moss')?.type, s.byTitle(w, 'House Vane')?.body];
  }, wid);
  check('an import can use a custom template by name or plural', imported[0] === id && imported[1] === id, imported);
  check('imported articles don’t get the outline', imported[2] === '', imported[2]);

  // ---- deleting a template in use moves its articles
  await openNew();
  await p.click(`[data-edit-tpl="${id}"]`);
  await p.waitForSelector('#tplF [data-del]');
  await p.click('#tplF [data-del]');
  await p.waitForSelector('#tplDel');
  check('deleting asks where its articles go, suggesting what it was based on', (await p.inputValue('#tplDel [name="to"]')) === 'organization');
  await p.click('#tplDel .btn.danger');
  await p.waitForTimeout(900);
  const after = await store(p, (s, [w, t]) => ({ left: s.articlesOf(w).filter((a) => a.type === t).length, moved: s.byTitle(w, 'House Ardent').type, def: s.world(w).templates?.[t] }), [wid, id]);
  check('the template is gone and its articles moved', !after.def && after.left === 0 && after.moved === 'organization', after);
  check('the sidebar no longer lists it', !(await p.$$eval('#sidebar nav a', (l) => l.map((a) => a.textContent.trim()))).some((t) => t.startsWith('Noble Houses')));
});
