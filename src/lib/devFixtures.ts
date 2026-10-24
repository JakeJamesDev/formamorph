/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { Entity, EntityStatValues, GameLocation, World, SaveObject } from '@/types';
import { DEFAULT_AVATAR_URL } from './defaultAvatar';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = ['whiteRoom', 'thousandTurns', 'writtenOpening', 'pickedOpening', 'entityStats', 'entityMorphs', 'entityAvatars', 'entityPresence', 'entityFollowers', 'mapBackground'] as const;
export type DevFixtureName = (typeof DEV_FIXTURES)[number];

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
  },
  { id: 'dev-wick', name: 'Wick', image: portrait('#3e5c7a'), stats: [devStat('Nerve', 70), devStat('Stamina', 55)] },
  { id: 'dev-odette', name: 'Odette', stats: [devStat('Stock', 12)] },
  // The played persona, for the You mark on the persona row, its stat heading and the picker.
  { id: 'dev-sable', name: 'Sable', persona: true, stats: [devStat('Poise', 65)] },
] as unknown as Entity[];

/** The `entityMorphs` fixture's entity: the bundled avatar as an entity model, its Bulk stat bound to a face
 *  shape key, since the avatar's face meshes are the ones that carry shape keys. */
const MORPH_STAT = devStat('Bulk', 100, { morphBindings: ['Fcl_ALL_Surprised'] });
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
const AVATAR_PERSONA: Entity = { id: 'dev-wren', name: 'Wren', locations: [], persona: true, vrmPick: { kind: 'default' } };

const WHITE_ROOM_ID = '1783535114538';
/** The `entityPresence` fixture's cast, all but the last two at the White Room. */
const ENTITY_PRESENCE_CAST: Entity[] = [
  { id: 'dev-warden', name: 'Warden', locations: [WHITE_ROOM_ID, 'dev-corridor'], presence: 'random', movement: 'stays' },
  { id: 'dev-moths', name: 'Lantern Moths', locations: [WHITE_ROOM_ID, 'dev-alcove'], movement: 'follow' },
  // Relationships rows for the entity panel's Profile tab: one long label, one blank.
  {
    id: 'dev-archivist', name: 'Archivist', locations: [WHITE_ROOM_ID],
    relationships: [['dev-warden', 'mentor and former employer'], ['dev-queen', '']].map(([targetId, label]) => ({ targetId, label })),
  },
  { id: 'dev-tamsin', name: 'Tamsin', locations: [WHITE_ROOM_ID], persona: true },
  { id: 'dev-self', name: 'Visitor', locations: [WHITE_ROOM_ID], customPersona: true },
  // Off the White Room: the canvas's range warning (no path back from the Corridor) and a pick on a group.
  // It is also the White Room's own Known Here pick.
  { id: 'dev-sentry', name: 'Sentry', locations: ['dev-corridor', 'dev-alcove'], presence: 'random', movement: 'between', knownIn: [WHITE_ROOM_ID] },
  // A Known Here row inherited from the Keep, which holds the White Room.
  { id: 'dev-queen', name: 'Queen', locations: ['dev-keep'], knownIn: ['dev-keep'] },
];
/** The `entityFollowers` fixture's follower. */
const ENTITY_FOLLOWER: Entity = { id: 'dev-scout', name: 'Scout', locations: [WHITE_ROOM_ID], movement: 'follow' };
const DEV_KEEP: GameLocation = { id: 'dev-keep', name: 'The Keep', nearbyUsesConnections: true };

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
      // The white room plus three entities that own stats, in the scene: one met by name, one by alias only,
      // and one who left earlier. Their values are the authored values the load backfills. Sable is played.
      const [world, save] = await Promise.all([
        import('./devFixtures/whiteRoomWorld.json'),
        import('./devFixtures/whiteRoomSave.json'),
      ]);
      const base = world.default as unknown as World;
      const saved = save.default as unknown as SaveObject;
      return {
        world: { ...base, entities: [...base.entities, ...ENTITY_STATS_CAST] },
        save: {
          ...saved,
          persona: { source: 'world', entityId: 'dev-sable' },
          currentState: {
            ...saved.currentState,
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
    case 'entityPresence': {
      // The white room with a cast for every Entities Here row: One with a Movement, a two-place entity
      // that can follow, a one-place entity, a world persona and the Custom Persona; then two Known Here rows,
      // with the White Room nested in the Keep.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      const locations = world.locations.map((l) => (l.id === WHITE_ROOM_ID ? { ...l, parentId: DEV_KEEP.id } : l));
      return { world: { ...world, locations: [DEV_KEEP, ...locations], entities: [...world.entities, ...ENTITY_PRESENCE_CAST] } };
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
            entityFollowers: [ENTITY_FOLLOWER.id],
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
      return null;
  }
}
