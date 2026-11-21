/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { Body, Currency, WorldOption, Entity, EntityStatValues, GameLocation, Item, Placement, ScheduleRow, Slot, Traversable, Trait, World, SaveObject, MediaEntry, GalleryLink } from '@/types';
import { withMembership } from './entityPlaces';
import { DEFAULT_AVATAR_URL } from './defaultAvatar';
import { DEFAULT_WORLDS, seedWorldData, type DefaultWorldSeed } from './defaultWorlds';
import { firstRoutine } from '@/lib/entityKind';
import { narrationHash } from '@/lib/coref/mentionReadings';
import { spokenQuotes } from '@/lib/quoteSegments';
import { mediaEntry } from '@/lib/mediaList';

/** `bundled-<world id>` boots a new game in that bundled world. */
const BUNDLED_PREFIX = 'bundled-';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = [
  'whiteRoom', 'thousandTurns', 'writtenOpening', 'pickedOpening', 'entityStats', 'entityMorphs', 'entityAvatars', 'avatarIcon',
  'entityPresence', 'entityFollowers', 'mapStrangers', 'mapBackground', 'items', 'options', 'lockedPlaces', 'speakerQuotes', 'scriptImages',
  'enterOptions', 'layeredImages', ...DEFAULT_WORLDS.map((w) => `${BUNDLED_PREFIX}${w.id}`),
];

// Real-sized images for the long save, fetched from the dev server.
const THOUSAND_TURN_IMAGES = ['/thumbnails/1.jpg', '/thumbnails/2.jpg', '/thumbnails/3.jpg', '/thumbnails/4.jpg'];

export interface DevFixture {
  world: World;
  /** Absent boots a new game in the world. */
  save?: SaveObject;
  /** IndexedDB key the boot writes the save under before running the real `loadGame`. */
  saveName?: string;
  /** Library entities the player picked at Enter World, for a new game. */
  picked?: Entity[];
}

const DEV_OPTIONS: WorldOption[] = [
  {
    id: 'dev-opt-length', name: 'Reply Length', type: 'choice', shownToPlayer: true, midGame: true, default: 'dev-len-medium',
    playerDescription: 'How much the narrator writes each turn',
    values: [{ id: 'dev-len-short', name: 'Short' }, { id: 'dev-len-medium', name: 'Medium' }, { id: 'dev-len-long', name: 'Long' }],
  },
  {
    id: 'dev-opt-difficulty', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'dev-diff-easy',
    playerDescription: 'How hard the room is on you',
    values: [
      { id: 'dev-diff-easy', name: 'Easy', statChanges: [{ statId: 'stat-coin', type: 'starting', value: 50 }, { statId: 'stat-warmth', type: 'regen', value: 2 }] },
      { id: 'dev-diff-hard', name: 'Hard', statChanges: [{ statId: 'stat-warmth', type: 'regen', value: -1 }, { statId: 'stat-coin', type: 'max', value: -20 }] },
    ],
  },
  { id: 'dev-opt-gore', name: 'Graphic Violence', type: 'boolean', shownToPlayer: true, midGame: true, default: false },
  { id: 'dev-opt-pace', name: 'Pacing', type: 'number', shownToPlayer: true, midGame: true, min: 1, max: 5, default: 3 },
  { id: 'dev-opt-setup', name: 'Starting Season', type: 'boolean', shownToPlayer: true, midGame: false, default: true },
  { id: 'dev-opt-secret', name: 'Secret Flag', type: 'boolean', shownToPlayer: false, midGame: true, default: false },
];

/** The `enterOptions` fixture's Options: a choice with stat changes, a switch and a slider. */
const EMBERWATCH_OPTIONS: WorldOption[] = [
  {
    id: 'dev-ember-difficulty', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'dev-ember-steady',
    playerDescription: 'How hard the frontier is on you',
    values: [
      { id: 'dev-ember-gentle', name: 'Gentle', statChanges: [{ statId: 'health', type: 'max', value: 20 }] },
      { id: 'dev-ember-steady', name: 'Steady' },
      { id: 'dev-ember-grim', name: 'Grim', statChanges: [{ statId: 'health', type: 'max', value: -20 }, { statId: 'renown', type: 'starting', value: -5 }] },
    ],
  },
  { id: 'dev-ember-gore', name: 'Graphic Violence', type: 'boolean', shownToPlayer: true, midGame: true, default: false },
  { id: 'dev-ember-undead', name: 'Undead Activity', type: 'number', shownToPlayer: true, midGame: true, min: 1, max: 5, default: 3 },
];

const portrait = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="288"><rect width="240" height="288" fill="${fill}"/></svg>`)}`;
const devStat = (name: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `dev-${name.toLowerCase()}`, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [], ...extra,
});

/** The `entityStats` fixture's cast. Bram also owns a hidden stat and a switched-off one, which never show.
 *  Each entry lists only the fields the check reads, hence the cast. */
const ENTITY_STATS_CAST = [
  {
    id: 'dev-bram', name: 'Bram', image: portrait('#7a5c3e'),
    stats: [
      devStat('Trust', 40, { descriptors: [{ id: 'd1', description: 'Wary', threshold: 0 }, { id: 'd2', description: 'Friendly', threshold: 60 }] }),
      devStat('Secret', 9, { hidden: true }),
      devStat('Dormant', 3, { enabled: false }),
    ],
    traits: [{ id: 'dev-trait-oath', name: 'Oathbound', statChanges: [], playerToggle: true }],
  },
  {
    id: 'dev-wick', name: 'Wick', image: portrait('#3e5c7a'), strangerName: 'a thin runner', stats: [devStat('Nerve', 70), devStat('Stamina', 55)],
    traits: [{ id: 'dev-trait-swift', name: 'Swift', statChanges: [], playerToggle: true }],
  },
  { id: 'dev-odette', name: 'Odette', stats: [devStat('Stock', 12)] },
  // Stands here with no art and takes no part: an Also Here row.
  { id: 'dev-mara', name: 'Mara' },
  // The played persona, for the You mark on the persona row, its stat heading and the picker.
  { id: 'dev-sable', name: 'Sable', persona: true, stats: [devStat('Poise', 65)] },
] as unknown as Entity[];

const WHITE_ROOM_ID = '1783535114538';

