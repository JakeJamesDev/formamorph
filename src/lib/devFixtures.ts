/**
 * DEV-only canned world+save fixtures for the dev-router's mid-game boot (`#dev?view=gameViewer&fixture=…`).
 * Lets verification land inside a running game — narration, panels, choices, entity list — WITHOUT a model
 * or replaying turns. Loaded via dynamic `import()` so each fixture is a separate chunk fetched only when
 * `loadDevFixture` runs (DEV-gated), never in the production bundle. See `devRouter.ts` / [[formamorph-dev-router]].
 */
import type { World, SaveObject } from '@/types';

/** The names the router can boot. Kept in lockstep with `loadDevFixture` by `devRouter.test.ts`. */
export const DEV_FIXTURES = ['whiteRoom', 'thousandTurns'] as const;
export type DevFixtureName = (typeof DEV_FIXTURES)[number];

// Real-sized images for the long save, fetched from the dev server.
const THOUSAND_TURN_IMAGES = ['/thumbnails/1.jpg', '/thumbnails/2.jpg', '/thumbnails/3.jpg', '/thumbnails/4.jpg'];

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
    default:
      return null;
  }
}
