// Writing prompts. Each prompt suggests an article template (`type`).
// Prompts with `about` name an existing article of that type from the world,
// filled into {placeholder} — e.g. "What does {character} fear most?".
// A prompt's key is "p:<id>" or "p:<id>:<articleId>"; custom prompts are "c:<id>".
import * as store from './store.js';

export const CATEGORIES = {
  people: { label: 'People', icon: 'user' },
  places: { label: 'Places', icon: 'castle-turret' },
  power: { label: 'Power & factions', icon: 'crown' },
  faith: { label: 'Faith & myth', icon: 'sun-horizon' },
  history: { label: 'History', icon: 'hourglass-medium' },
  culture: { label: 'Culture & daily life', icon: 'mask-happy' },
  magic: { label: 'Magic & technology', icon: 'sparkle' },
  nature: { label: 'Nature & creatures', icon: 'tree-evergreen' },
  objects: { label: 'Objects & artifacts', icon: 'sword' },
  conflict: { label: 'Conflict & intrigue', icon: 'skull' },
};

const P = (id, cat, type, text, about) => ({ id, cat, type, text, about });

export const PROMPTS = [
  // People
  P('pe01', 'people', 'character', 'Who is the most respected healer in your world, and what did it cost them to earn that respect?'),
  P('pe02', 'people', 'character', 'Describe someone whose name is spoken only in whispers. Why do people fear saying it aloud?'),
  P('pe03', 'people', 'character', 'Write about a person who once held great power and now lives in obscurity.'),
  P('pe04', 'people', 'character', 'Who keeps the records nobody else wants to keep?'),
  P('pe05', 'people', 'character', 'Introduce a famous performer. What is their most celebrated work, and what does it secretly mock?'),
  P('pe06', 'people', 'character', 'Describe an explorer who returned from somewhere no one else has ever come back from.'),
  P('pe07', 'people', 'character', 'Who is the best liar anyone has ever met, and who finally saw through them?'),
  P('pe08', 'people', 'character', 'Write about a child who will one day change everything, though no one suspects it yet.'),
  P('pe09', 'people', 'character', 'Introduce a craftsperson whose work can be recognised at a glance. What is their mark?'),
  P('pe10', 'people', 'character', 'Who is the most hated person in a city who has never actually broken a law?'),
  P('pe11', 'people', 'character', 'Describe a traitor who believed, to the end, that they were doing the right thing.'),
  P('pe12', 'people', 'character', 'Write about someone who cannot die, or believes they cannot.'),
  P('pc01', 'people', 'character', 'What does {character} fear most, and who knows it?', 'character'),
  P('pc02', 'people', 'character', 'Describe the worst day of {character}’s life.', 'character'),
  P('pc03', 'people', 'character', 'What does {character} carry with them at all times, and why?', 'character'),
  P('pc04', 'people', 'character', 'Who would {character} betray, and who would they never betray?', 'character'),
  P('pc05', 'people', 'character', 'Write a letter {character} wrote but never sent.', 'character'),
  P('pc06', 'people', 'character', 'What does {character} want that they will never admit to wanting?', 'character'),
  P('pc07', 'people', 'character', 'Describe {character}’s home, room by room. What do the rooms reveal about them?', 'character'),
  P('pc08', 'people', 'character', 'Who taught {character} the skill they are best known for?', 'character'),
  P('pc09', 'people', 'character', 'What rumour about {character} is completely false, and which one is true?', 'character'),
  P('pc10', 'people', 'character', 'How will {character} be remembered a hundred years from now?', 'character'),

  // Places
  P('pl01', 'places', 'location', 'Describe a place travellers are warned never to stop at after dark.'),
  P('pl02', 'places', 'location', 'Write about a settlement built somewhere no sensible person would build one. Why is it there?'),
  P('pl03', 'places', 'location', 'Where do people go to disappear?'),
  P('pl04', 'places', 'location', 'Describe a ruin that locals refuse to name.'),
  P('pl05', 'places', 'location', 'What is the busiest crossroads in your world, and what passes through it?'),
  P('pl06', 'places', 'location', 'Write about a place that exists only part of the time.'),
  P('pl07', 'places', 'location', 'Describe a tavern, inn or teahouse where deals are made that shape nations.'),
  P('pl08', 'places', 'location', 'Where is the most beautiful view in your world, and who owns it?'),
  P('pl09', 'places', 'location', 'Describe a prison. Who is its most famous inmate?'),
  P('pl10', 'places', 'location', 'Write about a border that everyone agrees on, but nobody can see.'),
  P('pl11', 'places', 'location', 'Describe a place sacred to two peoples who hate each other.'),
  P('pl12', 'places', 'location', 'What lies at the bottom of the deepest place anyone has ever reached?'),
  P('plc1', 'places', 'location', 'What does {location} smell like on a market day?', 'location'),
  P('plc2', 'places', 'location', 'Describe the oldest building in {location} and the story locals tell about it.', 'location'),
  P('plc3', 'places', 'location', 'Who really runs {location}, as opposed to who officially does?', 'location'),
  P('plc4', 'places', 'location', 'What would an outsider find strange about everyday life in {location}?', 'location'),
  P('plc5', 'places', 'location', 'How has {location} changed in the last fifty years, and who is angry about it?', 'location'),
  P('plc6', 'places', 'location', 'Describe a hidden place within {location} that only a few people know about.', 'location'),
  P('plc7', 'places', 'location', 'What disaster would {location} be least prepared for?', 'location'),

  // Power & factions
  P('pw01', 'power', 'organization', 'Describe a guild that controls something everyone needs but nobody thinks about.'),
  P('pw02', 'power', 'organization', 'Write about a secret society that is far less secret than its members believe.'),
  P('pw03', 'power', 'organization', 'Who enforces the law where there is no ruler?'),
  P('pw04', 'power', 'organization', 'Describe a noble house in decline. What are they willing to sell?'),
  P('pw05', 'power', 'organization', 'Write about an order of warriors with a code that has become impossible to follow.'),
  P('pw06', 'power', 'organization', 'Who collects taxes, and how do people avoid paying them?'),
  P('pw07', 'power', 'organization', 'Describe a criminal network that provides a genuine public service.'),
  P('pw08', 'power', 'organization', 'How is a ruler chosen in your world, and when did that process last go wrong?'),
  P('pw09', 'power', 'organization', 'Write about a mercenary company with an unusual condition of employment.'),
  P('pw10', 'power', 'organization', 'Describe an academy, school or college. What is forbidden to study there?'),
  P('pwc1', 'power', 'organization', 'How does someone join {organization}, and how does someone leave it?', 'organization'),
  P('pwc2', 'power', 'organization', 'What is {organization}’s greatest failure, and how do they explain it?', 'organization'),
  P('pwc3', 'power', 'organization', 'Who is {organization}’s most dangerous enemy?', 'organization'),
  P('pwc4', 'power', 'organization', 'Describe a ceremony or ritual unique to {organization}.', 'organization'),
  P('pwc5', 'power', 'organization', 'Where does {organization}’s money come from, really?', 'organization'),
  P('pwc6', 'power', 'organization', 'What would happen if {organization} vanished overnight?', 'organization'),

  // Faith & myth
  P('fa01', 'faith', 'religion', 'How did the world begin, according to the people who live in it?'),
  P('fa02', 'faith', 'religion', 'Describe a god who has been forgotten by almost everyone.'),
  P('fa03', 'faith', 'religion', 'What happens to the dead, and how do the living make sure of it?'),
  P('fa04', 'faith', 'religion', 'Write about a prophecy that has already come true, though nobody noticed.'),
  P('fa05', 'faith', 'religion', 'Describe a heresy. Why is it so dangerous to the established faith?'),
  P('fa06', 'faith', 'religion', 'What do people pray for most often?'),
  P('fa07', 'faith', 'religion', 'Write about a miracle that the faithful and the sceptics explain differently.'),
  P('fa08', 'faith', 'lore', 'Tell a myth that parents use to frighten children into behaving.'),
  P('fa09', 'faith', 'religion', 'Describe a holy site that pilgrims risk their lives to reach.'),
  P('fa10', 'faith', 'religion', 'How does someone become a priest, and what must they give up?'),
  P('fa11', 'faith', 'lore', 'Write about the end of the world as foretold. Who is hoping for it?'),
  P('fac1', 'faith', 'religion', 'What does {religion} forbid, and who breaks that rule most often?', 'religion'),
  P('fac2', 'faith', 'religion', 'Describe the holiest day in the {religion} calendar.', 'religion'),
  P('fac3', 'faith', 'religion', 'How did {religion} spread, and what did it replace?', 'religion'),

  // History
  P('hi01', 'history', 'event', 'Describe the war everyone wants to forget.'),
  P('hi02', 'history', 'event', 'Write about a treaty that is still in force, though nobody remembers why.'),
  P('hi03', 'history', 'event', 'What was the worst plague, famine or disaster in living memory?'),
  P('hi04', 'history', 'event', 'Describe a revolution, whether it succeeded or failed.'),
  P('hi05', 'history', 'event', 'Write about a battle that was lost on purpose.'),
  P('hi06', 'history', 'event', 'What discovery changed everyday life within a single generation?'),
  P('hi07', 'history', 'event', 'Describe the founding of a nation, first as the history books tell it and then as it really happened.'),
  P('hi08', 'history', 'event', 'Write about an assassination and its unexpected consequences.'),
  P('hi09', 'history', 'event', 'What great migration shaped the peoples of your world?'),
  P('hi10', 'history', 'event', 'Describe a festival that began as a commemoration of something terrible.'),
  P('hi11', 'history', 'event', 'Write about the day the old order ended.'),
  P('hic1', 'history', 'event', 'Describe the day {location} was founded, or the day it fell.', 'location'),
  P('hic2', 'history', 'event', 'What event first brought {organization} to power?', 'organization'),

  // Culture & daily life
  P('cu01', 'culture', 'culture', 'What does a typical breakfast look like, and how does it differ between rich and poor?'),
  P('cu02', 'culture', 'culture', 'Describe a coming-of-age tradition.'),
  P('cu03', 'culture', 'culture', 'How do people greet each other, and what greeting would be a deadly insult?'),
  P('cu04', 'culture', 'culture', 'Write about a game everyone plays and an obsessive few take far too seriously.'),
  P('cu05', 'culture', 'culture', 'Describe a wedding custom that outsiders find baffling.'),
  P('cu06', 'culture', 'culture', 'How are the dead honoured? What is buried with them?'),
  P('cu07', 'culture', 'culture', 'What is fashionable right now, and what will be ridiculed in ten years?'),
  P('cu08', 'culture', 'culture', 'Describe a language or dialect and a word in it that cannot be translated.'),
  P('cu09', 'culture', 'culture', 'What is considered good manners at the table?'),
  P('cu10', 'culture', 'culture', 'Write about a form of art that exists only in your world.'),
  P('cu11', 'culture', 'culture', 'How do people tell the time and keep track of the seasons?'),
  P('cu12', 'culture', 'culture', 'Describe a common superstition and where it came from.'),
  P('cu13', 'culture', 'culture', 'What do children play with? What do they sing?'),
  P('cu14', 'culture', 'culture', 'How is money made, carried and trusted?'),
  P('cuc1', 'culture', 'culture', 'What would {culture} consider the greatest possible shame?', 'culture'),
  P('cuc2', 'culture', 'culture', 'Describe a holiday celebrated by {culture}.', 'culture'),

  // Magic & technology
  P('ma01', 'magic', 'lore', 'Where does magic come from, and what happens when it runs out?'),
  P('ma02', 'magic', 'lore', 'What is the price of using magic, and who pays it?'),
  P('ma03', 'magic', 'lore', 'Describe a spell, technique or invention that has been outlawed.'),
  P('ma04', 'magic', 'lore', 'How do ordinary people use magic or technology in their daily chores?'),
  P('ma05', 'magic', 'lore', 'Write about an experiment that went catastrophically wrong.'),
  P('ma06', 'magic', 'lore', 'How do messages travel long distances?'),
  P('ma07', 'magic', 'lore', 'Describe a form of transport unique to your world.'),
  P('ma08', 'magic', 'lore', 'What do scholars argue about most bitterly?'),
  P('ma09', 'magic', 'lore', 'Write about knowledge that was lost and what people would give to recover it.'),
  P('ma10', 'magic', 'lore', 'How is medicine practised, and what can it still not cure?'),

  // Nature & creatures
  P('na01', 'nature', 'species', 'Describe a creature that is hunted almost to extinction. Why is it so valuable?'),
  P('na02', 'nature', 'species', 'Write about an animal that people keep as a companion.'),
  P('na03', 'nature', 'species', 'What lives in the deep places where no light reaches?'),
  P('na04', 'nature', 'species', 'Describe a plant that is both medicine and poison.'),
  P('na05', 'nature', 'species', 'Write about a creature that was believed to be a myth, until recently.'),
  P('na06', 'nature', 'location', 'Describe a strange weather phenomenon and how people prepare for it.'),
  P('na07', 'nature', 'species', 'What beast of burden makes trade possible?'),
  P('na08', 'nature', 'species', 'Describe a predator that hunts people. How do they protect themselves?'),
  P('na09', 'nature', 'location', 'Write about a forest, sea or desert that seems to have a will of its own.'),
  P('na10', 'nature', 'species', 'What creature appears on coins, banners or crests, and why?'),
  P('nac1', 'nature', 'species', 'How do {species} raise their young?', 'species'),
  P('nac2', 'nature', 'species', 'What do other peoples get wrong about {species}?', 'species'),
  P('nac3', 'nature', 'species', 'Where did {species} first come from, according to themselves?', 'species'),

  // Objects & artifacts
  P('ob01', 'objects', 'item', 'Describe a weapon with a name and a reputation.'),
  P('ob02', 'objects', 'item', 'Write about an heirloom that has caused a family feud.'),
  P('ob03', 'objects', 'item', 'What object would someone cross the world to destroy?'),
  P('ob04', 'objects', 'item', 'Describe a crown, seal or symbol of office, and what happens if it is lost.'),
  P('ob05', 'objects', 'item', 'Write about a book that should never have been written.'),
  P('ob06', 'objects', 'item', 'Describe an everyday tool that only exists in your world.'),
  P('ob07', 'objects', 'item', 'What treasure is buried and still waiting to be found?'),
  P('ob08', 'objects', 'item', 'Write about a forgery so good it changed history.'),
  P('ob09', 'objects', 'item', 'Describe a musical instrument and the music played on it.'),
  P('obc1', 'objects', 'item', 'Who has owned {item}, and what happened to each of them?', 'item'),
  P('obc2', 'objects', 'item', 'What is {item} really capable of that its current owner does not know?', 'item'),

  // Conflict & intrigue
  P('co01', 'conflict', 'event', 'Describe a feud between two families that has outlived its original cause.'),
  P('co02', 'conflict', 'article', 'What secret, if revealed, would start a war?'),
  P('co03', 'conflict', 'organization', 'Write about spies: who employs them, and how they are caught.'),
  P('co04', 'conflict', 'event', 'Describe a border dispute and the people caught in the middle.'),
  P('co05', 'conflict', 'article', 'Write about a scandal that brought down someone powerful.'),
  P('co06', 'conflict', 'event', 'Describe a rebellion brewing right now. What will spark it?'),
  P('co07', 'conflict', 'article', 'What is the most common crime, and the most feared one?'),
  P('co08', 'conflict', 'article', 'Write about a duel whose outcome is still disputed.'),
  P('coc1', 'conflict', 'character', 'Who wants {character} dead, and why haven’t they succeeded yet?', 'character'),
  P('coc2', 'conflict', 'organization', 'Who is secretly working against {organization} from within?', 'organization'),
  P('coc3', 'conflict', 'location', 'If war came to {location}, how would it fall?', 'location'),
];

