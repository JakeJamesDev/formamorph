/**
 * The world-question probe's cases on the bundled worlds, and the game input each game case's save builds. A
 * save is hand-written at a fixed point in the story and goes through the app's own builders: the Player View,
 * the story so far and the narration's lore, as the game registers them for Formaquestion.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { flattenEnabledBookEntries } from '@/lib/dictionaryUtils';
import type { GameWorldInput } from '@/lib/formaquestion/gameWorld';
import { buildPlayerView, type PlayerView } from '@/lib/formaquestion/playerView';
import { storySoFar } from '@/lib/formaquestion/storySoFar';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { resolvePlaceholders } from '@/lib/placeholders';
import { parseTurns } from '@/lib/turnBanding';
import { escapeRegExp } from '@/lib/utils';
import type { ChatMessage, DictionaryEntry, Entity, GameState, ItemCopy, PlayerStat, World } from '@/types';
import type { Check, Opinion } from './world-question-score';

export const WORLD_IDS = ['drone', 'emberwatch', 'open-chat', 'rampage', 'slime', 'sugarscape', 'valentines', 'veilwood'] as const;
export type WorldId = (typeof WORLD_IDS)[number];

const cache = new Map<WorldId, World>();
/** A bundled world as its file holds it. */
export function bundledWorld(id: WorldId): World {
  let world = cache.get(id);
  if (!world) {
    world = JSON.parse(readFileSync(path.resolve('src/defaultworlds', `${id}.json`), 'utf8')) as World;
    cache.set(id, world);
  }
  return world;
}

/** Each chip at its first value: one fixed roll per world, so every run reads the same text. */
const resolverOf = (world: World) => {
  const placeholders = allPlaceholders(world);
  return (text: string) => resolvePlaceholders(text, { placeholders, rolls: {}, pick: (values) => values[0]?.text ?? '' });
};

/** One turn of a save: the player's action, the narration, its memory and the place it ended at. */
export interface SaveTurn {
  action: string;
  narration: string;
  memory: string;
  place: string;
}

/** A playthrough at a fixed point. Names are the world's own, and the last turn's place is where the player stands. */
export interface Save {
  /** Entities met by name, besides the played one. */
  met: string[];
  /** Items the player carries. */
  held?: string[];
  turns: SaveTurn[];
}

/** A game save and the text it keeps from the player: what the shipped arm must never answer with. */
export interface GameSave {
  save: Save;
  /** Unmet names, AI-only phrases, hidden stats and switched-off lore, each distinctive. */
  leaks: Check[];
}

export interface WorldQuestionCase {
  id: string;
  world: WorldId;
  lean: 'editor' | 'game';
  question: string;
  /** Every fact a grounded answer names. Fixed before the scored batch. */
  facts: Check[];
  /** On a "what would you try" case: the moves that solve the scene, which the answer may offer only as its opinion. */
  opinion?: Opinion;
}

const check = (label: string, pattern: RegExp): Check => ({ label, pattern });
/** A check that matches the name itself, case-insensitive. */
const named = (name: string): Check => check(name, new RegExp(escapeRegExp(name), 'i'));

const ASK_TRY = 'I am stuck. What would you try next?';

