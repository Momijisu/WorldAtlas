// A small sample world so new users can see how things fit together.
import { uid } from './util.js';

export async function exampleWorld(store) {
  const wid = uid();
  await store.save('worlds', {
    id: wid, name: 'Aerthal', era: 'AE', image: null,
    description: 'A shattered continent where the old **Skyward Empire** fell and five kingdoms now squabble over its ruins. Start at [[Varenhold]] or meet [[Queen Ysolde]].',
  });
  const A = (type, title, rest = {}) => ({ ...store.newArticle(wid, type), title, ...rest });
  const varenhold = A('location', 'Varenhold', {
    summary: 'The rain-slick capital of the Kingdom of Vael, built atop the bones of a Skyward citadel.',
    body: '## Overview\nVarenhold climbs a granite spur above the [[River Ost]]. Its upper city still floats a few feet off the ground — the last working Skyward engine.\n\n## Districts\n- **The Lift** — noble estates on the floating stone\n- **Tallowmarket** — candlemakers, smugglers and the [[Lantern Guild]]\n- **The Drowns** — flood-prone docks\n\n> "Nothing in Varenhold is level, least of all its people." — traveller\'s saying',
    fields: { Type: 'Capital city', Region: 'Vael', Population: '~84,000', Ruler: '[[Queen Ysolde]]', Founded: '312 AE', Climate: 'Wet, temperate' },
    tags: ['capital', 'vael'],
    gmNotes: 'The floating engine is failing. Within a year the Lift will begin to sink.',
  });
  const ost = A('location', 'River Ost', { summary: 'Broad, slow river that carries Vael\'s trade to the sea.', fields: { Type: 'River', Region: 'Vael' } });
  const ysolde = A('character', 'Queen Ysolde', {
    summary: 'Sharp-tongued monarch of Vael, last of the Ardent line.',
    body: 'Ysolde took the throne at nineteen after the [[Night of Falling Lanterns]]. She rules from [[Varenhold]] and keeps an uneasy truce with the [[Lantern Guild]].\n\n## Personality\nPatient, private, and utterly unwilling to be underestimated twice.',
    fields: { 'Full name': 'Ysolde Ardent', Species: 'Human', Age: '34', Born: '1009 AE', Occupation: 'Queen of Vael', Residence: '[[Varenhold]]' },
    tags: ['vael', 'royalty'], start: 1009,
    gmNotes: 'She secretly funds the expedition to restart the Skyward engine.',
  });
  const guild = A('organization', 'Lantern Guild', {
    summary: 'Lamplighters by day, information brokers by night.',
    body: 'The Guild lights every street lamp in [[Varenhold]] — and so knows who walks where after dark.',
    fields: { Type: 'Guild', Leader: 'Mother Wick', Headquarters: 'Tallowmarket, [[Varenhold]]', Founded: '640 AE', Motto: '“We see by our own light.”' },
    tags: ['guild', 'intrigue'],
  });
  const night = A('event', 'Night of Falling Lanterns', {
    summary: 'The coup attempt that killed King Aldric and put [[Queen Ysolde]] on the throne.',
    body: 'Every lamp in [[Varenhold]] went dark at once. By dawn the king was dead and the [[Lantern Guild]] swore it had nothing to do with it.',
    fields: { Type: 'Coup', Location: '[[Varenhold]]', Outcome: 'Ysolde crowned' },
    start: 1028, tags: ['vael', 'history'],
  });
  const fall = A('event', 'Fall of the Skyward Empire', {
    summary: 'The empire\'s flying cities dropped from the sky in a single season.',
    start: 0, dateLabel: '0 AE — the Falling', tags: ['history'],
  });
  const founding = A('event', 'Founding of Varenhold', { summary: 'Survivors settle around the last floating citadel.', start: 312, tags: ['history'] });
  for (const a of [varenhold, ost, ysolde, guild, night, fall, founding]) await store.save('articles', a);
  return wid;
}
