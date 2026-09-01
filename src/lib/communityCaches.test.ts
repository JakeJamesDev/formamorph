import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { purgeCommunityCaches } from './communityCaches';
import { getCatalog, replaceCatalog } from './worldCatalog';
import { getThumb, putThumb } from './thumbnailCache';
import { getCachedImage, putCachedImage } from './remoteImageCache';

const seed = async () => {
  await replaceCatalog([{ id: 'w1', name: 'A published world' }]);
  await putThumb('thumb-1.webp', new Blob(['pixels']), 1);
  await putCachedImage('https://example.test/in-a-library-world.webp', new Blob(['pixels']));
};

beforeEach(async () => {
  await purgeCommunityCaches();
});

describe('purging the community caches', () => {
  it('drops the cached listing and the thumbnails it was showing', async () => {
    await seed();
    expect(await getCatalog()).toHaveLength(1);
    expect(await getThumb('thumb-1.webp')).not.toBeNull();

    await purgeCommunityCaches();

    expect(await getCatalog()).toEqual([]);
    expect(await getThumb('thumb-1.webp')).toBeNull();
  });

  it('leaves the remote-image cache alone — it serves the player library, not the browser', async () => {
    await seed();

    await purgeCommunityCaches();

    expect(await getCachedImage('https://example.test/in-a-library-world.webp')).not.toBeNull();
  });

  it('is safe to run on a device that has never cached anything', async () => {
    await expect(purgeCommunityCaches()).resolves.toBeUndefined();
    expect(await getCatalog()).toEqual([]);
  });
});
