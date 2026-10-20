import { describe, it, expect } from 'vitest';
import { migrateWorld } from './version';
import { statAuthoredStart, statMax, statMin } from './statDescriptorGeometry';
import { playStatWorld } from './statLinks';
import type { Stat, World } from '@/types';

const raws = import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true });
const worlds = Object.entries(raws).map(([path, raw]) => [path.split('/').pop() ?? path, migrateWorld(JSON.parse(raw))] as const);
/** Every stat the world seeds: its own, then each entity's, Link overrides resolved. */
const statsOf = (w: World): Stat[] => {
  const { stats, entities } = playStatWorld({ stats: w.stats ?? [], statGroups: w.statGroups ?? [], entities: w.entities ?? [] });
  return [...stats, ...entities.flatMap((e) => e.stats ?? [])];
};

// A bundled stat on any of these edges opens at a number its author did not type (Q8).
describe.each(worlds)('the bundled %s world', (_file, world) => {
  it('starts every stat inside its range', () => {
    const out = statsOf(world).filter((s) => statAuthoredStart(s) < statMin(s) || statAuthoredStart(s) > statMax(s));
    expect(out.map((s) => s.name)).toEqual([]);
  });

  it('authors no zero value on a stat whose min is not zero', () => {
    expect(statsOf(world).filter((s) => s.value === 0 && statMin(s) !== 0).map((s) => s.name)).toEqual([]);
  });

  it('authors no `starting` that differs from the value', () => {
    expect(statsOf(world).filter((s) => s.starting !== undefined && s.starting !== s.value).map((s) => s.name)).toEqual([]);
  });
});
