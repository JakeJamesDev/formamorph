/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { planCodeRename } from './statCodeRename';
import { withScriptCode } from './scripts';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { PlayerStat, Script } from '@/types';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

const gale = (name: string): PlayerStat => ({
  id: 'gale', name, type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [],
});
const weather: Script = { id: 'weather', timing: 'after', code: 'stats.Gale.value = 3;' };

const turn = (stat: PlayerStat, worldScripts: Script[]): StatCodeTurn => statCodeTurnOf({
  stats: [stat], worldScripts, enabled: {}, previous: [stat], asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
});

// A world script renamed with the stat it names keeps reaching that stat in play (Q51).
describe('a stat rename that only a world script names', () => {
  it('rewrites the world script, which then still moves the renamed stat', async () => {
    const plan = planCodeRename({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stats: [gale('Gust')], worldScripts: [weather], otherNames: [], stat: { id: 'gale' },
    });
    expect(plan?.edits).toEqual([{ home: { kind: 'world' }, name: 'World', scripts: { weather: 'stats.Gust.value = 3;' } }]);

    const rewritten = withScriptCode([weather], plan!.edits[0].scripts);
    const moved = await runStatCodeTurn(turn(gale('Gust'), rewritten));
    expect(moved.stats[0].value).toBe(3);
    // Left as it was, the script reaches no stat after the rename.
    const stranded = await runStatCodeTurn(turn(gale('Gust'), [weather]));
    expect(stranded.stats[0].value).toBe(1);
  });
});
