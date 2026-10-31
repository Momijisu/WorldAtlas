// Every main page of the example world opens without errors.
const { run, check, openExample, go, store } = require('./lib');

run('smoke: pages open', async ({ newPage }) => {
  const p = await newPage();
  const wid = await openExample(p);
  check('first visit lands on the worlds list, then the example opens', !!wid);
  const art = await store(p, (s, w) => s.byTitle(w, 'Varenhold').id, wid);
  const map = await store(p, (s, w) => s.mapsOf(w)[0].id, wid);
  const pages = {
    overview: `#/w/${wid}`, list: `#/w/${wid}/t/all`, characters: `#/w/${wid}/t/character`, article: `#/w/${wid}/a/${art}`,
    editor: `#/w/${wid}/a/${art}/edit`, history: `#/w/${wid}/a/${art}/history`, maps: `#/w/${wid}/maps`, map: `#/w/${wid}/m/${map}`,
    graph: `#/w/${wid}/graph`, timeline: `#/w/${wid}/timeline`, calendar: `#/w/${wid}/calendar`, prompts: `#/w/${wid}/prompts`,
    search: `#/w/${wid}/search?q=lantern`, settings: '#/settings',
  };
  for (const [name, hash] of Object.entries(pages)) {
    await go(p, hash, 700);
    const text = await p.evaluate(() => document.querySelector('#view, main, body').innerText);
    check(`${name} renders`, text.length > 40 && !/Not found/.test(await p.evaluate(() => document.querySelector('.toast')?.textContent || '')));
  }
});
