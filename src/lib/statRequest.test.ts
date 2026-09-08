import { describe, expect, it } from 'vitest';
import type { Placeholder, PlayerStat } from '@/types';
import { createStatRequest, readStatResponse, applyStatResponse, statResponseChanges } from './statRequest';
import { collectPins } from './placeholderPins';
import { resolvePlaceholders } from './placeholders';
import { resolveStatNames } from './resolveWorldNames';
import { TURN_PASSES } from './turnPipeline/turnPasses';
import { emptyTurnMaterial } from './turnPipeline/turnPlan';
import { testInput } from './turnPipeline/turnTestInputs';
import { defaultStatUpdatesPrompt } from '@/components/game/GamePrompts';
import { planTurn } from './turnPipeline/planTurn';
import { runTurn } from './turnPipeline/turnRunner';
import { computeTurnCommit } from './turnPipeline/computeTurnCommit';

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100,
  value: 100, regen: 10, descriptors: [], ...over,
});
const apply = (stats: PlayerStat[], raw: string, live = stats) =>
  applyStatResponse(stats, readStatResponse(raw, createStatRequest(stats)), new Set(live.map((s) => s.id)));

describe('stat request names', () => {
  it.each(['**Health**', '=c=Health==', '==Health==', '[Health](https://example.com)', '`Health`'])('sends plain %s through the real stat pass', (name) => {
    const snapshot = createStatRequest([stat({ name, description: 'Physical condition.' })]);
    const material = emptyTurnMaterial({ action: '', effectiveAction: '', turnId: 'turn', baseCtx: {}, destinations: [] });
    const pass = TURN_PASSES.find((p) => p.id === 'statUpdates')!;
    const request = pass.buildRequest(testInput({ prompts: { ...testInput().prompts, statUpdates: defaultStatUpdatesPrompt } }), {
      ...material, statRequest: snapshot,
    });
    expect(request.systemPrompt).toContain('- **Health:** 100/100 — Physical condition.');
    expect(request.statRequest?.targets).toEqual([{ id: 'health', name, plainName: 'Health' }]);
    expect(snapshot.context['<STATS DESCRIPTION>']).not.toContain(name === '`Health`' ? '`' : name);
  });

  it.each(['Health: -25', '**Health:** -25', '=c=Health==: -25', '[Health](https://example.com): -25', '- **Health**: -25'])('accepts plain and formatted replies: %s', (reply) => {
    const result = apply([stat({ name: '=c=Health==' })], reply);
    expect(result.stats[0].value).toBe(75);
    expect(result.diagnostics).toEqual([]);
  });

  it('preserves symbols on exact matches and only uses symbol removal as a unique fallback', () => {
    const stats = [stat({ name: 'Health+' }), stat({ id: 'other', name: 'Health−' })];
    expect(apply(stats, 'Health+: -5').stats.map((s) => s.value)).toEqual([95, 100]);
    expect(apply(stats, 'Health: -5').diagnostics).toEqual([{ name: 'Health', reason: 'ambiguous' }]);
    expect(apply([stat({ name: '❤️ Health' })], 'Health: -5').stats[0].value).toBe(95);
    expect(apply([stat({ name: '生命力' })], '生命力: -5').stats[0].value).toBe(95);
  });

  it('skips collisions after formatting removal but accepts a unique exact colored name', () => {
    const stats = [stat({ name: '=r=Health==' }), stat({ id: 'blue', name: '=b=Health==' })];
    expect(apply(stats, 'Health: -5').stats).toEqual(stats);
    expect(apply(stats, '**Health:** -5').diagnostics).toEqual([{ name: 'Health', reason: 'ambiguous' }]);
    expect(apply(stats, '=r=Health==: -5').stats.map((s) => s.value)).toEqual([95, 100]);
    expect(apply([stat(), stat({ id: 'other' })], 'Health: -5').diagnostics[0].reason).toBe('ambiguous');
  });

  it('reports unknown and invalid replies without creating updates', () => {
    const result = apply([stat()], 'Mana: -5\nHealth: 75/100\nNo changes\n   ');
    expect(result.stats[0].value).toBe(100);
    expect(result.diagnostics.map((d) => d.reason)).toEqual(['unknown', 'invalid', 'invalid']);
    expect(readStatResponse('', createStatRequest([stat()])).updates).toEqual([]);
  });

  it('sums repeated aliases and applies maximum changes before current values', () => {
    const result = apply([stat({ name: '=c=Health==' })], 'Health: +5\n**Health:** +5\nHealth: +20 MAX');
    expect(result.stats[0]).toMatchObject({ value: 110, max: 120, aiMaxDelta: 20 });
  });

  it('honors value and maximum restrictions and percentage caps', () => {
    expect(apply([stat({ noDecrease: true, noIncreaseMax: true })], 'Health: -5\nHealth: +20 MAX').stats[0]).toMatchObject({ value: 100, max: 100 });
    expect(apply([stat({ value: 50, noIncrease: true, noDecreaseMax: true })], 'Health: +5\nHealth: -20 MAX').stats[0]).toMatchObject({ value: 50, max: 100 });
    expect(apply([stat({ type: 'percentage' })], 'Health: +20 MAX').stats[0].max).toBe(100);
    expect(apply([stat()], 'Health: -20 MAX').stats[0]).toMatchObject({ value: 80, max: 80 });
  });

  it('does not retarget disabled or deleted stats to another stat with the same name', () => {
    const response = readStatResponse('Health: -5\nHealth: +10 MAX', createStatRequest([stat()]));
    const replacement = stat({ id: 'replacement' });
    const disabled = applyStatResponse([stat(), replacement], response, new Set(['replacement']));
    expect(disabled.stats.map((s) => s.value)).toEqual([100, 100]);
    expect(disabled.diagnostics).toEqual([{ name: 'Health', reason: 'disabled' }]);
    const deleted = applyStatResponse([replacement], response, new Set(['replacement']));
    expect(deleted.stats).toEqual([replacement]);
    expect(deleted.diagnostics).toEqual([{ name: 'Health', reason: 'missing' }]);
  });

  it.each([['c', 100], ['g', 90], ['y', 50], ['o', 30], ['r', 10]] as const)('updates the pinned %s band without replacing the authored chip', (color, value) => {
    const placeholders: Placeholder[] = [{ id: 'color', name: 'StatColor', roll: true, values: [
      { id: 'current', text: `=${color}=Health==` }, { id: 'lower', text: '=r=Health==' },
    ] }];
    const chip = '{{ph:color:world:stat-name}}';
    const stats = [stat({ name: chip, value, descriptors: [
      { id: 'lower', threshold: value - 5, description: 'Lower', placeholderPins: [{ placeholderId: 'color', valueId: 'lower', value: '=r=Health==' }] },
      { id: 'current', threshold: value, description: 'Current', placeholderPins: [{ placeholderId: 'color', valueId: 'current', value: `=${color}=Health==` }] },
    ] })];
    const resolve = (raw: PlayerStat[]) => {
      const pins = collectPins({ traits: [], stats: raw, placeholders });
      return resolveStatNames(raw, (text) => resolvePlaceholders(text, { placeholders, pins, rolls: { world: {}, unique: {} } }));
    };
    const response = readStatResponse('Health: -5', createStatRequest(resolve(stats)));
    const result = applyStatResponse(stats, response, new Set(['health']));
    expect(result.stats[0]).toMatchObject({ name: chip, value: value - 5, regen: 10 });
    expect(resolve(result.stats)[0].name).toBe('=r=Health==');
    expect(stats[0].value).toBe(value);
  });

  it('rerolls from the pre-turn baseline without stacking or losing raw names', () => {
    const baseline = [stat({ name: '{{ph:health:world:name}}' })];
    const snapshot = createStatRequest([stat({ name: '=c=Health==' })]);
    const first = applyStatResponse(baseline, readStatResponse('Health: -20', snapshot), new Set(['health']));
    const reroll = applyStatResponse(baseline, readStatResponse('**Health:** -10\nHealth: +20 MAX', snapshot), new Set(['health']));
    expect(first.stats[0].value).toBe(80);
    expect(reroll.stats[0]).toMatchObject({ name: baseline[0].name, value: 90, max: 120 });
  });

  it('keeps request IDs out of the saved history change map', () => {
    expect(statResponseChanges(readStatResponse('Health: -5', createStatRequest([stat({ id: 'stable-id' })])))).toEqual([{ health: -5 }]);
  });
});