// Per-device preference: hide prompts from the overview and sidebar.
export function promptsEnabled() {
  try { return localStorage.getItem('wa.hidePrompts') !== '1'; } catch { return true; }
}
export function setPromptsEnabled(on) {
  try { on ? localStorage.removeItem('wa.hidePrompts') : localStorage.setItem('wa.hidePrompts', '1'); } catch { /* storage unavailable */ }
}

const byId = new Map(PROMPTS.map((p) => [p.id, p]));

export const promptState = (w) => ({ answered: {}, dismissed: [], custom: [], ...(w?.prompts || {}) });

// Turn a prompt key into displayable text (null if it no longer resolves).
export function resolvePrompt(wid, key) {
  const w = store.world(wid);
  const [kind, id, aboutId] = String(key || '').split(':');
  if (kind === 'c') {
    const c = promptState(w).custom.find((x) => x.id === id);
    return c ? { key, text: c.text, cat: c.cat || 'custom', type: c.type || 'article', custom: true } : null;
  }
  const p = byId.get(id);
  if (!p) return null;
  if (!p.about) return { key, text: p.text, cat: p.cat, type: p.type };
  const about = store.article(aboutId);
  if (!about) return null;
  return { key, text: p.text.replace(`{${p.about}}`, about.title), cat: p.cat, type: p.type, about };
}