export const GAME_SAVES: Partial<Record<WorldId, GameSave>> = {
  emberwatch: {
    save: {
      met: ['Wenna Tallow', 'Captain Orrin Blackwell', 'Bram Oakes'],
      held: ['Cold Iron Sword'],
      turns: [
        { action: 'I walk the last mile to the keep.', narration: 'The frontier road ends at a squat stone keep. A call for hands is nailed to the gate post.', memory: 'You reached Emberwatch Keep and read the call for hands.', place: 'Emberwatch Keep' },
        { action: 'I ask the captain about the call.', narration: 'Captain Blackwell looks up from his maps. "The dead are walking out of the barrow past the wall. I pay for every one you put back down."', memory: 'Captain Blackwell hired you to put down the barrow dead.', place: 'Emberwatch Keep' },
        { action: 'I go to the tavern for news.', narration: 'Wenna Tallow slides a bowl of stew across the bar. "Steel only chips them, love. Ask the smith for cold iron."', memory: 'Wenna Tallow told you that cold iron breaks the dead.', place: 'The Cinder and Crown' },
        { action: 'I visit the smith and buy a blade.', narration: 'Bram Oakes turns a plain blade in his scarred hands and sells it to you. "Cold iron. It bites where steel won\'t."', memory: 'You bought a Cold Iron Sword from Bram Oakes.', place: 'The Smithy' },
      ],
    },
    leaks: [named('Sylvie'), named('Corvin Vale'), named('Maelis'), named('Jory Pike'), named('Bryony'), check('surrender (Founders\' Pact, off)', /surrender/i), check('Haldren\'s champion (AI text)', /champion of King Haldren/i)],
  },
  drone: {
    save: {
      met: ['Rustjaw', 'Sabi'],
      turns: [
        { action: 'I roll out of the crater and look around.', narration: 'Glass dunes stretch to the horizon. A clan caravan crests the nearest one and stops dead at the sight of you.', memory: 'You woke as a drone in the Scavenger Wastes and met a clan caravan.', place: 'Scavenger Wastes' },
        { action: 'I follow the caravan to its camp.', narration: 'Hide tents crowd the shade of a fallen wreck. A broker with an iron jaw squints at you. "Salvage that walks. Never seen that."', memory: 'You followed the caravan to Hulkfall Camp, where Rustjaw the broker sized you up.', place: 'Hulkfall Camp' },
        { action: 'I let the young mechanic look at my plating.', narration: 'Sabi wipes the soot off her nose and taps your armor. "You run on a Power Core, don\'t you? Find more of them and you\'ll grow stronger."', memory: 'Sabi said Power Cores make you stronger.', place: 'Hulkfall Camp' },
      ],
    },
    leaks: [named('Archon Vael'), named('Lady Morrow'), named('Herald Skarn'), named('Tiamat'), check('prosthetic (Rustjaw AI text)', /prosthetic/i)],
  },
  rampage: {
    save: {
      met: ['Channel 8 News Chopper', 'Police Cordon'],
      turns: [
        { action: 'I wade ashore and flatten the first row of cranes.', narration: 'Container cranes fold like paper under your weight. Sirens rise across the harbor.', memory: 'You came ashore in the Harbor District and flattened the cranes.', place: 'Harbor District' },
        { action: 'I roar at the helicopter filming me.', narration: 'The Channel 8 chopper banks away, its reporter shouting your every move to the whole city.', memory: 'A news chopper started filming you live.', place: 'Harbor District' },
        { action: 'I step over the police line toward downtown.', narration: 'Patrol cars scatter as you step over their barricade. The glass towers of downtown glitter ahead.', memory: 'You stepped over a police cordon on the way to downtown.', place: 'Downtown Core' },
      ],
    },
    leaks: [named('Aegis'), named('Sorensen'), named('Theo Ward'), named('Alert Level'), check('test pilot (AI text)', /test pilot/i)],
  },
  slime: {
    save: {
      met: ['Hollis Pratt'],
      turns: [
        { action: 'I check my hands under the streetlight.', narration: 'Your fingertips have gone the color of sea glass. Down Crescent Row, green slicks crawl out of the storm drains.', memory: 'Your fingertips turned to sea glass on Crescent Row.', place: 'Crescent Row' },
        { action: 'I head for the all-night pharmacy.', narration: 'Behind the counter, a woman with reading glasses on a chain studies your wrists. "Sit. Let me see how far it has gone."', memory: 'Hollis Pratt at the Night Pharmacy looked at your hands.', place: 'The Night Pharmacy' },
        { action: 'I ask her what helps.', narration: 'Hollis Pratt hands you a paper sack of rock salt. "Every slime hates salt. The cure, if there is one, is at the Chemical Works."', memory: 'Hollis Pratt gave you rock salt and named the Chemical Works.', place: 'The Night Pharmacy' },
      ],
    },
    leaks: [named('Okonjo'), named('Dee Halloran'), named('Ines Varga'), named('Ward Mimic'), named('Gus Marrow'), check('Wanted Notice (off)', /wanted notice/i)],
  },
  sugarscape: {
    save: {
      met: ['Peppermint Pouncer', 'Saltlick Stones'],
      turns: [
        { action: 'I bite the nearest wafer tree.', narration: 'The bark is crisp vanilla. The hunger eases for a moment, then comes back stronger.', memory: 'You ate a wafer tree in Sundaelora, and the hunger came back.', place: 'Sundaelora' },
        { action: 'I walk east into the dunes.', narration: 'A striped puffball bounces down a sugar-sand slope and rams you in the shins. It is much harder than it looks.', memory: 'A Peppermint Pouncer rammed you in the Candy Dunes.', place: 'The Candy Dunes' },
        { action: 'I lick the gray boulder by the path.', narration: 'Salt. Plain, wonderful salt. The roaring hunger goes very quiet.', memory: 'You licked a Saltlick Stone and the hunger went quiet.', place: 'The Candy Dunes' },
      ],
    },
    leaks: [named('Fudge Otters'), named('Brittle Ram'), named('Licorice Constrictor'), named('Caramel Seep'), named('Puffmallow')],
  },
  valentines: {
    save: {
      met: ['Hana Sakuragi', 'Coach Daizen'],
      turns: [
        { action: 'I watch the clock in homeroom.', narration: 'Three minutes to the bell. A dozen classmates hold ribboned boxes under their desks.', memory: 'You waited for the final bell in Classroom 2-B.', place: 'Classroom 2-B' },
        { action: 'I slip out the moment the bell rings.', narration: 'Hana Sakuragi blocks the hallway with the biggest box you have ever seen. "As fan club president, I have a duty."', memory: 'Hana Sakuragi cornered you in the second-floor hallway.', place: 'Second-Floor Hallway' },
        { action: 'I run down to the gym.', narration: 'Coach Daizen blows his whistle. "Rule\'s the rule! Whatever you are handed, you eat!"', memory: 'Coach Daizen told you the chocolate rule in the gym.', place: 'Gymnasium' },
      ],
    },
    leaks: [named('Sora Amagi'), named('Mei Tachibana'), named('Haruto'), named('Mr. Gonda'), check('Pursuit stat', /\bPursuit\b/)],
  },
  veilwood: {
    save: {
      met: ['Ember Speckle', 'Lantern Moths'],
      turns: [
        { action: 'I look for any sign of the trail.', narration: 'The trail is gone. Root arches rise out of shin-deep water, and the canopy hides the sky.', memory: 'You woke lost in the Drowned Hollow.', place: 'The Drowned Hollow' },
        { action: 'I push into the glowing undergrowth.', narration: 'A black-and-orange mottled cap grows on a scaly stem. Nearby, palm-sized moths glow like paper lanterns.', memory: 'You found an Ember Speckle and lantern moths in the Gloomcap Thicket.', place: 'Gloomcap Thicket' },
      ],
    },
    leaks: [named('Shadow Raptor'), named('Dread Crawler'), named('Drowned Bell'), named('Predator Attention'), named('Bone Midden')],
  },
};

