// Article templates. Each has a picker group, a one-line "when to use" hint,
// and infobox fields grouped into sections. `fields` is the flattened list.

export const GROUPS = {
  people: 'People',
  places: 'Places',
  groups: 'Groups & faiths',
  history: 'History & stories',
  magic: 'Magic & technology',
  things: 'Things',
  lore: 'Knowledge & customs',
  other: 'Other',
};

const T = (label, plural, icon, group, hint, sections) => ({
  label, plural, icon, group, hint,
  sections: sections.map(([name, fields]) => ({ name, fields })),
  fields: sections.flatMap(([, f]) => f),
});

export const TYPES = {
  character: T('Character', 'Characters', 'user', 'people',
    'A person, deity, spirit, notable animal or sentient object.', [
      ['Basics', ['Full name', 'Other names', 'Species', 'Gender', 'Age']],
      ['Life', ['Born', 'Died', 'Birthplace', 'Residence']],
      ['Role', ['Occupation', 'Title', 'Affiliation']],
      ['Appearance', ['Height', 'Build', 'Eyes', 'Hair']],
    ]),
  species: T('Species', 'Species', 'paw-print', 'people',
    'A people, creature, plant or animal.', [
      ['Biology', ['Lifespan', 'Height', 'Weight', 'Diet']],
      ['Habitat', ['Habitat', 'Range', 'Population']],
      ['Society', ['Language', 'Intelligence', 'Relations']],
    ]),
  culture: T('Culture', 'Cultures', 'mask-happy', 'people',
    'A people’s shared identity and customs. For a single custom use Tradition; for a tongue, Language.', [
      ['Identity', ['Region', 'Population', 'Language']],
      ['Values', ['Values', 'Taboos']],
      ['Daily life', ['Diet', 'Dress', 'Architecture']],
    ]),
  profession: T('Profession', 'Professions', 'hammer', 'people',
    'A job, trade or calling: blacksmith, assassin, court mage.', [
      ['Overview', ['Type', 'Practitioners', 'Training']],
      ['Work', ['Tools', 'Workplace', 'Income']],
      ['Standing', ['Social status', 'Guild', 'Dangers']],
    ]),
  title: T('Title', 'Titles & ranks', 'crown-simple', 'people',
    'A rank, office or honour, and who can hold it.', [
      ['Overview', ['Type', 'Granted by', 'Current holder']],
      ['Rules', ['Requirements', 'Succession', 'Term']],
      ['Powers', ['Duties', 'Privileges', 'Insignia']],
    ]),

  location: T('Location', 'Locations', 'castle-turret', 'places',
    'A geographic area: region, forest, mountain, river, sea.', [
      ['Geography', ['Type', 'Region', 'Area', 'Climate', 'Terrain']],
      ['People', ['Population', 'Ruler', 'Settlements']],
      ['Resources', ['Resources', 'Dangers']],
    ]),
  settlement: T('Settlement', 'Settlements', 'buildings', 'places',
    'A city, town, village or outpost.', [
      ['Overview', ['Type', 'Region', 'Population', 'Founded']],
      ['Rule', ['Ruler', 'Government', 'Defences']],
      ['Economy', ['Industries', 'Trade', 'Currency']],
    ]),
  building: T('Building', 'Buildings', 'house-line', 'places',
    'A single structure: castle, temple, tavern, tower.', [
      ['Overview', ['Type', 'Location', 'Owner', 'Built']],
      ['Structure', ['Architecture', 'Size', 'Condition']],
      ['Use', ['Purpose', 'Occupants', 'Defences']],
    ]),

  organization: T('Organization', 'Organizations', 'shield', 'groups',
    'A faction, guild, noble house, army, company or government.', [
      ['Overview', ['Type', 'Founded', 'Headquarters', 'Motto']],
      ['Leadership', ['Leader', 'Structure', 'Members']],
      ['Influence', ['Territory', 'Allies', 'Rivals', 'Assets']],
    ]),
  religion: T('Religion', 'Religions & deities', 'sun-horizon', 'groups',
    'A faith, deity or pantheon.', [
      ['Overview', ['Deity', 'Domains', 'Symbol']],
      ['Following', ['Followers', 'Clergy', 'Holy sites']],
      ['Practice', ['Holy days', 'Holy texts']],
    ]),

  event: T('Event', 'Events', 'scroll', 'history',
    'Something that happened: a founding, disaster, discovery or ceremony. For wars use Conflict.', [
      ['Overview', ['Type', 'Location', 'Participants', 'Outcome']],
    ]),
  conflict: T('Conflict', 'Conflicts', 'flag-banner', 'history',
    'A war, battle, rebellion or feud.', [
      ['Overview', ['Type', 'Location', 'Result']],
      ['Sides', ['Belligerents', 'Commanders', 'Strength']],
      ['Cost', ['Casualties', 'Consequences']],
    ]),
  plot: T('Plot', 'Plots & quests', 'path', 'history',
    'A storyline, quest or adventure hook.', [
      ['Overview', ['Status', 'Hook']],
      ['Stakes', ['Goal', 'Antagonist', 'Reward', 'If it fails']],
    ]),
  myth: T('Myth', 'Myths & legends', 'moon-stars', 'history',
    'A legend, folk tale or creation story, true or not.', [
      ['Overview', ['Type', 'Origin', 'Told by']],
      ['Meaning', ['Moral', 'Truth behind it']],
    ]),

  spell: T('Spell', 'Spells & powers', 'magic-wand', 'magic',
    'A single power or ability. For how magic works overall, use Natural Law.', [
      ['Overview', ['School', 'Caster', 'Source', 'Range', 'Duration']],
      ['Technical details', ['Components', 'Cost', 'Limits', 'Counter']],
    ]),
  law: T('Natural Law', 'Natural laws', 'atom', 'magic',
    'How magic, physics or the world itself works: a magic system or rule of nature.', [
      ['Overview', ['Type', 'Scope', 'Discovered by']],
      ['Rules', ['Source', 'Cost', 'Limits', 'Exceptions']],
    ]),
  condition: T('Condition', 'Conditions', 'heartbeat', 'magic',
    'A disease, curse, mutation or blessing someone can have.', [
      ['Overview', ['Type', 'Cause', 'Transmission']],
      ['Effects', ['Symptoms', 'Duration', 'Treatment', 'Cure']],
      ['Spread', ['Affected', 'Origin']],
    ]),
  technology: T('Technology', 'Technologies', 'gear', 'magic',
    'An invention, technique or process.', [
      ['Overview', ['Type', 'Inventor', 'Invented', 'Users']],
      ['Function', ['Purpose', 'Materials', 'Limitations']],
    ]),

  item: T('Item', 'Items', 'sword', 'things',
    'A specific object: weapon, relic, heirloom.', [
      ['Overview', ['Type', 'Creator', 'Owner', 'Created']],
      ['Properties', ['Material', 'Rarity', 'Value', 'Powers']],
    ]),
  vehicle: T('Vehicle', 'Vehicles', 'boat', 'things',
    'A ship, carriage, airship or other craft.', [
      ['Overview', ['Type', 'Builder', 'Owner', 'Crew', 'Passengers']],
      ['Performance', ['Speed', 'Range', 'Cargo', 'Armament']],
    ]),
  material: T('Material', 'Materials', 'cube', 'things',
    'A substance or resource: metal, herb, mineral, fabric.', [
      ['Overview', ['Type', 'Sources', 'Rarity', 'Value']],
      ['Properties', ['Properties', 'Uses', 'Hazards']],
    ]),

  tradition: T('Tradition', 'Traditions', 'confetti', 'lore',
    'A custom, festival, rite or ceremony.', [
      ['Overview', ['Type', 'Practised by', 'When']],
      ['Practice', ['Participants', 'Objects', 'Food']],
      ['Origin', ['Origin', 'Significance']],
    ]),
  language: T('Language', 'Languages', 'translate', 'lore',
    'A spoken, written or signed tongue.', [
      ['Overview', ['Speakers', 'Region', 'Family']],
      ['Form', ['Script', 'Dialects']],
      ['Use', ['Status', 'Common phrases']],
    ]),
  lore: T('Lore', 'Lore & documents', 'book-open-text', 'lore',
    'A book, letter, law or other text, or general knowledge.', [
      ['Overview', ['Author', 'Written', 'Language', 'Location']],
    ]),

  article: T('Article', 'Other articles', 'file-text', 'other',
    'Anything that doesn’t fit another template.', []),
};

// An article's infobox values grouped by its template's sections; fields not
// in the template go under "Other". Only non-empty values are included.
export function sectionsOf(type, fields = {}) {
  const t = TYPES[type] || TYPES.article;
  const used = new Set();
  const out = [];
  for (const s of t.sections) {
    const entries = s.fields.filter((f) => String(fields[f] ?? '').trim()).map((f) => [f, fields[f]]);
    s.fields.forEach((f) => used.add(f));
    if (entries.length) out.push({ name: s.name, entries });
  }
  const extra = Object.entries(fields).filter(([k, v]) => k && !used.has(k) && String(v ?? '').trim());
  if (extra.length) out.push({ name: 'Other', entries: extra });
  return out;
}
