/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import type { Stat } from '@/types';

const stat: Stat = {
  id: '1', name: 'Roll', type: 'number', description: '', min: 0, max: 1, value: 0, regen: 0, descriptors: [],
};
const draw = async (options: Parameters<typeof executeStatCode>[3]) =>
  (await executeStatCode('return Math.random();', [stat], stat, options)).value;

describe('Math.random seed', () => {
  it('repeats the draw of one seed and differs between seeds, on a run that is not a Tool', async () => {
    const one = await draw({ randomSeed: [1, 2, 3, 4] });
    expect(one).not.toBeNull();
    expect(await draw({ randomSeed: [1, 2, 3, 4] })).toBe(one);
    expect(await draw({ randomSeed: [5, 6, 7, 8] })).not.toBe(one);
  });

  it('repeats the draw of one seed on a Tool run', async () => {
    const one = await draw({ randomSeed: [1, 2, 3, 4], readOnly: true });
    expect(await draw({ randomSeed: [1, 2, 3, 4], readOnly: true })).toBe(one);
  });

  it('draws differently on two runs without a seed', async () => {
    expect(await draw({})).not.toBe(await draw({}));
  });
});
