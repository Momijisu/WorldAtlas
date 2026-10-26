// Guiding questions for each article template, shown in the editor.
// Each entry is a section heading plus the questions that section might answer.
// Choosing one inserts the heading into the article so the writer can fill it in.

const G = (h, q) => ({ h, q });

export const GUIDANCE = {
  character: [
    G('Appearance', 'What do people notice first about them? How do they dress, move and carry themselves?'),
    G('Personality', 'How do they treat people who can do nothing for them? What makes them laugh, and what makes them cold?'),
    G('Motivation', 'What do they want more than anything, and what are they willing to do to get it?'),
    G('Flaws', 'What is their greatest weakness, and when did it last cost them?'),
    G('History', 'Where did they come from? What single event shaped them most?'),
    G('Relationships', 'Who do they trust, who do they owe, and who would they never forgive?'),
    G('Skills', 'What are they unusually good at, and how did they learn it?'),
    G('Secrets', 'What are they hiding, and from whom?'),
    G('Voice', 'How do they speak? Is there a phrase they use too often?'),
    G('Daily life', 'What does an ordinary day look like for them?'),
  ],
  location: [
    G('Geography', 'What is the land like? What borders it, and what is it built on or around?'),
    G('First impressions', 'What do travellers see, hear and smell when they arrive?'),
    G('History', 'Who founded it, and why there? What has it survived?'),
    G('Government', 'Who rules it, officially and in practice? How are laws enforced?'),
    G('Population', 'Who lives here? Who is welcome, and who is not?'),
    G('Economy', 'What does it produce, buy and sell? Where does the money come from?'),
    G('Districts & landmarks', 'What are its distinct areas and notable buildings?'),
    G('Defences', 'How is it protected, and what is it most vulnerable to?'),
    G('Culture', 'What festivals, customs or local quirks define it?'),
    G('Dangers', 'What should a visitor be careful of?'),
  ],
  organization: [
    G('Purpose', 'Why does it exist? What does it claim to do, and what does it actually do?'),
    G('Structure', 'How is it organised? Who holds power, and how is it passed on?'),
    G('History', 'How was it founded, and what turning points changed it?'),
    G('Membership', 'Who joins, how are they recruited, and what is asked of them?'),
    G('Resources', 'Where do its money, people and influence come from?'),
    G('Symbols & rituals', 'What emblems, uniforms, oaths or ceremonies mark it out?'),
    G('Allies & enemies', 'Who does it work with, and who works against it?'),
    G('Public perception', 'What do ordinary people think of it? Are they right?'),
    G('Secrets', 'What would damage it if it became known?'),
  ],
  species: [
    G('Appearance', 'What do they look like? How do they differ between individuals, sexes or ages?'),
    G('Habitat', 'Where do they live, and what range do they need?'),
    G('Diet & behaviour', 'What do they eat, and how do they find it? Are they solitary or social?'),
    G('Life cycle', 'How are they born, how do they grow, how long do they live?'),
    G('Senses & abilities', 'What can they perceive or do that others cannot?'),
    G('Society', 'If they are intelligent, how do they organise themselves?'),
    G('Relationship with others', 'How do other peoples hunt, fear, keep or worship them?'),
    G('Origins', 'Where did they come from, according to science, myth or themselves?'),
  ],
  item: [
    G('Description', 'What does it look like, feel like, weigh?'),
    G('Origin', 'Who made it, when, and why?'),
    G('Properties', 'What can it do? What are its limits or costs?'),
    G('History', 'Who has owned it, and what happened to them?'),
    G('Value', 'What is it worth, and to whom?'),
    G('Current whereabouts', 'Where is it now, and who knows that?'),
    G('Legends', 'What do people believe about it that may not be true?'),
  ],
  event: [
    G('Background', 'What led up to it? What tensions had been building?'),
    G('What happened', 'How did it unfold, step by step?'),
    G('Key figures', 'Who took part, and what did each of them want?'),
    G('Turning point', 'What moment decided the outcome?'),
    G('Aftermath', 'What changed immediately afterwards?'),
    G('Legacy', 'How is it remembered, commemorated or disputed today?'),
    G('Contested accounts', 'How do the different sides tell the story?'),
  ],
  religion: [
    G('Beliefs', 'What do followers believe about the world, the gods and the afterlife?'),
    G('Deities', 'Who or what is worshipped? What do they ask of the faithful?'),
    G('Practices', 'How do followers pray, celebrate, fast or sacrifice?'),
    G('Clergy', 'Who leads the faith, how are they chosen and what are they forbidden?'),
    G('Holy places & texts', 'Where do the faithful gather, and what do they read?'),
    G('History', 'How did the faith begin and spread? What schisms has it suffered?'),
    G('Taboos', 'What is forbidden, and how are transgressors treated?'),
    G('Place in society', 'How much power does it hold, and how do rulers treat it?'),
  ],
  culture: [
    G('Values', 'What do they admire most, and what do they consider shameful?'),
    G('Language', 'What do they speak? What sayings or words are distinctive?'),
    G('Family & kinship', 'How are families structured? Who raises the children?'),
    G('Food & drink', 'What do they eat on an ordinary day, and at a feast?'),
    G('Dress', 'What do they wear, and what does clothing signal?'),
    G('Arts', 'What music, stories, crafts or games are theirs?'),
    G('Rites of passage', 'How do they mark birth, adulthood, marriage and death?'),
    G('Relations with outsiders', 'How do they treat strangers and neighbours?'),
  ],
  lore: [
    G('Summary', 'What is this, in a sentence or two?'),
    G('Origin', 'Who wrote, told or discovered it, and when?'),
    G('Content', 'What does it say or describe?'),
    G('Interpretations', 'How do different people read or explain it?'),
    G('Truth', 'How much of it is true? What does it get wrong?'),
    G('Influence', 'What has it changed, inspired or justified?'),
  ],
  article: [
    G('Overview', 'What is this, and why does it matter to your world?'),
    G('Details', 'What would someone need to know to understand it?'),
    G('History', 'How did it come to be?'),
    G('Significance', 'Who cares about it, and why?'),
    G('Connections', 'What other people, places or events is it tied to?'),
  ],
};

export const guidanceFor = (type) => GUIDANCE[type] || GUIDANCE.article;

export function guidanceEnabled() {
  try { return localStorage.getItem('wa.hideGuidance') !== '1'; } catch { return true; }
}
export function setGuidanceEnabled(on) {
  try { on ? localStorage.removeItem('wa.hideGuidance') : localStorage.setItem('wa.hideGuidance', '1'); } catch { /* storage unavailable */ }
}

// Headings already present in a Markdown body (lowercased), to tick off covered sections.
export function headingsIn(body) {
  return new Set([...String(body || '').matchAll(/^#{1,4}\s+(.+?)\s*#*$/gm)].map((m) => m[1].trim().toLowerCase()));
}
