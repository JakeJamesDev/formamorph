/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { Body, Currency, Entity, EntityStatValues, GameLocation, Item, Placement, ScheduleRow, Slot, Trait, World, SaveObject } from '@/types';
import { withMembership } from './entityPlaces';
import { DEFAULT_AVATAR_URL } from './defaultAvatar';
import { DEFAULT_WORLDS, seedWorldData, type DefaultWorldSeed } from './defaultWorlds';

/** `bundled-<world id>` boots a new game in that bundled world. */
const BUNDLED_PREFIX = 'bundled-';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = [
  'whiteRoom', 'thousandTurns', 'writtenOpening', 'pickedOpening', 'entityStats', 'entityMorphs', 'entityAvatars', 'avatarIcon',
  'entityPresence', 'entityFollowers', 'mapBackground', 'items',
  ...DEFAULT_WORLDS.map((w) => `${BUNDLED_PREFIX}${w.id}`),
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
/** The `items` fixture's starting Item Copies, on the player. The equipped ones fill the doll. */
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
const unique = (entity: Omit<Entity, 'kind' | 'starts'>, places: string[], schedule: ScheduleRow[] = []): Entity => ({
  ...entity, kind: 'unique', starts: places.map((place, i) => ({ id: `start-${i + 1}`, place, weight: 1, schedule })),
});

/** A Generic entity with one Start per place, no rows. */
const generic = (entity: Omit<Entity, 'kind' | 'starts'>, places: string[]): Entity => ({
  ...entity, kind: 'generic', starts: places.map((place, i) => ({ id: `start-${i + 1}`, place, weight: 1, schedule: [] })),
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
const ENTITY_FOLLOWER: Entity = { ...unique({ id: 'dev-scout', name: 'Scout' }, [WHITE_ROOM_ID]), traversable: 'anywhere' };
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
            itemCopies: [
              { id: 'dev-copy-worn', item: { kind: 'item', itemId: 'dev-item-wand' }, where: { kind: 'entity', id: 'dev-bram' }, quantity: 1, visibility: 'visible', equipped: { slotId: 'dev-slot-hand', order: 0 } },
              { id: 'dev-copy-carried', item: { kind: 'item', itemId: 'dev-item-tonic' }, where: { kind: 'entity', id: 'dev-bram' }, quantity: 1, visibility: 'visible' },
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
