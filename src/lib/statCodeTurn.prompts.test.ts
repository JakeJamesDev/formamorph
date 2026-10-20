/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { PromptCanceled, type ScriptPromptHost, type ScriptPromptRequest } from './scriptPrompts';
import type { StatCodeOwners } from './statCodeTraits';
import type { PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});

const noTraits: StatCodeOwners = { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } };

const turn = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>): StatCodeTurn => statCodeTurnOf({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: noTraits,
  statNameOf: (stat) => stat.name, traitNameOf: (trait) => trait.name, ...over,
});

const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find((s) => s.id === id)?.value;

describe('runStatCodeTurn with player prompts', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('hands each script the turn’s prompt host and lands the write the answer decides', async () => {
    const asked: ScriptPromptRequest[] = [];
    const prompts: ScriptPromptHost = {
      prompt: (request) => {
        asked.push(request);
        return Promise.resolve((request.kind === 'ask' ? 1 : undefined) as never);
      },
    };
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, scripts: boxScripts({ after: `return player.ask('Door?', [{ label: 'Left', value: 10 }, { label: 'Right', value: 90 }]);` }) })],
      prompts,
    }));
    expect(valueOf(out.stats, 'a')).toBe(90);
    expect(asked).toEqual([{ kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false }]);
  });

  it('lands nothing from a script whose prompt was closed, while another script’s write still lands', async () => {
    const prompts: ScriptPromptHost = { prompt: () => Promise.reject(new PromptCanceled()) };
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 50, scripts: boxScripts({ after: `stats.B.value = 1; self.value = 9; player.confirm('Sure?'); return 7;` }) }),
        stat({ id: 'b', name: 'B', value: 50, scripts: boxScripts({ after: 'return 60;' }) }),
      ],
      prompts,
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
    expect(valueOf(out.stats, 'b')).toBe(60);
    expect(out.moved).toEqual(['b']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Stat Stat'), 'The player closed the prompt');
  });
});
