// The example world, Aerthal. It shows how the features fit together: linked
// articles across many templates, a custom calendar, a family, rivalries, a
// map with pins, regions and layers, and an answered writing prompt.
// With { demo: true } it is a local-only demo that never syncs.
import { uid } from './util.js';
import { presetCalendar } from './calendar.js';

async function assetImage(store, path) {
  try {
    const blob = await (await fetch(path)).blob();
    return await store.addImage(new Blob([blob], { type: 'image/svg+xml' }));
  } catch {
    return null;
  }
}

export async function exampleWorld(store, { demo = false } = {}) {
  const wid = uid();
  const calendar = presetCalendar('even');
  calendar.eras = [
    { name: 'The Skyward Age', abbr: 'SkA', start: -900, restart: false },
    { name: 'After the Falling', abbr: 'AF', start: 0, restart: false },
  ];
  calendar.moons = [{ name: 'Selune', cycle: 30, offset: 3, color: '#d9cfb8' }, { name: 'Vey', cycle: 45, offset: 20, color: '#c4553b' }];
  calendar.currentYear = 1043;
  const cover = await assetImage(store, 'assets/demo/cover.svg');
  // Header images for a couple of articles, to show how they look.
  const varenholdBanner = await assetImage(store, 'assets/demo/varenhold.svg');
  const gloamwoodBanner = await assetImage(store, 'assets/demo/gloamwood.svg');
  const world = {
    id: wid, name: 'Aerthal', image: cover, calendar, ...(demo ? { demo: true } : {}),
    description: 'A shattered continent where the flying cities of the old **Skyward Empire** fell from the sky, and five kingdoms now squabble over the ruins. Start at [[Varenhold]], meet [[Queen Ysolde]], or open the map of [[Vael]].',
  };
  await store.save('worlds', world);

  const A = (type, title, rest = {}) => ({ ...store.newArticle(wid, type), title, ...rest });
  const rel = (type, target, note = '') => ({ id: uid(), type, target: target.id, note });

  // Places
  const vael = A('location', 'Vael', {
    summary: 'A rain-soaked kingdom between the Spine of Ash and the Drowned Sea.',
    body: 'Vael is the largest of the five kingdoms that rose after [[The Falling]]. Its heart is the [[River Ost]], which runs from the [[Spine of Ash]] past [[Varenhold]] to the port of [[Ostmouth]].',
    fields: { Type: 'Kingdom', Climate: 'Wet, temperate', Population: '~1.2 million', Ruler: '[[Queen Ysolde]]', Settlements: '[[Varenhold]], [[Ostmouth]], [[Marrowgate]]' },
    tags: ['vael'],
  });
  const varenhold = A('settlement', 'Varenhold', {
    banner: varenholdBanner, bannerPos: [50, 30],
    summary: 'The rain-slick capital of Vael, built on the bones of a Skyward citadel.',
    body: '## Overview\nVarenhold climbs a granite spur above the [[River Ost]]. Its upper city still floats a few feet off the ground, held up by the last working [[The Skyward Engines|Skyward engine]].\n\n## Districts\n- **The Lift**: noble estates on the floating stone, crowned by [[The Lift Palace]]\n- **Tallowmarket**: candlemakers, smugglers and the [[Lantern Guild]]\n- **The Drowns**: flood-prone docks\n\n> "Nothing in Varenhold is level, least of all its people." (a traveller’s saying)',
    fields: { Type: 'Capital city', Region: '[[Vael]]', Population: '~84,000', Founded: '312 AF', Ruler: '[[Queen Ysolde]]', Industries: 'Candles, river trade, stormglass cutting' },
    tags: ['capital', 'vael'], start: 312, startM: 3, startD: 1,
    gmNotes: 'The floating engine is failing. Within a year the Lift will begin to sink. See [[The Sinking Lift]].',
  });
  const palace = A('building', 'The Lift Palace', {
    summary: 'The royal palace, perched on the floating stone of the Lift.',
    body: 'Built from the ruin of a Skyward citadel, the palace sways very slightly in strong wind. Visitors are advised not to look over the balustrades.',
    fields: { Type: 'Palace', Location: '[[Varenhold]]', Owner: 'The Crown', Built: 'c. 330 AF', Purpose: 'Royal residence and court' },
    tags: ['vael', 'royalty'],
  });
  const ostmouth = A('settlement', 'Ostmouth', {
    summary: 'A brawling river port where the Ost meets the Drowned Sea.',
    body: 'Home port of the river fleet and of [[Prince Corin]], who is far more popular here than in the capital.',
    fields: { Type: 'Port town', Region: '[[Vael]]', Population: '~22,000', Industries: 'Shipbuilding, fishing, smuggling' },
    tags: ['vael', 'port'],
  });
  const marrowgate = A('settlement', 'Marrowgate', {
    summary: 'A walled hill town that charges a toll on the western road.',
    fields: { Type: 'Toll town', Region: '[[Vael]]', Population: '~6,000', Ruler: 'House Marrow' },
    tags: ['vael'],
  });
  const highcairn = A('settlement', 'Highcairn', {
    summary: 'A monastery town on the largest of the Skyfall Isles.',
    body: 'Built where a Skyward city struck the sea. Its monks catalogue every fragment of [[Old Skyward]] they can find.',
    fields: { Type: 'Monastery town', Population: '~900' },
    tags: ['skyfall'],
  });
  const ost = A('location', 'River Ost', {
    summary: 'A broad, slow river that carries Vael’s trade to the sea.',
    fields: { Type: 'River', Region: '[[Vael]]' }, tags: ['vael'],
  });
  const spine = A('location', 'Spine of Ash', {
    summary: 'Black mountains along Vael’s northern border, rich in stormglass.',
    body: 'Miners risk [[Ashlung]] for the [[Stormglass]] seams that run beneath the peaks.',
    fields: { Type: 'Mountain range', Terrain: 'Volcanic, scree', Resources: '[[Stormglass]], iron', Dangers: 'Rockfalls, [[Ashlung]]' },
    tags: ['vael', 'wilds'],
  });
  const gloamwood = A('location', 'Gloamwood', {
    banner: gloamwoodBanner, bannerPos: [50, 70],
    summary: 'A misty eastern forest where travellers lose their way.',
    body: 'The mist never fully lifts. Locals say the [[Mistfox|mistfoxes]] lead the lost either home or further in, depending on the fox’s mood.',
    fields: { Type: 'Forest', Climate: 'Cold, misty', Dangers: 'Getting lost' },
    tags: ['vael', 'wilds'],
  });

  // People
  const aldric = A('character', 'King Aldric', {
    summary: 'The last king of the old line, murdered on the Night of Falling Lanterns.',
    body: 'A careful, cold ruler who kept Vael at peace by keeping it afraid.',
    fields: { 'Full name': 'Aldric Ardent II', Species: 'Human', Occupation: 'King of Vael' },
    start: 978, startM: 6, startD: 14, end: 1028, endM: 11, endD: 21, tags: ['vael', 'royalty'],
  });
  const ilsabet = A('character', 'Ilsabet of the Marches', {
    summary: 'The queen mother, born to a border house, and a sharper politician than her husband.',
    fields: { Species: 'Human', Birthplace: '[[Marrowgate]]', Residence: '[[The Lift Palace]]' }, start: 984, startM: 1, startD: 9, tags: ['vael', 'royalty'],
  });
  const ysolde = A('character', 'Queen Ysolde', {
    summary: 'The sharp-tongued monarch of Vael, last of the Ardent line.',
    body: 'Ysolde took the throne at nineteen after the [[Night of Falling Lanterns]]. She rules from [[Varenhold]] and keeps an uneasy truce with the [[Lantern Guild]].\n\n## Personality\nPatient, private, and utterly unwilling to be underestimated twice.\n\n## Fears\nShe fears the dark more than any assassin. She has never slept a night without a lamp lit, and she knows exactly who lights them.',
    fields: { 'Full name': 'Ysolde Ardent', Species: 'Human', Age: '34', Occupation: 'Queen of Vael', Residence: '[[The Lift Palace]]', Eyes: 'Grey', Hair: 'Black, cropped' },
    tags: ['vael', 'royalty'], start: 1009, startM: 4, startD: 3,
    gmNotes: 'She secretly funds an expedition to restart the Skyward engines.',
  });
  const corin = A('character', 'Prince Corin', {
    summary: 'Ysolde’s younger brother, adored by the docks and distrusted by the court.',
    fields: { Species: 'Human', Occupation: 'Admiral of the river fleet', Residence: '[[Ostmouth]]' }, start: 1013, startM: 9, startD: 27, tags: ['vael', 'royalty'],
  });
  const wick = A('character', 'Mother Wick', {
    summary: 'The ancient, soft-spoken head of the Lantern Guild.',
    fields: { Species: 'Human?', Occupation: 'Guildmistress' }, tags: ['guild'],
  });
  const lamplighter = A('profession', 'Lamplighter', {
    summary: 'Keepers of Varenhold’s street lamps, and of its secrets.',
    body: 'Every lamplighter belongs to the [[Lantern Guild]]. The pay is poor; the information is not.',
    fields: { Practitioners: '~300 in Varenhold', Training: 'Seven-year apprenticeship', Guild: '[[Lantern Guild]]', 'Social status': 'Humble, quietly feared' },
    tags: ['guild'],
  });
  const warden = A('title', 'Warden of the Lift', {
    summary: 'The noble charged with keeping Varenhold’s upper city aloft.',
    fields: { 'Granted by': 'The Crown', Succession: 'Appointed', Duties: 'Maintain the engine; report its condition to the monarch', Privileges: 'A seat at the royal table' },
    tags: ['vael', 'royalty'],
  });
  const mistfox = A('species', 'Mistfox', {
    summary: 'A pale, clever fox of the Gloamwood that can vanish into fog.',
    fields: { Lifespan: '~12 years', Habitat: '[[Gloamwood]]', Diet: 'Small game, stolen bread', Intelligence: 'Uncomfortably high' },
    tags: ['wilds'],
  });

  // Groups, history and stories
  const guild = A('organization', 'Lantern Guild', {
    summary: 'Lamplighters by day, information brokers by night.',
    body: 'The Guild lights every street lamp in [[Varenhold]], and so it knows who walks where after dark. Its members practise [[Lanternlight]].',
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
    summary: 'The Skyward Empire’s flying cities dropped from the sky in a single season.',
    start: 0, startM: 0, startD: 1, end: 0, endM: 2, endD: 30, tags: ['history'],
  });
  const reign = A('event', 'Reign of King Aldric', { summary: 'Thirty-one years of cold peace.', start: 997, end: 1028, endM: 11, endD: 21, tags: ['vael', 'history'] });
  const war = A('conflict', 'War of the Drowned Crown', {
    summary: 'Ostmouth’s rebellion against the crown, ended by Prince Corin’s fleet.',
    body: 'When Ysolde raised the river tolls, [[Ostmouth]] closed the river mouth. Corin was sent to break the blockade and instead negotiated it open, which the court has never forgiven.',
    fields: { Type: 'Rebellion', Location: '[[River Ost]]', Result: 'Tolls lowered; Ostmouth pardoned', Commanders: '[[Prince Corin]]', Casualties: 'Few, by design' },
    start: 1031, startM: 1, startD: 14, end: 1034, endM: 7, endD: 2, tags: ['vael', 'history'],
  });
  const tradition = A('tradition', 'Night of Lanterns', {
    summary: 'Each year on 21 Longnight, Varenhold lights every lamp it owns.',
    body: 'Begun the year after the [[Night of Falling Lanterns]], it is officially a remembrance. Unofficially it is the [[Lantern Guild]] reminding everyone who holds the light.',
    fields: { Type: 'Festival', 'Practised by': 'The people of [[Varenhold]]', When: '21 Longnight' },
    start: 1029, startM: 11, startD: 21, tags: ['vael'],
  });
  const myth = A('myth', 'How the Sky Let Go', {
    summary: 'The tale children are told about why the flying cities fell.',
    body: 'The sky, the story goes, grew tired of holding the Skyward cities, which never once said thank you. So one spring it simply let go.',
    fields: { Type: 'Folk tale', 'Told by': 'Everyone in Vael', Moral: 'Gratitude', 'Truth behind it': 'See [[The Skyward Engines]]' },
    tags: ['history'],
  });
  const plot = A('plot', 'The Sinking Lift', {
    summary: 'The engine under Varenhold is failing, and only the queen knows.',
    fields: { Status: 'Unresolved', Hook: 'A stonemason notices the Lift is an inch lower than last year', Goal: 'Restart the engine before the Lift falls', Antagonist: 'Time, and anyone who profits from chaos', 'If it fails': 'The upper city crashes into Tallowmarket' },
    tags: ['vael', 'quest'],
    gmNotes: 'The [[Lantern Guild]] already knows, and is deciding what the information is worth.',
  });

  // Magic, things and knowledge
  const engines = A('law', 'The Skyward Engines', {
    summary: 'How stormglass once held whole cities in the air.',
    body: '## How it works\nCharged [[Stormglass]] pushes against the earth the way a lodestone pushes against another. Enough of it, cut precisely, lifts stone.\n\n## Why it failed\nThe charge fades. The Skyward engineers knew how to renew it; that knowledge died with them in [[The Falling]].',
    fields: { Type: 'Arcane mechanics', Scope: 'Stormglass and anything bound to it', Source: 'Charged [[Stormglass]]', Limits: 'The charge fades over centuries', Cost: 'Unknown; the method is lost' },
    tags: ['magic'],
  });
  const stormglass = A('material', 'Stormglass', {
    summary: 'A smoky crystal that hums before thunderstorms.',
    fields: { Type: 'Crystal', Sources: '[[Spine of Ash]]', Rarity: 'Rare', Value: 'Its weight in silver, uncut', Uses: 'Engines, lenses, [[Lanternlight]] lamps', Hazards: 'Dust causes [[Ashlung]]' },
    tags: ['magic'],
  });
  const lanternlight = A('spell', 'Lanternlight', {
    summary: 'The Guild’s quiet art: seeing through any lamp a lamplighter has lit.',
    fields: { School: 'Scrying', Caster: '[[Lamplighter|Lamplighters]] of the Guild', Range: 'Any lamp the caster has lit', Duration: 'While the flame burns', Components: 'A stormglass wick', Limits: 'Sight only, no sound', Counter: 'Darkness' },
    tags: ['magic', 'guild'],
  });
  const ashlung = A('condition', 'Ashlung', {
    summary: 'A miners’ cough from breathing stormglass dust.',
    fields: { Type: 'Disease', Cause: '[[Stormglass]] dust', Transmission: 'Not contagious', Symptoms: 'Grey cough, humming in the chest', Treatment: 'Clean air, rest', Cure: 'None known', Affected: 'Miners of the [[Spine of Ash]]' },
    tags: ['wilds'],
  });
  const crown = A('item', 'The Ardent Crown', {
    summary: 'The crown of Vael, set with a single stormglass stone.',
    fields: { Type: 'Crown', Owner: '[[Queen Ysolde]]', Material: 'Gold, [[Stormglass]]', Rarity: 'Unique' },
    tags: ['royalty'],
  });
  const ship = A('vehicle', 'The Ostrunner', {
    summary: 'Prince Corin’s flagship, a shallow river galley built for speed.',
    fields: { Type: 'River galley', Owner: '[[Prince Corin]]', Crew: '60 oars, 20 marines', Speed: 'Fast downstream, stubborn upstream' },
    tags: ['vael', 'port'],
  });
  const skyward = A('language', 'Old Skyward', {
    summary: 'The dead language of the Skyward Empire, still found carved into ruins.',
    fields: { Speakers: 'None natively; scholars at [[Highcairn]]', Script: 'Angular runes', Status: 'Dead' },
    tags: ['history'],
  });

  // Structure and relationships
  for (const a of [varenhold, ostmouth, marrowgate, ost, spine, gloamwood]) a.parentId = vael.id;
  palace.parentId = varenhold.id;
  aldric.relations = [rel('spouse', ilsabet), rel('parent', ysolde), rel('parent', corin), rel('rules', varenhold, 'until 1028')];
  ilsabet.relations = [rel('parent', ysolde), rel('parent', corin)];
  ysolde.relations = [rel('sibling', corin), rel('rules', vael), rel('rival', wick, 'an uneasy truce'), rel('owns', crown)];
  wick.relations = [rel('leader', guild)];
  corin.relations = [rel('ally', guild, 'secretly'), rel('owns', ship)];
  lamplighter.relations = [rel('member', guild)];

  const all = [vael, varenhold, palace, ostmouth, marrowgate, highcairn, ost, spine, gloamwood,
    aldric, ilsabet, ysolde, corin, wick, lamplighter, warden, mistfox,
    guild, night, fall, reign, war, tradition, myth, plot,
    engines, stormglass, lanternlight, ashlung, crown, ship, skyward];
  for (const a of all) await store.save('articles', a);

  // A map with pins, regions and layers.
  const mapImage = await assetImage(store, 'assets/demo/map.svg');
  if (mapImage) {
    const P = (a, x, y, icon, layer) => ({ id: uid(), x: x / 1600, y: y / 1100, articleId: a.id, label: '', color: '#9b2f1e', icon, layer });
    const ring = (cx, cy, rx, ry, n = 14) => Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      return [(cx + rx * Math.cos(t) * (1 + 0.08 * Math.sin(3 * t))) / 1600, (cy + ry * Math.sin(t)) / 1100];
    });
    await store.save('maps', {
      id: uid(), worldId: wid, name: 'The Kingdom of Vael', image: mapImage,
      pins: [
        P(varenhold, 745, 505, 'castle-turret', 'settlement'),
        P(ostmouth, 560, 735, 'anchor', 'settlement'),
        P(marrowgate, 470, 455, 'house', 'settlement'),
        P(highcairn, 1390, 255, 'church', 'settlement'),
      ],
      regions: [
        { id: uid(), points: ring(1070, 660, 130, 105), color: '#4a5233', label: '', articleId: gloamwood.id, layer: 'location' },
        { id: uid(), points: ring(850, 290, 250, 70), color: '#5b4630', label: '', articleId: spine.id, layer: 'location' },
      ],
    });
  }

  // One answered writing prompt ("What does {character} fear most?").
  await store.save('worlds', { ...store.world(wid), prompts: { answered: { [`p:pc01:${ysolde.id}`]: [ysolde.id] }, dismissed: [], custom: [] } });
  return wid;
}
