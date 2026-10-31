// Trees on article pages and full-page: a family tree for people, an
// organisation chart (part of, leaders, sub-organisations, members) for organisations.
const { run, check, openExample, go, store } = require('./lib');
run('trees: family and organisation', async ({ newPage }) => {
  const p = await newPage({ viewport: { width: 1400, height: 1000 } });
  const wid = await openExample(p);
  // A richer organisation: part of a bigger order, two leaders, two chapters (one with its own leader), many members.
  const ids = await store(p, async (s, w) => {
    const mk = async (title, type, extra = {}) => { const a = { id: crypto.randomUUID(), worldId: w, title, type, ...extra }; await s.save('articles', a); return a; };
    const guild = s.byTitle(w, 'Lantern Guild');
    const order = await mk('The Ember Concord', 'organization', { summary: 'A league of guilds across the five kingdoms.' });
    const ch1 = await mk('Tallowmarket Chapter', 'organization', { parentId: guild.id });
    const ch2 = await mk('Drowns Watch', 'organization', { parentId: guild.id });
    const sera = await mk('Sera Vane', 'character');
    const ped = await mk('Pedric Hollis', 'character');
    const names = ['Anwen Brask', 'Corin Mire', 'Dagny Holt', 'Ewan Tallis', 'Fenna Roe', 'Gil Marsh', 'Hester Pike', 'Ivo Crane', 'Jessa Wren', 'Kell Ashby'];
    const mem = []; for (const n of names) mem.push(await mk(n, 'character'));
    const rel = (type, target) => ({ id: crypto.randomUUID(), type, target });
    await s.save('articles', { ...s.article(guild.id), relations: [...(guild.relations || []), rel('member', order.id), { ...rel('ledBy', sera.id), note: 'Guildmaster' }, rel('hasMember', ped.id), ...mem.map((m) => rel('hasMember', m.id))] });
    await s.save('articles', { ...s.article(ch1.id), relations: [rel('ledBy', ped.id)] });
    return { guild: guild.id, ysolde: s.byTitle(w, 'Queen Ysolde').id };
  }, wid);
  await go(p, `#/w/${wid}/a/${ids.guild}`, 900);
  await p.$eval('#articleTree', (x) => x.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  check('organisation section shown', (await p.$$eval('.section-head h2', (l) => l.map((x) => x.textContent))).includes('Organisation'));
  await go(p, `#/w/${wid}/tree/${ids.guild}`, 900);
  const chart = await p.$$eval('#treeStage .org-node', (l) => l.map((x) => x.querySelector('.tn-rel')?.textContent + ':' + (x.querySelector('.tn-title')?.textContent || '')));
  check('the chart shows the parent, the guild, both leaders and both chapters', ['Part of:The Ember Concord', 'Guildmaster:Sera Vane', 'Leader:Mother Wick', 'Leader:Pedric Hollis'].every((x) => chart.includes(x)) && chart.some((x) => x.endsWith('Tallowmarket Chapter')) && chart.some((x) => x.endsWith('Drowns Watch')), chart);
  check('members are listed with a count', (await p.$eval('.org-members .tn-rel', (x) => x.textContent)) === '11 members' && (await p.$$('.org-more a')).length === 8);
  check('a relationship note shows as the role, and someone shown under a chapter isn’t repeated', !(await p.$$eval('.org-more a', (l) => l.some((x) => x.textContent.includes('Pedric')))));
  await p.click('#treeStage [data-id] >> text=Tallowmarket Chapter');
  await p.waitForTimeout(500);
  check('clicking another organisation shows its chart', (await p.evaluate(() => location.hash)).includes('/tree/') && (await p.textContent('h1')).includes('Tallowmarket'));
  await go(p, `#/w/${wid}/a/${ids.ysolde}`, 900);
  await p.$eval('#articleTree', (x) => x.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  check('family tree section shown', (await p.$$eval('.section-head h2', (l) => l.map((x) => x.textContent))).includes('Family tree'));
  // page scroll still works over an embedded tree; ctrl+wheel zooms
  const before = await p.evaluate(() => scrollY);
  const bb = await (await p.$('#articleTree')).boundingBox();
  await p.mouse.move(bb.x + 200, bb.y + 100); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
  check('plain scroll over the tree scrolls the page', (await p.evaluate(() => scrollY)) > before);
  const tf0 = await p.$eval('#articleTree .viz-stage', (x) => x.style.transform);
  const tb = await (await p.$('#articleTree')).boundingBox();
  await p.mouse.move(tb.x + 200, tb.y + 100);
  await p.keyboard.down('Control'); await p.mouse.wheel(0, -300); await p.keyboard.up('Control'); await p.waitForTimeout(200);
  check('Ctrl + scroll zooms the tree', (await p.$eval('#articleTree .viz-stage', (x) => x.style.transform)) !== tf0);
  await p.click('#articleTree [data-id] >> text=Prince Corin');
  await p.waitForTimeout(500);
  check('clicking a person in an embedded tree opens their article', (await p.textContent('h1')) === 'Prince Corin');
});
