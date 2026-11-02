import { describe, it, expect } from 'vitest';
import { bundledWorlds } from '@/lib/bundledWorldText';
import { contentHash } from '@/lib/contentHash';
import { DEFAULT_WORLDS } from '@/lib/defaultWorlds';

describe('bundledWorlds', () => {
  it.each(DEFAULT_WORLDS.map((world) => world.id))('hashes the text it reads for %s', async (id) => {
    expect(await bundledWorlds.hashOf(id)).toBe(contentHash(await bundledWorlds.read(id)));
  });

  it('rejects an id with no bundled file', async () => {
    await expect(bundledWorlds.hashOf('no-such-world')).rejects.toThrow('no-such-world');
    await expect(bundledWorlds.read('no-such-world')).rejects.toThrow('no-such-world');
  });
});