it.each([false, true])('carries stat identities through a full turn with concurrent requests=%s', async (concurrentTurnRequests) => {
  const snapshot = createStatRequest([stat({ name: '**Health**' })]);
  const input = testInput({}, { concurrentTurnRequests, thinkingMode: 'off' });
  const plan = planTurn(input);
  const material = { ...emptyTurnMaterial({ action: 'Climb', effectiveAction: 'Climb', turnId: 'turn', baseCtx: {}, destinations: [] }), statRequest: snapshot };
  let liveStats = [stat()];
  const result = await runTurn({
    plan, material, signal: new AbortController().signal,
    request: async (request) => {
      if (request.type === 'statUpdates') {
        liveStats = [stat({ name: 'Vitality' }), stat({ id: 'other', name: 'Health' })];
        return 'Health: -5\nHealth: +10 MAX';
      }
      return request.type === 'narration' ? 'The climb leaves you winded.' : '';
    },
    advance: (event) => event.at === 'pass' && event.outcomes[0].id === 'narration'
      ? { narration: event.outcomes[0].raw } : undefined,
  });
  const commit = computeTurnCommit({ result, plan, context: {
    participants: [], knownDiscoveredNames: [], notes: '', reasoning: { text: '', ms: 0 }, gameTime: 0,
  } });
  expect(commit?.statResponse).not.toBeNull();
  const applied = applyStatResponse(liveStats, commit!.statResponse!, new Set(liveStats.map((s) => s.id)));
  expect(applied.stats.map(({ name, value, max }) => ({ name, value, max }))).toEqual([
    { name: 'Vitality', value: 95, max: 110 }, { name: 'Health', value: 100, max: 100 },
  ]);
  expect(commit!.turn).not.toHaveProperty('statResponse');
});