/** The `items` fixture's slots, its Bodies and its items. Nobody picks the Hound, so play reads the Humanoid. */
const DEV_SLOTS: Slot[] = [
  { id: 'dev-slot-hand', name: 'Main Hand' }, { id: 'dev-slot-off-hand', name: 'Off Hand' }, { id: 'dev-slot-ring', name: 'Ring' }, { id: 'dev-slot-neck', name: 'Neck' },
  { id: 'dev-slot-head', name: 'Head' }, { id: 'dev-slot-chest', name: 'Chest' }, { id: 'dev-slot-waist', name: 'Waist' }, { id: 'dev-slot-legs', name: 'Legs' }, { id: 'dev-slot-feet', name: 'Feet' },
];
/** A bright custom image, so the Backdrop Opacity fade has something to fade. */
const BRIGHT_BACKDROP = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffd76a"/></linearGradient></defs><rect width="100" height="200" fill="url(#g)"/><circle cx="50" cy="20" r="15" fill="#f4a98a"/><rect x="30" y="38" width="40" height="70" rx="10" fill="#f4a98a"/><rect x="12" y="42" width="14" height="66" rx="7" fill="#f4a98a"/><rect x="74" y="42" width="14" height="66" rx="7" fill="#f4a98a"/><rect x="32" y="108" width="15" height="84" rx="7" fill="#f4a98a"/><rect x="53" y="108" width="15" height="84" rx="7" fill="#f4a98a"/></svg>')}`;
/** The Backdrop's opacity in percent from the dev route's `opacity` param; absent or invalid reads as 100. */
const devOpacity = (): number => {
  const param = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('opacity');
  const raw = param ? Number(param) : Number.NaN;
  return Number.isFinite(raw) ? raw : 100;
};
const devBodies = (): Body[] => [
  {
    id: 'dev-body-humanoid', name: 'Humanoid', aspect: 0.5,
    backdrop: { kind: 'image', image: { data: BRIGHT_BACKDROP }, opacity: devOpacity() / 100 },
    entries: [
      { slotId: 'dev-slot-head', boxes: [{ x: 0.36, y: 0.03, w: 0.28, h: 0.13 }] },
      { slotId: 'dev-slot-neck', boxes: [{ x: 0.42, y: 0.175, w: 0.16, h: 0.05 }] },
      { slotId: 'dev-slot-chest', boxes: [{ x: 0.32, y: 0.24, w: 0.36, h: 0.16 }] },
      { slotId: 'dev-slot-waist', boxes: [{ x: 0.36, y: 0.415, w: 0.28, h: 0.06 }] },
      { slotId: 'dev-slot-legs', boxes: [{ x: 0.34, y: 0.5, w: 0.32, h: 0.2 }] },
      { slotId: 'dev-slot-feet', boxes: [{ x: 0.3, y: 0.86, w: 0.4, h: 0.09 }] },
      { slotId: 'dev-slot-hand', boxes: [{ x: 0.03, y: 0.36, w: 0.2, h: 0.14 }] },
      { slotId: 'dev-slot-off-hand', boxes: [{ x: 0.77, y: 0.36, w: 0.2, h: 0.14 }] },
      { slotId: 'dev-slot-ring', capacity: 2, boxes: [{ x: 0.06, y: 0.52, w: 0.12, h: 0.06 }, { x: 0.82, y: 0.52, w: 0.12, h: 0.06 }] },
    ],
  },
  {
    id: 'dev-body-hound', name: 'Hound', backdrop: { kind: 'quadruped' }, aspect: 1.6,
    entries: [{ slotId: 'dev-slot-neck', boxes: [{ x: 0.68, y: 0.268, w: 0.14, h: 0.22 }] }],
  },
];
const devItem = (id: string, name: string, slotId: string, extra: Partial<Item> = {}): Item => ({
  id, name, stackable: false, slotRule: { mode: 'either', slotIds: [slotId] }, statEffects: [], traitEffects: [], equipRequires: [], ...extra,
});
const DEV_NAME_CURRENCY = 'dev-currency-silver';
const DEV_STAT_CURRENCY = 'dev-currency-credits';
const DEV_ITEM_CURRENCY = 'dev-currency-crowns';
/** A stat-backed Currency on the world's first stat, a name-only one, then an Items-backed one. */
const devCurrencies = (statId: string | undefined): Currency[] => [
  ...(statId ? [{ id: DEV_STAT_CURRENCY, name: 'Credits', backing: { kind: 'stat' as const, statId } }] : []),
  { id: DEV_NAME_CURRENCY, name: 'Silver', backing: { kind: 'name' } },
  {
    id: DEV_ITEM_CURRENCY, name: 'Crowns',
    backing: { kind: 'items', items: [{ itemId: 'dev-item-copper', worth: 1 }, { itemId: 'dev-item-silver-bit', worth: 10 }, { itemId: 'dev-item-gold', worth: 100 }] },
  },
];
const devBackingItem = (id: string, name: string): Item => ({ id, name, playerDescription: `A ${name.toLowerCase()} coin.`, statEffects: [], traitEffects: [], equipRequires: [] });
const devItems = (valueStatId: string | undefined): Item[] => [
  {
    id: 'dev-item-tonic', name: 'Healing Tonic', playerDescription: 'A small corked bottle of red tonic.', uses: 1,
    value: 5, currencyId: DEV_NAME_CURRENCY, traitEffects: [], equipRequires: [],
    statEffects: [{ id: 'dev-effect-tonic', statId: 'dev-vigor', facet: 'value', timing: 'used', duration: { kind: 'time', hours: 2 }, amount: 2, op: 'add' }],
  },
  {
    id: 'dev-item-wand', name: 'Ash Wand', playerDescription: 'A wand of pale ash wood.', uses: 3, whenEmpty: { kind: 'stays' }, stackable: false, bound: true,
    slotRule: { mode: 'either', slotIds: ['dev-slot-hand', 'dev-slot-off-hand'] }, statEffects: [], traitEffects: [], equipRequires: [],
  },
  {
    id: 'dev-item-sword', name: 'Greatsword of the Ashen Vigil', playerDescription: 'A long two-handed blade.', images: [{ data: portrait('#6b7a8f') }], slotRule: { mode: 'all', slotIds: ['dev-slot-hand', 'dev-slot-off-hand'] },
    ...(valueStatId ? { value: 40, currencyId: DEV_STAT_CURRENCY } : {}),
    statEffects: [], traitEffects: [], equipRequires: [],
  },
  devBackingItem('dev-item-copper', 'Copper'),
  devBackingItem('dev-item-silver-bit', 'Silver Bit'),
  devBackingItem('dev-item-gold', 'Gold'),
  {
    id: 'dev-item-pouch', name: 'Coin Pouch', playerDescription: 'A pouch that clinks.', value: 105, currencyId: DEV_ITEM_CURRENCY,
    statEffects: [], traitEffects: [], equipRequires: [],
  },
  {
    id: 'dev-item-ring', name: 'Silver Ring', playerDescription: 'A plain silver band.', stackable: false, slotRule: { mode: 'either', slotIds: ['dev-slot-ring'] },
    statEffects: [], traitEffects: [], equipRequires: [],
  },
  devItem('dev-item-helmet', 'Iron Helmet', 'dev-slot-head'),
  devItem('dev-item-amulet', 'Amulet of the Tide', 'dev-slot-neck'),
  devItem('dev-item-cuirass', 'Boiled Leather Cuirass', 'dev-slot-chest'),
  devItem('dev-item-belt', 'Sword Belt', 'dev-slot-waist'),
  devItem('dev-item-breeches', 'Travel-Worn Breeches', 'dev-slot-legs'),
  devItem('dev-item-boots', 'Hobnailed Boots', 'dev-slot-feet'),
  // None with an image.
  devItem('dev-item-signet', 'Signet of Lord Vane', 'dev-slot-ring', { icon: 'none', images: [{ data: portrait('#b08d57') }] }),
  // Names no word list matches, and one that is unidentified.
  devItem('dev-item-stormcaller', 'Stormcaller', 'dev-slot-hand'),
  // A specific icon.
  devItem('dev-item-whisper', 'Whisper', 'dev-slot-neck', { icon: 'gem' }),
  devItem('dev-item-elixir', 'Sunfire Elixir', 'dev-slot-ring', { slotRule: undefined, unidentifiedName: 'Cloudy Vial', icon: 'crown' }),
  devItem('dev-item-fish', 'Swordfish', 'dev-slot-ring', { slotRule: undefined, stackable: true }),
  // None with no image.
  devItem('dev-item-trinket', 'Strange Trinket', 'dev-slot-ring', { slotRule: undefined, icon: 'none' }),
];
/** The `items` fixture's starting Item Instances, on the player. The equipped ones fill the doll. */
const DEV_PLACEMENTS = ([
  ['dev-item-sword', 1, true], ['dev-item-ring', 1, true], ['dev-item-signet', 1, true], ['dev-item-helmet', 1, true], ['dev-item-amulet', 1, true],
  ['dev-item-cuirass', 1, true], ['dev-item-belt', 1, true], ['dev-item-breeches', 1, true], ['dev-item-boots', 1, true],
  ['dev-item-tonic', 5], ['dev-item-wand', 1], ['dev-item-stormcaller', 1], ['dev-item-whisper', 1], ['dev-item-elixir', 1], ['dev-item-fish', 3], ['dev-item-trinket', 1], ['dev-item-copper', 15], ['dev-item-gold', 1],
] as [string, number, boolean?][]).map(([itemId, quantity, equipped]): Placement => ({
  id: `dev-placement-${itemId}`, where: { kind: 'you' }, quantity, source: { kind: 'item', itemId }, ...(equipped ? { equipped: true } : {}),
}));
/** The `items` fixture's Give targets: two at the White Room and one away, who never shows. The Custom Persona
 *  holds the Vigor stat the Healing Tonic raises for two hours. */
const DEV_ITEM_CAST: Entity[] = [
  // `devStat` lists only the fields play reads, hence the cast.
  { id: 'dev-you', name: 'You', customPersona: true, stats: [devStat('Vigor', 10)] } as Entity,
  withMembership<Entity>({ id: 'dev-courier', name: 'Courier' }, [WHITE_ROOM_ID]),
  withMembership<Entity>({ id: 'dev-archivist', name: 'Archivist' }, [WHITE_ROOM_ID]),
  withMembership<Entity>({ id: 'dev-sentry', name: 'Sentry' }, ['dev-corridor']),
];

/** The `entityMorphs` fixture's entity: the bundled avatar as an entity model, its Bulk stat bound to a face
 *  shape key, since the avatar's face meshes are the ones that carry shape keys. */
const MORPH_STAT = devStat('Bulk', 100, { morphBindings: [{ name: 'Fcl_ALL_Surprised' }] });
const MORPH_ENTITY = {
  id: 'dev-golem', name: 'Golem',
  model: { name: 'default-avatar.vrm', type: 'model/gltf-binary', data: DEFAULT_AVATAR_URL },
  stats: [MORPH_STAT],
} as unknown as Entity;
const morphValues = (value: number) => ({ [MORPH_ENTITY.id]: [{ ...MORPH_STAT, value }] }) as unknown as EntityStatValues;
/** The `entityAvatars` fixture's one store Avatar, the bundled file served by the dev server. */
const DEV_VRM_STORE = {
  'dev-avatar': { name: 'Default', file: { name: 'default-avatar.vrm', type: 'model/vrm', data: DEFAULT_AVATAR_URL } },
};
const AVATAR_PERSONA: Entity = { id: 'dev-wren', name: 'Wren', persona: true, vrmPick: { kind: 'default' } };

/** A Unique entity with one Start per place in `places`, each running `schedule`. */
const unique = (entity: Omit<Entity, 'kind' | 'routines'>, places: string[], schedule: ScheduleRow[] = [], traversable?: Traversable): Entity => ({
  ...entity, kind: 'unique',
  routines: [firstRoutine(places.map((place, i) => ({ id: `start-${i + 1}`, place, weight: 1, schedule })), traversable)],
});

/** A Generic entity with one Start per place, no rows. */
const generic = (entity: Omit<Entity, 'kind' | 'routines'>, places: string[]): Entity => ({
  ...entity, kind: 'generic',
  routines: [firstRoutine(places.map((place, i) => ({ id: `start-${i + 1}`, place, weight: 1, schedule: [] })))],
});

/** The `entityPresence` fixture's cast, all but the last two at the White Room. */
const ENTITY_PRESENCE_CAST: Entity[] = [
  unique({ id: 'dev-warden', name: 'Warden' }, [WHITE_ROOM_ID, 'dev-corridor']),
  generic({ id: 'dev-moths', name: 'Lantern Moths' }, [WHITE_ROOM_ID, 'dev-alcove']),
  // Relationships rows for the entity panel's Profile tab: one long label, one blank.
  unique({
    id: 'dev-archivist', name: 'Archivist',
    // The one stranger here: the Entities tab lists it by this label.
    strangerName: 'a stooped scholar', strangerDescription: 'Ink-stained fingers and a satchel of scrolls.',
    relationships: [['dev-warden', 'mentor and former employer'], ['dev-queen', '']].map(([targetId, label]) => ({ targetId, label })),
  }, [WHITE_ROOM_ID]),
  unique({ id: 'dev-tamsin', name: 'Tamsin', persona: true }, [WHITE_ROOM_ID]),
  withMembership<Entity>({ id: 'dev-self', name: 'Visitor', customPersona: true }, [WHITE_ROOM_ID]),
  // Off the White Room, wandering between the Corridor and the Alcove. It is also the White Room's own Known Here pick.
  unique({ id: 'dev-sentry', name: 'Sentry', knownIn: [WHITE_ROOM_ID] }, ['dev-corridor', 'dev-alcove'], [{
    id: 'row-1', time: 'allDay',
    action: { kind: 'wander', places: [{ place: 'dev-corridor', weight: 1 }, { place: 'dev-alcove', weight: 1 }], idle: 240 },
  }]),
  // A Known Here row inherited from the Keep, which holds the White Room.
  unique({ id: 'dev-queen', name: 'Queen', knownIn: ['dev-keep'] }, ['dev-keep']),
];
/** The `entityFollowers` fixture's follower. */
const ENTITY_FOLLOWER: Entity = unique({ id: 'dev-scout', name: 'Scout' }, [WHITE_ROOM_ID], [], 'anywhere');
const DEV_KEEP: GameLocation = { id: 'dev-keep', name: 'The Keep' };

/** A hand-drawn-looking map for the `mapBackground` fixture: land, water and a road, labeled by fill. */
const mapArt = (land: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="#9cc7d9"/><path d="M80 120 Q400 20 760 140 T1120 220 L1080 600 Q600 680 140 560 Z" fill="${land}"/><path d="M160 300 C420 260 640 420 1000 320" stroke="#7a5a38" stroke-width="14" fill="none"/><text x="600" y="660" font-family="serif" font-size="40" text-anchor="middle" fill="#2b2b2b">${label}</text></svg>`)}`;

/** Page one of the `writtenOpening` fixture. */
export const WRITTEN_OPENING_TEXT = 'The white room hums. A door you did not see before stands open.';
/** The `pickedOpening` world's own opening, which the picked entity's opening replaces. */
export const WORLD_OPENING_TEXT = 'I look around the white room.';
/** The `pickedOpening` picked entity's opening. */
export const PICKED_OPENING_TEXT = 'I wave to the courier by the door.';

const SPEAKER_QUOTE_LINES: [string, string | null][] = [
  ['"You said noon,"', 'dev-kessa'], ['"I said after the tide."', 'dev-mira'], ['"Ask the courier if you don\'t believe me."', 'dev-mira'],
  ['"Don\'t drag me into this."', 'dev-courier'], ['"Too late."', 'dev-kessa'], ['"Both of you, the tide won\'t wait."', null],
  ['"Then we go now,"', 'dev-ash'],
];
const SPEAKER_QUOTES_TEXT = [
  'The ferry bumps the dock as Mira throws the line. "You said noon," Kessa says, coming down the plank.',
  '"I said after the tide." Mira knots the rope twice. "Ask the courier if you don\'t believe me."',
  'The courier lifts one hand from the bench. "Don\'t drag me into this."',
  '"Too late." Kessa drops onto the bench beside him. From the wheelhouse, someone calls out: "Both of you, the tide won\'t wait."',
  'You step onto the plank. "Then we go now," you say.',
].join('\n\n');
/** The speakerQuotes fixture's last narration and its quotes' speakers, for the streaming quote preview. */
export const speakerQuotesPassage = () => ({ text: SPEAKER_QUOTES_TEXT, quotes: spokenQuotes(SPEAKER_QUOTES_TEXT, SPEAKER_QUOTE_LINES) });
// The fixture's linked mentions, in order, for the mention cards.
const SPEAKER_QUOTE_MENTIONS = spokenQuotes(SPEAKER_QUOTES_TEXT, [
  ['Mira', 'dev-mira'], ['Kessa', 'dev-kessa'], ['Mira', 'dev-mira'], ['the courier', 'dev-courier'],
  ['The courier', 'dev-courier'], ['Kessa', 'dev-kessa'], ['him', 'dev-courier'], ['You', 'dev-ash'], ['you', 'dev-ash'],
]).map(({ start, end, speaker }) => ({ start, end, entityId: speaker }));
const SCRIPT_IMAGES_TEXT = [
  'A lamp flickers on the shelf beside the door. Its light is thin and yellow, and it shakes each time the hum rises.',
  'You cross the room and lift it from its hook. Under the base, pressed into the dust, is the outline of something small and square.',
  'You set the lamp down and run a finger along the outline. The dust gives way to cold metal, and a key slides free into your palm.',
  'It is heavier than it looks. The teeth are worn smooth, and a thin chain hangs from the bow, broken at one link.',
  'Behind you the door clicks. When you turn, it stands an inch open, and the hum has gone quiet.',
].join('\n\n');
/** One Layer's art for the `layeredImages` rig, all on one 240×288 canvas. */
const rigArt = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="288">${body}</svg>`)}`;
const RIG_ART: Record<string, string> = {
  'dev-rig-body': rigArt('<rect width="240" height="288" fill="#d9e4ec"/><rect x="50" y="170" width="140" height="118" rx="50" fill="#4f6d7a"/><circle cx="120" cy="110" r="58" fill="#f1c9a5"/>'),
  'dev-rig-calm': rigArt('<circle cx="100" cy="104" r="7" fill="#2b2b2b"/><circle cx="140" cy="104" r="7" fill="#2b2b2b"/><path d="M98 134 Q120 150 142 134" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>'),
  'dev-rig-hurt': rigArt('<path d="M92 98 l14 12 M106 98 l-14 12 M134 98 l14 12 M148 98 l-14 12" stroke="#2b2b2b" stroke-width="5" stroke-linecap="round"/><path d="M100 144 Q120 130 140 144" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="62" y="72" width="116" height="16" rx="6" fill="#c0392b" transform="rotate(-12 120 80)"/>'),
  'dev-rig-hood': rigArt('<path d="M52 130 Q52 36 120 36 Q188 36 188 130 L170 130 Q166 66 120 66 Q74 66 70 130 Z" fill="#2e4a3a"/>'),
};
const RIG_ID = 'dev-rig';
const below = (statId: string, value: number) => [{ all: [{ kind: 'stat' as const, id: statId, operator: '<' as const, value, unit: 'raw' as const }] }];
/** The `layeredImages` rig: a body, a face that shows hurt below 50 Health, and a hood that shows below 50 Warmth. */
const RIG: MediaEntry = {
  id: RIG_ID, name: 'Scout Rig', kind: 'layered', layers: [
    { id: 'dev-layer-body', name: 'Body', variants: [{ mediaId: 'dev-rig-body' }] },
    { id: 'dev-layer-face', name: 'Face', variants: [{ mediaId: 'dev-rig-hurt', requires: below('dev-health', 50) }, { mediaId: 'dev-rig-calm' }] },
    { id: 'dev-layer-hood', name: 'Hood', opacity: 0.85, variants: [{ mediaId: 'dev-rig-hood', requires: below('dev-warmth', 50) }] },
  ],
};
/** A wide scene for the White Room's backdrop rig. */
const sceneArt = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700">${body}</svg>`)}`;
const SCENE_ART: Record<string, string> = {
  'dev-scene-room': sceneArt('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b44"/><stop offset="1" stop-color="#4b5d73"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><rect x="0" y="520" width="1200" height="180" fill="#2a2f38"/><rect x="480" y="200" width="240" height="320" rx="14" fill="#10151f"/>'),
  'dev-scene-rain': sceneArt(`<g stroke="#9fc3ea" stroke-width="3" stroke-linecap="round" opacity=".8">${Array.from({ length: 70 }, (_, i) => `<path d="M${(i * 83) % 1200} ${(i * 131) % 640} l-16 44"/>`).join('')}</g>`),
};
/** The White Room's backdrop rig: a room, and rain that falls while the persona's Warmth is below 50. */
const SCENE_RIG: MediaEntry = {
  id: 'dev-scene-rig', name: 'Room Scene', kind: 'layered', layers: [
    { id: 'dev-scene-layer-room', name: 'Room', variants: [{ mediaId: 'dev-scene-room' }] },
    { id: 'dev-scene-layer-rain', name: 'Rain', opacity: 0.9, variants: [{ mediaId: 'dev-scene-rain', requires: below('dev-warmth', 50) }] },
  ],
};
/** A carried item whose image is a rig: the hood shows while its holder's Warmth is below 50. */
const ITEM_RIG: MediaEntry = {
  id: 'dev-item-rig', name: 'Cloak Rig', kind: 'layered', layers: [
    { id: 'dev-item-layer-body', name: 'Cloak', variants: [{ mediaId: 'dev-rig-body' }] },
    { id: 'dev-item-layer-hood', name: 'Hood', variants: [{ mediaId: 'dev-rig-hood', requires: below('dev-warmth', 50) }] },
  ],
};
/** Two scouts sharing the rig, each in its own state: Wren hurt and cold, Corin well and warm. */
// Lists only the fields the fixture reads, hence the cast.
const RIG_CAST = [
  { id: 'dev-corin', name: 'Corin', stats: [devStat('Health', 90), devStat('Warmth', 80)], images: [{ mediaId: RIG_ID }] },
  { id: 'dev-wren', name: 'Wren', persona: true, stats: [devStat('Health', 30), devStat('Warmth', 20)], images: [{ mediaId: RIG_ID }] },
] as unknown as Entity[];
/** The rig's art as Media List image entries. */
const rigArtEntries = (): Record<string, MediaEntry> =>
  Object.fromEntries(Object.entries(RIG_ART).map(([id, data]): [string, MediaEntry] => [id, { id, name: id, kind: 'image', type: 'image/svg+xml', data }]));

/** A swatch Layer: one disc at `cx` on the 240×288 canvas, in `fill`. */
const disc = (cx: number, fill: string) => rigArt(`<circle cx="${cx}" cy="120" r="46" fill="${fill}"/>`);
const BLEND_ART: Record<string, string> = {
  'dev-blend-base': rigArt('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a4d8f"/><stop offset="1" stop-color="#e0a040"/></linearGradient></defs><rect width="240" height="288" fill="url(#g)"/>'),
  'dev-blend-normal': disc(40, '#33aa55'),
  'dev-blend-multiply': disc(90, '#f0d030'),
  'dev-blend-screen': disc(140, '#30c0c0'),
  'dev-blend-add': disc(190, '#c03030'),
  'dev-blend-gray': rigArt('<rect x="40" y="190" width="160" height="70" rx="30" fill="#bbbbbb"/>'),
};
/** The `layeredEditor` route's second rig: a gradient under one disc per blend mode, and a gray bar tinted rose. */
const BLEND_RIG: MediaEntry = {
  id: 'dev-blend-rig', name: 'Blend Rig', kind: 'layered', layers: [
    { id: 'dev-blend-layer-base', name: 'Base', variants: [{ mediaId: 'dev-blend-base' }] },
    { id: 'dev-blend-layer-normal', name: 'Normal', variants: [{ mediaId: 'dev-blend-normal' }] },
    { id: 'dev-blend-layer-multiply', name: 'Multiply', blend: 'multiply', variants: [{ mediaId: 'dev-blend-multiply' }] },
    { id: 'dev-blend-layer-screen', name: 'Screen', blend: 'screen', variants: [{ mediaId: 'dev-blend-screen' }] },
    { id: 'dev-blend-layer-add', name: 'Add', blend: 'add', variants: [{ mediaId: 'dev-blend-add' }] },
    { id: 'dev-blend-layer-tint', name: 'Tint', tint: '#cc3366', variants: [{ mediaId: 'dev-blend-gray' }] },
  ],
};
const blendArtEntries = (): Record<string, MediaEntry> =>
  Object.fromEntries(Object.entries(BLEND_ART).map(([id, data]): [string, MediaEntry] => [id, { id, name: id, kind: 'image', type: 'image/svg+xml', data }]));

/** The `layeredEditor` route's world: `base` with the two scouts and the rig they share. */
export const devLayeredWorld = (base: World): World => ({
  ...base,
  worldOverview: { ...base.worldOverview, mediaList: { ...base.worldOverview.mediaList, ...rigArtEntries(), ...blendArtEntries(), [RIG_ID]: RIG, [BLEND_RIG.id]: BLEND_RIG } },
  entities: [...RIG_CAST, ...base.entities],
});

/** A flat portrait for the fixture's cast, so the cards and pick list show images. */
const fixturePortrait = (hue: number): NonNullable<Entity['images']> => [{
  data: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="hsl(${hue} 45% 55%)"/><circle cx="40" cy="34" r="18" fill="hsl(${hue} 35% 85%)"/><rect x="14" y="60" width="52" height="60" rx="20" fill="hsl(${hue} 40% 35%)"/></svg>`)}`,
}];



/** Load a fixture's world+save (dynamic import → own chunk). Null outside DEV or for an unknown name. */
export async function loadDevFixture(name: string): Promise<DevFixture | null> {
  if (!import.meta.env.DEV) return null;
  switch (name) {
    case 'whiteRoom': {
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      return {
        world: world.default as unknown as World,
        save: save.default as unknown as SaveObject,
        saveName: 'DEV: White Room (8 turns)',
      };
    }
    case 'speakerQuotes': {
      // The white room whose last turn has three speakers and one unresolved quote, read already. Quote colors
      // show with Character Mentions on.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const saved = save.default as unknown as SaveObject;
      const history = saved.currentState.fullMessageHistory ?? [];
      const last = history.length - 1;
      const turn = JSON.parse(history[last].content) as { turnId: string };
      const base = world.default as unknown as World;
      const speaker = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ ...base.entities[0], id, name, ...extra });
      return {
        world: {
          ...base,
          entities: [
            ...base.entities,
            speaker('dev-ash', 'Ash', { persona: true, personaOnly: true, playerDescription: 'A ferryman who keeps to the tide.', images: fixturePortrait(30) }),
            speaker('dev-mira', 'Mira', { images: fixturePortrait(200) }),
            speaker('dev-kessa', 'Kessa'),
            speaker('dev-courier', 'Ilan', { strangerName: 'the courier', strangerDescription: 'A stranger in a gray coat.', images: fixturePortrait(280) }),
          ],
        },
        save: {
          ...saved,
          persona: { source: 'world', entityId: 'dev-ash' },
          currentState: {
            ...saved.currentState,
            fullMessageHistory: history.map((message, index) => (
              index === last ? { ...message, content: JSON.stringify({ ...turn, narration: SPEAKER_QUOTES_TEXT }) } : message
            )),
          },
          mentionReadings: {
            [turn.turnId]: { model: 'small', version: 1, textHash: narrationHash(SPEAKER_QUOTES_TEXT), reading: { mentions: SPEAKER_QUOTE_MENTIONS, quotes: spokenQuotes(SPEAKER_QUOTES_TEXT, SPEAKER_QUOTE_LINES) } },
          },
        },
        saveName: 'DEV: Speaker Quotes',
      };
    }
    case 'scriptImages': {
      // The white room whose last turn shows every `player.show` placement: above, inline left and right, below,
      // in Emberwatch art.
      const [world, save, ember] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
        loadBundledFixture('emberwatch'),
      ]);
      const saved = save.default as unknown as SaveObject;
      const history = saved.currentState.fullMessageHistory ?? [];
      const last = history.length - 1;
      const turn = JSON.parse(history[last].content) as { turnId: string };
      const base = world.default as unknown as World;
      const art = ember?.world;
      const media = (id: string, image?: GalleryLink): MediaEntry => ({ id, name: id, kind: 'image', type: 'image/webp', data: !image ? '' : 'data' in image ? image.data : (art && mediaEntry(art.worldOverview.mediaList, image.mediaId)?.data) ?? '' });
      const place = (name: string) => art?.locations.find((l) => l.name === name)?.images?.[0];
      const face = (name: string) => art?.entities.find((e) => e.name === name)?.images?.[0];
      const mediaList = {
        ...base.worldOverview.mediaList,
        'dev-img-door': media('dev-img-door', place("The Sorcerer's Vault")),
        'dev-img-lamp': media('dev-img-lamp', face('Sergeant Ilsa Marr')),
        'dev-img-key': media('dev-img-key', place('The Barrow Beyond the Wall')),
      };
      return {
        world: { ...base, worldOverview: { ...base.worldOverview, mediaList } },
        save: {
          ...saved,
          currentState: {
            ...saved.currentState,
            fullMessageHistory: history.map((message, index) => (
              index === last ? { ...message, content: JSON.stringify({ ...turn, narration: SCRIPT_IMAGES_TEXT }) } : message
            )),
          },
          scriptTells: {
            [turn.turnId]: [
              { image: 'dev-img-door', size: 'medium', wrap: 'block', timing: 'before' },
              { image: 'dev-img-lamp', size: 'small', wrap: 'left', sentence: 0, timing: 'output' },
              { image: 'dev-img-key', size: 'medium', wrap: 'right', sentence: 3, timing: 'output' },
              { text: 'The key is yours.', timing: 'after' },
              { image: 'dev-img-key', size: 'small', wrap: 'block', timing: 'after' },
            ],
          },
        },
        saveName: 'DEV: Script Images',
      };
    }
    case 'layeredImages': {
      // The white room with two scouts who link one Layered Image. Wren is played; Corin stands here, met.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      const art = Object.fromEntries(Object.entries({ ...RIG_ART, ...SCENE_ART }).map(([id, data]): [string, MediaEntry] => [id, { id, name: id, kind: 'image', type: 'image/svg+xml', data }]));
      const history = saved.currentState.fullMessageHistory ?? [];
      const last = history.length - 1;
      const cloak = devItem('dev-item-cloak', 'Rig Cloak', 'dev-slot-chest', { icon: 'none', images: [{ mediaId: ITEM_RIG.id }] });
      return {
        world: {
          ...base,
          worldOverview: { ...base.worldOverview, mediaList: { ...base.worldOverview.mediaList, ...art, [RIG_ID]: RIG, [SCENE_RIG.id]: SCENE_RIG, [ITEM_RIG.id]: ITEM_RIG } },
          // The White Room's backdrop is the scene rig, ruled on the persona's Warmth.
          locations: base.locations.map((l) => (l.id === WHITE_ROOM_ID ? { ...l, images: [{ mediaId: SCENE_RIG.id }] } : l)),
          slots: DEV_SLOTS,
          bodies: devBodies(),
          items: [...(base.items ?? []), cloak],
          entities: [...RIG_CAST.map((e) => withMembership(e, [WHITE_ROOM_ID])), ...base.entities],
        },
        save: {
          ...saved,
          persona: { source: 'world', entityId: 'dev-wren' },
          currentState: {
            ...saved.currentState,
            locationId: WHITE_ROOM_ID,
            metEntities: ['dev-corin'],
            // Wren wears the cloak, so its hood follows her Warmth.
            itemInstances: [{ id: 'dev-instance-cloak', item: { kind: 'item', itemId: cloak.id }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', equipped: { slotId: 'dev-slot-chest', order: 0 } }],
            fullMessageHistory: history.map((message, index) => (
              index === last ? { ...message, content: JSON.stringify({ ...JSON.parse(message.content), entities: ['Corin'] }) } : message
            )),
            visibleEntities: [{ name: 'Corin', revealed: true }],
          },
        },
        saveName: 'DEV: Layered Images',
      };
    }
    case 'thousandTurns': {
      // Real narration from the Sedge Landing baseline runs, and real-sized images held as data URLs, as a save holds them.
      const [world, save, narrations, builder, { blobToDataUrl }] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
        import('./devFixtures/sedgeNarration.json'),
        import('./devFixtures/longSave'),
        import('./imageSource'),
      ]);
      // Root paths the dev server serves: an asset import would put the images in the production build.
      const images = await Promise.all(THOUSAND_TURN_IMAGES.map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Fixture image ${path}: ${response.status}`);
        return blobToDataUrl(await response.blob());
      }));
      return {
        world: world.default as unknown as World,
        save: builder.buildLongSave(save.default as unknown as SaveObject, {
          turns: 1000, narrations: narrations.default, images, imageEvery: 20,
        }),
        saveName: 'DEV: 1000 Turns',
      };
    }
    case 'entityStats': {
      // The white room plus three entities that own stats: one In Scene and met, one In Scene as a stranger, and
      // one who left earlier. Mara stands here quiet. Bram wears a wand and carries a tonic, and holds a trait.
      // Their values are the authored values the load backfills. Sable is played.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      const here = new Set(['dev-bram', 'dev-wick', 'dev-mara']);
      const history = saved.currentState.fullMessageHistory ?? [];
      const last = history.length - 1;
      return {
        world: {
          ...base,
          slots: DEV_SLOTS,
          bodies: devBodies(),
          items: devItems(base.stats[0]?.id),
          currencies: devCurrencies(base.stats[0]?.id),
          entities: [...base.entities, ...ENTITY_STATS_CAST.map((e) => (here.has(e.id) ? withMembership(e, [WHITE_ROOM_ID]) : e))],
        },
        save: {
          ...saved,
          persona: { source: 'world', entityId: 'dev-sable' },
          currentState: {
            ...saved.currentState,
            locationId: WHITE_ROOM_ID,
            metEntities: ['dev-bram', 'dev-mara'],
            ownedTraits: { 'dev-bram': { chosen: ['dev-trait-oath'] } },
            itemInstances: [
              { id: 'dev-instance-worn', item: { kind: 'item', itemId: 'dev-item-wand' }, where: { kind: 'entity', id: 'dev-bram' }, quantity: 1, visibility: 'visible', equipped: { slotId: 'dev-slot-hand', order: 0 } },
              { id: 'dev-instance-carried', item: { kind: 'item', itemId: 'dev-item-tonic' }, where: { kind: 'entity', id: 'dev-bram' }, quantity: 1, visibility: 'visible' },
            ],
            // The latest turn names who took part, which is what puts them In Scene.
            fullMessageHistory: history.map((message, index) => (
              index === last ? { ...message, content: JSON.stringify({ ...JSON.parse(message.content), entities: ['Bram', 'Wick'] }) } : message
            )),
            visibleEntities: [
              { name: 'Bram', revealed: true },
              { name: 'Wick', alias: 'a thin runner', revealed: false },
            ],
          },
          stateHistory: saved.stateHistory.map((state, index) => (
            index === 0 ? { ...state, visibleEntities: [{ name: 'Odette', revealed: true }] } : state
          )),
        },
        saveName: 'DEV: Entity Stats',
      };
    }
    case 'entityMorphs': {
      // The white room with the Golem in the scene: Bulk at 100 on the live page, 10 on every earlier one.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      const scene = [{ name: 'Golem', revealed: true }];
      return {
        world: { ...base, entities: [...base.entities, MORPH_ENTITY] },
        save: {
          ...saved,
          currentState: { ...saved.currentState, visibleEntities: scene, entityStats: morphValues(100) },
          stateHistory: saved.stateHistory.map((state, index, all) => ({
            ...state, visibleEntities: scene, entityStats: morphValues(index === all.length - 1 ? 100 : 10),
          })),
        },
        saveName: 'DEV: Entity Morphs',
      };
    }
    case 'entityAvatars': {
      // The white room with the Golem in the scene carrying an Avatar, a 3D model and an image. Wren is played
      // and shows User's Default.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      const golem = { ...MORPH_ENTITY, images: [{ data: THOUSAND_TURN_IMAGES[0] }], vrmPick: { kind: 'world', id: 'dev-avatar' } } as Entity;
      const scene = [{ name: 'Golem', revealed: true }];
      return {
        world: {
          ...base,
          worldOverview: { ...base.worldOverview, vrmStore: DEV_VRM_STORE },
          entities: [...base.entities, golem, AVATAR_PERSONA],
        },
        save: {
          ...saved,
          persona: { source: 'world', entityId: AVATAR_PERSONA.id },
          currentState: { ...saved.currentState, visibleEntities: scene, entityStats: morphValues(100) },
        },
        saveName: 'DEV: Entity Avatars',
      };
    }
    case 'avatarIcon': {
      // The white room played as Wren with an Avatar, holding three traits: slider and color pins, a color pin, and none.
      // The Resolve stat binds a slider and a color.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      const trait = (id: string, name: string, extra: Partial<Trait>): Trait => ({ id, name, statChanges: [], playerToggle: true, ...extra });
      const traits = [
        trait('dev-elf', 'Elf', { morphPins: [{ name: 'Ear Shape', value: 1 }, { name: 'Belly', value: 0.3 }], colorPins: [{ channel: 'skin', color: '#d9c7a0' }] }),
        trait('dev-pale', 'Pale', { colorPins: [{ channel: 'hair', color: '#eeeeee' }] }),
        trait('dev-plain', 'Plain', {}),
      ];
      return {
        world: {
          ...base,
          worldOverview: { ...base.worldOverview, vrmStore: DEV_VRM_STORE },
          entities: [...base.entities, AVATAR_PERSONA],
          traits,
          stats: base.stats.map((s) => (s.name === 'Resolve' ? { ...s, morphBindings: [{ name: 'Belly', by: 1 }], colorBindings: [{ channel: 'eye', color: '#ff0000' }] } : s)),
        },
        save: { ...saved, persona: { source: 'world', entityId: AVATAR_PERSONA.id } },
        saveName: 'DEV: Avatar Icon',
      };
    }
    case 'entityPresence': {
      // The white room with a cast of every placement: a Unique entity with two Starts, a Generic entity, one-place
      // Unique entities, a world persona and the Custom Persona; then two Known Here rows, with the White Room nested
      // in the Keep.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      const locations = world.locations.map((l) => (l.id === WHITE_ROOM_ID ? { ...l, parentId: DEV_KEEP.id } : l));
      return { world: { ...world, locations: [DEV_KEEP, ...locations], entities: [...world.entities, ...ENTITY_PRESENCE_CAST] } };
    }
    case 'options': {
      // The white room (8 turns) with World Options: three the player changes mid-game, one set at new game only, and a hidden flag.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      return {
        world: { ...(world.default as unknown as World), options: DEV_OPTIONS },
        save: save.default as unknown as SaveObject,
        saveName: 'DEV: World Options',
      };
    }
    case 'lockedPlaces': {
      // A new game in the White Room with three locks: the Corridor behind Locked text, the Alcove on a shown
      // Option, and the Vent inside it on a hidden one, which reads "Locked".
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      const unlockedBy = (id: string) => [{ all: [{ kind: 'option' as const, id }] }];
      const locks: Record<string, Partial<GameLocation>> = {
        [WHITE_ROOM_ID]: { isStarting: true },
        'dev-corridor': { unlockedWhen: unlockedBy('dev-opt-alcove'), lockedText: 'The hatch is sealed from the other side.' },
        'dev-alcove': { unlockedWhen: unlockedBy('dev-opt-alcove') },
        'dev-vent': { unlockedWhen: unlockedBy('dev-opt-vent') },
      };
      return {
        world: {
          ...world,
          options: [
            { id: 'dev-opt-alcove', name: 'Alcove Open', type: 'boolean', shownToPlayer: true, midGame: false, default: false },
            { id: 'dev-opt-vent', name: 'Vent Cleared', type: 'boolean', shownToPlayer: false, midGame: false, default: false },
          ],
          locations: world.locations.map((l) => ({ ...l, ...locks[l.id] })),
        },
      };
    }
    case 'items': {
      // The white room with three items and two slots: a stacked single-use tonic, a bound three-use wand in Hand, and
      // a two-handed sword valued in the world's first stat.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      return {
        world: {
          ...world, slots: DEV_SLOTS, bodies: devBodies(), items: devItems(world.stats[0]?.id), currencies: devCurrencies(world.stats[0]?.id), placements: DEV_PLACEMENTS,
          // Starts in the White Room, so Give has its two entities.
          locations: world.locations.map((l) => (l.id === WHITE_ROOM_ID ? { ...l, isStarting: true } : l)),
          entities: [...world.entities, ...DEV_ITEM_CAST],
        },
      };
    }
    case 'entityFollowers': {
      // A save mid-game: the Scout follows the player, the Archivist is met but untracked, the Sentry was met
      // in the Corridor, and the Warden stands here unmet behind an alias.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      return {
        world: { ...base, entities: [...base.entities, ...ENTITY_PRESENCE_CAST, ENTITY_FOLLOWER] },
        save: {
          ...saved,
          currentState: {
            ...saved.currentState,
            locationId: WHITE_ROOM_ID,
            visibleEntities: [
              { name: 'Scout', revealed: true },
              { name: 'Archivist', revealed: true },
              { name: 'Warden', alias: 'a figure by the door', revealed: false },
            ],
            entityPositions: { [ENTITY_FOLLOWER.id]: WHITE_ROOM_ID, 'dev-warden': WHITE_ROOM_ID, 'dev-sentry': 'dev-corridor' },
            uniqueStates: { [ENTITY_FOLLOWER.id]: { startId: 'start-1', lastRun: 0, follow: { mode: 'following' } } },
            metEntities: [ENTITY_FOLLOWER.id, 'dev-archivist', 'dev-sentry'],
          },
        },
        saveName: 'DEV: Entity Followers',
      };
    }
    case 'mapStrangers': {
      // The `entityFollowers` save with the Archivist unmet (its label shows in the player's place), a Warden
      // met by true name, and Moss beside a stranger in the Vent Crawl, two places from the player (an unknown).
      const base = await loadDevFixture('entityFollowers');
      if (!base) return null;
      const save = base.save as SaveObject;
      const lurker = unique({ id: 'dev-lurker', name: 'Lurker', strangerName: 'a lurking shape' }, ['dev-vent']);
      const moss = unique({ id: 'dev-moss', name: 'Moss' }, ['dev-vent']);
      return {
        world: { ...base.world, entities: [...base.world.entities, lurker, moss] },
        save: {
          ...save,
          currentState: { ...save.currentState, metEntities: [ENTITY_FOLLOWER.id, 'dev-sentry', 'dev-warden'] },
        },
        saveName: 'DEV: Map Strangers',
      };
    }
    case 'mapBackground': {
      // The white room under a Map Background: a ruined map ruled on Resolve under 2, then the drawn map. Resolve
      // opens at 3, so the drawn map shows.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      return {
        world: {
          ...world,
          worldOverview: {
            ...world.worldOverview,
            mapBackground: {
              images: [
                { data: mapArt('#8a7f73', 'The Ruined Lands'), requires: [{ all: [{ kind: 'stat', id: 'stat-resolve', operator: '<', value: 2, unit: 'raw' }] }] },
                { data: mapArt('#cfe0a8', 'The Known Lands') },
              ],
              frame: { x: -120, y: -80, width: 780, height: 455 },
              opacity: 0.85,
            },
          },
        },
      };
    }
    case 'writtenOpening': {
      // A new game whose only opening is an Opening Narration, so Start Game is page one. A world file
      // that brings its own openings keeps them, which is how a browser spec sets up a larger pool.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      return {
        world: {
          ...world,
          worldOverview: {
            ...world.worldOverview,
            openings: world.worldOverview.openings
              ?? [{ id: 'written-opening', text: WRITTEN_OPENING_TEXT, kind: 'narration' }],
          },
        },
      };
    }
    case 'pickedOpening': {
      // A new game with one picked entity. A world file keeps its own openings and `devPicked` entities.
      const file = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World & { devPicked?: Entity[] };
      const { devPicked, ...world } = file;
      return {
        world: {
          ...world,
          worldOverview: {
            ...world.worldOverview,
            openings: world.worldOverview.openings
              ?? [{ id: 'world-opening', text: WORLD_OPENING_TEXT, kind: 'action' }],
          },
        },
        picked: devPicked ?? [{
          id: 'dev-courier', name: 'Courier', aiDescription: 'A courier waiting by the door.',
          openings: [{ id: 'courier-opening', text: PICKED_OPENING_TEXT, kind: 'action' }],
        }],
      };
    }
    case 'enterOptions': {
      // Emberwatch, with its traits, plus World Options, stored under its own id for Enter World.
      const seed = DEFAULT_WORLDS.find((w) => w.id === 'emberwatch');
      const raw = (await import('../defaultworlds/emberwatch.json')).default as unknown as Record<string, unknown>;
      if (!seed) return null;
      return { world: { ...seedWorldData(raw, seed), id: 'dev-enter-options', options: EMBERWATCH_OPTIONS } };
    }
    default:
      return name.startsWith(BUNDLED_PREFIX) ? loadBundledFixture(name.slice(BUNDLED_PREFIX.length)) : null;
  }
}

/** A new game in a bundled world, opening on its first Opening Narration so page one is authored text. */
async function loadBundledFixture(id: string): Promise<DevFixture | null> {
  const seed = DEFAULT_WORLDS.find((w) => w.id === id);
  if (!seed) return null;
  // Lazy: each world is its own chunk, fetched only when this fixture boots.
  const files = import.meta.glob<Record<string, unknown>>('../defaultworlds/*.json', { import: 'default' });
  const load = files[`../defaultworlds/${id}.json`];
  if (!load) return null;
  return bundledFixture(await load(), seed);
}

/** The fixture for one parsed bundled file: its seeded world, cut to its first Opening Narration when it has one. */
export function bundledFixture(raw: Record<string, unknown>, seed: DefaultWorldSeed): DevFixture {
  const world = seedWorldData(raw, seed);
  const opening = world.worldOverview.openings?.find((o) => o.kind === 'narration');
  return {
    world: opening ? { ...world, worldOverview: { ...world.worldOverview, openings: [opening] } } : world,
  };
}
