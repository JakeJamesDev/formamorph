/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { afterRun, overlayStatCodeResult, runStatCodeTurn, type OwnerCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { openOutputRun } from './outputRun';
import { landSwitchRun } from './switchRunLanding';
import type { TraitRuntimeState } from './traitRuntime';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import type { Entity, PlayerStat, Script, ScriptTiming } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const script = (code: string, timing: ScriptTiming, over: Partial<Script> = {}): Script => ({ id: `${timing}:${code}`, timing, code, ...over });

const rage = (over: Partial<PlayerStat> = {}) => stat({ id: 'r', name: 'Rage', value: 10, hidden: true, ...over });
const trust = (over: Partial<PlayerStat> = {}) => stat({ id: 't', name: 'Trust', value: 3, hidden: true, ...over });
const bram: Entity = { id: 'bram', name: 'Bram' };
const owner = (id: string, stats: PlayerStat[]): OwnerCodeTurn => ({ id, stats, enabled: {}, previous: stats, regenApplied: {} });

const turnOf = (stats: PlayerStat[], over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});
const run = (stats: PlayerStat[], over: Partial<FlatStatCodeTurn> = {}) => runStatCodeTurn(turnOf(stats, over));

const hiddenOf = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id)?.hidden === true;

describe('runStatCodeTurn hidden writes (Q4, Q10, Q16)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a stat a Before the AI script unhides, and lists it as changed', async () => {
    const out = await run([rage()], { timing: 'before', worldScripts: [script('stats.Rage.hidden = false;', 'before')] });
    expect(hiddenOf(out.stats, 'r')).toBe(false);
    expect(out.hiddenChanged).toEqual(['r']);
    expect(out.moved).toEqual([]);
  });

  it('hides the stat its own script writes self.hidden on', async () => {
    const out = await run([rage({ hidden: false, scripts: boxScripts({ after: 'self.hidden = true;' }) })]);
    expect(hiddenOf(out.stats, 'r')).toBe(true);
    expect(out.hiddenChanged).toEqual(['r']);
  });

  it('lists nothing when a write leaves hidden as it stood', async () => {
    const out = await run([rage({ scripts: boxScripts({ after: 'self.hidden = true;' }) })]);
    expect(out.hiddenChanged).toEqual([]);
  });

  it('takes the write on an entity stat and on a global stat from a stat’s script', async () => {
    const hub = stat({ id: 'hub', name: 'Hub', scripts: boxScripts({ after: 'stats.Rage.hidden = false; entities.Bram.stats.Trust.hidden = false;' }) });
    const entities = [bram];
    const ownerTraits: StatCodeOwners = {
      acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities,
      world: { traits: [], groups: [], entities, persona: { source: 'none' }, ...inPlayOwners({ traits: [], traitGroups: [], entities }, { source: 'none' }, []) },
    };
    const out = await run([hub, rage()], { owners: [owner('bram', [trust()])], ownerTraits });
    expect(hiddenOf(out.stats, 'r')).toBe(false);
    expect(hiddenOf(out.owners?.bram.stats, 't')).toBe(false);
    expect(out.owners?.bram.hiddenChanged).toEqual(['t']);
  });

  it('lands writes in call order across one timing’s scripts, the later one winning', async () => {
    const out = await run([rage()], {
      worldScripts: [script('stats.Rage.hidden = true;', 'after', { order: 2 }), script('stats.Rage.hidden = false;', 'after', { order: 1 })],
    });
    expect(hiddenOf(out.stats, 'r')).toBe(true);
    const swapped = await run([rage()], {
      worldScripts: [script('stats.Rage.hidden = true;', 'after', { order: 1 }), script('stats.Rage.hidden = false;', 'after', { order: 2 })],
    });
    expect(hiddenOf(swapped.stats, 'r')).toBe(false);
  });

  it('lands a During AI Output write with the After batch, before the After scripts run (Q23)', async () => {
    const reader = stat({ id: 'seen', name: 'Seen', value: 0, scripts: boxScripts({ after: 'return stats.Rage.hidden ? 1 : 2;' }) });
    const start = turnOf([rage(), reader], { worldScripts: [script('stats.Rage.hidden = false;', 'output')] });
    const output = openOutputRun(start);
    if (!output) throw new Error('the output script opens a run');
    await output.rewrite('The door creaks.', { index: 0, full: 'The door creaks.', earlier: [] });
    expect(hiddenOf(start.state.stats, 'r')).toBe(true);
    const landed = await output.landing();
    expect(landed?.hiddenChanged).toEqual(['r']);
    if (!landed) throw new Error('the run wrote');
    const after = await runStatCodeTurn({ ...afterRun(start, landed), timing: 'after' });
    expect(after.stats.find((s) => s.id === 'seen')?.value).toBe(2);
  });

  it('saves a World Tool’s hidden write, and a replay of it lands again (Q46)', async () => {
    const out = await run([rage()], { triggers: [{ name: 'Reveal', code: 'stats.Rage.hidden = false;', args: {} }], triggersOnly: true });
    expect(out.triggerWrites).toMatchObject({ stats: [{ owner: null, writes: [{ id: 'r', hidden: false }] }] });
    if (!out.triggerWrites) throw new Error('the trigger wrote');
    const replay = await run([rage()], { replayed: [{ name: 'Reveal', writes: JSON.parse(JSON.stringify(out.triggerWrites)) }], triggersOnly: true });
    expect(hiddenOf(replay.stats, 'r')).toBe(false);
  });
});

describe('a hidden flip on the latest state', () => {
  it('lays only the flipped hidden onto stats that moved since the run read them', () => {
    const latest = [rage({ value: 40 }), trust({ hidden: false })];
    const result = { stats: [rage({ hidden: false }), trust({ hidden: false })], moved: [], boundsChanged: [], hiddenChanged: ['r'] };
    const out = overlayStatCodeResult(latest, result, []);
    expect(out.map((s) => [s.id, s.value, s.hidden === true])).toEqual([['r', 40, false], ['t', 3, false]]);
  });

  it('lands a switch run’s hidden flip on the state play reached meanwhile', () => {
    const state = (stats: PlayerStat[]): TraitRuntimeState => ({ stats, traits: [], disabledTraitIds: [], appliedValues: {} });
    const { state: landed } = landSwitchRun(
      state([rage()]), state([rage({ hidden: false })]), state([rage({ value: 25 })]), { traits: [], groups: [] },
    );
    expect(landed.stats.map((s) => [s.value, s.hidden === true])).toEqual([[25, false]]);
  });
});
