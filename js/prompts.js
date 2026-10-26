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
  // ---- Expanded library ----------------------------------------------------
  // People
  P('xpe01', 'people', 'character', 'Who delivers bad news for a living, and how do people treat them?'),
  P('xpe02', 'people', 'character', 'Describe someone who has spent their life guarding a door. What is behind it?'),
  P('xpe03', 'people', 'character', 'Write about a famous hero as seen by the people who cleaned up after them.'),
  P('xpe04', 'people', 'character', 'Who is the oldest living person anyone knows of, and what do they remember that others have forgotten?'),
  P('xpe05', 'people', 'character', 'Introduce someone who is famous for a deed they did not actually do.'),
  P('xpe06', 'people', 'character', 'Describe a mapmaker whose maps are always slightly, deliberately wrong.'),
  P('xpe07', 'people', 'character', 'Who raises orphans, and what do the children grow up believing?'),
  P('xpe08', 'people', 'character', 'Write about a cook whose food is said to change the mood of a room.'),
  P('xpe09', 'people', 'character', 'Describe a soldier who deserted, and why they will not say what they saw.'),
  P('xpe10', 'people', 'character', 'Who is the person everyone goes to when they need something lost to be found?'),
  P('xpe11', 'people', 'character', 'Introduce a scholar who has devoted their life to a question everyone else thinks is foolish.'),
  P('xpe12', 'people', 'character', 'Write about someone who was exiled and has just been allowed to return.'),
  P('xpe13', 'people', 'character', 'Describe a twin, sibling or double who lives in someone else’s shadow.'),
  P('xpe14', 'people', 'character', 'Who tells the stories at the fire, and which story do they refuse to tell?'),
  P('xpe15', 'people', 'character', 'Write about an executioner. How do they live with their work, and how do others live with them?'),
  P('xpe16', 'people', 'character', 'Describe a merchant who trades in something that should not be for sale.'),
  P('xpe17', 'people', 'character', 'Who has the best-kept garden, library or collection in the land, and what is missing from it?'),
  P('xpe18', 'people', 'character', 'Introduce someone who changed sides in a war and was trusted by neither.'),
  P('xpc11', 'people', 'character', 'What is {character} most proud of, and is it something they should be proud of?', 'character'),
  P('xpc12', 'people', 'character', 'Describe the first time {character} killed, lied or broke a promise.', 'character'),
  P('xpc13', 'people', 'character', 'What would {character} do with a single free day and no obligations?', 'character'),
  P('xpc14', 'people', 'character', 'Who does {character} miss?', 'character'),
  P('xpc15', 'people', 'character', 'What does {character} believe about the gods, the dead or fate?', 'character'),
  P('xpc16', 'people', 'character', 'Describe {character} through the eyes of someone who dislikes them.', 'character'),
  P('xpc17', 'people', 'character', 'What habit of {character}’s drives the people around them to distraction?', 'character'),
  P('xpc18', 'people', 'character', 'What did {character} want to be when they were a child?', 'character'),

  // Places
  P('xpl01', 'places', 'location', 'Describe a bridge, pass or ford that someone has always charged a toll to cross.'),
  P('xpl02', 'places', 'location', 'Write about a village where every house has the same strange feature.'),
  P('xpl03', 'places', 'location', 'Where do the rich go to spend their summers, and who keeps it running when they leave?'),
  P('xpl04', 'places', 'location', 'Describe a library, archive or vault that no one has fully explored.'),
  P('xpl05', 'places', 'location', 'Write about a market that only opens at night.'),
  P('xpl06', 'places', 'location', 'Describe a city built on top of an older one. What still lives below?'),
  P('xpl07', 'places', 'location', 'Where is the edge of the known world, and what do people believe lies past it?'),
  P('xpl08', 'places', 'location', 'Describe a harbour and the ships that crowd it.'),
  P('xpl09', 'places', 'location', 'Write about a place where a great battle was fought. What grows there now?'),
  P('xpl10', 'places', 'location', 'Describe an abandoned town. Why did everyone leave on the same day?'),
  P('xpl11', 'places', 'location', 'Where do people go to be healed, and what do they leave behind?'),
  P('xpl12', 'places', 'location', 'Describe a fortress that has never been taken. Why not?'),
  P('xpl13', 'places', 'location', 'Write about an island with a single, unusual law.'),
  P('xpl14', 'places', 'location', 'Describe the poorest district of a great city, and what it gives the rest of the city.'),
  P('xpl15', 'places', 'location', 'Where is the loudest place in your world? Where is the quietest?'),
  P('xpl16', 'places', 'location', 'Describe a road that pilgrims, merchants and armies have all used.'),
  P('xplc8', 'places', 'location', 'What is {location} famous for, and what would locals rather it were famous for?', 'location'),
  P('xplc9', 'places', 'location', 'Describe a festival day in {location}.', 'location'),
  P('xplc10', 'places', 'location', 'Who in {location} is everyone afraid of?', 'location'),
  P('xplc11', 'places', 'location', 'What does {location} import that it could not survive without?', 'location'),
  P('xplc12', 'places', 'location', 'Describe {location} in the dead of winter, or at the height of the dry season.', 'location'),

  // Power & factions
  P('xpw01', 'power', 'organization', 'Describe a council where every member holds a veto. How does anything get decided?'),
  P('xpw02', 'power', 'organization', 'Write about a dynasty whose claim to the throne rests on a single document.'),
  P('xpw03', 'power', 'organization', 'Who controls the water, roads or harbours, and how do they use that power?'),
  P('xpw04', 'power', 'organization', 'Describe a trading company that has become more powerful than the nation that chartered it.'),
  P('xpw05', 'power', 'organization', 'Write about a group of rebels who have already won. What now?'),
  P('xpw06', 'power', 'organization', 'Describe a brotherhood or sisterhood bound by a debt rather than a belief.'),
  P('xpw07', 'power', 'organization', 'Who trains the next generation of rulers, and what do they teach first?'),
  P('xpw08', 'power', 'organization', 'Describe a guard, watch or police force that answers to no one.'),
  P('xpw09', 'power', 'organization', 'Write about an alliance held together by a marriage nobody wanted.'),
  P('xpw10', 'power', 'organization', 'Describe a guild of messengers, couriers or navigators. What do they refuse to carry?'),
  P('xpw11', 'power', 'organization', 'Who keeps the peace between rival powers, and how neutral are they really?'),
  P('xpw12', 'power', 'organization', 'Describe how a commoner might rise to real power, and what usually stops them.'),
  P('xpw13', 'power', 'organization', 'Write about a royal court: its etiquette, factions and favourites.'),
  P('xpwc7', 'power', 'organization', 'What does {organization} want ten years from now?', 'organization'),
  P('xpwc8', 'power', 'organization', 'Describe a new recruit’s first week in {organization}.', 'organization'),
  P('xpwc9', 'power', 'organization', 'What rule of {organization} is quietly ignored by its own leaders?', 'organization'),
  P('xpwc10', 'power', 'organization', 'Who in {organization} is most likely to lead it next?', 'organization'),

  // Faith & myth
  P('xfa01', 'faith', 'religion', 'Describe a saint, prophet or holy fool and the miracle attributed to them.'),
  P('xfa02', 'faith', 'religion', 'What do people offer at a shrine, and what do they ask for in return?'),
  P('xfa03', 'faith', 'lore', 'Tell the myth of how fire, death or language came into the world.'),
  P('xfa04', 'faith', 'religion', 'Describe a monastery, convent or retreat and the vow its members take.'),
  P('xfa05', 'faith', 'religion', 'Write about a god who is worshipped in secret because the faith is outlawed.'),
  P('xfa06', 'faith', 'religion', 'How do the faithful explain suffering and injustice?'),
  P('xfa07', 'faith', 'lore', 'Describe a trickster figure from folklore and their most famous trick.'),
  P('xfa08', 'faith', 'religion', 'What relic do the faithful most want to recover?'),
  P('xfa09', 'faith', 'religion', 'Describe an oracle. How do they speak, and who interprets them?'),
  P('xfa10', 'faith', 'lore', 'Write about a spirit of a particular place: a river, mountain or crossroads.'),
  P('xfa11', 'faith', 'religion', 'Describe a pilgrimage and what pilgrims are expected to endure.'),
  P('xfa12', 'faith', 'religion', 'How do rival faiths regard one another, and where do they meet in peace?'),
  P('xfa13', 'faith', 'lore', 'What do people believe happens during an eclipse, comet or other omen?'),
  P('xfa14', 'faith', 'religion', 'Write about a temple that has been converted to serve a different god.'),
  P('xfac4', 'faith', 'religion', 'What does {religion} teach about strangers and outsiders?', 'religion'),
  P('xfac5', 'faith', 'religion', 'Describe a schism or splinter sect within {religion}.', 'religion'),
  P('xfac6', 'faith', 'religion', 'What is a child raised in {religion} taught first?', 'religion'),

  // History
  P('xhi01', 'history', 'event', 'Describe the coronation, election or succession that went wrong.'),
  P('xhi02', 'history', 'event', 'Write about the first contact between two peoples.'),
  P('xhi03', 'history', 'event', 'What city burned, and who was blamed for it?'),
  P('xhi04', 'history', 'event', 'Describe a golden age. Who paid for it?'),
  P('xhi05', 'history', 'event', 'Write about a famous voyage, expedition or march.'),
  P('xhi06', 'history', 'event', 'Describe a siege from the point of view of the besieged.'),
  P('xhi07', 'history', 'event', 'What was the longest winter, drought or flood ever recorded?'),
  P('xhi08', 'history', 'event', 'Describe the collapse of an empire, kingdom or great house.'),
  P('xhi09', 'history', 'event', 'Write about a peace that was signed and then immediately broken.'),
  P('xhi10', 'history', 'event', 'What invention, spell or discovery was suppressed, and by whom?'),
  P('xhi11', 'history', 'event', 'Describe a trial that divided a nation.'),
  P('xhi12', 'history', 'event', 'Write about a mass disappearance that has never been explained.'),
  P('xhi13', 'history', 'event', 'Describe a famous wedding, funeral or feast and what happened there.'),
  P('xhi14', 'history', 'event', 'What historical event do schoolchildren learn about first?'),
  P('xhi15', 'history', 'lore', 'Write about a period of history that is missing from the records. Who removed it?'),
  P('xhic3', 'history', 'event', 'What is the worst thing that ever happened in {location}?', 'location'),
  P('xhic4', 'history', 'event', 'Describe the moment {character} became famous, or infamous.', 'character'),
  P('xhic5', 'history', 'event', 'What victory does {organization} celebrate every year?', 'organization'),

  // Culture & daily life
  P('xcu01', 'culture', 'culture', 'What do people do on a rest day?'),
  P('xcu02', 'culture', 'culture', 'Describe a street food and the person who sells the best version of it.'),
  P('xcu03', 'culture', 'culture', 'How are guests welcomed into a home, and what must a guest never do?'),
  P('xcu04', 'culture', 'culture', 'What jobs are considered unclean, and who does them anyway?'),
  P('xcu05', 'culture', 'culture', 'Describe a popular song and the scandal behind it.'),
  P('xcu06', 'culture', 'culture', 'How are names chosen, and can a person change theirs?'),
  P('xcu07', 'culture', 'culture', 'What does a typical home look like inside? Where does the family gather?'),
  P('xcu08', 'culture', 'culture', 'Describe a sport or contest that draws huge crowds.'),
  P('xcu09', 'culture', 'culture', 'What gifts are given, and on what occasions? What gift would be an insult?'),
  P('xcu10', 'culture', 'culture', 'How do people court one another?'),
  P('xcu11', 'culture', 'culture', 'Describe a common insult or curse, and what it actually means.'),
  P('xcu12', 'culture', 'culture', 'What is drunk, smoked or chewed, and where is it frowned upon?'),
  P('xcu13', 'culture', 'culture', 'How are the sick and elderly cared for?'),
  P('xcu14', 'culture', 'culture', 'Describe how news and gossip travel through a town.'),
  P('xcu15', 'culture', 'culture', 'What do people collect, and why?'),
  P('xcu16', 'culture', 'culture', 'Describe the school day of an ordinary child, if they go to school at all.'),
  P('xcu17', 'culture', 'culture', 'What is the punishment for theft, and is it the same for everyone?'),
  P('xcu18', 'culture', 'culture', 'Describe a tattoo, scar or mark that carries meaning.'),
  P('xcu19', 'culture', 'culture', 'What jokes do people tell about their neighbours?'),
  P('xcu20', 'culture', 'culture', 'How do people dress for mourning, celebration and work?'),
  P('xcuc3', 'culture', 'culture', 'What does {culture} eat at its most important feast?', 'culture'),
  P('xcuc4', 'culture', 'culture', 'How does {culture} tell its own history?', 'culture'),
  P('xcuc5', 'culture', 'culture', 'What would a visitor from {culture} find rude elsewhere?', 'culture'),

  // Magic & technology
  P('xma01', 'magic', 'lore', 'Who is allowed to use magic, and who decides?'),
  P('xma02', 'magic', 'lore', 'Describe how a magic user or engineer is trained, from first lesson to mastery.'),
  P('xma03', 'magic', 'lore', 'What does magic look, sound or smell like when it is used?'),
  P('xma04', 'magic', 'lore', 'Describe a common spell, charm or device that every household has.'),
  P('xma05', 'magic', 'lore', 'What can magic or technology simply not do, no matter how skilled the user?'),
  P('xma06', 'magic', 'lore', 'Write about someone born without the ability everyone else takes for granted.'),
  P('xma07', 'magic', 'lore', 'Describe a place where magic behaves strangely, or does not work at all.'),
  P('xma08', 'magic', 'lore', 'How is time measured, and how accurately?'),
  P('xma09', 'magic', 'lore', 'Describe a weapon of war that changed how wars are fought.'),
  P('xma10', 'magic', 'lore', 'What material is precious because of what can be made from it?'),
  P('xma11', 'magic', 'lore', 'Write about an artificial being: a construct, golem, automaton or homunculus.'),
  P('xma12', 'magic', 'lore', 'How are buildings lit and heated at night?'),
  P('xma13', 'magic', 'lore', 'Describe a ritual that requires many people to perform.'),
  P('xma14', 'magic', 'lore', 'What happens to a person who uses too much magic, or works too long with dangerous machines?'),
  P('xma15', 'magic', 'lore', 'Describe how food is preserved, stored and transported.'),
  P('xma16', 'magic', 'lore', 'What is the most ambitious construction project ever attempted?'),
  P('xma17', 'magic', 'lore', 'How do people navigate at sea, underground or in the sky?'),
  P('xma18', 'magic', 'lore', 'Describe a school of magic or engineering that rivals another. What is their quarrel?'),
  P('xma19', 'magic', 'lore', 'What everyday chore has magic or technology made obsolete, and who lost their living?'),
  P('xma20', 'magic', 'lore', 'Describe a forbidden book of spells, plans or formulae.'),
  P('xma21', 'magic', 'lore', 'How are magical or technological accidents cleaned up?'),
  P('xma22', 'magic', 'lore', 'Describe a device or working that lets people see far away.'),
  P('xma23', 'magic', 'lore', 'Who funds research, and what do they expect in return?'),
  P('xma24', 'magic', 'lore', 'What did ancient people know that has since been lost?'),
  P('xma25', 'magic', 'lore', 'Describe how printing, writing or record-keeping works.'),
  P('xmac1', 'magic', 'lore', 'What can {character} do that most people cannot?', 'character'),
  P('xmac2', 'magic', 'lore', 'What does {organization} know about magic or technology that others do not?', 'organization'),

  // Nature & creatures
  P('xna01', 'nature', 'species', 'Describe a creature that migrates. Where does it go, and what follows it?'),
  P('xna02', 'nature', 'species', 'What insect, bird or small animal is considered lucky, and which unlucky?'),
  P('xna03', 'nature', 'species', 'Describe a crop that a whole region depends on, and the blight that threatens it.'),
  P('xna04', 'nature', 'species', 'Write about a creature that mimics, deceives or lures its prey.'),
  P('xna05', 'nature', 'species', 'What creature do people ride, and how is it tamed?'),
  P('xna06', 'nature', 'location', 'Describe a river and everything that depends on it.'),
  P('xna07', 'nature', 'species', 'Write about a tree, flower or fungus with a cultural meaning.'),
  P('xna08', 'nature', 'species', 'Describe a creature that lives alongside people in cities.'),
  P('xna09', 'nature', 'location', 'What natural wonder draws travellers from afar?'),
  P('xna10', 'nature', 'species', 'Describe the largest creature known to exist.'),
  P('xna11', 'nature', 'species', 'Write about a creature that is sacred to one people and vermin to another.'),
  P('xna12', 'nature', 'location', 'Describe a mountain range and the people and beasts who cross it.'),
  P('xna13', 'nature', 'species', 'What creature is kept for war, and how is it trained?'),
  P('xna14', 'nature', 'species', 'Describe a sea creature that sailors tell stories about.'),
  P('xna15', 'nature', 'location', 'What do the seasons look like, and which one do people dread?'),
  P('xna16', 'nature', 'species', 'Describe a disease that affects animals or plants rather than people.'),
  P('xna17', 'nature', 'species', 'Write about a creature that was created rather than born.'),
  P('xna18', 'nature', 'location', 'Describe a swamp, cave system or deep forest from the inside.'),
  P('xnac4', 'nature', 'species', 'What do {species} fear?', 'species'),
  P('xnac5', 'nature', 'species', 'How do {species} communicate?', 'species'),

  // Objects & artifacts
  P('xob01', 'objects', 'item', 'Describe a coin and the faces, words or symbols on it.'),
  P('xob02', 'objects', 'item', 'Write about a key that no one knows the lock for.'),
  P('xob03', 'objects', 'item', 'Describe a map that is believed to lead somewhere impossible.'),
  P('xob04', 'objects', 'item', 'What armour is most prized, and why?'),
  P('xob05', 'objects', 'item', 'Describe a ship with a name, a reputation and a curse.'),
  P('xob06', 'objects', 'item', 'Write about a mask worn for a ceremony, a crime or a performance.'),
  P('xob07', 'objects', 'item', 'Describe a piece of jewellery that marks someone’s rank or family.'),
  P('xob08', 'objects', 'item', 'What is the most prized drink, and what makes a vintage great?'),
  P('xob09', 'objects', 'item', 'Describe a banner, flag or standard and what it means to lose it.'),
  P('xob10', 'objects', 'item', 'Write about a letter that changed the course of a war.'),
  P('xob11', 'objects', 'item', 'Describe a toy or game piece that has been passed down for generations.'),
  P('xob12', 'objects', 'item', 'What object do travellers always carry for luck or protection?'),
  P('xob13', 'objects', 'item', 'Describe a throne, seat of judgement or chair of office.'),
  P('xob14', 'objects', 'item', 'Write about a tool that can only be used by one person.'),
  P('xob15', 'objects', 'item', 'Describe a famous painting, statue or tapestry and what it really depicts.'),
  P('xob16', 'objects', 'item', 'What object was stolen in the most famous theft in history?'),
  P('xob17', 'objects', 'item', 'Describe a vessel: a cup, bowl or urn with a ceremonial purpose.'),
  P('xob18', 'objects', 'item', 'Write about an object made from the remains of something extraordinary.'),
  P('xobc3', 'objects', 'item', 'What does {character} own that they would never sell?', 'character'),
  P('xobc4', 'objects', 'item', 'What treasure does {organization} guard?', 'organization'),

  // Conflict & intrigue
  P('xco01', 'conflict', 'article', 'Describe a blackmail scheme and who is caught in it.'),
  P('xco02', 'conflict', 'event', 'Write about a riot: what started it, and what ended it.'),
  P('xco03', 'conflict', 'organization', 'Who smuggles what, and where does it cross the border?'),
  P('xco04', 'conflict', 'article', 'Describe a poisoning, and how it was discovered.'),
  P('xco05', 'conflict', 'event', 'Write about a succession crisis with three rightful heirs.'),
  P('xco06', 'conflict', 'article', 'Describe a code, cipher or secret language used by conspirators.'),
  P('xco07', 'conflict', 'organization', 'Who are the assassins, and what are their rules?'),
  P('xco08', 'conflict', 'event', 'Write about a mutiny at sea or a desertion in the field.'),
  P('xco09', 'conflict', 'article', 'Describe a debt so large it threatens to bring down a nation.'),
  P('xco10', 'conflict', 'article', 'Write about a promise made under duress that someone is now trying to enforce.'),
  P('xco11', 'conflict', 'event', 'Describe a famous heist.'),
  P('xco12', 'conflict', 'article', 'What do two neighbouring peoples each believe about the other that is not true?'),
  P('xco13', 'conflict', 'article', 'Write about a hostage, ward or political prisoner raised at a rival’s court.'),
  P('xco14', 'conflict', 'event', 'Describe a cold war: two powers who cannot fight but cannot make peace.'),
  P('xco15', 'conflict', 'article', 'Who profits from war, and how do they keep it going?'),
  P('xco16', 'conflict', 'article', 'Describe a sacred truce and what happens to those who break it.'),
  P('xcoc4', 'conflict', 'character', 'What is {character} guilty of that no one has discovered?', 'character'),
  P('xcoc5', 'conflict', 'event', 'Describe a time {organization} was publicly humiliated.', 'organization'),
  P('xcoc6', 'conflict', 'location', 'Who in {location} would sell it out to an enemy, and for what price?', 'location'),
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
