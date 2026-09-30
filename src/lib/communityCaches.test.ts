import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { purgeCommunityCaches } from './communityCaches';
import { getCatalog, replaceCatalog } from './worldCatalog';
import { getThumb, putThumb } from './thumbnailCache';
import { getCachedImage, putCachedImage } from './remoteImageCache';
import { getCachedDetails, putCachedDetails } from './listingDetailsCache';

const seed = async () => {
  await replaceCatalog([{ id: 'w1', name: 'A published world' }]);
  await putThumb('thumb-1.webp', new Blob(['pixels']), 1);
  await putCachedDetails('w1', { changelog: [], anonymousLikes: false });
  await putCachedImage('https://example.test/in-a-library-world.webp', new Blob(['pixels']));
};

beforeEach(async () => {
  await purgeCommunityCaches();
});

describe('purging the community caches', () => {
  it('drops the cached listing, the thumbnails it was showing, and the details it opened', async () => {
    await seed();
    expect(await getCatalog()).toHaveLength(1);
    expect(await getThumb('thumb-1.webp')).not.toBeNull();
    expect(await getCachedDetails('w1')).not.toBeNull();

    await purgeCommunityCaches();

    expect(await getCatalog()).toEqual([]);
    expect(await getThumb('thumb-1.webp')).toBeNull();
    expect(await getCachedDetails('w1')).toBeNull();
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
