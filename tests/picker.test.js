// Article pickers in the editor (Part of, and each relationship): type to
// search titles and other names, pick with the mouse or keyboard, or create a
// new article; leaving the field keeps a valid choice.
const { run, check, openExample, go, store } = require('./lib');

const SHOTS = process.env.WA_SHOTS;

run('editor: article pickers', async ({ newPage }) => {
  const p = await newPage({ init: () => localStorage.setItem('wa.editMode', 'markdown'), viewport: { width: 1300, height: 950 } });
  const wid = await openExample(p);
  const ids = await store(p, async (s, w) => {
    const y = s.byTitle(w, 'Queen Ysolde'); await s.save('articles', { ...y, aliases: ['The Iron Queen'] });
    return { ysolde: y.id, varen: s.byTitle(w, 'Varenhold').id, guild: s.byTitle(w, 'Lantern Guild').id, corin: s.byTitle(w, 'Prince Corin').id };
  }, wid);
  await go(p, `#/w/${wid}/a/${ids.corin}/edit`, 900);
  const parent = '.apick:has(input[name=parentId]) .apick-q';
  const list = (sel) => p.$$eval(`${sel} ~ .apick-list li`, (l) => l.map((x) => x.querySelector('span').textContent.trim()));

  // Part of: type, see matches (including by another name), pick with the mouse.
  await p.click(parent); await p.keyboard.type('varen', { delay: 20 });
  check('typing lists matching articles', (await list(parent))[0] === 'Varenhold', await list(parent));
  if (SHOTS) { const b = await (await p.$(parent)).boundingBox(); await p.screenshot({ path: `${SHOTS}/picker-search.png`, clip: { x: b.x - 15, y: b.y - 40, width: b.width + 30, height: 210 } }); }
  await p.click(`${parent} ~ .apick-list li:first-child`);
  check('picking sets the article', (await p.$eval('input[name=parentId]', (x) => x.value)) === ids.varen && (await p.inputValue(parent)) === 'Varenhold');

  // A relationship: find someone by an alias, choose with the keyboard.
  await p.click('#addRel');
  const rel = '.rel-row:last-child .apick-q';
  await p.keyboard.type('iron q', { delay: 20 });
  check('other names are found too', (await list(rel))[0].startsWith('Queen Ysolde'), await list(rel));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  check('arrow keys and Enter pick it (and don’t submit the form)', (await p.$eval('.rel-row:last-child input.rtarget', (x) => x.value)) === ids.ysolde && /\/edit/.test(await p.evaluate(() => location.hash)));

  // Nothing matches: offer to create it, as the template the relationship suggests.
  await p.click('#addRel');
  await p.selectOption('.rel-row:last-child .rt', 'member');
  await p.click(rel); await p.keyboard.type('Order of the Wick', { delay: 15 });
  const items = await list(rel);
  check('no match offers to create it', items.at(-1) === 'Create “Order of the Wick”', items);
  if (SHOTS) { const b = await (await p.$(rel)).boundingBox(); await p.screenshot({ path: `${SHOTS}/picker-create.png`, clip: { x: b.x - 15, y: b.y - 90, width: b.width + 30, height: 200 } }); }
  await p.click(`${rel} ~ .apick-list li.apick-new`);
  await p.waitForSelector('.apick-create');
  check('the new article defaults to the suggested template (Member of → Organization)', (await p.$eval('.apick-create select[name=type]', (x) => x.value)) === 'organization');
  if (SHOTS) { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOTS}/picker-create-dialog.png`, clip: { x: 350, y: 200, width: 600, height: 380 } }); }
  await p.click('.apick-create .btn.primary'); await p.waitForTimeout(300);
  const made = await store(p, (s, w) => s.byTitle(w, 'Order of the Wick'), wid);
  check('it is created and picked', made?.type === 'organization' && (await p.$eval('.rel-row:last-child input.rtarget', (x) => x.value)) === made.id);

  // Leaving with half-typed text goes back to the chosen article; clearing means none.
  await p.click(parent); await p.keyboard.press('Control+A'); await p.keyboard.type('Varenh');
  await p.click('input[name=title]'); await p.waitForTimeout(250);
  check('leaving with a partial name keeps the chosen article', (await p.inputValue(parent)) === 'Varenhold' && (await p.$eval('input[name=parentId]', (x) => x.value)) === ids.varen);
  await p.click(parent); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace');
  await p.click('input[name=title]'); await p.waitForTimeout(250);
  check('clearing the field means none', (await p.$eval('input[name=parentId]', (x) => x.value)) === '');
  await p.click(parent); await p.keyboard.type('Lantern Guild'); await p.click('input[name=title]'); await p.waitForTimeout(250);
  check('typing an exact name and leaving picks it', (await p.$eval('input[name=parentId]', (x) => x.value)) === ids.guild);

  // Save: everything lands.
  await p.click('button:has-text("Save")'); await p.waitForTimeout(600);
  const corin = await store(p, (s, i) => s.article(i), ids.corin);
  check('saved: parent and relationships', corin.parentId === ids.guild && corin.relations.some((r) => r.target === ids.ysolde) && corin.relations.some((r) => r.type === 'member' && r.target === made.id), corin.relations);
});
