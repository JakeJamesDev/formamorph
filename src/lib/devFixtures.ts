/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { Entity, EntityStatValues, World, SaveObject } from '@/types';
import { DEFAULT_AVATAR_URL } from './defaultAvatar';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = ['whiteRoom', 'thousandTurns', 'writtenOpening', 'pickedOpening', 'entityStats', 'entityMorphs', 'entityPresence'] as const;
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
const devStat = (name: string, starting: number, extra: Record<string, unknown> = {}) => ({
  id: `dev-${name.toLowerCase()}`, name, type: 'number', description: '', min: 0, max: 100, starting, regen: 0, descriptors: [], ...extra,
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

const WHITE_ROOM_ID = '1783535114538';
/** The `entityPresence` fixture's cast, each one at the White Room. */
const ENTITY_PRESENCE_CAST: Entity[] = [
  { id: 'dev-warden', name: 'Warden', locations: [WHITE_ROOM_ID, 'dev-corridor'], presence: 'random', movement: 'stays' },
  { id: 'dev-moths', name: 'Lantern Moths', locations: [WHITE_ROOM_ID, 'dev-alcove'], movement: 'follow' },
  { id: 'dev-archivist', name: 'Archivist', locations: [WHITE_ROOM_ID] },
  { id: 'dev-tamsin', name: 'Tamsin', locations: [WHITE_ROOM_ID], persona: true },
  { id: 'dev-self', name: 'Visitor', locations: [WHITE_ROOM_ID], customPersona: true },
];

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
      // and one who left earlier. Their values are the starting values the load backfills.
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
    case 'entityPresence': {
      // The white room with a cast for every Entities Here row: One with a Movement, a two-place entity
      // that can follow, a one-place entity, a world persona and the Custom Persona.
      const world = (await import('./devFixtures/whiteRoomWorld.json')).default as unknown as World;
      return { world: { ...world, entities: [...world.entities, ...ENTITY_PRESENCE_CAST] } };
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
