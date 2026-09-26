/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi } from 'vitest';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { TOOL_CATALOG, isCatalogToolId } from './toolCatalog';
import { buildToolSnapshot, sampleToolSnapshot } from './toolSnapshot';
import { runToolCall } from './toolRunner';
import { toolsOfferedTo } from './toolOffer';
import { BUILTIN_ENABLED_TOOLS, BUILTIN_PRESETS } from '@/lib/promptPresets';
import { ROLL } from './rollTool';

interface Roll { dice: string; rolls: number[]; modifier: number; total: number }

const sample = sampleToolSnapshot();

async function roll(dice: string, snapshot = sample) {
  const result = await runToolCall(ROLL, JSON.stringify({ dice }), snapshot);
  expect(result.failure).toBeUndefined();
  return result.text;
}
const rollJson = async (dice: string) => JSON.parse(await roll(dice)) as Roll;
const sum = (rolls: number[]) => rolls.reduce((a, b) => a + b, 0);

describe('roll: catalog entry', () => {
  it('is a script Tool with one required text parameter, offered to narration', () => {
    expect(isCatalogToolId('roll')).toBe(true);
    expect(TOOL_CATALOG).toContain(ROLL);
    expect(ROLL.name).toBe('roll');
    expect(ROLL.params).toEqual([{ name: 'dice', type: 'string', description: expect.any(String), required: true, options: [] }]);
    expect(ROLL.handler.kind).toBe('script');
    expect(ROLL.offeredTo).toEqual(['narration']);
  });

  it('is off on every built-in preset, so no preset offers it', () => {
    for (const { id } of BUILTIN_PRESETS) {
      const enabled = BUILTIN_ENABLED_TOOLS[id] ?? {};
      expect(enabled.roll).toBeUndefined();
      expect(toolsOfferedTo('narration', TOOL_CATALOG, enabled, true)).not.toContain(ROLL);
    }
  });

  it('is offered to narration once a preset switches it on, and not when Tools are off globally', () => {
    expect(toolsOfferedTo('narration', TOOL_CATALOG, { roll: true }, true)).toEqual([ROLL]);
    expect(toolsOfferedTo('narration', TOOL_CATALOG, { roll: true }, false)).toEqual([]);
  });
});

describe('roll: notation', () => {
  it.each([
    ['NdS', '3d6', 3, 6, 0, '3d6'],
    ['dS', 'd20', 1, 20, 0, '1d20'],
    ['NdS+K', '2d6+1', 2, 6, 1, '2d6+1'],
    ['NdS-K', '1d20-2', 1, 20, -2, '1d20-2'],
    ['spaces and capitals', ' 2 D 8 + 3 ', 2, 8, 3, '2d8+3'],
    ['a zero modifier', '2d6+0', 2, 6, 0, '2d6'],
  ])('reads %s', async (_label, dice, count, sides, modifier, shown) => {
    const r = await rollJson(dice);
    expect(Object.keys(r)).toEqual(['dice', 'rolls', 'modifier', 'total']);
    expect(r.dice).toBe(shown);
    expect(r.rolls).toHaveLength(count);
    for (const die of r.rolls) {
      expect(Number.isInteger(die)).toBe(true);
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(sides);
    }
    expect(r.modifier).toBe(modifier);
    expect(r.total).toBe(sum(r.rolls) + modifier);
  });

  it('lets a negative modifier take the total below zero', async () => {
    const r = await rollJson('1d2-1000');
    expect(r.total).toBe(r.rolls[0] - 1000);
    expect(r.total).toBeLessThan(0);
  });
});

describe('roll: limits', () => {
  it.each(['1d6', '100d6', '1d2', '1d1000', '1d6+1000', '1d6-1000'])('accepts the edge %s', async (dice) => {
    const r = await rollJson(dice);
    expect(r.total).toBe(sum(r.rolls) + r.modifier);
  });

  it.each([
    ['0d6', 'dice count'],
    ['101d6', 'dice count'],
    ['99999999999999999999d6', 'dice count'],
    ['1d1', 'sides'],
    ['1d0', 'sides'],
    ['1d1001', 'sides'],
    ['1d6+1001', 'modifier'],
    ['1d6-1001', 'modifier'],
  ])('refuses %s, naming the %s and giving an example', async (dice, problem) => {
    const text = await roll(dice);
    expect(text).toContain(problem);
    expect(text).toContain('2d6+1');
  });

  it.each(['', 'two d6', '2d', 'd', '2x6', '2d6+', '2d6+1+1', '2d6*2', '-2d6', '1.5d6', '2d6.5'])(
    'refuses the notation %j with the example',
    async (dice) => {
      expect(await roll(dice)).toBe('Unreadable dice notation. Use dice notation like 2d6+1.');
    },
  );
});

describe('roll: randomness', () => {
  it('lands every face of a d6 and no other value over many dice', async () => {
    const seen = new Set<number>();
    for (let run = 0; run < 5; run++) for (const die of (await rollJson('100d6')).rolls) seen.add(die);
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gives different rolls on separate runs', async () => {
    const runs = new Set<string>();
    for (let run = 0; run < 20; run++) runs.add(JSON.stringify((await rollJson('10d1000')).rolls));
    expect(runs.size).toBe(20);
  });

  it('gives different rolls on two runs in the same millisecond', async () => {
    const now = Date.now();
    const perf = performance.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(performance, 'now').mockReturnValue(perf);
    try {
      const first = await rollJson('10d1000');
      const second = await rollJson('10d1000');
      expect(second.rolls).not.toEqual(first.rolls);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('roll: Try It', () => {
  it('runs on the sample snapshot with no world open and on an open world', async () => {
    const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
    const open = buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? []);
    for (const snapshot of [sample, open]) {
      const r = JSON.parse(await roll('2d6+1', snapshot)) as Roll;
      expect(r.total).toBe(sum(r.rolls) + 1);
    }
  });
});
