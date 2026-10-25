/**
 * The Bench shows what Test Code shows (ADR-0005): on one world, both snapshots hand a Script the same run options.
 */
import { describe, it, expect } from 'vitest';
import type { Entity, Stat, Trait, World } from '@/types';
import { optionsFor, type UnitHome } from '@/lib/sandboxSnapshot';
import type { StatCodeRunOptions } from '@/lib/statCodeExecutor';
import { testCodeSnapshotOf } from '@/lib/statCodeTestRun';
import { SAMPLE_SENTENCE } from '@/lib/scriptTestSamples';
import type { RunTiming } from '@/lib/statCodeTiming';
import { benchSnapshotOf } from './scriptCheck';
import type { RuleWorld } from './rules';

const stat = (over: Partial<Stat> & { id: string; name: string }): Stat => ({
  type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});
const trait = (over: Partial<Trait> & { id: string; name: string }): Trait => ({ statChanges: [], ...over });

const mira: Entity = {
  id: 'mira', name: 'Mira', persona: true,
  stats: [stat({ id: 'resolve', name: 'Resolve', value: 4 })], traits: [trait({ id: 'wary', name: 'Wary' })],
};
const tor: Entity = { id: 'tor', name: 'Tor', stats: [stat({ id: 'grit', name: 'Grit', value: 6 })] };

const world: RuleWorld = {
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as World['worldOverview'],
  stats: [
    stat({ id: 'luck', name: 'Luck', value: 5, starting: 10 }),
    stat({ id: 'ward', name: 'Ward', enabled: false }),
  ],
  traits: [trait({ id: 'brave', name: 'Brave' }), trait({ id: 'calm', name: 'Calm' })],
  entities: [mira, tor],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }, { id: 'reef', name: 'Reef' }],
  connections: [{ id: 'tide-road', a: 'harbor', b: 'reef', aToB: { hint: 'at low tide' } }],
  statUpdates: [], dictionaries: [], placeholders: [],
};

/** `options` with each closure as what it makes, since each snapshot holds its own: the entry-value resolver's
 *  text and each location's links. */
const comparable = ({ resolveEntryValue, places, ...options }: StatCodeRunOptions) => ({
  ...options, resolved: resolveEntryValue?.('The tide'),
  places: places && { ...places, locations: places.locations.map(({ links, ...place }) => ({ ...place, links: links?.() })) },
});

const HOMES: Record<string, UnitHome> = {
  globalStat: { kind: 'globalStat', stat: world.stats[0] },
  entityStat: { kind: 'entityStat', entityId: 'tor', stat: tor.stats![0] },
  personaEntityStat: { kind: 'entityStat', entityId: 'mira', stat: mira.stats![0] },
  blueprintStat: { kind: 'blueprintStat', stat: world.stats[0], groupStats: world.stats },
  globalTrait: { kind: 'trait', trait: { id: 'brave', name: 'Brave' }, entityId: null },
  entityTrait: { kind: 'trait', trait: { id: 'wary', name: 'Wary' }, entityId: 'mira' },
  blueprintTrait: { kind: 'blueprintTrait', trait: { id: 'calm', name: 'Calm' } },
  world: { kind: 'world' },
  tool: { kind: 'tool' },
};

const TIMINGS: readonly RunTiming[] = ['start', 'before', 'after', 'output', 'switch'];

describe('the Bench and Test Code read one world (ADR-0005, Q9)', () => {
  for (const timing of TIMINGS) {
    for (const [name, home] of Object.entries(HOMES)) {
      it(`assembles the same options for a ${name} Script at ${timing}`, () => {
        const unit = {
          home, timing, code: 'return 1;',
          ...(timing === 'output' && { narration: SAMPLE_SENTENCE }),
          ...(timing === 'switch' && { switched: 'sample' as const }),
        };
        const bench = comparable(optionsFor(benchSnapshotOf(world, timing), unit));
        expect(bench).toEqual(comparable(optionsFor(testCodeSnapshotOf(world, timing), unit)));
        expect(bench.resolved).toBe('The tide');
      });
    }
  }
});
