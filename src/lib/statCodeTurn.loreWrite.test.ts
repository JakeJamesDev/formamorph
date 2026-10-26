/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { afterRun, runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { openOutputRun } from './outputRun';
import { withLoreWrites } from './loreToggles';
import type { Dictionary, PlayerStat, Script, ScriptTiming } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const script = (code: string, timing: ScriptTiming, over: Partial<Script> = {}): Script => ({ id: `${timing}:${code}`, timing, code, ...over });

const lore: Dictionary = {
  id: 'lore', name: 'Lore', entries: [{ id: 'sealed', name: 'Sealed', key: ['vault'], value: 'Hidden.', enabled: false }],
};

const turnOf = (stats: PlayerStat[], over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
  placeholders: { placeholders: [], dictionaries: [lore], rolls: { world: {} } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});
const run = (stats: PlayerStat[], over: Partial<FlatStatCodeTurn> = {}) => runStatCodeTurn(turnOf(stats, over));

const SEALED_ON = { lore: { entries: { sealed: { enabled: true } } } };
const SEALED_WRITE = (value: boolean) => ({ book: 'lore', entry: 'sealed', field: 'enabled', value });

describe('runStatCodeTurn lore writes (Q13, Q16, Q23, Q50)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lands writes in call order across one timing’s scripts, the later one winning', async () => {
    const on = 'dictionaries.Lore.entries.Sealed.enabled = true;';
    const off = 'dictionaries.Lore.entries.Sealed.enabled = false;';
    const out = await run([], { worldScripts: [script(on, 'after', { order: 2 }), script(off, 'after', { order: 1 })] });
    expect(out.loreWrites).toEqual([SEALED_WRITE(false), SEALED_WRITE(true)]);
    expect(withLoreWrites({}, out.loreWrites)).toEqual(SEALED_ON);
    const swapped = await run([], { worldScripts: [script(on, 'after', { order: 1 }), script(off, 'after', { order: 2 })] });
    expect(swapped.loreWrites).toEqual([SEALED_WRITE(true), SEALED_WRITE(false)]);
  });

  it('lands a During AI Output write with the After batch, which reads it (Q23)', async () => {
    const reader = stat({ id: 'seen', name: 'Seen', scripts: boxScripts({ after: 'return dictionaries.Lore.entries.Sealed.enabled ? 1 : 2;' }) });
    const start = turnOf([reader], { worldScripts: [script('dictionaries.Lore.entries.Sealed.enabled = true;', 'output')] });
    const output = openOutputRun(start);
    if (!output) throw new Error('the output script opens a run');
    await output.rewrite('The door creaks.', { index: 0, full: 'The door creaks.', earlier: [] });
    expect(start.state.loreToggles).toBeUndefined();
    const landed = await output.landing();
    if (!landed) throw new Error('the run wrote');
    expect(landed.loreWrites).toEqual([SEALED_WRITE(true)]);
    const after = await runStatCodeTurn({ ...afterRun(start, landed), timing: 'after' });
    expect(after.stats.find((s) => s.id === 'seen')?.value).toBe(1);
  });

  it('saves a World Tool’s lore write, and a replay of it lands again (Q50)', async () => {
    const out = await run([], { triggers: [{ name: 'Unseal', code: 'dictionaries.Lore.entries.Sealed.enabled = true;', args: {} }], triggersOnly: true });
    expect(out.triggerWrites).toEqual({ lore: [{ book: 'lore', entry: 'sealed', field: 'enabled', value: true }] });
    if (!out.triggerWrites) throw new Error('the trigger wrote');
    const replay = await run([], { replayed: [{ name: 'Unseal', writes: JSON.parse(JSON.stringify(out.triggerWrites)) }], triggersOnly: true });
    expect(replay.loreWrites).toEqual([SEALED_WRITE(true)]);
  });

  it('saves a World Tool’s book write with no entry, and a replay of it lands again (Q51)', async () => {
    const out = await run([], { triggers: [{ name: 'Close', code: 'dictionaries.Lore.enabled = false;', args: {} }], triggersOnly: true });
    expect(out.triggerWrites).toEqual({ lore: [{ book: 'lore', field: 'enabled', value: false }] });
    if (!out.triggerWrites) throw new Error('the trigger wrote');
    const replay = await run([], { replayed: [{ name: 'Close', writes: JSON.parse(JSON.stringify(out.triggerWrites)) }], triggersOnly: true });
    expect(withLoreWrites({}, replay.loreWrites)).toEqual({ lore: { enabled: false } });
  });
});
