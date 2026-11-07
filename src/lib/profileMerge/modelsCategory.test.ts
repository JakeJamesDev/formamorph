import { describe, expect, it } from 'vitest';
import { applyMerge, planMerge, snapshotsOf, type MergeCategory, type MergeProgress } from './engine';
import type { ModelFile, ProfileMergeBridge } from './bridge';
import { modelsCategory } from './modelsCategory';

/** A bridge over two in-memory model folders. A move fails for a name in `failing`, as a locked file would. */
function fakeBridge(source: ModelFile[], target: ModelFile[], failing: string[] = []) {
  const moved: string[] = [];
  const bridge = {
    models: async () => ({ source, target }),
    moveModel: async (name: string, onBytes?: (bytes: number) => void) => {
      if (failing.includes(name)) throw new Error('The file is in use');
      moved.push(name);
      onBytes?.(source.find((file) => file.name === name)?.size ?? 0);
    },
  } as unknown as ProfileMergeBridge;
  return { bridge, moved };
}

/** A category that always plans ahead of models by size alone: one tiny item. */
const tiny = (): MergeCategory => ({
  key: 'tiny', label: 'Tiny', stamped: false, unit: 'items',
  target: async () => [],
  source: async () => [{ id: 't', label: 't', size: 1 }],
  copy: async () => {},
});

async function run(categories: MergeCategory[], onProgress?: (p: MergeProgress) => void) {
  const { source, target } = await snapshotsOf(categories);
  const plans = planMerge(categories, source, target);
  return { plans, results: await applyMerge(plans, categories, onProgress) };
}

describe('Local models', () => {
  it('moves smallest first, sidecars ahead of the parts they describe', async () => {
    const { bridge, moved } = fakeBridge([
      { name: 'big.gguf', size: 900 },
      { name: 'x.gguf.part', size: 50 },
      { name: 'small.gguf', size: 100 },
      { name: 'x.gguf.part.json', size: 400 },
    ], []);
    await run([modelsCategory(bridge)]);
    expect(moved).toEqual(['x.gguf.part.json', 'x.gguf.part', 'small.gguf', 'big.gguf']);
  });

  it('keeps a file the folder already has, without moving it', async () => {
    const { bridge, moved } = fakeBridge([{ name: 'a.gguf', size: 10 }, { name: 'b.gguf', size: 20 }], [{ name: 'a.gguf', size: 99 }]);
    const { results } = await run([modelsCategory(bridge)]);
    expect(moved).toEqual(['b.gguf']);
    expect(results[0]).toMatchObject({ added: 1, kept: 1, skipped: [] });
  });

  it('plans nothing when both sides are one folder (the bridge lists no source files)', async () => {
    const { bridge } = fakeBridge([], [{ name: 'a.gguf', size: 10 }]);
    const { plans } = await run([modelsCategory(bridge)]);
    expect(plans[0].add).toEqual([]);
  });

  it('lists a file that fails as skipped with its reason and carries on', async () => {
    const { bridge, moved } = fakeBridge([{ name: 'a.gguf', size: 10 }, { name: 'b.gguf', size: 20 }], [], ['a.gguf']);
    const { results } = await run([modelsCategory(bridge)]);
    expect(moved).toEqual(['b.gguf']);
    expect(results[0].skipped).toEqual([{ label: 'a.gguf', reason: 'The file is in use' }]);
  });

  it('counts bytes moved against the total', async () => {
    const { bridge } = fakeBridge([{ name: 'a.gguf', size: 30 }, { name: 'b.gguf', size: 70 }], []);
    const seen: MergeProgress[] = [];
    await run([modelsCategory(bridge)], (p) => seen.push(p));
    expect(seen[0]).toEqual({ key: 'models', done: 0, total: 100 });
    expect(seen.at(-1)).toEqual({ key: 'models', done: 100, total: 100 });
  });

  it('runs after every other category, even when it is the smallest', async () => {
    const { bridge } = fakeBridge([{ name: 'a.gguf', size: 0 }], []);
    const { plans } = await run([modelsCategory(bridge), tiny()]);
    expect(plans.map((plan) => plan.key)).toEqual(['tiny', 'models']);
  });
});
