/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { afterRun, runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { PlayerStat, Script, ScriptTiming, Trait, WorldOption } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const script = (code: string, timing: ScriptTiming, over: Partial<Script> = {}): Script => ({ id: `${timing}:${code}`, timing, code, ...over });
const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const LIT: WorldOption = { id: 'lit', name: 'Lanterns Lit', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
// An Always On trait gated on the Option: it joins whenever its gate holds.
const GLOW: Trait = {
  id: 'glow', name: 'Glow', statChanges: [], mode: 'alwaysOn', requires: [{ all: [{ kind: 'option', id: 'lit' }] }],
};

const turnOf = (over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [GLOW], groups: [], options: [LIT] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

describe('runStatCodeTurn World Option writes (Q17)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('turns on a trait gated on the Option at the writing script’s timing', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: [script('options["Lanterns Lit"] = true;', 'after')] }));
    expect(out.optionWrites).toEqual([{ id: 'lit', value: true }]);
    expect(out.traits?.acquired.map((t) => t.id)).toEqual(['glow']);
    expect(out.traits?.log).toEqual(['Trait switched on: Glow']);
  });

  it('turns the gated trait on when the same script also switches a trait', async () => {
    const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [] };
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [GLOW, brave], groups: [], options: [LIT] } },
      worldScripts: [script('traits.Brave.enabled = true; options["Lanterns Lit"] = true;', 'after')],
    }));
    expect(out.traits?.acquired.map((t) => t.id).sort()).toEqual(['brave', 'glow']);
  });

  it('leaves the trait off when the script writes the other value', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: [script('options["Lanterns Lit"] = false;', 'after')] }));
    expect(out.traits).toBeUndefined();
  });

  it('lets a later script of the same timing read the written value and the trait it opened', async () => {
    const reader = stat({ id: 'seen', name: 'Seen', scripts: [script('return (options["Lanterns Lit"] ? 10 : 0) + (traits.Glow.enabled ? 1 : 0);', 'after')] });
    const out = await runStatCodeTurn(turnOf({
      stats: [reader], previous: [reader],
      worldScripts: [script('options["Lanterns Lit"] = true;', 'after')],
    }));
    expect(out.stats.find((s) => s.id === 'seen')?.value).toBe(11);
  });

  it('carries the written value into the turn the next run starts from', async () => {
    const start = turnOf({ worldScripts: [script('options["Lanterns Lit"] = true;', 'after')] });
    const out = await runStatCodeTurn(start);
    expect(afterRun(start, out).state.ownerTraits.world.optionValues).toEqual({ lit: true });
  });
});
