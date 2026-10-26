// A small sample world so new users can see how things fit together:
// linked articles, a custom calendar, a family, rivalries and a timeline.
import { uid } from './util.js';
import { presetCalendar } from './calendar.js';

export async function exampleWorld(store) {
  const wid = uid();
  const calendar = presetCalendar('even');
  calendar.eras = [
    { name: 'The Skyward Age', abbr: 'SkA', start: -900, restart: false },
    { name: 'After the Falling', abbr: 'AF', start: 0, restart: false },
  ];
  calendar.moons = [{ name: 'Selune', cycle: 30, offset: 3, color: '#d9cfb8' }, { name: 'Vey', cycle: 45, offset: 20, color: '#c4553b' }];
  calendar.currentYear = 1043;
  await store.save('worlds', {
    id: wid, name: 'Aerthal', image: null, calendar,
    description: 'A shattered continent where the flying cities of the old **Skyward Empire** fell from the sky, and five kingdoms now squabble over the ruins. Start at [[Varenhold]] or meet [[Queen Ysolde]].',
  });
  const A = (type, title, rest = {}) => ({ ...store.newArticle(wid, type), title, ...rest });
  const varenhold = A('location', 'Varenhold', {
    summary: 'The rain-slick capital of the Kingdom of Vael, built on the bones of a Skyward citadel.',
    body: '## Overview\nVarenhold climbs a granite spur above the [[River Ost]]. Its upper city still floats a few feet off the ground: the last working Skyward engine.\n\n## Districts\n- **The Lift**: noble estates on the floating stone\n- **Tallowmarket**: candlemakers, smugglers and the [[Lantern Guild]]\n- **The Drowns**: flood-prone docks\n\n> "Nothing in Varenhold is level, least of all its people." (a traveller\'s saying)',
    fields: { Type: 'Capital city', Region: 'Vael', Population: '~84,000', Ruler: '[[Queen Ysolde]]', Founded: '312 AF', Climate: 'Wet, temperate' },
    tags: ['capital', 'vael'], start: 312, startM: 3, startD: 1,
    gmNotes: 'The floating engine is failing. Within a year the Lift will begin to sink.',
  });
  const ost = A('location', 'River Ost', { summary: 'A broad, slow river that carries Vael\'s trade to the sea.', fields: { Type: 'River', Region: 'Vael' } });
  const aldric = A('character', 'King Aldric', {
    summary: 'The last king of the old line, murdered on the Night of Falling Lanterns.',
    body: 'A careful, cold ruler who kept Vael at peace by keeping it afraid.',
    fields: { 'Full name': 'Aldric Ardent II', Species: 'Human', Occupation: 'King of Vael' },
    start: 978, startM: 6, startD: 14, end: 1028, endM: 11, endD: 21, tags: ['vael', 'royalty'],
  });
  const ilsabet = A('character', 'Ilsabet of the Marches', {
    summary: 'Queen mother, born to a border house, and a sharper politician than her husband.',
    fields: { Species: 'Human', Residence: '[[Varenhold]]' }, start: 984, startM: 1, startD: 9, tags: ['vael', 'royalty'],
  });
  const ysolde = A('character', 'Queen Ysolde', {
    summary: 'The sharp-tongued monarch of Vael, last of the Ardent line.',
    body: 'Ysolde took the throne at nineteen after the [[Night of Falling Lanterns]]. She rules from [[Varenhold]] and keeps an uneasy truce with the [[Lantern Guild]].\n\n## Personality\nPatient, private, and utterly unwilling to be underestimated twice.',
    fields: { 'Full name': 'Ysolde Ardent', Species: 'Human', Occupation: 'Queen of Vael', Residence: '[[Varenhold]]' },
    tags: ['vael', 'royalty'], start: 1009, startM: 4, startD: 3,
    gmNotes: 'She secretly funds an expedition to restart the Skyward engines.',
  });
  const corin = A('character', 'Prince Corin', {
    summary: 'Ysolde\'s younger brother, adored by the docks and distrusted by the court.',
    fields: { Species: 'Human', Occupation: 'Admiral of the Drowns' }, start: 1013, startM: 9, startD: 27, tags: ['vael', 'royalty'],
  });
  const wick = A('character', 'Mother Wick', {
    summary: 'Ancient, soft-spoken head of the Lantern Guild.',
    fields: { Species: 'Human?', Occupation: 'Guildmistress' }, tags: ['guild'],
  });
  const guild = A('organization', 'Lantern Guild', {
    summary: 'Lamplighters by day, information brokers by night.',
    body: 'The Guild lights every street lamp in [[Varenhold]], and so it knows who walks where after dark.',
    fields: { Type: 'Guild', Leader: '[[Mother Wick]]', Headquarters: 'Tallowmarket, [[Varenhold]]', Founded: '640 AF', Motto: '“We see by our own light.”' },
    tags: ['guild', 'intrigue'], start: 640,
  });
  const night = A('event', 'Night of Falling Lanterns', {
    summary: 'The coup that killed [[King Aldric]] and put [[Queen Ysolde]] on the throne.',
    body: 'Every lamp in [[Varenhold]] went dark at once. By dawn the king was dead, and the [[Lantern Guild]] swore it had nothing to do with it.',
    fields: { Type: 'Coup', Location: '[[Varenhold]]', Outcome: 'Ysolde crowned' },
    start: 1028, startM: 11, startD: 21, tags: ['vael', 'history'],
  });
  const fall = A('event', 'The Falling', {
    summary: 'The Skyward Empire\'s flying cities dropped from the sky in a single season.',
    start: 0, startM: 0, startD: 1, end: 0, endM: 2, endD: 30, tags: ['history'],
  });
  const reign = A('event', 'Reign of King Aldric', { summary: 'Thirty-one years of cold peace.', start: 997, end: 1028, endM: 11, endD: 21, tags: ['vael', 'history'] });
  const rel = (type, target, note = '') => ({ id: uid(), type, target: target.id, note });
  aldric.relations = [rel('spouse', ilsabet), rel('parent', ysolde), rel('parent', corin), rel('rules', varenhold, 'until 1028')];
  ilsabet.relations = [rel('parent', ysolde), rel('parent', corin)];
  ysolde.relations = [rel('sibling', corin), rel('rules', varenhold), rel('rival', wick, 'an uneasy truce')];
  wick.relations = [rel('leader', guild)];
  corin.relations = [rel('ally', guild, 'secretly')];
  for (const a of [varenhold, ost, aldric, ilsabet, ysolde, corin, wick, guild, night, fall, reign]) await store.save('articles', a);
  return wid;
}
