import { describe, expect, it, vi } from 'vitest';
import { TOUR_STEPS, replayTourSteps } from './steps';
import { newBlankWorld } from '@/lib/blankWorld';
import { coverData } from '@/lib/mediaImages';

// The example pictures are bundled assets the test environment can't fetch.
vi.mock('./tourImages', () => ({ loadTourImage: async (name: string) => `data:image/webp;base64,${name}` }));

describe("the Authoring Tour's cover example", () => {
  it('imports the picture into the Media List and links the cover to it, as the slot does', async () => {
    const after = TOUR_STEPS.findIndex((s) => s.id === 'world-thumbnail') + 1;
    const { world } = await replayTourSteps({ ...newBlankWorld(), worldOverview: { ...newBlankWorld().worldOverview, mediaList: {} } }, after);
    const cover = world.worldOverview.thumbnail;

    expect(cover).toEqual({ mediaId: expect.any(String) });
    const id = (cover as { mediaId: string }).mediaId;
    expect(world.worldOverview.mediaList?.[id]).toMatchObject({ name: 'Cover 1', kind: 'image' });
    expect(coverData(world.worldOverview)).toBe('data:image/webp;base64,brinewell');
  });
});
