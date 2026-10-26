import { describe, it, expect } from 'vitest';
import { worldFingerprint } from '@/lib/bundledFingerprint';
import list from '@/lib/bundledFingerprints.json';
import { shippedWorldText } from '@/lib/shippedWorld';
import { SHIPPED_SINCE, WORLDS_DIR, git, isWorldFile, treeRevisions, worldRevisions, type Revision } from './bundledRevisions';

const atStart = treeRevisions(SHIPPED_SINCE, WORLDS_DIR, isWorldFile);

describe('worldRevisions', () => {
  it('ships every world as it stood at SHIPPED_SINCE, even after a later edit', () => {
    // A working-tree copy has no blob id, so hash its bytes the way git would.
    const blobOf = (r: Revision) => r.blob ?? git(['hash-object', '--no-filters', r.path]).toString().trim();
    const shipped = new Set(worldRevisions().shippable.map(blobOf));
    expect(atStart.length).toBeGreaterThan(0);
    expect(atStart.filter((r) => !shipped.has(r.blob!)).map((r) => r.path)).toEqual([]);
  });

  it('lists the shipped fingerprint of every world at SHIPPED_SINCE', async () => {
    const missing: string[] = [];
    for (const revision of atStart) {
      const shipped = await worldFingerprint(JSON.parse(await shippedWorldText(revision.read().toString('utf8'))));
      if (!list.worlds.includes(shipped)) missing.push(revision.path);
    }
    expect(missing).toEqual([]);
  }, 300_000);
});