// Every prompt available in a world, with contextual prompts expanded once per matching article.
export function allPrompts(wid) {
  const w = store.world(wid);
  const st = promptState(w);
  const byType = {};
  for (const a of store.articlesOf(wid)) (byType[a.type] ||= []).push(a);
  const out = [];
  for (const p of PROMPTS) {
    if (!p.about) out.push(resolvePrompt(wid, `p:${p.id}`));
    else for (const a of byType[p.about] || []) out.push(resolvePrompt(wid, `p:${p.id}:${a.id}`));
  }
  for (const c of st.custom) out.push(resolvePrompt(wid, `c:${c.id}`));
  return out.filter(Boolean).map((p) => ({
    ...p,
    answers: (st.answered[p.key] || []).map((id) => store.article(id)).filter(Boolean),
    dismissed: st.dismissed.includes(p.key),
  }));
}

// Small deterministic PRNG so "today's prompt" is stable for a day.
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function pickPrompt(wid, { seed, exclude = [], cat } = {}) {
  const open = allPrompts(wid).filter((p) => !p.answers.length && !p.dismissed && !exclude.includes(p.key) && (!cat || p.cat === cat));
  if (!open.length) return null;
  // Favour contextual prompts a little: they're about the user's own world.
  const weighted = open.flatMap((p) => (p.about ? [p, p] : [p]));
  const rnd = seed ? seeded(seed)() : Math.random();
  return weighted[Math.floor(rnd * weighted.length)];
}

export const todaysPrompt = (wid) => pickPrompt(wid, { seed: wid + new Date().toDateString() });

export async function updatePromptState(wid, fn) {
  const w = store.world(wid);
  const st = structuredClone(promptState(w));
  fn(st);
  await store.save('worlds', { ...w, prompts: st });
}

export async function recordAnswer(wid, key, articleId) {
  await updatePromptState(wid, (st) => {
    const list = st.answered[key] || [];
    if (!list.includes(articleId)) st.answered[key] = [...list, articleId];
    st.dismissed = st.dismissed.filter((k) => k !== key);
  });
}

// Prompts an article was written for.
export function promptsAnsweredBy(wid, articleId) {
  const st = promptState(store.world(wid));
  return Object.entries(st.answered).filter(([, ids]) => ids.includes(articleId))
    .map(([key]) => resolvePrompt(wid, key)).filter(Boolean);
}
