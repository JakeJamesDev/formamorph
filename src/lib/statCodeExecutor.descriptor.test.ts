/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import { buildStatContext } from './statContext';
import { inPlayOwners } from './ownedTraitsInPlay';
import type { StatCodeOwners } from './statCodeTraits';
import type { Entity, PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

/** `descriptor` and `previous.descriptor` on a stat entry (Q9, Q31, Q32). */

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const BANDS = [
  { id: 'low', threshold: 20, description: 'Winded' },
  { id: 'mid', threshold: 60, description: 'Steady' },
  { id: 'high', threshold: 90, description: 'Fresh' },
];
// Percent thresholds on a 0–200 stat put the same bands at 40, 120 and 180.
const stamina = (over: Partial<PlayerStat> = {}) => stat({ id: 's', name: 'Stamina', descriptors: BANDS, ...over });

/** What the AI's stat context shows as the stat's status. */
const aiStatus = (s: PlayerStat) => buildStatContext([s], { values: false, status: true, meaning: false }).replace(/^Stamina:? ?/, '');

/** `expr` as the stat's own script reads it, as text. */
async function readSelf(s: PlayerStat, expr: string, enabled: Record<string, boolean> = {}) {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const res = await executeStatCode(`console.log(JSON.stringify(${expr}));`, [s], s, { enabled });
  expect(res.error).toBeNull();
  return JSON.parse(String(log.mock.calls[0]?.[0])) as unknown;
}

const bram: Entity = { id: 'bram', name: 'Bram' };
const ownerTraits = (): StatCodeOwners => ({
  acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: [bram],
  world: {
    traits: [], groups: [], entities: [bram], persona: { source: 'none' },
    ...inPlayOwners({ traits: [], traitGroups: [], entities: [bram] }, { source: 'none' }, []),
  },
});

const turnOf = (over: Partial<FlatStatCodeTurn>) => runStatCodeTurn(statCodeTurnOf({
  stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: ownerTraits(),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
}));

// Banks one bit per check, read back as the probe's value.
const CROSSING = 'return (self.previous.descriptor === "Winded" ? 1 : 0) + (self.descriptor === "Fresh" ? 2 : 0)'
  + ' + (self.previous.descriptor !== self.descriptor ? 4 : 0);';

describe('a stat descriptor', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the band the AI stat context shows, for raw thresholds', async () => {
    for (const value of [0, 20, 21, 60, 75, 90]) {
      const s = stamina({ value });
      expect(await readSelf(s, 'self.descriptor')).toBe(aiStatus(s));
    }
    expect(await readSelf(stamina({ value: 75 }), 'self.descriptor')).toBe('Fresh');
  });

  it('reads the band the AI stat context shows, for percent thresholds', async () => {
    for (const value of [30, 40, 41, 120, 150, 180]) {
      const s = stamina({ value, max: 200, thresholdUnit: 'percent' });
      expect(await readSelf(s, 'self.descriptor')).toBe(aiStatus(s));
    }
    expect(await readSelf(stamina({ value: 100, max: 200, thresholdUnit: 'percent' }), 'self.descriptor')).toBe('Steady');
  });

  it('reads empty above every band and on a stat with no bands', async () => {
    expect(await readSelf(stamina({ value: 95 }), 'self.descriptor')).toBe('');
    expect(await readSelf(stat({ value: 10 }), 'self.descriptor')).toBe('');
  });

  it('reads the band on a stat a trait switched off', async () => {
    const s = stamina({ value: 10 });
    expect(await readSelf(s, '[self.enabled, stats.Stamina.descriptor]', { s: false })).toEqual([false, 'Winded']);
  });

  it('keeps the run-start band after a self.value write', async () => {
    expect(await readSelf(stamina({ value: 10 }), '(self.value = 80, [self.value, self.descriptor])')).toEqual([80, 'Winded']);
  });

  it('lists a write to descriptor as a read-only write, and keeps the band', async () => {
    const s = stamina({ value: 10 });
    const res = await executeStatCode('self.descriptor = "Fresh"; stats.Stamina.descriptor = "x"; return self.descriptor === "Winded" ? 1 : 0;', [s], s);
    expect(res.value).toBe(1);
    expect(res.readOnlyWrites).toEqual(expect.arrayContaining([expect.stringContaining('descriptor')]));
  });

  it('reads previous.descriptor from the turn start, so a crossing turn reads two bands', async () => {
    const probe = stamina({ value: 75, scripts: boxScripts({ after: CROSSING }) });
    const result = await turnOf({ stats: [probe], previous: [stamina({ value: 10 })] });
    expect(result.stats.find((s) => s.id === 's')?.value).toBe(7);
  });

  it('reads previous.descriptor as the current band on a turn that crossed none', async () => {
    const probe = stamina({ value: 50, max: 1000, scripts: boxScripts({ after: 'return self.previous.descriptor === self.descriptor ? 1 : 0;' }) });
    const result = await turnOf({ stats: [probe], previous: [stamina({ value: 30, max: 1000 })] });
    expect(result.stats.find((s) => s.id === 's')?.value).toBe(1);
  });

  it('reads an entity stat the same way', async () => {
    const probe = stamina({ value: 75, scripts: boxScripts({ after: CROSSING }) });
    const owner: OwnerCodeTurn = { id: bram.id, stats: [probe], enabled: {}, previous: [stamina({ value: 10 })], regenApplied: {} };
    const result = await turnOf({ owners: [owner] });
    expect(result.owners?.[bram.id]?.stats.find((s) => s.id === 's')?.value).toBe(7);
  });
});
