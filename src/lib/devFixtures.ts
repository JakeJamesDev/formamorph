/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { World, SaveObject } from '@/types';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = ['whiteRoom'] as const;
export type DevFixtureName = (typeof DEV_FIXTURES)[number];

export interface DevFixture {
  world: World;
  save: SaveObject;
  /** IndexedDB key the boot writes the save under before running the real `loadGame`. */
  saveName: string;
}

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
        saveName: 'DEV: White Room (3 turns)',
      };
    }
    default:
      return null;
  }
}
