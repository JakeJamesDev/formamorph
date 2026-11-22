/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const turn = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>): StatCodeTurn => statCodeTurnOf({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, cascadeOffTraitIds: {}, world: { traits: [], groups: [] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

describe('category in the turn runner', () => {
  it('reads "stat" on self, on another stat and on previous, so the script lands its marker', async () => {
    const stats = [
      stat({ id: 'probe', name: 'Probe', value: 1, scripts: boxScripts({
        after: `self.value = self.category === 'stat' && stats.Other.category === 'stat' && self.previous.category === 'stat' ? 7 : 2;`,
      }) }),
      stat({ id: 'other', name: 'Other' }),
    ];
    const out = await runStatCodeTurn(turn({ stats }));
    expect(out.stats.find((s) => s.id === 'probe')?.value).toBe(7);
  });

  it('reads the persona as "entity" when the script runs', async () => {
    const stats = [stat({ id: 'probe', name: 'Probe', value: 1, scripts: boxScripts({ after: `self.value = persona.category === 'entity' ? 7 : 2;` }) })];
    const out = await runStatCodeTurn(turn({ stats }));
    expect(out.stats.find((s) => s.id === 'probe')?.value).toBe(7);
  });
});