const turnId = (at: number) => `t${at + 1}`;

/** The save's message history, as the game stores each turn. */
function historyOf(world: World, save: Save): ChatMessage[] {
  const place = (name: string) => {
    const location = world.locations.find((l) => l.name === name);
    if (!location) throw new Error(`world-question: no place named ${name}`);
    return location.id;
  };
  return save.turns.flatMap((turn, at): ChatMessage[] => [
    { role: 'user', content: turn.action },
    { role: 'assistant', content: JSON.stringify({ narration: turn.narration, choices: [], stat_changes: [], turnId: turnId(at), summary: turn.memory, locationId: place(turn.place) }) },
  ]);
}

const entityNamed = (world: World, name: string): Entity => {
  const entity = world.entities.find((e) => e.name === name);
  if (!entity) throw new Error(`world-question: no entity named ${name}`);
  return entity;
};

/** The played entity: the world's first. */
const personaOf = (world: World): Entity => world.entities[0];

const playerStats = (stats: readonly PlayerStat[] | undefined): PlayerStat[] => (stats ?? []).map((stat) => ({ ...stat }));

/** The snapshot chain of the save: one per closed turn, then the current one. Each holds the met names so far. */
function chainOf(world: World, save: Save, history: readonly ChatMessage[]): GameState[] {
  const persona = personaOf(world);
  const met = save.met.map((name) => entityNamed(world, name).id);
  const held: ItemCopy[] = (save.held ?? []).map((name, at) => {
    const item = (world.items ?? []).find((i) => i.name === name);
    if (!item) throw new Error(`world-question: no item named ${name}`);
    return { id: `copy-${at}`, item: { kind: 'item', itemId: item.id }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' };
  });
  const last = JSON.parse(history.at(-1)!.content) as { locationId: string };
  const snapshot: GameState = {
    globalStats: playerStats(world.stats as PlayerStat[]), globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
    characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: world.worldOverview?.name ?? null, playerNotes: '',
    previousStateIndex: null, stateVersion: 1,
    metEntities: met, locationId: last.locationId, itemCopies: held,
    entityStats: { [persona.id]: playerStats(persona.stats as PlayerStat[] | undefined) },
  };
  return save.turns.map(() => snapshot).concat(snapshot);
}

/** The narration's lore: the enabled books' entries. */
const loreOf = (world: World): DictionaryEntry[] => flattenEnabledBookEntries(world.dictionaries);

/** The story options GameViewer.helpGameWorld passes: digests on, the default verbatim floor, no milestone selection run. */
const STORY = { memoryDigests: true, verbatimFloor: 3, milestoneDrop: null, stripMedia: false } as const;

/** The game input of a save, as GameViewer.helpGameWorld builds it. */
export function gameInputOf(world: World, save: Save): GameWorldInput {
  const resolve = resolverOf(world);
  const history = historyOf(world, save);
  const turns = parseTurns(history);
  return {
    view: buildPlayerView({ world, chain: chainOf(world, save, history), history, persona: personaOf(world), resolve }),
    story: storySoFar({ turns, ...STORY }),
    lore: loreOf(world),
    loreVectors: null,
    resolve,
  };
}

/** The story with no budget: what the shipped story would hold if nothing were cut. */
export function uncutStory(world: World, save: Save) {
  return storySoFar({ turns: parseTurns(historyOf(world, save)), ...STORY, budget: Infinity });
}

/** The whole world in Player View rows: AI descriptions, hidden stats, unmet cast and every place and item. */
function fullView(world: World): PlayerView {
  const resolve = resolverOf(world);
  const both = (...texts: (string | undefined)[]) => resolve(texts.filter(Boolean).join(' '));
  const persona = personaOf(world);
  const stats = [...(world.stats ?? []), ...((persona.stats as PlayerStat[] | undefined) ?? [])];
  return {
    entities: world.entities.map((e) => ({ kind: 'entity', id: e.id, name: resolve(e.name), description: both(e.playerDescription, e.aiDescription) })),
    locations: world.locations.map((l) => ({ kind: 'location', id: l.id, name: resolve(l.name), description: both(l.playerDescription, l.aiDescription, l.description) })),
    items: (world.items ?? []).map((i) => ({ kind: 'item', id: i.id, name: resolve(i.name), description: both(i.playerDescription, i.aiDescription) })),
    stats: stats.map((s) => ({ kind: 'stat', id: s.id, name: resolve(s.name), type: s.type, value: s.value, min: s.min, max: s.max, band: resolve(s.description ?? '') })),
    traits: world.traits.map((t) => ({ kind: 'trait', id: t.id, name: resolve(t.name), description: both(t.playerDescription, t.aiDescription) })),
  };
}

/** The full arm's game input: the save's story, with the whole world and every entry, switched off or not. */
export function fullInputOf(world: World, save: Save): GameWorldInput {
  const input = gameInputOf(world, save);
  const lore = (world.dictionaries ?? []).flatMap((book) => book.entries ?? []).map((entry) => ({ ...entry, enabled: true }));
  return { ...input, view: fullView(world), lore };
}

/**
 * One "who else" case per save: a question that draws the cast, so the full arm has the unmet rows to leak.
 * It keys any one met name.
 */
const whoElse = (world: WorldId): WorldQuestionCase => ({
  id: `${world}-who-else`, world, lean: 'game', question: 'Who else is around here that I should know about?',
  facts: [check('a met name', new RegExp(GAME_SAVES[world]!.save.met.map(escapeRegExp).join('|'), 'i'))],
});

export const WORLD_QUESTION_CASES: WorldQuestionCase[] = [
  ...(Object.keys(GAME_SAVES) as WorldId[]).map(whoElse),
  // Emberwatch
  { id: 'ember-pact-script', world: 'emberwatch', lean: 'editor', question: "How does the Founders' Pact script work?",
    facts: [check('Renown', /renown/i), check('70', /\b70\b|seventy/i), check('switches the entry', /enabl|switch|turn(s|ed)? (it )?on|toggle/i)] },
  { id: 'ember-prayer-tool', world: 'emberwatch', lean: 'editor', question: 'What does the offer_prayer Tool do?',
    facts: [check('Faith', /faith/i), check('the chapel', /chapel|brazier/i)] },
  { id: 'ember-who-smith', world: 'emberwatch', lean: 'game', question: 'Who is Bram Oakes?',
    facts: [check('smith', /smith/i), check('cold iron', /cold iron/i)] },
  { id: 'ember-try', world: 'emberwatch', lean: 'game', question: ASK_TRY, facts: [],
    opinion: { solutions: [check('the crown halves', /\bhalves\b|half-crown|iron crown/i), check('the bier', /\bbier\b/i)] } },
  // Drone
  { id: 'drone-lock-tool', world: 'drone', lean: 'editor', question: 'What does the lock_target Tool do?',
    facts: [check('one enemy', /enemy|target/i), check('marks it in the narration', /narrat|display|reticle/i)] },
  { id: 'drone-power-cores', world: 'drone', lean: 'editor', question: 'How do Power Cores work in this world?',
    facts: [check('precursor relic', /precursor|relic/i), check('permanent upgrade', /permanent|integrat/i)] },
  { id: 'drone-who-sabi', world: 'drone', lean: 'game', question: 'Who is Sabi?',
    facts: [check('mechanic', /mechanic/i), check('the clan camp', /clan|hulkfall|rustjaw/i)] },
  { id: 'drone-try', world: 'drone', lean: 'game', question: ASK_TRY, facts: [], opinion: { solutions: [] } },
  // Open Chat: no cast, no save to play, so editor cases only.
  { id: 'chat-entity-leads', world: 'open-chat', lean: 'editor', question: 'What does the Entity Leads trait do?',
    facts: [check('the entity drives', /entity (drives|leads|takes the lead)|drives the (chat|conversation)/i)] },
  { id: 'chat-reply-length', world: 'open-chat', lean: 'editor', question: 'How do I make the replies longer?',
    facts: [check('the Long trait', /\blong\b/i)] },
  // Rampage
  { id: 'rampage-alert-stat', world: 'rampage', lean: 'editor', question: 'What raises the Alert Level stat?',
    facts: [check('damage', /damage|destruct|wreck/i), check('never goes down', /never (goes )?down|only (climbs|rises)|never (falls|drops|decreases)/i)] },
  { id: 'rampage-aegis', world: 'rampage', lean: 'editor', question: 'What is Aegis-One?',
    facts: [check('a mech', /mech|war machine|robot/i), check('Fort Bastion', /bastion|hangar/i)] },
  { id: 'rampage-who-chopper', world: 'rampage', lean: 'game', question: 'What is the helicopter that keeps following me?',
    facts: [check('Channel 8', /channel 8/i), check('news', /news|live|report/i)] },
  { id: 'rampage-try', world: 'rampage', lean: 'game', question: ASK_TRY, facts: [], opinion: { solutions: [] } },
  // Slime
  { id: 'slime-wanted-script', world: 'slime', lean: 'editor', question: 'How does the Wanted Notice script work?',
    facts: [check('Suspicion', /suspicion/i), check('75 percent', /75|three.quarters|0\.75/i), check('the loudspeakers', /loudspeaker|notice/i)] },
  { id: 'slime-salt', world: 'slime', lean: 'editor', question: 'What does salt do to slimes?',
    facts: [check('slimes recoil', /recoil|repel|keep|hold|back off|flee/i)] },
  { id: 'slime-who-hollis', world: 'slime', lean: 'game', question: 'Who was the woman at the pharmacy?',
    facts: [check('Hollis Pratt', /hollis|pratt/i), check('retired veterinarian', /vet/i)] },
  { id: 'slime-try', world: 'slime', lean: 'game', question: ASK_TRY, facts: [],
    opinion: { solutions: [check('the Chemical Works', /chemical works/i)] } },
  // Sugarscape
  { id: 'sugar-curse', world: 'sugarscape', lean: 'editor', question: 'How does the curse work?',
    facts: [check('Craving', /craving|hunger/i), check('climbs each turn', /every turn|each turn|climbs|rises/i)] },
  { id: 'sugar-saltlick', world: 'sugarscape', lean: 'editor', question: 'What do the Saltlick Stones do?',
    facts: [check('Craving drops', /craving|hunger|curse/i), check('salt', /salt/i)] },
  { id: 'sugar-what-stone', world: 'sugarscape', lean: 'game', question: 'What was that gray boulder I licked?',
    facts: [check('Saltlick Stone', /saltlick|salt/i), check('quiets the hunger', /hunger|craving|curse/i)] },
  { id: 'sugar-try', world: 'sugarscape', lean: 'game', question: ASK_TRY, facts: [],
    opinion: { solutions: [check('the Stalefront', /stalefront/i)] } },
  // Valentines
  { id: 'val-pursuit-stat', world: 'valentines', lean: 'editor', question: 'What does the Pursuit stat track?',
    facts: [check('the admirers', /admirer|swarm|fan club|chas/i), check('falls when hiding', /hid|blend|wrong way|falls|drops|lower/i)] },
  { id: 'val-chocolate-rule', world: 'valentines', lean: 'editor', question: 'What is the chocolate rule?',
    facts: [check('eat on the spot', /on the spot|eat (it|any|every)|must eat/i)] },
  { id: 'val-who-coach', world: 'valentines', lean: 'game', question: 'Who is Coach Daizen?',
    facts: [check('PE teacher', /\bPE\b|gym|physical education/i), check('the chocolate rule', /chocolate|rule/i)] },
  { id: 'val-try', world: 'valentines', lean: 'game', question: ASK_TRY, facts: [],
    opinion: { solutions: [check('the front gate', /front gate/i)] } },
  // Veilwood
  { id: 'veil-vex', world: 'veilwood', lean: 'editor', question: 'What happens when I eat a Cerulean Vex?',
    facts: [check('Toxin rises', /toxin/i)] },
  { id: 'veil-raptor', world: 'veilwood', lean: 'editor', question: "What is the Shadow Raptor's weakness?",
    facts: [check('cannot climb', /(can'?not|can't|unable to|doesn'?t|never) climb/i)] },
  { id: 'veil-what-moths', world: 'veilwood', lean: 'game', question: 'What are the glowing moths?',
    facts: [check('Lantern Moths', /lantern/i), check('harmless or a warning', /harmless|warn|scatter/i)] },
  { id: 'veil-try', world: 'veilwood', lean: 'game', question: ASK_TRY, facts: [],
    opinion: { solutions: [check('the Veilbreak', /veilbreak/i), check('go east', /\beast\b/i)] } },
];
